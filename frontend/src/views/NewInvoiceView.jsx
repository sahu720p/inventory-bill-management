import React, { useState, useEffect } from 'react';
import {
  Receipt,
  Search,
  Plus,
  Trash2,
  User,
  Phone,
  MapPin,
  Sparkles,
  CheckCircle,
  AlertTriangle,
  ShoppingBag,
  X,
  Tag,
  Layers,
  CreditCard,
  Shirt,
  RotateCcw,
  Edit3,
  RefreshCw
} from 'lucide-react';
import { db } from '../db/db';
import { productApi } from '../services/api';
import { getNextInvoiceNumber, createInvoice, resetInvoiceSequence } from '../services/invoiceService';
import { formatCurrency } from '../services/pricingService';
import confetti from 'canvas-confetti';

// Standard Indian Clothing & Garment Categories Dropdown
const GARMENT_OPTIONS = [
  'Saree',
  'Suit Set',
  'Pant',
  'Shirt',
  'Dhoti',
  'Lungi',
  'Petticoat',
  'Astar (Lining)',
  'Blouse',
  'Cotton Fabric',
  'Kurti',
  'Lehenga',
  'Gamcha / Towel',
  'Other / Custom'
];

export default function NewInvoiceView({
  setActiveTab,
  onInvoiceCreated,
  onShowToast
}) {
  const [nextInvoiceNum, setNextInvoiceNum] = useState('INV-00001');
  const [isManualInvoiceNum, setIsManualInvoiceNum] = useState(false);
  const [customInvoiceNum, setCustomInvoiceNum] = useState('');

  const [customerName, setCustomerName] = useState('');
  const [customerMobile, setCustomerMobile] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [paymentMode, setPaymentMode] = useState('Cash');

  // Catalog Products for optional search
  const [availableProducts, setAvailableProducts] = useState([]);
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  // Unified Product Entry State
  const [productForm, setProductForm] = useState({
    productType: 'Saree',
    productName: '',
    quantity: 1,
    rate: '',
    productId: null
  });

  // Invoice Line Items
  const [invoiceItems, setInvoiceItems] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    loadInvoiceData();
  }, []);

  const loadInvoiceData = async () => {
    try {
      const { formattedNumber } = await getNextInvoiceNumber();
      setNextInvoiceNum(formattedNumber);

      try {
        const res = await productApi.getAll();
        if (res.success && Array.isArray(res.products)) {
          setAvailableProducts(res.products.map(p => ({ ...p, id: p._id || p.id })));
          return;
        }
      } catch (apiErr) {
        console.warn('Failed to load products from API, using local:', apiErr.message);
      }

      const products = await db.products.toArray();
      setAvailableProducts(products);
    } catch (err) {
      console.error('Failed to load invoice setup:', err);
    }
  };

  // Filter products for dropdown
  const filteredSearchProducts = availableProducts.filter(p => {
    const term = (productForm.productName || '').toLowerCase().trim();
    if (!term) return true;
    return (
      p.productName?.toLowerCase().includes(term) ||
      p.category?.toLowerCase().includes(term)
    );
  });

  // Select Product from Master Dropdown
  const handleSelectProduct = (product) => {
    setProductForm({
      productType: product.category || 'Saree',
      productName: product.productName,
      quantity: productForm.quantity || 1,
      rate: product.sellingPrice || product.costAfterGST || 500,
      productId: product.id
    });
    setIsSearchOpen(false);
  };

  // Add Product to Current Bill
  const handleAddProductToBill = (e) => {
    if (e) e.preventDefault();

    // Use typed custom/master name if provided, else use selected dropdown garment type
    const finalName = productForm.productName.trim() || productForm.productType.toUpperCase();
    if (!finalName) {
      alert('Please select a product or enter a product name');
      return;
    }

    const rateNum = parseFloat(productForm.rate);
    if (isNaN(rateNum) || rateNum <= 0) {
      alert('Please enter a valid price / rate (₹)');
      return;
    }

    const qtyNum = Math.max(1, parseInt(productForm.quantity) || 1);

    // Check if same product already in bill
    const existingIndex = invoiceItems.findIndex(i =>
      productForm.productId ? i.productId === productForm.productId : i.productName.toUpperCase() === finalName.toUpperCase()
    );

    if (existingIndex >= 0) {
      const updated = [...invoiceItems];
      updated[existingIndex].quantity += qtyNum;
      if (productForm.rate) updated[existingIndex].rate = rateNum;
      setInvoiceItems(updated);
    } else {
      setInvoiceItems([
        ...invoiceItems,
        {
          productId: productForm.productId || null,
          productName: finalName.toUpperCase(),
          rate: rateNum,
          quantity: qtyNum,
          maxStock: 999,
          unit: productForm.productType === 'Cotton Fabric' ? 'Mtr' : 'Pcs'
        }
      ]);
    }

    // Reset product input form
    setProductForm({
      productType: 'Saree',
      productName: '',
      quantity: 1,
      rate: '',
      productId: null
    });
    setIsSearchOpen(false);

    if (onShowToast) onShowToast('Product added to bill!', 'success');
  };

  // Update item quantity
  const handleQuantityChange = (index, newQty) => {
    const val = Math.max(1, parseInt(newQty) || 1);
    const updated = [...invoiceItems];
    updated[index].quantity = val;
    setInvoiceItems(updated);
  };

  // Update item rate
  const handleRateChange = (index, newRate) => {
    const val = Math.max(0, parseFloat(newRate) || 0);
    const updated = [...invoiceItems];
    updated[index].rate = val;
    setInvoiceItems(updated);
  };

  // Remove item
  const handleRemoveItem = (index) => {
    setInvoiceItems(invoiceItems.filter((_, i) => i !== index));
  };

  // Grand Total Calculation (No GST applied to retail total)
  const grandTotal = Number(invoiceItems.reduce((sum, it) => sum + (it.rate * it.quantity), 0).toFixed(2));

  // Reset entire current bill form
  const handleResetBillForm = () => {
    setCustomerName('');
    setCustomerMobile('');
    setCustomerAddress('');
    setInvoiceItems([]);
    setProductForm({
      productType: 'Saree',
      productName: '',
      quantity: 1,
      rate: '',
      productId: null
    });
    if (isManualInvoiceNum) {
      setCustomInvoiceNum('');
    }
    loadInvoiceData();
    if (onShowToast) onShowToast('New invoice bill form reset successfully.', 'info');
  };

  // Submit & Generate Invoice
  const handleGenerateInvoice = async (e) => {
    if (e) e.preventDefault();

    if (invoiceItems.length === 0) {
      alert('Please add at least one product to the invoice.');
      return;
    }

    const manualNumber = isManualInvoiceNum && customInvoiceNum.trim() ? customInvoiceNum.trim() : '';

    setIsSubmitting(true);
    try {
      const result = await createInvoice({
        customerName: customerName.trim() || 'Cash Customer',
        customerMobile: customerMobile.trim(),
        customerAddress: customerAddress.trim(),
        items: invoiceItems,
        paymentMode,
        customInvoiceNumber: manualNumber
      });

      // Launch Confetti
      try {
        confetti({
          particleCount: 90,
          spread: 75,
          origin: { y: 0.6 }
        });
      } catch (err) {}

      if (onShowToast) {
        onShowToast(`Invoice ${result.invoiceNumber} generated successfully!`, 'success');
      }

      // Fetch or construct created invoice for instant print preview
      const createdInv = (result && result.invoice) ? result.invoice : {
        id: result?.invoiceId || `INV-${Date.now()}`,
        invoiceNumber: result?.invoiceNumber || (manualNumber || nextInvoiceNum),
        customerName: customerName.trim() || 'Cash Customer',
        customerMobile: customerMobile.trim(),
        customerAddress: customerAddress.trim(),
        paymentMode: paymentMode || 'Cash',
        grandTotal: grandTotal,
        subtotal: grandTotal,
        date: new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }),
        time: new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true })
      };

      const createdItems = (result?.invoice?.items && result.invoice.items.length > 0)
        ? result.invoice.items
        : invoiceItems.map(it => ({
            ...it,
            amount: Number((it.rate * it.quantity).toFixed(2)),
            total: Number((it.rate * it.quantity).toFixed(2))
          }));

      if (onInvoiceCreated) {
        onInvoiceCreated(createdInv, createdItems);
      }

      // Reset form
      setCustomerName('');
      setCustomerMobile('');
      setCustomerAddress('');
      setInvoiceItems([]);
      if (isManualInvoiceNum) {
        setCustomInvoiceNum('');
      }
      loadInvoiceData();
    } catch (err) {
      console.error('Invoice creation failed:', err);
      alert('Error creating invoice: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const activeInvoiceDisplay = isManualInvoiceNum
    ? (customInvoiceNum.trim() || 'Manual: TYPE-NUMBER')
    : nextInvoiceNum;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800 }}>Create Customer Invoice</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Fast retail billing studio • Auto & Manual invoice numbering • Reset controls
          </p>
        </div>

        {/* Invoice Number & Action Toolbar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
          {/* Reset Bill Form Button */}
          <button
            type="button"
            onClick={handleResetBillForm}
            className="btn btn-secondary btn-sm"
            title="Clear all fields and reset bill"
            style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
          >
            <RotateCcw size={14} />
            <span>Reset Bill</span>
          </button>

          {/* Auto vs Manual Mode Switch */}
          <div
            style={{
              display: 'flex',
              background: 'var(--bg-secondary)',
              padding: '0.2rem',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-medium)'
            }}
          >
            <button
              type="button"
              onClick={() => setIsManualInvoiceNum(false)}
              className={`btn btn-sm ${!isManualInvoiceNum ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '0.25rem 0.6rem', border: 'none', fontSize: '0.78rem' }}
            >
              Auto #
            </button>
            <button
              type="button"
              onClick={() => {
                setIsManualInvoiceNum(true);
                if (!customInvoiceNum) setCustomInvoiceNum(nextInvoiceNum);
              }}
              className={`btn btn-sm ${isManualInvoiceNum ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '0.25rem 0.6rem', border: 'none', fontSize: '0.78rem' }}
            >
              Manual #
            </button>
          </div>

          {/* Invoice Number Badge / Input */}
          {!isManualInvoiceNum ? (
            <div
              style={{
                background: 'var(--gold-gradient)',
                color: '#1A1715',
                padding: '0.45rem 1rem',
                borderRadius: 'var(--radius-md)',
                fontWeight: 800,
                fontSize: '1rem',
                boxShadow: 'var(--shadow-sm)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem'
              }}
            >
              <Receipt size={18} />
              <span>{nextInvoiceNum}</span>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <input
                type="text"
                value={customInvoiceNum}
                onChange={(e) => setCustomInvoiceNum(e.target.value)}
                placeholder="e.g. INV-001 or BILL-50"
                className="form-input"
                style={{
                  width: '160px',
                  fontWeight: 800,
                  fontSize: '0.95rem',
                  padding: '0.4rem 0.65rem',
                  borderColor: 'var(--gold-500)',
                  color: 'var(--gold-700)'
                }}
              />
            </div>
          )}
        </div>
      </div>

      {/* SECTION 1: Customer Details (Top Horizontal Bar: Name -> Mobile -> Address -> Payment Mode) */}
      <div className="card" style={{ padding: '1.25rem 1.5rem', background: '#FFFFFF' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.85rem' }}>
          <User size={18} style={{ color: 'var(--gold-500)' }} />
          <h2 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0 }}>1. Customer Details & Payment</h2>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '1rem',
            alignItems: 'center'
          }}
        >
          {/* 1. Customer Name */}
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label" style={{ fontSize: '0.78rem' }}>Customer Name</label>
            <div style={{ position: 'relative' }}>
              <User size={15} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Customer Name"
                className="form-input"
                style={{ paddingLeft: '2.1rem' }}
              />
            </div>
          </div>

          {/* 2. Customer Mobile */}
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label" style={{ fontSize: '0.78rem' }}>Customer Mobile</label>
            <div style={{ position: 'relative' }}>
              <Phone size={15} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="tel"
                maxLength="10"
                value={customerMobile}
                onChange={(e) => setCustomerMobile(e.target.value.replace(/\D/g, ''))}
                placeholder="XXXXXXXXXX"
                className="form-input"
                style={{ paddingLeft: '2.1rem' }}
              />
            </div>
          </div>

          {/* 3. Customer Address (Before Payment Mode) */}
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label" style={{ fontSize: '0.78rem' }}>Customer Address</label>
            <div style={{ position: 'relative' }}>
              <MapPin size={15} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                value={customerAddress}
                onChange={(e) => setCustomerAddress(e.target.value)}
                placeholder="Customer Address"
                className="form-input"
                style={{ paddingLeft: '2.1rem' }}
              />
            </div>
          </div>

          {/* 4. Payment Mode (Last) */}
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label" style={{ fontSize: '0.78rem' }}>Payment Mode</label>
            <select
              value={paymentMode}
              onChange={(e) => setPaymentMode(e.target.value)}
              className="form-select"
              style={{ fontWeight: 600 }}
            >
              <option value="Cash">💵 Cash</option>
              <option value="UPI / QR Code">📱 UPI / QR Code (PhonePe, GPay, Paytm)</option>
              <option value="Debit / Credit Card">💳 Debit / Credit Card</option>
              <option value="Credit / Khata">📒 Credit (Khata / Udhar)</option>
            </select>
          </div>
        </div>
      </div>

      {/* SECTIONS 2 & 3: Balanced 2-Column Studio (Add Products on Left, Live Bill on Right) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(420px, 1.1fr) minmax(400px, 1fr)',
          gap: '1.25rem',
          alignItems: 'start'
        }}
      >
        {/* LEFT COLUMN: Section 2 - Add Products */}
        <div className="card" style={{ padding: '1.5rem', background: '#FFFFFF', position: 'relative' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <ShoppingBag size={20} style={{ color: 'var(--gold-500)' }} />
              <span>2. Add Products to Bill</span>
            </h2>
          </div>

          <form onSubmit={handleAddProductToBill} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
            {/* Garment / Product Type Dropdown Option */}
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontSize: '0.825rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                Product / Garment Type *
              </label>
              <select
                value={productForm.productType}
                onChange={(e) => setProductForm({ ...productForm, productType: e.target.value })}
                className="form-select"
                style={{ fontWeight: 600, fontSize: '0.95rem', padding: '0.65rem 0.85rem' }}
              >
                {GARMENT_OPTIONS.map(opt => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>

            {/* Product Name / Search Bar with Autocomplete (Independent) */}
            <div className="form-group" style={{ margin: 0, position: 'relative' }}>
              <label className="form-label" style={{ fontSize: '0.825rem', fontWeight: 600 }}>
                Product Name
              </label>
              <div style={{ position: 'relative' }}>
                <Search size={18} style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  value={productForm.productName}
                  onChange={(e) => {
                    setProductForm({ ...productForm, productName: e.target.value, productId: null });
                    setIsSearchOpen(true);
                  }}
                  onFocus={() => {
                    if (availableProducts.length > 0) setIsSearchOpen(true);
                  }}
                  placeholder="Product Name"
                  className="form-input"
                  style={{ paddingLeft: '2.4rem', paddingRight: '2rem', fontWeight: 600, fontSize: '0.95rem' }}
                />

                {productForm.productName && (
                  <button
                    type="button"
                    onClick={() => {
                      setProductForm({ ...productForm, productName: '', rate: '', productId: null });
                      setIsSearchOpen(false);
                    }}
                    style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
                  >
                    <X size={16} />
                  </button>
                )}
              </div>

              {/* Instant Search Suggestions Dropdown */}
              {isSearchOpen && productForm.productName.trim().length > 0 && filteredSearchProducts.length > 0 && (
                <div
                  style={{
                    position: 'absolute',
                    top: '105%',
                    left: 0,
                    right: 0,
                    background: '#FFFFFF',
                    border: '1px solid var(--border-medium)',
                    borderRadius: 'var(--radius-md)',
                    boxShadow: 'var(--shadow-lg)',
                    maxHeight: '230px',
                    overflowY: 'auto',
                    zIndex: 30
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0.85rem', background: '#FAF8F5', borderBottom: '1px solid var(--border-light)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    <span>Catalog Matches ({filteredSearchProducts.length})</span>
                    <button type="button" onClick={() => setIsSearchOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontWeight: 600 }}>Close</button>
                  </div>

                  {filteredSearchProducts.slice(0, 10).map((prod) => (
                    <div
                      key={prod.id}
                      onClick={() => handleSelectProduct(prod)}
                      style={{
                        padding: '0.65rem 0.85rem',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        cursor: 'pointer',
                        borderBottom: '1px solid var(--border-light)',
                        transition: 'background 0.15s ease'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = '#FAF8F5'}
                      onMouseLeave={(e) => e.currentTarget.style.background = '#FFFFFF'}
                    >
                      <div>
                        <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.875rem' }}>
                          {prod.productName}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {prod.category || 'Clothing'}
                        </div>
                      </div>

                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontWeight: 800, color: 'var(--gold-600)', fontSize: '0.95rem' }}>
                          ₹{prod.sellingPrice}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--emerald-800)', fontWeight: 600 }}>
                          Click to auto-fill
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Quantity and Price Inputs (Spacious Row) */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontSize: '0.825rem', fontWeight: 600 }}>
                  Quantity ({productForm.productType === 'Cotton Fabric' ? 'Mtr' : 'Pcs'}) *
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={productForm.quantity}
                  onChange={(e) => setProductForm({ ...productForm, quantity: e.target.value })}
                  className="form-input"
                  style={{ fontWeight: 700, fontSize: '1.05rem', textAlign: 'center' }}
                />
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontSize: '0.825rem', fontWeight: 600 }}>
                  Price / Rate (₹) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="1"
                  required
                  placeholder="Price / Rate"
                  value={productForm.rate}
                  onChange={(e) => setProductForm({ ...productForm, rate: e.target.value })}
                  className="form-input"
                  style={{ fontWeight: 800, fontSize: '1.05rem', color: 'var(--gold-600)' }}
                />
              </div>
            </div>

            {/* Add to Bill Button */}
            <button
              type="submit"
              className="btn btn-primary btn-lg"
              style={{
                width: '100%',
                padding: '0.85rem',
                fontSize: '1rem',
                fontWeight: 700,
                marginTop: '0.25rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem'
              }}
            >
              <Plus size={18} />
              <span>+ Add to Current Bill</span>
            </button>
          </form>
        </div>

        {/* RIGHT COLUMN: Section 3 - Live Bill Studio & Modifier */}
        <div className="card" style={{ padding: '1.5rem', background: '#FFFFFF', position: 'sticky', top: '80px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--border-light)', paddingBottom: '0.75rem' }}>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                3. Live Current Bill ({invoiceItems.length} items)
              </h2>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                {customerName || 'Cash Customer'} • {paymentMode}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              {invoiceItems.length > 0 && (
                <button
                  type="button"
                  onClick={() => setInvoiceItems([])}
                  className="btn btn-sm btn-secondary"
                  style={{
                    fontSize: '0.75rem',
                    padding: '0.25rem 0.6rem',
                    color: 'var(--rose-700)',
                    background: '#FFF1F2',
                    border: '1px solid #FFE4E6',
                    borderRadius: 'var(--radius-md)',
                    cursor: 'pointer'
                  }}
                  title="Clear all items from bill"
                >
                  <Trash2 size={13} />
                  <span>Clear All</span>
                </button>
              )}
              <div className="badge badge-gold" style={{ fontSize: '0.85rem', fontWeight: 800 }}>
                {nextInvoiceNum}
              </div>
            </div>
          </div>

          {invoiceItems.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3.5rem 1.5rem', color: 'var(--text-muted)', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', marginBottom: '1.25rem' }}>
              <Receipt size={42} style={{ margin: '0 auto 0.65rem', opacity: 0.4 }} />
              <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)' }}>No products in bill yet</div>
              <div style={{ fontSize: '0.825rem', marginTop: '0.35rem', color: 'var(--text-secondary)' }}>
                Select a garment on the left, enter rate & pcs, and click Add to Bill.
              </div>
            </div>
          ) : (
            <div className="table-container" style={{ maxHeight: '360px', overflowY: 'auto', marginBottom: '1.25rem' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
                <thead>
                  <tr style={{ background: '#F7F5F0', borderBottom: '1.5px solid var(--border-medium)', color: 'var(--text-secondary)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    <th style={{ padding: '0.6rem 0.35rem', textAlign: 'center', width: '28px' }}>#</th>
                    <th style={{ padding: '0.6rem 0.5rem', textAlign: 'left' }}>Product</th>
                    <th style={{ padding: '0.6rem 0.35rem', textAlign: 'center', width: '64px' }}>Pcs</th>
                    <th style={{ padding: '0.6rem 0.35rem', textAlign: 'right', width: '76px' }}>Rate (₹)</th>
                    <th style={{ padding: '0.6rem 0.35rem', textAlign: 'right', width: '76px' }}>Total (₹)</th>
                    <th style={{ padding: '0.6rem 0.35rem', textAlign: 'center', width: '38px' }}>Del</th>
                  </tr>
                </thead>
                <tbody>
                  {invoiceItems.map((item, index) => {
                    const lineTotal = (item.quantity || 1) * (item.rate || 0);

                    return (
                      <tr key={index} style={{ borderBottom: '1px solid var(--border-light)', transition: 'background-color 0.15s ease' }}>
                        <td style={{ padding: '0.5rem 0.35rem', textAlign: 'center', fontWeight: 600, color: 'var(--text-muted)' }}>
                          {index + 1}
                        </td>
                        <td style={{ padding: '0.5rem 0.5rem' }}>
                          <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.85rem' }}>
                            {item.productName}
                          </div>
                        </td>

                        {/* Quantity / Pcs */}
                        <td style={{ padding: '0.5rem 0.35rem', textAlign: 'center' }}>
                          <input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) => handleQuantityChange(index, e.target.value)}
                            className="form-input"
                            style={{ width: '52px', padding: '0.25rem 0.2rem', textAlign: 'center', fontWeight: 700, fontSize: '0.85rem' }}
                          />
                        </td>

                        {/* Price / Rate */}
                        <td style={{ padding: '0.5rem 0.35rem', textAlign: 'right' }}>
                          <input
                            type="number"
                            step="0.01"
                            value={item.rate}
                            onChange={(e) => handleRateChange(index, e.target.value)}
                            className="form-input"
                            style={{ width: '68px', padding: '0.25rem 0.3rem', textAlign: 'right', fontWeight: 600, fontSize: '0.85rem' }}
                          />
                        </td>

                        {/* Line Total */}
                        <td style={{ padding: '0.5rem 0.35rem', textAlign: 'right', fontWeight: 800, color: 'var(--gold-600)', fontSize: '0.9rem' }}>
                          ₹{lineTotal.toFixed(2)}
                        </td>

                        {/* Delete Row */}
                        <td style={{ padding: '0.5rem 0.35rem', textAlign: 'center' }}>
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(index)}
                            style={{
                              padding: '0.3rem',
                              color: '#DC2626',
                              background: '#FEE2E2',
                              border: '1px solid #FECACA',
                              borderRadius: '6px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: 'pointer',
                              transition: 'all 0.15s ease'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = '#DC2626';
                              e.currentTarget.style.color = '#FFFFFF';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = '#FEE2E2';
                              e.currentTarget.style.color = '#DC2626';
                            }}
                            title="Remove item from bill"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Grand Total & Generate Invoice Box */}
          <div
            style={{
              background: 'linear-gradient(180deg, #FCFAF7 0%, #F7F3EC 100%)',
              borderRadius: 'var(--radius-lg)',
              padding: '1.25rem',
              border: '1px solid var(--border-light)',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>
                  Total Amount to Pay
                </div>
                <div style={{ fontSize: '2.1rem', fontWeight: 800, color: 'var(--gold-600)', lineHeight: 1.1 }}>
                  {formatCurrency(grandTotal)}
                </div>
              </div>

              <div style={{ textAlign: 'right', fontSize: '0.825rem', color: 'var(--text-muted)' }}>
                <strong>{invoiceItems.length}</strong> Products • <strong>{invoiceItems.reduce((s, i) => s + (parseInt(i.quantity) || 0), 0)}</strong> Total Pcs
              </div>
            </div>

            <button
              onClick={handleGenerateInvoice}
              disabled={isSubmitting || invoiceItems.length === 0}
              className="btn btn-primary btn-lg"
              style={{
                width: '100%',
                padding: '0.95rem',
                fontSize: '1.05rem',
                fontWeight: 800,
                boxShadow: 'var(--shadow-md)'
              }}
            >
              <Sparkles size={20} />
              <span>{isSubmitting ? 'Generating Invoice...' : 'Generate & Print Invoice'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
