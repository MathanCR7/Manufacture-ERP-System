import React, { useState, useEffect } from 'react';
import { api } from '@/lib/axios';
import { formatINR, formatDate, renderPaymentStatusChip, renderFulfilmentChip } from '@/utils/financeFormatters';
import { 
  X, CreditCard, RotateCcw, Clock, CheckCircle2, 
  ExternalLink, FileSpreadsheet, ShieldAlert, ArrowRight,
  ChevronRight, Calendar, User, Hash, Layers
} from 'lucide-react';
import Swal from 'sweetalert2';

export default function DocumentDetailDrawer({ isOpen, onClose, doc, onRecordPayment, onRefresh }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen || !doc) return;
    setLoading(true);

    api.get(`/finance/documents/${doc.doc_type}/${doc.doc_id}`)
      .then(res => {
        if (res.data?.success) {
          setDetail(res.data.data);
        }
      })
      .catch(err => {
        console.error('Error fetching document detail:', err);
      })
      .finally(() => setLoading(false));
  }, [isOpen, doc]);

  if (!isOpen || !doc) return null;

  const header = detail?.header || doc;
  const lineItems = detail?.lineItems || [];
  const paymentAllocations = detail?.paymentAllocations || [];
  const linkedTimeline = detail?.linkedTimeline || [];

  const handleReversePayment = async (paymentId, paymentNo) => {
    const { value: reason } = await Swal.fire({
      title: 'Reverse Payment?',
      text: `Are you sure you want to reverse ${paymentNo}? This will restore the bill's open balance.`,
      input: 'text',
      inputPlaceholder: 'Enter reversal reason / remark',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#e11d48',
      confirmButtonText: 'Yes, Reverse Payment',
      cancelButtonText: 'Cancel'
    });

    if (reason !== undefined) {
      try {
        const res = await api.post(`/finance/payments/${paymentId}/reverse`, { reason });
        if (res.data?.success) {
          Swal.fire('Reversed', res.data.message, 'success');
          if (onRefresh) onRefresh();
          onClose();
        }
      } catch (err) {
        Swal.fire('Error', err.response?.data?.error || err.message, 'error');
      }
    }
  };

  const progressPct = Math.min(100, Math.round((Number(header.paid_amount) / Math.max(1, Number(header.grand_total))) * 100));

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      <div 
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-2xs transition-opacity animate-in fade-in" 
        onClick={onClose} 
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-2xl bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col overflow-hidden text-xs">
          
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-sm text-slate-900 dark:text-white">
                  {header.doc_no}
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                  {header.doc_type}
                </span>
                {renderPaymentStatusChip(header.payment_status, header.is_overdue, header.overdue_days)}
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Party: <strong>{header.party_name}</strong> • Issued: {formatDate(header.doc_date)} • Due: {formatDate(header.due_date)}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body Content */}
          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            {/* Progress & Financial Balance Strip */}
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span>Payment Settlement Progress</span>
                <span className="font-bold">{progressPct}% Settled</span>
              </div>
              <div className="w-full h-2.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                <div 
                  className={`h-full transition-all duration-500 ${
                    progressPct === 100 ? 'bg-emerald-500' : progressPct > 0 ? 'bg-amber-500' : 'bg-slate-400'
                  }`}
                  style={{ width: `${progressPct}%` }}
                />
              </div>

              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-200/80 dark:border-slate-800 text-center">
                <div>
                  <div className="text-[10px] uppercase font-bold text-slate-400">Total Billed</div>
                  <div className="text-sm font-extrabold text-slate-900 dark:text-white mt-0.5">
                    {formatINR(header.grand_total)}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase font-bold text-slate-400">Total Paid</div>
                  <div className="text-sm font-extrabold text-emerald-600 mt-0.5">
                    {formatINR(header.paid_amount)}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase font-bold text-slate-400">Balance Due</div>
                  <div className="text-sm font-extrabold text-rose-600 mt-0.5">
                    {formatINR(header.balance)}
                  </div>
                </div>
              </div>
            </div>

            {/* Tax & Amounts Breakdown */}
            <div className="border border-slate-200 dark:border-slate-800 rounded-lg p-3 space-y-1.5">
              <h4 className="font-bold text-[11px] uppercase tracking-wider text-slate-700 dark:text-slate-300 pb-1 border-b border-slate-100 dark:border-slate-800">
                Tax & Charges Breakdown
              </h4>
              <div className="flex justify-between py-0.5">
                <span className="text-slate-500">Subtotal (Excl. Tax):</span>
                <span className="font-medium">{formatINR(header.subtotal)}</span>
              </div>
              <div className="flex justify-between py-0.5">
                <span className="text-slate-500">CGST (Central):</span>
                <span>{formatINR(header.tax_cgst)}</span>
              </div>
              <div className="flex justify-between py-0.5">
                <span className="text-slate-500">SGST (State):</span>
                <span>{formatINR(header.tax_sgst)}</span>
              </div>
              <div className="flex justify-between py-0.5">
                <span className="text-slate-500">IGST (Interstate):</span>
                <span>{formatINR(header.tax_igst)}</span>
              </div>
              {Number(header.other_charges) > 0 && (
                <div className="flex justify-between py-0.5">
                  <span className="text-slate-500">Freight & Other Charges:</span>
                  <span>{formatINR(header.other_charges)}</span>
                </div>
              )}
              {Number(header.round_off) !== 0 && (
                <div className="flex justify-between py-0.5">
                  <span className="text-slate-500">Round-Off Adjustment:</span>
                  <span>{formatINR(header.round_off)}</span>
                </div>
              )}
              <div className="flex justify-between py-1.5 border-t border-slate-200 dark:border-slate-800 font-bold text-sm text-slate-900 dark:text-white">
                <span>Grand Total:</span>
                <span>{formatINR(header.grand_total)}</span>
              </div>
            </div>

            {/* Line Items Table */}
            <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
              <div className="px-3 py-2 bg-slate-100 dark:bg-slate-800 font-bold text-slate-800 dark:text-slate-200">
                Line Items ({lineItems.length})
              </div>
              <div className="max-h-40 overflow-y-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 dark:bg-slate-900 text-[10px] text-slate-400 uppercase font-bold border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="py-1 px-3">Item / Description</th>
                      <th className="py-1 px-2 text-right">Quantity</th>
                      <th className="py-1 px-2 text-right">Rate</th>
                      <th className="py-1 px-3 text-right">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {lineItems.map((it, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <td className="py-1.5 px-3 font-medium">
                          {it.name || it.rmId || it.assetName || it.product?.name || it.title || 'Item'}
                        </td>
                        <td className="py-1.5 px-2 text-right text-slate-600 dark:text-slate-400">
                          {it.quantity || it.weight || 1} {it.uomLabel || it.unit || ''}
                        </td>
                        <td className="py-1.5 px-2 text-right text-slate-600 dark:text-slate-400">
                          {formatINR(it.unitPrice || it.unitRate || it.rate || it.price || 0)}
                        </td>
                        <td className="py-1.5 px-3 text-right font-semibold">
                          {formatINR(it.subtotal || it.total || it.amount || 0)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Payment Allocations Ledger */}
            <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2 bg-slate-100 dark:bg-slate-800">
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  Payments Applied ({paymentAllocations.length})
                </span>
                {Number(header.balance) > 1 && (
                  <button
                    onClick={() => {
                      onClose();
                      if (onRecordPayment) onRecordPayment(header);
                    }}
                    className="px-2 py-0.5 text-[11px] font-bold bg-emerald-600 text-white rounded hover:bg-emerald-700 transition-colors shadow-2xs"
                  >
                    + Record Payment
                  </button>
                )}
              </div>

              {paymentAllocations.length === 0 ? (
                <div className="p-4 text-center text-slate-400">
                  No payments have been applied to this document yet.
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {paymentAllocations.map(p => (
                    <div key={p.allocation_id} className="p-3 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 dark:text-white">
                            {p.payment_no}
                          </span>
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-200 dark:bg-slate-700">
                            {p.payment_mode}
                          </span>
                          <span className="text-slate-400 text-[11px]">{formatDate(p.pay_date)}</span>
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          Account: {p.account_name} {p.reference_no ? `• Ref: ${p.reference_no}` : ''}
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <div className="font-extrabold text-sm text-emerald-600">
                            {formatINR(p.allocated_amount)}
                          </div>
                          <span className="text-[10px] text-slate-400 uppercase">{p.allocation_kind}</span>
                        </div>
                        {!p.is_reversed && (
                          <button
                            onClick={() => handleReversePayment(p.payment_id, p.payment_no)}
                            title="Reverse Payment"
                            className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950 transition-colors"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Linked Documents Lifecycle Timeline */}
            <div className="border border-slate-200 dark:border-slate-800 rounded-lg p-3 space-y-2">
              <h4 className="font-bold text-[11px] uppercase tracking-wider text-slate-700 dark:text-slate-300 pb-1 border-b border-slate-100 dark:border-slate-800">
                End-to-End Audit & Lifecycle Timeline
              </h4>
              <div className="space-y-3 pt-1">
                {linkedTimeline.map((step, idx) => (
                  <div key={idx} className="flex items-start gap-2.5">
                    <div className="mt-0.5 p-1 rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400 border border-emerald-200">
                      <CheckCircle2 className="w-3 h-3" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-800 dark:text-slate-200">{step.title}</span>
                        <span className="text-slate-400 text-[10px]">{formatDate(step.date)}</span>
                      </div>
                      <p className="text-slate-500 text-[11px]">{step.details}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* Footer Actions */}
          <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 flex items-center justify-between">
            <span className="text-slate-400 text-[11px]">Audit Tracked & Immutable</span>
            <div className="flex gap-2">
              <button
                onClick={onClose}
                className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 font-bold hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
              >
                Close
              </button>
              {Number(header.balance) > 1 && (
                <button
                  onClick={() => {
                    onClose();
                    if (onRecordPayment) onRecordPayment(header);
                  }}
                  className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition-all shadow-md flex items-center gap-1.5"
                >
                  <CreditCard className="w-3.5 h-3.5" />
                  Settle Payment
                </button>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
