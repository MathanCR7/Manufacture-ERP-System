import React from 'react';

export default function LineDiscountInput({
  discountType = 'amount',
  discountValue = '',
  discountAmount = 0,
  disabled = false,
  compact = false,
  darkSurface = false,
  onTypeChange,
  onValueChange,
}) {
  const heightCls = compact ? 'h-8 text-xs' : 'h-9 text-sm';
  const containerCls = darkSurface
    ? 'border-slate-700 bg-slate-950 text-slate-200'
    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100';
  const toggleBgCls = darkSurface
    ? 'bg-slate-900 border-slate-700'
    : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700';

  return (
    <div className="space-y-1">
      <div className={`flex items-center rounded-lg border overflow-hidden focus-within:ring-2 focus-within:ring-indigo-500/20 ${heightCls} ${containerCls} ${disabled ? 'opacity-60' : ''}`}>
        <div className={`flex items-center p-0.5 border-r shrink-0 ${toggleBgCls}`}>
          <button
            type="button"
            disabled={disabled}
            onClick={() => onTypeChange?.('amount')}
            title="Flat discount (₹)"
            className={`px-1.5 py-0.5 text-[10px] font-bold rounded transition-all ${
              discountType === 'amount'
                ? 'bg-indigo-600 text-white shadow-sm'
                : darkSurface
                  ? 'text-slate-400 hover:text-slate-200'
                  : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            ₹
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => onTypeChange?.('percent')}
            title="Percentage discount (%)"
            className={`px-1.5 py-0.5 text-[10px] font-bold rounded transition-all ${
              discountType === 'percent'
                ? 'bg-indigo-600 text-white shadow-sm'
                : darkSurface
                  ? 'text-slate-400 hover:text-slate-200'
                  : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            %
          </button>
        </div>
        <input
          type="number"
          min="0"
          max={discountType === 'percent' ? 100 : undefined}
          step="0.01"
          disabled={disabled}
          value={discountValue}
          onChange={e => onValueChange?.(e.target.value)}
          placeholder={discountType === 'percent' ? '0%' : '0.00'}
          className={`w-full min-w-0 bg-transparent px-2 text-right font-mono focus:outline-none disabled:cursor-not-allowed ${compact ? 'text-xs' : 'text-sm'}`}
        />
      </div>
      {discountAmount > 0 && (
        <p className={`text-[10px] font-semibold ${darkSurface ? 'text-rose-400' : 'text-rose-600 dark:text-rose-400'} tabular-nums`}>
          -₹{discountAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </p>
      )}
    </div>
  );
}

