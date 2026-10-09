import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  Search, X, Check, Package, Tag, Scale, ChevronDown, 
  Layers, AlertTriangle, CheckCircle2, RotateCcw, Filter, DollarSign, Sparkles
} from 'lucide-react';
import { Button } from '@/components/ui/button';

// Product Attribute Extractors (consistent with Sales Order SAP)
export const getProductSystemCode = (p) => p?.systemCode || p?.code || p?.sku || 'NO-CODE';
export const getProductName = (p) => p?.productName || p?.name || 'Unnamed Product';
export const getProductCategory = (p) => p?.category?.name || p?.categoryName || p?.category || p?.specifications?.group || 'General';
export const getProductBaseCategory = (p) => p?.baseCategory || p?.category?.baseCategory || p?.specifications?.category || p?.specifications?.group || p?.category?.name || p?.categoryName || p?.category || 'General';
export const getProductSubcategory = (p) => p?.subcategory?.name || p?.subcategory || p?.subCategory || p?.category?.subcategory || p?.category?.subCategory || p?.specifications?.series || p?.specifications?.category || '-';
export const getProductUnitOfSale = (p) => p?.unitOfSale || p?.unit?.abbreviation || p?.unit?.name || p?.unit || p?.specifications?.sizeML || p?.size || 'pcs';
export const getProductSalePrice = (p) => Number(p?.salePrice !== undefined ? p.salePrice : (p?.price || 0));
export const getProductLiveStock = (p) => Number(p?.stock !== undefined ? p.stock : (p?.currentStock !== undefined ? p.currentStock : (p?.availableQuantity !== undefined ? p.availableQuantity : (p?.batchStock || 0))));

// Optimized Product Search Index Builder (Pre-computed for instant 0ms multi-field searching)
export const createProductSearchIndex = (p) => {
  const code = (getProductSystemCode(p) || '').toLowerCase();
  const name = (getProductName(p) || '').toLowerCase();
  const cat = (getProductCategory(p) || '').toLowerCase();
  const baseCat = (getProductBaseCategory(p) || '').toLowerCase();
  const subcat = (getProductSubcategory(p) || '').toLowerCase();
  const cleanSubcat = subcat === '-' ? '' : subcat;
  const hsn = (p?.hsnCode || '').toLowerCase();
  const unit = (getProductUnitOfSale(p) || '').toLowerCase();

  // Strip non-alphanumeric characters for space-agnostic & punctuation-agnostic search
  const codeCompact = code.replace(/[^a-z0-9]/g, '');
  const nameCompact = name.replace(/[^a-z0-9]/g, '');
  const catCompact = cat.replace(/[^a-z0-9]/g, '');
  const baseCatCompact = baseCat.replace(/[^a-z0-9]/g, '');
  const subcatCompact = cleanSubcat.replace(/[^a-z0-9]/g, '');
  const hsnCompact = hsn.replace(/[^a-z0-9]/g, '');
  const unitCompact = unit.replace(/[^a-z0-9]/g, '');

  // Combined text with spaces for token / phrase matching across any field
  const combined = `${code} ${name} ${cat} ${baseCat} ${cleanSubcat} ${hsn} ${unit}`.trim();

  // Combined compact strings for space-less cross-field matching (e.g. "kulfistickalmond")
  const combinedCompact = `${codeCompact}${nameCompact}${catCompact}${baseCatCompact}${subcatCompact}${hsnCompact}`;
  const combinedCompactAlt = `${catCompact}${baseCatCompact}${subcatCompact}${nameCompact}${codeCompact}`;

  return {
    code,
    name,
    cat,
    baseCat,
    subcat: cleanSubcat,
    hsn,
    unit,
    codeCompact,
    nameCompact,
    catCompact,
    baseCatCompact,
    subcatCompact,
    hsnCompact,
    unitCompact,
    combined,
    combinedCompact,
    combinedCompactAlt
  };
};

