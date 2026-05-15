import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { api } from '@/lib/axios';
import { format } from 'date-fns';
import QRCode from 'qrcode';
import { ArrowLeft, Loader2, QrCode, Package, Truck, AlertTriangle, CheckCircle2, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';

function QRDisplay({ text }) {
  const canvasRef = useRef(null);
  useEffect(() => {
    if (text && canvasRef.current) {
      QRCode.toCanvas(canvasRef.current, text, { width: 160, margin: 1 }, err => {
        if (err) console.error(err);
      });
    }
  }, [text]);
  return <canvas ref={canvasRef} className="rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm" />;
}

export default function ReceiveDeliveryPage() {
  const { poId } = useParams();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    receivedDate: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
    amountPaid: '',
    refundAmount: '0',
    discrepancyNotes: '',
  });
  const [items, setItems] = useState([]);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const { data: po, isLoading } = useQuery({
    queryKey: ['po-detail', poId],
    queryFn: async () => { const res = await api.get(`/rm/po/${poId}`); return res.data; },
    enabled: !!poId,
  });

  useEffect(() => {
    if (po) {
      setItems([{
        rmId: po.rmId,
        rmName: po.name,
        expectedQty: Number(po.quantity),
        actualReceivedQty: Number(po.quantity),
        returnQty: 0,
      }]);
      setFormData(prev => ({ ...prev, amountPaid: String(Number(po.amount)) }));
    }
  }, [po]);

  const mutation = useMutation({
    mutationFn: async (data) => { const res = await api.post('/grn/receive', data); return res.data; },
    onSuccess: (data) => { setSubmitted(true); },
    onError: (err) => { setError(err.response?.data?.error || 'Submission failed'); },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    if (!po) return;
    mutation.mutate({
      poId: po.id,
      receivedDate: new Date(formData.receivedDate).toISOString(),
      amountPaid: Number(formData.amountPaid),
      refundAmount: Number(formData.refundAmount),
      discrepancyNotes: formData.discrepancyNotes || undefined,
      items,
    });
  };

  const updateItem = (idx, field, val) => {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, [field]: Number(val) } : it));
  };

  const totalExpected = items.reduce((s, i) => s + i.expectedQty, 0);
  const totalActual = items.reduce((s, i) => s + i.actualReceivedQty, 0);
  const totalReturn = items.reduce((s, i) => s + i.returnQty, 0);
  const hasDiscrepancy = Math.abs(totalExpected - totalActual) > 0.001;

  if (submitted) {
    return (
      <div className="p-6 max-w-2xl mx-auto flex flex-col items-center justify-center min-h-[60vh] gap-6 text-center">
        <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-500/20 rounded-full flex items-center justify-center">
          <CheckCircle2 className="w-10 h-10 text-emerald-600 dark:text-emerald-400" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">GRN Submitted Successfully</h2>
          <p className="text-slate-500 dark:text-slate-400">The delivery has been logged and sent for lab testing.</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => navigate('/grn/upcoming')}>Back to Deliveries</Button>
          <Button onClick={() => navigate('/lab/pending')} className="bg-indigo-600 hover:bg-indigo-700 text-white">Go to Lab Tests</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/grn/upcoming')} className="rounded-full text-slate-500">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Receive Delivery</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Fill in actual received quantities and payment details</p>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
      ) : !po ? (
        <div className="text-center py-16 text-slate-400">Purchase Order not found.</div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* PO Summary + QR */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
              <h3 className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                <Package className="w-5 h-5 text-indigo-500" /> Purchase Order Details
              </h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-slate-500 block">PO Reference</span><span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">{po.referenceNo}</span></div>
                <div><span className="text-slate-500 block">RM ID</span><span className="font-medium text-slate-900 dark:text-slate-100">{po.rmId}</span></div>
                <div><span className="text-slate-500 block">Material Name</span><span className="font-medium text-slate-900 dark:text-slate-100">{po.name}</span></div>
                <div><span className="text-slate-500 block">Supplier</span><span className="font-medium text-slate-900 dark:text-slate-100">{po.supplier?.name || '-'}</span></div>
                <div><span className="text-slate-500 block">Expected Qty</span><span className="font-bold text-slate-900 dark:text-slate-100">{Number(po.quantity).toLocaleString()} {po.uom?.abbreviation || ''}</span></div>
                <div><span className="text-slate-500 block">PO Amount</span><span className="font-bold text-slate-900 dark:text-slate-100">₹{Number(po.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>
              </div>
            </div>

            {/* QR Code */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 flex flex-col items-center gap-3">
              <h3 className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2 self-start">
                <QrCode className="w-5 h-5 text-indigo-500" /> QR Code
              </h3>
              <QRDisplay text={`PO:${po.referenceNo}|ID:${po.id}|RM:${po.rmId}|${po.name}`} />
              <p className="text-xs text-slate-400 text-center">Scan to verify PO details</p>
              <p className="text-xs font-mono font-bold text-slate-600 dark:text-slate-300">{po.referenceNo}</p>
            </div>
          </div>

          {/* Items Table */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                <Truck className="w-5 h-5 text-indigo-500" /> Received Items
                {hasDiscrepancy && (
                  <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400 border border-amber-200">
                    <AlertTriangle className="w-3 h-3" /> Discrepancy detected
                  </span>
                )}
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 dark:bg-slate-800/50">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-400">RM ID</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-400">Material</th>
                    <th className="px-4 py-3 text-right font-semibold text-slate-600 dark:text-slate-400">Expected Qty</th>
                    <th className="px-4 py-3 text-right font-semibold text-slate-600 dark:text-slate-400">Actual Received *</th>
                    <th className="px-4 py-3 text-right font-semibold text-slate-600 dark:text-slate-400">Return Qty</th>
                    <th className="px-4 py-3 text-right font-semibold text-slate-600 dark:text-slate-400">Diff</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {items.map((item, idx) => {
                    const diff = item.actualReceivedQty - item.expectedQty;
                    return (
                      <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                        <td className="px-4 py-3 font-mono text-xs text-slate-500">{item.rmId}</td>
                        <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">{item.rmName}</td>
                        <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-400">{item.expectedQty}</td>
                        <td className="px-4 py-3 text-right">
                          <Input type="number" step="0.01" min="0" value={item.actualReceivedQty} onChange={e => updateItem(idx, 'actualReceivedQty', e.target.value)} className="w-24 ml-auto text-right h-8" required />
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Input type="number" step="0.01" min="0" value={item.returnQty} onChange={e => updateItem(idx, 'returnQty', e.target.value)} className="w-24 ml-auto text-right h-8" />
                        </td>
                        <td className={`px-4 py-3 text-right font-semibold ${diff < 0 ? 'text-red-500' : diff > 0 ? 'text-emerald-600' : 'text-slate-400'}`}>
                          {diff > 0 ? '+' : ''}{diff.toFixed(2)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-slate-50 dark:bg-slate-800/50 font-semibold text-sm border-t border-slate-200 dark:border-slate-700">
                  <tr>
                    <td colSpan={2} className="px-4 py-3 text-slate-600 dark:text-slate-400">Totals</td>
                    <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-300">{totalExpected.toFixed(2)}</td>
                    <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-300">{totalActual.toFixed(2)}</td>
                    <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-300">{totalReturn.toFixed(2)}</td>
                    <td className={`px-4 py-3 text-right ${(totalActual - totalExpected) < 0 ? 'text-red-500' : 'text-emerald-600'}`}>
                      {(totalActual - totalExpected) >= 0 ? '+' : ''}{(totalActual - totalExpected).toFixed(2)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Payment & Notes */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
            <h3 className="font-semibold text-slate-800 dark:text-slate-200">Payment & Receipt Info</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label>Date & Time of Receipt *</Label>
                <Input type="datetime-local" value={formData.receivedDate} onChange={e => setFormData(p => ({ ...p, receivedDate: e.target.value }))} required />
              </div>
              <div className="space-y-1.5">
                <Label>Amount Paid (₹) *</Label>
                <Input type="number" step="0.01" min="0" value={formData.amountPaid} onChange={e => setFormData(p => ({ ...p, amountPaid: e.target.value }))} required placeholder="0.00" />
              </div>
              <div className="space-y-1.5">
                <Label>Refund Amount (₹)</Label>
                <Input type="number" step="0.01" min="0" value={formData.refundAmount} onChange={e => setFormData(p => ({ ...p, refundAmount: e.target.value }))} placeholder="0.00" />
              </div>
              <div className="md:col-span-2 lg:col-span-3 space-y-1.5">
                <Label>Discrepancy Notes</Label>
                <textarea
                  className="w-full border rounded-md p-3 h-24 bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm resize-none"
                  placeholder="Describe any discrepancies, damages, or issues with the delivery..."
                  value={formData.discrepancyNotes}
                  onChange={e => setFormData(p => ({ ...p, discrepancyNotes: e.target.value }))}
                />
              </div>
            </div>
          </div>

          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-600 dark:text-red-400">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => navigate('/grn/upcoming')}>Cancel</Button>
            <Button type="submit" disabled={mutation.isPending} className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2 min-w-32">
              {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {mutation.isPending ? 'Submitting...' : 'Submit GRN'}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
