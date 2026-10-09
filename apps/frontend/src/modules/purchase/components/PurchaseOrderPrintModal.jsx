import React, { useEffect } from 'react';
import { 
  Printer, Download, X, Building2, Truck, Package, Calculator, 
  CreditCard, CheckCircle2, ShieldCheck, Lock, Calendar, Clock, 
  Tag, Scale, FileText, Phone, Mail, MapPin, Hash, AlertTriangle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { normalizePOData, exportPurchaseOrderToExcel } from '../utils/poExportPrintUtils';
import { generatePurchaseOrderPDF } from '../utils/purchaseOrderPdfGenerator';

export default function PurchaseOrderPrintModal({ isOpen, onClose, rawData }) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!isOpen) return;
      if (e.key === 'Escape') onClose();
      if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
        e.preventDefault();
        generatePurchaseOrderPDF(rawData);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, rawData]);

  if (!isOpen || !rawData) return null;

  const data = normalizePOData(rawData);

  const handleDownloadPdf = () => {
    generatePurchaseOrderPDF(rawData);
  };

  const handleExport = () => {
    exportPurchaseOrderToExcel(rawData);
  };

  return (
    <div className="fixed inset-0 z-[9999] overflow-y-auto bg-slate-950/80 backdrop-blur-sm flex flex-col items-center justify-start p-2 sm:p-4">
      {/* ── SCREEN ONLY FLOATING ACTION BAR ── */}
      <div className="w-full max-w-5xl bg-slate-900 border border-slate-700/80 rounded-2xl px-4 py-2.5 mb-3 flex flex-wrap items-center justify-between gap-3 shadow-2xl shrink-0 sticky top-2 z-50">
        <div className="flex items-center gap-2.5">
          <span className="p-1.5 rounded-lg bg-indigo-600 text-white font-bold">
            <FileText className="w-4 h-4" />
          </span>
          <div>
            <h2 className="text-xs sm:text-sm font-bold text-white flex items-center gap-2">
              <span>Purchase Order Preview</span>
              <span className="font-mono text-xs text-indigo-300 bg-indigo-950/80 px-2 py-0.5 rounded border border-indigo-800">
                {data.referenceNo}
              </span>
            </h2>
            <p className="text-[11px] text-slate-400">
              Download high-resolution PDF document & spreadsheet export
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Export to Excel */}
          <Button
            type="button"
            size="sm"
            onClick={handleExport}
            className="h-8 px-3 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl gap-1.5 shadow-sm cursor-pointer"
            title="Download formatted Excel (.xlsx) file"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export to Excel</span>
          </Button>

          {/* Download Complete PDF */}
          <Button
            type="button"
            size="sm"
            onClick={handleDownloadPdf}
            className="h-8 px-3.5 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl gap-1.5 shadow-sm cursor-pointer"
            title="Download complete Purchase Order PDF (Ctrl+P)"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download PDF (Ctrl+P)</span>
          </Button>

          {/* Close */}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-8 w-8 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl cursor-pointer"
            title="Close Preview"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* ── PRINTABLE FULL DOCUMENT CONTAINER ── */}
      <div 
        id="printable-po-document" 
        className="w-full max-w-5xl bg-white text-slate-900 border border-slate-300 rounded-2xl shadow-2xl p-6 sm:p-8 space-y-5 print:border-none print:shadow-none print:p-0 print:m-0 print:rounded-none print:max-w-none print:w-full print:text-black font-sans"
      >
        {/* Print Stylesheet Overrides */}
        <style dangerouslySetInnerHTML={{ __html: `
          @media print {
            body {
              visibility: visible !important;
              background: white !important;
            }
            .fixed.inset-0 {
              position: static !important;
              background: transparent !important;
              padding: 0 !important;
              overflow: visible !important;
            }
            #printable-po-document, #printable-po-document * {
              visibility: visible !important;
            }
            #printable-po-document {
              position: static !important;
              width: 100% !important;
              margin: 0 !important;
              padding: 10mm !important;
              box-shadow: none !important;
              border: none !important;
              background: white !important;
              color: black !important;
            }
            @page {
              size: A4 portrait;
              margin: 8mm;
            }
            .page-break-inside-avoid {
              page-break-inside: avoid !important;
              break-inside: avoid !important;
            }
          }
        `}} />

        {/* ── DOCUMENT TOP HEADER: COMPANY & PO BADGE ── */}
        <div className="flex flex-col sm:flex-row items-start justify-between gap-4 pb-4 border-b-2 border-slate-800">
          <div className="space-y-1 max-w-xl">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-6 bg-indigo-600 rounded-xs"></span>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 uppercase">
                {data.company.name}
              </h1>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              {data.company.address}
            </p>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600 pt-0.5">
              <span><strong>GSTIN:</strong> {data.company.gstin}</span>
              <span>•</span>
              <span><strong>PAN:</strong> {data.company.pan}</span>
              <span>•</span>
              <span><strong>Phone:</strong> {data.company.phone}</span>
            </div>
          </div>

          <div className="text-left sm:text-right shrink-0 bg-slate-50 border border-slate-200 rounded-xl p-3 sm:min-w-[220px]">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-md inline-block mb-1">
              Purchase Order
            </span>
            <div className="font-mono text-base font-extrabold text-slate-900 select-all">
              {data.referenceNo}
            </div>
            <div className="text-xs text-slate-500 mt-0.5">
              Date: <strong className="text-slate-800">{data.orderDate}</strong>
            </div>
            <div className="text-xs text-slate-500">
              Delivery: <strong className="text-slate-800">{data.expectedDelivery}</strong>
            </div>
            <div className="mt-1 flex items-center justify-start sm:justify-end gap-1.5">
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-slate-200 text-slate-800">
                <Lock className="w-2.5 h-2.5" /> {data.purchaseStatus}
              </span>
            </div>
          </div>
        </div>

        {/* ── SECTION 1 & 2: TWO COLUMNS (ORDER & SUPPLIER INFO + INVOICE & LOGISTICS) ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Section 1: Supplier & Order Information */}
          <div className="border border-slate-200 rounded-xl p-3.5 bg-slate-50/50 space-y-2 text-xs page-break-inside-avoid">
            <div className="flex items-center justify-between pb-1.5 border-b border-slate-200">
              <span className="font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-indigo-600" />
                1. Supplier & Order Information
              </span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                {data.taxRule}
              </span>
            </div>
            
            <div className="space-y-1">
              <div className="text-sm font-bold text-slate-900">{data.supplier.name}</div>
              {data.supplier.address && (
                <div className="text-slate-600 leading-snug">
                  <span className="font-semibold text-slate-700">Address:</span> {data.supplier.address}
                </div>
              )}
              <div className="grid grid-cols-2 gap-2 pt-1 text-[11px]">
                <div>
                  <span className="text-slate-500">Phone:</span> <strong className="text-slate-800">{data.supplier.phone}</strong>
                </div>
                <div>
                  <span className="text-slate-500">GSTIN:</span> <strong className="font-mono text-indigo-700">{data.supplier.gstin}</strong>
                </div>
                <div>
                  <span className="text-slate-500">PAN:</span> <strong className="font-mono text-slate-800">{data.supplier.pan}</strong>
                </div>
                <div>
                  <span className="text-slate-500">Workflow:</span> <strong className="text-slate-700">Locked</strong>
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Supplier Invoice & Transport / E-Way Bill Details */}
          <div className="border border-slate-200 rounded-xl p-3.5 bg-slate-50/50 space-y-2 text-xs page-break-inside-avoid">
            <div className="flex items-center justify-between pb-1.5 border-b border-slate-200">
              <span className="font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                <Truck className="w-3.5 h-3.5 text-indigo-600" />
                2. Supplier Invoice & Transport / E-Way Bill Details
              </span>
              <span className="text-[10px] text-slate-400">Logistics Audit</span>
            </div>

            <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px]">
              <div>
                <span className="text-slate-500">Supplier Invoice No:</span>
                <div className="font-mono font-bold text-slate-800">{data.logistics.supplierInvoiceNo}</div>
              </div>
              <div>
                <span className="text-slate-500">Invoice Date:</span>
                <div className="font-semibold text-slate-800">{data.logistics.supplierInvoiceDate}</div>
              </div>
              <div>
                <span className="text-slate-500">Transport Mode:</span>
                <div className="font-semibold text-slate-800">🚛 {data.logistics.transportMode}</div>
              </div>
              <div>
                <span className="text-slate-500">Vehicle No:</span>
                <div className="font-mono font-bold text-slate-800">{data.logistics.vehicleNumber}</div>
              </div>
              <div>
                <span className="text-slate-500">Transporter / LR:</span>
                <div className="font-semibold text-slate-800 truncate">{data.logistics.transporterName} / {data.logistics.lrNumber}</div>
              </div>
              <div>
                <span className="text-slate-500">E-Way Bill No:</span>
                <div className="font-mono font-bold text-indigo-700">{data.logistics.ewayBillNo}</div>
              </div>
              <div>
                <span className="text-slate-500">E-Way Bill Date:</span>
                <div className="text-slate-800 font-semibold">{data.logistics.ewayBillDate}</div>
              </div>
              <div>
                <span className="text-slate-500">Valid Till Date:</span>
                <div className="text-slate-800 font-semibold">{data.logistics.tillDate}</div>
              </div>
            </div>
          </div>
        </div>

        {/* ── SECTION 3: RAW MATERIALS & NON-INVENTORY ITEMS WITH BATCHES ── */}
        <div className="space-y-2">
          <div className="flex items-center justify-between pb-1 border-b border-slate-300">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
              <Package className="w-4 h-4 text-indigo-600" />
              3. Browse Raw Materials & Non-Inventory Items with Category & UOM
            </span>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-800 border border-slate-200">
                Added Items ({data.financials.totalItemsCount})
              </span>
              <span className="text-[11px] font-extrabold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                Total Qty: {data.financials.totalQuantity.toLocaleString('en-IN', { maximumFractionDigits: 3 })} units
              </span>
            </div>
          </div>

          {/* Items Table */}
          <div className="border border-slate-300 rounded-xl overflow-hidden shadow-2xs">
            <table className="w-full text-xs text-left border-collapse">
              <thead className="bg-slate-100 text-slate-800 font-bold uppercase tracking-wider text-[10px] border-b border-slate-300">
                <tr>
                  <th className="px-2 py-2 text-center w-10">#</th>
                  <th className="px-3 py-2 min-w-[200px]">Item / Category / UOM</th>
                  <th className="px-2 py-2 text-center w-24">Quantity</th>
                  <th className="px-2 py-2 text-right w-24">Unit Price (₹)</th>
                  <th className="px-2 py-2 text-center w-20">Tax Status</th>
                  <th className="px-2 py-2 text-center w-16">GST %</th>
                  <th className="px-2 py-2 text-center w-24">Lab Status</th>
                  <th className="px-3 py-2 text-right w-28">Subtotal (₹)</th>
                </tr>
              </thead>

              {data.items.map((item, idx) => (
                <tbody key={item.id || idx} className="border-b border-slate-200 page-break-inside-avoid">
                  {/* Item Main Row */}
                  <tr className="bg-white hover:bg-slate-50/50 transition-colors">
                    <td className="px-2 py-2 text-center font-bold text-slate-500">
                      {item.index}
                    </td>
                    <td className="px-3 py-2">
                      <div className="font-bold text-slate-900 text-xs">{item.name}</div>
                      <div className="flex items-center gap-2 text-[10px] text-slate-500 pt-0.5 font-mono">
                        <span className="font-semibold text-indigo-700">{item.code}</span>
                        <span>•</span>
                        <span>{item.category}</span>
                        <span>•</span>
                        <span className="uppercase font-bold">{item.uom}</span>
                      </div>
                    </td>
                    <td className="px-2 py-2 text-center font-bold text-slate-900">
                      <div>{item.quantity}</div>
                      <div className="text-[10px] text-slate-500 font-normal uppercase">{item.uom}</div>
                    </td>
                    <td className="px-2 py-2 text-right font-medium text-slate-800">
                      ₹{item.unitPrice.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-2 py-2 text-center">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${
                        item.taxStatus === 'GST (Yes)' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-slate-100 text-slate-600 border-slate-200'
                      }`}>
                        {item.taxStatus}
                      </span>
                    </td>
                    <td className="px-2 py-2 text-center font-bold text-slate-800">
                      <span className="bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded text-[10.5px]">
                        {item.gstPercent}%
                      </span>
                    </td>
                    <td className="px-2 py-2 text-center">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${
                        item.labTestStatus === 'Lab Required' 
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-300' 
                          : 'bg-rose-50 text-rose-800 border-rose-300'
                      }`}>
                        {item.labTestStatus}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right font-bold text-slate-900">
                      <div>₹{item.subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                      <div className="text-[10px] text-slate-500 font-normal">
                        = ₹{item.unitPrice.toFixed(2)}/{item.uom}
                      </div>
                    </td>
                  </tr>

                  {/* Nested Batches Breakdown Row */}
                  {item.batches && item.batches.length > 0 && (
                    <tr className="bg-indigo-50/20 border-t border-dashed border-indigo-200">
                      <td colSpan={8} className="px-4 py-2.5">
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2 text-[10.5px]">
                            <span className="font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1">
                              <Package className="w-3.5 h-3.5 text-indigo-600" />
                              BATCHES ({item.batches.length} {item.batches.length === 1 ? 'BATCH' : 'BATCHES'})
                            </span>
                            <span className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 text-[10px]">
                              All {item.quantity} {item.uom} Allocated
                            </span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 pt-0.5">
                            {item.batches.map((b) => (
                              <div 
                                key={b.batchIndex}
                                className="bg-white border border-indigo-100 rounded-lg p-2.5 text-[11px] space-y-1.5 shadow-2xs relative overflow-hidden"
                              >
                                <div className="absolute top-0 left-0 bottom-0 w-1 bg-indigo-600 rounded-l" />
                                <div className="flex items-center justify-between border-b border-slate-100 pb-1 pl-1.5">
                                  <span className="font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.2 rounded text-[10px]">#{b.batchIndex}</span>
                                  <span className="font-mono font-bold text-slate-900 text-xs">Our Batch: {b.batchNumber}</span>
                                </div>
                                <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[10px] pl-1.5">
                                  <div>
                                    <span className="text-slate-500">Batch Qty:</span> <strong className="text-slate-900">{b.quantity} {item.uom}</strong>
                                  </div>
                                  <div>
                                    <span className="text-slate-500">Weight:</span> <strong className="text-slate-900">{b.weight || '—'}</strong>
                                  </div>
                                  <div>
                                    <span className="text-slate-500">MFG Batch:</span> <strong className="font-mono text-slate-900">{b.mfgBatchNo || '—'}</strong>
                                  </div>
                                  <div>
                                    <span className="text-slate-500">MFG Date:</span> <strong className="text-slate-900">{b.mfgDate || '—'}</strong>
                                  </div>
                                  <div className="col-span-2">
                                    <span className="text-slate-500">Exp Date:</span> <strong className="text-rose-600 font-medium">{b.expDate || '—'}</strong>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              ))}
            </table>
          </div>
        </div>

        {/* ── SECTION 4 & 5: FINANCIAL SUMMARY & PAYMENT DETAILS (TWO COLUMNS) ── */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 page-break-inside-avoid">
          {/* Section 5: Payment & Settlement Details (Left, 5 cols) */}
          <div className="md:col-span-5 border border-slate-200 rounded-xl p-3.5 bg-slate-50/50 space-y-2.5 text-xs">
            <div className="flex items-center justify-between pb-1.5 border-b border-slate-200">
              <span className="font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                <CreditCard className="w-3.5 h-3.5 text-indigo-600" />
                5. Payment & Settlement Details
              </span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                data.payment.paymentStatus === 'PAID'
                  ? 'bg-emerald-100 text-emerald-800'
                  : (data.payment.paymentStatus === 'PARTIAL' ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800')
              }`}>
                {data.payment.paymentStatus}
              </span>
            </div>

            <div className="space-y-1.5 text-[11.5px]">
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Total Payable:</span>
                <span className="font-bold text-slate-900">₹{data.payment.totalPayable.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Amount Paid:</span>
                <span className="font-bold text-emerald-700">₹{data.payment.paidAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between items-center pt-1 border-t border-slate-200">
                <span className="font-bold text-slate-700">Balance Due:</span>
                <span className="font-bold text-rose-700">₹{data.payment.balanceDue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between items-center text-[10.5px]">
                <span className="text-slate-500">Payment Channel:</span>
                <span className="font-semibold text-slate-800">{data.payment.paymentMode}</span>
              </div>
              {data.payment.paymentRef && data.payment.paymentRef !== '—' && (
                <div className="flex justify-between items-center text-[10.5px]">
                  <span className="text-slate-500">Transaction Ref:</span>
                  <span className="font-mono font-semibold text-slate-800">{data.payment.paymentRef}</span>
                </div>
              )}
            </div>

            {data.notes && data.notes !== '—' && (
              <div className="pt-2 border-t border-slate-200">
                <span className="text-[10.5px] font-bold text-slate-600">Supplier Instructions / Remarks:</span>
                <p className="text-[11px] text-slate-700 italic bg-white p-2 rounded border border-slate-200 mt-1">
                  "{data.notes}"
                </p>
              </div>
            )}
          </div>

          {/* Section 4: Charges & Financial Summary (Right, 7 cols) */}
          <div className="md:col-span-7 border border-slate-300 rounded-xl p-3.5 bg-gradient-to-br from-slate-50 to-indigo-50/20 space-y-2 text-xs">
            <div className="flex items-center justify-between pb-1.5 border-b border-slate-300">
              <span className="font-bold uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
                <Calculator className="w-3.5 h-3.5 text-indigo-600" />
                4. Charges & Financial Summary
              </span>
              <span className="font-mono text-[10.5px] font-semibold text-slate-600">INR (₹)</span>
            </div>

            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-slate-600">
                  Items Subtotal ({data.financials.totalItemsCount} items • Total Qty: {data.financials.totalQuantity.toLocaleString('en-IN', { maximumFractionDigits: 3 })}):
                </span>
                <span className="font-bold text-slate-900">
                  ₹{data.financials.subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-slate-600">Taxable Value:</span>
                <span className="font-bold text-slate-900">
                  ₹{data.financials.taxableValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>

              {data.financials.discount > 0 && (
                <div className="flex justify-between items-center text-emerald-700">
                  <span>Trade Discount:</span>
                  <span className="font-semibold">-₹{data.financials.discount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
              )}

              {data.financials.shipping > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-slate-600">
                    Freight & Shipping {data.financials.shippingGstApplicable ? `(+${data.financials.shippingGstPercentage}% GST)` : ''}:
                  </span>
                  <span className="font-semibold">₹{data.financials.shipping.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
              )}

              {data.financials.otherCharges > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-slate-600">
                    {data.financials.otherChargesLabel || 'Other Charges'} {data.financials.otherChargesGstApplicable ? `(+${data.financials.otherChargesGstPercentage}% GST)` : ''}:
                  </span>
                  <span className="font-semibold">₹{data.financials.otherCharges.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
              )}

              {data.isInterState ? (
                <div className="flex justify-between items-center text-indigo-700">
                  <span>{data.financials.igstLabel || 'IGST (Interstate)'}:</span>
                  <span className="font-semibold">₹{data.financials.igstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
              ) : (
                <>
                  <div className="flex justify-between items-center text-slate-700">
                    <span>{data.financials.cgstLabel || 'CGST (Intrastate)'}:</span>
                    <span className="font-semibold">₹{data.financials.cgstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between items-center text-slate-700">
                    <span>{data.financials.sgstLabel || 'SGST (Intrastate)'}:</span>
                    <span className="font-semibold">₹{data.financials.sgstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                </>
              )}

              {data.financials.roundOff !== 0 && (
                <div className="flex justify-between items-center text-slate-500 text-[11px]">
                  <span>Round Off:</span>
                  <span>{data.financials.roundOff > 0 ? `+₹${data.financials.roundOff.toFixed(2)}` : `-₹${Math.abs(data.financials.roundOff).toFixed(2)}`}</span>
                </div>
              )}

              <div className="flex justify-between items-center pt-2 border-t-2 border-slate-800 text-sm font-black text-slate-900">
                <div>
                  <div>Grand Total</div>
                  <div className="text-[10px] font-normal text-slate-500">Includes all taxes & delivery</div>
                </div>
                <div className="text-base font-black text-indigo-700">
                  ₹{data.financials.grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
              </div>

              <div className="p-2 bg-white rounded-lg border border-slate-200 text-[11px] text-slate-700 leading-snug">
                <span className="font-bold text-slate-900">Amount in Words: </span>
                <span className="italic">{data.financials.amountInWords}</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── SECTION 6: TERMS & AUTHORIZED SIGNATURES ── */}
        <div className="pt-3 border-t border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-4 text-center text-xs page-break-inside-avoid">
          <div className="space-y-6">
            <span className="text-[10px] text-slate-500 uppercase font-semibold">Prepared By</span>
            <div className="border-t border-slate-300 pt-1 font-bold text-slate-800">{data.creator}</div>
          </div>

          <div className="space-y-6">
            <span className="text-[10px] text-slate-500 uppercase font-semibold">Verified By QC</span>
            <div className="border-t border-slate-300 pt-1 font-bold text-slate-800">Quality Manager</div>
          </div>

          <div className="space-y-6">
            <span className="text-[10px] text-slate-500 uppercase font-semibold">Authorized Signatory</span>
            <div className="border-t border-slate-300 pt-1 font-bold text-slate-800">Factory Manager</div>
          </div>

          <div className="space-y-6">
            <span className="text-[10px] text-slate-500 uppercase font-semibold">Supplier Acknowledgment</span>
            <div className="border-t border-slate-300 pt-1 font-bold text-slate-800">{data.supplier.name.slice(0, 18)}</div>
          </div>
        </div>

        {/* Print Footer Notice */}
        <div className="text-center text-[10px] text-slate-400 pt-2 border-t border-dashed border-slate-200">
          Computer Generated Purchase Order · {data.company.name} · Certified ERP Document · Printed: {new Date().toLocaleString('en-IN')}
        </div>
      </div>
    </div>
  );
}
