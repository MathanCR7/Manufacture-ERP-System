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
  Package,
  Tag,
  Calculator,
  Info,
} from 'lucide-react';
import { twMerge } from 'tailwind-merge';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import DatePicker from '@/components/ui/DatePicker';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';

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

// Searchable Raw Material Dropdown Component
function RawMaterialSelect({ rawMaterials, value, onChange, error, lowStockIds = new Set() }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef(null);
  const searchRef = useRef(null);

  const filtered = rawMaterials.filter(rm =>
    rm.name.toLowerCase().includes(search.toLowerCase()) || 
    (rm.code && rm.code.toLowerCase().includes(search.toLowerCase()))
  );

  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (open && searchRef.current) {
      searchRef.current.focus();
    }
  }, [open]);

  const handleSelect = (rm) => {
    onChange(rm);
    setOpen(false);
    setSearch('');
  };

  const handleClear = (e) => {
    e.stopPropagation();
    onChange(null);
    setSearch('');
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <button
        type="button"
        onClick={() => setOpen(prev => !prev)}
        className={`w-full px-4 h-[46px] border rounded-xl text-left flex items-center justify-between transition-all duration-200 shadow-sm ${
          open ? 'bg-indigo-50/50 border-indigo-400 ring-4 ring-indigo-500/10 dark:bg-indigo-900/10 dark:border-indigo-500' : 'bg-slate-50/50 dark:bg-slate-900/50 border-slate-300 dark:border-slate-700 hover:border-indigo-400 hover:bg-white dark:hover:bg-slate-800'
        } ${error ? 'border-rose-400 ring-4 ring-rose-500/10 bg-rose-50/50 dark:bg-rose-900/10' : ''}`}
      >
        <div className="flex items-center gap-3 truncate">
          <div className="p-1.5 bg-slate-200/50 dark:bg-slate-800 rounded-md text-slate-500 dark:text-slate-400 shrink-0">
            <Package className="w-4 h-4" />
          </div>
          <span className={value ? 'text-slate-900 dark:text-white font-medium text-sm truncate' : 'text-slate-500 dark:text-slate-400 text-sm'}>
            {value ? `${value.code} - ${value.name}` : 'Search & Select Raw Material...'}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {value && (
            <span
              onMouseDown={handleClear}
              className="text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/20 cursor-pointer p-1 rounded-md transition-colors"
            >
              <X className="w-4 h-4" />
            </span>
          )}
          <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${open ? 'rotate-180 text-indigo-500' : ''}`} />
        </div>
      </button>

      {open && (
        <div className="absolute z-50 mt-2 w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="p-2 border-b border-slate-100 dark:border-slate-700 relative bg-slate-50/50 dark:bg-slate-900/50">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              ref={searchRef}
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by RM Name or Code..."
              className="w-full pl-9 pr-8 py-2.5 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all dark:text-white"
            />
            {search && (
              <button
                type="button"
                onMouseDown={() => setSearch('')}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <ul className="max-h-64 overflow-y-auto p-1.5 space-y-0.5">
            {filtered.length === 0 ? (
              <li className="px-4 py-10 text-sm text-slate-500 flex flex-col items-center justify-center">
                <Search className="w-8 h-8 text-slate-300 dark:text-slate-600 mb-3" />
                <p className="font-medium">No materials found</p>
                <p className="text-xs mt-1 text-slate-400">Try adjusting your search</p>
              </li>
            ) : (
              filtered.map(rm => {
                const isLow = lowStockIds.has(rm.id);
                return (
                  <li
                    key={rm.id}
                    onMouseDown={() => handleSelect(rm)}
                    className={`px-4 py-3 text-sm cursor-pointer select-none rounded-lg flex justify-between items-center transition-all ${
                      value?.id === rm.id
                        ? 'bg-indigo-50 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 ring-1 ring-indigo-200 dark:ring-indigo-500/30'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {isLow ? (
                        <div className="relative flex h-3 w-3 shrink-0">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500"></span>
                        </div>
                      ) : (
                        <div className="h-2 w-2 rounded-full bg-slate-300 dark:bg-slate-600"></div>
                      )}
                      <span className={`font-medium ${isLow ? 'text-rose-700 dark:text-rose-400' : ''}`}>{rm.name}</span>
                      {isLow && <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400 font-bold border border-rose-200 dark:border-rose-800 font-sans">Low Stock</span>}
                    </div>
                    <span className="text-xs font-mono text-slate-505 bg-slate-105 dark:bg-slate-800 px-2 py-1 rounded-md">{rm.code}</span>
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

  /* ── Raw materials & stocks list ── */
  const { data: rawMaterials = [], isLoading: isLoadingRMs } = useQuery({
    queryKey: ['raw-materials-setup'],
    queryFn: async () => (await api.get('/item-setup/raw-material')).data,
  });

  const { data: rmStock = [] } = useQuery({
    queryKey: ['rm-stock'],
    queryFn: async () => (await api.get('/rm-stock')).data,
  });

  const lowStockIds = new Set(
    rmStock.filter(s => s.alertLevel != null && Number(s.availableQuantity) <= Number(s.alertLevel)).map(s => s.id)
  );

  /* ── Initialise form once PO is loaded ── */
  useEffect(() => {
    if (!po) return;
    let initialItems = po.items;
    if (!initialItems || !Array.isArray(initialItems) || initialItems.length === 0) {
      initialItems = [{
        id: po.rmId,
        rmId: po.rmId || '',
        name: po.name || '',
        quantity: Number(po.quantity || 0),
        unitPrice: Number(po.quantity) > 0 ? Number(po.subtotal && Number(po.subtotal) > 0 ? po.subtotal : (po.amount || 0)) / Number(po.quantity) : Number(po.subtotal && Number(po.subtotal) > 0 ? po.subtotal : (po.amount || 0)),
        uomLabel: po.uom ? po.uom.abbreviation : 'units',
        uomId: po.uomId || '',
        gstApplicable: false,
        gstPercentage: 0,
      }];
    }
    setForm({
      name: po.name || '',
      quantity: String(po.quantity ?? ''),
      amount: po.subtotal && Number(po.subtotal) > 0 ? String(po.subtotal) : String(po.amount ?? ''),
      uomId: po.uomId || '',
      expectedDelivery: po.expectedDelivery ? new Date(po.expectedDelivery) : null,
      selectedSupplier: po.supplier || null,
      // read-only display
      referenceNo: po.referenceNo || '',
      rmId: po.rmId || '',
      status: po.status || '',
      createdBy: po.user?.name || '',
      createdAt: po.createdAt || '',
      orderTax: String(po.orderTax ?? '0'),
      discount: String(po.discount ?? '0'),
      shipping: String(po.shipping ?? '0'),
      otherCharges: String(po.otherCharges ?? '0'),
      items: initialItems,
    });
  }, [po]);

  /* ── Suppliers list ── */
  const { data: suppliers = [], refetch: refetchSuppliers } = useQuery({
    queryKey: ['suppliers'],
    queryFn: async () => (await api.get('/parties/suppliers')).data,
  });

  /* ── UOM list ── */
  const { data: allUoms = [] } = useQuery({
    queryKey: ['uoms'],
    queryFn: async () => (await api.get('/uom')).data,
  });

  const handleAddRmItem = (rm) => {
    if (!rm) return;
    const exists = form.items.some(item => item.id === rm.id);
    if (exists) {
      Swal.fire({
        icon: 'info',
        title: 'Item already added',
        text: `${rm.name} is already in the items list. You can update its quantity directly.`,
        confirmButtonColor: '#4f46e5',
      });
      return;
    }
    
    const defaultUom = allUoms.find(u => 
      u.abbreviation.toLowerCase() === (rm.unitId || rm.consumptionUnit || '').trim().toLowerCase() ||
      u.name.toLowerCase() === (rm.unitId || rm.consumptionUnit || '').trim().toLowerCase()
    );
    const uomLabel = defaultUom ? defaultUom.abbreviation : (rm.unitId || rm.consumptionUnit || 'units');
    const uomId = defaultUom ? defaultUom.id : '';

    const newItem = {
      id: rm.id,
      rmId: rm.code,
      name: rm.name,
      quantity: 1,
      unitPrice: Number(rm.ratePerUnit || 0),
      uomLabel: uomLabel,
      uomId: uomId,
      gstApplicable: true,
      gstPercentage: 18,
    };
    setForm(prev => ({
      ...prev,
      items: [...prev.items, newItem]
    }));
  };

  // Dynamic calculations
  const subtotal = form?.items?.reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.unitPrice || 0), 0) || 0;
  const shipping = Number(form?.shipping || 0);
  const discount = Number(form?.discount || 0);
  const otherCharges = Number(form?.otherCharges || 0);

  // Check supplier state code (prefix 33)
  const isInterState = form?.selectedSupplier?.gstin
    ? !form.selectedSupplier.gstin.trim().startsWith('33')
    : false;

  const totalItemTax = form?.items?.reduce((sum, item) => {
    if (!item.gstApplicable) return sum;
    const itemSubtotal = Number(item.quantity || 0) * Number(item.unitPrice || 0);
    return sum + (itemSubtotal * (Number(item.gstPercentage || 0) / 100));
  }, 0) || 0;

  const cgstAmount = isInterState ? 0 : totalItemTax / 2;
  const sgstAmount = isInterState ? 0 : totalItemTax / 2;
  const igstAmount = isInterState ? totalItemTax : 0;

  const grandTotal = subtotal + totalItemTax + shipping + otherCharges - discount;

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
    if (!form.items || form.items.length === 0) {
      setErrorMsg('Please add at least one item.');
      return;
    }

    const firstItem = form.items[0];
    const totalQuantity = form.items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);

    updateMutation.mutate({
      name: firstItem.name,
      quantity: totalQuantity,
      amount: Number(grandTotal),
      uomId: firstItem.uomId || undefined,
      expectedDelivery: form.expectedDelivery.toISOString(),
      supplierId: form.selectedSupplier?.id || null,
      
      subtotal: subtotal,
      orderTax: 0,
      discount: discount,
      shipping: shipping,
      otherCharges: otherCharges,
      cgst: cgstAmount,
      sgst: sgstAmount,
      igst: igstAmount,
      grandTotal: grandTotal,
      items: form.items,
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
            <h3 className="text-sm font-semibold text-slate-505 dark:text-slate-400 uppercase tracking-wider mb-4">Editable Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">

              <DatePicker
                label="Expected Delivery Date"
                required
                value={form.expectedDelivery}
                onChange={date => setForm(prev => ({ ...prev, expectedDelivery: date }))}
                modalTitle="Expected Delivery"
                placeholder="Select Date"
              />

              {/* Supplier */}
              <div className="space-y-2">
                <Label className="text-slate-700 dark:text-slate-300">Supplier</Label>
                <SupplierSelect
                  suppliers={suppliers}
                  value={form.selectedSupplier}
                  onChange={s => setForm(prev => ({ ...prev, selectedSupplier: s }))}
                  onAddNew={() => setShowAddSupplier(true)}
                />
              </div>

            </div>

            {/* Supplier Details Horizontal Banner */}
            {form.selectedSupplier && (
              <div className="mt-4 mb-6 p-4 bg-gradient-to-r from-indigo-50/40 to-slate-50/40 dark:from-indigo-950/10 dark:to-slate-800/10 border border-indigo-100/80 dark:border-indigo-900/30 rounded-2xl flex flex-wrap gap-x-8 gap-y-3 text-xs text-slate-600 dark:text-slate-400 shadow-sm animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-slate-700 dark:text-slate-300">Phone:</span>
                  <span>{form.selectedSupplier.phone || 'N/A'}</span>
                </div>
                <div className="w-px h-4 bg-slate-200 dark:bg-slate-700 hidden sm:block"></div>
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-slate-700 dark:text-slate-300">GSTIN:</span>
                  <span className="font-mono font-medium text-indigo-600 dark:text-indigo-400">{form.selectedSupplier.gstin || 'N/A'}</span>
                </div>
                <div className="w-px h-4 bg-slate-200 dark:bg-slate-700 hidden sm:block"></div>
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-slate-700 dark:text-slate-300">PAN:</span>
                  <span className="font-mono">{form.selectedSupplier.pan || 'N/A'}</span>
                </div>
                <div className="w-px h-4 bg-slate-200 dark:bg-slate-700 hidden sm:block"></div>
                <div className="flex items-center gap-1.5 flex-1 min-w-[200px]">
                  <span className="font-semibold text-slate-700 dark:text-slate-300">Address:</span>
                  <span className="truncate" title={form.selectedSupplier.address}>{form.selectedSupplier.address || 'N/A'}</span>
                </div>
              </div>
            )}
          </div>

          {/* Items Section */}
          <div className="p-6 md:p-8 bg-slate-50/50 dark:bg-slate-800/10 border-b border-slate-100 dark:border-slate-800/80">
            
            <div className="mb-6 max-w-3xl">
              <Label className="text-slate-800 dark:text-slate-200 mb-3 flex items-center gap-2 font-bold text-sm uppercase tracking-wider">
                <Package className="w-4 h-4 text-indigo-500" />
                Select Raw Material to Add <span className="text-rose-500">*</span>
              </Label>
              <div className="relative">
                {isLoadingRMs ? (
                  <div className="w-full px-4 py-3 border rounded-xl text-slate-400 border-slate-300 dark:border-slate-700 flex items-center bg-white dark:bg-slate-900 shadow-sm h-[46px]">
                    <Loader2 className="w-4 h-4 mr-3 animate-spin text-indigo-500" /> Loading raw materials...
                  </div>
                ) : (
                  <RawMaterialSelect 
                    rawMaterials={rawMaterials}
                    value={null}
                    onChange={handleAddRmItem} 
                    lowStockIds={lowStockIds}
                  />
                )}
              </div>
            </div>

            {/* Order Items Table */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-700/80 rounded-2xl shadow-sm overflow-hidden ring-1 ring-slate-100 dark:ring-slate-800/50">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 border-b border-slate-200/80 dark:border-slate-700/80">
                    <tr>
                      <th className="px-5 py-4 font-bold tracking-wide uppercase text-xs">#</th>
                      <th className="px-5 py-4 font-bold tracking-wide uppercase text-xs">Material Details</th>
                      <th className="px-5 py-4 font-bold tracking-wide uppercase text-xs text-right w-36">Quantity</th>
                      <th className="px-5 py-4 font-bold tracking-wide uppercase text-xs text-right w-36">Unit Price (₹)</th>
                      <th className="px-5 py-4 font-bold tracking-wide uppercase text-xs text-center w-36">GST Status</th>
                      <th className="px-5 py-4 font-bold tracking-wide uppercase text-xs text-center w-28">GST Rate</th>
                      <th className="px-5 py-4 font-bold tracking-wide uppercase text-xs text-right w-40">Subtotal (₹)</th>
                      <th className="px-5 py-4 font-bold tracking-wide uppercase text-xs text-center w-20">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {form.items && form.items.length > 0 ? (
                      form.items.map((item, index) => {
                        const itemSubtotal = Number(item.quantity || 0) * Number(item.unitPrice || 0);
                        return (
                          <tr key={item.id || index} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors group">
                            <td className="px-5 py-4 text-slate-400 font-medium">{index + 1}</td>
                            <td className="px-5 py-4">
                              <div className="font-semibold text-slate-900 dark:text-slate-100 text-sm">{item.name}</div>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-xs font-mono text-slate-500 bg-slate-105 dark:bg-slate-800 px-2 py-0.5 rounded">{item.rmId}</span>
                                {lowStockIds.has(item.id) && (
                                  <Badge variant="outline" className="text-[10px] bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-900/20 dark:text-rose-400 dark:border-rose-800/50 px-1.5 py-0">Low Stock</Badge>
                                )}
                              </div>
                            </td>
                            <td className="px-5 py-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <Input 
                                  type="number" 
                                  step="0.001" 
                                  min="0.001"
                                  value={item.quantity} 
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setForm(prev => ({
                                      ...prev,
                                      items: prev.items.map(it => it.id === item.id ? { ...it, quantity: val } : it)
                                    }));
                                  }} 
                                  className="w-24 text-right h-9 rounded-lg border-slate-300 focus:border-indigo-500 focus:ring-indigo-500/20 bg-slate-50/50 dark:bg-slate-900/50 font-medium text-xs" 
                                  required
                                />
                                <span className="text-slate-500 font-medium text-xs font-mono shrink-0 w-8 text-left">{item.uomLabel}</span>
                              </div>
                            </td>
                            <td className="px-5 py-4 text-right">
                              <Input 
                                type="number" 
                                step="0.01" 
                                min="0"
                                value={item.unitPrice} 
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setForm(prev => ({
                                    ...prev,
                                    items: prev.items.map(it => it.id === item.id ? { ...it, unitPrice: val } : it)
                                  }));
                                }} 
                                className="w-24 text-right h-9 rounded-lg border-slate-300 focus:border-indigo-500 focus:ring-indigo-500/20 bg-slate-50/50 dark:bg-slate-900/50 font-medium text-xs ml-auto" 
                                required
                              />
                            </td>
                            <td className="px-5 py-4 text-center">
                              <Button
                                type="button"
                                variant={item.gstApplicable ? "default" : "outline"}
                                onClick={() => {
                                  setForm(prev => ({
                                    ...prev,
                                    items: prev.items.map(it => it.id === item.id ? { ...it, gstApplicable: !it.gstApplicable } : it)
                                  }));
                                }}
                                className={twMerge(
                                  "h-8 px-2.5 text-[11px] font-bold rounded-lg shadow-sm transition-all",
                                  item.gstApplicable 
                                    ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/10 border-transparent" 
                                    : "bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700"
                                )}
                              >
                                {item.gstApplicable ? 'GST Applicable' : 'Non-GST'}
                              </Button>
                            </td>
                            <td className="px-5 py-4 text-center">
                              <select
                                disabled={!item.gstApplicable}
                                value={item.gstPercentage}
                                onChange={(e) => {
                                  const val = Number(e.target.value);
                                  setForm(prev => ({
                                    ...prev,
                                    items: prev.items.map(it => it.id === item.id ? { ...it, gstPercentage: val } : it)
                                  }));
                                }}
                                className="h-9 px-2 py-1 text-xs border rounded-lg bg-slate-50/50 dark:bg-slate-900/50 border-slate-300 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-700 dark:text-slate-200 font-bold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed w-20 mx-auto block"
                              >
                                <option value={0}>0%</option>
                                <option value={5}>5%</option>
                                <option value={12}>12%</option>
                                <option value={18}>18%</option>
                                <option value={28}>28%</option>
                              </select>
                            </td>
                            <td className="px-5 py-4 text-right font-bold text-slate-900 dark:text-white">
                              ₹{itemSubtotal.toLocaleString('en-IN', {minimumFractionDigits: 2})}
                            </td>
                            <td className="px-5 py-4 text-center">
                              <button 
                                type="button" 
                                onClick={() => setForm(prev => ({
                                  ...prev,
                                  items: prev.items.filter(it => it.id !== item.id)
                                }))} 
                                className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-lg transition-all mx-auto block"
                                title="Remove item"
                              >
                                <X className="w-5 h-5 mx-auto" />
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={8} className="px-5 py-12 text-center">
                          <div className="flex flex-col items-center justify-center max-w-sm mx-auto text-slate-400 dark:text-slate-500">
                            <div className="w-16 h-16 rounded-full bg-slate-50 dark:bg-slate-800/50 flex items-center justify-center mb-4">
                              <Search className="w-8 h-8 text-slate-300 dark:text-slate-600" />
                            </div>
                            <p className="text-base font-medium text-slate-600 dark:text-slate-400 mb-1">No products selected</p>
                            <p className="text-sm">Please search and select a raw material above to add it to your order.</p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Pricing & Summary Section */}
          <div className="p-6 md:p-8">
            <h3 className="text-sm font-bold text-slate-805 dark:text-slate-200 uppercase tracking-wider mb-6 flex items-center gap-2">
              <Calculator className="w-4 h-4 text-indigo-500" />
              Additional Charges
            </h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-5 mb-8">
              <div className="space-y-1.5">
                <Label className="text-slate-600 dark:text-slate-300 font-semibold text-xs tracking-wide">Discount (₹)</Label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-medium">₹</span>
                  <Input 
                    type="number" 
                    min="0"
                    value={form.discount} 
                    onChange={(e) => setForm({ ...form, discount: e.target.value })}
                    className="h-10 text-sm pl-8 rounded-xl focus:ring-indigo-500/20 focus:border-indigo-500 bg-white dark:bg-slate-900 border-slate-205 dark:border-slate-800 transition-all" 
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-slate-600 dark:text-slate-300 font-semibold text-xs tracking-wide">Shipping (₹)</Label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-medium">₹</span>
                  <Input 
                    type="number" 
                    min="0"
                    value={form.shipping} 
                    onChange={(e) => setForm({ ...form, shipping: e.target.value })}
                    className="h-10 text-sm pl-8 rounded-xl focus:ring-indigo-500/20 focus:border-indigo-500 bg-white dark:bg-slate-900 border-slate-205 dark:border-slate-800 transition-all" 
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-slate-600 dark:text-slate-300 font-semibold text-xs tracking-wide">Other Charges (₹)</Label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-medium">₹</span>
                  <Input 
                    type="number" 
                    min="0"
                    value={form.otherCharges} 
                    onChange={(e) => setForm({ ...form, otherCharges: e.target.value })}
                    className="h-10 text-sm pl-8 rounded-xl focus:ring-indigo-500/20 focus:border-indigo-500 bg-white dark:bg-slate-900 border-slate-205 dark:border-slate-800 transition-all" 
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-slate-600 dark:text-slate-300 font-semibold text-xs tracking-wide">Payment Status</Label>
                <div className="relative">
                  <select 
                    value={form.status} 
                    disabled 
                    className="w-full h-10 px-3.5 py-2 text-sm border rounded-xl bg-slate-100 dark:bg-slate-800 border-slate-205 dark:border-slate-800 text-slate-500 dark:text-slate-400 shadow-sm appearance-none font-medium cursor-not-allowed"
                  >
                    <option value="PENDING">Pending</option>
                    <option value="ORDERED">Ordered</option>
                    <option value="RECEIVED">Received</option>
                    <option value="APPROVED">Approved</option>
                  </select>
                  <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>
              </div>
            </div>

            {errorMsg && (
              <div className="mb-6 p-4 bg-rose-50 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400 rounded-xl text-sm font-medium border border-rose-200 dark:border-rose-800 flex items-center gap-3 shadow-sm">
                <AlertTriangle className="w-5 h-5 shrink-0" />
                {errorMsg}
              </div>
            )}
            {successMsg && (
              <div className="mb-6 p-4 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 rounded-xl text-sm font-medium border border-emerald-200 dark:border-emerald-800 flex items-center gap-3 shadow-sm">
                <CheckCircle2 className="w-5 h-5 shrink-0" />
                {successMsg}
              </div>
            )}

            {/* Grand Total Summary Box */}
            <div className="bg-gradient-to-r from-slate-50 via-indigo-50/20 to-slate-50 dark:from-slate-900 dark:via-indigo-950/20 dark:to-slate-900 p-5 md:p-6 rounded-2xl flex flex-col lg:flex-row justify-between items-center border border-slate-200 dark:border-slate-800 gap-6 shadow-md relative overflow-hidden transition-all duration-300 hover:border-indigo-500/40 mb-6">
              <div className="absolute top-0 right-0 p-16 bg-indigo-500/5 dark:bg-indigo-500/10 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>
              
              {/* Financial Metrics Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-y-4 gap-x-6 text-sm w-full lg:w-auto relative z-10 select-none">
                <div className="flex flex-col gap-0.5 group/metric transition-transform duration-200 hover:translate-y-[-2px]">
                  <span className="text-slate-400 dark:text-slate-500 font-semibold text-[10px] uppercase tracking-wider">Total Items</span>
                  <span className="font-extrabold text-slate-800 dark:text-slate-200 text-base">{form.items?.length || 0}</span>
                </div>
                
                <div className="flex flex-col gap-0.5 group/metric transition-transform duration-200 hover:translate-y-[-2px]">
                  <span className="text-slate-400 dark:text-slate-500 font-semibold text-[10px] uppercase tracking-wider">Subtotal</span>
                  <span className="font-extrabold text-slate-800 dark:text-slate-200 text-base">₹{subtotal.toLocaleString('en-IN', {minimumFractionDigits: 2})}</span>
                </div>

                <div className="flex flex-col gap-0.5 group/metric transition-transform duration-200 hover:translate-y-[-2px]">
                  <span className="text-slate-400 dark:text-slate-500 font-semibold text-[10px] uppercase tracking-wider">Taxes</span>
                  <span className="font-extrabold text-slate-800 dark:text-slate-200 text-base">
                    ₹{totalItemTax.toLocaleString('en-IN', {minimumFractionDigits: 2})}
                  </span>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">
                    {isInterState ? 'IGST' : 'CGST+SGST'}
                  </span>
                </div>

                <div className="flex flex-col gap-0.5 group/metric transition-transform duration-200 hover:translate-y-[-2px]">
                  <span className="text-slate-400 dark:text-slate-500 font-semibold text-[10px] uppercase tracking-wider">Discount</span>
                  <span className="font-extrabold text-emerald-600 dark:text-emerald-400 text-base">
                    -₹{discount.toLocaleString('en-IN', {minimumFractionDigits: 2})}
                  </span>
                </div>

                <div className="flex flex-col gap-0.5 group/metric transition-transform duration-200 hover:translate-y-[-2px]">
                  <span className="text-slate-400 dark:text-slate-500 font-semibold text-[10px] uppercase tracking-wider">Shipping</span>
                  <span className="font-extrabold text-slate-800 dark:text-slate-200 text-base">
                    +₹{shipping.toLocaleString('en-IN', {minimumFractionDigits: 2})}
                  </span>
                </div>

                <div className="flex flex-col gap-0.5 group/metric transition-transform duration-200 hover:translate-y-[-2px]">
                  <span className="text-slate-400 dark:text-slate-500 font-semibold text-[10px] uppercase tracking-wider">Other Charges</span>
                  <span className="font-extrabold text-slate-800 dark:text-slate-200 text-base">
                    +₹{otherCharges.toLocaleString('en-IN', {minimumFractionDigits: 2})}
                  </span>
                </div>
              </div>
              
              {/* Grand Total & CTA */}
              <div className="flex flex-col sm:flex-row items-center gap-5 w-full lg:w-auto relative z-10 border-t sm:border-t-0 border-slate-200 dark:border-slate-800 pt-5 sm:pt-0 mt-1 sm:mt-0">
                <div className="text-center sm:text-right shrink-0">
                  <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-0.5">
                    Grand Total
                  </div>
                  <div className="text-2xl md:text-3xl font-black text-indigo-600 dark:text-indigo-400 tracking-tight transition-all duration-300 hover:scale-105">
                    ₹{grandTotal.toLocaleString('en-IN', {minimumFractionDigits: 2})}
                  </div>
                </div>
                <div className="flex gap-3 w-full sm:w-auto">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleBack}
                    className="border-slate-300 dark:border-slate-700 h-12 rounded-xl text-xs font-bold w-full sm:w-auto px-4"
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={updateMutation.isPending} className="bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white min-w-36 h-12 rounded-xl text-xs font-extrabold shadow-md shadow-indigo-600/20 hover:shadow-lg hover:shadow-indigo-600/30 transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 w-full sm:w-auto">
                    {updateMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <SaveIcon className="w-4 h-4 mr-2" />}
                    {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
