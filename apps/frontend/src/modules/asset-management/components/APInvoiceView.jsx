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
  Banknote, Percent, Package, Trash2, Printer, Download, Edit,
  Info, Mail, MessageSquare
} from 'lucide-react';
import Swal from 'sweetalert2';
import { jsPDF } from 'jspdf';
import HsnSelect from '@/components/forms/HsnSelect';
import SearchSelect from '@/components/ui/SearchSelect';
import QuickAddSupplierModal from '@/components/forms/QuickAddSupplierModal';


const GST_RATES = [0, 5, 12, 18, 28];

const CATEGORIES = [
  'IT Equipment', 'Machinery & Plant', 'Furniture & Fixtures',
  'Vehicles', 'Infrastructure', 'Office Equipment', 'Intangible Assets'
];

const UOM_OPTIONS = [
  'Nos', 'Pcs', 'Set', 'Kit', 'Pair', 'Dozen', 'Gross',
  'kg', 'gm', 'mg', 'lb', 'oz', 'ton', 'metric ton', 'quintal',
  'liter', 'ml', 'cl', 'dl', 'gallon', 'quart', 'pint', 'fluid oz',
  'cubic meter', 'cubic ft', 'cubic cm', 'cubic inch',
  'meter', 'cm', 'mm', 'km', 'inch', 'feet', 'yard', 'mile',
  'square meter', 'square ft', 'square cm', 'square inch', 'square yard', 'acre', 'hectare',
  'box', 'carton', 'case', 'pack', 'bag', 'sack', 'pallet', 'tray', 'tube', 'bottle', 'can', 'drum', 'barrel', 'cylinder',
  'roll', 'sheet', 'ream', 'bundle',
  'hour', 'day', 'kWh', 'MJ',
  'unit', 'lot', 'assortment'
];

const PAYMENT_METHODS_MAP = {
  'Bank Transfer': ['NEFT', 'RTGS', 'IMPS'],
  'Cheque': ['Normal Cheque', 'Crossed Cheque'],
  'Demand Draft (DD)': ['Demand Draft'],
  'Online Portal': ['UPI', 'Net Banking']
};



const parsePaymentMode = (storedMode) => {
  const defaultMethod = 'Bank Transfer';
  const defaultType = 'NEFT';
  
  if (!storedMode) return { method: defaultMethod, type: defaultType };
  
  const match = storedMode.match(/^([^(]+)\s*\(([^)]+)\)$/);
  if (match) {
    const methodCandidate = match[1].trim();
    const typeCandidate = match[2].trim();
    
    if (PAYMENT_METHODS_MAP[methodCandidate]) {
      return { method: methodCandidate, type: typeCandidate };
    }
  }
  
  if (storedMode === 'Cheque') {
    return { method: 'Cheque', type: 'Normal Cheque' };
  }
  if (storedMode === 'DD') {
    return { method: 'Demand Draft (DD)', type: 'Demand Draft' };
  }
  if (storedMode === 'Online Portal') {
    return { method: 'Online Portal', type: 'UPI' };
  }
  if (PAYMENT_METHODS_MAP[storedMode]) {
    return { method: storedMode, type: PAYMENT_METHODS_MAP[storedMode][0] };
  }
  
  return { method: defaultMethod, type: defaultType };
};

const DEFAULT_INVOICE_TERMS = `General Terms and Conditions (GTC)
1. Acceptance of Order: The vendor must confirm acceptance of the Purchase Order (PO) in writing via email or signed acknowledgment within 03 working days from the date of issue, If no written confirmation is received within this window, the Buyer reserves the right to cancel the order without any financial liability.
2. Price and Taxes: Prices stated in this PO are firm, fixed, and non-escalating. Prices are inclusive of all packing, forwarding, freight, transit insurance, and handling charges up to the delivery site. All taxes, specifically GST, must be clearly itemized on the invoice in strict accordance with CGST, SGST, and IGST rules. Any future tax benefits or Input Tax Credit (ITC) changes must be passed on to the Buyer.
3. Warranty: The Vendor warrants that all supplied goods are brand new, genuine, and free from defects in material and workmanship for 12 months from the date of acceptance. For services, the Vendor guarantees performance by qualified personnel matching industry standards. Any defective goods or substandard services identified within this period must be replaced, repaired, or re-performed by the Vendor within 7 business days at no additional cost to the Buyer.
4. Billing Instructions: Invoices must be raised as statutory Tax Invoices clearly bearing the Vendor’s valid GSTIN, correct HSN/SAC codes, and the exact Buyer PO number. Delayed submission of invoices or failure to upload invoice data to the GST portal (preventing the Buyer from claiming Input Tax Credit) will directly result in a corresponding delay in payment processing.
5. Payment Terms: Payment shall be processed via electronic transfer (NEFT/RTGS) split across two strict milestones: 50% Advance Payment: Processed within 7 working days upon written confirmation and formal acceptance of the Purchase Order (PO) by the Vendor, against the submission of a valid Proforma Invoice. 50% Final Payment: Processed within 45 days from the date of successful physical delivery of all materials at the designated site. This is subject to the submission of complete, error-free documents (Tax Invoice, Delivery Challan, and validated E-way Bill) and physical inspection and acceptance of the defect-free materials by the Buyer's site team.
6. Delivery & Liquidated Damages (LD): The delivery timeline starts immediately upon the Vendor's receipt of the 50% advance payment and must be completed strictly within 25Days. Failure to deliver on time will result in a penalty of 0.5% of the total PO value per week of delay, capped at 10%. Exceeding this 10% limit gives the Buyer the right to terminate the contract immediately and source elsewhere at the Vendor's expense.
7. Quality & Inspection: All deliverables must strictly match the technical specifications mentioned in the PO. The Buyer reserves the right to inspect materials upon arrival at the site. The Buyer can reject any defective, damaged, or substandard items. Rejected goods must be collected and removed by the Vendor from the Buyer's premises within 7 days of rejection notification at the Vendor's sole risk and expense.
8. Statutory Compliance: The Vendor shall strictly comply with all applicable Central, State, and local government laws, labor regulations (including Provident Fund, ESIC, and Minimum Wages acts), and anti-bribery policies. The use of child labor is strictly prohibited. The Vendor is solely responsible for generating accurate E-way bills for all transit movements.
9. Dispute Resolution: Any dispute arising out of this PO shall first be resolved through amicable mutual discussions. Unresolved disputes shall be referred to a sole arbitrator appointed mutually by both parties, governed by the Indian Arbitration and Conciliation Act, 1996. The venue and seat of arbitration shall be ________, Tamil Nadu, and proceedings will be conducted in English. The courts in Salem shall have exclusive jurisdiction over this contract.`;

const STATUS_STYLES = {
  Draft: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700',
  'Pending Approval': 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400 border-amber-200 dark:border-amber-900/50',
  Posted: 'bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400 border-blue-200 dark:border-blue-900/50',
  Paid: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/50',
  Overdue: 'bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400 border-rose-200 dark:border-rose-900/50',
  Cancelled: 'bg-slate-50 text-slate-500 dark:bg-slate-800/30 dark:text-slate-500 border-slate-200 dark:border-slate-700',
};

