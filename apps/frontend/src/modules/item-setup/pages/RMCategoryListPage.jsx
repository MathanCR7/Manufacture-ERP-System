import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import Swal from 'sweetalert2';
import { Edit, Trash2, Plus, Search, Tag, ArrowLeft, Save, Loader2, AlertCircle, Check, AlertTriangle } from 'lucide-react';
import { api } from '@/lib/axios';
import useAuthStore from '@/app/store/authStore';

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Pagination } from '@/components/ui/Pagination';
import { Button } from '@/components/ui/button';

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
        className={`w-4 h-4 rounded-lg border flex items-center justify-center transition-all duration-155 group-hover:scale-105 shadow-3xs relative ${
          checked
            ? 'bg-indigo-650 border-indigo-650'
            : indeterminate
            ? 'bg-indigo-500 border-indigo-500'
            : 'border-slate-300 dark:border-slate-750 bg-white dark:bg-slate-900 group-hover:border-indigo-500'
        }`}
      >
        {checked ? (
          <Check className="w-3 text-white" strokeWidth={4} />
        ) : indeterminate ? (
          <div className="w-2 h-0.5 bg-white rounded-full"></div>
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
        html: `<p class="text-xs text-slate-550 dark:text-slate-400 mt-1">${err.response?.data?.message || 'Failed to save raw material category.'}</p>`,
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
    <div className="w-full max-w-full px-4 sm:px-6 lg:px-8 py-5 space-y-4 mx-auto transition-all duration-300">
      <div className="flex items-center gap-3 pb-3 border-b border-slate-205 dark:border-slate-800">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onBack}
          className="p-2 rounded-full border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors h-8 w-8 text-slate-500"
        >
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            {isEditMode ? 'Edit Raw Material Category' : 'Add Raw Material Category'}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
            Configure categorisations to structure your factory raw materials.
          </p>
        </div>
      </div>
      
      <form onSubmit={handleSubmit(handleFormSubmit)}>
        <Card className="bg-white dark:bg-slate-900 border border-slate-205 dark:border-slate-805 rounded-2xl shadow-xs overflow-visible text-xs">
          <CardHeader className="px-5 pt-4 pb-0">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              <Tag className="w-4 h-4 text-indigo-500" />
              Category Details
            </div>
          </CardHeader>
          <CardContent className="p-5 space-y-4 text-xs">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5 relative">
                <label className="text-[10px] font-extrabold text-slate-500 uppercase">Category Name <span className="text-rose-500">*</span></label>
                <input
                  {...register('name', { 
                    required: 'Category name is required',
                    onChange: (e) => {
                      e.target.value = e.target.value.toUpperCase();
                    }
                  })}
                  style={{ textTransform: 'uppercase' }}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl dark:bg-slate-950 dark:border-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 font-semibold text-xs h-9"
                  placeholder="E.G. FLOURS, SWEETENERS, SPICES"
                  maxLength={50}
                  autoFocus
                />
                {errors.name && <span className="text-3xs text-rose-500 font-bold block">{errors.name.message}</span>}

                {/* Live Duplicate Warning Panel */}
                {nameMatches.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-amber-50 dark:bg-amber-955/20 border border-amber-200 dark:border-amber-900 rounded-xl p-3 shadow-md flex items-start gap-2.5 animate__animated animate__fadeIn">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-[10px] font-bold text-amber-800">Similar categories exist:</p>
                      <ul className="list-disc pl-4 mt-0.5 space-y-0.5 text-3xs text-amber-700 font-medium">
                        {nameMatches.slice(0, 3).map(m => (
                          <li key={m.id}>{m.name}</li>
                        ))}
                        {nameMatches.length > 3 && <li>and {nameMatches.length - 3} more...</li>}
                      </ul>
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-extrabold text-slate-500 uppercase">Description</label>
                <input
                  {...register('description')}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl dark:bg-slate-950 dark:border-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 font-semibold text-xs h-9"
                  placeholder="Describe category cost routing rules..."
                  maxLength={150}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="mt-4 flex space-x-3">
          <Button 
            type="submit" 
            disabled={mutation.isPending}
            className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-md font-bold text-xs cursor-pointer h-9"
          >
            {mutation.isPending ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-1.5" />}
            Save Category
          </Button>
          <Button 
            type="button" 
            onClick={onBack}
            className="px-6 py-2 bg-rose-600 hover:bg-rose-700 dark:bg-rose-700 dark:hover:bg-rose-800 text-white rounded-xl shadow-md font-bold text-xs cursor-pointer h-9 transition-colors"
          >
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}

export default function RMCategoryListPage() {
  const user = useAuthStore(s => s.user);
  const canEdit = ['MAIN_MASTER', 'LAB_ASSISTANT'].includes(user?.role);

  const [view, setView] = useState('list'); // list | add | edit
  const [editId, setEditId] = useState(null);

  const [searchTerm, setSearchTerm] = useState('');
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
      // Remove deleted ID from selection
      setSelectedIds(prev => prev.filter(selectedId => selectedId !== editId));
    }
  });

  const handleDelete = (id) => {
    const isDark = document.documentElement.classList.contains('dark');
    Swal.fire({
      title: 'Are you sure?',
      text: "You won't be able to revert this! All mapped raw materials will lose their category association.",
      icon: 'warning',
      iconColor: '#f59e0b',
      showCancelButton: true,
      confirmButtonText: 'Yes, delete it!',
      cancelButtonText: 'No, cancel!',
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#64748b',
      background: isDark ? '#1e293b' : '#ffffff',
      color: isDark ? '#f8fafc' : '#0f172a',
      customClass: {
        popup: 'rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 select-none animate__animated animate__fadeInDown animate__faster',
        confirmButton: 'px-6 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-semibold transition-all mr-2',
        cancelButton: 'px-6 py-2.5 bg-slate-600 hover:bg-slate-700 text-white rounded-xl font-semibold transition-all'
      },
      buttonsStyling: false
    }).then((result) => {
      if (result.isConfirmed) {
        deleteMutation.mutate(id);
        
        Swal.fire({
          title: `<span class="font-extrabold text-sm text-slate-800 dark:text-slate-100">Category Deleted</span>`,
          html: `<p class="text-xs text-slate-500 dark:text-slate-400 mt-1">Raw material category has been deleted successfully.</p>`,
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
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    const isDark = document.documentElement.classList.contains('dark');
    const result = await Swal.fire({
      title: 'Bulk Delete Categories?',
      text: `You are about to delete ${selectedIds.length} raw material categories. This operation is permanent!`,
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
        popup: 'rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 select-none animate__animated animate__fadeInDown animate__faster',
        confirmButton: 'px-6 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-semibold transition-all mr-2',
        cancelButton: 'px-6 py-2.5 bg-slate-600 hover:bg-slate-700 text-white rounded-xl font-semibold transition-all'
      },
      buttonsStyling: false
    });

    if (result.isConfirmed) {
      try {
        await Promise.all(selectedIds.map(id => api.delete(`/item-setup/rm-category/${id}`)));
        setSelectedIds([]);
        queryClient.invalidateQueries({ queryKey: ['rm-categories'] });
        
        Swal.fire({
          title: `<span class="font-extrabold text-sm text-slate-800 dark:text-slate-100">Bulk Deletion Successful</span>`,
          html: `<p class="text-xs text-slate-500 dark:text-slate-400 mt-1">Categories deleted and associations removed.</p>`,
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

  const filtered = categories.filter(item =>
    item.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const visibleIds = paginated.map(item => item.id);
  const isAllVisibleSelected = visibleIds.length > 0 && visibleIds.every(id => selectedIds.includes(id));
  const isSomeVisibleSelected = visibleIds.some(id => selectedIds.includes(id)) && !isAllVisibleSelected;

  if (view !== 'list') {
    return <RMCategoryForm editId={canEdit ? editId : null} onBack={() => { setView('list'); setEditId(null); }} />;
  }

  return (
    <div className="w-full max-w-full px-4 sm:px-6 lg:px-8 py-5 space-y-4 mx-auto transition-all duration-300">
      {!canEdit && (
        <div className="flex items-center gap-3 p-4 bg-amber-50 dark:bg-amber-955/20 border border-amber-200 dark:border-amber-900/50 rounded-2xl text-amber-800 dark:text-amber-300 text-sm font-medium mb-4">
          <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
          <span>You have <strong>Read-Only access</strong> to Raw Material Categories. Modifying categories is restricted.</span>
        </div>
      )}
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-slate-205 dark:border-slate-800">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center">
            <Tag className="w-5.5 h-5.5 mr-2 text-indigo-650 shrink-0" />
            Raw Material Categories
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
            Organise raw materials into categories for production routing and inventory.
          </p>
        </div>
        {canEdit && (
          <button
            onClick={() => { setEditId(null); setView('add'); }}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md transition-colors h-9 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Add Category
          </button>
        )}
      </div>

      {/* Premium selection banner */}
      {canEdit && selectedIds.length > 0 && (
        <div className="bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-150 dark:border-indigo-900 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm animate__animated animate__fadeIn">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-indigo-600 text-white font-bold text-sm shadow-md shadow-indigo-500/20">
              {selectedIds.length}
            </div>
            <div>
              <p className="text-xs font-bold text-slate-900 dark:text-white">Categories Selected</p>
              <p className="text-3xs text-slate-550 dark:text-slate-400">Perform bulk actions on the selected raw material categories.</p>
            </div>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              onClick={() => setSelectedIds([])}
              className="px-3 py-1.5 text-xs font-semibold text-slate-606 dark:text-slate-350 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all border border-slate-200 dark:border-slate-700"
            >
              Clear Selection
            </button>
            <button
              onClick={() => handleBulkDelete(false)}
              className="flex items-center px-3 py-1.5 bg-red-650 hover:bg-red-755 text-white rounded-xl text-xs font-bold transition-all shadow-sm"
            >
              <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Delete Selected ({selectedIds.length})
            </button>
          </div>
        </div>
      )}

      {/* Table Card */}
      <Card className="bg-white dark:bg-slate-900 border border-slate-205 dark:border-slate-805 rounded-2xl shadow-xs overflow-hidden flex flex-col text-xs">
        <CardContent className="p-0">
          {/* Toolbar */}
          <div className="px-4 py-3 flex flex-wrap items-center justify-end border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/20">
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search categories…"
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-xs dark:bg-slate-950 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 h-9"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <Table className="text-xs">
              <TableHeader className="bg-slate-50 dark:bg-slate-950 text-slate-505 dark:text-slate-455 font-bold border-b border-slate-200 dark:border-slate-800 uppercase tracking-widest">
                <TableRow className="dark:border-slate-800">
                  {canEdit && (
                    <TableHead className="w-[50px] text-center">
                      <TableCheckbox
                        checked={isAllVisibleSelected}
                        indeterminate={isSomeVisibleSelected}
                        onChange={() => handleSelectAll(paginated)}
                      />
                    </TableHead>
                  )}
                  <TableHead className="py-3">Category Name</TableHead>
                  <TableHead className="py-3">Description</TableHead>
                  {canEdit && <TableHead className="py-3 text-right w-24">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-12 text-slate-400">Loading categories...</TableCell>
                  </TableRow>
                ) : paginated.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-12 text-slate-400 bg-slate-50/10 font-semibold">
                      No categories found. Get started by clicking "Add Category"!
                    </TableCell>
                  </TableRow>
                ) : (
                  paginated.map((item) => (
                    <TableRow key={item.id} className="hover:bg-slate-50/40 dark:hover:bg-slate-805/20 transition-colors border-b border-slate-105 dark:border-slate-800 last:border-none">
                      {canEdit && (
                        <TableCell className="text-center">
                          <TableCheckbox
                            checked={selectedIds.includes(item.id)}
                            onChange={() => handleSelectRow(item.id)}
                          />
                        </TableCell>
                      )}
                      <TableCell className="py-3.5">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-500/15 flex items-center justify-center">
                            <Tag className="w-3.5 h-3.5 text-indigo-500" />
                          </div>
                          <span className="font-bold text-slate-900 dark:text-slate-200">
                            {item.name}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-slate-550 dark:text-slate-400 max-w-xs truncate font-semibold">
                        {item.description || <span className="italic text-slate-400 font-medium">—</span>}
                      </TableCell>
                      {canEdit && (
                        <TableCell className="text-right whitespace-nowrap">
                          <div className="flex items-center justify-end space-x-1">
                            <button 
                              onClick={() => { setEditId(item.id); setView('edit'); }} 
                              className="p-1 rounded-lg text-indigo-500 hover:text-indigo-650 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 transition-colors"
                              title="Edit"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => handleDelete(item.id)} 
                              className="p-1 rounded-lg text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Footer info & Pagination Controls */}
          {totalPages > 1 && (
            <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/20 dark:bg-slate-900/20 flex flex-col sm:flex-row justify-between items-center gap-3">
              <div className="text-[11px] text-slate-555 dark:text-slate-400 font-medium order-2 sm:order-1">
                Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filtered.length)} of {filtered.length} entries
              </div>

              <div className="order-1 sm:order-2">
                <Pagination 
                  currentPage={currentPage} 
                  totalPages={totalPages} 
                  onPageChange={setCurrentPage} 
                />
              </div>

              <div className="text-xs text-slate-404 font-medium order-3">
                Total entries: {filtered.length} records
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
