import { useState } from 'react';
import { format } from 'date-fns';
import {
  CheckSquare, Square, RefreshCw, X,
  Clock, ChevronDown, ChevronUp,
  FileSpreadsheet, Printer, Sparkles
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  EXPORT_FIELD_DEFINITIONS,
  getDefaultSelectedFields,
  generatePOTablePDF,
  generatePOTableExcel
} from '../utils/poTableExportEngine';
import useCompanyStore from '@/app/store/companyStore';

export default function POExportModal({
  isOpen,
  onClose,
  allPOs = [],
  selectedPOs = [],
  defaultFormat = 'PDF' // 'PDF' | 'EXCEL'
}) {
  const company = useCompanyStore(s => s.company);

  // Field selection state - ALL TRUE by default
  const [selectedFields, setSelectedFields] = useState(getDefaultSelectedFields);

  // Live dynamic downloaded time & updated date state
  const [downloadedTime, setDownloadedTime] = useState(() => new Date());
  const [lastActionTimestamp, setLastActionTimestamp] = useState(() => new Date());

  // Scope: 'selected' (if any selected) vs 'all'
  const hasSelected = Array.isArray(selectedPOs) && selectedPOs.length > 0;
  const [userScope, setUserScope] = useState(null);
  const scope = userScope ?? (hasSelected ? 'selected' : 'all');

  // Option to include detailed per-PO dossier pages in PDF
  const [includeDossiers, setIncludeDossiers] = useState(true);

  // Processing state
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [isExportingExcel, setIsExportingExcel] = useState(false);

  // Collapsed categories state (all expanded by default)
  const [collapsedCategories, setCollapsedCategories] = useState({});

  if (!isOpen) return null;

  // Active target POs based on scope
  const targetPOs = scope === 'selected' && hasSelected ? selectedPOs : allPOs;

  // Whenever user clicks or modifies any checkbox, update downloaded time & updated date dynamically
  const handleToggleField = (fieldId) => {
    setSelectedFields(prev => {
      const next = { ...prev, [fieldId]: !prev[fieldId] };
      return next;
    });
    // Dynamically refresh the downloaded time and updated timestamp in real-time
    const now = new Date();
    setDownloadedTime(now);
    setLastActionTimestamp(now);
  };

  const handleToggleCategory = (categoryObj) => {
    const allCategoryFieldIds = categoryObj.fields.map(f => f.id);
    const areAllChecked = allCategoryFieldIds.every(id => selectedFields[id] === true);

    setSelectedFields(prev => {
      const next = { ...prev };
      allCategoryFieldIds.forEach(id => {
        next[id] = !areAllChecked;
      });
      return next;
    });

    const now = new Date();
    setDownloadedTime(now);
    setLastActionTimestamp(now);
  };

  const handleSelectAll = () => {
    const allTrue = {};
    EXPORT_FIELD_DEFINITIONS.forEach(cat => {
      cat.fields.forEach(f => {
        allTrue[f.id] = true;
      });
    });
    setSelectedFields(allTrue);
    setIncludeDossiers(true);
    const now = new Date();
    setDownloadedTime(now);
    setLastActionTimestamp(now);
  };

  const handleDeselectAll = () => {
    const allFalse = {};
    EXPORT_FIELD_DEFINITIONS.forEach(cat => {
      cat.fields.forEach(f => {
        allFalse[f.id] = false;
      });
    });
    setSelectedFields(allFalse);
    const now = new Date();
    setDownloadedTime(now);
    setLastActionTimestamp(now);
  };

  const handleApplyPreset = (presetType) => {
    const now = new Date();
    setDownloadedTime(now);
    setLastActionTimestamp(now);

    if (presetType === 'standard') {
      const std = {};
      EXPORT_FIELD_DEFINITIONS.forEach(cat => {
        cat.fields.forEach(f => {
          // Standard core summary columns
          const isStandard = ['poRef', 'poDate', 'updatedDate', 'supplierName', 'purchaseStatus', 'rawMaterialList', 'grandTotal', 'paidAmount', 'dueAmount', 'paymentStatus', 'downloadedTime'].includes(f.id);
          std[f.id] = isStandard;
        });
      });
      setSelectedFields(std);
      setIncludeDossiers(false); // Core Summary Only: Prints table only, excludes multi-page per-PO dossiers
    } else if (presetType === 'full') {
      handleSelectAll();
      setIncludeDossiers(true);
    }
  };

  const totalFieldsCount = EXPORT_FIELD_DEFINITIONS.reduce((acc, cat) => acc + cat.fields.length, 0);
  const checkedFieldsCount = Object.values(selectedFields).filter(Boolean).length;

  const handleExportPDF = async () => {
    setIsExportingPDF(true);
    try {
      await generatePOTablePDF({
        pos: targetPOs,
        fields: selectedFields,
        downloadedTime,
        company,
        includeDossiers
      });
      if (typeof onClose === 'function') {
        onClose();
      }
    } finally {
      setIsExportingPDF(false);
    }
  };

  const handleExportExcel = async () => {
    setIsExportingExcel(true);
    try {
      await generatePOTableExcel({
        pos: targetPOs,
        fields: selectedFields,
        downloadedTime,
        company
      });
      if (typeof onClose === 'function') {
        onClose();
      }
    } finally {
      setIsExportingExcel(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden text-xs"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Accent Ribbon */}
        <div className="h-1.5 w-full bg-linear-to-r from-slate-900 via-indigo-600 to-sky-500 shrink-0" />

        {/* Modal Header */}
        <div className="px-4 py-3 sm:px-6 sm:py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 bg-slate-50/50 dark:bg-slate-950/30 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-100 dark:border-indigo-800 shadow-2xs">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                  Export Purchase Orders Report
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                  {checkedFieldsCount} / {totalFieldsCount} Headers
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 uppercase">
                  {defaultFormat}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Configure headers, detailed sections, and audit timestamps for PDF and Excel export.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Live Timestamp & Export Scope Bar */}
        <div className="px-4 py-2 sm:px-6 bg-indigo-50/40 dark:bg-indigo-950/20 border-b border-indigo-100 dark:border-indigo-900/40 flex flex-wrap items-center justify-between gap-2.5 text-[11px] shrink-0">
          <div className="flex items-center gap-3 flex-wrap">
            {/* Live Downloaded Time Badge */}
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 font-mono shadow-3xs">
              <Clock className="w-3.5 h-3.5 text-indigo-500 animate-pulse" />
              <span>Downloaded Time: <strong>{format(downloadedTime, 'dd-MM-yyyy, hh:mm:ss a')}</strong></span>
            </div>

            {/* Live Updated Indicator */}
            <div className="inline-flex items-center gap-1 text-slate-500 dark:text-slate-400 text-[10.5px]">
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
              <span>Headers last updated: <strong>{format(lastActionTimestamp, 'hh:mm:ss a')}</strong></span>
            </div>
          </div>

          {/* Scope Selector */}
          <div className="flex items-center gap-1.5 bg-white dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700">
            {hasSelected && (
              <button
                type="button"
                onClick={() => setUserScope('selected')}
                className={`px-2.5 py-1 rounded-md text-[10.5px] font-bold transition-all cursor-pointer ${
                  scope === 'selected'
                    ? 'bg-indigo-600 text-white shadow-3xs'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
              >
                Selected ({selectedPOs.length} POs)
              </button>
            )}
            <button
              type="button"
              onClick={() => setUserScope('all')}
              className={`px-2.5 py-1 rounded-md text-[10.5px] font-bold transition-all cursor-pointer ${
                scope === 'all'
                  ? 'bg-indigo-600 text-white shadow-3xs'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}
            >
              All Filtered ({allPOs.length} POs)
            </button>
          </div>
        </div>

        {/* Quick Presets Toolbar */}
        <div className="px-4 py-2 sm:px-6 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/40 flex items-center justify-between flex-wrap gap-2 shrink-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-1">Presets:</span>
            
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleApplyPreset('standard')}
              className={`h-7 px-2.5 text-[11px] font-bold gap-1.5 transition-all shadow-3xs cursor-pointer ${
                !includeDossiers
                  ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-700 ring-1 ring-amber-400/40'
                  : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-amber-300'
              }`}
              title="Core Summary Only: Export tabular overview only (clean columns, no multi-page per-PO audit dossiers)"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>Core Summary Only</span>
              <span className="px-1.5 py-0.2 rounded text-[9px] font-extrabold uppercase bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                Table Only
              </span>
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleSelectAll}
              className={`h-7 px-2.5 text-[11px] font-semibold gap-1.5 transition-all shadow-3xs cursor-pointer ${
                includeDossiers && checkedFieldsCount === totalFieldsCount
                  ? 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-300 dark:border-indigo-700 ring-1 ring-indigo-400/40'
                  : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-indigo-300'
              }`}
              title="Full Audit Preset: Selects all headers and appends comprehensive per-PO audit dossiers"
            >
              <CheckSquare className="w-3.5 h-3.5 text-indigo-600" />
              <span>Select All Headers</span>
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleDeselectAll}
              className="h-7 px-2 text-[10.5px] font-semibold border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 gap-1 cursor-pointer"
              title="Deselect All: Unchecks all columns so you can pick custom fields"
            >
              <Square className="w-3 h-3 text-slate-400" /> Deselect All
            </Button>
          </div>

          {/* Dossier Toggle with clear visual state */}
          <label 
            className={`flex items-center gap-2 px-2.5 py-1 rounded-lg border text-[11px] font-semibold transition-all cursor-pointer select-none ${
              includeDossiers
                ? 'bg-indigo-50/60 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800/80 text-indigo-900 dark:text-indigo-200'
                : 'bg-slate-100/60 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400'
            }`}
            title="When disabled, ONLY the clean overview table prints. When enabled, multi-page per-PO audit dossiers are appended."
          >
            <input
              type="checkbox"
              checked={includeDossiers}
              onChange={(e) => setIncludeDossiers(e.target.checked)}
              className="rounded text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5 cursor-pointer"
            />
            <span>Include Audit Dossiers in PDF</span>
            <span className={`px-1.5 py-0.2 rounded text-[9px] font-extrabold uppercase ${
              includeDossiers 
                ? 'bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-700'
                : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
            }`}>
              {includeDossiers ? 'ON' : 'OFF'}
            </span>
          </label>
        </div>

        {/* Scrollable Checkbox Categories Grid */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3.5 divide-y divide-slate-100 dark:divide-slate-800/60">
          {EXPORT_FIELD_DEFINITIONS.map((cat) => {
            const isCollapsed = collapsedCategories[cat.category];
            const catFieldIds = cat.fields.map(f => f.id);
            const checkedCount = catFieldIds.filter(id => selectedFields[id] === true).length;
            const isAllChecked = checkedCount === cat.fields.length;
            const isPartial = checkedCount > 0 && !isAllChecked;

            return (
              <div key={cat.category} className="pt-3.5 first:pt-0">
                {/* Category Header with Toggle */}
                <div className="flex items-center justify-between gap-2 mb-2 select-none">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleToggleCategory(cat)}
                      className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer text-indigo-600 dark:text-indigo-400"
                      title={isAllChecked ? 'Deselect Category' : 'Select All in Category'}
                    >
                      {isAllChecked ? (
                        <CheckSquare className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                      ) : isPartial ? (
                        <div className="w-4 h-4 rounded border-2 border-indigo-600 dark:border-indigo-400 flex items-center justify-center bg-indigo-50 dark:bg-indigo-950">
                          <span className="w-2 h-0.5 bg-indigo-600 dark:bg-indigo-400 rounded-full" />
                        </div>
                      ) : (
                        <Square className="w-4 h-4 text-slate-300 dark:text-slate-600" />
                      )}
                    </button>

                    <div>
                      <span className="text-xs font-bold text-slate-900 dark:text-white">
                        {cat.categoryLabel}
                      </span>
                      <span className="text-[10px] text-slate-400 ml-2">
                        ({checkedCount}/{cat.fields.length} selected)
                      </span>
                      {cat.description && (
                        <p className="text-[10px] text-slate-400 leading-none mt-0.5">
                          {cat.description}
                        </p>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setCollapsedCategories(prev => ({ ...prev, [cat.category]: !prev[cat.category] }))}
                    className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 transition-colors cursor-pointer"
                  >
                    {isCollapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
                  </button>
                </div>

                {/* Category Fields Checkbox Cards */}
                {!isCollapsed && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 pl-6">
                    {cat.fields.map((f) => {
                      const isChecked = selectedFields[f.id] === true;
                      return (
                        <label
                          key={f.id}
                          className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border transition-all cursor-pointer select-none text-[11px] ${
                            isChecked
                              ? 'bg-indigo-50/50 dark:bg-indigo-950/30 border-indigo-200 dark:border-indigo-800/80 text-slate-900 dark:text-slate-100 font-medium'
                              : 'bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:border-slate-300'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleToggleField(f.id)}
                            className="rounded text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5 cursor-pointer shrink-0"
                          />
                          <span className="truncate" title={f.label}>{f.label}</span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Modal Footer with Actions */}
        <div className="px-4 py-3 sm:px-6 bg-slate-50/90 dark:bg-slate-950/80 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          {/* Status / Scope Information Pill */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 text-[11px] select-none shadow-3xs">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-600 dark:bg-indigo-400"></span>
            </span>
            <span className="text-slate-600 dark:text-slate-300">
              Exporting <strong className="text-slate-900 dark:text-white font-bold">{targetPOs.length}</strong> Purchase Orders with <strong className="text-indigo-600 dark:text-indigo-400 font-bold">{checkedFieldsCount}</strong> headers
            </span>
            {!includeDossiers && (
              <span className="px-1.5 py-0.2 rounded text-[9px] font-extrabold uppercase bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 ml-1">
                Table Only
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end flex-wrap">
            {/* Cancel Button */}
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isExportingPDF || isExportingExcel}
              className="h-8 px-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-xs font-semibold shadow-3xs transition-all cursor-pointer inline-flex items-center gap-1.5 shrink-0 active:scale-95"
            >
              <X className="w-3.5 h-3.5 text-slate-400" />
              <span>Cancel</span>
            </Button>

            {/* Export to Excel (.xlsx) - Solid Green matching Add Purchase */}
            <Button
              type="button"
              onClick={handleExportExcel}
              disabled={isExportingExcel || isExportingPDF || targetPOs.length === 0 || checkedFieldsCount === 0}
              className="h-8 px-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-3xs transition-all cursor-pointer inline-flex items-center gap-1.5 shrink-0 active:scale-95 disabled:opacity-50"
              title="Export complete Excel spreadsheet (.xlsx)"
            >
              {isExportingExcel ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Generating Excel...</span>
                </>
              ) : (
                <>
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>Export to Excel (.xlsx)</span>
                </>
              )}
            </Button>

            {/* Export to PDF - Solid Red matching Add Purchase */}
            <Button
              type="button"
              onClick={handleExportPDF}
              disabled={isExportingPDF || isExportingExcel || targetPOs.length === 0 || checkedFieldsCount === 0}
              className="h-8 px-3.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold shadow-3xs transition-all cursor-pointer inline-flex items-center gap-1.5 shrink-0 active:scale-95 disabled:opacity-50"
              title={includeDossiers ? "Export PDF Report with Audit Dossiers" : "Export Clean Core Table PDF Report"}
            >
              {isExportingPDF ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Compiling PDF...</span>
                </>
              ) : (
                <>
                  <Printer className="w-3.5 h-3.5" />
                  <span>Export to PDF</span>
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
