import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  TrendingUp,
  Calendar,
  Download,
  Printer,
  Shirt,
  DollarSign,
  Package,
  Layers,
  ArrowUpRight
} from 'lucide-react';
import { invoiceApi, productApi, purchaseApi } from '../services/api';
import { db } from '../db/db';
import { formatCurrency } from '../services/pricingService';

export default function ReportsView({
  onShowToast
}) {
  const [invoices, setInvoices] = useState([]);
  const [invoiceItems, setInvoiceItems] = useState([]);
  const [products, setProducts] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [timeframe, setTimeframe] = useState('ALL'); // 'TODAY', 'THIS_MONTH', 'ALL'
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadReportData();
  }, []);

  const loadReportData = async () => {
    try {
      setIsLoading(true);

      // 1. Try MongoDB API
      try {
        const [invRes, prodRes, billRes] = await Promise.all([
          invoiceApi.getAll(),
          productApi.getAll(),
          purchaseApi.getAllBills()
        ]);

        if (invRes.success) {
          setInvoices(invRes.invoices.map(i => ({ ...i, id: i._id || i.id })));
          if (Array.isArray(invRes.invoiceItems)) {
            setInvoiceItems(invRes.invoiceItems.map(it => ({ ...it, id: it._id || it.id })));
          }
        }
        if (prodRes.success) setProducts(prodRes.products.map(p => ({ ...p, id: p._id || p.id })));
        if (billRes.success) setPurchases(billRes.bills.map(b => ({ ...b, id: b._id || b.id })));
        return;
      } catch (apiErr) {
        console.warn('API error in reports, falling back to local DB:', apiErr.message);
      }

      // 2. Local Fallback
      const inv = await db.invoices.toArray();
      const items = await db.invoiceItems.toArray();
      const prods = await db.products.toArray();
      const bills = await db.purchaseBills.toArray();

      setInvoices(inv);
      setInvoiceItems(items);
      setProducts(prods);
      setPurchases(bills);
    } catch (err) {
      console.error('Failed to load report data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Filter based on timeframe
  const today = new Date().toISOString().split('T')[0];
  const currentMonth = today.substring(0, 7);

  const filteredInvoices = invoices.filter(inv => {
    if (timeframe === 'TODAY') return inv.date === today;
    if (timeframe === 'THIS_MONTH') return inv.date?.startsWith(currentMonth);
    return true;
  });

  const totalSalesRevenue = filteredInvoices.reduce((sum, inv) => sum + (inv.grandTotal || 0), 0);
  const totalTaxCollected = filteredInvoices.reduce((sum, inv) => sum + (inv.gstAmount || 0), 0);

  // Top Selling Products
  const productSalesMap = {};
  filteredInvoices.forEach(inv => {
    const matchedItems = invoiceItems.filter(it => it.invoiceId === inv.id);
    matchedItems.forEach(it => {
      if (!productSalesMap[it.productName]) {
        productSalesMap[it.productName] = { name: it.productName, qty: 0, revenue: 0, hsn: it.hsn };
      }
      productSalesMap[it.productName].qty += it.quantity;
      productSalesMap[it.productName].revenue += it.amount;
    });
  });

  const topSellingList = Object.values(productSalesMap)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 8);

  // Total Wholesale Purchase Cost
  const totalPurchaseValue = purchases.reduce((sum, b) => sum + (b.totalAmount || 0), 0);

  // Estimated Profit
  const estimatedGrossProfit = totalSalesRevenue * 0.15; // approximate 15% margin

  // Export Report to CSV
  const handleExportReport = () => {
    const headers = ['Metric', 'Value'];
    const rows = [
      ['Shop Name', 'Om Sahu Vastralaya'],
      ['Report Period', timeframe],
      ['Total Invoices', filteredInvoices.length],
      ['Total Sales Revenue (INR)', totalSalesRevenue.toFixed(2)],
      ['Total GST (5%) (INR)', totalTaxCollected.toFixed(2)],
      ['Estimated Gross Profit (INR)', estimatedGrossProfit.toFixed(2)],
      ['Total Wholesale Purchase Value (INR)', totalPurchaseValue.toFixed(2)],
      ['Total Products in Master', products.length]
    ];

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => `"${e[0]}","${e[1]}"`)].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `OSV_Sales_Report_${timeframe}_${today}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800 }}>Business Reports & Analytics</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Financial summaries, product sales leaderboard, and revenue insights
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          {/* Timeframe Selector */}
          <div style={{ display: 'flex', background: 'var(--bg-secondary)', padding: '0.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)' }}>
            <button
              onClick={() => setTimeframe('TODAY')}
              className={`btn btn-sm ${timeframe === 'TODAY' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ border: 'none' }}
            >
              Today
            </button>
            <button
              onClick={() => setTimeframe('THIS_MONTH')}
              className={`btn btn-sm ${timeframe === 'THIS_MONTH' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ border: 'none' }}
            >
              This Month
            </button>
            <button
              onClick={() => setTimeframe('ALL')}
              className={`btn btn-sm ${timeframe === 'ALL' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ border: 'none' }}
            >
              All Time
            </button>
          </div>

          <button
            onClick={handleExportReport}
            className="btn btn-secondary"
          >
            <Download size={16} />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Primary Financial Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.25rem' }}>
        <div className="stat-card">
          <div className="stat-icon-wrapper" style={{ background: 'var(--emerald-100)', color: 'var(--emerald-500)' }}>
            <TrendingUp size={24} />
          </div>
          <div>
            <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
              TOTAL SALES REVENUE
            </div>
            <div style={{ fontSize: '1.65rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.15 }}>
              {formatCurrency(totalSalesRevenue)}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--emerald-800)', marginTop: '0.2rem' }}>
              {filteredInvoices.length} Completed Invoices
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon-wrapper" style={{ background: 'var(--gold-100)', color: 'var(--gold-600)' }}>
            <DollarSign size={24} />
          </div>
          <div>
            <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
              ESTIMATED PROFIT
            </div>
            <div style={{ fontSize: '1.65rem', fontWeight: 800, color: 'var(--gold-600)', lineHeight: 1.15 }}>
              {formatCurrency(estimatedGrossProfit)}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
              Based on 15% standard retail markup
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon-wrapper" style={{ background: 'var(--blue-100)', color: 'var(--blue-500)' }}>
            <Package size={24} />
          </div>
          <div>
            <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
              PURCHASE VALUE
            </div>
            <div style={{ fontSize: '1.65rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.15 }}>
              {formatCurrency(totalPurchaseValue)}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
              {purchases.length} Scanned Wholesale Bills
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon-wrapper" style={{ background: 'var(--gold-100)', color: 'var(--gold-600)' }}>
            <Layers size={24} />
          </div>
          <div>
            <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
              GST (5%) COLLECTED
            </div>
            <div style={{ fontSize: '1.65rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.15 }}>
              {formatCurrency(totalTaxCollected)}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
              For tax compliance & filing
            </div>
          </div>
        </div>
      </div>

      {/* Top Selling Products Leaderboard */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Top Selling Products & Fabrics</h2>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>Best performing clothing items ranked by total sales revenue</p>
          </div>
        </div>

        {topSellingList.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
            <Shirt size={36} style={{ margin: '0 auto 0.5rem', opacity: 0.4 }} />
            <div>No sales records found for this period.</div>
          </div>
        ) : (
          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th style={{ width: '60px' }}>Rank</th>
                  <th>Product Name</th>
                  <th>HSN</th>
                  <th style={{ textAlign: 'center' }}>Units Sold</th>
                  <th style={{ textAlign: 'right' }}>Total Revenue Generated</th>
                  <th style={{ textAlign: 'right' }}>Estimated Profit</th>
                </tr>
              </thead>
              <tbody>
                {topSellingList.map((item, idx) => (
                  <tr key={idx}>
                    <td style={{ fontWeight: 800, color: idx === 0 ? 'var(--gold-600)' : 'var(--text-muted)' }}>
                      #{idx + 1}
                    </td>
                    <td style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                      {item.name}
                    </td>
                    <td style={{ color: 'var(--text-secondary)' }}>
                      {item.hsn || '-'}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span className="badge badge-emerald">
                        {item.qty} units
                      </span>
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 800, color: 'var(--gold-600)' }}>
                      {formatCurrency(item.revenue)}
                    </td>
                    <td style={{ textAlign: 'right', color: 'var(--emerald-800)', fontWeight: 600 }}>
                      +{formatCurrency(item.revenue * 0.15)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
