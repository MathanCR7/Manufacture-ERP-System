import ExcelJS from 'exceljs';

/**
 * Palette Tokens for Attractive Executive ERP Spreadsheet Styling
 */
const COLORS = {
  NAVY_HEADER: 'FF0F172A',      // Slate 900
  INDIGO_BANNER: 'FF1E1B4B',    // Deep Indigo
  LEGEND_BG: 'FFF8FAFC',        // Slate 50
  TABLE_HEADER: 'FF1E293B',     // Slate 800
  DATE_HEADER: 'FF334155',      // Slate 700

  // Movement Styles: IN = GREEN, OUT = RED
  IN_HDR: 'FF065F46',           // Dark Emerald Header
  IN_FILL: 'FFDCFCE7',          // Soft Mint Green Fill #DCFCE7
  IN_TEXT: 'FF15803D',          // Bold Emerald Text #15803D
  IN_BORDER: 'FF86EFAC',        // Green Border #86EFAC

  OUT_HDR: 'FF881337',          // Dark Rose/Red Header
  OUT_FILL: 'FFFEE2E2',         // Soft Rose/Red Fill #FEE2E2
  OUT_TEXT: 'FFB91C1C',         // Bold Crimson Text #B91C1C
  OUT_BORDER: 'FFFCA5A5',       // Red Border #FCA5A5

  BOTH_FILL: 'FFFEF3C7',        // Soft Amber Fill #FEF3C7
  BOTH_TEXT: 'FF92400E',        // Amber-Brown Text #92400E
  BOTH_BORDER: 'FFFCD34D',

  TOTALS_BG: 'FFF1F5F9',        // Slate 100
  BORDER_LIGHT: 'FFE2E8F0',     // Light Slate Border
  BORDER_DARK: 'FF94A3B8',      // Slate 400
  WHITE: 'FFFFFFFF',
  MUTED_TEXT: 'FF64748B',       // Slate 500
  TEXT_MAIN: 'FF0F172A',        // Slate 900
  INV_BADGE_FILL: 'FFE0E7FF',   // Indigo Tint for Invoice Date
  INV_BADGE_TEXT: 'FF3730A3'
};

const BORDERS = {
  thin: {
    top: { style: 'thin', color: { argb: COLORS.BORDER_LIGHT } },
    left: { style: 'thin', color: { argb: COLORS.BORDER_LIGHT } },
    bottom: { style: 'thin', color: { argb: COLORS.BORDER_LIGHT } },
    right: { style: 'thin', color: { argb: COLORS.BORDER_LIGHT } }
  },
  header: {
    top: { style: 'medium', color: { argb: 'FF0F172A' } },
    left: { style: 'thin', color: { argb: 'FF475569' } },
    bottom: { style: 'medium', color: { argb: 'FF0F172A' } },
    right: { style: 'thin', color: { argb: 'FF475569' } }
  },
  totals: {
    top: { style: 'thin', color: { argb: COLORS.BORDER_DARK } },
    bottom: { style: 'double', color: { argb: 'FF0F172A' } },
    left: { style: 'thin', color: { argb: COLORS.BORDER_LIGHT } },
    right: { style: 'thin', color: { argb: COLORS.BORDER_LIGHT } }
  }
};

/**
 * Format timestamped file name: e.g. RM_Stock_InOut_Matrix_ALL_27-Oct-2026_12-45-30-PM.xlsx
 */
export function getFormattedExportFileName(prefix, period, ext = 'xlsx') {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, '0');
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthStr = monthNames[now.getMonth()];
  const year = now.getFullYear();
  let hours = now.getHours();
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  const hourStr = String(hours).padStart(2, '0');

  const periodClean = (period || 'all').toUpperCase();
  return `${prefix}_${periodClean}_${day}-${monthStr}-${year}_${hourStr}-${minutes}-${seconds}-${ampm}.${ext}`;
}

/**
 * Clean UOM helper to guarantee no UUID ever renders
 */
export function cleanUOM(uom) {
  if (!uom) return 'Nos';
  const str = String(uom).trim();
  if (/^[0-9a-fA-F-]{32,36}$/.test(str)) return 'Nos';
  return str;
}

/**
 * Helper to format date as 15 Oct 2026
 */
function formatShortDate(d) {
  if (!d) return '—';
  try {
    const date = new Date(d);
    if (isNaN(date.getTime())) return String(d);
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  } catch {
    return String(d);
  }
}

/**
 * Auto-adjust column widths with bounds
 */
function autoFitWorksheet(worksheet, minWidth = 10, maxWidth = 45) {
  worksheet.columns.forEach((column) => {
    let maxLen = 0;
    column.eachCell({ includeEmpty: false }, (cell) => {
      // Don't let banner rows 1-4 expand the column widths
      if (cell.row <= 4) return;
      const val = cell.value;
      if (val != null) {
        const str = typeof val === 'object' && val.text ? val.text : String(val);
        maxLen = Math.max(maxLen, str.length);
      }
    });
    column.width = Math.max(minWidth, Math.min(maxWidth, maxLen + 4));
  });
}

/**
 * Build Title & Visual Movement Legend Banner
 */
function addMatrixHeaderBanners(ws, totalCols, period, materialCount, dateCount) {
  const colLetter = getColumnLetter(totalCols);

  // Row 1: Main Title
  ws.mergeCells(`A1:${colLetter}1`);
  const r1 = ws.getCell('A1');
  r1.value = 'RAW MATERIAL STOCK IN-OUT MOVEMENT MATRIX REPORT';
  r1.font = { name: 'Segoe UI', size: 14, bold: true, color: { argb: COLORS.WHITE } };
  r1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.NAVY_HEADER } };
  r1.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  ws.getRow(1).height = 30;

  // Row 2: Subtitle with metadata
  ws.mergeCells(`A2:${colLetter}2`);
  const r2 = ws.getCell('A2');
  const now = new Date();
  r2.value = `Manufacturing Inventory Movement Matrix • Period: ${(period || 'all').toUpperCase()} • Materials: ${materialCount} • Movement Dates: ${dateCount} • Generated: ${now.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}`;
  r2.font = { name: 'Segoe UI', size: 9.5, italic: true, color: { argb: 'FFE2E8F0' } };
  r2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.INDIGO_BANNER } };
  r2.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  ws.getRow(2).height = 22;

  // Row 3: Color-Code Legend Banner (IN = GREEN, OUT = RED)
  ws.mergeCells(`A3:${colLetter}3`);
  const r3 = ws.getCell('A3');
  r3.value = 'VISUAL MOVEMENT COLOR GUIDE:    🟩 INWARD (IN) = Soft Green Background (#DCFCE7) with Bold Emerald Text (#15803D)    |    🟥 OUTWARD (OUT) = Soft Red Background (#FEE2E2) with Bold Crimson Text (#B91C1C)    |    🟨 BOTH (IN & OUT) = Amber';
  r3.font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FF1E293B' } };
  r3.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.LEGEND_BG } };
  r3.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  r3.border = {
    top: { style: 'thin', color: { argb: COLORS.BORDER_LIGHT } },
    bottom: { style: 'thin', color: { argb: COLORS.BORDER_DARK } }
  };
  ws.getRow(3).height = 22;

  // Row 4: Spacer
  ws.getRow(4).height = 8;
}

/**
 * Standard Title & Visual Movement Legend Banner for Single-Sheet Exports
 */
function addStandardHeaderBanners(ws, totalCols, title, subtitle) {
  const colLetter = getColumnLetter(totalCols);

  // Row 1: Main Title
  ws.mergeCells(`A1:${colLetter}1`);
  const r1 = ws.getCell('A1');
  r1.value = title;
  r1.font = { name: 'Segoe UI', size: 14, bold: true, color: { argb: COLORS.WHITE } };
  r1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.NAVY_HEADER } };
  r1.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  ws.getRow(1).height = 30;

  // Row 2: Subtitle
  ws.mergeCells(`A2:${colLetter}2`);
  const r2 = ws.getCell('A2');
  r2.value = subtitle;
  r2.font = { name: 'Segoe UI', size: 9.5, italic: true, color: { argb: 'FFE2E8F0' } };
  r2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.INDIGO_BANNER } };
  r2.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  ws.getRow(2).height = 22;

  // Row 3: Visual Movement Color Guide (IN = Green, OUT = Red)
  ws.mergeCells(`A3:${colLetter}3`);
  const r3 = ws.getCell('A3');
  r3.value = 'VISUAL MOVEMENT COLOR GUIDE:    🟩 INWARD (IN) = Soft Green Background (#DCFCE7) with Bold Emerald Text (#15803D)    |    🟥 OUTWARD (OUT) = Soft Red Background (#FEE2E2) with Bold Crimson Text (#B91C1C)    |    🟨 BOTH (IN & OUT) = Amber';
  r3.font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FF1E293B' } };
  r3.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.LEGEND_BG } };
  r3.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  r3.border = {
    top: { style: 'thin', color: { argb: COLORS.BORDER_LIGHT } },
    bottom: { style: 'thin', color: { argb: COLORS.BORDER_DARK } }
  };
  ws.getRow(3).height = 22;

  // Row 4: Spacer
  ws.getRow(4).height = 8;
}

