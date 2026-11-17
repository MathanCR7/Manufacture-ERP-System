import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Calendar, X } from 'lucide-react';

export const DASHBOARD_PERIOD_OPTIONS = [
  { key: '7d', label: 'Last 7D' },
  { key: 'this_month', label: 'This Month' },
  { key: 'last_month', label: 'Last Month' },
  { key: 'this_year', label: 'This Year' },
  { key: 'all_time', label: 'All Time' }
];

export default function DashboardDatePeriodFilter({
  activePeriod: propPeriod,
  onPeriodChange,
  customRange: propCustomRange,
  onCustomRangeChange,
  badge = null,
  className = ''
}) {
  const [internalPeriod, setInternalPeriod] = useState('7d');
  const [internalCustomRange, setInternalCustomRange] = useState({ startDate: '', endDate: '' });

  const activePeriod = propPeriod !== undefined ? propPeriod : internalPeriod;
  const activeCustomRange = propCustomRange !== undefined ? propCustomRange : internalCustomRange;

  const [showCustomPopover, setShowCustomPopover] = useState(false);
  const [tempStart, setTempStart] = useState(activeCustomRange?.startDate || '');
  const [tempEnd, setTempEnd] = useState(activeCustomRange?.endDate || '');

  const buttonRef = useRef(null);
  const [popoverPos, setPopoverPos] = useState({ top: 0, right: 0 });

  const updatePosition = () => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;
    if (!isMobile) {
      const spaceBelow = window.innerHeight - rect.bottom;
      const popoverHeight = 240;
      const openUpwards = spaceBelow < popoverHeight && rect.top > popoverHeight;
      setPopoverPos({
        top: openUpwards ? Math.max(10, rect.top - popoverHeight - 6) : rect.bottom + 6,
        right: Math.max(12, window.innerWidth - rect.right)
      });
    }
  };

  useEffect(() => {
    if (showCustomPopover) {
      updatePosition();
      const handleScrollOrResize = () => updatePosition();
      window.addEventListener('scroll', handleScrollOrResize, true);
      window.addEventListener('resize', handleScrollOrResize);
      return () => {
        window.removeEventListener('scroll', handleScrollOrResize, true);
        window.removeEventListener('resize', handleScrollOrResize);
      };
    }
  }, [showCustomPopover]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setShowCustomPopover(false);
      }
    };
    if (showCustomPopover) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [showCustomPopover]);

  const handleSelectPeriod = (key) => {
    setShowCustomPopover(false);
    if (onPeriodChange) {
      onPeriodChange(key);
    } else {
      setInternalPeriod(key);
    }
  };

  const handleApplyCustom = () => {
    if (!tempStart || !tempEnd) {
      alert('Please select both From Date and To Date.');
      return;
    }
    if (new Date(tempStart) > new Date(tempEnd)) {
      alert('From Date cannot be later than To Date.');
      return;
    }
    const range = { startDate: tempStart, endDate: tempEnd };
    if (onCustomRangeChange) {
      onCustomRangeChange(range);
    } else {
      setInternalCustomRange(range);
    }

    if (onPeriodChange) {
      onPeriodChange('custom', range);
    } else {
      setInternalPeriod('custom');
    }
    setShowCustomPopover(false);
  };

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;

  return (
    <div className={`flex items-center gap-1 sm:gap-1.5 relative max-w-full ${className}`}>
      {badge}

      {/* Pill Group - Desktop Clean Row / Mobile Touch-Scrollable Strip */}
      <div className="flex items-center gap-0.5 bg-slate-100 dark:bg-slate-800 p-0.5 rounded border border-slate-200 dark:border-slate-700 max-w-full sm:overflow-visible overflow-x-auto scrollbar-none touch-pan-x">
        {DASHBOARD_PERIOD_OPTIONS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => handleSelectPeriod(item.key)}
            className={`px-1.5 py-0.5 text-[9px] sm:text-[9.5px] font-bold rounded cursor-pointer transition-colors whitespace-nowrap shrink-0 ${
              activePeriod === item.key
                ? 'bg-[#0A6ED1] text-white shadow-2xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            {item.label}
          </button>
        ))}

        {/* Set Date Range Button */}
        <div className="relative shrink-0">
          <button
            ref={buttonRef}
            type="button"
            onClick={() => {
              setTempStart(activeCustomRange?.startDate || '');
              setTempEnd(activeCustomRange?.endDate || '');
              updatePosition();
              setShowCustomPopover((prev) => !prev);
            }}
            className={`px-1.5 py-0.5 text-[9px] sm:text-[9.5px] font-bold rounded cursor-pointer transition-colors flex items-center gap-1 whitespace-nowrap shrink-0 ${
              activePeriod === 'custom'
                ? 'bg-[#0A6ED1] text-white shadow-2xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
            title="Set Custom Date Range"
          >
            <Calendar className="w-2.5 h-2.5 sm:w-3 sm:h-3 shrink-0" />
            <span>
              {activePeriod === 'custom' && activeCustomRange?.startDate && activeCustomRange?.endDate
                ? `${activeCustomRange.startDate} → ${activeCustomRange.endDate}`
                : 'Set Date Range'}
            </span>
            {activePeriod === 'custom' && (
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation();
                  handleSelectPeriod('7d');
                }}
                className="hover:bg-blue-600/70 p-0.5 rounded transition-colors ml-0.5 cursor-pointer"
                title="Reset to default period"
              >
                <X className="w-2.5 h-2.5" />
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Popover Menu rendered via Portal into document.body with Perfect Z-Index (1000000) */}
      {showCustomPopover && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[999999] pointer-events-auto">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-900/30 dark:bg-slate-950/50 backdrop-blur-[1px] transition-opacity"
            onClick={() => setShowCustomPopover(false)}
          />

          {/* Interactive Popover Dialog (Dropdown attached to button on Desktop, Centered Modal on Mobile) */}
          <div
            style={
              !isMobile
                ? {
                    position: 'fixed',
                    top: `${popoverPos.top}px`,
                    right: `${popoverPos.right}px`,
                    width: '300px',
                    zIndex: 1000000
                  }
                : {
                    position: 'fixed',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: 'calc(100vw - 32px)',
                    maxWidth: '340px',
                    zIndex: 1000000
                  }
            }
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl p-3 sm:p-3.5 space-y-3 animate-in fade-in zoom-in-95 duration-150"
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <span className="text-[11.5px] font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-[#0A6ED1]" />
                Set Date Range
              </span>
              <button
                type="button"
                onClick={() => setShowCustomPopover(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-0.5 rounded cursor-pointer transition-colors"
                title="Close"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-2.5 text-left">
              <div>
                <label className="text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider block mb-1">
                  From Date
                </label>
                <input
                  type="date"
                  value={tempStart}
                  onChange={(e) => setTempStart(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-md focus:outline-hidden focus:ring-1 focus:ring-[#0A6ED1] text-slate-900 dark:text-slate-100 font-medium cursor-pointer"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider block mb-1">
                  To Date
                </label>
                <input
                  type="date"
                  value={tempEnd}
                  onChange={(e) => setTempEnd(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-md focus:outline-hidden focus:ring-1 focus:ring-[#0A6ED1] text-slate-900 dark:text-slate-100 font-medium cursor-pointer"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowCustomPopover(false)}
                className="px-2.5 py-1 text-[10.5px] font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApplyCustom}
                className="px-3 py-1 text-[10.5px] font-bold bg-[#0A6ED1] hover:bg-blue-600 text-white rounded cursor-pointer shadow-xs transition-colors"
              >
                Apply Range
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
