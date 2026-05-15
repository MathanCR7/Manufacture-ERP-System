import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/axios';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { Truck, Package, Search, Eye, ClipboardCheck, AlertCircle, Clock, CheckCircle2, RefreshCw, QrCode } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';

function StatusPill({ hasGrn }) {
  if (hasGrn) {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30">
        <CheckCircle2 className="w-3 h-3" /> GRN Filed
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400 border border-amber-200 dark:border-amber-500/30 animate-pulse">
      <Clock className="w-3 h-3" /> Awaiting Receipt
    </span>
  );
}

export default function UpcomingDeliveriesPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');

  const { data: deliveries = [], isLoading, refetch } = useQuery({
    queryKey: ['upcoming-deliveries'],
    queryFn: async () => { const res = await api.get('/grn/upcoming'); return res.data; },
    refetchInterval: 30000,
  });

  const filtered = deliveries.filter(d =>
    d.referenceNo?.toLowerCase().includes(search.toLowerCase()) ||
    d.name?.toLowerCase().includes(search.toLowerCase()) ||
    d.supplierName?.toLowerCase().includes(search.toLowerCase())
  );

  const pendingCount = deliveries.filter(d => !d.hasGrn).length;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-100 dark:bg-indigo-500/20 rounded-xl">
            <Truck className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Upcoming Deliveries</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">Purchase orders ready to be received at warehouse</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {pendingCount > 0 && (
            <div className="flex items-center gap-2 px-4 py-2 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-xl text-sm text-red-600 dark:text-red-400 font-medium">
              <AlertCircle className="w-4 h-4" />
              {pendingCount} pending
            </div>
          )}
          <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2">
            <RefreshCw className="w-4 h-4" /> Refresh
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { icon: Package, label: 'Total Upcoming', value: deliveries.length, color: 'blue' },
          { icon: Clock, label: 'Awaiting Receipt', value: pendingCount, color: 'amber' },
          { icon: CheckCircle2, label: 'GRN Filed', value: deliveries.length - pendingCount, color: 'emerald' },
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

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center gap-4">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Deliveries Queue</p>
          <div className="relative w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <Input placeholder="Search PO ref, material, supplier..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-8 text-sm" />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3 font-semibold">#</th>
                <th className="px-4 py-3 font-semibold">PO Reference</th>
                <th className="px-4 py-3 font-semibold">Material</th>
                <th className="px-4 py-3 font-semibold">Supplier</th>
                <th className="px-4 py-3 font-semibold text-right">Qty</th>
                <th className="px-4 py-3 font-semibold text-right">Amount (₹)</th>
                <th className="px-4 py-3 font-semibold">Expected Date</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {isLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i}>{Array.from({ length: 9 }).map((__, j) => <td key={j} className="px-4 py-4"><Skeleton className="h-4 w-full" /></td>)}</tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center">
                        <Truck className="w-8 h-8 text-slate-400" />
                      </div>
                      <p className="text-slate-500 font-medium">No upcoming deliveries</p>
                      <p className="text-xs text-slate-400">When POs are marked as "Received", they appear here.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((d, idx) => (
                  <tr key={d.id} className={`group transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/40 ${!d.hasGrn ? 'bg-amber-50/30 dark:bg-amber-500/5' : ''}`}>
                    <td className="px-4 py-4 text-slate-400 text-xs">{idx + 1}</td>
                    <td className="px-4 py-4 font-mono font-bold text-indigo-600 dark:text-indigo-400 text-sm">{d.referenceNo}</td>
                    <td className="px-4 py-4">
                      <div className="font-medium text-slate-900 dark:text-slate-100">{d.name}</div>
                      <div className="text-xs text-slate-400">{d.rmId}</div>
                    </td>
                    <td className="px-4 py-4 text-slate-600 dark:text-slate-400">{d.supplierName || '-'}</td>
                    <td className="px-4 py-4 text-right font-medium">{Number(d.quantity).toLocaleString()} <span className="text-xs text-slate-400">{d.uom?.abbreviation || ''}</span></td>
                    <td className="px-4 py-4 text-right font-semibold">₹{Number(d.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    <td className="px-4 py-4 text-slate-600 dark:text-slate-400">{d.expectedDelivery ? format(new Date(d.expectedDelivery), 'dd MMM yyyy') : '-'}</td>
                    <td className="px-4 py-4"><StatusPill hasGrn={d.hasGrn} /></td>
                    <td className="px-4 py-4">
                      <div className="flex items-center justify-center gap-1">
                        <Button variant="ghost" size="icon" onClick={() => navigate(`/purchase-orders/${d.id}`)} title="View PO" className="text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 h-8 w-8">
                          <Eye className="w-4 h-4" />
                        </Button>
                        {!d.hasGrn ? (
                          <Button size="sm" onClick={() => navigate(`/grn/receive/${d.id}`)} className="bg-indigo-600 hover:bg-indigo-700 text-white h-8 px-3 text-xs gap-1">
                            <ClipboardCheck className="w-3.5 h-3.5" /> Receive
                          </Button>
                        ) : (
                          <Button variant="outline" size="sm" onClick={() => navigate(`/grn/view/${d.grnId}`)} className="h-8 px-3 text-xs gap-1 text-emerald-600 border-emerald-200 dark:text-emerald-400">
                            <QrCode className="w-3.5 h-3.5" /> View GRN
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
