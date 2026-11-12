import { jsPDF } from 'jspdf';
import { round2, formatIndian, toMl, formatCleanUom } from './productionCalculation';

const INR_FMT = (val, dec = 2) => {
  const num = Number(val || 0);
  return `Rs. ${formatIndian(num, dec)}`;
};

const DATE_DMY = (val, fallback = '-') => {
  if (!val) return fallback;
  try {
    const d = new Date(val);
    if (isNaN(d.getTime())) {
      const s = String(val).split('T')[0];
      const parts = s.split('-');
      if (parts.length === 3 && parts[0].length === 4) {
        return `${parts[2]}-${parts[1]}-${parts[0]}`;
      }
      return s || fallback;
    }
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
  } catch {
    return fallback;
  }
};

const safeText = (val, fallback = '-') => {
  if (val === null || val === undefined || val === '') return fallback;
  return String(val)
    .replace(/₹/g, 'Rs. ')
    .replace(/✓/g, 'OK')
    .replace(/•/g, '|')
    .replace(/→/g, '->')
    .replace(/°/g, ' deg ')
    .replace(/–|—/g, '-');
};

/**
 * Generates an aligned, multi-page A4 Vector PDF for the Standard Production Clean Sheet Report.
 * Supports:
 *  - mode: 'full' (complete clean sheet with day-wise production, RM consumption, yield & cost)
 *  - mode: 'datewise' (date-wise / day-wise production, per-product RM batch/qty/expiry, base RM & yield)
 *  - targetDayNo: null | number (optional single date/day filter)
 */
