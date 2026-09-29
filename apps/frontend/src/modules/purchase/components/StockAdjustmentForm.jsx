import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/axios';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Save, Loader2, AlertTriangle, Plus, Minus, 
  Package, Tag, Scale, TrendingUp, TrendingDown, CheckCircle2,
  FileText, HelpCircle, Info
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Swal from 'sweetalert2';
import StockRMSearchSelect from './StockRMSearchSelect';
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
    type: editData?.type || 'SUBTRACTION',
    quantity: editData?.quantity ? String(editData.quantity) : '',
    reason: initialReason || '',
    remarks: initialRemarks || '',
  });

  const [error, setError] = useState(null);

  // Fetch available raw materials stock
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

  // Projected stock calculation
  const currentAvailableStock = useMemo(() => {
    if (!selectedRm) return 0;
    let base = Number(selectedRm.availableQuantity ?? selectedRm.currentStock ?? 0);
    if (isEdit && (editData.rawMaterial?.id === selectedRm.id || editData.rawMaterialId === selectedRm.id)) {
      // Revert previous adjustment effect to show accurate base
      if (editData.type === 'SUBTRACTION') {
        base += Number(editData.quantity || 0);
      } else {
        base -= Number(editData.quantity || 0);
      }
    }
    return Math.max(0, base);
  }, [selectedRm, isEdit, editData]);

  const numericQuantity = parseFloat(form.quantity) || 0;

  const projectedNewStock = useMemo(() => {
    if (!selectedRm || numericQuantity <= 0) return currentAvailableStock;
    if (form.type === 'ADDITION') {
      return currentAvailableStock + numericQuantity;
    } else {
      return currentAvailableStock - numericQuantity;
    }
  }, [selectedRm, currentAvailableStock, numericQuantity, form.type]);

  const isExceedingStock = form.type === 'SUBTRACTION' && numericQuantity > currentAvailableStock;

  const mutation = useMutation({
    mutationFn: (payload) => 
      isEdit 
        ? api.put(`/rm-stock-adjustment/${editData.id}`, payload).then(r => r.data)
        : api.post('/rm-stock-adjustment', payload).then(r => r.data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['rm-stock-adjustment'] });
      queryClient.invalidateQueries({ queryKey: ['rm-stock'] });

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
      notes: finalNotes || null
    });
  };

  const handleSelectRawMaterial = (rm) => {
    setForm(prev => ({
      ...prev,
      rawMaterialId: rm.id
    }));
    setError(null);
  };

  const handleClearRawMaterial = () => {
    setForm(prev => ({
      ...prev,
      rawMaterialId: ''
    }));
  };

  return (
    <div className="w-full max-w-4xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-4">
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
              Add or subtract physical raw material stock with category verification & audit reason tracking
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
                ? 'Adds stock to inventory (e.g. found surplus, production return, bonus sample)' 
                : 'Deducts stock from inventory (e.g. damage, expiry, spillage, physical shortage)'}
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

        {/* Section 3: Live Stock Calculation Card */}
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

        {/* Section 4: Adjustment Reason Dropdown */}
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

        {/* Section 5: Additional Remarks / Notes */}
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
