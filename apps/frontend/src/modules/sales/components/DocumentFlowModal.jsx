import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  X, GitFork, ArrowRight, CheckCircle2, Clock, Sparkles, FileText, 
  ExternalLink, Building2, Calendar, DollarSign, AlertCircle, ShoppingBag,
  CheckCheck, ShieldCheck, ChevronRight
} from 'lucide-react';
import { api } from '@/lib/axios';

export default function DocumentFlowModal({ isOpen, onClose, orderId, initialDocNo, initialOrder, onNavigateOrder }) {
  const navigate = useNavigate();
  const effectiveOrderId = orderId || initialOrder?.id;
  const effectiveDocNo = initialDocNo || initialOrder?.docNo || initialOrder?.referenceNo;
  const [loading, setLoading] = useState(true);
  const [flowData, setFlowData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isOpen) return;
    if (!effectiveOrderId) {
      setLoading(false);
      setError('No document identifier provided to trace flow.');
      return;
    }

    setLoading(true);
    setError(null);
    api.get(`/orders/${effectiveOrderId}/document-flow`)
      .then(res => {
        setFlowData(res.data);
      })
      .catch(err => {
        console.error('Failed to load document flow:', err);
        setError(err?.response?.data?.error || err.message || 'Could not load document flow history.');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [isOpen, effectiveOrderId]);

  if (!isOpen) return null;

  const getDocTypeIcon = (type) => {
    switch (type) {
      case 'Quotation':
        return <Sparkles className="w-4 h-4 text-purple-600 dark:text-purple-400" />;
      case 'Sales Order':
        return <CheckCircle2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />;
      case 'Invoice':
        return <FileText className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />;
      case 'POS':
        return <ShoppingBag className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />;
      default:
        return <FileText className="w-4 h-4 text-slate-500" />;
    }
  };

  const getDocTypeTheme = (type, isCurrent) => {
    if (isCurrent) {
      return {
        card: 'border-indigo-500 bg-indigo-50/60 dark:bg-indigo-950/40 shadow-md ring-2 ring-indigo-500/20',
        badge: 'bg-indigo-600 text-white',
        tag: 'Current Document'
      };
    }
    switch (type) {
      case 'Quotation':
        return {
          card: 'border-purple-200 dark:border-purple-850 bg-purple-50/30 dark:bg-purple-950/20 hover:border-purple-400',
          badge: 'bg-purple-100 dark:bg-purple-900/60 text-purple-800 dark:text-purple-300 border border-purple-300 dark:border-purple-700',
          tag: 'Proforma Offer'
        };
      case 'Sales Order':
        return {
          card: 'border-blue-200 dark:border-blue-850 bg-blue-50/30 dark:bg-blue-950/20 hover:border-blue-400',
          badge: 'bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:text-blue-300 border border-blue-300 dark:border-blue-700',
          tag: 'Commitment & Allocation'
        };
      case 'Invoice':
        return {
          card: 'border-indigo-200 dark:border-indigo-850 bg-indigo-50/30 dark:bg-indigo-950/20 hover:border-indigo-400',
          badge: 'bg-indigo-100 dark:bg-indigo-900/60 text-indigo-800 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-700',
          tag: 'Tax Invoice & Deduction'
        };
      default:
        return {
          card: 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900',
          badge: 'bg-slate-100 text-slate-700',
          tag: 'Standard Record'
        };
    }
  };

  const handleOpenDoc = (doc) => {
    onClose();
    if (onNavigateOrder) {
      onNavigateOrder(doc.id, doc);
      return;
    }
    if (doc.type === 'POS') {
      navigate(`/sales/billing?edit=${doc.id}`);
    } else {
      navigate(`/sales/order?id=${doc.id}`);
    }
  };

  const handleConvertToInvoice = (doc) => {
    onClose();
    navigate(`/sales/order?convertFrom=${doc.id}&mode=INVOICE`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-slate-50 via-white to-indigo-50/30 dark:from-slate-900 dark:via-slate-900 dark:to-indigo-950/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-600/20">
              <GitFork className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-slate-900 dark:text-white text-base">
                  SAP Document Flow & Transaction History
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                  Lifecycle Map
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {flowData?.chainSummary ? `Linked Flow: ${flowData.chainSummary}` : `Document Reference: ${effectiveDocNo || effectiveOrderId || 'Document'}`}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading ? (
            <div className="py-20 text-center space-y-3">
              <div className="w-10 h-10 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs font-bold text-slate-500">Tracing document linkage and transaction history...</p>
            </div>
          ) : error ? (
            <div className="p-6 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-2xl text-center space-y-2">
              <AlertCircle className="w-8 h-8 text-rose-600 mx-auto" />
              <h4 className="font-bold text-rose-900 dark:text-rose-200 text-sm">Failed to Trace Flow</h4>
              <p className="text-xs text-rose-700 dark:text-rose-300">{error}</p>
            </div>
          ) : !flowData?.chain || flowData.chain.length === 0 ? (
            <div className="py-16 text-center text-slate-400">
              <FileText className="w-10 h-10 mx-auto text-slate-300 mb-2" />
              <p className="text-xs">No linked document history found for this record.</p>
            </div>
          ) : (
            <>
              {/* FLOW DIAGRAM / STEP MAP */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-400">
                    Connected Transaction Graph ({flowData.chain.length} Documents)
                  </h4>
                  <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5" /> End-to-End Audit Verified
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 relative">
                  {flowData.documents.map((doc, idx) => {
                    const theme = getDocTypeTheme(doc.type, doc.isCurrent);
                    return (
                      <div key={doc.id} className="relative flex flex-col">
                        <div className={`p-4 rounded-2xl border transition-all flex flex-col justify-between h-full ${theme.card}`}>
                          <div>
                            {/* Card Top: Type & Current Pill */}
                            <div className="flex items-center justify-between gap-1 mb-2">
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${theme.badge}`}>
                                {getDocTypeIcon(doc.type)}
                                {doc.type}
                              </span>
                              {doc.isCurrent ? (
                                <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-indigo-600 text-white tracking-wider uppercase">
                                  Current
                                </span>
                              ) : (
                                <span className="text-[10px] font-semibold text-slate-400">
                                  Step {idx + 1}
                                </span>
                              )}
                            </div>

                            {/* Doc Number & Customer */}
                            <div className="font-mono font-black text-slate-900 dark:text-white text-sm truncate" title={doc.docNo}>
                              {doc.docNo}
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5" title={doc.customerName}>
                              {doc.customerName || 'Registered Client'}
                            </div>

                            {/* Metadata */}
                            <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800/80 space-y-1.5 text-xs">
                              <div className="flex items-center justify-between text-[11px]">
                                <span className="text-slate-400">Date:</span>
                                <span className="font-semibold text-slate-700 dark:text-slate-300">
                                  {new Date(doc.createdAt).toLocaleDateString('en-GB')}
                                </span>
                              </div>
                              <div className="flex items-center justify-between text-[11px]">
                                <span className="text-slate-400">Total Value:</span>
                                <span className="font-mono font-black text-slate-900 dark:text-white">
                                  ₹{Number(doc.grandTotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                </span>
                              </div>
                              <div className="flex items-center justify-between text-[11px]">
                                <span className="text-slate-400">Status:</span>
                                <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                                  doc.status === 'Converted'
                                    ? 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300'
                                    : doc.status === 'Delivered'
                                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                                    : 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                                }`}>
                                  {doc.status}
                                </span>
                              </div>
                              {doc.itemsCount > 0 && (
                                <div className="text-[10px] text-slate-400 mt-1">
                                  {doc.itemsCount} line item(s) included
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Action Button */}
                          <div className="mt-4 pt-2">
                            <button
                              type="button"
                              onClick={() => handleOpenDoc(doc)}
                              className="w-full py-1.5 px-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer"
                            >
                              <span>View {doc.type}</span>
                              <ExternalLink className="w-3.5 h-3.5 text-indigo-500" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* TIMELINE AUDIT TRAIL */}
              <div className="space-y-3 pt-2">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-400">
                  Lifecycle Milestones & Conversion Audit Trail
                </h4>

                <div className="bg-slate-50/60 dark:bg-slate-950/40 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 space-y-3">
                  {flowData.timeline.map((event, eIdx) => (
                    <div key={event.docId + eIdx} className="flex items-start gap-3 relative last:mb-0">
                      <div className="w-7 h-7 rounded-full bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-700 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                        {event.step}
                      </div>
                      <div className="flex-1 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                            <span>{event.action}</span>
                            <span className="font-mono text-indigo-600 dark:text-indigo-400 font-black">
                              #{event.docNo}
                            </span>
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {new Date(event.date).toLocaleDateString('en-GB')} {new Date(event.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-2">
                          <span>Amount: ₹{Number(event.grandTotal).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                          <span>•</span>
                          <span>Fulfillment: {event.status}</span>
                          <span>•</span>
                          <span>Payment: {event.paymentStatus || 'PENDING'}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950 flex items-center justify-between">
          <div className="text-xs text-slate-400">
            Chain Root: <span className="font-mono font-bold text-slate-600 dark:text-slate-300">{flowData?.chain?.[0]?.docNo || '-'}</span>
          </div>
          <div className="flex items-center gap-2">
            {/* If any Sales Order in chain isn't yet converted to Invoice, offer to convert */}
            {flowData?.documents?.some(d => d.type === 'Sales Order' && !flowData.documents.some(c => c.type === 'Invoice')) && (
              <button
                type="button"
                onClick={() => {
                  const soDoc = flowData.documents.find(d => d.type === 'Sales Order');
                  if (soDoc) handleConvertToInvoice(soDoc);
                }}
                className="px-3.5 py-2 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs cursor-pointer flex items-center gap-1.5 transition-all"
              >
                <ArrowRight className="w-3.5 h-3.5" /> Convert Order to Invoice
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
