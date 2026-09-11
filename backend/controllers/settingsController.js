import { Setting } from '../models/Setting.js';

// Seed default settings if empty
export async function seedDefaultSettings() {
  try {
    const defaults = [
      { key: 'shop_name', value: 'OM SAHU VASTRALAYA' },
      { key: 'shop_subtitle', value: 'Clothing • Fashion • Quality' },
      { key: 'shop_address', value: 'Rahulnagar Market, Sultanpur, Uttar Pradesh – 228171' },
      { key: 'shop_phone', value: '+91 8368429410' },
      { key: 'shop_instagram', value: 'omsahuvastralaya009' },
      { key: 'default_gst_percent', value: 5 },
      { key: 'default_profit_percent', value: 20 },
      { key: 'invoice_prefix', value: 'INV-' }
    ];

    for (const item of defaults) {
      const exists = await Setting.findOne({ key: item.key });
      if (!exists) {
        await Setting.create(item);
      }
    }
  } catch (err) {
    console.error('Error seeding settings:', err.message);
  }
}

// Get all settings
export async function getAllSettings(req, res) {
  try {
    const settings = await Setting.find();
    const map = {};
    settings.forEach(s => {
      map[s.key] = s.value;
    });
    return res.json({ success: true, settings, map });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

// Update single setting
export async function updateSetting(req, res) {
  try {
    const { key, value } = req.body;
    if (!key) {
      return res.status(400).json({ success: false, error: 'Setting key is required' });
    }

    const setting = await Setting.findOneAndUpdate(
      { key },
      { key, value },
      { upsert: true, new: true }
    );

    return res.json({ success: true, setting });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

// Bulk update settings
export async function bulkUpdateSettings(req, res) {
  try {
    const { settings } = req.body;
    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({ success: false, error: 'Settings object is required' });
    }

    const updates = [];
    if (Array.isArray(settings)) {
      for (const item of settings) {
        if (item.key) {
          await Setting.findOneAndUpdate({ key: item.key }, { key: item.key, value: item.value }, { upsert: true });
        }
      }
    } else {
      for (const [key, value] of Object.entries(settings)) {
        await Setting.findOneAndUpdate({ key }, { key, value }, { upsert: true });
      }
    }

    const all = await Setting.find();
    const map = {};
    all.forEach(s => { map[s.key] = s.value; });

    return res.json({ success: true, message: 'Settings saved to MongoDB', map });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}
