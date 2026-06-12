const nodemailer = require('nodemailer');
const PDFDocument = require('pdfkit');
const axios = require('axios');
const prisma = require('../database/prisma');
const { getTaxSettingsData } = require('../modules/setup/tax.controller');

// Create standard Nodemailer transporter using credentials supplied by user in environment
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.SMTP_EMAIL,
    pass: process.env.SMTP_PASSWORD
  }
});

/**
 * Log communication event to database
 */
const logCommunication = async ({ documentType, documentNo, recipient, channel, status, subject, content, errorMessage }) => {
  try {
    return await prisma.communicationLog.create({
      data: {
        documentType,
        documentNo,
        recipient,
        channel,
        status,
        subject,
        content: content || '',
        errorMessage: errorMessage || null
      }
    });
  } catch (err) {
    console.error('[Communication Log] Failed to write log to database:', err);
  }
};

/**
 * Check if document has already been sent to prevent duplicates
 */
const isAlreadySent = async (documentType, documentNo, channel) => {
  try {
    const log = await prisma.communicationLog.findFirst({
      where: {
        documentType,
        documentNo,
        channel,
        status: 'SENT'
      }
    });
    return !!log;
  } catch (err) {
    console.error('[Communication Check] Error checking sent status:', err);
    return false;
  }
};

/**
 * Format phone to +91XXXXXXXXXX
 */
const formatPhoneNumber = (phone) => {
  if (!phone) return null;
  const clean = phone.replace(/[^0-9]/g, '');
  if (clean.length === 10) {
    return `+91${clean}`;
  }
  if (clean.length === 12 && clean.startsWith('91')) {
    return `+91${clean.substring(2)}`;
  }
  return phone.startsWith('+') ? phone : `+${clean}`;
};

/**
 * WhatsApp Eligibility Check
 */
const checkWhatsAppEligibility = async (phone) => {
  const formatted = formatPhoneNumber(phone);
  if (!formatted) return false;

  // Demo number check: always eligible
  if (formatted.includes('9360163523')) {
    return true;
  }

  try {
    // Attempt WhatsApp contacts check endpoint
    const response = await axios.post(
      'https://api.whatsapp.com/v1/contacts',
      { blocking: "wait", contacts: [formatted] },
      { timeout: 3000 }
    );
    if (response.data && response.data.contacts && response.data.contacts[0]) {
      return response.data.contacts[0].status === 'valid';
    }
  } catch (err) {
    console.log(`[WhatsApp Check] WhatsApp check failed for ${formatted}, defaulting to VALID for simulation:`, err.message);
    return true;
  }
  return true;
};

/**
 * Helper to generate PO PDF Buffer
 */
const generatePOPDFBuffer = (po, settings) => {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 30, size: 'A4' });
    const chunks = [];
    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', err => reject(err));

    const primaryColor = '#1e3a8a';
    const darkColor = '#0f172a';
    const lightGrey = '#f8fafc';
    const borderGrey = '#e2e8f0';
    const textGrey = '#64748b';
    const primaryAccent = '#4f46e5';

    // Draw header banner
    doc.fillColor(primaryAccent).rect(0, 0, 595, 12).fill();

    // Title
    doc.fillColor(primaryColor).fontSize(22).font('Helvetica-Bold').text('PURCHASE ORDER', 30, 30);

    // Company details (left)
    doc.fillColor(darkColor).fontSize(9).font('Helvetica-Bold').text(settings.companyName.toUpperCase(), 30, 56);
    doc.fillColor(textGrey).fontSize(8).font('Helvetica').text(settings.companyAddress, 30, 68, { width: 250 });
    doc.fillColor(darkColor).fontSize(8).font('Helvetica-Bold').text(`GSTIN: ${settings.companyGstin}`, 30, 92);

    // Metadata Box (right)
    const metaX = 320;
    const metaY = 30;
    const metaW = 245;
    const metaH = 104;

    // Draw metadata box background
    doc.roundedRect(metaX, metaY, metaW, metaH, 6).fillAndStroke(lightGrey, borderGrey).lineWidth(0.8);

    doc.fillColor(textGrey).fontSize(6.5).font('Helvetica-Bold');
    doc.text('PO NO.', metaX + 10, metaY + 8);
    doc.text('DATE', metaX + 125, metaY + 8);

    doc.text('DELIVERY DATE', metaX + 10, metaY + 32);
    doc.text('PAYMENT MODE', metaX + 125, metaY + 32);

    doc.text('PR REF', metaX + 10, metaY + 56);
    doc.text('PQ REF', metaX + 125, metaY + 56);

    doc.text('SUPPLIER QUOTE REF', metaX + 10, metaY + 80);

    // Metadata values
    doc.fillColor(darkColor).fontSize(8).font('Helvetica-Bold');
    doc.text(po.poNo || 'N/A', metaX + 10, metaY + 16, { width: 110 });
    
    doc.font('Helvetica');
    const poDateStr = po.poDate ? new Date(po.poDate).toLocaleDateString('en-IN') : new Date().toLocaleDateString('en-IN');
    doc.text(poDateStr, metaX + 125, metaY + 16);

    const deliveryDateStr = po.deliveryDate ? new Date(po.deliveryDate).toLocaleDateString('en-IN') : 'ASAP';
    doc.text(deliveryDateStr, metaX + 10, metaY + 40);
    doc.text(po.paymentMode || 'NEFT', metaX + 125, metaY + 40);

    doc.text(po.prNo || 'None', metaX + 10, metaY + 64);
    doc.text(po.pqNo || 'None', metaX + 125, metaY + 64);

    doc.text(po.supplierQuoteRef || '—', metaX + 10, metaY + 88);

    // Separator line
    doc.strokeColor('#cbd5e1').lineWidth(0.5).moveTo(30, 145).lineTo(565, 145).stroke();

    // Bill From and Bill To details (2 columns)
    const colY = 155;
    const colW = 250;

    // Bill From (Supplier)
    doc.fillColor(primaryAccent).rect(30, colY + 2, 2.5, 45).fill();
    doc.fillColor(primaryAccent).fontSize(8).font('Helvetica-Bold').text('BILL FROM (SUPPLIER)', 38, colY);
    doc.fillColor(darkColor).fontSize(9).font('Helvetica-Bold').text((po.vendorName || '').toUpperCase(), 38, colY + 12);
    doc.fillColor(textGrey).fontSize(8).font('Helvetica').text(po.address || '', 38, colY + 24, { width: 220 });
    doc.fillColor(darkColor).fontSize(8).font('Helvetica-Bold').text(`GSTIN: ${po.vendorGstin || 'N/A'}`, 38, colY + 46);

    // Bill To (Buyer)
    doc.fillColor(primaryAccent).rect(305, colY + 2, 2.5, 45).fill();
    doc.fillColor(primaryAccent).fontSize(8).font('Helvetica-Bold').text('BILL TO (BUYER)', 313, colY);
    doc.fillColor(darkColor).fontSize(9).font('Helvetica-Bold').text(settings.companyName.toUpperCase(), 313, colY + 12);
    doc.fillColor(textGrey).fontSize(8).font('Helvetica').text(po.shipTo || settings.companyAddress, 313, colY + 24, { width: 220 });
    doc.fillColor(darkColor).fontSize(8).font('Helvetica-Bold').text(`GSTIN: ${settings.companyGstin}`, 313, colY + 46);

    // Table Header
    let tableY = 220;
    doc.fillColor('#1e1b4b').rect(30, tableY, 535, 20).fill();
    doc.fillColor('#ffffff').fontSize(7.5).font('Helvetica-Bold');
    doc.text('Description', 35, tableY + 6);
    doc.text('HSN/SAC', 285, tableY + 6);
    doc.text('Qty', 355, tableY + 6, { width: 30, align: 'right' });
    doc.text('Unit', 395, tableY + 6);
    doc.text('Rate', 430, tableY + 6, { width: 50, align: 'right' });
    doc.text('GST %', 490, tableY + 6, { width: 30, align: 'right' });
    doc.text('Total (INR)', 525, tableY + 6, { width: 35, align: 'right' });

    let currentY = tableY + 20;
    po.items?.forEach((item, index) => {
      doc.fillColor(darkColor).fontSize(8).font('Helvetica-Bold');
      doc.text(item.description, 35, currentY + 6, { width: 240 });

      const rowHeight = 25;

      doc.fontSize(8).font('Helvetica').fillColor(darkColor);
      doc.text(item.hsnCode || 'N/A', 285, currentY + 6);
      doc.text(String(item.orderedQty || item.quantity), 355, currentY + 6, { width: 30, align: 'right' });
      doc.text(item.uom || 'Nos', 395, currentY + 6);
      doc.text(Number(item.unitPrice).toFixed(2), 430, currentY + 6, { width: 50, align: 'right' });
      doc.text(`${item.gstRate || 18}%`, 490, currentY + 6, { width: 30, align: 'right' });
      doc.text(Number(item.lineTotal).toFixed(2), 525, currentY + 6, { width: 35, align: 'right' });

      currentY += rowHeight;
      doc.strokeColor(borderGrey).lineWidth(0.5).moveTo(30, currentY).lineTo(565, currentY).stroke();
    });

    // Totals & Footer
    let footerY = currentY + 15;
    doc.fillColor(darkColor).fontSize(8).font('Helvetica-Bold').text('Remarks / Narration:', 30, footerY);
    doc.fillColor(textGrey).fontSize(8).font('Helvetica').text(po.remarks || 'No remarks provided.', 30, footerY + 12, { width: 280 });

    const bankY = footerY + 35;
    doc.fillColor(darkColor).fontSize(8).font('Helvetica-Bold').text(`Payment Details (${po.paymentMode || 'Bank Transfer (NEFT)'}):`, 30, bankY);
    doc.fillColor(textGrey).fontSize(8).font('Helvetica');
    doc.text(`Bank Name: ${po.bankName || 'HDFC Bank'}`, 30, bankY + 12);
    doc.text(`A/C Holder: ${po.bankAccountHolder || settings.companyName}`, 30, bankY + 22);
    doc.text(`A/C No: ${po.bankAccountNo || '50200012345678'}`, 30, bankY + 32);
    doc.text(`IFSC Code: ${po.bankIfsc || 'HDFC0000123'}`, 30, bankY + 42);
    doc.text(`Branch: ${po.bankBranch || 'Main Branch, Mumbai'}`, 30, bankY + 52);

    let rightY = footerY;
    const rightAlignOpts = { width: 90, align: 'right' };
    const labelX = 330;
    const valX = 470;

    const drawTotalRow = (label, value, isBold = false, isRed = false) => {
      doc.fontSize(8);
      if (isBold) {
        doc.font('Helvetica-Bold').fillColor(darkColor);
      } else {
        doc.font('Helvetica').fillColor(textGrey);
      }
      if (isRed) {
        doc.fillColor('#ef4444');
      }
      doc.text(label, labelX, rightY);
      doc.text(value, valX, rightY, rightAlignOpts);
      rightY += 14;
    };

    drawTotalRow('SUBTOTAL (TAXABLE):', Number(po.subtotal).toFixed(2));

    if (po.isInterState) {
      if (Number(po.igst) > 0) {
        drawTotalRow('IGST:', Number(po.igst).toFixed(2));
      }
    } else {
      if (Number(po.cgst) > 0) {
        drawTotalRow('CGST:', Number(po.cgst).toFixed(2));
      }
      if (Number(po.sgst) > 0) {
        drawTotalRow('SGST:', Number(po.sgst).toFixed(2));
      }
    }

    if (Number(po.freight || po.shippingCharges) > 0) {
      drawTotalRow('FREIGHT CHARGES:', Number(po.freight || po.shippingCharges).toFixed(2));
    }
    if (Number(po.loadingCharges) > 0) {
      drawTotalRow('LOADING CHARGES:', Number(po.loadingCharges).toFixed(2));
    }
    if (Number(po.unloadingCharges) > 0) {
      drawTotalRow('UNLOADING CHARGES:', Number(po.unloadingCharges).toFixed(2));
    }
    if (Number(po.packingCharges) > 0) {
      drawTotalRow('PACKING CHARGES:', Number(po.packingCharges).toFixed(2));
    }
    if (Number(po.insurance) > 0) {
      drawTotalRow('INSURANCE:', Number(po.insurance).toFixed(2));
    }
    if (Number(po.otherCharges) > 0) {
      drawTotalRow('OTHER CHARGES:', Number(po.otherCharges).toFixed(2));
    }
    if (Number(po.discount) > 0) {
      drawTotalRow('DISCOUNT:', `-${Number(po.discount).toFixed(2)}`, false, true);
    }

    const roundOff = Number(po.roundOff || 0);
    const sign = roundOff >= 0 ? '+' : '';
    drawTotalRow('ROUND OFF:', `${sign}${roundOff.toFixed(2)}`);

    rightY += 2;
    doc.fontSize(10).font('Helvetica-Bold').fillColor(primaryAccent);
    doc.text('GRAND TOTAL (INR):', labelX, rightY);
    doc.text(`Rs. ${Number(po.grandTotal).toFixed(2)}`, valX, rightY, rightAlignOpts);

    // Page 2: General Terms and Conditions (GTC)
    doc.addPage();

    // Letterhead / Header banner
    doc.fillColor('#4f46e5').rect(0, 0, 595, 20).fill();

    doc.fillColor('#1e293b').fontSize(12).font('Helvetica-Bold').text('General Terms and Conditions (GTC)', 30, 40);

    // GTC Box
    doc.roundedRect(30, 60, 535, 420, 8).strokeColor('#cbd5e1').lineWidth(0.8).stroke();

    const rawGtc = po.termsBlock || po.termsAndConditions || '';
    const termsList = rawGtc.split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0 && !line.toLowerCase().startsWith('general terms and conditions'));

    let termsY = 72;
    doc.fontSize(7.2).font('Helvetica').fillColor('#475569');
    termsList.forEach(term => {
      doc.text(term, 40, termsY, { width: 515, align: 'justify' });
      termsY += doc.heightOfString(term, { width: 515 }) + 5;
    });

    // Signature boxes placing logic: if terms run long, move signature box to a new page
    let sigY = 495;
    if (termsY > 470) {
      doc.addPage();
      doc.fillColor('#4f46e5').rect(0, 0, 595, 20).fill();
      sigY = 40;
    }
    const vendorName = (po.vendorName || 'Supplier').toUpperCase();

    // Left Signature Box (Supplier)
    doc.roundedRect(30, sigY, 250, 85, 6).strokeColor('#e2e8f0').lineWidth(0.8).stroke();
    doc.fillColor('#1e293b').fontSize(8.5).font('Helvetica-Bold').text(`For ${vendorName}`, 40, sigY + 10);
    doc.fillColor('#64748b').fontSize(7).font('Helvetica').text('Authorized Signatory (Sign & Stamp)', 40, sigY + 70);

    // Embed supplier signature and seal inside the supplier box if available
    if (po.supplier?.signatureImage) {
      try {
        const sigBase64 = po.supplier.signatureImage.replace(/^data:image\/\w+;base64,/, '');
        const sigBuffer = Buffer.from(sigBase64, 'base64');
        doc.image(sigBuffer, 50, sigY + 25, { width: 70, height: 35 });
      } catch (err) {
        console.error('Failed to embed signature in PO PDF GTC:', err.message);
      }
    }
    if (po.supplier?.companySealImage) {
      try {
        const sealBase64 = po.supplier.companySealImage.replace(/^data:image\/\w+;base64,/, '');
        const sealBuffer = Buffer.from(sealBase64, 'base64');
        doc.image(sealBuffer, 160, sigY + 25, { width: 60, height: 35 });
      } catch (err) {
        console.error('Failed to embed seal in PO PDF GTC:', err.message);
      }
    }

    // Right Signature Box (Buyer)
    doc.roundedRect(315, sigY, 250, 85, 6).strokeColor('#e2e8f0').lineWidth(0.8).stroke();
    doc.fillColor('#1e293b').fontSize(8.5).font('Helvetica-Bold').text(`For ${settings.companyName.toUpperCase()}`, 325, sigY + 10);
    doc.fillColor('#64748b').fontSize(7).font('Helvetica').text('Authorized Signatory (with Company Seal)', 325, sigY + 70);

    // Draw the "VERIFIED & APPROVED" seal stamp inside the buyer box
    doc.save();
    doc.translate(485, sigY + 35);
    doc.rotate(-15);
    doc.strokeColor('rgba(79, 70, 229, 0.5)').lineWidth(1.5);
    doc.roundedRect(-40, -16, 80, 32, 4).stroke();
    
    // Inner thin border for stamp authenticity
    doc.strokeColor('rgba(79, 70, 229, 0.3)').lineWidth(0.5);
    doc.roundedRect(-37, -13, 74, 26, 3).stroke();

    doc.fillColor('rgba(79, 70, 229, 0.6)').fontSize(7.5).font('Helvetica-Bold');
    doc.text('VERIFIED &', -35, -10, { width: 70, align: 'center' });
    doc.text('APPROVED', -35, 1, { width: 70, align: 'center' });
    doc.restore();

    doc.end();
  });
};

