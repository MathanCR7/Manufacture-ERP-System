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

function NonInventoryItemForm({ editId, onBack }) {
  const isEditMode = !!editId;
  const queryClient = useQueryClient();

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm({
    defaultValues: { unitId: 'pcs', ratePerUnit: 0, code: '' }
  });

  const selectedUom = watch('unitId');

  // Fetch all non-inventory items to determine the next code (used only in Add mode)
  const { data: allNonInventoryItems, isLoading: isLoadingAll } = useQuery({
    queryKey: ['non-inventory-items-list'],
    queryFn: async () => (await api.get('/item-setup/non-inventory-item')).data,
    enabled: !isEditMode
  });

  const [debouncedName, setDebouncedName] = useState('');
  const [nameMatches, setNameMatches] = useState([]);
  const nameValue = watch('name') || '';

  // Debounce name search input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedName(nameValue);
    }, 300);
    return () => clearTimeout(handler);
  }, [nameValue]);

  // Query/Search for existing items
  useEffect(() => {
    if (debouncedName.trim().length >= 1) {
      api.get('/item-setup/non-inventory-item')
        .then(res => {
          const list = res.data || [];
          const matches = list.filter(item => 
            item.name.toLowerCase().includes(debouncedName.toLowerCase()) && 
            item.id !== editId
          );
          setNameMatches(matches);
        })
        .catch(err => console.error(err));
    } else {
      setNameMatches([]);
    }
  }, [debouncedName, editId]);

  // Auto-generate next code in Add mode with NI-0000001 (7 digit pad)
  useEffect(() => {
    if (!isEditMode && allNonInventoryItems) {
      let nextCode;
      if (allNonInventoryItems.length === 0) {
        nextCode = 'NI-0000002';
      } else {
        let maxNum = 0;
        allNonInventoryItems.forEach(item => {
          const match = item.code && item.code.match(/^NI-(\d+)$/);
          if (match) {
            const num = parseInt(match[1], 10);
            if (num > maxNum) maxNum = num;
          }
        });
        nextCode = `NI-${String(maxNum + 1).padStart(7, '0')}`;
      }
      setValue('code', nextCode);
    }
  }, [allNonInventoryItems, isEditMode, setValue]);

  const { data: existingData, isLoading: isFetching } = useQuery({
    queryKey: ['non-inventory-item', editId],
    queryFn: async () => (await api.get(`/item-setup/non-inventory-item/${editId}`)).data,
    enabled: isEditMode
  });

  useEffect(() => {
    if (existingData) reset(existingData);
  }, [existingData, reset]);

  const mutation = useMutation({
    mutationFn: async (data) => {
      data.ratePerUnit = parseFloat(data.ratePerUnit) || 0;
      if (isEditMode) return (await api.put(`/item-setup/non-inventory-item/${editId}`, data)).data;
      return (await api.post('/item-setup/non-inventory-item', data)).data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['non-inventory-items'] });
      const isDark = document.documentElement.classList.contains('dark');
      Swal.fire({
        title: `<span class="font-extrabold text-sm text-slate-800 dark:text-slate-100">${isEditMode ? 'Item Updated!' : 'Item Configured!'}</span>`,
        html: `<p class="text-xs text-slate-500 dark:text-slate-400 mt-1">${isEditMode ? `Non-inventory item "${data.name}" has been updated.` : `Non-inventory item "${data.name}" has been added with code ${data.code}.`}</p>`,
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
        html: `<p class="text-xs text-slate-500 dark:text-slate-400 mt-1">${err.response?.data?.message || 'Failed to save non-inventory item configuration.'}</p>`,
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

  const handleFormSubmit = async (data) => {
    const isDark = document.documentElement.classList.contains('dark');
    
    // Warn if duplicate exists
    const duplicate = nameMatches.find(item => item.name.toLowerCase() === data.name.toLowerCase());
    if (duplicate) {
      const result = await Swal.fire({
        title: '<span class="font-extrabold text-sm text-slate-800 dark:text-slate-100">Duplicate Name Detected</span>',
        html: `<p class="text-xs text-slate-500 dark:text-slate-400 mt-1">A Non-Inventory item named <strong>"${data.name}"</strong> already exists (${duplicate.code}). Do you want to proceed and save it anyway? (UOM or rate may be different)</p>`,
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

  if (isEditMode && isFetching) return <div className="space-y-6"><Skeleton className="h-[400px] w-full" /></div>;
  if (!isEditMode && isLoadingAll) return <div className="space-y-6"><Skeleton className="h-[400px] w-full" /></div>;

  return (
    <div className="space-y-6 max-w-4xl">
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
            {isEditMode ? 'Edit Non-Inventory Item' : 'Add Non-Inventory Item'}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Configure utility, fuel, gas, or labour expense rates.
          </p>
        </div>
      </div>
      
      <form onSubmit={handleSubmit(handleFormSubmit)}>
        <Card className="dark:bg-[#111827] dark:border-slate-800 relative !overflow-visible">
          <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 relative !overflow-visible">
            
            {/* Item Code (Auto-generated & Locked) */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Item Code <span className="text-red-500">*</span>
              </label>
              <input
                {...register('code', { required: true })}
                readOnly
                disabled
                placeholder="Auto-generating..."
                className="w-full px-3 py-2.5 border rounded-lg dark:bg-slate-900 dark:border-slate-700 dark:text-white bg-slate-100 dark:bg-slate-800 cursor-not-allowed text-slate-500 dark:text-slate-400 font-mono text-sm"
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
                    {nameMatches.map(item => (
                      <div
                        key={item.id}
                        onClick={() => {
                          setValue('name', item.name, { shouldValidate: true });
                          setNameMatches([]);
                        }}
                        className="px-4 py-3 flex items-center justify-between hover:bg-indigo-50/70 dark:hover:bg-indigo-950/40 cursor-pointer transition-all duration-200 border-l-2 border-transparent hover:border-indigo-500"
                      >
                        <div className="flex flex-col gap-0.5">
                          <span className="font-semibold text-slate-800 dark:text-slate-250 text-sm">
                            {item.name}
                          </span>
                          <span className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">
                            Category: <span className="text-slate-600 dark:text-slate-450">{item.category || 'N/A'}</span>
                          </span>
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0 ml-4">
                          <span className="font-mono text-[10px] font-bold px-2 py-0.5 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-md border border-indigo-100 dark:border-indigo-900">
                            {item.code}
                          </span>
                          <span className="text-[10px] text-slate-400 dark:text-slate-500 uppercase font-semibold">
                            UOM: {item.unitId || 'N/A'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* UOM Selector (Searchable Dropdown) */}
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

          </CardContent>
        </Card>

        <div className="mt-6 flex space-x-4">
          <button 
            type="submit" 
            disabled={mutation.isPending} 
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium text-sm shadow-sm transition-colors"
          >
            {mutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving…
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Submit
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

export default function NonInventoryItemListPage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [view, setView] = useState('list'); // 'list' | 'add' | 'edit'
  const [editId, setEditId] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const itemsPerPage = 10;

  const { data: items, isLoading } = useQuery({
    queryKey: ['non-inventory-items'],
    queryFn: async () => (await api.get('/item-setup/non-inventory-item')).data
  });

  const deleteMutation = useMutation({
    mutationFn: async ({ id, force }) => {
      const url = `/item-setup/non-inventory-item/${id}${force ? '?force=true' : ''}`;
      return (await api.delete(url)).data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['non-inventory-items'] })
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async ({ ids, force }) => {
      await Promise.all(ids.map(id => api.delete(`/item-setup/non-inventory-item/${id}${force ? '?force=true' : ''}`)));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['non-inventory-items'] });
      setSelectedIds([]);
      const isDark = document.documentElement.classList.contains('dark');
      Swal.fire({
        title: '<span class="font-extrabold text-sm text-slate-800 dark:text-slate-100">Deleted!</span>',
        html: '<p class="text-xs text-slate-500 dark:text-slate-400 mt-1">Selected non-inventory items have been deleted successfully.</p>',
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
            html: '<p class="text-xs text-slate-500 dark:text-slate-400 mt-1">The non-inventory item and its cost references have been deleted.</p>',
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
            html: `<p class="text-xs text-slate-500 dark:text-slate-400 mt-1">${err.response?.data?.message || 'Could not delete item.'}</p>`,
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
      title: '<span class="font-extrabold text-sm text-slate-800 dark:text-slate-100">Delete Item?</span>',
      html: '<p class="text-xs text-slate-500 dark:text-slate-400 mt-1">Are you sure you want to delete this non-inventory item? This action cannot be undone.</p>',
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
        popup: 'rounded-2xl border border-amber-100 dark:border-amber-955 shadow-xl backdrop-blur-md p-6'
      }
    }).then((result) => {
      if (result.isConfirmed) {
        deleteMutation.mutate({ id, force: false }, {
          onSuccess: () => {
            Swal.fire({
              title: '<span class="font-extrabold text-sm text-slate-800 dark:text-slate-100">Deleted!</span>',
              html: '<p class="text-xs text-slate-500 dark:text-slate-400 mt-1">The non-inventory item has been deleted.</p>',
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
              const productCosts = err.response.data.references?.productNonInventoryCosts || [];
              const listHtml = productCosts.map(pc => `<li class="py-0.5 font-medium">Product: ${pc.product?.name || 'N/A'} (${pc.product?.code || 'N/A'}) - Cost: ₹${parseFloat(pc.cost).toFixed(2)}</li>`).join('');

              Swal.fire({
                title: '<span class="font-extrabold text-sm text-slate-850 dark:text-slate-100 text-left">Item In Use</span>',
                html: `<div class="text-xs text-slate-505 dark:text-slate-400 text-left mt-2">
                         <p>This non-inventory item is currently referenced in the cost sheets of the following finished products:</p>
                         <ul class="list-disc list-inside mt-2 max-h-32 overflow-y-auto bg-slate-50 dark:bg-slate-905/50 p-2 rounded-lg border border-slate-100 dark:border-slate-800">
                           ${listHtml}
                         </ul>
                         <p class="mt-3 font-semibold text-rose-500">Are you sure you want to delete this item AND delete its references from all product cost sheets? This action cannot be undone.</p>
                       </div>`,
                icon: 'warning',
                iconColor: '#ef4444',
                showCancelButton: true,
                confirmButtonColor: '#ef4444',
                cancelButtonColor: '#64748b',
                confirmButtonText: 'Yes, delete item & references!',
                cancelButtonText: 'Cancel',
                background: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)',
                color: isDark ? '#f8fafc' : '#0f172a',
                customClass: {
                  popup: 'rounded-2xl border border-rose-100 dark:border-rose-955 shadow-xl backdrop-blur-md p-6'
                }
              }).then((confirmRes) => {
                if (confirmRes.isConfirmed) {
                  handleDelete(id, true);
                }
              });
            } else {
              Swal.fire({
                title: '<span class="font-extrabold text-sm text-slate-800 dark:text-slate-100">Deletion Failed</span>',
                html: `<p class="text-xs text-slate-500 dark:text-slate-400 mt-1">${err.response?.data?.message || 'Could not delete non-inventory item.'}</p>`,
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
            html: '<p class="text-xs text-slate-500 dark:text-slate-400 mt-1">Selected non-inventory items and their product cost references have been deleted.</p>',
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
      title: '<span class="font-extrabold text-sm text-slate-800 dark:text-slate-100">Bulk Delete Items?</span>',
      html: `<p class="text-xs text-slate-500 dark:text-slate-400 mt-1">Are you sure you want to delete the ${selectedIds.length} selected non-inventory items? This action cannot be undone.</p>`,
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
              html: '<p class="text-xs text-slate-500 dark:text-slate-400 mt-1">Selected non-inventory items have been deleted successfully.</p>',
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
                title: '<span class="font-extrabold text-sm text-slate-850 dark:text-slate-100 text-left">Selected Items In Use</span>',
                html: `<div class="text-xs text-slate-505 dark:text-slate-400 text-left mt-2">
                         <p>One or more of the selected non-inventory items are currently referenced in active product cost sheets.</p>
                         <p class="mt-3 font-semibold text-rose-500">Are you sure you want to delete all selected non-inventory items AND delete their references from all product cost sheets? This action cannot be undone.</p>
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
                html: `<p class="text-xs text-slate-500 dark:text-slate-400 mt-1">${err.response?.data?.message || 'Failed to delete selected items.'}</p>`,
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

  const filtered = items?.filter(item => 
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.code.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];
  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const isAllVisibleSelected = paginated.length > 0 && paginated.every(item => selectedIds.includes(item.id));
  const isSomeVisibleSelected = paginated.some(item => selectedIds.includes(item.id)) && !isAllVisibleSelected;

  if (isLoading) return <div className="p-8"><Skeleton className="h-[400px] w-full" /></div>;

  if (view !== 'list') {
    return <NonInventoryItemForm editId={editId} onBack={() => setView('list')} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Non-Inventory Items</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Configure non-inventory service items, direct expenses, and utility rates.
          </p>
        </div>
        <button 
          onClick={() => { setEditId(null); setView('add'); }}
          className="flex items-center px-4 py-2.5 bg-indigo-605 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold transition-all shadow-sm shadow-indigo-500/10"
        >
          <Plus className="w-4 h-4 mr-2" /> Add Item
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
              <p className="text-sm font-bold text-slate-900 dark:text-white">Items Selected</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Perform bulk actions on the selected non-inventory items.</p>
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

      {/* Table Card */}
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
                  <TableHead>UOM</TableHead>
                  <TableHead className="text-right">Rate/Unit (INR)</TableHead>
                  <TableHead className="text-right">Op. Stock</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-12 text-slate-400 dark:text-slate-500">
                      No non-inventory items found. Get started by clicking "Add Item"!
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
                      <TableCell className="text-slate-600 dark:text-slate-400 font-medium">{item.unitId}</TableCell>
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
