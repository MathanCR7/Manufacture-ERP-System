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
 * Parse ancillary tax codes from order object or embedded internal note
 */
function getOrderAncillaryTaxCodes(order = {}) {
  let codes = order.ancillaryTaxCodes || {};
  if ((!codes || Object.keys(codes).length === 0) && order.internalNote && order.internalNote.includes('[[ANCILLARY_TAX_CODES:')) {
    try {
      const match = order.internalNote.match(/\[\[ANCILLARY_TAX_CODES:(.*?)\]\]/s);
      if (match && match[1]) codes = JSON.parse(match[1]);
    } catch (e) {}
  }
  return codes;
}

/**
 * Extract numerical tax percentage from tax code
 */
function getTaxRateFromCode(code, fallback = 0) {
  if (code === undefined || code === null || code === '') return fallback;
  if (typeof code === 'number') return code;
  const c = String(code).trim().toUpperCase();
  if (c === 'EXEMPT' || c === 'NIL' || c === 'ZERO' || c === '0%' || c === 'GST0' || c === 'NO_GST') return 0;
  if (c.includes('28')) return 28;
  if (c.includes('18')) return 18;
  if (c.includes('12')) return 12;
  if (c.includes('5')) return 5;
  const num = parseFloat(c.replace(/[^0-9.]/g, ''));
  return isNaN(num) ? fallback : num;
}

/**
 * Format charge label with exact percentage based on supply type (IGST vs CGST/SGST)
 */
