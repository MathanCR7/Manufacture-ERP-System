import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/axios';
import { useNavigate, useLocation } from 'react-router-dom';
import PurchaseReturnAddPage from './PurchaseReturnAddPage';
import { format } from 'date-fns';
import {
  Plus, Search, RotateCcw, AlertTriangle, CheckCircle, Clock, Truck,
  XCircle, QrCode, Bell, Eye, Printer, ChevronRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import useAuthStore from '@/app/store/authStore';
import { SortSelect } from '@/components/ui/SortSelect';

// Safely import QRCode
import _QRCode from 'react-qr-code';
const QRCode = typeof _QRCode === 'function' ? _QRCode : (_QRCode?.default || _QRCode?.QRCode || 'div');

const STATUS_CONFIG = {
  PENDING:      { label: 'Pending',     color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400', icon: Clock },
  DISPATCHED:   { label: 'Dispatched',  color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',    icon: Truck },
  ACKNOWLEDGED: { label: 'Acknowledged', color: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400', icon: CheckCircle },
  CLOSED:       { label: 'Closed',      color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400', icon: CheckCircle },
};

const REASON_LABELS = {
  LAB_REJECTED:   'Lab Test Rejected',
  PHYSICAL_DAMAGE:'Physical Damage',
  WRONG_MATERIAL: 'Wrong Material',
  SHORT_EXPIRY:   'Short Expiry',
  QTY_MISMATCH:   'Quantity Mismatch',
  EXPIRED_RM:     'Expired Raw Material',
  OTHER:          'Other',
};

const STATUS_FLOW = ['PENDING', 'DISPATCHED', 'ACKNOWLEDGED', 'CLOSED'];

// QR Detail Modal for purchase return
function ReturnQRModal({ ret, onClose }) {
  if (!ret) return null;
  const qrPayload = JSON.stringify({
    returnId: ret.referenceNo,
    poNumber: ret.po?.referenceNo,
    grnNumber: ret.grn?.referenceNo,
    supplierName: ret.po?.supplier?.name,
    rawMaterial: ret.po?.name,
    returnQty: ret.returnQty,
    uom: ret.uom,
    returnReason: REASON_LABELS[ret.returnReason] || ret.returnReason,
    returnDate: ret.returnDate,
    status: ret.status,
    initiatedBy: ret.initiatedBy,
    transporterName: ret.transporterName,
    transporterVehicle: ret.transporterVehicle,
    generatedAt: new Date().toISOString(),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-5" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <QrCode className="w-5 h-5 text-orange-500" /> Return QR Code
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl">×</button>
        </div>

        <div className="flex justify-center">
          <div className="bg-white p-3 rounded-xl border-2 border-slate-200 shadow-sm">
            <QRCode value={qrPayload} size={160} level="M" fgColor="#0f172a" />
          </div>
        </div>

        <div className="space-y-2 text-sm">
          {[
            { label: 'Return ID', value: ret.referenceNo },
            { label: 'PO Number', value: ret.po?.referenceNo || '—' },
            { label: 'GRN Number', value: ret.grn?.referenceNo || '—' },
            { label: 'Supplier', value: ret.po?.supplier?.name || '—' },
            { label: 'Raw Material', value: ret.po?.name || '—' },
            { label: 'Return Qty', value: `${Number(ret.returnQty).toFixed(2)} ${ret.uom || ''}` },
            { label: 'Return Reason', value: REASON_LABELS[ret.returnReason] || ret.returnReason },
            { label: 'Return Date', value: ret.returnDate ? format(new Date(ret.returnDate), 'dd MMM yyyy') : '—' },
            { label: 'Status', value: STATUS_CONFIG[ret.status]?.label || ret.status },
            ...(ret.transporterName ? [{ label: 'Transporter', value: ret.transporterName }] : []),
            ...(ret.transporterVehicle ? [{ label: 'Vehicle', value: ret.transporterVehicle }] : []),
          ].map(({ label, value }) => (
            <div key={label} className="flex justify-between items-center py-1.5 border-b border-slate-100 dark:border-slate-800 last:border-0">
              <span className="text-slate-500 dark:text-slate-400">{label}</span>
              <span className="font-medium text-slate-900 dark:text-slate-100 text-right">{value}</span>
            </div>
          ))}
        </div>

        <div className="flex gap-2 pt-2">
          <Button size="sm" variant="outline" onClick={() => window.print()} className="flex-1 gap-2">
            <Printer className="w-4 h-4" /> Print
          </Button>
          <Button size="sm" onClick={onClose} className="flex-1 bg-orange-600 hover:bg-orange-700 text-white">Close</Button>
        </div>
      </div>
    </div>
  );
}

const PurchaseReturnListPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const canManage = ['MAIN_MASTER', 'SUPERVISOR', 'PURCHASE_ACCOUNTANT'].includes(user?.role);

  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterReason, setFilterReason] = useState('');
  const [qrReturn, setQRReturn] = useState(null);
  const [closingId, setClosingId] = useState(null);

  const [view, setView] = useState({ type: 'list', prefill: null });

  useEffect(() => {
    if (location.pathname === '/purchase-return/add' || location.state) {
      setView({ type: 'create', prefill: location.state });
    } else {
      setView({ type: 'list', prefill: null });
    }
  }, [location]);

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
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['purchase-returns'] });

      // If closing, send notification
      if (variables.status === 'CLOSED') {
        const ret = returns.find(r => r.id === variables.id);
        if (ret) {
          // Send notification via API
          api.post('/notifications/send', {
            type: 'PURCHASE_RETURN_CLOSED',
            message: `Purchase Return ${ret.referenceNo} has been CLOSED. PO: ${ret.po?.referenceNo}, Return Qty: ${ret.returnQty} ${ret.uom || ''}. Inventory has been updated.`,
            referenceType: 'PurchaseReturn',
            referenceId: variables.id,
            metadata: {
              returnId: ret.referenceNo,
              poNumber: ret.po?.referenceNo,
              returnQty: ret.returnQty,
              uom: ret.uom,
            }
          }).catch(e => console.warn('Notification send error:', e.message));
        }
      }
      setClosingId(null);
    },
    onError: () => setClosingId(null),
  });

  const handleStatusUpdate = (ret, nextStatus) => {
    if (nextStatus === 'CLOSED') {
      setClosingId(ret.id);
    }
    statusMutation.mutate({ id: ret.id, status: nextStatus });
  };

  const [sortBy, setSortBy] = useState('recent');
  const sortOptions = [
    { value: 'recent', label: 'Recent Returned' },
    { value: 'oldest', label: 'Oldest Returned' },
    { value: 'qty_desc', label: 'Qty: High to Low' },
    { value: 'qty_asc', label: 'Qty: Low to High' },
    { value: 'name_asc', label: 'Material: A to Z' },
    { value: 'name_desc', label: 'Material: Z to A' },
  ];

  const filtered = returns.filter(r => {
    if (!search) return true;
    const term = search.toLowerCase();
    return (
      r.referenceNo?.toLowerCase().includes(term) ||
      r.po?.supplier?.name?.toLowerCase().includes(term) ||
      r.po?.name?.toLowerCase().includes(term)
    );
  });

  const getSortDate = (r) => {
    return new Date(r.returnDate || r.createdAt || 0);
  };

  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === 'recent') {
      return getSortDate(b) - getSortDate(a);
    }
    if (sortBy === 'oldest') {
      return getSortDate(a) - getSortDate(b);
    }
    if (sortBy === 'qty_desc') {
      return Number(b.returnQty || 0) - Number(a.returnQty || 0);
    }
    if (sortBy === 'qty_asc') {
      return Number(a.returnQty || 0) - Number(b.returnQty || 0);
    }
    if (sortBy === 'name_asc') {
      return (a.po?.name || '').localeCompare(b.po?.name || '');
    }
    if (sortBy === 'name_desc') {
      return (b.po?.name || '').localeCompare(a.po?.name || '');
    }
    return 0;
  });

  const stats = {
    total: returns.length,
    pending: returns.filter(r => r.status === 'PENDING').length,
    dispatched: returns.filter(r => r.status === 'DISPATCHED').length,
    closed: returns.filter(r => r.status === 'CLOSED').length,
  };

  if (view.type === 'create') {
    return (
      <PurchaseReturnAddPage 
        prefillData={view.prefill} 
        onBack={() => {
          if (location.pathname === '/purchase-return/add') {
            navigate('/purchase-return/list');
          } else {
            setView({ type: 'list', prefill: null });
          }
        }} 
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <RotateCcw className="w-6 h-6 text-orange-500" /> Purchase Returns
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">{returns.length} return record{returns.length !== 1 ? 's' : ''}</p>
        </div>
        {canManage && (
          <Button onClick={() => setView({ type: 'create', prefill: null })} className="bg-orange-600 hover:bg-orange-700 text-white">
            <Plus className="w-4 h-4 mr-2" /> Add Return
          </Button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total', value: stats.total, color: 'slate' },
          { label: 'Pending', value: stats.pending, color: 'yellow' },
          { label: 'Dispatched', value: stats.dispatched, color: 'blue' },
          { label: 'Closed', value: stats.closed, color: 'green' },
        ].map(s => (
          <div key={s.label} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
            <p className="text-xs text-slate-500 dark:text-slate-400">{s.label}</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">{s.value}</p>
          </div>
        ))}
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
        <SortSelect
          value={sortBy}
          onChange={setSortBy}
          options={sortOptions}
          className="w-full sm:w-auto"
        />
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-48 text-slate-400">Loading returns...</div>
        ) : sorted.length === 0 ? (
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
                {sorted.map(ret => {
                  const cfg = STATUS_CONFIG[ret.status] || STATUS_CONFIG.PENDING;
                  const isLabRejected = ret.returnReason === 'LAB_REJECTED';
                  const isExpiredRM = ret.returnReason === 'EXPIRED_RM';
                  const currentIdx = STATUS_FLOW.indexOf(ret.status);
                  const nextStatus = STATUS_FLOW[currentIdx + 1];
                  const isClosing = closingId === ret.id;

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
                          {isExpiredRM && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400 font-medium">
                              <AlertTriangle className="w-3 h-3" /> Expired RM
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
                        <div className="flex items-center gap-1.5">
                          {/* QR Code button */}
                          <button
                            onClick={() => setQRReturn(ret)}
                            className="p-1.5 rounded-md text-slate-400 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-500/10 transition-colors"
                            title="View QR Code"
                          >
                            <QrCode className="w-4 h-4" />
                          </button>

                          {canManage && nextStatus && (
                            <button
                              onClick={() => handleStatusUpdate(ret, nextStatus)}
                              disabled={statusMutation.isPending && closingId === ret.id}
                              className={`text-xs px-2.5 py-1 rounded-md font-medium transition-colors disabled:opacity-50 flex items-center gap-1 ${
                                nextStatus === 'CLOSED'
                                  ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 hover:bg-green-100'
                                  : 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/50'
                              }`}
                            >
                              {isClosing ? (
                                <span className="animate-pulse">Closing...</span>
                              ) : (
                                <>
                                  {nextStatus === 'CLOSED' && <Bell className="w-3 h-3" />}
                                  → {STATUS_CONFIG[nextStatus]?.label}
                                </>
                              )}
                            </button>
                          )}
                          {!nextStatus && <span className="text-xs text-slate-400 flex items-center gap-1"><CheckCircle className="w-3 h-3 text-green-500" /> Complete</span>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Closed notification banner */}
      {returns.filter(r => r.status === 'CLOSED').length > 0 && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-4 flex items-center gap-3">
          <Bell className="w-5 h-5 text-green-600 dark:text-green-400" />
          <div className="text-sm">
            <p className="font-medium text-green-700 dark:text-green-400">
              {returns.filter(r => r.status === 'CLOSED').length} purchase return(s) closed — all users notified of inventory update.
            </p>
          </div>
        </div>
      )}

      {/* QR Modal */}
      {qrReturn && <ReturnQRModal ret={qrReturn} onClose={() => setQRReturn(null)} />}
    </div>
  );
};

export default PurchaseReturnListPage;
