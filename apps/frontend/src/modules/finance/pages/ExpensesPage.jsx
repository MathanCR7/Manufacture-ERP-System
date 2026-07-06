import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import { Plus, Search, Edit2, Trash2, TrendingUp, DollarSign, Calendar, FileText, X } from 'lucide-react';
import { api } from '@/lib/axios';
import Swal from 'sweetalert2';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from 'recharts';

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
  const itemsPerPage = 8;

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
    <div className="space-y-8 p-1">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-50">Expenses Management</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Track and monitor organizational costs and direct expenditures.</p>
        </div>
        <Button 
          onClick={handleOpenAddModal} 
          className="flex items-center px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors font-medium shadow-md shadow-indigo-500/10"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Expense
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="relative overflow-hidden bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b from-indigo-500 to-indigo-600" />
          <CardContent className="p-6 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Expenses (All Time)</span>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-50">
                {isSummaryLoading ? <Skeleton className="h-8 w-28" /> : `₹${summary?.total?.toLocaleString('en-IN')}`}
              </h2>
            </div>
            <div className="p-3 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-500 rounded-xl">
              <DollarSign className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b from-emerald-500 to-emerald-600" />
          <CardContent className="p-6 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">This Month's Expenses</span>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-50">
                {isSummaryLoading ? <Skeleton className="h-8 w-28" /> : `₹${summary?.monthly?.toLocaleString('en-IN')}`}
              </h2>
            </div>
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-500 rounded-xl">
              <TrendingUp className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b from-amber-500 to-amber-600" />
          <CardContent className="p-6 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Transactions</span>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-50">
                {isListLoading ? <Skeleton className="h-8 w-16" /> : expenses?.length || 0}
              </h2>
            </div>
            <div className="p-3 bg-amber-50 dark:bg-amber-950/50 text-amber-500 rounded-xl">
              <Calendar className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Side: Filter and List Table */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm">
            <CardHeader className="p-5 pb-0">
              <CardTitle className="text-lg font-bold text-slate-800 dark:text-slate-100">Expenses Details</CardTitle>
              <CardDescription>Use filters to find specific expenditures.</CardDescription>
            </CardHeader>
            <CardContent className="p-5">
              {/* Filters */}
              <div className="flex flex-col sm:flex-row gap-4 mb-6">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="Search title, description..."
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="pl-9 bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800"
                  />
                </div>
                <select
                  value={filterCategory}
                  onChange={(e) => {
                    setFilterCategory(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full sm:w-48 px-3 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:text-white"
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
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : paginatedExpenses.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">No expenses matched your search criteria.</p>
                </div>
              ) : (
                <div className="overflow-x-auto border border-slate-100 dark:border-slate-800 rounded-lg">
                  <Table>
                    <TableHeader className="bg-slate-50 dark:bg-slate-850/50">
                      <TableRow className="dark:border-slate-800">
                        <TableHead className="w-[100px] text-xs font-semibold uppercase tracking-wider text-slate-500">Date</TableHead>
                        <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500">Title</TableHead>
                        <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500">Category</TableHead>
                        <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500">Amount</TableHead>
                        <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500">Added By</TableHead>
                        <TableHead className="w-[80px] text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedExpenses.map((exp) => (
                        <TableRow key={exp.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 dark:border-slate-800">
                          <TableCell className="font-medium text-slate-700 dark:text-slate-300">
                            {new Date(exp.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </TableCell>
                          <TableCell className="max-w-[200px] truncate">
                            <div>
                              <div className="font-semibold text-slate-900 dark:text-slate-100">{exp.title}</div>
                              {exp.notes && <div className="text-xs text-slate-400 truncate">{exp.notes}</div>}
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200">
                              {getCategoryLabel(exp.category)}
                            </span>
                          </TableCell>
                          <TableCell className="font-bold text-slate-900 dark:text-slate-100">
                            ₹{parseFloat(exp.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell className="text-slate-500 dark:text-slate-400 text-xs">
                            {exp.user?.name || 'N/A'}
                          </TableCell>
                          <TableCell className="text-right space-x-1 whitespace-nowrap">
                            <Button 
                              onClick={() => handleOpenEditModal(exp)}
                              size="icon" 
                              variant="ghost" 
                              className="h-8 w-8 text-indigo-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/30"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </Button>
                            <Button 
                              onClick={() => handleDelete(exp.id)}
                              size="icon" 
                              variant="ghost" 
                              className="h-8 w-8 text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30"
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
                <div className="flex items-center justify-between mt-6 pt-4 border-t border-slate-100 dark:border-slate-800">
                  <span className="text-xs text-slate-400">
                    Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, expenses?.length || 0)} of {expenses?.length || 0} entries
                  </span>
                  <div className="flex space-x-2">
                    <Button
                      onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                      disabled={currentPage === 1}
                      variant="outline"
                      className="px-3 py-1 text-xs border-slate-200 dark:border-slate-800 dark:text-slate-300"
                    >
                      Previous
                    </Button>
                    <Button
                      onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                      disabled={currentPage === totalPages}
                      variant="outline"
                      className="px-3 py-1 text-xs border-slate-200 dark:border-slate-800 dark:text-slate-300"
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Side: Charts / Breakdown */}
        <div className="space-y-6">
          <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm">
            <CardHeader className="p-5">
              <CardTitle className="text-lg font-bold text-slate-800 dark:text-slate-100">Expenditure Share</CardTitle>
              <CardDescription>Interactive pie chart representing cost split by category.</CardDescription>
            </CardHeader>
            <CardContent className="p-5 pt-0">
              {isSummaryLoading ? (
                <Skeleton className="h-[220px] w-full" />
              ) : chartData.length === 0 ? (
                <div className="text-center py-16 text-slate-400 text-xs">
                  No expense records found.
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="h-[220px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={chartData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {chartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip 
                          formatter={(value) => `₹${value.toLocaleString('en-IN')}`}
                          contentStyle={{
                            background: 'rgba(15, 23, 42, 0.9)',
                            border: 'none',
                            borderRadius: '8px',
                            color: '#fff',
                            fontSize: '11px'
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="space-y-2">
                    {chartData.map((item, idx) => (
                      <div key={item.name} className="flex justify-between items-center text-xs text-slate-600 dark:text-slate-350">
                        <div className="flex items-center space-x-2">
                          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                          <span className="font-medium">{item.name}</span>
                        </div>
                        <span className="font-bold text-slate-900 dark:text-slate-100">₹{item.value.toLocaleString('en-IN')}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <Card className="w-full max-w-lg bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-2xl relative animate-in fade-in zoom-in duration-205">
            <button 
              onClick={handleCloseModal}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
            <CardHeader className="p-6">
              <CardTitle className="text-xl font-bold text-slate-900 dark:text-slate-50">
                {editingExpense ? 'Edit Expense Record' : 'Record New Expense'}
              </CardTitle>
              <CardDescription>
                Provide the details of the organizational expense.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6 pt-0">
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="title" className="text-xs font-semibold text-slate-700 dark:text-slate-300">Expense Title *</Label>
                  <Input 
                    id="title"
                    placeholder="e.g. Electricity Bill - June"
                    {...register('title', { required: 'Title is required' })}
                    className="bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800"
                  />
                  {errors.title && <p className="text-xs text-rose-500">{errors.title.message}</p>}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="amount" className="text-xs font-semibold text-slate-700 dark:text-slate-300">Amount (₹) *</Label>
                    <Input 
                      id="amount"
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      {...register('amount', { 
                        required: 'Amount is required',
                        min: { value: 0.01, message: 'Amount must be greater than zero' }
                      })}
                      className="bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 font-bold"
                    />
                    {errors.amount && <p className="text-xs text-rose-500">{errors.amount.message}</p>}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="date" className="text-xs font-semibold text-slate-700 dark:text-slate-300">Expense Date *</Label>
                    <Input 
                      id="date"
                      type="date"
                      {...register('date', { required: 'Date is required' })}
                      className="bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800"
                    />
                    {errors.date && <p className="text-xs text-rose-500">{errors.date.message}</p>}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="category" className="text-xs font-semibold text-slate-700 dark:text-slate-300">Expense Category *</Label>
                  <select
                    id="category"
                    {...register('category', { required: 'Category is required' })}
                    className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:text-white"
                  >
                    {CATEGORIES.map(cat => (
                      <option key={cat.value} value={cat.value}>{cat.label}</option>
                    ))}
                  </select>
                  {errors.category && <p className="text-xs text-rose-500">{errors.category.message}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes" className="text-xs font-semibold text-slate-700 dark:text-slate-300">Description / Notes</Label>
                  <textarea
                    id="notes"
                    rows="3"
                    placeholder="Attach invoice receipt, payment method, or other reference notes..."
                    {...register('notes')}
                    className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:text-white"
                  />
                </div>

                <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-100 dark:border-slate-800">
                  <Button 
                    type="button" 
                    onClick={handleCloseModal}
                    variant="outline" 
                    className="px-4 py-2 border-slate-200 dark:border-slate-850 dark:text-slate-300"
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={createMutation.isPending || updateMutation.isPending}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors font-medium shadow-md shadow-indigo-500/10"
                  >
                    {editingExpense ? 'Update Entry' : 'Save Expense'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
