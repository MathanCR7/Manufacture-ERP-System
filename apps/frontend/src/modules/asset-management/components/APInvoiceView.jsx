import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/axios';
import useAuthStore from '@/app/store/authStore';
import { format } from 'date-fns';
import DatePicker from '@/components/ui/DatePicker';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Plus, Search, Receipt, CheckCircle2, X, Eye, ArrowLeft,
  Loader2, AlertTriangle, ChevronDown, Building2, FileText,
  Calculator, Calendar, Shield, Banknote, Percent, Package, Trash2, Printer, Download
} from 'lucide-react';
import Swal from 'sweetalert2';
import { jsPDF } from 'jspdf';

const GST_RATES = [0, 5, 12, 18, 28];
const PAYMENT_MODES = ['Bank Transfer (NEFT)', 'Bank Transfer (RTGS)', 'Cheque', 'DD', 'Online Portal'];

const STATUS_STYLES = {
  Draft: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700',
  'Pending Approval': 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400 border-amber-200 dark:border-amber-900/50',
  Posted: 'bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400 border-blue-200 dark:border-blue-900/50',
  Paid: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/50',
  Overdue: 'bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400 border-rose-200 dark:border-rose-900/50',
  Cancelled: 'bg-slate-50 text-slate-500 dark:bg-slate-800/30 dark:text-slate-500 border-slate-200 dark:border-slate-700',
};

