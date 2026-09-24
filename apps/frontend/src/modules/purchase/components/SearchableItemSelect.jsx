import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Search, X, ChevronDown, Check, Plus, Package, Layers, Tag, Scale, 
  CheckSquare, Square, AlertTriangle, Sparkles, CheckCircle2 
} from 'lucide-react';
import { Button } from '@/components/ui/button';

export const normalizeForSearch = (str) => (str || '').toLowerCase().replace(/[\s\-_.,/]+/g, '');

export default React.forwardRef(function SearchableItemSelect(
  {
    rawMaterials = [],
    value = null,
    onChange,
    onAddMultiple,
    addedItemIds = new Set(),
    lowStockIds = new Set(),
    placeholder = 'Search by Name (e.g. straw berry), Code, Category, or UOM...',
    error = false,
  },
  ref
) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL'); // 'ALL' | 'RAW_MATERIAL' | 'NON_INVENTORY'
  const [selectedIds, setSelectedIds] = useState(new Set());
  const containerRef = useRef(null);
  const searchRef = useRef(null);

  // Keep a ref to the latest props so close handlers always have latest data
  const propsRef = useRef({ rawMaterials, addedItemIds, onAddMultiple, onChange });
  useEffect(() => {
    propsRef.current = { rawMaterials, addedItemIds, onAddMultiple, onChange };
  }, [rawMaterials, addedItemIds, onAddMultiple, onChange]);

  const insertItems = (itemsToInsert) => {
    if (!itemsToInsert || itemsToInsert.length === 0) return;
    const { onAddMultiple: addMulti, onChange: addSingle, addedItemIds: currentAdded } = propsRef.current;
    const unadded = itemsToInsert.filter(i => !currentAdded.has(i.id));
    if (unadded.length === 0) return;

    if (addMulti) {
      addMulti(unadded);
    } else if (addSingle) {
      unadded.forEach(item => addSingle(item));
    }
  };

  const closeDropdown = () => {
    // Automatically insert any pending selected items before closing
    if (selectedIds.size > 0) {
      const { rawMaterials: allRms, addedItemIds: currentAdded } = propsRef.current;
      const pending = allRms.filter(i => selectedIds.has(i.id) && !currentAdded.has(i.id));
      if (pending.length > 0) {
        insertItems(pending);
      }
    }
    setOpen(false);
    setSearch('');
    setSelectedIds(new Set());
  };

  React.useImperativeHandle(ref, () => ({
    openDropdown: () => {
      setOpen(true);
      setTimeout(() => {
        containerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        searchRef.current?.focus();
      }, 50);
    },
    closeDropdown,
    focusSearch: () => searchRef.current?.focus(),
  }));

  const rmCount = useMemo(() => rawMaterials.filter(it => it.itemType === 'RAW_MATERIAL').length, [rawMaterials]);
  const nonInvCount = useMemo(() => rawMaterials.filter(it => it.itemType === 'NON_INVENTORY').length, [rawMaterials]);

  // Space-tolerant, fuzzy & token-based item filtering
  const filtered = useMemo(() => {
    return rawMaterials.filter(item => {
      if (typeFilter !== 'ALL' && item.itemType !== typeFilter) return false;
      const q = search.trim();
      if (!q) return true;

      const qNorm = normalizeForSearch(q);
      const tokens = q.toLowerCase().split(/\s+/).filter(Boolean);

      const nameStr = item.name || '';
      const codeStr = item.code || '';
      const catStr = item.categoryName || item.category?.name || (typeof item.category === 'string' ? item.category : '') || '';
      const uomStr = item.displayUom || item.unitId || item.consumptionUnit || '';
      const descStr = item.description || '';
      const typeStr = item.itemTypeLabel || '';

      const composite = `${nameStr} ${codeStr} ${catStr} ${uomStr} ${descStr} ${typeStr}`;
      const compositeNorm = normalizeForSearch(composite);
      const nameNorm = normalizeForSearch(nameStr);
      const codeNorm = normalizeForSearch(codeStr);

      // Direct or space-removed match
      if (nameNorm.includes(qNorm) || codeNorm.includes(qNorm) || compositeNorm.includes(qNorm)) {
        return true;
      }

      // Token match: every token in search query matches somewhere
      return tokens.every(token => {
        const tokenNorm = normalizeForSearch(token);
        return composite.toLowerCase().includes(token) || compositeNorm.includes(tokenNorm);
      });
    });
  }, [rawMaterials, typeFilter, search]);

  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        closeDropdown();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [selectedIds]);

  useEffect(() => {
    if (open && searchRef.current) {
      searchRef.current.focus();
    }
  }, [open]);

  // When clicking an item or its checkbox: AUTO-INSERT IMMEDIATELY!
  const handleItemClick = (item, e) => {
    if (e) e.stopPropagation();
    
    // If not already in the order table, insert it immediately!
    if (!addedItemIds.has(item.id)) {
      insertItems([item]);
      setSelectedIds(prev => {
        const next = new Set(prev);
        next.add(item.id);
        return next;
      });
    } else {
      // Already added, update selected indicator
      setSelectedIds(prev => {
        const next = new Set(prev);
        if (next.has(item.id)) next.delete(item.id);
        else next.add(item.id);
        return next;
      });
    }
  };

  const handleSelectAllFiltered = (e) => {
    if (e) e.preventDefault();
    const unadded = filtered.filter(i => !addedItemIds.has(i.id));
    if (unadded.length > 0) {
      insertItems(unadded);
    }
    setSelectedIds(new Set(filtered.map(i => i.id)));
  };

  const handleClearSelection = (e) => {
    if (e) e.preventDefault();
    setSelectedIds(new Set());
  };

  const handleClear = (e) => {
    e.stopPropagation();
    if (onChange) onChange(null);
    setSearch('');
  };

  const isSelectedNonInv = value?.itemType === 'NON_INVENTORY';
  const selectedCategoryName = value ? (value.categoryName || value.category?.name || (typeof value.category === 'string' ? value.category : '')) : '';
  const selectedUomLabel = value ? (value.displayUom || value.unitId || value.consumptionUnit || 'units').toUpperCase() : '';

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => {
          if (open) closeDropdown();
          else setOpen(true);
        }}
        className={`w-full px-2.5 sm:px-3.5 h-10 border rounded-xl text-left flex items-center justify-between transition-all duration-150 shadow-xs ${
          open 
            ? 'bg-indigo-50/70 border-indigo-500 ring-2 ring-indigo-500/15 dark:bg-indigo-950/40 dark:border-indigo-500' 
            : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 hover:border-indigo-400 dark:hover:border-indigo-500'
        } ${error ? 'border-rose-400 ring-2 ring-rose-500/20 bg-rose-50/30' : ''}`}
      >
        <div className="flex items-center gap-2 truncate min-w-0 flex-1">
          <div className={`p-1 rounded-md shrink-0 ${
            isSelectedNonInv 
              ? 'bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400' 
              : 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400'
          }`}>
            {isSelectedNonInv ? <Layers className="w-3.5 h-3.5" /> : <Package className="w-3.5 h-3.5" />}
          </div>

          {value ? (
            <div className="flex items-center gap-1.5 sm:gap-2 truncate flex-wrap">
              <span className="font-semibold text-slate-900 dark:text-white text-xs truncate">
                {value.code} — {value.name}
              </span>
              <span className={`inline-flex items-center px-1.5 sm:px-2 py-0.5 rounded text-[10px] font-bold shrink-0 ${
                isSelectedNonInv 
                  ? 'bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200/80 dark:border-purple-800/60' 
                  : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/60'
              }`}>
                {isSelectedNonInv ? '🚫 Non-Inventory' : '🌾 Raw Material'}
              </span>
              {selectedCategoryName && (
                <span className="inline-flex items-center px-1.5 sm:px-2 py-0.5 rounded text-[10px] font-semibold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800/60 shrink-0">
                  <Tag className="w-2.5 h-2.5 mr-0.5 sm:mr-1 opacity-70" />
                  {selectedCategoryName}
                </span>
              )}
              {selectedUomLabel && (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold font-mono bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/60 shrink-0">
                  <Scale className="w-2.5 h-2.5 mr-0.5 sm:mr-1 opacity-70" />
                  {selectedUomLabel}
                </span>
              )}
            </div>
          ) : (
            <span className="text-slate-400 dark:text-slate-500 text-xs truncate font-medium">
              {placeholder}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0 ml-1.5">
          {value && (
            <span
              onMouseDown={handleClear}
              className="text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/50 cursor-pointer p-0.5 rounded transition-colors"
              title="Clear selection"
            >
              <X className="w-3.5 h-3.5" />
            </span>
          )}
          <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${open ? 'rotate-180 text-indigo-500' : ''}`} />
        </div>
      </button>

      {/* Dropdown Menu */}
      {open && (
        <div className="absolute z-50 mt-1.5 left-0 right-0 w-full max-w-[calc(100vw-1.5rem)] sm:max-w-none bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in-50 zoom-in-95 duration-150 ring-1 ring-black/5 dark:ring-white/5">
          {/* Quick Filter Tabs */}
          <div className="flex items-center gap-1.5 p-2 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/70 overflow-x-auto">
            <button
              type="button"
              onMouseDown={(e) => { e.preventDefault(); setTypeFilter('ALL'); }}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all shrink-0 ${
                typeFilter === 'ALL'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}
            >
              All Items ({rawMaterials.length})
            </button>
            <button
              type="button"
              onMouseDown={(e) => { e.preventDefault(); setTypeFilter('RAW_MATERIAL'); }}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all shrink-0 flex items-center gap-1 ${
                typeFilter === 'RAW_MATERIAL'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-white dark:bg-slate-800 text-emerald-700 dark:text-emerald-400 border border-slate-200 dark:border-slate-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/40'
              }`}
            >
              <span>🌾 Raw Materials</span>
              <span className="text-[10px] opacity-80 font-mono">({rmCount})</span>
            </button>
            <button
              type="button"
              onMouseDown={(e) => { e.preventDefault(); setTypeFilter('NON_INVENTORY'); }}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all shrink-0 flex items-center gap-1 ${
                typeFilter === 'NON_INVENTORY'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'bg-white dark:bg-slate-800 text-purple-700 dark:text-purple-400 border border-slate-200 dark:border-slate-700 hover:bg-purple-50 dark:hover:bg-purple-950/40'
              }`}
            >
              <span>🚫 Non-Inventory</span>
              <span className="text-[10px] opacity-80 font-mono">({nonInvCount})</span>
            </button>
          </div>

          {/* Search Input Bar */}
          <div className="p-2 border-b border-slate-100 dark:border-slate-800 relative bg-slate-50/70 dark:bg-slate-950/70">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              ref={searchRef}
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search (e.g. straw berry with space, code, category)..."
              className="w-full pl-8 pr-7 py-1.5 text-xs border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-slate-900 dark:text-white"
            />
            {search && (
              <button
                type="button"
                onMouseDown={() => setSearch('')}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 rounded"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Multi-Select Header Controls */}
          <div className="px-3 py-1.5 bg-slate-100/70 dark:bg-slate-800/60 border-b border-slate-200/70 dark:border-slate-700/60 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
            <div className="flex items-center gap-2">
              <span className="font-semibold">
                {filtered.length} matching item{filtered.length === 1 ? '' : 's'}
              </span>
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.2 rounded border border-emerald-200 dark:border-emerald-800">
                ⚡ Auto-inserts on click/checkbox
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onMouseDown={handleSelectAllFiltered}
                className="text-indigo-600 dark:text-indigo-400 hover:underline font-bold"
              >
                + Insert All Filtered
              </button>
              {selectedIds.size > 0 && (
                <>
                  <span>•</span>
                  <button
                    type="button"
                    onMouseDown={handleClearSelection}
                    className="text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 font-medium"
                  >
                    Clear
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Items List */}
          <ul className="max-h-64 sm:max-h-80 overflow-y-auto p-1.5 space-y-1">
            {filtered.length === 0 ? (
              <li className="px-3 py-6 text-xs text-slate-400 flex flex-col items-center justify-center">
                <Search className="w-5 h-5 text-slate-300 dark:text-slate-600 mb-1" />
                <span className="font-medium">No items matched "{search}"</span>
                <span className="text-[10px] text-slate-400 mt-0.5">Try searching by partial name, code, or unit</span>
              </li>
            ) : (
              filtered.map(rm => {
                const isNonInv = rm.itemType === 'NON_INVENTORY';
                const isAlreadyAdded = addedItemIds.has(rm.id);
                const isChecked = isAlreadyAdded || selectedIds.has(rm.id);
                const categoryName = rm.categoryName || rm.category?.name || (typeof rm.category === 'string' ? rm.category : '') || (isNonInv ? 'Non-Inventory' : 'General');
                const uomLabel = (rm.displayUom || rm.unitId || rm.consumptionUnit || 'units').toUpperCase();

                // Live Stock calculation
                const liveStockQty = rm.currentStock != null ? Number(rm.currentStock) : (rm.availableQuantity != null ? Number(rm.availableQuantity) : null);
                const alertLevel = rm.alertLevel != null ? Number(rm.alertLevel) : null;
                const isLow = rm.isLowStock || (alertLevel != null && liveStockQty != null && liveStockQty <= alertLevel);

                return (
                  <li
                    key={rm.id}
                    onMouseDown={(e) => handleItemClick(rm, e)}
                    className={`px-2.5 sm:px-3 py-2 text-xs cursor-pointer rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 sm:gap-3 transition-all ${
                      isAlreadyAdded
                        ? 'bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/80 shadow-2xs'
                        : isChecked
                        ? 'bg-indigo-50/90 dark:bg-indigo-950/70 border border-indigo-200 dark:border-indigo-800'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100/90 dark:hover:bg-slate-800/80 border border-transparent'
                    }`}
                  >
                    {/* Checkbox and Name */}
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <button
                        type="button"
                        onClick={(e) => handleItemClick(rm, e)}
                        className="text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 shrink-0 transition-colors"
                        title={isAlreadyAdded ? "Item already in order" : "Click to insert item"}
                      >
                        {isChecked ? (
                          <CheckSquare className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-300 dark:text-slate-600 hover:text-indigo-500" />
                        )}
                      </button>

                      <div className={`p-1 rounded-lg shrink-0 ${
                        isNonInv 
                          ? 'bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400' 
                          : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400'
                      }`}>
                        {isNonInv ? <Layers className="w-3.5 h-3.5" /> : <Package className="w-3.5 h-3.5" />}
                      </div>

                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`font-semibold text-xs truncate ${isLow ? 'text-amber-800 dark:text-amber-300' : 'text-slate-900 dark:text-slate-100'}`}>
                            {rm.name}
                          </span>

                          {isNonInv ? (
                            <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.2 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-950/80 dark:text-purple-300 font-bold border border-purple-200 dark:border-purple-800 shrink-0">
                              Non-Inventory
                            </span>
                          ) : (
                            <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.2 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-300 font-bold border border-emerald-200 dark:border-emerald-800 shrink-0">
                              Raw Material
                            </span>
                          )}

                          {isAlreadyAdded && (
                            <span className="inline-flex items-center gap-1 text-[9px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100/90 dark:bg-emerald-950/90 px-1.5 py-0.2 rounded-md border border-emerald-300 dark:border-emerald-700 shrink-0">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                              In Order
                            </span>
                          )}
                        </div>

                        {rm.description && rm.description !== rm.name && (
                          <span className="text-[10px] text-slate-400 dark:text-slate-500 truncate">
                            {rm.description}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Metadata, Live Stock & Actions */}
                    <div className="flex items-center gap-1.5 shrink-0 flex-wrap sm:flex-nowrap pl-6 sm:pl-0 justify-between sm:justify-end">
                      {/* Live Stock Display Badge */}
                      {isNonInv ? (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200/80 dark:border-purple-800/60">
                          Non-Stock
                        </span>
                      ) : liveStockQty != null ? (
                        liveStockQty <= 0 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold font-mono bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                            🔴 Out of Stock: 0 {uomLabel}
                          </span>
                        ) : isLow ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold font-mono bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800 animate-pulse">
                            ⚠️ Stock: {liveStockQty} {uomLabel} (Low)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold font-mono bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800">
                            📦 Stock: {liveStockQty} {uomLabel}
                          </span>
                        )
                      ) : null}

                      {/* Category */}
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800/60">
                        <Tag className="w-2.5 h-2.5 mr-1 opacity-70" />
                        {categoryName}
                      </span>

                      {/* UOM */}
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-bold uppercase bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700 font-mono">
                        <Scale className="w-2.5 h-2.5 mr-1 opacity-70" />
                        {uomLabel}
                      </span>

                      {/* Code */}
                      <span className="text-[10px] font-mono font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded-md border border-slate-200 dark:border-slate-700">
                        {rm.code}
                      </span>

                      {/* Unit Rate if available */}
                      {rm.ratePerUnit ? (
                        <span className="text-[10px] font-semibold text-slate-700 dark:text-slate-200 font-mono ml-0.5">
                          ₹{Number(rm.ratePerUnit).toFixed(2)}
                        </span>
                      ) : null}

                      {/* Auto-Add Indicator / Button */}
                      <button
                        type="button"
                        onClick={(e) => handleItemClick(rm, e)}
                        className={`ml-1 p-1 rounded-md transition-colors ${
                          isAlreadyAdded
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-300 cursor-default'
                            : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:hover:bg-indigo-900 dark:text-indigo-300 cursor-pointer'
                        }`}
                        title={isAlreadyAdded ? "In Order" : "Click to insert"}
                      >
                        {isAlreadyAdded ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </li>
                );
              })
            )}
          </ul>

          {/* Sticky Bottom Actions Bar */}
          <div className="p-2.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-950/90 flex items-center justify-between gap-2">
            <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
              <span>
                Items insert <strong>instantly</strong> when clicked or checked.
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                onClick={closeDropdown}
                className="h-7 px-3.5 text-xs font-bold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs"
              >
                <Check className="w-3.5 h-3.5 mr-1" />
                Done
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});
