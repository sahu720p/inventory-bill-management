import { invoiceApi } from './api';
import { db } from '../db/db';

/**
 * Sequential Invoice Number Generator
 */
export async function getNextInvoiceNumber() {
  try {
    const res = await invoiceApi.getNextNumber();
    if (res.success && res.invoiceNumber) {
      return { nextSeq: res.nextSeq, formattedNumber: res.invoiceNumber };
    }
  } catch (err) {
    console.warn('Backend next invoice number error, using local counter:', err.message);
  }

  let prefix = 'INV-';
  try {
    const prefixSetting = await db.settings.get('invoice_prefix');
    if (prefixSetting && prefixSetting.value) prefix = prefixSetting.value;
  } catch (e) {}

  const counterRecord = await db.counters.get('invoice_sequence');
  let currentSeq = counterRecord ? counterRecord.value : 0;
  let nextSeq = currentSeq + 1;
  const year = new Date().getFullYear();
  let formattedNumber = `${prefix}${year}-${String(nextSeq).padStart(4, '0')}`;

  while (await db.invoices.where('invoiceNumber').equals(formattedNumber).first()) {
    nextSeq++;
    formattedNumber = `${prefix}${year}-${String(nextSeq).padStart(4, '0')}`;
  }

  return { nextSeq, formattedNumber };
}

/**
 * Reset Sequential Invoice Counter
 */
export async function resetInvoiceSequence(sequenceValue = 0) {
  const val = Math.max(0, parseInt(sequenceValue, 10) || 0);

  try {
    await invoiceApi.resetCounter(val);
  } catch (err) {
    console.warn('Backend reset counter error:', err.message);
  }

  await db.counters.put({ name: 'invoice_sequence', value: val });
  return await getNextInvoiceNumber();
}

/**
 * Reliable Helper to retrieve line items for any invoice
 */
export async function getInvoiceItems(invoice) {
  if (!invoice) return [];
  if (Array.isArray(invoice.items) && invoice.items.length > 0) {
    return invoice.items;
  }

  const candidateIds = [
    invoice.id,
    invoice._id,
    invoice.invoiceNumber,
    String(invoice.id),
    Number(invoice.id)
  ].filter(Boolean);

  for (const cid of candidateIds) {
    try {
      const items = await db.invoiceItems.where('invoiceId').equals(cid).toArray();
      if (items && items.length > 0) {
        return items;
      }
    } catch (e) {}
  }

  return [];
}

/**
 * Create a new Customer Invoice with atomic stock deduction and optional custom invoice #
 */
