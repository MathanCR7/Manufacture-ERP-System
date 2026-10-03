import { jsPDF } from 'jspdf';
import { numberToWordsINR, getIndianStates } from './gstEngine';

/**
 * Compiles a professional Indian GST Tax Invoice (A4 Portrait)
 * Conforms to Rule 46 of the CGST Rules, 2017
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

  // Fallback company details
  const company = {
    name: companyDetails.companyName || 'MANUFACTURING ENTERPRISES',
    address: companyDetails.companyAddress || 'Factory & Central Store, Salem, Tamil Nadu, India',
    gstin: companyDetails.companyGstin || '33AAAAA0000A1Z5',
    mobile: companyDetails.companyMobile || '+91 98765 43210',
    email: companyDetails.companyEmail || 'billing@enterprises.com',
    stateCode: companyDetails.stateCode || '33',
    bankName: companyDetails.bankName || 'State Bank of India',
    accountNo: companyDetails.bankAccountNumber || '123456789012',
    ifsc: companyDetails.bankIfscCode || 'SBIN0001234',
    branch: companyDetails.bankBranch || 'Salem Main Branch',
    terms: companyDetails.invoiceTerms || '1. Goods once sold will not be taken back without valid QC inspection.\n2. Interest @ 18% p.a. will be charged if payment is delayed beyond due date.\n3. Subject to Salem jurisdiction only.'
  };

  const sellerState = company.stateCode || company.gstin.substring(0, 2);
  const buyerState = order.buyerStateCode || (order.customer?.gstin ? order.customer.gstin.substring(0, 2) : sellerState);
  const isInterState = String(sellerState) !== String(buyerState);

  const docTitle = order.type === 'Quotation' 
    ? 'QUOTATION' 
    : (order.type === 'Sales Order' ? 'SALES ORDER' : 'TAX INVOICE');

  // Top Accent Banner
  doc.setFillColor(30, 27, 75);
  doc.rect(0, 0, pageWidth, 5, 'F');
  doc.setFillColor(79, 70, 229);
  doc.rect(0, 5, pageWidth, 1.5, 'F');

  let curY = 16;

  // Header Title & Document Identifier
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(30, 27, 75);
  doc.text(docTitle, margin, curY);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text('(Original for Recipient)', margin, curY + 4.5);

  // Company Information (Right aligned)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text(company.name.toUpperCase(), pageWidth - margin, curY - 2, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  const compAddrLines = doc.splitTextToSize(company.address, 75);
  doc.text(compAddrLines, pageWidth - margin, curY + 2.5, { align: 'right' });

  const addrOffset = compAddrLines.length * 3.8;
  doc.setFont('helvetica', 'bold');
  doc.text(`GSTIN: ${company.gstin}`, pageWidth - margin, curY + 2.5 + addrOffset, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.text(`State Code: ${sellerState} | Mobile: ${company.mobile}`, pageWidth - margin, curY + 6.5 + addrOffset, { align: 'right' });

  curY = Math.max(curY + 16, curY + 9 + addrOffset);

  // Divider Line
  doc.setDrawColor(226, 232, 240);
  doc.line(margin, curY, pageWidth - margin, curY);
  curY += 4;

  // Info Cards (Two Columns: Left = Buyer, Right = Invoice Meta)
  const colW = (contentWidth - 6) / 2;
  const cardH = 34;

  // Left Card: Buyer / Bill To
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(margin, curY, colW, cardH, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(79, 70, 229);
  doc.text('BILLED TO (BUYER):', margin + 3.5, curY + 5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  const customerName = order.customer?.name || 'Walk-in Retail Customer';
  doc.text(customerName.substring(0, 36), margin + 3.5, curY + 10);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  const custAddr = order.deliveryAddress || order.customer?.address || 'Salem Counter Store';
  const buyerAddrLines = doc.splitTextToSize(custAddr, colW - 7);
  doc.text(buyerAddrLines, margin + 3.5, curY + 14.5);

  const buyerGstin = order.customer?.gstin || order.taxRegNo || 'UNREGISTERED';
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 27, 75);
  doc.text(`GSTIN / UIN: ${buyerGstin}`, margin + 3.5, curY + 28);
  doc.text(`Place of Supply: State Code ${buyerState} (${isInterState ? 'Inter-State' : 'Intra-State'})`, margin + 3.5, curY + 31.5);

  // Right Card: Invoice Details
  const rightX = margin + colW + 6;
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(rightX, curY, colW, cardH, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(79, 70, 229);
  doc.text('DOCUMENT DETAILS:', rightX + 3.5, curY + 5);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 116, 139);
  doc.text('Doc Number:', rightX + 3.5, curY + 10);
  doc.setTextColor(15, 23, 42);
  doc.text(order.docNo || order.referenceNo || 'N/A', rightX + 28, curY + 10);

  doc.setTextColor(100, 116, 139);
  doc.text('Invoice Date:', rightX + 3.5, curY + 14.5);
  doc.setTextColor(15, 23, 42);
  const invoiceDate = new Date(order.createdAt || Date.now()).toLocaleDateString('en-GB');
  doc.text(invoiceDate, rightX + 28, curY + 14.5);

  doc.setTextColor(100, 116, 139);
  doc.text('Payment Terms:', rightX + 3.5, curY + 19);
  doc.setTextColor(15, 23, 42);
  doc.text(order.paymentTerms || 'Immediate', rightX + 28, curY + 19);

  doc.setTextColor(100, 116, 139);
  doc.text('Payment Status:', rightX + 3.5, curY + 23.5);
  doc.setTextColor(order.paymentStatus === 'PAID' ? 16 : (order.paymentStatus === 'PARTIAL' ? 180 : 220), 120, 40);
  doc.text((order.paymentStatus || 'PENDING').toUpperCase(), rightX + 28, curY + 23.5);

  if (order.vehicleNumber || order.eWayBillNumber) {
    doc.setTextColor(100, 116, 139);
    doc.text('Transport:', rightX + 3.5, curY + 28);
    doc.setTextColor(15, 23, 42);
    doc.text(`${order.vehicleNumber || ''} ${order.eWayBillNumber ? `• EWB: ${order.eWayBillNumber}` : ''}`.trim(), rightX + 28, curY + 28);
  }

  curY += cardH + 5;

  // Items Table Header
  // Columns: [Sl, Item & Batch Info, HSN, Qty, Unit, Rate, Disc, Taxable, Tax Rate, Tax Amt, Total]
  const cols = [
    { label: '#', w: 8, align: 'center' },
    { label: 'Description & Batch', w: 56, align: 'left' },
    { label: 'HSN', w: 16, align: 'center' },
    { label: 'Qty', w: 14, align: 'right' },
    { label: 'Unit', w: 11, align: 'center' },
    { label: 'Rate (₹)', w: 18, align: 'right' },
    { label: 'Disc', w: 12, align: 'right' },
    { label: 'Taxable (₹)', w: 22, align: 'right' },
    { label: isInterState ? 'IGST' : 'GST', w: 12, align: 'center' },
    { label: 'Total (₹)', w: 17, align: 'right' }
  ];

  doc.setFillColor(30, 27, 75);
  doc.rect(margin, curY, contentWidth, 7, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(255, 255, 255);

  let headerX = margin;
  cols.forEach(c => {
    const textX = c.align === 'right' ? headerX + c.w - 1.5 : (c.align === 'center' ? headerX + (c.w / 2) : headerX + 1.5);
    doc.text(c.label, textX, curY + 4.8, { align: c.align });
    headerX += c.w;
  });

  curY += 7;

  // Items Table Rows
  const items = order.items || [];
  let totalTaxableValue = 0;
  let totalCgst = Number(order.cgst || 0);
  let totalSgst = Number(order.sgst || 0);
  let totalIgst = Number(order.igst || 0);

  items.forEach((it, idx) => {
    const rowH = 10;
    if (curY + rowH > pageHeight - 55) {
      doc.addPage();
      curY = 15;
    }

    // Zebra stripes
    if (idx % 2 === 1) {
      doc.setFillColor(248, 250, 252);
      doc.rect(margin, curY, contentWidth, rowH, 'F');
    }

    // Item calculations
    const qty = Number(it.quantity || 1);
    const unitPrice = Number(it.unitPrice || 0);
    const disc = Number(it.discount || 0);
    const taxable = Math.max(0, (unitPrice - disc) * qty);
    totalTaxableValue += taxable;

    const gstRate = Number(it.gstRate !== undefined ? it.gstRate : 18);
    const taxAmt = taxable * (gstRate / 100);
    const lineTotal = taxable + taxAmt;

    // Batch display string
    const batchStr = it.batchNo 
      ? `Batch: ${it.batchNo}${it.expiryDate ? ` | Exp: ${new Date(it.expiryDate).toLocaleDateString('en-GB')}` : ''}`
      : (it.batchAllocations && it.batchAllocations.length > 0 
          ? `Batch: ${it.batchAllocations.map(b => b.batchNo).join(', ')}`
          : '');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(15, 23, 42);

    let cellX = margin;

    // 1. Index
    doc.text(String(idx + 1), cellX + 4, curY + 4, { align: 'center' });
    cellX += cols[0].w;

    // 2. Name & Batch Info
    doc.setFont('helvetica', 'bold');
    const prodName = it.productName || it.product?.name || 'Item';
    doc.text(prodName.substring(0, 32), cellX + 1.5, curY + 4);
    if (batchStr) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(100, 116, 139);
      doc.text(batchStr, cellX + 1.5, curY + 8);
    }
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(15, 23, 42);
    cellX += cols[1].w;

    // 3. HSN
    doc.text(it.hsnCode || '21050000', cellX + (cols[2].w / 2), curY + 5, { align: 'center' });
    cellX += cols[2].w;

    // 4. Qty
    doc.setFont('helvetica', 'bold');
    doc.text(qty.toLocaleString('en-IN'), cellX + cols[3].w - 1.5, curY + 5, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    cellX += cols[3].w;

    // 5. Unit
    doc.text(it.uomName || it.product?.unit?.abbreviation || 'pcs', cellX + (cols[4].w / 2), curY + 5, { align: 'center' });
    cellX += cols[4].w;

    // 6. Rate
    doc.text(unitPrice.toFixed(2), cellX + cols[5].w - 1.5, curY + 5, { align: 'right' });
    cellX += cols[5].w;

    // 7. Discount
    doc.text(disc > 0 ? disc.toFixed(2) : '-', cellX + cols[6].w - 1.5, curY + 5, { align: 'right' });
    cellX += cols[6].w;

    // 8. Taxable Value
    doc.setFont('helvetica', 'bold');
    doc.text(taxable.toFixed(2), cellX + cols[7].w - 1.5, curY + 5, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    cellX += cols[7].w;

    // 9. Tax Rate
    doc.text(`${gstRate}%`, cellX + (cols[8].w / 2), curY + 5, { align: 'center' });
    cellX += cols[8].w;

    // 10. Total
    doc.setFont('helvetica', 'bold');
    doc.text(lineTotal.toFixed(2), cellX + cols[9].w - 1.5, curY + 5, { align: 'right' });

    curY += rowH;
  });

  // Table bottom border
  doc.setDrawColor(226, 232, 240);
  doc.line(margin, curY, pageWidth - margin, curY);
  curY += 4;

  // Check bottom room for totals
  if (curY > pageHeight - 65) {
    doc.addPage();
    curY = 15;
  }

  // Summary & Totals Block (Two Columns: Left = Bank & In Words, Right = Tax Breakdown & Grand Total)
  const sumColW = (contentWidth - 6) / 2;

  // Left Side: Amount in Words & Bank Details
  const grandTotal = Number(order.grandTotal || (totalTaxableValue + totalCgst + totalSgst + totalIgst));
  const wordsText = numberToWordsINR(grandTotal);

  doc.setFillColor(248, 250, 252);
  doc.roundedRect(margin, curY, sumColW, 48, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(79, 70, 229);
  doc.text('TOTAL AMOUNT IN WORDS:', margin + 3.5, curY + 5);

  doc.setFont('helvetica', 'bolditalic');
  doc.setFontSize(8);
  doc.setTextColor(30, 27, 75);
  const wordsLines = doc.splitTextToSize(wordsText, sumColW - 7);
  doc.text(wordsLines, margin + 3.5, curY + 9.5);

  const bankTop = curY + 9.5 + (wordsLines.length * 4) + 2;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(79, 70, 229);
  doc.text('BANK DETAILS FOR REMITTANCE:', margin + 3.5, bankTop);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text(`Bank Name: ${company.bankName}`, margin + 3.5, bankTop + 4.5);
  doc.text(`Account No: ${company.accountNo}`, margin + 3.5, bankTop + 8.5);
  doc.text(`IFSC Code: ${company.ifsc} | Branch: ${company.branch}`, margin + 3.5, bankTop + 12.5);

  // Right Side: Grand Total Calculation Breakdown
  const rSumX = margin + sumColW + 6;
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(rSumX, curY, sumColW, 48, 2, 2, 'FD');

  let rY = curY + 5;
  const printRow = (label, val, bold = false) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(bold ? 15 : 71, bold ? 23 : 85, bold ? 42 : 105);
    doc.text(label, rSumX + 3.5, rY);
    doc.text(val, rSumX + sumColW - 3.5, rY, { align: 'right' });
    rY += 4.2;
  };

  printRow('Taxable Value:', `INR ${totalTaxableValue.toFixed(2)}`);

  if (!isInterState) {
    printRow('CGST Total:', `INR ${Number(order.cgst || (totalTaxableValue * 0.09)).toFixed(2)}`);
    printRow('SGST Total:', `INR ${Number(order.sgst || (totalTaxableValue * 0.09)).toFixed(2)}`);
  } else {
    printRow('IGST Total:', `INR ${Number(order.igst || (totalTaxableValue * 0.18)).toFixed(2)}`);
  }

  const additionalCharges = Number(order.freight || 0) + Number(order.loadingCharges || 0) + Number(order.packingCharges || 0) + Number(order.insurance || 0) + Number(order.otherCharges || 0);
  if (additionalCharges > 0) {
    printRow('Additional Charges:', `INR ${additionalCharges.toFixed(2)}`);
  }

  if (Number(order.discountValue || order.invoiceDiscount || 0) > 0) {
    printRow('Invoice Discount:', `- INR ${Number(order.discountValue || order.invoiceDiscount || 0).toFixed(2)}`);
  }

  if (Number(order.roundOff || 0) !== 0) {
    printRow('Round Off:', `${Number(order.roundOff || 0) > 0 ? '+' : ''}${Number(order.roundOff || 0).toFixed(2)}`);
  }

  // Grand Total Highlight Ribbon
  rY += 1;
  doc.setFillColor(30, 27, 75);
  doc.rect(rSumX, rY - 1, sumColW, 9, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  doc.text('GRAND TOTAL:', rSumX + 3.5, rY + 5);
  doc.text(`INR ${grandTotal.toFixed(2)}`, rSumX + sumColW - 3.5, rY + 5, { align: 'right' });

  curY += 52;

  // Terms & Authorized Signatory Block
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(148, 163, 184);
  const termsLines = doc.splitTextToSize(`Terms & Conditions:\n${company.terms}`, sumColW);
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

  const items = order.items || [];
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
