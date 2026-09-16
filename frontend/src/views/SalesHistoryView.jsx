import React, { useState, useEffect } from 'react';
import {
  History,
  Search,
  Calendar,
  Eye,
  Trash2,
  Printer,
  Download,
  Filter,
  Receipt,
  Plus,
  X,
  Phone,
  User,
  Edit2,
  Save,
  Wrench,
  CheckCircle2,
  CreditCard,
  MapPin,
  RefreshCw
} from 'lucide-react';
import { invoiceApi } from '../services/api';
import { db } from '../db/db';
import { deleteInvoice, updateExistingInvoice, repairAllInvoices, getInvoiceItems } from '../services/invoiceService';
import { formatCurrency } from '../services/pricingService';
import ConfirmModal from '../components/common/ConfirmModal';

export default function SalesHistoryView({
  setActiveTab,
  onViewInvoice,
  onShowToast
}) {
  const [invoices, setInvoices] = useState([]);
  const [invoiceItems, setInvoiceItems] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRepairing, setIsRepairing] = useState(false);

  // Edit Invoice State
  const [editingInvoice, setEditingInvoice] = useState(null);
  const [editFormData, setEditFormData] = useState({
    customerName: '',
    customerMobile: '',
    customerAddress: '',
    invoiceNumber: '',
    date: '',
    paymentMode: 'Cash',
    items: []
  });

  useEffect(() => {
    loadSalesData();
  }, []);

  const loadSalesData = async () => {
    try {
      setIsLoading(true);
      let loadedInvoices = [];
      let loadedItems = [];

      // 1. Try MongoDB API
      try {
        const res = await invoiceApi.getAll();
        if (res.success && Array.isArray(res.invoices)) {
          loadedInvoices = res.invoices.map(inv => ({
            ...inv,
            id: inv._id || inv.id
          }));
          if (Array.isArray(res.invoiceItems)) {
            loadedItems = res.invoiceItems.map(it => ({ ...it, id: it._id || it.id }));
          }
        }
      } catch (apiErr) {
        console.warn('MongoDB invoice API error, using local fallback:', apiErr.message);
      }

      // 2. Fallback / Merge with local Dexie
      if (loadedInvoices.length === 0) {
        const allInvoices = await db.invoices.toArray();
        const allItems = await db.invoiceItems.toArray();
        loadedInvoices = allInvoices;
        loadedItems = allItems;
      }

      // Auto-heal any invoices where grandTotal is 0 or missing
      const healedInvoices = loadedInvoices.map(inv => {
        let total = Number(inv.grandTotal) || 0;
        if (total === 0) {
          if (inv.items && inv.items.length > 0) {
            total = inv.items.reduce((s, it) => s + (Number(it.amount ?? it.total ?? ((it.quantity || it.qty || 1) * (it.rate || it.sellingPrice || it.price || 0))) || 0), 0);
          } else {
            const relItems = loadedItems.filter(it => it.invoiceId === inv.id || it.invoiceId === inv.invoiceNumber);
            if (relItems.length > 0) {
              total = relItems.reduce((s, it) => s + (Number(it.amount ?? it.total ?? ((it.quantity || it.qty || 1) * (it.rate || it.sellingPrice || it.price || 0))) || 0), 0);
            }
          }
        }

        return {
          ...inv,
          grandTotal: total > 0 ? total : (inv.subtotal || 0)
        };
      });

      healedInvoices.sort((a, b) => new Date(b.createdAt || b.date) - new Date(a.createdAt || a.date));

      setInvoices(healedInvoices);
      setInvoiceItems(loadedItems);
    } catch (err) {
      console.error('Failed to load sales history:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Helper to compute display total for an invoice
  const getInvoiceTotal = (inv) => {
    if (Number(inv.grandTotal) > 0) return Number(inv.grandTotal);
    if (Number(inv.subtotal) > 0) return Number(inv.subtotal);
    if (inv.items && inv.items.length > 0) {
      return inv.items.reduce((sum, it) => sum + (Number(it.amount ?? it.total ?? ((it.quantity || it.qty || 1) * (it.rate || it.sellingPrice || it.price || 0))) || 0), 0);
    }
    const relItems = invoiceItems.filter(it => it.invoiceId === inv.id || it.invoiceId === inv.invoiceNumber);
    if (relItems.length > 0) {
      return relItems.reduce((sum, it) => sum + (Number(it.amount ?? it.total ?? ((it.quantity || it.qty || 1) * (it.rate || it.sellingPrice || it.price || 0))) || 0), 0);
    }
    return 0;
  };

  // Filter invoices
  const filteredInvoices = invoices.filter(inv => {
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      inv.invoiceNumber?.toLowerCase().includes(term) ||
      inv.customerName?.toLowerCase().includes(term) ||
      inv.customerMobile?.includes(term);

    const matchesDate = !dateFilter || inv.date === dateFilter;

    // Check if any line item matches search
    const hasMatchingItem = (inv.items || invoiceItems).some(
      item => (item.invoiceId === inv.id || item.invoiceId === inv.invoiceNumber) &&
      (item.productName?.toLowerCase().includes(term) || item.hsn?.includes(term))
    );

    return (matchesSearch || hasMatchingItem) && matchesDate;
  });

  // Open Edit Invoice Modal
  const handleOpenEditModal = async (inv) => {
    let items = inv.items;
    if (!items || items.length === 0) {
      items = await getInvoiceItems(inv);
    }

    const formattedItems = (items || []).map((it, idx) => ({
      id: it.id || it._id || `item-${idx}`,
      productName: it.productName || it.name || 'PRODUCT',
      quantity: Number(it.quantity ?? it.qty ?? 1) || 1,
      rate: Number(it.rate ?? it.sellingPrice ?? it.price ?? it.wholesaleRate ?? 0) || 0,
      unit: it.unit || 'Pcs'
    }));

    setEditingInvoice(inv);
    setEditFormData({
      customerName: inv.customerName || 'Cash Customer',
      customerMobile: inv.customerMobile || '',
      customerAddress: inv.customerAddress || '',
      invoiceNumber: inv.invoiceNumber || '',
      date: inv.date || new Date().toISOString().split('T')[0],
      paymentMode: inv.paymentMode || 'Cash',
      items: formattedItems
    });
  };

  // Save Edit Invoice
  const handleSaveInvoiceEdit = async (e) => {
    if (e) e.preventDefault();
    if (!editingInvoice) return;

    if (!editFormData.items || editFormData.items.length === 0) {
      alert('Invoice must have at least one product item');
      return;
    }

    try {
      const computedTotal = editFormData.items.reduce((s, it) => s + ((Number(it.rate) || 0) * (Number(it.quantity) || 1)), 0);

      const payload = {
        customerName: editFormData.customerName.trim() || 'Cash Customer',
        customerMobile: editFormData.customerMobile.trim(),
        customerAddress: editFormData.customerAddress.trim(),
        invoiceNumber: editFormData.invoiceNumber.trim() || editingInvoice.invoiceNumber,
        date: editFormData.date,
        paymentMode: editFormData.paymentMode,
        subtotal: computedTotal,
        grandTotal: computedTotal,
        items: editFormData.items.map(it => ({
          productName: (it.productName || '').trim().toUpperCase(),
          quantity: Number(it.quantity) || 1,
          rate: Number(it.rate) || 0,
          total: Number(((Number(it.quantity) || 1) * (Number(it.rate) || 0)).toFixed(2)),
          unit: it.unit || 'Pcs'
        }))
      };

      await updateExistingInvoice(editingInvoice.id || editingInvoice._id || editingInvoice.invoiceNumber, payload);

      if (onShowToast) {
        onShowToast(`Invoice ${payload.invoiceNumber} updated & verified with total ₹${computedTotal}!`, 'success');
      }

      setEditingInvoice(null);
      await loadSalesData();
    } catch (err) {
      console.error('Failed to update invoice:', err);
      alert('Error updating invoice: ' + err.message);
    }
  };

  // Add Item to Edit Modal
  const handleAddEditLineItem = () => {
    setEditFormData(prev => ({
      ...prev,
      items: [
        ...prev.items,
        {
          id: `item-${Date.now()}`,
          productName: 'SAREE',
          quantity: 1,
          rate: 500,
          unit: 'Pcs'
        }
      ]
    }));
  };

  // Delete Item in Edit Modal
  const handleRemoveEditLineItem = (idx) => {
    setEditFormData(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== idx)
    }));
  };

  // Update Item in Edit Modal
  const handleEditLineItemChange = (idx, field, value) => {
    setEditFormData(prev => {
      const updated = [...prev.items];
      updated[idx] = { ...updated[idx], [field]: value };
      return { ...prev, items: updated };
    });
  };

  // Handle One-Click Auto Repair for Old Invoices
  const handleRepairAllInvoices = async () => {
    setIsRepairing(true);
    try {
      const result = await repairAllInvoices();
      if (onShowToast) {
        onShowToast(`Verified & auto-repaired all invoices! Local: ${result.localRepaired}, MongoDB: ${result.backendRepaired}`, 'success');
      }
      await loadSalesData();
    } catch (err) {
      console.error('Repair error:', err);
      alert('Repair failed: ' + err.message);
    } finally {
      setIsRepairing(false);
    }
  };

  // Handle Delete
  const handleDeleteInvoice = async () => {
    if (!deleteConfirmId) return;

    try {
      await deleteInvoice(deleteConfirmId, true); // true restores stock
      if (onShowToast) onShowToast('Invoice deleted and stock restored.', 'success');
      loadSalesData();
    } catch (err) {
      console.error('Failed to delete invoice:', err);
      alert('Delete failed: ' + err.message);
    } finally {
      setDeleteConfirmId(null);
    }
  };

  // Handle View / Print Invoice
  const handleOpenInvoiceModal = async (inv) => {
    let items = inv.items;
    if (!items || items.length === 0) {
      items = await getInvoiceItems(inv);
    }
    onViewInvoice(inv, items || []);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800 }}>Sales & Invoice History</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Complete audit trail of all customer retail billing invoices • Manual editing & 1-click auto-repair
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            onClick={handleRepairAllInvoices}
            disabled={isRepairing}
            className="btn btn-secondary btn-sm"
            title="Auto-repair and recalculate any 0 amount bills"
            style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
          >
            <Wrench size={15} style={{ color: 'var(--gold-600)' }} />
            <span>{isRepairing ? 'Repairing Bills...' : 'Auto-Fix 0 Amount Bills'}</span>
          </button>

          <button
            onClick={() => setActiveTab('new-invoice')}
            className="btn btn-primary"
          >
            <Plus size={18} />
            <span>+ Create New Invoice</span>
          </button>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="card" style={{ padding: '1.25rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', alignItems: 'center' }}>
          {/* Search Box */}
          <div style={{ position: 'relative' }}>
            <Search
              size={18}
              style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}
            />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search invoice #, customer, mobile, product..."
              className="form-input"
              style={{ paddingLeft: '2.5rem' }}
            />
          </div>

          {/* Date Filter */}
          <div style={{ position: 'relative' }}>
            <Calendar
              size={18}
              style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}
            />
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="form-input"
              style={{ paddingLeft: '2.5rem' }}
            />
          </div>

          {/* Clear Filters */}
          {(searchTerm || dateFilter) && (
            <div>
              <button
                onClick={() => { setSearchTerm(''); setDateFilter(''); }}
                className="btn btn-secondary btn-sm"
              >
                <X size={14} />
                <span>Reset Filters</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Invoices Table */}
      <div className="table-container">
        <table className="custom-table">
          <thead>
            <tr>
              <th>Invoice #</th>
              <th>Date</th>
              <th>Customer Name</th>
              <th>Mobile</th>
              <th style={{ textAlign: 'center' }}>Items</th>
              <th>Payment Mode</th>
              <th style={{ textAlign: 'right' }}>Total (₹)</th>
              <th style={{ textAlign: 'center' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredInvoices.length === 0 ? (
              <tr>
                <td colSpan="8" style={{ textAlign: 'center', padding: '3.5rem 1rem', color: 'var(--text-muted)' }}>
                  <History size={36} style={{ margin: '0 auto 0.5rem', opacity: 0.4 }} />
                  <div>No sales invoices found matching your query.</div>
                </td>
              </tr>
            ) : (
              filteredInvoices.map((inv) => {
                const count = (inv.items && inv.items.length > 0)
                  ? inv.items.length
                  : invoiceItems.filter(it => it.invoiceId === inv.id || it.invoiceId === inv.invoiceNumber).length;

                const displayTotal = getInvoiceTotal(inv);

                return (
                  <tr key={inv.id || inv._id || inv.invoiceNumber}>
                    <td style={{ fontWeight: 800, color: 'var(--text-primary)' }}>
                      {inv.invoiceNumber}
                    </td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{inv.date}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {inv.time || (inv.createdAt ? new Date(inv.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }) : '')}
                      </div>
                    </td>
                    <td style={{ fontWeight: 600 }}>
                      {inv.customerName || 'Cash Customer'}
                    </td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                      {inv.customerMobile ? `+91 ${inv.customerMobile}` : '-'}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span className="badge badge-gold">
                        {count || 1} items
                      </span>
                    </td>
                    <td>
                      <span className="badge badge-blue">
                        {inv.paymentMode || 'Cash'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 800, color: 'var(--gold-600)', fontSize: '1rem' }}>
                      {formatCurrency(displayTotal)}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'flex', justifyContent: 'center', gap: '0.35rem' }}>
                        <button
                          onClick={() => handleOpenInvoiceModal(inv)}
                          className="btn btn-secondary btn-sm"
                          style={{ padding: '0.3rem 0.65rem' }}
                          title="View & Print Invoice"
                        >
                          <Eye size={14} />
                          <span>View / Print</span>
                        </button>

                        <button
                          onClick={() => handleOpenEditModal(inv)}
                          className="btn btn-secondary btn-sm"
                          style={{ padding: '0.3rem 0.65rem' }}
                          title="Edit / Correct Invoice"
                        >
                          <Edit2 size={14} />
                          <span>Edit</span>
                        </button>

                        <button
                          onClick={() => setDeleteConfirmId(inv.id || inv._id)}
                          className="btn btn-icon btn-secondary"
                          style={{ padding: '0.3rem', color: 'var(--rose-500)', border: 'none' }}
                          title="Delete Invoice"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Edit / Correct Existing Invoice Modal */}
      {editingInvoice && (
        <div className="modal-backdrop" onClick={() => setEditingInvoice(null)}>
          <div
            className="modal-content modal-lg"
            style={{ maxWidth: '720px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <Edit2 size={20} style={{ color: 'var(--gold-500)' }} />
                <div>
                  <h3 style={{ fontSize: '1.2rem', margin: 0 }}>Edit / Correct Invoice</h3>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    Invoice: <strong>{editingInvoice.invoiceNumber}</strong>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setEditingInvoice(null)}
                className="btn btn-icon btn-secondary"
                style={{ border: 'none' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveInvoiceEdit} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                {/* Invoice Metadata Row */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', background: '#FAF8F5', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid #EBE5DC' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.75rem' }}>Invoice Number</label>
                    <input
                      type="text"
                      required
                      value={editFormData.invoiceNumber}
                      onChange={(e) => setEditFormData({ ...editFormData, invoiceNumber: e.target.value })}
                      className="form-input"
                      style={{ fontWeight: 700 }}
                    />
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.75rem' }}>Date</label>
                    <input
                      type="date"
                      required
                      value={editFormData.date}
                      onChange={(e) => setEditFormData({ ...editFormData, date: e.target.value })}
                      className="form-input"
                    />
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.75rem' }}>Payment Mode</label>
                    <select
                      value={editFormData.paymentMode}
                      onChange={(e) => setEditFormData({ ...editFormData, paymentMode: e.target.value })}
                      className="form-select"
                    >
                      <option value="Cash">Cash</option>
                      <option value="UPI / QR Code">UPI / QR Code</option>
                      <option value="Debit / Credit Card">Debit / Credit Card</option>
                      <option value="Credit / Khata">Credit / Khata</option>
                    </select>
                  </div>
                </div>

                {/* Customer Details Row */}
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: '0.75rem' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.75rem' }}>Customer Name</label>
                    <input
                      type="text"
                      value={editFormData.customerName}
                      onChange={(e) => setEditFormData({ ...editFormData, customerName: e.target.value })}
                      className="form-input"
                    />
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.75rem' }}>Mobile Number</label>
                    <input
                      type="tel"
                      value={editFormData.customerMobile}
                      onChange={(e) => setEditFormData({ ...editFormData, customerMobile: e.target.value })}
                      className="form-input"
                    />
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.75rem' }}>Address</label>
                    <input
                      type="text"
                      value={editFormData.customerAddress}
                      onChange={(e) => setEditFormData({ ...editFormData, customerAddress: e.target.value })}
                      className="form-input"
                    />
                  </div>
                </div>

                {/* Line Items Table */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>Invoice Line Items ({editFormData.items.length})</div>
                    <button
                      type="button"
                      onClick={handleAddEditLineItem}
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
                    >
                      + Add Item
                    </button>
                  </div>

                  <div className="table-container" style={{ border: '1px solid var(--border-medium)' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                      <thead>
                        <tr style={{ background: '#F7F5F0', borderBottom: '1px solid var(--border-medium)' }}>
                          <th style={{ padding: '0.4rem', textAlign: 'left' }}>Product Name</th>
                          <th style={{ padding: '0.4rem', width: '70px', textAlign: 'center' }}>Qty</th>
                          <th style={{ padding: '0.4rem', width: '100px', textAlign: 'right' }}>Rate (₹)</th>
                          <th style={{ padding: '0.4rem', width: '100px', textAlign: 'right' }}>Total (₹)</th>
                          <th style={{ padding: '0.4rem', width: '40px', textAlign: 'center' }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {editFormData.items.map((item, idx) => {
                          const lineTotal = (Number(item.quantity) || 1) * (Number(item.rate) || 0);

                          return (
                            <tr key={idx} style={{ borderBottom: '1px solid #EBE5DC' }}>
                              <td style={{ padding: '0.35rem 0.4rem' }}>
                                <input
                                  type="text"
                                  required
                                  value={item.productName}
                                  onChange={(e) => handleEditLineItemChange(idx, 'productName', e.target.value)}
                                  className="form-input"
                                  style={{ padding: '0.25rem 0.4rem', fontWeight: 600, fontSize: '0.82rem' }}
                                />
                              </td>
                              <td style={{ padding: '0.35rem 0.4rem', textAlign: 'center' }}>
                                <input
                                  type="number"
                                  min="1"
                                  required
                                  value={item.quantity}
                                  onChange={(e) => handleEditLineItemChange(idx, 'quantity', e.target.value)}
                                  className="form-input"
                                  style={{ width: '56px', padding: '0.25rem', textAlign: 'center', fontSize: '0.82rem' }}
                                />
                              </td>
                              <td style={{ padding: '0.35rem 0.4rem', textAlign: 'right' }}>
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  required
                                  value={item.rate}
                                  onChange={(e) => handleEditLineItemChange(idx, 'rate', e.target.value)}
                                  className="form-input"
                                  style={{ width: '85px', padding: '0.25rem', textAlign: 'right', fontWeight: 600, fontSize: '0.82rem' }}
                                />
                              </td>
                              <td style={{ padding: '0.35rem 0.4rem', textAlign: 'right', fontWeight: 700, color: 'var(--gold-600)' }}>
                                ₹{lineTotal.toFixed(2)}
                              </td>
                              <td style={{ padding: '0.35rem 0.4rem', textAlign: 'center' }}>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveEditLineItem(idx)}
                                  className="btn btn-icon btn-secondary"
                                  style={{ padding: '0.2rem', color: 'var(--rose-500)', border: 'none' }}
                                  title="Remove Item"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Grand Total Summary Box */}
                <div style={{ background: 'linear-gradient(180deg, #FCFAF7 0%, #F7F3EC 100%)', padding: '1rem', borderRadius: 'var(--radius-md)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid var(--border-light)' }}>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    Total Line Items: <strong>{editFormData.items.length}</strong>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Updated Grand Total</div>
                    <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--gold-600)' }}>
                      ₹{editFormData.items.reduce((s, it) => s + ((Number(it.rate) || 0) * (Number(it.quantity) || 1)), 0).toFixed(2)}
                    </div>
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  onClick={() => setEditingInvoice(null)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                >
                  <Save size={16} />
                  <span>Save & Apply Updates</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Delete */}
      <ConfirmModal
        isOpen={deleteConfirmId !== null}
        title="Delete Customer Invoice"
        message="Are you sure you want to delete this invoice? The sold items will be returned to inventory stock."
        confirmText="Delete Invoice"
        onConfirm={handleDeleteInvoice}
        onCancel={() => setDeleteConfirmId(null)}
      />
    </div>
  );
}
