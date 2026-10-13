import React, { useState, useMemo } from 'react';
import { Package, Plus, Trash2, Tag, Layers, Check, Database, Search, Filter, Sparkles } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import ProductionSearchSelect from './ProductionSearchSelect';

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
  selectedBaseId = '',
  selectedBaseName = '',
  disabled = false
}) {
  // Filter mode: 'SELECTED_BASE', 'ICE_CREAM', 'KULFI', 'FD', or 'ALL'
  const [activeBaseTab, setActiveBaseTab] = useState('SELECTED_BASE');
  const [productSearchTerm, setProductSearchTerm] = useState('');

  // Count products by base category
  const baseCounts = useMemo(() => {
    let ice = 0;
    let kulfi = 0;
    let fd = 0;
    products.forEach(p => {
      const bName = (p.base?.name || p.specifications?.baseName || '').toUpperCase();
      const grp = (p.specifications?.group || '').toLowerCase();
      const code = (p.code || '').toUpperCase();
      if (bName.includes('KULFI') || grp.includes('kulfi') || code.startsWith('K')) {
        kulfi += 1;
      } else if (bName.includes('FD') || grp.includes('fd') || code.startsWith('BFD')) {
        fd += 1;
      } else {
        ice += 1;
      }
    });
    return { ice, kulfi, fd, total: products.length };
  }, [products]);

  // Cascading filter for subcategories
  const filteredSubcategories = useMemo(() => {
    if (!selectedCategoryId) return subcategories;
    return subcategories.filter(s => s.categoryId === selectedCategoryId);
  }, [subcategories, selectedCategoryId]);

  // Products filtered by Category, Subcategory, and Base
  const baseFilteredProducts = useMemo(() => {
    return products.filter(p => {
      const pBaseId = p.baseId || p.specifications?.baseId;
      const pBaseName = (p.base?.name || p.specifications?.baseName || '').toUpperCase();
      const currentBaseName = (selectedBaseName || '').toUpperCase();

      const matchesBase = 
        (selectedBaseId && pBaseId === selectedBaseId) ||
        (currentBaseName && pBaseName.includes(currentBaseName)) ||
        (currentBaseName.includes('KULFI') && (p.specifications?.group?.toLowerCase().includes('kulfi') || p.code?.startsWith('K'))) ||
        (currentBaseName.includes('FD') && (p.specifications?.group?.toLowerCase().includes('fd') || p.code?.startsWith('BFD'))) ||
        (currentBaseName.includes('ICE CREAM') && (p.specifications?.group?.toLowerCase().includes('gallon') || p.code?.startsWith('BG') || p.specifications?.group?.toLowerCase().includes('popsicle')));

      return matchesBase;
    });
  }, [products, selectedBaseId, selectedBaseName]);

  // Active pool of products based on activeBaseTab
  const activeProductsPool = useMemo(() => {
    let list = products;
    if (activeBaseTab === 'SELECTED_BASE' && selectedBaseId) {
      list = baseFilteredProducts;
    } else if (activeBaseTab === 'ICE_CREAM') {
      list = products.filter(p => {
        const b = (p.base?.name || p.specifications?.baseName || '').toUpperCase();
        return b.includes('ICE') || p.code?.startsWith('BG') || p.specifications?.group?.toLowerCase().includes('gallon');
      });
    } else if (activeBaseTab === 'KULFI') {
      list = products.filter(p => {
        const b = (p.base?.name || p.specifications?.baseName || '').toUpperCase();
        return b.includes('KULFI') || p.code?.startsWith('K') || p.specifications?.group?.toLowerCase().includes('kulfi');
      });
    } else if (activeBaseTab === 'FD') {
      list = products.filter(p => {
        const b = (p.base?.name || p.specifications?.baseName || '').toUpperCase();
        return b.includes('FD') || p.code?.startsWith('BFD') || p.specifications?.group?.toLowerCase().includes('fd');
      });
    }

    if (selectedCategoryId) {
      list = list.filter(p => p.categoryId === selectedCategoryId);
    }
    if (selectedSubcategoryId) {
      list = list.filter(p => p.subcategoryId === selectedSubcategoryId);
    }
    return list;
  }, [activeBaseTab, selectedBaseId, baseFilteredProducts, products, selectedCategoryId, selectedSubcategoryId]);

  // Options for Category SearchSelect
  const categoryOptions = useMemo(() => {
    return [
      { value: '', label: 'All Categories (e.g. Classic Cream Gallon)...' },
      ...categories.map(c => ({
        value: c.id,
        label: c.name,
        subLabel: c.code || null
      }))
    ];
  }, [categories]);

  // Options for Subcategory SearchSelect
  const subcategoryOptions = useMemo(() => {
    return [
      { value: '', label: 'All Sub Categories...' },
      ...filteredSubcategories.map(s => ({
        value: s.id,
        label: s.name,
        subLabel: s.code || null
      }))
    ];
  }, [filteredSubcategories]);

  // Options for Product SearchSelect
  const productOptions = useMemo(() => {
    return activeProductsPool.map(p => {
      const series = p.specifications?.series || p.brand || 'BG';
      const group = p.specifications?.group || p.category?.name || 'Gallon';
      const baseName = p.base?.name || p.specifications?.baseName || (
        p.code?.startsWith('K') ? 'KULFI BASE' : 
        p.code?.startsWith('BFD') ? 'FD BASE' : 'ICE CREAM BASE'
      );
      const isAlreadyAdded = selectedProducts.some(sp => sp.productId === p.id);

      return {
        value: p.id,
        label: p.name,
        subLabel: p.code,
        badge: baseName,
        extra: `Series: ${series} • Group: ${group} • ${p.specifications?.sizeML || ''} ${isAlreadyAdded ? '✓ Added' : ''}`,
        disabled: isAlreadyAdded,
        raw: p
      };
    });
  }, [activeProductsPool, selectedProducts]);

  // Handle adding a product to selected list
  const handleAddProduct = (productId) => {
    if (!productId) return;
    const prod = products.find(p => p.id === productId);
    if (!prod) return;

    if (selectedProducts.some(p => p.productId === productId)) return;

    const series = prod.specifications?.series || prod.brand || 'BG';
    const group = prod.specifications?.group || prod.category?.name || 'Gallon';
    const factor = Number(prod.specifications?.factor || 1.0);
    const baseName = prod.base?.name || prod.specifications?.baseName || selectedBaseName || 'ICE CREAM BASE';

    onUpdateProducts([
      ...selectedProducts,
      {
        productId: prod.id,
        name: prod.name,
        code: prod.code,
        series,
        group,
        factor,
        baseName,
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
    <div className="space-y-4 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl p-4 sm:p-5 shadow-xs">
      
      {/* Step Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 gap-2">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
            <Package className="w-4 h-4" />
          </div>
          <div>
            <label className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-1.5">
              <span>Step C: Select Category, Sub Category & Finished Products</span>
              <span className="text-rose-500">*</span>
            </label>
            <p className="text-[11px] text-slate-400">
              Pick products formulated under <strong className="text-indigo-600 dark:text-indigo-400 font-black">{selectedBaseName || 'Selected Base'}</strong>
            </p>
          </div>
        </div>

        {/* Base Filter Tabs */}
        <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl self-start sm:self-auto flex-wrap">
          {selectedBaseName && (
            <button
              type="button"
              onClick={() => setActiveBaseTab('SELECTED_BASE')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1 ${
                activeBaseTab === 'SELECTED_BASE'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <Database className="w-3 h-3 text-indigo-500" />
              <span>Current {selectedBaseName} ({baseFilteredProducts.length})</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setActiveBaseTab('ICE_CREAM')}
            className={`px-2 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
              activeBaseTab === 'ICE_CREAM'
                ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            🍦 Ice Cream ({baseCounts.ice})
          </button>

          <button
            type="button"
            onClick={() => setActiveBaseTab('KULFI')}
            className={`px-2 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
              activeBaseTab === 'KULFI'
                ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            🍢 Kulfi ({baseCounts.kulfi})
          </button>

          <button
            type="button"
            onClick={() => setActiveBaseTab('FD')}
            className={`px-2 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
              activeBaseTab === 'FD'
                ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            ❄️ FD ({baseCounts.fd})
          </button>

          <button
            type="button"
            onClick={() => setActiveBaseTab('ALL')}
            className={`px-2 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
              activeBaseTab === 'ALL'
                ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            📦 All ({baseCounts.total})
          </button>
        </div>
      </div>

      {/* 3 Searchable Dropdowns (Category, Subcategory, Products) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        
        {/* Category Searchable Dropdown */}
        <div className="space-y-1">
          <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
            1. Category
          </Label>
          <ProductionSearchSelect
            options={categoryOptions}
            value={selectedCategoryId}
            onChange={(val) => {
              onChangeCategory(val);
              onChangeSubcategory('');
            }}
            placeholder="Search & Select Category..."
            searchPlaceholder="Type to search categories..."
            disabled={disabled}
            emptyMessage="No matching categories."
          />
        </div>

        {/* Sub Category Searchable Dropdown */}
        <div className="space-y-1">
          <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
            2. Sub Category
          </Label>
          <ProductionSearchSelect
            options={subcategoryOptions}
            value={selectedSubcategoryId}
            onChange={(val) => onChangeSubcategory(val)}
            placeholder="Search & Select Sub Category..."
            searchPlaceholder="Type to search subcategories..."
            disabled={disabled}
            emptyMessage="No matching subcategories."
          />
        </div>

        {/* Product Searchable Dropdown */}
        <div className="space-y-1">
          <Label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
            <span>3. Add Finished Product</span>
            <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold">
              {activeProductsPool.length} available
            </span>
          </Label>
          <ProductionSearchSelect
            options={productOptions}
            value=""
            onChange={(prodId) => handleAddProduct(prodId)}
            placeholder="+ Search & Add Product (e.g. Vanilla)..."
            searchPlaceholder="Type product name, code (e.g. BG101), series..."
            disabled={disabled}
            emptyMessage="No products match your search or filter."
            renderOption={(opt, isSelected) => (
              <div className="flex-1 truncate">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-extrabold text-slate-900 dark:text-white">
                    {opt.label}
                  </span>
                  <span className="font-mono text-[9px] font-black px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                    {opt.subLabel}
                  </span>
                  {opt.badge && (
                    <span className="font-mono text-[9px] px-1.5 py-0.2 rounded bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 font-extrabold">
                      {opt.badge}
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-slate-400 font-mono truncate mt-0.5">
                  {opt.extra}
                </p>
              </div>
            )}
          />
        </div>
      </div>

      {/* Selected Products List */}
      {selectedProducts.length > 0 ? (
        <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
              Finished Products to be Produced in this Batch ({selectedProducts.length}):
            </span>
            <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
              Total Planned Output: <strong className="text-indigo-600 dark:text-indigo-400">
                {selectedProducts.reduce((sum, p) => sum + Number(p.plannedQty || 0), 0)} Nos
              </strong>
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {selectedProducts.map((p) => (
              <div 
                key={p.productId}
                className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-850 flex items-center justify-between gap-3 shadow-2xs hover:border-indigo-200 transition-colors"
              >
                <div className="space-y-1 flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-extrabold text-sm text-slate-900 dark:text-white truncate">
                      {p.name}
                    </span>
                    <span className="font-mono text-[10px] font-black px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200">
                      {p.code}
                    </span>
                    {p.baseName && (
                      <span className="font-mono text-[9px] font-black px-1.5 py-0.5 rounded bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300">
                        {p.baseName}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 text-[10px] text-slate-500 dark:text-slate-400 font-mono flex-wrap">
                    <span>Series: <strong className="text-slate-700 dark:text-slate-200">{p.series}</strong></span>
                    <span>•</span>
                    <span>Group: <strong className="text-slate-700 dark:text-slate-200">{p.group}</strong></span>
                    <span>•</span>
                    <span>Factor: <strong className="text-indigo-600 dark:text-indigo-400">{p.factor}</strong></span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
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
        <div className="p-5 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 text-center text-xs text-slate-400 bg-slate-50/40 dark:bg-slate-900/40 space-y-1">
          <p className="font-bold text-slate-600 dark:text-slate-300">No products added yet.</p>
          <p className="text-[11px]">Use the search bar dropdown above to select products to produce in this batch.</p>
        </div>
      )}
    </div>
  );
}
