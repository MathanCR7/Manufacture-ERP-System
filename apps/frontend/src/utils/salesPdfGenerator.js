import { jsPDF } from 'jspdf';
import { numberToWordsINR, getIndianStates, computeOrderGstSlabs, formatChargeGstLabel, getOrderAncillaryTaxCodes, getTaxRateFromCode } from './gstEngine.js';

// High-resolution cached Rupee symbol canvas data URL to prevent WinAnsi font corruption
let _rupeeLightData = null;
let _rupeeDarkData = null;

function getRupeeDataUrl(isLight = false) {
  if (isLight && _rupeeLightData) return _rupeeLightData;
  if (!isLight && _rupeeDarkData) return _rupeeDarkData;

  try {
    if (typeof document !== 'undefined') {
      const canvas = document.createElement('canvas');
      canvas.width = 128;
      canvas.height = 128;
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, 128, 128);
      ctx.fillStyle = isLight ? '#ffffff' : '#1e1b4b';
      ctx.font = 'bold 96px "Segoe UI", Roboto, "Helvetica Neue", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('₹', 64, 68);

      const data = canvas.toDataURL('image/png');
      if (isLight) _rupeeLightData = data;
      else _rupeeDarkData = data;
      return data;
    }
  } catch (e) {}
  return null;
}

function drawRupeeGlyph(doc, x, y, size = 2.4, isLight = false) {
  const data = getRupeeDataUrl(isLight);
  if (data) {
    try {
      doc.addImage(data, 'PNG', x, y - size + 0.3, size, size);
      return;
    } catch (e) {}
  }
  // Vector stroke fallback
  try {
    doc.saveGraphicsState();
    doc.setDrawColor(isLight ? 255 : 30, isLight ? 255 : 27, isLight ? 255 : 75);
    doc.setLineWidth(size * 0.1);
    const w = size * 0.75;
    const topY = y - size + 0.3;
    const midY = topY + (size * 0.4);
    const botY = y - 0.2;
    doc.line(x, topY, x + w, topY);
    doc.line(x, midY, x + (w * 0.8), midY);
    doc.line(x + (w * 0.2), topY, x + (w * 0.2), midY);
    doc.line(x + (w * 0.2), midY, x + w, botY);
    doc.restoreGraphicsState();
  } catch (e) {}
}

/**
 * Resolves standard full product description hierarchy:
 * [Product Code] - [Category / Subcategory] - [Product Name] ([Base Category])
 * Example: "BG101 - Classic Cream Gallon - Vanilla (Gallon)"
 */
export function formatProductFullName(it) {
  if (!it) return { fullName: 'Item', mainDesc: 'Item', prodName: 'Item', categoryGroup: 'General', baseTagText: '', showBaseTag: false };

  const itemCode = (
    it.productCode ||
    it.systemCode ||
    it.itemCode ||
    it.product?.code ||
    it.product?.sku ||
    it.product?.specifications?.itemCode ||
    it.rawProduct?.code ||
    it.rawProduct?.sku ||
    ''
  ).trim();

  const subcatName = (
    it.subcategoryName ||
    it.subcategory ||
    it.product?.subcategory?.name ||
    (typeof it.product?.subcategory === 'string' ? it.product.subcategory : '') ||
    it.product?.specifications?.category ||
    it.rawProduct?.subcategory?.name ||
    (typeof it.rawProduct?.subcategory === 'string' ? it.rawProduct.subcategory : '') ||
    it.rawProduct?.specifications?.category ||
    ''
  ).trim();

  const baseCat = (
    it.categoryName ||
    it.category ||
    it.product?.category?.name ||
    (typeof it.product?.category === 'string' ? it.product.category : '') ||
    it.product?.specifications?.group ||
    it.product?.base?.name ||
    it.rawProduct?.category?.name ||
    (typeof it.rawProduct?.category === 'string' ? it.rawProduct.category : '') ||
    ''
  ).trim();

  let prodName = (
    it.productName ||
    it.product?.name ||
    it.product?.specifications?.productName ||
    it.itemDescription ||
    ''
  ).trim();

  // Avoid duplicated code/subcategory/base if already prefixed in product name
  if (itemCode && prodName.toLowerCase().startsWith(itemCode.toLowerCase())) {
    prodName = prodName.substring(itemCode.length).replace(/^[\s\-–—:|]+/, '').trim();
  }
  if (subcatName && prodName.toLowerCase().startsWith(subcatName.toLowerCase())) {
    prodName = prodName.substring(subcatName.length).replace(/^[\s\-–—:|]+/, '').trim();
  }
  if (baseCat && prodName.toLowerCase().startsWith(baseCat.toLowerCase())) {
    prodName = prodName.substring(baseCat.length).replace(/^[\s\-–—:|]+/, '').trim();
  }

  // Build main label: [Code] - [Category / Subcategory] - [Product Name]
  const descParts = [];
  if (itemCode) descParts.push(itemCode);
  const mainCategory = subcatName || baseCat;
  if (mainCategory) descParts.push(mainCategory);
  if (prodName) descParts.push(prodName);
  const mainDesc = descParts.length > 0
    ? descParts.join(' - ')
    : (it.productName || it.product?.name || it.itemDescription || 'Finished Goods');

  // Base Category Tag: formatted with smaller font size and muted color if distinct from subcategory
  const showBaseTag = Boolean(
    baseCat &&
    (!subcatName || baseCat.toLowerCase() !== subcatName.toLowerCase())
  );
  const baseTagText = showBaseTag ? ` (${baseCat})` : '';
  const fullName = `${mainDesc}${baseTagText}`;
  const categoryGroup = subcatName || baseCat || 'Other Products';

  return {
    itemCode,
    subcatName,
    baseCat,
    prodName,
    mainDesc,
    showBaseTag,
    baseTagText,
    fullName,
    categoryGroup
  };
}

/**
 * Computes category-wise quantity & variety count bifurcation
 */
export function computeCategoryBifurcation(items = []) {
  const groups = new Map();

  items.forEach(it => {
    const { categoryGroup, prodName, fullName } = formatProductFullName(it);
    const qty = Number(it.quantity || 1);
    const uom = it.uomName || it.product?.unitOfSale || it.product?.unit?.name || 'pcs';

    if (!groups.has(categoryGroup)) {
      groups.set(categoryGroup, {
        category: categoryGroup,
        productNames: new Set(),
        totalQty: 0,
        uoms: new Set()
      });
    }

    const g = groups.get(categoryGroup);
    g.productNames.add(prodName || fullName);
    g.totalQty += qty;
    g.uoms.add(uom);
  });

  const bifurcationList = Array.from(groups.values()).map(g => ({
    category: g.category,
    varietyCount: g.productNames.size,
    totalQty: g.totalQty,
    uom: Array.from(g.uoms).join(', ')
  }));

  const totalVarieties = bifurcationList.reduce((sum, g) => sum + g.varietyCount, 0);
  const totalQty = bifurcationList.reduce((sum, g) => sum + g.totalQty, 0);

  return {
    bifurcationList,
    totalCategories: bifurcationList.length,
    totalVarieties,
    totalQty
  };
}

/**
 * Compiles an Advanced Indian GST Tax Invoice (A4 Portrait)
 * Conforms to Rule 46 of the CGST Rules, 2017 & SAP Commercial Standards
 * Supports:
 * - With Rate (options.showRates = true): Full commercial invoice with GST slabs & totals
 * - Without Rate (options.showRates = false / options.withoutRate = true): Delivery Challan / Dispatch slip with Category Bifurcation & no prices
 */
