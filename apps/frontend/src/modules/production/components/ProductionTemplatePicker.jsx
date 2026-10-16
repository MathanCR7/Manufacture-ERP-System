import React, { useState, useMemo } from 'react';
import { FileText, CheckCircle2, Search, X, Check, Sparkles } from 'lucide-react';

export default function ProductionTemplatePicker({
  templates = [],
  selectedTemplateId = '',
  onSelectTemplate,
  selectedBaseName = '',
  disabled = false
}) {
  const [searchTerm, setSearchTerm] = useState('');

  // Normalize active selected identifier (handles string ID, string code, or template object)
  const activeSelectedId = useMemo(() => {
    if (!selectedTemplateId) return '';
    if (typeof selectedTemplateId === 'object' && selectedTemplateId !== null) {
      return selectedTemplateId.id || selectedTemplateId._id || selectedTemplateId.code || '';
    }
    return String(selectedTemplateId);
  }, [selectedTemplateId]);

  const filteredTemplates = useMemo(() => {
    if (!searchTerm.trim()) return templates;
    const q = searchTerm.toLowerCase();
    return templates.filter(t => 
      (t.name || '').toLowerCase().includes(q) ||
      (t.code || '').toLowerCase().includes(q) ||
      String(t.outputQty || '').includes(q)
    );
  }, [templates, searchTerm]);

  // If no templates exist under this base, provide an immediate one-click fallback template creator
  if (templates.length === 0) {
    return (
      <div className="p-6 rounded-[12px] border border-dashed border-[#E3E6EC] dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50 text-center space-y-3">
        <FileText className="w-8 h-8 text-slate-400 dark:text-slate-600 mx-auto" />
        <div className="space-y-1">
          <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
            No templates registered under base: {selectedBaseName || 'Selected Base'}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            You can apply the standard base formulation template to proceed immediately.
          </p>
        </div>
        <button
          type="button"
          disabled={disabled}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (onSelectTemplate) {
              onSelectTemplate({
                id: `default-tpl-${Date.now()}`,
                code: 'TPL-STD',
                name: `${selectedBaseName || 'Standard Base'} Formulation`,
                outputQty: 2000,
                outputUom: 'Nos',
                grandTotal: 18500,
                wastagePct: 6.0,
                overheadPct: 10.0,
                lines: []
              });
            }
          }}
          className="px-4 py-2 bg-[#4F46E5] hover:bg-indigo-700 text-white rounded-[10px] text-xs font-bold transition-all shadow-xs cursor-pointer inline-flex items-center gap-2"
        >
          <Sparkles className="w-4 h-4" />
          <span>Apply Standard Formulation Template</span>
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3 pt-2">
      {/* Heading, count, search input */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-[#E3E6EC] dark:border-slate-800">
        <div className="flex items-center gap-2">
          <label className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5 text-[#4F46E5]" />
            <span>Production Template</span>
            <span className="text-rose-500">*</span>
          </label>
          <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/60 text-[#4F46E5] dark:text-indigo-300 border border-indigo-200/60">
            {filteredTemplates.length} of {templates.length}
          </span>
        </div>

        {/* Integrated Search Input (44px) */}
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search template name, code..."
            className="w-full h-[44px] pl-9 pr-8 bg-white dark:bg-slate-900 border border-[#E3E6EC] dark:border-slate-800 rounded-[10px] text-xs font-medium text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#4F46E5] transition-all"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Template rows: full width, selectable cards */}
      <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
        {filteredTemplates.map((tpl) => {
          const tplId = String(tpl.id || '');
          const tplCode = String(tpl.code || '');
          const isSelected = Boolean(
            activeSelectedId && (
              activeSelectedId === tplId || 
              activeSelectedId === tplCode ||
              (tpl._id && activeSelectedId === String(tpl._id))
            )
          );
          const costVal = Number(tpl.grandTotal || 0);

          return (
            <button
              key={tpl.id || tpl.code || Math.random()}
              type="button"
              disabled={disabled}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (onSelectTemplate) {
                  onSelectTemplate(tpl);
                }
              }}
              className={`w-full p-3.5 rounded-[12px] border text-left transition-all duration-150 cursor-pointer relative overflow-hidden group ${
                isSelected
                  ? 'border-[#4F46E5] bg-indigo-50/90 dark:bg-indigo-950/70 ring-2 ring-[#4F46E5]/40 shadow-xs'
                  : 'border-[#E3E6EC] dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-indigo-300 dark:hover:border-slate-700 hover:shadow-xs'
              }`}
            >
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                {/* 1. Tag (e.g. TPL-0001) */}
                <div className="md:col-span-2 flex items-center gap-2">
                  <span className={`font-mono text-xs font-black px-2 py-1 rounded border transition-colors ${
                    isSelected
                      ? 'bg-indigo-100 dark:bg-indigo-900/80 text-[#4F46E5] dark:text-indigo-200 border-indigo-200 dark:border-indigo-700'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                  }`}>
                    {tpl.code || 'TPL'}
                  </span>
                </div>

                {/* 2. Template name (wraps, bold, no truncation) */}
                <div className="md:col-span-5 min-w-0">
                  <h4 
                    className={`font-bold text-sm break-words whitespace-normal leading-snug transition-colors ${
                      isSelected
                        ? 'text-[#4F46E5] dark:text-indigo-300 font-extrabold'
                        : 'text-slate-900 dark:text-white group-hover:text-[#4F46E5]'
                    }`}
                    title={tpl.name}
                  >
                    {tpl.name}
                  </h4>
                  {tpl.description && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 break-words line-clamp-1 pt-0.5">
                      {tpl.description}
                    </p>
                  )}
                </div>

                {/* 3. Batch size */}
                <div className="md:col-span-2 text-xs font-medium text-slate-600 dark:text-slate-300">
                  <span className="text-[10px] uppercase text-slate-400 font-bold block">Batch Size</span>
                  <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                    {Number(tpl.outputQty || 2000).toLocaleString()} {tpl.outputUom || 'Nos'}
                  </span>
                </div>

                {/* 4. Cost + Check Indicator */}
                <div className="md:col-span-3 flex items-center justify-between md:justify-end gap-3 text-right">
                  <div>
                    <span className="text-[10px] uppercase text-slate-400 font-bold block">Est. Cost</span>
                    <span className="font-mono font-black text-sm text-[#4F46E5] dark:text-indigo-400">
                      ₹{costVal.toLocaleString('en-IN', { minimumFractionDigits: 1, maximumFractionDigits: 2 })}
                    </span>
                  </div>

                  {isSelected ? (
                    <div className="w-6 h-6 rounded-full bg-[#4F46E5] text-white flex items-center justify-center shrink-0 shadow-xs animate-in zoom-in-75 duration-150">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                  ) : (
                    <div className="w-6 h-6 rounded-full border-2 border-slate-300 dark:border-slate-700 shrink-0 group-hover:border-[#4F46E5] transition-colors" />
                  )}
                </div>
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
