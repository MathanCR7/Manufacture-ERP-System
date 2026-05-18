import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/axios';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import {
  Search, FileText, Package, FlaskConical, Eye, CheckCircle2,
  XCircle, AlertTriangle, Clock, RefreshCw, BarChart3, QrCode, Printer
} from 'lucide-react';
import { Button } from '@/components/ui/button';

// Safely import QRCode
import _QRCode from 'react-qr-code';
const QRCode = typeof _QRCode === 'function' ? _QRCode : (_QRCode?.default || _QRCode?.QRCode || 'div');

const LAB_STATUS_CONFIG = {
  PENDING_LAB:    { label: 'Pending Lab',   color: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400', icon: Clock,         rowClass: '' },
  LAB_APPROVED:   { label: 'Lab Approved',  color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400', icon: CheckCircle2, rowClass: '' },
  LAB_REJECTED:   { label: 'Lab Rejected',  color: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400', icon: XCircle,   rowClass: 'bg-red-50/40 dark:bg-red-500/5 border-l-4 border-l-red-400' },
  LAB_RESAMPLE:   { label: 'Re-sample',     color: 'bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-400', icon: AlertTriangle, rowClass: 'bg-violet-50/30 dark:bg-violet-500/5' },
};

const INV_STATUS_CONFIG = {
  NOT_UPLOADED: { label: 'Not Uploaded', color: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300' },
  UPLOADED:     { label: 'Uploaded',     color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-5" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <QrCode className="w-5 h-5 text-indigo-500" /> GRN QR Code
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl">×</button>
        </div>

        <div className="flex justify-center">
          <div className="bg-white p-3 rounded-xl border-2 border-slate-200 shadow-sm">
            <QRCode value={qrPayload} size={160} level="M" fgColor="#0f172a" />
          </div>
        </div>

        <div className="space-y-1.5 text-sm">
          {[
            { label: 'GRN Number',   value: grn.referenceNo },
            { label: 'PO Number',    value: grn.po?.referenceNo || '—' },
            { label: 'Supplier',     value: grn.po?.supplier?.name || '—' },
            { label: 'Raw Material', value: grn.po?.name || grn.items?.[0]?.rmName || '—' },
            { label: 'Ordered Qty',  value: `${Number(grn.po?.quantity || 0).toFixed(2)} ${grn.po?.uom?.abbreviation || ''}` },
            { label: 'Received Qty', value: `${grn.items?.reduce((s, i) => s + Number(i.actualReceivedQty || 0), 0)?.toFixed(2)} ${grn.po?.uom?.abbreviation || ''}` },
            { label: 'Amount Paid',  value: `₹${Number(grn.amountPaid || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` },
            { label: 'Refund',       value: `₹${Number(grn.refundAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` },
            { label: 'Received',     value: grn.receivedDate ? format(new Date(grn.receivedDate), 'dd MMM yyyy') : '—' },
            { label: 'GRN Status',   value: LAB_STATUS_CONFIG[grn.status]?.label || grn.status },
            ...(labTest ? [
              { label: 'Lab Decision', value: labTest.overallDecision || '—' },
              { label: 'Lab Notes',    value: labTest.labNotes || '—' },
            ] : []),
            ...(labTest?.categoryParams && typeof labTest.categoryParams === 'object'
              ? Object.entries(labTest.categoryParams).map(([k, v]) => ({ label: k, value: String(v) }))
              : []
            ),
          ].map(({ label, value }) => (
            <div key={label} className="flex justify-between items-center py-1 border-b border-slate-100 dark:border-slate-800 last:border-0">
              <span className="text-slate-500 dark:text-slate-400 shrink-0">{label}</span>
              <span className="font-medium text-slate-900 dark:text-slate-100 text-right ml-4 truncate max-w-[180px]">{value}</span>
            </div>
          ))}
        </div>

        <div className="flex gap-2 pt-2">
          <Button size="sm" variant="outline" onClick={() => window.print()} className="flex-1 gap-2">
            <Printer className="w-4 h-4" /> Print
          </Button>
          <Button size="sm" onClick={onClose} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white">Close</Button>
        </div>
      </div>
    </div>
  );
}

const GRNListPage = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [filterLabStatus, setFilterLabStatus] = useState('');
  const [filterInvStatus, setFilterInvStatus] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [qrGRN, setQRGRN] = useState(null);

  const { data: grns = [], isLoading, refetch } = useQuery({
    queryKey: ['grn-list'],
    queryFn: () => api.get('/grn/receive').then(r => r.data),
  });

  const filtered = grns.filter(g => {
    if (filterLabStatus && g.status !== filterLabStatus) return false;
    if (filterInvStatus && g.inventoryStatus !== filterInvStatus) return false;
    if (fromDate && new Date(g.receivedDate) < new Date(fromDate)) return false;
    if (toDate && new Date(g.receivedDate) > new Date(toDate)) return false;
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

  // Stats
  const stats = {
    total: grns.length,
    approved: grns.filter(g => g.status === 'LAB_APPROVED').length,
    rejected: grns.filter(g => g.status === 'LAB_REJECTED').length,
    pending: grns.filter(g => g.status === 'PENDING_LAB').length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <FileText className="w-6 h-6 text-indigo-500" /> GRN Records
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            All goods receipt notes — {filtered.length} of {grns.length} records.
            <span className="ml-1.5 text-red-500 font-medium">Lab-rejected items shown for record-keeping only.</span>
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2">
          <RefreshCw className="w-4 h-4" /> Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { icon: BarChart3,   label: 'Total GRNs',    value: stats.total,    color: 'slate' },
          { icon: CheckCircle2,label: 'Lab Approved',  value: stats.approved, color: 'emerald' },
          { icon: XCircle,     label: 'Lab Rejected',  value: stats.rejected, color: 'red' },
          { icon: Clock,       label: 'Pending Lab',   value: stats.pending,  color: 'amber' },
        ].map(({ icon: Icon, label, value, color }) => (
          <div key={label} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex items-center gap-3">
            <div className={`p-2 bg-${color}-50 dark:bg-${color}-500/10 rounded-lg`}>
              <Icon className={`w-4 h-4 text-${color}-600 dark:text-${color}-400`} />
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
              <p className="text-xl font-bold text-slate-900 dark:text-white">{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Lab Rejected warning banner */}
      {stats.rejected > 0 && (
        <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-xl p-4 flex items-center gap-3">
          <XCircle className="w-5 h-5 text-red-500 shrink-0" />
          <div className="text-sm">
            <p className="font-semibold text-red-700 dark:text-red-400">
              {stats.rejected} Lab-Rejected GRN(s) — These are excluded from Upcoming Deliveries.
            </p>
            <p className="text-red-600 dark:text-red-400 text-xs mt-0.5">
              Initiate a Purchase Return for rejected materials.
            </p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search GRN, supplier, material, invoice..."
            className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <select
          value={filterLabStatus}
          onChange={e => setFilterLabStatus(e.target.value)}
          className="border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">All Lab Statuses</option>
          {Object.entries(LAB_STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select
          value={filterInvStatus}
          onChange={e => setFilterInvStatus(e.target.value)}
          className="border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">All Inventory Statuses</option>
          {Object.entries(INV_STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <input
          type="date"
          value={fromDate}
          onChange={e => setFromDate(e.target.value)}
          className="border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          title="From date"
        />
        <input
          type="date"
          value={toDate}
          onChange={e => setToDate(e.target.value)}
          className="border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          title="To date"
        />
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-48 text-slate-400">Loading GRN records...</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-slate-400">
            <FileText className="w-10 h-10 mb-3 opacity-30" />
            <p className="font-medium">No GRN records found</p>
            <p className="text-sm mt-1">Receive a delivery to create a GRN</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80">
                  {['GRN #', 'PO #', 'Supplier', 'Raw Material', 'Ordered', 'Received', 'Shortfall', 'Invoice', 'Date', 'Lab Status', 'Inventory', 'Lab Params', 'Actions'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {filtered.map(grn => {
                  const orderedQty = Number(grn.po?.quantity || 0);
                  const receivedQty = grn.items?.reduce((s, i) => s + Number(i.actualReceivedQty), 0) || 0;
                  const shortfall = Math.max(0, orderedQty - receivedQty);
                  const labCfg = LAB_STATUS_CONFIG[grn.status] || LAB_STATUS_CONFIG.PENDING_LAB;
                  const LabIcon = labCfg.icon;
                  const invCfg = INV_STATUS_CONFIG[grn.inventoryStatus || 'NOT_UPLOADED'];
                  const isRejected = grn.status === 'LAB_REJECTED';
                  const hasLabParams = grn.labTest?.categoryParams && Object.keys(grn.labTest.categoryParams).length > 0;

                  return (
                    <tr
                      key={grn.id}
                      className={`hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors ${labCfg.rowClass}`}
                    >
                      <td className="px-4 py-3 font-mono text-xs text-slate-600 dark:text-slate-300 whitespace-nowrap">
                        <div className="flex flex-col gap-0.5">
                          <span className={isRejected ? 'text-red-600 dark:text-red-400 font-bold' : ''}>{grn.referenceNo}</span>
                          {isRejected && (
                            <span className="px-1.5 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-xs rounded font-medium inline-flex items-center gap-1">
                              <XCircle className="w-2.5 h-2.5" /> Rejected
                            </span>
                          )}
                          {grn.isShortDelivery && !isRejected && (
                            <span className="px-1.5 py-0.5 bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400 text-xs rounded font-medium">Short</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-indigo-600 dark:text-indigo-400 whitespace-nowrap">
                        {grn.po?.referenceNo || '—'}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-slate-900 dark:text-white whitespace-nowrap">{grn.po?.supplier?.name || '—'}</td>
                      <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-300 whitespace-nowrap">{grn.po?.name || grn.items?.[0]?.rmName || '—'}</td>
                      <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-300 whitespace-nowrap">
                        {orderedQty.toFixed(2)} <span className="text-xs text-slate-400">{grn.po?.uom?.abbreviation}</span>
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold text-slate-900 dark:text-white whitespace-nowrap">
                        {receivedQty.toFixed(2)} <span className="text-xs font-normal text-slate-400">{grn.po?.uom?.abbreviation}</span>
                      </td>
                      <td className="px-4 py-3 text-sm whitespace-nowrap">
                        {shortfall > 0
                          ? <span className="text-orange-600 dark:text-orange-400 font-semibold">-{shortfall.toFixed(2)}</span>
                          : <span className="text-green-500">—</span>
                        }
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">{grn.invoiceNumber || '—'}</td>
                      <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        {grn.receivedDate ? format(new Date(grn.receivedDate), 'dd MMM yyyy') : '—'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${labCfg.color}`}>
                          <LabIcon className="w-3 h-3" />{labCfg.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${invCfg.color}`}>
                          <Package className="w-3 h-3" />{invCfg.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {hasLabParams ? (
                          <div className="flex flex-col gap-0.5 max-w-[120px]">
                            {Object.entries(grn.labTest.categoryParams).slice(0, 2).map(([k, v]) => (
                              <span key={k} className="text-xs text-slate-500 dark:text-slate-400 truncate">{k}: <strong>{v}</strong></span>
                            ))}
                            {Object.keys(grn.labTest.categoryParams).length > 2 && (
                              <span className="text-xs text-indigo-400">+{Object.keys(grn.labTest.categoryParams).length - 2} more</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-300 dark:text-slate-600">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => navigate(`/grn/view/${grn.id}`)}
                            className="p-1.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors"
                            title="View GRN"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setQRGRN(grn)}
                            className="p-1.5 text-slate-400 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg transition-colors"
                            title="View QR Code"
                          >
                            <QrCode className="w-4 h-4" />
                          </button>
                          {isRejected && (
                            <button
                              onClick={() => navigate('/purchase-return/add', {
                                state: { grnId: grn.id, poId: grn.poId, returnReason: 'LAB_REJECTED', initiatedBy: 'LAB_REJECTED' }
                              })}
                              className="p-1.5 text-red-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors text-xs whitespace-nowrap"
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
      </div>

      {/* QR Modal */}
      {qrGRN && <GRNQRModal grn={qrGRN} onClose={() => setQRGRN(null)} />}
    </div>
  );
};

export default GRNListPage;
