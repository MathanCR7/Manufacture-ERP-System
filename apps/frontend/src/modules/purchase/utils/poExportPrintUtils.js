import ExcelJS from 'exceljs';
import * as XLSX from 'xlsx';
import Swal from 'sweetalert2';
import { format } from 'date-fns';
import { numberToIndianWords } from '@/utils/gstEngine';
import useCompanyStore from '@/app/store/companyStore';

/**
 * Normalizes Purchase Order data from either CreatePOPage or EditPOPage
 */
export function normalizePOData(rawInput = {}) {
  const rawData = rawInput || {};
  const referenceNo = rawData.referenceNo || rawData.poNumber || rawData.code || 'PO DRAFT';
  const orderDate = rawData.orderDate || rawData.createdAt || new Date();
  const expectedDelivery = rawData.expectedDelivery || rawData.deliveryDate || rawData.expectedDate;
  const purchaseStatus = (rawData.purchaseStatus || rawData.status || 'DRAFT').toUpperCase();
  const selectedSupplier = rawData.selectedSupplier || rawData.supplier || rawData.vendor || {};
  const supplierInvoiceNo = rawData.supplierInvoiceNo || rawData.invoiceNo || '—';
  const supplierInvoiceDate = rawData.supplierInvoiceDate || rawData.invoiceDate;
  const transportMode = rawData.transportMode || 'ROAD';
  const vehicleNumber = rawData.vehicleNumber || rawData.vehicleNo || '—';
  const transporterName = rawData.transporterName || rawData.transporter || '—';
  const lrNumber = rawData.lrNumber || rawData.lrNo || '—';
  const ewayBillNo = rawData.ewayBillNo || rawData.ewayBillNumber || '—';
  const ewayBillDate = rawData.ewayBillDate;
  const tillDate = rawData.tillDate;
  const items = (Array.isArray(rawData.items) && rawData.items.length > 0)
    ? rawData.items
    : (Array.isArray(rawData.orderItems) && rawData.orderItems.length > 0)
      ? rawData.orderItems
      : (Array.isArray(rawData.purchaseOrderItems) && rawData.purchaseOrderItems.length > 0)
        ? rawData.purchaseOrderItems
        : [];
  const discount = parseFloat(rawData.discount) || 0;
  const shipping = parseFloat(rawData.shipping || rawData.freight) || 0;
  const shippingGstApplicable = rawData.shippingGstApplicable === true || rawData.shippingGst === true;
  const shippingGstPercentage = Number(rawData.shippingGstPercentage !== undefined ? rawData.shippingGstPercentage : 18);
  const shippingGstAmount = shippingGstApplicable && shipping > 0 ? shipping * (shippingGstPercentage / 100) : 0;

  const otherCharges = parseFloat(rawData.otherCharges) || 0;
  const otherChargesGstApplicable = rawData.otherChargesGstApplicable === true || rawData.otherChargesGst === true;
  const otherChargesGstPercentage = Number(rawData.otherChargesGstPercentage !== undefined ? rawData.otherChargesGstPercentage : 18);
  const otherChargesGstAmount = otherChargesGstApplicable && otherCharges > 0 ? otherCharges * (otherChargesGstPercentage / 100) : 0;
  const otherChargesLabel = rawData.otherChargesLabel || 'Other Charges';

  const subtotal = parseFloat(rawData.subtotal) || 0;
  const isInterState = !!rawData.isInterState;
  const cgstAmount = parseFloat(rawData.cgstAmount) || 0;
  const sgstAmount = parseFloat(rawData.sgstAmount) || 0;
  const igstAmount = parseFloat(rawData.igstAmount) || 0;
  const roundOff = parseFloat(rawData.roundOff) || 0;
  const grandTotal = parseFloat(rawData.grandTotal || rawData.amount || rawData.totalAmount) || 0;
  const paymentStatus = (rawData.paymentStatus || 'UNPAID').toUpperCase();
  const paidAmount = parseFloat(rawData.paidAmount) || 0;
  const paymentMode = rawData.paymentMode || 'BANK_TRANSFER';
  const paymentRef = rawData.paymentRef || rawData.reference || '—';
  const paymentNotes = rawData.paymentNotes || '';
  const notes = rawData.notes || rawData.remarks || '—';

  // Live Company Details fallback from Zustand store
  const storeCompany = useCompanyStore.getState()?.company;
  const comp = rawData.company || (storeCompany?.companyName ? storeCompany : null);
  const creator = rawData.creator || rawData.createdBy?.name || 'Admin Master';

  const safeItems = (items || []).map((it, idx) => {
    const qty = parseFloat(it.quantity) || 0;
    const price = parseFloat(it.unitPrice || it.rate || it.price) || 0;
    const itemSubtotal = it.subtotal !== undefined && it.subtotal !== null && !isNaN(parseFloat(it.subtotal))
      ? parseFloat(it.subtotal)
      : qty * price;

    const isTaxable = it.gstApplicable !== false && it.isTaxable !== false;
    const itemGstRate = isTaxable 
      ? Number(it.gstPercentage !== undefined ? it.gstPercentage : (it.gstRate !== undefined ? it.gstRate : 18))
      : 0;

    const batches = Array.isArray(it.batches) && it.batches.length > 0
      ? it.batches.map((b, bIdx) => ({
          batchIndex: bIdx + 1,
          batchNumber: b.batchNumber || it.batchNumber || `BATCH-${(it.code || 'RM').slice(0, 8)}-00${bIdx + 1}`,
          quantity: parseFloat(b.quantity ?? b.batchQuantity) || qty,
          weight: b.weight || it.weight || '',
          mfgBatchNo: b.mfgBatchNo || it.mfgBatchNo || '',
          mfgDate: b.mfgDate || it.mfgDate || '',
          expDate: b.expDate || it.expDate || ''
        }))
      : (it.batchNumber
          ? [{
              batchIndex: 1,
              batchNumber: it.batchNumber,
              quantity: qty,
              weight: it.weight || '',
              mfgBatchNo: it.mfgBatchNo || '',
              mfgDate: it.mfgDate || '',
              expDate: it.expDate || ''
            }]
          : []);

    return {
      index: idx + 1,
      id: it.id || `item_${idx}`,
      code: it.code || it.referenceId || it.rmId || it.systemCode || `RM-${String(idx + 1).padStart(5, '0')}`,
      name: it.name || it.itemDescription || 'Item',
      itemType: it.itemType || 'RM',
      category: it.category?.name || it.category || 'Raw Material',
      subcategory: it.subcategory?.name || it.subcategory || '-',
      uom: it.uomLabel || it.uom?.abbreviation || it.uom?.name || 'units',
      quantity: qty,
      unitPrice: price,
      subtotal: itemSubtotal,
      gstPercent: itemGstRate,
      gstPercentage: itemGstRate,
      gstApplicable: isTaxable,
      taxStatus: isTaxable ? `GST (${itemGstRate}%)` : 'GST Exempt',
      labTestStatus: it.labTestStatus 
        ? it.labTestStatus 
        : (it.labTestRequired !== undefined 
            ? (it.labTestRequired ? 'Lab Required' : 'Lab Exempt') 
            : (it.labExempt ? 'Lab Exempt' : 'Lab Required')),
      batches
    };
  });

  const totalQuantity = safeItems.reduce((sum, it) => sum + (parseFloat(it.quantity) || 0), 0);
  const totalItemsCount = safeItems.length;

  const totalPayable = parseFloat(grandTotal) || 0;
  const numPaid = parseFloat(paidAmount) || 0;
  const balanceDue = Math.max(0, totalPayable - numPaid);

  const formatDateVal = (d) => {
    if (!d) return '—';
    try {
      if (typeof d === 'string' && d.includes('-') && d.length === 10) return d;
      return format(new Date(d), 'dd-MM-yyyy');
    } catch {
      return String(d);
    }
  };

  const formattedSupplierAddress = [
    selectedSupplier?.address,
    selectedSupplier?.city,
    selectedSupplier?.state,
    selectedSupplier?.pincode ? `PIN: ${selectedSupplier.pincode}` : ''
  ].filter(Boolean).join(', ') || selectedSupplier?.address || '—';

  return {
    referenceNo: referenceNo || 'PO DRAFT',
    orderDate: formatDateVal(orderDate || new Date()),
    expectedDelivery: formatDateVal(expectedDelivery),
    purchaseStatus: (purchaseStatus || 'DRAFT').toUpperCase(),
    workflowLocked: true,
    creator: creator || 'Admin Master',
    createdAt: format(new Date(), 'dd MMM yyyy, HH:mm'),
    supplier: {
      name: selectedSupplier?.name || '—',
      contactPerson: selectedSupplier?.contactPerson || selectedSupplier?.contactName || '—',
      phone: selectedSupplier?.phone || selectedSupplier?.mobile || '—',
      email: selectedSupplier?.email || '—',
      gstin: selectedSupplier?.gstin || selectedSupplier?.gst || '—',
      pan: selectedSupplier?.pan || '—',
      address: formattedSupplierAddress
    },
    taxRule: isInterState ? 'IGST (Interstate)' : 'CGST+SGST (Intrastate)',
    isInterState,
    logistics: {
      supplierInvoiceNo: supplierInvoiceNo || '—',
      supplierInvoiceDate: formatDateVal(supplierInvoiceDate),
      transportMode: transportMode || 'ROAD',
      vehicleNumber: vehicleNumber || '—',
      transporterName: transporterName || '—',
      lrNumber: lrNumber || '—',
      ewayBillNo: ewayBillNo || '—',
      ewayBillDate: formatDateVal(ewayBillDate),
      tillDate: formatDateVal(tillDate)
    },
    items: safeItems,
    financials: {
      subtotal: parseFloat(subtotal) || 0,
      totalItemsCount,
      totalQuantity,
      discount: parseFloat(discount) || 0,
      shipping: parseFloat(shipping) || 0,
      shippingGstApplicable,
      shippingGstPercentage,
      shippingGstAmount,
      otherCharges: parseFloat(otherCharges) || 0,
      otherChargesLabel,
      otherChargesGstApplicable,
      otherChargesGstPercentage,
      otherChargesGstAmount,
      cgstAmount: parseFloat(cgstAmount) || 0,
      sgstAmount: parseFloat(sgstAmount) || 0,
      igstAmount: parseFloat(igstAmount) || 0,
      roundOff: parseFloat(roundOff) || 0,
      grandTotal: totalPayable,
      amountInWords: numberToIndianWords(totalPayable)
    },
    payment: {
      paymentStatus: (paymentStatus || 'UNPAID').toUpperCase(),
      totalPayable,
      paidAmount: numPaid,
      balanceDue,
      paymentMode: paymentMode || 'BANK_TRANSFER',
      paymentRef: paymentRef || '—',
      paymentNotes: paymentNotes || '—'
    },
    notes: notes || '—',
    company: {
      name: comp?.companyName || 'SUPERB FORMULATIONS PRIVATE LIMITED',
      address: comp?.companyAddress || 'Factory / Registered Office Address',
      gstin: comp?.companyGstin || '33AAWCS2781F1ZZ',
      pan: comp?.companyPan || 'AAWCS2781F',
      phone: comp?.companyMobile || '+91 99404 54154'
    }
  };
}