export async function createInvoice({
  customerName,
  customerMobile,
  customerAddress,
  items,
  paymentMode = 'Cash',
  notes = '',
  discount = 0,
  roundOff = 0,
  customInvoiceNumber = ''
}) {
  let subtotal = 0;
  const processedItems = (items || []).map(item => {
    const qty = parseFloat(item.quantity || item.qty) || 1;
    const rate = parseFloat(item.rate || item.sellingPrice || item.price || item.wholesaleRate) || 0;
    const lineTotal = Number((qty * rate).toFixed(2));
    subtotal += lineTotal;

    return {
      productId: item.productId || item.id || '',
      productName: (item.productName || item.name || '').trim(),
      hsn: item.hsn || '540752',
      quantity: qty,
      unit: item.unit || 'Pcs',
      rate: rate,
      gstPercent: item.gstPercent || 5,
      gstAmount: Number(((lineTotal * (item.gstPercent || 5)) / 100).toFixed(2)),
      amount: lineTotal,
      total: lineTotal
    };
  });

  const gstAmount = Number((subtotal * 0.05).toFixed(2));
  const grandTotal = Number((subtotal - (Number(discount) || 0) + (Number(roundOff) || 0)).toFixed(2));

  // 1. Try to create on MongoDB Backend
  try {
    const invoicePayload = {
      invoiceNumber: customInvoiceNumber ? customInvoiceNumber.trim() : undefined,
      customerName: customerName ? customerName.trim() : 'Cash Customer',
      customerMobile: customerMobile ? customerMobile.trim() : '',
      customerAddress: customerAddress ? customerAddress.trim() : '',
      items: processedItems,
      subtotal,
      gstAmount,
      discount: Number(discount) || 0,
      roundOff: Number(roundOff) || 0,
      grandTotal: grandTotal > 0 ? grandTotal : subtotal,
      paymentMode,
      paymentStatus: 'Paid',
      notes,
      date: new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
    };

    const res = await invoiceApi.create(invoicePayload);
    if (res.success && res.invoice) {
      // Also cache to local Dexie for offline resilience
      try {
        await db.transaction('rw', db.invoices, db.invoiceItems, async () => {
          const invId = res.invoice._id || res.invoice.id;
          await db.invoices.put({
            id: invId,
            ...res.invoice,
            createdAt: res.invoice.createdAt || new Date().toISOString()
          });
          for (const item of processedItems) {
            await db.invoiceItems.add({
              invoiceId: res.invoice.invoiceNumber,
              ...item
            });
          }
        });
      } catch (e) {}

      return {
        invoiceId: res.invoice._id || res.invoice.id,
        invoiceNumber: res.invoice.invoiceNumber,
        invoice: res.invoice
      };
    }
  } catch (apiErr) {
    console.warn('Backend createInvoice failed, falling back to local DB:', apiErr.message);
  }

  // 2. Local Dexie Fallback
  return await db.transaction('rw', db.invoices, db.invoiceItems, db.products, db.counters, async () => {
    let formattedNumber = customInvoiceNumber ? customInvoiceNumber.trim() : '';
    let nextSeq = 0;

    if (!formattedNumber) {
      const seqData = await getNextInvoiceNumber();
      nextSeq = seqData.nextSeq;
      formattedNumber = seqData.formattedNumber;
    } else {
      const existing = await db.invoices.where('invoiceNumber').equals(formattedNumber).first();
      if (existing) {
        throw new Error(`Invoice number "${formattedNumber}" already exists.`);
      }

      const counterRecord = await db.counters.get('invoice_sequence');
      const currentVal = counterRecord ? counterRecord.value : 0;
      const match = formattedNumber.match(/^INV-\d{4}-(\d+)$/i) || formattedNumber.match(/^INV-(\d+)$/i);
      if (match) {
        const parsed = parseInt(match[1], 10);
        if (!isNaN(parsed) && parsed > currentVal) {
          nextSeq = parsed;
        }
      }
    }

    const todayDate = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    const nowTime = new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true });

    const invoiceId = await db.invoices.add({
      invoiceNumber: formattedNumber,
      date: todayDate,
      time: nowTime,
      customerName: customerName ? customerName.trim() : 'Cash Customer',
      customerMobile: customerMobile ? customerMobile.trim() : '',
      customerAddress: customerAddress ? customerAddress.trim() : '',
      subtotal,
      gstAmount,
      discount: Number(discount) || 0,
      roundOff: Number(roundOff) || 0,
      grandTotal: grandTotal > 0 ? grandTotal : subtotal,
      paymentMode,
      paymentStatus: 'Paid',
      notes,
      status: 'Completed',
      items: processedItems,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    for (const item of processedItems) {
      await db.invoiceItems.add({
        invoiceId: formattedNumber,
        ...item
      });
      await db.invoiceItems.add({
        invoiceId: invoiceId,
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

    if (nextSeq > 0) {
      await db.counters.put({ name: 'invoice_sequence', value: nextSeq });
    }

    return {
      invoiceId,
      invoiceNumber: formattedNumber,
      invoice: {
        id: invoiceId,
        invoiceNumber: formattedNumber,
        date: todayDate,
        time: nowTime,
        customerName: customerName || 'Cash Customer',
        customerMobile: customerMobile || '',
        customerAddress: customerAddress || '',
        grandTotal: grandTotal > 0 ? grandTotal : subtotal,
        subtotal,
        paymentMode,
        items: processedItems
      }
    };
  });
}

/**
 * Update / Edit an existing Invoice manually
 */
export async function updateExistingInvoice(invoiceId, updatedData) {
  // 1. Try MongoDB API
  try {
    const res = await invoiceApi.update(invoiceId, updatedData);
    if (res.success && res.invoice) {
      // Also update local Dexie
      try {
        const localInv = await db.invoices.where('invoiceNumber').equals(res.invoice.invoiceNumber).first() ||
                         await db.invoices.get(invoiceId);
        if (localInv) {
          await db.invoices.update(localInv.id, {
            ...res.invoice,
            updatedAt: new Date().toISOString()
          });
        }
      } catch (e) {}

      return res.invoice;
    }
  } catch (apiErr) {
    console.warn('Backend updateInvoice failed, falling back to local DB:', apiErr.message);
  }

  // 2. Local Dexie Fallback
  return await db.transaction('rw', db.invoices, db.invoiceItems, async () => {
    let localInv = await db.invoices.get(invoiceId);
    if (!localInv && typeof invoiceId === 'string') {
      localInv = await db.invoices.where('invoiceNumber').equals(invoiceId).first();
    }

    if (!localInv) {
      throw new Error('Invoice not found');
    }

    const calculatedGrandTotal = updatedData.grandTotal !== undefined && Number(updatedData.grandTotal) > 0
      ? Number(updatedData.grandTotal)
      : (updatedData.items || []).reduce((s, it) => s + ((Number(it.rate || 0) * Number(it.quantity || 1))), 0);

    const merged = {
      ...localInv,
      ...updatedData,
      grandTotal: calculatedGrandTotal > 0 ? calculatedGrandTotal : localInv.grandTotal,
      updatedAt: new Date().toISOString()
    };

    await db.invoices.put(merged);

    if (Array.isArray(updatedData.items) && updatedData.items.length > 0) {
      await db.invoiceItems.where('invoiceId').equals(localInv.id).delete();
      await db.invoiceItems.where('invoiceId').equals(localInv.invoiceNumber).delete();

      for (const it of updatedData.items) {
        await db.invoiceItems.add({
          invoiceId: merged.invoiceNumber,
          ...it
        });
      }
    }

    return merged;
  });
}

/**
 * Auto-Repair all invoices in both Dexie & MongoDB (Fixes 0 amount bills permanently)
 */
export async function repairAllInvoices() {
  let backendRepaired = 0;
  try {
    const res = await invoiceApi.repairInvoices();
    if (res.success) {
      backendRepaired = res.repairedCount || 0;
    }
  } catch (e) {
    console.warn('MongoDB repair skipped:', e.message);
  }

  let localRepaired = 0;
  try {
    const localInvoices = await db.invoices.toArray();
    for (const inv of localInvoices) {
      let needsUpdate = false;
      let total = Number(inv.grandTotal) || 0;

      let items = inv.items;
      if (!items || items.length === 0) {
        items = await getInvoiceItems(inv);
        if (items.length > 0) {
          inv.items = items;
          needsUpdate = true;
        }
      }

      if (total === 0 && items && items.length > 0) {
        total = items.reduce((sum, it) => {
          const qty = Number(it.quantity ?? it.qty ?? 1) || 1;
          const rate = Number(it.rate ?? it.sellingPrice ?? it.price ?? 0) || 0;
          return sum + (Number(it.amount ?? it.total ?? (qty * rate)) || 0);
        }, 0);

        if (total > 0) {
          inv.grandTotal = total;
          inv.subtotal = inv.subtotal || total;
          needsUpdate = true;
        }
      }

      if (needsUpdate) {
        await db.invoices.put(inv);
        localRepaired++;
      }
    }
  } catch (e) {
    console.warn('Dexie repair error:', e.message);
  }

  return { backendRepaired, localRepaired };
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
      const items = await getInvoiceItems({ id: invoiceId, invoiceNumber: invoiceId });
      for (const item of items) {
        if (item.productId) {
          const product = await db.products.get(item.productId);
          if (product) {
            await db.products.update(item.productId, {
              stock: (product.stock || 0) + (Number(item.quantity) || 1),
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
