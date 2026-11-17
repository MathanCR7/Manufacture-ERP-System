import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Factory, Play, PlusCircle, ArrowRight, User, Layers, Flame, Droplets } from 'lucide-react';
import FioriCard from './FioriCard';
import FioriStatusPill from './FioriStatusPill';
import { FioriSkeleton, FioriEmptyState, FioriErrorRetry } from './FioriStateHandlers';
import DashboardDatePeriodFilter from './DashboardDatePeriodFilter';

export default function ActiveBatchesPanel({
  data,
  batches,
  period = 'all_time',
  onPeriodChange,
  customRange,
  onCustomRangeChange,
  isLoading,
  error,
  onRetry,
  updatedAt
}) {
  const navigate = useNavigate();
  const batchList = (Array.isArray(data) && data.length > 0) ? data : (Array.isArray(batches) ? batches : []);

  return (
    <FioriCard
      eyebrow="Shop Floor Execution"
      title="Active Production Batches"
      icon={Factory}
      redirectRoute="/production/batches"
      updatedAt={updatedAt}
      action={
        <div className="flex flex-wrap items-center gap-1.5">
          <DashboardDatePeriodFilter
            activePeriod={period}
            onPeriodChange={onPeriodChange}
            customRange={customRange}
            onCustomRangeChange={onCustomRangeChange}
          />
          <button
            type="button"
            onClick={() => navigate('/production/standard/add')}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#0A6ED1] hover:bg-blue-700 text-white text-[10px] font-semibold transition-colors cursor-pointer shadow-xs whitespace-nowrap"
          >
            <Play className="w-3 h-3 fill-current" />
            <span>New Batch</span>
          </button>
        </div>
      }
    >
      {isLoading ? (
        <FioriSkeleton rows={4} height="h-48" />
      ) : error ? (
        <FioriErrorRetry error={error} onRetry={onRetry} />
      ) : (!batchList || batchList.length === 0) ? (
        <FioriEmptyState
          title="No Active Batches Running"
          message="There are currently no production batches in progress on the shop floor."
          actionButton={
            <button
              type="button"
              onClick={() => navigate('/production/standard/add')}
              className="px-3 py-1.5 rounded-lg bg-[#0A6ED1] text-white text-xs font-semibold cursor-pointer shadow-xs"
            >
              Start Formulation Batch
            </button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {batchList.map((batch) => {
            const stages = batch.stages || [
              'Mixing & Heating (VAT)',
              'Aging Tank (4°C)',
              'Continuous Freezer',
              'Mould Filling & Sticks',
              'Blast Hardening (-30°C)',
              'Flow-wrap Packaging',
              'Cold Room Storage'
            ];
            const currentIdx = batch.currentStageIndex ?? 2;

            return (
              <div
                key={batch.id}
                onClick={() => navigate(`/production/batches?cockpitBatchId=${batch.id}`)}
                className="bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/80 hover:border-[#0A6ED1] dark:hover:border-blue-500 rounded-lg p-3 flex flex-col justify-between shadow-2xs hover:shadow-sm transition-all duration-200 cursor-pointer group"
                title="Click to open Production Floor Cockpit"
              >
                {/* Header: Batch Ref & Day Badge */}
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="font-mono text-xs font-black text-[#0A6ED1] dark:text-blue-400 group-hover:underline">
                      {batch.referenceNo}
                    </span>
                    <div className="flex items-center gap-1">
                      <span className="px-1.5 py-0.2 rounded font-mono text-[9px] font-black bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-950 dark:text-indigo-300 dark:border-indigo-800">
                        Day {batch.activeDayNo} of {batch.totalDays} ({batch.dayBatchCode})
                      </span>
                      <FioriStatusPill status="In Execution" type="in-progress" size="xs" />
                    </div>
                  </div>

                  <div className="text-[13px] font-bold text-slate-800 dark:text-slate-100 truncate">
                    {batch.productName}
                  </div>
                  <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                    Planned Qty: <strong className="text-slate-700 dark:text-slate-300 font-mono">{batch.quantity?.toLocaleString('en-IN')} L</strong> • Done: <strong className="text-slate-700 dark:text-slate-300 font-mono">{batch.partiallyDoneQty?.toLocaleString('en-IN')} L</strong>
                  </div>
                </div>

                {/* 7-Segment Stage Stepper */}
                <div className="my-2.5">
                  <div className="flex items-center justify-between text-[10px] mb-1">
                    <span className="font-semibold text-slate-700 dark:text-slate-300 truncate">
                      Stage {currentIdx + 1}/7: {batch.currentStageName}
                    </span>
                    <span className="font-mono font-bold text-[#0A6ED1] dark:text-blue-400">
                      {batch.stageProgressPercent}%
                    </span>
                  </div>

                  <div className="grid grid-cols-7 gap-1" aria-label={`Stage stepper: currently at ${batch.currentStageName}`}>
                    {stages.map((st, sIdx) => {
                      const isPast = sIdx < currentIdx;
                      const isCurrent = sIdx === currentIdx;
                      return (
                        <div
                          key={sIdx}
                          title={`${sIdx + 1}. ${st}`}
                          className={`h-1.5 rounded-full transition-all ${
                            isPast
                              ? 'bg-[#107E3E]'
                              : isCurrent
                              ? 'bg-[#0A6ED1] animate-pulse'
                              : 'bg-slate-200 dark:bg-slate-700'
                          }`}
                        />
                      );
                    })}
                  </div>
                </div>

                {/* Mix Balance & Evaporation Radar */}
                <div className="grid grid-cols-3 gap-1.5 py-1.5 px-2 bg-white dark:bg-slate-900 rounded border border-slate-100 dark:border-slate-800 text-[9.5px]">
                  <div>
                    <div className="text-slate-400 text-[8.5px] uppercase font-bold flex items-center gap-0.5">
                      <Droplets className="w-2.5 h-2.5 text-blue-500" />
                      <span>Mix Prep</span>
                    </div>
                    <div className="font-mono font-bold text-slate-800 dark:text-slate-200 truncate">
                      {batch.openingMixMl?.toLocaleString('en-IN')} ml
                    </div>
                  </div>

                  <div>
                    <div className="text-slate-400 text-[8.5px] uppercase font-bold flex items-center gap-0.5">
                      <Layers className="w-2.5 h-2.5 text-emerald-500" />
                      <span>Allocated</span>
                    </div>
                    <div className="font-mono font-bold text-slate-800 dark:text-slate-200 truncate">
                      {batch.allocatedMixMl?.toLocaleString('en-IN')} ml
                    </div>
                  </div>

                  <div>
                    <div className="text-slate-400 text-[8.5px] uppercase font-bold flex items-center gap-0.5">
                      <Flame className="w-2.5 h-2.5 text-amber-500" />
                      <span>Tank Left</span>
                    </div>
                    <div className="font-mono font-bold text-indigo-600 dark:text-indigo-400 truncate">
                      {batch.remainingMixMl?.toLocaleString('en-IN')} ml
                    </div>
                  </div>
                </div>

                {/* Footer Operator Badge */}
                <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 mt-2 pt-1.5 border-t border-slate-200/60 dark:border-slate-700/60">
                  <span className="flex items-center gap-1">
                    <User className="w-3 h-3 text-slate-400" />
                    <span>Op: <strong>{batch.assignedOperator}</strong></span>
                  </span>
                  <span className="text-[9px] text-[#0A6ED1] dark:text-blue-400 font-bold flex items-center gap-0.5">
                    <span>Cockpit</span>
                    <ArrowRight className="w-2.5 h-2.5" />
                  </span>
                </div>
              </div>
            );
          })}

          {/* Filler Card to complete grid row (eliminates empty space) */}
          {batchList.length % 3 !== 0 && (
            <div
              onClick={() => navigate('/production/batches')}
              className="bg-slate-50/40 dark:bg-slate-800/20 border-2 border-dashed border-slate-200 dark:border-slate-800 hover:border-[#0A6ED1] dark:hover:border-blue-500 rounded-lg p-4 flex flex-col items-center justify-center text-center cursor-pointer transition-colors group min-h-[170px]"
            >
              <div className="p-2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 group-hover:text-[#0A6ED1] dark:group-hover:text-blue-400 transition-colors mb-2">
                <PlusCircle className="w-6 h-6" />
              </div>
              <div className="text-xs font-bold text-slate-700 dark:text-slate-200">
                View All Production Orders
              </div>
              <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                Check scheduled recipes or start next sequence
              </div>
            </div>
          )}
        </div>
      )}
    </FioriCard>
  );
}
