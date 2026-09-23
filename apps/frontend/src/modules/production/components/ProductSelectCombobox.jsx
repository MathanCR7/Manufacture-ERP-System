import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Search, ChevronDown, Check, X, Factory, Layers, Package, AlertCircle } from 'lucide-react';

export default function ProductSelectCombobox({
  products = [],
  value,
  onChange,
  placeholder = "Select product to schedule...",
  error,
  disabled = false,
  required = false,
  className = "",
  autoFocus = false
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  const selectedProduct = useMemo(() => {
    return products.find(p => p.id === value) || null;
  }, [products, value]);

  const filteredProducts = useMemo(() => {
    if (!searchTerm.trim()) return products;
    const term = searchTerm.toLowerCase();
    return products.filter(p => {
      const nameMatch = p.name?.toLowerCase().includes(term);
      const codeMatch = p.code?.toLowerCase().includes(term);
      const categoryMatch = p.category?.name?.toLowerCase().includes(term);
      return nameMatch || codeMatch || categoryMatch;
    });
  }, [products, searchTerm]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Keyboard navigation
  const handleKeyDown = (e) => {
    if (disabled) return;

    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setIsOpen(true);
        setHighlightedIndex(0);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev => (prev < filteredProducts.length - 1 ? prev + 1 : 0));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => (prev > 0 ? prev - 1 : filteredProducts.length - 1));
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < filteredProducts.length) {
          handleSelect(filteredProducts[highlightedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        setSearchTerm('');
        break;
      case 'Tab':
        setIsOpen(false);
        setSearchTerm('');
        break;
      default:
        break;
    }
  };

  // Scroll highlighted item into view
  useEffect(() => {
    if (isOpen && listRef.current && highlightedIndex >= 0) {
      const items = listRef.current.querySelectorAll('[data-combobox-item]');
      if (items[highlightedIndex]) {
        items[highlightedIndex].scrollIntoView({ block: 'nearest' });
      }
    }
  }, [highlightedIndex, isOpen]);

  const handleSelect = (product) => {
    onChange?.(product.id, product);
    setIsOpen(false);
    setSearchTerm('');
  };

  const handleClear = (e) => {
    e.stopPropagation();
    onChange?.('', null);
    setSearchTerm('');
  };

  return (
    <div ref={containerRef} className={`relative select-none ${className}`}>
      {/* Trigger Button */}
      <div
        role="combobox"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        tabIndex={disabled ? -1 : 0}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        onKeyDown={handleKeyDown}
        className={`w-full min-h-[44px] px-3 py-2 bg-white dark:bg-slate-900 border rounded-xl flex items-center justify-between gap-2.5 cursor-pointer transition-all duration-150 ${
          disabled
            ? 'opacity-60 bg-slate-100 dark:bg-slate-800 cursor-not-allowed border-slate-200 dark:border-slate-800'
            : isOpen
            ? 'border-indigo-500 ring-2 ring-indigo-500/20 shadow-sm'
            : error
            ? 'border-rose-400 dark:border-rose-500/80 bg-rose-50/20'
            : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 shadow-2xs'
        }`}
      >
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          {selectedProduct ? (
            <>
              {/* Product Thumbnail */}
              <div className="w-8 h-8 rounded-lg overflow-hidden shrink-0 bg-indigo-50 dark:bg-indigo-950/50 border border-slate-200/80 dark:border-slate-750 flex items-center justify-center">
                {selectedProduct.imageUrl ? (
                  <img
                    src={selectedProduct.imageUrl}
                    alt={selectedProduct.name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                      e.currentTarget.nextSibling.style.display = 'flex';
                    }}
                  />
                ) : null}
                <div
                  className={`w-full h-full items-center justify-center font-bold text-xs text-indigo-600 dark:text-indigo-400 ${
                    selectedProduct.imageUrl ? 'hidden' : 'flex'
                  }`}
                >
                  {selectedProduct.name ? selectedProduct.name.charAt(0).toUpperCase() : <Package className="w-4 h-4" />}
                </div>
              </div>

              {/* Product Name & Code */}
              <div className="min-w-0 flex-1 text-left">
                <div className="flex items-center gap-1.5 truncate">
                  <span className="font-semibold text-xs text-slate-800 dark:text-slate-100 truncate">
                    {selectedProduct.name}
                  </span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                    {selectedProduct.code}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[10px] text-slate-500 dark:text-slate-400 truncate">
                  <span>{selectedProduct.category?.name || 'General'}</span>
                  <span>•</span>
                  <span>Unit: {selectedProduct.unit?.abbreviation || selectedProduct.unit?.name || 'pcs'}</span>
                  {selectedProduct.currentStock !== undefined && (
                    <>
                      <span>•</span>
                      <span className="font-medium">Stock: {Number(selectedProduct.currentStock).toLocaleString('en-IN')}</span>
                    </>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="flex items-center gap-2 text-slate-400 dark:text-slate-500 text-xs">
              <Package className="w-4 h-4 text-slate-400 shrink-0" />
              <span className="truncate">{placeholder}</span>
            </div>
          )}
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-1 shrink-0">
          {selectedProduct && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="Clear product"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <ChevronDown
            className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
              isOpen ? 'rotate-180 text-indigo-500' : ''
            }`}
          />
        </div>
      </div>

      {/* Floating Dropdown List */}
      {isOpen && (
        <div className="absolute z-50 left-0 right-0 mt-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-750 rounded-2xl shadow-xl overflow-hidden animate__animated animate__fadeIn animate__faster">
          {/* Search Box */}
          <div className="p-2 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40">
            <div className="relative flex items-center">
              <Search className="w-3.5 h-3.5 absolute left-3 text-slate-400" />
              <input
                ref={inputRef}
                autoFocus
                type="text"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setHighlightedIndex(0);
                }}
                onKeyDown={handleKeyDown}
                placeholder="Search product by name, code or category..."
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1.5 focus:ring-indigo-500/30 focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Results List */}
          <div
            ref={listRef}
            role="listbox"
            className="max-h-64 overflow-y-auto p-1.5 space-y-1 divide-y divide-slate-50 dark:divide-slate-850"
          >
            {filteredProducts.length > 0 ? (
              filteredProducts.map((p, index) => {
                const isSelected = p.id === value;
                const isHighlighted = index === highlightedIndex;

                return (
                  <div
                    key={p.id}
                    data-combobox-item
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => handleSelect(p)}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    className={`px-2.5 py-2 rounded-xl flex items-center justify-between gap-3 cursor-pointer transition-all duration-100 text-xs ${
                      isSelected
                        ? 'bg-indigo-50/80 dark:bg-indigo-950/50 text-indigo-900 dark:text-indigo-200'
                        : isHighlighted
                        ? 'bg-slate-100/80 dark:bg-slate-800/60 text-slate-900 dark:text-white'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/40 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      {/* Thumbnail */}
                      <div className="w-8 h-8 rounded-lg overflow-hidden shrink-0 bg-slate-100 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 flex items-center justify-center">
                        {p.imageUrl ? (
                          <img
                            src={p.imageUrl}
                            alt={p.name}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                              e.currentTarget.nextSibling.style.display = 'flex';
                            }}
                          />
                        ) : null}
                        <div
                          className={`w-full h-full items-center justify-center font-bold text-xs text-indigo-600 dark:text-indigo-400 ${
                            p.imageUrl ? 'hidden' : 'flex'
                          }`}
                        >
                          {p.name ? p.name.charAt(0).toUpperCase() : <Package className="w-3.5 h-3.5" />}
                        </div>
                      </div>

                      {/* Info */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 truncate">
                          <span className="font-semibold text-slate-800 dark:text-white truncate">
                            {p.name}
                          </span>
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-slate-200/70 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                            {p.code}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                          <span>{p.category?.name || 'Uncategorized'}</span>
                          <span>•</span>
                          <span>UOM: {p.unit?.abbreviation || p.unit?.name || 'pcs'}</span>
                          {p.bom && p.bom.length > 0 && (
                            <>
                              <span>•</span>
                              <span className="text-indigo-600 dark:text-indigo-400 font-medium">
                                {p.bom.length} BOM Items
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Stock Status Badge & Check */}
                    <div className="flex items-center gap-2 shrink-0 text-right">
                      {p.currentStock !== undefined && (
                        <div className="text-[10px]">
                          <span className="text-slate-400 block text-[9px]">Stock</span>
                          <span
                            className={`font-semibold font-mono ${
                              Number(p.currentStock) <= 0
                                ? 'text-rose-600 dark:text-rose-400 font-bold'
                                : 'text-emerald-600 dark:text-emerald-400'
                            }`}
                          >
                            {Number(p.currentStock).toLocaleString('en-IN')} {p.unit?.abbreviation || 'pcs'}
                          </span>
                        </div>
                      )}
                      {isSelected && (
                        <div className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center">
                          <Check className="w-3 h-3" strokeWidth={3} />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="py-8 text-center text-xs text-slate-400 space-y-1">
                <AlertCircle className="w-6 h-6 text-slate-300 dark:text-slate-600 mx-auto" />
                <p className="font-semibold text-slate-600 dark:text-slate-400">No products found</p>
                <p className="text-[10px]">Try adjusting your search query</p>
              </div>
            )}
          </div>
        </div>
      )}

      {error && (
        <p className="mt-1 text-[11px] font-semibold text-rose-500 dark:text-rose-400 flex items-center gap-1">
          <AlertCircle className="w-3 h-3" />
          {error}
        </p>
      )}
    </div>
  );
}
