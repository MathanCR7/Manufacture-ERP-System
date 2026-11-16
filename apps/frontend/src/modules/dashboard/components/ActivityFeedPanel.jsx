import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, ArrowRight } from 'lucide-react';
import FioriCard from './FioriCard';
import { FioriSkeleton, FioriEmptyState, FioriErrorRetry } from './FioriStateHandlers';

export default function ActivityFeedPanel({ activities = [], isLoading, isError, error, onRetry, updatedAt }) {
  const navigate = useNavigate();
  const list = Array.isArray(activities) ? activities : [];

  const formatTimeAgo = (ts) => {
    if (!ts) return '';
    const diff = Math.floor((new Date() - new Date(ts)) / 60000);
    if (diff < 1) return 'Just now';
    if (diff < 60) return `${diff}m ago`;
    const hours = Math.floor(diff / 60);
    if (hours < 24) return `${hours}h ago`;
    return new Date(ts).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
  };

  return (
    <FioriCard
      eyebrow="Shop Floor Traceability"
      title="Live Factory Audit Trail"
      icon={Activity}
      redirectRoute="/audit-logs"
      updatedAt={updatedAt}
    >
      {isLoading ? (
        <FioriSkeleton rows={5} height="h-64" />
      ) : isError ? (
        <FioriErrorRetry error={error} onRetry={onRetry} />
      ) : list.length === 0 ? (
        <FioriEmptyState title="No Recent Activities" message="No audit logs recorded for this session." />
      ) : (
        <div className="flex-1 overflow-y-auto max-h-[280px] space-y-2 pr-1">
          {list.map((log) => (
            <div
              key={log.id}
              onClick={() => navigate(log.route || '/dashboard')}
              className="p-2 rounded bg-slate-50/70 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 hover:border-[#0A6ED1] dark:hover:border-blue-400 flex items-center justify-between gap-2 text-xs transition-colors cursor-pointer group"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-slate-800 dark:text-slate-100">{log.userName}</span>
                  <span className="font-mono text-[9px] px-1 py-0.2 rounded bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                    {log.userRole}
                  </span>
                </div>
                <div className="text-[11px] text-slate-600 dark:text-slate-300 truncate mt-0.5">
                  <strong className="text-slate-800 dark:text-slate-200 font-mono">{log.action}</strong> on {log.tableName}
                </div>
              </div>

              <div className="text-right shrink-0">
                <span className="font-mono text-[10px] text-slate-400">
                  {formatTimeAgo(log.timestamp)}
                </span>
                <ArrowRight className="w-3 h-3 text-slate-400 group-hover:text-[#0A6ED1] dark:group-hover:text-blue-400 ml-auto mt-0.5" />
              </div>
            </div>
          ))}
        </div>
      )}
    </FioriCard>
  );
}

