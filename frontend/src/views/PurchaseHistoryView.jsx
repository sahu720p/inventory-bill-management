import React, { useState, useEffect } from 'react';
import {
  PackageCheck,
  Search,
  Calendar,
  Eye,
  Trash2,
  Edit2,
  FileImage,
  Filter,
  X,
  Plus,
  Save,
  CheckCircle,
  List,
  Layers,
  ShoppingBag
} from 'lucide-react';
import { purchaseApi } from '../services/api';
import { db } from '../db/db';
import { formatCurrency, calculatePricing } from '../services/pricingService';
import ConfirmModal from '../components/common/ConfirmModal';

export default function PurchaseHistoryView({
  setActiveTab,
  onShowToast
}) {
  const [viewMode, setViewMode] = useState('ITEMS'); // 'ITEMS' (Product Level Rate-to-Rate) or 'BILLS' (Bill Archive)
  const [bills, setBills] = useState([]);
  const [purchaseItems, setPurchaseItems] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [selectedBill, setSelectedBill] = useState(null);
  const [billItemsModal, setBillItemsModal] = useState(null);
  const [viewImageModal, setViewImageModal] = useState(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [deleteItemConfirmId, setDeleteItemConfirmId] = useState(null);
  const [editingItem, setEditingItem] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadPurchases();
  }, []);

  const loadPurchases = async () => {
    try {
      setIsLoading(true);
      // 1. Try MongoDB API
      try {
        const res = await purchaseApi.getAllBills();
        if (res.success && Array.isArray(res.bills)) {
          const fetchedBills = res.bills.map(b => ({ ...b, id: b._id || b.id }));
          const fetchedItems = (res.items || []).map(i => ({ ...i, id: i._id || i.id }));
          setBills(fetchedBills);
          setPurchaseItems(fetchedItems);
          return;
        }
      } catch (apiErr) {
        console.warn('Purchase API error, falling back to local DB:', apiErr.message);
      }

      // 2. Fallback to local Dexie
      const allBills = await db.purchaseBills.toArray();
      const allItems = await db.purchaseItems.toArray();

      allBills.sort((a, b) => new Date(b.createdAt || b.date) - new Date(a.createdAt || a.date));
      allItems.sort((a, b) => (a.srNo || 0) - (b.srNo || 0));

      setBills(allBills);
      setPurchaseItems(allItems);
    } catch (err) {
      console.error('Failed to load purchases:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Filter purchase items (Rate-to-Rate products)
  const filteredItems = purchaseItems.filter(item => {
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      item.productName?.toLowerCase().includes(term) ||
      item.hsn?.includes(term) ||
      item.billId?.toLowerCase().includes(term);

    return matchesSearch;
  });

  // Filter bills
  const filteredBills = bills.filter(bill => {
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      bill.billId?.toLowerCase().includes(term) ||
      bill.supplierName?.toLowerCase().includes(term);

    const matchesDate = !dateFilter || bill.date === dateFilter;

    const hasMatchingItem = purchaseItems.some(
      item => item.billId === bill.billId &&
      (item.productName?.toLowerCase().includes(term) || item.hsn?.includes(term))
    );

    return (matchesSearch || hasMatchingItem) && matchesDate;
  });

  // View Bill Items Details Modal
  const handleOpenBillDetails = async (bill) => {
    try {
      const res = await purchaseApi.getBillDetails(bill.billId);
      if (res.success && res.items) {
        setBillItemsModal({ bill: res.bill || bill, items: res.items.map(i => ({ ...i, id: i._id || i.id })) });
        return;
      }
    } catch (e) {
      console.warn('API error fetching bill items, using local:', e.message);
    }
    const items = await db.purchaseItems.where('billId').equals(bill.billId).toArray();
    setBillItemsModal({ bill, items });
  };

  // Delete Purchase Bill & associated items
  const handleDeleteBill = async () => {
    if (!deleteConfirmId) return;

    try {
      try {
        await purchaseApi.deleteBill(deleteConfirmId);
      } catch (apiErr) {
        console.warn('API delete bill error:', apiErr.message);
      }

      // Also clean local
      try {
        const bill = await db.purchaseBills.get(deleteConfirmId);
        if (bill) {
          await db.purchaseItems.where('billId').equals(bill.billId).delete();
          await db.purchaseBills.delete(deleteConfirmId);
        }
      } catch (e) {}

      if (onShowToast) onShowToast('Purchase bill deleted successfully.', 'success');
      loadPurchases();
    } catch (err) {
      console.error('Delete failed:', err);
    } finally {
      setDeleteConfirmId(null);
    }
  };

  // Delete Single Purchase Item
  const handleDeleteItem = async () => {
    if (!deleteItemConfirmId) return;

    try {
      try {
        await purchaseApi.deleteItem(deleteItemConfirmId);
      } catch (apiErr) {
        console.warn('API delete item error:', apiErr.message);
      }

      try {
        await db.purchaseItems.delete(deleteItemConfirmId);
      } catch (e) {}

      if (onShowToast) onShowToast('Item removed from purchase history.', 'success');
      loadPurchases();
    } catch (err) {
      console.error('Failed to delete item:', err);
    } finally {
      setDeleteItemConfirmId(null);
    }
  };

  // Save Edited Purchase Item
  const handleSaveItemEdit = async () => {
    if (!editingItem) return;

    try {
      const payload = {
        productName: editingItem.productName.trim(),
        hsn: editingItem.hsn.trim(),
        wholesaleRate: parseFloat(editingItem.wholesaleRate) || 0,
        quantity: parseFloat(editingItem.quantity) || 1
      };

      try {
        await purchaseApi.updateItem(editingItem.id || editingItem._id, payload);
      } catch (apiErr) {
        console.warn('API update item error:', apiErr.message);
      }

      try {
        await db.purchaseItems.update(editingItem.id, payload);

        // Also sync with Product Master if exists
        const prod = await db.products.where('productName').equalsIgnoreCase(editingItem.productName.trim()).first();
        if (prod) {
          const pricing = calculatePricing(editingItem.wholesaleRate, 5, 20);
          await db.products.update(prod.id, {
            hsn: editingItem.hsn.trim(),
            wholesaleRate: pricing.wholesaleRate,
            costAfterGST: pricing.costAfterGST,
            sellingPrice: pricing.sellingPrice
          });
        }
      } catch (e) {}

      setEditingItem(null);
      if (billItemsModal) {
        handleOpenBillDetails(billItemsModal.bill);
      }
      loadPurchases();
      if (onShowToast) onShowToast('Purchase item updated & synced with Product Master!', 'success');
    } catch (err) {
      console.error('Failed to update item:', err);
    }
  };

  // Helper for computing bill total if corrupted/zero
  const getBillTotal = (bill) => {
    if (typeof bill.totalAmount === 'number' && bill.totalAmount > 0) return bill.totalAmount;
    const matchingItems = purchaseItems.filter(i => i.billId === bill.billId);
    if (matchingItems.length > 0) {
      return matchingItems.reduce((s, it) => s + ((parseFloat(it.wholesaleRate) || 0) * (parseFloat(it.quantity) || 1)), 0);
    }
    return 0;
  };

  // Total wholesale value of items
  const totalWholesaleValue = filteredItems.reduce((sum, it) => sum + ((it.wholesaleRate || 0) * (it.quantity || 1)), 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800 }}>Purchase History</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Scanned wholesale products saved rate-to-rate (without GST) • Auto-calculated selling prices in Product Master
          </p>
        </div>

        <button
          onClick={() => setActiveTab('scanner')}
          className="btn btn-primary"
        >
          <Plus size={16} />
          <span>+ Scan New Purchase Bill</span>
        </button>
      </div>

      {/* View Switcher Tabs & Filters Card */}
      <div className="card" style={{ padding: '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          {/* View Mode Toggle */}
          <div style={{ display: 'flex', background: 'var(--bg-secondary)', padding: '0.25rem', borderRadius: 'var(--radius-md)' }}>
            <button
              onClick={() => setViewMode('ITEMS')}
              className={`btn btn-sm ${viewMode === 'ITEMS' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ border: 'none', display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.45rem 0.85rem' }}
            >
              <List size={16} />
              <span>All Scanned Products ({purchaseItems.length})</span>
            </button>

            <button
              onClick={() => setViewMode('BILLS')}
              className={`btn btn-sm ${viewMode === 'BILLS' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ border: 'none', display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.45rem 0.85rem' }}
            >
              <Layers size={16} />
              <span>Wholesale Bills Archive ({bills.length})</span>
            </button>
          </div>

          {/* Search Box */}
          <div style={{ position: 'relative', minWidth: '280px', flex: 1, maxWidth: '420px' }}>
            <Search
              size={18}
              style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}
            />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search product name, Bill ID..."
              className="form-input"
              style={{ paddingLeft: '2.5rem' }}
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <X size={16} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* VIEW 1: ITEM LEVEL TABLE (Rate-to-Rate Without GST) */}
      {viewMode === 'ITEMS' && (
        <div className="table-container">
          <table className="custom-table">
            <thead>
              <tr>
                <th style={{ width: '60px', textAlign: 'center' }}>Sr. No.</th>
                <th>Product Name</th>
                <th style={{ width: '110px', textAlign: 'center' }}>Quantity</th>
                <th style={{ width: '160px', textAlign: 'right' }}>Wholesale Rate (₹)</th>
                <th style={{ width: '160px', textAlign: 'right' }}>Total Cost (₹)</th>
                <th style={{ width: '150px' }}>Bill Ref</th>
                <th style={{ width: '100px', textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '3.5rem 1rem', color: 'var(--text-muted)' }}>
                    <ShoppingBag size={38} style={{ margin: '0 auto 0.5rem', opacity: 0.4 }} />
                    <div style={{ fontWeight: 600, fontSize: '1rem' }}>No purchase products found.</div>
                    <div style={{ fontSize: '0.85rem', marginTop: '0.25rem' }}>
                      Scan or upload a purchase bill to automatically populate products here.
                    </div>
                  </td>
                </tr>
              ) : (
                filteredItems.map((item, index) => {
                  const lineTotal = (item.wholesaleRate || 0) * (item.quantity || 1);

                  return (
                    <tr key={item.id || index}>
                      {/* Sr No */}
                      <td style={{ textAlign: 'center', fontWeight: 700, color: 'var(--text-muted)' }}>
                        {item.srNo || index + 1}
                      </td>

                      {/* Product Name */}
                      <td>
                        <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                          {item.productName}
                        </div>
                      </td>

                      {/* Quantity */}
                      <td style={{ textAlign: 'center' }}>
                        <span className="badge badge-gold" style={{ fontSize: '0.8rem' }}>
                          {item.quantity} {item.unit || 'Pcs'}
                        </span>
                      </td>

                      {/* Wholesale Rate (Rate to Rate, Clean, No GST) */}
                      <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.95rem' }}>
                        ₹{Number(item.wholesaleRate || 0).toFixed(2)}
                      </td>

                      {/* Total Cost */}
                      <td style={{ textAlign: 'right', fontWeight: 800, color: 'var(--gold-600)', fontSize: '0.95rem' }}>
                        ₹{lineTotal.toFixed(2)}
                      </td>

                      {/* Bill ID */}
                      <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {item.billId || 'Manual Entry'}
                      </td>

                      {/* Actions */}
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'flex', justifyContent: 'center', gap: '0.35rem' }}>
                          <button
                            onClick={() => setEditingItem(item)}
                            className="btn btn-icon btn-secondary"
                            style={{ padding: '0.3rem' }}
                            title="Edit Rate / Quantity"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            onClick={() => setDeleteItemConfirmId(item.id)}
                            className="btn btn-icon btn-secondary"
                            style={{ padding: '0.3rem', color: 'var(--rose-500)', border: 'none' }}
                            title="Delete Item"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {filteredItems.length > 0 && (
              <tfoot>
                <tr style={{ background: '#FAF8F5', fontWeight: 800 }}>
                  <td colSpan="3" style={{ padding: '0.85rem' }}>
                    Total: {filteredItems.length} Products
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    {filteredItems.reduce((s, i) => s + (parseFloat(i.quantity) || 0), 0)} Pcs
                  </td>
                  <td style={{ textAlign: 'right', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    Total Wholesale Value:
                  </td>
                  <td style={{ textAlign: 'right', color: 'var(--gold-600)', fontSize: '1.05rem' }}>
                    ₹{totalWholesaleValue.toFixed(2)}
                  </td>
                  <td colSpan="2"></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}

      {/* VIEW 2: BILLS ARCHIVE TABLE */}
      {viewMode === 'BILLS' && (
        <div className="table-container">
          <table className="custom-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Bill ID</th>
                <th>Wholesale Supplier</th>
                <th style={{ textAlign: 'center' }}>Items</th>
                <th style={{ textAlign: 'right' }}>Total Wholesale (₹)</th>
                <th style={{ textAlign: 'center' }}>Source Bill</th>
                <th style={{ textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredBills.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
                    <PackageCheck size={36} style={{ margin: '0 auto 0.5rem', opacity: 0.4 }} />
                    <div>No purchase bills matching your search.</div>
                  </td>
                </tr>
              ) : (
                filteredBills.map((bill) => (
                  <tr key={bill.id}>
                    <td style={{ fontWeight: 600 }}>{bill.date}</td>
                    <td style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{bill.billId}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>{bill.supplierName}</td>
                    <td style={{ textAlign: 'center' }}>
                      <span className="badge badge-gold">
                        {bill.totalItems || 0} items
                      </span>
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--gold-600)' }}>
                      {formatCurrency(getBillTotal(bill))}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {bill.imageUrl ? (
                        <button
                          onClick={() => setViewImageModal(bill.imageUrl)}
                          className="btn btn-secondary btn-sm"
                          style={{ padding: '0.25rem 0.5rem' }}
                          title="View Original Bill Photo"
                        >
                          <FileImage size={15} style={{ color: 'var(--gold-500)' }} />
                          <span>View</span>
                        </button>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>None</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'flex', justifyContent: 'center', gap: '0.35rem' }}>
                        <button
                          onClick={() => handleOpenBillDetails(bill)}
                          className="btn btn-icon btn-secondary"
                          style={{ padding: '0.35rem' }}
                          title="View Items in Bill"
                        >
                          <Eye size={15} />
                        </button>

                        <button
                          onClick={() => setDeleteConfirmId(bill.id)}
                          className="btn btn-icon btn-secondary"
                          style={{ padding: '0.35rem', color: 'var(--rose-500)', border: 'none' }}
                          title="Delete Bill"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Bill Items Breakdown Modal */}
      {billItemsModal && (
        <div className="modal-backdrop" onClick={() => setBillItemsModal(null)}>
          <div className="modal-content modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3 style={{ fontSize: '1.25rem' }}>
                  Bill Items — {billItemsModal.bill.billId}
                </h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  Supplier: {billItemsModal.bill.supplierName} • Date: {billItemsModal.bill.date}
                </p>
              </div>
              <button
                onClick={() => setBillItemsModal(null)}
                className="btn btn-icon btn-secondary"
                style={{ border: 'none' }}
              >
                <X size={20} />
              </button>
            </div>

            <div className="modal-body">
              <div className="table-container">
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th style={{ width: '45px' }}>#</th>
                      <th>Product Name</th>
                      <th>HSN</th>
                      <th style={{ textAlign: 'center' }}>Qty</th>
                      <th style={{ textAlign: 'right' }}>Wholesale Rate (₹)</th>
                      <th style={{ textAlign: 'right' }}>Total (₹)</th>
                      <th style={{ textAlign: 'center' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {billItemsModal.items.map((item, idx) => (
                      <tr key={item.id}>
                        <td>{item.srNo || idx + 1}</td>
                        <td style={{ fontWeight: 600 }}>{item.productName}</td>
                        <td>{item.hsn}</td>
                        <td style={{ textAlign: 'center' }}>{item.quantity} {item.unit || 'Pcs'}</td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>₹{item.wholesaleRate}</td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--gold-600)' }}>
                          ₹{(item.wholesaleRate * item.quantity).toFixed(2)}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <button
                            onClick={() => setEditingItem(item)}
                            className="btn btn-icon btn-secondary"
                            style={{ padding: '0.25rem' }}
                            title="Edit"
                          >
                            <Edit2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
              <div style={{ fontWeight: 700 }}>
                Total Bill Value: {formatCurrency(
                  (typeof billItemsModal.bill.totalAmount === 'number' && billItemsModal.bill.totalAmount > 0)
                    ? billItemsModal.bill.totalAmount
                    : billItemsModal.items.reduce((s, it) => s + ((parseFloat(it.wholesaleRate) || 0) * (parseFloat(it.quantity) || 1)), 0)
                )}
              </div>
              <button onClick={() => setBillItemsModal(null)} className="btn btn-secondary">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Item Modal */}
      {editingItem && (
        <div className="modal-backdrop" onClick={() => setEditingItem(null)}>
          <div className="modal-content" style={{ maxWidth: '480px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Edit Purchase Item</h3>
              <button onClick={() => setEditingItem(null)} className="btn btn-icon btn-secondary" style={{ border: 'none' }}>
                <X size={18} />
              </button>
            </div>

            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Product Name</label>
                <input
                  type="text"
                  value={editingItem.productName}
                  onChange={(e) => setEditingItem({ ...editingItem, productName: e.target.value })}
                  className="form-input"
                  style={{ fontWeight: 600 }}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Quantity</label>
                <input
                  type="number"
                  min="1"
                  value={editingItem.quantity}
                  onChange={(e) => setEditingItem({ ...editingItem, quantity: e.target.value })}
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Wholesale Rate (₹) [Rate-to-Rate]</label>
                <input
                  type="number"
                  step="0.01"
                  min="1"
                  value={editingItem.wholesaleRate}
                  onChange={(e) => setEditingItem({ ...editingItem, wholesaleRate: e.target.value })}
                  className="form-input"
                  style={{ fontWeight: 700 }}
                />
              </div>
            </div>

            <div className="modal-footer">
              <button onClick={() => setEditingItem(null)} className="btn btn-secondary">
                Cancel
              </button>
              <button onClick={handleSaveItemEdit} className="btn btn-primary">
                <Save size={16} />
                <span>Save Changes</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bill Image View Modal */}
      {viewImageModal && (
        <div className="modal-backdrop" onClick={() => setViewImageModal(null)}>
          <div className="modal-content modal-lg" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '850px' }}>
            <div className="modal-header">
              <h3>Original Wholesaler Bill Image</h3>
              <button onClick={() => setViewImageModal(null)} className="btn btn-icon btn-secondary" style={{ border: 'none' }}>
                <X size={20} />
              </button>
            </div>

            <div className="modal-body" style={{ textAlign: 'center', background: '#222', padding: '1rem', borderRadius: 'var(--radius-md)' }}>
              <img
                src={viewImageModal}
                alt="Source Bill"
                style={{ maxWidth: '100%', maxHeight: '70vh', objectFit: 'contain', borderRadius: '4px' }}
              />
            </div>

            <div className="modal-footer">
              <button onClick={() => setViewImageModal(null)} className="btn btn-secondary">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Delete Bill */}
      <ConfirmModal
        isOpen={deleteConfirmId !== null}
        title="Delete Purchase Bill"
        message="Are you sure you want to delete this purchase bill record and all its associated line items?"
        confirmText="Delete Bill"
        onConfirm={handleDeleteBill}
        onCancel={() => setDeleteConfirmId(null)}
      />

      {/* Confirmation Modal for Delete Single Item */}
      <ConfirmModal
        isOpen={deleteItemConfirmId !== null}
        title="Delete Purchase Item"
        message="Are you sure you want to remove this item from Purchase History?"
        confirmText="Delete Item"
        onConfirm={handleDeleteItem}
        onCancel={() => setDeleteItemConfirmId(null)}
      />
    </div>
  );
}
