import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, Search, X, Plus, Check, Tag } from 'lucide-react';
import { twMerge } from 'tailwind-merge';

export default function SearchSelect({
  options = [],
  value,
  onChange,
  placeholder = "Select option...",
  searchPlaceholder = "Search...",
  showSearch = true,
  error = false,
  disabled = false,
  required = false,
  className = "",
  triggerClassName = "",
  menuClassName = "",
  size = "default", // "default" or "sm"
  onAddNew = null,
  align = "left", // "left" or "right"
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [focusedIndex, setFocusedIndex] = useState(-1);
  
  const containerRef = useRef(null);
  const searchInputRef = useRef(null);
  const listRef = useRef(null);

  // Normalize options to { value, label, subLabel, category, code, uom, raw } structure
  const normalizedOptions = options.map(opt => {
    if (typeof opt === 'object' && opt !== null) {
      const val = opt.value !== undefined ? opt.value : opt.id;
      const lbl = opt.label || opt.name || opt.title || opt.unitName || String(val || '');
      const code = opt.code || opt.rmCode || opt.itemCode || opt.unitCode || opt.mouldCode || null;
      const cat = typeof opt.category === 'object' && opt.category !== null 
        ? (opt.category.name || opt.category.title)
        : (opt.category || opt.categoryName || opt.cat || opt.unitType || opt.mouldCategory || null);
      const sub = opt.subLabel || opt.phone || (code && code !== lbl ? code : null);
      const uom = opt.uom || opt.unit || opt.unitId || null;
      return {
        value: val,
        label: lbl,
        subLabel: sub,
        category: cat,
        code: code,
        uom: uom,
        raw: opt
      };
    }
    return {
      value: opt,
      label: String(opt),
      subLabel: null,
      category: null,
      code: null,
      uom: null,
      raw: opt
    };
  });

  // Filter options based on search query
  const filtered = normalizedOptions.filter(opt => {
    if (!search.trim()) return true;
    const term = search.toLowerCase().trim();
    const matchesLabel = String(opt.label || '').toLowerCase().includes(term);
    const matchesSubLabel = opt.subLabel ? String(opt.subLabel).toLowerCase().includes(term) : false;
    const matchesCategory = opt.category ? String(opt.category).toLowerCase().includes(term) : false;
    const matchesCode = opt.code ? String(opt.code).toLowerCase().includes(term) : false;
    const matchesValue = String(opt.value || '').toLowerCase().includes(term);
    return matchesLabel || matchesSubLabel || matchesCategory || matchesCode || matchesValue;
  });

  // Get currently selected option
  const selectedOption = normalizedOptions.find(opt => opt.value === value);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (open && showSearch && searchInputRef.current) {
      const timer = setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [open, showSearch]);

  // Reset focus index when search query changes or when dropdown opens
  useEffect(() => {
    setFocusedIndex(filtered.length > 0 ? 0 : -1);
  }, [search, open]);

  // Scroll focused element into view
  useEffect(() => {
    if (focusedIndex >= 0 && listRef.current) {
      const activeEl = listRef.current.children[focusedIndex];
      if (activeEl) {
        activeEl.scrollIntoView({
          block: 'nearest',
        });
      }
    }
  }, [focusedIndex]);

  const handleSelect = (option) => {
    if (disabled) return;
    onChange(option.value);
    setOpen(false);
    setSearch('');
  };

  const handleClear = (e) => {
    e.stopPropagation();
    onChange('');
    setSearch('');
  };

  // Keyboard accessibility
  const handleKeyDown = (e) => {
    if (disabled) return;

    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setFocusedIndex(prev => (prev < filtered.length - 1 ? prev + 1 : 0));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setFocusedIndex(prev => (prev > 0 ? prev - 1 : filtered.length - 1));
        break;
      case 'Enter':
        e.preventDefault();
        if (focusedIndex >= 0 && focusedIndex < filtered.length) {
          handleSelect(filtered[focusedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setOpen(false);
        setSearch('');
        break;
      case 'Tab':
        setOpen(false);
        setSearch('');
        break;
      default:
        break;
    }
  };

  const isSmall = size === "sm";

  return (
    <div ref={containerRef} className={twMerge("relative w-full", className)}>
      <div className="flex gap-1.5 items-center w-full">
        <button
          type="button"
          onClick={() => !disabled && setOpen(prev => !prev)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          className={twMerge(
            "w-full text-left flex items-center justify-between border rounded-xl bg-white dark:bg-slate-900 transition-all duration-150 shadow-2xs outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 hover:border-indigo-400 dark:hover:border-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer",
            isSmall ? "h-8 text-xs px-2.5 rounded-lg" : "h-[38px] text-sm px-3",
            error ? "border-rose-500 focus:ring-rose-500/10 focus:border-rose-500" : "border-slate-300 dark:border-slate-700",
            open ? "border-indigo-500 ring-2 ring-indigo-500/15" : "",
            triggerClassName
          )}
        >
          {selectedOption ? (
            <div className="flex items-center gap-1.5 min-w-0 flex-1 overflow-hidden">
              {selectedOption.code && (
                <span className="font-mono font-bold text-[9px] px-1.5 py-0.2 rounded bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800 shrink-0">
                  {selectedOption.code}
                </span>
              )}
              <span className="truncate font-semibold text-slate-900 dark:text-white">
                {selectedOption.label}
              </span>
              {selectedOption.category && (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[8.5px] font-bold bg-amber-50 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-200/80 dark:border-amber-800 shrink-0 ml-auto">
                  <Tag className="w-2.5 h-2.5 text-amber-600 dark:text-amber-400" />
                  {selectedOption.category}
                </span>
              )}
            </div>
          ) : (
            <span className="truncate font-medium flex-1 text-slate-400 dark:text-slate-500">
              {placeholder}
            </span>
          )}

          <div className="flex items-center gap-1 ml-1.5 shrink-0">
            {selectedOption && !required && !disabled && (
              <span
                onMouseDown={handleClear}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer p-0.5 rounded transition-colors"
                title="Clear selection"
              >
                <X className="w-3.5 h-3.5" />
              </span>
            )}
            <ChevronDown className={twMerge(
              "text-slate-400 transition-transform duration-200 shrink-0",
              isSmall ? "w-3.5 h-3.5" : "w-4 h-4",
              open ? "rotate-180 text-indigo-500" : ""
            )} />
          </div>
        </button>

        {onAddNew && (
          <button
            type="button"
            onClick={onAddNew}
            disabled={disabled}
            className={twMerge(
              "bg-indigo-600 hover:bg-indigo-700 text-white shrink-0 shadow-xs transition-all hover:shadow active:scale-95 flex items-center justify-center rounded-xl cursor-pointer",
              isSmall ? "h-8 w-8 rounded-lg" : "h-[38px] w-[38px]"
            )}
          >
            <Plus className={isSmall ? "w-3.5 h-3.5" : "w-4 h-4"} />
          </button>
        )}
      </div>

      {open && (
        <div className={twMerge(
          "absolute z-[9999] mt-1 min-w-[260px] w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-100",
          align === "right" ? "right-0" : "left-0",
          menuClassName
        )}>
          {showSearch && (
            <div className="p-2 border-b border-slate-100 dark:border-slate-800 relative bg-slate-50/80 dark:bg-slate-950/80">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                ref={searchInputRef}
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={searchPlaceholder}
                className="w-full pl-8 pr-7 py-1 text-xs border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 text-slate-800 dark:text-slate-100 font-medium placeholder:text-slate-400"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          )}

          <ul 
            ref={listRef} 
            className="max-h-60 overflow-y-auto p-1 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-700"
          >
            {filtered.length === 0 ? (
              <li className="px-3 py-6 text-xs text-slate-400 text-center flex flex-col items-center justify-center">
                <Search className="w-5 h-5 text-slate-300 dark:text-slate-600 mb-1.5" />
                No matching options found
              </li>
            ) : (
              filtered.map((opt, idx) => {
                const isSelected = value === opt.value;
                const isFocused = idx === focusedIndex;
                return (
                  <li
                    key={String(opt.value) + '-' + idx}
                    onMouseDown={() => handleSelect(opt)}
                    onMouseEnter={() => setFocusedIndex(idx)}
                    className={twMerge(
                      "px-2.5 py-1.5 mx-0.5 my-0.5 rounded-lg cursor-pointer transition-all flex items-center justify-between group",
                      isSmall ? "text-xs py-1.5" : "text-sm",
                      isSelected 
                        ? "bg-indigo-50 dark:bg-indigo-950/70 text-indigo-900 dark:text-indigo-200 font-bold border border-indigo-200 dark:border-indigo-800/80 shadow-2xs"
                        : isFocused
                          ? "bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white"
                          : "text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                    )}
                  >
                    <div className="flex flex-col min-w-0 pr-2 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {opt.code && (
                          <span className="font-mono font-bold text-[9px] px-1.5 py-0.2 rounded bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 shrink-0">
                            {opt.code}
                          </span>
                        )}
                        <span className="font-semibold text-slate-900 dark:text-white truncate">
                          {opt.label}
                        </span>
                        {opt.category && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[8.5px] font-bold bg-amber-50 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-200 dark:border-amber-800 ml-auto shrink-0">
                            <Tag className="w-2.5 h-2.5 text-amber-600 dark:text-amber-400" />
                            {opt.category}
                          </span>
                        )}
                      </div>
                      {(opt.subLabel || opt.uom) && (
                        <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                          {opt.subLabel && opt.subLabel !== opt.code && <span>{opt.subLabel}</span>}
                          {opt.uom && (
                            <span className="font-mono font-bold text-slate-500 dark:text-slate-400">
                              Unit: {opt.uom}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    {isSelected && (
                      <Check className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0 ml-1.5" />
                    )}
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
