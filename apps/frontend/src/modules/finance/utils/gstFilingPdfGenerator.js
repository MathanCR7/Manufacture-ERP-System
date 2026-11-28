import { jsPDF } from 'jspdf';
import { formatBankDisplayDate } from '../components/bank-statement/bankStatementHelpers';

function safePdfText(val, fallback = '-') {
  if (val === null || val === undefined || val === '') return fallback;
  return String(val)
    .replace(/₹/g, 'Rs. ')
    .replace(/✓/g, 'Yes')
    .replace(/⚠/g, '!')
    .replace(/•/g, '|')
    .replace(/→/g, '->')
    .replace(/–|—/g, '-');
}

function fmtRs(val) {
  const num = Number(val || 0);
  if (!Number.isFinite(num)) return 'Rs. 0.00';
  const sign = num < 0 ? '-' : '';
  const abs = Math.abs(num);
  const formatted = new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(abs);
  return `${sign}Rs. ${formatted}`;
}

function resolveBadgeStyle(rawText) {
  const txt = String(rawText || '').trim().toLowerCase();
  if (txt === 'complete' || txt === 'yes' || txt === 'reviewed' || txt === 'accepted') {
    return { bg: [230, 245, 239], border: [167, 227, 204], text: [8, 122, 85] };
  }
  if (txt === 'docs pending' || txt === 'no' || txt === 'rejected') {
    return { bg: [253, 236, 236], border: [245, 189, 195], text: [180, 35, 47] };
  }
  if (txt === 'pending' || txt === 'needs review' || txt === 're-check') {
    return { bg: [254, 244, 230], border: [245, 208, 155], text: [138, 83, 0] };
  }
  return { bg: [241, 245, 249], border: [203, 213, 225], text: [71, 85, 105] };
}

/**
 * Generates an executive A4 Landscape GST Working Paper & Filing PDF Report.
 * Includes non-orphaned section headings, vertical column gridlines, pill badges,
 * repeating table headers across page breaks, tax-head breakup, and Page X of Y footers.
 */
