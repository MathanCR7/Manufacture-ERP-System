import React from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { Button } from './button';

export function Pagination({ 
  currentPage = 1, 
  totalPages = 1, 
  totalRecords, 
  pageSize = 20, 
  onPageChange,
  onPageSizeChange,
  className = ''
}) {
  const current = Math.max(1, Number(currentPage) || 1);
  const total = Math.max(1, Number(totalPages) || 1);

  const getPageNumbers = () => {
    const pages = [];
    const maxVisible = 5;

    if (total <= maxVisible) {
      for (let i = 1; i <= total; i++) {
        pages.push(i);
      }
    } else {
      pages.push(1);

      let start = Math.max(2, current - 1);
      let end = Math.min(total - 1, current + 1);

      if (current <= 2) {
        end = 4;
      } else if (current >= total - 1) {
        start = total - 3;
      }

      if (start > 2) pages.push('...');

      for (let i = start; i <= end; i++) {
        pages.push(i);
      }

      if (end < total - 1) pages.push('...');

      pages.push(total);
    }
    return pages;
  };

  const pages = getPageNumbers();

  // Compute entry range
  const startEntry = totalRecords != null && totalRecords > 0 ? (current - 1) * pageSize + 1 : 0;
  const endEntry = totalRecords != null ? Math.min(current * pageSize, totalRecords) : 0;

  return (
    <div className={`flex flex-col sm:flex-row items-center justify-between gap-2.5 py-1.5 px-3 text-xs ${className}`}>
      {/* Entry info */}
      <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
        {totalRecords != null ? (
          totalRecords > 0 ? (
            <span>
              Showing <strong className="font-semibold text-slate-800 dark:text-slate-200">{startEntry}</strong> to{' '}
              <strong className="font-semibold text-slate-800 dark:text-slate-200">{endEntry}</strong> of{' '}
              <strong className="font-semibold text-slate-800 dark:text-slate-200">{Number(totalRecords).toLocaleString()}</strong> entries
            </span>
          ) : (
            <span>0 records found</span>
          )
        ) : (
          <span>Page <strong className="font-semibold text-slate-800 dark:text-slate-200">{current}</strong> of <strong className="font-semibold text-slate-800 dark:text-slate-200">{total}</strong></span>
        )}
      </div>

      {/* Page navigation controls */}
      <div className="flex items-center gap-1">
        {/* First page button if > 3 pages */}
        {total > 3 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(1)}
            disabled={current === 1}
            className="h-7 w-7 p-0 rounded-lg border-slate-200 dark:border-slate-800 disabled:opacity-30 text-slate-600 dark:text-slate-300"
            title="First Page"
          >
            <ChevronsLeft className="w-3.5 h-3.5" />
          </Button>
        )}

        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(current - 1)}
          disabled={current === 1}
          className="h-7 px-2 rounded-lg border-slate-200 dark:border-slate-800 disabled:opacity-30 select-none text-[11px] font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          <ChevronLeft className="w-3 h-3 mr-0.5" />
          Prev
        </Button>

        <div className="flex items-center gap-0.5 mx-0.5">
          {pages.map((p, idx) => {
            if (p === '...') {
              return (
                <span key={`dots-${idx}`} className="px-1 text-slate-400 dark:text-slate-500 font-bold select-none text-[10px]">
                  •••
                </span>
              );
            }
            const isActive = p === current;
            return (
              <Button
                key={`page-${p}`}
                variant={isActive ? 'default' : 'ghost'}
                size="sm"
                onClick={() => onPageChange(p)}
                className={`h-7 min-w-[28px] px-1.5 rounded-lg text-[11px] font-bold select-none transition-all ${
                  isActive
                    ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs dark:bg-indigo-600'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {p}
              </Button>
            );
          })}
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(current + 1)}
          disabled={current >= total}
          className="h-7 px-2 rounded-lg border-slate-200 dark:border-slate-800 disabled:opacity-30 select-none text-[11px] font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          Next
          <ChevronRight className="w-3 h-3 ml-0.5" />
        </Button>

        {total > 3 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(total)}
            disabled={current >= total}
            className="h-7 w-7 p-0 rounded-lg border-slate-200 dark:border-slate-800 disabled:opacity-30 text-slate-600 dark:text-slate-300"
            title="Last Page"
          >
            <ChevronsRight className="w-3.5 h-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}
export default Pagination;
