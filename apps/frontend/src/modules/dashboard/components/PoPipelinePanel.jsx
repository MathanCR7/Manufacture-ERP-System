import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShoppingCart, Check, CheckCircle2, Clock, Truck, ShieldAlert } from 'lucide-react';
import FioriCard from './FioriCard';
import FioriStatusPill from './FioriStatusPill';
import { FioriSkeleton, FioriEmptyState, FioriErrorRetry } from './FioriStateHandlers';
import DashboardDatePeriodFilter from './DashboardDatePeriodFilter';
import { useApprovePo } from '../hooks/useFactoryDashboard';
import useAuthStore from '@/app/store/authStore';

const formatRupees = (val) => {
  const num = Number(val || 0);
  if (num >= 10000000) return `₹${(num / 10000000).toFixed(2)} Cr`;
  if (num >= 100000) return `₹${(num / 100000).toFixed(2)} L`;
  return `₹${num.toLocaleString('en-IN')}`;
};

export default function PoPipelinePanel({
  data,
  pipeline,
  period = 'all_time',
  onPeriodChange,
  customRange,
  onCustomRangeChange,
  isLoading,
  isError,
  error,
  onRetry,
  updatedAt,
  canApprove: canApproveProp
}) {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const approveMutation = useApprovePo();

  const [confirmingPoId, setConfirmingPoId] = useState(null);

  const canApprove = canApproveProp !== undefined ? canApproveProp : ['MAIN_MASTER', 'SUPERVISOR', 'ADMIN'].includes(user?.role);
  const pipelineData = data || pipeline || {};

  const columnKeys = ['DRAFT', 'PENDING', 'ORDERED', 'PARTIALLY_RECEIVED', 'RECEIVED'];
  const columnLabels = {
    DRAFT: 'Draft',
    PENDING: 'Pending Approval',
    ORDERED: 'Issued / Ordered',
    PARTIALLY_RECEIVED: 'Partly Received',
    RECEIVED: 'Completed'
  };

  const handleApprove = async (e, poId) => {
    e.stopPropagation();
    if (confirmingPoId !== poId) {
      setConfirmingPoId(poId);
      return;
    }
    try {
      await approveMutation.mutateAsync(poId);
      setConfirmingPoId(null);
    } catch (err) {
      alert(`Approval error: ${err.message || 'Unable to approve PO'}`);
      setConfirmingPoId(null);
    }
  };

  return (
    <FioriCard
      eyebrow="Procurement Pipeline"
      title="Purchase Orders Board"
      icon={ShoppingCart}
      redirectRoute="/purchase-orders"
      updatedAt={updatedAt}
      action={
        <DashboardDatePeriodFilter
          activePeriod={period}
          onPeriodChange={onPeriodChange}
          customRange={customRange}
          onCustomRangeChange={onCustomRangeChange}
        />
      }
    >
      {isLoading ? (
        <FioriSkeleton rows={4} height="h-56" />
      ) : error ? (
        <FioriErrorRetry error={error} onRetry={onRetry} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 h-full">
          {columnKeys.map((colKey) => {
            const col = pipelineData[colKey] || (colKey === 'RECEIVED' ? pipelineData['APPROVED'] : null) || { items: [], totalAmount: 0 };
            const items = col.items || [];

            return (
              <div
                key={colKey}
                className="bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-lg flex flex-col justify-between overflow-hidden"
              >
                {/* Column Header */}
                <div className="px-2.5 py-2 bg-slate-100/80 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700/80 flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-700 dark:text-slate-200 truncate">
                    {columnLabels[colKey]}
                  </span>
                  <span className="font-mono text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300">
                    {items.length}
                  </span>
                </div>

                {/* Cards List - Distributed evenly */}
                <div className="p-2 space-y-2 flex-1 overflow-y-auto max-h-[280px]">
                  {items.length === 0 ? (
                    <div className="h-full min-h-[90px] flex items-center justify-center text-[11px] text-slate-400 italic">
                      No POs in {columnLabels[colKey].toLowerCase()}
                    </div>
                  ) : (
                    items.map((po) => (
                      <div
                        key={po.id}
                        onClick={() => navigate(`/purchase-orders/${po.id}`)}
                        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-[#0A6ED1] dark:hover:border-blue-400 rounded-md p-2 shadow-2xs hover:shadow-xs transition-all cursor-pointer group"
                        title="Click to view full PO"
                      >
                        <div className="flex items-center justify-between gap-1 mb-1">
                          <span className="font-mono text-[11px] font-bold text-[#0A6ED1] dark:text-blue-400 group-hover:underline truncate">
                            {po.referenceNo}
                          </span>
                          <span className="font-mono text-[11px] font-black text-slate-800 dark:text-slate-100">
                            {formatRupees(po.amount)}
                          </span>
                        </div>

                        <div className="text-[11px] font-semibold text-slate-800 dark:text-slate-200 truncate">
                          {po.supplierName}
                        </div>

                        <div className="text-[10px] text-slate-400 dark:text-slate-500 truncate mt-0.5">
                          {po.materialName} • {po.quantity} {po.uom}
                        </div>

                        {/* Invoice Date Display */}
                        <div className="flex items-center justify-between text-[9.5px] text-slate-400 dark:text-slate-500 mt-1 pt-1 border-t border-slate-100 dark:border-slate-800/60">
                          <span className="flex items-center gap-1">
                            <span className="font-semibold text-slate-600 dark:text-slate-300">Inv:</span>
                            <span className="font-mono font-medium">
                              {po.supplierInvoiceDate
                                ? new Date(po.supplierInvoiceDate).toLocaleDateString('en-GB')
                                : (po.invoiceDate ? new Date(po.invoiceDate).toLocaleDateString('en-GB') : new Date(po.createdAt).toLocaleDateString('en-GB'))}
                            </span>
                          </span>
                          {po.supplierInvoiceNo ? (
                            <span className="font-mono text-[9px] text-slate-400 truncate max-w-[80px]">#{po.supplierInvoiceNo}</span>
                          ) : (
                            <span className="text-[9px] text-slate-400">PO Logged</span>
                          )}
                        </div>

                        {/* Approve Quick Action for Pending POs */}
                        {colKey === 'PENDING' && canApprove && (
                          <div className="mt-2 pt-1.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end">
                            <button
                              type="button"
                              onClick={(e) => handleApprove(e, po.id)}
                              disabled={approveMutation.isPending}
                              className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer transition-colors ${
                                confirmingPoId === po.id
                                  ? 'bg-[#107E3E] text-white hover:bg-emerald-700 animate-pulse'
                                  : 'bg-emerald-50 text-[#107E3E] border border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300 hover:bg-emerald-100'
                              }`}
                            >
                              {confirmingPoId === po.id ? 'Confirm Approval?' : 'Approve PO'}
                            </button>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>

                {/* Column Footer Total */}
                <div className="px-2.5 py-1.5 bg-slate-100/50 dark:bg-slate-800/50 border-t border-slate-200/80 dark:border-slate-700/80 flex items-center justify-between text-[10px] font-semibold text-slate-600 dark:text-slate-300">
                  <span>Col Total:</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                    {formatRupees(col.totalAmount)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </FioriCard>
  );
}
