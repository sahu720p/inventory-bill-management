import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/omsahuvastralaya';

async function resetAllData() {
  try {
    await mongoose.connect(uri);
    console.log('Connected to MongoDB for clean reset...');

    const db = mongoose.connection.db;

    // Drop or clear collections
    await db.collection('invoices').deleteMany({});
    await db.collection('invoiceitems').deleteMany({});
    await db.collection('purchasebills').deleteMany({});
    await db.collection('purchaseitems').deleteMany({});
    await db.collection('products').deleteMany({});

    // Reset sequence counter to 0
    await db.collection('counters').updateOne(
      { name: 'invoice_sequence' },
      { $set: { name: 'invoice_sequence', value: 0 } },
      { upsert: true }
    );

    console.log('✅ Invoices cleared.');
    console.log('✅ Invoice items cleared.');
    console.log('✅ Purchase bills & items cleared.');
    console.log('✅ Products cleared.');
    console.log('✅ Invoice counter reset to 0 (Next invoice will be INV-2026-0001).');
    
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('Reset error:', err);
    process.exit(1);
  }
}

resetAllData();
