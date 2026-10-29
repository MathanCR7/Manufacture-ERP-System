import React, { useState, useEffect, useMemo, useRef } from 'react';
import { api } from '@/lib/axios';
import {
  Search,
  Sparkles,
  Check,
  CheckSquare,
  Square,
  X,
  Layers,
  AlertCircle,
  Package,
  Database,
  Boxes,
  Tag,
  ShieldCheck,
  Filter,
  ArrowRight,
  RefreshCw,
  Plus
} from 'lucide-react';
import { Button } from '@/components/ui/button';

// ── FAST LEVENSHTEIN DISTANCE FOR SPELLING MISTAKES ──
function levenshteinDistance(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const matrix = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          Math.min(matrix[i][j - 1] + 1, matrix[i - 1][j] + 1) // insertion / deletion
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

// Check if token matches target word with typo tolerance
function tokenMatchesFuzzy(targetWord, token) {
  if (!targetWord || !token) return false;
  const tw = targetWord.toLowerCase();
  const tk = token.toLowerCase();
  if (tw.includes(tk)) return true;
  if (tk.length < 3) return false;

  const maxDist = tk.length >= 6 ? 2 : 1;
  // If target word is similar in length, compare directly
  if (Math.abs(tw.length - tk.length) <= maxDist) {
    if (levenshteinDistance(tw, tk) <= maxDist) return true;
  }
  return false;
}

// ── INDEX CREATORS FOR INSTANT MULTI-FIELD SPACE-AGNOSTIC MATCHING ──
function indexProduct(p) {
  const code = (p.code || p.systemCode || '').toLowerCase().trim();
  const name = (p.name || p.productName || '').toLowerCase().trim();
  const cat = (p.category || p.categoryName || '').toLowerCase().trim();
  const baseCat = (p.baseCategory || p.baseName || cat).toLowerCase().trim();
  const subcat = (p.subcategory || p.subcategoryName || '').toLowerCase().trim();
  const sku = (p.sku || '').toLowerCase().trim();

  const codeCompact = code.replace(/[^a-z0-9]/g, '');
  const nameCompact = name.replace(/[^a-z0-9]/g, '');
  const catCompact = cat.replace(/[^a-z0-9]/g, '');
  const baseCatCompact = baseCat.replace(/[^a-z0-9]/g, '');
  const subcatCompact = subcat.replace(/[^a-z0-9]/g, '');

  const words = `${code} ${name} ${cat} ${baseCat} ${subcat} ${sku}`
    .split(/[\s,+/•\-]+/)
    .filter(Boolean);

  const combined = `${code} ${name} ${cat} ${baseCat} ${subcat} ${sku}`;
  const combinedCompact = `${codeCompact}${nameCompact}${catCompact}${baseCatCompact}${subcatCompact}`;

  return {
    raw: p,
    code,
    name,
    cat,
    baseCat,
    subcat,
    codeCompact,
    nameCompact,
    catCompact,
    baseCatCompact,
    subcatCompact,
    combined,
    combinedCompact,
    words
  };
}

function indexRawMaterial(rm) {
  const code = (rm.code || '').toLowerCase().trim();
  const name = (rm.name || rm.printName || '').toLowerCase().trim();
  const cat = (rm.category || rm.categoryName || '').toLowerCase().trim();
  const uom = (rm.unitId || rm.consumptionUnit || 'kg').toLowerCase().trim();
  const altUom = (rm.alternateUom || '').toLowerCase().trim();
  const hsn = (rm.hsnCode || '').toLowerCase().trim();

  const codeCompact = code.replace(/[^a-z0-9]/g, '');
  const nameCompact = name.replace(/[^a-z0-9]/g, '');
  const catCompact = cat.replace(/[^a-z0-9]/g, '');

  const words = `${code} ${name} ${cat} ${uom} ${altUom} ${hsn}`
    .split(/[\s,+/•\-]+/)
    .filter(Boolean);

  const combined = `${code} ${name} ${cat} ${uom} ${altUom} ${hsn}`;
  const combinedCompact = `${codeCompact}${nameCompact}${catCompact}`;

  return {
    raw: rm,
    code,
    name,
    cat,
    codeCompact,
    nameCompact,
    catCompact,
    combined,
    combinedCompact,
    words
  };
}

// ── ADVANCED MATCHER WITH SPACE-IGNORING & SPELLING TOLERANCE ──
function matchIndex(idx, query) {
  if (!query || !query.trim()) return { matched: true, score: 0 };
  const rawQ = query.trim().toLowerCase();
  const compactQ = rawQ.replace(/[^a-z0-9]/g, '');

  // 1. Exact code match
  if (idx.code === rawQ || (compactQ && idx.codeCompact === compactQ)) {
    return { matched: true, score: 1000 };
  }
  // 2. Code prefix
  if (idx.code.startsWith(rawQ) || (compactQ && idx.codeCompact.startsWith(compactQ))) {
    return { matched: true, score: 900 };
  }
  // 3. Name exact
  if (idx.name === rawQ || (compactQ && idx.nameCompact === compactQ)) {
    return { matched: true, score: 850 };
  }
  // 4. Name prefix
  if (idx.name.startsWith(rawQ) || (compactQ && idx.nameCompact.startsWith(compactQ))) {
    return { matched: true, score: 800 };
  }
  // 5. Code contains
  if (idx.code.includes(rawQ) || (compactQ && idx.codeCompact.includes(compactQ))) {
    return { matched: true, score: 700 };
  }
  // 6. Name contains
  if (idx.name.includes(rawQ) || (compactQ && idx.nameCompact.includes(compactQ))) {
    return { matched: true, score: 650 };
  }
  // 7. Combined compact (ignoring spaces: "kulfistick" matches "Kulfi Stick", "refinedsugar" matches "Refined Sugar")
  if (compactQ && idx.combinedCompact.includes(compactQ)) {
    return { matched: true, score: 600 };
  }
  // 8. Multi-token & Typo tolerance
  const tokens = rawQ.split(/[\s,+/•\-]+/).filter(Boolean);
  if (tokens.length > 0) {
    let allTokensMatched = true;
    let scoreSum = 0;

    for (const token of tokens) {
      const tokenCompact = token.replace(/[^a-z0-9]/g, '');
      let tokenMatch = false;

      // Exact token substring
      if (idx.combined.includes(token) || (tokenCompact && idx.combinedCompact.includes(tokenCompact))) {
        tokenMatch = true;
        scoreSum += 100;
      } else {
        // Typo tolerance check against each individual word in product / RM
        for (const w of idx.words) {
          if (tokenMatchesFuzzy(w, token)) {
            tokenMatch = true;
            scoreSum += 70;
            break;
          }
        }
      }

      if (!tokenMatch) {
        allTokensMatched = false;
        break;
      }
    }

    if (allTokensMatched) {
      return { matched: true, score: 400 + scoreSum };
    }
  }

  return { matched: false, score: 0 };
}

/**
 * ProductionItemSearchModal
 * 
 * Reusable ultra-fast search modal styled after the Sales / SAP Order Item Selector.
 * 
 * Props:
 * - isOpen: boolean
 * - onClose: () => void
 * - mode: 'PRODUCT_SINGLE' | 'RM_MULTI' | 'ALL'
 * - onSelectProduct: (product) => void (single select)
 * - onSelectRawMaterials: (materials[]) => void (multi-select)
 * - title: optional custom title string
 * - excludeProductIds: array of product ids to exclude or highlight
 * - excludeRMIds: array of raw material ids to exclude or highlight
 */
export default function ProductionItemSearchModal({
  isOpen,
  onClose,
  mode = 'PRODUCT_SINGLE',
  onSelectProduct,
  onSelectRawMaterials,
  title = '',
  excludeProductIds = [],
  excludeRMIds = []
}) {
  const [activeScope, setActiveScope] = useState(
    mode === 'RM_MULTI' ? 'RAW_MATERIALS' : 'PRODUCTS'
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);

  // Products Data & 2-Tier Filtering
  const [rawProducts, setRawProducts] = useState([]);
  const [selectedBaseCategory, setSelectedBaseCategory] = useState('All');
  const [selectedSubcategory, setSelectedSubcategory] = useState('All');
  const [baseCategoryFilterQuery, setBaseCategoryFilterQuery] = useState('');

  // Raw Materials Data
  const [rawMaterials, setRawMaterials] = useState([]);
  const [selectedRMs, setSelectedRMs] = useState({}); // { [rmId]: rawMaterialObject }
  const [selectedRMCategory, setSelectedRMCategory] = useState('All');

  const searchInputRef = useRef(null);

  // Reset & focus search on modal open
  useEffect(() => {
    if (isOpen) {
      setSearchQuery('');
      setActiveScope(mode === 'RM_MULTI' ? 'RAW_MATERIALS' : 'PRODUCTS');
      setSelectedRMs({});
      setSelectedBaseCategory('All');
      setSelectedSubcategory('All');
      setTimeout(() => {
        if (searchInputRef.current) searchInputRef.current.focus();
      }, 50);
      loadCatalogs();
    }
  }, [isOpen, mode]);

  // Load live data from catalog endpoints
  const loadCatalogs = async () => {
    try {
      setLoading(true);
      const [prodRes, rmRes] = await Promise.all([
        api.get('/production/standard/products-catalog').catch(() => ({ data: { data: [] } })),
        api.get('/production/standard/raw-materials-catalog').catch(() => ({ data: { data: [] } }))
      ]);

      setRawProducts(Array.isArray(prodRes.data?.data) ? prodRes.data.data : []);
      setRawMaterials(Array.isArray(rmRes.data?.data) ? rmRes.data.data : []);
    } catch (err) {
      console.error('Failed to load item catalogs:', err);
    } finally {
      setLoading(false);
    }
  };

  // ── PRE-INDEXED PRODUCTS ──
  const indexedProducts = useMemo(() => {
    return rawProducts.map(p => indexProduct(p));
  }, [rawProducts]);

  // Unique Base Categories for Products
  const baseCategories = useMemo(() => {
    const set = new Set();
    rawProducts.forEach(p => {
      const b = p.baseCategory || p.category;
      if (b) set.add(b);
    });
    return ['All', ...Array.from(set).sort()];
  }, [rawProducts]);

  const filteredBaseCategories = useMemo(() => {
    if (!baseCategoryFilterQuery.trim()) return baseCategories;
    const q = baseCategoryFilterQuery.toLowerCase().trim();
    return baseCategories.filter(b => b === 'All' || b.toLowerCase().includes(q));
  }, [baseCategories, baseCategoryFilterQuery]);

  // Subcategories for Selected Base Category
  const subcategoriesForBase = useMemo(() => {
    if (selectedBaseCategory === 'All') return [];
    const set = new Set();
    rawProducts.forEach(p => {
      const b = p.baseCategory || p.category;
      if (b === selectedBaseCategory && p.subcategory && p.subcategory !== '-') {
        set.add(p.subcategory);
      }
    });
    return ['All', ...Array.from(set).sort()];
  }, [rawProducts, selectedBaseCategory]);

  // Filtered Products via Category + Fuzzy Match
  const filteredProducts = useMemo(() => {
    let pool = indexedProducts;

    if (selectedBaseCategory !== 'All') {
      pool = pool.filter(idx => (idx.raw.baseCategory || idx.raw.category) === selectedBaseCategory);
    }
    if (selectedSubcategory !== 'All') {
      pool = pool.filter(idx => idx.raw.subcategory === selectedSubcategory);
    }

    if (searchQuery.trim()) {
      const scored = [];
      for (const item of pool) {
        const res = matchIndex(item, searchQuery);
        if (res.matched) {
          scored.push({ item: item.raw, score: res.score });
        }
      }
      scored.sort((a, b) => b.score - a.score);
      return scored.map(s => s.item);
    }

    return pool.map(item => item.raw);
  }, [indexedProducts, selectedBaseCategory, selectedSubcategory, searchQuery]);

  // ── PRE-INDEXED RAW MATERIALS ──
  const indexedRMs = useMemo(() => {
    return rawMaterials.map(rm => indexRawMaterial(rm));
  }, [rawMaterials]);

  // Raw Material Categories
  const rmCategories = useMemo(() => {
    const set = new Set();
    rawMaterials.forEach(rm => {
      if (rm.category) set.add(rm.category);
    });
    return ['All', ...Array.from(set).sort()];
  }, [rawMaterials]);

  // Filtered Raw Materials
  const filteredRMs = useMemo(() => {
    let pool = indexedRMs;

    if (selectedRMCategory !== 'All') {
      pool = pool.filter(idx => idx.raw.category === selectedRMCategory);
    }

    if (searchQuery.trim()) {
      const scored = [];
      for (const item of pool) {
        const res = matchIndex(item, searchQuery);
        if (res.matched) {
          scored.push({ item: item.raw, score: res.score });
        }
      }
      scored.sort((a, b) => b.score - a.score);
      return scored.map(s => s.item);
    }

    return pool.map(item => item.raw);
  }, [indexedRMs, selectedRMCategory, searchQuery]);

  // Handle Multi-Select Toggles
  const handleToggleRM = (rm) => {
    setSelectedRMs(prev => {
      const next = { ...prev };
      if (next[rm.id]) {
        delete next[rm.id];
      } else {
        next[rm.id] = rm;
      }
      return next;
    });
  };

  const handleSelectAllFilteredRMs = () => {
    const next = { ...selectedRMs };
    const allSelected = filteredRMs.length > 0 && filteredRMs.every(r => !!next[r.id]);
    if (allSelected) {
      filteredRMs.forEach(r => delete next[r.id]);
    } else {
      filteredRMs.forEach(r => { next[r.id] = r; });
    }
    setSelectedRMs(next);
  };

  const selectedRMCount = Object.keys(selectedRMs).length;

  const handleConfirmAddRMs = () => {
    const items = Object.values(selectedRMs);
    if (items.length > 0 && onSelectRawMaterials) {
      onSelectRawMaterials(items);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="w-full max-w-5xl max-h-[92vh] bg-white dark:bg-slate-900 border-2 border-amber-400 dark:border-amber-500 shadow-2xl rounded-lg flex flex-col overflow-hidden text-xs"
        role="dialog"
      >
        {/* ── TOP HEADER ── */}
        <div className="bg-slate-900 text-white px-4 py-2.5 flex items-center justify-between select-none border-b border-slate-800">
          <div className="flex items-center gap-2.5 flex-wrap">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span className="font-extrabold text-sm tracking-wide text-amber-300">
              {title || (activeScope === 'PRODUCTS' ? 'Select Finished Product' : 'Select Raw Materials (Multi-Select)')}
            </span>

            {/* Scope Switcher Tabs */}
            {mode === 'ALL' && (
              <div className="flex items-center bg-slate-950 rounded-md p-0.5 ml-2 border border-slate-800">
                <button
                  type="button"
                  onClick={() => setActiveScope('PRODUCTS')}
                  className={`px-3 py-1 rounded text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    activeScope === 'PRODUCTS'
                      ? 'bg-amber-500 text-slate-950 shadow-xs'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Package className="w-3.5 h-3.5" />
                  <span>Finished Products ({filteredProducts.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveScope('RAW_MATERIALS')}
                  className={`px-3 py-1 rounded text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    activeScope === 'RAW_MATERIALS'
                      ? 'bg-amber-500 text-slate-950 shadow-xs'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Database className="w-3.5 h-3.5" />
                  <span>Raw Materials / Resale ({filteredRMs.length})</span>
                </button>
              </div>
            )}

            {mode === 'PRODUCT_SINGLE' && (
              <span className="text-[11px] font-semibold text-slate-400 bg-slate-800 px-2.5 py-0.5 rounded-full border border-slate-700">
                Single Selection Mode • ({filteredProducts.length} items available)
              </span>
            )}

            {mode === 'RM_MULTI' && (
              <span className="text-[11px] font-semibold text-amber-400 bg-amber-950/60 px-2.5 py-0.5 rounded-full border border-amber-800 flex items-center gap-1">
                <CheckSquare className="w-3 h-3" />
                Multi-Select Enabled • ({filteredRMs.length} items)
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white font-black text-lg p-1 rounded-md hover:bg-slate-800 cursor-pointer transition-colors"
            title="Close (Esc)"
          >
            ✕
          </button>
        </div>

        {/* ── SEARCH INPUT BAR (OPTIMIZED MULTI-TOKEN FUZZY & SPACE-IGNORE) ── */}
        <div className="p-3 bg-slate-50 dark:bg-slate-850 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2">
          <div className="relative flex-1 flex items-center">
            <Search className="w-4 h-4 text-amber-500 absolute left-3 pointer-events-none" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                activeScope === 'PRODUCTS'
                  ? "Search System Code, Product Name, Category, Subcategory (e.g. K123, kulfistick, kulfi almond)..."
                  : "Search RM Code, Raw Material Name, Category, HSN (e.g. RM-00001, milk raw, sugar, smp)..."
              }
              className="w-full pl-9 pr-9 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md text-xs font-semibold text-slate-800 dark:text-slate-100 outline-none focus:border-amber-500 shadow-2xs"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 text-slate-400 hover:text-slate-600 text-xs font-bold cursor-pointer"
                title="Clear Search"
              >
                ✕
              </button>
            )}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={loadCatalogs}
            disabled={loading}
            className="shrink-0 h-8 px-2.5 text-xs font-bold border-slate-300 dark:border-slate-700"
            title="Refresh database catalogs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        {/* ── 2-TIER SCREENING TABS: BASE CATEGORY -> SUBCATEGORY (FOR PRODUCTS) ── */}
        {activeScope === 'PRODUCTS' && (
          <div className="px-3 py-2 bg-slate-100 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 space-y-1.5">
            {/* Level 1: Base Category Selector */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
              <div className="relative shrink-0 flex items-center">
                <Search className="w-3 h-3 text-slate-400 absolute left-2" />
                <input
                  type="text"
                  value={baseCategoryFilterQuery}
                  onChange={(e) => setBaseCategoryFilterQuery(e.target.value)}
                  placeholder="Filter Base..."
                  className="w-32 h-[22px] pl-6 pr-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-sm text-[10px] outline-none focus:border-amber-500"
                />
              </div>

              <span className="text-[10px] font-black uppercase text-slate-500 shrink-0">
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
                  className={`px-2.5 py-0.5 rounded-full text-[10.5px] font-bold shrink-0 cursor-pointer transition-colors ${
                    selectedBaseCategory === cat
                      ? 'bg-amber-500 text-slate-950 shadow-xs'
                      : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Level 2: Subcategories (ONLY for Selected Base Category) */}
            <div className="flex items-center gap-1.5 overflow-x-auto pt-1 border-t border-slate-200/60 dark:border-slate-700/60 scrollbar-thin">
              <span className="text-[10px] font-black uppercase text-indigo-600 dark:text-indigo-400 shrink-0">
                SUBCATEGORY:
              </span>
              {selectedBaseCategory === 'All' ? (
                <span className="text-[10.5px] text-slate-500 italic">
                  👉 Click any Base Category above to screen subcategories (e.g. Kulfi Stick ➔ Kulfi Assorted)
                </span>
              ) : (
                subcategoriesForBase.map(sub => (
                  <button
                    key={sub}
                    type="button"
                    onClick={() => setSelectedSubcategory(sub)}
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold shrink-0 cursor-pointer transition-colors ${
                      selectedSubcategory === sub
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-indigo-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    {sub === 'All' ? `All (${selectedBaseCategory})` : sub}
                  </button>
                ))
              )}
            </div>
          </div>
        )}

        {/* ── RAW MATERIAL CATEGORY SCREENING TABS ── */}
        {activeScope === 'RAW_MATERIALS' && (
          <div className="px-3 py-2 bg-slate-100 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between gap-2 overflow-x-auto">
            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-thin">
              <span className="text-[10px] font-black uppercase text-amber-700 dark:text-amber-400 shrink-0">
                RM CATEGORY:
              </span>
              {rmCategories.map(cat => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedRMCategory(cat)}
                  className={`px-2.5 py-0.5 rounded-full text-[10.5px] font-bold shrink-0 cursor-pointer transition-colors ${
                    selectedRMCategory === cat
                      ? 'bg-amber-500 text-slate-950 shadow-xs'
                      : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {mode === 'RM_MULTI' && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleSelectAllFilteredRMs}
                className="h-6 px-2 text-[10px] font-bold shrink-0 border-slate-300 dark:border-slate-700 cursor-pointer"
              >
                {filteredRMs.length > 0 && filteredRMs.every(r => !!selectedRMs[r.id])
                  ? 'Deselect All Filtered'
                  : 'Select All Filtered'}
              </Button>
            )}
          </div>
        )}

        {/* ── TABLE CONTENT CONTAINER ── */}
        <div className="flex-1 overflow-y-auto max-h-[55vh] divide-y divide-slate-100 dark:divide-slate-800">
          
          {/* 1. PRODUCTS TABLE GRID */}
          {activeScope === 'PRODUCTS' && (
            <div>
              <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 text-[10.5px] font-black text-slate-500 uppercase tracking-wider sticky top-0 z-10 border-b border-slate-200 dark:border-slate-700">
                <div className="col-span-2">System Code *</div>
                <div className="col-span-4">Product Name *</div>
                <div className="col-span-2">Category *</div>
                <div className="col-span-2">Base / Subcategory</div>
                <div className="col-span-1 text-center">Unit *</div>
                <div className="col-span-1 text-center">Stock</div>
              </div>

              {filteredProducts.map(p => {
                const liveStock = Number(p.currentStock || 0);
                const isExcluded = excludeProductIds.includes(p.id);

                return (
                  <div
                    key={p.id}
                    onClick={() => {
                      if (onSelectProduct) onSelectProduct(p);
                      onClose();
                    }}
                    className={`grid grid-cols-12 gap-2 px-4 py-2.5 items-center transition-colors cursor-pointer group text-xs border-b border-slate-100 dark:border-slate-800/60 ${
                      isExcluded
                        ? 'opacity-60 bg-slate-50 dark:bg-slate-900/50'
                        : 'hover:bg-amber-50/80 dark:hover:bg-slate-800'
                    }`}
                  >
                    <div className="col-span-2 font-mono font-bold text-amber-700 dark:text-amber-400 truncate">
                      {p.code || p.systemCode}
                    </div>
                    <div className="col-span-4 font-bold text-slate-900 dark:text-white group-hover:text-amber-600 transition-colors truncate">
                      {p.name}
                    </div>
                    <div className="col-span-2 text-slate-600 dark:text-slate-300 font-medium truncate">
                      {p.category}
                    </div>
                    <div className="col-span-2 text-slate-500 text-[11px] truncate">
                      {p.baseCategory} {p.subcategory && p.subcategory !== '-' ? `• ${p.subcategory}` : ''}
                    </div>
                    <div className="col-span-1 text-center font-medium text-slate-700 dark:text-slate-300">
                      {p.unit || 'pcs'}
                    </div>
                    <div className="col-span-1 text-center">
                      <span className={`px-2 py-0.5 rounded-full font-mono font-bold text-[10px] inline-flex items-center gap-1 ${
                        liveStock > 0
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                          : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${liveStock > 0 ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                        {liveStock}
                      </span>
                    </div>
                  </div>
                );
              })}

              {filteredProducts.length === 0 && (
                <div className="p-10 text-center text-slate-400 space-y-2">
                  <div className="text-sm font-semibold">No finished products found matching "{searchQuery}"</div>
                  {selectedBaseCategory !== 'All' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedBaseCategory('All');
                        setSelectedSubcategory('All');
                      }}
                      className="text-xs font-bold"
                    >
                      Search across All Categories
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* 2. RAW MATERIALS TABLE GRID (WITH LIVE DB UOM, ALT UOM & BATCH ALLOCATION) */}
          {activeScope === 'RAW_MATERIALS' && (
            <div>
              <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 text-[10.5px] font-black text-slate-500 uppercase tracking-wider sticky top-0 z-10 border-b border-slate-200 dark:border-slate-700">
                <div className="col-span-1 text-center">Select</div>
                <div className="col-span-2">RM Code</div>
                <div className="col-span-3">Raw Material Name</div>
                <div className="col-span-2">Live Database UOM</div>
                <div className="col-span-2 text-center">Live Stock</div>
                <div className="col-span-2">Batch / Lot Allocation</div>
              </div>

              {filteredRMs.map(rm => {
                const isSelected = !!selectedRMs[rm.id];
                const liveStock = Number(rm.currentStock || 0);
                const hasAlt = Boolean(rm.hasAlternateUom && rm.alternateUom);
                const topBatch = rm.availableBatches?.[0];

                return (
                  <div
                    key={rm.id}
                    onClick={() => handleToggleRM(rm)}
                    className={`grid grid-cols-12 gap-2 px-4 py-2.5 items-center transition-colors cursor-pointer group text-xs border-b border-slate-100 dark:border-slate-800/60 ${
                      isSelected
                        ? 'bg-amber-100/70 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800'
                        : 'hover:bg-amber-50/60 dark:hover:bg-slate-800'
                    }`}
                  >
                    {/* Checkbox */}
                    <div className="col-span-1 flex justify-center">
                      <div className={`w-4 h-4 rounded-sm flex items-center justify-center border transition-all ${
                        isSelected
                          ? 'bg-amber-500 border-amber-600 text-slate-950 font-black'
                          : 'border-slate-400 group-hover:border-amber-500'
                      }`}>
                        {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>
                    </div>

                    {/* RM Code */}
                    <div className="col-span-2 font-mono font-bold text-amber-700 dark:text-amber-400 truncate">
                      {rm.code}
                    </div>

                    {/* Name & Category */}
                    <div className="col-span-3 truncate">
                      <div className="font-bold text-slate-900 dark:text-white group-hover:text-amber-600 transition-colors truncate">
                        {rm.printName || rm.name}
                      </div>
                      <div className="text-[10px] text-slate-500 font-medium truncate">
                        {rm.category || 'Raw Material'}
                      </div>
                    </div>

                    {/* Live Database UOM & Alternate */}
                    <div className="col-span-2">
                      <span className="font-mono font-bold text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded-sm">
                        {rm.unitId || rm.consumptionUnit || 'kg'}
                      </span>
                      {hasAlt && (
                        <div className="text-[9.5px] font-semibold text-indigo-600 dark:text-indigo-400 mt-0.5 truncate" title={`Alternate: 1 ${rm.alternateUom} = ${rm.conversionFactor} ${rm.unitId}`}>
                          Alt: {rm.alternateUom} ({rm.conversionFactor}x)
                        </div>
                      )}
                    </div>

                    {/* Live Stock from DB */}
                    <div className="col-span-2 text-center">
                      <span className={`px-2 py-0.5 rounded-full font-mono font-bold text-[10px] inline-flex items-center gap-1 ${
                        liveStock > 0
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                          : 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${liveStock > 0 ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                        {liveStock} {rm.unitId || 'kg'}
                      </span>
                    </div>

                    {/* Batch / Lot Allocation */}
                    <div className="col-span-2 truncate">
                      {topBatch ? (
                        <div className="bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 rounded-sm px-1.5 py-0.5 text-[10px] font-mono text-blue-800 dark:text-blue-300 truncate" title={`Batch: ${topBatch.batchNo} | Avail: ${topBatch.remainingQty} | Exp: ${topBatch.expiryDate?.split('T')[0] || 'N/A'}`}>
                          <span className="font-bold">#{topBatch.batchNo}</span> ({topBatch.remainingQty})
                        </div>
                      ) : (
                        <span className="text-[10px] text-slate-400 italic">No lot batch queued</span>
                      )}
                    </div>
                  </div>
                );
              })}

              {filteredRMs.length === 0 && (
                <div className="p-10 text-center text-slate-400 space-y-2">
                  <div className="text-sm font-semibold">No raw materials found matching "{searchQuery}"</div>
                </div>
              )}
            </div>
          )}

        </div>

        {/* ── FOOTER ACTIONS ── */}
        <div className="p-3 bg-slate-50 dark:bg-slate-850 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 select-none">
          <div className="text-[11px] text-slate-500 font-medium">
            {activeScope === 'PRODUCTS' ? (
              <span>Click any product row to select into production • <kbd className="px-1 py-0.5 bg-slate-200 dark:bg-slate-700 rounded text-[10px] font-mono">Esc</kbd> to close</span>
            ) : (
              <span>
                {selectedRMCount > 0 ? (
                  <strong className="text-amber-600 dark:text-amber-400 font-bold">
                    ✓ {selectedRMCount} Raw Material(s) Selected
                  </strong>
                ) : (
                  <span>Check one or more raw materials to add into batch</span>
                )}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              className="text-xs font-bold"
            >
              Cancel
            </Button>

            {activeScope === 'RAW_MATERIALS' && (
              <Button
                type="button"
                size="sm"
                disabled={selectedRMCount === 0}
                onClick={handleConfirmAddRMs}
                className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold text-xs px-4 shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Plus className="w-4 h-4 stroke-[2.5]" />
                <span>Add Selected ({selectedRMCount})</span>
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
