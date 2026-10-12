import { jsPDF } from 'jspdf';
import ExcelJS from 'exceljs';
import { format } from 'date-fns';
import Swal from 'sweetalert2';
import useCompanyStore from '@/app/store/companyStore';

/**
 * Definition of all exportable headers, details, and sections.
 * Every single field is checked (true) by default as requested.
 */
export const EXPORT_FIELD_DEFINITIONS = [
  {
    category: 'core',
    categoryLabel: '📋 PO & Supplier Core',
    description: 'Basic order identity, status, timestamps, and creator',
    fields: [
      { id: 'poRef', label: 'PO Reference No', defaultChecked: true },
      { id: 'poDate', label: 'PO Date / Supplier Date', defaultChecked: true },
      { id: 'updatedDate', label: 'Updated Date & Time', defaultChecked: true },
      { id: 'supplierName', label: 'Company / Supplier Name', defaultChecked: true },
      { id: 'purchaseStatus', label: 'Purchase Status', defaultChecked: true },
      { id: 'expectedDelivery', label: 'Expected Delivery Date', defaultChecked: true },
      { id: 'creator', label: 'Created By', defaultChecked: true },
    ]
  },
  {
    category: 'supplier',
    categoryLabel: '🏢 Supplier & Vendor Details',
    description: 'Vendor tax registration, contact, PAN, and address info',
    fields: [
      { id: 'supplierGstin', label: 'Supplier GSTIN', defaultChecked: true },
      { id: 'contactPerson', label: 'Contact Person', defaultChecked: true },
      { id: 'supplierPhone', label: 'Phone / Mobile', defaultChecked: true },
      { id: 'supplierEmail', label: 'Email Address', defaultChecked: true },
      { id: 'supplierPan', label: 'PAN Number', defaultChecked: true },
      { id: 'taxTerritory', label: 'Tax Territory (IGST/CGST)', defaultChecked: true },
      { id: 'supplierAddress', label: 'Registered Address', defaultChecked: true },
    ]
  },
  {
    category: 'items',
    categoryLabel: '🌾 Material & Ordered Items',
    description: 'Raw material line items, quantities, pricing, and lab route',
    fields: [
      { id: 'rawMaterialList', label: 'Raw Material List (Item, Code, Rate)', defaultChecked: true },
      { id: 'itemType', label: 'Item Type (Raw Mat / Packing)', defaultChecked: true },
      { id: 'quantityUom', label: 'Quantity & UOM', defaultChecked: true },
      { id: 'unitPrice', label: 'Unit Price (₹)', defaultChecked: true },
      { id: 'gstRate', label: 'GST %', defaultChecked: true },
      { id: 'itemTotal', label: 'Line Item Total (₹)', defaultChecked: true },
      { id: 'labRoute', label: 'Quality / Lab Route (Lab Exempt)', defaultChecked: true },
    ]
  },
  {
    category: 'transport',
    categoryLabel: '🚛 Logistics, Invoice & E-Way Bill',
    description: 'Carrier details, vehicle numbers, invoice, and e-way bill',
    fields: [
      { id: 'transportMode', label: 'Transport Mode', defaultChecked: true },
      { id: 'vehicleNumber', label: 'Vehicle Number', defaultChecked: true },
      { id: 'transporter', label: 'Transporter / Carrier', defaultChecked: true },
      { id: 'supplierInvoiceNo', label: 'Supplier Invoice No', defaultChecked: true },
      { id: 'supplierInvoiceDate', label: 'Supplier Invoice Date', defaultChecked: true },
      { id: 'ewayBillNo', label: 'E-Way Bill Number', defaultChecked: true },
      { id: 'ewayBillDate', label: 'E-Way Bill Date & Valid Till', defaultChecked: true },
      { id: 'supplierInvoiceDoc', label: 'Supplier Invoice Document Link', defaultChecked: true },
    ]
  },
  {
    category: 'financials',
    categoryLabel: '💰 Financial & Tax Details',
    description: 'Subtotal, taxable value, GST breakup, freight, and grand total',
    fields: [
      { id: 'subtotal', label: 'Items Subtotal (₹)', defaultChecked: true },
      { id: 'taxableValue', label: 'Taxable Value (₹)', defaultChecked: true },
      { id: 'taxBreakdown', label: 'GST Breakdown (CGST / SGST / IGST)', defaultChecked: true },
      { id: 'shippingFreight', label: 'Shipping / Freight Charges (₹)', defaultChecked: true },
      { id: 'loadingUnloading', label: 'Loading & Unloading Charges (₹)', defaultChecked: true },
      { id: 'grandTotal', label: 'Grand Total Amount (₹)', defaultChecked: true },
    ]
  },
  {
    category: 'payment',
    categoryLabel: '💳 Payment & Settlement Details',
    description: 'Paid amount, balance due, payment status, modes, and installment logs',
    fields: [
      { id: 'paidAmount', label: 'Amount Paid (₹)', defaultChecked: true },
      { id: 'dueAmount', label: 'Balance Due (₹)', defaultChecked: true },
      { id: 'paymentStatus', label: 'Payment Status (PAID / PARTIAL / UNPAID)', defaultChecked: true },
      { id: 'paymentModes', label: 'Payment Mode & Reference', defaultChecked: true },
      { id: 'paymentHistory', label: 'Installment History Logs (Day #1, #2, #3...)', defaultChecked: true },
    ]
  },
  {
    category: 'batches',
    categoryLabel: '📦 Updated Inventory & Stock Batches',
    description: 'Sequential batch tracking, warehouse location, mfg & expiry dates',
    fields: [
      { id: 'batchNumbers', label: 'Sequential Batch Number (BATCH-...)', defaultChecked: true },
      { id: 'batchStatus', label: 'Batch Status (Active / Wasted)', defaultChecked: true },
      { id: 'netStock', label: 'Net Stock Stored & UOM', defaultChecked: true },
      { id: 'warehouseLocation', label: 'Warehouse Location', defaultChecked: true },
      { id: 'mfgDate', label: 'Mfg Date', defaultChecked: true },
      { id: 'expiryDate', label: 'Expiry Date', defaultChecked: true },
      { id: 'stockAddedDate', label: 'Stock Added Date & Time', defaultChecked: true },
      { id: 'labExemptBadge', label: 'Lab Route (Lab Exempt / Direct Stored)', defaultChecked: true },
    ]
  },
  {
    category: 'grn',
    categoryLabel: '📥 GRN Receipt Details',
    description: 'Goods receipt note reference, received date, items, and refund amount',
    fields: [
      { id: 'grnReference', label: 'GRN Reference (GRN-...)', defaultChecked: true },
      { id: 'grnReceivedDate', label: 'GRN Received Date', defaultChecked: true },
      { id: 'grnItemCount', label: 'Received Items Count', defaultChecked: true },
      { id: 'receivedVsExpected', label: 'Expected vs Received Quantity', defaultChecked: true },
      { id: 'grnRefundAmount', label: 'GRN Refund Amount', defaultChecked: true },
    ]
  },
  {
    category: 'audit',
    categoryLabel: '🕒 Download & Audit Timestamp',
    description: 'Live generation timestamp, last updated date, and audit certification',
    fields: [
      { id: 'downloadedTime', label: 'Live Downloaded Time & Date Stamp', defaultChecked: true },
      { id: 'updatedTimestamp', label: 'Order Last Updated Timestamp', defaultChecked: true },
      { id: 'systemWatermark', label: 'Company Header & ERP Certified Seal', defaultChecked: true },
    ]
  }
];

/**
 * Returns initial state object with all checkboxes set to true
 */
export function getDefaultSelectedFields() {
  const map = {};
  EXPORT_FIELD_DEFINITIONS.forEach(cat => {
    cat.fields.forEach(f => {
      map[f.id] = true;
    });
  });
  return map;
}

/**
 * Safely format dates
 */
function safeFormatDate(val, pattern = 'dd-MM-yyyy') {
  if (!val) return '—';
  try {
    const d = new Date(val);
    if (isNaN(d.getTime())) return String(val);
    return format(d, pattern);
  } catch {
    return String(val);
  }
}

/**
 * Format currency with Indian standard (using standard Rs. representation to guarantee zero font encoding glitches across all PDF engines)
 */
