import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  Search, X, Check, Package, Tag, Scale, ChevronDown, 
  Layers, AlertTriangle, CheckCircle2, RotateCcw, Filter
} from 'lucide-react';
import { Button } from '@/components/ui/button';

export const normalizeStr = (str) => (str || '').toLowerCase().replace(/[\s\-_.,/]+/g, '');

export default function StockRMSearchSelect({
  rawMaterials = [],
  selectedMaterialId = '',
  onSelect,
  onClear,
  error = null,
  disabled = false,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [stockFilter, setStockFilter] = useState('ALL'); // 'ALL' | 'IN_STOCK' | 'OUT_OF_STOCK'
  const searchInputRef = useRef(null);
  const modalRef = useRef(null);

  // Find currently selected raw material object
  const selectedRm = useMemo(() => {
    if (!selectedMaterialId || !rawMaterials.length) return null;
    return rawMaterials.find(rm => rm.id === selectedMaterialId || rm.code === selectedMaterialId) || null;
  }, [selectedMaterialId, rawMaterials]);

  // Extract distinct category list from available materials
  const categories = useMemo(() => {
    const catMap = new Map();
    rawMaterials.forEach(rm => {
      const cat = rm.category || rm.categoryName || rm.category?.name || 'Uncategorised';
      catMap.set(cat, (catMap.get(cat) || 0) + 1);
    });
    return Array.from(catMap.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [rawMaterials]);

  // Space-tolerant, multi-token fuzzy search & filter
  const filteredMaterials = useMemo(() => {
    return rawMaterials.filter(rm => {
      // Category filter
      if (selectedCategory !== 'ALL') {
        const cat = (rm.category || rm.categoryName || rm.category?.name || 'Uncategorised').toLowerCase();
        if (cat !== selectedCategory.toLowerCase()) return false;
      }

      // Stock status filter
      const available = Number(rm.availableQuantity ?? rm.currentStock ?? 0);
      if (stockFilter === 'IN_STOCK' && available <= 0) return false;
      if (stockFilter === 'OUT_OF_STOCK' && available > 0) return false;

      // Text search
      const q = searchTerm.trim();
      if (!q) return true;

      const qNorm = normalizeStr(q);
      const tokens = q.toLowerCase().split(/\s+/).filter(Boolean);

      const nameStr = rm.name || '';
      const codeStr = rm.code || '';
      const catStr = rm.category || rm.categoryName || rm.category?.name || '';
      const unitStr = rm.unit || rm.unitId || '';
      const composite = `${nameStr} ${codeStr} ${catStr} ${unitStr}`;
      const compositeNorm = normalizeStr(composite);

      if (normalizeStr(nameStr).includes(qNorm) || normalizeStr(codeStr).includes(qNorm) || compositeNorm.includes(qNorm)) {
        return true;
      }

      return tokens.every(token => {
        const tokenNorm = normalizeStr(token);
        return composite.toLowerCase().includes(token) || compositeNorm.includes(tokenNorm);
      });
    });
  }, [rawMaterials, selectedCategory, stockFilter, searchTerm]);

  // Auto-focus search input when modal opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  // Close on Escape or click outside
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const handleSelectMaterial = (rm) => {
    if (onSelect) onSelect(rm);
    setIsOpen(false);
    setSearchTerm('');
  };

  const handleClearSelection = (e) => {
    if (e) e.stopPropagation();
    if (onClear) onClear();
  };

  return (
    <div className="w-full space-y-1.5">
      {/* ─────────────────────────────────────────────────────────────
          1. Selected Item Banner or Trigger Search Button
          ───────────────────────────────────────────────────────────── */}
      {selectedRm ? (
        <div className={`p-3 rounded-2xl border transition-all ${
          error 
            ? 'bg-rose-50/70 border-rose-300 dark:bg-rose-950/30 dark:border-rose-800' 
            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-xs hover:border-indigo-300 dark:hover:border-indigo-700'
        }`}>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400 shrink-0 border border-indigo-100 dark:border-indigo-900/60 shadow-2xs">
                <Package className="w-5 h-5" />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-sm text-slate-900 dark:text-white truncate">
                    {selectedRm.name}
                  </span>
                  <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-md bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 shrink-0">
                    {selectedRm.code}
                  </span>
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200 dark:border-purple-800 shrink-0">
                    <Tag className="w-3 h-3 text-purple-500" />
                    {selectedRm.category || selectedRm.categoryName || 'General'}
                  </span>
                </div>

                <div className="flex items-center gap-3 mt-1 text-xs text-slate-500 dark:text-slate-400 flex-wrap">
                  <span className="inline-flex items-center gap-1 font-medium">
                    <span className="text-slate-400">Available Stock:</span>
                    <strong className={`font-mono text-xs font-bold px-1.5 py-0.2 rounded ${
                      Number(selectedRm.availableQuantity || selectedRm.currentStock || 0) <= 0 
                        ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300' 
                        : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                    }`}>
                      {Number(selectedRm.availableQuantity ?? selectedRm.currentStock ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 4 })} {selectedRm.unit || selectedRm.unitId || ''}
                    </strong>
                  </span>
                  <span className="text-slate-300 dark:text-slate-700 hidden sm:inline">•</span>
                  <span className="inline-flex items-center gap-1 font-medium">
                    <Scale className="w-3 h-3 text-slate-400" />
                    <span>Unit: <strong className="font-mono text-slate-700 dark:text-slate-300">{selectedRm.unit || selectedRm.unitId || 'units'}</strong></span>
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 justify-end border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100 dark:border-slate-800">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsOpen(true)}
                disabled={disabled}
                className="h-8 px-3 text-xs font-semibold text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 rounded-xl"
              >
                Change Material
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleClearSelection}
                disabled={disabled}
                className="h-8 px-2 text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-xl"
                title="Clear selection"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => !disabled && setIsOpen(true)}
          disabled={disabled}
          className={`w-full p-3 sm:p-3.5 border-2 border-dashed rounded-2xl text-left flex items-center justify-between transition-all duration-150 ${
            error
              ? 'border-rose-300 bg-rose-50/40 text-rose-700 dark:border-rose-800 dark:bg-rose-950/20'
              : 'border-slate-300 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-900/60 hover:bg-indigo-50/40 hover:border-indigo-400 dark:hover:bg-indigo-950/20 text-slate-700 dark:text-slate-300'
          } ${disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer shadow-2xs'}`}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 rounded-xl bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-2xs border border-slate-200 dark:border-slate-700 shrink-0">
              <Search className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="font-bold text-xs text-slate-800 dark:text-slate-200 flex items-center gap-2">
                <span>Select Raw Material with Category & Stock</span>
                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-indigo-100 text-indigo-700 dark:bg-indigo-900/70 dark:text-indigo-300 uppercase">
                  Searchable
                </span>
              </div>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5 truncate">
                Search by code (e.g. RM-00010), name (e.g. PISTA), or category (e.g. Essence, Dry Fruits)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 ml-2">
            <span className="hidden sm:inline-block text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 bg-white dark:bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 shadow-3xs">
              Browse Catalog &rarr;
            </span>
            <ChevronDown className="w-4 h-4 text-slate-400" />
          </div>
        </button>
      )}

      {/* ─────────────────────────────────────────────────────────────
          2. Search Modal / Catalog Dialog
          ───────────────────────────────────────────────────────────── */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div 
            ref={modalRef}
            className="w-full max-w-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-150"
          >
            {/* Modal Header */}
            <div className="p-3.5 sm:p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-950/70">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-indigo-600 text-white shadow-xs">
                  <Package className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                    Select Raw Material
                  </h3>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500">
                    Live inventory stock, category classification & unit details
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Search Input Bar */}
            <div className="p-3 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 relative">
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search material name (e.g. PISTA), code (e.g. RM-00010), or category..."
                  className="w-full pl-9 pr-8 py-2 text-xs border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50/70 dark:bg-slate-950 focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 text-slate-900 dark:text-white transition-all font-medium"
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Category Filter Pills Bar */}
            <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 flex items-center gap-1.5 overflow-x-auto scrollbar-none">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 shrink-0 mr-1 flex items-center gap-1">
                <Filter className="w-3 h-3" />
                Category:
              </span>
              <button
                type="button"
                onClick={() => setSelectedCategory('ALL')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all shrink-0 cursor-pointer ${
                  selectedCategory === 'ALL'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                }`}
              >
                All Categories ({rawMaterials.length})
              </button>

              {categories.map(([catName, count]) => (
                <button
                  key={catName}
                  type="button"
                  onClick={() => setSelectedCategory(catName)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all shrink-0 cursor-pointer flex items-center gap-1 ${
                    selectedCategory === catName
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <span>{catName}</span>
                  <span className="text-[10px] opacity-75 font-mono">({count})</span>
                </button>
              ))}
            </div>

            {/* Quick Status Bar */}
            <div className="px-3.5 py-1.5 bg-slate-100/60 dark:bg-slate-800/40 border-b border-slate-200/60 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
              <span>
                Showing <strong>{filteredMaterials.length}</strong> matching raw material{filteredMaterials.length === 1 ? '' : 's'}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setStockFilter(stockFilter === 'IN_STOCK' ? 'ALL' : 'IN_STOCK')}
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded cursor-pointer transition-colors ${
                    stockFilter === 'IN_STOCK' 
                      ? 'bg-emerald-600 text-white' 
                      : 'hover:text-emerald-600 text-slate-500'
                  }`}
                >
                  In Stock Only
                </button>
                <span>•</span>
                <button
                  type="button"
                  onClick={() => setStockFilter(stockFilter === 'OUT_OF_STOCK' ? 'ALL' : 'OUT_OF_STOCK')}
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded cursor-pointer transition-colors ${
                    stockFilter === 'OUT_OF_STOCK' 
                      ? 'bg-rose-600 text-white' 
                      : 'hover:text-rose-600 text-slate-500'
                  }`}
                >
                  Out of Stock Only
                </button>
              </div>
            </div>

            {/* Material List Container */}
            <div className="flex-1 overflow-y-auto p-2 sm:p-2.5 space-y-1.5 max-h-[50vh]">
              {filteredMaterials.length === 0 ? (
                <div className="py-12 text-center text-slate-400 flex flex-col items-center justify-center">
                  <Search className="w-7 h-7 text-slate-300 dark:text-slate-600 mb-2 stroke-1" />
                  <p className="font-semibold text-xs text-slate-600 dark:text-slate-300">
                    No raw materials matched your search
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Try adjusting the search query or category filter
                  </p>
                  {(searchTerm || selectedCategory !== 'ALL' || stockFilter !== 'ALL') && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => { setSearchTerm(''); setSelectedCategory('ALL'); setStockFilter('ALL'); }}
                      className="mt-2 h-7 text-xs rounded-xl"
                    >
                      <RotateCcw className="w-3 h-3 mr-1" /> Reset Filters
                    </Button>
                  )}
                </div>
              ) : (
                filteredMaterials.map(rm => {
                  const isSelected = selectedMaterialId === rm.id;
                  const availableQty = Number(rm.availableQuantity ?? rm.currentStock ?? 0);
                  const alertLevel = Number(rm.alertLevel || 0);
                  const isOutOfStock = availableQty <= 0;
                  const isLowStock = !isOutOfStock && availableQty <= alertLevel;
                  const categoryName = rm.category || rm.categoryName || rm.category?.name || 'Uncategorised';
                  const uomLabel = rm.unit || rm.unitId || 'units';

                  return (
                    <div
                      key={rm.id}
                      onClick={() => handleSelectMaterial(rm)}
                      className={`p-2.5 sm:p-3 rounded-2xl border transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3 ${
                        isSelected
                          ? 'bg-indigo-50/90 border-indigo-500 ring-2 ring-indigo-500/20 dark:bg-indigo-950/70 dark:border-indigo-600 shadow-xs'
                          : 'bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60 hover:border-indigo-300 dark:hover:border-indigo-700'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className={`p-2 rounded-xl shrink-0 ${
                          isSelected
                            ? 'bg-indigo-600 text-white'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                        }`}>
                          <Package className="w-4 h-4" />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white truncate">
                              {rm.name}
                            </span>
                            <span className="font-mono text-[11px] font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 shrink-0">
                              {rm.code}
                            </span>
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200 dark:border-purple-800 shrink-0">
                              <Tag className="w-2.5 h-2.5 text-purple-500" />
                              {categoryName}
                            </span>
                          </div>

                          {rm.description && (
                            <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate mt-0.5">
                              {rm.description}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Stock & Selection Indicator */}
                      <div className="flex items-center gap-2 shrink-0 justify-between sm:justify-end pl-11 sm:pl-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {/* Stock Badge */}
                          {isOutOfStock ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold font-mono bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                              0 {uomLabel} (Out)
                            </span>
                          ) : isLowStock ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold font-mono bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                              {availableQty.toLocaleString('en-IN', { maximumFractionDigits: 4 })} {uomLabel} (Low)
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold font-mono bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                              {availableQty.toLocaleString('en-IN', { maximumFractionDigits: 4 })} {uomLabel}
                            </span>
                          )}

                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                            <Scale className="w-2.5 h-2.5 opacity-70" />
                            {uomLabel}
                          </span>
                        </div>

                        <div className="shrink-0 ml-1">
                          {isSelected ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 dark:text-indigo-400 px-2 py-1 rounded-lg bg-indigo-100 dark:bg-indigo-900/60">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Selected
                            </span>
                          ) : (
                            <span className="text-[11px] font-semibold text-slate-500 group-hover:text-indigo-600 px-2 py-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
                              Select &rarr;
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/70 flex items-center justify-between text-xs">
              <span className="text-[11px] text-slate-400 dark:text-slate-500">
                Tip: Press <kbd className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 font-mono text-[10px]">Esc</kbd> to close
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsOpen(false)}
                className="h-8 px-4 text-xs font-semibold rounded-xl"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
