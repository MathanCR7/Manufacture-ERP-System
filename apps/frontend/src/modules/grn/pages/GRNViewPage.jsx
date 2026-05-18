import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/axios';
import { format } from 'date-fns';
import { ArrowLeft, Package, Truck, FlaskConical, CheckCircle2, XCircle, AlertTriangle, Clock, QrCode } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useRef, useEffect } from 'react';
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
  return <canvas ref={canvasRef} className="rounded-lg border border-slate-200 dark:border-slate-700" />;
}

const GRN_STATUS_MAP = {
  PENDING_LAB: { label: 'Pending Lab', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400', Icon: Clock },
  LAB_APPROVED: { label: 'Lab Approved', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400', Icon: CheckCircle2 },
  LAB_REJECTED: { label: 'Lab Rejected', cls: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400', Icon: XCircle },
  LAB_RESAMPLE: { label: 'Need Resample', cls: 'bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-400', Icon: AlertTriangle },
};

export default function GRNViewPage() {
  const { grnId } = useParams();
  const navigate = useNavigate();

  const { data: grn, isLoading } = useQuery({
    queryKey: ['grn-detail', grnId],
    queryFn: async () => { const res = await api.get(`/grn/receive/${grnId}`); return res.data; },
    enabled: !!grnId,
  });

  const status = grn ? (GRN_STATUS_MAP[grn.status] || GRN_STATUS_MAP.PENDING_LAB) : null;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="rounded-full text-slate-500">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">GRN Details</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Goods Received Note — full delivery record</p>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}</div>
      ) : !grn ? (
        <div className="text-center py-16 text-slate-400">GRN not found.</div>
      ) : (
        <div className="space-y-6">
          {/* Header Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                  <Package className="w-5 h-5 text-indigo-500" /> GRN Information
                </h3>
                {status && (
                  <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold border ${status.cls}`}>
                    <status.Icon className="w-3 h-3" /> {status.label}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-slate-500 block mb-0.5">GRN Reference</span><span className="font-mono font-bold text-violet-600 dark:text-violet-400">{grn.referenceNo}</span></div>
                <div><span className="text-slate-500 block mb-0.5">PO Reference</span><span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">{grn.po?.referenceNo}</span></div>
                <div><span className="text-slate-500 block mb-0.5">Material</span><span className="font-medium text-slate-900 dark:text-slate-100">{grn.po?.name}</span></div>
                <div><span className="text-slate-500 block mb-0.5">RM ID</span><span className="font-mono text-slate-700 dark:text-slate-300">{grn.po?.rmId}</span></div>
                <div><span className="text-slate-500 block mb-0.5">Supplier</span><span className="font-medium text-slate-900 dark:text-slate-100">{grn.po?.supplier?.name || '-'}</span></div>
                <div><span className="text-slate-500 block mb-0.5">Received By</span><span className="font-medium text-slate-900 dark:text-slate-100">{grn.receiver?.name || '-'}</span></div>
                <div><span className="text-slate-500 block mb-0.5">Received Date</span><span className="font-medium text-slate-900 dark:text-slate-100">{grn.receivedDate ? format(new Date(grn.receivedDate), 'dd MMM yyyy HH:mm') : '-'}</span></div>
                <div><span className="text-slate-500 block mb-0.5">Amount Paid</span><span className="font-bold text-emerald-600 dark:text-emerald-400">₹{Number(grn.amountPaid).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>
                <div><span className="text-slate-500 block mb-0.5">Refund Amount</span><span className="font-medium text-slate-900 dark:text-slate-100">₹{Number(grn.refundAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>
              </div>
              {grn.discrepancyNotes && (
                <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-lg text-sm text-amber-700 dark:text-amber-400 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span><strong>Discrepancy:</strong> {grn.discrepancyNotes}</span>
                </div>
              )}
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 flex flex-col items-center gap-3">
              <h3 className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2 self-start">
                <QrCode className="w-5 h-5 text-indigo-500" /> QR Code
              </h3>
              <QRDisplay text={`GRN:${grn.referenceNo}|PO:${grn.po?.referenceNo}|ID:${grn.id}`} />
              <p className="text-xs font-mono font-bold text-slate-600 dark:text-slate-300">{grn.referenceNo}</p>
            </div>
          </div>

          {/* Items */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                <Truck className="w-5 h-5 text-indigo-500" /> Received Items
              </h3>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800/50">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-400">RM ID</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-400">Material</th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-600 dark:text-slate-400">Expected</th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-600 dark:text-slate-400">Actual Received</th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-600 dark:text-slate-400">Return Qty</th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-600 dark:text-slate-400">Net Received</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {grn.items?.map(item => {
                  const net = Number(item.actualReceivedQty) - Number(item.returnQty || 0);
                  return (
                    <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                      <td className="px-4 py-3 font-mono text-xs text-slate-500">{item.rmId}</td>
                      <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">{item.rmName}</td>
                      <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-400">{Number(item.expectedQty).toLocaleString()}</td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-900 dark:text-slate-100">{Number(item.actualReceivedQty).toLocaleString()}</td>
                      <td className="px-4 py-3 text-right text-red-500">{Number(item.returnQty || 0).toLocaleString()}</td>
                      <td className="px-4 py-3 text-right font-bold text-emerald-600 dark:text-emerald-400">{net.toLocaleString()}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Lab Test Results */}
          {grn.labTest && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <h3 className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                  <FlaskConical className="w-5 h-5 text-violet-500" /> Lab Test Results
                </h3>
                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${grn.labTest.overallDecision === 'APPROVED' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400 border-emerald-200' : grn.labTest.overallDecision === 'REJECTED' ? 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400 border-red-200' : 'bg-amber-100 text-amber-700 border-amber-200'}`}>
                  {grn.labTest.overallDecision}
                </span>
              </div>
              {grn.labTest.labNotes && (
                <div className="px-6 py-3 bg-slate-50 dark:bg-slate-800/30 text-sm text-slate-600 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800">
                  <span className="font-medium">Lab Notes: </span>{grn.labTest.labNotes}
                </div>
              )}
              <table className="w-full text-sm">
                <thead className="bg-slate-50 dark:bg-slate-800/50">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-400">Material</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-400">Expiry Date</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-400">Test Notes</th>
                    <th className="px-4 py-3 text-center font-semibold text-slate-600 dark:text-slate-400">Result</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {grn.labTest.testResults?.map(tr => (
                    <tr key={tr.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                      <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">{tr.rmName}</td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{tr.expiryDate ? format(new Date(tr.expiryDate), 'dd MMM yyyy') : '-'}</td>
                      <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{tr.testNotes || '-'}</td>
                      <td className="px-4 py-3 text-center">
                        {tr.passed ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400"><CheckCircle2 className="w-3 h-3" />Pass</span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400"><XCircle className="w-3 h-3" />Fail</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {grn.labTest.categoryParams && Object.keys(grn.labTest.categoryParams).length > 0 && (
                <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800">
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
              <Button onClick={() => navigate(`/lab/test/${grn.id}`)} className="bg-violet-600 hover:bg-violet-700 text-white gap-2">
                <FlaskConical className="w-4 h-4" /> Enter Lab Results
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
