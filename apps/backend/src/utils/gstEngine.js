/**
 * GST Calculation Engine (Pure Functional Module)
 * Supports Intra-State (CGST + SGST) and Inter-State (IGST)
 * Indian Numbering and Amount in Words (Lakh/Crore)
 */

function round2(num) {
  return Math.round((Number(num) || 0) * 100) / 100;
}

// Convert numbers to Indian Rupees in words (Lakhs & Crores)
function numberToIndianWords(amount) {
  const rounded = Math.round(Number(amount) || 0);
  if (rounded === 0) return 'Rupees Zero Only';

  const a = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'
  ];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function inWords(num) {
    if (num < 20) return a[num];
    if (num < 100) return b[Math.floor(num / 10)] + (num % 10 !== 0 ? ' ' + a[num % 10] : '');
    if (num < 1000) return a[Math.floor(num / 100)] + ' Hundred' + (num % 100 !== 0 ? ' and ' + inWords(num % 100) : '');
    if (num < 100000) return inWords(Math.floor(num / 1000)) + ' Thousand' + (num % 1000 !== 0 ? ' ' + inWords(num % 1000) : '');
    if (num < 10000000) return inWords(Math.floor(num / 100000)) + ' Lakh' + (num % 100000 !== 0 ? ' ' + inWords(num % 100000) : '');
    return inWords(Math.floor(num / 10000000)) + ' Crore' + (num % 10000000 !== 0 ? ' ' + inWords(num % 10000000) : '');
  }

  return `Rupees ${inWords(rounded)} Only`;
}

// Derive state code from GSTIN (first 2 digits)
function getStateCodeFromGstin(gstin) {
  if (!gstin || typeof gstin !== 'string') return null;
  const clean = gstin.trim().replace(/^GSTIN-?/i, '');
  const prefix = clean.substring(0, 2);
  return /^\d{2}$/.test(prefix) ? prefix : null;
}

/**
 * Pure calculation function
 */
