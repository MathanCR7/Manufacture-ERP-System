import React, { useState, useEffect } from 'react';
import { 
  X, Play, Pause, PlayCircle, XCircle, CheckCircle2, 
  Clock, User, Calendar, Factory, Package, Layers, 
  FileText, ShieldCheck, AlertTriangle, ArrowRight, 
  RefreshCw, Database, Sparkles, Scale, Tag, Check, Info,
  Printer, Zap, FlaskConical, Users, HardHat, UserCheck, CheckSquare,
  Maximize2, Minimize2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/axios';
import Swal from 'sweetalert2';
import BatchLabelModal from './BatchLabelModal';
import ProductionCancelModal from './ProductionCancelModal';
import { analyzeProductionBatchNumber } from '../utils/batchNumberUtil';

export default function ProductionBatchDetailModal({
  isOpen = false,
  onClose,
  batchId = null,
  onStatusUpdated,
  onOpenCompleteModal,
  canViewCosting = true
}) {
  const [batch, setBatch] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview'); // 'overview', 'labour', 'timeline', 'sop', 'formulation', 'pauses'
  const [actionLoading, setActionLoading] = useState(false);
  const [showLabelModal, setShowLabelModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);

  const fetchBatchDetail = async () => {
    if (!batchId) return;
    try {
      setLoading(true);
      const res = await api.get(`/production/batches-redesign/${batchId}`);
      setBatch(res.data);
    } catch (err) {
      console.error('Failed to load batch detail:', err);
      Swal.fire({ title: 'Error', text: 'Failed to load batch details.', icon: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setIsFullScreen(false);
      if (batchId) {
        fetchBatchDetail();
      }
    }
  }, [isOpen, batchId]);

  if (!isOpen) return null;

  // Handle Starting Batch
  const handleStart = async () => {
    const confirm = await Swal.fire({
      title: 'Start Production Batch?',
      text: `Are you ready to start Batch #${batch?.referenceNo || batch?.batchNo} on the factory floor?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Yes, Start Floor Run',
      confirmButtonColor: '#4f46e5'
    });
    if (!confirm.isConfirmed) return;

    try {
      setActionLoading(true);
      await api.patch(`/production/batches-redesign/${batch.id}/status`, { status: 'In Progress' });
      Swal.fire({ title: 'Started', text: 'Batch is now In Progress on the factory floor.', icon: 'success', timer: 1500 });
      fetchBatchDetail();
      if (onStatusUpdated) onStatusUpdated();
    } catch (err) {
      Swal.fire({ title: 'Error', text: err.response?.data?.error || 'Failed to start batch.', icon: 'error' });
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Pausing Batch
  const handlePause = async () => {
    const { value: reason } = await Swal.fire({
      title: 'Pause Production Batch',
      text: 'Please enter the reason for pausing this production run:',
      input: 'textarea',
      inputPlaceholder: 'e.g. Machine maintenance, shift handover, temperature calibration...',
      showCancelButton: true,
      confirmButtonText: 'Confirm Pause',
      confirmButtonColor: '#d97706',
      inputValidator: (val) => {
        if (!val || !val.trim()) return 'Reason is required to pause production!';
      }
    });

    if (!reason) return;

    try {
      setActionLoading(true);
      await api.patch(`/production/batches-redesign/${batch.id}/status`, {
        status: 'Paused',
        reason: reason.trim()
      });
      Swal.fire({ title: 'Batch Paused', text: 'Production has been paused and recorded in history.', icon: 'warning', timer: 1500 });
      fetchBatchDetail();
      if (onStatusUpdated) onStatusUpdated();
    } catch (err) {
      Swal.fire({ title: 'Error', text: err.response?.data?.error || 'Failed to pause batch.', icon: 'error' });
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Resuming Batch
  const handleResume = async () => {
    const confirm = await Swal.fire({
      title: 'Resume Production?',
      text: 'Resume floor operations and conclude the current pause record?',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Yes, Resume Run',
      confirmButtonColor: '#4f46e5'
    });
    if (!confirm.isConfirmed) return;

    try {
      setActionLoading(true);
      await api.patch(`/production/batches-redesign/${batch.id}/status`, { status: 'In Progress' });
      Swal.fire({ title: 'Resumed', text: 'Batch is now In Progress again.', icon: 'success', timer: 1500 });
      fetchBatchDetail();
      if (onStatusUpdated) onStatusUpdated();
    } catch (err) {
      Swal.fire({ title: 'Error', text: err.response?.data?.error || 'Failed to resume batch.', icon: 'error' });
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Cancelling Batch - Open Comprehensive Cancel & Waste Allocation Modal
  const handleCancel = () => {
    setShowCancelModal(true);
  };

  const formatCurrency = (val) => {
    return Number(val || 0).toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  const formatDateTime = (dateVal) => {
    if (!dateVal) return '-';
    try {
      const d = new Date(dateVal);
      if (isNaN(d.getTime())) return '-';
      return d.toLocaleString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    } catch {
      return '-';
    }
  };

  const calculateRunDuration = () => {
    if (!batch?.startedAt && !batch?.startDate) return null;
    const start = new Date(batch.startedAt || batch.startDate).getTime();
    const end = batch.completedAt 
      ? new Date(batch.completedAt).getTime() 
      : (batch.status === 'Completed' && batch.completeDate ? new Date(batch.completeDate).getTime() : (batch.status === 'In Progress' ? Date.now() : null));
    
    if (!end || isNaN(start) || isNaN(end) || end < start) return null;
    const diffMs = end - start;
    const totalMins = Math.floor(diffMs / (1000 * 60));
    const hrs = Math.floor(totalMins / 60);
    const mins = totalMins % 60;
    if (hrs > 0) return `${hrs}h ${mins}m`;
    return `${mins} mins`;
  };

  const pauseList = batch?.pauseHistory || [];
  const totalPauseMins = pauseList.reduce((acc, p) => acc + (Number(p.durationMins) || 0), 0);
  const staffList = Array.isArray(batch?.labourStaffDetails) ? batch.labourStaffDetails : [];
  const totalLabourCrew = Math.max(staffList.length, Number(batch?.labourCount || 0), 1);
  const runDuration = calculateRunDuration();
  const batchAnalysis = analyzeProductionBatchNumber(batch?.referenceNo || batch?.batchNo, batch?.startDate || batch?.createdAt);
  const displayRefNo = batchAnalysis?.formattedBatchNo || batch?.referenceNo || batch?.batchNo || 'Production Batch';

  return (
    <div 
      className={`fixed inset-0 z-50 flex items-center justify-center transition-all duration-150 bg-blue-950/20 dark:bg-blue-950/35 backdrop-blur-[2px] animate-in fade-in duration-150 ${
        isFullScreen ? 'p-0' : 'p-2 sm:p-4 md:p-6'
      }`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div 
        className={`w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col overflow-hidden transition-all duration-150 animate-in zoom-in-95 duration-150 ${
          isFullScreen 
            ? 'h-screen w-screen max-w-none max-h-none rounded-none border-0' 
            : 'max-w-5xl lg:max-w-6xl max-h-[88vh] rounded-2xl sm:rounded-3xl'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* ── MODAL HEADER ── */}
        <div className="bg-slate-900 text-white px-3.5 sm:px-5 py-2.5 sm:py-3 flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="p-2 rounded-xl sm:rounded-2xl bg-indigo-500/20 text-indigo-400 border border-indigo-400/30 shrink-0">
              <Factory className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                <h3 className="font-black text-sm sm:text-base text-white font-mono truncate">
                  {displayRefNo}
                </h3>
                {batchAnalysis?.isValid && (
                  <span className="text-[9.5px] sm:text-[10px] font-mono px-1.5 sm:px-2 py-0.5 rounded-md bg-indigo-500/30 text-indigo-200 border border-indigo-400/30 whitespace-nowrap">
                    PROD • {batchAnalysis.formattedDate} • #{batchAnalysis.sequenceFormatted}
                  </span>
                )}
                <span className={`px-2 py-0.5 rounded-full text-[9.5px] sm:text-[10px] font-bold whitespace-nowrap ${
                  batch?.status === 'Completed' || batch?.status === 'qc_passed'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30'
                    : batch?.status === 'In Progress'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-400/30'
                    : batch?.status === 'Paused'
                    ? 'bg-purple-500/20 text-purple-300 border border-purple-400/30'
                    : batch?.status === 'Cancelled'
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-400/30'
                    : 'bg-indigo-500/20 text-indigo-300 border border-indigo-400/30'
                }`}>
                  {batch?.status || 'Planned'}
                </span>
                <span className="text-[9.5px] sm:text-[10px] font-mono text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full whitespace-nowrap hidden sm:inline-block">
                  {batch?.productionType || 'STANDARD'}
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-slate-400 mt-0.5 truncate">
                {batch?.product?.name || 'Finished Goods Product'}
                {batch?.baseName ? ` • ${batch.baseName}` : ''}
                {batch?.order?.customer?.name ? ` • Client: ${batch.order.customer.name}` : ''}
                {batch?.adjustmentReason ? ` • ${batch.adjustmentReason}` : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0 ml-2">
            <button
              type="button"
              onClick={() => setIsFullScreen(prev => !prev)}
              className="text-slate-400 hover:text-white rounded-xl p-1.5 transition-colors cursor-pointer hover:bg-slate-800"
              title={isFullScreen ? "Restore Standard Minimized Size" : "Expand to Full Screen"}
              aria-label={isFullScreen ? "Restore Standard Minimized Size" : "Expand to Full Screen"}
            >
              {isFullScreen ? (
                <Minimize2 className="w-4 h-4 text-indigo-400" />
              ) : (
                <Maximize2 className="w-4 h-4 text-slate-300 hover:text-white" />
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-white rounded-xl p-1.5 transition-colors cursor-pointer hover:bg-slate-800"
              title="Close"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ── ACTION CONTROLS BAR (Single Row, Zero Overlap, Responsive) ── */}
        <div className="bg-slate-50/95 dark:bg-slate-950/70 px-4 sm:px-6 py-2 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 overflow-x-auto scrollbar-none flex-nowrap text-xs shrink-0 select-none">
          
          {/* Group 1: Floor Operations & Labels */}
          <div className="flex items-center gap-2 shrink-0 flex-nowrap">
            {(batch?.status === 'Planned' || batch?.status === 'Draft') && (
              <Button
                size="sm"
                disabled={actionLoading}
                onClick={handleStart}
                className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-8 px-3 shadow-2xs cursor-pointer flex items-center gap-1.5 shrink-0"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                Start Production
              </Button>
            )}

            {batch?.status === 'In Progress' && (
              <>
                <Button
                  size="sm"
                  disabled={actionLoading}
                  onClick={handlePause}
                  className="rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold h-8 px-3 shadow-2xs cursor-pointer flex items-center gap-1.5 shrink-0"
                >
                  <Pause className="w-3.5 h-3.5 fill-current" />
                  Pause Floor Run
                </Button>

                <Button
                  size="sm"
                  disabled={actionLoading}
                  onClick={() => {
                    onClose();
                    if (onOpenCompleteModal) onOpenCompleteModal(batch);
                  }}
                  className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-8 px-3 shadow-2xs cursor-pointer flex items-center gap-1.5 shrink-0"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Complete & Record Actual Yield
                </Button>
              </>
            )}

            {batch?.status === 'Paused' && (
              <Button
                size="sm"
                disabled={actionLoading}
                onClick={handleResume}
                className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-8 px-3 shadow-2xs cursor-pointer flex items-center gap-1.5 shrink-0"
              >
                <PlayCircle className="w-3.5 h-3.5" />
                Resume Floor Run
              </Button>
            )}

            {batch?.status !== 'Completed' && batch?.status !== 'Cancelled' && batch?.status !== 'qc_passed' && (
              <Button
                variant="outline"
                size="sm"
                disabled={actionLoading}
                onClick={handleCancel}
                className="rounded-xl text-rose-600 border-rose-200 hover:bg-rose-50 dark:hover:bg-rose-950/30 h-8 px-3 font-bold shrink-0"
              >
                <XCircle className="w-3.5 h-3.5 mr-1" />
                Cancel Run
              </Button>
            )}

            <Button
              variant="outline"
              size="sm"
              disabled={batch?.status === 'Cancelled'}
              onClick={() => {
                if (batch?.status === 'Cancelled') return;
                setShowLabelModal(true);
              }}
              title={batch?.status === 'Cancelled' ? 'Cannot print GS1 labels for cancelled production batch' : 'Print GS1 Batch Label / Barcode'}
              className={`rounded-xl border h-8 px-3 flex items-center gap-1.5 font-bold transition-all shrink-0 ${
                batch?.status === 'Cancelled'
                  ? 'border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-600 opacity-50 cursor-not-allowed bg-slate-50 dark:bg-slate-900/40'
                  : 'border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 cursor-pointer shadow-3xs'
              }`}
            >
              <Printer className="w-3.5 h-3.5 text-slate-500" />
              GS1 Label / Barcode
            </Button>
          </div>

          {/* Group 2: Quick Jump Highlighting (Middle) */}
          <div className="flex items-center gap-2 shrink-0 flex-nowrap">
            <div className="h-5 w-px bg-slate-200 dark:bg-slate-700 mx-1 hidden lg:block" />

            <button
              type="button"
              onClick={() => setActiveTab('formulation')}
              className={`h-8 px-3 rounded-xl font-bold flex items-center gap-1.5 transition-all cursor-pointer border shrink-0 text-xs shadow-3xs ${
                activeTab === 'formulation'
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                  : 'bg-indigo-50/80 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100'
              }`}
              title="View Raw Materials that need to be used for this production run with highlighted planned quantities"
            >
              <Database className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-300" />
              <span>Raw Materials to Use</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-black ${
                activeTab === 'formulation' ? 'bg-white/20 text-white' : 'bg-indigo-200/80 dark:bg-indigo-900 text-indigo-800 dark:text-indigo-200'
              }`}>
                {batch?.rmUsages?.length || 0}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('labour')}
              className={`h-8 px-3 rounded-xl font-bold flex items-center gap-1.5 transition-all cursor-pointer border shrink-0 text-xs shadow-3xs ${
                activeTab === 'labour'
                  ? 'bg-amber-600 text-white border-amber-600 shadow-sm'
                  : 'bg-amber-50/80 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800 hover:bg-amber-100'
              }`}
              title="View assigned operators and floor staff details"
            >
              <Users className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              <span>Assigned Staff</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-black ${
                activeTab === 'labour' ? 'bg-white/20 text-white' : 'bg-amber-200/80 dark:bg-amber-900 text-amber-800 dark:text-amber-200'
              }`}>
                {totalLabourCrew}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('sop')}
              className={`h-8 px-3 rounded-xl font-bold flex items-center gap-1.5 transition-all cursor-pointer border shrink-0 text-xs shadow-3xs ${
                activeTab === 'sop'
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                  : 'bg-emerald-50/80 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100'
              }`}
              title="View Standard Operating Procedure (SOP) step-by-step guidance"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>View SOP Guide</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                activeTab === 'sop' ? 'bg-white/20 text-white' : 'bg-emerald-200/80 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200'
              }`}>
                SOP
              </span>
            </button>
          </div>

          {/* Group 3: Production Yield & Target Metrics (Right) */}
          <div className="flex items-center gap-2 shrink-0 flex-nowrap font-mono">
            <div className="h-5 w-px bg-slate-200 dark:bg-slate-700 mx-1 hidden lg:block" />

            <div className="px-2.5 py-1 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center gap-1.5 text-xs shadow-3xs shrink-0">
              <span className="text-slate-400 font-sans text-[11px] font-bold">Planned:</span>
              <strong className="text-slate-800 dark:text-slate-200 font-black">{batch?.quantity} {batch?.productUom || 'Nos'}</strong>
            </div>

            {batch?.actualOutput !== null && batch?.actualOutput !== undefined ? (
              <div className="px-2.5 py-1 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 flex items-center gap-1.5 text-xs shadow-3xs shrink-0">
                <span className="text-emerald-700 dark:text-emerald-300 font-sans text-[11px] font-bold">Actual Yield:</span>
                <strong className="text-emerald-700 dark:text-emerald-300 font-black">{batch.actualOutput} {batch?.productUom || 'Nos'}</strong>
              </div>
            ) : (
              <div className="px-2.5 py-1 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-800 text-[11px] font-bold text-amber-700 dark:text-amber-300 flex items-center gap-1.5 shrink-0 shadow-3xs">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse shrink-0" />
                <span>Pending Yield</span>
              </div>
            )}
          </div>

        </div>

        {/* ── TABS NAVIGATION (Full Width, Complete Display) ── */}
        <div className="flex items-center px-4 sm:px-6 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-bold overflow-x-auto scrollbar-none shrink-0 gap-1 select-none">
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className={`py-2.5 px-3 border-b-2 transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 shrink-0 ${
              activeTab === 'overview'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Factory className="w-3.5 h-3.5" />
            <span>Overview & Lifecycle</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('labour')}
            className={`py-2.5 px-3 border-b-2 transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 shrink-0 ${
              activeTab === 'labour'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Labour & Floor Crew ({staffList.length || batch?.labourCount || 1})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('pauses')}
            className={`py-2.5 px-3 border-b-2 transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 shrink-0 ${
              activeTab === 'pauses'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Pauses History ({pauseList.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('timeline')}
            className={`py-2.5 px-3 border-b-2 transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 shrink-0 ${
              activeTab === 'timeline'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Factory Stages Timeline ({batch?.timelineStages?.length || 0})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('formulation')}
            className={`py-2.5 px-3 border-b-2 transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 shrink-0 ${
              activeTab === 'formulation'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            <span>RM Formulation & Per-Piece Usage ({batch?.rmUsages?.length || 0})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('sop')}
            className={`py-2.5 px-3 border-b-2 transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 shrink-0 ${
              activeTab === 'sop'
                ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>View SOP Guide</span>
            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
              SOP
            </span>
          </button>
        </div>

        {/* ── TAB CONTENT BODY ── */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          
          {loading ? (
            <div className="py-16 text-center text-slate-400">
              <RefreshCw className="w-7 h-7 animate-spin mx-auto mb-2 text-indigo-500" />
              Loading production batch details...
            </div>
          ) : !batch ? (
            <div className="py-16 text-center text-slate-400">
              Batch information not found.
            </div>
          ) : (
            <>
              {/* ── 1. OVERVIEW & LIFECYCLE ── */}
              {activeTab === 'overview' && (
                <div className="space-y-4">
                  {/* Top 4 Meta Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-850 border border-slate-200/80 dark:border-slate-800">
                      <p className="text-[10px] font-bold text-slate-400 uppercase">Started Details</p>
                      <h4 className="text-xs font-black text-slate-900 dark:text-white mt-1">
                        {batch.startedAt ? new Date(batch.startedAt).toLocaleString('en-GB') : 'Not Started'}
                      </h4>
                      <p className="text-[10px] text-indigo-600 dark:text-indigo-400 font-mono mt-0.5">
                        By: {batch.startedBy || 'Pending Run'}
                      </p>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-850 border border-slate-200/80 dark:border-slate-800">
                      <p className="text-[10px] font-bold text-slate-400 uppercase">Completed Yield</p>
                      <h4 className="text-xs font-black text-emerald-600 mt-1">
                        {batch.actualOutput ?? 'In Production'} {batch.actualOutput ? batch.productUom : ''}
                      </h4>
                      <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                        Planned: {batch.quantity} {batch.productUom}
                      </p>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-850 border border-slate-200/80 dark:border-slate-800">
                      <p className="text-[10px] font-bold text-slate-400 uppercase">Total Pause Time</p>
                      <h4 className="text-xs font-black text-amber-600 mt-1">
                        {totalPauseMins} mins ({pauseList.length} events)
                      </h4>
                      <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                        Status: {batch.status}
                      </p>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-850 border border-slate-200/80 dark:border-slate-800">
                      <p className="text-[10px] font-bold text-slate-400 uppercase">Stock Update Status</p>
                      <h4 className={`text-xs font-black mt-1 ${batch.status === 'Completed' || batch.status === 'qc_passed' ? 'text-emerald-600' : 'text-amber-600'}`}>
                        {batch.status === 'Completed' || batch.status === 'qc_passed' ? '✓ Stock Deducted' : 'Pending Completion'}
                      </h4>
                      <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                        Target UOM: {batch.productUom}
                      </p>
                    </div>
                  </div>

                  {/* Batch Details Specs Grid */}
                  <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-4 shadow-3xs space-y-3">
                    <h4 className="text-xs font-extrabold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                      <Info className="w-3.5 h-3.5 text-indigo-500" />
                      Batch Specifications & Routing
                    </h4>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                      <div>
                        <span className="text-[10px] text-slate-400 block font-bold">Base Master</span>
                        <span className="font-extrabold text-slate-800 dark:text-slate-200">{batch.baseName}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block font-bold">Template Recipe</span>
                        <span className="font-extrabold text-slate-800 dark:text-slate-200">{batch.templateName}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block font-bold">Floor Shift</span>
                        <span className="font-extrabold text-slate-800 dark:text-slate-200">{batch.shift}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block font-bold">Machine Line</span>
                        <span className="font-extrabold text-slate-800 dark:text-slate-200">{batch.machineLine}</span>
                      </div>
                    </div>
                  </div>

                  {/* ── LINKED CUSTOMER SALES ORDER (For Order-Based Batches) ── */}
                  {(batch.order || batch.productionType === 'ORDER_BASED' || batch.orderId) && (
                    <div className="bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 rounded-2xl p-4 shadow-3xs flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <span className="text-[10px] font-bold text-indigo-700 dark:text-indigo-300 uppercase tracking-wider block">
                          Linked Customer Sales Order
                        </span>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className="font-mono font-black text-xs text-indigo-700 dark:text-indigo-300 bg-white dark:bg-indigo-900/60 px-2.5 py-1 rounded-xl border border-indigo-200 dark:border-indigo-800">
                            {batch.order?.referenceNo || batch.order?.docNo || 'Sales Order'}
                          </span>
                          <span className="text-xs font-bold text-slate-900 dark:text-white">
                            {batch.order?.customer?.name || 'Customer Reserved'}
                          </span>
                        </div>
                      </div>
                      {batch.order?.deliveryDate && (
                        <div className="text-left sm:text-right">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Target Delivery</span>
                          <span className="text-xs font-mono font-bold text-slate-900 dark:text-white mt-1 block">
                            {new Date(batch.order.deliveryDate).toLocaleDateString('en-GB')}
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* ── STOCK ADJUSTMENT REASON & REF (For Stock-Update Batches) ── */}
                  {(batch.adjustmentReason || batch.productionType === 'STOCK_UPDATE') && (
                    <div className="bg-amber-50/70 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-2xl p-4 shadow-3xs flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <span className="text-[10px] font-bold text-amber-700 dark:text-amber-300 uppercase tracking-wider block">
                          Stock Adjustment Reason & Purpose
                        </span>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className="font-bold text-xs text-amber-800 dark:text-amber-200 bg-white dark:bg-amber-900/60 px-2.5 py-1 rounded-xl border border-amber-200 dark:border-amber-800">
                            {batch.adjustmentReason || 'Floor Stock Correction / Opening Inventory Adjustment'}
                          </span>
                        </div>
                      </div>
                      {batch.adjustmentReference && (
                        <div className="text-left sm:text-right">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Audit / Doc Ref #</span>
                          <span className="text-xs font-mono font-bold text-slate-900 dark:text-white mt-1 block">
                            {batch.adjustmentReference}
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* ── RAW MATERIALS REQUIRED FOR THIS PRODUCTION (Highlighted Planned Quantities) ── */}
                  <div className="bg-white dark:bg-slate-900 border-2 border-indigo-200/80 dark:border-indigo-900/60 rounded-2xl p-4 shadow-3xs space-y-3">
                    <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
                      <div>
                        <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                          <span className="p-1 rounded-lg bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400">
                            <Database className="w-3.5 h-3.5" />
                          </span>
                          Raw Materials Needed For This Production
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-indigo-50 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                            {batch.rmUsages?.length || 0} Materials
                          </span>
                        </h4>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          What is planned and required to be used for Batch <strong className="font-mono text-indigo-600">{displayRefNo}</strong> with highlighted quantities
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setActiveTab('formulation')}
                          className="px-2.5 py-1 rounded-xl text-xs font-bold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 flex items-center gap-1 cursor-pointer transition-all shadow-3xs"
                        >
                          <span>Full Formulation & Lots</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                      {(batch.rmUsages || []).map((u, idx) => {
                        const rmName = u.rawMaterial?.name || u.rmName || 'Raw Material';
                        let baseUom = u.baseUom || u.rawMaterial?.unit?.abbreviation || u.rawMaterial?.unitId || 'liter';
                        if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(baseUom)) baseUom = 'units';

                        const altUomCandidate = u.alternateUom || u.rawMaterial?.alternateUom || (u.rawMaterial?.consumptionUnit && u.rawMaterial.consumptionUnit.toLowerCase() !== baseUom.toLowerCase() ? u.rawMaterial.consumptionUnit : null);
                        const hasAlt = Boolean(
                          (u.hasAlternateUom || u.rawMaterial?.hasAlternateUom) && 
                          altUomCandidate && 
                          altUomCandidate.toLowerCase() !== baseUom.toLowerCase()
                        );
                        const altUom = hasAlt ? altUomCandidate : null;
                        const convFactor = hasAlt ? Number(
                          u.conversionFactor || 
                          u.conversionFactorUsed || 
                          u.rawMaterial?.conversionFactor || 
                          (u.rawMaterial?.alternateUomQty && u.rawMaterial?.baseUomQty ? (u.rawMaterial.alternateUomQty / u.rawMaterial.baseUomQty) : 1000) ||
                          1000
                        ) : 1;

                        const baseReq = Number(u.requiredQty || 0);
                        const baseAct = u.actualUsedQty !== null ? Number(u.actualUsedQty) : null;

                        return (
                          <div 
                            key={u.id || idx}
                            className="p-3 rounded-xl border border-slate-200/90 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-850/50 flex flex-col justify-between gap-2 transition-all hover:border-indigo-300 dark:hover:border-indigo-700"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <span className="font-extrabold text-xs text-slate-900 dark:text-white block">
                                  {rmName}
                                </span>
                                {hasAlt && altUom && (
                                  <span className="text-[10px] text-slate-500 font-mono">
                                    1 {baseUom} = {convFactor.toLocaleString()} {altUom}
                                  </span>
                                )}
                              </div>
                              
                              {/* Highlighted Planned Need to Use */}
                              <div className="text-right shrink-0">
                                <span className="text-[8.5px] uppercase tracking-wider font-extrabold text-indigo-600 dark:text-indigo-400 block">
                                  ★ Planned to Use
                                </span>
                                <div className="px-2.5 py-1 rounded-xl bg-indigo-100 dark:bg-indigo-950/80 border border-indigo-200 dark:border-indigo-800 text-right mt-0.5 shadow-3xs">
                                  <span className="font-mono font-black text-xs text-indigo-900 dark:text-indigo-200">
                                    {baseReq.toFixed(2)} {baseUom}
                                  </span>
                                  {hasAlt && altUom && (
                                    <span className="block text-[10px] font-bold text-indigo-600 dark:text-indigo-400 font-mono">
                                      ({Number((baseReq * convFactor).toFixed(2)).toLocaleString()} {altUom})
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 dark:border-slate-800 text-[10.5px]">
                              <span className="text-slate-500">
                                Consumed: <strong className="font-mono text-slate-800 dark:text-slate-200">{baseAct !== null ? `${baseAct.toFixed(2)} ${baseUom}` : 'Pending Yield'}</strong>
                              </span>
                              <span className="text-slate-500">
                                Unit Rate: <strong className="font-mono text-slate-800 dark:text-slate-200">₹{Number(u.unitCost || 0).toFixed(2)}/{baseUom}</strong>
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Manual Override Indicator Banner */}
                  {(batch.rmUsages || []).some(u => 
                    (u.allocations || []).some(a => 
                      a.is_manual_override || 
                      (a.lot_number && a.lot_number.toLowerCase().includes('override')) ||
                      (a.grn_number && a.grn_number.toLowerCase().includes('override'))
                    )
                  ) && (
                    <div className="bg-amber-50 dark:bg-amber-950/40 border-2 border-amber-300 dark:border-amber-700 rounded-2xl p-3.5 shadow-2xs flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <span className="p-1.5 rounded-xl bg-amber-100 dark:bg-amber-900/80 text-amber-700 dark:text-amber-300">
                          <Sparkles className="w-4 h-4 text-amber-600" />
                        </span>
                        <div>
                          <h5 className="font-black text-xs text-amber-900 dark:text-amber-200 uppercase tracking-wide">
                            Manual Lot Override Applied
                          </h5>
                          <p className="text-[11px] text-amber-700 dark:text-amber-300 mt-0.5">
                            This production run contains raw materials fulfilled via Manual Lot Override & Opening Stock Entry.
                          </p>
                        </div>
                      </div>
                      <span className="px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider bg-amber-200 text-amber-900 dark:bg-amber-900 dark:text-amber-100 border border-amber-300">
                        Override Active
                      </span>
                    </div>
                  )}

                  {/* Completion, Yield & QC Metrics (Shown if completed or in lab test) */}
                  {(batch.completedAt || batch.goodQuantity !== null || batch.status === 'Completed' || batch.status === 'Lab Test In Progress') && (
                    <div className="bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 rounded-2xl p-4 shadow-3xs space-y-3">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <h4 className="text-xs font-black text-emerald-900 dark:text-emerald-200 uppercase tracking-wider flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          Production Completion & Quality Summary
                        </h4>
                        <div className="flex items-center gap-2">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            batch.qcStatus === 'APPROVED' || batch.qcStatus === 'EXEMPT'
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300'
                              : batch.qcStatus === 'REJECTED'
                              ? 'bg-rose-100 text-rose-700 dark:bg-rose-900 dark:text-rose-300'
                              : 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300'
                          }`}>
                            QC: {batch.qcStatus || 'EXEMPT'}
                          </span>
                          {batch.yieldPercentage !== null && (
                            <span className="text-[11px] font-mono font-black text-emerald-700 dark:text-emerald-300 bg-emerald-100/80 dark:bg-emerald-900/60 px-2.5 py-0.5 rounded-full">
                              Yield: {Number(batch.yieldPercentage).toFixed(2)}%
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                        <div className="bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-emerald-100 dark:border-emerald-900">
                          <span className="text-[10px] text-slate-400 block font-bold">Good Produced</span>
                          <span className="font-black text-emerald-600 text-sm">{batch.goodQuantity ?? batch.actualOutput ?? '-'} {batch.productUom}</span>
                        </div>
                        <div className="bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-emerald-100 dark:border-emerald-900">
                          <span className="text-[10px] text-slate-400 block font-bold">Rejected</span>
                          <span className="font-bold text-rose-600">{batch.rejectedQuantity ?? 0} {batch.productUom}</span>
                        </div>
                        <div className="bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-emerald-100 dark:border-emerald-900">
                          <span className="text-[10px] text-slate-400 block font-bold">Scrap / Waste</span>
                          <span className="font-bold text-amber-600">{batch.scrapQuantity ?? 0} {batch.productUom}</span>
                          {batch.scrapReason && <span className="text-[9px] text-slate-400 block truncate" title={batch.scrapReason}>({batch.scrapReason})</span>}
                        </div>
                        <div className="bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-emerald-100 dark:border-emerald-900">
                          <span className="text-[10px] text-slate-400 block font-bold">Quarantine Stock</span>
                          <span className="font-bold text-purple-600">{batch.quarantineStock ?? 0} {batch.productUom}</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-[11px] pt-1 border-t border-emerald-100 dark:border-emerald-900">
                        <div>
                          <span className="text-slate-400 font-bold block">Mfg Date (MFD):</span>
                          <span className="font-mono text-slate-800 dark:text-slate-200">
                            {batch.mfd ? new Date(batch.mfd).toLocaleDateString('en-GB') : '-'}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 font-bold block">Shelf Life / Expiry:</span>
                          <span className="font-mono text-slate-800 dark:text-slate-200">
                            {batch.shelfLifeDays ? `${batch.shelfLifeDays} Days` : '-'}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 font-bold block">Completed By:</span>
                          <span className="text-slate-800 dark:text-slate-200 font-mono">
                            {batch.completedBy || 'Production Supervisor'}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Electricity (EB Meter) Consumption */}
                  {(batch.ebUnitsKwh !== null || batch.ebTotalCost > 0 || batch.ebStartReading !== null) && (
                    <div className="bg-amber-50/40 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-2xl p-4 shadow-3xs space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-black text-amber-900 dark:text-amber-200 uppercase tracking-wider flex items-center gap-1.5">
                          <Zap className="w-4 h-4 text-amber-600" />
                          Electricity Consumption (EB Meter)
                        </h4>
                        <span className="text-[11px] font-bold text-amber-800 dark:text-amber-300 bg-amber-100/90 dark:bg-amber-900/50 px-2.5 py-0.5 rounded-full border border-amber-200 dark:border-amber-800">
                          {batch.ebUnitsKwh ?? 0} kWh Consumed
                        </span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                        <div>
                          <span className="text-[10px] text-slate-400 block font-bold">Meter Start - End</span>
                          <span className="font-mono text-slate-800 dark:text-slate-200 font-bold">
                            {batch.ebStartReading ?? 0} → {batch.ebEndReading ?? 0}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block font-bold">Power Used</span>
                          <span className="font-bold text-amber-700 dark:text-amber-400">{batch.ebUnitsKwh ?? 0} kWh</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block font-bold">Rate / Unit</span>
                          <span className="font-bold text-slate-800 dark:text-slate-200 font-mono">₹{formatCurrency(batch.ebRatePerUnit ?? 8.50)} / kWh</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block font-bold">EB Energy Cost</span>
                          <span className="font-bold text-slate-900 dark:text-white font-mono">₹{formatCurrency(batch.ebTotalCost)}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Production Labour Allocation & Floor Crew (Start to End) */}
                  <div className="bg-indigo-50/40 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-800/60 rounded-2xl p-4 shadow-3xs space-y-3.5">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                          <HardHat className="w-4 h-4" />
                        </div>
                        <div>
                          <h4 className="text-xs font-black text-indigo-950 dark:text-indigo-200 uppercase tracking-wider flex items-center gap-1.5">
                            Production Labour Allocation & Operations Crew
                          </h4>
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                            Workers allocated and logged across batch execution lifecycle (Start to End)
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-bold text-indigo-800 dark:text-indigo-300 bg-indigo-100 dark:bg-indigo-900/50 px-2.5 py-0.5 rounded-full border border-indigo-200 dark:border-indigo-800">
                          {totalLabourCrew} Worker{totalLabourCrew > 1 ? 's' : ''} Allocated
                        </span>
                        <button
                          type="button"
                          onClick={() => setActiveTab('labour')}
                          className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 hover:underline flex items-center gap-0.5 cursor-pointer ml-1"
                        >
                          View Full Timesheet <ArrowRight className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    {/* Floor Shift & Start to End Execution Window */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs bg-white dark:bg-slate-900 p-3 rounded-xl border border-indigo-100 dark:border-indigo-900/50">
                      <div>
                        <span className="text-[10px] text-slate-400 block font-bold uppercase">Floor Shift & Line</span>
                        <span className="font-extrabold text-slate-800 dark:text-slate-200 block">{batch.shift || 'Morning'}</span>
                        <span className="text-[10px] text-slate-400 block font-mono mt-0.5 truncate">{batch.machineLine || 'Main Processing Line'}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block font-bold uppercase">Run Started (Floor)</span>
                        <span className="font-mono font-bold text-slate-800 dark:text-slate-200 block">
                          {formatDateTime(batch.startedAt || batch.startDate)}
                        </span>
                        <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold block mt-0.5">
                          By: {batch.startedBy || batch.creator?.name || 'Floor Operator'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block font-bold uppercase">Run Completed</span>
                        <span className="font-mono font-bold text-slate-800 dark:text-slate-200 block">
                          {batch.completedAt ? formatDateTime(batch.completedAt) : (batch.status === 'Completed' ? formatDateTime(batch.completeDate || batch.updatedAt) : 'In Progress')}
                        </span>
                        <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold block mt-0.5">
                          By: {batch.completedBy || (batch.status === 'Completed' ? (batch.startedBy || 'Supervisor') : 'Floor Operator')}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block font-bold uppercase">Run Duration & Cost</span>
                        <span className="font-bold text-amber-600 dark:text-amber-400 block">
                          {runDuration || 'Active Floor Run'}
                        </span>
                        <span className="text-[10px] text-slate-700 dark:text-slate-300 font-mono font-bold block mt-0.5">
                          Labour Cost: ₹{formatCurrency(batch.labourTotalCost)}
                        </span>
                      </div>
                    </div>

                    {/* Assigned Personnel Roster or Logged Operator Banner */}
                    {staffList.length > 0 ? (
                      <div className="space-y-1.5">
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-bold uppercase tracking-wider">
                          Assigned Production Staff Roster ({staffList.length}):
                        </span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                          {staffList.map((staff, sIdx) => (
                            <div
                              key={staff.id || sIdx}
                              className="p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs flex items-center justify-between gap-2 shadow-2xs"
                            >
                              <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-lg bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 font-black text-xs flex items-center justify-center shrink-0">
                                  {(staff.name || 'W').charAt(0).toUpperCase()}
                                </div>
                                <div className="leading-tight">
                                  <span className="font-bold text-slate-800 dark:text-slate-200 block truncate max-w-[120px]">
                                    {staff.name || 'Staff'}
                                  </span>
                                  <span className="text-[10px] text-slate-400 font-mono block">
                                    {staff.empId || staff.role || 'Production Staff'}
                                  </span>
                                </div>
                              </div>
                              <span className="text-[9.5px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-800 shrink-0">
                                Assigned
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-xl bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 font-black text-sm flex items-center justify-center shrink-0">
                            {(batch.startedBy || batch.creator?.name || 'M').charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <span className="font-bold text-slate-800 dark:text-slate-200 block">
                              Floor In-Charge: {batch.startedBy || batch.creator?.name || 'Production Operator'}
                            </span>
                            <span className="text-[10px] text-slate-400 block font-mono">
                              Shift: {batch.shift || 'Morning'} • Started: {formatDateTime(batch.startedAt || batch.startDate)} → Completed: {formatDateTime(batch.completedAt || batch.completeDate || batch.updatedAt)}
                            </span>
                          </div>
                        </div>
                        <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-1 rounded-lg border border-emerald-200 dark:border-emerald-800 shrink-0 self-start sm:self-auto">
                          ✓ Operations Logged
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Costing Summary if permitted */}
                  {canViewCosting && (
                    <div className="bg-slate-50 dark:bg-slate-850 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-4 shadow-3xs flex items-center justify-between flex-wrap gap-3">
                      <div>
                        <span className="text-[10px] text-slate-400 block font-bold uppercase">Grand Total Planned Cost</span>
                        <span className="text-base font-black text-slate-900 dark:text-white">₹{formatCurrency(batch.totalCost)}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block font-bold uppercase">Sub Total RM Cost</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200">₹{formatCurrency(batch.subTotal)}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block font-bold uppercase">Wastage / Negation</span>
                        <span className="font-bold text-amber-600">₹{formatCurrency(batch.wastageAmt)}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block font-bold uppercase">Overhead & Utilities</span>
                        <span className="font-bold text-purple-600">₹{formatCurrency(batch.overheadAmt)}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block font-bold uppercase">Estimated Cost / Unit</span>
                        <span className="text-sm font-black text-emerald-600">₹{formatCurrency(batch.costPerUnit)} / {batch.productUom}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ── 2. LABOUR & OPERATIONS CREW ── */}
              {activeTab === 'labour' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                    <div>
                      <h4 className="text-xs font-extrabold text-slate-800 dark:text-slate-200 uppercase flex items-center gap-2">
                        <Users className="w-4 h-4 text-indigo-600" />
                        Production Floor Labour & Shift Timesheet
                      </h4>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        Complete log of production staff assigned, shift timings, and lifecycle handover
                      </p>
                    </div>
                    <span className="text-xs font-mono font-bold text-indigo-600 bg-indigo-50 dark:bg-indigo-950/60 px-2.5 py-1 rounded-xl border border-indigo-200 dark:border-indigo-800">
                      {totalLabourCrew} Assigned Worker{totalLabourCrew > 1 ? 's' : ''}
                    </span>
                  </div>

                  {/* 4 Header Metric Tiles */}
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-850 border border-slate-200/80 dark:border-slate-800">
                      <p className="text-[10px] font-bold text-slate-400 uppercase">Assigned Crew</p>
                      <h4 className="text-xs font-black text-slate-900 dark:text-white mt-1 flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-indigo-500" />
                        {totalLabourCrew} Workers
                      </h4>
                      <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                        Target Requirement: {batch.labourCount || totalLabourCrew}
                      </p>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-850 border border-slate-200/80 dark:border-slate-800">
                      <p className="text-[10px] font-bold text-slate-400 uppercase">Floor Shift & Line</p>
                      <h4 className="text-xs font-black text-slate-900 dark:text-white mt-1">
                        {batch.shift || 'Morning Shift'}
                      </h4>
                      <p className="text-[10px] text-indigo-600 dark:text-indigo-400 font-mono mt-0.5">
                        {batch.machineLine || 'Main Processing Line'}
                      </p>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-850 border border-slate-200/80 dark:border-slate-800">
                      <p className="text-[10px] font-bold text-slate-400 uppercase">Shift Execution Window</p>
                      <h4 className="text-xs font-black text-amber-600 mt-1">
                        {runDuration || 'Active Floor Run'}
                      </h4>
                      <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                        Start: {batch.startedAt ? new Date(batch.startedAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '-'}
                      </p>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-850 border border-slate-200/80 dark:border-slate-800">
                      <p className="text-[10px] font-bold text-slate-400 uppercase">Labour Total Cost</p>
                      <h4 className="text-xs font-black text-emerald-600 mt-1 font-mono">
                        ₹{formatCurrency(batch.labourTotalCost)}
                      </h4>
                      <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                        Status: {batch.status === 'Completed' ? 'Logged & Finalized' : 'In Progress'}
                      </p>
                    </div>
                  </div>

                  {/* Detailed Personnel Table / Cards */}
                  <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-4 shadow-3xs space-y-3">
                    <h5 className="text-xs font-extrabold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                      <UserCheck className="w-3.5 h-3.5 text-indigo-600" />
                      Assigned Operators & Floor Staff Details
                    </h5>

                    {staffList.length > 0 ? (
                      <div className="divide-y divide-slate-100 dark:divide-slate-800">
                        {staffList.map((worker, wIdx) => (
                          <div key={worker.id || wIdx} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 font-black text-sm flex items-center justify-center shrink-0 border border-indigo-200/60 dark:border-indigo-800/60">
                                {(worker.name || 'W').charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <h6 className="font-bold text-xs text-slate-900 dark:text-white flex items-center gap-2">
                                  {worker.name || 'Production Staff'}
                                  {worker.empId && (
                                    <span className="font-mono text-[10px] font-medium bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-slate-500">
                                      {worker.empId}
                                    </span>
                                  )}
                                </h6>
                                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                                  Role: <strong className="text-slate-700 dark:text-slate-300">{worker.role || 'Production Staff'}</strong>
                                  {worker.email ? ` • ${worker.email}` : ''}
                                  {worker.phone ? ` • ${worker.phone}` : ''}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-3 self-end sm:self-auto text-right">
                              <div>
                                <span className="text-[10px] text-slate-400 block font-mono">
                                  Shift: {batch.shift || 'General'}
                                </span>
                                <span className="text-[10px] text-slate-600 dark:text-slate-400 block font-mono font-bold">
                                  {formatDateTime(batch.startedAt || batch.startDate)} → {batch.completedAt ? formatDateTime(batch.completedAt) : (batch.status === 'Completed' ? formatDateTime(batch.completeDate) : 'Ongoing')}
                                </span>
                              </div>
                              <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-1 rounded-lg border border-emerald-200 dark:border-emerald-800">
                                {batch.status === 'Completed' ? '✓ Completed' : '● On Duty'}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="p-3.5 bg-slate-50 dark:bg-slate-850/60 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 font-black text-sm flex items-center justify-center shrink-0 border border-amber-200 dark:border-amber-800">
                              {(batch.startedBy || batch.creator?.name || 'M').charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <h6 className="font-bold text-xs text-slate-900 dark:text-white">
                                {batch.startedBy || batch.creator?.name || 'Production Operator'}
                              </h6>
                              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                                Designation: <strong className="text-slate-700 dark:text-slate-300">Shift Floor Lead / Operator</strong>
                              </p>
                            </div>
                          </div>
                          <div className="text-left sm:text-right">
                            <span className="text-[10px] text-slate-400 block font-mono">
                              Floor Shift: {batch.shift || 'Morning'}
                            </span>
                            <span className="text-[10px] text-emerald-600 font-bold block">
                              Started at: {formatDateTime(batch.startedAt || batch.startDate)}
                            </span>
                          </div>
                        </div>

                        {batch.completedBy && batch.completedBy !== batch.startedBy && (
                          <div className="p-3.5 bg-slate-50 dark:bg-slate-850/60 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 font-black text-sm flex items-center justify-center shrink-0 border border-emerald-200 dark:border-emerald-800">
                                {batch.completedBy.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <h6 className="font-bold text-xs text-slate-900 dark:text-white">
                                  {batch.completedBy}
                                </h6>
                                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                                  Designation: <strong className="text-slate-700 dark:text-slate-300">Supervisor / QC Release In-Charge</strong>
                                </p>
                              </div>
                            </div>
                            <div className="text-left sm:text-right">
                              <span className="text-[10px] text-slate-400 block font-mono">
                                Completed at: {formatDateTime(batch.completedAt || batch.completeDate)}
                              </span>
                              <span className="text-[10px] text-emerald-600 font-bold block">
                                ✓ Yield Verified
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Floor Operations Handover Timeline */}
                  <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-4 shadow-3xs space-y-3">
                    <h5 className="text-xs font-extrabold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-amber-500" />
                      Shift Handover & Operations Audit Trail
                    </h5>

                    <div className="relative pl-6 space-y-4 before:content-[''] before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-800">
                      {/* Step 1: Initiated */}
                      <div className="relative">
                        <span className="absolute -left-6 top-0.5 w-4 h-4 rounded-full bg-indigo-600 ring-4 ring-indigo-100 dark:ring-indigo-950/80 flex items-center justify-center text-white text-[8px] font-bold">
                          1
                        </span>
                        <div>
                          <span className="text-xs font-bold text-slate-900 dark:text-white block">
                            Floor Run Initiated & Dispatched
                          </span>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">
                            Started at <strong className="font-mono text-slate-700 dark:text-slate-300">{formatDateTime(batch.startedAt || batch.startDate)}</strong> by <strong className="text-indigo-600 dark:text-indigo-400">{batch.startedBy || batch.creator?.name || 'Production Staff'}</strong> on line <strong className="text-slate-700 dark:text-slate-300">{batch.machineLine}</strong> ({batch.shift} Shift).
                          </p>
                        </div>
                      </div>

                      {/* Step 2: Processing */}
                      <div className="relative">
                        <span className="absolute -left-6 top-0.5 w-4 h-4 rounded-full bg-amber-500 ring-4 ring-amber-100 dark:ring-amber-950/80 flex items-center justify-center text-white text-[8px] font-bold">
                          2
                        </span>
                        <div>
                          <span className="text-xs font-bold text-slate-900 dark:text-white block">
                            Factory Floor Processing & Stage Execution
                          </span>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">
                            {totalLabourCrew} operator{totalLabourCrew > 1 ? 's' : ''} assigned. Factory stages configured: {batch.timelineStages?.length || 0} stage(s). Downtime pauses: {pauseList.length} ({totalPauseMins} mins).
                          </p>
                        </div>
                      </div>

                      {/* Step 3: Completion */}
                      <div className="relative">
                        <span className={`absolute -left-6 top-0.5 w-4 h-4 rounded-full ring-4 flex items-center justify-center text-white text-[8px] font-bold ${
                          batch.status === 'Completed' || batch.status === 'qc_passed'
                            ? 'bg-emerald-500 ring-emerald-100 dark:ring-emerald-950/80'
                            : 'bg-slate-300 dark:bg-slate-700 ring-slate-100 dark:ring-slate-800'
                        }`}>
                          3
                        </span>
                        <div>
                          <span className="text-xs font-bold text-slate-900 dark:text-white block">
                            Production Run Completion & Inventory Release
                          </span>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">
                            {batch.status === 'Completed' || batch.status === 'qc_passed' ? (
                              <>
                                Completed at <strong className="font-mono text-slate-700 dark:text-slate-300">{formatDateTime(batch.completedAt || batch.completeDate)}</strong> by <strong className="text-emerald-600 dark:text-emerald-400">{batch.completedBy || batch.startedBy || 'Supervisor'}</strong>. Actual yield: <strong className="text-slate-900 dark:text-white">{batch.actualOutput ?? batch.quantity} {batch.productUom}</strong>.
                              </>
                            ) : (
                              'Batch is currently active on the factory floor.'
                            )}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ── 3. PAUSES HISTORY ── */}
              {activeTab === 'pauses' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                    <h4 className="text-xs font-extrabold text-slate-800 dark:text-slate-200 uppercase">
                      Recorded Floor Pauses & Handover Timeline
                    </h4>
                    <span className="text-xs font-mono font-bold text-amber-600">
                      Total Paused: {totalPauseMins} mins
                    </span>
                  </div>

                  {pauseList.length === 0 ? (
                    <div className="py-12 text-center text-slate-400">
                      <Clock className="w-6 h-6 mx-auto mb-1 opacity-40 text-emerald-500" />
                      <p className="text-xs font-bold">No pauses recorded for this production run.</p>
                      <p className="text-[10px] mt-0.5">Floor operations ran continuously without downtime.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {pauseList.map((p, idx) => (
                        <div key={idx} className="p-3.5 rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-3xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                              <span className="w-5 h-5 rounded-full bg-amber-50 text-amber-600 font-mono font-bold text-[10px] flex items-center justify-center">
                                #{idx + 1}
                              </span>
                              <span className="font-bold text-xs text-slate-800 dark:text-slate-200">
                                {p.reason || 'Floor Operation Paused'}
                              </span>
                            </div>
                            <p className="text-[10px] text-slate-400 pl-7">
                              Paused at: {p.pausedAt ? new Date(p.pausedAt).toLocaleString('en-GB') : '-'} • By: {p.pausedBy || 'Supervisor'}
                            </p>
                          </div>

                          <div className="text-right pl-7 sm:pl-0">
                            {p.resumedAt ? (
                              <div>
                                <span className="text-[10px] font-bold text-emerald-600 block">
                                  ✓ Resumed after {p.durationMins || 1} mins
                                </span>
                                <span className="text-[9.5px] text-slate-400 block font-mono">
                                  Resumed by: {p.resumedBy || 'Supervisor'}
                                </span>
                              </div>
                            ) : (
                              <span className="text-xs font-bold text-amber-600 bg-amber-50 dark:bg-amber-950/60 px-2 py-0.5 rounded-full border border-amber-200">
                                Currently Paused
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ── 3. FACTORY STAGES TIMELINE ── */}
              {activeTab === 'timeline' && (
                <div className="space-y-3">
                  <h4 className="text-xs font-extrabold text-slate-800 dark:text-slate-200 uppercase pb-2 border-b border-slate-100 dark:border-slate-800">
                    Configured Factory Stages Timeline
                  </h4>

                  {!batch.timelineStages || batch.timelineStages.length === 0 ? (
                    <div className="py-12 text-center text-slate-400">
                      <Layers className="w-6 h-6 mx-auto mb-1 opacity-40 text-indigo-500" />
                      <p className="text-xs font-bold">No specific stages mapped to this batch record.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {batch.timelineStages.map((stage, idx) => (
                        <div key={idx} className="p-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-3xs flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2.5">
                            <span className="w-6 h-6 rounded-lg bg-indigo-50 text-indigo-600 font-mono font-black text-xs flex items-center justify-center">
                              #{idx + 1}
                            </span>
                            <div>
                              <span className="font-extrabold text-slate-800 dark:text-slate-200 block">
                                {stage.name}
                              </span>
                              <span className="text-[10px] text-slate-400 block">
                                {stage.category || stage.desc || 'Processing Stage'}
                              </span>
                            </div>
                          </div>

                          <span className="text-[11px] font-mono font-bold text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700">
                            {stage.durationHours || 0}h {stage.durationMinutes || 0}m
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ── 4. RM FORMULATION & PER-PIECE USAGE ── */}
              {activeTab === 'formulation' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                    <h4 className="text-xs font-extrabold text-slate-800 dark:text-slate-200 uppercase">
                      Raw Material Formulation & Single-Piece Ratio Analysis
                    </h4>
                    <span className="text-[11px] font-mono text-slate-500">
                      Batch Output: <strong>{batch.actualOutput ?? batch.quantity} {batch.productUom}</strong>
                    </span>
                  </div>

                  {/* Desktop Formulation Table (Preserved 100% Intact - hidden lg:block) */}
                  <div className="hidden lg:block border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-3xs">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50 dark:bg-slate-800 text-[10.5px] font-bold uppercase text-slate-500 border-b border-slate-200 dark:border-slate-700">
                          <th className="p-3">#</th>
                          <th className="p-3">Raw Material</th>
                          <th className="p-3 text-right bg-indigo-50/70 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 font-extrabold">
                            Planned Qty (Need to Use)
                          </th>
                          <th className="p-3 text-right">Actual Consumed</th>
                          <th className="p-3 text-right">Single Pcs Consumption</th>
                          <th className="p-3 text-right">Rate (₹)</th>
                          <th className="p-3">Batch Allocations</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {(batch.rmUsages || []).map((u, idx) => {
                          const rmName = u.rawMaterial?.name || u.rmName || 'Raw Material';
                          let baseUom = u.baseUom || u.rawMaterial?.unit?.abbreviation || u.rawMaterial?.unitId || 'liter';
                          if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(baseUom)) baseUom = 'units';

                          const altUomCandidate = u.alternateUom || u.rawMaterial?.alternateUom || (u.rawMaterial?.consumptionUnit && u.rawMaterial.consumptionUnit.toLowerCase() !== baseUom.toLowerCase() ? u.rawMaterial.consumptionUnit : null);
                          const hasAlt = Boolean(
                            (u.hasAlternateUom || u.rawMaterial?.hasAlternateUom) && 
                            altUomCandidate && 
                            altUomCandidate.toLowerCase() !== baseUom.toLowerCase()
                          );
                          const altUom = hasAlt ? altUomCandidate : null;
                          const convFactor = hasAlt ? Number(
                            u.conversionFactor || 
                            u.conversionFactorUsed || 
                            u.rawMaterial?.conversionFactor || 
                            (u.rawMaterial?.alternateUomQty && u.rawMaterial?.baseUomQty ? (u.rawMaterial.alternateUomQty / u.rawMaterial.baseUomQty) : 1000) ||
                            1000
                          ) : 1;

                          const baseReq = Number(u.requiredQty || 0);
                          let baseAct = u.actualUsedQty !== null ? Number(u.actualUsedQty) : null;
                          if (baseAct !== null && hasAlt && convFactor > 1 && baseReq > 0 && baseAct > baseReq * 10) {
                            baseAct = Number((baseAct / convFactor).toFixed(4));
                          }

                          const batchQty = Number(batch.quantity || 1);
                          const actualYield = batch.actualOutput ? Number(batch.actualOutput) : null;

                          return (
                            <tr key={idx} className="hover:bg-slate-50/50">
                              <td className="p-3 font-mono font-bold text-slate-400">{idx + 1}</td>
                              <td className="p-3 font-extrabold text-slate-800 dark:text-slate-200">
                                <div>{rmName}</div>
                                {hasAlt && altUom && (
                                  <span className="text-[10px] font-mono font-semibold text-indigo-600 dark:text-indigo-400">
                                    1 {baseUom} = {convFactor.toLocaleString()} {altUom}
                                  </span>
                                )}
                              </td>
                              <td className="p-3 text-right font-mono bg-indigo-50/20 dark:bg-indigo-950/10">
                                <div className="inline-block px-2.5 py-1 rounded-xl bg-indigo-100 dark:bg-indigo-950/80 border border-indigo-200 dark:border-indigo-800 text-right shadow-3xs">
                                  <div className="font-black text-indigo-950 dark:text-indigo-200 text-xs">
                                    {baseReq.toFixed(2)} {baseUom}
                                  </div>
                                  {hasAlt && altUom && (
                                    <div className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400">
                                      ({Number((baseReq * convFactor).toFixed(2)).toLocaleString()} {altUom})
                                    </div>
                                  )}
                                </div>
                                <span className="block text-[8.5px] uppercase tracking-wider text-indigo-600 dark:text-indigo-400 font-black mt-0.5">
                                  ★ Need to use
                                </span>
                              </td>
                              <td className="p-3 text-right font-mono">
                                {baseAct !== null ? (
                                  hasAlt && altUom ? (
                                    <div>
                                      <div className="font-black text-indigo-600 dark:text-indigo-400">
                                        {Number((baseAct * convFactor).toFixed(2)).toLocaleString()} {altUom}
                                      </div>
                                      <div className="text-[10px] text-slate-500 font-bold">
                                        ({baseAct.toFixed(2)} {baseUom})
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="font-black text-indigo-600">
                                      {baseAct.toFixed(2)} {baseUom}
                                    </div>
                                  )
                                ) : (
                                  <span className="text-slate-400 italic">Pending Yield</span>
                                )}
                              </td>
                              <td className="p-3 text-right font-mono">
                                {baseAct !== null && actualYield && actualYield > 0 ? (
                                  hasAlt && altUom ? (
                                    <div>
                                      <div className="font-bold text-emerald-600">
                                        {(baseAct / actualYield).toFixed(4)} {baseUom} / unit
                                      </div>
                                      <div className="text-[10px] text-emerald-500/80 font-mono">
                                        ({((baseAct * convFactor) / actualYield).toFixed(2)} {altUom} / unit)
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="font-bold text-emerald-600">
                                      {(baseAct / actualYield).toFixed(4)} {baseUom} / unit
                                    </div>
                                  )
                                ) : (
                                  hasAlt && altUom ? (
                                    <div>
                                      <div className="font-bold text-emerald-600">
                                        {(baseReq / batchQty).toFixed(4)} {baseUom} / unit
                                      </div>
                                      <div className="text-[10px] text-slate-400 font-mono">
                                        ({((baseReq * convFactor) / batchQty).toFixed(2)} {altUom} / unit)
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="font-bold text-emerald-600">
                                      {(baseReq / batchQty).toFixed(4)} {baseUom} / unit
                                    </div>
                                  )
                                )}
                              </td>
                              <td className="p-3 text-right font-mono">
                                ₹{Number(u.unitCost || 0).toFixed(2)}
                              </td>
                              <td className="p-3 text-right font-mono text-[10.5px]">
                                {u.allocations && u.allocations.length > 0 ? (
                                  <div className="flex flex-col items-end gap-1.5">
                                    {u.allocations.map((a, aIdx) => {
                                      const isManual = Boolean(
                                        a.is_manual_override || 
                                        (a.lot_number && a.lot_number.toLowerCase().includes('override')) ||
                                        (a.grn_number && a.grn_number.toLowerCase().includes('override'))
                                      );
                                      const allocNum = Number(a.allocated_qty || 0);
                                      return (
                                        <div 
                                          key={a.id || aIdx} 
                                          className={`flex flex-col items-end p-2 rounded-xl border text-right transition-all ${
                                            isManual 
                                              ? 'bg-amber-50/70 dark:bg-amber-950/40 border-amber-300 dark:border-amber-700' 
                                              : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700'
                                          }`}
                                        >
                                          <div className="flex items-center gap-1.5 flex-wrap justify-end">
                                            {isManual ? (
                                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-700">
                                                <Sparkles className="w-2.5 h-2.5 text-amber-600" />
                                                Manual Override
                                              </span>
                                            ) : (
                                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                                <Check className="w-2.5 h-2.5 text-emerald-600" />
                                                Standard Lot
                                              </span>
                                            )}
                                            <strong className="font-mono text-xs text-indigo-700 dark:text-indigo-300">
                                              {a.lot_number}
                                            </strong>
                                            <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                                              ({allocNum.toFixed(2)} {baseUom}{hasAlt ? ` / ${Number((allocNum * convFactor).toFixed(2)).toLocaleString()} ${altUom}` : ''})
                                            </span>
                                          </div>
                                          <div className="flex items-center gap-2 mt-1 text-[9.5px] text-slate-500 font-mono">
                                            {a.po_number && (
                                              <span>PO: <strong className="text-slate-700 dark:text-slate-300">{a.po_number}</strong></span>
                                            )}
                                            {a.grn_number && (
                                              <span>
                                                • GRN: <strong className={isManual ? 'text-amber-700 dark:text-amber-300 font-bold' : 'text-slate-700 dark:text-slate-300'}>
                                                  {a.grn_number}
                                                </strong>
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                ) : (
                                  <span className="text-slate-400 font-mono">{u.batchAllocation || 'Direct Inventory'}</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile & Tablet Formulation Cards (lg:hidden) */}
                  <div className="lg:hidden space-y-3">
                    {(batch.rmUsages || []).map((u, idx) => {
                      const rmName = u.rawMaterial?.name || u.rmName || 'Raw Material';
                      let baseUom = u.baseUom || u.rawMaterial?.unit?.abbreviation || u.rawMaterial?.unitId || 'liter';
                      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(baseUom)) baseUom = 'units';

                      const altUomCandidate = u.alternateUom || u.rawMaterial?.alternateUom || (u.rawMaterial?.consumptionUnit && u.rawMaterial.consumptionUnit.toLowerCase() !== baseUom.toLowerCase() ? u.rawMaterial.consumptionUnit : null);
                      const hasAlt = Boolean(
                        (u.hasAlternateUom || u.rawMaterial?.hasAlternateUom) && 
                        altUomCandidate && 
                        altUomCandidate.toLowerCase() !== baseUom.toLowerCase()
                      );
                      const altUom = hasAlt ? altUomCandidate : null;
                      const convFactor = hasAlt ? Number(
                        u.conversionFactor || 
                        u.conversionFactorUsed || 
                        u.rawMaterial?.conversionFactor || 
                        (u.rawMaterial?.alternateUomQty && u.rawMaterial?.baseUomQty ? (u.rawMaterial.alternateUomQty / u.rawMaterial.baseUomQty) : 1000) ||
                        1000
                      ) : 1;

                      const baseReq = Number(u.requiredQty || 0);
                      let baseAct = u.actualUsedQty !== null ? Number(u.actualUsedQty) : null;
                      if (baseAct !== null && hasAlt && convFactor > 1 && baseReq > 0 && baseAct > baseReq * 10) {
                        baseAct = Number((baseAct / convFactor).toFixed(4));
                      }
                      const actualYield = batch.actualOutput ? Number(batch.actualOutput) : null;

                      return (
                        <div 
                          key={idx} 
                          className="p-3.5 rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs space-y-2.5"
                        >
                          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                            <div className="flex items-center gap-2">
                              <span className="w-5 h-5 rounded-md bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-mono font-bold text-[10px] flex items-center justify-center">
                                #{idx + 1}
                              </span>
                              <h5 className="font-bold text-xs text-slate-800 dark:text-slate-200">
                                {rmName}
                              </h5>
                            </div>
                            <span className="font-mono text-xs font-bold text-slate-600 dark:text-slate-300">
                              ₹{Number(u.unitCost || 0).toFixed(2)} / {baseUom}
                            </span>
                          </div>

                          <div className="grid grid-cols-3 gap-2 bg-slate-50 dark:bg-slate-850 p-2.5 rounded-xl font-mono text-[10.5px]">
                            <div className="p-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/80 border border-indigo-200 dark:border-indigo-800">
                              <span className="text-[8px] text-indigo-600 dark:text-indigo-400 block uppercase font-black">★ Need to Use</span>
                              <span className="font-black text-indigo-950 dark:text-indigo-200 block">
                                {baseReq.toFixed(2)} {baseUom}
                              </span>
                              {hasAlt && altUom && (
                                <span className="text-[8.5px] text-indigo-600 dark:text-indigo-400 font-bold block">
                                  ({Number((baseReq * convFactor).toFixed(2)).toLocaleString()} {altUom})
                                </span>
                              )}
                            </div>
                            <div>
                              <span className="text-[9px] text-slate-400 block uppercase font-bold">Consumed</span>
                              {baseAct !== null ? (
                                hasAlt && altUom ? (
                                  <div>
                                    <span className="font-black text-indigo-600 dark:text-indigo-400 block">
                                      {Number((baseAct * convFactor).toFixed(2)).toLocaleString()} {altUom}
                                    </span>
                                    <span className="text-[9px] text-slate-400 block">
                                      ({baseAct.toFixed(2)} {baseUom})
                                    </span>
                                  </div>
                                ) : (
                                  <span className="font-black text-indigo-600 dark:text-indigo-400 block">
                                    {baseAct.toFixed(2)} {baseUom}
                                  </span>
                                )
                              ) : (
                                <span className="text-slate-400 italic block">Pending</span>
                              )}
                            </div>
                            <div>
                              <span className="text-[9px] text-slate-400 block uppercase font-bold">Per Piece</span>
                              {baseAct !== null && actualYield && actualYield > 0 ? (
                                <span className="font-bold text-emerald-600 dark:text-emerald-400 block">
                                  {(baseAct / actualYield).toFixed(4)} {baseUom}
                                </span>
                              ) : (
                                <span className="font-bold text-emerald-600 dark:text-emerald-400 block">
                                  {(baseReq / Number(batch.quantity || 1)).toFixed(4)} {baseUom}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Allocated Batches with Manual Override indicator */}
                          <div className="space-y-1.5 pt-1">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                              Allocated Lots:
                            </span>
                            {u.allocations && u.allocations.length > 0 ? (
                              <div className="space-y-1.5">
                                {u.allocations.map((a, aIdx) => {
                                  const isManual = Boolean(
                                    a.is_manual_override || 
                                    (a.lot_number && a.lot_number.toLowerCase().includes('override')) ||
                                    (a.grn_number && a.grn_number.toLowerCase().includes('override'))
                                  );
                                  const allocNum = Number(a.allocated_qty || 0);
                                  return (
                                    <div 
                                      key={a.id || aIdx} 
                                      className={`p-2.5 rounded-xl border text-xs font-mono space-y-1 ${
                                        isManual
                                          ? 'bg-amber-50/70 dark:bg-amber-950/40 border-amber-300 dark:border-amber-700'
                                          : 'bg-slate-50 dark:bg-slate-850 border-slate-200 dark:border-slate-800'
                                      }`}
                                    >
                                      <div className="flex items-center justify-between gap-1 flex-wrap">
                                        <span className="font-bold text-indigo-700 dark:text-indigo-300">
                                          {a.lot_number}
                                        </span>
                                        {isManual ? (
                                          <span className="px-1.5 py-0.5 rounded text-[8.5px] font-black uppercase bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 border border-amber-300">
                                            🛠 Manual Override
                                          </span>
                                        ) : (
                                          <span className="px-1.5 py-0.5 rounded text-[8.5px] font-bold uppercase bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200">
                                            Standard Lot
                                          </span>
                                        )}
                                      </div>
                                      <div className="flex items-center justify-between text-[10px] text-slate-500 pt-0.5 border-t border-slate-200/60 dark:border-slate-800">
                                        <span>Allocated: <strong className="text-slate-800 dark:text-slate-200">{allocNum.toFixed(2)} {baseUom}{hasAlt ? ` (${Number((allocNum * convFactor).toFixed(2)).toLocaleString()} ${altUom})` : ''}</strong></span>
                                        <span>{a.po_number ? `PO: ${a.po_number}` : ''} {a.grn_number ? `• GRN: ${a.grn_number}` : ''}</span>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <span className="text-[11px] text-slate-400 font-mono italic">
                                General warehouse stock (No specific lot)
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ── 5. VIEW SOP GUIDE (Full-Screen Responsive Grid) ── */}
              {activeTab === 'sop' && (
                <div className="space-y-4">
                  <div className="bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-200/80 dark:border-indigo-800 rounded-2xl p-4 flex items-start gap-3 shadow-3xs">
                    <div className="p-2 rounded-xl bg-indigo-100 dark:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400 shrink-0">
                      <ShieldCheck className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-indigo-950 dark:text-indigo-200 uppercase tracking-wide">
                        Standard Operating Procedure (SOP) Guide for {batch.product?.name || 'Production Run'}
                      </h4>
                      <p className="text-[11px] text-indigo-700 dark:text-indigo-300 mt-0.5">
                        Follow strict hygiene, temperature thresholds, and batch tracking standards before advancing across stages.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 text-xs">
                    
                    <div className="p-4 rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-3xs flex flex-col justify-between hover:border-indigo-300 transition-all">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-mono font-bold text-[10px]">
                            Stage 1
                          </span>
                          <span className="text-[10px] text-emerald-600 font-bold">Mandatory</span>
                        </div>
                        <h5 className="font-extrabold text-xs text-slate-900 dark:text-white">
                          Pre-Operational Line Clearance & Hygiene
                        </h5>
                        <p className="text-slate-600 dark:text-slate-400 leading-relaxed text-[11px]">
                          Inspect mixing tanks, pasteurizer pipes, and freezing barrels for Clean-In-Place (CIP) verification. Ensure sanitization wash is drained and allergen declarations match the upcoming batch.
                        </p>
                      </div>
                      <div className="pt-2.5 mt-2.5 border-t border-slate-100 dark:border-slate-800 text-[10px] text-slate-400 flex items-center gap-1 font-mono">
                        <Check className="w-3 h-3 text-emerald-500" />
                        CIP Sanitization Verified
                      </div>
                    </div>

                    <div className="p-4 rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-3xs flex flex-col justify-between hover:border-indigo-300 transition-all">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-mono font-bold text-[10px]">
                            Stage 2
                          </span>
                          <span className="text-[10px] text-indigo-600 font-bold">FEFO Gate</span>
                        </div>
                        <h5 className="font-extrabold text-xs text-slate-900 dark:text-white">
                          Ingredient Weighing & FEFO Lot Verification
                        </h5>
                        <p className="text-slate-600 dark:text-slate-400 leading-relaxed text-[11px]">
                          Weigh ingredients according to the recipe sheet. Verify all raw material lots (Milk, Sugar, Stabilizers) match allocated warehouse batch lots. Scan batch barcode before adding to process tanks.
                        </p>
                      </div>
                      <div className="pt-2.5 mt-2.5 border-t border-slate-100 dark:border-slate-800 text-[10px] text-slate-400 flex items-center gap-1 font-mono">
                        <Check className="w-3 h-3 text-emerald-500" />
                        Allocation Lot Scan Match
                      </div>
                    </div>

                    <div className="p-4 rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-3xs flex flex-col justify-between hover:border-indigo-300 transition-all">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-mono font-bold text-[10px]">
                            Stage 3
                          </span>
                          <span className="text-[10px] text-amber-600 font-bold">Critical Control Point</span>
                        </div>
                        <h5 className="font-extrabold text-xs text-slate-900 dark:text-white">
                          Pasteurization & Thermal Emulsification
                        </h5>
                        <p className="text-slate-600 dark:text-slate-400 leading-relaxed text-[11px]">
                          Heat base mixture to <strong className="text-indigo-600 dark:text-indigo-400">72°C and hold for 15 seconds</strong> (or 68°C for 30 minutes in vat). Record temperature in the QC batch log. Homogenize at 2000–2500 PSI to achieve uniform fat emulsion.
                        </p>
                      </div>
                      <div className="pt-2.5 mt-2.5 border-t border-slate-100 dark:border-slate-800 text-[10px] text-slate-400 flex items-center gap-1 font-mono">
                        <Check className="w-3 h-3 text-emerald-500" />
                        72°C Hold Time QC Check
                      </div>
                    </div>

                    <div className="p-4 rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-3xs flex flex-col justify-between hover:border-indigo-300 transition-all">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-mono font-bold text-[10px]">
                            Stage 4
                          </span>
                          <span className="text-[10px] text-cyan-600 font-bold">Ageing Vat</span>
                        </div>
                        <h5 className="font-extrabold text-xs text-slate-900 dark:text-white">
                          Chilling, Ageing & Agitation (4°C)
                        </h5>
                        <p className="text-slate-600 dark:text-slate-400 leading-relaxed text-[11px]">
                          Immediately pump mix through plate chiller to cool below 4°C. Transfer to ageing vats and maintain slow agitation for <strong className="text-indigo-600 dark:text-indigo-400">minimum 4 hours</strong> to ensure fat crystallization and protein hydration.
                        </p>
                      </div>
                      <div className="pt-2.5 mt-2.5 border-t border-slate-100 dark:border-slate-800 text-[10px] text-slate-400 flex items-center gap-1 font-mono">
                        <Check className="w-3 h-3 text-emerald-500" />
                        4°C & 4 Hours Agitation
                      </div>
                    </div>

                    <div className="p-4 rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-3xs flex flex-col justify-between hover:border-indigo-300 transition-all">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-mono font-bold text-[10px]">
                            Stage 5
                          </span>
                          <span className="text-[10px] text-purple-600 font-bold">Freezer Overrun</span>
                        </div>
                        <h5 className="font-extrabold text-xs text-slate-900 dark:text-white">
                          Freezing, Overrun & Bath Freezer Immersion
                        </h5>
                        <p className="text-slate-600 dark:text-slate-400 leading-relaxed text-[11px]">
                          Inject air to target overrun percentage (40%–80% as per recipe). For kulfi/candy molds, submerge in food-grade calcium chloride brine at <strong className="text-indigo-600 dark:text-indigo-400">-25°C</strong>. Insert sanitized sticks at semi-solid stage.
                        </p>
                      </div>
                      <div className="pt-2.5 mt-2.5 border-t border-slate-100 dark:border-slate-800 text-[10px] text-slate-400 flex items-center gap-1 font-mono">
                        <Check className="w-3 h-3 text-emerald-500" />
                        Brine Temperature -25°C
                      </div>
                    </div>

                    <div className="p-4 rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-3xs flex flex-col justify-between hover:border-indigo-300 transition-all">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-mono font-bold text-[10px]">
                            Stage 6
                          </span>
                          <span className="text-[10px] text-emerald-600 font-bold">Hardening & Cold Chain</span>
                        </div>
                        <h5 className="font-extrabold text-xs text-slate-900 dark:text-white">
                          Packaging, Weight Check & Cold Storage Hardening
                        </h5>
                        <p className="text-slate-600 dark:text-slate-400 leading-relaxed text-[11px]">
                          Wrap product in primary pouches. Perform automated net weight check. Transfer cartons to the deep blast tunnel at <strong className="text-indigo-600 dark:text-indigo-400">-35°C</strong> for hardening, followed by cold storage holding at -25°C.
                        </p>
                      </div>
                      <div className="pt-2.5 mt-2.5 border-t border-slate-100 dark:border-slate-800 text-[10px] text-slate-400 flex items-center gap-1 font-mono">
                        <Check className="w-3 h-3 text-emerald-500" />
                        Blast Tunnel Hardening -35°C
                      </div>
                    </div>

                  </div>
                </div>
              )}
            </>
          )}

        </div>

        {/* ── MODAL FOOTER ── */}
        <div className="bg-slate-50 dark:bg-slate-850 px-5 py-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <span className="text-xs text-slate-400">
            Created on: {batch?.createdAt ? new Date(batch.createdAt).toLocaleDateString('en-GB') : '-'}
          </span>
          <Button
            size="sm"
            onClick={onClose}
            className="rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-bold h-8 px-4"
          >
            Close
          </Button>
        </div>

      </div>

      {/* GS1 Batch Label & Barcode Modal */}
      {showLabelModal && (
        <BatchLabelModal
          isOpen={showLabelModal}
          onClose={() => setShowLabelModal(false)}
          batchId={batch?.id}
          batch={batch}
          batchStatus={batch?.status}
        />
      )}

      {/* Production Cancel & RM Wastage Modal */}
      {showCancelModal && (
        <ProductionCancelModal
          isOpen={showCancelModal}
          onClose={() => setShowCancelModal(false)}
          batch={batch}
          onCancelled={() => {
            setShowCancelModal(false);
            fetchBatchDetail();
            if (onStatusUpdated) onStatusUpdated();
          }}
        />
      )}
    </div>
  );
}
