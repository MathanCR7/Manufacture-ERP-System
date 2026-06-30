import React, { useState, useEffect } from 'react';
import { api } from '@/lib/axios';
import { 
  Factory, Search, RefreshCw, Plus, Calendar, AlertCircle, Play, CheckCircle, 
  Pause, Trash2, Eye, ChevronLeft, X, ClipboardList, Info, Flame, Scale, Check, 
  Grid, List as ListIcon, Award, Activity, AlertTriangle, HelpCircle, DollarSign, Clock
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useNavigate, useLocation } from 'react-router-dom';
import Swal from 'sweetalert2';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

import AddProductionPage from './AddProductionPage';

export default function ProductionsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [view, setView] = useState({ type: 'list', prefill: null });
  const [displayMode, setDisplayMode] = useState('grid'); // 'grid' | 'table'

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

  // Details Modal State
  const [detailBatch, setDetailBatch] = useState(null);

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

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    fetchBatches();
  };

  const handleUpdateStatus = async (id, newStatus) => {
    const isDark = document.documentElement.classList.contains('dark');
    try {
      if (newStatus === 'In Progress') {
        // Enforce RM shortfall check before starting
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
      // Fetch full batch details including BOM and recipe
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

  // Submit actual completion to backend
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

  const handleOpenDetailModal = async (batch) => {
    try {
      const res = await api.get(`/production/${batch.id}`);
      setDetailBatch(res.data);
    } catch (e) {
      console.error(e);
      Swal.fire({ title: 'Error', text: 'Failed to load batch logs', icon: 'error' });
    }
  };

  if (view.type === 'create') {
    return <AddProductionPage />;
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
            Control production schedules, track chronological workflow stages, and record raw material consumption variables.
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Display grid/list view selection */}
          <div className="flex bg-slate-100 dark:bg-slate-900 border border-slate-250 dark:border-slate-850 p-1 rounded-xl shadow-2xs">
            <button
              onClick={() => setDisplayMode('grid')}
              className={`p-1.5 rounded-lg transition-all ${displayMode === 'grid' ? 'bg-white dark:bg-slate-800 text-indigo-650 dark:text-indigo-400 shadow-xs' : 'text-slate-500'}`}
              title="Batch Cards view"
            >
              <Grid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setDisplayMode('table')}
              className={`p-1.5 rounded-lg transition-all ${displayMode === 'table' ? 'bg-white dark:bg-slate-800 text-indigo-650 dark:text-indigo-400 shadow-xs' : 'text-slate-505'}`}
              title="Execution logs table view"
            >
              <ListIcon className="w-4 h-4" />
            </button>
          </div>

          <Button
            onClick={() => navigate('/production/add')}
            className="bg-indigo-600 hover:bg-indigo-750 dark:bg-indigo-500 dark:hover:bg-indigo-600 text-white font-bold text-xs rounded-xl shadow-md hover:shadow-lg hover:-translate-y-[1px] transition-all px-4 h-10 flex items-center cursor-pointer"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Schedule Production Batch
          </Button>
        </div>
      </div>

      {/* Analytical Stats Panel */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { title: 'Active Batches', val: totalActive, icon: Activity, color: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-50 dark:bg-indigo-950/20' },
          { title: 'Completed Batches', val: totalCompleted, icon: CheckCircle, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/20' },
          { title: 'Lab QC Pass Rate', val: `${qcPassRate}%`, icon: Award, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-950/20' },
          { title: 'Cancelled / OnHold', val: batches.filter(b => ['On Hold', 'Cancelled', 'qc_failed'].includes(b.status)).length, icon: AlertTriangle, color: 'text-rose-600 dark:text-rose-450', bg: 'bg-rose-50 dark:bg-rose-950/20' }
        ].map((card, idx) => (
          <Card key={idx} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-xs">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-[10px] uppercase font-bold text-slate-405 tracking-wider">{card.title}</p>
                <h4 className="text-lg font-extrabold text-slate-850 dark:text-white mt-1">{card.val}</h4>
              </div>
              <div className={`p-2.5 rounded-xl ${card.bg} ${card.color}`}>
                <card.icon className="w-4 h-4" />
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Filters and Search toolbar */}
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
                      <h4 className="font-bold text-slate-850 dark:text-slate-100 text-sm line-clamp-1 group-hover:text-indigo-650 dark:group-hover:text-indigo-400 transition-colors">
                        {batch.product?.name}
                      </h4>
                      <p className="text-[10px] text-slate-400 mt-1 flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5" /> Start: {dateStr}
                      </p>
                    </div>

                    <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-450">Planned Yield:</span>
                        <span className="font-bold dark:text-slate-200">{batch.quantity} {batch.product?.unit?.abbreviation || 'pcs'}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-450">Production Cost:</span>
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
                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-2xs py-1.5 rounded-xl cursor-pointer"
                      >
                        <Play className="w-3.5 h-3.5 mr-1" /> Start Batch
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
                        className="w-full bg-emerald-650 hover:bg-emerald-700 text-white font-bold text-2xs py-1.5 rounded-xl cursor-pointer"
                      >
                        <Play className="w-3.5 h-3.5 mr-1" /> Resume Batch
                      </Button>
                    )}
                    {['Completed', 'qc_passed', 'qc_failed'].includes(batch.status) && (
                      <Button
                        size="sm"
                        onClick={() => handleOpenDetailModal(batch)}
                        className="w-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300 font-bold text-2xs py-1.5 rounded-xl border dark:border-slate-700 cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5 mr-1" /> View Logs
                      </Button>
                    )}
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
                      <TableCell className="px-6 py-4 font-bold text-slate-850 dark:text-slate-100">{batch.product?.name}</TableCell>
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
                      <TableCell className="px-6 py-4 text-right font-mono font-bold text-slate-850 dark:text-white">
                        ₹{Number(batch.totalCost).toLocaleString('en-IN')}
                      </TableCell>
                      <TableCell className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center space-x-2">
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
                                title="Verify SOP & Complete"
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
                          {(batch.status === 'Completed' || batch.status === 'qc_passed' || batch.status === 'qc_failed') && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleOpenDetailModal(batch)}
                              className="text-slate-500 hover:text-slate-700 p-1.5 hover:bg-slate-105 dark:hover:bg-slate-800 rounded transition-all"
                              title="View Batch logs"
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                          )}
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
            className="px-3 py-1 border dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 disabled:opacity-50 font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer text-slate-700 dark:text-slate-300"
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
            className="px-3 py-1 border dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 disabled:opacity-50 font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer text-slate-700 dark:text-slate-300"
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
                      <div key={idx} className="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-105 dark:border-slate-850 rounded-2xl space-y-1">
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

              {/* Right Column: Actual Usage Side-by-Side */}
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
                      <div key={idx} className="p-3 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-100 dark:border-slate-850 space-y-2">
                        <div className="flex justify-between items-center text-xs font-semibold">
                          <span className="text-slate-855 dark:text-slate-200">{usage.name}</span>
                          <span className="text-[10px] text-slate-400 font-bold">Target: {displayTarget.toFixed(2)} {displayUnit}</span>
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

            {/* Bottom Row: Pieces Produced */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t dark:border-slate-800 pt-4">
              <div className="space-y-1">
                <label className="text-2xs font-extrabold text-slate-555 dark:text-slate-400 uppercase block">Actual Output Yield *</label>
                <Input
                  type="number"
                  min="1"
                  required
                  value={actualOutput}
                  onChange={(e) => setActualOutput(e.target.value)}
                  className="bg-white dark:bg-slate-900 border border-slate-205 dark:border-slate-800 text-slate-850 dark:text-slate-100 rounded-xl"
                  placeholder="Output pieces count"
                />
                <p className="text-[10px] text-slate-400">Calculates finished kulfi inventory batch count.</p>
              </div>

              <div className="space-y-1">
                <label className="text-2xs font-extrabold text-slate-555 dark:text-slate-400 uppercase block">Execution Remarks / Deviation Note</label>
                <Input
                  value={completionNote}
                  onChange={(e) => setCompletionNote(e.target.value)}
                  className="bg-white dark:bg-slate-900 border border-slate-205 dark:border-slate-800 text-slate-850 dark:text-slate-100 rounded-xl"
                  placeholder="Record deviations or notes here..."
                />
              </div>
            </div>

            <div className="flex justify-end space-x-3 border-t dark:border-slate-800 pt-4">
              <Button variant="outline" onClick={() => setExecBatch(null)} className="border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold cursor-pointer">Cancel</Button>
              <Button onClick={handleSubmitCompletion} className="bg-indigo-600 hover:bg-indigo-750 dark:bg-indigo-500 dark:hover:bg-indigo-600 text-white font-bold text-xs rounded-xl shadow-md cursor-pointer">
                Submit Completion to QC Queue
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Details View Modal */}
      {detailBatch && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-2xl w-full max-h-[85vh] overflow-y-auto border border-slate-205 dark:border-slate-800 shadow-2xl p-6 space-y-5 animate__animated animate__fadeIn animate__faster">
            <div className="flex justify-between items-center border-b dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-extrabold text-slate-850 dark:text-white uppercase tracking-wide">
                  Batch Execution Logs: #{detailBatch.referenceNo}
                </h3>
                <p className="text-xs text-slate-455 mt-0.5">{detailBatch.product?.name}</p>
              </div>
              <button onClick={() => setDetailBatch(null)} className="p-1.5 hover:bg-slate-105 dark:hover:bg-slate-800 rounded-xl">
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs">
              <div className="p-3 bg-slate-50 dark:bg-slate-950/60 border dark:border-slate-850 rounded-2xl">
                <span className="text-[10px] uppercase text-slate-400 font-bold block">Production Type</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">{detailBatch.productionType}</span>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-955/60 border dark:border-slate-850 rounded-2xl">
                <span className="text-[10px] uppercase text-slate-400 font-bold block">Status</span>
                <span className="font-semibold uppercase text-slate-800 dark:text-slate-200">{detailBatch.status}</span>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-955/60 border dark:border-slate-850 rounded-2xl">
                <span className="text-[10px] uppercase text-slate-400 font-bold block">Target Quantity</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">{detailBatch.quantity} pcs</span>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-955/60 border dark:border-slate-850 rounded-2xl">
                <span className="text-[10px] uppercase text-slate-400 font-bold block">Actual Output</span>
                <span className="font-semibold text-slate-805 dark:text-slate-200">{detailBatch.actualOutput || 'N/A'} pcs</span>
              </div>
            </div>

            {/* Material Variance table */}
            <div className="space-y-2">
              <h4 className="text-2xs font-extrabold text-slate-400 uppercase tracking-wide">Raw Material Variance Reports</h4>
              <div className="border border-slate-105 dark:border-slate-800 rounded-2xl overflow-hidden text-xs">
                <table className="w-full text-left">
                  <thead className="bg-slate-55 dark:bg-slate-950 text-slate-500 font-bold">
                    <tr>
                      <th className="p-2.5">Raw Material</th>
                      <th className="p-2.5 text-right">SOP Target</th>
                      <th className="p-2.5 text-right">Actual Used</th>
                      <th className="p-2.5 text-right">Variance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-850">
                    {detailBatch.rmVariance && Array.isArray(detailBatch.rmVariance) ? (
                      detailBatch.rmVariance.map((varItem, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-950/20">
                          <td className="p-2.5 font-semibold text-slate-800 dark:text-slate-200">{varItem.rawMaterialName}</td>
                          <td className="p-2.5 text-right font-mono text-slate-650 dark:text-slate-350">{Number(varItem.requiredQty).toFixed(2)}</td>
                          <td className="p-2.5 text-right font-mono text-slate-650 dark:text-slate-350">{Number(varItem.actualUsedQty).toFixed(2)}</td>
                          <td className={`p-2.5 text-right font-mono font-bold ${
                            Number(varItem.variance) > 0 ? 'text-amber-500' : Number(varItem.variance) < 0 ? 'text-indigo-500' : 'text-slate-400'
                          }`}>
                            {Number(varItem.variance) > 0 ? '+' : ''}{Number(varItem.variance).toFixed(2)}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={4} className="p-4 text-center text-slate-400 italic">No consumption log logged.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Lab QC details */}
            {detailBatch.qcTests && detailBatch.qcTests.length > 0 && (
              <div className="p-4 bg-emerald-50/20 dark:bg-emerald-950/15 border border-emerald-100/50 dark:border-emerald-900/30 rounded-2xl space-y-2 text-xs">
                <h4 className="font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wide flex items-center">
                  <Award className="w-4 h-4 mr-1 text-emerald-600" /> Lab Quality Check Results
                </h4>
                {detailBatch.qcTests.map((t, tidx) => (
                  <div key={tidx} className="grid grid-cols-2 gap-2 text-[11px] text-slate-605 dark:text-slate-350">
                    <div>Tested By: <span className="font-semibold text-slate-800 dark:text-white">{t.tester?.name || 'Lab Assistant'}</span></div>
                    <div>Date: <span className="font-semibold text-slate-800 dark:text-white">{new Date(t.createdAt).toLocaleDateString('en-GB')}</span></div>
                    {t.qcParams && (
                      <div className="col-span-2 pt-2 border-t dark:border-slate-800 mt-1.5 grid grid-cols-2 gap-2 bg-white dark:bg-slate-900/40 p-2.5 rounded-xl">
                        <div>Taste: <span className="font-semibold">{t.qcParams.taste}</span></div>
                        <div>Texture: <span className="font-semibold">{t.qcParams.texture}</span></div>
                        <div>Safety: <span className="font-semibold">{t.qcParams.safety}</span></div>
                        <div>Appearance: <span className="font-semibold">{t.qcParams.appearance}</span></div>
                        <div className="col-span-2">Weight / Portion: <span className="font-semibold">{t.qcParams.weightPortion}</span></div>
                      </div>
                    )}
                    {t.qcNotes && <div className="col-span-2 mt-1 italic text-slate-400">Notes: "{t.qcNotes}"</div>}
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end border-t dark:border-slate-800 pt-3">
              <Button onClick={() => setDetailBatch(null)} className="bg-indigo-600 hover:bg-indigo-750 dark:bg-indigo-500 dark:hover:bg-indigo-600 text-white font-bold text-xs rounded-xl shadow-md cursor-pointer">Close Logs</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