function calculateOrderGst({
  sellerStateCode = '33', // Default Tamil Nadu
  buyerStateCode = null,
  customerGstin = null,
  items = [],
  charges = {},
  additionalCharges = {},
  chargeTaxRates = {},
  invoiceDiscount = 0,
  tdsDeduction = 0,
  creditNoteAdjustment = 0,
  chargesDefaultGstRate = 18,
  placeOfSupply = null
}) {
  // 1. Resolve State Codes
  const resolvedSellerState = (sellerStateCode || '33').trim();
  let resolvedBuyerState = buyerStateCode;

  if (!resolvedBuyerState && customerGstin) {
    resolvedBuyerState = getStateCodeFromGstin(customerGstin);
  }
  if (!resolvedBuyerState && placeOfSupply) {
    resolvedBuyerState = getStateCodeFromGstin(placeOfSupply) || placeOfSupply.trim();
  }
  // Unregistered or missing buyer state defaults to seller's state (Intra-state)
  if (!resolvedBuyerState) {
    resolvedBuyerState = resolvedSellerState;
  }

  const isInterState = resolvedSellerState !== resolvedBuyerState;
  const taxType = isInterState ? 'INTER_STATE' : 'INTRA_STATE';
  const taxTypeLabel = isInterState ? 'INTER-STATE (IGST)' : 'INTRA-STATE (CGST + SGST)';

  // 2. Calculate Line Items
  let grossLineSubtotal = 0;
  let totalLineDiscounts = 0;

  const processedItems = items.map((item, idx) => {
    const qty = Math.max(0, Number(item.quantity) || 0);
    const unitPrice = Math.max(0, Number(item.unitPrice) || 0);
    const gross = round2(qty * unitPrice);

    let lineDiscount = 0;
    let discPercent = Number(item.discountPercent) || 0;

    if (discPercent > 0) {
      lineDiscount = round2(gross * (discPercent / 100));
    } else if (Number(item.discount) > 0) {
      lineDiscount = round2(Number(item.discount));
      discPercent = gross > 0 ? round2((lineDiscount / gross) * 100) : 0;
    }

    lineDiscount = Math.min(gross, lineDiscount);
    const taxableValue = round2(gross - lineDiscount);

    grossLineSubtotal += gross;
    totalLineDiscounts += lineDiscount;

    const rate = Math.max(0, Number(item.gstRate !== undefined ? item.gstRate : 18));
    let cgstRate = 0;
    let sgstRate = 0;
    let igstRate = 0;
    let cgstAmount = 0;
    let sgstAmount = 0;
    let igstAmount = 0;

    if (isInterState) {
      igstRate = rate;
      igstAmount = round2(taxableValue * (igstRate / 100));
    } else {
      cgstRate = rate / 2;
      sgstRate = rate / 2;
      cgstAmount = round2(taxableValue * (cgstRate / 100));
      sgstAmount = round2(taxableValue * (sgstRate / 100));
    }

    const lineTax = round2(cgstAmount + sgstAmount + igstAmount);
    const lineTotal = round2(taxableValue + lineTax);

    return {
      index: idx + 1,
      productId: item.productId,
      productName: item.productName || item.name || 'Product',
      sku: item.sku || '',
      barcode: item.barcode || '',
      hsnCode: item.hsnCode || '21050000',
      uomName: item.uomName || item.uom || 'PCS',
      quantity: qty,
      unitPrice,
      grossAmount: gross,
      discountPercent: discPercent,
      discountAmount: lineDiscount,
      taxableValue,
      gstRate: rate,
      cgstRate,
      cgstAmount,
      sgstRate,
      sgstAmount,
      igstRate,
      igstAmount,
      totalTax: lineTax,
      lineTotal,
      batchId: item.batchId || null,
      batchNo: item.batchNo || null,
      mfgDate: item.mfgDate || null,
      expiryDate: item.expiryDate || null,
    };
  });

  const rawTaxableSubtotal = round2(processedItems.reduce((acc, it) => acc + it.taxableValue, 0));

  // 3. Proportionate Invoice Discount Allocation
  const invDiscount = Math.max(0, Number(invoiceDiscount) || 0);
  const netItemTaxable = Math.max(0, rawTaxableSubtotal - invDiscount);

  // 4. Calculate Additional Charges
  const chargeConfig = [
    { key: 'freight', altKey: 'freight', gstFlag: 'freightGst', label: 'Freight Charges' },
    { key: 'loadingCharges', altKey: 'loading', gstFlag: 'loadingGst', label: 'Loading & Unloading' },
    { key: 'packingCharges', altKey: 'packing', gstFlag: 'packingGst', label: 'Packing Charges' },
    { key: 'insurance', altKey: 'insurance', gstFlag: 'insuranceGst', label: 'Insurance Charges' },
    { key: 'otherCharges', altKey: 'other', gstFlag: 'otherGst', label: 'Other Charges' },
  ];

  const mergedCharges = { ...additionalCharges, ...charges };

  let totalChargesAmount = 0;
  let totalTaxableCharges = 0;
  let chargesCgst = 0;
  let chargesSgst = 0;
  let chargesIgst = 0;

  const processedCharges = {};

  chargeConfig.forEach(ch => {
    const val = Math.max(0, Number(mergedCharges[ch.key] !== undefined ? mergedCharges[ch.key] : mergedCharges[ch.altKey]) || 0);
    const isTaxable = Boolean(mergedCharges[ch.gstFlag] || chargeTaxRates[ch.gstFlag]);
    totalChargesAmount += val;

    let chCgst = 0;
    let chSgst = 0;
    let chIgst = 0;

    if (val > 0 && isTaxable) {
      totalTaxableCharges += val;
      const rate = chargesDefaultGstRate;
      if (isInterState) {
        chIgst = round2(val * (rate / 100));
        chargesIgst += chIgst;
      } else {
        chCgst = round2(val * (rate / 200));
        chSgst = round2(val * (rate / 200));
        chargesCgst += chCgst;
        chargesSgst += chSgst;
      }
    }

    processedCharges[ch.key] = val;
    if (ch.altKey) processedCharges[ch.altKey] = val;
    processedCharges[ch.gstFlag] = isTaxable;
  });

  // 5. Total Taxes
  const itemsCgst = round2(processedItems.reduce((acc, it) => acc + it.cgstAmount, 0));
  const itemsSgst = round2(processedItems.reduce((acc, it) => acc + it.sgstAmount, 0));
  const itemsIgst = round2(processedItems.reduce((acc, it) => acc + it.igstAmount, 0));

  const totalCgst = round2(itemsCgst + chargesCgst);
  const totalSgst = round2(itemsSgst + chargesSgst);
  const totalIgst = round2(itemsIgst + chargesIgst);
  const totalTaxAmount = round2(totalCgst + totalSgst + totalIgst);

  // 6. HSN Summary Generation (Proportionate distribution of invoice discount)
  const hsnMap = {};

  processedItems.forEach(it => {
    const key = `${it.hsnCode}_${it.gstRate}`;
    if (!hsnMap[key]) {
      hsnMap[key] = {
        hsnCode: it.hsnCode,
        gstRate: it.gstRate,
        taxableAmount: 0,
        cgstRate: it.cgstRate,
        cgstAmount: 0,
        sgstRate: it.sgstRate,
        sgstAmount: 0,
        igstRate: it.igstRate,
        igstAmount: 0,
        totalTax: 0,
      };
    }

    // Allocate invoice discount proportionally to HSN taxable amount
    const proportion = rawTaxableSubtotal > 0 ? (it.taxableValue / rawTaxableSubtotal) : 0;
    const discountedTaxable = round2(it.taxableValue - (invDiscount * proportion));

    hsnMap[key].taxableAmount = round2(hsnMap[key].taxableAmount + discountedTaxable);
    hsnMap[key].cgstAmount = round2(hsnMap[key].cgstAmount + it.cgstAmount);
    hsnMap[key].sgstAmount = round2(hsnMap[key].sgstAmount + it.sgstAmount);
    hsnMap[key].igstAmount = round2(hsnMap[key].igstAmount + it.igstAmount);
    hsnMap[key].totalTax = round2(hsnMap[key].totalTax + it.totalTax);
  });

  // If there are taxable charges, add them to HSN summary under General Services (9965 / 9967)
  if (totalTaxableCharges > 0) {
    const chargeKey = `9965_${chargesDefaultGstRate}`;
    if (!hsnMap[chargeKey]) {
      hsnMap[chargeKey] = {
        hsnCode: '9965',
        gstRate: chargesDefaultGstRate,
        taxableAmount: 0,
        cgstRate: isInterState ? 0 : chargesDefaultGstRate / 2,
        cgstAmount: 0,
        sgstRate: isInterState ? 0 : chargesDefaultGstRate / 2,
        sgstAmount: 0,
        igstRate: isInterState ? chargesDefaultGstRate : 0,
        igstAmount: 0,
        totalTax: 0,
      };
    }
    hsnMap[chargeKey].taxableAmount = round2(hsnMap[chargeKey].taxableAmount + totalTaxableCharges);
    hsnMap[chargeKey].cgstAmount = round2(hsnMap[chargeKey].cgstAmount + chargesCgst);
    hsnMap[chargeKey].sgstAmount = round2(hsnMap[chargeKey].sgstAmount + chargesSgst);
    hsnMap[chargeKey].igstAmount = round2(hsnMap[chargeKey].igstAmount + chargesIgst);
    hsnMap[chargeKey].totalTax = round2(hsnMap[chargeKey].totalTax + (chargesCgst + chargesSgst + chargesIgst));
  }

  const hsnSummary = Object.values(hsnMap);

  // 7. Net and Grand Total with Round Off
  const netAmount = round2(
    netItemTaxable +
    totalChargesAmount +
    totalTaxAmount -
    (Number(tdsDeduction) || 0) -
    (Number(creditNoteAdjustment) || 0)
  );

  const roundedGrandTotal = Math.round(netAmount);
  const roundOff = round2(roundedGrandTotal - netAmount);

  return {
    isInterState,
    taxType,
    taxTypeLabel,
    sellerStateCode: resolvedSellerState,
    buyerStateCode: resolvedBuyerState,
    grossLineSubtotal: round2(grossLineSubtotal),
    totalLineDiscounts: round2(totalLineDiscounts),
    rawTaxableSubtotal,
    invoiceDiscount: invDiscount,
    netTaxableSubtotal: netItemTaxable,
    taxableSubtotal: netItemTaxable,
    items: processedItems,
    charges: processedCharges,
    totalChargesAmount: round2(totalChargesAmount),
    totalTaxableCharges: round2(totalTaxableCharges),
    cgst: totalCgst,
    sgst: totalSgst,
    igst: totalIgst,
    taxBreakdown: {
      cgst: totalCgst,
      sgst: totalSgst,
      igst: totalIgst,
      totalTax: totalTaxAmount,
    },
    totalTax: totalTaxAmount,
    tdsDeduction: round2(Number(tdsDeduction) || 0),
    creditNoteAdjustment: round2(Number(creditNoteAdjustment) || 0),
    netAmount,
    roundOff,
    grandTotal: roundedGrandTotal,
    amountInWords: numberToIndianWords(roundedGrandTotal),
    hsnSummary,
  };
}

module.exports = {
  calculateOrderGst,
  calculateGST: calculateOrderGst,
  getStateCodeFromGstin,
  numberToIndianWords,
  round2,
};