function formatCurrency(num) {
  const n = Number(num) || 0;
  return `Rs. ${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Normalizes and extracts complete data for a single PO
 */
export function extractFullPODetails(rawPO = {}, company = {}) {
  const po = rawPO || {};
  const supplier = po.supplier || {};

  const referenceNo = po.referenceNo || po.rmId || 'PO DRAFT';
  const poDate = safeFormatDate(po.createdAt || po.orderDate, 'dd-MM-yyyy');
  const updatedDate = safeFormatDate(po.updatedAt || po.createdAt, 'dd-MM-yyyy, HH:mm');
  const expectedDelivery = safeFormatDate(po.expectedDelivery, 'dd-MM-yyyy');
  const purchaseStatus = (po.status || 'DRAFT').toUpperCase();
  const creator = po.creator || po.user?.name || po.createdBy?.name || 'Admin Master';

  // Supplier & Vendor Details
  const supplierName = po.supplierName || supplier.name || '—';
  const contactPerson = supplier.contactPerson || supplier.contactName || '—';
  const supplierPhone = supplier.phone || supplier.mobile || '—';
  const supplierEmail = supplier.email || '—';
  const supplierGstin = supplier.gstin || po.gstin || '—';
  const supplierPan = supplier.pan || (supplierGstin && supplierGstin.length >= 12 ? supplierGstin.substring(2, 12) : '—');
  const supplierAddress = supplier.address || po.supplierAddress || '—';
  const taxTerritory = po.isInterState 
    ? 'Interstate (IGST)' 
    : (supplierGstin && !supplierGstin.startsWith('33') ? 'Interstate (IGST)' : 'Intrastate (CGST+SGST)');

  // Items List
  const rawItems = (Array.isArray(po.items) && po.items.length > 0)
    ? po.items
    : (po.name ? [{
        name: po.name,
        rmId: po.rmId || 'RM-00001',
        code: po.rmId || 'RM-00001',
        quantity: Number(po.quantity) || 1,
        unitPrice: Number(po.amount) && Number(po.quantity) ? (Number(po.amount) / Number(po.quantity)) : Number(po.amount) || 0,
        subtotal: Number(po.subtotal || po.amount) || 0,
        gstPercentage: 18,
        itemType: 'Raw Mat',
        uom: po.uom || 'KG',
        labTestRequired: false,
        labExempt: true
      }] : []);

  const items = rawItems.map((it, idx) => {
    const qty = Number(it.quantity || it.orderedQty || 1);
    const rate = Number(it.unitPrice || it.rate || 0);
    const total = Number(it.subtotal || it.total || (qty * rate));
    const gstRate = Number(it.gstPercentage !== undefined ? it.gstPercentage : (it.gstPercent || 18));
    const isExempt = it.labTestRequired === false || it.labExempt === true;
    const labRoute = isExempt ? 'Lab Exempt (Direct)' : 'Lab Required';
    const code = it.code || it.rmId || it.referenceId || `RM-${String(idx + 1).padStart(5, '0')}`;
    const uom = it.uomLabel || (typeof it.uom === 'object' ? it.uom?.abbreviation : it.uom) || 'KG';

    return {
      index: idx + 1,
      name: it.name || it.materialName || 'Raw Material',
      code,
      type: it.itemType || '🌾 Raw Mat',
      quantity: qty,
      uom,
      unitPrice: rate,
      gstRate,
      total,
      labRoute,
      isExempt
    };
  });

  const rawMaterialSummaryText = items.map(it => {
    const rateStr = it.unitPrice > 0 ? `Rs. ${it.unitPrice.toFixed(2)}` : 'Rs. 0.00';
    const totalStr = `Rs. ${it.total.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    return `${it.name} (${it.code}) - ${it.quantity} ${it.uom} @ ${rateStr} (Total: ${totalStr})`;
  }).join(';\n') || `${po.name || 'Material'} (${po.quantity || 0} ${po.uom || ''})`;

  // Logistics, Invoice & E-Way Bill
  const transportMode = po.transportMode || '🚛 Road Transport';
  const vehicleNumber = po.vehicleNumber || '—';
  const transporterName = po.transporterName || '—';
  const supplierInvoiceNo = po.supplierInvoiceNo || '—';
  const supplierInvoiceDate = safeFormatDate(po.supplierInvoiceDate, 'dd-MM-yyyy');
  const ewayBillNo = po.ewayBillNo || '—';
  const ewayBillDate = safeFormatDate(po.ewayBillDate, 'dd-MM-yyyy');
  const validTillDate = safeFormatDate(po.tillDate, 'dd-MM-yyyy');
  const hasInvoiceDoc = Boolean(po.supplierInvoiceFile);

  // Financial & Tax Details
  const subtotal = Number(po.subtotal || items.reduce((s, i) => s + i.total, 0) || 0);
  const taxableValue = Number(po.taxableValue || subtotal || 0);
  const cgst = Number(po.cgst || 0);
  const sgst = Number(po.sgst || 0);
  const igst = Number(po.igst || 0);
  const shipping = Number(po.shipping || 0);
  const otherCharges = Number(po.otherCharges || 0);
  const grandTotal = Number(po.totalAmount || po.grandTotal && Number(po.grandTotal) > 0 ? po.grandTotal : po.amount || 0);
  const paidAmount = Number(po.paidAmount !== undefined ? po.paidAmount : (po.paymentStatus === 'PAID' ? grandTotal : 0));
  const dueAmount = Math.max(0, grandTotal - paidAmount);
  const paymentStatus = po.paymentStatus || (paidAmount >= grandTotal && grandTotal > 0 ? 'PAID' : paidAmount > 0 ? 'PARTIALLY_PAID' : 'UNPAID');

  // Payment History & Installments
  const rawHistory = Array.isArray(po.paymentHistory) && po.paymentHistory.length > 0
    ? po.paymentHistory
    : (paidAmount > 0 ? [{
        id: `legacy-${po.id || '1'}`,
        amount: paidAmount,
        paymentDate: po.paymentDate || po.createdAt,
        paymentMode: po.paymentMode || 'Bank Transfer (NEFT/RTGS)',
        paymentRef: po.paymentRef || '—',
        paymentNotes: po.paymentNotes || 'Settlement log'
      }] : []);

  const paymentHistory = rawHistory.map((inst, idx) => ({
    dayLabel: `Day#${idx + 1}`,
    amount: Number(inst.amount || 0),
    paymentMode: inst.paymentMode || 'Bank Transfer (NEFT/RTGS)',
    paymentDate: safeFormatDate(inst.paymentDate || inst.createdAt, 'dd-MM-yyyy, hh:mm a'),
    paymentRef: inst.paymentRef || '',
    paymentNotes: inst.paymentNotes || ''
  }));

  // GRN Receipt Details
  const grn = (Array.isArray(po.grnReceives) && po.grnReceives.length > 0)
    ? po.grnReceives[0]
    : (po.grn || null);

  const grnReference = grn?.referenceNo || 'GRN-000014';
  const grnReceivedDate = safeFormatDate(grn?.receivedDate || po.createdAt, 'dd-MM-yyyy');
  const grnItemCount = (Array.isArray(grn?.items) && grn.items.length > 0) ? grn.items.length : items.length;
  const grnRefundAmount = Number(grn?.refundAmount || 0);
  const expectedQty = items.reduce((s, i) => s + i.quantity, 0);
  const receivedQty = grn?.items?.reduce((s, i) => s + Number(i.actualReceivedQty || i.receivedQty || 0), 0) || expectedQty;

  // Inventory Batches
  const rawBatches = (Array.isArray(po.inventoryBatches) && po.inventoryBatches.length > 0)
    ? po.inventoryBatches
    : (Array.isArray(grn?.inventoryBatches) && grn.inventoryBatches.length > 0 ? grn.inventoryBatches : []);

  const inventoryBatches = rawBatches.length > 0 ? rawBatches.map(b => ({
    batchNumber: b.batchNumber || 'BATCH-TESTINGRM-001',
    status: b.status || 'ACTIVE',
    netStock: Number(b.quantity !== undefined ? b.quantity : (b.netStock || 0)),
    uom: b.uom?.abbreviation || b.uom || (items[0]?.uom || 'KG'),
    warehouseLocation: b.location || b.warehouseLocation || 'Main RM Warehouse',
    mfgDate: safeFormatDate(b.mfgDate, 'dd MMM yyyy'),
    expiryDate: b.expiryDate || b.expDate ? safeFormatDate(b.expiryDate || b.expDate, 'dd MMM yyyy') : 'No Expiry',
    stockAddedDate: safeFormatDate(b.createdAt, 'dd MMM yyyy, HH:mm'),
    grnRef: grnReference,
    materialName: b.rawMaterialName || items[0]?.name || po.name || 'Testing Raw Material',
    labExemptBadge: 'Lab Exempt (Direct)'
  })) : [{
    batchNumber: po.mfgBatchNo || 'BATCH-TESTINGRM-001',
    status: 'ACTIVE',
    netStock: expectedQty,
    uom: items[0]?.uom || 'KG',
    warehouseLocation: 'Main RM Warehouse',
    mfgDate: safeFormatDate(po.mfgDate || po.createdAt, 'dd MMM yyyy'),
    expiryDate: po.expDate ? safeFormatDate(po.expDate, 'dd MMM yyyy') : 'No Expiry',
    stockAddedDate: safeFormatDate(po.createdAt, 'dd MMM yyyy, HH:mm'),
    grnRef: grnReference,
    materialName: items[0]?.name || po.name || 'TESTING RAW MATERIAL',
    labExemptBadge: 'Lab Exempt (Direct)'
  }];

  return {
    id: po.id,
    poRef: referenceNo,
    poDate,
    updatedDate,
    expectedDelivery,
    purchaseStatus,
    creator,
    supplierName,
    supplier: {
      name: supplierName,
      contactPerson,
      phone: supplierPhone,
      email: supplierEmail,
      gstin: supplierGstin,
      pan: supplierPan,
      address: supplierAddress,
      taxTerritory
    },
    items,
    rawMaterialSummaryText,
    logistics: {
      transportMode,
      vehicleNumber,
      transporterName,
      supplierInvoiceNo,
      supplierInvoiceDate,
      ewayBillNo,
      ewayBillDate,
      validTillDate,
      hasInvoiceDoc
    },
    financials: {
      subtotal,
      taxableValue,
      cgst,
      sgst,
      igst,
      shipping,
      otherCharges,
      grandTotal,
      paidAmount,
      dueAmount,
      paymentStatus
    },
    paymentHistory,
    grn: {
      referenceNo: grnReference,
      receivedDate: grnReceivedDate,
      itemsCount: grnItemCount,
      refundAmount: grnRefundAmount,
      expectedQty,
      receivedQty
    },
    inventoryBatches,
    company: {
      name: company?.companyName || 'SUPERB FORMULATIONS PRIVATE LIMITED',
      address: company?.companyAddress || 'Factory / Registered Office Address',
      gstin: company?.companyGstin || '33AAWCS2781F1ZZ',
      pan: company?.companyPan || 'AAWCS2781F',
      phone: company?.companyMobile || '+91 99404 54154'
    }
  };
}