/**
 * Export complete Purchase Order to Excel with 2 distinct, highly structured, beautifully styled sheets using ExcelJS
 */
export async function exportPurchaseOrderToExcel(poRawData) {
  try {
    const data = normalizePOData(poRawData);
    const workbook = new ExcelJS.Workbook();
    workbook.creator = data.creator || 'Manufacturing ERP';
    workbook.lastModifiedBy = 'ERP Master System';
    workbook.created = new Date();
    workbook.modified = new Date();

    // ── PALETTE & STYLES ──
    const COLORS = {
      NAVY_PRIMARY: 'FF1E1B4B',    // Deep Indigo #1E1B4B
      ROYAL_INDIGO: 'FF312E81',    // Indigo 900 #312E81
      ACCENT_VIBRANT: 'FF4F46E5',  // Vibrant Indigo #4F46E5
      TABLE_HEADER: 'FF1E293B',    // Slate 800 #1E293B
      SECTION_HEADER: 'FF334155',  // Slate 700 #334155
      ZEBRA_ROW: 'FFF8FAFC',       // Slate 50 #F8FAFC
      BATCH_BG: 'FFEEF2FF',        // Indigo 50 #EEF2FF
      TOTALS_BG: 'FFE2E8F0',       // Slate 200 #E2E8F0
      BORDER_LIGHT: 'FFE2E8F0',    // Slate 200
      BORDER_MED: 'FFCBD5E1',      // Slate 300
      WHITE: 'FFFFFFFF',
      TEXT_DARK: 'FF0F172A',       // Slate 900
      TEXT_MUTED: 'FF64748B',      // Slate 500
      GREEN_BG: 'FFD1FAE5',        // Emerald 100
      GREEN_TEXT: 'FF065F46',      // Emerald 800
      AMBER_BG: 'FFFEF3C7',        // Amber 100
      AMBER_TEXT: 'FFB45309',      // Amber 800
      BLUE_BG: 'FFE0E7FF',         // Blue 100
      BLUE_TEXT: 'FF3730A3',       // Blue 800
      ROSE_BG: 'FFFFE4E6',         // Rose 100
      ROSE_TEXT: 'FFBE123C'        // Rose 800
    };

    const BORDERS = {
      thin: {
        top: { style: 'thin', color: { argb: COLORS.BORDER_LIGHT } },
        left: { style: 'thin', color: { argb: COLORS.BORDER_LIGHT } },
        bottom: { style: 'thin', color: { argb: COLORS.BORDER_LIGHT } },
        right: { style: 'thin', color: { argb: COLORS.BORDER_LIGHT } }
      },
      header: {
        top: { style: 'thin', color: { argb: COLORS.NAVY_PRIMARY } },
        left: { style: 'thin', color: { argb: COLORS.NAVY_PRIMARY } },
        bottom: { style: 'medium', color: { argb: COLORS.ACCENT_VIBRANT } },
        right: { style: 'thin', color: { argb: COLORS.NAVY_PRIMARY } }
      },
      totals: {
        top: { style: 'thin', color: { argb: COLORS.BORDER_MED } },
        bottom: { style: 'double', color: { argb: COLORS.TABLE_HEADER } },
        left: { style: 'thin', color: { argb: COLORS.BORDER_LIGHT } },
        right: { style: 'thin', color: { argb: COLORS.BORDER_LIGHT } }
      }
    };

    /* ══════════════════════════════════════════════════════════════════════════
       SHEET 1: PO MASTER & OVERVIEW
       ══════════════════════════════════════════════════════════════════════════ */
    const wsOverview = workbook.addWorksheet('PO Overview', {
      views: [{ showGridLines: true }],
      properties: { tabColor: { argb: 'FF4338CA' } }
    });

    // Title Row 1
    wsOverview.mergeCells('A1:D1');
    const titleCell = wsOverview.getCell('A1');
    titleCell.value = 'PURCHASE ORDER MASTER AUDIT & OVERVIEW';
    titleCell.font = { name: 'Segoe UI', size: 14, bold: true, color: { argb: COLORS.WHITE } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.NAVY_PRIMARY } };
    titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
    wsOverview.getRow(1).height = 34;

    // Subtitle Row 2
    wsOverview.mergeCells('A2:D2');
    const subCell = wsOverview.getCell('A2');
    subCell.value = `Official ERP Document • PO Ref: ${data.referenceNo} • Company: ${data.company.name} • Generated: ${data.createdAt}`;
    subCell.font = { name: 'Segoe UI', size: 9.5, italic: true, color: { argb: COLORS.WHITE } };
    subCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.ROYAL_INDIGO } };
    subCell.alignment = { vertical: 'middle', horizontal: 'center' };
    wsOverview.getRow(2).height = 22;

    const addSectionHeader = (rowNum, title) => {
      wsOverview.mergeCells(`A${rowNum}:D${rowNum}`);
      const c = wsOverview.getCell(`A${rowNum}`);
      c.value = title;
      c.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: COLORS.WHITE } };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.SECTION_HEADER } };
      c.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
      wsOverview.getRow(rowNum).height = 24;
    };

    let curR = 4;
    const addKeyValue = (label, val, isAmount = false) => {
      const row = wsOverview.getRow(curR);
      wsOverview.mergeCells(`A${curR}:B${curR}`);
      wsOverview.mergeCells(`C${curR}:D${curR}`);

      const cLabel = wsOverview.getCell(`A${curR}`);
      cLabel.value = label;
      cLabel.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: COLORS.TEXT_DARK } };
      cLabel.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: curR % 2 === 0 ? COLORS.ZEBRA_ROW : COLORS.WHITE } };
      cLabel.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
      cLabel.border = BORDERS.thin;

      const cVal = wsOverview.getCell(`C${curR}`);
      cVal.value = val !== undefined && val !== null ? val : '—';
      cVal.font = { name: 'Segoe UI', size: 9.5, color: { argb: COLORS.TEXT_DARK } };
      cVal.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: curR % 2 === 0 ? COLORS.ZEBRA_ROW : COLORS.WHITE } };
      cVal.alignment = { vertical: 'middle', horizontal: isAmount ? 'right' : 'left', indent: isAmount ? 0 : 1 };
      cVal.border = BORDERS.thin;
      if (isAmount && typeof val === 'number') {
        cVal.numFmt = '₹#,##0.00';
      }
      row.height = 20;
      curR++;
    };

    // 1. Order Information
    addSectionHeader(curR, '1. GENERAL ORDER INFORMATION');
    curR++;
    addKeyValue('PO Reference Number', data.referenceNo);
    addKeyValue('PO Order Date', data.orderDate);
    addKeyValue('Expected Delivery Date', data.expectedDelivery);
    addKeyValue('Workflow Purchase Status', data.purchaseStatus);
    addKeyValue('Tax Supply Rule', data.taxRule);
    addKeyValue('Created By / Author', data.creator);

    curR++;
    // 2. Supplier Details
    addSectionHeader(curR, '2. SUPPLIER / VENDOR DETAILS');
    curR++;
    addKeyValue('Supplier / Vendor Name', data.supplier.name);
    if (data.supplier.contactPerson && data.supplier.contactPerson !== '—') {
      addKeyValue('Contact Person', data.supplier.contactPerson);
    }
    addKeyValue('Contact Phone / Mobile', data.supplier.phone);
    if (data.supplier.email && data.supplier.email !== '—') {
      addKeyValue('Email Address', data.supplier.email);
    }
    addKeyValue('GSTIN', data.supplier.gstin);
    addKeyValue('PAN Number', data.supplier.pan);
    addKeyValue('Registered Business Address', data.supplier.address);

    curR++;
    // 3. Logistics Details
    addSectionHeader(curR, '3. SUPPLIER INVOICE & LOGISTICS / E-WAY BILL');
    curR++;
    addKeyValue('Supplier Invoice No', data.logistics.supplierInvoiceNo);
    addKeyValue('Supplier Invoice Date', data.logistics.supplierInvoiceDate);
    addKeyValue('Transport Mode', data.logistics.transportMode);
    addKeyValue('Vehicle Number', data.logistics.vehicleNumber);
    addKeyValue('Transporter / Carrier', data.logistics.transporterName);
    addKeyValue('LR / Consignment No', data.logistics.lrNumber);
    addKeyValue('E-Way Bill Number', data.logistics.ewayBillNo);
    addKeyValue('E-Way Bill Date', data.logistics.ewayBillDate);
    addKeyValue('Valid Till Date', data.logistics.tillDate);

    curR++;
    // 4. Financial Summary
    addSectionHeader(curR, '4. CHARGES & FINANCIAL SUMMARY');
    curR++;
    addKeyValue('Total Line Items Count', data.financials.totalItemsCount);
    addKeyValue('Total Quantity Count', data.financials.totalQuantity);
    addKeyValue('Items Subtotal (₹)', data.financials.subtotal, true);
    if (data.financials.discount > 0) addKeyValue('Discount (₹)', -data.financials.discount, true);
    if (data.financials.shipping > 0) {
      const shipLabel = data.financials.shippingGstApplicable 
        ? `Freight / Shipping (${data.financials.shippingGstPercentage}% GST) (₹)` 
        : 'Freight / Shipping (₹)';
      addKeyValue(shipLabel, data.financials.shipping, true);
    }
    if (data.financials.otherCharges > 0) {
      const chLabel = data.financials.otherChargesGstApplicable 
        ? `${data.financials.otherChargesLabel} (${data.financials.otherChargesGstPercentage}% GST) (₹)` 
        : `${data.financials.otherChargesLabel} (₹)`;
      addKeyValue(chLabel, data.financials.otherCharges, true);
    }
    if (data.isInterState) {
      addKeyValue('IGST (Interstate) (₹)', data.financials.igstAmount, true);
    } else {
      addKeyValue('CGST (Intrastate) (₹)', data.financials.cgstAmount, true);
      addKeyValue('SGST (Intrastate) (₹)', data.financials.sgstAmount, true);
    }
    if (data.financials.roundOff !== 0) addKeyValue('Round Off (₹)', data.financials.roundOff, true);
    addKeyValue('Grand Total (₹)', data.financials.grandTotal, true);
    addKeyValue('Total Amount in Words', data.financials.amountInWords);

    curR++;
    // 5. Payment Details
    addSectionHeader(curR, '5. PAYMENT & SETTLEMENT DETAILS');
    curR++;
    addKeyValue('Payment Status', data.payment.paymentStatus);
    addKeyValue('Total Payable (₹)', data.payment.totalPayable, true);
    addKeyValue('Amount Paid (₹)', data.payment.paidAmount, true);
    addKeyValue('Balance Due (₹)', data.payment.balanceDue, true);
    addKeyValue('Payment Channel / Mode', data.payment.paymentMode);
    addKeyValue('Transaction Reference ID', data.payment.paymentRef);
    addKeyValue('Payment Notes', data.payment.paymentNotes);
    addKeyValue('Supplier Instructions / Remarks', data.notes);

    wsOverview.getColumn(1).width = 25;
    wsOverview.getColumn(2).width = 25;
    wsOverview.getColumn(3).width = 32;
    wsOverview.getColumn(4).width = 32;

    /* ══════════════════════════════════════════════════════════════════════════
       SHEET 2: RAW MATERIALS & BATCHES BREAKDOWN
       ══════════════════════════════════════════════════════════════════════════ */
    const wsItems = workbook.addWorksheet('Raw Materials & Batches', {
      views: [{ showGridLines: true }],
      properties: { tabColor: { argb: 'FF059669' } }
    });

    // Title Row 1
    wsItems.mergeCells('A1:V1');
    const itTitle = wsItems.getCell('A1');
    itTitle.value = 'RAW MATERIALS & NON-INVENTORY PROCUREMENT BREAKDOWN';
    itTitle.font = { name: 'Segoe UI', size: 13, bold: true, color: { argb: COLORS.WHITE } };
    itTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.NAVY_PRIMARY } };
    itTitle.alignment = { vertical: 'middle', horizontal: 'center' };
    wsItems.getRow(1).height = 34;

    // Subtitle Row 2
    wsItems.mergeCells('A2:V2');
    const itSub = wsItems.getCell('A2');
    itSub.value = `PO Reference: ${data.referenceNo}  •  Supplier: ${data.supplier.name}  •  Total Items: ${data.financials.totalItemsCount}  •  Total Quantity: ${data.financials.totalQuantity} units  •  Grand Total: ₹${data.financials.grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
    itSub.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: COLORS.WHITE } };
    itSub.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.ACCENT_VIBRANT } };
    itSub.alignment = { vertical: 'middle', horizontal: 'center' };
    wsItems.getRow(2).height = 22;

    // Table Column Headers (22 Columns)
    const headers = [
      '#',
      'Raw Material / Item Description',
      'Item Code',
      'Category',
      'Subcategory',
      'Item Type',
      'UOM',
      'Ordered Qty',
      'Unit Rate (₹)',
      'Tax Status',
      'GST %',
      'GST Amount (₹)',
      'Lab Test Status',
      'Line Subtotal (₹)',
      'Total Incl. Tax (₹)',
      'Batch #',
      'Our Internal Batch No',
      'Batch Qty',
      'Weight / Pack Size',
      'Supplier MFG Batch No',
      'MFG Date',
      'Expiry Date'
    ];

    const hRow = wsItems.getRow(4);
    headers.forEach((h, idx) => {
      const cell = hRow.getCell(idx + 1);
      cell.value = h;
      cell.font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: COLORS.WHITE } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.TABLE_HEADER } };
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      cell.border = BORDERS.header;
    });
    hRow.height = 28;

    let itemRowNum = 5;
    let sumGstAmount = 0;
    let sumTotalWithTax = 0;
    let sumBatchQty = 0;

    data.items.forEach((item, itemIdx) => {
      const isTaxable = item.gstApplicable !== false;
      const gstPct = isTaxable ? (item.gstPercent !== undefined ? item.gstPercent : (item.gstPercentage !== undefined ? item.gstPercentage : 18)) : 0;
      const gstAmt = isTaxable ? (item.subtotal * gstPct) / 100 : 0;
      const totalWithTax = item.subtotal + gstAmt;
      sumGstAmount += gstAmt;
      sumTotalWithTax += totalWithTax;

      const hasBatches = Array.isArray(item.batches) && item.batches.length > 0;
      const batchesList = hasBatches ? item.batches : [{
        batchIndex: 1,
        batchNumber: '—',
        quantity: item.quantity,
        weight: '—',
        mfgBatchNo: '—',
        mfgDate: '—',
        expDate: '—'
      }];

      batchesList.forEach((b, bIdx) => {
        sumBatchQty += (parseFloat(b.quantity) || 0);
        const row = wsItems.getRow(itemRowNum);
        const isFirst = bIdx === 0;
        const zebraBg = itemIdx % 2 === 0 ? COLORS.WHITE : COLORS.ZEBRA_ROW;

        // 1: Index
        row.getCell(1).value = isFirst ? item.index : '';
        row.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };
        row.getCell(1).font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: COLORS.TEXT_MUTED } };

        // 2: Name
        row.getCell(2).value = isFirst ? item.name : `↳ (Batch #${b.batchIndex})`;
        row.getCell(2).alignment = { vertical: 'middle', horizontal: 'left', indent: isFirst ? 1 : 2 };
        row.getCell(2).font = { name: 'Segoe UI', size: 9, bold: isFirst, color: { argb: isFirst ? COLORS.TEXT_DARK : COLORS.ACCENT_VIBRANT } };

        // 3: Code
        row.getCell(3).value = isFirst ? item.code : '';
        row.getCell(3).alignment = { vertical: 'middle', horizontal: 'center' };
        row.getCell(3).font = { name: 'Segoe UI', size: 8.5, color: { argb: COLORS.TEXT_DARK } };

        // 4: Category
        row.getCell(4).value = isFirst ? item.category : '';
        row.getCell(4).alignment = { vertical: 'middle', horizontal: 'left' };
        row.getCell(4).font = { name: 'Segoe UI', size: 8.5, color: { argb: COLORS.TEXT_MUTED } };

        // 5: Subcategory
        row.getCell(5).value = isFirst ? item.subcategory : '';
        row.getCell(5).alignment = { vertical: 'middle', horizontal: 'left' };
        row.getCell(5).font = { name: 'Segoe UI', size: 8.5, color: { argb: COLORS.TEXT_MUTED } };

        // 6: Item Type
        row.getCell(6).value = isFirst ? item.itemType : '';
        row.getCell(6).alignment = { vertical: 'middle', horizontal: 'center' };
        row.getCell(6).font = { name: 'Segoe UI', size: 8.5, color: { argb: COLORS.TEXT_MUTED } };

        // 7: UOM
        row.getCell(7).value = isFirst ? item.uom.toUpperCase() : '';
        row.getCell(7).alignment = { vertical: 'middle', horizontal: 'center' };
        row.getCell(7).font = { name: 'Segoe UI', size: 8.5, bold: true, color: { argb: COLORS.TEXT_DARK } };

        // 8: Ordered Qty
        row.getCell(8).value = isFirst ? item.quantity : '';
        row.getCell(8).alignment = { vertical: 'middle', horizontal: 'right' };
        row.getCell(8).font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: COLORS.TEXT_DARK } };
        if (isFirst) row.getCell(8).numFmt = '#,##0.00';

        // 9: Rate
        row.getCell(9).value = isFirst ? item.unitPrice : '';
        row.getCell(9).alignment = { vertical: 'middle', horizontal: 'right' };
        row.getCell(9).font = { name: 'Segoe UI', size: 9, color: { argb: COLORS.TEXT_DARK } };
        if (isFirst) row.getCell(9).numFmt = '₹#,##0.00';

        // 10: Tax Status
        row.getCell(10).value = isFirst ? item.taxStatus : '';
        row.getCell(10).alignment = { vertical: 'middle', horizontal: 'center' };
        row.getCell(10).font = { name: 'Segoe UI', size: 8.5, color: { argb: COLORS.BLUE_TEXT } };
        if (isFirst) {
          row.getCell(10).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.BLUE_BG } };
        }

        // 11: GST %
        row.getCell(11).value = isFirst ? `${gstPct}%` : '';
        row.getCell(11).alignment = { vertical: 'middle', horizontal: 'center' };
        row.getCell(11).font = { name: 'Segoe UI', size: 8.5, color: { argb: COLORS.TEXT_DARK } };

        // 12: GST Amount
        row.getCell(12).value = isFirst ? gstAmt : '';
        row.getCell(12).alignment = { vertical: 'middle', horizontal: 'right' };
        row.getCell(12).font = { name: 'Segoe UI', size: 9, color: { argb: COLORS.TEXT_DARK } };
        if (isFirst) row.getCell(12).numFmt = '₹#,##0.00';

        // 13: Lab Status
        const isLabReq = item.labTestStatus === 'Lab Required';
        row.getCell(13).value = isFirst ? item.labTestStatus : '';
        row.getCell(13).alignment = { vertical: 'middle', horizontal: 'center' };
        row.getCell(13).font = { name: 'Segoe UI', size: 8.5, bold: true, color: { argb: isLabReq ? COLORS.GREEN_TEXT : COLORS.ROSE_TEXT } };
        if (isFirst) {
          row.getCell(13).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: isLabReq ? COLORS.GREEN_BG : COLORS.ROSE_BG } };
        }

        // 14: Subtotal
        row.getCell(14).value = isFirst ? item.subtotal : '';
        row.getCell(14).alignment = { vertical: 'middle', horizontal: 'right' };
        row.getCell(14).font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: COLORS.TEXT_DARK } };
        if (isFirst) row.getCell(14).numFmt = '₹#,##0.00';

        // 15: Total Incl Tax
        row.getCell(15).value = isFirst ? totalWithTax : '';
        row.getCell(15).alignment = { vertical: 'middle', horizontal: 'right' };
        row.getCell(15).font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: COLORS.TEXT_DARK } };
        if (isFirst) row.getCell(15).numFmt = '₹#,##0.00';

        // 16: Batch #
        row.getCell(16).value = `#${b.batchIndex}`;
        row.getCell(16).alignment = { vertical: 'middle', horizontal: 'center' };
        row.getCell(16).font = { name: 'Segoe UI', size: 8.5, bold: true, color: { argb: COLORS.ACCENT_VIBRANT } };
        row.getCell(16).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.BATCH_BG } };

        // 17: Internal Batch Number
        row.getCell(17).value = b.batchNumber || '—';
        row.getCell(17).alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
        row.getCell(17).font = { name: 'Segoe UI', size: 8.5, bold: true, color: { argb: COLORS.NAVY_PRIMARY } };
        row.getCell(17).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.BATCH_BG } };

        // 18: Batch Quantity
        row.getCell(18).value = parseFloat(b.quantity) || 0;
        row.getCell(18).alignment = { vertical: 'middle', horizontal: 'right' };
        row.getCell(18).font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: COLORS.TEXT_DARK } };
        row.getCell(18).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.BATCH_BG } };
        row.getCell(18).numFmt = '#,##0.00';

        // 19: Pack / Weight
        row.getCell(19).value = b.weight || '—';
        row.getCell(19).alignment = { vertical: 'middle', horizontal: 'center' };
        row.getCell(19).font = { name: 'Segoe UI', size: 8.5, color: { argb: COLORS.TEXT_DARK } };
        row.getCell(19).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.BATCH_BG } };

        // 20: Supplier MFG Batch No
        row.getCell(20).value = b.mfgBatchNo || '—';
        row.getCell(20).alignment = { vertical: 'middle', horizontal: 'center' };
        row.getCell(20).font = { name: 'Segoe UI', size: 8.5, color: { argb: COLORS.TEXT_DARK } };
        row.getCell(20).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.BATCH_BG } };

        // 21: MFG Date
        row.getCell(21).value = b.mfgDate || '—';
        row.getCell(21).alignment = { vertical: 'middle', horizontal: 'center' };
        row.getCell(21).font = { name: 'Segoe UI', size: 8.5, color: { argb: COLORS.TEXT_DARK } };
        row.getCell(21).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.BATCH_BG } };

        // 22: Exp Date
        row.getCell(22).value = b.expDate || '—';
        row.getCell(22).alignment = { vertical: 'middle', horizontal: 'center' };
        row.getCell(22).font = { name: 'Segoe UI', size: 8.5, color: { argb: COLORS.TEXT_DARK } };
        row.getCell(22).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.BATCH_BG } };

        // Apply borders and zebra fill
        row.eachCell({ includeEmpty: true }, (c, colNumber) => {
          c.border = BORDERS.thin;
          if (colNumber < 16 && colNumber !== 10 && colNumber !== 13) {
            c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: zebraBg } };
          }
        });
        row.height = 22;
        itemRowNum++;
      });
    });

    // ── GRAND TOTALS ROW ──
    const totRow = wsItems.getRow(itemRowNum);
    wsItems.mergeCells(`A${itemRowNum}:G${itemRowNum}`);
    const totLabel = totRow.getCell(1);
    totLabel.value = `TOTAL PROCUREMENT (${data.financials.totalItemsCount} Raw Materials):`;
    totLabel.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: COLORS.NAVY_PRIMARY } };
    totLabel.alignment = { vertical: 'middle', horizontal: 'right', indent: 1 };

    totRow.getCell(8).value = data.financials.totalQuantity;
    totRow.getCell(8).font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: COLORS.NAVY_PRIMARY } };
    totRow.getCell(8).alignment = { vertical: 'middle', horizontal: 'right' };
    totRow.getCell(8).numFmt = '#,##0.00';

    totRow.getCell(12).value = sumGstAmount;
    totRow.getCell(12).font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: COLORS.NAVY_PRIMARY } };
    totRow.getCell(12).alignment = { vertical: 'middle', horizontal: 'right' };
    totRow.getCell(12).numFmt = '₹#,##0.00';

    totRow.getCell(14).value = data.financials.subtotal;
    totRow.getCell(14).font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: COLORS.NAVY_PRIMARY } };
    totRow.getCell(14).alignment = { vertical: 'middle', horizontal: 'right' };
    totRow.getCell(14).numFmt = '₹#,##0.00';

    totRow.getCell(15).value = sumTotalWithTax;
    totRow.getCell(15).font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: COLORS.NAVY_PRIMARY } };
    totRow.getCell(15).alignment = { vertical: 'middle', horizontal: 'right' };
    totRow.getCell(15).numFmt = '₹#,##0.00';

    totRow.getCell(18).value = sumBatchQty;
    totRow.getCell(18).font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: COLORS.NAVY_PRIMARY } };
    totRow.getCell(18).alignment = { vertical: 'middle', horizontal: 'right' };
    totRow.getCell(18).numFmt = '#,##0.00';

    totRow.eachCell({ includeEmpty: true }, (c) => {
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.TOTALS_BG } };
      c.border = BORDERS.totals;
    });
    totRow.height = 25;

    // Column widths
    const colWidths = [
      6,   // 1. #
      32,  // 2. Name
      14,  // 3. Code
      18,  // 4. Category
      14,  // 5. Subcategory
      12,  // 6. Item Type
      8,   // 7. UOM
      14,  // 8. Ordered Qty
      14,  // 9. Rate
      14,  // 10. Tax Status
      8,   // 11. GST %
      15,  // 12. GST Amount
      15,  // 13. Lab Status
      16,  // 14. Subtotal
      18,  // 15. Total Incl Tax
      10,  // 16. Batch #
      24,  // 17. Batch No
      13,  // 18. Batch Qty
      16,  // 19. Pack Weight
      20,  // 20. MFG Batch
      13,  // 21. MFG Date
      13   // 22. Exp Date
    ];

    colWidths.forEach((w, idx) => {
      wsItems.getColumn(idx + 1).width = w;
    });

    // ── TRIGGER BROWSER DOWNLOAD ──
    const cleanRef = (data.referenceNo || 'PO').replace(/[^a-zA-Z0-9_-]/g, '_');
    const dateStamp = format(new Date(), 'yyyy-MM-dd_HHmm');
    const filename = `Purchase_Order_${cleanRef}_${dateStamp}.xlsx`;

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
      title: 'Excel Export Completed',
      html: `
        <div class="text-left text-xs space-y-1">
          <p>Purchase Order <strong>${data.referenceNo}</strong> exported successfully!</p>
          <p class="text-slate-500 font-mono text-[11px]">• File: <strong>${filename}</strong></p>
          <p class="text-slate-500 font-mono text-[11px]">• Raw Materials: <strong>${data.financials.totalItemsCount}</strong> items</p>
          <p class="text-slate-500 font-mono text-[11px]">• Total Quantity: <strong>${data.financials.totalQuantity}</strong></p>
          <p class="text-slate-500 font-mono text-[11px]">• Grand Total: <strong>₹${data.financials.grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></p>
        </div>
      `,
      timer: 3500,
      showConfirmButton: false,
      toast: true,
      position: 'top-end'
    });
  } catch (err) {
    console.error('Failed to export PO to Excel:', err);
    Swal.fire({
      icon: 'error',
      title: 'Export Failed',
      text: err.message || 'Could not export Purchase Order to Excel.'
    });
  }
}