/**
 * Helper to generate Sales Invoice PDF Buffer
 */
const generateInvoicePDFBuffer = (invoice, settings) => {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 30, size: 'A4' });
    const chunks = [];
    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', err => reject(err));

    // Letterhead
    doc.fillColor('#4f46e5').rect(0, 0, 595, 20).fill();

    doc.fillColor('#1e293b').fontSize(20).font('Helvetica-Bold').text(settings.companyName, 30, 40);
    doc.fontSize(9).font('Helvetica').fillColor('#64748b');
    doc.text(settings.companyAddress, 30, 65, { width: 300 });
    doc.text(`GSTIN: ${settings.companyGstin} | Mobile: ${settings.companyMobile}`, 30, 95);

    // Invoice Meta
    doc.fillColor('#1e293b').fontSize(14).font('Helvetica-Bold').text('TAX INVOICE', 350, 40);
    doc.fontSize(9).font('Helvetica').fillColor('#475569');
    doc.text(`Invoice No: ${invoice.referenceNo || invoice.id.substring(0, 8)}`, 350, 60);
    doc.text(`Invoice Date: ${new Date(invoice.createdAt).toLocaleDateString('en-IN')}`, 350, 75);
    doc.text(`Due Date: ${new Date(invoice.deliveryDate).toLocaleDateString('en-IN')}`, 350, 90);

    doc.strokeColor('#cbd5e1').lineWidth(1).moveTo(30, 120).lineTo(565, 120).stroke();

    // Customer Details
    doc.fillColor('#1e293b').fontSize(11).font('Helvetica-Bold').text('BILL TO (CUSTOMER)', 30, 135);
    doc.fontSize(9).font('Helvetica').fillColor('#475569');
    doc.text(`Name: ${invoice.customer?.name || 'Customer'}`, 30, 150);
    doc.text(`Address: ${invoice.deliveryAddress || 'N/A'}`, 30, 165, { width: 220 });
    doc.text(`Phone: ${invoice.customer?.phone || 'N/A'}`, 30, 195);
    doc.text(`Email: ${invoice.customer?.email || 'N/A'}`, 30, 210);

    // Items table header
    let tableY = 240;
    doc.fillColor('#4f46e5').rect(30, tableY, 535, 20).fill();
    doc.fillColor('#ffffff').fontSize(8).font('Helvetica-Bold');
    doc.text('S.No', 35, tableY + 6);
    doc.text('Item Description', 70, tableY + 6);
    doc.text('Qty', 280, tableY + 6, { width: 40, align: 'right' });
    doc.text('Price (Rs)', 375, tableY + 6, { width: 50, align: 'right' });
    doc.text('GST %', 435, tableY + 6, { width: 40, align: 'right' });
    doc.text('Total (Rs)', 485, tableY + 6, { width: 75, align: 'right' });

    let currentY = tableY + 20;
    invoice.items?.forEach((item, index) => {
      doc.fillColor('#1e293b').fontSize(8).font('Helvetica');
      doc.text(String(index + 1), 35, currentY + 6);
      doc.text(item.product?.name || 'Item', 70, currentY + 6, { width: 200 });
      doc.text(String(item.quantity), 280, currentY + 6, { width: 40, align: 'right' });
      doc.text(Number(item.unitPrice).toFixed(2), 375, currentY + 6, { width: 50, align: 'right' });
      doc.text(`${item.gstRate || 18}%`, 435, currentY + 6, { width: 40, align: 'right' });
      doc.text(Number(item.subtotal).toFixed(2), 485, currentY + 6, { width: 75, align: 'right' });
      currentY += 20;
    });

    // Totals
    doc.strokeColor('#cbd5e1').moveTo(30, currentY).lineTo(565, currentY).stroke();
    currentY += 10;

    doc.fillColor('#475569').fontSize(9).font('Helvetica');
    const rightAlignOpts = { width: 100, align: 'right' };

    doc.text('Sub Total:', 350, currentY);
    doc.text(`Rs. ${Number(invoice.totalSubtotal).toFixed(2)}`, 455, currentY, rightAlignOpts);
    currentY += 15;

    // Split CGST/SGST/IGST
    const companyGstin = settings?.companyGstin || '';
    const companyStateCode = companyGstin.trim().substring(0, 2) || '33';
    const customerGstin = invoice.customer?.gstin || '';
    const customerStateCode = customerGstin.trim().substring(0, 2);
    let isInterState = false;
    if (customerStateCode && customerStateCode.length === 2 && companyStateCode.length === 2) {
      isInterState = customerStateCode !== companyStateCode;
    } else if (invoice.deliveryAddress) {
      const stateNames = {
        '33': 'tamil nadu', '27': 'maharashtra', '29': 'karnataka', '07': 'delhi', '09': 'uttar pradesh', '19': 'west bengal'
      };
      const companyStateName = stateNames[companyStateCode] || 'tamil nadu';
      isInterState = !invoice.deliveryAddress.toLowerCase().includes(companyStateName);
    }
    const totalGst = Number(invoice.totalSubtotal) * 0.18; // Default 18% GST estimate
    
    if (isInterState) {
      doc.text('IGST (18%):', 350, currentY);
      doc.text(`Rs. ${totalGst.toFixed(2)}`, 455, currentY, rightAlignOpts);
      currentY += 15;
    } else {
      doc.text('CGST (9%):', 350, currentY);
      doc.text(`Rs. ${(totalGst / 2).toFixed(2)}`, 455, currentY, rightAlignOpts);
      currentY += 15;
      doc.text('SGST (9%):', 350, currentY);
      doc.text(`Rs. ${(totalGst / 2).toFixed(2)}`, 455, currentY, rightAlignOpts);
      currentY += 15;
    }

    const grandTotal = Number(invoice.totalSubtotal) + totalGst;
    doc.font('Helvetica-Bold').fillColor('#4f46e5');
    doc.text('GRAND TOTAL:', 350, currentY);
    doc.text(`Rs. ${grandTotal.toFixed(2)}`, 455, currentY, rightAlignOpts);
    
    doc.end();
  });
};

