import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import Swal from 'sweetalert2';
import { Edit, Trash2, Plus, Search, ChevronDown, X, ArrowLeft, AlertCircle, Save, Loader2, Check } from 'lucide-react';
import { api } from '@/lib/axios';

import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import SearchSelect from '@/components/ui/SearchSelect';
import HsnSelect from '@/components/forms/HsnSelect';

const UOM_OPTIONS = [
  // Weight
  'gm', 'kg', 'mg', 'lb', 'oz', 'ton', 'metric ton', 'quintal',
  // Volume
  'liter', 'ml', 'cl', 'dl', 'gallon', 'quart', 'pint', 'fluid oz', 'cubic meter', 'cubic ft', 'cubic cm', 'cubic inch',
  // Length
  'meter', 'cm', 'mm', 'km', 'inch', 'feet', 'yard', 'mile',
  // Area
  'square meter', 'square ft', 'square cm', 'square inch', 'square yard', 'acre', 'hectare',
  // Count / Packaging
  'pcs', 'pair', 'dozen', 'gross', 'set', 'kit', 'bundle', 'box', 'carton', 'case', 'pack', 'bag', 'sack', 'pallet', 'tray', 'tube', 'bottle', 'can', 'drum', 'barrel', 'cylinder',
  // Roll / Sheet
  'roll', 'sheet', 'ream',
  // Time-based
  'hour', 'day',
  // Energy
  'kWh', 'MJ',
  // Other
  'unit', 'lot', 'assortment'
];

