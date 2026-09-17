import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/axios';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { 
  FlaskConical, Search, CheckCircle2, XCircle, AlertTriangle, Eye, 
  ArrowUpRight, ClipboardList, X, Layers
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

// Helper to extract all distinct materials from a lab test record
function getMaterialsForLabTest(lt) {
  const materials = [];
  const seen = new Set();

  const addMaterial = (name, code) => {
    if (!name || typeof name !== 'string') return;
    const cleanName = name.trim();
    if (!cleanName) return;
    const cleanCode = code ? String(code).trim() : null;
    const key = `${cleanName.toLowerCase()}__${(cleanCode || '').toLowerCase()}`;
    if (!seen.has(key)) {
      seen.add(key);
      materials.push({ name: cleanName, code: cleanCode });
    }
  };

  // 1. From testResults
  if (Array.isArray(lt.testResults) && lt.testResults.length > 0) {
    lt.testResults.forEach(tr => {
      addMaterial(tr.rmName, tr.rmId);
    });
  }

  // 2. From grn.items
  if (Array.isArray(lt.grn?.items) && lt.grn.items.length > 0) {
    lt.grn.items.forEach(gi => {
      addMaterial(gi.rmName, gi.rmId);
    });
  }

  // 3. From grn.po.items (JSON array)
  if (Array.isArray(lt.grn?.po?.items) && lt.grn.po.items.length > 0) {
    lt.grn.po.items.forEach(pi => {
      addMaterial(pi.name || pi.materialName || pi.rmName, pi.rmId || pi.materialCode || pi.code);
    });
  }

  // 4. Fallback from grn.po.name
  if (materials.length === 0 && lt.grn?.po?.name) {
    addMaterial(lt.grn.po.name, lt.grn.po.rmId);
  }

  return materials;
}

