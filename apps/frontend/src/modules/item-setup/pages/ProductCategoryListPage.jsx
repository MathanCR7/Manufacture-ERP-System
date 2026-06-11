import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import Swal from 'sweetalert2';
import { Edit, Trash2, Plus, Search, Tag, CheckCircle2, XCircle, RefreshCw, AlignLeft, ToggleLeft, ArrowLeft, Save, Loader2, AlertCircle, Check } from 'lucide-react';
import { api } from '@/lib/axios';

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';

// ─── Status Badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const isActive = status !== 'INACTIVE';
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
        isActive
          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400'
          : 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400'
      }`}
    >
      {isActive ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
      {isActive ? 'Active' : 'Inactive'}
    </span>
  );
}

// ─── Input helpers for form ───────────────────────────────────────────────────
const inputCls =
  'w-full px-3 py-2.5 border rounded-lg bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-shadow text-sm';

const errorInputCls =
  'w-full px-3 py-2.5 border rounded-lg bg-white dark:bg-slate-900 border-red-400 dark:border-red-500 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-shadow text-sm';

function FieldLabel({ children, required }) {
  return (
    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
      {children}
      {required && <span className="text-red-500 ml-0.5">*</span>}
    </label>
  );
}

// Custom Checkbox Component for beautiful table checkboxes
function TableCheckbox({ checked, onChange, indeterminate }) {
  return (
    <label className="inline-flex items-center justify-center cursor-pointer group select-none">
      <input
        type="checkbox"
        className="sr-only"
        checked={checked}
        onChange={onChange}
      />
      <div
        className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all duration-150 group-hover:scale-105 shadow-sm relative ${
          checked
            ? 'bg-indigo-600 border-indigo-600'
            : indeterminate
            ? 'bg-indigo-500 border-indigo-500'
            : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 group-hover:border-indigo-500'
        }`}
      >
        {checked ? (
          <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />
        ) : indeterminate ? (
          <div className="w-2.5 h-0.5 bg-white rounded-full"></div>
        ) : null}
      </div>
    </label>
  );
}

function FieldError({ message }) {
  return (
    <p className="mt-1 flex items-center gap-1 text-xs text-red-500">
      <AlertCircle className="w-3 h-3" />
      {message}
    </p>
  );
}

