import { jsPDF } from 'jspdf';
import { formatBankDisplayDate } from '../components/bank-statement/bankStatementHelpers';

function safeText(val, fallback = '-') {
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
 * Exports an executive A4 Portrait/Landscape PDF Statement of Account for a selected Party.
 */
export function exportPartyLedgerPdf({
  company = {},
  party = {},
  dateFrom = '',
  dateTo = '',
  openingBalance = 0,
  totalDebit = 0,
  totalCredit = 0,
  closingBalance = 0,
  rows = []
}) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth(); // 210mm
  const pageHeight = doc.internal.pageSize.getHeight(); // 297mm
  const margin = 10;
  const usableW = pageWidth - margin * 2; // 190mm
  const bottomLimit = pageHeight - 14;
  let y = margin;

  const companyName = safeText(company.companyName || 'MANUFACTURING ERP');
  const companyGstin = safeText(company.companyGstin || company.taxRegNo || '', '');
  const periodLabel = dateFrom || dateTo
    ? `${dateFrom ? formatBankDisplayDate(dateFrom) : 'Start'} to ${dateTo ? formatBankDisplayDate(dateTo) : 'Today'}`
    : 'All Dates';
  const generatedStr = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

  const drawTopBanner = (isFirst = false) => {
    const h = isFirst ? 21 : 12;
    doc.setFillColor(17, 26, 54);
    doc.rect(0, 0, pageWidth, h, 'F');
    doc.setFillColor(54, 70, 201);
    doc.rect(0, h, pageWidth, 1, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(isFirst ? 12 : 9.5);
    doc.text('STATEMENT OF ACCOUNT (PARTY LEDGER)', margin, isFirst ? 8.2 : 7.8);

    doc.setFontSize(7.8);
    doc.setTextColor(224, 231, 255);
    doc.text(`Period: ${safeText(periodLabel)}`, pageWidth - margin, isFirst ? 8.2 : 7.8, { align: 'right' });

    if (isFirst) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.8);
      doc.setTextColor(203, 213, 225);
      const compLine = `${companyName}${companyGstin ? `  |  GSTIN: ${companyGstin}` : ''}`;
      doc.text(compLine, margin, 15.2);
      doc.text(`Generated: ${safeText(generatedStr)} (IST)`, pageWidth - margin, 15.2, { align: 'right' });
      y = 25;
    } else {
      y = 16;
    }
  };

  drawTopBanner(true);

  // Party Info Card
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(margin, y, usableW, 21, 1.5, 1.5, 'FD');
  doc.setFillColor(54, 70, 201);
  doc.roundedRect(margin, y, 1.8, 21, 0.8, 0.8, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(20, 33, 61);
  doc.text(safeText(party.name), margin + 4, y + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.6);
  doc.setTextColor(71, 85, 105);
  const contactLine = `Type: ${safeText(party.type)}   |   Phone: ${safeText(party.phone, 'N/A')}   |   GSTIN: ${safeText(party.gstin, 'Unregistered')}`;
  doc.text(contactLine, margin + 4, y + 11.2);
  const creditLine = `Email: ${safeText(party.email, 'N/A')}   |   Credit Days: ${party.credit_days || 0} days   |   Limit: ${fmtRs(party.credit_limit || 0)}`;
  doc.text(creditLine, margin + 4, y + 16);
  if (party.address) {
    doc.text(safeText(`Address: ${party.address}`).slice(0, 105), margin + 4, y + 19.8);
  }
  y += 24;

  // 4 Summary KPI Boxes
  const kpis = [
    { label: 'OPENING BALANCE', val: `${fmtRs(Math.abs(openingBalance))} ${openingBalance >= 0 ? 'Dr' : 'Cr'}`, color: [20, 33, 61] },
    { label: 'TOTAL DEBIT (DR)', val: fmtRs(totalDebit), color: [180, 35, 47] },
    { label: 'TOTAL CREDIT (CR)', val: fmtRs(totalCredit), color: [8, 122, 85] },
    { label: 'NET CLOSING BALANCE', val: `${fmtRs(Math.abs(closingBalance))} ${closingBalance >= 0 ? 'Dr' : 'Cr'}`, color: closingBalance >= 0 ? [180, 35, 47] : [8, 122, 85] }
  ];
  const gap = 2.5;
  const kW = (usableW - gap * 3) / 4;
  kpis.forEach((k, idx) => {
    const kx = margin + idx * (kW + gap);
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(kx, y, kW, 13, 1.5, 1.5, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.4);
    doc.setTextColor(100, 116, 139);
    doc.text(k.label, kx + 2.5, y + 4.8);
    doc.setFontSize(8.8);
    doc.setTextColor(...k.color);
    doc.text(k.val, kx + 2.5, y + 10.6);
  });
  y += 16.5;

  // Ledger Table
  const cols = [
    { header: 'Date', w: 22 },
    { header: 'Ref / Bill No', w: 28, bold: true },
    { header: 'Type', w: 23 },
    { header: 'Particulars', w: 46 },
    { header: 'Debit (Dr)', w: 23, align: 'right', color: 'red' },
    { header: 'Credit (Cr)', w: 23, align: 'right', color: 'green' },
    { header: 'Balance', w: 25, align: 'right', bold: true }
  ];
  const padX = 1.8;

  const drawVerticals = (ry, rh, rgb) => {
    doc.setDrawColor(...rgb);
    let vx = margin;
    for (let i = 0; i < cols.length - 1; i++) {
      vx += cols[i].w;
      doc.line(vx, ry, vx, ry + rh);
    }
  };

  const drawHeader = () => {
    doc.setFillColor(20, 33, 61);
    doc.rect(margin, y, usableW, 6.8, 'F');
    drawVerticals(y, 6.8, [51, 65, 85]);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.8);
    doc.setTextColor(255, 255, 255);
    let x = margin;
    for (const c of cols) {
      const tx = c.align === 'right' ? x + c.w - padX : x + padX;
      doc.text(c.header, tx, y + 4.5, { align: c.align === 'right' ? 'right' : 'left' });
      x += c.w;
    }
    y += 6.8;
  };

  drawHeader();

  if (!rows || rows.length === 0) {
    doc.setDrawColor(203, 213, 225);
    doc.rect(margin, y, usableW, 9, 'S');
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text('No transactions recorded in this date range.', margin + usableW / 2, y + 5.8, { align: 'center' });
    y += 10;
  } else {
    rows.forEach((r, idx) => {
      const cells = [
        formatBankDisplayDate(r.txn_date),
        safeText(r.ref_no),
        safeText(r.txn_type),
        safeText(r.description),
        r.debit > 0 ? fmtRs(r.debit) : '-',
        r.credit > 0 ? fmtRs(r.credit) : '-',
        `${fmtRs(Math.abs(r.running_balance))} ${r.running_balance >= 0 ? 'Dr' : 'Cr'}`
      ];
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.6);
      const wrapped = cols.map((c, ci) => doc.splitTextToSize(cells[ci], Math.max(4, c.w - padX * 2)));
      const maxLines = Math.max(1, ...wrapped.map((w) => w.length));
      const rowH = Math.max(6, maxLines * 3.1 + 2.4);

      if (y + rowH > bottomLimit) {
        doc.addPage();
        drawTopBanner(false);
        drawHeader();
      }

      doc.setFillColor(idx % 2 === 1 ? 243 : 255, idx % 2 === 1 ? 246 : 255, idx % 2 === 1 ? 251 : 255);
      doc.setDrawColor(203, 213, 225);
      doc.rect(margin, y, usableW, rowH, 'FD');
      drawVerticals(y, rowH, [226, 232, 240]);

      let x = margin;
      cols.forEach((c, ci) => {
        if (c.color === 'red') doc.setTextColor(180, 35, 47);
        else if (c.color === 'green') doc.setTextColor(8, 122, 85);
        else if (c.bold) doc.setTextColor(20, 33, 61);
        else doc.setTextColor(51, 65, 85);
        doc.setFont('helvetica', c.bold ? 'bold' : 'normal');
        const tx = c.align === 'right' ? x + c.w - padX : x + padX;
        doc.text(wrapped[ci], tx, y + 3.9, { align: c.align === 'right' ? 'right' : 'left' });
        x += c.w;
      });
      y += rowH;
    });

    if (y + 7 > bottomLimit) {
      doc.addPage();
      drawTopBanner(false);
      drawHeader();
    }
    doc.setFillColor(238, 242, 248);
    doc.setDrawColor(148, 163, 184);
    doc.rect(margin, y, usableW, 7, 'FD');
    drawVerticals(y, 7, [203, 213, 225]);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(20, 33, 61);
    let txX = margin;
    const totCells = [
      'TOTAL',
      `${rows.length} txns`,
      '',
      '',
      fmtRs(totalDebit),
      fmtRs(totalCredit),
      `${fmtRs(Math.abs(closingBalance))} ${closingBalance >= 0 ? 'Dr' : 'Cr'}`
    ];
    cols.forEach((c, ci) => {
      if (c.color === 'red') doc.setTextColor(180, 35, 47);
      else if (c.color === 'green') doc.setTextColor(8, 122, 85);
      else doc.setTextColor(20, 33, 61);
      const tx = c.align === 'right' ? txX + c.w - padX : txX + padX;
      doc.text(totCells[ci], tx, y + 4.7, { align: c.align === 'right' ? 'right' : 'left' });
      txX += c.w;
    });
  }

  const pageCount = doc.internal.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    doc.setDrawColor(203, 213, 225);
    doc.line(margin, pageHeight - 10, pageWidth - margin, pageHeight - 10);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.3);
    doc.setTextColor(100, 116, 139);
    doc.text(safeText(`${companyName}  |  Party Ledger: ${party.name}`), margin, pageHeight - 5.5);
    doc.setFont('helvetica', 'bold');
    doc.text(`Page ${p} of ${pageCount}`, pageWidth - margin, pageHeight - 5.5, { align: 'right' });
  }

  const slug = safeText(party.name, 'party').replace(/[^A-Za-z0-9_-]+/g, '_').slice(0, 30);
  doc.save(`party-statement_${slug}_${new Date().toISOString().slice(0, 10)}.pdf`);
}

