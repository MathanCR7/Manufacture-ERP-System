import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Package, Plus, AlertTriangle, ArrowRight } from 'lucide-react';
import FioriCard from './FioriCard';
import FioriStatusPill from './FioriStatusPill';
import { FioriSkeleton, FioriEmptyState, FioriErrorRetry } from './FioriStateHandlers';

const formatRupees = (val) => {
  const num = Number(val || 0);
  if (num >= 10000000) return `₹${(num / 10000000).toFixed(2)} Cr`;
  if (num >= 100000) return `₹${(num / 100000).toFixed(2)} L`;
  return `₹${num.toLocaleString('en-IN')}`;
};

export default function RmHealthPanel({ data, rmHealth, isLoading, isError, error, onRetry, updatedAt }) {
  const navigate = useNavigate();
  const d = data || rmHealth || {};

  const totalQty = d.totalRmStockQty || 0;
  const totalVal = d.totalRmValuation || 0;
  const totalItems = d.totalRawMaterials || 0;
  const counts = d.statusCounts || { critical: 0, low: 0, healthy: 0 };
  const atRisk = Array.isArray(d.atRiskMaterials) ? d.atRiskMaterials : [];

  const totalCategorized = (counts.critical + counts.low + counts.healthy) || 1;
  const critPct = Math.round((counts.critical / totalCategorized) * 100);
  const lowPct = Math.round((counts.low / totalCategorized) * 100);
  const healthyPct = 100 - critPct - lowPct;

  return (
    <FioriCard
      eyebrow="Raw Materials Inventory"
      title="RM Stock Health & Valuation"
      icon={Package}
      redirectRoute="/purchase/rm-low-stock"
      updatedAt={updatedAt}
    >
      {isLoading ? (
        <FioriSkeleton rows={5} height="h-72" />
      ) : error ? (
        <FioriErrorRetry error={error} onRetry={onRetry} />
      ) : (
        <div className="flex-1 flex flex-col justify-between space-y-3">
          {/* Top Metric Cards Row */}
          <div className="grid grid-cols-2 gap-2 bg-slate-50/70 dark:bg-slate-800/40 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700/80">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Total RM Available Qty
              </div>
              <div className="text-base sm:text-lg font-mono font-black text-slate-900 dark:text-slate-100">
                {totalQty.toLocaleString('en-IN')} <span className="text-[11px] font-normal text-slate-500">units/kg</span>
              </div>
              <div className="text-[10px] text-slate-400">{totalItems} active catalog items</div>
            </div>

            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Total RM Valuation
              </div>
              <div className="text-base sm:text-lg font-mono font-black text-[#107E3E] dark:text-emerald-400">
                {formatRupees(totalVal)}
              </div>
              <div className="text-[10px] text-slate-400">Weighted inventory cost</div>
            </div>
          </div>

          {/* Critical / Low / Healthy Stacked Meter */}
          <div>
            <div className="flex items-center justify-between text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
              <span>Stock Status Distribution</span>
              <span className="text-[10px] text-slate-400">
                {counts.critical} Critical • {counts.low} Low • {counts.healthy} Healthy
              </span>
            </div>
            <div className="w-full h-2 rounded-full overflow-hidden flex bg-slate-100 dark:bg-slate-800" aria-label="Stock status distribution">
              <div style={{ width: `${critPct}%` }} className="bg-[#BB0000] h-full" title={`Critical: ${counts.critical}`} />
              <div style={{ width: `${lowPct}%` }} className="bg-[#A65800] h-full" title={`Low: ${counts.low}`} />
              <div style={{ width: `${healthyPct}%` }} className="bg-[#107E3E] h-full" title={`Healthy: ${counts.healthy}`} />
            </div>
          </div>

          {/* At-Risk Materials Table with Raise PO Action */}
          <div className="flex-1 overflow-x-auto">
            <table className="w-full text-left text-xs whitespace-nowrap" aria-label="At Risk Raw Materials">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700/80 text-[10px] font-bold text-slate-500 uppercase">
                  <th className="py-1 px-1">Raw Material</th>
                  <th className="py-1 px-1">Current Stock</th>
                  <th className="py-1 px-1">Alert Level</th>
                  <th className="py-1 px-1">Rate</th>
                  <th className="py-1 px-1 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {atRisk.slice(0, 4).map((rm) => (
                  <tr key={rm.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                    <td className="py-1.5 px-1 truncate max-w-[130px]">
                      <div className="font-semibold text-slate-800 dark:text-slate-200 truncate">{rm.name}</div>
                      <div className="font-mono text-[9.5px] text-slate-400">{rm.code}</div>
                    </td>
                    <td className="py-1.5 px-1 font-mono font-bold text-rose-600 dark:text-rose-400">
                      {rm.currentStock?.toLocaleString('en-IN')} {rm.uom}
                    </td>
                    <td className="py-1.5 px-1 font-mono text-slate-500">
                      {rm.alertLevel?.toLocaleString('en-IN')} {rm.uom}
                    </td>
                    <td className="py-1.5 px-1 font-mono text-slate-700 dark:text-slate-300">
                      ₹{rm.ratePerUnit?.toFixed(2)}
                    </td>
                    <td className="py-1.5 px-1 text-right">
                      <button
                        type="button"
                        onClick={() => navigate(`/purchase-orders/create?rmId=${rm.id}&name=${encodeURIComponent(rm.name)}`)}
                        className="px-2 py-0.5 rounded bg-amber-50 hover:bg-amber-100 border border-amber-300 dark:bg-amber-950 dark:border-amber-700 text-[#A65800] dark:text-amber-300 text-[10px] font-bold cursor-pointer transition-colors"
                        title="Prefill new purchase order for this item"
                      >
                        Raise PO
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </FioriCard>
  );
}
