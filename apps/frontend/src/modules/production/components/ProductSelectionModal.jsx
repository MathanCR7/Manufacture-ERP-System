import React, { useState, useMemo, useEffect } from 'react';
import { 
  Sparkles, Search, X, Check, Package, ArrowUpDown, 
  ChevronRight, Tag, Layers, Filter 
} from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function ProductSelectionModal({
  isOpen = false,
  onClose,
  products = [],
  onSelectProduct,
  title = 'Select Finished Product for Production',
  rowNumber = null
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBaseCategory, setSelectedBaseCategory] = useState('All');
  const [selectedSubcategory, setSelectedSubcategory] = useState('All');
  const [categorySearchQuery, setCategorySearchQuery] = useState('');
  const [subcategorySearchQuery, setSubcategorySearchQuery] = useState('');

  // Reset filters when modal opens
  useEffect(() => {
    if (isOpen) {
      setSearchQuery('');
      setSelectedBaseCategory('All');
      setSelectedSubcategory('All');
      setCategorySearchQuery('');
      setSubcategorySearchQuery('');
    }
  }, [isOpen]);

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Extract distinct base categories from products
  const baseCategories = useMemo(() => {
    const set = new Set();
    products.forEach(p => {
      const base = p.base?.name || p.specifications?.baseCategory || p.specifications?.group || p.category?.name;
      if (base && String(base).trim()) set.add(String(base).trim());
    });
    return ['All', ...Array.from(set).sort()];
  }, [products]);

  // Filtered base categories by search
  const filteredBaseCategories = useMemo(() => {
    if (!categorySearchQuery) return baseCategories;
    return baseCategories.filter(c => 
      c.toLowerCase().includes(categorySearchQuery.toLowerCase())
    );
  }, [baseCategories, categorySearchQuery]);

  // Extract subcategories for the selected base category
  const screenedSubcategories = useMemo(() => {
    if (selectedBaseCategory === 'All') return ['All'];
    const set = new Set();
    products.forEach(p => {
      const base = p.base?.name || p.specifications?.baseCategory || p.specifications?.group || p.category?.name;
      if (base === selectedBaseCategory) {
        const sub = p.subcategory?.name || p.specifications?.subcategory;
        if (sub && String(sub).trim()) set.add(String(sub).trim());
      }
    });
    let list = ['All', ...Array.from(set).sort()];
    if (subcategorySearchQuery) {
      list = list.filter(s => s.toLowerCase().includes(subcategorySearchQuery.toLowerCase()));
    }
    return list;
  }, [products, selectedBaseCategory, subcategorySearchQuery]);

  // Filter products by search, base category, and subcategory
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const sysCode = p.code || p.systemCode || '';
      const name = p.name || '';
      const cat = p.category?.name || '';
      const subcat = p.subcategory?.name || p.specifications?.subcategory || '';
      const base = p.base?.name || p.specifications?.baseCategory || p.specifications?.group || '';

      // Text search
      if (searchQuery) {
        const q = searchQuery.toLowerCase().trim();
        const matches = 
          sysCode.toLowerCase().includes(q) ||
          name.toLowerCase().includes(q) ||
          cat.toLowerCase().includes(q) ||
          subcat.toLowerCase().includes(q) ||
          base.toLowerCase().includes(q);
        if (!matches) return false;
      }

      // Base category filter
      if (selectedBaseCategory !== 'All') {
        const pBase = base || cat;
        if (pBase !== selectedBaseCategory) return false;
      }

      // Subcategory filter
      if (selectedSubcategory !== 'All') {
        if (subcat !== selectedSubcategory) return false;
      }

      return true;
    });
  }, [products, searchQuery, selectedBaseCategory, selectedSubcategory]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
      <div 
        className="w-full max-w-5xl bg-white dark:bg-slate-900 border-2 border-amber-400 dark:border-amber-500 shadow-2xl rounded-2xl flex flex-col overflow-hidden text-xs max-h-[85vh] animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* ── HEADER ── */}
        <div className="bg-slate-900 text-white px-4 py-2.5 flex items-center justify-between select-none border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <h3 className="font-extrabold text-sm text-white">
              {rowNumber ? `Select Product for Row #${rowNumber}` : title}
            </h3>
            <span className="text-[11px] font-mono font-bold text-amber-300 bg-slate-800 px-2 py-0.5 rounded-full border border-amber-400/30">
              {filteredProducts.length} items
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white rounded-lg p-1 transition-colors cursor-pointer"
            title="Close (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── TOP SEARCH INPUT BAR ── */}
        <div className="p-3 bg-slate-50 dark:bg-slate-850 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2">
          <div className="relative flex-1 flex items-center">
            <Search className="w-4 h-4 text-amber-500 absolute left-3 pointer-events-none" />
            <input
              type="text"
              autoFocus
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && filteredProducts.length > 0) {
                  e.preventDefault();
                  onSelectProduct(filteredProducts[0]);
                  onClose();
                }
              }}
              placeholder="Search System Code, Product Name, Category, Subcategory (e.g. K123, kulfistick, kulfi almond)..."
              className="w-full pl-9 pr-8 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 shadow-3xs"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 text-slate-400 hover:text-slate-600 text-xs font-bold cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* ── 2-TIER SCREENING BAR: BASE CATEGORY -> SUBCATEGORY ── */}
        <div className="px-3 py-2 bg-slate-100 dark:bg-slate-800/90 border-b border-slate-200 dark:border-slate-700 space-y-2">
          
          {/* Level 1: Base Category Selector */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
            <div className="relative shrink-0 flex items-center">
              <Search className="w-3 h-3 text-slate-400 absolute left-2 pointer-events-none" />
              <input
                type="text"
                value={categorySearchQuery}
                onChange={(e) => setCategorySearchQuery(e.target.value)}
                placeholder="Search Base Category..."
                className="w-40 h-[24px] pl-6 pr-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-[10px] outline-none focus:border-amber-500"
              />
            </div>

            <span className="text-[10px] font-extrabold uppercase text-slate-500 shrink-0">
              BASE CATEGORY:
            </span>

            {filteredBaseCategories.map(cat => (
              <button
                key={cat}
                type="button"
                onClick={() => {
                  setSelectedBaseCategory(cat);
                  setSelectedSubcategory('All');
                }}
                className={`px-2.5 py-1 rounded-full text-[10.5px] font-bold shrink-0 cursor-pointer transition-all ${
                  selectedBaseCategory === cat
                    ? 'bg-amber-500 text-slate-950 shadow-xs scale-[1.02]'
                    : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Level 2: Subcategories (screened by selected Base Category) */}
          <div className="flex items-center gap-2 overflow-x-auto pt-1.5 border-t border-slate-200/60 dark:border-slate-700/60 scrollbar-thin">
            <span className="text-[10px] font-extrabold uppercase text-indigo-600 dark:text-indigo-400 shrink-0">
              SUBCATEGORY:
            </span>

            {selectedBaseCategory === 'All' ? (
              <span className="text-[10.5px] text-slate-500 italic flex items-center gap-1">
                👉 Click any Base Category above to screen subcategories (e.g. Family Pack ➔ Family Pack 700ML)
              </span>
            ) : (
              <>
                <div className="relative shrink-0 flex items-center">
                  <input
                    type="text"
                    value={subcategorySearchQuery}
                    onChange={(e) => setSubcategorySearchQuery(e.target.value)}
                    placeholder={`Screen ${selectedBaseCategory} subcategories...`}
                    className="w-44 h-[22px] px-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-[10px] outline-none focus:border-indigo-500"
                  />
                </div>

                {screenedSubcategories.map(sub => (
                  <button
                    key={sub}
                    type="button"
                    onClick={() => setSelectedSubcategory(sub)}
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold shrink-0 cursor-pointer transition-colors ${
                      selectedSubcategory === sub
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    {sub === 'All' ? `All (${selectedBaseCategory})` : sub}
                  </button>
                ))}
              </>
            )}
          </div>
        </div>

        {/* ── PRODUCTS TABLE GRID ── */}
        <div className="flex-1 overflow-y-auto max-h-[380px] divide-y divide-slate-100 dark:divide-slate-800">
          
          {/* Table Header */}
          <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 text-[10px] font-black text-slate-500 uppercase tracking-wider sticky top-0 z-10 border-b border-slate-200 dark:border-slate-700 select-none">
            <div className="col-span-2">SYSTEM CODE *</div>
            <div className="col-span-3">PRODUCT NAME *</div>
            <div className="col-span-2">CATEGORY *</div>
            <div className="col-span-2">BASE / SUBCATEGORY</div>
            <div className="col-span-1 text-center">UNIT *</div>
            <div className="col-span-1 text-right">SALE PRICE *</div>
            <div className="col-span-1 text-center">STOCK</div>
          </div>

          {/* Table Rows */}
          {filteredProducts.map((p) => {
            const sysCode = p.code || p.systemCode || 'N/A';
            const pName = p.name || 'Unnamed Product';
            const cat = p.category?.name || p.specifications?.group || '-';
            const baseCat = p.base?.name || p.specifications?.baseCategory || p.specifications?.baseName || '';
            const subcat = p.subcategory?.name || p.specifications?.subcategory || '';
            const unit = p.unit?.abbreviation || p.unit?.name || p.unitId || 'pcs';
            const price = Number(p.salePrice || p.price || p.mrp || 0);
            const stock = Number(p.currentStock || 0);

            return (
              <div
                key={p.id}
                onClick={() => {
                  onSelectProduct(p);
                  onClose();
                }}
                className="grid grid-cols-12 gap-2 px-4 py-2 hover:bg-amber-50/80 dark:hover:bg-slate-800/80 cursor-pointer items-center transition-colors group text-[11px]"
              >
                {/* System Code */}
                <div className="col-span-2 font-mono font-bold text-amber-700 dark:text-amber-400 truncate">
                  {sysCode}
                </div>

                {/* Product Name (Never truncated: wraps & tooltip) */}
                <div 
                  className="col-span-3 font-bold text-slate-900 dark:text-white group-hover:text-amber-600 transition-colors break-words whitespace-normal leading-tight"
                  title={pName}
                >
                  {pName}
                </div>

                {/* Category */}
                <div className="col-span-2 text-slate-600 dark:text-slate-300 font-medium truncate text-[10.5px]">
                  {cat}
                </div>

                {/* Base / Subcategory */}
                <div className="col-span-2 text-slate-500 dark:text-slate-400 text-[10px] truncate">
                  {baseCat} {subcat ? `• ${subcat}` : ''}
                </div>

                {/* Unit of Measure */}
                <div className="col-span-1 text-center text-slate-700 dark:text-slate-300 font-bold">
                  {unit}
                </div>

                {/* Sale Price */}
                <div className="col-span-1 text-right font-black text-slate-900 dark:text-white">
                  ₹{price.toFixed(0)}
                </div>

                {/* Stock with Dot Status */}
                <div className="col-span-1 text-center">
                  <span className={`px-2 py-0.5 rounded-full font-mono font-bold text-[10px] inline-flex items-center gap-1 ${
                    stock > 0 
                      ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300' 
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${stock > 0 ? 'bg-emerald-500' : 'bg-slate-400'}`}></span>
                    {stock}
                  </span>
                </div>
              </div>
            );
          })}

          {filteredProducts.length === 0 && (
            <div className="p-8 text-center text-slate-400">
              <Package className="w-8 h-8 mx-auto mb-2 opacity-40 text-amber-500" />
              <p className="font-bold text-xs">No products match your search or category filters.</p>
              <p className="text-[10px] mt-1">Try clearing filters or changing base category screening.</p>
            </div>
          )}
        </div>

        {/* ── FOOTER ── */}
        <div className="bg-slate-50 dark:bg-slate-850 px-4 py-2 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500">
          <span>Click any row to select into grid • Esc to close</span>
          <Button
            size="sm"
            onClick={onClose}
            className="rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-bold h-7 px-3 text-xs"
          >
            Done
          </Button>
        </div>

      </div>
    </div>
  );
}
