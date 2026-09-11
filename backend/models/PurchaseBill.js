import mongoose from 'mongoose';

const purchaseBillSchema = new mongoose.Schema({
  billId: { type: String, required: true, unique: true, index: true },
  supplierName: { type: String, default: 'Wholesale Supplier', trim: true },
  imageUrl: { type: String, default: '' },
  date: { type: String, default: () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }) },
  time: { type: String, default: () => new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true }) },
  createdAtIST: { type: String, default: () => new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) },
  totalItems: { type: Number, default: 0 },
  totalAmount: { type: Number, default: 0 }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

export const PurchaseBill = mongoose.models.PurchaseBill || mongoose.model('PurchaseBill', purchaseBillSchema);