export function generateA4TaxInvoice(order, companyDetails = {}, options = {}) {
  const showRates = options.showRates !== false && !options.withoutRate;
  const isWithoutRate = !showRates;
  const showCategoryWise = options.withCategoryWise !== undefined
    ? Boolean(options.withCategoryWise)
    : (options.showCategoryWise !== undefined ? Boolean(options.showCategoryWise) : true);

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 12;
  const contentWidth = pageWidth - (margin * 2);

  // Fallback company details (synced live with PostgreSQL /setup/tax)
  const company = {
    name: companyDetails.companyName || 'LEONEX',
    address: companyDetails.companyAddress || 'Factory / Registered Office Address',
    gstin: companyDetails.companyGstin || companyDetails.taxRegNo || '33AAWCS2781F1ZZ',
    pan: companyDetails.companyPan || 'AAWCS2781F',
    mobile: companyDetails.companyMobile || companyDetails.mobile || '+91 99404 54154',
    stateCode: companyDetails.stateCode || (companyDetails.companyGstin ? companyDetails.companyGstin.substring(0, 2) : '33'),
    terms: companyDetails.invoiceTerms || companyDetails.termsAndConditions || '1. Goods once sold will not be taken back without valid QC inspection.\n2. Interest @ 18% p.a. will be charged if payment is delayed beyond due date.\n3. Subject to jurisdiction only.'
  };

  const sellerState = company.stateCode || (company.gstin ? company.gstin.substring(0, 2) : '33');
  const buyerState = order.buyerStateCode || (order.customer?.gstin ? order.customer.gstin.substring(0, 2) : sellerState);
  const isInterState = String(sellerState) !== String(buyerState);

  const docNo = order.docNo || order.referenceNo || 'SO0001262711';
  const rawNoUpper = String(docNo).toUpperCase();
  const rawTypeUpper = String(order.type || '').toUpperCase();
  const rawModeUpper = String(order.orderMode || '').toUpperCase();

  const isQuotation = rawTypeUpper === 'QUOTATION' || rawModeUpper === 'QUOTATION' || rawNoUpper.startsWith('QT');
  const isInvoice = rawTypeUpper === 'INVOICE' || rawTypeUpper === 'TAX INVOICE' || rawModeUpper === 'INVOICE' || rawNoUpper.startsWith('INV');

  const docTitle = isWithoutRate
    ? (isQuotation ? 'QUOTATION - DISPATCH ESTIMATE' : 'DELIVERY CHALLAN / DISPATCH SLIP')
    : (isQuotation ? 'QUOTATION' : (isInvoice ? 'TAX INVOICE' : 'SALES ORDER'));

  // Top Accent Banner
  doc.setFillColor(30, 27, 75);
  doc.rect(0, 0, pageWidth, 5, 'F');
  doc.setFillColor(79, 70, 229);
  doc.rect(0, 5, pageWidth, 1.5, 'F');

  let curY = 16;

  const quotationLabel = isWithoutRate
    ? `Challan / Order Ref: ${docNo}`
    : (isQuotation 
        ? `Quotation No: ${docNo}` 
        : (isInvoice ? `Invoice No: ${docNo}` : `Sales Order No: ${docNo}`));

  // Header Title & Document Identifier
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(30, 27, 75);
  doc.text(docTitle, margin, curY);

  // Directly below QUOTATION, display the Quotation No. responsively
  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(79, 70, 229);
  doc.text(quotationLabel, margin, curY + 5.5);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text(`Date: ${new Date(order.createdAt || Date.now()).toLocaleDateString('en-GB')} • (Original for Recipient)`, margin, curY + 10);

  // Company Information (Right aligned)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text(company.name.toUpperCase(), pageWidth - margin, curY - 2, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  const compAddrLines = doc.splitTextToSize(company.address, 78);
  doc.text(compAddrLines, pageWidth - margin, curY + 2.5, { align: 'right' });

  const addrOffset = compAddrLines.length * 3.8;
  doc.setFont('helvetica', 'bold');
  doc.text(`GSTIN: ${company.gstin} | PAN: ${company.pan}`, pageWidth - margin, curY + 2.5 + addrOffset, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.text(`State Code: ${sellerState} | Mobile: ${company.mobile}`, pageWidth - margin, curY + 6.5 + addrOffset, { align: 'right' });

  curY = Math.max(curY + 16, curY + 9 + addrOffset);

  // Document Details Header Bar
  doc.setFillColor(241, 245, 249);
  doc.rect(margin, curY, contentWidth, 7.5, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.rect(margin, curY, contentWidth, 7.5, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);

  const invoiceDate = new Date(order.createdAt || Date.now()).toLocaleDateString('en-GB');
  const ownerName = order.owner || order.creator?.name || order.cashierName || 'Administrator';
  const paymentTermsVal = order.paymentTerms || (order.paymentStatus === 'PAID' ? 'PAID' : 'Net 30');
  const isPaid = String(paymentTermsVal).toUpperCase() === 'PAID' || String(order.paymentStatus).toUpperCase() === 'PAID' || (Number(order.amountPaid || 0) >= Number(order.grandTotal || 0) && Number(order.grandTotal || 0) > 0);

  doc.text(`Doc No: `, margin + 3, curY + 5);
  doc.setTextColor(15, 23, 42);
  doc.text(docNo, margin + 15, curY + 5);

  doc.setTextColor(71, 85, 105);
  doc.text(`Date: `, margin + 48, curY + 5);
  doc.setTextColor(15, 23, 42);
  doc.text(invoiceDate, margin + 56, curY + 5);

  if (isWithoutRate) {
    doc.setTextColor(71, 85, 105);
    doc.text(`Pricing Mode: `, margin + 85, curY + 5);
    doc.setTextColor(16, 120, 40);
    doc.text('DISPATCH COPY (WITHOUT RATES)', margin + 104, curY + 5);

    doc.setTextColor(71, 85, 105);
    doc.text(`Status: `, margin + 150, curY + 5);
    doc.setTextColor(15, 23, 42);
    doc.text(String(order.status || 'READY FOR DISPATCH').substring(0, 16), margin + 160, curY + 5);
  } else {
    doc.setTextColor(71, 85, 105);
    doc.text(`Payment Status: `, margin + 85, curY + 5);
    doc.setTextColor(isPaid ? 16 : 180, isPaid ? 120 : 60, isPaid ? 40 : 40);
    doc.text(isPaid ? 'PAID' : (order.paymentStatus || 'PENDING'), margin + 108, curY + 5);

    doc.setTextColor(71, 85, 105);
    doc.text(`Payment Terms: `, margin + 132, curY + 5);
    doc.setTextColor(15, 23, 42);
    doc.text(String(paymentTermsVal).substring(0, 28), margin + 154, curY + 5);
  }

  curY += 10.5;

  // Info Cards (Two Columns: Left = Bill To, Right = Ship To & Logistics)
  const colW = (contentWidth - 6) / 2;
  const cardH = 36;

  // Left Card: Buyer / Bill To
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(margin, curY, colW, cardH, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(79, 70, 229);
  doc.text('BILLED TO (BUYER):', margin + 3.5, curY + 5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  const customerName = order.customerName || order.customer?.name || 'Customer';
  doc.text(customerName.substring(0, 36), margin + 3.5, curY + 9.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  const billAddr = order.billToAddress || order.deliveryAddress || order.customer?.billingAddress || order.customer?.address || 'Salem Counter Store';
  const buyerAddrLines = doc.splitTextToSize(billAddr, colW - 7);
  doc.text(buyerAddrLines.slice(0, 2), margin + 3.5, curY + 13.5);

  const buyerGstin = order.customer?.gstin || order.taxRegNo || 'UNREGISTERED';
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 27, 75);
  doc.text(`GSTIN / UIN: ${buyerGstin}`, margin + 3.5, curY + 23);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(`Place of Supply: State Code ${buyerState} (${isInterState ? 'Inter-State' : 'Intra-State'})`, margin + 3.5, curY + 27);
  doc.text(`Contact: ${order.customerPhone || order.customer?.phone || order.contactPerson || '-'}`, margin + 3.5, curY + 31);

  // Right Card: Ship To & Transport Logistics
  const rightX = margin + colW + 6;
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(rightX, curY, colW, cardH, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(79, 70, 229);
  doc.text('SHIPPED TO & DISPATCH LOGISTICS:', rightX + 3.5, curY + 5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  const shipAddr = order.shipToAddress || order.deliveryAddress || billAddr;
  const shipAddrLines = doc.splitTextToSize(`Dest: ${shipAddr}`, colW - 7);
  doc.text(shipAddrLines.slice(0, 2), rightX + 3.5, curY + 9.5);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(`Method: ${order.shippingMethod || 'Road Transport'}`, rightX + 3.5, curY + 19);
  doc.text(`Transporter: ${order.transporterName || '-'}`, rightX + 3.5, curY + 23);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(`Vehicle No: ${order.vehicleNo || order.vehicleNumber || '-'}`, rightX + 3.5, curY + 27);
  doc.text(`LR / Docket: ${order.lrNo || '-'} | E-Way: ${order.ewayBillNo || order.eWayBillNumber || '-'}`, rightX + 3.5, curY + 31);

  curY += cardH + 5;

  // Items Table Header
  // With Rate: 10 columns (186mm)
  // Without Rate: 4 columns (186mm)
  const cols = showRates ? [
    { id: 'idx', label: '#', w: 6, align: 'center' },
    { id: 'desc', label: 'Description of Goods & Batch', w: 76, align: 'left' },
    { id: 'qty', label: 'Qty', w: 11, align: 'right' },
    { id: 'unit', label: 'Unit', w: 10, align: 'center' },
    { id: 'rate', label: 'Rate', hasRupee: true, w: 15, align: 'right' },
    { id: 'disc', label: 'Disc', w: 10, align: 'right' },
    { id: 'taxable', label: 'Taxable', hasRupee: true, w: 18, align: 'right' },
    { id: 'gstRate', label: isInterState ? 'IGST %' : 'GST %', w: 10, align: 'center' },
    { id: 'gstAmt', label: 'GST', hasRupee: true, w: 14, align: 'right' },
    { id: 'total', label: 'Total', hasRupee: true, w: 16, align: 'right' }
  ] : [
    { id: 'idx', label: '#', w: 8, align: 'center' },
    { id: 'desc', label: 'Description of Goods & Batch', w: 134, align: 'left' },
    { id: 'qty', label: 'Quantity', w: 24, align: 'right' },
    { id: 'unit', label: 'Unit', w: 20, align: 'center' }
  ];

  const renderTableHeader = (headerY) => {
    doc.setFillColor(30, 27, 75);
    doc.rect(margin, headerY, contentWidth, 7, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(255, 255, 255);

    let headerX = margin;
    cols.forEach(c => {
      if (c.hasRupee) {
        const prefix = `${c.label} (`;
        const prefixW = doc.getTextWidth(prefix);
        const rupeeW = 2.4;
        const closeW = doc.getTextWidth(')');
        const totalHeaderW = prefixW + rupeeW + closeW;

        const startX = c.align === 'right' 
          ? headerX + c.w - totalHeaderW - 1.5 
          : (c.align === 'center' ? headerX + (c.w - totalHeaderW) / 2 : headerX + 1.5);

        doc.text(prefix, startX, headerY + 4.8);
        drawRupeeGlyph(doc, startX + prefixW + 0.2, headerY + 4.8, 2.3, true);
        doc.text(')', startX + prefixW + rupeeW + 0.4, headerY + 4.8);
      } else {
        const textX = c.align === 'right' ? headerX + c.w - 1.5 : (c.align === 'center' ? headerX + (c.w / 2) : headerX + 1.5);
        doc.text(c.label, textX, headerY + 4.8, { align: c.align });
      }
      headerX += c.w;
    });
  };

  const renderContinuationHeader = () => {
    doc.addPage();
    // Top subtle accent bar
    doc.setFillColor(30, 27, 75);
    doc.rect(0, 0, pageWidth, 2.5, 'F');

    // Continuation Title & Reference
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(30, 27, 75);
    const contDocNo = order.docNo || order.referenceNo || '';
    doc.text(`${docTitle} — ${contDocNo} (Continued)`, margin, 9.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    const custName = (order.customer?.name || order.customerName || '').substring(0, 42);
    if (custName) {
      doc.text(`Customer: ${custName}`, pageWidth - margin, 9.5, { align: 'right' });
    }

    const nextHeaderY = 12.5;
    renderTableHeader(nextHeaderY);
    curY = nextHeaderY + 7;
  };

  // Render initial table header on Page 1
  renderTableHeader(curY);
  curY += 7;

  // Items Table Rows: filter out items marked as packing charge so they appear only in the summary
  const printableItems = (order.items || []).filter(it => !it.isPackingCharge && !it.is_packing_charge);
  const items = printableItems;
  let totalTaxableValue = 0;
  let computedGstTotal = 0;

  if (items.length === 0) {
    const rowH = 9.5;
    doc.setFillColor(248, 250, 252);
    doc.rect(margin, curY, contentWidth, rowH, 'F');
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text('No merchandise goods line items. Packing, logistics and service charges itemized in summary below.', margin + 4, curY + 6);
    curY += rowH;
  } else {
    items.forEach((it, idx) => {
      const rowH = 9.5;
      // Utilize full page down to bottom margin (16mm threshold)
      if (curY + rowH > pageHeight - 16) {
        renderContinuationHeader();
      }

      if (idx % 2 === 1) {
        doc.setFillColor(248, 250, 252);
        doc.rect(margin, curY, contentWidth, rowH, 'F');
      }

    const qty = Number(it.quantity || 1);
    const unitPrice = Number(it.unitPrice || 0);
    const discPct = Number(it.discountPercent || 0);
    const discAmt = Number(it.discount || (unitPrice * (discPct / 100)));
    const taxable = Math.max(0, (unitPrice - discAmt) * qty);
    totalTaxableValue += taxable;

    const gstRate = Number(it.gstRate !== undefined ? it.gstRate : 5);
    const taxAmt = taxable * (gstRate / 100);
    computedGstTotal += taxAmt;
    const lineTotal = taxable + taxAmt;

    const batchStr = it.batchNo 
      ? `Batch: ${it.batchNo}${it.expiryDate ? ` | Exp: ${new Date(it.expiryDate).toLocaleDateString('en-GB')}` : ''}`
      : (it.batchAllocations && it.batchAllocations.length > 0 
          ? `Batch: ${it.batchAllocations.map(b => b.batchNo).join(', ')}`
          : '');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(15, 23, 42);

    let cellX = margin;

    // 1. Index (cols[0])
    doc.text(String(idx + 1), cellX + (cols[0].w / 2), curY + 4.5, { align: 'center' });
    cellX += cols[0].w;

    // 2. Description of Goods & Batch formatted as: [Code] - [Category / Subcategory] - [Product Name] ([Base Category])
    const { fullName, mainDesc, baseTagText } = formatProductFullName(it);
    const maxDescW = cols[1].w - 3;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    const mainW = doc.getTextWidth(mainDesc);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.2);
    const baseW = baseTagText ? doc.getTextWidth(baseTagText) : 0;

    if (batchStr) {
      if (mainW + baseW <= maxDescW) {
        // Line 1: Main description + Base tag inline
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(15, 23, 42);
        doc.text(mainDesc, cellX + 1.5, curY + 4);

        if (baseTagText) {
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(6.2);
          doc.setTextColor(100, 116, 139);
          doc.text(baseTagText, cellX + 1.5 + mainW, curY + 4);
        }

        // Line 2: Batch details
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.5);
        doc.setTextColor(100, 116, 139);
        doc.text(batchStr.substring(0, 58), cellX + 1.5, curY + 7.5);
      } else {
        // If inline doesn't fit on line 1, truncate mainDesc and place base tag on line 2
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(15, 23, 42);
        const truncatedMain = doc.splitTextToSize(mainDesc, maxDescW)[0];
        doc.text(truncatedMain, cellX + 1.5, curY + 4);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.2);
        doc.setTextColor(100, 116, 139);
        const subCombined = [baseTagText.trim(), batchStr].filter(Boolean).join('  |  ');
        doc.text(subCombined.substring(0, 58), cellX + 1.5, curY + 7.5);
      }
    } else {
      if (mainW + baseW <= maxDescW) {
        // Single row centered: Main description + Base tag inline
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(15, 23, 42);
        doc.text(mainDesc, cellX + 1.5, curY + 5.5);

        if (baseTagText) {
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(6.2);
          doc.setTextColor(100, 116, 139);
          doc.text(baseTagText, cellX + 1.5 + mainW, curY + 5.5);
        }
      } else {
        // Multi-line without batch
        if (mainW <= maxDescW) {
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(7.5);
          doc.setTextColor(15, 23, 42);
          doc.text(mainDesc, cellX + 1.5, curY + 3.8);

          doc.setFont('helvetica', 'normal');
          doc.setFontSize(6.2);
          doc.setTextColor(100, 116, 139);
          doc.text(baseTagText.trim(), cellX + 1.5, curY + 7.2);
        } else {
          const descLines = doc.splitTextToSize(mainDesc, maxDescW);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(7.5);
          doc.setTextColor(15, 23, 42);
          doc.text(descLines[0], cellX + 1.5, curY + 3.8);

          doc.setFont('helvetica', 'normal');
          doc.setFontSize(6.8);
          doc.setTextColor(71, 85, 105);
          const secondLine = `${descLines[1] || ''}${baseTagText ? ' ' + baseTagText.trim() : ''}`.trim();
          doc.text(secondLine.substring(0, 55), cellX + 1.5, curY + 7.2);
        }
      }
    }
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(15, 23, 42);
    cellX += cols[1].w;

    // 3. Quantity (cols[2])
    doc.setFont('helvetica', 'bold');
    doc.text(String(qty), cellX + cols[2].w - 1.5, curY + 4.5, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    cellX += cols[2].w;

    // 4. Unit (cols[3])
    const uom = it.uomName || it.product?.unitOfSale || it.product?.unit?.name || 'pcs';
    doc.text(uom, cellX + (cols[3].w / 2), curY + 4.5, { align: 'center' });
    cellX += cols[3].w;

    if (showRates) {
      // 5. Rate (cols[4])
      doc.text(unitPrice.toFixed(2), cellX + cols[4].w - 1.5, curY + 4.5, { align: 'right' });
      cellX += cols[4].w;

      // 6. Discount (cols[5])
      const discDisplay = discPct > 0 ? `${discPct}%` : (discAmt > 0 ? discAmt.toFixed(1) : '-');
      doc.text(discDisplay, cellX + cols[5].w - 1.5, curY + 4.5, { align: 'right' });
      cellX += cols[5].w;

      // 7. Taxable Value (cols[6])
      doc.text(taxable.toFixed(2), cellX + cols[6].w - 1.5, curY + 4.5, { align: 'right' });
      cellX += cols[6].w;

      // 8. GST Rate (cols[7])
      doc.text(`${gstRate}%`, cellX + (cols[7].w / 2), curY + 4.5, { align: 'center' });
      cellX += cols[7].w;

      // 9. GST Amount (cols[8])
      doc.text(taxAmt.toFixed(2), cellX + cols[8].w - 1.5, curY + 4.5, { align: 'right' });
      cellX += cols[8].w;

      // 10. Total Amount (cols[9])
      doc.setFont('helvetica', 'bold');
      doc.text(lineTotal.toFixed(2), cellX + cols[9].w - 1.5, curY + 4.5, { align: 'right' });
    }

    curY += rowH;
  });
  }

  // Table bottom border
  doc.setDrawColor(226, 232, 240);
  doc.line(margin, curY, pageWidth - margin, curY);
  curY += 4;

  // ── CATEGORY-WISE SUMMARY & QUANTITY BIFURCATION ──
  const { bifurcationList, totalCategories, totalVarieties, totalQty } = computeCategoryBifurcation(items);

  if (showCategoryWise && bifurcationList.length > 0) {
    const bifTableHeight = 8 + 4 + 7 + (bifurcationList.length * 7) + 7 + 4;
    if (curY + bifTableHeight > pageHeight - 16) {
      doc.addPage();
      doc.setFillColor(30, 27, 75);
      doc.rect(0, 0, pageWidth, 2.5, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(30, 27, 75);
      doc.text(`${docTitle} — ${order.docNo || order.referenceNo || ''} (Category Summary)`, margin, 9.5);
      curY = 14;
    }

    // Total Tally Strip
    doc.setFillColor(241, 245, 249);
    doc.rect(margin, curY, contentWidth, 8, 'F');
    doc.setDrawColor(203, 213, 225);
    doc.rect(margin, curY, contentWidth, 8, 'S');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(30, 27, 75);
    doc.text(`TOTAL MERCHANDISE ITEMS: ${totalVarieties} Varieties`, margin + 4, curY + 5.2);
    doc.text(`TOTAL QUANTITY DISPATCHED: ${totalQty} Units`, pageWidth - margin - 4, curY + 5.2, { align: 'right' });

    curY += 12;

    // Bifurcation Table Header
    doc.setFillColor(30, 27, 75);
    doc.rect(margin, curY, contentWidth, 7, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(255, 255, 255);

    const bifCols = [
      { label: '#', w: 10, align: 'center' },
      { label: 'Product Category / Flavour Group', w: 106, align: 'left' },
      { label: 'Product Varieties', w: 35, align: 'center' },
      { label: 'Total Dispatched Qty', w: 35, align: 'right' }
    ];

    let bifX = margin;
    bifCols.forEach(c => {
      const textX = c.align === 'right' ? bifX + c.w - 2 : (c.align === 'center' ? bifX + (c.w / 2) : bifX + 2);
      doc.text(c.label, textX, curY + 4.8, { align: c.align });
      bifX += c.w;
    });

    curY += 7;

    // Bifurcation Rows
    bifurcationList.forEach((b, bIdx) => {
      const bRowH = 7;
      if (curY + bRowH > pageHeight - 16) {
        doc.addPage();
        doc.setFillColor(30, 27, 75);
        doc.rect(0, 0, pageWidth, 2.5, 'F');
        curY = 14;
      }

      if (bIdx % 2 === 1) {
        doc.setFillColor(248, 250, 252);
        doc.rect(margin, curY, contentWidth, bRowH, 'F');
      }

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(15, 23, 42);

      let cellBx = margin;
      // 1. Index
      doc.text(String(bIdx + 1), cellBx + (bifCols[0].w / 2), curY + 4.8, { align: 'center' });
      cellBx += bifCols[0].w;

      // 2. Category Name
      doc.setFont('helvetica', 'bold');
      doc.text(b.category, cellBx + 2, curY + 4.8);
      doc.setFont('helvetica', 'normal');
      cellBx += bifCols[1].w;

      // 3. Varieties count
      doc.text(`${b.varietyCount} ${b.varietyCount === 1 ? 'Variety' : 'Varieties'}`, cellBx + (bifCols[2].w / 2), curY + 4.8, { align: 'center' });
      cellBx += bifCols[2].w;

      // 4. Total Qty
      doc.setFont('helvetica', 'bold');
      doc.text(`${b.totalQty} ${b.uom}`, cellBx + bifCols[3].w - 2, curY + 4.8, { align: 'right' });
      doc.setFont('helvetica', 'normal');

      curY += bRowH;
    });

    // Bifurcation Total Row
    doc.setFillColor(241, 245, 249);
    doc.rect(margin, curY, contentWidth, 7, 'F');
    doc.setDrawColor(203, 213, 225);
    doc.line(margin, curY, pageWidth - margin, curY);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(30, 27, 75);

    let totalBx = margin;
    doc.text('TOTAL', totalBx + (bifCols[0].w / 2), curY + 4.8, { align: 'center' });
    totalBx += bifCols[0].w;
    doc.text(`${totalCategories} Categories`, totalBx + 2, curY + 4.8);
    totalBx += bifCols[1].w;
    doc.text(`${totalVarieties} Varieties`, totalBx + (bifCols[2].w / 2), curY + 4.8, { align: 'center' });
    totalBx += bifCols[2].w;
    doc.text(`${totalQty} Units`, totalBx + bifCols[3].w - 2, curY + 4.8, { align: 'right' });

    curY += 10;
  } else if (isWithoutRate && !showCategoryWise) {
    // When without category wise, still render a neat compact dispatch tally strip
    doc.setFillColor(241, 245, 249);
    doc.rect(margin, curY, contentWidth, 8, 'F');
    doc.setDrawColor(203, 213, 225);
    doc.rect(margin, curY, contentWidth, 8, 'S');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(30, 27, 75);
    doc.text(`TOTAL MERCHANDISE ITEMS: ${totalVarieties} Varieties`, margin + 4, curY + 5.2);
    doc.text(`TOTAL QUANTITY DISPATCHED: ${totalQty} Units`, pageWidth - margin - 4, curY + 5.2, { align: 'right' });

    curY += 12;
  }

  if (isWithoutRate) {
    // Delivery Instructions & Signatures Block
    const sigH = 28;
    if (curY + sigH > pageHeight - 12) {
      doc.addPage();
      doc.setFillColor(30, 27, 75);
      doc.rect(0, 0, pageWidth, 2.5, 'F');
      curY = 15;
    }

    const sigColW = (contentWidth - 6) / 2;

    // Left Box: Receiver's Acknowledgment
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(margin, curY, sigColW, sigH, 2, 2, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(30, 27, 75);
    doc.text("RECEIVER'S ACKNOWLEDGMENT & SEAL:", margin + 3, curY + 5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text('Received the above listed goods in sound condition, correct quantity and verified packaging.', margin + 3, curY + 9, { maxWidth: sigColW - 6 });

    doc.text('Receiver Name: ___________________________', margin + 3, curY + 19);
    doc.text('Sign & Stamp:   ___________________________', margin + 3, curY + 24);

    // Right Box: Dispatcher / Authorized Signatory
    const rSigX = margin + sigColW + 6;
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(rSigX, curY, sigColW, sigH, 2, 2, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(30, 27, 75);
    doc.text(`FOR ${company.name.toUpperCase()}:`, rSigX + 3, curY + 5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text('Dispatched by Warehouse / Cold Storage Logistics Team', rSigX + 3, curY + 9);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(30, 27, 75);
    doc.text('Authorized Signatory / Warehouse Dispatcher', rSigX + (sigColW / 2), curY + 24, { align: 'center' });

    // Page numbers loop for Without Rate documents
    const totalPages = doc.internal.getNumberOfPages();
    for (let p = 1; p <= totalPages; p++) {
      doc.setPage(p);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(148, 163, 184);
      doc.text(`Page ${p} of ${totalPages}`, pageWidth - margin, pageHeight - 6, { align: 'right' });
      doc.text(`Official Dispatch Document • ${order.docNo || order.referenceNo || ''}`, margin, pageHeight - 6);
    }

    return doc.output('blob');
  }

  // Summary & Totals Block (Two Columns: Left = Payment Info & Words, Right = Tax Breakdown & Grand Total)
  const sumColW = (contentWidth - 6) / 2;

  // Extract Payment Details (dynamic based on Payment Mode, NO static bank remittance box)
  let pDetails = order.paymentDetails || {};
  if ((!pDetails || Object.keys(pDetails).length === 0) && order.internalNote && order.internalNote.includes('[[PAYMENT_DETAILS:')) {
    try {
      const match = order.internalNote.match(/\[\[PAYMENT_DETAILS:(.*?)\]\]/s);
      if (match && match[1]) pDetails = JSON.parse(match[1]);
    } catch (e) {}
  }

  const pMethod = order.paymentMethod || order.paymentMode || 'Bank Transfer / NEFT';

  // Compute elaborate GST Slabs & Ancillary tax codes
  const ancCodes = getOrderAncillaryTaxCodes(order);
  const gstSlabs = computeOrderGstSlabs(order, isInterState);
  const freightAmt = Number(order.freight || 0);
  const loadingAmt = Number(order.loadingCharges || 0);
  const packingLinesSum = (order.items || [])
    .filter(it => it.isPackingCharge || it.is_packing_charge)
    .reduce((sum, it) => sum + (Number(it.subtotal) || (Number(it.quantity || 1) * Number(it.unitPrice || 0))), 0);
  const packingAmt = Math.max(Number(order.packingCharges || 0), packingLinesSum);
  const otherAmt = Number(order.otherCharges || 0);
  const discVal = Number(order.discountValue || order.invoiceDiscount || 0);

  // Derive tax rates and dynamic labels for active charges
  const freightRate = getTaxRateFromCode(order.freightTaxCode || ancCodes.freightTaxCode, Number(order.freightRate !== undefined ? order.freightRate : (order.freightGst !== false ? 18 : 0)));
  const packingItemRate = order.items?.find(it => it.isPackingCharge || it.is_packing_charge)?.gstRate;
  const packingRate = getTaxRateFromCode(order.packingTaxCode || ancCodes.packingTaxCode, Number(order.packingChargesRate || order.packingRate || packingItemRate || 5));
  const loadingRate = getTaxRateFromCode(order.loadingTaxCode || ancCodes.loadingTaxCode, Number(order.loadingChargesRate || order.loadingRate || 0));
  const otherRate = getTaxRateFromCode(order.otherTaxCode || ancCodes.otherTaxCode, Number(order.otherChargesRate || order.otherRate || 0));

  const freightLabel = 'Freight & Logistics:';
  const packingLabel = formatChargeGstLabel('Package Charges', packingRate, isInterState);
  const loadingLabel = formatChargeGstLabel('Loading Charges', loadingRate, isInterState);
  const otherLabel = formatChargeGstLabel('Other Charges', otherRate, isInterState);

  // Dynamic Product & Charges calculation for PDF
  const activeChargeNames = [];
  if (packingAmt > 0) activeChargeNames.push('Packing');
  if (loadingAmt > 0) activeChargeNames.push('Loading');
  if (freightAmt > 0) activeChargeNames.push('Freight');
  if (otherAmt > 0) activeChargeNames.push('Other Charges');

  let productAndChargesLabel = 'Total Product Amount:';
  if (activeChargeNames.length === 1) {
    productAndChargesLabel = `Total Product & ${activeChargeNames[0]} Amount:`;
  } else if (activeChargeNames.length === 2) {
    productAndChargesLabel = `Total Product, ${activeChargeNames[0]} & ${activeChargeNames[1]}:`;
  } else if (activeChargeNames.length > 2) {
    productAndChargesLabel = 'Total Product & Charges Amount:';
  } else if (discVal > 0) {
    productAndChargesLabel = 'Net Product Taxable Amount:';
  }

  const hasExtraLines = discVal > 0 || activeChargeNames.length > 0;
  const totalProductAndCharges = Math.max(0, totalTaxableValue - discVal) + freightAmt + loadingAmt + packingAmt + otherAmt;

  const totalSlabTax = gstSlabs.reduce((acc, s) => acc + (s.totalTax || 0), 0);
  const totalCgst = gstSlabs.length > 0 ? gstSlabs.reduce((acc, s) => acc + (s.cgstAmount || 0), 0) : Number(order.cgst || (computedGstTotal / 2));
  const totalSgst = gstSlabs.length > 0 ? gstSlabs.reduce((acc, s) => acc + (s.sgstAmount || 0), 0) : Number(order.sgst || (computedGstTotal / 2));
  const totalIgst = gstSlabs.length > 0 ? gstSlabs.reduce((acc, s) => acc + (s.igstAmount || 0), 0) : Number(order.igst || computedGstTotal);
  const totalGstTax = isInterState ? totalIgst : (totalCgst + totalSgst);

  const exactNetGrand = totalProductAndCharges + totalGstTax;
  const targetRounded = Math.round(exactNetGrand);
  const accurateRoundOff = Math.round((targetRounded - exactNetGrand) * 100) / 100;

  // Safeguard against stale/double-counted database grandTotal (e.g. 946 vs 517):
  const isCloseToDbTotal = Math.abs(Number(order.grandTotal || 0) - targetRounded) <= 1.05;
  const grandTotal = isCloseToDbTotal ? Number(order.grandTotal) : targetRounded;
  const roundOff = isCloseToDbTotal && order.roundOff !== undefined ? Number(order.roundOff) : accurateRoundOff;

  const wordsText = numberToWordsINR(grandTotal);
  const wordsLines = doc.splitTextToSize(wordsText, sumColW - 7);

  let rightRowsCount = 1; // Total Product Amount
  if (freightAmt > 0) rightRowsCount++;
  if (loadingAmt > 0) rightRowsCount++;
  if (packingAmt > 0) rightRowsCount++;
  if (otherAmt > 0) rightRowsCount++;
  if (discVal > 0) rightRowsCount++;
  if (hasExtraLines) rightRowsCount++; // For Total Product & Charges row

  const slabRowCount = gstSlabs.length > 0
    ? (isInterState ? gstSlabs.length : (gstSlabs.length * 2))
    : (isInterState ? 1 : 2);
  rightRowsCount += slabRowCount;
  if (gstSlabs.length > 1) rightRowsCount++; // Total GST row
  if (roundOff !== 0) rightRowsCount++;

  // Dynamic box height: perfectly accommodates all elaborated tax slabs without overflow or collision
  const rightContentH = 8 + (rightRowsCount * 4.4) + 16;
  const leftContentH = 14 + (wordsLines.length * 4) + 24;
  const summaryCardH = Math.max(56, leftContentH, Math.ceil(rightContentH));

  // Check bottom room for totals & summary block
  if (curY > pageHeight - (summaryCardH + 25)) {
    doc.addPage();
    curY = 15;
  }

  // Left Box: Amount in Words & Dynamic Payment Settlement & Declaration
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(margin, curY, sumColW, summaryCardH, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(79, 70, 229);
  doc.text('TOTAL AMOUNT IN WORDS:', margin + 3.5, curY + 5);

  doc.setFont('helvetica', 'bolditalic');
  doc.setFontSize(8);
  doc.setTextColor(30, 27, 75);
  doc.text(wordsLines, margin + 3.5, curY + 9.5);

  const payTop = curY + 9.5 + (wordsLines.length * 4) + 2.5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(79, 70, 229);
  doc.text('PAYMENT & TRANSACTION SETTLEMENT:', margin + 3.5, payTop);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);

  doc.text(`Payment Mode: ${pMethod} • Terms: ${isPaid ? 'PAID' : (order.paymentTerms || 'Net 30')}`, margin + 3.5, payTop + 4.5);

  if (pMethod.includes('Bank')) {
    doc.text(`Payment Settlement: ${isPaid ? 'Fully Settled (PAID)' : 'Direct Bank Remittance / Transfer'}`, margin + 3.5, payTop + 8.5);
    if (pDetails.transactionRef || order.referenceNo) {
      doc.text(`Transaction Ref: ${pDetails.transactionRef || order.referenceNo}`, margin + 3.5, payTop + 12.5);
    }
  } else if (pMethod.includes('UPI')) {
    const upiBits = [];
    if (pDetails.upiId) upiBits.push(`UPI ID: ${pDetails.upiId}`);
    if (pDetails.mobileNo || pDetails.upiPhone) upiBits.push(`Mobile: ${pDetails.mobileNo || pDetails.upiPhone}`);
    if (upiBits.length > 0) doc.text(upiBits.join(' | '), margin + 3.5, payTop + 8.5);
    if (pDetails.utrRef || pDetails.transactionRef) {
      doc.text(`UTR / Ref No: ${pDetails.utrRef || pDetails.transactionRef}`, margin + 3.5, payTop + 12.5);
    }
  } else if (pMethod.includes('Card')) {
    const cardInfo = pDetails.cardLast4 ? `Card A/C: **** **** **** ${pDetails.cardLast4} (${pDetails.cardNetwork || 'Debit/Credit'})` : `Card Payment (${pDetails.cardNetwork || 'Debit/Credit'})`;
    doc.text(cardInfo, margin + 3.5, payTop + 8.5);
    if (pDetails.terminalCode || pDetails.approvalCode) {
      doc.text(`Terminal / Auth: ${pDetails.terminalCode || pDetails.approvalCode}`, margin + 3.5, payTop + 12.5);
    }
  } else {
    doc.text(`Payment Settlement: ${isPaid ? 'Fully Settled (PAID)' : 'Cash / Counter'}`, margin + 3.5, payTop + 8.5);
    if (ownerName) doc.text(`Authorized In-Charge: ${ownerName}`, margin + 3.5, payTop + 12.5);
  }

  // Statutory Declaration
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(6.5);
  doc.setTextColor(100, 116, 139);
  doc.text('Declaration: We declare that this invoice shows the actual price of the goods', margin + 3.5, payTop + 17.5);
  doc.text('described and that all particulars are true and correct.', margin + 3.5, payTop + 20.5);

  // Right Box: Charges & Tax Ledger Breakdown
  const rSumX = margin + sumColW + 6;
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(rSumX, curY, sumColW, summaryCardH, 2, 2, 'FD');

  let rY = curY + 5;
  const printRow = (label, amountNum, isNegative = false, bold = false) => {
    const formatted = `${isNegative ? '- ' : ''}${Math.abs(Number(amountNum) || 0).toFixed(2)}`;
    const rightMarginX = rSumX + sumColW - 3.5;

    // Measurement font settings
    let fSize = bold ? 7.5 : 7.2;
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(fSize);

    const numW = doc.getTextWidth(formatted);
    const glyphW = 2.2;
    const glyphMargin = 2.8;
    const glyphX = rightMarginX - numW - glyphMargin;

    // Strict boundary: clear safe zone of 3.0mm before the Rupee glyph so text NEVER intersects with amount
    const maxLabelW = Math.max(20, glyphX - 3.0 - (rSumX + 3.5));
    let labelW = doc.getTextWidth(label);

    // If label only slightly exceeds (within 10%), try scaling down to 6.8pt font to fit on single line
    if (labelW > maxLabelW && labelW <= maxLabelW * 1.10) {
      fSize = 6.8;
      doc.setFontSize(fSize);
      labelW = doc.getTextWidth(label);
    }

    doc.setTextColor(bold ? 15 : 71, bold ? 23 : 85, bold ? 42 : 105);

    if (labelW > maxLabelW) {
      // Auto-wrap label so it NEVER intersects or collides with the amount column
      const lines = doc.splitTextToSize(label, maxLabelW);

      for (let i = 0; i < lines.length; i++) {
        doc.text(lines[i], rSumX + 3.5, rY + (i * 3.4));
      }

      // Render Rupee glyph and amount aligned with the last line of the multi-line row
      const targetRowY = rY + ((lines.length - 1) * 3.4);
      doc.setFontSize(7.5);
      doc.setFont('helvetica', bold ? 'bold' : 'normal');
      drawRupeeGlyph(doc, glyphX, targetRowY, glyphW, false);
      doc.text(formatted, rightMarginX, targetRowY, { align: 'right' });

      rY += (lines.length * 3.4) + 1.0;
    } else {
      // Single line fits cleanly
      doc.text(label, rSumX + 3.5, rY);

      doc.setFontSize(7.5);
      doc.setFont('helvetica', bold ? 'bold' : 'normal');
      drawRupeeGlyph(doc, glyphX, rY, glyphW, false);
      doc.text(formatted, rightMarginX, rY, { align: 'right' });
      rY += 4.2;
    }
  };

  printRow('Total Product Amount:', totalTaxableValue);

  if (discVal > 0) {
    printRow('Invoice Discount:', discVal, true);
  }

  if (freightAmt > 0) {
    printRow(freightLabel, freightAmt);
  }

  if (packingAmt > 0) {
    printRow(packingLabel, packingAmt);
  }

  if (loadingAmt > 0) {
    printRow(loadingLabel, loadingAmt);
  }

  if (otherAmt > 0) {
    printRow(otherLabel, otherAmt);
  }

  if (hasExtraLines) {
    printRow(productAndChargesLabel, totalProductAndCharges, false, true);
  }

  // Elaborate GST Rate Slabs (CGST / SGST / IGST per slab)
  if (gstSlabs && gstSlabs.length > 0) {
    if (!isInterState) {
      gstSlabs.forEach(slab => {
        printRow(`CGST ${slab.halfRate}%:`, slab.cgstAmount);
        printRow(`SGST ${slab.halfRate}%:`, slab.sgstAmount);
      });
      if (gstSlabs.length > 1) {
        printRow('Total GST Tax:', totalGstTax, false, true);
      }
    } else {
      gstSlabs.forEach(slab => {
        printRow(`IGST ${slab.rate}%:`, slab.igstAmount);
      });
      if (gstSlabs.length > 1) {
        printRow('Total GST Tax:', totalGstTax, false, true);
      }
    }
  } else {
    if (!isInterState) {
      printRow('Central GST (CGST):', totalCgst);
      printRow('State GST (SGST):', totalSgst);
    } else {
      printRow('Integrated GST (IGST):', totalIgst);
    }
  }

  if (roundOff !== 0) {
    printRow('Round Off:', Math.abs(roundOff), roundOff < 0);
  }

  // Grand Total Highlight Ribbon with clean Rupee glyph
  const ribbonY = curY + summaryCardH - 10;
  doc.setFillColor(30, 27, 75);
  doc.rect(rSumX, ribbonY, sumColW, 10, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  doc.text('GRAND TOTAL:', rSumX + 3.5, ribbonY + 6.5);
  const totalNum = grandTotal.toFixed(2);
  const totalNumW = doc.getTextWidth(totalNum);
  const ribbonRight = rSumX + sumColW - 3.5;
  drawRupeeGlyph(doc, ribbonRight - totalNumW - 3.5, ribbonY + 6.7, 3.0, true);
  doc.text(totalNum, ribbonRight, ribbonY + 6.5, { align: 'right' });

  curY += summaryCardH + 5;

  // Custom Order Terms & Conditions (Editable per Order and Saved in Database)
  let orderTermsText = order.termsAndConditions || order.quotationNote || order.invoiceTerms || company.terms;
  if (order.internalNote && order.internalNote.includes('[[TERMS_AND_CONDITIONS:')) {
    try {
      const match = order.internalNote.match(/\[\[TERMS_AND_CONDITIONS:(.*?)\]\]/s);
      if (match && match[1]) {
        try {
          orderTermsText = decodeURIComponent(match[1]);
        } catch (e) {
          orderTermsText = match[1];
        }
      }
    } catch (e) {}
  }

  const termsLines = doc.splitTextToSize(`Terms & Conditions:\n${orderTermsText}`, sumColW);
  const termsH = Math.max(termsLines.length * 3.2, 18);
  if (curY + termsH > pageHeight - 8) {
    doc.addPage();
    curY = 15;
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(100, 116, 139);
  doc.text(termsLines, margin, curY);

  // Signatory Box on Right
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(30, 27, 75);
  doc.text(`For ${company.name.toUpperCase()}`, rSumX + (sumColW / 2), curY, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text('Authorized Signatory / Digitally Signed', rSumX + (sumColW / 2), curY + 14, { align: 'center' });

  // Page numbers loop for With Rate commercial documents
  const totalPages = doc.internal.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(148, 163, 184);
    doc.text(`Page ${p} of ${totalPages}`, pageWidth - margin, pageHeight - 6, { align: 'right' });
    doc.text(`Official Commercial Document • ${order.docNo || order.referenceNo || ''}`, margin, pageHeight - 6);
  }

  return doc.output('blob');
}

/**
 * Compiles a fast 80mm Thermal Receipt for POS Cashier Counter
 * Supports:
 * - With Rate (options.showRates = true): Commercial bill with Qty, Rate, Total and GST
 * - Without Rate (options.showRates = false / options.withoutRate = true): Dispatch slip with formatted product hierarchy, Qty, Unit, and Category-wise Bifurcation (no prices)
 */
export function generateThermalReceipt(order, companyDetails = {}, options = {}) {
  const showRates = options.showRates !== false && !options.withoutRate;
  const isWithoutRate = !showRates;
  const showCategoryWise = options.withCategoryWise !== undefined
    ? Boolean(options.withCategoryWise)
    : (options.showCategoryWise !== undefined ? Boolean(options.showCategoryWise) : true);
  const companyName = companyDetails.companyName || 'RETAIL FACTORY OUTLET';
  const companyAddress = companyDetails.companyAddress || 'Main Outlet, Salem, TN';
  const companyGstin = companyDetails.companyGstin || '33AAAAA0000A1Z5';

  const printableItems = (order.items || []).filter(it => !it.isPackingCharge && !it.is_packing_charge);
  const items = printableItems;

  const { bifurcationList, totalCategories, totalVarieties, totalQty } = computeCategoryBifurcation(items);

  // Table margins & width (80mm standard POS slip)
  const margin = 3.5;
  const tableW = 73; // 80 - 7mm

  // Pre-calculate dynamic row heights to avoid collision and determine exact slip height
  const colDescW = showRates ? 32.5 : 44.5;
  const maxDescTextW = colDescW - 3.0; // 1.5mm inner padding on each side

  const tempDoc = new jsPDF({ unit: 'mm', format: [80, 600] });
  tempDoc.setFont('helvetica', 'normal');
  tempDoc.setFontSize(6.5);

  const preparedItems = items.map(it => {
    const { fullName } = formatProductFullName(it);
    const descLines = tempDoc.splitTextToSize(fullName, maxDescTextW);
    const hasBatch = Boolean(it.batchNo || (it.batchAllocations && it.batchAllocations.length > 0));
    const rowH = Math.max(6.8, (descLines.length * 3.1) + (hasBatch ? 2.8 : 0) + 2.0);
    return { it, fullName, descLines, hasBatch, rowH };
  });

  const itemsTotalH = preparedItems.reduce((acc, p) => acc + p.rowH, 0);

  // Determine state & GST breakdown for thermal commercial calculations
  const sellerState = companyDetails.stateCode || (companyGstin ? companyGstin.substring(0, 2) : '33');
  const buyerState = order.buyerStateCode || (order.customer?.gstin ? order.customer.gstin.substring(0, 2) : sellerState);
  const isInterState = String(sellerState) !== String(buyerState);

  // Compute elaborate GST Slabs & Ancillary tax codes matching A4 standard invoice
  const ancCodes = getOrderAncillaryTaxCodes(order);
  const gstSlabs = computeOrderGstSlabs(order, isInterState);
  const freightAmt = Number(order.freight || 0);
  const loadingAmt = Number(order.loadingCharges || 0);
  const packingLinesSum = (order.items || [])
    .filter(it => it.isPackingCharge || it.is_packing_charge)
    .reduce((sum, it) => sum + (Number(it.subtotal) || (Number(it.quantity || 1) * Number(it.unitPrice || 0))), 0);
  const packingAmt = Math.max(Number(order.packingCharges || 0), packingLinesSum);
  const otherAmt = Number(order.otherCharges || 0);
  const discVal = Number(order.discountValue || order.invoiceDiscount || 0);

  // Derive tax rates and dynamic labels for active charges
  const freightRate = getTaxRateFromCode(order.freightTaxCode || ancCodes.freightTaxCode, Number(order.freightRate !== undefined ? order.freightRate : (order.freightGst !== false ? 18 : 0)));
  const packingItemRate = order.items?.find(it => it.isPackingCharge || it.is_packing_charge)?.gstRate;
  const packingRate = getTaxRateFromCode(order.packingTaxCode || ancCodes.packingTaxCode, Number(order.packingChargesRate || order.packingRate || packingItemRate || 5));
  const loadingRate = getTaxRateFromCode(order.loadingTaxCode || ancCodes.loadingTaxCode, Number(order.loadingChargesRate || order.loadingRate || 0));
  const otherRate = getTaxRateFromCode(order.otherTaxCode || ancCodes.otherTaxCode, Number(order.otherChargesRate || order.otherRate || 0));

  // In printable PDF, omit GST percentage label for freight and logistics
  const freightLabel = 'Freight & Logistics:';
  const packingLabel = formatChargeGstLabel('Package Charges', packingRate, isInterState);
  const loadingLabel = formatChargeGstLabel('Loading Charges', loadingRate, isInterState);
  const otherLabel = formatChargeGstLabel('Other Charges', otherRate, isInterState);

  // Dynamic Product & Charges calculation
  const activeChargeNames = [];
  if (packingAmt > 0) activeChargeNames.push('Packing');
  if (loadingAmt > 0) activeChargeNames.push('Loading');
  if (freightAmt > 0) activeChargeNames.push('Freight');
  if (otherAmt > 0) activeChargeNames.push('Other Charges');

  let productAndChargesLabel = 'Total Product Amount:';
  if (activeChargeNames.length === 1) {
    productAndChargesLabel = `Total Product & ${activeChargeNames[0]} Amount:`;
  } else if (activeChargeNames.length === 2) {
    productAndChargesLabel = `Total Product, ${activeChargeNames[0]} & ${activeChargeNames[1]}:`;
  } else if (activeChargeNames.length > 2) {
    productAndChargesLabel = 'Total Product & Charges Amount:';
  } else if (discVal > 0) {
    productAndChargesLabel = 'Net Product Taxable Amount:';
  }

  const hasExtraLines = discVal > 0 || activeChargeNames.length > 0;
  const thermalItemsTotal = items.reduce((sum, it) => sum + ((Number(it.quantity) || 1) * (Number(it.unitPrice) || 0)), 0);
  const totalProductAndCharges = Math.max(0, thermalItemsTotal - discVal) + freightAmt + loadingAmt + packingAmt + otherAmt;

  const totalSlabTax = gstSlabs.reduce((acc, s) => acc + (s.totalTax || 0), 0);
  const totalCgst = gstSlabs.length > 0 ? gstSlabs.reduce((acc, s) => acc + (s.cgstAmount || 0), 0) : Number(order.cgst || (totalSlabTax / 2));
  const totalSgst = gstSlabs.length > 0 ? gstSlabs.reduce((acc, s) => acc + (s.sgstAmount || 0), 0) : Number(order.sgst || (totalSlabTax / 2));
  const totalIgst = gstSlabs.length > 0 ? gstSlabs.reduce((acc, s) => acc + (s.igstAmount || 0), 0) : Number(order.igst || totalSlabTax);
  const totalGstTax = isInterState ? totalIgst : (totalCgst + totalSgst);

  const exactNetGrand = totalProductAndCharges + totalGstTax;
  const targetRounded = Math.round(exactNetGrand);
  const accurateRoundOff = Math.round((targetRounded - exactNetGrand) * 100) / 100;

  const isCloseToDbTotal = Math.abs(Number(order.grandTotal || 0) - targetRounded) <= 1.05;
  const grandTotal = isCloseToDbTotal ? Number(order.grandTotal) : targetRounded;
  const roundOff = isCloseToDbTotal && order.roundOff !== undefined ? Number(order.roundOff) : accurateRoundOff;

  let thermalRowsCount = 1; // Total Product Amount
  if (discVal > 0) thermalRowsCount++;
  if (freightAmt > 0) thermalRowsCount++;
  if (packingAmt > 0) thermalRowsCount++;
  if (loadingAmt > 0) thermalRowsCount++;
  if (otherAmt > 0) thermalRowsCount++;
  if (hasExtraLines) thermalRowsCount++;

  const slabRowCount = gstSlabs.length > 0
    ? (isInterState ? gstSlabs.length : (gstSlabs.length * 2))
    : (isInterState ? 1 : 2);
  thermalRowsCount += slabRowCount;
  if (gstSlabs.length > 1) thermalRowsCount++;
  if (roundOff !== 0) thermalRowsCount++;

  const summaryBoxH = Math.max(38, 8 + (thermalRowsCount * 3.4) + 18);

  // Calculate overall page height precisely so there is no cut-off or excessive trailing blank space
  let estHeight = 72 + itemsTotalH; // Top header + meta box + items header
  if (showRates) {
    estHeight += summaryBoxH + 25 + (showCategoryWise ? (18 + (bifurcationList.length * 5.5)) : 0);
  } else {
    // Total dispatch summary card (18mm) + Category bifurcation table (18mm + bifLines * 5.5mm) + Signature box (28mm) + footer (10mm)
    estHeight += 18 + (showCategoryWise ? (18 + (bifurcationList.length * 5.5)) : 0) + 28 + 12;
  }
  const dynamicHeight = Math.max(150, Math.ceil(estHeight) + 10);

  const doc = new jsPDF({
    unit: 'mm',
    format: [80, dynamicHeight]
  });

  // Top Dark Accent Stripe
  doc.setFillColor(30, 27, 75);
  doc.rect(0, 0, 80, 2.5, 'F');

  // Outer Border Frame
  doc.setDrawColor(203, 213, 225);
  doc.rect(2, 2, 76, dynamicHeight - 4, 'D');

  let curY = 6.5;

  // Store Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(30, 27, 75);
  doc.text(companyName.toUpperCase().substring(0, 36), 40, curY, { align: 'center' });

  curY += 3.8;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.2);
  doc.setTextColor(71, 85, 105);
  const addrLines = doc.splitTextToSize(companyAddress, 70);
  doc.text(addrLines, 40, curY, { align: 'center' });

  curY += (addrLines.length * 3.0);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(30, 27, 75);
  doc.text(`GSTIN: ${companyGstin}`, 40, curY, { align: 'center' });

  curY += 2.5;

  // Title Badge Pill
  doc.setFillColor(30, 27, 75);
  doc.roundedRect(12, curY, 56, 6, 1.2, 1.2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(255, 255, 255);
  const receiptTitle = showRates ? 'RETAIL TAX INVOICE' : 'DELIVERY DISPATCH SLIP';
  doc.text(receiptTitle, 40, curY + 4.2, { align: 'center' });

  curY += 7.5;
  if (!showRates) {
    doc.setFont('helvetica', 'bolditalic');
    doc.setFontSize(5.8);
    doc.setTextColor(79, 70, 229);
    doc.text('ESTIMATE / DISPATCH COPY  •  WITHOUT RATES', 40, curY, { align: 'center' });
    curY += 3.0;
  }

  // Meta Information Card (Bordered Grid Box)
  const metaBoxY = curY;
  const metaBoxH = order.customer?.name && order.customer.name !== 'Walk-in Retail Customer' ? 19.5 : 15.5;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, metaBoxY, tableW, metaBoxH, 1.5, 1.5, 'FD');

  doc.setFontSize(6.0);
  const metaLeftX = margin + 2.5;
  const metaRightX = margin + 39;
  let metaLineY = metaBoxY + 4.2;

  const dateStr = new Date(order.createdAt || Date.now()).toLocaleString('en-IN', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });

  // Line 1
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 116, 139);
  doc.text('Doc No:', metaLeftX, metaLineY);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(String(order.docNo || order.referenceNo || 'DOC-0001').substring(0, 20), metaLeftX + 9, metaLineY);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 116, 139);
  doc.text('Date:', metaRightX, metaLineY);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  doc.text(dateStr, metaRightX + 6.5, metaLineY);

  // Line 2
  metaLineY += 3.6;
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 116, 139);
  doc.text('Counter:', metaLeftX, metaLineY);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  doc.text(String(order.counterId || 'COUNTER-1'), metaLeftX + 9.5, metaLineY);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 116, 139);
  doc.text('Cashier:', metaRightX, metaLineY);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  doc.text(String(order.cashierName || 'Staff').substring(0, 16), metaRightX + 9.5, metaLineY);

  // Line 3 (Customer info if present)
  if (order.customer?.name && order.customer.name !== 'Walk-in Retail Customer') {
    metaLineY += 3.6;
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(100, 116, 139);
    doc.text('Client:', metaLeftX, metaLineY);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(order.customer.name.substring(0, 22), metaLeftX + 7.5, metaLineY);

    if (order.customer.phone) {
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(100, 116, 139);
      doc.text('Ph:', metaRightX, metaLineY);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(15, 23, 42);
      doc.text(String(order.customer.phone), metaRightX + 5, metaLineY);
    }
  }

  curY = metaBoxY + metaBoxH + 3.5;

  // ─────────────────────────────────────────────────────────────────────────
  // ── ITEMS TABLE: CRISP TABLE-WISE DISPLAY (NO OVERLAP / INTERCEPTIONS) ───
  // ─────────────────────────────────────────────────────────────────────────
  const cols = showRates ? [
    { id: 'idx', label: '#', w: 5.0, align: 'center' },
    { id: 'desc', label: 'ITEM & SPECIFICATION', w: 32.5, align: 'left' },
    { id: 'qty', label: 'QTY', w: 9.5, align: 'right' },
    { id: 'rate', label: 'RATE', w: 11.5, align: 'right' },
    { id: 'total', label: 'TOTAL', w: 14.5, align: 'right' }
  ] : [
    { id: 'idx', label: '#', w: 6.0, align: 'center' },
    { id: 'desc', label: 'ITEM & PRODUCT SPECIFICATION', w: 44.5, align: 'left' },
    { id: 'qty', label: 'QTY', w: 11.5, align: 'right' },
    { id: 'unit', label: 'UNIT', w: 11.0, align: 'center' }
  ];

  // Table Header Row
  const thH = 5.8;
  doc.setFillColor(30, 27, 75);
  doc.rect(margin, curY, tableW, thH, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.2);
  doc.setTextColor(255, 255, 255);

  let hX = margin;
  cols.forEach(c => {
    let tX;
    if (c.align === 'right') {
      tX = hX + c.w - 1.5;
    } else if (c.align === 'center') {
      tX = hX + (c.w / 2);
    } else {
      tX = hX + 1.5;
    }
    doc.text(c.label, tX, curY + 4.0, { align: c.align });
    hX += c.w;
  });

  curY += thH;

  // Table Data Rows
  let subtotal = 0;

  preparedItems.forEach((p, idx) => {
    const { it, descLines, hasBatch, rowH } = p;
    const qty = Number(it.quantity || 1);
    const rate = Number(it.unitPrice || 0);
    const lineTotal = qty * rate;
    subtotal += lineTotal;
    const uom = it.uomName || it.product?.unitOfSale || it.product?.unit?.name || 'pcs';

    // Zebra row background
    if (idx % 2 === 1) {
      doc.setFillColor(248, 250, 252);
      doc.rect(margin, curY, tableW, rowH, 'F');
    }

    // Outer row border line (bottom)
    doc.setDrawColor(226, 232, 240);
    doc.line(margin, curY + rowH, margin + tableW, curY + rowH);

    // Left border & right border
    doc.line(margin, curY, margin, curY + rowH);
    doc.line(margin + tableW, curY, margin + tableW, curY + rowH);

    // Subtle column dividers
    let colDivX = margin;
    cols.forEach((c, cIdx) => {
      colDivX += c.w;
      if (cIdx < cols.length - 1) {
        doc.setDrawColor(238, 242, 246);
        doc.line(colDivX, curY, colDivX, curY + rowH);
      }
    });

    const textY = curY + 3.8;

    // Col 1: Index
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.2);
    doc.setTextColor(71, 85, 105);
    doc.text(String(idx + 1), margin + (cols[0].w / 2), textY, { align: 'center' });

    // Col 2: Item Description (Strictly wrapped, zero collision with Col 3)
    const itemStartX = margin + cols[0].w + 1.5;
    descLines.forEach((dLine, dIdx) => {
      if (dIdx === 0) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6.5);
        doc.setTextColor(15, 23, 42);
      } else {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.0);
        doc.setTextColor(51, 65, 85);
      }
      doc.text(dLine, itemStartX, textY + (dIdx * 3.1));
    });

    // Batch sub-line if available
    if (hasBatch) {
      const batchY = textY + (descLines.length * 3.1);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(5.2);
      doc.setTextColor(100, 116, 139);
      const batchText = `Batch: ${it.batchNo || it.batchAllocations?.[0]?.batchNo || ''}${it.expiryDate ? ` | Exp: ${new Date(it.expiryDate).toLocaleDateString('en-GB')}` : ''}`;
      doc.text(batchText.substring(0, 36), itemStartX, batchY);
    }

    // Col 3: Qty (Bold, right-aligned with safety padding)
    const col3Right = margin + cols[0].w + cols[1].w + cols[2].w - 1.5;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.8);
    doc.setTextColor(15, 23, 42);
    doc.text(String(qty), col3Right, textY, { align: 'right' });

    if (showRates) {
      // Col 4: Rate
      const col4Right = margin + cols[0].w + cols[1].w + cols[2].w + cols[3].w - 1.5;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.2);
      doc.setTextColor(71, 85, 105);
      doc.text(rate.toFixed(1), col4Right, textY, { align: 'right' });

      // Col 5: Total
      const col5Right = margin + tableW - 1.5;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.5);
      doc.setTextColor(15, 23, 42);
      doc.text(lineTotal.toFixed(2), col5Right, textY, { align: 'right' });
    } else {
      // Col 4: Unit (Centered)
      const col4Center = margin + cols[0].w + cols[1].w + cols[2].w + (cols[3].w / 2);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.2);
      doc.setTextColor(71, 85, 105);
      doc.text(uom, col4Center, textY, { align: 'center' });
    }

    curY += rowH;
  });

  curY += 3.5;

  // ─────────────────────────────────────────────────────────────────────────
  // ── TOTAL SUMMARY / FINANCIAL CARD ───────────────────────────────────────
  // ─────────────────────────────────────────────────────────────────────────
  if (showRates) {
    const paymentTermsVal = order.paymentTerms || (order.paymentStatus === 'PAID' ? 'PAID' : 'Net 30');
    const isPaid = String(paymentTermsVal).toUpperCase() === 'PAID' || String(order.paymentStatus).toUpperCase() === 'PAID' || (Number(order.amountPaid || 0) >= grandTotal && grandTotal > 0);
    const paid = Number(order.amountPaid || (isPaid ? grandTotal : 0));
    const balance = Math.max(0, grandTotal - paid);

    // Summary Box
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(margin, curY, tableW, summaryBoxH, 1.5, 1.5, 'FD');

    let sumY = curY + 4.0;
    const lX = margin + 3.0;
    const rX = margin + tableW - 3.0;

    const printRow = (lbl, val, bold = false, sz = 6.2) => {
      doc.setFont('helvetica', bold ? 'bold' : 'normal');
      doc.setFontSize(sz);
      doc.setTextColor(bold ? 15 : 71, bold ? 23 : 85, bold ? 42 : 105);
      doc.text(lbl, lX, sumY);
      doc.text(val, rX, sumY, { align: 'right' });
      sumY += 3.4;
    };

    printRow('Total Product Amount:', `INR ${subtotal.toFixed(2)}`);
    if (discVal > 0) {
      printRow('Invoice Discount:', `- INR ${discVal.toFixed(2)}`);
    }
    if (freightAmt > 0) {
      printRow(freightLabel, `INR ${freightAmt.toFixed(2)}`);
    }
    if (packingAmt > 0) {
      printRow(packingLabel, `INR ${packingAmt.toFixed(2)}`);
    }
    if (loadingAmt > 0) {
      printRow(loadingLabel, `INR ${loadingAmt.toFixed(2)}`);
    }
    if (otherAmt > 0) {
      printRow(otherLabel, `INR ${otherAmt.toFixed(2)}`);
    }
    if (hasExtraLines) {
      printRow(productAndChargesLabel, `INR ${totalProductAndCharges.toFixed(2)}`, true);
    }

    if (gstSlabs && gstSlabs.length > 0) {
      if (!isInterState) {
        gstSlabs.forEach(slab => {
          printRow(`CGST ${slab.halfRate}%:`, `INR ${slab.cgstAmount.toFixed(2)}`);
          printRow(`SGST ${slab.halfRate}%:`, `INR ${slab.sgstAmount.toFixed(2)}`);
        });
        if (gstSlabs.length > 1) {
          printRow('Total GST Tax:', `INR ${totalGstTax.toFixed(2)}`, true);
        }
      } else {
        gstSlabs.forEach(slab => {
          printRow(`IGST ${slab.rate}%:`, `INR ${slab.igstAmount.toFixed(2)}`);
        });
        if (gstSlabs.length > 1) {
          printRow('Total GST Tax:', `INR ${totalGstTax.toFixed(2)}`, true);
        }
      }
    } else {
      if (!isInterState) {
        if (totalCgst > 0) printRow('CGST Tax Total:', `INR ${totalCgst.toFixed(2)}`);
        if (totalSgst > 0) printRow('SGST Tax Total:', `INR ${totalSgst.toFixed(2)}`);
      } else {
        if (totalIgst > 0) printRow('IGST Tax Total:', `INR ${totalIgst.toFixed(2)}`);
      }
    }

    if (roundOff !== 0) {
      printRow('Round-Off Adjustment:', `${roundOff > 0 ? '+' : ''}${roundOff.toFixed(2)}`);
    }

    // Grand Total Bar
    doc.setFillColor(30, 27, 75);
    doc.roundedRect(margin + 1.5, sumY - 1.0, tableW - 3, 7.0, 1.0, 1.0, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.0);
    doc.setTextColor(255, 255, 255);
    doc.text('NET GRAND TOTAL:', lX + 1.5, sumY + 3.7);
    doc.text(`INR ${grandTotal.toFixed(2)}`, rX - 1.5, sumY + 3.7, { align: 'right' });
    sumY += 9.0;

    // Payment Settlement Info
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5.8);
    doc.setTextColor(71, 85, 105);
    doc.text(`Payment: ${isPaid ? 'Fully Paid (PAID)' : (order.paymentTerms || 'Not Paid')}`, lX, sumY);
    if (balance > 0) {
      doc.text(`Bal Due: INR ${balance.toFixed(2)}`, rX, sumY, { align: 'right' });
    } else if (paid > 0) {
      doc.text(`Received: INR ${paid.toFixed(2)}`, rX, sumY, { align: 'right' });
    }

    curY += summaryBoxH + 4.0;

    // Footer
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(6.2);
    doc.setTextColor(100, 116, 139);
    doc.text('Thank you for choosing us!', 40, curY, { align: 'center' });
    curY += 3.2;
    doc.text('Computer-generated retail invoice • Authentic Tax Proof', 40, curY, { align: 'center' });
  } else {
    // ───────────────────────────────────────────────────────────────────────
    // ── WITHOUT RATE: ATTRACTIVE DISPATCH SUMMARY & BIFURCATION TABLE ─────
    // ───────────────────────────────────────────────────────────────────────

    // 1. Total Dispatch Summary Card
    const sumCardH = 17.5;
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(margin, curY, tableW, sumCardH, 1.5, 1.5, 'FD');

    // Header strip for summary
    doc.setFillColor(241, 245, 249);
    doc.rect(margin, curY, tableW, 4.8, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.line(margin, curY + 4.8, margin + tableW, curY + 4.8);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(30, 27, 75);
    doc.text('TOTAL DISPATCH SUMMARY', 40, curY + 3.3, { align: 'center' });

    let sLineY = curY + 8.5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.2);
    doc.setTextColor(71, 85, 105);
    doc.text('Total Product Varieties:', margin + 3.0, sLineY);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(`${totalVarieties} Varieties (${items.length} Line Items)`, margin + tableW - 3.0, sLineY, { align: 'right' });

    sLineY += 4.5;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.8);
    doc.setTextColor(30, 27, 75);
    doc.text('TOTAL DISPATCHED QUANTITY:', margin + 3.0, sLineY);
    doc.setFontSize(7.5);
    doc.setTextColor(79, 70, 229);
    doc.text(`${totalQty} Units`, margin + tableW - 3.0, sLineY, { align: 'right' });

    curY += sumCardH + 3.5;

    // 2. Category-Wise Bifurcation Table (True Table-Wise Display)
    if (showCategoryWise) {
      const bifCols = [
        { label: '#', w: 6.0, align: 'center' },
        { label: 'CATEGORY / FLAVOUR GROUP', w: 38.0, align: 'left' },
        { label: 'VARIETIES', w: 14.0, align: 'center' },
        { label: 'TOTAL QTY', w: 15.0, align: 'right' }
      ];

      // Bifurcation Table Header
      const bthH = 5.5;
      doc.setFillColor(30, 27, 75);
      doc.rect(margin, curY, tableW, bthH, 'F');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.2);
      doc.setTextColor(255, 255, 255);

      let bhX = margin;
      bifCols.forEach(c => {
        let tX;
        if (c.align === 'right') tX = bhX + c.w - 1.5;
        else if (c.align === 'center') tX = bhX + (c.w / 2);
        else tX = bhX + 1.5;
        doc.text(c.label, tX, curY + 3.8, { align: c.align });
        bhX += c.w;
      });

      curY += bthH;

      // Bifurcation Rows
      bifurcationList.forEach((b, bIdx) => {
        const bRowH = 5.2;
        if (bIdx % 2 === 1) {
          doc.setFillColor(248, 250, 252);
          doc.rect(margin, curY, tableW, bRowH, 'F');
        }

        // Border lines
        doc.setDrawColor(226, 232, 240);
        doc.line(margin, curY + bRowH, margin + tableW, curY + bRowH);
        doc.line(margin, curY, margin, curY + bRowH);
        doc.line(margin + tableW, curY, margin + tableW, curY + bRowH);

        const bY = curY + 3.6;

        // Col 1: Index
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.0);
        doc.setTextColor(71, 85, 105);
        doc.text(String(bIdx + 1), margin + (bifCols[0].w / 2), bY, { align: 'center' });

        // Col 2: Category
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6.2);
        doc.setTextColor(15, 23, 42);
        doc.text(b.category.substring(0, 28), margin + bifCols[0].w + 1.5, bY);

        // Col 3: Varieties
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.0);
        doc.setTextColor(51, 65, 85);
        const varText = `${b.varietyCount} ${b.varietyCount === 1 ? 'Variety' : 'Varieties'}`;
        doc.text(varText, margin + bifCols[0].w + bifCols[1].w + (bifCols[2].w / 2), bY, { align: 'center' });

        // Col 4: Qty
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6.2);
        doc.setTextColor(15, 23, 42);
        doc.text(`${b.totalQty} ${b.uom}`, margin + tableW - 1.5, bY, { align: 'right' });

        curY += bRowH;
      });

      // Total Row for Category Bifurcation Table
      const totRowH = 5.5;
      doc.setFillColor(241, 245, 249);
      doc.rect(margin, curY, tableW, totRowH, 'F');
      doc.setDrawColor(203, 213, 225);
      doc.line(margin, curY + totRowH, margin + tableW, curY + totRowH);
      doc.line(margin, curY, margin, curY + totRowH);
      doc.line(margin + tableW, curY, margin + tableW, curY + totRowH);

      const totY = curY + 3.8;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.2);
      doc.setTextColor(30, 27, 75);
      doc.text(`TOTAL (${totalCategories} Grps)`, margin + bifCols[0].w + 1.5, totY);
      doc.text(`${totalVarieties} Varieties`, margin + bifCols[0].w + bifCols[1].w + (bifCols[2].w / 2), totY, { align: 'center' });
      doc.text(`${totalQty} Units`, margin + tableW - 1.5, totY, { align: 'right' });

      curY += totRowH + 4.0;
    }

    // 3. Receiver Acknowledgment & Verification Box
    const ackH = 26.0;
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(margin, curY, tableW, ackH, 1.5, 1.5, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.2);
    doc.setTextColor(30, 27, 75);
    doc.text("RECEIVER'S ACKNOWLEDGMENT & SEAL:", margin + 2.5, curY + 4.2);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.0);
    doc.setTextColor(71, 85, 105);
    doc.text('Receiver Sign: ___________________________', margin + 2.5, curY + 11.0);
    doc.text('Date: ___________', margin + tableW - 2.5, curY + 11.0, { align: 'right' });

    doc.setFont('helvetica', 'italic');
    doc.setFontSize(5.5);
    doc.setTextColor(100, 116, 139);
    doc.text('Declaration: Goods received in full quantity and verified condition.', margin + 2.5, curY + 17.5);
    doc.text('Salem Warehouse & Cold Storage Dispatch Logistics Team', margin + 2.5, curY + 22.0);

    curY += ackH + 3.0;

    // Bottom brand mark
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(5.5);
    doc.setTextColor(148, 163, 184);
    doc.text('Generated via Manufacturing ERP • Official Dispatch Slip', 40, curY, { align: 'center' });
  }

  return doc.output('blob');
}

