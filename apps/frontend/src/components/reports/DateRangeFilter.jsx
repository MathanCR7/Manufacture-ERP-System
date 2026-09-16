import React, { useState } from 'react';
import { Calendar, ChevronDown, Clock, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export const DATE_PRESETS = [
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: 'this_week', label: 'This Week' },
  { key: 'last_week', label: 'Last Week' },
  { key: 'this_month', label: 'This Month' },
  { key: 'last_month', label: 'Last Month' },
  { key: 'this_quarter', label: 'This Quarter' },
  { key: 'this_year', label: 'This Year' },
  { key: 'custom', label: 'Custom Range' }
];

export default function DateRangeFilter({ 
  value,
  onChange,
  activePreset, 
  customStartDate, 
  customEndDate, 
  onRangeChange, 
  className = '' 
}) {
  const currentPreset = value?.preset || value?.datePreset || activePreset || 'this_month';
  const currentStart = value?.startDate || customStartDate || '';
  const currentEnd = value?.endDate || customEndDate || '';

  const [isOpen, setIsOpen] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState(currentPreset);
  const [startDate, setStartDate] = useState(currentStart);
  const [endDate, setEndDate] = useState(currentEnd);

  const activeLabel = DATE_PRESETS.find(p => p.key === currentPreset)?.label || 'Date Filter';

  const notifyChange = (newPreset, newStart, newEnd) => {
    const payload = {
      preset: newPreset,
      datePreset: newPreset,
      startDate: newStart,
      endDate: newEnd
    };
    if (onChange) onChange(payload);
    if (onRangeChange) onRangeChange(payload);
  };

  const handleSelectPreset = (presetKey) => {
    setSelectedPreset(presetKey);
    if (presetKey !== 'custom') {
      setIsOpen(false);
      notifyChange(presetKey, '', '');
    }
  };

  const handleApplyCustom = () => {
    if (!startDate || !endDate) {
      alert('Please select both Start Date and End Date.');
      return;
    }
    setIsOpen(false);
    notifyChange('custom', startDate, endDate);
  };

  return (
    <div className={`relative inline-block text-xs ${className}`}>
      <Button
        type="button"
        variant="outline"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 h-8 px-2.5 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-lg text-slate-700 dark:text-slate-200 font-semibold shadow-xs hover:border-indigo-500 transition-all text-xs"
      >
        <Calendar className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
        <span className="font-semibold">{activeLabel}</span>
        {currentPreset === 'custom' && currentStart && currentEnd && (
          <span className="font-mono text-[10px] text-slate-400">
            ({currentStart} → {currentEnd})
          </span>
        )}
        <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </Button>

      {/* Dropdown Popover */}
      {isOpen && (
        <div className="absolute left-0 mt-1.5 w-68 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl z-50 p-2.5 space-y-2.5 animate-in fade-in zoom-in-95 duration-100">
          <div className="flex items-center justify-between pb-1.5 border-b border-slate-100 dark:border-slate-800">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
              <Clock className="w-3 h-3 text-indigo-500" />
              Time Horizon
            </span>
            <button
              onClick={() => setIsOpen(false)}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-0.5 rounded-md"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Quick Presets Grid */}
          <div className="grid grid-cols-2 gap-1">
            {DATE_PRESETS.map((p) => {
              const isSelected = (selectedPreset || currentPreset) === p.key;
              return (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => handleSelectPreset(p.key)}
                  className={`px-2 py-1.5 text-left text-[11px] rounded-lg font-medium transition-all ${
                    isSelected
                      ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 font-bold'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                  }`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>

          {/* Custom Date Picker Inputs */}
          {(selectedPreset === 'custom' || currentPreset === 'custom') && (
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
              <div className="space-y-0.5">
                <label className="text-[9px] font-bold text-slate-400 uppercase">From</label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="h-7 text-xs bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 rounded-md"
                />
              </div>
              <div className="space-y-0.5">
                <label className="text-[9px] font-bold text-slate-400 uppercase">To</label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="h-7 text-xs bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 rounded-md"
                />
              </div>
              <Button
                type="button"
                onClick={handleApplyCustom}
                className="w-full h-7 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-xs"
              >
                Apply Range
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