// Ultra-fast Multi-Field, Space-Agnostic, Tokenized Matcher
export const matchProductSearch = (index, query) => {
  if (!query) return { matched: true, score: 0 };

  const rawQ = query.trim().toLowerCase();
  if (!rawQ) return { matched: true, score: 0 };

  const compactQ = rawQ.replace(/[^a-z0-9]/g, '');

  // 1. Direct exact system code match (e.g. "K123" === "k123")
  if (index.code === rawQ || (compactQ && index.codeCompact === compactQ)) {
    return { matched: true, score: 1000 };
  }

  // 2. System code starts with query (e.g. "K12" -> "K123")
  if (index.code.startsWith(rawQ) || (compactQ && index.codeCompact.startsWith(compactQ))) {
    return { matched: true, score: 900 };
  }

  // 3. Exact product name match (e.g. "Almond Pista" or "almondpista")
  if (index.name === rawQ || (compactQ && index.nameCompact === compactQ)) {
    return { matched: true, score: 850 };
  }

  // 4. Product name starts with query
  if (index.name.startsWith(rawQ) || (compactQ && index.nameCompact.startsWith(compactQ))) {
    return { matched: true, score: 750 };
  }

  // 5. Exact category or subcategory match (e.g. "Kulfi Stick" or "kulfistick")
  if (index.cat === rawQ || (compactQ && index.catCompact === compactQ)) {
    return { matched: true, score: 700 };
  }
  if (index.subcat && (index.subcat === rawQ || (compactQ && index.subcatCompact === compactQ))) {
    return { matched: true, score: 680 };
  }

  // 6. Category or subcategory starts with query
  if (index.cat.startsWith(rawQ) || (compactQ && index.catCompact.startsWith(compactQ))) {
    return { matched: true, score: 650 };
  }
  if (index.subcat && (index.subcat.startsWith(rawQ) || (compactQ && index.subcatCompact.startsWith(compactQ)))) {
    return { matched: true, score: 630 };
  }

  // 7. System code contains query anywhere
  if (index.code.includes(rawQ) || (compactQ && index.codeCompact.includes(compactQ))) {
    return { matched: true, score: 600 };
  }

  // 8. Product name contains query anywhere
  if (index.name.includes(rawQ) || (compactQ && index.nameCompact.includes(compactQ))) {
    return { matched: true, score: 580 };
  }

  // 9. Combined raw phrase match
  if (index.combined.includes(rawQ)) {
    return { matched: true, score: 550 };
  }

  // 10. Space-less full query match across any field or concatenated fields
  // (handles "kulfistick", "almondpista", "familypack700ml", "fruitblend", etc.)
  if (compactQ && (
    index.combinedCompact.includes(compactQ) ||
    index.combinedCompactAlt.includes(compactQ) ||
    index.catCompact.includes(compactQ) ||
    index.baseCatCompact.includes(compactQ) ||
    index.subcatCompact.includes(compactQ) ||
    index.nameCompact.includes(compactQ) ||
    index.hsnCompact.includes(compactQ)
  )) {
    return { matched: true, score: 500 };
  }

  // 11. Multi-term / Combined search across multiple fields
  // (e.g. "kulfi almond", "k123 almond", "kulfi assorted", "kulfistick almondpista")
  const tokens = rawQ.split(/[\s,+/•\-]+/).filter(Boolean);
  if (tokens.length > 1) {
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
          index.hsnCompact.includes(tokenCompact) ||
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

export default function StockProductSearchSelect({
  products = [],
  selectedProductId = '',
  onSelect,
  onClear,
  error = null,
  disabled = false,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBaseCategory, setSelectedBaseCategory] = useState('All');
  const [selectedSubcategory, setSelectedSubcategory] = useState('All');
  const [categorySearchQuery, setCategorySearchQuery] = useState('');
  const [subcategorySearchQuery, setSubcategorySearchQuery] = useState('');

  const searchInputRef = useRef(null);
  const modalRef = useRef(null);

  // Find currently selected product object
  const selectedProduct = useMemo(() => {
    if (!selectedProductId || !products.length) return null;
    return products.find(p => p.id === selectedProductId || p.code === selectedProductId || p.systemCode === selectedProductId) || null;
  }, [selectedProductId, products]);

  // Pre-index products for fast search
  const productsWithSearchIndex = useMemo(() => {
    return products.map(p => ({
      product: p,
      index: createProductSearchIndex(p)
    }));
  }, [products]);

  // 2-Tier Category Hierarchy Map (Base Category -> Subcategories)
  const categoryHierarchy = useMemo(() => {
    const map = {};
    products.forEach(p => {
      const base = getProductCategory(p);
      const sub = getProductSubcategory(p);
      if (!map[base]) map[base] = new Set();
      if (sub && sub.trim() && sub !== '-') {
        map[base].add(sub.trim());
      }
    });
    return map;
  }, [products]);

  // All Base Categories
  const baseCategories = useMemo(() => {
    return ['All', ...Object.keys(categoryHierarchy).sort()];
  }, [categoryHierarchy]);

  // Filtered Base Categories (with inline category search)
  const filteredBaseCategories = useMemo(() => {
    if (!categorySearchQuery.trim()) return baseCategories;
    const q = categorySearchQuery.toLowerCase().trim();
    const qCompact = q.replace(/[^a-z0-9]/g, '');
    return baseCategories.filter(c => {
      if (c === 'All') return true;
      const cLower = c.toLowerCase();
      const cCompact = cLower.replace(/[^a-z0-9]/g, '');
      return cLower.includes(q) || (qCompact && cCompact.includes(qCompact));
    });
  }, [baseCategories, categorySearchQuery]);

  // Subcategories for Selected Base Category
  const availableSubcategories = useMemo(() => {
    if (selectedBaseCategory === 'All') return [];
    const subs = categoryHierarchy[selectedBaseCategory]
      ? Array.from(categoryHierarchy[selectedBaseCategory]).sort()
      : [];
    return ['All', ...subs];
  }, [categoryHierarchy, selectedBaseCategory]);

  // Screened Subcategories (with inline subcategory search)
  const screenedSubcategories = useMemo(() => {
    if (!subcategorySearchQuery.trim()) return availableSubcategories;
    const q = subcategorySearchQuery.toLowerCase().trim();
    const qCompact = q.replace(/[^a-z0-9]/g, '');
    return availableSubcategories.filter(s => {
      if (s === 'All') return true;
      const sLower = s.toLowerCase();
      const sCompact = sLower.replace(/[^a-z0-9]/g, '');
      return sLower.includes(q) || (qCompact && sCompact.includes(qCompact));
    });
  }, [availableSubcategories, subcategorySearchQuery]);

  const handleSelectBaseCategory = (cat) => {
    setSelectedBaseCategory(cat);
    setSelectedSubcategory('All');
    setSubcategorySearchQuery('');
  };

  // Screened & Filtered Products (Base Category -> Subcategory -> Multi-Token Fuzzy Search)
  const filteredProducts = useMemo(() => {
    let pool = productsWithSearchIndex;

    // Filter by Base Category
    if (selectedBaseCategory !== 'All') {
      pool = pool.filter(item => getProductCategory(item.product) === selectedBaseCategory);
    }

    // Filter by Subcategory
    if (selectedSubcategory !== 'All') {
      pool = pool.filter(item => getProductSubcategory(item.product) === selectedSubcategory);
    }

    // Filter & rank by Search Query
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

      return scored.slice(0, 100).map(s => s.product);
    }

    return pool.slice(0, 60).map(item => item.product);
  }, [productsWithSearchIndex, searchQuery, selectedBaseCategory, selectedSubcategory]);

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

  const handleSelectProduct = (p) => {
    onSelect(p);
    setIsOpen(false);
    setSearchQuery('');
  };

  const handleClearSelection = (e) => {
    e.stopPropagation();
    if (onClear) onClear();
    setSearchQuery('');
  };

  return (
    <div className="w-full">
      {/* Trigger Button / Selected Card */}
      {!selectedProduct ? (
        <button
          type="button"
          disabled={disabled}
          onClick={() => setIsOpen(true)}
          className={`w-full text-left p-3.5 rounded-2xl border-2 border-dashed transition-all duration-200 group flex items-center justify-between cursor-pointer ${
            error 
              ? 'border-red-400 bg-red-50/50 dark:bg-red-950/20' 
              : 'border-slate-300 hover:border-amber-500 bg-slate-50/50 hover:bg-amber-50/20 dark:border-slate-700 dark:hover:border-amber-400 dark:bg-slate-900/40'
          } ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <Search className="w-5 h-5" />
            </div>
            <div className="min-w-0 truncate">
              <div className="flex items-center gap-2">
                <span className="font-bold text-xs text-slate-900 dark:text-white">
                  Select Product with Base Category & Subcategory
                </span>
                <span className="px-1.5 py-0.5 text-[9px] font-extrabold uppercase bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300 rounded">
                  SAP SELECTOR
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                Search System Code, Product Name, Category, Subcategory (e.g. K123, kulfistick, kulfi almond)...
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-xs font-bold text-amber-600 dark:text-amber-400 shrink-0 ml-3">
            <span>Browse Catalog &rarr;</span>
            <ChevronDown className="w-4 h-4 text-slate-400" />
          </div>
        </button>
      ) : (
        <div className="p-3.5 rounded-2xl border border-amber-300 dark:border-amber-800/80 bg-amber-50/30 dark:bg-amber-950/20 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center shrink-0 shadow-sm mt-0.5 sm:mt-0 font-bold">
              <Package className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-extrabold text-sm text-slate-900 dark:text-white">
                  {getProductName(selectedProduct)}
                </span>
                <span className="font-mono text-xs font-bold bg-amber-100 dark:bg-amber-900/80 text-amber-900 dark:text-amber-300 px-2 py-0.5 rounded-md border border-amber-300 dark:border-amber-700">
                  {getProductSystemCode(selectedProduct)}
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200/80 dark:bg-slate-800 text-slate-800 dark:text-slate-200">
                  {getProductCategory(selectedProduct)}
                </span>
                {getProductSubcategory(selectedProduct) && getProductSubcategory(selectedProduct) !== '-' && (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300">
                    {getProductBaseCategory(selectedProduct)} • {getProductSubcategory(selectedProduct)}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-4 text-xs mt-1.5 text-slate-600 dark:text-slate-400 flex-wrap font-medium">
                <span className="flex items-center gap-1">
                  <Scale className="w-3.5 h-3.5 text-slate-400" />
                  Current Stock: <strong className="text-slate-900 dark:text-white font-mono">{getProductLiveStock(selectedProduct).toFixed(2)} {getProductUnitOfSale(selectedProduct)}</strong>
                </span>
                {getProductSalePrice(selectedProduct) > 0 && (
                  <span className="flex items-center gap-1">
                    <DollarSign className="w-3.5 h-3.5 text-slate-400" />
                    Sale Price: <strong className="text-slate-900 dark:text-white font-mono">₹{getProductSalePrice(selectedProduct).toFixed(2)}</strong>
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled}
              onClick={() => setIsOpen(true)}
              className="h-8 text-xs font-bold rounded-xl border-amber-300 dark:border-amber-700 hover:bg-amber-100/50 cursor-pointer text-amber-900 dark:text-amber-200"
            >
              Change Product
            </Button>
            {!disabled && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleClearSelection}
                className="h-8 w-8 p-0 text-slate-400 hover:text-red-500 rounded-xl"
                title="Clear selection"
              >
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      )}

      {error && (
        <p className="text-xs text-red-500 font-semibold mt-1 flex items-center gap-1">
          <AlertTriangle className="w-3 h-3" />
          {error}
        </p>
      )}

      {/* SALES-ORDER STYLE PRODUCT SELECTOR MODAL (Screenshot 2 Match) */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in duration-100">
          <div
            ref={modalRef}
            className="w-full max-w-4xl bg-white dark:bg-slate-900 border-2 border-amber-400 dark:border-amber-500 shadow-2xl rounded-sm flex flex-col overflow-hidden text-xs animate-in zoom-in-95 duration-100 max-h-[88vh]"
          >
            {/* Header */}
            <div className="bg-slate-800 text-white px-3 py-2 flex items-center justify-between select-none">
              <div className="flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span className="font-bold text-xs sm:text-sm">
                  Select Product for Stock Adjustment
                </span>
                <span className="text-[10px] text-amber-300 font-mono bg-slate-700/80 px-2 py-0.5 rounded-xs">
                  {filteredProducts.length} items
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-slate-400 hover:text-white font-bold text-base px-1 cursor-pointer transition-colors"
                title="Close"
              >
                ✕
              </button>
            </div>

            {/* Search Input Bar */}
            <div className="p-2 sm:p-2.5 bg-slate-50 dark:bg-slate-850 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2">
              <div className="relative flex-1 flex items-center">
                <Search className="w-3.5 h-3.5 text-amber-500 absolute left-2.5 pointer-events-none" />
                <input
                  ref={searchInputRef}
                  type="text"
                  autoFocus
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && filteredProducts.length > 0) {
                      e.preventDefault();
                      handleSelectProduct(filteredProducts[0]);
                    }
                  }}
                  placeholder="Search System Code, Product Name, Category, Subcategory (e.g. K123, kulfistick, kulfi almond)..."
                  className="w-full pl-8 pr-7 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xs text-xs font-semibold text-slate-800 dark:text-slate-100 outline-none focus:border-amber-500 placeholder:text-slate-400"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 text-slate-400 hover:text-slate-600 text-xs font-bold cursor-pointer"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>

            {/* 2-Tier Screening in Grid: Base Category -> Subcategory */}
            <div className="px-2.5 py-2 bg-slate-100 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 space-y-1.5">
              {/* Level 1: Base Category Selector */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
                <div className="relative shrink-0 flex items-center">
                  <Search className="w-3 h-3 text-slate-400 absolute left-1.5" />
                  <input
                    type="text"
                    value={categorySearchQuery}
                    onChange={(e) => setCategorySearchQuery(e.target.value)}
                    placeholder="Search Base Category..."
                    className="w-36 h-[22px] pl-5 pr-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xs text-[10px] outline-none focus:border-amber-500"
                  />
                </div>
                <span className="text-[9.5px] font-bold uppercase text-slate-500 shrink-0">
                  BASE CATEGORY:
                </span>
                {filteredBaseCategories.map(cat => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => handleSelectBaseCategory(cat)}
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 cursor-pointer transition-colors ${
                      selectedBaseCategory === cat
                        ? 'bg-amber-500 text-slate-950 shadow-xs'
                        : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {/* Level 2: Subcategories (ONLY for the selected Base Category) */}
              <div className="flex items-center gap-1.5 overflow-x-auto pt-1 border-t border-slate-200/60 dark:border-slate-700/60 scrollbar-thin">
                <span className="text-[9.5px] font-bold uppercase text-indigo-600 dark:text-indigo-400 shrink-0">
                  SUBCATEGORY:
                </span>
                {selectedBaseCategory === 'All' ? (
                  <span className="text-[10px] text-slate-500 italic">
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
                        className="w-40 h-[21px] px-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xs text-[9.5px] outline-none focus:border-indigo-500"
                      />
                    </div>
                    {screenedSubcategories.map(sub => (
                      <button
                        key={sub}
                        type="button"
                        onClick={() => setSelectedSubcategory(sub)}
                        className={`px-2 py-0.5 rounded-full text-[9.5px] font-semibold shrink-0 cursor-pointer transition-colors ${
                          selectedSubcategory === sub
                            ? 'bg-indigo-600 text-white shadow-xs font-bold'
                            : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-indigo-50'
                        }`}
                      >
                        {sub === 'All' ? `All (${selectedBaseCategory})` : sub}
                      </button>
                    ))}
                  </>
                )}
              </div>
            </div>

            {/* Products Table Grid in Modal */}
            <div className="flex-1 overflow-y-auto max-h-[380px] divide-y divide-slate-100 dark:divide-slate-800">
              <div className="grid grid-cols-12 gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-slate-500 uppercase tracking-wider sticky top-0 z-10 border-b border-slate-200 dark:border-slate-700">
                <div className="col-span-2">System Code *</div>
                <div className="col-span-3">Product Name *</div>
                <div className="col-span-2">Category *</div>
                <div className="col-span-2">Base / Subcategory</div>
                <div className="col-span-1 text-center">Unit *</div>
                <div className="col-span-1 text-right">Sale Price *</div>
                <div className="col-span-1 text-center">Stock</div>
              </div>

              {filteredProducts.map(p => {
                const sysCode = getProductSystemCode(p);
                const pName = getProductName(p);
                const cat = getProductCategory(p);
                const baseCat = getProductBaseCategory(p);
                const subcat = getProductSubcategory(p);
                const unitOfSale = getProductUnitOfSale(p);
                const price = getProductSalePrice(p);
                const liveStock = getProductLiveStock(p);
                const isCurrent = selectedProduct?.id === p.id;

                return (
                  <div
                    key={p.id}
                    onClick={() => handleSelectProduct(p)}
                    className={`grid grid-cols-12 gap-1.5 px-3 py-2 cursor-pointer items-center transition-colors group text-[11px] ${
                      isCurrent
                        ? 'bg-amber-100/60 dark:bg-slate-800 ring-1 ring-amber-400'
                        : 'hover:bg-amber-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <div className="col-span-2 font-mono font-bold text-amber-700 dark:text-amber-400 truncate">
                      {sysCode}
                    </div>
                    <div className="col-span-3 font-bold text-slate-900 dark:text-white group-hover:text-amber-600 transition-colors truncate">
                      {pName}
                    </div>
                    <div className="col-span-2 text-slate-600 dark:text-slate-300 font-medium truncate text-[10.5px]">
                      {cat}
                    </div>
                    <div className="col-span-2 text-slate-500 text-[10px] truncate">
                      {baseCat} {subcat && subcat !== '-' ? `• ${subcat}` : ''}
                    </div>
                    <div className="col-span-1 text-center text-slate-700 dark:text-slate-300 font-medium">
                      {unitOfSale}
                    </div>
                    <div className="col-span-1 text-right font-bold text-slate-900 dark:text-white">
                      ₹{price.toFixed(0)}
                    </div>
                    <div className="col-span-1 text-center">
                      <span className={`px-1.5 py-0.5 rounded-xs font-mono font-bold text-[9.5px] inline-flex items-center gap-1 ${
                        liveStock > 0 ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${liveStock > 0 ? 'bg-emerald-500' : 'bg-slate-400'}`}></span>
                        {liveStock}
                      </span>
                    </div>
                  </div>
                );
              })}

              {filteredProducts.length === 0 && (
                <div className="p-8 text-center text-slate-400 space-y-2">
                  <div>No product found matching "{searchQuery}" {selectedBaseCategory !== 'All' ? `in ${selectedBaseCategory}` : ''}</div>
                  {selectedBaseCategory !== 'All' && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedBaseCategory('All');
                        setSelectedSubcategory('All');
                      }}
                      className="mt-2.5 px-3 py-1 bg-amber-500 text-slate-950 font-bold rounded-xs text-xs hover:bg-amber-400 cursor-pointer shadow-xs inline-flex items-center gap-1"
                    >
                      <span>Search in All Categories</span>
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-[10px] text-slate-500 border-t border-slate-200 dark:border-slate-700 flex justify-between items-center">
              <span>Click any row to select into grid • Esc to close</span>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-amber-600 dark:text-amber-400 font-bold hover:underline cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