export function exportGstFilingPdf({
  company = {},
  finYear = 'ALL',
  month = 'ALL',
  accountLabel = 'All Bank Accounts',
  kpis = {},
  taxBreakup = {},
  monthlySummary = [],
  itcRegister = [],
  allEntries = []
}) {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 297mm
  const pageHeight = doc.internal.pageSize.getHeight(); // 210mm
  const margin = 10;
  const usableW = pageWidth - margin * 2; // 277mm
  const bottomLimit = pageHeight - 14;
  let y = margin;

  const companyName = safePdfText(company.companyName || 'MANUFACTURING ERP', 'MANUFACTURING ERP');
  const companyGstin = safePdfText(company.companyGstin || company.taxRegNo || '', '');
  const companyPan = safePdfText(company.companyPan || '', '');
  const generatedStr = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
  const periodLabel = month && month !== 'ALL' ? `${month} | FY ${finYear}` : `FY ${finYear}`;

  const drawPageTopBanner = (isFirstPage = false) => {
    const bannerH = isFirstPage ? 22 : 12.5;
    doc.setFillColor(17, 26, 54); // #111A36
    doc.rect(0, 0, pageWidth, bannerH, 'F');

    // Accent strip along bottom edge of header banner
    doc.setFillColor(54, 70, 201); // #3646C9
    doc.rect(0, bannerH, pageWidth, 1.1, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(isFirstPage ? 12.5 : 9.5);
    doc.text('GST WORKING PAPER & FILING REPORT', margin, isFirstPage ? 8.5 : 8);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(224, 231, 255);
    const metaRight = `Period: ${safePdfText(periodLabel)}   |   Account: ${safePdfText(accountLabel)}`;
    doc.text(metaRight, pageWidth - margin, isFirstPage ? 8.5 : 8, { align: 'right' });

    if (isFirstPage) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(203, 213, 225);
      const compLine = `${companyName}${companyGstin ? `   |   GSTIN: ${companyGstin}` : ''}${companyPan ? `   |   PAN: ${companyPan}` : ''}`;
      doc.text(compLine, margin, 16);
      doc.text(`Generated: ${safePdfText(generatedStr)} (IST)`, pageWidth - margin, 16, { align: 'right' });
      y = 26.5;
    } else {
      y = 17;
    }
  };

  const ensureSpace = (neededMm, onNewPage) => {
    if (y + neededMm > bottomLimit) {
      doc.addPage();
      drawPageTopBanner(false);
      if (typeof onNewPage === 'function') onNewPage();
      return true;
    }
    return false;
  };

  /**
   * Reserves enough space (28mm) so a section heading NEVER orphans without its table header + first row.
   */
  const drawSectionHeading = (title, subtitle = '', countLabel = '') => {
    ensureSpace(28);
    const boxH = subtitle ? 10 : 7.5;
    doc.setFillColor(238, 242, 248); // #EEF2F8
    doc.setDrawColor(203, 213, 225); // #CBD5E1
    doc.roundedRect(margin, y, usableW, boxH, 1.5, 1.5, 'FD');

    // Left vertical indigo accent
    doc.setFillColor(54, 70, 201);
    doc.roundedRect(margin, y, 1.8, boxH, 0.8, 0.8, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.2);
    doc.setTextColor(20, 33, 61);
    doc.text(safePdfText(title), margin + 4, y + 4.8);

    if (countLabel) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(54, 70, 201);
      doc.text(safePdfText(countLabel), pageWidth - margin - 3, y + 4.8, { align: 'right' });
    }

    if (subtitle) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      doc.text(safePdfText(subtitle), margin + 4, y + 8.5);
    }
    y += boxH + 1.8;
  };

  /**
   * Full-width vector table drawer with strict cell padding (2.2mm), vertical gridlines,
   * badge pills, and repeating headers across page breaks.
   */
  const drawTable = (sectionTitle, columns, dataRows, totalRow = null, emptyLabel = 'No records available.') => {
    const rawSum = columns.reduce((s, c) => s + c.w, 0);
    const cols = columns.map((c) => ({ ...c, w: (c.w / rawSum) * usableW }));
    const padX = 2.2;

    const drawVerticalDividers = (rowY, rowH, colorRgb) => {
      doc.setDrawColor(...colorRgb);
      let vx = margin;
      for (let i = 0; i < cols.length - 1; i++) {
        vx += cols[i].w;
        doc.line(vx, rowY, vx, rowY + rowH);
      }
    };

    const drawTableHeader = (continued = false) => {
      if (continued) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.8);
        doc.setTextColor(54, 70, 201);
        doc.text(`${safePdfText(sectionTitle)} (Continued)`, margin, y + 3.5);
        y += 5;
      }
      const headerH = 7;
      doc.setFillColor(20, 33, 61); // #14213D
      doc.rect(margin, y, usableW, headerH, 'F');
      drawVerticalDividers(y, headerH, [51, 65, 85]);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(255, 255, 255);
      let x = margin;
      for (const col of cols) {
        const tx = col.align === 'right' ? x + col.w - padX : col.align === 'center' ? x + col.w / 2 : x + padX;
        const align = col.align === 'right' ? 'right' : col.align === 'center' ? 'center' : 'left';
        doc.text(safePdfText(col.header), tx, y + 4.7, { align });
        x += col.w;
      }
      y += headerH;
    };

    ensureSpace(16);
    drawTableHeader(false);

    if (!dataRows || dataRows.length === 0) {
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(203, 213, 225);
      doc.rect(margin, y, usableW, 8, 'FD');
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      doc.text(emptyLabel, margin + usableW / 2, y + 5, { align: 'center' });
      y += 11;
      return;
    }

    for (let rIdx = 0; rIdx < dataRows.length; rIdx++) {
      const row = dataRows[rIdx];
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.9);

      const wrappedCells = cols.map((col, cIdx) => {
        const val = safePdfText(row[cIdx], '');
        return doc.splitTextToSize(val, Math.max(4, col.w - padX * 2));
      });
      const maxLines = Math.max(1, ...wrappedCells.map((arr) => arr.length));
      const rowH = Math.max(6.2, maxLines * 3.2 + 2.6);

      ensureSpace(rowH, () => drawTableHeader(true));

      if (rIdx % 2 === 1) {
        doc.setFillColor(243, 246, 251); // #F3F6FB zebra tint
      } else {
        doc.setFillColor(255, 255, 255);
      }
      doc.setDrawColor(203, 213, 225);
      doc.rect(margin, y, usableW, rowH, 'FD');
      drawVerticalDividers(y, rowH, [226, 232, 240]);

      let x = margin;
      for (let cIdx = 0; cIdx < cols.length; cIdx++) {
        const col = cols[cIdx];
        const rawVal = safePdfText(row[cIdx], '');
        const lines = wrappedCells[cIdx];

        if (col.badge && rawVal && rawVal !== '-') {
          const style = resolveBadgeStyle(rawVal);
          const pillW = Math.min(col.w - 3, Math.max(11, doc.getTextWidth(rawVal) + 4));
          const pillH = 4.2;
          const pillX = col.align === 'center' ? x + (col.w - pillW) / 2 : x + padX - 0.5;
          const pillY = y + (rowH - pillH) / 2;
          doc.setFillColor(...style.bg);
          doc.setDrawColor(...style.border);
          doc.roundedRect(pillX, pillY, pillW, pillH, 1.1, 1.1, 'FD');
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(6.5);
          doc.setTextColor(...style.text);
          doc.text(rawVal, pillX + pillW / 2, pillY + 2.95, { align: 'center' });
        } else {
          if (col.color === 'green') doc.setTextColor(8, 122, 85);
          else if (col.color === 'red') doc.setTextColor(180, 35, 47);
          else if (col.color === 'amber') doc.setTextColor(138, 83, 0);
          else if (col.color === 'indigo') doc.setTextColor(54, 70, 201);
          else if (col.bold) doc.setTextColor(20, 33, 61);
          else doc.setTextColor(51, 65, 85);

          doc.setFont('helvetica', col.bold ? 'bold' : 'normal');
          doc.setFontSize(6.9);
          const tx = col.align === 'right' ? x + col.w - padX : col.align === 'center' ? x + col.w / 2 : x + padX;
          const align = col.align === 'right' ? 'right' : col.align === 'center' ? 'center' : 'left';
          doc.text(lines, tx, y + 4.1, { align });
        }
        x += col.w;
      }
      y += rowH;
    }

    if (totalRow) {
      const totH = 7;
      ensureSpace(totH, () => drawTableHeader(true));
      doc.setFillColor(238, 242, 248); // #EEF2F8
      doc.setDrawColor(148, 163, 184); // #94A3B8
      doc.rect(margin, y, usableW, totH, 'FD');
      drawVerticalDividers(y, totH, [203, 213, 225]);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.2);
      let x = margin;
      for (let cIdx = 0; cIdx < cols.length; cIdx++) {
        const col = cols[cIdx];
        if (col.color === 'green') doc.setTextColor(8, 122, 85);
        else if (col.color === 'red') doc.setTextColor(180, 35, 47);
        else if (col.color === 'amber') doc.setTextColor(138, 83, 0);
        else doc.setTextColor(20, 33, 61);
        const tx = col.align === 'right' ? x + col.w - padX : col.align === 'center' ? x + col.w / 2 : x + padX;
        const align = col.align === 'right' ? 'right' : col.align === 'center' ? 'center' : 'left';
        doc.text(safePdfText(totalRow[cIdx], ''), tx, y + 4.7, { align });
        x += col.w;
      }
      y += totH + 3.5;
    } else {
      y += 4;
    }
  };

  // --- PAGE 1 HEADER & EXECUTIVE CARDS ---
  drawPageTopBanner(true);

  // Notice strip with left amber bar
  doc.setFillColor(254, 244, 230);
  doc.setDrawColor(245, 198, 125);
  doc.roundedRect(margin, y, usableW, 6.8, 1.3, 1.3, 'FD');
  doc.setFillColor(217, 119, 6);
  doc.roundedRect(margin, y, 1.8, 6.8, 0.8, 0.8, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.3);
  doc.setTextColor(138, 83, 0);
  doc.text('WORKING PAPER NOTICE: Prepared from bank ledger & linked ERP invoices for CA / GST filing review. Verify GSTR-2B eligibility before statutory filing.', margin + 4, y + 4.4);
  y += 9;

  // Executive 6-KPI Cards with top colored indicator bar
  const kpiCards = [
    { label: 'TOTAL BANK ENTRIES', val: String(kpis.entries || 0), color: [20, 33, 61], accent: [54, 70, 201] },
    { label: 'NEEDS REVIEW', val: String(kpis.needsReview || 0), color: [138, 83, 0], accent: [217, 119, 6] },
    { label: 'DOCS PENDING', val: String(kpis.docsPending || 0), color: [180, 35, 47], accent: [225, 29, 72] },
    { label: 'ITC DOCS COMPLETE', val: fmtRs(kpis.itcDocsComplete || 0), color: [8, 122, 85], accent: [16, 185, 129] },
    { label: 'ITC DOCS PENDING', val: fmtRs(kpis.itcDocsPending || 0), color: [234, 88, 12], accent: [249, 115, 22] },
    { label: 'SALES RECEIPTS', val: fmtRs(kpis.salesReceipts || 0), color: [54, 70, 201], accent: [79, 70, 229] }
  ];
  const cardGap = 2.5;
  const cardW = (usableW - cardGap * (kpiCards.length - 1)) / kpiCards.length;
  kpiCards.forEach((c, idx) => {
    const cx = margin + idx * (cardW + cardGap);
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(cx, y, cardW, 13.5, 1.5, 1.5, 'FD');
    doc.setFillColor(...c.accent);
    doc.rect(cx + 0.5, y, cardW - 1, 1.1, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.3);
    doc.setTextColor(100, 116, 139);
    doc.text(c.label, cx + 2.5, y + 5.1);
    doc.setFontSize(9.2);
    doc.setTextColor(...c.color);
    doc.text(c.val, cx + 2.5, y + 10.9);
  });
  y += 16;

  // Tax-Head Breakup & Filing Readiness Strip
  const totalUniqueItc = Number(taxBreakup.totalTax || 0);
  const reviewedCount = Math.max(0, Number(kpis.entries || 0) - Number(kpis.needsReview || 0));
  const totalEntriesCount = Number(kpis.entries || 0);
  const reviewPct = totalEntriesCount > 0 ? Math.round((reviewedCount / totalEntriesCount) * 100) : 0;

  const breakupCells = [
    { label: 'CGST (UNIQUE ITC)', val: fmtRs(taxBreakup.cgst || 0), color: [20, 33, 61] },
    { label: 'SGST (UNIQUE ITC)', val: fmtRs(taxBreakup.sgst || 0), color: [20, 33, 61] },
    { label: 'IGST (UNIQUE ITC)', val: fmtRs(taxBreakup.igst || 0), color: [20, 33, 61] },
    { label: 'TOTAL REGISTERED ITC TAX', val: fmtRs(totalUniqueItc), color: [8, 122, 85] },
    { label: 'REVIEW READINESS', val: `${reviewedCount}/${totalEntriesCount} (${reviewPct}%)`, color: [54, 70, 201] }
  ];
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(margin, y, usableW, 10.5, 1.5, 1.5, 'FD');
  const bW = usableW / breakupCells.length;
  breakupCells.forEach((cell, idx) => {
    const bx = margin + idx * bW;
    if (idx > 0) {
      doc.setDrawColor(226, 232, 240);
      doc.line(bx, y + 1.5, bx, y + 9);
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.2);
    doc.setTextColor(100, 116, 139);
    doc.text(cell.label, bx + 3, y + 4);
    doc.setFontSize(8.2);
    doc.setTextColor(...cell.color);
    doc.text(cell.val, bx + 3, y + 8.6);
  });
  y += 13.5;

  // SECTION 1: Monthly Bank Statement GST Summary
  drawSectionHeading(
    '1. Monthly Bank Statement GST Summary',
    'Month-wise bank credits, debits, classified sales receipts, and verified vs pending Input Tax Credit',
    `${monthlySummary.length} Month(s)`
  );
  const s1Rows = monthlySummary.map((m) => [
    `${m.month} (${m.finYear})`,
    String(m.entries),
    fmtRs(m.credit),
    fmtRs(m.debit),
    fmtRs(m.salesReceipts),
    fmtRs(m.itcComplete),
    fmtRs(m.itcPending),
    String(m.needsReviewCount)
  ]);
  const s1Tot = monthlySummary.reduce(
    (acc, m) => {
      acc.entries += Number(m.entries || 0);
      acc.credit += Number(m.credit || 0);
      acc.debit += Number(m.debit || 0);
      acc.sales += Number(m.salesReceipts || 0);
      acc.itcC += Number(m.itcComplete || 0);
      acc.itcP += Number(m.itcPending || 0);
      acc.rev += Number(m.needsReviewCount || 0);
      return acc;
    },
    { entries: 0, credit: 0, debit: 0, sales: 0, itcC: 0, itcP: 0, rev: 0 }
  );
  drawTable(
    '1. Monthly Bank Statement GST Summary',
    [
      { header: 'Month (FY)', w: 36, bold: true },
      { header: 'Entries', w: 18, align: 'right' },
      { header: 'Total Credit', w: 36, align: 'right', color: 'green' },
      { header: 'Total Debit', w: 36, align: 'right', color: 'red' },
      { header: 'Sales Receipts', w: 38, align: 'right', color: 'indigo' },
      { header: 'ITC Complete', w: 38, align: 'right', color: 'green', bold: true },
      { header: 'ITC Pending', w: 38, align: 'right', color: 'amber' },
      { header: 'Needs Review', w: 24, align: 'right' }
    ],
    s1Rows,
    s1Rows.length > 0
      ? ['TOTAL', String(s1Tot.entries), fmtRs(s1Tot.credit), fmtRs(s1Tot.debit), fmtRs(s1Tot.sales), fmtRs(s1Tot.itcC), fmtRs(s1Tot.itcP), String(s1Tot.rev)]
      : null
  );

  // SECTION 2: Verified ITC Register
  drawSectionHeading(
    '2. Input Tax Credit (ITC) Invoice Register (Unique Invoice Tax Breakup)',
    'Unique supplier invoices matched to bank payments - split payments never double-count CGST/SGST/IGST',
    `${(itcRegister || []).length} Invoice(s)`
  );
  const s2Rows = (itcRegister || []).map((inv) => [
    inv.invoice_no || '-',
    inv.invoice_date ? formatBankDisplayDate(inv.invoice_date) : '-',
    inv.party_name || '-',
    inv.gstin || '-',
    inv.hsn_sac || '-',
    fmtRs(inv.taxable || 0),
    fmtRs(inv.cgst || 0),
    fmtRs(inv.sgst || 0),
    fmtRs(inv.igst || 0),
    fmtRs(inv.total_tax || 0),
    inv.found_in_gstr2b || 'Not Checked',
    inv.docs_complete ? 'Complete' : 'Pending'
  ]);
  const s2Tot = (itcRegister || []).reduce(
    (acc, i) => {
      acc.taxable += Number(i.taxable || 0);
      acc.cgst += Number(i.cgst || 0);
      acc.sgst += Number(i.sgst || 0);
      acc.igst += Number(i.igst || 0);
      acc.tax += Number(i.total_tax || 0);
      return acc;
    },
    { taxable: 0, cgst: 0, sgst: 0, igst: 0, tax: 0 }
  );
  drawTable(
    '2. Input Tax Credit Register',
    [
      { header: 'Invoice No', w: 24, bold: true },
      { header: 'Inv Date', w: 22 },
      { header: 'Party / Vendor', w: 36 },
      { header: 'GSTIN', w: 29 },
      { header: 'HSN/SAC', w: 16 },
      { header: 'Taxable', w: 23, align: 'right' },
      { header: 'CGST', w: 20, align: 'right' },
      { header: 'SGST', w: 20, align: 'right' },
      { header: 'IGST', w: 20, align: 'right' },
      { header: 'Total Tax', w: 24, align: 'right', color: 'green', bold: true },
      { header: '2B', w: 19, align: 'center', badge: true },
      { header: 'Docs', w: 24, align: 'center', badge: true }
    ],
    s2Rows,
    s2Rows.length > 0 ? ['TOTAL', '', '', '', '', fmtRs(s2Tot.taxable), fmtRs(s2Tot.cgst), fmtRs(s2Tot.sgst), fmtRs(s2Tot.igst), fmtRs(s2Tot.tax), '', ''] : null,
    'No ITC invoices linked or entered for this period.'
  );

  // SECTION 3: Sales Receipts Register
  const salesEntries = (allEntries || []).filter((e) => e.is_reviewed && e.treatment === 'Sales receipt');
  drawSectionHeading(
    '3. Confirmed Sales Receipts Register',
    'Bank credits classified as Sales Receipts (statutory output turnover reconciles against ERP sales invoices)',
    `${salesEntries.length} Receipt(s)`
  );
  const s3Rows = salesEntries.map((e) => [
    e.txn_date_display || formatBankDisplayDate(e.txn_date),
    e.account_name || '-',
    e.party_name || '-',
    e.utr || e.ref_no || '-',
    fmtRs(e.credit || 0),
    e.invoice_no || '-',
    e.gstin || '-',
    fmtRs(e.taxable_amount || 0),
    fmtRs(e.total_tax || 0)
  ]);
  const s3TotCredit = salesEntries.reduce((s, e) => s + Number(e.credit || 0), 0);
  const s3TotTax = salesEntries.reduce((s, e) => s + Number(e.total_tax || 0), 0);
  drawTable(
    '3. Confirmed Sales Receipts',
    [
      { header: 'Txn Date', w: 24 },
      { header: 'Account', w: 32 },
      { header: 'Party', w: 42, bold: true },
      { header: 'UTR / Ref', w: 34 },
      { header: 'Bank Credit', w: 31, align: 'right', color: 'green', bold: true },
      { header: 'Invoice No', w: 29 },
      { header: 'GSTIN', w: 33 },
      { header: 'Inv Taxable', w: 26, align: 'right' },
      { header: 'Inv Tax', w: 26, align: 'right' }
    ],
    s3Rows,
    s3Rows.length > 0 ? ['TOTAL', '', '', '', fmtRs(s3TotCredit), '', '', '', fmtRs(s3TotTax)] : null,
    'No entries confirmed as Sales Receipt yet.'
  );

  // SECTION 4: Action Checklist (Pending Items)
  const pendingEntries = (allEntries || []).filter((e) => e.needs_review || e.docs_pending);
  drawSectionHeading(
    '4. Action Checklist - Entries Needing Review or Missing GST Documents',
    'Items requiring accountant classification, supplier tax invoice details, valid GSTIN, or GSTR-2B confirmation',
    `${pendingEntries.length} Action Item(s)`
  );
  const s4Rows = pendingEntries.map((e) => {
    let treatmentLabel = e.treatment || 'Awaiting Review';
    if (treatmentLabel === 'Unreviewed') {
      treatmentLabel = e.suggested_treatment && e.suggested_treatment !== 'Unreviewed'
        ? `Suggested: ${e.suggested_treatment}`
        : 'Awaiting Review';
    }
    return [
      e.txn_date_display || formatBankDisplayDate(e.txn_date),
      e.account_name || '-',
      `${e.remarks ? `${e.remarks} | ` : ''}${e.description || ''}`,
      e.debit > 0 ? fmtRs(e.debit) : '-',
      e.credit > 0 ? fmtRs(e.credit) : '-',
      treatmentLabel,
      e.needs_review ? 'Needs Review' : 'Docs Pending'
    ];
  });
  drawTable(
    '4. Action Checklist (Pending Items)',
    [
      { header: 'Txn Date', w: 22 },
      { header: 'Account', w: 28 },
      { header: 'Remarks / Narration', w: 84 },
      { header: 'Debit', w: 27, align: 'right', color: 'red' },
      { header: 'Credit', w: 27, align: 'right', color: 'green' },
      { header: 'Treatment / Suggestion', w: 46 },
      { header: 'Status', w: 30, align: 'center', badge: true }
    ],
    s4Rows,
    null,
    'All entries reviewed and documents complete.'
  );

  // Page numbering footer on every page
  const pageCount = doc.internal.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    doc.setDrawColor(203, 213, 225);
    doc.line(margin, pageHeight - 10, pageWidth - margin, pageHeight - 10);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(safePdfText(`${companyName}  |  GST Working Paper (${periodLabel})  |  Not a statutory return`), margin, pageHeight - 5.5);
    doc.setFont('helvetica', 'bold');
    doc.text(`Page ${p} of ${pageCount}`, pageWidth - margin, pageHeight - 5.5, { align: 'right' });
  }

  const safeMonthSlug = month && month !== 'ALL' ? `_${String(month).replace(/[^A-Za-z0-9_-]/g, '')}` : '';
  doc.save(`gst-filing-working-paper_${finYear}${safeMonthSlug}_${new Date().toISOString().slice(0, 10)}.pdf`);
}
