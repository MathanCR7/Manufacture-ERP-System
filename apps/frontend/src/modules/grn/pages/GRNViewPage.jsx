import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/axios';
import { format } from 'date-fns';
import { ArrowLeft, Package, Truck, FlaskConical, CheckCircle2, XCircle, AlertTriangle, Clock, QrCode } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useRef } from 'react';
import QRCode from 'qrcode';

function QRDisplay({ text }) {
  const canvasRef = useRef(null);
  useEffect(() => {
    if (text && canvasRef.current) {
      QRCode.toCanvas(canvasRef.current, text, { width: 120, margin: 1 }, err => {
        if (err) console.error(err);
      });
    }
  }, [text]);
  return (
    <div 
      draggable="true"
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', text);
        e.dataTransfer.effectAllowed = 'copy';
      }}
      className="cursor-grab active:cursor-grabbing hover:scale-105 hover:shadow-md transition-all duration-200 bg-white dark:bg-slate-800 p-2 rounded-xl border border-slate-100 dark:border-slate-700"
      title="Drag and drop this QR code onto the header Scan icon to track its lifecycle!"
    >
      <canvas ref={canvasRef} className="rounded-lg border border-slate-200 dark:border-slate-700" />
    </div>
  );
}

const GRN_STATUS_MAP = {
  PENDING_LAB: { label: 'Pending Lab', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400', Icon: Clock },
  LAB_APPROVED: { label: 'Lab Approved', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400', Icon: CheckCircle2 },
  LAB_REJECTED: { label: 'Lab Rejected', cls: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400', Icon: XCircle },
  LAB_RESAMPLE: { label: 'Need Resample', cls: 'bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-400', Icon: AlertTriangle },
};

import DashboardBackButton from '@/components/ui/DashboardBackButton';

export default function GRNViewPage() {
  const { grnId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const fromNotifications = location.state?.from === '/notifications';
  const [highlightActive, setHighlightActive] = useState(!!location.state?.highlight);

  useEffect(() => {
    if (highlightActive) {
      const timer = setTimeout(() => {
        setHighlightActive(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [highlightActive]);

  const { data: grn, isLoading } = useQuery({
    queryKey: ['grn-detail', grnId],
    queryFn: async () => { const res = await api.get(`/grn/receive/${grnId}`); return res.data; },
    enabled: !!grnId,
  });

  const status = grn ? (GRN_STATUS_MAP[grn.status] || GRN_STATUS_MAP.PENDING_LAB) : null;

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-4 sm:space-y-6">
      <DashboardBackButton defaultBack="/grn/list" />
      {fromNotifications && (
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => navigate('/notifications')} 
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-bold rounded-lg transition-colors w-fit"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Notifications Center
        </Button>
      )}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="rounded-full text-slate-500">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">GRN Details</h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">Goods Received Note — full delivery record</p>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}</div>
      ) : !grn ? (
        <div className="text-center py-16 text-slate-400">GRN not found.</div>
      ) : (
        <div className="space-y-4 sm:space-y-6">
          {/* Header Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
            <div className={`lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 sm:p-6 transition-all duration-1000 ${highlightActive ? 'ring-2 ring-indigo-500 ring-offset-2 dark:ring-offset-slate-900 shadow-md shadow-indigo-200 dark:shadow-indigo-900 bg-indigo-50/10 dark:bg-indigo-950/15 animate-pulse' : ''}`}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                <h3 className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                  <Package className="w-5 h-5 text-indigo-500" /> GRN Information
                </h3>
                {status && (
                  <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold border w-fit ${status.cls}`}>
                    <status.Icon className="w-3 h-3" /> {status.label}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div><span className="text-slate-500 block mb-0.5 text-xs sm:text-sm">GRN Reference</span><span className="font-mono font-bold text-violet-600 dark:text-violet-400 text-sm sm:text-base">{grn.referenceNo}</span></div>
                <div><span className="text-slate-500 block mb-0.5 text-xs sm:text-sm">PO Reference</span><span className="font-mono font-bold text-indigo-600 dark:text-indigo-400 text-sm sm:text-base">{grn.po?.referenceNo}</span></div>
                <div><span className="text-slate-500 block mb-0.5 text-xs sm:text-sm">Material</span><span className="font-medium text-slate-900 dark:text-slate-100">{grn.po?.name}</span></div>
                <div><span className="text-slate-500 block mb-0.5 text-xs sm:text-sm">RM ID</span><span className="font-mono text-slate-700 dark:text-slate-300">{grn.po?.rmId}</span></div>
                <div><span className="text-slate-500 block mb-0.5 text-xs sm:text-sm">Supplier</span><span className="font-medium text-slate-900 dark:text-slate-100">{grn.po?.supplier?.name || '-'}</span></div>
                <div><span className="text-slate-500 block mb-0.5 text-xs sm:text-sm">Received By</span><span className="font-medium text-slate-900 dark:text-slate-100">{grn.receiver?.name || '-'}</span></div>
                <div><span className="text-slate-500 block mb-0.5 text-xs sm:text-sm">Received Date</span><span className="font-medium text-slate-900 dark:text-slate-100">{grn.receivedDate ? format(new Date(grn.receivedDate), 'dd MMM yyyy HH:mm') : '-'}</span></div>
                <div><span className="text-slate-500 block mb-0.5 text-xs sm:text-sm">Amount Paid</span><span className="font-bold text-emerald-600 dark:text-emerald-400">₹{Number(grn.amountPaid).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>
                <div><span className="text-slate-500 block mb-0.5 text-xs sm:text-sm">Refund Amount</span><span className="font-medium text-slate-900 dark:text-slate-100">₹{Number(grn.refundAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>
              </div>
              {grn.discrepancyNotes && (
                <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-lg text-sm text-amber-700 dark:text-amber-400 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span><strong>Discrepancy:</strong> {grn.discrepancyNotes}</span>
                </div>
              )}
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 sm:p-6 flex flex-col items-center gap-3">
              <h3 className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2 self-start">
                <QrCode className="w-5 h-5 text-indigo-500" /> QR Code
              </h3>
              <QRDisplay text={`GRN:${grn.referenceNo}|PO:${grn.po?.referenceNo}|ID:${grn.id}`} />
              <p className="text-xs font-mono font-bold text-slate-600 dark:text-slate-300">{grn.referenceNo}</p>
            </div>
          </div>

          {/* Items */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <div className="px-4 sm:px-6 py-4 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                <Truck className="w-5 h-5 text-indigo-500" /> Received Items
              </h3>
            </div>
            
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 dark:bg-slate-800/50">
                  <tr>
                    <th className="px-6 py-3 text-left font-semibold text-slate-600 dark:text-slate-400">RM ID</th>
                    <th className="px-6 py-3 text-left font-semibold text-slate-600 dark:text-slate-400">Material</th>
                    <th className="px-6 py-3 text-right font-semibold text-slate-600 dark:text-slate-400">Expected</th>
                    <th className="px-6 py-3 text-right font-semibold text-slate-600 dark:text-slate-400">Actual Received</th>
                    <th className="px-6 py-3 text-right font-semibold text-slate-600 dark:text-slate-400">Return Qty</th>
                    <th className="px-6 py-3 text-right font-semibold text-slate-600 dark:text-slate-400">Net Received</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {grn.items?.map(item => {
                    const net = Number(item.actualReceivedQty) - Number(item.returnQty || 0);
                    return (
                      <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                        <td className="px-6 py-4 font-mono text-xs text-slate-500">{item.rmId}</td>
                        <td className="px-6 py-4 font-medium text-slate-900 dark:text-slate-100">{item.rmName}</td>
                        <td className="px-6 py-4 text-right text-slate-600 dark:text-slate-400">{Number(item.expectedQty).toLocaleString()}</td>
                        <td className="px-6 py-4 text-right font-semibold text-slate-900 dark:text-slate-100">{Number(item.actualReceivedQty).toLocaleString()}</td>
                        <td className="px-6 py-4 text-right text-red-500">{Number(item.returnQty || 0).toLocaleString()}</td>
                        <td className="px-6 py-4 text-right font-bold text-emerald-600 dark:text-emerald-400">{net.toLocaleString()}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards View */}
            <div className="block md:hidden divide-y divide-slate-100 dark:divide-slate-800">
              {grn.items?.map(item => {
                const net = Number(item.actualReceivedQty) - Number(item.returnQty || 0);
                return (
                  <div key={item.id} className="p-4 space-y-3 hover:bg-slate-50 dark:hover:bg-slate-800/30">
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <span className="font-semibold text-slate-900 dark:text-slate-100 block text-sm">{item.rmName}</span>
                        <span className="font-mono text-xs text-slate-500 block mt-0.5">RM ID: {item.rmId}</span>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-[10px] uppercase tracking-wider text-slate-400 block font-semibold">Net Recv</span>
                        <span className="font-bold text-emerald-600 dark:text-emerald-400 text-sm">{net.toLocaleString()}</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 pt-2.5 border-t border-slate-100 dark:border-slate-800 text-xs">
                      <div>
                        <span className="text-slate-400 block mb-0.5 text-[10px] uppercase tracking-wider font-semibold">Expected</span>
                        <span className="font-medium text-slate-800 dark:text-slate-200">{Number(item.expectedQty).toLocaleString()}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block mb-0.5 text-[10px] uppercase tracking-wider font-semibold">Actual Recv</span>
                        <span className="font-medium text-slate-800 dark:text-slate-200">{Number(item.actualReceivedQty).toLocaleString()}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block mb-0.5 text-[10px] uppercase tracking-wider font-semibold">Returned</span>
                        <span className="font-semibold text-red-500">{Number(item.returnQty || 0).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Lab Test Results */}
          {grn.labTest && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
              <div className="px-4 sm:px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <h3 className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                  <FlaskConical className="w-5 h-5 text-violet-500" /> Lab Test Results
                </h3>
                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border w-fit ${grn.labTest.status === 'IN_PROGRESS' ? 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-350 border-slate-200 dark:border-slate-700' : grn.labTest.overallDecision === 'APPROVED' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400 border-emerald-200' : grn.labTest.overallDecision === 'REJECTED' ? 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400 border-red-200' : 'bg-amber-100 text-amber-700 border-amber-200'}`}>
                  {grn.labTest.status === 'IN_PROGRESS' ? 'DRAFT' : grn.labTest.overallDecision}
                </span>
              </div>
              {grn.labTest.status === 'IN_PROGRESS' && (
                <div className="px-4 sm:px-6 py-3 bg-amber-50 dark:bg-amber-500/10 text-xs text-amber-800 dark:text-amber-400 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-405" />
                  <span><strong>Draft Saved:</strong> These test results are in draft mode and have not been finalized. Material stock has NOT been updated yet.</span>
                </div>
              )}
              {grn.labTest.labNotes && (
                <div className="px-4 sm:px-6 py-3 bg-slate-50 dark:bg-slate-800/30 text-sm text-slate-600 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800">
                  <span className="font-medium">Lab Notes: </span>{grn.labTest.labNotes}
                </div>
              )}

              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-800/50">
                    <tr>
                      <th className="px-6 py-3 text-left font-semibold text-slate-600 dark:text-slate-400">Material</th>
                      <th className="px-6 py-3 text-left font-semibold text-slate-600 dark:text-slate-400">Expiry Date</th>
                      <th className="px-6 py-3 text-left font-semibold text-slate-600 dark:text-slate-400">Test Notes</th>
                      <th className="px-6 py-3 text-center font-semibold text-slate-600 dark:text-slate-400">Result</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {grn.labTest.testResults?.map(tr => (
                      <tr key={tr.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                        <td className="px-6 py-4 font-medium text-slate-900 dark:text-slate-100">
                          <div>{tr.rmName}</div>
                          {tr.needTesting === false ? (
                            <span className="inline-block mt-1 text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-500 px-2 py-0.5 rounded-md font-bold uppercase tracking-wider">No Testing Required</span>
                          ) : (
                            tr.categoryParams && Object.keys(tr.categoryParams).length > 0 && (
                              <div className="mt-1.5 flex flex-wrap gap-1.5 max-w-md">
                                {Object.entries(tr.categoryParams).map(([k, v]) => (
                                  <span key={k} className="inline-flex items-center bg-violet-50/70 dark:bg-violet-950/45 text-violet-750 dark:text-violet-300 text-[10px] px-1.5 py-0.5 rounded-md border border-violet-100 dark:border-violet-900/30">
                                    <strong className="font-semibold mr-1">{k}:</strong> {v}
                                  </span>
                                ))}
                              </div>
                            )
                          )}
                        </td>
                        <td className="px-6 py-4 text-slate-600 dark:text-slate-400">{tr.expiryDate ? format(new Date(tr.expiryDate), 'dd MMM yyyy') : '-'}</td>
                        <td className="px-6 py-4 text-slate-500 dark:text-slate-400">{tr.testNotes || '-'}</td>
                        <td className="px-6 py-4 text-center">
                          {tr.needTesting === false ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs bg-slate-100 text-slate-505 dark:bg-slate-800 dark:text-slate-400"><CheckCircle2 className="w-3 h-3 text-slate-400" />Exempt</span>
                          ) : tr.passed ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400"><CheckCircle2 className="w-3 h-3" />Pass</span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400"><XCircle className="w-3 h-3" />Fail</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards View */}
              <div className="block md:hidden divide-y divide-slate-100 dark:divide-slate-800">
                {grn.labTest.testResults?.map(tr => (
                  <div key={tr.id} className="p-4 space-y-3 hover:bg-slate-50 dark:hover:bg-slate-800/30">
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <span className="font-semibold text-slate-900 dark:text-slate-100 text-sm">{tr.rmName}</span>
                        {tr.needTesting === false ? (
                          <span className="block mt-1 w-fit text-[9px] bg-slate-100 dark:bg-slate-800 text-slate-500 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">No Testing Required</span>
                        ) : (
                          tr.categoryParams && Object.keys(tr.categoryParams).length > 0 && (
                            <div className="mt-1.5 flex flex-wrap gap-1">
                              {Object.entries(tr.categoryParams).map(([k, v]) => (
                                <span key={k} className="inline-block bg-violet-50/70 dark:bg-violet-950/45 text-violet-750 dark:text-violet-300 text-[9px] px-1 py-0.5 rounded border border-violet-100/50 dark:border-violet-900/10">
                                  {k}: {v}
                                </span>
                              ))}
                            </div>
                          )
                        )}
                      </div>
                      {tr.needTesting === false ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs bg-slate-100 text-slate-505 dark:bg-slate-800 dark:text-slate-400"><CheckCircle2 className="w-3 h-3 text-slate-400" />Exempt</span>
                      ) : tr.passed ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400"><CheckCircle2 className="w-3.5 h-3.5" />Pass</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400"><XCircle className="w-3.5 h-3.5" />Fail</span>
                      )}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1">
                      <div>
                        <span className="text-slate-400 block mb-0.5 text-[10px] uppercase tracking-wider font-semibold">Expiry Date</span>
                        <span className="text-slate-800 dark:text-slate-200">{tr.expiryDate ? format(new Date(tr.expiryDate), 'dd MMM yyyy') : '-'}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block mb-0.5 text-[10px] uppercase tracking-wider font-semibold">Test Notes</span>
                        <span className="text-slate-600 dark:text-slate-400">{tr.testNotes || '-'}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {grn.labTest.categoryParams && Object.keys(grn.labTest.categoryParams).length > 0 && (
                <div className="px-4 sm:px-6 py-4 border-t border-slate-100 dark:border-slate-800">
                  <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-3">Test Parameters</h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    {Object.entries(grn.labTest.categoryParams).map(([key, value]) => (
                      <div key={key} className="bg-slate-50 dark:bg-slate-800/40 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                        <span className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">{key}</span>
                        <span className="block text-sm font-medium text-slate-800 dark:text-slate-200">{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Action for lab test if pending */}
          {grn.status === 'PENDING_LAB' && (
            <div className="flex justify-end">
              <Button 
                onClick={() => navigate(`/lab/test/${grn.id}`)} 
                className="w-full sm:w-auto bg-violet-600 hover:bg-violet-700 text-white gap-2 justify-center"
              >
                <FlaskConical className="w-4 h-4" /> 
                {grn.labTest ? 'Edit/Complete Lab Results' : 'Enter Lab Results'}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
