import React, { useMemo } from 'react';
import { Calculator, Sparkles, TrendingUp, DollarSign, Boxes, CheckCircle2 } from 'lucide-react';
import useAuthStore from '@/app/store/authStore';

export default function CostingSummaryFooter({
  subTotal = 0,
  wastagePct = 6,
  wastageAmt = 0,
  overheadPct = 10,
  overheadAmt = 0,
  grandTotal = 0,
  outputQty = 2000,
  outputUom = 'Nos',
  costPerUnit = 0,
  onWastagePctChange,
  onOverheadPctChange,
  isEditable = false,
  extraActionButtons = null
}) {
  const currentUser = useAuthStore(s => s.user);
  const isProductionRole = useMemo(() => {
    if (!currentUser) return false;
    const role = (currentUser.role || '').toUpperCase();
    const email = (currentUser.email || '').toLowerCase();
    if (role === 'MAIN_MASTER' || role === 'ADMIN' || role === 'SUPERVISOR') return false;
    return role === 'PRODUCTION_STAFF' || role === 'OPERATOR' || role.includes('PRODUCTION') || email.includes('production');
  }, [currentUser]);

  const canViewCosting = !isProductionRole;

  const formatIndianNumber = (num) => {
    const val = Number(num || 0);
    return val.toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl p-4 sm:p-5 shadow-lg space-y-4">
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
            {canViewCosting ? <Calculator className="w-4 h-4" /> : <Boxes className="w-4 h-4" />}
          </div>
          <span className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white uppercase tracking-wider">
            {canViewCosting ? 'Costing & Financial Summary' : 'Production Output Summary'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] text-slate-500 font-bold bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-xl">
            Target Output: <strong className="text-indigo-600 dark:text-indigo-400">{outputQty} {outputUom}</strong>
          </span>
        </div>
      </div>

      {canViewCosting ? (
        /* Full Financial Summary (For Admin / Supervisor / Main Master) */
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {/* 1. Sub Total */}
          <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Sub Total (Raw Materials)
            </span>
            <span className="font-mono text-sm sm:text-base font-extrabold text-slate-900 dark:text-white mt-1 block">
              ₹{formatIndianNumber(subTotal)}
            </span>
          </div>

          {/* 2. Wastage & Negation */}
          <div className="p-3 rounded-2xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-900/40">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider">
                Wastage
              </span>
              {isEditable && onWastagePctChange ? (
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={wastagePct}
                  onChange={(e) => onWastagePctChange(e.target.value)}
                  className="w-12 h-5 text-right font-mono text-[10px] font-bold bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-800 rounded px-1 text-amber-700 dark:text-amber-400"
                />
              ) : (
                <span className="font-mono text-[10px] font-bold text-amber-600">@{wastagePct}%</span>
              )}
            </div>
            <span className="font-mono text-sm sm:text-base font-extrabold text-amber-700 dark:text-amber-400 mt-1 block">
              ₹{formatIndianNumber(wastageAmt)}
            </span>
          </div>

          {/* 3. Overhead Cost */}
          <div className="p-3 rounded-2xl bg-purple-50/50 dark:bg-purple-950/20 border border-purple-200/50 dark:border-purple-900/40">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-purple-700 dark:text-purple-400 uppercase tracking-wider">
                Overhead
              </span>
              {isEditable && onOverheadPctChange ? (
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={overheadPct}
                  onChange={(e) => onOverheadPctChange(e.target.value)}
                  className="w-12 h-5 text-right font-mono text-[10px] font-bold bg-white dark:bg-slate-900 border border-purple-300 dark:border-purple-800 rounded px-1 text-purple-700 dark:text-purple-400"
                />
              ) : (
                <span className="font-mono text-[10px] font-bold text-purple-600">@{overheadPct}%</span>
              )}
            </div>
            <span className="font-mono text-sm sm:text-base font-extrabold text-purple-700 dark:text-purple-400 mt-1 block">
              ₹{formatIndianNumber(overheadAmt)}
            </span>
          </div>

          {/* 4. Grand Total */}
          <div className="p-3 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800">
            <span className="text-[10px] font-black text-indigo-700 dark:text-indigo-300 uppercase tracking-wider block">
              Grand Total
            </span>
            <span className="font-mono text-base sm:text-lg font-black text-indigo-700 dark:text-indigo-300 mt-1 block">
              ₹{formatIndianNumber(grandTotal)}
            </span>
          </div>

          {/* 5. Cost Per Unit */}
          <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 col-span-2 sm:col-span-1">
            <span className="text-[10px] font-black text-emerald-700 dark:text-emerald-300 uppercase tracking-wider block">
              Cost Per Unit
            </span>
            <span className="font-mono text-base sm:text-lg font-black text-emerald-700 dark:text-emerald-300 mt-1 block">
              ₹{formatIndianNumber(costPerUnit)} <span className="text-[10px] font-normal">/{outputUom}</span>
            </span>
          </div>
        </div>
      ) : (
        /* Operational Quantities Summary (For Production Staff / production@kulfi.com) */
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-3 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800">
            <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider block">
              Planned Output
            </span>
            <span className="font-mono text-lg font-black text-indigo-900 dark:text-indigo-200 mt-1 block">
              {outputQty} {outputUom}
            </span>
          </div>

          <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
              Wastage Allowance
            </span>
            <span className="font-mono text-sm font-bold text-slate-700 dark:text-slate-300 mt-1 block">
              {wastagePct}% standard buffer
            </span>
          </div>

          <div className="p-3 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block">
                Batch Execution Status
              </span>
              <span className="font-mono text-sm font-black text-emerald-700 dark:text-emerald-300 mt-0.5 block flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                Formulation Verified
              </span>
            </div>
          </div>
        </div>
      )}

      {extraActionButtons && (
        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
          {extraActionButtons}
        </div>
      )}
    </div>
  );
}
