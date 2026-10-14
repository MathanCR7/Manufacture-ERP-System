import React from 'react';
import { Database, CheckCircle2, Layers } from 'lucide-react';

export default function ProductionBasePicker({
  bases = [],
  selectedBaseId = '',
  onSelectBase,
  disabled = false
}) {
  const activeBases = bases.filter(b => b.status === 'ACTIVE');

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between pb-1 border-b border-slate-100 dark:border-slate-800">
        <label className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
          <Database className="w-3.5 h-3.5 text-indigo-500" />
          <span>Step A: Select Base Master</span>
          <span className="text-rose-500">*</span>
        </label>
        <span className="text-[11px] text-slate-400 font-semibold">
          {activeBases.length} Bases Available
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
        {activeBases.map((base) => {
          const isSelected = selectedBaseId === base.id;

          return (
            <button
              key={base.id}
              type="button"
              disabled={disabled}
              onClick={() => onSelectBase(base.id)}
              className={`p-2.5 rounded-xl border text-left transition-all duration-150 cursor-pointer relative overflow-hidden group ${
                isSelected
                  ? 'border-indigo-600 bg-indigo-50/80 dark:bg-indigo-950/60 ring-2 ring-indigo-500/80 shadow-2xs'
                  : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-indigo-300 dark:hover:border-slate-700 hover:shadow-2xs'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-0.5 flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-mono text-[9px] font-black px-1.5 py-0.2 rounded bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300">
                      {base.code}
                    </span>
                    <h3 className="font-black text-xs text-slate-900 dark:text-white truncate">
                      {base.name}
                    </h3>
                  </div>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 line-clamp-1">
                    {base.description || 'Standard formulation base'}
                  </p>
                </div>

                {isSelected ? (
                  <div className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  </div>
                ) : (
                  <div className="w-5 h-5 rounded-full border border-slate-300 dark:border-slate-700 shrink-0 group-hover:border-indigo-400 transition-colors" />
                )}
              </div>

              {isSelected && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
