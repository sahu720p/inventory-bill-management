import { Invoice } from '../models/Invoice.js';
import { InvoiceItem } from '../models/InvoiceItem.js';
import { Product } from '../models/Product.js';
import { Counter } from '../models/Counter.js';

// Get next sequential invoice number
export async function getNextInvoiceNumber(req, res) {
  try {
    let counter = await Counter.findOne({ name: 'invoice_sequence' });
    let currentSeq = counter ? counter.value : 0;
    let nextSeq = currentSeq + 1;
    const year = new Date().getFullYear();
    let candidateNumber = `INV-${year}-${String(nextSeq).padStart(4, '0')}`;

    // Ensure candidateNumber does not collide with an existing manual invoice
    while (await Invoice.findOne({ invoiceNumber: candidateNumber })) {
      nextSeq++;
      candidateNumber = `INV-${year}-${String(nextSeq).padStart(4, '0')}`;
    }

    return res.json({ success: true, nextSeq, invoiceNumber: candidateNumber });
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
    let invoiceNumber = customInvoiceNumber ? String(customInvoiceNumber).trim() : '';
    let counter = await Counter.findOne({ name: 'invoice_sequence' });
    if (!counter) {
      counter = await Counter.create({ name: 'invoice_sequence', value: 0 });
    }

    if (!invoiceNumber) {
      // Auto-generated sequential invoice
      let nextSeq = counter.value + 1;
      const year = new Date().getFullYear();
      let candidateNumber = `INV-${year}-${String(nextSeq).padStart(4, '0')}`;

      // Avoid collision with existing manual invoices
      while (await Invoice.findOne({ invoiceNumber: candidateNumber })) {
        nextSeq++;
        candidateNumber = `INV-${year}-${String(nextSeq).padStart(4, '0')}`;
      }

      invoiceNumber = candidateNumber;
      counter.value = nextSeq;
      await counter.save();
    } else {
      // Manual / Custom Invoice Number
      const existing = await Invoice.findOne({ invoiceNumber });
      if (existing) {
        return res.status(400).json({
          success: false,
          error: `Invoice number "${invoiceNumber}" already exists. Please choose a different invoice number.`
        });
      }

      // If user typed a manual number matching standard sequence (e.g. INV-2026-0005)
      // and it is higher than current counter, advance the counter so future auto bills don't collide.
      const match = invoiceNumber.match(/^INV-\d{4}-(\d+)$/i) || invoiceNumber.match(/^INV-(\d+)$/i);
      if (match) {
        const manualSeq = parseInt(match[1], 10);
        if (!isNaN(manualSeq) && manualSeq > counter.value) {
          counter.value = manualSeq;
          await counter.save();
        }
      }
      // If manual invoice is custom prefix, or older number (e.g. past record), counter is preserved and not incremented!
    }

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

// Update / Edit an existing Invoice manually
export async function updateInvoice(req, res) {
  try {
    const { id } = req.params;
    let invoice = await Invoice.findById(id);
    if (!invoice) {
      invoice = await Invoice.findOne({ invoiceNumber: id });
    }
    if (!invoice) {
      return res.status(404).json({ success: false, error: 'Invoice not found' });
    }

    const {
      customerName,
      customerMobile,
      paymentMode,
      paymentStatus,
      subtotal,
      gstAmount,
      discount,
      roundOff,
      grandTotal,
      notes,
      items,
      date,
      time,
      invoiceNumber
    } = req.body;

    if (customerName !== undefined) invoice.customerName = customerName.trim();
    if (customerMobile !== undefined) invoice.customerMobile = customerMobile.trim();
    if (paymentMode !== undefined) invoice.paymentMode = paymentMode;
    if (paymentStatus !== undefined) invoice.paymentStatus = paymentStatus;
    if (notes !== undefined) invoice.notes = notes;
    if (date !== undefined) invoice.date = date;
    if (time !== undefined) invoice.time = time;
    if (invoiceNumber !== undefined && invoiceNumber.trim()) {
      invoice.invoiceNumber = invoiceNumber.trim();
    }

    // Process updated items if provided
    if (Array.isArray(items) && items.length > 0) {
      let computedSubtotal = 0;
      const formattedItems = items.map(item => {
        const qty = Number(item.quantity ?? item.qty ?? 1) || 1;
        const rate = Number(item.rate ?? item.sellingPrice ?? item.price ?? item.wholesaleRate ?? 0) || 0;
        const lineTotal = Number(item.amount ?? item.total ?? (qty * rate)) || 0;
        computedSubtotal += lineTotal;

        return {
          productId: item.productId || item.id || '',
          productName: (item.productName || item.name || '').trim(),
          hsn: item.hsn || '540752',
          quantity: qty,
          unit: item.unit || 'Pcs',
          rate,
          gstPercent: Number(item.gstPercent) || 5,
          gstAmount: Number(((lineTotal * (Number(item.gstPercent) || 5)) / 100).toFixed(2)),
          total: lineTotal
        };
      });

      invoice.items = formattedItems;
      invoice.subtotal = Number((subtotal !== undefined ? subtotal : computedSubtotal).toFixed(2));
      invoice.gstAmount = Number((gstAmount !== undefined ? gstAmount : (computedSubtotal * 0.05)).toFixed(2));
      invoice.discount = Number(discount) || 0;
      invoice.roundOff = Number(roundOff) || 0;
      invoice.grandTotal = Number((grandTotal !== undefined && Number(grandTotal) > 0 ? grandTotal : computedSubtotal).toFixed(2));

      // Refresh relational InvoiceItem documents
      await InvoiceItem.deleteMany({ invoiceId: invoice.invoiceNumber });
      for (const it of formattedItems) {
        await InvoiceItem.create({
          invoiceId: invoice.invoiceNumber,
          ...it
        });
      }
    } else {
      if (subtotal !== undefined) invoice.subtotal = Number(subtotal);
      if (gstAmount !== undefined) invoice.gstAmount = Number(gstAmount);
      if (discount !== undefined) invoice.discount = Number(discount);
      if (roundOff !== undefined) invoice.roundOff = Number(roundOff);
      if (grandTotal !== undefined && Number(grandTotal) > 0) {
        invoice.grandTotal = Number(grandTotal);
      } else if (invoice.items && invoice.items.length > 0) {
        // Auto calculate grandTotal if missing or 0
        const calcTotal = invoice.items.reduce((sum, it) => sum + (Number(it.total) || (Number(it.rate || 0) * Number(it.quantity || 1))), 0);
        invoice.grandTotal = Number(calcTotal.toFixed(2));
      }
    }

    await invoice.save();

    return res.json({
      success: true,
      message: 'Invoice updated and synchronized successfully',
      invoice
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

// Reset Invoice Sequence Counter
export async function resetInvoiceCounter(req, res) {
  try {
    const { sequenceValue = 0 } = req.body;
    const value = Math.max(0, parseInt(sequenceValue, 10) || 0);

    const counter = await Counter.findOneAndUpdate(
      { name: 'invoice_sequence' },
      { name: 'invoice_sequence', value },
      { upsert: true, new: true }
    );

    const year = new Date().getFullYear();
    const nextFormatted = `INV-${year}-${String(value + 1).padStart(4, '0')}`;

    return res.json({
      success: true,
      message: `Invoice sequence counter reset to ${value}`,
      currentSeq: value,
      nextInvoiceNumber: nextFormatted
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

// Auto-Repair All Invoices (Fix 0 amounts and missing totals)
export async function repairInvoices(req, res) {
  try {
    const invoices = await Invoice.find();
    let repairedCount = 0;

    for (const inv of invoices) {
      let needsSave = false;
      let calculatedTotal = 0;

      if (inv.items && inv.items.length > 0) {
        calculatedTotal = inv.items.reduce((sum, it) => {
          const qty = Number(it.quantity ?? it.qty ?? 1) || 1;
          const rate = Number(it.rate ?? it.sellingPrice ?? it.price ?? 0) || 0;
          return sum + (Number(it.total ?? it.amount ?? (qty * rate)) || 0);
        }, 0);
      } else {
        // Look in InvoiceItem collection
        const dbItems = await InvoiceItem.find({ invoiceId: inv.invoiceNumber });
        if (dbItems && dbItems.length > 0) {
          inv.items = dbItems.map(it => ({
            productId: it.productId || '',
            productName: it.productName || 'Product',
            hsn: it.hsn || '540752',
            quantity: it.quantity || 1,
            unit: it.unit || 'Pcs',
            rate: it.rate || 0,
            gstPercent: it.gstPercent || 5,
            gstAmount: it.gstAmount || 0,
            total: it.total || ((it.quantity || 1) * (it.rate || 0))
          }));
          calculatedTotal = inv.items.reduce((s, i) => s + (i.total || 0), 0);
          needsSave = true;
        }
      }

      if ((!inv.grandTotal || inv.grandTotal === 0) && calculatedTotal > 0) {
        inv.grandTotal = Number(calculatedTotal.toFixed(2));
        inv.subtotal = inv.subtotal || Number(calculatedTotal.toFixed(2));
        needsSave = true;
      }

      if (needsSave) {
        await inv.save();
        repairedCount++;
      }
    }

    return res.json({
      success: true,
      message: `Repaired ${repairedCount} invoices with verified amounts`,
      repairedCount
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
