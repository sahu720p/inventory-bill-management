import { PurchaseBill } from '../models/PurchaseBill.js';
import { PurchaseItem } from '../models/PurchaseItem.js';
import { Product } from '../models/Product.js';

// Get all purchase bills
export async function getAllPurchaseBills(req, res) {
  try {
    const bills = await PurchaseBill.find().sort({ createdAt: -1 });
    const items = await PurchaseItem.find();
    return res.json({ success: true, bills, items });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

// Get bill details with items
export async function getBillDetails(req, res) {
  try {
    const { billId } = req.params;
    const bill = await PurchaseBill.findOne({ billId });
    if (!bill) {
      return res.status(404).json({ success: false, error: 'Purchase bill not found' });
    }
    const items = await PurchaseItem.find({ billId }).sort({ srNo: 1 });
    return res.json({ success: true, bill, items });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

// Create / Save Purchase Bill and update inventory
export async function createPurchaseBill(req, res) {
  try {
    const {
      billId,
      supplierName = 'Wholesale Supplier',
      imageUrl = '',
      date = new Date().toISOString().split('T')[0],
      items = []
    } = req.body;

    if (!billId) {
      return res.status(400).json({ success: false, error: 'Bill ID / Number is required' });
    }

    if (!items || items.length === 0) {
      return res.status(400).json({ success: false, error: 'At least one item is required' });
    }

    // Calculate total
    const totalAmount = items.reduce((sum, item) => {
      const rate = parseFloat(item.wholesaleRate) || 0;
      const qty = parseFloat(item.quantity) || 1;
      return sum + (rate * qty);
    }, 0);

    // 1. Create or replace Bill Header
    const now = new Date();
    const istDate = date || now.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    const istTime = now.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true });
    const istFull = now.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

    let bill = await PurchaseBill.findOne({ billId });
    if (bill) {
      bill.supplierName = supplierName;
      bill.date = istDate;
      bill.time = istTime;
      bill.createdAtIST = istFull;
      bill.imageUrl = imageUrl || bill.imageUrl;
      bill.totalItems = items.length;
      bill.totalAmount = Number(totalAmount.toFixed(2));
      await bill.save();
      // Remove old items for this billId to replace with fresh ones
      await PurchaseItem.deleteMany({ billId });
    } else {
      bill = await PurchaseBill.create({
        billId,
        supplierName,
        imageUrl,
        date: istDate,
        time: istTime,
        createdAtIST: istFull,
        totalItems: items.length,
        totalAmount: Number(totalAmount.toFixed(2))
      });
    }

    // 2. Insert Purchase Items & Upsert to Product Master
    const savedItems = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const rate = parseFloat(item.wholesaleRate) || 0;
      const qty = parseFloat(item.quantity) || 1;
      const pName = (item.productName || '').trim();
      if (!pName) continue;

      const gst = parseFloat(item.gstPercent) || 5;
      const cost = rate + (rate * (gst / 100));
      const profit = parseFloat(item.profitPercent) || 20;
      const selling = Math.ceil(cost + (cost * (profit / 100)));

      // Save item
      const pItem = await PurchaseItem.create({
        billId,
        srNo: item.srNo || (i + 1),
        productName: pName,
        hsn: item.hsn || '540752',
        wholesaleRate: rate,
        quantity: qty,
        unit: item.unit || 'Pcs'
      });
      savedItems.push(pItem);

      // Check if product exists in Product Master
      const existingProduct = await Product.findOne({
        productName: { $regex: new RegExp(`^${pName.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}$`, 'i') }
      });

      if (existingProduct) {
        existingProduct.hsn = item.hsn || existingProduct.hsn;
        existingProduct.wholesaleRate = rate;
        existingProduct.costAfterGST = Number(cost.toFixed(2));
        existingProduct.sellingPrice = selling;
        existingProduct.stock = (existingProduct.stock || 0) + qty;
        await existingProduct.save();
      } else {
        await Product.create({
          productName: pName,
          hsn: item.hsn || '540752',
          category: item.category || 'General',
          wholesaleRate: rate,
          gstPercent: gst,
          costAfterGST: Number(cost.toFixed(2)),
          profitPercent: profit,
          sellingPrice: selling,
          stock: qty,
          unit: item.unit || 'Pcs',
          dateAdded: date
        });
      }
    }

    return res.status(201).json({
      success: true,
      message: 'Purchase bill and inventory saved to MongoDB successfully',
      bill,
      items: savedItems
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

// Delete Purchase Bill
export async function deletePurchaseBill(req, res) {
  try {
    const { id } = req.params;
    let bill = await PurchaseBill.findById(id);
    if (!bill) {
      bill = await PurchaseBill.findOne({ billId: id });
    }
    if (!bill) {
      return res.status(404).json({ success: false, error: 'Bill not found' });
    }

    await PurchaseItem.deleteMany({ billId: bill.billId });
    await PurchaseBill.findByIdAndDelete(bill._id);

    return res.json({ success: true, message: 'Purchase bill deleted successfully' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

// Update single Purchase Item
export async function updatePurchaseItem(req, res) {
  try {
    const { id } = req.params;
    const { productName, hsn, wholesaleRate, quantity, unit } = req.body;

    const item = await PurchaseItem.findById(id);
    if (!item) {
      return res.status(404).json({ success: false, error: 'Item not found' });
    }

    if (productName) item.productName = productName.trim();
    if (hsn) item.hsn = hsn.trim();
    if (wholesaleRate !== undefined) item.wholesaleRate = Number(wholesaleRate);
    if (quantity !== undefined) item.quantity = Number(quantity);
    if (unit) item.unit = unit.trim();

    await item.save();

    // Update corresponding product pricing
    if (wholesaleRate !== undefined || productName) {
      const pName = item.productName;
      const rate = item.wholesaleRate;
      const cost = rate + (rate * 0.05);
      const selling = Math.ceil(cost + (cost * 0.20));

      const prod = await Product.findOne({
        productName: { $regex: new RegExp(`^${pName.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}$`, 'i') }
      });
      if (prod) {
        prod.wholesaleRate = rate;
        prod.costAfterGST = Number(cost.toFixed(2));
        prod.sellingPrice = selling;
        if (hsn) prod.hsn = hsn;
        await prod.save();
      }
    }

    return res.json({ success: true, item });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

// Delete single Purchase Item
export async function deletePurchaseItem(req, res) {
  try {
    const { id } = req.params;
    const deleted = await PurchaseItem.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ success: false, error: 'Item not found' });
    }
    return res.json({ success: true, message: 'Item deleted' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}