/**
 * Convert 1-based index to Excel column letters (1 -> A, 28 -> AB)
 */
function getColumnLetter(colIndex) {
  let letter = '';
  while (colIndex > 0) {
    const mod = (colIndex - 1) % 26;
    letter = String.fromCharCode(65 + mod) + letter;
    colIndex = Math.floor((colIndex - mod) / 26);
  }
  return letter || 'A';
}

/**
 * ══════════════════════════════════════════════════════════════════════════════
 * 1. EXPORT STOCK IN-OUT MATRIX TO EXCEL (WITH GREEN IN & RED OUT)
 * ══════════════════════════════════════════════════════════════════════════════
 */
export async function exportStockInOutMatrixToExcel({
  materials = [],
  matrixDates = [],
  matrixData = {},
  period = 'all',
  allTransactions = []
}) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Manufacturing ERP System';
  workbook.lastModifiedBy = 'ERP User';
  workbook.created = new Date();
  workbook.modified = new Date();

  // ──────────────────────────────────────────────────────────────────────────
  // SHEET 1: STOCK IN-OUT MOVEMENT MATRIX GRID
  // ──────────────────────────────────────────────────────────────────────────
  const wsMatrix = workbook.addWorksheet('Stock In-Out Matrix', {
    views: [
      {
        state: 'frozen',
        xSplit: 2, // Freeze RM Code and Raw Material Name
        ySplit: 5, // Freeze banners & table header
        showGridLines: true
      }
    ]
  });

  const totalCols = 9 + Math.max(1, matrixDates.length);
  addMatrixHeaderBanners(wsMatrix, totalCols, period, materials.length, matrixDates.length);

  // Row 5: Table Column Headers
  const headerRowIdx = 5;
  const headerRow = wsMatrix.getRow(headerRowIdx);
  headerRow.height = 28;

  const staticHeaders = [
    { title: 'RM Code', width: 14, align: 'center', hdrColor: COLORS.TABLE_HEADER },
    { title: 'Raw Material Name', width: 30, align: 'left', hdrColor: COLORS.TABLE_HEADER },
    { title: 'Category', width: 22, align: 'left', hdrColor: COLORS.TABLE_HEADER },
    { title: 'UOM', width: 9, align: 'center', hdrColor: COLORS.TABLE_HEADER },
    { title: 'TotalStock', width: 14, align: 'right', hdrColor: COLORS.TABLE_HEADER },
    { title: 'Available Stock', width: 16, align: 'right', hdrColor: COLORS.ACCENT_GREEN_HDR },
    { title: `Period Inward IN (${period})`, width: 22, align: 'right', hdrColor: COLORS.IN_HDR },
    { title: `Period Outward OUT (${period})`, width: 22, align: 'right', hdrColor: COLORS.OUT_HDR },
    { title: 'Total Valuation (₹)', width: 18, align: 'right', hdrColor: COLORS.TABLE_HEADER }
  ];

  staticHeaders.forEach((h, idx) => {
    const colNum = idx + 1;
    const cell = headerRow.getCell(colNum);
    cell.value = h.title;
    cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: COLORS.WHITE } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: h.hdrColor } };
    cell.alignment = { vertical: 'middle', horizontal: h.align, wrapText: true };
    cell.border = BORDERS.header;
    wsMatrix.getColumn(colNum).width = h.width;
  });

  // Dynamic Chronological Date Headers
  matrixDates.forEach((dateStr, dIdx) => {
    const colNum = 10 + dIdx;
    const cell = headerRow.getCell(colNum);
    cell.value = dateStr;
    cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: COLORS.WHITE } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.DATE_HEADER } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = BORDERS.header;
    wsMatrix.getColumn(colNum).width = 16;
  });

  // Data Rows
  let curRowIdx = 6;
  let sumTotalStock = 0;
  let sumAvailableStock = 0;
  let sumPeriodIn = 0;
  let sumPeriodOut = 0;
  let sumValuation = 0;
  const dateInSums = new Array(matrixDates.length).fill(0);
  const dateOutSums = new Array(matrixDates.length).fill(0);

  materials.forEach((mat, mIdx) => {
    const row = wsMatrix.getRow(curRowIdx);
    row.height = 22;

    const cur = Number(mat.currentStock || 0);
    const wip = Number(mat.inProgressStock || 0);
    const free = mat.availableStock !== undefined ? Number(mat.availableStock) : Math.max(0, cur - wip);
    const pIn = Number(mat.periodInQty || 0);
    const pOut = Number(mat.periodOutQty || 0);
    const val = Number(mat.valuation || 0);
    const uomStr = cleanUOM(mat.uom);

    sumTotalStock += cur;
    sumAvailableStock += free;
    sumPeriodIn += pIn;
    sumPeriodOut += pOut;
    sumValuation += val;

    const isEven = mIdx % 2 === 0;
    const defaultBg = isEven ? 'FFFFFFFF' : 'FFF8FAFC';

    // 1. RM Code
    const cCode = row.getCell(1);
    cCode.value = mat.code || '—';
    cCode.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: 'FF0284C7' } };
    cCode.alignment = { vertical: 'middle', horizontal: 'center' };
    cCode.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: defaultBg } };
    cCode.border = BORDERS.thin;

    // 2. Raw Material Name
    const cName = row.getCell(2);
    cName.value = mat.name || '—';
    cName.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: COLORS.TEXT_MAIN } };
    cName.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    cName.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: defaultBg } };
    cName.border = BORDERS.thin;

    // 3. Category
    const cCat = row.getCell(3);
    cCat.value = mat.category || '—';
    cCat.font = { name: 'Segoe UI', size: 9, color: { argb: 'FF334155' } };
    cCat.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    cCat.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: defaultBg } };
    cCat.border = BORDERS.thin;

    // 4. UOM
    const cUom = row.getCell(4);
    cUom.value = uomStr;
    cUom.font = { name: 'Segoe UI', size: 9, color: { argb: 'FF475569' } };
    cUom.alignment = { vertical: 'middle', horizontal: 'center' };
    cUom.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: defaultBg } };
    cUom.border = BORDERS.thin;

    // 5. TotalStock
    const cTot = row.getCell(5);
    cTot.value = cur;
    cTot.numFmt = '#,##0.00';
    cTot.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: COLORS.TEXT_MAIN } };
    cTot.alignment = { vertical: 'middle', horizontal: 'right' };
    cTot.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: defaultBg } };
    cTot.border = BORDERS.thin;

    // 6. Available Stock
    const cAvail = row.getCell(6);
    cAvail.value = free;
    cAvail.numFmt = '#,##0.00';
    cAvail.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: COLORS.IN_TEXT } };
    cAvail.alignment = { vertical: 'middle', horizontal: 'right' };
    cAvail.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: defaultBg } };
    cAvail.border = BORDERS.thin;

    // 7. Period Inward IN (GREEN)
    const cIn = row.getCell(7);
    cIn.value = pIn;
    cIn.numFmt = '#,##0.00';
    cIn.alignment = { vertical: 'middle', horizontal: 'right' };
    if (pIn > 0) {
      cIn.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: COLORS.IN_TEXT } };
      cIn.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.IN_FILL } };
      cIn.border = {
        top: { style: 'thin', color: { argb: COLORS.IN_BORDER } },
        bottom: { style: 'thin', color: { argb: COLORS.IN_BORDER } },
        left: { style: 'thin', color: { argb: COLORS.IN_BORDER } },
        right: { style: 'thin', color: { argb: COLORS.IN_BORDER } }
      };
    } else {
      cIn.font = { name: 'Segoe UI', size: 9, color: { argb: COLORS.MUTED_TEXT } };
      cIn.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: defaultBg } };
      cIn.border = BORDERS.thin;
    }

    // 8. Period Outward OUT (RED)
    const cOut = row.getCell(8);
    cOut.value = pOut;
    cOut.numFmt = '#,##0.00';
    cOut.alignment = { vertical: 'middle', horizontal: 'right' };
    if (pOut > 0) {
      cOut.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: COLORS.OUT_TEXT } };
      cOut.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.OUT_FILL } };
      cOut.border = {
        top: { style: 'thin', color: { argb: COLORS.OUT_BORDER } },
        bottom: { style: 'thin', color: { argb: COLORS.OUT_BORDER } },
        left: { style: 'thin', color: { argb: COLORS.OUT_BORDER } },
        right: { style: 'thin', color: { argb: COLORS.OUT_BORDER } }
      };
    } else {
      cOut.font = { name: 'Segoe UI', size: 9, color: { argb: COLORS.MUTED_TEXT } };
      cOut.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: defaultBg } };
      cOut.border = BORDERS.thin;
    }

    // 9. Total Valuation (₹)
    const cVal = row.getCell(9);
    cVal.value = val;
    cVal.numFmt = '₹#,##0.00';
    cVal.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: COLORS.TEXT_MAIN } };
    cVal.alignment = { vertical: 'middle', horizontal: 'right' };
    cVal.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: defaultBg } };
    cVal.border = BORDERS.thin;

    // 10+. Dynamic Date Columns (Green IN / Red OUT)
    matrixDates.forEach((dStr, dIdx) => {
      const colNum = 10 + dIdx;
      const cell = row.getCell(colNum);
      const cData = matrixData[mat.id]?.[dStr] || { inQty: 0, outQty: 0, transactions: [] };
      const hasIn = cData.inQty > 0;
      const hasOut = cData.outQty > 0;

      dateInSums[dIdx] += cData.inQty;
      dateOutSums[dIdx] += cData.outQty;

      // Check PO Supplier Invoice Date
      const poTx = cData.transactions.find(t => t.supplierInvoiceDate || t.supplierInvoiceNo);
      const invNote = poTx?.supplierInvoiceDate ? ` (Inv: ${formatShortDate(poTx.supplierInvoiceDate)})` : '';

      if (hasIn && hasOut) {
        cell.value = `+${cData.inQty} / -${cData.outQty}${invNote}`;
        cell.font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: COLORS.BOTH_TEXT } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.BOTH_FILL } };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.border = {
          top: { style: 'thin', color: { argb: COLORS.BOTH_BORDER } },
          bottom: { style: 'thin', color: { argb: COLORS.BOTH_BORDER } },
          left: { style: 'thin', color: { argb: COLORS.BOTH_BORDER } },
          right: { style: 'thin', color: { argb: COLORS.BOTH_BORDER } }
        };
      } else if (hasIn) {
        cell.value = invNote ? `+${cData.inQty}${invNote}` : Number(cData.inQty);
        if (!invNote) cell.numFmt = '#,##0.00';
        cell.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: COLORS.IN_TEXT } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.IN_FILL } };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.border = {
          top: { style: 'thin', color: { argb: COLORS.IN_BORDER } },
          bottom: { style: 'thin', color: { argb: COLORS.IN_BORDER } },
          left: { style: 'thin', color: { argb: COLORS.IN_BORDER } },
          right: { style: 'thin', color: { argb: COLORS.IN_BORDER } }
        };
      } else if (hasOut) {
        cell.value = Number(cData.outQty);
        cell.numFmt = '#,##0.00';
        cell.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: COLORS.OUT_TEXT } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.OUT_FILL } };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.border = {
          top: { style: 'thin', color: { argb: COLORS.OUT_BORDER } },
          bottom: { style: 'thin', color: { argb: COLORS.OUT_BORDER } },
          left: { style: 'thin', color: { argb: COLORS.OUT_BORDER } },
          right: { style: 'thin', color: { argb: COLORS.OUT_BORDER } }
        };
      } else {
        cell.value = '—';
        cell.font = { name: 'Segoe UI', size: 9, color: { argb: 'FFCBD5E1' } };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: defaultBg } };
        cell.border = BORDERS.thin;
      }
    });

    curRowIdx++;
  });

  // Totals Summary Row at Bottom
  const totRow = wsMatrix.getRow(curRowIdx);
  totRow.height = 26;

  wsMatrix.mergeCells(`A${curRowIdx}:D${curRowIdx}`);
  const cTotLabel = totRow.getCell(1);
  cTotLabel.value = `GRAND TOTALS (${materials.length} RAW MATERIALS)`;
  cTotLabel.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: COLORS.NAVY_HEADER } };
  cTotLabel.alignment = { vertical: 'middle', horizontal: 'right', indent: 1 };

  // Totals: TotalStock
  const tTot = totRow.getCell(5);
  tTot.value = sumTotalStock;
  tTot.numFmt = '#,##0.00';
  tTot.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: COLORS.NAVY_HEADER } };
  tTot.alignment = { vertical: 'middle', horizontal: 'right' };

  // Totals: Available Stock
  const tAvail = totRow.getCell(6);
  tAvail.value = sumAvailableStock;
  tAvail.numFmt = '#,##0.00';
  tAvail.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: COLORS.IN_TEXT } };
  tAvail.alignment = { vertical: 'middle', horizontal: 'right' };

  // Totals: Period Inward IN (Green)
  const tIn = totRow.getCell(7);
  tIn.value = sumPeriodIn;
  tIn.numFmt = '#,##0.00';
  tIn.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: COLORS.IN_TEXT } };
  tIn.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.IN_FILL } };
  tIn.alignment = { vertical: 'middle', horizontal: 'right' };

  // Totals: Period Outward OUT (Red)
  const tOut = totRow.getCell(8);
  tOut.value = sumPeriodOut;
  tOut.numFmt = '#,##0.00';
  tOut.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: COLORS.OUT_TEXT } };
  tOut.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.OUT_FILL } };
  tOut.alignment = { vertical: 'middle', horizontal: 'right' };

  // Totals: Total Valuation
  const tVal = totRow.getCell(9);
  tVal.value = sumValuation;
  tVal.numFmt = '₹#,##0.00';
  tVal.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: COLORS.NAVY_HEADER } };
  tVal.alignment = { vertical: 'middle', horizontal: 'right' };

  // Totals: Date Column Sums
  matrixDates.forEach((_, dIdx) => {
    const colNum = 10 + dIdx;
    const c = totRow.getCell(colNum);
    const inTot = dateInSums[dIdx];
    const outTot = dateOutSums[dIdx];
    if (inTot > 0 && outTot > 0) {
      c.value = `+${inTot} / -${outTot}`;
      c.font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: COLORS.BOTH_TEXT } };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.BOTH_FILL } };
    } else if (inTot > 0) {
      c.value = inTot;
      c.numFmt = '#,##0.00';
      c.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: COLORS.IN_TEXT } };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.IN_FILL } };
    } else if (outTot > 0) {
      c.value = outTot;
      c.numFmt = '#,##0.00';
      c.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: COLORS.OUT_TEXT } };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.OUT_FILL } };
    } else {
      c.value = '—';
      c.font = { name: 'Segoe UI', size: 9, color: { argb: COLORS.MUTED_TEXT } };
    }
    c.alignment = { vertical: 'middle', horizontal: 'center' };
  });

  totRow.eachCell({ includeEmpty: true }, (cell) => {
    cell.border = BORDERS.totals;
    if (!cell.fill) {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.TOTALS_BG } };
    }
  });

  // ──────────────────────────────────────────────────────────────────────────
  // SHEET 2: PO SUPPLIER INVOICE DATE AUDIT SHEET
  // ──────────────────────────────────────────────────────────────────────────
  const inwardTxs = allTransactions.filter(t => t.flow === 'IN');
  if (inwardTxs.length > 0) {
    const wsInv = workbook.addWorksheet('PO Supplier Invoice Audit', {
      views: [{ showGridLines: true }]
    });

    // Title Banners
    wsInv.mergeCells('A1:P1');
    const rInv1 = wsInv.getCell('A1');
    rInv1.value = 'PO SUPPLIER INVOICE AUDIT & INWARD RECONCILIATION';
    rInv1.font = { name: 'Segoe UI', size: 14, bold: true, color: { argb: COLORS.WHITE } };
    rInv1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.NAVY_HEADER } };
    rInv1.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    wsInv.getRow(1).height = 30;

    wsInv.mergeCells('A2:P2');
    const rInv2 = wsInv.getCell('A2');
    rInv2.value = `Tracking PO Supplier Invoice Dates (e.g. 15 Oct 2026), Gate Delivery Records & Vendor Compliance • Receipts: ${inwardTxs.length}`;
    rInv2.font = { name: 'Segoe UI', size: 9.5, italic: true, color: { argb: 'FFE2E8F0' } };
    rInv2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.INDIGO_BANNER } };
    rInv2.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    wsInv.getRow(2).height = 22;

    wsInv.getRow(3).height = 8;

    // Headers
    const invHdrRow = wsInv.getRow(4);
    invHdrRow.height = 26;
    const invCols = [
      { title: 'Movement Date', width: 14, align: 'center' },
      { title: 'Supplier Invoice Date', width: 20, align: 'center' },
      { title: 'Supplier Invoice No', width: 18, align: 'left' },
      { title: 'RM Code', width: 14, align: 'center' },
      { title: 'Raw Material Name', width: 28, align: 'left' },
      { title: 'Category', width: 20, align: 'left' },
      { title: 'Inward Quantity (IN)', width: 18, align: 'right' },
      { title: 'UOM', width: 8, align: 'center' },
      { title: 'PO Reference', width: 16, align: 'center' },
      { title: 'GRN Reference', width: 16, align: 'center' },
      { title: 'Batch / Lot Number', width: 22, align: 'center' },
      { title: 'Unit Rate (₹)', width: 14, align: 'right' },
      { title: 'Item Total (₹)', width: 16, align: 'right' },
      { title: 'Quality Status', width: 16, align: 'center' },
      { title: 'Supplier / Vendor', width: 26, align: 'left' },
      { title: 'Received By', width: 16, align: 'left' }
    ];

    invCols.forEach((col, cIdx) => {
      const cell = invHdrRow.getCell(cIdx + 1);
      cell.value = col.title;
      cell.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: COLORS.WHITE } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.TABLE_HEADER } };
      cell.alignment = { vertical: 'middle', horizontal: col.align };
      cell.border = BORDERS.header;
      wsInv.getColumn(cIdx + 1).width = col.width;
    });

    // Rows
    let invRowIdx = 5;
    let sumInQty = 0;
    let sumInVal = 0;

    inwardTxs.forEach((tx, tIdx) => {
      const row = wsInv.getRow(invRowIdx);
      row.height = 22;
      const isEven = tIdx % 2 === 0;
      const defaultBg = isEven ? 'FFFFFFFF' : 'FFF8FAFC';
      const q = Number(tx.quantity || 0);
      const a = Number(tx.amount || 0);
      sumInQty += q;
      sumInVal += a;

      const formattedInvDate = tx.supplierInvoiceDate ? formatShortDate(tx.supplierInvoiceDate) : (tx.date ? formatShortDate(tx.date) : '—');

      row.getCell(1).value = formatShortDate(tx.date);
      row.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };

      // Highlight Supplier Invoice Date
      const cInvDate = row.getCell(2);
      cInvDate.value = formattedInvDate;
      cInvDate.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: COLORS.INV_BADGE_TEXT } };
      cInvDate.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.INV_BADGE_FILL } };
      cInvDate.alignment = { vertical: 'middle', horizontal: 'center' };

      row.getCell(3).value = tx.supplierInvoiceNo || '—';
      row.getCell(4).value = tx.rawMaterialCode || '—';
      row.getCell(4).font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: 'FF0284C7' } };
      row.getCell(4).alignment = { vertical: 'middle', horizontal: 'center' };

      row.getCell(5).value = tx.rawMaterialName || '—';
      row.getCell(5).font = { name: 'Segoe UI', size: 9.5, bold: true };
      row.getCell(6).value = tx.category || '—';

      // Inward Qty (GREEN)
      const cQty = row.getCell(7);
      cQty.value = q;
      cQty.numFmt = '#,##0.00';
      cQty.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: COLORS.IN_TEXT } };
      cQty.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.IN_FILL } };
      cQty.alignment = { vertical: 'middle', horizontal: 'right' };

      row.getCell(8).value = cleanUOM(tx.uom);
      row.getCell(8).alignment = { vertical: 'middle', horizontal: 'center' };

      row.getCell(9).value = tx.poReferenceNo || tx.referenceNo || '—';
      row.getCell(9).alignment = { vertical: 'middle', horizontal: 'center' };
      row.getCell(10).value = tx.grnId || tx.referenceNo || '—';
      row.getCell(10).alignment = { vertical: 'middle', horizontal: 'center' };
      row.getCell(11).value = tx.batchNumber || '—';
      row.getCell(11).alignment = { vertical: 'middle', horizontal: 'center' };

      row.getCell(12).value = Number(tx.rate || 0);
      row.getCell(12).numFmt = '₹#,##0.00';
      row.getCell(12).alignment = { vertical: 'middle', horizontal: 'right' };

      row.getCell(13).value = a;
      row.getCell(13).numFmt = '₹#,##0.00';
      row.getCell(13).font = { name: 'Segoe UI', size: 9.5, bold: true };
      row.getCell(13).alignment = { vertical: 'middle', horizontal: 'right' };

      row.getCell(14).value = tx.isLabRejected ? '❌ LAB REJECTED' : (tx.labStatus || 'PASSED');
      row.getCell(14).alignment = { vertical: 'middle', horizontal: 'center' };

      row.getCell(15).value = tx.partyName || '—';
      row.getCell(16).value = tx.user || '—';

      row.eachCell({ includeEmpty: true }, (cell, idx) => {
        cell.border = BORDERS.thin;
        if (idx !== 2 && idx !== 7) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: defaultBg } };
        }
      });

      invRowIdx++;
    });

    // Totals Row
    const invTotRow = wsInv.getRow(invRowIdx);
    invTotRow.height = 24;
    wsInv.mergeCells(`A${invRowIdx}:F${invRowIdx}`);
    const tInvLbl = invTotRow.getCell(1);
    tInvLbl.value = `TOTAL INWARD RECEIPTS (${inwardTxs.length})`;
    tInvLbl.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: COLORS.NAVY_HEADER } };
    tInvLbl.alignment = { vertical: 'middle', horizontal: 'right', indent: 1 };

    const tInvQ = invTotRow.getCell(7);
    tInvQ.value = sumInQty;
    tInvQ.numFmt = '#,##0.00';
    tInvQ.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: COLORS.IN_TEXT } };
    tInvQ.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.IN_FILL } };
    tInvQ.alignment = { vertical: 'middle', horizontal: 'right' };

    const tInvA = invTotRow.getCell(13);
    tInvA.value = sumInVal;
    tInvA.numFmt = '₹#,##0.00';
    tInvA.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: COLORS.NAVY_HEADER } };
    tInvA.alignment = { vertical: 'middle', horizontal: 'right' };

    invTotRow.eachCell({ includeEmpty: true }, (cell) => {
      cell.border = BORDERS.totals;
      if (!cell.fill) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.TOTALS_BG } };
      }
    });

    autoFitWorksheet(wsInv, 10, 35);
  }

  // Generate Buffer & Trigger Browser Download
  const fileName = getFormattedExportFileName('RM_Stock_InOut_Matrix', period, 'xlsx');
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

