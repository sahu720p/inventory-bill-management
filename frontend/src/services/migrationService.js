import { db } from '../db/db';
import { migrationApi } from './api';

export async function migrateDexieToMongoDB() {
  try {
    // 1. Read all data from local Dexie database
    const [
      products,
      purchaseBills,
      purchaseItems,
      invoices,
      invoiceItems,
      settings,
      counters
    ] = await Promise.all([
      db.products ? db.products.toArray() : [],
      db.purchaseBills ? db.purchaseBills.toArray() : [],
      db.purchaseItems ? db.purchaseItems.toArray() : [],
      db.invoices ? db.invoices.toArray() : [],
      db.invoiceItems ? db.invoiceItems.toArray() : [],
      db.settings ? db.settings.toArray() : [],
      db.counters ? db.counters.toArray() : []
    ]);

    const payload = {
      products,
      purchaseBills,
      purchaseItems,
      invoices,
      invoiceItems,
      settings,
      counters
    };

    // 2. Post to MongoDB Backend
    const response = await migrationApi.importData(payload);
    return {
      success: true,
      message: 'Migration completed successfully',
      data: response
    };
  } catch (err) {
    console.error('Migration failed:', err);
    return {
      success: false,
      error: err.message
    };
  }
}
