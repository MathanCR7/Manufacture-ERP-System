import React, { useState, useMemo, useEffect } from 'react';
import { 
  Sparkles, Search, X, Check, Package, ArrowUpDown, 
  ChevronRight, Tag, Layers, Filter, LayoutGrid, Table, 
  RotateCcw, CheckCircle2, Plus, Info
} from 'lucide-react';
import { Button } from '@/components/ui/button';

// Helper to extract fields safely
const getProductSystemCode = (p) => p?.code || p?.systemCode || p?.sku || 'N/A';
const getProductName = (p) => p?.name || 'Unnamed Product';
const getProductCategory = (p) => p?.category?.name || p?.categoryName || p?.specifications?.category || '-';
const getProductBaseCategory = (p) => p?.base?.name || p?.specifications?.baseCategory || p?.specifications?.baseName || p?.brand || '-';
const getProductSubcategory = (p) => p?.subcategory?.name || p?.subcategoryName || p?.specifications?.subcategory || p?.specifications?.series || p?.specifications?.group || '-';
const getProductUnitOfSale = (p) => p?.unit?.abbreviation || p?.unit?.name || p?.unitOfSale || p?.unit || 'pcs';
const getProductSalePrice = (p) => Number(p?.salePrice !== undefined ? p.salePrice : (p?.price || p?.mrp || 0));
const getProductLiveStock = (p) => Number(p?.currentStock !== undefined ? p.currentStock : (p?.stock !== undefined ? p.stock : (p?.batchStock || 0)));

// Optimized Product Search Index Builder (multi-field, space & punctuation agnostic)
export const createProductSearchIndex = (p) => {
  const code = (getProductSystemCode(p) || '').toLowerCase();
  const name = (getProductName(p) || '').toLowerCase();
  const cat = (getProductCategory(p) || '').toLowerCase();
  const baseCat = (getProductBaseCategory(p) || '').toLowerCase();
  const subcat = (getProductSubcategory(p) || '').toLowerCase();
  const cleanSubcat = subcat === '-' ? '' : subcat;
  const unit = (getProductUnitOfSale(p) || '').toLowerCase();
  const price = String(getProductSalePrice(p) || '');
  const stock = String(getProductLiveStock(p) || '');

  const codeCompact = code.replace(/[^a-z0-9]/g, '');
  const nameCompact = name.replace(/[^a-z0-9]/g, '');
  const catCompact = cat.replace(/[^a-z0-9]/g, '');
  const baseCatCompact = baseCat.replace(/[^a-z0-9]/g, '');
  const subcatCompact = cleanSubcat.replace(/[^a-z0-9]/g, '');
  const unitCompact = unit.replace(/[^a-z0-9]/g, '');

  const combined = `${code} ${name} ${cat} ${baseCat} ${cleanSubcat} ${unit} ${price} ${stock}`.trim();
  const combinedCompact = `${codeCompact}${nameCompact}${catCompact}${baseCatCompact}${subcatCompact}${unitCompact}`;

  return {
    code,
    name,
    cat,
    baseCat,
    subcat: cleanSubcat,
    unit,
    price,
    stock,
    codeCompact,
    nameCompact,
    catCompact,
    baseCatCompact,
    subcatCompact,
    unitCompact,
    combined,
    combinedCompact
  };
};