/**
 * ══════════════════════════════════════════════════════════════════════════════
 * 2. EXPORT COMPLETE ENTERPRISE MASTER WORKBOOK (6 BEAUTIFUL SHEETS)
 * ══════════════════════════════════════════════════════════════════════════════
 */
export async function exportCompleteEnterpriseWorkbookToExcel({
  materials = [],
  matrixDates = [],
  matrixData = {},
  period = 'all',
  allTransactions = []
}) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Manufacturing ERP System';
  workbook.lastModifiedBy = 'ERP User';
  workbook.created = new Date();
  workbook.modified = new Date();

  // 1. SHEET 1: Stock In-Out Movement Matrix (Green IN & Red OUT)
  const wsMatrix = workbook.addWorksheet('1. Stock In-Out Matrix', {
    views: [{ state: 'frozen', xSplit: 2, ySplit: 5, showGridLines: true }]
  });
  const totalCols = 9 + Math.max(1, matrixDates.length);
  addMatrixHeaderBanners(wsMatrix, totalCols, period, materials.length, matrixDates.length);

  // Row 5: Headers
  const hRow = wsMatrix.getRow(5);
  hRow.height = 28;
  const staticHdrs = [
    { title: 'RM Code', width: 14, align: 'center', hdrColor: COLORS.TABLE_HEADER },
    { title: 'Raw Material Name', width: 30, align: 'left', hdrColor: COLORS.TABLE_HEADER },
    { title: 'Category', width: 22, align: 'left', hdrColor: COLORS.TABLE_HEADER },
    { title: 'UOM', width: 9, align: 'center', hdrColor: COLORS.TABLE_HEADER },
    { title: 'TotalStock', width: 14, align: 'right', hdrColor: COLORS.TABLE_HEADER },
    { title: 'Available Stock', width: 16, align: 'right', hdrColor: COLORS.ACCENT_GREEN_HDR },
    { title: `Period Inward IN (${period})`, width: 22, align: 'right', hdrColor: COLORS.IN_HDR },
    { title: `Period Outward OUT (${period})`, width: 22, align: 'right', hdrColor: COLORS.OUT_HDR },
    { title: 'Total Valuation (₹)', width: 18, align: 'right', hdrColor: COLORS.TABLE_HEADER }
  ];

  staticHdrs.forEach((h, idx) => {
    const cell = hRow.getCell(idx + 1);
    cell.value = h.title;
    cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: COLORS.WHITE } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: h.hdrColor } };
    cell.alignment = { vertical: 'middle', horizontal: h.align, wrapText: true };
    cell.border = BORDERS.header;
    wsMatrix.getColumn(idx + 1).width = h.width;
  });

  matrixDates.forEach((dateStr, dIdx) => {
    const colNum = 10 + dIdx;
    const cell = hRow.getCell(colNum);
    cell.value = dateStr;
    cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: COLORS.WHITE } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.DATE_HEADER } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = BORDERS.header;
    wsMatrix.getColumn(colNum).width = 16;
  });

  // Rows for Sheet 1
  let mRowIdx = 6;
  materials.forEach((mat, mIdx) => {
    const row = wsMatrix.getRow(mRowIdx);
    row.height = 22;
    const cur = Number(mat.currentStock || 0);
    const wip = Number(mat.inProgressStock || 0);
    const free = mat.availableStock !== undefined ? Number(mat.availableStock) : Math.max(0, cur - wip);
    const pIn = Number(mat.periodInQty || 0);
    const pOut = Number(mat.periodOutQty || 0);
    const val = Number(mat.valuation || 0);
    const isEven = mIdx % 2 === 0;
    const defaultBg = isEven ? 'FFFFFFFF' : 'FFF8FAFC';

    row.getCell(1).value = mat.code || '—';
    row.getCell(1).font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: 'FF0284C7' } };
    row.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };

    row.getCell(2).value = mat.name || '—';
    row.getCell(2).font = { name: 'Segoe UI', size: 9.5, bold: true };
    row.getCell(3).value = mat.category || '—';
    row.getCell(4).value = cleanUOM(mat.uom);
    row.getCell(4).alignment = { vertical: 'middle', horizontal: 'center' };

    row.getCell(5).value = cur;
    row.getCell(5).numFmt = '#,##0.00';
    row.getCell(5).font = { name: 'Segoe UI', size: 9.5, bold: true };
    row.getCell(5).alignment = { vertical: 'middle', horizontal: 'right' };

    row.getCell(6).value = free;
    row.getCell(6).numFmt = '#,##0.00';
    row.getCell(6).font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: COLORS.IN_TEXT } };
    row.getCell(6).alignment = { vertical: 'middle', horizontal: 'right' };

    // Inward IN
    const cIn = row.getCell(7);
    cIn.value = pIn;
    cIn.numFmt = '#,##0.00';
    cIn.alignment = { vertical: 'middle', horizontal: 'right' };
    if (pIn > 0) {
      cIn.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: COLORS.IN_TEXT } };
      cIn.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.IN_FILL } };
    }

    // Outward OUT
    const cOut = row.getCell(8);
    cOut.value = pOut;
    cOut.numFmt = '#,##0.00';
    cOut.alignment = { vertical: 'middle', horizontal: 'right' };
    if (pOut > 0) {
      cOut.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: COLORS.OUT_TEXT } };
      cOut.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.OUT_FILL } };
    }

    row.getCell(9).value = val;
    row.getCell(9).numFmt = '₹#,##0.00';
    row.getCell(9).font = { name: 'Segoe UI', size: 9.5, bold: true };
    row.getCell(9).alignment = { vertical: 'middle', horizontal: 'right' };

    matrixDates.forEach((dStr, dIdx) => {
      const colNum = 10 + dIdx;
      const cell = row.getCell(colNum);
      const cData = matrixData[mat.id]?.[dStr] || { inQty: 0, outQty: 0, transactions: [] };
      const hasIn = cData.inQty > 0;
      const hasOut = cData.outQty > 0;

      if (hasIn && hasOut) {
        cell.value = `+${cData.inQty} / -${cData.outQty}`;
        cell.font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: COLORS.BOTH_TEXT } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.BOTH_FILL } };
      } else if (hasIn) {
        cell.value = Number(cData.inQty);
        cell.numFmt = '#,##0.00';
        cell.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: COLORS.IN_TEXT } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.IN_FILL } };
      } else if (hasOut) {
        cell.value = Number(cData.outQty);
        cell.numFmt = '#,##0.00';
        cell.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: COLORS.OUT_TEXT } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.OUT_FILL } };
      } else {
        cell.value = '—';
        cell.font = { name: 'Segoe UI', size: 9, color: { argb: 'FFCBD5E1' } };
      }
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = BORDERS.thin;
    });

    row.eachCell({ includeEmpty: true }, (c, idx) => {
      c.border = BORDERS.thin;
      if (idx < 10 && idx !== 7 && idx !== 8) {
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: defaultBg } };
      }
    });

    mRowIdx++;
  });

  // 2. SHEET 2: Master Summary Sheet
  const wsSum = workbook.addWorksheet('2. RM Stock Summary', {
    views: [{ showGridLines: true }]
  });
  wsSum.mergeCells('A1:O1');
  wsSum.getCell('A1').value = 'RAW MATERIAL MASTER STOCK SUMMARY';
  wsSum.getCell('A1').font = { name: 'Segoe UI', size: 13, bold: true, color: { argb: COLORS.WHITE } };
  wsSum.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.NAVY_HEADER } };
  wsSum.getRow(1).height = 28;

  const sumHeaders = [
    'RM Code', 'Raw Material Name', 'Category', 'UOM',
    'Total Stock', 'In-Progress WIP', 'Available Stock',
    'Period Inward IN', 'Period Outward OUT', 'Net Movement',
    'Standard Rate (₹)', 'Total Valuation (₹)', 'Latest PO', 'Latest Batch', 'QC Status'
  ];
  const sHdrRow = wsSum.getRow(3);
  sHdrRow.height = 24;
  sumHeaders.forEach((sh, idx) => {
    const c = sHdrRow.getCell(idx + 1);
    c.value = sh;
    c.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: COLORS.WHITE } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.TABLE_HEADER } };
    c.alignment = { vertical: 'middle', horizontal: 'center' };
    c.border = BORDERS.header;
  });

  let sRowIdx = 4;
  materials.forEach((mat, mIdx) => {
    const row = wsSum.getRow(sRowIdx);
    row.height = 20;
    const cur = Number(mat.currentStock || 0);
    const wip = Number(mat.inProgressStock || 0);
    const free = mat.availableStock !== undefined ? Number(mat.availableStock) : Math.max(0, cur - wip);
    const pIn = Number(mat.periodInQty || 0);
    const pOut = Number(mat.periodOutQty || 0);
    const net = pIn - pOut;
    const val = Number(mat.valuation || 0);
    const isEven = mIdx % 2 === 0;
    const bg = isEven ? 'FFFFFFFF' : 'FFF8FAFC';

    row.getCell(1).value = mat.code || '—';
    row.getCell(2).value = mat.name || '—';
    row.getCell(3).value = mat.category || '—';
    row.getCell(4).value = cleanUOM(mat.uom);
    row.getCell(5).value = cur;
    row.getCell(6).value = wip;
    row.getCell(7).value = free;

    // IN in Green
    const cIn = row.getCell(8);
    cIn.value = pIn;
    if (pIn > 0) {
      cIn.font = { bold: true, color: { argb: COLORS.IN_TEXT } };
      cIn.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.IN_FILL } };
    }

    // OUT in Red
    const cOut = row.getCell(9);
    cOut.value = pOut;
    if (pOut > 0) {
      cOut.font = { bold: true, color: { argb: COLORS.OUT_TEXT } };
      cOut.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.OUT_FILL } };
    }

    // Net Movement
    const cNet = row.getCell(10);
    cNet.value = net;
    if (net > 0) {
      cNet.font = { bold: true, color: { argb: COLORS.IN_TEXT } };
      cNet.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.IN_FILL } };
    } else if (net < 0) {
      cNet.font = { bold: true, color: { argb: COLORS.OUT_TEXT } };
      cNet.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.OUT_FILL } };
    }

    row.getCell(11).value = Number(mat.ratePerUnit || 0);
    row.getCell(12).value = val;
    row.getCell(13).value = mat.poReferenceNo || '—';
    row.getCell(14).value = mat.lastIn?.batch || mat.lastOut?.ref || '—';
    row.getCell(15).value = mat.hasLabRejection ? '❌ LAB REJECTED' : 'QC PASSED';

    row.eachCell({ includeEmpty: true }, (c, idx) => {
      c.border = BORDERS.thin;
      if (idx !== 8 && idx !== 9 && idx !== 10) {
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
      }
    });

    sRowIdx++;
  });
  autoFitWorksheet(wsSum, 10, 35);

  // 3. SHEET 3: Chronological Date-Wise Ledger (Flow Green IN / Red OUT)
  const wsLedger = workbook.addWorksheet('3. Chronological Ledger', {
    views: [{ showGridLines: true }]
  });
  wsLedger.mergeCells('A1:Q1');
  wsLedger.getCell('A1').value = 'CHRONOLOGICAL RAW MATERIAL IN-OUT AUDIT LEDGER';
  wsLedger.getCell('A1').font = { name: 'Segoe UI', size: 13, bold: true, color: { argb: COLORS.WHITE } };
  wsLedger.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.NAVY_HEADER } };
  wsLedger.getRow(1).height = 28;

  const ledgerHeaders = [
    'Date', 'Flow (IN/OUT)', 'Movement Type', 'RM Code', 'Raw Material Name',
    'Quantity', 'UOM', 'Unit Rate (₹)', 'Amount (₹)', 'Document Ref',
    'PO Reference', 'Supplier Invoice Date', 'Batch / Lot', 'Quality Decision',
    'Party / Supplier / Product', 'Logged User', 'Audit Notes'
  ];
  const lHdrRow = wsLedger.getRow(3);
  lHdrRow.height = 24;
  ledgerHeaders.forEach((lh, idx) => {
    const c = lHdrRow.getCell(idx + 1);
    c.value = lh;
    c.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: COLORS.WHITE } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.TABLE_HEADER } };
    c.alignment = { vertical: 'middle', horizontal: 'center' };
    c.border = BORDERS.header;
  });

  let lRowIdx = 4;
  allTransactions.forEach((tx, tIdx) => {
    const row = wsLedger.getRow(lRowIdx);
    row.height = 20;
    const isEven = tIdx % 2 === 0;
    const bg = isEven ? 'FFFFFFFF' : 'FFF8FAFC';
    const isIN = tx.flow === 'IN';
    const q = Number(tx.quantity || 0);

    row.getCell(1).value = formatShortDate(tx.date);

    // Flow Column: Green for IN, Red for OUT
    const cFlow = row.getCell(2);
    cFlow.value = tx.flow;
    cFlow.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: isIN ? COLORS.IN_TEXT : COLORS.OUT_TEXT } };
    cFlow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: isIN ? COLORS.IN_FILL : COLORS.OUT_FILL } };
    cFlow.alignment = { vertical: 'middle', horizontal: 'center' };

    row.getCell(3).value = tx.typeLabel || tx.type || '—';
    row.getCell(4).value = tx.rawMaterialCode || '—';
    row.getCell(5).value = tx.rawMaterialName || '—';

    // Quantity Column: Green for IN, Red for OUT
    const cQ = row.getCell(6);
    cQ.value = isIN ? q : -q;
    cQ.numFmt = '#,##0.00';
    cQ.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: isIN ? COLORS.IN_TEXT : COLORS.OUT_TEXT } };
    cQ.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: isIN ? COLORS.IN_FILL : COLORS.OUT_FILL } };
    cQ.alignment = { vertical: 'middle', horizontal: 'right' };

    row.getCell(7).value = cleanUOM(tx.uom);
    row.getCell(8).value = Number(tx.rate || 0);
    row.getCell(9).value = Number(tx.amount || 0);
    row.getCell(10).value = tx.referenceNo || '—';
    row.getCell(11).value = tx.poReferenceNo || '—';

    // Supplier Invoice Date
    const cInv = row.getCell(12);
    cInv.value = tx.supplierInvoiceDate ? formatShortDate(tx.supplierInvoiceDate) : '—';
    if (tx.supplierInvoiceDate) {
      cInv.font = { bold: true, color: { argb: COLORS.INV_BADGE_TEXT } };
      cInv.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.INV_BADGE_FILL } };
    }

    row.getCell(13).value = tx.batchNumber || '—';
    row.getCell(14).value = tx.isLabRejected ? '❌ LAB REJECTED' : (tx.labStatus || 'PASSED');
    row.getCell(15).value = tx.partyName || '—';
    row.getCell(16).value = tx.user || '—';
    row.getCell(17).value = tx.notes || '—';

    row.eachCell({ includeEmpty: true }, (c, idx) => {
      c.border = BORDERS.thin;
      if (idx !== 2 && idx !== 6 && (idx !== 12 || !tx.supplierInvoiceDate)) {
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
      }
    });

    lRowIdx++;
  });
  autoFitWorksheet(wsLedger, 10, 35);

  // Generate Buffer & Trigger Browser Download
  const fileName = getFormattedExportFileName('RM_InOut_Enterprise_Master', period, 'xlsx');
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

