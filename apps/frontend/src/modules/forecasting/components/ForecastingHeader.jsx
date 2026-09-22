import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  Package, Users, DollarSign, Truck, Factory,
  Sliders, RotateCcw, RefreshCw
} from 'lucide-react';
import { Button } from '@/components/ui/button';

export const FORECAST_TABS = [
  { id: 'stock', label: 'Stock & ROP', path: '/forecasting/stock', icon: Package },
  { id: 'workforce', label: 'Workforce & Capacity', path: '/forecasting/workforce', icon: Users },
  { id: 'cashflow', label: 'Cash Flow & Payables', path: '/forecasting/cashflow', icon: DollarSign },
  { id: 'vendor', label: 'Vendor & Lead-Time', path: '/forecasting/vendor', icon: Truck },
  { id: 'production', label: 'Production & Yield', path: '/forecasting/production', icon: Factory },
  { id: 'what-if', label: 'What-If Sandbox', path: '/forecasting/what-if', icon: Sliders },
  { id: 'returns', label: 'Returns & Rejections', path: '/forecasting/returns', icon: RotateCcw }
];

export default function ForecastingHeader({
  title,
  subtitle,
  icon: Icon,
  horizonPreset,
  setHorizonPreset,
  customStart,
  setCustomStart,
  customEnd,
  setCustomEnd,
  onRefresh,
  loading = false
}) {
  return (
    <div className="space-y-4">
      {/* Top Banner & Horizon Preset Controller */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {Icon && (
            <div className="p-2.5 rounded-xl bg-indigo-600 text-white shadow-md shadow-indigo-600/20 shrink-0">
              <Icon className="w-5 h-5" />
            </div>
          )}
          <div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              {title}
            </h1>
            {subtitle && (
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {subtitle}
              </p>
            )}
          </div>
        </div>

        {/* Horizon Presets & Date Filters */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="inline-flex rounded-lg bg-slate-200/80 dark:bg-slate-800 p-1 border border-slate-300 dark:border-slate-700/60 shadow-xs">
            {[
              { label: '7D', val: '7' },
              { label: '14D', val: '14' },
              { label: '30D', val: '30' },
              { label: '60D', val: '60' },
              { label: '90D', val: '90' },
              { label: 'Custom', val: 'custom' }
            ].map(p => (
              <button
                key={p.val}
                type="button"
                onClick={() => setHorizonPreset(p.val)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                  horizonPreset === p.val
                    ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Custom Date Range Picker */}
          {horizonPreset === 'custom' && (
            <div className="flex items-center gap-2 bg-white dark:bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-xs shadow-xs">
              <input
                type="date"
                value={customStart}
                onChange={e => setCustomStart(e.target.value)}
                className="bg-transparent text-slate-700 dark:text-slate-300 outline-none"
              />
              <span className="text-slate-400">to</span>
              <input
                type="date"
                value={customEnd}
                onChange={e => setCustomEnd(e.target.value)}
                className="bg-transparent text-slate-700 dark:text-slate-300 outline-none"
              />
              <Button size="sm" variant="ghost" onClick={onRefresh} className="h-6 px-2 text-xs">
                Apply
              </Button>
            </div>
          )}

          {/* Refresh Button */}
          {onRefresh && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRefresh}
              disabled={loading}
              className="h-8 px-2.5 rounded-lg border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400"
              title="Refresh Forecast Data"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-indigo-600' : ''}`} />
            </Button>
          )}
        </div>
      </div>

      {/* Modern Navigation Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-slate-200 dark:border-slate-800 scrollbar-none">
        {FORECAST_TABS.map(tab => {
          const TabIcon = tab.icon;
          return (
            <NavLink
              key={tab.id}
              to={tab.path}
              className={({ isActive }) => `
                flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all
                ${isActive
                  ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/20'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/80 dark:hover:bg-slate-800/80'
                }
              `}
            >
              <TabIcon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </NavLink>
          );
        })}
      </div>
    </div>
  );
}
