import mongoose from 'mongoose';

const invoiceItemSchema = new mongoose.Schema({
  invoiceId: { type: String, required: true, index: true },
  productId: { type: String },
  productName: { type: String, required: true },
  hsn: { type: String, default: '540752' },
  quantity: { type: Number, required: true, default: 1 },
  unit: { type: String, default: 'Pcs' },
  rate: { type: Number, required: true, default: 0 },
  gstPercent: { type: Number, default: 5 },
  gstAmount: { type: Number, default: 0 },
  total: { type: Number, required: true, default: 0 }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

export const InvoiceItem = mongoose.models.InvoiceItem || mongoose.model('InvoiceItem', invoiceItemSchema);
