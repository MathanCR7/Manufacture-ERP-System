import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/axios';
import { useNavigate, useParams } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import {
  CalendarIcon,
  ArrowLeft,
  Loader2,
  Search,
  X,
  ChevronDown,
  Plus,
  SaveIcon,
  AlertTriangle,
  CheckCircle2,
  Lock,
} from 'lucide-react';
import { twMerge } from 'tailwind-merge';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import DatePicker from '@/components/ui/DatePicker';
import { Skeleton } from '@/components/ui/skeleton';

/* ─────────────────────── Inline Add Supplier ─────────────────────── */
import QuickAddSupplierModal from '@/components/forms/QuickAddSupplierModal';
const AddSupplierInline = QuickAddSupplierModal;

/* ─────────────────────── Supplier Select ─────────────────────── */
function SupplierSelect({ suppliers, value, onChange, onAddNew }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef(null);

  const filtered = suppliers.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    (s.phone && s.phone.toLowerCase().includes(search.toLowerCase()))
  );

  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false); setSearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="flex gap-2 w-full">
      <div ref={containerRef} className="relative flex-1">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="w-full px-3 py-2 border rounded-md text-left flex items-center justify-between bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
        >
          <span className={value ? 'text-slate-900 dark:text-white truncate' : 'text-slate-400'}>
            {value ? `${value.name}${value.phone ? ` (${value.phone})` : ''}` : 'Select Supplier...'}
          </span>
          <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
        {open && (
          <div className="absolute z-50 mt-1 w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md shadow-lg">
            <div className="p-2 border-b border-slate-100 dark:border-slate-700 relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or phone..." className="w-full pl-8 pr-3 py-1.5 text-sm border rounded bg-transparent dark:text-white" />
            </div>
            <ul className="max-h-52 overflow-y-auto py-1">
              <li onMouseDown={() => { onChange(null); setOpen(false); setSearch(''); }} className="px-3 py-2 text-sm cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-400 italic">
                — None / Clear —
              </li>
              {filtered.length === 0 ? (
                <li className="px-3 py-2 text-sm text-slate-400 text-center">No suppliers found</li>
              ) : filtered.map(s => (
                <li
                  key={s.id}
                  onMouseDown={() => { onChange(s); setOpen(false); setSearch(''); }}
                  className={`px-3 py-2 text-sm cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 ${value?.id === s.id ? 'bg-indigo-50 dark:bg-indigo-500/20 text-indigo-600 font-medium' : ''}`}
                >
                  <span>{s.name}</span>
                  <span className="text-xs text-slate-400 block">{s.phone}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      <Button type="button" onClick={onAddNew} className="bg-indigo-500 hover:bg-indigo-600 text-white shrink-0 px-3">
        <Plus className="w-5 h-5" />
      </Button>
    </div>
  );
}

/* ─────────────────────── Main EditPOPage ─────────────────────── */
export default function EditPOPage({ id: propId, onBack }) {
  const { id: paramId } = useParams();
  const id = propId || paramId;
  const navigate = useNavigate();
  const handleBack = () => {
    if (onBack) onBack();
    else navigate(`/purchase-orders/${id}`);
  };
  const queryClient = useQueryClient();

  const [form, setForm] = useState(null);          // null until PO loaded
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [showAddSupplier, setShowAddSupplier] = useState(false);

  /* ── Fetch existing PO ── */
  const { data: po, isLoading: isLoadingPO, error: poError } = useQuery({
    queryKey: ['po-edit', id],
    queryFn: async () => {
      const res = await api.get(`/rm/po/${id}`);
      return res.data;
    },
  });

  /* ── Initialise form once PO is loaded ── */
  useEffect(() => {
    if (!po) return;
    setForm({
      name: po.name || '',
      quantity: String(po.quantity ?? ''),
      amount: String(po.amount ?? ''),
      uomId: po.uomId || '',
      expectedDelivery: po.expectedDelivery ? new Date(po.expectedDelivery) : null,
      selectedSupplier: po.supplier || null,
      // read-only display
      referenceNo: po.referenceNo || '',
      rmId: po.rmId || '',
      status: po.status || '',
      createdBy: po.user?.name || '',
      createdAt: po.createdAt || '',
    });
  }, [po]);

  /* ── Suppliers list ── */
  const { data: suppliers = [], refetch: refetchSuppliers } = useQuery({
    queryKey: ['suppliers'],
    queryFn: async () => (await api.get('/parties/suppliers')).data,
  });

  /* ── UOM list for the selected RM ── */
  const { data: allUoms = [] } = useQuery({
    queryKey: ['uoms'],
    queryFn: async () => (await api.get('/uom')).data,
  });

  /* ── Update mutation ── */
  const updateMutation = useMutation({
    mutationFn: async (payload) => {
      const res = await api.put(`/rm/po/${id}`, payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pos'] });
      queryClient.invalidateQueries({ queryKey: ['po', id] });
      queryClient.invalidateQueries({ queryKey: ['audit-logs'] });
      setSuccessMsg('Purchase Order updated successfully! Audit log has been recorded.');
      setErrorMsg('');
      setTimeout(() => handleBack(), 1800);
    },
    onError: (err) => {
      setErrorMsg(err.response?.data?.error || 'Failed to update Purchase Order.');
      setSuccessMsg('');
    },
  });

  /* ── Submit ── */
  const handleSubmit = (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!form.expectedDelivery) {
      setErrorMsg('Expected Delivery Date is required.');
      return;
    }
    if (!form.quantity || Number(form.quantity) <= 0) {
      setErrorMsg('Quantity must be greater than zero.');
      return;
    }
    if (!form.amount || Number(form.amount) <= 0) {
      setErrorMsg('Amount must be greater than zero.');
      return;
    }

    updateMutation.mutate({
      name: form.name.trim(),
      quantity: Number(form.quantity),
      amount: Number(form.amount),
      uomId: form.uomId || undefined,
      expectedDelivery: form.expectedDelivery.toISOString(),
      supplierId: form.selectedSupplier?.id || null,
    });
  };

  /* ── Loading / Error states ── */
  if (isLoadingPO || !form) {
    return (
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    );
  }

  if (poError || !po) {
    return (
      <div className="p-6 max-w-5xl mx-auto text-center mt-20">
        <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-200">PO Not Found</h2>
        <Button onClick={handleBack} variant="outline" className="mt-4">
          Back to List
        </Button>
      </div>
    );
  }

  if (po.status !== 'PENDING') {
    return (
      <div className="p-6 max-w-5xl mx-auto text-center mt-20">
        <AlertTriangle className="w-12 h-12 text-amber-400 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-200">Cannot Edit This PO</h2>
        <p className="text-slate-500 mt-2">Only <strong>PENDING</strong> purchase orders can be edited. This PO status is <strong>{po.status}</strong>.</p>
        <Button onClick={handleBack} variant="outline" className="mt-4">
          Back to List
        </Button>
      </div>
    );
  }

  const currentUom = allUoms.find(u => u.id === form.uomId);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {showAddSupplier && (
        <AddSupplierInline
          onClose={() => setShowAddSupplier(false)}
          onAdded={(newSup) => {
            setShowAddSupplier(false);
            refetchSuppliers().then(() => {
              setForm(prev => ({ ...prev, selectedSupplier: newSup }));
            });
          }}
        />
      )}

      {/* Header */}
      <div className="flex items-center space-x-4">
        <Button variant="ghost" size="icon" onClick={handleBack} className="text-slate-500 rounded-full">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Edit Purchase Order
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Editing <span className="font-mono font-semibold text-indigo-600 dark:text-indigo-400">{form.referenceNo}</span> · RM ID: <span className="font-mono">{form.rmId}</span>
          </p>
        </div>
      </div>

      {/* Status Banner */}
      <div className="flex items-center gap-2 px-4 py-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg text-amber-800 dark:text-amber-300 text-sm">
        <AlertTriangle className="w-4 h-4 shrink-0" />
        <span>All edits are audit-logged with old values, new values, editor name, role, and timestamp.</span>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
        <form onSubmit={handleSubmit}>

          {/* ── Section 1: Read-Only Info ── */}
          <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-800/10">
            <div className="flex items-center gap-2 mb-4">
              <Lock className="w-3.5 h-3.5 text-slate-400" />
              <h3 className="text-sm font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Read-Only — Cannot Be Changed</h3>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              {/* Reference No */}
              <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-3 opacity-70 cursor-not-allowed select-none">
                <p className="text-xs text-slate-400 mb-1 flex items-center gap-1"><Lock className="w-2.5 h-2.5" />Reference No</p>
                <p className="font-mono font-semibold text-slate-700 dark:text-slate-300">{form.referenceNo || '—'}</p>
              </div>
              {/* RM ID */}
              <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-3 opacity-70 cursor-not-allowed select-none">
                <p className="text-xs text-slate-400 mb-1 flex items-center gap-1"><Lock className="w-2.5 h-2.5" />RM ID</p>
                <p className="font-mono font-semibold text-slate-700 dark:text-slate-300">{form.rmId}</p>
              </div>
              {/* Status — explicitly locked */}
              <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-3 opacity-70 cursor-not-allowed select-none">
                <p className="text-xs text-slate-400 mb-1 flex items-center gap-1"><Lock className="w-2.5 h-2.5" />Status</p>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300">
                  <Lock className="w-2.5 h-2.5" />{form.status}
                </span>
                <p className="text-xs text-slate-400 mt-1">Changed via workflow only</p>
              </div>
              {/* Created By */}
              <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-3 opacity-70 cursor-not-allowed select-none">
                <p className="text-xs text-slate-400 mb-1 flex items-center gap-1"><Lock className="w-2.5 h-2.5" />Created By</p>
                <p className="font-medium text-slate-700 dark:text-slate-300">{form.createdBy}</p>
              </div>
              {/* Created At */}
              <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-3 opacity-70 cursor-not-allowed select-none">
                <p className="text-xs text-slate-400 mb-1 flex items-center gap-1"><Lock className="w-2.5 h-2.5" />Created At</p>
                <p className="text-slate-700 dark:text-slate-300">
                  {form.createdAt ? format(new Date(form.createdAt), 'dd MMM yyyy, HH:mm') : '—'}
                </p>
              </div>
            </div>
          </div>

          {/* ── Section 2: Editable Fields ── */}
          <div className="p-6 border-b border-slate-100 dark:border-slate-800">
            <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-4">Editable Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

              {/* Raw Material Name */}
              <div className="space-y-2">
                <Label htmlFor="edit-name" className="text-slate-700 dark:text-slate-300">
                  Raw Material Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="edit-name"
                  value={form.name}
                  onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Raw material name"
                  required
                  className="h-10"
                />
              </div>

              <DatePicker
                label="Expected Delivery Date"
                required
                value={form.expectedDelivery}
                onChange={date => setForm(prev => ({ ...prev, expectedDelivery: date }))}
                modalTitle="Expected Delivery"
                placeholder="Select Date"
              />

              {/* Quantity */}
              <div className="space-y-2">
                <Label htmlFor="edit-qty" className="text-slate-700 dark:text-slate-300">
                  Quantity <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="edit-qty"
                  type="number"
                  step="0.001"
                  min="0.001"
                  value={form.quantity}
                  onChange={e => setForm(prev => ({ ...prev, quantity: e.target.value }))}
                  required
                  className="h-10"
                  placeholder="0.00"
                />
              </div>

              {/* Unit of Measurement */}
              <div className="space-y-2">
                <Label htmlFor="edit-uom" className="text-slate-700 dark:text-slate-300">
                  Unit of Measurement <span className="text-red-500">*</span>
                </Label>
                <select
                  id="edit-uom"
                  value={form.uomId}
                  onChange={e => setForm(prev => ({ ...prev, uomId: e.target.value }))}
                  className="w-full h-10 px-3 py-2 text-sm border rounded-md bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-700 dark:text-slate-200"
                  required
                >
                  <option value="">Select UOM...</option>
                  {allUoms.map(u => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.abbreviation})
                    </option>
                  ))}
                </select>
              </div>

              {/* Amount */}
              <div className="space-y-2">
                <Label htmlFor="edit-amount" className="text-slate-700 dark:text-slate-300">
                  Total Amount (₹) <span className="text-red-500">*</span>
                </Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">₹</span>
                  <Input
                    id="edit-amount"
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={form.amount}
                    onChange={e => setForm(prev => ({ ...prev, amount: e.target.value }))}
                    required
                    className="h-10 pl-7"
                    placeholder="0.00"
                  />
                </div>
              </div>

              {/* Supplier */}
              <div className="space-y-2">
                <Label className="text-slate-700 dark:text-slate-300">Supplier</Label>
                <SupplierSelect
                  suppliers={suppliers}
                  value={form.selectedSupplier}
                  onChange={s => setForm(prev => ({ ...prev, selectedSupplier: s }))}
                  onAddNew={() => setShowAddSupplier(true)}
                />
                {form.selectedSupplier && (
                  <div className="mt-2 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 text-xs space-y-1 text-slate-600 dark:text-slate-400">
                    <p><strong>Phone:</strong> {form.selectedSupplier.phone || 'N/A'}</p>
                    <p><strong>GSTIN:</strong> {form.selectedSupplier.gstin || 'N/A'}</p>
                    <p><strong>PAN:</strong> {form.selectedSupplier.pan || 'N/A'}</p>
                    <p><strong>Address:</strong> {form.selectedSupplier.address || 'N/A'}</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── Section 3: Summary + Actions ── */}
          <div className="p-6">
            {/* Live Summary */}
            <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-lg p-5 mb-6">
              <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">Order Summary</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-xs text-slate-400 mb-1">RM Name</p>
                  <p className="font-medium text-slate-800 dark:text-slate-200">{form.name || '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 mb-1">Quantity</p>
                  <p className="font-medium text-slate-800 dark:text-slate-200">
                    {form.quantity || '—'} {currentUom ? currentUom.abbreviation : ''}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 mb-1">Supplier</p>
                  <p className="font-medium text-slate-800 dark:text-slate-200">{form.selectedSupplier?.name || '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 mb-1">Grand Total</p>
                  <p className="text-xl font-bold text-indigo-600 dark:text-indigo-400">
                    ₹{Number(form.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>
            </div>

            {/* Error / Success */}
            {errorMsg && (
              <div className="mb-4 p-3 bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400 rounded-md text-sm font-medium border border-red-200 dark:border-red-800 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                {errorMsg}
              </div>
            )}
            {successMsg && (
              <div className="mb-4 p-3 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 rounded-md text-sm font-medium border border-emerald-200 dark:border-emerald-800 flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
                {successMsg}
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-col sm:flex-row justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={handleBack}
                className="border-slate-300 dark:border-slate-700"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={updateMutation.isPending}
                className="bg-indigo-600 hover:bg-indigo-700 text-white min-w-36 h-11 text-base"
              >
                {updateMutation.isPending ? (
                  <><Loader2 className="w-5 h-5 mr-2 animate-spin" />Saving...</>
                ) : (
                  <><SaveIcon className="w-5 h-5 mr-2" />Save Changes</>
                )}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
