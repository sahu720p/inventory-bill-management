import mongoose from 'mongoose';

const settingSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true, index: true },
  value: { type: mongoose.Schema.Types.Mixed, required: true }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

export const Setting = mongoose.models.Setting || mongoose.model('Setting', settingSchema);
