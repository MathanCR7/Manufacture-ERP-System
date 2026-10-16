import React, { useState, useMemo } from 'react';
import { Package, Trash2, Tag, Layers, Check, Database, Search, Filter, Sparkles } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import ProductionSearchSelect from './ProductionSearchSelect';
import ProductSelectionModal from './ProductSelectionModal';

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
  selectedBaseId = '',
  selectedBaseName = '',
  disabled = false,
  showHeader = false
}) {
  // Filter mode: 'SELECTED_BASE', 'ICE_CREAM', 'KULFI', 'FD', or 'ALL'
  const [activeBaseTab, setActiveBaseTab] = useState('SELECTED_BASE');
  const [catalogModalOpen, setCatalogModalOpen] = useState(false);

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

  // Products filtered by current Base
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
      list = baseFilteredProducts.length > 0 ? baseFilteredProducts : products;
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
      const isAlreadyAdded = selectedProducts.some(sp => sp.productId === p.id);

      return {
        value: p.id,
        label: p.name,
        subLabel: p.code,
        extra: `Series: ${series} • Group: ${group} ${isAlreadyAdded ? '✓ Added' : ''}`,
        disabled: isAlreadyAdded,
        raw: p
      };
    });
  }, [activeProductsPool, selectedProducts]);

  // Handle adding a product
  const handleAddProduct = (productId, productObj = null) => {
    if (!productId && !productObj) return;
    const prod = productObj || products.find(p => p.id === productId);
    if (!prod) return;

    if (selectedProducts.some(p => p.productId === prod.id)) return;

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
        unit: prod.unit?.abbreviation || prod.unit?.name || 'Nos'
      }
    ]);

    if (onSelectProductWithTemplate) {
      onSelectProductWithTemplate(prod);
    }
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
    <div className="space-y-4">
      {/* Scope pills: Current Base (x), Ice Cream (x), Kulfi (x), FD (x), All (x) */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar flex-wrap">
        {selectedBaseName && (
          <button
            type="button"
            onClick={() => setActiveBaseTab('SELECTED_BASE')}
            className={`h-[36px] px-3.5 rounded-full text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
              activeBaseTab === 'SELECTED_BASE'
                ? 'bg-[#4F46E5] text-white shadow-xs'
                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-[#E3E6EC] dark:border-slate-700 hover:border-indigo-300'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            <span>Current {selectedBaseName} ({baseFilteredProducts.length})</span>
          </button>
        )}

        <button
          type="button"
          onClick={() => setActiveBaseTab('ICE_CREAM')}
          className={`h-[36px] px-3.5 rounded-full text-xs font-bold transition-all cursor-pointer shrink-0 ${
            activeBaseTab === 'ICE_CREAM'
              ? 'bg-[#4F46E5] text-white shadow-xs'
              : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-[#E3E6EC] dark:border-slate-700 hover:border-indigo-300'
          }`}
        >
          Ice Cream ({baseCounts.ice})
        </button>

        <button
          type="button"
          onClick={() => setActiveBaseTab('KULFI')}
          className={`h-[36px] px-3.5 rounded-full text-xs font-bold transition-all cursor-pointer shrink-0 ${
            activeBaseTab === 'KULFI'
              ? 'bg-[#4F46E5] text-white shadow-xs'
              : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-[#E3E6EC] dark:border-slate-700 hover:border-indigo-300'
          }`}
        >
          Kulfi ({baseCounts.kulfi})
        </button>

        <button
          type="button"
          onClick={() => setActiveBaseTab('FD')}
          className={`h-[36px] px-3.5 rounded-full text-xs font-bold transition-all cursor-pointer shrink-0 ${
            activeBaseTab === 'FD'
              ? 'bg-[#4F46E5] text-white shadow-xs'
              : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-[#E3E6EC] dark:border-slate-700 hover:border-indigo-300'
          }`}
        >
          FD ({baseCounts.fd})
        </button>

        <button
          type="button"
          onClick={() => setActiveBaseTab('ALL')}
          className={`h-[36px] px-3.5 rounded-full text-xs font-bold transition-all cursor-pointer shrink-0 ${
            activeBaseTab === 'ALL'
              ? 'bg-[#4F46E5] text-white shadow-xs'
              : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-[#E3E6EC] dark:border-slate-700 hover:border-indigo-300'
          }`}
        >
          All ({baseCounts.total})
        </button>
      </div>

      {/* Filter row: Category select, Sub category select, "Add finished product" search-and-add, and amber "Catalog (x)" button */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
        {/* Category select */}
        <div className="md:col-span-3 space-y-1.5">
          <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
            Category
          </Label>
          <div className="h-[44px]">
            <ProductionSearchSelect
              options={categoryOptions}
              value={selectedCategoryId}
              onChange={(val) => {
                onChangeCategory(val);
                onChangeSubcategory('');
              }}
              placeholder="All Categories..."
              searchPlaceholder="Filter category..."
              disabled={disabled}
              className="h-[44px] rounded-[10px]"
            />
          </div>
        </div>

        {/* Sub category select */}
        <div className="md:col-span-3 space-y-1.5">
          <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
            Sub Category
          </Label>
          <div className="h-[44px]">
            <ProductionSearchSelect
              options={subcategoryOptions}
              value={selectedSubcategoryId}
              onChange={(val) => onChangeSubcategory(val)}
              placeholder="All Subcategories..."
              searchPlaceholder="Filter subcategory..."
              disabled={disabled}
              className="h-[44px] rounded-[10px]"
            />
          </div>
        </div>

        {/* Add finished product search-and-add input */}
        <div className="md:col-span-4 space-y-1.5">
          <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
            Add Finished Product
          </Label>
          <div className="h-[44px]">
            <ProductionSearchSelect
              options={productOptions}
              value=""
              onChange={(prodId) => handleAddProduct(prodId)}
              placeholder="+ Search & Add Product..."
              searchPlaceholder="Type product name, SKU..."
              disabled={disabled}
              className="h-[44px] rounded-[10px]"
              renderOption={(opt) => (
                <div className="flex-1 py-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-bold text-slate-900 dark:text-white break-words">
                      {opt.label}
                    </span>
                    <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                      {opt.subLabel}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                    {opt.extra}
                  </p>
                </div>
              )}
            />
          </div>
        </div>

        {/* Amber Catalog (x) button */}
        <div className="md:col-span-2">
          <Button
            type="button"
            disabled={disabled}
            onClick={() => setCatalogModalOpen(true)}
            className="w-full h-[44px] rounded-[10px] bg-[#B45309] hover:bg-[#92400E] text-white font-bold text-xs shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
            title="Open 2-tier product catalog screening popup"
          >
            <Sparkles className="w-4 h-4 text-amber-200" />
            <span>Catalog ({activeProductsPool.length})</span>
          </Button>
        </div>
      </div>

      {/* Selected Products Table or Empty State */}
      {selectedProducts.length > 0 ? (
        <div className="rounded-[12px] border border-[#E3E6EC] dark:border-slate-800 overflow-hidden bg-white dark:bg-slate-900 shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-[#E3E6EC] dark:border-slate-800 text-slate-600 dark:text-slate-400 font-bold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4 w-12 text-center">#</th>
                  <th className="py-3 px-4">Product Name</th>
                  <th className="py-3 px-4 w-32">SKU / Code</th>
                  <th className="py-3 px-4 w-44">Planned Qty</th>
                  <th className="py-3 px-4 w-20 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E3E6EC] dark:divide-slate-800">
                {selectedProducts.map((p, idx) => (
                  <tr key={p.productId || idx} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4 text-center font-mono font-bold text-slate-400">
                      {idx + 1}
                    </td>
                    <td className="py-3 px-4">
                      <div 
                        className="font-bold text-sm text-slate-900 dark:text-white break-words whitespace-normal leading-snug"
                        title={p.name}
                      >
                        {p.name}
                      </div>
                      <div className="flex items-center gap-2 pt-0.5 text-xs text-slate-400 font-mono flex-wrap">
                        <span>Series: <strong className="text-slate-700 dark:text-slate-300">{p.series}</strong></span>
                        <span>•</span>
                        <span>Group: <strong className="text-slate-700 dark:text-slate-300">{p.group}</strong></span>
                        {p.baseName && (
                          <>
                            <span>•</span>
                            <span className="text-indigo-600 dark:text-indigo-400 font-bold">{p.baseName}</span>
                          </>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-slate-700 dark:text-slate-300">
                      <span className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 text-xs">
                        {p.code || 'N/A'}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          min="1"
                          disabled={disabled}
                          value={p.plannedQty}
                          onChange={(e) => handleQtyChange(p.productId, e.target.value)}
                          className="h-[44px] text-center font-mono font-bold text-sm rounded-[10px] w-28 border-[#E3E6EC]"
                        />
                        <span className="text-xs font-bold text-slate-500 font-mono">
                          {p.unit || 'Nos'}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() => handleRemoveProduct(p.productId)}
                        className="p-2 rounded-[8px] text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                        title="Remove product from batch"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Empty state: dashed box, "No products added yet", help text, and amber "Open product catalog" button */
        <div className="p-8 rounded-[12px] border-2 border-dashed border-[#E3E6EC] dark:border-slate-800 text-center bg-slate-50/50 dark:bg-slate-900/50 space-y-3">
          <div className="w-12 h-12 rounded-full bg-amber-50 dark:bg-amber-950/60 text-[#B45309] dark:text-amber-400 flex items-center justify-center mx-auto shadow-xs">
            <Package className="w-6 h-6" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-white">
              No products added yet
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto pt-1 leading-relaxed">
              Add products using the search-and-add bar above, or browse the complete 2-tier screening catalog popup to pick items.
            </p>
          </div>
          <Button
            type="button"
            disabled={disabled}
            onClick={() => setCatalogModalOpen(true)}
            className="h-[44px] px-5 rounded-[10px] bg-[#B45309] hover:bg-[#92400E] text-white font-bold text-xs inline-flex items-center gap-2 shadow-xs cursor-pointer"
          >
            <Sparkles className="w-4 h-4 text-amber-200" />
            <span>Open Product Catalog</span>
          </Button>
        </div>
      )}

      {/* 2-tier Catalog Modal */}
      <ProductSelectionModal
        isOpen={catalogModalOpen}
        onClose={() => setCatalogModalOpen(false)}
        products={activeProductsPool.length > 0 ? activeProductsPool : products}
        onSelectProduct={(p) => handleAddProduct(p.id, p)}
        title={`Select Finished Product (${selectedBaseName || 'ICE CREAM BASE'})`}
      />
    </div>
  );
}
