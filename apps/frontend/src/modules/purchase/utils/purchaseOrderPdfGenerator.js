import { jsPDF } from 'jspdf';
import Swal from 'sweetalert2';
import { format } from 'date-fns';
import { numberToIndianWords } from '@/utils/gstEngine';
import { normalizePOData } from './poExportPrintUtils';

/**
 * Generates and directly downloads an executive, color-graded Indian GST Purchase Order PDF (A4 Portrait)
 * Conforms to Fortune-500 ERP standards with rich aesthetics, color grading, and zero Chrome print dependency
 */
export function generatePurchaseOrderPDF(rawData) {
  try {
    const data = normalizePOData(rawData);

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const pageWidth = 210;
    const pageHeight = 297;
    const margin = 12;
    const contentWidth = pageWidth - (margin * 2);

    // ── EXECUTIVE COLOR GRADING PALETTE ──
    const primaryDark = [24, 28, 48];        // #181c30 Deep Midnight Slate
    const royalIndigo = [67, 56, 202];       // #4338ca Royal Indigo
    const vibrantIndigo = [79, 70, 229];     // #4f46e5 Vibrant Indigo
    const softIndigo = [238, 242, 255];      // #eef2ff Soft Indigo Tint
    const borderIndigo = [199, 210, 254];    // #c7d2fe Indigo Border
    const mutedTextColor = [100, 116, 139];  // #64748b Slate Muted
    const darkTextColor = [15, 23, 42];      // #0f172a Dark Slate
    const borderColor = [226, 232, 240];     // #e2e8f0 Slate Border
    const bgLight = [248, 250, 252];         // #f8fafc Light Fill
    const tableHeaderBg = [30, 41, 59];      // #1e293b Slate 800 Header

    // ── TOP MULTI-TONE COLOR-GRADED ACCENT RIBBON ──
    doc.setFillColor(24, 28, 48);
    doc.rect(0, 0, pageWidth, 4, 'F');
    doc.setFillColor(67, 56, 202);
    doc.rect(0, 4, pageWidth, 1.6, 'F');
    doc.setFillColor(79, 70, 229);
    doc.rect(0, 5.6, pageWidth, 1.2, 'F');
    doc.setFillColor(14, 165, 233);
    doc.rect(0, 6.8, pageWidth, 0.8, 'F');

    let curY = 16;

    // Header Title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(19);
    doc.setTextColor(...primaryDark);
    doc.text('PURCHASE ORDER', margin, curY);

    // Color-Graded Reference Badge
    doc.setFillColor(...softIndigo);
    doc.setDrawColor(...borderIndigo);
    doc.roundedRect(margin, curY + 2.5, 48, 5.8, 1.5, 1.5, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...royalIndigo);
    doc.text(`PO REF: ${data.referenceNo}`, margin + 24, curY + 6.3, { align: 'center' });

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...mutedTextColor);
    doc.text(`Order Date: ${data.orderDate}  |  Delivery Due: ${data.expectedDelivery}`, margin, curY + 13.5);

    // Company Header (Right Aligned)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...darkTextColor);
    doc.text(data.company.name.toUpperCase(), pageWidth - margin, curY - 1, { align: 'right' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105);
    const compAddrLines = doc.splitTextToSize(data.company.address, 80);
    doc.text(compAddrLines, pageWidth - margin, curY + 3.5, { align: 'right' });

    const addrOffset = compAddrLines.length * 3.5;
    doc.setFont('helvetica', 'bold');
    doc.text(`GSTIN: ${data.company.gstin} | PAN: ${data.company.pan}`, pageWidth - margin, curY + 4 + addrOffset, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.text(`Phone: ${data.company.phone}`, pageWidth - margin, curY + 7.5 + addrOffset, { align: 'right' });

    curY = Math.max(curY + 18, curY + 11 + addrOffset);

    // Divider Line
    doc.setDrawColor(...borderColor);
    doc.line(margin, curY, pageWidth - margin, curY);
    curY += 4;

    // ── SECTION 1 & 2: TWO COLUMNS (ORDER & SUPPLIER INFO + INVOICE & LOGISTICS) ──
    const colW = (contentWidth - 5) / 2;
    const cardH = 46;

    // Left Card: Supplier & Order Information
    doc.setFillColor(...bgLight);
    doc.setDrawColor(...borderColor);
    doc.roundedRect(margin, curY, colW, cardH, 2, 2, 'FD');

    // Soft Indigo Card Header Band
    doc.setFillColor(...softIndigo);
    doc.rect(margin, curY, colW, 6.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.8);
    doc.setTextColor(...royalIndigo);
    doc.text('1. SUPPLIER / VENDOR DETAILS', margin + 3.5, curY + 4.5);

    doc.setFontSize(6.8);
    doc.setTextColor(...royalIndigo);
    doc.text(data.taxRule, margin + colW - 3.5, curY + 4.5, { align: 'right' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.8);
    doc.setTextColor(...darkTextColor);
    const supName = data.supplier.name && data.supplier.name !== '—' ? data.supplier.name : 'Vendor / Supplier';
    doc.text(supName.substring(0, 42), margin + 3.5, curY + 11);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(71, 85, 105);

    let supY = curY + 14.8;
    if (data.supplier.contactPerson && data.supplier.contactPerson !== '—') {
      doc.text(`Contact: ${data.supplier.contactPerson}`, margin + 3.5, supY);
      supY += 3.6;
    }

    const supAddr = doc.splitTextToSize(data.supplier.address && data.supplier.address !== '—' ? data.supplier.address : 'Address on file', colW - 7);
    doc.text(supAddr.slice(0, 2), margin + 3.5, supY);
    supY += Math.min(supAddr.length, 2) * 3.4;

    doc.setFont('helvetica', 'bold');
    doc.text(`GSTIN: ${data.supplier.gstin}`, margin + 3.5, supY);
    doc.setFont('helvetica', 'normal');
    doc.text(`PAN: ${data.supplier.pan}`, margin + 3.5 + 40, supY);
    supY += 3.6;

    const contactParts = [];
    if (data.supplier.phone && data.supplier.phone !== '—') contactParts.push(`Phone: ${data.supplier.phone}`);
    if (data.supplier.email && data.supplier.email !== '—') contactParts.push(`Email: ${data.supplier.email}`);
    const contactStr = contactParts.length > 0 ? contactParts.join(' | ') : `Phone: ${data.supplier.phone || '—'}`;
    doc.text(contactStr.substring(0, 52), margin + 3.5, supY);
    supY += 3.6;

    doc.text(`Status: ${data.purchaseStatus}  |  By: ${data.creator}`, margin + 3.5, supY);

    // Right Card: Supplier Invoice & Transport / E-Way Bill Details
    const rX = margin + colW + 5;
    doc.setFillColor(...bgLight);
    doc.setDrawColor(...borderColor);
    doc.roundedRect(rX, curY, colW, cardH, 2, 2, 'FD');

    // Soft Cyan Card Header Band
    doc.setFillColor(236, 254, 255);
    doc.rect(rX, curY, colW, 6.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.8);
    doc.setTextColor(14, 116, 144);
    doc.text('2. SUPPLIER INVOICE & LOGISTICS / E-WAY', rX + 3.5, curY + 4.5);

    doc.setFontSize(6.8);
    doc.setTextColor(14, 116, 144);
    doc.text(data.logistics.transportMode || 'ROAD', rX + colW - 3.5, curY + 4.5, { align: 'right' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105);

    doc.text(`Supplier Invoice No:`, rX + 3.5, curY + 11);
    doc.setFont('helvetica', 'bold');
    doc.text(data.logistics.supplierInvoiceNo || '—', rX + 35, curY + 11);

    doc.setFont('helvetica', 'normal');
    doc.text(`Invoice Date:`, rX + colW - 38, curY + 11);
    doc.text(data.logistics.supplierInvoiceDate || '—', rX + colW - 3.5, curY + 11, { align: 'right' });

    doc.text(`Vehicle Number:`, rX + 3.5, curY + 16);
    doc.setFont('helvetica', 'bold');
    doc.text(data.logistics.vehicleNumber || '—', rX + 35, curY + 16);

    doc.setFont('helvetica', 'normal');
    doc.text(`Transporter / LR:`, rX + 3.5, curY + 21);
    const transText = `${data.logistics.transporterName || '—'} / ${data.logistics.lrNumber || '—'}`.substring(0, 30);
    doc.text(transText, rX + 35, curY + 21);

    doc.text(`E-Way Bill No:`, rX + 3.5, curY + 26);
    doc.setFont('helvetica', 'bold');
    doc.text(data.logistics.ewayBillNo || '—', rX + 35, curY + 26);

    doc.setFont('helvetica', 'normal');
    doc.text(`E-Way Date:`, rX + 3.5, curY + 31);
    doc.text(`${data.logistics.ewayBillDate || '—'} (Till: ${data.logistics.tillDate || '—'})`, rX + 35, curY + 31);

    doc.text(`Expected Delivery:`, rX + 3.5, curY + 36);
    doc.setFont('helvetica', 'bold');
    doc.text(data.expectedDelivery, rX + 35, curY + 36);

    curY += cardH + 5;

    // ── SECTION 3: RAW MATERIALS & NON-INVENTORY ITEMS WITH CATEGORY & UOM ──
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(...darkTextColor);
    doc.text('3. BROWSE RAW MATERIALS & NON-INVENTORY ITEMS WITH CATEGORY & UOM', margin, curY);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(...vibrantIndigo);
    doc.text(
      `Added Items (${data.financials.totalItemsCount}) • Total Quantity: ${data.financials.totalQuantity.toLocaleString('en-IN', { maximumFractionDigits: 3 })} units`,
      pageWidth - margin,
      curY,
      { align: 'right' }
    );
    curY += 2.5;

    // Table Header Setup
    const cols = [
      { id: 'num', header: '#', w: 8, align: 'center' },
      { id: 'name', header: 'Raw Material / Description / Code', w: 60, align: 'left' },
      { id: 'qty', header: 'Quantity', w: 18, align: 'center' },
      { id: 'uom', header: 'UOM', w: 14, align: 'center' },
      { id: 'price', header: 'Rate (Rs.)', w: 20, align: 'right' },
      { id: 'tax', header: 'Tax %', w: 14, align: 'center' },
      { id: 'lab', header: 'Lab Status', w: 22, align: 'center' },
      { id: 'total', header: 'Subtotal (Rs.)', w: 30, align: 'right' }
    ];

    const printTableHeader = (y) => {
      doc.setFillColor(...tableHeaderBg);
      doc.rect(margin, y, contentWidth, 6.5, 'F');
      doc.setDrawColor(...tableHeaderBg);
      doc.rect(margin, y, contentWidth, 6.5, 'S');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(255, 255, 255);

      let colX = margin;
      cols.forEach(col => {
        if (col.align === 'center') {
          doc.text(col.header, colX + (col.w / 2), y + 4.5, { align: 'center' });
        } else if (col.align === 'right') {
          doc.text(col.header, colX + col.w - 2, y + 4.5, { align: 'right' });
        } else {
          doc.text(col.header, colX + 2, y + 4.5);
        }
        colX += col.w;
      });
      return y + 6.5;
    };

    curY = printTableHeader(curY);

    // Render Items and Nested Batches
    data.items.forEach((item, idx) => {
      const hasBatches = Array.isArray(item.batches) && item.batches.length > 0;
      const batchCount = hasBatches ? item.batches.length : 0;
      const estimatedRowH = batchCount > 0 ? (9 + (batchCount * 5.2)) : 9;

      // Page break check (allows items to cleanly fill each A4 page down to the footer)
      if (curY + estimatedRowH > pageHeight - 18) {
        doc.addPage();
        // Top accent banners on continuation page
        doc.setFillColor(24, 28, 48);
        doc.rect(0, 0, pageWidth, 3.5, 'F');
        doc.setFillColor(67, 56, 202);
        doc.rect(0, 3.5, pageWidth, 1.2, 'F');

        curY = 13;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(...primaryDark);
        doc.text(`PURCHASE ORDER: ${data.referenceNo} (Continued...)`, margin, curY);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(...mutedTextColor);
        doc.text(`Supplier: ${data.supplier.name}`, pageWidth - margin, curY, { align: 'right' });

        curY += 3;
        curY = printTableHeader(curY);
      }

      // Zebra background
      if (idx % 2 === 1) {
        doc.setFillColor(248, 250, 252);
        doc.rect(margin, curY, contentWidth, estimatedRowH, 'F');
      }

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(...darkTextColor);

      let colX = margin;

      // 1. Index
      doc.text(String(item.index), colX + 4, curY + 4.5, { align: 'center' });
      colX += cols[0].w;

      // 2. Name & Category
      doc.setFont('helvetica', 'bold');
      doc.text(item.name.substring(0, 32), colX + 2, curY + 4);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(...mutedTextColor);
      doc.text(`${item.code} • ${item.category}`.substring(0, 38), colX + 2, curY + 7.5);
      doc.setFontSize(7.5);
      doc.setTextColor(...darkTextColor);
      colX += cols[1].w;

      // 3. Quantity
      doc.setFont('helvetica', 'bold');
      doc.text(item.quantity.toLocaleString('en-IN'), colX + (cols[2].w / 2), curY + 5, { align: 'center' });
      doc.setFont('helvetica', 'normal');
      colX += cols[2].w;

      // 4. UOM
      doc.text(item.uom.toUpperCase(), colX + (cols[3].w / 2), curY + 5, { align: 'center' });
      colX += cols[3].w;

      // 5. Rate
      doc.text(`Rs. ${item.unitPrice.toFixed(2)}`, colX + cols[4].w - 2, curY + 5, { align: 'right' });
      colX += cols[4].w;

      // 6. Tax % Pill
      doc.setFillColor(238, 242, 255);
      doc.roundedRect(colX + 2, curY + 2.5, cols[5].w - 4, 4.2, 1, 1, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.5);
      doc.setTextColor(67, 56, 202);
      doc.text(`${item.gstPercent}%`, colX + (cols[5].w / 2), curY + 5.5, { align: 'center' });
      colX += cols[5].w;

      // 7. Lab Status Color-Graded Badge
      const isLabReq = item.labTestStatus === 'Lab Required';
      const badgeW = 21;
      const badgeH = 4.2;
      const badgeX = colX + (cols[6].w - badgeW) / 2;
      const badgeY = curY + 2.5;

      doc.setFillColor(isLabReq ? 209 : 255, isLabReq ? 250 : 228, isLabReq ? 229 : 230);
      doc.setDrawColor(isLabReq ? 110 : 253, isLabReq ? 231 : 164, isLabReq ? 183 : 175);
      doc.roundedRect(badgeX, badgeY, badgeW, badgeH, 1, 1, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6);
      doc.setTextColor(isLabReq ? 6 : 190, isLabReq ? 95 : 18, isLabReq ? 70 : 60);
      doc.text(item.labTestStatus, colX + (cols[6].w / 2), badgeY + 3, { align: 'center' });
      colX += cols[6].w;

      // 8. Subtotal
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(...darkTextColor);
      doc.text(`Rs. ${item.subtotal.toFixed(2)}`, colX + cols[7].w - 2, curY + 5, { align: 'right' });

      // Nested Batches Sub-Rows with Stylish Indigo Accents
      if (hasBatches) {
        let batchY = curY + 9;
        item.batches.forEach((b) => {
          // Soft card background for batch
          doc.setFillColor(245, 247, 255);
          doc.rect(margin + cols[0].w, batchY - 0.5, contentWidth - cols[0].w, 4.6, 'F');

          // Royal indigo accent stripe on the left of batch
          doc.setFillColor(79, 70, 229);
          doc.rect(margin + cols[0].w, batchY - 0.5, 1.2, 4.6, 'F');

          // Batch index pill
          doc.setFillColor(224, 231, 255);
          doc.roundedRect(margin + cols[0].w + 2.5, batchY + 0.2, 7.5, 3.2, 0.6, 0.6, 'F');
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(5.5);
          doc.setTextColor(67, 56, 202);
          doc.text(`#${b.batchIndex}`, margin + cols[0].w + 6.2, batchY + 2.5, { align: 'center' });

          // Batch details text
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(6.5);
          doc.setTextColor(30, 27, 75);
          doc.text(`Our Batch: `, margin + cols[0].w + 12, batchY + 2.6);
          doc.setTextColor(67, 56, 202);
          doc.text(`${b.batchNumber}`, margin + cols[0].w + 25, batchY + 2.6);

          doc.setFont('helvetica', 'normal');
          doc.setTextColor(71, 85, 105);
          const bDetails = ` |  Qty: ${b.quantity} ${item.uom}  |  Pack: ${b.weight || '—'}  |  MFG Batch: ${b.mfgBatchNo || '—'}  |  MFG: ${b.mfgDate || '—'}  |  Exp: ${b.expDate || '—'}`;
          doc.text(bDetails.substring(0, 95), margin + cols[0].w + 60, batchY + 2.6);

          batchY += 4.8;
        });
      }

      // Row separator line
      curY += estimatedRowH;
      doc.setDrawColor(241, 245, 249);
      doc.line(margin, curY, pageWidth - margin, curY);
    });

    // Items table bottom border
    doc.setDrawColor(...borderColor);
    doc.line(margin, curY, pageWidth - margin, curY);
    curY += 5;

    // Check space for Section 4 & 5 totals block + Section 6 signatures block (approx 78mm)
    if (curY + 78 > pageHeight - 12) {
      doc.addPage();
      doc.setFillColor(24, 28, 48);
      doc.rect(0, 0, pageWidth, 3.5, 'F');
      doc.setFillColor(67, 56, 202);
      doc.rect(0, 3.5, pageWidth, 1.2, 'F');

      curY = 14;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(...primaryDark);
      doc.text(`PURCHASE ORDER: ${data.referenceNo} — FINANCIAL SUMMARY & SIGNATURES`, margin, curY);
      curY += 5;
    }

    // ── SECTION 4 & 5: FINANCIAL SUMMARY & PAYMENT DETAILS (TWO COLUMNS) ──
    const sumCardH = 49;

    // Left Box: Payment Details & Amount in Words
    doc.setFillColor(...bgLight);
    doc.setDrawColor(...borderColor);
    doc.roundedRect(margin, curY, colW, sumCardH, 2, 2, 'FD');

    // Header strip
    doc.setFillColor(...softIndigo);
    doc.rect(margin, curY, colW, 6.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.8);
    doc.setTextColor(...royalIndigo);
    doc.text('5. PAYMENT & SETTLEMENT DETAILS', margin + 3.5, curY + 4.5);

    // Payment Status badge
    const isPaid = data.payment.paymentStatus === 'PAID';
    const isPart = data.payment.paymentStatus === 'PARTIALLY_PAID';
    doc.setFontSize(6.8);
    doc.setTextColor(isPaid ? 6 : isPart ? 180 : 190, isPaid ? 95 : isPart ? 83 : 18, isPaid ? 70 : isPart ? 9 : 60);
    doc.text(`Status: ${data.payment.paymentStatus}`, margin + colW - 3.5, curY + 4.5, { align: 'right' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105);
    doc.text(`Total Payable:`, margin + 3.5, curY + 11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...darkTextColor);
    doc.text(`Rs. ${data.payment.totalPayable.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, margin + 35, curY + 11);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(`Amount Paid:`, margin + 3.5, curY + 15.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(22, 101, 52); // green
    doc.text(`Rs. ${data.payment.paidAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, margin + 35, curY + 15.5);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(`Balance Due:`, margin + 3.5, curY + 20);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(190, 18, 60); // rose
    doc.text(`Rs. ${data.payment.balanceDue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, margin + 35, curY + 20);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(`Channel / Mode: ${data.payment.paymentMode}  |  Ref: ${data.payment.paymentRef}`, margin + 3.5, curY + 24.5);

    // Amount in Words Callout
    doc.setFillColor(243, 232, 255);
    doc.setDrawColor(216, 180, 254);
    doc.roundedRect(margin + 2.5, curY + 28, colW - 5, 14, 1.5, 1.5, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(107, 33, 168);
    doc.text('TOTAL AMOUNT IN WORDS (INR):', margin + 5, curY + 32);

    doc.setFont('helvetica', 'bolditalic');
    doc.setFontSize(6.8);
    doc.setTextColor(...darkTextColor);
    const wordsLines = doc.splitTextToSize(data.financials.amountInWords, colW - 10);
    doc.text(wordsLines.slice(0, 2), margin + 5, curY + 36);

    // Right Box: Charges & Financial Summary
    doc.setFillColor(...bgLight);
    doc.setDrawColor(...borderColor);
    doc.roundedRect(rX, curY, colW, sumCardH, 2, 2, 'FD');

    doc.setFillColor(...softIndigo);
    doc.rect(rX, curY, colW, 6.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.8);
    doc.setTextColor(...royalIndigo);
    doc.text('4. CHARGES & FINANCIAL SUMMARY', rX + 3.5, curY + 4.5);

    let finY = curY + 11;
    const printFinRow = (label, val, isBold = false) => {
      doc.setFont('helvetica', isBold ? 'bold' : 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(isBold ? darkTextColor[0] : 71, isBold ? darkTextColor[1] : 85, isBold ? darkTextColor[2] : 105);
      doc.text(label, rX + 3.5, finY);
      doc.text(val, rX + colW - 3.5, finY, { align: 'right' });
      finY += 4.2;
    };

    printFinRow(
      `Items Subtotal (${data.financials.totalItemsCount} items, ${data.financials.totalQuantity} units):`,
      `Rs. ${data.financials.subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
    );

    if (data.financials.discount > 0) {
      printFinRow(`Discount:`, `-Rs. ${data.financials.discount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`);
    }

    if (data.financials.shipping > 0) {
      const shipLabel = data.financials.shippingGstApplicable 
        ? `Freight / Shipping (+${data.financials.shippingGstPercentage}% GST):` 
        : `Freight / Shipping:`;
      printFinRow(shipLabel, `+Rs. ${data.financials.shipping.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`);
    }

    if (data.financials.otherCharges > 0) {
      const chLabel = data.financials.otherChargesGstApplicable 
        ? `${data.financials.otherChargesLabel || 'Other Charges'} (+${data.financials.otherChargesGstPercentage}% GST):` 
        : `${data.financials.otherChargesLabel || 'Other Charges'}:`;
      printFinRow(chLabel, `+Rs. ${data.financials.otherCharges.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`);
    }

    if (data.isInterState) {
      printFinRow(`IGST (Interstate):`, `Rs. ${data.financials.igstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`);
    } else {
      printFinRow(`CGST (Intrastate):`, `Rs. ${data.financials.cgstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`);
      printFinRow(`SGST (Intrastate):`, `Rs. ${data.financials.sgstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`);
    }

    if (data.financials.roundOff !== 0) {
      printFinRow(`Round Off:`, `${data.financials.roundOff > 0 ? '+' : ''}Rs. ${data.financials.roundOff.toFixed(2)}`);
    }

    // High-Contrast Grand Total Block
    doc.setFillColor(30, 27, 75);
    doc.roundedRect(rX + 2, finY - 0.5, colW - 4, 8, 1.5, 1.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(255, 255, 255);
    doc.text('GRAND TOTAL:', rX + 5, finY + 4.8);
    doc.setFontSize(9.5);
    doc.setTextColor(254, 240, 138); // Golden Amber
    doc.text(`Rs. ${data.financials.grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, rX + colW - 5, finY + 4.8, { align: 'right' });

    curY += sumCardH + 5;

    // ── SECTION 6: TERMS & AUTHORIZED SIGNATURES ──
    if (curY > pageHeight - 32) {
      doc.addPage();
      curY = 16;
    }

    doc.setDrawColor(...borderColor);
    doc.line(margin, curY, pageWidth - margin, curY);
    curY += 4;

    const sigW = contentWidth / 4;
    const sigLabels = ['Prepared By', 'Verified By QC', 'Authorized Signatory', 'Supplier Stamp & Sign'];
    const sigVals = [data.creator, 'Quality Manager', 'Factory Manager', data.supplier.name.substring(0, 18)];

    sigLabels.forEach((lbl, sIdx) => {
      const sX = margin + (sIdx * sigW);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(...mutedTextColor);
      doc.text(lbl, sX + (sigW / 2), curY + 2, { align: 'center' });

      doc.setDrawColor(203, 213, 225);
      doc.line(sX + 4, curY + 12, sX + sigW - 4, curY + 12);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(...darkTextColor);
      doc.text(sigVals[sIdx], sX + (sigW / 2), curY + 15.5, { align: 'center' });
    });

    // ── MULTI-PAGE AUDIT NUMBERING FOOTER ──
    const totalPages = doc.getNumberOfPages();
    for (let p = 1; p <= totalPages; p++) {
      doc.setPage(p);
      doc.setDrawColor(226, 232, 240);
      doc.line(margin, pageHeight - 9, pageWidth - margin, pageHeight - 9);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(...mutedTextColor);

      // Left: Company & PO Ref
      doc.text(
        `ERP Purchase Order: ${data.referenceNo} · ${data.company.name}`,
        margin,
        pageHeight - 5
      );

      // Center: Audit stamp
      doc.text(
        `Certified ERP Document · Generated: ${data.createdAt}`,
        pageWidth / 2,
        pageHeight - 5,
        { align: 'center' }
      );

      // Right: Page X of Y
      doc.text(
        `Page ${p} of ${totalPages}`,
        pageWidth - margin,
        pageHeight - 5,
        { align: 'right' }
      );
    }

    // Direct PDF File Download
    const cleanRef = (data.referenceNo || 'PO').replace(/[^a-zA-Z0-9_-]/g, '_');
    const dateStamp = format(new Date(), 'yyyy-MM-dd_HHmm');
    const filename = `Purchase_Order_${cleanRef}_${dateStamp}.pdf`;

    doc.save(filename);

    Swal.fire({
      icon: 'success',
      title: 'PDF Downloaded Successfully',
      html: `
        <div class="text-left text-xs space-y-1">
          <p>Purchase Order <strong>${data.referenceNo}</strong> downloaded as PDF!</p>
          <p class="text-slate-500 font-mono text-[11px]">• File: <strong>${filename}</strong></p>
          <p class="text-slate-500 font-mono text-[11px]">• Raw Materials: <strong>${data.financials.totalItemsCount}</strong> items</p>
          <p class="text-slate-500 font-mono text-[11px]">• Total Quantity: <strong>${data.financials.totalQuantity}</strong> units</p>
          <p class="text-slate-500 font-mono text-[11px]">• Grand Total: <strong>Rs. ${data.financials.grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></p>
        </div>
      `,
      timer: 3500,
      showConfirmButton: false,
      toast: true,
      position: 'top-end'
    });
  } catch (err) {
    console.error('Failed to generate Purchase Order PDF:', err);
    Swal.fire({
      icon: 'error',
      title: 'PDF Generation Error',
      text: err.message || 'Could not compile Purchase Order PDF.'
    });
  }
}
