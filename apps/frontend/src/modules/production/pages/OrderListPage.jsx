import React, { useState, useEffect } from 'react';
import { api } from '@/lib/axios';
import {
  ShoppingCart, Search, RefreshCw, Plus, Edit, Trash2, Eye,
  ChevronLeft, Package, FileText,
  TrendingUp, Calendar, IndianRupee, Filter, ArrowUpDown, ArrowUp, ArrowDown, Info, Sparkles, AlertCircle, Loader2, AlertTriangle
} from 'lucide-react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import useAuthStore from '@/app/store/authStore';
import useCompanyStore from '@/app/store/companyStore';
import AddOrderPage from './AddOrderPage';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import Swal from 'sweetalert2';
import { Pagination } from '@/components/ui/Pagination';
import DashboardBackButton from '@/components/ui/DashboardBackButton';

const STATUS_CONFIG = {
  'Quotation':            { bg: 'bg-blue-50 dark:bg-blue-500/10',   text: 'text-blue-600 dark:text-blue-400',   dot: 'bg-blue-500 dark:bg-blue-400',   border: 'border-blue-100 dark:border-blue-500/20' },
  'Confirmed':            { bg: 'bg-violet-50 dark:bg-violet-500/10', text: 'text-violet-600 dark:text-violet-400', dot: 'bg-violet-500 dark:bg-violet-400', border: 'border-violet-100 dark:border-violet-500/20' },
  'Waiting for Production':{ bg: 'bg-slate-100 dark:bg-slate-500/10', text: 'text-slate-600 dark:text-slate-400',  dot: 'bg-slate-500 dark:bg-slate-400',  border: 'border-slate-200 dark:border-slate-500/20' },
  'In Production':        { bg: 'bg-amber-50 dark:bg-amber-500/10',  text: 'text-amber-700 dark:text-amber-400',  dot: 'bg-amber-500 dark:bg-amber-400',  border: 'border-amber-100 dark:border-amber-500/20' },
  'Ready for Shipment':   { bg: 'bg-teal-50 dark:bg-teal-500/10',   text: 'text-teal-600 dark:text-teal-400',   dot: 'bg-teal-500 dark:bg-teal-400',   border: 'border-teal-100 dark:border-teal-500/20' },
  'Delivered':            { bg: 'bg-emerald-50 dark:bg-emerald-500/10',text: 'text-emerald-600 dark:text-emerald-400',dot: 'bg-emerald-500 dark:bg-emerald-400',border: 'border-emerald-100 dark:border-emerald-500/20' },
  'Cancelled':            { bg: 'bg-rose-50 dark:bg-rose-500/10',   text: 'text-rose-600 dark:text-rose-400',   dot: 'bg-rose-500 dark:bg-rose-400',   border: 'border-rose-100 dark:border-rose-500/20' },
};

const PAGE_SIZE = 10;