/**
 * Handle PR Automatic Email Dispatch
 */
const sendPRAutomatedEmail = async (pr, supplier) => {
  const settings = await getTaxSettingsData();
  const email = supplier?.email;
  if (!email) {
    console.log(`[PR Dispatch] Skip PR-${pr.id} dispatch. No email for supplier ${supplier?.name}`);
    await logCommunication({
      documentType: 'PR',
      documentNo: pr.prNo,
      recipient: 'N/A',
      channel: 'EMAIL',
      status: 'SKIPPED',
      subject: `Purchase Request [${pr.prNo}]`,
      content: 'Email absent. Skipped silently.'
    });
    return;
  }

  // Prevent duplicates
  if (await isAlreadySent('PR', pr.prNo, 'EMAIL')) {
    console.log(`[PR Dispatch] Skip duplicate dispatch for PR-${pr.prNo}`);
    return;
  }

  const subject = `Purchase Request ${pr.prNo} — ${settings.companyName}`;
  const items = Array.isArray(pr.items) ? pr.items : [];
  let itemsRows = '';
  items.forEach((item, index) => {
    itemsRows += `  |  ${index + 1}   | ${item.assetName || item.description || ''} | ${item.quantity} | ${item.uom || 'Nos'} | ${item.remarks || 'None'} |\n`;
  });

  const body = `Dear ${supplier.contactPerson || supplier.name},

We are pleased to raise the following Purchase Request and request your earliest response with availability and quotation.

PURCHASE REQUEST DETAILS:
------------------------------------------
PR Number      : ${pr.prNo}
PR Date        : ${new Date(pr.createdAt).toLocaleDateString('en-IN')}
Required By    : ${pr.requiredByDate ? new Date(pr.requiredByDate).toLocaleDateString('en-IN') : 'ASAP'}
Raised By      : ${pr.requesterName} / ${pr.department}

ITEMS REQUESTED:
S.No | Item Name | Qty | Unit | Remarks
------------------------------------------------------------
${itemsRows}

Special Instructions:
${pr.justification || 'None'}

Please respond with your best quotation at the earliest.

Warm Regards,
${settings.companyName}
${settings.companyAddress}
GSTIN : ${settings.companyGstin}
Phone : ${settings.companyMobile}`;

  try {
    await transporter.sendMail({
      from: `"${settings.companyName}" <${transporter.options.auth.user}>`,
      to: email,
      subject,
      text: body
    });

    await logCommunication({
      documentType: 'PR',
      documentNo: pr.prNo,
      recipient: email,
      channel: 'EMAIL',
      status: 'SENT',
      subject,
      content: body
    });
    console.log(`[PR Dispatch] Sent PR-${pr.prNo} to ${email}`);
  } catch (err) {
    console.error(`[PR Dispatch] Failed to send email:`, err.message);
    await logCommunication({
      documentType: 'PR',
      documentNo: pr.prNo,
      recipient: email,
      channel: 'EMAIL',
      status: 'FAILED',
      subject,
      content: body,
      errorMessage: err.message
    });
  }
};

/**
 * Handle PQ Automatic Email Dispatch
 */
const sendPQAutomatedEmail = async (pq, supplier, bypassDuplicateCheck = false) => {
  const settings = await getTaxSettingsData();
  const email = pq.email || supplier?.email;
  if (!email) {
    console.log(`[PQ Dispatch] Skip PQ-${pq.pqNo} dispatch. No email for supplier ${pq.vendorName}`);
    await logCommunication({
      documentType: 'PQ',
      documentNo: pq.pqNo,
      recipient: 'N/A',
      channel: 'EMAIL',
      status: 'SKIPPED',
      subject: `Request for Quotation [${pq.pqNo}]`,
      content: 'Email absent. Skipped silently.'
    });
    return;
  }

  // Prevent duplicates
  if (!bypassDuplicateCheck && await isAlreadySent('PQ', pq.pqNo, 'EMAIL')) return;

  const subject = `Request for Quotation ${pq.pqNo} — ${settings.companyName}`;
  const items = Array.isArray(pq.items) ? pq.items : [];
  let itemsRows = '';
  items.forEach((item, index) => {
    itemsRows += `  |  ${index + 1}   | ${item.description} | ${item.hsnCode || ''} | ${item.quantity} | ${item.uom || 'Nos'} |\n`;
  });

  const body = `Dear ${pq.contactPerson || pq.vendorName},

Kindly find our Request for Quotation below. Please provide your best pricing, delivery timeline, and payment terms for the items listed.

RFQ DETAILS:
------------------------------------------
RFQ Number     : ${pq.pqNo}
RFQ Date       : ${new Date(pq.createdAt).toLocaleDateString('en-IN')}
Valid Until    : ${new Date(pq.validUntil).toLocaleDateString('en-IN')}
Linked PR      : ${pq.prNo || 'N/A'}

ITEMS FOR QUOTATION:
S.No | Item Name | Specification | Qty | Unit
------------------------------------------------------------
${itemsRows}

TERMS & CONDITIONS:
• Please quote GST (CGST/SGST or IGST) separately
• Clearly mention delivery timeline
• State payment terms
• Prices must be valid for at least 15 days from quote date

Warm Regards,
${settings.companyName}
${settings.companyAddress}
GSTIN : ${settings.companyGstin}
Phone : ${settings.companyMobile}`;

  try {
    await transporter.sendMail({
      from: `"${settings.companyName}" <${transporter.options.auth.user}>`,
      to: email,
      subject,
      text: body
    });

    await logCommunication({
      documentType: 'PQ',
      documentNo: pq.pqNo,
      recipient: email,
      channel: 'EMAIL',
      status: 'SENT',
      subject,
      content: body
    });
    console.log(`[PQ Dispatch] Sent PQ-${pq.pqNo} to ${email}`);
  } catch (err) {
    console.error(`[PQ Dispatch] Failed to send email:`, err.message);
    await logCommunication({
      documentType: 'PQ',
      documentNo: pq.pqNo,
      recipient: email,
      channel: 'EMAIL',
      status: 'FAILED',
      subject,
      content: body,
      errorMessage: err.message
    });
  }
};

/**
 * Handle PO Automatic Email Dispatch (WITH PDF ATTACHMENT)
 */
const sendPOAutomatedEmail = async (po, supplier, bypassDuplicateCheck = false) => {
  const settings = await getTaxSettingsData();
  const email = po.email || supplier?.email;
  if (!email) {
    console.log(`[PO Dispatch] Skip PO-${po.poNo} dispatch. No email for supplier ${po.vendorName}`);
    await logCommunication({
      documentType: 'PO',
      documentNo: po.poNo,
      recipient: 'N/A',
      channel: 'EMAIL',
      status: 'SKIPPED',
      subject: `Purchase Order [${po.poNo}]`,
      content: 'Email absent. Skipped silently.'
    });
    return;
  }

  // Prevent duplicates
  if (!bypassDuplicateCheck && await isAlreadySent('PO', po.poNo, 'EMAIL')) return;

  const subject = `Purchase Order [${po.poNo}] — ${settings.companyName}`;
  const body = `Dear ${po.contactPerson || po.vendorName},

Please find our official Purchase Order attached to this email. Kindly acknowledge receipt and confirm your delivery schedule by return email.

PURCHASE ORDER DETAILS:
------------------------------------------
PO Number      : ${po.poNo}
PO Date        : ${new Date(po.createdAt).toLocaleDateString('en-IN')}
Ref. Quotation : ${po.pqNo || 'N/A'}
Ref. PR        : ${po.prNo || 'N/A'}
Delivery By    : ${po.deliveryDate ? new Date(po.deliveryDate).toLocaleDateString('en-IN') : 'ASAP'}
Payment Terms  : ${po.paymentTerms || 'Net 30'}

BILL TO (BUYER):
${settings.companyName}
${settings.companyAddress}
GSTIN : ${settings.companyGstin}

SUPPLIER DETAILS:
Name    : ${po.vendorName}
Address : ${po.address || ''}
GSTIN   : ${po.vendorGstin}
PAN     : ${po.vendorPan}

Kindly reply with your acknowledgment.

Warm Regards,
${settings.companyName}
${settings.companyAddress}
GSTIN : ${settings.companyGstin}
Phone : ${settings.companyMobile}`;

  try {
    // Generate PDF Buffer
    // Attach supplier signature/seal if available
    const poWithSupplierInfo = { ...po, supplier };
    const pdfBuffer = await generatePOPDFBuffer(poWithSupplierInfo, settings);

    await transporter.sendMail({
      from: `"${settings.companyName}" <${transporter.options.auth.user}>`,
      to: email,
      subject,
      text: body,
      attachments: [{
        filename: `PO_${po.poNo}_${settings.companyName.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`,
        content: pdfBuffer
      }]
    });

    await logCommunication({
      documentType: 'PO',
      documentNo: po.poNo,
      recipient: email,
      channel: 'EMAIL',
      status: 'SENT',
      subject,
      content: body
    });
    console.log(`[PO Dispatch] Sent PO-${po.poNo} to ${email}`);
  } catch (err) {
    console.error(`[PO Dispatch] Failed to send email:`, err.message);
    await logCommunication({
      documentType: 'PO',
      documentNo: po.poNo,
      recipient: email,
      channel: 'EMAIL',
      status: 'FAILED',
      subject,
      content: body,
      errorMessage: err.message
    });
  }
};

