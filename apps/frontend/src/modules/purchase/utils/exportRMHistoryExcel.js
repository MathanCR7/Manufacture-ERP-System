import ExcelJS from 'exceljs';

/**
 * Helper to format date in Indian locale
 */
export const formatDateTime = (d) => {
  if (!d) return '—';
  try {
    const date = new Date(d);
    if (isNaN(date.getTime())) return String(d);
    return date.toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  } catch {
    return String(d);
  }
};

export const formatDateOnly = (d) => {
  if (!d) return '—';
  try {
    const date = new Date(d);
    if (isNaN(date.getTime())) return String(d);
    return date.toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  } catch {
    return String(d);
  }
};

/**
 * Styling Constants for ExcelJS
 */
const COLORS = {
  NAVY_HEADER: 'FF1E293B',     // Deep Slate Navy #1E293B
  INDIGO_BANNER: 'FF312E81',   // Deep Indigo #312E81
  SECTION_ACCENT: 'FF4338CA',  // Vibrant Indigo #4338CA
  TEAL_ACCENT: 'FF0F766E',     // Deep Teal #0F766E
  TABLE_HEADER: 'FF1E293B',    // Dark Slate Header
  ZEBRA_EVEN: 'FFFFFFFF',      // White
  ZEBRA_ODD: 'FFF8FAFC',       // Light Slate #F8FAFC
  TOTALS_BG: 'FFE2E8F0',       // Slate 200 #E2E8F0
  KPI_BG: 'FFF1F5F9',          // Slate 100 #F1F5F9
  KPI_BORDER: 'FFCBD5E1',      // Slate 300 #CBD5E1
  BORDER_COLOR: 'FFE2E8F0',    // Light Border #E2E8F0
  WHITE: 'FFFFFFFF',
  TEXT_MAIN: 'FF0F172A',       // Slate 900
  TEXT_MUTED: 'FF64748B',      // Slate 500
  GREEN_TEXT: 'FF15803D',      // Emerald 700
  RED_TEXT: 'FFB91C1C',        // Rose 700
  AMBER_TEXT: 'FFB45309'       // Amber 700
};

const BORDERS = {
  thin: {
    top: { style: 'thin', color: { argb: COLORS.BORDER_COLOR } },
    left: { style: 'thin', color: { argb: COLORS.BORDER_COLOR } },
    bottom: { style: 'thin', color: { argb: COLORS.BORDER_COLOR } },
    right: { style: 'thin', color: { argb: COLORS.BORDER_COLOR } }
  },
  totals: {
    top: { style: 'thin', color: { argb: 'FF94A3B8' } },
    bottom: { style: 'double', color: { argb: 'FF475569' } },
    left: { style: 'thin', color: { argb: COLORS.BORDER_COLOR } },
    right: { style: 'thin', color: { argb: COLORS.BORDER_COLOR } }
  }
};

/**
 * Apply auto-fit column widths with minimum & maximum boundaries
 */
function autoFitColumns(worksheet, minWidth = 12, maxWidth = 45) {
  worksheet.columns.forEach((column) => {
    let maxLen = 0;
    column.eachCell({ includeEmpty: false }, (cell) => {
      const val = cell.value;
      if (val != null) {
        // Skip merged title row or very long banner strings from blowing up column width
        if (cell.row <= 3) return;
        const str = typeof val === 'object' && val.text ? val.text : String(val);
        maxLen = Math.max(maxLen, str.length);
      }
    });
    column.width = Math.max(minWidth, Math.min(maxWidth, maxLen + 4));
  });
}

/**
 * Add a standardized professional title banner to a worksheet
 */
function addTitleBanner(ws, title, subtitle, material) {
  // Title Row
  ws.mergeCells('A1:J1');
  const titleCell = ws.getCell('A1');
  titleCell.value = title;
  titleCell.font = { name: 'Segoe UI', size: 14, bold: true, color: { argb: COLORS.WHITE } };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.NAVY_HEADER } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  ws.getRow(1).height = 30;

  // Subtitle Row
  ws.mergeCells('A2:J2');
  const subCell = ws.getCell('A2');
  const matInfo = material ? `Material: ${material.name} (${material.code || 'N/A'}) | Category: ${material.category || 'N/A'} | UOM: ${material.unit || 'N/A'}` : '';
  subCell.value = `${subtitle} • ${matInfo} • Generated: ${new Date().toLocaleString('en-IN')}`;
  subCell.font = { name: 'Segoe UI', size: 9.5, italic: true, color: { argb: 'FFE0E7FF' } };
  subCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.INDIGO_BANNER } };
  subCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  ws.getRow(2).height = 22;

  // Empty spacing row
  ws.getRow(3).height = 10;
}

/**
 * Style header cells for a table
 */
function styleHeaderRow(row) {
  row.height = 26;
  row.eachCell((cell) => {
    cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: COLORS.WHITE } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.TABLE_HEADER } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: false };
    cell.border = BORDERS.thin;
  });
}

/**
 * Main export function for Raw Material Lifecycle History & Ledger
 */
