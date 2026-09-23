import React, { useState, useEffect, useMemo, useRef } from 'react';
import { api } from '@/lib/axios';
import { 
  Factory, Search, RefreshCw, Plus, Calendar, AlertCircle, Play, CheckCircle2, 
  Pause, Trash2, Eye, ChevronLeft, X, ClipboardList, Info, Flame, Scale, Check, 
  Grid, List as ListIcon, Award, Activity, AlertTriangle, HelpCircle, DollarSign, Clock, 
  Layers, ArrowUpRight, BookOpen, LayoutGrid, RotateCcw, Filter, Download, ArrowUpDown,
  SlidersHorizontal, ChevronRight, Package, Sparkles, ShieldCheck
} from 'lucide-react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import Swal from 'sweetalert2';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Pagination } from '@/components/ui/Pagination';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import useAuthStore from '@/app/store/authStore';

import DatePicker from '@/components/ui/DatePicker';
import DashboardBackButton from '@/components/ui/DashboardBackButton';
import BatchDetailDrawer from '../components/BatchDetailDrawer';
import BatchCompletionModal from '../components/BatchCompletionModal';

// 5 Kanban Columns
const PIPELINE_COLUMNS = [
  { key: 'Planned', label: 'Planned', color: 'blue', dotColor: 'bg-blue-500', borderColor: 'border-t-blue-500' },
  { key: 'In Progress', label: 'In Progress', color: 'amber', dotColor: 'bg-amber-500', borderColor: 'border-t-amber-500' },
  { key: 'Completed', label: 'Completed', color: 'purple', dotColor: 'bg-purple-500', borderColor: 'border-t-purple-500' },
  { key: 'qc_passed', label: 'Passed QC', color: 'emerald', dotColor: 'bg-emerald-500', borderColor: 'border-t-emerald-500' },
  { key: 'qc_failed', label: 'Failed QC', color: 'rose', dotColor: 'bg-rose-500', borderColor: 'border-t-rose-500' }
];

const PIPELINE_COLOR_MAP = {
  blue: {
    header: 'bg-blue-50/80 dark:bg-blue-950/30 border-blue-100 dark:border-blue-900/50',
    badge: 'bg-blue-600 text-white',
    text: 'text-blue-700 dark:text-blue-400',
    dot: 'bg-blue-500',
    card_border: 'border-blue-100 dark:border-blue-900/40',
    left_accent: 'border-l-4 border-l-blue-500',
    glow: 'hover:border-blue-300 dark:hover:border-blue-700'
  },
  amber: {
    header: 'bg-amber-50/80 dark:bg-amber-950/30 border-amber-100 dark:border-amber-900/50',
    badge: 'bg-amber-600 text-white',
    text: 'text-amber-700 dark:text-amber-400',
    dot: 'bg-amber-500',
    card_border: 'border-amber-100 dark:border-amber-900/40',
    left_accent: 'border-l-4 border-l-amber-500',
    glow: 'hover:border-amber-300 dark:hover:border-amber-700'
  },
  purple: {
    header: 'bg-purple-50/80 dark:bg-purple-950/30 border-purple-100 dark:border-purple-900/50',
    badge: 'bg-purple-600 text-white',
    text: 'text-purple-700 dark:text-purple-400',
    dot: 'bg-purple-500',
    card_border: 'border-purple-100 dark:border-purple-900/40',
    left_accent: 'border-l-4 border-l-purple-500',
    glow: 'hover:border-purple-300 dark:hover:border-purple-700'
  },
  emerald: {
    header: 'bg-emerald-50/80 dark:bg-emerald-950/30 border-emerald-100 dark:border-emerald-900/50',
    badge: 'bg-emerald-600 text-white',
    text: 'text-emerald-700 dark:text-emerald-400',
    dot: 'bg-emerald-500',
    card_border: 'border-emerald-100 dark:border-emerald-900/40',
    left_accent: 'border-l-4 border-l-emerald-500',
    glow: 'hover:border-emerald-300 dark:hover:border-emerald-700'
  },
  rose: {
    header: 'bg-rose-50/80 dark:bg-rose-950/30 border-rose-100 dark:border-rose-900/50',
    badge: 'bg-rose-600 text-white',
    text: 'text-rose-700 dark:text-rose-400',
    dot: 'bg-rose-500',
    card_border: 'border-rose-100 dark:border-rose-900/40',
    left_accent: 'border-l-4 border-l-rose-500',
    glow: 'hover:border-rose-300 dark:hover:border-rose-700'
  }
};

