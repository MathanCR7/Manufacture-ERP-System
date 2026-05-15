import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/axios';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { FlaskConical, Search, CheckCircle2, XCircle, AlertTriangle, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';

function DecisionBadge({ decision }) {
  const map = {
    APPROVED: { cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30', label: 'Approved', Icon: CheckCircle2 },
    REJECTED: { cls: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400 border-red-200 dark:border-red-500/30', label: 'Rejected', Icon: XCircle },
    NEED_SAMPLE: { cls: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400 border-amber-200', label: 'Re-sample', Icon: AlertTriangle },
  };
  const m = map[decision] || map.NEED_SAMPLE;
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${m.cls}`}>
      <m.Icon className="w-3 h-3" /> {m.label}
    </span>
  );
}

export default function LabResultsPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('ALL');

  const { data: labTests = [], isLoading } = useQuery({
    queryKey: ['lab-results'],
    queryFn: async () => { const res = await api.get('/grn/lab-results'); return res.data; },
  });

  const filtered = labTests.filter(lt => {
    const matchSearch = lt.grn?.referenceNo?.toLowerCase().includes(search.toLowerCase()) ||
      lt.grn?.po?.name?.toLowerCase().includes(search.toLowerCase()) ||
      lt.grn?.po?.referenceNo?.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === 'ALL' || lt.overallDecision === filter;
    return matchSearch && matchFilter;
  });

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-violet-100 dark:bg-violet-500/20 rounded-xl">
            <FlaskConical className="w-6 h-6 text-violet-600 dark:text-violet-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">RM Lab Results</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">All completed lab test records</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700">
            {['ALL', 'APPROVED', 'REJECTED', 'NEED_SAMPLE'].map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${filter === f ? 'bg-indigo-600 text-white' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
              >
                {f === 'NEED_SAMPLE' ? 'Re-sample' : f === 'ALL' ? 'All' : f.charAt(0) + f.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
          <div className="relative w-56">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <Input placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-8 text-sm" />
          </div>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Tests', value: labTests.length, color: 'slate' },
          { label: 'Approved', value: labTests.filter(l => l.overallDecision === 'APPROVED').length, color: 'emerald' },
          { label: 'Rejected', value: labTests.filter(l => l.overallDecision === 'REJECTED').length, color: 'red' },
          { label: 'Re-sample', value: labTests.filter(l => l.overallDecision === 'NEED_SAMPLE').length, color: 'amber' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
            <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
            <p className={`text-2xl font-bold ${color === 'slate' ? 'text-slate-900 dark:text-white' : `text-${color}-600 dark:text-${color}-400`}`}>{value}</p>
          </div>
        ))}
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
                <th className="px-4 py-3 font-semibold">Tested By</th>
                <th className="px-4 py-3 font-semibold">Test Date</th>
                <th className="px-4 py-3 font-semibold">Items</th>
                <th className="px-4 py-3 font-semibold">Decision</th>
                <th className="px-4 py-3 font-semibold text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>{Array.from({ length: 10 }).map((__, j) => <td key={j} className="px-4 py-4"><Skeleton className="h-4 w-full" /></td>)}</tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center">
                        <FlaskConical className="w-8 h-8 text-slate-400" />
                      </div>
                      <p className="text-slate-500 font-medium">No lab results found</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((lt, idx) => (
                  <tr key={lt.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="px-4 py-4 text-slate-400 text-xs">{idx + 1}</td>
                    <td className="px-4 py-4 font-mono font-bold text-violet-600 dark:text-violet-400 text-sm">{lt.grn?.referenceNo}</td>
                    <td className="px-4 py-4 font-mono text-indigo-600 dark:text-indigo-400 text-sm">{lt.grn?.po?.referenceNo}</td>
                    <td className="px-4 py-4">
                      <div className="font-medium text-slate-900 dark:text-slate-100">{lt.grn?.po?.name}</div>
                      <div className="text-xs text-slate-400">{lt.grn?.po?.rmId}</div>
                    </td>
                    <td className="px-4 py-4 text-slate-600 dark:text-slate-400">{lt.grn?.po?.supplier?.name || '-'}</td>
                    <td className="px-4 py-4 text-slate-600 dark:text-slate-400">{lt.tester?.name || '-'}</td>
                    <td className="px-4 py-4 text-slate-600 dark:text-slate-400">{lt.createdAt ? format(new Date(lt.createdAt), 'dd MMM yyyy HH:mm') : '-'}</td>
                    <td className="px-4 py-4 text-slate-600 dark:text-slate-400">{lt.testResults?.length || 0}</td>
                    <td className="px-4 py-4"><DecisionBadge decision={lt.overallDecision} /></td>
                    <td className="px-4 py-4 text-center">
                      <Button variant="ghost" size="icon" onClick={() => navigate(`/grn/view/${lt.grnId}`)} className="h-8 w-8 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400">
                        <Eye className="w-4 h-4" />
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
