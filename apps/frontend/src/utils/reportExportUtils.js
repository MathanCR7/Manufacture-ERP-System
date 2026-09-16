import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';

/**
 * Export table data to CSV file
 */
export function exportToCSV(filename, columns, data) {
  if (!data || !data.length) {
    alert('No data available to export.');
    return;
  }

  const headers = columns.map(c => `"${(c.header || c.label || '').replace(/"/g, '""')}"`).join(',');
  const rows = data.map(row => {
    return columns.map(col => {
      const val = typeof col.accessor === 'function' ? col.accessor(row) : row[col.key || col.accessor];
      const str = val != null ? String(val) : '';
      return `"${str.replace(/"/g, '""')}"`;
    }).join(',');
  });

  const csvContent = [headers, ...rows].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename.replace(/\.csv$/, '')}_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Export table data to Excel (.xlsx) file
 */
export function exportToExcel(filename, sheetName = 'Report', columns, data) {
  if (!data || !data.length) {
    alert('No data available to export.');
    return;
  }

  const exportRows = data.map(row => {
    const formatted = {};
    columns.forEach(col => {
      const key = col.header || col.label || col.key;
      const val = typeof col.accessor === 'function' ? col.accessor(row) : row[col.key || col.accessor];
      formatted[key] = val != null ? val : '';
    });
    return formatted;
  });

  const ws = XLSX.utils.json_to_sheet(exportRows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName.substring(0, 31));
  XLSX.writeFile(wb, `${filename.replace(/\.xlsx$/, '')}_${new Date().toISOString().split('T')[0]}.xlsx`);
}

/**
 * Export report to a clean printable PDF
 */
export function exportToPDF({ title, subtitle = '', columns, data, summaryCards = [], companyName = 'Manufacturing ERP' }) {
  if (!data || !data.length) {
    alert('No data available to print.');
    return;
  }

  const doc = new jsPDF({
    orientation: columns.length > 6 ? 'landscape' : 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  let currentY = 15;

  // Header Banner
  doc.setFillColor(30, 27, 75);
  doc.rect(0, 0, pageWidth, 5, 'F');
  doc.setFillColor(99, 102, 241);
  doc.rect(0, 5, pageWidth, 1.5, 'F');

  // Document Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(30, 27, 75);
  doc.text(title, 14, currentY + 3);

  // Company Name
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139);
  doc.text(companyName, pageWidth - 14, currentY + 3, { align: 'right' });

  currentY += 8;

  // Subtitle / Date filter info
  if (subtitle) {
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.text(subtitle, 14, currentY);
  }

  const nowStr = `Generated: ${new Date().toLocaleString('en-IN')}`;
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text(nowStr, pageWidth - 14, currentY, { align: 'right' });

  currentY += 8;

  // Summary KPI Cards if provided
  if (summaryCards && summaryCards.length > 0) {
    doc.setDrawColor(226, 232, 240);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(14, currentY, pageWidth - 28, 14, 2, 2, 'FD');

    const cardWidth = (pageWidth - 28) / summaryCards.length;
    summaryCards.forEach((card, idx) => {
      const cX = 16 + (idx * cardWidth);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      doc.text((card.label || '').toUpperCase(), cX, currentY + 5);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(15, 23, 42);
      doc.text(String(card.value || ''), cX, currentY + 11);
    });

    currentY += 19;
  }

  // Draw Table Headers
  const colWidth = (pageWidth - 28) / columns.length;
  doc.setFillColor(241, 245, 249);
  doc.rect(14, currentY, pageWidth - 28, 7, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(51, 65, 85);

  columns.forEach((col, idx) => {
    const headerText = col.header || col.label || '';
    doc.text(headerText, 16 + (idx * colWidth), currentY + 4.8);
  });

  currentY += 8;

  // Draw Table Rows
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(30, 41, 59);

  const rowHeight = 6.5;
  const pageHeight = doc.internal.pageSize.getHeight();

  data.forEach((row, rIdx) => {
    if (currentY + rowHeight > pageHeight - 15) {
      doc.addPage();
      currentY = 15;
      // Header on new page
      doc.setFillColor(241, 245, 249);
      doc.rect(14, currentY, pageWidth - 28, 7, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(51, 65, 85);
      columns.forEach((col, idx) => {
        doc.text(col.header || col.label || '', 16 + (idx * colWidth), currentY + 4.8);
      });
      currentY += 8;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(30, 41, 59);
    }

    if (rIdx % 2 === 1) {
      doc.setFillColor(248, 250, 252);
      doc.rect(14, currentY - 1, pageWidth - 28, rowHeight, 'F');
    }

    columns.forEach((col, cIdx) => {
      const val = typeof col.accessor === 'function' ? col.accessor(row) : row[col.key || col.accessor];
      const strVal = val != null ? String(val) : '';
      const truncated = strVal.length > 28 ? strVal.substring(0, 25) + '...' : strVal;
      doc.text(truncated, 16 + (cIdx * colWidth), currentY + 3.5);
    });

    currentY += rowHeight;
  });

  // Footer on last page
  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184);
  doc.text(`- Confidential ${companyName} Report -`, pageWidth / 2, pageHeight - 8, { align: 'center' });

  doc.save(`${title.toLowerCase().replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`);
}
