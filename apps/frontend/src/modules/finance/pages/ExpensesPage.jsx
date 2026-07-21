import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import { Plus, Search, Edit2, Trash2, TrendingUp, DollarSign, Calendar, FileText, X } from 'lucide-react';
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

const CATEGORIES = [
  { value: 'RAW_MATERIALS', label: 'Raw Materials' },
  { value: 'SALARIES', label: 'Salaries & Labour' },
  { value: 'UTILITIES', label: 'Utilities & Bills' },
  { value: 'MAINTENANCE', label: 'Repairs & Maintenance' },
  { value: 'LOGISTICS', label: 'Logistics & Transport' },
  { value: 'OFFICE_SUPPLIES', label: 'Office Supplies' },
  { value: 'MARKETING', label: 'Marketing & Sales' },
  { value: 'TAXES', label: 'Taxes & Fees' },
  { value: 'OTHER', label: 'Other' }
];

const COLORS = ['#6366f1', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#8b5cf6', '#06b6d4', '#64748b'];

export default function ExpensesPage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // React Hook Form
  const { register, handleSubmit, reset, control, formState: { errors } } = useForm({
    defaultValues: {
      title: '',
      amount: '',
      category: 'RAW_MATERIALS',
      date: new Date().toISOString().split('T')[0],
      notes: ''
    }
  });

  // Queries
  const { data: expenses, isLoading: isListLoading } = useQuery({
    queryKey: ['expenses', searchTerm, filterCategory],
    queryFn: async () => {
      const params = {};
      if (searchTerm) params.search = searchTerm;
      if (filterCategory) params.category = filterCategory;
      const response = await api.get('/finance/expenses', { params });
      return response.data;
    }
  });

  const { data: summary, isLoading: isSummaryLoading } = useQuery({
    queryKey: ['expenses-summary'],
    queryFn: async () => {
      const response = await api.get('/finance/expenses/summary');
      return response.data;
    }
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: async (data) => {
      const response = await api.post('/finance/expenses', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['expenses-summary'] });
      showToast('Expense Added!', 'The expense has been successfully registered.', 'success');
      handleCloseModal();
    },
    onError: (err) => {
      showToast('Operation Failed', err.response?.data?.error || 'Failed to create expense.', 'error');
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
      showToast('Expense Updated!', 'The expense entry has been successfully updated.', 'success');
      handleCloseModal();
    },
    onError: (err) => {
      showToast('Operation Failed', err.response?.data?.error || 'Failed to update expense.', 'error');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      await api.delete(`/finance/expenses/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['expenses-summary'] });
      showToast('Expense Deleted!', 'The expense entry has been deleted.', 'success');
    },
    onError: (err) => {
      showToast('Operation Failed', err.response?.data?.error || 'Failed to delete expense.', 'error');
    }
  });

  // Helpers
  const showToast = (title, message, icon) => {
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

  const handleOpenAddModal = () => {
    setEditingExpense(null);
    reset({
      title: '',
      amount: '',
      category: 'RAW_MATERIALS',
      date: new Date().toISOString().split('T')[0],
      notes: ''
    });
    setIsModalOpen(true);
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
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingExpense(null);
  };

  const onSubmit = (data) => {
    if (editingExpense) {
      updateMutation.mutate({ id: editingExpense.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleDelete = (id) => {
    Swal.fire({
      title: 'Are you sure?',
      text: "You won't be able to revert this!",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Yes, delete it!'
    }).then((result) => {
      if (result.isConfirmed) {
        deleteMutation.mutate(id);
      }
    });
  };

  const getCategoryLabel = (val) => {
    return CATEGORIES.find(c => c.value === val)?.label || val;
  };

  // Pagination
  const totalPages = expenses ? Math.ceil(expenses.length / itemsPerPage) : 1;
  const paginatedExpenses = expenses ? expenses.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage) : [];

  // Recharts Chart Formatting
  const chartData = summary?.categoryBreakdown?.map(item => ({
    name: getCategoryLabel(item.category),
    value: item.amount
  })).filter(item => item.value > 0) || [];

  return (
    <div className="w-full max-w-full px-4 sm:px-6 lg:px-8 py-5 space-y-4 mx-auto transition-all duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-slate-205 dark:border-slate-800">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center">
            <DollarSign className="w-5.5 h-5.5 mr-2 text-indigo-650 shrink-0" />
            Expenses Management
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium">Track and monitor organizational costs and expenditures.</p>
        </div>
        <Button 
          onClick={handleOpenAddModal} 
          className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition-all font-bold shadow-md text-xs px-4 py-2 cursor-pointer h-9"
        >
          <Plus className="w-4 h-4 mr-1.5" />
          Add Expense
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
        <Card className="relative overflow-hidden bg-white dark:bg-slate-900 border-slate-105 dark:border-slate-850 shadow-xs rounded-2xl">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b from-indigo-500 to-indigo-600" />
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Expenses (All Time)</span>
              <h2 className="text-lg font-black text-slate-900 dark:text-white font-mono block mt-0.5">
                {isSummaryLoading ? <Skeleton className="h-6 w-24" /> : `₹${summary?.total?.toLocaleString('en-IN')}`}
              </h2>
            </div>
            <div className="p-2.5 bg-indigo-50 dark:bg-indigo-955/20 text-indigo-600 dark:text-indigo-400 rounded-xl shrink-0">
              <DollarSign className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden bg-white dark:bg-slate-900 border-slate-105 dark:border-slate-855 shadow-xs rounded-2xl">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b from-emerald-500 to-emerald-600" />
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">This Month's Expenses</span>
              <h2 className="text-lg font-black text-slate-900 dark:text-white font-mono block mt-0.5">
                {isSummaryLoading ? <Skeleton className="h-6 w-24" /> : `₹${summary?.monthly?.toLocaleString('en-IN')}`}
              </h2>
            </div>
            <div className="p-2.5 bg-emerald-50 dark:bg-emerald-955/20 text-emerald-650 dark:text-emerald-450 rounded-xl shrink-0">
              <TrendingUp className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden bg-white dark:bg-slate-900 border-slate-105 dark:border-slate-855 shadow-xs rounded-2xl">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b from-amber-500 to-amber-600" />
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Transactions</span>
              <h2 className="text-lg font-black text-slate-900 dark:text-white block mt-0.5">
                {isListLoading ? <Skeleton className="h-6 w-16" /> : expenses?.length || 0}
              </h2>
            </div>
            <div className="p-2.5 bg-amber-50 dark:bg-amber-955/20 text-amber-600 dark:text-amber-400 rounded-xl shrink-0">
              <Calendar className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left Side: Filter and List Table */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="bg-white dark:bg-slate-900 border-slate-205 dark:border-slate-800 shadow-xs rounded-2xl">
            <CardHeader className="p-4 pb-0">
              <CardTitle className="text-base font-bold text-slate-800 dark:text-slate-100">Expenses Details</CardTitle>
              <CardDescription className="text-xs">Use filters to find specific expenditures.</CardDescription>
            </CardHeader>
            <CardContent className="p-4">
              {/* Filters */}
              <div className="flex flex-col sm:flex-row gap-3 mb-4 text-xs">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-404" />
                  <Input
                    placeholder="Search title, description..."
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="pl-9 bg-white dark:bg-slate-950 border-slate-200 text-xs h-9"
                  />
                </div>
                <select
                  value={filterCategory}
                  onChange={(e) => {
                    setFilterCategory(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full sm:w-48 px-3 py-2 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:text-white font-semibold h-9"
                >
                  <option value="">All Categories</option>
                  {CATEGORIES.map(cat => (
                    <option key={cat.value} value={cat.value}>{cat.label}</option>
                  ))}
                </select>
              </div>

              {/* Table */}
              {isListLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-9 w-full" />
                  <Skeleton className="h-9 w-full" />
                  <Skeleton className="h-9 w-full" />
                </div>
              ) : paginatedExpenses.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <FileText className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <p className="text-xs">No expenses matched your search criteria.</p>
                </div>
              ) : (
                <div className="overflow-x-auto border border-slate-105 dark:border-slate-800 rounded-xl">
                  <Table className="text-xs">
                    <TableHeader className="bg-slate-50 dark:bg-slate-950">
                      <TableRow className="dark:border-slate-800">
                        <TableHead className="w-[110px] text-xs font-semibold text-slate-500 py-3">Date</TableHead>
                        <TableHead className="text-xs font-semibold text-slate-500 py-3">Title</TableHead>
                        <TableHead className="text-xs font-semibold text-slate-500 py-3">Category</TableHead>
                        <TableHead className="text-xs font-semibold text-slate-500 py-3 text-right">Amount</TableHead>
                        <TableHead className="text-xs font-semibold text-slate-500 py-3">Added By</TableHead>
                        <TableHead className="w-[80px] text-right text-xs font-semibold text-slate-500 py-3">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedExpenses.map((exp) => (
                        <TableRow key={exp.id} className="hover:bg-slate-50/40 dark:hover:bg-slate-800/20 dark:border-slate-800">
                          <TableCell className="font-semibold text-slate-700 dark:text-slate-300">
                            {new Date(exp.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </TableCell>
                          <TableCell className="max-w-[200px] truncate">
                            <div>
                              <div className="font-bold text-slate-900 dark:text-slate-100">{exp.title}</div>
                              {exp.notes && <div className="text-[10px] text-slate-400 truncate">{exp.notes}</div>}
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-3xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border dark:border-slate-700">
                              {getCategoryLabel(exp.category)}
                            </span>
                          </TableCell>
                          <TableCell className="font-bold text-slate-900 dark:text-slate-100 text-right font-mono">
                            ₹{parseFloat(exp.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell className="text-slate-500 dark:text-slate-400 text-3xs font-bold">
                            {exp.user?.name || 'N/A'}
                          </TableCell>
                          <TableCell className="text-right space-x-1 whitespace-nowrap">
                            <Button 
                              onClick={() => handleOpenEditModal(exp)}
                              size="icon" 
                              variant="ghost" 
                              className="h-7 w-7 text-indigo-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 rounded-lg"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </Button>
                            <Button 
                              onClick={() => handleDelete(exp.id)}
                              size="icon" 
                              variant="ghost" 
                              className="h-7 w-7 text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/10">
                  <span className="text-[11px] text-slate-455 font-medium">
                    Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, expenses?.length || 0)} of {expenses?.length || 0} entries
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

        {/* Right Side: Charts & Breakdowns */}
        <div className="space-y-4">
          <Card className="bg-white dark:bg-slate-900 border-slate-205 dark:border-slate-800 shadow-xs rounded-2xl">
            <CardHeader className="p-4 pb-0">
              <CardTitle className="text-base font-bold text-slate-800 dark:text-slate-100">Category breakdown</CardTitle>
              <CardDescription className="text-xs">Visualizing cost centers in real-time.</CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              {isSummaryLoading ? (
                <div className="h-60 flex items-center justify-center">
                  <Skeleton className="w-40 h-40 rounded-full bg-slate-100 dark:bg-slate-850" />
                </div>
              ) : chartData.length === 0 ? (
                <div className="h-60 flex items-center justify-center text-slate-400 text-xs italic">
                  No data to show.
                </div>
              ) : (
                <div className="h-60 w-full text-xs">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={chartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={75}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {chartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip 
                        formatter={(value) => [`₹${value.toLocaleString()}`, 'Amount']} 
                        contentStyle={{ borderRadius: '12px', fontSize: '11px' }}
                      />
                      <Legend 
                        layout="horizontal" 
                        verticalAlign="bottom" 
                        align="center"
                        iconSize={8}
                        iconType="circle"
                        wrapperStyle={{ fontSize: '10px' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Expense Modal Overlay */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full border border-slate-205 dark:border-slate-800 shadow-2xl overflow-hidden animate__animated animate__zoomIn animate__faster text-xs flex flex-col">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/30">
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-white uppercase tracking-wide">
                {editingExpense ? 'Edit Expense Record' : 'Record New Expense'}
              </h3>
              <button onClick={handleCloseModal} className="text-slate-400 hover:text-slate-650 transition-colors p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="p-5 space-y-4 text-xs">
              <div className="space-y-1">
                <Label className="text-[10px] font-extrabold text-slate-500 uppercase">Expense Title *</Label>
                <Input 
                  placeholder="e.g., Office Rent, Machinery Belt" 
                  {...register('title', { required: 'Title is required' })}
                  className="bg-white dark:bg-slate-950 rounded-xl border border-slate-200 h-9 text-xs"
                />
                {errors.title && <span className="text-3xs text-rose-500 font-bold">{errors.title.message}</span>}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-[10px] font-extrabold text-slate-500 uppercase">Amount (₹) *</Label>
                  <Input 
                    type="number" 
                    step="0.01" 
                    placeholder="0.00" 
                    {...register('amount', { 
                      required: 'Amount is required',
                      min: { value: 0.01, message: 'Amount must be greater than zero' }
                    })}
                    className="bg-white dark:bg-slate-950 rounded-xl border border-slate-200 h-9 text-xs font-mono"
                  />
                  {errors.amount && <span className="text-3xs text-rose-500 font-bold">{errors.amount.message}</span>}
                </div>

                <div className="space-y-1">
                  <Label className="text-[10px] font-extrabold text-slate-500 uppercase">Category *</Label>
                  <select
                    {...register('category', { required: 'Category is required' })}
                    className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 font-semibold h-9"
                  >
                    {CATEGORIES.map(cat => (
                      <option key={cat.value} value={cat.value}>{cat.label}</option>
                    ))}
                  </select>
                  {errors.category && <span className="text-3xs text-rose-500 font-bold">{errors.category.message}</span>}
                </div>
              </div>

              <div className="space-y-1 flex flex-col w-full relative">
                <Label className="text-[10px] font-extrabold text-slate-500 uppercase">Expense Date *</Label>
                <Controller
                  control={control}
                  name="date"
                  rules={{ required: 'Date is required' }}
                  render={({ field }) => (
                    <DatePicker
                      value={field.value}
                      onChange={(date) => field.onChange(date ? date.toISOString().split('T')[0] : '')}
                      triggerClassName="h-9 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs font-semibold px-3 py-1.5 border-b-px shadow-none"
                    />
                  )}
                />
                {errors.date && <span className="text-3xs text-rose-500 font-bold">{errors.date.message}</span>}
              </div>

              <div className="space-y-1">
                <Label className="text-[10px] font-extrabold text-slate-500 uppercase">Notes / Remarks</Label>
                <textarea
                  placeholder="Optional details or references..."
                  {...register('notes')}
                  rows={2.5}
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-850 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-550/20 text-xs resize-none font-medium"
                />
              </div>

              <div className="flex space-x-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={handleCloseModal}
                  className="w-1/2 rounded-xl border-slate-200 font-bold h-9 text-xs"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="w-1/2 rounded-xl bg-indigo-600 text-white font-bold shadow-md hover:bg-indigo-700 h-9 text-xs cursor-pointer"
                >
                  {editingExpense ? 'Save Changes' : 'Confirm Expense'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
