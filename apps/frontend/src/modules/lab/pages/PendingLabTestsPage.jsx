import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/axios';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import {
  FlaskConical, Package, Search, ChevronRight, Clock, User,
  AlertTriangle, RefreshCw, Calendar, Eye
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Pagination } from '@/components/ui/Pagination';
import useAuthStore from '@/app/store/authStore';

export default function PendingLabTestsPage() {
  const user = useAuthStore((state) => state.user);
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 5;

  const { data: pending = [], isLoading, refetch } = useQuery({
    queryKey: ['pending-lab-tests'],
    queryFn: async () => {
      const res = await api.get('/grn/lab-tests');
      return res.data;
    },
    refetchInterval: 30000,
  });

  // Fetch RM Lab Categories for filter/display
  const { data: rmLabCategories = [] } = useQuery({
    queryKey: ['rm-lab-categories'],
    queryFn: () => api.get('/rm-lab-category').then(r => r.data),
  });

  // Reset pagination to page 1 on search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [search]);

  const filtered = pending.filter(grn => {
    const term = search.toLowerCase();
    const matchSearch =
      grn.referenceNo?.toLowerCase().includes(term) ||
      grn.po?.name?.toLowerCase().includes(term) ||
      grn.po?.referenceNo?.toLowerCase().includes(term) ||
      grn.po?.supplier?.name?.toLowerCase().includes(term);
    return matchSearch;
  });

  // Calculate urgency: flag GRNs older than 24h
  const now = Date.now();
  const isUrgent = grn => (now - new Date(grn.createdAt).getTime()) > 24 * 60 * 60 * 1000;

  // Pagination logic
  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginatedPending = filtered.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  return (
    <div className="w-full max-w-full px-4 sm:px-6 lg:px-8 py-5 space-y-4 mx-auto transition-all duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-violet-100 dark:bg-violet-500/20 rounded-xl">
            <FlaskConical className="w-5 h-5 text-violet-650 dark:text-violet-400" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Pending RM Lab Tests</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {pending.length} GRN(s) awaiting lab testing & approval
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} className="w-full sm:w-auto gap-1.5 rounded-xl h-8 text-xs border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300">
          <RefreshCw className="w-3.5 h-3.5 animate-spin-hover" /> Refresh
        </Button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { icon: Clock, label: 'Total Pending', value: pending.length, color: 'violet', bgClass: 'bg-violet-50/80 dark:bg-violet-950/20', textClass: 'text-violet-600 dark:text-violet-400' },
          { icon: AlertTriangle, label: 'Urgent (>24h)', value: pending.filter(isUrgent).length, color: 'red', bgClass: 'bg-rose-50/80 dark:bg-rose-955/20', textClass: 'text-rose-600 dark:text-rose-455' },
          { icon: Package, label: 'Materials Count', value: pending.reduce((s, g) => s + (g.items?.length || 0), 0), color: 'blue', bgClass: 'bg-blue-50/80 dark:bg-blue-955/20', textClass: 'text-blue-600 dark:text-blue-455' },
        ].map(({ icon: Icon, label, value, bgClass, textClass }) => (
          <div key={label} className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/60 rounded-xl p-3.5 flex items-center gap-3.5 shadow-sm hover:shadow transition-all duration-205">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${bgClass} ${textClass} shrink-0 shadow-inner`}>
              <Icon className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[9px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest">{label}</p>
              <p className="text-lg font-black text-slate-900 dark:text-white mt-0.5 tracking-tight">{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Search Filter Toolbar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-205 dark:border-slate-800 p-3 rounded-2xl shadow-sm relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-6 top-1/2 -translate-y-1/2" />
        <Input
          placeholder="Search by GRN reference number, raw material, supplier, or PO..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-10 h-9 text-xs w-full bg-white dark:bg-slate-950 rounded-xl border-slate-200 dark:border-slate-800 focus:ring-2 focus:ring-indigo-550/20"
        />
      </div>

      {/* Cards List Layout */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-3">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-3 w-3/4" />
            </div>
          ))}
        </div>
      ) : paginatedPending.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl">
          <FlaskConical className="w-10 h-10 text-slate-300 mx-auto mb-2 opacity-50" />
          <p className="text-slate-550 font-bold text-sm">
            {search ? 'No matching pending lab tests found' : 'All clear! No pending lab tests'}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            {!search && 'When GRNs are registered, they will appear here automatically.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {paginatedPending.map(grn => {
            const urgent = isUrgent(grn);
            const totalReceived = grn.items?.reduce((s, i) => s + Number(i.actualReceivedQty || 0), 0) || 0;

            return (
              <div
                key={grn.id}
                className={`bg-white dark:bg-slate-900 rounded-2xl border overflow-hidden shadow-sm hover:shadow transition-all duration-200 ${
                  urgent
                    ? 'border-red-200 dark:border-red-500/30'
                    : 'border-slate-200/80 dark:border-slate-800'
                }`}
              >
                {/* Card Title Bar */}
                <div className={`px-4 py-2.5 flex items-center justify-between ${
                  urgent
                    ? 'bg-rose-500/10 border-b border-rose-500/20'
                    : 'bg-slate-50/60 dark:bg-slate-800/60 border-b border-slate-100 dark:border-slate-800'
                }`}>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono font-bold text-indigo-650 dark:text-indigo-400 text-xs">{grn.referenceNo}</span>
                    {urgent && (
                      <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-rose-600 dark:text-rose-400 bg-rose-500/10 px-1.5 py-0.2 rounded">
                        <AlertTriangle className="w-2.5 h-2.5" /> Urgent
                      </span>
                    )}
                    <span className="inline-flex items-center gap-0.5 text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold border border-amber-500/20">
                      <Clock className="w-2.5 h-2.5" /> Pending Lab
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-semibold">
                    Received: {grn.createdAt ? format(new Date(grn.createdAt), 'dd MMM yyyy HH:mm') : '—'}
                  </span>
                </div>

                {/* Card Content Body */}
                <div className="p-4 space-y-3.5">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                    <div>
                      <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-0.5">PO Ref</p>
                      <p className="font-semibold text-indigo-650 dark:text-indigo-400">{grn.po?.referenceNo || '—'}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-0.5">Raw Material</p>
                      <p className="font-semibold text-slate-900 dark:text-slate-100">{grn.po?.name || '—'}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-0.5">Supplier</p>
                      <p className="font-medium text-slate-700 dark:text-slate-300 truncate">{grn.po?.supplier?.name || '—'}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-0.5">Total Qty</p>
                      <p className="font-bold text-slate-900 dark:text-slate-100">
                        {totalReceived.toFixed(2)} <span className="text-[10px] font-normal text-slate-450">{grn.po?.uom?.abbreviation || ''}</span>
                      </p>
                    </div>
                  </div>

                  {/* Sub items List */}
                  <div className="space-y-1.5">
                    {grn.items?.map(item => (
                      <div key={item.id} className="flex items-center justify-between text-[11px] p-2 bg-slate-50 dark:bg-slate-800/30 rounded-lg border border-slate-100 dark:border-slate-800">
                        <div className="flex items-center gap-2">
                          <Package className="w-3.5 h-3.5 text-slate-400" />
                          <span className="font-bold text-slate-750 dark:text-slate-350">{item.rmName}</span>
                          <span className="text-slate-400 font-mono text-[10px]">{item.rmId}</span>
                        </div>
                        <div className="flex items-center gap-3 text-slate-500 font-medium">
                          <span>Expected: {Number(item.expectedQty).toFixed(2)}</span>
                          <span className="font-bold text-slate-750 dark:text-slate-250">
                            Recv: {Number(item.actualReceivedQty).toFixed(2)}
                          </span>
                          {Number(item.returnQty) > 0 && (
                            <span className="text-rose-500 font-bold">Ret: {Number(item.returnQty).toFixed(2)}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Actions & Creator User details */}
                  <div className="flex items-center justify-between flex-wrap gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-3 text-[10px] text-slate-400 font-semibold">
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3" />
                        {grn.receiver?.name || 'Unknown Receiver'}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {grn.receivedDate ? format(new Date(grn.receivedDate), 'dd MMM yyyy') : '—'}
                      </span>
                      {grn.amountPaid != null && (
                        <span>Paid: ₹{Number(grn.amountPaid).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-1.5 w-full sm:w-auto justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/grn/view/${grn.id}`)}
                        className="h-8 text-xs gap-1 rounded-xl"
                      >
                        <Eye className="w-3.5 h-3.5" /> View GRN
                      </Button>
                      {['MAIN_MASTER', 'LAB_ASSISTANT'].includes(user?.role) && (
                        <Button
                          size="sm"
                          onClick={() => navigate(`/lab/test/${grn.id}`)}
                          className="h-8 text-xs gap-1 bg-violet-600 hover:bg-violet-700 text-white rounded-xl active:scale-[0.98] transition-all font-semibold"
                        >
                          <FlaskConical className="w-3.5 h-3.5" />
                          Record Lab Results
                          <ChevronRight className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination Footer block */}
      {totalPages > 1 && (
        <div className="pt-2 flex justify-between items-center border-t border-slate-200 dark:border-slate-800 flex-col sm:flex-row gap-3">
          <p className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold">
            Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, filtered.length)} of {filtered.length} pending tests
          </p>
          <Pagination 
            currentPage={currentPage} 
            totalPages={totalPages} 
            onPageChange={setCurrentPage} 
          />
        </div>
      )}
    </div>
  );
}
