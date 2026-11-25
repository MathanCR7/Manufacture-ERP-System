import React from 'react';
import { 
  CheckCircle2, Clock, AlertTriangle, AlertCircle, ArrowUpRight, 
  HelpCircle, Ban, Hourglass
} from 'lucide-react';

/**
 * Format currency into Indian Rupees format (₹4,91,758.00)
 */
export function formatINR(val, includeDecimals = true) {
  if (val === undefined || val === null || val === '') return '₹0.00';
  const num = Number(val);
  if (isNaN(num)) return '₹0.00';

  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: includeDecimals ? 2 : 0,
    maximumFractionDigits: includeDecimals ? 2 : 0
  }).format(num);
}

/**
 * Format Date string into 'DD MMM YYYY'
 */
export function formatDate(dateVal) {
  if (!dateVal) return '-';
  try {
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return String(dateVal);
    return d.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  } catch (e) {
    return String(dateVal);
  }
}

/**
 * Render Payment Status Chip (Icon + Text + Strict Color Palette)
 */
export function renderPaymentStatusChip(status, isOverdue = false, overdueDays = 0) {
  const normStatus = String(status || 'UNPAID').toUpperCase();

  let bg = 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-400 dark:border-rose-900';
  let Icon = AlertCircle;
  let label = 'Unpaid';

  switch (normStatus) {
    case 'PAID':
      bg = 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-400 dark:border-emerald-900';
      Icon = CheckCircle2;
      label = 'Paid';
      break;
    case 'PARTIALLY_PAID':
    case 'PARTIAL':
      bg = 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-400 dark:border-amber-900';
      Icon = Clock;
      label = 'Partially Paid';
      break;
    case 'ADVANCE_PAID':
      bg = 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-400 dark:border-blue-900';
      Icon = Hourglass;
      label = 'Advance Paid';
      break;
    case 'OVERPAID':
      bg = 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/60 dark:text-purple-400 dark:border-purple-900';
      Icon = ArrowUpRight;
      label = 'Overpaid';
      break;
    case 'VOID':
    case 'CANCELLED':
      bg = 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700';
      Icon = Ban;
      label = 'Void';
      break;
    default:
      bg = 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-400 dark:border-rose-900';
      Icon = AlertCircle;
      label = 'Unpaid';
  }

  return (
    <div className="inline-flex items-center gap-1.5 flex-wrap">
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border shadow-3xs tracking-tight ${bg}`}>
        <Icon className="w-3 h-3 shrink-0" />
        <span>{label}</span>
      </span>
      {isOverdue && normStatus !== 'PAID' && normStatus !== 'VOID' && (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-extrabold uppercase bg-red-100 text-red-700 border border-red-300 dark:bg-red-950 dark:text-red-400 dark:border-red-800 animate-pulse">
          <AlertTriangle className="w-2.5 h-2.5 shrink-0" />
          <span>{overdueDays > 0 ? `${overdueDays}d overdue` : 'Overdue'}</span>
        </span>
      )}
    </div>
  );
}

/**
 * Render Document Fulfilment Chip
 */
export function renderFulfilmentChip(status) {
  const norm = String(status || 'PENDING').toUpperCase();
  if (norm === 'COMPLETE') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800">
        <CheckCircle2 className="w-2.5 h-2.5" /> Complete
      </span>
    );
  }
  if (norm === 'PARTIAL') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-950/50 dark:text-indigo-300 dark:border-indigo-800">
        <Clock className="w-2.5 h-2.5" /> Partial
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700">
      <Hourglass className="w-2.5 h-2.5" /> Pending
    </span>
  );
}
