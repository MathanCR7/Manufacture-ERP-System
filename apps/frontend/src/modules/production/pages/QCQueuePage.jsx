import React, { useState, useEffect } from 'react';
import { api } from '@/lib/axios';
import useAuthStore from '@/app/store/authStore';
import { FlaskConical, Search, RefreshCw, Check, X, ShieldAlert, Award, ChevronLeft, ClipboardCheck, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import DatePicker from '@/components/ui/DatePicker';
import { useNavigate, useLocation } from 'react-router-dom';
import Swal from 'sweetalert2';
import { Pagination } from '@/components/ui/Pagination';
import DashboardBackButton from '@/components/ui/DashboardBackButton';

export default function QCQueuePage() {
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const navigate = useNavigate();
  const location = useLocation();
  const fromNotifications = location.state?.from === '/notifications';

  const user = useAuthStore(s => s.user);
  const canEvaluate = ['MAIN_MASTER', 'LAB_ASSISTANT'].includes(user?.role);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  // QC parameters states
  const [texture, setTexture] = useState('Smooth & Creamy');
  const [taste, setTaste] = useState('Standard Rich Flavor');
  const [safety, setSafety] = useState('Cleared (Microbial negative)');
  const [appearance, setAppearance] = useState('Uniform light-cream color');
  const [weightPortion, setWeightPortion] = useState('85g (Standard Size)');
  const [customParamKey, setCustomParamKey] = useState('');
  const [customParamVal, setCustomParamVal] = useState('');
  const [customParams, setCustomParams] = useState({});

  // Approval Modal state
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [expiryDate, setExpiryDate] = useState('');
  const [qcNotes, setQcNotes] = useState('');
  const [result, setResult] = useState('Pass');
  const [processing, setProcessing] = useState(false);

  // Reject Modal state
  const [rejectingBatch, setRejectingBatch] = useState(null);
  const [rejectNotes, setRejectNotes] = useState('');

  const fetchQueue = async () => {
    setLoading(true);
    try {
      const res = await api.get('/production/qc-queue');
      setBatches(res.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQueue();
  }, []);

  // Reset pagination to first page when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const handleApproveClick = (batch) => {
    setSelectedBatch(batch);
    // Suggest expiry date based on batch expiryDays
    const exp = new Date();
    exp.setDate(exp.getDate() + (batch.expiryDays || 365));
    setExpiryDate(exp.toISOString().split('T')[0]);
    setQcNotes('');
    setResult('Pass');
    setTexture('Smooth & Creamy');
    setTaste('Standard Rich Flavor');
    setSafety('Cleared (Microbial negative)');
    setAppearance('Uniform light-cream color');
    setWeightPortion('85g (Standard Size)');
    setCustomParams({});
  };

  const handleConfirmApprove = async () => {
    const isDark = document.documentElement.classList.contains('dark');
    setProcessing(true);
    try {
      await api.post(`/production/qc-queue/${selectedBatch.id}/approve`, {
        expiryDate,
        qcNotes,
        result,
        texture,
        taste,
        safety,
        appearance,
        weightPortion,
        customParams
      });

      Swal.fire({
        title: '<span class="text-sm font-bold">QC Approved!</span>',
        text: 'Batch is released to sellable inventory. Linked sales orders updated.',
        icon: 'success',
        confirmButtonColor: '#10b981',
        background: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)',
        color: isDark ? '#f8fafc' : '#0f172a',
      });

      setSelectedBatch(null);
      fetchQueue();
    } catch (e) {
      Swal.fire({
        title: '<span class="text-sm font-bold">Clearance Failed</span>',
        text: e.response?.data?.error || 'Failed to approve QC',
        icon: 'error',
        background: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)',
        color: isDark ? '#f8fafc' : '#0f172a',
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleConfirmReject = async () => {
    const isDark = document.documentElement.classList.contains('dark');
    setProcessing(true);
    try {
      await api.post(`/production/qc-queue/${rejectingBatch.id}/reject`, {
        qcNotes: rejectNotes,
        texture,
        taste,
        safety,
        appearance,
        weightPortion,
        customParams
      });

      Swal.fire({
        title: '<span class="text-sm font-bold">QC Clearance Rejected</span>',
        text: 'Batch flagged as Failed QC. Incident alert sent to manager.',
        icon: 'warning',
        confirmButtonColor: '#ef4444',
        background: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)',
        color: isDark ? '#f8fafc' : '#0f172a',
      });

      setRejectingBatch(null);
      fetchQueue();
    } catch (e) {
      Swal.fire({
        title: '<span class="text-sm font-bold">Rejection Error</span>',
        text: e.response?.data?.error || 'Failed to reject QC',
        icon: 'error',
        background: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)',
        color: isDark ? '#f8fafc' : '#0f172a',
      });
    } finally {
      setProcessing(false);
    }
  };

  const addCustomParam = () => {
    if (!customParamKey || !customParamVal) return;
    setCustomParams({
      ...customParams,
      [customParamKey]: customParamVal
    });
    setCustomParamKey('');
    setCustomParamVal('');
  };

  const deleteCustomParam = (keyToDelete) => {
    const updated = { ...customParams };
    delete updated[keyToDelete];
    setCustomParams(updated);
  };

  const filtered = batches.filter(b => 
    b.referenceNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
    b.product?.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Pagination calculations
  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginatedBatches = filtered.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  return (
    <div className="w-full max-w-full px-4 sm:px-6 lg:px-8 py-5 space-y-4 mx-auto transition-all duration-300">
      <DashboardBackButton />
      {fromNotifications && (
        <button 
          onClick={() => navigate('/notifications')} 
          className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-50 hover:bg-slate-100 border border-slate-205 text-xs font-bold rounded-lg transition-colors w-fit h-8 cursor-pointer"
        >
          <ChevronLeft className="w-3.5 h-3.5" /> Notifications Center
        </button>
      )}
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center">
            <FlaskConical className="w-5.5 h-5.5 mr-2 text-amber-500 shrink-0" />
            Laboratory QC Clearance Queue
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Verify texture, taste, weight, and safety metrics before releasing finished product batches.
          </p>
        </div>
        
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <Button variant="outline" size="sm" onClick={fetchQueue} disabled={loading} className="text-xs h-9 rounded-xl border-slate-205 cursor-pointer">
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh Queue
          </Button>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input 
              placeholder="Search queue..." 
              className="pl-9 h-9 text-xs w-full bg-slate-50 dark:bg-slate-950 rounded-xl border-slate-205 dark:border-slate-800 focus:ring-2 focus:ring-amber-500/20"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </div>

      {!canEvaluate && (
        <div className="flex items-center gap-3 p-4 bg-amber-50 dark:bg-amber-955/20 border border-amber-200 dark:border-amber-900/50 rounded-2xl text-amber-800 dark:text-amber-300 text-sm font-medium animate-in fade-in slide-in-from-top-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
          <span>You have <strong>Read-Only access</strong> to QC Queue. Conducting product evaluations is restricted.</span>
        </div>
      )}

      {/* QC Queue List */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50/80 dark:bg-slate-800/50 text-slate-500 font-bold border-b border-slate-105 dark:border-slate-800 uppercase tracking-widest">
              <tr>
                <th className="px-4 py-2.5">Batch Ref</th>
                <th className="px-4 py-2.5">Product Name</th>
                <th className="px-4 py-2.5 text-right">Production Qty</th>
                <th className="px-4 py-2.5 text-center">Completion Date</th>
                <th className="px-4 py-2.5 text-right">Agg. Cost</th>
                <th className="px-4 py-2.5">QC Status</th>
                {canEvaluate && <th className="px-4 py-2.5 text-center">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-slate-400 text-xs">Inspecting QC queue...</td>
                </tr>
              ) : paginatedBatches.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-slate-400 text-xs">All clear! No batches pending QC.</td>
                </tr>
              ) : (
                paginatedBatches.map(batch => (
                  <tr key={batch.id} className="hover:bg-slate-50/40 dark:hover:bg-slate-800/20 transition-colors border-b border-slate-100 dark:border-slate-800 last:border-none">
                    <td className="px-4 py-2.5 font-mono font-bold text-slate-905 dark:text-slate-300">
                      {batch.referenceNo}
                    </td>
                    <td className="px-4 py-2.5 font-semibold text-slate-950 dark:text-white text-xs">
                      {batch.product?.name}
                    </td>
                    <td className="px-4 py-2.5 text-right font-black text-slate-900 dark:text-white">
                      {batch.actualOutput || batch.quantity} <span className="text-[10px] font-normal text-slate-450">{batch.product?.unit?.abbreviation}</span>
                    </td>
                    <td className="px-4 py-2.5 text-center text-slate-500 font-semibold">
                      {new Date(batch.updatedAt).toLocaleDateString('en-GB')}
                    </td>
                    <td className="px-4 py-2.5 text-right font-bold text-slate-900 dark:text-white">
                      ₹{Number(batch.totalCost).toLocaleString('en-IN')}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="px-2 py-0.5 text-[10px] font-bold rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-404 animate-pulse border border-amber-500/20 inline-block">
                        Pending QC
                      </span>
                    </td>
                    {canEvaluate && (
                      <td className="px-4 py-2.5 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <Button
                            size="sm"
                            onClick={() => handleApproveClick(batch)}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1 h-8 rounded-lg px-3 text-xs font-bold cursor-pointer"
                          >
                            <Check className="w-3.5 h-3.5" /> Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => { setRejectingBatch(batch); setRejectNotes(''); }}
                            className="text-rose-600 hover:text-rose-700 hover:bg-rose-50/50 dark:hover:bg-rose-950/20 flex items-center gap-1 h-8 rounded-lg px-3 text-xs font-bold cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" /> Fail
                          </Button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer info & Pagination Controls */}
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/20 dark:bg-slate-900/20 flex flex-col sm:flex-row justify-between items-center gap-3">
            <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium order-2 sm:order-1">
              Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, filtered.length)} of {filtered.length} pending batches
            </div>

            <div className="order-1 sm:order-2">
              <Pagination 
                currentPage={currentPage} 
                totalPages={totalPages} 
                onPageChange={setCurrentPage} 
              />
            </div>

            <div className="text-xs text-slate-405 font-medium order-3">
              Matched entries: {filtered.length} batches
            </div>
          </div>
        )}
      </div>

      {/* QC Approval Modal (Removed white bg colors and customized inputs) */}
      {selectedBatch && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-md flex justify-center items-center p-4">
          <div className="bg-slate-50 dark:bg-slate-900 w-full max-w-2xl rounded-2xl shadow-2xl p-5 space-y-4 max-h-[90vh] overflow-y-auto border border-slate-200 dark:border-slate-800 animate__animated animate__zoomIn animate__faster">
            <div className="flex justify-between items-center border-b dark:border-slate-850 pb-2 border-slate-200">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center">
                  <Award className="w-5 h-5 mr-1.5 text-emerald-500 shrink-0" /> Laboratory Batch Certification
                </h3>
                <p className="text-[10px] text-slate-500 font-semibold">Certifying Batch #{selectedBatch.referenceNo} ({selectedBatch.product?.name})</p>
              </div>
              <button onClick={() => setSelectedBatch(null)} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Parameters input column */}
              <div className="space-y-3 bg-slate-100/50 dark:bg-slate-950 p-4 rounded-xl border border-slate-200/60 dark:border-slate-850">
                <h4 className="text-[10px] font-bold text-slate-450 uppercase tracking-widest flex items-center border-b border-slate-200 dark:border-slate-850 pb-1.5 mb-2">
                  <ClipboardCheck className="w-4 h-4 mr-1 text-indigo-500" /> Required metrics
                </h4>

                <div className="space-y-2 text-[11px] font-semibold">
                  <div className="space-y-0.5">
                    <label className="text-[9px] uppercase font-bold text-slate-450 block">Texture Consistency *</label>
                    <select
                      value={texture}
                      onChange={(e) => setTexture(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1.5 font-bold h-9 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                    >
                      <option value="Smooth & Creamy">Smooth & Creamy (Passed)</option>
                      <option value="Slightly Icy">Slightly Icy (Conditional)</option>
                      <option value="Gritty">Gritty (Failed)</option>
                    </select>
                  </div>
                  <div className="space-y-0.5">
                    <label className="text-[9px] uppercase font-bold text-slate-450 block">Taste / Flavor profile *</label>
                    <select
                      value={taste}
                      onChange={(e) => setTaste(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1.5 font-bold h-9 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                    >
                      <option value="Standard Rich Flavor">Standard Rich Flavor (Passed)</option>
                      <option value="Too Sweet / Artificial">Too Sweet (Passed)</option>
                      <option value="Sour / Off-flavor">Sour/Off-flavor (Failed)</option>
                    </select>
                  </div>
                  <div className="space-y-0.5">
                    <label className="text-[9px] uppercase font-bold text-slate-450 block">Chemical / Microbial Safety *</label>
                    <select
                      value={safety}
                      onChange={(e) => setSafety(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1.5 font-bold h-9 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                    >
                      <option value="Cleared (Microbial negative)">Cleared (Microbial negative)</option>
                      <option value="Failed (Biological positive)">Failed (Biological positive)</option>
                    </select>
                  </div>
                  <div className="space-y-0.5">
                    <label className="text-[9px] uppercase font-bold text-slate-450 block">Visual Appearance *</label>
                    <select
                      value={appearance}
                      onChange={(e) => setAppearance(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1.5 font-bold h-9 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                    >
                      <option value="Uniform light-cream color">Uniform light-cream color</option>
                      <option value="Discolored / Layered">Discolored / Layered (Failed)</option>
                    </select>
                  </div>
                  <div className="space-y-0.5">
                    <label className="text-[9px] uppercase font-bold text-slate-450 block">Portion Weight *</label>
                    <select
                      value={weightPortion}
                      onChange={(e) => setWeightPortion(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1.5 font-bold h-9 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                    >
                      <option value="85g (Standard Size)">85g (Standard Size)</option>
                      <option value="Underweight (< 80g)">Underweight (&lt; 80g)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Standard inputs column */}
              <div className="space-y-3.5">
                <div className="space-y-2">
                  <div className="space-y-0.5">
                    <label className="text-[9px] uppercase font-bold text-slate-400">Clearance Result</label>
                    <select
                      value={result}
                      onChange={(e) => setResult(e.target.value)}
                      className="w-full bg-slate-100/50 dark:bg-slate-950 border border-slate-205 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 h-9 font-semibold text-slate-900 dark:text-white cursor-pointer"
                    >
                      <option value="Pass">Pass</option>
                      <option value="Partial Pass">Partial Pass</option>
                    </select>
                  </div>

                  <DatePicker
                    label="Assigned Expiry Date *"
                    required
                    value={expiryDate ? new Date(expiryDate) : null}
                    onChange={(d) => setExpiryDate(d ? d.toISOString().split('T')[0] : '')}
                    modalTitle="Expiry Date"
                    placeholder="Select Date"
                    className="space-y-0.5"
                    labelClassName="text-[9px] uppercase font-bold text-slate-400 block"
                    triggerClassName="h-9 text-xs rounded-xl bg-slate-100/50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                  />

                  <div className="space-y-0.5">
                    <label className="text-[9px] uppercase font-bold text-slate-400">QC notes / logs</label>
                    <textarea
                      value={qcNotes}
                      onChange={(e) => setQcNotes(e.target.value)}
                      placeholder="Log test values, chemical properties, bacteriological readings..."
                      rows="2.5"
                      className="w-full bg-slate-100/50 dark:bg-slate-950 border border-slate-205 dark:border-slate-800 rounded-xl p-3 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 resize-none font-semibold text-slate-805 dark:text-white"
                    />
                  </div>
                </div>

                {/* Custom Parameters sub-form (Modified to completely remove white background and improve displays) */}
                <div className="space-y-1.5 p-3 bg-slate-100/50 dark:bg-slate-955 rounded-xl border border-slate-200/80 dark:border-slate-800">
                  <label className="text-[9px] uppercase font-bold text-slate-400 block">Custom parameters</label>
                  <div className="flex gap-2">
                    <Input 
                      placeholder="Key" 
                      value={customParamKey} 
                      onChange={(e) => setCustomParamKey(e.target.value)} 
                      className="h-8 text-[11px] rounded-lg bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-750 text-slate-900 dark:text-white" 
                    />
                    <Input 
                      placeholder="Value" 
                      value={customParamVal} 
                      onChange={(e) => setCustomParamVal(e.target.value)} 
                      className="h-8 text-[11px] rounded-lg bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-750 text-slate-900 dark:text-white" 
                    />
                    <Button 
                      type="button" 
                      onClick={addCustomParam} 
                      size="sm" 
                      className="h-8 text-xs py-0 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer px-3 font-semibold"
                    >
                      Add
                    </Button>
                  </div>
                  {Object.keys(customParams).length > 0 && (
                    <div className="mt-2 text-[10px] space-y-1 bg-slate-200/40 dark:bg-slate-950 p-2 rounded-lg border border-slate-200 dark:border-slate-850 max-h-[85px] overflow-y-auto">
                      {Object.entries(customParams).map(([k, v]) => (
                        <div key={k} className="flex justify-between items-center py-0.5 border-b border-slate-200/30 dark:border-slate-850 last:border-none">
                          <span className="font-bold text-slate-500 dark:text-slate-400">{k}:</span>
                          <span className="font-mono text-slate-850 dark:text-slate-200 flex items-center gap-1.5 font-bold">
                            {v}
                            <button
                              type="button"
                              onClick={() => deleteCustomParam(k)}
                              className="text-rose-500 hover:text-rose-700 cursor-pointer p-0.5 rounded transition-colors hover:bg-rose-50 dark:hover:bg-rose-950/20"
                              title="Delete Parameter"
                            >
                              <X className="w-2.5 h-2.5" />
                            </button>
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-2 border-t dark:border-slate-800 justify-end border-slate-200">
              <Button variant="outline" onClick={() => setSelectedBatch(null)} className="h-9 text-xs rounded-xl px-4 cursor-pointer">Cancel</Button>
              <Button
                disabled={processing}
                onClick={handleConfirmApprove}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-9 text-xs rounded-xl px-4 shadow-sm cursor-pointer"
              >
                {processing ? 'Clearing Batch...' : 'Release Batch to Stock'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* QC Reject Modal (Removed white bg colors) */}
      {rejectingBatch && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-md flex justify-center items-center p-4">
          <div className="bg-slate-50 dark:bg-slate-900 w-full max-w-sm rounded-2xl shadow-2xl p-5 space-y-4 border border-slate-200 dark:border-slate-800 animate__animated animate__zoomIn animate__faster">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center">
                  <ShieldAlert className="w-5 h-5 mr-1.5 text-rose-500 shrink-0" /> Fail Laboratory Clearance
                </h3>
                <p className="text-[10px] text-slate-500 font-semibold mt-0.5">Specify quality failures. Rejected batches are quarantined.</p>
              </div>
              <button onClick={() => setRejectingBatch(null)} className="p-1 text-slate-400 hover:text-slate-650 rounded-lg cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="space-y-0.5">
                <label className="text-[9px] uppercase font-bold text-slate-400">Reason for Failure *</label>
                <textarea
                  value={rejectNotes}
                  onChange={(e) => setRejectNotes(e.target.value)}
                  placeholder="Explain exactly why this batch has failed laboratory checks..."
                  required
                  rows="3"
                  className="w-full bg-slate-100/50 dark:bg-slate-950 border border-slate-205 dark:border-slate-800 rounded-xl p-3 text-xs focus:outline-none focus:ring-2 focus:ring-rose-500/20 resize-none font-semibold text-slate-800 dark:text-white leading-normal"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2 border-t border-slate-200/50 dark:border-slate-800">
              <Button variant="outline" onClick={() => setRejectingBatch(null)} className="flex-1 h-9 text-xs rounded-xl cursor-pointer">Cancel</Button>
              <Button
                disabled={processing || !rejectNotes}
                onClick={handleConfirmReject}
                className="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-bold h-9 text-xs rounded-xl cursor-pointer"
              >
                {processing ? 'Processing...' : 'Fail QC Batch'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