export default function OrderListPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const orderIdParam = searchParams.get('id');
  const user = useAuthStore(s => s.user);
  const canEdit = ['MAIN_MASTER', 'SALES_TEAM', 'PURCHASE_ACCOUNTANT'].includes(user?.role);

  const [view, setView] = useState({ type: 'list', prefill: null });

  useEffect(() => {
    if (location.pathname === '/orders/add') {
      navigate('/sales/billing?mode=sales-order', { replace: true, state: location.state });
      return;
    }
    const editMatch = location.pathname.match(/^\/orders\/edit\/([^/]+)/);
    if (editMatch) {
      const editId = editMatch[1];
      api.get(`/orders/${editId}`).then(res => {
        if (res.data?.type === 'POS') {
          navigate(`/sales/billing?edit=${editId}&from=/orders/list`, { replace: true });
        } else {
          navigate(`/sales/order?edit=${editId}&from=/orders/list`, { replace: true });
        }
      }).catch(() => {
        navigate(`/sales/order?edit=${editId}&from=/orders/list`, { replace: true });
      });
      return;
    }
    setView({ type: 'list', prefill: null });
  }, [location, canEdit, navigate]);

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState('date_desc');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  // Live Company & Tax Settings from store
  const storeCompany = useCompanyStore((s) => s.company);
  const compName = storeCompany?.companyName || 'Company';
  const compAddr = storeCompany?.companyAddress || 'Factory / Registered Office Address';
  const compGstin = storeCompany?.companyGstin || '';

  const fetchOrders = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await api.get('/orders');
      setOrders(res.data || []);
    } catch (e) { console.error(e); }
    finally { if (!silent) setLoading(false); }
  };

  // Automatic live sync every 10 seconds without manual sync button
  useEffect(() => { 
    fetchOrders(); 
    const interval = setInterval(() => {
      fetchOrders(true);
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  // Sync parameter search ID
  useEffect(() => {
    if (orderIdParam) {
      const fetchDetail = async () => {
        setLoadingDetail(true);
        try {
          const res = await api.get(`/orders/${orderIdParam}`);
          setSelectedOrder(res.data);
        } catch (e) {
          console.error(e);
        } finally {
          setLoadingDetail(false);
        }
      };
      fetchDetail();
    } else {
      setSelectedOrder(null);
    }
  }, [orderIdParam]);

  // Pre-select order if navigated from Kanban with state
  useEffect(() => {
    if (location.state?.orderId && orders.length > 0) {
      const found = orders.find(o => o.id === location.state.orderId);
      if (found) {
        setSearchParams({ id: found.id });
      }
    }
  }, [orders, location.state]);

  const handleUpdateStatus = async (id, newStatus) => {
    try {
      await api.patch(`/orders/${id}/status`, { status: newStatus });
      Swal.fire({
        title: 'Status Updated',
        text: `Order status changed successfully to ${newStatus}`,
        icon: 'success',
        timer: 1500,
        showConfirmButton: false,
        toast: true,
        position: 'top-end'
      });
      fetchOrders();
      if (selectedOrder && selectedOrder.id === id) {
        setSelectedOrder(prev => prev ? { ...prev, status: newStatus } : null);
      }
    } catch (e) {
      Swal.fire({
        title: 'Update Failed',
        text: e.response?.data?.error || 'Failed to update order status.',
        icon: 'error',
        confirmButtonColor: '#6366f1'
      });
    }
  };

  const handleDelete = async (id) => {
    Swal.fire({
      title: 'Delete Order?',
      text: 'Are you sure you want to delete this order? This action cannot be undone.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#e11d48',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Yes, delete',
      cancelButtonText: 'Cancel',
      customClass: {
        popup: 'rounded-2xl shadow-xl',
        confirmButton: 'rounded-xl text-xs font-bold px-4 py-2',
        cancelButton: 'rounded-xl text-xs font-bold px-4 py-2'
      }
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          await api.delete(`/orders/${id}`);
          fetchOrders();
          Swal.fire({
            title: 'Deleted!',
            text: 'Order has been deleted successfully.',
            icon: 'success',
            timer: 2000,
            showConfirmButton: false
          });
        } catch (e) {
          Swal.fire({
            title: 'Error',
            text: e.response?.data?.error || 'Failed to delete order',
            icon: 'error',
            confirmButtonColor: '#6366f1'
          });
        }
      }
    });
  };

  const handleEditOrder = (order) => {
    if (order.type === 'POS') {
      navigate(`/sales/billing?edit=${order.id}&from=/orders/list`);
    } else {
      navigate(`/sales/order?edit=${order.id}&from=/orders/list`);
    }
  };

  const handleCloseInvoiceView = () => {
    const from = searchParams.get('from');
    if (from === 'sales') {
      navigate('/dashboard/sales');
    } else if (from === 'production') {
      navigate('/dashboard/production');
    } else if (from === 'status') {
      navigate('/orders/status');
    } else if (from === 'dashboard' || from === 'main') {
      navigate('/dashboard');
    } else if (from && typeof from === 'string' && from.startsWith('/')) {
      navigate(from);
    } else {
      setSearchParams({});
    }
  };

  // Reset page when search term, type filter, or status filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, typeFilter, sortBy]);

  const sortedAndFiltered = orders.filter(o => {
    const term = searchTerm.toLowerCase().trim();
    const matchSearch = !term || (
      (o.referenceNo || '').toLowerCase().includes(term) ||
      (o.customer?.name || o.customerName || '').toLowerCase().includes(term) ||
      (o.customer?.phone || o.customerPhone || '').toLowerCase().includes(term) ||
      (o.deliveryAddress || '').toLowerCase().includes(term)
    );
    const matchStatus = statusFilter === 'All' || o.status === statusFilter;
    const matchType = typeFilter === 'ALL' || o.type === typeFilter;
    return matchSearch && matchStatus && matchType;
  }).sort((a, b) => {
    if (sortBy === 'date_desc') return new Date(b.createdAt) - new Date(a.createdAt);
    if (sortBy === 'date_asc') return new Date(a.createdAt) - new Date(b.createdAt);
    if (sortBy === 'ref_asc') return (a.referenceNo || '').localeCompare(b.referenceNo || '', undefined, { numeric: true });
    if (sortBy === 'ref_desc') return (b.referenceNo || '').localeCompare(a.referenceNo || '', undefined, { numeric: true });
    if (sortBy === 'customer_asc') return (a.customerName || a.customer?.name || '').localeCompare(b.customerName || b.customer?.name || '');
    if (sortBy === 'customer_desc') return (b.customerName || b.customer?.name || '').localeCompare(a.customerName || a.customer?.name || '');
    if (sortBy === 'amount_desc') return Number(b.grandTotal || b.totalSubtotal || 0) - Number(a.grandTotal || a.totalSubtotal || 0);
    if (sortBy === 'amount_asc') return Number(a.grandTotal || a.totalSubtotal || 0) - Number(b.grandTotal || b.totalSubtotal || 0);
    if (sortBy === 'status_asc') return (a.status || '').localeCompare(b.status || '');
    return 0;
  });

  const totalPages = Math.ceil(sortedAndFiltered.length / PAGE_SIZE) || 1;
  const paginated = sortedAndFiltered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const handleToggleSort = (field) => {
    setSortBy(prev => {
      if (field === 'date') return prev === 'date_desc' ? 'date_asc' : 'date_desc';
      if (field === 'ref') return prev === 'ref_asc' ? 'ref_desc' : 'ref_asc';
      if (field === 'customer') return prev === 'customer_asc' ? 'customer_desc' : 'customer_asc';
      if (field === 'amount') return prev === 'amount_desc' ? 'amount_asc' : 'amount_desc';
      if (field === 'status') return prev === 'status_asc' ? 'date_desc' : 'status_asc';
      return 'date_desc';
    });
  };

  const getSortIcon = (field) => {
    if (sortBy === `${field}_asc`) return <ArrowUp className="w-3.5 h-3.5 text-indigo-600 inline ml-1" />;
    if (sortBy === `${field}_desc`) return <ArrowDown className="w-3.5 h-3.5 text-indigo-600 inline ml-1" />;
    return <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 opacity-60 inline ml-1" />;
  };

  if (view.type === 'create') {
    return <AddOrderPage />;
  }

  // ─────────────────────── RENDERING DETAILED SUB-PAGE VIEW ───────────────────────
  if (orderIdParam) {
    if (loadingDetail) {
      return (
        <div className="min-h-[70vh] flex flex-col items-center justify-center text-slate-400 gap-3">
          <RefreshCw className="w-8 h-8 animate-spin text-indigo-500" />
          <span className="text-sm font-semibold">Loading Invoice Record...</span>
        </div>
      );
    }

    if (!selectedOrder) {
      return (
        <div className="p-6 max-w-4xl mx-auto text-center space-y-4">
          <AlertCircle className="w-12 h-12 text-rose-500 mx-auto" />
          <h2 className="text-lg font-bold text-slate-800 dark:text-white">Order Record Not Found</h2>
          <Button onClick={handleCloseInvoiceView} className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl">
            Back to Registry
          </Button>
        </div>
      );
    }

    return (
      <div className="w-full max-w-full px-4 sm:px-6 lg:px-8 py-5 space-y-4 mx-auto animate__animated animate__fadeIn">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
          <div className="space-y-0.5">
            <button 
              onClick={handleCloseInvoiceView}
              className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline mb-1 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" /> {
                searchParams.get('from') === 'sales' ? 'Back to Sales Dashboard' :
                searchParams.get('from') === 'production' ? 'Back to Production Dashboard' : 
                searchParams.get('from') === 'status' ? 'Back to Order Status Board' : 
                (searchParams.get('from') === 'dashboard' || searchParams.get('from') === 'main') ? 'Back to Dashboard' : 
                'Back to Order Registry'
              }
            </button>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Tax Invoice Details
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Tax details, customer billings and line item profits for {selectedOrder.referenceNo}.
            </p>
          </div>
        </div>

        {/* Invoice Page Wrapper */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden p-6 sm:p-8 space-y-6">
          <div className="flex flex-col sm:flex-row justify-between border-b border-slate-200 dark:border-slate-800 pb-5 gap-4">
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-tight flex items-center gap-1.5">
                <Sparkles className="w-5.5 h-5.5 text-amber-500" /> {compName}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm leading-relaxed">{compAddr}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-bold font-mono mt-0.5">GSTIN: {compGstin}</p>
            </div>
            <div className="text-left sm:text-right">
              <h3 className="text-xs font-extrabold text-slate-700 dark:text-slate-300 uppercase tracking-widest bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-lg inline-block">TAX INVOICE</h3>
              <p className="text-sm font-mono font-black text-indigo-600 dark:text-indigo-400 mt-2">{selectedOrder.referenceNo}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Date: {new Date(selectedOrder.createdAt).toLocaleDateString('en-GB')}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 bg-slate-50 dark:bg-slate-950/40 p-4 rounded-xl text-xs border border-slate-200 dark:border-slate-800">
            <div className="space-y-1">
              <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Billed To Customer</span>
              <p className="font-extrabold text-slate-800 dark:text-white text-xs">
                {selectedOrder.customerName || selectedOrder.customer?.name || (selectedOrder.type === 'POS' ? 'Walk-in Cash Customer' : 'Unregistered Client')}
              </p>
              {(selectedOrder.customerPhone || selectedOrder.customer?.phone) && (
                <p className="text-slate-500 dark:text-slate-400 font-mono">
                  Phone: {selectedOrder.customerPhone || selectedOrder.customer?.phone}
                </p>
              )}
              <p className="text-slate-500 dark:text-slate-400 leading-relaxed">
                Address: {selectedOrder.deliveryAddress || selectedOrder.customer?.address || 'N/A'}
              </p>
            </div>
            <div className="text-left sm:text-right space-y-1 text-xs">
              <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Order Parameters</span>
              <p className="text-slate-700 dark:text-slate-300">Order Type: <strong className="text-slate-900 dark:text-white">{selectedOrder.type}</strong></p>
              {selectedOrder.counterId && (
                <p className="text-slate-700 dark:text-slate-300">
                  POS Counter: <strong className="text-emerald-600 font-mono">{selectedOrder.counterId}</strong>
                  {selectedOrder.cashierName && <span> • Cashier: {selectedOrder.cashierName}</span>}
                </p>
              )}
              <p className="text-slate-700 dark:text-slate-300">Payment Status: <strong className="text-indigo-600 dark:text-indigo-400">{selectedOrder.paymentStatus || selectedOrder.paymentTerms || 'PAID'}</strong></p>
              <p className="text-slate-700 dark:text-slate-300">Delivery Date: <strong className="text-slate-900 dark:text-white">{new Date(selectedOrder.deliveryDate).toLocaleDateString('en-GB')}</strong></p>
              <p className="text-slate-700 dark:text-slate-300">Status: <strong className="text-emerald-600 uppercase">{selectedOrder.status}</strong></p>
            </div>
          </div>

          {/* Invoice lines table */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left min-w-[700px]">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 text-[10px] uppercase font-bold border-b border-slate-200 dark:border-slate-800">
                  <th className="px-4 py-2.5 text-center w-12 font-bold">SN</th>
                  <th className="px-4 py-2.5">Item Details & Batch</th>
                  <th className="px-4 py-2.5 text-right w-16">Qty</th>
                  <th className="px-4 py-2.5 text-right w-24">Rate</th>
                  <th className="px-4 py-2.5 text-right w-20">Discount</th>
                  <th className="px-4 py-2.5 text-right w-32 text-indigo-600 dark:text-indigo-400 font-bold">Total Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-[11px]">
                {(selectedOrder.items || []).map((item, idx) => {
                  const sub = (Number(item.unitPrice) - Number(item.discount)) * Number(item.quantity);
                  return (
                    <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-950/10">
                      <td className="px-4 py-2.5 text-center text-slate-400 font-bold">{idx + 1}</td>
                      <td className="px-4 py-2.5 font-bold text-slate-800 dark:text-slate-200">
                        {item.productName || item.product?.name} <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">({item.product?.code || item.hsnCode || '21050000'})</span>
                        {(item.batchNo || item.expiryDate) && (
                          <div className="text-[10px] flex items-center gap-2 mt-0.5 font-normal">
                            {item.batchNo && <span className="bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 px-1.5 py-0.5 rounded font-mono font-bold">Batch: {item.batchNo}</span>}
                            {item.expiryDate && <span className="text-slate-400 font-mono">Exp: {new Date(item.expiryDate).toLocaleDateString('en-GB')}</span>}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono">{item.quantity}</td>
                      <td className="px-4 py-2.5 text-right font-mono">₹{Number(item.unitPrice).toFixed(2)}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-slate-500">₹{Number(item.discount).toFixed(2)}</td>
                      <td className="px-4 py-2.5 text-right font-extrabold text-slate-900 dark:text-white font-mono">
                        ₹{sub.toFixed(2)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col md:flex-row justify-between pt-5 border-t border-slate-200 dark:border-slate-800 gap-5 text-xs">
            {/* Left side: GST & Terms Info */}
            <div className="flex-1 space-y-4">
              <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1.5 text-slate-800 dark:text-slate-200">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">GST Applicability</span>
                <div className="text-xs space-y-1 text-slate-600 dark:text-slate-400">
                  <div className="flex justify-between">
                    <span>Tax Collection:</span>
                    <span className="font-bold">{selectedOrder.collectTax ? 'Apply GST (CGST + SGST / IGST)' : 'No Tax'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Tax Registration (GSTIN):</span>
                    <span className="font-mono font-bold">{selectedOrder.taxRegNo || 'Unregistered'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Tax Calculation Model:</span>
                    <span className="font-bold">{selectedOrder.taxType || 'Exclusive Tax'}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right side: Charges and Totals breakdown */}
            <div className="w-full md:w-96 space-y-2 bg-slate-50 dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block mb-1">Invoice Charges Summary</span>
              
              <div className="flex justify-between">
                <span>Taxable Subtotal:</span>
                <span className="font-mono font-bold text-slate-800 dark:text-white">₹{Number(selectedOrder.totalSubtotal || 0).toFixed(2)}</span>
              </div>

              <div className="flex justify-between">
                <span>Discount:</span>
                <span className="font-mono text-rose-500 font-bold">-₹{Number(selectedOrder.discountValue || 0).toFixed(2)}</span>
              </div>

              <div className="flex justify-between">
                <span>Freight Charges (GST 18%):</span>
                <span className="font-mono font-bold text-slate-800 dark:text-white">₹{Number(selectedOrder.freight || 0).toFixed(2)}</span>
              </div>

              <div className="flex justify-between">
                <span>Loading & Unloading (GST 18%):</span>
                <span className="font-mono font-bold text-slate-800 dark:text-white">₹{Number(selectedOrder.loadingCharges || 0).toFixed(2)}</span>
              </div>

              <div className="flex justify-between">
                <span>Packing Charges (GST 18%):</span>
                <span className="font-mono font-bold text-slate-800 dark:text-white">₹{Number(selectedOrder.packingCharges || 0).toFixed(2)}</span>
              </div>

              <div className="flex justify-between">
                <span>Insurance (GST 18%):</span>
                <span className="font-mono font-bold text-slate-800 dark:text-white">₹{Number(selectedOrder.insurance || 0).toFixed(2)}</span>
              </div>

              <div className="flex justify-between">
                <span>Other Charges (GST 18%):</span>
                <span className="font-mono font-bold text-slate-800 dark:text-white">₹{Number(selectedOrder.otherCharges || 0).toFixed(2)}</span>
              </div>

              {selectedOrder.collectTax && (
                <>
                  <div className="flex justify-between border-t border-slate-200 dark:border-slate-800 pt-1">
                    <span>CGST @ 9%:</span>
                    <span className="font-mono font-bold text-slate-800 dark:text-white">₹{Number(selectedOrder.cgst || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>SGST @ 9%:</span>
                    <span className="font-mono font-bold text-slate-800 dark:text-white">₹{Number(selectedOrder.sgst || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>IGST @ 18%:</span>
                    <span className="font-mono font-bold text-slate-800 dark:text-white">₹{Number(selectedOrder.igst || 0).toFixed(2)}</span>
                  </div>
                </>
              )}

              <div className="flex justify-between">
                <span>TDS Deduction (₹):</span>
                <span className="font-mono text-rose-500 font-bold">-₹{Number(selectedOrder.tdsDeduction || 0).toFixed(2)}</span>
              </div>

              <div className="flex justify-between">
                <span>Round Off (₹):</span>
                <span className="font-mono font-bold text-slate-800 dark:text-white">₹{Number(selectedOrder.roundOff || 0).toFixed(2)}</span>
              </div>

              <div className="flex justify-between text-xs font-black text-indigo-600 dark:text-indigo-400 border-t border-slate-200 dark:border-slate-800 pt-2 font-semibold">
                <span>Total Invoice Amount:</span>
                <span className="font-mono text-sm text-indigo-600 font-black">₹{Number(selectedOrder.grandTotal || 0).toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-full px-4 sm:px-6 lg:px-8 py-5 space-y-4 mx-auto transition-all duration-300">
      <DashboardBackButton />
      {!canEdit && (
        <div className="flex items-center gap-3 p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 rounded-2xl text-amber-800 dark:text-amber-300 text-sm font-medium mb-4">
          <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
          <span>You have <strong>Read-Only access</strong> to Customer Order Registry. Hitting saves, changes, additions, or deletes are restricted.</span>
        </div>
      )}
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
              <ShoppingCart className="w-5.5 h-5.5 text-indigo-600" />
              Customer Order Registry
            </h1>
            {/* Auto-Sync Live Badge */}
            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-[10px] font-bold font-mono">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>LIVE AUTO-SYNC</span>
            </div>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Browse quotations, check fulfillment timelines, and modify active sales orders.
          </p>
        </div>
        {canEdit && (
          <div className="flex gap-2">
            <Button
              onClick={() => navigate('/sales/billing?mode=sales-order')}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-3.5 py-2 rounded-xl shadow-sm h-9 flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" /> New B2B Order / Invoice
            </Button>
            <Button
              onClick={() => navigate('/sales/order')}
              className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs px-3.5 py-2 rounded-xl shadow-sm h-9 flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <FileText className="w-4 h-4" /> Sales Order
            </Button>
          </div>
        )}
      </div>

      {/* Toolbar filters matching /rm/stock */}
      <div className="bg-slate-50/50 dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row gap-3 justify-between items-center text-xs">
        <div className="flex items-center gap-2 w-full md:w-auto flex-1">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Search reference no, customer, phone, address..."
              className="pl-9 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-white rounded-xl focus:ring-indigo-500 text-xs h-9"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap w-full md:w-auto justify-end">
          {/* Document Type Filter */}
          <select
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value)}
            className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 h-9 font-semibold"
          >
            <option value="ALL">All Document Types</option>
            <option value="Sales Order">Sales Orders</option>
            <option value="Invoice">Tax Invoices</option>
            <option value="Quotation">Quotations</option>
            <option value="POS">Retail POS</option>
          </select>

          {/* Status Filter */}
          <div className="flex items-center gap-1.5">
            <Filter className="w-4 h-4 text-slate-400" />
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 h-9 font-semibold"
            >
              <option value="All">All Statuses</option>
              {Object.keys(STATUS_CONFIG).map(st => (
                <option key={st} value={st}>{st}</option>
              ))}
            </select>
          </div>

          {/* Sort By Dropdown */}
          <div className="flex items-center gap-1.5">
            <ArrowUpDown className="w-4 h-4 text-slate-400" />
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value)}
              className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 h-9 font-semibold"
            >
              <option value="date_desc">Date (Newest First)</option>
              <option value="date_asc">Date (Oldest First)</option>
              <option value="ref_asc">Ref No (Ascending)</option>
              <option value="ref_desc">Ref No (Descending)</option>
              <option value="customer_asc">Customer (A → Z)</option>
              <option value="amount_desc">Amount (Highest)</option>
              <option value="amount_asc">Amount (Lowest)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Orders Grid/Table Listing */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto text-xs animate__animated animate__fadeIn">
          <table className="w-full text-left">
            <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 uppercase font-bold tracking-widest border-b dark:border-slate-800">
              <tr>
                <th className="px-4 py-2.5 cursor-pointer group" onClick={() => handleToggleSort('ref')}>
                  <div className="flex items-center">
                    <span>Reference No</span>
                    {getSortIcon('ref')}
                  </div>
                </th>
                <th className="px-4 py-2.5 cursor-pointer group" onClick={() => handleToggleSort('customer')}>
                  <div className="flex items-center">
                    <span>Customer Name</span>
                    {getSortIcon('customer')}
                  </div>
                </th>
                <th className="px-4 py-2.5 text-center">Type</th>
                <th className="px-4 py-2.5 text-right">Items Count</th>
                <th className="px-4 py-2.5 text-right cursor-pointer group" onClick={() => handleToggleSort('amount')}>
                  <div className="flex items-center justify-end">
                    <span>Total Amount</span>
                    {getSortIcon('amount')}
                  </div>
                </th>
                <th className="px-4 py-2.5 text-center cursor-pointer group" onClick={() => handleToggleSort('date')}>
                  <div className="flex items-center justify-center">
                    <span>Delivery Date</span>
                    {getSortIcon('date')}
                  </div>
                </th>
                <th className="px-4 py-2.5 text-center">Order Status</th>
                <th className="px-4 py-2.5 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-slate-400">Loading customer orders...</td>
                </tr>
              ) : paginated.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-slate-400">No orders matched your search criteria.</td>
                </tr>
              ) : (
                paginated.map(order => {
                  const itemsCount = (order.items || []).reduce((acc, it) => acc + Number(it.quantity || 0), 0);
                  const config = STATUS_CONFIG[order.status] || { bg: 'bg-slate-50', text: 'text-slate-600', dot: 'bg-slate-400', border: 'border-slate-200' };
                  return (
                    <tr key={order.id} className="dark:border-slate-800 hover:bg-slate-50/40 dark:hover:bg-slate-800/20 transition-colors border-b border-slate-100 dark:border-slate-800 last:border-none">
                      <td className="px-4 py-2.5 font-mono font-bold text-indigo-600 dark:text-indigo-400">{order.referenceNo}</td>
                      <td className="px-4 py-2.5 font-bold text-slate-800 dark:text-slate-200">
                        <div>{order.customerName || order.customer?.name || (order.type === 'POS' ? 'Walk-in Cash Customer' : 'Unregistered Client')}</div>
                        {order.counterId && (
                          <div className="text-[10px] text-slate-400 font-mono font-normal">
                            {order.counterId} {order.cashierName ? `• ${order.cashierName}` : ''}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-center text-slate-500 font-semibold">{order.type}</td>
                      <td className="px-4 py-2.5 text-right font-mono font-bold">{itemsCount}</td>
                      <td className="px-4 py-2.5 text-right font-mono font-black text-slate-800 dark:text-white">
                        ₹{Number(order.grandTotal || order.totalSubtotal).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-2.5 text-center text-slate-500 font-semibold">
                        {new Date(order.deliveryDate).toLocaleDateString('en-GB')}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <select
                          disabled={!canEdit}
                          value={order.status}
                          onChange={(e) => handleUpdateStatus(order.id, e.target.value)}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-extrabold rounded-xl border bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all h-8 cursor-pointer font-sans disabled:opacity-75 disabled:cursor-not-allowed ${config.bg} ${config.text} ${config.border}`}
                          style={{ minWidth: '150px' }}
                        >
                          <option value="Quotation" className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 font-bold">Quotation</option>
                          <option value="Confirmed" className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 font-bold">Confirmed</option>
                          <option value="Waiting for Production" className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 font-bold">Waiting for Production</option>
                          <option value="In Production" className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 font-bold">In Production</option>
                          <option value="Ready for Shipment" className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 font-bold">Ready for Shipment</option>
                          <option value="Delivered" className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 font-bold">Delivered</option>
                          <option value="Cancelled" className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 font-bold">Cancelled</option>
                        </select>
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => setSearchParams({ id: order.id })}
                            className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20 rounded-lg transition-colors" title="View details">
                            <Eye className="w-4 h-4" />
                          </button>
                          {canEdit && (
                            <button onClick={() => handleEditOrder(order)}
                              className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20 rounded-lg transition-colors" title="Edit">
                              <Edit className="w-4 h-4" />
                            </button>
                          )}
                          {canEdit && (
                            <button onClick={() => handleDelete(order.id)}
                              className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50/50 dark:hover:bg-rose-950/20 rounded-lg transition-colors" title="Delete">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer info & Pagination Controls */}
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/20 dark:bg-slate-900/20 flex flex-col sm:flex-row justify-between items-center gap-3">
            <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium order-2 sm:order-1">
              Showing {(currentPage - 1) * PAGE_SIZE + 1} to {Math.min(currentPage * PAGE_SIZE, sortedAndFiltered.length)} of {sortedAndFiltered.length} entries
            </div>

            <div className="order-1 sm:order-2">
              <Pagination 
                currentPage={currentPage} 
                totalPages={totalPages} 
                onPageChange={setCurrentPage} 
              />
            </div>

            <div className="text-xs text-slate-400 font-medium order-3">
              Matched entries: {sortedAndFiltered.length} entries
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
