import React from 'react';
import { ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function FioriCard({
  eyebrow,
  title,
  icon: Icon,
  action,
  redirectRoute,
  updatedAt,
  children,
  className = '',
  footerContent
}) {
  const navigate = useNavigate();

  const formatTime = (ts) => {
    if (!ts) return '--:--:--';
    const d = new Date(ts);
    return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  };

  return (
    <section
      className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-xs flex flex-col h-full overflow-hidden transition-all duration-200 ${className}`}
      aria-labelledby={title ? `header-${title.replace(/\s+/g, '-').toLowerCase()}` : undefined}
    >
      {/* SAP Fiori Shaded Header Strip */}
      <header className="px-3.5 py-2.5 bg-slate-50/70 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2 shrink-0">
        <div className="min-w-0">
          {eyebrow && (
            <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 truncate">
              {eyebrow}
            </span>
          )}
          <div className="flex items-center gap-1.5 min-w-0">
            {Icon && <Icon className="w-4 h-4 text-[#0A6ED1] dark:text-blue-400 shrink-0" />}
            <h2
              id={title ? `header-${title.replace(/\s+/g, '-').toLowerCase()}` : undefined}
              className="text-[13.5px] sm:text-[14px] font-semibold text-slate-900 dark:text-slate-100 truncate"
            >
              {title}
            </h2>
          </div>
        </div>

        {/* Action Controls or Deep Link */}
        <div className="flex items-center gap-2 shrink-0">
          {action}
          {redirectRoute && (
            <button
              type="button"
              onClick={() => navigate(redirectRoute)}
              className="p-1 rounded hover:bg-slate-200/60 dark:hover:bg-slate-700/60 text-slate-500 hover:text-[#0A6ED1] dark:hover:text-blue-400 transition-colors cursor-pointer"
              title="Open full module page"
              aria-label={`Open full module for ${title}`}
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </header>

      {/* Content Area - Flex-1 absorbs row height so no card is ever shorter than its pair */}
      <div className="p-3 sm:p-4 flex-1 flex flex-col min-h-0 overflow-hidden">
        {children}
      </div>

      {/* Card Footer with Live Timestamp */}
      <footer className="px-3 py-1.5 bg-slate-50/40 dark:bg-slate-800/40 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[10px] text-slate-400 dark:text-slate-500 shrink-0">
        <span className="font-mono">
          Updated {formatTime(updatedAt || Date.now())}
        </span>
        {footerContent && <div>{footerContent}</div>}
      </footer>
    </section>
  );
}

