import React, { useState, useEffect } from 'react';
import { api } from '@/lib/axios';
import { 
  Factory, Search, RefreshCw, Plus, Calendar, AlertCircle, Play, CheckCircle, 
  Pause, Trash2, Eye, ChevronLeft, X, ClipboardList, Info, Flame, Scale, Check, 
  Grid, List as ListIcon, Award, Activity, AlertTriangle, HelpCircle, DollarSign, Clock, Layers, ArrowUpRight,
  BookOpen, LayoutGrid
} from 'lucide-react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import Swal from 'sweetalert2';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Pagination } from '@/components/ui/Pagination';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import useAuthStore from '@/app/store/authStore';

import AddProductionPage from './AddProductionPage';
import DatePicker from '@/components/ui/DatePicker';
import DashboardBackButton from '@/components/ui/DashboardBackButton';

const PIPELINE_COLUMNS = [
  { key: 'Planned', label: 'Planned', color: 'blue' },
  { key: 'In Progress', label: 'In Progress', color: 'amber' },
  { key: 'Completed', label: 'Completed', color: 'violet' },
  { key: 'qc_passed', label: 'Passed QC', color: 'emerald' },
  { key: 'qc_failed', label: 'Failed QC', color: 'rose' }
];

const PIPELINE_COLOR_MAP = {
  blue: {
    header: 'bg-blue-50 dark:bg-blue-500/20 border-blue-100 dark:border-blue-500/30',
    badge: 'bg-blue-600 dark:bg-blue-500 text-white',
    text: 'text-blue-650 dark:text-blue-400',
    dot: 'bg-blue-500 dark:bg-blue-400',
    card_border: 'border-blue-100 dark:border-blue-500/20',
    glow: 'shadow-blue-500/5 dark:shadow-blue-500/10 hover:border-blue-300 dark:hover:border-blue-800'
  },
  amber: {
    header: 'bg-amber-50 dark:bg-amber-500/20 border-amber-100 dark:border-amber-500/30',
    badge: 'bg-amber-600 dark:bg-amber-500 text-white',
    text: 'text-amber-700 dark:text-amber-400',
    dot: 'bg-amber-500 dark:bg-amber-400',
    card_border: 'border-amber-100 dark:border-amber-500/20',
    glow: 'shadow-amber-500/5 dark:shadow-amber-500/10 hover:border-amber-300 dark:hover:border-amber-800'
  },
  violet: {
    header: 'bg-violet-50 dark:bg-violet-500/20 border-violet-100 dark:border-violet-500/30',
    badge: 'bg-violet-600 dark:bg-violet-500 text-white',
    text: 'text-violet-600 dark:text-violet-400',
    dot: 'bg-violet-500 dark:bg-violet-400',
    card_border: 'border-violet-100 dark:border-violet-500/20',
    glow: 'shadow-violet-500/5 dark:shadow-violet-500/10 hover:border-violet-300 dark:hover:border-violet-800'
  },
  emerald: {
    header: 'bg-emerald-50 dark:bg-emerald-500/20 border-emerald-100 dark:border-emerald-500/30',
    badge: 'bg-emerald-600 dark:bg-emerald-500 text-white',
    text: 'text-emerald-600 dark:text-emerald-450',
    dot: 'bg-emerald-500 dark:bg-emerald-400',
    card_border: 'border-emerald-100 dark:border-emerald-500/20',
    glow: 'shadow-emerald-500/5 dark:shadow-emerald-500/10 hover:border-emerald-300 dark:hover:border-emerald-800'
  },
  rose: {
    header: 'bg-rose-50 dark:bg-rose-500/20 border-rose-100 dark:border-rose-500/30',
    badge: 'bg-rose-600 dark:bg-rose-500 text-white',
    text: 'text-rose-600 dark:text-rose-455',
    dot: 'bg-rose-500 dark:bg-rose-400',
    card_border: 'border-rose-100 dark:border-rose-500/20',
    glow: 'shadow-rose-500/5 dark:shadow-rose-500/10 hover:border-rose-300 dark:hover:border-rose-800'
  }
};

