import React from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, AlertTriangle, ArrowRight, ShieldAlert } from 'lucide-react';

export default function AttentionStrip({ items = [] }) {
  const navigate = useNavigate();

  if (!items || !Array.isArray(items) || items.length === 0) {
    return null;
  }

  return (
    <div
      className="bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 rounded-lg p-2.5 sm:p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shadow-2xs"
      role="region"
      aria-label="Items Requiring Immediate Attention"
    >
      <div className="flex items-center gap-2 shrink-0">
        <span className="p-1 rounded-md bg-amber-500 text-white shrink-0">
          <ShieldAlert className="w-3.5 h-3.5" />
        </span>
        <div className="text-[11.5px] font-black uppercase tracking-wider text-amber-900 dark:text-amber-200">
          Needs Attention ({items.length})
        </div>
      </div>

      {/* Actionable Chips */}
      <div className="flex items-center gap-2 flex-wrap min-w-0">
        {items.map((item) => {
          if (!item || typeof item !== 'object') return null;
          const isCrit = item.severity === 'CRITICAL';
          const titleStr = typeof item.title === 'string'
            ? item.title
            : (item.title ? String(item.title?.message || item.title?.text || item.title) : 'Alert');
          const routeStr = typeof item.route === 'string' ? item.route : '/dashboard';

          return (
            <button
              key={item.id || titleStr}
              type="button"
              onClick={() => navigate(routeStr)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border cursor-pointer transition-transform hover:scale-102 ${
                isCrit
                  ? 'bg-rose-50 text-rose-800 border-rose-300 dark:bg-rose-950/70 dark:text-rose-200 dark:border-rose-700 hover:bg-rose-100'
                  : 'bg-white text-amber-900 border-amber-300 dark:bg-slate-900 dark:text-amber-300 dark:border-amber-700 hover:bg-amber-50'
              }`}
              title={`Click to resolve: ${titleStr}`}
            >
              {isCrit ? (
                <AlertCircle className="w-3 h-3 text-rose-600 dark:text-rose-400 shrink-0" />
              ) : (
                <AlertTriangle className="w-3 h-3 text-amber-600 dark:text-amber-400 shrink-0" />
              )}
              <span className="truncate max-w-[240px] sm:max-w-[320px]">{titleStr}</span>
              <ArrowRight className="w-2.5 h-2.5 opacity-60 shrink-0" />
            </button>
          );
        })}
      </div>
    </div>
  );
}

