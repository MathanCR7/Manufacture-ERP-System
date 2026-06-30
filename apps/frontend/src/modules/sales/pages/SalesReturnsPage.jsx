import React, { useState, useEffect } from 'react';
import { api } from '@/lib/axios';
import { RotateCcw, FileText, RefreshCw, Archive, Trash2, ArrowLeftRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import SearchSelect from '@/components/ui/SearchSelect';
import Swal from 'sweetalert2';

export default function SalesReturnsPage() {
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

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="pb-4 border-b border-slate-150 dark:border-slate-800">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center">
          <RotateCcw className="w-6 h-6 mr-2 text-indigo-600" />
          Counter Return & Exchanges Dashboard
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Select recent counter invoices (format e.g. CO-000009) to automatically display items, log refunds, and manage resaleable inventories.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Columns: Form processing */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm space-y-5">
            
            <h3 className="font-bold text-slate-850 dark:text-white flex items-center gap-1.5 text-xs uppercase tracking-wider">
              <FileText className="w-4 h-4 text-indigo-500" /> 1. Select Invoice (Recent Order Wise)
            </h3>

            {/* Unified SearchSelect dropdown resembling raw material UOM select */}
            <div className="space-y-1 w-full">
              <label className="text-2xs font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
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
                triggerClassName="h-11 rounded-xl bg-slate-50 dark:bg-slate-950 text-xs font-medium border-slate-200 dark:border-slate-850"
              />
            </div>

            {/* Select product from verified invoice list */}
            {invoiceProducts.length > 0 && (
              <div className="p-4 bg-slate-50 dark:bg-slate-950/60 rounded-2xl border border-slate-100 dark:border-slate-850 space-y-3">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                  Add Items from Invoice to Return / Exchange
                </label>
                <div className="flex flex-wrap gap-2">
                  {invoiceProducts.map(p => (
                    <button
                      key={p.productId}
                      type="button"
                      onClick={() => handleAddItemToReturn(p.productId)}
                      className="px-3.5 py-2 bg-white dark:bg-slate-900 border dark:border-slate-800 text-xs font-bold rounded-xl hover:border-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-400 text-slate-700 dark:text-slate-200 cursor-pointer shadow-3xs transition-all"
                    >
                      {p.name} (Max {p.maxQty} pcs)
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Return processing configurations */}
            {returnedItems.length > 0 && (
              <form onSubmit={handleSubmitReturn} className="space-y-5 pt-2">
                <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-1.5 text-xs uppercase tracking-wider border-t dark:border-slate-800 pt-5">
                  <Archive className="w-4 h-4 text-indigo-500" /> 2. Configure Refund & Material Conditions
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-2xs font-extrabold text-slate-450 dark:text-slate-550 uppercase">Reason for return</label>
                    <select
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl px-3 py-2.5 text-xs text-slate-800 dark:text-white focus:outline-none"
                    >
                      <option value="Damaged">Damaged / Melted</option>
                      <option value="Wrong Product">Wrong Product Shipped</option>
                      <option value="Quality Issue">Quality Issue</option>
                      <option value="Expiry Concern">Near Expiry</option>
                      <option value="Customer Preference">Customer Choice</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-2xs font-extrabold text-slate-450 dark:text-slate-550 uppercase">Refund / Credit Scheme</label>
                    <select
                      value={refundMethod}
                      onChange={(e) => setRefundMethod(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl px-3 py-2.5 text-xs text-slate-800 dark:text-white focus:outline-none"
                    >
                      <option value="Credit Note">Issue Credit Note (B2B)</option>
                      <option value="Cash Refund">Cash / UPI Refund</option>
                      <option value="Replacement">Product Replacement Order</option>
                    </select>
                  </div>
                </div>

                {/* Returned items grid config */}
                <div className="space-y-2.5">
                  <label className="text-2xs font-extrabold text-slate-450 dark:text-slate-550 uppercase block">Configure item conditions</label>
                  <div className="space-y-3">
                    {returnedItems.map((item, idx) => (
                      <div key={idx} className="p-4 bg-slate-50 dark:bg-slate-950 border dark:border-slate-850 rounded-2xl flex flex-col sm:flex-row gap-4 items-center justify-between shadow-2xs">
                        <div className="flex-1 w-full">
                          <p className="font-bold text-xs text-slate-800 dark:text-white">{item.name}</p>
                          <p className="text-[10px] text-slate-400 mt-0.5">Invoice Qty: {item.maxQty}</p>
                        </div>
                        <div className="flex items-center gap-3 shrink-0 w-full sm:w-auto justify-end">
                          {/* Qty field */}
                          <div className="space-y-1 w-20">
                            <label className="text-[8px] uppercase font-bold text-slate-400">Return Qty</label>
                            <Input
                              type="number"
                              min="1"
                              max={item.maxQty}
                              value={item.quantity}
                              onChange={(e) => handleUpdateReturnQty(idx, e.target.value)}
                              className="h-8 text-xs font-bold bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
                            />
                          </div>
                          {/* Condition selection */}
                          <div className="space-y-1 w-32">
                            <label className="text-[8px] uppercase font-bold text-slate-400">Condition</label>
                            <select
                              value={item.condition}
                              onChange={(e) => handleUpdateCondition(idx, e.target.value)}
                              className="w-full bg-white dark:bg-slate-900 border dark:border-slate-800 rounded-lg p-1 text-[10px] h-8 text-slate-850 dark:text-slate-200"
                            >
                              <option value="Resaleable">Resaleable (To Stock)</option>
                              <option value="Damaged">Damaged (Wastage Log)</option>
                              <option value="Destroy">Destroy (Wastage Log)</option>
                            </select>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleRemoveItem(idx)}
                            className="text-rose-500 hover:text-rose-600 mt-4 cursor-pointer p-1 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/20"
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
                  className="w-full bg-indigo-600 hover:bg-indigo-755 text-white font-bold py-3 rounded-xl mt-3 shadow-md h-12 text-xs cursor-pointer"
                >
                  {submitting ? 'Processing Return Log...' : 'Confirm Return & Issue Scheme'}
                </Button>
              </form>
            )}
          </div>
        </div>

        {/* Right Panel: Past Returns Logs */}
        <div className="space-y-6">
          <div className="bg-slate-50 dark:bg-slate-900 p-6 rounded-2xl border border-slate-200/50 dark:border-slate-800 space-y-4">
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

            <div className="space-y-2.5 max-h-[480px] overflow-y-auto pr-1">
              {loading ? (
                <div className="text-xs text-slate-450 py-12 text-center animate-pulse">Loading return histories...</div>
              ) : returnsHistory.length === 0 ? (
                <div className="text-xs text-slate-450 py-12 text-center italic">No returns logged yet.</div>
              ) : (
                returnsHistory.map(ret => (
                  <div key={ret.id} className="p-3.5 bg-white dark:bg-slate-850 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-2.5 shadow-3xs">
                    <div className="flex justify-between text-2xs font-semibold text-slate-800 dark:text-slate-205">
                      <span className="font-mono">{ret.returnNo}</span>
                      <span>{new Date(ret.createdAt).toLocaleDateString('en-GB')}</span>
                    </div>
                    <div className="text-2xs text-slate-500 space-y-0.5">
                      <p>Invoice: <span className="font-bold text-slate-700 dark:text-slate-350">{ret.order?.referenceNo}</span></p>
                      <p>Reason: <span className="font-medium text-slate-700 dark:text-slate-300">{ret.reason}</span></p>
                      <p>Refund Scheme: <span className="font-medium text-indigo-600">{ret.refundMethod}</span></p>
                    </div>

                    <div className="border-t dark:border-slate-800 pt-2 mt-1 space-y-1">
                      {ret.items?.map((item, iIdx) => (
                        <div key={iIdx} className="flex justify-between text-[10px] text-slate-400 font-medium">
                          <span>{item.product?.name} ({item.quantity} pcs)</span>
                          <span className={item.condition === 'Resaleable' ? 'text-emerald-500 font-bold' : 'text-rose-500 font-bold'}>
                            {item.condition}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
