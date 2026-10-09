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
import StockProductSearchSelect from './StockProductSearchSelect';
import { PRODUCT_STOCK_ADJUSTMENT_REASONS, ALL_PRODUCT_REASON_OPTIONS } from '../constants/productAdjustmentReasons';

export default function ProductStockAdjustmentForm({ editData = null, onBack }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isEdit = !!editData;

  // Extract initial reason and remarks from existing notes if editing
  const initialReason = useMemo(() => {
    if (!editData?.notes) return '';
    const match = ALL_PRODUCT_REASON_OPTIONS.find(opt => editData.notes.startsWith(opt.value));
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
    productId: editData?.productId || editData?.product?.id || '',
    type: editData?.type || 'SUBTRACTION',
    quantity: editData?.quantity ? String(editData.quantity) : '',
    reason: initialReason || '',
    remarks: initialRemarks || '',
  });

  const [error, setError] = useState(null);

  // Fetch available finished products stock (matching Sales Order SAP catalog query with 207 items & full metadata)
  const { data: products = [], isLoading: isProdLoading } = useQuery({
    queryKey: ['products-catalog-sap'],
    queryFn: async () => {
      const res = await api.get('/products/search?limit=1000');
      return Array.isArray(res.data) ? res.data : (res.data?.data || []);
    },
    staleTime: 30000,
    refetchOnWindowFocus: true
  });

  // Currently selected finished product object
  const selectedProduct = useMemo(() => {
    if (!form.productId || !products.length) return null;
    return products.find(p => p.id === form.productId || p.code === form.productId || p.systemCode === form.productId) || null;
  }, [form.productId, products]);

  // Filter adjustment reasons based on current adjustment type (ADDITION vs SUBTRACTION)
  const filteredReasonGroups = useMemo(() => {
    return PRODUCT_STOCK_ADJUSTMENT_REASONS.map(group => {
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
    if (!selectedProduct) return 0;
    let base = Number(selectedProduct.currentStock ?? selectedProduct.stock ?? selectedProduct.availableQuantity ?? 0);
    if (isEdit && (editData.productId === selectedProduct.id || editData.product?.id === selectedProduct.id)) {
      // Revert previous adjustment effect to show accurate base
      if (editData.type === 'SUBTRACTION') {
        base += Number(editData.quantity || 0);
      } else {
        base -= Number(editData.quantity || 0);
      }
    }
    return Math.max(0, base);
  }, [selectedProduct, isEdit, editData]);

  const numericQuantity = parseFloat(form.quantity) || 0;

  const projectedNewStock = useMemo(() => {
    if (!selectedProduct || numericQuantity <= 0) return currentAvailableStock;
    if (form.type === 'ADDITION') {
      return currentAvailableStock + numericQuantity;
    } else {
      return currentAvailableStock - numericQuantity;
    }
  }, [selectedProduct, currentAvailableStock, numericQuantity, form.type]);

  const isExceedingStock = form.type === 'SUBTRACTION' && numericQuantity > currentAvailableStock;

  const mutation = useMutation({
    mutationFn: (payload) => 
      isEdit 
        ? api.put(`/products/stock-adjustment/${editData.id}`, payload).then(r => r.data)
        : api.post('/products/stock-adjustment', payload).then(r => r.data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['product-stock-adjustment'] });
      queryClient.invalidateQueries({ queryKey: ['products-stock'] });
      queryClient.invalidateQueries({ queryKey: ['products-catalog-sap'] });

      Swal.fire({
        icon: 'success',
        title: isEdit ? 'Adjustment Updated!' : 'Product Stock Adjusted!',
        html: `<b>${selectedProduct?.name || 'Product'}</b> stock has been ${form.type === 'ADDITION' ? 'increased (+)' : 'reduced (-)'} by <b>${numericQuantity} ${selectedProduct?.unit || 'pcs'}</b>.<br/><span class="text-xs text-slate-500">Updated Stock: <b>${projectedNewStock.toFixed(2)} ${selectedProduct?.unit || 'pcs'}</b></span>`,
        timer: 3500,
        showConfirmButton: false,
        toast: true,
        position: 'top-end'
      });

      if (onBack) {
        onBack();
      } else {
        navigate('/products/stock-adjustment/list');
      }
    },
    onError: (err) => {
      setError(err?.response?.data?.error || err.message || 'Failed to submit product stock adjustment');
    }
  });

  const handleSubmit = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    setError(null);

    if (!form.productId) {
      setError('Please select a Finished Product from the catalog');
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
      setError(`Cannot subtract ${numericQuantity} ${selectedProduct?.unit || 'pcs'}. Current available stock is only ${currentAvailableStock.toFixed(2)} ${selectedProduct?.unit || 'pcs'}.`);
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

    const payload = {
      productId: form.productId,
      type: form.type,
      quantity: numericQuantity,
      notes: finalNotes || undefined
    };

    mutation.mutate(payload);
  };

  return (
    <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6 animate-in fade-in duration-200">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onBack ? onBack : () => navigate('/products/stock-adjustment/list')}
            className="w-9 h-9 p-0 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <ArrowLeft className="w-4 h-4 text-slate-600 dark:text-slate-400" />
          </Button>
          <div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white">
              {isEdit ? 'Edit Stock Adjustment' : 'Create Stock Adjustment'}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
              Add or subtract physical finished product stock with category verification & audit reason tracking
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            type="button"
            variant="outline"
            onClick={onBack ? onBack : () => navigate('/products/stock-adjustment/list')}
            className="rounded-xl h-9 text-xs font-bold px-4 border-slate-300 dark:border-slate-700 cursor-pointer"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={mutation.isPending}
            className="rounded-xl h-9 text-xs font-bold px-5 bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm flex items-center gap-1.5 cursor-pointer"
          >
            {mutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            <span>Confirm Adjustment</span>
          </Button>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="p-4 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 flex items-start gap-3 text-red-600 dark:text-red-400 text-xs font-semibold animate-in shake duration-200">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="font-bold">Error adjusting stock:</span> {error}
          </div>
        </div>
      )}

      {/* Main Form Card */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5 sm:p-7 space-y-6 shadow-xs">
        {/* Section 1: Product Selector */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
              <Package className="w-4 h-4 text-indigo-600" />
              1. SELECT FINISHED PRODUCT <span className="text-red-500">*</span>
            </Label>
            {selectedProduct && (
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                Code: <strong className="font-mono text-amber-600 dark:text-amber-400">{selectedProduct.systemCode || selectedProduct.code}</strong>
                {(selectedProduct.baseCategory || selectedProduct.category) && (
                  <span className="ml-2 font-normal text-slate-600 dark:text-slate-300">
                    ({selectedProduct.baseCategory || selectedProduct.category}{selectedProduct.subcategory && selectedProduct.subcategory !== '-' ? ` • ${selectedProduct.subcategory}` : ''})
                  </span>
                )}
              </span>
            )}
          </div>
          <StockProductSearchSelect
            products={products}
            selectedProductId={form.productId}
            onSelect={(prod) => {
              setForm(prev => ({ ...prev, productId: prod.id }));
              setError(null);
            }}
            onClear={() => setForm(prev => ({ ...prev, productId: '' }))}
            error={!form.productId && error ? 'Product is required' : null}
          />
        </div>

        {/* Section 2 & 3: Adjustment Type & Quantity Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-1">
          {/* Section 2: Adjustment Type */}
          <div className="space-y-2">
            <Label className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-indigo-600" />
              2. ADJUSTMENT TYPE <span className="text-red-500">*</span>
            </Label>
            <div className="grid grid-cols-2 gap-2.5">
              {/* Addition (+) Button */}
              <button
                type="button"
                onClick={() => setForm(prev => ({ ...prev, type: 'ADDITION', reason: '' }))}
                className={`py-2.5 px-3 rounded-2xl border text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  form.type === 'ADDITION'
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm ring-2 ring-emerald-500/20'
                    : 'bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-emerald-400'
                }`}
              >
                <Plus className="w-4 h-4" />
                <span>Addition (+)</span>
              </button>

              {/* Subtraction (-) Button */}
              <button
                type="button"
                onClick={() => setForm(prev => ({ ...prev, type: 'SUBTRACTION', reason: '' }))}
                className={`py-2.5 px-3 rounded-2xl border text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  form.type === 'SUBTRACTION'
                    ? 'bg-rose-600 text-white border-rose-600 shadow-sm ring-2 ring-rose-500/20'
                    : 'bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-rose-400'
                }`}
              >
                <Minus className="w-4 h-4" />
                <span>Subtraction (-)</span>
              </button>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {form.type === 'ADDITION'
                ? 'Adds stock into inventory (e.g. found stock, production surplus, packaging count correction)'
                : 'Deducts stock from inventory (e.g. damage, expiry, spillage, physical shortage)'}
            </p>
          </div>

          {/* Section 3: Quantity with live UOM */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                <Scale className="w-4 h-4 text-indigo-600" />
                3. QUANTITY <span className="text-red-500">*</span>
              </Label>
              {selectedProduct && (
                <span className="text-[11px] text-slate-500">
                  Unit: <b className="text-slate-800 dark:text-slate-200">{selectedProduct.unit || 'pcs'}</b>
                </span>
              )}
            </div>
            <div className="relative">
              <Input
                type="number"
                min="0.001"
                step="any"
                value={form.quantity}
                onChange={(e) => {
                  setForm(prev => ({ ...prev, quantity: e.target.value }));
                  setError(null);
                }}
                placeholder="Enter adjustment quantity (e.g. 5.5)"
                className="h-10 text-xs rounded-xl pr-16 bg-white dark:bg-slate-950 font-bold border-slate-300 dark:border-slate-700 focus:border-indigo-500"
                required
              />
              <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold uppercase text-slate-400 pointer-events-none">
                {selectedProduct?.unit || 'units'}
              </span>
            </div>

            {/* Projected Stock Preview Ribbon */}
            {selectedProduct && (
              <div className={`p-2.5 rounded-xl border flex items-center justify-between text-xs font-medium transition-colors ${
                isExceedingStock
                  ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 text-rose-700 dark:text-rose-300'
                  : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300'
              }`}>
                <div className="flex items-center gap-2">
                  <span>Current: <b>{currentAvailableStock.toFixed(2)} {selectedProduct.unit || 'pcs'}</b></span>
                  <span>&rarr;</span>
                  <span>
                    New Projected: <b className={`font-mono font-bold ${
                      form.type === 'ADDITION' ? 'text-emerald-600' : isExceedingStock ? 'text-rose-600' : 'text-slate-900 dark:text-white'
                    }`}>
                      {projectedNewStock.toFixed(2)} {selectedProduct.unit || 'pcs'}
                    </b>
                  </span>
                </div>
                {isExceedingStock && (
                  <span className="text-[10px] font-bold text-rose-600 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" /> Insufficient Stock!
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Section 4: Adjustment Reason */}
        <div className="space-y-2 pt-1">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-indigo-600" />
              4. ADJUSTMENT REASON <span className="text-red-500">*</span>
            </Label>
            <span className="text-[10px] font-bold tracking-wider uppercase text-slate-400">
              REQUIRED FOR COMPLIANCE & AUDIT LOGS
            </span>
          </div>

          <select
            value={form.reason}
            onChange={(e) => setForm(prev => ({ ...prev, reason: e.target.value }))}
            className="w-full h-10 px-3 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-semibold cursor-pointer"
            required
          >
            <option value="">-- Select an Adjustment Reason --</option>
            {filteredReasonGroups.map(group => (
              <optgroup key={group.group} label={group.group}>
                {group.options.map(opt => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>

        {/* Section 5: Remarks / Detailed Audit Notes */}
        <div className="space-y-2 pt-1">
          <Label className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
            <HelpCircle className="w-4 h-4 text-slate-400" />
            5. REMARKS / DETAILED AUDIT NOTES <span className="text-slate-400 font-normal">(OPTIONAL)</span>
          </Label>
          <textarea
            rows={3}
            value={form.remarks}
            onChange={(e) => setForm(prev => ({ ...prev, remarks: e.target.value }))}
            placeholder="Add any specific context, physical count discrepancy details, or reference numbers..."
            className="w-full p-3 text-xs rounded-2xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium placeholder:text-slate-400 resize-none"
          />
        </div>

        {/* Bottom Form Actions */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
          <Button
            type="button"
            variant="outline"
            onClick={onBack ? onBack : () => navigate('/products/stock-adjustment/list')}
            className="rounded-xl h-10 text-xs font-bold px-5 border-slate-300 dark:border-slate-700 cursor-pointer"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={mutation.isPending}
            className="rounded-xl h-10 text-xs font-bold px-6 bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm flex items-center gap-2 cursor-pointer"
          >
            {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>Submit Adjustment</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
