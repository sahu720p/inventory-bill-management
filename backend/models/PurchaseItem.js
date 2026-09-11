import mongoose from 'mongoose';

const purchaseItemSchema = new mongoose.Schema({
  billId: { type: String, required: true, index: true },
  srNo: { type: Number, default: 1 },
  productName: { type: String, required: true, trim: true },
  hsn: { type: String, default: '540752' },
  wholesaleRate: { type: Number, default: 0 },
  quantity: { type: Number, default: 1 },
  unit: { type: String, default: 'Pcs' }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

export const PurchaseItem = mongoose.models.PurchaseItem || mongoose.model('PurchaseItem', purchaseItemSchema);
