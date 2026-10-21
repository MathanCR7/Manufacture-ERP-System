import { jsPDF } from 'jspdf';
import { numberToWordsINR, getIndianStates, computeOrderGstSlabs, formatChargeGstLabel, getOrderAncillaryTaxCodes, getTaxRateFromCode } from './gstEngine';

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
 * Compiles an Advanced Indian GST Tax Invoice (A4 Portrait)
 * Conforms to Rule 46 of the CGST Rules, 2017 & SAP Commercial Standards
 */
export function generateA4TaxInvoice(order, companyDetails = {}) {
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

  const docNo = order.docNo || order.referenceNo || 'SO-0001';
  const rawNoUpper = String(docNo).toUpperCase();
  const rawTypeUpper = String(order.type || '').toUpperCase();
  const rawModeUpper = String(order.orderMode || '').toUpperCase();

  const isQuotation = rawTypeUpper === 'QUOTATION' || rawModeUpper === 'QUOTATION' || rawNoUpper.startsWith('QT');
  const isInvoice = rawTypeUpper === 'INVOICE' || rawTypeUpper === 'TAX INVOICE' || rawModeUpper === 'INVOICE' || rawNoUpper.startsWith('INV');

  const docTitle = isQuotation 
    ? 'QUOTATION' 
    : (isInvoice ? 'TAX INVOICE' : 'SALES ORDER');

  // Top Accent Banner
  doc.setFillColor(30, 27, 75);
  doc.rect(0, 0, pageWidth, 5, 'F');
  doc.setFillColor(79, 70, 229);
  doc.rect(0, 5, pageWidth, 1.5, 'F');

  let curY = 16;

  const quotationLabel = isQuotation 
    ? `Quotation No: ${docNo}` 
    : (isInvoice ? `Invoice No: ${docNo}` : `Sales Order No: ${docNo}`);

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

  doc.text(`Doc No: `, margin + 3, curY + 5);
  doc.setTextColor(15, 23, 42);
  doc.text(docNo, margin + 15, curY + 5);

  doc.setTextColor(71, 85, 105);
  doc.text(`Date: `, margin + 48, curY + 5);
  doc.setTextColor(15, 23, 42);
  doc.text(invoiceDate, margin + 56, curY + 5);

  doc.setTextColor(71, 85, 105);
  doc.text(`Payment Status: `, margin + 85, curY + 5);
  const isPaid = String(paymentTermsVal).toUpperCase() === 'PAID' || String(order.paymentStatus).toUpperCase() === 'PAID' || (Number(order.amountPaid || 0) >= Number(order.grandTotal || 0) && Number(order.grandTotal || 0) > 0);
  doc.setTextColor(isPaid ? 16 : 180, isPaid ? 120 : 60, isPaid ? 40 : 40);
  doc.text(isPaid ? 'PAID' : (order.paymentStatus || 'PENDING'), margin + 108, curY + 5);

  doc.setTextColor(71, 85, 105);
  doc.text(`Payment Terms: `, margin + 132, curY + 5);
  doc.setTextColor(15, 23, 42);
  doc.text(String(paymentTermsVal).substring(0, 28), margin + 154, curY + 5);

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
  // Columns: [# (6), Description of Goods & Batch (76), Qty (11), Unit (10), Rate (₹) (15), Disc (10), Taxable (₹) (18), GST Rate (10), GST (₹) (14), Total (₹) (16)] = 186mm
  const cols = [
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
  ];

  doc.setFillColor(30, 27, 75);
  doc.rect(margin, curY, contentWidth, 7, 'F');
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

      doc.text(prefix, startX, curY + 4.8);
      drawRupeeGlyph(doc, startX + prefixW + 0.2, curY + 4.8, 2.3, true);
      doc.text(')', startX + prefixW + rupeeW + 0.4, curY + 4.8);
    } else {
      const textX = c.align === 'right' ? headerX + c.w - 1.5 : (c.align === 'center' ? headerX + (c.w / 2) : headerX + 1.5);
      doc.text(c.label, textX, curY + 4.8, { align: c.align });
    }
    headerX += c.w;
  });

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
    if (curY + rowH > pageHeight - 75) {
      doc.addPage();
      curY = 15;
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

    // 2. Description of Goods & Batch (cols[1]: Product Code - Subcategory Name - Product Name (Base Category))
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

    // Build main label: [Code] - [Subcategory] - [Product Name]
    const descParts = [];
    if (itemCode) descParts.push(itemCode);
    const mainCategory = subcatName || baseCat;
    if (mainCategory) descParts.push(mainCategory);
    if (prodName) descParts.push(prodName);
    const mainDesc = descParts.length > 0
      ? descParts.join(' - ')
      : (it.productName || it.product?.name || it.itemDescription || 'Finished Goods');

    // Base Category Tag: formatted with smaller font size and muted color compared to subcategory and product
    const showBaseTag = Boolean(
      baseCat &&
      (!subcatName || baseCat.toLowerCase() !== subcatName.toLowerCase())
    );
    const baseTagText = showBaseTag ? ` (${baseCat})` : '';

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

    curY += rowH;
  });
  }

  // Table bottom border
  doc.setDrawColor(226, 232, 240);
  doc.line(margin, curY, pageWidth - margin, curY);
  curY += 4;

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

  const freightLabel = formatChargeGstLabel('Freight & Logistics', freightRate, isInterState);
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
    productAndChargesLabel = `Total Product & ${activeChargeNames[0]} and ${activeChargeNames[1]} Amount:`;
  } else if (activeChargeNames.length > 2) {
    const last = activeChargeNames[activeChargeNames.length - 1];
    const rest = activeChargeNames.slice(0, -1).join(', ');
    productAndChargesLabel = `Total Product & ${rest} and ${last} Amount:`;
  } else if (discVal > 0) {
    productAndChargesLabel = 'Net Product Amount:';
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

  // Dynamic box height: perfectly accommodates all elaborated tax slabs without overflow
  const rightContentH = 6 + (rightRowsCount * 4.2) + 14;
  const leftContentH = 14 + (wordsLines.length * 4) + 24;
  const summaryCardH = Math.max(54, leftContentH, rightContentH);

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
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(bold ? 15 : 71, bold ? 23 : 85, bold ? 42 : 105);
    doc.text(label, rSumX + 3.5, rY);

    const formatted = `${isNegative ? '- ' : ''}${Math.abs(Number(amountNum) || 0).toFixed(2)}`;
    const numW = doc.getTextWidth(formatted);
    const rightMarginX = rSumX + sumColW - 3.5;

    // Draw clean Rupee glyph before the numerical value
    drawRupeeGlyph(doc, rightMarginX - numW - 2.8, rY, 2.2, false);
    doc.text(formatted, rightMarginX, rY, { align: 'right' });
    rY += 4.2;
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

  return doc.output('blob');
}