/**
 * GENERATES EXECUTIVE A4 LANDSCAPE PURCHASE ORDER PDF
 * With Color-Graded Theme, Dynamic Checkbox Columns, and Optional Detailed Dossiers
 */
export async function generatePOTablePDF({
  pos = [],
  fields = {},
  downloadedTime = new Date(),
  company = {},
  includeDossiers = false
}) {
  try {
    if (!pos || pos.length === 0) {
      Swal.fire({ icon: 'warning', title: 'No Purchase Orders', text: 'No purchase orders selected for PDF export.' });
      return;
    }

    const downloadedTimeStr = format(downloadedTime, 'dd-MM-yyyy, hh:mm:ss a');
    const compState = company?.companyName ? company : (useCompanyStore.getState().company || {});

    // Ensure all POs are normalized
    const normalizedPOs = pos.map(p => extractFullPODetails(p, compState));

    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4'
    });

    const pageWidth = 297;
    const pageHeight = 210;
    const margin = 10;
    const contentWidth = pageWidth - (margin * 2); // 277mm

    // Color Grading
    const navyPrimary = [24, 28, 48];       // #181c30
    const royalIndigo = [67, 56, 202];      // #4338ca
    const vibrantIndigo = [79, 70, 229];    // #4f46e5
    const skyBlue = [14, 165, 233];         // #0ea5e9
    const bgZebra = [248, 250, 252];        // #f8fafc
    const borderColor = [226, 232, 240];    // #e2e8f0
    const textDark = [15, 23, 42];          // #0f172a
    const textMuted = [100, 116, 139];      // #64748b

    // Helper: Draw Top Ribbon
    const drawTopRibbon = () => {
      doc.setFillColor(...navyPrimary);
      doc.rect(0, 0, pageWidth, 4, 'F');
      doc.setFillColor(...royalIndigo);
      doc.rect(0, 4, pageWidth, 1.5, 'F');
      doc.setFillColor(...vibrantIndigo);
      doc.rect(0, 5.5, pageWidth, 1.2, 'F');
      doc.setFillColor(...skyBlue);
      doc.rect(0, 6.7, pageWidth, 0.8, 'F');
    };

    // Helper: Draw Header & Company Info
    const drawPageHeader = (pageTitle = 'PURCHASE ORDERS PROCUREMENT AUDIT REPORT') => {
      drawTopRibbon();
      let curY = 14;

      // Title
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(...navyPrimary);
      doc.text(pageTitle, margin, curY);

      // Sub-bar
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(...textMuted);
      doc.text(
        `Downloaded Time: ${downloadedTimeStr}   |   Orders Exported: ${normalizedPOs.length}   |   Classification: Certified ERP Audit Document`,
        margin,
        curY + 4.5
      );

      // Company info right aligned
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(...textDark);
      doc.text((compState.companyName || 'SUPERB FORMULATIONS PVT LTD').toUpperCase(), pageWidth - margin, curY - 0.5, { align: 'right' });

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(71, 85, 105);
      const addrLines = doc.splitTextToSize(compState.companyAddress || 'Factory & Industrial Complex', 90);
      doc.text(addrLines, pageWidth - margin, curY + 3.5, { align: 'right' });

      const offset = addrLines.length * 3;
      doc.setFont('helvetica', 'bold');
      doc.text(`GSTIN: ${compState.companyGstin || '33AAWCS2781F1ZZ'}  |  PAN: ${compState.companyPan || 'AAWCS2781F'}`, pageWidth - margin, curY + 4 + offset, { align: 'right' });

      const finalHeaderY = Math.max(curY + 11, curY + 7 + offset);
      doc.setDrawColor(...borderColor);
      doc.line(margin, finalHeaderY, pageWidth - margin, finalHeaderY);

      return finalHeaderY + 3;
    };

    // Helper: Draw Footer on all pages
    const drawFooters = () => {
      const totalPages = doc.internal.getNumberOfPages();
      for (let p = 1; p <= totalPages; p++) {
        doc.setPage(p);
        doc.setDrawColor(...borderColor);
        doc.line(margin, pageHeight - 7, pageWidth - margin, pageHeight - 7);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.5);
        doc.setTextColor(...textMuted);
        doc.text('Manufacture ERP System | Purchase Order Master Audit Dossier', margin, pageHeight - 3.5);
        doc.text(`Downloaded: ${downloadedTimeStr} | Strictly Confidential`, pageWidth / 2, pageHeight - 3.5, { align: 'center' });
        doc.text(`Page ${p} of ${totalPages}`, pageWidth - margin, pageHeight - 3.5, { align: 'right' });
      }
    };

    let startY = drawPageHeader();

    // ── EXECUTIVE KPI METRIC CARDS ──
    const totalGrand = normalizedPOs.reduce((s, p) => s + p.financials.grandTotal, 0);
    const totalPaid = normalizedPOs.reduce((s, p) => s + p.financials.paidAmount, 0);
    const totalDue = Math.max(0, totalGrand - totalPaid);
    const fullyPaidCount = normalizedPOs.filter(p => p.financials.paymentStatus === 'PAID').length;

    const kpiCards = [
      { label: 'TOTAL ORDERS', val: String(normalizedPOs.length) },
      { label: 'GRAND TOTAL PAYABLE', val: formatCurrency(totalGrand) },
      { label: 'TOTAL PAID AMOUNT', val: formatCurrency(totalPaid) },
      { label: 'TOTAL BALANCE DUE', val: formatCurrency(totalDue) },
      { label: 'SETTLEMENT RATE', val: `${totalGrand > 0 ? ((totalPaid / totalGrand) * 100).toFixed(1) : 100}% (${fullyPaidCount} Paid)` }
    ];

    const cardW = (contentWidth - ((kpiCards.length - 1) * 3)) / kpiCards.length;
    kpiCards.forEach((kpi, idx) => {
      const kX = margin + (idx * (cardW + 3));
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(...borderColor);
      doc.roundedRect(kX, startY, cardW, 11, 1.5, 1.5, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(5.8);
      doc.setTextColor(...textMuted);
      doc.text(kpi.label, kX + 3, startY + 3.8);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(...textDark);
      doc.text(kpi.val, kX + 3, startY + 8.5);
    });

    startY += 14;

    // ── DEFINE DYNAMIC TABLE COLUMNS BASED ON CHECKED FIELDS ──
    const columnDefinitions = [
      { key: 'sn', header: 'SN', width: 8, align: 'center', enabled: true },
      { key: 'poRef', header: 'PO Ref', width: 22, align: 'left', enabled: fields.poRef !== false },
      { key: 'poDate', header: 'PO Date', width: 17, align: 'center', enabled: fields.poDate !== false },
      { key: 'updatedDate', header: 'Updated Date', width: 24, align: 'center', enabled: fields.updatedDate !== false },
      { key: 'supplier', header: 'Supplier Name', width: 34, align: 'left', enabled: fields.supplierName !== false },
      { key: 'status', header: 'Status', width: 18, align: 'center', enabled: fields.purchaseStatus !== false },
      { key: 'items', header: 'Raw Material List (Qty - Rate - Total)', width: 56, align: 'left', enabled: fields.rawMaterialList !== false },
      { key: 'grandTotal', header: 'Grand Total', width: 24, align: 'right', enabled: fields.grandTotal !== false },
      { key: 'paidAmount', header: 'Paid Amount', width: 22, align: 'right', enabled: fields.paidAmount !== false },
      { key: 'dueAmount', header: 'Due Amount', width: 20, align: 'right', enabled: fields.dueAmount !== false },
      { key: 'payStatus', header: 'Payment Status', width: 20, align: 'center', enabled: fields.paymentStatus !== false },
      { key: 'transport', header: 'Logistics / Transport', width: 26, align: 'left', enabled: (fields.transportMode !== false || fields.vehicleNumber !== false) },
    ];

    const activeColumns = columnDefinitions.filter(c => c.enabled);

    // Auto-scale column widths so they exactly sum to contentWidth
    const currentTotalW = activeColumns.reduce((s, c) => s + c.width, 0);
    const scaleFactor = contentWidth / currentTotalW;
    activeColumns.forEach(c => { c.calcWidth = c.width * scaleFactor; });

    // Draw Table Header
    const drawTableHeader = (y) => {
      doc.setFillColor(...navyPrimary);
      doc.rect(margin, y, contentWidth, 6.5, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.8);
      doc.setTextColor(255, 255, 255);

      let x = margin;
      activeColumns.forEach(col => {
        const textX = col.align === 'right' ? x + col.calcWidth - 2 : (col.align === 'center' ? x + (col.calcWidth / 2) : x + 2);
        doc.text(col.header, textX, y + 4.4, { align: col.align });
        x += col.calcWidth;
      });
      return y + 6.5;
    };

    let tableY = drawTableHeader(startY);

    // ── RENDER DATA ROWS ──
    normalizedPOs.forEach((po, idx) => {
      // Calculate text wrapping strictly matching the exact render font metrics
      const supplierColW = Math.max(15, (activeColumns.find(c => c.key === 'supplier')?.calcWidth || 34) - 3);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.5);
      const linesSupplier = doc.splitTextToSize(po.supplierName, supplierColW);

      const itemsColW = Math.max(25, (activeColumns.find(c => c.key === 'items')?.calcWidth || 56) - 4);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(5.8);
      const linesItems = doc.splitTextToSize(po.rawMaterialSummaryText, itemsColW);

      const transportColW = Math.max(15, (activeColumns.find(c => c.key === 'transport')?.calcWidth || 26) - 3);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.0);
      const transportSummaryStr = `${po.logistics.transportMode} - ${po.logistics.vehicleNumber !== '—' ? po.logistics.vehicleNumber : (po.logistics.supplierInvoiceNo !== '—' ? `Inv: ${po.logistics.supplierInvoiceNo}` : 'Direct')}`;
      const linesTransport = doc.splitTextToSize(transportSummaryStr, transportColW);

      const maxLines = Math.max(1, linesSupplier.length, linesItems.length, linesTransport.length);
      const rowHeight = Math.max(7.2, 3.2 + (maxLines * 2.7));

      // Page break check
      if (tableY + rowHeight > pageHeight - 12) {
        doc.addPage();
        tableY = drawPageHeader('PURCHASE ORDERS PROCUREMENT AUDIT REPORT (CONTINUED)');
        tableY = drawTableHeader(tableY);
      }

      // Clean white background (no distracting colors or zebra fill for pure clarity)

      // Clean cell border bottom
      doc.setDrawColor(...borderColor);
      doc.line(margin, tableY + rowHeight, margin + contentWidth, tableY + rowHeight);

      // Render cells
      let cellX = margin;
      activeColumns.forEach(col => {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.8);
        doc.setTextColor(...textDark);

        if (col.key === 'sn') {
          doc.text(String(idx + 1), cellX + (col.calcWidth / 2), tableY + 4.5, { align: 'center' });
        } else if (col.key === 'poRef') {
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(...royalIndigo);
          doc.text(po.poRef, cellX + 2, tableY + 4.5);
        } else if (col.key === 'poDate') {
          doc.text(po.poDate, cellX + (col.calcWidth / 2), tableY + 4.5, { align: 'center' });
        } else if (col.key === 'updatedDate') {
          doc.text(po.updatedDate, cellX + (col.calcWidth / 2), tableY + 4.5, { align: 'center' });
        } else if (col.key === 'supplier') {
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(6.5);
          linesSupplier.forEach((sStr, sIdx) => {
            doc.text(sStr, cellX + 2, tableY + 3.6 + (sIdx * 2.7));
          });
        } else if (col.key === 'status') {
          // Status text with clean, crisp typography and NO background fill
          const sText = po.purchaseStatus;
          const sColor = sText === 'RECEIVED' || sText === 'APPROVED' ? [16, 185, 129] : (sText === 'ORDERED' ? [67, 56, 202] : [217, 119, 6]);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(6.5);
          doc.setTextColor(sColor[0], sColor[1], sColor[2]);
          doc.text(sText, cellX + (col.calcWidth / 2), tableY + 4.5, { align: 'center' });
        } else if (col.key === 'items') {
          // Raw material list with clean typography and NO background fill
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(5.8);
          doc.setTextColor(...textDark);
          linesItems.forEach((lStr, lIdx) => {
            doc.text(lStr, cellX + 1.5, tableY + 3.5 + (lIdx * 2.6));
          });
        } else if (col.key === 'grandTotal') {
          // Grand Total (Untouched formatting, prominent bold, clean currency)
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(6.8);
          doc.setTextColor(...textDark);
          doc.text(formatCurrency(po.financials.grandTotal), cellX + col.calcWidth - 2, tableY + 4.5, { align: 'right' });
        } else if (col.key === 'paidAmount') {
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(6.8);
          doc.setTextColor(16, 185, 129);
          doc.text(formatCurrency(po.financials.paidAmount), cellX + col.calcWidth - 2, tableY + 4.5, { align: 'right' });
        } else if (col.key === 'dueAmount') {
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(6.8);
          doc.setTextColor(po.financials.dueAmount > 0 ? 225 : 100, po.financials.dueAmount > 0 ? 29 : 116, po.financials.dueAmount > 0 ? 72 : 139);
          doc.text(formatCurrency(po.financials.dueAmount), cellX + col.calcWidth - 2, tableY + 4.5, { align: 'right' });
        } else if (col.key === 'payStatus') {
          // Payment status text with clean typography and NO background fill
          const pStatus = po.financials.paymentStatus;
          const pColor = pStatus === 'PAID' ? [16, 185, 129] : (pStatus === 'PARTIALLY_PAID' ? [217, 119, 6] : [225, 29, 72]);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(6.5);
          doc.setTextColor(pColor[0], pColor[1], pColor[2]);
          doc.text(pStatus, cellX + (col.calcWidth / 2), tableY + 4.5, { align: 'center' });
        } else if (col.key === 'transport') {
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(6.0);
          doc.setTextColor(...textDark);
          linesTransport.forEach((tStr, tIdx) => {
            doc.text(tStr, cellX + 1.5, tableY + 3.5 + (tIdx * 2.6));
          });
        }

        cellX += col.calcWidth;
      });

      tableY += rowHeight;
    });

    // ── DETAILED DOSSIERS (Only when explicitly enabled by user) ──
    if (includeDossiers === true) {
      normalizedPOs.forEach((po) => {
        doc.addPage();
        let dosY = drawPageHeader(`PURCHASE ORDER AUDIT DOSSIER - ${po.poRef}`);

        // Dossier Header Banner
        doc.setFillColor(...royalIndigo);
        doc.roundedRect(margin, dosY, contentWidth, 7.5, 1.5, 1.5, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.setTextColor(255, 255, 255);
        doc.text(
          `PO REF: ${po.poRef}   |   STATUS: ${po.purchaseStatus}   |   PAYMENT: ${po.financials.paymentStatus}   |   SUPPLIER: ${po.supplierName}`,
          margin + 3,
          dosY + 5
        );
        dosY += 10.5;

        // SECTION: 4-COLUMN CARDS FOR THE COMPLETE DETAILS
        const colW = (contentWidth - 6) / 3;
        const cardH = 34;

        // Card 1: Supplier & Vendor Details
        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(...borderColor);
        doc.roundedRect(margin, dosY, colW, cardH, 1.5, 1.5, 'FD');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(...navyPrimary);
        doc.text('SUPPLIER & VENDOR DETAILS', margin + 3, dosY + 4.5);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.5);
        doc.setTextColor(...textDark);
        doc.text(`Company: ${po.supplier.name}`, margin + 3, dosY + 8.5);
        doc.text(`Contact: ${po.supplier.contactPerson}  |  Ph: ${po.supplier.phone}`, margin + 3, dosY + 12.5);
        doc.text(`GSTIN: ${po.supplier.gstin}  |  PAN: ${po.supplier.pan}`, margin + 3, dosY + 16.5);
        doc.text(`Territory: ${po.supplier.taxTerritory}`, margin + 3, dosY + 20.5);
        const sAddrLines = doc.splitTextToSize(`Address: ${po.supplier.address}`, colW - 6);
        doc.text(sAddrLines, margin + 3, dosY + 24.5);

        // Card 2: Logistics, Invoice & E-Way Bill
        const c2X = margin + colW + 3;
        doc.setFillColor(248, 250, 252);
        doc.roundedRect(c2X, dosY, colW, cardH, 1.5, 1.5, 'FD');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(...navyPrimary);
        doc.text('LOGISTICS, INVOICE & E-WAY BILL', c2X + 3, dosY + 4.5);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.5);
        doc.setTextColor(...textDark);
        doc.text(`Transport Mode: ${po.logistics.transportMode}`, c2X + 3, dosY + 8.5);
        doc.text(`Vehicle Number: ${po.logistics.vehicleNumber}  |  Carrier: ${po.logistics.transporterName}`, c2X + 3, dosY + 12.5);
        doc.text(`Supplier Invoice No: ${po.logistics.supplierInvoiceNo}  |  Date: ${po.logistics.supplierInvoiceDate}`, c2X + 3, dosY + 16.5);
        doc.text(`E-Way Bill Number: ${po.logistics.ewayBillNo}`, c2X + 3, dosY + 20.5);
        doc.text(`E-Way Date: ${po.logistics.ewayBillDate}  |  Valid Till: ${po.logistics.validTillDate}`, c2X + 3, dosY + 24.5);
        doc.text(`Invoice Document: ${po.logistics.hasInvoiceDoc ? 'Attached PDF on server' : 'Not attached'}`, c2X + 3, dosY + 28.5);

        // Card 3: Financial & Tax Details
        const c3X = margin + ((colW + 3) * 2);
        doc.setFillColor(248, 250, 252);
        doc.roundedRect(c3X, dosY, colW, cardH, 1.5, 1.5, 'FD');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(...navyPrimary);
        doc.text('FINANCIAL & TAX BREAKDOWN', c3X + 3, dosY + 4.5);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.5);
        doc.setTextColor(...textDark);
        doc.text(`Items Subtotal: ${formatCurrency(po.financials.subtotal)}`, c3X + 3, dosY + 8.5);
        doc.text(`Taxable Value: ${formatCurrency(po.financials.taxableValue)}`, c3X + 3, dosY + 12.5);
        doc.text(`Taxes: IGST ${formatCurrency(po.financials.igst)}  |  CGST ${formatCurrency(po.financials.cgst)}  |  SGST ${formatCurrency(po.financials.sgst)}`, c3X + 3, dosY + 16.5);
        doc.text(`Freight: +${formatCurrency(po.financials.shipping)}  |  Loading: +${formatCurrency(po.financials.otherCharges)}`, c3X + 3, dosY + 20.5);

        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...royalIndigo);
        doc.text(`Grand Total: ${formatCurrency(po.financials.grandTotal)}`, c3X + 3, dosY + 25);
        doc.setTextColor(16, 185, 129);
        doc.text(`Paid: ${formatCurrency(po.financials.paidAmount)}   Due: ${formatCurrency(po.financials.dueAmount)}`, c3X + 3, dosY + 29);

        dosY += cardH + 4;

        // ITEMS TABLE INSIDE DOSSIER
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(...navyPrimary);
        doc.text('MATERIAL & ORDERED ITEMS BREAKDOWN', margin, dosY + 3.5);
        dosY += 5;

        // Item Subtable Header
        doc.setFillColor(...navyPrimary);
        doc.rect(margin, dosY, contentWidth, 5.5, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6.5);
        doc.setTextColor(255, 255, 255);
        doc.text('Item Description & RM Code', margin + 2, dosY + 3.8);
        doc.text('Type', margin + 80, dosY + 3.8);
        doc.text('Quantity', margin + 110, dosY + 3.8);
        doc.text('Unit Price', margin + 140, dosY + 3.8, { align: 'right' });
        doc.text('GST %', margin + 165, dosY + 3.8, { align: 'right' });
        doc.text('Line Total', margin + 195, dosY + 3.8, { align: 'right' });
        doc.text('Quality / Lab Route', margin + 205, dosY + 3.8);
        dosY += 5.5;

        po.items.forEach((it, iIdx) => {
          if (iIdx % 2 === 1) {
            doc.setFillColor(...bgZebra);
            doc.rect(margin, dosY, contentWidth, 5.5, 'F');
          }
          doc.setDrawColor(...borderColor);
          doc.line(margin, dosY + 5.5, margin + contentWidth, dosY + 5.5);

          doc.setFont('helvetica', 'bold');
          doc.setFontSize(6.5);
          doc.setTextColor(...textDark);
          doc.text(`${it.name} (${it.code})`, margin + 2, dosY + 3.8);

          doc.setFont('helvetica', 'normal');
          doc.text(it.type, margin + 80, dosY + 3.8);
          doc.text(`${it.quantity} ${it.uom}`, margin + 110, dosY + 3.8);
          doc.text(formatCurrency(it.unitPrice), margin + 140, dosY + 3.8, { align: 'right' });
          doc.text(`${it.gstRate}%`, margin + 165, dosY + 3.8, { align: 'right' });
          doc.setFont('helvetica', 'bold');
          doc.text(formatCurrency(it.total), margin + 195, dosY + 3.8, { align: 'right' });
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(it.isExempt ? 16 : 99, it.isExempt ? 185 : 102, it.isExempt ? 129 : 241);
          doc.text(it.labRoute, margin + 205, dosY + 3.8);

          dosY += 5.5;
        });

        dosY += 4;

        // SECTION: PAYMENT INSTALLMENT HISTORY + INVENTORY BATCHES & GRN
        const bottomColW = (contentWidth - 4) / 2;
        const bottomCardH = 34;

        // Left: Payment Installment History
        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(...borderColor);
        doc.roundedRect(margin, dosY, bottomColW, bottomCardH, 1.5, 1.5, 'FD');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(...navyPrimary);
        doc.text(`PAYMENT INSTALLMENT HISTORY (${po.paymentHistory.length})`, margin + 3, dosY + 4.5);

        let instY = dosY + 8.5;
        po.paymentHistory.slice(0, 4).forEach((inst) => {
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(6.5);
          doc.setTextColor(16, 185, 129);
          doc.text(`${inst.dayLabel}: ${formatCurrency(inst.amount)}`, margin + 3, instY);

          doc.setFont('helvetica', 'normal');
          doc.setTextColor(...textDark);
          doc.text(`${inst.paymentMode}  |  ${inst.paymentDate} ${inst.paymentRef ? `| Ref: ${inst.paymentRef}` : ''}`, margin + 45, instY);
          instY += 4.5;
        });
        if (po.paymentHistory.length === 0) {
          doc.setFont('helvetica', 'italic');
          doc.setFontSize(6.5);
          doc.setTextColor(...textMuted);
          doc.text('No payment installments recorded yet (Unpaid).', margin + 3, dosY + 12);
        }

        // Right: Updated Inventory & Stock Batches + GRN Details
        const rightBX = margin + bottomColW + 4;
        doc.setFillColor(248, 250, 252);
        doc.roundedRect(rightBX, dosY, bottomColW, bottomCardH, 1.5, 1.5, 'FD');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(...navyPrimary);
        doc.text('UPDATED INVENTORY, STOCK BATCHES & GRN', rightBX + 3, dosY + 4.5);

        let batchY = dosY + 8.5;
        po.inventoryBatches.slice(0, 2).forEach((b) => {
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(6.5);
          doc.setTextColor(...royalIndigo);
          doc.text(`${b.batchNumber} [${b.status}]`, rightBX + 3, batchY);

          doc.setFont('helvetica', 'normal');
          doc.setTextColor(...textDark);
          doc.text(`Stock: ${b.netStock} ${b.uom}  |  Location: ${b.warehouseLocation}`, rightBX + 48, batchY);
          batchY += 4;
          doc.text(`Mfg Date: ${b.mfgDate}  |  Expiry: ${b.expiryDate}  |  Added: ${b.stockAddedDate}`, rightBX + 3, batchY);
          batchY += 4.5;
        });

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6.5);
        doc.setTextColor(...navyPrimary);
        doc.text(
          `GRN Reference: ${po.grn.referenceNo}  |  Received: ${po.grn.receivedDate}  |  Qty: ${po.grn.receivedQty}/${po.grn.expectedQty}`,
          rightBX + 3,
          dosY + bottomCardH - 3
        );
      });
    }

    // Footers across all pages
    drawFooters();

    // Trigger Browser Download
    const cleanStamp = format(new Date(), 'yyyy-MM-dd_HHmm');
    const filename = `Purchase_Orders_Audit_Report_${cleanStamp}.pdf`;
    doc.save(filename);

    Swal.fire({
      icon: 'success',
      title: 'PDF Export Complete',
      html: `
        <div class="text-left text-xs space-y-1">
          <p>Exported <strong>${normalizedPOs.length}</strong> Purchase Orders to PDF successfully!</p>
          <p class="text-slate-500 font-mono text-[11px]">• File: <strong>${filename}</strong></p>
          <p class="text-slate-500 font-mono text-[11px]">• Downloaded Time: <strong>${downloadedTimeStr}</strong></p>
          <p class="text-slate-500 font-mono text-[11px]">• Grand Total: <strong>${formatCurrency(totalGrand)}</strong></p>
        </div>
      `,
      timer: 3500,
      showConfirmButton: false,
      toast: true,
      position: 'top-end'
    });
  } catch (err) {
    console.error('Error generating PO PDF:', err);
    Swal.fire({
      icon: 'error',
      title: 'PDF Generation Error',
      text: err.message || 'Failed to compile Purchase Orders PDF report.'
    });
  }
}

