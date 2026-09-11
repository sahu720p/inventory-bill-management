/**
 * Pricing Engine for Om Sahu Vastralaya
 *
 * Formula:
 * Step 1: Wholesale Rate + GST% (default 5%) = Cost After GST
 * Step 2: Cost After GST + Profit% (default 15%) = Final Selling Price
 *
 * Example:
 * ₹420 Wholesale Rate
 * + 5% GST = ₹441.00
 * + 15% Profit = ₹507.15
 */

export function calculatePricing(wholesaleRate, gstPercent = 5, profitPercent = 20) {
  const rate = parseFloat(wholesaleRate) || 0;
  const gst = parseFloat(gstPercent) || 0;
  const profit = parseFloat(profitPercent) || 0;

  // Step 1: GST
  const gstAmount = (rate * gst) / 100;
  const costAfterGST = rate + gstAmount;

  // Step 2: Profit
  const profitAmount = (costAfterGST * profit) / 100;
  const sellingPrice = costAfterGST + profitAmount;

  return {
    wholesaleRate: Number(rate.toFixed(2)),
    gstPercent: Number(gst.toFixed(2)),
    gstAmount: Number(gstAmount.toFixed(2)),
    costAfterGST: Number(costAfterGST.toFixed(2)),
    profitPercent: Number(profit.toFixed(2)),
    profitAmount: Number(profitAmount.toFixed(2)),
    sellingPrice: Number(sellingPrice.toFixed(2))
  };
}

export function formatCurrency(amount) {
  const val = Number(amount) || 0;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(val);
}
