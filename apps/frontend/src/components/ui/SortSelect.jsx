import React from 'react';
import { ArrowUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';

const DEFAULT_OPTIONS = [
  { value: 'recent', label: 'Most Recent' },
  { value: 'oldest', label: 'Oldest' },
  { value: 'price_desc', label: 'Amount: High to Low' },
  { value: 'price_asc', label: 'Amount: Low to High' },
];

export function SortSelect({ value, onChange, options = DEFAULT_OPTIONS, className = '' }) {
  const opts = options && options.length > 0 ? options : DEFAULT_OPTIONS;
  return (
    <div className={cn("relative flex items-center w-full sm:w-auto", className)}>
      <span className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center pointer-events-none text-slate-400 dark:text-slate-500">
        <ArrowUpDown className="w-3.5 h-3.5" />
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 w-full sm:w-48 pl-9 pr-8 text-xs font-semibold border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 appearance-none cursor-pointer transition-all"
      >
        {opts.map((opt) => (
          <option key={opt.value} value={opt.value} className="bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300">
            {opt.label}
          </option>
        ))}
      </select>
      <span className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center pointer-events-none text-slate-400 dark:text-slate-500">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
          <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
        </svg>
      </span>
    </div>
  );
}
