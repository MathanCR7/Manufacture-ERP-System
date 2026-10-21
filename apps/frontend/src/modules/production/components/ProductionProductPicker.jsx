import React, { useState, useMemo } from 'react';
import { Package, Trash2, Tag, Layers, Check, Database, Search, Filter, Sparkles, Plus, AlertCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import ProductSelectionModal, { createProductSearchIndex, matchProductSearch } from './ProductSelectionModal';

export default function ProductionProductPicker({
  categories = [],
  subcategories = [],
  products = [],
  selectedCategoryId = '',
  onChangeCategory,
  selectedSubcategoryId = '',
  onChangeSubcategory,
  selectedProducts = [],
  onUpdateProducts,
  onSelectProductWithTemplate = null,
  onSelectProduct = null,
  selectedBaseId = '',
  selectedBaseName = '',
  disabled = false,
  showHeader = false,
  stepNumber = 5
}) {
  const [catalogModalOpen, setCatalogModalOpen] = useState(false);
  const [inlineSearchQuery, setInlineSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  // Pre-indexed products for quick inline search
  const productsWithIndex = useMemo(() => {
    return (products || []).map(p => ({
      product: p,
      index: createProductSearchIndex(p)
    }));
  }, [products]);

  // Inline search quick suggestions
  const inlineSuggestions = useMemo(() => {
    if (!inlineSearchQuery.trim()) return [];
    const q = inlineSearchQuery.trim();
    const scored = [];
    for (let i = 0; i < productsWithIndex.length; i++) {
      const item = productsWithIndex[i];
      const res = matchProductSearch(item.index, q);
      if (res.matched) {
        scored.push({
          product: item.product,
          score: res.score
        });
      }
    }
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, 10).map(s => s.product);
  }, [productsWithIndex, inlineSearchQuery]);

  // Handle adding product from Catalog modal or inline search
  const handleAddProduct = (product) => {
    if (!product) return;

    if (onSelectProduct) {
      onSelectProduct(product);
      return;
    }

    if (selectedProducts.some(p => p.productId === product.id)) {
      return;
    }

    const series = product.specifications?.series || product.series || 'REGULAR';
    const group = product.specifications?.group || product.group || 'GENERAL';
    const factor = Number(product.specifications?.factor || product.factor || 1);
    const baseName = product.specifications?.baseName || product.baseName || selectedBaseName;

    const newProd = {
      productId: product.id,
      name: product.name,
      code: product.code,
      series,
      group,
      factor,
      baseName,
      plannedQty: 2000,
      unit: product.unit?.abbreviation || product.unit?.name || 'Nos'
    };

    onUpdateProducts([...selectedProducts, newProd]);
  };

  // Handle removing product
  const handleRemoveProduct = (productId) => {
    onUpdateProducts(selectedProducts.filter(p => p.productId !== productId));
  };

  // Handle quantity change
  const handleQuantityChange = (productId, newQty) => {
    const val = Math.max(0, parseFloat(newQty) || 0);
    onUpdateProducts(
      selectedProducts.map(p => {
        if (p.productId === productId) {
          return { ...p, plannedQty: val };
        }
        return p;
      })
    );
  };

  const totalPlannedQty = useMemo(() => {
    return selectedProducts.reduce((sum, p) => sum + Number(p.plannedQty || 0), 0);
  }, [selectedProducts]);

  return (
    <div className="space-y-4">
      {/* Optional Standalone Header */}
      {showHeader && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-[#E3E6EC] dark:border-slate-800 gap-2">
          <div className="flex items-center gap-2.5">
            <span className="w-7 h-7 rounded-full bg-[#4F46E5] text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
              {stepNumber}
            </span>
            <div>
              <h2 className="font-bold text-base text-slate-900 dark:text-white">
                Finished products
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Pick products formulated under <strong className="text-[#4F46E5]">{selectedBaseName || 'Selected Base'}</strong>
              </p>
            </div>
          </div>

          <span className="text-xs font-semibold text-slate-500">
            Formulated under {selectedBaseName || 'Active Base'}
          </span>
        </div>
      )}

      {/* Top Action & Search Bar (Categories pills removed as requested!) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Quick Inline Multi-Token Search Bar */}
        <div className="relative flex-1 max-w-lg">
          <div className="relative flex items-center">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none" />
            <Input
              type="text"
              value={inlineSearchQuery}
              onChange={(e) => setInlineSearchQuery(e.target.value)}
              onFocus={() => setIsSearchFocused(true)}
              onBlur={() => setTimeout(() => setIsSearchFocused(false), 200)}
              placeholder="Search & add product (e.g. BFD107, gallon pista, mango)..."
              disabled={disabled}
              className="h-[44px] pl-10 pr-9 rounded-xl text-xs font-semibold border-[#E3E6EC] dark:border-slate-700 bg-white dark:bg-slate-900"
            />
            {inlineSearchQuery && (
              <button
                type="button"
                onClick={() => setInlineSearchQuery('')}
                className="absolute right-3 text-slate-400 hover:text-slate-600 text-xs font-bold cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>

          {/* Search Dropdown Results */}
          {isSearchFocused && inlineSuggestions.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-30 max-h-60 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
              {inlineSuggestions.map((prod) => {
                const isAdded = selectedProducts.some(p => p.productId === prod.id);
                return (
                  <div
                    key={prod.id}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleAddProduct(prod);
                      setInlineSearchQuery('');
                      setIsSearchFocused(false);
                    }}
                    className={`p-2.5 px-3 flex items-center justify-between hover:bg-indigo-50 dark:hover:bg-slate-800 cursor-pointer transition-colors ${
                      isAdded ? 'opacity-60 bg-slate-50' : ''
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-xs text-amber-700 dark:text-amber-400">
                          {prod.code}
                        </span>
                        <span className="font-bold text-xs text-slate-900 dark:text-white">
                          {prod.name}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400 pt-0.5">
                        {prod.category?.name || 'General'} • {prod.base?.name || selectedBaseName}
                      </div>
                    </div>

                    <div>
                      {isAdded ? (
                        <span className="text-[10px] font-bold text-emerald-600 px-2 py-0.5 rounded bg-emerald-50">
                          ✓ Added
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-indigo-600 px-2 py-0.5 rounded bg-indigo-50 hover:bg-indigo-100">
                          + Add
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Prominent Open Catalog Button */}
        <Button
          type="button"
          onClick={() => setCatalogModalOpen(true)}
          disabled={disabled}
          className="h-[44px] px-5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black text-xs shadow-xs flex items-center gap-2 transition-all cursor-pointer shrink-0 border border-amber-400/60"
        >
          <Sparkles className="w-4 h-4 fill-slate-950" />
          <span>Catalog ({products.length})</span>
        </Button>
      </div>

      {/* Selected Products Table (as shown in user mockup) */}
      <div className="border border-[#E3E6EC] dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-900 shadow-2xs">
        <table className="w-full border-collapse text-xs select-text">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 border-b border-[#E3E6EC] dark:border-slate-800 font-extrabold text-[10px] uppercase tracking-wider select-none">
              <th className="py-3 px-3 text-left w-12">#</th>
              <th className="py-3 px-4 text-left">PRODUCT NAME</th>
              <th className="py-3 px-4 text-center w-36">SKU / CODE</th>
              <th className="py-3 px-4 text-center w-48">PLANNED QTY</th>
              <th className="py-3 px-4 text-center w-20">ACTION</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E3E6EC] dark:divide-slate-800">
            {selectedProducts.map((p, idx) => (
              <tr 
                key={p.productId || idx}
                className="hover:bg-slate-50/80 dark:hover:bg-slate-850/60 transition-colors"
              >
                {/* Row Number */}
                <td className="py-3.5 px-3 text-slate-400 font-mono text-xs">
                  {idx + 1}
                </td>

                {/* Product Name & Series Breakdown */}
                <td className="py-3.5 px-4">
                  <div className="font-bold text-slate-900 dark:text-white text-sm break-words">
                    {p.name}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 pt-0.5 flex items-center gap-1.5 flex-wrap">
                    <span>Series: <strong className="text-slate-700 dark:text-slate-300">{p.series || 'REGULAR'}</strong></span>
                    <span>•</span>
                    <span>Group: <strong className="text-slate-700 dark:text-slate-300">{p.group || 'FD Gallon'}</strong></span>
                    <span>•</span>
                    <span className="font-bold text-[#4F46E5] dark:text-indigo-400">{p.baseName || selectedBaseName}</span>
                  </div>
                </td>

                {/* SKU / Code */}
                <td className="py-3.5 px-4 text-center">
                  <span className="font-mono font-bold text-xs px-2.5 py-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                    {p.code || 'N/A'}
                  </span>
                </td>

                {/* Planned Quantity Input */}
                <td className="py-3.5 px-4">
                  <div className="flex items-center justify-center gap-2">
                    <Input
                      type="number"
                      min="1"
                      disabled={disabled}
                      value={p.plannedQty}
                      onChange={(e) => handleQuantityChange(p.productId, e.target.value)}
                      className="w-28 h-[38px] text-center font-mono font-bold text-xs rounded-lg border-[#E3E6EC] dark:border-slate-700"
                    />
                    <span className="text-xs font-bold text-slate-500 shrink-0">
                      {p.unit || 'Ltr'}
                    </span>
                  </div>
                </td>

                {/* Action / Delete */}
                <td className="py-3.5 px-4 text-center">
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => handleRemoveProduct(p.productId)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
                    title="Remove product from batch"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}

            {/* Empty State */}
            {selectedProducts.length === 0 && (
              <tr>
                <td colSpan={5} className="py-10 text-center text-slate-400 bg-slate-50/40">
                  <Package className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
                  <p className="font-bold text-xs text-slate-700 dark:text-slate-300">
                    No finished products selected
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Click the <strong>Catalog ({products.length})</strong> button above or search to add products formulated under {selectedBaseName || 'Active Base'}.
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => setCatalogModalOpen(true)}
                    className="mt-3 bg-indigo-50 hover:bg-indigo-100 text-[#4F46E5] font-bold text-xs rounded-lg border border-indigo-200"
                  >
                    <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                    Browse Product Catalog
                  </Button>
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Table Footer with Total Quantity */}
        {selectedProducts.length > 0 && (
          <div className="p-3 bg-slate-50 dark:bg-slate-800/60 border-t border-[#E3E6EC] dark:border-slate-800 flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
            <span>Total Planned Products: <strong className="text-slate-900 dark:text-white">{selectedProducts.length} items</strong></span>
            <span className="font-mono font-black text-sm text-[#0F7B5F]">
              Total Output Qty: {totalPlannedQty.toLocaleString()} {selectedProducts[0]?.unit || 'Nos'}
            </span>
          </div>
        )}
      </div>

      {/* Catalog Browser Modal (just like /sales/order) */}
      <ProductSelectionModal
        isOpen={catalogModalOpen}
        onClose={() => setCatalogModalOpen(false)}
        products={products}
        selectedProducts={selectedProducts}
        onSelectProduct={(prod) => {
          handleAddProduct(prod);
        }}
        selectedBaseName={selectedBaseName}
        title="Finished Product Catalog"
      />
    </div>
  );
}
