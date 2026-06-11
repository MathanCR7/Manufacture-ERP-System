import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import Swal from 'sweetalert2';
import { Edit, Trash2, Plus, Search, Tag, ArrowLeft, Save, Loader2, AlertCircle, Check } from 'lucide-react';
import { api } from '@/lib/axios';

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';

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
        className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all duration-155 group-hover:scale-105 shadow-sm relative ${
          checked
            ? 'bg-indigo-600 border-indigo-600'
            : indeterminate
            ? 'bg-indigo-500 border-indigo-500'
            : 'border-slate-300 dark:border-slate-750 bg-white dark:bg-slate-900 group-hover:border-indigo-500'
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

function RMCategoryForm({ editId, onBack }) {
  const isEditMode = !!editId;
  const queryClient = useQueryClient();

  const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm();

  const nameValue = watch('name') || '';
  const [debouncedName, setDebouncedName] = useState('');
  const [nameMatches, setNameMatches] = useState([]);

  // Debounce input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedName(nameValue);
    }, 300);
    return () => clearTimeout(handler);
  }, [nameValue]);

  // Query similar categories
  useEffect(() => {
    if (debouncedName.trim().length >= 1) {
      api.get('/item-setup/rm-category')
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

  const { data: existingData, isLoading: isFetching } = useQuery({
    queryKey: ['rm-category', editId],
    queryFn: async () => {
      const response = await api.get(`/item-setup/rm-category/${editId}`);
      return response.data;
    },
    enabled: isEditMode
  });

  useEffect(() => {
    if (existingData) reset(existingData);
  }, [existingData, reset]);

  const handleFormSubmit = async (data) => {
    const isDark = document.documentElement.classList.contains('dark');
    
    // Warn if duplicate exists
    const duplicate = nameMatches.find(cat => cat.name.toLowerCase() === data.name.toLowerCase());
    if (duplicate) {
      const result = await Swal.fire({
        title: '<span class="font-extrabold text-sm text-slate-800 dark:text-slate-100">Duplicate Category Name</span>',
        html: `<p class="text-xs text-slate-505 dark:text-slate-400 mt-1">A Raw Material Category named <strong>"${data.name}"</strong> already exists. Do you want to proceed and save it anyway?</p>`,
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

  const mutation = useMutation({
    mutationFn: async (data) => {
      if (isEditMode) return (await api.put(`/item-setup/rm-category/${editId}`, data)).data;
      return (await api.post('/item-setup/rm-category', data)).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rm-categories'] });
      const isDark = document.documentElement.classList.contains('dark');
      Swal.fire({
        title: `<span class="font-extrabold text-sm text-slate-800 dark:text-slate-100">${isEditMode ? 'Category Updated!' : 'Category Created!'}</span>`,
        html: `<p class="text-xs text-slate-500 dark:text-slate-400 mt-1">${isEditMode ? 'Raw Material Category has been updated successfully.' : 'Raw Material Category has been configured successfully.'}</p>`,
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
        html: `<p class="text-xs text-slate-505 dark:text-slate-400 mt-1">${err.response?.data?.message || 'Failed to save raw material category.'}</p>`,
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
          popup: 'rounded-2xl border border-red-100 dark:border-red-955 shadow-xl backdrop-blur-md p-4',
          timerProgressBar: 'bg-red-500'
        }
      });
    }
  });

  if (isEditMode && isFetching) return <div className="space-y-6"><Skeleton className="h-8 w-64" /><Skeleton className="h-[400px] w-full" /></div>;

  return (
    <div className="space-y-6 max-w-3xl">
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
            {isEditMode ? 'Edit Raw Material Category' : 'Add Raw Material Category'}
          </h1>
          <p className="text-sm text-slate-550 dark:text-slate-400 mt-0.5">
            Configure categorisations to structure your factory raw materials.
          </p>
        </div>
      </div>
      
      <form onSubmit={handleSubmit(handleFormSubmit)}>
        <Card className="dark:bg-[#111827] dark:border-slate-800 relative !overflow-visible">
          <CardHeader className="px-6 pt-5 pb-0">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
              <Tag className="w-4 h-4 text-indigo-500" />
              Category Details
            </div>
          </CardHeader>
          <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6 relative !overflow-visible">
            <div className="space-y-2 relative">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Name <span className="text-red-500">*</span></label>
              <input 
                {...register('name', { required: true })} 
                className="w-full px-3 py-2.5 border rounded-lg dark:bg-slate-900 dark:border-slate-755 dark:text-white bg-white border-slate-250 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" 
                placeholder="Category Name" 
                autoComplete="off"
              />
              {errors.name && <span className="text-xs text-red-500">Name is required</span>}
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
                        <span className="font-semibold text-slate-855 dark:text-slate-300">{cat.name}</span>
                        <span className="font-mono text-3xs px-1.5 py-0.5 bg-slate-105 dark:bg-slate-800 text-slate-500 dark:text-slate-450 rounded border dark:border-slate-700">Existing</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Description</label>
              <input 
                {...register('description')} 
                className="w-full px-3 py-2.5 border rounded-lg dark:bg-slate-900 dark:border-slate-755 dark:text-white bg-white border-slate-250 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" 
                placeholder="Description" 
              />
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
                {isEditMode ? 'Update Category' : 'Save Category'}
              </>
            )}
          </button>
          <button 
            type="button" 
            onClick={onBack} 
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-slate-105 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-705 dark:text-slate-300 rounded-lg font-medium text-sm transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
        </div>
      </form>
    </div>
  );
}

export default function RMCategoryListPage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [view, setView] = useState('list'); // 'list' | 'add' | 'edit'
  const [editId, setEditId] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const itemsPerPage = 10;

  const { data: categories, isLoading } = useQuery({
    queryKey: ['rm-categories'],
    queryFn: async () => (await api.get('/item-setup/rm-category')).data
  });

  const deleteMutation = useMutation({
    mutationFn: async ({ id, force }) => {
      const url = `/item-setup/rm-category/${id}${force ? '?force=true' : ''}`;
      return (await api.delete(url)).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rm-categories'] });
    }
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async ({ ids, force }) => {
      await Promise.all(ids.map(id => api.delete(`/item-setup/rm-category/${id}${force ? '?force=true' : ''}`)));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rm-categories'] });
      setSelectedIds([]);
    }
  });

  const handleDelete = (id, force = false) => {
    const isDark = document.documentElement.classList.contains('dark');
    
    if (force) {
      deleteMutation.mutate({ id, force: true }, {
        onSuccess: () => {
          Swal.fire({
            title: '<span class="font-extrabold text-sm text-slate-800 dark:text-slate-100">Deleted!</span>',
            html: '<p class="text-xs text-slate-500 dark:text-slate-400 mt-1">The category and all its raw materials have been deleted.</p>',
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
            html: `<p class="text-xs text-slate-505 dark:text-slate-400 mt-1">${err.response?.data?.message || 'Could not delete category items.'}</p>`,
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
      title: '<span class="font-extrabold text-sm text-slate-800 dark:text-slate-100">Delete Category?</span>',
      html: '<p class="text-xs text-slate-505 dark:text-slate-400 mt-1">Are you sure you want to delete this category? This action cannot be undone.</p>',
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
              html: '<p class="text-xs text-slate-505 dark:text-slate-400 mt-1">The raw material category has been deleted.</p>',
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
              const rawMaterials = err.response.data.rawMaterials || [];
              const rmListHtml = rawMaterials.map(rm => `<li class="py-0.5 font-medium">${rm.name} (${rm.code})</li>`).join('');
              
              Swal.fire({
                title: '<span class="font-extrabold text-sm text-slate-850 dark:text-slate-100 text-left">Category In Use</span>',
                html: `<div class="text-xs text-slate-505 dark:text-slate-400 text-left mt-2">
                         <p>This category is currently in use by the following raw materials:</p>
                         <ul class="list-disc list-inside mt-2 max-h-32 overflow-y-auto bg-slate-50 dark:bg-slate-905/50 p-2 rounded-lg border border-slate-100 dark:border-slate-800">
                           ${rmListHtml}
                         </ul>
                         <p class="mt-3 font-semibold text-rose-500">Are you sure you want to delete this category AND delete all of its raw materials? This action cannot be undone.</p>
                       </div>`,
                icon: 'warning',
                iconColor: '#ef4444',
                showCancelButton: true,
                confirmButtonColor: '#ef4444',
                cancelButtonColor: '#64748b',
                confirmButtonText: 'Yes, delete all raw materials & category!',
                cancelButtonText: 'Cancel',
                background: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)',
                color: isDark ? '#f8fafc' : '#0f172a',
                customClass: {
                  popup: 'rounded-2xl border border-rose-100 dark:border-rose-950 shadow-xl backdrop-blur-md p-6'
                }
              }).then((confirmRes) => {
                if (confirmRes.isConfirmed) {
                  handleDelete(id, true);
                }
              });
            } else {
              Swal.fire({
                title: '<span class="font-extrabold text-sm text-slate-800 dark:text-slate-100">Deletion Failed</span>',
                html: `<p class="text-xs text-slate-505 dark:text-slate-400 mt-1">${err.response?.data?.message || 'Could not delete category.'}</p>`,
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
            html: '<p class="text-xs text-slate-550 dark:text-slate-400 mt-1">Selected categories and all referencing raw materials have been deleted.</p>',
            icon: 'success',
            iconColor: '#10b981',
            toast: true,
            position: 'top-end',
            showConfirmButton: false,
            timer: 3500,
            background: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)',
            color: isDark ? '#f8fafc' : '#0f172a',
            customClass: {
              popup: 'rounded-2xl border border-emerald-100 dark:border-emerald-955 shadow-xl backdrop-blur-md p-4'
            }
          });
        },
        onError: (err) => {
          Swal.fire({
            title: '<span class="font-extrabold text-sm text-slate-800 dark:text-slate-100">Operation Failed</span>',
            html: `<p class="text-xs text-slate-505 dark:text-slate-400 mt-1">${err.response?.data?.message || 'Failed to delete selected items.'}</p>`,
            icon: 'error',
            iconColor: '#ef4444',
            background: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)',
            color: isDark ? '#f8fafc' : '#0f172a',
            customClass: {
              popup: 'rounded-2xl border border-red-100 dark:border-red-955 shadow-xl backdrop-blur-md p-6'
            }
          });
        }
      });
      return;
    }

    Swal.fire({
      title: '<span class="font-extrabold text-sm text-slate-800 dark:text-slate-100">Bulk Delete Categories?</span>',
      html: `<p class="text-xs text-slate-505 dark:text-slate-400 mt-1">Are you sure you want to delete the ${selectedIds.length} selected raw material categories? This action cannot be undone.</p>`,
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
              html: '<p class="text-xs text-slate-505 dark:text-slate-400 mt-1">Selected categories have been deleted successfully.</p>',
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
              const rawMaterials = err.response.data.rawMaterials || [];
              const rmListHtml = rawMaterials.map(rm => `<li class="py-0.5 font-medium">${rm.name} (${rm.code})</li>`).join('');
              
              Swal.fire({
                title: '<span class="font-extrabold text-sm text-slate-850 dark:text-slate-100 text-left">Categories In Use</span>',
                html: `<div class="text-xs text-slate-505 dark:text-slate-400 text-left mt-2">
                         <p>One or more of the selected categories are currently in use by these raw materials:</p>
                         <ul class="list-disc list-inside mt-2 max-h-32 overflow-y-auto bg-slate-50 dark:bg-slate-905/50 p-2 rounded-lg border border-slate-100 dark:border-slate-800">
                           ${rmListHtml}
                         </ul>
                         <p class="mt-3 font-semibold text-rose-500">Are you sure you want to delete these categories AND delete all of their referencing raw materials? This action cannot be undone.</p>
                       </div>`,
                icon: 'warning',
                iconColor: '#ef4444',
                showCancelButton: true,
                confirmButtonColor: '#ef4444',
                cancelButtonColor: '#64748b',
                confirmButtonText: 'Yes, delete all raw materials & categories!',
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
                html: `<p class="text-xs text-slate-505 dark:text-slate-400 mt-1">${err.response?.data?.message || 'Failed to delete selected categories.'}</p>`,
                icon: 'error',
                iconColor: '#ef4444',
                background: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)',
                color: isDark ? '#f8fafc' : '#0f172a',
                customClass: {
                  popup: 'rounded-2xl border border-red-100 dark:border-red-955 shadow-xl backdrop-blur-md p-6'
                }
              });
            }
          }
        });
      }
    });
  };

  const filtered = categories?.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (c.description || '').toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];
  const totalPages = Math.max(1, Math.ceil(filtered.length / itemsPerPage));
  const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const isAllVisibleSelected = paginated.length > 0 && paginated.every(item => selectedIds.includes(item.id));
  const isSomeVisibleSelected = paginated.some(item => selectedIds.includes(item.id)) && !isAllVisibleSelected;

  if (isLoading) return <div className="p-8"><Skeleton className="h-[400px] w-full" /></div>;

  if (view !== 'list') {
    return <RMCategoryForm editId={editId} onBack={() => setView('list')} />;
  }

  return (
    <div className="space-y-6">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Raw Material Categories
          </h1>
          <p className="text-sm text-slate-505 dark:text-slate-400 mt-0.5">
            Organise raw materials into categories for production routing and inventory.
          </p>
        </div>
        <button
          onClick={() => { setEditId(null); setView('add'); }}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold shadow-sm transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Category
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
              <p className="text-sm font-bold text-slate-900 dark:text-white">Categories Selected</p>
              <p className="text-xs text-slate-550 dark:text-slate-400">Perform bulk actions on the selected raw material categories.</p>
            </div>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              onClick={() => setSelectedIds([])}
              className="px-4 py-2 text-xs font-semibold text-slate-606 dark:text-slate-350 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all border border-slate-200 dark:border-slate-700"
            >
              Clear Selection
            </button>
            <button
              onClick={() => handleBulkDelete(false)}
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
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search categories…"
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                className="w-full pl-9 pr-4 py-2 border border-slate-205 dark:border-slate-700 rounded-lg text-sm dark:bg-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-55 dark:bg-slate-800/50">
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
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-16 text-slate-400 dark:text-slate-500">
                      No categories found. Get started by clicking "Add Category"!
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
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-indigo-55 dark:bg-indigo-500/15 flex items-center justify-center">
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
                      <TableCell className="text-right">
                        <div className="inline-flex items-center gap-1">
                          <button 
                            onClick={() => { setEditId(item.id); setView('edit'); }} 
                            className="p-2 rounded-lg text-emerald-600 hover:bg-emerald-55 dark:hover:bg-emerald-500/10 transition-colors"
                            title="Edit"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => handleDelete(item.id)} 
                            className="p-2 rounded-lg text-red-500 hover:bg-red-55 dark:hover:bg-red-500/10 transition-colors"
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

          <div className="px-4 py-3 border-t dark:border-slate-700 flex flex-wrap items-center justify-between gap-2 text-sm text-slate-550">
            <span>Showing {filtered.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filtered.length)} of {filtered.length} entries</span>
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