// Compact, professional Materials Cell displaying first 2 items + "+X more" direct link to view page
function MaterialsCell({ materials, grnId }) {
  const navigate = useNavigate();

  if (!materials || materials.length === 0) {
    return <span className="text-slate-400 italic text-xs">—</span>;
  }

  const displayed = materials.slice(0, 2);
  const extraCount = materials.length - 2;

  return (
    <div className="flex flex-col gap-1 py-0.5 max-w-[280px]">
      {displayed.map((item, idx) => (
        <div key={idx} className="flex items-center gap-1.5 flex-wrap min-w-0">
          <span 
            className="font-semibold text-slate-800 dark:text-slate-200 text-xs truncate max-w-[190px]" 
            title={item.name}
          >
            {item.name}
          </span>
          {item.code && (
            <span className="font-mono text-[9px] text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.2 rounded border border-slate-200/80 dark:border-slate-700/80 shrink-0">
              {item.code}
            </span>
          )}
        </div>
      ))}

      {extraCount > 0 && (
        <div className="mt-0.5">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (grnId) {
                navigate(`/grn/view/${grnId}`);
              }
            }}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/80 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800/80 transition-all cursor-pointer shadow-2xs hover:scale-105 active:scale-95 group"
            title={`View all ${materials.length} items in report`}
          >
            <Layers className="w-2.5 h-2.5 text-indigo-500 group-hover:text-indigo-600" />
            <span>+{extraCount} more</span>
            <ArrowUpRight className="w-2.5 h-2.5 text-indigo-400 group-hover:text-indigo-600 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </button>
        </div>
      )}
    </div>
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
    const materials = getMaterialsForLabTest(lt);
    const materialMatch = materials.some(m => 
      (m.name && m.name.toLowerCase().includes(search.toLowerCase())) || 
      (m.code && m.code.toLowerCase().includes(search.toLowerCase()))
    );

    const matchSearch = 
      lt.grn?.referenceNo?.toLowerCase().includes(search.toLowerCase()) ||
      lt.grn?.po?.name?.toLowerCase().includes(search.toLowerCase()) ||
      lt.grn?.po?.referenceNo?.toLowerCase().includes(search.toLowerCase()) ||
      lt.grn?.po?.supplier?.name?.toLowerCase().includes(search.toLowerCase()) ||
      lt.tester?.name?.toLowerCase().includes(search.toLowerCase()) ||
      materialMatch;

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
          <div className="p-2.5 bg-gradient-to-tr from-violet-600 to-indigo-600 dark:from-violet-500/20 dark:to-indigo-500/20 text-white dark:text-indigo-400 rounded-2xl shadow-sm shrink-0">
            <FlaskConical className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">RM Lab Results</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Logs of all completed laboratory quality inspection checks.</p>
          </div>
        </div>

        {/* Filters and Search Bar Area */}
        <div className="flex flex-col md:flex-row justify-between gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 rounded-2xl shadow-sm">
          <div className="flex rounded-xl p-1 bg-slate-100 dark:bg-slate-950 border border-slate-200/50 dark:border-slate-800 w-full md:w-auto overflow-x-auto scrollbar-none gap-0.5">
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
              placeholder="Search reference, material, code, supplier..." 
              value={search} 
              onChange={e => setSearch(e.target.value)} 
              className="pl-9 pr-8 h-9 text-xs w-full bg-white dark:bg-slate-950 rounded-xl border-slate-200 dark:border-slate-800 focus:ring-2 focus:ring-indigo-500/20" 
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
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
            text: 'text-slate-600 dark:text-slate-300' 
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
            bg: 'bg-rose-50 dark:bg-rose-950/20', 
            text: 'text-rose-600 dark:text-rose-400' 
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
            <FlaskConical className="w-10 h-10 text-slate-300 mx-auto mb-2 opacity-50" />
            <p className="text-slate-500 dark:text-slate-400 font-bold text-sm">No lab results found</p>
          </div>
        ) : (
          paginatedLabTests.map((lt) => {
            const materials = getMaterialsForLabTest(lt);

            return (
              <div key={lt.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm space-y-3 hover:shadow transition-shadow relative overflow-hidden">
                <div className={`absolute top-0 left-0 right-0 h-1 ${
                  lt.overallDecision === 'APPROVED' ? 'bg-emerald-500' :
                  lt.overallDecision === 'REJECTED' ? 'bg-rose-500' : 'bg-amber-500'
                }`} />

                <div className="flex justify-between items-start">
                  <div className="space-y-0.5">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">GRN Ref</span>
                    <div className="font-mono font-bold text-violet-600 dark:text-violet-400 text-xs">{lt.grn?.referenceNo}</div>
                  </div>
                  <DecisionBadge decision={lt.overallDecision} />
                </div>

                <div className="grid grid-cols-2 gap-y-2.5 gap-x-2 text-[11px] border-t border-b border-slate-100 dark:border-slate-800 py-2.5">
                  <div className="col-span-2">
                    <span className="text-slate-400 block font-semibold mb-1">
                      Materials / Items ({materials.length})
                    </span>
                    <MaterialsCell materials={materials} grnId={lt.grnId} />
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
                    <span className="text-slate-700 dark:text-slate-300 block font-bold">{lt.tester?.name || '-'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-semibold">Test Date</span>
                    <span className="text-slate-700 dark:text-slate-300 block font-bold">
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
                    className="bg-indigo-50/80 hover:bg-indigo-100 dark:bg-indigo-950/20 dark:hover:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-xl px-3.5 py-1.5 h-8 text-xs font-bold flex items-center gap-1 border border-transparent shadow-none"
                  >
                    View Report <ArrowUpRight className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Desktop table view (visible only on screens md and larger) */}
      <div className="hidden md:block bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 font-bold border-b border-slate-200 dark:border-slate-800 uppercase tracking-widest text-[9px]">
              <tr>
                <th className="px-4 py-3.5 font-bold w-10 text-center">#</th>
                <th className="px-4 py-3.5 font-bold">GRN Ref</th>
                <th className="px-4 py-3.5 font-bold">PO Ref</th>
                <th className="px-4 py-3.5 font-bold min-w-[200px] max-w-[280px]">Material / Items</th>
                <th className="px-4 py-3.5 font-bold">Supplier</th>
                <th className="px-4 py-3.5 font-bold">Tested By</th>
                <th className="px-4 py-3.5 font-bold">Test Date</th>
                <th className="px-4 py-3.5 font-bold text-center">Parameters</th>
                <th className="px-4 py-3.5 font-bold text-center">Decision</th>
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
                    <FlaskConical className="w-8 h-8 text-slate-300 mx-auto mb-2 opacity-50" />
                    <p className="text-slate-500 dark:text-slate-400 font-bold text-sm">No lab results found</p>
                  </td>
                </tr>
              ) : (
                paginatedLabTests.map((lt, idx) => {
                  const materials = getMaterialsForLabTest(lt);

                  return (
                    <tr key={lt.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors border-b border-slate-100 dark:border-slate-800/80">
                      <td className="px-4 py-2.5 text-center text-slate-400 font-mono">{(currentPage - 1) * ITEMS_PER_PAGE + idx + 1}</td>
                      <td className="px-4 py-2.5 font-mono font-bold text-violet-600 dark:text-violet-400">{lt.grn?.referenceNo}</td>
                      <td className="px-4 py-2.5 font-mono text-indigo-600 dark:text-indigo-400 font-semibold">{lt.grn?.po?.referenceNo}</td>
                      <td className="px-4 py-2.5 max-w-[280px]">
                        <MaterialsCell materials={materials} grnId={lt.grnId} />
                      </td>
                      <td className="px-4 py-2.5 text-slate-700 dark:text-slate-300 font-bold truncate max-w-[150px]">{lt.grn?.po?.supplier?.name || '-'}</td>
                      <td className="px-4 py-2.5 text-slate-600 dark:text-slate-400 font-semibold">{lt.tester?.name || '-'}</td>
                      <td className="px-4 py-2.5 text-slate-600 dark:text-slate-400 font-medium whitespace-nowrap">
                        {lt.createdAt ? format(new Date(lt.createdAt), 'dd MMM yyyy HH:mm') : '-'}
                      </td>
                      <td className="px-4 py-2.5 text-center font-bold text-slate-700 dark:text-slate-300">{lt.testResults?.length || 0}</td>
                      <td className="px-4 py-2.5 text-center"><DecisionBadge decision={lt.overallDecision} /></td>
                      <td className="px-4 py-2.5 text-center">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => navigate(`/grn/view/${lt.grnId}`)} 
                          className="h-8 w-8 rounded-xl text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors shadow-none"
                          title="View Full Quality Report"
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer info & Pagination Controls */}
        <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/40 flex flex-col sm:flex-row justify-between items-center gap-3">
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

          <div className="text-[10px] text-slate-400 font-bold order-3">
            Matched Filters: {filtered.length} entries
          </div>
        </div>
      </div>
    </div>
  );
}
