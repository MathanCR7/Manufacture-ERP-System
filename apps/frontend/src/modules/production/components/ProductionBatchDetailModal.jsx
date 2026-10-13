import React, { useState, useEffect } from 'react';
import { 
  X, Play, Pause, PlayCircle, XCircle, CheckCircle2, 
  Clock, User, Calendar, Factory, Package, Layers, 
  FileText, ShieldCheck, AlertTriangle, ArrowRight, 
  RefreshCw, Database, Sparkles, Scale, Tag, Check, Info 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/axios';
import Swal from 'sweetalert2';

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
  const [activeTab, setActiveTab] = useState('overview'); // 'overview', 'timeline', 'sop', 'formulation', 'pauses'
  const [actionLoading, setActionLoading] = useState(false);

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
    if (isOpen && batchId) {
      fetchBatchDetail();
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

  // Handle Cancelling Batch
  const handleCancel = async () => {
    const { value: reason } = await Swal.fire({
      title: 'Cancel Production Batch?',
      text: 'Are you sure you want to cancel this batch? This will release allocations.',
      input: 'text',
      inputPlaceholder: 'e.g. Equipment failure, formulation mismatch, order cancelled...',
      showCancelButton: true,
      confirmButtonText: 'Yes, Cancel Batch',
      confirmButtonColor: '#e11d48',
      inputValidator: (val) => {
        if (!val || !val.trim()) return 'Cancellation reason is required!';
      }
    });

    if (!reason) return;

    try {
      setActionLoading(true);
      await api.patch(`/production/batches-redesign/${batch.id}/status`, {
        status: 'Cancelled',
        reason: reason.trim()
      });
      Swal.fire({ title: 'Cancelled', text: 'Batch has been cancelled.', icon: 'info' });
      fetchBatchDetail();
      if (onStatusUpdated) onStatusUpdated();
    } catch (err) {
      Swal.fire({ title: 'Error', text: err.response?.data?.error || 'Failed to cancel batch.', icon: 'error' });
    } finally {
      setActionLoading(false);
    }
  };

  const formatCurrency = (val) => {
    return Number(val || 0).toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  const pauseList = batch?.pauseHistory || [];
  const totalPauseMins = pauseList.reduce((acc, p) => acc + (Number(p.durationMins) || 0), 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/75 backdrop-blur-xs animate-in fade-in duration-150">
      <div 
        className="w-full max-w-5xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl rounded-3xl flex flex-col overflow-hidden max-h-[90vh] animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* ── MODAL HEADER ── */}
        <div className="bg-slate-900 text-white px-5 py-3.5 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-2xl bg-indigo-500/20 text-indigo-400 border border-indigo-400/30">
              <Factory className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-base text-white font-mono">
                  {batch?.referenceNo || batch?.batchNo || 'Production Batch'}
                </h3>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
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
                <span className="text-[10px] font-mono text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full">
                  {batch?.productionType || 'STANDARD'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {batch?.product?.name || 'Finished Goods Product'} • {batch?.baseName || 'Ice Cream Base'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white rounded-xl p-1.5 transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ── ACTION CONTROLS BAR ── */}
        <div className="bg-slate-50 dark:bg-slate-850 px-5 py-2.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between flex-wrap gap-2 text-xs">
          <div className="flex items-center gap-2">
            {(batch?.status === 'Planned' || batch?.status === 'Draft') && (
              <Button
                size="sm"
                disabled={actionLoading}
                onClick={handleStart}
                className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-8 px-3 shadow-2xs cursor-pointer flex items-center gap-1.5"
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
                  className="rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold h-8 px-3 shadow-2xs cursor-pointer flex items-center gap-1.5"
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
                  className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-8 px-3 shadow-2xs cursor-pointer flex items-center gap-1.5"
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
                className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-8 px-3 shadow-2xs cursor-pointer flex items-center gap-1.5"
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
                className="rounded-xl text-rose-600 border-rose-200 hover:bg-rose-50 h-8 px-3 font-bold"
              >
                <XCircle className="w-3.5 h-3.5 mr-1" />
                Cancel Run
              </Button>
            )}
          </div>

          {/* Quick Stats in Action Bar */}
          <div className="flex items-center gap-3 text-[11px] font-mono font-bold text-slate-500">
            <span>Planned: <strong className="text-slate-800 dark:text-slate-200">{batch?.quantity} {batch?.productUom || 'Nos'}</strong></span>
            {batch?.actualOutput !== null && batch?.actualOutput !== undefined && (
              <span>Actual Yield: <strong className="text-emerald-600">{batch.actualOutput} {batch?.productUom || 'Nos'}</strong></span>
            )}
          </div>
        </div>

        {/* ── TABS NAVIGATION ── */}
        <div className="flex items-center px-5 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-bold overflow-x-auto scrollbar-thin">
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className={`py-3 px-3 border-b-2 transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'overview'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Factory className="w-3.5 h-3.5" />
            Overview & Lifecycle
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('pauses')}
            className={`py-3 px-3 border-b-2 transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'pauses'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            Pauses History ({pauseList.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('timeline')}
            className={`py-3 px-3 border-b-2 transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'timeline'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            Factory Stages Timeline ({batch?.timelineStages?.length || 0})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('formulation')}
            className={`py-3 px-3 border-b-2 transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'formulation'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            RM Formulation & Per-Piece Usage ({batch?.rmUsages?.length || 0})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('sop')}
            className={`py-3 px-3 border-b-2 transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'sop'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            View SOP Guide
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

              {/* ── 2. PAUSES HISTORY ── */}
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

                  <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-3xs">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50 dark:bg-slate-800 text-[10.5px] font-bold uppercase text-slate-500 border-b border-slate-200 dark:border-slate-700">
                          <th className="p-3">#</th>
                          <th className="p-3">Raw Material</th>
                          <th className="p-3 text-right">Planned Qty</th>
                          <th className="p-3 text-right">Actual Consumed</th>
                          <th className="p-3 text-right">Single Pcs Consumption</th>
                          <th className="p-3 text-right">Rate (₹)</th>
                          <th className="p-3 text-right">Allocated FEFO Lots</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {(batch.rmUsages || []).map((u, idx) => {
                          const rmName = u.rawMaterial?.name || u.rmName || 'Raw Material';
                          const uom = u.rawMaterial?.uom?.abbreviation || u.selectedUom || 'Kg';
                          return (
                            <tr key={idx} className="hover:bg-slate-50/50">
                              <td className="p-3 font-mono font-bold text-slate-400">{idx + 1}</td>
                              <td className="p-3 font-extrabold text-slate-800 dark:text-slate-200">
                                {rmName}
                              </td>
                              <td className="p-3 text-right font-mono font-bold text-slate-800 dark:text-slate-200">
                                {Number(u.requiredQty || 0).toFixed(2)} {uom}
                              </td>
                              <td className="p-3 text-right font-mono font-black text-indigo-600">
                                {u.actualUsedQty !== null ? `${Number(u.actualUsedQty).toFixed(2)} ${uom}` : 'Pending Yield'}
                              </td>
                              <td className="p-3 text-right font-mono font-bold text-emerald-600">
                                {u.actualPerPieceQty !== null 
                                  ? `${u.actualPerPieceQty} ${uom} / unit` 
                                  : `${u.perPieceQty} ${uom} / unit`}
                              </td>
                              <td className="p-3 text-right font-mono">
                                ₹{Number(u.unitCost || 0).toFixed(2)}
                              </td>
                              <td className="p-3 text-right font-mono text-[10.5px] text-slate-500">
                                {u.allocations && u.allocations.length > 0
                                  ? u.allocations.map(a => `${a.lot_number} (${a.allocated_qty} ${uom})`).join(', ')
                                  : (u.batchAllocation || 'Direct Inventory')}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* ── 5. VIEW SOP GUIDE ── */}
              {activeTab === 'sop' && (
                <div className="space-y-4">
                  <div className="bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200/80 dark:border-indigo-800 rounded-2xl p-4 flex items-start gap-3">
                    <ShieldCheck className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-xs font-black text-indigo-900 dark:text-indigo-200 uppercase">
                        Standard Operating Procedure (SOP) Guide for {batch.product?.name || 'Production Run'}
                      </h4>
                      <p className="text-[11px] text-indigo-700 dark:text-indigo-300 mt-0.5">
                        Follow strict hygiene, temperature thresholds, and batch tracking standards before advancing across stages.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3 text-xs">
                    <div className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-3xs space-y-1">
                      <span className="font-extrabold text-indigo-600 block">Step 1: Pre-Operational Line Clearance & Hygiene</span>
                      <p className="text-slate-600 dark:text-slate-400 leading-relaxed text-[11px]">
                        Inspect mixing tanks, pasteurizer pipes, and freezing barrels for Clean-In-Place (CIP) verification. Ensure sanitization wash is drained and allergen declarations match the upcoming batch.
                      </p>
                    </div>

                    <div className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-3xs space-y-1">
                      <span className="font-extrabold text-indigo-600 block">Step 2: Ingredient Weighing & FEFO Lot Verification</span>
                      <p className="text-slate-600 dark:text-slate-400 leading-relaxed text-[11px]">
                        Weigh ingredients according to the recipe sheet. Verify all raw material lots (Milk, Sugar, Stabilizers) match allocated warehouse batch lots. Scan batch barcode before adding to process tanks.
                      </p>
                    </div>

                    <div className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-3xs space-y-1">
                      <span className="font-extrabold text-indigo-600 block">Step 3: Pasteurization & Thermal Emulsification</span>
                      <p className="text-slate-600 dark:text-slate-400 leading-relaxed text-[11px]">
                        Heat base mixture to <strong>72°C and hold for 15 seconds</strong> (or 68°C for 30 minutes in vat). Record temperature in the QC batch log. Homogenize at 2000–2500 PSI to achieve uniform fat emulsion.
                      </p>
                    </div>

                    <div className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-3xs space-y-1">
                      <span className="font-extrabold text-indigo-600 block">Step 4: Chilling, Ageing & Agitation (4°C)</span>
                      <p className="text-slate-600 dark:text-slate-400 leading-relaxed text-[11px]">
                        Immediately pump mix through plate chiller to cool below 4°C. Transfer to ageing vats and maintain slow agitation for <strong>minimum 4 hours</strong> to ensure fat crystallization and protein hydration.
                      </p>
                    </div>

                    <div className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-3xs space-y-1">
                      <span className="font-extrabold text-indigo-600 block">Step 5: Freezing, Overrun & Bath Freezer Immersion</span>
                      <p className="text-slate-600 dark:text-slate-400 leading-relaxed text-[11px]">
                        Inject air to target overrun percentage (40%–80% as per recipe). For kulfi/candy molds, submerge in food-grade calcium chloride brine at -25°C. Insert sanitized sticks at semi-solid stage.
                      </p>
                    </div>

                    <div className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-3xs space-y-1">
                      <span className="font-extrabold text-indigo-600 block">Step 6: Packaging, Weight Check & Cold Storage Hardening</span>
                      <p className="text-slate-600 dark:text-slate-400 leading-relaxed text-[11px]">
                        Wrap product in primary pouches. Perform automated net weight check. Transfer cartons to the deep blast tunnel at -35°C for hardening, followed by cold storage holding at -25°C.
                      </p>
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
    </div>
  );
}
