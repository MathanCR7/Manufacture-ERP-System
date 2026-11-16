import React from 'react';
import { AlertCircle, RefreshCw, Inbox } from 'lucide-react';

export function FioriSkeleton({ rows = 3, height = 'h-36' }) {
  return (
    <div className={`w-full ${height} flex flex-col justify-around p-2 animate-pulse`}>
      <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-1/3 mb-2" />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-3 bg-slate-100 dark:bg-slate-800/60 rounded w-full my-1" />
      ))}
    </div>
  );
}

export function FioriEmptyState({ title = 'No data available', message = 'No live records found for this period.', icon: Icon = Inbox, actionButton }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-4 text-center min-h-[120px]">
      <Icon className="w-7 h-7 text-slate-300 dark:text-slate-600 mb-1.5" />
      <div className="text-[12.5px] font-semibold text-slate-700 dark:text-slate-300">{title}</div>
      <div className="text-[11px] text-slate-400 dark:text-slate-500 max-w-xs mt-0.5">{message}</div>
      {actionButton && <div className="mt-2.5">{actionButton}</div>}
    </div>
  );
}

export function FioriErrorRetry({ error, onRetry, title = 'Unable to load live data' }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-4 text-center min-h-[120px] bg-rose-50/30 dark:bg-rose-950/20 rounded-md border border-rose-200/50 dark:border-rose-900/40">
      <AlertCircle className="w-6 h-6 text-rose-500 mb-1" />
      <div className="text-[12px] font-bold text-rose-800 dark:text-rose-300">{title}</div>
      <div className="text-[10.5px] text-rose-600 dark:text-rose-400 max-w-xs mt-0.5 line-clamp-2">
        {error?.message || String(error) || 'The server endpoint did not reply.'}
      </div>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-2 inline-flex items-center gap-1 px-2.5 py-1 rounded bg-white dark:bg-slate-900 border border-rose-300 dark:border-rose-700 text-[11px] font-semibold text-rose-700 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-slate-800 cursor-pointer shadow-xs transition-colors"
        >
          <RefreshCw className="w-3 h-3" />
          <span>Retry</span>
        </button>
      )}
    </div>
  );
}

