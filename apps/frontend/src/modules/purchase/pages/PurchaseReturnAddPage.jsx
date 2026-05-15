import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/axios';
import { useNavigate, useLocation } from 'react-router-dom';
import { format } from 'date-fns';
import { ArrowLeft, Plus, AlertTriangle, CheckCircle, Loader2, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import useAuthStore from '@/app/store/authStore';

const RETURN_REASONS = [
  { value: 'LAB_REJECTED', label: 'Lab Test Rejected' },
  { value: 'PHYSICAL_DAMAGE', label: 'Physical Damage' },
  { value: 'WRONG_MATERIAL', label: 'Wrong Material' },
  { value: 'SHORT_EXPIRY', label: 'Short Expiry' },
  { value: 'QTY_MISMATCH', label: 'Quantity Mismatch' },
  { value: 'OTHER', label: 'Other' },
];

const PurchaseReturnAddPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);

  // Pre-fill from navigation state (from GRN page or lab rejection)
  const prefill = location.state || {};

  const [form, setForm] = useState({
    poId: prefill.poId || '',
    grnId: prefill.grnId || '',
    returnQty: prefill.returnQty || '',
    returnReason: prefill.returnReason || '',
    reasonDescription: prefill.reasonDescription || '',
    responsibleUserId: '',
    returnDate: format(new Date(), 'yyyy-MM-dd'),
    transporterName: '',
    transporterVehicle: '',
    transporterDriver: '',
    debitNoteNumber: '',
  });
  const [error, setError] = useState(null);

  // Fetch PO list
  const { data: poList = [] } = useQuery({
    queryKey: ['po-list'],
    queryFn: () => api.get('/po').then(r => r.data),
  });

  // Auto-fetch GRN when PO is selected
  const { data: grnForPO } = useQuery({
    queryKey: ['grn-for-po', form.poId],
    queryFn: () => api.get(`/grn/receive?poId=${form.poId}`).then(r => r.data),
    enabled: !!form.poId,
  });

  // Fetch users for responsible user dropdown
  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => api.get('/users').then(r => r.data),
  });

  // Selected PO details
  const selectedPO = poList.find(p => p.id === form.poId);

  // GRNs for selected PO
  const grnOptions = Array.isArray(grnForPO) ? grnForPO : grnForPO ? [grnForPO] : [];
  const selectedGRN = grnOptions.find(g => g.id === form.grnId);

  const mutation = useMutation({
    mutationFn: (payload) => api.post('/purchase-return', payload).then(r => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-returns'] });
      navigate('/purchase-return/list');
    },
    onError: (err) => setError(err?.response?.data?.error || 'Failed to create purchase return'),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    setError(null);
    if (!form.poId) return setError('Please select a Purchase Order');
    if (!form.grnId) return setError('Please select a GRN');
    if (!form.returnQty || Number(form.returnQty) <= 0) return setError('Enter a valid return quantity');
    if (!form.returnReason) return setError('Select a return reason');
    if (!form.reasonDescription) return setError('Enter a detailed reason description');

    mutation.mutate({
      poId: form.poId,
      grnId: form.grnId,
      returnQty: Number(form.returnQty),
      returnReason: form.returnReason,
      reasonDescription: form.reasonDescription,
      responsibleUserId: form.responsibleUserId || undefined,
      returnDate: form.returnDate,
      transporterName: form.transporterName || undefined,
      transporterVehicle: form.transporterVehicle || undefined,
      transporterDriver: form.transporterDriver || undefined,
      debitNoteNumber: form.debitNoteNumber || undefined,
      initiatedBy: prefill.initiatedBy || 'RECEIVER_INITIATED',
    });
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/purchase-return/list')} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
          <ArrowLeft className="w-5 h-5 text-slate-500" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <RotateCcw className="w-6 h-6 text-orange-500" />
            Add Purchase Return
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Record a return of purchased raw materials to the supplier</p>
        </div>
      </div>

      {/* Pre-fill notice */}
      {prefill.returnReason === 'LAB_REJECTED' && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 flex gap-3">
          <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-red-700 dark:text-red-400">Lab Test Rejected — Return Required</p>
            <p className="text-sm text-red-600 dark:text-red-400 mt-1">This return was auto-initiated due to lab rejection. Please complete the logistics details.</p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* PO & GRN Selection */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6 space-y-4">
          <h2 className="font-semibold text-slate-900 dark:text-white text-base border-b border-slate-100 dark:border-slate-700 pb-3">Purchase Order Details</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 block">Purchase Order *</Label>
              <select
                value={form.poId}
                onChange={e => setForm(p => ({ ...p, poId: e.target.value, grnId: '' }))}
                disabled={!!prefill.poId}
                className="w-full border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:opacity-60"
              >
                <option value="">Select PO...</option>
                {poList.map(po => (
                  <option key={po.id} value={po.id}>{po.referenceNo} — {po.name}</option>
                ))}
              </select>
            </div>

            <div>
              <Label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 block">GRN / Delivery Record *</Label>
              <select
                value={form.grnId}
                onChange={e => setForm(p => ({ ...p, grnId: e.target.value }))}
                disabled={!form.poId || !!prefill.grnId}
                className="w-full border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:opacity-60"
              >
                <option value="">Select GRN...</option>
                {grnOptions.map(g => (
                  <option key={g.id} value={g.id}>{g.referenceNo} — {format(new Date(g.receivedDate), 'dd MMM yyyy')}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Auto-filled details */}
          {selectedPO && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">Supplier</p>
                <p className="text-sm font-medium text-slate-900 dark:text-white">{selectedPO.supplier?.name || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">Raw Material</p>
                <p className="text-sm font-medium text-slate-900 dark:text-white">{selectedPO.name || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">Ordered Qty</p>
                <p className="text-sm font-medium text-slate-900 dark:text-white">{selectedPO.quantity} {selectedPO.uom?.abbreviation}</p>
              </div>
              {selectedGRN && (
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Received Qty</p>
                  <p className="text-sm font-medium text-slate-900 dark:text-white">
                    {selectedGRN.items?.reduce((s, i) => s + Number(i.actualReceivedQty), 0)} {selectedPO.uom?.abbreviation}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Return Details */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6 space-y-4">
          <h2 className="font-semibold text-slate-900 dark:text-white text-base border-b border-slate-100 dark:border-slate-700 pb-3">Return Details</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 block">Return Quantity *</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={form.returnQty}
                onChange={e => setForm(p => ({ ...p, returnQty: e.target.value }))}
                placeholder="0.00"
                className="text-sm"
              />
            </div>
            <div>
              <Label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 block">Return Reason *</Label>
              <select
                value={form.returnReason}
                onChange={e => setForm(p => ({ ...p, returnReason: e.target.value }))}
                disabled={!!prefill.returnReason}
                className="w-full border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:opacity-60"
              >
                <option value="">Select reason...</option>
                {RETURN_REASONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
          </div>
          <div>
            <Label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 block">Detailed Reason Description *</Label>
            <textarea
              value={form.reasonDescription}
              onChange={e => setForm(p => ({ ...p, reasonDescription: e.target.value }))}
              rows={3}
              placeholder="Describe in detail why these materials are being returned..."
              className="w-full border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 block">Return Date</Label>
              <Input
                type="date"
                value={form.returnDate}
                onChange={e => setForm(p => ({ ...p, returnDate: e.target.value }))}
                className="text-sm"
              />
            </div>
            <div>
              <Label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 block">Responsible User</Label>
              <select
                value={form.responsibleUserId}
                onChange={e => setForm(p => ({ ...p, responsibleUserId: e.target.value }))}
                className="w-full border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
              >
                <option value="">Select user...</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.name} ({u.role?.replace('_', ' ')})</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Transporter Details */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6 space-y-4">
          <h2 className="font-semibold text-slate-900 dark:text-white text-base border-b border-slate-100 dark:border-slate-700 pb-3">Transporter Details <span className="text-xs font-normal text-slate-400">(Optional)</span></h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 block">Transporter Name</Label>
              <Input value={form.transporterName} onChange={e => setForm(p => ({ ...p, transporterName: e.target.value }))} placeholder="Transport company" className="text-sm" />
            </div>
            <div>
              <Label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 block">Vehicle Number</Label>
              <Input value={form.transporterVehicle} onChange={e => setForm(p => ({ ...p, transporterVehicle: e.target.value }))} placeholder="MH-XX-XXXX" className="text-sm" />
            </div>
            <div>
              <Label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 block">Driver Name</Label>
              <Input value={form.transporterDriver} onChange={e => setForm(p => ({ ...p, transporterDriver: e.target.value }))} placeholder="Driver name" className="text-sm" />
            </div>
          </div>
          <div>
            <Label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 block">Debit Note Number</Label>
            <Input value={form.debitNoteNumber} onChange={e => setForm(p => ({ ...p, debitNoteNumber: e.target.value }))} placeholder="If issued by supplier" className="text-sm w-64" />
          </div>
        </div>

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-lg px-4 py-3 text-sm flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" /> {error}
          </div>
        )}

        <div className="flex items-center justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => navigate('/purchase-return/list')}>Cancel</Button>
          <Button type="submit" disabled={mutation.isPending} className="bg-orange-600 hover:bg-orange-700 text-white">
            {mutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
            Submit Return
          </Button>
        </div>
      </form>
    </div>
  );
};

export default PurchaseReturnAddPage;
