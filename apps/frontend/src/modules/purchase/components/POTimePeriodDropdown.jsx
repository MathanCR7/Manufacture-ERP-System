import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Calendar,
  ChevronDown,
  X,
  Loader2,
  Filter
} from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function POTimePeriodDropdown({
  period = 'all',
  setPeriod,
  customStartDate = '',
  setCustomStartDate,
  customEndDate = '',
  setCustomEndDate,
  appliedCustomStart = '',
  appliedCustomEnd = '',
  handleApplyCustomRange,
  handleClearCustomRange,
  dateBasis = 'invoice_date',
  setDateBasis,
  periodDisplayText,
  matchCount,
  isFetching = false,
  className = ''
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const periodOptions = [
    { id: 'all', label: 'All Time' },
    { id: 'today', label: 'Today' },
    { id: 'this_year', label: 'This Year' },
    { id: 'this_week', label: 'This Week' },
    { id: 'last_week', label: 'Last Week' },
    { id: 'this_month', label: 'This Month' },
    { id: 'last_month', label: 'Last Month' },
    { id: 'custom', label: 'Custom Date Range' }
  ];

  const activeOption = periodOptions.find(p => p.id === period) || periodOptions[0];

  const triggerLabel = useMemo(() => {
    const basisPrefix = dateBasis === 'invoice_date' ? 'Inv' : 'PO';
    if (period === 'custom' && (appliedCustomStart || appliedCustomEnd)) {
      return `${basisPrefix}: ${appliedCustomStart || '...'} → ${appliedCustomEnd || '...'}`;
    }
    if (period === 'all') {
      return 'All Time';
    }
    return `${basisPrefix}: ${activeOption.label}`;
  }, [period, activeOption, dateBasis, appliedCustomStart, appliedCustomEnd]);

  const isFiltered = period !== 'all';

  return (
    <div ref={dropdownRef} className={`relative ${className}`}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full sm:w-auto h-8 text-xs px-2.5 py-1 rounded-lg border transition-all flex items-center justify-between gap-1.5 text-left cursor-pointer min-w-[130px] sm:min-w-[145px] ${
          isFiltered
            ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-300 dark:border-emerald-700 text-emerald-900 dark:text-emerald-200 font-semibold shadow-3xs'
            : 'bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-700/80 text-slate-700 dark:text-slate-200 hover:border-slate-300 dark:hover:border-slate-600 shadow-3xs'
        }`}
        title={`Time Period: ${activeOption.label} (${dateBasis === 'invoice_date' ? 'Supplier Invoice Date' : 'PO Creation Date'})`}
      >
        <div className="flex items-center gap-1.5 truncate">
          <Calendar className={`w-3.5 h-3.5 shrink-0 ${isFiltered ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`} />
          <span className="truncate">
            {triggerLabel}
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {isFiltered && (
            <span
              onClick={(e) => {
                e.stopPropagation();
                setPeriod('all');
                handleClearCustomRange?.();
              }}
              className="p-0.5 rounded-full hover:bg-emerald-200 dark:hover:bg-emerald-800 text-emerald-700 dark:text-emerald-300 transition-colors"
              title="Reset to All Time"
            >
              <X className="w-3 h-3" />
            </span>
          )}
          <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isOpen ? 'rotate-180 text-emerald-600' : ''}`} />
        </div>
      </button>

      {/* Popover Dropdown Menu */}
      {isOpen && (
        <div className="absolute z-50 mt-1 w-full min-w-[280px] sm:min-w-[320px] max-w-[calc(100vw-32px)] left-0 sm:left-auto sm:right-0 md:left-0 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl p-2.5 space-y-2 animate-in fade-in zoom-in-95 duration-100">
          {/* Header */}
          <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-200 border-b border-slate-100 dark:border-slate-800 pb-1.5">
            <span className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Select Time Period:</span>
            </span>
            {isFetching ? (
              <span className="flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>Syncing...</span>
              </span>
            ) : matchCount !== undefined ? (
              <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                {matchCount} POs
              </span>
            ) : null}
          </div>

          {/* Date Basis Toggle: Invoice Date (Default) vs PO Date */}
          <div className="flex items-center justify-between p-1 bg-slate-50 dark:bg-slate-800/80 rounded-lg border border-slate-200/70 dark:border-slate-700/70">
            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider pl-1 flex items-center gap-1">
              <Filter className="w-2.5 h-2.5 text-slate-400" />
              <span>Date Filter:</span>
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setDateBasis?.('invoice_date')}
                className={`text-[10.5px] font-bold px-2 py-0.5 rounded-md transition-all cursor-pointer ${
                  dateBasis === 'invoice_date'
                    ? 'bg-emerald-600 text-white shadow-3xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:white'
                }`}
                title="Filter POs by Supplier Invoice Date"
              >
                Invoice Date
              </button>
              <button
                type="button"
                onClick={() => setDateBasis?.('po_date')}
                className={`text-[10.5px] font-bold px-2 py-0.5 rounded-md transition-all cursor-pointer ${
                  dateBasis === 'po_date'
                    ? 'bg-emerald-600 text-white shadow-3xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:white'
                }`}
                title="Filter POs by PO Creation / Order Date"
              >
                PO Date
              </button>
            </div>
          </div>

          {/* Quick Preset Buttons (2 Columns Matching Original Design) */}
          <div className="grid grid-cols-2 gap-1">
            {periodOptions.map(p => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setPeriod(p.id);
                  if (p.id !== 'custom') {
                    handleClearCustomRange?.();
                    setIsOpen(false);
                  }
                }}
                className={`text-xs px-2.5 py-1.5 rounded-lg text-left font-medium transition-all cursor-pointer flex items-center justify-between ${
                  period === p.id
                    ? 'bg-emerald-600 text-white font-semibold shadow-xs'
                    : 'bg-slate-50 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200'
                }`}
              >
                <span>{p.label}</span>
                {period === p.id && <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />}
              </button>
            ))}
          </div>

          {/* Custom Date Form (Shown when custom is selected) */}
          {period === 'custom' && (
            <form
              onSubmit={(e) => {
                handleApplyCustomRange?.(e);
                setIsOpen(false);
              }}
              className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1.5"
            >
              <div className="grid grid-cols-2 gap-1.5">
                <div>
                  <label className="text-[10px] font-medium text-slate-500 block mb-0.5">From Date:</label>
                  <input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate?.(e.target.value)}
                    className="w-full text-xs px-2 py-1 rounded-md border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-hidden focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-medium text-slate-500 block mb-0.5">To Date:</label>
                  <input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate?.(e.target.value)}
                    className="w-full text-xs px-2 py-1 rounded-md border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-hidden focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>
              <div className="flex items-center justify-end gap-1.5 pt-0.5">
                {(appliedCustomStart || appliedCustomEnd) && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      handleClearCustomRange?.();
                      setPeriod('all');
                      setIsOpen(false);
                    }}
                    className="text-xs h-7 px-2"
                  >
                    Clear
                  </Button>
                )}
                <Button
                  type="submit"
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-7 px-3"
                >
                  Apply Range
                </Button>
              </div>
            </form>
          )}

          {/* Timeframe & Calculation Indicator Info Footer */}
          <div className="pt-1.5 border-t border-slate-100 dark:border-slate-800 text-[10px] space-y-1 text-slate-500 dark:text-slate-400">
            <div className="flex items-center justify-between">
              <span>Timeframe:</span>
              <span className="font-semibold text-slate-700 dark:text-slate-300 truncate max-w-[190px]">
                {periodDisplayText?.rangeText || 'Complete History'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Calculation:</span>
              <span className="px-1.5 py-0.5 rounded-full font-medium text-[9.5px] bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300">
                {dateBasis === 'invoice_date' ? 'Supplier Invoice Date' : 'PO Order Date'}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
