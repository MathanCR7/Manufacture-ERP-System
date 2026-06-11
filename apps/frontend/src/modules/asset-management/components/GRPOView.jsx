import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/axios';
import useAuthStore from '@/app/store/authStore';
import { format } from 'date-fns';
import DatePicker from '@/components/ui/DatePicker';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Plus, Search, Truck, CheckCircle2, X, Eye, ArrowLeft,
  Loader2, AlertTriangle, ChevronDown, Package, Camera,
  Hash, ClipboardCheck, FileText, AlertOctagon, BarChart2, Edit, Trash2
} from 'lucide-react';
import Swal from 'sweetalert2';

const STATUS_STYLES = {
  Draft: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700',
  'Quality Check': 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400 border-amber-200 dark:border-amber-900/50',
  Accepted: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/50',
  'Partially Accepted': 'bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400 border-blue-200 dark:border-blue-900/50',
  Rejected: 'bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400 border-rose-200 dark:border-rose-900/50',
};

const CONDITION_STYLES = {
  'Good': 'text-emerald-600',
  'Minor Damage': 'text-amber-500',
  'Major Damage': 'text-rose-600',
  'Not Received': 'text-slate-400',
};

function GRPODetailModal({ grpo, onClose }) {
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-slate-900 w-full max-w-3xl rounded-3xl shadow-2xl border border-slate-200/60 dark:border-slate-800 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 px-6 py-4 flex items-center justify-between z-10 rounded-t-3xl">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white font-mono">{grpo.grpoNo}</h2>
              <span className={`px-3 py-1 rounded-full text-xs font-bold border ${STATUS_STYLES[grpo.status] || STATUS_STYLES.Draft}`}>{grpo.status}</span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">Received {format(new Date(grpo.receivedDate), 'dd MMM yyyy')} by {grpo.receivedBy}</p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            {[
              { label: 'Vendor Name', value: grpo.vendorName },
              { label: 'Delivery Note No.', value: grpo.deliveryNoteNo || '—' },
              { label: 'Received By', value: grpo.receivedBy },
              { label: 'Location', value: grpo.receivingLocation || '—' },
              { label: 'Challan/Invoice No.', value: grpo.challanNo || '—' },
              { label: 'Vehicle No.', value: grpo.vehicleNo || '—' },
            ].map(({ label, value }) => (
              <div key={label} className="space-y-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</p>
                <p className="font-semibold text-slate-800 dark:text-slate-200 text-xs">{value}</p>
              </div>
            ))}
          </div>

          {grpo.items?.length > 0 && (
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800">
                  <tr>
                    {['Item', 'HSN/SAC', 'PO Qty', 'Received Qty', 'Accepted Qty', 'Rejected Qty', 'Condition', 'Serial No.', 'Remarks'].map(h => (
                      <th key={h} className="px-3 py-2.5 text-left font-bold text-slate-500 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {grpo.items.map((item, i) => (
                    <tr key={i} className="hover:bg-slate-50/60">
                      <td className="px-3 py-2.5 font-medium text-slate-800 dark:text-slate-200">{item.itemDescription}</td>
                      <td className="px-3 py-2.5 font-mono text-slate-500">{item.hsnSac || '—'}</td>
                      <td className="px-3 py-2.5">{item.poQuantity}</td>
                      <td className="px-3 py-2.5 font-bold">{item.receivedQuantity}</td>
                      <td className="px-3 py-2.5 text-emerald-600 font-bold">{item.acceptedQuantity}</td>
                      <td className="px-3 py-2.5 text-rose-500 font-bold">{item.rejectedQuantity}</td>
                      <td className="px-3 py-2.5">
                        <span className={`font-semibold ${CONDITION_STYLES[item.condition] || ''}`}>{item.condition}</span>
                      </td>
                      <td className="px-3 py-2.5 font-mono text-slate-500">{item.serialNo || '—'}</td>
                      <td className="px-3 py-2.5 text-slate-500">{item.inspectionRemarks || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {grpo.qualityCheckNotes && (
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Quality Check Notes</p>
              <p className="text-sm text-slate-600 dark:text-slate-400 bg-amber-50 dark:bg-amber-950/20 p-3 rounded-xl border border-amber-100 dark:border-amber-900/30">{grpo.qualityCheckNotes}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function POSelect({ pos = [], value, onChange, disabled }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = React.useRef(null);

  const sortedPOs = [...pos].sort((a, b) => {
    if (a.poDate && b.poDate) {
      return new Date(b.poDate) - new Date(a.poDate);
    }
    return b.poNo.localeCompare(a.poNo);
  });

  const filtered = sortedPOs.filter(p =>
    p.poNo?.toLowerCase().includes(search.toLowerCase()) ||
    p.vendorName?.toLowerCase().includes(search.toLowerCase())
  );

  React.useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={containerRef} className="relative w-full">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(!open)}
        className={`w-full px-4 h-10 border rounded-xl text-left flex items-center justify-between transition-all duration-200 shadow-sm ${
          disabled ? 'opacity-65 cursor-not-allowed bg-slate-100/50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-800' :
          open ? 'bg-indigo-50/50 border-indigo-400 ring-4 ring-indigo-500/10 dark:bg-indigo-900/10 dark:border-indigo-500' : 'bg-slate-50/50 dark:bg-slate-900/50 border-slate-300 dark:border-slate-700 hover:border-indigo-400 hover:bg-white dark:hover:bg-slate-800'
        }`}
      >
        <span className={value ? 'text-slate-900 dark:text-white truncate font-medium text-sm' : 'text-slate-500 dark:text-slate-400 text-sm'}>
          {value ? `${value.poNo} — ${value.vendorName}` : 'Select Purchase Order...'}
        </span>
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${open ? 'rotate-180 text-indigo-500' : ''}`} />
      </button>
      {open && !disabled && (
        <div className="absolute z-50 mt-2 w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="p-2 border-b border-slate-100 dark:border-slate-700 relative bg-slate-50/50 dark:bg-slate-900/50">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search PO No or Vendor..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all dark:text-white"
              autoFocus
            />
          </div>
          <ul className="max-h-60 overflow-y-auto p-1">
            {filtered.length === 0 ? (
              <li className="px-4 py-8 text-sm text-slate-500 flex flex-col items-center justify-center">
                <Search className="w-6 h-6 text-slate-300 mb-2" />
                No purchase orders found
              </li>
            ) : (
              filtered.map(p => {
                const total = p.items?.reduce((s, i) => s + Number(i.totalWithGst || 0), 0) || Number(p.grandTotal || 0);
                return (
                  <li
                    key={p.id}
                    onMouseDown={() => { onChange(p); setOpen(false); setSearch(''); }}
                    className="px-4 py-2.5 mx-1 my-0.5 rounded-lg text-sm cursor-pointer hover:bg-indigo-50 hover:text-indigo-700 dark:hover:bg-indigo-500/10 dark:hover:text-indigo-300 transition-colors flex flex-col justify-start group"
                  >
                    <div className="flex justify-between w-full">
                      <span className="font-semibold text-slate-700 dark:text-slate-300 group-hover:text-indigo-700 dark:group-hover:text-indigo-300">{p.poNo}</span>
                      <span className="font-bold text-slate-900 dark:text-white group-hover:text-indigo-700 dark:group-hover:text-indigo-300">₹{total.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                    </div>
                    <span className="text-xs text-slate-400 mt-0.5">{p.vendorName} • {p.items?.length || 0} items • {p.poDate ? format(new Date(p.poDate), 'dd MMM yyyy hh:mm a') : '—'}</span>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

function CreateGRPOForm({ onBack, isReadOnly, editGRPOId }) {
  const [form, setForm] = useState({
    poId: '',
    vendorName: '',
    receivedDate: null,
    receivedBy: '',
    receivingLocation: '',
    deliveryNoteNo: '',
    challanNo: '',
    vehicleNo: '',
    qualityCheckNotes: '',
    items: [],
  });
  const [error, setError] = useState('');
  const qc = useQueryClient();
  const isPoLinked = !!form.poId;

  const { data: pos = [] } = useQuery({
    queryKey: ['asset-pos-open'],
    queryFn: () => api.get('/asset-management/purchase-orders').then(r => r.data.filter(p => ['Approved', 'Sent'].includes(p.status))),
  });

  const { data: allPOs = [] } = useQuery({
    queryKey: ['asset-pos'],
    queryFn: () => api.get('/asset-management/purchase-orders').then(r => r.data),
  });

  const { data: grpos = [] } = useQuery({
    queryKey: ['asset-grpos'],
    enabled: false,
  });

  React.useEffect(() => {
    if (editGRPOId && grpos.length > 0 && allPOs.length > 0) {
      const found = grpos.find(g => g.id === editGRPOId);
      if (found) {
        const linkedPO = allPOs.find(p => p.poNo === found.poNo);
        setForm({
          poId: linkedPO?.id || '',
          vendorName: found.vendorName || '',
          receivedDate: found.receivedDate ? new Date(found.receivedDate) : null,
          receivedBy: found.receivedBy || '',
          receivingLocation: found.receivingLocation || '',
          deliveryNoteNo: found.deliveryNoteNo || '',
          challanNo: found.challanNo || '',
          vehicleNo: found.vehicleNo || '',
          qualityCheckNotes: found.qualityCheckNotes || '',
          items: found.items?.map(i => ({
            id: i.id,
            itemDescription: i.itemDescription || i.description || '',
            hsnSac: i.hsnSac || '',
            poQuantity: Number(i.poQuantity || i.poQty || 0),
            receivedQuantity: Number(i.receivedQuantity || i.receivedQty || 0),
            acceptedQuantity: Number(i.acceptedQuantity || i.acceptedQty || 0),
            rejectedQuantity: Number(i.rejectedQuantity || i.rejectedQty || 0),
            condition: i.condition || 'Good',
            serialNo: i.serialNo || '',
            assetTagNo: i.assetTag || i.assetTagNo || '',
            inspectionRemarks: i.inspectionRemarks || i.remarks || '',
          })) || [],
        });
      }
    }
  }, [editGRPOId, grpos, allPOs]);

  const mutation = useMutation({
    mutationFn: data => {
      if (editGRPOId) {
        return api.put(`/asset-management/grpo/${editGRPOId}`, data).then(r => r.data);
      } else {
        return api.post('/asset-management/grpo', data).then(r => r.data);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['asset-grpos'] });
      qc.invalidateQueries({ queryKey: ['asset-pos-open'] });
      qc.invalidateQueries({ queryKey: ['asset-pos'] });
      Swal.fire({
        icon: 'success',
        title: editGRPOId ? 'GRPO Updated!' : 'GRPO Created!',
        text: editGRPOId ? 'Goods receipt PO updated successfully.' : 'Goods/Assets received and logged successfully.',
        confirmButtonColor: '#4f46e5'
      }).then(() => onBack());
    },
    onError: err => setError(err.response?.data?.error || `Failed to ${editGRPOId ? 'update' : 'create'} GRPO`),
  });

  const handleSubmit = e => {
    e.preventDefault();
    setError('');
    if (!form.poId) { setError('Please link this GRPO to an open Purchase Order'); return; }
    if (!form.receivedDate) { setError('Received date is required'); return; }
    if (!form.receivedBy) { setError('Received by is required'); return; }
    if (form.items.length === 0) { setError('No items found. Please select a Purchase Order to import items.'); return; }
    if (form.items.some(i => !i.itemDescription)) { setError('All items need descriptions'); return; }
    mutation.mutate(form);
  };

  const update = (f, v) => setForm(p => ({ ...p, [f]: v }));
  const updateItem = (idx, f, v) => {
    setForm(p => ({
      ...p,
      items: p.items.map((item, i) => {
        if (i !== idx) return item;
        const updated = { ...item, [f]: v };
        if (f === 'receivedQuantity' || f === 'rejectedQuantity') {
          const received = Number(f === 'receivedQuantity' ? v : updated.receivedQuantity);
          const rejected = Number(f === 'rejectedQuantity' ? v : updated.rejectedQuantity);
          updated.acceptedQuantity = Math.max(0, received - rejected);
        }
        return updated;
      }),
    }));
  };
  const addItem = () => setForm(p => ({
    ...p, items: [...p.items, {
      itemDescription: '', hsnSac: '', poQuantity: 0, receivedQuantity: 0,
      acceptedQuantity: 0, rejectedQuantity: 0, condition: 'Good', serialNo: '', assetTagNo: '', inspectionRemarks: '',
    }]
  }));
  const removeItem = idx => setForm(p => ({ ...p, items: p.items.filter((_, i) => i !== idx) }));

  const fillFromPO = poId => {
    const po = pos.find(p => p.id === poId);
    if (!po) return;
    setForm(prev => ({
      ...prev, poId,
      vendorName: po.vendorName,
      items: po.items?.map(i => ({
        itemDescription: i.itemDescription, hsnSac: i.hsnSac,
        poQuantity: Number(i.quantity), receivedQuantity: 0, acceptedQuantity: 0, rejectedQuantity: 0,
        condition: 'Good', serialNo: '', assetTagNo: '', inspectionRemarks: '',
      })) || prev.items,
    }));
  };

  return (
    <div className="space-y-6 w-full">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onBack} className="rounded-full border border-slate-200 dark:border-slate-700">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            {editGRPOId ? 'Edit Goods Receipt (GRPO)' : 'Goods Receipt (GRPO)'}
          </h2>
          <p className="text-sm text-slate-500">SAP B1 Asset Procurement — Step 4 of 8</p>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-3 p-4 bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/50 rounded-2xl text-rose-700 dark:text-rose-400 text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Fill from PO */}
        <div className="border border-indigo-200 dark:border-indigo-900/50 bg-indigo-50/40 dark:bg-indigo-950/20 rounded-2xl p-5">
          <h3 className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider mb-3 flex items-center gap-2">
            <FileText className="w-4 h-4" /> Link to Purchase Order
          </h3>
          <div className="relative max-w-md">
            <POSelect
              disabled={!!editGRPOId}
              pos={pos}
              value={pos.find(p => p.id === form.poId) || allPOs.find(p => p.id === form.poId) || null}
              onChange={po => fillFromPO(po.id)}
            />
          </div>
        </div>

        {/* Receipt Details */}
        <div className="border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
            <Truck className="w-4 h-4 text-indigo-500" /> Receipt Details
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label>Vendor Name <span className="text-rose-500">*</span></Label>
              <Input required disabled={isPoLinked || !!editGRPOId} value={form.vendorName} onChange={e => update('vendorName', e.target.value)} className="h-10 rounded-xl disabled:opacity-60 disabled:cursor-not-allowed disabled:bg-slate-100/50 dark:disabled:bg-slate-800/50" />
            </div>
            <DatePicker label="Received Date *" value={form.receivedDate} onChange={d => update('receivedDate', d)} placeholder="Select date" />
            <div className="space-y-1.5">
              <Label>Received By <span className="text-rose-500">*</span></Label>
              <Input required value={form.receivedBy} onChange={e => update('receivedBy', e.target.value)} placeholder="Store keeper / officer name" className="h-10 rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <Label>Receiving Location</Label>
              <Input value={form.receivingLocation} onChange={e => update('receivingLocation', e.target.value)} placeholder="e.g. Main Store, IT Room" className="h-10 rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <Label>Delivery Note No.</Label>
              <Input value={form.deliveryNoteNo} onChange={e => update('deliveryNoteNo', e.target.value)} className="h-10 rounded-xl font-mono" />
            </div>
            <div className="space-y-1.5">
              <Label>Challan / Invoice No.</Label>
              <Input value={form.challanNo} onChange={e => update('challanNo', e.target.value)} className="h-10 rounded-xl font-mono" />
            </div>
            <div className="space-y-1.5">
              <Label>Vehicle No.</Label>
              <Input value={form.vehicleNo} onChange={e => update('vehicleNo', e.target.value)} placeholder="MH-01-AB-1234" className="h-10 rounded-xl" />
            </div>
          </div>
        </div>

        {/* Item Inspection */}
        <div className="border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <ClipboardCheck className="w-4 h-4 text-indigo-500" /> Item-wise Inspection
            </h3>
            {!isPoLinked && !editGRPOId && (
              <Button type="button" variant="outline" size="sm" onClick={addItem} className="h-8 rounded-lg text-xs gap-1 border-indigo-200 dark:border-indigo-900 text-indigo-600 hover:bg-indigo-50">
                <Plus className="w-3.5 h-3.5" /> Add Item
              </Button>
            )}
          </div>
          <div className="space-y-4">
            {form.items.map((item, idx) => (
              <div key={idx} className="bg-slate-50/60 dark:bg-slate-800/30 rounded-xl p-4 border border-slate-200/60 dark:border-slate-800/60">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                  <div className="md:col-span-2 space-y-1">
                    <Label className="text-xs">Item Description <span className="text-rose-500">*</span></Label>
                    <Input
                      disabled={isPoLinked || !!editGRPOId}
                      value={item.itemDescription}
                      onChange={e => updateItem(idx, 'itemDescription', e.target.value)}
                      className="h-9 rounded-lg text-sm disabled:opacity-60 disabled:cursor-not-allowed disabled:bg-slate-100/50 dark:disabled:bg-slate-800/50"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">HSN/SAC</Label>
                    <Input
                      disabled={isPoLinked || !!editGRPOId}
                      value={item.hsnSac}
                      onChange={e => updateItem(idx, 'hsnSac', e.target.value)}
                      className="h-9 rounded-lg text-sm font-mono disabled:opacity-60 disabled:cursor-not-allowed disabled:bg-slate-100/50 dark:disabled:bg-slate-800/50"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">PO Quantity</Label>
                    <Input
                      disabled={isPoLinked || !!editGRPOId}
                      type="number"
                      min="0"
                      value={item.poQuantity}
                      onChange={e => updateItem(idx, 'poQuantity', e.target.value)}
                      className="h-9 rounded-lg text-sm disabled:opacity-60 disabled:cursor-not-allowed disabled:bg-slate-100/50 dark:disabled:bg-slate-800/50"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Received Qty <span className="text-rose-500">*</span></Label>
                    <Input type="number" min="0" value={item.receivedQuantity} onChange={e => updateItem(idx, 'receivedQuantity', e.target.value)} className="h-9 rounded-lg text-sm border-blue-200 dark:border-blue-900 focus:ring-blue-500/20" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Rejected Qty</Label>
                    <Input type="number" min="0" value={item.rejectedQuantity} onChange={e => updateItem(idx, 'rejectedQuantity', e.target.value)} className="h-9 rounded-lg text-sm border-rose-200 dark:border-rose-900/50" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Accepted Qty</Label>
                    <div className="h-9 px-3 rounded-lg border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50 dark:bg-emerald-950/20 flex items-center text-sm font-bold text-emerald-600 dark:text-emerald-400">
                      {item.acceptedQuantity}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Condition</Label>
                    <div className="relative">
                      <select value={item.condition} onChange={e => updateItem(idx, 'condition', e.target.value)} className="w-full h-9 px-2 pr-7 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-sm appearance-none focus:outline-none">
                        {['Good', 'Minor Damage', 'Major Damage', 'Not Received'].map(c => <option key={c}>{c}</option>)}
                      </select>
                      <ChevronDown className="w-3 h-3 text-slate-400 absolute right-2 top-3 pointer-events-none" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Serial No.</Label>
                    <Input value={item.serialNo} onChange={e => updateItem(idx, 'serialNo', e.target.value)} placeholder="SN-XXXXXXXX" className="h-9 rounded-lg text-sm font-mono" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Asset Tag No.</Label>
                    <Input value={item.assetTagNo} onChange={e => updateItem(idx, 'assetTagNo', e.target.value)} placeholder="AT-XXXXX" className="h-9 rounded-lg text-sm font-mono" />
                  </div>
                  <div className="md:col-span-2 space-y-1">
                    <Label className="text-xs">Inspection Remarks</Label>
                    <Input value={item.inspectionRemarks} onChange={e => updateItem(idx, 'inspectionRemarks', e.target.value)} placeholder="Notes from quality inspection..." className="h-9 rounded-lg text-sm" />
                  </div>
                </div>
                {!isPoLinked && !editGRPOId && form.items.length > 1 && (
                  <div className="flex justify-end mt-2">
                    <button type="button" onClick={() => removeItem(idx)} className="p-1.5 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors">
                      <AlertOctagon className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* QC Notes */}
        <div className="border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Camera className="w-4 h-4 text-indigo-500" /> Quality Check Notes
          </h3>
          <textarea value={form.qualityCheckNotes} onChange={e => update('qualityCheckNotes', e.target.value)} rows={3}
            placeholder="Overall quality inspection findings, unboxing condition, completeness checklist notes..."
            className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 resize-none" />
        </div>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={onBack} className="rounded-xl px-6 h-11">Cancel</Button>
          <Button type="submit" disabled={mutation.isPending || isReadOnly} className="rounded-xl px-6 h-11 bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-600/20 gap-2">
            {mutation.isPending ? <><Loader2 className="w-4 h-4 animate-spin" /> Processing...</> : <><ClipboardCheck className="w-4 h-4" /> {editGRPOId ? 'Save Changes' : 'Confirm Receipt'}</>}
          </Button>
        </div>
      </form>
    </div>
  );
}

export default function GRPOView() {
  const user = useAuthStore(s => s.user);
  const isReadOnly = user?.role === 'SUPERVISOR';
  const [view, setView] = useState('list');
  const [search, setSearch] = useState('');
  const [selectedGRPO, setSelectedGRPO] = useState(null);
  const [editGRPOId, setEditGRPOId] = useState(null);

  const { data: grpos = [], isLoading } = useQuery({
    queryKey: ['asset-grpos'],
    queryFn: () => api.get('/asset-management/grpo').then(r => r.data),
  });

  const { data: invoices = [] } = useQuery({
    queryKey: ['asset-ap-invoices'],
    queryFn: () => api.get('/asset-management/ap-invoices').then(r => r.data),
  });

  const qc = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: id => api.delete(`/asset-management/grpo/${id}`).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['asset-grpos'] });
      qc.invalidateQueries({ queryKey: ['asset-pos-open'] });
      qc.invalidateQueries({ queryKey: ['asset-pos'] });
      Swal.fire({
        icon: 'success',
        title: 'GRPO Deleted!',
        text: 'Goods Receipt PO deleted and PO quantities reverted.',
        confirmButtonColor: '#4f46e5'
      });
    },
    onError: err => Swal.fire({
      icon: 'error',
      title: 'Delete Failed',
      text: err.response?.data?.error || 'Failed to delete GRPO',
      confirmButtonColor: '#4f46e5'
    })
  });

  const handleDeleteGRPO = (grpo) => {
    Swal.fire({
      title: 'Are you sure?',
      text: `Do you want to delete GRPO ${grpo.grpoNo}? This will delete all generated assets and revert PO quantities!`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Yes, delete it!'
    }).then((result) => {
      if (result.isConfirmed) {
        deleteMutation.mutate(grpo.id);
      }
    });
  };

  const [sortBy, setSortBy] = useState('recent');

  const filtered = grpos.filter(g =>
    g.grpoNo?.toLowerCase().includes(search.toLowerCase()) ||
    g.vendorName?.toLowerCase().includes(search.toLowerCase()) ||
    g.receivedBy?.toLowerCase().includes(search.toLowerCase())
  );

  const sortedAndFiltered = [...filtered].sort((a, b) => {
    if (sortBy === 'recent') {
      return new Date(b.receivedDate || b.createdAt) - new Date(a.receivedDate || a.createdAt);
    }
    if (sortBy === 'oldest') {
      return new Date(a.receivedDate || a.createdAt) - new Date(b.receivedDate || b.createdAt);
    }
    if (sortBy === 'priceLowHigh') {
      const aVal = a.items?.reduce((s, i) => s + (Number(i.acceptedQuantity || 0) * Number(i.unitPrice || 0)), 0) || Number(a.po?.grandTotal || 0);
      const bVal = b.items?.reduce((s, i) => s + (Number(i.acceptedQuantity || 0) * Number(i.unitPrice || 0)), 0) || Number(b.po?.grandTotal || 0);
      return aVal - bVal;
    }
    if (sortBy === 'priceHighLow') {
      const aVal = a.items?.reduce((s, i) => s + (Number(i.acceptedQuantity || 0) * Number(i.unitPrice || 0)), 0) || Number(a.po?.grandTotal || 0);
      const bVal = b.items?.reduce((s, i) => s + (Number(i.acceptedQuantity || 0) * Number(i.unitPrice || 0)), 0) || Number(b.po?.grandTotal || 0);
      return bVal - aVal;
    }
    if (sortBy === 'alphabetical') {
      return (a.vendorName || '').localeCompare(b.vendorName || '');
    }
    return 0;
  });

  if (view === 'create') return <CreateGRPOForm onBack={() => { setView('list'); setEditGRPOId(null); }} isReadOnly={isReadOnly} editGRPOId={editGRPOId} />;

  const acceptedItems = grpos.reduce((s, g) => s + (g.items?.reduce((a, i) => a + Number(i.acceptedQuantity || 0), 0) || 0), 0);
  const rejectedItems = grpos.reduce((s, g) => s + (g.items?.reduce((a, i) => a + Number(i.rejectedQuantity || 0), 0) || 0), 0);

  return (
    <div className="space-y-6">
      {selectedGRPO && <GRPODetailModal grpo={selectedGRPO} onClose={() => setSelectedGRPO(null)} />}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Goods Receipt (GRPO)</h2>
          <p className="text-sm text-slate-500 mt-0.5">Record asset delivery with quality inspection (Step 4/8)</p>
        </div>
        {!isReadOnly && (
          <Button onClick={() => { setEditGRPOId(null); setView('create'); }} className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-md shadow-indigo-600/10 h-10 px-5">
            <Plus className="w-4 h-4" /> Record Receipt
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total GRPOs', value: grpos.length, icon: Truck, bg: 'bg-indigo-50 dark:bg-indigo-950/30', clr: 'text-indigo-600' },
          { label: 'Accepted', value: acceptedItems, icon: CheckCircle2, bg: 'bg-emerald-50 dark:bg-emerald-950/30', clr: 'text-emerald-600' },
          { label: 'Rejected', value: rejectedItems, icon: AlertOctagon, bg: 'bg-rose-50 dark:bg-rose-950/30', clr: 'text-rose-600' },
          { label: 'Under QC', value: grpos.filter(g => g.status === 'Quality Check').length, icon: Camera, bg: 'bg-amber-50 dark:bg-amber-950/30', clr: 'text-amber-600' },
        ].map(({ label, value, icon: Icon, bg, clr }) => (
          <div key={label} className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/60 rounded-2xl p-4 flex items-center gap-3 shadow-sm">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${bg} ${clr}`}><Icon className="w-5 h-5" /></div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</p>
              <p className="text-xl font-bold text-slate-900 dark:text-white">{value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-slate-50/60 dark:bg-slate-800/20 border border-slate-200/60 dark:border-slate-800/60 rounded-2xl p-3 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by GRPO number, vendor or receiver..." className="pl-9 h-9 rounded-xl bg-white dark:bg-slate-900" />
        </div>
        <div className="relative w-full sm:w-64">
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value)}
            className="w-full h-9 pl-3 pr-8 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-700 dark:text-slate-350"
          >
            <option value="recent">Recent first</option>
            <option value="oldest">Oldest first</option>
            <option value="priceLowHigh">Price/Quantity: Low to High</option>
            <option value="priceHighLow">Price/Quantity: High to Low</option>
            <option value="alphabetical">Alphabetical</option>
          </select>
          <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-2.5 pointer-events-none" />
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200/60 dark:border-slate-800/60">
        <table className="w-full text-sm">
          <thead className="bg-slate-50/80 dark:bg-slate-800/50">
            <tr>
              {['GRPO No.', 'Vendor', 'Received Date', 'Received By', 'Location', 'Items', 'Accepted', 'Rejected', 'Status', 'Actions'].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
            {isLoading ? Array.from({ length: 3 }).map((_, i) => (
              <tr key={i}>{Array.from({ length: 10 }).map((_, j) => <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-full rounded" /></td>)}</tr>
            )) : sortedAndFiltered.length === 0 ? (
              <tr><td colSpan={10} className="px-4 py-16 text-center">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-14 h-14 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center">
                    <Truck className="w-7 h-7 text-slate-400" />
                  </div>
                  <div>
                    <p className="font-medium text-slate-700 dark:text-slate-300">No receipts recorded</p>
                    <p className="text-xs text-slate-400 mt-1">Record goods receipt when assets are delivered</p>
                  </div>
                </div>
              </td></tr>
            ) : sortedAndFiltered.map(grpo => {
              const accepted = grpo.items?.reduce((s, i) => s + Number(i.acceptedQuantity || 0), 0) || 0;
              const rejected = grpo.items?.reduce((s, i) => s + Number(i.rejectedQuantity || 0), 0) || 0;
              const hasInvoice = invoices.some(inv => inv.grpoNo === grpo.grpoNo);
              return (
                <tr key={grpo.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors">
                  <td className="px-4 py-3">
                    <button onClick={() => setSelectedGRPO(grpo)} className="font-mono font-bold text-indigo-600 dark:text-indigo-400 text-xs hover:underline">{grpo.grpoNo}</button>
                  </td>
                  <td className="px-4 py-3 font-semibold text-slate-800 dark:text-slate-200">{grpo.vendorName}</td>
                  <td className="px-4 py-3 text-xs text-slate-500">{format(new Date(grpo.receivedDate), 'dd MMM yyyy')}</td>
                  <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-400">{grpo.receivedBy}</td>
                  <td className="px-4 py-3 text-xs text-slate-500">{grpo.receivingLocation || '—'}</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{grpo.items?.length || 0}</td>
                  <td className="px-4 py-3 font-bold text-emerald-600">{accepted}</td>
                  <td className="px-4 py-3 font-bold text-rose-500">{rejected}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${STATUS_STYLES[grpo.status] || STATUS_STYLES.Draft}`}>{grpo.status}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" onClick={() => setSelectedGRPO(grpo)} className="h-8 w-8 rounded-lg text-slate-400 hover:text-indigo-650" title="View GRPO">
                        <Eye className="w-4 h-4" />
                      </Button>
                      {!isReadOnly && (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            disabled={hasInvoice}
                            onClick={() => { setEditGRPOId(grpo.id); setView('create'); }}
                            className="h-8 w-8 rounded-lg text-slate-400 hover:text-indigo-650 disabled:opacity-40 disabled:cursor-not-allowed"
                            title={hasInvoice ? "Cannot edit - AP Invoice exists" : "Edit GRPO"}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            disabled={hasInvoice}
                            onClick={() => handleDeleteGRPO(grpo)}
                            className="h-8 w-8 rounded-lg text-slate-400 hover:text-rose-600 disabled:opacity-40 disabled:cursor-not-allowed"
                            title={hasInvoice ? "Cannot delete - AP Invoice exists" : "Delete GRPO"}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
