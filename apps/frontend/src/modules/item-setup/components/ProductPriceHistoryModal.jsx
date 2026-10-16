import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  X, TrendingUp, TrendingDown, DollarSign, Calendar, Clock,
  User, FileText, ShoppingBag, Receipt, Sparkles, RefreshCw,
  Layers, Package, AlertCircle, ArrowUpRight, ArrowDownRight,
  ChevronDown, ChevronUp, CheckCircle2, ShieldCheck, Tag,
  Calculator, Plus, ExternalLink, Info, Filter, ArrowRight
} from 'lucide-react';
import { api } from '@/lib/axios';
import Swal from 'sweetalert2';

export default function ProductPriceHistoryModal({ 
  productId, 
  productName, 
  productCode, 
  product, 
  isOpen = true, 
  onClose, 
  onPriceUpdated 
}) {
  const effectiveId = productId || product?.id;
  const effectiveName = productName || product?.name;
  const effectiveCode = productCode || product?.code || product?.sku;

  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('revisions'); // 'revisions' | 'po_bom' | 'planner' | 'update'
  const [expandedRevision, setExpandedRevision] = useState(null);
  const [docFilter, setDocFilter] = useState('ALL'); // 'ALL' | 'INVOICE' | 'SALES_ORDER' | 'QUOTATION'

  // Price revision form state
  const [newPrice, setNewPrice] = useState('');
  const [changeReason, setChangeReason] = useState('');

  // Margin Planner simulation state
  const [simulatedPrice, setSimulatedPrice] = useState('');
  const [simulatedMarginPct, setSimulatedMarginPct] = useState('');

  // 1. Fetch Price History & Linked Documents
  const {
    data: historyData,
    isLoading: isHistoryLoading,
    refetch: refetchHistory
  } = useQuery({
    queryKey: ['product-price-history', effectiveId],
    queryFn: async () => {
      const res = await api.get(`/products/${effectiveId}/price-history`);
      return res.data;
    },
    enabled: !!effectiveId && isOpen
  });

  // 2. Fetch PO-Derived Live BOM Cost Analysis
  const {
    data: bomData,
    isLoading: isBomLoading,
    refetch: refetchBom
  } = useQuery({
    queryKey: ['product-bom-cost-analysis', effectiveId],
    queryFn: async () => {
      const res = await api.get(`/products/${effectiveId}/bom-cost-analysis`);
      return res.data;
    },
    enabled: !!effectiveId && isOpen
  });

  // 3. Price Revision Mutation
  const priceUpdateMutation = useMutation({
    mutationFn: async ({ price, reason }) => {
      const res = await api.put(`/products/${effectiveId}/price`, {
        newPrice: Number(price),
        reason: reason || 'Manual price revision in catalog'
      });
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['product-price-history', effectiveId] });
      queryClient.invalidateQueries({ queryKey: ['product-bom-cost-analysis', effectiveId] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      onPriceUpdated?.(data);
      Swal.fire({
        icon: 'success',
        title: 'Price Updated Successfully',
        text: `New selling price has been set and logged in history.`,
        confirmButtonColor: '#4f46e5'
      });
      setNewPrice('');
      setChangeReason('');
      setActiveTab('revisions');
    },
    onError: (err) => {
      Swal.fire({
        icon: 'error',
        title: 'Price Update Failed',
        text: err.response?.data?.error || err.message || 'Could not update price',
        confirmButtonColor: '#ef4444'
      });
    }
  });

  if (!isOpen || !effectiveId) return null;

  const handleUpdatePrice = (e) => {
    e.preventDefault();
    if (!newPrice || Number(newPrice) <= 0) {
      Swal.fire({ icon: 'warning', title: 'Invalid Price', text: 'Please enter a valid positive price.' });
      return;
    }
    priceUpdateMutation.mutate({ price: newPrice, reason: changeReason });
  };

  const productData = historyData?.product || product || {};
  const kpi = historyData?.kpi || {};
  const revisions = historyData?.revisions || [];
  const bomItems = bomData?.bomItems || [];

  const currentPrice = Number(productData.currentSalePrice || productData.salePrice || 0);
  const liveBomCost = Number(bomData?.liveBomCost || productData.totalCost || 0);
  const liveGrossProfit = currentPrice - liveBomCost;
  const liveMarginPct = currentPrice > 0 ? ((liveGrossProfit / currentPrice) * 100).toFixed(2) : 0;

  // Simulator calculations
  const simPriceNum = Number(simulatedPrice) || currentPrice;
  const simGrossProfit = simPriceNum - liveBomCost;
  const simMarginPct = simPriceNum > 0 ? ((simGrossProfit / simPriceNum) * 100).toFixed(2) : 0;

  const displayName = effectiveName || productData.name || 'Product';
  const displayCode = effectiveCode || productData.code || productData.sku || 'PRD';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-5xl max-h-[92vh] flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden text-slate-800 dark:text-slate-100">
        
        {/* Top Header Banner */}
        <div className="shrink-0 px-6 py-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border-b border-indigo-900/50 flex items-center justify-between text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center text-amber-400 shadow-inner">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-400/30 uppercase tracking-wider">
                  {displayCode}
                </span>
                <span className="text-xs text-indigo-300 font-medium">
                  {productData.categoryName || 'Catalog Product'} &bull; UOM: {productData.uom || 'Nos'}
                </span>
              </div>
              <h2 className="text-lg font-black tracking-tight text-white mt-0.5">
                {displayName}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => { refetchHistory(); refetchBom(); }}
              className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-slate-200 hover:text-white transition"
              title="Refresh Data"
            >
              <RefreshCw className={`w-4 h-4 ${(isHistoryLoading || isBomLoading) ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg bg-white/10 hover:bg-rose-600 text-slate-300 hover:text-white transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 4 Summary KPI Cards */}
        <div className="shrink-0 p-5 bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800 grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          
          {/* 1. Current Price */}
          <div className="p-3.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/60 rounded-xl shadow-xs">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-medium mb-1">
              <span>Catalog Selling Price</span>
              <DollarSign className="w-3.5 h-3.5 text-indigo-500" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white font-mono">
                ₹{currentPrice.toFixed(2)}
              </span>
              <span className="text-[11px] text-slate-400">/{product.uom || 'unit'}</span>
            </div>
            <button
              onClick={() => { setActiveTab('update'); setNewPrice(String(currentPrice)); }}
              className="mt-2 text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span>Revise Price</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          {/* 2. PO-Derived Live BOM Cost */}
          <div className="p-3.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/60 rounded-xl shadow-xs">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-medium mb-1">
              <span>PO-Derived BOM Cost</span>
              <Layers className="w-3.5 h-3.5 text-amber-500" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white font-mono">
                ₹{liveBomCost.toFixed(2)}
              </span>
              <span className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold">Latest POs</span>
            </div>
            <div className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
              {bomItems.length} constituent ingredients tracked
            </div>
          </div>

          {/* 3. Live Gross Margin */}
          <div className="p-3.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/60 rounded-xl shadow-xs">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-medium mb-1">
              <span>Live Gross Margin</span>
              <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className={`text-xl sm:text-2xl font-black font-mono ${Number(liveMarginPct) >= 20 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600'}`}>
                {liveMarginPct}%
              </span>
              <span className="text-[11px] text-slate-500 font-mono">
                (+₹{liveGrossProfit.toFixed(2)})
              </span>
            </div>
            <div className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
              Selling Price &minus; PO Landed BOM
            </div>
          </div>

          {/* 4. Sales Track Record */}
          <div className="p-3.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/60 rounded-xl shadow-xs">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-medium mb-1">
              <span>Sales Track Record</span>
              <Receipt className="w-3.5 h-3.5 text-sky-500" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white font-mono">
                {kpi.lifetimeUnitsSold || 0}
              </span>
              <span className="text-[11px] text-slate-400">sold lifetime</span>
            </div>
            <div className="mt-2 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
              Total Revenue: ₹{(kpi.lifetimeRevenue || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
          </div>

        </div>

        {/* Tab Selector Navigation */}
        <div className="shrink-0 px-6 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4 overflow-x-auto">
          <div className="flex items-center gap-1 sm:gap-2">
            <button
              onClick={() => setActiveTab('revisions')}
              className={`py-3 px-3.5 text-xs font-bold border-b-2 transition flex items-center gap-2 cursor-pointer ${
                activeTab === 'revisions'
                  ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Price Revisions & Documents ({revisions.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('po_bom')}
              className={`py-3 px-3.5 text-xs font-bold border-b-2 transition flex items-center gap-2 cursor-pointer ${
                activeTab === 'po_bom'
                  ? 'border-amber-500 text-amber-600 dark:text-amber-400 dark:border-amber-400'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Raw Material PO Rates & BOM ({bomItems.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('planner')}
              className={`py-3 px-3.5 text-xs font-bold border-b-2 transition flex items-center gap-2 cursor-pointer ${
                activeTab === 'planner'
                  ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400 dark:border-emerald-400'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              <Calculator className="w-3.5 h-3.5" />
              <span>Margin Planning Simulator</span>
            </button>

            <button
              onClick={() => setActiveTab('update')}
              className={`py-3 px-3.5 text-xs font-bold border-b-2 transition flex items-center gap-2 cursor-pointer ${
                activeTab === 'update'
                  ? 'border-sky-600 text-sky-600 dark:text-sky-400 dark:border-sky-400'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              <Tag className="w-3.5 h-3.5" />
              <span>Update Selling Price</span>
            </button>
          </div>

          {activeTab === 'revisions' && (
            <div className="flex items-center gap-1.5 py-2">
              <span className="text-[11px] text-slate-400 font-medium">Filter Docs:</span>
              <select
                value={docFilter}
                onChange={(e) => setDocFilter(e.target.value)}
                className="text-xs bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2 py-1 font-medium"
              >
                <option value="ALL">All Documents</option>
                <option value="INVOICE">Tax Invoices Only</option>
                <option value="SALES_ORDER">Sales Orders Only</option>
                <option value="QUOTATION">Quotations Only</option>
              </select>
            </div>
          )}
        </div>

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">

          {/* TAB 1: REVISIONS & ASSOCIATED DOCUMENTS */}
          {activeTab === 'revisions' && (
            <div className="space-y-4">
              {revisions.length === 0 ? (
                <div className="p-8 text-center text-slate-400 border border-dashed border-slate-300 dark:border-slate-800 rounded-xl">
                  <Clock className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p className="font-semibold text-sm">No historical price revisions logged yet.</p>
                  <p className="text-xs mt-1">When you revise the product price, each revision and its associated sales orders will appear here.</p>
                </div>
              ) : (
                revisions.map((rev, index) => {
                  const isCurrent = !rev.effectiveTo;
                  const isExpanded = expandedRevision === rev.revisionId || (index === 0 && expandedRevision === null);
                  const docs = (rev.associatedDocuments || []).filter(d => docFilter === 'ALL' || d.docType === docFilter);

                  return (
                    <div
                      key={rev.revisionId || index}
                      className={`border rounded-xl overflow-hidden transition-all shadow-xs ${
                        isCurrent
                          ? 'border-indigo-500/50 bg-indigo-50/15 dark:bg-indigo-950/15'
                          : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-850'
                      }`}
                    >
                      {/* Revision Header Accordion Toggle */}
                      <div
                        onClick={() => setExpandedRevision(isExpanded ? false : rev.revisionId)}
                        className="px-5 py-3.5 flex items-center justify-between cursor-pointer hover:bg-slate-50/50 dark:hover:bg-slate-800/50 select-none"
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs ${
                            isCurrent
                              ? 'bg-indigo-600 text-white shadow-xs'
                              : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                          }`}>
                            #{revisions.length - index}
                          </div>

                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-base font-black font-mono text-slate-900 dark:text-white">
                                ₹{Number(rev.newPrice).toFixed(2)}
                              </span>
                              
                              {rev.delta !== 0 && (
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-0.5 ${
                                  rev.delta > 0
                                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                                    : 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                                }`}>
                                  {rev.delta > 0 ? <ArrowUpRight className="w-2.5 h-2.5" /> : <ArrowDownRight className="w-2.5 h-2.5" />}
                                  {rev.percentChange}
                                </span>
                              )}

                              {isCurrent && (
                                <span className="text-[10px] font-extrabold uppercase bg-indigo-600 text-white px-2 py-0.5 rounded-full">
                                  Current Active Price
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 mt-1">
                              <span>
                                Valid: <strong>{new Date(rev.effectiveFrom).toLocaleDateString('en-IN')} {new Date(rev.effectiveFrom).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</strong>
                                {rev.effectiveTo ? ` &rarr; ${new Date(rev.effectiveTo).toLocaleDateString('en-IN')}` : ' &rarr; Present'}
                              </span>
                              <span>&bull;</span>
                              <span>Changed by: <strong>{rev.changedByUserName || 'System'}</strong></span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-4">
                          <div className="text-right hidden sm:block">
                            <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                              {rev.summary?.counts?.total || 0} Documents Linked
                            </div>
                            <div className="text-[11px] text-slate-500">
                              Qty: {rev.summary?.totalQty || 0} &bull; Total: ₹{(rev.summary?.totalRevenue || 0).toLocaleString('en-IN')}
                            </div>
                          </div>

                          {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                        </div>
                      </div>

                      {/* Revision Reason Banner */}
                      {rev.reason && (
                        <div className="px-5 py-2 bg-slate-50 dark:bg-slate-800/40 border-t border-slate-200/50 dark:border-slate-800/50 text-xs text-slate-600 dark:text-slate-300 flex items-center gap-2">
                          <Info className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                          <span><b>Reason for Revision:</b> {rev.reason}</span>
                        </div>
                      )}

                      {/* Expanded Associated Documents Table */}
                      {isExpanded && (
                        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 space-y-3">
                          <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                            <span>Documents Created During this Price Period ({docs.length})</span>
                            <div className="flex items-center gap-2 text-[11px] font-normal text-slate-500">
                              <span>Invoices: {rev.summary?.counts?.invoices || 0}</span>
                              <span>&bull;</span>
                              <span>Orders: {rev.summary?.counts?.orders || 0}</span>
                              <span>&bull;</span>
                              <span>Quotations: {rev.summary?.counts?.quotations || 0}</span>
                            </div>
                          </div>

                          {docs.length === 0 ? (
                            <div className="p-4 text-center text-xs text-slate-400 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                              No {docFilter !== 'ALL' ? docFilter.toLowerCase() : ''} documents recorded during this price period.
                            </div>
                          ) : (
                            <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden bg-white dark:bg-slate-800">
                              <table className="w-full text-left text-xs border-collapse">
                                <thead>
                                  <tr className="bg-slate-100 dark:bg-slate-750 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700">
                                    <th className="py-2.5 px-3">Doc #</th>
                                    <th className="py-2.5 px-3">Type</th>
                                    <th className="py-2.5 px-3">Date & Time</th>
                                    <th className="py-2.5 px-3">Customer</th>
                                    <th className="py-2.5 px-3 text-center">Qty</th>
                                    <th className="py-2.5 px-3 text-right">Billed Rate</th>
                                    <th className="py-2.5 px-3 text-right">Subtotal</th>
                                    <th className="py-2.5 px-3 text-center">Status</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                                  {docs.map((d, dIdx) => {
                                    const isInvoice = d.docType === 'INVOICE';
                                    const isQuote = d.docType === 'QUOTATION';
                                    const typeBadgeColor = isInvoice
                                      ? 'bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300'
                                      : isQuote
                                      ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                                      : 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300';

                                    return (
                                      <tr key={d.id || dIdx} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                                        <td className="py-2 px-3 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                                          {d.docNo}
                                        </td>
                                        <td className="py-2 px-3">
                                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${typeBadgeColor}`}>
                                            {d.docType}
                                          </span>
                                        </td>
                                        <td className="py-2 px-3 text-slate-500 font-mono text-[11px]">
                                          {new Date(d.createdAt).toLocaleDateString('en-IN')} {new Date(d.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                                        </td>
                                        <td className="py-2 px-3 font-semibold text-slate-800 dark:text-slate-200">
                                          {d.customerName}
                                        </td>
                                        <td className="py-2 px-3 text-center font-bold font-mono">
                                          {d.quantity}
                                        </td>
                                        <td className="py-2 px-3 text-right font-mono font-bold text-slate-900 dark:text-white">
                                          ₹{Number(d.unitPrice).toFixed(2)}
                                        </td>
                                        <td className="py-2 px-3 text-right font-mono font-bold text-slate-900 dark:text-white">
                                          ₹{Number(d.subtotal).toFixed(2)}
                                        </td>
                                        <td className="py-2 px-3 text-center">
                                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-medium">
                                            {d.orderStatus || d.paymentStatus || 'POSTED'}
                                          </span>
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* TAB 2: RAW MATERIAL PO RATES & BOM COST ANALYSIS */}
          {activeTab === 'po_bom' && (
            <div className="space-y-4">
              <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl text-xs text-amber-900 dark:text-amber-200 flex items-start gap-3">
                <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <strong>Live Purchase Order Rate Synchronization:</strong>
                  <p className="mt-0.5 text-amber-800 dark:text-amber-300">
                    Below are the Raw Materials configured in this product's Recipe/BOM. Each ingredient automatically displays its <b>most recent Purchase Order (PO) rate</b>, supplier name, and reference document. The BOM cost is dynamically aggregated using these actual procurement values.
                  </p>
                </div>
              </div>

              <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-850 shadow-xs">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700">
                      <th className="py-3 px-4">Raw Material Ingredient</th>
                      <th className="py-3 px-3">Consumption</th>
                      <th className="py-3 px-3">Latest PO #</th>
                      <th className="py-3 px-3">PO Supplier</th>
                      <th className="py-3 px-3 text-right">PO Rate (Unit)</th>
                      <th className="py-3 px-4 text-right">Cost Contribution</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {bomItems.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-400">
                          No Bill of Materials (BOM) configured for this product.
                        </td>
                      </tr>
                    ) : (
                      bomItems.map((item, idx) => (
                        <tr key={item.rawMaterialId || idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                          <td className="py-2.5 px-4">
                            <div className="font-bold text-slate-900 dark:text-white">
                              {item.rawMaterialName}
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono">
                              {item.rawMaterialCode} &bull; {item.category}
                            </div>
                          </td>
                          <td className="py-2.5 px-3 font-mono font-semibold text-slate-700 dark:text-slate-300">
                            {item.consumptionPerUnit} {item.uom}
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="font-mono text-[11px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 px-2 py-0.5 rounded border border-indigo-200 dark:border-indigo-800">
                              {item.latestPoRefNo}
                            </span>
                            {item.latestPoDate && (
                              <div className="text-[10px] text-slate-400 mt-0.5">
                                {new Date(item.latestPoDate).toLocaleDateString('en-IN')}
                              </div>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300 font-medium">
                            {item.supplierName}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900 dark:text-white">
                            ₹{Number(item.poUnitRate).toFixed(2)}
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono font-black text-amber-600 dark:text-amber-400">
                            ₹{Number(item.costContribution).toFixed(2)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  <tfoot className="bg-slate-50 dark:bg-slate-800/80 font-bold border-t-2 border-slate-200 dark:border-slate-700">
                    <tr>
                      <td colSpan={5} className="py-3 px-4 text-right text-slate-700 dark:text-slate-300">
                        Total PO-Derived Raw Material BOM Cost:
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-sm font-black text-slate-900 dark:text-white">
                        ₹{liveBomCost.toFixed(2)}
                      </td>
                    </tr>
                    <tr>
                      <td colSpan={5} className="py-2 px-4 text-right text-slate-500">
                        Current Selling Price:
                      </td>
                      <td className="py-2 px-4 text-right font-mono font-black text-indigo-600 dark:text-indigo-400">
                        ₹{currentPrice.toFixed(2)}
                      </td>
                    </tr>
                    <tr className="bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-300">
                      <td colSpan={5} className="py-3 px-4 text-right font-black">
                        Current Gross Profit / Margin:
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-sm font-black">
                        ₹{liveGrossProfit.toFixed(2)} ({liveMarginPct}%)
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: MARGIN PLANNING SIMULATOR */}
          {activeTab === 'planner' && (
            <div className="space-y-6">
              <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs text-emerald-900 dark:text-emerald-200 flex items-start gap-3">
                <Calculator className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <strong>Dynamic Price & Profit Margin Planning Simulator:</strong>
                  <p className="mt-0.5 text-emerald-800 dark:text-emerald-300">
                    Use this tool to simulate price changes. Enter an intended selling price or a desired profit margin to immediately preview the financial impact before committing the change to the master catalog.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Input Simulation Controls */}
                <div className="p-5 bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-800 rounded-xl space-y-4">
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
                    Simulation Variables
                  </h3>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Simulated Selling Price (₹)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder={`Current: ₹${currentPrice}`}
                      value={simulatedPrice}
                      onChange={(e) => setSimulatedPrice(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg font-mono font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Or Target Gross Margin (%)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      placeholder={`e.g. 35%`}
                      value={simulatedMarginPct}
                      onChange={(e) => {
                        const m = Number(e.target.value);
                        setSimulatedMarginPct(e.target.value);
                        if (m > 0 && m < 100 && liveBomCost > 0) {
                          const calculatedPrice = (liveBomCost / (1 - m / 100)).toFixed(2);
                          setSimulatedPrice(calculatedPrice);
                        }
                      }}
                      className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg font-mono font-bold"
                    />
                  </div>

                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setNewPrice(String(simPriceNum));
                        setChangeReason(`Planned price revision to achieve ${simMarginPct}% margin`);
                        setActiveTab('update');
                      }}
                      className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-lg transition shadow-sm cursor-pointer flex items-center justify-center gap-2"
                    >
                      <Tag className="w-3.5 h-3.5" />
                      <span>Apply Simulated Price as New Catalog Rate</span>
                    </button>
                  </div>
                </div>

                {/* Simulation Output Card */}
                <div className="p-5 bg-gradient-to-br from-slate-900 to-indigo-950 text-white rounded-xl space-y-4 shadow-lg border border-indigo-900">
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-indigo-300">
                    Projected Financial Outcome
                  </h3>

                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <div className="p-3 bg-white/5 rounded-lg border border-white/10">
                      <div className="text-[11px] text-indigo-300 font-medium">BOM Unit Cost</div>
                      <div className="text-xl font-bold font-mono text-white mt-1">₹{liveBomCost.toFixed(2)}</div>
                    </div>

                    <div className="p-3 bg-white/5 rounded-lg border border-white/10">
                      <div className="text-[11px] text-indigo-300 font-medium">Simulated Sale Price</div>
                      <div className="text-xl font-bold font-mono text-amber-400 mt-1">₹{simPriceNum.toFixed(2)}</div>
                    </div>
                  </div>

                  <div className="p-4 bg-white/10 rounded-lg border border-white/10 space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-300">Projected Gross Profit / Unit:</span>
                      <strong className="font-mono text-emerald-400 text-sm">₹{simGrossProfit.toFixed(2)}</strong>
                    </div>

                    <div className="flex justify-between text-xs">
                      <span className="text-slate-300">Projected Margin Percentage:</span>
                      <strong className={`font-mono text-sm ${Number(simMarginPct) >= 20 ? 'text-emerald-400' : 'text-amber-400'}`}>
                        {simMarginPct}%
                      </strong>
                    </div>

                    <div className="flex justify-between text-xs pt-1 border-t border-white/10">
                      <span className="text-slate-300">Price Variance vs Current:</span>
                      <strong className={`font-mono ${simPriceNum >= currentPrice ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {simPriceNum >= currentPrice ? `+₹${(simPriceNum - currentPrice).toFixed(2)}` : `-₹${(currentPrice - simPriceNum).toFixed(2)}`}
                      </strong>
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    * Simulation uses real-time PO purchase rates from constituent raw materials. Applying this price will not modify past completed sales orders or historical invoices.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: UPDATE SELLING PRICE FORM */}
          {activeTab === 'update' && (
            <div className="max-w-2xl mx-auto p-6 bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs space-y-5">
              <div className="flex items-center gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
                <div className="w-9 h-9 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                  <Tag className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                    Publish New Selling Price for {product.name}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Existing sales orders and tax invoices will stay permanently locked at their original prices.
                  </p>
                </div>
              </div>

              <form onSubmit={handleUpdatePrice} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
                      Current Price
                    </label>
                    <div className="px-3 py-2 bg-slate-100 dark:bg-slate-800 rounded-lg text-sm font-mono font-bold text-slate-600 dark:text-slate-400">
                      ₹{currentPrice.toFixed(2)}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      New Selling Price (₹) *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      placeholder="e.g. 135.00"
                      value={newPrice}
                      onChange={(e) => setNewPrice(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg font-mono font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Reason for Revision / Commercial Policy Note *
                  </label>
                  <textarea
                    rows={3}
                    required
                    placeholder="e.g. Revision due to raw material PO price inflation / Q4 corporate pricing strategy..."
                    value={changeReason}
                    onChange={(e) => setChangeReason(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="pt-2 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setActiveTab('revisions')}
                    className="px-4 py-2 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={priceUpdateMutation.isPending || !newPrice}
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition shadow-sm flex items-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {priceUpdateMutation.isPending ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Updating...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Confirm & Log Price Revision</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="shrink-0 px-6 py-3 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <div>
            Manufacturing ERP &bull; Product Lifecycle & Pricing Intelligence
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-lg text-xs font-bold transition cursor-pointer"
          >
            Close View
          </button>
        </div>

      </div>
    </div>
  );
}
