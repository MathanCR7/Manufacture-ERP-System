import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/axios';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { 
  FlaskConical, Search, CheckCircle2, XCircle, AlertTriangle, Eye, 
  ArrowUpRight, ClipboardList
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Pagination } from '@/components/ui/Pagination';
import DashboardBackButton from '@/components/ui/DashboardBackButton';

function DecisionBadge({ decision }) {
  const map = {
    APPROVED: { 
      cls: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20', 
      label: 'Approved', 
      Icon: CheckCircle2 
    },
    REJECTED: { 
      cls: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20', 
      label: 'Rejected', 
      Icon: XCircle 
    },
    NEED_SAMPLE: { 
      cls: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20', 
      label: 'Re-sample', 
      Icon: AlertTriangle 
    },
  };
  const m = map[decision] || map.NEED_SAMPLE;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold border ${m.cls}`}>
      <m.Icon className="w-3 h-3" /> {m.label}
    </span>
  );
}

export default function LabResultsPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('ALL');
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  const { data: labTests = [], isLoading } = useQuery({
    queryKey: ['lab-results'],
    queryFn: async () => { 
      const res = await api.get('/grn/lab-results'); 
      return res.data; 
    },
  });

  // Reset pagination on search/filter change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, filter]);

  const filtered = labTests.filter(lt => {
    const matchSearch = lt.grn?.referenceNo?.toLowerCase().includes(search.toLowerCase()) ||
      lt.grn?.po?.name?.toLowerCase().includes(search.toLowerCase()) ||
      lt.grn?.po?.referenceNo?.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === 'ALL' || lt.overallDecision === filter;
    return matchSearch && matchFilter;
  });

  // Pagination Logic
  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginatedLabTests = filtered.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  return (
    <div className="w-full max-w-full px-4 sm:px-6 lg:px-8 py-5 space-y-4 mx-auto transition-all duration-300">
      <DashboardBackButton />
      
      {/* Top Header Section */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-tr from-violet-650 to-indigo-650 dark:from-violet-500/20 dark:to-indigo-500/20 text-white dark:text-indigo-400 rounded-xl shadow-sm shrink-0">
            <FlaskConical className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">RM Lab Results</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Logs of all completed laboratory quality inspection checks.</p>
          </div>
        </div>

        {/* Filters and Search Bar Area */}
        <div className="flex flex-col md:flex-row justify-between gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 rounded-2xl shadow-sm">
          <div className="flex rounded-xl p-1 bg-slate-105 dark:bg-slate-950 border border-slate-200/50 dark:border-slate-800 w-full md:w-auto overflow-x-auto scrollbar-none gap-0.5">
            {['ALL', 'APPROVED', 'REJECTED', 'NEED_SAMPLE'].map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`flex-1 md:flex-none px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all whitespace-nowrap ${
                  filter === f 
                    ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-white shadow-sm' 
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                {f === 'NEED_SAMPLE' ? 'Re-sample' : f === 'ALL' ? 'All Results' : f.charAt(0) + f.slice(1).toLowerCase()}
              </button>
            ))}
          </div>

          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <Input 
              placeholder="Search reference, material, PO..." 
              value={search} 
              onChange={e => setSearch(e.target.value)} 
              className="pl-9 h-9 text-xs w-full bg-white dark:bg-slate-950 rounded-xl border-slate-200 dark:border-slate-800 focus:ring-2 focus:ring-indigo-500/20" 
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
            text: 'text-slate-650 dark:text-slate-350' 
          },
          { 
            label: 'Approved', 
            value: labTests.filter(l => l.overallDecision === 'APPROVED').length, 
            icon: CheckCircle2, 
            bg: 'bg-emerald-50 dark:bg-emerald-950/20', 
            text: 'text-emerald-600 dark:text-emerald-400' 
          },
          { 
            label: 'Rejected', 
            value: labTests.filter(l => l.overallDecision === 'REJECTED').length, 
            icon: XCircle, 
            bg: 'bg-rose-50 dark:bg-rose-955/20', 
            text: 'text-rose-600 dark:text-rose-455' 
          },
          { 
            label: 'Re-sample', 
            value: labTests.filter(l => l.overallDecision === 'NEED_SAMPLE').length, 
            icon: AlertTriangle, 
            bg: 'bg-amber-50 dark:bg-amber-950/20', 
            text: 'text-amber-600 dark:text-amber-400' 
          },
        ].map(({ label, value, icon: Icon, bg, text }) => (
          <div key={label} className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/80 rounded-xl p-3.5 flex items-center justify-between shadow-sm hover:shadow transition-all duration-200">
            <div>
              <p className="text-[9px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest">{label}</p>
              <p className={`text-lg font-black mt-0.5 tracking-tight ${text}`}>{value}</p>
            </div>
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${bg} ${text} shrink-0`}>
              <Icon className="w-4.5 h-4.5" />
            </div>
          </div>
        ))}
      </div>

      {/* Mobile view list (visible only on screens smaller than md) */}
      <div className="md:hidden space-y-3">
        {isLoading ? (
          Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-3 shadow-sm">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-full" />
            </div>
          ))
        ) : paginatedLabTests.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 text-center shadow-sm">
            <FlaskConical className="w-10 h-10 text-slate-350 mx-auto mb-2 opacity-50" />
            <p className="text-slate-500 dark:text-slate-400 font-bold text-sm">No lab results found</p>
          </div>
        ) : (
          paginatedLabTests.map((lt) => (
            <div key={lt.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded-2xl p-4 shadow-sm space-y-3 hover:shadow transition-shadow relative overflow-hidden">
              <div className={`absolute top-0 left-0 right-0 h-1 ${
                lt.overallDecision === 'APPROVED' ? 'bg-emerald-500' :
                lt.overallDecision === 'REJECTED' ? 'bg-rose-500' : 'bg-amber-500'
              }`} />

              <div className="flex justify-between items-start">
                <div className="space-y-0.5">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">GRN Ref</span>
                  <div className="font-mono font-bold text-violet-650 dark:text-violet-400 text-xs">{lt.grn?.referenceNo}</div>
                </div>
                <DecisionBadge decision={lt.overallDecision} />
              </div>

              <div className="grid grid-cols-2 gap-y-2 gap-x-2 text-[11px] border-t border-b border-slate-105 dark:border-slate-800 py-2.5">
                <div className="col-span-2">
                  <span className="text-slate-400 block font-semibold">Material</span>
                  <div className="font-bold text-slate-800 dark:text-slate-200">{lt.grn?.po?.name}</div>
                  <div className="text-[9px] text-slate-500 font-mono mt-0.5">{lt.grn?.po?.rmId}</div>
                </div>
                <div>
                  <span className="text-slate-400 block font-semibold">PO Ref</span>
                  <span className="font-mono text-slate-700 dark:text-slate-300 font-bold">{lt.grn?.po?.referenceNo}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-semibold">Supplier</span>
                  <span className="text-slate-700 dark:text-slate-300 truncate block font-bold">{lt.grn?.po?.supplier?.name || '-'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-semibold">Tested By</span>
                  <span className="text-slate-700 dark:text-slate-350 block font-bold">{lt.tester?.name || '-'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-semibold">Test Date</span>
                  <span className="text-slate-700 dark:text-slate-350 block font-bold">
                    {lt.createdAt ? format(new Date(lt.createdAt), 'dd MMM yy HH:mm') : '-'}
                  </span>
                </div>
              </div>

              <div className="flex justify-between items-center pt-1.5">
                <div className="text-[11px] text-slate-500 font-semibold">
                  <span className="font-bold text-slate-800 dark:text-slate-200">{lt.testResults?.length || 0}</span> checks verified
                </div>
                <Button 
                  onClick={() => navigate(`/grn/view/${lt.grnId}`)} 
                  className="bg-indigo-50/80 hover:bg-indigo-100 dark:bg-indigo-950/20 dark:hover:bg-indigo-900/30 text-indigo-650 dark:text-indigo-400 rounded-xl px-3.5 py-1.5 h-8 text-xs font-bold flex items-center gap-1 border border-transparent shadow-none"
                >
                  View Report <ArrowUpRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Desktop table view (visible only on screens md and larger) */}
      <div className="hidden md:block bg-white dark:bg-slate-900 border border-slate-205 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 dark:bg-slate-950 text-slate-555 dark:text-slate-455 font-bold border-b border-slate-200 dark:border-slate-800 uppercase tracking-widest text-[9px]">
              <tr>
                <th className="px-4 py-3.5 font-bold">#</th>
                <th className="px-4 py-3.5 font-bold">GRN Ref</th>
                <th className="px-4 py-3.5 font-bold">PO Ref</th>
                <th className="px-4 py-3.5 font-bold">Material</th>
                <th className="px-4 py-3.5 font-bold">Supplier</th>
                <th className="px-4 py-3.5 font-bold">Tested By</th>
                <th className="px-4 py-3.5 font-bold">Test Date</th>
                <th className="px-4 py-3.5 font-bold">Parameters</th>
                <th className="px-4 py-3.5 font-bold">Decision</th>
                <th className="px-4 py-3.5 font-bold text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {isLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 10 }).map((__, j) => (
                      <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-full" /></td>
                    ))}
                  </tr>
                ))
              ) : paginatedLabTests.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center">
                    <FlaskConical className="w-8 h-8 text-slate-350 mx-auto mb-2 opacity-50" />
                    <p className="text-slate-500 dark:text-slate-400 font-bold text-sm">No lab results found</p>
                  </td>
                </tr>
              ) : (
                paginatedLabTests.map((lt, idx) => (
                  <tr key={lt.id} className="hover:bg-slate-50/40 dark:hover:bg-slate-800/20 transition-colors border-b border-slate-100 dark:border-slate-800/80">
                    <td className="px-4 py-2.5 text-slate-400 font-mono">{(currentPage - 1) * ITEMS_PER_PAGE + idx + 1}</td>
                    <td className="px-4 py-2.5 font-mono font-bold text-violet-650 dark:text-violet-400">{lt.grn?.referenceNo}</td>
                    <td className="px-4 py-2.5 font-mono text-indigo-650 dark:text-indigo-400 font-semibold">{lt.grn?.po?.referenceNo}</td>
                    <td className="px-4 py-2.5">
                      <div className="font-semibold text-slate-900 dark:text-slate-100">{lt.grn?.po?.name}</div>
                      <div className="text-[9px] text-slate-450 font-mono mt-0.5">{lt.grn?.po?.rmId}</div>
                    </td>
                    <td className="px-4 py-2.5 text-slate-650 dark:text-slate-400 font-bold truncate max-w-[150px]">{lt.grn?.po?.supplier?.name || '-'}</td>
                    <td className="px-4 py-2.5 text-slate-650 dark:text-slate-400 font-semibold">{lt.tester?.name || '-'}</td>
                    <td className="px-4 py-2.5 text-slate-650 dark:text-slate-405 font-medium">
                      {lt.createdAt ? format(new Date(lt.createdAt), 'dd MMM yyyy HH:mm') : '-'}
                    </td>
                    <td className="px-4 py-2.5 text-slate-650 dark:text-slate-400 font-bold">{lt.testResults?.length || 0}</td>
                    <td className="px-4 py-2.5"><DecisionBadge decision={lt.overallDecision} /></td>
                    <td className="px-4 py-2.5 text-center">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => navigate(`/grn/view/${lt.grnId}`)} 
                        className="h-8 w-8 rounded-lg text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shadow-none"
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

        {/* Footer info & Pagination Controls */}
        <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/20 dark:bg-slate-900/20 flex flex-col sm:flex-row justify-between items-center gap-3">
          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium order-2 sm:order-1">
            Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, filtered.length)} of {filtered.length} lab records
          </div>

          <div className="order-1 sm:order-2">
            <Pagination 
              currentPage={currentPage} 
              totalPages={totalPages} 
              onPageChange={setCurrentPage} 
            />
          </div>

          <div className="text-[10px] text-slate-450 font-bold order-3">
            Matched Filters: {filtered.length} entries
          </div>
        </div>
      </div>
    </div>
  );
}
