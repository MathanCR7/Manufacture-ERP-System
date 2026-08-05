import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/axios';
import useAuthStore from '@/app/store/authStore';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import {
  Search, FileText, Package, CheckCircle2,
  XCircle, AlertTriangle, Clock, RefreshCw, BarChart3, QrCode, Printer, Eye
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SortSelect } from '@/components/ui/SortSelect';
import DatePicker from '@/components/ui/DatePicker';
import { Pagination } from '@/components/ui/Pagination';
import DashboardBackButton from '@/components/ui/DashboardBackButton';

// Safely import QRCode
import _QRCode from 'react-qr-code';
const QRCode = typeof _QRCode === 'function' ? _QRCode : (_QRCode?.default || _QRCode?.QRCode || 'div');

const LAB_STATUS_CONFIG = {
  PENDING_LAB:    { label: 'Pending Lab',   color: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20', icon: Clock,         rowClass: '' },
  LAB_APPROVED:   { label: 'Lab Approved',  color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20', icon: CheckCircle2, rowClass: '' },
  LAB_REJECTED:   { label: 'Lab Rejected',  color: 'bg-red-505/10 text-red-600 dark:text-red-400 border-red-500/20', icon: XCircle,   rowClass: 'bg-red-50/20 dark:bg-red-950/10 border-l-4 border-l-red-400' },
  LAB_RESAMPLE:   { label: 'Re-sample',     color: 'bg-purple-500/10 text-purple-650 dark:text-purple-400 border-purple-500/20', icon: AlertTriangle, rowClass: 'bg-purple-50/20 dark:bg-purple-950/10' },
};

const INV_STATUS_CONFIG = {
  NOT_UPLOADED: { label: 'Not Uploaded', color: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300' },
  UPLOADED:     { label: 'Uploaded',     color: 'bg-emerald-500/10 text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-400 border border-emerald-500/10' },
};

// QR Modal for GRN
function GRNQRModal({ grn, onClose }) {
  if (!grn) return null;

  const labTest = grn.labTest;
  const qrPayload = JSON.stringify({
    grnNumber: grn.referenceNo,
    poNumber: grn.po?.referenceNo,
    supplierName: grn.po?.supplier?.name,
    rawMaterial: grn.po?.name || grn.items?.[0]?.rmName,
    orderedQty: grn.po?.quantity,
    receivedQty: grn.items?.reduce((s, i) => s + Number(i.actualReceivedQty || 0), 0),
    refundAmount: grn.refundAmount,
    amountPaid: grn.amountPaid,
    receivedDate: grn.receivedDate,
    status: grn.status,
    labDecision: labTest?.overallDecision,
    labNotes: labTest?.labNotes,
    labCategoryParams: labTest?.categoryParams,
    inventoryStatus: grn.inventoryStatus,
    generatedAt: new Date().toISOString(),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4" onClick={onClose}>
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-sm w-full p-5 space-y-4 border border-slate-200 dark:border-slate-800" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
            <QrCode className="w-4.5 h-4.5 text-indigo-500" /> GRN QR Code
          </h3>
          <button onClick={onClose} className="text-slate-450 hover:text-slate-700 dark:hover:text-slate-200 text-xl font-bold">×</button>
        </div>

        <div className="flex justify-center py-1">
          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-inner flex items-center justify-center">
            <QRCode value={qrPayload} size={150} level="M" fgColor="#0f172a" />
          </div>
        </div>

        <div className="space-y-1.5 text-[11px]">
          {[
            { label: 'GRN Number',   value: grn.referenceNo },
            { label: 'PO Number',    value: grn.po?.referenceNo || '—' },
            { label: 'Supplier',     value: grn.po?.supplier?.name || '—' },
            { label: 'Raw Material', value: grn.po?.name || grn.items?.[0]?.rmName || '—' },
            { label: 'Ordered Qty',  value: `${Number(grn.po?.quantity || 0).toFixed(2)} ${grn.po?.uom?.abbreviation || ''}` },
            { label: 'Received Qty', value: `${grn.items?.reduce((s, i) => s + Number(i.actualReceivedQty || 0), 0)?.toFixed(2)} ${grn.po?.uom?.abbreviation || ''}` },
            { label: 'Amount Paid',  value: `₹${Number(grn.amountPaid || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` },
            { label: 'Refund',       value: `₹${Number(grn.refundAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` },
            { label: 'Received Date',value: grn.receivedDate ? format(new Date(grn.receivedDate), 'dd MMM yyyy') : '—' },
            { label: 'Status',       value: LAB_STATUS_CONFIG[grn.status]?.label || grn.status },
            ...(labTest ? [
              { label: 'Lab Decision', value: labTest.overallDecision || '—' },
              { label: 'Lab Notes',    value: labTest.labNotes || '—' },
            ] : []),
          ].map(({ label, value }) => (
            <div key={label} className="flex justify-between items-center py-1.5 border-b border-slate-100 dark:border-slate-800 last:border-0">
              <span className="text-slate-500 dark:text-slate-400 shrink-0">{label}</span>
              <span className="font-bold text-slate-850 dark:text-slate-100 text-right ml-4 truncate max-w-[180px]">{value}</span>
            </div>
          ))}
        </div>

        <div className="flex gap-2 pt-2">
          <Button size="sm" variant="outline" onClick={() => window.print()} className="flex-1 gap-1.5 rounded-xl h-9 text-xs border-slate-205">
            <Printer className="w-3.5 h-3.5" /> Print
          </Button>
          <Button size="sm" onClick={onClose} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl h-9 text-xs">Close</Button>
        </div>
      </div>
    </div>
  );
}

const GRNListPage = () => {
  const navigate = useNavigate();
  const user = useAuthStore(s => s.user);
  const canManageReturns = ['MAIN_MASTER', 'PURCHASE_ACCOUNTANT'].includes(user?.role);
  const [search, setSearch] = useState('');
  const [filterLabStatus, setFilterLabStatus] = useState('');
  const [filterInvStatus, setFilterInvStatus] = useState('');
  const [fromDate, setFromDate] = useState(null);
  const [toDate, setToDate] = useState(null);
  const [qrGRN, setQRGRN] = useState(null);
  const [sortBy, setSortBy] = useState('recent');
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  const { data: grns = [], isLoading, refetch } = useQuery({
    queryKey: ['grn-list'],
    queryFn: () => api.get('/grn/receive').then(r => r.data),
  });

  // Reset pagination to page 1 on filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [search, filterLabStatus, filterInvStatus, fromDate, toDate, sortBy]);

  const sortOptions = [
    { value: 'recent', label: 'Recent Received' },
    { value: 'oldest', label: 'Oldest Received' },
    { value: 'price_desc', label: 'Value: High to Low' },
    { value: 'price_asc', label: 'Value: Low to High' },
    { value: 'name_asc', label: 'Material: A to Z' },
    { value: 'name_desc', label: 'Material: Z to A' },
  ];

  const filtered = grns.filter(g => {
    if (filterLabStatus && g.status !== filterLabStatus) return false;
    if (filterInvStatus && g.inventoryStatus !== filterInvStatus) return false;
    if (fromDate && new Date(g.receivedDate) < fromDate) return false;
    if (toDate && new Date(g.receivedDate) > toDate) return false;
    if (search) {
      const term = search.toLowerCase();
      return (
        g.referenceNo?.toLowerCase().includes(term) ||
        g.po?.supplier?.name?.toLowerCase().includes(term) ||
        g.po?.name?.toLowerCase().includes(term) ||
        g.invoiceNumber?.toLowerCase().includes(term)
      );
    }
    return true;
  });

  const getSortDate = (g) => {
    return new Date(g.receivedDate || g.createdAt || 0);
  };

  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === 'recent') return getSortDate(b) - getSortDate(a);
    if (sortBy === 'oldest') return getSortDate(a) - getSortDate(b);
    if (sortBy === 'price_desc') return Number(b.amountPaid || b.po?.amount || 0) - Number(a.amountPaid || a.po?.amount || 0);
    if (sortBy === 'price_asc') return Number(a.amountPaid || a.po?.amount || 0) - Number(b.amountPaid || b.po?.amount || 0);
    if (sortBy === 'name_asc') {
      const nameA = a.po?.name || a.items?.[0]?.rmName || '';
      const nameB = b.po?.name || b.items?.[0]?.rmName || '';
      return nameA.localeCompare(nameB);
    }
    if (sortBy === 'name_desc') {
      const nameA = a.po?.name || a.items?.[0]?.rmName || '';
      const nameB = b.po?.name || b.items?.[0]?.rmName || '';
      return nameB.localeCompare(nameA);
    }
    return 0;
  });

  // Paginated list
  const totalPages = Math.ceil(sorted.length / ITEMS_PER_PAGE);
  const paginatedGRNs = sorted.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const stats = {
    total: grns.length,
    approved: grns.filter(g => g.status === 'LAB_APPROVED').length,
    rejected: grns.filter(g => g.status === 'LAB_REJECTED').length,
    pending: grns.filter(g => g.status === 'PENDING_LAB').length,
  };

  return (
    <div className="w-full max-w-full px-4 sm:px-6 lg:px-8 py-5 space-y-4 mx-auto transition-all duration-300">
      <DashboardBackButton />
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <FileText className="w-5.5 h-5.5 text-indigo-650 dark:text-indigo-400" />
            GRN Records
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            View all goods receipt notes and raw material inspection logs.
            <span className="ml-1.5 text-red-500 dark:text-red-400 font-semibold">Rejected items are stored for archives only.</span>
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} className="w-full sm:w-auto gap-1.5 rounded-xl h-8 text-xs border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300">
          <RefreshCw className="w-3.5 h-3.5 animate-spin-hover" /> Refresh
        </Button>
      </div>

      {/* Stats Cards Grid (Tighter & Compact) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { icon: BarChart3,   label: 'Total GRNs',    value: stats.total,    colorClass: 'text-indigo-600 dark:text-indigo-455', bgClass: 'bg-indigo-50/80 dark:bg-indigo-950/20' },
          { icon: CheckCircle2,label: 'Lab Approved',  value: stats.approved, colorClass: 'text-emerald-600 dark:text-emerald-450', bgClass: 'bg-emerald-50/80 dark:bg-emerald-950/20' },
          { icon: XCircle,     label: 'Lab Rejected',  value: stats.rejected, colorClass: 'text-rose-600 dark:text-rose-455', bgClass: 'bg-rose-50/80 dark:bg-rose-955/20' },
          { icon: Clock,       label: 'Pending Lab',   value: stats.pending,  colorClass: 'text-amber-600 dark:text-amber-450', bgClass: 'bg-amber-50/80 dark:bg-amber-950/20' },
        ].map(({ icon: Icon, label, value, colorClass, bgClass }) => (
          <div key={label} className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/60 rounded-xl p-3.5 flex items-center gap-3 shadow-sm hover:shadow transition-all duration-200 hover:-translate-y-0.5 group">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${bgClass} ${colorClass} shrink-0 shadow-inner group-hover:scale-105 transition-transform duration-200`}>
              <Icon className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[9px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest">{label}</p>
              <p className="text-lg font-black text-slate-900 dark:text-white mt-0.5 tracking-tight">{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Lab Rejected warning banner */}
      {stats.rejected > 0 && (
        <div className="bg-rose-50/50 dark:bg-rose-950/10 border border-rose-200 dark:border-rose-900/30 rounded-xl p-3.5 flex items-center gap-3">
          <XCircle className="w-5 h-5 text-rose-500 shrink-0 animate-pulse" />
          <div className="text-xs">
            <p className="font-bold text-rose-800 dark:text-rose-400">
              {stats.rejected} Lab-Rejected GRN(s) are logged in system archives.
            </p>
            <p className="text-rose-650 dark:text-rose-400/80 text-[11px] mt-0.5">
              Please issue a formal Purchase Return to supplier for these rejected materials.
            </p>
          </div>
        </div>
      )}

      {/* Toolbar Filters Panel */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-sm flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search GRN, Supplier, Material, Invoice..."
            className="w-full pl-9 pr-4 py-2 text-xs border border-slate-205 dark:border-slate-805 rounded-xl bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/25 h-9"
          />
        </div>
        
        <select
          value={filterLabStatus}
          onChange={e => setFilterLabStatus(e.target.value)}
          className="border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-bold h-9 pr-8"
        >
          <option value="">All Lab Decisions</option>
          {Object.entries(LAB_STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>

        <select
          value={filterInvStatus}
          onChange={e => setFilterInvStatus(e.target.value)}
          className="border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-bold h-9 pr-8"
        >
          <option value="">All Inventory Statuses</option>
          {Object.entries(INV_STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <DatePicker
            value={fromDate}
            onChange={setFromDate}
            modalTitle="From Date"
            placeholder="From Date"
            className="w-full sm:w-28 text-xs h-9"
            triggerClassName="h-9 text-xs border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 rounded-xl"
          />
          <DatePicker
            value={toDate}
            onChange={setToDate}
            modalTitle="To Date"
            placeholder="To Date"
            className="w-full sm:w-28 text-xs h-9"
            triggerClassName="h-9 text-xs border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 rounded-xl"
          />
        </div>

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
          <div className="flex items-center justify-center h-48 text-slate-400 text-xs">Loading GRN records...</div>
        ) : paginatedGRNs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-52 text-slate-400">
            <FileText className="w-9 h-9 mb-2 opacity-30" />
            <p className="font-semibold text-slate-800 dark:text-slate-200 text-sm">No GRN records found</p>
            <p className="text-xs mt-0.5 text-slate-400">Receive delivery from upcoming listings to log records.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
             <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/80">
                  {['GRN #', 'PO #', 'Supplier', 'Received Materials', 'Invoice', 'Received Date', 'Lab Status', 'Inventory', 'Actions'].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-[10px] font-bold text-slate-400 dark:text-slate-550 uppercase tracking-widest whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {paginatedGRNs.map(grn => {
                  const labCfg = LAB_STATUS_CONFIG[grn.status] || LAB_STATUS_CONFIG.PENDING_LAB;
                  const LabIcon = labCfg.icon;
                  const invCfg = INV_STATUS_CONFIG[grn.inventoryStatus || 'NOT_UPLOADED'];
                  const isRejected = grn.status === 'LAB_REJECTED';

                  return (
                    <tr
                      key={grn.id}
                      className={`hover:bg-slate-50/40 dark:hover:bg-slate-800/20 transition-colors ${labCfg.rowClass}`}
                    >
                      <td className="px-4 py-2.5 font-mono text-[11px] text-slate-650 dark:text-slate-300 whitespace-nowrap">
                        <div className="flex flex-col gap-0.5">
                          <span className={isRejected ? 'text-rose-600 dark:text-rose-400 font-bold' : 'font-semibold'}>{grn.referenceNo}</span>
                          {isRejected && (
                            <span className="px-1.5 py-0.5 bg-rose-500/10 text-rose-600 dark:text-rose-400 text-[10px] rounded font-bold inline-flex items-center gap-0.5 self-start">
                              <XCircle className="w-2.5 h-2.5" /> Rejected
                            </span>
                          )}
                          {grn.isShortDelivery && !isRejected && (
                            <span className="px-1.5 py-0.5 bg-orange-500/10 text-orange-600 dark:text-orange-400 text-[10px] rounded font-bold self-start">Short</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-[11px] text-indigo-650 dark:text-indigo-400 font-semibold whitespace-nowrap">
                        {grn.po?.referenceNo || '—'}
                      </td>
                      <td className="px-4 py-2.5 text-xs font-semibold text-slate-900 dark:text-white whitespace-nowrap">{grn.po?.supplier?.name || '—'}</td>
                      
                      {/* Consolidated Received Materials */}
                      <td className="px-4 py-2.5">
                        <div className="flex flex-col gap-1 max-w-[320px]">
                          {grn.items && grn.items.length > 0 ? (
                            grn.items.map(item => {
                              const itemExpected = Number(item.expectedQty || 0);
                              const itemReceived = Number(item.actualReceivedQty || 0);
                              const itemShortfall = Math.max(0, itemExpected - itemReceived);
                              const itemUom = grn.po?.uom?.abbreviation || '';

                              return (
                                <div key={item.id || item.rmId} className="flex items-center justify-between gap-3 text-[11px] bg-slate-50 dark:bg-slate-700/30 border border-slate-100 dark:border-slate-800 rounded-lg px-2 py-0.5">
                                  <div className="flex flex-col">
                                    <span className="font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[150px]">{item.rmName}</span>
                                    <span className="text-[9px] text-slate-400">
                                      Recv: <strong className="text-slate-750 dark:text-slate-300">{itemReceived.toFixed(2)}</strong> / {itemExpected.toFixed(2)} {itemUom}
                                    </span>
                                  </div>
                                  {itemShortfall > 0 ? (
                                    <span className="text-[9px] font-bold text-rose-500 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30 px-1 py-0.2 rounded">
                                      -{itemShortfall.toFixed(2)}
                                    </span>
                                  ) : (
                                    <span className="text-[9px] text-emerald-600 dark:text-emerald-450 bg-emerald-50 dark:bg-emerald-950/30 px-1 py-0.2 rounded font-bold">
                                      Ok
                                    </span>
                                  )}
                                </div>
                              );
                            })
                          ) : (
                            <span className="text-slate-400 text-[11px]">—</span>
                          )}
                        </div>
                      </td>

                      <td className="px-4 py-2.5 text-xs text-slate-550 dark:text-slate-450 whitespace-nowrap">{grn.invoiceNumber || '—'}</td>
                      <td className="px-4 py-2.5 text-xs text-slate-500 dark:text-slate-450 whitespace-nowrap">
                        {grn.receivedDate ? format(new Date(grn.receivedDate), 'dd MMM yyyy') : '—'}
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-bold border ${labCfg.color}`}>
                          <LabIcon className="w-3.5 h-3.5" />{labCfg.label}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[11px] font-bold ${invCfg.color}`}>
                          <Package className="w-3 h-3" />{invCfg.label}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => navigate(`/grn/view/${grn.id}`)}
                            className="p-1.5 text-slate-400 hover:text-indigo-650 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-all"
                            title="View GRN File"
                          >
                            <Eye className="w-4.5 h-4.5" />
                          </button>
                          <button
                            onClick={() => setQRGRN(grn)}
                            className="p-1.5 text-slate-400 hover:text-purple-650 dark:hover:text-purple-400 hover:bg-slate-100 dark:hover:bg-slate-850 rounded-lg transition-all"
                            title="View QR Label"
                          >
                            <QrCode className="w-4.5 h-4.5" />
                          </button>
                          {isRejected && canManageReturns && (
                            <button
                              onClick={() => navigate('/purchase-return/add', {
                                state: { grnId: grn.id, poId: grn.poId, returnReason: 'LAB_REJECTED', initiatedBy: 'LAB_REJECTED' }
                              })}
                              className="px-2.5 py-1 text-rose-700 bg-rose-50/50 hover:bg-rose-100/60 dark:text-rose-400 dark:bg-rose-950/20 dark:border dark:border-rose-900/30 rounded-lg transition-colors text-[10px] font-bold ml-1.5"
                              title="Initiate Return"
                            >
                              Return
                            </button>
                          )}
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
            Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, sorted.length)} of {sorted.length} GRNs
          </div>

          <div className="order-1 sm:order-2">
            <Pagination 
              currentPage={currentPage} 
              totalPages={totalPages} 
              onPageChange={setCurrentPage} 
            />
          </div>

          <div className="text-xs text-slate-400 font-medium order-3">
            Active Filter Matches: {filtered.length} entries
          </div>
        </div>
      </div>

      {/* QR Modal */}
      {qrGRN && <GRNQRModal grn={qrGRN} onClose={() => setQRGRN(null)} />}
    </div>
  );
};

export default GRNListPage;