/**
 * Resolves standard dynamic filename for Sales documents conforming to:
 * - Quotation: Quotation_<id/no>.pdf
 * - Standard Order: Standard_Order_<id/no>.pdf
 * - Invoice: Invoice_<id/no>.pdf
 * - Without Rate: appends _WithoutRate
 */
export function getSalesDocumentPdfFilename(order, layoutMode = 'A4', options = {}) {
  const isWithoutRate = options.showRates === false || options.withoutRate === true;

  if (!order) return isWithoutRate ? 'Delivery_Slip_WithoutRate.pdf' : 'Document.pdf';

  if (layoutMode === 'POS' || order.type === 'POS') {
    const rawNo = order.docNo || order.referenceNo || order.id || 'POS';
    const cleanNo = String(rawNo).replace(/[\/\\]/g, '-').replace(/[^a-zA-Z0-9_\-\.]/g, '_');
    return isWithoutRate ? `Delivery_Slip_${cleanNo}_WithoutRate.pdf` : `POS_Receipt_${cleanNo}.pdf`;
  }

  const rawNo = order.docNo || order.referenceNo || order.id || 'DOC';
  // Replace slashes with dash for clean OS filesystem compatibility
  const cleanNo = String(rawNo).replace(/[\/\\]/g, '-').replace(/[^a-zA-Z0-9_\-\.]/g, '_');

  const rawType = String(order.type || '').toUpperCase();
  const rawMode = String(order.orderMode || '').toUpperCase();
  const rawNoUpper = String(rawNo).toUpperCase();

  const isQuotation = rawType === 'QUOTATION' || 
                      rawMode === 'QUOTATION' || 
                      rawNoUpper.startsWith('QT');

  const isInvoice = rawType === 'INVOICE' || 
                    rawType === 'TAX INVOICE' || 
                    rawMode === 'INVOICE' || 
                    rawNoUpper.startsWith('INV');

  if (isWithoutRate) {
    return isQuotation ? `Quotation_${cleanNo}_WithoutRate.pdf` : (isInvoice ? `Delivery_Challan_${cleanNo}_WithoutRate.pdf` : `Standard_Order_${cleanNo}_WithoutRate.pdf`);
  } else if (isQuotation) {
    return `Quotation_${cleanNo}.pdf`;
  } else if (isInvoice) {
    return `Invoice_${cleanNo}.pdf`;
  } else {
    // Standard Sales Order
    return `Standard_Order_${cleanNo}.pdf`;
  }
}