function formatChargeGstLabel(baseLabel, rate, isInterState) {
  const r = Number(rate) || 0;
  if (r <= 0) {
    return `${baseLabel} (Exempt 0%)`;
  }
  if (isInterState) {
    return `${baseLabel} (${r}% IGST)`;
  }
  const half = Math.round((r / 2) * 100) / 100;
  return `${baseLabel} (CGST ${half}% + SGST ${half}%)`;
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
    { key: 'freight', altKey: 'freight', gstFlag: 'freightGst', rateKey: 'freightRate', codeKey: 'freightTaxCode', label: 'Freight Charges' },
    { key: 'loadingCharges', altKey: 'loading', gstFlag: 'loadingGst', rateKey: 'loadingRate', codeKey: 'loadingTaxCode', label: 'Loading & Unloading' },
    { key: 'packingCharges', altKey: 'packing', gstFlag: 'packingGst', rateKey: 'packingRate', codeKey: 'packingTaxCode', label: 'Packing Charges' },
    { key: 'insurance', altKey: 'insurance', gstFlag: 'insuranceGst', rateKey: 'insuranceRate', codeKey: 'insuranceTaxCode', label: 'Insurance Charges' },
    { key: 'otherCharges', altKey: 'other', gstFlag: 'otherGst', rateKey: 'otherRate', codeKey: 'otherTaxCode', label: 'Other Charges' },
  ];

  const mergedCharges = { ...additionalCharges, ...charges };

  let totalChargesAmount = 0;
  let totalTaxableCharges = 0;
  let chargesCgst = 0;
  let chargesSgst = 0;
  let chargesIgst = 0;

  const processedCharges = {};
  const chargeHsnEntries = [];

  chargeConfig.forEach(ch => {
    const val = Math.max(0, Number(mergedCharges[ch.key] !== undefined ? mergedCharges[ch.key] : mergedCharges[ch.altKey]) || 0);
    
    // Resolve tax rate for this specific charge
    let rate = 0;
    if (chargeTaxRates[ch.rateKey] !== undefined) {
      rate = Number(chargeTaxRates[ch.rateKey]);
    } else if (chargeTaxRates[ch.codeKey]) {
      rate = getTaxRateFromCode(chargeTaxRates[ch.codeKey]);
    } else if (mergedCharges[ch.rateKey] !== undefined) {
      rate = Number(mergedCharges[ch.rateKey]);
    } else if (mergedCharges[ch.codeKey]) {
      rate = getTaxRateFromCode(mergedCharges[ch.codeKey]);
    } else if (mergedCharges[ch.gstFlag] || chargeTaxRates[ch.gstFlag]) {
      rate = chargesDefaultGstRate;
    }

    const isTaxable = rate > 0 && Boolean(mergedCharges[ch.gstFlag] !== false && chargeTaxRates[ch.gstFlag] !== false);
    totalChargesAmount += val;

    let chCgst = 0;
    let chSgst = 0;
    let chIgst = 0;

    if (val > 0 && isTaxable) {
      totalTaxableCharges += val;
      if (isInterState) {
        chIgst = round2(val * (rate / 100));
        chargesIgst += chIgst;
      } else {
        chCgst = round2(val * (rate / 200));
        chSgst = round2(val * (rate / 200));
        chargesCgst += chCgst;
        chargesSgst += chSgst;
      }

      chargeHsnEntries.push({
        hsnCode: '9965',
        gstRate: rate,
        taxableAmount: val,
        cgstRate: isInterState ? 0 : rate / 2,
        cgstAmount: chCgst,
        sgstRate: isInterState ? 0 : rate / 2,
        sgstAmount: chSgst,
        igstRate: isInterState ? rate : 0,
        igstAmount: chIgst,
        totalTax: chCgst + chSgst + chIgst
      });
    }

    processedCharges[ch.key] = val;
    if (ch.altKey) processedCharges[ch.altKey] = val;
    processedCharges[ch.gstFlag] = isTaxable;
    processedCharges[ch.rateKey] = rate;
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

  // Add individual charge entries into HSN summary with their own rate
  chargeHsnEntries.forEach(entry => {
    const chargeKey = `${entry.hsnCode}_${entry.gstRate}`;
    if (!hsnMap[chargeKey]) {
      hsnMap[chargeKey] = {
        hsnCode: entry.hsnCode,
        gstRate: entry.gstRate,
        taxableAmount: 0,
        cgstRate: entry.cgstRate,
        cgstAmount: 0,
        sgstRate: entry.sgstRate,
        sgstAmount: 0,
        igstRate: entry.igstRate,
        igstAmount: 0,
        totalTax: 0,
      };
    }
    hsnMap[chargeKey].taxableAmount = round2(hsnMap[chargeKey].taxableAmount + entry.taxableAmount);
    hsnMap[chargeKey].cgstAmount = round2(hsnMap[chargeKey].cgstAmount + entry.cgstAmount);
    hsnMap[chargeKey].sgstAmount = round2(hsnMap[chargeKey].sgstAmount + entry.sgstAmount);
    hsnMap[chargeKey].igstAmount = round2(hsnMap[chargeKey].igstAmount + entry.igstAmount);
    hsnMap[chargeKey].totalTax = round2(hsnMap[chargeKey].totalTax + entry.totalTax);
  });

  const hsnSummary = Object.values(hsnMap);

  // Group by rate to produce clean gstSlabs
  const slabMap = {};
  hsnSummary.forEach(h => {
    const rate = h.gstRate;
    if (rate <= 0) return;
    const key = String(rate);
    if (!slabMap[key]) {
      slabMap[key] = {
        rate,
        halfRate: round2(rate / 2),
        taxableAmount: 0,
        cgstRate: isInterState ? 0 : round2(rate / 2),
        cgstAmount: 0,
        sgstRate: isInterState ? 0 : round2(rate / 2),
        sgstAmount: 0,
        igstRate: isInterState ? rate : 0,
        igstAmount: 0,
        totalTax: 0,
      };
    }
    slabMap[key].taxableAmount = round2(slabMap[key].taxableAmount + h.taxableAmount);
    slabMap[key].cgstAmount = round2(slabMap[key].cgstAmount + h.cgstAmount);
    slabMap[key].sgstAmount = round2(slabMap[key].sgstAmount + h.sgstAmount);
    slabMap[key].igstAmount = round2(slabMap[key].igstAmount + h.igstAmount);
    slabMap[key].totalTax = round2(slabMap[key].totalTax + h.totalTax);
  });

  const gstSlabs = Object.values(slabMap).sort((a, b) => a.rate - b.rate);

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
    gstSlabs,
  };
}

/**
 * Helper to compute elaborate GST slabs from an arbitrary order object
 */
