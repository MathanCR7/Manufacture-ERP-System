import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/axios';
import useAuthStore from '@/app/store/authStore';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import {
  Truck, Package, Search, Eye, ClipboardCheck, AlertCircle, Clock,
  CheckCircle2, RefreshCw, QrCode, FlaskConical, XCircle, Printer,
  ChevronRight, Calendar, User
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { SortSelect } from '@/components/ui/SortSelect';
import _QRCode from 'react-qr-code';
import { Pagination } from '@/components/ui/Pagination';

const QRCode = typeof _QRCode === 'function' ? _QRCode : (_QRCode?.default || _QRCode?.QRCode || 'div');

const GRN_STATUS_CONFIG = {
  PENDING_LAB:    { label: 'Pending Lab',    color: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20', icon: FlaskConical },
  LAB_APPROVED:   { label: 'Lab Approved',   color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20', icon: CheckCircle2 },
  LAB_REJECTED:   { label: 'Lab Rejected',   color: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20', icon: XCircle },
  LAB_RESAMPLE:   { label: 'Re-sample',      color: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20', icon: AlertCircle },
};

function GRNStatusPill({ status }) {
  const cfg = GRN_STATUS_CONFIG[status] || { label: status || 'Unknown', color: 'bg-slate-100 text-slate-605 border-slate-200', icon: Clock };
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-bold border ${cfg.color} select-none shadow-sm`}>
      <Icon className="w-3 h-3 animate-pulse" /> {cfg.label}
    </span>
  );
}

function POStatusPill({ hasGrn, grnStatus }) {
  if (!hasGrn) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 animate-pulse select-none shadow-sm">
        <Clock className="w-3 h-3" /> Awaiting Receipt
      </span>
    );
  }
  return <GRNStatusPill status={grnStatus} />;
}

// QR scan detail modal
function QRDetailModal({ delivery, onClose }) {
  if (!delivery) return null;
  const qrPayload = JSON.stringify({
    poNumber: delivery.referenceNo,
    supplierName: delivery.supplierName,
    rawMaterial: delivery.name,
    quantity: delivery.quantity,
    uom: delivery.uom?.abbreviation,
    expectedDelivery: delivery.expectedDelivery,
    paymentStatus: delivery.amount ? `₹${Number(delivery.amount).toLocaleString('en-IN')}` : 'N/A',
    grnStatus: delivery.grnStatus,
    actualReceivedQty: delivery.actualReceivedQty,
    refundAmount: delivery.refundAmount,
    stage: delivery.grnStatus ? 'GRN_RECEIVED' : 'PO_RAISED',
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4" onClick={onClose}>
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-sm w-full p-5 space-y-4 border border-slate-200 dark:border-slate-800" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
            <QrCode className="w-4.5 h-4.5 text-indigo-500" /> QR Details
          </h3>
          <button onClick={onClose} className="text-slate-450 hover:text-slate-700 dark:hover:text-slate-200 text-xl font-bold">×</button>
        </div>

        <div className="flex justify-center py-1">
          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-inner flex items-center justify-center">
            <QRCode value={qrPayload} size={150} level="M" fgColor="#0f172a" />
          </div>
        </div>

        <div className="space-y-1 text-[11px]">
          {[
            { label: 'PO Number', value: delivery.referenceNo },
            { label: 'Supplier', value: delivery.supplierName || '—' },
            { label: 'Raw Material', value: delivery.name },
            { label: 'Ordered Qty', value: `${Number(delivery.quantity).toLocaleString()} ${delivery.uom?.abbreviation || ''}` },
            { label: 'Expected Delivery', value: delivery.expectedDelivery ? format(new Date(delivery.expectedDelivery), 'dd MMM yyyy') : '—' },
            { label: 'Payment Amount', value: `₹${Number(delivery.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` },
            ...(delivery.hasGrn ? [
              { label: 'GRN Status', value: delivery.grnStatus?.replace('_', ' ') || '—' },
              { label: 'Received Qty', value: delivery.actualReceivedQty != null ? `${Number(delivery.actualReceivedQty).toLocaleString()} ${delivery.uom?.abbreviation || ''}` : '—' },
              { label: 'Refund Amount', value: delivery.refundAmount != null ? `₹${Number(delivery.refundAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—' },
              { label: 'Received Date', value: delivery.receivedDate ? format(new Date(delivery.receivedDate), 'dd MMM yyyy') : '—' },
            ] : []),
          ].map(({ label, value }) => (
            <div key={label} className="flex justify-between items-center py-1.5 border-b border-slate-100 dark:border-slate-800 last:border-0">
              <span className="text-slate-500 dark:text-slate-400">{label}</span>
              <span className="font-bold text-slate-850 dark:text-slate-100 text-right">{value}</span>
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

function DeliveryCard({ d, navigate, onQRView, canReceive }) {
  return (
    <div className="flex rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm hover:shadow transition-all duration-200 group">
      {/* Side accent color-coded (sleeker) */}
      <div className={`w-1.5 shrink-0 ${d.hasGrn ? (d.grnStatus === 'LAB_APPROVED' ? 'bg-emerald-500' : d.grnStatus === 'PENDING_LAB' ? 'bg-amber-500' : 'bg-purple-500') : 'bg-indigo-500'}`} />

      <div className="flex-1 p-4 min-w-0 flex flex-col justify-between">
        <div>
          {/* Top row */}
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2.5 mb-3">
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400 text-xs tracking-tight">{d.referenceNo}</span>
                <POStatusPill hasGrn={d.hasGrn} grnStatus={d.grnStatus} />
              </div>
              {d.items && Array.isArray(d.items) && d.items.length > 1 ? (
                <div className="mt-2.5 space-y-1.5 bg-slate-50/50 dark:bg-slate-900/50 p-3 rounded-xl border border-slate-100 dark:border-slate-800/80">
                  <p className="text-[9px] uppercase font-extrabold text-indigo-600 dark:text-indigo-400 tracking-wider flex items-center gap-1">
                    <Package className="w-3 h-3" /> Items ({d.items.length})
                  </p>
                  <div className="grid grid-cols-1 gap-0.5">
                    {d.items.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center text-[11px] py-1 border-b border-dashed border-slate-100 dark:border-slate-800 last:border-b-0">
                        <span className="font-bold text-slate-700 dark:text-slate-300 truncate max-w-[150px]">{item.name}</span>
                        <span className="font-mono text-slate-650 dark:text-slate-400 font-bold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-1.5 py-0.5 rounded text-[10px] shrink-0 ml-2">
                          {Number(item.quantity).toLocaleString()} <span className="text-[9px] font-normal text-slate-400">{item.uomLabel || d.uom?.abbreviation || 'units'}</span>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex items-baseline gap-1.5 flex-wrap">
                  <span className="font-bold text-slate-800 dark:text-slate-200 text-sm leading-tight truncate max-w-[180px]" title={d.name}>{d.name}</span>
                  <span className="font-mono text-slate-500 font-bold text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-150 dark:border-slate-800 px-1 py-0.2 rounded">
                    {Number(d.quantity).toLocaleString()} <span className="text-[10px] font-normal text-slate-400">{d.uom?.abbreviation}</span>
                  </span>
                </div>
              )}
              <div className="text-[11px] text-slate-550 dark:text-slate-400 font-semibold">{d.supplierName}</div>
            </div>
            
            <div className="text-left sm:text-right shrink-0">
              <p className="text-[9px] text-slate-400 uppercase tracking-widest font-extrabold">Value Expected</p>
              <p className="text-xs font-black text-slate-805 dark:text-white mt-0.5 font-mono">
                {d.amount ? `₹${Number(d.amount).toLocaleString('en-IN')}` : 'N/A'}
              </p>
            </div>
          </div>
          
          <div className="text-2xs text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1 my-1 flex-wrap">
            <Calendar className="w-3.5 h-3.5" />
            {!d.hasGrn ? (
              <span>Expected: {d.expectedDelivery ? format(new Date(d.expectedDelivery), 'dd MMM yyyy') : '—'}</span>
            ) : (
              <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-450 font-black">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span>Rcvd: {d.receivedDate ? format(new Date(d.receivedDate), 'dd MMM yyyy') : '—'}</span>
              </div>
            )}
          </div>
        </div>

        {/* Actions bar */}
        <div className="flex items-center gap-2 pt-3 border-t border-slate-100 dark:border-slate-800 mt-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(`/purchase-orders/${d.id}`)}
            className="h-8 px-2 text-[11px] font-bold gap-1 text-slate-500 hover:text-indigo-655 dark:text-slate-400 dark:hover:text-indigo-400 rounded-lg"
          >
            <Eye className="w-3.5 h-3.5" /> 
            <span>View PO</span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => onQRView(d)}
            className="h-8 px-2 text-[11px] font-bold gap-1 text-slate-500 hover:text-purple-650 dark:text-slate-400 dark:hover:text-purple-400 rounded-lg"
          >
            <QrCode className="w-3.5 h-3.5" /> 
            <span>QR</span>
          </Button>

          {canReceive && !d.hasGrn ? (
            <Button
              size="sm"
              onClick={() => navigate(`/grn/receive/${d.id}`)}
              className="h-8 px-3 text-[11px] font-bold gap-1.5 ml-auto bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg active:scale-95 shadow-sm shadow-indigo-500/10 transition-all"
            >
              <ClipboardCheck className="w-3.5 h-3.5" /> 
              <span>Receive</span>
            </Button>
          ) : !d.hasGrn ? (
            <button
              disabled
              className="h-8 px-3 text-[11px] font-bold gap-1.5 ml-auto flex items-center justify-center bg-indigo-100 text-black border border-indigo-200 dark:bg-indigo-950/40 dark:text-white dark:border-indigo-900/30 cursor-not-allowed rounded-lg select-none"
            >
              <ClipboardCheck className="w-3.5 h-3.5" /> 
              <span>Receive</span>
            </button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(`/grn/view/${d.grnId}`)}
              className="h-8 px-3 text-[11px] font-bold gap-1 ml-auto text-emerald-600 border-emerald-200 hover:bg-emerald-50 dark:text-emerald-400 dark:border-emerald-900/30 rounded-lg active:scale-95 transition-all"
            >
              <ChevronRight className="w-3.5 h-3.5" /> 
              <span>View GRN</span>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

const STATS_COLORS = {
  blue: {
    bg: 'bg-blue-50/80 dark:bg-blue-950/20',
    border: 'border-blue-105 dark:border-blue-950/20',
    text: 'text-blue-600 dark:text-blue-400',
  },
  amber: {
    bg: 'bg-amber-50/80 dark:bg-amber-950/20',
    border: 'border-amber-105 dark:border-amber-950/20',
    text: 'text-amber-600 dark:text-amber-400',
  },
  emerald: {
    bg: 'bg-emerald-50/80 dark:bg-emerald-950/20',
    border: 'border-emerald-105 dark:border-emerald-950/20',
    text: 'text-emerald-600 dark:text-emerald-400',
  },
};

export default function UpcomingDeliveriesPage() {
  const navigate = useNavigate();
  const user = useAuthStore(s => s.user);
  const canReceive = ['MAIN_MASTER', 'MATERIALS_RECEIVER'].includes(user?.role);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('upcoming'); // upcoming | delivered
  const [qrDelivery, setQRDelivery] = useState(null);
  const [sortBy, setSortBy] = useState('recent');

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 6; // Grid displays 6 cards per page nicely

  const { data: deliveries = [], isLoading, refetch } = useQuery({
    queryKey: ['upcoming-deliveries'],
    queryFn: async () => {
      const res = await api.get('/grn/upcoming');
      return res.data;
    },
    refetchInterval: 30000,
  });

  // Reset pagination to first page when search filters or sorting change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, activeTab, sortBy]);

  const sortOptions = [
    { value: 'recent', label: 'Recent Expected' },
    { value: 'oldest', label: 'Oldest Expected' },
    { value: 'price_desc', label: 'Price: High to Low' },
    { value: 'price_asc', label: 'Price: Low to High' },
    { value: 'name_asc', label: 'Alphabet: A to Z' },
    { value: 'name_desc', label: 'Alphabet: Z to A' },
  ];

  // Split into upcoming (no GRN) and delivered (has GRN, lab not rejected)
  const upcoming = deliveries.filter(d => !d.hasGrn);
  const delivered = deliveries.filter(d => d.hasGrn);

  const activeList = activeTab === 'upcoming' ? upcoming : delivered;

  const filtered = activeList.filter(d =>
    d.referenceNo?.toLowerCase().includes(search.toLowerCase()) ||
    d.name?.toLowerCase().includes(search.toLowerCase()) ||
    d.supplierName?.toLowerCase().includes(search.toLowerCase())
  );

  const getSortDate = (d) => {
    return new Date(d.receivedDate || d.expectedDelivery || d.createdAt || 0);
  };

  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === 'recent') return getSortDate(b) - getSortDate(a);
    if (sortBy === 'oldest') return getSortDate(a) - getSortDate(b);
    if (sortBy === 'price_desc') return Number(b.amount || 0) - Number(a.amount || 0);
    if (sortBy === 'price_asc') return Number(a.amount || 0) - Number(b.amount || 0);
    if (sortBy === 'name_asc') return (a.name || '').localeCompare(b.name || '');
    if (sortBy === 'name_desc') return (b.name || '').localeCompare(a.name || '');
    return 0;
  });

  // Paginated Deliveries List
  const totalPages = Math.ceil(sorted.length / ITEMS_PER_PAGE);
  const paginatedDeliveries = sorted.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  return (
    <div className="w-full max-w-full px-4 sm:px-6 lg:px-8 py-5 space-y-4 mx-auto transition-all duration-300">
      {/* Page Header (Compact & Professional) */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/20 rounded-lg text-indigo-650 dark:text-indigo-400">
            <Truck className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">GRN Deliveries</h1>
            <p className="text-xs text-slate-505 dark:text-slate-400">Manage PO receipts (lab rejected items excluded).</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} className="w-full sm:w-auto gap-1.5 rounded-xl h-8 text-xs border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </Button>
      </div>

      {/* Stats Cards Grid (Tighter & Compact) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { icon: Package, label: 'Total Active POs', value: deliveries.length, color: 'blue' },
          { icon: Clock, label: 'Awaiting Receipt', value: upcoming.length, color: 'amber' },
          { icon: CheckCircle2, label: 'GRN Received', value: delivered.length, color: 'emerald' },
        ].map(({ icon: Icon, label, value, color }) => {
          const colors = STATS_COLORS[color] || STATS_COLORS.blue;
          return (
            <div key={label} className={`bg-white dark:bg-slate-900 border ${colors.border} rounded-xl p-3.5 flex items-center gap-3.5 shadow-sm hover:shadow transition-all duration-200 hover:-translate-y-0.5 group`}>
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${colors.bg} ${colors.text} shrink-0 shadow-inner group-hover:scale-105 transition-transform duration-200`}>
                <Icon className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[9px] font-extrabold text-slate-450 dark:text-slate-500 uppercase tracking-widest truncate">{label}</p>
                {isLoading ? (
                  <Skeleton className="h-6 w-16 mt-0.5" />
                ) : (
                  <p className="text-lg font-black text-slate-900 dark:text-white mt-0.5 truncate tracking-tight">{value}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Tabs + Search + Sort Toolbar Panel (Compact) */}
      <div className="flex flex-col gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-805 p-4 rounded-2xl shadow-sm">
        {/* Tab switch buttons */}
        <div className="flex items-center bg-slate-100 dark:bg-slate-850 rounded-xl p-0.5 self-start shadow-inner">
          {[
            { id: 'upcoming', label: 'Upcoming', count: upcoming.length },
            { id: 'delivered', label: 'Delivered', count: delivered.length },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all duration-150 ${
                activeTab === tab.id
                  ? 'bg-white dark:bg-slate-900 text-indigo-605 dark:text-indigo-400 shadow'
                  : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              <span>{tab.label}</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black transition-colors ${
                activeTab === tab.id
                  ? 'bg-indigo-50 text-indigo-650 dark:bg-indigo-500/20 dark:text-indigo-400'
                  : 'bg-slate-200 text-slate-550 dark:bg-slate-700 dark:text-slate-400'
              }`}>{tab.count}</span>
            </button>
          ))}
        </div>

        {/* Inputs row */}
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full justify-between pt-1">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <Input
              placeholder="Search PO ref, material, supplier..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-10 h-9 w-full text-xs bg-white dark:bg-slate-955 border-slate-205 dark:border-slate-800 focus-visible:ring-indigo-500/20 rounded-xl shadow-sm"
            />
          </div>

          <SortSelect
            value={sortBy}
            onChange={setSortBy}
            options={sortOptions}
            className="w-full sm:w-auto h-9 text-xs"
          />
        </div>
      </div>

      {/* Responsive Cards Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3">
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-3.5 w-full" />
              </div>
            </div>
          ))}
        </div>
      ) : paginatedDeliveries.length === 0 ? (
        <div className="flex rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-850 bg-white dark:bg-slate-900 py-20 shadow-sm">
          <div className="flex flex-col items-center gap-3 w-full text-center p-5">
            <div className="w-16 h-16 bg-slate-100/80 dark:bg-slate-800 rounded-full flex items-center justify-center">
              <Truck className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-base font-bold text-slate-805 dark:text-slate-100">
              {activeTab === 'upcoming' ? 'No upcoming deliveries found' : 'No delivered items found'}
            </h3>
            <p className="text-xs text-slate-450 max-w-sm leading-relaxed">
              {activeTab === 'upcoming'
                ? 'POs marked as Approved but not yet received at the warehouse will be shown here.'
                : 'Received deliveries with active GRN records will be shown here.'}
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {paginatedDeliveries.map((d) => (
              <DeliveryCard key={d.id} d={d} navigate={navigate} onQRView={setQRDelivery} canReceive={canReceive} />
            ))}
          </div>
          
          {/* Pagination Controls Footer */}
          <div className="flex flex-col sm:flex-row justify-between items-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-4 py-3 rounded-2xl shadow-sm gap-3">
            <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium order-2 sm:order-1">
              Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, sorted.length)} of {sorted.length} deliveries
            </div>

            <div className="order-1 sm:order-2">
              <Pagination 
                currentPage={currentPage} 
                totalPages={totalPages} 
                onPageChange={setCurrentPage} 
              />
            </div>
            
            <div className="text-xs font-bold text-slate-800 dark:text-slate-250 bg-slate-100/50 dark:bg-slate-950 px-3 py-1 rounded-lg border border-slate-200/50 dark:border-slate-850 order-3">
              Total Listed Value: ₹{filtered.reduce((sum, d) => sum + Number(d.amount || 0), 0).toLocaleString('en-IN', { minimumFractionDigits: 1 })}
            </div>
          </div>
        </div>
      )}

      {/* QR Details Modal */}
      {qrDelivery && <QRDetailModal delivery={qrDelivery} onClose={() => setQRDelivery(null)} />}
    </div>
  );
}
