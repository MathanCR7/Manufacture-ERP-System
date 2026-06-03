import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/axios';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import {
  Truck, Package, Search, Eye, ClipboardCheck, AlertCircle, Clock,
  CheckCircle2, RefreshCw, QrCode, FlaskConical, XCircle, Printer,
  ChevronRight, Calendar, User, IndianRupee, Tag
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { SortSelect } from '@/components/ui/SortSelect';

const GRN_STATUS_CONFIG = {
  PENDING_LAB:    { label: 'Pending Lab',    color: 'bg-amber-50/80 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400 border-amber-200/60 dark:border-amber-500/20', icon: FlaskConical },
  LAB_APPROVED:   { label: 'Lab Approved',   color: 'bg-emerald-50/80 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 border-emerald-200/60 dark:border-emerald-500/20', icon: CheckCircle2 },
  LAB_REJECTED:   { label: 'Lab Rejected',   color: 'bg-red-50/80 text-red-700 dark:bg-red-500/10 dark:text-red-400 border-red-200/60 dark:border-red-500/20', icon: XCircle },
  LAB_RESAMPLE:   { label: 'Re-sample',      color: 'bg-violet-50/80 text-violet-700 dark:bg-violet-500/10 dark:text-violet-400 border-violet-200/60 dark:border-violet-500/20', icon: AlertCircle },
};

function GRNStatusPill({ status }) {
  const cfg = GRN_STATUS_CONFIG[status] || { label: status || 'Unknown', color: 'bg-slate-50 text-slate-600 border-slate-200', icon: Clock };
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${cfg.color} select-none`}>
      <Icon className="w-3 h-3" /> {cfg.label}
    </span>
  );
}

function POStatusPill({ hasGrn, grnStatus }) {
  if (!hasGrn) {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 dark:bg-amber-550/10 text-amber-600 dark:text-amber-400 border border-amber-200/60 dark:border-amber-500/20 animate-pulse select-none">
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-5" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <QrCode className="w-5 h-5 text-indigo-500" /> QR Code Details
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 text-xl font-bold">×</button>
        </div>

        <div className="flex justify-center">
          <div className="bg-white p-3 rounded-xl border-2 border-slate-200 shadow-sm">
            <QRCode value={qrPayload} size={160} level="M" fgColor="#0f172a" />
          </div>
        </div>

        <div className="space-y-2 text-sm">
          {[
            { label: 'PO Number', value: delivery.referenceNo },
            { label: 'Supplier', value: delivery.supplierName || '—' },
            { label: 'Raw Material', value: delivery.name },
            { label: 'Ordered Qty', value: `${Number(delivery.quantity).toLocaleString()} ${delivery.uom?.abbreviation || ''}` },
            { label: 'Expected Delivery', value: delivery.expectedDelivery ? format(new Date(delivery.expectedDelivery), 'dd MMM yyyy') : '—' },
            { label: 'Payment Amount', value: `₹${Number(delivery.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` },
            ...(delivery.hasGrn ? [
              { label: 'GRN Status', value: delivery.grnStatus?.replace('_', ' ') || '—' },
              { label: 'Actual Received Qty', value: delivery.actualReceivedQty != null ? `${Number(delivery.actualReceivedQty).toLocaleString()} ${delivery.uom?.abbreviation || ''}` : '—' },
              { label: 'Refund Amount', value: delivery.refundAmount != null ? `₹${Number(delivery.refundAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—' },
              { label: 'Received Date', value: delivery.receivedDate ? format(new Date(delivery.receivedDate), 'dd MMM yyyy') : '—' },
            ] : []),
          ].map(({ label, value }) => (
            <div key={label} className="flex justify-between items-center py-1.5 border-b border-slate-100 dark:border-slate-800 last:border-0">
              <span className="text-slate-500 dark:text-slate-400">{label}</span>
              <span className="font-medium text-slate-900 dark:text-slate-100 text-right">{value}</span>
            </div>
          ))}
        </div>

        <div className="flex gap-2 pt-2">
          <Button size="sm" variant="outline" onClick={() => window.print()} className="flex-1 gap-2 rounded-xl">
            <Printer className="w-4 h-4" /> Print Label
          </Button>
          <Button size="sm" onClick={onClose} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl">Close</Button>
        </div>
      </div>
    </div>
  );
}

