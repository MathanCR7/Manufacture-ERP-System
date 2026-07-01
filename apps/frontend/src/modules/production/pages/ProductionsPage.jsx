import React, { useState, useEffect } from 'react';
import { api } from '@/lib/axios';
import { 
  Factory, Search, RefreshCw, Plus, Calendar, AlertCircle, Play, CheckCircle, 
  Pause, Trash2, Eye, ChevronLeft, X, ClipboardList, Info, Flame, Scale, Check, 
  Grid, List as ListIcon, Award, Activity, AlertTriangle, HelpCircle, DollarSign, Clock, Layers, ArrowUpRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import Swal from 'sweetalert2';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

import AddProductionPage from './AddProductionPage';

export default function ProductionsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const batchIdParam = searchParams.get('id');
  
  const [view, setView] = useState({ type: 'list', prefill: null });
  const [displayMode, setDisplayMode] = useState('grid'); // 'grid' | 'table'
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    if (location.pathname === '/production/add' || location.state?.prefill) {
      setView({ type: 'create', prefill: location.state });
    } else {
      setView({ type: 'list', prefill: null });
    }
  }, [location]);

  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const fromNotifications = location.state?.from === '/notifications';

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
        page,
        limit: displayMode === 'grid' ? 8 : 10,
        search: searchTerm,
        status: statusFilter
      };
      const res = await api.get('/production', { params });
      setBatches(res.data.batches || []);
      setTotalPages(res.data.pages || 1);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBatches();
  }, [page, statusFilter, displayMode]);

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
    setDetailBatch(null);
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
      <div className="p-6 max-w-7xl mx-auto space-y-6 animate__animated animate__fadeIn">
        {/* Navigation & Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-slate-205 dark:border-slate-850">
          <div className="space-y-1">
            <button 
              onClick={handleCloseDetailModal}
              className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline mb-1"
            >
              <ChevronLeft className="w-4 h-4" /> Back to Batch Execution Center
            </button>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
              Batch Execution Dashboard
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Audit log details, timing reports, and component consumption stats for Batch #{detailBatch.referenceNo}.
            </p>
          </div>
          <span className={`px-3 py-1 rounded-full text-xs font-extrabold border ${
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
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* LEFT 2 COLUMNS: Operations logs & BOM specs */}
          <div className="lg:col-span-2 space-y-6">
            
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
                  <span className="font-semibold text-slate-850 dark:text-slate-200 block mt-0.5">{detailBatch.product?.name}</span>
                </div>
                <div>
                  <span className="text-slate-400 uppercase text-[9px] font-bold block">Production Type</span>
                  <span className="font-semibold text-slate-850 dark:text-slate-200 block mt-0.5">{detailBatch.productionType}</span>
                </div>
                <div>
                  <span className="text-slate-400 uppercase text-[9px] font-bold block">Target Quantity</span>
                  <span className="font-semibold text-slate-850 dark:text-slate-200 block mt-0.5">{detailBatch.quantity} pcs</span>
                </div>
                <div>
                  <span className="text-slate-400 uppercase text-[9px] font-bold block">Actual Output Yield</span>
                  <span className="font-semibold text-slate-855 dark:text-slate-200 block mt-0.5">{detailBatch.actualOutput || 'N/A'} pcs</span>
                </div>
              </CardContent>
            </Card>

            {/* Timing execution log timeline */}
            <Card className="rounded-2xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
              <CardHeader className="pb-3 border-b dark:border-slate-800 flex flex-row items-center justify-between">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-indigo-500" /> Timing Execution Report
                </h3>
                <span className="text-2xs font-extrabold text-indigo-650 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 px-2.5 py-0.5 rounded-lg border dark:border-indigo-950">
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
                  <Scale className="w-4 h-4 text-indigo-500" /> Raw Material Variance Report
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
                          <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-950/20">
                            <td className="px-4 py-3 font-semibold text-slate-800 dark:text-slate-200">{varItem.rawMaterialName}</td>
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
                          <td colSpan={4} className="p-4 text-center text-slate-400 italic">No raw materials allocated.</td>
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
                      <div key={idx} className="p-4 bg-slate-50 dark:bg-slate-950 border dark:border-slate-850 rounded-2xl space-y-3">
                        <div className="flex justify-between items-center">
                          <span className={`px-2.5 py-1 text-[10px] font-extrabold rounded-full border ${
                            isPassed 
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-250 dark:bg-emerald-950/20 dark:text-emerald-400' 
                              : 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-955/20 dark:text-rose-450'
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
                            <span className="font-semibold text-slate-805 dark:text-slate-200">{t.tester?.name || 'N/A'}</span>
                          </div>
                          <div>
                            <span className="text-slate-455 text-[10px] uppercase font-bold block">Username / Email</span>
                            <span className="font-mono text-slate-700 dark:text-slate-350">{t.tester?.email || 'N/A'}</span>
                          </div>
                          <div>
                            <span className="text-slate-455 text-[10px] uppercase font-bold block">Verdict Action</span>
                            <span className="font-semibold text-slate-805 dark:text-slate-200 uppercase">{t.action || 'Approved'}</span>
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
          <div className="space-y-6">
            {/* Draggable QR Code Panel */}
            <Card className="rounded-2xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 flex flex-col items-center justify-center text-center space-y-3">
              <div className="p-3 bg-indigo-50 dark:bg-indigo-950 text-indigo-650 rounded-2xl">
                <Layers className="w-5 h-5 animate-pulse" />
              </div>
              <div className="space-y-1">
                <h4 className="text-xs font-black uppercase text-slate-700 dark:text-white tracking-wider">Batch Identity Card</h4>
                <p className="text-[10px] text-slate-400">Draggable barcode identity. Drag to top header drop scanner.</p>
              </div>
              <div className="p-4 border dark:border-slate-800 bg-slate-50 dark:bg-slate-950 rounded-2xl shadow-xs">
                <img 
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${detailBatch.id}`} 
                  alt="Batch QR Code"
                  draggable="true"
                  onDragStart={(e) => e.dataTransfer.setData("text/plain", detailBatch.id)}
                  className="w-32 h-32 border rounded-xl p-1 bg-white cursor-grab active:cursor-grabbing hover:scale-105 transition-transform"
                  title="Drag me to header QR scanner dropzone!"
                />
              </div>
              <span className="text-[9px] font-black uppercase text-indigo-500 tracking-widest bg-indigo-50 dark:bg-indigo-950/50 px-2 py-0.5 rounded">
                Active QR ID
              </span>
            </Card>

            {/* Financial cost summary */}
            <Card className="rounded-2xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
              <CardHeader className="pb-3 border-b dark:border-slate-800">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <DollarSign className="w-4 h-4 text-indigo-550" /> Production Cost Ledger
                </h3>
              </CardHeader>
              <CardContent className="pt-4 space-y-3.5 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-slate-450 font-medium">Production Cost:</span>
                  <span className="font-mono font-bold text-slate-855 dark:text-white">
                    ₹{Number(detailBatch.totalCost || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-450 font-medium">Target Sale Price:</span>
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
                      <span className="font-bold text-slate-800 dark:text-slate-200">{detailBatch.order.customer?.name || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-455">Order Reference:</span>
                      <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">{detailBatch.order.referenceNo || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-455">Order Received Value:</span>
                      <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                        ₹{Number(detailBatch.order.totalSubtotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                ) : (
                  <span className="text-slate-450 italic block py-2">Make to Stock (No linked customer order)</span>
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
    <div className="p-6 max-w-7xl mx-auto space-y-6 animate__animated animate__fadeIn">
      {fromNotifications && (
        <button 
          onClick={() => navigate('/notifications')} 
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-205 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-bold rounded-lg transition-colors w-fit"
        >
          <ChevronLeft className="w-3.5 h-3.5" /> Back to Notifications Center
        </button>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-slate-200 dark:border-slate-850">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <Factory className="w-5 h-5 text-indigo-650" />
            Batch Execution Center
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Manage SOP execution recipe runs and quality controls.
          </p>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
          {/* QR Code Header Scanner Zone */}
          <div 
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            className={`border border-dashed rounded-xl px-3 py-1.5 flex items-center gap-2 transition-all duration-200 ${
              dragOver 
                ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/20 scale-105 shadow-md' 
                : 'border-slate-200 dark:border-slate-800 hover:border-slate-350 dark:hover:border-slate-700 bg-white dark:bg-slate-900'
            }`}
          >
            <Layers className="w-4 h-4 text-indigo-650 dark:text-indigo-400 flex-shrink-0 animate-pulse" />
            <div className="text-[10px] leading-tight">
              <p className="font-extrabold text-slate-800 dark:text-white uppercase tracking-wider">QR Scanner</p>
              <p className="text-slate-400">Drag QR here</p>
            </div>
          </div>

          <Button
            onClick={() => setDisplayMode(d => d === 'grid' ? 'table' : 'grid')}
            className="bg-white hover:bg-slate-105 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-205 dark:border-slate-800 text-slate-700 dark:text-slate-300 rounded-xl px-2.5 py-1 text-2xs font-extrabold h-9 cursor-pointer"
            title={displayMode === 'grid' ? 'Table View' : 'Grid View'}
          >
            {displayMode === 'grid' ? <ListIcon className="w-4 h-4" /> : <Grid className="w-4 h-4" />}
          </Button>

          <Button
            onClick={() => navigate('/production/add')}
            className="bg-indigo-600 hover:bg-indigo-750 dark:bg-indigo-500 dark:hover:bg-indigo-600 text-white font-extrabold text-xs px-4 py-2 rounded-xl shadow-md cursor-pointer"
          >
            <Plus className="w-4 h-4 mr-1" /> Record New Batch
          </Button>
        </div>
      </div>

      {/* Stats Summary Panel */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-850 p-4 rounded-2xl flex items-center justify-between shadow-xs">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Active Batches</span>
            <span className="text-xl font-black text-slate-900 dark:text-white block mt-0.5">{totalActive}</span>
          </div>
          <div className="p-2.5 bg-amber-50 dark:bg-amber-955/20 text-amber-600 dark:text-amber-400 rounded-xl">
            <Activity className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-850 p-4 rounded-2xl flex items-center justify-between shadow-xs">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Completed Batches</span>
            <span className="text-xl font-black text-slate-900 dark:text-white block mt-0.5">{totalCompleted}</span>
          </div>
          <div className="p-2.5 bg-indigo-50 dark:bg-indigo-955/20 text-indigo-600 dark:text-indigo-400 rounded-xl">
            <Check className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-850 p-4 rounded-2xl flex items-center justify-between shadow-xs">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">QC Pass Rate</span>
            <span className="text-xl font-black text-slate-900 dark:text-white block mt-0.5">{qcPassRate}%</span>
          </div>
          <div className="p-2.5 bg-emerald-50 dark:bg-emerald-955/20 text-emerald-600 dark:text-emerald-455 rounded-xl">
            <Award className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-850 p-4 rounded-2xl flex items-center justify-between shadow-xs">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">QC Passed Yield</span>
            <span className="text-xl font-black text-slate-900 dark:text-white block mt-0.5">{qcPassedCount}</span>
          </div>
          <div className="p-2.5 bg-violet-50 dark:bg-violet-955/20 text-violet-600 dark:text-violet-400 rounded-xl">
            <Info className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filters toolbar */}
      <div className="bg-slate-50/50 dark:bg-slate-900 p-4 rounded-2xl border border-slate-205 dark:border-slate-800 shadow-xs flex flex-col md:flex-row gap-4 justify-between items-center">
        <form onSubmit={handleSearch} className="flex items-center gap-2 w-full md:w-auto flex-1">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input 
              placeholder="Search by batch ref or product spec name..." 
              className="pl-9 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-750 text-slate-850 dark:text-white rounded-xl focus:ring-indigo-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Button type="submit" variant="outline" className="border-slate-205 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold rounded-xl cursor-pointer">Search</Button>
        </form>

        <div className="flex items-center gap-3 w-full md:w-auto justify-end">
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 h-9"
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

          <Button
            variant="outline"
            size="sm"
            onClick={fetchBatches}
            className="flex items-center gap-1.5 border-slate-205 dark:border-slate-700 rounded-xl h-9 text-xs font-bold bg-white dark:bg-slate-950 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* BATCHES CARD GRID LISTING */}
      {displayMode === 'grid' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
          {loading ? (
            <div className="col-span-full py-16 text-center text-slate-400">Loading batch details...</div>
          ) : batches.length === 0 ? (
            <div className="col-span-full py-16 text-center text-slate-400 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl">No production batches matched your filter logs.</div>
          ) : (
            batches.map(batch => {
              const dateStr = new Date(batch.startDate).toLocaleDateString('en-GB');
              return (
                <Card 
                  key={batch.id} 
                  className="group overflow-hidden border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 rounded-2xl flex flex-col justify-between"
                >
                  <div className="p-4 space-y-3">
                    <div className="flex justify-between items-start gap-1">
                      <span className="font-mono text-3xs font-bold text-slate-400 tracking-wider">#{batch.referenceNo}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                        batch.status === 'Planned' ? 'bg-blue-50 dark:bg-blue-955/20 text-blue-700 dark:text-blue-400' :
                        batch.status === 'In Progress' ? 'bg-amber-50 dark:bg-amber-955/20 text-amber-700 dark:text-amber-400' :
                        batch.status === 'Completed' ? 'bg-indigo-50 dark:bg-indigo-955/20 text-indigo-700 dark:text-indigo-400' :
                        batch.status === 'qc_passed' ? 'bg-emerald-50 dark:bg-emerald-955/20 text-emerald-700 dark:text-emerald-450 border border-emerald-100 dark:border-emerald-950' :
                        batch.status === 'qc_failed' ? 'bg-rose-50 dark:bg-rose-955/20 text-rose-700 dark:text-rose-400 border border-rose-100 dark:border-rose-950' :
                        'bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-400'
                      }`}>
                        {batch.status === 'qc_passed' ? 'Passed QC' : batch.status === 'qc_failed' ? 'Failed QC' : batch.status}
                      </span>
                    </div>

                    <div>
                      <h4 className="font-bold text-slate-855 dark:text-slate-100 text-sm line-clamp-1 group-hover:text-indigo-650 dark:group-hover:text-indigo-400 transition-colors">
                        {batch.product?.name}
                      </h4>
                      <p className="text-[10px] text-slate-400 mt-1 flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5" /> Start: {dateStr}
                      </p>
                    </div>

                    <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-455">Planned Yield:</span>
                        <span className="font-bold dark:text-slate-200">{batch.quantity} {batch.product?.unit?.abbreviation || 'pcs'}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-455">Production Cost:</span>
                        <span className="font-mono font-bold text-slate-700 dark:text-slate-300">₹{Number(batch.totalCost).toLocaleString('en-IN')}</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions drawer footer */}
                  <div className="p-3 bg-slate-50/50 dark:bg-slate-950/20 border-t border-slate-100 dark:border-slate-800 flex gap-2">
                    {batch.status === 'Planned' && (
                      <Button
                        size="sm"
                        onClick={() => handleUpdateStatus(batch.id, 'In Progress')}
                        className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-2xs py-1.5 rounded-xl cursor-pointer"
                      >
                        <Play className="w-3.5 h-3.5 mr-1" /> Start
                      </Button>
                    )}
                    {batch.status === 'In Progress' && (
                      <>
                        <Button
                          size="sm"
                          onClick={() => handleOpenCompletionModal(batch)}
                          className="flex-1 bg-indigo-600 hover:bg-indigo-750 text-white font-bold text-2xs py-1.5 rounded-xl cursor-pointer"
                        >
                          <CheckCircle className="w-3.5 h-3.5 mr-1" /> Complete
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleUpdateStatus(batch.id, 'On Hold')}
                          className="p-1.5 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-500/10 rounded-xl"
                        >
                          <Pause className="w-4 h-4" />
                        </Button>
                      </>
                    )}
                    {batch.status === 'On Hold' && (
                      <Button
                        size="sm"
                        onClick={() => handleUpdateStatus(batch.id, 'In Progress')}
                        className="flex-1 bg-emerald-650 hover:bg-emerald-700 text-white font-bold text-2xs py-1.5 rounded-xl cursor-pointer"
                      >
                        <Play className="w-3.5 h-3.5 mr-1" /> Resume
                      </Button>
                    )}
                    
                    {/* View Button */}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleOpenDetailModal(batch)}
                      className={`${
                        ['Completed', 'qc_passed', 'qc_failed'].includes(batch.status) ? 'w-full' : 'px-3'
                      } border-slate-205 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-bold text-2xs py-1.5 rounded-xl cursor-pointer`}
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
                    <TableCell colSpan={8} className="px-6 py-12 text-center text-slate-400">Loading production batches...</TableCell>
                  </TableRow>
                ) : batches.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="px-6 py-12 text-center text-slate-400">No production batches found.</TableCell>
                  </TableRow>
                ) : (
                  batches.map(batch => (
                    <TableRow key={batch.id} className="dark:border-slate-800 hover:bg-slate-50/50 dark:hover:bg-slate-950/10 transition-colors">
                      <TableCell className="px-6 py-4 font-mono font-bold text-slate-500">{batch.referenceNo}</TableCell>
                      <TableCell className="px-6 py-4 font-bold text-slate-855 dark:text-slate-100">{batch.product?.name}</TableCell>
                      <TableCell className="px-6 py-4 text-center text-slate-500">{batch.productionType}</TableCell>
                      <TableCell className="px-6 py-4 text-right font-bold text-slate-900 dark:text-white">
                        {batch.quantity} <span className="text-[10px] font-normal text-slate-400">{batch.product?.unit?.abbreviation}</span>
                      </TableCell>
                      <TableCell className="px-6 py-4 text-center text-slate-500">
                        {new Date(batch.startDate).toLocaleDateString('en-GB')}
                      </TableCell>
                      <TableCell className="px-6 py-4 text-center">
                        <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${
                          batch.status === 'Planned'
                            ? 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400'
                            : batch.status === 'In Progress'
                            ? 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400'
                            : batch.status === 'Completed'
                            ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400'
                            : batch.status === 'qc_passed'
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400'
                            : batch.status === 'qc_failed'
                            ? 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-450'
                            : 'bg-slate-50 text-slate-700 dark:bg-slate-500/10 dark:text-slate-400'
                        }`}>
                          {batch.status === 'qc_passed' ? 'Passed QC' : batch.status === 'qc_failed' ? 'Failed QC' : batch.status}
                        </span>
                      </TableCell>
                      <TableCell className="px-6 py-4 text-right font-mono font-bold text-slate-855 dark:text-white">
                        ₹{Number(batch.totalCost).toLocaleString('en-IN')}
                      </TableCell>
                      <TableCell className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center space-x-1.5">
                          {batch.status === 'Planned' && (
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
                          {batch.status === 'In Progress' && (
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
                          {batch.status === 'On Hold' && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleUpdateStatus(batch.id, 'In Progress')}
                              className="text-emerald-650 hover:text-emerald-750 p-1.5 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 rounded transition-all"
                              title="Resume Production"
                            >
                              <Play className="w-4 h-4" />
                            </Button>
                          )}
                          
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleOpenDetailModal(batch)}
                            className="text-slate-500 hover:text-slate-700 p-1.5 hover:bg-slate-105 dark:hover:bg-slate-800 rounded transition-all"
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
      <div className="p-4 bg-slate-50/20 dark:bg-slate-900 border border-slate-205 dark:border-slate-800 rounded-2xl flex flex-col sm:flex-row justify-between items-center gap-4 text-xs text-slate-455">
        <div>
          Showing {batches.length === 0 ? 0 : (page - 1) * (displayMode === 'grid' ? 8 : 10) + 1} to {Math.min(page * (displayMode === 'grid' ? 8 : 10), batches.length * page)} of {batches.length * totalPages} entries
        </div>
        <div className="flex space-x-1">
          <button 
            onClick={() => setPage(p => Math.max(1, p - 1))} 
            disabled={page === 1} 
            className="px-3 py-1 border dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 disabled:opacity-50 font-bold hover:bg-slate-105 dark:hover:bg-slate-800 transition-all cursor-pointer text-slate-700 dark:text-slate-350"
          >
            Previous
          </button>
          {Array.from({ length: totalPages }).map((_, i) => (
            <button 
              key={i} 
              onClick={() => setPage(i + 1)} 
              className={`px-3 py-1 border rounded-lg transition-all font-bold cursor-pointer ${page === i + 1 ? 'bg-indigo-650 dark:bg-indigo-500 text-white border-indigo-650' : 'bg-white dark:bg-slate-900 dark:border-slate-700 text-slate-700 dark:text-slate-350 hover:bg-slate-105 dark:hover:bg-slate-800'}`}
            >
              {i + 1}
            </button>
          ))}
          <button 
            onClick={() => setPage(p => Math.min(totalPages, p + 1))} 
            disabled={page === totalPages || totalPages === 0} 
            className="px-3 py-1 border dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 disabled:opacity-50 font-bold hover:bg-slate-105 dark:hover:bg-slate-800 transition-all cursor-pointer text-slate-700 dark:text-slate-350"
          >
            Next
          </button>
        </div>
      </div>

      {/* Completion Modal Panel */}
      {execBatch && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-3xl w-full max-h-[90vh] overflow-y-auto border border-slate-205 dark:border-slate-800 shadow-2xl p-6 space-y-6 animate__animated animate__zoomIn animate__faster">
            <div className="flex justify-between items-center border-b dark:border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <ClipboardList className="w-5 h-5 text-indigo-550 dark:text-indigo-400" />
                <h3 className="text-sm font-extrabold text-slate-850 dark:text-white uppercase tracking-wide">
                  Execute Recipe SOP: Batch #{execBatch.referenceNo}
                </h3>
              </div>
              <button onClick={() => setExecBatch(null)} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl">
                <X className="w-4 h-4 text-slate-405" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left Column: SOP Instructions */}
              <div className="space-y-4">
                <h4 className="text-2xs font-extrabold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Flame className="w-4 h-4 text-orange-500" /> 1. Standard Recipe Steps (Read-only)
                </h4>
                <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
                  {execBatch.product?.sopSteps && execBatch.product.sopSteps.length > 0 ? (
                    execBatch.product.sopSteps.map((step, idx) => (
                      <div key={idx} className="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-105 dark:border-slate-855 rounded-2xl space-y-1">
                        <p className="text-2xs font-extrabold text-indigo-650 dark:text-indigo-400">Step #{idx + 1}</p>
                        <p className="text-xs text-slate-700 dark:text-slate-200 font-medium leading-relaxed">{step.instruction}</p>
                        {(step.tempTime || step.safetyNote) && (
                          <div className="flex justify-between items-center text-[10px] text-slate-405 pt-2 border-t dark:border-slate-900 border-dashed mt-1.5">
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
              <div className="space-y-4">
                <h4 className="text-2xs font-extrabold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Scale className="w-4 h-4 text-indigo-505 dark:text-indigo-400" /> 2. Actual Raw Materials Consumption
                </h4>
                <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                  {actualRmUsages.map((usage, idx) => {
                    const displayUnit = usage.selectedUnit === 'sub' ? usage.subUomLabel : usage.unit;
                    const displayTarget = usage.selectedUnit === 'sub' ? usage.requiredQty * 1000 : usage.requiredQty;
                    const displayVariance = usage.inputValue - displayTarget;

                    return (
                      <div key={idx} className="p-3 bg-slate-50 dark:bg-slate-955 rounded-2xl border border-slate-100 dark:border-slate-855 space-y-2">
                        <div className="flex justify-between items-center text-xs font-semibold">
                          <span className="text-slate-855 dark:text-slate-200">{usage.name}</span>
                          <span className="text-[10px] text-slate-405 font-bold">Target: {displayTarget.toFixed(2)} {displayUnit}</span>
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
                              className="h-8 w-24 text-xs bg-white dark:bg-slate-900 border border-slate-205 dark:border-slate-800 font-bold text-slate-850 dark:text-white rounded-lg text-right"
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
                                className="h-8 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-1 text-3xs font-bold text-slate-600 dark:text-slate-350 focus:outline-none"
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
                              <span className="text-amber-600 dark:text-amber-450 font-extrabold font-bold">+{displayVariance.toFixed(1)} {displayUnit} (Over)</span>
                            ) : (
                              <span className="text-indigo-650 dark:text-indigo-400 font-extrabold">{displayVariance.toFixed(1)} {displayUnit} (Less)</span>
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
                <label className="text-2xs font-extrabold text-slate-555 dark:text-slate-400 uppercase block">Actual Output Yield *</label>
                <Input
                  type="number"
                  min="1"
                  required
                  value={actualOutput}
                  onChange={(e) => setActualOutput(e.target.value)}
                  className="bg-white dark:bg-slate-900 border border-slate-205 dark:border-slate-800 text-slate-855 dark:text-slate-100 rounded-xl"
                  placeholder="Output pieces count"
                />
                <p className="text-[10px] text-slate-400">Calculates finished product inventory batch count.</p>
              </div>

              <div className="space-y-1">
                <label className="text-2xs font-extrabold text-slate-555 dark:text-slate-400 uppercase block">Execution Remarks / Deviation Note</label>
                <Input
                  value={completionNote}
                  onChange={(e) => setCompletionNote(e.target.value)}
                  className="bg-white dark:bg-slate-900 border border-slate-205 dark:border-slate-800 text-slate-855 dark:text-slate-100 rounded-xl"
                  placeholder="Record deviations or notes here..."
                />
              </div>
            </div>

            <div className="flex justify-end space-x-3 border-t dark:border-slate-800 pt-4">
              <Button variant="outline" onClick={() => setExecBatch(null)} className="border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold cursor-pointer">Cancel</Button>
              <Button onClick={handleSubmitCompletion} className="bg-indigo-600 hover:bg-indigo-755 dark:bg-indigo-500 dark:hover:bg-indigo-600 text-white font-bold text-xs rounded-xl shadow-md cursor-pointer">
                Submit Completion to QC Queue
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
