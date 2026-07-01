import React, { useState, useEffect } from 'react';
import { api } from '@/lib/axios';
import { FlaskConical, Search, RefreshCw, Check, X, ShieldAlert, Award, ChevronLeft, Layers, ClipboardCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import DatePicker from '@/components/ui/DatePicker';
import { useNavigate, useLocation } from 'react-router-dom';
import Swal from 'sweetalert2';

export default function QCQueuePage() {
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const navigate = useNavigate();
  const location = useLocation();
  const fromNotifications = location.state?.from === '/notifications';

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

  const filtered = batches.filter(b => 
    b.referenceNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
    b.product?.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {fromNotifications && (
        <button 
          onClick={() => navigate('/notifications')} 
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-bold rounded-lg transition-colors w-fit"
        >
          <ChevronLeft className="w-3.5 h-3.5" /> Back to Notifications Center
        </button>
      )}
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center">
            <FlaskConical className="w-6 h-6 mr-2 text-amber-505 animate-pulse" />
            Laboratory QC Clearance Queue
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Verify texture, taste, weight, and safety metrics before releasing finished product batches.
          </p>
        </div>
        
        <div className="flex items-center space-x-3 w-full sm:w-auto">
          <Button variant="outline" size="sm" onClick={fetchQueue} disabled={loading}>
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh Queue
          </Button>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input 
              placeholder="Search queue..." 
              className="pl-9 bg-white dark:bg-slate-900"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* QC Queue List */}
      <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 font-medium border-b border-slate-100 dark:border-slate-700">
              <tr>
                <th className="px-6 py-4">Batch Ref</th>
                <th className="px-6 py-4">Product Name</th>
                <th className="px-6 py-4 text-right">Production Qty</th>
                <th className="px-6 py-4 text-center">Completion Date</th>
                <th className="px-6 py-4 text-right">Agg. Cost</th>
                <th className="px-6 py-4 text-center">QC Status</th>
                <th className="px-6 py-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-400">Inspecting QC queue...</td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-400">All clear! No batches pending QC.</td>
                </tr>
              ) : (
                filtered.map(batch => (
                  <tr key={batch.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-6 py-4 font-mono font-medium text-slate-900 dark:text-white">
                      {batch.referenceNo}
                    </td>
                    <td className="px-6 py-4 font-semibold text-slate-950 dark:text-white">
                      {batch.product?.name}
                    </td>
                    <td className="px-6 py-4 text-right font-bold text-slate-900 dark:text-white">
                      {batch.actualOutput || batch.quantity} <span className="text-xs font-normal text-slate-400">{batch.product?.unit?.abbreviation}</span>
                    </td>
                    <td className="px-6 py-4 text-center text-slate-500">
                      {new Date(batch.updatedAt).toLocaleDateString('en-GB')}
                    </td>
                    <td className="px-6 py-4 text-right font-semibold text-slate-900 dark:text-white">
                      ₹{Number(batch.totalCost).toLocaleString('en-IN')}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="px-2.5 py-1 text-2xs font-semibold rounded-full bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400 animate-pulse border border-amber-200/50 dark:border-amber-500/20">
                        Pending QC
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center space-x-2">
                        <Button
                          size="sm"
                          onClick={() => handleApproveClick(batch)}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1 py-1 px-3 rounded-lg"
                        >
                          <Check className="w-3.5 h-3.5" /> Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => { setRejectingBatch(batch); setRejectNotes(''); }}
                          className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/20 flex items-center gap-1 py-1 px-3 rounded-lg"
                        >
                          <X className="w-3.5 h-3.5" /> Fail
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* QC Approval Modal */}
      {selectedBatch && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex justify-center items-center p-4">
          <div className="bg-white dark:bg-slate-800 w-full max-w-2xl rounded-3xl shadow-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto border border-slate-100 dark:border-slate-700 animate__animated animate__zoomIn animate__faster">
            <div className="flex justify-between items-center border-b dark:border-slate-700 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center">
                  <Award className="w-5 h-5 mr-2 text-emerald-500" /> Laboratory Batch Certification
                </h3>
                <p className="text-xs text-slate-400">Certifying Batch #{selectedBatch.referenceNo} ({selectedBatch.product?.name})</p>
              </div>
              <button onClick={() => setSelectedBatch(null)} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Parameters input column */}
              <div className="space-y-3 bg-slate-50 dark:bg-slate-900/40 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wide flex items-center">
                  <ClipboardCheck className="w-4 h-4 mr-1 text-indigo-500" /> Required Lab Metrics
                </h4>

                <div className="space-y-2 text-xs">
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-slate-400 block">Texture Consistency *</label>
                    <select
                      value={texture}
                      onChange={(e) => setTexture(e.target.value)}
                      className="w-full bg-white dark:bg-slate-950 border rounded-xl px-2.5 py-1.5"
                    >
                      <option value="Smooth & Creamy">Smooth & Creamy (Passed)</option>
                      <option value="Slightly Icy">Slightly Icy (Conditional)</option>
                      <option value="Gritty">Gritty (Failed)</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-slate-400 block">Taste / Flavor profile *</label>
                    <select
                      value={taste}
                      onChange={(e) => setTaste(e.target.value)}
                      className="w-full bg-white dark:bg-slate-950 border rounded-xl px-2.5 py-1.5"
                    >
                      <option value="Standard Rich Flavor">Standard Rich Flavor (Passed)</option>
                      <option value="Too Sweet / Artificial">Too Sweet (Passed)</option>
                      <option value="Sour / Off-flavor">Sour/Off-flavor (Failed)</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-slate-400 block">Chemical Safety / Microbial *</label>
                    <select
                      value={safety}
                      onChange={(e) => setSafety(e.target.value)}
                      className="w-full bg-white dark:bg-slate-950 border rounded-xl px-2.5 py-1.5"
                    >
                      <option value="Cleared (Microbial negative)">Cleared (Microbial negative)</option>
                      <option value="Failed (Biological positive)">Failed (Biological positive)</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-slate-400 block">Visual Appearance *</label>
                    <select
                      value={appearance}
                      onChange={(e) => setAppearance(e.target.value)}
                      className="w-full bg-white dark:bg-slate-950 border rounded-xl px-2.5 py-1.5"
                    >
                      <option value="Uniform light-cream color">Uniform light-cream color</option>
                      <option value="Discolored / Layered">Discolored / Layered (Failed)</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-slate-400 block">Portion Weight *</label>
                    <select
                      value={weightPortion}
                      onChange={(e) => setWeightPortion(e.target.value)}
                      className="w-full bg-white dark:bg-slate-950 border rounded-xl px-2.5 py-1.5"
                    >
                      <option value="85g (Standard Size)">85g (Standard Size)</option>
                      <option value="Underweight (< 80g)">Underweight (&lt; 80g)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Standard inputs column */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-500 uppercase">Clearance Result</label>
                    <select
                      value={result}
                      onChange={(e) => setResult(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
                    className="space-y-1"
                    labelClassName="text-xs font-semibold text-slate-500 uppercase block"
                    triggerClassName="h-10 text-sm"
                  />

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-500 uppercase">QC notes / Laboratory log</label>
                    <textarea
                      value={qcNotes}
                      onChange={(e) => setQcNotes(e.target.value)}
                      placeholder="Enter chemical specs, bacterial test values, or observations..."
                      rows="3"
                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-sm focus:outline-none"
                    />
                  </div>
                </div>

                {/* Custom Parameters sub-form */}
                <div className="space-y-2 p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800">
                  <label className="text-[10px] uppercase font-bold text-slate-400 block">Custom Lab parameters</label>
                  <div className="flex gap-2">
                    <Input placeholder="Key" value={customParamKey} onChange={(e) => setCustomParamKey(e.target.value)} className="h-8 text-xs" />
                    <Input placeholder="Value" value={customParamVal} onChange={(e) => setCustomParamVal(e.target.value)} className="h-8 text-xs" />
                    <Button type="button" onClick={addCustomParam} size="sm" className="h-8 text-xs py-0">Add</Button>
                  </div>
                  {Object.keys(customParams).length > 0 && (
                    <div className="mt-2 text-2xs space-y-1 bg-white dark:bg-slate-950 p-2 rounded-lg border border-slate-150 max-h-[80px] overflow-y-auto">
                      {Object.entries(customParams).map(([k, v]) => (
                        <div key={k} className="flex justify-between">
                          <span className="font-semibold text-slate-550">{k}:</span>
                          <span>{v}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex space-x-3 pt-4 border-t dark:border-slate-700 justify-end">
              <Button variant="outline" onClick={() => setSelectedBatch(null)} className="w-28">Cancel</Button>
              <Button
                disabled={processing}
                onClick={handleConfirmApprove}
                className="w-48 bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
              >
                {processing ? 'Clearing Batch...' : 'Release Batch to Stock'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* QC Reject Modal */}
      {rejectingBatch && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex justify-center items-center p-4">
          <div className="bg-white dark:bg-slate-800 w-full max-w-md rounded-2xl shadow-2xl p-6 space-y-4 animate__animated animate__zoomIn animate__faster">
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center">
                <ShieldAlert className="w-5 h-5 mr-2 text-rose-500" /> Fail Laboratory Clearance
              </h3>
              <p className="text-xs text-slate-500">Record failure parameters. Batch cannot be sold or released.</p>
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500 uppercase">Reason for Failure *</label>
                <textarea
                  value={rejectNotes}
                  onChange={(e) => setRejectNotes(e.target.value)}
                  placeholder="Explain exactly why this batch has failed laboratory tests..."
                  required
                  rows="4"
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-sm focus:outline-none"
                />
              </div>
            </div>

            <div className="flex space-x-3 pt-2">
              <Button variant="outline" onClick={() => setRejectingBatch(null)} className="flex-1">Cancel</Button>
              <Button
                disabled={processing || !rejectNotes}
                onClick={handleConfirmReject}
                className="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-bold"
              >
                {processing ? 'Processing Reject...' : 'Fail QC Batch'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
