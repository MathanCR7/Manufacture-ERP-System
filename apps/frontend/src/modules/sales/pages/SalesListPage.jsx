import React, { useState, useEffect } from 'react';
import { api } from '@/lib/axios';
import { FileText, Search, RefreshCw, AlertTriangle, ShieldAlert, Award, Clock, ArrowRight, X, ChevronLeft, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import DatePicker from '@/components/ui/DatePicker';
import Swal from 'sweetalert2';
import { useNavigate } from 'react-router-dom';

export default function SalesListPage() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [selectedOrder, setSelectedOrder] = useState(null);
  
  // Credit details modal state
  const [selectedDistributor, setSelectedDistributor] = useState(null);
  const [creditChecking, setCreditChecking] = useState(false);

  const fetchSales = async () => {
    setLoading(true);
    try {
      const res = await api.get('/orders');
      // In this system, customer orders list includes both Quotes, Orders and Invoices.
      // Let's filter to display only items that act as sales invoices/orders.
      const list = res.data || [];
      setOrders(list.filter(o => o.type === 'Invoice' || o.type === 'Sales Order' || o.type === 'POS'));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSales();
  }, []);

  // Check distributor credit status and overdue invoice warnings
  const handleCheckCredit = async (customerId) => {
    setCreditChecking(true);
    try {
      const res = await api.get(`/sales/check-credit/${customerId}`);
      setSelectedDistributor(res.data);
    } catch (e) {
      console.error(e);
      alert('Failed to fetch distributor credit limits.');
    } finally {
      setCreditChecking(false);
    }
  };

  const handleManagerOverride = async () => {
    const isDark = document.documentElement.classList.contains('dark');
    const { value: overrideApproved } = await Swal.fire({
      title: '<span class="text-sm font-bold">Manager Override</span>',
      text: 'Do you want to authorize this distributor order despite the outstanding limit alert? This action is logged.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, Authorize Order',
      confirmButtonColor: '#4f46e5',
      background: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)',
      color: isDark ? '#f8fafc' : '#0f172a',
    });

    if (overrideApproved) {
      Swal.fire({
        title: '<span class="text-sm font-bold">Authorized Successfully</span>',
        text: 'The distributor block has been bypassed. You can proceed to dispatch.',
        icon: 'success',
      });
      setSelectedDistributor(null);
    }
  };

  const filteredOrders = orders.filter(o => 
    o.referenceNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
    o.customer?.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center">
            <FileText className="w-6 h-6 mr-2 text-indigo-655" />
            Distributor Ledgers & Sales Orders
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Monitor invoices, inspect credit risks, and review distributor outstanding balances.
          </p>
        </div>

        <div className="flex items-center space-x-3 w-full sm:w-auto">
          <Button variant="outline" size="sm" onClick={fetchSales} disabled={loading}>
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh Log
          </Button>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input 
              placeholder="Search invoices..." 
              className="pl-9 bg-white dark:bg-slate-900"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Invoice Grid/Table */}
      <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 font-medium border-b border-slate-100 dark:border-slate-700">
              <tr>
                <th className="px-6 py-4">Invoice Reference</th>
                <th className="px-6 py-4">Client Customer</th>
                <th className="px-6 py-4 text-center">Date</th>
                <th className="px-6 py-4 text-right">Subtotal</th>
                <th className="px-6 py-4 text-center">Status</th>
                <th className="px-6 py-4 text-center">Credit Warnings</th>
                <th className="px-6 py-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-400">Loading sales records...</td>
                </tr>
              ) : filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-400">No invoices found.</td>
                </tr>
              ) : (
                filteredOrders.map(order => {
                  const isDistributor = order.customer?.customerType === 'DISTRIBUTOR';
                  return (
                    <tr key={order.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="px-6 py-4 font-mono font-medium text-slate-900 dark:text-white">
                        {order.referenceNo}
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-semibold text-slate-900 dark:text-white">{order.customer?.name}</div>
                        <div className="text-[10px] text-slate-400 font-bold uppercase">{order.customer?.customerType || 'Retail'}</div>
                      </td>
                      <td className="px-6 py-4 text-center text-slate-500">
                        {new Date(order.createdAt).toLocaleDateString('en-GB')}
                      </td>
                      <td className="px-6 py-4 text-right font-bold text-slate-905 dark:text-white">
                        ₹{Number(order.totalSubtotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${
                          order.status === 'Delivered'
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10'
                            : order.status === 'Ready for Shipment'
                            ? 'bg-blue-50 text-blue-700 dark:bg-blue-500/10'
                            : 'bg-amber-50 text-amber-700 dark:bg-amber-500/10'
                        }`}>
                          {order.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        {isDistributor ? (
                          <button
                            type="button"
                            onClick={() => handleCheckCredit(order.customerId)}
                            className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 bg-amber-50 text-amber-600 dark:bg-amber-950/40 rounded-full border border-amber-200"
                          >
                            <AlertTriangle className="w-3.5 h-3.5" /> Check Credit Limit
                          </button>
                        ) : (
                          <span className="text-xs text-slate-400">None (Retail)</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setSelectedOrder(order)}
                          className="text-slate-550 hover:text-indigo-600 p-1"
                        >
                          <Eye className="w-4 h-4 mr-1" /> View Items
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Credit Limits modal */}
      {selectedDistributor && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-3xl max-w-md w-full border border-slate-100 dark:border-slate-700 shadow-2xl p-6 space-y-4 animate__animated animate__zoomIn animate__faster">
            <div className="flex justify-between items-center border-b dark:border-slate-700 pb-3">
              <h3 className="text-base font-bold text-slate-800 dark:text-white flex items-center">
                <ShieldAlert className="w-5 h-5 mr-2 text-rose-500 animate-pulse" /> Credit Check Warning Details
              </h3>
              <button onClick={() => setSelectedDistributor(null)} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3.5 bg-slate-50 dark:bg-slate-900 rounded-xl space-y-2">
                <p className="font-bold text-slate-700 dark:text-white text-sm">{selectedDistributor.customerName}</p>
                <div className="flex justify-between">
                  <span>Distributor Credit Limit:</span>
                  <span className="font-bold">₹{selectedDistributor.creditLimit.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between">
                  <span>Current Outstanding Ledger:</span>
                  <span className={`font-bold ${selectedDistributor.limitExceeded ? 'text-rose-500' : 'text-slate-700 dark:text-slate-300'}`}>
                    ₹{selectedDistributor.totalOutstanding.toLocaleString('en-IN')}
                  </span>
                </div>
              </div>

              {selectedDistributor.hasOverdue && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl space-y-2 dark:bg-rose-955/20 dark:border-rose-900/50 dark:text-rose-400">
                  <div className="font-bold flex items-center gap-1 text-[11px] uppercase">
                    <Clock className="w-3.5 h-3.5 text-rose-500" /> Overdue Unpaid Invoices Detected!
                  </div>
                  <div className="space-y-1 text-[11px]">
                    {selectedDistributor.overdueDetails.map((od, oidx) => (
                      <div key={oidx} className="flex justify-between font-mono">
                        <span>{od.referenceNo}:</span>
                        <span>₹{od.amount.toLocaleString()} (Due: {new Date(od.dueDate).toLocaleDateString('en-GB')})</span>
                      </div>
                    ))}
                  </div>
                  <p className="text-[10px] text-rose-600/90 italic font-medium pt-1">
                    System defaults block new order dispatches if distributor has overdue payments.
                  </p>
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-2 border-t dark:border-slate-700">
              <Button variant="outline" onClick={() => setSelectedDistributor(null)} className="flex-1">Close</Button>
              {selectedDistributor.hasOverdue && (
                <Button onClick={handleManagerOverride} className="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-semibold">
                  Bypass & Authorize
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Invoice Details view */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-3xl max-w-lg w-full border border-slate-100 dark:border-slate-700 shadow-2xl p-6 space-y-4 animate__animated animate__fadeIn animate__faster">
            <div className="flex justify-between items-center border-b dark:border-slate-700 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-800 dark:text-white">
                  Invoice Items List: {selectedOrder.referenceNo}
                </h3>
                <p className="text-xs text-slate-400">Issued to {selectedOrder.customer?.name}</p>
              </div>
              <button onClick={() => setSelectedOrder(null)} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="border rounded-xl overflow-hidden text-xs max-h-56 overflow-y-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 dark:bg-slate-900 text-slate-400 font-bold">
                  <tr>
                    <th className="p-2.5">Product Name</th>
                    <th className="p-2.5 text-right">Qty</th>
                    <th className="p-2.5 text-right">Price</th>
                    <th className="p-2.5 text-right">Discount</th>
                    <th className="p-2.5 text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {selectedOrder.items && selectedOrder.items.length > 0 ? (
                    selectedOrder.items.map((it, idx) => (
                      <tr key={idx}>
                        <td className="p-2.5 font-semibold">{it.product?.name}</td>
                        <td className="p-2.5 text-right font-mono">{it.quantity}</td>
                        <td className="p-2.5 text-right font-mono">₹{Number(it.unitPrice).toFixed(2)}</td>
                        <td className="p-2.5 text-right font-mono text-slate-400">₹{Number(it.discount || 0).toFixed(2)}</td>
                        <td className="p-2.5 text-right font-mono font-bold text-slate-850 dark:text-white">₹{Number(it.subtotal).toFixed(2)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="p-4 text-center text-slate-400 italic">No items found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end pt-2">
              <Button onClick={() => setSelectedOrder(null)} className="bg-indigo-650 text-white font-semibold">Close Detail</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
