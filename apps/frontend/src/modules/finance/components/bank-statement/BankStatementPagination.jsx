import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

/**
 * Builds page numbers with ellipsis tokens (e.g. [1, '...', 4, 5, 6, '...', 12])
 */
function buildPageSequence(current, total) {
  if (total <= 7) {
    return Array.from({ length: total }, (_, idx) => idx + 1);
  }
  const pages = new Set([1, total, current - 1, current, current + 1]);
  const valid = Array.from(pages)
    .filter((p) => p >= 1 && p <= total)
    .sort((a, b) => a - b);

  const sequence = [];
  for (let i = 0; i < valid.length; i += 1) {
    if (i > 0 && valid[i] - valid[i - 1] > 1) {
      sequence.push('ellipsis');
    }
    sequence.push(valid[i]);
  }
  return sequence;
}

export default function BankStatementPagination({
  page = 1,
  totalPages = 1,
  totalItems = 0,
  pageSize = 25,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50, 100],
  itemLabel = 'entries'
}) {
  const safeTotalPages = Math.max(1, Number(totalPages) || 1);
  const safePage = Math.min(Math.max(1, Number(page) || 1), safeTotalPages);
  const startIdx = totalItems === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const endIdx = totalItems === 0 ? 0 : Math.min(totalItems, safePage * pageSize);
  const pageSequence = buildPageSequence(safePage, safeTotalPages);

  const navBtnClass =
    'h-7 min-w-7 px-2 rounded-lg border border-[#CBD5E1] dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-[#EEF2F8] dark:hover:bg-slate-800 text-[#14213D] dark:text-slate-200 font-bold disabled:opacity-40 disabled:pointer-events-none inline-flex items-center justify-center gap-1 transition-colors cursor-pointer';

  return (
    <div className="px-3 py-2.5 border-t border-[#CBD5E1] dark:border-slate-700 bg-[#F8FAFC] dark:bg-slate-900/90 flex flex-wrap items-center justify-between gap-2.5 text-xs">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-slate-600 dark:text-slate-300 font-medium">
          {totalItems === 0 ? (
            <>Showing <strong className="text-[#14213D] dark:text-slate-100">0</strong> {itemLabel}</>
          ) : (
            <>
              Showing <strong className="text-[#14213D] dark:text-slate-100 tabular-nums">{startIdx}–{endIdx}</strong> of{' '}
              <strong className="text-[#14213D] dark:text-slate-100 tabular-nums">{totalItems}</strong> {itemLabel}
            </>
          )}
        </span>

        {typeof onPageSizeChange === 'function' && (
          <label className="inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-500 dark:text-slate-400">
            <span>Rows:</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              aria-label="Rows per page"
              className="h-7 px-2 rounded-lg border border-[#CBD5E1] dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-bold text-[#14213D] dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#3646C9]/30 cursor-pointer"
            >
              {pageSizeOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt} / page
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-1">
        <button
          type="button"
          title="First page"
          disabled={safePage <= 1}
          onClick={() => onPageChange(1)}
          className={navBtnClass}
        >
          <ChevronsLeft className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          disabled={safePage <= 1}
          onClick={() => onPageChange(Math.max(1, safePage - 1))}
          className={navBtnClass}
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Prev</span>
        </button>

        {pageSequence.map((token, idx) =>
          token === 'ellipsis' ? (
            <span
              key={`ellipsis-${idx}`}
              className="px-1.5 text-slate-400 dark:text-slate-500 font-bold select-none"
            >
              ...
            </span>
          ) : (
            <button
              key={token}
              type="button"
              onClick={() => onPageChange(token)}
              aria-current={token === safePage ? 'page' : undefined}
              className={`h-7 min-w-7 px-2 rounded-lg border text-xs font-extrabold tabular-nums transition-colors cursor-pointer ${
                token === safePage
                  ? 'bg-[#3646C9] border-[#3646C9] text-white shadow-xs'
                  : 'border-[#CBD5E1] dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-[#EEF2F8] dark:hover:bg-slate-800 text-[#14213D] dark:text-slate-200'
              }`}
            >
              {token}
            </button>
          )
        )}

        <button
          type="button"
          disabled={safePage >= safeTotalPages}
          onClick={() => onPageChange(Math.min(safeTotalPages, safePage + 1))}
          className={navBtnClass}
        >
          <span className="hidden sm:inline">Next</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          title="Last page"
          disabled={safePage >= safeTotalPages}
          onClick={() => onPageChange(safeTotalPages)}
          className={navBtnClass}
        >
          <ChevronsRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
