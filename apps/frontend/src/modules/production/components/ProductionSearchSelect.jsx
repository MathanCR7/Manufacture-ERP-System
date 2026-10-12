import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Search, ChevronDown, X, Check } from 'lucide-react';

export default function ProductionSearchSelect({
  options = [],
  value = '',
  onChange,
  placeholder = 'Select option...',
  searchPlaceholder = 'Search...',
  disabled = false,
  className = '',
  renderOption = null,
  renderSelected = null,
  badgeKey = null,
  emptyMessage = 'No options found.'
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 320, maxHeight: 280 });
  
  const containerRef = useRef(null);
  const menuRef = useRef(null);
  const searchInputRef = useRef(null);

  // Calculate position in viewport to escape all overflow containers & table clipping
  const updatePosition = () => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const estimatedHeight = 280;
    const openUpwards = spaceBelow < estimatedHeight && rect.top > estimatedHeight;

    const targetWidth = Math.max(rect.width, 320);
    let targetLeft = rect.left;
    if (targetLeft + targetWidth > window.innerWidth - 12) {
      targetLeft = window.innerWidth - targetWidth - 12;
    }
    if (targetLeft < 12) targetLeft = 12;

    const calculatedHeight = openUpwards 
      ? Math.min(rect.top - 12, 320) 
      : Math.min(spaceBelow - 12, 320);

    setCoords({
      top: openUpwards ? Math.max(10, rect.top - calculatedHeight - 6) : rect.bottom + 6,
      left: targetLeft,
      width: targetWidth,
      maxHeight: calculatedHeight
    });
  };

  // Close when clicking outside
  useEffect(() => {
    const handleOutsideClick = (e) => {
      const clickedTrigger = containerRef.current && containerRef.current.contains(e.target);
      const clickedMenu = menuRef.current && menuRef.current.contains(e.target);
      if (!clickedTrigger && !clickedMenu) {
        setOpen(false);
      }
    };

    if (open) {
      document.addEventListener('mousedown', handleOutsideClick);
      updatePosition();
      window.addEventListener('scroll', updatePosition, true);
      window.addEventListener('resize', updatePosition);
    }

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [open]);

  // Focus search input when opened
  useEffect(() => {
    if (open && searchInputRef.current) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }
  }, [open]);

  // Filtered options based on search term
  const filteredOptions = useMemo(() => {
    if (!search.trim()) return options;
    const q = search.toLowerCase();
    return options.filter(opt => {
      const label = (opt.label || opt.name || '').toLowerCase();
      const sub = (opt.subLabel || opt.code || opt.series || '').toLowerCase();
      const extra = (opt.extra || opt.category || opt.baseName || '').toLowerCase();
      return label.includes(q) || sub.includes(q) || extra.includes(q);
    });
  }, [options, search]);

  const selectedItem = useMemo(() => {
    return options.find(o => (o.value !== undefined ? o.value : o.id) === value);
  }, [options, value]);

  const handleSelect = (val) => {
    onChange(val);
    setOpen(false);
    setSearch('');
  };

  const handleClear = (e) => {
    e.stopPropagation();
    onChange('');
    setSearch('');
  };

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(!open)}
        className={`w-full h-10 px-3 py-2 text-left bg-white dark:bg-slate-900 border rounded-xl text-xs font-bold transition-all flex items-center justify-between gap-2 shadow-2xs ${
          open 
            ? 'border-indigo-500 ring-2 ring-indigo-500/20 dark:border-indigo-500' 
            : 'border-slate-200 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-slate-700'
        } ${disabled ? 'opacity-60 cursor-not-allowed bg-slate-50 dark:bg-slate-950' : 'cursor-pointer'}`}
      >
        <div className="flex items-center gap-2 overflow-hidden flex-1">
          {selectedItem ? (
            renderSelected ? (
              renderSelected(selectedItem)
            ) : (
              <div className="flex items-center gap-1.5 truncate">
                <span className="text-slate-900 dark:text-white truncate font-extrabold">
                  {selectedItem.label || selectedItem.name}
                </span>
                {selectedItem.subLabel && (
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 shrink-0">
                    {selectedItem.subLabel}
                  </span>
                )}
              </div>
            )
          ) : (
            <span className="text-slate-400 font-normal truncate">{placeholder}</span>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {selectedItem && !disabled && (
            <span
              onClick={handleClear}
              className="p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X className="w-3.5 h-3.5" />
            </span>
          )}
          <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {/* Popdown Dropdown Menu rendered via Portal with Maximum Z-Index (Z: 999999) */}
      {open && typeof document !== 'undefined' && createPortal(
        <div 
          ref={menuRef}
          style={{
            position: 'fixed',
            top: `${coords.top}px`,
            left: `${coords.left}px`,
            width: `${coords.width}px`,
            maxHeight: `${coords.maxHeight}px`,
            zIndex: 999999
          }}
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        >
          {/* Integrated Search Bar */}
          <div className="p-2.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-950/70 shrink-0">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                ref={searchInputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full h-8 pl-8 pr-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-semibold text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
            <div className="flex items-center justify-between px-1 pt-1.5 text-[10px] text-slate-400">
              <span>{filteredOptions.length} match(es)</span>
              {search && <span>Filtering active</span>}
            </div>
          </div>

          {/* Options List with Smooth Scroll */}
          <div className="overflow-y-auto p-1 divide-y divide-slate-50 dark:divide-slate-800/40 flex-1">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((opt) => {
                const optVal = opt.value !== undefined ? opt.value : opt.id;
                const isSelected = optVal === value;

                return (
                  <button
                    key={optVal}
                    type="button"
                    onClick={() => handleSelect(optVal)}
                    className={`w-full text-left p-2.5 rounded-xl text-xs flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-extrabold'
                        : 'hover:bg-slate-100/70 dark:hover:bg-slate-800/70 text-slate-800 dark:text-slate-200 font-medium'
                    }`}
                  >
                    {renderOption ? (
                      renderOption(opt, isSelected)
                    ) : (
                      <div className="flex-1 truncate">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-extrabold">{opt.label || opt.name}</span>
                          {opt.subLabel && (
                            <span className="font-mono text-[9px] px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 font-bold">
                              {opt.subLabel}
                            </span>
                          )}
                          {opt.badge && (
                            <span className="font-mono text-[9px] px-1.5 py-0.2 rounded bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 font-bold">
                              {opt.badge}
                            </span>
                          )}
                        </div>
                        {opt.extra && (
                          <p className="text-[10px] text-slate-400 font-normal truncate mt-0.5">
                            {opt.extra}
                          </p>
                        )}
                      </div>
                    )}

                    {isSelected && (
                      <Check className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                    )}
                  </button>
                );
              })
            ) : (
              <div className="p-4 text-center text-xs text-slate-400 italic">
                {emptyMessage}
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
