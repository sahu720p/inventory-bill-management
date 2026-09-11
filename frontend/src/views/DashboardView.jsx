import React, { useState, useEffect } from 'react';
import {
  Shirt,
  PackageCheck,
  Receipt,
  TrendingUp,
  AlertTriangle,
  Sparkles,
  Camera,
  PlusCircle,
  ArrowUpRight,
  Eye,
  Printer,
  ChevronRight,
  Layers
} from 'lucide-react';
import { productApi, purchaseApi, invoiceApi } from '../services/api';
import { db } from '../db/db';
import { formatCurrency } from '../services/pricingService';

export default function DashboardView({
  setActiveTab,
  onViewInvoice
}) {
  const [stats, setStats] = useState({
    totalProducts: 0,
    totalPurchases: 0,
    totalInvoices: 0,
    todaySalesAmount: 0,
    totalSalesAmount: 0,
    lowStockCount: 0,
    totalInventoryValue: 0
  });

  const [recentInvoices, setRecentInvoices] = useState([]);
  const [lowStockProducts, setLowStockProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setIsLoading(true);
      const today = new Date().toISOString().split('T')[0];

      let products = [];
      let bills = [];
      let invoices = [];

      // 1. Try MongoDB API
      try {
        const [prodRes, billRes, invRes] = await Promise.all([
          productApi.getAll(),
          purchaseApi.getAllBills(),
          invoiceApi.getAll()
        ]);
        if (prodRes.success) products = prodRes.products.map(p => ({ ...p, id: p._id || p.id }));
        if (billRes.success) bills = billRes.bills.map(b => ({ ...b, id: b._id || b.id }));
        if (invRes.success) invoices = invRes.invoices.map(i => ({ ...i, id: i._id || i.id }));
      } catch (apiErr) {
        console.warn('API error loading dashboard, falling back to local DB:', apiErr.message);
        products = await db.products.toArray();
        bills = await db.purchaseBills.toArray();
        invoices = await db.invoices.toArray();
      }

      const totalProducts = products.length;
      const lowStockList = products.filter(p => (p.stock || 0) <= 5);
      const inventoryVal = products.reduce((sum, p) => sum + ((p.costAfterGST || p.wholesaleRate || 0) * (p.stock || 0)), 0);

      const totalPurchases = bills.length;
      const totalInvoices = invoices.length;
      const totalSalesAmount = invoices.filter(i => i.status !== 'Cancelled').reduce((sum, inv) => sum + (inv.grandTotal || 0), 0);
      const todaySalesAmount = invoices
        .filter(inv => inv.date === today && inv.status !== 'Cancelled')
        .reduce((sum, inv) => sum + (inv.grandTotal || 0), 0);

      const sortedInvoices = [...invoices].sort((a, b) => new Date(b.createdAt || b.date) - new Date(a.createdAt || a.date)).slice(0, 5);

      setStats({
        totalProducts,
        totalPurchases,
        totalInvoices,
        todaySalesAmount,
        totalSalesAmount,
        lowStockCount: lowStockList.length,
        totalInventoryValue: inventoryVal
      });

      setRecentInvoices(sortedInvoices);
      setLowStockProducts(lowStockList.slice(0, 6));
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
      {/* Welcome & Shop Hero Banner */}
      <div
        style={{
          background: 'linear-gradient(135deg, #24201D 0%, #151413 100%)',
          borderRadius: 'var(--radius-xl)',
          padding: '2rem 2.5rem',
          color: '#FFFFFF',
          position: 'relative',
          overflow: 'hidden',
          border: '1px solid rgba(197, 155, 39, 0.3)',
          boxShadow: 'var(--shadow-lg)'
        }}
      >
        {/* Background decorative watermark */}
        <div
          style={{
            position: 'absolute',
            right: '-20px',
            bottom: '-30px',
            opacity: 0.1,
            pointerEvents: 'none'
          }}
        >
          <img src="/assets/osv_logo.svg" alt="" style={{ width: 280, height: 280 }} />
        </div>

        <div style={{ position: 'relative', zIndex: 2, maxWidth: '800px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: 'var(--gold-400)', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.5rem' }}>
            <Sparkles size={16} />
            <span>Welcome to Om Sahu Vastralaya Admin Dashboard</span>
          </div>

          <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '2.1rem', fontWeight: 800, color: '#FFFFFF', letterSpacing: '0.03em' }}>
            Store Inventory, OCR Billing & Sales
          </h1>

          <p style={{ color: '#C8BFB3', fontSize: '0.95rem', marginTop: '0.4rem', lineHeight: 1.5 }}>
            Rahulnagar Market, Sultanpur • Manage incoming wholesale bills, automatic GST & 15% profit pricing, and generate instant customer invoices.
          </p>

          {/* Quick Action Buttons */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.875rem', marginTop: '1.5rem' }}>
            <button
              onClick={() => setActiveTab('scanner')}
              className="btn btn-primary"
            >
              <Camera size={18} />
              <span>Scan Wholesale Bill (OCR)</span>
            </button>

            <button
              onClick={() => setActiveTab('new-invoice')}
              className="btn btn-secondary"
              style={{ background: '#FFFFFF', color: '#1A1715' }}
            >
              <Receipt size={18} style={{ color: 'var(--gold-600)' }} />
              <span>+ Create Customer Invoice</span>
            </button>

            <button
              onClick={() => setActiveTab('products')}
              className="btn btn-dark"
            >
              <Shirt size={18} />
              <span>Product Master</span>
            </button>
          </div>
        </div>
      </div>

      {/* Primary KPI Stats Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '1.25rem'
        }}
      >
        {/* Total Products */}
        <div className="stat-card">
          <div className="stat-icon-wrapper" style={{ background: 'var(--gold-100)', color: 'var(--gold-600)' }}>
            <Shirt size={26} />
          </div>
          <div>
            <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
              TOTAL PRODUCTS
            </div>
            <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.15 }}>
              {stats.totalProducts}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--emerald-800)', marginTop: '0.2rem' }}>
              Active in Product Master
            </div>
          </div>
        </div>

        {/* Total Purchases */}
        <div className="stat-card">
          <div className="stat-icon-wrapper" style={{ background: 'var(--blue-100)', color: 'var(--blue-500)' }}>
            <PackageCheck size={26} />
          </div>
          <div>
            <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
              PURCHASE ENTRIES
            </div>
            <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.15 }}>
              {stats.totalPurchases}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
              Scanned / Added Bills
            </div>
          </div>
        </div>

        {/* Today's Sales */}
        <div className="stat-card">
          <div className="stat-icon-wrapper" style={{ background: 'var(--emerald-100)', color: 'var(--emerald-500)' }}>
            <TrendingUp size={26} />
          </div>
          <div>
            <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
              TODAY'S SALES
            </div>
            <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.15 }}>
              {formatCurrency(stats.todaySalesAmount)}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--emerald-800)', marginTop: '0.2rem' }}>
              From retail billing
            </div>
          </div>
        </div>
      </div>

      {/* Recent Invoices Section */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Recent Sales Invoices</h2>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>Latest customer billing transactions</p>
          </div>
          <button
            onClick={() => setActiveTab('sales')}
            className="btn btn-secondary btn-sm"
          >
            <span>View All</span>
            <ChevronRight size={15} />
          </button>
        </div>

        {recentInvoices.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--text-muted)' }}>
            <Receipt size={36} style={{ margin: '0 auto 0.5rem', opacity: 0.4 }} />
            <div>No invoices created yet.</div>
            <button
              onClick={() => setActiveTab('new-invoice')}
              className="btn btn-primary btn-sm"
              style={{ marginTop: '0.875rem' }}
            >
              + Create First Invoice
            </button>
          </div>
        ) : (
          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Invoice #</th>
                  <th>Customer</th>
                  <th>Date</th>
                  <th style={{ textAlign: 'right' }}>Amount</th>
                  <th style={{ textAlign: 'center' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {recentInvoices.map((inv) => (
                  <tr key={inv.id}>
                    <td style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                      {inv.invoiceNumber}
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{inv.customerName || 'Walk-in Customer'}</div>
                      {inv.customerMobile && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>+91 {inv.customerMobile}</div>
                      )}
                    </td>
                    <td style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                      {inv.date}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--gold-600)' }}>
                      {formatCurrency(inv.grandTotal)}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button
                        onClick={async () => {
                          const items = await db.invoiceItems.where('invoiceId').equals(inv.id).toArray();
                          onViewInvoice(inv, items);
                        }}
                        className="btn btn-secondary btn-sm"
                        style={{ padding: '0.3rem 0.6rem' }}
                        title="View & Print Invoice"
                      >
                        <Eye size={14} />
                        <span>View</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Shop Visual Showcase & Branding Card */}
      <div
        className="card"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '2rem',
          alignItems: 'center',
          background: '#FCFAF7'
        }}
      >
        <div>
          <div className="badge badge-gold" style={{ marginBottom: '0.75rem' }}>
            <Sparkles size={12} />
            <span>Store Branding & Packaging</span>
          </div>
          <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.6rem', color: '#1A1715', marginBottom: '0.5rem' }}>
            Om Sahu Vastralaya
          </h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9375rem', lineHeight: 1.6 }}>
            Serving customers at <strong>Rahulnagar Market, Sultanpur</strong> with premium quality sarees, suit sets, and clothing materials.
          </p>
        </div>

        <div style={{ textAlign: 'center' }}>
          <img
            src="/assets/shopping_bags.jpg"
            alt="Om Sahu Vastralaya Shopping Bags"
            style={{
              width: '100%',
              maxHeight: '260px',
              objectFit: 'cover',
              borderRadius: 'var(--radius-lg)',
              boxShadow: 'var(--shadow-md)',
              border: '1px solid var(--border-light)'
            }}
          />
        </div>
      </div>
    </div>
  );
}
