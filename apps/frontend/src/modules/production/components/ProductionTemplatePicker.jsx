import React, { useState, useMemo } from 'react';
import { FileText, CheckCircle2, Search, X, Sparkles, AlertCircle, ArrowRight } from 'lucide-react';

export default function ProductionTemplatePicker({
  templates = [],
  selectedTemplateId = '',
  onSelectTemplate,
  selectedBaseName = '',
  disabled = false
}) {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredTemplates = useMemo(() => {
    if (!searchTerm.trim()) return templates;
    const q = searchTerm.toLowerCase();
    return templates.filter(t => 
      (t.name || '').toLowerCase().includes(q) ||
      (t.code || '').toLowerCase().includes(q) ||
      String(t.outputQty || '').includes(q)
    );
  }, [templates, searchTerm]);

  if (templates.length === 0) {
    return (
      <div className="p-4 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 text-center space-y-1">
        <FileText className="w-6 h-6 text-slate-300 dark:text-slate-600 mx-auto" />
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-1 border-b border-slate-100 dark:border-slate-800">
        <label className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
          <FileText className="w-3.5 h-3.5 text-indigo-500" />
          <span>Step B: Select Production Template</span>
          <span className="text-rose-500">*</span>
        </label>
        
        <div className="flex items-center gap-2">
          {/* Integrated Search Bar for Templates */}
          <div className="relative w-full sm:w-52">
            <Search className="w-3 h-3 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search template..."
              className="w-full h-7 pl-7 pr-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-semibold text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold shrink-0">
            {filteredTemplates.length}/{templates.length}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2 max-h-56 overflow-y-auto pr-1">
        {filteredTemplates.map((tpl) => {
          const isSelected = selectedTemplateId === tpl.id;

          return (
            <button
              key={tpl.id}
              type="button"
              disabled={disabled}
              onClick={() => onSelectTemplate(tpl)}
              className={`p-2.5 rounded-xl border text-left transition-all duration-150 cursor-pointer relative overflow-hidden group ${
                isSelected
                  ? 'border-indigo-600 bg-indigo-50/80 dark:bg-indigo-950/60 ring-2 ring-indigo-500/80 shadow-2xs'
                  : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-indigo-300 dark:hover:border-slate-700 hover:shadow-2xs'
              }`}
            >
              <div className="flex items-start justify-between gap-1.5">
                <div className="space-y-0.5 flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-mono text-[9px] font-black px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                      {tpl.code}
                    </span>
                    <h4 className="font-black text-xs text-slate-900 dark:text-white truncate">
                      {tpl.name}
                    </h4>
                  </div>

                  <div className="flex items-center gap-1.5 pt-0.5 text-[10px] font-mono text-slate-500 dark:text-slate-400">
                    <span>Batch: <strong>{tpl.outputQty} {tpl.outputUom}</strong></span>
                    <span>•</span>
                    <span className="text-indigo-600 dark:text-indigo-400 font-bold">
                      ₹{Number(tpl.grandTotal || 0).toLocaleString('en-IN', { maximumFractionDigits: 1 })}
                    </span>
                  </div>
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
