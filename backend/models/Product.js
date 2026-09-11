import mongoose from 'mongoose';

const productSchema = new mongoose.Schema({
  productName: { type: String, required: true, trim: true, index: true },
  hsn: { type: String, default: '540752', trim: true },
  category: { type: String, default: 'General', trim: true },
  wholesaleRate: { type: Number, default: 0 },
  gstPercent: { type: Number, default: 5 },
  costAfterGST: { type: Number, default: 0 },
  profitPercent: { type: Number, default: 20 },
  sellingPrice: { type: Number, required: true, default: 0 },
  stock: { type: Number, default: 0 },
  unit: { type: String, default: 'Pcs' },
  barcode: { type: String, default: '' },
  dateAdded: { type: String, default: () => new Date().toISOString().split('T')[0] }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

export const Product = mongoose.models.Product || mongoose.model('Product', productSchema);
