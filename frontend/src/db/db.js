import Dexie from 'dexie';

export const db = new Dexie('OmSahuVastralayaDB');

// Define database schema
db.version(1).stores({
  admin: '++id, username, email',
  purchaseBills: '++id, billId, date, createdAt',
  purchaseItems: '++id, billId, productName, hsn',
  products: '++id, productName, hsn, category, sellingPrice, stock, dateAdded',
  invoices: '++id, &invoiceNumber, date, customerName, customerMobile, createdAt',
  invoiceItems: '++id, invoiceId, productId',
  counters: '&name',
  settings: '&key'
});

// SHA-256 Hash Helper using Web Crypto API
export async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Initialize Database Defaults & Settings
export async function initDatabase() {
  // Check settings
  const shopName = await db.settings.get('shop_name');
  if (!shopName) {
    await db.settings.bulkPut([
      { key: 'shop_name', value: 'OM SAHU VASTRALAYA' },
      { key: 'shop_subtitle', value: 'Clothing • Fashion • Quality' },
      { key: 'shop_address', value: 'Rahulnagar Market, Sultanpur, Uttar Pradesh – 228171' },
      { key: 'shop_phone', value: '+91 8368429410' },
      { key: 'shop_instagram', value: 'omsahuvastralaya009' },
      { key: 'default_gst_percent', value: 5 },
      { key: 'default_profit_percent', value: 20 },
      { key: 'invoice_prefix', value: 'INV-' }
    ]);
  } else {
    // Ensure updated phone, instagram and profit are active
    await db.settings.put({ key: 'shop_phone', value: '+91 8368429410' });
    await db.settings.put({ key: 'shop_instagram', value: 'omsahuvastralaya009' });
    await db.settings.put({ key: 'default_profit_percent', value: 20 });
  }

  // Check & Update Admin User (Username: omsahuvastralaya.com, Password: sahu720p)
  const defaultHash = await hashPassword('sahu720p');
  const existingAdmin = await db.admin.toCollection().first();
  if (!existingAdmin) {
    await db.admin.add({
      username: 'omsahuvastralaya.com',
      email: 'omsahuvastralaya.com',
      passwordHash: defaultHash,
      createdAt: new Date().toISOString()
    });
  } else {
    await db.admin.update(existingAdmin.id, {
      username: 'omsahuvastralaya.com',
      email: 'omsahuvastralaya.com',
      passwordHash: defaultHash
    });
  }

  // Check Invoice Counter
  const invCounter = await db.counters.get('invoice_sequence');
  if (!invCounter) {
    await db.counters.put({ name: 'invoice_sequence', value: 0 });
  }
}
