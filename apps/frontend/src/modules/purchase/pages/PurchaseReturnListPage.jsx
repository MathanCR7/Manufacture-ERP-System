import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/axios';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { Plus, Search, Filter, RotateCcw, AlertTriangle, CheckCircle, Clock, Truck, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import useAuthStore from '@/app/store/authStore';

const STATUS_CONFIG = {
  PENDING:    { label: 'Pending',              color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400', icon: Clock },
  DISPATCHED: { label: 'Dispatched',           color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',    icon: Truck },
  ACKNOWLEDGED: { label: 'Acknowledged',       color: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400', icon: CheckCircle },
  CLOSED:     { label: 'Closed',               color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400', icon: CheckCircle },
};

const REASON_LABELS = {
  LAB_REJECTED:     'Lab Test Rejected',
  PHYSICAL_DAMAGE:  'Physical Damage',
  WRONG_MATERIAL:   'Wrong Material',
  SHORT_EXPIRY:     'Short Expiry',
  QTY_MISMATCH:     'Quantity Mismatch',
  OTHER:            'Other',
};

const STATUS_FLOW = ['PENDING', 'DISPATCHED', 'ACKNOWLEDGED', 'CLOSED'];

const PurchaseReturnListPage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const canManage = ['MAIN_MASTER', 'SUPERVISOR', 'PURCHASE_ACCOUNTANT'].includes(user?.role);

  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterReason, setFilterReason] = useState('');

  const { data: returns = [], isLoading } = useQuery({
    queryKey: ['purchase-returns', filterStatus, filterReason],
    queryFn: () => {
      const params = new URLSearchParams();
      if (filterStatus) params.set('status', filterStatus);
      if (filterReason) params.set('returnReason', filterReason);
      return api.get(`/purchase-return?${params.toString()}`).then(r => r.data);
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }) => api.patch(`/purchase-return/${id}/status`, { status }).then(r => r.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['purchase-returns'] }),
  });

  const filtered = returns.filter(r => {
    if (!search) return true;
    const term = search.toLowerCase();
    return (
      r.referenceNo?.toLowerCase().includes(term) ||
      r.po?.supplier?.name?.toLowerCase().includes(term) ||
      r.po?.name?.toLowerCase().includes(term)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <RotateCcw className="w-6 h-6 text-orange-500" />
            Purchase Returns
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">{returns.length} return record{returns.length !== 1 ? 's' : ''}</p>
        </div>
        {canManage && (
          <Button onClick={() => navigate('/purchase-return/add')} className="bg-orange-600 hover:bg-orange-700 text-white">
            <Plus className="w-4 h-4 mr-2" /> Add Return
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by PO, supplier, material..."
            className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
        </div>
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
        >
          <option value="">All Statuses</option>
          {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select
          value={filterReason}
          onChange={e => setFilterReason(e.target.value)}
          className="border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
        >
          <option value="">All Reasons</option>
          {Object.entries(REASON_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-48 text-slate-400">Loading returns...</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-slate-400">
            <RotateCcw className="w-10 h-10 mb-3 opacity-30" />
            <p className="font-medium">No purchase returns found</p>
            <p className="text-sm mt-1">Create one from a GRN or purchase order</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80">
                  {['Return ID', 'PO Number', 'GRN', 'Supplier', 'Raw Material', 'Return Qty', 'Reason', 'Return Date', 'Status', 'Actions'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {filtered.map(ret => {
                  const cfg = STATUS_CONFIG[ret.status] || STATUS_CONFIG.PENDING;
                  const isLabRejected = ret.initiatedBy === 'LAB_REJECTED';
                  const currentIdx = STATUS_FLOW.indexOf(ret.status);
                  const nextStatus = STATUS_FLOW[currentIdx + 1];

                  return (
                    <tr key={ret.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs text-slate-600 dark:text-slate-300 whitespace-nowrap">
                        <div className="flex flex-col gap-1">
                          <span>{ret.referenceNo}</span>
                          {isLabRejected && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 font-medium">
                              <AlertTriangle className="w-3 h-3" /> Lab Rejected
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-indigo-600 dark:text-indigo-400 whitespace-nowrap">{ret.po?.referenceNo || '—'}</td>
                      <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">{ret.grn?.referenceNo || '—'}</td>
                      <td className="px-4 py-3 text-sm font-medium text-slate-900 dark:text-white whitespace-nowrap">{ret.po?.supplier?.name || '—'}</td>
                      <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-300 whitespace-nowrap">{ret.po?.name || '—'}</td>
                      <td className="px-4 py-3 text-sm font-semibold text-slate-900 dark:text-white whitespace-nowrap">
                        {Number(ret.returnQty).toFixed(2)} <span className="text-xs font-normal text-slate-500">{ret.uom}</span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-300 whitespace-nowrap">{REASON_LABELS[ret.returnReason] || ret.returnReason}</td>
                      <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        {ret.returnDate ? format(new Date(ret.returnDate), 'dd MMM yyyy') : '—'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${cfg.color}`}>
                          <cfg.icon className="w-3 h-3" />
                          {cfg.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {canManage && nextStatus && (
                          <button
                            onClick={() => statusMutation.mutate({ id: ret.id, status: nextStatus })}
                            disabled={statusMutation.isPending}
                            className="text-xs bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 px-2.5 py-1 rounded-md font-medium transition-colors disabled:opacity-50"
                          >
                            → {STATUS_CONFIG[nextStatus]?.label}
                          </button>
                        )}
                        {!nextStatus && <span className="text-xs text-slate-400">Complete</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default PurchaseReturnListPage;