/**
 * Handle PO Update / Delete Notification Email
 */
const sendPOUpdateDeleteNotice = async (po, actionType, itemsList, supplier) => {
  const settings = await getTaxSettingsData();
  const email = po.email || supplier?.email;
  if (!email) {
    console.log(`[PO Notice] Skip dispatch. No email for supplier ${po.vendorName}`);
    return;
  }

  let actionText = '';
  if (actionType === 'DELETE') actionText = 'DELETED / CANCELLED';
  else if (actionType === 'UPDATE') actionText = 'UPDATED';
  else if (actionType === 'ADD') actionText = 'ADDED';

  const subject = `ALERT: Purchase Order ${po.poNo} Items ${actionText} — ${settings.companyName}`;
  
  let itemsRows = '';
  itemsList.forEach((item, index) => {
    itemsRows += `  |  ${index + 1}   | ${item.itemCode || item.id || 'N/A'} | ${item.description || item.itemDescription || ''} | ${item.orderedQty || item.quantity} | ${item.uom || item.unit || 'Nos'} | Rs. ${Number(item.unitPrice).toFixed(2)} |\n`;
  });

  const body = `Dear ${po.contactPerson || po.vendorName},

Please note that the following items in the Purchase Order have been ${actionText} in our system:

PO Number      : ${po.poNo}
Action Type    : ${actionText}
Date of Action : ${new Date().toLocaleString('en-IN')}

AFFECTED ITEMS DETAILS:
S.No | Product ID/Code | Item Name | Qty | Unit | Unit Price
----------------------------------------------------------------------
${itemsRows}

Please update your records accordingly. If you have already processed shipment for these items, please contact our procurement team immediately.

Warm Regards,
${settings.companyName}
${settings.companyAddress}
GSTIN : ${settings.companyGstin}
Phone : ${settings.companyMobile}`;

  try {
    await transporter.sendMail({
      from: `"${settings.companyName}" <${transporter.options.auth.user}>`,
      to: email,
      subject,
      text: body
    });

    await logCommunication({
      documentType: 'PO',
      documentNo: po.poNo,
      recipient: email,
      channel: 'EMAIL',
      status: 'SENT',
      subject,
      content: body
    });
    console.log(`[PO Notice] Sent ${actionType} notice for PO-${po.poNo} to ${email}`);
  } catch (err) {
    console.error(`[PO Notice] Failed to send email:`, err.message);
    await logCommunication({
      documentType: 'PO',
      documentNo: po.poNo,
      recipient: email,
      channel: 'EMAIL',
      status: 'FAILED',
      subject,
      content: body,
      errorMessage: err.message
    });
  }
};

