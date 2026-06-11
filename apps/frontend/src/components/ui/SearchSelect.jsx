import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, Search, X, Plus, Check } from 'lucide-react';
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
  size = "default", // "default" or "sm"
  onAddNew = null,
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [focusedIndex, setFocusedIndex] = useState(-1);
  
  const containerRef = useRef(null);
  const searchInputRef = useRef(null);
  const listRef = useRef(null);

  // Normalize options to { value, label, subLabel } structure
  const normalizedOptions = options.map(opt => {
    if (typeof opt === 'object' && opt !== null) {
      return {
        value: opt.value !== undefined ? opt.value : opt.id,
        label: opt.label || opt.name || String(opt.value || opt.id || ''),
        subLabel: opt.subLabel || opt.phone || opt.code || null,
        raw: opt // keep reference to original object if needed
      };
    }
    return {
      value: opt,
      label: String(opt),
      subLabel: null,
      raw: opt
    };
  });

  // Filter options based on search query
  const filtered = normalizedOptions.filter(opt => {
    const term = search.toLowerCase();
    const matchesLabel = opt.label.toLowerCase().includes(term);
    const matchesSubLabel = opt.subLabel ? opt.subLabel.toLowerCase().includes(term) : false;
    const matchesValue = String(opt.value).toLowerCase().includes(term);
    return matchesLabel || matchesSubLabel || matchesValue;
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
      // Small timeout to guarantee DOM is updated and input can be focused
      const timer = setTimeout(() => {
        searchInputRef.current.focus();
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
        // Let natural tab focus change close the dropdown
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
      <div className="flex gap-2 items-center w-full">
        <button
          type="button"
          onClick={() => !disabled && setOpen(prev => !prev)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          className={twMerge(
            "w-full px-3 text-left flex items-center justify-between border rounded-xl bg-slate-50/50 dark:bg-slate-900/50 transition-all duration-200 shadow-sm outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 hover:border-indigo-400 disabled:opacity-50 disabled:cursor-not-allowed",
            isSmall ? "h-8 text-xs px-2.5 rounded-lg" : "h-[42px] text-sm px-4",
            error ? "border-rose-500 focus:ring-rose-500/10 focus:border-rose-500" : "border-slate-300 dark:border-slate-700",
            open ? "border-indigo-500 bg-white dark:bg-slate-800" : "",
            triggerClassName
          )}
        >
          <span className={twMerge(
            "truncate font-medium flex-1",
            selectedOption ? "text-slate-900 dark:text-white" : "text-slate-400 dark:text-slate-500"
          )}>
            {selectedOption 
              ? (selectedOption.subLabel 
                  ? `${selectedOption.label} (${selectedOption.subLabel})` 
                  : selectedOption.label)
              : placeholder
            }
          </span>
          <div className="flex items-center gap-1.5 ml-2 shrink-0">
            {selectedOption && !required && (
              <span
                onMouseDown={handleClear}
                className="text-slate-400 hover:text-slate-650 dark:hover:text-slate-200 cursor-pointer p-0.5 rounded transition-colors"
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
              "bg-indigo-600 hover:bg-indigo-700 text-white shrink-0 shadow-sm shadow-indigo-600/20 transition-all hover:shadow-md active:scale-95 flex items-center justify-center rounded-xl",
              isSmall ? "h-8 w-8 rounded-lg" : "h-[42px] w-[42px]"
            )}
          >
            <Plus className={isSmall ? "w-4 h-4" : "w-5 h-5"} />
          </button>
        )}
      </div>

      {open && (
        <div className="absolute z-50 mt-1.5 w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
          {showSearch && (
            <div className="p-2 border-b border-slate-100 dark:border-slate-700 relative bg-slate-50/50 dark:bg-slate-900/50">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                ref={searchInputRef}
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={searchPlaceholder}
                className="w-full pl-9 pr-8 py-1.5 text-xs sm:text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all dark:text-white"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}

          <ul 
            ref={listRef} 
            className="max-h-60 overflow-y-auto p-1 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-700"
          >
            {filtered.length === 0 ? (
              <li className="px-4 py-8 text-xs sm:text-sm text-slate-400 text-center flex flex-col items-center justify-center">
                <Search className="w-6 h-6 text-slate-300 dark:text-slate-600 mb-2" />
                No options found
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
                      "px-3 py-2.5 mx-1 my-0.5 rounded-lg cursor-pointer transition-colors flex items-center justify-between group",
                      isSmall ? "text-xs px-2.5 py-2" : "text-sm",
                      isSelected 
                        ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300 font-semibold"
                        : isFocused
                          ? "bg-slate-50 dark:bg-slate-700/50 text-slate-900 dark:text-white"
                          : "text-slate-700 dark:text-slate-350 hover:bg-slate-50 dark:hover:bg-slate-700/30"
                    )}
                  >
                    <div className="flex flex-col min-w-0 pr-2">
                      <span className="truncate">{opt.label}</span>
                      {opt.subLabel && (
                        <span className={twMerge(
                          "text-[10px] mt-0.5",
                          isSelected ? "text-indigo-550/70 dark:text-indigo-400/70" : "text-slate-400 dark:text-slate-500"
                        )}>
                          {opt.subLabel}
                        </span>
                      )}
                    </div>
                    {isSelected && (
                      <Check className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
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
