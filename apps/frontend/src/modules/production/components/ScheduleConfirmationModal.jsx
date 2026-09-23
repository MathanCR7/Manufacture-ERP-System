import React from 'react';
import { 
  Play, X, AlertTriangle, ShieldCheck, CheckCircle2, Factory, 
  Layers, Package, Calendar, IndianRupee, ArrowRight 
} from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function ScheduleConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  submitting = false,
  product,
  quantity,
  triggerType,
  startDate,
  bomItems = [],
  totalCost = 0,
  order = null,
  occasion = '',
  authorizedBy = ''
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate__animated animate__fadeIn animate__faster">
      <div 
        className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden animate__animated animate__zoomIn animate__faster"
        role="dialog"
        aria-modal="true"
      >
        {/* Modal Header */}
        <div className="p-5 pb-4 border-b border-slate-100 dark:border-slate-800 bg-gradient-to-r from-indigo-50/70 via-white to-slate-50 dark:from-slate-900 dark:via-indigo-950/20 dark:to-slate-900 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-600/20 shrink-0">
              <Play className="w-5 h-5 ml-0.5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                Confirm Immediate Batch Execution
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Raw materials will be locked and deducted from warehouse stock immediately.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto text-xs">
          {/* Target Product Summary Banner */}
          <div className="p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-750 rounded-2xl flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 border border-slate-200 dark:border-slate-700 flex items-center justify-center overflow-hidden shrink-0">
                {product?.imageUrl ? (
                  <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
                ) : (
                  <Package className="w-5 h-5 text-indigo-500" />
                )}
              </div>
              <div className="min-w-0">
                <span className="font-bold text-slate-900 dark:text-white block truncate text-xs">
                  {product?.name}
                </span>
                <span className="text-[10px] text-slate-400 font-mono">
                  {product?.code} • {product?.category?.name || 'Finished Product'}
                </span>
              </div>
            </div>

            <div className="text-right shrink-0">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Yield Batch</span>
              <span className="font-black text-sm text-indigo-600 dark:text-indigo-400 font-mono">
                {quantity} {product?.unit?.abbreviation || 'pcs'}
              </span>
            </div>
          </div>

          {/* Key Parameters Matrix */}
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div className="p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-950">
              <span className="text-slate-400 text-[9px] uppercase font-bold block">Trigger Mode</span>
              <span className="font-bold text-slate-800 dark:text-slate-200 mt-0.5 block">
                {triggerType}
              </span>
            </div>
            <div className="p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-950">
              <span className="text-slate-400 text-[9px] uppercase font-bold block">Scheduled Start</span>
              <span className="font-bold text-slate-800 dark:text-slate-200 mt-0.5 block">
                {startDate ? new Date(startDate).toLocaleDateString('en-GB') : 'Today'}
              </span>
            </div>
            {order && (
              <div className="p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-950 col-span-2">
                <span className="text-slate-400 text-[9px] uppercase font-bold block">Linked Order</span>
                <span className="font-bold text-slate-800 dark:text-slate-200 mt-0.5 block truncate">
                  {order.referenceNo} — {order.customer?.name}
                </span>
              </div>
            )}
            {occasion && (
              <div className="p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-950 col-span-2">
                <span className="text-slate-400 text-[9px] uppercase font-bold block">Occasion / Reason</span>
                <span className="font-bold text-slate-800 dark:text-slate-200 mt-0.5 block truncate">
                  {occasion} {authorizedBy ? `(Auth: ${authorizedBy})` : ''}
                </span>
              </div>
            )}
          </div>

          {/* Raw Materials to be Locked Table */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px] font-bold text-slate-700 dark:text-slate-300">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                Raw Materials to be Locked & Reserved ({bomItems.length})
              </span>
              <span className="text-[10px] text-slate-400">All materials sufficient</span>
            </div>

            <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden divide-y divide-slate-100 dark:divide-slate-800 max-h-40 overflow-y-auto">
              {bomItems.map((item, idx) => (
                <div key={idx} className="p-2 px-3 flex items-center justify-between text-[11px] hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <div className="truncate pr-2">
                    <span className="font-semibold text-slate-800 dark:text-slate-200 block truncate">
                      {item.rawMaterialName}
                    </span>
                    <span className="text-[9px] text-slate-400 font-mono">
                      Avail: {Number(item.availableStock).toFixed(2)} → After: {(Number(item.availableStock) - Number(item.requiredQty)).toFixed(2)} {item.unit || ''}
                    </span>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="font-bold font-mono text-slate-900 dark:text-white block">
                      {Number(item.requiredQty).toFixed(2)} {item.unit || ''}
                    </span>
                    <span className="text-[9px] text-slate-400 font-mono">
                      ₹{(Number(item.requiredQty) * Number(item.unitCost || 0)).toFixed(2)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Grand Total Cost Bar */}
          <div className="p-3 bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/80 rounded-2xl flex items-center justify-between">
            <span className="font-bold text-indigo-900 dark:text-indigo-200 text-xs">
              Total Input Material Cost
            </span>
            <span className="font-mono font-black text-base text-indigo-700 dark:text-indigo-300">
              ₹{Number(totalCost).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>

          <div className="p-2.5 bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-900/40 rounded-xl flex items-start gap-2 text-amber-800 dark:text-amber-300 text-[10px]">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
            <span>
              This will create the batch with status <strong>"In Progress"</strong> and immediately reserve the calculated ingredients. Batch operators can log processing stages right away.
            </span>
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 flex items-center justify-end gap-2.5">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={submitting}
            className="rounded-xl text-xs font-semibold h-9 px-4 cursor-pointer"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={onConfirm}
            disabled={submitting}
            className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold h-9 px-5 shadow-sm shadow-indigo-600/30 cursor-pointer flex items-center gap-1.5 transition-all"
          >
            {submitting ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Starting Batch...
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5" />
                Confirm & Start Batch
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
