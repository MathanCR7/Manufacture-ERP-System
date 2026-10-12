import React, { useMemo } from 'react';
import { Package, Plus, Trash2, Tag, Layers, Check } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

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
  disabled = false
}) {
  // Cascading filter for subcategories
  const filteredSubcategories = useMemo(() => {
    if (!selectedCategoryId) return subcategories;
    return subcategories.filter(s => s.categoryId === selectedCategoryId);
  }, [subcategories, selectedCategoryId]);

  // Cascading filter for products
  const filteredProducts = useMemo(() => {
    let list = products;
    if (selectedCategoryId) {
      list = list.filter(p => p.categoryId === selectedCategoryId);
    }
    if (selectedSubcategoryId) {
      list = list.filter(p => p.subcategoryId === selectedSubcategoryId);
    }
    return list;
  }, [products, selectedCategoryId, selectedSubcategoryId]);

  // Handle adding a product to selected list
  const handleAddProduct = (productId) => {
    if (!productId) return;
    const prod = products.find(p => p.id === productId);
    if (!prod) return;

    if (selectedProducts.some(p => p.productId === productId)) return;

    // Check specs or fallback attributes
    const series = prod.specifications?.series || prod.brand || 'BG';
    const group = prod.specifications?.groupName || prod.category?.name || 'Gallon';
    const factor = Number(prod.specifications?.factor || 1.0);

    onUpdateProducts([
      ...selectedProducts,
      {
        productId: prod.id,
        name: prod.name,
        code: prod.code,
        series,
        group,
        factor,
        plannedQty: 100,
        unit: prod.unit?.abbreviation || 'Nos'
      }
    ]);
  };

  const handleRemoveProduct = (productId) => {
    onUpdateProducts(selectedProducts.filter(p => p.productId !== productId));
  };

  const handleQtyChange = (productId, qty) => {
    onUpdateProducts(
      selectedProducts.map(p => 
        p.productId === productId ? { ...p, plannedQty: Number(qty || 0) } : p
      )
    );
  };

  return (
    <div className="space-y-4 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl p-5 shadow-xs">
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
        <label className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
          <Package className="w-3.5 h-3.5 text-indigo-500" />
          <span>Step C: Select Category, Sub Category & Finished Products</span>
          <span className="text-rose-500">*</span>
        </label>
        <span className="text-[11px] text-slate-400 font-semibold">
          Multi-product batch allocation enabled
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Category */}
        <div className="space-y-1">
          <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Category</Label>
          <select
            value={selectedCategoryId}
            disabled={disabled}
            onChange={(e) => {
              onChangeCategory(e.target.value);
              onChangeSubcategory('');
            }}
            className="w-full h-10 px-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="">All Categories (e.g. Classic Cream Gallon)...</option>
            {categories.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        {/* Sub Category */}
        <div className="space-y-1">
          <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Sub Category</Label>
          <select
            value={selectedSubcategoryId}
            disabled={disabled}
            onChange={(e) => onChangeSubcategory(e.target.value)}
            className="w-full h-10 px-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="">All Sub Categories...</option>
            {filteredSubcategories.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>

        {/* Product Dropdown Selector to add */}
        <div className="space-y-1">
          <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Add Product / Item</Label>
          <select
            disabled={disabled}
            onChange={(e) => {
              handleAddProduct(e.target.value);
              e.target.value = '';
            }}
            className="w-full h-10 px-3 bg-indigo-50/50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 rounded-xl text-xs font-bold text-indigo-700 dark:text-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">+ Add Product to Batch (e.g. Vanilla)...</option>
            {filteredProducts.map(p => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.code})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Selected Products List */}
      {selectedProducts.length > 0 ? (
        <div className="space-y-2 pt-2">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
            Target Products in this Batch:
          </span>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {selectedProducts.map((p) => (
              <div 
                key={p.productId}
                className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-850 flex items-center justify-between gap-3 shadow-2xs"
              >
                <div className="space-y-1 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-extrabold text-sm text-slate-900 dark:text-white">
                      {p.name}
                    </span>
                    <span className="font-mono text-[10px] font-black px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200">
                      {p.code}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-[10px] text-slate-500 dark:text-slate-400 font-mono flex-wrap">
                    <span>Series: <strong className="text-slate-700 dark:text-slate-200">{p.series}</strong></span>
                    <span>•</span>
                    <span>Group: <strong className="text-slate-700 dark:text-slate-200">{p.group}</strong></span>
                    <span>•</span>
                    <span>Factor: <strong className="text-indigo-600 dark:text-indigo-400">{p.factor}</strong></span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="w-24">
                    <Label className="text-[9px] font-bold text-slate-400 block">Planned Qty</Label>
                    <Input
                      type="number"
                      min="1"
                      disabled={disabled}
                      value={p.plannedQty}
                      onChange={(e) => handleQtyChange(p.productId, e.target.value)}
                      className="h-8 text-center font-mono font-bold text-xs rounded-xl"
                    />
                  </div>

                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => handleRemoveProduct(p.productId)}
                    className="p-1.5 mt-3.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                    title="Remove Product"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="p-4 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-center text-xs text-slate-400">
          No products selected yet. Pick a product from the dropdown above to allocate production.
        </div>
      )}
    </div>
  );
}
