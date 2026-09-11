import { Product } from '../models/Product.js';
import { PurchaseBill } from '../models/PurchaseBill.js';
import { PurchaseItem } from '../models/PurchaseItem.js';
import { Invoice } from '../models/Invoice.js';
import { InvoiceItem } from '../models/InvoiceItem.js';
import { Setting } from '../models/Setting.js';
import { Counter } from '../models/Counter.js';
import { Admin } from '../models/Admin.js';
import { isDbConnected } from '../config/db.js';

// Health and DB Stats
export async function getHealthAndStats(req, res) {
  try {
    const connected = isDbConnected();
    if (!connected) {
      return res.json({
        success: false,
        connected: false,
        message: 'MongoDB is currently disconnected. Please check MONGODB_URI or start your MongoDB service.'
      });
    }

    const [
      productsCount,
      purchaseBillsCount,
      invoicesCount,
      activeInvoices
    ] = await Promise.all([
      Product.countDocuments(),
      PurchaseBill.countDocuments(),
      Invoice.countDocuments(),
      Invoice.find({ status: 'Active' })
    ]);

    const totalRevenue = activeInvoices.reduce((sum, inv) => sum + (inv.grandTotal || 0), 0);

    return res.json({
      success: true,
      connected: true,
      stats: {
        products: productsCount,
        purchaseBills: purchaseBillsCount,
        invoices: invoicesCount,
        totalRevenue: Number(totalRevenue.toFixed(2))
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, connected: false, error: err.message });
  }
}

// Import all data from browser IndexedDB to MongoDB
export async function importFromDexie(req, res) {
  try {
    const { products, purchaseBills, purchaseItems, invoices, invoiceItems, settings, counters } = req.body;
    let counts = {
      products: 0,
      purchaseBills: 0,
      purchaseItems: 0,
      invoices: 0,
      settings: 0,
      counters: 0
    };

    // 1. Products
    if (Array.isArray(products) && products.length > 0) {
      for (const p of products) {
        const pName = (p.productName || '').trim();
        if (!pName) continue;
        await Product.findOneAndUpdate(
          { productName: { $regex: new RegExp(`^${pName.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}$`, 'i') } },
          {
            productName: pName,
            hsn: p.hsn || '540752',
            category: p.category || 'General',
            wholesaleRate: Number(p.wholesaleRate) || 0,
            gstPercent: Number(p.gstPercent) || 5,
            costAfterGST: Number(p.costAfterGST) || 0,
            profitPercent: Number(p.profitPercent) || 20,
            sellingPrice: Number(p.sellingPrice) || 0,
            stock: Number(p.stock) || 0,
            unit: p.unit || 'Pcs',
            barcode: p.barcode || '',
            dateAdded: p.dateAdded || new Date().toISOString().split('T')[0]
          },
          { upsert: true }
        );
        counts.products++;
      }
    }

    // 2. Purchase Bills
    if (Array.isArray(purchaseBills) && purchaseBills.length > 0) {
      for (const b of purchaseBills) {
        if (!b.billId) continue;
        await PurchaseBill.findOneAndUpdate(
          { billId: b.billId },
          {
            billId: b.billId,
            supplierName: b.supplierName || 'Wholesale Supplier',
            imageUrl: b.imageUrl || '',
            date: b.date || new Date().toISOString().split('T')[0],
            totalItems: Number(b.totalItems) || 0,
            totalAmount: Number(b.totalAmount) || 0
          },
          { upsert: true }
        );
        counts.purchaseBills++;
      }
    }

    // 3. Purchase Items
    if (Array.isArray(purchaseItems) && purchaseItems.length > 0) {
      for (const pi of purchaseItems) {
        if (!pi.billId || !pi.productName) continue;
        await PurchaseItem.create({
          billId: pi.billId,
          srNo: Number(pi.srNo) || 1,
          productName: pi.productName.trim(),
          hsn: pi.hsn || '540752',
          wholesaleRate: Number(pi.wholesaleRate) || 0,
          quantity: Number(pi.quantity) || 1,
          unit: pi.unit || 'Pcs'
        });
        counts.purchaseItems++;
      }
    }

    // 4. Invoices
    if (Array.isArray(invoices) && invoices.length > 0) {
      for (const inv of invoices) {
        if (!inv.invoiceNumber) continue;
        // Check if items array is attached or if we should fetch from invoiceItems
        let items = inv.items;
        if (!items && Array.isArray(invoiceItems)) {
          items = invoiceItems.filter(ii => ii.invoiceId === inv.id || ii.invoiceId === inv.invoiceNumber);
        }

        await Invoice.findOneAndUpdate(
          { invoiceNumber: inv.invoiceNumber },
          {
            invoiceNumber: inv.invoiceNumber,
            date: inv.date || new Date().toISOString().split('T')[0],
            customerName: inv.customerName || 'Cash Customer',
            customerMobile: inv.customerMobile || '',
            paymentMode: inv.paymentMode || 'Cash',
            paymentStatus: inv.paymentStatus || 'Paid',
            subtotal: Number(inv.subtotal) || 0,
            gstAmount: Number(inv.gstAmount) || 0,
            discount: Number(inv.discount) || 0,
            roundOff: Number(inv.roundOff) || 0,
            grandTotal: Number(inv.grandTotal) || 0,
            cashTendered: Number(inv.cashTendered) || 0,
            changeDue: Number(inv.changeDue) || 0,
            status: inv.status || 'Active',
            notes: inv.notes || '',
            items: (items || []).map(it => ({
              productId: it.productId || '',
              productName: it.productName || '',
              hsn: it.hsn || '540752',
              quantity: Number(it.quantity || it.qty) || 1,
              unit: it.unit || 'Pcs',
              rate: Number(it.rate || it.sellingPrice || it.price) || 0,
              gstPercent: Number(it.gstPercent) || 5,
              gstAmount: Number(it.gstAmount) || 0,
              total: Number(it.total) || 0
            }))
          },
          { upsert: true }
        );
        counts.invoices++;
      }
    }

    // 5. Settings
    if (Array.isArray(settings) && settings.length > 0) {
      for (const s of settings) {
        if (s.key) {
          await Setting.findOneAndUpdate({ key: s.key }, { key: s.key, value: s.value }, { upsert: true });
          counts.settings++;
        }
      }
    }

    // 6. Counters
    if (Array.isArray(counters) && counters.length > 0) {
      for (const c of counters) {
        if (c.name) {
          await Counter.findOneAndUpdate({ name: c.name }, { name: c.name, value: Number(c.value) || 0 }, { upsert: true });
          counts.counters++;
        }
      }
    }

    return res.json({
      success: true,
      message: 'Successfully migrated data from browser IndexedDB to MongoDB!',
      counts
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

// Full Export for Backup
export async function exportAllData(req, res) {
  try {
    const [products, purchaseBills, purchaseItems, invoices, invoiceItems, settings, counters] = await Promise.all([
      Product.find(),
      PurchaseBill.find(),
      PurchaseItem.find(),
      Invoice.find(),
      InvoiceItem.find(),
      Setting.find(),
      Counter.find()
    ]);

    return res.json({
      success: true,
      timestamp: new Date().toISOString(),
      database: 'MongoDB',
      data: {
        products,
        purchaseBills,
        purchaseItems,
        invoices,
        invoiceItems,
        settings,
        counters
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

// Clear All Store Data & Reset Sequence Counter in MongoDB
export async function clearAllStoreData(req, res) {
  try {
    await Promise.all([
      Product.deleteMany({}),
      PurchaseBill.deleteMany({}),
      PurchaseItem.deleteMany({}),
      Invoice.deleteMany({}),
      InvoiceItem.deleteMany({})
    ]);

    await Counter.findOneAndUpdate(
      { name: 'invoice_sequence' },
      { name: 'invoice_sequence', value: 0 },
      { upsert: true }
    );

    return res.json({
      success: true,
      message: 'All store data cleared from MongoDB and invoice counter reset to 0'
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}
