import React, { useState, useEffect } from 'react';
import { api } from '@/lib/axios';
import { FlaskConical, Search, RefreshCw, Check, X, ShieldAlert, Award, ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import DatePicker from '@/components/ui/DatePicker';
import { useNavigate, useLocation } from 'react-router-dom';

export default function QCQueuePage() {
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const navigate = useNavigate();
  const location = useLocation();
  const fromNotifications = location.state?.from === '/notifications';

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
  };

  const handleConfirmApprove = async () => {
    setProcessing(true);
    try {
      await api.post(`/production/qc-queue/${selectedBatch.id}/approve`, {
        expiryDate,
        qcNotes,
        result
      });
      setSelectedBatch(null);
      fetchQueue();
    } catch (e) {
      alert(e.response?.data?.error || 'Failed to approve QC');
    } finally {
      setProcessing(false);
    }
  };

  const handleConfirmReject = async () => {
    setProcessing(true);
    try {
      await api.post(`/production/qc-queue/${rejectingBatch.id}/reject`, {
        qcNotes: rejectNotes
      });
      setRejectingBatch(null);
      fetchQueue();
    } catch (e) {
      alert(e.response?.data?.error || 'Failed to reject QC');
    } finally {
      setProcessing(false);
    }
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
            <FlaskConical className="w-6 h-6 mr-2 text-amber-500" />
            Production QC Queue
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Batches completed but pending laboratory clearance and release.
          </p>
        </div>
        
        <div className="flex items-center space-x-3 w-full sm:w-auto">
          <Button variant="outline" size="sm" onClick={fetchQueue} disabled={loading}>
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
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
                      {batch.quantity} <span className="text-xs font-normal text-slate-400">{batch.product?.unit?.abbreviation}</span>
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
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex justify-center items-center p-4">
          <div className="bg-white dark:bg-slate-800 w-full max-w-md rounded-2xl shadow-2xl p-6 space-y-4">
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center">
                <Award className="w-5 h-5 mr-2 text-emerald-500" /> Release Batch to Stock
              </h3>
              <p className="text-xs text-slate-500">Approve laboratory tests and assign an expiry date.</p>
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500 uppercase">QC Result</label>
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
                label="Expiry Date"
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
                <label className="text-xs font-semibold text-slate-500 uppercase">QC Analysis Notes</label>
                <textarea
                  value={qcNotes}
                  onChange={(e) => setQcNotes(e.target.value)}
                  placeholder="Viscosity, specific gravity, bacterial count, or overall clearance..."
                  rows="3"
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-sm focus:outline-none"
                />
              </div>
            </div>

            <div className="flex space-x-3 pt-2">
              <Button variant="outline" onClick={() => setSelectedBatch(null)} className="flex-1">Cancel</Button>
              <Button
                disabled={processing}
                onClick={handleConfirmApprove}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
              >
                {processing ? 'Processing...' : 'Confirm Release'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* QC Reject Modal */}
      {rejectingBatch && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex justify-center items-center p-4">
          <div className="bg-white dark:bg-slate-800 w-full max-w-md rounded-2xl shadow-2xl p-6 space-y-4">
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center">
                <ShieldAlert className="w-5 h-5 mr-2 text-rose-500" /> Fail QC clearance
              </h3>
              <p className="text-xs text-slate-500">Record failure logs. Failed batch quantities will not be added to stock.</p>
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500 uppercase">Failure Reason Notes</label>
                <textarea
                  value={rejectNotes}
                  onChange={(e) => setRejectNotes(e.target.value)}
                  placeholder="Provide detailed reasons for failing this batch (e.g. QC parameters out of spec)..."
                  rows="4"
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-sm focus:outline-none"
                />
              </div>
            </div>

            <div className="flex space-x-3 pt-2">
              <Button variant="outline" onClick={() => setRejectingBatch(null)} className="flex-1">Cancel</Button>
              <Button
                disabled={processing}
                onClick={handleConfirmReject}
                className="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-bold"
              >
                {processing ? 'Processing...' : 'Confirm Fail'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