/**
 * Compiles a fast 80mm Thermal Receipt for POS Cashier Counter
 */
export function generateThermalReceipt(order, companyDetails = {}) {
  const companyName = companyDetails.companyName || 'RETAIL FACTORY OUTLET';
  const companyAddress = companyDetails.companyAddress || 'Main Outlet, Salem, TN';
  const companyGstin = companyDetails.companyGstin || '33AAAAA0000A1Z5';

  const printableItems = (order.items || []).filter(it => !it.isPackingCharge && !it.is_packing_charge);
  const items = printableItems;
  const itemsCount = items.length;
  const dynamicHeight = Math.max(160, 115 + (itemsCount * 7.5));

  const doc = new jsPDF({
    unit: 'mm',
    format: [80, dynamicHeight]
  });

  // Border Frame
  doc.setDrawColor(200, 200, 200);
  doc.rect(2, 2, 76, dynamicHeight - 4, 'D');

  let curY = 8;

  // Store Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(30, 27, 75);
  doc.text('RETAIL TAX RECEIPT', 40, curY, { align: 'center' });

  curY += 4.5;
  doc.setFontSize(8);
  doc.text(companyName.toUpperCase().substring(0, 32), 40, curY, { align: 'center' });

  curY += 3.5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(71, 85, 105);
  const addrLines = doc.splitTextToSize(companyAddress, 70);
  doc.text(addrLines, 40, curY, { align: 'center' });

  curY += (addrLines.length * 3.2);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 27, 75);
  doc.text(`GSTIN: ${companyGstin}`, 40, curY, { align: 'center' });

  curY += 3;
  doc.setDrawColor(220, 220, 220);
  doc.line(4, curY, 76, curY);

  curY += 4;

  // Order Meta
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(15, 23, 42);
  const dateStr = new Date(order.createdAt || Date.now()).toLocaleString('en-IN', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });
  doc.text(`Doc: ${order.docNo || order.referenceNo || 'POS-BILL'}`, 5, curY);
  doc.text(`Date: ${dateStr}`, 75, curY, { align: 'right' });

  curY += 3.5;
  doc.text(`Counter: ${order.counterId || 'COUNTER-1'}`, 5, curY);
  doc.text(`Cashier: ${order.cashierName || 'Staff'}`, 75, curY, { align: 'right' });

  if (order.customer?.name && order.customer.name !== 'Walk-in Retail Customer') {
    curY += 3.5;
    doc.text(`Customer: ${order.customer.name.substring(0, 28)}`, 5, curY);
    if (order.customer.phone) doc.text(`Ph: ${order.customer.phone}`, 75, curY, { align: 'right' });
  }

  curY += 3;
  doc.line(4, curY, 76, curY);
  curY += 3.5;

  // Table Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.text('ITEM', 5, curY);
  doc.text('QTY', 42, curY, { align: 'right' });
  doc.text('RATE', 58, curY, { align: 'right' });
  doc.text('TOTAL', 75, curY, { align: 'right' });

  curY += 2.5;
  doc.line(4, curY, 76, curY);
  curY += 3.5;

  // Item List
  let subtotal = 0;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);

  items.forEach(it => {
    const qty = Number(it.quantity || 1);
    const rate = Number(it.unitPrice || 0);
    const lineTotal = qty * rate;
    subtotal += lineTotal;

    const prodName = it.productName || it.product?.name || 'Item';
    doc.text(prodName.substring(0, 22), 5, curY);
    doc.text(String(qty), 42, curY, { align: 'right' });
    doc.text(rate.toFixed(1), 58, curY, { align: 'right' });
    doc.text(lineTotal.toFixed(2), 75, curY, { align: 'right' });

    if (it.batchNo) {
      curY += 2.5;
      doc.setFontSize(5.5);
      doc.setTextColor(120, 120, 120);
      doc.text(`Batch: ${it.batchNo}${it.expiryDate ? ` (Exp: ${new Date(it.expiryDate).toLocaleDateString('en-GB')})` : ''}`, 5, curY);
      doc.setFontSize(6.5);
      doc.setTextColor(15, 23, 42);
    }

    curY += 4;
  });

  doc.line(4, curY, 76, curY);
  curY += 4;

  // Totals Breakdown
  const grandTotal = Number(order.grandTotal || subtotal);
  const paid = Number(order.amountPaid || grandTotal);
  const balance = Math.max(0, paid - grandTotal);

  const printBillLine = (lbl, val, bold = false) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.text(lbl, 5, curY);
    doc.text(val, 75, curY, { align: 'right' });
    curY += 3.5;
  };

  printBillLine('Subtotal:', `INR ${subtotal.toFixed(2)}`);
  if (Number(order.cgst || 0) > 0) printBillLine('CGST:', `INR ${Number(order.cgst).toFixed(2)}`);
  if (Number(order.sgst || 0) > 0) printBillLine('SGST:', `INR ${Number(order.sgst).toFixed(2)}`);
  if (Number(order.roundOff || 0) !== 0) printBillLine('Round Off:', `${Number(order.roundOff) > 0 ? '+' : ''}${Number(order.roundOff).toFixed(2)}`);

  curY += 0.5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('TOTAL:', 5, curY);
  doc.text(`INR ${grandTotal.toFixed(2)}`, 75, curY, { align: 'right' });
  curY += 4.5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  printBillLine(`Paid (${order.paymentTerms || 'Cash'}):`, `INR ${paid.toFixed(2)}`);
  if (balance > 0) printBillLine('Change Due:', `INR ${balance.toFixed(2)}`, true);

  curY += 2;
  doc.line(4, curY, 76, curY);
  curY += 4;

  // Footer Message
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(6.5);
  doc.setTextColor(100, 116, 139);
  doc.text('Thank you for shopping with us!', 40, curY, { align: 'center' });
  curY += 3.5;
  doc.text('Quality & Purity You Can Trust.', 40, curY, { align: 'center' });

  return doc.output('blob');
}

/**
 * Resolves standard dynamic filename for Sales documents conforming to:
 * - Quotation: Quotation_<id/no>.pdf
 * - Standard Order: Standard_Order_<id/no>.pdf
 * - Invoice: Invoice_<id/no>.pdf
 */
export function getSalesDocumentPdfFilename(order, layoutMode = 'A4') {
  if (!order) return 'Document.pdf';

  if (layoutMode === 'POS' || order.type === 'POS') {
    const rawNo = order.docNo || order.referenceNo || order.id || 'POS';
    const cleanNo = String(rawNo).replace(/[\/\\]/g, '-').replace(/[^a-zA-Z0-9_\-\.]/g, '_');
    return `POS_Receipt_${cleanNo}.pdf`;
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

  if (isQuotation) {
    return `Quotation_${cleanNo}.pdf`;
  } else if (isInvoice) {
    return `Invoice_${cleanNo}.pdf`;
  } else {
    // Standard Sales Order
    return `Standard_Order_${cleanNo}.pdf`;
  }
}
