import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, useWatch } from 'react-hook-form';
import Swal from 'sweetalert2';
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  Tag,
  CreditCard,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Layers,
  Save,
  X,
  Loader2,
  Receipt,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Sparkles
} from 'lucide-react';
import { api } from '@/lib/axios';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Pagination } from '@/components/ui/Pagination';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function ExpenseMasterListPage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(10);
  const [sortField, setSortField] = useState('name');
  const [sortOrder, setSortOrder] = useState('asc');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);

  // React Hook Form for Add/Edit Modal
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    control,
    formState: { errors }
  } = useForm({
    defaultValues: {
      code: '',
      name: '',
      description: '',
      status: 'ACTIVE'
    }
  });

  const currentStatus = useWatch({ control, name: 'status', defaultValue: 'ACTIVE' });

  // Fetch Expense Categories
  const {
    data: categories = [],
    isLoading,
    isRefetching,
    refetch
  } = useQuery({
    queryKey: ['expense-categories'],
    queryFn: async () => {
      const res = await api.get('/item-setup/expense-category');
      return Array.isArray(res.data) ? res.data : [];
    }
  });

  // Open Add Modal
  const handleOpenAddModal = () => {
    setEditingCategory(null);
    reset({
      code: `EXP-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
      name: '',
      description: '',
      status: 'ACTIVE'
    });
    setIsModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (cat) => {
    setEditingCategory(cat);
    reset({
      code: cat.code || '',
      name: cat.name || '',
      description: cat.description || '',
      status: cat.status || 'ACTIVE'
    });
    setIsModalOpen(true);
  };

  // Save / Update Mutation
  const saveMutation = useMutation({
    mutationFn: async (formData) => {
      const payload = {
        code: formData.code ? formData.code.trim().toUpperCase() : undefined,
        name: formData.name ? formData.name.trim() : '',
        description: formData.description ? formData.description.trim() : null,
        status: formData.status || 'ACTIVE'
      };

      if (editingCategory) {
        return (await api.put(`/item-setup/expense-category/${editingCategory.id}`, payload)).data;
      } else {
        return (await api.post('/item-setup/expense-category', payload)).data;
      }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['expense-categories'] });
      setIsModalOpen(false);
      const isDark = document.documentElement.classList.contains('dark');
      Swal.fire({
        title: `<span class="font-bold text-sm text-slate-800 dark:text-slate-100">${editingCategory ? 'Category Updated' : 'Category Created'}</span>`,
        html: `<p class="text-xs text-slate-500 dark:text-slate-400 mt-1">Expense Master category "${data.name || ''}" saved successfully.</p>`,
        icon: 'success',
        iconColor: '#10b981',
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true,
        background: isDark ? '#0f172a' : '#ffffff',
        color: isDark ? '#f8fafc' : '#0f172a',
        customClass: {
          popup: 'rounded-xl border border-emerald-200 dark:border-emerald-900 shadow-lg p-3'
        }
      });
    },
    onError: (err) => {
      const isDark = document.documentElement.classList.contains('dark');
      Swal.fire({
        title: '<span class="text-sm font-bold text-rose-600">Failed to Save Category</span>',
        text: err.response?.data?.message || err.message || 'An error occurred while saving the expense category.',
        icon: 'error',
        background: isDark ? '#0f172a' : '#ffffff',
        color: isDark ? '#f8fafc' : '#0f172a',
        confirmButtonColor: '#6366f1'
      });
    }
  });

  // Delete Mutation with acquired expense detection
  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      return (await api.delete(`/item-setup/expense-category/${id}`)).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expense-categories'] });
      const isDark = document.documentElement.classList.contains('dark');
      Swal.fire({
        title: '<span class="font-bold text-sm text-slate-800 dark:text-slate-100">Category Deleted</span>',
        html: '<p class="text-xs text-slate-500 dark:text-slate-400 mt-1">Expense Master category deleted successfully.</p>',
        icon: 'success',
        iconColor: '#10b981',
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true,
        background: isDark ? '#0f172a' : '#ffffff',
        color: isDark ? '#f8fafc' : '#0f172a'
      });
    },
    onError: (err) => {
      const isDark = document.documentElement.classList.contains('dark');
      const data = err.response?.data;
      const expenses = data?.expenses || [];
      const errorMsg = data?.message || err.message || 'Cannot delete this expense master category.';

      Swal.fire({
        title: '<span class="text-base font-bold text-rose-600 dark:text-rose-400">Cannot Delete Expense Category</span>',
        html: `
          <div class="text-left text-xs space-y-3 mt-2">
            <div class="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 font-medium leading-relaxed">
              ${errorMsg}
            </div>
            ${
              expenses.length > 0
                ? `
              <div class="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Acquired By Expense Records (${data?.count || expenses.length}):
              </div>
              <div class="max-h-48 overflow-y-auto space-y-1.5 border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 bg-slate-50 dark:bg-slate-900">
                ${expenses
                  .map(
                    (exp) => `
                  <div class="flex items-center justify-between text-xs py-1.5 px-2 rounded-md bg-white dark:bg-slate-800/80 border border-slate-100 dark:border-slate-700/60">
                    <span class="font-semibold text-slate-800 dark:text-slate-200 truncate mr-2">${exp.title}</span>
                    <span class="font-mono font-bold text-indigo-600 dark:text-indigo-400 whitespace-nowrap">₹${Number(exp.amount || 0).toLocaleString('en-IN')}</span>
                  </div>
                `
                  )
                  .join('')}
              </div>
              <p class="text-[11px] text-slate-400 dark:text-slate-500 italic">
                To delete this category, please first reassign or delete the associated expense records.
              </p>
            `
                : ''
            }
          </div>
        `,
        icon: 'error',
        confirmButtonColor: '#4f46e5',
        confirmButtonText: 'Understood',
        background: isDark ? '#0f172a' : '#ffffff',
        color: isDark ? '#f8fafc' : '#0f172a',
        customClass: {
          popup: 'rounded-2xl border border-rose-200 dark:border-rose-900 shadow-2xl p-5'
        }
      });
    }
  });

  const handleDelete = (cat) => {
    const isDark = document.documentElement.classList.contains('dark');
    const linkedCount = cat._count?.expenses || (cat.expenses ? cat.expenses.length : 0);

    Swal.fire({
      title: `<span class="text-sm font-bold text-slate-900 dark:text-white">Delete Expense Category?</span>`,
      html: `
        <div class="text-xs text-slate-600 dark:text-slate-400 mt-2 text-left">
          Are you sure you want to permanently delete category <strong class="text-indigo-600 dark:text-indigo-400">${cat.name}</strong> (${cat.code || 'NO CODE'})?
          ${
            linkedCount > 0
              ? `<div class="mt-2 p-2 rounded bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 font-semibold border border-amber-200 dark:border-amber-800">
                  ⚠️ Note: System indicates ${linkedCount} expense(s) linked to this category. Deletion will be rejected if expenses are acquired.
                </div>`
              : ''
          }
        </div>
      `,
      icon: 'warning',
      iconColor: '#f59e0b',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#94a3b8',
      confirmButtonText: 'Yes, Delete',
      cancelButtonText: 'Cancel',
      background: isDark ? '#0f172a' : '#ffffff',
      color: isDark ? '#f8fafc' : '#0f172a',
      customClass: {
        popup: 'rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl p-5'
      }
    }).then((result) => {
      if (result.isConfirmed) {
        deleteMutation.mutate(cat.id);
      }
    });
  };

  // Filter & Sort Logic
  const filteredCategories = useMemo(() => {
    let list = [...categories];

    if (statusFilter !== 'ALL') {
      list = list.filter((c) => (c.status || 'ACTIVE') === statusFilter);
    }

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      list = list.filter(
        (c) =>
          (c.name && c.name.toLowerCase().includes(q)) ||
          (c.code && c.code.toLowerCase().includes(q)) ||
          (c.description && c.description.toLowerCase().includes(q))
      );
    }

    list.sort((a, b) => {
      let valA = a[sortField] || '';
      let valB = b[sortField] || '';
      if (typeof valA === 'string') valA = valA.toLowerCase();
      if (typeof valB === 'string') valB = valB.toLowerCase();

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return list;
  }, [categories, statusFilter, searchTerm, sortField, sortOrder]);

  // Pagination Slice
  const totalPages = Math.ceil(filteredCategories.length / pageSize) || 1;
  const paginatedCategories = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredCategories.slice(start, start + pageSize);
  }, [filteredCategories, currentPage, pageSize]);

  // KPI Calculations
  const stats = useMemo(() => {
    const total = categories.length;
    const active = categories.filter((c) => (c.status || 'ACTIVE') === 'ACTIVE').length;
    const inactive = total - active;
    const totalExpenses = categories.reduce(
      (sum, c) => sum + (c._count?.expenses || (c.expenses ? c.expenses.length : 0)),
      0
    );
    return { total, active, inactive, totalExpenses };
  }, [categories]);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
            <span>Item Setup</span>
            <span>/</span>
            <span>Expense Master</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2.5 mt-1">
            <span className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900">
              <CreditCard className="w-6 h-6" />
            </span>
            Expense Master
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
              {categories.length} Categories
            </span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Standard expense categories linked directly to finance expense entries. Categories in use cannot be deleted.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isRefetching}
            className="h-9 px-3 rounded-xl border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <RotateCcw className={`w-3.5 h-3.5 mr-1.5 ${isRefetching ? 'animate-spin' : ''}`} />
            Refresh
          </Button>

          <Button
            size="sm"
            onClick={handleOpenAddModal}
            className="h-9 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md shadow-indigo-500/20"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Add Expense Master
          </Button>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <Card className="rounded-2xl border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/90 shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Masters</p>
              <h3 className="text-2xl font-black text-slate-900 dark:text-white mt-0.5">{stats.total}</h3>
              <p className="text-[10px] text-slate-400 mt-0.5">Defined Categories</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-100 dark:border-indigo-900">
              <Layers className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/90 shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Active Status</p>
              <h3 className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-0.5">{stats.active}</h3>
              <p className="text-[10px] text-emerald-600/80 dark:text-emerald-400/80 mt-0.5">Available in Dropdown</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-100 dark:border-emerald-900">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/90 shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Inactive</p>
              <h3 className="text-2xl font-black text-slate-500 dark:text-slate-400 mt-0.5">{stats.inactive}</h3>
              <p className="text-[10px] text-slate-400 mt-0.5">Disabled Categories</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 flex items-center justify-center border border-slate-200 dark:border-slate-700">
              <XCircle className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/90 shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Acquired Entries</p>
              <h3 className="text-2xl font-black text-indigo-600 dark:text-indigo-400 mt-0.5">{stats.totalExpenses}</h3>
              <p className="text-[10px] text-indigo-600/80 dark:text-indigo-400/80 mt-0.5">Linked Expenses</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center border border-purple-100 dark:border-purple-900">
              <Receipt className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="Search by code, category name, or description..."
            className="pl-9 h-9 text-xs rounded-xl border-slate-200 dark:border-slate-700"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Status Tabs */}
          <div className="flex rounded-xl p-1 bg-slate-100 dark:bg-slate-800 text-xs">
            {['ALL', 'ACTIVE', 'INACTIVE'].map((st) => (
              <button
                key={st}
                onClick={() => {
                  setStatusFilter(st);
                  setCurrentPage(1);
                }}
                className={`px-3 py-1 rounded-lg font-bold text-[11px] transition-all ${
                  statusFilter === st
                    ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                {st}
              </button>
            ))}
          </div>

          {(searchTerm || statusFilter !== 'ALL') && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearchTerm('');
                setStatusFilter('ALL');
                setCurrentPage(1);
              }}
              className="h-8 px-2 text-xs text-slate-500 hover:text-slate-800"
            >
              Reset
            </Button>
          )}
        </div>
      </div>

      {/* Main Table */}
      <Card className="rounded-2xl border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-50 dark:bg-slate-950 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              <TableRow className="border-b border-slate-200 dark:border-slate-800">
                <TableHead className="w-12 text-center">#</TableHead>
                <TableHead
                  className="cursor-pointer hover:text-indigo-600 transition-colors w-32"
                  onClick={() => handleSort('code')}
                >
                  <div className="flex items-center gap-1">
                    <span>Code</span>
                    {sortField === 'code' ? (
                      sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-indigo-600" /> : <ArrowDown className="w-3 h-3 text-indigo-600" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 text-slate-300" />
                    )}
                  </div>
                </TableHead>

                <TableHead
                  className="cursor-pointer hover:text-indigo-600 transition-colors min-w-[200px]"
                  onClick={() => handleSort('name')}
                >
                  <div className="flex items-center gap-1">
                    <span>Category Name</span>
                    {sortField === 'name' ? (
                      sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-indigo-600" /> : <ArrowDown className="w-3 h-3 text-indigo-600" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 text-slate-300" />
                    )}
                  </div>
                </TableHead>

                <TableHead className="min-w-[240px]">Description</TableHead>

                <TableHead className="w-36 text-center">Linked Expenses</TableHead>

                <TableHead
                  className="cursor-pointer hover:text-indigo-600 transition-colors w-28 text-center"
                  onClick={() => handleSort('status')}
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>Status</span>
                    {sortField === 'status' ? (
                      sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-indigo-600" /> : <ArrowDown className="w-3 h-3 text-indigo-600" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 text-slate-300" />
                    )}
                  </div>
                </TableHead>

                <TableHead className="w-24 text-right pr-4">Actions</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody className="text-xs divide-y divide-slate-100 dark:divide-slate-800/60">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={7} className="py-4 text-center">
                      <div className="h-4 bg-slate-100 dark:bg-slate-800 rounded-md animate-pulse"></div>
                    </TableCell>
                  </TableRow>
                ))
              ) : paginatedCategories.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-12 text-center text-slate-400">
                    <Receipt className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-700 mb-2" />
                    <p className="font-semibold text-sm">No expense categories found</p>
                    <p className="text-xs mt-0.5">Try adjusting your search or add a new master category.</p>
                  </TableCell>
                </TableRow>
              ) : (
                paginatedCategories.map((cat, idx) => {
                  const globalIdx = (currentPage - 1) * pageSize + idx + 1;
                  const expenseCount = cat._count?.expenses || (cat.expenses ? cat.expenses.length : 0);
                  const isAcquired = expenseCount > 0;

                  return (
                    <TableRow
                      key={cat.id}
                      className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <TableCell className="text-center font-mono text-slate-400 font-semibold">
                        {globalIdx}
                      </TableCell>

                      <TableCell>
                        <span className="font-mono font-bold px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-[11px]">
                          {cat.code || '—'}
                        </span>
                      </TableCell>

                      <TableCell>
                        <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                          <Tag className="w-3.5 h-3.5 text-indigo-500" />
                          <span>{cat.name}</span>
                        </div>
                      </TableCell>

                      <TableCell className="text-slate-500 dark:text-slate-400 max-w-xs truncate">
                        {cat.description || <span className="text-slate-300 dark:text-slate-600 italic">No description</span>}
                      </TableCell>

                      <TableCell className="text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-mono font-bold text-[11px] ${
                            isAcquired
                              ? 'bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700'
                          }`}
                        >
                          <Receipt className="w-3 h-3" />
                          {expenseCount} {expenseCount === 1 ? 'entry' : 'entries'}
                        </span>
                      </TableCell>

                      <TableCell className="text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-bold text-[10px] uppercase tracking-wider ${
                            cat.status === 'ACTIVE'
                              ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700'
                          }`}
                        >
                          {cat.status === 'ACTIVE' ? (
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          ) : (
                            <XCircle className="w-3 h-3 text-slate-400" />
                          )}
                          {cat.status || 'ACTIVE'}
                        </span>
                      </TableCell>

                      <TableCell className="text-right pr-4">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenEditModal(cat)}
                            title="Edit Category"
                            className="w-7 h-7 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-indigo-950/50"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </Button>

                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(cat)}
                            title={isAcquired ? `Acquired by ${expenseCount} expenses (protected)` : 'Delete Category'}
                            className={`w-7 h-7 rounded-lg transition-colors ${
                              isAcquired
                                ? 'text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40'
                                : 'text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40'
                            }`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {filteredCategories.length > 0 && (
          <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-xs text-slate-500">
              Showing{' '}
              <strong className="text-slate-800 dark:text-slate-200">
                {(currentPage - 1) * pageSize + 1}
              </strong>{' '}
              to{' '}
              <strong className="text-slate-800 dark:text-slate-200">
                {Math.min(currentPage * pageSize, filteredCategories.length)}
              </strong>{' '}
              of <strong className="text-slate-800 dark:text-slate-200">{filteredCategories.length}</strong> categories
            </div>

            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
            />
          </div>
        )}
      </Card>

      {/* Add / Edit Expense Category Modal */}
      {isModalOpen && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 backdrop-blur-[2px] bg-slate-900/[0.04] dark:bg-slate-950/20 pointer-events-auto animate-in fade-in duration-200"
          onClick={() => setIsModalOpen(false)}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-[0_25px_70px_-15px_rgba(15,23,42,0.22),0_0_0_1px_rgba(226,232,240,0.85)] dark:shadow-[0_25px_70px_-15px_rgba(0,0,0,0.7),0_0_0_1px_rgba(30,41,59,0.85)] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200"
          >
            {/* Top Accent Gradient Bar */}
            <div className="h-1.5 w-full bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-600" />

            {/* Modal Header */}
            <div className="px-6 pt-5 pb-4 border-b border-slate-100 dark:border-slate-800/80 flex items-center justify-between bg-slate-50/40 dark:bg-slate-950/40">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500 via-indigo-600 to-purple-600 text-white shadow-md shadow-indigo-500/25 flex items-center justify-center shrink-0">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                    {editingCategory ? 'Edit Expense Master' : 'Add Expense Master'}
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900">
                      Master
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {editingCategory
                      ? 'Update category name, code, or active status'
                      : 'Define a new standard master category for expenses'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="w-8 h-8 rounded-xl bg-slate-100/80 hover:bg-slate-200/80 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-all flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmit((data) => saveMutation.mutate(data))} className="flex flex-col">
              <div className="p-6 space-y-4.5">
                {/* Category Code */}
                <div>
                  <Label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Tag className="w-3.5 h-3.5 text-indigo-500" />
                      Category Code *
                    </span>
                    <button
                      type="button"
                      onClick={() => setValue('code', `EXP-${Math.random().toString(36).substring(2, 6).toUpperCase()}`)}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors"
                    >
                      <Sparkles className="w-3 h-3" /> Auto Generate
                    </button>
                  </Label>
                  <Input
                    {...register('code', { required: 'Code is required' })}
                    placeholder="e.g. EXP-OFF, EXP-UTL"
                    className="h-10.5 px-3.5 text-xs font-mono uppercase font-bold tracking-wider rounded-xl border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-950/50 focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                  />
                  {errors.code && <p className="text-rose-500 text-[11px] font-medium mt-1">{errors.code.message}</p>}
                </div>

                {/* Category Name */}
                <div>
                  <Label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <CreditCard className="w-3.5 h-3.5 text-indigo-500" />
                      Category Name *
                    </span>
                    <span className="text-[10px] text-indigo-500 dark:text-indigo-400 font-normal">Shows in expense dropdown</span>
                  </Label>
                  <Input
                    {...register('name', { required: 'Category name is required' })}
                    placeholder="e.g. Office Supplies, Maintenance, Raw Materials..."
                    className="h-10.5 px-3.5 text-xs font-semibold rounded-xl border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                  />
                  {errors.name && <p className="text-rose-500 text-[11px] font-medium mt-1">{errors.name.message}</p>}
                </div>

                {/* Description / Purpose */}
                <div>
                  <Label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 block">
                    Description / Purpose
                  </Label>
                  <textarea
                    {...register('description')}
                    rows={3}
                    placeholder="Optional brief description of what expenses fall under this category..."
                    className="w-full p-3 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800 dark:text-slate-200 placeholder:text-slate-400 resize-none transition-all leading-relaxed"
                  />
                </div>

                {/* Status Segmented Cards */}
                <div>
                  <Label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 block">
                    Active Status
                  </Label>
                  <div className="grid grid-cols-2 gap-2.5">
                    <label 
                      className={`flex items-center gap-2.5 p-3 rounded-xl border cursor-pointer transition-all ${
                        currentStatus === 'ACTIVE'
                          ? 'border-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 shadow-xs ring-1 ring-emerald-500/30'
                          : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      <input
                        type="radio"
                        value="ACTIVE"
                        {...register('status')}
                        className="text-emerald-600 focus:ring-emerald-500"
                      />
                      <div className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        <span className="text-xs font-bold">ACTIVE</span>
                      </div>
                    </label>

                    <label 
                      className={`flex items-center gap-2.5 p-3 rounded-xl border cursor-pointer transition-all ${
                        currentStatus === 'INACTIVE'
                          ? 'border-slate-400 bg-slate-100/90 dark:bg-slate-800 text-slate-800 dark:text-slate-200 shadow-xs ring-1 ring-slate-400/30'
                          : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      <input
                        type="radio"
                        value="INACTIVE"
                        {...register('status')}
                        className="text-slate-600 focus:ring-slate-500"
                      />
                      <div className="flex items-center gap-1.5">
                        <XCircle className="w-4 h-4 text-slate-400" />
                        <span className="text-xs font-bold">INACTIVE</span>
                      </div>
                    </label>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1.5">
                    Only ACTIVE categories appear in the finance expense creation and editing dropdown.
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="px-6 py-4 bg-slate-50/80 dark:bg-slate-950/70 border-t border-slate-100 dark:border-slate-800/80 rounded-b-3xl flex items-center justify-end gap-2.5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsModalOpen(false)}
                  className="h-10 px-4.5 rounded-xl border-slate-200 dark:border-slate-700 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-all"
                >
                  Cancel
                </Button>

                <Button
                  type="submit"
                  size="sm"
                  disabled={saveMutation.isPending}
                  className="h-10 px-6 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold text-xs shadow-md shadow-indigo-500/25 active:scale-[0.98] transition-all flex items-center gap-2"
                >
                  {saveMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      {editingCategory ? 'Update Category' : 'Create Category'}
                    </>
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
