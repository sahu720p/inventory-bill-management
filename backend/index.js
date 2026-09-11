import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

import { connectDB } from './config/db.js';
import { seedDefaultAdmin } from './controllers/authController.js';
import { seedDefaultSettings } from './controllers/settingsController.js';

import authRoutes from './routes/authRoutes.js';
import productRoutes from './routes/productRoutes.js';
import purchaseRoutes from './routes/purchaseRoutes.js';
import invoiceRoutes from './routes/invoiceRoutes.js';
import settingsRoutes from './routes/settingsRoutes.js';
import migrationRoutes from './routes/migrationRoutes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env
dotenv.config({ path: path.join(__dirname, '.env') });
dotenv.config({ path: path.join(__dirname, '../.env') });

const app = express();
const PORT = process.env.PORT || 5050;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/purchases', purchaseRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/migration', migrationRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    server: 'OM Sahu Vastralaya POS Backend',
    database: 'MongoDB',
    time: new Date().toISOString()
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err.stack);
  res.status(500).json({
    success: false,
    error: err.message || 'Internal Server Error'
  });
});

// Start Server & Connect MongoDB
async function startServer() {
  await connectDB();
  await seedDefaultAdmin();
  await seedDefaultSettings();

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 POS Backend Server running on http://localhost:${PORT}`);
    console.log(`📡 API Endpoints available at http://localhost:${PORT}/api`);
  });
}

startServer();
