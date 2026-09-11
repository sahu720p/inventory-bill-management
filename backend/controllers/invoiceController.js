import { Invoice } from '../models/Invoice.js';
import { InvoiceItem } from '../models/InvoiceItem.js';
import { Product } from '../models/Product.js';
import { Counter } from '../models/Counter.js';

// Get next sequential invoice number
export async function getNextInvoiceNumber(req, res) {
  try {
    const counter = await Counter.findOne({ name: 'invoice_sequence' });
    const currentSeq = counter ? counter.value : 0;
    const nextSeq = currentSeq + 1;
    const year = new Date().getFullYear();
    const invoiceNumber = `INV-${year}-${String(nextSeq).padStart(4, '0')}`;
    return res.json({ success: true, nextSeq, invoiceNumber });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

// Get all invoices
export async function getAllInvoices(req, res) {
  try {
    const { status, dateFrom, dateTo, search } = req.query;
    let filter = {};

    if (status && status !== 'All') {
      filter.status = status;
    }

    if (dateFrom && dateTo) {
      filter.date = { $gte: dateFrom, $lte: dateTo };
    } else if (dateFrom) {
      filter.date = { $gte: dateFrom };
    } else if (dateTo) {
      filter.date = { $lte: dateTo };
    }

    if (search) {
      filter.$or = [
        { invoiceNumber: { $regex: search, $options: 'i' } },
        { customerName: { $regex: search, $options: 'i' } },
        { customerMobile: { $regex: search, $options: 'i' } }
      ];
    }

    const invoices = await Invoice.find(filter).sort({ createdAt: -1 });
    const allInvoiceItems = await InvoiceItem.find();
    return res.json({ success: true, count: invoices.length, invoices, invoiceItems: allInvoiceItems });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

// Get invoice by ID
export async function getInvoiceById(req, res) {
  try {
    const { id } = req.params;
    let invoice = await Invoice.findById(id);
    if (!invoice) {
      invoice = await Invoice.findOne({ invoiceNumber: id });
    }
    if (!invoice) {
      return res.status(404).json({ success: false, error: 'Invoice not found' });
    }
    return res.json({ success: true, invoice });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

// Create new Invoice & deduct inventory
export async function createInvoice(req, res) {
  try {
    const {
      customerName = 'Cash Customer',
      customerMobile = '',
      paymentMode = 'Cash',
      paymentStatus = 'Paid',
      subtotal = 0,
      gstAmount = 0,
      discount = 0,
      roundOff = 0,
      grandTotal = 0,
      cashTendered = 0,
      changeDue = 0,
      notes = '',
      items = [],
      invoiceNumber: customInvoiceNumber,
      date = new Date().toISOString().split('T')[0]
    } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ success: false, error: 'Cannot create empty invoice without items' });
    }

    // 1. Generate Invoice Number atomically
    let invoiceNumber = customInvoiceNumber;
    let counter = await Counter.findOne({ name: 'invoice_sequence' });
    if (!counter) {
      counter = await Counter.create({ name: 'invoice_sequence', value: 0 });
    }

    const nextSeq = counter.value + 1;
    if (!invoiceNumber) {
      const year = new Date().getFullYear();
      invoiceNumber = `INV-${year}-${String(nextSeq).padStart(4, '0')}`;
    }

    // Update counter
    counter.value = nextSeq;
    await counter.save();

    // 2. Format Items and Deduct Stock
    const formattedItems = [];
    for (const item of items) {
      const qty = Number(item.quantity || item.qty) || 1;
      const rate = Number(item.rate || item.sellingPrice || item.price) || 0;
      const gstPercent = Number(item.gstPercent) || 5;
      const itemGst = Number(item.gstAmount) || Number(((rate * qty * gstPercent) / 100).toFixed(2));
      const total = Number(item.total) || Number((rate * qty).toFixed(2));

      formattedItems.push({
        productId: item.productId || item.id || '',
        productName: (item.productName || '').trim(),
        hsn: item.hsn || '540752',
        quantity: qty,
        unit: item.unit || 'Pcs',
        rate,
        gstPercent,
        gstAmount: itemGst,
        total
      });

      // Deduct Stock from Product Master
      if (item.productId) {
        try {
          const product = await Product.findById(item.productId);
          if (product) {
            product.stock = Math.max(0, (product.stock || 0) - qty);
            await product.save();
          }
        } catch (e) {
          // If productId is not a valid mongo ObjectId, try searching by name
          const product = await Product.findOne({
            productName: { $regex: new RegExp(`^${item.productName.trim().replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}$`, 'i') }
          });
          if (product) {
            product.stock = Math.max(0, (product.stock || 0) - qty);
            await product.save();
          }
        }
      } else if (item.productName) {
        const product = await Product.findOne({
          productName: { $regex: new RegExp(`^${item.productName.trim().replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}$`, 'i') }
        });
        if (product) {
          product.stock = Math.max(0, (product.stock || 0) - qty);
          await product.save();
        }
      }
    }

    // 3. Save Invoice Document with IST Time
    const now = new Date();
    const istDate = date || now.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    const istTime = now.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true });
    const istFull = now.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

    const newInvoice = await Invoice.create({
      invoiceNumber,
      date: istDate,
      time: istTime,
      createdAtIST: istFull,
      customerName: customerName.trim(),
      customerMobile: customerMobile.trim(),
      paymentMode,
      paymentStatus,
      subtotal: Number(subtotal),
      gstAmount: Number(gstAmount),
      discount: Number(discount),
      roundOff: Number(roundOff),
      grandTotal: Number(grandTotal),
      cashTendered: Number(cashTendered),
      changeDue: Number(changeDue),
      status: 'Active',
      notes,
      items: formattedItems
    });

    // 4. Also store in InvoiceItem collection for relational queries
    for (const fItem of formattedItems) {
      await InvoiceItem.create({
        invoiceId: invoiceNumber,
        ...fItem
      });
    }

    return res.status(201).json({
      success: true,
      message: 'Invoice created successfully in MongoDB',
      invoice: newInvoice
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

// Cancel Invoice & restock inventory
export async function cancelInvoice(req, res) {
  try {
    const { id } = req.params;
    let invoice = await Invoice.findById(id);
    if (!invoice) {
      invoice = await Invoice.findOne({ invoiceNumber: id });
    }
    if (!invoice) {
      return res.status(404).json({ success: false, error: 'Invoice not found' });
    }

    if (invoice.status === 'Cancelled') {
      return res.status(400).json({ success: false, error: 'Invoice is already cancelled' });
    }

    // Restock items
    if (invoice.items && invoice.items.length > 0) {
      for (const item of invoice.items) {
        const qty = Number(item.quantity) || 1;
        if (item.productId) {
          try {
            const product = await Product.findById(item.productId);
            if (product) {
              product.stock = (product.stock || 0) + qty;
              await product.save();
            }
          } catch (e) {
            const product = await Product.findOne({
              productName: { $regex: new RegExp(`^${item.productName.trim().replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}$`, 'i') }
            });
            if (product) {
              product.stock = (product.stock || 0) + qty;
              await product.save();
            }
          }
        } else if (item.productName) {
          const product = await Product.findOne({
            productName: { $regex: new RegExp(`^${item.productName.trim().replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}$`, 'i') }
          });
          if (product) {
            product.stock = (product.stock || 0) + qty;
            await product.save();
          }
        }
      }
    }

    invoice.status = 'Cancelled';
    await invoice.save();

    return res.json({ success: true, message: 'Invoice cancelled and inventory restored', invoice });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

// Delete Invoice
export async function deleteInvoice(req, res) {
  try {
    const { id } = req.params;
    let invoice = await Invoice.findById(id);
    if (!invoice) {
      invoice = await Invoice.findOne({ invoiceNumber: id });
    }
    if (!invoice) {
      return res.status(404).json({ success: false, error: 'Invoice not found' });
    }

    await InvoiceItem.deleteMany({ invoiceId: invoice.invoiceNumber });
    await Invoice.findByIdAndDelete(invoice._id);

    return res.json({ success: true, message: 'Invoice deleted successfully' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}
