import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import {
  Plus, Search, Edit2, Trash2, TrendingUp, DollarSign, Calendar, FileText, X,
  Layers, Download, CheckSquare, Square, MinusSquare, ChevronDown, Filter,
  ArrowUpDown, ArrowUp, ArrowDown, Sparkles, Copy, PlusCircle, Check,
  RotateCcw, PieChart as PieChartIcon, BarChart3, Eye, SlidersHorizontal,
  Hash, Tag, AlertCircle, Info, RefreshCw, Wallet, HelpCircle
} from 'lucide-react';
import { api } from '@/lib/axios';
import DatePicker from '@/components/ui/DatePicker';
import Swal from 'sweetalert2';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from 'recharts';
import { Pagination } from '@/components/ui/Pagination';

// Master Expense Categories Configuration
const CATEGORIES = [
  { value: 'RAW_MATERIALS', label: 'Raw Materials', color: '#10b981', bg: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800' },
  { value: 'SALARIES', label: 'Salaries & Labour', color: '#6366f1', bg: 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800' },
  { value: 'UTILITIES', label: 'Utilities & Bills', color: '#f59e0b', bg: 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800' },
  { value: 'MAINTENANCE', label: 'Repairs & Maintenance', color: '#f97316', bg: 'bg-orange-50 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-800' },
  { value: 'LOGISTICS', label: 'Logistics & Transport', color: '#06b6d4', bg: 'bg-cyan-50 dark:bg-cyan-950/40 text-cyan-700 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800' },
  { value: 'OFFICE_SUPPLIES', label: 'Office Supplies', color: '#a855f7', bg: 'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800' },
  { value: 'MARKETING', label: 'Marketing & Sales', color: '#ec4899', bg: 'bg-pink-50 dark:bg-pink-950/40 text-pink-700 dark:text-pink-300 border-pink-200 dark:border-pink-800' },
  { value: 'TAXES', label: 'Taxes & Fees', color: '#ef4444', bg: 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800' },
  { value: 'OTHER', label: 'Other Expenditures', color: '#64748b', bg: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700' }
];

const DATE_PRESETS = [
  { id: 'ALL', label: 'All Time' },
  { id: 'TODAY', label: 'Today' },
  { id: 'THIS_WEEK', label: 'This Week' },
  { id: 'THIS_MONTH', label: 'This Month' },
  { id: 'THIS_QUARTER', label: 'This Quarter' },
  { id: 'CUSTOM', label: 'Custom Range' }
];

// Reusable SweetAlert Toast
const showCustomToast = (title, message, icon = 'success') => {
  const isDark = document.documentElement.classList.contains('dark');
  Swal.fire({
    title: `<span class="font-extrabold text-sm text-slate-800 dark:text-slate-100">${title}</span>`,
    html: `<p class="text-xs text-slate-500 dark:text-slate-400 mt-1">${message}</p>`,
    icon: icon,
    iconColor: icon === 'success' ? '#10b981' : '#ef4444',
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    timer: 3500,
    timerProgressBar: true,
    background: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)',
    color: isDark ? '#f8fafc' : '#0f172a',
    customClass: {
      popup: `rounded-2xl border ${icon === 'success' ? 'border-emerald-100 dark:border-emerald-950' : 'border-red-100 dark:border-red-950'} shadow-xl backdrop-blur-md p-4`,
      timerProgressBar: icon === 'success' ? 'bg-emerald-500' : 'bg-red-500'
    }
  });
};

// ==========================================
// MULTI-CHOICE CATEGORY DROPDOWN COMPONENT
// ==========================================
function MultiSelectCategoryDropdown({ selectedValues = [], onChange }) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef(null);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredCategories = useMemo(() => {
    if (!searchQuery.trim()) return CATEGORIES;
    return CATEGORIES.filter(c =>
      c.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.value.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [searchQuery]);

  const handleToggleCategory = (catValue) => {
    if (selectedValues.includes(catValue)) {
      onChange(selectedValues.filter(v => v !== catValue));
    } else {
      onChange([...selectedValues, catValue]);
    }
  };

  const handleSelectAll = () => {
    onChange(CATEGORIES.map(c => c.value));
  };

  const handleClearAll = () => {
    onChange([]);
  };

  const isAllSelected = selectedValues.length === CATEGORIES.length;
  const isNoneSelected = selectedValues.length === 0;

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center justify-between gap-2 px-3 py-2 text-xs font-semibold rounded-xl border transition-all h-9 cursor-pointer w-full sm:w-56 ${
          selectedValues.length > 0
            ? 'bg-indigo-50/70 dark:bg-indigo-950/40 border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300 shadow-xs'
            : 'bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:border-slate-300'
        }`}
      >
        <div className="flex items-center gap-2 truncate">
          <Filter className={`w-3.5 h-3.5 shrink-0 ${selectedValues.length > 0 ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'}`} />
          <span className="truncate">
            {isNoneSelected
              ? 'All Categories'
              : isAllSelected
              ? 'All Categories (All)'
              : `${selectedValues.length} Categor${selectedValues.length > 1 ? 'ies' : 'y'} Selected`}
          </span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {selectedValues.length > 0 && (
            <span className="flex items-center justify-center w-5 h-5 text-[10px] font-black rounded-full bg-indigo-600 text-white shadow-xs">
              {selectedValues.length}
            </span>
          )}
          <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180 text-indigo-500' : ''}`} />
        </div>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute left-0 mt-1.5 w-72 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl z-50 overflow-hidden animate__animated animate__fadeIn animate__faster">
          {/* Search Header */}
          <div className="p-2.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search category..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800 dark:text-slate-100"
              />
            </div>

            {/* Quick Actions */}
            <div className="flex items-center justify-between mt-2 pt-1 text-[11px] font-bold">
              <button
                type="button"
                onClick={handleSelectAll}
                className="text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
              >
                Select All ({CATEGORIES.length})
              </button>
              <button
                type="button"
                onClick={handleClearAll}
                className="text-slate-400 hover:text-rose-500 hover:underline cursor-pointer"
              >
                Clear Filter
              </button>
            </div>
          </div>

          {/* Categories List */}
          <div className="max-h-60 overflow-y-auto p-1.5 space-y-0.5">
            {filteredCategories.length === 0 ? (
              <div className="text-center py-4 text-xs text-slate-400 italic">
                No matching categories found
              </div>
            ) : (
              filteredCategories.map((cat) => {
                const isSelected = selectedValues.includes(cat.value);
                return (
                  <div
                    key={cat.value}
                    onClick={() => handleToggleCategory(cat.value)}
                    className={`flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-medium cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-900 dark:text-indigo-100 font-semibold'
                        : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className={`w-4 h-4 rounded-md flex items-center justify-center border transition-all ${
                        isSelected
                          ? 'bg-indigo-600 border-indigo-600 text-white'
                          : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900'
                      }`}>
                        {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>
                      <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.color }} />
                        {cat.label}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer Status */}
          <div className="p-2 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/30 flex items-center justify-between text-[10px] text-slate-400 font-medium">
            <span>{selectedValues.length} active filter{selectedValues.length !== 1 ? 's' : ''}</span>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="px-2 py-0.5 rounded-md bg-indigo-600 text-white font-bold hover:bg-indigo-700 transition-colors"
            >
              Apply
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ==========================================
// CSV EXPORT UTILITY FUNCTION
// ==========================================
function downloadExpensesCSV(expensesList, filenamePrefix = 'expenses') {
  if (!expensesList || expensesList.length === 0) {
    showCustomToast('Export Notice', 'No expenses available to export.', 'info');
    return;
  }

  const headers = ['ID', 'Date', 'Expense Title', 'Category', 'Amount (INR)', 'Recorded By', 'Notes / Remarks'];
  const csvRows = [headers.join(',')];

  expensesList.forEach(item => {
    const row = [
      `"${item.id || ''}"`,
      `"${new Date(item.date).toISOString().split('T')[0]}"`,
      `"${(item.title || '').replace(/"/g, '""')}"`,
      `"${item.category || ''}"`,
      Number(item.amount).toFixed(2),
      `"${(item.user?.name || item.user?.email || 'N/A').replace(/"/g, '""')}"`,
      `"${(item.notes || '').replace(/"/g, '""')}"`
    ];
    csvRows.push(row.join(','));
  });

  const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const timestamp = new Date().toISOString().slice(0, 10);
  link.setAttribute('href', url);
  link.setAttribute('download', `${filenamePrefix}_${timestamp}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ==========================================
// MAIN EXPENSES PAGE COMPONENT
// ==========================================
export default function ExpensesPage() {
  const queryClient = useQueryClient();

  // Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [datePreset, setDatePreset] = useState('ALL');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  // Sorting State
  const [sortBy, setSortBy] = useState('date'); // 'date' | 'amount' | 'title' | 'category'
  const [sortOrder, setSortOrder] = useState('desc'); // 'asc' | 'desc'

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Multi-Selection State (for bulk actions)
  const [selectedExpenseIds, setSelectedExpenseIds] = useState([]);

  // Modals
  const [isSingleModalOpen, setIsSingleModalOpen] = useState(false);
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [viewingExpense, setViewingExpense] = useState(null);

  // Batch Rows State (for multi-expense entry)
  const getInitialBatchRow = (idOffset = 1) => ({
    id: Date.now() + idOffset,
    title: '',
    category: 'RAW_MATERIALS',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    notes: ''
  });

  const [batchRows, setBatchRows] = useState([
    getInitialBatchRow(1),
    getInitialBatchRow(2),
    getInitialBatchRow(3)
  ]);

  // React Hook Form for Single Expense (Add & Edit)
  const { register, handleSubmit, reset, control, formState: { errors } } = useForm({
    defaultValues: {
      title: '',
      amount: '',
      category: 'RAW_MATERIALS',
      date: new Date().toISOString().split('T')[0],
      notes: ''
    }
  });

  // Calculate Start & End Date based on Preset
  const { computedStartDate, computedEndDate } = useMemo(() => {
    const now = new Date();
    let start = '';
    let end = '';

    if (datePreset === 'TODAY') {
      const todayStr = now.toISOString().split('T')[0];
      start = todayStr;
      end = todayStr;
    } else if (datePreset === 'THIS_WEEK') {
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Monday
      const monday = new Date(now.setDate(diff));
      start = monday.toISOString().split('T')[0];
      end = new Date().toISOString().split('T')[0];
    } else if (datePreset === 'THIS_MONTH') {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      start = firstDay.toISOString().split('T')[0];
      end = new Date().toISOString().split('T')[0];
    } else if (datePreset === 'THIS_QUARTER') {
      const currentQuarter = Math.floor(now.getMonth() / 3);
      const startQuarter = new Date(now.getFullYear(), currentQuarter * 3, 1);
      start = startQuarter.toISOString().split('T')[0];
      end = new Date().toISOString().split('T')[0];
    } else if (datePreset === 'CUSTOM') {
      start = customStartDate;
      end = customEndDate;
    }

    return { computedStartDate: start, computedEndDate: end };
  }, [datePreset, customStartDate, customEndDate]);

  // Query: Expenses List
  const { data: expenses = [], isLoading: isListLoading, refetch: refetchExpenses, isFetching } = useQuery({
    queryKey: ['expenses', searchTerm, selectedCategories, computedStartDate, computedEndDate],
    queryFn: async () => {
      const params = {};
      if (searchTerm.trim()) params.search = searchTerm.trim();
      if (selectedCategories.length > 0) params.categories = selectedCategories.join(',');
      if (computedStartDate) params.startDate = computedStartDate;
      if (computedEndDate) params.endDate = computedEndDate;

      const response = await api.get('/finance/expenses', { params });
      return response.data || [];
    }
  });

  // Query: Expenses Summary Stats
  const { data: summary, isLoading: isSummaryLoading, refetch: refetchSummary } = useQuery({
    queryKey: ['expenses-summary'],
    queryFn: async () => {
      const response = await api.get('/finance/expenses/summary');
      return response.data || { total: 0, monthly: 0, categoryBreakdown: [], recent: [] };
    }
  });

  // ==========================================
  // MUTATIONS
  // ==========================================

  // Single Create Mutation
  const createMutation = useMutation({
    mutationFn: async (data) => {
      const response = await api.post('/finance/expenses', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['expenses-summary'] });
      showCustomToast('Expense Registered!', 'New expense has been added to financial records.', 'success');
      handleCloseSingleModal();
    },
    onError: (err) => {
      showCustomToast('Creation Failed', err.response?.data?.error || 'Could not record expense.', 'error');
    }
  });

  // Bulk Create Mutation (Add Multiple Expenses at Once)
  const bulkCreateMutation = useMutation({
    mutationFn: async (expensesList) => {
      const response = await api.post('/finance/expenses/bulk', { expenses: expensesList });
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['expenses-summary'] });
      showCustomToast(
        'Batch Expenses Saved!',
        `Successfully registered ${data.count || data.expenses?.length} expenses in one batch.`,
        'success'
      );
      handleCloseBatchModal();
    },
    onError: (err) => {
      showCustomToast('Batch Add Failed', err.response?.data?.error || 'Failed to save multiple expenses.', 'error');
    }
  });

  // Update Mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      const response = await api.put(`/finance/expenses/${id}`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['expenses-summary'] });
      showCustomToast('Expense Updated!', 'The expense entry has been successfully updated.', 'success');
      handleCloseSingleModal();
    },
    onError: (err) => {
      showCustomToast('Update Failed', err.response?.data?.error || 'Failed to update expense record.', 'error');
    }
  });

  // Single Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      await api.delete(`/finance/expenses/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['expenses-summary'] });
      showCustomToast('Expense Deleted!', 'The expense record was removed successfully.', 'success');
      setSelectedExpenseIds(prev => prev.filter(item => item !== deleteMutation.variables));
    },
    onError: (err) => {
      showCustomToast('Delete Failed', err.response?.data?.error || 'Failed to delete expense.', 'error');
    }
  });

  // Bulk Delete Mutation
  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids) => {
      const response = await api.post('/finance/expenses/bulk-delete', { ids });
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['expenses-summary'] });
      showCustomToast('Bulk Deletion Complete', `${data.count} expenses removed successfully.`, 'success');
      setSelectedExpenseIds([]);
    },
    onError: (err) => {
      showCustomToast('Bulk Delete Failed', err.response?.data?.error || 'Failed to delete selected expenses.', 'error');
    }
  });

  // ==========================================
  // HANDLERS
  // ==========================================

  const handleOpenAddModal = () => {
    setEditingExpense(null);
    reset({
      title: '',
      amount: '',
      category: 'RAW_MATERIALS',
      date: new Date().toISOString().split('T')[0],
      notes: ''
    });
    setIsSingleModalOpen(true);
  };

  const handleOpenEditModal = (expense) => {
    setEditingExpense(expense);
    reset({
      title: expense.title,
      amount: parseFloat(expense.amount),
      category: expense.category,
      date: new Date(expense.date).toISOString().split('T')[0],
      notes: expense.notes || ''
    });
    setIsSingleModalOpen(true);
  };

  const handleCloseSingleModal = () => {
    setIsSingleModalOpen(false);
    setEditingExpense(null);
  };

  const onSingleSubmit = (data) => {
    if (editingExpense) {
      updateMutation.mutate({ id: editingExpense.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleDeleteSingle = (id, title) => {
    Swal.fire({
      title: 'Delete Expense Record?',
      text: `Are you sure you want to permanently delete "${title}"? This cannot be undone.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Yes, Delete',
      cancelButtonText: 'Cancel',
      reverseButtons: true,
      customClass: {
        popup: 'rounded-2xl dark:bg-slate-900 dark:text-white',
        confirmButton: 'rounded-xl font-bold text-xs px-4 py-2',
        cancelButton: 'rounded-xl font-bold text-xs px-4 py-2'
      }
    }).then((result) => {
      if (result.isConfirmed) {
        deleteMutation.mutate(id);
      }
    });
  };

  // Bulk Delete Action
  const handleBulkDelete = () => {
    if (selectedExpenseIds.length === 0) return;

    Swal.fire({
      title: `Delete ${selectedExpenseIds.length} Expenses?`,
      text: `You are about to permanently remove ${selectedExpenseIds.length} expense records. This action is audited and cannot be undone.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#64748b',
      confirmButtonText: `Yes, Delete All ${selectedExpenseIds.length}`,
      cancelButtonText: 'Cancel',
      reverseButtons: true,
      customClass: {
        popup: 'rounded-2xl dark:bg-slate-900 dark:text-white',
        confirmButton: 'rounded-xl font-bold text-xs px-4 py-2',
        cancelButton: 'rounded-xl font-bold text-xs px-4 py-2'
      }
    }).then((result) => {
      if (result.isConfirmed) {
        bulkDeleteMutation.mutate(selectedExpenseIds);
      }
    });
  };

  // ==========================================
  // BATCH MODAL OPERATIONS
  // ==========================================
  const handleOpenBatchModal = () => {
    // Reset to 3 clean rows
    setBatchRows([
      getInitialBatchRow(1),
      getInitialBatchRow(2),
      getInitialBatchRow(3)
    ]);
    setIsBatchModalOpen(true);
  };

  const handleCloseBatchModal = () => {
    setIsBatchModalOpen(false);
  };

  const handleAddBatchRow = () => {
    setBatchRows(prev => [...prev, getInitialBatchRow(prev.length + 1)]);
  };

  const handleAddMultipleBatchRows = (count = 3) => {
    const newRows = Array.from({ length: count }, (_, i) => getInitialBatchRow(batchRows.length + i + 1));
    setBatchRows(prev => [...prev, ...newRows]);
  };

  const handleDuplicateBatchRow = (index) => {
    const rowToClone = batchRows[index];
    const cloned = {
      ...rowToClone,
      id: Date.now() + Math.random(),
      title: rowToClone.title ? `${rowToClone.title} (Copy)` : ''
    };
    const updated = [...batchRows];
    updated.splice(index + 1, 0, cloned);
    setBatchRows(updated);
  };

  const handleRemoveBatchRow = (index) => {
    if (batchRows.length === 1) {
      // If only 1 row, just clear it
      setBatchRows([getInitialBatchRow(1)]);
      return;
    }
    setBatchRows(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpdateBatchRow = (index, field, value) => {
    setBatchRows(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  // Live Batch Calculations
  const batchStats = useMemo(() => {
    let validCount = 0;
    let totalSum = 0;

    batchRows.forEach(row => {
      const amt = parseFloat(row.amount);
      if (row.title.trim() && !isNaN(amt) && amt > 0) {
        validCount++;
        totalSum += amt;
      }
    });

    return { validCount, totalSum };
  }, [batchRows]);

  const handleSaveBatchExpenses = () => {
    // Filter out rows that are completely empty
    const filledRows = batchRows.filter(r => r.title.trim() || r.amount || r.notes.trim());

    if (filledRows.length === 0) {
      showCustomToast('Empty Form', 'Please enter details for at least one expense.', 'warning');
      return;
    }

    // Validate each filled row
    const invalidRow = filledRows.find(
      r => !r.title.trim() || isNaN(parseFloat(r.amount)) || parseFloat(r.amount) <= 0 || !r.category || !r.date
    );

    if (invalidRow) {
      showCustomToast(
        'Validation Error',
        'Every row must have a valid Title, positive Amount, Category, and Date.',
        'error'
      );
      return;
    }

    const payload = filledRows.map(r => ({
      title: r.title.trim(),
      amount: parseFloat(r.amount),
      category: r.category,
      date: r.date,
      notes: r.notes.trim() || null
    }));

    bulkCreateMutation.mutate(payload);
  };

  // ==========================================
  // TABLE SORTING & CLIENT FILTERING
  // ==========================================
  const sortedExpenses = useMemo(() => {
    if (!expenses) return [];
    const list = [...expenses];

    list.sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'date') {
        comparison = new Date(a.date).getTime() - new Date(b.date).getTime();
      } else if (sortBy === 'amount') {
        comparison = parseFloat(a.amount) - parseFloat(b.amount);
      } else if (sortBy === 'title') {
        comparison = (a.title || '').localeCompare(b.title || '');
      } else if (sortBy === 'category') {
        comparison = (a.category || '').localeCompare(b.category || '');
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return list;
  }, [expenses, sortBy, sortOrder]);

  const handleSortToggle = (columnKey) => {
    if (sortBy === columnKey) {
      setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(columnKey);
      setSortOrder('desc');
    }
  };

  // Pagination Calculation
  const totalPages = Math.max(1, Math.ceil(sortedExpenses.length / itemsPerPage));
  const paginatedExpenses = useMemo(() => {
    const startIdx = (currentPage - 1) * itemsPerPage;
    return sortedExpenses.slice(startIdx, startIdx + itemsPerPage);
  }, [sortedExpenses, currentPage, itemsPerPage]);

  // Selection Handlers
  const isAllCurrentPageSelected = paginatedExpenses.length > 0 && paginatedExpenses.every(e => selectedExpenseIds.includes(e.id));
  const isSomeCurrentPageSelected = paginatedExpenses.some(e => selectedExpenseIds.includes(e.id)) && !isAllCurrentPageSelected;

  const handleToggleSelectAll = () => {
    if (isAllCurrentPageSelected) {
      // Deselect all on current page
      const currentIds = paginatedExpenses.map(e => e.id);
      setSelectedExpenseIds(prev => prev.filter(id => !currentIds.includes(id)));
    } else {
      // Select all on current page
      const currentIds = paginatedExpenses.map(e => e.id);
      setSelectedExpenseIds(prev => Array.from(new Set([...prev, ...currentIds])));
    }
  };

  const handleToggleSelectRow = (id) => {
    setSelectedExpenseIds(prev =>
      prev.includes(id) ? prev.filter(itemId => itemId !== id) : [...prev, id]
    );
  };

  // Category helpers
  const getCategoryMeta = (catVal) => {
    return CATEGORIES.find(c => c.value === catVal) || {
      value: catVal,
      label: catVal,
      color: '#64748b',
      bg: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
    };
  };

  // Chart Data Preparation
  const chartData = useMemo(() => {
    if (!summary?.categoryBreakdown) return [];
    return summary.categoryBreakdown
      .map(item => ({
        name: getCategoryMeta(item.category).label,
        value: item.amount,
        color: getCategoryMeta(item.category).color,
        categoryKey: item.category
      }))
      .filter(item => item.value > 0);
  }, [summary]);

  const topCategory = useMemo(() => {
    if (!chartData || chartData.length === 0) return null;
    return [...chartData].sort((a, b) => b.value - a.value)[0];
  }, [chartData]);

  // Selected Expenses Total Sum
  const selectedTotalAmount = useMemo(() => {
    if (!expenses || selectedExpenseIds.length === 0) return 0;
    return expenses
      .filter(e => selectedExpenseIds.includes(e.id))
      .reduce((acc, curr) => acc + parseFloat(curr.amount || 0), 0);
  }, [expenses, selectedExpenseIds]);

  return (
    <div className="w-full max-w-full px-4 sm:px-6 lg:px-8 py-5 space-y-5 mx-auto transition-all duration-300">
      
      {/* ==========================================
          TOP HEADER & ACTION BAR
          ========================================== */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] uppercase tracking-wider font-extrabold px-2.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
              Finance & Accounts
            </span>
            <span className="text-xs text-slate-400">/</span>
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Operating Expenses</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <div className="p-2 bg-gradient-to-tr from-indigo-600 to-violet-500 rounded-xl text-white shadow-md shadow-indigo-500/20">
              <DollarSign className="w-5 h-5" />
            </div>
            Expenses Management
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Track, audit, categorize, and control corporate expenditures in real-time.
          </p>
        </div>

        {/* Header Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          {/* Refresh Data */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              refetchExpenses();
              refetchSummary();
            }}
            disabled={isFetching}
            className="h-9 px-3 rounded-xl border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold cursor-pointer"
            title="Refresh records"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isFetching ? 'animate-spin text-indigo-500' : ''}`} />
            Refresh
          </Button>

          {/* Export CSV */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => downloadExpensesCSV(sortedExpenses, 'all_expenses')}
            className="h-9 px-3.5 rounded-xl border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 mr-1.5 text-emerald-600 dark:text-emerald-400" />
            Export CSV
          </Button>

          {/* Batch Add (Add Multiple Expenses at Once) */}
          <Button
            onClick={handleOpenBatchModal}
            className="h-9 px-4 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white font-bold text-xs shadow-md shadow-indigo-500/20 cursor-pointer flex items-center gap-1.5"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Batch Add Expenses</span>
            <span className="ml-1 text-[10px] bg-white/20 px-1.5 py-0.2 rounded-full font-extrabold">Multi</span>
          </Button>

          {/* Single Add Expense */}
          <Button
            onClick={handleOpenAddModal}
            className="h-9 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md shadow-indigo-500/20 cursor-pointer flex items-center"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Add Expense
          </Button>
        </div>
      </div>

      {/* ==========================================
          KPI STATISTIC SUMMARY CARDS
          ========================================== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Expenses Card */}
        <Card className="relative overflow-hidden bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 shadow-sm rounded-2xl">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b from-indigo-500 to-indigo-600" />
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">
                Total Expenses (All Time)
              </span>
              <h2 className="text-xl font-black text-slate-900 dark:text-white font-mono tracking-tight">
                {isSummaryLoading ? (
                  <Skeleton className="h-6 w-28" />
                ) : (
                  `₹${(summary?.total || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                )}
              </h2>
              <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1">
                <Hash className="w-3 h-3 text-indigo-500" />
                <span>{expenses?.length || 0} total transactions</span>
              </span>
            </div>
            <div className="p-3 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-2xl shrink-0">
              <Wallet className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        {/* This Month's Spend Card */}
        <Card className="relative overflow-hidden bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 shadow-sm rounded-2xl">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b from-emerald-500 to-emerald-600" />
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">
                This Month's Spend
              </span>
              <h2 className="text-xl font-black text-slate-900 dark:text-white font-mono tracking-tight">
                {isSummaryLoading ? (
                  <Skeleton className="h-6 w-28" />
                ) : (
                  `₹${(summary?.monthly || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                )}
              </h2>
              <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                <TrendingUp className="w-3 h-3" />
                <span>Active billing cycle</span>
              </span>
            </div>
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-2xl shrink-0">
              <TrendingUp className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        {/* Average Per Expense Card */}
        <Card className="relative overflow-hidden bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 shadow-sm rounded-2xl">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b from-amber-500 to-amber-600" />
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">
                Average Per Expense
              </span>
              <h2 className="text-xl font-black text-slate-900 dark:text-white font-mono tracking-tight">
                {isSummaryLoading || !expenses?.length ? (
                  <Skeleton className="h-6 w-24" />
                ) : (
                  `₹${((summary?.total || 0) / (expenses.length || 1)).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                )}
              </h2>
              <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1">
                <BarChart3 className="w-3 h-3 text-amber-500" />
                <span>Mean expenditure size</span>
              </span>
            </div>
            <div className="p-3 bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 rounded-2xl shrink-0">
              <Calendar className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        {/* Top Cost Center Card */}
        <Card className="relative overflow-hidden bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 shadow-sm rounded-2xl">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b from-purple-500 to-purple-600" />
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1 min-w-0 pr-2">
              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block truncate">
                Top Cost Center
              </span>
              <h2 className="text-base font-black text-slate-900 dark:text-white truncate">
                {isSummaryLoading ? (
                  <Skeleton className="h-6 w-28" />
                ) : topCategory ? (
                  topCategory.name
                ) : (
                  'None'
                )}
              </h2>
              <span className="text-[11px] font-semibold text-purple-600 dark:text-purple-400 flex items-center gap-1 truncate font-mono">
                {topCategory ? `₹${topCategory.value.toLocaleString('en-IN')} total` : 'No expenses yet'}
              </span>
            </div>
            <div className="p-3 bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 rounded-2xl shrink-0">
              <PieChartIcon className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ==========================================
          SMART FILTER TOOLBAR & MULTI-CHOICE DROPDOWN
          ========================================== */}
      <Card className="bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 shadow-sm rounded-2xl">
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
            
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search by title, description, category, user..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                className="pl-9 pr-8 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-xs h-9 rounded-xl focus-visible:ring-indigo-500"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Filters Row */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Multi-Choice Category Dropdown */}
              <MultiSelectCategoryDropdown
                selectedValues={selectedCategories}
                onChange={(newCategories) => {
                  setSelectedCategories(newCategories);
                  setCurrentPage(1);
                }}
              />

              {/* Date Preset Selector */}
              <select
                value={datePreset}
                onChange={(e) => {
                  setDatePreset(e.target.value);
                  setCurrentPage(1);
                }}
                className="px-3 py-2 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-700 dark:text-slate-200 font-semibold h-9 cursor-pointer"
              >
                {DATE_PRESETS.map(dp => (
                  <option key={dp.id} value={dp.id}>{dp.label}</option>
                ))}
              </select>

              {/* Sort By Selector */}
              <div className="flex items-center border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-950 overflow-hidden h-9">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="px-2.5 py-1 text-xs bg-transparent border-0 focus:outline-none text-slate-700 dark:text-slate-200 font-semibold cursor-pointer"
                >
                  <option value="date">Sort: Date</option>
                  <option value="amount">Sort: Amount</option>
                  <option value="title">Sort: Title</option>
                  <option value="category">Sort: Category</option>
                </select>
                <button
                  type="button"
                  onClick={() => setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'))}
                  className="px-2 h-full flex items-center justify-center border-l border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 cursor-pointer"
                  title={`Order: ${sortOrder === 'asc' ? 'Ascending' : 'Descending'}`}
                >
                  {sortOrder === 'asc' ? (
                    <ArrowUp className="w-3.5 h-3.5 text-indigo-500" />
                  ) : (
                    <ArrowDown className="w-3.5 h-3.5 text-indigo-500" />
                  )}
                </button>
              </div>

              {/* Reset All Filters Button */}
              {(searchTerm || selectedCategories.length > 0 || datePreset !== 'ALL') && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSearchTerm('');
                    setSelectedCategories([]);
                    setDatePreset('ALL');
                    setCustomStartDate('');
                    setCustomEndDate('');
                    setCurrentPage(1);
                  }}
                  className="h-9 px-2.5 rounded-xl text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-xs font-bold cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5 mr-1" />
                  Reset
                </Button>
              )}
            </div>
          </div>

          {/* Custom Date Range Pickers (Visible only when datePreset is CUSTOM) */}
          {datePreset === 'CUSTOM' && (
            <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
              <span className="font-extrabold text-slate-500 uppercase text-[10px]">Custom Range:</span>
              <div className="flex items-center gap-2">
                <span className="text-slate-400 text-xs">From</span>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => {
                    setCustomStartDate(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs text-slate-800 dark:text-slate-200"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-slate-400 text-xs">To</span>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => {
                    setCustomEndDate(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs text-slate-800 dark:text-slate-200"
                />
              </div>
            </div>
          )}

          {/* Active Category Chips */}
          {selectedCategories.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-[10px] uppercase font-extrabold text-slate-400 mr-1">Filtered by:</span>
              {selectedCategories.map((catKey) => {
                const meta = getCategoryMeta(catKey);
                return (
                  <span
                    key={catKey}
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${meta.bg}`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: meta.color }} />
                    {meta.label}
                    <button
                      type="button"
                      onClick={() => setSelectedCategories(selectedCategories.filter(c => c !== catKey))}
                      className="ml-0.5 hover:opacity-75 p-0.5 rounded-full"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                );
              })}
              <button
                type="button"
                onClick={() => setSelectedCategories([])}
                className="text-[11px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 underline font-medium ml-1"
              >
                Clear all
              </button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ==========================================
          FLOATING BULK SELECTION ACTION BAR
          ========================================== */}
      {selectedExpenseIds.length > 0 && (
        <div className="sticky top-4 z-40 bg-indigo-900/95 dark:bg-slate-900/95 text-white backdrop-blur-md px-4 py-3 rounded-2xl shadow-2xl border border-indigo-700/50 flex flex-wrap items-center justify-between gap-3 animate__animated animate__fadeInDown">
          <div className="flex items-center gap-3">
            <span className="flex items-center justify-center w-7 h-7 rounded-xl bg-indigo-500 text-white font-black text-xs">
              {selectedExpenseIds.length}
            </span>
            <div>
              <span className="font-bold text-xs">
                {selectedExpenseIds.length} Expense{selectedExpenseIds.length > 1 ? 's' : ''} Selected
              </span>
              <span className="ml-2 text-indigo-200 text-xs font-mono font-medium">
                (Total: ₹{selectedTotalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })})
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Export Selected as CSV */}
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                const selectedItems = expenses.filter(e => selectedExpenseIds.includes(e.id));
                downloadExpensesCSV(selectedItems, 'selected_expenses');
              }}
              className="h-8 px-3 rounded-xl bg-indigo-800/80 hover:bg-indigo-700 text-white border-indigo-600 text-xs font-semibold cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 mr-1" />
              Export Selected
            </Button>

            {/* Bulk Delete */}
            <Button
              size="sm"
              onClick={handleBulkDelete}
              disabled={bulkDeleteMutation.isPending}
              className="h-8 px-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5 mr-1" />
              Delete Selected ({selectedExpenseIds.length})
            </Button>

            {/* Deselect All */}
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setSelectedExpenseIds([])}
              className="h-8 px-2.5 text-indigo-200 hover:text-white hover:bg-indigo-800/60 rounded-xl text-xs font-semibold"
            >
              Clear
            </Button>
          </div>
        </div>
      )}

      {/* ==========================================
          MAIN CONTENT LAYOUT: TABLE + ANALYTICS
          ========================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        
        {/* Left Side (2 Columns): Expense Table */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 shadow-sm rounded-2xl overflow-hidden">
            <CardHeader className="p-4 pb-3 flex flex-row items-center justify-between border-b border-slate-100 dark:border-slate-800">
              <div>
                <CardTitle className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <span>Expenses Ledger</span>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                    {sortedExpenses.length} Records
                  </span>
                </CardTitle>
                <CardDescription className="text-xs text-slate-500">
                  Comprehensive register of all verified operating transactions.
                </CardDescription>
              </div>

              {/* Items Per Page Selector */}
              <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                <span>Show:</span>
                <select
                  value={itemsPerPage}
                  onChange={(e) => {
                    setItemsPerPage(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 font-semibold cursor-pointer text-xs"
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              {isListLoading ? (
                <div className="p-5 space-y-3">
                  <Skeleton className="h-10 w-full rounded-xl" />
                  <Skeleton className="h-10 w-full rounded-xl" />
                  <Skeleton className="h-10 w-full rounded-xl" />
                  <Skeleton className="h-10 w-full rounded-xl" />
                </div>
              ) : paginatedExpenses.length === 0 ? (
                <div className="text-center py-16 px-4">
                  <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 flex items-center justify-center text-indigo-500">
                    <FileText className="w-7 h-7" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">No Expenses Found</h3>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
                    No expenditures matched your filter criteria or search query.
                  </p>
                  <div className="flex justify-center gap-2 mt-4">
                    <Button
                      size="sm"
                      onClick={handleOpenAddModal}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl"
                    >
                      <Plus className="w-3.5 h-3.5 mr-1" />
                      Add Expense
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleOpenBatchModal}
                      className="border-slate-200 dark:border-slate-700 text-xs font-bold rounded-xl"
                    >
                      <Sparkles className="w-3.5 h-3.5 mr-1 text-indigo-500" />
                      Batch Add
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table className="text-xs w-full">
                    <TableHeader className="bg-slate-50/80 dark:bg-slate-950/80 border-b border-slate-200 dark:border-slate-800">
                      <TableRow className="hover:bg-transparent dark:border-slate-800">
                        {/* Master Select Checkbox */}
                        <TableHead className="w-10 text-center py-3">
                          <button
                            type="button"
                            onClick={handleToggleSelectAll}
                            className="text-slate-400 hover:text-indigo-600 transition-colors cursor-pointer"
                            title={isAllCurrentPageSelected ? 'Deselect all on page' : 'Select all on page'}
                          >
                            {isAllCurrentPageSelected ? (
                              <CheckSquare className="w-4 h-4 text-indigo-600" />
                            ) : isSomeCurrentPageSelected ? (
                              <MinusSquare className="w-4 h-4 text-indigo-600" />
                            ) : (
                              <Square className="w-4 h-4" />
                            )}
                          </button>
                        </TableHead>

                        {/* Date Column (Sortable) */}
                        <TableHead
                          onClick={() => handleSortToggle('date')}
                          className="w-28 font-bold text-slate-600 dark:text-slate-300 py-3 cursor-pointer select-none hover:text-indigo-600 transition-colors"
                        >
                          <div className="flex items-center gap-1">
                            <span>Date</span>
                            <ArrowUpDown className="w-3 h-3 text-slate-400" />
                          </div>
                        </TableHead>

                        {/* Title & Description (Sortable) */}
                        <TableHead
                          onClick={() => handleSortToggle('title')}
                          className="font-bold text-slate-600 dark:text-slate-300 py-3 cursor-pointer select-none hover:text-indigo-600 transition-colors"
                        >
                          <div className="flex items-center gap-1">
                            <span>Expense Title</span>
                            <ArrowUpDown className="w-3 h-3 text-slate-400" />
                          </div>
                        </TableHead>

                        {/* Category Column (Sortable) */}
                        <TableHead
                          onClick={() => handleSortToggle('category')}
                          className="w-36 font-bold text-slate-600 dark:text-slate-300 py-3 cursor-pointer select-none hover:text-indigo-600 transition-colors"
                        >
                          <div className="flex items-center gap-1">
                            <span>Category</span>
                            <ArrowUpDown className="w-3 h-3 text-slate-400" />
                          </div>
                        </TableHead>

                        {/* Amount Column (Sortable) */}
                        <TableHead
                          onClick={() => handleSortToggle('amount')}
                          className="w-28 text-right font-bold text-slate-600 dark:text-slate-300 py-3 cursor-pointer select-none hover:text-indigo-600 transition-colors"
                        >
                          <div className="flex items-center justify-end gap-1">
                            <span>Amount (₹)</span>
                            <ArrowUpDown className="w-3 h-3 text-slate-400" />
                          </div>
                        </TableHead>

                        {/* Added By */}
                        <TableHead className="w-24 font-bold text-slate-600 dark:text-slate-300 py-3">
                          Logged By
                        </TableHead>

                        {/* Actions */}
                        <TableHead className="w-24 text-right font-bold text-slate-600 dark:text-slate-300 py-3 pr-4">
                          Actions
                        </TableHead>
                      </TableRow>
                    </TableHeader>

                    <TableBody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                      {paginatedExpenses.map((exp) => {
                        const isSelected = selectedExpenseIds.includes(exp.id);
                        const catMeta = getCategoryMeta(exp.category);

                        return (
                          <TableRow
                            key={exp.id}
                            className={`transition-colors duration-150 ${
                              isSelected
                                ? 'bg-indigo-50/60 dark:bg-indigo-950/40 hover:bg-indigo-50/80 dark:hover:bg-indigo-950/60'
                                : 'hover:bg-slate-50/70 dark:hover:bg-slate-800/30'
                            }`}
                          >
                            {/* Row Checkbox */}
                            <TableCell className="text-center py-2.5">
                              <button
                                type="button"
                                onClick={() => handleToggleSelectRow(exp.id)}
                                className="text-slate-400 hover:text-indigo-600 cursor-pointer"
                              >
                                {isSelected ? (
                                  <CheckSquare className="w-4 h-4 text-indigo-600" />
                                ) : (
                                  <Square className="w-4 h-4" />
                                )}
                              </button>
                            </TableCell>

                            {/* Date */}
                            <TableCell className="font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">
                              {new Date(exp.date).toLocaleDateString('en-IN', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric'
                              })}
                            </TableCell>

                            {/* Title & Notes */}
                            <TableCell className="max-w-[220px]">
                              <div>
                                <div className="font-bold text-slate-900 dark:text-slate-100 truncate flex items-center gap-1.5">
                                  <span>{exp.title}</span>
                                </div>
                                {exp.notes && (
                                  <div className="text-[11px] text-slate-400 truncate mt-0.5">
                                    {exp.notes}
                                  </div>
                                )}
                              </div>
                            </TableCell>

                            {/* Category Badge */}
                            <TableCell className="whitespace-nowrap">
                              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${catMeta.bg}`}>
                                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: catMeta.color }} />
                                {catMeta.label}
                              </span>
                            </TableCell>

                            {/* Amount */}
                            <TableCell className="text-right font-black font-mono text-slate-900 dark:text-slate-100 whitespace-nowrap">
                              ₹{parseFloat(exp.amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </TableCell>

                            {/* Logged By */}
                            <TableCell className="text-slate-500 dark:text-slate-400 text-[11px] font-semibold truncate max-w-[100px]">
                              {exp.user?.name || exp.user?.email || 'N/A'}
                            </TableCell>

                            {/* Action Buttons */}
                            <TableCell className="text-right py-2 pr-4 space-x-1 whitespace-nowrap">
                              {/* View Details */}
                              <button
                                type="button"
                                onClick={() => setViewingExpense(exp)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 transition-colors cursor-pointer"
                                title="View Details"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>

                              {/* Edit */}
                              <button
                                type="button"
                                onClick={() => handleOpenEditModal(exp)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors cursor-pointer"
                                title="Edit Expense"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>

                              {/* Delete */}
                              <button
                                type="button"
                                onClick={() => handleDeleteSingle(exp.id, exp.title)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
                                title="Delete Expense"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}

              {/* Pagination Bar */}
              {totalPages > 1 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/30">
                  <span className="text-xs text-slate-500 font-medium">
                    Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, sortedExpenses.length)} of {sortedExpenses.length} entries
                  </span>
                  <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={setCurrentPage}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Side (1 Column): Category Visual Analytics & Breakdown */}
        <div className="space-y-4">
          
          {/* Donut Pie Chart */}
          <Card className="bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 shadow-sm rounded-2xl">
            <CardHeader className="p-4 pb-2 border-b border-slate-100 dark:border-slate-800">
              <CardTitle className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <PieChartIcon className="w-4 h-4 text-indigo-500" />
                Category Distribution
              </CardTitle>
              <CardDescription className="text-xs">
                Real-time visual breakdown of organizational cost centers.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4">
              {isSummaryLoading ? (
                <div className="h-56 flex items-center justify-center">
                  <Skeleton className="w-36 h-36 rounded-full" />
                </div>
              ) : chartData.length === 0 ? (
                <div className="h-56 flex flex-col items-center justify-center text-slate-400 text-xs text-center p-4">
                  <PieChartIcon className="w-10 h-10 stroke-[1.5] mb-2 text-slate-300 dark:text-slate-700" />
                  <span>No expenditure data available to graph.</span>
                </div>
              ) : (
                <div className="h-56 w-full text-xs">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={chartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={48}
                        outerRadius={75}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {chartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(val) => [`₹${Number(val).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, 'Amount']}
                        contentStyle={{
                          borderRadius: '12px',
                          fontSize: '11px',
                          background: 'rgba(15, 23, 42, 0.95)',
                          color: '#fff',
                          border: 'none',
                          boxShadow: '0 10px 25px -5px rgba(0,0,0,0.3)'
                        }}
                      />
                      <Legend
                        layout="horizontal"
                        verticalAlign="bottom"
                        align="center"
                        iconSize={8}
                        iconType="circle"
                        wrapperStyle={{ fontSize: '10px', paddingTop: '8px' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Category Progress Share Breakdown */}
          <Card className="bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 shadow-sm rounded-2xl">
            <CardHeader className="p-4 pb-2 border-b border-slate-100 dark:border-slate-800">
              <CardTitle className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-emerald-500" />
                Spending by Category
              </CardTitle>
              <CardDescription className="text-xs">
                Budget share and relative volume percentage.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              {isSummaryLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-6 w-full rounded-md" />
                  <Skeleton className="h-6 w-full rounded-md" />
                  <Skeleton className="h-6 w-full rounded-md" />
                </div>
              ) : chartData.length === 0 ? (
                <div className="text-center py-6 text-xs text-slate-400 italic">
                  No category records available.
                </div>
              ) : (
                chartData
                  .sort((a, b) => b.value - a.value)
                  .map((item) => {
                    const totalSpend = summary?.total || 1;
                    const percentage = Math.round((item.value / totalSpend) * 100);

                    return (
                      <div key={item.name} className="space-y-1">
                        <div className="flex items-center justify-between text-xs font-semibold">
                          <span className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                            {item.name}
                          </span>
                          <div className="flex items-center gap-2 font-mono">
                            <span className="text-slate-900 dark:text-white font-bold">
                              ₹{item.value.toLocaleString('en-IN')}
                            </span>
                            <span className="text-[10px] text-slate-400 font-bold w-8 text-right">
                              {percentage}%
                            </span>
                          </div>
                        </div>
                        <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${percentage}%`,
                              backgroundColor: item.color
                            }}
                          />
                        </div>
                      </div>
                    );
                  })
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ==========================================
          BATCH EXPENSE ENTRY MODAL (MULTI-ADD)
          ========================================== */}
      {isBatchModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-5xl w-full max-h-[90vh] border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden animate__animated animate__zoomIn animate__faster flex flex-col">
            
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-slate-50 via-indigo-50/20 to-slate-50 dark:from-slate-950 dark:via-indigo-950/20 dark:to-slate-950">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-gradient-to-tr from-indigo-600 to-violet-600 rounded-2xl text-white shadow-md shadow-indigo-500/20">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                    Batch / Multi-Expense Fast Entry
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 font-bold uppercase tracking-wider">
                      Mass Recorder
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Enter multiple expenses simultaneously in a spreadsheet-like grid and save all at once.
                  </p>
                </div>
              </div>

              {/* Close Button */}
              <button
                type="button"
                onClick={handleCloseBatchModal}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-2xl transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Actions & Live Stats Bar */}
            <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/30 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleAddBatchRow}
                  className="h-8 rounded-xl border-slate-200 dark:border-slate-700 font-bold text-xs cursor-pointer hover:bg-indigo-50 dark:hover:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  + Add 1 Row
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleAddMultipleBatchRows(3)}
                  className="h-8 rounded-xl border-slate-200 dark:border-slate-700 font-bold text-xs cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <PlusCircle className="w-3.5 h-3.5 mr-1 text-slate-500" />
                  + Add 3 Rows
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleAddMultipleBatchRows(5)}
                  className="h-8 rounded-xl border-slate-200 dark:border-slate-700 font-bold text-xs cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <PlusCircle className="w-3.5 h-3.5 mr-1 text-slate-500" />
                  + Add 5 Rows
                </Button>
              </div>

              {/* Batch Summary Badge */}
              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold text-slate-500">
                  Ready: <strong className="text-slate-900 dark:text-white font-bold">{batchStats.validCount}</strong> / {batchRows.length} rows
                </span>
                <span className="px-3 py-1 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 font-mono font-black text-xs">
                  Batch Total: ₹{batchStats.totalSum.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            {/* Editable Batch Grid Table */}
            <div className="flex-1 overflow-y-auto p-5">
              <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    <tr>
                      <th className="w-10 px-3 py-2.5 text-center">#</th>
                      <th className="min-w-[200px] px-3 py-2.5">Expense Title / Description *</th>
                      <th className="w-48 px-3 py-2.5">Category *</th>
                      <th className="w-36 px-3 py-2.5">Amount (₹) *</th>
                      <th className="w-36 px-3 py-2.5">Date *</th>
                      <th className="min-w-[160px] px-3 py-2.5">Notes / Ref</th>
                      <th className="w-20 px-3 py-2.5 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 bg-white dark:bg-slate-900">
                    {batchRows.map((row, idx) => {
                      const isComplete = row.title.trim() && parseFloat(row.amount) > 0;

                      return (
                        <tr
                          key={row.id}
                          className={`transition-colors ${
                            isComplete
                              ? 'hover:bg-indigo-50/20 dark:hover:bg-indigo-950/10'
                              : 'hover:bg-slate-50 dark:hover:bg-slate-800/30'
                          }`}
                        >
                          {/* Row Number */}
                          <td className="px-3 py-2 text-center font-mono font-bold text-slate-400">
                            {idx + 1}
                          </td>

                          {/* Title Input */}
                          <td className="px-2 py-2">
                            <input
                              type="text"
                              placeholder="e.g. Factory Electricity Bill"
                              value={row.title}
                              onChange={(e) => handleUpdateBatchRow(idx, 'title', e.target.value)}
                              className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-semibold"
                            />
                          </td>

                          {/* Category Dropdown */}
                          <td className="px-2 py-2">
                            <select
                              value={row.category}
                              onChange={(e) => handleUpdateBatchRow(idx, 'category', e.target.value)}
                              className="w-full px-2 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-semibold"
                            >
                              {CATEGORIES.map(cat => (
                                <option key={cat.value} value={cat.value}>{cat.label}</option>
                              ))}
                            </select>
                          </td>

                          {/* Amount Input */}
                          <td className="px-2 py-2">
                            <input
                              type="number"
                              step="0.01"
                              placeholder="0.00"
                              value={row.amount}
                              onChange={(e) => handleUpdateBatchRow(idx, 'amount', e.target.value)}
                              className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono font-bold text-right"
                            />
                          </td>

                          {/* Date Input */}
                          <td className="px-2 py-2">
                            <input
                              type="date"
                              value={row.date}
                              onChange={(e) => handleUpdateBatchRow(idx, 'date', e.target.value)}
                              className="w-full px-2 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium"
                            />
                          </td>

                          {/* Notes Input */}
                          <td className="px-2 py-2">
                            <input
                              type="text"
                              placeholder="Optional remarks"
                              value={row.notes}
                              onChange={(e) => handleUpdateBatchRow(idx, 'notes', e.target.value)}
                              className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            />
                          </td>

                          {/* Row Actions */}
                          <td className="px-2 py-2 text-center whitespace-nowrap space-x-1">
                            {/* Duplicate Row */}
                            <button
                              type="button"
                              onClick={() => handleDuplicateBatchRow(idx)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 transition-colors cursor-pointer"
                              title="Duplicate row"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>

                            {/* Delete Row */}
                            <button
                              type="button"
                              onClick={() => handleRemoveBatchRow(idx)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
                              title="Remove row"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/80 flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs text-slate-500">
                <span>Tip: Use the <strong>Duplicate</strong> button to quickly clone rows with identical dates or cost centers.</span>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCloseBatchModal}
                  className="rounded-xl border-slate-200 dark:border-slate-700 text-xs font-bold h-9 px-4 cursor-pointer"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handleSaveBatchExpenses}
                  disabled={bulkCreateMutation.isPending || batchStats.validCount === 0}
                  className="rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white font-extrabold text-xs h-9 px-5 shadow-md shadow-indigo-500/20 cursor-pointer flex items-center gap-1.5"
                >
                  {bulkCreateMutation.isPending ? (
                    <span>Saving Batch...</span>
                  ) : (
                    <>
                      <Check className="w-4 h-4 stroke-[3]" />
                      <span>Save All ({batchStats.validCount} Expenses)</span>
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==========================================
          SINGLE EXPENSE MODAL (ADD & EDIT)
          ========================================== */}
      {isSingleModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden animate__animated animate__zoomIn animate__faster flex flex-col">
            
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/30">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo-50 dark:bg-indigo-950/60 rounded-xl text-indigo-600 dark:text-indigo-400">
                  {editingExpense ? <Edit2 className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
                    {editingExpense ? 'Edit Expense Record' : 'Record New Expense'}
                  </h3>
                  <p className="text-[11px] text-slate-400 font-medium">
                    {editingExpense ? 'Update financial parameters for this record' : 'Register an outgoing expense item'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCloseSingleModal}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit(onSingleSubmit)} className="p-5 space-y-4 text-xs">
              {/* Title */}
              <div className="space-y-1">
                <Label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">
                  Expense Title / Purpose *
                </Label>
                <Input
                  placeholder="e.g. Office Stationery, Generator Diesel"
                  {...register('title', { required: 'Expense title is required' })}
                  className="bg-white dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 h-9 text-xs font-semibold focus-visible:ring-indigo-500"
                />
                {errors.title && <span className="text-3xs text-rose-500 font-bold">{errors.title.message}</span>}
              </div>

              {/* Amount & Category */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">
                    Amount (₹) *
                  </Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    {...register('amount', {
                      required: 'Amount is required',
                      min: { value: 0.01, message: 'Amount must be greater than zero' }
                    })}
                    className="bg-white dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 h-9 text-xs font-mono font-bold focus-visible:ring-indigo-500"
                  />
                  {errors.amount && <span className="text-3xs text-rose-500 font-bold">{errors.amount.message}</span>}
                </div>

                <div className="space-y-1">
                  <Label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">
                    Category *
                  </Label>
                  <select
                    {...register('category', { required: 'Category is required' })}
                    className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 font-semibold h-9"
                  >
                    {CATEGORIES.map(cat => (
                      <option key={cat.value} value={cat.value}>{cat.label}</option>
                    ))}
                  </select>
                  {errors.category && <span className="text-3xs text-rose-500 font-bold">{errors.category.message}</span>}
                </div>
              </div>

              {/* Expense Date */}
              <div className="space-y-1 flex flex-col w-full relative">
                <Label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">
                  Expense Date *
                </Label>
                <Controller
                  control={control}
                  name="date"
                  rules={{ required: 'Date is required' }}
                  render={({ field }) => (
                    <DatePicker
                      value={field.value}
                      onChange={(date) => field.onChange(date ? date.toISOString().split('T')[0] : '')}
                      triggerClassName="h-9 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs font-semibold px-3 py-1.5"
                    />
                  )}
                />
                {errors.date && <span className="text-3xs text-rose-500 font-bold">{errors.date.message}</span>}
              </div>

              {/* Notes / Remarks */}
              <div className="space-y-1">
                <Label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">
                  Notes / Reference Number
                </Label>
                <textarea
                  placeholder="Optional details, voucher ID, vendor name..."
                  {...register('notes')}
                  rows={3}
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-xs resize-none font-medium"
                />
              </div>

              {/* Form Buttons */}
              <div className="flex space-x-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCloseSingleModal}
                  className="w-1/2 rounded-xl border-slate-200 dark:border-slate-700 font-bold h-9 text-xs cursor-pointer"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="w-1/2 rounded-xl bg-indigo-600 text-white font-extrabold shadow-md hover:bg-indigo-700 h-9 text-xs cursor-pointer"
                >
                  {createMutation.isPending || updateMutation.isPending ? (
                    <span>Processing...</span>
                  ) : editingExpense ? (
                    'Save Changes'
                  ) : (
                    'Confirm Expense'
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==========================================
          VIEW EXPENSE DETAILS MODAL
          ========================================== */}
      {viewingExpense && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden animate__animated animate__zoomIn animate__faster">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-950/50">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-indigo-500" />
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                  Expense Details
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setViewingExpense(null)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div>
                <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Title</span>
                <p className="text-base font-bold text-slate-900 dark:text-white mt-0.5">{viewingExpense.title}</p>
              </div>

              <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-100 dark:border-slate-800">
                <div>
                  <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Amount</span>
                  <p className="text-lg font-black font-mono text-indigo-600 dark:text-indigo-400 mt-0.5">
                    ₹{parseFloat(viewingExpense.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Date</span>
                  <p className="font-bold text-slate-800 dark:text-slate-200 mt-1">
                    {new Date(viewingExpense.date).toLocaleDateString('en-IN', {
                      day: '2-digit',
                      month: 'long',
                      year: 'numeric'
                    })}
                  </p>
                </div>
              </div>

              <div>
                <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Category</span>
                <div className="mt-1">
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${getCategoryMeta(viewingExpense.category).bg}`}>
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: getCategoryMeta(viewingExpense.category).color }} />
                    {getCategoryMeta(viewingExpense.category).label}
                  </span>
                </div>
              </div>

              {viewingExpense.notes && (
                <div>
                  <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Notes / Remarks</span>
                  <p className="mt-1 p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-medium">
                    {viewingExpense.notes}
                  </p>
                </div>
              )}

              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
                <span>Recorded by: <strong>{viewingExpense.user?.name || viewingExpense.user?.email || 'N/A'}</strong></span>
                <Button
                  size="sm"
                  onClick={() => {
                    setViewingExpense(null);
                    handleOpenEditModal(viewingExpense);
                  }}
                  className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs h-8"
                >
                  <Edit2 className="w-3 h-3 mr-1" />
                  Edit Record
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
