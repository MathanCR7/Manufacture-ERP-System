import React from 'react';
import { Table, BarChart2, LayoutGrid } from 'lucide-react';

export default function ReportViewSwitcher({ viewMode, onChange, className = '' }) {
  const options = [
    { id: 'table', label: 'Table', icon: Table },
    { id: 'chart', label: 'Chart', icon: BarChart2 },
    { id: 'both', label: 'Split', icon: LayoutGrid }
  ];

  return (
    <div className={`inline-flex items-center p-0.5 bg-slate-100 dark:bg-slate-800/80 rounded-lg border border-slate-200 dark:border-slate-700/80 shadow-2xs ${className}`}>
      {options.map((opt) => {
        const Icon = opt.icon;
        const isActive = viewMode === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id)}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all duration-150 ${
              isActive
                ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-2xs'
                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <Icon className={`w-3 h-3 ${isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'}`} />
            <span>{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}
