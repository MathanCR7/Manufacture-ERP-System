import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/axios';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import {
  FlaskConical, Package, Search, ChevronRight, Clock, User,
  AlertTriangle, RefreshCw, Truck, Calendar, Filter, Eye
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';

export default function PendingLabTestsPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('');

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

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-violet-100 dark:bg-violet-500/20 rounded-xl">
            <FlaskConical className="w-6 h-6 text-violet-600 dark:text-violet-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Pending RM Lab Tests</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {pending.length} GRN(s) awaiting lab testing
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2">
          <RefreshCw className="w-4 h-4" /> Refresh
        </Button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { icon: Clock, label: 'Total Pending', value: pending.length, color: 'violet' },
          { icon: AlertTriangle, label: 'Urgent (>24h)', value: pending.filter(isUrgent).length, color: 'red' },
          { icon: Package, label: 'Materials Count', value: pending.reduce((s, g) => s + (g.items?.length || 0), 0), color: 'blue' },
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

      {/* Search */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <Input
          placeholder="Search by GRN ref, material, supplier, PO..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9 h-10"
        />
      </div>

      {/* Cards */}
      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
              <Skeleton className="h-5 w-48 mb-3" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4 mt-2" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
          <FlaskConical className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">
            {search ? 'No matching lab tests found' : 'No pending lab tests'}
          </p>
          <p className="text-sm text-slate-400 mt-1">
            {!search && 'When GRNs are filed, they appear here awaiting lab testing.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map(grn => {
            const urgent = isUrgent(grn);
            const totalReceived = grn.items?.reduce((s, i) => s + Number(i.actualReceivedQty || 0), 0) || 0;

            return (
              <div
                key={grn.id}
                className={`bg-white dark:bg-slate-900 rounded-xl border overflow-hidden shadow-sm hover:shadow-md transition-all duration-200 ${
                  urgent
                    ? 'border-red-200 dark:border-red-500/30'
                    : 'border-slate-200 dark:border-slate-700'
                }`}
              >
                {/* Top bar */}
                <div className={`px-5 py-3 flex items-center justify-between ${
                  urgent
                    ? 'bg-red-50 dark:bg-red-500/10 border-b border-red-100 dark:border-red-500/20'
                    : 'bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800'
                }`}>
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400 text-sm">{grn.referenceNo}</span>
                    {urgent && (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 dark:text-red-400">
                        <AlertTriangle className="w-3 h-3" /> Urgent
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400 font-medium">
                      <Clock className="w-3 h-3" /> Pending Lab
                    </span>
                  </div>
                  <span className="text-xs text-slate-400">
                    {grn.createdAt ? format(new Date(grn.createdAt), 'dd MMM yyyy HH:mm') : '—'}
                  </span>
                </div>

                {/* Body */}
                <div className="p-5">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <div>
                      <p className="text-xs text-slate-400 mb-0.5">PO Reference</p>
                      <p className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">{grn.po?.referenceNo || '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400 mb-0.5">Raw Material</p>
                      <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{grn.po?.name || '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400 mb-0.5">Supplier</p>
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{grn.po?.supplier?.name || '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400 mb-0.5">Received Qty</p>
                      <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
                        {totalReceived.toLocaleString()} <span className="text-xs font-normal text-slate-400">{grn.po?.uom?.abbreviation || ''}</span>
                      </p>
                    </div>
                  </div>

                  {/* Items */}
                  <div className="space-y-2 mb-4">
                    {grn.items?.map(item => (
                      <div key={item.id} className="flex items-center justify-between text-xs p-2.5 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-slate-800">
                        <div className="flex items-center gap-2">
                          <Package className="w-3.5 h-3.5 text-slate-400" />
                          <span className="font-medium text-slate-700 dark:text-slate-300">{item.rmName}</span>
                          <span className="text-slate-400 font-mono text-xs">{item.rmId}</span>
                        </div>
                        <div className="flex items-center gap-4 text-slate-500">
                          <span>Expected: {Number(item.expectedQty).toLocaleString()}</span>
                          <span className="font-semibold text-slate-800 dark:text-slate-200">
                            Received: {Number(item.actualReceivedQty).toLocaleString()}
                          </span>
                          {Number(item.returnQty) > 0 && (
                            <span className="text-red-500">Return: {Number(item.returnQty).toLocaleString()}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Info row */}
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <div className="flex items-center gap-4 text-xs text-slate-400">
                      <span className="flex items-center gap-1">
                        <User className="w-3.5 h-3.5" />
                        {grn.receiver?.name || 'Unknown receiver'}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        Received: {grn.receivedDate ? format(new Date(grn.receivedDate), 'dd MMM yyyy') : '—'}
                      </span>
                      {grn.amountPaid != null && (
                        <span>Paid: ₹{Number(grn.amountPaid).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/grn/view/${grn.id}`)}
                        className="h-8 px-3 text-xs gap-1.5"
                      >
                        <Eye className="w-3.5 h-3.5" /> View GRN
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => navigate(`/lab/test/${grn.id}`)}
                        className="h-8 px-4 text-xs gap-1.5 bg-violet-600 hover:bg-violet-700 text-white"
                      >
                        <FlaskConical className="w-3.5 h-3.5" />
                        Enter Lab Results
                        <ChevronRight className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
