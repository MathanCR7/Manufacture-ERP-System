import React, { useEffect, useState, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '@/lib/axios';
import { ChevronDown, Search, X } from 'lucide-react';
import Swal from 'sweetalert2';

import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

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
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef(null);
  const searchRef = useRef(null);

  const filtered = UOM_OPTIONS.filter(uom =>
    uom.toLowerCase().includes(search.toLowerCase())
  );

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (open && searchRef.current) {
      searchRef.current.focus();
    }
  }, [open]);

  const handleSelect = (uom) => {
    onChange(uom);
    setOpen(false);
    setSearch('');
  };

  const handleClear = (e) => {
    e.stopPropagation();
    onChange('');
    setSearch('');
  };

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setOpen(prev => !prev)}
        className={`w-full px-3 py-2 border rounded-md text-left flex items-center justify-between bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 ${error ? 'border-red-400' : 'border-slate-300 dark:border-slate-700'}`}
      >
        <span className={value ? 'text-slate-900 dark:text-white' : 'text-slate-400'}>
          {value || 'Select UOM...'}
        </span>
        <div className="flex items-center gap-1">
          {value && (
            <span
              onMouseDown={handleClear}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer p-0.5 rounded"
            >
              <X className="w-3 h-3" />
            </span>
          )}
          <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-150 ${open ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md shadow-lg">
          {/* Search box */}
          <div className="p-2 border-b border-slate-100 dark:border-slate-700">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                ref={searchRef}
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search UOM..."
                className="w-full pl-7 pr-7 py-1.5 text-sm border rounded border-slate-200 dark:border-slate-650 dark:bg-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              {search && (
                <button
                  type="button"
                  onMouseDown={() => setSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          {/* Options list */}
          <ul className="max-h-52 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-sm text-slate-400 text-center">No results found</li>
            ) : (
              filtered.map(uom => (
                <li
                  key={uom}
                  onMouseDown={() => handleSelect(uom)}
                  className={`px-3 py-2 text-sm cursor-pointer select-none ${
                    value === uom
                      ? 'bg-indigo-50 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 font-medium'
                      : 'text-slate-700 dark:text-slate-350 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  {uom}
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

export default function AddRawMaterialPage() {
  const { id } = useParams();
  const isEditMode = !!id;
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm({
    defaultValues: { unitId: 'kg', ratePerUnit: 0, openingStock: 0, alertLevel: 0, code: '' }
  });

  const selectedUom = watch('unitId');

  const { data: categories } = useQuery({
    queryKey: ['rm-categories'],
    queryFn: async () => (await api.get('/item-setup/rm-category')).data
  });

  // Fetch all raw materials to determine the next code (used only in Add mode)
  const { data: allRawMaterials, isLoading: isLoadingAll } = useQuery({
    queryKey: ['raw-materials'],
    queryFn: async () => (await api.get('/item-setup/raw-material')).data,
    enabled: !isEditMode
  });

  // Auto-generate the next RM code in Add mode
  useEffect(() => {
    if (!isEditMode && allRawMaterials) {
      let maxNum = 0;
      allRawMaterials.forEach(rm => {
        const match = rm.code && rm.code.match(/^RM-(\d+)$/);
        if (match) {
          const num = parseInt(match[1], 10);
          if (num > maxNum) maxNum = num;
        }
      });
      const nextCode = `RM-${String(maxNum + 1).padStart(5, '0')}`;
      setValue('code', nextCode);
    }
  }, [allRawMaterials, isEditMode, setValue]);

  const { data: existingData, isLoading: isFetching } = useQuery({
    queryKey: ['raw-material', id],
    queryFn: async () => (await api.get(`/item-setup/raw-material/${id}`)).data,
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
      if (isEditMode) return (await api.put(`/item-setup/raw-material/${id}`, data)).data;
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
      navigate('/setup/raw-material');
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
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
        {isEditMode ? 'Edit Raw Material' : 'Add Raw Material'}
      </h1>
      
      <form onSubmit={handleSubmit(data => mutation.mutate(data))}>
        <Card className="dark:bg-[#111827] dark:border-slate-800">
          <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Item Code <span className="text-red-500">*</span>
              </label>
              <input
                {...register('code', { required: true })}
                readOnly
                disabled
                placeholder="Auto-generated"
                className="w-full px-3 py-2 border rounded-md dark:bg-slate-900 dark:border-slate-700 dark:text-white bg-slate-100 dark:bg-slate-800 cursor-not-allowed text-slate-500 dark:text-slate-400 font-mono"
              />
              {errors.code && <span className="text-xs text-red-500">Required</span>}
              <p className="text-xs text-slate-400 dark:text-slate-500">Auto-generated, cannot be edited</p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Name <span className="text-red-500">*</span></label>
              <input {...register('name', { required: true })} className="w-full px-3 py-2 border rounded-md dark:bg-slate-900 dark:border-slate-700 dark:text-white" />
              {errors.name && <span className="text-xs text-red-500">Required</span>}
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Print Name</label>
              <input {...register('printName')} className="w-full px-3 py-2 border rounded-md dark:bg-slate-900 dark:border-slate-700 dark:text-white" />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Category <span className="text-red-500">*</span></label>
              <select {...register('categoryId', { required: true })} className="w-full px-3 py-2 border rounded-md dark:bg-slate-900 dark:border-slate-700 dark:text-white">
                <option value="">Select Category...</option>
                {categories?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              {errors.categoryId && <span className="text-xs text-red-500">Required</span>}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">UOM <span className="text-red-500">*</span></label>
              {/* Hidden input keeps react-hook-form in sync */}
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
              <input type="number" step="0.01" {...register('ratePerUnit')} className="w-full px-3 py-2 border rounded-md dark:bg-slate-900 dark:border-slate-700 dark:text-white" />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Opening Stock</label>
              <input type="number" step="0.01" {...register('openingStock')} className="w-full px-3 py-2 border rounded-md dark:bg-slate-900 dark:border-slate-700 dark:text-white" />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Alert Level (Min Stock)</label>
              <input type="number" step="0.01" {...register('alertLevel')} className="w-full px-3 py-2 border rounded-md dark:bg-slate-900 dark:border-slate-700 dark:text-white" />
            </div>

            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Description</label>
              <textarea {...register('description')} rows="2" className="w-full px-3 py-2 border rounded-md dark:bg-slate-900 dark:border-slate-700 dark:text-white" />
            </div>
          </CardContent>
        </Card>

        <div className="mt-6 flex space-x-4">
          <button type="submit" disabled={mutation.isPending} className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md font-medium">
            {mutation.isPending ? 'Submitting...' : 'Submit'}
          </button>
          <button type="button" onClick={() => navigate('/setup/raw-material')} className="px-6 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-md font-medium">
            Back
          </button>
        </div>
      </form>
    </div>
  );
}