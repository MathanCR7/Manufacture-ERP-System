import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '@/lib/axios';
import { 
  Package, Plus, Search, Filter, RefreshCw, ShoppingBag, 
  Calendar, CheckCircle2, Clock, AlertCircle, ArrowRight, User,
  Eye, Play, FlaskConical, X, Check
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Swal from 'sweetalert2';
import BatchCompletionModal from '../components/BatchCompletionModal';
import ProductionBatchDetailModal from '../components/ProductionBatchDetailModal';

export default function OrderBasedProductionListPage() {
  const navigate = useNavigate();
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Modal states
  const [completionModalOpen, setCompletionModalOpen] = useState(false);
  const [batchToComplete, setBatchToComplete] = useState(null);
  const [completing, setCompleting] = useState(false);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [selectedViewBatchId, setSelectedViewBatchId] = useState(null);

  const fetchBatches = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ type: 'ORDER_BASED' });
      if (statusFilter !== 'ALL') params.append('status', statusFilter);
      const res = await api.get(`/production/batches-redesign?${params.toString()}`);
      setBatches(res.data?.batches || []);
    } catch (err) {
      console.error('Failed to fetch order-based batches:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBatches();
  }, [statusFilter]);

  const handleStartBatch = async (batch) => {
    try {
      await api.patch(`/production/batches-redesign/${batch.id}/status`, {
        status: 'In Progress'
      });
      Swal.fire({
        title: 'Floor Production Started',
        text: `Batch #${batch.referenceNo} is now marked 'In Progress'.`,
        icon: 'success',
        timer: 1500,
        showConfirmButton: false
      });
      fetchBatches();
    } catch (err) {
      Swal.fire({
        title: 'Error',
        text: err.response?.data?.error || 'Failed to start batch.',
        icon: 'error'
      });
    }
  };

  const handleOpenCompleteModal = (batch) => {
    setBatchToComplete(batch);
    setCompletionModalOpen(true);
  };

  const handleSubmitCompletion = async (batchId, payload) => {
    try {
      setCompleting(true);
      await api.patch(`/production/batches-redesign/${batchId}/status`, {
        status: payload.labTestRequired ? 'Lab Test In Progress' : 'Completed',
        actualOutput: payload.actualOutput,
        labTestRequired: payload.labTestRequired,
        rmUsages: payload.rmUsages,
        note: payload.note,
        rejectedQty: payload.rejectedQty,
        scrapQty: payload.scrapQty,
        scrapReason: payload.scrapReason,
        ebStartReading: payload.ebStartReading,
        ebEndReading: payload.ebEndReading,
        ebUnitsKwh: payload.ebUnitsKwh,
        ebRatePerUnit: payload.ebRatePerUnit
      });

      setCompletionModalOpen(false);
      setBatchToComplete(null);

      if (payload.labTestRequired) {
        Swal.fire({
          title: 'Dispatched to QC Queue!',
          html: `
            <div style="text-align: left; font-size: 13px; line-height: 1.5;">
              <p><strong>🔬 Lab Test Required:</strong> Batch sent to QC Queue with status <strong>'Lab Test In Progress'</strong>.</p>
              <p><strong>📦 Finished Goods Stock:</strong> Held in Quarantine (0 sellable stock credited until Lab approval).</p>
              <p><strong>🌿 Raw Materials:</strong> Consumed ingredients deducted from inventory.</p>
            </div>
          `,
          icon: 'info'
        });
      } else {
        Swal.fire({
          title: 'Production Completed (Lab Exempt)!',
          html: `
            <div style="text-align: left; font-size: 13px; line-height: 1.5;">
              <p><strong>✓ Actual Yield:</strong> ${payload.actualOutput} units directly added to Available Finished Goods stock.</p>
              <p><strong>✓ RM Stock Deducted:</strong> Ingredients deducted from raw material inventory lots.</p>
              <p><strong>✓ Sales Order Reserved:</strong> Stock is allocated to linked sales order.</p>
            </div>
          `,
          icon: 'success'
        });
      }
      fetchBatches();
    } catch (err) {
      console.error('Batch completion error:', err);
      Swal.fire({
        title: 'Error',
        text: err.response?.data?.error || 'Failed to complete production batch.',
        icon: 'error'
      });
    } finally {
      setCompleting(false);
    }
  };

  const filteredBatches = useMemo(() => {
    if (!search) return batches;
    return batches.filter(b => 
      b.referenceNo?.toLowerCase().includes(search.toLowerCase()) ||
      b.batchNo?.toLowerCase().includes(search.toLowerCase()) ||
      b.product?.name?.toLowerCase().includes(search.toLowerCase()) ||
      b.order?.referenceNo?.toLowerCase().includes(search.toLowerCase()) ||
      b.order?.customer?.name?.toLowerCase().includes(search.toLowerCase())
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
              <ShoppingBag className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                Order-Based Production
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                Production batches strictly reserved against Customer Sales Orders with delivery tracking
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
            className="rounded-xl border-slate-200 dark:border-slate-800 h-9 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>

          <Button 
            onClick={() => navigate('/production/order-based/add')}
            className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-9 shadow-sm cursor-pointer"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            + Add Order Based Production
          </Button>
        </div>
      </div>

      {/* ── METRIC CARDS ── */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Linked Order Batches</p>
          <h3 className="text-2xl font-black text-slate-900 dark:text-white mt-1">{batches.length}</h3>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">In Production</p>
          <h3 className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">
            {batches.filter(b => b.status === 'In Progress').length}
          </h3>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Fulfilled / Completed</p>
          <h3 className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
            {batches.filter(b => b.status === 'Completed' || b.status === 'qc_passed').length}
          </h3>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Reserved Production Cost</p>
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
            placeholder="Search by batch, order ref or customer..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 rounded-xl text-xs h-9"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          {['ALL', 'Planned', 'In Progress', 'Lab Test In Progress', 'Completed'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                statusFilter === st
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* ── BATCHES TABLE ── */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-950/60 border-b border-slate-200/80 dark:border-slate-800 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="py-3 px-4">Batch / MP No</th>
                <th className="py-3 px-4">Linked Order</th>
                <th className="py-3 px-4">Customer & Due</th>
                <th className="py-3 px-4">Finished Product</th>
                <th className="py-3 px-4 text-center">Batch Qty</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Batch Cost</th>
                <th className="py-3 px-4 text-right">Cost/Unit</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-500" />
                    Loading order-based production batches...
                  </td>
                </tr>
              ) : filteredBatches.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    No order-based production batches found matching criteria.
                  </td>
                </tr>
              ) : (
                filteredBatches.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-black text-indigo-600 dark:text-indigo-400">
                      {b.batchNo || b.referenceNo}
                    </td>
                    <td className="py-3.5 px-4">
                      {b.order ? (
                        <span className="font-mono font-bold text-slate-900 dark:text-white bg-indigo-50 dark:bg-indigo-950 px-2 py-0.5 rounded-lg border border-indigo-200 dark:border-indigo-800">
                          {b.order.referenceNo || b.order.docNo || 'Order'}
                        </span>
                      ) : (
                        <span className="text-slate-400 italic">No order linked</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="font-bold text-slate-900 dark:text-white block">
                        {b.order?.customer?.name || 'Customer'}
                      </span>
                      <span className="text-[10px] text-slate-400 block font-mono">
                        Due: {b.order?.deliveryDate ? new Date(b.order.deliveryDate).toLocaleDateString('en-GB') : 'N/A'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-extrabold text-slate-900 dark:text-white">
                      {b.product?.name || 'Finished Product'}
                    </td>
                    <td className="py-3.5 px-4 text-center font-mono font-black text-slate-800 dark:text-slate-200">
                      {b.quantity} {b.product?.unit?.abbreviation || 'Nos'}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black ${
                        b.status === 'Completed' || b.status === 'qc_passed'
                          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                          : b.status === 'Lab Test In Progress'
                          ? 'bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200 dark:border-purple-800 animate-pulse'
                          : b.status === 'In Progress'
                          ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                          : b.status === 'qc_failed'
                          ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                          : 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800'
                      }`}>
                        {b.status === 'Lab Test In Progress' ? '🔬 In QC Queue' : b.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-black text-slate-900 dark:text-white">
                      ₹{formatCurrency(b.totalCost)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      ₹{formatCurrency(b.costPerUnit || (b.quantity > 0 ? b.totalCost / b.quantity : 0))}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedViewBatchId(b.id);
                            setViewModalOpen(true);
                          }}
                          className="rounded-xl border-slate-200 dark:border-slate-800 hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold h-8 px-2.5 cursor-pointer flex items-center gap-1 shadow-3xs"
                          title="View complete batch details & formulation"
                        >
                          <Eye className="w-3.5 h-3.5 text-indigo-500" />
                          View
                        </Button>

                        {(b.status === 'Planned' || b.status === 'Draft') && (
                          <Button
                            size="sm"
                            onClick={() => handleStartBatch(b)}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold h-8 px-3 cursor-pointer flex items-center gap-1 shadow-2xs"
                          >
                            <Play className="w-3 h-3 fill-current" />
                            Start
                          </Button>
                        )}

                        {b.status === 'In Progress' && (
                          <Button
                            size="sm"
                            onClick={() => handleOpenCompleteModal(b)}
                            className="bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold h-8 px-3 cursor-pointer flex items-center gap-1 shadow-2xs"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Complete & Yield
                          </Button>
                        )}

                        {b.status === 'Lab Test In Progress' && (
                          <span className="text-[10px] font-bold text-purple-600 bg-purple-50 dark:bg-purple-950/60 px-2 py-0.5 rounded-full border border-purple-200">
                            Quarantined (In QC)
                          </span>
                        )}

                        {(b.status === 'Completed' || b.status === 'qc_passed') && (
                          <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
                            <Check className="w-3 h-3" />
                            Fulfilled
                          </span>
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

      {/* ── BATCH COMPLETION MODAL ── */}
      <BatchCompletionModal
        isOpen={completionModalOpen}
        onClose={() => {
          setCompletionModalOpen(false);
          setBatchToComplete(null);
        }}
        batch={batchToComplete}
        onSubmit={handleSubmitCompletion}
        submitting={completing}
      />

      {/* ── PRODUCTION BATCH DETAIL MODAL ── */}
      <ProductionBatchDetailModal
        isOpen={viewModalOpen}
        onClose={() => {
          setViewModalOpen(false);
          setSelectedViewBatchId(null);
        }}
        batchId={selectedViewBatchId}
        onStatusUpdated={fetchBatches}
        onOpenCompleteModal={handleOpenCompleteModal}
        canViewCosting={true}
      />

    </div>
  );
}