// Searchable UOM Dropdown Component
function UomSelect({ value, onChange, error }) {
  return (
    <SearchSelect
      value={value}
      onChange={onChange}
      options={UOM_OPTIONS}
      placeholder="Select UOM..."
      searchPlaceholder="Search UOM..."
      error={!!error}
      triggerClassName="text-sm border-slate-200 dark:border-slate-700 bg-white"
    />
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

function RawMaterialForm({ editId, onBack }) {
  const isEditMode = !!editId;
  const queryClient = useQueryClient();

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm();

  const selectedUom = watch('unitId');
  const selectedHsn = watch('hsnCode') || '';

  // Fetch categories
  const { data: categories } = useQuery({
    queryKey: ['rm-categories'],
    queryFn: async () => (await api.get('/item-setup/rm-category')).data
  });

  // Fetch all raw materials to determine the next code (used only in Add mode)
  const { data: allRawMaterials, isLoading: isLoadingAll } = useQuery({
    queryKey: ['raw-materials-list'],
    queryFn: async () => (await api.get('/item-setup/raw-material')).data,
    enabled: !isEditMode
  });

  const [debouncedName, setDebouncedName] = useState('');
  const [nameMatches, setNameMatches] = useState([]);
  const nameValue = watch('name') || '';

  // Debounce the name search input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedName(nameValue);
    }, 300);
    return () => clearTimeout(handler);
  }, [nameValue]);

  // Query/Search for existing raw material names
  useEffect(() => {
    if (debouncedName.trim().length >= 1) {
      api.get('/item-setup/raw-material')
        .then(res => {
          const list = res.data || [];
          const matches = list.filter(rm => 
            rm.name.toLowerCase().includes(debouncedName.toLowerCase()) && 
            rm.id !== editId
          );
          setNameMatches(matches);
        })
        .catch(err => console.error(err));
    } else {
      setNameMatches([]);
    }
  }, [debouncedName, editId]);

  // Auto-generate the next RM code in Add mode
  useEffect(() => {
    if (!isEditMode && allRawMaterials) {
      let nextCode;
      if (allRawMaterials.length === 0) {
        nextCode = 'RM-00005';
      } else {
        let maxNum = 0;
        allRawMaterials.forEach(rm => {
          const match = rm.code && rm.code.match(/^RM-(\d+)$/);
          if (match) {
            const num = parseInt(match[1], 10);
            if (num > maxNum) maxNum = num;
          }
        });
        nextCode = `RM-${String(maxNum + 1).padStart(5, '0')}`;
      }
      setValue('code', nextCode);
    }
  }, [allRawMaterials, isEditMode, setValue]);

  const handleFormSubmit = async (data) => {
    const isDark = document.documentElement.classList.contains('dark');
    
    // Warn if duplicate exists
    const duplicate = nameMatches.find(rm => rm.name.toLowerCase() === data.name.toLowerCase());
    if (duplicate) {
      const result = await Swal.fire({
        title: '<span class="font-extrabold text-sm text-slate-800 dark:text-slate-100">Duplicate Name Detected</span>',
        html: `<p class="text-xs text-slate-500 dark:text-slate-400 mt-1">A Raw Material named <strong>"${data.name}"</strong> already exists (${duplicate.code}). Do you want to proceed and save it anyway? (UOM or rate may be different)</p>`,
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
          popup: 'rounded-2xl border border-amber-100 dark:border-amber-955 shadow-xl backdrop-blur-md p-6'
        }
      });
      if (!result.isConfirmed) {
        return;
      }
    }
    mutation.mutate(data);
  };

  const { data: existingData, isLoading: isFetching } = useQuery({
    queryKey: ['raw-material', editId],
    queryFn: async () => (await api.get(`/item-setup/raw-material/${editId}`)).data,
    enabled: isEditMode
  });

  useEffect(() => {
    if (existingData) reset(existingData);
  }, [existingData, reset]);

  const mutation = useMutation({
    mutationFn: async (data) => {
      data.ratePerUnit = parseFloat(data.ratePerUnit) || 0;
      data.openingStock = parseFloat(data.openingStock) || 0;
      data.alertLevel = parseFloat(data.alertLevel) || 0;
      if (isEditMode) return (await api.put(`/item-setup/raw-material/${editId}`, data)).data;
      return (await api.post('/item-setup/raw-material', data)).data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['raw-materials'] });
      const isDark = document.documentElement.classList.contains('dark');
      Swal.fire({
        title: `<span class="font-extrabold text-sm text-slate-800 dark:text-slate-100">${isEditMode ? 'Raw Material Updated!' : 'Raw Material Configured!'}</span>`,
        html: `<p class="text-xs text-slate-500 dark:text-slate-400 mt-1">${isEditMode ? `Raw Material "${data.name}" has been updated.` : `Raw Material "${data.name}" has been added with code ${data.code}.`}</p>`,
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
        html: `<p class="text-xs text-slate-500 dark:text-slate-400 mt-1">${err.response?.data?.message || 'Failed to save raw material configuration.'}</p>`,
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

  if (isEditMode && isFetching) return <div className="space-y-6"><Skeleton className="h-[400px] w-full" /></div>;
  if (!isEditMode && isLoadingAll) return <div className="space-y-6"><Skeleton className="h-[400px] w-full" /></div>;

  return (
    <div className="space-y-6 max-w-5xl">
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
            {isEditMode ? 'Edit Raw Material' : 'Add Raw Material'}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Configure raw material specifications, pricing models, and alert levels.
          </p>
        </div>
      </div>
      
      <form onSubmit={handleSubmit(handleFormSubmit)}>
        <Card className="dark:bg-[#111827] dark:border-slate-800 relative !overflow-visible">
          <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 relative !overflow-visible">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Item Code <span className="text-red-500">*</span>
              </label>
              <input
                {...register('code', { required: true })}
                readOnly
                disabled
                placeholder="Auto-generated"
                className="w-full px-3 py-2.5 border rounded-lg dark:bg-slate-900 dark:border-slate-705 dark:text-white bg-slate-105 dark:bg-slate-800 cursor-not-allowed text-slate-500 dark:text-slate-400 font-mono text-sm"
              />
              {errors.code && <span className="text-xs text-red-500">Required</span>}
              <p className="text-xs text-slate-400 dark:text-slate-500">Auto-generated, cannot be edited</p>
            </div>

            <div className="space-y-2 relative">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Name <span className="text-red-500">*</span></label>
              <input 
                {...register('name', { required: true })} 
                className="w-full px-3 py-2.5 border rounded-lg dark:bg-slate-900 dark:border-slate-700 dark:text-white bg-white border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" 
                placeholder="Item name"
                autoComplete="off"
              />
              {errors.name && <span className="text-xs text-red-500">Required</span>}
              {debouncedName.trim().length >= 1 && nameMatches.length > 0 && (
                <div className="absolute z-[100] left-0 mt-1 w-[320px] md:w-[400px] max-w-[95vw] bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl overflow-hidden divide-y divide-slate-100 dark:divide-slate-850 animate__animated animate__fadeIn">
                  <div className="max-h-56 overflow-y-auto">
                    {nameMatches.map(rm => (
                      <div
                        key={rm.id}
                        onClick={() => {
                          setValue('name', rm.name, { shouldValidate: true });
                          setNameMatches([]);
                        }}
                        className="px-4 py-3 flex items-center justify-between hover:bg-indigo-50/70 dark:hover:bg-indigo-950/40 cursor-pointer transition-all duration-200 border-l-2 border-transparent hover:border-indigo-500"
                      >
                        <div className="flex flex-col gap-0.5">
                          <span className="font-semibold text-slate-800 dark:text-slate-250 text-sm">
                            {rm.name}
                          </span>
                          <span className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">
                            Category: <span className="text-slate-600 dark:text-slate-450">{rm.category?.name || 'N/A'}</span>
                          </span>
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0 ml-4">
                          <span className="font-mono text-[10px] font-bold px-2 py-0.5 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-md border border-indigo-100 dark:border-indigo-900">
                            {rm.code}
                          </span>
                          <span className="text-[10px] text-slate-400 dark:text-slate-500 uppercase font-semibold">
                            UOM: {rm.unitId || 'N/A'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Print Name</label>
              <input {...register('printName')} className="w-full px-3 py-2.5 border rounded-lg dark:bg-slate-900 dark:border-slate-700 dark:text-white bg-white border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Label print name" />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Category <span className="text-red-500">*</span></label>
              <select {...register('categoryId', { required: true })} className="w-full px-3 py-2.5 border rounded-lg dark:bg-slate-900 dark:border-slate-700 dark:text-white bg-white border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                <option value="">Select Category...</option>
                {categories?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              {errors.categoryId && <span className="text-xs text-red-500">Required</span>}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">UOM <span className="text-red-500">*</span></label>
              <input type="hidden" {...register('unitId', { required: true })} />
              <UomSelect
                value={selectedUom}
                onChange={(val) => setValue('unitId', val, { shouldValidate: true })}
                error={errors.unitId}
              />
              {errors.unitId && <span className="text-xs text-red-500">Required</span>}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Rate Per Unit (INR)</label>
              <input type="number" step="0.01" {...register('ratePerUnit')} className="w-full px-3 py-2.5 border rounded-lg dark:bg-slate-900 dark:border-slate-700 dark:text-white bg-white border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Opening Stock</label>
              <input type="number" step="0.01" {...register('openingStock')} className="w-full px-3 py-2.5 border rounded-lg dark:bg-slate-900 dark:border-slate-700 dark:text-white bg-white border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Alert Level (Min Stock)</label>
              <input type="number" step="0.01" {...register('alertLevel')} className="w-full px-3 py-2.5 border rounded-lg dark:bg-slate-900 dark:border-slate-700 dark:text-white bg-white border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">HSN Code</label>
              <input type="hidden" {...register('hsnCode')} />
              <HsnSelect
                value={selectedHsn}
                onChange={(val) => setValue('hsnCode', val, { shouldValidate: true })}
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Description</label>
              <textarea {...register('description')} rows="2" className="w-full px-3 py-2 border rounded-md dark:bg-slate-900 dark:border-slate-700 dark:text-white bg-white border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
          </CardContent>
        </Card>

        <div className="mt-6 flex space-x-4">
          <button type="submit" disabled={mutation.isPending} className="inline-flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium text-sm shadow-sm transition-colors">
            {mutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Submitting…
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Submit
              </>
            )}
          </button>
          <button type="button" onClick={onBack} className="inline-flex items-center gap-2 px-6 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg font-medium text-sm transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
        </div>
      </form>
    </div>
  );
}

export default function RawMaterialListPage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [view, setView] = useState('list'); // 'list' | 'add' | 'edit'
  const [editId, setEditId] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const itemsPerPage = 10;

  const { data: rawMaterials, isLoading } = useQuery({
    queryKey: ['raw-materials'],
    queryFn: async () => (await api.get('/item-setup/raw-material')).data
  });  const deleteMutation = useMutation({
    mutationFn: async ({ id, force }) => {
      const url = `/item-setup/raw-material/${id}${force ? '?force=true' : ''}`;
      return (await api.delete(url)).data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['raw-materials'] })
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async ({ ids, force }) => {
      await Promise.all(ids.map(id => api.delete(`/item-setup/raw-material/${id}${force ? '?force=true' : ''}`)));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['raw-materials'] });
      setSelectedIds([]);
      const isDark = document.documentElement.classList.contains('dark');
      Swal.fire({
        title: '<span class="font-extrabold text-sm text-slate-800 dark:text-slate-100">Deleted!</span>',
        html: '<p class="text-xs text-slate-500 dark:text-slate-400 mt-1">Selected raw materials have been deleted successfully.</p>',
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
    }
  });

  const handleDelete = (id, force = false) => {
    const isDark = document.documentElement.classList.contains('dark');

    if (force) {
      deleteMutation.mutate({ id, force: true }, {
        onSuccess: () => {
          Swal.fire({
            title: '<span class="font-extrabold text-sm text-slate-800 dark:text-slate-100">Deleted!</span>',
            html: '<p class="text-xs text-slate-500 dark:text-slate-400 mt-1">The raw material and its referencing records have been deleted.</p>',
            icon: 'success',
            iconColor: '#10b981',
            toast: true,
            position: 'top-end',
            showConfirmButton: false,
            timer: 3500,
            background: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)',
            color: isDark ? '#f8fafc' : '#0f172a',
            customClass: {
              popup: 'rounded-2xl border border-emerald-100 dark:border-emerald-950 shadow-xl backdrop-blur-md p-4'
            }
          });
        },
        onError: (err) => {
          Swal.fire({
            title: '<span class="font-extrabold text-sm text-slate-800 dark:text-slate-100">Deletion Failed</span>',
            html: `<p class="text-xs text-slate-500 dark:text-slate-400 mt-1">${err.response?.data?.message || 'Could not delete raw material.'}</p>`,
            icon: 'error',
            iconColor: '#ef4444',
            background: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)',
            color: isDark ? '#f8fafc' : '#0f172a',
            customClass: {
              popup: 'rounded-2xl border border-red-100 dark:border-red-950 shadow-xl backdrop-blur-md p-6'
            }
          });
        }
      });
      return;
    }

    Swal.fire({
      title: '<span class="font-extrabold text-sm text-slate-800 dark:text-slate-100">Delete Raw Material?</span>',
      html: '<p class="text-xs text-slate-500 dark:text-slate-400 mt-1">Are you sure you want to delete this raw material? This action cannot be undone.</p>',
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
        deleteMutation.mutate({ id, force: false }, {
          onSuccess: () => {
            Swal.fire({
              title: '<span class="font-extrabold text-sm text-slate-800 dark:text-slate-100">Deleted!</span>',
              html: '<p class="text-xs text-slate-500 dark:text-slate-400 mt-1">The raw material has been deleted.</p>',
              icon: 'success',
              iconColor: '#10b981',
              toast: true,
              position: 'top-end',
              showConfirmButton: false,
              timer: 3500,
              background: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)',
              color: isDark ? '#f8fafc' : '#0f172a',
              customClass: {
                popup: 'rounded-2xl border border-emerald-100 dark:border-emerald-950 shadow-xl backdrop-blur-md p-4'
              }
            });
          },
          onError: (err) => {
            if (err.response?.status === 409 && err.response?.data?.error === 'FOREIGN_KEY_VIOLATION') {
              const refs = err.response.data.references || {};
              const stockAdjustments = refs.stockAdjustments || [];
              const productBOMs = refs.productBOMs || [];
              const wasteItems = refs.wasteItems || [];
              const batchUsages = refs.batchUsages || [];
              const lossMaterials = refs.lossMaterials || [];

              let refHtml = '';
              
              if (stockAdjustments.length > 0) {
                refHtml += `<div class="mb-2 text-left"><strong>Stock Adjustments (${stockAdjustments.length}):</strong><ul class="list-disc list-inside mt-1 max-h-20 overflow-y-auto bg-slate-50 dark:bg-slate-900/50 p-1.5 rounded border border-slate-100 dark:border-slate-800 text-[11px] text-slate-600 dark:text-slate-350">`;
                refHtml += stockAdjustments.map(sa => `<li>${sa.type}: ${sa.quantity} (on ${new Date(sa.createdAt).toLocaleDateString()})</li>`).join('');
                refHtml += `</ul></div>`;
              }

              if (productBOMs.length > 0) {
                refHtml += `<div class="mb-2 text-left"><strong>Bills of Materials (BOM) (${productBOMs.length}):</strong><ul class="list-disc list-inside mt-1 max-h-20 overflow-y-auto bg-slate-50 dark:bg-slate-900/50 p-1.5 rounded border border-slate-100 dark:border-slate-800 text-[11px] text-slate-600 dark:text-slate-350">`;
                refHtml += productBOMs.map(bom => `<li>Product: ${bom.product?.name || 'N/A'} (${bom.product?.code || 'N/A'})</li>`).join('');
                refHtml += `</ul></div>`;
              }

              if (wasteItems.length > 0) {
                refHtml += `<div class="mb-2 text-left"><strong>Waste Logs (${wasteItems.length}):</strong><ul class="list-disc list-inside mt-1 max-h-20 overflow-y-auto bg-slate-50 dark:bg-slate-900/50 p-1.5 rounded border border-slate-100 dark:border-slate-800 text-[11px] text-slate-600 dark:text-slate-350">`;
                refHtml += wasteItems.map(w => `<li>Log Ref: ${w.waste?.referenceNo || 'N/A'} (Qty: ${w.quantity})</li>`).join('');
                refHtml += `</ul></div>`;
              }

              if (batchUsages.length > 0) {
                refHtml += `<div class="mb-2 text-left"><strong>Production Batch Usages (${batchUsages.length}):</strong><ul class="list-disc list-inside mt-1 max-h-20 overflow-y-auto bg-slate-50 dark:bg-slate-900/50 p-1.5 rounded border border-slate-100 dark:border-slate-800 text-[11px] text-slate-600 dark:text-slate-350">`;
                refHtml += batchUsages.map(bu => `<li>Batch Ref: ${bu.batch?.referenceNo || 'N/A'} (Qty: ${bu.actualUsedQty})</li>`).join('');
                refHtml += `</ul></div>`;
              }

              if (lossMaterials.length > 0) {
                refHtml += `<div class="mb-2 text-left"><strong>Production Loss Records (${lossMaterials.length}):</strong><ul class="list-disc list-inside mt-1 max-h-20 overflow-y-auto bg-slate-50 dark:bg-slate-900/50 p-1.5 rounded border border-slate-100 dark:border-slate-800 text-[11px] text-slate-600 dark:text-slate-350">`;
                refHtml += lossMaterials.map(lm => `<li>Loss Date: ${lm.loss?.date ? new Date(lm.loss.date).toLocaleDateString() : 'N/A'} (Qty: ${lm.lossQty})</li>`).join('');
                refHtml += `</ul></div>`;
              }

              Swal.fire({
                title: '<span class="font-extrabold text-sm text-slate-850 dark:text-slate-100 text-left">Raw Material In Use</span>',
                html: `<div class="text-xs text-slate-505 dark:text-slate-400 text-left mt-2">
                         <p>This raw material is currently referenced by the following database records:</p>
                         <div class="mt-2 space-y-2 max-h-56 overflow-y-auto p-1">
                           ${refHtml}
                         </div>
                         <p class="mt-3 font-semibold text-rose-500">Are you sure you want to delete this raw material AND delete all of its referencing logs/BOMs/adjustments? This action cannot be undone.</p>
                       </div>`,
                icon: 'warning',
                iconColor: '#ef4444',
                showCancelButton: true,
                confirmButtonColor: '#ef4444',
                cancelButtonColor: '#64748b',
                confirmButtonText: 'Yes, delete raw material & references!',
                cancelButtonText: 'Cancel',
                background: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)',
                color: isDark ? '#f8fafc' : '#0f172a',
                customClass: {
                  popup: 'rounded-2xl border border-rose-100 dark:border-rose-955 shadow-xl backdrop-blur-md p-6 w-[32rem]'
                }
              }).then((confirmRes) => {
                if (confirmRes.isConfirmed) {
                  handleDelete(id, true);
                }
              });
            } else {
              Swal.fire({
                title: '<span class="font-extrabold text-sm text-slate-800 dark:text-slate-100">Deletion Failed</span>',
                html: `<p class="text-xs text-slate-500 dark:text-slate-400 mt-1">${err.response?.data?.message || 'Could not delete raw material.'}</p>`,
                icon: 'error',
                iconColor: '#ef4444',
                background: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)',
                color: isDark ? '#f8fafc' : '#0f172a',
                customClass: {
                  popup: 'rounded-2xl border border-red-100 dark:border-red-950 shadow-xl backdrop-blur-md p-6'
                }
              });
            }
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

  const handleBulkDelete = (force = false) => {
    const isDark = document.documentElement.classList.contains('dark');

    if (force) {
      bulkDeleteMutation.mutate({ ids: selectedIds, force: true }, {
        onSuccess: () => {
          Swal.fire({
            title: '<span class="font-extrabold text-sm text-slate-800 dark:text-slate-100">Deleted!</span>',
            html: '<p class="text-xs text-slate-500 dark:text-slate-400 mt-1">Selected raw materials and all of their referencing records have been deleted.</p>',
            icon: 'success',
            iconColor: '#10b981',
            toast: true,
            position: 'top-end',
            showConfirmButton: false,
            timer: 3500,
            background: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)',
            color: isDark ? '#f8fafc' : '#0f172a',
            customClass: {
              popup: 'rounded-2xl border border-emerald-100 dark:border-emerald-950 shadow-xl backdrop-blur-md p-4'
            }
          });
        },
        onError: (err) => {
          Swal.fire({
            title: '<span class="font-extrabold text-sm text-slate-800 dark:text-slate-100">Operation Failed</span>',
            html: `<p class="text-xs text-slate-500 dark:text-slate-400 mt-1">${err.response?.data?.message || 'Failed to delete selected items.'}</p>`,
            icon: 'error',
            iconColor: '#ef4444',
            background: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)',
            color: isDark ? '#f8fafc' : '#0f172a',
            customClass: {
              popup: 'rounded-2xl border border-red-100 dark:border-red-950 shadow-xl backdrop-blur-md p-6'
            }
          });
        }
      });
      return;
    }

    Swal.fire({
      title: '<span class="font-extrabold text-sm text-slate-800 dark:text-slate-100">Bulk Delete Raw Materials?</span>',
      html: `<p class="text-xs text-slate-500 dark:text-slate-400 mt-1">Are you sure you want to delete the ${selectedIds.length} selected raw materials? This action cannot be undone.</p>`,
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
        popup: 'rounded-2xl border border-amber-100 dark:border-amber-955 shadow-xl backdrop-blur-md p-6'
      }
    }).then((result) => {
      if (result.isConfirmed) {
        bulkDeleteMutation.mutate({ ids: selectedIds, force: false }, {
          onSuccess: () => {
            Swal.fire({
              title: '<span class="font-extrabold text-sm text-slate-800 dark:text-slate-100">Deleted!</span>',
              html: '<p class="text-xs text-slate-500 dark:text-slate-400 mt-1">Selected raw materials have been deleted successfully.</p>',
              icon: 'success',
              iconColor: '#10b981',
              toast: true,
              position: 'top-end',
              showConfirmButton: false,
              timer: 3500,
              background: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)',
              color: isDark ? '#f8fafc' : '#0f172a',
              customClass: {
                popup: 'rounded-2xl border border-emerald-100 dark:border-emerald-950 shadow-xl backdrop-blur-md p-4'
              }
            });
          },
          onError: (err) => {
            if (err.response?.status === 409 && err.response?.data?.error === 'FOREIGN_KEY_VIOLATION') {
              Swal.fire({
                title: '<span class="font-extrabold text-sm text-slate-850 dark:text-slate-100 text-left">Selected Materials In Use</span>',
                html: `<div class="text-xs text-slate-505 dark:text-slate-400 text-left mt-2">
                         <p>One or more of the selected raw materials are currently in use by active bills of materials (BOM), stock adjustments, waste logs, or batch usages.</p>
                         <p class="mt-3 font-semibold text-rose-500">Are you sure you want to delete all selected raw materials AND all of their referencing records? This action cannot be undone.</p>
                       </div>`,
                icon: 'warning',
                iconColor: '#ef4444',
                showCancelButton: true,
                confirmButtonColor: '#ef4444',
                cancelButtonColor: '#64748b',
                confirmButtonText: 'Yes, force delete all!',
                cancelButtonText: 'Cancel',
                background: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)',
                color: isDark ? '#f8fafc' : '#0f172a',
                customClass: {
                  popup: 'rounded-2xl border border-rose-100 dark:border-rose-955 shadow-xl backdrop-blur-md p-6'
                }
              }).then((confirmRes) => {
                if (confirmRes.isConfirmed) {
                  handleBulkDelete(true);
                }
              });
            } else {
              Swal.fire({
                title: '<span class="font-extrabold text-sm text-slate-800 dark:text-slate-100">Operation Failed</span>',
                html: `<p class="text-xs text-slate-500 dark:text-slate-400 mt-1">${err.response?.data?.message || 'Failed to delete selected raw materials.'}</p>`,
                icon: 'error',
                iconColor: '#ef4444',
                toast: true,
                position: 'top-end',
                showConfirmButton: false,
                timer: 3500,
                background: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)',
                color: isDark ? '#f8fafc' : '#0f172a',
                customClass: {
                  popup: 'rounded-2xl border border-red-100 dark:border-red-950 shadow-xl backdrop-blur-md p-4'
                }
              });
            }
          }
        });
      }
    });
  };

  const filtered = rawMaterials?.filter(rm => 
    rm.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    rm.code.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];
  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const isAllVisibleSelected = paginated.length > 0 && paginated.every(item => selectedIds.includes(item.id));
  const isSomeVisibleSelected = paginated.some(item => selectedIds.includes(item.id)) && !isAllVisibleSelected;

  if (isLoading) return <div className="p-8"><Skeleton className="h-[400px] w-full" /></div>;

  if (view !== 'list') {
    return <RawMaterialForm editId={editId} onBack={() => setView('list')} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Raw Materials</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Configure raw materials, pricing profiles, and reorder levels.
          </p>
        </div>
        <button 
          onClick={() => { setEditId(null); setView('add'); }}
          className="flex items-center px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold transition-all shadow-sm shadow-indigo-500/10"
        >
          <Plus className="w-4 h-4 mr-2" /> Add Raw Material
        </button>
      </div>

      {/* Premium selection banner */}
      {selectedIds.length > 0 && (
        <div className="bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-150 dark:border-indigo-900 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm animate__animated animate__fadeIn">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-indigo-600 text-white font-bold text-sm shadow-md shadow-indigo-500/20">
              {selectedIds.length}
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900 dark:text-white">Raw Materials Selected</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Perform bulk actions on the selected raw materials.</p>
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

      <Card className="dark:bg-[#111827] dark:border-slate-800 shadow-sm">
        <CardContent className="p-0">
          <div className="p-4 flex justify-between items-center border-b dark:border-slate-700 gap-4 flex-wrap">
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input type="text" placeholder="Search..." value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }} className="w-full pl-9 pr-4 py-2 border border-slate-205 dark:border-slate-700 rounded-lg text-sm dark:bg-slate-900 dark:text-white bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
          </div>
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
                  <TableHead>Code</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>UOM</TableHead>
                  <TableHead>HSN Code</TableHead>
                  <TableHead className="text-right">Rate/Unit (INR)</TableHead>
                  <TableHead className="text-right">Op. Stock</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-12 text-slate-400 dark:text-slate-500">
                      No raw materials found. Get started by clicking "Add Raw Material"!
                    </TableCell>
                  </TableRow>
                ) : (
                  paginated.map((item) => (
                    <TableRow key={item.id} className="dark:border-slate-700 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                      <TableCell className="text-center">
                        <TableCheckbox
                          checked={selectedIds.includes(item.id)}
                          onChange={() => handleSelectRow(item.id)}
                        />
                      </TableCell>
                      <TableCell className="font-mono text-xs font-semibold text-slate-500 dark:text-slate-400">{item.code}</TableCell>
                      <TableCell className="font-medium text-slate-900 dark:text-slate-100">{item.name}</TableCell>
                      <TableCell>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border dark:border-slate-700">
                          {item.category?.name || 'N/A'}
                        </span>
                      </TableCell>
                      <TableCell className="text-slate-600 dark:text-slate-400 font-medium">{item.unitId}</TableCell>
                      <TableCell className="font-mono text-xs text-slate-600 dark:text-slate-400">{item.hsnCode || '—'}</TableCell>
                      <TableCell className="text-right font-mono text-slate-650 dark:text-slate-350">₹{parseFloat(item.ratePerUnit).toFixed(2)}</TableCell>
                      <TableCell className="text-right font-mono text-slate-500">{item.openingStock}</TableCell>
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
                            onClick={() => handleDelete(item.id)} 
                            className="p-2 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
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
          <div className="p-4 border-t dark:border-slate-700 flex justify-between text-sm text-slate-500">
            <div>Showing {filtered.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filtered.length)} of {filtered.length} entries</div>
            <div className="flex space-x-1">
              <button 
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))} 
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
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} 
                disabled={currentPage === totalPages || totalPages === 0} 
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
