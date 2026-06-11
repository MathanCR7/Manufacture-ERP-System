import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
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
  Plus, Search, ShoppingCart, CheckCircle2, X, Eye,
  ArrowLeft, Loader2, AlertTriangle, ChevronDown, Building2,
  FileText, Calendar, Package, Shield, Truck, Trash2, Printer, Download,
  ClipboardList, Info, Tag
} from 'lucide-react';
import Swal from 'sweetalert2';
import { jsPDF } from 'jspdf';

const GST_RATES = [0, 5, 12, 18, 28];
const PAYMENT_MODES = ['Bank Transfer (NEFT)', 'Bank Transfer (RTGS)', 'Cheque', 'DD', 'Online Portal', 'Letter of Credit', 'Cash/Direct'];

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

const STATUS_STYLES = {
  Draft: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700',
  Approved: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/50',
  Sent: 'bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400 border-blue-200 dark:border-blue-900/50',
  'Partially Received': 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400 border-amber-200 dark:border-amber-900/50',
  Closed: 'bg-violet-50 text-violet-700 dark:bg-violet-950/30 dark:text-violet-400 border-violet-200 dark:border-violet-900/50',
  Cancelled: 'bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400 border-rose-200 dark:border-rose-900/50',
};

const CATEGORY_MAP = {
  'IT Equipment': { hsn: '8471', gst: 18 },
  'Machinery & Plant': { hsn: '8422', gst: 18 },
  'Furniture & Fixtures': { hsn: '9403', gst: 18 },
  'Vehicles': { hsn: '8703', gst: 28 },
  'Infrastructure': { hsn: '7308', gst: 18 },
  'Office Equipment': { hsn: '8472', gst: 18 },
  'Intangible Assets': { hsn: '9973', gst: 18 }
};

