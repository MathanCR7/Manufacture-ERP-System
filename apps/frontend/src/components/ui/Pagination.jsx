import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from './button';

export function Pagination({ currentPage, totalPages, onPageChange }) {
  if (totalPages <= 1) return null;

  const getPageNumbers = () => {
    const pages = [];
    const maxVisible = 5; // Maximum page buttons to show

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      pages.push(1);

      let start = Math.max(2, currentPage - 1);
      let end = Math.min(totalPages - 1, currentPage + 1);

      if (currentPage <= 2) {
        end = 4;
      } else if (currentPage >= totalPages - 1) {
        start = totalPages - 3;
      }

      if (start > 2) {
        pages.push('...');
      }

      for (let i = start; i <= end; i++) {
        pages.push(i);
      }

      if (end < totalPages - 1) {
        pages.push('...');
      }

      pages.push(totalPages);
    }
    return pages;
  };

  const pages = getPageNumbers();

  return (
    <div className="flex items-center justify-between gap-4 py-2 text-xs">
      <div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="h-8 px-2.5 rounded-lg border-slate-200 dark:border-slate-800 disabled:opacity-50 select-none text-[11px] font-bold"
        >
          <ChevronLeft className="w-3.5 h-3.5 mr-1" />
          Prev
        </Button>
      </div>

      <div className="flex items-center gap-1">
        {pages.map((p, idx) => {
          if (p === '...') {
            return (
              <span key={`dots-${idx}`} className="px-2 text-slate-400 dark:text-slate-650 font-bold select-none">
                ...
              </span>
            );
          }
          const isActive = p === currentPage;
          return (
            <Button
              key={`page-${p}`}
              variant={isActive ? 'default' : 'outline'}
              size="sm"
              onClick={() => onPageChange(p)}
              className={`h-8 w-8 p-0 rounded-lg text-[11px] font-bold select-none transition-all ${
                isActive
                  ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm dark:bg-indigo-500'
                  : 'border-slate-200 dark:border-slate-800 hover:bg-slate-105 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
              }`}
            >
              {p}
            </Button>
          );
        })}
      </div>

      <div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="h-8 px-2.5 rounded-lg border-slate-200 dark:border-slate-800 disabled:opacity-50 select-none text-[11px] font-bold"
        >
          Next
          <ChevronRight className="w-3.5 h-3.5 ml-1" />
        </Button>
      </div>
    </div>
  );
}
export default Pagination;
