import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/axios';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Save, Loader2, AlertTriangle, Plus, Minus, 
  Package, Tag, Scale, TrendingUp, TrendingDown, CheckCircle2,
  FileText, HelpCircle, Info, Lock, Calendar, Clock, Trash2, 
  Search, CheckSquare, Square, RefreshCw, Zap, ExternalLink
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Swal from 'sweetalert2';
import StockRMSearchSelect from './StockRMSearchSelect';
import BatchDateInput from './BatchDateInput';
import { STOCK_ADJUSTMENT_REASONS, ALL_REASON_OPTIONS } from '../constants/adjustmentReasons';

export default function StockAdjustmentForm({ editData = null, onBack }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isEdit = !!editData;

  // Extract initial reason and remarks from existing notes if editing
  const initialReason = useMemo(() => {
    if (!editData?.notes) return '';
    const match = ALL_REASON_OPTIONS.find(opt => editData.notes.startsWith(opt.value));
    return match ? match.value : '';
  }, [editData]);

  const initialRemarks = useMemo(() => {
    if (!editData?.notes) return '';
    if (initialReason && editData.notes.startsWith(initialReason)) {
      const rest = editData.notes.slice(initialReason.length).replace(/^[\s\-–—:]+/, '');
      return rest.trim();
    }
    return editData.notes;
  }, [editData, initialReason]);

  const [form, setForm] = useState({
    rawMaterialId: editData?.rawMaterial?.id || editData?.rawMaterialId || '',
    type: editData?.type || 'ADDITION',
    quantity: editData?.quantity ? String(editData.quantity) : '',
    reason: initialReason || '',
    remarks: initialRemarks || '',
  });

  // State for batches when ADDITION
  const [additionBatches, setAdditionBatches] = useState(() => {
    if (editData?.batches && editData.type === 'ADDITION' && Array.isArray(editData.batches) && editData.batches.length > 0) {
      return editData.batches.map((b, idx) => ({
        id: b.id || `batch_${idx + 1}`,
        batchNumber: b.batchNumber || '',
        quantity: String(b.quantity || ''),
        weight: b.weight || '',
        mfgBatchNo: b.mfgBatchNo || '',
        mfgDate: b.mfgDate || '',
        expDate: b.expDate || b.expiryDate || '',
        storageLocation: b.storageLocation || 'Main RM Store'
      }));
    }
    return [];
  });

  // State for batches when SUBTRACTION: map of { [batchId]: deductionQty }
  const [subtractionAllocations, setSubtractionAllocations] = useState(() => {
    const map = {};
    if (editData?.batches && editData.type === 'SUBTRACTION' && Array.isArray(editData.batches)) {
      editData.batches.forEach(b => {
        const key = b.id || b.batchNumber;
        map[key] = String(b.quantity || 0);
      });
    }
    return map;
  });

  // Search filter for existing batches under subtraction
  const [batchSearchTerm, setBatchSearchTerm] = useState('');

  const [error, setError] = useState(null);

  // 1. Fetch available raw materials catalog
  const { data: rawMaterials = [], isLoading: isRmLoading } = useQuery({
    queryKey: ['rm-stock'],
    queryFn: () => api.get('/rm-stock').then(res => res.data),
    staleTime: 10000,
  });

  // Currently selected raw material object
  const selectedRm = useMemo(() => {
    if (!form.rawMaterialId || !rawMaterials.length) return null;
    return rawMaterials.find(rm => rm.id === form.rawMaterialId || rm.code === form.rawMaterialId) || null;
  }, [form.rawMaterialId, rawMaterials]);

  // 2. Fetch active existing batches for the selected RM (for Subtraction selection)
  const { data: existingBatches = [], isLoading: isBatchesLoading, refetch: refetchBatches } = useQuery({
    queryKey: ['rm-batches', form.rawMaterialId],
    queryFn: () => form.rawMaterialId ? api.get(`/rm-stock/${form.rawMaterialId}/batches`).then(res => res.data) : Promise.resolve([]),
    enabled: !!form.rawMaterialId,
    staleTime: 5000,
  });

  // 3. Fetch Next Batch sequence when ADDITION and RM changes
  const fetchNextBatchSequence = useCallback(async (rmId, rmName) => {
    if (!rmId) return null;
    try {
      const res = await api.get(`/grn/next-batch/${rmId}?rmName=${encodeURIComponent(rmName || '')}`);
      return res.data;
    } catch (err) {
      console.warn('Failed to fetch next batch sequence:', err);
      const clean = (rmName || 'RM').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 24);
      return {
        batchNumber: `BATCH-${clean || 'RM'}-001`,
        nextBatchNumber: `BATCH-${clean || 'RM'}-001`,
        sequence: 1,
      };
    }
  }, []);

  // Initialize or re-fetch addition batch when RM is selected
  useEffect(() => {
    if (form.type === 'ADDITION' && selectedRm && additionBatches.length === 0 && !isEdit) {
      let isCancelled = false;
      fetchNextBatchSequence(selectedRm.id, selectedRm.name).then(seqData => {
        if (!isCancelled && seqData) {
          const defaultBatchNo = seqData.nextBatchNumber || seqData.batchNumber || `BATCH-${(selectedRm.name || 'RM').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 20)}-001`;
          setAdditionBatches([{
            id: 'batch_1',
            batchNumber: defaultBatchNo,
            quantity: form.quantity || '',
            weight: '',
            mfgBatchNo: '',
            mfgDate: '',
            expDate: '',
            storageLocation: 'Main RM Store'
          }]);
        }
      });
      return () => { isCancelled = true; };
    }
  }, [form.type, selectedRm, isEdit, fetchNextBatchSequence]);

  // Sync first batch quantity with main quantity if only 1 batch in addition
  useEffect(() => {
    if (form.type === 'ADDITION' && additionBatches.length === 1 && form.quantity) {
      if (additionBatches[0].quantity !== form.quantity) {
        setAdditionBatches(prev => prev.map((b, i) => i === 0 ? { ...b, quantity: form.quantity } : b));
      }
    }
  }, [form.quantity, form.type]);

  // Filter adjustment reasons based on current adjustment type (ADDITION vs SUBTRACTION)
  const filteredReasonGroups = useMemo(() => {
    return STOCK_ADJUSTMENT_REASONS.map(group => {
      const matching = group.options.filter(opt => 
        opt.type === 'BOTH' || opt.type === form.type
      );
      return {
        ...group,
        options: matching
      };
    }).filter(group => group.options.length > 0);
  }, [form.type]);

  // Base current stock
  const currentAvailableStock = useMemo(() => {
    if (!selectedRm) return 0;
    let base = Number(selectedRm.availableQuantity ?? selectedRm.currentStock ?? 0);
    if (isEdit && (editData.rawMaterial?.id === selectedRm.id || editData.rawMaterialId === selectedRm.id)) {
      if (editData.type === 'SUBTRACTION') {
        base += Number(editData.quantity || 0);
      } else {
        base -= Number(editData.quantity || 0);
      }
    }
    return Math.max(0, base);
  }, [selectedRm, isEdit, editData]);

  const numericQuantity = parseFloat(form.quantity) || 0;

  // Real-time stock calculation
  const projectedNewStock = useMemo(() => {
    if (!selectedRm || numericQuantity <= 0) return currentAvailableStock;
    if (form.type === 'ADDITION') {
      return currentAvailableStock + numericQuantity;
    } else {
      return Math.max(0, currentAvailableStock - numericQuantity);
    }
  }, [selectedRm, currentAvailableStock, numericQuantity, form.type]);

  const isExceedingStock = form.type === 'SUBTRACTION' && numericQuantity > currentAvailableStock;

  // Batch allocations calculation for ADDITION
  const additionTotalAllocated = useMemo(() => {
    return additionBatches.reduce((sum, b) => sum + (parseFloat(b.quantity) || 0), 0);
  }, [additionBatches]);

  const isAdditionExact = Math.abs(additionTotalAllocated - numericQuantity) < 0.0001 && numericQuantity > 0;
  const isAdditionExceeded = additionTotalAllocated > numericQuantity && numericQuantity > 0;

  // Batch allocations calculation for SUBTRACTION
  const subtractionTotalAllocated = useMemo(() => {
    return Object.values(subtractionAllocations).reduce((sum, val) => sum + (parseFloat(val) || 0), 0);
  }, [subtractionAllocations]);

  const isSubtractionExact = Math.abs(subtractionTotalAllocated - numericQuantity) < 0.0001 && numericQuantity > 0;
  const isSubtractionExceeded = subtractionTotalAllocated > numericQuantity && numericQuantity > 0;

  // Add another batch row for ADDITION
  const handleAddAdditionBatch = () => {
    const nextIdx = additionBatches.length + 1;
    const baseBatch = additionBatches[0]?.batchNumber || '';
    const match = baseBatch.match(/^(.*?)(\d+)$/);
    let newBatchNo = '';
    if (match) {
      const prefix = match[1];
      const seq = parseInt(match[2], 10) + nextIdx - 1;
      newBatchNo = `${prefix}${String(seq).padStart(match[2].length, '0')}`;
    } else {
      const clean = (selectedRm?.name || 'RM').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 20);
      newBatchNo = `BATCH-${clean}-${String(nextIdx).padStart(3, '0')}`;
    }

    const remainingQty = Math.max(0, numericQuantity - additionTotalAllocated);

    setAdditionBatches(prev => [
      ...prev,
      {
        id: `batch_${Date.now()}_${nextIdx}`,
        batchNumber: newBatchNo,
        quantity: remainingQty > 0 ? String(remainingQty) : '',
        weight: '',
        mfgBatchNo: '',
        mfgDate: '',
        expDate: '',
        storageLocation: 'Main RM Store'
      }
    ]);
  };

  const handleUpdateAdditionBatch = (index, field, val) => {
    setAdditionBatches(prev => prev.map((b, idx) => idx === index ? { ...b, [field]: val } : b));
  };

  const handleRemoveAdditionBatch = (index) => {
    if (additionBatches.length <= 1) return;
    setAdditionBatches(prev => prev.filter((_, idx) => idx !== index));
  };

  // Subtraction batch selection handlers
  const handleToggleBatchDeduction = (batch) => {
    const key = batch.id || batch.batchNumber;
    setSubtractionAllocations(prev => {
      const copy = { ...prev };
      if (copy[key] !== undefined) {
        delete copy[key];
      } else {
        // Auto fill with either full netQty or remaining needed to fulfill form.quantity
        const currentSum = Object.values(copy).reduce((s, v) => s + (parseFloat(v) || 0), 0);
        const needed = Math.max(0, numericQuantity - currentSum);
        const avail = Number(batch.netQty || 0);
        const toAssign = needed > 0 ? Math.min(needed, avail) : avail;
        copy[key] = String(toAssign);
      }
      return copy;
    });
  };

  const handleUpdateSubtractionQty = (batch, val) => {
    const key = batch.id || batch.batchNumber;
    setSubtractionAllocations(prev => ({
      ...prev,
      [key]: val
    }));
  };

  // Quick action: Auto-allocate earliest expiry batches (FEFO)
  const handleAutoAllocateFEFO = () => {
    if (!existingBatches.length || numericQuantity <= 0) return;
    let needed = numericQuantity;
    const newAlloc = {};

    // Sort by expiry date ascending (nulls last)
    const sorted = [...existingBatches].sort((a, b) => {
      if (!a.expiryDate) return 1;
      if (!b.expiryDate) return -1;
      return new Date(a.expiryDate) - new Date(b.expiryDate);
    });

    for (const b of sorted) {
      if (needed <= 0) break;
      const avail = Number(b.netQty || 0);
      if (avail > 0) {
        const take = Math.min(needed, avail);
        newAlloc[b.id || b.batchNumber] = String(take);
        needed -= take;
      }
    }
    setSubtractionAllocations(newAlloc);
  };

  // Filter existing batches by search query
  const filteredExistingBatches = useMemo(() => {
    if (!batchSearchTerm.trim()) return existingBatches;
    const q = batchSearchTerm.toLowerCase().trim();
    return existingBatches.filter(b => 
      (b.batchNumber && b.batchNumber.toLowerCase().includes(q)) ||
      (b.poReferenceNo && b.poReferenceNo.toLowerCase().includes(q)) ||
      (b.grnReferenceNo && b.grnReferenceNo.toLowerCase().includes(q)) ||
      (b.supplierName && b.supplierName.toLowerCase().includes(q)) ||
      (b.storageLocation && b.storageLocation.toLowerCase().includes(q)) ||
      (b.mfgBatchNo && b.mfgBatchNo.toLowerCase().includes(q))
    );
  }, [existingBatches, batchSearchTerm]);

  // Mutation to create/update adjustment
  const mutation = useMutation({
    mutationFn: (payload) => 
      isEdit 
        ? api.put(`/rm-stock-adjustment/${editData.id}`, payload).then(r => r.data)
        : api.post('/rm-stock-adjustment', payload).then(r => r.data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['rm-stock-adjustment'] });
      queryClient.invalidateQueries({ queryKey: ['rm-stock'] });
      queryClient.invalidateQueries({ queryKey: ['rm-batches'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });

      Swal.fire({
        icon: 'success',
        title: isEdit ? 'Adjustment Updated!' : 'Stock Adjusted Successfully!',
        html: `<b>${selectedRm?.name || 'Raw Material'}</b> stock has been ${form.type === 'ADDITION' ? 'increased (+)' : 'reduced (-)'} by <b>${numericQuantity} ${selectedRm?.unit || ''}</b>.<br/><span class="text-xs text-slate-500">Updated Current Stock: <b>${projectedNewStock.toFixed(2)} ${selectedRm?.unit || ''}</b></span>`,
        timer: 3500,
        showConfirmButton: false,
        toast: true,
        position: 'top-end'
      });

      if (onBack) {
        onBack();
      } else {
        navigate('/rm/stock-adjustment/list');
      }
    },
    onError: (err) => {
      setError(err?.response?.data?.error || err.message || 'Failed to submit stock adjustment');
    }
  });

  const handleSubmit = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    setError(null);

    if (!form.rawMaterialId) {
      setError('Please select a Raw Material from catalog');
      return;
    }

    if (!form.type) {
      setError('Please select an Adjustment Type (Addition or Subtraction)');
      return;
    }

    if (!form.quantity || numericQuantity <= 0) {
      setError('Please enter a valid positive quantity greater than 0');
      return;
    }

    if (isExceedingStock) {
      setError(`Cannot subtract ${numericQuantity} ${selectedRm?.unit || ''}. Current available stock is only ${currentAvailableStock.toFixed(2)} ${selectedRm?.unit || ''}.`);
      return;
    }

    // Prepare batches payload
    let finalBatches = [];

    if (form.type === 'ADDITION') {
      if (additionBatches.length > 0) {
        // Validate each addition batch
        for (let i = 0; i < additionBatches.length; i++) {
          const b = additionBatches[i];
          if (!b.batchNumber?.trim()) {
            setError(`Batch #${i + 1} must have a valid Batch Number`);
            return;
          }
          const bQty = parseFloat(b.quantity) || 0;
          if (bQty <= 0) {
            setError(`Batch #${i + 1} (${b.batchNumber}) must have a quantity greater than 0`);
            return;
          }
        }

        if (!isAdditionExact) {
          setError(`Allocated batch quantity (${additionTotalAllocated}) does not match adjustment total quantity (${numericQuantity})`);
          return;
        }

        finalBatches = additionBatches.map(b => ({
          batchNumber: b.batchNumber.trim(),
          quantity: parseFloat(b.quantity) || 0,
          weight: b.weight || null,
          mfgBatchNo: b.mfgBatchNo || null,
          mfgDate: b.mfgDate || null,
          expDate: b.expDate || null,
          storageLocation: b.storageLocation || 'Main RM Store'
        }));
      }
    } else if (form.type === 'SUBTRACTION') {
      const selectedKeys = Object.keys(subtractionAllocations);
      if (selectedKeys.length > 0) {
        if (!isSubtractionExact) {
          setError(`Total subtracted from batches (${subtractionTotalAllocated}) must equal adjustment quantity (${numericQuantity})`);
          return;
        }

        for (const key of selectedKeys) {
          const deductQty = parseFloat(subtractionAllocations[key]) || 0;
          if (deductQty <= 0) continue;

          const batch = existingBatches.find(b => (b.id === key || b.batchNumber === key));
          if (batch && deductQty > Number(batch.netQty || 0)) {
            setError(`Cannot deduct ${deductQty} from Batch ${batch.batchNumber}. Available is only ${batch.netQty} ${batch.uom}.`);
            return;
          }

          finalBatches.push({
            id: batch?.id || key,
            batchNumber: batch?.batchNumber || key,
            quantity: deductQty,
            poReferenceNo: batch?.poReferenceNo || null,
            grnReferenceNo: batch?.grnReferenceNo || null,
            supplierName: batch?.supplierName || null,
            storageLocation: batch?.storageLocation || 'Main RM Store',
            weight: batch?.weight || null,
            mfgBatchNo: batch?.mfgBatchNo || null,
            mfgDate: batch?.mfgDate || null,
            expDate: batch?.expiryDate || null,
          });
        }
      }
    }

    // Compose final notes string combining Reason + Remarks
    let finalNotes = '';
    if (form.reason && form.remarks) {
      finalNotes = `${form.reason} - ${form.remarks}`;
    } else if (form.reason) {
      finalNotes = form.reason;
    } else if (form.remarks) {
      finalNotes = form.remarks;
    }

    mutation.mutate({
      rawMaterialId: form.rawMaterialId,
      type: form.type,
      quantity: numericQuantity,
      notes: finalNotes || null,
      batches: finalBatches
    });
  };

  const handleSelectRawMaterial = (rm) => {
    setForm(prev => ({
      ...prev,
      rawMaterialId: rm.id
    }));
    setError(null);
    setAdditionBatches([]);
    setSubtractionAllocations({});
  };

  const handleClearRawMaterial = () => {
    setForm(prev => ({
      ...prev,
      rawMaterialId: ''
    }));
    setAdditionBatches([]);
    setSubtractionAllocations({});
  };

  return (
    <div className="w-full max-w-5xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-4">
      {/* ─────────────────────────────────────────────────────────────
          Top Header Bar
          ───────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl px-4 py-3 shadow-xs">
        <div className="flex items-center gap-3 min-w-0">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onBack ? onBack : () => navigate('/rm/stock-adjustment/list')}
            className="h-9 w-9 rounded-xl text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 border border-slate-200 dark:border-slate-800 shrink-0 cursor-pointer"
            title="Go back to list"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>

          <div className="min-w-0">
            <h1 className="text-base sm:text-lg font-bold tracking-tight text-slate-900 dark:text-white truncate">
              {isEdit ? 'Edit Stock Adjustment' : 'Create Stock Adjustment'}
            </h1>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 truncate hidden sm:block">
              Add or subtract physical raw material stock with category verification, batch allocation & audit tracking
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onBack ? onBack : () => navigate('/rm/stock-adjustment/list')}
            className="h-8 px-3 text-xs font-semibold text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 rounded-xl"
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleSubmit}
            disabled={mutation.isPending || isExceedingStock}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-8 px-4 rounded-xl text-xs shadow-xs gap-1.5 transition-all cursor-pointer"
          >
            {mutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            {mutation.isPending ? 'Saving...' : 'Confirm Adjustment'}
          </Button>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          Main Adjustment Form Card
          ───────────────────────────────────────────────────────────── */}
      <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl p-4 sm:p-6 shadow-xs space-y-6">
        
        {/* Section 1: Raw Material Search & Selection */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Package className="w-4 h-4 text-indigo-500" />
              1. Select Raw Material <span className="text-rose-500">*</span>
            </Label>
            {selectedRm && (
              <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Catalog verified
              </span>
            )}
          </div>

          <StockRMSearchSelect
            rawMaterials={rawMaterials}
            selectedMaterialId={form.rawMaterialId}
            onSelect={handleSelectRawMaterial}
            onClear={handleClearRawMaterial}
            error={!form.rawMaterialId && error}
            disabled={mutation.isPending}
          />

          {/* Selected RM Detailed Summary Card matching screenshot */}
          {selectedRm && (
            <div className="mt-2.5 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs animate-in fade-in duration-150">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-black text-slate-900 dark:text-white text-sm">
                    {selectedRm.name}
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 font-mono font-bold text-[11px] border border-indigo-200/70 dark:border-indigo-800/70">
                    {selectedRm.code}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-[11px] flex-wrap">
                  <span>• {selectedRm.category || selectedRm.categoryName || 'PACKING ITEMS'}</span>
                  <span>• Rate: ₹{Number(selectedRm.ratePerUnit || 0).toFixed(2)} / {selectedRm.unit || selectedRm.unitId}</span>
                  {selectedRm.hsnCode && <span>• HSN: {selectedRm.hsnCode}</span>}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="text-right">
                  <span className="text-[10px] font-bold uppercase text-slate-400 block tracking-wider">Current Stock</span>
                  <span className="font-mono font-black text-sm text-slate-900 dark:text-slate-100">
                    {Number(selectedRm.availableQuantity ?? selectedRm.currentStock ?? 0).toLocaleString()} <span className="text-xs font-normal text-slate-400 lowercase">{selectedRm.unit || selectedRm.unitId}</span>
                  </span>
                </div>
                <div className="h-7 w-px bg-slate-200 dark:bg-slate-800" />
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Lab Exempt / Active
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Section 2: Adjustment Type & Quantity Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 pt-2 border-t border-slate-100 dark:border-slate-800">
          
          {/* Adjustment Type Selector */}
          <div className="space-y-2">
            <Label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              {form.type === 'ADDITION' ? <TrendingUp className="w-4 h-4 text-emerald-500" /> : <TrendingDown className="w-4 h-4 text-rose-500" />}
              2. Adjustment Type <span className="text-rose-500">*</span>
            </Label>

            <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 dark:bg-slate-800/60 rounded-2xl border border-slate-200/70 dark:border-slate-700/60">
              <button
                type="button"
                onClick={() => setForm(prev => ({ ...prev, type: 'ADDITION' }))}
                className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  form.type === 'ADDITION'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-emerald-700 hover:bg-white/60 dark:hover:bg-slate-700/50'
                }`}
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Addition (+)</span>
              </button>

              <button
                type="button"
                onClick={() => setForm(prev => ({ ...prev, type: 'SUBTRACTION' }))}
                className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  form.type === 'SUBTRACTION'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-rose-700 hover:bg-white/60 dark:hover:bg-slate-700/50'
                }`}
              >
                <Minus className="w-3.5 h-3.5" />
                <span>Subtraction (-)</span>
              </button>
            </div>
            <p className="text-[11px] text-slate-400 dark:text-slate-500">
              {form.type === 'ADDITION' 
                ? 'Adds stock to inventory with new batch allocation continuing RM purchase numbers' 
                : 'Deducts stock from inventory and select existing batches with PO/GRN reference'}
            </p>
          </div>

          {/* Adjustment Quantity Input */}
          <div className="space-y-2">
            <Label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Scale className="w-4 h-4 text-indigo-500" />
                3. Quantity <span className="text-rose-500">*</span>
              </span>
              {selectedRm && (
                <span className="text-[11px] font-mono font-bold text-slate-500 dark:text-slate-400 lowercase">
                  unit: {selectedRm.unit || selectedRm.unitId || 'units'}
                </span>
              )}
            </Label>

            <div className="relative">
              <Input
                type="number"
                min="0.0001"
                step="any"
                value={form.quantity}
                onChange={(e) => setForm(prev => ({ ...prev, quantity: e.target.value }))}
                placeholder="Enter adjustment quantity (e.g. 5.5)"
                className={`h-11 rounded-2xl pr-16 text-sm font-mono font-bold transition-all ${
                  isExceedingStock 
                    ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-500/20 bg-rose-50/30' 
                    : 'bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 focus:border-indigo-500'
                }`}
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-xs font-bold font-mono text-slate-400">
                <span>{selectedRm ? (selectedRm.unit || selectedRm.unitId || 'units') : 'units'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* ─────────────────────────────────────────────────────────────
            Section 3A: ADDITION BATCHES ALLOCATION (Matches GRN & RM Purchase)
            ───────────────────────────────────────────────────────────── */}
        {form.type === 'ADDITION' && selectedRm && (
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-3">
            {/* Batches Header Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50/70 dark:bg-slate-800/40 p-2.5 rounded-2xl border border-slate-200/80 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <span className="font-bold text-xs uppercase tracking-wide text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                  <Package className="w-4 h-4 text-indigo-500" />
                  BATCHES ({additionBatches.length} {additionBatches.length === 1 ? 'BATCH' : 'BATCHES'})
                </span>

                {/* Allocation Status Badge */}
                {numericQuantity > 0 && (
                  isAdditionExact ? (
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 px-2.5 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> All {numericQuantity} {selectedRm.unit || 'units'} Allocated
                    </span>
                  ) : isAdditionExceeded ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/50 px-2.5 py-0.5 rounded-full border border-rose-200 dark:border-rose-800">
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-600" /> Exceeded: {additionTotalAllocated} / {numericQuantity} {selectedRm.unit || 'units'}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50 px-2.5 py-0.5 rounded-full border border-amber-200 dark:border-amber-800">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600" /> Allocated: {additionTotalAllocated} / {numericQuantity} {selectedRm.unit || 'units'}
                    </span>
                  )
                )}
              </div>

              {/* Add / Split Batch Button */}
              <button
                type="button"
                onClick={handleAddAdditionBatch}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold text-indigo-600 hover:text-indigo-700 bg-white hover:bg-indigo-50 dark:bg-slate-900 dark:hover:bg-slate-800 border border-indigo-200 dark:border-indigo-800 shadow-2xs transition-colors cursor-pointer"
                title="Split this addition into another batch"
              >
                <Plus className="w-3.5 h-3.5 text-indigo-600" />
                + Split / Add Another Batch
              </button>
            </div>

            {/* Addition Batches List */}
            <div className="space-y-2.5">
              {additionBatches.map((batch, bIdx) => (
                <div
                  key={batch.id || bIdx}
                  className="flex flex-wrap items-center gap-3 lg:gap-4 px-3.5 py-2.5 rounded-2xl bg-white dark:bg-slate-950 border border-slate-200/90 dark:border-slate-800 shadow-2xs text-xs"
                >
                  {/* Batch Index Badge */}
                  <span className="font-bold text-[11px] text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/70 border border-indigo-200/80 dark:border-indigo-800/80 px-2.5 py-1 rounded-lg shrink-0">
                    #{bIdx + 1}
                  </span>

                  {/* Our Internal Running Batch No (Auto & Continues from RM Purchase) */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Lock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="font-semibold text-slate-600 dark:text-slate-400 text-xs shrink-0" title="Our Internal Sequential Batch (Auto & Locked)">Our Batch:</span>
                    <span className="font-mono font-bold text-xs text-indigo-700 dark:text-indigo-400 select-all tracking-wide shrink-0 bg-indigo-50/50 dark:bg-indigo-950/40 px-2 py-0.5 rounded-md border border-indigo-100 dark:border-indigo-900">
                      {batch.batchNumber || '—'}
                    </span>
                  </div>

                  {/* Batch Quantity */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="font-semibold text-slate-600 dark:text-slate-400 text-xs shrink-0">Batch Qty:</span>
                    <Input
                      type="number"
                      min="0"
                      step="any"
                      value={batch.quantity}
                      onChange={(e) => handleUpdateAdditionBatch(bIdx, 'quantity', e.target.value)}
                      placeholder="1"
                      className="h-8 w-20 text-xs font-mono font-bold rounded-lg text-center px-1.5 border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                    />
                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 select-none shrink-0 lowercase">
                      {selectedRm?.unit || selectedRm?.unitId || 'units'}
                    </span>
                  </div>

                  {/* Weight */}
                  <div className="flex items-center gap-1.5 min-w-[160px] flex-1 max-w-[210px]">
                    <Scale className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                    <span className="font-semibold text-slate-600 dark:text-slate-400 text-xs shrink-0">Weight:</span>
                    <Input
                      type="text"
                      value={batch.weight || ''}
                      onChange={(e) => handleUpdateAdditionBatch(bIdx, 'weight', e.target.value)}
                      placeholder="e.g. 25 kg / 50"
                      className="h-8 text-xs rounded-lg border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-medium px-2.5 py-0 w-full"
                    />
                  </div>

                  {/* MFG Batch */}
                  <div className="flex items-center gap-1.5 min-w-[150px] flex-1 max-w-[200px]">
                    <Tag className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                    <span className="font-semibold text-slate-600 dark:text-slate-400 text-xs shrink-0">MFG Batch:</span>
                    <Input
                      type="text"
                      value={batch.mfgBatchNo || ''}
                      onChange={(e) => handleUpdateAdditionBatch(bIdx, 'mfgBatchNo', e.target.value)}
                      placeholder="e.g. BATCH-01"
                      className="h-8 text-xs rounded-lg border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono uppercase font-medium px-2 py-0 w-full"
                    />
                  </div>

                  {/* MFG Date */}
                  <div className="flex items-center gap-1.5 min-w-[170px] flex-1 max-w-[220px]">
                    <Calendar className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                    <span className="font-semibold text-slate-600 dark:text-slate-400 text-xs shrink-0">MFG Date:</span>
                    <div className="flex-1 min-w-0">
                      <BatchDateInput
                        value={batch.mfgDate || ''}
                        onChange={(val) => handleUpdateAdditionBatch(bIdx, 'mfgDate', val)}
                        placeholder="dd-mm-yyyy"
                        title="MFG Date"
                        className="h-8"
                      />
                    </div>
                  </div>

                  {/* Exp Date */}
                  <div className="flex items-center gap-1.5 min-w-[170px] flex-1 max-w-[220px]">
                    <Clock className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                    <span className="font-semibold text-slate-600 dark:text-slate-400 text-xs shrink-0">Exp Date:</span>
                    <div className="flex-1 min-w-0">
                      <BatchDateInput
                        value={batch.expDate || ''}
                        onChange={(val) => handleUpdateAdditionBatch(bIdx, 'expDate', val)}
                        placeholder="dd-mm-yyyy"
                        title="Exp Date"
                        className="h-8"
                      />
                    </div>
                  </div>

                  {/* Remove Button if more than 1 batch */}
                  {additionBatches.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveAdditionBatch(bIdx)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/60 rounded-lg transition-colors shrink-0 cursor-pointer ml-auto"
                      title="Remove this batch split"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────
            Section 3B: SUBTRACTION BATCHES SELECTION (Fetch Existing Batches with PO/GRN)
            ───────────────────────────────────────────────────────────── */}
        {form.type === 'SUBTRACTION' && selectedRm && (
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-3">
            {/* Header with Search and Auto FEFO */}
            <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50/70 dark:bg-slate-800/40 p-2.5 rounded-2xl border border-slate-200/80 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <span className="font-bold text-xs uppercase tracking-wide text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                  <Package className="w-4 h-4 text-indigo-500" />
                  EXISTING INVENTORY BATCHES ({existingBatches.length} AVAILABLE)
                </span>

                {/* Subtraction Allocation Status Badge */}
                {numericQuantity > 0 && (
                  isSubtractionExact ? (
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 px-2.5 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> All {numericQuantity} {selectedRm.unit || 'units'} Allocated ({Object.keys(subtractionAllocations).length} Batches)
                    </span>
                  ) : isSubtractionExceeded ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/50 px-2.5 py-0.5 rounded-full border border-rose-200 dark:border-rose-800">
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-600" /> Exceeded: {subtractionTotalAllocated} / {numericQuantity} {selectedRm.unit || 'units'}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50 px-2.5 py-0.5 rounded-full border border-amber-200 dark:border-amber-800">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600" /> Allocated: {subtractionTotalAllocated} / {numericQuantity} {selectedRm.unit || 'units'}
                    </span>
                  )
                )}
              </div>

              {/* Toolbar: Search input + FEFO Auto Allocate Button */}
              <div className="flex items-center gap-2">
                <div className="relative w-44 sm:w-56">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <Input
                    type="text"
                    value={batchSearchTerm}
                    onChange={(e) => setBatchSearchTerm(e.target.value)}
                    placeholder="Search Batch / PO / GRN..."
                    className="h-8 pl-8 pr-2 text-xs rounded-xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
                  />
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAutoAllocateFEFO}
                  className="h-8 px-2.5 text-xs font-bold text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded-xl gap-1 cursor-pointer"
                  title="Automatically allocate oldest / earliest expiry stock first (FEFO)"
                >
                  <Zap className="w-3.5 h-3.5 text-amber-500" />
                  Auto-Allocate FEFO
                </Button>
              </div>
            </div>

            {/* Batches Table / Cards */}
            {isBatchesLoading ? (
              <div className="p-8 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
                Loading inventory batches...
              </div>
            ) : filteredExistingBatches.length === 0 ? (
              <div className="p-6 text-center text-slate-400 text-xs bg-slate-50/50 dark:bg-slate-950/40 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                No active inventory batches found for this raw material. You can still proceed with a general stock deduction.
              </div>
            ) : (
              <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                {filteredExistingBatches.map((b, bIdx) => {
                  const key = b.id || b.batchNumber;
                  const isSelected = subtractionAllocations[key] !== undefined;
                  const deductVal = subtractionAllocations[key] || '';
                  const netQtyNum = Number(b.netQty || 0);

                  return (
                    <div
                      key={key}
                      onClick={() => handleToggleBatchDeduction(b)}
                      className={`p-3 rounded-2xl border transition-all cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs ${
                        isSelected
                          ? 'bg-indigo-50/70 border-indigo-300 dark:bg-indigo-950/40 dark:border-indigo-800 shadow-2xs'
                          : 'bg-white dark:bg-slate-950 border-slate-200/90 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                      }`}
                    >
                      {/* Left: Checkbox + Batch Details */}
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="mt-0.5 shrink-0 text-indigo-600 dark:text-indigo-400">
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-400" />
                          )}
                        </div>

                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-[11px] text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/80 px-2 py-0.5 rounded-md border border-indigo-200/70 dark:border-indigo-800/70">
                              #{bIdx + 1}
                            </span>
                            <span className="font-mono font-black text-slate-900 dark:text-slate-100 text-xs">
                              {b.batchNumber}
                            </span>
                            <span className="font-mono font-bold text-[11px] text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-800">
                              Avail: {netQtyNum} {b.uom}
                            </span>
                          </div>

                          {/* Reference info matching screenshot */}
                          <div className="flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400 flex-wrap">
                            <span>PO: <strong className="text-slate-700 dark:text-slate-200">{b.poReferenceNo || '—'}</strong></span>
                            <span>• GRN: <strong className="text-slate-700 dark:text-slate-200">{b.grnReferenceNo || '—'}</strong></span>
                            <span>• Supplier: <strong className="text-slate-700 dark:text-slate-200">{b.supplierName || '—'}</strong></span>
                            <span>• Loc: <strong className="text-slate-700 dark:text-slate-200">{b.storageLocation || 'Main RM Store'}</strong></span>
                            {b.mfgDate && <span>• MFG: <strong>{b.mfgDate ? String(b.mfgDate).slice(0, 10) : '—'}</strong></span>}
                            {b.expiryDate && <span>• Exp: <strong className="text-rose-600 dark:text-rose-400">{String(b.expiryDate).slice(0, 10)}</strong></span>}
                          </div>
                        </div>
                      </div>

                      {/* Right: Deduction Input if selected */}
                      {isSelected && (
                        <div 
                          className="flex items-center gap-2 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-indigo-100 dark:border-indigo-900"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <span className="font-semibold text-slate-600 dark:text-slate-400 text-xs">Deduct:</span>
                          <Input
                            type="number"
                            min="0.0001"
                            max={netQtyNum}
                            step="any"
                            value={deductVal}
                            onChange={(e) => handleUpdateSubtractionQty(b, e.target.value)}
                            className="h-8 w-24 text-xs font-mono font-bold text-center rounded-lg border-indigo-300 dark:border-indigo-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                          />
                          <span className="text-xs font-semibold text-slate-500 lowercase">{b.uom}</span>

                          <button
                            type="button"
                            onClick={() => handleUpdateSubtractionQty(b, String(netQtyNum))}
                            className="px-2 py-1 text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100/60 dark:hover:bg-indigo-950/60 rounded-md border border-indigo-200 dark:border-indigo-800 transition-colors"
                            title="Deduct full available batch quantity"
                          >
                            Max
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Section 4: Live Stock Impact Projection Card */}
        {selectedRm && numericQuantity > 0 && (
          <div className={`p-4 rounded-2xl border transition-all animate-in fade-in duration-200 ${
            isExceedingStock
              ? 'bg-rose-50/80 border-rose-300 dark:bg-rose-950/40 dark:border-rose-800'
              : 'bg-slate-50/80 border-slate-200/80 dark:bg-slate-950/50 dark:border-slate-800'
          }`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Real-time Stock Impact Projection
                </span>
                <div className="flex items-center gap-2 sm:gap-3 text-xs flex-wrap font-mono">
                  <span className="text-slate-600 dark:text-slate-400">
                    Current: <strong>{currentAvailableStock.toFixed(2)} {selectedRm.unit}</strong>
                  </span>
                  <span className="text-slate-300 dark:text-slate-700">&rarr;</span>
                  <span className={form.type === 'ADDITION' ? 'text-emerald-600 font-bold' : 'text-rose-600 font-bold'}>
                    {form.type === 'ADDITION' ? `+${numericQuantity.toFixed(2)}` : `-${numericQuantity.toFixed(2)}`} {selectedRm.unit}
                  </span>
                  <span className="text-slate-300 dark:text-slate-700">&rarr;</span>
                  <span className="text-slate-900 dark:text-white font-black text-sm">
                    New: {projectedNewStock.toFixed(2)} {selectedRm.unit}
                  </span>
                </div>
              </div>

              {isExceedingStock ? (
                <div className="flex items-center gap-2 text-xs font-bold text-rose-700 dark:text-rose-400 bg-rose-100/80 dark:bg-rose-950/80 px-3 py-1.5 rounded-xl border border-rose-300 dark:border-rose-800 shrink-0">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>Cannot subtract more than available stock!</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-100/60 dark:bg-emerald-950/60 px-2.5 py-1 rounded-xl shrink-0">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Valid balance projection</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Section 5: Adjustment Reason Dropdown */}
        <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          <Label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-indigo-500" />
              4. Adjustment Reason <span className="text-rose-500">*</span>
            </span>
            <span className="text-[11px] text-slate-400 font-normal">
              Required for compliance & audit logs
            </span>
          </Label>

          <select
            value={form.reason}
            onChange={(e) => setForm(prev => ({ ...prev, reason: e.target.value }))}
            className="w-full h-11 px-3 py-2 text-xs border rounded-2xl bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-medium focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 cursor-pointer shadow-2xs"
          >
            <option value="">-- Select an Adjustment Reason --</option>
            {filteredReasonGroups.map(group => (
              <optgroup key={group.group} label={group.group} className="font-bold text-indigo-700 dark:text-indigo-400">
                {group.options.map(opt => (
                  <option key={opt.value} value={opt.value} className="text-slate-900 dark:text-slate-100 font-normal">
                    {opt.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>

        {/* Section 6: Additional Remarks / Notes */}
        <div className="space-y-2">
          <Label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
            <span>5. Remarks / Detailed Audit Notes</span>
            <span className="text-[11px] text-slate-400 font-normal">(Optional)</span>
          </Label>

          <textarea
            value={form.remarks}
            onChange={(e) => setForm(prev => ({ ...prev, remarks: e.target.value }))}
            rows={2}
            placeholder="Add any specific context, physical count discrepancy details, or reference numbers..."
            className="w-full border border-slate-200 dark:border-slate-800 rounded-2xl p-3 text-xs bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 resize-none font-medium"
          />
        </div>

        {/* Error Notification */}
        {error && (
          <div className="p-3 bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 rounded-2xl text-xs font-semibold border border-rose-200 dark:border-rose-800 flex items-center gap-2 animate-in fade-in duration-200">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500" />
            <span>{error}</span>
          </div>
        )}

        {/* Bottom Actions */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
          <Button
            type="button"
            variant="outline"
            onClick={onBack ? onBack : () => navigate('/rm/stock-adjustment/list')}
            className="h-10 px-4 text-xs font-semibold text-slate-600 dark:text-slate-300 rounded-xl"
          >
            Cancel
          </Button>

          <Button
            type="submit"
            disabled={mutation.isPending || isExceedingStock}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-10 px-6 rounded-xl text-xs shadow-sm shadow-indigo-600/20 gap-2 cursor-pointer transition-all"
          >
            {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {mutation.isPending ? 'Saving Adjustment...' : (isEdit ? 'Update Adjustment' : 'Submit Adjustment')}
          </Button>
        </div>
      </form>
    </div>
  );
}