// ─── PDF Generator ────────────────────────────────────────────────────────────
const handleDownloadPOPDF = (po, shouldPrint = false) => {
  const doc = new jsPDF();
  const totalTaxable = po.items?.reduce((s, i) => s + Number(i.totalBeforeTax || 0), 0) || 0;
  const totalGst = po.items?.reduce((s, i) => s + Number(i.gstAmount || 0), 0) || 0;
  const isInterState = Boolean(po.isInterState);
  const applyGst = po.applyGst !== undefined ? Boolean(po.applyGst) : true;
  const cgst = isInterState ? 0 : totalGst / 2;
  const sgst = isInterState ? 0 : totalGst / 2;
  const igst = isInterState ? totalGst : 0;
  const freight = Number(po.freight || po.freightCharges || 0);
  const loadingCharges = Number(po.loadingCharges || 0);
  const unloadingCharges = Number(po.unloadingCharges || 0);
  const packingCharges = Number(po.packingCharges || 0);
  const insurance = Number(po.insurance || 0);
  const otherCharges = Number(po.otherCharges || 0);
  const discount = Number(po.discount || 0);
  const preRoundTotal = totalTaxable + (applyGst ? totalGst : 0) + freight + loadingCharges + unloadingCharges + packingCharges + insurance + otherCharges - discount;
  const grandTotal = po.grandTotal ? Number(po.grandTotal) : Math.round(preRoundTotal);
  const roundOff = po.roundOff !== undefined ? Number(po.roundOff) : (grandTotal - preRoundTotal);

  doc.setFillColor(79, 70, 229);
  doc.rect(0, 0, 210, 8, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(30, 41, 59);
  doc.text('PURCHASE ORDER', 14, 25);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text('ERP MANUFACTURING SYSTEM', 14, 32);
  doc.text('123 Manufacturing Way, Tech Park', 14, 37);
  doc.text('Bangalore, KA 560001, India', 14, 42);
  doc.text('GSTIN: 29AAACE1234F1Z3', 14, 47);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(30, 41, 59);
  doc.text('ORDER DETAILS', 140, 25);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text(`PO No: ${po.poNo || 'N/A'}`, 140, 32);
  doc.text(`Date: ${po.poDate ? format(new Date(po.poDate), 'dd/MM/yyyy') : 'N/A'}`, 140, 37);
  doc.text(`Delivery Date: ${po.deliveryDate ? format(new Date(po.deliveryDate), 'dd/MM/yyyy') : '—'}`, 140, 42);
  doc.text(`Payment Mode: ${po.paymentMode || 'N/A'}`, 140, 47);
  doc.setDrawColor(226, 232, 240);
  doc.line(14, 52, 196, 52);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text('VENDOR', 14, 60);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(po.vendorName || 'N/A', 14, 66);
  const addressLines = doc.splitTextToSize(po.vendorAddress || po.address || 'N/A', 80);
  doc.text(addressLines, 14, 71);
  const addressHeight = addressLines.length * 4.5;
  doc.text(`GSTIN: ${po.vendorGstin || 'N/A'}`, 14, 72 + addressHeight);
  doc.text(`PAN: ${po.vendorPan || 'N/A'}`, 14, 77 + addressHeight);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text('BUYER (BILL & SHIP TO)', 110, 60);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text('ERP MANUFACTURING SYSTEM', 110, 66);
  const shipAddressLines = doc.splitTextToSize(po.deliveryAddress || '123 Manufacturing Way, Bangalore KA', 80);
  doc.text(shipAddressLines, 110, 71);
  const shipHeight = shipAddressLines.length * 4.5;
  doc.text('GSTIN: 29AAACE1234F1Z3', 110, 72 + shipHeight);
  doc.text('PAN: AAACE1234F', 110, 77 + shipHeight);
  const startY = Math.max(82 + addressHeight, 82 + shipHeight);
  doc.line(14, startY, 196, startY);
  let currentY = startY + 8;
  doc.setFillColor(79, 70, 229);
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
  po.items?.forEach((item, index) => {
    const descLines = doc.splitTextToSize(item.itemDescription || '', 55);
    const descHeight = descLines.length * 4.5;
    const rowHeight = Math.max(descHeight, 8);
    if (currentY + rowHeight > 265) {
      doc.addPage();
      currentY = 20;
      doc.setFillColor(79, 70, 229);
      doc.rect(0, 0, 210, 8, 'F');
      doc.setFillColor(79, 70, 229);
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
    if (index % 2 === 1) { doc.setFillColor(248, 250, 252); doc.rect(14, currentY - 5, 182, rowHeight, 'F'); }
    doc.setTextColor(30, 41, 59);
    doc.text(descLines, 16, currentY);
    doc.setTextColor(71, 85, 105);
    doc.text(item.hsnSac || '—', 75, currentY);
    doc.text(String(item.quantity), 105, currentY, { align: 'right' });
    doc.text(Number(item.unitPrice).toLocaleString('en-IN', { minimumFractionDigits: 2 }), 125, currentY, { align: 'right' });
    doc.text(`${item.gstRate}%`, 145, currentY, { align: 'right' });
    doc.text(Number(item.totalWithGst).toLocaleString('en-IN', { minimumFractionDigits: 2 }), 194, currentY, { align: 'right' });
    doc.setDrawColor(241, 245, 249);
    doc.line(14, currentY + rowHeight - 5, 196, currentY + rowHeight - 5);
    currentY += rowHeight;
  });
  doc.setDrawColor(203, 213, 225);
  doc.line(14, currentY - 2, 196, currentY - 2);
  currentY += 6;
  if (currentY + 50 > 265) { doc.addPage(); currentY = 20; doc.setFillColor(79, 70, 229); doc.rect(0, 0, 210, 8, 'F'); }
  const calcX = 130;
  const valX = 196;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text('TAXABLE:', calcX, currentY);
  doc.text(totalTaxable.toLocaleString('en-IN', { minimumFractionDigits: 2 }), valX, currentY, { align: 'right' });
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
  }
  if (freight > 0) { doc.text('FREIGHT:', calcX, currentY + offset); doc.text(freight.toLocaleString('en-IN', { minimumFractionDigits: 2 }), valX, currentY + offset, { align: 'right' }); offset += 6; }
  if (loadingCharges > 0) { doc.text('LOADING:', calcX, currentY + offset); doc.text(loadingCharges.toLocaleString('en-IN', { minimumFractionDigits: 2 }), valX, currentY + offset, { align: 'right' }); offset += 6; }
  if (unloadingCharges > 0) { doc.text('UNLOADING:', calcX, currentY + offset); doc.text(unloadingCharges.toLocaleString('en-IN', { minimumFractionDigits: 2 }), valX, currentY + offset, { align: 'right' }); offset += 6; }
  if (packingCharges > 0) { doc.text('PACKING:', calcX, currentY + offset); doc.text(packingCharges.toLocaleString('en-IN', { minimumFractionDigits: 2 }), valX, currentY + offset, { align: 'right' }); offset += 6; }
  if (insurance > 0) { doc.text('INSURANCE:', calcX, currentY + offset); doc.text(insurance.toLocaleString('en-IN', { minimumFractionDigits: 2 }), valX, currentY + offset, { align: 'right' }); offset += 6; }
  if (otherCharges > 0) { doc.text('OTHER CHARGES:', calcX, currentY + offset); doc.text(otherCharges.toLocaleString('en-IN', { minimumFractionDigits: 2 }), valX, currentY + offset, { align: 'right' }); offset += 6; }
  if (discount > 0) { doc.text('DISCOUNT:', calcX, currentY + offset); doc.text(`-${discount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, valX, currentY + offset, { align: 'right' }); offset += 6; }
  doc.text('ROUND OFF:', calcX, currentY + offset);
  doc.text((roundOff >= 0 ? '+' : '') + roundOff.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), valX, currentY + offset, { align: 'right' });
  offset += 4;
  doc.line(calcX, currentY + offset, 196, currentY + offset);
  offset += 6;
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(79, 70, 229);
  doc.text('GRAND TOTAL:', calcX, currentY + offset);
  doc.text(`Rs. ${grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, valX, currentY + offset, { align: 'right' });
  const dateStr = po.poDate ? format(new Date(po.poDate), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd');
  const cleanVendorName = (po.vendorName || 'Vendor').replace(/[^a-zA-Z0-9]/g, '_');
  const filename = `PO-${dateStr}-${po.poNo || 'ORDER'}_${cleanVendorName}.pdf`;
  if (shouldPrint) {
    const pdfUrl = URL.createObjectURL(doc.output('blob'));
    window.open(pdfUrl, '_blank');
  } else {
    doc.save(filename);
  }
};

// ─── PO Detail Modal ──────────────────────────────────────────────────────────
function PODetailModal({ po, onClose }) {
  const totalTaxable = po.items?.reduce((s, i) => s + Number(i.totalBeforeTax || 0), 0) || 0;
  const totalGst = po.items?.reduce((s, i) => s + Number(i.gstAmount || 0), 0) || 0;
  const isInterState = Boolean(po.isInterState);
  const applyGst = po.applyGst !== undefined ? Boolean(po.applyGst) : true;
  const cgst = isInterState ? 0 : totalGst / 2;
  const sgst = isInterState ? 0 : totalGst / 2;
  const igst = isInterState ? totalGst : 0;
  const freight = Number(po.freight || po.freightCharges || 0);
  const loadingCharges = Number(po.loadingCharges || 0);
  const unloadingCharges = Number(po.unloadingCharges || 0);
  const packingCharges = Number(po.packingCharges || 0);
  const insurance = Number(po.insurance || 0);
  const otherCharges = Number(po.otherCharges || 0);
  const discount = Number(po.discount || 0);
  const preRoundTotal = totalTaxable + (applyGst ? totalGst : 0) + freight + loadingCharges + unloadingCharges + packingCharges + insurance + otherCharges - discount;
  const grandTotal = po.grandTotal ? Number(po.grandTotal) : Math.round(preRoundTotal);
  const roundOff = po.roundOff !== undefined ? Number(po.roundOff) : (grandTotal - preRoundTotal);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-slate-900 w-full max-w-4xl rounded-3xl shadow-2xl border border-slate-200/60 dark:border-slate-800 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 px-6 py-4 flex items-center justify-between z-10 rounded-t-3xl">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white font-mono">{po.poNo}</h2>
              <span className={`px-3 py-1 rounded-full text-xs font-bold border ${STATUS_STYLES[po.status] || STATUS_STYLES.Draft}`}>{po.status}</span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">{po.vendorName} • {format(new Date(po.poDate), 'dd MMM yyyy')}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-1.5 h-8 rounded-lg text-xs border-indigo-200 dark:border-indigo-900 text-indigo-600 hover:text-indigo-700 bg-indigo-50/50" onClick={() => handleDownloadPOPDF(po, true)}>
              <Printer className="w-3.5 h-3.5" /> Print
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5 h-8 rounded-lg text-xs border-indigo-200 dark:border-indigo-900 text-indigo-600 hover:text-indigo-700 bg-indigo-50/50" onClick={() => handleDownloadPOPDF(po, false)}>
              <Download className="w-3.5 h-3.5" /> PDF
            </Button>
            <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        <div className="p-6 space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm bg-slate-50/50 dark:bg-slate-800/20 p-4 rounded-2xl border border-slate-100 dark:border-slate-800/60">
            {[
              { label: 'Vendor', value: po.vendorName },
              { label: 'PR Reference', value: po.prNo || '—' },
              { label: 'GSTIN', value: po.vendorGstin || '—' },
              { label: 'PAN', value: po.vendorPan || '—' },
              { label: 'Payment Terms', value: po.paymentTerms },
              { label: 'Payment Mode', value: po.paymentMode || '—' },
              { label: 'Expected Delivery', value: po.deliveryDate ? format(new Date(po.deliveryDate), 'dd MMM yyyy') : '—' },
              { label: 'Delivery Address', value: po.deliveryAddress },
              { label: 'Currency', value: po.currency },
              { label: 'Supply Type', value: isInterState ? 'Inter-state (IGST)' : 'Intra-state (CGST + SGST)' },
              { label: 'GST Applied', value: applyGst ? 'Yes' : 'No' }
            ].map(({ label, value }) => (
              <div key={label} className="space-y-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</p>
                <p className="font-semibold text-slate-800 dark:text-slate-200 text-xs truncate" title={value}>{value}</p>
              </div>
            ))}
          </div>
          {po.items?.length > 0 && (
            <div className="overflow-x-auto rounded-2xl border border-slate-200/80 dark:border-slate-800">
              <table className="w-full text-xs">
                <thead className="bg-indigo-900 dark:bg-indigo-950 text-white">
                  <tr>
                    {['#', 'Description', 'HSN/SAC', 'Qty', 'Unit', 'Rate (₹)', 'GST%', applyGst ? (isInterState ? 'IGST' : 'CGST') : 'CGST', applyGst ? (isInterState ? '—' : 'SGST') : 'SGST', 'Total (₹)'].map(h => (
                      <th key={h} className="px-3 py-3 text-left font-bold uppercase tracking-wider text-[10px] text-indigo-100">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {po.items.map((item, i) => {
                    const gst = applyGst ? Number(item.gstAmount || 0) : 0;
                    return (
                      <tr key={i} className={`transition-colors ${i % 2 === 0 ? 'bg-white dark:bg-slate-900/40' : 'bg-slate-50/40 dark:bg-slate-800/10'} hover:bg-slate-100/50 dark:hover:bg-slate-800/30`}>
                        <td className="px-3 py-3 text-slate-400">{i + 1}</td>
                        <td className="px-3 py-3 font-semibold text-slate-800 dark:text-slate-200">{item.itemDescription}</td>
                        <td className="px-3 py-3 font-mono text-slate-500">{item.hsnSac || '—'}</td>
                        <td className="px-3 py-3 font-medium text-slate-650 dark:text-slate-400">{item.quantity}</td>
                        <td className="px-3 py-3 text-slate-600 dark:text-slate-400">{item.unit || 'Nos'}</td>
                        <td className="px-3 py-3 text-slate-700 dark:text-slate-300">₹{Number(item.unitPrice).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                        <td className="px-3 py-3 text-slate-700 dark:text-slate-300">{item.gstRate}%</td>
                        <td className="px-3 py-3 text-slate-600 dark:text-slate-400">
                          ₹{applyGst ? (isInterState ? gst : gst / 2).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
                        </td>
                        <td className="px-3 py-3 text-slate-600 dark:text-slate-400">
                          {applyGst ? (isInterState ? '—' : `₹${(gst / 2).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`) : '₹0.00'}
                        </td>
                        <td className="px-3 py-3 font-bold text-slate-900 dark:text-white">
                          ₹{(Number(item.totalBeforeTax || (item.quantity * item.unitPrice)) + gst).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-slate-50 dark:bg-slate-800/60 border-t border-slate-200 dark:border-slate-700">
                  <tr><td colSpan={7} className="px-3 py-2 text-right font-bold text-slate-500 text-xs">Taxable Value:</td><td colSpan={2} className="px-3 py-2 font-bold text-slate-900 dark:text-white">₹{totalTaxable.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td></tr>
                  {applyGst ? isInterState ? (
                    <tr><td colSpan={7} className="px-3 py-2 text-right font-bold text-slate-500 text-xs">IGST:</td><td colSpan={2} className="px-3 py-2 font-bold text-slate-900 dark:text-white">₹{totalGst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td></tr>
                  ) : (
                    <>
                      <tr><td colSpan={7} className="px-3 py-2 text-right font-bold text-slate-500 text-xs">CGST:</td><td colSpan={2} className="px-3 py-2 font-bold text-slate-900 dark:text-white">₹{(totalGst / 2).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td></tr>
                      <tr><td colSpan={7} className="px-3 py-2 text-right font-bold text-slate-500 text-xs">SGST:</td><td colSpan={2} className="px-3 py-2 font-bold text-slate-900 dark:text-white">₹{(totalGst / 2).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td></tr>
                    </>
                  ) : (
                    <tr><td colSpan={7} className="px-3 py-2 text-right font-bold text-slate-500 text-xs">GST (Exempted):</td><td colSpan={2} className="px-3 py-2 font-bold text-slate-500 dark:text-slate-400">₹0.00</td></tr>
                  )}
                  {freight > 0 && <tr><td colSpan={7} className="px-3 py-2 text-right font-bold text-slate-500 text-xs">Freight:</td><td colSpan={2} className="px-3 py-2 font-bold text-slate-900 dark:text-white">₹{freight.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td></tr>}
                  {loadingCharges > 0 && <tr><td colSpan={7} className="px-3 py-2 text-right font-bold text-slate-500 text-xs">Loading Charges:</td><td colSpan={2} className="px-3 py-2 font-bold text-slate-900 dark:text-white">₹{loadingCharges.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td></tr>}
                  {unloadingCharges > 0 && <tr><td colSpan={7} className="px-3 py-2 text-right font-bold text-slate-500 text-xs">Unloading Charges:</td><td colSpan={2} className="px-3 py-2 font-bold text-slate-900 dark:text-white">₹{unloadingCharges.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td></tr>}
                  {packingCharges > 0 && <tr><td colSpan={7} className="px-3 py-2 text-right font-bold text-slate-500 text-xs">Packing Charges:</td><td colSpan={2} className="px-3 py-2 font-bold text-slate-900 dark:text-white">₹{packingCharges.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td></tr>}
                  {insurance > 0 && <tr><td colSpan={7} className="px-3 py-2 text-right font-bold text-slate-500 text-xs">Insurance:</td><td colSpan={2} className="px-3 py-2 font-bold text-slate-900 dark:text-white">₹{insurance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td></tr>}
                  {otherCharges > 0 && <tr><td colSpan={7} className="px-3 py-2 text-right font-bold text-slate-500 text-xs">Other Charges:</td><td colSpan={2} className="px-3 py-2 font-bold text-slate-900 dark:text-white">₹{otherCharges.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td></tr>}
                  {discount > 0 && <tr><td colSpan={7} className="px-3 py-2 text-right font-bold text-rose-500 text-xs">Discount:</td><td colSpan={2} className="px-3 py-2 font-bold text-rose-600">-₹{discount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td></tr>}
                  {roundOff !== 0 && <tr><td colSpan={7} className="px-3 py-2 text-right font-bold text-slate-500 text-xs">Round Off:</td><td colSpan={2} className="px-3 py-2 font-bold text-slate-900 dark:text-white">{(roundOff >= 0 ? '+' : '')}₹{Math.abs(roundOff).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td></tr>}
                  <tr className="border-t-2 border-slate-300 dark:border-slate-600 bg-indigo-50/50 dark:bg-indigo-950/20">
                    <td colSpan={7} className="px-3 py-3.5 text-right text-xs font-black text-slate-600 dark:text-slate-300 uppercase tracking-wider">Grand Total:</td>
                    <td colSpan={2} className="px-3 py-3.5 font-black text-xl text-indigo-600 dark:text-indigo-400">₹{grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
          <div className="border border-slate-200/60 dark:border-slate-800 rounded-2xl p-5 bg-slate-50/50 dark:bg-slate-900/50">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Purchase Order Terms & Conditions</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-slate-500 dark:text-slate-400 text-[10px] leading-relaxed">
              <ul className="list-decimal pl-4 space-y-2">
                <li><strong>Reference Requirement:</strong> Supplier must reference the PO number on all invoices and correspondence.</li>
                <li><strong>Invoice Submission:</strong> Tax-compliant invoice with supplier details, GST breakup, and PO reference required.</li>
                <li><strong>Three-Way Match:</strong> Payment subject to matching Approved PO, GRN, and Supplier Invoice.</li>
                <li><strong>Payment Terms:</strong> Net 30 days from receipt of valid invoice or acceptance of goods.</li>
                <li><strong>Acceptance:</strong> Buyer reserves the right to inspect and reject non-conforming goods.</li>
                <li><strong>Pricing:</strong> Fixed. No changes without written approval.</li>
              </ul>
              <ul className="list-decimal pl-4 space-y-2">
                <li value="7"><strong>Taxes:</strong> Supplier responsible for all applicable tax compliance.</li>
                <li value="8"><strong>Supporting Documents:</strong> Provide delivery notes, timesheets, certificates as applicable.</li>
                <li value="9"><strong>Discrepancies:</strong> Mismatch between PO, GRN, and invoice may delay payment.</li>
                <li value="10"><strong>Compliance:</strong> Comply with all applicable laws and regulations.</li>
                <li value="11"><strong>Currency:</strong> Invoice in currency specified on PO unless agreed otherwise.</li>
                <li value="12"><strong>Invoice Approval:</strong> Payment subject to internal approval and verification.</li>
              </ul>
            </div>
            {po.termsAndConditions && (
              <div className="mt-4 border-t border-slate-100 dark:border-slate-800 pt-3">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Specific PO Terms</p>
                <p className="text-xs text-slate-700 dark:text-slate-350 italic bg-amber-50/40 dark:bg-amber-950/20 p-3 rounded-xl border border-dashed border-amber-200/50">"{po.termsAndConditions}"</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Add Supplier Inline ──────────────────────────────────────────────────────
function AddSupplierInline({ onAdded, onClose }) {
  const [name, setName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [gstin, setGstin] = useState('');
  const [pan, setPan] = useState('');
  const [address, setAddress] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isVerifyingGstin, setIsVerifyingGstin] = useState(false);

  const handleVerifyGSTIN = async () => {
    if (!gstin?.trim()) { Swal.fire({ icon: 'warning', title: 'GSTIN Required', confirmButtonColor: '#4f46e5' }); return; }
    const cleanGstin = gstin.trim().toUpperCase();
    const regex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
    if (!regex.test(cleanGstin)) { Swal.fire({ icon: 'error', title: 'Invalid GSTIN', confirmButtonColor: '#4f46e5' }); return; }
    setIsVerifyingGstin(true);
    try {
      const res = await api.get(`/asset-management/verify-gstin/${cleanGstin}`);
      const data = res.data;
      const result = await Swal.fire({
        title: '🔍 GST Registry Verification',
        html: `<div style="text-align:left"><strong>${data.gstin}</strong> — ${data.status}<br/>${data.legalName || ''}<br/>${data.principalAddress || ''}</div>`,
        showCancelButton: true,
        confirmButtonText: 'Apply to Form',
        confirmButtonColor: '#4f46e5',
        cancelButtonColor: '#6b7280',
      });
      if (result.isConfirmed) {
        setGstin(cleanGstin);
        setPan(data.pan || '');
        if (data.legalName) setName(data.legalName);
        if (data.principalAddress) setAddress(data.principalAddress);
      }
    } catch (err) {
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
      const res = await api.post('/parties/suppliers', { name, contactPerson, phone, email, gstin, pan, address });
      onAdded(res.data);
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Failed to add supplier', confirmButtonColor: '#4f46e5' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 w-full max-w-lg shadow-2xl border border-slate-200/60 dark:border-slate-800 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Quick Add Supplier</h2>
          <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full"><X className="w-5 h-5" /></Button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>GSTIN</Label>
            <div className="flex gap-2">
              <Input value={gstin} onChange={e => setGstin(e.target.value)} placeholder="e.g. 29ABCDE1234F1Z5" className="h-10 rounded-xl font-mono uppercase" />
              <Button type="button" disabled={isVerifyingGstin} onClick={handleVerifyGSTIN} className="bg-indigo-600 hover:bg-indigo-700 text-white shrink-0 px-4 rounded-xl h-10">
                {isVerifyingGstin ? 'Verifying...' : 'Verify'}
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-1.5"><Label>Name <span className="text-rose-500">*</span></Label><Input required value={name} onChange={e => setName(e.target.value)} className="h-10 rounded-xl" /></div>
            <div className="space-y-1.5"><Label>Contact Person</Label><Input value={contactPerson} onChange={e => setContactPerson(e.target.value)} className="h-10 rounded-xl" /></div>
            <div className="space-y-1.5"><Label>Phone <span className="text-rose-500">*</span></Label><Input required value={phone} onChange={e => setPhone(e.target.value)} className="h-10 rounded-xl" /></div>
            <div className="space-y-1.5"><Label>Email</Label><Input type="email" value={email} onChange={e => setEmail(e.target.value)} className="h-10 rounded-xl" /></div>
            <div className="space-y-1.5"><Label>PAN</Label><Input value={pan} onChange={e => setPan(e.target.value)} className="h-10 rounded-xl font-mono uppercase" /></div>
            <div className="col-span-2 space-y-1.5"><Label>Address</Label><Input value={address} onChange={e => setAddress(e.target.value)} className="h-10 rounded-xl" /></div>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <Button type="button" variant="outline" onClick={onClose} className="rounded-xl">Cancel</Button>
            <Button type="submit" disabled={isSubmitting} className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white">
              {isSubmitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Adding...</> : 'Add Supplier'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Supplier Select ──────────────────────────────────────────────────────────
function SupplierSelect({ suppliers, value, onChange, onAddNew, disabled }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = React.useRef(null);
  const filtered = suppliers.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    (s.phone && s.phone.toLowerCase().includes(search.toLowerCase()))
  );
  React.useEffect(() => {
    const handler = (e) => { if (containerRef.current && !containerRef.current.contains(e.target)) { setOpen(false); setSearch(''); } };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);
  return (
    <div className="flex gap-2 w-full">
      <div ref={containerRef} className="relative flex-1">
        <button type="button" disabled={disabled} onClick={() => setOpen(!open)}
          className={`w-full px-4 h-[42px] border rounded-xl text-left flex items-center justify-between transition-all duration-200 shadow-sm ${disabled ? 'opacity-60 cursor-not-allowed bg-slate-100/50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-800' : open ? 'bg-indigo-50/50 border-indigo-400 ring-4 ring-indigo-500/10 dark:bg-indigo-900/10 dark:border-indigo-500' : 'bg-slate-50/50 dark:bg-slate-900/50 border-slate-300 dark:border-slate-700 hover:border-indigo-400 hover:bg-white dark:hover:bg-slate-800'}`}>
          <span className={value ? 'text-slate-900 dark:text-white truncate font-medium text-sm' : 'text-slate-500 dark:text-slate-400 text-sm'}>
            {value ? `${value.name} (${value.phone || 'N/A'})` : 'Select Supplier...'}
          </span>
          <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${open ? 'rotate-180 text-indigo-500' : ''}`} />
        </button>
        {open && !disabled && (
          <div className="absolute z-50 mt-2 w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="p-2 border-b border-slate-100 dark:border-slate-700 relative bg-slate-50/50 dark:bg-slate-900/50">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search supplier..." className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 focus:outline-none focus:border-indigo-500 dark:text-white" autoFocus />
            </div>
            <ul className="max-h-60 overflow-y-auto p-1">
              {filtered.length === 0 ? <li className="px-4 py-8 text-sm text-slate-500 text-center">No suppliers found</li> :
                filtered.map(s => (
                  <li key={s.id} onMouseDown={() => { onChange(s); setOpen(false); setSearch(''); }}
                    className="px-4 py-2.5 mx-1 my-0.5 rounded-lg text-sm cursor-pointer hover:bg-indigo-50 hover:text-indigo-700 dark:hover:bg-indigo-500/10 dark:hover:text-indigo-300 transition-colors flex items-center justify-between group">
                    <span className="font-medium text-slate-700 group-hover:text-indigo-700 dark:text-slate-300 dark:group-hover:text-indigo-300">{s.name}</span>
                    <span className="text-xs text-slate-400">{s.phone}</span>
                  </li>
                ))}
            </ul>
          </div>
        )}
      </div>
      {!disabled && (
        <Button type="button" onClick={onAddNew} className="bg-indigo-600 hover:bg-indigo-700 text-white shrink-0 px-4 rounded-xl shadow-sm h-[42px]">
          <Plus className="w-5 h-5" />
        </Button>
      )}
    </div>
  );
}

// ─── PR Select (replaces PQ Select) ──────────────────────────────────────────
function PRSelect({ prs = [], existingPOPrNos = [], value, onChange }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = React.useRef(null);
  const sorted = [...prs]
    .filter(pr => ['Approved', 'Submitted', 'PO Issued'].includes(pr.status) || pr.status)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const filtered = sorted.filter(p =>
    p.prNo?.toLowerCase().includes(search.toLowerCase()) ||
    p.assetName?.toLowerCase().includes(search.toLowerCase()) ||
    p.requesterName?.toLowerCase().includes(search.toLowerCase())
  );
  React.useEffect(() => {
    const handler = (e) => { if (containerRef.current && !containerRef.current.contains(e.target)) { setOpen(false); setSearch(''); } };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);
  return (
    <div ref={containerRef} className="relative w-full">
      <button type="button" onClick={() => setOpen(!open)}
        className={`w-full px-4 h-10 border rounded-xl text-left flex items-center justify-between transition-all duration-200 shadow-sm ${open ? 'bg-indigo-50/50 border-indigo-400 ring-4 ring-indigo-500/10 dark:bg-indigo-900/10 dark:border-indigo-500' : 'bg-slate-50/50 dark:bg-slate-900/50 border-slate-300 dark:border-slate-700 hover:border-indigo-400 hover:bg-white dark:hover:bg-slate-800'}`}>
        <span className={value ? 'text-slate-900 dark:text-white truncate font-medium text-sm' : 'text-slate-500 dark:text-slate-400 text-sm'}>
          {value ? `${value.prNo} — ${value.assetName}` : 'Select Purchase Request (PR)...'}
        </span>
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${open ? 'rotate-180 text-indigo-500' : ''}`} />
      </button>
      {open && (
        <div className="absolute z-50 mt-2 w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="p-2 border-b border-slate-100 dark:border-slate-700 relative bg-slate-50/50 dark:bg-slate-900/50">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search PR No, Asset or Requester..." className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 focus:outline-none focus:border-indigo-500 dark:text-white" autoFocus />
          </div>
          <ul className="max-h-72 overflow-y-auto p-1">
            {filtered.length === 0 ? <li className="px-4 py-8 text-sm text-slate-500 text-center">No PRs found</li> :
              filtered.map(p => {
                const alreadyHasPO = existingPOPrNos.includes(p.prNo);
                return (
                  <li key={p.id}
                    onMouseDown={() => {
                      if (alreadyHasPO) return;
                      onChange(p); setOpen(false); setSearch('');
                    }}
                    className={`px-4 py-2.5 mx-1 my-0.5 rounded-lg text-sm transition-colors flex flex-col justify-start group ${alreadyHasPO ? 'opacity-50 cursor-not-allowed bg-slate-50 dark:bg-slate-900' : 'cursor-pointer hover:bg-indigo-50 hover:text-indigo-700 dark:hover:bg-indigo-500/10 dark:hover:text-indigo-300'}`}>
                    <div className="flex justify-between w-full">
                      <span className="font-semibold text-slate-700 dark:text-slate-300 group-hover:text-indigo-700 dark:group-hover:text-indigo-300 font-mono text-xs">{p.prNo}</span>
                      <div className="flex items-center gap-2">
                        {alreadyHasPO && <span className="text-[10px] bg-violet-100 text-violet-600 px-2 py-0.5 rounded-full font-bold">PO Raised</span>}
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${p.status === 'Approved' ? 'bg-emerald-100 text-emerald-600' : p.status === 'PO Issued' ? 'bg-violet-100 text-violet-600' : 'bg-blue-100 text-blue-600'}`}>{p.status}</span>
                      </div>
                    </div>
                    <span className="text-xs text-slate-500 mt-0.5 truncate">{p.assetName} • {p.requesterName} • {p.department}</span>
                    <span className="text-[10px] text-slate-400">Est. ₹{Number(p.estimatedTotalCost || 0).toLocaleString('en-IN')} • {p.createdAt ? format(new Date(p.createdAt), 'dd MMM yyyy') : '—'}</span>
                  </li>
                );
              })}
          </ul>
        </div>
      )}
    </div>
  );
}

// ─── Charge Row with GST Checkbox ─────────────────────────────────────────────
function ChargeRow({ label, fieldKey, value, gstChecked, isInterState, onChange, onGstChange }) {
  const numVal = Number(value || 0);
  const gstLabel = isInterState ? 'IGST 18%' : 'GST 18% (CGST+SGST)';
  const gstAmt = gstChecked && numVal > 0 ? numVal * 0.18 : 0;
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-700/60 rounded-xl p-3 space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">{label}</Label>
        <label className="flex items-center gap-1.5 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={gstChecked}
            onChange={e => onGstChange(e.target.checked)}
            className="w-3.5 h-3.5 rounded accent-indigo-600"
          />
          <span className="text-[10px] font-medium text-indigo-600 dark:text-indigo-400">{gstLabel}</span>
        </label>
      </div>
      <Input
        type="number"
        min="0"
        step="0.01"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="0.00"
        className="h-8 rounded-lg text-sm"
      />
      {gstChecked && numVal > 0 && (
        <p className="text-[10px] text-indigo-500 font-medium">
          + GST: ₹{gstAmt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
        </p>
      )}
    </div>
  );
}

// ─── Create PO Form ───────────────────────────────────────────────────────────
function CreatePOForm({ onBack, isReadOnly, prefillFromPQ }) {
  const [form, setForm] = useState({
    prId: '',
    prNo: '',
    vendorName: '',
    vendorGstin: '',
    vendorPan: '',
    vendorAddress: '',
    currency: 'INR',
    poDate: null,
    deliveryDate: null,
    deliveryAddress: 'Factory / Registered Office Address',
    paymentTerms: 'Net 30',
    paymentMode: 'Bank Transfer (NEFT)',
    freight: '',
    loadingCharges: '',
    unloadingCharges: '',
    packingCharges: '',
    insurance: '',
    discount: '',
    otherCharges: '',
    isInterState: false,
    applyGst: true,
    termsAndConditions: '',
    items: [],
  });

  // GST checkbox state per charge: { freight: false, loadingCharges: false, ... }
  const [chargeGstStates, setChargeGstStates] = useState({
    freight: false,
    loadingCharges: false,
    unloadingCharges: false,
    packingCharges: false,
    insurance: false,
    otherCharges: false,
  });

  const [error, setError] = useState('');
  const [showAddSupplier, setShowAddSupplier] = useState(false);
  const qc = useQueryClient();

  const { data: prs = [] } = useQuery({
    queryKey: ['asset-prs'],
    queryFn: () => api.get('/asset-management/requests').then(r => r.data),
  });

  // fetch existing POs to know which PRs are already linked
  const { data: pos = [] } = useQuery({
    queryKey: ['asset-pos'],
    queryFn: () => api.get('/asset-management/purchase-orders').then(r => r.data),
  });

  // Pre-fill from PQ if redirected
  useEffect(() => {
    if (prefillFromPQ && prs.length > 0) {
      const pq = prefillFromPQ;
      const linkedPR = prs.find(p => p.prNo === pq.prNo);
      
      const isInterState = pq.vendorGstin ? pq.vendorGstin.trim().substring(0, 2) !== '27' : false;
      
      const items = (pq.items || []).map(i => ({
        category: i.category || 'IT Equipment',
        itemDescription: i.itemDescription || i.description || '',
        hsnSac: i.hsnSac || i.hsnCode || CATEGORY_MAP[i.category]?.hsn || '8471',
        quantity: Number(i.quantity) || 1,
        unit: i.unit || i.uom || 'Nos',
        unitPrice: Number(i.unitPrice || 0),
        gstRate: Number(i.gstRate || 18),
      }));

      setForm(prev => ({
        ...prev,
        prId: linkedPR ? linkedPR.id : '',
        prNo: pq.prNo,
        vendorName: pq.vendorName || '',
        vendorGstin: pq.vendorGstin || '',
        vendorPan: pq.vendorPan || '',
        vendorAddress: pq.address || '',
        currency: pq.currency || 'INR',
        paymentTerms: pq.paymentTerms || 'Net 30',
        paymentMode: pq.paymentMode || 'Bank Transfer (NEFT)',
        freight: pq.shippingCharges ? String(pq.shippingCharges) : '',
        otherCharges: pq.otherCharges ? String(pq.otherCharges) : '',
        discount: pq.discount ? String(pq.discount) : '',
        termsAndConditions: pq.termsAndConditions || '',
        isInterState,
        items,
      }));
    }
  }, [prefillFromPQ, prs]);

  const existingPOPrNos = pos.map(p => p.prNo).filter(Boolean);

  const { data: suppliers = [], refetch: refetchSuppliers } = useQuery({
    queryKey: ['suppliers'],
    queryFn: () => api.get('/parties/suppliers').then(r => r.data?.data || r.data || []),
  });

  const calcTotals = (item) => {
    const base = Number(item.quantity) * Number(item.unitPrice || 0);
    const gst = form.applyGst ? base * (Number(item.gstRate) / 100) : 0;
    return { totalBeforeTax: base, gstAmount: gst, totalWithGst: base + gst };
  };

  const totals = form.items.reduce((acc, item) => {
    const c = calcTotals(item);
    return { taxable: acc.taxable + c.totalBeforeTax, gst: acc.gst + c.gstAmount, total: acc.total + c.totalWithGst };
  }, { taxable: 0, gst: 0, total: 0 });

  const freight = Number(form.freight || 0);
  const loadingCharges = Number(form.loadingCharges || 0);
  const unloadingCharges = Number(form.unloadingCharges || 0);
  const packingCharges = Number(form.packingCharges || 0);
  const insurance = Number(form.insurance || 0);
  const otherCharges = Number(form.otherCharges || 0);
  const discount = Number(form.discount || 0);

  // Calculate extra GST from charges
  const calcChargeGst = (val, key) => chargeGstStates[key] && Number(val) > 0 ? Number(val) * 0.18 : 0;
  const extraGst = form.applyGst ? (
    calcChargeGst(freight, 'freight') +
    calcChargeGst(loadingCharges, 'loadingCharges') +
    calcChargeGst(unloadingCharges, 'unloadingCharges') +
    calcChargeGst(packingCharges, 'packingCharges') +
    calcChargeGst(insurance, 'insurance') +
    calcChargeGst(otherCharges, 'otherCharges')
  ) : 0;

  const preRoundTotal = totals.taxable + totals.gst + extraGst + freight + loadingCharges + unloadingCharges + packingCharges + insurance + otherCharges - discount;
  const grandTotal = Math.round(preRoundTotal);
  const roundOff = grandTotal - preRoundTotal;

  const mutation = useMutation({
    mutationFn: data => api.post('/asset-management/purchase-orders', data).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['asset-pos'] });
      qc.invalidateQueries({ queryKey: ['asset-prs'] });
      Swal.fire({ icon: 'success', title: 'Purchase Order Created!', text: 'PO has been issued successfully.', confirmButtonColor: '#4f46e5' }).then(() => onBack());
    },
    onError: err => setError(err.response?.data?.error || 'Failed to create PO'),
  });

  const handleSubmit = e => {
    e.preventDefault();
    setError('');
    if (!form.prId) { setError('Please select a Purchase Request (PR) to link this PO'); return; }
    if (!form.poDate) { setError('PO Date is required'); return; }
    if (!form.vendorName) { setError('Vendor name is required'); return; }
    if (form.items.length === 0) { setError('No items found. Add at least one line item.'); return; }
    if (form.items.some(i => !i.itemDescription || !i.unitPrice)) { setError('All item fields are required'); return; }
    // Check if PR already has a PO
    if (existingPOPrNos.includes(form.prNo)) {
      setError(`A Purchase Order has already been raised for PR ${form.prNo}. Each PR allows only one PO.`);
      return;
    }
    mutation.mutate({
      ...form,
      discount: Number(form.discount || 0),
      freight: Number(form.freight || 0),
      loadingCharges: Number(form.loadingCharges || 0),
      unloadingCharges: Number(form.unloadingCharges || 0),
      packingCharges: Number(form.packingCharges || 0),
      insurance: Number(form.insurance || 0),
      otherCharges: Number(form.otherCharges || 0),
      isInterState: Boolean(form.isInterState),
      applyGst: Boolean(form.applyGst),
      chargeGstStates,
      items: form.items.map(i => ({ ...i, ...calcTotals(i) }))
    });
  };

  const update = (f, v) => setForm(p => ({ ...p, [f]: v }));
  const updateItem = (idx, f, v) => setForm(p => ({ ...p, items: p.items.map((item, i) => i === idx ? { ...item, [f]: v } : item) }));
  const addItem = () => setForm(p => ({ ...p, items: [...p.items, { category: 'IT Equipment', itemDescription: '', hsnSac: '8471', quantity: 1, unit: 'Nos', unitPrice: '', gstRate: 18 }] }));
  const removeItem = idx => setForm(p => ({ ...p, items: p.items.filter((_, i) => i !== idx) }));

  const handleCategoryChange = (idx, category) => {
    const mapDetails = CATEGORY_MAP[category] || { hsn: '8471', gst: 18 };
    setForm(p => ({
      ...p,
      items: p.items.map((item, i) => i === idx ? { ...item, category, hsnSac: mapDetails.hsn, gstRate: mapDetails.gst } : item)
    }));
  };

  const fillFromPR = (pr) => {
    const isInterState = pr.vendorGstin ? pr.vendorGstin.trim().substring(0, 2) !== '27' : false;
    // Get items from PR (stored as JSON array in items field)
    let items = [];
    if (pr.items && Array.isArray(pr.items)) {
      items = pr.items.map(i => ({
        category: i.category || 'IT Equipment',
        itemDescription: i.assetName || i.itemDescription || i.description || '',
        hsnSac: i.hsnCode || i.hsnSac || CATEGORY_MAP[i.category]?.hsn || '8471',
        quantity: Number(i.quantity) || 1,
        unit: i.uom || i.unit || 'Nos',
        unitPrice: Number(i.estimatedUnitCost || i.unitPrice || 0),
        gstRate: CATEGORY_MAP[i.category]?.gst || 18,
      }));
    } else {
      // Fallback to top-level fields (legacy single-item PR)
      items = [{
        category: pr.category || 'IT Equipment',
        itemDescription: pr.assetName || '',
        hsnSac: pr.hsnCode || CATEGORY_MAP[pr.category]?.hsn || '8471',
        quantity: Number(pr.quantity) || 1,
        unit: pr.uom || 'Nos',
        unitPrice: Number(pr.estimatedUnitCost || 0),
        gstRate: CATEGORY_MAP[pr.category]?.gst || 18,
      }];
    }
    setForm(prev => ({
      ...prev,
      prId: pr.id,
      prNo: pr.prNo,
      isInterState,
      items,
    }));
  };

  const chargeFields = [
    { label: 'Freight Charges (₹)', key: 'freight' },
    { label: 'Loading Charges (₹)', key: 'loadingCharges' },
    { label: 'Unloading Charges (₹)', key: 'unloadingCharges' },
    { label: 'Packing Charges (₹)', key: 'packingCharges' },
    { label: 'Insurance (₹)', key: 'insurance' },
    { label: 'Other Charges (₹)', key: 'otherCharges' },
  ];

  return (
    <div className="space-y-6 w-full">
      {showAddSupplier && (
        <AddSupplierInline
          onClose={() => setShowAddSupplier(false)}
          onAdded={(newSup) => {
            setShowAddSupplier(false);
            refetchSuppliers().then(() => {
              update('vendorName', newSup.name);
              update('vendorAddress', newSup.address || '');
              update('vendorGstin', newSup.gstin || '');
              update('vendorPan', newSup.pan || '');
            });
          }}
        />
      )}

      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onBack} className="rounded-full border border-slate-200 dark:border-slate-700">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Issue Purchase Order</h2>
          <p className="text-sm text-slate-500">SAP B1 Asset Procurement — Step 3 of 8 | Direct PR → PO</p>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-3 p-4 bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/50 rounded-2xl text-rose-700 dark:text-rose-400 text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Link PR */}
        <div className="border border-indigo-200 dark:border-indigo-900/50 bg-indigo-50/40 dark:bg-indigo-950/20 rounded-2xl p-5">
          <h3 className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider mb-3 flex items-center gap-2">
            <ClipboardList className="w-4 h-4" /> Link to Purchase Request (PR)
          </h3>
          <div className="space-y-3">
            <PRSelect
              prs={prs}
              existingPOPrNos={existingPOPrNos}
              value={prs.find(p => p.id === form.prId) || null}
              onChange={pr => fillFromPR(pr)}
            />
            {form.prId && (
              <div className="flex items-center gap-2 p-2 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40 rounded-xl text-xs text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                PR <strong>{form.prNo}</strong> linked — Items pre-filled. Add vendor details below.
              </div>
            )}
            <div className="flex items-start gap-2 p-2 bg-amber-50 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40 rounded-xl text-[10px] text-amber-700 dark:text-amber-400">
              <Info className="w-3 h-3 mt-0.5 shrink-0" />
              Each PR can have only one Purchase Order. PRs marked "PO Raised" are disabled.
            </div>
          </div>
        </div>

        {/* Vendor & PO Date */}
        <div className="border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-indigo-500" /> Vendor & PO Details
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label>Vendor Name <span className="text-rose-500">*</span></Label>
              <SupplierSelect
                suppliers={suppliers}
                disabled={false}
                value={suppliers.find(s => s.name === form.vendorName) || null}
                onChange={s => {
                  update('vendorName', s.name);
                  update('vendorAddress', s.address || '');
                  update('vendorGstin', s.gstin || '');
                  update('vendorPan', s.pan || '');
                  // Auto detect inter/intra state from GSTIN
                  if (s.gstin && s.gstin.length >= 2) {
                    update('isInterState', s.gstin.substring(0, 2) !== '27');
                  }
                }}
                onAddNew={() => setShowAddSupplier(true)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Vendor GSTIN</Label>
              <Input value={form.vendorGstin} onChange={e => update('vendorGstin', e.target.value)} placeholder="22AAAAA0000A1Z5" className="h-10 rounded-xl font-mono" />
            </div>
            <div className="space-y-1.5">
              <Label>Vendor PAN</Label>
              <Input value={form.vendorPan} onChange={e => update('vendorPan', e.target.value)} className="h-10 rounded-xl font-mono" />
            </div>
            <div className="md:col-span-2 space-y-1.5">
              <Label>Vendor Address</Label>
              <Input value={form.vendorAddress} onChange={e => update('vendorAddress', e.target.value)} className="h-10 rounded-xl" />
            </div>
            <DatePicker label="PO Date *" value={form.poDate} onChange={d => update('poDate', d)} placeholder="Select Date" />
          </div>
        </div>

        {/* Delivery & Payment */}
        <div className="border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
            <Truck className="w-4 h-4 text-indigo-500" /> Delivery & Payment
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <DatePicker label="Delivery Date" value={form.deliveryDate} onChange={d => update('deliveryDate', d)} placeholder="Expected delivery" />
            <div className="space-y-1.5">
              <Label>Payment Terms</Label>
              <div className="relative">
                <select value={form.paymentTerms} onChange={e => update('paymentTerms', e.target.value)} className="w-full h-10 px-3 pr-8 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-500/20">
                  {['Net 30', 'Net 45', 'Net 60', '100% Advance', '50% Advance', 'LC/Bank'].map(t => <option key={t}>{t}</option>)}
                </select>
                <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-3 pointer-events-none" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Payment Mode</Label>
              <div className="relative">
                <select value={form.paymentMode} onChange={e => update('paymentMode', e.target.value)} className="w-full h-10 px-3 pr-8 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-500/20">
                  {PAYMENT_MODES.map(m => <option key={m}>{m}</option>)}
                </select>
                <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-3 pointer-events-none" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Delivery Address</Label>
              <Input value={form.deliveryAddress} onChange={e => update('deliveryAddress', e.target.value)} className="h-10 rounded-xl" />
            </div>
          </div>
        </div>

        {/* Line Items */}
        <div className="border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <Package className="w-4 h-4 text-indigo-500" /> Order Line Items
            </h3>
            <Button type="button" variant="outline" size="sm" onClick={addItem} className="h-8 rounded-lg text-xs gap-1 border-indigo-200 dark:border-indigo-900 text-indigo-600 hover:bg-indigo-50">
              <Plus className="w-3.5 h-3.5" /> Add Line
            </Button>
          </div>

          {form.items.length === 0 ? (
            <div className="text-center py-10 text-slate-400 text-sm border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
              <Package className="w-8 h-8 mx-auto mb-2 text-slate-300" />
              Select a PR above to auto-fill items, or click "Add Line" to add manually.
            </div>
          ) : (
            <div className="space-y-3">
              {form.items.map((item, idx) => {
                const { totalWithGst } = calcTotals(item);
                return (
                  <div key={idx} className="bg-slate-50/60 dark:bg-slate-800/30 rounded-xl p-4 border border-slate-200/60 dark:border-slate-800/60">
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                      <div className="space-y-1 col-span-2">
                        <Label className="text-xs">Description <span className="text-rose-500">*</span></Label>
                        <Input value={item.itemDescription} onChange={e => updateItem(idx, 'itemDescription', e.target.value)} className="h-9 rounded-lg text-sm" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Category</Label>
                        <div className="relative">
                          <select value={item.category || 'IT Equipment'} onChange={e => handleCategoryChange(idx, e.target.value)} className="w-full h-9 px-2 pr-7 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-500/20">
                            {Object.keys(CATEGORY_MAP).map(c => <option key={c}>{c}</option>)}
                          </select>
                          <ChevronDown className="w-3 h-3 text-slate-400 absolute right-2 top-3 pointer-events-none" />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">HSN/SAC</Label>
                        <Input value={item.hsnSac} onChange={e => updateItem(idx, 'hsnSac', e.target.value)} className="h-9 rounded-lg text-sm font-mono" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">UOM</Label>
                        <div className="relative">
                          <select value={item.unit || 'Nos'} onChange={e => updateItem(idx, 'unit', e.target.value)} className="w-full h-9 px-2 pr-7 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-500/20">
                            {UOM_OPTIONS.map(u => <option key={u} value={u}>{u}</option>)}
                          </select>
                          <ChevronDown className="w-3 h-3 text-slate-400 absolute right-2 top-3 pointer-events-none" />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Qty</Label>
                        <Input type="number" min="1" value={item.quantity} onChange={e => updateItem(idx, 'quantity', e.target.value)} className="h-9 rounded-lg text-sm" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Unit Price (₹) <span className="text-rose-500">*</span></Label>
                        <Input type="number" min="0" step="0.01" value={item.unitPrice} onChange={e => updateItem(idx, 'unitPrice', e.target.value)} className="h-9 rounded-lg text-sm" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">GST Rate</Label>
                        <div className="relative">
                          <select value={item.gstRate} onChange={e => updateItem(idx, 'gstRate', Number(e.target.value))} className="w-full h-9 px-2 pr-7 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-500/20">
                            {GST_RATES.map(r => <option key={r} value={r}>{r}%</option>)}
                          </select>
                          <ChevronDown className="w-3 h-3 text-slate-400 absolute right-2 top-3 pointer-events-none" />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Line Total</Label>
                        <div className="h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 flex items-center text-sm font-bold text-indigo-600 dark:text-indigo-400">
                          ₹{totalWithGst.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                        </div>
                      </div>
                    </div>
                    {form.items.length > 1 && (
                      <div className="flex justify-end mt-2">
                        <button type="button" onClick={() => removeItem(idx)} className="p-1.5 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Totals + Charges */}
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-4">
              {/* GST Toggles */}
              <div className="bg-slate-50/50 dark:bg-slate-800/10 p-4 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">GST Applicability</span>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" id="applyGst" checked={form.applyGst} onChange={e => update('applyGst', e.target.checked)} className="w-4 h-4 rounded accent-indigo-600 border-slate-300" />
                    <Label htmlFor="applyGst" className="text-xs font-medium cursor-pointer">
                      {form.applyGst ? `Apply GST (${form.isInterState ? 'IGST' : 'CGST + SGST'})` : 'Exempt / No GST'}
                    </Label>
                  </label>
                </div>
                <div className="flex items-center justify-between border-t border-slate-200/60 dark:border-slate-800/60 pt-2.5">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Supply Type</span>
                  <div className="flex items-center gap-0.5 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200/50 dark:border-slate-700/50">
                    <button type="button" onClick={() => update('isInterState', false)} className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${!form.isInterState ? 'bg-white dark:bg-slate-900 shadow-sm text-indigo-600 dark:text-indigo-400' : 'text-slate-500 hover:text-slate-700'}`}>
                      Intra-state (CGST+SGST)
                    </button>
                    <button type="button" onClick={() => update('isInterState', true)} className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${form.isInterState ? 'bg-white dark:bg-slate-900 shadow-sm text-indigo-600 dark:text-indigo-400' : 'text-slate-500 hover:text-slate-700'}`}>
                      Inter-state (IGST)
                    </button>
                  </div>
                </div>
              </div>

              {/* Discount */}
              <div className="bg-white dark:bg-slate-900 border border-rose-200/60 dark:border-rose-900/30 rounded-xl p-3">
                <Label className="text-xs font-semibold text-rose-600 dark:text-rose-400">Discount (₹)</Label>
                <Input type="number" min="0" step="0.01" value={form.discount} onChange={e => update('discount', e.target.value)} placeholder="0.00" className="h-8 rounded-lg text-sm mt-1.5" />
              </div>

              {/* Charge rows with GST checkbox */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {chargeFields.map(({ label, key }) => (
                  <ChargeRow
                    key={key}
                    label={label}
                    fieldKey={key}
                    value={form[key]}
                    gstChecked={chargeGstStates[key]}
                    isInterState={form.isInterState}
                    onChange={v => update(key, v)}
                    onGstChange={checked => setChargeGstStates(prev => ({ ...prev, [key]: checked }))}
                  />
                ))}
              </div>
            </div>

            {/* Summary */}
            <div className="bg-gradient-to-br from-indigo-50 to-violet-50 dark:from-indigo-950/30 dark:to-violet-950/30 rounded-2xl p-4 space-y-2 text-sm h-fit">
              {[
                { label: 'Taxable Value', value: totals.taxable },
                ...(form.applyGst ? (
                  form.isInterState ? [{ label: 'IGST', value: totals.gst + extraGst }] : [
                    { label: 'CGST', value: (totals.gst + extraGst) / 2 },
                    { label: 'SGST', value: (totals.gst + extraGst) / 2 }
                  ]
                ) : [{ label: 'GST (Exempted)', value: 0 }]),
                { label: 'Freight', value: freight },
                { label: 'Loading', value: loadingCharges },
                { label: 'Unloading', value: unloadingCharges },
                { label: 'Packing', value: packingCharges },
                { label: 'Insurance', value: insurance },
                { label: 'Other Charges', value: otherCharges },
                { label: 'Discount', value: -discount },
                { label: 'Round Off', value: roundOff },
              ].map(({ label, value }) => {
                const formatted = Math.abs(value).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                let textClass = 'text-slate-800 dark:text-slate-200';
                let prefix = '₹';
                if (label === 'Discount' && value < 0) { textClass = 'text-rose-500 font-bold'; prefix = '-₹'; }
                else if (label === 'Round Off') { if (value > 0) prefix = '+₹'; else if (value < 0) prefix = '-₹'; }
                return (
                  <div key={label} className="flex justify-between text-slate-600 dark:text-slate-400">
                    <span>{label}</span>
                    <span className={`font-semibold ${textClass}`}>{prefix}{formatted}</span>
                  </div>
                );
              })}
              <div className="pt-2 border-t border-indigo-200 dark:border-indigo-900/50 flex justify-between font-black text-lg text-indigo-700 dark:text-indigo-400">
                <span>PO Total (Rounded)</span>
                <span>₹{grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
          </div>
        </div>

        {/* T&C */}
        <div className="border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Shield className="w-4 h-4 text-indigo-500" /> Terms & Conditions
          </h3>
          <textarea value={form.termsAndConditions} onChange={e => update('termsAndConditions', e.target.value)} rows={3}
            placeholder="Standard warranty, delivery, and liability terms..."
            className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 resize-none" />
        </div>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={onBack} className="rounded-xl px-6 h-11">Cancel</Button>
          <Button type="submit" disabled={mutation.isPending || isReadOnly} className="rounded-xl px-6 h-11 bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-600/20 gap-2">
            {mutation.isPending ? <><Loader2 className="w-4 h-4 animate-spin" /> Issuing...</> : <><ShoppingCart className="w-4 h-4" /> Issue PO</>}
          </Button>
        </div>
      </form>
    </div>
  );
}

// ─── Main Purchase Orders View ────────────────────────────────────────────────
export default function PurchaseOrdersView() {
  const user = useAuthStore(s => s.user);
  const isReadOnly = user?.role === 'SUPERVISOR';
  const location = useLocation();
  const navigate = useNavigate();
  const [view, setView] = useState('list');
  const [search, setSearch] = useState('');
  const [selectedPO, setSelectedPO] = useState(null);
  const [sortBy, setSortBy] = useState('recent');

  useEffect(() => {
    if (location.state?.openCreate) {
      setView('create');
    }
  }, [location]);

  const { data: pos = [], isLoading } = useQuery({
    queryKey: ['asset-pos'],
    queryFn: () => api.get('/asset-management/purchase-orders').then(r => r.data),
  });

  const filtered = pos.filter(po =>
    po.poNo?.toLowerCase().includes(search.toLowerCase()) ||
    po.vendorName?.toLowerCase().includes(search.toLowerCase()) ||
    po.prNo?.toLowerCase().includes(search.toLowerCase())
  );

  const sortedAndFiltered = [...filtered].sort((a, b) => {
    if (sortBy === 'recent') return new Date(b.poDate || b.createdAt) - new Date(a.poDate || a.createdAt);
    if (sortBy === 'oldest') return new Date(a.poDate || a.createdAt) - new Date(b.poDate || b.createdAt);
    if (sortBy === 'priceLowHigh') return Number(a.grandTotal || 0) - Number(b.grandTotal || 0);
    if (sortBy === 'priceHighLow') return Number(b.grandTotal || 0) - Number(a.grandTotal || 0);
    if (sortBy === 'alphabetical') return (a.vendorName || '').localeCompare(b.vendorName || '');
    return 0;
  });

  if (view === 'create') return (
    <CreatePOForm
      onBack={() => {
        navigate(location.pathname, { replace: true, state: {} });
        setView('list');
      }}
      isReadOnly={isReadOnly}
      prefillFromPQ={location.state?.prefillFromPQ}
    />
  );

  const totalValue = pos.reduce((s, p) => s + Number(p.grandTotal || p.items?.reduce((a, i) => a + Number(i.totalWithGst || 0), 0) || 0), 0);
  const openPos = pos.filter(p => ['Approved', 'Sent', 'Partially Received'].includes(p.status)).length;

  return (
    <div className="space-y-6">
      {selectedPO && <PODetailModal po={selectedPO} onClose={() => setSelectedPO(null)} />}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Purchase Orders</h2>
          <p className="text-sm text-slate-500 mt-0.5">Issue and manage GST-compliant purchase orders (Step 3/8)</p>
        </div>
        {!isReadOnly && (
          <Button onClick={() => setView('create')} className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-md shadow-indigo-600/10 h-10 px-5">
            <Plus className="w-4 h-4" /> Issue PO
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total POs', value: pos.length, icon: ShoppingCart, bg: 'bg-indigo-50 dark:bg-indigo-950/30', clr: 'text-indigo-600 dark:text-indigo-400' },
          { label: 'Open POs', value: openPos, icon: FileText, bg: 'bg-amber-50 dark:bg-amber-950/30', clr: 'text-amber-600 dark:text-amber-400' },
          { label: 'Closed', value: pos.filter(p => p.status === 'Closed').length, icon: CheckCircle2, bg: 'bg-emerald-50 dark:bg-emerald-950/30', clr: 'text-emerald-600 dark:text-emerald-400' },
          { label: 'PO Value', value: `₹${(totalValue / 100000).toFixed(1)}L`, icon: Truck, bg: 'bg-violet-50 dark:bg-violet-950/30', clr: 'text-violet-600 dark:text-violet-400' },
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
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by PO number, vendor or PR..." className="pl-9 h-9 rounded-xl bg-white dark:bg-slate-900" />
        </div>
        <div className="relative w-full sm:w-64">
          <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="w-full h-9 pl-3 pr-8 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-700 dark:text-slate-300">
            <option value="recent">Recent first</option>
            <option value="oldest">Oldest first</option>
            <option value="priceLowHigh">Price: Low to High</option>
            <option value="priceHighLow">Price: High to Low</option>
            <option value="alphabetical">Alphabetical</option>
          </select>
          <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-2.5 pointer-events-none" />
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200/60 dark:border-slate-800/60">
        <table className="w-full text-sm">
          <thead className="bg-slate-50/80 dark:bg-slate-800/50">
            <tr>
              {['PO No.', 'PR Ref.', 'Vendor', 'PO Date', 'Delivery Date', 'Items', 'Grand Total (₹)', 'Payment Terms', 'Status', 'Actions'].map(h => (
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
                    <ShoppingCart className="w-7 h-7 text-slate-400" />
                  </div>
                  <div>
                    <p className="font-medium text-slate-700 dark:text-slate-300">No purchase orders yet</p>
                    <p className="text-xs text-slate-400 mt-1">Issue a PO directly from an approved PR</p>
                  </div>
                </div>
              </td></tr>
            ) : sortedAndFiltered.map(po => {
              const total = Number(po.grandTotal || po.items?.reduce((s, i) => s + Number(i.totalWithGst || 0), 0) || 0);
              return (
                <tr key={po.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors">
                  <td className="px-4 py-3">
                    <button onClick={() => setSelectedPO(po)} className="font-mono font-bold text-indigo-600 dark:text-indigo-400 text-xs hover:underline">{po.poNo}</button>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">{po.prNo || '—'}</td>
                  <td className="px-4 py-3 font-semibold text-slate-800 dark:text-slate-200">{po.vendorName}</td>
                  <td className="px-4 py-3 text-xs text-slate-500">{po.poDate ? format(new Date(po.poDate), 'dd MMM yyyy') : '—'}</td>
                  <td className="px-4 py-3 text-xs text-slate-500">{po.deliveryDate ? format(new Date(po.deliveryDate), 'dd MMM yyyy') : '—'}</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{po.items?.length || 0}</td>
                  <td className="px-4 py-3 font-bold text-slate-900 dark:text-white">₹{total.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                  <td className="px-4 py-3 text-xs text-slate-500">{po.paymentTerms}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${STATUS_STYLES[po.status] || STATUS_STYLES.Draft}`}>{po.status}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" onClick={() => setSelectedPO(po)} className="h-8 w-8 rounded-lg text-slate-400 hover:text-indigo-600" title="View PO"><Eye className="w-4 h-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDownloadPOPDF(po, true)} className="h-8 w-8 rounded-lg text-slate-400 hover:text-indigo-600" title="Print PO"><Printer className="w-4 h-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDownloadPOPDF(po, false)} className="h-8 w-8 rounded-lg text-slate-400 hover:text-indigo-600" title="Download PDF"><Download className="w-4 h-4" /></Button>
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
