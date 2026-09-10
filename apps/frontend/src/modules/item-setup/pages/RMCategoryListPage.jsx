import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import Swal from 'sweetalert2';
import { 
  Edit, 
  Trash2, 
  Plus, 
  Search, 
  Tag, 
  ArrowLeft, 
  Save, 
  Loader2, 
  AlertCircle, 
  Check, 
  AlertTriangle,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Calendar,
  Layers,
  X,
  ChevronDown,
  RotateCcw
} from 'lucide-react';
import { api } from '@/lib/axios';
import useAuthStore from '@/app/store/authStore';

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Pagination } from '@/components/ui/Pagination';
import { Button } from '@/components/ui/button';

// Custom Checkbox Component
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
        className={`w-3.5 h-3.5 rounded border flex items-center justify-center transition-all duration-150 group-hover:scale-105 shadow-3xs relative ${
          checked
            ? 'bg-indigo-600 border-indigo-600 text-white'
            : indeterminate
            ? 'bg-indigo-500 border-indigo-500 text-white'
            : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 group-hover:border-indigo-500'
        }`}
      >
        {checked ? (
          <Check className="w-2.5 h-2.5 text-white" strokeWidth={3.5} />
        ) : indeterminate ? (
          <div className="w-2 h-0.5 bg-white rounded-full"></div>
        ) : null}
      </div>
    </label>
  );
}

