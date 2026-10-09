import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  Search, X, Check, Package, Tag, Scale, ChevronDown, 
  Layers, AlertTriangle, CheckCircle2, RotateCcw, Filter, DollarSign
} from 'lucide-react';
import { Button } from '@/components/ui/button';

export const normalizeStr = (str) => (str || '').toLowerCase().replace(/[\s\-_.,/]+/g, '');

export default function StockProductSearchSelect({
  products = [],
  selectedProductId = '',
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

  // Find currently selected product object
  const selectedProduct = useMemo(() => {
    if (!selectedProductId || !products.length) return null;
    return products.find(p => p.id === selectedProductId || p.code === selectedProductId) || null;
  }, [selectedProductId, products]);

  // Extract distinct category list from available products
  const categories = useMemo(() => {
    const catMap = new Map();
    products.forEach(p => {
      const cat = p.category || p.categoryName || p.category?.name || 'General';
      catMap.set(cat, (catMap.get(cat) || 0) + 1);
    });
    return Array.from(catMap.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [products]);

  // Space-tolerant, multi-token fuzzy search & filter
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      // Category filter
      if (selectedCategory !== 'ALL') {
        const cat = (p.category || p.categoryName || p.category?.name || 'General').toLowerCase();
        if (cat !== selectedCategory.toLowerCase()) return false;
      }

      // Stock status filter
      const available = Number(p.currentStock ?? p.availableQuantity ?? 0);
      if (stockFilter === 'IN_STOCK' && available <= 0) return false;
      if (stockFilter === 'OUT_OF_STOCK' && available > 0) return false;

      // Text search
      const q = searchTerm.trim();
      if (!q) return true;

      const qNorm = normalizeStr(q);
      const tokens = q.toLowerCase().split(/\s+/).filter(Boolean);

      const nameStr = p.name || '';
      const codeStr = p.code || '';
      const skuStr = p.sku || '';
      const catStr = p.category || p.categoryName || p.category?.name || '';
      const unitStr = p.unit || p.unitId || '';
      const composite = `${nameStr} ${codeStr} ${skuStr} ${catStr} ${unitStr}`;
      const compositeNorm = normalizeStr(composite);

      if (normalizeStr(nameStr).includes(qNorm) || normalizeStr(codeStr).includes(qNorm) || normalizeStr(skuStr).includes(qNorm) || compositeNorm.includes(qNorm)) {
        return true;
      }

      return tokens.every(token => {
        const tokenNorm = normalizeStr(token);
        return composite.toLowerCase().includes(token) || compositeNorm.includes(tokenNorm);
      });
    });
  }, [products, selectedCategory, stockFilter, searchTerm]);

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
    setSearchTerm('');
  };

  const handleClearSelection = (e) => {
    e.stopPropagation();
    if (onClear) onClear();
    setSearchTerm('');
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
              : 'border-slate-300 hover:border-indigo-500 bg-slate-50/50 hover:bg-indigo-50/20 dark:border-slate-700 dark:hover:border-indigo-400 dark:bg-slate-900/40'
          } ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <Search className="w-5 h-5" />
            </div>
            <div className="min-w-0 truncate">
              <div className="flex items-center gap-2">
                <span className="font-bold text-xs text-slate-900 dark:text-white">
                  Select Product with Category & Stock
                </span>
                <span className="px-1.5 py-0.5 text-[9px] font-extrabold uppercase bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 rounded">
                  SEARCHABLE
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                Search by code (e.g. FP-000001), name (e.g. Vanilla Cup), SKU, or category
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-600 dark:text-indigo-400 shrink-0 ml-3">
            <span>Browse Catalog &rarr;</span>
            <ChevronDown className="w-4 h-4 text-slate-400" />
          </div>
        </button>
      ) : (
        <div className="p-3.5 rounded-2xl border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/40 dark:bg-indigo-950/20 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-sm mt-0.5 sm:mt-0">
              <Package className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-extrabold text-sm text-slate-900 dark:text-white">
                  {selectedProduct.name}
                </span>
                <span className="font-mono text-xs font-bold bg-indigo-100 dark:bg-indigo-900/80 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded-lg border border-indigo-200 dark:border-indigo-800">
                  {selectedProduct.code}
                </span>
                {selectedProduct.sku && (
                  <span className="font-mono text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-1.5 py-0.5 rounded">
                    SKU: {selectedProduct.sku}
                  </span>
                )}
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                  {selectedProduct.category || selectedProduct.categoryName || 'General'}
                </span>
              </div>
              <div className="flex items-center gap-4 text-xs mt-1.5 text-slate-600 dark:text-slate-400 flex-wrap font-medium">
                <span className="flex items-center gap-1">
                  <Scale className="w-3.5 h-3.5 text-slate-400" />
                  Current Stock: <strong className="text-slate-900 dark:text-white font-mono">{Number(selectedProduct.currentStock || 0).toFixed(2)} {selectedProduct.unit || 'pcs'}</strong>
                </span>
                {selectedProduct.salePrice !== undefined && Number(selectedProduct.salePrice) > 0 && (
                  <span className="flex items-center gap-1">
                    <DollarSign className="w-3.5 h-3.5 text-slate-400" />
                    Sale Price: <strong className="text-slate-900 dark:text-white font-mono">₹{Number(selectedProduct.salePrice).toFixed(2)}</strong>
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
              className="h-8 text-xs font-bold rounded-xl border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100/50 cursor-pointer"
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

      {/* Search Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div 
            ref={modalRef}
            className="w-full max-w-3xl bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[88vh] animate-in zoom-in-95 duration-150"
          >
            {/* Header */}
            <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 bg-slate-50/50 dark:bg-slate-950/50">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                  <Package className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white">
                    Select Finished Product
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Showing {filteredProducts.length} of {products.length} catalog products
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Search Input Bar */}
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 space-y-3 bg-white dark:bg-slate-900">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Type product name, FP-code, SKU, or category to filter..."
                  className="w-full h-10 pl-10 pr-9 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium placeholder:text-slate-400"
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm('')}
                    className="w-5 h-5 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 absolute right-3 top-1/2 -translate-y-1/2"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Category Pills & Stock Status Filters */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1 text-xs">
                {/* Category Pills */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full no-scrollbar">
                  <button
                    type="button"
                    onClick={() => setSelectedCategory('ALL')}
                    className={`px-2.5 py-1 rounded-lg font-bold text-[11px] whitespace-nowrap transition-colors cursor-pointer ${
                      selectedCategory === 'ALL'
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    All Categories ({products.length})
                  </button>
                  {categories.map(([catName, count]) => (
                    <button
                      key={catName}
                      type="button"
                      onClick={() => setSelectedCategory(catName)}
                      className={`px-2.5 py-1 rounded-lg font-bold text-[11px] whitespace-nowrap transition-colors cursor-pointer ${
                        selectedCategory === catName
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                      }`}
                    >
                      {catName} ({count})
                    </button>
                  ))}
                </div>

                {/* Stock Level Filter */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => setStockFilter('ALL')}
                    className={`px-2 py-0.5 rounded-md text-[10px] font-bold border transition-colors cursor-pointer ${
                      stockFilter === 'ALL'
                        ? 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900 border-slate-800 dark:border-slate-200'
                        : 'border-slate-200 dark:border-slate-700 text-slate-500'
                    }`}
                  >
                    All Stock
                  </button>
                  <button
                    type="button"
                    onClick={() => setStockFilter('IN_STOCK')}
                    className={`px-2 py-0.5 rounded-md text-[10px] font-bold border transition-colors cursor-pointer ${
                      stockFilter === 'IN_STOCK'
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'border-slate-200 dark:border-slate-700 text-slate-500 hover:text-emerald-600'
                    }`}
                  >
                    In Stock (&gt; 0)
                  </button>
                  <button
                    type="button"
                    onClick={() => setStockFilter('OUT_OF_STOCK')}
                    className={`px-2 py-0.5 rounded-md text-[10px] font-bold border transition-colors cursor-pointer ${
                      stockFilter === 'OUT_OF_STOCK'
                        ? 'bg-rose-600 text-white border-rose-600'
                        : 'border-slate-200 dark:border-slate-700 text-slate-500 hover:text-rose-600'
                    }`}
                  >
                    Zero Stock (0)
                  </button>
                </div>
              </div>
            </div>

            {/* Product List Content */}
            <div className="overflow-y-auto flex-1 p-2 sm:p-3 divide-y divide-slate-100 dark:divide-slate-800/60 max-h-[55vh]">
              {filteredProducts.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-400 space-y-2">
                  <Package className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto" />
                  <p className="font-semibold text-slate-600 dark:text-slate-400">No matching products found</p>
                  <p className="text-[11px]">Try adjusting your search keywords or category filters.</p>
                </div>
              ) : (
                filteredProducts.map((p) => {
                  const isSelected = selectedProduct?.id === p.id;
                  const currentStock = Number(p.currentStock ?? 0);
                  const isLow = currentStock > 0 && currentStock <= Number(p.minLevel || p.alertLevel || 5);
                  const isZero = currentStock <= 0;

                  return (
                    <div
                      key={p.id}
                      onClick={() => handleSelectProduct(p)}
                      className={`p-3 rounded-2xl cursor-pointer transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs group ${
                        isSelected 
                          ? 'bg-indigo-50/80 dark:bg-indigo-950/60 ring-1 ring-indigo-500/30' 
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'
                      }`}
                    >
                      <div className="min-w-0 flex items-start gap-3">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 font-bold text-xs ${
                          isSelected
                            ? 'bg-indigo-600 text-white'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 group-hover:bg-indigo-100 group-hover:text-indigo-600 transition-colors'
                        }`}>
                          <Package className="w-4 h-4" />
                        </div>
                        <div className="min-w-0 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-slate-900 dark:text-white text-xs">
                              {p.name}
                            </span>
                            <span className="font-mono text-[10px] bg-slate-100 dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 font-bold px-1.5 py-0.5 rounded">
                              {p.code}
                            </span>
                            {p.sku && (
                              <span className="font-mono text-[9px] bg-slate-100 dark:bg-slate-800 text-slate-500 px-1 py-0.5 rounded">
                                SKU: {p.sku}
                              </span>
                            )}
                            <span className="text-[10px] text-slate-500 font-medium">
                              • {p.category || p.categoryName || 'General'}
                            </span>
                          </div>

                          <div className="flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400 flex-wrap">
                            <span>UOM: <b className="text-slate-800 dark:text-slate-200">{p.unit || 'pcs'}</b></span>
                            {p.salePrice !== undefined && Number(p.salePrice) > 0 && (
                              <span>Price: <b className="text-slate-800 dark:text-slate-200">₹{Number(p.salePrice).toFixed(2)}</b></span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right: Stock Status & Action */}
                      <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-1.5 shrink-0 pl-12 sm:pl-0">
                        <div className="text-right">
                          <div className="flex items-center gap-1.5 justify-end">
                            <span className={`inline-block w-2 h-2 rounded-full ${
                              isZero ? 'bg-rose-500' : isLow ? 'bg-amber-500' : 'bg-emerald-500'
                            }`} />
                            <span className="font-mono font-bold text-xs text-slate-900 dark:text-white">
                              {currentStock.toFixed(2)} {p.unit || 'pcs'}
                            </span>
                          </div>
                          <span className={`text-[10px] font-semibold block ${
                            isZero ? 'text-rose-600 dark:text-rose-400' : isLow ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'
                          }`}>
                            {isZero ? 'Out of Stock' : isLow ? 'Low Stock Warning' : 'Optimal In Stock'}
                          </span>
                        </div>

                        <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 group-hover:underline flex items-center gap-0.5">
                          {isSelected ? '✓ Selected' : 'Select →'}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 flex items-center justify-between text-xs">
              <span className="text-slate-500 text-[11px]">
                Tip: Press <kbd className="px-1.5 py-0.5 bg-slate-200 dark:bg-slate-800 rounded font-mono text-[10px]">Esc</kbd> to exit search
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsOpen(false)}
                className="h-8 rounded-xl text-xs font-bold px-4"
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