function computeOrderGstSlabs(order = {}, overrideIsInterState = null) {
  if (!order) return [];

  const isInterState = overrideIsInterState !== null 
    ? Boolean(overrideIsInterState) 
    : (String(order.placeOfSupply || order.buyerStateCode || '33') !== '33' || order.taxType === 'INTER_STATE' || order.taxType === 'Inter-State' || Boolean(order.igst && Number(order.igst) > 0 && (!order.cgst || Number(order.cgst) === 0)));

  const slabMap = {};
  const ancCodes = getOrderAncillaryTaxCodes(order);

  (order.items || []).forEach(it => {
    const qty = Number(it.quantity || it.qty || 1);
    const unitPrice = Number(it.unitPrice || it.rate || it.price || 0);
    const discPct = Number(it.discountPercent || it.discount_percent || 0);
    const discAmt = Number(it.discount || 0);
    const gross = qty * unitPrice;
    const lineDisc = discPct > 0 ? (gross * (discPct / 100)) : discAmt;
    const taxable = Number(it.taxableValue !== undefined ? it.taxableValue : (Number(it.subtotal || 0) || Math.max(0, gross - lineDisc)));
    const rate = Number(it.gstRate !== undefined ? it.gstRate : (it.gst_rate !== undefined ? it.gst_rate : (it.product?.gstRate || 5)));
    if (rate <= 0) return;

    const key = String(rate);
    if (!slabMap[key]) {
      slabMap[key] = {
        rate,
        halfRate: round2(rate / 2),
        taxableAmount: 0,
        cgstRate: isInterState ? 0 : round2(rate / 2),
        cgstAmount: 0,
        sgstRate: isInterState ? 0 : round2(rate / 2),
        sgstAmount: 0,
        igstRate: isInterState ? rate : 0,
        igstAmount: 0,
        totalTax: 0,
      };
    }

    const itemTax = Number(it.taxAmount !== undefined ? it.taxAmount : (taxable * (rate / 100)));
    slabMap[key].taxableAmount = round2(slabMap[key].taxableAmount + taxable);
    if (isInterState) {
      slabMap[key].igstAmount = round2(slabMap[key].igstAmount + itemTax);
    } else {
      slabMap[key].cgstAmount = round2(slabMap[key].cgstAmount + (itemTax / 2));
      slabMap[key].sgstAmount = round2(slabMap[key].sgstAmount + (itemTax / 2));
    }
    slabMap[key].totalTax = round2(slabMap[key].totalTax + itemTax);
  });

  // Freight charges
  const freightAmt = Number(order.freight || 0);
  if (freightAmt > 0 && order.freightGst !== false) {
    const fRate = getTaxRateFromCode(order.freightTaxCode || ancCodes.freightTaxCode, Number(order.freightRate !== undefined ? order.freightRate : 0));
    if (fRate > 0) {
      const key = String(fRate);
      if (!slabMap[key]) {
        slabMap[key] = {
          rate: fRate,
          halfRate: round2(fRate / 2),
          taxableAmount: 0,
          cgstRate: isInterState ? 0 : round2(fRate / 2),
          cgstAmount: 0,
          sgstRate: isInterState ? 0 : round2(fRate / 2),
          sgstAmount: 0,
          igstRate: isInterState ? fRate : 0,
          igstAmount: 0,
          totalTax: 0,
        };
      }
      const fTax = round2(freightAmt * (fRate / 100));
      slabMap[key].taxableAmount = round2(slabMap[key].taxableAmount + freightAmt);
      if (isInterState) {
        slabMap[key].igstAmount = round2(slabMap[key].igstAmount + fTax);
      } else {
        slabMap[key].cgstAmount = round2(slabMap[key].cgstAmount + (fTax / 2));
        slabMap[key].sgstAmount = round2(slabMap[key].sgstAmount + (fTax / 2));
      }
      slabMap[key].totalTax = round2(slabMap[key].totalTax + fTax);
    }
  }

  // Packing charges: Only apply tax on extra packing charges beyond line items already taxed
  const packingLinesSum = (order.items || [])
    .filter(it => it.isPackingCharge || it.is_packing_charge)
    .reduce((sum, it) => sum + (Number(it.subtotal) || (Number(it.quantity || 1) * Number(it.unitPrice || 0))), 0);
  const totalPackingAmt = Number(order.packingCharges || 0);
  const extraPackingAmt = Math.max(0, totalPackingAmt - packingLinesSum);

  if (extraPackingAmt > 0 && order.packingGst !== false) {
    const packingItemRate = order.items?.find(it => it.isPackingCharge || it.is_packing_charge)?.gstRate;
    const pRate = getTaxRateFromCode(order.packingTaxCode || ancCodes.packingTaxCode, Number(order.packingChargesRate || order.packingRate || packingItemRate || 0));
    if (pRate > 0) {
      const key = String(pRate);
      if (!slabMap[key]) {
        slabMap[key] = {
          rate: pRate,
          halfRate: round2(pRate / 2),
          taxableAmount: 0,
          cgstRate: isInterState ? 0 : round2(pRate / 2),
          cgstAmount: 0,
          sgstRate: isInterState ? 0 : round2(pRate / 2),
          sgstAmount: 0,
          igstRate: isInterState ? pRate : 0,
          igstAmount: 0,
          totalTax: 0,
        };
      }
      const pTax = round2(extraPackingAmt * (pRate / 100));
      slabMap[key].taxableAmount = round2(slabMap[key].taxableAmount + extraPackingAmt);
      if (isInterState) {
        slabMap[key].igstAmount = round2(slabMap[key].igstAmount + pTax);
      } else {
        slabMap[key].cgstAmount = round2(slabMap[key].cgstAmount + (pTax / 2));
        slabMap[key].sgstAmount = round2(slabMap[key].sgstAmount + (pTax / 2));
      }
      slabMap[key].totalTax = round2(slabMap[key].totalTax + pTax);
    }
  }

  // Loading charges
  const loadingAmt = Number(order.loadingCharges || 0);
  if (loadingAmt > 0 && order.loadingGst !== false) {
    const lRate = getTaxRateFromCode(order.loadingTaxCode || ancCodes.loadingTaxCode, Number(order.loadingChargesRate || order.loadingRate || 0));
    if (lRate > 0) {
      const key = String(lRate);
      if (!slabMap[key]) {
        slabMap[key] = {
          rate: lRate,
          halfRate: round2(lRate / 2),
          taxableAmount: 0,
          cgstRate: isInterState ? 0 : round2(lRate / 2),
          cgstAmount: 0,
          sgstRate: isInterState ? 0 : round2(lRate / 2),
          sgstAmount: 0,
          igstRate: isInterState ? lRate : 0,
          igstAmount: 0,
          totalTax: 0,
        };
      }
      const lTax = round2(loadingAmt * (lRate / 100));
      slabMap[key].taxableAmount = round2(slabMap[key].taxableAmount + loadingAmt);
      if (isInterState) {
        slabMap[key].igstAmount = round2(slabMap[key].igstAmount + lTax);
      } else {
        slabMap[key].cgstAmount = round2(slabMap[key].cgstAmount + (lTax / 2));
        slabMap[key].sgstAmount = round2(slabMap[key].sgstAmount + (lTax / 2));
      }
      slabMap[key].totalTax = round2(slabMap[key].totalTax + lTax);
    }
  }

  // Other charges
  const otherAmt = Number(order.otherCharges || 0);
  if (otherAmt > 0 && order.otherGst !== false) {
    const oRate = getTaxRateFromCode(order.otherTaxCode || ancCodes.otherTaxCode, Number(order.otherChargesRate || order.otherRate || 0));
    if (oRate > 0) {
      const key = String(oRate);
      if (!slabMap[key]) {
        slabMap[key] = {
          rate: oRate,
          halfRate: round2(oRate / 2),
          taxableAmount: 0,
          cgstRate: isInterState ? 0 : round2(oRate / 2),
          cgstAmount: 0,
          sgstRate: isInterState ? 0 : round2(oRate / 2),
          sgstAmount: 0,
          igstRate: isInterState ? oRate : 0,
          igstAmount: 0,
          totalTax: 0,
        };
      }
      const oTax = round2(otherAmt * (oRate / 100));
      slabMap[key].taxableAmount = round2(slabMap[key].taxableAmount + otherAmt);
      if (isInterState) {
        slabMap[key].igstAmount = round2(slabMap[key].igstAmount + oTax);
      } else {
        slabMap[key].cgstAmount = round2(slabMap[key].cgstAmount + (oTax / 2));
        slabMap[key].sgstAmount = round2(slabMap[key].sgstAmount + (oTax / 2));
      }
      slabMap[key].totalTax = round2(slabMap[key].totalTax + oTax);
    }
  }

  return Object.values(slabMap).sort((a, b) => a.rate - b.rate);
}

module.exports = {
  calculateOrderGst,
  calculateGST: calculateOrderGst,
  getStateCodeFromGstin,
  getOrderAncillaryTaxCodes,
  getTaxRateFromCode,
  formatChargeGstLabel,
  computeOrderGstSlabs,
  numberToIndianWords,
  round2,
};
