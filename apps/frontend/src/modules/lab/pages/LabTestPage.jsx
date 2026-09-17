import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/axios';
import { format } from 'date-fns';
import {
  ArrowLeft, Loader2, FlaskConical, Package, CheckCircle2, XCircle,
  AlertTriangle, Send, ChevronDown, Tag, Edit2, AlertCircle, Plus, Trash2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import useAuthStore from '@/app/store/authStore';
import DashboardBackButton from '@/components/ui/DashboardBackButton';

const GRN_STATUS_CONFIG = {
  PENDING_LAB:    { label: 'Pending Lab',    color: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20', icon: FlaskConical },
  LAB_APPROVED:   { label: 'Lab Approved',   color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20', icon: CheckCircle2 },
  LAB_REJECTED:   { label: 'Lab Rejected',   color: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20', icon: XCircle },
  LAB_RESAMPLE:   { label: 'Re-sample',      color: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20', icon: AlertCircle },
};

const DECISION_CONFIG = {
  APPROVED: {
    label: 'Approve Batch',
    desc: 'Stock will be updated',
    bg: 'bg-emerald-50/50 dark:bg-emerald-950/20',
    border: 'border-emerald-500',
    text: 'text-emerald-700 dark:text-emerald-400',
    Icon: CheckCircle2,
  },
  REJECTED: {
    label: 'Reject Batch',
    desc: 'Stock will NOT update',
    bg: 'bg-rose-50/50 dark:bg-rose-950/20',
    border: 'border-rose-500',
    text: 'text-rose-700 dark:text-rose-400',
    Icon: XCircle,
  },
  NEED_SAMPLE: {
    label: 'Need Re-sample',
    desc: 'Flag for retest',
    bg: 'bg-amber-50/50 dark:bg-amber-950/20',
    border: 'border-amber-500',
    text: 'text-amber-700 dark:text-amber-400',
    Icon: AlertTriangle,
  },
};

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
  const queryClient = useQueryClient();
  const user = useAuthStore(s => s.user);

  const [results, setResults] = useState([]);
  const [overallDecision, setOverallDecision] = useState('APPROVED');
  const [labNotes, setLabNotes] = useState('');
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [isEditingDecision, setIsEditingDecision] = useState(false);

  // Validation tracking for mandatory RM parameters
  const [validationErrors, setValidationErrors] = useState({});
  const [newCustomParamName, setNewCustomParamName] = useState({});

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

  const canEditDecision = ['MAIN_MASTER', 'LAB_ASSISTANT'].includes(user?.role) && grn?.status === 'PENDING_LAB';

  // Filter items: Separate test-required items from exempt items
  const testRequiredItems = useMemo(() => {
    return (grn?.items || []).filter(item => item.labTestRequired !== false);
  }, [grn?.items]);

  const exemptItems = useMemo(() => {
    return (grn?.items || []).filter(item => item.labTestRequired === false);
  }, [grn?.items]);

  // Reset results and form when grnId route param changes
  useEffect(() => {
    setResults([]);
    setSubmitted(false);
    setError('');
    setValidationErrors({});
  }, [grnId]);

  // Populate results strictly for items that require lab testing
  useEffect(() => {
    if (!grn?.items) return;

    if (grn.labTest) {
      setOverallDecision(grn.labTest.overallDecision || 'APPROVED');
      setLabNotes(grn.labTest.labNotes || '');
      setResults(testRequiredItems.map(item => {
        const matchingResult = grn.labTest.testResults?.find(tr => tr.grnItemId === item.id);
        return {
          grnItemId: item.id,
          rmId: item.rmId,
          rmName: item.rmName,
          actualReceivedQty: item.actualReceivedQty,
          expiryDate: matchingResult?.expiryDate ? format(new Date(matchingResult.expiryDate), 'yyyy-MM-dd') : format(new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
          testNotes: matchingResult?.testNotes || '',
          passed: matchingResult?.passed ?? true,
          needTesting: matchingResult?.needTesting ?? true,
          rmLabCategoryId: matchingResult?.rmLabCategoryId || '',
          categoryParams: matchingResult?.categoryParams || {},
        };
      }));
    } else {
      setResults(testRequiredItems.map(item => ({
        grnItemId: item.id,
        rmId: item.rmId,
        rmName: item.rmName,
        actualReceivedQty: item.actualReceivedQty,
        expiryDate: format(new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
        testNotes: '',
        passed: true,
        needTesting: true,
        rmLabCategoryId: '',
        categoryParams: {},
      })));
    }
  }, [grn?.id, testRequiredItems]);

  // Intelligent category auto-detection when categories load
  useEffect(() => {
    if (!rmLabCategories || rmLabCategories.length === 0 || !results || results.length === 0) return;

    let hasChanges = false;
    const updated = results.map(r => {
      if (r.needTesting !== false && !r.rmLabCategoryId) {
        const text = `${r.rmName || ''}`.toLowerCase();
        let match = null;
        if (text.includes('paper') || text.includes('wrapper') || text.includes('cup') || text.includes('lid') || text.includes('box') || text.includes('pack') || text.includes('carton')) {
          match = rmLabCategories.find(c => c.code === 'PACKAGING_RM');
        } else if (text.includes('milk') || text.includes('cream') || text.includes('butter') || text.includes('smp') || text.includes('whey') || text.includes('dairy')) {
          match = rmLabCategories.find(c => c.code === 'DAIRY_RM') || rmLabCategories.find(c => c.code === 'MILK_POWDER');
        } else if (text.includes('sugar') || text.includes('sweet') || text.includes('syrup') || text.includes('glucose')) {
          match = rmLabCategories.find(c => c.code === 'SWEETENER_RM');
        } else if (text.includes('choco') || text.includes('cocoa')) {
          match = rmLabCategories.find(c => c.code === 'COCOA_CHOCO_RM');
        } else if (text.includes('nut') || text.includes('almond') || text.includes('cashew') || text.includes('peanut')) {
          match = rmLabCategories.find(c => c.code === 'NUT_RM');
        } else if (text.includes('oil') || text.includes('fat') || text.includes('ghee')) {
          match = rmLabCategories.find(c => c.code === 'FAT_RM');
        } else if (text.includes('flavor') || text.includes('essence') || text.includes('vanilla')) {
          match = rmLabCategories.find(c => c.code === 'FLAVOR_RM');
        } else if (text.includes('color')) {
          match = rmLabCategories.find(c => c.code === 'COLOR_RM');
        } else if (text.includes('water')) {
          match = rmLabCategories.find(c => c.code === 'WATER_RM');
        } else if (text.includes('mango') || text.includes('fruit') || text.includes('pulp')) {
          match = rmLabCategories.find(c => c.code === 'FRUIT_RM');
        }

        if (!match) {
          match = rmLabCategories.find(c => c.code === 'GENERAL_RM') || rmLabCategories[0];
        }

        if (match) {
          hasChanges = true;
          const initialParams = {};
          if (match.requiredResults && match.requiredResults.length > 0) {
            match.requiredResults.forEach(p => { initialParams[p.paramName] = ''; });
          } else if (match.labTests) {
            match.labTests.forEach(t => { initialParams[t] = ''; });
          }
          return {
            ...r,
            rmLabCategoryId: match.id,
            categoryParams: { ...initialParams, ...(r.categoryParams || {}) }
          };
        }
      }
      return r;
    });

    if (hasChanges) {
      setResults(updated);
    }
  }, [rmLabCategories, results]);

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
    setValidationErrors(prev => {
      const next = { ...prev };
      delete next[`${idx}_category`];
      return next;
    });
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

    setValidationErrors(prev => {
      const next = { ...prev };
      delete next[`${idx}_${paramName}`];
      return next;
    });
  };

  const handleAddCustomParam = (idx) => {
    const name = (newCustomParamName[idx] || '').trim();
    if (!name) return;
    setResults(prev => prev.map((r, i) => {
      if (i === idx) {
        return {
          ...r,
          categoryParams: {
            ...r.categoryParams,
            [name]: ''
          }
        };
      }
      return r;
    }));
    setNewCustomParamName(prev => ({ ...prev, [idx]: '' }));
  };

  const handleRemoveCustomParam = (idx, paramName) => {
    setResults(prev => prev.map((r, i) => {
      if (i === idx) {
        const updated = { ...r.categoryParams };
        delete updated[paramName];
        return { ...r, categoryParams: updated };
      }
      return r;
    }));
  };

  const handleSave = (isDraft) => {
    setError('');
    const newErrors = {};

    if (!isDraft) {
      for (let i = 0; i < results.length; i++) {
        const r = results[i];
        if (r.needTesting !== false) {
          // 1. RM Lab Category is mandatory
          if (!r.rmLabCategoryId) {
            newErrors[`${i}_category`] = true;
            setError(`RM Lab Category is mandatory for material: "${r.rmName}". Please select an RM category.`);
            setValidationErrors(newErrors);
            return;
          }

          const cat = rmLabCategories.find(c => c.id === r.rmLabCategoryId);
          const params = r.categoryParams || {};

          // 2. Determine all mandatory parameters
          let expectedParams = [];
          if (cat?.requiredResults && cat.requiredResults.length > 0) {
            expectedParams = cat.requiredResults.map(p => p.paramName);
          } else if (cat?.labTests && cat.labTests.length > 0) {
            expectedParams = [...cat.labTests];
          }

          const allParamKeys = Array.from(new Set([...expectedParams, ...Object.keys(params)]));

          if (allParamKeys.length === 0) {
            newErrors[`${i}_category`] = true;
            setError(`RM test parameters are mandatory for "${r.rmName}". Please enter required parameters.`);
            setValidationErrors(newErrors);
            return;
          }

          // 3. Every parameter MUST be entered (not optional!)
          for (const paramKey of allParamKeys) {
            const val = params[paramKey];
            if (val === undefined || val === null || String(val).trim() === '') {
              newErrors[`${i}_${paramKey}`] = true;
              setError(`RM Parameter "${paramKey}" is mandatory and cannot be empty for ${r.rmName}. All RM parameters must be entered.`);
              setValidationErrors(newErrors);
              return;
            }
          }
        }
      }
    }
    
    const activeResults = results.map(r => ({
      grnItemId: r.grnItemId,
      rmId: r.rmId,
      rmName: r.rmName,
      expiryDate: r.expiryDate,
      testNotes: r.testNotes,
      passed: r.needTesting === false ? true : r.passed,
      needTesting: r.needTesting !== false,
      rmLabCategoryId: r.needTesting && r.rmLabCategoryId ? r.rmLabCategoryId : null,
      categoryParams: r.needTesting && Object.keys(r.categoryParams || {}).length > 0 ? r.categoryParams : null,
    }));

    const exemptResults = exemptItems.map(item => ({
      grnItemId: item.id,
      rmId: item.rmId,
      rmName: item.rmName,
      expiryDate: format(new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
      testNotes: 'Lab Test Exempt — directly uploaded to inventory at receipt',
      passed: true,
      needTesting: false,
      rmLabCategoryId: null,
      categoryParams: null,
    }));

    mutation.mutate({
      grnId,
      isDraft,
      testResults: [...activeResults, ...exemptResults],
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
        <div className={`w-16 h-16 rounded-full flex items-center justify-center ${
          overallDecision === 'APPROVED' ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400' :
          overallDecision === 'REJECTED' ? 'bg-rose-100 text-rose-600 dark:bg-rose-950 dark:text-rose-400' :
          'bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-400'
        }`}>
          {overallDecision === 'APPROVED' ? <CheckCircle2 className="w-8 h-8" /> :
           overallDecision === 'REJECTED' ? <XCircle className="w-8 h-8" /> :
           <AlertTriangle className="w-8 h-8" />}
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
            Lab Inspection {overallDecision === 'APPROVED' ? 'Approved & Finalized' : overallDecision === 'REJECTED' ? 'Rejected' : 'Marked for Re-sample'}
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md">
            {overallDecision === 'APPROVED'
              ? 'Raw material stock has been updated with batch traceability and QR identification.'
              : 'Lab inspection decision has been submitted and notifications sent to stakeholders.'}
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => navigate('/lab/results')}>
            View Lab Results
          </Button>
          <Button onClick={() => navigate('/rm/stock')}>
            View RM Stock
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-6 space-y-6 mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <DashboardBackButton />
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
              <FlaskConical className="w-6 h-6 text-indigo-600" />
              Quality Inspection & Lab Test
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              GRN: <span className="font-mono font-bold text-slate-700 dark:text-slate-300">{grn?.referenceNo || grnId}</span>
              {grn?.po?.referenceNo && (
                <> · PO: <span className="font-mono font-bold text-slate-700 dark:text-slate-300">{grn.po.referenceNo}</span></>
              )}
            </p>
          </div>
        </div>

        {grn?.status && (
          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${
            GRN_STATUS_CONFIG[grn.status]?.color || 'bg-slate-100 text-slate-700 border-slate-200'
          }`}>
            <FlaskConical className="w-3.5 h-3.5" />
            {GRN_STATUS_CONFIG[grn.status]?.label || grn.status}
          </span>
        )}
      </div>

      {isLoading ? (
        <div className="py-20 flex flex-col items-center justify-center space-y-3">
          <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
          <p className="text-sm text-slate-400 font-medium">Loading inspection details...</p>
        </div>
      ) : (
        <form onSubmit={(e) => { e.preventDefault(); handleSave(false); }} className="space-y-6">
          {/* Main Inspection Items */}
          <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500">
                Raw Material Items ({grn?.items?.length || 0})
              </h3>
              <span className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold">
                {testRequiredItems.length} require lab testing · {exemptItems.length} exempt
              </span>
            </div>

            {/* If any items were exempt */}
            {exemptItems.length > 0 && (
              <div className="p-4 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-900/50 flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center justify-between flex-wrap gap-1">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                      {exemptItems.length} Material{exemptItems.length > 1 ? 's' : ''} Lab-Exempt · Already in Inventory Stock
                    </h4>
                    <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">No testing required</span>
                  </div>
                  <p className="text-xs text-emerald-700/85 dark:text-emerald-400/85">
                    Marked Lab Exempt in the PO and credited directly to raw material stock upon delivery receipt:
                  </p>
                  <div className="flex flex-wrap gap-2 pt-0.5">
                    {exemptItems.map(it => (
                      <span key={it.id} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 border border-emerald-200 dark:border-emerald-800 shadow-2xs">
                        <span>{it.rmName}</span>
                        <span className="font-mono text-[10px] text-slate-400">({it.rmId})</span>
                        <span className="text-emerald-600 dark:text-emerald-400 font-extrabold">• Qty: {Number(it.actualReceivedQty)}</span>
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Test Required Items */}
            {testRequiredItems.length === 0 ? (
              <div className="py-12 text-center space-y-3 bg-slate-50/50 dark:bg-slate-900/50 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <h4 className="text-base font-bold text-slate-800 dark:text-slate-100">All Materials in this Delivery are Lab Test Exempt</h4>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  No items require laboratory testing. Materials have been directly uploaded to inventory stock.
                </p>
                <Button variant="outline" size="sm" onClick={() => navigate('/grn/list')} className="mt-2 text-xs rounded-xl">
                  Return to Deliveries
                </Button>
              </div>
            ) : (
              testRequiredItems.map((item, idx) => (
                <div key={item.id} className="border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 space-y-5 bg-white dark:bg-slate-900 shadow-sm relative overflow-hidden">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
                    <div>
                      <h4 className="font-bold text-slate-900 dark:text-white text-base sm:text-lg flex items-center gap-2">
                        <Package className="w-5 h-5 text-indigo-600" />
                        {item.rmName}
                      </h4>
                      <p className="text-xs text-slate-400 font-mono mt-0.5">{item.rmId}</p>
                    </div>
                    <div className="text-left sm:text-right text-xs sm:text-sm">
                      <span className="text-slate-400">Received Quantity: </span>
                      <span className="font-black text-slate-900 dark:text-slate-100">{Number(item.actualReceivedQty).toLocaleString()}</span>
                    </div>
                  </div>

                  {/* Testing Requirement Toggle */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 dark:bg-slate-950/40 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800">
                    <div>
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block">Testing Requirement</span>
                      <p className="text-[11px] text-slate-400 mt-0.5">Specify if this raw material needs lab evaluation and parameter entry</p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={!canEditDecision}
                        onClick={() => updateResult(idx, 'needTesting', true)}
                        className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border active:scale-95 ${
                          results[idx]?.needTesting !== false
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                        } ${!canEditDecision ? 'opacity-55 cursor-not-allowed' : ''}`}
                      >
                        <FlaskConical className="w-3.5 h-3.5" /> Lab Test Required
                      </button>
                      <button
                        type="button"
                        disabled={!canEditDecision}
                        onClick={() => updateResult(idx, 'needTesting', false)}
                        className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border active:scale-95 ${
                          results[idx]?.needTesting === false
                            ? 'bg-amber-600 text-white border-amber-600 shadow-sm'
                            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                        } ${!canEditDecision ? 'opacity-55 cursor-not-allowed' : ''}`}
                      >
                        <XCircle className="w-3.5 h-3.5" /> No Lab Test
                      </button>
                    </div>
                  </div>

                  {/* Basic Testing Fields */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-slate-600 dark:text-slate-400">Expiry Date *</Label>
                      <Input
                        type="date"
                        required
                        disabled={!canEditDecision}
                        value={results[idx]?.expiryDate || ''}
                        onChange={e => updateResult(idx, 'expiryDate', e.target.value)}
                        className="rounded-xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
                      />
                    </div>

                    {results[idx]?.needTesting !== false && (
                      <div className="space-y-1.5">
                        <Label className="text-xs font-bold text-slate-600 dark:text-slate-400">QC Status *</Label>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            disabled={!canEditDecision}
                            onClick={() => updateResult(idx, 'passed', true)}
                            className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 active:scale-95 ${
                              results[idx]?.passed
                                ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                                : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-900'
                            } ${!canEditDecision ? 'opacity-55 cursor-not-allowed' : ''}`}
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" /> Pass
                          </button>
                          <button
                            type="button"
                            disabled={!canEditDecision}
                            onClick={() => updateResult(idx, 'passed', false)}
                            className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 active:scale-95 ${
                              !results[idx]?.passed
                                ? 'bg-rose-600 text-white border-rose-600 shadow-sm'
                                : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-900'
                            } ${!canEditDecision ? 'opacity-55 cursor-not-allowed' : ''}`}
                          >
                            <XCircle className="w-3.5 h-3.5" /> Fail
                          </button>
                        </div>
                      </div>
                    )}

                    <div className={results[idx]?.needTesting !== false ? 'space-y-1.5' : 'space-y-1.5 md:col-span-2'}>
                      <Label className="text-xs font-bold text-slate-600 dark:text-slate-400">Test Notes</Label>
                      <Input
                        disabled={!canEditDecision}
                        value={results[idx]?.testNotes || ''}
                        onChange={e => updateResult(idx, 'testNotes', e.target.value)}
                        placeholder="Observation details..."
                        className="rounded-xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
                      />
                    </div>
                  </div>

                  {/* Mandatory RM Parameters Section */}
                  {results[idx]?.needTesting !== false && (
                    <div className="space-y-4 border-t border-slate-100 dark:border-slate-800 pt-4">
                      {/* RM Lab Category Selection */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                            <span>RM Lab Category</span>
                            <span className="text-rose-600 font-bold text-[11px]">* Mandatory</span>
                          </Label>
                          <span className="text-[11px] text-slate-400">
                            Select category to load parameter testing criteria
                          </span>
                        </div>
                        <div className="relative">
                          <select
                            disabled={!canEditDecision}
                            value={results[idx]?.rmLabCategoryId || ''}
                            onChange={e => handleItemCategoryChange(idx, e.target.value)}
                            className={`w-full border rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 appearance-none pr-10 transition-all ${
                              validationErrors[`${idx}_category`]
                                ? 'border-2 border-rose-500 ring-2 ring-rose-500/20 bg-rose-50/20'
                                : 'border-slate-200 dark:border-slate-800'
                            }`}
                          >
                            <option value="">— Select RM Lab Category (Mandatory) —</option>
                            {rmLabCategories.map(c => (
                              <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
                            ))}
                          </select>
                          <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        </div>
                        {validationErrors[`${idx}_category`] && (
                          <p className="text-[11px] text-rose-600 font-bold flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" /> Please select an RM Lab Category for this material
                          </p>
                        )}
                      </div>

                      {/* Parameters Box */}
                      {(() => {
                        const itemCat = rmLabCategories.find(c => c.id === results[idx]?.rmLabCategoryId);
                        if (!itemCat) {
                          return (
                            <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 flex items-center gap-2.5 text-xs text-amber-800 dark:text-amber-300">
                              <AlertTriangle className="w-4 h-4 shrink-0" />
                              <span>
                                <strong>RM Parameters are mandatory:</strong> Please select an RM Lab Category above to enter test values.
                              </span>
                            </div>
                          );
                        }

                        const itemRequiredParams = itemCat.requiredResults || [];
                        const predefinedTestNames = itemRequiredParams.length > 0 
                          ? itemRequiredParams.map(p => p.paramName) 
                          : (itemCat.labTests || []);

                        const customKeys = Object.keys(results[idx]?.categoryParams || {}).filter(
                          k => !predefinedTestNames.includes(k)
                        );

                        return (
                          <div className="p-4 sm:p-5 bg-indigo-50/20 dark:bg-indigo-950/15 border border-indigo-100/60 dark:border-indigo-900/40 rounded-2xl space-y-4">
                            {/* Parameters Header */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-indigo-100/40 dark:border-indigo-900/30 pb-3">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs font-black text-indigo-700 dark:text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
                                  <FlaskConical className="w-4 h-4" />
                                  {itemCat.name} Parameters
                                </span>
                                <span className="text-[10px] px-2.5 py-0.5 rounded-full font-bold bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-900">
                                  * All Parameters Mandatory (Not Optional)
                                </span>
                              </div>
                              {itemCat.rmExamples && (
                                <span className="text-[11px] bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-800 font-mono">
                                  Examples: {itemCat.rmExamples}
                                </span>
                              )}
                            </div>

                            {/* Parameters Grid */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                              {/* 1. Category Required Results */}
                              {itemRequiredParams.length > 0 ? (
                                itemRequiredParams.map(param => {
                                  const isInvalid = validationErrors[`${idx}_${param.paramName}`];
                                  return (
                                    <div key={param.id} className="space-y-1.5">
                                      <Label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                                        <span className="flex items-center gap-1 truncate">
                                          {param.paramName}
                                          {param.paramUnit && <span className="text-slate-400 font-normal">({param.paramUnit})</span>}
                                        </span>
                                        <span className="text-rose-600 font-bold text-[10px] shrink-0">* Required</span>
                                      </Label>
                                      <Input
                                        required
                                        disabled={!canEditDecision}
                                        value={results[idx]?.categoryParams?.[param.paramName] || ''}
                                        onChange={e => updateItemCategoryParam(idx, param.paramName, e.target.value)}
                                        placeholder={
                                          param.acceptableText ||
                                          (param.acceptableMin != null && param.acceptableMax != null
                                            ? `${param.acceptableMin} – ${param.acceptableMax}`
                                            : `Enter ${param.paramName} value...`)
                                        }
                                        className={`h-9.5 text-xs bg-white dark:bg-slate-900 rounded-xl transition-all ${
                                          isInvalid
                                            ? 'border-2 border-rose-500 ring-2 ring-rose-500/20 bg-rose-50/20'
                                            : 'border-slate-250 dark:border-slate-800'
                                        }`}
                                      />
                                      {isInvalid ? (
                                        <p className="text-[10px] text-rose-600 font-bold flex items-center gap-1">
                                          <AlertCircle className="w-3 h-3 shrink-0" /> Parameter value is required (not optional)
                                        </p>
                                      ) : (param.acceptableMin != null || param.acceptableMax != null || param.acceptableText) ? (
                                        <p className="text-[10px] text-slate-400 font-medium truncate">
                                          Acceptable: {param.acceptableText || `${param.acceptableMin ?? ''}–${param.acceptableMax ?? ''} ${param.paramUnit || ''}`}
                                        </p>
                                      ) : null}
                                    </div>
                                  );
                                })
                              ) : (
                                /* 2. Fallback to Category labTests */
                                itemCat.labTests?.map(test => {
                                  const isInvalid = validationErrors[`${idx}_${test}`];
                                  return (
                                    <div key={test} className="space-y-1.5">
                                      <Label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                                        <span className="truncate">{test}</span>
                                        <span className="text-rose-600 font-bold text-[10px] shrink-0">* Required</span>
                                      </Label>
                                      <Input
                                        required
                                        disabled={!canEditDecision}
                                        value={results[idx]?.categoryParams?.[test] || ''}
                                        onChange={e => updateItemCategoryParam(idx, test, e.target.value)}
                                        placeholder={`Enter ${test} result (mandatory)...`}
                                        className={`h-9.5 text-xs bg-white dark:bg-slate-900 rounded-xl transition-all ${
                                          isInvalid
                                            ? 'border-2 border-rose-500 ring-2 ring-rose-500/20 bg-rose-50/20'
                                            : 'border-slate-250 dark:border-slate-800'
                                        }`}
                                      />
                                      {isInvalid && (
                                        <p className="text-[10px] text-rose-600 font-bold flex items-center gap-1">
                                          <AlertCircle className="w-3 h-3 shrink-0" /> {test} value is required
                                        </p>
                                      )}
                                    </div>
                                  );
                                })
                              )}

                              {/* 3. Custom User-Added Parameters */}
                              {customKeys.map(customKey => {
                                const isInvalid = validationErrors[`${idx}_${customKey}`];
                                return (
                                  <div key={customKey} className="space-y-1.5 bg-white/60 dark:bg-slate-900/60 p-2.5 rounded-xl border border-indigo-100 dark:border-indigo-900">
                                    <div className="flex items-center justify-between">
                                      <Label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1 truncate">
                                        <span>{customKey}</span>
                                        <span className="text-rose-600 font-bold text-[10px]">* Required</span>
                                      </Label>
                                      <button
                                        type="button"
                                        disabled={!canEditDecision}
                                        onClick={() => handleRemoveCustomParam(idx, customKey)}
                                        className="text-rose-500 hover:text-rose-700 p-0.5 rounded cursor-pointer"
                                        title="Remove parameter"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                    <Input
                                      required
                                      disabled={!canEditDecision}
                                      value={results[idx]?.categoryParams?.[customKey] || ''}
                                      onChange={e => updateItemCategoryParam(idx, customKey, e.target.value)}
                                      placeholder={`Enter ${customKey} value...`}
                                      className={`h-9 text-xs bg-white dark:bg-slate-900 rounded-xl transition-all ${
                                        isInvalid
                                          ? 'border-2 border-rose-500 ring-2 ring-rose-500/20 bg-rose-50/20'
                                          : 'border-slate-250 dark:border-slate-800'
                                      }`}
                                    />
                                    {isInvalid && (
                                      <p className="text-[10px] text-rose-600 font-bold flex items-center gap-1">
                                        <AlertCircle className="w-3 h-3 shrink-0" /> Parameter value is required
                                      </p>
                                    )}
                                  </div>
                                );
                              })}
                            </div>

                            {/* Add Custom Parameter Input */}
                            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-2 border-t border-indigo-100/40 dark:border-indigo-900/20">
                              <Input
                                disabled={!canEditDecision}
                                value={newCustomParamName[idx] || ''}
                                onChange={e => setNewCustomParamName(prev => ({ ...prev, [idx]: e.target.value }))}
                                placeholder="Add custom parameter (e.g. GSM, Burst Factor, Cob Value, Ash %)..."
                                className="h-9 text-xs bg-white dark:bg-slate-900 rounded-xl flex-1 border-slate-200 dark:border-slate-800"
                                onKeyDown={e => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    handleAddCustomParam(idx);
                                  }
                                }}
                              />
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={!canEditDecision || !(newCustomParamName[idx] || '').trim()}
                                onClick={() => handleAddCustomParam(idx)}
                                className="h-9 text-xs rounded-xl border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950 font-bold flex items-center gap-1"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                Add Custom Parameter
                              </Button>
                            </div>

                            {itemCat.acceptableResults && (
                              <div className="text-[11px] bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-350 border border-slate-200/80 dark:border-slate-800 p-2.5 rounded-xl flex items-start gap-1.5">
                                <span className="font-bold text-indigo-600 dark:text-indigo-400 shrink-0">Standard Guidelines:</span>
                                <span>{itemCat.acceptableResults}</span>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Overall Decision & Lab Notes */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900 dark:text-white">Overall Decision & Inspection Notes</h3>
              {canEditDecision && (
                <span className="text-xs text-indigo-500 flex items-center gap-1 font-semibold">
                  <Edit2 className="w-3.5 h-3.5" /> Admin / Lab Authorized
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {Object.entries(DECISION_CONFIG).map(([val, cfg]) => {
                const isSelected = overallDecision === val;
                const Icon = cfg.Icon;
                return (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setOverallDecision(val)}
                    className={`p-4 rounded-xl border-2 text-left transition-all ${
                      isSelected
                        ? `${cfg.border} ${cfg.bg}`
                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900'
                    }`}
                  >
                    <div className={`flex items-center gap-2 font-bold ${isSelected ? cfg.text : 'text-slate-700 dark:text-slate-300'}`}>
                      <Icon className="w-4 h-4" /> {cfg.label}
                    </div>
                    <p className={`text-xs mt-1 ${isSelected ? cfg.text : 'text-slate-400'}`}>{cfg.desc}</p>
                  </button>
                );
              })}
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Lab Notes & Audit Remarks</Label>
              <textarea
                className="w-full border rounded-xl p-3 h-20 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs resize-none"
                placeholder="Any additional laboratory observations, test methodology, or technician remarks..."
                value={labNotes}
                onChange={e => setLabNotes(e.target.value)}
              />
            </div>

            {overallDecision === 'REJECTED' && (
              <div className="p-3.5 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 rounded-xl text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                <div>
                  <p className="font-bold">Rejection Notice</p>
                  <p className="mt-0.5">This delivery will be marked as LAB_REJECTED and will not update inventory stock. A purchase return will be triggered.</p>
                </div>
              </div>
            )}
          </div>

          {error && (
            <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border-2 border-rose-500 rounded-xl text-xs font-bold text-rose-700 dark:text-rose-300 flex items-center gap-2 shadow-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex justify-end gap-3 pb-8">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate(location.state?.from || sessionStorage.getItem('lastDashboardPath') || '/lab/pending')}
              className="rounded-xl"
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={mutation.isPending || !canEditDecision}
              onClick={() => handleSave(true)}
              className="bg-slate-600 hover:bg-slate-700 text-white gap-2 rounded-xl"
            >
              {mutation.isPending && mutation.variables?.isDraft ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <FlaskConical className="w-4 h-4" />
              )}
              Save Draft
            </Button>
            <Button
              type="submit"
              disabled={mutation.isPending || !canEditDecision}
              className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2 min-w-44 rounded-xl shadow-xs font-bold"
            >
              {mutation.isPending && !mutation.variables?.isDraft ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4" />
              )}
              {mutation.isPending && !mutation.variables?.isDraft ? 'Finalizing...' : 'Complete & Finalize'}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
