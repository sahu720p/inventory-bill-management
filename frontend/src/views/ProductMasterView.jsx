import React, { useState, useEffect } from 'react';
import {
  Shirt,
  Search,
  Plus,
  Edit2,
  Trash2,
  Filter,
  Download,
  AlertTriangle,
  CheckCircle,
  X,
  Save,
  Layers,
  ArrowUpDown,
  Sparkles
} from 'lucide-react';
import { productApi } from '../services/api';
import { db } from '../db/db';
import { calculatePricing, formatCurrency } from '../services/pricingService';
import ConfirmModal from '../components/common/ConfirmModal';

export default function ProductMasterView({
  onShowToast
}) {
  const [products, setProducts] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Form State for Add / Edit
  const [formData, setFormData] = useState({
    productName: '',
    hsn: '540752',
    category: 'Saree',
    wholesaleRate: '',
    gstPercent: 5,
    profitPercent: 20,
    stock: 10
  });

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    try {
      setIsLoading(true);
      // 1. Try MongoDB API
      try {
        const res = await productApi.getAll();
        if (res.success && Array.isArray(res.products)) {
          const list = res.products.map(p => ({
            ...p,
            id: p._id || p.id
          }));
          setProducts(list);
          return;
        }
      } catch (apiErr) {
        console.warn('MongoDB API unavailable, using local cache:', apiErr.message);
      }

      // 2. Fallback to local Dexie
      const allProducts = await db.products.toArray();
      allProducts.sort((a, b) => (b.id || 0) - (a.id || 0));
      setProducts(allProducts);
    } catch (err) {
      console.error('Failed to load products:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Live pricing preview for form
  const dynamicPricing = calculatePricing(
    formData.wholesaleRate,
    formData.gstPercent,
    formData.profitPercent
  );

  // Filter products
  const filteredProducts = products.filter(p => {
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      p.productName?.toLowerCase().includes(term) ||
      p.hsn?.includes(term) ||
      String(p.id).includes(term) ||
      p.category?.toLowerCase().includes(term);

    const matchesCategory = categoryFilter === 'ALL' || p.category === categoryFilter;

    const price = p.sellingPrice || 0;
    const matchesMinPrice = !minPrice || price >= parseFloat(minPrice);
    const matchesMaxPrice = !maxPrice || price <= parseFloat(maxPrice);

    return matchesSearch && matchesCategory && matchesMinPrice && matchesMaxPrice;
  });

  // Open Add Modal
  const handleOpenAddModal = () => {
    setEditingProduct(null);
    setFormData({
      productName: '',
      hsn: '540752',
      category: 'Saree',
      wholesaleRate: '',
      gstPercent: 5,
      profitPercent: 20,
      stock: 10
    });
    setIsAddModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (product) => {
    setEditingProduct(product);
    setFormData({
      productName: product.productName,
      hsn: product.hsn,
      category: product.category || 'Clothing',
      wholesaleRate: product.wholesaleRate,
      gstPercent: product.gstPercent || 5,
      profitPercent: product.profitPercent || 20,
      stock: product.stock
    });
    setIsAddModalOpen(true);
  };

  // Save Add / Edit Product
  const handleSaveProduct = async (e) => {
    e.preventDefault();

    if (!formData.productName.trim()) {
      alert('Please enter a product name');
      return;
    }

    try {
      const pricing = calculatePricing(
        formData.wholesaleRate,
        formData.gstPercent,
        formData.profitPercent
      );

      const productPayload = {
        productName: formData.productName.trim().toUpperCase(),
        hsn: formData.hsn.trim(),
        category: formData.category,
        wholesaleRate: pricing.wholesaleRate,
        gstPercent: pricing.gstPercent,
        costAfterGST: pricing.costAfterGST,
        profitPercent: pricing.profitPercent,
        sellingPrice: pricing.sellingPrice,
        stock: editingProduct ? (editingProduct.stock || 10) : 10,
        updatedAt: new Date().toISOString()
      };

      // 1. Try MongoDB API
      try {
        if (editingProduct) {
          await productApi.update(editingProduct.id || editingProduct._id, productPayload);
          if (onShowToast) onShowToast('Product updated in MongoDB!', 'success');
        } else {
          await productApi.create({
            ...productPayload,
            dateAdded: new Date().toISOString().split('T')[0]
          });
          if (onShowToast) onShowToast('New product added to MongoDB!', 'success');
        }
      } catch (apiErr) {
        console.warn('API error, saving to local DB:', apiErr.message);
        if (editingProduct) {
          await db.products.update(editingProduct.id, productPayload);
          if (onShowToast) onShowToast('Product updated locally.', 'success');
        } else {
          await db.products.add({
            ...productPayload,
            dateAdded: new Date().toISOString().split('T')[0]
          });
          if (onShowToast) onShowToast('New product added locally.', 'success');
        }
      }

      setIsAddModalOpen(false);
      loadProducts();
    } catch (err) {
      console.error('Failed to save product:', err);
      alert('Error saving product: ' + err.message);
    }
  };

  // Delete Product
  const handleDeleteProduct = async () => {
    if (!deleteConfirmId) return;

    try {
      try {
        await productApi.delete(deleteConfirmId);
        if (onShowToast) onShowToast('Product deleted from MongoDB.', 'success');
      } catch (apiErr) {
        await db.products.delete(deleteConfirmId);
        if (onShowToast) onShowToast('Product deleted locally.', 'success');
      }
      loadProducts();
    } catch (err) {
      console.error('Failed to delete product:', err);
    } finally {
      setDeleteConfirmId(null);
    }
  };

  // Export to CSV
  const handleExportCSV = () => {
    if (products.length === 0) {
      alert('No products to export');
      return;
    }

    const headers = ['ID', 'Product Name', 'Category', 'Wholesale Rate (Rs)', 'GST (%)', 'Cost After GST (Rs)', 'Profit (%)', 'Selling Price (Rs)', 'Date Added'];
    const rows = products.map(p => [
      p.id,
      `"${p.productName.replace(/"/g, '""')}"`,
      p.category || 'Clothing',
      p.wholesaleRate,
      p.gstPercent || 5,
      p.costAfterGST,
      p.profitPercent || 20,
      p.sellingPrice,
      p.dateAdded || ''
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Product_Master_Om_Sahu_Vastralaya_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800 }}>Product Master & Pricing</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Formula: Wholesale Rate $\rightarrow$ +5% GST $\rightarrow$ Cost After GST $\rightarrow$ +20% Profit $\rightarrow$ Final Selling Price
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            onClick={handleExportCSV}
            className="btn btn-secondary"
            title="Download CSV file"
          >
            <Download size={16} />
            <span>Export CSV</span>
          </button>

          <button
            onClick={handleOpenAddModal}
            className="btn btn-primary"
          >
            <Plus size={16} />
            <span>+ Add Product</span>
          </button>
        </div>
      </div>

      {/* Pricing Formula Highlight Banner */}
      <div
        style={{
          background: 'linear-gradient(90deg, #FAF4E4 0%, #F5ECDA 100%)',
          border: '1px solid rgba(197, 155, 39, 0.35)',
          borderRadius: 'var(--radius-lg)',
          padding: '1rem 1.5rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: '50%',
              background: 'var(--gold-500)',
              color: '#FFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <Sparkles size={20} />
          </div>
          <div>
            <div style={{ fontWeight: 700, color: '#1A1715', fontSize: '0.95rem' }}>
              Standard Retail Pricing Engine Active
            </div>
            <div style={{ fontSize: '0.8125rem', color: '#665E55' }}>
              Selling Price = <strong>Wholesale Rate × 1.05 (GST) × 1.20 (Profit)</strong> (e.g. ₹420 $\rightarrow$ ₹441 $\rightarrow$ <strong>₹529.20</strong>)
            </div>
          </div>
        </div>

        <div className="badge badge-gold" style={{ padding: '0.4rem 0.85rem' }}>
          GST: 5% | Markup: 20%
        </div>
      </div>

      {/* Search & Filter Bar (No stock filter) */}
      <div className="card" style={{ padding: '1.25rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', alignItems: 'center' }}>
          {/* Main Search */}
          <div style={{ position: 'relative' }}>
            <Search
              size={18}
              style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}
            />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search product name or ID..."
              className="form-input"
              style={{ paddingLeft: '2.5rem' }}
            />
          </div>

          {/* Category Filter */}
          <div>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="form-select"
            >
              <option value="ALL">All Categories</option>
              <option value="Saree">Saree</option>
              <option value="Suit Set">Suit Set</option>
              <option value="Cotton Print">Cotton Print</option>
              <option value="Clothing">General Clothing</option>
            </select>
          </div>

          {/* Price Range */}
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <input
              type="number"
              value={minPrice}
              onChange={(e) => setMinPrice(e.target.value)}
              placeholder="Min ₹"
              className="form-input"
              style={{ padding: '0.5rem' }}
            />
            <span style={{ color: 'var(--text-muted)' }}>-</span>
            <input
              type="number"
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
              placeholder="Max ₹"
              className="form-input"
              style={{ padding: '0.5rem' }}
            />
          </div>
        </div>
      </div>

      {/* Products Table (No HSN or Stock column) */}
      <div className="table-container">
        <table className="custom-table">
          <thead>
            <tr>
              <th style={{ width: '60px' }}>ID</th>
              <th>Product Name</th>
              <th>Category</th>
              <th style={{ textAlign: 'right' }}>Wholesale</th>
              <th style={{ textAlign: 'right' }}>5% GST</th>
              <th style={{ textAlign: 'right' }}>Cost + GST</th>
              <th style={{ textAlign: 'right' }}>20% Profit</th>
              <th style={{ textAlign: 'right' }}>Selling Price</th>
              <th style={{ textAlign: 'center' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredProducts.length === 0 ? (
              <tr>
                <td colSpan="9" style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
                  <Shirt size={36} style={{ margin: '0 auto 0.5rem', opacity: 0.4 }} />
                  <div>No products found matching the criteria.</div>
                </td>
              </tr>
            ) : (
              filteredProducts.map((prod) => (
                <tr key={prod.id}>
                  <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 600 }}>
                    #{prod.id}
                  </td>
                  <td>
                    <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                      {prod.productName}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      Added: {prod.dateAdded}
                    </div>
                  </td>
                  <td>
                    <span className="badge badge-gold" style={{ fontSize: '0.72rem' }}>
                      {prod.category || 'Clothing'}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>
                    ₹{prod.wholesaleRate}
                  </td>
                  <td style={{ textAlign: 'right', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                    +₹{((prod.wholesaleRate * (prod.gstPercent || 5)) / 100).toFixed(2)}
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--text-primary)' }}>
                    ₹{prod.costAfterGST}
                  </td>
                  <td style={{ textAlign: 'right', color: 'var(--emerald-800)', fontSize: '0.85rem' }}>
                    +₹{((prod.costAfterGST * (prod.profitPercent || 20)) / 100).toFixed(2)}
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 800, color: 'var(--gold-600)', fontSize: '1rem' }}>
                    ₹{prod.sellingPrice}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '0.35rem' }}>
                      <button
                        onClick={() => handleOpenEditModal(prod)}
                        className="btn btn-icon btn-secondary"
                        style={{ padding: '0.35rem' }}
                        title="Edit Product"
                      >
                        <Edit2 size={15} />
                      </button>

                      <button
                        onClick={() => setDeleteConfirmId(prod.id)}
                        className="btn btn-icon btn-secondary"
                        style={{ padding: '0.35rem', color: 'var(--rose-500)', border: 'none' }}
                        title="Delete Product"
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

      {/* Add / Edit Product Modal */}
      {isAddModalOpen && (
        <div className="modal-backdrop" onClick={() => setIsAddModalOpen(false)}>
          <div
            className="modal-content"
            style={{ maxWidth: '580px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h3 style={{ fontSize: '1.25rem' }}>
                {editingProduct ? 'Edit Product' : '+ Add New Product to Master'}
              </h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="btn btn-icon btn-secondary"
                style={{ border: 'none' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveProduct}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Product Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.productName}
                    onChange={(e) => setFormData({ ...formData, productName: e.target.value })}
                    placeholder="e.g. SAREE/LADLI BEHNA/KAYAAN"
                    className="form-input"
                    style={{ fontWeight: 600 }}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Category</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="form-select"
                  >
                    <option value="Saree">Saree</option>
                    <option value="Suit Set">Suit Set</option>
                    <option value="Cotton Print">Cotton Print</option>
                    <option value="Lehenga">Lehenga</option>
                    <option value="Kurti">Kurti</option>
                    <option value="Clothing">General Clothing</option>
                  </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
                  <div className="form-group">
                    <label className="form-label">Wholesale Rate (₹) *</label>
                    <input
                      type="number"
                      step="0.01"
                      min="1"
                      required
                      placeholder="e.g. 420"
                      value={formData.wholesaleRate}
                      onChange={(e) => setFormData({ ...formData, wholesaleRate: e.target.value })}
                      className="form-input"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">GST (%)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={formData.gstPercent}
                      onChange={(e) => setFormData({ ...formData, gstPercent: e.target.value })}
                      className="form-input"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Profit Markup (%)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={formData.profitPercent}
                      onChange={(e) => setFormData({ ...formData, profitPercent: e.target.value })}
                      className="form-input"
                    />
                  </div>
                </div>

                {/* Real-time Dynamic Pricing Breakdown Box */}
                <div
                  style={{
                    background: 'var(--bg-secondary)',
                    borderRadius: 'var(--radius-md)',
                    padding: '1rem',
                    border: '1px solid var(--border-light)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.35rem',
                    fontSize: '0.85rem'
                  }}
                >
                  <div style={{ fontWeight: 700, color: '#1A1715', marginBottom: '0.25rem' }}>
                    Live Auto-Pricing Calculation (20% Profit):
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#666' }}>
                    <span>Wholesale Base Rate:</span>
                    <span>₹{dynamicPricing.wholesaleRate}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#666' }}>
                    <span>+ GST ({dynamicPricing.gstPercent}%):</span>
                    <span>₹{dynamicPricing.gstAmount} (Cost: ₹{dynamicPricing.costAfterGST})</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#666' }}>
                    <span>+ Profit Markup ({dynamicPricing.profitPercent}%):</span>
                    <span>₹{dynamicPricing.profitAmount}</span>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      borderTop: '1px solid #DCD3C5',
                      paddingTop: '0.5rem',
                      marginTop: '0.25rem',
                      fontWeight: 800,
                      fontSize: '1.05rem',
                      color: 'var(--gold-600)'
                    }}
                  >
                    <span>Final Selling Price:</span>
                    <span>₹{dynamicPricing.sellingPrice}</span>
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                >
                  <Save size={16} />
                  <span>{editingProduct ? 'Save Changes' : 'Add to Product Master'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Delete */}
      <ConfirmModal
        isOpen={deleteConfirmId !== null}
        title="Delete Product"
        message="Are you sure you want to delete this product from Product Master? This will remove it from future billing searches."
        confirmText="Delete Product"
        onConfirm={handleDeleteProduct}
        onCancel={() => setDeleteConfirmId(null)}
      />
    </div>
  );
}
