import React from 'react';
import { Database, CheckCircle2 } from 'lucide-react';

export default function ProductionBasePicker({
  bases = [],
  selectedBaseId = '',
  onSelectBase,
  disabled = false,
  showHeader = false
}) {
  const activeBases = bases.filter(b => b.status === 'ACTIVE' || !b.status);

  return (
    <div className="space-y-3">
      {showHeader && (
        <div className="flex items-center justify-between pb-1 border-b border-[#E3E6EC] dark:border-slate-800">
          <label className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
            <Database className="w-3.5 h-3.5 text-[#4F46E5]" />
            <span>Select Base Master</span>
            <span className="text-rose-500">*</span>
          </label>
          <span className="text-xs text-slate-500 font-semibold">
            {activeBases.length} Bases Available
          </span>
        </div>
      )}

      {/* 3 selectable option cards: [FDB] FD Base, [ICB] Ice Cream Base, [KLB] Kulfi Base */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
        {activeBases.map((base) => {
          const isSelected = selectedBaseId === base.id;

          return (
            <button
              key={base.id}
              type="button"
              disabled={disabled}
              onClick={() => onSelectBase(base.id)}
              className={`p-3.5 rounded-[12px] border text-left transition-all duration-150 cursor-pointer relative overflow-hidden group flex flex-col justify-between min-h-[96px] ${
                isSelected
                  ? 'border-[#4F46E5] bg-indigo-50/70 dark:bg-indigo-950/50 ring-2 ring-[#4F46E5]/40 shadow-xs'
                  : 'border-[#E3E6EC] dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-indigo-300 dark:hover:border-slate-700 hover:shadow-xs'
              }`}
            >
              <div className="flex items-start justify-between gap-2.5 w-full">
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-[10px] font-black px-2 py-0.5 rounded bg-indigo-100 dark:bg-indigo-900/60 text-[#4F46E5] dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/60">
                      [{base.code}]
                    </span>
                    <h3 
                      className="font-bold text-sm text-slate-900 dark:text-white break-words whitespace-normal leading-snug"
                      title={base.name}
                    >
                      {base.name}
                    </h3>
                  </div>
                  <p 
                    className="text-xs text-slate-500 dark:text-slate-400 break-words whitespace-normal line-clamp-2 leading-relaxed"
                    title={base.description || 'Standard formulation base'}
                  >
                    {base.description || 'Standard formulation base for production batches'}
                  </p>
                </div>

                {isSelected ? (
                  <div className="w-6 h-6 rounded-full bg-[#4F46E5] text-white flex items-center justify-center shrink-0 shadow-xs animate-in zoom-in-75 duration-150">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                ) : (
                  <div className="w-6 h-6 rounded-full border-2 border-slate-300 dark:border-slate-700 shrink-0 group-hover:border-[#4F46E5] transition-colors" />
                )}
              </div>

              {isSelected && (
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-[#4F46E5]" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