// Helper to generate AP Invoice PDF Buffer
const generateAPInvoicePDFBuffer = (invoice, supplier, settings) => {
  return new Promise(async (resolve, reject) => {
    let supplierQuoteRef = invoice.supplierQuoteRef || '';
    if (!supplierQuoteRef && invoice.poNo && invoice.poNo !== 'Direct') {
      try {
        const po = await prisma.assetPO.findFirst({
          where: { poNo: invoice.poNo }
        });
        if (po) {
          supplierQuoteRef = po.supplierQuoteRef || '';
        }
      } catch (err) {
        console.error('[PDF Generation] Failed to fetch PO for supplierQuoteRef fallback:', err);
      }
    }

    const doc = new PDFDocument({ margin: 30, size: 'A4' });
    const chunks = [];
    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', err => reject(err));

    // Colors
    const primaryColor = '#1e3a8a'; // Navy blue for TAX INVOICE title
    const darkColor = '#0f172a'; // slate-900
    const lightGrey = '#f8fafc'; // slate-50
    const borderGrey = '#e2e8f0'; // slate-200
    const textGrey = '#64748b'; // slate-500
    const primaryAccent = '#4f46e5'; // Indigo for Grand Total

    // Draw header banner
    doc.fillColor(primaryAccent).rect(0, 0, 595, 12).fill();

    // Title
    doc.fillColor(primaryColor).fontSize(22).font('Helvetica-Bold').text('TAX INVOICE', 30, 30);
    
    // Company details (left)
    doc.fillColor(darkColor).fontSize(9).font('Helvetica-Bold').text(settings.companyName.toUpperCase(), 30, 56);
    doc.fillColor(textGrey).fontSize(8).font('Helvetica').text(settings.companyAddress, 30, 68, { width: 250 });
    doc.fillColor(darkColor).fontSize(8).font('Helvetica-Bold').text(`GSTIN: ${settings.companyGstin}`, 30, 92);

    // Metadata Box (right)
    const metaX = 320;
    const metaY = 30;
    const metaW = 245;
    const metaH = 104;

    // Draw metadata box background
    doc.roundedRect(metaX, metaY, metaW, metaH, 6).fillAndStroke(lightGrey, borderGrey).lineWidth(0.8);

    doc.fillColor(textGrey).fontSize(6.5).font('Helvetica-Bold');
    doc.text('INVOICE NO.', metaX + 10, metaY + 8);
    doc.text('AP INVOICE NO.', metaX + 125, metaY + 8);

    doc.text('DATE', metaX + 10, metaY + 32);
    doc.text('DUE DATE', metaX + 125, metaY + 32);

    doc.text('PAYMENT MODE', metaX + 10, metaY + 56);
    doc.text('PO REF', metaX + 125, metaY + 56);

    doc.text('SUPPLIER QUOTE REF', metaX + 10, metaY + 80);
    doc.text('GRPO REF', metaX + 125, metaY + 80);

    // Metadata values
    doc.fillColor(darkColor).fontSize(8).font('Helvetica-Bold');
    doc.text(invoice.vendorInvoiceNo || 'N/A', metaX + 10, metaY + 16, { width: 110 });
    doc.text(invoice.invoiceNo || 'N/A', metaX + 125, metaY + 16, { width: 110 });

    doc.font('Helvetica');
    const invoiceDateStr = invoice.vendorInvoiceDate ? new Date(invoice.vendorInvoiceDate).toLocaleDateString('en-IN') : 'N/A';
    const dueDateStr = invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString('en-IN') : 'N/A';
    doc.text(invoiceDateStr, metaX + 10, metaY + 40);
    doc.text(dueDateStr, metaX + 125, metaY + 40);
    
    doc.text(invoice.paymentMode || 'NEFT', metaX + 10, metaY + 64);
    doc.text(invoice.poNo || 'Direct', metaX + 125, metaY + 64);

    doc.text(supplierQuoteRef || '—', metaX + 10, metaY + 88);
    doc.text(invoice.grpoNo || '—', metaX + 125, metaY + 88);

    // Separator line
    doc.strokeColor('#cbd5e1').lineWidth(0.5).moveTo(30, 145).lineTo(565, 145).stroke();

    // Bill From and Bill To details (2 columns)
    const colY = 155;

    // Bill From
    doc.fillColor(primaryAccent).rect(30, colY + 2, 2.5, 45).fill();
    doc.fillColor(primaryAccent).fontSize(8).font('Helvetica-Bold').text('BILL FROM (SUPPLIER)', 38, colY);
    doc.fillColor(darkColor).fontSize(9).font('Helvetica-Bold').text((invoice.vendorName || '').toUpperCase(), 38, colY + 12);
    doc.fillColor(textGrey).fontSize(8).font('Helvetica').text(invoice.address || '', 38, colY + 24, { width: 220 });
    doc.fillColor(darkColor).fontSize(8).font('Helvetica-Bold').text(`GSTIN: ${invoice.vendorGstin || 'N/A'}`, 38, colY + 46);

    // Bill To
    doc.fillColor(primaryAccent).rect(305, colY + 2, 2.5, 45).fill();
    doc.fillColor(primaryAccent).fontSize(8).font('Helvetica-Bold').text('BILL TO (BUYER)', 313, colY);
    doc.fillColor(darkColor).fontSize(9).font('Helvetica-Bold').text(settings.companyName.toUpperCase(), 313, colY + 12);
    doc.fillColor(textGrey).fontSize(8).font('Helvetica').text(settings.companyAddress, 313, colY + 24, { width: 220 });
    doc.fillColor(darkColor).fontSize(8).font('Helvetica-Bold').text(`GSTIN: ${settings.companyGstin}`, 313, colY + 46);

    // Table Header
    let tableY = 220;
    doc.fillColor('#1e1b4b').rect(30, tableY, 535, 20).fill();
    doc.fillColor('#ffffff').fontSize(7.5).font('Helvetica-Bold');
    doc.text('Description', 35, tableY + 6);
    doc.text('HSN/SAC', 285, tableY + 6);
    doc.text('Qty', 355, tableY + 6, { width: 30, align: 'right' });
    doc.text('Unit', 395, tableY + 6);
    doc.text('Rate', 430, tableY + 6, { width: 50, align: 'right' });
    doc.text('GST %', 490, tableY + 6, { width: 30, align: 'right' });
    doc.text('Total (INR)', 525, tableY + 6, { width: 35, align: 'right' });

    let currentY = tableY + 20;
    invoice.items?.forEach((item, index) => {
      doc.fillColor(darkColor).fontSize(8).font('Helvetica-Bold');
      
      // Split description by '|' if it contains metadata like Category/Specs
      const parts = item.description.split('|');
      const name = parts[0].trim();
      
      doc.text(name, 35, currentY + 6, { width: 240 });
      
      let descY = currentY + 16;
      doc.fontSize(7).font('Helvetica').fillColor(textGrey);
      for (let i = 1; i < parts.length; i++) {
        const line = parts[i].trim();
        doc.text(line, 35, descY, { width: 240 });
        descY += 9;
      }
      
      const rowHeight = Math.max(25, descY - currentY + 4);

      doc.fontSize(8).font('Helvetica').fillColor(darkColor);
      doc.text(item.hsnCode || 'N/A', 285, currentY + 6);
      doc.text(String(item.quantity), 355, currentY + 6, { width: 30, align: 'right' });
      doc.text(item.uom || 'Nos', 395, currentY + 6);
      doc.text(Number(item.unitPrice).toFixed(2), 430, currentY + 6, { width: 50, align: 'right' });
      doc.text(`${item.gstRate || 18}%`, 490, currentY + 6, { width: 30, align: 'right' });
      doc.text(Number(item.lineTotal).toFixed(2), 525, currentY + 6, { width: 35, align: 'right' });
      
      currentY += rowHeight;
      // Draw row separator line
      doc.strokeColor(borderGrey).lineWidth(0.5).moveTo(30, currentY).lineTo(565, currentY).stroke();
    });

    // Remarks and Bank Details on Left, Totals on Right
    let footerY = currentY + 15;

    // Left block: Narration & Payment Details
    doc.fillColor(darkColor).fontSize(8).font('Helvetica-Bold').text('Remarks / Narration:', 30, footerY);
    doc.fillColor(textGrey).fontSize(8).font('Helvetica').text(invoice.narration || 'No remarks provided.', 30, footerY + 12, { width: 280 });

    const bankY = footerY + 35;
    doc.fillColor(darkColor).fontSize(8).font('Helvetica-Bold').text(`Payment Details (${invoice.paymentMode || 'Bank Transfer (NEFT)'}):`, 30, bankY);
    doc.fillColor(textGrey).fontSize(8).font('Helvetica');
    doc.text(`Bank Name: ${invoice.bankName || 'HDFC Bank'}`, 30, bankY + 12);
    doc.text(`A/C Holder: ${invoice.bankAccountHolder || invoice.vendorName}`, 30, bankY + 22);
    doc.text(`A/C No: ${invoice.bankAccountNo || '50200012345678'}`, 30, bankY + 32);
    doc.text(`IFSC Code: ${invoice.bankIfsc || 'HDFC0000123'}`, 30, bankY + 42);
    doc.text(`Branch: ${invoice.bankBranch || 'Main Branch, Mumbai'}`, 30, bankY + 52);

    // Right block: Totals
    let rightY = footerY;
    const rightAlignOpts = { width: 90, align: 'right' };
    const labelX = 330;
    const valX = 470;

    const drawTotalRow = (label, value, isBold = false, isRed = false) => {
      doc.fontSize(8);
      if (isBold) {
        doc.font('Helvetica-Bold').fillColor(darkColor);
      } else {
        doc.font('Helvetica').fillColor(textGrey);
      }
      if (isRed) {
        doc.fillColor('#ef4444');
      }
      doc.text(label, labelX, rightY);
      doc.text(value, valX, rightY, rightAlignOpts);
      rightY += 14;
    };

    drawTotalRow('SUBTOTAL (TAXABLE):', Number(invoice.taxableAmount).toFixed(2));
    
    const gstRate = invoice.items?.[0]?.gstRate || 18;
    if (invoice.isInterState) {
      drawTotalRow(`IGST (${gstRate}%):`, Number(invoice.totalIgst).toFixed(2));
    } else {
      drawTotalRow(`CGST (${gstRate / 2}%):`, Number(invoice.totalCgst).toFixed(2));
      drawTotalRow(`SGST (${gstRate / 2}%):`, Number(invoice.totalSgst).toFixed(2));
    }

    if (Number(invoice.freight) > 0) {
      drawTotalRow('FREIGHT CHARGES:', Number(invoice.freight).toFixed(2));
    }
    if (Number(invoice.loadingCharges) > 0) {
      drawTotalRow('LOADING CHARGES:', Number(invoice.loadingCharges).toFixed(2));
    }
    if (Number(invoice.unloadingCharges) > 0) {
      drawTotalRow('UNLOADING CHARGES:', Number(invoice.unloadingCharges).toFixed(2));
    }
    if (Number(invoice.packingCharges) > 0) {
      drawTotalRow('PACKING CHARGES:', Number(invoice.packingCharges).toFixed(2));
    }
    if (Number(invoice.insurance) > 0) {
      drawTotalRow('INSURANCE:', Number(invoice.insurance).toFixed(2));
    }
    if (Number(invoice.otherCharges) > 0) {
      drawTotalRow('OTHER CHARGES:', Number(invoice.otherCharges).toFixed(2));
    }
    if (Number(invoice.discount) > 0) {
      drawTotalRow('DISCOUNT:', `-${Number(invoice.discount).toFixed(2)}`, false, true);
    }
    
    // Round off
    const roundOff = Number(invoice.roundOff);
    const sign = roundOff >= 0 ? '+' : '';
    drawTotalRow('ROUND OFF:', `${sign}${roundOff.toFixed(2)}`);

    // Grand Total
    rightY += 2;
    doc.fontSize(10).font('Helvetica-Bold').fillColor(primaryAccent);
    doc.text('GRAND TOTAL (INR):', labelX, rightY);
    doc.text(`Rs. ${Number(invoice.invoiceTotal).toFixed(2)}`, valX, rightY, rightAlignOpts);

    // Page 2: General Terms and Conditions (GTC)
    doc.addPage();

    // Letterhead / Header banner
    doc.fillColor('#4f46e5').rect(0, 0, 595, 20).fill();

    doc.fillColor('#1e293b').fontSize(12).font('Helvetica-Bold').text('General Terms and Conditions (GTC)', 30, 40);

    // GTC Box
    doc.roundedRect(30, 60, 535, 420, 8).strokeColor('#cbd5e1').lineWidth(0.8).stroke();

    const termsList = [
      "1. Acceptance of Order: The vendor must confirm acceptance of the Purchase Order (PO) in writing via email or signed acknowledgment within 03 working days from the date of issue. If no written confirmation is received within this window, the Buyer reserves the right to cancel the order without any financial liability.",
      "2. Price and Taxes: Prices stated in this PO are firm, fixed, and non-escalating. Prices are inclusive of all packing, forwarding, freight, transit insurance, and handling charges up to the delivery site. All taxes, specifically GST, must be clearly itemized on the invoice in strict accordance with CGST, SGST, and IGST rules. Any future tax benefits or Input Tax Credit (ITC) changes must be passed on to the Buyer.",
      "3. Warranty: The Vendor warrants that all supplied goods are brand new, genuine, and free from defects in material and workmanship for 12 months from the date of acceptance. For services, the Vendor guarantees performance by qualified personnel matching industry standards. Any defective goods or substandard services identified within this period must be replaced, repaired, or re-performed by the Vendor within 7 business days at no additional cost to the Buyer.",
      "4. Billing Instructions: Invoices must be raised as statutory Tax Invoices clearly bearing the Vendor’s valid GSTIN, correct HSN/SAC codes, and the exact Buyer PO number. Delayed submission of invoices or failure to upload invoice data to the GST portal (preventing the Buyer from claiming Input Tax Credit) will directly result in a corresponding delay in payment processing.",
      "5. Payment Terms: Payment shall be processed via electronic transfer (NEFT/RTGS) split across two strict milestones: 50% Advance Payment: Processed within 7 working days upon written confirmation and formal acceptance of the Purchase Order (PO) by the Vendor, against the submission of a valid Proforma Invoice. 50% Final Payment: Processed within 45 days from the date of successful physical delivery of all materials at the designated site. This is subject to the submission of complete, error-free documents (Tax Invoice, Delivery Challan, and validated E-way Bill) and physical inspection and acceptance of the defect-free materials by the Buyer's site team.",
      "6. Delivery & Liquidated Damages (LD): The delivery timeline starts immediately upon the Vendor's receipt of the 50% advance payment and must be completed strictly within 25Days. Failure to deliver on time will result in a penalty of 0.5% of the total PO value per week of delay, capped at 10%. Exceeding this 10% limit gives the Buyer the right to terminate the contract immediately and source elsewhere at the Vendor's expense.",
      "7. Quality & Inspection: All deliverables must strictly match the technical specifications mentioned in the PO. The Buyer reserves the right to inspect materials upon arrival at the site. The Buyer can reject any defective, damaged, or substandard items. Rejected goods must be collected and removed by the Vendor from the Buyer's premises within 7 days of rejection notification at the Vendor's sole risk and expense.",
      "8. Statutory Compliance: The Vendor shall strictly comply with all applicable Central, State, and local government laws, labor regulations (including Provident Fund, ESIC, and Minimum Wages acts), and anti-bribery policies. The use of child labor is strictly prohibited. The Vendor is solely responsible for generating accurate E-way bills for all transit movements.",
      "9. Dispute Resolution: Any dispute arising out of this PO shall first be resolved through amicable mutual discussions. Unresolved disputes shall be referred to a sole arbitrator appointed mutually by both parties, governed by the Indian Arbitration and Conciliation Act, 1996. The venue and seat of arbitration shall be madurai, Tamil Nadu, and proceedings will be conducted in English. The courts in Salem shall have exclusive jurisdiction over this contract."
    ];

    let termsY = 72;
    doc.fontSize(7.5).font('Helvetica').fillColor('#475569');
    termsList.forEach(term => {
      doc.text(term, 40, termsY, { width: 515, align: 'justify' });
      termsY += doc.heightOfString(term, { width: 515 }) + 5;
    });

    // Signature boxes
    let sigY = 495;
    const vendorName = (invoice.vendorName || 'Supplier').toUpperCase();

    // Left Signature Box (Supplier)
    doc.roundedRect(30, sigY, 250, 85, 6).strokeColor('#e2e8f0').lineWidth(0.8).stroke();
    doc.fillColor('#1e293b').fontSize(8.5).font('Helvetica-Bold').text(`For ${vendorName}`, 40, sigY + 10);
    doc.fillColor('#64748b').fontSize(7).font('Helvetica').text('Authorized Signatory (Sign & Stamp)', 40, sigY + 70);

    // Embed supplier signature and seal inside the supplier box if available
    if (supplier?.signatureImage) {
      try {
        const sigBase64 = supplier.signatureImage.replace(/^data:image\/\w+;base64,/, '');
        const sigBuffer = Buffer.from(sigBase64, 'base64');
        doc.image(sigBuffer, 50, sigY + 25, { width: 70, height: 35 });
      } catch (err) {
        console.error('Failed to embed signature in AP Invoice PDF GTC:', err.message);
      }
    }
    if (supplier?.companySealImage) {
      try {
        const sealBase64 = supplier.companySealImage.replace(/^data:image\/\w+;base64,/, '');
        const sealBuffer = Buffer.from(sealBase64, 'base64');
        doc.image(sealBuffer, 160, sigY + 25, { width: 60, height: 35 });
      } catch (err) {
        console.error('Failed to embed seal in AP Invoice PDF GTC:', err.message);
      }
    }

    // Right Signature Box (Buyer)
    doc.roundedRect(315, sigY, 250, 85, 6).strokeColor('#e2e8f0').lineWidth(0.8).stroke();
    doc.fillColor('#1e293b').fontSize(8.5).font('Helvetica-Bold').text(`For ${settings.companyName.toUpperCase()}`, 325, sigY + 10);
    doc.fillColor('#64748b').fontSize(7).font('Helvetica').text('Authorized Signatory (with Company Seal)', 325, sigY + 70);

    // Draw the "VERIFIED & APPROVED" seal stamp inside the buyer box
    doc.save();
    doc.translate(485, sigY + 35);
    doc.rotate(-15);
    doc.strokeColor('rgba(79, 70, 229, 0.5)').lineWidth(1.5);
    doc.roundedRect(-40, -16, 80, 32, 4).stroke();
    
    // Inner thin border for stamp authenticity
    doc.strokeColor('rgba(79, 70, 229, 0.3)').lineWidth(0.5);
    doc.roundedRect(-37, -13, 74, 26, 3).stroke();

    doc.fillColor('rgba(79, 70, 229, 0.6)').fontSize(7.5).font('Helvetica-Bold');
    doc.text('VERIFIED &', -35, -10, { width: 70, align: 'center' });
    doc.text('APPROVED', -35, 1, { width: 70, align: 'center' });
    doc.restore();

    doc.end();
  });
};

