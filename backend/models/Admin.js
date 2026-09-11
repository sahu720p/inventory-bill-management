import mongoose from 'mongoose';

const adminSchema = new mongoose.Schema({
  username: { type: String, required: true, trim: true },
  email: { type: String, required: true, trim: true },
  passwordHash: { type: String, required: true },
  role: { type: String, default: 'admin' },
  createdAt: { type: Date, default: Date.now }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

export const Admin = mongoose.models.Admin || mongoose.model('Admin', adminSchema);