/**
 * Exports an executive A4 Landscape PDF Aging Matrix (30-60-90+) Report.
 */
export function exportAgingPdf({
  company = {},
  direction = 'PAYABLE',
  summary = {},
  rows = []
}) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 10;
  const usableW = pageWidth - margin * 2; // 277mm
  const bottomLimit = pageHeight - 14;
  let y = margin;

  const companyName = safeText(company.companyName || 'MANUFACTURING ERP');
  const dirLabel = direction === 'PAYABLE' ? 'ACCOUNTS PAYABLE (SUPPLIERS)' : 'ACCOUNTS RECEIVABLE (CUSTOMERS)';
  const generatedStr = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

  const drawTopBanner = (isFirst = false) => {
    const h = isFirst ? 20 : 12;
    doc.setFillColor(17, 26, 54);
    doc.rect(0, 0, pageWidth, h, 'F');
    doc.setFillColor(54, 70, 201);
    doc.rect(0, h, pageWidth, 1, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(isFirst ? 12 : 9.5);
    doc.text(`OVERDUE AGING MATRIX REPORT - ${dirLabel}`, margin, isFirst ? 8 : 7.8);
    doc.setFontSize(7.8);
    doc.setTextColor(224, 231, 255);
    doc.text(`${rows.length} Party Account(s)`, pageWidth - margin, isFirst ? 8 : 7.8, { align: 'right' });

    if (isFirst) {
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(203, 213, 225);
      doc.text(companyName, margin, 15);
      doc.text(`Generated: ${safeText(generatedStr)} (IST)`, pageWidth - margin, 15, { align: 'right' });
      y = 24;
    } else {
      y = 16;
    }
  };

  drawTopBanner(true);

  const cols = [
    { header: 'Party Name', w: 63, bold: true },
    { header: 'Phone / GSTIN', w: 46 },
    { header: 'Total Balance', w: 30, align: 'right', bold: true },
    { header: 'Current (0d)', w: 28, align: 'right', color: 'green' },
    { header: '1-30 Days', w: 27, align: 'right' },
    { header: '31-60 Days', w: 27, align: 'right', color: 'amber' },
    { header: '61-90 Days', w: 27, align: 'right', color: 'red' },
    { header: '90+ Days', w: 29, align: 'right', color: 'red', bold: true }
  ];
  const padX = 2;

  const drawHeader = () => {
    doc.setFillColor(20, 33, 61);
    doc.rect(margin, y, usableW, 7, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(255, 255, 255);
    let x = margin;
    cols.forEach((c) => {
      doc.text(c.header, c.align === 'right' ? x + c.w - padX : x + padX, y + 4.7, { align: c.align === 'right' ? 'right' : 'left' });
      x += c.w;
    });
    y += 7;
  };

  drawHeader();

  rows.forEach((r, idx) => {
    const contact = [r.phone, r.gstin].filter(Boolean).join(' | ') || '-';
    const vals = [
      safeText(r.party_name),
      safeText(contact),
      fmtRs(r.total_outstanding),
      fmtRs(r.current_due),
      fmtRs(r.bucket_0_30),
      fmtRs(r.bucket_31_60),
      fmtRs(r.bucket_61_90),
      fmtRs(r.bucket_90_plus)
    ];
    if (y + 6.8 > bottomLimit) {
      doc.addPage();
      drawTopBanner(false);
      drawHeader();
    }
    doc.setFillColor(idx % 2 === 1 ? 243 : 255, idx % 2 === 1 ? 246 : 255, idx % 2 === 1 ? 251 : 255);
    doc.setDrawColor(203, 213, 225);
    doc.rect(margin, y, usableW, 6.8, 'FD');
    let x = margin;
    cols.forEach((c, ci) => {
      if (c.color === 'green') doc.setTextColor(8, 122, 85);
      else if (c.color === 'amber') doc.setTextColor(138, 83, 0);
      else if (c.color === 'red') doc.setTextColor(180, 35, 47);
      else doc.setTextColor(20, 33, 61);
      doc.setFont('helvetica', c.bold ? 'bold' : 'normal');
      doc.setFontSize(6.9);
      doc.text(vals[ci].slice(0, ci === 0 ? 40 : 32), c.align === 'right' ? x + c.w - padX : x + padX, y + 4.5, { align: c.align === 'right' ? 'right' : 'left' });
      x += c.w;
    });
    y += 6.8;
  });

  if (rows.length > 0) {
    if (y + 7 > bottomLimit) {
      doc.addPage();
      drawTopBanner(false);
      drawHeader();
    }
    doc.setFillColor(238, 242, 248);
    doc.setDrawColor(148, 163, 184);
    doc.rect(margin, y, usableW, 7, 'FD');
    const totVals = [
      `TOTAL (${rows.length} PARTIES)`,
      '',
      fmtRs(summary.totalOutstanding),
      fmtRs(summary.currentDue),
      fmtRs(summary.bucket0_30),
      fmtRs(summary.bucket31_60),
      fmtRs(summary.bucket61_90),
      fmtRs(summary.bucket90Plus)
    ];
    let x = margin;
    cols.forEach((c, ci) => {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.1);
      doc.setTextColor(20, 33, 61);
      doc.text(totVals[ci], c.align === 'right' ? x + c.w - padX : x + padX, y + 4.7, { align: c.align === 'right' ? 'right' : 'left' });
      x += c.w;
    });
  }

  const pageCount = doc.internal.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.3);
    doc.setTextColor(100, 116, 139);
    doc.text(`${companyName}  |  Aging Analysis`, margin, pageHeight - 5.5);
    doc.text(`Page ${p} of ${pageCount}`, pageWidth - margin, pageHeight - 5.5, { align: 'right' });
  }

  doc.save(`party-aging-${direction.toLowerCase()}_${new Date().toISOString().slice(0, 10)}.pdf`);
}
