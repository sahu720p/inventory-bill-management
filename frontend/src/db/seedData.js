import { db } from './db';
import { calculatePricing } from '../services/pricingService';

export const SAMPLE_BILL_ITEMS = [
  { srNo: 1, productName: 'SAREE/LADLI BEHNA/KAYAAN', wholesaleRate: 420.00, quantity: 8, unit: 'Pcs', category: 'Saree' },
  { srNo: 2, productName: 'SAREE/TOP BRAND/KAYAAN', wholesaleRate: 561.00, quantity: 6, unit: 'Pcs', category: 'Saree' },
  { srNo: 3, productName: 'SAREE/UNIQUENESS/KAYAAN', wholesaleRate: 558.00, quantity: 6, unit: 'Pcs', category: 'Saree' },
  { srNo: 4, productName: 'SAREE/RED CHUNARI/KAYAAN', wholesaleRate: 428.00, quantity: 8, unit: 'Pcs', category: 'Saree' },
  { srNo: 5, productName: 'SAREE/REYANSH/KAYAAN', wholesaleRate: 581.00, quantity: 6, unit: 'Pcs', category: 'Saree' },
  { srNo: 6, productName: 'SAREE/CHAMPA/KAYAAN', wholesaleRate: 246.00, quantity: 8, unit: 'Pcs', category: 'Saree' },
  { srNo: 7, productName: 'SAREE/SHINER/KAYAAN', wholesaleRate: 272.00, quantity: 8, unit: 'Pcs', category: 'Saree' },
  { srNo: 8, productName: 'SAREE/KUNJ BIHARI/KAYAAN', wholesaleRate: 394.00, quantity: 8, unit: 'Pcs', category: 'Saree' },
  { srNo: 9, productName: 'SAREE/RAM LEELA/KAYAAN', wholesaleRate: 594.00, quantity: 8, unit: 'Pcs', category: 'Saree' },
  { srNo: 10, productName: 'SAREE/PULPY ORANGE/KAYAAN', wholesaleRate: 439.00, quantity: 8, unit: 'Pcs', category: 'Saree' },
  { srNo: 11, productName: 'SET/VISTARA (VIMAL TOWER)/NONE', wholesaleRate: 295.00, quantity: 9, unit: 'Pcs', category: 'Suit Set' },
  { srNo: 12, productName: 'SET/THAR (VIMAL TOWER)/NONE', wholesaleRate: 165.00, quantity: 12, unit: 'Pcs', category: 'Suit Set' },
  { srNo: 13, productName: 'SET/KANAK/DONEAR', wholesaleRate: 375.00, quantity: 11, unit: 'Pcs', category: 'Suit Set' },
  { srNo: 14, productName: 'SET/NANO (VIMAL TOWER)/NONE', wholesaleRate: 306.00, quantity: 10, unit: 'Pcs', category: 'Suit Set' },
  { srNo: 15, productName: 'SET/SILVER COIN/MAFATLAL', wholesaleRate: 260.00, quantity: 16, unit: 'Pcs', category: 'Suit Set' },
  { srNo: 16, productName: 'COTTON PRINT/KESAR CREP (VANDHNA)/NONE', wholesaleRate: 28.00, quantity: 10, unit: 'Mtr', category: 'Cotton Print' }
];

// Clear all store transactions, products, purchases, and invoices
export async function clearAllStoreData() {
  await db.products.clear();
  await db.purchaseBills.clear();
  await db.purchaseItems.clear();
  await db.invoices.clear();
  await db.invoiceItems.clear();
  await db.counters.put({ name: 'invoice_sequence', value: 0 });
}

// Optional manual seed for testing / demo
export async function seedDemoData(force = false) {
  if (force) {
    await clearAllStoreData();
  } else {
    const productCount = await db.products.count();
    const billCount = await db.purchaseBills.count();
    if (productCount > 0 || billCount > 0) return;
  }

  const today = new Date().toISOString().split('T')[0];

  // 1. Create Sample Purchase Bill
  const billId = 'BILL-2026-0817';
  await db.purchaseBills.add({
    billId,
    supplierName: 'Kayaan Wholesale Fabrics, Surat',
    imageUrl: '/assets/sample_bill.jpeg',
    date: today,
    totalItems: SAMPLE_BILL_ITEMS.length,
    totalAmount: SAMPLE_BILL_ITEMS.reduce((sum, i) => sum + (i.wholesaleRate * i.quantity), 0),
    createdAt: new Date().toISOString()
  });

  for (const item of SAMPLE_BILL_ITEMS) {
    await db.purchaseItems.add({
      billId,
      srNo: item.srNo,
      productName: item.productName,
      wholesaleRate: item.wholesaleRate,
      quantity: item.quantity,
      unit: item.unit,
      createdAt: new Date().toISOString()
    });

    const pricing = calculatePricing(item.wholesaleRate, 5, 20);

    await db.products.add({
      productName: item.productName,
      category: item.category || 'Clothing',
      wholesaleRate: pricing.wholesaleRate,
      gstPercent: pricing.gstPercent,
      costAfterGST: pricing.costAfterGST,
      profitPercent: pricing.profitPercent,
      sellingPrice: pricing.sellingPrice,
      stock: item.quantity,
      dateAdded: today,
      updatedAt: new Date().toISOString()
    });
  }

  // 2. Set sequence counter to 0
  await db.counters.put({ name: 'invoice_sequence', value: 0 });
}
