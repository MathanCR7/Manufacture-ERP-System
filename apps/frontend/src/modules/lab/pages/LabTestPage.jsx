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
        needTesting: true,
        rmLabCategoryId: '',
        categoryParams: {},
      })));
    }
  }, [grn]);

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

  const handleItemCategoryChange = (idx, catId) => {
    const cat = rmLabCategories.find(c => c.id === catId);
    const initialParams = {};
    if (cat) {
      const requiredParams = cat.requiredResults || [];
      if (requiredParams.length > 0) {
        requiredParams.forEach(p => {
          initialParams[p.paramName] = '';
        });
      } else if (cat.labTests) {
        cat.labTests.forEach(t => {
          initialParams[t] = '';
        });
      }
    }
    setResults(prev => prev.map((r, i) => i === idx ? { ...r, rmLabCategoryId: catId, categoryParams: initialParams } : r));
  };

  const updateItemCategoryParam = (idx, paramName, value) => {
    setResults(prev => prev.map((r, i) => {
      if (i === idx) {
        return {
          ...r,
          categoryParams: {
            ...r.categoryParams,
            [paramName]: value
          }
        };
      }
      return r;
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    
    mutation.mutate({
      grnId,
      testResults: results.map(r => ({
        grnItemId: r.grnItemId,
        rmId: r.rmId,
        rmName: r.rmName,
        expiryDate: r.expiryDate,
        testNotes: r.testNotes,
        passed: r.needTesting === false ? true : r.passed,
        needTesting: r.needTesting !== false,
        rmLabCategoryId: r.needTesting && r.rmLabCategoryId ? r.rmLabCategoryId : null,
        categoryParams: r.needTesting && Object.keys(r.categoryParams || {}).length > 0 ? r.categoryParams : null,
      })),
      overallDecision,
      labNotes,
      // Root fallback for compatibility
      rmLabCategoryId: results.find(r => r.needTesting && r.rmLabCategoryId)?.rmLabCategoryId || undefined,
      categoryParams: results.find(r => r.needTesting && Object.keys(r.categoryParams || {}).length > 0)?.categoryParams || undefined,
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

          {/* Test Results per Item */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                <FlaskConical className="w-5 h-5 text-indigo-550" /> Test Results per Item
              </h3>
            </div>
            <div className="p-6 space-y-6">
              {grn.items?.map((item, idx) => (
                <div key={item.id} className="border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 space-y-5 bg-slate-50/30 dark:bg-slate-950/20 hover:border-slate-350 dark:hover:border-slate-700 transition-all duration-200 relative overflow-hidden group">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
                    <div>
                      <h4 className="font-bold text-slate-800 dark:text-slate-100 text-base sm:text-lg">{item.rmName}</h4>
                      <p className="text-xs text-slate-400 font-mono mt-0.5">{item.rmId}</p>
                    </div>
                    <div className="text-left sm:text-right text-xs sm:text-sm">
                      <span className="text-slate-400">Received Quantity: </span>
                      <span className="font-extrabold text-slate-900 dark:text-slate-100">{Number(item.actualReceivedQty).toLocaleString()}</span>
                      {Number(item.returnQty) > 0 && (
                        <span className="text-xs text-red-500 font-semibold ml-2">(Return: {Number(item.returnQty)})</span>
                      )}
                    </div>
                  </div>

                  {/* Testing Need Toggle */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-250/60 dark:border-slate-800 shadow-sm">
                    <div>
                      <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">Testing Requirement</span>
                      <p className="text-[11px] text-slate-400 mt-0.5">Specify if this raw material needs lab evaluation</p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => updateResult(idx, 'needTesting', true)}
                        className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border active:scale-95 ${
                          results[idx]?.needTesting !== false
                            ? 'bg-indigo-600 text-white border-indigo-605 shadow-sm shadow-indigo-500/10'
                            : 'bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900'
                        }`}
                      >
                        <FlaskConical className="w-3.5 h-3.5" /> Lab Test Required
                      </button>
                      <button
                        type="button"
                        onClick={() => updateResult(idx, 'needTesting', false)}
                        className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border active:scale-95 ${
                          results[idx]?.needTesting === false
                            ? 'bg-slate-655 text-white border-slate-600 shadow-sm'
                            : 'bg-white dark:bg-slate-955 border-slate-205 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900'
                        }`}
                      >
                        <XCircle className="w-3.5 h-3.5" /> No Lab Test
                      </button>
                    </div>
                  </div>

                  {/* Testing Fields */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-slate-600 dark:text-slate-400">Expiry Date *</Label>
                      <Input
                        type="date"
                        required
                        value={results[idx]?.expiryDate || ''}
                        onChange={e => updateResult(idx, 'expiryDate', e.target.value)}
                        className="rounded-xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
                      />
                    </div>

                    {results[idx]?.needTesting !== false && (
                      <div className="space-y-1.5">
                        <Label className="text-xs font-bold text-slate-600 dark:text-slate-400">Test Result *</Label>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => updateResult(idx, 'passed', true)}
                            className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 active:scale-95 ${
                              results[idx]?.passed
                                ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm shadow-emerald-500/10'
                                : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800'
                            }`}
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" /> Pass
                          </button>
                          <button
                            type="button"
                            onClick={() => updateResult(idx, 'passed', false)}
                            className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 active:scale-95 ${
                              !results[idx]?.passed
                                ? 'bg-rose-600 text-white border-rose-600 shadow-sm shadow-rose-500/10'
                                : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800'
                            }`}
                          >
                            <XCircle className="w-3.5 h-3.5" /> Fail
                          </button>
                        </div>
                      </div>
                    )}

                    <div className={results[idx]?.needTesting !== false ? 'space-y-1.5' : 'space-y-1.5 md:col-span-2'}>
                      <Label className="text-xs font-bold text-slate-600 dark:text-slate-400">Test Notes</Label>
                      <Input
                        value={results[idx]?.testNotes || ''}
                        onChange={e => updateResult(idx, 'testNotes', e.target.value)}
                        placeholder={results[idx]?.needTesting !== false ? 'Observation details...' : 'Exemption reason or notes...'}
                        className="rounded-xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
                      />
                    </div>
                  </div>

                  {/* Category Parameters (Only if Lab Test Required) */}
                  {results[idx]?.needTesting !== false && (
                    <div className="space-y-4 border-t border-slate-100 dark:border-slate-800/80 pt-4">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-bold text-slate-650 dark:text-slate-300">RM Lab Category</Label>
                        <div className="relative">
                          <select
                            value={results[idx]?.rmLabCategoryId || ''}
                            onChange={e => handleItemCategoryChange(idx, e.target.value)}
                            className="w-full border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 appearance-none pr-10"
                          >
                            <option value="">— Select RM category (optional) —</option>
                            {rmLabCategories.map(c => (
                              <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
                            ))}
                          </select>
                          <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        </div>
                      </div>

                      {(() => {
                        const itemCat = rmLabCategories.find(c => c.id === results[idx]?.rmLabCategoryId);
                        if (!itemCat) return null;
                        const itemRequiredParams = itemCat.requiredResults || [];

                        return (
                          <div className="p-4 bg-indigo-50/20 dark:bg-indigo-950/15 border border-indigo-100/50 dark:border-indigo-900/30 rounded-2xl space-y-4">
                            <div className="flex items-center justify-between border-b border-indigo-100/40 dark:border-indigo-900/20 pb-2">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-extrabold text-indigo-700 dark:text-indigo-400 uppercase tracking-wider">{itemCat.name} Parameters</span>
                              </div>
                              {itemCat.rmExamples && (
                                <span className="text-[10px] bg-indigo-50 dark:bg-indigo-950 text-indigo-650 dark:text-indigo-400 px-2 py-0.5 rounded-md font-semibold font-mono">
                                  e.g. {itemCat.rmExamples}
                                </span>
                              )}
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                              {itemRequiredParams.length > 0 ? (
                                itemRequiredParams.map(param => (
                                  <div key={param.id} className="space-y-1">
                                    <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                                      {param.paramName}
                                      {param.paramUnit && <span className="text-slate-400 font-normal">({param.paramUnit})</span>}
                                      {param.isRequired && <span className="text-red-400 font-normal">*</span>}
                                    </label>
                                    <Input
                                      value={results[idx]?.categoryParams?.[param.paramName] || ''}
                                      onChange={e => updateItemCategoryParam(idx, param.paramName, e.target.value)}
                                      placeholder={
                                        param.acceptableText ||
                                        (param.acceptableMin != null && param.acceptableMax != null
                                          ? `${param.acceptableMin} – ${param.acceptableMax}`
                                          : `Value...`)
                                      }
                                      className="h-9 text-xs bg-white dark:bg-slate-900 border-slate-205 dark:border-slate-800 rounded-xl"
                                    />
                                    {(param.acceptableMin != null || param.acceptableMax != null || param.acceptableText) && (
                                      <p className="text-[10px] text-slate-400 font-medium">
                                        Acceptable: {param.acceptableText || `${param.acceptableMin ?? ''}–${param.acceptableMax ?? ''} ${param.paramUnit || ''}`}
                                      </p>
                                    )}
                                  </div>
                                ))
                              ) : itemCat.labTests?.map(test => (
                                <div key={test} className="space-y-1">
                                  <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400">{test}</label>
                                  <Input
                                    value={results[idx]?.categoryParams?.[test] || ''}
                                    onChange={e => updateItemCategoryParam(idx, test, e.target.value)}
                                    placeholder={`Enter ${test} value`}
                                    className="h-9 text-xs bg-white dark:bg-slate-900 border-slate-205 dark:border-slate-800 rounded-xl"
                                  />
                                </div>
                              ))}
                            </div>

                            {itemCat.acceptableResults && (
                              <div className="text-[10px] bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-450 border border-slate-200/80 dark:border-slate-800/80 p-2 rounded-xl">
                                <span className="font-bold text-indigo-600 dark:text-indigo-400">Acceptable guidelines:</span> {itemCat.acceptableResults}
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  )}
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
