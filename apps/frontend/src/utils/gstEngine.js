/**
 * GST Calculation Engine (Frontend ES Module)
 * Supports Intra-State (CGST + SGST) and Inter-State (IGST)
 * Indian Numbering and Amount in Words (Lakh/Crore)
 */

export function round2(num) {
  return Math.round((Number(num) || 0) * 100) / 100;
}

// Convert numbers to Indian Rupees in words (Lakhs & Crores)
export function numberToIndianWords(amount) {
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
export function getStateCodeFromGstin(gstin) {
  if (!gstin || typeof gstin !== 'string') return null;
  const clean = gstin.trim().replace(/^GSTIN-?/i, '');
  const prefix = clean.substring(0, 2);
  return /^\d{2}$/.test(prefix) ? prefix : null;
}

/**
 * Pure calculation function
 */
export function calculateOrderGst({
  sellerStateCode = '33', // Default Tamil Nadu
  buyerStateCode = null,
  customerGstin = null,
  items = [],
  charges = {},
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
    { key: 'freight', gstFlag: 'freightGst', sac: '9965', label: 'Freight Charges' },
    { key: 'loadingCharges', gstFlag: 'loadingGst', sac: '9967', label: 'Loading & Handling' },
    { key: 'packingCharges', gstFlag: 'packingGst', sac: '9985', label: 'Packing Charges' },
    { key: 'insurance', gstFlag: 'insuranceGst', sac: '9971', label: 'Insurance Charges' },
    { key: 'otherCharges', gstFlag: 'otherGst', sac: '9997', label: 'Other Ancillary Charges' },
  ];

  let totalChargesAmount = 0;
  let totalTaxableCharges = 0;
  let chargesCgst = 0;
  let chargesSgst = 0;
  let chargesIgst = 0;

  const processedCharges = {};

  chargeConfig.forEach(ch => {
    const val = Math.max(0, Number(charges[ch.key]) || 0);
    const isTaxable = Boolean(charges[ch.gstFlag]);
    totalChargesAmount += val;

    let chCgst = 0;
    let chSgst = 0;
    let chIgst = 0;

    const customRate = charges[`${ch.key}Rate`] !== undefined 
      ? Number(charges[`${ch.key}Rate`]) 
      : (charges[`${ch.gstFlag}Rate`] !== undefined ? Number(charges[`${ch.gstFlag}Rate`]) : chargesDefaultGstRate);

    if (val > 0 && isTaxable && customRate > 0) {
      totalTaxableCharges += val;
      const rate = customRate;
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

  // 6b. Add individual taxable charges to HSN summary with specific SAC codes & exact rates
  chargeConfig.forEach(ch => {
    const val = Math.max(0, Number(charges[ch.key]) || 0);
    const isTaxable = Boolean(charges[ch.gstFlag]);
    const customRate = charges[`${ch.key}Rate`] !== undefined 
      ? Number(charges[`${ch.key}Rate`]) 
      : (charges[`${ch.gstFlag}Rate`] !== undefined ? Number(charges[`${ch.gstFlag}Rate`]) : chargesDefaultGstRate);

    if (val > 0 && isTaxable && customRate > 0) {
      const chargeKey = `${ch.sac}_${customRate}`;
      let cCgst = 0;
      let cSgst = 0;
      let cIgst = 0;
      if (isInterState) {
        cIgst = round2(val * (customRate / 100));
      } else {
        cCgst = round2(val * (customRate / 200));
        cSgst = round2(val * (customRate / 200));
      }
      const cTax = round2(cCgst + cSgst + cIgst);

      if (!hsnMap[chargeKey]) {
        hsnMap[chargeKey] = {
          hsnCode: ch.sac,
          gstRate: customRate,
          taxableAmount: 0,
          cgstRate: isInterState ? 0 : customRate / 2,
          cgstAmount: 0,
          sgstRate: isInterState ? 0 : customRate / 2,
          sgstAmount: 0,
          igstRate: isInterState ? customRate : 0,
          igstAmount: 0,
          totalTax: 0,
          description: ch.label
        };
      }
      hsnMap[chargeKey].taxableAmount = round2(hsnMap[chargeKey].taxableAmount + val);
      hsnMap[chargeKey].cgstAmount = round2(hsnMap[chargeKey].cgstAmount + cCgst);
      hsnMap[chargeKey].sgstAmount = round2(hsnMap[chargeKey].sgstAmount + cSgst);
      hsnMap[chargeKey].igstAmount = round2(hsnMap[chargeKey].igstAmount + cIgst);
      hsnMap[chargeKey].totalTax = round2(hsnMap[chargeKey].totalTax + cTax);
    }
  });

  const hsnSummary = Object.values(hsnMap);

  // 6c. Slab Summary Generation (Grouped by GST Rate for elaborate tax breakdown)
  const slabMap = {};
  Object.values(hsnMap).forEach(h => {
    const rate = Number(h.gstRate || 0);
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
    items: processedItems,
    charges: processedCharges,
    totalChargesAmount: round2(totalChargesAmount),
    totalTaxableCharges: round2(totalTaxableCharges),
    cgst: totalCgst,
    sgst: totalSgst,
    igst: totalIgst,
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
 * Flexible wrapper for Billing & Invoicing Pages
 */
export function calculateGST(params = {}) {
  const charges = params.charges || params.additionalCharges || {};
  const chargeRates = params.chargeTaxRates || {};

  const finalCharges = {
    freight: charges.freight || 0,
    freightGst: chargeRates.freightGst !== undefined ? chargeRates.freightGst : charges.freightGst,
    freightRate: charges.freightRate !== undefined ? charges.freightRate : chargeRates.freightRate,
    loadingCharges: charges.loading || charges.loadingCharges || 0,
    loadingGst: chargeRates.loadingGst !== undefined ? chargeRates.loadingGst : charges.loadingGst,
    loadingChargesRate: charges.loadingChargesRate !== undefined ? charges.loadingChargesRate : (charges.loadingRate !== undefined ? charges.loadingRate : chargeRates.loadingRate),
    packingCharges: charges.packing || charges.packingCharges || 0,
    packingGst: chargeRates.packingGst !== undefined ? chargeRates.packingGst : charges.packingGst,
    packingChargesRate: charges.packingChargesRate !== undefined ? charges.packingChargesRate : (charges.packingRate !== undefined ? charges.packingRate : chargeRates.packingRate),
    insurance: charges.insurance || 0,
    insuranceGst: chargeRates.insuranceGst !== undefined ? chargeRates.insuranceGst : charges.insuranceGst,
    insuranceRate: charges.insuranceRate !== undefined ? charges.insuranceRate : chargeRates.insuranceRate,
    otherCharges: charges.other || charges.otherCharges || 0,
    otherGst: chargeRates.otherGst !== undefined ? chargeRates.otherGst : charges.otherGst,
    otherChargesRate: charges.otherChargesRate !== undefined ? charges.otherChargesRate : (charges.otherRate !== undefined ? charges.otherRate : chargeRates.otherRate),
  };

  const result = calculateOrderGst({
    sellerStateCode: params.sellerStateCode,
    buyerStateCode: params.buyerStateCode,
    customerGstin: params.customerGstin,
    items: params.items || [],
    charges: finalCharges,
    invoiceDiscount: params.invoiceDiscount,
    tdsDeduction: params.tdsDeduction,
    creditNoteAdjustment: params.creditNoteAdjustment,
    chargesDefaultGstRate: params.chargesDefaultGstRate || 18,
    placeOfSupply: params.placeOfSupply
  });

  return {
    ...result,
    taxableSubtotal: result.rawTaxableSubtotal,
    taxBreakdown: {
      cgst: result.cgst,
      sgst: result.sgst,
      igst: result.igst,
      totalTax: result.totalTax
    },
    charges: {
      freight: finalCharges.freight,
      loading: finalCharges.loadingCharges,
      packing: finalCharges.packingCharges,
      insurance: finalCharges.insurance,
      other: finalCharges.otherCharges
    },
    totalCharges: result.totalChargesAmount,
    gstSlabs: result.gstSlabs || []
  };
}

/**
 * Helper to compute elaborate GST slabs from an arbitrary order object
 */
export function computeOrderGstSlabs(order = {}, overrideIsInterState = null) {
  if (!order) return [];

  // If already calculated and present
  if (Array.isArray(order.gstSlabs) && order.gstSlabs.length > 0) {
    return order.gstSlabs;
  }
  if (order.gstCalcResult && Array.isArray(order.gstCalcResult.gstSlabs) && order.gstCalcResult.gstSlabs.length > 0) {
    return order.gstCalcResult.gstSlabs;
  }

  const isInterState = overrideIsInterState !== null 
    ? Boolean(overrideIsInterState) 
    : (String(order.placeOfSupply || order.buyerStateCode || '33') !== '33' || order.taxType === 'INTER_STATE' || Boolean(order.igst && Number(order.igst) > 0 && (!order.cgst || Number(order.cgst) === 0)));

  const slabMap = {};

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
    const fRate = Number(order.freightRate || 18);
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

  // Loading charges
  const loadingAmt = Number(order.loadingCharges || 0);
  if (loadingAmt > 0 && order.loadingGst) {
    const lRate = Number(order.loadingChargesRate || order.loadingRate || 18);
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

  // Other charges
  const otherAmt = Number(order.otherCharges || 0);
  if (otherAmt > 0 && order.otherGst) {
    const oRate = Number(order.otherChargesRate || order.otherRate || 18);
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

  return Object.values(slabMap).sort((a, b) => a.rate - b.rate);
}

export const numberToWordsINR = numberToIndianWords;

export function getIndianStates() {
  return [
    { code: '01', name: 'Jammu & Kashmir' },
    { code: '02', name: 'Himachal Pradesh' },
    { code: '03', name: 'Punjab' },
    { code: '04', name: 'Chandigarh' },
    { code: '05', name: 'Uttarakhand' },
    { code: '06', name: 'Haryana' },
    { code: '07', name: 'Delhi' },
    { code: '08', name: 'Rajasthan' },
    { code: '09', name: 'Uttar Pradesh' },
    { code: '10', name: 'Bihar' },
    { code: '11', name: 'Sikkim' },
    { code: '12', name: 'Arunachal Pradesh' },
    { code: '13', name: 'Nagaland' },
    { code: '14', name: 'Manipur' },
    { code: '15', name: 'Mizoram' },
    { code: '16', name: 'Tripura' },
    { code: '17', name: 'Meghalaya' },
    { code: '18', name: 'Assam' },
    { code: '19', name: 'West Bengal' },
    { code: '20', name: 'Jharkhand' },
    { code: '21', name: 'Odisha' },
    { code: '22', name: 'Chhattisgarh' },
    { code: '23', name: 'Madhya Pradesh' },
    { code: '24', name: 'Gujarat' },
    { code: '26', name: 'Dadra & Nagar Haveli and Daman & Diu' },
    { code: '27', name: 'Maharashtra' },
    { code: '29', name: 'Karnataka' },
    { code: '30', name: 'Goa' },
    { code: '31', name: 'Lakshadweep' },
    { code: '32', name: 'Kerala' },
    { code: '33', name: 'Tamil Nadu' },
    { code: '34', name: 'Puducherry' },
    { code: '35', name: 'Andaman & Nicobar Islands' },
    { code: '36', name: 'Telangana' },
    { code: '37', name: 'Andhra Pradesh' },
    { code: '38', name: 'Ladakh' },
    { code: '97', name: 'Other Territory' }
  ];
}
