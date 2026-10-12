import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '@/lib/axios';
import { 
  RotateCw, Plus, Search, Filter, RefreshCw, CheckCircle2, 
  Layers, Clock, AlertCircle, Sparkles, Tag, ArrowRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Swal from 'sweetalert2';

export default function StockUpdateProductionListPage() {
  const navigate = useNavigate();
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const fetchBatches = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ type: 'STOCK_UPDATE' });
      if (statusFilter !== 'ALL') params.append('status', statusFilter);
      if (search) params.append('search', search);

      const res = await api.get(`/production/batches-redesign?${params.toString()}`);
      setBatches(res.data?.batches || []);
    } catch (err) {
      console.error('Failed to load stock update production batches', err);
      try {
        const legacyRes = await api.get('/production?status=all');
        const list = legacyRes.data?.batches || [];
        setBatches(list.filter(b => b.productionType === 'Stock Adjustment' || b.productionType === 'STOCK_UPDATE'));
      } catch (e) {
        Swal.fire({ title: 'Error', text: 'Failed to load batches.', icon: 'error' });
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBatches();
  }, [statusFilter]);

  const filteredBatches = useMemo(() => {
    if (!search) return batches;
    return batches.filter(b => 
      b.referenceNo?.toLowerCase().includes(search.toLowerCase()) ||
      b.adjustmentReason?.toLowerCase().includes(search.toLowerCase()) ||
      b.adjustmentReference?.toLowerCase().includes(search.toLowerCase()) ||
      b.product?.name?.toLowerCase().includes(search.toLowerCase())
    );
  }, [batches, search]);

  const formatCurrency = (val) => {
    return Number(val || 0).toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      
      {/* ── HEADER ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400">
              <RotateCw className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                Stock Update Production
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                Opening balances, floor inventory corrections & immediate stock-in adjustments with RM consumption
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={fetchBatches} 
            disabled={loading}
            className="rounded-xl border-slate-200 dark:border-slate-800 h-9"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>

          <Button 
            onClick={() => navigate('/production/stock-update/add')}
            className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-9 shadow-sm"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            + Add Stock Update Entry
          </Button>
        </div>
      </div>

      {/* ── METRIC CARDS ── */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Adjustment Batches</p>
          <h3 className="text-2xl font-black text-slate-900 dark:text-white mt-1">{batches.length}</h3>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Posted / Approved</p>
          <h3 className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
            {batches.filter(b => b.status === 'Completed' || b.status === 'Approved').length}
          </h3>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Draft / Pending</p>
          <h3 className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">
            {batches.filter(b => b.status === 'Planned' || b.status === 'Draft').length}
          </h3>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Adjusted Inventory Cost</p>
          <h3 className="text-2xl font-black text-indigo-600 dark:text-indigo-400 mt-1">
            ₹{formatCurrency(batches.reduce((s, b) => s + (b.totalCost || 0), 0))}
          </h3>
        </div>
      </div>

      {/* ── FILTERS ── */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input 
            placeholder="Search reason, reference #, batch #..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 rounded-xl border-slate-200 dark:border-slate-800"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="w-4 h-4 text-slate-400 shrink-0" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-9 px-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="ALL">All Status</option>
            <option value="Planned">Draft / Planned</option>
            <option value="Completed">Posted / Completed</option>
          </select>
        </div>
      </div>

      {/* ── BATCH LIST TABLE ── */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs sm:text-sm">
            <thead>
              <tr className="bg-slate-50/75 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                <th className="py-3.5 px-4">Batch No</th>
                <th className="py-3.5 px-4">Adjustment Reason</th>
                <th className="py-3.5 px-4">Reference Doc</th>
                <th className="py-3.5 px-4">Adjusted Product</th>
                <th className="py-3.5 px-4 text-center">Produced Qty</th>
                <th className="py-3.5 px-4 text-center">Status</th>
                <th className="py-3.5 px-4 text-right">Adjustment Valuation</th>
                <th className="py-3.5 px-4 text-right">Unit Rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-500" />
                    Loading stock update entries...
                  </td>
                </tr>
              ) : filteredBatches.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    No stock update production entries found.
                  </td>
                </tr>
              ) : (
                filteredBatches.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-black text-indigo-600 dark:text-indigo-400">
                      {b.referenceNo || b.batchNo}
                    </td>
                    <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white">
                      <span className="px-2 py-0.5 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 font-mono text-xs">
                        {b.adjustmentReason || 'Manual Inventory Adjustment'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-600 dark:text-slate-400">
                      {b.adjustmentReference || '—'}
                    </td>
                    <td className="py-3.5 px-4 font-extrabold text-slate-900 dark:text-white">
                      {b.product?.name || 'Finished Product'}
                    </td>
                    <td className="py-3.5 px-4 text-center font-mono font-black text-slate-800 dark:text-slate-200">
                      {b.quantity} {b.product?.unit?.abbreviation || 'Nos'}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        b.status === 'Completed' || b.status === 'Approved'
                          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                          : 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800'
                      }`}>
                        {b.status === 'Completed' || b.status === 'Approved' ? 'POSTED' : b.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-black text-slate-900 dark:text-white">
                      ₹{formatCurrency(b.totalCost)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      ₹{formatCurrency(b.costPerUnit || (b.quantity > 0 ? b.totalCost / b.quantity : 0))}
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