const handleDownloadPDF = (invoice, mode = 'download') => {
  const shouldPrint = mode === true || mode === 'print';
  const returnBase64 = mode === 'base64';
  const doc = new jsPDF();
  
  // Calculate totals
  const taxable = invoice.items?.reduce((s, i) => s + Number(i.totalBeforeTax || 0), 0) || 0;
  const isInterState = Boolean(invoice.isInterState);
  const applyGst = invoice.applyGst !== undefined ? Boolean(invoice.applyGst) : true;
  const totalGst = invoice.items?.reduce((s, i) => s + Number(i.gstAmount || i.cgstAmount + i.sgstAmount + i.igstAmount || 0), 0) || 0;
  const cgst = applyGst ? Number(invoice.cgst !== undefined ? invoice.cgst : (isInterState ? 0 : totalGst / 2)) : 0;
  const sgst = applyGst ? Number(invoice.sgst !== undefined ? invoice.sgst : (isInterState ? 0 : totalGst / 2)) : 0;
  const igst = applyGst ? Number(invoice.igst !== undefined ? invoice.igst : (isInterState ? totalGst : 0)) : 0;
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

  // Margins & Dimensions
  const startX = 14;
  const endX = 196;
  const contentWidth = 182;

  // Header band colors: Premium Indigo/Navy (30, 27, 75) & Amber/Gold (245, 158, 11)
  doc.setFillColor(30, 27, 75); // Deep Indigo/Navy
  doc.rect(0, 0, 210, 8, 'F');
  doc.setFillColor(245, 158, 11); // Amber accent
  doc.rect(0, 8, 210, 1.5, 'F');

  // Header Layout
  let currentY = 20;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(30, 27, 75); // Primary color
  doc.text('TAX INVOICE', startX, currentY);

  currentY += 7;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105); // Slate 600
  doc.text('ERP MANUFACTURING SYSTEM', startX, currentY);
  currentY += 4.5;
  doc.text('123 Manufacturing Way, Tech Park', startX, currentY);
  currentY += 4.5;
  doc.text('Bangalore, KA 560001, India', startX, currentY);
  currentY += 4.5;
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 27, 75);
  doc.text('GSTIN: 29AAACE1234F1Z3', startX, currentY);

  // Right: Metadata Box
  const metaBoxX = 110;
  const metaBoxWidth = 86;
  const metaBoxHeight = 36;
  const metaBoxY = 15;

  // Draw a subtle border panel for metadata
  doc.setDrawColor(226, 232, 240); // Slate 200
  doc.setFillColor(248, 250, 252); // Slate 50
  doc.roundedRect(metaBoxX, metaBoxY, metaBoxWidth, metaBoxHeight, 3, 3, 'FD');

  // Helper for dynamic font scaling to prevent overlay/overflow
  const drawTextWithAutoFontSize = (text, x, y, maxWidth, baseSize = 9, isBold = true) => {
    let size = baseSize;
    doc.setFont('helvetica', isBold ? 'bold' : 'normal');
    doc.setFontSize(size);
    while (doc.getTextWidth(String(text)) > maxWidth && size > 5.5) {
      size -= 0.5;
      doc.setFontSize(size);
    }
    doc.text(String(text), x, y);
    doc.setFontSize(baseSize); // restore
  };

  // Metadata Details
  let mY = metaBoxY + 5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139); // Slate 500
  doc.text('INVOICE NO.', metaBoxX + 4, mY);
  doc.setTextColor(30, 27, 75);
  drawTextWithAutoFontSize(invoice.vendorInvoiceNo || 'N/A', metaBoxX + 4, mY + 4, 36, 9, true);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('AP INVOICE NO.', metaBoxX + 44, mY);
  doc.setTextColor(30, 27, 75);
  drawTextWithAutoFontSize(invoice.apInvoiceNo || 'N/A', metaBoxX + 44, mY + 4, 38, 9, true);

  mY += 10;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('DATE', metaBoxX + 4, mY);
  doc.setTextColor(15, 23, 42); // Slate 900
  const dateVal = invoice.invoiceDate ? format(new Date(invoice.invoiceDate), 'dd/MM/yyyy') : 'N/A';
  drawTextWithAutoFontSize(dateVal, metaBoxX + 4, mY + 4, 36, 7.5, false);

  doc.setTextColor(100, 116, 139);
  doc.text('DUE DATE', metaBoxX + 44, mY);
  const isOverdue = invoice.dueDate && new Date(invoice.dueDate) < new Date() && invoice.status !== 'Paid';
  if (isOverdue) {
    doc.setTextColor(220, 38, 38); // Overdue red
  } else {
    doc.setTextColor(15, 23, 42);
  }
  const dueDateVal = invoice.dueDate ? format(new Date(invoice.dueDate), 'dd/MM/yyyy') : '—';
  drawTextWithAutoFontSize(dueDateVal, metaBoxX + 44, mY + 4, 38, 7.5, isOverdue);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);

  mY += 10;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('PAYMENT MODE', metaBoxX + 4, mY);
  doc.setTextColor(15, 23, 42);
  const paymentModeVal = invoice.paymentMode ? (invoice.paymentMode.length > 25 ? invoice.paymentMode.substring(0, 25) + '...' : invoice.paymentMode) : 'N/A';
  drawTextWithAutoFontSize(paymentModeVal, metaBoxX + 4, mY + 4, 36, 7.5, false);

  doc.setTextColor(100, 116, 139);
  doc.text('PO REF', metaBoxX + 44, mY);
  doc.setTextColor(15, 23, 42);
  const poRefVal = invoice.poNo || '—';
  drawTextWithAutoFontSize(poRefVal, metaBoxX + 44, mY + 4, 38, 7.5, false);

  currentY = Math.max(currentY + 6, metaBoxY + metaBoxHeight + 4);
  
  // Divider
  doc.setDrawColor(226, 232, 240); // Slate 200
  doc.line(startX, currentY, endX, currentY);

  // Supplier & Buyer Details
  currentY += 6;
  
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(79, 70, 229); // Accent Indigo
  doc.text('BILL FROM (SUPPLIER)', startX, currentY);
  
  // Vertical accent line
  doc.setDrawColor(79, 70, 229);
  doc.setLineWidth(1);
  doc.line(startX, currentY + 2, startX, currentY + 22);
  doc.setLineWidth(0.2); // Restore

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text(invoice.vendorName || 'N/A', startX + 3, currentY + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  const vendorAddressLines = doc.splitTextToSize(invoice.address || 'N/A', 80);
  doc.text(vendorAddressLines, startX + 3, currentY + 10.5);

  const vendorAddrHeight = vendorAddressLines.length * 4;
  let gstinPanY = currentY + 11 + vendorAddrHeight;
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 27, 75);
  doc.text(`GSTIN: ${invoice.vendorGstin || 'N/A'}`, startX + 3, gstinPanY);
  doc.text(`PAN: ${invoice.vendorPan || '—'}`, startX + 3, gstinPanY + 4);

  // Right column (Buyer details)
  const buyerX = 110;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(79, 70, 229); // Accent Indigo
  doc.text('BILL TO (BUYER)', buyerX, currentY);

  // Vertical accent line
  doc.setDrawColor(79, 70, 229);
  doc.setLineWidth(1);
  doc.line(buyerX, currentY + 2, buyerX, currentY + 22);
  doc.setLineWidth(0.2); // Restore

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text('ERP MANUFACTURING SYSTEM', buyerX + 3, currentY + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text('Asset Procurement Department', buyerX + 3, currentY + 10.5);
  doc.text('123 Manufacturing Way, Tech Park', buyerX + 3, currentY + 14.5);
  doc.text('Bangalore, KA 560001, India', buyerX + 3, currentY + 18.5);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 27, 75);
  doc.text('GSTIN: 29AAACE1234F1Z3', buyerX + 3, currentY + 23);
  doc.text(`Place of Supply: ${invoice.placeOfSupply || '29 (Karnataka)'}`, buyerX + 3, currentY + 27);

  currentY = Math.max(gstinPanY + 9, currentY + 32);

  // Divider
  doc.setDrawColor(226, 232, 240);
  doc.line(startX, currentY, endX, currentY);

  // Items Table
  currentY += 6;
  
  // Table Header Background (Indigo 900)
  doc.setFillColor(30, 27, 75);
  doc.rect(startX, currentY - 5, contentWidth, 8, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255); // White text
  doc.text('Description', startX + 2, currentY);
  doc.text('HSN/SAC', startX + 70, currentY);
  doc.text('Qty', startX + 98, currentY, { align: 'right' });
  doc.text('Unit', startX + 112, currentY, { align: 'right' });
  doc.text('Rate', startX + 138, currentY, { align: 'right' });
  doc.text('GST %', startX + 158, currentY, { align: 'right' });
  doc.text('Total (INR)', endX - 2, currentY, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  currentY += 8;

  invoice.items?.forEach((item, index) => {
    const rawDesc = item.itemDescription || '';
    let printableDesc = rawDesc;
    if (rawDesc.includes(' | ')) {
      const parts = rawDesc.split(' | ');
      printableDesc = parts.join('\n');
    }
    const descLines = doc.splitTextToSize(printableDesc, 65);
    const descHeight = descLines.length * 4;
    const rowHeight = Math.max(descHeight, 8);

    // Page overflow check
    if (currentY + rowHeight > 265) {
      doc.addPage();
      doc.setFillColor(30, 27, 75);
      doc.rect(0, 0, 210, 8, 'F');
      doc.setFillColor(245, 158, 11);
      doc.rect(0, 8, 210, 1.5, 'F');
      
      currentY = 22;
      doc.setFillColor(30, 27, 75);
      doc.rect(startX, currentY - 5, contentWidth, 8, 'F');
      
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(255, 255, 255);
      doc.text('Description', startX + 2, currentY);
      doc.text('HSN/SAC', startX + 70, currentY);
      doc.text('Qty', startX + 98, currentY, { align: 'right' });
      doc.text('Unit', startX + 112, currentY, { align: 'right' });
      doc.text('Rate', startX + 138, currentY, { align: 'right' });
      doc.text('GST %', startX + 158, currentY, { align: 'right' });
      doc.text('Total (INR)', endX - 2, currentY, { align: 'right' });
      
      doc.setFont('helvetica', 'normal');
      currentY += 8;
    }

    // Zebra row coloring
    if (index % 2 === 1) {
      doc.setFillColor(248, 250, 252); // Slate 50
      doc.rect(startX, currentY - 5, contentWidth, rowHeight, 'F');
    }

    // Border line at the bottom of the row
    doc.setDrawColor(241, 245, 249); // Slate 100
    doc.line(startX, currentY + rowHeight - 5, endX, currentY + rowHeight - 5);

    doc.setTextColor(15, 23, 42); // Primary dark
    doc.text(descLines, startX + 2, currentY);
    
    doc.setTextColor(71, 85, 105);
    doc.text(item.hsnSac || '—', startX + 70, currentY);
    doc.text(String(item.quantity), startX + 98, currentY, { align: 'right' });
    doc.text(item.unit || 'Nos', startX + 112, currentY, { align: 'right' });
    doc.text(Number(item.unitPrice).toLocaleString('en-IN', { minimumFractionDigits: 2 }), startX + 138, currentY, { align: 'right' });
    doc.text(`${item.gstRate}%`, startX + 158, currentY, { align: 'right' });
    doc.text(Number(item.totalWithGst).toLocaleString('en-IN', { minimumFractionDigits: 2 }), endX - 2, currentY, { align: 'right' });

    currentY += rowHeight;
  });

  doc.setDrawColor(203, 213, 225); // Slate 300
  doc.line(startX, currentY - 2, endX, currentY - 2);
  currentY += 6;

  if (currentY + 54 > 275) {
    doc.addPage();
    doc.setFillColor(30, 27, 75);
    doc.rect(0, 0, 210, 8, 'F');
    doc.setFillColor(245, 158, 11);
    doc.rect(0, 8, 210, 1.5, 'F');
    currentY = 22;
  }

  const calcStartY = currentY;
  
  // Left: Remarks, Bank/Payment Details
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(30, 27, 75);
  doc.text('Remarks / Narration:', startX, currentY);
  
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  const narrationLines = doc.splitTextToSize(invoice.narration || 'No remarks provided.', 100);
  doc.text(narrationLines, startX, currentY + 4);
  
  const remarksHeight = narrationLines.length * 4;
  let bankStartY = currentY + remarksHeight + 6;

  if (bankStartY + 25 > 275) {
    doc.addPage();
    doc.setFillColor(30, 27, 75);
    doc.rect(0, 0, 210, 8, 'F');
    doc.setFillColor(245, 158, 11);
    doc.rect(0, 8, 210, 1.5, 'F');
    currentY = 22;
    bankStartY = currentY;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(30, 27, 75);
  doc.text(`Payment Details (${invoice.paymentMode || 'N/A'}):`, startX, bankStartY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);

  const parsedPayment = parsePaymentMode(invoice.paymentMode);
  const showBank = parsedPayment.method === 'Bank Transfer' || parsedPayment.type === 'Net Banking';
  const showCheque = parsedPayment.method === 'Cheque';
  const showDD = parsedPayment.method === 'Demand Draft (DD)';
  const showUPI = parsedPayment.type === 'UPI';

  let bankHeight = 0;
  if (showBank) {
    doc.text(`Bank Name: ${invoice.bankName || 'N/A'}`, startX, bankStartY + 4);
    doc.text(`A/C Holder: ${invoice.bankAccountHolder || 'N/A'}`, startX, bankStartY + 8);
    doc.text(`A/C No: ${invoice.bankAccountNo || 'N/A'}`, startX, bankStartY + 12);
    doc.text(`IFSC Code: ${invoice.bankIfsc || 'N/A'}`, startX, bankStartY + 16);
    doc.text(`Branch: ${invoice.bankBranch || 'N/A'}`, startX, bankStartY + 20);
    bankHeight = 24;
    if (invoice.bankUpi) {
      doc.text(`UPI ID: ${invoice.bankUpi}`, startX, bankStartY + 24);
      bankHeight += 4;
    }
  } else if (showCheque) {
    doc.text(`Bank Name: ${invoice.bankName || 'N/A'}`, startX, bankStartY + 4);
    doc.text(`Payable To: ${invoice.bankAccountHolder || 'N/A'}`, startX, bankStartY + 8);
    doc.text(`Cheque No: ${invoice.bankAccountNo || 'N/A'}`, startX, bankStartY + 12);
    doc.text(`Cheque Date: ${invoice.bankBranch || 'N/A'}`, startX, bankStartY + 16);
    bankHeight = 20;
  } else if (showDD) {
    doc.text(`Bank Name: ${invoice.bankName || 'N/A'}`, startX, bankStartY + 4);
    doc.text(`Payable To: ${invoice.bankAccountHolder || 'N/A'}`, startX, bankStartY + 8);
    doc.text(`DD No: ${invoice.bankAccountNo || 'N/A'}`, startX, bankStartY + 12);
    doc.text(`DD Date: ${invoice.bankBranch || 'N/A'}`, startX, bankStartY + 16);
    bankHeight = 20;
  } else if (showUPI) {
    doc.text(`UPI ID: ${invoice.bankUpi || 'N/A'}`, startX, bankStartY + 4);
    bankHeight = 8;
  }

  const remarksEndY = bankStartY + bankHeight;

  // Right Side: Summary Calculations Box
  const calcX = 130;
  const valX = endX - 2;
  let summaryY = calcStartY;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);

  const addSummaryRow = (label, value, isBold = false, color = null) => {
    doc.setFont('helvetica', isBold ? 'bold' : 'normal');
    if (color) doc.setTextColor(color[0], color[1], color[2]);
    else doc.setTextColor(isBold ? 15 : 71, isBold ? 23 : 85, isBold ? 42 : 105);
    
    doc.text(label, calcX, summaryY);
    doc.text(value, valX, summaryY, { align: 'right' });
    summaryY += 5;
  };

  addSummaryRow('SUBTOTAL (TAXABLE):', taxable.toLocaleString('en-IN', { minimumFractionDigits: 2 }));

  if (applyGst) {
    if (isInterState) {
      addSummaryRow('IGST (18%):', igst.toLocaleString('en-IN', { minimumFractionDigits: 2 }));
    } else {
      addSummaryRow('CGST (9%):', cgst.toLocaleString('en-IN', { minimumFractionDigits: 2 }));
      addSummaryRow('SGST (9%):', sgst.toLocaleString('en-IN', { minimumFractionDigits: 2 }));
    }
  } else {
    addSummaryRow('GST (EXEMPTED):', '0.00');
  }

  if (freight > 0) addSummaryRow('FREIGHT CHARGES:', freight.toLocaleString('en-IN', { minimumFractionDigits: 2 }));
  if (loadingCharges > 0) addSummaryRow('LOADING CHARGES:', loadingCharges.toLocaleString('en-IN', { minimumFractionDigits: 2 }));
  if (unloadingCharges > 0) addSummaryRow('UNLOADING CHARGES:', unloadingCharges.toLocaleString('en-IN', { minimumFractionDigits: 2 }));
  if (packingCharges > 0) addSummaryRow('PACKING CHARGES:', packingCharges.toLocaleString('en-IN', { minimumFractionDigits: 2 }));
  if (insurance > 0) addSummaryRow('INSURANCE:', insurance.toLocaleString('en-IN', { minimumFractionDigits: 2 }));
  if (otherCharges > 0) addSummaryRow('OTHER CHARGES:', otherCharges.toLocaleString('en-IN', { minimumFractionDigits: 2 }));
  if (discount > 0) addSummaryRow('DISCOUNT:', `-${discount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, true, [220, 38, 38]);

  const formattedRoundOff = (roundOff >= 0 ? '+' : '') + roundOff.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  addSummaryRow('ROUND OFF:', formattedRoundOff);

  summaryY += 1.5;
  doc.setDrawColor(226, 232, 240);
  doc.line(calcX, summaryY - 2, endX, summaryY - 2);

  // Grand Total Row
  summaryY += 2;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(79, 70, 229); // Accent Indigo
  doc.text('GRAND TOTAL (INR):', calcX, summaryY);
  doc.text(`Rs. ${grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, valX, summaryY, { align: 'right' });

  // TDS and Net Payable Details
  let netPayableY = summaryY + 5.5;
  let tdsAmount = invoice.tdsAmount ? Number(invoice.tdsAmount) : 0;
  if (grandTotal > 5000000 && tdsAmount === 0) {
    tdsAmount = (grandTotal - 5000000) * 0.001;
  }
  const netPayable = grandTotal - tdsAmount;

  if (tdsAmount > 0) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text('TDS Deducted (Sec 194Q - 0.1%):', calcX, netPayableY);
    doc.text(`-Rs. ${tdsAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, valX, netPayableY, { align: 'right' });
    netPayableY += 4;
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(6, 95, 70); // Green
    doc.text('NET PAYABLE:', calcX, netPayableY);
    doc.text(`Rs. ${netPayable.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, valX, netPayableY, { align: 'right' });
    netPayableY += 5;
  }

  currentY = Math.max(remarksEndY, netPayableY) + 6;

  // Divider Line before terms
  doc.setDrawColor(226, 232, 240); // Slate 200
  doc.line(startX, currentY, endX, currentY);
  currentY += 6;

  const rawTermsText = invoice.termsAndConditions || invoice.termsBlock || DEFAULT_INVOICE_TERMS;
  const termsLines = rawTermsText.split('\n').map(t => t.trim()).filter(Boolean);

  let headerText = "";
  let numberedTerms = [];
  termsLines.forEach(term => {
    if (/^\d+\./.test(term)) {
      numberedTerms.push(term);
    } else {
      if (!headerText) {
        headerText = term;
      } else {
        headerText += '\n' + term;
      }
    }
  });

  // Split text to sizes
  const headerLines = doc.splitTextToSize(headerText || 'General Terms and Conditions (GTC)', contentWidth - 4);
  
  // Calculate terms height
  const colWidth = contentWidth - 6; // 176
  const termSpacing = 1.6;
  const fontSize = 6.2;
  const lineHeight = 2.5;
  
  // Estimate height of terms to see if it fits
  let termsHeight = 0;
  numberedTerms.forEach((term, index) => {
    const cleanTerm = term.replace(/^\d+\.\s*/, '');
    const textLines = doc.splitTextToSize(`${index + 1}. ${cleanTerm}`, colWidth);
    const h = (textLines.length * lineHeight) + termSpacing;
    termsHeight += h;
  });

  const estimatedTermsHeight = (headerLines.length * 4) + termsHeight + 8;

  // If terms do not fit, add new page
  if (currentY + estimatedTermsHeight > 270) {
    doc.addPage();
    doc.setFillColor(30, 27, 75);
    doc.rect(0, 0, 210, 8, 'F');
    doc.setFillColor(245, 158, 11);
    doc.rect(0, 8, 210, 1.5, 'F');
    currentY = 22;
  }

  // Draw GTC Panel Box
  const panelY = currentY - 2;
  doc.setFillColor(248, 250, 252); // Slate 50 Background
  doc.setDrawColor(226, 232, 240); // Slate 200 Border
  doc.roundedRect(startX, panelY, contentWidth, estimatedTermsHeight, 2, 2, 'FD');

  // Terms & Conditions Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(30, 27, 75); // Navy
  let textY = panelY + 4;
  doc.text(headerLines, startX + 3, textY);

  // Single column for terms
  let colY = textY + (headerLines.length * 3.5) + 1.5;
  const colX = startX + 3;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(fontSize);
  doc.setTextColor(100, 116, 139); // Slate 500

  numberedTerms.forEach((term, index) => {
    const cleanTerm = term.replace(/^\d+\.\s*/, '');
    const termPrefix = `${index + 1}. `;
    const textLines = doc.splitTextToSize(`${termPrefix}${cleanTerm}`, colWidth);
    
    textLines.forEach((line, lineIdx) => {
      doc.text(line, colX, colY + (lineIdx * lineHeight));
    });
    colY += (textLines.length * lineHeight) + termSpacing;
  });

  currentY = panelY + estimatedTermsHeight + 4;

  let sigStartY = currentY + 2;
  
  if (sigStartY + 28 > 275) {
    doc.addPage();
    doc.setFillColor(30, 27, 75);
    doc.rect(0, 0, 210, 8, 'F');
    doc.setFillColor(245, 158, 11);
    doc.rect(0, 8, 210, 1.5, 'F');
    sigStartY = 22;
  }

  // Draw signature boxes
  const sigBoxWidth = 86;
  const sigBoxHeight = 24;

  // Left Signature Box
  doc.setDrawColor(241, 245, 249);
  doc.setFillColor(250, 250, 250);
  doc.roundedRect(startX, sigStartY, sigBoxWidth, sigBoxHeight, 2, 2, 'FD');
  
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(15, 23, 42);
  doc.text(`For ${invoice.vendorName || 'Supplier'}`, startX + 4, sigStartY + 5);

  doc.setDrawColor(203, 213, 225);
  doc.line(startX + 4, sigStartY + 16, startX + sigBoxWidth - 4, sigStartY + 16);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(148, 163, 184);
  doc.text('Authorized Signatory (Sign & Stamp)', startX + 4, sigStartY + 20);

  // Right Signature Box (with elegant seal stamp)
  const sig2X = startX + 96;
  doc.setDrawColor(241, 245, 249);
  doc.setFillColor(250, 250, 250);
  doc.roundedRect(sig2X, sigStartY, sigBoxWidth, sigBoxHeight, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(15, 23, 42);
  doc.text('For ERP MANUFACTURING SYSTEM', sig2X + 4, sigStartY + 5);

  doc.setDrawColor(203, 213, 225);
  doc.line(sig2X + 4, sigStartY + 16, sig2X + sigBoxWidth - 4, sigStartY + 16);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(148, 163, 184);
  doc.text('Authorized Signatory (with Company Seal)', sig2X + 4, sigStartY + 20);

  // Elegant Circular Company Seal stamp representation
  doc.setDrawColor(79, 70, 229, 0.4); // Lavender/indigo translucent look
  doc.setFillColor(245, 243, 255);
  doc.ellipse(sig2X + sigBoxWidth - 14, sigStartY + 10, 11, 6.5, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(5);
  doc.setTextColor(79, 70, 229);
  doc.text('VERIFIED &', sig2X + sigBoxWidth - 14, sigStartY + 9, { align: 'center' });
  doc.text('APPROVED', sig2X + sigBoxWidth - 14, sigStartY + 12, { align: 'center' });

  // Footer on all pages / current page
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184); // Slate 400
  doc.text('For queries regarding this invoice, contact accounts@yourcompany.com. Generated via ERP System.', 105, 286, { align: 'center' });

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
  } else if (returnBase64) {
    const dataUri = doc.output('datauristring');
    return dataUri.split(',')[1];
  } else {
    doc.save(filename);
  }
};

function APInvoiceDetailModal({ invoice, onClose }) {
  const { data: commLogs = [], refetch: refetchLogs, isLoading: isLoadingLogs } = useQuery({
    queryKey: ['communication-logs', 'AP_INVOICE', invoice.invoiceNo],
    queryFn: () => api.get(`/asset-management/communication-logs/AP_INVOICE/${invoice.invoiceNo}`).then(r => r.data),
    enabled: !!invoice.invoiceNo,
  });

  const [isResending, setIsResending] = useState(false);

  const handleResend = async () => {
    setIsResending(true);
    try {
      const pdfBase64 = handleDownloadPDF(invoice, 'base64');
      const res = await api.post('/asset-management/resend-communication', {
        documentType: 'AP_INVOICE',
        documentId: invoice.id,
        pdfBase64
      });
      Swal.fire({
        icon: 'success',
        title: 'Dispatched',
        text: res.data.message || 'Communication resent successfully.',
        confirmButtonColor: '#4f46e5'
      });
      refetchLogs();
    } catch (err) {
      console.error(err);
      Swal.fire({
        icon: 'error',
        title: 'Resend Failed',
        text: err.response?.data?.error || err.message || 'Failed to resend communication.',
        confirmButtonColor: '#ef4444'
      });
    } finally {
      setIsResending(false);
    }
  };

  const taxable = invoice.items?.reduce((s, i) => s + Number(i.totalBeforeTax || 0), 0) || 0;
  const isInterState = Boolean(invoice.isInterState);
  const applyGst = invoice.applyGst !== undefined ? Boolean(invoice.applyGst) : true;
  const totalGst = invoice.items?.reduce((s, i) => s + Number(i.gstAmount || i.cgstAmount + i.sgstAmount + i.igstAmount || 0), 0) || 0;
  const cgst = applyGst ? Number(invoice.cgst !== undefined ? invoice.cgst : (isInterState ? 0 : totalGst / 2)) : 0;
  const sgst = applyGst ? Number(invoice.sgst !== undefined ? invoice.sgst : (isInterState ? 0 : totalGst / 2)) : 0;
  const igst = applyGst ? Number(invoice.igst !== undefined ? invoice.igst : (isInterState ? totalGst : 0)) : 0;
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

  const { data: suppliers = [] } = useQuery({
    queryKey: ['parties-suppliers'],
    queryFn: () => api.get('/parties/suppliers').then(r => r.data),
  });

  const matchingSupplier = suppliers.find(s => s.name?.toLowerCase() === invoice.vendorName?.toLowerCase());
  const supplierPhone = matchingSupplier?.phone || '';

  const handleSendWhatsAppWeb = () => {
    if (!supplierPhone) {
      Swal.fire({
        icon: 'warning',
        title: 'Phone Number Missing',
        text: 'This supplier does not have a registered phone number.',
        confirmButtonColor: '#4f46e5'
      });
      return;
    }
    const cleanPhone = supplierPhone.replace(/[^0-9]/g, '');
    const recipient = cleanPhone.startsWith('91') && cleanPhone.length === 12 ? cleanPhone : (cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone);
    
    const text = `🧾 *A/P Invoice Paid Notification*
    
Our Bill No: ${invoice.apInvoiceNo}
Supplier Invoice #: ${invoice.vendorInvoiceNo}
Invoice Date: ${format(new Date(invoice.invoiceDate), 'dd/MM/yyyy')}
Grand Total: Rs. ${Number(invoice.grandTotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
Status: PAID

Please check the invoice PDF sent to your email.
Regards,
Accounts Department`;
    
    const encodedText = encodeURIComponent(text);
    const url = `https://api.whatsapp.com/send?phone=${recipient}&text=${encodedText}`;
    window.open(url, '_blank');
  };

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
            {invoice.status === 'Paid' && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleSendWhatsAppWeb}
                className="gap-1.5 h-8 rounded-lg text-xs border-emerald-200 dark:border-emerald-900 text-emerald-600 hover:text-emerald-700 bg-emerald-50/50 hover:bg-emerald-50 dark:bg-emerald-950/20"
              >
                <MessageSquare className="w-3.5 h-3.5" /> Send WhatsApp
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              disabled={isResending}
              onClick={handleResend}
              className="gap-1.5 h-8 rounded-lg text-xs border-indigo-200 dark:border-indigo-900 text-indigo-600 hover:text-indigo-700 bg-indigo-50/50 hover:bg-indigo-50 dark:bg-indigo-950/20"
            >
              {isResending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Mail className="w-3.5 h-3.5" />
              )}
              Resend Email
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
                    <td colSpan={9} className="px-3 py-2 text-right font-bold text-slate-500 text-xs">Taxable Value:</td>
                    <td className="px-3 py-2 font-bold text-slate-900 dark:text-white">₹{taxable.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  </tr>
                  {applyGst ? (
                    isInterState ? (
                      <tr>
                        <td colSpan={9} className="px-3 py-2 text-right font-bold text-slate-500 text-xs">IGST:</td>
                        <td className="px-3 py-2 font-bold text-slate-900 dark:text-white">₹{igst.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      </tr>
                    ) : (
                      <>
                        <tr>
                          <td colSpan={9} className="px-3 py-2 text-right font-bold text-slate-500 text-xs">CGST:</td>
                          <td className="px-3 py-2 font-bold text-slate-900 dark:text-white">₹{cgst.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        </tr>
                        <tr>
                          <td colSpan={9} className="px-3 py-2 text-right font-bold text-slate-500 text-xs">SGST:</td>
                          <td className="px-3 py-2 font-bold text-slate-900 dark:text-white">₹{sgst.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        </tr>
                      </>
                    )
                  ) : (
                    <tr>
                      <td colSpan={9} className="px-3 py-2 text-right font-bold text-slate-500 text-xs">GST (Exempted):</td>
                      <td className="px-3 py-2 font-bold text-slate-500 dark:text-slate-400">₹0.00</td>
                    </tr>
                  )}
                  {freight > 0 && (
                    <tr>
                      <td colSpan={9} className="px-3 py-2 text-right font-bold text-slate-500 text-xs">Freight Charges:</td>
                      <td className="px-3 py-2 font-bold text-slate-900 dark:text-white">₹{freight.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    </tr>
                  )}
                  {loadingCharges > 0 && (
                    <tr>
                      <td colSpan={9} className="px-3 py-2 text-right font-bold text-slate-500 text-xs">Loading Charges:</td>
                      <td className="px-3 py-2 font-bold text-slate-900 dark:text-white">₹{loadingCharges.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    </tr>
                  )}
                  {unloadingCharges > 0 && (
                    <tr>
                      <td colSpan={9} className="px-3 py-2 text-right font-bold text-slate-500 text-xs">Unloading Charges:</td>
                      <td className="px-3 py-2 font-bold text-slate-900 dark:text-white">₹{unloadingCharges.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    </tr>
                  )}
                  {packingCharges > 0 && (
                    <tr>
                      <td colSpan={9} className="px-3 py-2 text-right font-bold text-slate-500 text-xs">Packing Charges:</td>
                      <td className="px-3 py-2 font-bold text-slate-900 dark:text-white">₹{packingCharges.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    </tr>
                  )}
                  {insurance > 0 && (
                    <tr>
                      <td colSpan={9} className="px-3 py-2 text-right font-bold text-slate-500 text-xs">Insurance:</td>
                      <td className="px-3 py-2 font-bold text-slate-900 dark:text-white">₹{insurance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    </tr>
                  )}
                  {otherCharges > 0 && (
                    <tr>
                      <td colSpan={9} className="px-3 py-2 text-right font-bold text-slate-500 text-xs">Other Charges:</td>
                      <td className="px-3 py-2 font-bold text-slate-900 dark:text-white">₹{otherCharges.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    </tr>
                  )}
                  {discount > 0 && (
                    <tr>
                      <td colSpan={9} className="px-3 py-2 text-right font-bold text-rose-500 text-xs">Discount:</td>
                      <td className="px-3 py-2 font-bold text-rose-600">-₹{discount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    </tr>
                  )}
                  {roundOff !== 0 && (
                    <tr>
                      <td colSpan={9} className="px-3 py-2 text-right font-bold text-slate-500 text-xs">Round Off:</td>
                      <td className="px-3 py-2 font-bold text-slate-900 dark:text-white">{(roundOff >= 0 ? '+' : '')}₹{roundOff.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    </tr>
                  )}
                  <tr className="border-t-2 border-slate-300 dark:border-slate-600 bg-indigo-50/50 dark:bg-indigo-950/20">
                    <td colSpan={9} className="px-3 py-3.5 text-right text-xs font-black text-slate-600 dark:text-slate-300 uppercase tracking-wider">Invoice Grand Total:</td>
                    <td className="px-3 py-3.5 font-black text-xl text-indigo-600 dark:text-indigo-400">₹{grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
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

          {/* Remarks, Bank Details & Terms */}
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {invoice.narration && (
                <div className="bg-slate-50/50 dark:bg-slate-800/20 border border-slate-200/60 dark:border-slate-800 rounded-2xl p-4 flex flex-col justify-center shadow-sm">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Remarks / Narration</p>
                  <p className="text-xs text-slate-700 dark:text-slate-300 font-medium italic">"{invoice.narration}"</p>
                </div>
              )}
              <div className="bg-slate-50/50 dark:bg-slate-800/20 border border-slate-200/60 dark:border-slate-800 rounded-2xl p-4 md:col-span-1 shadow-sm">
                <p className="text-xs font-bold text-indigo-650 dark:text-indigo-400 uppercase tracking-wider mb-2">Payment Details ({invoice.paymentMode || 'N/A'})</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                  {(() => {
                    const parsed = parsePaymentMode(invoice.paymentMode);
                    const showBank = parsed.method === 'Bank Transfer' || parsed.type === 'Net Banking';
                    const showCheque = parsed.method === 'Cheque';
                    const showDD = parsed.method === 'Demand Draft (DD)';
                    const showUPI = parsed.type === 'UPI';

                    if (showBank) {
                      return (
                        <>
                          <div>
                            <span className="text-slate-400 text-[10px]">Bank Name</span>
                            <p className="font-semibold text-slate-700 dark:text-slate-200">{invoice.bankName || 'N/A'}</p>
                          </div>
                          <div>
                            <span className="text-slate-400 text-[10px]">Account Holder</span>
                            <p className="font-semibold text-slate-700 dark:text-slate-200 truncate">{invoice.bankAccountHolder || 'N/A'}</p>
                          </div>
                          <div>
                            <span className="text-slate-400 text-[10px]">Account Number</span>
                            <p className="font-semibold text-slate-700 dark:text-slate-200 font-mono">{invoice.bankAccountNo || 'N/A'}</p>
                          </div>
                          <div>
                            <span className="text-slate-400 text-[10px]">IFSC Code</span>
                            <p className="font-semibold text-slate-700 dark:text-slate-200 font-mono uppercase">{invoice.bankIfsc || 'N/A'}</p>
                          </div>
                          <div className="col-span-2 mt-1.5 border-t border-slate-200/40 dark:border-slate-800/60 pt-1.5 flex justify-between gap-2">
                            <div>
                              <span className="text-slate-400 text-[10px]">Branch: </span>
                              <span className="font-semibold text-slate-750 dark:text-slate-300">{invoice.bankBranch || 'N/A'}</span>
                            </div>
                            {invoice.bankUpi && (
                              <div>
                                <span className="text-slate-400 text-[10px]">UPI ID: </span>
                                <span className="font-semibold text-slate-750 dark:text-slate-300 font-mono">{invoice.bankUpi}</span>
                              </div>
                            )}
                          </div>
                        </>
                      );
                    } else if (showCheque) {
                      return (
                        <>
                          <div>
                            <span className="text-slate-400 text-[10px]">Bank Name</span>
                            <p className="font-semibold text-slate-700 dark:text-slate-200">{invoice.bankName || 'N/A'}</p>
                          </div>
                          <div>
                            <span className="text-slate-400 text-[10px]">Account Holder</span>
                            <p className="font-semibold text-slate-700 dark:text-slate-200 truncate">{invoice.bankAccountHolder || 'N/A'}</p>
                          </div>
                          <div>
                            <span className="text-slate-400 text-[10px]">Cheque Number</span>
                            <p className="font-semibold text-slate-700 dark:text-slate-200 font-mono">{invoice.bankAccountNo || 'N/A'}</p>
                          </div>
                          <div>
                            <span className="text-slate-400 text-[10px]">Cheque Date</span>
                            <p className="font-semibold text-slate-700 dark:text-slate-200">{invoice.bankBranch || 'N/A'}</p>
                          </div>
                        </>
                      );
                    } else if (showDD) {
                      return (
                        <>
                          <div>
                            <span className="text-slate-400 text-[10px]">Bank Name (Issuing Bank)</span>
                            <p className="font-semibold text-slate-700 dark:text-slate-200">{invoice.bankName || 'N/A'}</p>
                          </div>
                          <div>
                            <span className="text-slate-400 text-[10px]">Account Holder</span>
                            <p className="font-semibold text-slate-700 dark:text-slate-200 truncate">{invoice.bankAccountHolder || 'N/A'}</p>
                          </div>
                          <div>
                            <span className="text-slate-400 text-[10px]">DD Number</span>
                            <p className="font-semibold text-slate-700 dark:text-slate-200 font-mono">{invoice.bankAccountNo || 'N/A'}</p>
                          </div>
                          <div>
                            <span className="text-slate-400 text-[10px]">DD Date</span>
                            <p className="font-semibold text-slate-700 dark:text-slate-200">{invoice.bankBranch || 'N/A'}</p>
                          </div>
                        </>
                      );
                    } else if (showUPI) {
                      return (
                        <div className="col-span-2">
                          <span className="text-slate-400 text-[10px]">UPI ID</span>
                          <p className="font-semibold text-slate-700 dark:text-slate-200 font-mono">{invoice.bankUpi || 'N/A'}</p>
                        </div>
                      );
                    }
                    return null;
                  })()}
                </div>
              </div>
            </div>

            <div className="border border-slate-200/60 dark:border-slate-800 rounded-2xl p-5 bg-slate-50/50 dark:bg-slate-900/50 shadow-sm">
              <p className="text-xs font-bold text-indigo-650 dark:text-indigo-400 uppercase tracking-wider mb-3">General Terms & Conditions (GTC)</p>
              {(() => {
                const rawTerms = invoice.termsAndConditions || invoice.termsBlock || DEFAULT_INVOICE_TERMS;
                const termsLines = rawTerms.split('\n').map(t => t.trim()).filter(Boolean);
                
                let header = "";
                let terms = [];
                termsLines.forEach(term => {
                  if (/^\d+\./.test(term)) {
                    terms.push(term);
                  } else {
                    header = term;
                  }
                });

                const parseTerm = (termStr) => {
                  const cleanStr = termStr.replace(/^\d+\.\s*/, '');
                  const colonIdx = cleanStr.indexOf(':');
                  if (colonIdx !== -1) {
                    const title = cleanStr.substring(0, colonIdx).trim();
                    const desc = cleanStr.substring(colonIdx + 1).trim();
                    return { title, desc };
                  }
                  return { title: '', desc: cleanStr };
                };
                
                return (
                  <div className="space-y-3">
                    {header && <p className="font-bold text-[11px] text-slate-700 dark:text-slate-350">{header}</p>}
                    <div className="text-slate-500 dark:text-slate-400 text-[10px] leading-relaxed">
                      <ul className="list-decimal pl-4 space-y-2">
                        {terms.map((term, idx) => {
                          const { title, desc } = parseTerm(term);
                          return (
                            <li key={idx}>
                              {title ? <strong>{title}: </strong> : null}
                              {desc}
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  </div>
                );
              })()}
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
              <div className="absolute right-4 top-3 w-16 h-10 border-2 border-indigo-600/20 rounded-full flex flex-col items-center justify-center text-[8px] font-extrabold text-indigo-600/30 uppercase tracking-wider rotate-12 bg-indigo-50/5 dark:bg-indigo-955/5">
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

          {/* Communication History Logs Panel */}
          <div className="border border-slate-200/60 dark:border-slate-800 rounded-2xl p-5 bg-slate-50/50 dark:bg-slate-900/50 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  Communication History Logs
                </h3>
              </div>
              <Button
                variant="outline"
                size="sm"
                disabled={isResending}
                onClick={handleResend}
                className="gap-1.5 h-8 rounded-lg text-xs border-indigo-200 dark:border-indigo-900 text-indigo-600 hover:text-indigo-700 bg-indigo-50/50 hover:bg-indigo-50 dark:bg-indigo-950/20"
              >
                {isResending ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Resending...
                  </>
                ) : (
                  <>
                    <Plus className="w-3.5 h-3.5" />
                    Resend Communication
                  </>
                )}
              </Button>
            </div>

            {isLoadingLogs ? (
              <div className="space-y-2">
                <Skeleton className="h-10 w-full rounded-xl" />
                <Skeleton className="h-10 w-full rounded-xl" />
              </div>
            ) : commLogs.length === 0 ? (
              <div className="text-center py-6 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-950/40">
                <Info className="w-6 h-6 text-slate-350 mx-auto mb-2" />
                <p className="text-xs text-slate-500 font-medium">No communication logs recorded yet for this invoice.</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                {commLogs.map((log) => {
                  const dateStr = format(new Date(log.createdAt), 'dd MMM yyyy hh:mm a');
                  let statusColor = "bg-slate-100 text-slate-650 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700";
                  if (log.status === 'SENT') {
                    statusColor = "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900/50";
                  } else if (log.status === 'FAILED') {
                    statusColor = "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-955/30 dark:text-rose-455 dark:border-rose-900/50";
                  } else if (log.status === 'SKIPPED') {
                    statusColor = "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-955/30 dark:text-amber-455 dark:border-amber-900/50";
                  }

                  return (
                    <div key={log.id} className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/20 p-3 rounded-xl flex items-start justify-between gap-4 text-xs hover:border-slate-350 dark:hover:border-slate-750 transition-colors">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-slate-800 dark:text-slate-200 uppercase tracking-wider text-[10px]">{log.channel}</span>
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${statusColor}`}>{log.status}</span>
                          <span className="text-[10px] text-slate-400">{dateStr}</span>
                        </div>
                        <p className="text-slate-650 dark:text-slate-400 font-medium">To: <span className="font-semibold text-slate-800 dark:text-slate-300">{log.recipient}</span></p>
                        {log.subject && <p className="text-slate-500 dark:text-slate-400 font-mono text-[10px] truncate max-w-md" title={log.subject}>Sub: {log.subject}</p>}
                        {log.errorMessage && <p className="text-rose-600 dark:text-rose-400 text-[10px] font-medium mt-1">Error: {log.errorMessage}</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const AddSupplierInline = QuickAddSupplierModal;

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

function GRPOSelect({ grpos = [], value, onChange, billedGrpoNos = [] }) {
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
                const isBilled = billedGrpoNos.includes(g.grpoNo);
                return (
                  <li
                    key={g.id}
                    onMouseDown={() => {
                      if (isBilled) {
                        Swal.fire({
                          icon: 'error',
                          title: 'Already Billed',
                          text: `GRPO ${g.grpoNo} has already been billed. Duplicate billing is not allowed.`,
                          confirmButtonColor: '#ef4444'
                        });
                        return;
                      }
                      onChange(g);
                      setOpen(false);
                      setSearch('');
                    }}
                    className={`px-4 py-2.5 mx-1 my-0.5 rounded-lg text-sm flex flex-col justify-start transition-colors ${
                      isBilled
                        ? 'opacity-40 cursor-not-allowed bg-slate-100/45 dark:bg-slate-800/10'
                        : 'cursor-pointer hover:bg-indigo-50 hover:text-indigo-700 dark:hover:bg-indigo-500/10 dark:hover:text-indigo-300'
                    }`}
                  >
                    <div className="flex justify-between w-full">
                      <span className={`font-semibold ${isBilled ? 'text-slate-400 line-through' : 'text-slate-700 dark:text-slate-300 group-hover:text-indigo-700 dark:group-hover:text-indigo-300'}`}>
                        {g.grpoNo}
                      </span>
                      {isBilled ? (
                        <span className="font-bold text-rose-500 bg-rose-50 dark:bg-rose-950/20 px-1.5 py-0.5 rounded text-[10px]">BILLED</span>
                      ) : (
                        <span className="font-bold text-slate-900 dark:text-white group-hover:text-indigo-700 dark:group-hover:text-indigo-300">{count} items</span>
                      )}
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

function ChargeRow({ label, value, gstChecked, onChange, onGstChange }) {
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-center">
        <Label className="text-xs">{label}</Label>
        <div className="flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={gstChecked}
            onChange={(e) => onGstChange(e.target.checked)}
            className="w-3.5 h-3.5 rounded text-indigo-600 border-slate-300"
          />
          <span className="text-[10px] text-slate-500 font-medium">18% GST</span>
        </div>
      </div>
      <Input
        type="number"
        min="0"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="0.00"
        className="h-9 rounded-xl bg-white dark:bg-slate-950 text-sm"
      />
    </div>
  );
}

function CreateAPInvoiceForm({ onBack, isReadOnly, invoicesCount = 0, editInvoiceId }) {
  const [isInterState, setIsInterState] = useState(false);
  const [isInvoiceNoDirty, setIsInvoiceNoDirty] = useState(false);
  
  // GSTIN Live Verification States
  const [gstinVerifyResult, setGstinVerifyResult] = useState(null);
  const [isVerifyingGstin, setIsVerifyingGstin] = useState(false);
  const [gstinWarning, setGstinWarning] = useState('');

  const [form, setForm] = useState({
    isDirect: false,
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
    paymentMethod: 'Bank Transfer',
    paymentType: 'NEFT',
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
    termsAndConditions: DEFAULT_INVOICE_TERMS,
    bankName: 'HDFC Bank',
    bankAccountHolder: 'SAMPACK INDAI CORPORATION',
    bankAccountNo: '50200012345678',
    bankIfsc: 'HDFC0000123',
    bankBranch: 'Main Branch, Mumbai',
    bankUpi: '',
  });

  const [activeRowIdx, setActiveRowIdx] = useState(null);
  const [assetSearch, setAssetSearch] = useState('');
  const [assetSuggestions, setAssetSuggestions] = useState([]);
  const [aiLoading, setAiLoading] = useState(null);
  const [aiSuggestion, setAiSuggestion] = useState(null);
  const selectedAssetsRef = React.useRef({});

  const [chargeGstStates, setChargeGstStates] = useState({
    freight: false,
    loadingCharges: false,
    unloadingCharges: false,
    packingCharges: false,
    insurance: false,
    otherCharges: false,
  });

  const [originalIsInterState, setOriginalIsInterState] = useState(null);
  const [error, setError] = useState('');
  const [showAddSupplier, setShowAddSupplier] = useState(false);
  const qc = useQueryClient();
  const isGrpoLinked = !!form.grpoId;

  const handleIsInterStateChange = (newVal) => {
    setIsInterState(newVal);
    if (originalIsInterState !== null && originalIsInterState !== newVal) {
      Swal.fire({
        icon: 'warning',
        title: 'GST Supply Type Changed',
        text: `You have changed the supply type to ${newVal ? 'Inter-state (IGST)' : 'Intra-state (CGST+SGST)'}, which deviates from the linked Purchase Order (${originalIsInterState ? 'Inter-state/IGST' : 'Intra-state/CGST+SGST'}).`,
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 4500,
        timerProgressBar: true,
        customClass: {
          popup: 'rounded-2xl border border-amber-200 bg-amber-50 dark:bg-amber-955 text-slate-800 dark:text-slate-100',
          title: 'text-sm font-bold text-amber-800 dark:text-amber-300',
          htmlContainer: 'text-xs text-amber-700 dark:text-amber-450'
        }
      });
    }
  };

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

  const { data: invoices = [] } = useQuery({
    queryKey: ['asset-ap-invoices'],
    queryFn: () => api.get('/asset-management/ap-invoices').then(r => r.data),
  });

  const billedGrpoNos = React.useMemo(() => {
    return invoices
      .filter(inv => inv.status !== 'Cancelled' && inv.id !== editInvoiceId)
      .map(inv => inv.grpoNo)
      .filter(Boolean);
  }, [invoices, editInvoiceId]);

  React.useEffect(() => {
    if (editInvoiceId && invoices.length > 0) {
      const found = invoices.find(inv => inv.id === editInvoiceId);
      if (found) {
        const parsedPayment = parsePaymentMode(found.paymentMode);
        setForm({
          isDirect: found.grpoNo === 'Direct' || !found.grpoId,
          grpoId: found.grpoId || '',
          poId: found.poId || '',
          vendorName: found.vendorName || '',
          vendorGstin: found.vendorGstin || '',
          vendorPan: found.vendorPan || '',
          vendorAddress: found.address || found.vendorAddress || '',
          vendorInvoiceNo: found.vendorInvoiceNo || '',
          invoiceDate: found.vendorInvoiceDate ? new Date(found.vendorInvoiceDate) : new Date(),
          dueDate: found.dueDate ? new Date(found.dueDate) : null,
          paymentTerms: found.paymentTerms || 'Net 30',
          paymentMode: found.paymentMode || 'Bank Transfer (NEFT)',
          paymentMethod: parsedPayment.method,
          paymentType: parsedPayment.type,
          glAccount: found.glAccount || '2310001',
          discount: found.discount !== undefined ? String(found.discount) : '',
          freight: found.freight !== undefined ? String(found.freight) : '',
          loadingCharges: found.loadingCharges !== undefined ? String(found.loadingCharges) : '',
          unloadingCharges: found.unloadingCharges !== undefined ? String(found.unloadingCharges) : '',
          packingCharges: found.packingCharges !== undefined ? String(found.packingCharges) : '',
          insurance: found.insurance !== undefined ? String(found.insurance) : '',
          otherCharges: found.otherCharges !== undefined ? String(found.otherCharges) : '',
          applyGst: found.applyGst !== undefined ? Boolean(found.applyGst) : true,
          narration: found.narration || '',
          items: found.items?.map(i => {
            const rawDesc = i.description || i.itemDescription || '';
            let itemDescription = rawDesc;
            let category = 'IT Equipment';
            let specifications = '';

            const parts = rawDesc.split(' | ');
            if (parts.length >= 3) {
              itemDescription = parts[0];
              category = parts[1].replace('Category: ', '');
              specifications = parts[2].replace('Specs: ', '');
            }

            return {
              itemDescription,
              category,
              specifications,
              hsnSac: i.hsnCode || i.hsnSac || '',
              quantity: Number(i.quantity || 0),
              unit: i.uom || i.unit || 'Nos',
              unitPrice: Number(i.unitPrice || 0),
              gstRate: Number(i.gstRate || 18),
            };
          }) || [],
          termsAndConditions: found.termsAndConditions || found.termsBlock || DEFAULT_INVOICE_TERMS,
          bankName: found.bankName || 'HDFC Bank',
          bankAccountHolder: found.bankAccountHolder || found.vendorName || '',
          bankAccountNo: found.bankAccountNo || '50200012345678',
          bankIfsc: found.bankIfsc || 'HDFC0000123',
          bankBranch: found.bankBranch || 'Main Branch, Mumbai',
          bankUpi: found.bankUpi || '',
        });
        setIsInterState(Boolean(found.isInterState));
        if (pos.length > 0) {
          let linkedPO = null;
          if (found.poNo) {
            linkedPO = pos.find(p => p.poNo === found.poNo);
          } else if (found.grpoNo && grpos.length > 0) {
            const grpo = grpos.find(g => g.grpoNo === found.grpoNo);
            if (grpo) {
              linkedPO = pos.find(p => p.poNo === grpo.poNo);
            }
          }
          if (linkedPO) {
            setOriginalIsInterState(Boolean(linkedPO.isInterState));
          }
        }
        if (found.chargeGstStates) {
          const parsed = typeof found.chargeGstStates === 'string'
            ? JSON.parse(found.chargeGstStates)
            : found.chargeGstStates;
          setChargeGstStates({
            freight: parsed.freight || parsed.shippingCharges || false,
            loadingCharges: parsed.loadingCharges || false,
            unloadingCharges: parsed.unloadingCharges || false,
            packingCharges: parsed.packingCharges || false,
            insurance: parsed.insurance || false,
            otherCharges: parsed.otherCharges || false,
          });
        }
      }
    }
  }, [editInvoiceId, invoices, pos, grpos]);

  const handleVerifyGSTIN = async (gstinNumber) => {
    if (!gstinNumber) return;
    setIsVerifyingGstin(true);
    setGstinVerifyResult(null);
    
    const regex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
    if (!regex.test(gstinNumber.trim().toUpperCase())) {
      Swal.fire({
        icon: 'error',
        title: 'Invalid GSTIN Format',
        text: 'GSTIN format is invalid. Standard format: 2-digit State Code + 10-char PAN + 1 Entity Digit + Z + 1 Check Digit.',
        confirmButtonColor: '#4f46e5'
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
          confirmButtonColor: '#4f46e5'
        });
      } else {
        setGstinWarning('');
      }
      setIsVerifyingGstin(false);
      return;
    }

    try {
      await new Promise(resolve => setTimeout(resolve, 800));
      
      const statesMap = {
        '27': 'Maharashtra', '29': 'Karnataka', '33': 'Tamil Nadu', 
        '07': 'Delhi', '09': 'Uttar Pradesh', '19': 'West Bengal'
      };
      const stateCode = cleanGstin.substring(0, 2);
      const stateName = statesMap[stateCode] || 'Other State';
      
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
          confirmButtonColor: '#4f46e5'
        });
      } else {
        setGstinWarning('');
      }
    } catch {
      Swal.fire({
        icon: 'warning',
        title: 'Verification Service Offline',
        text: 'GST verification service unavailable. Please verify manually.',
        confirmButtonColor: '#4f46e5'
      });
    } finally {
      setIsVerifyingGstin(false);
    }
  };

  const handleAssetNameChange = (idx, val) => {
    updateItem(idx, 'itemDescription', val);
    setActiveRowIdx(idx);
    setAssetSearch(val);
    if (selectedAssetsRef.current) {
      selectedAssetsRef.current[idx] = false;
    }
  };

  const handleSelectAsset = (asset, idx) => {
    setForm(prev => {
      const newItems = prev.items.map((item, i) => i === idx ? {
        ...item,
        itemDescription: asset.assetName,
        category: asset.category,
        hsnSac: asset.hsnCode,
        hsnDescription: asset.hsnDescription || '',
        specifications: asset.specifications || item.specifications,
        unitPrice: asset.lastUnitCost ? String(asset.lastUnitCost) : item.unitPrice
      } : item);
      return { ...prev, items: newItems };
    });
    if (selectedAssetsRef.current) {
      selectedAssetsRef.current[idx] = true;
    }
    setActiveRowIdx(null);
    setAssetSearch('');
    setAiSuggestion(null);
  };

  const handleAssetBlur = (idx) => {
    setTimeout(() => {
      setActiveRowIdx(null);
      if (selectedAssetsRef.current && selectedAssetsRef.current[idx]) {
        return;
      }
      const item = form.items[idx];
      const name = item?.itemDescription?.trim();
      if (!name) return;

      api.get(`/asset-management/master/assets?search=${encodeURIComponent(name)}`)
        .then(res => {
          const matches = res.data || [];
          const exactMatch = matches.find(m => m.assetName.toLowerCase() === name.toLowerCase());
          if (!exactMatch) {
            setAiLoading(idx);
            api.get(`/asset-management/master/ai-hsn?name=${encodeURIComponent(name)}`)
              .then(aiRes => {
                if (aiRes.data && aiRes.data.source === 'ai') {
                  setAiSuggestion({
                    rowIdx: idx,
                    hsn: aiRes.data.hsn,
                    description: aiRes.data.description
                  });
                } else if (aiRes.data && aiRes.data.source === 'database') {
                  setForm(prev => {
                    const newItems = prev.items.map((it, i) => i === idx ? {
                      ...it,
                      hsnSac: aiRes.data.hsn,
                      hsnDescription: aiRes.data.description || '',
                      category: aiRes.data.category,
                      specifications: aiRes.data.specifications || it.specifications,
                      unitPrice: aiRes.data.lastUnitCost ? String(aiRes.data.lastUnitCost) : it.unitPrice
                    } : it);
                    return { ...prev, items: newItems };
                  });
                }
              })
              .catch(err => console.error(err))
              .finally(() => setAiLoading(null));
          } else {
            setForm(prev => {
              const newItems = prev.items.map((it, i) => i === idx ? {
                ...it,
                hsnSac: exactMatch.hsnCode,
                hsnDescription: exactMatch.hsnDescription || '',
                category: exactMatch.category
              } : it);
              return { ...prev, items: newItems };
            });
          }
        });
    }, 300);
  };

  const confirmAiHsn = () => {
    if (aiSuggestion) {
      const idx = aiSuggestion.rowIdx;
      updateItem(idx, 'hsnSac', aiSuggestion.hsn);
      updateItem(idx, 'hsnDescription', aiSuggestion.description);
      Swal.fire({
        icon: 'success',
        title: 'HSN Confirmed',
        text: `Applied HSN Code: ${aiSuggestion.hsn}`,
        timer: 1500,
        showConfirmButton: false,
        customClass: { popup: 'rounded-3xl border border-slate-200' }
      });
      setAiSuggestion(null);
    }
  };

  React.useEffect(() => {
    if (activeRowIdx === null) return;
    const query = (assetSearch || '').trim();
    const delayDebounceFn = setTimeout(() => {
      api.get(`/asset-management/master/assets?search=${encodeURIComponent(query)}`)
        .then(res => {
          setAssetSuggestions(res.data || []);
        })
        .catch(err => console.error(err));
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [assetSearch, activeRowIdx]);

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

  const calcChargeGst = (val, key) => chargeGstStates[key] && Number(val) > 0 ? Number(val) * 0.18 : 0;

  const freight = Number(form.freight || 0);
  const loadingCharges = Number(form.loadingCharges || 0);
  const unloadingCharges = Number(form.unloadingCharges || 0);
  const packingCharges = Number(form.packingCharges || 0);
  const insurance = Number(form.insurance || 0);
  const otherCharges = Number(form.otherCharges || 0);
  const discount = Number(form.discount || 0);

  const freightGst = calcChargeGst(freight, 'freight');
  const loadingGst = calcChargeGst(loadingCharges, 'loadingCharges');
  const unloadingGst = calcChargeGst(unloadingCharges, 'unloadingCharges');
  const packingGst = calcChargeGst(packingCharges, 'packingCharges');
  const insuranceGst = calcChargeGst(insurance, 'insurance');
  const otherGst = calcChargeGst(otherCharges, 'otherCharges');

  const totalChargesGst = freightGst + loadingGst + unloadingGst + packingGst + insuranceGst + otherGst;

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

  let finalCgst = totals.cgst;
  let finalSgst = totals.sgst;
  let finalIgst = totals.igst;

  if (form.applyGst) {
    if (isInterState) {
      finalIgst += totalChargesGst;
    } else {
      finalCgst += totalChargesGst / 2;
      finalSgst += totalChargesGst / 2;
    }
  }

  const preRoundTotal = totals.taxable + (form.applyGst ? (finalCgst + finalSgst + finalIgst) : 0) + freight + loadingCharges + unloadingCharges + packingCharges + insurance + otherCharges - discount;
  const grandTotal = Math.round(preRoundTotal);
  const roundOff = grandTotal - preRoundTotal;

  const mutation = useMutation({
    mutationFn: data => {
      if (editInvoiceId) {
        return api.put(`/asset-management/ap-invoices/${editInvoiceId}`, data).then(r => r.data);
      } else {
        return api.post('/asset-management/ap-invoices', data).then(r => r.data);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['asset-ap-invoices'] });
      Swal.fire({
        icon: 'success',
        title: editInvoiceId ? 'AP Invoice Updated!' : 'AP Invoice Booked!',
        text: editInvoiceId ? 'Invoice details updated successfully.' : 'Invoice posted to accounts payable.',
        confirmButtonColor: '#4f46e5'
      }).then(() => onBack());
    },
    onError: err => setError(err.response?.data?.error || `Failed to ${editInvoiceId ? 'update' : 'book'} invoice`),
  });

  const handleSubmit = e => {
    e.preventDefault();
    setError('');
    if (!form.isDirect && !form.grpoId) { setError('Please link this AP Invoice to an accepted GRPO'); return; }
    if (!form.invoiceDate) { setError('Invoice date is required'); return; }
    if (!form.vendorInvoiceNo) { setError('Vendor invoice number is required'); return; }
    if (!form.vendorName) { setError('Vendor name is required'); return; }
    if (form.items.length === 0) {
      setError(form.isDirect ? 'Please add at least one item' : 'No items found. Please select a reference GRPO to import items.');
      return;
    }
    if (form.isDirect) {
      if (form.items.some(i => !i.itemDescription || !i.unitPrice || !i.hsnSac || !i.category || !i.unit || !i.specifications)) {
        setError('All item fields (Asset Name, Category, HSN, UOM, Qty, Est. Unit and Specifications) are required');
        return;
      }
    } else {
      if (form.items.some(i => !i.itemDescription || !i.unitPrice)) {
        setError('All item fields are required');
        return;
      }
    }
    
    // Prepare payment fields based on paymentMethod and paymentType
    let bankDetails = {
      bankName: form.bankName,
      bankAccountHolder: form.bankAccountHolder,
      bankAccountNo: form.bankAccountNo,
      bankIfsc: form.bankIfsc,
      bankBranch: form.bankBranch,
      bankUpi: form.bankUpi || '',
    };

    const method = form.paymentMethod;
    const type = form.paymentType;
    const paymentMode = `${method} (${type})`;

    if (method === 'Bank Transfer' || (method === 'Online Portal' && type === 'Net Banking')) {
      bankDetails.bankUpi = form.bankUpi || '';
    } else if (method === 'Cheque' || method === 'Demand Draft (DD)') {
      bankDetails.bankIfsc = 'N/A';
      bankDetails.bankUpi = '';
    } else if (method === 'Online Portal' && type === 'UPI') {
      bankDetails.bankName = 'Online Portal';
      bankDetails.bankAccountHolder = 'N/A';
      bankDetails.bankAccountNo = 'N/A';
      bankDetails.bankIfsc = 'N/A';
      bankDetails.bankBranch = 'N/A';
      bankDetails.bankUpi = form.bankUpi || '';
    }

    mutation.mutate({
      ...form,
      ...bankDetails,
      paymentMode,
      isInterState,
      discount: Number(form.discount || 0),
      freight: Number(form.freight || 0),
      loadingCharges: Number(form.loadingCharges || 0),
      unloadingCharges: Number(form.unloadingCharges || 0),
      packingCharges: Number(form.packingCharges || 0),
      insurance: Number(form.insurance || 0),
      otherCharges: Number(form.otherCharges || 0),
      applyGst: Boolean(form.applyGst),
      chargeGstStates,
      items: form.items.map(i => {
        const calculated = calcItem(i);
        const itemDescription = form.isDirect
          ? `${i.itemDescription} | Category: ${i.category} | Specs: ${i.specifications || ''}`
          : i.itemDescription;
        return {
          ...i,
          ...calculated,
          itemDescription
        };
      }),
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

  const handlePaymentMethodChange = (newMethod) => {
    const newType = PAYMENT_METHODS_MAP[newMethod][0];
    setForm(prev => {
      let defaults = {};
      if (newMethod === 'Bank Transfer') {
        defaults = {
          bankName: (prev.bankName === 'Online Portal' || prev.bankName === 'N/A') ? 'HDFC Bank' : prev.bankName,
          bankAccountHolder: (prev.bankAccountHolder === 'N/A' || !prev.bankAccountHolder) ? 'SAMPACK INDAI CORPORATION' : prev.bankAccountHolder,
          bankAccountNo: (prev.bankAccountNo === 'N/A' || !prev.bankAccountNo) ? '50200012345678' : prev.bankAccountNo,
          bankIfsc: (prev.bankIfsc === 'N/A' || !prev.bankIfsc) ? 'HDFC0000123' : prev.bankIfsc,
          bankBranch: (prev.bankBranch === 'N/A' || /^\d{4}-\d{2}-\d{2}$/.test(prev.bankBranch)) ? 'Main Branch, Mumbai' : prev.bankBranch,
        };
      } else if (newMethod === 'Cheque' || newMethod === 'Demand Draft (DD)') {
        defaults = {
          bankName: (prev.bankName === 'Online Portal' || prev.bankName === 'N/A') ? 'HDFC Bank' : prev.bankName,
          bankAccountHolder: (prev.bankAccountHolder === 'N/A' || !prev.bankAccountHolder) ? 'SAMPACK INDAI CORPORATION' : prev.bankAccountHolder,
          bankAccountNo: (prev.bankAccountNo === '50200012345678' || prev.bankAccountNo === 'N/A') ? '' : prev.bankAccountNo,
          bankIfsc: 'N/A',
          bankBranch: /^\d{4}-\d{2}-\d{2}$/.test(prev.bankBranch) ? prev.bankBranch : format(new Date(), 'yyyy-MM-dd'),
        };
      } else if (newMethod === 'Online Portal') {
        defaults = {
          bankName: 'Online Portal',
          bankAccountHolder: 'N/A',
          bankAccountNo: 'N/A',
          bankIfsc: 'N/A',
          bankBranch: 'N/A',
          bankUpi: prev.bankUpi || '',
        };
      }
      return {
        ...prev,
        paymentMethod: newMethod,
        paymentType: newType,
        ...defaults
      };
    });
  };

  const handlePaymentTypeChange = (newType) => {
    setForm(prev => {
      let defaults = {};
      if (prev.paymentMethod === 'Online Portal') {
        if (newType === 'UPI') {
          defaults = {
            bankName: 'Online Portal',
            bankAccountHolder: 'N/A',
            bankAccountNo: 'N/A',
            bankIfsc: 'N/A',
            bankBranch: 'N/A',
          };
        } else if (newType === 'Net Banking') {
          defaults = {
            bankName: (prev.bankName === 'Online Portal' || prev.bankName === 'N/A') ? 'HDFC Bank' : prev.bankName,
            bankAccountHolder: (prev.bankAccountHolder === 'N/A' || !prev.bankAccountHolder) ? 'SAMPACK INDAI CORPORATION' : prev.bankAccountHolder,
            bankAccountNo: (prev.bankAccountNo === 'N/A' || !prev.bankAccountNo) ? '50200012345678' : prev.bankAccountNo,
            bankIfsc: (prev.bankIfsc === 'N/A' || !prev.bankIfsc) ? 'HDFC0000123' : prev.bankIfsc,
            bankBranch: (prev.bankBranch === 'N/A' || /^\d{4}-\d{2}-\d{2}$/.test(prev.bankBranch)) ? 'Main Branch, Mumbai' : prev.bankBranch,
          };
        }
      }
      return {
        ...prev,
        paymentType: newType,
        ...defaults
      };
    });
  };

  const updateItem = (idx, f, v) => setForm(p => ({ ...p, items: p.items.map((it, i) => i === idx ? { ...it, [f]: v } : it) }));
  const addItem = () => {
    const newItem = form.isDirect
      ? {
          itemDescription: '',
          category: 'IT Equipment',
          hsnSac: '',
          hsnDescription: '',
          unit: 'Nos',
          quantity: 1,
          unitPrice: '',
          gstRate: 18,
          specifications: ''
        }
      : {
          itemDescription: '',
          hsnSac: '',
          quantity: 1,
          unit: 'Nos',
          unitPrice: '',
          gstRate: 18
        };
    setForm(p => ({ ...p, items: [...p.items, newItem] }));
  };
  const removeItem = idx => setForm(p => ({ ...p, items: p.items.filter((_, i) => i !== idx) }));

  const fillFromGRPO = grpoId => {
    const g = grpos.find(gr => gr.id === grpoId);
    if (!g) return;
    
    if (billedGrpoNos.includes(g.grpoNo)) {
      Swal.fire({
        icon: 'error',
        title: 'Already Billed',
        text: `GRPO ${g.grpoNo} has already been billed. Duplicate billing is not allowed.`,
        confirmButtonColor: '#ef4444'
      });
      return;
    }
    const s = suppliers.find(sup => sup.name.toLowerCase() === g.vendorName.toLowerCase());
    
    const linkedPO = pos.find(p => p.poNo === g.poNo);
    const poGstStates = linkedPO ? (typeof linkedPO.chargeGstStates === 'string' ? JSON.parse(linkedPO.chargeGstStates) : linkedPO.chargeGstStates) : null;
    const parsedPayment = parsePaymentMode(linkedPO?.paymentMode || g.paymentMode);
    
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
      bankAccountHolder: prev.bankAccountHolder || g.vendorName,
      termsAndConditions: (linkedPO?.termsBlock && linkedPO.termsBlock !== 'Standard Terms & Conditions Apply.')
        ? linkedPO.termsBlock
        : (prev.termsAndConditions || DEFAULT_INVOICE_TERMS),
      paymentMode: linkedPO?.paymentMode || g.paymentMode || prev.paymentMode,
      paymentMethod: parsedPayment.method,
      paymentType: parsedPayment.type,
      items: g.items?.filter(i => Number(i.acceptedQuantity) > 0).map(i => {
        const poItem = linkedPO?.items?.find(pi => (pi.itemDescription || pi.description) === (i.itemDescription || i.description));
        return {
          itemDescription: i.itemDescription,
          hsnSac: poItem?.hsnSac || poItem?.hsnCode || '',
          quantity: Number(i.acceptedQuantity), unit: i.unit || 'Nos',
          unitPrice: poItem ? Number(poItem.unitPrice) : (i.unitPrice || ''),
          gstRate: poItem ? Number(poItem.gstRate) : Number(i.gstRate || 18),
        };
      }) || prev.items,
    }));
    
    if (linkedPO) {
      const isInter = Boolean(linkedPO.isInterState);
      setIsInterState(isInter);
      setOriginalIsInterState(isInter);
      if (poGstStates) {
        setChargeGstStates({
          freight: poGstStates.shippingCharges || poGstStates.freight || false,
          loadingCharges: poGstStates.loadingCharges || false,
          unloadingCharges: poGstStates.unloadingCharges || false,
          packingCharges: poGstStates.packingCharges || false,
          insurance: poGstStates.insurance || false,
          otherCharges: poGstStates.otherCharges || false,
        });
      }
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
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            {editInvoiceId ? 'Edit AP Invoice' : 'Book AP Invoice'}
          </h2>
          <p className="text-sm text-slate-500">SAP B1 Asset Procurement — Step 5 of 8 (GST/ITC Compliant)</p>
        </div>
      </div>

      {/* Booking Type Toggle */}
      {!editInvoiceId && (
        <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-xl max-w-md">
          <button
            type="button"
            onClick={() => {
              setForm(prev => ({
                ...prev,
                isDirect: false,
                grpoId: '',
                vendorName: '',
                vendorGstin: '',
                vendorPan: '',
                vendorAddress: '',
                items: []
              }));
              setIsInterState(false);
            }}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
              !form.isDirect
                ? 'bg-white dark:bg-slate-900 shadow-sm text-indigo-600 dark:text-indigo-400 font-bold'
                : 'text-slate-500 hover:text-slate-750 dark:text-slate-400 dark:hover:text-slate-350'
            }`}
          >
            Book by GRPO
          </button>
          <button
            type="button"
            onClick={() => {
              setForm(prev => ({
                ...prev,
                isDirect: true,
                grpoId: '',
                vendorName: '',
                vendorGstin: '',
                vendorPan: '',
                vendorAddress: '',
                items: [
                  {
                    itemDescription: '',
                    category: 'IT Equipment',
                    hsnSac: '',
                    hsnDescription: '',
                    unit: 'Nos',
                    quantity: 1,
                    unitPrice: '',
                    gstRate: 18,
                    specifications: ''
                  }
                ]
              }));
              setIsInterState(false);
            }}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
              form.isDirect
                ? 'bg-white dark:bg-slate-900 shadow-sm text-indigo-600 dark:text-indigo-400 font-bold'
                : 'text-slate-500 hover:text-slate-750 dark:text-slate-400 dark:hover:text-slate-350'
            }`}
          >
            Direct Booking
          </button>
        </div>
      )}

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
        {!form.isDirect && (
          <div className="border border-indigo-200 dark:border-indigo-900/50 bg-indigo-50/40 dark:bg-indigo-950/20 rounded-2xl p-5">
            <h3 className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider mb-3 flex items-center gap-2">
              <FileText className="w-4 h-4" /> Link to GRPO
            </h3>
            <div className="relative max-w-md">
              <GRPOSelect
                disabled={!!editInvoiceId}
                grpos={grpos}
                billedGrpoNos={billedGrpoNos}
                value={grpos.find(g => g.id === form.grpoId) || null}
                onChange={grpo => fillFromGRPO(grpo.id)}
              />
            </div>
          </div>
        )}

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
                disabled={isGrpoLinked || !!editInvoiceId}
                value={suppliers.find(s => s.name === form.vendorName) || null}
                onChange={s => {
                  setForm(prev => ({
                    ...prev,
                    vendorName: s.name,
                    vendorAddress: s.address || '',
                    vendorGstin: s.gstin || '',
                    vendorPan: s.pan || '',
                    bankAccountHolder: prev.bankAccountHolder || s.name
                  }));
                }}
                onAddNew={() => setShowAddSupplier(true)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1">Vendor GSTIN <span className="text-rose-500">*</span></Label>
              <div className="flex gap-2">
                <Input required disabled={isGrpoLinked || !!editInvoiceId} value={form.vendorGstin} onChange={e => update('vendorGstin', e.target.value)} placeholder="22AAAAA0000A1Z5" className="h-10 rounded-xl font-mono flex-1 text-sm bg-white dark:bg-slate-950 disabled:opacity-60 disabled:cursor-not-allowed disabled:bg-slate-100/50 dark:disabled:bg-slate-800/50" />
                <Button
                  type="button"
                  variant="outline"
                  disabled={isVerifyingGstin || !form.vendorGstin || isGrpoLinked || !!editInvoiceId}
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
              <Input disabled={isGrpoLinked || !!editInvoiceId} value={form.vendorPan} onChange={e => update('vendorPan', e.target.value)} placeholder="AAAAA0000A" className="h-10 rounded-xl font-mono disabled:opacity-60 disabled:cursor-not-allowed disabled:bg-slate-100/50 dark:disabled:bg-slate-800/50" />
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
              <Input disabled={isGrpoLinked || !!editInvoiceId} value={form.vendorAddress} onChange={e => update('vendorAddress', e.target.value)} placeholder="Full registered address" className="h-10 rounded-xl disabled:opacity-60 disabled:cursor-not-allowed disabled:bg-slate-100/50 dark:disabled:bg-slate-800/50" />
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

        {/* Payment Settlement Details */}
        <div className="border border-slate-200 dark:border-slate-800 rounded-2xl p-5 bg-slate-50/20 dark:bg-slate-900/10 shadow-sm space-y-4">
          <h3 className="text-xs font-bold text-indigo-650 dark:text-indigo-400 uppercase tracking-wider flex items-center gap-2">
            <Banknote className="w-4 h-4" /> Payment Settlement Details
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label>Payment Method <span className="text-rose-500">*</span></Label>
              <div className="relative">
                <select 
                  value={form.paymentMethod} 
                  onChange={e => handlePaymentMethodChange(e.target.value)}
                  className="w-full h-10 px-3 pr-8 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                >
                  {Object.keys(PAYMENT_METHODS_MAP).map(m => <option key={m}>{m}</option>)}
                </select>
                <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-3 pointer-events-none" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Payment Type <span className="text-rose-500">*</span></Label>
              <div className="relative">
                <select 
                  value={form.paymentType} 
                  onChange={e => handlePaymentTypeChange(e.target.value)}
                  className="w-full h-10 px-3 pr-8 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                >
                  {PAYMENT_METHODS_MAP[form.paymentMethod]?.map(t => <option key={t}>{t}</option>)}
                </select>
                <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-3 pointer-events-none" />
              </div>
            </div>

            <div className="md:col-span-1"></div>

            {/* Bank Transfer or Net Banking fields */}
            {(form.paymentMethod === 'Bank Transfer' || (form.paymentMethod === 'Online Portal' && form.paymentType === 'Net Banking')) && (
              <>
                <div className="space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-200">
                  <Label>Bank Name <span className="text-rose-500">*</span></Label>
                  <Input required value={form.bankName} onChange={e => update('bankName', e.target.value)} placeholder="e.g. HDFC Bank" className="h-10 rounded-xl text-sm bg-white dark:bg-slate-950" />
                </div>
                <div className="space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-200">
                  <Label>Account Holder Name <span className="text-rose-500">*</span></Label>
                  <Input required value={form.bankAccountHolder} onChange={e => update('bankAccountHolder', e.target.value)} placeholder="e.g. Vendor Name" className="h-10 rounded-xl text-sm bg-white dark:bg-slate-950" />
                </div>
                <div className="space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-200">
                  <Label>Account Number <span className="text-rose-500">*</span></Label>
                  <Input required value={form.bankAccountNo} onChange={e => update('bankAccountNo', e.target.value)} placeholder="e.g. 50200012345678" className="h-10 rounded-xl text-sm font-mono bg-white dark:bg-slate-950" />
                </div>
                <div className="space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-200">
                  <Label>IFSC Code <span className="text-rose-500">*</span></Label>
                  <Input required value={form.bankIfsc} onChange={e => update('bankIfsc', e.target.value)} placeholder="e.g. HDFC0000123" className="h-10 rounded-xl text-sm font-mono uppercase bg-white dark:bg-slate-950" />
                </div>
                <div className="space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-200">
                  <Label>Branch Name <span className="text-rose-500">*</span></Label>
                  <Input required value={form.bankBranch} onChange={e => update('bankBranch', e.target.value)} placeholder="e.g. Main Branch, Mumbai" className="h-10 rounded-xl text-sm bg-white dark:bg-slate-950" />
                </div>
              </>
            )}

            {/* Cheque fields */}
            {form.paymentMethod === 'Cheque' && (
              <>
                <div className="space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-200">
                  <Label>Bank Name <span className="text-rose-500">*</span></Label>
                  <Input required value={form.bankName} onChange={e => update('bankName', e.target.value)} placeholder="e.g. HDFC Bank" className="h-10 rounded-xl text-sm bg-white dark:bg-slate-950" />
                </div>
                <div className="space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-200">
                  <Label>Account Holder (Payable to) <span className="text-rose-500">*</span></Label>
                  <Input required value={form.bankAccountHolder} onChange={e => update('bankAccountHolder', e.target.value)} placeholder="e.g. Vendor Name" className="h-10 rounded-xl text-sm bg-white dark:bg-slate-950" />
                </div>
                <div className="space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-200">
                  <Label>Cheque Number <span className="text-rose-500">*</span></Label>
                  <Input required value={form.bankAccountNo} onChange={e => update('bankAccountNo', e.target.value)} placeholder="e.g. 123456" className="h-10 rounded-xl text-sm font-mono bg-white dark:bg-slate-950" />
                </div>
                <div className="space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-200">
                  <Label>Cheque Date <span className="text-rose-500">*</span></Label>
                  <Input required type="date" value={form.bankBranch} onChange={e => update('bankBranch', e.target.value)} className="h-10 rounded-xl text-sm bg-white dark:bg-slate-950" />
                </div>
              </>
            )}

            {/* DD fields */}
            {form.paymentMethod === 'Demand Draft (DD)' && (
              <>
                <div className="space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-200">
                  <Label>Bank Name (Issuing Bank) <span className="text-rose-500">*</span></Label>
                  <Input required value={form.bankName} onChange={e => update('bankName', e.target.value)} placeholder="e.g. HDFC Bank" className="h-10 rounded-xl text-sm bg-white dark:bg-slate-950" />
                </div>
                <div className="space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-200">
                  <Label>Account Holder (Payable to) <span className="text-rose-500">*</span></Label>
                  <Input required value={form.bankAccountHolder} onChange={e => update('bankAccountHolder', e.target.value)} placeholder="e.g. Vendor Name" className="h-10 rounded-xl text-sm bg-white dark:bg-slate-950" />
                </div>
                <div className="space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-200">
                  <Label>DD Number <span className="text-rose-500">*</span></Label>
                  <Input required value={form.bankAccountNo} onChange={e => update('bankAccountNo', e.target.value)} placeholder="e.g. 123456" className="h-10 rounded-xl text-sm font-mono bg-white dark:bg-slate-950" />
                </div>
                <div className="space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-200">
                  <Label>DD Date <span className="text-rose-500">*</span></Label>
                  <Input required type="date" value={form.bankBranch} onChange={e => update('bankBranch', e.target.value)} className="h-10 rounded-xl text-sm bg-white dark:bg-slate-950" />
                </div>
              </>
            )}

            {/* Online Portal fields */}
            {form.paymentMethod === 'Online Portal' && form.paymentType === 'UPI' && (
              <div className="space-y-1.5 md:col-span-2 animate-in fade-in slide-in-from-top-1 duration-200">
                <Label>UPI ID <span className="text-rose-500">*</span></Label>
                <Input required value={form.bankUpi} onChange={e => update('bankUpi', e.target.value)} placeholder="e.g. vendor@upi" className="h-10 rounded-xl text-sm font-mono bg-white dark:bg-slate-950" />
              </div>
            )}
          </div>
        </div>

        {/* Line Items */}
        <div className="border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <Package className="w-4 h-4 text-indigo-500" /> Invoice Line Items
            </h3>
            {!isGrpoLinked && !editInvoiceId && (
              <Button type="button" variant="outline" size="sm" onClick={addItem} className="h-8 rounded-lg text-xs gap-1 border-indigo-200 dark:border-indigo-900 text-indigo-600 hover:bg-indigo-50">
                <Plus className="w-3.5 h-3.5" /> Add Item
              </Button>
            )}
          </div>
          <div className="space-y-5">
            {form.items.map((item, idx) => {
              const { totalWithGst, cgstAmount, sgstAmount, igstAmount } = calcItem(item);
              const totalCost = Number(item.quantity || 0) * Number(item.unitPrice || 0);

              if (form.isDirect) {
                return (
                  <div key={idx} className="bg-slate-50/40 dark:bg-slate-900/40 rounded-2xl p-6 border border-slate-200/80 dark:border-slate-800 space-y-4 relative">
                    {/* Header with Title and Delete action */}
                    <div className="flex items-center justify-between border-b border-slate-200/50 dark:border-slate-800/50 pb-3">
                      <div className="flex items-center gap-2.5">
                        <span className="flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-indigo-600 rounded-full">
                          {idx + 1}
                        </span>
                        <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">Item Details</h4>
                      </div>
                      {!editInvoiceId && form.items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeItem(idx)}
                          className="flex items-center gap-1 text-xs font-medium text-rose-500 hover:text-rose-600 transition-colors p-1 px-2 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-lg"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Remove Item
                        </button>
                      )}
                    </div>

                    {/* Row 1: Asset Name & Category */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1.5 relative">
                        <Label>Asset Name / Title <span className="text-rose-500">*</span></Label>
                        <div className="relative">
                          <Input
                            required
                            disabled={!!editInvoiceId}
                            value={item.itemDescription}
                            onChange={e => handleAssetNameChange(idx, e.target.value)}
                            onBlur={() => handleAssetBlur(idx)}
                            placeholder="Type or select asset name..."
                            className="h-10 rounded-xl bg-white dark:bg-slate-950 pr-8 text-sm"
                          />
                          {aiLoading === idx && (
                            <Loader2 className="w-4 h-4 animate-spin text-indigo-500 absolute right-2.5 top-3" />
                          )}
                        </div>
                        {/* Auto-suggest dropdown */}
                        {activeRowIdx === idx && assetSuggestions.length > 0 && (
                          <div className="absolute z-[160] mt-1.5 w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl overflow-hidden max-h-48 overflow-y-auto">
                            <ul className="p-1">
                              {assetSuggestions.map((asset, sIdx) => (
                                <li
                                  key={sIdx}
                                  onMouseDown={() => handleSelectAsset(asset, idx)}
                                  className="px-3 py-2 rounded-lg text-xs cursor-pointer hover:bg-indigo-55 hover:text-indigo-705 dark:hover:bg-indigo-950/30 dark:hover:text-indigo-300 transition-colors flex justify-between items-center"
                                >
                                  <span className="font-semibold text-slate-700 dark:text-slate-350">{asset.assetName}</span>
                                  <span className="text-[10px] text-slate-400 font-mono bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">{asset.hsnCode}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {/* AI Confirmation Banner */}
                        {aiSuggestion && aiSuggestion.rowIdx === idx && (
                          <div className="absolute z-[170] mt-1.5 w-full bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-205 dark:border-indigo-905 rounded-xl p-3 shadow-xl flex flex-col gap-2 animate-in fade-in slide-in-from-top-1 duration-200">
                            <div className="flex justify-between items-start">
                              <div>
                                <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">AI HSN Lookup Suggestion</span>
                                <p className="text-xs font-bold text-slate-850 dark:text-slate-200 mt-0.5">Apply HSN: <code className="font-mono text-indigo-650 dark:text-indigo-300">{aiSuggestion.hsn}</code>?</p>
                                <p className="text-[10px] text-slate-550 mt-0.5 italic truncate max-w-[280px]" title={aiSuggestion.description}>{aiSuggestion.description}</p>
                              </div>
                              <button type="button" onClick={() => setAiSuggestion(null)} className="text-slate-400 hover:text-slate-600">
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                            <Button type="button" size="sm" onClick={confirmAiHsn} className="h-7 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[10px] font-bold">
                              Confirm & Apply
                            </Button>
                          </div>
                        )}
                      </div>

                      <div className="space-y-1.5">
                        <Label>Asset Category <span className="text-rose-500">*</span></Label>
                        <div className="relative">
                          <select
                            required
                            disabled={!!editInvoiceId}
                            value={item.category}
                            onChange={e => updateItem(idx, 'category', e.target.value)}
                            className="w-full h-10 px-3 pr-8 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-950 text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                          >
                            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                          <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-3 pointer-events-none" />
                        </div>
                      </div>
                    </div>

                    {/* Row 2: HSN/SAC Code & HSN Description */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label>HSN / SAC Code <span className="text-rose-500">*</span></Label>
                        <HsnSelect
                          disabled={!!editInvoiceId}
                          value={item.hsnSac}
                          onChange={val => updateItem(idx, 'hsnSac', val)}
                          onSelect={hsnItem => {
                            updateItem(idx, 'hsnSac', hsnItem.hsn_code);
                            updateItem(idx, 'hsnDescription', hsnItem.description);
                            if (hsnItem.gst_rate) {
                              updateItem(idx, 'gstRate', Number(hsnItem.gst_rate));
                            }
                          }}
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label>HSN Description</Label>
                        <Input
                          disabled
                          value={item.hsnDescription || ''}
                          placeholder="HSN code description"
                          className="h-10 rounded-xl bg-slate-100/50 dark:bg-slate-800/40 text-slate-500 font-normal border-slate-200 dark:border-slate-800 cursor-not-allowed"
                        />
                      </div>
                    </div>

                    {/* Row 3: UOM, Quantity, Est Unit Price, Total Cost */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="space-y-1.5">
                        <Label>Unit of Measure <span className="text-rose-500">*</span></Label>
                        <div className="relative">
                          <select
                            required
                            disabled={!!editInvoiceId}
                            value={item.unit}
                            onChange={e => updateItem(idx, 'unit', e.target.value)}
                            className="w-full h-10 px-3 pr-8 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-950 text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                          >
                            <option value="">Select UOM...</option>
                            {UOM_OPTIONS.map(u => <option key={u} value={u}>{u}</option>)}
                          </select>
                          <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-3 pointer-events-none" />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <Label>Quantity <span className="text-rose-500">*</span></Label>
                        <Input
                          required
                          disabled={!!editInvoiceId}
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={e => updateItem(idx, 'quantity', e.target.value)}
                          className="h-10 rounded-xl bg-white dark:bg-slate-950 text-sm"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label>Est. Unit (₹) <span className="text-rose-500">*</span></Label>
                        <Input
                          required
                          disabled={!!editInvoiceId}
                          type="number"
                          min="0"
                          value={item.unitPrice}
                          onChange={e => updateItem(idx, 'unitPrice', e.target.value)}
                          className="h-10 rounded-xl bg-white dark:bg-slate-950 text-sm"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label>Total Cost</Label>
                        <div className="h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100/50 dark:bg-slate-800/40 text-slate-500 flex items-center text-sm font-semibold select-none">
                          ₹{totalCost.toLocaleString('en-IN')}
                        </div>
                      </div>
                    </div>

                    {/* Row 4: Technical Specifications */}
                    <div className="space-y-1.5 col-span-full">
                      <Label>Technical Specifications <span className="text-rose-500">*</span></Label>
                      <textarea
                        required
                        disabled={!!editInvoiceId}
                        value={item.specifications}
                        onChange={e => updateItem(idx, 'specifications', e.target.value)}
                        placeholder="Detailed technical specifications required for procurement..."
                        rows={3}
                        className="w-full border border-slate-200 dark:border-slate-700 rounded-xl p-3 bg-white dark:bg-slate-950 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 hover:border-indigo-400 transition-all resize-none"
                      />
                    </div>

                    {/* GST Calc and details under item */}
                    <div className="flex flex-wrap items-center justify-between border-t border-dashed border-slate-200 dark:border-slate-800 pt-3 text-xs gap-3">
                      <div className="flex gap-4">
                        <div>
                          <span className="text-slate-400">GST Rate: </span>
                          <span className="font-bold text-slate-700 dark:text-slate-300">{item.gstRate}%</span>
                        </div>
                        <div>
                          <span className="text-slate-400">{isInterState ? 'IGST' : 'CGST+SGST'}: </span>
                          <span className="font-bold text-emerald-600">₹{(isInterState ? igstAmount : cgstAmount + sgstAmount).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                        </div>
                      </div>
                      <div>
                        <span className="text-slate-400">Line Total (incl. GST): </span>
                        <span className="font-bold text-indigo-600 dark:text-indigo-400">₹{totalWithGst.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                      </div>
                    </div>
                  </div>
                );
              }

              return (
                <div key={idx} className="bg-slate-50/60 dark:bg-slate-800/30 rounded-xl p-4 border border-slate-200/60 dark:border-slate-800/60">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="md:col-span-2 space-y-1">
                      <Label className="text-xs">Description <span className="text-rose-500">*</span></Label>
                      <Input
                        disabled={isGrpoLinked || !!editInvoiceId}
                        value={item.itemDescription}
                        onChange={e => updateItem(idx, 'itemDescription', e.target.value)}
                        className="h-9 rounded-lg text-sm disabled:opacity-60 disabled:cursor-not-allowed disabled:bg-slate-100/50 dark:disabled:bg-slate-800/50"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">HSN/SAC</Label>
                      <Input
                        disabled={isGrpoLinked || !!editInvoiceId}
                        value={item.hsnSac}
                        onChange={e => updateItem(idx, 'hsnSac', e.target.value)}
                        className="h-9 rounded-lg text-sm font-mono disabled:opacity-60 disabled:cursor-not-allowed disabled:bg-slate-100/50 dark:disabled:bg-slate-800/50"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Unit</Label>
                      <div className="relative">
                        <select
                          disabled={isGrpoLinked || !!editInvoiceId}
                          value={item.unit}
                          onChange={e => updateItem(idx, 'unit', e.target.value)}
                          className="w-full h-9 px-2 pr-7 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-sm appearance-none focus:outline-none disabled:opacity-60 disabled:cursor-not-allowed disabled:bg-slate-100/50 dark:disabled:bg-slate-800/50"
                        >
                          {['Nos', 'Pcs', 'Set', 'Kg', 'Ltr', 'Mtr', 'Box'].map(u => <option key={u}>{u}</option>)}
                        </select>
                        {!isGrpoLinked && !editInvoiceId && <ChevronDown className="w-3 h-3 text-slate-400 absolute right-2 top-3 pointer-events-none" />}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Quantity</Label>
                      <Input
                        disabled={isGrpoLinked || !!editInvoiceId}
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
                        disabled={isGrpoLinked || !!editInvoiceId}
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
                          disabled={isGrpoLinked || !!editInvoiceId}
                          value={item.gstRate}
                          onChange={e => updateItem(idx, 'gstRate', Number(e.target.value))}
                          className="w-full h-9 px-2 pr-7 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-sm appearance-none focus:outline-none disabled:opacity-60 disabled:cursor-not-allowed disabled:bg-slate-100/50 dark:disabled:bg-slate-800/50"
                        >
                          {GST_RATES.map(r => <option key={r} value={r}>{r}%</option>)}
                        </select>
                        {!isGrpoLinked && !editInvoiceId && <ChevronDown className="w-3 h-3 text-slate-400 absolute right-2 top-3 pointer-events-none" />}
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
                    {!isGrpoLinked && !editInvoiceId && form.items.length > 1 && (
                      <button type="button" onClick={() => removeItem(idx)} className="p-1.5 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
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

              <div className="flex flex-col gap-1.5 border-t border-slate-200/60 dark:border-slate-800/60 pt-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-350">Supply Type</span>
                  <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-850 p-0.5 rounded-lg border border-slate-200/50 dark:border-slate-700/50">
                    <button
                      type="button"
                      onClick={() => handleIsInterStateChange(false)}
                      className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${!isInterState ? 'bg-white dark:bg-slate-900 shadow-sm text-indigo-600 dark:text-indigo-400' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                      Intra-state (CGST+SGST)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleIsInterStateChange(true)}
                      className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${isInterState ? 'bg-white dark:bg-slate-900 shadow-sm text-indigo-600 dark:text-indigo-400' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                      Inter-state (IGST)
                    </button>
                  </div>
                </div>
                {originalIsInterState !== null && originalIsInterState !== isInterState && (
                  <div className="flex items-start gap-2 p-2 bg-amber-50/50 dark:bg-amber-955 border border-amber-200 dark:border-amber-900/50 rounded-xl text-[10px] text-amber-700 dark:text-amber-400 mt-1">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    <span>Supply type deviates from original Order ({originalIsInterState ? 'Inter-state / IGST' : 'Intra-state / CGST+SGST'})</span>
                  </div>
                )}
              </div>
            </div>

            {/* Charges inputs */}
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Discount (₹)</Label>
                  <Input type="number" min="0" value={form.discount} onChange={e => update('discount', e.target.value)} placeholder="0.00" className="h-9 rounded-xl bg-white dark:bg-slate-950" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { label: 'Freight (₹)', key: 'freight' },
                  { label: 'Loading Charges (₹)', key: 'loadingCharges' },
                  { label: 'Unloading Charges (₹)', key: 'unloadingCharges' },
                  { label: 'Packing Charges (₹)', key: 'packingCharges' },
                  { label: 'Insurance (₹)', key: 'insurance' },
                  { label: 'Other Charges (₹)', key: 'otherCharges' },
                ].map(({ label, key }) => (
                  <ChargeRow
                    key={key}
                    label={label}
                    value={form[key]}
                    gstChecked={chargeGstStates[key]}
                    onChange={v => update(key, v)}
                    onGstChange={checked => setChargeGstStates(prev => ({ ...prev, [key]: checked }))}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-indigo-50 to-violet-50 dark:from-indigo-950/30 dark:to-violet-950/30 rounded-2xl p-4 space-y-2 text-sm h-fit">
            {[
              { label: 'Taxable Value', value: totals.taxable },
              ...(form.applyGst ? (
                isInterState ? [
                  { label: 'IGST', value: finalIgst }
                ] : [
                  { label: 'CGST', value: finalCgst },
                  { label: 'SGST', value: finalSgst }
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
              <p className="text-[10px] text-slate-400">
                ITC: ₹{(finalCgst + finalSgst + finalIgst).toLocaleString('en-IN', { maximumFractionDigits: 2 })} (eligible after payment)
              </p>
            )}
          </div>
        </div>

        {/* Terms & Conditions */}
        <div className="border border-slate-200 dark:border-slate-800 rounded-2xl p-5 bg-slate-50/20 dark:bg-slate-900/10 shadow-sm">
          <Label className="text-xs font-bold text-indigo-650 dark:text-indigo-400 uppercase tracking-wider mb-2 block">General Terms & Conditions (GTC)</Label>
          <p className="text-[11px] text-slate-405 mb-3">These terms will be displayed on the final invoice details and printed on the PDF invoice. You can edit the default template below:</p>
          <textarea
            value={form.termsAndConditions}
            onChange={e => update('termsAndConditions', e.target.value)}
            rows={8}
            placeholder="Enter invoice terms and conditions..."
            className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-xs font-mono bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          />
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
          <Button type="submit" disabled={mutation.isPending || isReadOnly} className="rounded-xl px-6 h-11 bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-600/20 gap-2 flex items-center justify-center">
            {mutation.isPending ? <><Loader2 className="w-4 h-4 animate-spin" /> Booking...</> : <><Receipt className="w-4 h-4" /> {editInvoiceId ? 'Save Changes' : 'Book Invoice'}</>}
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
  const [editInvoiceId, setEditInvoiceId] = useState(null);

  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ['asset-ap-invoices'],
    queryFn: () => api.get('/asset-management/ap-invoices').then(r => r.data),
  });

  const qc = useQueryClient();

  const markPaidMutation = useMutation({
    mutationFn: ({ id, pdfBase64 }) => api.patch(`/asset-management/ap-invoices/${id}/mark-paid`, { pdfBase64 }).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['asset-ap-invoices'] }),
    onError: err => Swal.fire({ icon: 'error', title: 'Error', text: err.response?.data?.error || 'Failed', confirmButtonColor: '#4f46e5' })
  });

  const deleteMutation = useMutation({
    mutationFn: id => api.delete(`/asset-management/ap-invoices/${id}`).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['asset-ap-invoices'] });
      Swal.fire({
        icon: 'success',
        title: 'Invoice Deleted',
        text: 'AP Invoice deleted successfully.',
        confirmButtonColor: '#4f46e5'
      });
    },
    onError: err => Swal.fire({
      icon: 'error',
      title: 'Delete Failed',
      text: err.response?.data?.error || 'Failed to delete invoice',
      confirmButtonColor: '#4f46e5'
    })
  });

  const handleDeleteInvoice = (inv) => {
    Swal.fire({
      title: 'Are you sure?',
      text: `Do you want to delete invoice ${inv.apInvoiceNo}?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Yes, delete it!'
    }).then((result) => {
      if (result.isConfirmed) {
        deleteMutation.mutate(inv.id);
      }
    });
  };

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

  if (view === 'create') return <CreateAPInvoiceForm onBack={() => { setView('list'); setEditInvoiceId(null); }} isReadOnly={isReadOnly} invoicesCount={invoices.length} editInvoiceId={editInvoiceId} />;

  const totalInvoiced = invoices.reduce((s, i) => s + (Number(i.grandTotal) || 0), 0);
  const totalPaid = invoices.filter(i => i.status === 'Paid').reduce((s, i) => s + (Number(i.grandTotal) || 0), 0);
  const overdueCount = invoices.filter(i => i.status === 'Overdue').length;
  const itcValue = invoices.reduce((s, i) => s + (Number(i.totalTax || i.totalGst) || 0), 0);

  return (
    <div className="space-y-6">
      {selectedInvoice && <APInvoiceDetailModal invoice={selectedInvoice} onClose={() => setSelectedInvoice(null)} />}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">AP Invoices</h2>
          <p className="text-sm text-slate-500 mt-0.5">Book vendor invoices with full GST/ITC compliance (Step 5/8)</p>
        </div>
        {!isReadOnly && (
          <Button onClick={() => { setEditInvoiceId(null); setView('create'); }} className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-md shadow-indigo-600/10 h-10 px-5">
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
                  <td className="px-4 py-3 text-emerald-600 dark:text-emerald-400">₹{Number(inv.totalCgst + inv.totalSgst + inv.totalIgst || inv.totalGst || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                  <td className="px-4 py-3 font-bold text-slate-900 dark:text-white">₹{Number(inv.grandTotal || inv.invoiceTotal || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
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
                        <Button variant="ghost" size="sm" onClick={() => {
                          const pdfBase64 = handleDownloadPDF(inv, 'base64');
                          markPaidMutation.mutate({ id: inv.id, pdfBase64 });
                        }} disabled={markPaidMutation.isPending}
                          className="h-8 px-3 text-xs text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 rounded-lg gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Mark Paid
                        </Button>
                      )}
                      {!isReadOnly && (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            disabled={inv.status === 'Paid'}
                            onClick={() => { setEditInvoiceId(inv.id); setView('create'); }}
                            className="h-8 w-8 rounded-lg text-slate-400 hover:text-indigo-600 disabled:opacity-40 disabled:cursor-not-allowed"
                            title={inv.status === 'Paid' ? "Paid invoice cannot be edited" : "Edit Invoice"}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            disabled={inv.status === 'Paid'}
                            onClick={() => handleDeleteInvoice(inv)}
                            className="h-8 w-8 rounded-lg text-slate-400 hover:text-rose-600 disabled:opacity-40 disabled:cursor-not-allowed"
                            title={inv.status === 'Paid' ? "Paid invoice cannot be deleted" : "Delete AP Invoice"}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </>
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
