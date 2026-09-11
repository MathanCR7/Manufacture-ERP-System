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

// Clean Toast Without Backdrop Blur
const showCustomToast = (title, message, icon = 'success') => {
  const isDark = document.documentElement.classList.contains('dark');
  Swal.fire({
    title: `<span class="font-extrabold text-xs text-slate-800 dark:text-slate-100">${title}</span>`,
    html: `<p class="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">${message}</p>`,
    icon: icon,
    iconColor: icon === 'success' ? '#10b981' : '#ef4444',
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    timer: 3500,
    timerProgressBar: true,
    background: isDark ? '#0f172a' : '#ffffff',
    color: isDark ? '#f8fafc' : '#0f172a',
    customClass: {
      popup: `rounded-xl border ${icon === 'success' ? 'border-emerald-200 dark:border-emerald-900' : 'border-red-200 dark:border-red-900'} shadow-lg p-3`,
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
    <div className="relative inline-block z-40" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center justify-between gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg border transition-all h-8 cursor-pointer w-full sm:w-52 select-none ${
          selectedValues.length > 0
            ? 'bg-indigo-50 dark:bg-indigo-950/50 border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300 ring-1 ring-indigo-500/20'
            : 'bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300'
        }`}
      >
        <div className="flex items-center gap-1.5 truncate">
          <Filter className={`w-3.5 h-3.5 shrink-0 ${selectedValues.length > 0 ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'}`} />
          <span className="truncate text-[11px]">
            {isNoneSelected
              ? 'All Categories'
              : isAllSelected
              ? 'All Categories (All)'
              : `${selectedValues.length} Categor${selectedValues.length > 1 ? 'ies' : 'y'}`}
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {selectedValues.length > 0 && (
            <span className="flex items-center justify-center w-4 h-4 text-[9px] font-black rounded-full bg-indigo-600 text-white">
              {selectedValues.length}
            </span>
          )}
          <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180 text-indigo-500' : ''}`} />
        </div>
      </button>

      {/* Dropdown Menu - Explicit High Z-Index & No Overflow Clipping */}
      {isOpen && (
        <div 
          className="absolute right-0 sm:left-0 top-full mt-1.5 w-72 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-[9999] overflow-hidden"
          style={{ minWidth: '17rem', zIndex: 9999 }}
        >
          {/* Search Header */}
          <div className="p-2 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60">
            <div className="relative">
              <Search className="w-3 h-3 absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search category..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoFocus
                className="w-full pl-7 pr-2 py-1 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800 dark:text-slate-100"
              />
            </div>

            {/* Quick Actions */}
            <div className="flex items-center justify-between mt-1.5 pt-0.5 text-[10px] font-bold">
              <button
                type="button"
                onClick={handleSelectAll}
                className="text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer flex items-center gap-1"
              >
                <CheckSquare className="w-2.5 h-2.5" />
                Select All ({CATEGORIES.length})
              </button>
              <button
                type="button"
                onClick={handleClearAll}
                className="text-slate-400 hover:text-rose-500 hover:underline cursor-pointer flex items-center gap-1"
              >
                <X className="w-2.5 h-2.5" />
                Clear
              </button>
            </div>
          </div>

          {/* Categories List */}
          <div className="max-h-56 overflow-y-auto p-1 space-y-0.5">
            {filteredCategories.length === 0 ? (
              <div className="text-center py-4 text-xs text-slate-400 italic">
                No matching categories
              </div>
            ) : (
              filteredCategories.map((cat) => {
                const isSelected = selectedValues.includes(cat.value);
                return (
                  <div
                    key={cat.value}
                    onClick={() => handleToggleCategory(cat.value)}
                    className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-900 dark:text-indigo-100 font-semibold'
                        : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className={`w-3.5 h-3.5 rounded flex items-center justify-center border transition-all ${
                        isSelected
                          ? 'bg-indigo-600 border-indigo-600 text-white'
                          : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900'
                      }`}>
                        {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                      </div>
                      <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                        <span className="text-[11px]">{cat.label}</span>
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer Status */}
          <div className="p-2 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 flex items-center justify-between text-[10px] text-slate-500 font-medium">
            <span><strong>{selectedValues.length}</strong> selected</span>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="px-2.5 py-0.5 rounded bg-indigo-600 text-white font-bold hover:bg-indigo-700 transition-colors cursor-pointer"
            >
              Done
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

  const headers = ['ID', 'Date', 'Expense Title', 'Category', 'Amount (INR)', 'Recorded By', 'Notes'];
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
  const [sortBy, setSortBy] = useState('date');
  const [sortOrder, setSortOrder] = useState('desc');

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Multi-Selection State
  const [selectedExpenseIds, setSelectedExpenseIds] = useState([]);

  // Modals (Unified: Multi-Expense Entry is the only addition modal!)
  const [isMultiModalOpen, setIsMultiModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [viewingExpense, setViewingExpense] = useState(null);

  // Batch Rows State (Default: 3 clean rows)
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

  // React Hook Form for Single Edit Record
  const { register: registerEdit, handleSubmit: handleSubmitEdit, reset: resetEdit, control: controlEdit, formState: { errors: editErrors } } = useForm({
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
      const diff = now.getDate() - day + (day === 0 ? -6 : 1);
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

  // Mutations
  const bulkCreateMutation = useMutation({
    mutationFn: async (expensesList) => {
      const response = await api.post('/finance/expenses/bulk', { expenses: expensesList });
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['expenses-summary'] });
      showCustomToast(
        'Expenses Saved!',
        `Successfully recorded ${data.count || data.expenses?.length || 1} expense(s).`,
        'success'
      );
      handleCloseMultiModal();
    },
    onError: (err) => {
      showCustomToast('Save Failed', err.response?.data?.error || 'Failed to save expenses.', 'error');
    }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      const response = await api.put(`/finance/expenses/${id}`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['expenses-summary'] });
      showCustomToast('Expense Updated!', 'The expense entry has been updated.', 'success');
      setEditingExpense(null);
    },
    onError: (err) => {
      showCustomToast('Update Failed', err.response?.data?.error || 'Failed to update expense.', 'error');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      await api.delete(`/finance/expenses/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['expenses-summary'] });
      showCustomToast('Expense Deleted!', 'Expense record removed.', 'success');
      setSelectedExpenseIds(prev => prev.filter(item => item !== deleteMutation.variables));
    },
    onError: (err) => {
      showCustomToast('Delete Failed', err.response?.data?.error || 'Failed to delete expense.', 'error');
    }
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids) => {
      const response = await api.post('/finance/expenses/bulk-delete', { ids });
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['expenses-summary'] });
      showCustomToast('Bulk Delete Complete', `${data.count} expenses removed successfully.`, 'success');
      setSelectedExpenseIds([]);
    },
    onError: (err) => {
      showCustomToast('Bulk Delete Failed', err.response?.data?.error || 'Failed to delete selected expenses.', 'error');
    }
  });

  // Handlers
  const handleOpenMultiModal = () => {
    setBatchRows([
      getInitialBatchRow(1),
      getInitialBatchRow(2),
      getInitialBatchRow(3)
    ]);
    setIsMultiModalOpen(true);
  };

  const handleCloseMultiModal = () => {
    setIsMultiModalOpen(false);
  };

  const handleOpenEditModal = (expense) => {
    setEditingExpense(expense);
    resetEdit({
      title: expense.title,
      amount: parseFloat(expense.amount),
      category: expense.category,
      date: new Date(expense.date).toISOString().split('T')[0],
      notes: expense.notes || ''
    });
  };

  const onEditSubmit = (data) => {
    if (editingExpense) {
      updateMutation.mutate({ id: editingExpense.id, data });
    }
  };

  const handleDeleteSingle = (id, title) => {
    Swal.fire({
      title: 'Delete Expense?',
      text: `Delete "${title}"? This cannot be undone.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Yes, Delete',
      cancelButtonText: 'Cancel',
      reverseButtons: true,
      customClass: {
        popup: 'rounded-xl dark:bg-slate-900 dark:text-white border dark:border-slate-800',
        confirmButton: 'rounded-lg font-bold text-xs px-3 py-1.5',
        cancelButton: 'rounded-lg font-bold text-xs px-3 py-1.5'
      }
    }).then((result) => {
      if (result.isConfirmed) {
        deleteMutation.mutate(id);
      }
    });
  };

  const handleBulkDelete = () => {
    if (selectedExpenseIds.length === 0) return;

    Swal.fire({
      title: `Delete ${selectedExpenseIds.length} Expenses?`,
      text: `Permanently remove ${selectedExpenseIds.length} records.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#64748b',
      confirmButtonText: `Yes, Delete All`,
      cancelButtonText: 'Cancel',
      reverseButtons: true,
      customClass: {
        popup: 'rounded-xl dark:bg-slate-900 dark:text-white border dark:border-slate-800',
        confirmButton: 'rounded-lg font-bold text-xs px-3 py-1.5',
        cancelButton: 'rounded-lg font-bold text-xs px-3 py-1.5'
      }
    }).then((result) => {
      if (result.isConfirmed) {
        bulkDeleteMutation.mutate(selectedExpenseIds);
      }
    });
  };

  // Batch Multi-Expense Operations
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
    const filledRows = batchRows.filter(r => r.title.trim() || r.amount || r.notes.trim());

    if (filledRows.length === 0) {
      showCustomToast('Empty Form', 'Please enter at least one expense.', 'warning');
      return;
    }

    const invalidRow = filledRows.find(
      r => !r.title.trim() || isNaN(parseFloat(r.amount)) || parseFloat(r.amount) <= 0 || !r.category || !r.date
    );

    if (invalidRow) {
      showCustomToast(
        'Validation Error',
        'Each filled row requires Title, positive Amount, Category, and Date.',
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

  // Table Sorting & Pagination
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

  const totalPages = Math.max(1, Math.ceil(sortedExpenses.length / itemsPerPage));
  const paginatedExpenses = useMemo(() => {
    const startIdx = (currentPage - 1) * itemsPerPage;
    return sortedExpenses.slice(startIdx, startIdx + itemsPerPage);
  }, [sortedExpenses, currentPage, itemsPerPage]);

  const isAllCurrentPageSelected = paginatedExpenses.length > 0 && paginatedExpenses.every(e => selectedExpenseIds.includes(e.id));
  const isSomeCurrentPageSelected = paginatedExpenses.some(e => selectedExpenseIds.includes(e.id)) && !isAllCurrentPageSelected;

  const handleToggleSelectAll = () => {
    if (isAllCurrentPageSelected) {
      const currentIds = paginatedExpenses.map(e => e.id);
      setSelectedExpenseIds(prev => prev.filter(id => !currentIds.includes(id)));
    } else {
      const currentIds = paginatedExpenses.map(e => e.id);
      setSelectedExpenseIds(prev => Array.from(new Set([...prev, ...currentIds])));
    }
  };

  const handleToggleSelectRow = (id) => {
    setSelectedExpenseIds(prev =>
      prev.includes(id) ? prev.filter(itemId => itemId !== id) : [...prev, id]
    );
  };

  const getCategoryMeta = (catVal) => {
    return CATEGORIES.find(c => c.value === catVal) || {
      value: catVal,
      label: catVal,
      color: '#64748b',
      bg: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
    };
  };

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

  const selectedTotalAmount = useMemo(() => {
    if (!expenses || selectedExpenseIds.length === 0) return 0;
    return expenses
      .filter(e => selectedExpenseIds.includes(e.id))
      .reduce((acc, curr) => acc + parseFloat(curr.amount || 0), 0);
  }, [expenses, selectedExpenseIds]);

  return (
    <div className="w-full max-w-full px-3 sm:px-5 py-3 space-y-3 mx-auto">
      
      {/* ==========================================
          COMPACT TOP HEADER & ACTION BAR
          ========================================== */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pb-2.5 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] uppercase tracking-wider font-extrabold px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
              Finance
            </span>
            <span className="text-[11px] text-slate-400">/</span>
            <span className="text-[11px] font-semibold text-slate-500">Expenses</span>
          </div>
          <h1 className="text-lg sm:text-xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-1.5 mt-0.5">
            <div className="p-1.5 bg-indigo-600 rounded-lg text-white shadow-xs">
              <DollarSign className="w-4 h-4" />
            </div>
            Expenses Management
          </h1>
        </div>

        {/* Compact Header Actions */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              refetchExpenses();
              refetchSummary();
            }}
            disabled={isFetching}
            className="h-8 px-2.5 rounded-lg border-slate-200 dark:border-slate-700 text-xs font-semibold"
            title="Refresh"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1 ${isFetching ? 'animate-spin text-indigo-500' : ''}`} />
            Refresh
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => downloadExpensesCSV(sortedExpenses, 'all_expenses')}
            className="h-8 px-3 rounded-lg border-slate-200 dark:border-slate-700 text-xs font-semibold"
          >
            <Download className="w-3.5 h-3.5 mr-1 text-emerald-600" />
            Export CSV
          </Button>

          {/* SINGLE PRIMARY BUTTON FOR ALL EXPENSES (MULTI-ROW POPUP) */}
          <Button
            onClick={handleOpenMultiModal}
            className="h-8 px-3.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs cursor-pointer flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Expenses</span>
          </Button>
        </div>
      </div>

      {/* ==========================================
          COMPACT KPI STATISTIC CARDS
          ========================================== */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        {/* Total Expenses */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl p-3 relative overflow-hidden shadow-2xs">
          <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500" />
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
                Total Expenses
              </span>
              <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white font-mono">
                {isSummaryLoading ? <Skeleton className="h-5 w-20" /> : `₹${(summary?.total || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}
              </h2>
              <span className="text-[10px] text-slate-400 block">
                {expenses?.length || 0} transactions
              </span>
            </div>
            <div className="p-2 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 rounded-lg">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
        </div>

        {/* This Month's Spend */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl p-3 relative overflow-hidden shadow-2xs">
          <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500" />
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
                This Month's Spend
              </span>
              <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white font-mono">
                {isSummaryLoading ? <Skeleton className="h-5 w-20" /> : `₹${(summary?.monthly || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}
              </h2>
              <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5">
                <TrendingUp className="w-2.5 h-2.5" />
                <span>Current Cycle</span>
              </span>
            </div>
            <div className="p-2 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 rounded-lg">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
        </div>

        {/* Average Per Expense */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl p-3 relative overflow-hidden shadow-2xs">
          <div className="absolute top-0 left-0 w-1 h-full bg-amber-500" />
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
                Average / Entry
              </span>
              <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white font-mono">
                {isSummaryLoading || !expenses?.length ? (
                  <Skeleton className="h-5 w-16" />
                ) : (
                  `₹${((summary?.total || 0) / (expenses.length || 1)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
                )}
              </h2>
              <span className="text-[10px] text-slate-400 block">Mean ticket</span>
            </div>
            <div className="p-2 bg-amber-50 dark:bg-amber-950/40 text-amber-600 rounded-lg">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
        </div>

        {/* Top Cost Center */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl p-3 relative overflow-hidden shadow-2xs">
          <div className="absolute top-0 left-0 w-1 h-full bg-purple-500" />
          <div className="flex items-center justify-between">
            <div className="space-y-0.5 truncate pr-1">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
                Top Cost Center
              </span>
              <h2 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white truncate">
                {isSummaryLoading ? <Skeleton className="h-5 w-20" /> : topCategory ? topCategory.name : 'None'}
              </h2>
              <span className="text-[10px] font-semibold text-purple-600 font-mono">
                {topCategory ? `₹${topCategory.value.toLocaleString('en-IN')}` : 'No data'}
              </span>
            </div>
            <div className="p-2 bg-purple-50 dark:bg-purple-950/40 text-purple-600 rounded-lg shrink-0">
              <PieChartIcon className="w-4 h-4" />
            </div>
          </div>
        </div>
      </div>

      {/* ==========================================
          COMPACT FILTER TOOLBAR (ZERO CLIPPING, HIGH Z-INDEX)
          ========================================== */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl p-2.5 space-y-2 relative z-30 overflow-visible shadow-2xs">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 overflow-visible">
          
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <Input
              placeholder="Search title, description, category, user..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="pl-8 pr-7 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-xs h-8 rounded-lg focus-visible:ring-indigo-500"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Filter Dropdowns */}
          <div className="flex flex-wrap items-center gap-1.5 overflow-visible">
            <MultiSelectCategoryDropdown
              selectedValues={selectedCategories}
              onChange={(newCategories) => {
                setSelectedCategories(newCategories);
                setCurrentPage(1);
              }}
            />

            <select
              value={datePreset}
              onChange={(e) => {
                setDatePreset(e.target.value);
                setCurrentPage(1);
              }}
              className="px-2.5 py-1 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-700 dark:text-slate-200 font-semibold h-8 cursor-pointer"
            >
              {DATE_PRESETS.map(dp => (
                <option key={dp.id} value={dp.id}>{dp.label}</option>
              ))}
            </select>

            <div className="flex items-center border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-950 overflow-hidden h-8">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="px-2 py-0.5 text-xs bg-transparent border-0 focus:outline-none text-slate-700 dark:text-slate-200 font-semibold cursor-pointer"
              >
                <option value="date">Date</option>
                <option value="amount">Amount</option>
                <option value="title">Title</option>
                <option value="category">Category</option>
              </select>
              <button
                type="button"
                onClick={() => setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'))}
                className="px-1.5 h-full flex items-center justify-center border-l border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 cursor-pointer"
              >
                {sortOrder === 'asc' ? (
                  <ArrowUp className="w-3 h-3 text-indigo-500" />
                ) : (
                  <ArrowDown className="w-3 h-3 text-indigo-500" />
                )}
              </button>
            </div>

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
                className="h-8 px-2 rounded-lg text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-xs font-bold cursor-pointer"
              >
                <RotateCcw className="w-3 h-3 mr-1" />
                Reset
              </Button>
            )}
          </div>
        </div>

        {/* Custom Date Pickers */}
        {datePreset === 'CUSTOM' && (
          <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-100 dark:border-slate-800 text-xs">
            <span className="font-bold text-slate-400 text-[10px] uppercase">Custom:</span>
            <input
              type="date"
              value={customStartDate}
              onChange={(e) => {
                setCustomStartDate(e.target.value);
                setCurrentPage(1);
              }}
              className="px-2 py-1 rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs"
            />
            <span className="text-slate-400 text-xs">to</span>
            <input
              type="date"
              value={customEndDate}
              onChange={(e) => {
                setCustomEndDate(e.target.value);
                setCurrentPage(1);
              }}
              className="px-2 py-1 rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs"
            />
          </div>
        )}

        {/* Active Category Chips */}
        {selectedCategories.length > 0 && (
          <div className="flex flex-wrap items-center gap-1 pt-1 border-t border-slate-100 dark:border-slate-800">
            <span className="text-[10px] font-bold text-slate-400 mr-1">Filtered:</span>
            {selectedCategories.map((catKey) => {
              const meta = getCategoryMeta(catKey);
              return (
                <span
                  key={catKey}
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border ${meta.bg}`}
                >
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: meta.color }} />
                  {meta.label}
                  <button
                    type="button"
                    onClick={() => setSelectedCategories(selectedCategories.filter(c => c !== catKey))}
                    className="hover:opacity-75"
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                </span>
              );
            })}
            <button
              type="button"
              onClick={() => setSelectedCategories([])}
              className="text-[10px] text-slate-400 hover:text-slate-600 underline font-medium ml-1"
            >
              Clear all
            </button>
          </div>
        )}
      </div>

      {/* ==========================================
          FLOATING BULK SELECTION ACTION BAR (NO BLUR)
          ========================================== */}
      {selectedExpenseIds.length > 0 && (
        <div className="sticky top-2 z-40 bg-indigo-950 text-white px-3.5 py-2 rounded-xl shadow-xl border border-indigo-700/50 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="flex items-center justify-center w-5 h-5 rounded bg-indigo-600 text-white font-black text-[11px]">
              {selectedExpenseIds.length}
            </span>
            <span className="font-bold text-xs">
              Selected ({selectedExpenseIds.length}) · ₹{selectedTotalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                const selectedItems = expenses.filter(e => selectedExpenseIds.includes(e.id));
                downloadExpensesCSV(selectedItems, 'selected_expenses');
              }}
              className="h-7 px-2.5 rounded bg-indigo-900 hover:bg-indigo-800 text-white border-indigo-700 text-xs font-semibold"
            >
              <Download className="w-3 h-3 mr-1" />
              Export
            </Button>
            <Button
              size="sm"
              onClick={handleBulkDelete}
              disabled={bulkDeleteMutation.isPending}
              className="h-7 px-2.5 rounded bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs"
            >
              <Trash2 className="w-3 h-3 mr-1" />
              Delete
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setSelectedExpenseIds([])}
              className="h-7 px-2 text-indigo-300 hover:text-white text-xs"
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* ==========================================
          MAIN LAYOUT: LEDGER TABLE + CHARTS
          ========================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        
        {/* Left Side (2 Columns): Table */}
        <div className="lg:col-span-2 space-y-3">
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl overflow-hidden shadow-2xs">
            <div className="p-3 pb-2 flex items-center justify-between border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  Expenses Ledger
                  <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500">
                    {sortedExpenses.length}
                  </span>
                </h3>
              </div>

              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <span className="text-[11px]">Rows:</span>
                <select
                  value={itemsPerPage}
                  onChange={(e) => {
                    setItemsPerPage(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 font-semibold text-xs"
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                </select>
              </div>
            </div>

            {isListLoading ? (
              <div className="p-3 space-y-2">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </div>
            ) : paginatedExpenses.length === 0 ? (
              <div className="text-center py-12 px-3">
                <FileText className="w-8 h-8 mx-auto mb-2 text-slate-300 dark:text-slate-700" />
                <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300">No Expenses Recorded</h4>
                <p className="text-[11px] text-slate-400 mt-0.5">Start by logging your corporate expenses.</p>
                <Button
                  size="sm"
                  onClick={handleOpenMultiModal}
                  className="mt-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-lg h-7 px-3"
                >
                  <Plus className="w-3 h-3 mr-1" />
                  Add Expenses
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table className="text-xs w-full">
                  <TableHeader className="bg-slate-50/80 dark:bg-slate-950/80 border-b border-slate-200 dark:border-slate-800">
                    <TableRow className="hover:bg-transparent dark:border-slate-800">
                      <TableHead className="w-8 text-center py-2">
                        <button
                          type="button"
                          onClick={handleToggleSelectAll}
                          className="text-slate-400 hover:text-indigo-600 cursor-pointer"
                        >
                          {isAllCurrentPageSelected ? (
                            <CheckSquare className="w-3.5 h-3.5 text-indigo-600" />
                          ) : isSomeCurrentPageSelected ? (
                            <MinusSquare className="w-3.5 h-3.5 text-indigo-600" />
                          ) : (
                            <Square className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </TableHead>

                      <TableHead
                        onClick={() => handleSortToggle('date')}
                        className="w-24 font-bold text-slate-600 dark:text-slate-300 py-2 cursor-pointer select-none"
                      >
                        <div className="flex items-center gap-1">
                          <span>Date</span>
                          <ArrowUpDown className="w-2.5 h-2.5 text-slate-400" />
                        </div>
                      </TableHead>

                      <TableHead
                        onClick={() => handleSortToggle('title')}
                        className="font-bold text-slate-600 dark:text-slate-300 py-2 cursor-pointer select-none"
                      >
                        <div className="flex items-center gap-1">
                          <span>Title</span>
                          <ArrowUpDown className="w-2.5 h-2.5 text-slate-400" />
                        </div>
                      </TableHead>

                      <TableHead
                        onClick={() => handleSortToggle('category')}
                        className="w-32 font-bold text-slate-600 dark:text-slate-300 py-2 cursor-pointer select-none"
                      >
                        <div className="flex items-center gap-1">
                          <span>Category</span>
                          <ArrowUpDown className="w-2.5 h-2.5 text-slate-400" />
                        </div>
                      </TableHead>

                      <TableHead
                        onClick={() => handleSortToggle('amount')}
                        className="w-24 text-right font-bold text-slate-600 dark:text-slate-300 py-2 cursor-pointer select-none"
                      >
                        <div className="flex items-center justify-end gap-1">
                          <span>Amount (₹)</span>
                          <ArrowUpDown className="w-2.5 h-2.5 text-slate-400" />
                        </div>
                      </TableHead>

                      <TableHead className="w-20 font-bold text-slate-600 dark:text-slate-300 py-2">
                        User
                      </TableHead>

                      <TableHead className="w-20 text-right font-bold text-slate-600 dark:text-slate-300 py-2 pr-3">
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
                          className={`transition-colors ${
                            isSelected
                              ? 'bg-indigo-50/50 dark:bg-indigo-950/30'
                              : 'hover:bg-slate-50/70 dark:hover:bg-slate-800/30'
                          }`}
                        >
                          <TableCell className="text-center py-2">
                            <button
                              type="button"
                              onClick={() => handleToggleSelectRow(exp.id)}
                              className="text-slate-400 hover:text-indigo-600"
                            >
                              {isSelected ? (
                                <CheckSquare className="w-3.5 h-3.5 text-indigo-600" />
                              ) : (
                                <Square className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </TableCell>

                          <TableCell className="font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap text-[11px]">
                            {new Date(exp.date).toLocaleDateString('en-IN', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric'
                            })}
                          </TableCell>

                          <TableCell className="max-w-[200px]">
                            <div className="font-bold text-slate-900 dark:text-slate-100 truncate text-xs">
                              {exp.title}
                            </div>
                            {exp.notes && (
                              <div className="text-[10px] text-slate-400 truncate">
                                {exp.notes}
                              </div>
                            )}
                          </TableCell>

                          <TableCell className="whitespace-nowrap">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${catMeta.bg}`}>
                              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: catMeta.color }} />
                              {catMeta.label}
                            </span>
                          </TableCell>

                          <TableCell className="text-right font-bold font-mono text-slate-900 dark:text-slate-100 whitespace-nowrap text-xs">
                            ₹{parseFloat(exp.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </TableCell>

                          <TableCell className="text-slate-500 text-[10px] font-medium truncate max-w-[80px]">
                            {exp.user?.name || 'Accountant'}
                          </TableCell>

                          <TableCell className="text-right py-1.5 pr-3 space-x-0.5 whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => setViewingExpense(exp)}
                              className="p-1 rounded text-slate-400 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800"
                              title="View"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenEditModal(exp)}
                              className="p-1 rounded text-slate-400 hover:text-amber-600 hover:bg-slate-100 dark:hover:bg-slate-800"
                              title="Edit"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteSingle(exp.id, exp.title)}
                              className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-slate-100 dark:hover:bg-slate-800"
                              title="Delete"
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

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-3 py-2 border-t border-slate-100 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-950/20 text-xs">
                <span className="text-[11px] text-slate-400">
                  Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, sortedExpenses.length)} of {sortedExpenses.length}
                </span>
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={setCurrentPage}
                />
              </div>
            )}
          </div>
        </div>

        {/* Right Side (1 Column): Charts */}
        <div className="space-y-3">
          {/* Donut Chart */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl p-3 shadow-2xs">
            <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5 pb-2 border-b border-slate-100 dark:border-slate-800">
              <PieChartIcon className="w-3.5 h-3.5 text-indigo-500" />
              Category Breakdown
            </h4>

            {isSummaryLoading ? (
              <div className="h-44 flex items-center justify-center">
                <Skeleton className="w-28 h-28 rounded-full" />
              </div>
            ) : chartData.length === 0 ? (
              <div className="h-44 flex flex-col items-center justify-center text-slate-400 text-xs text-center p-2">
                <PieChartIcon className="w-8 h-8 mb-1 text-slate-300 dark:text-slate-700" />
                <span>No expense data to chart</span>
              </div>
            ) : (
              <div className="h-44 w-full text-xs">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={chartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={65}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(val) => [`₹${Number(val).toLocaleString('en-IN')}`, 'Amount']}
                      contentStyle={{
                        borderRadius: '8px',
                        fontSize: '11px',
                        background: '#0f172a',
                        color: '#fff',
                        border: 'none'
                      }}
                    />
                    <Legend
                      layout="horizontal"
                      verticalAlign="bottom"
                      align="center"
                      iconSize={6}
                      iconType="circle"
                      wrapperStyle={{ fontSize: '9px' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Progress Share */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl p-3 shadow-2xs space-y-2">
            <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5 pb-2 border-b border-slate-100 dark:border-slate-800">
              <BarChart3 className="w-3.5 h-3.5 text-emerald-500" />
              Top Cost Centers
            </h4>

            {chartData.length === 0 ? (
              <div className="text-center py-4 text-xs text-slate-400 italic">
                No records yet
              </div>
            ) : (
              chartData
                .sort((a, b) => b.value - a.value)
                .slice(0, 5)
                .map((item) => {
                  const totalSpend = summary?.total || 1;
                  const percentage = Math.round((item.value / totalSpend) * 100);

                  return (
                    <div key={item.name} className="space-y-1">
                      <div className="flex items-center justify-between text-[11px] font-semibold">
                        <span className="flex items-center gap-1 text-slate-700 dark:text-slate-300 truncate">
                          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                          <span className="truncate">{item.name}</span>
                        </span>
                        <span className="font-mono text-slate-900 dark:text-white font-bold ml-1">
                          ₹{item.value.toLocaleString('en-IN')}
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
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
          </div>
        </div>
      </div>

      {/* ==========================================
          UNIFIED POPUP: MULTI-EXPENSE ENTRY MODAL
          NO BACKGROUND BLUR! CLEAN DIMMED OVERLAY!
          ========================================== */}
      {isMultiModalOpen && (
        <div className="fixed inset-0 z-[10000] bg-black/40 flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-5xl w-full max-h-[88vh] border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col animate__animated animate__zoomIn animate__faster">
            
            {/* Modal Header */}
            <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-950/60">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-indigo-600 rounded-lg text-white">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
                    Record Expenses (Multi-Entry Grid)
                    <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 font-bold uppercase">
                      Fast Entry
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Add one or multiple expenses in a spreadsheet grid and save all at once.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleCloseMultiModal}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Action Bar */}
            <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-950/30 flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleAddBatchRow}
                  className="h-7 px-2.5 rounded-lg border-slate-200 dark:border-slate-700 font-bold text-xs hover:bg-indigo-50 text-indigo-600 dark:text-indigo-400"
                >
                  <Plus className="w-3 h-3 mr-1" />
                  + Add 1 Row
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleAddMultipleBatchRows(3)}
                  className="h-7 px-2.5 rounded-lg border-slate-200 dark:border-slate-700 font-bold text-xs"
                >
                  <PlusCircle className="w-3 h-3 mr-1 text-slate-400" />
                  + Add 3 Rows
                </Button>
              </div>

              {/* Live Count & Total Badge */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">
                  Ready: <strong className="text-slate-900 dark:text-white">{batchStats.validCount}</strong> of {batchRows.length} rows
                </span>
                <span className="px-2.5 py-0.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 font-mono font-bold text-xs">
                  Total: ₹{batchStats.totalSum.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            {/* Editable Spreadsheet Grid */}
            <div className="flex-1 overflow-y-auto p-3 sm:p-4">
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-2xs">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    <tr>
                      <th className="w-8 px-2.5 py-2 text-center">#</th>
                      <th className="min-w-[180px] px-2.5 py-2">Title / Purpose *</th>
                      <th className="w-44 px-2.5 py-2">Category *</th>
                      <th className="w-32 px-2.5 py-2">Amount (₹) *</th>
                      <th className="w-32 px-2.5 py-2">Date *</th>
                      <th className="min-w-[140px] px-2.5 py-2">Notes / Ref</th>
                      <th className="w-16 px-2.5 py-2 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 bg-white dark:bg-slate-900">
                    {batchRows.map((row, idx) => (
                      <tr key={row.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/20">
                        <td className="px-2.5 py-1.5 text-center font-mono font-bold text-slate-400 text-xs">
                          {idx + 1}
                        </td>

                        <td className="px-1.5 py-1.5">
                          <input
                            type="text"
                            placeholder="e.g. Electricity Bill, Courier"
                            value={row.title}
                            onChange={(e) => handleUpdateBatchRow(idx, 'title', e.target.value)}
                            className="w-full px-2 py-1 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium"
                          />
                        </td>

                        <td className="px-1.5 py-1.5">
                          <select
                            value={row.category}
                            onChange={(e) => handleUpdateBatchRow(idx, 'category', e.target.value)}
                            className="w-full px-2 py-1 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium"
                          >
                            {CATEGORIES.map(cat => (
                              <option key={cat.value} value={cat.value}>{cat.label}</option>
                            ))}
                          </select>
                        </td>

                        <td className="px-1.5 py-1.5">
                          <input
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            value={row.amount}
                            onChange={(e) => handleUpdateBatchRow(idx, 'amount', e.target.value)}
                            className="w-full px-2 py-1 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono font-bold text-right"
                          />
                        </td>

                        <td className="px-1.5 py-1.5">
                          <input
                            type="date"
                            value={row.date}
                            onChange={(e) => handleUpdateBatchRow(idx, 'date', e.target.value)}
                            className="w-full px-2 py-1 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium"
                          />
                        </td>

                        <td className="px-1.5 py-1.5">
                          <input
                            type="text"
                            placeholder="Optional notes"
                            value={row.notes}
                            onChange={(e) => handleUpdateBatchRow(idx, 'notes', e.target.value)}
                            className="w-full px-2 py-1 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          />
                        </td>

                        <td className="px-1.5 py-1.5 text-center whitespace-nowrap space-x-0.5">
                          <button
                            type="button"
                            onClick={() => handleDuplicateBatchRow(idx)}
                            className="p-1 rounded text-slate-400 hover:text-indigo-600 hover:bg-slate-100"
                            title="Duplicate"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveBatchRow(idx)}
                            className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-slate-100"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-4 py-2.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 flex items-center justify-between">
              <span className="text-[11px] text-slate-400">
                You can save 1 expense or multiple expenses simultaneously.
              </span>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCloseMultiModal}
                  className="rounded-lg border-slate-200 dark:border-slate-700 text-xs font-bold h-8 px-3"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handleSaveBatchExpenses}
                  disabled={bulkCreateMutation.isPending || batchStats.validCount === 0}
                  className="rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs h-8 px-4 flex items-center gap-1"
                >
                  {bulkCreateMutation.isPending ? (
                    <span>Saving...</span>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                      <span>Save ({batchStats.validCount} Expense{batchStats.validCount !== 1 ? 's' : ''})</span>
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==========================================
          EDIT EXPENSE MODAL (NO BACKGROUND BLUR!)
          ========================================== */}
      {editingExpense && (
        <div className="fixed inset-0 z-[10000] bg-black/40 flex items-center justify-center p-3">
          <div className="bg-white dark:bg-slate-900 rounded-xl max-w-md w-full border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden animate__animated animate__zoomIn animate__faster">
            <div className="px-4 py-2.5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/60 dark:bg-slate-950/60">
              <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                Edit Expense Record
              </h3>
              <button
                type="button"
                onClick={() => setEditingExpense(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <form onSubmit={handleSubmitEdit(onEditSubmit)} className="p-4 space-y-3 text-xs">
              <div className="space-y-1">
                <Label className="text-[10px] font-bold text-slate-500 uppercase">Title / Purpose *</Label>
                <Input
                  {...registerEdit('title', { required: 'Title is required' })}
                  className="h-8 text-xs rounded-lg"
                />
                {editErrors.title && <span className="text-[10px] text-rose-500">{editErrors.title.message}</span>}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-[10px] font-bold text-slate-500 uppercase">Amount (₹) *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    {...registerEdit('amount', { required: 'Amount is required' })}
                    className="h-8 text-xs font-mono font-bold"
                  />
                  {editErrors.amount && <span className="text-[10px] text-rose-500">{editErrors.amount.message}</span>}
                </div>

                <div className="space-y-1">
                  <Label className="text-[10px] font-bold text-slate-500 uppercase">Category *</Label>
                  <select
                    {...registerEdit('category', { required: 'Category is required' })}
                    className="w-full h-8 px-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 font-medium"
                  >
                    {CATEGORIES.map(cat => (
                      <option key={cat.value} value={cat.value}>{cat.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-[10px] font-bold text-slate-500 uppercase">Date *</Label>
                <Controller
                  control={controlEdit}
                  name="date"
                  rules={{ required: 'Date is required' }}
                  render={({ field }) => (
                    <DatePicker
                      value={field.value}
                      onChange={(date) => field.onChange(date ? date.toISOString().split('T')[0] : '')}
                      triggerClassName="h-8 text-xs rounded-lg"
                    />
                  )}
                />
              </div>

              <div className="space-y-1">
                <Label className="text-[10px] font-bold text-slate-500 uppercase">Notes</Label>
                <textarea
                  {...registerEdit('notes')}
                  rows={2}
                  className="w-full p-2 text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 resize-none"
                />
              </div>

              <div className="flex space-x-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditingExpense(null)}
                  className="w-1/2 h-8 text-xs font-bold rounded-lg"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={updateMutation.isPending}
                  className="w-1/2 h-8 text-xs font-bold rounded-lg bg-indigo-600 text-white"
                >
                  Save Changes
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==========================================
          VIEW EXPENSE DETAILS (NO BACKGROUND BLUR!)
          ========================================== */}
      {viewingExpense && (
        <div className="fixed inset-0 z-[10000] bg-black/40 flex items-center justify-center p-3">
          <div className="bg-white dark:bg-slate-900 rounded-xl max-w-sm w-full border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden animate__animated animate__zoomIn animate__faster">
            <div className="px-4 py-2.5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/60 dark:bg-slate-950/60">
              <h3 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-indigo-500" />
                Expense Details
              </h3>
              <button
                type="button"
                onClick={() => setViewingExpense(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="p-4 space-y-3 text-xs">
              <div>
                <span className="text-[9px] font-bold text-slate-400 uppercase block">Title</span>
                <p className="text-sm font-bold text-slate-900 dark:text-white">{viewingExpense.title}</p>
              </div>

              <div className="grid grid-cols-2 gap-2 p-2.5 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-100 dark:border-slate-800">
                <div>
                  <span className="text-[9px] font-bold text-slate-400 uppercase block">Amount</span>
                  <p className="text-base font-black font-mono text-indigo-600 dark:text-indigo-400">
                    ₹{parseFloat(viewingExpense.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div>
                  <span className="text-[9px] font-bold text-slate-400 uppercase block">Date</span>
                  <p className="font-bold text-slate-800 dark:text-slate-200 text-xs mt-0.5">
                    {new Date(viewingExpense.date).toLocaleDateString('en-IN', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric'
                    })}
                  </p>
                </div>
              </div>

              <div>
                <span className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Category</span>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold border ${getCategoryMeta(viewingExpense.category).bg}`}>
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: getCategoryMeta(viewingExpense.category).color }} />
                  {getCategoryMeta(viewingExpense.category).label}
                </span>
              </div>

              {viewingExpense.notes && (
                <div>
                  <span className="text-[9px] font-bold text-slate-400 uppercase block mb-0.5">Notes</span>
                  <p className="p-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 text-[11px] text-slate-600 dark:text-slate-300">
                    {viewingExpense.notes}
                  </p>
                </div>
              )}

              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
                <span>By: <strong>{viewingExpense.user?.name || 'Accountant'}</strong></span>
                <Button
                  size="sm"
                  onClick={() => {
                    setViewingExpense(null);
                    handleOpenEditModal(viewingExpense);
                  }}
                  className="rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs h-7 px-2.5"
                >
                  <Edit2 className="w-3 h-3 mr-1" />
                  Edit
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
