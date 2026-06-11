import React, { useState, useEffect, useRef } from 'react';
import { api } from '@/lib/axios';
import { Search, Loader2, Check, X } from 'lucide-react';
import { twMerge } from 'tailwind-merge';

export default function HsnSelect({
  value = '',
  onChange,
  onSelect,
  placeholder = "Search or enter HSN code...",
  className = "",
  error = false,
  disabled = false,
}) {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value);
  const [suggestions, setSuggestions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  // Sync internal input value with external value prop
  useEffect(() => {
    setInputValue(value);
  }, [value]);

  // Debounce HSN search query from local database
  useEffect(() => {
    if (!open) return;

    const delayDebounce = setTimeout(async () => {
      setIsLoading(true);
      try {
        const query = (inputValue || '').trim();
        const res = await api.get(`/search/hsn?q=${encodeURIComponent(query)}&limit=15`);
        if (res.data && res.data.success) {
          setSuggestions(res.data.results || []);
        }
      } catch (err) {
        console.error('Failed to search HSN codes', err);
      } finally {
        setIsLoading(false);
      }
    }, 250);

    return () => clearTimeout(delayDebounce);
  }, [inputValue, open]);

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputChange = (e) => {
    const val = e.target.value;
    setInputValue(val);
    onChange(val);
    setOpen(true);
    setFocusedIndex(-1);
  };

  const handleSelect = (item) => {
    setInputValue(item.hsn_code);
    onChange(item.hsn_code);
    if (onSelect) {
      onSelect(item);
    }
    setOpen(false);
  };

  const handleKeyDown = (e) => {
    if (disabled) return;

    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setFocusedIndex(prev => (prev < suggestions.length - 1 ? prev + 1 : 0));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setFocusedIndex(prev => (prev > 0 ? prev - 1 : suggestions.length - 1));
        break;
      case 'Enter':
        if (focusedIndex >= 0 && focusedIndex < suggestions.length) {
          e.preventDefault();
          handleSelect(suggestions[focusedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setOpen(false);
        break;
      default:
        break;
    }
  };

  // Scroll active list item into view
  useEffect(() => {
    if (focusedIndex >= 0 && listRef.current) {
      const activeEl = listRef.current.children[focusedIndex];
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [focusedIndex]);

  return (
    <div ref={containerRef} className={twMerge("relative w-full", className)}>
      <div className="relative flex items-center">
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          disabled={disabled}
          className={twMerge(
            "w-full h-10 px-3 pr-10 border rounded-xl bg-slate-50/50 dark:bg-slate-900/50 transition-all duration-200 outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 hover:border-indigo-400 disabled:opacity-50 disabled:cursor-not-allowed font-mono text-sm",
            error ? "border-rose-500 focus:ring-rose-500/10 focus:border-rose-500" : "border-slate-300 dark:border-slate-700",
            open ? "border-indigo-500 bg-white dark:bg-slate-800" : ""
          )}
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 pointer-events-none">
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
          ) : (
            <Search className="w-4 h-4 text-slate-400" />
          )}
        </div>
      </div>

      {open && (
        <div className="absolute z-[150] mt-1.5 w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded-xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150 max-h-72 flex flex-col">
          <div className="p-2 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 text-[10px] font-bold text-slate-400 uppercase tracking-wider flex justify-between items-center">
            <span>Database Matching Codes</span>
            {isLoading && <span className="animate-pulse text-indigo-500">Searching...</span>}
          </div>
          
          <ul
            ref={listRef}
            className="overflow-y-auto p-1 divide-y divide-slate-50 dark:divide-slate-850"
          >
            {suggestions.length === 0 ? (
              <li className="px-4 py-6 text-xs text-slate-500 text-center flex flex-col items-center justify-center">
                {!isLoading ? (
                  <>
                    <span className="font-semibold text-slate-700 dark:text-slate-300">No match found in DB</span>
                    {inputValue && inputValue.trim() && (
                      <span className="text-[10px] text-slate-400 mt-1">Accepting manual entry: "{inputValue}"</span>
                    )}
                  </>
                ) : (
                  <span>Loading search results...</span>
                )}
              </li>
            ) : (
              suggestions.map((item, idx) => {
                const isSelected = value === item.hsn_code;
                const isFocused = idx === focusedIndex;
                return (
                  <li
                    key={item.hsn_code + '-' + idx}
                    onMouseDown={() => handleSelect(item)}
                    onMouseEnter={() => setFocusedIndex(idx)}
                    className={twMerge(
                      "px-3 py-2 cursor-pointer transition-colors flex flex-col gap-0.5 rounded-lg text-left",
                      isSelected
                        ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-300 font-semibold"
                        : isFocused
                          ? "bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                          : "text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                    )}
                  >
                    <div className="flex justify-between items-center w-full">
                      <span className="font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400">
                        {item.hsn_code}
                      </span>
                      <span className="text-[10px] font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/40 px-1.5 py-0.5 rounded">
                        GST: {item.gst_rate}%
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-xs md:max-w-md">
                      {item.description}
                    </p>
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
