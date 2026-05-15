import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/axios';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { FlaskConical, Search, Eye, CheckCircle2, XCircle, AlertTriangle, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';

function DecisionBadge({ decision }) {
  if (!decision) return <span className="px-2 py-1 text-xs rounded-full bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400 border border-amber-200 dark:border-amber-500/30 inline-flex items-center gap-1"><Clock className="w-3 h-3" />Pending</span>;
  const map = {
    APPROVED: <span className="px-2 py-1 text-xs rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30 inline-flex items-center gap-1"><CheckCircle2 className="w-3 h-3" />Approved</span>,
    REJECTED: <span className="px-2 py-1 text-xs rounded-full bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400 border border-red-200 dark:border-red-500/30 inline-flex items-center gap-1"><XCircle className="w-3 h-3" />Rejected</span>,
    NEED_SAMPLE: <span className="px-2 py-1 text-xs rounded-full bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400 border border-amber-200 inline-flex items-center gap-1"><AlertTriangle className="w-3 h-3" />Re-sample</span>,
  };
  return map[decision] || null;
}

export default function PendingLabTestsPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');

  const { data: grns = [], isLoading } = useQuery({
    queryKey: ['pending-lab-tests'],
    queryFn: async () => { const res = await api.get('/grn/lab-tests'); return res.data; },
    refetchInterval: 20000,
  });

  const filtered = grns.filter(g =>
    g.referenceNo?.toLowerCase().includes(search.toLowerCase()) ||
    g.po?.name?.toLowerCase().includes(search.toLowerCase()) ||
    g.po?.referenceNo?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-violet-100 dark:bg-violet-500/20 rounded-xl">
            <FlaskConical className="w-6 h-6 text-violet-600 dark:text-violet-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Pending RM Lab Tests</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">GRNs awaiting lab test results</p>
          </div>
        </div>
        <div className="relative w-64">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <Input placeholder="Search GRN, material..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-8 text-sm" />
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3 font-semibold">#</th>
                <th className="px-4 py-3 font-semibold">GRN Ref</th>
                <th className="px-4 py-3 font-semibold">PO Ref</th>
                <th className="px-4 py-3 font-semibold">Material</th>
                <th className="px-4 py-3 font-semibold">Supplier</th>
                <th className="px-4 py-3 font-semibold">Received By</th>
                <th className="px-4 py-3 font-semibold">Received Date</th>
                <th className="px-4 py-3 font-semibold">Items</th>
                <th className="px-4 py-3 font-semibold text-center">Action</th>
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
                        <FlaskConical className="w-8 h-8 text-slate-400" />
                      </div>
                      <p className="text-slate-500 font-medium">No pending lab tests</p>
                      <p className="text-xs text-slate-400">Received deliveries pending lab tests will appear here.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((g, idx) => (
                  <tr key={g.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="px-4 py-4 text-slate-400 text-xs">{idx + 1}</td>
                    <td className="px-4 py-4 font-mono font-bold text-violet-600 dark:text-violet-400 text-sm">{g.referenceNo}</td>
                    <td className="px-4 py-4 font-mono text-indigo-600 dark:text-indigo-400 text-sm">{g.po?.referenceNo}</td>
                    <td className="px-4 py-4">
                      <div className="font-medium text-slate-900 dark:text-slate-100">{g.po?.name}</div>
                      <div className="text-xs text-slate-400">{g.po?.rmId}</div>
                    </td>
                    <td className="px-4 py-4 text-slate-600 dark:text-slate-400">{g.po?.supplier?.name || '-'}</td>
                    <td className="px-4 py-4 text-slate-600 dark:text-slate-400">{g.receiver?.name || '-'}</td>
                    <td className="px-4 py-4 text-slate-600 dark:text-slate-400">{g.receivedDate ? format(new Date(g.receivedDate), 'dd MMM yyyy HH:mm') : '-'}</td>
                    <td className="px-4 py-4 text-slate-600 dark:text-slate-400">{g.items?.length || 0}</td>
                    <td className="px-4 py-4 text-center">
                      <Button size="sm" onClick={() => navigate(`/lab/test/${g.id}`)} className="bg-violet-600 hover:bg-violet-700 text-white h-8 px-3 text-xs gap-1">
                        <FlaskConical className="w-3.5 h-3.5" /> Enter Results
                      </Button>
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