export function exportCleanSheetPdf({
  mode = 'full',
  targetDayNo = null,
  companyDetails = null,
  batch = {},
  summary = {},
  baseRmLines = [],
  dayEntries = [],
  yieldRows = [],
  timelineStages = [],
  canViewCost = true,
  completionNotes = '',
  labTestRequired = false
}) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const PAGE_W = doc.internal.pageSize.getWidth(); // 210
  const PAGE_H = doc.internal.pageSize.getHeight(); // 297
  const MARGIN = 11;
  const CONTENT_W = PAGE_W - MARGIN * 2; // 188mm
  const BOTTOM_SAFE = PAGE_H - 14;

  const COLORS = {
    navy: [15, 23, 42],
    indigo: [67, 56, 202],
    indigoLight: [238, 242, 255],
    emerald: [5, 150, 105],
    emeraldLight: [236, 253, 245],
    amber: [180, 83, 9],
    amberLight: [255, 251, 235],
    rose: [190, 18, 60],
    slateDark: [30, 41, 59],
    slateMid: [71, 85, 105],
    slateMuted: [100, 116, 139],
    border: [203, 213, 225],
    rowAlt: [248, 250, 252],
    white: [255, 255, 255]
  };

  let y = MARGIN;

  const prodNo = safeText(batch?.referenceNo || batch?.reference_no || batch?.batchNo || batch?.batch_no, 'PROD-BATCH');
  const batchNo = safeText(batch?.batchNo || batch?.batch_no || batch?.referenceNo, prodNo);
  const shortCode = safeText(batch?.shortBatchCode || batch?.short_batch_code, '-');
  const companyName = safeText(companyDetails?.companyName, 'Leonex Manufacturing ERP');

  const drawTopChrome = () => {
    doc.setFillColor(...COLORS.navy);
    doc.rect(0, 0, PAGE_W, 4, 'F');
    doc.setFillColor(...COLORS.indigo);
    doc.rect(0, 4, PAGE_W, 1.2, 'F');
  };

  const ensureSpace = (neededH = 18) => {
    if (y + neededH > BOTTOM_SAFE) {
      doc.addPage();
      drawTopChrome();
      y = 11;
      // Compact continuation header
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(...COLORS.indigo);
      doc.text(`${companyName.toUpperCase()} | CLEAN SHEET REPORT`, MARGIN, y);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...COLORS.slateMuted);
      doc.text(`Prod No: ${prodNo} | Batch Code: ${shortCode}`, PAGE_W - MARGIN, y, { align: 'right' });
      y += 2.5;
      doc.setDrawColor(...COLORS.border);
      doc.setLineWidth(0.2);
      doc.line(MARGIN, y, PAGE_W - MARGIN, y);
      y += 4;
    }
  };

  const drawSectionHeading = (badge, title, subtitle = '') => {
    ensureSpace(14);
    y += 1.5;
    doc.setFillColor(...COLORS.indigo);
    doc.roundedRect(MARGIN, y, 5.5, 5.5, 1, 1, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.white);
    doc.text(safeText(badge), MARGIN + 2.75, y + 3.9, { align: 'center' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...COLORS.navy);
    doc.text(safeText(title).toUpperCase(), MARGIN + 8, y + 4);

    if (subtitle) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(...COLORS.slateMuted);
      doc.text(safeText(subtitle), PAGE_W - MARGIN, y + 4, { align: 'right' });
    }
    y += 7;
    doc.setDrawColor(...COLORS.indigo);
    doc.setLineWidth(0.35);
    doc.line(MARGIN, y, PAGE_W - MARGIN, y);
    y += 3;
  };

  /**
   * Reusable perfectly aligned vector table with automatic row wrapping & page breaks.
   * cols: [{ label, width, align: 'left'|'right'|'center' }] (sum of widths should equal CONTENT_W = 188)
   */
  const drawTable = (cols, rows, footerRow = null, options = {}) => {
    const fontSize = options.fontSize || 7.2;
    const headerFontSize = options.headerFontSize || 6.8;
    const cellPadX = 1.8;
    const lineH = options.lineH || 3.4;

    const totalConfiguredW = cols.reduce((s, c) => s + c.width, 0);
    const scale = totalConfiguredW > 0 ? CONTENT_W / totalConfiguredW : 1;
    const normCols = cols.map(c => ({ ...c, w: c.width * scale }));

    const drawHeaderRow = () => {
      doc.setFillColor(...(options.headerBg || COLORS.navy));
      doc.rect(MARGIN, y, CONTENT_W, 6.2, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(headerFontSize);
      doc.setTextColor(...(options.headerText || COLORS.white));
      let cx = MARGIN;
      normCols.forEach(c => {
        const tx = c.align === 'right' ? cx + c.w - cellPadX : (c.align === 'center' ? cx + c.w / 2 : cx + cellPadX);
        doc.text(safeText(c.label).toUpperCase(), tx, y + 4.2, { align: c.align || 'left' });
        cx += c.w;
      });
      y += 6.2;
    };

    ensureSpace(13);
    drawHeaderRow();

    rows.forEach((r, rIdx) => {
      const wrappedCells = normCols.map((c, cIdx) => {
        const raw = Array.isArray(r) ? r[cIdx] : r[c.key];
        const txt = safeText(raw, '-');
        doc.setFont('helvetica', c.bold ? 'bold' : 'normal');
        doc.setFontSize(fontSize);
        return doc.splitTextToSize(txt, Math.max(4, c.w - cellPadX * 2));
      });
      const maxLines = Math.max(1, ...wrappedCells.map(lines => lines.length));
      const rowH = Math.max(5.6, maxLines * lineH + 2.4);

      if (y + rowH > BOTTOM_SAFE) {
        doc.addPage();
        drawTopChrome();
        y = 11;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(...COLORS.indigo);
        doc.text(`${companyName.toUpperCase()} | ${prodNo} (Contd.)`, MARGIN, y);
        y += 3;
        drawHeaderRow();
      }

      if (rIdx % 2 === 1) {
        doc.setFillColor(...COLORS.rowAlt);
        doc.rect(MARGIN, y, CONTENT_W, rowH, 'F');
      }
      doc.setDrawColor(...COLORS.border);
      doc.setLineWidth(0.15);
      doc.rect(MARGIN, y, CONTENT_W, rowH, 'S');

      let cx = MARGIN;
      normCols.forEach((c, cIdx) => {
        const lines = wrappedCells[cIdx];
        const cellMeta = (!Array.isArray(r) && r._styles && r._styles[c.key]) || {};
        doc.setFont('helvetica', cellMeta.bold || c.bold ? 'bold' : 'normal');
        doc.setFontSize(fontSize);
        doc.setTextColor(...(cellMeta.color || c.color || COLORS.slateDark));
        const tx = c.align === 'right' ? cx + c.w - cellPadX : (c.align === 'center' ? cx + c.w / 2 : cx + cellPadX);
        lines.forEach((ln, li) => {
          doc.text(ln, tx, y + 3.6 + li * lineH, { align: c.align || 'left' });
        });
        // Vertical grid hairline
        if (cIdx > 0) {
          doc.setDrawColor(226, 232, 240);
          doc.line(cx, y, cx, y + rowH);
        }
        cx += c.w;
      });
      y += rowH;
    });

    if (footerRow) {
      const footH = 6.2;
      ensureSpace(footH + 2);
      doc.setFillColor(...COLORS.indigoLight);
      doc.rect(MARGIN, y, CONTENT_W, footH, 'FD');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(fontSize);
      doc.setTextColor(...COLORS.navy);
      let cx = MARGIN;
      normCols.forEach((c, cIdx) => {
        const val = Array.isArray(footerRow) ? footerRow[cIdx] : footerRow[c.key];
        const tx = c.align === 'right' ? cx + c.w - cellPadX : (c.align === 'center' ? cx + c.w / 2 : cx + cellPadX);
        doc.text(safeText(val, ''), tx, y + 4.2, { align: c.align || 'left' });
        cx += c.w;
      });
      y += footH;
    }

    y += 3;
  };

  // ── START DOCUMENT ──
  drawTopChrome();
  y = 10;

  // Company & Certificate Header
  doc.setFillColor(...COLORS.navy);
  doc.roundedRect(MARGIN, y, CONTENT_W, 25, 2, 2, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(...COLORS.white);
  doc.text(companyName.toUpperCase(), MARGIN + 4, y + 7);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(165, 180, 252);
  const reportTitle = targetDayNo
    ? `PRODUCTION CLEAN SHEET & TRACEABILITY REPORT - DAY ${targetDayNo} (${mode === 'datewise' ? 'DATE-WISE' : 'SINGLE DAY'})`
    : (mode === 'datewise'
        ? 'DATE-WISE PRODUCTION, CONSUMPTION & YIELD CLEAN SHEET REPORT'
        : 'CONSOLIDATED PRODUCTION CLEAN SHEET, CONSUMPTION & YIELD REPORT');
  doc.text(reportTitle, MARGIN + 4, y + 12.2);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.2);
  doc.setTextColor(203, 213, 225);
  const addrLine = safeText(companyDetails?.companyAddress, 'Manufacturing Plant & Registered Office');
  const taxLine = `GSTIN: ${safeText(companyDetails?.companyGstin || companyDetails?.taxRegNo, '-')}   |   PAN: ${safeText(companyDetails?.companyPan, '-')}   |   Tel: ${safeText(companyDetails?.companyMobile, '-')}`;
  doc.text(addrLine.slice(0, 90), MARGIN + 4, y + 17.5);
  doc.text(taxLine, MARGIN + 4, y + 21.8);

  // Right Badge Box inside dark banner
  doc.setFillColor(30, 41, 59);
  doc.roundedRect(PAGE_W - MARGIN - 54, y + 3, 50, 19, 1.5, 1.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(148, 163, 184);
  doc.text('PRODUCTION ORDER NO', PAGE_W - MARGIN - 29, y + 7.2, { align: 'center' });
  doc.setFontSize(10);
  doc.setTextColor(110, 231, 183);
  doc.text(prodNo.slice(0, 20), PAGE_W - MARGIN - 29, y + 12.2, { align: 'center' });
  doc.setFontSize(7);
  doc.setTextColor(226, 232, 240);
  doc.text(`Batch Code: ${shortCode}`, PAGE_W - MARGIN - 29, y + 16.5, { align: 'center' });
  doc.text(`Status: ${safeText(summary.statusText, 'ACTIVE')}`, PAGE_W - MARGIN - 29, y + 20.2, { align: 'center' });

  y += 28.5;

  // Batch & Duration Metadata Grid (2 rows x 4 cols)
  const metaItems = [
    ['Production No', prodNo],
    ['Batch No / Short Code', `${batchNo} (${shortCode})`],
    ['Duration (Days)', `${summary.durationDaysLabel || '1 Day'}`],
    ['Factory Process Time', `${summary.totalProcessDurationText || '0h 0m'}`],
    ['Start -> End Date', `${summary.dateRangeText || DATE_DMY(batch?.startDate)}`],
    ['Formulation Base', safeText(batch?.baseName || batch?.base_name || batch?.templateName, 'Standard Base')],
    ['Production Line / Shift', `${safeText(batch?.machineLine || batch?.machine_line, 'Main Line')} (${safeText(batch?.shift, 'Morning')})`],
    ['QC / Crew', `${labTestRequired ? 'QC Lab Required' : 'Direct Stock'} | ${batch?.labourCount || batch?.labour_count || 1} Crew`]
  ];

  const metaCellW = CONTENT_W / 4;
  const metaRowH = 9.2;
  metaItems.forEach((item, idx) => {
    const col = idx % 4;
    const row = Math.floor(idx / 4);
    const mx = MARGIN + col * metaCellW;
    const my = y + row * metaRowH;
    doc.setFillColor(...COLORS.rowAlt);
    doc.setDrawColor(...COLORS.border);
    doc.setLineWidth(0.2);
    doc.rect(mx, my, metaCellW, metaRowH, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.2);
    doc.setTextColor(...COLORS.slateMuted);
    doc.text(item[0].toUpperCase(), mx + 2, my + 3.4);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(...COLORS.navy);
    const clipped = doc.splitTextToSize(safeText(item[1]), metaCellW - 4)[0] || '-';
    doc.text(clipped, mx + 2, my + 7.4);
  });
  y += metaRowH * 2 + 4;

  // Executive KPI Strip
  const kpiCards = [
    { label: 'Target Planned', value: `${formatIndian(summary.plannedOutput, 0)} ${summary.productUom}`, sub: 'Order target', bg: COLORS.rowAlt, accent: COLORS.navy },
    { label: 'Actual Good Yield', value: `${formatIndian(summary.actualGood, 0)} ${summary.productUom}`, sub: `Reject: ${formatIndian(summary.totalRejected, 0)}`, bg: COLORS.emeraldLight, accent: COLORS.emerald },
    { label: 'Yield Efficiency', value: `${summary.yieldEfficiency}%`, sub: summary.yieldEfficiency >= 100 ? 'Target Met' : 'Variance Check', bg: COLORS.indigoLight, accent: COLORS.indigo },
    { label: 'Post-Evap Mix', value: `${formatIndian(summary.netPostEvapMixMl, 0)} ml`, sub: `Alloc: ${formatIndian(summary.totalAllocatedMixMl, 0)} ml`, bg: COLORS.amberLight, accent: COLORS.amber },
    ...(canViewCost
      ? [
          { label: 'Total Prod. Cost', value: INR_FMT(summary.totalCost), sub: `Mat: ${INR_FMT(summary.totalMaterialCost)}`, bg: COLORS.navy, accent: COLORS.white, dark: true },
          { label: 'Cost / Unit', value: INR_FMT(summary.costPerUnit), sub: 'All-in unit rate', bg: COLORS.emerald, accent: COLORS.white, dark: true }
        ]
      : [])
  ];

  const kpiW = CONTENT_W / kpiCards.length;
  kpiCards.forEach((k, idx) => {
    const kx = MARGIN + idx * kpiW;
    doc.setFillColor(...k.bg);
    doc.setDrawColor(...COLORS.border);
    doc.roundedRect(kx + (idx > 0 ? 0.8 : 0), y, kpiW - (idx > 0 ? 0.8 : 0), 14.5, 1.2, 1.2, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6);
    doc.setTextColor(...(k.dark ? [203, 213, 225] : COLORS.slateMuted));
    doc.text(k.label.toUpperCase(), kx + 2.5, y + 4);
    doc.setFontSize(8.8);
    doc.setTextColor(...k.accent);
    doc.text(safeText(k.value), kx + 2.5, y + 9.2);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.2);
    doc.setTextColor(...(k.dark ? [226, 232, 240] : COLORS.slateMid));
    doc.text(safeText(k.sub), kx + 2.5, y + 12.8);
  });
  y += 18.5;

  // Evaporation & Mix Pool Balance Bar
  ensureSpace(14);
  doc.setFillColor(...COLORS.amberLight);
  doc.setDrawColor(252, 211, 77);
  doc.roundedRect(MARGIN, y, CONTENT_W, 11, 1.5, 1.5, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.2);
  doc.setTextColor(...COLORS.amber);
  doc.text(`THERMAL EVAPORATION & MIX POOL BALANCE (Stage: ${safeText(summary.mergeStageName)})`, MARGIN + 3, y + 4.2);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.3);
  doc.setTextColor(...COLORS.slateDark);
  const mixSummaryText = `Pre-Evap: ${formatIndian(summary.totalBeforeEvapMl)} ml  |  Evap Loss (${summary.evaporationPct}%): -${formatIndian(summary.evaporationLossMl)} ml  |  Net Available: ${formatIndian(summary.netPostEvapMixMl)} ml  |  Used: ${formatIndian(summary.totalAllocatedMixMl)} ml  |  Remaining Balance: ${formatIndian(summary.remainingMixBalanceMl)} ml`;
  doc.text(mixSummaryText, MARGIN + 3, y + 8.8);
  y += 14.5;

  // ── SECTION 1: BASE RAW MATERIAL CONSUMPTION (WITH BATCH NO, QTY & EXPIRY DATE) ──
  drawSectionHeading('1', 'Base Raw Material Consumption & Inventory Lot Traceability', `${baseRmLines.length} Base Materials Used`);

  const baseCols = canViewCost
    ? [
        { key: 'code', label: 'Code', width: 17 },
        { key: 'name', label: 'Raw Material Name', width: 40, bold: true },
        { key: 'batchNo', label: 'RM Batch / Lot No', width: 35, color: COLORS.indigo, bold: true },
        { key: 'qty', label: 'Consumed Qty', width: 23, align: 'right', bold: true },
        { key: 'expiry', label: 'Expiry Date', width: 20, align: 'center' },
        { key: 'rate', label: 'Unit Rate', width: 20, align: 'right' },
        { key: 'cost', label: 'Total Cost', width: 20, align: 'right', color: COLORS.emerald, bold: true },
        { key: 'evap', label: 'Liquid / Evap', width: 13, align: 'right' }
      ]
    : [
        { key: 'code', label: 'Code', width: 20 },
        { key: 'name', label: 'Raw Material Name', width: 54, bold: true },
        { key: 'batchNo', label: 'RM Batch / Lot No', width: 46, color: COLORS.indigo, bold: true },
        { key: 'qty', label: 'Consumed Qty', width: 28, align: 'right', bold: true },
        { key: 'expiry', label: 'Expiry Date', width: 22, align: 'center' },
        { key: 'evap', label: 'Liquid / Evap', width: 18, align: 'right' }
      ];

  const basePdfRows = [];
  baseRmLines.forEach(line => {
    const lots = Array.isArray(line.lots) && line.lots.length > 0 ? line.lots : null;
    const uomClean = formatCleanUom(line.uom, 'kg', line);
    if (lots && lots.length > 1) {
      lots.forEach((lot, lIdx) => {
        basePdfRows.push({
          code: lIdx === 0 ? safeText(line.rawMaterialCode, 'RM') : '  L Lot',
          name: lIdx === 0 ? safeText(line.rawMaterialName) : `Lot ${lIdx + 1} for ${safeText(line.rawMaterialName)}`,
          batchNo: safeText(lot.lotNumber, 'BATCH-DIRECT'),
          qty: `${formatIndian(lot.allocatedQty)} ${formatCleanUom(lot.uom || uomClean, 'kg', line)}`,
          expiry: DATE_DMY(lot.expiryDate, 'N/A'),
          rate: INR_FMT(lot.unitRate ?? line.unitRate),
          cost: INR_FMT(lot.totalCost ?? round2(Number(lot.allocatedQty || 0) * Number(lot.unitRate ?? line.unitRate ?? 0))),
          evap: lIdx === 0 ? `${formatIndian(line.liquidVolumeMl, 0)}ml` : '-'
        });
      });
    } else {
      const singleLot = lots?.[0];
      basePdfRows.push({
        code: safeText(line.rawMaterialCode, 'RM'),
        name: safeText(line.rawMaterialName),
        batchNo: safeText(singleLot?.lotNumber || line.lotBatchNo, 'BATCH-DIRECT'),
        qty: `${formatIndian(line.takenQty)} ${uomClean}`,
        expiry: DATE_DMY(singleLot?.expiryDate || line.expiryDate, 'N/A'),
        rate: INR_FMT(line.unitRate),
        cost: INR_FMT(line.totalCost),
        evap: line.evaporates ? `${formatIndian(line.liquidVolumeMl, 0)}ml (Evap)` : `${formatIndian(line.liquidVolumeMl, 0)}ml`
      });
    }
  });

  if (basePdfRows.length === 0) {
    basePdfRows.push({
      code: '-',
      name: 'No base raw material consumption recorded',
      batchNo: '-',
      qty: '0',
      expiry: '-',
      rate: '-',
      cost: 'Rs. 0.00',
      evap: '0ml'
    });
  }

  const baseFooter = canViewCost
    ? {
        code: 'TOTAL',
        name: `${baseRmLines.length} Base Materials`,
        batchNo: '',
        qty: '',
        expiry: '',
        rate: 'Total Base:',
        cost: INR_FMT(summary.totalBaseConsumedCost),
        evap: `${formatIndian(summary.totalBaseLiquidVolumeMl, 0)}ml`
      }
    : {
        code: 'TOTAL',
        name: `${baseRmLines.length} Base Materials`,
        batchNo: '',
        qty: '',
        expiry: '',
        evap: `${formatIndian(summary.totalBaseLiquidVolumeMl, 0)}ml`
      };

  drawTable(baseCols, basePdfRows, baseFooter, { fontSize: 6.9 });

  // ── SECTION 2: DATE-WISE / DAY-WISE PRODUCT PRODUCTION & PER-PRODUCT RM CONSUMPTION ──
  const filteredDays = targetDayNo
    ? dayEntries.filter(d => Number(d.dayNo) === Number(targetDayNo))
    : dayEntries;

  drawSectionHeading(
    '2',
    mode === 'datewise' || targetDayNo
      ? 'Date-Wise Product Production, Raw Material Lots & Yield Ledger'
      : 'Day-Wise Production Breakdown & Per-Product RM Traceability',
    `${filteredDays.length} Production Date${filteredDays.length !== 1 ? 's' : ''} Recorded`
  );

  const formatDayUsersText = (dayObj) => {
    const users = Array.isArray(dayObj?.assignedUsers) ? dayObj.assignedUsers : [];
    if (users.length > 0) {
      return users
        .map(u => `${safeText(u.name)}${u.empId ? ` (${safeText(u.empId)})` : ''}${u.role ? ` [${safeText(u.role)}]` : ''}`)
        .join(', ');
    }
    return safeText(dayObj?.completedBy || dayObj?.startedBy || batch?.startedBy || batch?.started_by, 'Floor Operator');
  };

  filteredDays.forEach((dayObj) => {
    ensureSpace(32);
    // Day Header Strip
    doc.setFillColor(...COLORS.indigoLight);
    doc.setDrawColor(...COLORS.indigo);
    doc.setLineWidth(0.35);
    doc.roundedRect(MARGIN, y, CONTENT_W, 15.2, 1.2, 1.2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(...COLORS.indigo);
    doc.text(
      `DAY ${dayObj.dayNo}  |  PRODUCTION DATE: ${DATE_DMY(dayObj.productionDate)}  |  DAY BATCH NO: ${safeText(dayObj.dayBatchCode)}`,
      MARGIN + 3,
      y + 4.3
    );

    doc.setFontSize(7.2);
    doc.setTextColor(...COLORS.emerald);
    doc.text(safeText(dayObj.statusLabel, 'COMPLETED'), PAGE_W - MARGIN - 3, y + 4.3, { align: 'right' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.1);
    doc.setTextColor(...COLORS.navy);
    const staffClipped = doc.splitTextToSize(`ASSIGNED STAFF: ${formatDayUsersText(dayObj)}`, CONTENT_W - 6)[0] || '';
    doc.text(staffClipped, MARGIN + 3, y + 8.9);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...COLORS.slateDark);
    const dayMetaLine = canViewCost
      ? `Mix Flow: Open ${formatIndian(dayObj.openingMixMl, 0)} ml -> Used ${formatIndian(dayObj.allocatedMixMl, 0)} ml -> Rem ${formatIndian(dayObj.remainingMixMl, 0)} ml  |  Output: ${formatIndian(dayObj.totalOutputQty, 0)} (Rej: ${formatIndian(dayObj.totalRejectedQty, 0)})  |  EB: ${INR_FMT(dayObj.ebTotalCost)}  |  Labour: ${INR_FMT(dayObj.labourTotalCost)}  |  OH: ${INR_FMT(dayObj.overheadAmt)}`
      : `Mix Flow: Open ${formatIndian(dayObj.openingMixMl, 0)} ml -> Used ${formatIndian(dayObj.allocatedMixMl, 0)} ml -> Rem ${formatIndian(dayObj.remainingMixMl, 0)} ml  |  Good Output: ${formatIndian(dayObj.totalOutputQty, 0)}  |  Rejects: ${formatIndian(dayObj.totalRejectedQty, 0)}`;
    doc.text(dayMetaLine, MARGIN + 3, y + 13.3);
    y += 17.2;

    // 2A. Products Produced on this Date
    const prodCols = canViewCost
      ? [
          { key: 'seq', label: '#', width: 8, align: 'center', bold: true },
          { key: 'product', label: 'Product / Batch & Serial No', width: 50, bold: true },
          { key: 'spec', label: 'Mould / Spec', width: 28 },
          { key: 'mix', label: 'Mix Used', width: 20, align: 'right' },
          { key: 'expected', label: 'Planned', width: 16, align: 'right' },
          { key: 'actual', label: 'Actual Good', width: 17, align: 'right', color: COLORS.emerald, bold: true },
          { key: 'reject', label: 'Reject', width: 13, align: 'right', color: COLORS.rose },
          { key: 'yieldPct', label: 'Yield %', width: 14, align: 'right', bold: true },
          { key: 'unitCost', label: 'Cost/Unit', width: 22, align: 'right', color: COLORS.indigo, bold: true }
        ]
      : [
          { key: 'seq', label: '#', width: 10, align: 'center', bold: true },
          { key: 'product', label: 'Product / Batch & Serial No', width: 64, bold: true },
          { key: 'spec', label: 'Mould / Spec', width: 34 },
          { key: 'mix', label: 'Mix Used', width: 22, align: 'right' },
          { key: 'expected', label: 'Planned', width: 18, align: 'right' },
          { key: 'actual', label: 'Actual Good', width: 18, align: 'right', color: COLORS.emerald, bold: true },
          { key: 'reject', label: 'Reject', width: 10, align: 'right', color: COLORS.rose },
          { key: 'yieldPct', label: 'Yield %', width: 12, align: 'right', bold: true }
        ];

    const outputs = Array.isArray(dayObj.outputs) ? dayObj.outputs : [];
    const prodRows = outputs.map((out, idx) => {
      const uom = safeText(out.uom, 'pcs');
      const specText = out.useMould !== false && out.mouldCode
        ? `${out.mouldCode} (${out.trays || 0}T x ${out.cavities || 1}C)`
        : `Bulk (${safeText(out.bulkUom, uom)})`;
      const batchSerialLine = [
        out.productBatchNo ? `B: ${out.productBatchNo}` : '',
        out.productSerialNo ? `S: ${out.productSerialNo}` : ''
      ].filter(Boolean).join(' | ');
      return {
        seq: `#${out.seq || idx + 1}`,
        product: batchSerialLine ? `${safeText(out.productName)}\n${batchSerialLine}` : safeText(out.productName),
        spec: specText,
        mix: `${formatIndian(out.allocatedBaseMl, 0)} ml`,
        expected: `${formatIndian(out.theoreticalQty, 0)} ${uom}`,
        actual: `${formatIndian(out.actualYield, 0)} ${uom}`,
        reject: `${formatIndian(out.rejectOutput, 0)}`,
        yieldPct: `${out.yieldPct}%`,
        unitCost: `${INR_FMT(out.unitCost)}\n(Tot ${INR_FMT(out.totalCost)})`
      };
    });

    if (prodRows.length > 0) {
      drawTable(prodCols, prodRows, null, { fontSize: 6.8, headerBg: COLORS.slateDark });
    } else {
      ensureSpace(8);
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(7.2);
      doc.setTextColor(...COLORS.slateMuted);
      doc.text('No product allocations completed for this day yet.', MARGIN + 2, y + 3);
      y += 6;
    }

    // 2B. Product-Wise Raw Material Consumption for THIS Date (RM Batch No, Qty, Expiry Date)
    const dayRmRows = [];
    outputs.forEach(out => {
      const prms = Array.isArray(out.productRms) ? out.productRms : [];
      prms.forEach(prm => {
        const lots = Array.isArray(prm.allocatedBatches) && prm.allocatedBatches.length > 0 ? prm.allocatedBatches : null;
        const pUom = safeText(prm.uom, 'pcs');
        const rate = Number(prm.unitRate ?? prm.rate ?? 0);
        const isMix = prm.addToMix !== false;
        if (lots && lots.length > 0) {
          lots.forEach((lot, lIdx) => {
            const qtyVal = Number(lot.allocatedQty ?? prm.takenQty ?? prm.qty ?? 0);
            const rowCost = round2(qtyVal * Number(lot.unitRate ?? rate));
            dayRmRows.push({
              product: lIdx === 0 ? safeText(out.productName) : `${safeText(out.productName)} (Lot ${lIdx + 1})`,
              rmName: `${safeText(prm.rawMaterialCode || prm.rmCode, 'RM')} - ${safeText(prm.rawMaterialName || prm.rmName)}`,
              lotNo: safeText(lot.lotNumber || lot.internalBatchNo || prm.lotBatchNo, 'BATCH-DIRECT'),
              qty: `${formatIndian(qtyVal, 2)} ${formatCleanUom(lot.uom || pUom, 'pcs', prm)}`,
              expiry: DATE_DMY(lot.expiryDate || prm.expiryDate, 'N/A'),
              purpose: isMix ? `Mix (+${formatIndian(toMl(qtyVal, pUom, Number(prm.density || 1)), 0)}ml)` : 'Packaging',
              cost: INR_FMT(rowCost)
            });
          });
        } else {
          const qtyVal = Number(prm.takenQty ?? prm.qty ?? 0);
          const rowCost = Number(prm.totalCost) > 0 ? Number(prm.totalCost) : round2(qtyVal * rate);
          dayRmRows.push({
            product: safeText(out.productName),
            rmName: `${safeText(prm.rawMaterialCode || prm.rmCode, 'RM')} - ${safeText(prm.rawMaterialName || prm.rmName)}`,
            lotNo: safeText(prm.lotBatchNo, 'BATCH-DIRECT'),
            qty: `${formatIndian(qtyVal, 2)} ${pUom}`,
            expiry: DATE_DMY(prm.expiryDate, 'N/A'),
            purpose: isMix ? `Mix (+${formatIndian(toMl(qtyVal, pUom, Number(prm.density || 1)), 0)}ml)` : 'Packaging',
            cost: INR_FMT(rowCost)
          });
        }
      });
    });

    if (dayRmRows.length > 0) {
      ensureSpace(14);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.2);
      doc.setTextColor(...COLORS.indigo);
      doc.text(`Product-Wise Raw Material Consumption — Day ${dayObj.dayNo} (${DATE_DMY(dayObj.productionDate)})`, MARGIN, y + 3);
      y += 4.5;

      const dayRmCols = canViewCost
        ? [
            { key: 'product', label: 'Finished Product', width: 34, bold: true },
            { key: 'rmName', label: 'Added RM / Packaging Material', width: 45 },
            { key: 'lotNo', label: 'RM Batch / Lot No', width: 35, color: COLORS.indigo, bold: true },
            { key: 'qty', label: 'Consumed Qty', width: 22, align: 'right', bold: true },
            { key: 'expiry', label: 'Expiry Date', width: 20, align: 'center' },
            { key: 'purpose', label: 'Type / Vol', width: 16, align: 'center' },
            { key: 'cost', label: 'Cost', width: 16, align: 'right', color: COLORS.emerald, bold: true }
          ]
        : [
            { key: 'product', label: 'Finished Product', width: 38, bold: true },
            { key: 'rmName', label: 'Added RM / Packaging Material', width: 52 },
            { key: 'lotNo', label: 'RM Batch / Lot No', width: 38, color: COLORS.indigo, bold: true },
            { key: 'qty', label: 'Consumed Qty', width: 24, align: 'right', bold: true },
            { key: 'expiry', label: 'Expiry Date', width: 20, align: 'center' },
            { key: 'purpose', label: 'Type / Vol', width: 16, align: 'center' }
          ];

      drawTable(dayRmCols, dayRmRows, null, { fontSize: 6.6, headerBg: [51, 65, 85] });
    }

    // 2C. Day Factory Process Stages Strip
    const dStages = Array.isArray(dayObj.timelineStages) && dayObj.timelineStages.length > 0
      ? dayObj.timelineStages
      : timelineStages;
    if (Array.isArray(dStages) && dStages.length > 0) {
      ensureSpace(10);
      const stgSummary = dStages.map((s, si) => `${si + 1}. ${safeText(s.name)} (${safeText(s.targetTemp || s.defaultTemp, '-')}, ${s.durationHours || 0}h ${s.durationMinutes || 0}m)`).join('   ->   ');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.6);
      doc.setTextColor(...COLORS.slateMid);
      const wrappedStg = doc.splitTextToSize(`Stages (Day ${dayObj.dayNo}): ${stgSummary}`, CONTENT_W - 4);
      const stgH = Math.max(6, wrappedStg.length * 3.1 + 2.5);
      doc.setFillColor(...COLORS.rowAlt);
      doc.setDrawColor(...COLORS.border);
      doc.rect(MARGIN, y, CONTENT_W, stgH, 'FD');
      wrappedStg.forEach((ln, li) => {
        doc.text(ln, MARGIN + 2, y + 3.6 + li * 3.1);
      });
      y += stgH + 3.5;
    }
  });

  // ── SECTION 3: CONSOLIDATED YIELD REPORT ──
  if (yieldRows.length > 0) {
    drawSectionHeading('3', 'Consolidated Output & Yield Variance Report', `${yieldRows.length} Output Summary Lines`);
    const yCols = canViewCost
      ? [
          { key: 'product', label: 'Product Name', width: 46, bold: true },
          { key: 'days', label: 'Days Run', width: 24, align: 'center' },
          { key: 'mix', label: 'Total Mix (ml)', width: 24, align: 'right' },
          { key: 'expected', label: 'Planned Qty', width: 22, align: 'right' },
          { key: 'actual', label: 'Actual Good', width: 22, align: 'right', color: COLORS.emerald, bold: true },
          { key: 'reject', label: 'Rejected', width: 16, align: 'right', color: COLORS.rose },
          { key: 'eff', label: 'Yield %', width: 16, align: 'right', bold: true },
          { key: 'totalCost', label: 'Total Cost', width: 18, align: 'right', color: COLORS.indigo, bold: true }
        ]
      : [
          { key: 'product', label: 'Product Name', width: 56, bold: true },
          { key: 'days', label: 'Days Run', width: 26, align: 'center' },
          { key: 'mix', label: 'Total Mix (ml)', width: 28, align: 'right' },
          { key: 'expected', label: 'Planned Qty', width: 24, align: 'right' },
          { key: 'actual', label: 'Actual Good', width: 24, align: 'right', color: COLORS.emerald, bold: true },
          { key: 'reject', label: 'Rejected', width: 15, align: 'right', color: COLORS.rose },
          { key: 'eff', label: 'Yield %', width: 15, align: 'right', bold: true }
        ];

    const yPdfRows = yieldRows.map(yr => ({
      product: `${safeText(yr.productName)} (${safeText(yr.productCode, 'FP')})`,
      days: safeText(yr.daysLabel, '-'),
      mix: `${formatIndian(yr.mixUsedMl, 0)} ml`,
      expected: `${formatIndian(yr.expectedQty, 0)} ${safeText(yr.uom, 'pcs')}`,
      actual: `${formatIndian(yr.actualGood, 0)} ${safeText(yr.uom, 'pcs')}`,
      reject: `${formatIndian(yr.rejectOutput, 0)}`,
      eff: `${yr.yieldPct}%`,
      totalCost: INR_FMT(yr.totalCost)
    }));

    const yFooter = {
      product: 'GRAND TOTAL',
      days: `${filteredDays.length} Day(s)`,
      mix: `${formatIndian(summary.totalAllocatedMixMl, 0)} ml`,
      expected: `${formatIndian(summary.totalExpectedOutput, 0)}`,
      actual: `${formatIndian(summary.actualGood, 0)}`,
      reject: `${formatIndian(summary.totalRejected, 0)}`,
      eff: `${summary.yieldEfficiency}%`,
      totalCost: canViewCost ? INR_FMT(summary.totalCost) : ''
    };

    drawTable(yCols, yPdfRows, yFooter, { fontSize: 6.9 });
  }

  // ── SECTION 4: FINANCIAL COST STATEMENT ──
  if (canViewCost) {
    drawSectionHeading('4', 'Comprehensive Financial Cost Statement', 'Audited Batch Economics');
    const costCols = [
      { key: 'head', label: 'Cost Component', width: 90, bold: true },
      { key: 'notes', label: 'Basis / Remarks', width: 60 },
      { key: 'amount', label: 'Amount (INR)', width: 38, align: 'right', color: COLORS.navy, bold: true }
    ];
    const costRows = [
      { head: '1. Base Raw Materials Consumed', notes: `${baseRmLines.length} base ingredients (live PO lot rates)`, amount: INR_FMT(summary.totalBaseConsumedCost) },
      { head: '2. Product-Specific Added RMs & Packaging', notes: 'Flavours, essences, sticks & poly covers', amount: INR_FMT(summary.totalAddedRmsCost) },
      { head: '3. Direct Production Labour', notes: `Total crew cost across ${filteredDays.length || 1} day(s)`, amount: INR_FMT(summary.directLabourCost) },
      { head: '4. Electricity & Freezer Utilities (EB)', notes: 'Metered chiller / tank / tunnel consumption', amount: INR_FMT(summary.electricityCost) },
      { head: '5. Factory Overheads', notes: 'Allocated plant overhead charges', amount: INR_FMT(summary.overheadCost) }
    ];
    const costFooter = {
      head: 'GRAND TOTAL PRODUCTION COST',
      notes: `Unit Cost = ${INR_FMT(summary.costPerUnit)} / ${summary.productUom}`,
      amount: INR_FMT(summary.totalCost)
    };
    drawTable(costCols, costRows, costFooter, { fontSize: 7.2 });
  }

  // ── SECTION 5: QA REMARKS & AUTHORIZED SIGN-OFF ──
  ensureSpace(34);
  drawSectionHeading('5', 'Quality Assurance & Authorized Process Sign-Off');
  doc.setFillColor(...COLORS.rowAlt);
  doc.setDrawColor(...COLORS.border);
  doc.roundedRect(MARGIN, y, CONTENT_W, 10, 1.2, 1.2, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(...COLORS.slateMuted);
  doc.text('OPERATOR & SUPERVISOR REMARKS:', MARGIN + 2.5, y + 3.8);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.2);
  doc.setTextColor(...COLORS.slateDark);
  doc.text(safeText(completionNotes, 'Verified batch production execution & traceability record.').slice(0, 120), MARGIN + 2.5, y + 8);
  y += 13;

  const sigW = (CONTENT_W - 6) / 3;
  const sigBoxes = [
    { role: 'Production Floor In-Charge', name: safeText(batch?.startedBy || batch?.started_by, 'Floor Operator'), sub: `Date: ${DATE_DMY(batch?.startDate || batch?.start_date)}` },
    { role: 'Quality Assurance Inspector', name: labTestRequired ? 'QC LAB HOLD' : 'QC CLEARED - GRADE A', sub: labTestRequired ? 'Pending Lab Release' : 'Inventory Verified' },
    { role: 'Plant Operations Manager', name: 'Authorized Signatory', sub: `ERP ID: #${String(batch?.id || '').slice(0, 14)}` }
  ];
  sigBoxes.forEach((sb, idx) => {
    const sx = MARGIN + idx * (sigW + 3);
    doc.setDrawColor(...COLORS.border);
    doc.roundedRect(sx, y, sigW, 17, 1.2, 1.2, 'S');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(...COLORS.slateMuted);
    doc.text(sb.role.toUpperCase(), sx + sigW / 2, y + 4, { align: 'center' });
    doc.setDrawColor(203, 213, 225);
    doc.line(sx + 5, y + 11.5, sx + sigW - 5, y + 11.5);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(...COLORS.navy);
    doc.text(sb.name, sx + sigW / 2, y + 10.2, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(...COLORS.slateMuted);
    doc.text(sb.sub, sx + sigW / 2, y + 15.2, { align: 'center' });
  });

  // ── PAGE NUMBERS & FOOTER ON ALL PAGES ──
  const pageCount = doc.internal.getNumberOfPages();
  const genTime = new Date().toLocaleString('en-IN');
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setDrawColor(...COLORS.border);
    doc.setLineWidth(0.2);
    doc.line(MARGIN, PAGE_H - 9.5, PAGE_W - MARGIN, PAGE_H - 9.5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.8);
    doc.setTextColor(...COLORS.slateMuted);
    doc.text(`${companyName} | Prod No: ${prodNo} | Generated: ${genTime}`, MARGIN, PAGE_H - 5.5);
    doc.setFont('helvetica', 'bold');
    doc.text(`Page ${i} of ${pageCount}`, PAGE_W - MARGIN, PAGE_H - 5.5, { align: 'right' });
  }

  const sanitizedProd = prodNo.replace(/[^a-zA-Z0-9_-]/g, '_');
  const suffix = targetDayNo
    ? `Day${targetDayNo}_${DATE_DMY(filteredDays[0]?.productionDate || batch?.startDate).replace(/-/g, '')}`
    : (mode === 'datewise' ? 'DateWise' : 'CleanSheet');
  doc.save(`${sanitizedProd}_${suffix}_Report.pdf`);
}

