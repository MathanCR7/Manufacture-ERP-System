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

/**
 * Generates an attractive, multi-page A4 Landscape GST Working Paper & Filing PDF Report.
 * Includes repeating table headers across page breaks, zero overlapping text, and Page X of Y footers.
 */
export function exportGstFilingPdf({
  company = {},
  finYear = 'ALL',
  accountLabel = 'All Bank Accounts',
  kpis = {},
  monthlySummary = [],
  itcRegister = [],
  allEntries = [],
  gstr3bRows = []
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
  const bottomLimit = pageHeight - 13;
  let y = margin;

  const companyName = safePdfText(company.companyName || 'MANUFACTURING ERP', 'MANUFACTURING ERP');
  const companyGstin = safePdfText(company.companyGstin || company.taxRegNo || '', '');
  const companyPan = safePdfText(company.companyPan || '', '');
  const generatedStr = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

  const drawPageTopBanner = (isFirstPage = false) => {
    doc.setFillColor(17, 26, 54); // #111A36
    doc.rect(0, 0, pageWidth, isFirstPage ? 20 : 12, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(isFirstPage ? 12 : 9.5);
    doc.text('GST WORKING PAPER & FILING SUMMARY REPORT', margin, isFirstPage ? 8 : 7.8);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    const metaRight = `FY: ${finYear}  |  Account: ${safePdfText(accountLabel)}`;
    doc.text(metaRight, pageWidth - margin, isFirstPage ? 8 : 7.8, { align: 'right' });

    if (isFirstPage) {
      doc.setFontSize(8);
      doc.setTextColor(203, 213, 225);
      const compLine = `${companyName}${companyGstin ? `  |  GSTIN: ${companyGstin}` : ''}${companyPan ? `  |  PAN: ${companyPan}` : ''}`;
      doc.text(compLine, margin, 14.8);
      doc.text(`Generated: ${safePdfText(generatedStr)} (IST)`, pageWidth - margin, 14.8, { align: 'right' });
      y = 24;
    } else {
      y = 16;
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

  const drawSectionHeading = (title, subtitle = '') => {
    ensureSpace(14);
    doc.setFillColor(244, 246, 250);
    doc.setDrawColor(227, 232, 240);
    doc.roundedRect(margin, y, usableW, subtitle ? 9.5 : 7, 1.5, 1.5, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(20, 33, 61);
    doc.text(safePdfText(title), margin + 2.5, y + 4.7);
    if (subtitle) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      doc.text(safePdfText(subtitle), margin + 2.5, y + 8.3);
    }
    y += subtitle ? 11 : 8.5;
  };

  /**
   * Generic full-width vector table drawer with strict text wrapping & repeating headers on page breaks
   */
  const drawTable = (sectionTitle, columns, dataRows, totalRow = null, emptyLabel = 'No records available.') => {
    // Scale column widths cleanly to fill usableW (277mm)
    const rawSum = columns.reduce((s, c) => s + c.w, 0);
    const cols = columns.map((c) => ({ ...c, w: (c.w / rawSum) * usableW }));

    const drawTableHeader = (continued = false) => {
      if (continued) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(54, 70, 201);
        doc.text(`${safePdfText(sectionTitle)} (Continued)`, margin, y + 3.5);
        y += 5;
      }
      doc.setFillColor(20, 33, 61);
      doc.rect(margin, y, usableW, 6.5, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.2);
      doc.setTextColor(255, 255, 255);
      let x = margin;
      for (const col of cols) {
        const tx = col.align === 'right' ? x + col.w - 1.5 : x + 1.5;
        doc.text(safePdfText(col.header), tx, y + 4.4, { align: col.align === 'right' ? 'right' : 'left' });
        x += col.w;
      }
      y += 6.5;
    };

    ensureSpace(16);
    drawTableHeader(false);

    if (!dataRows || dataRows.length === 0) {
      doc.setDrawColor(227, 232, 240);
      doc.rect(margin, y, usableW, 7, 'S');
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      doc.text(emptyLabel, margin + usableW / 2, y + 4.6, { align: 'center' });
      y += 9;
      return;
    }

    for (let rIdx = 0; rIdx < dataRows.length; rIdx++) {
      const row = dataRows[rIdx];
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);

      const wrappedCells = cols.map((col, cIdx) => {
        const val = safePdfText(row[cIdx], '');
        return doc.splitTextToSize(val, Math.max(4, col.w - 3));
      });
      const maxLines = Math.max(1, ...wrappedCells.map((arr) => arr.length));
      const rowH = Math.max(5.8, maxLines * 3.2 + 2.4);

      ensureSpace(rowH, () => drawTableHeader(true));

      if (rIdx % 2 === 1) {
        doc.setFillColor(248, 250, 252);
        doc.rect(margin, y, usableW, rowH, 'F');
      }
      doc.setDrawColor(227, 232, 240);
      doc.rect(margin, y, usableW, rowH, 'S');

      let x = margin;
      for (let cIdx = 0; cIdx < cols.length; cIdx++) {
        const col = cols[cIdx];
        const lines = wrappedCells[cIdx];
        if (col.color === 'green') doc.setTextColor(8, 122, 85);
        else if (col.color === 'red') doc.setTextColor(180, 35, 47);
        else if (col.color === 'amber') doc.setTextColor(138, 83, 0);
        else if (col.bold) doc.setTextColor(20, 33, 61);
        else doc.setTextColor(51, 65, 85);

        doc.setFont('helvetica', col.bold ? 'bold' : 'normal');
        const tx = col.align === 'right' ? x + col.w - 1.5 : x + 1.5;
        doc.text(lines, tx, y + 3.8, { align: col.align === 'right' ? 'right' : 'left' });
        x += col.w;
      }
      y += rowH;
    }

    if (totalRow) {
      ensureSpace(7, () => drawTableHeader(true));
      doc.setFillColor(241, 245, 249);
      doc.setDrawColor(203, 213, 225);
      doc.rect(margin, y, usableW, 6.5, 'FD');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.4);
      doc.setTextColor(20, 33, 61);
      let x = margin;
      for (let cIdx = 0; cIdx < cols.length; cIdx++) {
        const col = cols[cIdx];
        const tx = col.align === 'right' ? x + col.w - 1.5 : x + 1.5;
        doc.text(safePdfText(totalRow[cIdx], ''), tx, y + 4.4, { align: col.align === 'right' ? 'right' : 'left' });
        x += col.w;
      }
      y += 8.5;
    } else {
      y += 4;
    }
  };

  // --- PAGE 1 HEADER & DISCLAIMER ---
  drawPageTopBanner(true);

  // Disclaimer strip
  doc.setFillColor(254, 244, 230);
  doc.setDrawColor(245, 158, 11);
  doc.roundedRect(margin, y, usableW, 7, 1.5, 1.5, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(138, 83, 0);
  doc.text('NOTICE: Working Paper for GST Filing Preparation ONLY (Not a statutory GST Return). Verify invoice eligibility & GSTR-2B matching with your CA / Accountant.', margin + 3, y + 4.6);
  y += 9.5;

  // Executive 6-KPI Summary Strip
  const kpiCards = [
    { label: 'TOTAL BANK ENTRIES', val: String(kpis.entries || 0), color: [20, 33, 61] },
    { label: 'NEEDS REVIEW', val: String(kpis.needsReview || 0), color: [138, 83, 0] },
    { label: 'DOCS PENDING', val: String(kpis.docsPending || 0), color: [180, 35, 47] },
    { label: 'ITC DOCS COMPLETE', val: fmtRs(kpis.itcDocsComplete || 0), color: [8, 122, 85] },
    { label: 'ITC DOCS PENDING', val: fmtRs(kpis.itcDocsPending || 0), color: [138, 83, 0] },
    { label: 'SALES RECEIPTS', val: fmtRs(kpis.salesReceipts || 0), color: [54, 70, 201] }
  ];
  const cardGap = 2.5;
  const cardW = (usableW - cardGap * (kpiCards.length - 1)) / kpiCards.length;
  kpiCards.forEach((c, idx) => {
    const cx = margin + idx * (cardW + cardGap);
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(227, 232, 240);
    doc.roundedRect(cx, y, cardW, 13, 1.5, 1.5, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text(c.label, cx + 2.5, y + 4.5);
    doc.setFontSize(9);
    doc.setTextColor(...c.color);
    doc.text(c.val, cx + 2.5, y + 10.2);
  });
  y += 16;

  // SECTION 1: Monthly Bank Statement GST Summary
  drawSectionHeading(
    '1. Monthly Bank Statement GST Summary',
    'Month-wise bank credits, debits, verified sales receipts, and verified vs pending Input Tax Credit'
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
      { header: 'Month (FY)', w: 34, bold: true },
      { header: 'Entries', w: 18, align: 'right' },
      { header: 'Total Credit', w: 36, align: 'right', color: 'green' },
      { header: 'Total Debit', w: 36, align: 'right', color: 'red' },
      { header: 'Sales Receipts', w: 38, align: 'right' },
      { header: 'ITC Complete', w: 38, align: 'right', color: 'green', bold: true },
      { header: 'ITC Pending', w: 38, align: 'right', color: 'amber' },
      { header: 'Needs Review', w: 22, align: 'right' }
    ],
    s1Rows,
    ['TOTAL', String(s1Tot.entries), fmtRs(s1Tot.credit), fmtRs(s1Tot.debit), fmtRs(s1Tot.sales), fmtRs(s1Tot.itcC), fmtRs(s1Tot.itcP), String(s1Tot.rev)]
  );

  // SECTION 2: ERP GSTR-3B Input vs Output Return Summary
  if (gstr3bRows && gstr3bRows.length > 0) {
    drawSectionHeading(
      '2. ERP Books GSTR-3B Input ITC vs Output Liability Summary',
      'Reconciliation of Raw Material / Asset / Expense Input Tax Credit against Sales Output GST'
    );
    const s2Rows = gstr3bRows.map((r) => [
      r.month_key,
      fmtRs(r.itc_cgst),
      fmtRs(r.itc_sgst),
      fmtRs(r.itc_igst),
      fmtRs(r.total_itc),
      fmtRs(r.output_cgst),
      fmtRs(r.output_sgst),
      fmtRs(r.output_igst),
      fmtRs(r.total_output),
      fmtRs(r.net_gst_payable),
      fmtRs(r.carry_forward_itc)
    ]);
    drawTable(
      '2. ERP Books GSTR-3B Summary',
      [
        { header: 'Month', w: 22, bold: true },
        { header: 'ITC CGST', w: 24, align: 'right' },
        { header: 'ITC SGST', w: 24, align: 'right' },
        { header: 'ITC IGST', w: 24, align: 'right' },
        { header: 'Total Input ITC', w: 28, align: 'right', color: 'green', bold: true },
        { header: 'Out CGST', w: 24, align: 'right' },
        { header: 'Out SGST', w: 24, align: 'right' },
        { header: 'Out IGST', w: 24, align: 'right' },
        { header: 'Total Output', w: 28, align: 'right', bold: true },
        { header: 'Net Payable', w: 28, align: 'right', color: 'red', bold: true },
        { header: 'ITC Carried Fwd', w: 29, align: 'right' }
      ],
      s2Rows
    );
  }

  // SECTION 3: Verified ITC Register (Unique Invoice Level — Tax Counted Once)
  drawSectionHeading(
    '3. Input Tax Credit (ITC) Invoice Register (Tax Counted Once per Invoice)',
    'Unique supplier invoices matched to bank payments — split payments never double-count GST'
  );
  const s3Rows = (itcRegister || []).map((inv) => [
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
  const s3Tot = (itcRegister || []).reduce(
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
    '3. Input Tax Credit Register',
    [
      { header: 'Invoice No', w: 24, bold: true },
      { header: 'Inv Date', w: 22 },
      { header: 'Party / Vendor', w: 38 },
      { header: 'GSTIN', w: 30 },
      { header: 'HSN/SAC', w: 16 },
      { header: 'Taxable', w: 24, align: 'right' },
      { header: 'CGST', w: 21, align: 'right' },
      { header: 'SGST', w: 21, align: 'right' },
      { header: 'IGST', w: 21, align: 'right' },
      { header: 'Total Tax', w: 24, align: 'right', color: 'green', bold: true },
      { header: '2B', w: 16 },
      { header: 'Docs', w: 20, bold: true }
    ],
    s3Rows,
    s3Rows.length > 0 ? ['TOTAL', '', '', '', '', fmtRs(s3Tot.taxable), fmtRs(s3Tot.cgst), fmtRs(s3Tot.sgst), fmtRs(s3Tot.igst), fmtRs(s3Tot.tax), '', ''] : null,
    'No ITC invoices linked or entered yet.'
  );

  // SECTION 4: Sales Receipts Summary
  const salesEntries = (allEntries || []).filter((e) => e.is_reviewed && e.treatment === 'Sales receipt');
  drawSectionHeading(
    '4. Confirmed Sales Receipts Register',
    'Bank credits classified as Sales Receipts (Note: GST turnover is sourced from ERP sales invoices)'
  );
  const s4Rows = salesEntries.map((e) => [
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
  const s4TotCredit = salesEntries.reduce((s, e) => s + Number(e.credit || 0), 0);
  const s4TotTax = salesEntries.reduce((s, e) => s + Number(e.total_tax || 0), 0);
  drawTable(
    '4. Confirmed Sales Receipts',
    [
      { header: 'Txn Date', w: 24 },
      { header: 'Account', w: 36 },
      { header: 'Party', w: 42, bold: true },
      { header: 'UTR / Ref', w: 34 },
      { header: 'Bank Credit', w: 30, align: 'right', color: 'green', bold: true },
      { header: 'Invoice No', w: 28 },
      { header: 'GSTIN', w: 32 },
      { header: 'Inv Taxable', w: 26, align: 'right' },
      { header: 'Inv Tax', w: 25, align: 'right' }
    ],
    s4Rows,
    s4Rows.length > 0 ? ['TOTAL', '', '', '', fmtRs(s4TotCredit), '', '', '', fmtRs(s4TotTax)] : null,
    'No entries confirmed as Sales Receipt yet.'
  );

  // SECTION 5: Pending Review / Missing Docs Action List
  const pendingEntries = (allEntries || []).filter((e) => e.needs_review || e.docs_pending);
  drawSectionHeading(
    '5. Action Checklist — Entries Needing Review or Missing GST Documents',
    'Items that require accountant classification, tax invoice upload, valid GSTIN, or GSTR-2B verification'
  );
  const s5Rows = pendingEntries.map((e) => [
    e.txn_date_display || formatBankDisplayDate(e.txn_date),
    e.account_name || '-',
    `${e.remarks ? `${e.remarks} | ` : ''}${e.description || ''}`,
    e.debit > 0 ? fmtRs(e.debit) : '-',
    e.credit > 0 ? fmtRs(e.credit) : '-',
    e.treatment === 'Unreviewed' ? `Suggested: ${e.suggested_treatment || 'Unreviewed'}` : e.treatment,
    e.needs_review ? 'Needs Review' : 'Docs Pending'
  ]);
  drawTable(
    '5. Action Checklist (Pending Items)',
    [
      { header: 'Txn Date', w: 22 },
      { header: 'Account', w: 34 },
      { header: 'Remarks / Narration', w: 86 },
      { header: 'Debit', w: 27, align: 'right', color: 'red' },
      { header: 'Credit', w: 27, align: 'right', color: 'green' },
      { header: 'Treatment / Suggestion', w: 48 },
      { header: 'Status', w: 25, color: 'amber', bold: true }
    ],
    s5Rows,
    null,
    'All entries reviewed and documents complete.'
  );

  // Page numbering footer on every page
  const pageCount = doc.internal.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    doc.setDrawColor(227, 232, 240);
    doc.line(margin, pageHeight - 10, pageWidth - margin, pageHeight - 10);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(safePdfText(`${companyName} - Working paper - not a GST return`), margin, pageHeight - 5.5);
    doc.text(`Page ${p} of ${pageCount}`, pageWidth - margin, pageHeight - 5.5, { align: 'right' });
  }

  doc.save(`gst-filing-working-paper_${finYear}_${new Date().toISOString().slice(0, 10)}.pdf`);
}