// Form Component for Create / Edit
function RMCategoryForm({ editId, onBack }) {
  const isEditMode = !!editId;
  const queryClient = useQueryClient();

  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm();

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
    const duplicate = nameMatches.find(cat => cat.name.toLowerCase() === data.name.trim().toLowerCase());
    if (duplicate) {
      const result = await Swal.fire({
        title: '<span class="font-bold text-sm text-slate-800 dark:text-slate-100">Duplicate Category Name</span>',
        html: `<p class="text-xs text-slate-500 dark:text-slate-400 mt-1">A Raw Material Category named <strong>"${data.name.trim()}"</strong> already exists. Do you want to proceed and save it anyway?</p>`,
        icon: 'warning',
        iconColor: '#f59e0b',
        showCancelButton: true,
        confirmButtonColor: '#4f46e5',
        cancelButtonColor: '#ef4444',
        confirmButtonText: 'Yes, save anyway',
        cancelButtonText: 'Cancel',
        background: isDark ? '#1e293b' : '#ffffff',
        color: isDark ? '#f8fafc' : '#0f172a',
        customClass: {
          popup: 'rounded-2xl border border-amber-100 dark:border-amber-950 shadow-xl p-5'
        }
      });
      if (!result.isConfirmed) {
        return;
      }
    }
    mutation.mutate({
      name: data.name.trim().toUpperCase(),
      description: data.description ? data.description.trim() : ''
    });
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
        title: `<span class="font-bold text-sm text-slate-800 dark:text-slate-100">${isEditMode ? 'Category Updated!' : 'Category Created!'}</span>`,
        html: `<p class="text-xs text-slate-500 dark:text-slate-400 mt-1">${isEditMode ? 'Raw Material Category has been updated successfully.' : 'Raw Material Category has been created successfully.'}</p>`,
        icon: 'success',
        iconColor: '#10b981',
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true,
        background: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)',
        color: isDark ? '#f8fafc' : '#0f172a',
        customClass: {
          popup: 'rounded-xl border border-emerald-100 dark:border-emerald-950 shadow-lg p-3.5',
          timerProgressBar: 'bg-emerald-500'
        }
      });
      onBack();
    },
    onError: (err) => {
      const isDark = document.documentElement.classList.contains('dark');
      Swal.fire({
        title: `<span class="font-bold text-sm text-slate-800 dark:text-slate-100">Operation Failed</span>`,
        html: `<p class="text-xs text-slate-500 dark:text-slate-400 mt-1">${err.response?.data?.message || 'Failed to save raw material category.'}</p>`,
        icon: 'error',
        iconColor: '#ef4444',
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3500,
        timerProgressBar: true,
        background: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)',
        color: isDark ? '#f8fafc' : '#0f172a',
        customClass: {
          popup: 'rounded-xl border border-red-100 dark:border-red-950 shadow-lg p-3.5',
          timerProgressBar: 'bg-red-500'
        }
      });
    }
  });

  if (isEditMode && isFetching) {
    return (
      <div className="w-full max-w-4xl px-3 sm:px-5 py-2.5 space-y-2.5 mx-auto">
        <Skeleton className="h-7 w-48 rounded-lg" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl px-3 sm:px-5 py-2.5 space-y-2.5 mx-auto transition-all duration-200">
      {/* Sleek Header */}
      <div className="flex items-center gap-2 pb-2 border-b border-slate-200 dark:border-slate-800">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onBack}
          className="h-7 w-7 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0"
          title="Back to categories list"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
        </Button>
        <div>
          <h1 className="text-base sm:text-lg font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-1.5">
            <Tag className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
            {isEditMode ? 'Edit Raw Material Category' : 'Add Raw Material Category'}
          </h1>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
            Configure classifications to structure your factory raw materials and inventory routing.
          </p>
        </div>
      </div>
      
      <form onSubmit={handleSubmit(handleFormSubmit)}>
        <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xs overflow-visible">
          <CardHeader className="px-3.5 py-2 border-b border-slate-100 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-950/30">
            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
              Category Information
            </div>
          </CardHeader>
          <CardContent className="p-3.5 space-y-3 text-xs">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1 relative">
                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                  Category Name <span className="text-rose-500">*</span>
                </label>
                <input
                  {...register('name', { 
                    required: 'Category name is required',
                    onChange: (e) => {
                      e.target.value = e.target.value.toUpperCase();
                    }
                  })}
                  style={{ textTransform: 'uppercase' }}
                  className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg dark:bg-slate-950 dark:border-slate-800 dark:text-white focus:outline-none focus:ring-1.5 focus:ring-indigo-500/30 focus:border-indigo-500 font-semibold text-xs h-8 transition-all shadow-3xs"
                  placeholder="E.G. FLOURS, SWEETENERS, PACKAGING"
                  maxLength={50}
                  autoFocus
                />
                {errors.name && <span className="text-[11px] text-rose-500 font-medium block">{errors.name.message}</span>}

                {/* Live Duplicate Warning Panel */}
                {nameMatches.length > 0 && (
                  <div className="absolute z-20 w-full mt-1 bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 rounded-lg p-2.5 shadow-md flex items-start gap-2 animate__animated animate__fadeIn">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-[11px] font-bold text-amber-800 dark:text-amber-300">Similar categories exist:</p>
                      <ul className="list-disc pl-3.5 mt-0.5 space-y-0.5 text-[10px] text-amber-700 dark:text-amber-400 font-medium">
                        {nameMatches.slice(0, 3).map(m => (
                          <li key={m.id}>{m.name}</li>
                        ))}
                        {nameMatches.length > 3 && <li>and {nameMatches.length - 3} more...</li>}
                      </ul>
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                  Description <span className="text-[10px] font-normal text-slate-400">(Optional)</span>
                </label>
                <input
                  {...register('description')}
                  className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg dark:bg-slate-950 dark:border-slate-800 dark:text-white focus:outline-none focus:ring-1.5 focus:ring-indigo-500/30 focus:border-indigo-500 font-medium text-xs h-8 transition-all shadow-3xs"
                  placeholder="Describe category, usage, or production notes..."
                  maxLength={150}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="mt-2.5 flex items-center space-x-2">
          <Button 
            type="submit" 
            disabled={mutation.isPending}
            className="h-8 px-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-xs font-semibold text-xs cursor-pointer inline-flex items-center gap-1.5 transition-colors"
          >
            {mutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            {isEditMode ? 'Update Category' : 'Save Category'}
          </Button>
          <Button 
            type="button" 
            onClick={onBack}
            variant="outline"
            className="h-8 px-3.5 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg font-semibold text-xs cursor-pointer transition-colors"
          >
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}

// Format date helper
function formatDate(dateString) {
  if (!dateString) return '—';
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return '—';
  }
}

export default function RMCategoryListPage() {
  const user = useAuthStore(s => s.user);
  const canEdit = ['MAIN_MASTER', 'LAB_ASSISTANT'].includes(user?.role);

  const [view, setView] = useState('list'); // list | add | edit
  const [editId, setEditId] = useState(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('latest'); // 'latest' | 'oldest' | 'name_asc' | 'name_desc'
  const [selectedIds, setSelectedIds] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const queryClient = useQueryClient();

  const { data: categories = [], isLoading } = useQuery({
    queryKey: ['rm-categories'],
    queryFn: async () => {
      const response = await api.get('/item-setup/rm-category');
      return response.data;
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      await api.delete(`/item-setup/rm-category/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rm-categories'] });
      setSelectedIds(prev => prev.filter(selectedId => selectedId !== editId));
    }
  });

  const handleDelete = (item) => {
    const isDark = document.documentElement.classList.contains('dark');
    const itemCount = item.rawMaterials?.length || 0;
    const warningText = itemCount > 0 
      ? `This category is mapped to ${itemCount} raw material(s). Deleting it will remove the category reference from them.` 
      : "You won't be able to revert this action!";

    Swal.fire({
      title: 'Delete Category?',
      html: `
        <div class="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Are you sure you want to delete <strong class="text-slate-900 dark:text-slate-100">"${item.name}"</strong>?
          <p class="text-amber-600 dark:text-amber-400 font-medium mt-2 text-[11px]">${warningText}</p>
        </div>
      `,
      icon: 'warning',
      iconColor: '#f59e0b',
      showCancelButton: true,
      confirmButtonText: 'Yes, delete',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#64748b',
      background: isDark ? '#1e293b' : '#ffffff',
      color: isDark ? '#f8fafc' : '#0f172a',
      customClass: {
        popup: 'rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl p-5 select-none',
        confirmButton: 'px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold transition-all mr-2',
        cancelButton: 'px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold transition-all'
      },
      buttonsStyling: false
    }).then((result) => {
      if (result.isConfirmed) {
        deleteMutation.mutate(item.id);
        
        Swal.fire({
          title: `<span class="font-bold text-sm text-slate-800 dark:text-slate-100">Category Deleted</span>`,
          html: `<p class="text-xs text-slate-500 dark:text-slate-400 mt-1">"${item.name}" has been deleted successfully.</p>`,
          icon: 'success',
          iconColor: '#10b981',
          toast: true,
          position: 'top-end',
          showConfirmButton: false,
          timer: 3000,
          timerProgressBar: true,
          background: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)',
          color: isDark ? '#f8fafc' : '#0f172a',
          customClass: {
            popup: 'rounded-xl border border-emerald-100 dark:border-emerald-950 shadow-lg p-3.5',
            timerProgressBar: 'bg-emerald-500'
          }
        });
      }
    });
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    const isDark = document.documentElement.classList.contains('dark');
    const result = await Swal.fire({
      title: 'Bulk Delete Categories?',
      html: `<p class="text-xs text-slate-500 dark:text-slate-400 mt-1">You are about to delete <strong>${selectedIds.length}</strong> raw material categories. This operation is permanent!</p>`,
      icon: 'warning',
      iconColor: '#f59e0b',
      showCancelButton: true,
      confirmButtonText: `Delete ${selectedIds.length} categories`,
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#64748b',
      background: isDark ? '#1e293b' : '#ffffff',
      color: isDark ? '#f8fafc' : '#0f172a',
      customClass: {
        popup: 'rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl p-5 select-none',
        confirmButton: 'px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold transition-all mr-2',
        cancelButton: 'px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold transition-all'
      },
      buttonsStyling: false
    });

    if (result.isConfirmed) {
      try {
        await Promise.all(selectedIds.map(id => api.delete(`/item-setup/rm-category/${id}`)));
        setSelectedIds([]);
        queryClient.invalidateQueries({ queryKey: ['rm-categories'] });
        
        Swal.fire({
          title: `<span class="font-bold text-sm text-slate-800 dark:text-slate-100">Bulk Deletion Completed</span>`,
          html: `<p class="text-xs text-slate-500 dark:text-slate-400 mt-1">Selected categories were removed successfully.</p>`,
          icon: 'success',
          iconColor: '#10b981',
          toast: true,
          position: 'top-end',
          showConfirmButton: false,
          timer: 3000,
          timerProgressBar: true,
          background: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)',
          color: isDark ? '#f8fafc' : '#0f172a',
          customClass: {
            popup: 'rounded-xl border border-emerald-100 dark:border-emerald-950 shadow-lg p-3.5',
            timerProgressBar: 'bg-emerald-500'
          }
        });
      } catch (err) {
        console.error(err);
      }
    }
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
      setSelectedIds(prev => {
        const unique = new Set([...prev, ...visibleIds]);
        return Array.from(unique);
      });
    }
  };

  // Filter and Sort Categories
  const sortedAndFiltered = useMemo(() => {
    let result = categories.filter(item => {
      const term = searchTerm.toLowerCase().trim();
      if (!term) return true;
      return (
        (item.name || '').toLowerCase().includes(term) ||
        (item.description || '').toLowerCase().includes(term)
      );
    });

    result.sort((a, b) => {
      if (sortBy === 'latest') {
        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return timeB - timeA;
      }
      if (sortBy === 'oldest') {
        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return timeA - timeB;
      }
      if (sortBy === 'name_asc') {
        return (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' });
      }
      if (sortBy === 'name_desc') {
        return (b.name || '').localeCompare(a.name || '', undefined, { sensitivity: 'base' });
      }
      return 0;
    });

    return result;
  }, [categories, searchTerm, sortBy]);

  const totalPages = Math.ceil(sortedAndFiltered.length / itemsPerPage) || 1;
  const paginated = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return sortedAndFiltered.slice(startIndex, startIndex + itemsPerPage);
  }, [sortedAndFiltered, currentPage, itemsPerPage]);

  const visibleIds = paginated.map(item => item.id);
  const isAllVisibleSelected = visibleIds.length > 0 && visibleIds.every(id => selectedIds.includes(id));
  const isSomeVisibleSelected = visibleIds.some(id => selectedIds.includes(id)) && !isAllVisibleSelected;

  // Header click sorting helper
  const handleToggleSortName = () => {
    if (sortBy === 'name_asc') {
      setSortBy('name_desc');
    } else {
      setSortBy('name_asc');
    }
    setCurrentPage(1);
  };

  const handleToggleSortDate = () => {
    if (sortBy === 'latest') {
      setSortBy('oldest');
    } else {
      setSortBy('latest');
    }
    setCurrentPage(1);
  };

  if (view !== 'list') {
    return <RMCategoryForm editId={canEdit ? editId : null} onBack={() => { setView('list'); setEditId(null); }} />;
  }

  return (
    <div className="w-full px-3 sm:px-4 py-2.5 space-y-2.5 mx-auto transition-all duration-200">
      {/* Read-Only Warning Banner */}
      {!canEdit && (
        <div className="flex items-center gap-2 p-2.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/80 rounded-xl text-amber-800 dark:text-amber-300 text-xs font-medium">
          <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
          <span>You have <strong>Read-Only access</strong> to Raw Material Categories. Modifying categories is restricted.</span>
        </div>
      )}

      {/* Sleek Compact Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-100 dark:border-indigo-800 shadow-3xs shrink-0">
            <Tag className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-bold tracking-tight text-slate-900 dark:text-white">
                Raw Material Categories
              </h1>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 border border-indigo-200/70 dark:border-indigo-800">
                {categories.length} {categories.length === 1 ? 'Category' : 'Categories'}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
              Classify and manage raw materials for bill of materials, inventory, and procurement.
            </p>
          </div>
        </div>

        {canEdit && (
          <Button
            onClick={() => { setEditId(null); setView('add'); }}
            size="sm"
            className="h-8 px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-3xs transition-all cursor-pointer inline-flex items-center gap-1.5 shrink-0 self-start sm:self-auto"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Category
          </Button>
        )}
      </div>

      {/* Bulk Selection Notification Bar */}
      {canEdit && selectedIds.length > 0 && (
        <div className="bg-indigo-50/90 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 rounded-xl px-3 py-1.5 flex items-center justify-between gap-3 shadow-3xs animate__animated animate__fadeIn">
          <div className="flex items-center gap-2 text-xs">
            <span className="w-5 h-5 rounded-md bg-indigo-600 text-white font-bold text-[10px] flex items-center justify-center shadow-3xs">
              {selectedIds.length}
            </span>
            <span className="font-semibold text-slate-800 dark:text-slate-200 text-xs">
              {selectedIds.length} {selectedIds.length === 1 ? 'category' : 'categories'} selected
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setSelectedIds([])}
              className="px-2.5 py-1 text-[11px] font-medium text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800 rounded-lg transition-colors border border-transparent hover:border-slate-200 dark:hover:border-slate-700 cursor-pointer"
            >
              Clear
            </button>
            <button
              onClick={handleBulkDelete}
              className="flex items-center gap-1 px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-[11px] font-semibold transition-colors shadow-3xs cursor-pointer"
            >
              <Trash2 className="w-3 h-3" />
              Delete Selected
            </button>
          </div>
        </div>
      )}

      {/* Main Table Card */}
      <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xs overflow-hidden flex flex-col text-xs">
        <CardContent className="p-0">
          {/* Integrated Pro Toolbar */}
          <div className="px-3 py-2 border-b border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
            {/* Search Input with quick clear */}
            <div className="relative w-full sm:w-64 md:w-72">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search categories or description..."
                value={searchTerm}
                onChange={(e) => { 
                  setSearchTerm(e.target.value); 
                  setCurrentPage(1); 
                }}
                className="w-full pl-8 pr-7 py-1.5 border border-slate-200 dark:border-slate-700/80 rounded-lg text-xs bg-white dark:bg-slate-950 dark:text-white focus:outline-none focus:ring-1.5 focus:ring-indigo-500/30 focus:border-indigo-500 h-8 shadow-3xs transition-all placeholder:text-slate-400"
              />
              {searchTerm && (
                <button
                  onClick={() => { setSearchTerm(''); setCurrentPage(1); }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 rounded-full transition-colors cursor-pointer"
                  title="Clear search"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Sorting & Filter Controls */}
            <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
              {/* Active Filter indicator */}
              {searchTerm && (
                <div className="text-[11px] text-indigo-600 dark:text-indigo-400 font-medium hidden md:inline-flex items-center gap-1">
                  <span>Found {sortedAndFiltered.length} matches</span>
                </div>
              )}

              {/* Sort Dropdown */}
              <div className="relative flex items-center w-full sm:w-auto">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 flex items-center pointer-events-none text-indigo-600 dark:text-indigo-400">
                  <ArrowUpDown className="w-3.5 h-3.5" />
                </span>
                <select
                  value={sortBy}
                  onChange={(e) => {
                    setSortBy(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="h-8 w-full sm:w-52 pl-8 pr-7 text-xs font-semibold border border-slate-200 dark:border-slate-700/80 rounded-lg bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1.5 focus:ring-indigo-500/30 focus:border-indigo-500 appearance-none cursor-pointer transition-all shadow-3xs hover:border-slate-300 dark:hover:border-slate-600"
                  aria-label="Sort options"
                >
                  <option value="latest">Sort: Latest Added (Newest)</option>
                  <option value="oldest">Sort: Oldest First</option>
                  <option value="name_asc">Sort: Alphabetical (A → Z)</option>
                  <option value="name_desc">Sort: Alphabetical (Z → A)</option>
                </select>
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center pointer-events-none text-slate-400">
                  <ChevronDown className="w-3 h-3" />
                </span>
              </div>

              {/* Quick Reset if filters active */}
              {(searchTerm || sortBy !== 'latest') && (
                <button
                  onClick={() => {
                    setSearchTerm('');
                    setSortBy('latest');
                    setCurrentPage(1);
                  }}
                  className="h-8 px-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition-colors flex items-center gap-1 text-[11px] font-medium shrink-0 cursor-pointer"
                  title="Reset filters and sort"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span className="hidden lg:inline">Reset</span>
                </button>
              )}
            </div>
          </div>

          {/* Categories Table */}
          <div className="overflow-x-auto">
            <Table className="text-xs">
              <TableHeader className="bg-slate-50/80 dark:bg-slate-950/80 text-slate-600 dark:text-slate-400 font-bold border-b border-slate-200 dark:border-slate-800 uppercase tracking-wider text-[10px]">
                <TableRow className="border-b border-slate-200 dark:border-slate-800">
                  {canEdit && (
                    <TableHead className="w-9 px-2 text-center py-2">
                      <TableCheckbox
                        checked={isAllVisibleSelected}
                        indeterminate={isSomeVisibleSelected}
                        onChange={() => handleSelectAll(paginated)}
                      />
                    </TableHead>
                  )}
                  <TableHead className="py-2 px-3">
                    <button
                      onClick={handleToggleSortName}
                      className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer select-none"
                      title="Click to sort by name"
                    >
                      <span>Category Name</span>
                      {sortBy === 'name_asc' ? (
                        <ArrowUp className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                      ) : sortBy === 'name_desc' ? (
                        <ArrowDown className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-slate-400 hover:text-slate-600" />
                      )}
                    </button>
                  </TableHead>
                  <TableHead className="py-2 px-3">Description</TableHead>
                  <TableHead className="py-2 px-3 w-28 text-center">Items Mapped</TableHead>
                  <TableHead className="py-2 px-3 w-32">
                    <button
                      onClick={handleToggleSortDate}
                      className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer select-none"
                      title="Click to sort by date"
                    >
                      <span>Created Date</span>
                      {sortBy === 'latest' ? (
                        <ArrowDown className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                      ) : sortBy === 'oldest' ? (
                        <ArrowUp className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-slate-400 hover:text-slate-600" />
                      )}
                    </button>
                  </TableHead>
                  {canEdit && <TableHead className="py-2 px-3 text-right w-20">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, idx) => (
                    <TableRow key={idx} className="border-b border-slate-100 dark:border-slate-800/60">
                      {canEdit && <TableCell className="py-2 px-2 text-center"><Skeleton className="h-3.5 w-3.5 mx-auto rounded" /></TableCell>}
                      <TableCell className="py-2 px-3"><Skeleton className="h-4 w-40 rounded" /></TableCell>
                      <TableCell className="py-2 px-3"><Skeleton className="h-3.5 w-56 rounded" /></TableCell>
                      <TableCell className="py-2 px-3 text-center"><Skeleton className="h-4 w-12 mx-auto rounded" /></TableCell>
                      <TableCell className="py-2 px-3"><Skeleton className="h-3.5 w-20 rounded" /></TableCell>
                      {canEdit && <TableCell className="py-2 px-3 text-right"><Skeleton className="h-6 w-14 ml-auto rounded" /></TableCell>}
                    </TableRow>
                  ))
                ) : paginated.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={canEdit ? 6 : 5} className="text-center py-10 text-slate-400">
                      <div className="flex flex-col items-center justify-center gap-1.5">
                        <Tag className="w-7 h-7 text-slate-300 dark:text-slate-600 stroke-1" />
                        <p className="font-semibold text-xs text-slate-600 dark:text-slate-300">
                          {searchTerm ? `No categories matching "${searchTerm}"` : 'No raw material categories found.'}
                        </p>
                        <p className="text-[11px] text-slate-400">
                          {searchTerm ? 'Try clearing your search term or refining query.' : 'Click "Add Category" above to configure your first category.'}
                        </p>
                        {searchTerm && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => { setSearchTerm(''); setCurrentPage(1); }}
                            className="mt-1.5 h-7 text-xs"
                          >
                            Clear Search
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  paginated.map((item) => {
                    const isSelected = selectedIds.includes(item.id);
                    const itemCount = item.rawMaterials?.length || 0;

                    return (
                      <TableRow 
                        key={item.id} 
                        className={`transition-colors border-b border-slate-100 dark:border-slate-800/70 last:border-none ${
                          isSelected 
                            ? 'bg-indigo-50/50 dark:bg-indigo-950/30' 
                            : 'hover:bg-slate-50/70 dark:hover:bg-slate-800/30'
                        }`}
                      >
                        {canEdit && (
                          <TableCell className="py-2 px-2 text-center">
                            <TableCheckbox
                              checked={isSelected}
                              onChange={() => handleSelectRow(item.id)}
                            />
                          </TableCell>
                        )}
                        <TableCell className="py-2 px-3">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 border border-indigo-100/60 dark:border-indigo-800/60">
                              <Tag className="w-3 h-3" />
                            </div>
                            <span className="font-bold text-slate-900 dark:text-slate-100 tracking-tight text-xs">
                              {item.name}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="py-2 px-3 text-slate-600 dark:text-slate-400 font-normal max-w-sm truncate" title={item.description || ''}>
                          {item.description ? (
                            <span>{item.description}</span>
                          ) : (
                            <span className="text-slate-400 dark:text-slate-600 italic">—</span>
                          )}
                        </TableCell>
                        <TableCell className="py-2 px-3 text-center">
                          <span 
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold border ${
                              itemCount > 0
                                ? 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                                : 'bg-slate-50 dark:bg-slate-900 text-slate-400 dark:text-slate-500 border-slate-200/50 dark:border-slate-800'
                            }`}
                            title={`${itemCount} raw material(s) categorized`}
                          >
                            <Layers className="w-2.5 h-2.5 opacity-60" />
                            {itemCount} {itemCount === 1 ? 'item' : 'items'}
                          </span>
                        </TableCell>
                        <TableCell className="py-2 px-3 text-slate-500 dark:text-slate-400 text-[11px] whitespace-nowrap">
                          <span className="inline-flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-slate-400 shrink-0" />
                            {formatDate(item.createdAt)}
                          </span>
                        </TableCell>
                        {canEdit && (
                          <TableCell className="py-2 px-3 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end space-x-0.5">
                              <button 
                                onClick={() => { setEditId(item.id); setView('edit'); }} 
                                className="p-1 rounded-md text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 transition-colors cursor-pointer"
                                title="Edit Category"
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </button>
                              <button 
                                onClick={() => handleDelete(item)} 
                                className="p-1 rounded-md text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors cursor-pointer"
                                title="Delete Category"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {/* Compact Professional Footer / Pagination */}
          <div className="px-3 py-1.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/30 flex flex-col sm:flex-row justify-between items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
            <div>
              {sortedAndFiltered.length > 0 ? (
                <span>
                  Showing <strong className="text-slate-700 dark:text-slate-200">{(currentPage - 1) * itemsPerPage + 1}</strong> to <strong className="text-slate-700 dark:text-slate-200">{Math.min(currentPage * itemsPerPage, sortedAndFiltered.length)}</strong> of <strong className="text-slate-700 dark:text-slate-200">{sortedAndFiltered.length}</strong> categories
                </span>
              ) : (
                <span>0 categories found</span>
              )}
            </div>

            {totalPages > 1 && (
              <div>
                <Pagination 
                  currentPage={currentPage} 
                  totalPages={totalPages} 
                  onPageChange={setCurrentPage} 
                />
              </div>
            )}

            <div className="text-[10px] text-slate-400 hidden sm:block">
              Page {currentPage} of {totalPages}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