export default function ProductionsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const batchIdParam = searchParams.get('id');
  const user = useAuthStore(s => s.user);
  const canEdit = ['MAIN_MASTER', 'SUPERVISOR', 'PRODUCTION_STAFF'].includes(user?.role);

  // Display Mode: 'pipeline' | 'grid' | 'table'
  const [displayMode, setDisplayMode] = useState('pipeline');
  
  // Mobile single-column Kanban tab selector
  const [mobilePipelineTab, setMobilePipelineTab] = useState('In Progress');

  // Master Batches State
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [sortBy, setSortBy] = useState('newest'); // 'newest' | 'ref' | 'product' | 'status'
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Date Filtering State
  const [datePreset, setDatePreset] = useState(''); // '' | 'Today' | 'Yesterday' | 'This Week' | 'This Month' | 'Date Range'
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);

  // Mobile Filter Bottom Sheet
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);

  // Completion Modal State
  const [execBatch, setExecBatch] = useState(null);
  const [completionModalOpen, setCompletionModalOpen] = useState(false);

  // Detail Drawer State
  const [detailBatch, setDetailBatch] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Drag and drop state
  const [draggingBatchId, setDraggingBatchId] = useState(null);
  const [dragOverColumn, setDragOverColumn] = useState(null);

  // Date Range presets
  const getDateRangeFromPreset = (preset) => {
    const now = new Date();
    let start = null;
    let end = null;

    switch (preset) {
      case 'Today': {
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
        end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
        break;
      }
      case 'Yesterday': {
        const yesterday = new Date(now);
        yesterday.setDate(now.getDate() - 1);
        start = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 0, 0, 0, 0);
        end = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 23, 59, 59, 999);
        break;
      }
      case 'This Week': {
        const day = now.getDay();
        const diff = now.getDate() - day;
        start = new Date(now.getFullYear(), now.getMonth(), diff, 0, 0, 0, 0);
        end = new Date(now.getFullYear(), now.getMonth(), diff + 6, 23, 59, 59, 999);
        break;
      }
      case 'This Month': {
        start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
        break;
      }
      default:
        break;
    }
    return { start, end };
  };

  const handlePresetChange = (preset) => {
    setDatePreset(preset);
    if (preset === 'Date Range') {
      if (!startDate) setStartDate(new Date());
      if (!endDate) setEndDate(new Date());
    } else if (preset === '') {
      setStartDate(null);
      setEndDate(null);
    } else {
      const { start, end } = getDateRangeFromPreset(preset);
      setStartDate(start);
      setEndDate(end);
    }
    setPage(1);
  };

  // Fetch batches with query params
  const fetchBatches = async () => {
    setLoading(true);
    try {
      const params = {
        page: displayMode === 'pipeline' ? 1 : page,
        limit: displayMode === 'pipeline' ? 150 : (displayMode === 'grid' ? 12 : 15),
        search: searchTerm,
        status: statusFilter,
        startDate: startDate ? startDate.toISOString() : undefined,
        endDate: endDate ? endDate.toISOString() : undefined
      };
      const res = await api.get('/production', { params });
      let loadedBatches = res.data.batches || [];

      // Sort
      if (displayMode !== 'pipeline') {
        loadedBatches = [...loadedBatches].sort((a, b) => {
          if (sortBy === 'ref') return a.referenceNo.localeCompare(b.referenceNo);
          if (sortBy === 'product') return (a.product?.name || '').localeCompare(b.product?.name || '');
          if (sortBy === 'status') return a.status.localeCompare(b.status);
          // Default newest
          return new Date(b.createdAt) - new Date(a.createdAt);
        });
      }

      setBatches(loadedBatches);
      setTotalPages(res.data.pages || 1);
    } catch (e) {
      console.error('Error fetching batches:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBatches();
  }, [page, statusFilter, displayMode, startDate, endDate, sortBy]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
      fetchBatches();
    }, 350);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Load details if ?id= is in query string
  useEffect(() => {
    if (batchIdParam) {
      const fetchDetail = async () => {
        setLoadingDetail(true);
        try {
          const res = await api.get(`/production/${batchIdParam}`);
          setDetailBatch(res.data);
        } catch (e) {
          console.error(e);
          Swal.fire({ title: 'Error', text: 'Failed to load production batch details.', icon: 'error' });
        } finally {
          setLoadingDetail(false);
        }
      };
      fetchDetail();
    } else {
      setDetailBatch(null);
    }
  }, [batchIdParam]);

  // Update Status handler
  const handleUpdateStatus = async (id, newStatus) => {
    const isDark = document.documentElement.classList.contains('dark');
    try {
      await api.patch(`/production/${id}/status`, { status: newStatus });
      Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'success',
        title: `Batch status updated to ${newStatus === 'qc_passed' ? 'Passed QC' : newStatus}`,
        showConfirmButton: false,
        timer: 3000,
        background: isDark ? '#1e293b' : '#ffffff',
        color: isDark ? '#f8fafc' : '#0f172a'
      });
      fetchBatches();
      if (detailBatch && detailBatch.id === id) {
        setDetailBatch(prev => prev ? { ...prev, status: newStatus } : null);
      }
    } catch (e) {
      Swal.fire({
        title: 'Action Blocked',
        text: e.response?.data?.error || 'Failed to update batch status',
        icon: 'error',
        confirmButtonColor: '#ef4444'
      });
    }
  };

  // Open Completion Modal
  const handleOpenCompletionModal = async (batch) => {
    try {
      const res = await api.get(`/production/${batch.id}`);
      setExecBatch(res.data);
      setCompletionModalOpen(true);
    } catch (e) {
      console.error(e);
      Swal.fire({ title: 'Error', text: 'Failed to load batch recipe details', icon: 'error' });
    }
  };

  // Submit Completion
  const handleSubmitCompletion = async (batchId, payload) => {
    try {
      await api.post(`/production/${batchId}/complete`, payload);
      setCompletionModalOpen(false);
      setExecBatch(null);
      Swal.fire({
        icon: 'success',
        title: 'Batch Completed!',
        text: 'Actual output logged and batch submitted to Quality Control Queue.',
        confirmButtonColor: '#4f46e5'
      });
      fetchBatches();
      if (detailBatch && detailBatch.id === batchId) {
        setDetailBatch(prev => prev ? { ...prev, status: 'Completed', actualOutput: payload.actualOutput } : null);
      }
    } catch (e) {
      Swal.fire({
        title: 'Error',
        text: e.response?.data?.error || 'Failed to complete batch',
        icon: 'error',
        confirmButtonColor: '#ef4444'
      });
    }
  };

  // Drag and Drop between Kanban columns
  const handleCardDragStart = (e, batchId) => {
    if (!canEdit) return;
    setDraggingBatchId(batchId);
    e.dataTransfer.effectAllowed = 'move';
    try {
      e.dataTransfer.setData('text/plain', batchId);
    } catch {
      // ignore
    }
  };

  const handleColumnDragOver = (e, colKey) => {
    e.preventDefault();
    if (dragOverColumn !== colKey) {
      setDragOverColumn(colKey);
    }
  };

  const handleColumnDrop = (e, targetStatus) => {
    e.preventDefault();
    setDragOverColumn(null);
    if (!draggingBatchId || !canEdit) return;

    const draggedBatch = batches.find(b => b.id === draggingBatchId);
    setDraggingBatchId(null);
    if (!draggedBatch || draggedBatch.status === targetStatus) return;

    // Moving to Completed requires completion modal
    if (targetStatus === 'Completed' && draggedBatch.status === 'In Progress') {
      handleOpenCompletionModal(draggedBatch);
      return;
    }

    // Moving to QC Passed / Failed requires confirmation
    if (targetStatus === 'qc_passed' || targetStatus === 'qc_failed') {
      Swal.fire({
        title: `Mark as ${targetStatus === 'qc_passed' ? 'Passed QC' : 'Failed QC'}?`,
        text: `Are you sure you want to mark Batch #${draggedBatch.referenceNo} as ${targetStatus === 'qc_passed' ? 'Passed' : 'Failed'} QC?`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: targetStatus === 'qc_passed' ? '#10b981' : '#ef4444',
        confirmButtonText: 'Yes, update status'
      }).then(res => {
        if (res.isConfirmed) {
          handleUpdateStatus(draggedBatch.id, targetStatus);
        }
      });
      return;
    }

    // Normal transition
    handleUpdateStatus(draggedBatch.id, targetStatus);
  };

  // Extract unique categories from batches
  const availableCategories = useMemo(() => {
    const set = new Set();
    batches.forEach(b => {
      if (b.product?.category?.name) set.add(b.product.category.name);
    });
    return Array.from(set);
  }, [batches]);

  // Filter batches by category locally if selected
  const displayedBatches = useMemo(() => {
    if (!categoryFilter) return batches;
    return batches.filter(b => b.product?.category?.name === categoryFilter);
  }, [batches, categoryFilter]);

  // Derived KPI Stats
  const { totalActive, totalCompleted, qcPassRate, qcPassedYield } = useMemo(() => {
    const active = batches.filter(b => ['Planned', 'In Progress', 'On Hold'].includes(b.status)).length;
    const completed = batches.filter(b => ['Completed', 'qc_passed'].includes(b.status)).length;
    const passed = batches.filter(b => b.status === 'qc_passed');
    const failed = batches.filter(b => b.status === 'qc_failed');
    const totalTested = passed.length + failed.length;
    const passRate = totalTested > 0 ? Math.round((passed.length / totalTested) * 100) : 100;
    const passedUnits = passed.reduce((sum, b) => sum + Number(b.actualOutput || b.quantity || 0), 0);

    return {
      totalActive: active,
      totalCompleted: completed,
      qcPassRate: passRate,
      qcPassedYield: passedUnits
    };
  }, [batches]);

  // Filter pipeline column batches
  const getPipelineFiltered = (colKey) => {
    let list = displayedBatches;
    if (colKey === 'In Progress') {
      return list.filter(b => b.status === 'In Progress' || b.status === 'On Hold');
    }
    return list.filter(b => b.status === colKey);
  };

  // Active Filter Count
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (statusFilter) count++;
    if (categoryFilter) count++;
    if (datePreset) count++;
    return count;
  }, [statusFilter, categoryFilter, datePreset]);

  // Reset all filters
  const handleResetFilters = () => {
    setStatusFilter('');
    setCategoryFilter('');
    setDatePreset('');
    setStartDate(null);
    setEndDate(null);
    setSearchTerm('');
    setPage(1);
  };

  // Export Table to CSV
  const handleExportCSV = () => {
    const headers = ['Batch Ref', 'Product Name', 'Category', 'Status', 'Target Qty', 'Actual Output', 'Start Date', 'Total Cost'];
    const rows = displayedBatches.map(b => [
      b.referenceNo,
      b.product?.name || 'N/A',
      b.product?.category?.name || 'N/A',
      b.status,
      b.quantity,
      b.actualOutput || 'N/A',
      new Date(b.startDate).toLocaleDateString('en-GB'),
      b.totalCost || 0
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `batches_export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="w-full max-w-full px-3 sm:px-6 lg:px-8 py-4 sm:py-5 space-y-4 mx-auto transition-all duration-300">
      <DashboardBackButton />

      {/* ─────────────────────── 2. PAGE HEADER ─────────────────────── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-slate-200/80 dark:border-slate-800">
        <div className="min-w-0">
          <h1 className="text-lg sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5 truncate">
            <span className="p-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-100 dark:border-indigo-900 text-indigo-600 dark:text-indigo-400 shrink-0">
              <Factory className="w-5 h-5 sm:w-6 sm:h-6" />
            </span>
            <span className="truncate">Batch Execution Center</span>
          </h1>
          <p className="text-[11px] sm:text-xs text-slate-550 dark:text-slate-400 mt-0.5 truncate">
            Manage SOP execution, recipe runs, and quality controls.
          </p>
        </div>

        {/* Top-Right Controls */}
        <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
          {/* Segmented View Switcher: Pipeline / Grid / Table */}
          <div className="flex bg-slate-100 dark:bg-slate-900 p-0.5 rounded-xl border border-slate-200 dark:border-slate-800 h-9 items-center shadow-xs">
            {[
              { mode: 'pipeline', label: 'Pipeline', icon: LayoutGrid },
              { mode: 'grid', label: 'Grid', icon: Grid },
              { mode: 'table', label: 'Table', icon: ListIcon }
            ].map(item => (
              <button
                key={item.mode}
                type="button"
                onClick={() => setDisplayMode(item.mode)}
                className={`px-3 sm:px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all h-8 cursor-pointer select-none ${
                  displayMode === item.mode
                    ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm border border-slate-200/50 dark:border-slate-700'
                    : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
                title={`${item.label} View`}
              >
                <item.icon className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{item.label}</span>
              </button>
            ))}
          </div>

          {/* "+ Record New Batch" Primary Button */}
          {canEdit && (
            <Button
              onClick={() => navigate('/production/add')}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs px-4 py-2 rounded-xl shadow-md cursor-pointer h-9"
            >
              <Plus className="w-4 h-4 mr-1" /> Record New Batch
            </Button>
          )}
        </div>
      </div>

      {/* ─────────────────────── 3. KPI SUMMARY STRIP ─────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 text-xs">
        {/* KPI 1: Active Batches */}
        <div 
          onClick={() => setStatusFilter(statusFilter === 'In Progress' ? '' : 'In Progress')}
          className={`p-3.5 sm:p-4 rounded-2xl border transition-all duration-200 cursor-pointer shadow-2xs hover:shadow-sm ${
            statusFilter === 'In Progress' 
              ? 'ring-2 ring-amber-500/30 border-amber-300 bg-amber-50/50 dark:bg-amber-950/20' 
              : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 hover:border-slate-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Active Batches</span>
            <div className={`p-2 rounded-xl shrink-0 ${totalActive > 0 ? 'bg-amber-50 text-amber-600 dark:bg-amber-950/30 dark:text-amber-400' : 'bg-slate-100 text-slate-400 dark:bg-slate-800'}`}>
              <Activity className={`w-4 h-4 sm:w-5 sm:h-5 ${totalActive > 0 ? 'animate-pulse' : ''}`} />
            </div>
          </div>
          <span className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white block mt-1">
            {totalActive}
          </span>
          <span className="text-[10px] text-slate-400 mt-0.5 block truncate">Planned & In Progress</span>
        </div>

        {/* KPI 2: Completed Batches */}
        <div 
          onClick={() => setStatusFilter(statusFilter === 'Completed' ? '' : 'Completed')}
          className={`p-3.5 sm:p-4 rounded-2xl border transition-all duration-200 cursor-pointer shadow-2xs hover:shadow-sm ${
            statusFilter === 'Completed' 
              ? 'ring-2 ring-purple-500/30 border-purple-300 bg-purple-50/50 dark:bg-purple-950/20' 
              : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 hover:border-slate-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Completed Batches</span>
            <div className="p-2 bg-purple-50 dark:bg-purple-950/30 text-purple-600 dark:text-purple-400 rounded-xl shrink-0">
              <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
          </div>
          <span className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white block mt-1">
            {totalCompleted}
          </span>
          <span className="text-[10px] text-slate-400 mt-0.5 block truncate">Awaiting or cleared QC</span>
        </div>

        {/* KPI 3: QC Pass Rate */}
        <div 
          onClick={() => setStatusFilter(statusFilter === 'qc_passed' ? '' : 'qc_passed')}
          className={`p-3.5 sm:p-4 rounded-2xl border transition-all duration-200 cursor-pointer shadow-2xs hover:shadow-sm ${
            statusFilter === 'qc_passed' 
              ? 'ring-2 ring-emerald-500/30 border-emerald-300 bg-emerald-50/50 dark:bg-emerald-950/20' 
              : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 hover:border-slate-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">QC Pass Rate</span>
            <div className="p-2 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 rounded-xl shrink-0">
              <Award className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
          </div>
          <span className={`text-xl sm:text-2xl font-black block mt-1 ${
            qcPassRate >= 95 ? 'text-emerald-600 dark:text-emerald-400' : qcPassRate >= 80 ? 'text-amber-600' : 'text-rose-600'
          }`}>
            {qcPassRate}%
          </span>
          <span className="text-[10px] text-slate-400 mt-0.5 block truncate">Quality clearance benchmark</span>
        </div>

        {/* KPI 4: QC Passed Yield */}
        <div className="p-3.5 sm:p-4 rounded-2xl border bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">QC Passed Yield</span>
              <div className="group relative cursor-help">
                <Info className="w-3 h-3 text-slate-400" />
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:block w-48 p-2 bg-slate-900 text-white text-[10px] rounded-lg shadow-lg z-50">
                  Total finished units that cleared quality control and released to warehouse stock.
                </div>
              </div>
            </div>
            <div className="p-2 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 rounded-xl shrink-0">
              <ShieldCheck className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
          </div>
          <span className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white block mt-1 font-mono">
            {qcPassedYield.toLocaleString('en-IN')}
          </span>
          <span className="text-[10px] text-slate-400 mt-0.5 block truncate">Finished stock units</span>
        </div>
      </div>

      {/* ─────────────────────── 4. SEARCH & FILTER BAR ─────────────────────── */}
      <div className="bg-slate-50/70 dark:bg-slate-900/70 p-3 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-2">
        <div className="flex flex-col md:flex-row gap-2.5 justify-between items-center text-xs">
          {/* Live Search Input */}
          <div className="relative flex-1 w-full md:max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input 
              placeholder="Search by batch ref or product spec name..." 
              className="pl-9 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl focus:ring-indigo-500 h-9 text-xs"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Desktop Filters Row */}
          <div className="hidden md:flex flex-wrap items-center gap-2 w-auto justify-end">
            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 h-9 font-semibold"
            >
              <option value="">All Statuses</option>
              <option value="Planned">Planned</option>
              <option value="In Progress">In Progress</option>
              <option value="Completed">Completed</option>
              <option value="qc_passed">QC Passed</option>
              <option value="qc_failed">QC Failed</option>
              <option value="On Hold">On Hold</option>
            </select>

            {/* Category Filter */}
            <select
              value={categoryFilter}
              onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
              className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 h-9 font-semibold"
            >
              <option value="">All Categories</option>
              {availableCategories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>

            {/* Date Preset */}
            <select
              value={datePreset}
              onChange={(e) => handlePresetChange(e.target.value)}
              className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 h-9 font-semibold"
            >
              <option value="">All Time</option>
              <option value="Today">Today</option>
              <option value="Yesterday">Yesterday</option>
              <option value="This Week">This Week</option>
              <option value="This Month">This Month</option>
              <option value="Date Range">Custom Date Range</option>
            </select>

            {/* Custom Date Range Pickers */}
            {datePreset === 'Date Range' && (
              <div className="flex items-center gap-1.5 animate__animated animate__fadeIn">
                <DatePicker
                  placeholder="Start Date"
                  value={startDate}
                  onChange={setStartDate}
                  className="w-32 space-y-0"
                  triggerClassName="h-9 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-2.5 text-xs text-slate-800 dark:text-slate-200 shadow-none font-semibold"
                />
                <span className="text-slate-400 text-xs">to</span>
                <DatePicker
                  placeholder="End Date"
                  value={endDate}
                  onChange={setEndDate}
                  className="w-32 space-y-0"
                  triggerClassName="h-9 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-2.5 text-xs text-slate-800 dark:text-slate-200 shadow-none font-semibold"
                />
              </div>
            )}

            {/* Export Table Button */}
            {displayMode === 'table' && (
              <Button
                type="button"
                variant="outline"
                onClick={handleExportCSV}
                className="h-9 rounded-xl text-xs font-semibold px-3 border-slate-200 dark:border-slate-700 flex items-center gap-1.5 cursor-pointer"
                title="Export as CSV"
              >
                <Download className="w-3.5 h-3.5" />
                Export
              </Button>
            )}
          </div>

          {/* Mobile Filter Button */}
          <div className="md:hidden flex items-center justify-between w-full">
            <Button
              type="button"
              variant="outline"
              onClick={() => setMobileFilterOpen(true)}
              className="h-9 rounded-xl text-xs font-bold border-slate-200 dark:border-slate-700 flex items-center gap-1.5"
            >
              <Filter className="w-3.5 h-3.5 text-indigo-500" />
              <span>Filters</span>
              {activeFiltersCount > 0 && (
                <span className="w-4 h-4 rounded-full bg-indigo-600 text-white text-[9px] flex items-center justify-center font-bold">
                  {activeFiltersCount}
                </span>
              )}
            </Button>

            <span className="text-[11px] text-slate-400 font-medium">
              {displayedBatches.length} Batches
            </span>
          </div>
        </div>

        {/* Active Filter Chips */}
        {activeFiltersCount > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-slate-200/50 dark:border-slate-800 text-[11px]">
            <span className="text-slate-400 text-[10px] uppercase font-bold mr-1">Active:</span>
            {statusFilter && (
              <span className="px-2 py-0.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 flex items-center gap-1">
                Status: {statusFilter}
                <button type="button" onClick={() => setStatusFilter('')} className="hover:text-indigo-900">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {categoryFilter && (
              <span className="px-2 py-0.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 flex items-center gap-1">
                Category: {categoryFilter}
                <button type="button" onClick={() => setCategoryFilter('')} className="hover:text-indigo-900">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {datePreset && (
              <span className="px-2 py-0.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 flex items-center gap-1">
                Date: {datePreset}
                <button type="button" onClick={() => handlePresetChange('')} className="hover:text-indigo-900">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            <button
              type="button"
              onClick={handleResetFilters}
              className="text-[10px] text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 underline font-medium ml-1 cursor-pointer"
            >
              Clear all
            </button>
          </div>
        )}
      </div>

      {/* ─────────────────────── 5. PIPELINE VIEW (KANBAN BOARD) ─────────────────────── */}
      {displayMode === 'pipeline' && (
        <div className="space-y-3">
          {/* Mobile Status Tabs for Single Column Swiping */}
          <div className="sm:hidden flex overflow-x-auto gap-1 pb-1 scrollbar-none">
            {PIPELINE_COLUMNS.map(col => {
              const count = getPipelineFiltered(col.key).length;
              const isActive = mobilePipelineTab === col.key;
              return (
                <button
                  key={col.key}
                  type="button"
                  onClick={() => setMobilePipelineTab(col.key)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap flex items-center gap-1.5 transition-all ${
                    isActive
                      ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm'
                      : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${col.dotColor}`} />
                  <span>{col.label}</span>
                  <span className={`px-1.5 py-0.2 rounded-full text-[9px] ${isActive ? 'bg-white/20' : 'bg-slate-200 dark:bg-slate-700'}`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Kanban Columns Grid (All 5 on Desktop, Scrollable on Tablet, Tabbed on Mobile) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 items-start pb-5 overflow-x-auto">
            {PIPELINE_COLUMNS.map(col => {
              const c = PIPELINE_COLOR_MAP[col.color];
              const items = getPipelineFiltered(col.key);
              const isOver = dragOverColumn === col.key;
              const isMobileHidden = window.innerWidth < 640 && mobilePipelineTab !== col.key;

              return (
                <div
                  key={col.key}
                  onDragOver={(e) => handleColumnDragOver(e, col.key)}
                  onDrop={(e) => handleColumnDrop(e, col.key)}
                  className={`bg-white/90 dark:bg-slate-900/80 border border-slate-200/90 dark:border-slate-800 rounded-2xl flex flex-col overflow-hidden shadow-xs transition-all duration-200 ${
                    col.borderColor
                  } border-t-4 ${
                    isOver ? 'ring-2 ring-indigo-500/40 bg-indigo-50/20 dark:bg-indigo-950/20 border-dashed' : ''
                  } ${isMobileHidden ? 'hidden sm:flex' : 'flex'}`}
                >
                  {/* Column Header */}
                  <div className={`px-3.5 py-2.5 border-b border-slate-200/80 dark:border-slate-800 ${c.header} flex items-center justify-between`}>
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`w-2.5 h-2.5 rounded-full ${col.dotColor} shrink-0`} />
                      <span className="text-[11px] font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider truncate">
                        {col.label}
                      </span>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${c.badge} shrink-0`}>
                      {items.length}
                    </span>
                  </div>

                  {/* Cards Scrollable Body */}
                  <div className="flex flex-col gap-2.5 p-2.5 overflow-y-auto max-h-[68vh] scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-850">
                    {items.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-12 text-slate-400 dark:text-slate-600 gap-1.5 border-2 border-dashed border-slate-100 dark:border-slate-800/60 rounded-xl my-1">
                        <Factory className="w-8 h-8 opacity-25" />
                        <span className="text-[10px] font-medium">No active batches</span>
                      </div>
                    ) : (
                      items.map(batch => {
                        const targetQty = Number(batch.quantity || 0);
                        const actualQty = batch.actualOutput !== null ? Number(batch.actualOutput) : null;
                        const isActualMet = actualQty !== null && actualQty >= targetQty;
                        const isDragging = draggingBatchId === batch.id;

                        return (
                          <div
                            key={batch.id}
                            draggable={canEdit}
                            onDragStart={(e) => handleCardDragStart(e, batch.id)}
                            onClick={() => setSearchParams({ id: batch.id })}
                            className={`bg-white dark:bg-slate-950 border ${c.card_border} ${c.left_accent} rounded-xl p-3.5 space-y-2.5 transition-all duration-150 hover:shadow-md ${c.glow} cursor-pointer relative select-none group ${
                              isDragging ? 'opacity-40 scale-95' : ''
                            }`}
                          >
                            {/* Card Header: Ref & Lot */}
                            <div className="flex justify-between items-center text-[10px]">
                              <span className="font-mono font-bold text-slate-500">
                                #{batch.referenceNo}
                              </span>
                              {batch.status === 'On Hold' && (
                                <span className="px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-400 font-bold text-[9px]">
                                  On Hold
                                </span>
                              )}
                              {batch.batchNo && (
                                <span className="font-mono text-slate-400 text-[9px] truncate max-w-[90px]">
                                  {batch.batchNo}
                                </span>
                              )}
                            </div>

                            {/* Product Name & Category Pill */}
                            <div>
                              <h4 className="font-bold text-slate-800 dark:text-slate-100 text-xs leading-snug line-clamp-2 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                                {batch.product?.name}
                              </h4>
                              {batch.product?.category?.name && (
                                <span className="inline-block mt-1 px-1.5 py-0.2 rounded text-[9px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                                  {batch.product.category.name}
                                </span>
                              )}
                            </div>

                            {/* Quantities Mini Stat Block */}
                            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800/60 text-[10px]">
                              <div>
                                <span className="text-slate-400 block uppercase font-bold text-[8px]">Target</span>
                                <span className="font-bold font-mono text-slate-700 dark:text-slate-300">
                                  {targetQty} {batch.product?.unit?.abbreviation || 'pcs'}
                                </span>
                              </div>
                              <div>
                                <span className="text-slate-400 block uppercase font-bold text-[8px]">Actual</span>
                                <span className={`font-bold font-mono ${
                                  actualQty === null 
                                    ? 'text-slate-400 italic' 
                                    : isActualMet 
                                    ? 'text-emerald-600 dark:text-emerald-400' 
                                    : 'text-amber-600'
                                }`}>
                                  {actualQty !== null ? `${actualQty} pcs` : 'Pending'}
                                </span>
                              </div>
                            </div>

                            {/* Card Footer Quick Actions */}
                            <div className="pt-2 border-t border-slate-100 dark:border-slate-800/60 flex items-center justify-between gap-1.5" onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center gap-1 flex-1">
                                {canEdit && batch.status === 'Planned' && (
                                  <button
                                    type="button"
                                    onClick={() => handleUpdateStatus(batch.id, 'In Progress')}
                                    className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[9px] font-bold transition-all shadow-xs flex-1 flex items-center justify-center gap-1 cursor-pointer"
                                  >
                                    <Play className="w-2.5 h-2.5 fill-white" /> Start
                                  </button>
                                )}
                                {canEdit && batch.status === 'In Progress' && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => handleOpenCompletionModal(batch)}
                                      className="px-2 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[9px] font-bold transition-all shadow-xs flex-1 flex items-center justify-center gap-1 cursor-pointer"
                                    >
                                      <CheckCircle2 className="w-2.5 h-2.5" /> Done
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleUpdateStatus(batch.id, 'On Hold')}
                                      className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 text-amber-600 rounded-lg cursor-pointer"
                                      title="Hold Batch"
                                    >
                                      <Pause className="w-3.5 h-3.5" />
                                    </button>
                                  </>
                                )}
                                {canEdit && batch.status === 'On Hold' && (
                                  <button
                                    type="button"
                                    onClick={() => handleUpdateStatus(batch.id, 'In Progress')}
                                    className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[9px] font-bold transition-all shadow-xs flex-1 flex items-center justify-center gap-1 cursor-pointer"
                                  >
                                    <Play className="w-2.5 h-2.5" /> Resume
                                  </button>
                                )}
                                {canEdit && batch.status === 'qc_failed' && (
                                  <button
                                    type="button"
                                    onClick={() => handleUpdateStatus(batch.id, 'In Progress')}
                                    className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-[9px] font-bold transition-all shadow-xs flex-1 flex items-center justify-center gap-1 cursor-pointer"
                                  >
                                    <RotateCcw className="w-2.5 h-2.5" /> Rework
                                  </button>
                                )}
                              </div>

                              {/* Inspect details icon */}
                              <button
                                type="button"
                                onClick={() => setSearchParams({ id: batch.id })}
                                className="p-1 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                                title="View batch details"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ─────────────────────── 6. GRID VIEW ─────────────────────── */}
      {displayMode === 'grid' && (
        <div className="space-y-4">
          {/* Grid Toolbar with Sort Dropdown */}
          <div className="flex items-center justify-between text-xs pb-1">
            <span className="font-semibold text-slate-600 dark:text-slate-400">
              Showing {displayedBatches.length} batches in card grid
            </span>
            <div className="flex items-center gap-2">
              <span className="text-slate-400 font-medium">Sort by:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1 text-xs text-slate-800 dark:text-slate-200 font-semibold"
              >
                <option value="newest">Newest First</option>
                <option value="ref">Batch Reference</option>
                <option value="product">Product Name</option>
                <option value="status">Status</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {displayedBatches.length > 0 ? (
              displayedBatches.map(batch => (
                <div
                  key={batch.id}
                  onClick={() => setSearchParams({ id: batch.id })}
                  className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 space-y-3 hover:shadow-md hover:border-slate-300 dark:hover:border-slate-700 transition-all cursor-pointer shadow-2xs relative flex flex-col justify-between"
                >
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-xs text-indigo-600 dark:text-indigo-400">
                        #{batch.referenceNo}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${
                        batch.status === 'Planned' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                        batch.status === 'In Progress' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                        batch.status === 'Completed' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                        batch.status === 'qc_passed' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                        'bg-rose-50 text-rose-700 border-rose-200'
                      }`}>
                        {batch.status === 'qc_passed' ? 'Passed QC' : batch.status === 'qc_failed' ? 'Failed QC' : batch.status}
                      </span>
                    </div>

                    <div>
                      <h4 className="font-bold text-slate-800 dark:text-white text-xs line-clamp-1">
                        {batch.product?.name}
                      </h4>
                      <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                        {batch.product?.code} • {batch.product?.category?.name || 'General'}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-2 p-2 bg-slate-50 dark:bg-slate-950/60 rounded-xl text-[10px]">
                      <div>
                        <span className="text-slate-400 block font-semibold">Target</span>
                        <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                          {batch.quantity} {batch.product?.unit?.abbreviation || 'pcs'}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block font-semibold">Actual</span>
                        <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                          {batch.actualOutput !== null ? `${batch.actualOutput} pcs` : '—'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[10px] text-slate-400">
                    <span>{new Date(batch.startDate).toLocaleDateString('en-GB')}</span>
                    <span className="font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-0.5">
                      Details <ChevronRight className="w-3 h-3" />
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="col-span-full py-16 text-center text-slate-400 border border-dashed rounded-2xl italic">
                No production batches matched your filter criteria.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─────────────────────── 6. TABLE VIEW ─────────────────────── */}
      {displayMode === 'table' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs space-y-2">
          {/* Desktop Data Table */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800 text-[10px] uppercase font-extrabold text-slate-500 tracking-wider">
                <tr>
                  <th className="py-3 px-4">Batch Ref</th>
                  <th className="py-3 px-4">Product Name</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Target</th>
                  <th className="py-3 px-4 text-right">Actual Output</th>
                  <th className="py-3 px-4 text-right">Yield %</th>
                  <th className="py-3 px-4">Start Date</th>
                  <th className="py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {displayedBatches.length > 0 ? (
                  displayedBatches.map(batch => {
                    const target = Number(batch.quantity || 1);
                    const actual = batch.actualOutput !== null ? Number(batch.actualOutput) : null;
                    const yieldPercent = actual !== null ? Math.round((actual / target) * 100) : null;

                    return (
                      <tr 
                        key={batch.id}
                        onClick={() => setSearchParams({ id: batch.id })}
                        className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 cursor-pointer transition-colors"
                      >
                        <td className="py-3 px-4 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                          #{batch.referenceNo}
                        </td>
                        <td className="py-3 px-4 font-semibold text-slate-800 dark:text-white">
                          {batch.product?.name}
                        </td>
                        <td className="py-3 px-4 text-slate-500">
                          {batch.product?.category?.name || 'General'}
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            batch.status === 'Planned' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                            batch.status === 'In Progress' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                            batch.status === 'Completed' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                            batch.status === 'qc_passed' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                            'bg-rose-50 text-rose-700 border-rose-200'
                          }`}>
                            {batch.status === 'qc_passed' ? 'Passed QC' : batch.status === 'qc_failed' ? 'Failed QC' : batch.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-medium text-slate-700 dark:text-slate-300">
                          {target} {batch.product?.unit?.abbreviation || 'pcs'}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-medium text-slate-700 dark:text-slate-300">
                          {actual !== null ? `${actual} pcs` : '—'}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold">
                          {yieldPercent !== null ? (
                            <span className={yieldPercent >= 100 ? 'text-emerald-600' : 'text-amber-600'}>
                              {yieldPercent}%
                            </span>
                          ) : '—'}
                        </td>
                        <td className="py-3 px-4 text-slate-500 font-mono">
                          {new Date(batch.startDate).toLocaleDateString('en-GB')}
                        </td>
                        <td className="py-3 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSearchParams({ id: batch.id })}
                            className="h-8 px-2 text-indigo-600 hover:text-indigo-800 dark:hover:text-indigo-300"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-400 italic">
                      No batch records found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Stacked Card List Fallback */}
          <div className="sm:hidden divide-y divide-slate-100 dark:divide-slate-800 p-2 space-y-2">
            {displayedBatches.map(batch => (
              <div
                key={batch.id}
                onClick={() => setSearchParams({ id: batch.id })}
                className="p-3 bg-white dark:bg-slate-950 rounded-xl border border-slate-100 dark:border-slate-800 space-y-1.5"
              >
                <div className="flex justify-between items-center text-xs">
                  <span className="font-mono font-bold text-indigo-600">#{batch.referenceNo}</span>
                  <span className="text-[10px] font-bold">{batch.status}</span>
                </div>
                <div className="font-bold text-xs text-slate-800 dark:text-white">
                  {batch.product?.name}
                </div>
                <div className="flex justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-100 dark:border-slate-800">
                  <span>Target: {batch.quantity}</span>
                  <span>Actual: {batch.actualOutput || 'Pending'}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Table Pagination Bar */}
          <div className="p-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
            <span className="text-slate-400">
              Showing page {page} of {totalPages}
            </span>
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage(prev => Math.max(1, prev - 1))}
                className="h-8 rounded-lg text-xs"
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage(prev => Math.min(totalPages, prev + 1))}
                className="h-8 rounded-lg text-xs"
              >
                Next
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────── 7. BATCH DETAIL DRAWER ─────────────────────── */}
      <BatchDetailDrawer
        isOpen={!!batchIdParam}
        onClose={() => setSearchParams({})}
        batch={detailBatch}
        loading={loadingDetail}
        canEdit={canEdit}
        onUpdateStatus={handleUpdateStatus}
        onOpenCompletionModal={handleOpenCompletionModal}
      />

      {/* ─────────────────────── BATCH COMPLETION MODAL ─────────────────────── */}
      <BatchCompletionModal
        isOpen={completionModalOpen}
        onClose={() => {
          setCompletionModalOpen(false);
          setExecBatch(null);
        }}
        batch={execBatch}
        onSubmit={handleSubmitCompletion}
      />

      {/* ─────────────────────── MOBILE FILTER BOTTOM SHEET ─────────────────────── */}
      {mobileFilterOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex flex-col justify-end bg-slate-950/60 backdrop-blur-xs animate__animated animate__fadeIn">
          <div className="w-full bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 rounded-t-3xl p-5 space-y-4 shadow-2xl animate__animated animate__slideInUp">
            <div className="flex items-center justify-between border-b pb-3 border-slate-100 dark:border-slate-800">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                <Filter className="w-4 h-4 text-indigo-500" /> Filter Batches
              </h3>
              <button
                type="button"
                onClick={() => setMobileFilterOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-slate-500 uppercase text-[10px]">Status</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border rounded-xl p-2.5"
                >
                  <option value="">All Statuses</option>
                  <option value="Planned">Planned</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Completed">Completed</option>
                  <option value="qc_passed">Passed QC</option>
                  <option value="qc_failed">Failed QC</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-500 uppercase text-[10px]">Category</label>
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border rounded-xl p-2.5"
                >
                  <option value="">All Categories</option>
                  {availableCategories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-500 uppercase text-[10px]">Date Range</label>
                <select
                  value={datePreset}
                  onChange={(e) => handlePresetChange(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border rounded-xl p-2.5"
                >
                  <option value="">All Time</option>
                  <option value="Today">Today</option>
                  <option value="Yesterday">Yesterday</option>
                  <option value="This Week">This Week</option>
                  <option value="This Month">This Month</option>
                </select>
              </div>
            </div>

            <div className="pt-2 flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleResetFilters}
                className="flex-1 rounded-xl text-xs font-semibold h-10"
              >
                Reset All
              </Button>
              <Button
                type="button"
                onClick={() => setMobileFilterOpen(false)}
                className="flex-1 bg-indigo-600 text-white rounded-xl text-xs font-bold h-10"
              >
                Apply Filters
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────── MOBILE FLOATING ACTION BUTTON (FAB) ─────────────────────── */}
      {canEdit && (
        <div className="sm:hidden fixed bottom-6 right-6 z-40">
          <Button
            type="button"
            onClick={() => navigate('/production/add')}
            className="w-13 h-13 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white shadow-xl shadow-indigo-600/30 flex items-center justify-center cursor-pointer p-0"
            title="Record New Batch"
          >
            <Plus className="w-6 h-6" />
          </Button>
        </div>
      )}

    </div>
  );
}