// Ultra-fast multi-token matcher supporting "gallon pista", "pista gallon", "pis gal" etc.
export const matchProductSearch = (index, query) => {
  if (!query) return { matched: true, score: 0 };
  const rawQ = query.trim().toLowerCase();
  if (!rawQ) return { matched: true, score: 0 };

  const compactQ = rawQ.replace(/[^a-z0-9]/g, '');

  // 1. Direct code exact match
  if (index.code === rawQ || (compactQ && index.codeCompact === compactQ)) {
    return { matched: true, score: 1000 };
  }

  // 2. Code starts with
  if (index.code.startsWith(rawQ) || (compactQ && index.codeCompact.startsWith(compactQ))) {
    return { matched: true, score: 900 };
  }

  // 3. Name exact match
  if (index.name === rawQ || (compactQ && index.nameCompact === compactQ)) {
    return { matched: true, score: 850 };
  }

  // 4. Name starts with
  if (index.name.startsWith(rawQ) || (compactQ && index.nameCompact.startsWith(compactQ))) {
    return { matched: true, score: 750 };
  }

  // 5. Name contains
  if (index.name.includes(rawQ) || (compactQ && index.nameCompact.includes(compactQ))) {
    return { matched: true, score: 650 };
  }

  // 6. Direct combined raw phrase match
  if (index.combined.includes(rawQ)) {
    return { matched: true, score: 550 };
  }

  // 7. Space-less full query match across concatenated fields
  if (compactQ && index.combinedCompact.includes(compactQ)) {
    return { matched: true, score: 500 };
  }

  // 8. Multi-token match: every whitespace-separated token must match at least one field
  // e.g. "gallon pista" or "pis gal" -> token "pis" and token "gal" both match!
  const tokens = rawQ.split(/[\s,+/•\-]+/).filter(Boolean);
  if (tokens.length > 0) {
    let allTokensMatch = true;
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      const tokenCompact = token.replace(/[^a-z0-9]/g, '');

      const tokenMatched = 
        index.combined.includes(token) ||
        (tokenCompact && (
          index.combinedCompact.includes(tokenCompact) ||
          index.codeCompact.includes(tokenCompact) ||
          index.nameCompact.includes(tokenCompact) ||
          index.catCompact.includes(tokenCompact) ||
          index.baseCatCompact.includes(tokenCompact) ||
          index.subcatCompact.includes(tokenCompact) ||
          index.unitCompact.includes(tokenCompact)
        ));

      if (!tokenMatched) {
        allTokensMatch = false;
        break;
      }
    }

    if (allTokensMatch) {
      return { matched: true, score: 450 };
    }
  }

  return { matched: false, score: 0 };
};