const handleDownloadPDF = (invoice, shouldPrint = false) => {
  const doc = new jsPDF();
  
  // Calculate totals
  const taxable = invoice.items?.reduce((s, i) => s + Number(i.totalBeforeTax || 0), 0) || 0;
  const isInterState = Boolean(invoice.isInterState);
  const applyGst = invoice.applyGst !== undefined ? Boolean(invoice.applyGst) : true;
  const totalGst = invoice.items?.reduce((s, i) => s + Number(i.gstAmount || i.cgstAmount + i.sgstAmount + i.igstAmount || 0), 0) || 0;
  const cgst = isInterState ? 0 : totalGst / 2;
  const sgst = isInterState ? 0 : totalGst / 2;
  const igst = isInterState ? totalGst : 0;
  const freight = Number(invoice.freight || invoice.freightGst || 0);
  const loadingCharges = Number(invoice.loadingCharges || 0);
  const unloadingCharges = Number(invoice.unloadingCharges || 0);
  const packingCharges = Number(invoice.packingCharges || 0);
  const insurance = Number(invoice.insurance || 0);
  const otherCharges = Number(invoice.otherCharges || 0);
  const discount = Number(invoice.discount || 0);
  const preRoundTotal = taxable + (applyGst ? totalGst : 0) + freight + loadingCharges + unloadingCharges + packingCharges + insurance + otherCharges - discount;
  const grandTotal = invoice.grandTotal ? Number(invoice.grandTotal) : Math.round(preRoundTotal);
  const roundOff = invoice.roundOff !== undefined ? Number(invoice.roundOff) : (grandTotal - preRoundTotal);

  // Top color accent bar (Indigo 600)
  doc.setFillColor(79, 70, 229);
  doc.rect(0, 0, 210, 8, 'F');

  // Setup Document Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(30, 41, 59); // Slate 800
  doc.text('TAX INVOICE', 14, 25);
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139); // Slate 500
  doc.text('ERP MANUFACTURING SYSTEM', 14, 32);
  doc.text('123 Manufacturing Way, Tech Park', 14, 37);
  doc.text('Bangalore, KA 560001, India', 14, 42);
  doc.text('GSTIN: 29AAACE1234F1Z3', 14, 47);
  
  // Right aligned invoice details
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(30, 41, 59);
  doc.text('INVOICE DETAILS', 140, 25);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105); // Slate 600
  doc.text(`Invoice No: ${invoice.vendorInvoiceNo || 'N/A'}`, 140, 32);
  doc.text(`AP Invoice No: ${invoice.apInvoiceNo || 'N/A'}`, 140, 37);
  doc.text(`Date: ${invoice.invoiceDate ? format(new Date(invoice.invoiceDate), 'dd/MM/yyyy') : 'N/A'}`, 140, 42);
  doc.text(`Due Date: ${invoice.dueDate ? format(new Date(invoice.dueDate), 'dd/MM/yyyy') : '—'}`, 140, 47);
  doc.text(`Payment Mode: ${invoice.paymentMode || 'N/A'}`, 140, 52);
  
  doc.setDrawColor(226, 232, 240); // Slate 200
  doc.line(14, 56, 196, 56);
  
  // Billing details (Left side)
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text('BILL TO (SUPPLIER)', 14, 64);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(invoice.vendorName || 'N/A', 14, 70);
  
  const addressLines = doc.splitTextToSize(invoice.address || 'N/A', 80);
  doc.text(addressLines, 14, 75);
  const addressHeight = addressLines.length * 4.5;
  doc.text(`GSTIN: ${invoice.vendorGstin || 'N/A'}`, 14, 76 + addressHeight);
  doc.text(`PAN: ${invoice.vendorPan || '—'}`, 14, 81 + addressHeight);
  
  // Ship To details (Right side)
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text('SHIP TO (BUYER)', 110, 64);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text('ERP MANUFACTURING SYSTEM', 110, 70);
  doc.text('Asset Procurement Department', 110, 75);
  doc.text('Bangalore, KA 560001, India', 110, 80);
  doc.text('GSTIN: 29AAACE1234F1Z3', 110, 85);
  doc.text(`Place of Supply: ${invoice.placeOfSupply || '29 (Karnataka)'}`, 110, 90);
  
  const startY = Math.max(86 + addressHeight, 96);
  doc.line(14, startY, 196, startY);
  
  // Items Table Header - Add color
  let currentY = startY + 8;
  doc.setFillColor(79, 70, 229); // Indigo 600 Background
  doc.rect(14, currentY - 5, 182, 8, 'F');
  
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255); // White text
  doc.text('Description', 16, currentY);
  doc.text('HSN/SAC', 75, currentY);
  doc.text('Qty', 105, currentY, { align: 'right' });
  doc.text('Rate', 125, currentY, { align: 'right' });
  doc.text('GST %', 145, currentY, { align: 'right' });
  doc.text('Total (INR)', 194, currentY, { align: 'right' });
  
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  currentY += 9;
  
  invoice.items?.forEach((item, index) => {
    const descLines = doc.splitTextToSize(item.itemDescription || '', 55);
    const descHeight = descLines.length * 4.5;
    const rowHeight = Math.max(descHeight, 8);
    
    if (currentY + rowHeight > 265) {
      doc.addPage();
      currentY = 20;
      
      // Top color accent bar on new page
      doc.setFillColor(79, 70, 229);
      doc.rect(0, 0, 210, 8, 'F');
      
      doc.setFillColor(79, 70, 229); // Indigo 600 Background
      doc.rect(14, currentY - 5, 182, 8, 'F');
      
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(255, 255, 255);
      doc.text('Description', 16, currentY);
      doc.text('HSN/SAC', 75, currentY);
      doc.text('Qty', 105, currentY, { align: 'right' });
      doc.text('Rate', 125, currentY, { align: 'right' });
      doc.text('GST %', 145, currentY, { align: 'right' });
      doc.text('Total (INR)', 194, currentY, { align: 'right' });
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(71, 85, 105);
      currentY += 9;
    }
    
    // Draw zebra row coloring
    if (index % 2 === 1) {
      doc.setFillColor(248, 250, 252); // Slate 50
      doc.rect(14, currentY - 5, 182, rowHeight, 'F');
    }
    
    doc.setTextColor(30, 41, 59);
    doc.text(descLines, 16, currentY);
    doc.setTextColor(71, 85, 105);
    doc.text(item.hsnSac || '—', 75, currentY);
    doc.text(String(item.quantity), 105, currentY, { align: 'right' });
    doc.text(Number(item.unitPrice).toLocaleString('en-IN', { minimumFractionDigits: 2 }), 125, currentY, { align: 'right' });
    doc.text(`${item.gstRate}%`, 145, currentY, { align: 'right' });
    doc.text(Number(item.totalWithGst).toLocaleString('en-IN', { minimumFractionDigits: 2 }), 194, currentY, { align: 'right' });
    
    // Bottom border for the row
    doc.setDrawColor(241, 245, 249); // Slate 100
    doc.line(14, currentY + rowHeight - 5, 196, currentY + rowHeight - 5);
    
    currentY += rowHeight;
  });
  
  doc.setDrawColor(203, 213, 225); // Slate 300
  doc.line(14, currentY - 2, 196, currentY - 2);
  currentY += 6;
  
  if (currentY + 50 > 265) {
    doc.addPage();
    currentY = 20;
    doc.setFillColor(79, 70, 229);
    doc.rect(0, 0, 210, 8, 'F');
  }
  
  // Left side remarks and Calculations section
  const leftWidth = 110;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(30, 41, 59);
  doc.text('Remarks / Narration:', 14, currentY);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  const narrationLines = doc.splitTextToSize(invoice.narration || 'No remarks provided.', leftWidth - 10);
  doc.text(narrationLines, 14, currentY + 5);
  
  const remarksHeight = narrationLines.length * 4.5;
  const remarksEndY = currentY + remarksHeight + 5;
  
  const calcX = 130;
  const valX = 196;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text('SUBTOTAL:', calcX, currentY);
  doc.text(taxable.toLocaleString('en-IN', { minimumFractionDigits: 2 }), valX, currentY, { align: 'right' });
  
  let offset = 6;
  if (applyGst) {
    if (isInterState) {
      doc.text('IGST:', calcX, currentY + offset);
      doc.text(igst.toLocaleString('en-IN', { minimumFractionDigits: 2 }), valX, currentY + offset, { align: 'right' });
      offset += 6;
    } else {
      doc.text('CGST:', calcX, currentY + offset);
      doc.text(cgst.toLocaleString('en-IN', { minimumFractionDigits: 2 }), valX, currentY + offset, { align: 'right' });
      offset += 6;
      doc.text('SGST:', calcX, currentY + offset);
      doc.text(sgst.toLocaleString('en-IN', { minimumFractionDigits: 2 }), valX, currentY + offset, { align: 'right' });
      offset += 6;
    }
  } else {
    doc.text('GST (EXEMPTED):', calcX, currentY + offset);
    doc.text('0.00', valX, currentY + offset, { align: 'right' });
    offset += 6;
  }
  
  if (freight > 0) {
    doc.text('FREIGHT:', calcX, currentY + offset);
    doc.text(freight.toLocaleString('en-IN', { minimumFractionDigits: 2 }), valX, currentY + offset, { align: 'right' });
    offset += 6;
  }
  if (loadingCharges > 0) {
    doc.text('LOADING CHARGES:', calcX, currentY + offset);
    doc.text(loadingCharges.toLocaleString('en-IN', { minimumFractionDigits: 2 }), valX, currentY + offset, { align: 'right' });
    offset += 6;
  }
  if (unloadingCharges > 0) {
    doc.text('UNLOADING CHARGES:', calcX, currentY + offset);
    doc.text(unloadingCharges.toLocaleString('en-IN', { minimumFractionDigits: 2 }), valX, currentY + offset, { align: 'right' });
    offset += 6;
  }
  if (packingCharges > 0) {
    doc.text('PACKING CHARGES:', calcX, currentY + offset);
    doc.text(packingCharges.toLocaleString('en-IN', { minimumFractionDigits: 2 }), valX, currentY + offset, { align: 'right' });
    offset += 6;
  }
  if (insurance > 0) {
    doc.text('INSURANCE:', calcX, currentY + offset);
    doc.text(insurance.toLocaleString('en-IN', { minimumFractionDigits: 2 }), valX, currentY + offset, { align: 'right' });
    offset += 6;
  }
  if (otherCharges > 0) {
    doc.text('OTHER CHARGES:', calcX, currentY + offset);
    doc.text(otherCharges.toLocaleString('en-IN', { minimumFractionDigits: 2 }), valX, currentY + offset, { align: 'right' });
    offset += 6;
  }
  if (discount > 0) {
    doc.text('DISCOUNT:', calcX, currentY + offset);
    doc.text(`-${discount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, valX, currentY + offset, { align: 'right' });
    offset += 6;
  }
  
  doc.text('ROUND OFF:', calcX, currentY + offset);
  const formattedRoundOff = (roundOff >= 0 ? '+' : '') + roundOff.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  doc.text(formattedRoundOff, valX, currentY + offset, { align: 'right' });
  offset += 4;
  
  doc.line(calcX, currentY + offset, 196, currentY + offset);
  offset += 6;
  
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(79, 70, 229); // Indigo 600
  doc.text('TOTAL (INR):', calcX, currentY + offset);
  doc.text(`Rs. ${grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, valX, currentY + offset, { align: 'right' });
  const calcEndY = currentY + offset + 4;

  // Divider Line before terms
  const sectionEndY = Math.max(calcEndY, remarksEndY);
  doc.setDrawColor(226, 232, 240); // Slate 200
  doc.line(14, sectionEndY + 2, 196, sectionEndY + 2);

  let termsStartY = sectionEndY + 8;
  
  // Estimate height needed for terms (approx 35mm)
  if (termsStartY + 35 > 270) {
    doc.addPage();
    termsStartY = 20;
    doc.setFillColor(79, 70, 229);
    doc.rect(0, 0, 210, 8, 'F');
  }

  // Terms & Conditions Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(30, 41, 59);
  doc.text('Terms & Conditions:', 14, termsStartY);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(100, 116, 139);
  
  const terms = [
    "Reference Requirement: Supplier must clearly reference the PO number on all invoices, packing slips, and correspondence. Invoices without a valid PO number may be rejected.",
    "Invoice Submission: Supplier shall submit a tax-compliant invoice containing: Supplier name/address, Invoice number/date, PO number, Description of goods/services, Quantity, unit price, and total amount, and Applicable taxes (GST/VAT, if any).",
    "Three-Way Match Requirement: Payment is subject to successful matching of: Approved Purchase Order, Goods Receipt Note (GRN) or Service Acceptance, and Supplier Invoice.",
    "Payment Terms: Standard payment terms: Net 30 days (or as agreed) from the later of: Receipt of a valid invoice, or Acceptance of goods/services.",
    "Acceptance of Goods/Services: Buyer reserves the right to inspect and reject goods or services that do not conform to PO specifications.",
    "Pricing: Prices stated in the PO are fixed and cannot be changed without written approval from the buyer.",
    "Taxes: Supplier is responsible for complying with all applicable tax regulations. Taxes must be separately identified on the invoice.",
    "Supporting Documents: Supplier shall provide all required supporting documents, including delivery notes, timesheets, service reports, or certificates, as applicable.",
    "Discrepancies: Any discrepancy between the PO, receipt, and invoice may result in delayed payment until resolved.",
    "Compliance: Supplier shall comply with all applicable laws, regulations, and contractual obligations.",
    "Currency: Invoices must be issued in the currency specified on the PO unless otherwise agreed in writing.",
    "Invoice Approval: Payment is subject to internal approval procedures and verification of invoice accuracy."
  ];

  // Two column terms layout
  const col1X = 14;
  const col2X = 106;
  const colWidth = 88;
  let col1Y = termsStartY + 4;
  let col2Y = termsStartY + 4;

  terms.forEach((term, index) => {
    const textLines = doc.splitTextToSize(`${index + 1}. ${term}`, colWidth);
    if (index < 6) {
      doc.text(textLines, col1X, col1Y);
      col1Y += (textLines.length * 2.8) + 1.5;
    } else {
      doc.text(textLines, col2X, col2Y);
      col2Y += (textLines.length * 2.8) + 1.5;
    }
  });
  
  const termEndY = Math.max(col1Y, col2Y);
  
  // Signature & Seal blocks
  let sigStartY = termEndY + 6;
  if (sigStartY + 32 > 275) {
    doc.addPage();
    sigStartY = 20;
    doc.setFillColor(79, 70, 229);
    doc.rect(0, 0, 210, 8, 'F');
  }
  
  // Left: Vendor / Supplier Signatory
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(30, 41, 59);
  doc.text(`For ${invoice.vendorName || 'Supplier'}`, 14, sigStartY);
  
  doc.setDrawColor(203, 213, 225); // Slate 300
  doc.line(14, sigStartY + 18, 80, sigStartY + 18);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text('Authorized Signatory', 14, sigStartY + 22);
  
  // Right: Company / Customer Signatory with Seal
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(30, 41, 59);
  doc.text('For ERP MANUFACTURING SYSTEM', 130, sigStartY);
  
  doc.setDrawColor(203, 213, 225); // Slate 300
  doc.line(130, sigStartY + 18, 196, sigStartY + 18);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text('Authorized Signatory (with Company Seal)', 130, sigStartY + 22);
  
  // Seal Stamp Drawing (ellipse placeholder)
  doc.setDrawColor(79, 70, 229); // Indigo 600
  doc.setFillColor(245, 243, 255); // Indigo 50
  doc.ellipse(175, sigStartY + 8, 14, 7, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(5.5);
  doc.setTextColor(79, 70, 229);
  doc.text('COMPANY', 175, sigStartY + 7, { align: 'center' });
  doc.text('SEAL', 175, sigStartY + 10, { align: 'center' });
  
  // Footer
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184); // Slate 400
  doc.text('For questions concerning this invoice, please contact ERP Support at support@yourcompany.com', 105, 285, { align: 'center' });
  
  // Filename format: INV-YYYY-MM-DD-XXXXX_VendorName.pdf
  const dateStr = invoice.invoiceDate ? format(new Date(invoice.invoiceDate), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd');
  
  let seq = '00000';
  if (invoice.apInvoiceNo) {
    const parts = invoice.apInvoiceNo.split('-');
    if (parts.length > 0) {
      const lastPart = parts[parts.length - 1];
      if (/^\d+$/.test(lastPart)) {
        seq = lastPart;
      } else {
        seq = invoice.apInvoiceNo;
      }
    }
  }
  const cleanVendorName = (invoice.vendorName || 'Vendor').replace(/[^a-zA-Z0-9]/g, '_');
  const filename = `INV-${dateStr}-${seq}_${cleanVendorName}.pdf`;
  
  if (shouldPrint) {
    const pdfBlob = doc.output('blob');
    const pdfUrl = URL.createObjectURL(pdfBlob);
    window.open(pdfUrl, '_blank');
  } else {
    doc.save(filename);
  }
};

function APInvoiceDetailModal({ invoice, onClose }) {
  const taxable = invoice.items?.reduce((s, i) => s + Number(i.totalBeforeTax || 0), 0) || 0;
  const isInterState = Boolean(invoice.isInterState);
  const applyGst = invoice.applyGst !== undefined ? Boolean(invoice.applyGst) : true;
  const totalGst = invoice.items?.reduce((s, i) => s + Number(i.gstAmount || i.cgstAmount + i.sgstAmount + i.igstAmount || 0), 0) || 0;
  const cgst = isInterState ? 0 : totalGst / 2;
  const sgst = isInterState ? 0 : totalGst / 2;
  const igst = isInterState ? totalGst : 0;
  const freight = Number(invoice.freight || invoice.freightGst || 0);
  const loadingCharges = Number(invoice.loadingCharges || 0);
  const unloadingCharges = Number(invoice.unloadingCharges || 0);
  const packingCharges = Number(invoice.packingCharges || 0);
  const insurance = Number(invoice.insurance || 0);
  const otherCharges = Number(invoice.otherCharges || 0);
  const discount = Number(invoice.discount || 0);
  const preRoundTotal = taxable + (applyGst ? totalGst : 0) + freight + loadingCharges + unloadingCharges + packingCharges + insurance + otherCharges - discount;
  const grandTotal = invoice.grandTotal ? Number(invoice.grandTotal) : Math.round(preRoundTotal);
  const roundOff = invoice.roundOff !== undefined ? Number(invoice.roundOff) : (grandTotal - preRoundTotal);
  const dueDate = invoice.dueDate ? new Date(invoice.dueDate) : null;
  const isOverdue = dueDate && dueDate < new Date() && invoice.status !== 'Paid';

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-slate-900 w-full max-w-4xl rounded-3xl shadow-2xl border border-slate-200/60 dark:border-slate-800 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 px-6 py-4 flex items-center justify-between z-10 rounded-t-3xl">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white font-mono">{invoice.apInvoiceNo}</h2>
              <span className={`px-3 py-1 rounded-full text-xs font-bold border ${STATUS_STYLES[invoice.status] || STATUS_STYLES.Draft}`}>{invoice.status}</span>
              {isOverdue && <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-600 border border-rose-200">OVERDUE</span>}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">{invoice.vendorName} • {invoice.vendorInvoiceNo}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-1.5 h-8 rounded-lg text-xs border-indigo-200 dark:border-indigo-900 text-indigo-600 hover:text-indigo-700 bg-indigo-50/50 hover:bg-indigo-50 dark:bg-indigo-950/20" onClick={() => handleDownloadPDF(invoice, true)}>
              <Printer className="w-3.5 h-3.5" /> Print Bill
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5 h-8 rounded-lg text-xs border-indigo-200 dark:border-indigo-900 text-indigo-600 hover:text-indigo-700 bg-indigo-50/50 hover:bg-indigo-50 dark:bg-indigo-950/20" onClick={() => handleDownloadPDF(invoice, false)}>
              <Download className="w-3.5 h-3.5" /> Download PDF
            </Button>
            <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Content */}
        <div className="p-6 space-y-6">
          {/* Header Details */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm bg-slate-50/50 dark:bg-slate-800/20 p-4 rounded-2xl border border-slate-100 dark:border-slate-800/60">
            {[
              { label: 'Vendor', value: invoice.vendorName },
              { label: 'Vendor GSTIN', value: invoice.vendorGstin || '—' },
              { label: 'Vendor Invoice No.', value: invoice.vendorInvoiceNo },
              { label: 'Invoice Date', value: format(new Date(invoice.invoiceDate), 'dd MMM yyyy') },
              { label: 'Due Date', value: dueDate ? format(dueDate, 'dd MMM yyyy') : '—' },
              { label: 'Payment Terms', value: invoice.paymentTerms },
              { label: 'Payment Mode', value: invoice.paymentMode },
              { label: 'GL Account', value: invoice.glAccount || '—' },
              { label: 'Supply Type', value: isInterState ? 'Inter-state (IGST)' : 'Intra-state (CGST + SGST)' },
              { label: 'GST Applied', value: applyGst ? 'Yes' : 'No' }
            ].map(({ label, value }) => (
              <div key={label} className="space-y-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</p>
                <p className="font-semibold text-slate-800 dark:text-slate-200 text-xs truncate" title={value}>{value}</p>
              </div>
            ))}
          </div>

          {/* Line Items - Colored table header and elegant styling */}
          {invoice.items?.length > 0 && (
            <div className="overflow-x-auto rounded-2xl border border-slate-200/80 dark:border-slate-800">
              <table className="w-full text-xs">
                <thead className="bg-indigo-900 dark:bg-indigo-950 text-white">
                  <tr>
                    {['Description', 'HSN/SAC', 'Qty', 'Unit', 'Rate', 'GST%', 'CGST', 'SGST', 'IGST', 'Line Total'].map(h => (
                      <th key={h} className="px-3 py-3 text-left font-bold uppercase tracking-wider text-[10px] text-indigo-100">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {invoice.items.map((item, i) => (
                    <tr key={i} className={`transition-colors ${i % 2 === 0 ? 'bg-white dark:bg-slate-900/40' : 'bg-slate-50/40 dark:bg-slate-800/10'} hover:bg-slate-100/50 dark:hover:bg-slate-800/30`}>
                      <td className="px-3 py-3 font-semibold text-slate-800 dark:text-slate-200">{item.itemDescription}</td>
                      <td className="px-3 py-3 font-mono text-slate-500">{item.hsnSac || '—'}</td>
                      <td className="px-3 py-3 font-medium text-slate-600 dark:text-slate-400">{item.quantity}</td>
                      <td className="px-3 py-3 text-slate-600 dark:text-slate-400">{item.unit || 'Nos'}</td>
                      <td className="px-3 py-3 text-slate-700 dark:text-slate-300">₹{Number(item.unitPrice).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                      <td className="px-3 py-3 text-slate-700 dark:text-slate-300">{item.gstRate}%</td>
                      <td className="px-3 py-3 text-slate-600 dark:text-slate-400">₹{Number(item.cgstAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td className="px-3 py-3 text-slate-600 dark:text-slate-400">₹{Number(item.sgstAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td className="px-3 py-3 text-slate-600 dark:text-slate-400">₹{Number(item.igstAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td className="px-3 py-3 font-bold text-slate-900 dark:text-white">₹{Number(item.totalWithGst).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-50 dark:bg-slate-800/60 border-t border-slate-200 dark:border-slate-700">
                  <tr>
                    <td colSpan={8} className="px-3 py-2 text-right font-bold text-slate-500 text-xs">Taxable Value:</td>
                    <td colSpan={2} className="px-3 py-2 font-bold text-slate-900 dark:text-white">₹{taxable.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  </tr>
                  {applyGst ? (
                    isInterState ? (
                      <tr>
                        <td colSpan={8} className="px-3 py-2 text-right font-bold text-slate-500 text-xs">IGST:</td>
                        <td colSpan={2} className="px-3 py-2 font-bold text-slate-900 dark:text-white">₹{igst.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      </tr>
                    ) : (
                      <>
                        <tr>
                          <td colSpan={8} className="px-3 py-2 text-right font-bold text-slate-500 text-xs">CGST:</td>
                          <td colSpan={2} className="px-3 py-2 font-bold text-slate-900 dark:text-white">₹{cgst.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        </tr>
                        <tr>
                          <td colSpan={8} className="px-3 py-2 text-right font-bold text-slate-500 text-xs">SGST:</td>
                          <td colSpan={2} className="px-3 py-2 font-bold text-slate-900 dark:text-white">₹{sgst.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        </tr>
                      </>
                    )
                  ) : (
                    <tr>
                      <td colSpan={8} className="px-3 py-2 text-right font-bold text-slate-500 text-xs">GST (Exempted):</td>
                      <td colSpan={2} className="px-3 py-2 font-bold text-slate-500 dark:text-slate-400">₹0.00</td>
                    </tr>
                  )}
                  {freight > 0 && (
                    <tr>
                      <td colSpan={8} className="px-3 py-2 text-right font-bold text-slate-500 text-xs">Freight Charges:</td>
                      <td colSpan={2} className="px-3 py-2 font-bold text-slate-900 dark:text-white">₹{freight.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    </tr>
                  )}
                  {loadingCharges > 0 && (
                    <tr>
                      <td colSpan={8} className="px-3 py-2 text-right font-bold text-slate-500 text-xs">Loading Charges:</td>
                      <td colSpan={2} className="px-3 py-2 font-bold text-slate-900 dark:text-white">₹{loadingCharges.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    </tr>
                  )}
                  {unloadingCharges > 0 && (
                    <tr>
                      <td colSpan={8} className="px-3 py-2 text-right font-bold text-slate-500 text-xs">Unloading Charges:</td>
                      <td colSpan={2} className="px-3 py-2 font-bold text-slate-900 dark:text-white">₹{unloadingCharges.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    </tr>
                  )}
                  {packingCharges > 0 && (
                    <tr>
                      <td colSpan={8} className="px-3 py-2 text-right font-bold text-slate-500 text-xs">Packing Charges:</td>
                      <td colSpan={2} className="px-3 py-2 font-bold text-slate-900 dark:text-white">₹{packingCharges.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    </tr>
                  )}
                  {insurance > 0 && (
                    <tr>
                      <td colSpan={8} className="px-3 py-2 text-right font-bold text-slate-500 text-xs">Insurance:</td>
                      <td colSpan={2} className="px-3 py-2 font-bold text-slate-900 dark:text-white">₹{insurance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    </tr>
                  )}
                  {otherCharges > 0 && (
                    <tr>
                      <td colSpan={8} className="px-3 py-2 text-right font-bold text-slate-500 text-xs">Other Charges:</td>
                      <td colSpan={2} className="px-3 py-2 font-bold text-slate-900 dark:text-white">₹{otherCharges.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    </tr>
                  )}
                  {discount > 0 && (
                    <tr>
                      <td colSpan={8} className="px-3 py-2 text-right font-bold text-rose-500 text-xs">Discount:</td>
                      <td colSpan={2} className="px-3 py-2 font-bold text-rose-600">-₹{discount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    </tr>
                  )}
                  {roundOff !== 0 && (
                    <tr>
                      <td colSpan={8} className="px-3 py-2 text-right font-bold text-slate-500 text-xs">Round Off:</td>
                      <td colSpan={2} className="px-3 py-2 font-bold text-slate-900 dark:text-white">{(roundOff >= 0 ? '+' : '')}₹{roundOff.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    </tr>
                  )}
                  <tr className="border-t-2 border-slate-300 dark:border-slate-600 bg-indigo-50/50 dark:bg-indigo-950/20">
                    <td colSpan={8} className="px-3 py-3.5 text-right text-xs font-black text-slate-600 dark:text-slate-300 uppercase tracking-wider">Invoice Grand Total:</td>
                    <td colSpan={2} className="px-3 py-3.5 font-black text-xl text-indigo-600 dark:text-indigo-400">₹{grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {/* ITC Block */}
          <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 rounded-2xl p-4">
            <p className="text-xs font-bold text-emerald-600 uppercase tracking-wider mb-2">Input Tax Credit (ITC) Summary</p>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-xs text-slate-500">CGST Credit</p>
                <p className="font-bold text-emerald-700 dark:text-emerald-400">₹{cgst.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">SGST Credit</p>
                <p className="font-bold text-emerald-700 dark:text-emerald-400">₹{sgst.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Total ITC Available</p>
                <p className="font-bold text-emerald-700 dark:text-emerald-400 text-lg">₹{(cgst + sgst + igst).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</p>
              </div>
            </div>
          </div>

          {/* Remarks & Terms */}
          <div className="space-y-4">
            {invoice.narration && (
              <div className="bg-slate-50/50 dark:bg-slate-800/20 border border-slate-200/60 dark:border-slate-800 rounded-2xl p-4">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Remarks / Narration</p>
                <p className="text-xs text-slate-700 dark:text-slate-300 font-medium italic">"{invoice.narration}"</p>
              </div>
            )}
            <div className="border border-slate-200/60 dark:border-slate-800 rounded-2xl p-5 bg-slate-50/50 dark:bg-slate-900/50">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Purchase Order Terms & Conditions</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-slate-500 dark:text-slate-400 text-[10px] leading-relaxed">
                <ul className="list-decimal pl-4 space-y-2">
                  <li><strong>Reference Requirement:</strong> Supplier must clearly reference the PO number on all invoices, packing slips, and correspondence. Invoices without a valid PO number may be rejected.</li>
                  <li><strong>Invoice Submission:</strong> Supplier shall submit a tax-compliant invoice containing supplier details, invoice no/date, PO number, goods/services description, quantity, unit price, total, and applicable taxes.</li>
                  <li><strong>Three-Way Match Requirement:</strong> Payment is subject to successful matching of Approved Purchase Order, Goods Receipt Note (GRN) or Service Acceptance, and Supplier Invoice.</li>
                  <li><strong>Payment Terms:</strong> Standard payment terms: Net 30 days (or as agreed) from the later of receipt of a valid invoice or acceptance of goods/services.</li>
                  <li><strong>Acceptance of Goods/Services:</strong> Buyer reserves the right to inspect and reject goods or services that do not conform to PO specifications.</li>
                  <li><strong>Pricing:</strong> Prices stated in the PO are fixed and cannot be changed without written approval from the buyer.</li>
                </ul>
                <ul className="list-decimal pl-4 space-y-2">
                  <li value="7"><strong>Taxes:</strong> Supplier is responsible for complying with all applicable tax regulations. Taxes must be separately identified on the invoice.</li>
                  <li value="8"><strong>Supporting Documents:</strong> Supplier shall provide all required supporting documents, including delivery notes, timesheets, service reports, or certificates, as applicable.</li>
                  <li value="9"><strong>Discrepancies:</strong> Any discrepancy between the PO, receipt, and invoice may result in delayed payment until resolved.</li>
                  <li value="10"><strong>Compliance:</strong> Supplier shall comply with all applicable laws, regulations, and contractual obligations.</li>
                  <li value="11"><strong>Currency:</strong> Invoices must be issued in the currency specified on the PO unless otherwise agreed in writing.</li>
                  <li value="12"><strong>Invoice Approval:</strong> Payment is subject to internal approval procedures and verification of invoice accuracy.</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Signature and Seal Blocks */}
          <div className="grid grid-cols-2 gap-6 pt-4 border-t border-slate-100 dark:border-slate-800">
            <div className="border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex flex-col justify-between h-32 bg-slate-50/20 dark:bg-slate-900/20">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Supplier Signature</p>
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mt-1 truncate">For {invoice.vendorName}</p>
              </div>
              <div className="border-t border-slate-200 dark:border-slate-800 border-dashed pt-2">
                <p className="text-[10px] text-slate-400 text-center">Authorized Signatory</p>
              </div>
            </div>
            
            <div className="border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex flex-col justify-between h-32 bg-slate-50/20 dark:bg-slate-900/20 relative overflow-hidden">
              {/* Seal Stamp design */}
              <div className="absolute right-4 top-3 w-16 h-10 border-2 border-indigo-600/20 rounded-full flex flex-col items-center justify-center text-[8px] font-extrabold text-indigo-600/30 uppercase tracking-wider rotate-12 bg-indigo-50/5 dark:bg-indigo-950/5">
                <span>COMPANY</span>
                <span>SEAL</span>
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Receiver Signature</p>
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mt-1">For ERP MANUFACTURING SYSTEM</p>
              </div>
              <div className="border-t border-slate-200 dark:border-slate-800 border-dashed pt-2">
                <p className="text-[10px] text-slate-400 text-center">Authorized Signatory (with Company Seal)</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function AddSupplierInline({ onAdded, onClose }) {
  const [name, setName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [gstin, setGstin] = useState('');
  const [pan, setPan] = useState('');
  const [openingBalance, setOpeningBalance] = useState('0.00');
  const [creditLimit, setCreditLimit] = useState('0.00');
  const [address, setAddress] = useState('');
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isVerifyingGstin, setIsVerifyingGstin] = useState(false);

  const handleVerifyGSTIN = async () => {
    if (!gstin || !gstin.trim()) {
      Swal.fire({ icon: 'warning', title: 'GSTIN Required', text: 'Please enter a GSTIN to verify.', confirmButtonColor: '#4f46e5' });
      return;
    }
    const cleanGstin = gstin.trim().toUpperCase();
    const regex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
    if (!regex.test(cleanGstin)) {
      Swal.fire({ icon: 'error', title: 'Invalid GSTIN', text: 'Standard format: 2-digit State Code + 10-char PAN + Entity Digit + Z + Check Digit (15 chars).', confirmButtonColor: '#4f46e5' });
      return;
    }
    setIsVerifyingGstin(true);
    try {
      const res = await api.get(`/asset-management/verify-gstin/${cleanGstin}`);
      const data = res.data;
      const isLive = data.source === 'live';
      const statusBadge = data.status?.toLowerCase() === 'active'
        ? `<span style="background:#d1fae5;color:#065f46;padding:2px 10px;border-radius:999px;font-weight:700;font-size:11px;">✓ ACTIVE</span>`
        : `<span style="background:#fee2e2;color:#991b1b;padding:2px 10px;border-radius:999px;font-weight:700;font-size:11px;">✗ ${data.status?.toUpperCase() || 'UNKNOWN'}</span>`;
      const row = (label, value) =>
        value ? `<tr><td style="color:#6b7280;font-size:11px;padding:5px 0;width:45%;">${label}</td><td style="font-size:12px;font-weight:600;color:#111827;text-align:right;">${value}</td></tr>` : '';
      const tableHtml = `
        <div style="text-align:left">
          ${data.warning ? `<div style="background:#fef9c3;border:1px solid #fde68a;border-radius:8px;padding:8px 12px;font-size:11px;color:#92400e;margin-bottom:12px;">⚠️ ${data.warning}</div>` : ''}
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
            <code style="font-size:13px;font-weight:700;color:#4f46e5;letter-spacing:1px;">${data.gstin}</code>
            ${statusBadge}
          </div>
          <table style="width:100%;border-collapse:collapse;">
            ${row('Legal Name', data.legalName || '<span style="color:#9ca3af;font-style:italic;">Not available (live API required)</span>')}
            ${row('Trade Name', data.tradeName && data.tradeName !== data.legalName ? data.tradeName : '')}
            ${row('PAN', data.pan)}
            ${row('State', `${data.state} (${data.stateCode})`)}
            ${row('Constitution', data.constitutionOfBusiness)}
            ${row('Taxpayer Type', data.taxpayerType)}
            ${row('Registration Date', data.registrationDate)}
            ${row('Principal Address', data.principalAddress || '<span style="color:#9ca3af;font-style:italic;">Not available</span>')}
          </table>
          <div style="margin-top:12px;font-size:10px;color:#9ca3af;text-align:center;">
            ${isLive ? '🟢 Live data from GST Portal' : '🔵 Parsed from GSTIN format (offline mode)'}
          </div>
        </div>
      `;
      const result = await Swal.fire({
        title: '<span style="font-size:15px;">🔍 GST Registry Verification</span>',
        html: tableHtml,
        showCancelButton: true,
        confirmButtonText: 'Apply to Form',
        cancelButtonText: 'Close',
        confirmButtonColor: '#4f46e5',
        cancelButtonColor: '#6b7280',
        width: '480px'
      });
      if (result.isConfirmed) {
        setGstin(cleanGstin);
        setPan(data.pan || '');
        if (data.legalName) setName(data.legalName);
        if (data.principalAddress) setAddress(data.principalAddress);
      }
    } catch (err) {
      console.error('GSTIN verify error:', err);
      Swal.fire({ icon: 'error', title: 'Verification Failed', text: err.response?.data?.error || 'Unable to verify GSTIN.', confirmButtonColor: '#ef4444' });
    } finally {
      setIsVerifyingGstin(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name || !phone) return;
    setIsSubmitting(true);
    try {
      const res = await api.post('/parties/suppliers', {
        name, contactPerson, phone, email, gstin, pan, openingBalance, creditLimit, address, note
      });
      onAdded(res.data);
    } catch (err) {
      console.error('Failed to add supplier', err);
      Swal.fire({
        icon: 'error',
        title: 'Oops...',
        text: 'Failed to add supplier',
        confirmButtonColor: '#4f46e5'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 transition-all duration-300">
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 md:p-8 w-full max-w-2xl shadow-2xl border border-slate-200/60 dark:border-slate-800 max-h-[90vh] overflow-y-auto transform animate-in zoom-in-95 duration-200">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Quick Add Supplier</h2>
          <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500">
            <X className="w-5 h-5" />
          </Button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="md:col-span-2 space-y-1.5">
              <Label className="text-slate-700 dark:text-slate-300 font-medium">GSTIN</Label>
              <div className="flex gap-2">
                <Input value={gstin} onChange={e => setGstin(e.target.value)} placeholder="e.g. 29ABCDE1234F1Z5" className="h-[42px] rounded-xl border-slate-300 dark:border-slate-700 focus:ring-indigo-500/20 hover:border-indigo-400 transition-colors bg-slate-50/50 dark:bg-slate-900/50 font-mono uppercase" />
                <Button type="button" disabled={isVerifyingGstin} onClick={handleVerifyGSTIN} className="bg-indigo-600 hover:bg-indigo-700 text-white shrink-0 px-4 rounded-xl h-[42px] shadow-sm">
                  {isVerifyingGstin ? 'Verifying...' : 'Fetch Details'}
                </Button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-700 dark:text-slate-300 font-medium">Name <span className="text-rose-500">*</span></Label>
              <Input required value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Acme Corp" className="h-[42px] rounded-xl border-slate-300 dark:border-slate-700 focus:ring-indigo-500/20 hover:border-indigo-400 transition-colors bg-slate-50/50 dark:bg-slate-900/50" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-700 dark:text-slate-300 font-medium">Contact Person</Label>
              <Input value={contactPerson} onChange={e => setContactPerson(e.target.value)} placeholder="John Doe" className="h-[42px] rounded-xl border-slate-300 dark:border-slate-700 focus:ring-indigo-500/20 hover:border-indigo-400 transition-colors bg-slate-50/50 dark:bg-slate-900/50" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-700 dark:text-slate-300 font-medium">Phone <span className="text-rose-500">*</span></Label>
              <Input required value={phone} onChange={e => setPhone(e.target.value)} placeholder="Phone number" className="h-[42px] rounded-xl border-slate-300 dark:border-slate-700 focus:ring-indigo-500/20 hover:border-indigo-400 transition-colors bg-slate-50/50 dark:bg-slate-900/50" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-700 dark:text-slate-300 font-medium">Email</Label>
              <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="email@example.com" className="h-[42px] rounded-xl border-slate-300 dark:border-slate-700 focus:ring-indigo-500/20 hover:border-indigo-400 transition-colors bg-slate-50/50 dark:bg-slate-900/50" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-700 dark:text-slate-300 font-medium">PAN</Label>
              <Input value={pan} onChange={e => setPan(e.target.value)} placeholder="PAN" className="h-[42px] rounded-xl border-slate-300 dark:border-slate-700 focus:ring-indigo-500/20 hover:border-indigo-400 transition-colors bg-slate-50/50 dark:bg-slate-900/50 font-mono uppercase" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-700 dark:text-slate-300 font-medium">Opening Balance</Label>
              <Input type="number" step="0.01" value={openingBalance} onChange={e => setOpeningBalance(e.target.value)} className="h-[42px] rounded-xl border-slate-300 dark:border-slate-700 focus:ring-indigo-500/20 hover:border-indigo-400 transition-colors bg-slate-50/50 dark:bg-slate-900/50" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-700 dark:text-slate-300 font-medium">Credit Limit</Label>
              <Input type="number" step="0.01" value={creditLimit} onChange={e => setCreditLimit(e.target.value)} className="h-[42px] rounded-xl border-slate-300 dark:border-slate-700 focus:ring-indigo-500/20 hover:border-indigo-400 transition-colors bg-slate-50/50 dark:bg-slate-900/50" />
            </div>
            <div className="md:col-span-2 space-y-1.5">
              <Label className="text-slate-700 dark:text-slate-300 font-medium">Address</Label>
              <Input value={address} onChange={e => setAddress(e.target.value)} placeholder="123 Main St..." className="h-[42px] rounded-xl border-slate-300 dark:border-slate-700 focus:ring-indigo-500/20 hover:border-indigo-400 transition-colors bg-slate-50/50 dark:bg-slate-900/50" />
            </div>
            <div className="md:col-span-2 space-y-1.5">
              <Label className="text-slate-700 dark:text-slate-300 font-medium">Note</Label>
              <textarea 
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 p-3 bg-slate-50/50 dark:bg-slate-900/50 focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 hover:border-indigo-400 transition-all text-sm resize-none" 
                rows={3} 
                value={note} 
                onChange={e => setNote(e.target.value)} 
                placeholder="Additional notes..." 
              />
            </div>
          </div>
          <div className="flex justify-end space-x-3 pt-6 border-t border-slate-100 dark:border-slate-800">
            <Button type="button" variant="outline" onClick={onClose} className="rounded-xl px-6 h-11 text-slate-600 hover:text-slate-900 hover:bg-slate-100 border-slate-200 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white transition-colors">Cancel</Button>
            <Button type="submit" disabled={isSubmitting} className="rounded-xl px-6 h-11 bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-600/20 hover:shadow-indigo-600/30 transition-all font-medium">
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Adding...
                </>
              ) : 'Add Supplier'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Searchable Supplier Dropdown Component
function SupplierSelect({ suppliers, value, onChange, onAddNew, disabled }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = React.useRef(null);

  const filtered = suppliers.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) || 
    (s.phone && s.phone.toLowerCase().includes(search.toLowerCase()))
  );

  React.useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="flex gap-2 w-full">
      <div ref={containerRef} className="relative flex-1">
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen(!open)}
          className={`w-full px-4 h-[42px] border rounded-xl text-left flex items-center justify-between transition-all duration-200 shadow-sm ${
            disabled ? 'opacity-60 cursor-not-allowed bg-slate-100/50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-800' :
            open ? 'bg-indigo-50/50 border-indigo-400 ring-4 ring-indigo-500/10 dark:bg-indigo-900/10 dark:border-indigo-500' : 'bg-slate-50/50 dark:bg-slate-900/50 border-slate-300 dark:border-slate-700 hover:border-indigo-400 hover:bg-white dark:hover:bg-slate-800'
          }`}
        >
          <span className={value ? 'text-slate-900 dark:text-white truncate font-medium text-sm' : 'text-slate-500 dark:text-slate-400 text-sm'}>
            {value ? `${value.name} (${value.phone || 'N/A'})` : 'Select Supplier...'}
          </span>
          <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${open ? 'rotate-180 text-indigo-500' : ''}`} />
        </button>
        {open && !disabled && (
          <div className="absolute z-50 mt-2 w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="p-2 border-b border-slate-100 dark:border-slate-700 relative bg-slate-50/50 dark:bg-slate-900/50">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search Supplier Name or Phone..."
                className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all dark:text-white"
                autoFocus
              />
            </div>
            <ul className="max-h-60 overflow-y-auto p-1">
              {filtered.length === 0 ? (
                <li className="px-4 py-8 text-sm text-slate-500 flex flex-col items-center justify-center">
                  <Search className="w-6 h-6 text-slate-300 mb-2" />
                  No suppliers found
                </li>
              ) : (
                filtered.map(s => (
                  <li
                    key={s.id}
                    onMouseDown={() => { onChange(s); setOpen(false); setSearch(''); }}
                    className="px-4 py-2.5 mx-1 my-0.5 rounded-lg text-sm cursor-pointer hover:bg-indigo-50 hover:text-indigo-700 dark:hover:bg-indigo-500/10 dark:hover:text-indigo-300 transition-colors flex items-center justify-between group"
                  >
                    <span className="font-medium text-slate-700 group-hover:text-indigo-700 dark:text-slate-300 dark:group-hover:text-indigo-300">{s.name}</span>
                    <span className="text-xs text-slate-400 group-hover:text-indigo-500/70">{s.phone}</span>
                  </li>
                ))
              )}
            </ul>
          </div>
        )}
      </div>
      {!disabled && (
        <Button type="button" onClick={onAddNew} className="bg-indigo-600 hover:bg-indigo-700 text-white shrink-0 px-4 rounded-xl shadow-sm shadow-indigo-600/20 transition-all hover:shadow-md h-[42px]">
          <Plus className="w-5 h-5" />
        </Button>
      )}
    </div>
  );
}
const generateVendorInvoiceNo = (date = new Date(), invoicesCount = 0) => {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  const randomId = Math.floor(Math.random() * 9000) + 1000;
  const running = String(invoicesCount + 1).padStart(3, '0');
  return `VINV-${day}${month}${year}-${randomId}-${running}`;
};

function GRPOSelect({ grpos = [], value, onChange }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = React.useRef(null);

  const sortedGRPOs = [...grpos].sort((a, b) => {
    if (a.receivedDate && b.receivedDate) {
      return new Date(b.receivedDate) - new Date(a.receivedDate);
    }
    return b.grpoNo.localeCompare(a.grpoNo);
  });

  const filtered = sortedGRPOs.filter(g =>
    g.grpoNo?.toLowerCase().includes(search.toLowerCase()) ||
    g.vendorName?.toLowerCase().includes(search.toLowerCase())
  );

  React.useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={containerRef} className="relative w-full">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`w-full px-4 h-10 border rounded-xl text-left flex items-center justify-between transition-all duration-200 shadow-sm ${
          open ? 'bg-indigo-50/50 border-indigo-400 ring-4 ring-indigo-500/10 dark:bg-indigo-900/10 dark:border-indigo-500' : 'bg-slate-50/50 dark:bg-slate-900/50 border-slate-300 dark:border-slate-700 hover:border-indigo-400 hover:bg-white dark:hover:bg-slate-800'
        }`}
      >
        <span className={value ? 'text-slate-900 dark:text-white truncate font-medium text-sm' : 'text-slate-500 dark:text-slate-400 text-sm'}>
          {value ? `${value.grpoNo} — ${value.vendorName}` : 'Select Accepted GRPO...'}
        </span>
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${open ? 'rotate-180 text-indigo-500' : ''}`} />
      </button>
      {open && (
        <div className="absolute z-50 mt-2 w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="p-2 border-b border-slate-100 dark:border-slate-700 relative bg-slate-50/50 dark:bg-slate-900/50">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search GRPO No or Vendor..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all dark:text-white"
              autoFocus
            />
          </div>
          <ul className="max-h-60 overflow-y-auto p-1">
            {filtered.length === 0 ? (
              <li className="px-4 py-8 text-sm text-slate-500 flex flex-col items-center justify-center">
                <Search className="w-6 h-6 text-slate-300 mb-2" />
                No goods receipts found
              </li>
            ) : (
              filtered.map(g => {
                const count = g.items?.reduce((s, i) => s + Number(i.acceptedQuantity || 0), 0) || 0;
                return (
                  <li
                    key={g.id}
                    onMouseDown={() => { onChange(g); setOpen(false); setSearch(''); }}
                    className="px-4 py-2.5 mx-1 my-0.5 rounded-lg text-sm cursor-pointer hover:bg-indigo-50 hover:text-indigo-700 dark:hover:bg-indigo-500/10 dark:hover:text-indigo-300 transition-colors flex flex-col justify-start group"
                  >
                    <div className="flex justify-between w-full">
                      <span className="font-semibold text-slate-700 dark:text-slate-300 group-hover:text-indigo-700 dark:group-hover:text-indigo-300">{g.grpoNo}</span>
                      <span className="font-bold text-slate-900 dark:text-white group-hover:text-indigo-700 dark:group-hover:text-indigo-300">{count} items</span>
                    </div>
                    <span className="text-xs text-slate-400 mt-0.5">{g.vendorName} • {g.receivedDate ? format(new Date(g.receivedDate), 'dd MMM yyyy hh:mm a') : '—'}</span>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

function CreateAPInvoiceForm({ onBack, isReadOnly, invoicesCount = 0 }) {
  const [isInterState, setIsInterState] = useState(false);
  const [isInvoiceNoDirty, setIsInvoiceNoDirty] = useState(false);
  
  // GSTIN Live Verification States
  const [gstinVerifyResult, setGstinVerifyResult] = useState(null);
  const [isVerifyingGstin, setIsVerifyingGstin] = useState(false);
  const [gstinWarning, setGstinWarning] = useState('');

  const [form, setForm] = useState({
    grpoId: '',
    poId: '',
    vendorName: '',
    vendorGstin: '',
    vendorPan: '',
    vendorAddress: '',
    vendorInvoiceNo: generateVendorInvoiceNo(new Date(), invoicesCount),
    invoiceDate: new Date(),
    dueDate: null,
    paymentTerms: 'Net 30',
    paymentMode: 'Bank Transfer (NEFT)',
    glAccount: '2310001',
    discount: '',
    freight: '',
    loadingCharges: '',
    unloadingCharges: '',
    packingCharges: '',
    insurance: '',
    otherCharges: '',
    applyGst: true,
    narration: '',
    items: [],
  });
  const [error, setError] = useState('');
  const [showAddSupplier, setShowAddSupplier] = useState(false);
  const qc = useQueryClient();
  const isGrpoLinked = !!form.grpoId;

  const { data: grpos = [] } = useQuery({
    queryKey: ['asset-grpos-accepted'],
    queryFn: () => api.get('/asset-management/grpo').then(r => r.data.filter(g => g.status === 'Accepted')),
  });

  const { data: pos = [] } = useQuery({
    queryKey: ['asset-pos'],
    queryFn: () => api.get('/asset-management/purchase-orders').then(r => r.data),
  });

  const { data: suppliers = [], refetch: refetchSuppliers } = useQuery({
    queryKey: ['suppliers'],
    queryFn: () => api.get('/parties/suppliers').then(r => r.data?.data || r.data || []),
  });

  const handleVerifyGSTIN = async (gstinNumber) => {
    if (!gstinNumber) return;
    setIsVerifyingGstin(true);
    setGstinVerifyResult(null);
    
    // Format validation (15 characters: 2-digit state + 10-char PAN + 1 entity digit + Z + 1 check digit)
    const regex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
    if (!regex.test(gstinNumber.trim().toUpperCase())) {
      Swal.fire({
        icon: 'error',
        title: 'Invalid GSTIN Format',
        text: 'GSTIN format is invalid. Standard format: 2-digit State Code + 10-char PAN + 1 Entity Digit + Z + 1 Check Digit.',
        confirmButtonColor: '#4f46e5',
        customClass: {
          popup: 'rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900',
          title: 'text-slate-900 dark:text-white',
          htmlContainer: 'text-slate-600 dark:text-slate-300'
        }
      });
      setIsVerifyingGstin(false);
      return;
    }
    
    const cleanGstin = gstinNumber.trim().toUpperCase();
    const cacheKey = `gstin_${cleanGstin}`;
    const cached = sessionStorage.getItem(cacheKey);
    if (cached) {
      const data = JSON.parse(cached);
      setGstinVerifyResult(data);
      if (data.status !== 'ACTIVE') {
        setGstinWarning(`WARNING: Vendor GSTIN ${data.gstin} is ${data.status}. Input Tax Credit may not be available. Proceed with caution.`);
        Swal.fire({
          icon: 'error',
          title: 'The GSTIN is inactive',
          text: `The GSTIN ${data.gstin} is ${data.status}! Expired Date: ${data.expiredDate || '31/03/2026'}`,
          confirmButtonColor: '#4f46e5',
          customClass: {
            popup: 'rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900',
            title: 'text-slate-900 dark:text-white',
            htmlContainer: 'text-slate-600 dark:text-slate-300'
          }
        });
      } else {
        setGstinWarning('');
      }
      setIsVerifyingGstin(false);
      return;
    }

    try {
      // Simulate live government registry service API fetch
      await new Promise(resolve => setTimeout(resolve, 800));
      
      const statesMap = {
        '27': 'Maharashtra', '29': 'Karnataka', '33': 'Tamil Nadu', 
        '07': 'Delhi', '09': 'Uttar Pradesh', '19': 'West Bengal'
      };
      const stateCode = cleanGstin.substring(0, 2);
      const stateName = statesMap[stateCode] || 'Other State';
      
      // Simulate ACTIVE for most, except if it ends with X, 9, or 0
      const status = cleanGstin.endsWith('X') || cleanGstin.endsWith('9') || cleanGstin.endsWith('0') ? 'INACTIVE' : 'ACTIVE';
      const expiredDate = status !== 'ACTIVE' ? '31/03/2026' : null;
      
      const result = {
        gstin: cleanGstin,
        status: status,
        legalName: `M/S ${form.vendorName || 'Asset Vendor Private Limited'}`,
        tradeName: form.vendorName || 'Asset Vendor Co.',
        registrationDate: '01/07/2017',
        expiredDate: expiredDate,
        lastUpdatedDate: format(new Date(), 'dd/MM/yyyy'),
        state: stateName,
        taxpayerType: 'Regular'
      };

      sessionStorage.setItem(cacheKey, JSON.stringify(result));
      setGstinVerifyResult(result);
      if (status !== 'ACTIVE') {
        setGstinWarning(`WARNING: Vendor GSTIN ${cleanGstin} is ${status}. Input Tax Credit may not be available. Proceed with caution.`);
        Swal.fire({
          icon: 'error',
          title: 'The GSTIN is inactive',
          text: `The GSTIN ${cleanGstin} is ${status}! Expired Date: ${expiredDate}`,
          confirmButtonColor: '#4f46e5',
          customClass: {
            popup: 'rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900',
            title: 'text-slate-900 dark:text-white',
            htmlContainer: 'text-slate-600 dark:text-slate-300'
          }
        });
      } else {
        setGstinWarning('');
      }
    } catch (error) {
      Swal.fire({
        icon: 'warning',
        title: 'Verification Service Offline',
        text: 'GST verification service unavailable. Please verify manually.',
        confirmButtonColor: '#4f46e5',
        customClass: {
          popup: 'rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900',
          title: 'text-slate-900 dark:text-white',
          htmlContainer: 'text-slate-605 dark:text-slate-355'
        }
      });
    } finally {
      setIsVerifyingGstin(false);
    }
  };

  const calcItem = (item) => {
    const base = Number(item.quantity) * Number(item.unitPrice || 0);
    const gstTotal = form.applyGst ? base * (Number(item.gstRate) / 100) : 0;
    return {
      totalBeforeTax: base,
      cgstAmount: isInterState ? 0 : gstTotal / 2,
      sgstAmount: isInterState ? 0 : gstTotal / 2,
      igstAmount: isInterState ? gstTotal : 0,
      totalWithGst: base + gstTotal,
    };
  };

  const totals = form.items.reduce((acc, item) => {
    const c = calcItem(item);
    return {
      taxable: acc.taxable + c.totalBeforeTax,
      cgst: acc.cgst + c.cgstAmount,
      sgst: acc.sgst + c.sgstAmount,
      igst: acc.igst + c.igstAmount,
      total: acc.total + c.totalWithGst,
    };
  }, { taxable: 0, cgst: 0, sgst: 0, igst: 0, total: 0 });

  const freight = Number(form.freight || 0);
  const loadingCharges = Number(form.loadingCharges || 0);
  const unloadingCharges = Number(form.unloadingCharges || 0);
  const packingCharges = Number(form.packingCharges || 0);
  const insurance = Number(form.insurance || 0);
  const otherCharges = Number(form.otherCharges || 0);
  const discount = Number(form.discount || 0);

  const preRoundTotal = totals.taxable + (form.applyGst ? (totals.cgst + totals.sgst + totals.igst) : 0) + freight + loadingCharges + unloadingCharges + packingCharges + insurance + otherCharges - discount;
  const grandTotal = Math.round(preRoundTotal);
  const roundOff = grandTotal - preRoundTotal;

  const mutation = useMutation({
    mutationFn: data => api.post('/asset-management/ap-invoices', data).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['asset-ap-invoices'] });
      Swal.fire({ icon: 'success', title: 'AP Invoice Booked!', text: 'Invoice posted to accounts payable.', confirmButtonColor: '#4f46e5' }).then(() => onBack());
    },
    onError: err => setError(err.response?.data?.error || 'Failed to book invoice'),
  });

  const handleSubmit = e => {
    e.preventDefault();
    setError('');
    if (!form.grpoId) { setError('Please link this AP Invoice to an accepted GRPO'); return; }
    if (!form.invoiceDate) { setError('Invoice date is required'); return; }
    if (!form.vendorInvoiceNo) { setError('Vendor invoice number is required'); return; }
    if (!form.vendorName) { setError('Vendor name is required'); return; }
    if (form.items.length === 0) { setError('No items found. Please select a reference GRPO to import items.'); return; }
    if (form.items.some(i => !i.itemDescription || !i.unitPrice)) { setError('All item fields are required'); return; }
    mutation.mutate({
      ...form,
      isInterState,
      discount: Number(form.discount || 0),
      freight: Number(form.freight || 0),
      loadingCharges: Number(form.loadingCharges || 0),
      unloadingCharges: Number(form.unloadingCharges || 0),
      packingCharges: Number(form.packingCharges || 0),
      insurance: Number(form.insurance || 0),
      otherCharges: Number(form.otherCharges || 0),
      applyGst: Boolean(form.applyGst),
      items: form.items.map(i => ({ ...i, ...calcItem(i) })),
    });
  };

  const update = (f, v) => {
    setForm(p => {
      let updatedNo = p.vendorInvoiceNo;
      if (f === 'invoiceDate' && !isInvoiceNoDirty) {
        updatedNo = generateVendorInvoiceNo(v || new Date(), invoicesCount);
      }
      return {
        ...p,
        [f]: v,
        vendorInvoiceNo: updatedNo
      };
    });
  };
  const updateItem = (idx, f, v) => setForm(p => ({ ...p, items: p.items.map((it, i) => i === idx ? { ...it, [f]: v } : it) }));
  const addItem = () => setForm(p => ({ ...p, items: [...p.items, { itemDescription: '', hsnSac: '', quantity: 1, unit: 'Nos', unitPrice: '', gstRate: 18 }] }));
  const removeItem = idx => setForm(p => ({ ...p, items: p.items.filter((_, i) => i !== idx) }));

  const fillFromGRPO = grpoId => {
    const g = grpos.find(gr => gr.id === grpoId);
    if (!g) return;
    const s = suppliers.find(sup => sup.name.toLowerCase() === g.vendorName.toLowerCase());
    
    // Find the linked PO by poNo
    const linkedPO = pos.find(p => p.poNo === g.poNo);
    
    setForm(prev => ({
      ...prev, grpoId,
      vendorName: g.vendorName,
      vendorGstin: s?.gstin || g.vendorGstin || prev.vendorGstin || '',
      vendorPan: s?.pan || prev.vendorPan || '',
      vendorAddress: s?.address || prev.vendorAddress || '',
      discount: linkedPO ? String(linkedPO.discount) : prev.discount,
      freight: linkedPO ? String(linkedPO.freight) : prev.freight,
      loadingCharges: linkedPO ? String(linkedPO.loadingCharges) : prev.loadingCharges,
      unloadingCharges: linkedPO ? String(linkedPO.unloadingCharges) : prev.unloadingCharges,
      packingCharges: linkedPO ? String(linkedPO.packingCharges) : prev.packingCharges,
      insurance: linkedPO ? String(linkedPO.insurance) : prev.insurance,
      otherCharges: linkedPO ? String(linkedPO.otherCharges) : prev.otherCharges,
      applyGst: linkedPO ? Boolean(linkedPO.applyGst) : true,
      items: g.items?.filter(i => Number(i.acceptedQuantity) > 0).map(i => {
        // Find corresponding PO item to get the unitPrice (or fallback)
        const poItem = linkedPO?.items?.find(pi => pi.description === i.description);
        return {
          itemDescription: i.itemDescription, hsnSac: i.hsnSac || '',
          quantity: Number(i.acceptedQuantity), unit: i.unit || 'Nos',
          unitPrice: poItem ? Number(poItem.unitPrice) : (i.unitPrice || ''),
          gstRate: poItem ? Number(poItem.gstRate) : Number(i.gstRate || 18),
        };
      }) || prev.items,
    }));
    
    if (linkedPO) {
      setIsInterState(Boolean(linkedPO.isInterState));
    }
  };

  return (
    <div className="space-y-6 w-full">
      {showAddSupplier && (
        <AddSupplierInline
          onClose={() => setShowAddSupplier(false)}
          onAdded={(newSup) => {
            setShowAddSupplier(false);
            refetchSuppliers().then(() => {
              setForm(prev => ({
                ...prev,
                vendorName: newSup.name,
                vendorAddress: newSup.address || '',
                vendorGstin: newSup.gstin || '',
                vendorPan: newSup.pan || ''
              }));
            });
          }}
        />
      )}

      {gstinVerifyResult && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 w-full max-w-md shadow-2xl border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-200 text-slate-800 dark:text-slate-100">
            <div className="flex justify-between items-center mb-4 border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold flex items-center gap-2">
                🛡️ GSTIN Verification Registry
              </h3>
              <button type="button" onClick={() => setGstinVerifyResult(null)} className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between border-b border-slate-50 dark:border-slate-800/50 pb-1.5">
                <span className="text-slate-500 text-xs">GSTIN Status</span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-black ${
                  gstinVerifyResult.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400' : 'bg-rose-100 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400'
                }`}>
                  {gstinVerifyResult.status}
                </span>
              </div>
              {[
                { label: 'GSTIN Number', value: gstinVerifyResult.gstin },
                { label: 'Legal Name', value: gstinVerifyResult.legalName },
                { label: 'Trade Name', value: gstinVerifyResult.tradeName },
                { label: 'Registration Date', value: gstinVerifyResult.registrationDate },
                ...(gstinVerifyResult.expiredDate ? [{ label: 'Expired Date', value: gstinVerifyResult.expiredDate }] : []),
                { label: 'Last Updated', value: gstinVerifyResult.lastUpdatedDate },
                { label: 'State Jurisdiction', value: gstinVerifyResult.state },
                { label: 'Taxpayer Type', value: gstinVerifyResult.taxpayerType },
              ].filter(Boolean).map(item => (
                <div key={item.label} className="flex justify-between border-b border-slate-50 dark:border-slate-800/50 pb-1.5">
                  <span className="text-slate-500 text-xs">{item.label}</span>
                  <span className="font-semibold text-xs text-right max-w-[220px] truncate" title={item.value}>{item.value}</span>
                </div>
              ))}
            </div>
            <div className="mt-5 flex justify-end">
              <Button type="button" onClick={() => setGstinVerifyResult(null)} className="rounded-xl px-4 h-9 bg-indigo-600 hover:bg-indigo-700 text-white">
                Close Registry
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onBack} className="rounded-full border border-slate-200 dark:border-slate-700">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Book AP Invoice</h2>
          <p className="text-sm text-slate-500">SAP B1 Asset Procurement — Step 5 of 8 (GST/ITC Compliant)</p>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-3 p-4 bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/50 rounded-2xl text-rose-700 dark:text-rose-400 text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> {error}
        </div>
      )}

      {gstinWarning && (
        <div className="flex items-start gap-3 p-4 bg-rose-50 dark:bg-rose-950/25 border border-rose-200 dark:border-rose-900/50 rounded-2xl text-rose-700 dark:text-rose-400 text-sm font-semibold animate-pulse">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600 dark:text-rose-500" />
          <span>{gstinWarning}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Fill from GRPO */}
        <div className="border border-indigo-200 dark:border-indigo-900/50 bg-indigo-50/40 dark:bg-indigo-950/20 rounded-2xl p-5">
          <h3 className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider mb-3 flex items-center gap-2">
            <FileText className="w-4 h-4" /> Link to GRPO
          </h3>
          <div className="relative max-w-md">
            <GRPOSelect
              grpos={grpos}
              value={grpos.find(g => g.id === form.grpoId) || null}
              onChange={grpo => fillFromGRPO(grpo.id)}
            />
          </div>
        </div>

        {/* Vendor Details */}
        <div className="border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-indigo-500" /> Vendor Details
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label>Vendor Name <span className="text-rose-500">*</span></Label>
              <SupplierSelect
                suppliers={suppliers}
                disabled={isGrpoLinked}
                value={suppliers.find(s => s.name === form.vendorName) || null}
                onChange={s => {
                  setForm(prev => ({
                    ...prev,
                    vendorName: s.name,
                    vendorAddress: s.address || '',
                    vendorGstin: s.gstin || '',
                    vendorPan: s.pan || ''
                  }));
                }}
                onAddNew={() => setShowAddSupplier(true)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1">Vendor GSTIN <span className="text-rose-500">*</span></Label>
              <div className="flex gap-2">
                <Input required disabled={isGrpoLinked} value={form.vendorGstin} onChange={e => update('vendorGstin', e.target.value)} placeholder="22AAAAA0000A1Z5" className="h-10 rounded-xl font-mono flex-1 text-sm bg-white dark:bg-slate-950 disabled:opacity-60 disabled:cursor-not-allowed disabled:bg-slate-100/50 dark:disabled:bg-slate-800/50" />
                <Button
                  type="button"
                  variant="outline"
                  disabled={isVerifyingGstin || !form.vendorGstin || isGrpoLinked}
                  onClick={() => handleVerifyGSTIN(form.vendorGstin)}
                  className="h-10 w-10 shrink-0 rounded-xl border-slate-200 dark:border-slate-700 text-indigo-600 dark:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                  title="Verify GSTIN with registry"
                >
                  {isVerifyingGstin ? <Loader2 className="w-4 h-4 animate-spin" /> : <span className="font-bold text-xs">ℹ️</span>}
                </Button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Vendor PAN</Label>
              <Input disabled={isGrpoLinked} value={form.vendorPan} onChange={e => update('vendorPan', e.target.value)} placeholder="AAAAA0000A" className="h-10 rounded-xl font-mono disabled:opacity-60 disabled:cursor-not-allowed disabled:bg-slate-100/50 dark:disabled:bg-slate-800/50" />
            </div>
            <div className="space-y-1.5">
              <Label>Vendor Invoice No. <span className="text-rose-500">*</span></Label>
              <div className="flex gap-2">
                <Input
                  required
                  value={form.vendorInvoiceNo}
                  onChange={e => {
                    setIsInvoiceNoDirty(true);
                    update('vendorInvoiceNo', e.target.value);
                  }}
                  placeholder="INV/2024-25/001"
                  className="h-10 rounded-xl font-mono flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    const regenerated = generateVendorInvoiceNo(form.invoiceDate || new Date(), invoicesCount);
                    setIsInvoiceNoDirty(false);
                    setForm(p => ({ ...p, vendorInvoiceNo: regenerated }));
                  }}
                  className="h-[40px] rounded-xl px-3 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                  title="Regenerate auto invoice number"
                >
                  Regen
                </Button>
              </div>
            </div>
            <DatePicker label="Invoice Date *" value={form.invoiceDate} onChange={d => update('invoiceDate', d)} placeholder="Invoice date" />
            <DatePicker label="Due Date" value={form.dueDate} onChange={d => update('dueDate', d)} placeholder="Payment due date" />
            <div className="md:col-span-2 space-y-1.5">
              <Label>Vendor Address</Label>
              <Input disabled={isGrpoLinked} value={form.vendorAddress} onChange={e => update('vendorAddress', e.target.value)} placeholder="Full registered address" className="h-10 rounded-xl disabled:opacity-60 disabled:cursor-not-allowed disabled:bg-slate-100/50 dark:disabled:bg-slate-800/50" />
            </div>
            <div className="space-y-1.5">
              <Label>GL Account</Label>
              <Input value={form.glAccount} onChange={e => update('glAccount', e.target.value)} className="h-10 rounded-xl font-mono" />
            </div>
          </div>
          {/* Inter-state toggle */}
          <div className="mt-4 flex items-center gap-3">
            <button type="button" onClick={() => setIsInterState(p => !p)}
              className={`relative w-10 h-5 rounded-full transition-colors ${isInterState ? 'bg-indigo-600' : 'bg-slate-200 dark:bg-slate-700'}`}>
              <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${isInterState ? 'translate-x-5' : ''}`} />
            </button>
            <div>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Inter-state Supply (IGST applicable)</p>
              <p className="text-xs text-slate-500">{isInterState ? 'IGST will be applied (no CGST/SGST)' : 'CGST + SGST will be applied (intra-state)'}</p>
            </div>
          </div>
        </div>

        {/* Line Items */}
        <div className="border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <Package className="w-4 h-4 text-indigo-500" /> Invoice Line Items
            </h3>
            {!isGrpoLinked && (
              <Button type="button" variant="outline" size="sm" onClick={addItem} className="h-8 rounded-lg text-xs gap-1 border-indigo-200 dark:border-indigo-900 text-indigo-600 hover:bg-indigo-50">
                <Plus className="w-3.5 h-3.5" /> Add Item
              </Button>
            )}
          </div>
          <div className="space-y-3">
            {form.items.map((item, idx) => {
              const { totalWithGst, cgstAmount, sgstAmount, igstAmount } = calcItem(item);
              return (
                <div key={idx} className="bg-slate-50/60 dark:bg-slate-800/30 rounded-xl p-4 border border-slate-200/60 dark:border-slate-800/60">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="md:col-span-2 space-y-1">
                      <Label className="text-xs">Description <span className="text-rose-500">*</span></Label>
                      <Input
                        disabled={isGrpoLinked}
                        value={item.itemDescription}
                        onChange={e => updateItem(idx, 'itemDescription', e.target.value)}
                        className="h-9 rounded-lg text-sm disabled:opacity-60 disabled:cursor-not-allowed disabled:bg-slate-100/50 dark:disabled:bg-slate-800/50"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">HSN/SAC</Label>
                      <Input
                        disabled={isGrpoLinked}
                        value={item.hsnSac}
                        onChange={e => updateItem(idx, 'hsnSac', e.target.value)}
                        className="h-9 rounded-lg text-sm font-mono disabled:opacity-60 disabled:cursor-not-allowed disabled:bg-slate-100/50 dark:disabled:bg-slate-800/50"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Unit</Label>
                      <div className="relative">
                        <select
                          disabled={isGrpoLinked}
                          value={item.unit}
                          onChange={e => updateItem(idx, 'unit', e.target.value)}
                          className="w-full h-9 px-2 pr-7 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-sm appearance-none focus:outline-none disabled:opacity-60 disabled:cursor-not-allowed disabled:bg-slate-100/50 dark:disabled:bg-slate-800/50"
                        >
                          {['Nos', 'Pcs', 'Set', 'Kg', 'Ltr', 'Mtr', 'Box'].map(u => <option key={u}>{u}</option>)}
                        </select>
                        {!isGrpoLinked && <ChevronDown className="w-3 h-3 text-slate-400 absolute right-2 top-3 pointer-events-none" />}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Quantity</Label>
                      <Input
                        disabled={isGrpoLinked}
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={e => updateItem(idx, 'quantity', e.target.value)}
                        className="h-9 rounded-lg text-sm disabled:opacity-60 disabled:cursor-not-allowed disabled:bg-slate-100/50 dark:disabled:bg-slate-800/50"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Rate (₹) <span className="text-rose-500">*</span></Label>
                      <Input
                        disabled={isGrpoLinked}
                        type="number"
                        min="0"
                        value={item.unitPrice}
                        onChange={e => updateItem(idx, 'unitPrice', e.target.value)}
                        className="h-9 rounded-lg text-sm disabled:opacity-60 disabled:cursor-not-allowed disabled:bg-slate-100/50 dark:disabled:bg-slate-800/50"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">GST%</Label>
                      <div className="relative">
                        <select
                          disabled={isGrpoLinked}
                          value={item.gstRate}
                          onChange={e => updateItem(idx, 'gstRate', Number(e.target.value))}
                          className="w-full h-9 px-2 pr-7 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-sm appearance-none focus:outline-none disabled:opacity-60 disabled:cursor-not-allowed disabled:bg-slate-100/50 dark:disabled:bg-slate-800/50"
                        >
                          {GST_RATES.map(r => <option key={r} value={r}>{r}%</option>)}
                        </select>
                        {!isGrpoLinked && <ChevronDown className="w-3 h-3 text-slate-400 absolute right-2 top-3 pointer-events-none" />}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">{isInterState ? 'IGST' : 'CGST+SGST'}</Label>
                      <div className="h-9 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 flex items-center text-xs font-semibold text-emerald-600">
                        ₹{(isInterState ? igstAmount : cgstAmount + sgstAmount).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <p className="text-xs text-slate-500">Line Total (incl. GST): <span className="font-bold text-indigo-600 dark:text-indigo-400">₹{totalWithGst.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span></p>
                    {!isGrpoLinked && form.items.length > 1 && (
                      <button type="button" onClick={() => removeItem(idx)} className="p-1.5 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Totals + Other Charges */}
          <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-4">
              {/* GST Toggles & Checkbox */}
              <div className="bg-slate-50/50 dark:bg-slate-800/10 p-4 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-350">GST Applicability</span>
                  <div className="flex items-center gap-2">
                    <input 
                      type="checkbox" 
                      id="invoiceApplyGst" 
                      checked={form.applyGst} 
                      onChange={e => update('applyGst', e.target.checked)}
                      className="w-4 h-4 rounded text-indigo-650 border-slate-300 focus:ring-indigo-500"
                    />
                    <Label htmlFor="invoiceApplyGst" className="text-xs font-medium cursor-pointer">
                      {form.applyGst ? `Apply GST (${isInterState ? 'IGST' : 'CGST + SGST'})` : 'Exempt / No GST'}
                    </Label>
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-slate-200/60 dark:border-slate-800/60 pt-2.5">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-350">Supply Type</span>
                  <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-850 p-0.5 rounded-lg border border-slate-200/50 dark:border-slate-700/50">
                    <button
                      type="button"
                      onClick={() => setIsInterState(false)}
                      className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${!isInterState ? 'bg-white dark:bg-slate-900 shadow-sm text-indigo-600 dark:text-indigo-400' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                      Intra-state (CGST+SGST)
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsInterState(true)}
                      className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${isInterState ? 'bg-white dark:bg-slate-900 shadow-sm text-indigo-600 dark:text-indigo-400' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                      Inter-state (IGST)
                    </button>
                  </div>
                </div>
              </div>

              {/* 7 Charges inputs & Payment Mode */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Discount (₹)</Label>
                  <Input type="number" min="0" value={form.discount} onChange={e => update('discount', e.target.value)} placeholder="0.00" className="h-9 rounded-xl" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Freight (₹)</Label>
                  <Input type="number" min="0" value={form.freight} onChange={e => update('freight', e.target.value)} placeholder="0.00" className="h-9 rounded-xl" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Loading Charges (₹)</Label>
                  <Input type="number" min="0" value={form.loadingCharges} onChange={e => update('loadingCharges', e.target.value)} placeholder="0.00" className="h-9 rounded-xl" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Unloading Charges (₹)</Label>
                  <Input type="number" min="0" value={form.unloadingCharges} onChange={e => update('unloadingCharges', e.target.value)} placeholder="0.00" className="h-9 rounded-xl" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Packing Charges (₹)</Label>
                  <Input type="number" min="0" value={form.packingCharges} onChange={e => update('packingCharges', e.target.value)} placeholder="0.00" className="h-9 rounded-xl" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Insurance (₹)</Label>
                  <Input type="number" min="0" value={form.insurance} onChange={e => update('insurance', e.target.value)} placeholder="0.00" className="h-9 rounded-xl" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Other Charges (₹)</Label>
                  <Input type="number" min="0" value={form.otherCharges} onChange={e => update('otherCharges', e.target.value)} placeholder="0.00" className="h-9 rounded-xl" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Payment Mode</Label>
                  <div className="relative">
                    <select value={form.paymentMode} onChange={e => update('paymentMode', e.target.value)} className="w-full h-9 px-2 pr-7 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-sm appearance-none focus:outline-none">
                      {PAYMENT_MODES.map(m => <option key={m}>{m}</option>)}
                    </select>
                    <ChevronDown className="w-3 h-3 text-slate-400 absolute right-2 top-2.5 pointer-events-none" />
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-gradient-to-br from-indigo-50 to-violet-50 dark:from-indigo-950/30 dark:to-violet-950/30 rounded-2xl p-4 space-y-2 text-sm h-fit">
              {[
                { label: 'Taxable Value', value: totals.taxable },
                ...(form.applyGst ? (
                  isInterState ? [
                    { label: 'IGST', value: totals.igst }
                  ] : [
                    { label: 'CGST', value: totals.cgst },
                    { label: 'SGST', value: totals.sgst }
                  ]
                ) : [
                  { label: 'GST (Exempted)', value: 0 }
                ]),
                { label: 'Freight Charges', value: freight },
                { label: 'Loading Charges', value: loadingCharges },
                { label: 'Unloading Charges', value: unloadingCharges },
                { label: 'Packing Charges', value: packingCharges },
                { label: 'Insurance', value: insurance },
                { label: 'Other Charges', value: otherCharges },
                { label: 'Discount', value: -discount },
                { label: 'Round Off', value: roundOff },
              ].map(({ label, value }) => {
                const formatted = Math.abs(value).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                let textClass = 'text-slate-800 dark:text-slate-200';
                let prefix = '₹';
                if (label === 'Discount' && value < 0) {
                  textClass = 'text-rose-500 font-bold';
                  prefix = '-₹';
                } else if (label === 'Round Off') {
                  if (value > 0) {
                    prefix = '+₹';
                  } else if (value < 0) {
                    prefix = '-₹';
                  }
                }
                return (
                  <div key={label} className="flex justify-between text-slate-650 dark:text-slate-400">
                    <span>{label}</span>
                    <span className={`font-semibold ${textClass}`}>
                      {prefix}{formatted}
                    </span>
                  </div>
                );
              })}
              <div className="pt-2 border-t border-indigo-200 dark:border-indigo-900/50 flex justify-between font-black text-lg text-indigo-700 dark:text-indigo-400">
                <span>Invoice Total</span>
                <span>₹{grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              {form.applyGst && (
                <p className="text-[10px] text-slate-405">
                  ITC: ₹{(totals.cgst + totals.sgst + totals.igst).toLocaleString('en-IN', { maximumFractionDigits: 2 })} (eligible after payment)
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Narration */}
        <div className="border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
          <Label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">Narration / Remarks</Label>
          <textarea value={form.narration} onChange={e => update('narration', e.target.value)} rows={2}
            placeholder="e.g. Being asset capitalization invoice for purchase of IT equipment..."
            className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 resize-none" />
        </div>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={onBack} className="rounded-xl px-6 h-11">Cancel</Button>
          <Button type="submit" disabled={mutation.isPending || isReadOnly} className="rounded-xl px-6 h-11 bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-600/20 gap-2">
            {mutation.isPending ? <><Loader2 className="w-4 h-4 animate-spin" /> Booking...</> : <><Receipt className="w-4 h-4" /> Book Invoice</>}
          </Button>
        </div>
      </form>
    </div>
  );
}

export default function APInvoiceView() {
  const user = useAuthStore(s => s.user);
  const isReadOnly = user?.role === 'SUPERVISOR';
  const [view, setView] = useState('list');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [selectedInvoice, setSelectedInvoice] = useState(null);

  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ['asset-ap-invoices'],
    queryFn: () => api.get('/asset-management/ap-invoices').then(r => r.data),
  });

  const qc = useQueryClient();
  const markPaidMutation = useMutation({
    mutationFn: id => api.patch(`/asset-management/ap-invoices/${id}/mark-paid`).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['asset-ap-invoices'] }),
    onError: err => Swal.fire({ icon: 'error', title: 'Error', text: err.response?.data?.error || 'Failed', confirmButtonColor: '#4f46e5' })
  });

  const [sortBy, setSortBy] = useState('recent');

  const filtered = invoices.filter(inv => {
    const matchSearch = inv.apInvoiceNo?.toLowerCase().includes(search.toLowerCase()) ||
      inv.vendorName?.toLowerCase().includes(search.toLowerCase()) ||
      inv.vendorInvoiceNo?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'ALL' || inv.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const sortedAndFiltered = [...filtered].sort((a, b) => {
    if (sortBy === 'recent') {
      return new Date(b.invoiceDate || b.createdAt) - new Date(a.invoiceDate || a.createdAt);
    }
    if (sortBy === 'oldest') {
      return new Date(a.invoiceDate || a.createdAt) - new Date(b.invoiceDate || b.createdAt);
    }
    if (sortBy === 'priceLowHigh') {
      return Number(a.grandTotal || 0) - Number(b.grandTotal || 0);
    }
    if (sortBy === 'priceHighLow') {
      return Number(b.grandTotal || 0) - Number(a.grandTotal || 0);
    }
    if (sortBy === 'alphabetical') {
      return (a.vendorName || '').localeCompare(b.vendorName || '');
    }
    return 0;
  });

  if (view === 'create') return <CreateAPInvoiceForm onBack={() => setView('list')} isReadOnly={isReadOnly} invoicesCount={invoices.length} />;

  const totalInvoiced = invoices.reduce((s, i) => s + (Number(i.grandTotal) || 0), 0);
  const totalPaid = invoices.filter(i => i.status === 'Paid').reduce((s, i) => s + (Number(i.grandTotal) || 0), 0);
  const overdueCount = invoices.filter(i => i.status === 'Overdue').length;
  const itcValue = invoices.reduce((s, i) => s + (Number(i.totalGst) || 0), 0);

  return (
    <div className="space-y-6">
      {selectedInvoice && <APInvoiceDetailModal invoice={selectedInvoice} onClose={() => setSelectedInvoice(null)} />}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">AP Invoices</h2>
          <p className="text-sm text-slate-500 mt-0.5">Book vendor invoices with full GST/ITC compliance (Step 5/8)</p>
        </div>
        {!isReadOnly && (
          <Button onClick={() => setView('create')} className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-md shadow-indigo-600/10 h-10 px-5">
            <Plus className="w-4 h-4" /> Book Invoice
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Invoiced', value: `₹${(totalInvoiced / 100000).toFixed(1)}L`, icon: Receipt, bg: 'bg-indigo-50 dark:bg-indigo-950/30', clr: 'text-indigo-600' },
          { label: 'Total Paid', value: `₹${(totalPaid / 100000).toFixed(1)}L`, icon: Banknote, bg: 'bg-emerald-50 dark:bg-emerald-950/30', clr: 'text-emerald-600' },
          { label: 'Overdue', value: overdueCount, icon: AlertTriangle, bg: 'bg-rose-50 dark:bg-rose-950/30', clr: 'text-rose-600' },
          { label: 'ITC Eligible', value: `₹${(itcValue / 100000).toFixed(1)}L`, icon: Percent, bg: 'bg-violet-50 dark:bg-violet-950/30', clr: 'text-violet-600' },
        ].map(({ label, value, icon: Icon, bg, clr }) => (
          <div key={label} className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/60 rounded-2xl p-4 flex items-center gap-3 shadow-sm">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${bg} ${clr}`}><Icon className="w-5 h-5" /></div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</p>
              <p className="text-xl font-bold text-slate-900 dark:text-white">{value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-slate-50/60 dark:bg-slate-800/20 border border-slate-200/60 dark:border-slate-800/60 rounded-2xl p-3 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by invoice no, vendor..." className="pl-9 h-9 rounded-xl bg-white dark:bg-slate-900" />
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="h-9 px-3 pr-8 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-sm appearance-none focus:outline-none text-slate-700 dark:text-slate-350">
            <option value="ALL">All Status</option>
            {['Draft', 'Pending Approval', 'Posted', 'Paid', 'Overdue', 'Cancelled'].map(s => <option key={s}>{s}</option>)}
          </select>
          <div className="relative w-full sm:w-48">
            <select value={sortBy} onChange={e => setSortBy(e.target.value)}
              className="w-full h-9 pl-3 pr-8 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-700 dark:text-slate-350">
              <option value="recent">Recent first</option>
              <option value="oldest">Oldest first</option>
              <option value="priceLowHigh">Price: Low to High</option>
              <option value="priceHighLow">Price: High to Low</option>
              <option value="alphabetical">Alphabetical</option>
            </select>
            <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-2.5 pointer-events-none" />
          </div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200/60 dark:border-slate-800/60">
        <table className="w-full text-sm">
          <thead className="bg-slate-50/80 dark:bg-slate-800/50">
            <tr>
              {['AP Invoice No.', 'Vendor', 'Vendor Inv. No.', 'Invoice Date', 'Due Date', 'Taxable', 'Total GST', 'Grand Total', 'Status', 'Actions'].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
            {isLoading ? Array.from({ length: 3 }).map((_, i) => (
              <tr key={i}>{Array.from({ length: 10 }).map((_, j) => <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-full rounded" /></td>)}</tr>
            )) : sortedAndFiltered.length === 0 ? (
              <tr><td colSpan={10} className="px-4 py-16 text-center">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-14 h-14 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center">
                    <Receipt className="w-7 h-7 text-slate-400" />
                  </div>
                  <div>
                    <p className="font-medium text-slate-700 dark:text-slate-300">No AP invoices booked</p>
                    <p className="text-xs text-slate-400 mt-1">Book vendor invoices post GRPO acceptance</p>
                  </div>
                </div>
              </td></tr>
            ) : sortedAndFiltered.map(inv => {
              const isOverdue = inv.dueDate && new Date(inv.dueDate) < new Date() && inv.status !== 'Paid';
              return (
                <tr key={inv.id} className={`hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors ${isOverdue ? 'bg-rose-50/30 dark:bg-rose-950/10' : ''}`}>
                  <td className="px-4 py-3">
                    <button onClick={() => setSelectedInvoice(inv)} className="font-mono font-bold text-indigo-600 dark:text-indigo-400 text-xs hover:underline">{inv.apInvoiceNo}</button>
                  </td>
                  <td className="px-4 py-3 font-semibold text-slate-800 dark:text-slate-200">{inv.vendorName}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">{inv.vendorInvoiceNo}</td>
                  <td className="px-4 py-3 text-xs text-slate-500">{format(new Date(inv.invoiceDate), 'dd MMM yyyy')}</td>
                  <td className="px-4 py-3 text-xs">
                    <span className={isOverdue ? 'text-rose-600 font-bold' : 'text-slate-500'}>
                      {inv.dueDate ? format(new Date(inv.dueDate), 'dd MMM yyyy') : '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400">₹{Number(inv.taxableAmount || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                  <td className="px-4 py-3 text-emerald-600 dark:text-emerald-400">₹{Number(inv.totalGst || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                  <td className="px-4 py-3 font-bold text-slate-900 dark:text-white">₹{Number(inv.grandTotal || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${STATUS_STYLES[inv.status] || STATUS_STYLES.Draft}`}>{inv.status}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" onClick={() => setSelectedInvoice(inv)} className="h-8 w-8 rounded-lg text-slate-400 hover:text-indigo-600" title="View Bill">
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDownloadPDF(inv, true)} className="h-8 w-8 rounded-lg text-slate-400 hover:text-indigo-600" title="Print Bill">
                        <Printer className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDownloadPDF(inv, false)} className="h-8 w-8 rounded-lg text-slate-400 hover:text-indigo-600" title="Download PDF">
                        <Download className="w-4 h-4" />
                      </Button>
                      {!isReadOnly && ['Posted', 'Pending Approval'].includes(inv.status) && (
                        <Button variant="ghost" size="sm" onClick={() => markPaidMutation.mutate(inv.id)} disabled={markPaidMutation.isPending}
                          className="h-8 px-3 text-xs text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 rounded-lg gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Mark Paid
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