function ProductCategoryForm({ editId, onBack }) {
  const isEditMode = !!editId;
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm({
    defaultValues: { name: '', description: '', status: 'ACTIVE' },
  });

  const nameValue = watch('name') || '';
  const [debouncedName, setDebouncedName] = useState('');
  const [nameMatches, setNameMatches] = useState([]);

  // Debounce category name input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedName(nameValue);
    }, 300);
    return () => clearTimeout(handler);
  }, [nameValue]);

  // Query similar categories
  useEffect(() => {
    if (debouncedName.trim().length >= 1) {
      api.get('/item-setup/product-category')
        .then(res => {
          const list = res.data || [];
          const matches = list.filter(cat =>
            cat.name.toLowerCase().includes(debouncedName.toLowerCase()) &&
            cat.id !== editId
          );
          setNameMatches(matches);
        })
        .catch(err => console.error(err));
    } else {
      setNameMatches([]);
    }
  }, [debouncedName, editId]);

  // ── Fetch existing record in edit mode ──────────────────────────────────────
  const { data: existingData, isLoading: isFetching } = useQuery({
    queryKey: ['product-category', editId],
    queryFn: async () => {
      const res = await api.get(`/item-setup/product-category/${editId}`);
      return res.data;
    },
    enabled: isEditMode,
  });

  useEffect(() => {
    if (existingData) reset(existingData);
  }, [existingData, reset]);

  // ── Mutation ────────────────────────────────────────────────────────────────
  const handleFormSubmit = async (data) => {
    const isDark = document.documentElement.classList.contains('dark');

    // Warn if duplicate exists
    const duplicate = nameMatches.find(cat => cat.name.toLowerCase() === data.name.toLowerCase());
    if (duplicate) {
      const result = await Swal.fire({
        title: '<span class="font-extrabold text-sm text-slate-800 dark:text-slate-100">Duplicate Category Name</span>',
        html: `<p class="text-xs text-slate-500 dark:text-slate-400 mt-1">A Product Category named <strong>"${data.name}"</strong> already exists. Do you want to proceed and save it anyway?</p>`,
        icon: 'warning',
        iconColor: '#f59e0b',
        showCancelButton: true,
        confirmButtonColor: '#3085d6',
        cancelButtonColor: '#d33',
        confirmButtonText: 'Yes, save anyway',
        cancelButtonText: 'Cancel',
        background: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)',
        color: isDark ? '#f8fafc' : '#0f172a',
        customClass: {
          popup: 'rounded-2xl border border-amber-100 dark:border-amber-950 shadow-xl backdrop-blur-md p-6'
        }
      });
      if (!result.isConfirmed) {
        return;
      }
    }
    mutation.mutate(data);
  };

  const mutation = useMutation({
    mutationFn: async (data) => {
      if (isEditMode) {
        return (await api.put(`/item-setup/product-category/${editId}`, data)).data;
      }
      return (await api.post('/item-setup/product-category', data)).data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['product-categories'] });
      const isDark = document.documentElement.classList.contains('dark');
      Swal.fire({
        title: `<span class="font-extrabold text-sm text-slate-800 dark:text-slate-100">${isEditMode ? 'Category Updated!' : 'Category Created!'}</span>`,
        html: `<p class="text-xs text-slate-500 dark:text-slate-400 mt-1">${isEditMode ? `Product Category "${data.name}" has been updated.` : `Product Category "${data.name}" has been configured.`}</p>`,
        icon: 'success',
        iconColor: '#10b981',
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3500,
        timerProgressBar: true,
        background: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)',
        color: isDark ? '#f8fafc' : '#0f172a',
        showClass: { popup: 'animate__animated animate__slideInRight animate__faster' },
        hideClass: { popup: 'animate__animated animate__fadeOutRight animate__faster' },
        customClass: {
          popup: 'rounded-2xl border border-emerald-100 dark:border-emerald-950 shadow-xl backdrop-blur-md p-4',
          timerProgressBar: 'bg-emerald-500'
        }
      });
      onBack();
    },
    onError: (err) => {
      const isDark = document.documentElement.classList.contains('dark');
      Swal.fire({
        title: `<span class="font-extrabold text-sm text-slate-800 dark:text-slate-100">Operation Failed</span>`,
        html: `<p class="text-xs text-slate-500 dark:text-slate-400 mt-1">${err.response?.data?.message || 'Failed to save product category configuration.'}</p>`,
        icon: 'error',
        iconColor: '#ef4444',
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3500,
        timerProgressBar: true,
        background: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)',
        color: isDark ? '#f8fafc' : '#0f172a',
        showClass: { popup: 'animate__animated animate__slideInRight animate__faster' },
        hideClass: { popup: 'animate__animated animate__fadeOutRight animate__faster' },
        customClass: {
          popup: 'rounded-2xl border border-red-100 dark:border-red-950 shadow-xl backdrop-blur-md p-4',
          timerProgressBar: 'bg-red-500'
        }
      });
    }
  });

  // ── Loading skeleton ────────────────────────────────────────────────────────
  if (isEditMode && isFetching) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-64 w-full rounded-xl" />
        <Skeleton className="h-10 w-40" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* ── Page Header ──────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 text-slate-500" />
        </button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            {isEditMode ? 'Edit Product Category' : 'Add Product Category'}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {isEditMode
              ? 'Update the details for this product category.'
              : 'Create a new product category to organise your finished goods.'}
          </p>
        </div>
      </div>

      {/* ── Form ─────────────────────────────────────────────────────────── */}
      <form onSubmit={handleSubmit(handleFormSubmit)}>
        <Card className="dark:bg-[#111827] dark:border-slate-800 shadow-sm relative !overflow-visible">
          {/* Section header */}
          <CardHeader className="px-6 pt-5 pb-0">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
              <Tag className="w-4 h-4 text-indigo-500" />
              Category Information
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Define the name, description, and active status for this category.
            </p>
          </CardHeader>

          <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6 relative !overflow-visible">
            {/* Name */}
            <div className="relative">
              <FieldLabel required>Category Name</FieldLabel>
              <input
                {...register('name', { required: 'Category name is required' })}
                placeholder="e.g. Ice Cream Mix, Kulfi Mix"
                className={errors.name ? errorInputCls : inputCls}
                autoComplete="off"
              />
              {errors.name && <FieldError message={errors.name.message} />}
              {debouncedName.trim().length >= 1 && nameMatches.length > 0 && (
                <div className="absolute z-[100] left-0 right-0 mt-1 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl overflow-hidden divide-y divide-slate-100 dark:divide-slate-800 animate__animated animate__fadeIn">
                  <div className="px-3 py-2 bg-amber-500/10 text-amber-800 dark:text-amber-400 text-2xs font-extrabold tracking-wider uppercase flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 text-amber-500" /> Similar Categories Exist (Avoid Duplicates)
                  </div>
                  <div className="max-h-40 overflow-y-auto">
                    {nameMatches.map(cat => (
                      <div
                        key={cat.id}
                        onClick={() => {
                          setValue('name', cat.name, { shouldValidate: true });
                          setNameMatches([]);
                        }}
                        className="px-3 py-2.5 flex items-center justify-between text-xs hover:bg-indigo-50/55 dark:hover:bg-indigo-950/30 cursor-pointer transition-colors"
                      >
                        <span className="font-semibold text-slate-850 dark:text-slate-300">{cat.name}</span>
                        <span className="font-mono text-3xs px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-450 rounded border dark:border-slate-700">Existing</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Status */}
            <div>
              <FieldLabel>Status</FieldLabel>
              <div className="relative">
                <ToggleLeft className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                <select
                  {...register('status')}
                  className={`${inputCls} pl-9`}
                >
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                </select>
              </div>
              <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                Inactive categories cannot be assigned to new products.
              </p>
            </div>

            {/* Description — full width */}
            <div className="md:col-span-2">
              <FieldLabel>Description</FieldLabel>
              <div className="relative">
                <AlignLeft className="absolute left-3 top-3 w-4 h-4 text-slate-400 pointer-events-none" />
                <textarea
                  {...register('description')}
                  rows={3}
                  placeholder="Optional: describe the types of products in this category…"
                  className={`${inputCls} pl-9 resize-none`}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── Action Buttons ────────────────────────────────────────────── */}
        <div className="mt-6 flex items-center gap-3">
          <button
            type="submit"
            disabled={mutation.isPending}
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-lg font-medium text-sm shadow-sm transition-colors"
          >
            {mutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving…
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                {isEditMode ? 'Update Category' : 'Save Category'}
              </>
            )}
          </button>
          <button
            type="button"
            onClick={onBack}
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

export default function ProductCategoryListPage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const [view, setView] = useState('list'); // 'list' | 'add' | 'edit'
  const [editId, setEditId] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const itemsPerPage = 10;

  const { data: categories, isLoading } = useQuery({
    queryKey: ['product-categories'],
    queryFn: async () => (await api.get('/item-setup/product-category')).data,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => await api.delete(`/item-setup/product-category/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['product-categories'] }),
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids) => {
      await Promise.all(ids.map(id => api.delete(`/item-setup/product-category/${id}`)));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-categories'] });
      setSelectedIds([]);
      const isDark = document.documentElement.classList.contains('dark');
      Swal.fire({
        title: '<span class="font-extrabold text-sm text-slate-800 dark:text-slate-100">Deleted!</span>',
        html: '<p class="text-xs text-slate-500 dark:text-slate-400 mt-1">Selected categories have been deleted successfully.</p>',
        icon: 'success',
        iconColor: '#10b981',
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3500,
        timerProgressBar: true,
        background: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)',
        color: isDark ? '#f8fafc' : '#0f172a',
        showClass: { popup: 'animate__animated animate__slideInRight animate__faster' },
        hideClass: { popup: 'animate__animated animate__fadeOutRight animate__faster' },
        customClass: {
          popup: 'rounded-2xl border border-emerald-100 dark:border-emerald-950 shadow-xl backdrop-blur-md p-4',
          timerProgressBar: 'bg-emerald-500'
        }
      });
    },
    onError: (err) => {
      const isDark = document.documentElement.classList.contains('dark');
      Swal.fire({
        title: '<span class="font-extrabold text-sm text-slate-800 dark:text-slate-100">Operation Failed</span>',
        html: `<p class="text-xs text-slate-500 dark:text-slate-400 mt-1">${err.response?.data?.message || 'Failed to delete selected categories.'}</p>`,
        icon: 'error',
        iconColor: '#ef4444',
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3500,
        background: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)',
        color: isDark ? '#f8fafc' : '#0f172a',
        customClass: {
          popup: 'rounded-2xl border border-red-100 dark:border-red-950 shadow-xl backdrop-blur-md p-4',
          timerProgressBar: 'bg-red-500'
        }
      });
    }
  });

  const handleDelete = (id) => {
    const isDark = document.documentElement.classList.contains('dark');
    Swal.fire({
      title: '<span class="font-extrabold text-sm text-slate-800 dark:text-slate-100">Delete Category?</span>',
      html: '<p class="text-xs text-slate-500 dark:text-slate-400 mt-1">Are you sure you want to delete this product category? This action cannot be undone.</p>',
      icon: 'warning',
      iconColor: '#f59e0b',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Yes, delete it!',
      cancelButtonText: 'Cancel',
      background: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)',
      color: isDark ? '#f8fafc' : '#0f172a',
      customClass: {
        popup: 'rounded-2xl border border-amber-100 dark:border-amber-950 shadow-xl backdrop-blur-md p-6'
      }
    }).then((result) => {
      if (result.isConfirmed) {
        deleteMutation.mutate(id, {
          onSuccess: () => {
            Swal.fire({
               title: '<span class="font-extrabold text-sm text-slate-800 dark:text-slate-100">Deleted!</span>',
               html: '<p class="text-xs text-slate-500 dark:text-slate-400 mt-1">The product category has been deleted.</p>',
               icon: 'success',
               iconColor: '#10b981',
               toast: true,
               position: 'top-end',
               showConfirmButton: false,
               timer: 3505,
               background: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)',
               color: isDark ? '#f8fafc' : '#0f172a',
               customClass: {
                 popup: 'rounded-2xl border border-emerald-100 dark:border-emerald-950 shadow-xl backdrop-blur-md p-4'
               }
            });
          }
        });
      }
    });
  };

  const handleSelectRow = (id) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleSelectAll = (visibleItems) => {
    const visibleIds = visibleItems.map(item => item.id);
    const allSelected = visibleIds.every(id => selectedIds.includes(id));
    if (allSelected) {
      setSelectedIds(prev => prev.filter(id => !visibleIds.includes(id)));
    } else {
      setSelectedIds(prev => Array.from(new Set([...prev, ...visibleIds])));
    }
  };

  const handleBulkDelete = () => {
    const isDark = document.documentElement.classList.contains('dark');
    Swal.fire({
      title: '<span class="font-extrabold text-sm text-slate-800 dark:text-slate-100">Bulk Delete Categories?</span>',
      html: `<p class="text-xs text-slate-500 dark:text-slate-400 mt-1">Are you sure you want to delete the ${selectedIds.length} selected product categories? This action cannot be undone.</p>`,
      icon: 'warning',
      iconColor: '#f59e0b',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Yes, delete selected!',
      cancelButtonText: 'Cancel',
      background: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)',
      color: isDark ? '#f8fafc' : '#0f172a',
      customClass: {
        popup: 'rounded-2xl border border-amber-100 dark:border-amber-950 shadow-xl backdrop-blur-md p-6'
      }
    }).then((result) => {
      if (result.isConfirmed) {
        bulkDeleteMutation.mutate(selectedIds);
      }
    });
  };

  // Filter + search
  const filtered = (categories || []).filter((c) => {
    const matchesSearch =
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.description || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || (c.status || 'ACTIVE') === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / itemsPerPage));
  const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const activeCount = (categories || []).filter((c) => (c.status || 'ACTIVE') === 'ACTIVE').length;
  const inactiveCount = (categories || []).filter((c) => c.status === 'INACTIVE').length;

  const isAllVisibleSelected = paginated.length > 0 && paginated.every(item => selectedIds.includes(item.id));
  const isSomeVisibleSelected = paginated.some(item => selectedIds.includes(item.id)) && !isAllVisibleSelected;

  if (isLoading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-16 w-full rounded-xl" />
        <Skeleton className="h-72 w-full rounded-xl" />
      </div>
    );
  }

  if (view !== 'list') {
    return <ProductCategoryForm editId={editId} onBack={() => setView('list')} />;
  }

  return (
    <div className="space-y-6">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Product Categories
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Organise finished goods into categories for production and reporting.
          </p>
        </div>
        <button
          onClick={() => { setEditId(null); setView('add'); }}
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold shadow-sm transition-colors animate-all"
        >
          <Plus className="w-4 h-4" />
          Add Category
        </button>
      </div>

      {/* ── Stats ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Categories', value: (categories || []).length, icon: Tag, color: 'text-indigo-500', bg: 'bg-indigo-50 dark:bg-indigo-500/10' },
          { label: 'Active', value: activeCount, icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-500/10' },
          { label: 'Inactive', value: inactiveCount, icon: XCircle, color: 'text-slate-500', bg: 'bg-slate-100 dark:bg-slate-700' },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <Card key={label} className="dark:bg-[#111827] dark:border-slate-800 shadow-sm">
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`${bg} p-2.5 rounded-lg`}>
                <Icon className={`w-5 h-5 ${color}`} />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{value}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Premium selection banner */}
      {selectedIds.length > 0 && (
        <div className="bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-150 dark:border-indigo-900 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm animate__animated animate__fadeIn">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-indigo-600 text-white font-bold text-sm shadow-md shadow-indigo-500/20">
              {selectedIds.length}
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900 dark:text-white">Categories Selected</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Perform bulk actions on the selected product categories.</p>
            </div>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              onClick={() => setSelectedIds([])}
              className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-350 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all border border-slate-200 dark:border-slate-700"
            >
              Clear Selection
            </button>
            <button
              onClick={handleBulkDelete}
              className="flex items-center px-4 py-2 bg-red-600 hover:bg-red-755 text-white rounded-xl text-xs font-bold transition-all shadow-sm"
            >
              <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Delete Selected ({selectedIds.length})
            </button>
          </div>
        </div>
      )}

      {/* ── Table Card ─────────────────────────────────────────────────── */}
      <Card className="dark:bg-[#111827] dark:border-slate-800 shadow-sm">
        <CardContent className="p-0">
          {/* Toolbar */}
          <div className="px-4 py-3 flex flex-wrap items-center justify-between gap-3 border-b dark:border-slate-700">
            <div className="flex items-center gap-2">
              {/* Search */}
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search categories…"
                  value={searchTerm}
                  onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                  className="w-full pl-9 pr-4 py-2 border rounded-lg text-sm dark:bg-slate-900 dark:border-slate-700 dark:text-white bg-white border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Status filter */}
              <select
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
                className="py-2 pl-3 pr-8 border rounded-lg text-sm dark:bg-slate-900 dark:border-slate-700 dark:text-white bg-white border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="ALL">All Status</option>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </select>

              {/* Refresh */}
              <button
                type="button"
                onClick={() => queryClient.invalidateQueries({ queryKey: ['product-categories'] })}
                className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                title="Refresh"
              >
                <RefreshCw className="w-4 h-4 text-slate-500" />
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50 dark:bg-slate-800/50">
                <TableRow className="dark:border-slate-700">
                  <TableHead className="w-[50px] text-center">
                    <TableCheckbox
                      checked={isAllVisibleSelected}
                      indeterminate={isSomeVisibleSelected}
                      onChange={() => handleSelectAll(paginated)}
                    />
                  </TableHead>
                  <TableHead>Category Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Products</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-16">
                      <div className="flex flex-col items-center gap-2 text-slate-400">
                        <Tag className="w-8 h-8 opacity-40" />
                        <p className="text-sm font-medium">No categories found</p>
                        {searchTerm && (
                          <p className="text-xs">Try clearing the search filter.</p>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  paginated.map((item) => (
                    <TableRow
                      key={item.id}
                      className="dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <TableCell className="text-center">
                        <TableCheckbox
                          checked={selectedIds.includes(item.id)}
                          onChange={() => handleSelectRow(item.id)}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-500/15 flex items-center justify-center">
                            <Tag className="w-3.5 h-3.5 text-indigo-500" />
                          </div>
                          <span className="font-semibold text-slate-850 dark:text-slate-200">
                            {item.name}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-slate-500 dark:text-slate-400 text-sm max-w-xs truncate">
                        {item.description || <span className="italic text-slate-400">—</span>}
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold animate-pulse-subtle">
                          {item.products?.length ?? 0}
                        </span>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={item.status} />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            onClick={() => { setEditId(item.id); setView('edit'); }}
                            className="p-2 rounded-lg text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 transition-colors"
                            title="Edit"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(item.id)}
                            disabled={deleteMutation.isPending}
                            className="p-2 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors disabled:opacity-50"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          <div className="px-4 py-3 border-t dark:border-slate-700 flex flex-wrap items-center justify-between gap-2 text-sm text-slate-500">
            <span>
              {filtered.length === 0
                ? 'No results'
                : `Showing ${(currentPage - 1) * itemsPerPage + 1}–${Math.min(
                    currentPage * itemsPerPage,
                    filtered.length
                  )} of ${filtered.length}`}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 border rounded-lg text-xs font-medium bg-white dark:bg-slate-800 dark:border-slate-700 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
              >
                Previous
              </button>
              {Array.from({ length: totalPages }).map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentPage(i + 1)}
                  className={`px-3 py-1.5 border rounded-lg text-xs font-medium transition-colors ${
                    currentPage === i + 1
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white dark:bg-slate-800 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
                  }`}
                >
                  {i + 1}
                </button>
              ))}
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 border rounded-lg text-xs font-medium bg-white dark:bg-slate-800 dark:border-slate-700 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
