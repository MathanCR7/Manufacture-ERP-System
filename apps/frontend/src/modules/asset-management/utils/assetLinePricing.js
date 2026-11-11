/**
 * Shared line-item discount and GST calculation helpers for Asset Management.
 * Model (GST Sec 15(3) compliant):
 *   Gross Amount   = Quantity * Unit Price
 *   Line Discount  = (% or flat ₹) clamped to [0, Gross Amount]
 *   Taxable Base   = max(0, Gross Amount - Line Discount)
 *   GST Amount     = Taxable Base * (GST % / 100)  [Discount is NEVER taxed]
 *   Line Total     = Taxable Base + GST Amount
 */

export const calcLineItemAmounts = (
  item = {},
  { applyGst = true, isInterState = false } = {}
) => {
  const quantity = Math.max(0, Number(item.quantity ?? item.orderedQty ?? 0));
  const unitPrice = Math.max(0, Number(item.unitPrice || 0));
  const grossAmount = quantity * unitPrice;

  const hasExplicitPercent =
    item.discountType === undefined &&
    item.discountAmount === undefined &&
    item.discountValue === undefined &&
    Number(item.discountPercent || 0) > 0;

  const discountType = item.discountType || (hasExplicitPercent ? 'percent' : 'amount');
  const rawInput =
    item.discountValue !== undefined && item.discountValue !== ''
      ? item.discountValue
      : discountType === 'percent'
        ? item.discountPercent
        : item.discountAmount;
  const discountValue = Math.max(0, Number(rawInput || 0));

  const rawDiscount =
    discountType === 'percent'
      ? grossAmount * (Math.min(100, discountValue) / 100)
      : discountValue;

  const discountAmount = Math.min(grossAmount, Math.max(0, rawDiscount));
  const discountPercent = grossAmount > 0 ? (discountAmount / grossAmount) * 100 : 0;
  const taxableBase = Math.max(0, grossAmount - discountAmount);
  const discountedUnitPrice = quantity > 0 ? taxableBase / quantity : 0;

  const gstRate = Math.max(0, Number(item.gstRate ?? 18));
  const gstAmount = applyGst ? taxableBase * (gstRate / 100) : 0;
  const cgstAmount = applyGst && !isInterState ? gstAmount / 2 : 0;
  const sgstAmount = applyGst && !isInterState ? gstAmount / 2 : 0;
  const igstAmount = applyGst && isInterState ? gstAmount : 0;

  return {
    quantity,
    unitPrice,
    grossAmount,
    discountType,
    discountValue,
    discountAmount,
    discountPercent,
    discountedUnitPrice,
    taxableBase,
    totalBeforeTax: taxableBase,
    gstRate,
    gstAmount,
    cgstAmount,
    sgstAmount,
    igstAmount,
    totalWithGst: taxableBase + gstAmount,
  };
};

export const getSavedItemBreakdown = (item = {}) => {
  const quantity = Math.max(0, Number(item.quantity ?? item.orderedQty ?? 0));
  const unitPrice = Math.max(0, Number(item.unitPrice || 0));
  const grossAmount = quantity * unitPrice;

  const rawBase = item.totalBeforeTax ?? item.baseAmount ?? item.taxableValue;
  const storedPct = Math.max(0, Number(item.discountPercent || 0));

  let taxableBase = grossAmount;
  if (rawBase !== undefined && rawBase !== null) {
    const numBase = Math.max(0, Number(rawBase));
    // Guard against legacy invoice rows where discountPercent > 0 wasn't deducted from taxableValue
    if (numBase < grossAmount - 0.005 || storedPct <= 0) {
      taxableBase = numBase;
    } else {
      taxableBase = Math.max(0, grossAmount * (1 - Math.min(100, storedPct) / 100));
    }
  } else if (storedPct > 0) {
    taxableBase = Math.max(0, grossAmount * (1 - Math.min(100, storedPct) / 100));
  }

  const discountAmount = Math.max(0, grossAmount - taxableBase);
  const discountPercent =
    storedPct > 0
      ? storedPct
      : grossAmount > 0
        ? (discountAmount / grossAmount) * 100
        : 0;

  const gstRate = Math.max(0, Number(item.gstRate ?? 18));
  const storedGst =
    item.gstAmount !== undefined && item.gstAmount !== null
      ? Number(item.gstAmount)
      : Number(item.cgst ?? item.cgstAmount ?? 0) +
        Number(item.sgst ?? item.sgstAmount ?? 0) +
        Number(item.igst ?? item.igstAmount ?? 0);

  const rawLineTotal = item.totalWithGst ?? item.lineTotal;
  const totalWithGst =
    rawLineTotal !== undefined && rawLineTotal !== null
      ? Number(rawLineTotal)
      : taxableBase + storedGst;

  return {
    quantity,
    unitPrice,
    grossAmount,
    taxableBase,
    discountAmount,
    discountPercent,
    gstRate,
    gstAmount: storedGst,
    totalWithGst,
  };
};