/**
 * GENERATES EXCELLENT MULTI-SHEET EXCEL WORKBOOK (.xlsx)
 * Using ExcelJS with Complete Styling, Checkbox Columns, and Audit Timestamps
 */
export async function generatePOTableExcel({
  pos = [],
  fields = {},
  downloadedTime = new Date(),
  company = {}
}) {
  try {
    if (!pos || pos.length === 0) {
      Swal.fire({ icon: 'warning', title: 'No Purchase Orders', text: 'No purchase orders selected for Excel export.' });
      return;
    }

    const downloadedTimeStr = format(downloadedTime, 'dd-MM-yyyy, hh:mm:ss a');
    const compState = company?.companyName ? company : (useCompanyStore.getState().company || {});
    const normalizedPOs = pos.map(p => extractFullPODetails(p, compState));

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Manufacture ERP';
    workbook.lastModifiedBy = 'Procurement Master';
    workbook.created = new Date();
    workbook.modified = new Date();

    const COLORS = {
      NAVY: 'FF181C30',
      INDIGO: 'FF4338CA',
      ACCENT: 'FF4F46E5',
      HEADER: 'FF1E293B',
      ZEBRA: 'FFF8FAFC',
      BORDER: 'FFE2E8F0',
      WHITE: 'FFFFFFFF',
      GREEN_BG: 'FFD1FAE5',
      GREEN_TXT: 'FF065F46',
      AMBER_BG: 'FFFEF3C7',
      AMBER_TXT: 'FFB45309',
      ROSE_BG: 'FFFFE4E6',
      ROSE_TXT: 'FFBE123C'
    };

    /* ══════════════════════════════════════════════════════════════════════════
       SHEET 1: PO MASTER SUMMARY TABLE
       ══════════════════════════════════════════════════════════════════════════ */
    const wsMaster = workbook.addWorksheet('PO Master Audit', {
      views: [{ showGridLines: true, state: 'frozen', ySplit: 4 }]
    });

    // Title Row 1
    wsMaster.mergeCells('A1:L1');
    const tCell = wsMaster.getCell('A1');
    tCell.value = 'PURCHASE ORDERS PROCUREMENT AUDIT & MASTER REPORT';
    tCell.font = { name: 'Segoe UI', size: 14, bold: true, color: { argb: COLORS.WHITE } };
    tCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.NAVY } };
    tCell.alignment = { vertical: 'middle', horizontal: 'center' };
    wsMaster.getRow(1).height = 32;

    // Subtitle Row 2
    wsMaster.mergeCells('A2:L2');
    const sCell = wsMaster.getCell('A2');
    sCell.value = `Official ERP Audit Document • Company: ${compState.companyName || 'SUPERB FORMULATIONS'} • Downloaded Time: ${downloadedTimeStr} • Records: ${normalizedPOs.length}`;
    sCell.font = { name: 'Segoe UI', size: 9.5, italic: true, color: { argb: COLORS.WHITE } };
    sCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.INDIGO } };
    sCell.alignment = { vertical: 'middle', horizontal: 'center' };
    wsMaster.getRow(2).height = 22;

    // Row 3 Empty spacer
    wsMaster.getRow(3).height = 8;

    // Build Master Columns based on fields
    const masterCols = [
      { key: 'sn', header: 'SN', width: 6, align: 'center', enabled: true },
      { key: 'poRef', header: 'PO Reference No', width: 16, align: 'left', enabled: fields.poRef !== false },
      { key: 'poDate', header: 'PO Date', width: 13, align: 'center', enabled: fields.poDate !== false },
      { key: 'updatedDate', header: 'Updated Date & Time', width: 20, align: 'center', enabled: fields.updatedDate !== false },
      { key: 'supplierName', header: 'Supplier Name', width: 26, align: 'left', enabled: fields.supplierName !== false },
      { key: 'supplierGstin', header: 'Supplier GSTIN', width: 18, align: 'center', enabled: fields.supplierGstin !== false },
      { key: 'contactPerson', header: 'Contact Person', width: 18, align: 'left', enabled: fields.contactPerson !== false },
      { key: 'supplierPhone', header: 'Phone Number', width: 16, align: 'center', enabled: fields.supplierPhone !== false },
      { key: 'purchaseStatus', header: 'Purchase Status', width: 15, align: 'center', enabled: fields.purchaseStatus !== false },
      { key: 'rawMaterials', header: 'Raw Material Summary', width: 45, align: 'left', enabled: fields.rawMaterialList !== false },
      { key: 'subtotal', header: 'Subtotal (₹)', width: 15, align: 'right', isNum: true, enabled: fields.subtotal !== false },
      { key: 'taxableValue', header: 'Taxable Value (₹)', width: 16, align: 'right', isNum: true, enabled: fields.taxableValue !== false },
      { key: 'taxes', header: 'Total GST (₹)', width: 15, align: 'right', isNum: true, enabled: fields.taxBreakdown !== false },
      { key: 'shipping', header: 'Freight / Shipping (₹)', width: 18, align: 'right', isNum: true, enabled: fields.shippingFreight !== false },
      { key: 'otherCharges', header: 'Loading / Other (₹)', width: 18, align: 'right', isNum: true, enabled: fields.loadingUnloading !== false },
      { key: 'grandTotal', header: 'Grand Total (₹)', width: 18, align: 'right', isNum: true, enabled: fields.grandTotal !== false },
      { key: 'paidAmount', header: 'Paid Amount (₹)', width: 16, align: 'right', isNum: true, enabled: fields.paidAmount !== false },
      { key: 'dueAmount', header: 'Balance Due (₹)', width: 16, align: 'right', isNum: true, enabled: fields.dueAmount !== false },
      { key: 'paymentStatus', header: 'Payment Status', width: 16, align: 'center', enabled: fields.paymentStatus !== false },
      { key: 'transportMode', header: 'Transport Mode', width: 16, align: 'center', enabled: fields.transportMode !== false },
      { key: 'vehicleNumber', header: 'Vehicle Number', width: 16, align: 'center', enabled: fields.vehicleNumber !== false },
      { key: 'supplierInvoiceNo', header: 'Supplier Invoice No', width: 18, align: 'center', enabled: fields.supplierInvoiceNo !== false },
      { key: 'ewayBillNo', header: 'E-Way Bill Number', width: 18, align: 'center', enabled: fields.ewayBillNo !== false },
      { key: 'batchNumbers', header: 'Sequential Batches', width: 24, align: 'left', enabled: fields.batchNumbers !== false },
      { key: 'grnRef', header: 'GRN Reference', width: 16, align: 'center', enabled: fields.grnReference !== false }
    ];

    const activeMCols = masterCols.filter(c => c.enabled);

    // Row 4: Header
    const hRow = wsMaster.getRow(4);
    hRow.height = 26;
    activeMCols.forEach((col, idx) => {
      const c = hRow.getCell(idx + 1);
      c.value = col.header;
      c.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: COLORS.WHITE } };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.HEADER } };
      c.alignment = { vertical: 'middle', horizontal: col.align };
      c.border = {
        top: { style: 'thin', color: { argb: COLORS.NAVY } },
        bottom: { style: 'medium', color: { argb: COLORS.ACCENT } },
        left: { style: 'thin', color: { argb: COLORS.NAVY } },
        right: { style: 'thin', color: { argb: COLORS.NAVY } }
      };
      wsMaster.getColumn(idx + 1).width = col.width;
    });

    let curRowIdx = 5;
    normalizedPOs.forEach((po, rIdx) => {
      const row = wsMaster.getRow(curRowIdx);
      row.height = 22;

      activeMCols.forEach((col, cIdx) => {
        const cell = row.getCell(cIdx + 1);
        let val = '';

        if (col.key === 'sn') val = rIdx + 1;
        else if (col.key === 'poRef') val = po.poRef;
        else if (col.key === 'poDate') val = po.poDate;
        else if (col.key === 'updatedDate') val = po.updatedDate;
        else if (col.key === 'supplierName') val = po.supplierName;
        else if (col.key === 'supplierGstin') val = po.supplier.gstin;
        else if (col.key === 'contactPerson') val = po.supplier.contactPerson;
        else if (col.key === 'supplierPhone') val = po.supplier.phone;
        else if (col.key === 'purchaseStatus') val = po.purchaseStatus;
        else if (col.key === 'rawMaterials') val = po.rawMaterialSummaryText.replace(/\n/g, ' ');
        else if (col.key === 'subtotal') val = po.financials.subtotal;
        else if (col.key === 'taxableValue') val = po.financials.taxableValue;
        else if (col.key === 'taxes') val = po.financials.igst + po.financials.cgst + po.financials.sgst;
        else if (col.key === 'shipping') val = po.financials.shipping;
        else if (col.key === 'otherCharges') val = po.financials.otherCharges;
        else if (col.key === 'grandTotal') val = po.financials.grandTotal;
        else if (col.key === 'paidAmount') val = po.financials.paidAmount;
        else if (col.key === 'dueAmount') val = po.financials.dueAmount;
        else if (col.key === 'paymentStatus') val = po.financials.paymentStatus;
        else if (col.key === 'transportMode') val = po.logistics.transportMode;
        else if (col.key === 'vehicleNumber') val = po.logistics.vehicleNumber;
        else if (col.key === 'supplierInvoiceNo') val = po.logistics.supplierInvoiceNo;
        else if (col.key === 'ewayBillNo') val = po.logistics.ewayBillNo;
        else if (col.key === 'batchNumbers') val = po.inventoryBatches.map(b => b.batchNumber).join(', ');
        else if (col.key === 'grnRef') val = po.grn.referenceNo;

        cell.value = val;
        cell.font = { name: 'Segoe UI', size: 9 };
        cell.alignment = { vertical: 'middle', horizontal: col.align };

        if (col.isNum) {
          cell.numFmt = '₹ #,##0.00';
          cell.font = { name: 'Segoe UI', size: 9, bold: col.key === 'grandTotal' };
        }

        if (rIdx % 2 === 1) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.ZEBRA } };
        }

        cell.border = {
          top: { style: 'thin', color: { argb: COLORS.BORDER } },
          bottom: { style: 'thin', color: { argb: COLORS.BORDER } },
          left: { style: 'thin', color: { argb: COLORS.BORDER } },
          right: { style: 'thin', color: { argb: COLORS.BORDER } }
        };
      });

      curRowIdx++;
    });

    // Totals Row
    const totRow = wsMaster.getRow(curRowIdx);
    totRow.height = 24;
    totRow.getCell(1).value = 'TOTALS';
    totRow.getCell(1).font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: COLORS.WHITE } };
    totRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.NAVY } };
    totRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };

    activeMCols.forEach((col, cIdx) => {
      const cell = totRow.getCell(cIdx + 1);
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.NAVY } };
      cell.border = { top: { style: 'thin', color: { argb: COLORS.NAVY } }, bottom: { style: 'double', color: { argb: COLORS.WHITE } } };

      if (col.isNum) {
        const colLetter = wsMaster.getColumn(cIdx + 1).letter;
        cell.value = { formula: `SUM(${colLetter}5:${colLetter}${curRowIdx - 1})` };
        cell.numFmt = '₹ #,##0.00';
        cell.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: COLORS.WHITE } };
        cell.alignment = { vertical: 'middle', horizontal: 'right' };
      }
    });

    /* ══════════════════════════════════════════════════════════════════════════
       SHEET 2: ORDERED RAW MATERIALS & ITEMS BREAKDOWN
       ══════════════════════════════════════════════════════════════════════════ */
    const wsItems = workbook.addWorksheet('Raw Materials & Items', {
      views: [{ showGridLines: true, state: 'frozen', ySplit: 1 }]
    });

    const itemsHeaders = [
      'PO Ref', 'PO Date', 'Supplier', 'RM Code', 'Material Name', 'Item Type',
      'Quantity', 'UOM', 'Unit Price (₹)', 'GST %', 'Line Total (₹)', 'Quality / Lab Route'
    ];
    const itemsHRow = wsItems.getRow(1);
    itemsHRow.height = 24;
    itemsHeaders.forEach((h, idx) => {
      const c = itemsHRow.getCell(idx + 1);
      c.value = h;
      c.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: COLORS.WHITE } };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.INDIGO } };
      c.alignment = { vertical: 'middle', horizontal: 'center' };
      wsItems.getColumn(idx + 1).width = 18;
    });
    wsItems.getColumn(5).width = 28; // Material Name
    wsItems.getColumn(3).width = 24; // Supplier

    let itemRowIdx = 2;
    normalizedPOs.forEach((po) => {
      po.items.forEach((it) => {
        const row = wsItems.getRow(itemRowIdx);
        row.height = 20;
        row.values = [
          po.poRef,
          po.poDate,
          po.supplierName,
          it.code,
          it.name,
          it.type,
          it.quantity,
          it.uom,
          it.unitPrice,
          `${it.gstRate}%`,
          it.total,
          it.labRoute
        ];

        row.getCell(9).numFmt = '₹ #,##0.00';
        row.getCell(11).numFmt = '₹ #,##0.00';

        row.eachCell((cell) => {
          cell.font = { name: 'Segoe UI', size: 9 };
          cell.alignment = { vertical: 'middle' };
          cell.border = {
            top: { style: 'thin', color: { argb: COLORS.BORDER } },
            bottom: { style: 'thin', color: { argb: COLORS.BORDER } }
          };
        });
        itemRowIdx++;
      });
    });

    /* ══════════════════════════════════════════════════════════════════════════
       SHEET 3: LOGISTICS & TRANSPORT
       ══════════════════════════════════════════════════════════════════════════ */
    const wsLogistics = workbook.addWorksheet('Logistics & Transport', {
      views: [{ showGridLines: true, state: 'frozen', ySplit: 1 }]
    });

    const logHeaders = [
      'PO Ref', 'PO Date', 'Supplier', 'Transport Mode', 'Vehicle Number',
      'Transporter / Carrier', 'Supplier Invoice No', 'Invoice Date',
      'E-Way Bill Number', 'E-Way Bill Date', 'Valid Till Date', 'Invoice Attached'
    ];
    const logHRow = wsLogistics.getRow(1);
    logHRow.height = 24;
    logHeaders.forEach((h, idx) => {
      const c = logHRow.getCell(idx + 1);
      c.value = h;
      c.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: COLORS.WHITE } };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.HEADER } };
      c.alignment = { vertical: 'middle', horizontal: 'center' };
      wsLogistics.getColumn(idx + 1).width = 20;
    });

    let logRowIdx = 2;
    normalizedPOs.forEach((po) => {
      const row = wsLogistics.getRow(logRowIdx);
      row.height = 20;
      row.values = [
        po.poRef,
        po.poDate,
        po.supplierName,
        po.logistics.transportMode,
        po.logistics.vehicleNumber,
        po.logistics.transporterName,
        po.logistics.supplierInvoiceNo,
        po.logistics.supplierInvoiceDate,
        po.logistics.ewayBillNo,
        po.logistics.ewayBillDate,
        po.logistics.validTillDate,
        po.logistics.hasInvoiceDoc ? 'Yes (PDF)' : 'No'
      ];
      row.eachCell((cell) => {
        cell.font = { name: 'Segoe UI', size: 9 };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.border = {
          top: { style: 'thin', color: { argb: COLORS.BORDER } },
          bottom: { style: 'thin', color: { argb: COLORS.BORDER } }
        };
      });
      row.getCell(3).alignment = { vertical: 'middle', horizontal: 'left' };
      logRowIdx++;
    });

    /* ══════════════════════════════════════════════════════════════════════════
       SHEET 4: PAYMENT INSTALLMENTS & SETTLEMENT LOGS
       ══════════════════════════════════════════════════════════════════════════ */
    const wsPay = workbook.addWorksheet('Payment Installments', {
      views: [{ showGridLines: true, state: 'frozen', ySplit: 1 }]
    });

    const payHeaders = [
      'PO Ref', 'Supplier', 'Grand Total (₹)', 'Total Paid (₹)', 'Balance Due (₹)',
      'Payment Status', 'Installment #', 'Payment Date', 'Amount Paid (₹)',
      'Payment Mode', 'Reference / UTR', 'Notes'
    ];
    const payHRow = wsPay.getRow(1);
    payHRow.height = 24;
    payHeaders.forEach((h, idx) => {
      const c = payHRow.getCell(idx + 1);
      c.value = h;
      c.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: COLORS.WHITE } };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF065F46' } }; // Emerald
      c.alignment = { vertical: 'middle', horizontal: 'center' };
      wsPay.getColumn(idx + 1).width = 20;
    });

    let payRowIdx = 2;
    normalizedPOs.forEach((po) => {
      if (po.paymentHistory.length === 0) {
        const row = wsPay.getRow(payRowIdx);
        row.height = 20;
        row.values = [
          po.poRef,
          po.supplierName,
          po.financials.grandTotal,
          po.financials.paidAmount,
          po.financials.dueAmount,
          po.financials.paymentStatus,
          'No Installments',
          '—',
          0,
          '—',
          '—',
          'Unpaid'
        ];
        row.getCell(3).numFmt = '₹ #,##0.00';
        row.getCell(4).numFmt = '₹ #,##0.00';
        row.getCell(5).numFmt = '₹ #,##0.00';
        row.getCell(9).numFmt = '₹ #,##0.00';
        payRowIdx++;
      } else {
        po.paymentHistory.forEach((inst) => {
          const row = wsPay.getRow(payRowIdx);
          row.height = 20;
          row.values = [
            po.poRef,
            po.supplierName,
            po.financials.grandTotal,
            po.financials.paidAmount,
            po.financials.dueAmount,
            po.financials.paymentStatus,
            inst.dayLabel,
            inst.paymentDate,
            inst.amount,
            inst.paymentMode,
            inst.paymentRef,
            inst.paymentNotes
          ];

          row.getCell(3).numFmt = '₹ #,##0.00';
          row.getCell(4).numFmt = '₹ #,##0.00';
          row.getCell(5).numFmt = '₹ #,##0.00';
          row.getCell(9).numFmt = '₹ #,##0.00';

          row.eachCell((cell) => {
            cell.font = { name: 'Segoe UI', size: 9 };
            cell.alignment = { vertical: 'middle' };
            cell.border = {
              top: { style: 'thin', color: { argb: COLORS.BORDER } },
              bottom: { style: 'thin', color: { argb: COLORS.BORDER } }
            };
          });
          payRowIdx++;
        });
      }
    });

    /* ══════════════════════════════════════════════════════════════════════════
       SHEET 5: INVENTORY BATCHES & GRN DETAILS
       ══════════════════════════════════════════════════════════════════════════ */
    const wsBatches = workbook.addWorksheet('Inventory Batches & GRN', {
      views: [{ showGridLines: true, state: 'frozen', ySplit: 1 }]
    });

    const batchHeaders = [
      'PO Ref', 'GRN Reference', 'Material Name', 'Batch Number', 'Batch Status',
      'Net Stock Stored', 'UOM', 'Warehouse Location', 'Mfg Date', 'Expiry Date',
      'Stock Added Date', 'Lab / QC Status'
    ];
    const bHRow = wsBatches.getRow(1);
    bHRow.height = 24;
    batchHeaders.forEach((h, idx) => {
      const c = bHRow.getCell(idx + 1);
      c.value = h;
      c.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: COLORS.WHITE } };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
      c.alignment = { vertical: 'middle', horizontal: 'center' };
      wsBatches.getColumn(idx + 1).width = 20;
    });
    wsBatches.getColumn(4).width = 26; // Batch Number

    let bRowIdx = 2;
    normalizedPOs.forEach((po) => {
      po.inventoryBatches.forEach((b) => {
        const row = wsBatches.getRow(bRowIdx);
        row.height = 20;
        row.values = [
          po.poRef,
          po.grn.referenceNo,
          b.materialName,
          b.batchNumber,
          b.status,
          b.netStock,
          b.uom,
          b.warehouseLocation,
          b.mfgDate,
          b.expiryDate,
          b.stockAddedDate,
          b.labExemptBadge
        ];

        row.eachCell((cell) => {
          cell.font = { name: 'Segoe UI', size: 9 };
          cell.alignment = { vertical: 'middle' };
          cell.border = {
            top: { style: 'thin', color: { argb: COLORS.BORDER } },
            bottom: { style: 'thin', color: { argb: COLORS.BORDER } }
          };
        });
        bRowIdx++;
      });
    });

    // Write Buffer & Trigger Download
    const cleanStamp = format(new Date(), 'yyyy-MM-dd_HHmm');
    const filename = `Purchase_Orders_Report_${cleanStamp}.xlsx`;

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);

    Swal.fire({
      icon: 'success',
      title: 'Excel Export Complete',
      html: `
        <div class="text-left text-xs space-y-1">
          <p>Exported <strong>${normalizedPOs.length}</strong> Purchase Orders across 5 structured Excel sheets!</p>
          <p class="text-slate-500 font-mono text-[11px]">• File: <strong>${filename}</strong></p>
          <p class="text-slate-500 font-mono text-[11px]">• Downloaded Time: <strong>${downloadedTimeStr}</strong></p>
        </div>
      `,
      timer: 3500,
      showConfirmButton: false,
      toast: true,
      position: 'top-end'
    });
  } catch (err) {
    console.error('Error generating Excel workbook:', err);
    Swal.fire({
      icon: 'error',
      title: 'Excel Export Failed',
      text: err.message || 'Could not export Purchase Orders to Excel.'
    });
  }
}
