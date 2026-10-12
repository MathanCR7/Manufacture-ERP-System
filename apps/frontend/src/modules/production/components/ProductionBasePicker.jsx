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
      <div className="flex items-center justify-between">
        <label className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
          <Database className="w-3.5 h-3.5 text-indigo-500" />
          <span>Step A: Select Base Master</span>
          <span className="text-rose-500">*</span>
        </label>
        <span className="text-[11px] text-slate-400 font-semibold">
          {activeBases.length} Bases Available
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {activeBases.map((base) => {
          const isSelected = selectedBaseId === base.id;

          return (
            <button
              key={base.id}
              type="button"
              disabled={disabled}
              onClick={() => onSelectBase(base.id)}
              className={`p-4 rounded-2xl border text-left transition-all duration-200 cursor-pointer relative overflow-hidden group ${
                isSelected
                  ? 'border-indigo-600 bg-indigo-50/70 dark:bg-indigo-950/50 ring-2 ring-indigo-500 shadow-sm'
                  : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-indigo-300 dark:hover:border-slate-700 hover:shadow-xs'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] font-black px-2 py-0.5 rounded-md bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300">
                      {base.code}
                    </span>
                    <h3 className="font-black text-sm text-slate-900 dark:text-white">
                      {base.name}
                    </h3>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1">
                    {base.description || 'Standard formulation base'}
                  </p>
                </div>

                {isSelected ? (
                  <div className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                ) : (
                  <div className="w-6 h-6 rounded-full border border-slate-300 dark:border-slate-700 shrink-0 group-hover:border-indigo-400 transition-colors" />
                )}
              </div>

              {isSelected && (
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 to-purple-600" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