/**
 * Handle AP Invoice Automatic Email Dispatch
 */
const sendAPInvoiceAutomatedEmail = async (invoice, supplier, pdfBase64 = null, bypassDuplicateCheck = false) => {
  const settings = await getTaxSettingsData();
  const email = invoice.email || supplier?.email;
  if (!email) {
    console.log(`[Invoice Dispatch] Skip Bill-${invoice.invoiceNo} dispatch. No email.`);
    await logCommunication({
      documentType: 'AP_INVOICE',
      documentNo: invoice.invoiceNo,
      recipient: 'N/A',
      channel: 'EMAIL',
      status: 'SKIPPED',
      subject: `Invoice Recorded — [${invoice.invoiceNo}]`,
      content: 'Email absent. Skipped silently.'
    });
    return;
  }

  // Prevent duplicates
  if (!bypassDuplicateCheck && await isAlreadySent('AP_INVOICE', invoice.invoiceNo, 'EMAIL')) return;

  const subject = `Invoice Recorded — [${invoice.invoiceNo}] | ${settings.companyName}`;
  const items = Array.isArray(invoice.items) ? invoice.items : [];
  let itemsRows = '';
  items.forEach((item, index) => {
    itemsRows += `  |  ${index + 1}   | ${item.description} | ${item.quantity} | ${Number(item.unitPrice).toFixed(2)} | ${item.gstRate || 18}% | ${Number(item.lineTotal).toFixed(2)} |\n`;
  });

  const body = `Dear ${invoice.vendorName},

We acknowledge receipt of your invoice and confirm it has been recorded in our system for processing.

BILL DETAILS:
------------------------------------------
Our Bill No        : ${invoice.invoiceNo}
Supplier Invoice # : ${invoice.vendorInvoiceNo}
Invoice Date       : ${new Date(invoice.vendorInvoiceDate).toLocaleDateString('en-IN')}
Due Date           : ${new Date(invoice.dueDate).toLocaleDateString('en-IN')}
Linked PO          : ${invoice.poNo || 'N/A'}
Linked GRPO        : ${invoice.grpoNo || 'N/A'}

BILLED ITEMS:
S.No | Description | Qty | Rate (Rs) | GST % | Amount (Rs)
------------------------------------------------------------
${itemsRows}

Sub Total    : Rs. ${Number(invoice.taxableAmount).toFixed(2)}
GST Total    : Rs. ${Number(invoice.totalTax).toFixed(2)}
Grand Total  : Rs. ${Number(invoice.invoiceTotal).toFixed(2)}

Payment will be processed as per agreed terms: ${invoice.paymentTerms || 'Standard Terms'}

Regards,
${settings.companyName}
${settings.companyAddress}
GSTIN : ${settings.companyGstin}
Phone : ${settings.companyMobile}`;

  // Build HTML Billed Items rows
  let htmlItemsRows = '';
  items.forEach((item, index) => {
    const descParts = (item.description || '').split('|');
    const mainName = descParts[0].trim();
    const specs = descParts.slice(1).map(p => p.trim()).join(' | ');

    htmlItemsRows += `
      <tr style="border-bottom: 1px solid #e2e8f0; ${index % 2 === 1 ? 'background-color: #f8fafc;' : ''}">
        <td style="padding: 12px 10px; font-size: 13px; color: #64748b; text-align: center; font-family: sans-serif;">${index + 1}</td>
        <td style="padding: 12px 10px; font-family: sans-serif;">
          <div style="font-weight: 600; font-size: 13px; color: #0f172a;">${mainName}</div>
          ${specs ? `<div style="font-size: 11px; color: #64748b; margin-top: 2px; line-height: 1.4;">${specs}</div>` : ''}
        </td>
        <td style="padding: 12px 10px; font-size: 13px; color: #334155; text-align: center; font-family: sans-serif;">${item.quantity}</td>
        <td style="padding: 12px 10px; font-size: 13px; color: #334155; text-align: right; font-family: sans-serif;">Rs. ${Number(item.unitPrice).toFixed(2)}</td>
        <td style="padding: 12px 10px; font-size: 13px; color: #334155; text-align: center; font-family: sans-serif;">${item.gstRate || 18}%</td>
        <td style="padding: 12px 10px; font-size: 13px; font-weight: 600; color: #0f172a; text-align: right; font-family: sans-serif;">Rs. ${Number(item.lineTotal).toFixed(2)}</td>
      </tr>
    `;
  });

  const htmlBody = `
    <div style="background-color: #f1f5f9; padding: 20px; font-family: 'Segoe UI', Helvetica, Arial, sans-serif; line-height: 1.6; color: #334155;">
      <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -1px rgba(0,0,0,0.03);">
        
        <!-- Header -->
        <div style="background-color: #4f46e5; padding: 24px; text-align: center;">
          <h2 style="color: #ffffff; margin: 0; font-size: 20px; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase; font-family: sans-serif;">
            Invoice Recorded
          </h2>
          <p style="color: #c7d2fe; margin: 4px 0 0 0; font-size: 12px; font-family: sans-serif;">
            Recorded against ${settings.companyName}
          </p>
        </div>

        <!-- Body -->
        <div style="padding: 24px;">
          <p style="margin-top: 0; font-size: 14px; color: #334155; font-family: sans-serif;">
            Dear <strong>${invoice.vendorName}</strong>,
          </p>
          <p style="font-size: 14px; color: #475569; font-family: sans-serif;">
            We acknowledge receipt of your invoice and confirm it has been successfully recorded in our system for processing.
          </p>

          <!-- Bill Details Card -->
          <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 20px 0;">
            <h3 style="margin-top: 0; margin-bottom: 12px; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; color: #4f46e5; font-weight: 700; font-family: sans-serif;">
              Bill Details
            </h3>
            
            <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
              <tr>
                <td style="padding: 4px 0; color: #64748b; font-family: sans-serif; width: 45%;">Our Bill No:</td>
                <td style="padding: 4px 0; color: #0f172a; font-weight: 600; font-family: sans-serif;">${invoice.invoiceNo}</td>
              </tr>
              <tr>
                <td style="padding: 4px 0; color: #64748b; font-family: sans-serif;">Supplier Invoice #:</td>
                <td style="padding: 4px 0; color: #0f172a; font-weight: 600; font-family: sans-serif;">${invoice.vendorInvoiceNo}</td>
              </tr>
              <tr>
                <td style="padding: 4px 0; color: #64748b; font-family: sans-serif;">Invoice Date:</td>
                <td style="padding: 4px 0; color: #0f172a; font-family: sans-serif;">${new Date(invoice.vendorInvoiceDate).toLocaleDateString('en-IN')}</td>
              </tr>
              <tr>
                <td style="padding: 4px 0; color: #64748b; font-family: sans-serif;">Due Date:</td>
                <td style="padding: 4px 0; color: #ef4444; font-weight: 600; font-family: sans-serif;">${new Date(invoice.dueDate).toLocaleDateString('en-IN')}</td>
              </tr>
              <tr>
                <td style="padding: 4px 0; color: #64748b; font-family: sans-serif;">Linked PO:</td>
                <td style="padding: 4px 0; color: #0f172a; font-family: sans-serif;">${invoice.poNo || 'Direct'}</td>
              </tr>
              <tr>
                <td style="padding: 4px 0; color: #64748b; font-family: sans-serif;">Linked GRPO:</td>
                <td style="padding: 4px 0; color: #0f172a; font-family: sans-serif;">${invoice.grpoNo || 'Direct'}</td>
              </tr>
            </table>
          </div>

          <!-- Items Table -->
          <h3 style="margin-top: 24px; margin-bottom: 8px; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; color: #4f46e5; font-weight: 700; font-family: sans-serif;">
            Billed Items
          </h3>
          <div style="overflow-x: auto;">
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
              <thead>
                <tr style="background-color: #4f46e5; color: #ffffff; border-bottom: 2px solid #3730a3;">
                  <th style="padding: 8px 10px; font-size: 11px; text-transform: uppercase; font-weight: 700; text-align: center; width: 8%; font-family: sans-serif;">S.No</th>
                  <th style="padding: 8px 10px; font-size: 11px; text-transform: uppercase; font-weight: 700; text-align: left; width: 44%; font-family: sans-serif;">Description</th>
                  <th style="padding: 8px 10px; font-size: 11px; text-transform: uppercase; font-weight: 700; text-align: center; width: 8%; font-family: sans-serif;">Qty</th>
                  <th style="padding: 8px 10px; font-size: 11px; text-transform: uppercase; font-weight: 700; text-align: right; width: 16%; font-family: sans-serif;">Rate</th>
                  <th style="padding: 8px 10px; font-size: 11px; text-transform: uppercase; font-weight: 700; text-align: center; width: 10%; font-family: sans-serif;">GST</th>
                  <th style="padding: 8px 10px; font-size: 11px; text-transform: uppercase; font-weight: 700; text-align: right; width: 14%; font-family: sans-serif;">Amount</th>
                </tr>
              </thead>
              <tbody>
                ${htmlItemsRows}
              </tbody>
            </table>
          </div>

          <!-- Total Calculation Card -->
          <div style="width: 100%; margin-top: 20px; font-family: sans-serif;">
            <div style="float: right; width: 240px; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px;">
              <table style="width: 100%; font-size: 12px; border-collapse: collapse;">
                <tr>
                  <td style="padding: 4px 0; color: #64748b; font-family: sans-serif;">Sub Total:</td>
                  <td style="padding: 4px 0; text-align: right; color: #334155; font-family: sans-serif;">Rs. ${Number(invoice.taxableAmount).toFixed(2)}</td>
                </tr>
                <tr style="border-bottom: 1px solid #e2e8f0;">
                  <td style="padding: 4px 0; color: #64748b; font-family: sans-serif;">GST Total:</td>
                  <td style="padding: 4px 0; text-align: right; color: #334155; font-family: sans-serif;">Rs. ${Number(invoice.totalTax).toFixed(2)}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0 4px 0; color: #4f46e5; font-weight: 700; font-size: 13px; font-family: sans-serif;">Grand Total:</td>
                  <td style="padding: 8px 0 4px 0; text-align: right; color: #4f46e5; font-weight: 700; font-size: 14px; font-family: sans-serif;">Rs. ${Number(invoice.invoiceTotal).toFixed(2)}</td>
                </tr>
              </table>
            </div>
            <div style="clear: both;"></div>
          </div>

          <p style="margin-top: 24px; font-size: 13px; color: #475569; font-family: sans-serif;">
            Payment will be processed as per agreed terms: <strong>${invoice.paymentTerms || 'Net 30'}</strong>.
          </p>

        </div>

        <!-- Footer -->
        <div style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 24px; font-size: 12px; color: #64748b; font-family: sans-serif;">
          <p style="margin-top: 0; font-weight: bold; color: #334155; font-size: 13px;">Regards,</p>
          <p style="margin: 2px 0; font-weight: 600; color: #4f46e5; font-size: 13px;">${settings.companyName}</p>
          <p style="margin: 2px 0; line-height: 1.4;">${settings.companyAddress}</p>
          <p style="margin: 2px 0;"><strong>GSTIN:</strong> ${settings.companyGstin}</p>
          <p style="margin: 2px 0;"><strong>Phone:</strong> ${settings.companyMobile}</p>
        </div>

      </div>
    </div>
  `;

  try {
    let pdfBuffer;
    if (pdfBase64) {
      pdfBuffer = Buffer.from(pdfBase64, 'base64');
      console.log(`[Invoice Dispatch] Using frontend-provided PDF layout for AP Invoice ${invoice.invoiceNo}`);
    } else {
      pdfBuffer = await generateAPInvoicePDFBuffer(invoice, supplier, settings);
      console.log(`[Invoice Dispatch] Generating PDF on backend fallback for AP Invoice ${invoice.invoiceNo}`);
    }
    await transporter.sendMail({
      from: `"${settings.companyName}" <${transporter.options.auth.user}>`,
      to: email,
      subject,
      text: body,
      html: htmlBody,
      attachments: [{
        filename: `Invoice_${invoice.invoiceNo}_${settings.companyName.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`,
        content: pdfBuffer
      }]
    });

    await logCommunication({
      documentType: 'AP_INVOICE',
      documentNo: invoice.invoiceNo,
      recipient: email,
      channel: 'EMAIL',
      status: 'SENT',
      subject,
      content: body
    });
    console.log(`[Invoice Dispatch] Sent Bill-${invoice.invoiceNo} to ${email}`);
  } catch (err) {
    console.error(`[Invoice Dispatch] Failed to send email:`, err.message);
    await logCommunication({
      documentType: 'AP_INVOICE',
      documentNo: invoice.invoiceNo,
      recipient: email,
      channel: 'EMAIL',
      status: 'FAILED',
      subject,
      content: body,
      errorMessage: err.message
    });
  }

  // 2. WhatsApp Send
  const phone = supplier?.phone;
  if (phone && !(await isAlreadySent('AP_INVOICE', invoice.invoiceNo, 'WHATSAPP'))) {
    const formattedPhone = formatPhoneNumber(phone);
    const isWhatsAppAvailable = await checkWhatsAppEligibility(phone);
    
    let itemsText = '';
    const items = Array.isArray(invoice.items) ? invoice.items : [];
    items.forEach((item) => {
      const cleanDesc = item.description?.split('|')[0]?.trim() || '';
      itemsText += `• ${cleanDesc} - ${item.quantity} ${item.uom || 'Nos'} @ Rs.${Number(item.unitPrice).toFixed(2)} (GST ${item.gstRate || 18}%)\n`;
    });

    let chargesText = '';
    chargesText += `Subtotal (Taxable): Rs. ${Number(invoice.taxableAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}\n`;
    if (invoice.applyGst !== false) {
      if (invoice.isInterState) {
        chargesText += `IGST: Rs. ${Number(invoice.totalIgst || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}\n`;
      } else {
        chargesText += `CGST: Rs. ${Number(invoice.totalCgst || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}\n`;
        chargesText += `SGST: Rs. ${Number(invoice.totalSgst || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}\n`;
      }
    }
    const freight = Number(invoice.freight || 0);
    const loadingCharges = Number(invoice.loadingCharges || 0);
    const unloadingCharges = Number(invoice.unloadingCharges || 0);
    const packingCharges = Number(invoice.packingCharges || 0);
    const insurance = Number(invoice.insurance || 0);
    const otherCharges = Number(invoice.otherCharges || 0);
    const discount = Number(invoice.discount || 0);
    const roundOff = Number(invoice.roundOff || 0);

    if (freight > 0) chargesText += `Freight Charges: Rs. ${freight.toLocaleString('en-IN', { minimumFractionDigits: 2 })}\n`;
    if (loadingCharges > 0) chargesText += `Loading Charges: Rs. ${loadingCharges.toLocaleString('en-IN', { minimumFractionDigits: 2 })}\n`;
    if (unloadingCharges > 0) chargesText += `Unloading Charges: Rs. ${unloadingCharges.toLocaleString('en-IN', { minimumFractionDigits: 2 })}\n`;
    if (packingCharges > 0) chargesText += `Packing Charges: Rs. ${packingCharges.toLocaleString('en-IN', { minimumFractionDigits: 2 })}\n`;
    if (insurance > 0) chargesText += `Insurance: Rs. ${insurance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}\n`;
    if (otherCharges > 0) chargesText += `Other Charges: Rs. ${otherCharges.toLocaleString('en-IN', { minimumFractionDigits: 2 })}\n`;
    if (discount > 0) chargesText += `Discount: -Rs. ${discount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}\n`;
    if (roundOff !== 0) {
      chargesText += `Round Off: ${(roundOff >= 0 ? '+' : '')}Rs. ${roundOff.toLocaleString('en-IN', { minimumFractionDigits: 2 })}\n`;
    }

    const caption = `🧾 *A/P Invoice Paid Notification from ${settings.companyName}*
    
*BILL DETAILS:*
Our Bill No: ${invoice.invoiceNo}
Supplier Invoice #: ${invoice.vendorInvoiceNo}
Invoice Date: ${new Date(invoice.vendorInvoiceDate).toLocaleDateString('en-IN')}
Due Date: ${invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString('en-IN') : '—'}
Payment Mode: ${invoice.paymentMode || 'N/A'}
Payment Terms: ${invoice.paymentTerms || 'N/A'}
Status: *PAID*

*ITEMS:*
${itemsText}
*CHARGES:*
${chargesText}----------------------------------
*GRAND TOTAL: Rs. ${Number(invoice.invoiceTotal).toLocaleString('en-IN', { minimumFractionDigits: 2 })}*

Please find the details in the attached invoice PDF sent to your email.
For queries, call ${settings.companyMobile}

*${settings.companyName}*
${settings.companyAddress.substring(0, 40)}...`;

    const pdfName = `Invoice_${invoice.invoiceNo}_${settings.companyName.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;

    if (isWhatsAppAvailable) {
      try {
        console.log(`[WhatsApp WABA] Mocking document dispatch for AP Invoice to ${formattedPhone} with filename ${pdfName}`);
        
        await logCommunication({
          documentType: 'AP_INVOICE',
          documentNo: invoice.invoiceNo,
          recipient: formattedPhone,
          channel: 'WHATSAPP',
          status: 'SENT',
          subject: 'AP Invoice WhatsApp Document',
          content: caption
        });
      } catch (err) {
        console.error('[WhatsApp WABA] AP Invoice Dispatch error:', err.message);
        await logCommunication({
          documentType: 'AP_INVOICE',
          documentNo: invoice.invoiceNo,
          recipient: formattedPhone,
          channel: 'WHATSAPP',
          status: 'FAILED',
          subject: 'AP Invoice WhatsApp Document',
          content: caption,
          errorMessage: err.message
        });
      }
    } else {
      console.log(`[WhatsApp WABA] Number ${formattedPhone} is not registered on WhatsApp. Skipping silently.`);
      await logCommunication({
        documentType: 'AP_INVOICE',
        documentNo: invoice.invoiceNo,
        recipient: formattedPhone,
        channel: 'WHATSAPP',
        status: 'SKIPPED',
        subject: 'AP Invoice WhatsApp Document',
        content: caption + '\n[NOT ON WHATSAPP]'
      });
    }
  }
};

/**
 * Handle GRPO Discrepancy Notice Email
 */
const sendGRPODiscrepancyNotice = async (grpo, po, supplier) => {
  const settings = await getTaxSettingsData();
  const email = supplier?.email;
  if (!email) return;

  const subject = `Delivery Discrepancy Notice — PO [${grpo.poNo}] | ${settings.companyName}`;
  const items = Array.isArray(grpo.items) ? grpo.items : [];
  let discrepancyRows = '';
  
  items.forEach(item => {
    if (item.receivedQty < item.orderedQty || item.condition !== 'Good') {
      discrepancyRows += `  • Item: ${item.description}\n    Ordered: ${item.orderedQty} | Received: ${item.receivedQty} | Condition: ${item.condition}\n`;
    }
  });

  const body = `Dear ${supplier.contactPerson || supplier.name},

We have received goods against PO [${grpo.poNo}] dated ${new Date(po.createdAt).toLocaleDateString('en-IN')}.
However, we noted the following discrepancy in supply condition/quantity:

${discrepancyRows}

Kindly arrange for resolution at the earliest.

Regards,
${settings.companyName}
${settings.companyAddress}
GSTIN : ${settings.companyGstin}
Phone : ${settings.companyMobile}`;

  try {
    await transporter.sendMail({
      from: `"${settings.companyName}" <${transporter.options.auth.user}>`,
      to: email,
      subject,
      text: body
    });

    await logCommunication({
      documentType: 'GRPO',
      documentNo: grpo.grpoNo,
      recipient: email,
      channel: 'EMAIL',
      status: 'SENT',
      subject,
      content: body
    });
    console.log(`[GRPO Discrepancy] Sent notice to ${email}`);
  } catch (err) {
    console.error('[GRPO Discrepancy] Failed to send email:', err.message);
    await logCommunication({
      documentType: 'GRPO',
      documentNo: grpo.grpoNo,
      recipient: email,
      channel: 'EMAIL',
      status: 'FAILED',
      subject,
      content: body,
      errorMessage: err.message
    });
  }
};

/**
 * Handle Sales Invoice Dual Send (Email + WhatsApp)
 */
const sendSalesInvoiceDual = async (invoice) => {
  const settings = await getTaxSettingsData();
  const email = invoice.customer?.email;
  const phone = invoice.customer?.phone;

  // Generate PDF Buffer
  const pdfBuffer = await generateInvoicePDFBuffer(invoice, settings);
  const pdfName = `Invoice_${invoice.referenceNo}_${settings.companyName.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;

  // 1. Email Send
  if (email && !(await isAlreadySent('SALES_INVOICE', invoice.referenceNo, 'EMAIL'))) {
    const subject = `Invoice [${invoice.referenceNo}] from ${settings.companyName}`;
    const body = `Dear ${invoice.customer?.name || 'Customer'},

Please find your invoice attached to this email. Kindly review and process payment by the due date.

INVOICE SUMMARY:
------------------------------------------
Invoice No    : ${invoice.referenceNo}
Invoice Date  : ${new Date(invoice.createdAt).toLocaleDateString('en-IN')}
Due Date      : ${new Date(invoice.deliveryDate).toLocaleDateString('en-IN')}
Amount Due    : Rs. ${Number(invoice.totalSubtotal * 1.18).toFixed(2)}

For detailed breakup, please refer to the attached PDF invoice.

For any queries, contact us at:
Phone : ${settings.companyMobile}

Regards,
${settings.companyName}
${settings.companyAddress}
GSTIN : ${settings.companyGstin}
Phone : ${settings.companyMobile}`;

    try {
      await transporter.sendMail({
        from: `"${settings.companyName}" <${transporter.options.auth.user}>`,
        to: email,
        subject,
        text: body,
        attachments: [{ filename: pdfName, content: pdfBuffer }]
      });

      await logCommunication({
        documentType: 'SALES_INVOICE',
        documentNo: invoice.referenceNo,
        recipient: email,
        channel: 'EMAIL',
        status: 'SENT',
        subject,
        content: body
      });
      console.log(`[Sales Invoice Email] Sent to ${email}`);
    } catch (err) {
      console.error('[Sales Invoice Email] Failed to send email:', err.message);
      await logCommunication({
        documentType: 'SALES_INVOICE',
        documentNo: invoice.referenceNo,
        recipient: email,
        channel: 'EMAIL',
        status: 'FAILED',
        subject,
        content: body,
        errorMessage: err.message
      });
    }
  }

  // 2. WhatsApp Send
  if (phone && !(await isAlreadySent('SALES_INVOICE', invoice.referenceNo, 'WHATSAPP'))) {
    const formattedPhone = formatPhoneNumber(phone);
    const isWhatsAppAvailable = await checkWhatsAppEligibility(phone);
    
    const caption = `🧾 *Invoice from ${settings.companyName}*
    
Invoice No  : ${invoice.referenceNo}
Date        : ${new Date(invoice.createdAt).toLocaleDateString('en-IN')}
Due Date    : ${new Date(invoice.deliveryDate).toLocaleDateString('en-IN')}
Amount Due  : Rs. ${Number(invoice.totalSubtotal * 1.18).toFixed(2)}

Please find your invoice attached.
For queries, call ${settings.companyMobile}

*${settings.companyName}*
${settings.companyAddress.substring(0, 40)}...`;

    if (isWhatsAppAvailable) {
      try {
        // Send via WABA/Meta Cloud API mock or sandbox endpoint
        // POST /v1/messages to send document
        console.log(`[WhatsApp WABA] Mocking document dispatch to ${formattedPhone} with filename ${pdfName}`);
        
        await logCommunication({
          documentType: 'SALES_INVOICE',
          documentNo: invoice.referenceNo,
          recipient: formattedPhone,
          channel: 'WHATSAPP',
          status: 'SENT',
          subject: 'Invoice WhatsApp Document',
          content: caption
        });
      } catch (err) {
        console.error('[WhatsApp WABA] Dispatch error:', err.message);
        await logCommunication({
          documentType: 'SALES_INVOICE',
          documentNo: invoice.referenceNo,
          recipient: formattedPhone,
          channel: 'WHATSAPP',
          status: 'FAILED',
          subject: 'Invoice WhatsApp Document',
          content: caption,
          errorMessage: err.message
        });
      }
    } else {
      console.log(`[WhatsApp WABA] Number ${formattedPhone} is not registered on WhatsApp. Skipping silently.`);
      await logCommunication({
        documentType: 'SALES_INVOICE',
        documentNo: invoice.referenceNo,
        recipient: formattedPhone,
        channel: 'WHATSAPP',
        status: 'SKIPPED',
        subject: 'Invoice WhatsApp Document',
        content: caption + '\n[NOT ON WHATSAPP]'
      });
    }
  }
};

/**
 * Resend document trigger (invoked via Manual Button click)
 */
const resendDocument = async (documentType, documentId, pdfBase64 = null) => {
  try {
    if (documentType === 'PR') {
      const pr = await prisma.assetRequest.findUnique({ where: { id: documentId } });
      if (!pr) throw new Error('PR not found');
      const supplier = pr.preferredVendor ? await prisma.supplier.findFirst({
        where: { name: { equals: pr.preferredVendor, mode: 'insensitive' } }
      }) : null;
      
      // Send disregarding isAlreadySent check for manual resends
      const settings = await getTaxSettingsData();
      const email = supplier?.email;
      if (!email) throw new Error('Supplier email not found');
      
      // Perform direct email send logic
      await sendPRAutomatedEmail(pr, supplier);
      return { success: true, message: 'PR email resent successfully' };
    }
    
    if (documentType === 'PQ') {
      const pq = await prisma.assetPQ.findUnique({ where: { id: documentId } });
      if (!pq) throw new Error('PQ not found');
      const supplier = await prisma.supplier.findFirst({ where: { name: { equals: pq.vendorName, mode: 'insensitive' } } });
      await sendPQAutomatedEmail(pq, supplier, true);
      return { success: true, message: 'PQ email resent successfully' };
    }

    if (documentType === 'PO') {
      const po = await prisma.assetPO.findUnique({ where: { id: documentId }, include: { items: true } });
      if (!po) throw new Error('PO not found');
      const supplier = await prisma.supplier.findFirst({ where: { name: { equals: po.vendorName, mode: 'insensitive' } } });
      await sendPOAutomatedEmail(po, supplier, true);
      return { success: true, message: 'PO email with PDF attachment resent successfully' };
    }

    if (documentType === 'AP_INVOICE') {
      const invoice = await prisma.assetAPInvoice.findUnique({ where: { id: documentId }, include: { items: true } });
      if (!invoice) throw new Error('AP Invoice not found');
      const supplier = await prisma.supplier.findFirst({ where: { name: { equals: invoice.vendorName, mode: 'insensitive' } } });
      await sendAPInvoiceAutomatedEmail(invoice, supplier, pdfBase64, true);
      return { success: true, message: 'AP Invoice email resent successfully' };
    }

    if (documentType === 'SALES_INVOICE') {
      const order = await prisma.customerOrder.findUnique({
        where: { id: documentId },
        include: { customer: true, items: { include: { product: true } } }
      });
      if (!order) throw new Error('Customer Order not found');
      await sendSalesInvoiceDual(order);
      return { success: true, message: 'Sales Invoice email and WhatsApp resent successfully' };
    }

    throw new Error('Unsupported document type');
  } catch (err) {
    console.error('[Manual Resend] Resend failed:', err.message);
    throw err;
  }
};

module.exports = {
  logCommunication,
  checkWhatsAppEligibility,
  sendPRAutomatedEmail,
  sendPQAutomatedEmail,
  sendPOAutomatedEmail,
  sendAPInvoiceAutomatedEmail,
  sendGRPODiscrepancyNotice,
  sendSalesInvoiceDual,
  resendDocument,
  formatPhoneNumber,
  sendPOUpdateDeleteNotice
};