export default function ProductionsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const batchIdParam = searchParams.get('id');
  const user = useAuthStore(s => s.user);
  const canEdit = ['MAIN_MASTER', 'PRODUCTION_STAFF'].includes(user?.role);
  
  const [view, setView] = useState({ type: 'list', prefill: null });
  const [displayMode, setDisplayMode] = useState('pipeline'); // 'pipeline' | 'grid' | 'table'
  const [selectedSopBatch, setSelectedSopBatch] = useState(null);
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    if (canEdit && (location.pathname === '/production/add' || location.state?.prefill)) {
      setView({ type: 'create', prefill: location.state });
    } else {
      setView({ type: 'list', prefill: null });
    }
  }, [location, canEdit]);

  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const fromNotifications = location.state?.from === '/notifications';

  const [datePreset, setDatePreset] = useState(''); // '' | 'Today' | 'Yesterday' | 'This Week' | 'This Month' | 'Date Range'
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);

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
  };

  // Completion Modal State
  const [execBatch, setExecBatch] = useState(null);
  const [actualOutput, setActualOutput] = useState('');
  const [actualRmUsages, setActualRmUsages] = useState([]); // Array of { rmId, name, requiredQty, actualUsedQty, unit }
  const [completionNote, setCompletionNote] = useState('');

  // Details Page State (loaded if batchIdParam exists)
  const [detailBatch, setDetailBatch] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const fetchBatches = async () => {
    setLoading(true);
    try {
      const params = {
        page: displayMode === 'pipeline' ? 1 : page,
        limit: displayMode === 'pipeline' ? 100 : (displayMode === 'grid' ? 8 : 10),
        search: searchTerm,
        status: statusFilter,
        startDate: startDate ? startDate.toISOString() : undefined,
        endDate: endDate ? endDate.toISOString() : undefined
      };
      const res = await api.get('/production', { params });
      let loadedBatches = res.data.batches || [];
      
      // If NOT in pipeline view, sort: 'In Progress' always comes first
      if (displayMode !== 'pipeline') {
        loadedBatches = [...loadedBatches].sort((a, b) => {
          if (a.status === 'In Progress' && b.status !== 'In Progress') return -1;
          if (a.status !== 'In Progress' && b.status === 'In Progress') return 1;
          return 0;
        });
      }
      
      setBatches(loadedBatches);
      setTotalPages(res.data.pages || 1);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBatches();
  }, [page, statusFilter, displayMode, startDate, endDate, view.type]);

  // Handle URL ID query parameter sync to load details view
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

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    fetchBatches();
  };

  const handleUpdateStatus = async (id, newStatus) => {
    const isDark = document.documentElement.classList.contains('dark');
    try {
      if (newStatus === 'In Progress') {
        await api.patch(`/production/${id}/status`, { status: newStatus });
        Swal.fire({
          title: '<span class="text-sm font-bold text-slate-800 dark:text-slate-100">Production Started!</span>',
          text: 'Batch is now In Progress. Raw materials reserved.',
          icon: 'success',
          confirmButtonColor: '#4f46e5',
          background: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)',
          color: isDark ? '#f8fafc' : '#0f172a',
        });
        fetchBatches();
      } else {
        await api.patch(`/production/${id}/status`, { status: newStatus });
        fetchBatches();
      }
    } catch (e) {
      Swal.fire({
        title: '<span class="text-sm font-bold text-slate-850 dark:text-slate-100 font-extrabold">Action Blocked</span>',
        text: e.response?.data?.error || 'Failed to update status',
        icon: 'error',
        confirmButtonColor: '#ef4444',
        background: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)',
        color: isDark ? '#f8fafc' : '#0f172a',
      });
    }
  };

  // Open modal to record actual details
  const handleOpenCompletionModal = async (batch) => {
    try {
      const res = await api.get(`/production/${batch.id}`);
      const fullBatch = res.data;
      setExecBatch(fullBatch);
      setActualOutput(Number(fullBatch.quantity));
      
      const usages = (fullBatch.rmUsages || []).map(u => {
        const uomLabel = u.rawMaterial?.unit?.abbreviation || 'units';
        const isKg = /kg|kilogram/i.test(uomLabel);
        const isL = /l|liter|litre/i.test(uomLabel);
        const subUomLabel = isKg ? 'g' : (isL ? 'ml' : null);
        return {
          rmId: u.rmId,
          name: u.rawMaterial?.name || 'Raw Material',
          requiredQty: Number(u.requiredQty),
          actualUsedQty: Number(u.requiredQty),
          unit: uomLabel,
          subUomLabel,
          selectedUnit: 'base',
          inputValue: Number(u.requiredQty)
        };
      });
      setActualRmUsages(usages);
      setCompletionNote('');
    } catch (e) {
      console.error(e);
      Swal.fire({ title: 'Error', text: 'Failed to load batch recipe details', icon: 'error' });
    }
  };

  const handleSubmitCompletion = async () => {
    const isDark = document.documentElement.classList.contains('dark');
    try {
      const payload = {
        actualOutput: Number(actualOutput),
        rmUsages: actualRmUsages.map(u => {
          const actualVal = u.selectedUnit === 'sub' ? Number(u.inputValue) / 1000 : Number(u.inputValue);
          return {
            rmId: u.rmId,
            actualUsedQty: actualVal
          };
        }),
        note: completionNote
      };

      await api.post(`/production/${execBatch.id}/complete`, payload);

      Swal.fire({
        title: '<span class="text-sm font-bold text-slate-850 dark:text-slate-100">Batch Completed!</span>',
        text: 'Batch is sent to Lab QC queue. Material stock adjusted with return leftovers.',
        icon: 'success',
        confirmButtonColor: '#4f46e5',
        background: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)',
        color: isDark ? '#f8fafc' : '#0f172a',
      });

      setExecBatch(null);
      fetchBatches();
    } catch (e) {
      Swal.fire({
        title: '<span class="text-sm font-bold">Error completing batch</span>',
        text: e.response?.data?.error || 'Failed to complete production',
        icon: 'error',
        background: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)',
        color: isDark ? '#f8fafc' : '#0f172a',
      });
    }
  };

  const handleOpenDetailModal = (batch) => {
    setSearchParams({ id: batch.id });
  };

  const handleCloseDetailModal = () => {
    setSearchParams({});
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const id = e.dataTransfer.getData("text/plain");
    if (id) {
      setSearchParams({ id });
    }
  };

  // Timing logs parser
  const calculateProductionTimes = (logs) => {
    if (!logs || logs.length === 0) return { timeline: [], durationText: 'N/A' };

    let startTime = null;
    let totalMs = 0;
    const timeline = [];

    const sorted = [...logs].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

    sorted.forEach((log) => {
      let eventName = '';
      const newVal = log.newValue || {};
      const oldVal = log.oldValue || {};
      
      if (log.action === 'CREATE_PRODUCTION_BATCH') {
        eventName = 'Batch Created';
      } else if (log.action === 'UPDATE_PRODUCTION_STATUS') {
        if (newVal.status === 'In Progress') {
          eventName = oldVal.status === 'On Hold' ? 'Resumed' : 'Started';
          startTime = new Date(log.createdAt);
        } else if (newVal.status === 'On Hold') {
          eventName = 'Paused';
          if (startTime) {
            totalMs += new Date(log.createdAt) - startTime;
            startTime = null;
          }
        } else if (newVal.status === 'Cancelled') {
          eventName = 'Cancelled';
          startTime = null;
        }
      } else if (log.action === 'COMPLETE_PRODUCTION_BATCH') {
        eventName = 'Completed';
        if (startTime) {
          totalMs += new Date(log.createdAt) - startTime;
          startTime = null;
        }
      } else if (log.action === 'APPROVE_PRODUCTION_QC') {
        eventName = 'QC Approved & Released';
      }

      if (eventName) {
        timeline.push({
          event: eventName,
          time: new Date(log.createdAt),
          user: log.user?.name || 'System'
        });
      }
    });

    if (startTime) {
      totalMs += new Date() - startTime;
    }

    const totalMinutes = Math.floor(totalMs / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    
    let durationText = '0m';
    if (hours > 0) {
      durationText = `${hours}h ${mins}m`;
    } else if (mins > 0) {
      durationText = `${mins}m`;
    } else {
      durationText = 'less than a minute';
    }

    return { timeline, durationText };
  };

  const getPipelineFiltered = (colKey) => {
    const list = batches || [];
    let filtered = list;
    if (colKey === 'In Progress') {
      filtered = list.filter(b => b.status === 'In Progress' || b.status === 'On Hold');
    } else {
      filtered = list.filter(b => b.status === colKey);
    }
    return filtered;
  };

  if (view.type === 'create') {
    return <AddProductionPage />;
  }

  // ─────────────────────── RENDERING DETAILED SUB-PAGE VIEW ───────────────────────
  if (batchIdParam) {
    if (loadingDetail) {
      return (
        <div className="min-h-[70vh] flex flex-col items-center justify-center text-slate-400 gap-3">
          <RefreshCw className="w-8 h-8 animate-spin text-indigo-500" />
          <span className="text-sm font-semibold">Fetching batch details...</span>
        </div>
      );
    }

    if (!detailBatch) {
      return (
        <div className="p-6 max-w-4xl mx-auto text-center space-y-4">
          <AlertCircle className="w-12 h-12 text-rose-500 mx-auto" />
          <h2 className="text-lg font-bold text-slate-800 dark:text-white">Batch Not Found</h2>
          <Button onClick={handleCloseDetailModal} className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl">
            Back to Batch Listing
          </Button>
        </div>
      );
    }

    const { timeline, durationText } = calculateProductionTimes(detailBatch.auditLogs);
    const rawUsages = detailBatch.rmUsages || [];
    const calculatedVariances = rawUsages.map(u => {
      const required = Number(u.requiredQty || 0);
      const actual = Number(u.actualUsedQty || 0);
      return {
        rawMaterialName: u.rawMaterial?.name || 'Raw Material',
        requiredQty: required,
        actualUsedQty: actual,
        variance: actual - required,
        unit: u.rawMaterial?.unit?.abbreviation || 'units'
      };
    });

    return (
      <div className="w-full max-w-full px-4 sm:px-6 lg:px-8 py-5 space-y-4 mx-auto animate__animated animate__fadeIn">
        {/* Navigation & Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-slate-205 dark:border-slate-850">
          <div className="space-y-0.5">
            <button 
              type="button"
              onClick={() => {
                const fromP = searchParams.get('from') || location.state?.from;
                if (fromP === 'dashboard' || fromP === 'main') navigate('/dashboard');
                else if (fromP === 'production') navigate('/dashboard/production');
                else if (fromP === 'executive') navigate('/dashboard/executive');
                else if (fromP === 'inventory') navigate('/dashboard/inventory');
                else if (fromP === 'notifications' || fromP === '/notifications') navigate('/notifications');
                else if (typeof fromP === 'string' && fromP.startsWith('/')) navigate(fromP);
                else handleCloseDetailModal();
              }}
              className="inline-flex items-center gap-1 text-xs font-bold text-indigo-650 dark:text-indigo-400 hover:underline mb-1 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
              {(() => {
                const fromP = searchParams.get('from') || location.state?.from;
                if (fromP === 'dashboard' || fromP === 'main') return 'Back to Dashboard';
                if (fromP === 'production') return 'Back to Production Dashboard';
                if (fromP === 'executive') return 'Back to Executive Dashboard';
                if (fromP === 'inventory') return 'Back to Inventory Dashboard';
                if (fromP === 'notifications' || fromP === '/notifications') return 'Back to Notifications Center';
                return 'Back to Batch Execution Center';
              })()}
            </button>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
              Batch Execution Dashboard
            </h1>
            <p className="text-xs text-slate-550 dark:text-slate-400">
              Audit log details, timing reports, and component consumption stats for Batch #{detailBatch.referenceNo}.
            </p>
          </div>
          <span className={`px-3 py-1 rounded-full text-xs font-extrabold border h-8.5 flex items-center ${
            detailBatch.status === 'Planned' ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-400' :
            detailBatch.status === 'In Progress' ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400' :
            detailBatch.status === 'Completed' ? 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-500/10 dark:text-indigo-400' :
            detailBatch.status === 'qc_passed' ? 'bg-emerald-50 text-emerald-700 border-emerald-250 dark:bg-emerald-500/10 dark:text-emerald-450' :
            'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-500/10 dark:text-slate-400'
          }`}>
            Status: {detailBatch.status === 'qc_passed' ? 'Passed QC' : detailBatch.status === 'qc_failed' ? 'Failed QC' : detailBatch.status}
          </span>
        </div>

        {/* Dashboard Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* LEFT 2 COLUMNS: Operations logs & BOM specs */}
          <div className="lg:col-span-2 space-y-5">
            
            {/* Batch Core Info */}
            <Card className="rounded-2xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
              <CardHeader className="pb-3 border-b dark:border-slate-800">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Info className="w-4 h-4 text-indigo-500" /> Basic Batch Info
                </h3>
              </CardHeader>
              <CardContent className="pt-4 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                <div>
                  <span className="text-slate-400 uppercase text-[9px] font-bold block">Product Name</span>
                  <span className="font-semibold text-slate-850 dark:text-slate-205 block mt-0.5">{detailBatch.product?.name}</span>
                </div>
                <div>
                  <span className="text-slate-400 uppercase text-[9px] font-bold block">Production Type</span>
                  <span className="font-semibold text-slate-855 dark:text-slate-205 block mt-0.5">{detailBatch.productionType}</span>
                </div>
                <div>
                  <span className="text-slate-400 uppercase text-[9px] font-bold block">Target Quantity</span>
                  <span className="font-semibold text-slate-855 dark:text-slate-205 block mt-0.5">{detailBatch.quantity} pcs</span>
                </div>
                <div>
                  <span className="text-slate-400 uppercase text-[9px] font-bold block">Actual Output Yield</span>
                  <span className="font-semibold text-slate-855 dark:text-slate-205 block mt-0.5">{detailBatch.actualOutput || 'N/A'} pcs</span>
                </div>
              </CardContent>
            </Card>

            {/* Timing execution log timeline */}
            <Card className="rounded-2xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
              <CardHeader className="pb-3 border-b dark:border-slate-800 flex flex-row items-center justify-between">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-indigo-505" /> Timing Execution Report
                </h3>
                <span className="text-2xs font-extrabold text-indigo-650 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-955/50 px-2.5 py-0.5 rounded-lg border dark:border-indigo-950">
                  Active Duration: {durationText}
                </span>
              </CardHeader>
              <CardContent className="pt-4 space-y-4 text-xs">
                {timeline.length > 0 ? (
                  <div className="relative pl-4 border-l border-slate-200 dark:border-slate-800 space-y-4">
                    {timeline.map((item, idx) => (
                      <div key={idx} className="relative">
                        <span className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-indigo-600 border-2 border-white dark:border-slate-900" />
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-1">
                          <span className="font-bold text-slate-800 dark:text-white uppercase text-[10px] tracking-wide">{item.event}</span>
                          <span className="text-[10px] text-slate-455">
                            {new Date(item.time).toLocaleString('en-GB')} by {item.user}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <span className="text-slate-400 italic">No timeline logs recorded for this batch.</span>
                )}
              </CardContent>
            </Card>

            {/* Raw Material Consumption & Variance */}
            <Card className="rounded-2xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
              <CardHeader className="pb-3 border-b dark:border-slate-800">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Scale className="w-4 h-4 text-indigo-505" /> Raw Material Variance Report
                </h3>
              </CardHeader>
              <CardContent className="pt-4 p-0">
                <div className="overflow-x-auto text-xs">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 font-bold border-b border-slate-100 dark:border-slate-850">
                      <tr>
                        <th className="px-4 py-3">Raw Material</th>
                        <th className="px-4 py-3 text-right">Required (SOP)</th>
                        <th className="px-4 py-3 text-right">Actual Used</th>
                        <th className="px-4 py-3 text-right">Variance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {calculatedVariances.length > 0 ? (
                        calculatedVariances.map((varItem, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-955/20">
                            <td className="px-4 py-3 font-semibold text-slate-805 dark:text-slate-200">{varItem.rawMaterialName}</td>
                            <td className="px-4 py-3 text-right font-mono text-slate-600 dark:text-slate-350">{varItem.requiredQty.toFixed(2)} {varItem.unit}</td>
                            <td className="px-4 py-3 text-right font-mono text-slate-600 dark:text-slate-350">{varItem.actualUsedQty.toFixed(2)} {varItem.unit}</td>
                            <td className={`px-4 py-3 text-right font-mono font-bold ${
                              varItem.variance > 0 ? 'text-amber-500' : varItem.variance < 0 ? 'text-indigo-500' : 'text-slate-450'
                            }`}>
                              {varItem.variance > 0 ? '+' : ''}{varItem.variance.toFixed(2)} {varItem.unit}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={4} className="p-4 text-center text-slate-405 italic">No raw materials allocated.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* Lab Quality Control Checks */}
            {detailBatch.qcTests && detailBatch.qcTests.length > 0 && (
              <Card className="rounded-2xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                <CardHeader className="pb-3 border-b dark:border-slate-800">
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <Award className="w-4 h-4 text-emerald-500" /> Quality Control (QC) Lab Report
                  </h3>
                </CardHeader>
                <CardContent className="pt-4 space-y-4 text-xs">
                  {detailBatch.qcTests.map((t, idx) => {
                    const isPassed = t.result?.toLowerCase() === 'pass' || t.action?.toLowerCase() === 'approved';
                    return (
                      <div key={idx} className="p-4 bg-slate-50 dark:bg-slate-950 border dark:border-slate-855 rounded-2xl space-y-3">
                        <div className="flex justify-between items-center">
                          <span className={`px-2.5 py-1 text-[10px] font-extrabold rounded-full border ${
                            isPassed 
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-250 dark:bg-emerald-950/20 dark:text-emerald-400' 
                              : 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-955/20 dark:text-rose-455'
                          }`}>
                            {isPassed ? 'PASSED QC' : 'FAILED QC'}
                          </span>
                          <span className="text-[10px] text-slate-400 font-medium">
                            Tested at: {new Date(t.createdAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs leading-normal">
                          <div>
                            <span className="text-slate-455 text-[10px] uppercase font-bold block">Lab Tester Name</span>
                            <span className="font-semibold text-slate-800 dark:text-slate-200">{t.tester?.name || 'N/A'}</span>
                          </div>
                          <div>
                            <span className="text-slate-455 text-[10px] uppercase font-bold block">Username / Email</span>
                            <span className="font-mono text-slate-700 dark:text-slate-350">{t.tester?.email || 'N/A'}</span>
                          </div>
                          <div>
                            <span className="text-slate-455 text-[10px] uppercase font-bold block">Verdict Action</span>
                            <span className="font-semibold text-slate-800 dark:text-slate-202 uppercase">{t.action || 'Approved'}</span>
                          </div>
                        </div>

                        {t.qcParams && (
                          <div className="pt-3 border-t dark:border-slate-800 grid grid-cols-2 sm:grid-cols-5 gap-3 bg-white dark:bg-slate-900/60 p-3 rounded-xl">
                            <div>
                              <span className="text-slate-400 text-[9px] uppercase font-bold block">Taste</span>
                              <span className="font-bold text-slate-800 dark:text-slate-200">{t.qcParams.taste || 'N/A'}</span>
                            </div>
                            <div>
                              <span className="text-slate-400 text-[9px] uppercase font-bold block">Texture</span>
                              <span className="font-bold text-slate-800 dark:text-slate-200">{t.qcParams.texture || 'N/A'}</span>
                            </div>
                            <div>
                              <span className="text-slate-400 text-[9px] uppercase font-bold block">Safety</span>
                              <span className="font-bold text-slate-800 dark:text-slate-200">{t.qcParams.safety || 'N/A'}</span>
                            </div>
                            <div>
                              <span className="text-slate-400 text-[9px] uppercase font-bold block">Appearance</span>
                              <span className="font-bold text-slate-800 dark:text-slate-200">{t.qcParams.appearance || 'N/A'}</span>
                            </div>
                            <div className="col-span-2 sm:col-span-1">
                              <span className="text-slate-400 text-[9px] uppercase font-bold block">Weight / Port.</span>
                              <span className="font-bold text-slate-800 dark:text-slate-200">{t.qcParams.weightPortion || 'N/A'}</span>
                            </div>
                          </div>
                        )}

                        {t.qcNotes && (
                          <div className="text-2xs text-slate-455 italic pt-1 flex items-start gap-1">
                            <Info className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0" />
                            <span>Notes: "{t.qcNotes}"</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            )}
          </div>

          {/* RIGHT COLUMN: Costs, Linked Orders & QR code */}
          <div className="space-y-5">
            {/* Financial cost summary */}
            <Card className="rounded-2xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
              <CardHeader className="pb-3 border-b dark:border-slate-800">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <DollarSign className="w-4 h-4 text-indigo-550" /> Production Cost Ledger
                </h3>
              </CardHeader>
              <CardContent className="pt-4 space-y-3 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-slate-450 font-medium">Production Cost:</span>
                  <span className="font-mono font-bold text-slate-855 dark:text-white">
                    ₹{Number(detailBatch.totalCost || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-455 font-medium">Target Sale Price:</span>
                  <span className="font-mono font-bold text-slate-855 dark:text-white">
                    ₹{Number(detailBatch.salePrice || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t dark:border-slate-800 font-semibold text-indigo-600 dark:text-indigo-400">
                  <span>Margin Profit:</span>
                  <span>{detailBatch.profitMargin}%</span>
                </div>
              </CardContent>
            </Card>

            {/* Linked Sales Order */}
            <Card className="rounded-2xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
              <CardHeader className="pb-3 border-b dark:border-slate-800">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Award className="w-4 h-4 text-violet-500" /> Linked Customer Order
                </h3>
              </CardHeader>
              <CardContent className="pt-4 text-xs">
                {detailBatch.order ? (
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-450">Customer Name:</span>
                      <span className="font-bold text-slate-800 dark:text-slate-205">{detailBatch.order.customer?.name || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-455">Order Reference:</span>
                      <span className="font-mono font-bold text-indigo-605 dark:text-indigo-400">{detailBatch.order.referenceNo || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-455">Order Received Value:</span>
                      <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                        ₹{Number(detailBatch.order.totalSubtotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                ) : (
                  <span className="text-slate-455 italic block py-2">Make to Stock (No linked customer order)</span>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  // Derived stats overview counts
  const totalActive = batches.filter(b => ['Planned', 'In Progress', 'On Hold'].includes(b.status)).length;
  const totalCompleted = batches.filter(b => ['Completed', 'qc_passed'].includes(b.status)).length;
  const qcPassedCount = batches.filter(b => b.status === 'qc_passed').length;
  const totalWithQc = batches.filter(b => ['qc_passed', 'qc_failed'].includes(b.status)).length;
  const qcPassRate = totalWithQc > 0 ? Math.round((qcPassedCount / totalWithQc) * 100) : 100;

  return (
    <div className="w-full max-w-full px-4 sm:px-6 lg:px-8 py-5 space-y-4 mx-auto transition-all duration-300">
      <DashboardBackButton />
      {!canEdit && (
        <div className="flex items-center gap-3 p-4 bg-amber-50 dark:bg-amber-955/20 border border-amber-200 dark:border-amber-900/50 rounded-2xl text-amber-800 dark:text-amber-300 text-sm font-medium animate-in fade-in slide-in-from-top-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
          <span>You have <strong>Read-Only access</strong> to Batch Execution Center. Starting, completing, or scheduling batches is restricted.</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-slate-200 dark:border-slate-850">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <Factory className="w-5.5 h-5.5 text-indigo-650" />
            Batch Execution Center
          </h1>
          <p className="text-xs text-slate-550 dark:text-slate-400 mt-0.5">
            Manage SOP execution recipe runs and quality controls.
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          {/* Display Mode Selector */}
          <div className="flex bg-slate-100 dark:bg-slate-900 p-0.5 rounded-xl border border-slate-250 dark:border-slate-800 h-9 items-center shadow-xs">
            {[
              { mode: 'pipeline', label: 'Pipeline', icon: LayoutGrid },
              { mode: 'grid', label: 'Grid', icon: Grid },
              { mode: 'table', label: 'Table', icon: ListIcon }
            ].map(item => (
              <button
                key={item.mode}
                type="button"
                onClick={() => setDisplayMode(item.mode)}
                className={`px-3.5 py-1.5 rounded-lg text-2xs font-bold flex items-center gap-1 transition-all h-8 ${
                  displayMode === item.mode
                    ? 'bg-white dark:bg-slate-800 text-indigo-650 dark:text-indigo-400 shadow-sm border border-slate-200/30 dark:border-slate-700'
                    : 'text-slate-505 hover:text-slate-750 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
                title={`${item.label} View`}
              >
                <item.icon className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{item.label}</span>
              </button>
            ))}
          </div>

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

      {/* Stats Summary Panel */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-xs">
        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-850 p-4 rounded-2xl flex items-center justify-between shadow-xs">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Active Batches</span>
            <span className="text-xl font-black text-slate-900 dark:text-white block mt-0.5">{totalActive}</span>
          </div>
          <div className="p-2 bg-amber-50 dark:bg-amber-955/20 text-amber-600 dark:text-amber-400 rounded-xl shrink-0">
            <Activity className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-850 p-4 rounded-2xl flex items-center justify-between shadow-xs">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Completed Batches</span>
            <span className="text-xl font-black text-slate-900 dark:text-white block mt-0.5">{totalCompleted}</span>
          </div>
          <div className="p-2 bg-indigo-50 dark:bg-indigo-955/20 text-indigo-600 dark:text-indigo-400 rounded-xl shrink-0">
            <Check className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-850 p-4 rounded-2xl flex items-center justify-between shadow-xs">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">QC Pass Rate</span>
            <span className="text-xl font-black text-slate-900 dark:text-white block mt-0.5">{qcPassRate}%</span>
          </div>
          <div className="p-2 bg-emerald-50 dark:bg-emerald-955/20 text-emerald-600 dark:text-emerald-450 rounded-xl shrink-0">
            <Award className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-850 p-4 rounded-2xl flex items-center justify-between shadow-xs">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">QC Passed Yield</span>
            <span className="text-xl font-black text-slate-900 dark:text-white block mt-0.5">{qcPassedCount}</span>
          </div>
          <div className="p-2 bg-violet-50 dark:bg-violet-955/20 text-violet-600 dark:text-violet-400 rounded-xl shrink-0">
            <Info className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filters toolbar */}
      <div className="bg-slate-50/50 dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-205 dark:border-slate-800 shadow-xs flex flex-col md:flex-row gap-3 justify-between items-center text-xs">
        <form onSubmit={handleSearch} className="flex items-center gap-2 w-full md:w-auto flex-1">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-405" />
            <Input 
              placeholder="Search by batch ref or product spec name..." 
              className="pl-9 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-750 text-slate-850 dark:text-white rounded-xl focus:ring-indigo-500 h-9 text-xs"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Button type="submit" variant="outline" className="border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-bold rounded-xl h-9 cursor-pointer">Search</Button>
        </form>

        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto justify-end">
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 h-9 font-semibold"
          >
            <option value="">All Statuses</option>
            <option value="Planned">Planned</option>
            <option value="In Progress">In Progress</option>
            <option value="Completed">Completed</option>
            <option value="On Hold">On Hold</option>
            <option value="Cancelled">Cancelled</option>
            <option value="qc_passed">QC Passed</option>
            <option value="qc_failed">QC Failed</option>
          </select>

          <select
            value={datePreset}
            onChange={(e) => handlePresetChange(e.target.value)}
            className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 h-9 font-semibold"
          >
            <option value="">All Time</option>
            <option value="Today">Today</option>
            <option value="Yesterday">Yesterday</option>
            <option value="This Week">This Week</option>
            <option value="This Month">This Month</option>
            <option value="Date Range">Custom Date Range</option>
          </select>

          {datePreset === 'Date Range' && (
            <div className="flex items-center gap-2 animate__animated animate__fadeIn">
              <DatePicker
                placeholder="Start Date"
                value={startDate}
                onChange={setStartDate}
                className="w-40 space-y-0"
                triggerClassName="h-9 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-1.5 text-xs text-slate-800 dark:text-slate-200 shadow-none font-semibold"
              />
              <span className="text-slate-400 font-medium">to</span>
              <DatePicker
                placeholder="End Date"
                value={endDate}
                onChange={setEndDate}
                className="w-40 space-y-0"
                triggerClassName="h-9 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-1.5 text-xs text-slate-800 dark:text-slate-200 shadow-none font-semibold"
              />
            </div>
          )}
        </div>
      </div>
      {displayMode === 'pipeline' && (
        <div className="flex-1 grid grid-cols-1 md:grid-cols-5 gap-4 items-start pb-5">
          {PIPELINE_COLUMNS.map(col => {
            const c = PIPELINE_COLOR_MAP[col.color];
            const items = getPipelineFiltered(col.key);
            return (
              <div key={col.key} className="bg-white/85 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl flex flex-col overflow-hidden shadow-xs">
                {/* Column Header */}
                <div className={`px-3 py-2 border-b border-slate-200 dark:border-slate-800 ${c.header} border flex items-center justify-between`}>
                  <div className="flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${c.dot}`} />
                    <span className="text-[10px] font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">{col.label}</span>
                  </div>
                  <span className={`px-2 py-0.5 rounded-lg text-[9px] font-bold ${c.badge}`}>
                    {items.length}
                  </span>
                </div>

                {/* Cards Container */}
                <div className="flex flex-col gap-2.5 p-2.5 overflow-y-auto max-h-[65vh] scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800 scrollbar-track-transparent">
                  {items.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-slate-400 dark:text-slate-600 gap-1.5">
                      <Factory className="w-8 h-8 opacity-30" />
                      <span className="text-[10px] font-medium">No active batches</span>
                    </div>
                  ) : (
                    items.map(batch => {
                      const dateStr = new Date(batch.startDate).toLocaleDateString('en-GB');
                      return (
                        <div
                          key={batch.id}
                          className={`bg-white dark:bg-slate-950 border ${c.card_border} rounded-xl p-3.5 space-y-3 transition-all duration-200 hover:shadow-md ${c.glow} relative flex flex-col justify-between`}
                        >
                          <div className="space-y-2">
                            <div className="flex justify-between items-center">
                              <span className="font-mono text-[9px] font-bold text-slate-450">#{batch.referenceNo}</span>
                              {batch.status === 'On Hold' && (
                                <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400 text-[8px] font-bold">On Hold</span>
                              )}
                            </div>
                            <div>
                              <h4 className="font-bold text-slate-800 dark:text-slate-200 text-[11px] leading-tight line-clamp-2">
                                {batch.product?.name}
                              </h4>
                              {batch.product?.category?.name && (
                                <span className="text-[8px] uppercase tracking-wider font-extrabold text-slate-400 mt-1 block">
                                  {batch.product.category.name}
                                </span>
                              )}
                            </div>
                            <div className="grid grid-cols-2 gap-1.5 pt-2 border-t border-slate-100 dark:border-slate-800/40 text-[10px] text-slate-500">
                              <div>
                                <span className="text-slate-400 block uppercase font-semibold text-[8px]">Target</span>
                                <span className="font-bold text-slate-700 dark:text-slate-300">{batch.quantity} {batch.product?.unit?.abbreviation || 'pcs'}</span>
                              </div>
                              {batch.actualOutput !== null && (
                                <div>
                                  <span className="text-slate-400 block uppercase font-semibold text-[8px]">Actual</span>
                                  <span className="font-bold text-slate-700 dark:text-slate-300">{batch.actualOutput} {batch.product?.unit?.abbreviation || 'pcs'}</span>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Quick Actions Footer */}
                          <div className="pt-2 border-t border-slate-100 dark:border-slate-800/50 flex gap-1.5 items-center justify-between">
                            <div className="flex gap-1 items-center flex-1">
                              {canEdit && batch.status === 'Planned' && (
                                <button
                                  type="button"
                                  onClick={() => handleUpdateStatus(batch.id, 'In Progress')}
                                  className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[9px] font-bold transition-all shadow-xs flex-1 flex items-center justify-center gap-0.5 cursor-pointer"
                                >
                                  <Play className="w-2.5 h-2.5" /> Start
                                </button>
                              )}
                              {canEdit && batch.status === 'In Progress' && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => handleOpenCompletionModal(batch)}
                                    className="px-2 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[9px] font-bold transition-all shadow-xs flex-1 flex items-center justify-center gap-0.5 cursor-pointer"
                                  >
                                    <CheckCircle className="w-2.5 h-2.5" /> Done
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
                                  className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[9px] font-bold transition-all shadow-xs flex-1 flex items-center justify-center gap-0.5 cursor-pointer"
                                >
                                  <Play className="w-2.5 h-2.5" /> Resume
                                </button>
                              )}
                            </div>
                            
                            <div className="flex gap-0.5">
                              <button
                                type="button"
                                onClick={() => setSelectedSopBatch(batch)}
                                className="p-1 hover:bg-indigo-50 dark:hover:bg-indigo-905/30 text-indigo-650 dark:text-indigo-400 rounded-lg cursor-pointer animate-pulse"
                                title="View SOP Recipe"
                              >
                                <BookOpen className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleOpenDetailModal(batch)}
                                className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 cursor-pointer"
                                title="Batch Logs"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                            </div>
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
      )}

      {/* BATCHES CARD GRID LISTING */}
      {displayMode === 'grid' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          {loading ? (
            <div className="col-span-full py-16 text-center text-slate-400 text-xs">Loading batch details...</div>
          ) : batches.length === 0 ? (
            <div className="col-span-full py-16 text-center text-slate-400 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-xs">No production batches matched your filter logs.</div>
          ) : (
            batches.map(batch => {
              const dateStr = new Date(batch.startDate).toLocaleDateString('en-GB');
              return (
                <Card 
                  key={batch.id} 
                  className="group overflow-hidden border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 rounded-2xl flex flex-col justify-between"
                >
                  <div className="p-4 space-y-3">
                    <div className="flex justify-between items-start gap-1">
                      <span className="font-mono text-3xs font-bold text-slate-400 tracking-wider">#{batch.referenceNo}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                        batch.status === 'Planned' ? 'bg-blue-50 dark:bg-blue-955/20 text-blue-700 dark:text-blue-400' :
                        batch.status === 'In Progress' ? 'bg-amber-50 dark:bg-amber-955/20 text-amber-700 dark:text-amber-400' :
                        batch.status === 'Completed' ? 'bg-indigo-50 dark:bg-indigo-955/20 text-indigo-700 dark:text-indigo-400' :
                        batch.status === 'qc_passed' ? 'bg-emerald-50 dark:bg-emerald-955/20 text-emerald-700 dark:text-emerald-450 border border-emerald-100 dark:border-emerald-950' :
                        batch.status === 'qc_failed' ? 'bg-rose-50 dark:bg-rose-955/20 text-rose-700 dark:text-rose-450 border border-rose-100 dark:border-rose-950' :
                        'bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-400'
                      }`}>
                        {batch.status === 'qc_passed' ? 'Passed QC' : batch.status === 'qc_failed' ? 'Failed QC' : batch.status}
                      </span>
                    </div>

                    <div>
                      <h4 className="font-bold text-slate-855 dark:text-slate-100 text-sm line-clamp-1 group-hover:text-indigo-650 dark:group-hover:text-indigo-400 transition-colors">
                        {batch.product?.name}
                      </h4>
                      {batch.product?.category?.name && (
                        <span className="text-[9px] uppercase tracking-wider font-extrabold text-slate-400 mt-0.5 block">
                          {batch.product.category.name}
                        </span>
                      )}
                      <p className="text-[10px] text-slate-400 mt-1 flex items-center gap-1.5 font-medium">
                        <Calendar className="w-3.5 h-3.5" /> Start: {dateStr}
                      </p>
                    </div>

                    <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-455">Planned Yield:</span>
                        <span className="font-bold dark:text-slate-205">{batch.quantity} {batch.product?.unit?.abbreviation || 'pcs'}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-455">Production Cost:</span>
                        <span className="font-mono font-bold text-slate-700 dark:text-slate-305">₹{Number(batch.totalCost).toLocaleString('en-IN')}</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions drawer footer */}
                  <div className="p-3 bg-slate-50/50 dark:bg-slate-950/20 border-t border-slate-105 dark:border-slate-800 flex gap-2">
                    {canEdit && batch.status === 'Planned' && (
                      <Button
                        size="sm"
                        onClick={() => handleUpdateStatus(batch.id, 'In Progress')}
                        className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] py-1.5 rounded-xl cursor-pointer"
                      >
                        <Play className="w-3.5 h-3.5 mr-1" /> Start
                      </Button>
                    )}
                    {canEdit && batch.status === 'In Progress' && (
                      <>
                        <Button
                          size="sm"
                          onClick={() => handleOpenCompletionModal(batch)}
                          className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[10px] py-1.5 rounded-xl cursor-pointer"
                        >
                          <CheckCircle className="w-3.5 h-3.5 mr-1" /> Complete
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleUpdateStatus(batch.id, 'On Hold')}
                          className="p-1.5 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-500/10 rounded-xl cursor-pointer"
                        >
                          <Pause className="w-4 h-4" />
                        </Button>
                      </>
                    )}
                    {canEdit && batch.status === 'On Hold' && (
                      <Button
                        size="sm"
                        onClick={() => handleUpdateStatus(batch.id, 'In Progress')}
                        className="flex-1 bg-emerald-650 hover:bg-emerald-700 text-white font-bold text-[10px] py-1.5 rounded-xl cursor-pointer"
                      >
                        <Play className="w-3.5 h-3.5 mr-1" /> Resume
                      </Button>
                    )}
                    
                    {/* SOP Button */}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setSelectedSopBatch(batch)}
                      className="font-bold text-[10px] py-1.5 rounded-xl border-slate-205 dark:border-slate-800 text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-950/20 cursor-pointer"
                    >
                      <BookOpen className="w-3.5 h-3.5 mr-1" /> SOP
                    </Button>

                    {/* View Button */}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleOpenDetailModal(batch)}
                      className={`font-bold text-[10px] py-1.5 rounded-xl border-slate-205 dark:border-slate-800 ${
                        ['Completed', 'qc_passed', 'qc_failed'].includes(batch.status) || !canEdit ? 'flex-1' : ''
                      } text-slate-700 dark:text-slate-300 cursor-pointer`}
                    >
                      <Eye className="w-3.5 h-3.5 mr-1" /> View
                    </Button>
                  </div>
                </Card>
              );
            })
          )}
        </div>
      )}

      {/* TABLE LISTING MODE */}
      {displayMode === 'table' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-205 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto text-xs">
            <Table>
              <TableHeader className="bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 uppercase font-semibold">
                <TableRow className="dark:border-slate-800">
                  <TableHead className="px-6 py-4">Batch Ref</TableHead>
                  <TableHead className="px-6 py-4">Product Name</TableHead>
                  <TableHead className="px-6 py-4 text-center">Type</TableHead>
                  <TableHead className="px-6 py-4 text-right">Target Quantity</TableHead>
                  <TableHead className="px-6 py-4 text-center">Start Date</TableHead>
                  <TableHead className="px-6 py-4 text-center">Status</TableHead>
                  <TableHead className="px-6 py-4 text-right">Batch Cost</TableHead>
                  <TableHead className="px-6 py-4 text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-slate-100 dark:divide-slate-800">
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="px-6 py-12 text-center text-slate-405">Loading production batches...</TableCell>
                  </TableRow>
                ) : batches.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="px-6 py-12 text-center text-slate-405">No production batches found.</TableCell>
                  </TableRow>
                ) : (
                  batches.map(batch => (
                    <TableRow key={batch.id} className="dark:border-slate-800 hover:bg-slate-50/45 dark:hover:bg-slate-950/10 transition-colors">
                      <TableCell className="px-6 py-4 font-mono font-bold text-slate-500">{batch.referenceNo}</TableCell>
                      <TableCell className="px-6 py-4 font-bold text-slate-855 dark:text-slate-100">{batch.product?.name}</TableCell>
                      <TableCell className="px-6 py-4 text-center text-slate-500 font-semibold">{batch.productionType}</TableCell>
                      <TableCell className="px-6 py-4 text-right font-bold text-slate-900 dark:text-white">
                        {batch.quantity} <span className="text-[10px] font-normal text-slate-400">{batch.product?.unit?.abbreviation}</span>
                      </TableCell>
                      <TableCell className="px-6 py-4 text-center text-slate-500 font-semibold">
                        {new Date(batch.startDate).toLocaleDateString('en-GB')}
                      </TableCell>
                      <TableCell className="px-6 py-4 text-center">
                        <span className={`px-2.5 py-1 text-[10px] font-bold rounded-full ${
                          batch.status === 'Planned'
                            ? 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400'
                            : batch.status === 'In Progress'
                            ? 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400'
                            : batch.status === 'Completed'
                            ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400'
                            : batch.status === 'qc_passed'
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400'
                            : batch.status === 'qc_failed'
                            ? 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-455'
                            : 'bg-slate-50 text-slate-700 dark:bg-slate-500/10 dark:text-slate-400'
                        }`}>
                          {batch.status === 'qc_passed' ? 'Passed QC' : batch.status === 'qc_failed' ? 'Failed QC' : batch.status}
                        </span>
                      </TableCell>
                      <TableCell className="px-6 py-4 text-right font-mono font-bold text-slate-855 dark:text-white">
                        ₹{Number(batch.totalCost).toLocaleString('en-IN')}
                      </TableCell>
                      <TableCell className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center space-x-1">
                          {canEdit && batch.status === 'Planned' && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleUpdateStatus(batch.id, 'In Progress')}
                              className="text-emerald-650 hover:text-emerald-700 p-1.5 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 rounded transition-all"
                              title="Start Production"
                            >
                              <Play className="w-4 h-4" />
                            </Button>
                          )}
                          {canEdit && batch.status === 'In Progress' && (
                            <>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleOpenCompletionModal(batch)}
                                className="text-indigo-650 hover:text-indigo-700 p-1.5 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 rounded transition-all"
                                title="Complete Production"
                              >
                                <CheckCircle className="w-4 h-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleUpdateStatus(batch.id, 'On Hold')}
                                className="text-amber-600 hover:text-amber-700 p-1.5 hover:bg-amber-50 dark:hover:bg-amber-500/10 rounded transition-all"
                                title="Hold Production"
                              >
                                <Pause className="w-4 h-4" />
                              </Button>
                            </>
                          )}
                          {canEdit && batch.status === 'On Hold' && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleUpdateStatus(batch.id, 'In Progress')}
                              className="text-emerald-650 hover:text-emerald-755 p-1.5 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 rounded transition-all cursor-pointer"
                              title="Resume Production"
                            >
                              <Play className="w-4 h-4" />
                            </Button>
                          )}
                          
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setSelectedSopBatch(batch)}
                            className="text-indigo-650 hover:text-indigo-700 p-1.5 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 rounded transition-all cursor-pointer"
                            title="View SOP steps"
                          >
                            <BookOpen className="w-4 h-4 animate-pulse" />
                          </Button>

                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleOpenDetailModal(batch)}
                            className="text-slate-500 hover:text-slate-700 p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-all cursor-pointer"
                            title="View logs"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Pagination control */}
      {totalPages > 1 && (
        <div className="px-4 py-3 border border-slate-205 dark:border-slate-800 rounded-2xl flex flex-col sm:flex-row justify-between items-center gap-3 text-xs bg-slate-50/20 dark:bg-slate-900/20">
          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium order-2 sm:order-1">
            Showing {batches.length === 0 ? 0 : (page - 1) * (displayMode === 'grid' ? 8 : 10) + 1} to {Math.min(page * (displayMode === 'grid' ? 8 : 10), batches.length * page)} entries
          </div>
          <div className="order-1 sm:order-2">
            <Pagination 
              currentPage={page} 
              totalPages={totalPages} 
              onPageChange={setPage} 
            />
          </div>
          <div className="text-xs text-slate-400 font-medium order-3">
            Total entries: {batches.length * totalPages}
          </div>
        </div>
      )}

      {/* Completion Modal Panel */}
      {execBatch && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-50 dark:bg-slate-900 rounded-3xl max-w-3xl w-full max-h-[90vh] overflow-y-auto border border-slate-205 dark:border-slate-800 shadow-2xl p-6 space-y-5 animate__animated animate__zoomIn animate__faster text-xs">
            {/* Full Display Indigo Header */}
            <div className="p-5 bg-gradient-to-r from-indigo-600 to-indigo-800 text-white flex justify-between items-center relative -mx-6 -mt-6 mb-5 rounded-t-3xl shadow-sm">
              <div className="flex items-center space-x-2">
                <ClipboardList className="w-5 h-5 text-indigo-100" />
                <h3 className="text-sm font-extrabold uppercase tracking-wide">
                  Execute Recipe Run: Batch #{execBatch.referenceNo}
                </h3>
              </div>
              <button 
                onClick={() => setExecBatch(null)} 
                className="p-1.5 hover:bg-white/10 text-white/80 hover:text-white rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Left Column: SOP Instructions */}
              <div className="space-y-3">
                <h4 className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Flame className="w-4 h-4 text-orange-500" /> 1. Standard Recipe Steps (Read-only)
                </h4>
                <div className="space-y-2 max-h-[250px] overflow-y-auto pr-1">
                  {execBatch.product?.sopSteps && execBatch.product.sopSteps.length > 0 ? (
                    execBatch.product.sopSteps.map((step, idx) => (
                      <div key={idx} className="p-3 bg-slate-100/50 dark:bg-slate-950 border border-slate-200/60 dark:border-slate-855 rounded-xl space-y-1">
                        <p className="text-[9px] font-black text-indigo-650 dark:text-indigo-400 uppercase">Step #{idx + 1}</p>
                        <p className="text-xs text-slate-700 dark:text-slate-200 font-semibold leading-relaxed">{step.instruction}</p>
                        {(step.tempTime || step.safetyNote) && (
                          <div className="flex justify-between items-center text-[9px] text-slate-400 pt-1.5 border-t dark:border-slate-900 border-dashed mt-1">
                            {step.tempTime && <span className="flex items-center gap-1"><Clock className="w-3 h-3 text-indigo-500" /> {step.tempTime}</span>}
                            {step.safetyNote && <span className="text-rose-500 flex items-center gap-1">⚠️ {step.safetyNote}</span>}
                          </div>
                        )}
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-slate-400 italic">No instructions saved. Standard operating procedures apply.</p>
                  )}
                </div>
              </div>

              {/* Right Column: Actual Usage */}
              <div className="space-y-3">
                <h4 className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Scale className="w-4 h-4 text-indigo-505 dark:text-indigo-400" /> 2. Material Consumption
                </h4>
                <div className="space-y-2.5 max-h-[250px] overflow-y-auto pr-1">
                  {actualRmUsages.map((usage, idx) => {
                    const displayUnit = usage.selectedUnit === 'sub' ? usage.subUomLabel : usage.unit;
                    const displayTarget = usage.selectedUnit === 'sub' ? usage.requiredQty * 1000 : usage.requiredQty;
                    const displayVariance = usage.inputValue - displayTarget;

                    return (
                      <div key={idx} className="p-3 bg-slate-100/50 dark:bg-slate-955 rounded-xl border border-slate-200/60 dark:border-slate-855 space-y-1.5">
                        <div className="flex justify-between items-center text-xs font-semibold">
                          <span className="text-slate-855 dark:text-slate-200">{usage.name}</span>
                          <span className="text-[9px] text-slate-400 font-bold">Target: {displayTarget.toFixed(2)} {displayUnit}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 items-center">
                          <div className="flex items-center gap-1.5 justify-start">
                            <Input
                              type="number"
                              min="0"
                              step={usage.selectedUnit === 'sub' ? '1' : '0.001'}
                              value={usage.inputValue}
                              onChange={(e) => {
                                const val = Number(e.target.value) || 0;
                                const updated = [...actualRmUsages];
                                updated[idx].inputValue = val;
                                updated[idx].actualUsedQty = usage.selectedUnit === 'sub' ? val / 1000 : val;
                                setActualRmUsages(updated);
                              }}
                              className="h-8 w-24 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-205 dark:border-slate-800 font-bold text-slate-850 dark:text-white rounded-lg text-right"
                            />
                            {usage.subUomLabel ? (
                              <select
                                value={usage.selectedUnit || 'base'}
                                onChange={(e) => {
                                  const newUnitType = e.target.value;
                                  const oldUnitType = usage.selectedUnit || 'base';
                                  if (oldUnitType === newUnitType) return;

                                  const updated = [...actualRmUsages];
                                  updated[idx].selectedUnit = newUnitType;
                                  let newQty = usage.inputValue;
                                  if (newUnitType === 'sub') {
                                    newQty = newQty * 1000;
                                  } else {
                                    newQty = newQty / 1000;
                                  }
                                  updated[idx].inputValue = Number(newQty.toFixed(4));
                                  updated[idx].actualUsedQty = newUnitType === 'sub' ? newQty / 1000 : newQty;
                                  setActualRmUsages(updated);
                                }}
                                className="h-8 bg-slate-100/50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-1 text-3xs font-bold text-slate-600 dark:text-slate-350 focus:outline-none"
                              >
                                <option value="base">{usage.unit}</option>
                                <option value="sub">{usage.subUomLabel}</option>
                              </select>
                            ) : (
                              <span className="text-[10px] font-bold text-slate-450 w-8 text-left">{usage.unit}</span>
                            )}
                          </div>
                          <div className="text-right text-[10px]">
                            {displayVariance === 0 ? (
                              <span className="text-emerald-600 dark:text-emerald-450 font-extrabold">Standard</span>
                            ) : displayVariance > 0 ? (
                              <span className="text-amber-600 dark:text-amber-450 font-bold">+{displayVariance.toFixed(1)} {displayUnit} (Over)</span>
                            ) : (
                              <span className="text-indigo-650 dark:text-indigo-400 font-bold">{displayVariance.toFixed(1)} {displayUnit} (Less)</span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Bottom Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t dark:border-slate-800 pt-4">
              <div className="space-y-1">
                <label className="text-[10px] font-extrabold text-slate-555 dark:text-slate-400 uppercase block">Actual Output Yield *</label>
                <Input
                  type="number"
                  min="1"
                  required
                  value={actualOutput}
                  onChange={(e) => setActualOutput(e.target.value)}
                  className="bg-slate-100/50 dark:bg-slate-900 border border-slate-205 dark:border-slate-800 text-slate-855 dark:text-slate-100 rounded-xl h-9"
                  placeholder="Output pieces count"
                />
                <p className="text-[10px] text-slate-400">Calculates finished product inventory batch count.</p>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-extrabold text-slate-555 dark:text-slate-400 uppercase block">Remarks / Deviation Note</label>
                <Input
                  value={completionNote}
                  onChange={(e) => setCompletionNote(e.target.value)}
                  className="bg-slate-100/50 dark:bg-slate-900 border border-slate-205 dark:border-slate-800 text-slate-855 dark:text-slate-100 rounded-xl h-9"
                  placeholder="Record deviations or notes here..."
                />
              </div>
            </div>

            <div className="flex justify-end space-x-2 border-t dark:border-slate-800 pt-4">
              <Button variant="outline" onClick={() => setExecBatch(null)} className="border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold cursor-pointer h-9">Cancel</Button>
              <Button onClick={handleSubmitCompletion} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md cursor-pointer h-9 px-4">
                Submit Completion to QC Queue
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* SOP Steps Modal */}
      {selectedSopBatch && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-2xl w-full border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate__animated animate__zoomIn animate__faster">
            {/* Gradient Header */}
            <div className="p-5 bg-gradient-to-r from-indigo-650 to-violet-600 text-white flex justify-between items-center relative">
              <div className="space-y-1 pr-8">
                <span className="text-[9px] tracking-widest font-black uppercase text-indigo-200 bg-indigo-900/40 px-2 py-0.5 rounded-md">
                  Standard Operating Procedure (SOP)
                </span>
                <h3 className="text-sm sm:text-base font-extrabold truncate">
                  {selectedSopBatch.product?.name}
                </h3>
                <div className="flex gap-2 items-center text-[10px] text-indigo-100">
                  <span className="font-mono">Code: {selectedSopBatch.product?.code}</span>
                  {selectedSopBatch.product?.category?.name && (
                    <>
                      <span>•</span>
                      <span className="font-semibold uppercase tracking-wider bg-white/10 px-2 py-0.5 rounded-full text-[9px]">
                        Category: {selectedSopBatch.product.category.name}
                      </span>
                    </>
                  )}
                </div>
              </div>
              <button 
                onClick={() => setSelectedSopBatch(null)} 
                className="absolute right-4 top-4 p-1.5 hover:bg-white/10 text-white/80 hover:text-white rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* SOP Content body */}
            <div className="p-6 overflow-y-auto space-y-4 flex-1 text-xs">
              <div className="space-y-3">
                <h4 className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Flame className="w-4 h-4 text-orange-500 animate-pulse" /> Manufacturing Steps & Instructions
                </h4>
                
                <div className="space-y-3 pl-1">
                  {selectedSopBatch.product?.sopSteps && selectedSopBatch.product.sopSteps.length > 0 ? (
                    selectedSopBatch.product.sopSteps.map((step, idx) => (
                      <div 
                        key={idx} 
                        className="p-4 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-850 rounded-2xl space-y-2 hover:border-indigo-300 dark:hover:border-indigo-900/60 transition-colors"
                      >
                        <div className="flex justify-between items-center">
                          <span className="px-2.5 py-0.5 rounded-lg text-[9px] font-black bg-indigo-50 dark:bg-indigo-955 text-indigo-600 dark:text-indigo-400 uppercase tracking-wider border dark:border-indigo-900/50">
                            Step #{idx + 1}
                          </span>
                        </div>
                        <p className="text-xs text-slate-800 dark:text-slate-200 font-semibold leading-relaxed">
                          {step.instruction}
                        </p>
                        
                        {(step.tempTime || step.safetyNote) && (
                          <div className="flex flex-col sm:flex-row gap-2 justify-between items-start sm:items-center text-[10px] pt-2 border-t dark:border-slate-900 border-dashed mt-1.5">
                            {step.tempTime && (
                              <span className="flex items-center gap-1.5 text-slate-500 font-medium">
                                <Clock className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                                Parameters: <span className="font-semibold text-slate-700 dark:text-slate-300">{step.tempTime}</span>
                              </span>
                            )}
                            {step.safetyNote && (
                              <span className="text-rose-650 dark:text-rose-400 font-bold flex items-center gap-1 bg-rose-50 dark:bg-rose-955/20 px-2 py-0.5 rounded-lg border border-rose-100/50 dark:border-rose-900/30 animate-pulse">
                                ⚠️ Caution: {step.safetyNote}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="p-8 text-center bg-slate-50 dark:bg-slate-950 rounded-2xl border border-dashed dark:border-slate-850 text-slate-400">
                      <BookOpen className="w-8 h-8 mx-auto opacity-30 mb-2" />
                      <p className="font-medium italic">No custom operating steps saved for this product recipe.</p>
                      <p className="text-[10px] text-slate-450 mt-1">Default GMP guidelines apply.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 bg-slate-50 dark:bg-slate-950 border-t dark:border-slate-850 flex justify-end">
              <Button 
                onClick={() => setSelectedSopBatch(null)} 
                className="bg-indigo-650 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md cursor-pointer h-9 px-5"
              >
                Close SOP
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