// Delivery Card
function DeliveryCard({ d, idx, navigate, onQRView }) {
  return (
    <div className="flex rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm hover:shadow-md transition-all duration-200 group">
      {/* Side accent */}
      <div className={`w-1.5 shrink-0 ${d.hasGrn ? (d.grnStatus === 'LAB_APPROVED' ? 'bg-emerald-500' : d.grnStatus === 'PENDING_LAB' ? 'bg-amber-500' : 'bg-violet-500') : 'bg-indigo-500'}`} />

      <div className="flex-1 p-4 min-w-0">
        {/* Top row */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400 text-sm">{d.referenceNo}</span>
              <POStatusPill hasGrn={d.hasGrn} grnStatus={d.grnStatus} />
            </div>
            <h4 className="font-semibold text-slate-800 dark:text-slate-200 mt-1.5 text-sm sm:text-base leading-snug break-words">{d.name}</h4>
          </div>
          <div className="text-left sm:text-right shrink-0 bg-slate-50 dark:bg-slate-950 p-2 sm:p-0 rounded-xl sm:bg-transparent dark:sm:bg-transparent border border-slate-100 sm:border-0 dark:border-slate-800/40 sm:dark:border-0 flex sm:flex-col justify-between items-center sm:items-end gap-2 sm:gap-0">
            <p className="text-base font-bold text-slate-800 dark:text-white sm:text-lg">
              {Number(d.quantity).toLocaleString()} <span className="text-xs font-normal text-slate-400">{d.uom?.abbreviation}</span>
            </p>
            <p className="text-xs sm:text-sm font-semibold text-slate-500 dark:text-slate-400 font-mono">₹{Number(d.amount).toLocaleString('en-IN', { minimumFractionDigits: 1 })}</p>
          </div>
        </div>

        {/* Info grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs mb-4 pt-2 border-t border-slate-100 dark:border-slate-800/80">
          <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
            <User className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate font-medium">{d.supplierName || 'No supplier'}</span>
          </div>
          <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
            <Calendar className="w-3.5 h-3.5 shrink-0" />
            <span className="font-medium">{d.expectedDelivery ? format(new Date(d.expectedDelivery), 'dd MMM yyyy') : '—'}</span>
          </div>
          {d.hasGrn && d.receivedDate && (
            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              <span>Rcvd: {format(new Date(d.receivedDate), 'dd MMM yyyy')}</span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(`/purchase-orders/${d.id}`)}
            className="h-8 px-2 text-xs gap-1.5 text-slate-500 hover:text-indigo-650 dark:text-slate-400 dark:hover:text-indigo-300 rounded-xl"
          >
            <Eye className="w-4 h-4" /> 
            <span className="hidden sm:inline">View PO</span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => onQRView(d)}
            className="h-8 px-2 text-xs gap-1.5 text-slate-550 hover:text-purple-600 dark:text-slate-400 dark:hover:text-purple-300 rounded-xl"
          >
            <QrCode className="w-4 h-4" /> 
            <span className="hidden sm:inline">QR Code</span>
          </Button>

          {!d.hasGrn ? (
            <Button
              size="sm"
              onClick={() => navigate(`/grn/receive/${d.id}`)}
              className="h-8 px-3.5 text-xs font-semibold gap-1.5 ml-auto bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl active:scale-95 shadow-sm shadow-indigo-500/10"
            >
              <ClipboardCheck className="w-4 h-4" /> 
              <span>Receive</span>
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(`/grn/view/${d.grnId}`)}
              className="h-8 px-3.5 text-xs font-semibold gap-1.5 ml-auto text-emerald-600 border-emerald-200 hover:bg-emerald-50 dark:text-emerald-400 dark:border-emerald-900/30 rounded-xl active:scale-95"
            >
              <ChevronRight className="w-4 h-4" /> 
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
    bg: 'bg-blue-50 dark:bg-blue-950/30',
    border: 'border-blue-100 dark:border-blue-950/20',
    text: 'text-blue-600 dark:text-blue-400',
  },
  amber: {
    bg: 'bg-amber-50 dark:bg-amber-950/30',
    border: 'border-amber-100 dark:border-amber-950/20',
    text: 'text-amber-600 dark:text-amber-400',
  },
  emerald: {
    bg: 'bg-emerald-50 dark:bg-emerald-950/30',
    border: 'border-emerald-100 dark:border-emerald-950/20',
    text: 'text-emerald-600 dark:text-emerald-400',
  },
};

export default function UpcomingDeliveriesPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('upcoming'); // upcoming | delivered
  const [qrDelivery, setQRDelivery] = useState(null);
  const [sortBy, setSortBy] = useState('recent');

  const { data: deliveries = [], isLoading, refetch } = useQuery({
    queryKey: ['upcoming-deliveries'],
    queryFn: async () => {
      const res = await api.get('/grn/upcoming');
      return res.data;
    },
    refetchInterval: 30000,
  });

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
    if (sortBy === 'recent') {
      return getSortDate(b) - getSortDate(a);
    }
    if (sortBy === 'oldest') {
      return getSortDate(a) - getSortDate(b);
    }
    if (sortBy === 'price_desc') {
      return Number(b.amount || 0) - Number(a.amount || 0);
    }
    if (sortBy === 'price_asc') {
      return Number(a.amount || 0) - Number(b.amount || 0);
    }
    if (sortBy === 'name_asc') {
      return (a.name || '').localeCompare(b.name || '');
    }
    if (sortBy === 'name_desc') {
      return (b.name || '').localeCompare(a.name || '');
    }
    return 0;
  });

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/20 rounded-xl shadow-sm text-indigo-600 dark:text-indigo-400">
            <Truck className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">GRN Deliveries</h1>
            <p className="text-sm text-slate-505 dark:text-slate-400 mt-1">Manage purchase order receipts — lab rejected items excluded</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2 rounded-xl h-9 border-slate-200 dark:border-slate-800">
          <RefreshCw className="w-4 h-4" /> Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { icon: Package, label: 'Total Active POs', value: deliveries.length, color: 'blue' },
          { icon: Clock, label: 'Awaiting Receipt', value: upcoming.length, color: 'amber' },
          { icon: CheckCircle2, label: 'GRN Received', value: delivered.length, color: 'emerald' },
        ].map(({ icon: Icon, label, value, color }) => {
          const colors = STATS_COLORS[color] || STATS_COLORS.blue;
          return (
            <div key={label} className={`bg-white dark:bg-slate-900 border ${colors.border} rounded-2xl p-4 flex items-center gap-4 shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-0.5`}>
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${colors.bg} ${colors.text} shrink-0`}>
                <Icon className="w-6 h-6" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider truncate">{label}</p>
                {isLoading ? (
                  <Skeleton className="h-6 w-16 mt-1" />
                ) : (
                  <p className="text-xl font-bold text-slate-900 dark:text-white mt-0.5 truncate">{value}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Tabs + Search + Sort Toolbar */}
      <div className="flex flex-col gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-sm">
        <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-xl p-1 self-start">
          {[
            { id: 'upcoming', label: 'Upcoming', count: upcoming.length },
            { id: 'delivered', label: 'Delivered', count: delivered.length },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                activeTab === tab.id
                  ? 'bg-white dark:bg-slate-900 text-indigo-650 dark:text-indigo-400 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              {tab.label}
              <span className={`px-1.5 py-0.5 rounded-full text-xs font-bold ${
                activeTab === tab.id
                  ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400'
                  : 'bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-400'
              }`}>{tab.count}</span>
            </button>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3 w-full justify-between pt-1">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              placeholder="Search PO ref, material, supplier..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 h-10 w-full text-sm bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 focus-visible:ring-indigo-500/20 rounded-xl"
            />
          </div>

          <SortSelect
            value={sortBy}
            onChange={setSortBy}
            options={sortOptions}
            className="w-full sm:w-auto"
          />
        </div>
      </div>

      {/* Cards */}
      {isLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3">
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-5 w-48" />
                <Skeleton className="h-3 w-full" />
              </div>
            </div>
          ))}
        </div>
      ) : sorted.length === 0 ? (
        <div className="flex rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-20 shadow-sm">
          <div className="flex flex-col items-center gap-3 w-full text-center p-4">
            <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center">
              <Truck className="w-8 h-8 text-slate-400" />
            </div>
            <p className="text-slate-700 dark:text-slate-200 font-bold">
              {activeTab === 'upcoming' ? 'No upcoming deliveries' : 'No delivered items'}
            </p>
            <p className="text-xs text-slate-400 max-w-sm leading-relaxed">
              {activeTab === 'upcoming'
                ? 'POs marked as "Received" will appear here (lab rejected items are excluded).'
                : 'Received deliveries will appear here after GRN is filed.'}
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {sorted.map((d, idx) => (
            <DeliveryCard key={d.id} d={d} idx={idx} navigate={navigate} onQRView={setQRDelivery} />
          ))}
        </div>
      )}

      {/* QR Modal */}
      {qrDelivery && <QRDetailModal delivery={qrDelivery} onClose={() => setQRDelivery(null)} />}
    </div>
  );
}
