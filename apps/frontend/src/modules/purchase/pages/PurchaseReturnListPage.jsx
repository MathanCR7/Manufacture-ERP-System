import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/axios';
import { useNavigate, useLocation } from 'react-router-dom';
import PurchaseReturnAddPage from './PurchaseReturnAddPage';
import { format } from 'date-fns';
import {
  Plus, Search, RotateCcw, AlertTriangle, CheckCircle, Clock, Truck,
  QrCode, Bell, Eye, Printer, ChevronRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import useAuthStore from '@/app/store/authStore';
import { SortSelect } from '@/components/ui/SortSelect';
import { Pagination } from '@/components/ui/Pagination';

// Safely import QRCode
import _QRCode from 'react-qr-code';
const QRCode = typeof _QRCode === 'function' ? _QRCode : (_QRCode?.default || _QRCode?.QRCode || 'div');

const STATUS_CONFIG = {
  PENDING:      { label: 'Pending',     color: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20', icon: Clock },
  DISPATCHED:   { label: 'Dispatched',  color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',    icon: Truck },
  ACKNOWLEDGED: { label: 'Acknowledged', color: 'bg-indigo-500/10 text-indigo-650 dark:text-indigo-400 border-indigo-500/20', icon: CheckCircle },
  CLOSED:       { label: 'Closed',      color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20', icon: CheckCircle },
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
function ReturnQRModal({ ret, onClose, getItemUom }) {
  if (!ret) return null;
  const qrPayload = JSON.stringify({
    returnId: ret.referenceNo,
    poNumber: ret.po?.referenceNo,
    grnNumber: ret.grn?.referenceNo,
    supplierName: ret.po?.supplier?.name,
    rawMaterial: ret.items && ret.items.length > 0 ? undefined : ret.po?.name,
    items: ret.items && ret.items.length > 0 ? ret.items.map(i => ({ rmName: i.rmName, returnQty: i.returnQty, uom: getItemUom ? getItemUom(i.rmId, i.rmName, i.uom || ret.uom) : (i.uom || ret.uom) })) : undefined,
    returnQty: ret.returnQty,
    uom: ret.items && ret.items.length > 0 ? undefined : (getItemUom ? getItemUom(ret.po?.rmId, ret.po?.name, ret.uom) : ret.uom),
    returnReason: REASON_LABELS[ret.returnReason] || ret.returnReason,
    returnDate: ret.returnDate,
    status: ret.status,
    initiatedBy: ret.initiatedBy,
    transporterName: ret.transporterName,
    transporterVehicle: ret.transporterVehicle,
    generatedAt: new Date().toISOString(),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4" onClick={onClose}>
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-sm w-full p-5 space-y-4 border border-slate-200 dark:border-slate-800" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
            <QrCode className="w-4.5 h-4.5 text-orange-555" /> Return QR Code
          </h3>
          <button onClick={onClose} className="text-slate-450 hover:text-slate-700 dark:hover:text-slate-200 text-xl font-bold transition-colors">×</button>
        </div>

        <div className="flex justify-center py-1">
          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-inner flex items-center justify-center">
            <QRCode value={qrPayload} size={150} level="M" fgColor="#0f172a" />
          </div>
        </div>

        <div className="space-y-1.5 text-[11px]">
          {[
            { label: 'Return ID', value: ret.referenceNo },
            { label: 'PO Number', value: ret.po?.referenceNo || '—' },
            { label: 'GRN Number', value: ret.grn?.referenceNo || '—' },
            { label: 'Supplier', value: ret.po?.supplier?.name || '—' },
            {
              label: 'Returned Items',
              value: ret.items && Array.isArray(ret.items) && ret.items.length > 0 ? (
                <div className="flex flex-col gap-0.5 w-full text-right">
                  {ret.items.map((item, idx) => (
                    <span key={idx} className="text-[10px] font-bold text-slate-800 dark:text-slate-200 block">
                      {item.rmName}: <strong>{Number(item.returnQty).toFixed(2)} {getItemUom ? getItemUom(item.rmId, item.rmName, item.uom || ret.uom) : (item.uom || ret.uom)}</strong>
                    </span>
                  ))}
                </div>
              ) : (
                `${Number(ret.returnQty).toFixed(2)} ${getItemUom ? getItemUom(ret.po?.rmId, ret.po?.name, ret.uom) : (ret.uom || '')}`
              ),
              isCustomNode: true
            },
            { label: 'Return Reason', value: REASON_LABELS[ret.returnReason] || ret.returnReason },
            { label: 'Return Date', value: ret.returnDate ? format(new Date(ret.returnDate), 'dd MMM yyyy') : '—' },
            { label: 'Status', value: STATUS_CONFIG[ret.status]?.label || ret.status },
            ...(ret.transporterName ? [{ label: 'Transporter', value: ret.transporterName }] : []),
            ...(ret.transporterVehicle ? [{ label: 'Vehicle', value: ret.transporterVehicle }] : []),
          ].map(({ label, value, isCustomNode }) => (
            <div key={label} className="flex justify-between items-center py-1.5 border-b border-slate-100 dark:border-slate-800 last:border-0">
              <span className="text-slate-500 dark:text-slate-400 shrink-0 font-medium">{label}</span>
              {isCustomNode ? value : <span className="font-bold text-slate-850 dark:text-slate-200 text-right">{value}</span>}
            </div>
          ))}
        </div>

        <div className="flex gap-2 pt-2">
          <Button size="sm" variant="outline" onClick={() => window.print()} className="flex-1 gap-1.5 rounded-xl h-9 text-xs border-slate-205">
            <Printer className="w-3.5 h-3.5" /> Print
          </Button>
          <Button size="sm" onClick={onClose} className="flex-1 bg-indigo-650 hover:bg-indigo-700 text-white rounded-xl h-9 text-xs">Close</Button>
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
  const canManage = ['MAIN_MASTER', 'PURCHASE_ACCOUNTANT'].includes(user?.role);

  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterReason, setFilterReason] = useState('');
  const [qrReturn, setQRReturn] = useState(null);
  const [closingId, setClosingId] = useState(null);

  const [view, setView] = useState({ type: 'list', prefill: null });
  const [sortBy, setSortBy] = useState('recent');
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  useEffect(() => {
    if (canManage && (location.pathname === '/purchase-return/add' || location.state)) {
      setView({ type: 'create', prefill: location.state });
    } else {
      setView({ type: 'list', prefill: null });
    }
  }, [location, canManage]);

  const { data: returns = [], isLoading } = useQuery({
    queryKey: ['purchase-returns', filterStatus, filterReason],
    queryFn: () => {
      const params = new URLSearchParams();
      if (filterStatus) params.set('status', filterStatus);
      if (filterReason) params.set('returnReason', filterReason);
      return api.get(`/purchase-return?${params.toString()}`).then(r => r.data);
    },
  });

  // Reset pagination to page 1 on filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [search, filterStatus, filterReason, sortBy]);

  const { data: rmStockList = [] } = useQuery({
    queryKey: ['rm-stock'],
    queryFn: () => api.get('/rm-stock').then(r => r.data),
  });

  const getItemUom = (rmId, rmName, fallbackUom) => {
    if (rmStockList && Array.isArray(rmStockList)) {
      const matched = rmStockList.find(rm => rm.code === rmId || rm.id === rmId || rm.name === rmName);
      if (matched?.unit) return matched.unit;
    }
    return fallbackUom;
  };

  const statusMutation = useMutation({
    mutationFn: ({ id, status }) => api.patch(`/purchase-return/${id}/status`, { status }).then(r => r.data),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['purchase-returns'] });

      // If closing, send notification
      if (variables.status === 'CLOSED') {
        const ret = returns.find(r => r.id === variables.id);
        if (ret) {
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
    if (sortBy === 'recent') return getSortDate(b) - getSortDate(a);
    if (sortBy === 'oldest') return getSortDate(a) - getSortDate(b);
    if (sortBy === 'qty_desc') return Number(b.returnQty || 0) - Number(a.returnQty || 0);
    if (sortBy === 'qty_asc') return Number(a.returnQty || 0) - Number(b.returnQty || 0);
    if (sortBy === 'name_asc') return (a.po?.name || '').localeCompare(b.po?.name || '');
    if (sortBy === 'name_desc') return (b.po?.name || '').localeCompare(a.po?.name || '');
    return 0;
  });

  // Paginated Purchase Returns
  const totalPages = Math.ceil(sorted.length / ITEMS_PER_PAGE);
  const paginatedReturns = sorted.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

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
    <div className="w-full max-w-full px-4 sm:px-6 lg:px-8 py-5 space-y-4 mx-auto transition-all duration-300">
      {/* Page Header (Compact & Professional) */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <RotateCcw className="w-5.5 h-5.5 text-orange-500" />
            Purchase Returns
          </h1>
          <p className="text-xs text-slate-550 dark:text-slate-400">Track and dispatch raw material returns to suppliers.</p>
        </div>
        {canManage && (
          <Button 
            onClick={() => setView({ type: 'create', prefill: null })} 
            className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 rounded-xl text-xs font-semibold h-9 px-4 bg-orange-600 hover:bg-orange-700 text-white select-none shadow-sm active:scale-[0.98] transition-all"
          >
            <Plus className="w-4.5 h-4.5 text-white" /> Add Return
          </Button>
        )}
      </div>

      {/* Stat Cards Grid (Tighter & Compact) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Returns', value: stats.total, colorClass: 'text-slate-600 dark:text-slate-400', bgClass: 'bg-slate-50 dark:bg-slate-950/20' },
          { label: 'Pending Dispatch', value: stats.pending, colorClass: 'text-amber-600 dark:text-amber-450', bgClass: 'bg-amber-50/80 dark:bg-amber-950/20' },
          { label: 'Dispatched', value: stats.dispatched, colorClass: 'text-blue-600 dark:text-blue-450', bgClass: 'bg-blue-50/80 dark:bg-blue-950/20' },
          { label: 'Closed Returns', value: stats.closed, colorClass: 'text-emerald-600 dark:text-emerald-450', bgClass: 'bg-emerald-50/80 dark:bg-emerald-950/20' },
        ].map(s => (
          <div key={s.label} className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/60 rounded-xl p-3.5 shadow-sm hover:shadow transition-all duration-200 hover:-translate-y-0.5 group">
            <p className="text-[9px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest">{s.label}</p>
            <p className={`text-lg font-black mt-0.5 tracking-tight ${s.colorClass}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Closed notification banner */}
      {returns.filter(r => r.status === 'CLOSED').length > 0 && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 flex items-center gap-3">
          <Bell className="w-4.5 h-4.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <div className="text-xs">
            <p className="font-bold text-emerald-800 dark:text-emerald-400">
              Closed returns logged. Inventory records are updated successfully.
            </p>
          </div>
        </div>
      )}

      {/* Filters Toolbar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-sm flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-450" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by PO, Supplier, Material..."
            className="w-full pl-9 pr-4 py-2 text-xs border border-slate-205 dark:border-slate-805 rounded-xl bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/25 h-9"
          />
        </div>
        
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-orange-500/20 font-bold h-9 pr-8"
        >
          <option value="">All Statuses</option>
          {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>

        <select
          value={filterReason}
          onChange={e => setFilterReason(e.target.value)}
          className="border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs bg-white dark:bg-slate-955 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-orange-500/20 font-bold h-9 pr-8"
        >
          <option value="">All Reasons</option>
          {Object.entries(REASON_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>

        <SortSelect
          value={sortBy}
          onChange={setSortBy}
          options={sortOptions}
          className="w-full sm:w-auto h-9 text-xs"
        />
      </div>

      {/* Table Container */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        {isLoading ? (
          <div className="flex items-center justify-center h-48 text-slate-400 text-xs">Loading returns...</div>
        ) : paginatedReturns.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-52 text-slate-400">
            <RotateCcw className="w-9 h-9 mb-2 opacity-30" />
            <p className="font-semibold text-slate-800 dark:text-slate-200 text-sm">No purchase returns found</p>
            <p className="text-xs mt-0.5 text-slate-400">Add a return from GRN records to populate this view.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/80">
                  {['Return ID', 'PO Number', 'GRN', 'Supplier', 'Returned Materials', 'Reason', 'Return Date', 'Status', 'Actions'].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-[10px] font-bold text-slate-400 dark:text-slate-550 uppercase tracking-widest whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {paginatedReturns.map(ret => {
                  const cfg = STATUS_CONFIG[ret.status] || STATUS_CONFIG.PENDING;
                  const isLabRejected = ret.returnReason === 'LAB_REJECTED';
                  const isExpiredRM = ret.returnReason === 'EXPIRED_RM';
                  const currentIdx = STATUS_FLOW.indexOf(ret.status);
                  const nextStatus = STATUS_FLOW[currentIdx + 1];
                  const isClosing = closingId === ret.id;

                  return (
                    <tr key={ret.id} className="hover:bg-slate-50/40 dark:hover:bg-slate-800/20 border-b border-slate-100 dark:border-slate-800/80 transition-colors">
                      <td className="px-4 py-2.5 font-mono text-[11px] text-slate-650 dark:text-slate-300 whitespace-nowrap">
                        <div className="flex flex-col gap-0.5">
                          <span className="font-semibold">{ret.referenceNo}</span>
                          {isLabRejected && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] bg-rose-500/10 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400 font-bold self-start">
                              <AlertTriangle className="w-2.5 h-2.5" /> Lab Rejected
                            </span>
                          )}
                          {isExpiredRM && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] bg-orange-500/10 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400 font-bold self-start">
                              <AlertTriangle className="w-2.5 h-2.5" /> Expired RM
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-[11px] text-indigo-650 dark:text-indigo-400 font-semibold whitespace-nowrap">{ret.po?.referenceNo || '—'}</td>
                      <td className="px-4 py-2.5 text-xs text-slate-550 dark:text-slate-450 whitespace-nowrap">{ret.grn?.referenceNo || '—'}</td>
                      <td className="px-4 py-2.5 text-xs font-semibold text-slate-900 dark:text-white whitespace-nowrap">{ret.po?.supplier?.name || '—'}</td>
                      
                      {/* Returned Materials consolidated list */}
                      <td className="px-4 py-2.5">
                        <div className="flex flex-col gap-1 max-w-[280px]">
                          {ret.items && Array.isArray(ret.items) && ret.items.length > 0 ? (
                            ret.items.map((item, idx) => (
                              <div key={idx} className="flex items-center justify-between text-[11px] bg-slate-50 dark:bg-slate-700/30 border border-slate-100 dark:border-slate-800 rounded-lg px-2 py-0.5">
                                <span className="font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[140px]">{item.rmName}</span>
                                <span className="font-mono font-medium text-slate-700 dark:text-slate-350 ml-2 whitespace-nowrap">
                                  {Number(item.returnQty).toFixed(2)} <span className="text-[9px] text-slate-450">{getItemUom(item.rmId, item.rmName, item.uom || ret.uom)}</span>
                                </span>
                              </div>
                            ))
                          ) : (
                            <div className="flex items-center justify-between text-[11px] bg-slate-50 dark:bg-slate-700/30 border border-slate-100 dark:border-slate-800 rounded-lg px-2 py-0.5">
                              <span className="font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[140px]">{ret.po?.name || '—'}</span>
                              <span className="font-mono font-medium text-slate-700 dark:text-slate-350 ml-2 whitespace-nowrap">
                                {Number(ret.returnQty).toFixed(2)} <span className="text-[9px] text-slate-450">{getItemUom(ret.po?.rmId, ret.po?.name, ret.uom)}</span>
                              </span>
                            </div>
                          )}
                        </div>
                      </td>

                      <td className="px-4 py-2.5 text-xs text-slate-650 dark:text-slate-300 whitespace-nowrap">{REASON_LABELS[ret.returnReason] || ret.returnReason}</td>
                      <td className="px-4 py-2.5 text-xs text-slate-550 dark:text-slate-400 whitespace-nowrap">
                        {ret.returnDate ? format(new Date(ret.returnDate), 'dd MMM yyyy') : '—'}
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-bold border ${cfg.color}`}>
                          <cfg.icon className="w-3.5 h-3.5" />
                          {cfg.label}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setQRReturn(ret)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-purple-650 hover:bg-slate-100 dark:hover:bg-purple-500/10 transition-colors"
                            title="View QR Label"
                          >
                            <QrCode className="w-4.5 h-4.5" />
                          </button>

                          {canManage && nextStatus && (
                            <button
                              onClick={() => handleStatusUpdate(ret, nextStatus)}
                              disabled={statusMutation.isPending && closingId === ret.id}
                              className={`text-[10px] px-2 py-0.5 rounded-lg font-bold transition-all disabled:opacity-50 flex items-center gap-0.5 ${
                                nextStatus === 'CLOSED'
                                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-450 hover:bg-emerald-100 border border-emerald-500/10'
                                  : 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 hover:bg-indigo-100 border border-indigo-500/10'
                              }`}
                            >
                              {isClosing ? (
                                <span className="animate-pulse">Closing...</span>
                              ) : (
                                <>
                                  {nextStatus === 'CLOSED' && <Bell className="w-3 h-3 text-emerald-500" />}
                                  → {STATUS_CONFIG[nextStatus]?.label}
                                </>
                              )}
                            </button>
                          )}
                          {!nextStatus && <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-455 flex items-center gap-0.5"><CheckCircle className="w-3 h-3 text-emerald-500" /> Closed</span>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer info & Pagination Controls */}
        <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/20 dark:bg-slate-900/20 flex flex-col sm:flex-row justify-between items-center gap-3">
          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium order-2 sm:order-1">
            Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, sorted.length)} of {sorted.length} Returns
          </div>

          <div className="order-1 sm:order-2">
            <Pagination 
              currentPage={currentPage} 
              totalPages={totalPages} 
              onPageChange={setCurrentPage} 
            />
          </div>

          <div className="text-xs text-slate-450 font-medium order-3">
            Active Filter Matches: {filtered.length} entries
          </div>
        </div>
      </div>

      {/* QR Modal */}
      {qrReturn && <ReturnQRModal ret={qrReturn} onClose={() => setQRReturn(null)} getItemUom={getItemUom} />}
    </div>
  );
};

export default PurchaseReturnListPage;
