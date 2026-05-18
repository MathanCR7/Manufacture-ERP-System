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

// Safely import QRCode
import _QRCode from 'react-qr-code';
const QRCode = typeof _QRCode === 'function' ? _QRCode : (_QRCode?.default || _QRCode?.QRCode || 'div');

const GRN_STATUS_CONFIG = {
  PENDING_LAB:    { label: 'Pending Lab',    color: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400 border-amber-200 dark:border-amber-500/30', icon: FlaskConical },
  LAB_APPROVED:   { label: 'Lab Approved',   color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30', icon: CheckCircle2 },
  LAB_REJECTED:   { label: 'Lab Rejected',   color: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400 border-red-200 dark:border-red-500/30', icon: XCircle },
  LAB_RESAMPLE:   { label: 'Re-sample',      color: 'bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-400 border-violet-200 dark:border-violet-500/30', icon: AlertCircle },
};

function GRNStatusPill({ status }) {
  const cfg = GRN_STATUS_CONFIG[status] || { label: status || 'Unknown', color: 'bg-slate-100 text-slate-600 border-slate-200', icon: Clock };
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${cfg.color}`}>
      <Icon className="w-3 h-3" /> {cfg.label}
    </span>
  );
}

function POStatusPill({ hasGrn, grnStatus }) {
  if (!hasGrn) {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400 border border-amber-200 dark:border-amber-500/30 animate-pulse">
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
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 text-xl">×</button>
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
          <Button size="sm" variant="outline" onClick={() => window.print()} className="flex-1 gap-2">
            <Printer className="w-4 h-4" /> Print Label
          </Button>
          <Button size="sm" onClick={onClose} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white">Close</Button>
        </div>
      </div>
    </div>
  );
}

// Delivery Card
function DeliveryCard({ d, idx, navigate, onQRView }) {
  return (
    <div className="flex rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm hover:shadow-md transition-all duration-200 group">
      {/* Side accent */}
      <div className={`w-1.5 shrink-0 ${d.hasGrn ? (d.grnStatus === 'LAB_APPROVED' ? 'bg-emerald-500' : d.grnStatus === 'PENDING_LAB' ? 'bg-amber-500' : 'bg-violet-500') : 'bg-indigo-500'}`} />

      <div className="flex-1 p-4 min-w-0">
        {/* Top row */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400 text-sm">{d.referenceNo}</span>
              <POStatusPill hasGrn={d.hasGrn} grnStatus={d.grnStatus} />
            </div>
            <h4 className="font-semibold text-slate-900 dark:text-slate-100 mt-0.5 truncate">{d.name}</h4>
          </div>
          <div className="text-right shrink-0">
            <p className="text-lg font-bold text-slate-900 dark:text-white">
              {Number(d.quantity).toLocaleString()} <span className="text-sm font-normal text-slate-400">{d.uom?.abbreviation}</span>
            </p>
            <p className="text-sm text-slate-500">₹{Number(d.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
          </div>
        </div>

        {/* Info grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2 text-xs mb-3">
          <div className="flex items-center gap-1.5 text-slate-500">
            <User className="w-3.5 h-3.5" />
            <span className="truncate">{d.supplierName || 'No supplier'}</span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-500">
            <Calendar className="w-3.5 h-3.5" />
            <span>{d.expectedDelivery ? format(new Date(d.expectedDelivery), 'dd MMM yyyy') : '—'}</span>
          </div>
          {d.hasGrn && d.receivedDate && (
            <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Rcvd: {format(new Date(d.receivedDate), 'dd MMM')}</span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(`/purchase-orders/${d.id}`)}
            className="h-7 px-2.5 text-xs gap-1.5 text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400"
          >
            <Eye className="w-3.5 h-3.5" /> View PO
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => onQRView(d)}
            className="h-7 px-2.5 text-xs gap-1.5 text-slate-500 hover:text-purple-600 dark:hover:text-purple-400"
          >
            <QrCode className="w-3.5 h-3.5" /> QR Code
          </Button>

          {!d.hasGrn ? (
            <Button
              size="sm"
              onClick={() => navigate(`/grn/receive/${d.id}`)}
              className="h-7 px-3 text-xs gap-1.5 ml-auto bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              <ClipboardCheck className="w-3.5 h-3.5" /> Receive
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(`/grn/view/${d.grnId}`)}
              className="h-7 px-3 text-xs gap-1.5 ml-auto text-emerald-600 border-emerald-200 dark:text-emerald-400 dark:border-emerald-500/40"
            >
              <ChevronRight className="w-3.5 h-3.5" /> View GRN
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function UpcomingDeliveriesPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('upcoming'); // upcoming | delivered
  const [qrDelivery, setQRDelivery] = useState(null);

  const { data: deliveries = [], isLoading, refetch } = useQuery({
    queryKey: ['upcoming-deliveries'],
    queryFn: async () => {
      const res = await api.get('/grn/upcoming');
      return res.data;
    },
    refetchInterval: 30000,
  });

  // Split into upcoming (no GRN) and delivered (has GRN, lab not rejected)
  const upcoming = deliveries.filter(d => !d.hasGrn);
  const delivered = deliveries.filter(d => d.hasGrn);

  const activeList = activeTab === 'upcoming' ? upcoming : delivered;

  const filtered = activeList.filter(d =>
    d.referenceNo?.toLowerCase().includes(search.toLowerCase()) ||
    d.name?.toLowerCase().includes(search.toLowerCase()) ||
    d.supplierName?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-100 dark:bg-indigo-500/20 rounded-xl">
            <Truck className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">GRN Deliveries</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">Manage purchase order receipts — lab rejected items excluded</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2">
          <RefreshCw className="w-4 h-4" /> Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { icon: Package, label: 'Total Active POs', value: deliveries.length, color: 'blue' },
          { icon: Clock, label: 'Awaiting Receipt', value: upcoming.length, color: 'amber' },
          { icon: CheckCircle2, label: 'GRN Received', value: delivered.length, color: 'emerald' },
        ].map(({ icon: Icon, label, value, color }) => (
          <div key={label} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex items-center gap-4">
            <div className={`p-3 bg-${color}-50 dark:bg-${color}-500/10 rounded-lg`}>
              <Icon className={`w-5 h-5 text-${color}-600 dark:text-${color}-400`} />
            </div>
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs + Search */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-xl p-1">
          {[
            { id: 'upcoming', label: 'Upcoming Deliveries', count: upcoming.length },
            { id: 'delivered', label: 'Delivered', count: delivered.length },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              {tab.label}
              <span className={`px-1.5 py-0.5 rounded-full text-xs font-bold ${
                activeTab === tab.id
                  ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400'
                  : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-400'
              }`}>{tab.count}</span>
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <Input
            placeholder="Search PO ref, material, supplier..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 h-9 text-sm"
          />
        </div>
      </div>

      {/* Cards */}
      {isLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-5 w-48" />
                <Skeleton className="h-3 w-full" />
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 py-20">
          <div className="flex flex-col items-center gap-3 w-full">
            <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center">
              <Truck className="w-8 h-8 text-slate-400" />
            </div>
            <p className="text-slate-500 font-medium">
              {activeTab === 'upcoming' ? 'No upcoming deliveries' : 'No delivered items'}
            </p>
            <p className="text-xs text-slate-400">
              {activeTab === 'upcoming'
                ? 'POs marked as "Received" will appear here (lab rejected items are excluded).'
                : 'Received deliveries will appear here after GRN is filed.'}
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filtered.map((d, idx) => (
            <DeliveryCard key={d.id} d={d} idx={idx} navigate={navigate} onQRView={setQRDelivery} />
          ))}
        </div>
      )}

      {/* QR Modal */}
      {qrDelivery && <QRDetailModal delivery={qrDelivery} onClose={() => setQRDelivery(null)} />}
    </div>
  );
}
