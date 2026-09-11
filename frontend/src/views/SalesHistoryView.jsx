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
  User
} from 'lucide-react';
import { invoiceApi } from '../services/api';
import { db } from '../db/db';
import { deleteInvoice } from '../services/invoiceService';
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

  useEffect(() => {
    loadSalesData();
  }, []);

  const loadSalesData = async () => {
    try {
      setIsLoading(true);
      // 1. Try MongoDB API
      try {
        const res = await invoiceApi.getAll();
        if (res.success && Array.isArray(res.invoices)) {
          const list = res.invoices.map(inv => ({
            ...inv,
            id: inv._id || inv.id
          }));
          setInvoices(list);
          if (Array.isArray(res.invoiceItems)) {
            setInvoiceItems(res.invoiceItems.map(it => ({ ...it, id: it._id || it.id })));
          }
          return;
        }
      } catch (apiErr) {
        console.warn('MongoDB invoice API error, using local fallback:', apiErr.message);
      }

      // 2. Fallback to local Dexie
      const allInvoices = await db.invoices.toArray();
      const allItems = await db.invoiceItems.toArray();

      allInvoices.sort((a, b) => new Date(b.createdAt || b.date) - new Date(a.createdAt || a.date));

      setInvoices(allInvoices);
      setInvoiceItems(allItems);
    } catch (err) {
      console.error('Failed to load sales history:', err);
    } finally {
      setIsLoading(false);
    }
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
    const hasMatchingItem = invoiceItems.some(
      item => item.invoiceId === inv.id &&
      (item.productName?.toLowerCase().includes(term) || item.hsn?.includes(term))
    );

    return (matchesSearch || hasMatchingItem) && matchesDate;
  });

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
    if (inv.items && inv.items.length > 0) {
      onViewInvoice(inv, inv.items);
      return;
    }
    try {
      const items = await db.invoiceItems.where('invoiceId').equals(inv.id || inv.invoiceNumber).toArray();
      onViewInvoice(inv, items);
    } catch (e) {
      onViewInvoice(inv, []);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800 }}>Sales & Invoice History</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Complete audit trail of all customer retail billing invoices
          </p>
        </div>

        <button
          onClick={() => setActiveTab('new-invoice')}
          className="btn btn-primary"
        >
          <Plus size={18} />
          <span>+ Create New Invoice</span>
        </button>
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

                return (
                  <tr key={inv.id}>
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
                      {formatCurrency(inv.grandTotal)}
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
                          onClick={() => setDeleteConfirmId(inv.id)}
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

      {/* Confirmation Modal for Delete */}
      <ConfirmModal
        isOpen={deleteConfirmId !== null}
        title="Delete Customer Invoice"
        message="Are you sure you want to delete this invoice? The sold items will be returned to inventory stock. Note: The sequential invoice number will not be reused to maintain audit compliance."
        confirmText="Delete Invoice"
        onConfirm={handleDeleteInvoice}
        onCancel={() => setDeleteConfirmId(null)}
      />
    </div>
  );
}
