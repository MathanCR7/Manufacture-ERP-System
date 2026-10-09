import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/axios';
import useAuthStore from '@/app/store/authStore';
import { useNavigate, useLocation } from 'react-router-dom';
import { format } from 'date-fns';
import { 
  Download, Search, Edit, Trash2, ArrowLeft, Save, Loader2, 
  AlertTriangle, Plus, Package, Layers, TrendingUp, TrendingDown,
  RefreshCw, Scale, FileText, ArrowRight, ShieldCheck, CheckCircle2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Pagination } from '@/components/ui/Pagination';
import Swal from 'sweetalert2';
import * as XLSX from 'xlsx';

import ProductStockAdjustmentForm from '../components/ProductStockAdjustmentForm';

export default function ProductStockAdjustmentListPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL'); // 'ALL' | 'ADDITION' | 'SUBTRACTION'

  const user = useAuthStore(s => s.user);
  const canEdit = ['MAIN_MASTER', 'SUPERVISOR', 'PURCHASE_ACCOUNTANT', 'PRODUCTION_STAFF'].includes(user?.role);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  const [view, setView] = useState(() => {
    return (canEdit && (location.pathname.endsWith('/add') || location.state?.editData)) ? 'add' : 'list';
  });
  const [editData, setEditData] = useState(() => {
    return (canEdit && location.state?.editData) || null;
  });

  useEffect(() => {
    const isAdd = canEdit && (location.pathname.endsWith('/add') || location.state?.editData);
    setView(isAdd ? 'add' : 'list');
    setEditData(canEdit ? (location.state?.editData || null) : null);
  }, [location.pathname, location.state, canEdit]);

  // Fetch adjustments from backend
  const { data: adjustments = [], isLoading, isFetching, refetch } = useQuery({
    queryKey: ['product-stock-adjustment'],
    queryFn: async () => {
      const res = await api.get('/products/stock-adjustment');
      return res.data || [];
    },
    staleTime: 5000,
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/products/stock-adjustment/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-stock-adjustment'] });
      queryClient.invalidateQueries({ queryKey: ['products-stock'] });

      Swal.fire({
        icon: 'success',
        title: 'Adjustment Deleted',
        text: 'The stock adjustment has been deleted and the product inventory stock has been reverted.',
        timer: 3000,
        showConfirmButton: false,
        toast: true,
        position: 'top-end'
      });
    },
    onError: (err) => {
      Swal.fire({
        icon: 'error',
        title: 'Delete Failed',
        text: err?.response?.data?.error || err.message || 'Could not delete adjustment.',
      });
    }
  });

  const handleDelete = (id, prodName, type, qty, unit) => {
    Swal.fire({
      title: 'Delete Product Adjustment?',
      html: `Are you sure you want to delete adjustment for <b>${prodName}</b>?<br/><span class="text-xs text-rose-500 font-semibold mt-1 block">This will revert the ${type === 'ADDITION' ? `+${qty} ${unit}` : `-${qty} ${unit}`} from inventory stock.</span>`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#e11d48',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Yes, delete & revert',
      cancelButtonText: 'Cancel',
      customClass: {
        popup: 'rounded-3xl shadow-2xl',
        confirmButton: 'rounded-xl text-xs font-bold px-4 py-2',
        cancelButton: 'rounded-xl text-xs font-bold px-4 py-2'
      }
    }).then((result) => {
      if (result.isConfirmed) {
        deleteMutation.mutate(id);
      }
    });
  };

  // Reset pagination when search or filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, typeFilter]);

  const filteredAdjustments = useMemo(() => {
    return adjustments.filter(adj => {
      if (typeFilter !== 'ALL' && adj.type !== typeFilter) return false;
      if (!searchTerm.trim()) return true;

      const q = searchTerm.trim().toLowerCase();
      return (
        (adj.productName && adj.productName.toLowerCase().includes(q)) ||
        (adj.productCode && adj.productCode.toLowerCase().includes(q)) ||
        (adj.productSku && adj.productSku.toLowerCase().includes(q)) ||
        (adj.categoryName && adj.categoryName.toLowerCase().includes(q)) ||
        (adj.notes && adj.notes.toLowerCase().includes(q)) ||
        (adj.createdBy && adj.createdBy.toLowerCase().includes(q)) ||
        (adj.type && adj.type.toLowerCase().includes(q))
      );
    });
  }, [adjustments, typeFilter, searchTerm]);

  // Executive KPI summary metrics
  const { totalCount, totalAdded, totalSubtracted, uniqueProdsCount } = useMemo(() => {
    let added = 0;
    let subtracted = 0;
    const prodSet = new Set();

    adjustments.forEach(a => {
      if (a.productId) prodSet.add(a.productId);
      const qty = Number(a.quantity || 0);
      if (a.type === 'ADDITION') added += qty;
      else subtracted += qty;
    });

    return {
      totalCount: adjustments.length,
      totalAdded: added,
      totalSubtracted: subtracted,
      uniqueProdsCount: prodSet.size
    };
  }, [adjustments]);

  // Export to Excel / CSV
  const handleExport = () => {
    if (filteredAdjustments.length === 0) return;
    const rows = filteredAdjustments.map((a, i) => ({
      'SN': i + 1,
      'Product Code': a.productCode,
      'Product Name': a.productName,
      'SKU': a.productSku || '—',
      'Category': a.categoryName || 'General',
      'Adjustment Type': a.type,
      'Quantity': a.quantity,
      'UOM': a.unit || 'pcs',
      'Reason & Notes': a.notes || '',
      'Adjusted By': a.createdBy || 'System',
      'Date': format(new Date(a.createdAt), 'dd-MM-yyyy HH:mm')
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Product Stock Adjustments');
    XLSX.writeFile(wb, `Product_Stock_Adjustments_${format(new Date(), 'yyyyMMdd_HHmm')}.xlsx`);
  };

  // Pagination calculations
  const totalPages = Math.ceil(filteredAdjustments.length / ITEMS_PER_PAGE);
  const paginatedAdjustments = filteredAdjustments.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  if (view !== 'list') {
    return (
      <ProductStockAdjustmentForm 
        editData={editData} 
        onBack={() => {
          setView('list');
          setEditData(null);
          navigate('/products/stock-adjustment/list');
        }} 
      />
    );
  }

  return (
    <div className="w-full max-w-full px-4 sm:px-6 lg:px-8 py-5 space-y-5 mx-auto transition-all duration-300">
      {/* Read-only restriction alert */}
      {!canEdit && (
        <div className="flex items-center gap-3 p-4 bg-amber-50 dark:bg-amber-955/20 border border-amber-200 dark:border-amber-900/50 rounded-2xl text-amber-800 dark:text-amber-300 text-sm font-medium animate-in fade-in slide-in-from-top-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
          <span>You have <strong>Read-Only access</strong> to Product Stock Adjustments. Modifying physical finished goods stock requires Supervisor or Accountant permissions.</span>
        </div>
      )}

      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-3 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
              <Package className="w-4 h-4" />
            </div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white">
              Product Stock Adjustment
            </h1>
          </div>
          <p className="text-slate-500 dark:text-slate-400 text-xs mt-1 font-medium">
            Directly adjust physical inventory stocks for finished products with audit reason tracking
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="rounded-xl h-9 text-xs font-bold border-slate-200 dark:border-slate-800"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          {canEdit && (
            <Button 
              onClick={() => {
                setView('add');
                setEditData(null);
                navigate('/products/stock-adjustment/add');
              }} 
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 py-2 rounded-xl flex items-center shadow-sm text-xs h-9 cursor-pointer border-none"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Add Stock Adjustment
            </Button>
          )}
        </div>
      </div>

      {/* Metric KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-slate-400 text-[11px] font-bold uppercase tracking-wider">Total Adjustments</p>
            <p className="text-xl font-black text-slate-900 dark:text-white mt-1">{totalCount}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
            <Layers className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-slate-400 text-[11px] font-bold uppercase tracking-wider">Stock Added (+)</p>
            <p className="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-1 font-mono">+{totalAdded.toFixed(2)}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <TrendingUp className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-slate-400 text-[11px] font-bold uppercase tracking-wider">Stock Subtracted (-)</p>
            <p className="text-xl font-black text-rose-600 dark:text-rose-400 mt-1 font-mono">-{totalSubtracted.toFixed(2)}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center">
            <TrendingDown className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-slate-400 text-[11px] font-bold uppercase tracking-wider">Adjusted Products</p>
            <p className="text-xl font-black text-slate-900 dark:text-white mt-1">{uniqueProdsCount}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
            <Package className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Main Table Container */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
        {/* Toolbar */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 bg-slate-50/50 dark:bg-slate-950/50 text-xs">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 flex-1">
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                type="text"
                placeholder="Search by Product Name, Code, SKU, Category, Reason..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 h-9 text-xs rounded-xl bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700"
              />
            </div>

            {/* Type Filter Pills */}
            <div className="flex items-center gap-1 p-0.5 bg-slate-200/60 dark:bg-slate-800 rounded-xl text-[11px] font-bold">
              <button
                type="button"
                onClick={() => setTypeFilter('ALL')}
                className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                  typeFilter === 'ALL'
                    ? 'bg-white dark:bg-slate-900 text-indigo-600 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setTypeFilter('ADDITION')}
                className={`px-3 py-1 rounded-lg transition-colors cursor-pointer flex items-center gap-1 ${
                  typeFilter === 'ADDITION'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-emerald-600'
                }`}
              >
                <span>+ Addition</span>
              </button>
              <button
                type="button"
                onClick={() => setTypeFilter('SUBTRACTION')}
                className={`px-3 py-1 rounded-lg transition-colors cursor-pointer flex items-center gap-1 ${
                  typeFilter === 'SUBTRACTION'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-rose-600'
                }`}
              >
                <span>- Subtraction</span>
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              disabled={filteredAdjustments.length === 0}
              className="rounded-xl h-9 text-xs font-bold border-slate-200 dark:border-slate-800"
            >
              <Download className="w-3.5 h-3.5 mr-1.5" />
              Export
            </Button>
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left min-w-[900px]">
            <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 font-bold border-b border-slate-200 dark:border-slate-800 uppercase tracking-wider text-[10px]">
              <tr>
                <th className="px-4 py-3 w-12 text-center">SN</th>
                <th className="px-4 py-3 w-72">Finished Product</th>
                <th className="px-4 py-3 w-36 text-center">Type</th>
                <th className="px-4 py-3 w-36 text-right">Adjustment Qty</th>
                <th className="px-4 py-3">Audit Reason & Remarks</th>
                <th className="px-4 py-3 w-40">Adjusted By</th>
                <th className="px-4 py-3 w-36">Date</th>
                {canEdit && <th className="px-4 py-3 w-20 text-center">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {isLoading ? (
                <tr>
                  <td colSpan={canEdit ? 8 : 7} className="py-12 text-center text-xs text-slate-400">
                    <Loader2 className="w-6 h-6 animate-spin text-indigo-600 mx-auto mb-2" />
                    <span>Loading product stock adjustments...</span>
                  </td>
                </tr>
              ) : paginatedAdjustments.length === 0 ? (
                <tr>
                  <td colSpan={canEdit ? 8 : 7} className="py-14 text-center text-xs text-slate-400 space-y-2">
                    <Package className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto" />
                    <p className="font-semibold text-slate-600 dark:text-slate-400">No stock adjustments found</p>
                    {canEdit && (
                      <Button
                        size="sm"
                        onClick={() => {
                          setView('add');
                          setEditData(null);
                        }}
                        className="rounded-xl text-xs font-bold bg-indigo-600 text-white mt-2"
                      >
                        <Plus className="w-3.5 h-3.5 mr-1" />
                        Create First Adjustment
                      </Button>
                    )}
                  </td>
                </tr>
              ) : (
                paginatedAdjustments.map((adj, idx) => {
                  const isAddition = adj.type === 'ADDITION';
                  const serialNo = (currentPage - 1) * ITEMS_PER_PAGE + idx + 1;

                  return (
                    <tr key={adj.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="px-4 py-3.5 text-center font-bold text-slate-400">
                        {serialNo}
                      </td>

                      {/* Product details */}
                      <td className="px-4 py-3.5">
                        <div className="font-bold text-slate-900 dark:text-white text-xs">
                          {adj.productName}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5 text-[10px]">
                          <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-1.5 py-0.2 rounded">
                            {adj.productCode}
                          </span>
                          {adj.productSku && (
                            <span className="font-mono text-slate-400">
                              SKU: {adj.productSku}
                            </span>
                          )}
                          <span className="text-slate-400">
                            • {adj.categoryName || 'General'}
                          </span>
                        </div>
                      </td>

                      {/* Adjustment Type Badge */}
                      <td className="px-4 py-3.5 text-center">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                          isAddition
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-300'
                            : 'bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300 border border-rose-300'
                        }`}>
                          {isAddition ? <Plus className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
                          {adj.type}
                        </span>
                      </td>

                      {/* Quantity & Unit */}
                      <td className="px-4 py-3.5 text-right">
                        <span className={`font-mono font-bold text-xs ${
                          isAddition ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                        }`}>
                          {isAddition ? '+' : '-'}{Number(adj.quantity).toFixed(2)}
                        </span>
                        <span className="text-[10px] font-bold text-slate-400 uppercase ml-1">
                          {adj.unit || 'pcs'}
                        </span>
                      </td>

                      {/* Notes / Reason */}
                      <td className="px-4 py-3.5">
                        <p className="text-xs text-slate-700 dark:text-slate-300 line-clamp-2 font-medium">
                          {adj.notes || <span className="text-slate-400 italic">No notes provided</span>}
                        </p>
                      </td>

                      {/* User */}
                      <td className="px-4 py-3.5">
                        <div className="font-semibold text-slate-800 dark:text-slate-200 text-xs">
                          {adj.createdBy || 'Unknown'}
                        </div>
                        {adj.creatorRole && (
                          <div className="text-[10px] text-slate-400">
                            {adj.creatorRole}
                          </div>
                        )}
                      </td>

                      {/* Date */}
                      <td className="px-4 py-3.5 text-slate-500 font-medium">
                        {adj.createdAt ? format(new Date(adj.createdAt), 'dd-MM-yyyy HH:mm') : '—'}
                      </td>

                      {/* Actions */}
                      {canEdit && (
                        <td className="px-4 py-3.5 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                setEditData(adj);
                                setView('add');
                              }}
                              className="p-1 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                              title="Edit adjustment"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(adj.id, adj.productName, adj.type, adj.quantity, adj.unit)}
                              className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                              title="Delete adjustment and revert stock"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="p-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-950/50">
            <span className="text-[11px] text-slate-400 font-medium">
              Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, filteredAdjustments.length)} of {filteredAdjustments.length} records
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
  );
}
