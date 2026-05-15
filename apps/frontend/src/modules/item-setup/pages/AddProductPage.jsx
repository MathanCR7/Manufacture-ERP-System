import React, { useEffect, useState, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '@/lib/axios';
import {
  ArrowLeft, Save, Loader2, AlertCircle, Package, DollarSign,
  BarChart2, ChevronDown, Search, X, Tag, Hash, Calendar,
  ToggleLeft, AlignLeft, Info
} from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

// ─── Constants ────────────────────────────────────────────────────────────────
const UOM_OPTIONS = [
  'gm','kg','mg','lb','ton','liter','ml','dl','gallon',
  'pcs','box','carton','pack','bag','sack','bottle','can','drum',
  'roll','sheet','unit','dozen','set','kit','bundle'
];

// ─── Shared input styles ───────────────────────────────────────────────────────
const base = 'w-full px-3 py-2.5 border rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-shadow';
const err  = 'w-full px-3 py-2.5 border border-red-400 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 focus:border-transparent transition-shadow';

function FieldLabel({ children, required, hint }) {
  return (
    <label className="flex items-center gap-1 text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
      {children}
      {required && <span className="text-red-500">*</span>}
      {hint && (
        <span title={hint}>
          <Info className="w-3.5 h-3.5 text-slate-400 cursor-help" />
        </span>
      )}
    </label>
  );
}
function FieldError({ message }) {
  return (
    <p className="mt-1 flex items-center gap-1 text-xs text-red-500">
      <AlertCircle className="w-3 h-3 shrink-0" />{message}
    </p>
  );
}

// ─── Searchable UOM Select ─────────────────────────────────────────────────────
function UomSelect({ value, onChange, error: hasError }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef(null);
  const inputRef = useRef(null);
  const filtered = UOM_OPTIONS.filter(u => u.toLowerCase().includes(search.toLowerCase()));

  useEffect(() => {
    const handler = e => { if (ref.current && !ref.current.contains(e.target)) { setOpen(false); setSearch(''); }};
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => { if (open && inputRef.current) inputRef.current.focus(); }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(p => !p)}
        className={`${hasError ? err : base} flex items-center justify-between`}
      >
        <span className={value ? 'text-slate-900 dark:text-white' : 'text-slate-400'}>
          {value || 'Select UOM…'}
        </span>
        <div className="flex items-center gap-1">
          {value && (
            <span onMouseDown={e => { e.stopPropagation(); onChange(''); }}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer p-0.5 rounded">
              <X className="w-3 h-3" />
            </span>
          )}
          <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
        </div>
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg">
          <div className="p-2 border-b dark:border-slate-700">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input ref={inputRef} type="text" value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search UOM…"
                className="w-full pl-7 pr-6 py-1.5 text-sm border rounded border-slate-200 dark:border-slate-600 dark:bg-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500" />
              {search && (
                <button type="button" onMouseDown={() => setSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
          <ul className="max-h-48 overflow-y-auto py-1">
            {filtered.length === 0
              ? <li className="px-3 py-2 text-sm text-slate-400 text-center">No results</li>
              : filtered.map(u => (
                <li key={u} onMouseDown={() => { onChange(u); setOpen(false); setSearch(''); }}
                  className={`px-3 py-2 text-sm cursor-pointer select-none ${value === u
                    ? 'bg-indigo-50 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 font-medium'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                  {u}
                </li>
              ))
            }
          </ul>
        </div>
      )}
    </div>
  );
}

// ─── Section Card ─────────────────────────────────────────────────────────────
function SectionCard({ icon: Icon, iconColor, title, subtitle, children }) {
  return (
    <Card className="dark:bg-[#111827] dark:border-slate-800 shadow-sm">
      <CardHeader className="px-6 pt-5 pb-0">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
          <Icon className={`w-4 h-4 ${iconColor}`} />
          {title}
        </div>
        {subtitle && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{subtitle}</p>}
      </CardHeader>
      <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {children}
      </CardContent>
    </Card>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────
export default function AddProductPage() {
  const { id } = useParams();
  const isEditMode = !!id;
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm({
    defaultValues: {
      code: '', name: '', printName: '', categoryId: '', unitId: 'kg',
      ratePerUnit: 0, openingStock: 0, alertLevel: 0, expiryDays: '',
      hsnCode: '', description: '', status: 'ACTIVE'
    }
  });

  const selectedUom = watch('unitId');
  const watchRatePerUnit = watch('ratePerUnit');
  const watchExpiryDays = watch('expiryDays');

  // ── Fetch categories ───────────────────────────────────────────────────────
  const { data: categories } = useQuery({
    queryKey: ['product-categories'],
    queryFn: async () => (await api.get('/item-setup/product-category')).data
  });

  // ── Auto-generate code in add mode ────────────────────────────────────────
  const { data: allProducts, isLoading: isLoadingAll } = useQuery({
    queryKey: ['products'],
    queryFn: async () => (await api.get('/item-setup/product')).data,
    enabled: !isEditMode
  });

  useEffect(() => {
    if (!isEditMode && allProducts) {
      let maxNum = 0;
      allProducts.forEach(p => {
        const m = p.code && p.code.match(/^PRD-(\d+)$/);
        if (m) { const n = parseInt(m[1], 10); if (n > maxNum) maxNum = n; }
      });
      setValue('code', `PRD-${String(maxNum + 1).padStart(5, '0')}`);
    }
  }, [allProducts, isEditMode, setValue]);

  // ── Fetch existing in edit mode ───────────────────────────────────────────
  const { data: existingData, isLoading: isFetching } = useQuery({
    queryKey: ['product', id],
    queryFn: async () => (await api.get(`/item-setup/product/${id}`)).data,
    enabled: isEditMode
  });

  useEffect(() => { if (existingData) reset(existingData); }, [existingData, reset]);

  // ── Mutation ──────────────────────────────────────────────────────────────
  const mutation = useMutation({
    mutationFn: async (data) => {
      const payload = {
        ...data,
        ratePerUnit: parseFloat(data.ratePerUnit) || 0,
        openingStock: parseFloat(data.openingStock) || 0,
        alertLevel: parseFloat(data.alertLevel) || 0,
        expiryDays: data.expiryDays ? parseInt(data.expiryDays, 10) : null,
      };
      if (isEditMode) return (await api.put(`/item-setup/product/${id}`, payload)).data;
      return (await api.post('/item-setup/product', payload)).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      navigate('/setup/product');
    }
  });

  // ── Loading state ─────────────────────────────────────────────────────────
  if ((isEditMode && isFetching) || (!isEditMode && isLoadingAll)) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-48 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
        <Skeleton className="h-10 w-40" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl">
      {/* ── Header ───────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => navigate('/setup/product')}
          className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
          <ArrowLeft className="w-4 h-4 text-slate-500" />
        </button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            {isEditMode ? 'Edit Product' : 'Add Product'}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {isEditMode ? 'Update the details for this finished product.' : 'Register a new finished ice cream product in the system.'}
          </p>
        </div>
      </div>

      {/* ── Error Banner ─────────────────────────────────────────────── */}
      {mutation.isError && (
        <div className="flex items-start gap-3 p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400">
          <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
          <div>
            <p className="font-medium text-sm">Failed to save product</p>
            <p className="text-xs mt-0.5 opacity-80">
              {mutation.error?.response?.data?.message || mutation.error?.message || 'An unexpected error occurred.'}
            </p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit(data => mutation.mutate(data))} className="space-y-6">

        {/* ── SECTION 1 — Identity ──────────────────────────────────── */}
        <SectionCard icon={Package} iconColor="text-indigo-500" title="Product Identity"
          subtitle="Basic identification details that appear on labels, invoices, and reports.">

          {/* Code — auto-generated, readonly */}
          <div>
            <FieldLabel hint="Auto-generated sequential ID. Cannot be edited.">Product Code</FieldLabel>
            <div className="relative">
              <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <input
                {...register('code')}
                readOnly
                className="w-full pl-9 pr-3 py-2.5 border rounded-lg bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 font-mono text-sm cursor-not-allowed"
              />
            </div>
          </div>

          {/* Name */}
          <div>
            <FieldLabel required>Product Name</FieldLabel>
            <input
              {...register('name', { required: 'Product name is required' })}
              placeholder="e.g. Mango Ice Cream 500ml"
              className={errors.name ? err : base}
            />
            {errors.name && <FieldError message={errors.name.message} />}
          </div>

          {/* Print Name */}
          <div>
            <FieldLabel hint="Name printed on labels and customer-facing invoices.">Print Name</FieldLabel>
            <input
              {...register('printName')}
              placeholder="Displayed on invoices & labels"
              className={base}
            />
          </div>

          {/* Category */}
          <div>
            <FieldLabel required>Category</FieldLabel>
            <div className="relative">
              <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <select
                {...register('categoryId', { required: 'Category is required' })}
                className={`${errors.categoryId ? err : base} pl-9`}
              >
                <option value="">Select category…</option>
                {(categories || [])
                  .filter(c => (c.status || 'ACTIVE') === 'ACTIVE')
                  .map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            {errors.categoryId && <FieldError message={errors.categoryId.message} />}
          </div>

          {/* UOM */}
          <div>
            <FieldLabel required>Unit of Measure (UOM)</FieldLabel>
            <input type="hidden" {...register('unitId', { required: 'UOM is required' })} />
            <UomSelect
              value={selectedUom}
              onChange={val => setValue('unitId', val, { shouldValidate: true })}
              error={!!errors.unitId}
            />
            {errors.unitId && <FieldError message={errors.unitId.message} />}
          </div>

          {/* Status */}
          <div>
            <FieldLabel>Status</FieldLabel>
            <div className="relative">
              <ToggleLeft className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <select {...register('status')} className={`${base} pl-9`}>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </select>
            </div>
          </div>

          {/* HSN Code */}
          <div>
            <FieldLabel hint="HSN code used for GST classification.">HSN Code</FieldLabel>
            <input
              {...register('hsnCode')}
              placeholder="e.g. 21050000"
              className={base}
            />
          </div>

          {/* Expiry Days */}
          <div>
            <FieldLabel hint="Shelf life in days for the finished product. Used to auto-calculate expiry date during production.">
              Expiry Days
            </FieldLabel>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <input
                type="number"
                min="0"
                {...register('expiryDays')}
                placeholder="e.g. 180"
                className={`${base} pl-9`}
              />
            </div>
            {watchExpiryDays > 0 && (
              <p className="mt-1 text-xs text-indigo-500">
                Products will expire ~{Math.round(watchExpiryDays / 30)} month(s) after production date.
              </p>
            )}
          </div>

          {/* Description — full width */}
          <div className="md:col-span-2 lg:col-span-3">
            <FieldLabel>Description</FieldLabel>
            <div className="relative">
              <AlignLeft className="absolute left-3 top-3 w-4 h-4 text-slate-400 pointer-events-none" />
              <textarea
                {...register('description')}
                rows={2}
                placeholder="Optional: ingredients, flavour notes, storage instructions…"
                className={`${base} pl-9 resize-none`}
              />
            </div>
          </div>
        </SectionCard>

        {/* ── SECTION 2 — Pricing & Stock ───────────────────────────── */}
        <SectionCard icon={DollarSign} iconColor="text-emerald-500" title="Pricing & Stock"
          subtitle="Selling price, opening stock, and minimum stock alert level.">

          {/* Rate Per Unit */}
          <div>
            <FieldLabel>Selling Price (INR)</FieldLabel>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-medium pointer-events-none">₹</span>
              <input
                type="number"
                step="0.01"
                min="0"
                {...register('ratePerUnit')}
                className={`${base} pl-7`}
              />
            </div>
            {parseFloat(watchRatePerUnit) > 0 && (
              <p className="mt-1 text-xs text-emerald-600 dark:text-emerald-400">
                ₹{parseFloat(watchRatePerUnit).toFixed(2)} per {selectedUom || 'unit'}
              </p>
            )}
          </div>

          {/* Opening Stock */}
          <div>
            <FieldLabel hint="Initial quantity on hand when first setting up this product.">Opening Stock</FieldLabel>
            <div className="relative">
              <BarChart2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <input
                type="number"
                step="0.01"
                min="0"
                {...register('openingStock')}
                className={`${base} pl-9`}
              />
            </div>
          </div>

          {/* Alert Level */}
          <div>
            <FieldLabel hint="System alerts when stock falls below this level.">Min Stock Alert Level</FieldLabel>
            <div className="relative">
              <AlertCircle className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-amber-400 pointer-events-none" />
              <input
                type="number"
                step="0.01"
                min="0"
                {...register('alertLevel')}
                className={`${base} pl-9`}
              />
            </div>
          </div>
        </SectionCard>

        {/* ── Actions ───────────────────────────────────────────────── */}
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={mutation.isPending}
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-lg font-medium text-sm shadow-sm transition-colors"
          >
            {mutation.isPending
              ? <><Loader2 className="w-4 h-4 animate-spin" />Saving…</>
              : <><Save className="w-4 h-4" />{isEditMode ? 'Update Product' : 'Save Product'}</>}
          </button>
          <button
            type="button"
            onClick={() => navigate('/setup/product')}
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg font-medium text-sm transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
        </div>
      </form>
    </div>
  );
}
