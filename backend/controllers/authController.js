import { Admin } from '../models/Admin.js';
import crypto from 'crypto';

// Helper to hash password with SHA-256
export function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

// Seed default admin if none exists
export async function seedDefaultAdmin() {
  try {
    const count = await Admin.countDocuments();
    if (count === 0) {
      const defaultHash = hashPassword('sahu720p');
      await Admin.create({
        username: 'omsahuvastralaya.com',
        email: 'omsahuvastralaya.com',
        passwordHash: defaultHash,
        role: 'admin'
      });
      console.log('✅ Default Admin account initialized');
    }
  } catch (err) {
    console.error('Error seeding admin:', err.message);
  }
}

// Login
export async function login(req, res) {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, error: 'Username and password are required' });
    }

    const trimmedUser = username.trim().toLowerCase();
    const inputHash = hashPassword(password);

    // Find admin by username or email
    const admin = await Admin.findOne({
      $or: [
        { username: trimmedUser },
        { email: trimmedUser }
      ]
    });

    if (!admin) {
      return res.status(401).json({ success: false, error: 'Invalid username or password' });
    }

    if (admin.passwordHash !== inputHash) {
      return res.status(401).json({ success: false, error: 'Invalid username or password' });
    }

    const userData = {
      id: admin._id,
      username: admin.username,
      email: admin.email,
      role: admin.role
    };

    return res.json({
      success: true,
      message: 'Login successful',
      user: userData
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

// Update Password
export async function updatePassword(req, res) {
  try {
    const { currentPassword, newPassword, username } = req.body;
    if (!newPassword || newPassword.length < 4) {
      return res.status(400).json({ success: false, error: 'New password must be at least 4 characters long' });
    }

    const query = username ? { username } : {};
    const admin = await Admin.findOne(query);
    if (!admin) {
      return res.status(404).json({ success: false, error: 'Admin user not found' });
    }

    if (currentPassword) {
      const currentHash = hashPassword(currentPassword);
      if (admin.passwordHash !== currentHash) {
        return res.status(401).json({ success: false, error: 'Current password is incorrect' });
      }
    }

    admin.passwordHash = hashPassword(newPassword);
    await admin.save();

    return res.json({ success: true, message: 'Password updated successfully' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

// Get admin profile
export async function getProfile(req, res) {
  try {
    const admin = await Admin.findOne().select('-passwordHash');
    return res.json({ success: true, admin });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}