export async function exportRMHistoryToExcel(historyData) {
  if (!historyData || !historyData.material) {
    throw new Error('No raw material data provided for export.');
  }

  const {
    material,
    summary = {},
    timeline = [],
    purchases = [],
    grnReceipts = [],
    batches = [],
    labReports = [],
    stockAdjustments = [],
    wasteRecords = [],
    productionUsages = [],
    purchaseReturns = []
  } = historyData;

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Manufacturing ERP System';
  workbook.lastModifiedBy = 'ERP User';
  workbook.created = new Date();
  workbook.modified = new Date();

  // ══════════════════════════════════════════════════════════════════════════
  // SHEET 1: SUMMARY & MASTER LEDGER
  // ══════════════════════════════════════════════════════════════════════════
  const wsLedger = workbook.addWorksheet('Summary & Master Ledger', {
    views: [{ showGridLines: true }]
  });

  addTitleBanner(
    wsLedger,
    'RAW MATERIAL LIFECYCLE AUDIT & STOCK MOVEMENT LEDGER',
    'Comprehensive Audit Trail, Progressive Stock Balances & Lifecycle Events',
    material
  );

  // SECTION A: MATERIAL SPECIFICATIONS
  let currentRow = 4;
  wsLedger.mergeCells(`A${currentRow}:J${currentRow}`);
  const secASpec = wsLedger.getCell(`A${currentRow}`);
  secASpec.value = '1. MATERIAL MASTER SPECIFICATIONS';
  secASpec.font = { name: 'Segoe UI', size: 11, bold: true, color: { argb: COLORS.WHITE } };
  secASpec.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.SECTION_ACCENT } };
  secASpec.alignment = { vertical: 'middle', indent: 1 };
  wsLedger.getRow(currentRow).height = 24;
  currentRow++;

  const specRows = [
    [
      { label: 'Material Name', val: material.name, isBold: true },
      { label: 'Standard Rate / Unit', val: `₹${Number(material.ratePerUnit || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, isBold: true }
    ],
    [
      { label: 'Material Code', val: material.code || 'N/A', isBold: true },
      { label: 'Current Available Stock', val: `${Number(material.currentStock || 0).toLocaleString()} ${material.unit}`, isBold: true, highlightGreen: true }
    ],
    [
      { label: 'Category', val: material.category || 'General', isBold: false },
      { label: 'Current Stock Valuation', val: `₹${Number(material.stockValue || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, isBold: true }
    ],
    [
      { label: 'Unit of Measure (UOM)', val: material.unit || 'N/A', isBold: false },
      { label: 'Reorder / Alert Threshold', val: `${Number(material.alertLevel || 0).toLocaleString()} ${material.unit}`, isBold: false }
    ],
    [
      { label: 'Stock Health Status', val: material.stockHealth || 'OPTIMAL', isBold: true },
      { label: 'Report Generated At', val: new Date().toLocaleString('en-IN'), isBold: false }
    ]
  ];

  specRows.forEach(([left, right]) => {
    // Left Box (Cols A-B label, C-D val)
    wsLedger.mergeCells(`A${currentRow}:B${currentRow}`);
    wsLedger.mergeCells(`C${currentRow}:E${currentRow}`);
    const lLabel = wsLedger.getCell(`A${currentRow}`);
    const lVal = wsLedger.getCell(`C${currentRow}`);
    lLabel.value = left.label;
    lLabel.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: COLORS.TEXT_MUTED } };
    lLabel.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.KPI_BG } };
    lLabel.border = BORDERS.thin;
    lLabel.alignment = { vertical: 'middle', indent: 1 };

    lVal.value = left.val;
    lVal.font = { name: 'Segoe UI', size: 10, bold: left.isBold, color: { argb: COLORS.TEXT_MAIN } };
    lVal.border = BORDERS.thin;
    lVal.alignment = { vertical: 'middle', indent: 1 };

    // Right Box (Cols F-G label, H-J val)
    wsLedger.mergeCells(`F${currentRow}:G${currentRow}`);
    wsLedger.mergeCells(`H${currentRow}:J${currentRow}`);
    const rLabel = wsLedger.getCell(`F${currentRow}`);
    const rVal = wsLedger.getCell(`H${currentRow}`);
    rLabel.value = right.label;
    rLabel.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: COLORS.TEXT_MUTED } };
    rLabel.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.KPI_BG } };
    rLabel.border = BORDERS.thin;
    rLabel.alignment = { vertical: 'middle', indent: 1 };

    rVal.value = right.val;
    rVal.font = { 
      name: 'Segoe UI', 
      size: 10, 
      bold: right.isBold, 
      color: { argb: right.highlightGreen ? COLORS.GREEN_TEXT : COLORS.TEXT_MAIN } 
    };
    rVal.border = BORDERS.thin;
    rVal.alignment = { vertical: 'middle', indent: 1 };

    wsLedger.getRow(currentRow).height = 20;
    currentRow++;
  });

  // Empty Row
  currentRow++;

  // SECTION B: LIFECYCLE SUMMARY METRICS GRID
  wsLedger.mergeCells(`A${currentRow}:J${currentRow}`);
  const secBMetrics = wsLedger.getCell(`A${currentRow}`);
  secBMetrics.value = '2. LIFECYCLE SUMMARY AUDIT METRICS';
  secBMetrics.font = { name: 'Segoe UI', size: 11, bold: true, color: { argb: COLORS.WHITE } };
  secBMetrics.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.SECTION_ACCENT } };
  secBMetrics.alignment = { vertical: 'middle', indent: 1 };
  wsLedger.getRow(currentRow).height = 24;
  currentRow++;

  // KPI Table Headers
  const kpiHeaders = [
    { label: 'Total Purchased Qty', val: `${Number(summary.totalPurchasedQty || 0).toLocaleString()} ${material.unit}`, sub: `Val: ₹${Number(summary.totalPurchasedValue || 0).toLocaleString('en-IN')}` },
    { label: 'Total Inwarded (GRN)', val: `${Number(summary.totalInwardedQty || 0).toLocaleString()} ${material.unit}`, sub: `${grnReceipts.length} Receipts` },
    { label: 'Consumed in Production', val: `${Number(summary.totalConsumedQty || 0).toLocaleString()} ${material.unit}`, sub: `Cost: ₹${Number(summary.totalConsumedCost || 0).toLocaleString('en-IN')}` },
    { label: 'Stock Adjustments', val: `${summary.netAdjustedQty > 0 ? `+${summary.netAdjustedQty}` : (summary.netAdjustedQty || 0)} ${material.unit}`, sub: `+${summary.totalAdjustmentAddition || 0} / -${summary.totalAdjustmentSubtraction || 0}` },
    { label: 'Wasted Quantity', val: `${Number(summary.totalWastedQty || 0).toLocaleString()} ${material.unit}`, sub: `Loss: ₹${Number(summary.totalWastedLoss || 0).toLocaleString('en-IN')}` }
  ];

  // We place 5 KPI cards in rows:
  const kpiRow1 = currentRow;
  const kpiRow2 = currentRow + 1;
  const kpiRow3 = currentRow + 2;

  kpiHeaders.forEach((kpi, idx) => {
    const startCol = idx * 2 + 1; // 1, 3, 5, 7, 9
    const endCol = startCol + 1;   // 2, 4, 6, 8, 10
    const colLetter1 = String.fromCharCode(64 + startCol);
    const colLetter2 = String.fromCharCode(64 + endCol);

    // Label
    wsLedger.mergeCells(`${colLetter1}${kpiRow1}:${colLetter2}${kpiRow1}`);
    const c1 = wsLedger.getCell(`${colLetter1}${kpiRow1}`);
    c1.value = kpi.label.toUpperCase();
    c1.font = { name: 'Segoe UI', size: 8, bold: true, color: { argb: COLORS.TEXT_MUTED } };
    c1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.KPI_BG } };
    c1.alignment = { vertical: 'middle', horizontal: 'center' };
    c1.border = BORDERS.thin;

    // Value
    wsLedger.mergeCells(`${colLetter1}${kpiRow2}:${colLetter2}${kpiRow2}`);
    const c2 = wsLedger.getCell(`${colLetter1}${kpiRow2}`);
    c2.value = kpi.val;
    c2.font = { name: 'Segoe UI', size: 12, bold: true, color: { argb: COLORS.NAVY_HEADER } };
    c2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.KPI_BG } };
    c2.alignment = { vertical: 'middle', horizontal: 'center' };
    c2.border = BORDERS.thin;

    // Subtitle / Cost
    wsLedger.mergeCells(`${colLetter1}${kpiRow3}:${colLetter2}${kpiRow3}`);
    const c3 = wsLedger.getCell(`${colLetter1}${kpiRow3}`);
    c3.value = kpi.sub;
    c3.font = { name: 'Segoe UI', size: 8.5, italic: true, color: { argb: COLORS.TEXT_MUTED } };
    c3.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.KPI_BG } };
    c3.alignment = { vertical: 'middle', horizontal: 'center' };
    c3.border = BORDERS.thin;
  });

  wsLedger.getRow(kpiRow1).height = 18;
  wsLedger.getRow(kpiRow2).height = 24;
  wsLedger.getRow(kpiRow3).height = 18;

  currentRow += 4;

  // SECTION C: COMPLETE STOCK MOVEMENT LEDGER (CHRONOLOGICAL)
  wsLedger.mergeCells(`A${currentRow}:K${currentRow}`);
  const secCLedger = wsLedger.getCell(`A${currentRow}`);
  secCLedger.value = `3. CHRONOLOGICAL STOCK MOVEMENT LEDGER & AUDIT TRAIL (${timeline.length} LIFECYCLE EVENTS)`;
  secCLedger.font = { name: 'Segoe UI', size: 11, bold: true, color: { argb: COLORS.WHITE } };
  secCLedger.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.TEAL_ACCENT } };
  secCLedger.alignment = { vertical: 'middle', indent: 1 };
  wsLedger.getRow(currentRow).height = 24;
  currentRow++;

  // Columns for the unified ledger
  const ledgerColumns = [
    { header: 'No.', key: 'sno', width: 8 },
    { header: 'Date & Time', key: 'dateTime', width: 22 },
    { header: 'Event Type', key: 'type', width: 20 },
    { header: 'Reference / ID', key: 'ref', width: 20 },
    { header: 'Particulars / Description', key: 'desc', width: 38 },
    { header: 'Inward (+)', key: 'inward', width: 14 },
    { header: 'Outward (-)', key: 'outward', width: 14 },
    { header: 'Running Stock', key: 'balance', width: 16 },
    { header: 'UOM', key: 'uom', width: 8 },
    { header: 'Done By / Logged By', key: 'doneBy', width: 22 },
    { header: 'Status / QC Decision', key: 'status', width: 18 }
  ];

  const headerRow = wsLedger.getRow(currentRow);
  ledgerColumns.forEach((col, idx) => {
    const cell = headerRow.getCell(idx + 1);
    cell.value = col.header;
  });
  styleHeaderRow(headerRow);
  currentRow++;

  // To build accurate running balance, sort chronological ascending (oldest first),
  // compute running balance, then present in report (or descending with calculated balances).
  // Let's compute running balance chronologically!
  const chronologicalEvents = [...timeline].sort(
    (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
  );

  let runningBalance = 0;
  let totalInward = 0;
  let totalOutward = 0;

  const computedLedgerRows = chronologicalEvents.map((event, idx) => {
    let inward = 0;
    let outward = 0;
    let ref = event.metadata?.referenceNo || event.metadata?.batchNumber || '—';
    let particulars = event.subtitle || event.title;

    switch (event.type) {
      case 'GRN_RECEIVE':
        // GRN inward increases physical stock
        inward = Number(event.metadata?.receivedQty || event.metadata?.actualReceivedQty || 0);
        if (!inward && grnReceipts.length > 0) {
          const matchedGRN = grnReceipts.find(g => (g.grnId && g.grnId === event.metadata?.grnId) || g.referenceNo === event.metadata?.referenceNo);
          inward = Number(matchedGRN?.actualReceivedQty || 0);
        }
        break;
      case 'INVENTORY_BATCH':
        // Inventory batch confirmation
        ref = event.metadata?.batchNumber || ref;
        break;
      case 'PRODUCTION_USAGE':
        // Consumed in production batch decreases stock
        outward = Number(event.metadata?.actualUsedQty || 0);
        if (!outward && productionUsages.length > 0) {
          const matchedUsage = productionUsages.find(u => (u.batchId && u.batchId === event.metadata?.batchId) || u.batchNumber === event.metadata?.batchNumber);
          outward = Number(matchedUsage?.actualUsedQty || 0);
        }
        break;
      case 'STOCK_ADJUSTMENT':
        if (event.status === 'ADDITION' || event.title?.includes('Addition')) {
          inward = Number(event.metadata?.quantity || 0);
          if (!inward && stockAdjustments.length > 0) {
            const matchedAdj = stockAdjustments.find(a => event.title?.includes(String(a.quantity)));
            inward = Number(matchedAdj?.quantity || 0);
          }
        } else {
          outward = Number(event.metadata?.quantity || 0);
          if (!outward && stockAdjustments.length > 0) {
            const matchedAdj = stockAdjustments.find(a => event.title?.includes(String(a.quantity)));
            outward = Number(matchedAdj?.quantity || 0);
          }
        }
        break;
      case 'RM_WASTE':
        outward = Number(event.metadata?.quantity || 0);
        if (!outward && wasteRecords.length > 0) {
          const matchedWaste = wasteRecords.find(w => w.referenceNo === event.metadata?.referenceNo);
          outward = Number(matchedWaste?.quantity || 0);
        }
        break;
      case 'PURCHASE_RETURN':
        outward = Number(event.metadata?.returnQty || 0);
        if (!outward && purchaseReturns.length > 0) {
          const matchedRet = purchaseReturns.find(r => r.referenceNo === event.metadata?.referenceNo);
          outward = Number(matchedRet?.returnQty || 0);
        }
        break;
      case 'PURCHASE_ORDER':
        ref = event.metadata?.referenceNo || ref;
        break;
      default:
        break;
    }

    runningBalance += (inward - outward);
    totalInward += inward;
    totalOutward += outward;

    return {
      timestamp: event.timestamp,
      type: event.type.replace(/_/g, ' '),
      ref,
      particulars,
      inward: inward > 0 ? inward : null,
      outward: outward > 0 ? outward : null,
      balance: runningBalance,
      uom: material.unit,
      doneBy: event.user || 'System',
      status: event.status || 'LOGGED'
    };
  });

  // Display ledger rows (1-indexed running number)
  if (computedLedgerRows.length === 0) {
    const emptyRow = wsLedger.getRow(currentRow);
    wsLedger.mergeCells(`A${currentRow}:K${currentRow}`);
    const eCell = emptyRow.getCell(1);
    eCell.value = 'No historical stock transactions recorded for this raw material.';
    eCell.font = { name: 'Segoe UI', size: 10, italic: true, color: { argb: COLORS.TEXT_MUTED } };
    eCell.alignment = { vertical: 'middle', horizontal: 'center' };
    emptyRow.height = 26;
    currentRow++;
  } else {
    computedLedgerRows.forEach((item, index) => {
      const row = wsLedger.getRow(currentRow);
      row.height = 20;
      const isEven = index % 2 === 0;
      const rowBg = isEven ? COLORS.ZEBRA_EVEN : COLORS.ZEBRA_ODD;

      // Col 1: S.No (Running number)
      const cNo = row.getCell(1);
      cNo.value = index + 1;
      cNo.alignment = { vertical: 'middle', horizontal: 'center' };

      // Col 2: Date & Time
      const cDate = row.getCell(2);
      cDate.value = formatDateTime(item.timestamp);
      cDate.alignment = { vertical: 'middle', horizontal: 'center' };

      // Col 3: Event Type
      const cType = row.getCell(3);
      cType.value = item.type;
      cType.alignment = { vertical: 'middle', indent: 1 };
      cType.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: COLORS.TEXT_MAIN } };

      // Col 4: Reference / ID
      const cRef = row.getCell(4);
      cRef.value = item.ref;
      cRef.alignment = { vertical: 'middle', horizontal: 'center' };
      cRef.font = { name: 'Consolas', size: 9, bold: true };

      // Col 5: Particulars / Description
      const cDesc = row.getCell(5);
      cDesc.value = item.particulars;
      cDesc.alignment = { vertical: 'middle', indent: 1 };

      // Col 6: Inward (+)
      const cIn = row.getCell(6);
      cIn.value = item.inward != null ? item.inward : '';
      cIn.numFmt = '#,##0.00';
      cIn.alignment = { vertical: 'middle', horizontal: 'right' };
      if (item.inward != null) {
        cIn.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: COLORS.GREEN_TEXT } };
      }

      // Col 7: Outward (-)
      const cOut = row.getCell(7);
      cOut.value = item.outward != null ? item.outward : '';
      cOut.numFmt = '#,##0.00';
      cOut.alignment = { vertical: 'middle', horizontal: 'right' };
      if (item.outward != null) {
        cOut.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: COLORS.RED_TEXT } };
      }

      // Col 8: Progressive Running Balance
      const cBal = row.getCell(8);
      cBal.value = item.balance;
      cBal.numFmt = '#,##0.00';
      cBal.alignment = { vertical: 'middle', horizontal: 'right' };
      cBal.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: COLORS.NAVY_HEADER } };

      // Col 9: UOM
      const cUom = row.getCell(9);
      cUom.value = item.uom;
      cUom.alignment = { vertical: 'middle', horizontal: 'center' };

      // Col 10: Done By / Logged By
      const cDone = row.getCell(10);
      cDone.value = item.doneBy;
      cDone.alignment = { vertical: 'middle', indent: 1 };

      // Col 11: Status
      const cStatus = row.getCell(11);
      cStatus.value = item.status;
      cStatus.alignment = { vertical: 'middle', horizontal: 'center' };

      // Apply border & zebra fill
      row.eachCell({ includeEmpty: true }, (c) => {
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBg } };
        c.border = BORDERS.thin;
      });

      currentRow++;
    });

    // TOTALS ROW
    const totRow = wsLedger.getRow(currentRow);
    totRow.height = 24;

    wsLedger.mergeCells(`A${currentRow}:E${currentRow}`);
    const totLabel = totRow.getCell(1);
    totLabel.value = 'TOTAL LIFECYCLE MOVEMENTS & CLOSING PHYSICAL STOCK';
    totLabel.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: COLORS.NAVY_HEADER } };
    totLabel.alignment = { vertical: 'middle', horizontal: 'right', indent: 1 };

    const totInCell = totRow.getCell(6);
    totInCell.value = totalInward;
    totInCell.numFmt = '#,##0.00';
    totInCell.font = { name: 'Segoe UI', size: 10.5, bold: true, color: { argb: COLORS.GREEN_TEXT } };
    totInCell.alignment = { vertical: 'middle', horizontal: 'right' };

    const totOutCell = totRow.getCell(7);
    totOutCell.value = totalOutward;
    totOutCell.numFmt = '#,##0.00';
    totOutCell.font = { name: 'Segoe UI', size: 10.5, bold: true, color: { argb: COLORS.RED_TEXT } };
    totOutCell.alignment = { vertical: 'middle', horizontal: 'right' };

    const totBalCell = totRow.getCell(8);
    totBalCell.value = Number(material.currentStock || 0);
    totBalCell.numFmt = '#,##0.00';
    totBalCell.font = { name: 'Segoe UI', size: 11, bold: true, color: { argb: COLORS.NAVY_HEADER } };
    totBalCell.alignment = { vertical: 'middle', horizontal: 'right' };

    const totUomCell = totRow.getCell(9);
    totUomCell.value = material.unit;
    totUomCell.font = { name: 'Segoe UI', size: 9.5, bold: true };
    totUomCell.alignment = { vertical: 'middle', horizontal: 'center' };

    totRow.getCell(10).value = 'CLOSING AUDITED';
    totRow.getCell(10).font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: COLORS.TEXT_MUTED } };
    totRow.getCell(10).alignment = { vertical: 'middle', horizontal: 'center' };

    totRow.getCell(11).value = material.stockHealth;
    totRow.getCell(11).font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: COLORS.GREEN_TEXT } };
    totRow.getCell(11).alignment = { vertical: 'middle', horizontal: 'center' };

    totRow.eachCell({ includeEmpty: true }, (c) => {
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.TOTALS_BG } };
      c.border = BORDERS.totals;
    });

    currentRow++;
  }

  autoFitColumns(wsLedger, 10, 42);


  // ══════════════════════════════════════════════════════════════════════════
  // SHEET 2: PURCHASES (POs)
  // ══════════════════════════════════════════════════════════════════════════
  const wsPO = workbook.addWorksheet('Purchases (POs)', { views: [{ showGridLines: true }] });
  addTitleBanner(wsPO, 'PURCHASE ORDERS (PO) HISTORY', 'Complete Procurement Trail & Vendor Pricing', material);

  const poCols = [
    { header: 'No.', width: 8 },
    { header: 'PO Reference No', width: 18 },
    { header: 'Order Date', width: 15 },
    { header: 'Expected Delivery', width: 16 },
    { header: 'Supplier Name', width: 26 },
    { header: 'Supplier Contact', width: 18 },
    { header: 'Ordered Qty', width: 14 },
    { header: 'UOM', width: 8 },
    { header: 'Base Rate (₹)', width: 14 },
    { header: 'GST %', width: 10 },
    { header: 'Rate Incl. GST (₹)', width: 16 },
    { header: 'Item Total (₹)', width: 16 },
    { header: 'PO Grand Total (₹)', width: 18 },
    { header: 'PO Status', width: 14 },
    { header: 'Payment Status', width: 16 },
    { header: 'Paid Amount (₹)', width: 16 },
    { header: 'Balance Due (₹)', width: 16 },
    { header: 'Done By (Created By)', width: 20 },
    { header: 'GRN Count', width: 12 }
  ];

  let poRowIdx = 4;
  const poHeader = wsPO.getRow(poRowIdx);
  poCols.forEach((col, idx) => {
    poHeader.getCell(idx + 1).value = col.header;
  });
  styleHeaderRow(poHeader);
  poRowIdx++;

  let sumPOQty = 0;
  let sumPOItemTotal = 0;
  let sumPOGrandTotal = 0;
  let sumPOPaid = 0;
  let sumPOBalance = 0;

  if (purchases.length === 0) {
    const emptyRow = wsPO.getRow(poRowIdx);
    wsPO.mergeCells(`A${poRowIdx}:S${poRowIdx}`);
    const eCell = emptyRow.getCell(1);
    eCell.value = 'No purchase orders recorded for this raw material.';
    eCell.font = { name: 'Segoe UI', size: 10, italic: true, color: { argb: COLORS.TEXT_MUTED } };
    eCell.alignment = { vertical: 'middle', horizontal: 'center' };
    emptyRow.height = 26;
  } else {
    purchases.forEach((po, idx) => {
      const row = wsPO.getRow(poRowIdx);
      row.height = 20;
      const isEven = idx % 2 === 0;
      const rowBg = isEven ? COLORS.ZEBRA_EVEN : COLORS.ZEBRA_ODD;

      const orderedQty = Number(po.orderedQty || 0);
      const itemTotal = Number(po.itemTotal || 0);
      const grandTotal = Number(po.grandTotal || 0);
      const paidAmount = Number(po.paidAmount || 0);
      const balanceDue = Math.max(0, grandTotal - paidAmount);

      sumPOQty += orderedQty;
      sumPOItemTotal += itemTotal;
      sumPOGrandTotal += grandTotal;
      sumPOPaid += paidAmount;
      sumPOBalance += balanceDue;

      row.getCell(1).value = idx + 1;
      row.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };

      row.getCell(2).value = po.referenceNo;
      row.getCell(2).font = { name: 'Consolas', size: 9.5, bold: true };
      row.getCell(2).alignment = { vertical: 'middle', horizontal: 'center' };

      row.getCell(3).value = formatDateOnly(po.orderDate);
      row.getCell(3).alignment = { vertical: 'middle', horizontal: 'center' };

      row.getCell(4).value = formatDateOnly(po.expectedDelivery);
      row.getCell(4).alignment = { vertical: 'middle', horizontal: 'center' };

      row.getCell(5).value = po.supplierName;
      row.getCell(5).font = { name: 'Segoe UI', size: 9.5, bold: true };
      row.getCell(5).alignment = { vertical: 'middle', indent: 1 };

      row.getCell(6).value = po.supplierContact || '—';
      row.getCell(6).alignment = { vertical: 'middle', indent: 1 };

      row.getCell(7).value = orderedQty;
      row.getCell(7).numFmt = '#,##0.00';
      row.getCell(7).font = { name: 'Segoe UI', size: 9.5, bold: true };
      row.getCell(7).alignment = { vertical: 'middle', horizontal: 'right' };

      row.getCell(8).value = po.uom || material.unit;
      row.getCell(8).alignment = { vertical: 'middle', horizontal: 'center' };

      row.getCell(9).value = Number(po.unitPrice || 0);
      row.getCell(9).numFmt = '₹#,##0.00';
      row.getCell(9).alignment = { vertical: 'middle', horizontal: 'right' };

      row.getCell(10).value = `${po.gstPercentage || 0}%`;
      row.getCell(10).alignment = { vertical: 'middle', horizontal: 'center' };

      row.getCell(11).value = Number(po.unitPriceWithGst || po.unitPrice || 0);
      row.getCell(11).numFmt = '₹#,##0.00';
      row.getCell(11).alignment = { vertical: 'middle', horizontal: 'right' };

      row.getCell(12).value = itemTotal;
      row.getCell(12).numFmt = '₹#,##0.00';
      row.getCell(12).font = { name: 'Segoe UI', size: 9.5, bold: true };
      row.getCell(12).alignment = { vertical: 'middle', horizontal: 'right' };

      row.getCell(13).value = grandTotal;
      row.getCell(13).numFmt = '₹#,##0.00';
      row.getCell(13).alignment = { vertical: 'middle', horizontal: 'right' };

      row.getCell(14).value = po.status;
      row.getCell(14).alignment = { vertical: 'middle', horizontal: 'center' };

      row.getCell(15).value = po.paymentStatus;
      row.getCell(15).alignment = { vertical: 'middle', horizontal: 'center' };

      row.getCell(16).value = paidAmount;
      row.getCell(16).numFmt = '₹#,##0.00';
      row.getCell(16).alignment = { vertical: 'middle', horizontal: 'right' };

      row.getCell(17).value = balanceDue;
      row.getCell(17).numFmt = '₹#,##0.00';
      row.getCell(17).alignment = { vertical: 'middle', horizontal: 'right' };

      row.getCell(18).value = po.createdBy || 'Staff';
      row.getCell(18).alignment = { vertical: 'middle', indent: 1 };

      row.getCell(19).value = po.grnCount || 0;
      row.getCell(19).alignment = { vertical: 'middle', horizontal: 'center' };

      row.eachCell({ includeEmpty: true }, (c) => {
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBg } };
        c.border = BORDERS.thin;
      });

      poRowIdx++;
    });

    // PO TOTALS ROW
    const poTotRow = wsPO.getRow(poRowIdx);
    poTotRow.height = 24;

    wsPO.mergeCells(`A${poRowIdx}:F${poRowIdx}`);
    poTotRow.getCell(1).value = `TOTALS (${purchases.length} PURCHASE ORDERS)`;
    poTotRow.getCell(1).font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: COLORS.NAVY_HEADER } };
    poTotRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'right', indent: 1 };

    poTotRow.getCell(7).value = sumPOQty;
    poTotRow.getCell(7).numFmt = '#,##0.00';
    poTotRow.getCell(7).font = { name: 'Segoe UI', size: 10.5, bold: true, color: { argb: COLORS.NAVY_HEADER } };
    poTotRow.getCell(7).alignment = { vertical: 'middle', horizontal: 'right' };

    poTotRow.getCell(8).value = material.unit;
    poTotRow.getCell(8).font = { name: 'Segoe UI', size: 9.5, bold: true };
    poTotRow.getCell(8).alignment = { vertical: 'middle', horizontal: 'center' };

    poTotRow.getCell(12).value = sumPOItemTotal;
    poTotRow.getCell(12).numFmt = '₹#,##0.00';
    poTotRow.getCell(12).font = { name: 'Segoe UI', size: 10.5, bold: true, color: { argb: COLORS.NAVY_HEADER } };
    poTotRow.getCell(12).alignment = { vertical: 'middle', horizontal: 'right' };

    poTotRow.getCell(13).value = sumPOGrandTotal;
    poTotRow.getCell(13).numFmt = '₹#,##0.00';
    poTotRow.getCell(13).font = { name: 'Segoe UI', size: 10.5, bold: true, color: { argb: COLORS.NAVY_HEADER } };
    poTotRow.getCell(13).alignment = { vertical: 'middle', horizontal: 'right' };

    poTotRow.getCell(16).value = sumPOPaid;
    poTotRow.getCell(16).numFmt = '₹#,##0.00';
    poTotRow.getCell(16).font = { name: 'Segoe UI', size: 10, bold: true };
    poTotRow.getCell(16).alignment = { vertical: 'middle', horizontal: 'right' };

    poTotRow.getCell(17).value = sumPOBalance;
    poTotRow.getCell(17).numFmt = '₹#,##0.00';
    poTotRow.getCell(17).font = { name: 'Segoe UI', size: 10, bold: true };
    poTotRow.getCell(17).alignment = { vertical: 'middle', horizontal: 'right' };

    poTotRow.eachCell({ includeEmpty: true }, (c) => {
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.TOTALS_BG } };
      c.border = BORDERS.totals;
    });
  }

  autoFitColumns(wsPO, 10, 40);


  // ══════════════════════════════════════════════════════════════════════════
  // SHEET 3: GRN & INWARD RECEIPTS
  // ══════════════════════════════════════════════════════════════════════════
  const wsGRN = workbook.addWorksheet('GRN & Inward Receipts', { views: [{ showGridLines: true }] });
  addTitleBanner(wsGRN, 'GOODS RECEIPT NOTE (GRN) & GATE INWARD AUDIT', 'Factory Gate Inward, Delivery Notes & Inspection Linkage', material);

  const grnCols = [
    { header: 'No.', width: 8 },
    { header: 'GRN Reference No', width: 18 },
    { header: 'Received Date & Time', width: 22 },
    { header: 'Linked PO Ref', width: 18 },
    { header: 'Supplier Name', width: 26 },
    { header: 'Expected Qty', width: 14 },
    { header: 'Actual Received Qty', width: 16 },
    { header: 'UOM', width: 8 },
    { header: 'Short Delivery?', width: 14 },
    { header: 'Challan Number', width: 16 },
    { header: 'Invoice Number', width: 16 },
    { header: 'Invoice Date', width: 14 },
    { header: 'Vehicle Number', width: 16 },
    { header: 'Driver Name', width: 18 },
    { header: 'Generated Batch No', width: 22 },
    { header: 'Storage Location', width: 20 },
    { header: 'Batch Net Qty', width: 14 },
    { header: 'Batch Expiry Date', width: 16 },
    { header: 'Gate Receiver (Done By)', width: 22 },
    { header: 'Gate Entry Status', width: 16 },
    { header: 'Inventory Uploaded', width: 16 }
  ];

  let grnRowIdx = 4;
  const grnHeader = wsGRN.getRow(grnRowIdx);
  grnCols.forEach((col, idx) => {
    grnHeader.getCell(idx + 1).value = col.header;
  });
  styleHeaderRow(grnHeader);
  grnRowIdx++;

  let sumGRNExpected = 0;
  let sumGRNReceived = 0;
  let sumGRNBatchNet = 0;

  if (grnReceipts.length === 0) {
    const emptyRow = wsGRN.getRow(grnRowIdx);
    wsGRN.mergeCells(`A${grnRowIdx}:U${grnRowIdx}`);
    const eCell = emptyRow.getCell(1);
    eCell.value = 'No GRN gate inward receipts found for this raw material.';
    eCell.font = { name: 'Segoe UI', size: 10, italic: true, color: { argb: COLORS.TEXT_MUTED } };
    eCell.alignment = { vertical: 'middle', horizontal: 'center' };
    emptyRow.height = 26;
  } else {
    grnReceipts.forEach((grn, idx) => {
      const row = wsGRN.getRow(grnRowIdx);
      row.height = 20;
      const isEven = idx % 2 === 0;
      const rowBg = isEven ? COLORS.ZEBRA_EVEN : COLORS.ZEBRA_ODD;

      const expQty = Number(grn.expectedQty || 0);
      const recQty = Number(grn.actualReceivedQty || 0);
      const bNetQty = Number(grn.batch?.netQty || 0);

      sumGRNExpected += expQty;
      sumGRNReceived += recQty;
      sumGRNBatchNet += bNetQty;

      row.getCell(1).value = idx + 1;
      row.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };

      row.getCell(2).value = grn.referenceNo;
      row.getCell(2).font = { name: 'Consolas', size: 9.5, bold: true };
      row.getCell(2).alignment = { vertical: 'middle', horizontal: 'center' };

      row.getCell(3).value = formatDateTime(grn.receivedDate);
      row.getCell(3).alignment = { vertical: 'middle', horizontal: 'center' };

      row.getCell(4).value = grn.poReferenceNo || 'Direct / Exemption';
      row.getCell(4).font = { name: 'Consolas', size: 9 };
      row.getCell(4).alignment = { vertical: 'middle', horizontal: 'center' };

      row.getCell(5).value = grn.supplierName;
      row.getCell(5).font = { name: 'Segoe UI', size: 9.5, bold: true };
      row.getCell(5).alignment = { vertical: 'middle', indent: 1 };

      row.getCell(6).value = expQty;
      row.getCell(6).numFmt = '#,##0.00';
      row.getCell(6).alignment = { vertical: 'middle', horizontal: 'right' };

      row.getCell(7).value = recQty;
      row.getCell(7).numFmt = '#,##0.00';
      row.getCell(7).font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: COLORS.GREEN_TEXT } };
      row.getCell(7).alignment = { vertical: 'middle', horizontal: 'right' };

      row.getCell(8).value = material.unit;
      row.getCell(8).alignment = { vertical: 'middle', horizontal: 'center' };

      row.getCell(9).value = grn.isShortDelivery ? 'YES (SHORT)' : 'NO';
      row.getCell(9).alignment = { vertical: 'middle', horizontal: 'center' };
      if (grn.isShortDelivery) {
        row.getCell(9).font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: COLORS.AMBER_TEXT } };
      }

      row.getCell(10).value = grn.challanNumber || '—';
      row.getCell(10).alignment = { vertical: 'middle', horizontal: 'center' };

      row.getCell(11).value = grn.invoiceNumber || '—';
      row.getCell(11).alignment = { vertical: 'middle', horizontal: 'center' };

      row.getCell(12).value = formatDateOnly(grn.invoiceDate);
      row.getCell(12).alignment = { vertical: 'middle', horizontal: 'center' };

      row.getCell(13).value = grn.vehicleNumber || '—';
      row.getCell(13).alignment = { vertical: 'middle', horizontal: 'center' };

      row.getCell(14).value = grn.driverName || '—';
      row.getCell(14).alignment = { vertical: 'middle', indent: 1 };

      row.getCell(15).value = grn.batch?.batchNumber || '—';
      row.getCell(15).font = { name: 'Consolas', size: 9, bold: true };
      row.getCell(15).alignment = { vertical: 'middle', horizontal: 'center' };

      row.getCell(16).value = grn.batch?.storageLocation || 'Main RM Warehouse';
      row.getCell(16).alignment = { vertical: 'middle', indent: 1 };

      row.getCell(17).value = bNetQty > 0 ? bNetQty : '';
      row.getCell(17).numFmt = '#,##0.00';
      row.getCell(17).alignment = { vertical: 'middle', horizontal: 'right' };

      row.getCell(18).value = formatDateOnly(grn.batch?.expiryDate);
      row.getCell(18).alignment = { vertical: 'middle', horizontal: 'center' };

      row.getCell(19).value = grn.receivedByName || 'Gate Officer';
      row.getCell(19).alignment = { vertical: 'middle', indent: 1 };

      row.getCell(20).value = grn.grnStatus;
      row.getCell(20).alignment = { vertical: 'middle', horizontal: 'center' };

      row.getCell(21).value = grn.inventoryStatus === 'UPLOADED' ? 'UPLOADED' : 'PENDING';
      row.getCell(21).alignment = { vertical: 'middle', horizontal: 'center' };

      row.eachCell({ includeEmpty: true }, (c) => {
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBg } };
        c.border = BORDERS.thin;
      });

      grnRowIdx++;
    });

    // GRN TOTALS ROW
    const grnTotRow = wsGRN.getRow(grnRowIdx);
    grnTotRow.height = 24;

    wsGRN.mergeCells(`A${grnRowIdx}:E${grnRowIdx}`);
    grnTotRow.getCell(1).value = `TOTALS (${grnReceipts.length} INWARD RECEIPTS)`;
    grnTotRow.getCell(1).font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: COLORS.NAVY_HEADER } };
    grnTotRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'right', indent: 1 };

    grnTotRow.getCell(6).value = sumGRNExpected;
    grnTotRow.getCell(6).numFmt = '#,##0.00';
    grnTotRow.getCell(6).font = { name: 'Segoe UI', size: 10, bold: true };
    grnTotRow.getCell(6).alignment = { vertical: 'middle', horizontal: 'right' };

    grnTotRow.getCell(7).value = sumGRNReceived;
    grnTotRow.getCell(7).numFmt = '#,##0.00';
    grnTotRow.getCell(7).font = { name: 'Segoe UI', size: 10.5, bold: true, color: { argb: COLORS.GREEN_TEXT } };
    grnTotRow.getCell(7).alignment = { vertical: 'middle', horizontal: 'right' };

    grnTotRow.getCell(8).value = material.unit;
    grnTotRow.getCell(8).font = { name: 'Segoe UI', size: 9.5, bold: true };
    grnTotRow.getCell(8).alignment = { vertical: 'middle', horizontal: 'center' };

    grnTotRow.getCell(17).value = sumGRNBatchNet;
    grnTotRow.getCell(17).numFmt = '#,##0.00';
    grnTotRow.getCell(17).font = { name: 'Segoe UI', size: 10, bold: true };
    grnTotRow.getCell(17).alignment = { vertical: 'middle', horizontal: 'right' };

    grnTotRow.eachCell({ includeEmpty: true }, (c) => {
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.TOTALS_BG } };
      c.border = BORDERS.totals;
    });
  }

  autoFitColumns(wsGRN, 10, 40);


  // ══════════════════════════════════════════════════════════════════════════
  // SHEET 4: INVENTORY STOCK BATCHES
  // ══════════════════════════════════════════════════════════════════════════
  const wsBatches = workbook.addWorksheet('Inventory Stock Batches', { views: [{ showGridLines: true }] });
  addTitleBanner(wsBatches, 'INVENTORY STOCK BATCHES & TRACEABILITY', 'Warehouse Stored Batches, Net Quantities & Expiry Tracking', material);

  const batchCols = [
    { header: 'No.', width: 8 },
    { header: 'Batch Number', width: 24 },
    { header: 'Stored Date & Time', width: 22 },
    { header: 'Linked GRN Ref', width: 18 },
    { header: 'Linked PO Ref', width: 18 },
    { header: 'Supplier Name', width: 26 },
    { header: 'Received Qty', width: 14 },
    { header: 'Sample Tested Qty', width: 16 },
    { header: 'Net Available Qty', width: 16 },
    { header: 'UOM', width: 8 },
    { header: 'Storage Location', width: 22 },
    { header: 'Assigned Expiry Date', width: 18 },
    { header: 'Batch Status', width: 14 },
    { header: 'Added By (Done By)', width: 22 }
  ];

  let bRowIdx = 4;
  const bHeader = wsBatches.getRow(bRowIdx);
  batchCols.forEach((col, idx) => {
    bHeader.getCell(idx + 1).value = col.header;
  });
  styleHeaderRow(bHeader);
  bRowIdx++;

  let sumBatchRec = 0;
  let sumBatchSample = 0;
  let sumBatchNet = 0;

  if (batches.length === 0) {
    const emptyRow = wsBatches.getRow(bRowIdx);
    wsBatches.mergeCells(`A${bRowIdx}:N${bRowIdx}`);
    const eCell = emptyRow.getCell(1);
    eCell.value = 'No inventory stock batches stored for this raw material.';
    eCell.font = { name: 'Segoe UI', size: 10, italic: true, color: { argb: COLORS.TEXT_MUTED } };
    eCell.alignment = { vertical: 'middle', horizontal: 'center' };
    emptyRow.height = 26;
  } else {
    batches.forEach((b, idx) => {
      const row = wsBatches.getRow(bRowIdx);
      row.height = 20;
      const isEven = idx % 2 === 0;
      const rowBg = isEven ? COLORS.ZEBRA_EVEN : COLORS.ZEBRA_ODD;

      const recQty = Number(b.receivedQty || 0);
      const samQty = Number(b.sampleQty || 0);
      const netQty = Number(b.netQty || 0);

      sumBatchRec += recQty;
      sumBatchSample += samQty;
      sumBatchNet += netQty;

      row.getCell(1).value = idx + 1;
      row.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };

      row.getCell(2).value = b.batchNumber;
      row.getCell(2).font = { name: 'Consolas', size: 9.5, bold: true };
      row.getCell(2).alignment = { vertical: 'middle', horizontal: 'center' };

      row.getCell(3).value = formatDateTime(b.createdAt);
      row.getCell(3).alignment = { vertical: 'middle', horizontal: 'center' };

      row.getCell(4).value = b.grnReferenceNo || 'N/A';
      row.getCell(4).font = { name: 'Consolas', size: 9 };
      row.getCell(4).alignment = { vertical: 'middle', horizontal: 'center' };

      row.getCell(5).value = b.poReferenceNo || 'Direct';
      row.getCell(5).font = { name: 'Consolas', size: 9 };
      row.getCell(5).alignment = { vertical: 'middle', horizontal: 'center' };

      row.getCell(6).value = b.supplierName || '—';
      row.getCell(6).alignment = { vertical: 'middle', indent: 1 };

      row.getCell(7).value = recQty;
      row.getCell(7).numFmt = '#,##0.00';
      row.getCell(7).alignment = { vertical: 'middle', horizontal: 'right' };

      row.getCell(8).value = samQty;
      row.getCell(8).numFmt = '#,##0.00';
      row.getCell(8).alignment = { vertical: 'middle', horizontal: 'right' };

      row.getCell(9).value = netQty;
      row.getCell(9).numFmt = '#,##0.00';
      row.getCell(9).font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: COLORS.NAVY_HEADER } };
      row.getCell(9).alignment = { vertical: 'middle', horizontal: 'right' };

      row.getCell(10).value = b.uom || material.unit;
      row.getCell(10).alignment = { vertical: 'middle', horizontal: 'center' };

      row.getCell(11).value = b.storageLocation || 'Main RM Warehouse';
      row.getCell(11).alignment = { vertical: 'middle', indent: 1 };

      row.getCell(12).value = b.expiryDate ? formatDateOnly(b.expiryDate) : 'No Expiry';
      row.getCell(12).alignment = { vertical: 'middle', horizontal: 'center' };

      row.getCell(13).value = b.status || 'AVAILABLE';
      row.getCell(13).alignment = { vertical: 'middle', horizontal: 'center' };

      row.getCell(14).value = b.addedByName || 'Inventory Team';
      row.getCell(14).alignment = { vertical: 'middle', indent: 1 };

      row.eachCell({ includeEmpty: true }, (c) => {
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBg } };
        c.border = BORDERS.thin;
      });

      bRowIdx++;
    });

    // BATCH TOTALS ROW
    const bTotRow = wsBatches.getRow(bRowIdx);
    bTotRow.height = 24;

    wsBatches.mergeCells(`A${bRowIdx}:F${bRowIdx}`);
    bTotRow.getCell(1).value = `TOTALS (${batches.length} INVENTORY BATCHES)`;
    bTotRow.getCell(1).font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: COLORS.NAVY_HEADER } };
    bTotRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'right', indent: 1 };

    bTotRow.getCell(7).value = sumBatchRec;
    bTotRow.getCell(7).numFmt = '#,##0.00';
    bTotRow.getCell(7).font = { name: 'Segoe UI', size: 10, bold: true };
    bTotRow.getCell(7).alignment = { vertical: 'middle', horizontal: 'right' };

    bTotRow.getCell(8).value = sumBatchSample;
    bTotRow.getCell(8).numFmt = '#,##0.00';
    bTotRow.getCell(8).font = { name: 'Segoe UI', size: 10, bold: true };
    bTotRow.getCell(8).alignment = { vertical: 'middle', horizontal: 'right' };

    bTotRow.getCell(9).value = sumBatchNet;
    bTotRow.getCell(9).numFmt = '#,##0.00';
    bTotRow.getCell(9).font = { name: 'Segoe UI', size: 11, bold: true, color: { argb: COLORS.NAVY_HEADER } };
    bTotRow.getCell(9).alignment = { vertical: 'middle', horizontal: 'right' };

    bTotRow.getCell(10).value = material.unit;
    bTotRow.getCell(10).font = { name: 'Segoe UI', size: 9.5, bold: true };
    bTotRow.getCell(10).alignment = { vertical: 'middle', horizontal: 'center' };

    bTotRow.eachCell({ includeEmpty: true }, (c) => {
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.TOTALS_BG } };
      c.border = BORDERS.totals;
    });
  }

  autoFitColumns(wsBatches, 10, 40);


  // ══════════════════════════════════════════════════════════════════════════
  // SHEET 5: LAB & QC REPORTS
  // ══════════════════════════════════════════════════════════════════════════
  const wsLab = workbook.addWorksheet('Lab & QC Reports', { views: [{ showGridLines: true }] });
  addTitleBanner(wsLab, 'LABORATORY QUALITY CONTROL & INSPECTION REPORTS', 'Inspection Decisions, Sample Tests, Assigned Expiry & Chemical Findings', material);

  const labCols = [
    { header: 'No.', width: 8 },
    { header: 'Inspection Date & Time', width: 22 },
    { header: 'Lab Test ID', width: 20 },
    { header: 'GRN Reference', width: 18 },
    { header: 'PO Reference', width: 18 },
    { header: 'Supplier Name', width: 26 },
    { header: 'QC Overall Decision', width: 18 },
    { header: 'Inspection Status', width: 16 },
    { header: 'Tested By (Done By Inspector)', width: 24 },
    { header: 'Sample Qty Tested', width: 16 },
    { header: 'UOM', width: 8 },
    { header: 'Assigned Expiry Date', width: 18 },
    { header: 'Findings & Observations', width: 36 },
    { header: 'Manual Override Reason', width: 28 }
  ];

  let labRowIdx = 4;
  const labHeader = wsLab.getRow(labRowIdx);
  labCols.forEach((col, idx) => {
    labHeader.getCell(idx + 1).value = col.header;
  });
  styleHeaderRow(labHeader);
  labRowIdx++;

  let sumLabSample = 0;
  let approvedCount = 0;
  let rejectedCount = 0;

  if (labReports.length === 0) {
    const emptyRow = wsLab.getRow(labRowIdx);
    wsLab.mergeCells(`A${labRowIdx}:N${labRowIdx}`);
    const eCell = emptyRow.getCell(1);
    eCell.value = 'No laboratory or quality control test reports recorded for this raw material.';
    eCell.font = { name: 'Segoe UI', size: 10, italic: true, color: { argb: COLORS.TEXT_MUTED } };
    eCell.alignment = { vertical: 'middle', horizontal: 'center' };
    emptyRow.height = 26;
  } else {
    labReports.forEach((lab, idx) => {
      const row = wsLab.getRow(labRowIdx);
      row.height = 20;
      const isEven = idx % 2 === 0;
      const rowBg = isEven ? COLORS.ZEBRA_EVEN : COLORS.ZEBRA_ODD;

      const samQty = Number(lab.sampleQty || 0);
      sumLabSample += samQty;
      if (lab.overallDecision === 'APPROVED') approvedCount++;
      if (lab.overallDecision === 'REJECTED') rejectedCount++;

      row.getCell(1).value = idx + 1;
      row.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };

      row.getCell(2).value = formatDateTime(lab.testDate);
      row.getCell(2).alignment = { vertical: 'middle', horizontal: 'center' };

      row.getCell(3).value = lab.labTestId || lab.id;
      row.getCell(3).font = { name: 'Consolas', size: 9 };
      row.getCell(3).alignment = { vertical: 'middle', horizontal: 'center' };

      row.getCell(4).value = lab.grnReferenceNo || 'N/A';
      row.getCell(4).font = { name: 'Consolas', size: 9 };
      row.getCell(4).alignment = { vertical: 'middle', horizontal: 'center' };

      row.getCell(5).value = lab.poReferenceNo || 'Direct';
      row.getCell(5).font = { name: 'Consolas', size: 9 };
      row.getCell(5).alignment = { vertical: 'middle', horizontal: 'center' };

      row.getCell(6).value = lab.supplierName || '—';
      row.getCell(6).alignment = { vertical: 'middle', indent: 1 };

      const cDec = row.getCell(7);
      cDec.value = lab.overallDecision;
      cDec.alignment = { vertical: 'middle', horizontal: 'center' };
      cDec.font = { 
        name: 'Segoe UI', 
        size: 9.5, 
        bold: true, 
        color: { argb: lab.overallDecision === 'APPROVED' ? COLORS.GREEN_TEXT : (lab.overallDecision === 'REJECTED' ? COLORS.RED_TEXT : COLORS.AMBER_TEXT) } 
      };

      row.getCell(8).value = lab.status || 'COMPLETED';
      row.getCell(8).alignment = { vertical: 'middle', horizontal: 'center' };

      row.getCell(9).value = lab.testedByName || 'Lab Assistant';
      row.getCell(9).font = { name: 'Segoe UI', size: 9.5, bold: true };
      row.getCell(9).alignment = { vertical: 'middle', indent: 1 };

      row.getCell(10).value = samQty;
      row.getCell(10).numFmt = '#,##0.00';
      row.getCell(10).alignment = { vertical: 'middle', horizontal: 'right' };

      row.getCell(11).value = material.unit;
      row.getCell(11).alignment = { vertical: 'middle', horizontal: 'center' };

      row.getCell(12).value = lab.expiryDate ? formatDateOnly(lab.expiryDate) : 'Not Specified';
      row.getCell(12).alignment = { vertical: 'middle', horizontal: 'center' };

      row.getCell(13).value = lab.testNotes || 'Normal / Conforming to specifications';
      row.getCell(13).alignment = { vertical: 'middle', indent: 1 };

      row.getCell(14).value = lab.overrideReason || 'N/A';
      row.getCell(14).alignment = { vertical: 'middle', indent: 1 };

      row.eachCell({ includeEmpty: true }, (c) => {
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBg } };
        c.border = BORDERS.thin;
      });

      labRowIdx++;
    });

    // LAB TOTALS ROW
    const labTotRow = wsLab.getRow(labRowIdx);
    labTotRow.height = 24;

    wsLab.mergeCells(`A${labRowIdx}:F${labRowIdx}`);
    labTotRow.getCell(1).value = `TOTALS: ${labReports.length} INSPECTIONS (${approvedCount} APPROVED, ${rejectedCount} REJECTED)`;
    labTotRow.getCell(1).font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: COLORS.NAVY_HEADER } };
    labTotRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'right', indent: 1 };

    labTotRow.getCell(10).value = sumLabSample;
    labTotRow.getCell(10).numFmt = '#,##0.00';
    labTotRow.getCell(10).font = { name: 'Segoe UI', size: 10.5, bold: true };
    labTotRow.getCell(10).alignment = { vertical: 'middle', horizontal: 'right' };

    labTotRow.getCell(11).value = material.unit;
    labTotRow.getCell(11).font = { name: 'Segoe UI', size: 9.5, bold: true };
    labTotRow.getCell(11).alignment = { vertical: 'middle', horizontal: 'center' };

    labTotRow.eachCell({ includeEmpty: true }, (c) => {
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.TOTALS_BG } };
      c.border = BORDERS.totals;
    });
  }

  autoFitColumns(wsLab, 10, 42);


  // ══════════════════════════════════════════════════════════════════════════
  // SHEET 6: STOCK ADJUSTMENTS
  // ══════════════════════════════════════════════════════════════════════════
  const wsAdj = workbook.addWorksheet('Stock Adjustments', { views: [{ showGridLines: true }] });
  addTitleBanner(wsAdj, 'MANUAL STOCK ADJUSTMENTS & RECONCILIATIONS', 'Stock Audits, Physical Inventory Count Variances, Additions & Subtractions', material);

  const adjCols = [
    { header: 'No.', width: 8 },
    { header: 'Created Date & Time', width: 22 },
    { header: 'Updated At Date & Time', width: 22 },
    { header: 'Adjustment ID', width: 22 },
    { header: 'Type', width: 16 },
    { header: 'Adjusted Quantity', width: 16 },
    { header: 'Change in RM Stock', width: 18 },
    { header: 'UOM', width: 8 },
    { header: 'Reason / Audit Justification', width: 38 },
    { header: 'Adjusted By (Done By)', width: 22 },
    { header: 'User Role', width: 16 }
  ];

  let adjRowIdx = 4;
  const adjHeader = wsAdj.getRow(adjRowIdx);
  adjCols.forEach((col, idx) => {
    adjHeader.getCell(idx + 1).value = col.header;
  });
  styleHeaderRow(adjHeader);
  adjRowIdx++;

  let sumAdjAdd = 0;
  let sumAdjSub = 0;

  if (stockAdjustments.length === 0) {
    const emptyRow = wsAdj.getRow(adjRowIdx);
    wsAdj.mergeCells(`A${adjRowIdx}:K${adjRowIdx}`);
    const eCell = emptyRow.getCell(1);
    eCell.value = 'No manual stock adjustments logged for this raw material.';
    eCell.font = { name: 'Segoe UI', size: 10, italic: true, color: { argb: COLORS.TEXT_MUTED } };
    eCell.alignment = { vertical: 'middle', horizontal: 'center' };
    emptyRow.height = 26;
  } else {
    stockAdjustments.forEach((adj, idx) => {
      const row = wsAdj.getRow(adjRowIdx);
      row.height = 20;
      const isEven = idx % 2 === 0;
      const rowBg = isEven ? COLORS.ZEBRA_EVEN : COLORS.ZEBRA_ODD;

      const isAdd = adj.type === 'ADDITION';
      const qty = Number(adj.quantity || 0);

      if (isAdd) sumAdjAdd += qty;
      else sumAdjSub += qty;

      row.getCell(1).value = idx + 1;
      row.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };

      row.getCell(2).value = formatDateTime(adj.createdAt);
      row.getCell(2).alignment = { vertical: 'middle', horizontal: 'center' };

      row.getCell(3).value = formatDateTime(adj.updatedAt || adj.createdAt);
      row.getCell(3).alignment = { vertical: 'middle', horizontal: 'center' };

      row.getCell(4).value = adj.id;
      row.getCell(4).font = { name: 'Consolas', size: 9 };
      row.getCell(4).alignment = { vertical: 'middle', horizontal: 'center' };

      const cType = row.getCell(5);
      cType.value = isAdd ? '+ ADDITION' : '- SUBTRACTION';
      cType.alignment = { vertical: 'middle', horizontal: 'center' };
      cType.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: isAdd ? COLORS.GREEN_TEXT : COLORS.RED_TEXT } };

      row.getCell(6).value = qty;
      row.getCell(6).numFmt = '#,##0.00';
      row.getCell(6).font = { name: 'Segoe UI', size: 9.5, bold: true };
      row.getCell(6).alignment = { vertical: 'middle', horizontal: 'right' };

      const cChange = row.getCell(7);
      cChange.value = `${isAdd ? '+' : '-'}${qty.toLocaleString()} ${material.unit}`;
      cChange.alignment = { vertical: 'middle', horizontal: 'center' };
      cChange.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: isAdd ? COLORS.GREEN_TEXT : COLORS.RED_TEXT } };

      row.getCell(8).value = material.unit;
      row.getCell(8).alignment = { vertical: 'middle', horizontal: 'center' };

      row.getCell(9).value = adj.notes;
      row.getCell(9).alignment = { vertical: 'middle', indent: 1 };

      row.getCell(10).value = adj.userName || 'Supervisor';
      row.getCell(10).font = { name: 'Segoe UI', size: 9.5, bold: true };
      row.getCell(10).alignment = { vertical: 'middle', indent: 1 };

      row.getCell(11).value = adj.userRole || 'SUPERVISOR';
      row.getCell(11).alignment = { vertical: 'middle', horizontal: 'center' };

      row.eachCell({ includeEmpty: true }, (c) => {
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBg } };
        c.border = BORDERS.thin;
      });

      adjRowIdx++;
    });

    // ADJUSTMENTS TOTALS ROW
    const adjTotRow = wsAdj.getRow(adjRowIdx);
    adjTotRow.height = 24;

    wsAdj.mergeCells(`A${adjRowIdx}:E${adjRowIdx}`);
    adjTotRow.getCell(1).value = `TOTALS (${stockAdjustments.length} ADJUSTMENTS): ADDED +${sumAdjAdd.toLocaleString()} / SUBTRACTED -${sumAdjSub.toLocaleString()}`;
    adjTotRow.getCell(1).font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: COLORS.NAVY_HEADER } };
    adjTotRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'right', indent: 1 };

    const netAdj = sumAdjAdd - sumAdjSub;
    adjTotRow.getCell(6).value = Math.abs(netAdj);
    adjTotRow.getCell(6).numFmt = '#,##0.00';
    adjTotRow.getCell(6).font = { name: 'Segoe UI', size: 10.5, bold: true };
    adjTotRow.getCell(6).alignment = { vertical: 'middle', horizontal: 'right' };

    adjTotRow.getCell(7).value = `NET: ${netAdj >= 0 ? `+${netAdj.toLocaleString()}` : netAdj.toLocaleString()} ${material.unit}`;
    adjTotRow.getCell(7).font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: netAdj >= 0 ? COLORS.GREEN_TEXT : COLORS.RED_TEXT } };
    adjTotRow.getCell(7).alignment = { vertical: 'middle', horizontal: 'center' };

    adjTotRow.getCell(8).value = material.unit;
    adjTotRow.getCell(8).font = { name: 'Segoe UI', size: 9.5, bold: true };
    adjTotRow.getCell(8).alignment = { vertical: 'middle', horizontal: 'center' };

    adjTotRow.eachCell({ includeEmpty: true }, (c) => {
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.TOTALS_BG } };
      c.border = BORDERS.totals;
    });
  }

  autoFitColumns(wsAdj, 10, 42);


  // ══════════════════════════════════════════════════════════════════════════
  // SHEET 7: PRODUCTION USAGES
  // ══════════════════════════════════════════════════════════════════════════
  const wsUsage = workbook.addWorksheet('Production Usage', { views: [{ showGridLines: true }] });
  addTitleBanner(wsUsage, 'PRODUCTION BATCH CONSUMPTION & USAGE', 'Raw Material Consumption in Manufacturing Batches & Cost Valuation', material);

  const usageCols = [
    { header: 'No.', width: 8 },
    { header: 'Usage Date', width: 15 },
    { header: 'Production Batch No', width: 22 },
    { header: 'Batch Reference No', width: 20 },
    { header: 'Finished Product Name', width: 30 },
    { header: 'Product Code', width: 14 },
    { header: 'Required Qty', width: 14 },
    { header: 'Actual Used Qty', width: 16 },
    { header: 'UOM', width: 8 },
    { header: 'Unit Cost (₹)', width: 14 },
    { header: 'Total Consumption Cost (₹)', width: 22 },
    { header: 'Usage Status', width: 14 },
    { header: 'Batch Status', width: 14 },
    { header: 'Logged By (Done By)', width: 20 }
  ];

  let uRowIdx = 4;
  const uHeader = wsUsage.getRow(uRowIdx);
  usageCols.forEach((col, idx) => {
    uHeader.getCell(idx + 1).value = col.header;
  });
  styleHeaderRow(uHeader);
  uRowIdx++;

  let sumUsageReq = 0;
  let sumUsageActual = 0;
  let sumUsageCost = 0;

  if (productionUsages.length === 0) {
    const emptyRow = wsUsage.getRow(uRowIdx);
    wsUsage.mergeCells(`A${uRowIdx}:N${uRowIdx}`);
    const eCell = emptyRow.getCell(1);
    eCell.value = 'No production batch consumptions recorded for this raw material.';
    eCell.font = { name: 'Segoe UI', size: 10, italic: true, color: { argb: COLORS.TEXT_MUTED } };
    eCell.alignment = { vertical: 'middle', horizontal: 'center' };
    emptyRow.height = 26;
  } else {
    productionUsages.forEach((u, idx) => {
      const row = wsUsage.getRow(uRowIdx);
      row.height = 20;
      const isEven = idx % 2 === 0;
      const rowBg = isEven ? COLORS.ZEBRA_EVEN : COLORS.ZEBRA_ODD;

      const reqQty = Number(u.requiredQty || 0);
      const usedQty = Number(u.actualUsedQty || 0);
      const totCost = Number(u.totalCost || 0);

      sumUsageReq += reqQty;
      sumUsageActual += usedQty;
      sumUsageCost += totCost;

      row.getCell(1).value = idx + 1;
      row.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };

      row.getCell(2).value = formatDateOnly(u.date);
      row.getCell(2).alignment = { vertical: 'middle', horizontal: 'center' };

      row.getCell(3).value = u.batchNumber;
      row.getCell(3).font = { name: 'Consolas', size: 9.5, bold: true };
      row.getCell(3).alignment = { vertical: 'middle', horizontal: 'center' };

      row.getCell(4).value = u.batchReferenceNo || '—';
      row.getCell(4).font = { name: 'Consolas', size: 9 };
      row.getCell(4).alignment = { vertical: 'middle', horizontal: 'center' };

      row.getCell(5).value = u.productOnlyName || u.productName;
      row.getCell(5).font = { name: 'Segoe UI', size: 9.5, bold: true };
      row.getCell(5).alignment = { vertical: 'middle', indent: 1 };

      row.getCell(6).value = u.productCode || '—';
      row.getCell(6).alignment = { vertical: 'middle', horizontal: 'center' };

      row.getCell(7).value = reqQty;
      row.getCell(7).numFmt = '#,##0.00';
      row.getCell(7).alignment = { vertical: 'middle', horizontal: 'right' };

      row.getCell(8).value = usedQty;
      row.getCell(8).numFmt = '#,##0.00';
      row.getCell(8).font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: COLORS.NAVY_HEADER } };
      row.getCell(8).alignment = { vertical: 'middle', horizontal: 'right' };

      row.getCell(9).value = material.unit;
      row.getCell(9).alignment = { vertical: 'middle', horizontal: 'center' };

      row.getCell(10).value = Number(u.unitCost || 0);
      row.getCell(10).numFmt = '₹#,##0.00';
      row.getCell(10).alignment = { vertical: 'middle', horizontal: 'right' };

      row.getCell(11).value = totCost;
      row.getCell(11).numFmt = '₹#,##0.00';
      row.getCell(11).font = { name: 'Segoe UI', size: 9.5, bold: true };
      row.getCell(11).alignment = { vertical: 'middle', horizontal: 'right' };

      row.getCell(12).value = u.usageStatus;
      row.getCell(12).alignment = { vertical: 'middle', horizontal: 'center' };

      row.getCell(13).value = u.batchStatus;
      row.getCell(13).alignment = { vertical: 'middle', horizontal: 'center' };

      row.getCell(14).value = 'Production Floor Staff';
      row.getCell(14).alignment = { vertical: 'middle', indent: 1 };

      row.eachCell({ includeEmpty: true }, (c) => {
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBg } };
        c.border = BORDERS.thin;
      });

      uRowIdx++;
    });

    // USAGE TOTALS ROW
    const uTotRow = wsUsage.getRow(uRowIdx);
    uTotRow.height = 24;

    wsUsage.mergeCells(`A${uRowIdx}:F${uRowIdx}`);
    uTotRow.getCell(1).value = `TOTALS (${productionUsages.length} PRODUCTION BATCHES)`;
    uTotRow.getCell(1).font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: COLORS.NAVY_HEADER } };
    uTotRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'right', indent: 1 };

    uTotRow.getCell(7).value = sumUsageReq;
    uTotRow.getCell(7).numFmt = '#,##0.00';
    uTotRow.getCell(7).font = { name: 'Segoe UI', size: 10, bold: true };
    uTotRow.getCell(7).alignment = { vertical: 'middle', horizontal: 'right' };

    uTotRow.getCell(8).value = sumUsageActual;
    uTotRow.getCell(8).numFmt = '#,##0.00';
    uTotRow.getCell(8).font = { name: 'Segoe UI', size: 10.5, bold: true, color: { argb: COLORS.NAVY_HEADER } };
    uTotRow.getCell(8).alignment = { vertical: 'middle', horizontal: 'right' };

    uTotRow.getCell(9).value = material.unit;
    uTotRow.getCell(9).font = { name: 'Segoe UI', size: 9.5, bold: true };
    uTotRow.getCell(9).alignment = { vertical: 'middle', horizontal: 'center' };

    uTotRow.getCell(11).value = sumUsageCost;
    uTotRow.getCell(11).numFmt = '₹#,##0.00';
    uTotRow.getCell(11).font = { name: 'Segoe UI', size: 10.5, bold: true, color: { argb: COLORS.NAVY_HEADER } };
    uTotRow.getCell(11).alignment = { vertical: 'middle', horizontal: 'right' };

    uTotRow.eachCell({ includeEmpty: true }, (c) => {
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.TOTALS_BG } };
      c.border = BORDERS.totals;
    });
  }

  autoFitColumns(wsUsage, 10, 40);


  // ══════════════════════════════════════════════════════════════════════════
  // SHEET 8: RM WASTAGE RECORDS
  // ══════════════════════════════════════════════════════════════════════════
  const wsWaste = workbook.addWorksheet('RM Wastage', { views: [{ showGridLines: true }] });
  addTitleBanner(wsWaste, 'RAW MATERIAL WASTAGE & LOSS AUDIT', 'Scrap Logs, Spoilage, Damage & Financial Loss Records', material);

  const wasteCols = [
    { header: 'No.', width: 8 },
    { header: 'Wastage Date', width: 15 },
    { header: 'Logged At', width: 22 },
    { header: 'Waste Ref No', width: 18 },
    { header: 'Wasted Quantity', width: 16 },
    { header: 'UOM', width: 8 },
    { header: 'Estimated Loss Amount (₹)', width: 22 },
    { header: 'Reason / Scrap Cause', width: 36 },
    { header: 'Responsible Person (Done By)', width: 24 },
    { header: 'Logged By', width: 20 }
  ];

  let wRowIdx = 4;
  const wHeader = wsWaste.getRow(wRowIdx);
  wasteCols.forEach((col, idx) => {
    wHeader.getCell(idx + 1).value = col.header;
  });
  styleHeaderRow(wHeader);
  wRowIdx++;

  let sumWasteQty = 0;
  let sumWasteLoss = 0;

  if (wasteRecords.length === 0) {
    const emptyRow = wsWaste.getRow(wRowIdx);
    wsWaste.mergeCells(`A${wRowIdx}:J${wRowIdx}`);
    const eCell = emptyRow.getCell(1);
    eCell.value = 'No raw material wastage records logged for this item.';
    eCell.font = { name: 'Segoe UI', size: 10, italic: true, color: { argb: COLORS.TEXT_MUTED } };
    eCell.alignment = { vertical: 'middle', horizontal: 'center' };
    emptyRow.height = 26;
  } else {
    wasteRecords.forEach((w, idx) => {
      const row = wsWaste.getRow(wRowIdx);
      row.height = 20;
      const isEven = idx % 2 === 0;
      const rowBg = isEven ? COLORS.ZEBRA_EVEN : COLORS.ZEBRA_ODD;

      const wQty = Number(w.quantity || 0);
      const wLoss = Number(w.lossAmount || 0);

      sumWasteQty += wQty;
      sumWasteLoss += wLoss;

      row.getCell(1).value = idx + 1;
      row.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };

      row.getCell(2).value = formatDateOnly(w.date);
      row.getCell(2).alignment = { vertical: 'middle', horizontal: 'center' };

      row.getCell(3).value = formatDateTime(w.createdAt);
      row.getCell(3).alignment = { vertical: 'middle', horizontal: 'center' };

      row.getCell(4).value = w.referenceNo;
      row.getCell(4).font = { name: 'Consolas', size: 9.5, bold: true };
      row.getCell(4).alignment = { vertical: 'middle', horizontal: 'center' };

      row.getCell(5).value = wQty;
      row.getCell(5).numFmt = '#,##0.00';
      row.getCell(5).font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: COLORS.RED_TEXT } };
      row.getCell(5).alignment = { vertical: 'middle', horizontal: 'right' };

      row.getCell(6).value = w.uom || material.unit;
      row.getCell(6).alignment = { vertical: 'middle', horizontal: 'center' };

      row.getCell(7).value = wLoss;
      row.getCell(7).numFmt = '₹#,##0.00';
      row.getCell(7).font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: COLORS.RED_TEXT } };
      row.getCell(7).alignment = { vertical: 'middle', horizontal: 'right' };

      row.getCell(8).value = w.notes;
      row.getCell(8).alignment = { vertical: 'middle', indent: 1 };

      row.getCell(9).value = w.responsiblePerson || '—';
      row.getCell(9).font = { name: 'Segoe UI', size: 9.5, bold: true };
      row.getCell(9).alignment = { vertical: 'middle', indent: 1 };

      row.getCell(10).value = w.createdBy || 'Staff';
      row.getCell(10).alignment = { vertical: 'middle', indent: 1 };

      row.eachCell({ includeEmpty: true }, (c) => {
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBg } };
        c.border = BORDERS.thin;
      });

      wRowIdx++;
    });

    // WASTAGE TOTALS ROW
    const wTotRow = wsWaste.getRow(wRowIdx);
    wTotRow.height = 24;

    wsWaste.mergeCells(`A${wRowIdx}:D${wRowIdx}`);
    wTotRow.getCell(1).value = `TOTALS (${wasteRecords.length} WASTAGE EVENTS)`;
    wTotRow.getCell(1).font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: COLORS.NAVY_HEADER } };
    wTotRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'right', indent: 1 };

    wTotRow.getCell(5).value = sumWasteQty;
    wTotRow.getCell(5).numFmt = '#,##0.00';
    wTotRow.getCell(5).font = { name: 'Segoe UI', size: 10.5, bold: true, color: { argb: COLORS.RED_TEXT } };
    wTotRow.getCell(5).alignment = { vertical: 'middle', horizontal: 'right' };

    wTotRow.getCell(6).value = material.unit;
    wTotRow.getCell(6).font = { name: 'Segoe UI', size: 9.5, bold: true };
    wTotRow.getCell(6).alignment = { vertical: 'middle', horizontal: 'center' };

    wTotRow.getCell(7).value = sumWasteLoss;
    wTotRow.getCell(7).numFmt = '₹#,##0.00';
    wTotRow.getCell(7).font = { name: 'Segoe UI', size: 10.5, bold: true, color: { argb: COLORS.RED_TEXT } };
    wTotRow.getCell(7).alignment = { vertical: 'middle', horizontal: 'right' };

    wTotRow.eachCell({ includeEmpty: true }, (c) => {
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.TOTALS_BG } };
      c.border = BORDERS.totals;
    });
  }

  autoFitColumns(wsWaste, 10, 40);


  // ══════════════════════════════════════════════════════════════════════════
  // SHEET 9: PURCHASE RETURNS (IF ANY)
  // ══════════════════════════════════════════════════════════════════════════
  if (purchaseReturns.length > 0) {
    const wsRet = workbook.addWorksheet('Purchase Returns', { views: [{ showGridLines: true }] });
    addTitleBanner(wsRet, 'PURCHASE RETURNS TO VENDOR', 'Vendor Rejections, RM Debits & Return Delivery Dispatches', material);

    const retCols = [
      { header: 'No.', width: 8 },
      { header: 'Return Date', width: 15 },
      { header: 'Return Reference No', width: 20 },
      { header: 'PO Reference', width: 18 },
      { header: 'GRN Reference', width: 18 },
      { header: 'Supplier Name', width: 26 },
      { header: 'Returned Quantity', width: 16 },
      { header: 'UOM', width: 8 },
      { header: 'Return Reason', width: 24 },
      { header: 'Reason Description', width: 34 },
      { header: 'Status', width: 14 },
      { header: 'Initiated By (Done By)', width: 22 }
    ];

    let rRowIdx = 4;
    const rHeader = wsRet.getRow(rRowIdx);
    retCols.forEach((col, idx) => {
      rHeader.getCell(idx + 1).value = col.header;
    });
    styleHeaderRow(rHeader);
    rRowIdx++;

    let sumRetQty = 0;

    purchaseReturns.forEach((ret, idx) => {
      const row = wsRet.getRow(rRowIdx);
      row.height = 20;
      const isEven = idx % 2 === 0;
      const rowBg = isEven ? COLORS.ZEBRA_EVEN : COLORS.ZEBRA_ODD;

      const rQty = Number(ret.returnQty || 0);
      sumRetQty += rQty;

      row.getCell(1).value = idx + 1;
      row.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };

      row.getCell(2).value = formatDateOnly(ret.returnDate);
      row.getCell(2).alignment = { vertical: 'middle', horizontal: 'center' };

      row.getCell(3).value = ret.referenceNo;
      row.getCell(3).font = { name: 'Consolas', size: 9.5, bold: true };
      row.getCell(3).alignment = { vertical: 'middle', horizontal: 'center' };

      row.getCell(4).value = ret.poReferenceNo || 'N/A';
      row.getCell(4).font = { name: 'Consolas', size: 9 };
      row.getCell(4).alignment = { vertical: 'middle', horizontal: 'center' };

      row.getCell(5).value = ret.grnReferenceNo || 'N/A';
      row.getCell(5).font = { name: 'Consolas', size: 9 };
      row.getCell(5).alignment = { vertical: 'middle', horizontal: 'center' };

      row.getCell(6).value = ret.supplierName;
      row.getCell(6).font = { name: 'Segoe UI', size: 9.5, bold: true };
      row.getCell(6).alignment = { vertical: 'middle', indent: 1 };

      row.getCell(7).value = rQty;
      row.getCell(7).numFmt = '#,##0.00';
      row.getCell(7).font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: COLORS.RED_TEXT } };
      row.getCell(7).alignment = { vertical: 'middle', horizontal: 'right' };

      row.getCell(8).value = material.unit;
      row.getCell(8).alignment = { vertical: 'middle', horizontal: 'center' };

      row.getCell(9).value = ret.returnReason;
      row.getCell(9).alignment = { vertical: 'middle', indent: 1 };

      row.getCell(10).value = ret.reasonDescription || '—';
      row.getCell(10).alignment = { vertical: 'middle', indent: 1 };

      row.getCell(11).value = ret.status;
      row.getCell(11).alignment = { vertical: 'middle', horizontal: 'center' };

      row.getCell(12).value = ret.createdByName || ret.initiatedBy || 'Staff';
      row.getCell(12).alignment = { vertical: 'middle', indent: 1 };

      row.eachCell({ includeEmpty: true }, (c) => {
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBg } };
        c.border = BORDERS.thin;
      });

      rRowIdx++;
    });

    // RETURNS TOTALS ROW
    const rTotRow = wsRet.getRow(rRowIdx);
    rTotRow.height = 24;

    wsRet.mergeCells(`A${rRowIdx}:F${rRowIdx}`);
    rTotRow.getCell(1).value = `TOTALS (${purchaseReturns.length} PURCHASE RETURNS)`;
    rTotRow.getCell(1).font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: COLORS.NAVY_HEADER } };
    rTotRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'right', indent: 1 };

    rTotRow.getCell(7).value = sumRetQty;
    rTotRow.getCell(7).numFmt = '#,##0.00';
    rTotRow.getCell(7).font = { name: 'Segoe UI', size: 10.5, bold: true, color: { argb: COLORS.RED_TEXT } };
    rTotRow.getCell(7).alignment = { vertical: 'middle', horizontal: 'right' };

    rTotRow.getCell(8).value = material.unit;
    rTotRow.getCell(8).font = { name: 'Segoe UI', size: 9.5, bold: true };
    rTotRow.getCell(8).alignment = { vertical: 'middle', horizontal: 'center' };

    rTotRow.eachCell({ includeEmpty: true }, (c) => {
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.TOTALS_BG } };
      c.border = BORDERS.totals;
    });

    autoFitColumns(wsRet, 10, 40);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // GENERATE FILE BUFFER & TRIGGER BROWSER DOWNLOAD
  // ══════════════════════════════════════════════════════════════════════════
  const cleanCode = (material.code || 'RM').replace(/[^a-zA-Z0-9_-]/g, '_');
  const cleanName = (material.name || 'Material').replace(/[^a-zA-Z0-9_-]/g, '_');
  const dateStamp = new Date().toISOString().slice(0, 10);
  const fileName = `${cleanCode}_${cleanName}_Complete_Lifecycle_Audit_${dateStamp}.xlsx`;

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);

  return fileName;
}
