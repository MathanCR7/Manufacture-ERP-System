import React, { useState, useEffect, useMemo } from 'react';
import { api } from '@/lib/axios';
import {
  RotateCcw,
  FileText,
  RefreshCw,
  Archive,
  Trash2,
  AlertTriangle,
  Plus,
  Eye,
  Edit3,
  Search,
  Filter,
  DollarSign,
  Package,
  AlertCircle,
  Phone,
  User,
  Calendar,
  MapPin,
  Receipt,
  ArrowRight,
  ShieldCheck,
  Printer,
  X,
  CheckCircle2,
  Clock,
  Layers,
  Check,
  TrendingDown,
  Calculator,
  SlidersHorizontal,
  Info
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import SearchSelect from '@/components/ui/SearchSelect';
import Swal from 'sweetalert2';
import { Pagination } from '@/components/ui/Pagination';
import useAuthStore from '@/app/store/authStore';

export default function SalesReturnsPage() {
  const user = useAuthStore(s => s.user);
  const canEdit = user?.role !== 'SUPERVISOR';
  const isAdmin = ['MAIN_MASTER', 'SUPERVISOR'].includes(user?.role);

  // Main navigation tab: 'list' | 'create'
  const [activeTab, setActiveTab] = useState('list');

  // Data states
  const [returnsHistory, setReturnsHistory] = useState([]);
  const [recentOrders, setRecentOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Form states for Logging Return
  const [invoiceNo, setInvoiceNo] = useState('');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [reason, setReason] = useState('Quality Issue');
  const [refundMethod, setRefundMethod] = useState('Credit Note');
  const [notes, setNotes] = useState('');
  const [invoiceProducts, setInvoiceProducts] = useState([]);
  const [returnedItems, setReturnedItems] = useState([]);

  // Manual Overall Refund Override state
  const [customTotalRefund, setCustomTotalRefund] = useState('');
  const [isManualTotalRefund, setIsManualTotalRefund] = useState(false);

  // Modals state
  const [viewingReturn, setViewingReturn] = useState(null);
  const [editingReturn, setEditingReturn] = useState(null);
  const [editFormData, setEditFormData] = useState({
    reason: '',
    refundMethod: '',
    refundAmount: '',
    status: '',
    notes: ''
  });
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Filtering & Pagination for Records Table
  const [searchQuery, setSearchQuery] = useState('');
  const [schemeFilter, setSchemeFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 8;

  // Fetch returns history and recent orders
  const fetchPageResources = async () => {
    setLoading(true);
    try {
      const returnRes = await api.get('/sales/returns');
      setReturnsHistory(returnRes.data || []);

      const ordersRes = await api.get('/orders');
      const ordersSorted = (ordersRes.data || []).sort(
        (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
      );
      setRecentOrders(ordersSorted);
    } catch (e) {
      console.error('Error fetching return resources', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPageResources();
  }, []);

  // When selected order changes in the Create Return tab
  const handleSelectOrder = (refNo) => {
    if (!refNo) {
      setInvoiceNo('');
      setSelectedOrder(null);
      setInvoiceProducts([]);
      setReturnedItems([]);
      setCustomTotalRefund('');
      setIsManualTotalRefund(false);
      return;
    }

    setInvoiceNo(refNo);
    const ord = recentOrders.find(
      o => o.referenceNo === refNo || o.docNo === refNo || o.id === refNo
    );

    if (ord) {
      setSelectedOrder(ord);
      const products = (ord.items || []).map(item => ({
        productId: item.productId,
        name: item.product?.name || item.name || item.productName || 'Finished Product',
        code: item.product?.code || item.product?.sku || 'P-ITEM',
        uom: item.uomName || item.product?.unit?.name || 'pcs',
        unitPrice: Number(item.unitPrice || item.product?.salePrice || 0),
        gstRate: Number(item.gstRate || 0),
        maxQty: Number(item.quantity || 0)
      }));
      setInvoiceProducts(products);
      setReturnedItems([]);
      setCustomTotalRefund('');
      setIsManualTotalRefund(false);
    } else {
      setSelectedOrder(null);
      setInvoiceProducts([]);
      setReturnedItems([]);
      setCustomTotalRefund('');
      setIsManualTotalRefund(false);
    }
  };

  // Add product to returned items docket
  const handleAddItemToReturn = (prod) => {
    if (returnedItems.some(i => i.productId === prod.productId)) return;

    const initialQty = 1;
    const initialLineRefund = Math.round(initialQty * prod.unitPrice * (1 + prod.gstRate / 100) * 100) / 100;

    setReturnedItems(prev => [
      ...prev,
      {
        productId: prod.productId,
        name: prod.name,
        code: prod.code,
        uom: prod.uom,
        maxQty: prod.maxQty,
        quantity: initialQty,
        unitPrice: prod.unitPrice,
        gstRate: prod.gstRate,
        condition: 'Resaleable',
        refundAmount: initialLineRefund,
        isManualAmount: false
      }
    ]);
  };

  // Update return quantity & re-calculate item refund automatically unless manually locked
  const handleUpdateReturnQty = (index, value) => {
    const updated = [...returnedItems];
    const val = parseInt(value, 10) || 1;
    const bounded = Math.max(1, Math.min(val, updated[index].maxQty));
    updated[index].quantity = bounded;

    if (!updated[index].isManualAmount) {
      const lineAmt = bounded * updated[index].unitPrice * (1 + updated[index].gstRate / 100);
      updated[index].refundAmount = Math.round(lineAmt * 100) / 100;
    }

    setReturnedItems(updated);
  };

  // Manually edit the line item refund amount
  const handleUpdateLineRefundAmount = (index, value) => {
    const updated = [...returnedItems];
    const numericVal = value === '' ? '' : parseFloat(value);
    updated[index].refundAmount = numericVal;
    updated[index].isManualAmount = true;
    setReturnedItems(updated);
  };

  // Reset a line item back to auto-calculated amount
  const handleResetLineToAuto = (index) => {
    const updated = [...returnedItems];
    const autoAmt = updated[index].quantity * updated[index].unitPrice * (1 + updated[index].gstRate / 100);
    updated[index].refundAmount = Math.round(autoAmt * 100) / 100;
    updated[index].isManualAmount = false;
    setReturnedItems(updated);
  };

  const handleUpdateCondition = (index, condition) => {
    const updated = [...returnedItems];
    updated[index].condition = condition;
    setReturnedItems(updated);
  };

  const handleRemoveItem = (index) => {
    setReturnedItems(prev => prev.filter((_, i) => i !== index));
  };

  // Live auto-calculation of refund amounts
  const autoSummary = useMemo(() => {
    let subtotal = 0;
    let tax = 0;
    let autoTotal = 0;
    let totalQty = 0;

    returnedItems.forEach(item => {
      const q = Number(item.quantity) || 0;
      const price = Number(item.unitPrice) || 0;
      const gst = Number(item.gstRate) || 0;
      const lineSub = q * price;
      const lineTax = lineSub * (gst / 100);

      subtotal += lineSub;
      tax += lineTax;
      totalQty += q;

      const effectiveLineAmt = item.refundAmount !== '' && item.refundAmount !== undefined
        ? Number(item.refundAmount)
        : Math.round((lineSub + lineTax) * 100) / 100;
      autoTotal += effectiveLineAmt;
    });

    return {
      subtotal: Math.round(subtotal * 100) / 100,
      tax: Math.round(tax * 100) / 100,
      autoTotal: Math.round(autoTotal * 100) / 100,
      totalQty
    };
  }, [returnedItems]);

  // Determine final effective total refund amount (auto vs manual override)
  const finalTotalRefundAmount = useMemo(() => {
    if (isManualTotalRefund && customTotalRefund !== '' && !isNaN(Number(customTotalRefund))) {
      return Number(customTotalRefund);
    }
    return autoSummary.autoTotal;
  }, [isManualTotalRefund, customTotalRefund, autoSummary.autoTotal]);

  // Submit new return
  const handleSubmitReturn = async (e) => {
    e.preventDefault();

    if (!invoiceNo) {
      Swal.fire({
        title: 'Missing Invoice',
        text: 'Please select an invoice or order to return against.',
        icon: 'warning',
        confirmButtonColor: '#4f46e5'
      });
      return;
    }

    if (returnedItems.length === 0) {
      Swal.fire({
        title: 'No Items Added',
        text: 'Please add at least one product item to the return docket.',
        icon: 'warning',
        confirmButtonColor: '#4f46e5'
      });
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        invoiceNo,
        reason,
        refundMethod,
        refundAmount: finalTotalRefundAmount,
        notes: notes.trim() || undefined,
        items: returnedItems.map(item => ({
          productId: item.productId,
          quantity: item.quantity,
          condition: item.condition,
          unitPrice: item.unitPrice,
          refundAmount: Number(item.refundAmount || 0)
        }))
      };

      const res = await api.post('/sales/returns', payload);

      Swal.fire({
        title: 'Sales Return Processed!',
        html: `<div class="text-xs text-slate-600 dark:text-slate-300 space-y-1">
          <p>Return Docket: <strong>${res.data.returnNo}</strong></p>
          <p>Refund Scheme: <strong class="text-indigo-600">${refundMethod}</strong></p>
          <p>Settlement Refund: <strong class="text-emerald-600 text-sm">₹${finalTotalRefundAmount.toFixed(2)}</strong> ${isManualTotalRefund ? '<span class="text-[10px] text-amber-500 font-bold">(Manually Set)</span>' : '<span class="text-[10px] text-emerald-500 font-bold">(Auto-Calculated)</span>'}</p>
          <p class="text-[11px] text-slate-400 mt-2">Inventory updated and audit trail recorded.</p>
        </div>`,
        icon: 'success',
        confirmButtonColor: '#4f46e5'
      });

      // Reset form
      setInvoiceNo('');
      setSelectedOrder(null);
      setInvoiceProducts([]);
      setReturnedItems([]);
      setCustomTotalRefund('');
      setIsManualTotalRefund(false);
      setNotes('');
      fetchPageResources();
      setActiveTab('list');
    } catch (err) {
      console.error(err);
      const errMsg = err.response?.data?.error || err.message || 'Failed to submit sales return';
      Swal.fire({
        title: 'Return Failed',
        text: errMsg,
        icon: 'error',
        confirmButtonColor: '#4f46e5'
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Edit return handler
  const handleOpenEdit = (ret) => {
    setEditingReturn(ret);
    setEditFormData({
      reason: ret.reason || 'Quality Issue',
      refundMethod: ret.refundMethod || 'Credit Note',
      refundAmount: ret.refundAmount !== undefined ? ret.refundAmount : 0,
      status: ret.status || 'Completed',
      notes: ret.notes || ''
    });
  };

  const handleSaveEdit = async () => {
    if (!editingReturn) return;
    setIsSavingEdit(true);
    try {
      await api.patch(`/sales/returns/${editingReturn.id}`, {
        ...editFormData,
        refundAmount: parseFloat(editFormData.refundAmount) || 0
      });
      Swal.fire({
        icon: 'success',
        title: 'Return Updated',
        text: `Sales Return ${editingReturn.returnNo} has been updated.`,
        timer: 1500,
        showConfirmButton: false,
        toast: true,
        position: 'top-end'
      });
      setEditingReturn(null);
      fetchPageResources();
    } catch (err) {
      console.error(err);
      Swal.fire({
        title: 'Update Failed',
        text: err.response?.data?.error || err.message,
        icon: 'error',
        confirmButtonColor: '#4f46e5'
      });
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Delete return handler
  const handleDeleteReturn = async (ret) => {
    const confirm = await Swal.fire({
      title: `Delete Return ${ret.returnNo}?`,
      html: `<div class="text-xs text-slate-500">
        This will cancel return <strong>${ret.returnNo}</strong> and reverse any inventory stock movements applied to resaleable items.
      </div>`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, Delete & Reverse Stock',
      confirmButtonColor: '#e11d48',
      cancelButtonText: 'Cancel'
    });

    if (!confirm.isConfirmed) return;

    try {
      await api.delete(`/sales/returns/${ret.id}`);
      Swal.fire({
        icon: 'success',
        title: 'Return Deleted',
        text: `Sales Return ${ret.returnNo} was deleted and stock restored.`,
        timer: 1500,
        showConfirmButton: false,
        toast: true,
        position: 'top-end'
      });
      fetchPageResources();
      if (viewingReturn?.id === ret.id) setViewingReturn(null);
    } catch (err) {
      console.error(err);
      Swal.fire({
        title: 'Delete Failed',
        text: err.response?.data?.error || err.message,
        icon: 'error',
        confirmButtonColor: '#4f46e5'
      });
    }
  };

  // Filtered returns list for table
  const filteredReturns = useMemo(() => {
    return returnsHistory.filter(ret => {
      const q = searchQuery.toLowerCase().trim();
      const matchQuery =
        !q ||
        ret.returnNo?.toLowerCase().includes(q) ||
        ret.invoiceDocNo?.toLowerCase().includes(q) ||
        ret.customerName?.toLowerCase().includes(q) ||
        ret.customerPhone?.toLowerCase().includes(q) ||
        ret.items?.some(i => i.productName?.toLowerCase().includes(q));

      const matchScheme =
        schemeFilter === 'ALL' ||
        ret.refundMethod?.toLowerCase() === schemeFilter.toLowerCase();

      const matchStatus =
        statusFilter === 'ALL' ||
        ret.status?.toLowerCase() === statusFilter.toLowerCase();

      return matchQuery && matchScheme && matchStatus;
    });
  }, [returnsHistory, searchQuery, schemeFilter, statusFilter]);

  const totalPages = Math.ceil(filteredReturns.length / ITEMS_PER_PAGE) || 1;
  const paginatedReturns = filteredReturns.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  // Overall KPI metrics
  const totalRefundAmountAll = useMemo(() => {
    return returnsHistory.reduce((acc, r) => acc + (Number(r.refundAmount) || 0), 0);
  }, [returnsHistory]);

  const totalRestockedItems = useMemo(() => {
    return returnsHistory.reduce((acc, r) => {
      const resaleable = (r.items || []).filter(i => i.condition === 'Resaleable');
      return acc + resaleable.reduce((s, i) => s + Number(i.quantity || 0), 0);
    }, 0);
  }, [returnsHistory]);

  const totalWastedItems = useMemo(() => {
    return returnsHistory.reduce((acc, r) => {
      const wasted = (r.items || []).filter(i => i.condition !== 'Resaleable');
      return acc + wasted.reduce((s, i) => s + Number(i.quantity || 0), 0);
    }, 0);
  }, [returnsHistory]);

  return (
    <div className="w-full max-w-full px-4 sm:px-6 lg:px-8 py-5 space-y-5 mx-auto transition-all duration-300">
      {/* ── TOP HEADER & ACTIONS ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <span className="p-2 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-xl border border-indigo-100 dark:border-indigo-900/40">
              <RotateCcw className="w-5 h-5" />
            </span>
            Sales Returns & Replacements Center
          </h1>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            Manage customer counter returns, credit notes, auto-calculated or manually customizable refunds, and automatic inventory stock restorations.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant={activeTab === 'list' ? 'default' : 'outline'}
            onClick={() => setActiveTab('list')}
            className={`text-xs font-bold h-9 px-4 rounded-xl cursor-pointer ${
              activeTab === 'list'
                ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
                : 'border-slate-200 dark:border-slate-800'
            }`}
          >
            <Receipt className="w-3.5 h-3.5 mr-1.5" /> Returns Records ({returnsHistory.length})
          </Button>

          {canEdit && (
            <Button
              type="button"
              variant={activeTab === 'create' ? 'default' : 'outline'}
              onClick={() => setActiveTab('create')}
              className={`text-xs font-bold h-9 px-4 rounded-xl cursor-pointer ${
                activeTab === 'create'
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  : 'border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50'
              }`}
            >
              <Plus className="w-3.5 h-3.5 mr-1.5" /> Log New Return
            </Button>
          )}

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={fetchPageResources}
            className="h-9 px-3 rounded-xl border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300"
            title="Refresh returns"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* ── KPI METRICS CARDS ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-bold uppercase tracking-wider">Total Returns</span>
            <Receipt className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="mt-2 text-xl font-black text-slate-900 dark:text-white">
            {returnsHistory.length} <span className="text-xs font-normal text-slate-400">cases</span>
          </div>
          <div className="text-[10px] text-slate-400 mt-1 font-medium">Logged sales return dockets</div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-bold uppercase tracking-wider">Total Refund Value</span>
            <DollarSign className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="mt-2 text-xl font-black text-emerald-600 dark:text-emerald-400">
            ₹{totalRefundAmountAll.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-[10px] text-slate-400 mt-1 font-medium">Combined refunds & credit notes</div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-bold uppercase tracking-wider">Restocked to Inventory</span>
            <Package className="w-4 h-4 text-blue-500" />
          </div>
          <div className="mt-2 text-xl font-black text-blue-600 dark:text-blue-400">
            {totalRestockedItems} <span className="text-xs font-normal text-slate-400">pcs</span>
          </div>
          <div className="text-[10px] text-slate-400 mt-1 font-medium">Resaleable goods returned to shelf</div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-bold uppercase tracking-wider">Damaged / Wasted</span>
            <Trash2 className="w-4 h-4 text-rose-500" />
          </div>
          <div className="mt-2 text-xl font-black text-rose-600 dark:text-rose-400">
            {totalWastedItems} <span className="text-xs font-normal text-slate-400">pcs</span>
          </div>
          <div className="text-[10px] text-slate-400 mt-1 font-medium">Written off to scrap / spoilage</div>
        </div>
      </div>

      {/* ── TAB 1: ALL SALES RETURNS RECORDS (TABLE VIEW) ── */}
      {activeTab === 'list' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 text-xs">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                type="text"
                placeholder="Search return #, invoice #, customer name, phone..."
                value={searchQuery}
                onChange={e => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="pl-9 h-9 text-xs rounded-xl bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-bold text-slate-400 uppercase">Scheme:</span>
                <select
                  value={schemeFilter}
                  onChange={e => {
                    setSchemeFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300 font-semibold text-xs outline-none"
                >
                  <option value="ALL">All Schemes</option>
                  <option value="Credit Note">Credit Note</option>
                  <option value="Cash Refund">Cash Refund</option>
                  <option value="Replacement">Replacement</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                </select>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-bold text-slate-400 uppercase">Status:</span>
                <select
                  value={statusFilter}
                  onChange={e => {
                    setStatusFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300 font-semibold text-xs outline-none"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="Completed">Completed</option>
                  <option value="Pending">Pending</option>
                  <option value="Cancelled">Cancelled</option>
                </select>
              </div>
            </div>
          </div>

          {/* Records Table */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left table-auto text-xs">
                <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 uppercase font-black text-[10px] tracking-wider border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="px-4 py-3.5">Return Ref #</th>
                    <th className="px-4 py-3.5">Date & Time</th>
                    <th className="px-4 py-3.5">Original Invoice / Order</th>
                    <th className="px-4 py-3.5">Customer Details</th>
                    <th className="px-4 py-3.5">Returned Items</th>
                    <th className="px-4 py-3.5 text-right">Refund Amount (₹)</th>
                    <th className="px-4 py-3.5 text-center">Refund Scheme</th>
                    <th className="px-4 py-3.5 text-center">Status</th>
                    <th className="px-4 py-3.5 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                  {loading ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-slate-400 animate-pulse font-medium">
                        Loading sales return records...
                      </td>
                    </tr>
                  ) : paginatedReturns.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-slate-400 italic">
                        {returnsHistory.length === 0
                          ? 'No sales returns logged yet. Click "Log New Return" to create one.'
                          : 'No returns match your search filter criteria.'}
                      </td>
                    </tr>
                  ) : (
                    paginatedReturns.map(ret => (
                      <tr
                        key={ret.id}
                        className="hover:bg-slate-50/70 dark:hover:bg-slate-850/50 transition-colors"
                      >
                        {/* Return Ref # */}
                        <td className="px-4 py-3 font-mono font-bold text-indigo-600 dark:text-indigo-400 whitespace-nowrap">
                          {ret.returnNo}
                        </td>

                        {/* Date */}
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                          <div>{new Date(ret.createdAt).toLocaleDateString('en-GB')}</div>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {new Date(ret.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </td>

                        {/* Original Invoice */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                            {ret.invoiceDocNo}
                          </span>
                          {ret.invoiceTotal > 0 && (
                            <div className="text-[10px] text-slate-400">
                              Orig Total: ₹{ret.invoiceTotal.toFixed(2)}
                            </div>
                          )}
                        </td>

                        {/* Customer */}
                        <td className="px-4 py-3">
                          <div className="font-bold text-slate-900 dark:text-white whitespace-nowrap">
                            {ret.customerName}
                          </div>
                          {ret.customerPhone && ret.customerPhone !== 'N/A' && (
                            <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
                              <Phone className="w-2.5 h-2.5" /> {ret.customerPhone}
                            </div>
                          )}
                        </td>

                        {/* Returned Items */}
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-1 max-w-xs">
                            {(ret.items || []).map((item, idx) => (
                              <div
                                key={idx}
                                className="flex items-center justify-between text-[11px] gap-2"
                              >
                                <span className="font-semibold text-slate-700 dark:text-slate-300 truncate">
                                  {item.productName}
                                </span>
                                <span className="font-mono text-slate-500 shrink-0">
                                  ×{item.quantity}
                                </span>
                                <span
                                  className={`text-[9px] px-1.5 py-0.2 rounded font-bold uppercase shrink-0 ${
                                    item.condition === 'Resaleable'
                                      ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200'
                                      : 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200'
                                  }`}
                                >
                                  {item.condition}
                                </span>
                              </div>
                            ))}
                          </div>
                        </td>

                        {/* Refund Amount */}
                        <td className="px-4 py-3 text-right font-mono font-black text-emerald-600 dark:text-emerald-400 text-sm whitespace-nowrap">
                          ₹{Number(ret.refundAmount || 0).toFixed(2)}
                        </td>

                        {/* Refund Scheme */}
                        <td className="px-4 py-3 text-center whitespace-nowrap">
                          <span
                            className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                              ret.refundMethod === 'Cash Refund'
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                                : ret.refundMethod === 'Credit Note'
                                ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300'
                                : ret.refundMethod === 'Replacement'
                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
                                : 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300'
                            }`}
                          >
                            {ret.refundMethod}
                          </span>
                        </td>

                        {/* Status */}
                        <td className="px-4 py-3 text-center whitespace-nowrap">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                              ret.status === 'Completed'
                                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400 border border-emerald-200'
                                : ret.status === 'Cancelled'
                                ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-400 border border-rose-200'
                                : 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400 border border-amber-200'
                            }`}
                          >
                            {ret.status}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-3 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1">
                            {/* View Full Details */}
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => setViewingReturn(ret)}
                              className="h-8 w-8 p-0 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 rounded-lg cursor-pointer"
                              title="View Full Details"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </Button>

                            {/* Edit Return */}
                            {canEdit && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => handleOpenEdit(ret)}
                                className="h-8 w-8 p-0 text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/50 rounded-lg cursor-pointer"
                                title="Edit Return & Refund Amount"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </Button>
                            )}

                            {/* Delete Return */}
                            {isAdmin && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteReturn(ret)}
                                className="h-8 w-8 p-0 text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg cursor-pointer"
                                title="Delete Return & Revert Inventory"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="p-3 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center">
                <span className="text-[11px] text-slate-500 font-medium">
                  Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to{' '}
                  {Math.min(currentPage * ITEMS_PER_PAGE, filteredReturns.length)} of{' '}
                  {filteredReturns.length} records
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
      )}

      {/* ── TAB 2: CREATE SALES RETURN (FORM VIEW) ── */}
      {activeTab === 'create' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 text-xs">
          
          {/* Main Form Left Column (8 cols) */}
          <div className="lg:col-span-8 space-y-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-5">
              
              {/* Step 1: Select Original Invoice */}
              <div className="space-y-2">
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
                  <h3 className="font-black text-slate-800 dark:text-white uppercase tracking-wider text-xs flex items-center gap-2">
                    <FileText className="w-4 h-4 text-indigo-500" /> 1. Select Customer Invoice / Sales Order
                  </h3>
                  <span className="text-[10px] text-slate-400 font-medium">
                    {recentOrders.length} recent invoices loaded
                  </span>
                </div>

                <SearchSelect
                  value={invoiceNo}
                  onChange={handleSelectOrder}
                  options={recentOrders.map(o => {
                    const ref = o.referenceNo || o.docNo || o.id;
                    const displayDoc = o.docNo || o.referenceNo || ref;
                    const custName = o.customerName || o.customer?.name || 'Walk-In Customer';
                    const amt = Number(o.grandTotal || o.totalSubtotal || 0).toFixed(2);
                    return {
                      value: ref,
                      label: `${displayDoc} — ${custName}`,
                      subLabel: `Amount: ₹${amt} | Date: ${new Date(o.createdAt).toLocaleDateString('en-GB')} | Status: ${o.status}`
                    };
                  })}
                  placeholder="Search and choose customer invoice number (e.g. SO/26-27/0002, POS/26-27/0008)..."
                  searchPlaceholder="Type invoice number, order #, or customer name..."
                  triggerClassName="h-10 rounded-xl bg-slate-50 dark:bg-slate-950 text-xs font-semibold border-slate-200 dark:border-slate-800"
                />
              </div>

              {/* Verified Invoice Details Card */}
              {selectedOrder && (
                <div className="p-4 bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/50 rounded-xl space-y-3">
                  <div className="flex items-center justify-between text-[11px] font-bold text-indigo-900 dark:text-indigo-300">
                    <span className="flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                      Invoiced Customer & Transaction Profile
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800 font-mono">
                      {selectedOrder.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div>
                      <span className="text-[10px] text-slate-400 font-bold uppercase block">Customer Name</span>
                      <span className="font-black text-slate-800 dark:text-slate-100">
                        {selectedOrder.customerName || selectedOrder.customer?.name || 'Walk-In Customer'}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-400 font-bold uppercase block">Contact Phone</span>
                      <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                        {selectedOrder.customerPhone || selectedOrder.customer?.phone || 'N/A'}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-400 font-bold uppercase block">Customer GSTIN</span>
                      <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                        {selectedOrder.taxRegNo || selectedOrder.customer?.taxRegNo || 'URP / Not Provided'}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-400 font-bold uppercase block">Invoice Date</span>
                      <span className="font-medium text-slate-700 dark:text-slate-300">
                        {new Date(selectedOrder.createdAt).toLocaleDateString('en-GB')}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-400 font-bold uppercase block">Invoice Grand Total</span>
                      <span className="font-mono font-black text-indigo-700 dark:text-indigo-300">
                        ₹{Number(selectedOrder.grandTotal || selectedOrder.totalSubtotal || 0).toFixed(2)}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-400 font-bold uppercase block">Payment Status</span>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400">
                        {selectedOrder.paymentStatus || 'PAID'}
                      </span>
                    </div>
                  </div>

                  {selectedOrder.deliveryAddress && (
                    <div className="pt-1 text-[11px] text-slate-500 border-t border-indigo-100 dark:border-indigo-900/40">
                      <strong>Address:</strong> {selectedOrder.deliveryAddress}
                    </div>
                  )}
                </div>
              )}

              {/* Step 2: Form Configuration */}
              {selectedOrder && (
                <form onSubmit={handleSubmitReturn} className="space-y-5 pt-2">
                  <div className="space-y-3">
                    <h3 className="font-black text-slate-800 dark:text-white uppercase tracking-wider text-xs flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
                      <Archive className="w-4 h-4 text-indigo-500" /> 2. Return Schemes & Reason
                    </h3>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-extrabold text-slate-500 uppercase block">
                          Return Reason *
                        </label>
                        <select
                          value={reason}
                          onChange={e => setReason(e.target.value)}
                          className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold h-10 outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                          <option value="Quality Issue">Quality Issue / Spoilage</option>
                          <option value="Customer Return">Customer Return / Exchange</option>
                          <option value="Wrong Product">Wrong Product Delivered</option>
                          <option value="Damaged in Transit">Damaged in Transit / Storage</option>
                          <option value="Near Expiry">Near Expiry / Expired</option>
                          <option value="Customer Preference">Customer Preference / Unwanted</option>
                          <option value="Other">Other / Miscellaneous</option>
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-extrabold text-slate-500 uppercase block">
                          Refund Settlement Scheme *
                        </label>
                        <select
                          value={refundMethod}
                          onChange={e => setRefundMethod(e.target.value)}
                          className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold h-10 outline-none focus:ring-2 focus:ring-indigo-500 text-indigo-600 dark:text-indigo-400"
                        >
                          <option value="Credit Note">Generate Credit Note (Store Balance)</option>
                          <option value="Cash Refund">Immediate Cash Settlement Refund</option>
                          <option value="Replacement">Direct Counter Product Replacement</option>
                          <option value="Bank Transfer">Bank Transfer / NEFT</option>
                        </select>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-extrabold text-slate-500 uppercase block">
                        Inspection Notes & Remarks
                      </label>
                      <textarea
                        rows={2}
                        value={notes}
                        onChange={e => setNotes(e.target.value)}
                        placeholder="Add batch inspection findings, customer comments, or supervisor approval notes..."
                        className="w-full p-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>

                  {/* Step 3: Available Products & Return Items Docket */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
                      <h3 className="font-black text-slate-800 dark:text-white uppercase tracking-wider text-xs flex items-center gap-2">
                        <Layers className="w-4 h-4 text-indigo-500" /> 3. Select Invoiced Products to Return
                      </h3>
                      <span className="text-[10px] text-slate-400">
                        Click product pills to add to docket
                      </span>
                    </div>

                    {/* Product Pills */}
                    <div className="flex flex-wrap gap-2">
                      {invoiceProducts.map(p => {
                        const isAdded = returnedItems.some(i => i.productId === p.productId);
                        return (
                          <button
                            key={p.productId}
                            type="button"
                            disabled={isAdded}
                            onClick={() => handleAddItemToReturn(p)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center gap-1.5 ${
                              isAdded
                                ? 'bg-slate-100 text-slate-400 border-slate-200 dark:bg-slate-850 dark:border-slate-800 cursor-not-allowed'
                                : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300'
                            }`}
                          >
                            <span>+ {p.name}</span>
                            <span className="font-mono text-[10px] opacity-75">
                              (Max {p.maxQty} {p.uom} • ₹{p.unitPrice})
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    {/* Returned Items List */}
                    <div className="space-y-2.5 pt-2">
                      {returnedItems.length === 0 ? (
                        <div className="p-6 text-center text-slate-400 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
                          No products added to the return docket yet. Select from the product buttons above.
                        </div>
                      ) : (
                        returnedItems.map((item, idx) => {
                          const autoLineAmt = Math.round(item.quantity * item.unitPrice * (1 + item.gstRate / 100) * 100) / 100;
                          return (
                            <div
                              key={idx}
                              className="p-3.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-2xs"
                            >
                              <div className="min-w-[160px]">
                                <div className="font-black text-slate-900 dark:text-white">
                                  {item.name}
                                </div>
                                <div className="text-[10px] text-slate-400 font-mono">
                                  Rate: ₹{item.unitPrice.toFixed(2)} | GST: {item.gstRate}% | Invoiced: {item.maxQty} {item.uom}
                                </div>
                              </div>

                              <div className="flex flex-wrap items-center gap-3">
                                {/* Quantity stepper */}
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[10px] font-bold text-slate-500 uppercase">Return Qty:</span>
                                  <Input
                                    type="number"
                                    min="1"
                                    max={item.maxQty}
                                    value={item.quantity}
                                    onChange={e => handleUpdateReturnQty(idx, e.target.value)}
                                    className="w-16 h-8 text-center bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-mono font-bold"
                                  />
                                  <span className="text-[10px] text-slate-400 font-mono">/ {item.maxQty}</span>
                                </div>

                                {/* Condition */}
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[10px] font-bold text-slate-500 uppercase">Condition:</span>
                                  <select
                                    value={item.condition}
                                    onChange={e => handleUpdateCondition(idx, e.target.value)}
                                    className="h-8 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2 text-[11px] font-semibold"
                                  >
                                    <option value="Resaleable">🟢 Resaleable (Restock)</option>
                                    <option value="Damaged">🟠 Damaged (Wastage)</option>
                                    <option value="Destroy">🔴 Destroy (Spoilage)</option>
                                  </select>
                                </div>

                                {/* Editable Line Refund Amount */}
                                <div className="flex items-center gap-1.5">
                                  <div>
                                    <div className="flex items-center justify-between gap-1 mb-0.5">
                                      <span className="text-[9px] text-slate-400 uppercase font-bold">Line Refund</span>
                                      {item.isManualAmount && (
                                        <button
                                          type="button"
                                          onClick={() => handleResetLineToAuto(idx)}
                                          className="text-[9px] text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer font-bold"
                                          title={`Reset to auto ₹${autoLineAmt.toFixed(2)}`}
                                        >
                                          ↺ Auto
                                        </button>
                                      )}
                                    </div>
                                    <div className="relative flex items-center">
                                      <span className="absolute left-2 text-slate-400 text-xs font-mono font-bold">₹</span>
                                      <Input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={item.refundAmount}
                                        onChange={e => handleUpdateLineRefundAmount(idx, e.target.value)}
                                        className={`w-24 h-8 pl-5 pr-1.5 text-right font-mono font-bold text-xs rounded-lg ${
                                          item.isManualAmount
                                            ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200'
                                            : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-emerald-600 dark:text-emerald-400'
                                        }`}
                                      />
                                    </div>
                                  </div>
                                </div>

                                <button
                                  type="button"
                                  onClick={() => handleRemoveItem(idx)}
                                  className="text-rose-500 hover:text-rose-700 p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/30 cursor-pointer"
                                  title="Remove Item"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  <Button
                    type="submit"
                    disabled={submitting || returnedItems.length === 0}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-11 text-xs rounded-xl shadow-xs cursor-pointer flex items-center justify-center gap-2"
                  >
                    {submitting ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" /> Processing Return Docket...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" /> Confirm & Process Return (₹{finalTotalRefundAmount.toFixed(2)})
                      </>
                    )}
                  </Button>
                </form>
              )}
            </div>
          </div>

          {/* Side Summary Right Column (4 cols) with Auto-Calculate & Manual Override */}
          <div className="lg:col-span-4 space-y-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
                <h3 className="font-black text-slate-800 dark:text-white uppercase tracking-wider text-xs flex items-center gap-2">
                  <Calculator className="w-4 h-4 text-emerald-500" /> Refund Amount Settlement
                </h3>
                {isManualTotalRefund && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300">
                    Custom Override
                  </span>
                )}
              </div>

              <div className="space-y-3 text-xs">
                <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
                  <span>Selected Invoice:</span>
                  <span className="font-mono font-bold text-slate-800 dark:text-white">
                    {invoiceNo || 'None'}
                  </span>
                </div>

                <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
                  <span>Total Items to Return:</span>
                  <span className="font-mono font-bold text-slate-800 dark:text-white">
                    {returnedItems.length} lines ({autoSummary.totalQty} units)
                  </span>
                </div>

                <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
                  <span>Refund Scheme:</span>
                  <span className="font-bold text-indigo-600 dark:text-indigo-400">
                    {refundMethod}
                  </span>
                </div>

                <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
                  <span>Return Reason:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {reason}
                  </span>
                </div>

                {/* Auto Calculated Breakdown */}
                <div className="border-t border-dashed border-slate-200 dark:border-slate-800 pt-3 space-y-1.5">
                  <div className="flex justify-between items-center text-slate-500">
                    <span>Items Subtotal:</span>
                    <span className="font-mono">₹{autoSummary.subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center text-slate-500">
                    <span>Tax Adjustment:</span>
                    <span className="font-mono">₹{autoSummary.tax.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center text-slate-600 dark:text-slate-400 font-bold">
                    <span>Auto-Calculated Total:</span>
                    <span className="font-mono text-slate-900 dark:text-white">
                      ₹{autoSummary.autoTotal.toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Editable Final Refund Box */}
                <div className="p-3.5 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/20 border border-emerald-200 dark:border-emerald-800/60 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-black uppercase text-emerald-900 dark:text-emerald-300 flex items-center gap-1.5">
                      <SlidersHorizontal className="w-3.5 h-3.5 text-emerald-600" />
                      Final Refund Amount (₹)
                    </label>
                    {isManualTotalRefund ? (
                      <button
                        type="button"
                        onClick={() => {
                          setIsManualTotalRefund(false);
                          setCustomTotalRefund('');
                        }}
                        className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold hover:underline cursor-pointer"
                      >
                        ↺ Reset to Auto
                      </button>
                    ) : (
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">
                        ✓ Auto-Calculated
                      </span>
                    )}
                  </div>

                  <div className="relative flex items-center">
                    <span className="absolute left-3 text-slate-500 font-black text-sm">₹</span>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder={autoSummary.autoTotal.toFixed(2)}
                      value={isManualTotalRefund ? customTotalRefund : autoSummary.autoTotal}
                      onChange={e => {
                        setIsManualTotalRefund(true);
                        setCustomTotalRefund(e.target.value);
                      }}
                      className="pl-7 pr-3 h-10 font-mono font-black text-lg bg-white dark:bg-slate-900 border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 rounded-xl"
                    />
                  </div>
                  <p className="text-[10px] text-slate-500">
                    Calculated automatically from items & tax. You can type directly to change or discount the refund amount.
                  </p>
                </div>

                <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl text-[11px] text-slate-500 space-y-1">
                  <div className="font-bold text-slate-700 dark:text-slate-300">Automatic Stock Actions:</div>
                  <ul className="list-disc pl-4 space-y-0.5 text-[10px]">
                    <li><strong>Resaleable items:</strong> Automatically credited back to product inventory stock.</li>
                    <li><strong>Damaged / Destroy items:</strong> Documented into wastage log and flagged as scrap.</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: VIEW FULL DETAILS ── */}
      {viewingReturn && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-2xl w-full p-6 shadow-2xl space-y-5 animate__animated animate__fadeInUp animate__faster text-xs">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="p-2 bg-indigo-50 dark:bg-indigo-950 text-indigo-600 rounded-xl">
                  <Receipt className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="font-black text-slate-900 dark:text-white text-base">
                    Sales Return Docket: {viewingReturn.returnNo}
                  </h3>
                  <span className="text-[11px] text-slate-400">
                    Logged on {new Date(viewingReturn.createdAt).toLocaleString('en-GB')}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setViewingReturn(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Invoiced & Customer Details */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-100 dark:border-slate-850">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Invoice Reference</span>
                <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                  {viewingReturn.invoiceDocNo}
                </span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Customer Name</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  {viewingReturn.customerName}
                </span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Customer Phone</span>
                <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                  {viewingReturn.customerPhone}
                </span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Refund Scheme</span>
                <span className="font-bold text-indigo-600 dark:text-indigo-400">
                  {viewingReturn.refundMethod}
                </span>
              </div>
            </div>

            {/* Additional Info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-slate-600 dark:text-slate-400">
              <div>
                <strong>Return Reason:</strong> {viewingReturn.reason}
              </div>
              <div>
                <strong>Status:</strong>{' '}
                <span className="font-bold text-emerald-600">{viewingReturn.status}</span>
              </div>
              {viewingReturn.customerAddress && viewingReturn.customerAddress !== 'N/A' && (
                <div className="sm:col-span-2">
                  <strong>Delivery Address:</strong> {viewingReturn.customerAddress}
                </div>
              )}
            </div>

            {/* Returned Items Breakdown Table */}
            <div className="space-y-2">
              <h4 className="font-bold text-slate-800 dark:text-white uppercase tracking-wider text-[11px]">
                Returned Items & Inventory Impact
              </h4>
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                <table className="w-full text-left table-auto">
                  <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 uppercase font-black text-[9px] tracking-wider border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="px-3 py-2">Product Name</th>
                      <th className="px-3 py-2 text-right">Returned Qty</th>
                      <th className="px-3 py-2 text-right">Rate (₹)</th>
                      <th className="px-3 py-2 text-center">Condition</th>
                      <th className="px-3 py-2 text-right">Refund (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                    {(viewingReturn.items || []).map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50">
                        <td className="px-3 py-2 font-bold text-slate-800 dark:text-white">
                          {item.productName}
                        </td>
                        <td className="px-3 py-2 text-right font-mono font-bold">
                          {item.quantity} {item.uom || 'pcs'}
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-slate-500">
                          ₹{Number(item.unitPrice || 0).toFixed(2)}
                        </td>
                        <td className="px-3 py-2 text-center">
                          <span
                            className={`text-[9px] px-2 py-0.5 rounded font-bold uppercase ${
                              item.condition === 'Resaleable'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-rose-50 text-rose-700 border border-rose-200'
                            }`}
                          >
                            {item.condition}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right font-mono font-black text-emerald-600">
                          ₹{Number(item.lineTotal || (item.quantity * (item.unitPrice || 0))).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-50 dark:bg-slate-950 font-black border-t border-slate-200 dark:border-slate-800">
                    <tr>
                      <td colSpan={4} className="px-3 py-2 text-right uppercase text-[10px] text-slate-500">
                        Total Refund Value:
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-emerald-600 text-sm">
                        ₹{Number(viewingReturn.refundAmount || 0).toFixed(2)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="pt-2 flex justify-end gap-2 border-t border-slate-200 dark:border-slate-800">
              <Button
                type="button"
                variant="outline"
                onClick={() => setViewingReturn(null)}
                className="text-xs font-bold h-9 px-4 rounded-xl cursor-pointer"
              >
                Close
              </Button>
              <Button
                type="button"
                onClick={() => window.print()}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs h-9 px-4 rounded-xl cursor-pointer flex items-center gap-1.5"
              >
                <Printer className="w-3.5 h-3.5" /> Print Docket
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: EDIT SALES RETURN (INCLUDING REFUND AMOUNT) ── */}
      {editingReturn && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 text-xs animate__animated animate__zoomIn animate__faster">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
              <h3 className="font-black text-slate-900 dark:text-white text-sm flex items-center gap-1.5">
                <Edit3 className="w-4 h-4 text-amber-500" /> Edit Return: {editingReturn.returnNo}
              </h3>
              <button
                onClick={() => setEditingReturn(null)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              {/* Refund Amount Edit */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase block">
                  Refund Settlement Amount (₹) *
                </label>
                <div className="relative flex items-center">
                  <span className="absolute left-3 text-slate-500 font-bold">₹</span>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={editFormData.refundAmount}
                    onChange={e => setEditFormData(prev => ({ ...prev, refundAmount: e.target.value }))}
                    className="pl-7 pr-3 h-10 font-mono font-bold text-sm bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-700 text-emerald-600 dark:text-emerald-400 rounded-xl"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase block">Return Reason</label>
                <select
                  value={editFormData.reason}
                  onChange={e => setEditFormData(prev => ({ ...prev, reason: e.target.value }))}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold outline-none"
                >
                  <option value="Quality Issue">Quality Issue / Spoilage</option>
                  <option value="Customer Return">Customer Return / Exchange</option>
                  <option value="Wrong Product">Wrong Product Delivered</option>
                  <option value="Damaged in Transit">Damaged in Transit / Storage</option>
                  <option value="Near Expiry">Near Expiry / Expired</option>
                  <option value="Customer Preference">Customer Preference / Unwanted</option>
                  <option value="Other">Other / Miscellaneous</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase block">Refund Scheme</label>
                <select
                  value={editFormData.refundMethod}
                  onChange={e => setEditFormData(prev => ({ ...prev, refundMethod: e.target.value }))}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold outline-none text-indigo-600"
                >
                  <option value="Credit Note">Credit Note</option>
                  <option value="Cash Refund">Cash Refund</option>
                  <option value="Replacement">Replacement</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase block">Return Status</label>
                <select
                  value={editFormData.status}
                  onChange={e => setEditFormData(prev => ({ ...prev, status: e.target.value }))}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold outline-none"
                >
                  <option value="Completed">Completed</option>
                  <option value="Pending">Pending</option>
                  <option value="Cancelled">Cancelled</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase block">Update Note / Reason Details</label>
                <textarea
                  rows={2}
                  value={editFormData.notes}
                  onChange={e => setEditFormData(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Additional explanation or change note..."
                  className="w-full p-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 outline-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditingReturn(null)}
                className="text-xs font-bold h-9 px-4 rounded-xl cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                type="button"
                disabled={isSavingEdit}
                onClick={handleSaveEdit}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs h-9 px-4 rounded-xl cursor-pointer"
              >
                {isSavingEdit ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
