import mongoose from 'mongoose';

const invoiceSchema = new mongoose.Schema({
  invoiceNumber: { type: String, required: true, unique: true, index: true },
  date: { type: String, default: () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }) },
  time: { type: String, default: () => new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true }) },
  createdAtIST: { type: String, default: () => new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) },
  customerName: { type: String, default: 'Cash Customer', trim: true },
  customerMobile: { type: String, default: '', trim: true },
  paymentMode: { type: String, default: 'Cash', enum: ['Cash', 'UPI', 'Card', 'Credit'] },
  paymentStatus: { type: String, default: 'Paid', enum: ['Paid', 'Pending', 'Partial'] },
  subtotal: { type: Number, default: 0 },
  gstAmount: { type: Number, default: 0 },
  discount: { type: Number, default: 0 },
  roundOff: { type: Number, default: 0 },
  grandTotal: { type: Number, required: true, default: 0 },
  cashTendered: { type: Number, default: 0 },
  changeDue: { type: Number, default: 0 },
  status: { type: String, default: 'Active', enum: ['Active', 'Cancelled'] },
  notes: { type: String, default: '' },
  items: [{
    productId: { type: String },
    productName: { type: String, required: true },
    hsn: { type: String, default: '540752' },
    quantity: { type: Number, required: true, default: 1 },
    unit: { type: String, default: 'Pcs' },
    rate: { type: Number, required: true, default: 0 },
    gstPercent: { type: Number, default: 5 },
    gstAmount: { type: Number, default: 0 },
    total: { type: Number, required: true, default: 0 }
  }]
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

export const Invoice = mongoose.models.Invoice || mongoose.model('Invoice', invoiceSchema);
