import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/axios';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { 
  FlaskConical, Search, CheckCircle2, XCircle, AlertTriangle, Eye, 
  ArrowUpRight, ClipboardList, Calendar, User, Building2 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';

function DecisionBadge({ decision }) {
  const map = {
    APPROVED: { 
      cls: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-450 border-emerald-200/50 dark:border-emerald-500/20', 
      label: 'Approved', 
      Icon: CheckCircle2 
    },
    REJECTED: { 
      cls: 'bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400 border-rose-200/50 dark:border-rose-500/20', 
      label: 'Rejected', 
      Icon: XCircle 
    },
    NEED_SAMPLE: { 
      cls: 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400 border-amber-200/50 dark:border-amber-500/20', 
      label: 'Re-sample', 
      Icon: AlertTriangle 
    },
  };
  const m = map[decision] || map.NEED_SAMPLE;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${m.cls}`}>
      <m.Icon className="w-3.5 h-3.5" /> {m.label}
    </span>
  );
}

export default function LabResultsPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('ALL');

  const { data: labTests = [], isLoading } = useQuery({
    queryKey: ['lab-results'],
    queryFn: async () => { 
      const res = await api.get('/grn/lab-results'); 
      return res.data; 
    },
  });

  const filtered = labTests.filter(lt => {
    const matchSearch = lt.grn?.referenceNo?.toLowerCase().includes(search.toLowerCase()) ||
      lt.grn?.po?.name?.toLowerCase().includes(search.toLowerCase()) ||
      lt.grn?.po?.referenceNo?.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === 'ALL' || lt.overallDecision === filter;
    return matchSearch && matchFilter;
  });

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      
      {/* Top Header Section */}
      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-3.5">
          <div className="p-3 bg-gradient-to-tr from-violet-600 to-indigo-650 dark:from-violet-500/20 dark:to-indigo-500/20 text-white dark:text-indigo-400 rounded-2xl shadow-md shadow-indigo-550/10">
            <FlaskConical className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">RM Lab Results</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">All completed lab test records</p>
          </div>
        </div>

        {/* Filters and Search Bar Area */}
        <div className="flex flex-col md:flex-row justify-between gap-4">
          <div className="flex rounded-xl p-1 bg-slate-100 dark:bg-slate-800 border border-slate-200/40 dark:border-slate-700/40 w-full md:w-auto overflow-x-auto scrollbar-none gap-0.5">
            {['ALL', 'APPROVED', 'REJECTED', 'NEED_SAMPLE'].map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`flex-1 md:flex-none px-4 py-2 text-xs font-semibold rounded-lg transition-all whitespace-nowrap ${
                  filter === f 
                    ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow-sm' 
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                {f === 'NEED_SAMPLE' ? 'Re-sample' : f === 'ALL' ? 'All Results' : f.charAt(0) + f.slice(1).toLowerCase()}
              </button>
            ))}
          </div>

          <div className="relative w-full md:w-80">
            <Search className="w-4.5 h-4.5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <Input 
              placeholder="Search reference, material, PO..." 
              value={search} 
              onChange={e => setSearch(e.target.value)} 
              className="pl-10 h-10 text-sm w-full bg-white dark:bg-slate-900 rounded-xl border-slate-200 dark:border-slate-805/80 focus:ring-2 focus:ring-indigo-500/20" 
            />
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { 
            label: 'Total Tests', 
            value: labTests.length, 
            icon: ClipboardList, 
            bg: 'bg-slate-50 dark:bg-slate-800/40', 
            text: 'text-slate-650 dark:text-slate-300' 
          },
          { 
            label: 'Approved', 
            value: labTests.filter(l => l.overallDecision === 'APPROVED').length, 
            icon: CheckCircle2, 
            bg: 'bg-emerald-50 dark:bg-emerald-500/10', 
            text: 'text-emerald-600 dark:text-emerald-400' 
          },
          { 
            label: 'Rejected', 
            value: labTests.filter(l => l.overallDecision === 'REJECTED').length, 
            icon: XCircle, 
            bg: 'bg-rose-50 dark:bg-rose-500/10', 
            text: 'text-rose-600 dark:text-rose-400' 
          },
          { 
            label: 'Re-sample', 
            value: labTests.filter(l => l.overallDecision === 'NEED_SAMPLE').length, 
            icon: AlertTriangle, 
            bg: 'bg-amber-50 dark:bg-amber-500/10', 
            text: 'text-amber-600 dark:text-amber-400' 
          },
        ].map(({ label, value, icon: Icon, bg, text }) => (
          <div key={label} className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/80 rounded-2xl p-5 flex items-center justify-between shadow-sm hover:shadow-md transition-all">
            <div className="space-y-1">
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{label}</p>
              <p className={`text-2xl font-bold ${text}`}>{value}</p>
            </div>
            <div className={`p-3 rounded-xl ${bg} ${text} border border-transparent`}>
              <Icon className="w-5.5 h-5.5" />
            </div>
          </div>
        ))}
      </div>

      {/* Mobile view list (visible only on screens smaller than md) */}
      <div className="md:hidden space-y-4">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4 shadow-sm">
              <div className="flex justify-between items-center">
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-6 w-20 rounded-full" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
              </div>
              <Skeleton className="h-9 w-full rounded-xl" />
            </div>
          ))
        ) : filtered.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 text-center shadow-sm">
            <div className="w-14 h-14 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-3">
              <FlaskConical className="w-7 h-7 text-slate-450" />
            </div>
            <p className="text-slate-500 dark:text-slate-400 font-medium">No lab results found</p>
          </div>
        ) : (
          filtered.map((lt) => (
            <div key={lt.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4 hover:shadow-md transition-shadow relative overflow-hidden group">
              <div className={`absolute top-0 left-0 right-0 h-1.5 ${
                lt.overallDecision === 'APPROVED' ? 'bg-emerald-500' :
                lt.overallDecision === 'REJECTED' ? 'bg-rose-500' : 'bg-amber-500'
              }`} />

              <div className="flex justify-between items-start">
                <div className="space-y-0.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">GRN Reference</span>
                  <div className="font-mono font-bold text-violet-600 dark:text-violet-400 text-sm">{lt.grn?.referenceNo}</div>
                </div>
                <DecisionBadge decision={lt.overallDecision} />
              </div>

              <div className="grid grid-cols-2 gap-y-3 gap-x-2 text-xs border-t border-b border-slate-100 dark:border-slate-800 py-3">
                <div className="col-span-2">
                  <span className="text-slate-400 block mb-0.5">Material</span>
                  <div className="font-semibold text-slate-800 dark:text-slate-200 text-sm">{lt.grn?.po?.name}</div>
                  <div className="text-[10px] text-slate-500 font-mono mt-0.5">{lt.grn?.po?.rmId}</div>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">PO Reference</span>
                  <span className="font-mono text-slate-700 dark:text-slate-300 font-medium">{lt.grn?.po?.referenceNo}</span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">Supplier</span>
                  <span className="text-slate-700 dark:text-slate-305 truncate block font-medium">{lt.grn?.po?.supplier?.name || '-'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">Tested By</span>
                  <span className="text-slate-705 dark:text-slate-300 block font-medium">{lt.tester?.name || '-'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">Test Date</span>
                  <span className="text-slate-705 dark:text-slate-300 block font-medium">
                    {lt.createdAt ? format(new Date(lt.createdAt), 'dd MMM yy HH:mm') : '-'}
                  </span>
                </div>
              </div>

              <div className="flex justify-between items-center pt-1">
                <div className="text-xs text-slate-500">
                  <span className="font-semibold text-slate-750 dark:text-slate-200">{lt.testResults?.length || 0}</span> checks checked
                </div>
                <Button 
                  onClick={() => navigate(`/grn/view/${lt.grnId}`)} 
                  className="bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/30 dark:hover:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-xl px-4 py-2 h-9 text-xs font-semibold flex items-center gap-1.5 transition-all shadow-none border border-transparent hover:border-indigo-100/50"
                >
                  View Report <ArrowUpRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Desktop table view (visible only on screens md and larger) */}
      <div className="hidden md:block bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 dark:bg-slate-850/50 text-slate-600 dark:text-slate-400 border-b border-slate-200/60 dark:border-slate-800/60">
              <tr>
                <th className="px-5 py-4 font-semibold text-xs uppercase tracking-wider">#</th>
                <th className="px-5 py-4 font-semibold text-xs uppercase tracking-wider">GRN Ref</th>
                <th className="px-5 py-4 font-semibold text-xs uppercase tracking-wider">PO Ref</th>
                <th className="px-5 py-4 font-semibold text-xs uppercase tracking-wider">Material</th>
                <th className="px-5 py-4 font-semibold text-xs uppercase tracking-wider">Supplier</th>
                <th className="px-5 py-4 font-semibold text-xs uppercase tracking-wider">Tested By</th>
                <th className="px-5 py-4 font-semibold text-xs uppercase tracking-wider">Test Date</th>
                <th className="px-5 py-4 font-semibold text-xs uppercase tracking-wider">Parameters</th>
                <th className="px-5 py-4 font-semibold text-xs uppercase tracking-wider">Decision</th>
                <th className="px-5 py-4 font-semibold text-xs uppercase tracking-wider text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 10 }).map((__, j) => (
                      <td key={j} className="px-5 py-5"><Skeleton className="h-4 w-full" /></td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-5 py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto">
                        <FlaskConical className="w-8 h-8 text-slate-400" />
                      </div>
                      <p className="text-slate-500 dark:text-slate-400 font-medium">No lab results found</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((lt, idx) => (
                  <tr key={lt.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="px-5 py-4 text-slate-400 text-xs font-mono">{idx + 1}</td>
                    <td className="px-5 py-4 font-mono font-bold text-violet-600 dark:text-violet-400 text-sm">{lt.grn?.referenceNo}</td>
                    <td className="px-5 py-4 font-mono text-indigo-650 dark:text-indigo-400 text-sm">{lt.grn?.po?.referenceNo}</td>
                    <td className="px-5 py-4">
                      <div className="font-semibold text-slate-900 dark:text-slate-100 text-sm">{lt.grn?.po?.name}</div>
                      <div className="text-[10px] text-slate-450 font-mono mt-0.5">{lt.grn?.po?.rmId}</div>
                    </td>
                    <td className="px-5 py-4 text-slate-650 dark:text-slate-400 font-medium">{lt.grn?.po?.supplier?.name || '-'}</td>
                    <td className="px-5 py-4 text-slate-650 dark:text-slate-400 font-medium">{lt.tester?.name || '-'}</td>
                    <td className="px-5 py-4 text-slate-650 dark:text-slate-400 font-medium">
                      {lt.createdAt ? format(new Date(lt.createdAt), 'dd MMM yyyy HH:mm') : '-'}
                    </td>
                    <td className="px-5 py-4 text-slate-650 dark:text-slate-400 font-semibold">{lt.testResults?.length || 0}</td>
                    <td className="px-5 py-4"><DecisionBadge decision={lt.overallDecision} /></td>
                    <td className="px-5 py-4 text-center">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => navigate(`/grn/view/${lt.grnId}`)} 
                        className="h-9 w-9 rounded-xl text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 transition-colors"
                      >
                        <Eye className="w-4.5 h-4.5" />
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
