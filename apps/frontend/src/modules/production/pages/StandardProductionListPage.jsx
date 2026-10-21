import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '@/lib/axios';
import { 
  Factory, Plus, Search, Filter, RefreshCw, Eye, CheckCircle2, 
  Clock, AlertCircle, Play, Sparkles, Database, FileText, ChevronRight,
  Package, Check, Layers, Lock, FlaskConical, X, ArrowUpDown, ArrowUp, ArrowDown,
  RotateCcw, ChevronDown, Printer, Tag
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Pagination } from '@/components/ui/Pagination';
import BatchCompletionModal from '../components/BatchCompletionModal';
import ProductionBatchDetailModal from '../components/ProductionBatchDetailModal';
import BatchLabelModal from '../components/BatchLabelModal';
import { analyzeProductionBatchNumber } from '../utils/batchNumberUtil';
import useAuthStore from '@/app/store/authStore';
import Swal from 'sweetalert2';

export default function StandardProductionListPage() {
  const navigate = useNavigate();
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);

  // View Details Modal State
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [selectedViewBatchId, setSelectedViewBatchId] = useState(null);

  // GS1 Label Modal State
  const [labelModalOpen, setLabelModalOpen] = useState(false);
  const [selectedLabelBatch, setSelectedLabelBatch] = useState(null);
  
  // Role visibility (hide amounts for production role, allow admin to see all)
  const currentUser = useAuthStore(s => s.user);
  const isProductionRole = useMemo(() => {
    if (!currentUser) return false;
    const role = (currentUser.role || '').toUpperCase();
    const email = (currentUser.email || '').toLowerCase();
    if (role === 'MAIN_MASTER' || role === 'ADMIN' || role === 'SUPERVISOR') return false;
    return role === 'PRODUCTION_STAFF' || role === 'OPERATOR' || role.includes('PRODUCTION') || email.includes('production');
  }, [currentUser]);
  const canViewCosting = !isProductionRole;

  // Batch Completion Modal State
  const [completionModalOpen, setCompletionModalOpen] = useState(false);
  const [batchToComplete, setBatchToComplete] = useState(null);
  const [completing, setCompleting] = useState(false);
  
  // Pro Filters & Search State matching /rm/stock
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [baseFilter, setBaseFilter] = useState('ALL');
  const [shiftFilter, setShiftFilter] = useState('ALL');

  // Sorting State - default date descending (latest first)
  const [sortBy, setSortBy] = useState('date_desc');

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const fetchBatches = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ type: 'STANDARD', limit: '200' });
      const res = await api.get(`/production/batches-redesign?${params.toString()}`);
      setBatches(res.data?.batches || []);
    } catch (err) {
      console.error('Failed to load standard production batches', err);
      try {
        const legacyRes = await api.get('/production?status=all');
        const list = legacyRes.data?.batches || [];
        setBatches(list.filter(b => b.productionType !== 'Make to Order' && b.productionType !== 'ORDER_BASED'));
      } catch (e) {
        Swal.fire({ title: 'Error', text: 'Failed to load batches.', icon: 'error' });
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBatches();
  }, []);

  // Distinct Base Masters for filter dropdown
  const baseOptions = useMemo(() => {
    const set = new Set();
    batches.forEach(b => {
      if (b.baseName) set.add(b.baseName);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [batches]);

  // Handle Starting a batch
  const handleStartBatch = async (batch) => {
    try {
      await api.patch(`/production/batches-redesign/${batch.id}/status`, { status: 'In Progress' });
      Swal.fire({
        title: 'Batch Started',
        text: `Batch #${batch.referenceNo || batch.batchNo} is now In Progress on the factory floor.`,
        icon: 'success',
        timer: 1500
      });
      fetchBatches();
    } catch (err) {
      console.error('Failed to start batch:', err);
      Swal.fire({ title: 'Error', text: 'Failed to start batch.', icon: 'error' });
    }
  };

  // Open Completion Modal
  const handleOpenCompleteModal = (batch) => {
    setBatchToComplete(batch);
    setCompletionModalOpen(true);
  };

  // Open GS1 Label Modal
  const handleOpenLabelModal = (batch) => {
    setSelectedLabelBatch(batch);
    setLabelModalOpen(true);
  };

  // Submit actual yield and complete batch
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
              <p><strong>✓ Ready for Dispatch:</strong> Stock is immediately sellable.</p>
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

  // ── FILTER & SORT MATCHING /rm/stock PATTERN ──
  const sortedAndFiltered = useMemo(() => {
    let result = batches.filter(b => {
      // 1. Text Search across referenceNo, batchNo, product name, baseName, templateName, shift, machineLine
      const term = searchTerm.toLowerCase().trim();
      if (term) {
        const matchesTerm = (
          (b.referenceNo || '').toLowerCase().includes(term) ||
          (b.batchNo || '').toLowerCase().includes(term) ||
          (b.product?.name || '').toLowerCase().includes(term) ||
          (b.baseName || '').toLowerCase().includes(term) ||
          (b.templateName || '').toLowerCase().includes(term) ||
          (b.shift || '').toLowerCase().includes(term) ||
          (b.machineLine || '').toLowerCase().includes(term) ||
          (b.status || '').toLowerCase().includes(term)
        );
        if (!matchesTerm) return false;
      }

      // 2. Status Filter
      if (statusFilter !== 'ALL') {
        if (statusFilter === 'PLANNED' || statusFilter === 'Planned') {
          if (b.status !== 'Planned' && b.status !== 'Draft' && b.status !== 'PLANNED') return false;
        } else if (statusFilter === 'IN_PROGRESS' || statusFilter === 'In Progress') {
          if (b.status !== 'In Progress') return false;
        } else if (statusFilter === 'COMPLETED' || statusFilter === 'Completed') {
          if (b.status !== 'Completed' && b.status !== 'qc_passed') return false;
        } else if (statusFilter === 'QC_QUEUE' || statusFilter === 'Lab Test In Progress') {
          if (b.status !== 'Lab Test In Progress') return false;
        } else if (statusFilter === 'PAUSED' || statusFilter === 'Paused') {
          if (b.status !== 'Paused') return false;
        } else if (statusFilter === 'CANCELLED' || statusFilter === 'Cancelled') {
          if (b.status !== 'Cancelled' && b.status !== 'qc_failed') return false;
        } else if (b.status !== statusFilter) {
          return false;
        }
      }

      // 3. Base Master Filter
      if (baseFilter !== 'ALL') {
        if ((b.baseName || 'Unassigned') !== baseFilter) return false;
      }

      // 4. Shift Filter
      if (shiftFilter !== 'ALL') {
        if ((b.shift || '').toLowerCase() !== shiftFilter.toLowerCase()) return false;
      }

      return true;
    });

    // Sort evaluation
    result.sort((a, b) => {
      // 1. Batch No Sort
      if (sortBy === 'batch_asc') {
        return (a.referenceNo || a.batchNo || '').localeCompare(b.referenceNo || b.batchNo || '', undefined, { numeric: true, sensitivity: 'base' });
      }
      if (sortBy === 'batch_desc') {
        return (b.referenceNo || b.batchNo || '').localeCompare(a.referenceNo || a.batchNo || '', undefined, { numeric: true, sensitivity: 'base' });
      }

      // 2. Date Sort
      if (sortBy === 'date_asc') {
        const timeA = a.startDate ? new Date(a.startDate).getTime() : 0;
        const timeB = b.startDate ? new Date(b.startDate).getTime() : 0;
        return timeA - timeB;
      }
      if (sortBy === 'date_desc') {
        const timeA = a.startDate ? new Date(a.startDate).getTime() : 0;
        const timeB = b.startDate ? new Date(b.startDate).getTime() : 0;
        return timeB - timeA;
      }

      // 3. Base & Template Sort
      if (sortBy === 'base_asc') {
        return (a.baseName || '').localeCompare(b.baseName || '', undefined, { sensitivity: 'base' });
      }
      if (sortBy === 'base_desc') {
        return (b.baseName || '').localeCompare(a.baseName || '', undefined, { sensitivity: 'base' });
      }

      // 4. Target Product Sort
      if (sortBy === 'product_asc') {
        return (a.product?.name || '').localeCompare(b.product?.name || '', undefined, { sensitivity: 'base' });
      }
      if (sortBy === 'product_desc') {
        return (b.product?.name || '').localeCompare(a.product?.name || '', undefined, { sensitivity: 'base' });
      }

      // 5. Planned Qty Sort
      if (sortBy === 'qty_desc') {
        return Number(b.quantity || 0) - Number(a.quantity || 0);
      }
      if (sortBy === 'qty_asc') {
        return Number(a.quantity || 0) - Number(b.quantity || 0);
      }

      // 6. Status Sort
      if (sortBy === 'status_asc') {
        return (a.status || '').localeCompare(b.status || '');
      }
      if (sortBy === 'status_desc') {
        return (b.status || '').localeCompare(a.status || '');
      }

      // 7. Grand Total Cost Sort
      if (sortBy === 'cost_desc') {
        return Number(b.totalCost || 0) - Number(a.totalCost || 0);
      }
      if (sortBy === 'cost_asc') {
        return Number(a.totalCost || 0) - Number(b.totalCost || 0);
      }

      // 8. Cost/Unit Sort
      if (sortBy === 'cost_unit_desc') {
        const unitCostA = a.costPerUnit || (a.quantity > 0 ? a.totalCost / a.quantity : 0);
        const unitCostB = b.costPerUnit || (b.quantity > 0 ? b.totalCost / b.quantity : 0);
        return Number(unitCostB || 0) - Number(unitCostA || 0);
      }
      if (sortBy === 'cost_unit_asc') {
        const unitCostA = a.costPerUnit || (a.quantity > 0 ? a.totalCost / a.quantity : 0);
        const unitCostB = b.costPerUnit || (b.quantity > 0 ? b.totalCost / b.quantity : 0);
        return Number(unitCostA || 0) - Number(unitCostB || 0);
      }

      return 0;
    });

    return result;
  }, [batches, searchTerm, statusFilter, baseFilter, shiftFilter, sortBy]);

  // Pagination calculation
  const totalPages = Math.ceil(sortedAndFiltered.length / itemsPerPage) || 1;
  const paginatedBatches = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return sortedAndFiltered.slice(startIndex, startIndex + itemsPerPage);
  }, [sortedAndFiltered, currentPage, itemsPerPage]);

  const handleResetFilters = () => {
    setSearchTerm('');
    setStatusFilter('ALL');
    setBaseFilter('ALL');
    setShiftFilter('ALL');
    setSortBy('date_desc');
    setCurrentPage(1);
  };

  // Toggle Column Sort Handlers
  const handleToggleSortBatch = () => {
    setSortBy(prev => prev === 'batch_asc' ? 'batch_desc' : 'batch_asc');
    setCurrentPage(1);
  };

  const handleToggleSortDate = () => {
    setSortBy(prev => prev === 'date_desc' ? 'date_asc' : 'date_desc');
    setCurrentPage(1);
  };

  const handleToggleSortBase = () => {
    setSortBy(prev => prev === 'base_asc' ? 'base_desc' : 'base_asc');
    setCurrentPage(1);
  };

  const handleToggleSortProduct = () => {
    setSortBy(prev => prev === 'product_asc' ? 'product_desc' : 'product_asc');
    setCurrentPage(1);
  };

  const handleToggleSortQty = () => {
    setSortBy(prev => prev === 'qty_desc' ? 'qty_asc' : 'qty_desc');
    setCurrentPage(1);
  };

  const handleToggleSortStatus = () => {
    setSortBy(prev => prev === 'status_asc' ? 'status_desc' : 'status_asc');
    setCurrentPage(1);
  };

  const handleToggleSortCost = () => {
    setSortBy(prev => prev === 'cost_desc' ? 'cost_asc' : 'cost_desc');
    setCurrentPage(1);
  };

  const handleToggleSortCostUnit = () => {
    setSortBy(prev => prev === 'cost_unit_desc' ? 'cost_unit_asc' : 'cost_unit_desc');
    setCurrentPage(1);
  };

  const formatCurrency = (val) => {
    return Number(val || 0).toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  return (
    <div className="w-full px-2 sm:px-4 lg:px-6 py-3.5 space-y-3.5">
      
      {/* ── HEADER ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-3xs">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 shrink-0">
              <Factory className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-tight">
                  Standard Production Management
                </h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                  Daily Shopfloor
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Planned routine manufacturing batches, capacity utilization & standard formula execution
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={fetchBatches} 
            disabled={loading}
            className="rounded-xl border-slate-200 dark:border-slate-800 h-8 text-xs font-bold cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>

          <Button 
            onClick={() => navigate('/production/standard/add')}
            className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-8 text-xs shadow-sm cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 mr-1" />
            + Add Standard Batch
          </Button>
        </div>
      </div>

      {/* ── METRIC CARDS (Full Width, Sleek & Modern) ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-3xs flex items-center justify-between">
          <div>
            <p className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider">Total Batches</p>
            <h3 className="text-2xl font-black text-slate-900 dark:text-white mt-0.5 font-mono">{batches.length}</h3>
          </div>
          <div className="w-10 h-10 rounded-2xl bg-slate-50 dark:bg-slate-800 text-slate-500 flex items-center justify-center">
            <Layers className="w-5 h-5 text-indigo-500" />
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-amber-200/80 dark:border-amber-900/40 shadow-3xs flex items-center justify-between">
          <div>
            <p className="text-[10.5px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              In Progress
            </p>
            <h3 className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-0.5 font-mono">
              {batches.filter(b => b.status === 'In Progress').length}
            </h3>
          </div>
          <div className="w-10 h-10 rounded-2xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 flex items-center justify-center">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-emerald-200/80 dark:border-emerald-900/40 shadow-3xs flex items-center justify-between">
          <div>
            <p className="text-[10.5px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Completed</p>
            <h3 className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-0.5 font-mono">
              {batches.filter(b => b.status === 'Completed' || b.status === 'qc_passed').length}
            </h3>
          </div>
          <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-indigo-200/80 dark:border-indigo-900/40 shadow-3xs flex items-center justify-between">
          <div>
            {canViewCosting ? (
              <>
                <p className="text-[10.5px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">Planned Total Cost</p>
                <h3 className="text-2xl font-black text-indigo-600 dark:text-indigo-400 mt-0.5 font-mono">
                  ₹{formatCurrency(batches.reduce((s, b) => s + (b.totalCost || 0), 0))}
                </h3>
              </>
            ) : (
              <>
                <p className="text-[10.5px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">Planned Total Units</p>
                <h3 className="text-2xl font-black text-indigo-600 dark:text-indigo-400 mt-0.5 font-mono">
                  {batches.reduce((s, b) => s + (Number(b.quantity) || 0), 0).toLocaleString()} Nos
                </h3>
              </>
            )}
          </div>
          <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 flex items-center justify-center">
            <Database className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* ── MAIN BATCH TABLE CARD MATCHING /rm/stock TOOLBAR & LAYOUT ── */}
      <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden flex flex-col text-xs">
        <CardContent className="p-0">
          
          {/* Integrated Pro Toolbar: Search + Status + Base + Shift + Reset (Identical to /rm/stock) */}
          <div className="px-3.5 py-2.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-2.5">
            
            {/* Search Input with quick clear and match counter */}
            <div className="flex items-center gap-2 flex-1 max-w-md">
              <div className="relative w-full">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search batch #, product, base, shift, status..."
                  value={searchTerm}
                  onChange={(e) => { 
                    setSearchTerm(e.target.value); 
                    setCurrentPage(1); 
                  }}
                  className="w-full pl-8 pr-7 py-1.5 border border-slate-200 dark:border-slate-700/80 rounded-xl text-xs bg-white dark:bg-slate-950 dark:text-white focus:outline-none focus:ring-1.5 focus:ring-indigo-500/30 focus:border-indigo-500 h-8 shadow-3xs transition-all placeholder:text-slate-400"
                />
                {searchTerm && (
                  <button
                    onClick={() => { setSearchTerm(''); setCurrentPage(1); }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 rounded-full transition-colors cursor-pointer"
                    title="Clear search"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>

              {searchTerm && (
                <div className="text-[11px] text-indigo-600 dark:text-indigo-400 font-bold whitespace-nowrap hidden sm:inline-flex items-center gap-1">
                  <span>Found {sortedAndFiltered.length} matches</span>
                </div>
              )}
            </div>

            {/* Filter Dropdowns & Reset Controls */}
            <div className="flex items-center gap-2 flex-wrap w-full lg:w-auto justify-start lg:justify-end">
              
              {/* Status Filter */}
              <div className="relative flex-1 sm:flex-none min-w-[125px] flex items-center">
                <select
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full sm:w-auto h-8 pl-2.5 pr-6 text-xs font-semibold border border-slate-200 dark:border-slate-700/80 rounded-xl bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1.5 focus:ring-indigo-500/30 focus:border-indigo-500 appearance-none cursor-pointer transition-all shadow-3xs hover:border-slate-300 dark:hover:border-slate-600"
                  aria-label="Filter by Status"
                >
                  <option value="ALL">All Status</option>
                  <option value="Planned">Planned / Draft</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Completed">Completed / Passed</option>
                  <option value="Lab Test In Progress">In QC Queue</option>
                  <option value="Paused">Paused</option>
                  <option value="Cancelled">Cancelled</option>
                </select>
                <span className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center pointer-events-none text-slate-400">
                  <ChevronDown className="w-3 h-3" />
                </span>
              </div>

              {/* Base Master Filter */}
              <div className="relative flex-1 sm:flex-none min-w-[125px] flex items-center">
                <select
                  value={baseFilter}
                  onChange={(e) => {
                    setBaseFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full sm:w-auto h-8 pl-2.5 pr-6 text-xs font-semibold border border-slate-200 dark:border-slate-700/80 rounded-xl bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1.5 focus:ring-indigo-500/30 focus:border-indigo-500 appearance-none cursor-pointer transition-all shadow-3xs hover:border-slate-300 dark:hover:border-slate-600"
                  aria-label="Filter by Base"
                >
                  <option value="ALL">All Base Formulations</option>
                  {baseOptions.map(base => (
                    <option key={base} value={base}>{base}</option>
                  ))}
                </select>
                <span className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center pointer-events-none text-slate-400">
                  <ChevronDown className="w-3 h-3" />
                </span>
              </div>

              {/* Shift Filter */}
              <div className="relative flex-1 sm:flex-none min-w-[105px] flex items-center">
                <select
                  value={shiftFilter}
                  onChange={(e) => {
                    setShiftFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full sm:w-auto h-8 pl-2.5 pr-6 text-xs font-semibold border border-slate-200 dark:border-slate-700/80 rounded-xl bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1.5 focus:ring-indigo-500/30 focus:border-indigo-500 appearance-none cursor-pointer transition-all shadow-3xs hover:border-slate-300 dark:hover:border-slate-600"
                  aria-label="Filter by Shift"
                >
                  <option value="ALL">All Shifts</option>
                  <option value="Morning">Morning Shift</option>
                  <option value="Evening">Evening Shift</option>
                  <option value="Night">Night Shift</option>
                  <option value="General">General Shift</option>
                </select>
                <span className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center pointer-events-none text-slate-400">
                  <ChevronDown className="w-3 h-3" />
                </span>
              </div>

              {/* Reset Filters Button */}
              <button
                type="button"
                onClick={handleResetFilters}
                title="Reset All Filters and Search"
                className="h-8 px-2.5 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-950 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:border-slate-300 flex items-center gap-1 font-bold text-xs shadow-3xs cursor-pointer transition-all"
              >
                <RotateCcw className="w-3 h-3" />
                <span className="hidden sm:inline">Reset</span>
              </button>
            </div>
          </div>

          {/* ── BATCH LIST TABLE WITH INTERACTIVE COLUMN SORTING ── */}
          <div className="w-full overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-slate-50/80 dark:bg-slate-950/80 text-slate-600 dark:text-slate-400 font-bold border-b border-slate-200 dark:border-slate-800 uppercase tracking-wider text-[10px]">
                <tr>
                  
                  {/* 1. Batch No */}
                  <th className="py-2.5 px-3 w-[160px] whitespace-nowrap">
                    <button
                      onClick={handleToggleSortBatch}
                      className="inline-flex items-center gap-1 uppercase tracking-wider text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer select-none font-bold"
                      title="Sort by Batch Number"
                    >
                      <span>Batch No</span>
                      {sortBy === 'batch_asc' ? (
                        <ArrowUp className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                      ) : sortBy === 'batch_desc' ? (
                        <ArrowDown className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-slate-400" />
                      )}
                    </button>
                  </th>

                  {/* 2. Date & Shift */}
                  <th className="py-2.5 px-3 w-[150px] whitespace-nowrap">
                    <button
                      onClick={handleToggleSortDate}
                      className="inline-flex items-center gap-1 uppercase tracking-wider text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer select-none font-bold"
                      title="Sort by Production Date"
                    >
                      <span>Date & Shift</span>
                      {sortBy === 'date_asc' ? (
                        <ArrowUp className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                      ) : sortBy === 'date_desc' ? (
                        <ArrowDown className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-slate-400" />
                      )}
                    </button>
                  </th>

                  {/* 3. Base & Template */}
                  <th className="py-2.5 px-3 w-[170px] whitespace-nowrap">
                    <button
                      onClick={handleToggleSortBase}
                      className="inline-flex items-center gap-1 uppercase tracking-wider text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer select-none font-bold"
                      title="Sort by Base Formulation"
                    >
                      <span>Base & Template</span>
                      {sortBy === 'base_asc' ? (
                        <ArrowUp className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                      ) : sortBy === 'base_desc' ? (
                        <ArrowDown className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-slate-400" />
                      )}
                    </button>
                  </th>

                  {/* 4. Target Product */}
                  <th className="py-2.5 px-3 min-w-[180px]">
                    <button
                      onClick={handleToggleSortProduct}
                      className="inline-flex items-center gap-1 uppercase tracking-wider text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer select-none font-bold"
                      title="Sort by Product Name"
                    >
                      <span>Target Product</span>
                      {sortBy === 'product_asc' ? (
                        <ArrowUp className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                      ) : sortBy === 'product_desc' ? (
                        <ArrowDown className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-slate-400" />
                      )}
                    </button>
                  </th>

                  {/* 5. Planned Qty */}
                  <th className="py-2.5 px-3 w-[110px] text-center whitespace-nowrap">
                    <button
                      onClick={handleToggleSortQty}
                      className="inline-flex items-center gap-1 uppercase tracking-wider text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer select-none font-bold mx-auto"
                      title="Sort by Planned Quantity"
                    >
                      <span>Planned Qty</span>
                      {sortBy === 'qty_desc' ? (
                        <ArrowDown className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                      ) : sortBy === 'qty_asc' ? (
                        <ArrowUp className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-slate-400" />
                      )}
                    </button>
                  </th>

                  {/* 6. Status */}
                  <th className="py-2.5 px-3 w-[140px] text-center whitespace-nowrap">
                    <button
                      onClick={handleToggleSortStatus}
                      className="inline-flex items-center gap-1 uppercase tracking-wider text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer select-none font-bold mx-auto"
                      title="Sort by Status"
                    >
                      <span>Status</span>
                      {sortBy === 'status_asc' ? (
                        <ArrowUp className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                      ) : sortBy === 'status_desc' ? (
                        <ArrowDown className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-slate-400" />
                      )}
                    </button>
                  </th>

                  {/* 7 & 8. Grand Total & Cost/Unit */}
                  {canViewCosting ? (
                    <>
                      <th className="py-2.5 px-3 w-[120px] text-right whitespace-nowrap">
                        <button
                          onClick={handleToggleSortCost}
                          className="inline-flex items-center gap-1 uppercase tracking-wider text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer select-none font-bold ml-auto"
                          title="Sort by Grand Total Cost"
                        >
                          <span>Grand Total</span>
                          {sortBy === 'cost_desc' ? (
                            <ArrowDown className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                          ) : sortBy === 'cost_asc' ? (
                            <ArrowUp className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                          ) : (
                            <ArrowUpDown className="w-3 h-3 text-slate-400" />
                          )}
                        </button>
                      </th>
                      <th className="py-2.5 px-3 w-[110px] text-right whitespace-nowrap">
                        <button
                          onClick={handleToggleSortCostUnit}
                          className="inline-flex items-center gap-1 uppercase tracking-wider text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer select-none font-bold ml-auto"
                          title="Sort by Unit Cost"
                        >
                          <span>Cost/Unit</span>
                          {sortBy === 'cost_unit_desc' ? (
                            <ArrowDown className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                          ) : sortBy === 'cost_unit_asc' ? (
                            <ArrowUp className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                          ) : (
                            <ArrowUpDown className="w-3 h-3 text-slate-400" />
                          )}
                        </button>
                      </th>
                    </>
                  ) : null}

                  {/* 9. Operations & Yield */}
                  <th className="py-2.5 px-3 w-[210px] text-right whitespace-nowrap">Operations & Yield</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {loading ? (
                  <tr>
                    <td colSpan={canViewCosting ? 9 : 7} className="py-12 text-center text-slate-400">
                      <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-500" />
                      Loading standard production batches...
                    </td>
                  </tr>
                ) : paginatedBatches.length === 0 ? (
                  <tr>
                    <td colSpan={canViewCosting ? 9 : 7} className="py-12 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center gap-1.5">
                        <Package className="w-7 h-7 text-slate-300 dark:text-slate-600" />
                        <span className="font-semibold text-slate-600 dark:text-slate-400">No standard production batches found matching criteria.</span>
                        {searchTerm && (
                          <button
                            onClick={handleResetFilters}
                            className="text-xs text-indigo-600 dark:text-indigo-400 font-bold hover:underline cursor-pointer mt-1"
                          >
                            Clear search and filters
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginatedBatches.map((b) => {
                    const batchAnalysis = analyzeProductionBatchNumber(b.referenceNo || b.batchNo, b.startDate || b.createdAt);
                    const displayRefNo = batchAnalysis?.formattedBatchNo || b.referenceNo || b.batchNo;
                    const unitCost = b.costPerUnit || (b.quantity > 0 ? b.totalCost / b.quantity : 0);

                    return (
                      <tr key={b.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                        
                        {/* 1. Batch No */}
                        <td className="py-2.5 px-3 font-mono whitespace-nowrap">
                          <div className="font-black text-indigo-600 dark:text-indigo-400 text-xs">
                            {displayRefNo}
                          </div>
                          {batchAnalysis?.isValid && (
                            <span className="inline-block text-[9.5px] font-mono font-medium text-slate-400 dark:text-slate-500">
                              PROD • #{batchAnalysis.sequenceFormatted}
                            </span>
                          )}
                        </td>

                        {/* 2. Date & Shift */}
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <span className="font-bold text-slate-900 dark:text-white block">
                            {new Date(b.startDate).toLocaleDateString('en-GB')}
                          </span>
                          <span className="text-[10px] text-slate-400 block font-mono">
                            {b.shift || 'Morning'} • {b.machineLine || 'Line 1'}
                          </span>
                        </td>

                        {/* 3. Base & Template */}
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <span className="font-bold text-slate-800 dark:text-slate-200 block text-xs">
                            {b.baseName || 'Standard Base'}
                          </span>
                          <span className="text-[10px] text-indigo-600 dark:text-indigo-400 block font-mono">
                            {b.templateName || 'Master Formula'}
                          </span>
                        </td>

                        {/* 4. Target Product */}
                        <td className="py-2.5 px-3">
                          <span className="font-extrabold text-slate-900 dark:text-white block">
                            {b.product?.name || 'Finished Goods'}
                          </span>
                          {b.product?.code && (
                            <span className="text-[10px] text-slate-400 font-mono">
                              SKU: {b.product.code}
                            </span>
                          )}
                        </td>

                        {/* 5. Planned Qty */}
                        <td className="py-2.5 px-3 text-center font-mono whitespace-nowrap">
                          <span className="font-black text-slate-900 dark:text-white text-xs block">
                            {b.quantity}
                          </span>
                          <span className="text-[10px] text-slate-400 uppercase font-semibold">
                            {b.product?.unit?.abbreviation || 'Nos'}
                          </span>
                        </td>

                        {/* 6. Status */}
                        <td className="py-2.5 px-3 text-center whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black ${
                            b.status === 'Completed' || b.status === 'qc_passed'
                              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                              : b.status === 'Lab Test In Progress'
                              ? 'bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200 dark:border-purple-800 animate-pulse'
                              : b.status === 'In Progress'
                              ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                              : b.status === 'Paused'
                              ? 'bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200'
                              : b.status === 'qc_failed'
                              ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                              : 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800'
                          }`}>
                            {b.status === 'Lab Test In Progress' ? '🔬 In QC Queue' : b.status}
                          </span>
                        </td>

                        {/* 7 & 8. Grand Total & Cost/Unit */}
                        {canViewCosting ? (
                          <>
                            <td className="py-2.5 px-3 text-right font-mono font-black text-slate-900 dark:text-white whitespace-nowrap">
                              ₹{formatCurrency(b.totalCost)}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                              ₹{formatCurrency(unitCost)}
                            </td>
                          </>
                        ) : null}

                        {/* 9. Operations & Yield (Never wraps, clean single row) */}
                        <td className="py-2.5 px-3 text-right whitespace-nowrap w-[210px]">
                          <div className="flex items-center justify-end gap-1.5 flex-nowrap shrink-0">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedViewBatchId(b.id);
                                setViewModalOpen(true);
                              }}
                              className="rounded-xl border-slate-200 dark:border-slate-800 hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold h-7 px-2 cursor-pointer flex items-center gap-1 shadow-3xs shrink-0"
                              title="View details, RM formulation, assigned staff & SOP guide"
                            >
                              <Eye className="w-3 h-3 text-indigo-500 shrink-0" />
                              View
                            </Button>

                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleOpenLabelModal(b)}
                              className="rounded-xl border-slate-200 dark:border-slate-800 hover:bg-slate-100 text-slate-600 dark:text-slate-400 text-xs font-bold h-7 px-2 cursor-pointer flex items-center gap-1 shadow-3xs shrink-0"
                              title="Print GS1 Barcode Label"
                            >
                              <Printer className="w-3 h-3 text-slate-500 shrink-0" />
                              GS1
                            </Button>

                            {(b.status === 'Planned' || b.status === 'Draft') && (
                              <Button
                                size="sm"
                                onClick={() => handleStartBatch(b)}
                                className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold h-7 px-2.5 cursor-pointer flex items-center gap-1 shadow-2xs shrink-0"
                                title="Start manufacturing batch on floor"
                              >
                                <Play className="w-3 h-3 fill-current shrink-0" />
                                Start
                              </Button>
                            )}

                            {b.status === 'In Progress' && (
                              <Button
                                size="sm"
                                onClick={() => handleOpenCompleteModal(b)}
                                className="bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold h-7 px-2.5 cursor-pointer flex items-center gap-1 shadow-2xs shrink-0"
                                title="Record actual yield & complete production"
                              >
                                <CheckCircle2 className="w-3 h-3 shrink-0" />
                                Yield
                              </Button>
                            )}

                            {(b.status === 'Completed' || b.status === 'qc_passed') && (
                              <span className="text-[10px] font-mono font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-lg border border-emerald-200 shrink-0">
                                {b.actualOutput ?? b.quantity} {b.product?.unit?.abbreviation || 'Nos'}
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* ── PAGINATION CONTROLS (Identical to /rm/stock) ── */}
          <div className="px-3.5 py-2.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40 flex flex-col sm:flex-row justify-between items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
            <div className="text-center sm:text-left">
              {sortedAndFiltered.length > 0 ? (
                <span>
                  Showing <strong className="text-slate-700 dark:text-slate-200">{(currentPage - 1) * itemsPerPage + 1}</strong> to <strong className="text-slate-700 dark:text-slate-200">{Math.min(currentPage * itemsPerPage, sortedAndFiltered.length)}</strong> of <strong className="text-slate-700 dark:text-slate-200">{sortedAndFiltered.length}</strong> batches
                </span>
              ) : (
                <span>0 batches found</span>
              )}
            </div>

            {totalPages > 1 && (
              <div className="flex justify-center">
                <Pagination 
                  currentPage={currentPage} 
                  totalPages={totalPages} 
                  onPageChange={setCurrentPage} 
                />
              </div>
            )}

            <div className="text-[10px] text-slate-400 flex items-center justify-between sm:justify-end w-full sm:w-auto gap-2">
              <span>Page {currentPage} of {totalPages}</span>
              <div className="flex items-center gap-1 border-l border-slate-200 dark:border-slate-800 pl-2">
                <span>Per page:</span>
                <select
                  value={itemsPerPage}
                  onChange={(e) => {
                    setItemsPerPage(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="bg-transparent text-slate-600 dark:text-slate-300 font-semibold text-[10px] cursor-pointer focus:outline-none"
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
            </div>
          </div>

        </CardContent>
      </Card>

      {/* ── BATCH COMPLETION & STOCK DEDUCTION MODAL ── */}
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

      {/* ── PRODUCTION BATCH DETAIL MODAL (Lifecycle, Pauses, SOP Guide, RM Formulation) ── */}
      <ProductionBatchDetailModal
        isOpen={viewModalOpen}
        onClose={() => {
          setViewModalOpen(false);
          setSelectedViewBatchId(null);
        }}
        batchId={selectedViewBatchId}
        onStatusUpdated={fetchBatches}
        onOpenCompleteModal={handleOpenCompleteModal}
        canViewCosting={canViewCosting}
      />

      {/* ── GS1 BATCH LABEL & BARCODE MODAL ── */}
      {labelModalOpen && selectedLabelBatch && (
        <BatchLabelModal
          isOpen={labelModalOpen}
          onClose={() => {
            setLabelModalOpen(false);
            setSelectedLabelBatch(null);
          }}
          batchId={selectedLabelBatch.id}
          batch={selectedLabelBatch}
          batchStatus={selectedLabelBatch.status}
        />
      )}

    </div>
  );
}
