import React from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';

export default function DashboardBackButton({ defaultLabel, className = '' }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const from = searchParams.get('from') || location.state?.from;

  // ONLY display when redirected/navigated from a dashboard
  if (!from) return null;

  let targetPath = '/dashboard';
  let label = defaultLabel || 'Back to Dashboard';

  if (from === 'sales') {
    targetPath = '/dashboard/sales';
    label = 'Back to Sales Dashboard';
  } else if (from === 'production') {
    targetPath = '/dashboard/production';
    label = 'Back to Production Dashboard';
  } else if (from === 'executive') {
    targetPath = '/dashboard/executive';
    label = 'Back to Executive Dashboard';
  } else if (from === 'inventory') {
    targetPath = '/dashboard/inventory';
    label = 'Back to Inventory Dashboard';
  } else if (from === 'finance') {
    targetPath = '/dashboard/finance';
    label = 'Back to Finance Dashboard';
  } else if (from === 'hr') {
    targetPath = '/dashboard/hr';
    label = 'Back to HR Dashboard';
  } else if (from === 'maintenance') {
    targetPath = '/dashboard/maintenance';
    label = 'Back to Maintenance Dashboard';
  } else if (from === 'lab') {
    targetPath = '/dashboard/lab';
    label = 'Back to Lab Dashboard';
  } else if (from === 'status') {
    targetPath = '/orders/status';
    label = 'Back to Order Status Board';
  } else if (from === 'dashboard' || from === 'main') {
    targetPath = '/dashboard';
    label = 'Back to Dashboard';
  } else if (typeof from === 'string' && from.startsWith('/')) {
    targetPath = from;
    label = 'Back to Dashboard';
  }

  const handleClick = () => {
    navigate(targetPath);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer bg-transparent border-none p-0 focus:outline-none mb-2.5 transition-colors ${className}`}
    >
      <ChevronLeft className="w-4 h-4" />
      <span>{label}</span>
    </button>
  );
}