export default function ProductSelectionModal({
  isOpen = false,
  onClose,
  products = [],
  onSelectProduct,
  selectedProducts = [],
  title = 'Item Catalog Browser',
  selectedBaseName = '',
  rowNumber = null
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBaseCategory, setSelectedBaseCategory] = useState('All');
  const [selectedSubcategory, setSelectedSubcategory] = useState('All');
  const [categorySearchQuery, setCategorySearchQuery] = useState('');
  const [subcategorySearchQuery, setSubcategorySearchQuery] = useState('');
  const [viewMode, setViewMode] = useState('table'); // 'table' | 'cards'
  const [baseOnlyFilter, setBaseOnlyFilter] = useState(false);

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

  // Pre-indexed products for instant multi-field searching
  const productsWithIndex = useMemo(() => {
    return (products || []).map(p => ({
      product: p,
      index: createProductSearchIndex(p)
    }));
  }, [products]);

  // Extract distinct base categories from products
  const baseCategories = useMemo(() => {
    const set = new Set();
    (products || []).forEach(p => {
      const base = getProductBaseCategory(p) || getProductCategory(p);
      if (base && String(base).trim() && String(base).trim() !== '-') {
        set.add(String(base).trim());
      }
    });
    return ['All', ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [products]);

  // Filtered base categories by search
  const filteredBaseCategories = useMemo(() => {
    if (!categorySearchQuery.trim()) return baseCategories;
    const q = categorySearchQuery.toLowerCase().trim();
    return baseCategories.filter(c => c === 'All' || c.toLowerCase().includes(q));
  }, [baseCategories, categorySearchQuery]);

  // Extract subcategories for the selected base category
  const screenedSubcategories = useMemo(() => {
    if (selectedBaseCategory === 'All') return ['All'];
    const set = new Set();
    (products || []).forEach(p => {
      const base = getProductBaseCategory(p) || getProductCategory(p);
      if (base === selectedBaseCategory) {
        const sub = getProductSubcategory(p);
        if (sub && String(sub).trim() && String(sub).trim() !== '-') {
          set.add(String(sub).trim());
        }
      }
    });
    let list = ['All', ...Array.from(set).sort((a, b) => a.localeCompare(b))];
    if (subcategorySearchQuery.trim()) {
      const q = subcategorySearchQuery.toLowerCase().trim();
      list = list.filter(s => s === 'All' || s.toLowerCase().includes(q));
    }
    return list;
  }, [products, selectedBaseCategory, subcategorySearchQuery]);

  // Filter products by base-only toggle, 2-tier screening, and multi-token search
  const filteredCatalogItems = useMemo(() => {
    let pool = productsWithIndex;

    // Optional base constraint filter
    if (baseOnlyFilter && selectedBaseName) {
      const bUpper = selectedBaseName.toUpperCase();
      pool = pool.filter(item => {
        const pBase = (getProductBaseCategory(item.product) || '').toUpperCase();
        return pBase.includes(bUpper);
      });
    }

    // Level 1 Base Category filter
    if (selectedBaseCategory !== 'All') {
      pool = pool.filter(item => {
        const pBase = getProductBaseCategory(item.product);
        const pCat = getProductCategory(item.product);
        return pBase === selectedBaseCategory || pCat === selectedBaseCategory;
      });
    }

    // Level 2 Subcategory filter
    if (selectedSubcategory !== 'All') {
      pool = pool.filter(item => getProductSubcategory(item.product) === selectedSubcategory);
    }

    // Text search using tokenized matcher
    if (searchQuery.trim()) {
      const q = searchQuery.trim();
      const scored = [];
      for (let i = 0; i < pool.length; i++) {
        const item = pool[i];
        const res = matchProductSearch(item.index, q);
        if (res.matched) {
          scored.push({
            product: item.product,
            score: res.score
          });
        }
      }

      scored.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return getProductSystemCode(a.product).localeCompare(getProductSystemCode(b.product));
      });

      return scored.map(s => s.product);
    }

    return pool.map(item => item.product);
  }, [productsWithIndex, baseOnlyFilter, selectedBaseName, selectedBaseCategory, selectedSubcategory, searchQuery]);

  // Check if product is already added in batch
  const isProductAdded = (productId) => {
    return (selectedProducts || []).some(sp => sp.productId === productId || sp.id === productId);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
      <div 
        className="w-full max-w-6xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 shadow-2xl rounded-2xl flex flex-col overflow-hidden text-xs max-h-[92vh] animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* ── HEADER ── */}
        <div className="bg-slate-900 text-white px-4 py-3 flex items-center justify-between select-none border-b border-slate-800">
          <div className="flex items-center gap-3 font-bold text-sm">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30 shrink-0">
              <Package className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-white font-extrabold text-sm sm:text-base tracking-tight">
                  {rowNumber ? `Select Product for Row #${rowNumber}` : title}
                </span>
                <span className="text-[11px] font-mono font-bold text-amber-300 bg-amber-950/60 px-2.5 py-0.5 rounded-full border border-amber-400/40">
                  {filteredCatalogItems.length} Products
                </span>
                {selectedBaseName && (
                  <span className="text-[11px] font-mono font-bold text-indigo-300 bg-indigo-950/60 px-2 py-0.5 rounded-full border border-indigo-400/30">
                    Formulated under: {selectedBaseName}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 font-normal">
                High-performance multi-field catalog search with live inventory stock verification
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* View Mode Toggle */}
            <div className="flex items-center bg-slate-800 rounded-lg p-0.5 border border-slate-700">
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`px-2.5 py-1 rounded-md flex items-center gap-1.5 text-xs font-bold transition-all cursor-pointer ${
                  viewMode === 'table' 
                    ? 'bg-amber-500 text-slate-950 shadow-xs' 
                    : 'text-slate-300 hover:text-white'
                }`}
                title="Table View"
              >
                <Table className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Table View</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('cards')}
                className={`px-2.5 py-1 rounded-md flex items-center gap-1.5 text-xs font-bold transition-all cursor-pointer ${
                  viewMode === 'cards' 
                    ? 'bg-amber-500 text-slate-950 shadow-xs' 
                    : 'text-slate-300 hover:text-white'
                }`}
                title="Cards View"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Cards View</span>
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-white rounded-lg p-1.5 transition-colors cursor-pointer ml-1"
              title="Close (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ── TOP SEARCH INPUT BAR ── */}
        <div className="p-3 bg-slate-50 dark:bg-slate-850 border-b border-slate-200 dark:border-slate-800 space-y-2.5">
          <div className="relative flex items-center">
            <Search className="w-4 h-4 text-amber-500 absolute left-3.5 pointer-events-none" />
            <input
              type="text"
              autoFocus
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search System Code, Product Name, Category, Base/Subcategory (e.g. BFD107, gallon pista, pista gallon, pis gal)..."
              className="w-full pl-10 pr-9 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 shadow-2xs placeholder:font-normal placeholder:text-slate-400"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 text-slate-400 hover:text-slate-600 text-xs font-bold cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>

          {/* ── 2-TIER SCREENING BAR: BASE CATEGORY -> SUBCATEGORY ── */}
          <div className="space-y-2 pt-0.5">
            {/* Level 1: Base Category Selector */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
              <div className="relative shrink-0 flex items-center">
                <Search className="w-3 h-3 text-slate-400 absolute left-2 pointer-events-none" />
                <input
                  type="text"
                  value={categorySearchQuery}
                  onChange={(e) => setCategorySearchQuery(e.target.value)}
                  placeholder="Search Category..."
                  className="w-36 h-[24px] pl-6 pr-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md text-[10px] outline-none focus:border-amber-500 font-medium"
                />
              </div>

              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 shrink-0">
                CATEGORY:
              </span>

              {filteredBaseCategories.map(cat => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => {
                    setSelectedBaseCategory(cat);
                    setSelectedSubcategory('All');
                  }}
                  className={`px-3 py-1 rounded-full text-[11px] font-bold shrink-0 cursor-pointer transition-all ${
                    selectedBaseCategory === cat
                      ? 'bg-amber-500 text-slate-950 shadow-xs scale-[1.02]'
                      : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-750'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Level 2: Subcategories (screened by selected Base Category) */}
            <div className="flex items-center gap-2 overflow-x-auto pt-1.5 border-t border-slate-200/60 dark:border-slate-700/60 scrollbar-thin">
              <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400 shrink-0">
                SUBCATEGORY:
              </span>

              {selectedBaseCategory === 'All' ? (
                <span className="text-[11px] text-slate-500 italic flex items-center gap-1">
                  👉 Click any Category above to view its specific subcategories
                </span>
              ) : (
                <>
                  <div className="relative shrink-0 flex items-center">
                    <input
                      type="text"
                      value={subcategorySearchQuery}
                      onChange={(e) => setSubcategorySearchQuery(e.target.value)}
                      placeholder={`Filter ${selectedBaseCategory}...`}
                      className="w-40 h-[22px] px-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md text-[10px] outline-none focus:border-indigo-500"
                    />
                  </div>

                  {screenedSubcategories.map(sub => (
                    <button
                      key={sub}
                      type="button"
                      onClick={() => setSelectedSubcategory(sub)}
                      className={`px-2.5 py-0.5 rounded-full text-[10.5px] font-bold shrink-0 cursor-pointer transition-colors ${
                        selectedSubcategory === sub
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      {sub === 'All' ? `All (${selectedBaseCategory})` : sub}
                    </button>
                  ))}
                </>
              )}
            </div>
          </div>
        </div>

        {/* ── CATALOG CONTENT AREA: TABLE OR CARDS ── */}
        <div className="flex-1 overflow-y-auto p-3">
          {filteredCatalogItems.length === 0 ? (
            <div className="p-12 text-center text-slate-400 space-y-2">
              <Package className="w-10 h-10 mx-auto text-amber-500/60" />
              <p className="font-bold text-sm text-slate-700 dark:text-slate-300">
                No products match your search or filter criteria
              </p>
              <p className="text-xs text-slate-500">
                Try searching with tokens (e.g. "pista gallon", "mango", "bfd") or select "All" categories.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedBaseCategory('All');
                  setSelectedSubcategory('All');
                }}
                className="mt-2 text-xs font-bold"
              >
                <RotateCcw className="w-3.5 h-3.5 mr-1" />
                Reset Filters
              </Button>
            </div>
          ) : viewMode === 'table' ? (
            /* ── TABLE VIEW MATCHING /sales/order SPEC ── */
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-white dark:bg-slate-900 shadow-2xs">
              <table className="w-full border-collapse text-xs select-text">
                <thead>
                  <tr className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-b border-slate-200 dark:border-slate-700 font-bold sticky top-0 z-10 select-none text-[11px]">
                    <th className="py-2.5 px-3 text-left w-10">#</th>
                    <th className="py-2.5 px-3 text-left w-32">System Code *</th>
                    <th className="py-2.5 px-3 text-left">Product Name *</th>
                    <th className="py-2.5 px-3 text-left w-40">Category *</th>
                    <th className="py-2.5 px-3 text-left w-44">Base / Subcategory</th>
                    <th className="py-2.5 px-3 text-center w-24">Unit *</th>
                    <th className="py-2.5 px-3 text-right w-32">Sale Price *</th>
                    <th className="py-2.5 px-3 text-center w-28">Live Stock</th>
                    <th className="py-2.5 px-3 text-center w-28">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredCatalogItems.map((p, idx) => {
                    const sysCode = getProductSystemCode(p);
                    const pName = getProductName(p);
                    const cat = getProductCategory(p);
                    const baseCat = getProductBaseCategory(p);
                    const subcat = getProductSubcategory(p);
                    const unitOfSale = getProductUnitOfSale(p);
                    const price = getProductSalePrice(p);
                    const liveStock = getProductLiveStock(p);
                    const added = isProductAdded(p.id);

                    return (
                      <tr
                        key={p.id}
                        className={`hover:bg-amber-50/70 dark:hover:bg-slate-800/60 transition-colors ${
                          added ? 'bg-indigo-50/40 dark:bg-indigo-950/20' : ''
                        }`}
                      >
                        <td className="py-2.5 px-3 text-slate-400 font-mono text-[10px]">
                          {idx + 1}
                        </td>
                        <td className="py-2.5 px-3 font-mono font-bold text-amber-700 dark:text-amber-400">
                          {sysCode}
                        </td>
                        <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-white">
                          <div className="break-words leading-tight" title={pName}>
                            {pName}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300 font-medium">
                          {cat}
                        </td>
                        <td className="py-2.5 px-3 text-slate-500 text-[11px]">
                          <div className="font-semibold text-slate-700 dark:text-slate-300">
                            {baseCat}
                          </div>
                          {subcat && subcat !== '-' && (
                            <div className="text-[10px] text-slate-400 pt-0.5">
                              {subcat}
                            </div>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-center font-bold text-slate-700 dark:text-slate-300">
                          {unitOfSale}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <div className="font-extrabold text-slate-900 dark:text-white font-mono">
                            ₹{price.toFixed(2)}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span className={`px-2.5 py-1 rounded-full font-mono font-bold text-[10.5px] inline-flex items-center gap-1.5 ${
                            liveStock > 0 
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800' 
                              : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-slate-300 dark:border-slate-700'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${liveStock > 0 ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`}></span>
                            <span>{liveStock}</span>
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          {added ? (
                            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-emerald-50 text-emerald-700 font-bold text-xs border border-emerald-200">
                              <Check className="w-3.5 h-3.5" />
                              Added
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                onSelectProduct(p);
                              }}
                              className="px-3 py-1 rounded-lg bg-[#4F46E5] hover:bg-[#4338CA] text-white font-bold text-xs shadow-xs transition-colors cursor-pointer inline-flex items-center gap-1"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              Add
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            /* ── CARDS VIEW ── */
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
              {filteredCatalogItems.map((p) => {
                const sysCode = getProductSystemCode(p);
                const pName = getProductName(p);
                const cat = getProductCategory(p);
                const baseCat = getProductBaseCategory(p);
                const unitOfSale = getProductUnitOfSale(p);
                const price = getProductSalePrice(p);
                const liveStock = getProductLiveStock(p);
                const added = isProductAdded(p.id);

                return (
                  <div
                    key={p.id}
                    className={`p-3.5 rounded-xl border transition-all flex flex-col justify-between ${
                      added
                        ? 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800 shadow-xs'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-amber-400 hover:shadow-xs'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between pb-1.5 border-b border-slate-100 dark:border-slate-800">
                        <span className="font-mono font-bold text-xs text-amber-700 dark:text-amber-400">
                          {sysCode}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full font-mono font-bold text-[10px] inline-flex items-center gap-1 ${
                          liveStock > 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                        }`}>
                          <span className={`w-1 h-1 rounded-full ${liveStock > 0 ? 'bg-emerald-500' : 'bg-slate-400'}`}></span>
                          Stock: {liveStock}
                        </span>
                      </div>

                      <h4 className="font-bold text-xs text-slate-900 dark:text-white pt-2 line-clamp-2">
                        {pName}
                      </h4>
                      <p className="text-[10px] text-slate-500 pt-0.5">
                        {cat} • {baseCat}
                      </p>
                    </div>

                    <div className="pt-3 mt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                      <div>
                        <span className="text-[10px] text-slate-400 block">Sale Price</span>
                        <span className="font-extrabold text-sm text-slate-900 dark:text-white font-mono">
                          ₹{price.toFixed(0)} <span className="text-[10px] font-normal text-slate-400">/{unitOfSale}</span>
                        </span>
                      </div>

                      {added ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 font-bold text-xs border border-emerald-200">
                          <Check className="w-3.5 h-3.5" />
                          Added
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onSelectProduct(p)}
                          className="px-3 py-1.5 rounded-lg bg-[#4F46E5] hover:bg-[#4338CA] text-white font-bold text-xs shadow-xs transition-colors cursor-pointer inline-flex items-center gap-1"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Add
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── FOOTER ── */}
        <div className="bg-slate-50 dark:bg-slate-850 px-4 py-2.5 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <Info className="w-3.5 h-3.5 text-amber-500" />
            <span>Click <strong>+ Add</strong> on any product to select into the production batch. Multi-select is supported.</span>
          </div>
          <Button
            size="sm"
            onClick={onClose}
            className="rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold h-8 px-4 text-xs cursor-pointer"
          >
            Done
          </Button>
        </div>

      </div>
    </div>
  );
}
