import { jsPDF } from 'jspdf';
import { round2, formatIndian, toMl, formatCleanUom } from './productionCalculation.js';

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

const resolveExpiryDate = (lotOrLine) => {
  if (!lotOrLine) return null;
  if (lotOrLine.expiryDate) return lotOrLine.expiryDate;
  if (lotOrLine.lot_expiry_date) return lotOrLine.lot_expiry_date;
  if (lotOrLine.lotExpiryDate) return lotOrLine.lotExpiryDate;
  if (lotOrLine.mfgDate) {
    const d = new Date(lotOrLine.mfgDate);
    if (!isNaN(d.getTime())) {
      return new Date(d.getTime() + 180 * 86400000);
    }
  }
  return null;
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
 * Generates an ultra-attractive, perfectly aligned, multi-page A4 Vector PDF
 * for the Standard Production Clean Sheet Report.
 * - Occupies the full printable page (margin: 8mm, width: 194mm)
 * - Guarantees zero text overlap or data interception
 * - Resumes multi-page table splits with table continuation title & column headers
 * - Displays page numbers (Page X of Y) on every page
 * - Preserves all calculations, traceability, unique RM summaries, and sign-offs
 */
export function exportCleanSheetPdf({
  mode = 'full',
  targetDayNo = null,
  companyDetails = null,
  batch = {},
  summary = {},
  baseRmLines = [],
  entireProductionRmLines = [],
  uniqueRawMaterialsSummary = [],
  dayEntries = [],
  yieldRows = [],
  timelineStages = [],
  productStagesMap = {},
  canViewCost = true,
  completionNotes = '',
  labTestRequired = false
}) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const PAGE_W = doc.internal.pageSize.getWidth(); // 210mm
  const PAGE_H = doc.internal.pageSize.getHeight(); // 297mm
  const MARGIN = 8; // Clean, generous margins that occupy full printable width
  const CONTENT_W = PAGE_W - MARGIN * 2; // 194mm exact full-page width
  const BOTTOM_SAFE = PAGE_H - 12; // Leaves room for running footer and page badge

  const COLORS = {
    navy: [15, 23, 42],
    indigo: [67, 56, 202],
    indigoLight: [238, 242, 255],
    indigoBorder: [199, 210, 254],
    emerald: [5, 150, 105],
    emeraldLight: [236, 253, 245],
    emeraldBorder: [167, 243, 208],
    amber: [180, 83, 9],
    amberLight: [255, 251, 235],
    amberBorder: [252, 211, 77],
    rose: [190, 18, 60],
    roseLight: [255, 241, 242],
    slateDark: [30, 41, 59],
    slateMid: [71, 85, 105],
    slateMuted: [100, 116, 139],
    border: [203, 213, 225],
    rowAlt: [248, 250, 252],
    white: [255, 255, 255]
  };

  const PRODUCT_THEME_COLORS = [
    { headerBg: [67, 56, 202], badgeBg: [238, 242, 255], border: [165, 180, 252], text: [67, 56, 202], name: 'Indigo' },
    { headerBg: [5, 150, 105], badgeBg: [236, 253, 245], border: [110, 231, 183], text: [5, 150, 105], name: 'Emerald' },
    { headerBg: [147, 51, 234], badgeBg: [245, 243, 255], border: [216, 180, 254], text: [147, 51, 234], name: 'Purple' },
    { headerBg: [217, 119, 6], badgeBg: [254, 243, 199], border: [252, 211, 77], text: [217, 119, 6], name: 'Amber' },
    { headerBg: [225, 29, 72], badgeBg: [255, 241, 242], border: [253, 164, 175], text: [225, 29, 72], name: 'Rose' },
    { headerBg: [8, 145, 178], badgeBg: [236, 254, 255], border: [103, 232, 249], text: [8, 145, 178], name: 'Cyan' }
  ];

  let y = MARGIN;

  const prodNo = safeText(batch?.referenceNo || batch?.reference_no || batch?.batchNo || batch?.batch_no, 'PROD-BATCH');
  const batchNo = safeText(batch?.batchNo || batch?.batch_no || batch?.referenceNo, prodNo);
  const shortCode = safeText(batch?.shortBatchCode || batch?.short_batch_code, '-');
  const companyName = safeText(companyDetails?.companyName, 'Leonex Manufacturing ERP');

  const drawTopChrome = () => {
    doc.setFillColor(...COLORS.navy);
    doc.rect(0, 0, PAGE_W, 3.5, 'F');
    doc.setFillColor(...COLORS.indigo);
    doc.rect(0, 3.5, PAGE_W, 1.2, 'F');
  };

  const ensureSpace = (neededH = 18) => {
    if (y + neededH > BOTTOM_SAFE) {
      doc.addPage();
      drawTopChrome();
      y = 10;
      // Compact top continuation header
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.8);
      doc.setTextColor(...COLORS.indigo);
      doc.text(`${companyName.toUpperCase()} | PRODUCTION CLEAN SHEET & TRACEABILITY REPORT`, MARGIN, y + 3);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.8);
      doc.setTextColor(...COLORS.slateMuted);
      doc.text(`Prod No: ${prodNo} | Batch: ${shortCode} | Status: ${safeText(summary.statusText, 'ACTIVE')}`, PAGE_W - MARGIN, y + 3, { align: 'right' });
      y += 5.2;
      doc.setDrawColor(...COLORS.border);
      doc.setLineWidth(0.25);
      doc.line(MARGIN, y, PAGE_W - MARGIN, y);
      y += 3.8;
    }
  };

  const drawSectionHeading = (badge, title, subtitle = '') => {
    ensureSpace(14);
    y += 1.5;
    doc.setFillColor(...COLORS.indigo);
    doc.roundedRect(MARGIN, y, 5.8, 5.8, 1, 1, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.white);
    doc.text(safeText(badge), MARGIN + 2.9, y + 4.1, { align: 'center' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.8);
    doc.setTextColor(...COLORS.navy);
    doc.text(safeText(title).toUpperCase(), MARGIN + 8.5, y + 4.2);

    if (subtitle) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.2);
      doc.setTextColor(...COLORS.slateMuted);
      doc.text(safeText(subtitle), PAGE_W - MARGIN, y + 4.2, { align: 'right' });
    }
    y += 7.2;
    doc.setDrawColor(...COLORS.indigo);
    doc.setLineWidth(0.35);
    doc.line(MARGIN, y, PAGE_W - MARGIN, y);
    y += 3.2;
  };

  /**
   * Reusable perfectly aligned vector table with automatic row wrapping,
   * non-intercepting cells, and automatic page break table header repetition.
   */
  const drawTable = (cols, rows, footerRow = null, options = {}) => {
    const fontSize = options.fontSize || 6.9;
    const headerFontSize = options.headerFontSize || 6.7;
    const cellPadX = 2.0; // Strict cell horizontal breathing space
    const lineH = options.lineH || 3.4;

    const totalConfiguredW = cols.reduce((s, c) => s + c.width, 0);
    const scale = totalConfiguredW > 0 ? CONTENT_W / totalConfiguredW : 1;
    const normCols = cols.map(c => ({ ...c, w: c.width * scale }));

    // Pre-calculate wrapped lines and ensure non-intercepting boundaries for all cells
    const preparedRows = rows.map(r => {
      const wrappedCells = normCols.map((c, cIdx) => {
        const raw = Array.isArray(r) ? r[cIdx] : r[c.key];
        const txt = safeText(raw, '-');
        const cellMeta = (!Array.isArray(r) && r._styles && r._styles[c.key]) || {};
        const isBold = cellMeta.bold || c.bold;
        doc.setFont('helvetica', isBold ? 'bold' : 'normal');

        const maxW = Math.max(3.5, c.w - cellPadX * 2);
        let cellFontSize = fontSize;
        doc.setFontSize(cellFontSize);

        const rawParagraphs = txt.split('\n');
        let lines = [];
        for (const p of rawParagraphs) {
          const splitP = doc.splitTextToSize(p, maxW);
          for (const sp of splitP) {
            lines.push(sp);
          }
        }

        // Auto-scale font if an unbroken long token exceeds column width
        let maxLineWidth = 0;
        for (const ln of lines) {
          const lw = (doc.getStringUnitWidth(ln) * cellFontSize) / doc.internal.scaleFactor;
          if (lw > maxLineWidth) maxLineWidth = lw;
        }

        if (maxLineWidth > maxW && cellFontSize > 5.2) {
          cellFontSize = Math.max(5.2, (cellFontSize * maxW) / maxLineWidth);
          doc.setFontSize(cellFontSize);
          lines = [];
          for (const p of rawParagraphs) {
            const splitP = doc.splitTextToSize(p, maxW);
            for (const sp of splitP) {
              lines.push(sp);
            }
          }
        }

        return { lines, fontSize: cellFontSize };
      });

      const maxLines = Math.max(1, ...wrappedCells.map(wc => wc.lines.length));
      const rowH = Math.max(5.8, maxLines * lineH + 2.5);
      return { wrappedCells, rowH, rawData: r };
    });

    // Responsive footer calculation
    let footWrapped = null;
    let footH = 0;
    if (footerRow) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(fontSize);
      footWrapped = normCols.map((c, cIdx) => {
        const val = Array.isArray(footerRow) ? footerRow[cIdx] : footerRow[c.key];
        const text = safeText(val, '');
        if (!text) return { lines: [], fontSize };
        const maxW = Math.max(3.5, c.w - cellPadX * 2);
        let cellFontSize = fontSize;
        const rawParagraphs = text.split('\n');
        let lines = [];
        for (const p of rawParagraphs) {
          for (const sp of doc.splitTextToSize(p, maxW)) {
            lines.push(sp);
          }
        }
        let maxLineWidth = 0;
        for (const ln of lines) {
          const lw = (doc.getStringUnitWidth(ln) * cellFontSize) / doc.internal.scaleFactor;
          if (lw > maxLineWidth) maxLineWidth = lw;
        }
        if (maxLineWidth > maxW && cellFontSize > 5.2) {
          cellFontSize = Math.max(5.2, (cellFontSize * maxW) / maxLineWidth);
          doc.setFontSize(cellFontSize);
          lines = [];
          for (const p of rawParagraphs) {
            for (const sp of doc.splitTextToSize(p, maxW)) {
              lines.push(sp);
            }
          }
        }
        return { lines, fontSize: cellFontSize };
      });
      const maxFootLines = Math.max(1, ...footWrapped.map(fw => fw.lines.length));
      footH = Math.max(6.4, maxFootLines * lineH + 2.5);
    }

    const headerH = 6.4;
    const totalTableH = headerH + preparedRows.reduce((s, pr) => s + pr.rowH, 0) + footH + 3;

    // PREVENT BREAK: If the entire table fits comfortably on a single clean page and would overflow current page, move it
    const maxUsablePageH = BOTTOM_SAFE - 15;
    if (options.preventBreak && totalTableH <= maxUsablePageH) {
      ensureSpace(totalTableH);
    } else {
      ensureSpace(16);
    }

    const drawHeaderRow = () => {
      doc.setFillColor(...(options.headerBg || COLORS.navy));
      doc.rect(MARGIN, y, CONTENT_W, headerH, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(headerFontSize);
      doc.setTextColor(...(options.headerText || COLORS.white));
      let cx = MARGIN;
      normCols.forEach((c, cIdx) => {
        const labelText = safeText(c.label).toUpperCase();
        const maxW = Math.max(3.5, c.w - cellPadX * 2);
        let colFontSize = headerFontSize;
        const strW = (doc.getStringUnitWidth(labelText) * colFontSize) / doc.internal.scaleFactor;
        if (strW > maxW && colFontSize > 5.2) {
          colFontSize = Math.max(5.2, (colFontSize * maxW) / strW);
          doc.setFontSize(colFontSize);
        }
        const tx = c.align === 'right' ? cx + c.w - cellPadX : (c.align === 'center' ? cx + c.w / 2 : cx + cellPadX);
        doc.text(labelText, tx, y + 4.3, { align: c.align || 'left' });
        if (colFontSize !== headerFontSize) {
          doc.setFontSize(headerFontSize);
        }
        // Vertical divider in header
        if (cIdx > 0) {
          doc.setDrawColor(255, 255, 255);
          doc.setLineWidth(0.12);
          doc.line(cx, y + 0.8, cx, y + headerH - 0.8);
        }
        cx += c.w;
      });
      y += headerH;
    };

    drawHeaderRow();

    preparedRows.forEach((pr, rIdx) => {
      const { wrappedCells, rowH, rawData: r } = pr;

      // Table Multi-Page Continuation: Resume cleanly with table title & column headers!
      if (y + rowH > BOTTOM_SAFE) {
        doc.addPage();
        drawTopChrome();
        y = 10;

        const tTitle = options.tableName || options.title || 'Table Ledger';
        doc.setFillColor(...(options.continuationBg || COLORS.indigoLight));
        doc.setDrawColor(...(options.continuationBorder || COLORS.indigo));
        doc.setLineWidth(0.28);
        doc.roundedRect(MARGIN, y, CONTENT_W, 6.2, 1, 1, 'FD');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(...(options.continuationText || COLORS.indigo));
        doc.text(`${tTitle.toUpperCase()} — TABLE CONTINUED`, MARGIN + 3, y + 4.2);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.8);
        doc.setTextColor(...COLORS.slateMuted);
        doc.text(`Prod No: ${prodNo} | Batch: ${shortCode}`, MARGIN + CONTENT_W - 3, y + 4.2, { align: 'right' });

        y += 7.8;
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
        const { lines, fontSize: cellFontSize } = wrappedCells[cIdx];
        const cellMeta = (!Array.isArray(r) && r._styles && r._styles[c.key]) || {};
        doc.setFont('helvetica', cellMeta.bold || c.bold ? 'bold' : 'normal');
        doc.setFontSize(cellFontSize);
        doc.setTextColor(...(cellMeta.color || c.color || COLORS.slateDark));

        const tx = c.align === 'right' ? cx + c.w - cellPadX : (c.align === 'center' ? cx + c.w / 2 : cx + cellPadX);
        lines.forEach((ln, li) => {
          doc.text(ln, tx, y + 3.8 + li * lineH, { align: c.align || 'left' });
        });

        // Vertical hairline between columns
        if (cIdx > 0) {
          doc.setDrawColor(226, 232, 240);
          doc.line(cx, y, cx, y + rowH);
        }
        cx += c.w;
      });
      y += rowH;
    });

    if (footerRow && footWrapped) {
      if (y + footH > BOTTOM_SAFE) {
        doc.addPage();
        drawTopChrome();
        y = 10;

        const tTitle = options.tableName || options.title || 'Table Ledger';
        doc.setFillColor(...(options.continuationBg || COLORS.indigoLight));
        doc.setDrawColor(...(options.continuationBorder || COLORS.indigo));
        doc.setLineWidth(0.28);
        doc.roundedRect(MARGIN, y, CONTENT_W, 6.2, 1, 1, 'FD');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(...(options.continuationText || COLORS.indigo));
        doc.text(`${tTitle.toUpperCase()} — TOTALS / CONTINUED`, MARGIN + 3, y + 4.2);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.8);
        doc.setTextColor(...COLORS.slateMuted);
        doc.text(`Prod No: ${prodNo} | Batch: ${shortCode}`, MARGIN + CONTENT_W - 3, y + 4.2, { align: 'right' });

        y += 7.8;
        drawHeaderRow();
      }

      doc.setFillColor(...COLORS.indigoLight);
      doc.rect(MARGIN, y, CONTENT_W, footH, 'F');
      doc.setDrawColor(...COLORS.indigo);
      doc.setLineWidth(0.25);
      doc.rect(MARGIN, y, CONTENT_W, footH, 'S');

      let cx = MARGIN;
      normCols.forEach((c, cIdx) => {
        const { lines, fontSize: cellFontSize } = footWrapped[cIdx];
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(cellFontSize);
        doc.setTextColor(...COLORS.navy);
        const tx = c.align === 'right' ? cx + c.w - cellPadX : (c.align === 'center' ? cx + c.w / 2 : cx + cellPadX);
        lines.forEach((ln, li) => {
          doc.text(ln, tx, y + 3.8 + li * lineH, { align: c.align || 'left' });
        });
        // Vertical divider in footer
        if (cIdx > 0) {
          doc.setDrawColor(199, 210, 254);
          doc.setLineWidth(0.2);
          doc.line(cx, y, cx, y + footH);
        }
        cx += c.w;
      });
      y += footH;
    }

    y += 3.2;
  };

  // ── START DOCUMENT ──
  drawTopChrome();
  y = 9.5;

  // Company & Certificate Header Banner (Full 194mm width)
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
  doc.text(addrLine.slice(0, 85), MARGIN + 4, y + 17.5);
  doc.text(taxLine, MARGIN + 4, y + 21.8);

  // Right Badge Box inside dark banner
  const badgeBoxW = 54;
  const badgeBoxX = PAGE_W - MARGIN - badgeBoxW;
  doc.setFillColor(30, 41, 59);
  doc.roundedRect(badgeBoxX, y + 3, badgeBoxW, 19, 1.5, 1.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(148, 163, 184);
  doc.text('PRODUCTION ORDER NO', badgeBoxX + badgeBoxW / 2, y + 7.2, { align: 'center' });
  doc.setFontSize(9.8);
  doc.setTextColor(110, 231, 183);
  doc.text(prodNo.slice(0, 22), badgeBoxX + badgeBoxW / 2, y + 12.2, { align: 'center' });
  doc.setFontSize(7);
  doc.setTextColor(226, 232, 240);
  doc.text(`Batch Code: ${shortCode}`, badgeBoxX + badgeBoxW / 2, y + 16.5, { align: 'center' });
  doc.text(`Status: ${safeText(summary.statusText, 'ACTIVE')}`, badgeBoxX + badgeBoxW / 2, y + 20.2, { align: 'center' });

  y += 28.5;

  // Batch & Duration Metadata Grid (2 rows x 4 cols, Full 194mm width)
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

  const metaCellW = CONTENT_W / 4; // 48.5mm
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
    doc.text(item[0].toUpperCase(), mx + 2.2, my + 3.4);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.4);
    doc.setTextColor(...COLORS.navy);
    const clipped = doc.splitTextToSize(safeText(item[1]), metaCellW - 4.4)[0] || '-';
    doc.text(clipped, mx + 2.2, my + 7.4);
  });
  y += metaRowH * 2 + 3.8;

  // Executive KPI Strip (Full 194mm width)
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
    doc.setFontSize(8.6);
    doc.setTextColor(...k.accent);
    doc.text(safeText(k.value), kx + 2.5, y + 9.2);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.2);
    doc.setTextColor(...(k.dark ? [226, 232, 240] : COLORS.slateMid));
    doc.text(safeText(k.sub), kx + 2.5, y + 12.8);
  });
  y += 18.2;

  // Evaporation & Mix Pool Balance Bar (Full 194mm width)
  ensureSpace(14);
  doc.setFillColor(...COLORS.amberLight);
  doc.setDrawColor(...COLORS.amberBorder);
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

  // ── SECTION 1: BASE RAW MATERIAL CONSUMPTION ──
  drawSectionHeading('1', 'Base Raw Material Consumption & Inventory Lot Traceability', `${baseRmLines.length} Base Materials Used`);

  // Section 1 Columns calibrated for exact 194mm width
  const baseCols = canViewCost
    ? [
        { key: 'code', label: 'Code', width: 18 },
        { key: 'name', label: 'Raw Material Name', width: 40, bold: true },
        { key: 'batchNo', label: 'RM Batch / Lot No', width: 32, color: COLORS.indigo, bold: true },
        { key: 'qty', label: 'Consumed Qty', width: 22, align: 'right', bold: true },
        { key: 'expiry', label: 'Expiry Date', width: 18, align: 'center' },
        { key: 'rate', label: 'Unit Rate', width: 18, align: 'right' },
        { key: 'cost', label: 'Total Cost', width: 24, align: 'right', color: COLORS.emerald, bold: true },
        { key: 'evap', label: 'Liquid / Evap', width: 22, align: 'right' }
      ]
    : [
        { key: 'code', label: 'Code', width: 20 },
        { key: 'name', label: 'Raw Material Name', width: 54, bold: true },
        { key: 'batchNo', label: 'RM Batch / Lot No', width: 46, color: COLORS.indigo, bold: true },
        { key: 'qty', label: 'Consumed Qty', width: 26, align: 'right', bold: true },
        { key: 'expiry', label: 'Expiry Date', width: 22, align: 'center' },
        { key: 'evap', label: 'Liquid / Evap', width: 26, align: 'right' }
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
          expiry: DATE_DMY(resolveExpiryDate(lot) || resolveExpiryDate(line), 'N/A'),
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
        expiry: DATE_DMY(resolveExpiryDate(singleLot) || resolveExpiryDate(line), 'N/A'),
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

  const totalBaseQty = round2(baseRmLines.reduce((s, l) => s + Number(l.takenQty || 0), 0));
  const baseUomMap = {};
  baseRmLines.forEach(l => {
    const u = formatCleanUom(l.uom, 'kg', l);
    baseUomMap[u] = (baseUomMap[u] || 0) + Number(l.takenQty || 0);
  });
  const baseUomEntries = Object.entries(baseUomMap);
  const baseQtyPdf = baseUomEntries.length === 1
    ? `${formatIndian(totalBaseQty)} ${baseUomEntries[0][0]}`
    : `${formatIndian(totalBaseQty)}`;

  const totalBasePrepared = Number(summary.totalBasePreparedCost || 0) > 0
    ? Number(summary.totalBasePreparedCost)
    : round2(baseRmLines.reduce((s, l) => s + Number(l.totalCost || 0), 0));

  const baseFooter = canViewCost
    ? {
        code: 'TOTAL',
        name: `${baseRmLines.length} Base Materials`,
        batchNo: '',
        qty: baseQtyPdf,
        expiry: '',
        rate: 'Total Base:',
        cost: INR_FMT(totalBasePrepared),
        evap: `${formatIndian(summary.totalBaseLiquidVolumeMl, 0)}ml`
      }
    : {
        code: 'TOTAL',
        name: `${baseRmLines.length} Base Materials`,
        batchNo: '',
        qty: baseQtyPdf,
        expiry: '',
        evap: `${formatIndian(summary.totalBaseLiquidVolumeMl, 0)}ml`
      };

  drawTable(baseCols, basePdfRows, baseFooter, {
    fontSize: 6.9,
    tableName: 'Section 1: Base Raw Material Consumption & Traceability'
  });

  // Base mix allocation audit note strip below Section 1 table
  const netMixMl = Number(summary.netPostEvapMixMl || 0);
  const preMixMl = Number(
    summary.preEvapMixVolumeMl ||
    summary.totalBeforeEvapMl ||
    (netMixMl > 0 && Number(summary.evaporationLossMl || 0) > 0 ? (netMixMl + Number(summary.evaporationLossMl)) : 0) ||
    (netMixMl > 0 && Number(summary.evaporationPct || 0) > 0 && Number(summary.evaporationPct || 0) < 100 ? round2(netMixMl / (1 - Number(summary.evaporationPct) / 100)) : 0) ||
    summary.totalBaseLiquidVolumeMl ||
    netMixMl ||
    0
  );
  const baseRatePerMl = Number(summary.baseCostPerMl || 0) > 0
    ? Number(summary.baseCostPerMl)
    : (preMixMl > 0 ? totalBasePrepared / preMixMl : 0);
  const allocMixMl = Number(summary.totalAllocatedMixMl || 0);
  const allocBaseCost = Number(summary.totalBaseConsumedCost || 0) > 0
    ? Number(summary.totalBaseConsumedCost)
    : round2(allocMixMl * baseRatePerMl);
  const unallocMixMl = Math.max(0, round2(netMixMl - allocMixMl));
  const unallocCost = Math.max(0, round2(totalBasePrepared - allocBaseCost));

  const baseMixExpiry = (() => {
    const dates = [];
    baseRmLines.forEach(l => {
      const exp = resolveExpiryDate(l);
      if (exp) {
        const d = new Date(exp);
        if (!isNaN(d.getTime())) dates.push(d);
      }
      (l.lots || []).forEach(lot => {
        const lExp = resolveExpiryDate(lot);
        if (lExp) {
          const d = new Date(lExp);
          if (!isNaN(d.getTime())) dates.push(d);
        }
      });
    });
    if (dates.length === 0) return null;
    dates.sort((a, b) => a.getTime() - b.getTime());
    return dates[0];
  })();

  if (netMixMl > 0) {
    const cardH = 15.5;
    ensureSpace(cardH + 3);

    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(...COLORS.indigo);
    doc.setLineWidth(0.25);
    doc.roundedRect(MARGIN, y, CONTENT_W, cardH, 1.2, 1.2, 'FD');

    doc.setFillColor(...COLORS.indigoLight);
    doc.rect(MARGIN + 0.25, y + 0.25, CONTENT_W - 0.5, 4.4, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(...COLORS.indigo);
    doc.text('BASE MIX ALLOCATION AUDIT & MULTI-DAY TANK ECONOMICS', MARGIN + 2.5, y + 3.2);

    if (canViewCost && baseRatePerMl > 0) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.2);
      doc.setTextColor(...COLORS.slateDark);
      doc.text(`Formula Valuation Rate: ${INR_FMT(baseRatePerMl, 4)} / ml`, MARGIN + CONTENT_W - 2.5, y + 3.2, { align: 'right' });
    }

    doc.setDrawColor(224, 231, 255);
    doc.setLineWidth(0.2);
    doc.line(MARGIN, y + 4.7, MARGIN + CONTENT_W, y + 4.7);

    const colSpacing = 1.2;
    const colW = (CONTENT_W - 2 - (colSpacing * 2)) / 3;
    const boxY = y + 5.5;
    const boxH = 9;

    // Col 1: Base Mix Prepared (Tank)
    let bx = MARGIN + 1;
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(bx, boxY, colW, boxH, 0.8, 0.8, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5.5);
    doc.setTextColor(...COLORS.slateMuted);
    doc.text('1. BASE MIX PREPARED (TANK)', bx + 2, boxY + 2.5);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.8);
    doc.setTextColor(...COLORS.navy);
    doc.text(`${formatIndian(netMixMl, 0)} ml`, bx + 2, boxY + 5.5);
    if (canViewCost) {
      doc.setFontSize(5.8);
      doc.setTextColor(...COLORS.emerald);
      doc.text(`${INR_FMT(totalBasePrepared)} total value`, bx + 2, boxY + 8);
    }

    // Col 2: Allocated Mix Consumed
    bx = MARGIN + 1 + colW + colSpacing;
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(bx, boxY, colW, boxH, 0.8, 0.8, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5.5);
    doc.setTextColor(...COLORS.indigo);
    const allocPct = netMixMl > 0 ? round2((allocMixMl / netMixMl) * 100) : 0;
    doc.text('2. ALLOCATED MIX CONSUMED', bx + 2, boxY + 2.5);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.8);
    doc.setTextColor(...COLORS.indigo);
    doc.text(`${formatIndian(allocMixMl, 0)} ml`, bx + 2, boxY + 5.5);
    if (canViewCost) {
      doc.setFontSize(5.8);
      doc.setTextColor(109, 40, 217);
      doc.text(`${INR_FMT(allocBaseCost)} (${allocPct}% of tank)`, bx + 2, boxY + 8);
    }

    // Col 3: Unallocated Tank Balance
    bx = MARGIN + 1 + (colW + colSpacing) * 2;
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(bx, boxY, colW, boxH, 0.8, 0.8, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5.5);
    doc.setTextColor(180, 83, 9);
    doc.text('3. UNALLOCATED TANK BALANCE', bx + 2, boxY + 2.5);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.8);
    doc.setTextColor(146, 64, 14);
    doc.text(`${formatIndian(unallocMixMl, 0)} ml`, bx + 2, boxY + 5.5);
    if (canViewCost) {
      doc.setFontSize(5.8);
      doc.setTextColor(...COLORS.slateDark);
      doc.text(`${INR_FMT(unallocCost)} reserve in tank`, bx + 2, boxY + 8);
    }

    y += cardH + 3.0;
  }

  // ── SECTION 2A: UNIQUE RAW MATERIALS CONSOLIDATED MASTER TABLE ──
  const activeUniqueRms = Array.isArray(uniqueRawMaterialsSummary) && uniqueRawMaterialsSummary.length > 0
    ? uniqueRawMaterialsSummary
    : [];

  if (activeUniqueRms.length > 0) {
    drawSectionHeading(
      '2A',
      'Unique Raw Materials Consolidated Summary — Entire Production Master Table',
      `${activeUniqueRms.length} Unique Raw Materials Consumed • Rolled Up with Total Amount Used`
    );

    // Section 2A Columns calibrated for exact 194mm width
    const uniqueCols = canViewCost
      ? [
          { key: 'code', label: 'RM Code', width: 16 },
          { key: 'name', label: 'Raw Material Name', width: 36, bold: true },
          { key: 'type', label: 'Type / Stage', width: 22 },
          { key: 'days', label: 'Days Run', width: 15, align: 'center' },
          { key: 'usedFor', label: 'Used For / Product', width: 25 },
          { key: 'lots', label: 'Batch / Lot Nos', width: 24, color: COLORS.indigo, bold: true },
          { key: 'qty', label: 'Total Consumed Qty', width: 18, align: 'right', bold: true },
          { key: 'rate', label: 'Avg Rate', width: 16, align: 'right' },
          { key: 'cost', label: 'Total Amount', width: 22, align: 'right', color: COLORS.emerald, bold: true }
        ]
      : [
          { key: 'code', label: 'RM Code', width: 18 },
          { key: 'name', label: 'Raw Material Name', width: 48, bold: true },
          { key: 'type', label: 'Type / Stage', width: 26 },
          { key: 'days', label: 'Days Run', width: 20, align: 'center' },
          { key: 'usedFor', label: 'Used For / Product', width: 32 },
          { key: 'lots', label: 'Batch / Lot Nos', width: 28, color: COLORS.indigo, bold: true },
          { key: 'qty', label: 'Total Consumed Qty', width: 22, align: 'right', bold: true }
        ];

    const uniquePdfRows = activeUniqueRms.map((r) => ({
      code: safeText(r.rawMaterialCode, 'RM'),
      name: safeText(r.rawMaterialName),
      type: safeText(r.categoryLabel),
      days: safeText(r.daysText),
      usedFor: safeText(r.usedForText),
      lots: safeText(r.lotsText, 'BATCH-DIRECT'),
      qty: `${formatIndian(r.totalConsumedQty)} ${r.uom}`,
      rate: INR_FMT(r.avgRate),
      cost: INR_FMT(r.totalCost)
    }));

    const totalUniqueCost = round2(activeUniqueRms.reduce((s, r) => s + Number(r.totalCost || 0), 0));
    const totalUniqueQty = round2(activeUniqueRms.reduce((s, r) => s + Number(r.totalConsumedQty || 0), 0));

    const uniqueFooter = canViewCost
      ? {
          code: 'TOTAL',
          name: `${activeUniqueRms.length} Unique Raw Materials`,
          type: '',
          days: '',
          usedFor: '',
          lots: 'Grand Total:',
          qty: `${formatIndian(totalUniqueQty)}`,
          rate: '',
          cost: INR_FMT(totalUniqueCost)
        }
      : {
          code: 'TOTAL',
          name: `${activeUniqueRms.length} Unique Raw Materials`,
          type: '',
          days: '',
          usedFor: '',
          lots: 'Grand Total:',
          qty: `${formatIndian(totalUniqueQty)}`
        };

    drawTable(uniqueCols, uniquePdfRows, uniqueFooter, {
      fontSize: 6.8,
      tableName: 'Section 2A: Unique Raw Materials Consolidated Master Table'
    });
  }

  // ── SECTION 2B: ENTIRE PRODUCTION RAW MATERIAL CONSUMPTION & LOT TRACEABILITY ──
  const activeEntireRmLines = Array.isArray(entireProductionRmLines) && entireProductionRmLines.length > 0
    ? entireProductionRmLines
    : [];

  if (activeEntireRmLines.length > 0) {
    drawSectionHeading(
      '2B',
      'Entire Raw Material Consumption & Lot Traceability — Detailed Ledger',
      `${activeEntireRmLines.length} Material Entries • All Days, Products & Formulations in Single Table`
    );

    // Section 2B Columns calibrated for exact 194mm width
    const entireCols = canViewCost
      ? [
          { key: 'day', label: 'Day / Date', width: 18 },
          { key: 'batch', label: 'Day Batch', width: 18, bold: true },
          { key: 'code', label: 'RM Code', width: 14 },
          { key: 'name', label: 'Raw Material Name', width: 32, bold: true },
          { key: 'usedFor', label: 'Used For / Product', width: 22 },
          { key: 'lotNo', label: 'RM Lot / Batch No', width: 20, color: COLORS.indigo, bold: true },
          { key: 'qty', label: 'Consumed Qty', width: 18, align: 'right', bold: true },
          { key: 'expiry', label: 'Lot Expiry', width: 16, align: 'center' },
          { key: 'rate', label: 'Unit Rate', width: 16, align: 'right' },
          { key: 'cost', label: 'Total Cost', width: 20, align: 'right', color: COLORS.emerald, bold: true }
        ]
      : [
          { key: 'day', label: 'Day / Date', width: 22 },
          { key: 'batch', label: 'Day Batch', width: 24, bold: true },
          { key: 'code', label: 'RM Code', width: 16 },
          { key: 'name', label: 'Raw Material Name', width: 42, bold: true },
          { key: 'usedFor', label: 'Used For / Product', width: 28 },
          { key: 'lotNo', label: 'RM Lot / Batch No', width: 24, color: COLORS.indigo, bold: true },
          { key: 'qty', label: 'Consumed Qty', width: 20, align: 'right', bold: true },
          { key: 'expiry', label: 'Lot Expiry', width: 18, align: 'center' }
        ];

    const entirePdfRows = activeEntireRmLines.map((r) => ({
      day: `${r.dayLabel || `Day ${r.dayNo}`}\n${DATE_DMY(r.productionDate, '—')}`,
      batch: safeText(r.dayBatchCode, '—'),
      code: safeText(r.rawMaterialCode, 'RM'),
      name: safeText(r.rawMaterialName),
      usedFor: safeText(r.usedFor),
      lotNo: safeText(r.lotBatchNo, 'BATCH-DIRECT'),
      qty: `${formatIndian(r.consumedQty)} ${r.uom}`,
      expiry: DATE_DMY(r.expiryDate, 'N/A'),
      rate: INR_FMT(r.unitRate),
      cost: INR_FMT(r.totalCost)
    }));

    const totalEntireCost = round2(activeEntireRmLines.reduce((s, r) => s + Number(r.totalCost || 0), 0));
    const totalEntireQty = round2(activeEntireRmLines.reduce((s, r) => s + Number(r.consumedQty || 0), 0));

    const entireFooter = canViewCost
      ? {
          day: 'TOTAL',
          batch: `${activeEntireRmLines.length} Entries`,
          code: '',
          name: 'Grand Total All Consumed Raw Materials',
          usedFor: '',
          lotNo: '',
          qty: `${formatIndian(totalEntireQty)}`,
          expiry: '',
          rate: 'Grand Total:',
          cost: INR_FMT(totalEntireCost)
        }
      : {
          day: 'TOTAL',
          batch: `${activeEntireRmLines.length} Entries`,
          code: '',
          name: 'Grand Total All Consumed Raw Materials',
          usedFor: '',
          lotNo: '',
          qty: `${formatIndian(totalEntireQty)}`,
          expiry: ''
        };

    drawTable(entireCols, entirePdfRows, entireFooter, {
      fontSize: 6.7,
      tableName: 'Section 2B: Detailed Raw Material Consumption & Traceability Ledger'
    });
  }

  // ── SECTION 3: DATE-WISE / DAY-WISE PRODUCT PRODUCTION & PER-PRODUCT RM CONSUMPTION ──
  const completedOnly = dayEntries.filter(d => d.status === 'COMPLETED' || d.status === 'Completed' || Boolean(d.pushedToSales) || Boolean(d.is_completed) || Boolean(d.isCompleted));
  const activeDayPool = completedOnly.length > 0 ? completedOnly : dayEntries;
  const filteredDays = targetDayNo
    ? activeDayPool.filter(d => Number(d.dayNo) === Number(targetDayNo))
    : activeDayPool;

  drawSectionHeading(
    '3',
    mode === 'datewise' || targetDayNo
      ? 'Date-Wise Product Production, Raw Material Lots & Yield Ledger'
      : 'Day-Wise Production Breakdown & Per-Product RM Traceability',
    `${filteredDays.length} Production Date${filteredDays.length !== 1 ? 's' : ''} Recorded`
  );

  const extractStaffNameOnly = (val) => {
    if (!val) return '';
    if (typeof val === 'object') {
      const name = val.name || val.fullName || val.userName || val.username || '';
      return extractStaffNameOnly(name);
    }
    return String(val)
      .replace(/\s*\([^)]*\)/g, '')
      .replace(/\s*\[[^\]]*\]/g, '')
      .replace(/\s{2,}/g, ' ')
      .trim();
  };

  const formatDayUsersText = (dayObj) => {
    const users = Array.isArray(dayObj?.assignedUsers) ? dayObj.assignedUsers : [];
    if (users.length > 0) {
      const names = users.map(u => extractStaffNameOnly(u)).filter(Boolean);
      if (names.length > 0) return names.join(', ');
    }
    const fallbackRaw = dayObj?.completedBy || dayObj?.startedBy || batch?.startedBy || batch?.started_by || 'Floor Operator';
    const cleanedFallback = String(fallbackRaw)
      .split(',')
      .map(s => extractStaffNameOnly(s))
      .filter(Boolean)
      .join(', ');
    return safeText(cleanedFallback || fallbackRaw, 'Floor Operator');
  };

  filteredDays.forEach((dayObj) => {
    const outputs = Array.isArray(dayObj.outputs) ? dayObj.outputs : [];

    const dayHeaderH = 17.5;
    const prodTableH = outputs.length > 0 ? (6.4 + outputs.length * 7.8 + 6.4 + 3) : 10;
    const daySummaryBlockH = dayHeaderH + prodTableH;

    if (daySummaryBlockH <= (BOTTOM_SAFE - 15)) {
      ensureSpace(daySummaryBlockH);
    } else {
      ensureSpace(32);
    }

    // Day Header Strip (Full 194mm width)
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

    // 2A. Products Produced on this Date (194mm total width)
    const prodCols = canViewCost
      ? [
          { key: 'seq', label: '#', width: 8, align: 'center', bold: true },
          { key: 'product', label: 'Product / Batch & Serial No', width: 48, bold: true },
          { key: 'spec', label: 'Mould / Spec', width: 25 },
          { key: 'mix', label: 'Mix Used', width: 22, align: 'right' },
          { key: 'expected', label: 'Planned', width: 18, align: 'right' },
          { key: 'actual', label: 'Actual Good', width: 20, align: 'right', color: COLORS.emerald, bold: true },
          { key: 'reject', label: 'Reject', width: 13, align: 'right', color: COLORS.rose },
          { key: 'yieldPct', label: 'Yield %', width: 16, align: 'right', bold: true },
          { key: 'unitCost', label: 'Cost/Unit', width: 24, align: 'right', color: COLORS.indigo, bold: true }
        ]
      : [
          { key: 'seq', label: '#', width: 8, align: 'center', bold: true },
          { key: 'product', label: 'Product / Batch & Serial No', width: 64, bold: true },
          { key: 'spec', label: 'Mould / Spec', width: 32 },
          { key: 'mix', label: 'Mix Used', width: 26, align: 'right' },
          { key: 'expected', label: 'Planned', width: 20, align: 'right' },
          { key: 'actual', label: 'Actual Good', width: 22, align: 'right', color: COLORS.emerald, bold: true },
          { key: 'reject', label: 'Reject', width: 10, align: 'right', color: COLORS.rose },
          { key: 'yieldPct', label: 'Yield %', width: 12, align: 'right', bold: true }
        ];

    const prodRows = outputs.map((out, idx) => {
      const uom = safeText(out.uom, 'pcs');
      const specText = out.useMould !== false && out.mouldCode
        ? `${out.mouldCode} (${out.trays || 0}T x ${out.cavities || 1}C)`
        : `Bulk (${safeText(out.bulkUom, uom)})`;
      const batchSerialLine = [
        out.productBatchNo ? `B: ${out.productBatchNo}` : '',
        out.productSerialNo ? `S: ${out.productSerialNo}` : ''
      ].filter(Boolean).join(' | ');
      const pStages = (productStagesMap && (productStagesMap[out.productId] || productStagesMap[out.id])) || out.timelineStages || out.stages || [];
      const stagesLine = Array.isArray(pStages) && pStages.length > 0
        ? `Stages: ${pStages.map((s, si) => `${si + 1}.${safeText(s.name)}`).join(' -> ')}`
        : '';
      const productCell = [safeText(out.productName), batchSerialLine, stagesLine].filter(Boolean).join('\n');

      const outMixMl = Number(out.allocatedBaseMl || 0);
      const outBaseCost = round2(outMixMl * baseRatePerMl);
      const mixCell = canViewCost && outBaseCost > 0
        ? `${formatIndian(outMixMl, 0)} ml\n(${INR_FMT(outBaseCost)})`
        : `${formatIndian(outMixMl, 0)} ml`;

      return {
        seq: `#${out.seq || idx + 1}`,
        product: productCell,
        spec: specText,
        mix: mixCell,
        expected: `${formatIndian(out.theoreticalQty, 0)} ${uom}`,
        actual: `${formatIndian(out.actualYield, 0)} ${uom}`,
        reject: `${formatIndian(out.rejectOutput, 0)}`,
        yieldPct: `${out.yieldPct}%`,
        unitCost: `${INR_FMT(out.unitCost)}\n(Tot ${INR_FMT(out.totalCost)})`
      };
    });

    const totMix = dayObj.allocatedMixMl || outputs.reduce((s, o) => s + Number(o.allocatedBaseMl || 0), 0);
    const totDayBaseCost = round2(totMix * baseRatePerMl);
    const totPlanned = dayObj.totalExpectedQty || outputs.reduce((s, o) => s + Number(o.theoreticalQty || 0), 0);
    const totActual = dayObj.totalOutputQty || outputs.reduce((s, o) => s + Number(o.actualYield || 0), 0);
    const totReject = dayObj.totalRejectedQty || outputs.reduce((s, o) => s + Number(o.rejectOutput || 0), 0);
    const totCost = outputs.reduce((s, o) => s + Number(o.totalCost || 0), 0);
    const avgYield = totPlanned > 0
      ? round2((totActual / totPlanned) * 100)
      : (outputs.length > 0 ? round2(outputs.reduce((s, o) => s + Number(o.yieldPct || 0), 0) / outputs.length) : 100);

    const prodFooter = canViewCost
      ? {
          seq: 'TOTAL',
          product: `Day ${dayObj.dayNo} Output Total`,
          spec: '',
          mix: `${formatIndian(totMix, 0)} ml\n(${INR_FMT(totDayBaseCost)})`,
          expected: `${formatIndian(totPlanned, 0)}`,
          actual: `${formatIndian(totActual, 0)}`,
          reject: `${formatIndian(totReject, 0)}`,
          yieldPct: `${avgYield}%`,
          unitCost: INR_FMT(totCost)
        }
      : {
          seq: 'TOTAL',
          product: `Day ${dayObj.dayNo} Output Total`,
          spec: '',
          mix: `${formatIndian(totMix, 0)} ml`,
          expected: `${formatIndian(totPlanned, 0)}`,
          actual: `${formatIndian(totActual, 0)}`,
          reject: `${formatIndian(totReject, 0)}`,
          yieldPct: `${avgYield}%`
        };

    if (prodRows.length > 0) {
      drawTable(prodCols, prodRows, prodFooter, {
        fontSize: 6.8,
        headerBg: COLORS.slateDark,
        preventBreak: true,
        tableName: `Day ${dayObj.dayNo}: Finished Goods Allocation & Output Summary`
      });
    } else {
      ensureSpace(8);
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(7.2);
      doc.setTextColor(...COLORS.slateMuted);
      doc.text('No product allocations completed for this day yet.', MARGIN + 2, y + 3);
      y += 6;
    }

    // 2B. Dedicated Unified Per-Product Raw Material Consumption & Traceability Tables
    outputs.forEach((out, oIdx) => {
      const theme = PRODUCT_THEME_COLORS[oIdx % PRODUCT_THEME_COLORS.length];
      const outMixMl = Number(out.allocatedBaseMl || 0);
      const outBaseCost = round2(outMixMl * baseRatePerMl);
      const uom = safeText(out.uom, 'pcs');

      const pRmCols = canViewCost
        ? [
            { key: 'code', label: 'RM Code', width: 18 },
            { key: 'rmName', label: 'Raw Material / Packaging Name', width: 48, bold: true },
            { key: 'lotNo', label: 'RM Batch / Lot No', width: 34, color: theme.headerBg, bold: true },
            { key: 'qty', label: 'Consumed Qty', width: 22, align: 'right', bold: true },
            { key: 'expiry', label: 'Expiry Date', width: 22, align: 'center' },
            { key: 'rate', label: 'Unit Rate', width: 24, align: 'right' },
            { key: 'cost', label: 'Total Cost', width: 26, align: 'right', color: theme.headerBg, bold: true }
          ]
        : [
            { key: 'code', label: 'RM Code', width: 24 },
            { key: 'rmName', label: 'Raw Material / Packaging Name', width: 68, bold: true },
            { key: 'lotNo', label: 'RM Batch / Lot No', width: 46, color: theme.headerBg, bold: true },
            { key: 'qty', label: 'Consumed Qty', width: 28, align: 'right', bold: true },
            { key: 'expiry', label: 'Expiry Date', width: 28, align: 'center' }
          ];

      const pRmRows = [];

      // 1. Allocated Base Mix Line
      pRmRows.push({
        code: 'BASE-MIX',
        rmName: 'Base Mix Formulation (Allocated Share)',
        lotNo: safeText(dayObj.dayBatchCode || shortCode, 'BASE-MIX'),
        qty: `${formatIndian(outMixMl, 0)} ml`,
        expiry: DATE_DMY(baseMixExpiry, 'N/A'),
        rate: `${INR_FMT(baseRatePerMl, 4)}/ml`,
        cost: INR_FMT(outBaseCost),
        _styles: {
          code: { bold: true, color: theme.headerBg },
          rmName: { bold: true, color: theme.headerBg },
          cost: { bold: true, color: theme.headerBg }
        }
      });

      // 2. Product-Specific Added RMs & Packaging
      const prms = Array.isArray(out.productRms) ? out.productRms : [];
      let pAddedCost = 0;
      prms.forEach((prm, pIdx) => {
        const lots = Array.isArray(prm.allocatedBatches) && prm.allocatedBatches.length > 0 ? prm.allocatedBatches : null;
        const pUom = safeText(prm.uom, 'pcs');
        const rate = Number(prm.unitRate ?? prm.rate ?? 0);
        if (lots && lots.length > 0) {
          lots.forEach((lot) => {
            const qtyVal = Number(lot.allocatedQty ?? prm.takenQty ?? prm.qty ?? 0);
            const rCost = round2(qtyVal * Number(lot.unitRate ?? rate));
            pAddedCost += rCost;
            pRmRows.push({
              code: safeText(prm.rawMaterialCode || prm.rmCode, `RM-${pIdx + 1}`),
              rmName: safeText(prm.rawMaterialName || prm.rmName),
              lotNo: safeText(lot.lotNumber || lot.internalBatchNo || prm.lotBatchNo, 'BATCH-DIRECT'),
              qty: `${formatIndian(qtyVal, 2)} ${formatCleanUom(lot.uom || pUom, 'pcs', prm)}`,
              expiry: DATE_DMY(resolveExpiryDate(lot) || resolveExpiryDate(prm), 'N/A'),
              rate: INR_FMT(lot.unitRate ?? rate),
              cost: INR_FMT(rCost)
            });
          });
        } else {
          const qtyVal = Number(prm.takenQty ?? prm.qty ?? 0);
          const rCost = Number(prm.totalCost) > 0 ? Number(prm.totalCost) : round2(qtyVal * rate);
          pAddedCost += rCost;
          pRmRows.push({
            code: safeText(prm.rawMaterialCode || prm.rmCode, `RM-${pIdx + 1}`),
            rmName: safeText(prm.rawMaterialName || prm.rmName),
            lotNo: safeText(prm.lotBatchNo, 'BATCH-DIRECT'),
            qty: `${formatIndian(qtyVal, 2)} ${pUom}`,
            expiry: DATE_DMY(resolveExpiryDate(prm), 'N/A'),
            rate: INR_FMT(rate),
            cost: INR_FMT(rCost)
          });
        }
      });

      const totalProductMaterials = round2(outBaseCost + pAddedCost);
      const unitMatCost = out.actualYield > 0 ? round2(totalProductMaterials / out.actualYield) : 0;

      const pRmFooter = canViewCost
        ? {
            code: 'TOTAL',
            rmName: `Total Materials for ${safeText(out.productName)}`,
            lotNo: '',
            qty: `${pRmRows.length} Item(s)`,
            expiry: '',
            rate: `Unit: ${INR_FMT(unitMatCost)}/${uom}`,
            cost: INR_FMT(totalProductMaterials)
          }
        : {
            code: 'TOTAL',
            rmName: `Total Materials for ${safeText(out.productName)}`,
            lotNo: '',
            qty: `${pRmRows.length} Item(s)`,
            expiry: ''
          };

      const estimatedTableH = 6.4 + (pRmRows.length * 6.2) + 6.4 + 3;
      const totalProductBlockH = 11 + estimatedTableH;

      if (totalProductBlockH <= (BOTTOM_SAFE - 15)) {
        ensureSpace(totalProductBlockH);
      } else {
        ensureSpace(28);
      }

      // Product Colored Header Banner (Full 194mm width)
      doc.setFillColor(...theme.badgeBg);
      doc.setDrawColor(...theme.headerBg);
      doc.setLineWidth(0.35);
      doc.roundedRect(MARGIN, y, CONTENT_W, 8.8, 1.2, 1.2, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.6);
      doc.setTextColor(...theme.headerBg);
      const prodHeaderTitle = `#${out.seq || oIdx + 1}  ${safeText(out.productName).toUpperCase()} — RAW MATERIAL CONSUMPTION & LOT TRACEABILITY`;
      doc.text(prodHeaderTitle, MARGIN + 3, y + 4.3);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.8);
      doc.setTextColor(...COLORS.slateDark);
      const specText = out.useMould !== false && out.mouldCode
        ? `${out.mouldCode} (${out.trays || 0}T x ${out.cavities || 1}C)`
        : `Bulk (${safeText(out.bulkUom, uom)})`;
      const prodSubText = `Mould/Spec: ${specText}   |   Allocated Mix: ${formatIndian(outMixMl, 0)} ml (${INR_FMT(outBaseCost)})   |   Actual Output: ${formatIndian(out.actualYield, 0)} ${uom}`;
      doc.text(prodSubText, MARGIN + 3, y + 7.6);

      y += 10.8;

      drawTable(pRmCols, pRmRows, pRmFooter, {
        fontSize: 6.6,
        headerBg: theme.headerBg,
        headerText: COLORS.white,
        preventBreak: true,
        tableName: `#${out.seq || oIdx + 1} ${safeText(out.productName)}: Raw Material Consumption`
      });
    });

    // 2C. Day Factory Process Stages Strip
    const dStages = Array.isArray(dayObj.timelineStages) && dayObj.timelineStages.length > 0
      ? dayObj.timelineStages
      : timelineStages;
    if (Array.isArray(dStages) && dStages.length > 0) {
      const stgSummary = dStages.map((s, si) => `${si + 1}. ${safeText(s.name)} (${safeText(s.targetTemp || s.defaultTemp, '-')}, ${s.durationHours || 0}h ${s.durationMinutes || 0}m)`).join('   ->   ');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.6);
      doc.setTextColor(...COLORS.slateMid);
      const wrappedStg = doc.splitTextToSize(`Stages (Day ${dayObj.dayNo}): ${stgSummary}`, CONTENT_W - 4);
      const stgH = Math.max(6, wrappedStg.length * 3.1 + 2.5);

      ensureSpace(stgH + 4);
      doc.setFillColor(...COLORS.rowAlt);
      doc.setDrawColor(...COLORS.border);
      doc.rect(MARGIN, y, CONTENT_W, stgH, 'FD');
      wrappedStg.forEach((ln, li) => {
        doc.text(ln, MARGIN + 2, y + 3.6 + li * 3.1);
      });
      y += stgH + 3.5;
    }
  });

  // ── SECTION 4: CONSOLIDATED YIELD REPORT ──
  if (yieldRows.length > 0) {
    const yieldTableH = 6.4 + (yieldRows.length * 6.5) + 6.4 + 3;
    const totalYieldBlockH = 14 + yieldTableH;
    if (totalYieldBlockH <= (BOTTOM_SAFE - 15)) {
      ensureSpace(totalYieldBlockH);
    }
    drawSectionHeading('4', 'Consolidated Output & Yield Variance Report', `${yieldRows.length} Output Summary Lines`);

    // Section 4 Columns calibrated for exact 194mm width
    const yCols = canViewCost
      ? [
          { key: 'product', label: 'Product Name', width: 48, bold: true },
          { key: 'days', label: 'Days Run', width: 20, align: 'center' },
          { key: 'mix', label: 'Total Mix (ml)', width: 24, align: 'right' },
          { key: 'expected', label: 'Planned Qty', width: 20, align: 'right' },
          { key: 'actual', label: 'Actual Good', width: 22, align: 'right', color: COLORS.emerald, bold: true },
          { key: 'reject', label: 'Rejected', width: 16, align: 'right', color: COLORS.rose },
          { key: 'eff', label: 'Yield %', width: 18, align: 'right', bold: true },
          { key: 'totalCost', label: 'Total Cost', width: 26, align: 'right', color: COLORS.indigo, bold: true }
        ]
      : [
          { key: 'product', label: 'Product Name', width: 58, bold: true },
          { key: 'days', label: 'Days Run', width: 26, align: 'center' },
          { key: 'mix', label: 'Total Mix (ml)', width: 28, align: 'right' },
          { key: 'expected', label: 'Planned Qty', width: 24, align: 'right' },
          { key: 'actual', label: 'Actual Good', width: 26, align: 'right', color: COLORS.emerald, bold: true },
          { key: 'reject', label: 'Rejected', width: 16, align: 'right', color: COLORS.rose },
          { key: 'eff', label: 'Yield %', width: 16, align: 'right', bold: true }
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

    drawTable(yCols, yPdfRows, yFooter, {
      fontSize: 6.9,
      preventBreak: true,
      tableName: 'Section 4: Consolidated Output & Yield Variance Report'
    });
  }

  // ── SECTION 5: FINANCIAL COST STATEMENT ──
  if (canViewCost) {
    const costTableH = 6.4 + (5 * 6.5) + 6.4 + 3;
    const totalCostBlockH = 14 + costTableH;
    if (totalCostBlockH <= (BOTTOM_SAFE - 15)) {
      ensureSpace(totalCostBlockH);
    }
    drawSectionHeading('5', 'Comprehensive Financial Cost Statement', 'Audited Batch Economics');

    // Section 5 Columns calibrated for exact 194mm width
    const costCols = [
      { key: 'head', label: 'Cost Component', width: 94, bold: true },
      { key: 'notes', label: 'Basis / Remarks', width: 60 },
      { key: 'amount', label: 'Amount (INR)', width: 40, align: 'right', color: COLORS.navy, bold: true }
    ];
    const costRows = [
      { head: '1. Base Raw Materials Consumed (Allocated Mix)', notes: `Allocated share: ${formatIndian(summary.totalAllocatedMixMl, 0)} ml @ base mix rate (${INR_FMT(baseRatePerMl, 4)}/ml)`, amount: INR_FMT(summary.totalBaseConsumedCost) },
      { head: '2. Product-Specific Added RMs & Packaging', notes: 'Flavours, essences, sticks & poly covers', amount: INR_FMT(summary.totalAddedRmsCost) },
      { head: '3. Direct Production Labour', notes: `Total crew cost across ${filteredDays.length || 1} day(s)`, amount: INR_FMT(summary.directLabourCost) },
      { head: '4. Electricity & Freezer Utilities (EB)', notes: 'Metered chiller / tank / tunnel consumption', amount: INR_FMT(summary.electricityCost) },
      { head: '5. Factory Overheads', notes: 'Allocated plant overhead charges', amount: INR_FMT(summary.overheadCost) }
    ];
    const costFooter = {
      head: 'GRAND TOTAL PRODUCTION COST',
      notes: `Unit Cost = ${INR_FMT(summary.costPerUnit)} / ${safeText(summary.productUom, 'pcs')}`,
      amount: INR_FMT(summary.totalCost)
    };
    drawTable(costCols, costRows, costFooter, {
      fontSize: 7.2,
      preventBreak: true,
      tableName: 'Section 5: Comprehensive Financial Cost Statement'
    });

    // 4B. COMPREHENSIVE FINANCIAL COST STATEMENT FOR EACH FINISHED PRODUCT
    const allFilteredOutputs = filteredDays.flatMap(d => Array.isArray(d.outputs) ? d.outputs : []);
    if (allFilteredOutputs.length > 0) {
      ensureSpace(14);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.2);
      doc.setTextColor(...COLORS.indigo);
      doc.text('Product-Wise Comprehensive Financial Cost Statements (Audited Unit Economics)', MARGIN, y + 3.5);
      y += 5.5;

      allFilteredOutputs.forEach((p, pIdx) => {
        const theme = PRODUCT_THEME_COLORS[pIdx % PRODUCT_THEME_COLORS.length];
        const pMix = Number(p.allocatedBaseMl || 0);
        const pBaseCost = round2(pMix * baseRatePerMl);
        const pAddedCost = round2((p.productRms || []).reduce((s, r) => s + (Number(r.totalCost) > 0 ? Number(r.totalCost) : Number(r.takenQty || 0) * Number(r.unitRate || 0)), 0));

        const parentDay = filteredDays.find(d => (d.outputs || []).some(o => (o.productId && o.productId === p.productId) || o.id === p.id || o.seq === p.seq)) || filteredDays[0];
        const dayOutputs = parentDay ? (parentDay.outputs || []) : allFilteredOutputs;
        const dayTotalMix = dayOutputs.reduce((s, o) => s + Number(o.allocatedBaseMl || 0), 0);
        const dayStaff = Array.isArray(parentDay?.assignedUsers) ? parentDay.assignedUsers : [];
        const dayStaffLabour = dayStaff.reduce((s, u) => s + Number(u.amount !== undefined ? u.amount : (u.daySalary || 0)), 0);
        const effectiveDayLabour = dayStaffLabour > 0
          ? dayStaffLabour
          : Number(parentDay?.labourTotalCost ?? parentDay?.labourCost ?? summary.directLabourCost ?? 0);

        let pLabour = 0;
        if (p.labourCostOverride !== undefined && Number(p.labourCostOverride) > 0) {
          pLabour = round2(Number(p.labourCostOverride));
        } else if (effectiveDayLabour > 0 && dayTotalMix > 0) {
          pLabour = round2(effectiveDayLabour * (pMix / dayTotalMix));
        } else {
          pLabour = Number(p.allocatedLabourCost ?? p.labourAllocatedAmt ?? 0);
        }

        const pEb = Number(p.allocatedEbCost ?? p.ebAllocatedAmt ?? 0);
        const pOverhead = Number(summary.totalAllocatedMixMl || 0) > 0
          ? round2(Number(summary.overheadCost || 0) * (pMix / Number(summary.totalAllocatedMixMl)))
          : 0;
        const pTotalCost = round2(pBaseCost + pAddedCost + pLabour + pEb + pOverhead);
        const pUnit = safeText(p.uom, 'pcs');
        const pUnitCost = p.actualYield > 0 ? round2(pTotalCost / p.actualYield) : 0;

        const pCostCols = [
          { key: 'head', label: `Cost Component — #${p.seq || pIdx + 1} ${safeText(p.productName).toUpperCase()} (${formatIndian(p.actualYield, 0)} ${pUnit})`, width: 94, bold: true },
          { key: 'notes', label: 'Basis / Remarks', width: 60 },
          { key: 'amount', label: 'Amount (INR)', width: 40, align: 'right', bold: true }
        ];

        const pCostRows = [
          { head: '1. Base Mix Formulation (Allocated)', notes: `Allocated share: ${formatIndian(pMix, 0)} ml @ base mix rate (${INR_FMT(baseRatePerMl, 4)}/ml)`, amount: INR_FMT(pBaseCost) },
          { head: '2. Product-Specific Added RMs & Packaging', notes: `Flavours, essences, packaging & direct additions (${p.productRms?.length || 0} items)`, amount: INR_FMT(pAddedCost) },
          { head: '3. Direct Production Labour', notes: 'Allocated production crew cost', amount: INR_FMT(pLabour) },
          { head: '4. Electricity & Freezer Utilities (EB)', notes: 'Allocated chiller / tank / freezer power', amount: INR_FMT(pEb) },
          { head: '5. Factory Overheads', notes: 'Allocated plant overhead charges', amount: INR_FMT(pOverhead) }
        ];

        const pCostFooter = {
          head: `TOTAL ${safeText(p.productName).toUpperCase()} PRODUCTION COST`,
          notes: `Unit Cost = ${INR_FMT(pUnitCost)} / ${pUnit}`,
          amount: INR_FMT(pTotalCost)
        };

        const singleProductCostH = 6.4 + (5 * 6.2) + 6.4 + 4;
        if (singleProductCostH <= (BOTTOM_SAFE - 15)) {
          ensureSpace(singleProductCostH);
        }

        drawTable(pCostCols, pCostRows, pCostFooter, {
          fontSize: 6.9,
          headerBg: theme.headerBg,
          headerText: COLORS.white,
          preventBreak: true,
          tableName: `#${p.seq || pIdx + 1} ${safeText(p.productName)}: Financial Statement`
        });
      });
    }

    // 4C. DIRECT PRODUCTION LABOUR DAY-WISE CREW BIFURCATION AUDIT
    const labourRows = [];
    let crewShiftCount = 0;
    let computedLabourTotal = 0;

    filteredDays.forEach(d => {
      const dayLabel = `Day ${d.dayNo || 1} • ${DATE_DMY(d.productionDate || batch?.startDate)}`;
      const batchCode = safeText(d.dayBatchCode || d.day_batch_code || batch?.batchCode || batch?.shortCode, '-');
      const staffList = Array.isArray(d.assignedUsers) && d.assignedUsers.length > 0 ? d.assignedUsers : [];

      if (staffList.length > 0) {
        staffList.forEach(u => {
          crewShiftCount++;
          const staffName = extractStaffNameOnly(u?.name || u?.userName || u);
          const empId = u?.empId || u?.userCode || u?.employeeId ? ` (${u?.empId || u?.userCode || u?.employeeId})` : '';
          const role = safeText(u?.role || 'PRODUCTION_STAFF', 'PRODUCTION_STAFF');
          const yearlyCtc = Number(u?.yearlyCtc || 0);
          const grossPay = Number(u?.grossPay || 0);
          const monthlySalary = Number(u?.monthlySalary || (yearlyCtc > 0 ? Math.round((yearlyCtc / 12) * 100) / 100 : (grossPay > 0 ? grossPay : 0)));
          const daySalary = Number(u?.daySalary || (monthlySalary > 0 ? Math.round(monthlySalary / 30) : 0));
          const lineAmt = Number(u?.amount !== undefined ? u.amount : (daySalary > 0 ? daySalary : 0));
          computedLabourTotal += lineAmt;

          let basisText = 'Standard Shift Wage';
          if (yearlyCtc > 0) {
            basisText = `CTC ${INR_FMT(yearlyCtc)}/yr (Mo: ${INR_FMT(monthlySalary)}) / 30`;
          } else if (grossPay > 0) {
            basisText = `Gross ${INR_FMT(grossPay)}/mo / 30`;
          } else if (monthlySalary > 0) {
            basisText = `Mo: ${INR_FMT(monthlySalary)} / 30`;
          } else if (lineAmt > 0) {
            basisText = `Day Rate: ${INR_FMT(lineAmt)}`;
          }

          labourRows.push({
            day: dayLabel,
            batch: batchCode,
            staff: `${staffName}${empId}`,
            role: role,
            basis: basisText,
            amount: INR_FMT(lineAmt)
          });
        });
      } else {
        crewShiftCount++;
        const fallbackName = formatDayUsersText(d);
        const dayLabourAmt = Number(d.labourTotalCost ?? d.labourCost ?? 0);
        computedLabourTotal += dayLabourAmt;
        labourRows.push({
          day: dayLabel,
          batch: batchCode,
          staff: fallbackName,
          role: 'Floor Operator',
          basis: 'Shift Crew Allocation',
          amount: INR_FMT(dayLabourAmt)
        });
      }
    });

    if (labourRows.length > 0) {
      ensureSpace(16);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.2);
      doc.setTextColor(...COLORS.indigo);
      doc.text('Direct Production Labour Day-Wise Crew Bifurcation Audit', MARGIN, y + 3.5);
      y += 5.5;

      // Direct Labour Columns calibrated for exact 194mm width
      const labourCols = [
        { key: 'day', label: 'Day & Production Date', width: 30, bold: true },
        { key: 'batch', label: 'Day Batch No', width: 22, color: COLORS.indigo, bold: true },
        { key: 'staff', label: 'Assigned Staff Name & ID', width: 44, bold: true },
        { key: 'role', label: 'Role / Designation', width: 26 },
        { key: 'basis', label: 'Salary Basis (User Master / 30)', width: 46 },
        { key: 'amount', label: 'Day Charge (INR)', width: 26, align: 'right', color: COLORS.amber, bold: true }
      ];

      const labourFooter = {
        day: 'TOTAL DIRECT LABOUR',
        batch: `${filteredDays.length} Day(s)`,
        staff: `${crewShiftCount} Assigned Staff Shift(s)`,
        role: '-',
        basis: 'Audited Floor Payroll Cost',
        amount: INR_FMT(summary.directLabourCost > 0 ? summary.directLabourCost : computedLabourTotal)
      };

      const estimatedLabourTableH = 6.4 + (labourRows.length * 6.5) + 6.4 + 3;
      if (estimatedLabourTableH <= (BOTTOM_SAFE - 15)) {
        ensureSpace(estimatedLabourTableH);
      }

      drawTable(labourCols, labourRows, labourFooter, {
        fontSize: 6.8,
        preventBreak: estimatedLabourTableH <= (BOTTOM_SAFE - 15),
        tableName: 'Section 5C: Direct Production Crew Labour Audit'
      });
    }
  }

  // ── SECTION 6: QA REMARKS & AUTHORIZED SIGN-OFF ──
  const totalSignBlockH = 14 + 10 + 3 + 18 + 4;
  ensureSpace(totalSignBlockH);
  drawSectionHeading('6', 'Quality Assurance & Authorized Process Sign-Off');

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
  doc.text(safeText(completionNotes, 'Verified batch production execution & traceability record.').slice(0, 130), MARGIN + 2.5, y + 8);
  y += 13;

  // 3 Signature boxes calibrated for exact 194mm width (62.6mm each + 3mm gap)
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
  const genTime = new Date().toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });

  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);

    // Full width divider line above footer
    doc.setDrawColor(...COLORS.border);
    doc.setLineWidth(0.25);
    doc.line(MARGIN, PAGE_H - 8.5, PAGE_W - MARGIN, PAGE_H - 8.5);

    // Left info: Company, Prod No, Batch Code, Timestamp
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.8);
    doc.setTextColor(...COLORS.navy);
    doc.text(companyName.toUpperCase(), MARGIN, PAGE_H - 4.8);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(...COLORS.slateMuted);
    const compW = (doc.getStringUnitWidth(companyName.toUpperCase()) * 6.8) / doc.internal.scaleFactor;
    doc.text(` | Prod No: ${prodNo} | Batch: ${shortCode} | Printed: ${genTime}`, MARGIN + compW + 1.5, PAGE_H - 4.8);

    // Right Page X of Y Badge
    doc.setFillColor(...COLORS.indigoLight);
    doc.setDrawColor(...COLORS.indigo);
    doc.setLineWidth(0.2);
    doc.roundedRect(PAGE_W - MARGIN - 26, PAGE_H - 7.5, 26, 4.4, 1, 1, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.8);
    doc.setTextColor(...COLORS.indigo);
    doc.text(`Page ${i} of ${pageCount}`, PAGE_W - MARGIN - 13, PAGE_H - 4.5, { align: 'center' });
  }

  const sanitizedProd = prodNo.replace(/[^a-zA-Z0-9_-]/g, '_');
  const suffix = targetDayNo
    ? `Day${targetDayNo}_${DATE_DMY(filteredDays[0]?.productionDate || batch?.startDate).replace(/-/g, '')}`
    : (mode === 'datewise' ? 'DateWise' : 'CleanSheet');
  doc.save(`${sanitizedProd}_${suffix}_Report.pdf`);
}