export const getDocumentDiscountSummary = (doc = {}) => {
  const items = doc.items || [];
  let grossSubtotal = 0;
  let taxableSubtotal = 0;
  let itemDiscountTotal = 0;

  items.forEach((item) => {
    const info = getSavedItemBreakdown(item);
    grossSubtotal += info.grossAmount;
    taxableSubtotal += info.taxableBase;
    itemDiscountTotal += info.discountAmount;
  });

  const storedDiscount = Number(doc.discount || 0);
  // Pre-GST item-level discounts are already deducted inside taxableSubtotal.
  // Only legacy documents (no item discount, non-zero header discount) subtracted discount after GST.
  const isLegacyPostGst = itemDiscountTotal <= 0.01 && storedDiscount > 0.01;
  const lineDiscountTotal = isLegacyPostGst ? 0 : itemDiscountTotal > 0.01 ? itemDiscountTotal : 0;
  const legacyHeaderDiscount = isLegacyPostGst ? storedDiscount : 0;

  return {
    grossSubtotal,
    taxableSubtotal,
    lineDiscountTotal,
    legacyHeaderDiscount,
    displayDiscountTotal: lineDiscountTotal + legacyHeaderDiscount,
  };
};

export const hydrateLineItemDiscount = (rawItem = {}, extraLegacyDiscount = 0) => {
  const { grossAmount, discountAmount, discountPercent } = getSavedItemBreakdown(rawItem);
  const totalDisc = Math.min(
    grossAmount > 0 ? grossAmount : discountAmount + Math.max(0, Number(extraLegacyDiscount || 0)),
    discountAmount + Math.max(0, Number(extraLegacyDiscount || 0))
  );

  if (totalDisc <= 0.0001) {
    return { discountType: 'amount', discountValue: '' };
  }

  if (extraLegacyDiscount <= 0 && discountPercent > 0) {
    const roundedPct = Number(discountPercent.toFixed(4));
    const roundedAmt = Number(totalDisc.toFixed(2));
    if (Number.isInteger(roundedPct) || Math.abs(totalDisc - roundedAmt) > 0.001) {
      return { discountType: 'percent', discountValue: String(roundedPct) };
    }
  }

  return {
    discountType: 'amount',
    discountValue: String(Number(totalDisc.toFixed(2))),
  };
};

export const allocateLegacyHeaderDiscount = (items = [], docDiscount = 0) => {
  const headerDisc = Math.max(0, Number(docDiscount || 0));
  const itemDiscTotal = items.reduce((s, it) => s + getSavedItemBreakdown(it).discountAmount, 0);
  if (headerDisc <= 0.01 || itemDiscTotal > 0.01) {
    return items.map(() => 0);
  }

  const grossList = items.map((it) => getSavedItemBreakdown(it).grossAmount);
  const totalGross = grossList.reduce((s, g) => s + g, 0);
  if (totalGross <= 0) return items.map(() => 0);

  let allocated = 0;
  let lastPositiveIdx = -1;
  grossList.forEach((g, idx) => {
    if (g > 0) lastPositiveIdx = idx;
  });

  return grossList.map((g, idx) => {
    if (g <= 0) return 0;
    if (idx === lastPositiveIdx) {
      return Math.max(0, Number((headerDisc - allocated).toFixed(2)));
    }
    const share = Number(((g / totalGross) * headerDisc).toFixed(2));
    allocated += share;
    return share;
  });
};

