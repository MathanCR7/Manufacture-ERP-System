import React, { useState, useEffect } from 'react';
import { api } from '@/lib/axios';
import { RotateCcw, FileText, RefreshCw, Archive, Trash2, ArrowLeftRight, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import SearchSelect from '@/components/ui/SearchSelect';
import Swal from 'sweetalert2';
import { Pagination } from '@/components/ui/Pagination';
import useAuthStore from '@/app/store/authStore';

export default function SalesReturnsPage() {
  const user = useAuthStore(s => s.user);
  const canEdit = user?.role !== 'SUPERVISOR';

  const [returnsHistory, setReturnsHistory] = useState([]);
  const [recentOrders, setRecentOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Form states
  const [invoiceNo, setInvoiceNo] = useState('');
  const [reason, setReason] = useState('Quality Issue');
  const [refundMethod, setRefundMethod] = useState('Credit Note');

  // Products from verified invoice: Array of { productId, name, maxQty }
  const [invoiceProducts, setInvoiceProducts] = useState([]);
  const [returnedItems, setReturnedItems] = useState([]);

  // Pagination State for Return Logs
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 5;

  // Fetch returns history and recent orders list
  const fetchPageResources = async () => {
    setLoading(true);
    try {
      const returnRes = await api.get('/sales/returns');
      setReturnsHistory(returnRes.data || []);
      
      const ordersRes = await api.get('/orders');
      // Sort in descending order to put recent invoices first
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

  // Reset pagination page to 1 when history length changes
  useEffect(() => {
    setCurrentPage(1);
  }, [returnsHistory]);

  // Handle dropdown invoice selection change
  const handleDropdownSelect = (refNo) => {
    if (!refNo) {
      setInvoiceNo('');
      setInvoiceProducts([]);
      setReturnedItems([]);
      return;
    }
    
    setInvoiceNo(refNo);
    const selectedOrd = recentOrders.find(o => o.referenceNo === refNo);
    
    if (selectedOrd) {
      const productsList = (selectedOrd.items || []).map(item => ({
        productId: item.productId,
        name: item.product?.name || 'Finished Product',
        maxQty: Number(item.quantity)
      }));
      setInvoiceProducts(productsList);
      setReturnedItems([]);
    } else {
      setInvoiceProducts([]);
      setReturnedItems([]);
    }
  };

  const handleAddItemToReturn = (prodId) => {
    const match = invoiceProducts.find(p => p.productId === prodId);
    if (!match) return;

    if (returnedItems.some(i => i.productId === prodId)) return;

    setReturnedItems([
      ...returnedItems,
      {
        productId: prodId,
        name: match.name,
        maxQty: match.maxQty,
        quantity: 1,
        condition: 'Resaleable'
      }
    ]);
  };

  const handleUpdateReturnQty = (index, value) => {
    const updated = [...returnedItems];
    const val = Math.max(1, parseInt(value) || 1);
    updated[index].quantity = Math.min(val, updated[index].maxQty);
    setReturnedItems(updated);
  };

  const handleUpdateCondition = (index, condition) => {
    const updated = [...returnedItems];
    updated[index].condition = condition;
    setReturnedItems(updated);
  };

  const handleRemoveItem = (index) => {
    setReturnedItems(returnedItems.filter((_, i) => i !== index));
  };

  const handleSubmitReturn = async (e) => {
    e.preventDefault();
    const isDark = document.documentElement.classList.contains('dark');

    if (returnedItems.length === 0) {
      Swal.fire({
        title: '<span class="text-xs font-bold">No Items Selected</span>',
        text: 'Please select at least one product to return.',
        icon: 'warning',
      });
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        invoiceNo,
        reason,
        refundMethod,
        items: returnedItems.map(item => ({
          productId: item.productId,
          quantity: item.quantity,
          condition: item.condition
        }))
      };

      await api.post('/sales/returns', payload);

      Swal.fire({
        title: '<span class="text-xs font-bold text-slate-800">Return Logged!</span>',
        text: `Exchange processed. Stock adjusted and ledger logs created.`,
        icon: 'success',
        confirmButtonColor: '#4f46e5',
        background: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)',
        color: isDark ? '#f8fafc' : '#0f172a',
      });

      // Reset
      setInvoiceNo('');
      setInvoiceProducts([]);
      setReturnedItems([]);
      fetchPageResources();
    } catch (e) {
      Swal.fire({
        title: '<span class="text-xs font-bold text-rose-500">Return Failed</span>',
        text: e.response?.data?.error || 'Failed to submit return request.',
        icon: 'error',
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Pagination calculations
  const totalPages = Math.ceil(returnsHistory.length / ITEMS_PER_PAGE);
  const paginatedReturns = returnsHistory.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  return (
    <div className="w-full max-w-full px-4 sm:px-6 lg:px-8 py-5 space-y-4 mx-auto transition-all duration-300">
      {/* Header */}
      <div className="pb-3 border-b border-slate-205 dark:border-slate-800">
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center">
          <RotateCcw className="w-5.5 h-5.5 mr-2 text-indigo-650 shrink-0" />
          Counter Return & Exchanges Dashboard
        </h1>
        <p className="text-xs text-slate-500 mt-1 font-medium">
          Select recent counter invoices (format e.g. CO-000009) to automatically display items, log refunds, and manage resaleable inventories.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 text-xs">
        
        {/* Left Columns: Form processing */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-205 dark:border-slate-800 shadow-xs space-y-4">
            {!canEdit ? (
              <div className="flex flex-col items-center justify-center py-10 text-center space-y-3">
                <AlertTriangle className="w-10 h-10 text-amber-500 animate-pulse" />
                <h3 className="font-bold text-slate-850 dark:text-slate-200">View-Only Access</h3>
                <p className="text-xs text-slate-500 max-w-sm leading-relaxed">
                  As a Supervisor, you have read-only access to the Sales Return module. Logging new counter returns and schemes is restricted.
                </p>
              </div>
            ) : (
              <>
                <h3 className="font-bold text-slate-850 dark:text-white flex items-center gap-1.5 text-xs uppercase tracking-wider">
                  <FileText className="w-4 h-4 text-indigo-500" /> 1. Select Invoice (Recent Order Wise)
                </h3>

            {/* Unified SearchSelect dropdown resembling raw material UOM select */}
            <div className="space-y-1 w-full">
              <label className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
                Recent Customer Order / Invoice
              </label>
              <SearchSelect
                value={invoiceNo}
                onChange={handleDropdownSelect}
                options={recentOrders.map(o => ({
                  value: o.referenceNo,
                  label: `${o.referenceNo} - ${o.customer?.name || 'Walk-In Customer'}`,
                  subLabel: `Subtotal: ₹${Number(o.totalSubtotal).toFixed(2)} | Date: ${new Date(o.createdAt).toLocaleDateString('en-GB')}`
                }))}
                placeholder="Search or Select Invoice Number (e.g. CO-000009)..."
                searchPlaceholder="Type invoice number or customer name to filter..."
                triggerClassName="h-10 rounded-xl bg-slate-50 dark:bg-slate-950 text-xs font-semibold border-slate-200"
              />
            </div>

            {/* Step 2: Form configuration */}
            {invoiceNo && (
              <form onSubmit={handleSubmitReturn} className="space-y-4 pt-2 border-t dark:border-slate-800 animate__animated animate__fadeIn">
                <h3 className="font-bold text-slate-850 dark:text-white flex items-center gap-1.5 text-xs uppercase tracking-wider">
                  <Archive className="w-4 h-4 text-indigo-500" /> 2. Form Return Details
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-extrabold text-slate-450 uppercase block">Return Reason *</label>
                    <select
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 font-semibold h-10"
                    >
                      <option value="Quality Issue">Quality Issue / Spoilage</option>
                      <option value="Customer Return">Customer Returned / Exchange</option>
                      <option value="Wrong Item">Incorrect Product Delivered</option>
                      <option value="Damaged Transit">Damaged in Transit</option>
                      <option value="Other">Other / Leftover Return</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-extrabold text-slate-450 uppercase block">Refund Settlement Scheme *</label>
                    <select
                      value={refundMethod}
                      onChange={(e) => setRefundMethod(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-205 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-850 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 font-semibold h-10"
                    >
                      <option value="Credit Note">Generate Credit Note</option>
                      <option value="Cash Refund">Cash Settlement Refund</option>
                      <option value="Direct Replacement">Direct Counter Replacement</option>
                    </select>
                  </div>
                </div>

                {/* Items selection grids */}
                <div className="space-y-3">
                  <label className="text-[10px] font-extrabold text-slate-450 uppercase block">3. Add Products to Return Docket</label>
                  
                  {/* Select product dropdown options */}
                  <div className="flex flex-wrap gap-2">
                    {invoiceProducts.map(p => {
                      const isAdded = returnedItems.some(item => item.productId === p.productId);
                      return (
                        <button
                          key={p.productId}
                          type="button"
                          disabled={isAdded}
                          onClick={() => handleAddItemToReturn(p.productId)}
                          className={`px-3 py-1.5 rounded-lg text-2xs font-extrabold border transition-all ${
                            isAdded
                              ? 'bg-slate-100 text-slate-400 border-slate-200 dark:bg-slate-850 dark:border-slate-800'
                              : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-200/50 dark:bg-indigo-950/20 dark:text-indigo-400 cursor-pointer'
                          }`}
                        >
                          + {p.name} (Max {p.maxQty})
                        </button>
                      );
                    })}
                  </div>

                  {/* Return item lists dynamically compiled */}
                  <div className="space-y-2 pt-2">
                    {returnedItems.map((item, idx) => (
                      <div key={idx} className="p-3 bg-slate-50/50 dark:bg-slate-950 border dark:border-slate-850 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                        <div className="font-bold text-slate-855 dark:text-slate-100 min-w-[150px]">{item.name}</div>
                        
                        <div className="flex flex-wrap gap-3 items-center">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-bold text-slate-450">Return Qty:</span>
                            <Input
                              type="number"
                              min="1"
                              max={item.maxQty}
                              value={item.quantity}
                              onChange={(e) => handleUpdateReturnQty(idx, e.target.value)}
                              className="w-16 h-8 text-center bg-white dark:bg-slate-900 border border-slate-200 font-bold"
                            />
                            <span className="text-[10px] text-slate-400">/ Max {item.maxQty}</span>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-bold text-slate-450">Condition:</span>
                            <select
                              value={item.condition}
                              onChange={(e) => handleUpdateCondition(idx, e.target.value)}
                              className="h-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 text-2xs font-semibold focus:outline-none"
                            >
                              <option value="Resaleable">Resaleable (Put in Stock)</option>
                              <option value="Damaged">Damaged / Wasted</option>
                              <option value="Expired">Expired Spoilage</option>
                            </select>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleRemoveItem(idx)}
                            className="text-rose-500 hover:text-rose-600 cursor-pointer p-1 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/20 shrink-0"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-indigo-600 hover:bg-indigo-755 text-white font-bold py-2.5 rounded-xl shadow-md text-xs cursor-pointer h-10"
                >
                  {submitting ? 'Processing Return Log...' : 'Confirm Return & Issue Scheme'}
                </Button>
              </form>
            )}
              </>
            )}
          </div>
        </div>

        {/* Right Panel: Past Returns Logs */}
        <div className="space-y-4 text-xs">
          <div className="bg-slate-50 dark:bg-slate-900 p-5 rounded-2xl border border-slate-205 dark:border-slate-800 space-y-3">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="font-bold text-slate-850 dark:text-white flex items-center text-xs uppercase tracking-wider">
                  <ArrowLeftRight className="w-5 h-5 mr-1.5 text-indigo-500" /> Recent Return Logs
                </h3>
                <p className="text-[10px] text-slate-400 mt-0.5">Auditing and return histories.</p>
              </div>
              <Button variant="ghost" size="xs" onClick={fetchPageResources} className="p-1 border dark:border-slate-800">
                <RefreshCw className="w-3.5 h-3.5" />
              </Button>
            </div>

            <div className="space-y-2.5 overflow-y-auto max-h-[500px]">
              {loading ? (
                <div className="text-xs text-slate-455 py-12 text-center animate-pulse">Loading return histories...</div>
              ) : returnsHistory.length === 0 ? (
                <div className="text-xs text-slate-455 py-12 text-center italic">No returns logged yet.</div>
              ) : (
                <>
                  {paginatedReturns.map(ret => (
                    <div key={ret.id} className="p-3 bg-white dark:bg-slate-950 rounded-2xl border border-slate-100 dark:border-slate-850 space-y-2 shadow-3xs text-[11px]">
                      <div className="flex justify-between text-3xs font-bold text-slate-405">
                        <span className="font-mono">{ret.returnNo}</span>
                        <span>{new Date(ret.createdAt).toLocaleDateString('en-GB')}</span>
                      </div>
                      <div className="text-[11px] text-slate-500 space-y-0.5">
                        <p>Invoice: <span className="font-bold text-slate-700 dark:text-slate-300">{ret.order?.referenceNo}</span></p>
                        <p>Reason: <span className="font-semibold text-slate-700 dark:text-slate-305">{ret.reason}</span></p>
                        <p>Refund Scheme: <span className="font-extrabold text-indigo-600 dark:text-indigo-400">{ret.refundMethod}</span></p>
                      </div>

                      <div className="border-t dark:border-slate-800 pt-1.5 mt-1 space-y-0.5">
                        {ret.items?.map((item, iIdx) => (
                          <div key={iIdx} className="flex justify-between text-[10px] text-slate-400 font-medium">
                            <span>{item.product?.name} ({item.quantity} pcs)</span>
                            <span className={item.condition === 'Resaleable' ? 'text-emerald-600 font-bold' : 'text-rose-600 font-bold'}>
                              {item.condition}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                  
                  {/* Sidebar Return logs pagination */}
                  {totalPages > 1 && (
                    <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex justify-center">
                      <Pagination 
                        currentPage={currentPage} 
                        totalPages={totalPages} 
                        onPageChange={setCurrentPage} 
                      />
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