/**
 * ══════════════════════════════════════════════════════════════════════════════
 * 3. EXPORT RAW MATERIAL MASTER SUMMARY TO EXCEL (WITH GREEN IN & RED OUT)
 * ══════════════════════════════════════════════════════════════════════════════
 */
export async function exportMasterSummaryToExcel({
  materials = [],
  period = 'all'
}) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Manufacturing ERP System';
  workbook.lastModifiedBy = 'ERP User';
  workbook.created = new Date();
  workbook.modified = new Date();

  const ws = workbook.addWorksheet('RM Stock Summary', {
    views: [{ state: 'frozen', xSplit: 2, ySplit: 5, showGridLines: true }]
  });

  const now = new Date();
  const subtitle = `Manufacturing Master Stock Summary • Period: ${(period || 'all').toUpperCase()} • Materials: ${materials.length} • Generated: ${now.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}`;
  addStandardHeaderBanners(ws, 15, 'RAW MATERIAL MASTER STOCK SUMMARY REPORT', subtitle);

  // Row 5: Column Headers
  const headerRow = ws.getRow(5);
  headerRow.height = 28;

  const headers = [
    { title: 'RM Code', width: 14, align: 'center', hdrColor: COLORS.TABLE_HEADER },
    { title: 'Raw Material Name', width: 30, align: 'left', hdrColor: COLORS.TABLE_HEADER },
    { title: 'Category', width: 22, align: 'left', hdrColor: COLORS.TABLE_HEADER },
    { title: 'UOM', width: 9, align: 'center', hdrColor: COLORS.TABLE_HEADER },
    { title: 'Total Current Stock', width: 18, align: 'right', hdrColor: COLORS.TABLE_HEADER },
    { title: 'In-Progress Floor WIP', width: 20, align: 'right', hdrColor: 'FFD97706' },
    { title: 'Free Available Stock', width: 18, align: 'right', hdrColor: 'FF059669' },
    { title: `Period Inward IN (${(period || 'all').toUpperCase()})`, width: 24, align: 'right', hdrColor: COLORS.IN_HDR },
    { title: `Period Outward OUT (${(period || 'all').toUpperCase()})`, width: 24, align: 'right', hdrColor: COLORS.OUT_HDR },
    { title: 'Net Movement', width: 16, align: 'right', hdrColor: COLORS.TABLE_HEADER },
    { title: 'Standard Rate (₹)', width: 16, align: 'right', hdrColor: COLORS.TABLE_HEADER },
    { title: 'Total Valuation (₹)', width: 18, align: 'right', hdrColor: COLORS.TABLE_HEADER },
    { title: 'Latest PO Ref', width: 18, align: 'center', hdrColor: COLORS.TABLE_HEADER },
    { title: 'Latest Batch / Ref', width: 20, align: 'center', hdrColor: COLORS.TABLE_HEADER },
    { title: 'Quality Decision', width: 18, align: 'center', hdrColor: COLORS.TABLE_HEADER }
  ];

  headers.forEach((h, idx) => {
    const colNum = idx + 1;
    const cell = headerRow.getCell(colNum);
    cell.value = h.title;
    cell.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: COLORS.WHITE } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: h.hdrColor } };
    cell.alignment = { vertical: 'middle', horizontal: h.align, wrapText: true };
    cell.border = BORDERS.header;
    ws.getColumn(colNum).width = h.width;
  });

  // Data Rows
  let curRowIdx = 6;
  let sumTotalStock = 0;
  let sumWipStock = 0;
  let sumAvailableStock = 0;
  let sumPeriodIn = 0;
  let sumPeriodOut = 0;
  let sumValuation = 0;

  materials.forEach((mat, mIdx) => {
    const row = ws.getRow(curRowIdx);
    row.height = 22;

    const cur = Number(mat.currentStock || 0);
    const wip = Number(mat.inProgressStock || 0);
    const free = mat.availableStock !== undefined ? Number(mat.availableStock) : Math.max(0, cur - wip);
    const pIn = Number(mat.periodInQty || 0);
    const pOut = Number(mat.periodOutQty || 0);
    const net = pIn - pOut;
    const val = Number(mat.valuation || 0);
    const uomStr = cleanUOM(mat.uom);

    sumTotalStock += cur;
    sumWipStock += wip;
    sumAvailableStock += free;
    sumPeriodIn += pIn;
    sumPeriodOut += pOut;
    sumValuation += val;

    const isEven = mIdx % 2 === 0;
    const defaultBg = isEven ? 'FFFFFFFF' : 'FFF8FAFC';

    // 1. RM Code
    const cCode = row.getCell(1);
    cCode.value = mat.code || '—';
    cCode.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: 'FF0284C7' } };
    cCode.alignment = { vertical: 'middle', horizontal: 'center' };

    // 2. Name
    const cName = row.getCell(2);
    cName.value = mat.name || '—';
    cName.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: COLORS.TEXT_MAIN } };
    cName.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };

    // 3. Category
    row.getCell(3).value = mat.category || '—';
    row.getCell(3).alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };

    // 4. UOM
    row.getCell(4).value = uomStr;
    row.getCell(4).alignment = { vertical: 'middle', horizontal: 'center' };

    // 5. Total Stock
    const cTot = row.getCell(5);
    cTot.value = cur;
    cTot.numFmt = '#,##0.00';
    cTot.font = { name: 'Segoe UI', size: 9.5, bold: true };
    cTot.alignment = { vertical: 'middle', horizontal: 'right' };

    // 6. In-Progress Floor WIP
    const cWip = row.getCell(6);
    cWip.value = wip;
    cWip.numFmt = '#,##0.00';
    cWip.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: wip > 0 ? 'FFD97706' : COLORS.MUTED_TEXT } };
    cWip.alignment = { vertical: 'middle', horizontal: 'right' };

    // 7. Free Available Stock
    const cAvail = row.getCell(7);
    cAvail.value = free;
    cAvail.numFmt = '#,##0.00';
    cAvail.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: COLORS.IN_TEXT } };
    cAvail.alignment = { vertical: 'middle', horizontal: 'right' };

    // 8. Period Inward IN (GREEN)
    const cIn = row.getCell(8);
    cIn.value = pIn;
    cIn.numFmt = '#,##0.00';
    cIn.alignment = { vertical: 'middle', horizontal: 'right' };
    if (pIn > 0) {
      cIn.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: COLORS.IN_TEXT } };
      cIn.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.IN_FILL } };
      cIn.border = {
        top: { style: 'thin', color: { argb: COLORS.IN_BORDER } },
        bottom: { style: 'thin', color: { argb: COLORS.IN_BORDER } },
        left: { style: 'thin', color: { argb: COLORS.IN_BORDER } },
        right: { style: 'thin', color: { argb: COLORS.IN_BORDER } }
      };
    } else {
      cIn.font = { name: 'Segoe UI', size: 9, color: { argb: COLORS.MUTED_TEXT } };
    }

    // 9. Period Outward OUT (RED)
    const cOut = row.getCell(9);
    cOut.value = pOut;
    cOut.numFmt = '#,##0.00';
    cOut.alignment = { vertical: 'middle', horizontal: 'right' };
    if (pOut > 0) {
      cOut.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: COLORS.OUT_TEXT } };
      cOut.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.OUT_FILL } };
      cOut.border = {
        top: { style: 'thin', color: { argb: COLORS.OUT_BORDER } },
        bottom: { style: 'thin', color: { argb: COLORS.OUT_BORDER } },
        left: { style: 'thin', color: { argb: COLORS.OUT_BORDER } },
        right: { style: 'thin', color: { argb: COLORS.OUT_BORDER } }
      };
    } else {
      cOut.font = { name: 'Segoe UI', size: 9, color: { argb: COLORS.MUTED_TEXT } };
    }

    // 10. Net Movement (Green if > 0, Red if < 0)
    const cNet = row.getCell(10);
    cNet.value = net;
    cNet.numFmt = '#,##0.00';
    cNet.alignment = { vertical: 'middle', horizontal: 'right' };
    if (net > 0) {
      cNet.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: COLORS.IN_TEXT } };
      cNet.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.IN_FILL } };
    } else if (net < 0) {
      cNet.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: COLORS.OUT_TEXT } };
      cNet.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.OUT_FILL } };
    } else {
      cNet.font = { name: 'Segoe UI', size: 9, color: { argb: COLORS.MUTED_TEXT } };
    }

    // 11. Standard Rate (₹)
    const cRate = row.getCell(11);
    cRate.value = Number(mat.ratePerUnit || 0);
    cRate.numFmt = '₹#,##0.00';
    cRate.alignment = { vertical: 'middle', horizontal: 'right' };

    // 12. Total Valuation (₹)
    const cVal = row.getCell(12);
    cVal.value = val;
    cVal.numFmt = '₹#,##0.00';
    cVal.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: COLORS.TEXT_MAIN } };
    cVal.alignment = { vertical: 'middle', horizontal: 'right' };

    // 13. Latest PO
    row.getCell(13).value = mat.poReferenceNo || '—';
    row.getCell(13).alignment = { vertical: 'middle', horizontal: 'center' };

    // 14. Latest Batch
    row.getCell(14).value = mat.lastIn?.batch || mat.lastOut?.ref || '—';
    row.getCell(14).alignment = { vertical: 'middle', horizontal: 'center' };

    // 15. QC Status
    row.getCell(15).value = mat.hasLabRejection ? '❌ LAB REJECTED' : 'QC PASSED';
    row.getCell(15).alignment = { vertical: 'middle', horizontal: 'center' };

    row.eachCell({ includeEmpty: true }, (c, idx) => {
      c.border = BORDERS.thin;
      if (idx !== 8 && idx !== 9 && (idx !== 10 || net === 0)) {
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: defaultBg } };
      }
    });

    curRowIdx++;
  });

  // Grand Totals Summary Row
  const totRow = ws.getRow(curRowIdx);
  totRow.height = 26;

  ws.mergeCells(`A${curRowIdx}:D${curRowIdx}`);
  const cTotLabel = totRow.getCell(1);
  cTotLabel.value = `GRAND TOTALS (${materials.length} RAW MATERIALS)`;
  cTotLabel.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: COLORS.NAVY_HEADER } };
  cTotLabel.alignment = { vertical: 'middle', horizontal: 'right', indent: 1 };

  totRow.getCell(5).value = sumTotalStock;
  totRow.getCell(5).numFmt = '#,##0.00';
  totRow.getCell(5).font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: COLORS.NAVY_HEADER } };
  totRow.getCell(5).alignment = { vertical: 'middle', horizontal: 'right' };

  totRow.getCell(6).value = sumWipStock;
  totRow.getCell(6).numFmt = '#,##0.00';
  totRow.getCell(6).font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFD97706' } };
  totRow.getCell(6).alignment = { vertical: 'middle', horizontal: 'right' };

  totRow.getCell(7).value = sumAvailableStock;
  totRow.getCell(7).numFmt = '#,##0.00';
  totRow.getCell(7).font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: COLORS.IN_TEXT } };
  totRow.getCell(7).alignment = { vertical: 'middle', horizontal: 'right' };

  // Totals: IN in Green
  const tIn = totRow.getCell(8);
  tIn.value = sumPeriodIn;
  tIn.numFmt = '#,##0.00';
  tIn.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: COLORS.IN_TEXT } };
  tIn.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.IN_FILL } };
  tIn.alignment = { vertical: 'middle', horizontal: 'right' };

  // Totals: OUT in Red
  const tOut = totRow.getCell(9);
  tOut.value = sumPeriodOut;
  tOut.numFmt = '#,##0.00';
  tOut.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: COLORS.OUT_TEXT } };
  tOut.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.OUT_FILL } };
  tOut.alignment = { vertical: 'middle', horizontal: 'right' };

  // Net Movement
  const netTotal = sumPeriodIn - sumPeriodOut;
  const tNet = totRow.getCell(10);
  tNet.value = netTotal;
  tNet.numFmt = '#,##0.00';
  tNet.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: netTotal >= 0 ? COLORS.IN_TEXT : COLORS.OUT_TEXT } };
  tNet.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: netTotal >= 0 ? COLORS.IN_FILL : COLORS.OUT_FILL } };
  tNet.alignment = { vertical: 'middle', horizontal: 'right' };

  totRow.getCell(12).value = sumValuation;
  totRow.getCell(12).numFmt = '₹#,##0.00';
  totRow.getCell(12).font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: COLORS.NAVY_HEADER } };
  totRow.getCell(12).alignment = { vertical: 'middle', horizontal: 'right' };

  totRow.eachCell({ includeEmpty: true }, (c) => {
    c.border = BORDERS.totals;
    if (!c.fill) {
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.TOTALS_BG } };
    }
  });

  autoFitWorksheet(ws, 10, 36);

  const fileName = getFormattedExportFileName('RM_Stock_Summary', period, 'xlsx');
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

