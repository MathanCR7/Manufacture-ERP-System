import React, { useState } from 'react';
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
      alert('Please select both Start Date and End Date.');
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

  return (
    <div className={`flex items-center gap-1.5 relative ${className}`}>
      {badge}

      {/* Pill Group */}
      <div className="flex items-center gap-0.5 bg-slate-100 dark:bg-slate-800 p-0.5 rounded border border-slate-200 dark:border-slate-700">
        {DASHBOARD_PERIOD_OPTIONS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => handleSelectPeriod(item.key)}
            className={`px-1.5 py-0.5 text-[9.5px] font-bold rounded cursor-pointer transition-colors whitespace-nowrap ${
              activePeriod === item.key
                ? 'bg-[#0A6ED1] text-white shadow-2xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            {item.label}
          </button>
        ))}

        {/* Set Date Range Button */}
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setTempStart(activeCustomRange?.startDate || '');
              setTempEnd(activeCustomRange?.endDate || '');
              setShowCustomPopover((prev) => !prev);
            }}
            className={`px-1.5 py-0.5 text-[9.5px] font-bold rounded cursor-pointer transition-colors flex items-center gap-1 whitespace-nowrap ${
              activePeriod === 'custom'
                ? 'bg-[#0A6ED1] text-white shadow-2xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
            title="Set Custom Date Range"
          >
            <Calendar className="w-3 h-3 shrink-0" />
            <span>
              {activePeriod === 'custom' && activeCustomRange?.startDate && activeCustomRange?.endDate
                ? `${activeCustomRange.startDate} → ${activeCustomRange.endDate}`
                : 'Set Date Range'}
            </span>
          </button>

          {/* Interactive Popover */}
          {showCustomPopover && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setShowCustomPopover(false)}
              />
              <div className="absolute right-0 mt-2 w-68 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl z-50 p-3 space-y-2.5 animate-in fade-in zoom-in-95 duration-100">
                <div className="flex items-center justify-between pb-1.5 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-[#0A6ED1]" />
                    Set Date Range
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowCustomPopover(false)}
                    className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-0.5 rounded cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="space-y-2 text-left">
                  <div>
                    <label className="text-[9.5px] font-bold text-slate-500 dark:text-slate-400 uppercase block mb-1">
                      Start Date
                    </label>
                    <input
                      type="date"
                      value={tempStart}
                      onChange={(e) => setTempStart(e.target.value)}
                      className="w-full px-2 py-1 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-md focus:outline-hidden focus:ring-1 focus:ring-[#0A6ED1] text-slate-900 dark:text-slate-100"
                    />
                  </div>
                  <div>
                    <label className="text-[9.5px] font-bold text-slate-500 dark:text-slate-400 uppercase block mb-1">
                      End Date
                    </label>
                    <input
                      type="date"
                      value={tempEnd}
                      onChange={(e) => setTempEnd(e.target.value)}
                      className="w-full px-2 py-1 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-md focus:outline-hidden focus:ring-1 focus:ring-[#0A6ED1] text-slate-900 dark:text-slate-100"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-1.5 pt-1.5 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setShowCustomPopover(false)}
                    className="px-2 py-1 text-[10px] font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleApplyCustom}
                    className="px-2.5 py-1 text-[10px] font-bold bg-[#0A6ED1] hover:bg-blue-600 text-white rounded cursor-pointer shadow-xs transition-colors"
                  >
                    Apply Range
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
