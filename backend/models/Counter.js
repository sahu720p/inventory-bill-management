import mongoose from 'mongoose';

const counterSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true, index: true },
  value: { type: Number, default: 0 }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

export const Counter = mongoose.models.Counter || mongoose.model('Counter', counterSchema);