/**
 * ══════════════════════════════════════════════════════════════════════════════
 * 4. EXPORT CHRONOLOGICAL DATE-WISE LEDGER TO EXCEL (WITH GREEN IN & RED OUT)
 * ══════════════════════════════════════════════════════════════════════════════
 */
export async function exportDateWiseLedgerToExcel({
  transactions = [],
  period = 'all'
}) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Manufacturing ERP System';
  workbook.lastModifiedBy = 'ERP User';
  workbook.created = new Date();
  workbook.modified = new Date();

  const ws = workbook.addWorksheet('Chronological Ledger', {
    views: [{ state: 'frozen', xSplit: 2, ySplit: 5, showGridLines: true }]
  });

  const now = new Date();
  const subtitle = `Chronological Raw Material Audit Ledger • Period: ${(period || 'all').toUpperCase()} • Transactions: ${transactions.length} • Generated: ${now.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}`;
  addStandardHeaderBanners(ws, 17, 'CHRONOLOGICAL RAW MATERIAL IN-OUT AUDIT LEDGER', subtitle);

  // Row 5: Column Headers
  const headerRow = ws.getRow(5);
  headerRow.height = 28;

  const headers = [
    { title: 'Movement Date', width: 14, align: 'center', hdrColor: COLORS.TABLE_HEADER },
    { title: 'Flow (IN/OUT)', width: 14, align: 'center', hdrColor: COLORS.TABLE_HEADER },
    { title: 'Movement Type', width: 22, align: 'left', hdrColor: COLORS.TABLE_HEADER },
    { title: 'RM Code', width: 14, align: 'center', hdrColor: COLORS.TABLE_HEADER },
    { title: 'Raw Material Name', width: 28, align: 'left', hdrColor: COLORS.TABLE_HEADER },
    { title: 'Inward Qty (IN)', width: 18, align: 'right', hdrColor: COLORS.IN_HDR },
    { title: 'Outward Qty (OUT)', width: 18, align: 'right', hdrColor: COLORS.OUT_HDR },
    { title: 'UOM', width: 9, align: 'center', hdrColor: COLORS.TABLE_HEADER },
    { title: 'Unit Rate (₹)', width: 14, align: 'right', hdrColor: COLORS.TABLE_HEADER },
    { title: 'Total Amount (₹)', width: 18, align: 'right', hdrColor: COLORS.TABLE_HEADER },
    { title: 'Document Ref', width: 18, align: 'center', hdrColor: COLORS.TABLE_HEADER },
    { title: 'PO Reference', width: 18, align: 'center', hdrColor: COLORS.TABLE_HEADER },
    { title: 'Supplier Invoice Date', width: 20, align: 'center', hdrColor: 'FF3730A3' },
    { title: 'Batch / Lot Number', width: 20, align: 'center', hdrColor: COLORS.TABLE_HEADER },
    { title: 'Quality Decision', width: 18, align: 'center', hdrColor: COLORS.TABLE_HEADER },
    { title: 'Party / Supplier / Product', width: 26, align: 'left', hdrColor: COLORS.TABLE_HEADER },
    { title: 'Logged User', width: 16, align: 'left', hdrColor: COLORS.TABLE_HEADER }
  ];

  headers.forEach((h, idx) => {
    const colNum = idx + 1;
    const cell = headerRow.getCell(colNum);
    cell.value = h.title;
    cell.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: COLORS.WHITE } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: h.hdrColor } };
    cell.alignment = { vertical: 'middle', horizontal: h.align, wrapText: true };
    cell.border = BORDERS.header;
    ws.getColumn(colNum).width = h.width;
  });

  // Data Rows
  let curRowIdx = 6;
  let sumInQty = 0;
  let sumOutQty = 0;
  let sumAmount = 0;

  transactions.forEach((tx, tIdx) => {
    const row = ws.getRow(curRowIdx);
    row.height = 22;

    const isIN = tx.flow === 'IN';
    const q = Number(tx.quantity || 0);
    const amt = Number(tx.amount || 0);
    if (isIN) sumInQty += q;
    else sumOutQty += q;
    sumAmount += amt;

    const isEven = tIdx % 2 === 0;
    const defaultBg = isEven ? 'FFFFFFFF' : 'FFF8FAFC';

    // 1. Date
    row.getCell(1).value = formatShortDate(tx.date);
    row.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };

    // 2. Flow Column (Green for IN, Red for OUT)
    const cFlow = row.getCell(2);
    cFlow.value = tx.flow;
    cFlow.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: isIN ? COLORS.IN_TEXT : COLORS.OUT_TEXT } };
    cFlow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: isIN ? COLORS.IN_FILL : COLORS.OUT_FILL } };
    cFlow.alignment = { vertical: 'middle', horizontal: 'center' };
    cFlow.border = {
      top: { style: 'thin', color: { argb: isIN ? COLORS.IN_BORDER : COLORS.OUT_BORDER } },
      bottom: { style: 'thin', color: { argb: isIN ? COLORS.IN_BORDER : COLORS.OUT_BORDER } },
      left: { style: 'thin', color: { argb: isIN ? COLORS.IN_BORDER : COLORS.OUT_BORDER } },
      right: { style: 'thin', color: { argb: isIN ? COLORS.IN_BORDER : COLORS.OUT_BORDER } }
    };

    // 3. Movement Type
    row.getCell(3).value = tx.typeLabel || tx.type || '—';
    row.getCell(3).alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };

    // 4. RM Code
    const cCode = row.getCell(4);
    cCode.value = tx.rawMaterialCode || '—';
    cCode.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: 'FF0284C7' } };
    cCode.alignment = { vertical: 'middle', horizontal: 'center' };

    // 5. Raw Material Name
    const cName = row.getCell(5);
    cName.value = tx.rawMaterialName || '—';
    cName.font = { name: 'Segoe UI', size: 9.5, bold: true };
    cName.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };

    // 6. Inward Qty (GREEN)
    const cInQ = row.getCell(6);
    if (isIN) {
      cInQ.value = q;
      cInQ.numFmt = '#,##0.00';
      cInQ.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: COLORS.IN_TEXT } };
      cInQ.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.IN_FILL } };
    } else {
      cInQ.value = '—';
      cInQ.font = { name: 'Segoe UI', size: 9, color: { argb: COLORS.MUTED_TEXT } };
    }
    cInQ.alignment = { vertical: 'middle', horizontal: 'right' };

    // 7. Outward Qty (RED)
    const cOutQ = row.getCell(7);
    if (!isIN) {
      cOutQ.value = q;
      cOutQ.numFmt = '#,##0.00';
      cOutQ.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: COLORS.OUT_TEXT } };
      cOutQ.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.OUT_FILL } };
    } else {
      cOutQ.value = '—';
      cOutQ.font = { name: 'Segoe UI', size: 9, color: { argb: COLORS.MUTED_TEXT } };
    }
    cOutQ.alignment = { vertical: 'middle', horizontal: 'right' };

    // 8. UOM
    row.getCell(8).value = cleanUOM(tx.uom);
    row.getCell(8).alignment = { vertical: 'middle', horizontal: 'center' };

    // 9. Unit Rate
    row.getCell(9).value = Number(tx.rate || 0);
    row.getCell(9).numFmt = '₹#,##0.00';
    row.getCell(9).alignment = { vertical: 'middle', horizontal: 'right' };

    // 10. Total Amount
    const cAmt = row.getCell(10);
    cAmt.value = amt;
    cAmt.numFmt = '₹#,##0.00';
    cAmt.font = { name: 'Segoe UI', size: 9.5, bold: true };
    cAmt.alignment = { vertical: 'middle', horizontal: 'right' };

    // 11. Document Ref
    row.getCell(11).value = tx.referenceNo || '—';
    row.getCell(11).alignment = { vertical: 'middle', horizontal: 'center' };

    // 12. PO Reference
    row.getCell(12).value = tx.poReferenceNo || '—';
    row.getCell(12).alignment = { vertical: 'middle', horizontal: 'center' };

    // 13. Supplier Invoice Date (Highlighted Badge)
    const cInv = row.getCell(13);
    cInv.value = tx.supplierInvoiceDate ? formatShortDate(tx.supplierInvoiceDate) : '—';
    if (tx.supplierInvoiceDate) {
      cInv.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: COLORS.INV_BADGE_TEXT } };
      cInv.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.INV_BADGE_FILL } };
    }
    cInv.alignment = { vertical: 'middle', horizontal: 'center' };

    // 14. Batch Number
    row.getCell(14).value = tx.batchNumber || '—';
    row.getCell(14).alignment = { vertical: 'middle', horizontal: 'center' };

    // 15. Quality Decision
    row.getCell(15).value = tx.isLabRejected ? '❌ LAB REJECTED' : (tx.labStatus || 'PASSED');
    row.getCell(15).alignment = { vertical: 'middle', horizontal: 'center' };

    // 16. Party
    row.getCell(16).value = tx.partyName || '—';
    row.getCell(16).alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };

    // 17. User
    row.getCell(17).value = tx.user || '—';
    row.getCell(17).alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };

    row.eachCell({ includeEmpty: true }, (c, idx) => {
      c.border = BORDERS.thin;
      if (idx !== 2 && (idx !== 6 || !isIN) && (idx !== 7 || isIN) && (idx !== 13 || !tx.supplierInvoiceDate)) {
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: defaultBg } };
      }
    });

    curRowIdx++;
  });

  // Grand Totals Summary Row
  const totRow = ws.getRow(curRowIdx);
  totRow.height = 26;

  ws.mergeCells(`A${curRowIdx}:E${curRowIdx}`);
  const cTotLabel = totRow.getCell(1);
  cTotLabel.value = `GRAND TOTALS (${transactions.length} MOVEMENTS)`;
  cTotLabel.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: COLORS.NAVY_HEADER } };
  cTotLabel.alignment = { vertical: 'middle', horizontal: 'right', indent: 1 };

  // Inward Qty Sum (Green)
  const tInQ = totRow.getCell(6);
  tInQ.value = sumInQty;
  tInQ.numFmt = '#,##0.00';
  tInQ.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: COLORS.IN_TEXT } };
  tInQ.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.IN_FILL } };
  tInQ.alignment = { vertical: 'middle', horizontal: 'right' };

  // Outward Qty Sum (Red)
  const tOutQ = totRow.getCell(7);
  tOutQ.value = sumOutQty;
  tOutQ.numFmt = '#,##0.00';
  tOutQ.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: COLORS.OUT_TEXT } };
  tOutQ.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.OUT_FILL } };
  tOutQ.alignment = { vertical: 'middle', horizontal: 'right' };

  // Total Amount Sum
  const tAmt = totRow.getCell(10);
  tAmt.value = sumAmount;
  tAmt.numFmt = '₹#,##0.00';
  tAmt.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: COLORS.NAVY_HEADER } };
  tAmt.alignment = { vertical: 'middle', horizontal: 'right' };

  totRow.eachCell({ includeEmpty: true }, (c) => {
    c.border = BORDERS.totals;
    if (!c.fill) {
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.TOTALS_BG } };
    }
  });

  autoFitWorksheet(ws, 10, 36);

  const fileName = getFormattedExportFileName('RM_Date_InOut_Ledger', period, 'xlsx');
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

