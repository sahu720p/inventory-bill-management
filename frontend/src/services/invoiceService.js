import { invoiceApi } from './api';
import { db } from '../db/db';

/**
 * Sequential Invoice Number Generator
 */
export async function getNextInvoiceNumber() {
  try {
    const res = await invoiceApi.getNextNumber();
    if (res.success) {
      return { nextSeq: res.nextSeq, formattedNumber: res.invoiceNumber };
    }
  } catch (err) {
    console.warn('Backend next invoice number error, using local counter:', err.message);
  }

  const counterRecord = await db.counters.get('invoice_sequence');
  let currentSeq = counterRecord ? counterRecord.value : 0;
  const nextSeq = currentSeq + 1;
  const year = new Date().getFullYear();
  const formattedNumber = `INV-${year}-${String(nextSeq).padStart(4, '0')}`;
  return { nextSeq, formattedNumber };
}

/**
 * Create a new Customer Invoice with atomic stock deduction
 */
export async function createInvoice({
  customerName,
  customerMobile,
  customerAddress,
  items,
  paymentMode = 'Cash',
  notes = '',
  discount = 0,
  roundOff = 0
}) {
  // 1. Try to create on MongoDB Backend
  try {
    let subtotal = 0;
    const processedItems = items.map(item => {
      const qty = parseFloat(item.quantity || item.qty) || 1;
      const rate = parseFloat(item.rate || item.sellingPrice || item.price) || 0;
      const lineTotal = Number((qty * rate).toFixed(2));
      subtotal += lineTotal;

      return {
        productId: item.productId || item.id,
        productName: item.productName,
        hsn: item.hsn || '540752',
        quantity: qty,
        rate: rate,
        gstPercent: item.gstPercent || 5,
        gstAmount: Number(((lineTotal * (item.gstPercent || 5)) / 100).toFixed(2)),
        total: lineTotal
      };
    });

    const gstAmount = Number((subtotal * 0.05).toFixed(2));
    const grandTotal = Number((subtotal - (Number(discount) || 0) + (Number(roundOff) || 0)).toFixed(2));

    const invoicePayload = {
      customerName: customerName ? customerName.trim() : 'Cash Customer',
      customerMobile: customerMobile ? customerMobile.trim() : '',
      customerAddress: customerAddress ? customerAddress.trim() : '',
      items: processedItems,
      subtotal,
      gstAmount,
      discount: Number(discount) || 0,
      roundOff: Number(roundOff) || 0,
      grandTotal,
      paymentMode,
      paymentStatus: 'Paid',
      notes,
      date: new Date().toISOString().split('T')[0]
    };

    const res = await invoiceApi.create(invoicePayload);
    if (res.success && res.invoice) {
      return {
        invoiceId: res.invoice._id || res.invoice.id,
        invoiceNumber: res.invoice.invoiceNumber,
        invoice: res.invoice
      };
    }
  } catch (apiErr) {
    console.warn('Backend createInvoice failed, falling back to local DB:', apiErr.message);
  }

  // 2. Local Fallback
  return await db.transaction('rw', db.invoices, db.invoiceItems, db.products, db.counters, async () => {
    const { nextSeq, formattedNumber } = await getNextInvoiceNumber();

    let subtotal = 0;
    const processedItems = items.map(item => {
      const qty = parseFloat(item.quantity || item.qty) || 1;
      const rate = parseFloat(item.rate || item.sellingPrice || item.price) || 0;
      const lineTotal = Number((qty * rate).toFixed(2));
      subtotal += lineTotal;

      return {
        productId: item.productId || item.id,
        productName: item.productName,
        hsn: item.hsn || '',
        quantity: qty,
        rate: rate,
        gst: item.gstPercent || 5,
        amount: lineTotal
      };
    });

    const gstAmount = Number((subtotal * 0.05).toFixed(2));
    const grandTotal = Number(subtotal.toFixed(2));

    const invoiceId = await db.invoices.add({
      invoiceNumber: formattedNumber,
      date: new Date().toISOString().split('T')[0],
      customerName: customerName ? customerName.trim() : 'Cash Customer',
      customerMobile: customerMobile ? customerMobile.trim() : '',
      customerAddress: customerAddress ? customerAddress.trim() : '',
      subtotal,
      gstAmount,
      grandTotal,
      paymentMode,
      notes,
      status: 'Completed',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    for (const item of processedItems) {
      await db.invoiceItems.add({
        invoiceId,
        ...item
      });

      if (item.productId) {
        const product = await db.products.get(item.productId);
        if (product) {
          const newStock = Math.max(0, (product.stock || 0) - item.quantity);
          await db.products.update(item.productId, {
            stock: newStock,
            updatedAt: new Date().toISOString()
          });
        }
      }
    }

    await db.counters.put({ name: 'invoice_sequence', value: nextSeq });

    return { invoiceId, invoiceNumber: formattedNumber };
  });
}

/**
 * Delete Invoice
 */
export async function deleteInvoice(invoiceId, restoreStock = true) {
  try {
    const res = await invoiceApi.delete(invoiceId);
    if (res.success) return true;
  } catch (apiErr) {
    console.warn('Backend deleteInvoice failed, falling back to local DB:', apiErr.message);
  }

  return await db.transaction('rw', db.invoices, db.invoiceItems, db.products, async () => {
    if (restoreStock) {
      const items = await db.invoiceItems.where('invoiceId').equals(invoiceId).toArray();
      for (const item of items) {
        if (item.productId) {
          const product = await db.products.get(item.productId);
          if (product) {
            await db.products.update(item.productId, {
              stock: (product.stock || 0) + item.quantity,
              updatedAt: new Date().toISOString()
            });
          }
        }
      }
    }

    await db.invoiceItems.where('invoiceId').equals(invoiceId).delete();
    await db.invoices.delete(invoiceId);
  });
}
