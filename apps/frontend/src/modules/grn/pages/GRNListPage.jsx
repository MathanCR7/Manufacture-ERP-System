import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/axios';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { Search, FileText, Package, FlaskConical, RotateCcw, Eye } from 'lucide-react';

const LAB_STATUS_CONFIG = {
  PENDING_LAB:    { label: 'Pending Lab',   color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' },
  LAB_APPROVED:   { label: 'Lab Approved',  color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  LAB_REJECTED:   { label: 'Lab Rejected',  color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  LAB_RESAMPLE:   { label: 'Re-sample',     color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
};

const INV_STATUS_CONFIG = {
  NOT_UPLOADED: { label: 'Not Uploaded', color: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300' },
  UPLOADED:     { label: 'Uploaded',     color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
};

const GRNListPage = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [filterLabStatus, setFilterLabStatus] = useState('');
  const [filterInvStatus, setFilterInvStatus] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const { data: grns = [], isLoading } = useQuery({
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <FileText className="w-6 h-6 text-indigo-500" />
            GRN Records
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">All goods receipt notes — {filtered.length} of {grns.length} records</p>
        </div>
      </div>

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
                  {['GRN #', 'PO #', 'Supplier', 'Raw Material', 'Ordered', 'Received', 'Shortfall', 'Invoice', 'Date', 'Lab Status', 'Inventory', 'View'].map(h => (
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
                  const invCfg = INV_STATUS_CONFIG[grn.inventoryStatus || 'NOT_UPLOADED'];

                  return (
                    <tr key={grn.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs text-slate-600 dark:text-slate-300 whitespace-nowrap">
                        <div className="flex flex-col gap-0.5">
                          <span>{grn.referenceNo}</span>
                          {grn.isShortDelivery && (
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
                          <FlaskConical className="w-3 h-3" />{labCfg.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${invCfg.color}`}>
                          <Package className="w-3 h-3" />{invCfg.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <button
                          onClick={() => navigate(`/grn/view/${grn.id}`)}
                          className="p-1.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors"
                          title="View GRN"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
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

export default GRNListPage;
