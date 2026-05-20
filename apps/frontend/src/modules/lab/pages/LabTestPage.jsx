import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/axios';
import { format } from 'date-fns';
import {
  ArrowLeft, Loader2, FlaskConical, Package, CheckCircle2, XCircle,
  AlertTriangle, Send, ChevronDown, Tag, Edit2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import useAuthStore from '@/app/store/authStore';

function DecisionBadge({ decision }) {
  const map = {
    APPROVED:    { label: 'Approved',   cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400', Icon: CheckCircle2 },
    REJECTED:    { label: 'Rejected',   cls: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400',       Icon: XCircle },
    NEED_SAMPLE: { label: 'Re-sample',  cls: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400', Icon: AlertTriangle },
  };
  const m = map[decision] || map.NEED_SAMPLE;
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${m.cls}`}>
      <m.Icon className="w-3 h-3" /> {m.label}
    </span>
  );
}

export default function LabTestPage() {
  const { grnId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const fromNotifications = location.state?.from === '/notifications';
  const queryClient = useQueryClient();
  const user = useAuthStore(s => s.user);
  const canEditDecision = ['MAIN_MASTER', 'LAB_ASSISTANT'].includes(user?.role);

  const [results, setResults] = useState([]);
  const [overallDecision, setOverallDecision] = useState('APPROVED');
  const [labNotes, setLabNotes] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [categoryParams, setCategoryParams] = useState({}); // { paramName: value }
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [isEditingDecision, setIsEditingDecision] = useState(false);

  const { data: grn, isLoading } = useQuery({
    queryKey: ['grn-detail', grnId],
    queryFn: async () => { const res = await api.get(`/grn/receive/${grnId}`); return res.data; },
    enabled: !!grnId,
  });

  // Fetch RM lab categories
  const { data: rmLabCategories = [] } = useQuery({
    queryKey: ['rm-lab-categories'],
    queryFn: () => api.get('/rm-lab-category').then(r => r.data),
  });

  // Fetch required params for selected category
  const { data: requiredParams = [] } = useQuery({
    queryKey: ['rm-required-results', selectedCategoryId],
    queryFn: () => api.get(`/rm-lab-category/required-results/${selectedCategoryId}`).then(r => r.data),
    enabled: !!selectedCategoryId,
  });

  const selectedCategory = rmLabCategories.find(c => c.id === selectedCategoryId);

  // Populate results from GRN items once loaded
  useEffect(() => {
    if (grn?.items && results.length === 0) {
      setResults(grn.items.map(item => ({
        grnItemId: item.id,
        rmId: item.rmId,
        rmName: item.rmName,
        expiryDate: format(new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
        testNotes: '',
        passed: true,
      })));
    }
  }, [grn]);

  // When category changes, reset category params based on requiredParams
  useEffect(() => {
    if (requiredParams.length > 0) {
      const defaultParams = {};
      requiredParams.forEach(p => {
        defaultParams[p.paramName] = '';
      });
      setCategoryParams(defaultParams);
    } else if (selectedCategory?.labTests) {
      // Fall back to labTests list if no required params configured
      const defaultParams = {};
      selectedCategory.labTests.forEach(t => {
        defaultParams[t] = '';
      });
      setCategoryParams(defaultParams);
    }
  }, [requiredParams, selectedCategory]);

  const mutation = useMutation({
    mutationFn: async (data) => { const res = await api.post('/grn/lab-test', data); return res.data; },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rm-stock'] });
      queryClient.invalidateQueries({ queryKey: ['grn-list'] });
      queryClient.invalidateQueries({ queryKey: ['grn-detail', grnId] });
      queryClient.invalidateQueries({ queryKey: ['lab-results'] });
      queryClient.invalidateQueries({ queryKey: ['pending-lab-tests'] });
      queryClient.invalidateQueries({ queryKey: ['upcoming-deliveries'] });
      setSubmitted(true);
    },
    onError: (err) => setError(err.response?.data?.error || 'Lab test submission failed'),
  });

  const updateResult = (idx, field, val) => {
    setResults(prev => prev.map((r, i) => i === idx ? { ...r, [field]: val } : r));
  };

  const updateCategoryParam = (paramName, value) => {
    setCategoryParams(prev => ({ ...prev, [paramName]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    mutation.mutate({
      grnId,
      testResults: results,
      overallDecision,
      labNotes,
      rmLabCategoryId: selectedCategoryId || undefined,
      categoryParams: Object.keys(categoryParams).length > 0 ? categoryParams : undefined,
    });
  };

  if (submitted) {
    return (
      <div className="p-6 max-w-2xl mx-auto flex flex-col items-center justify-center min-h-[60vh] gap-6 text-center">
        <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-500/20 rounded-full flex items-center justify-center">
          <CheckCircle2 className="w-10 h-10 text-emerald-600 dark:text-emerald-400" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Lab Test Submitted</h2>
          <p className="text-slate-500 dark:text-slate-400">
            {overallDecision === 'APPROVED'
              ? 'Materials approved — inventory stock has been updated automatically.'
              : overallDecision === 'REJECTED'
                ? 'Lab test rejected — materials will NOT be added to stock.'
                : 'Re-sample requested — GRN flagged for retest.'}
          </p>
          {overallDecision === 'REJECTED' && (
            <p className="text-sm text-red-500 mt-2">Consider initiating a Purchase Return for rejected materials.</p>
          )}
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => navigate(fromNotifications ? '/notifications' : '/lab/pending')}>
            {fromNotifications ? 'Back to Notifications Center' : 'Back to Pending Tests'}
          </Button>
          <Button onClick={() => navigate('/lab/results')} className="bg-indigo-600 hover:bg-indigo-700 text-white">View Lab Results</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {fromNotifications && (
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => navigate('/notifications')} 
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-bold rounded-lg transition-colors w-fit"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Notifications Center
        </Button>
      )}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/lab/pending')} className="rounded-full text-slate-500">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Lab Test Entry</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Enter test results and category-specific parameters</p>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}</div>
      ) : !grn ? (
        <div className="text-center py-16 text-slate-400">GRN not found.</div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* GRN Summary */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6">
            <h3 className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2 mb-4">
              <Package className="w-5 h-5 text-indigo-500" /> GRN Summary
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div><span className="text-slate-500 block">GRN Reference</span><span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">{grn.referenceNo}</span></div>
              <div><span className="text-slate-500 block">PO Reference</span><span className="font-medium">{grn.po?.referenceNo}</span></div>
              <div><span className="text-slate-500 block">Supplier</span><span className="font-medium">{grn.po?.supplier?.name || '-'}</span></div>
              <div><span className="text-slate-500 block">Received By</span><span className="font-medium">{grn.receiver?.name || '-'}</span></div>
              <div><span className="text-slate-500 block">Received Date</span><span className="font-medium">{grn.receivedDate ? format(new Date(grn.receivedDate), 'dd MMM yyyy HH:mm') : '-'}</span></div>
              <div><span className="text-slate-500 block">Amount Paid</span><span className="font-bold text-slate-900 dark:text-slate-100">₹{Number(grn.amountPaid).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>
              <div><span className="text-slate-500 block">Refund Amount</span><span className="font-medium">₹{Number(grn.refundAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>
              <div><span className="text-slate-500 block">Items</span><span className="font-medium">{grn.items?.length || 0} item(s)</span></div>
            </div>
            {grn.discrepancyNotes && (
              <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-lg text-sm text-amber-700 dark:text-amber-400 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                <span><strong>Discrepancy Note:</strong> {grn.discrepancyNotes}</span>
              </div>
            )}
          </div>

          {/* RM Lab Category Selection */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
            <h3 className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <Tag className="w-5 h-5 text-violet-500" /> RM Lab Category
              <span className="text-xs font-normal text-slate-400">(Select to enable category-specific test parameters)</span>
            </h3>
            <div className="relative">
              <select
                value={selectedCategoryId}
                onChange={e => setSelectedCategoryId(e.target.value)}
                className="w-full border border-slate-200 dark:border-slate-600 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500 appearance-none pr-10"
              >
                <option value="">— Select RM category (optional) —</option>
                {rmLabCategories.map(c => (
                  <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {selectedCategory && (
              <div className="p-4 bg-violet-50 dark:bg-violet-500/10 border border-violet-200 dark:border-violet-500/30 rounded-xl">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-sm font-semibold text-violet-800 dark:text-violet-300">{selectedCategory.name}</span>
                  <span className="text-xs text-violet-500">{selectedCategory.rmExamples}</span>
                </div>

                {/* Category-specific param fields */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {requiredParams.length > 0 ? (
                    requiredParams.map(param => (
                      <div key={param.id} className="space-y-1">
                        <label className="text-xs font-medium text-slate-600 dark:text-slate-400 flex items-center gap-1">
                          {param.paramName}
                          {param.paramUnit && <span className="text-slate-400">({param.paramUnit})</span>}
                          {param.isRequired && <span className="text-red-400">*</span>}
                        </label>
                        <Input
                          value={categoryParams[param.paramName] || ''}
                          onChange={e => updateCategoryParam(param.paramName, e.target.value)}
                          placeholder={
                            param.acceptableText ||
                            (param.acceptableMin != null && param.acceptableMax != null
                              ? `${param.acceptableMin} – ${param.acceptableMax}`
                              : `Enter ${param.paramName}`)
                          }
                          className="h-8 text-xs"
                        />
                        {(param.acceptableMin != null || param.acceptableMax != null || param.acceptableText) && (
                          <p className="text-xs text-slate-400">
                            Acceptable: {param.acceptableText || `${param.acceptableMin ?? ''}–${param.acceptableMax ?? ''} ${param.paramUnit || ''}`}
                          </p>
                        )}
                      </div>
                    ))
                  ) : selectedCategory.labTests?.map(test => (
                    <div key={test} className="space-y-1">
                      <label className="text-xs font-medium text-slate-600 dark:text-slate-400">{test}</label>
                      <Input
                        value={categoryParams[test] || ''}
                        onChange={e => updateCategoryParam(test, e.target.value)}
                        placeholder={`Enter ${test} value`}
                        className="h-8 text-xs"
                      />
                    </div>
                  ))}
                </div>

                {selectedCategory.acceptableResults && (
                  <div className="mt-3 p-2 bg-violet-100 dark:bg-violet-500/20 rounded-lg text-xs text-violet-700 dark:text-violet-400">
                    <strong>Acceptable:</strong> {selectedCategory.acceptableResults}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Test Results per Item */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                <FlaskConical className="w-5 h-5 text-indigo-500" /> Test Results per Item
              </h3>
            </div>
            <div className="p-6 space-y-6">
              {grn.items?.map((item, idx) => (
                <div key={item.id} className="border border-slate-200 dark:border-slate-700 rounded-xl p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-semibold text-slate-900 dark:text-slate-100">{item.rmName}</h4>
                      <p className="text-xs text-slate-400 font-mono">{item.rmId}</p>
                    </div>
                    <div className="text-right text-sm">
                      <span className="text-slate-500">Received: </span>
                      <span className="font-bold text-slate-900 dark:text-slate-100">{Number(item.actualReceivedQty).toLocaleString()}</span>
                      {Number(item.returnQty) > 0 && <span className="text-xs text-red-500 ml-2">(Return: {Number(item.returnQty)})</span>}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-1.5">
                      <Label>Expiry Date *</Label>
                      <Input
                        type="date"
                        required
                        value={results[idx]?.expiryDate || ''}
                        onChange={e => updateResult(idx, 'expiryDate', e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Test Result *</Label>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => updateResult(idx, 'passed', true)}
                          className={`flex-1 py-2 rounded-md text-sm font-medium border transition-colors flex items-center justify-center gap-1 ${results[idx]?.passed ? 'bg-emerald-600 text-white border-emerald-600' : 'border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" /> Pass
                        </button>
                        <button
                          type="button"
                          onClick={() => updateResult(idx, 'passed', false)}
                          className={`flex-1 py-2 rounded-md text-sm font-medium border transition-colors flex items-center justify-center gap-1 ${!results[idx]?.passed ? 'bg-red-600 text-white border-red-600' : 'border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                        >
                          <XCircle className="w-3.5 h-3.5" /> Fail
                        </button>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Test Notes</Label>
                      <Input value={results[idx]?.testNotes || ''} onChange={e => updateResult(idx, 'testNotes', e.target.value)} placeholder="Any observations..." />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Overall Decision */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-800 dark:text-slate-200">Overall Decision & Notes</h3>
              {canEditDecision && (
                <span className="text-xs text-indigo-500 flex items-center gap-1">
                  <Edit2 className="w-3 h-3" /> Admin/Lab can edit after submission
                </span>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {[
                { val: 'APPROVED',    label: 'Approve Batch',   desc: 'Stock will be updated',   color: 'emerald', Icon: CheckCircle2 },
                { val: 'REJECTED',    label: 'Reject Batch',    desc: 'Stock will NOT update',   color: 'red',     Icon: XCircle },
                { val: 'NEED_SAMPLE', label: 'Need Re-sample',  desc: 'Flag for retest',         color: 'amber',   Icon: AlertTriangle },
              ].map(({ val, label, desc, color, Icon }) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setOverallDecision(val)}
                  className={`p-4 rounded-xl border-2 text-left transition-all ${overallDecision === val ? `border-${color}-500 bg-${color}-50 dark:bg-${color}-500/10` : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'}`}
                >
                  <div className={`flex items-center gap-2 font-semibold ${overallDecision === val ? `text-${color}-700 dark:text-${color}-400` : 'text-slate-700 dark:text-slate-300'}`}>
                    <Icon className="w-4 h-4" /> {label}
                  </div>
                  <p className={`text-xs mt-1 ${overallDecision === val ? `text-${color}-600 dark:text-${color}-400` : 'text-slate-400'}`}>{desc}</p>
                </button>
              ))}
            </div>

            <div className="space-y-1.5">
              <Label>Lab Notes</Label>
              <textarea
                className="w-full border rounded-md p-3 h-20 bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm resize-none"
                placeholder="Any additional lab notes or observations..."
                value={labNotes}
                onChange={e => setLabNotes(e.target.value)}
              />
            </div>

            {overallDecision === 'REJECTED' && (
              <div className="p-3 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-lg text-sm text-red-600 dark:text-red-400 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium">Rejection Impact</p>
                  <p className="text-xs mt-0.5">This GRN will be marked as LAB_REJECTED and excluded from Upcoming Deliveries. A Purchase Return should be initiated.</p>
                </div>
              </div>
            )}
          </div>

          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-600 dark:text-red-400">{error}</div>
          )}

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => navigate('/lab/pending')}>Cancel</Button>
            <Button type="submit" disabled={mutation.isPending} className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2 min-w-40">
              {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {mutation.isPending ? 'Submitting...' : 'Submit Lab Results'}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
