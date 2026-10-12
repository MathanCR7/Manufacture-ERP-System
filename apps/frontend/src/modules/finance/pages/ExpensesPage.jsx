import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import {
  Plus, Search, Edit2, Trash2, TrendingUp, DollarSign, Calendar, FileText, X,
  Layers, Download, CheckSquare, Square, ChevronDown, Filter,
  ArrowUpDown, ArrowUp, ArrowDown, Copy, PlusCircle, Check,
  RotateCcw, PieChart as PieChartIcon, BarChart3, Eye,
  Paperclip, Upload, Image as ImageIcon,
  ExternalLink, CreditCard, Loader2
} from 'lucide-react';
import { api } from '@/lib/axios';
import DatePicker from '@/components/ui/DatePicker';
import Swal from 'sweetalert2';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from 'recharts';
import { Pagination } from '@/components/ui/Pagination';

// Helper to construct fully qualified static file URL
const getFileUrl = (url) => {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
  const serverHost = apiBase.replace(/\/api\/?$/, '');
  return `${serverHost}${url.startsWith('/') ? '' : '/'}${url}`;
};

// Curated Vibrant Color Palette for Master Categories
const PALETTE = [
  { color: '#10b981', bg: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800' },
  { color: '#6366f1', bg: 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800' },
  { color: '#f59e0b', bg: 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800' },
  { color: '#f97316', bg: 'bg-orange-50 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-800' },
  { color: '#06b6d4', bg: 'bg-cyan-50 dark:bg-cyan-950/40 text-cyan-700 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800' },
  { color: '#a855f7', bg: 'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800' },
  { color: '#ec4899', bg: 'bg-pink-50 dark:bg-pink-950/40 text-pink-700 dark:text-pink-300 border-pink-200 dark:border-pink-800' },
  { color: '#ef4444', bg: 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800' },
  { color: '#3b82f6', bg: 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800' },
  { color: '#64748b', bg: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700' }
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
// DYNAMIC MULTI-CHOICE CATEGORY DROPDOWN COMPONENT
// ==========================================
function MultiSelectCategoryDropdown({ categories = [], selectedValues = [], onChange }) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef(null);

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
    if (!searchQuery.trim()) return categories;
    const q = searchQuery.toLowerCase();
    return categories.filter(c =>
      (c.name && c.name.toLowerCase().includes(q)) ||
      (c.code && c.code.toLowerCase().includes(q))
    );
  }, [categories, searchQuery]);

  const handleToggleCategory = (catName) => {
    if (selectedValues.includes(catName)) {
      onChange(selectedValues.filter(v => v !== catName));
    } else {
      onChange([...selectedValues, catName]);
    }
  };

  const handleSelectAll = () => {
    onChange(categories.map(c => c.name));
  };

  const handleClearAll = () => {
    onChange([]);
  };

  const isAllSelected = categories.length > 0 && selectedValues.length === categories.length;
  const isNoneSelected = selectedValues.length === 0;

  return (
    <div className="relative inline-block z-40" ref={dropdownRef}>
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

      {isOpen && (
        <div
          className="absolute right-0 sm:left-0 top-full mt-1.5 w-72 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-[9999] overflow-hidden"
          style={{ minWidth: '17rem', zIndex: 9999 }}
        >
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

            <div className="flex items-center justify-between mt-1.5 pt-0.5 text-[10px] font-bold">
              <button
                type="button"
                onClick={handleSelectAll}
                className="text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer flex items-center gap-1"
              >
                <CheckSquare className="w-2.5 h-2.5" />
                Select All ({categories.length})
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

          <div className="max-h-56 overflow-y-auto p-1 space-y-0.5">
            {filteredCategories.length === 0 ? (
              <div className="text-center py-4 text-xs text-slate-400 italic">
                No matching categories
              </div>
            ) : (
              filteredCategories.map((cat, idx) => {
                const isSelected = selectedValues.includes(cat.name);
                const colorMeta = PALETTE[idx % PALETTE.length];
                return (
                  <div
                    key={cat.id || cat.name}
                    onClick={() => handleToggleCategory(cat.name)}
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
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: colorMeta.color }} />
                        <span className="text-[11px] font-medium">{cat.name}</span>
                        {cat.code && (
                          <span className="text-[9px] font-mono text-slate-400">({cat.code})</span>
                        )}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

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

  const headers = ['ID', 'Date', 'Expense Title', 'Category', 'Amount (INR)', 'Recorded By', 'Attachments Count', 'Notes'];
  const csvRows = [headers.join(',')];

  expensesList.forEach(item => {
    const attCount = Array.isArray(item.attachments) ? item.attachments.length : 0;
    const row = [
      `"${item.id || ''}"`,
      `"${new Date(item.date).toISOString().split('T')[0]}"`,
      `"${(item.title || '').replace(/"/g, '""')}"`,
      `"${item.category || ''}"`,
      Number(item.amount).toFixed(2),
      `"${(item.user?.name || item.user?.email || 'N/A').replace(/"/g, '""')}"`,
      attCount,
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
  const [itemsPerPage] = useState(10);

  // Multi-Selection State
  const [selectedExpenseIds, setSelectedExpenseIds] = useState([]);

  // Modals State
  const [isMultiModalOpen, setIsMultiModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [viewingExpense, setViewingExpense] = useState(null);

  // Attachments State for Modals
  const [rowAttachmentModalIdx, setRowAttachmentModalIdx] = useState(null);
  const [editAttachments, setEditAttachments] = useState([]);
  const [viewingAttachmentsExpense, setViewingAttachmentsExpense] = useState(null);
  const [isUploadingAttachments, setIsUploadingAttachments] = useState(false);

  // 1. Fetch Dynamic Expense Master Categories
  const { data: masterCategories = [] } = useQuery({
    queryKey: ['expense-categories'],
    queryFn: async () => {
      const res = await api.get('/item-setup/expense-category');
      return Array.isArray(res.data) ? res.data : [];
    }
  });

  // Active categories for dropdowns
  const activeMasterCategories = useMemo(() => {
    const active = masterCategories.filter(c => (c.status || 'ACTIVE') === 'ACTIVE');
    return active.length > 0
      ? active
      : [{ id: 'EXP-DEF', name: 'General Expenses', code: 'EXP-GEN', status: 'ACTIVE' }];
  }, [masterCategories]);

  // Helper to map category to color badge
  const getCategoryMeta = useCallback((catNameOrId) => {
    if (!catNameOrId) return { label: 'General', color: '#64748b', bg: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700' };

    const found = masterCategories.find(c => c.id === catNameOrId || c.name === catNameOrId || c.code === catNameOrId);
    const name = found ? found.name : catNameOrId;

    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = (hash << 5) - hash + name.charCodeAt(i);
      hash |= 0;
    }
    const paletteIdx = Math.abs(hash) % PALETTE.length;
    return {
      label: name,
      code: found?.code,
      id: found?.id,
      ...PALETTE[paletteIdx]
    };
  }, [masterCategories]);

  // Batch Rows State (Default: 3 clean rows with date, category, title, amount, notes, attachments)
  const rowCounterRef = useRef(1);
  const getInitialBatchRow = useCallback((idOffset = 1) => ({
    id: `row_${Date.now()}_${rowCounterRef.current++}_${idOffset}`,
    date: new Date().toISOString().split('T')[0],
    categoryId: activeMasterCategories[0]?.id || '',
    category: activeMasterCategories[0]?.name || 'Raw Materials',
    title: '',
    amount: '',
    notes: '',
    attachments: []
  }), [activeMasterCategories]);

  const [batchRows, setBatchRows] = useState(() => [
    {
      id: 'row_1',
      date: new Date().toISOString().split('T')[0],
      categoryId: '',
      category: 'Raw Materials',
      title: '',
      amount: '',
      notes: '',
      attachments: []
    },
    {
      id: 'row_2',
      date: new Date().toISOString().split('T')[0],
      categoryId: '',
      category: 'Raw Materials',
      title: '',
      amount: '',
      notes: '',
      attachments: []
    },
    {
      id: 'row_3',
      date: new Date().toISOString().split('T')[0],
      categoryId: '',
      category: 'Raw Materials',
      title: '',
      amount: '',
      notes: '',
      attachments: []
    }
  ]);

  // React Hook Form for Single Edit Record
  const {
    register: registerEdit,
    handleSubmit: handleSubmitEdit,
    reset: resetEdit,
    control: controlEdit,
    setValue: setValueEdit,
    formState: { errors: editErrors }
  } = useForm({
    defaultValues: {
      date: new Date().toISOString().split('T')[0],
      categoryId: '',
      category: '',
      title: '',
      amount: '',
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
      queryClient.invalidateQueries({ queryKey: ['expense-categories'] });
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
      queryClient.invalidateQueries({ queryKey: ['expense-categories'] });
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
      queryClient.invalidateQueries({ queryKey: ['expense-categories'] });
      showCustomToast('Expense Deleted!', 'Expense record and attachments permanently removed from server storage.', 'success');
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
      queryClient.invalidateQueries({ queryKey: ['expense-categories'] });
      showCustomToast('Bulk Delete Complete', `${data.count} expenses and attachments removed successfully.`, 'success');
      setSelectedExpenseIds([]);
    },
    onError: (err) => {
      showCustomToast('Bulk Delete Failed', err.response?.data?.error || 'Failed to delete selected expenses.', 'error');
    }
  });

  // Handlers for Multi-Entry Grid
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

  const handleAddBatchRow = () => {
    setBatchRows(prev => [...prev, getInitialBatchRow(prev.length + 1)]);
  };

  const handleAddMultipleBatchRows = (count = 3) => {
    setBatchRows(prev => {
      const newItems = [];
      for (let i = 1; i <= count; i++) {
        newItems.push(getInitialBatchRow(prev.length + i));
      }
      return [...prev, ...newItems];
    });
  };

  const handleDuplicateBatchRow = (idx) => {
    setBatchRows(prev => {
      const target = prev[idx];
      const duplicated = {
        ...target,
        id: Date.now() + Math.random(),
        attachments: [...(target.attachments || [])]
      };
      const copy = [...prev];
      copy.splice(idx + 1, 0, duplicated);
      return copy;
    });
  };

  const handleRemoveBatchRow = (idx) => {
    setBatchRows(prev => {
      if (prev.length <= 1) return [getInitialBatchRow(1)];
      return prev.filter((_, i) => i !== idx);
    });
  };

  const handleUpdateBatchRow = (idx, field, value) => {
    setBatchRows(prev => {
      const copy = [...prev];
      const target = { ...copy[idx] };

      if (field === 'categorySelect') {
        const selectedMaster = activeMasterCategories.find(c => c.id === value || c.name === value);
        target.categoryId = selectedMaster ? selectedMaster.id : '';
        target.category = selectedMaster ? selectedMaster.name : value;
      } else {
        target[field] = value;
      }

      copy[idx] = target;
      return copy;
    });
  };

  const batchStats = useMemo(() => {
    let validCount = 0;
    let totalSum = 0;

    batchRows.forEach(row => {
      const isTitleFilled = row.title && row.title.trim().length > 0;
      const numAmt = parseFloat(row.amount);
      const isAmtValid = !isNaN(numAmt) && numAmt > 0;
      const isCatValid = Boolean(row.category || row.categoryId);
      const isDateValid = Boolean(row.date);

      if (isTitleFilled && isAmtValid && isCatValid && isDateValid) {
        validCount++;
        totalSum += numAmt;
      }
    });

    return { validCount, totalSum };
  }, [batchRows]);

  const handleSaveBatchExpenses = () => {
    const validRows = batchRows.filter(row => {
      const isTitleFilled = row.title && row.title.trim().length > 0;
      const numAmt = parseFloat(row.amount);
      return isTitleFilled && !isNaN(numAmt) && numAmt > 0 && Boolean(row.date);
    });

    if (validRows.length === 0) {
      showCustomToast('Validation Warning', 'Please fill in required fields (Date, Category, Title, Amount > 0).', 'error');
      return;
    }

    const payload = validRows.map(row => ({
      date: row.date,
      categoryId: row.categoryId || undefined,
      category: row.category,
      title: row.title.trim(),
      amount: parseFloat(row.amount),
      notes: row.notes ? row.notes.trim() : null,
      attachments: row.attachments && row.attachments.length > 0 ? row.attachments : undefined
    }));

    bulkCreateMutation.mutate(payload);
  };

  // Upload Attachments for Row
  const handleUploadRowAttachments = async (e, rowIdx) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setIsUploadingAttachments(true);
    try {
      const formData = new FormData();
      files.forEach(f => formData.append('files', f));

      const res = await api.post('/finance/expenses/upload-attachments', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (res.data?.success && res.data?.files) {
        setBatchRows(prev => {
          const copy = [...prev];
          const row = { ...copy[rowIdx] };
          row.attachments = [...(row.attachments || []), ...res.data.files];
          copy[rowIdx] = row;
          return copy;
        });
        showCustomToast('File Uploaded', `${res.data.files.length} attachment(s) uploaded successfully.`, 'success');
      }
    } catch (err) {
      showCustomToast('Upload Failed', err.response?.data?.error || 'Failed to upload attachments.', 'error');
    } finally {
      setIsUploadingAttachments(false);
      if (e.target) e.target.value = '';
    }
  };

  // Remove Attachment from Row
  const handleRemoveRowAttachment = async (rowIdx, fileObj) => {
    try {
      if (fileObj.url) {
        await api.delete('/finance/expenses/attachments', { data: { url: fileObj.url, fileId: fileObj.id } });
      }
      setBatchRows(prev => {
        const copy = [...prev];
        const row = { ...copy[rowIdx] };
        row.attachments = (row.attachments || []).filter(it => it.id !== fileObj.id && it.url !== fileObj.url);
        copy[rowIdx] = row;
        return copy;
      });
      showCustomToast('Attachment Removed', 'File deleted from server storage.', 'success');
    } catch (err) {
      console.warn('Failed to delete attachment from server:', err);
    }
  };

  // Open Edit Modal
  const handleOpenEditModal = (expense) => {
    setEditingExpense(expense);
    setEditAttachments(Array.isArray(expense.attachments) ? [...expense.attachments] : []);
    resetEdit({
      date: new Date(expense.date).toISOString().split('T')[0],
      categoryId: expense.categoryId || activeMasterCategories.find(c => c.name === expense.category)?.id || '',
      category: expense.category,
      title: expense.title,
      amount: parseFloat(expense.amount),
      notes: expense.notes || ''
    });
  };

  // Upload Attachments inside Single Edit Modal
  const handleUploadEditAttachments = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    setIsUploadingAttachments(true);
    try {
      const formData = new FormData();
      files.forEach(f => formData.append('files', f));
      if (editingExpense?.id) {
        formData.append('expenseId', editingExpense.id);
      }

      const res = await api.post('/finance/expenses/upload-attachments', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (res.data?.success && res.data?.files) {
        setEditAttachments(prev => [...prev, ...res.data.files]);
        showCustomToast('Files Uploaded', `${res.data.files.length} attachment(s) uploaded.`, 'success');
      }
    } catch (err) {
      showCustomToast('Upload Failed', err.response?.data?.error || 'Failed to upload attachments.', 'error');
    } finally {
      setIsUploadingAttachments(false);
      if (e.target) e.target.value = '';
    }
  };

  // Remove Attachment inside Single Edit Modal
  const handleRemoveEditAttachment = async (fileObj) => {
    try {
      await api.delete('/finance/expenses/attachments', {
        data: {
          expenseId: editingExpense?.id,
          url: fileObj.url,
          fileId: fileObj.id
        }
      });
      setEditAttachments(prev => prev.filter(it => it.id !== fileObj.id && it.url !== fileObj.url));
      showCustomToast('Attachment Removed', 'File deleted from server storage.', 'success');
    } catch (err) {
      console.warn('Failed to delete attachment:', err);
    }
  };

  // Submit Edit Form
  const onEditSubmit = (data) => {
    if (editingExpense) {
      const selectedCat = activeMasterCategories.find(c => c.id === data.categoryId || c.name === data.category);
      updateMutation.mutate({
        id: editingExpense.id,
        data: {
          date: data.date,
          category: selectedCat ? selectedCat.name : data.category,
          categoryId: selectedCat ? selectedCat.id : data.categoryId,
          title: data.title,
          amount: parseFloat(data.amount),
          notes: data.notes || null,
          attachments: editAttachments
        }
      });
    }
  };

  // Delete Single Expense
  const handleDeleteSingle = (id, title) => {
    const isDark = document.documentElement.classList.contains('dark');
    Swal.fire({
      title: `<span class="text-sm font-bold text-slate-900 dark:text-white">Delete Expense Record?</span>`,
      html: `<div class="text-xs text-slate-600 dark:text-slate-400 mt-1">Delete "${title}"? All associated files in server storage will be permanently wiped.</div>`,
      icon: 'warning',
      iconColor: '#ef4444',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Yes, Delete',
      cancelButtonText: 'Cancel',
      reverseButtons: true,
      background: isDark ? '#0f172a' : '#ffffff',
      color: isDark ? '#f8fafc' : '#0f172a',
      customClass: {
        popup: 'rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl p-5'
      }
    }).then((result) => {
      if (result.isConfirmed) {
        deleteMutation.mutate(id);
      }
    });
  };

  // Bulk Delete
  const handleBulkDelete = () => {
    if (selectedExpenseIds.length === 0) return;
    const isDark = document.documentElement.classList.contains('dark');
    Swal.fire({
      title: `<span class="text-sm font-bold text-slate-900 dark:text-white">Delete ${selectedExpenseIds.length} Expenses?</span>`,
      text: 'All selected expenses and their uploaded receipts/attachments will be permanently removed from disk storage.',
      icon: 'warning',
      iconColor: '#ef4444',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#64748b',
      confirmButtonText: `Yes, Delete All (${selectedExpenseIds.length})`,
      cancelButtonText: 'Cancel',
      reverseButtons: true,
      background: isDark ? '#0f172a' : '#ffffff',
      color: isDark ? '#f8fafc' : '#0f172a',
      customClass: {
        popup: 'rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl p-5'
      }
    }).then((result) => {
      if (result.isConfirmed) {
        bulkDeleteMutation.mutate(selectedExpenseIds);
      }
    });
  };

  // Toggle selection
  const handleToggleSelectRow = (id) => {
    setSelectedExpenseIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleToggleSelectAll = () => {
    if (selectedExpenseIds.length === expenses.length && expenses.length > 0) {
      setSelectedExpenseIds([]);
    } else {
      setSelectedExpenseIds(expenses.map(exp => exp.id));
    }
  };

  // Upload more attachments to existing expense from Viewer modal
  const handleUploadMoreToExistingExpense = async (e, expenseId) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    setIsUploadingAttachments(true);
    try {
      const formData = new FormData();
      files.forEach(f => formData.append('files', f));
      formData.append('expenseId', expenseId);

      const res = await api.post('/finance/expenses/upload-attachments', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (res.data?.success && res.data?.files) {
        queryClient.invalidateQueries({ queryKey: ['expenses'] });
        setViewingAttachmentsExpense(prev => prev ? ({
          ...prev,
          attachments: [...(prev.attachments || []), ...res.data.files]
        }) : null);
        showCustomToast('Attachments Added', `${res.data.files.length} file(s) saved to server folder.`, 'success');
      }
    } catch (err) {
      showCustomToast('Upload Failed', err.response?.data?.error || 'Failed to upload attachments.', 'error');
    } finally {
      setIsUploadingAttachments(false);
      if (e.target) e.target.value = '';
    }
  };

  // Remove attachment from existing expense in Viewer modal
  const handleRemoveFromExistingExpense = async (expenseId, fileObj) => {
    try {
      await api.delete('/finance/expenses/attachments', {
        data: {
          expenseId,
          url: fileObj.url,
          fileId: fileObj.id
        }
      });
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      setViewingAttachmentsExpense(prev => prev ? ({
        ...prev,
        attachments: (prev.attachments || []).filter(it => it.id !== fileObj.id && it.url !== fileObj.url)
      }) : null);
      showCustomToast('Attachment Deleted', 'File removed from disk and database.', 'success');
    } catch {
      showCustomToast('Delete Failed', 'Failed to delete attachment.', 'error');
    }
  };

  // Sorting
  const sortedExpenses = useMemo(() => {
    const list = [...expenses];
    list.sort((a, b) => {
      let valA = a[sortBy];
      let valB = b[sortBy];

      if (sortBy === 'date') {
        valA = new Date(valA).getTime();
        valB = new Date(valB).getTime();
      } else if (sortBy === 'amount') {
        valA = parseFloat(valA) || 0;
        valB = parseFloat(valB) || 0;
      } else if (typeof valA === 'string') {
        valA = valA.toLowerCase();
        valB = (valB || '').toLowerCase();
      }

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
    return list;
  }, [expenses, sortBy, sortOrder]);

  const handleSortToggle = (field) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  // Pagination Slice
  const totalPages = Math.ceil(sortedExpenses.length / itemsPerPage) || 1;
  const paginatedExpenses = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return sortedExpenses.slice(start, start + itemsPerPage);
  }, [sortedExpenses, currentPage, itemsPerPage]);

  // Chart Data
  const chartData = useMemo(() => {
    if (!summary?.categoryBreakdown || summary.categoryBreakdown.length === 0) {
      return [];
    }
    return summary.categoryBreakdown.map((item) => {
      const meta = getCategoryMeta(item.category);
      return {
        name: meta.label,
        value: item.amount,
        color: meta.color
      };
    });
  }, [summary, getCategoryMeta]);

  return (
    <div className="p-3 sm:p-4 md:p-6 space-y-4 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-200/80 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
            <span>Finance</span>
            <span>/</span>
            <span>Expenses</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2 mt-0.5">
            <span className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900">
              <DollarSign className="w-5 h-5 stroke-[2.5]" />
            </span>
            Expenses Management
          </h1>
        </div>

        <div className="flex items-center flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              refetchExpenses();
              refetchSummary();
            }}
            disabled={isFetching}
            className="h-8 px-2.5 rounded-lg border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <RotateCcw className={`w-3.5 h-3.5 mr-1.5 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => downloadExpensesCSV(expenses, 'manufacturing_expenses')}
            className="h-8 px-2.5 rounded-lg border-emerald-200 dark:border-emerald-800/60 text-xs font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/30 hover:bg-emerald-100 dark:hover:bg-emerald-900/40"
          >
            <Download className="w-3.5 h-3.5 mr-1.5" />
            Export CSV
          </Button>

          <Button
            size="sm"
            onClick={handleOpenMultiModal}
            className="h-8 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs"
          >
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            + Add Expenses
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
        <Card className="rounded-xl border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/90 shadow-2xs">
          <CardContent className="p-3 sm:p-3.5 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Expenses</p>
              <h3 className="text-xl sm:text-2xl font-black font-mono text-slate-900 dark:text-white mt-0.5">
                ₹{summary?.total ? summary.total.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
              </h3>
              <p className="text-[10px] text-slate-400 mt-0.5">{expenses.length} total entries</p>
            </div>
            <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-100 dark:border-indigo-900">
              <Layers className="w-4 h-4" />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-xl border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/90 shadow-2xs">
          <CardContent className="p-3 sm:p-3.5 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">This Month's Spend</p>
              <h3 className="text-xl sm:text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400 mt-0.5">
                ₹{summary?.monthly ? summary.monthly.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
              </h3>
              <p className="text-[10px] text-emerald-600/80 dark:text-emerald-400/80 mt-0.5">Current cycle</p>
            </div>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-100 dark:border-emerald-900">
              <TrendingUp className="w-4 h-4" />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-xl border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/90 shadow-2xs">
          <CardContent className="p-3 sm:p-3.5 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Average / Entry</p>
              <h3 className="text-xl sm:text-2xl font-black font-mono text-amber-600 dark:text-amber-400 mt-0.5">
                ₹{expenses.length > 0 && summary?.total ? (summary.total / expenses.length).toLocaleString('en-IN', { maximumFractionDigits: 0 }) : '0.00'}
              </h3>
              <p className="text-[10px] text-slate-400 mt-0.5">Per record</p>
            </div>
            <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-100 dark:border-amber-900">
              <Calendar className="w-4 h-4" />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-xl border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/90 shadow-2xs">
          <CardContent className="p-3 sm:p-3.5 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Top Cost Center</p>
              <h3 className="text-sm sm:text-base font-black text-purple-600 dark:text-purple-400 mt-0.5 truncate max-w-[130px]">
                {summary?.categoryBreakdown && summary.categoryBreakdown.length > 0
                  ? summary.categoryBreakdown.sort((a, b) => b.amount - a.amount)[0]?.category
                  : 'None'}
              </h3>
              <p className="text-[10px] text-purple-500/80 dark:text-purple-400/80 mt-0.5">Highest volume</p>
            </div>
            <div className="w-9 h-9 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center border border-purple-100 dark:border-purple-900">
              <CreditCard className="w-4 h-4" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter and Control Bar */}
      <div className="p-2.5 sm:p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5 text-xs">
        <div className="flex flex-1 items-center gap-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search expenses, title, notes..."
              className="pl-8 h-8 text-xs rounded-lg border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-950"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Dynamic Master Categories Dropdown */}
          <MultiSelectCategoryDropdown
            categories={activeMasterCategories}
            selectedValues={selectedCategories}
            onChange={(newVal) => {
              setSelectedCategories(newVal);
              setCurrentPage(1);
            }}
          />
        </div>

        <div className="flex items-center flex-wrap gap-2 justify-end">
          {/* Date Presets */}
          <select
            value={datePreset}
            onChange={(e) => {
              setDatePreset(e.target.value);
              setCurrentPage(1);
            }}
            className="h-8 px-2.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 font-medium"
          >
            {DATE_PRESETS.map(preset => (
              <option key={preset.id} value={preset.id}>{preset.label}</option>
            ))}
          </select>

          {datePreset === 'CUSTOM' && (
            <div className="flex items-center gap-1">
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => {
                  setCustomStartDate(e.target.value);
                  setCurrentPage(1);
                }}
                className="h-8 px-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
              />
              <span className="text-slate-400">-</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => {
                  setCustomEndDate(e.target.value);
                  setCurrentPage(1);
                }}
                className="h-8 px-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
              />
            </div>
          )}

          {/* Sort By Dropdown */}
          <div className="flex items-center border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden h-8">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="h-full px-2 text-xs bg-white dark:bg-slate-950 font-medium border-0 focus:ring-0"
            >
              <option value="date">Date</option>
              <option value="amount">Amount</option>
              <option value="title">Title</option>
              <option value="category">Category</option>
            </select>
            <button
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              className="px-2 h-full bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border-l border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
              title={sortOrder === 'asc' ? 'Ascending' : 'Descending'}
            >
              {sortOrder === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
            </button>
          </div>

          {/* Bulk Delete Button */}
          {selectedExpenseIds.length > 0 && (
            <Button
              size="sm"
              variant="destructive"
              onClick={handleBulkDelete}
              className="h-8 px-2.5 rounded-lg text-xs font-bold bg-rose-600 hover:bg-rose-700"
            >
              <Trash2 className="w-3 h-3 mr-1" />
              Delete ({selectedExpenseIds.length})
            </Button>
          )}
        </div>
      </div>

      {/* Main Content: Split Grid (Left: Table, Right: Donut & Cost Centers) */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Left Side (3 Columns): Expenses Table */}
        <div className="lg:col-span-3 space-y-3">
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl shadow-2xs overflow-hidden">
            {isListLoading ? (
              <div className="p-4 space-y-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-9 w-full rounded-lg" />
                ))}
              </div>
            ) : sortedExpenses.length === 0 ? (
              <div className="p-12 text-center text-slate-400 text-xs">
                <CreditCard className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-700 mb-2" />
                <p className="font-bold text-sm text-slate-600 dark:text-slate-300">No expense records found</p>
                <p className="mt-1">Click "+ Add Expenses" to record expenses using the fast spreadsheet grid.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table className="text-xs">
                  <TableHeader className="bg-slate-50/70 dark:bg-slate-950/70 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    <TableRow className="border-b border-slate-100 dark:border-slate-800">
                      <TableHead className="w-8 py-2 text-center">
                        <button
                          type="button"
                          onClick={handleToggleSelectAll}
                          className="text-slate-400 hover:text-indigo-600"
                        >
                          {selectedExpenseIds.length === expenses.length && expenses.length > 0 ? (
                            <CheckSquare className="w-3.5 h-3.5 text-indigo-600" />
                          ) : (
                            <Square className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </TableHead>

                      {/* Explicit User Request Order: Date -> Category -> Title -> Amount -> Notes/Ref -> Attachments -> Actions */}
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
                        onClick={() => handleSortToggle('category')}
                        className="w-36 font-bold text-slate-600 dark:text-slate-300 py-2 cursor-pointer select-none"
                      >
                        <div className="flex items-center gap-1">
                          <span>Category</span>
                          <ArrowUpDown className="w-2.5 h-2.5 text-slate-400" />
                        </div>
                      </TableHead>

                      <TableHead
                        onClick={() => handleSortToggle('title')}
                        className="min-w-[180px] font-bold text-slate-600 dark:text-slate-300 py-2 cursor-pointer select-none"
                      >
                        <div className="flex items-center gap-1">
                          <span>Title / Purpose</span>
                          <ArrowUpDown className="w-2.5 h-2.5 text-slate-400" />
                        </div>
                      </TableHead>

                      <TableHead
                        onClick={() => handleSortToggle('amount')}
                        className="w-28 text-right font-bold text-slate-600 dark:text-slate-300 py-2 cursor-pointer select-none"
                      >
                        <div className="flex items-center justify-end gap-1">
                          <span>Amount (₹)</span>
                          <ArrowUpDown className="w-2.5 h-2.5 text-slate-400" />
                        </div>
                      </TableHead>

                      <TableHead className="min-w-[130px] font-bold text-slate-600 dark:text-slate-300 py-2">
                        Reference / Notes
                      </TableHead>

                      <TableHead className="w-28 text-center font-bold text-slate-600 dark:text-slate-300 py-2">
                        Attachments
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
                      const attachmentsCount = Array.isArray(exp.attachments) ? exp.attachments.length : 0;

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

                          {/* 1. Date */}
                          <TableCell className="font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap text-[11px]">
                            {new Date(exp.date).toLocaleDateString('en-IN', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric'
                            })}
                          </TableCell>

                          {/* 2. Category */}
                          <TableCell className="whitespace-nowrap">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${catMeta.bg}`}>
                              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: catMeta.color }} />
                              {catMeta.label}
                            </span>
                          </TableCell>

                          {/* 3. Title / Purpose */}
                          <TableCell className="max-w-[200px]">
                            <div className="font-bold text-slate-900 dark:text-slate-100 truncate text-xs">
                              {exp.title}
                            </div>
                          </TableCell>

                          {/* 4. Amount */}
                          <TableCell className="text-right font-bold font-mono text-slate-900 dark:text-slate-100 whitespace-nowrap text-xs">
                            ₹{parseFloat(exp.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </TableCell>

                          {/* 5. Reference / Notes */}
                          <TableCell className="max-w-[150px] truncate text-[11px] text-slate-500 dark:text-slate-400">
                            {exp.notes || <span className="text-slate-300 dark:text-slate-600 italic">—</span>}
                          </TableCell>

                          {/* 6. Attachments (Optional, Multi-File) */}
                          <TableCell className="text-center whitespace-nowrap">
                            {attachmentsCount > 0 ? (
                              <button
                                type="button"
                                onClick={() => setViewingAttachmentsExpense(exp)}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 transition-colors"
                                title="Click to view/download/manage attachments"
                              >
                                <Paperclip className="w-2.5 h-2.5" />
                                <span>{attachmentsCount} {attachmentsCount === 1 ? 'file' : 'files'}</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setViewingAttachmentsExpense(exp)}
                                className="text-[10px] text-slate-400 hover:text-indigo-600 transition-colors inline-flex items-center gap-0.5"
                                title="Upload attachments to this expense"
                              >
                                <Paperclip className="w-2.5 h-2.5 opacity-60" />
                                <span>+ Add</span>
                              </button>
                            )}
                          </TableCell>

                          {/* 7. User */}
                          <TableCell className="text-slate-500 text-[10px] font-medium truncate max-w-[80px]">
                            {exp.user?.name || 'Accountant'}
                          </TableCell>

                          {/* 8. Actions */}
                          <TableCell className="text-right py-1.5 pr-3 space-x-0.5 whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => setViewingExpense(exp)}
                              className="p-1 rounded text-slate-400 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800"
                              title="View Details"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenEditModal(exp)}
                              className="p-1 rounded text-slate-400 hover:text-amber-600 hover:bg-slate-100 dark:hover:bg-slate-800"
                              title="Edit Expense"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteSingle(exp.id, exp.title)}
                              className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-slate-100 dark:hover:bg-slate-800"
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
                .map((item, idx) => {
                  const maxVal = Math.max(...chartData.map(c => c.value), 1);
                  const pct = Math.round((item.value / maxVal) * 100);
                  return (
                    <div key={idx} className="space-y-1 text-[11px]">
                      <div className="flex justify-between items-center">
                        <span className="font-semibold text-slate-700 dark:text-slate-300 truncate max-w-[120px]">{item.name}</span>
                        <span className="font-mono font-bold text-slate-900 dark:text-white">
                          ₹{item.value.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-300"
                          style={{ width: `${pct}%`, backgroundColor: item.color }}
                        />
                      </div>
                    </div>
                  );
                })
            )}
          </div>
        </div>
      </div>

      {/* =========================================================================
          FAST MULTI-ENTRY GRID MODAL
          Field Order: Date -> Category -> Title -> Amount -> Notes -> Attachments
          ========================================================================= */}
      {isMultiModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-6xl max-h-[92vh] flex flex-col border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-950/50">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900">
                  <Plus className="w-5 h-5 stroke-[2.5]" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                    Record Expenses (Multi-Entry Grid)
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400">
                      FAST ENTRY
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Add one or multiple expenses in a spreadsheet grid and save all at once.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleCloseMultiModal}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
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

              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">
                  Ready: <strong className="text-slate-900 dark:text-white">{batchStats.validCount}</strong> of {batchRows.length} rows
                </span>
                <span className="px-2.5 py-0.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 font-mono font-bold text-xs">
                  Total: ₹{batchStats.totalSum.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            {/* Spreadsheet Grid Table */}
            <div className="flex-1 overflow-y-auto p-3 sm:p-4">
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-2xs">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    <tr>
                      <th className="w-8 px-2.5 py-2 text-center">#</th>
                      {/* USER REQUESTED ORDER: Date -> Category -> Title -> Amount -> Notes -> Attachments -> Actions */}
                      <th className="w-32 px-2.5 py-2">Date *</th>
                      <th className="w-48 px-2.5 py-2">Category *</th>
                      <th className="min-w-[170px] px-2.5 py-2">Title / Purpose *</th>
                      <th className="w-32 px-2.5 py-2">Amount (₹) *</th>
                      <th className="min-w-[140px] px-2.5 py-2">Notes / Ref</th>
                      <th className="w-28 px-2.5 py-2 text-center">Attachments</th>
                      <th className="w-16 px-2.5 py-2 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 bg-white dark:bg-slate-900">
                    {batchRows.map((row, idx) => (
                      <tr key={row.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/20">
                        <td className="px-2.5 py-1.5 text-center font-mono font-bold text-slate-400 text-xs">
                          {idx + 1}
                        </td>

                        {/* 1. Date */}
                        <td className="px-1.5 py-1.5">
                          <input
                            type="date"
                            value={row.date}
                            onChange={(e) => handleUpdateBatchRow(idx, 'date', e.target.value)}
                            className="w-full px-2 py-1 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium"
                          />
                        </td>

                        {/* 2. Category (From Dynamic Master) */}
                        <td className="px-1.5 py-1.5">
                          <select
                            value={row.categoryId || row.category}
                            onChange={(e) => handleUpdateBatchRow(idx, 'categorySelect', e.target.value)}
                            className="w-full px-2 py-1 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium truncate"
                          >
                            {activeMasterCategories.map(cat => (
                              <option key={cat.id || cat.name} value={cat.id || cat.name}>
                                {cat.name} {cat.code ? `(${cat.code})` : ''}
                              </option>
                            ))}
                          </select>
                        </td>

                        {/* 3. Title / Purpose */}
                        <td className="px-1.5 py-1.5">
                          <input
                            type="text"
                            placeholder="e.g. Electricity Bill, Courier"
                            value={row.title}
                            onChange={(e) => handleUpdateBatchRow(idx, 'title', e.target.value)}
                            className="w-full px-2 py-1 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium"
                          />
                        </td>

                        {/* 4. Amount */}
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

                        {/* 5. Notes / Ref */}
                        <td className="px-1.5 py-1.5">
                          <input
                            type="text"
                            placeholder="Optional reference / notes"
                            value={row.notes}
                            onChange={(e) => handleUpdateBatchRow(idx, 'notes', e.target.value)}
                            className="w-full px-2 py-1 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          />
                        </td>

                        {/* 6. Attachments (Button opens Row Attachment Modal) */}
                        <td className="px-1.5 py-1.5 text-center">
                          <button
                            type="button"
                            onClick={() => setRowAttachmentModalIdx(idx)}
                            className={`px-2 py-1 rounded-lg text-[11px] font-bold inline-flex items-center gap-1 border transition-all ${
                              row.attachments && row.attachments.length > 0
                                ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800'
                                : 'bg-slate-50 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700 hover:border-indigo-400'
                            }`}
                          >
                            <Paperclip className="w-3 h-3" />
                            <span>
                              {row.attachments && row.attachments.length > 0
                                ? `${row.attachments.length} File${row.attachments.length > 1 ? 's' : ''}`
                                : '+ Attach'}
                            </span>
                          </button>
                        </td>

                        {/* 7. Actions */}
                        <td className="px-1.5 py-1.5 text-center whitespace-nowrap space-x-0.5">
                          <button
                            type="button"
                            onClick={() => handleDuplicateBatchRow(idx)}
                            className="p-1 rounded text-slate-400 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800"
                            title="Duplicate Row"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveBatchRow(idx)}
                            className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-slate-100 dark:hover:bg-slate-800"
                            title="Delete Row"
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
            <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 flex items-center justify-between">
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
                  className="rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs h-8 px-4 flex items-center gap-1.5"
                >
                  {bulkCreateMutation.isPending ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving...</span>
                    </>
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

      {/* =========================================================================
          ROW ATTACHMENTS MODAL (Inside Multi-Entry Grid)
          ========================================================================= */}
      {rowAttachmentModalIdx !== null && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 bg-black/50 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full border border-slate-200 dark:border-slate-800 shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Paperclip className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <h4 className="font-bold text-xs text-slate-900 dark:text-white uppercase tracking-wider">
                  Attachments: Row #{rowAttachmentModalIdx + 1}
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setRowAttachmentModalIdx(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Upload Area */}
            <div>
              <Label className="text-xs font-bold text-slate-600 dark:text-slate-300 mb-1.5 flex items-center justify-between">
                <span>Upload Receipts / Invoices (PDF, PNG, JPG, WEBP)</span>
                {isUploadingAttachments && (
                  <span className="inline-flex items-center gap-1 text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold">
                    <Loader2 className="w-3 h-3 animate-spin" /> Uploading...
                  </span>
                )}
              </Label>
              <div className="border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl p-4 text-center hover:bg-slate-50 dark:hover:bg-slate-850 transition-colors">
                <input
                  type="file"
                  multiple
                  accept=".pdf,image/png,image/jpeg,image/webp"
                  onChange={(e) => handleUploadRowAttachments(e, rowAttachmentModalIdx)}
                  id="rowFileInput"
                  className="hidden"
                />
                <label htmlFor="rowFileInput" className="cursor-pointer block">
                  <Upload className="w-6 h-6 mx-auto text-indigo-500 mb-1" />
                  <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
                    Click to select multiple files
                  </span>
                  <p className="text-[10px] text-slate-400 mt-0.5">Maximum 25MB per file</p>
                </label>
              </div>
            </div>

            {/* List of uploaded files */}
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {(batchRows[rowAttachmentModalIdx]?.attachments || []).length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-3 italic">
                  No attachments added yet (optional).
                </p>
              ) : (
                (batchRows[rowAttachmentModalIdx]?.attachments || []).map((file, fIdx) => (
                  <div
                    key={file.id || fIdx}
                    className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-800/80 border border-slate-100 dark:border-slate-700 text-xs"
                  >
                    <div className="flex items-center gap-2 truncate mr-2">
                      {file.type?.includes('pdf') ? (
                        <FileText className="w-4 h-4 text-rose-500 shrink-0" />
                      ) : (
                        <ImageIcon className="w-4 h-4 text-emerald-500 shrink-0" />
                      )}
                      <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">{file.name || file.originalName}</span>
                      {file.size && (
                        <span className="text-[10px] text-slate-400 shrink-0">
                          ({(file.size / 1024).toFixed(0)} KB)
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveRowAttachment(rowAttachmentModalIdx, file)}
                      className="p-1 rounded text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                      title="Remove file from server"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <Button
                type="button"
                onClick={() => setRowAttachmentModalIdx(null)}
                className="h-8 px-4 text-xs font-bold bg-indigo-600 text-white rounded-lg"
              >
                Done
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          EDIT EXPENSE RECORD MODAL
          Ordered: Date -> Category -> Title -> Amount -> Notes -> Attachments
          ========================================================================= */}
      {editingExpense && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/50 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/60 dark:bg-slate-950/60">
              <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                <Edit2 className="w-3.5 h-3.5 text-indigo-500" />
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

            <form onSubmit={handleSubmitEdit(onEditSubmit)} className="p-5 space-y-3.5 overflow-y-auto text-xs">
              {/* 1. Date */}
              <div className="space-y-1">
                <Label className="text-[10px] font-bold text-slate-500 uppercase">1. Date *</Label>
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
                {editErrors.date && <span className="text-[10px] text-rose-500">{editErrors.date.message}</span>}
              </div>

              {/* 2. Category (Expense Master Dynamic) */}
              <div className="space-y-1">
                <Label className="text-[10px] font-bold text-slate-500 uppercase flex items-center justify-between">
                  <span>2. Category (Expense Master) *</span>
                  <span className="text-[9px] text-indigo-500 font-normal">Foreign Key Linked</span>
                </Label>
                <Controller
                  control={controlEdit}
                  name="categoryId"
                  rules={{ required: 'Category is required' }}
                  render={({ field }) => (
                    <select
                      value={field.value}
                      onChange={(e) => {
                        field.onChange(e.target.value);
                        const sel = activeMasterCategories.find(c => c.id === e.target.value);
                        if (sel) setValueEdit('category', sel.name);
                      }}
                      className="w-full h-8 px-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 font-medium"
                    >
                      <option value="">Select Category...</option>
                      {activeMasterCategories.map(cat => (
                        <option key={cat.id || cat.name} value={cat.id || cat.name}>
                          {cat.name} {cat.code ? `(${cat.code})` : ''}
                        </option>
                      ))}
                    </select>
                  )}
                />
                {editErrors.categoryId && <span className="text-[10px] text-rose-500">{editErrors.categoryId.message}</span>}
              </div>

              {/* 3. Title / Purpose */}
              <div className="space-y-1">
                <Label className="text-[10px] font-bold text-slate-500 uppercase">3. Title / Purpose *</Label>
                <Input
                  {...registerEdit('title', { required: 'Title is required' })}
                  placeholder="e.g. Courier charges, Machine repair"
                  className="h-8 text-xs rounded-lg"
                />
                {editErrors.title && <span className="text-[10px] text-rose-500">{editErrors.title.message}</span>}
              </div>

              {/* 4. Amount */}
              <div className="space-y-1">
                <Label className="text-[10px] font-bold text-slate-500 uppercase">4. Amount (₹) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  {...registerEdit('amount', { required: 'Amount is required' })}
                  className="h-8 text-xs font-mono font-bold"
                />
                {editErrors.amount && <span className="text-[10px] text-rose-500">{editErrors.amount.message}</span>}
              </div>

              {/* 5. Reference / Notes */}
              <div className="space-y-1">
                <Label className="text-[10px] font-bold text-slate-500 uppercase">5. Reference Note</Label>
                <textarea
                  {...registerEdit('notes')}
                  rows={2}
                  placeholder="Optional reference number or extra details"
                  className="w-full p-2 text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 resize-none"
                />
              </div>

              {/* 6. Attachments (Multiple, Server-Managed) */}
              <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <Label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
                    <Paperclip className="w-3 h-3 text-indigo-500" />
                    <span>6. Attachments ({editAttachments.length})</span>
                  </Label>
                  <label
                    htmlFor="editFileInput"
                    className="cursor-pointer text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" />
                    Add Files
                  </label>
                  <input
                    type="file"
                    id="editFileInput"
                    multiple
                    accept=".pdf,image/png,image/jpeg,image/webp"
                    onChange={handleUploadEditAttachments}
                    className="hidden"
                  />
                </div>

                {editAttachments.length === 0 ? (
                  <p className="text-[11px] text-slate-400 italic">No attachments for this expense.</p>
                ) : (
                  <div className="space-y-1.5 max-h-36 overflow-y-auto">
                    {editAttachments.map((att, aIdx) => (
                      <div
                        key={att.id || aIdx}
                        className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-xs"
                      >
                        <div className="flex items-center gap-2 truncate mr-2">
                          {att.type?.includes('pdf') ? (
                            <FileText className="w-4 h-4 text-rose-500 shrink-0" />
                          ) : (
                            <ImageIcon className="w-4 h-4 text-emerald-500 shrink-0" />
                          )}
                          <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">{att.name || att.originalName}</span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {att.url && (
                            <a
                              href={getFileUrl(att.url)}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1 rounded text-slate-400 hover:text-indigo-600"
                              title="View Attachment"
                            >
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                          <button
                            type="button"
                            onClick={() => handleRemoveEditAttachment(att)}
                            className="p-1 rounded text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                            title="Remove file from server"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Submit Buttons */}
              <div className="flex space-x-2 pt-3 border-t border-slate-100 dark:border-slate-800">
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
                  {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          ATTACHMENT VIEWER & MANAGER MODAL (Opened from main table)
          ========================================================================= */}
      {viewingAttachmentsExpense && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-xl w-full border border-slate-200 dark:border-slate-800 shadow-2xl p-5 space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Paperclip className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <div>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                    Expense Attachments
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    "{viewingAttachmentsExpense.title}" • ₹{parseFloat(viewingAttachmentsExpense.amount).toLocaleString('en-IN')}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setViewingAttachmentsExpense(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Upload Area for this Expense */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700">
              <div>
                <p className="text-xs font-bold text-slate-800 dark:text-slate-200">Upload New Attachment</p>
                <p className="text-[10px] text-slate-400">PDF, PNG, JPG, or WEBP up to 25MB</p>
              </div>
              <label className="cursor-pointer">
                <input
                  type="file"
                  multiple
                  accept=".pdf,image/png,image/jpeg,image/webp"
                  onChange={(e) => handleUploadMoreToExistingExpense(e, viewingAttachmentsExpense.id)}
                  className="hidden"
                />
                <span className="h-8 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs inline-flex items-center gap-1.5 shadow-xs">
                  <Upload className="w-3.5 h-3.5" />
                  Upload Files
                </span>
              </label>
            </div>

            {/* List / Preview of attachments */}
            <div className="flex-1 overflow-y-auto space-y-2 max-h-72">
              {(!viewingAttachmentsExpense.attachments || viewingAttachmentsExpense.attachments.length === 0) ? (
                <div className="text-center py-8 text-slate-400">
                  <Paperclip className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-700 mb-1" />
                  <p className="text-xs font-semibold">No attachments yet</p>
                  <p className="text-[11px]">Upload receipts or PDF invoices above.</p>
                </div>
              ) : (
                viewingAttachmentsExpense.attachments.map((file, idx) => {
                  const isPdf = file.type?.includes('pdf') || (file.url && file.url.toLowerCase().endsWith('.pdf'));
                  const fullUrl = getFileUrl(file.url);

                  return (
                    <div
                      key={file.id || idx}
                      className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between gap-3 shadow-2xs hover:border-indigo-200 transition-colors"
                    >
                      <div className="flex items-center gap-3 truncate">
                        <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 border border-slate-200 dark:border-slate-700 overflow-hidden">
                          {isPdf ? (
                            <FileText className="w-5 h-5 text-rose-500" />
                          ) : (
                            <img
                              src={fullUrl}
                              alt={file.name}
                              className="w-full h-full object-cover"
                              onError={(e) => { e.currentTarget.style.display = 'none'; }}
                            />
                          )}
                        </div>

                        <div className="truncate">
                          <p className="font-bold text-xs text-slate-900 dark:text-white truncate">
                            {file.name || file.originalName || 'Document'}
                          </p>
                          <p className="text-[10px] text-slate-400">
                            {file.size ? `${(file.size / 1024).toFixed(0)} KB • ` : ''}
                            {isPdf ? 'PDF Document' : 'Image File'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <a
                          href={fullUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="h-7 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 inline-flex items-center gap-1"
                        >
                          <ExternalLink className="w-3 h-3" />
                          View
                        </a>

                        <a
                          href={fullUrl}
                          download={file.name || 'expense_attachment'}
                          className="h-7 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 inline-flex items-center gap-1"
                        >
                          <Download className="w-3 h-3" />
                          Download
                        </a>

                        <button
                          type="button"
                          onClick={() => handleRemoveFromExistingExpense(viewingAttachmentsExpense.id, file)}
                          className="h-7 w-7 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 inline-flex items-center justify-center"
                          title="Delete from server storage"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center text-xs text-slate-400">
              <span>Removing an attachment permanently purges it from server disk.</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setViewingAttachmentsExpense(null)}
                className="h-8 px-3 rounded-lg"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          VIEW EXPENSE DETAILS MODAL
          ========================================================================= */}
      {viewingExpense && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/40 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full border border-slate-200 dark:border-slate-800 shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
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

            <div className="space-y-3 text-xs">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Title / Purpose</span>
                <p className="text-sm font-bold text-slate-900 dark:text-white">{viewingExpense.title}</p>
              </div>

              <div className="grid grid-cols-2 gap-2 p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-100 dark:border-slate-800">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Amount</span>
                  <p className="text-base font-black font-mono text-indigo-600 dark:text-indigo-400">
                    ₹{parseFloat(viewingExpense.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Date</span>
                  <p className="font-semibold text-slate-800 dark:text-slate-200">
                    {new Date(viewingExpense.date).toLocaleDateString('en-IN', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric'
                    })}
                  </p>
                </div>
              </div>

              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Category</span>
                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border mt-1 ${getCategoryMeta(viewingExpense.category).bg}`}>
                  {viewingExpense.category}
                </span>
              </div>

              {viewingExpense.notes && (
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Reference / Notes</span>
                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5 p-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800">
                    {viewingExpense.notes}
                  </p>
                </div>
              )}

              {viewingExpense.attachments && Array.isArray(viewingExpense.attachments) && viewingExpense.attachments.length > 0 && (
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                    Attachments ({viewingExpense.attachments.length})
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {viewingExpense.attachments.map((file, fIdx) => (
                      <a
                        key={fIdx}
                        href={getFileUrl(file.url)}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 hover:underline"
                      >
                        <Paperclip className="w-3 h-3" />
                        <span className="truncate max-w-[150px]">{file.name || 'File'}</span>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <Button
                type="button"
                onClick={() => setViewingExpense(null)}
                className="h-8 px-4 text-xs font-bold bg-indigo-600 text-white rounded-lg"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
