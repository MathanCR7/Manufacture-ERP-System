import React from 'react';
import { FileText, CheckCircle2, Sparkles, AlertCircle, ArrowRight } from 'lucide-react';

export default function ProductionTemplatePicker({
  templates = [],
  selectedTemplateId = '',
  onSelectTemplate,
  selectedBaseName = '',
  disabled = false
}) {
  if (templates.length === 0) {
    return (
      <div className="p-6 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 text-center space-y-2">
        <FileText className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto" />
        <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
          No templates found under base: {selectedBaseName || 'Selected Base'}
        </p>
        <p className="text-[11px] text-slate-400">
          Please create a template under this base in the Production Template menu first.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
          <FileText className="w-3.5 h-3.5 text-indigo-500" />
          <span>Step B: Select Production Template</span>
          <span className="text-rose-500">*</span>
        </label>
        <span className="text-[11px] text-indigo-600 dark:text-indigo-400 font-bold">
          {templates.length} Saved Template(s) under {selectedBaseName}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {templates.map((tpl) => {
          const isSelected = selectedTemplateId === tpl.id;

          return (
            <button
              key={tpl.id}
              type="button"
              disabled={disabled}
              onClick={() => onSelectTemplate(tpl)}
              className={`p-4 rounded-2xl border text-left transition-all duration-200 cursor-pointer relative overflow-hidden group ${
                isSelected
                  ? 'border-indigo-600 bg-indigo-50/80 dark:bg-indigo-950/60 ring-2 ring-indigo-500 shadow-sm'
                  : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-indigo-300 dark:hover:border-slate-700 hover:shadow-xs'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-1 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-[9px] font-black px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                      {tpl.code}
                    </span>
                    <h4 className="font-extrabold text-xs sm:text-sm text-slate-900 dark:text-white line-clamp-1">
                      {tpl.name}
                    </h4>
                  </div>

                  <div className="flex items-center gap-2 pt-1 text-[11px] font-mono text-slate-500 dark:text-slate-400">
                    <span>Target: <strong>{tpl.outputQty} {tpl.outputUom}</strong></span>
                    <span>•</span>
                    <span className="text-indigo-600 dark:text-indigo-400 font-bold">
                      ₹{Number(tpl.grandTotal || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>

                {isSelected ? (
                  <div className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  </div>
                ) : (
                  <div className="w-5 h-5 rounded-full border border-slate-300 dark:border-slate-700 shrink-0 group-hover:border-indigo-400" />
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
