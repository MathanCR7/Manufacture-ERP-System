import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { api } from '@/lib/axios';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { CalendarIcon, RefreshCw, ArrowLeft, Loader2, Search, X, ChevronDown, Plus, AlertTriangle, FileText, CheckCircle2, Package, Tag, Calculator, Info } from 'lucide-react';
import { twMerge } from 'tailwind-merge';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';

// Add Supplier Inline Dialog Component
function AddSupplierInline({ onAdded, onClose }) {
  const [name, setName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [openingBalance, setOpeningBalance] = useState('0.00');
  const [creditLimit, setCreditLimit] = useState('0.00');
  const [address, setAddress] = useState('');
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name || !phone) return;
    setIsSubmitting(true);
    try {
      const res = await api.post('/parties/suppliers', {
        name, contactPerson, phone, email, openingBalance, creditLimit, address, note
      });
      onAdded(res.data);
    } catch (err) {
      console.error('Failed to add supplier', err);
      alert('Failed to add supplier');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 transition-all duration-300">
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 md:p-8 w-full max-w-2xl shadow-2xl border border-slate-200/60 dark:border-slate-800 max-h-[90vh] overflow-y-auto transform animate-in zoom-in-95 duration-200">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Quick Add Supplier</h2>
          <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500">
            <X className="w-5 h-5" />
          </Button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-1.5">
              <Label className="text-slate-700 dark:text-slate-300 font-medium">Name <span className="text-rose-500">*</span></Label>
              <Input required value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Acme Corp" className="h-[42px] rounded-xl border-slate-300 dark:border-slate-700 focus:ring-indigo-500/20 hover:border-indigo-400 transition-colors bg-slate-50/50 dark:bg-slate-900/50" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-700 dark:text-slate-300 font-medium">Contact Person</Label>
              <Input value={contactPerson} onChange={e => setContactPerson(e.target.value)} placeholder="John Doe" className="h-[42px] rounded-xl border-slate-300 dark:border-slate-700 focus:ring-indigo-500/20 hover:border-indigo-400 transition-colors bg-slate-50/50 dark:bg-slate-900/50" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-700 dark:text-slate-300 font-medium">Phone <span className="text-rose-500">*</span></Label>
              <Input required value={phone} onChange={e => setPhone(e.target.value)} placeholder="Phone number" className="h-[42px] rounded-xl border-slate-300 dark:border-slate-700 focus:ring-indigo-500/20 hover:border-indigo-400 transition-colors bg-slate-50/50 dark:bg-slate-900/50" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-700 dark:text-slate-300 font-medium">Email</Label>
              <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="email@example.com" className="h-[42px] rounded-xl border-slate-300 dark:border-slate-700 focus:ring-indigo-500/20 hover:border-indigo-400 transition-colors bg-slate-50/50 dark:bg-slate-900/50" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-700 dark:text-slate-300 font-medium">Opening Balance</Label>
              <Input type="number" step="0.01" value={openingBalance} onChange={e => setOpeningBalance(e.target.value)} className="h-[42px] rounded-xl border-slate-300 dark:border-slate-700 focus:ring-indigo-500/20 hover:border-indigo-400 transition-colors bg-slate-50/50 dark:bg-slate-900/50" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-700 dark:text-slate-300 font-medium">Credit Limit</Label>
              <Input type="number" step="0.01" value={creditLimit} onChange={e => setCreditLimit(e.target.value)} className="h-[42px] rounded-xl border-slate-300 dark:border-slate-700 focus:ring-indigo-500/20 hover:border-indigo-400 transition-colors bg-slate-50/50 dark:bg-slate-900/50" />
            </div>
            <div className="md:col-span-2 space-y-1.5">
              <Label className="text-slate-700 dark:text-slate-300 font-medium">Address</Label>
              <Input value={address} onChange={e => setAddress(e.target.value)} placeholder="123 Main St..." className="h-[42px] rounded-xl border-slate-300 dark:border-slate-700 focus:ring-indigo-500/20 hover:border-indigo-400 transition-colors bg-slate-50/50 dark:bg-slate-900/50" />
            </div>
            <div className="md:col-span-2 space-y-1.5">
              <Label className="text-slate-700 dark:text-slate-300 font-medium">Note</Label>
              <textarea 
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 p-3 bg-slate-50/50 dark:bg-slate-900/50 focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 hover:border-indigo-400 transition-all text-sm resize-none" 
                rows={3} 
                value={note} 
                onChange={e => setNote(e.target.value)} 
                placeholder="Additional notes..." 
              />
            </div>
          </div>
          <div className="flex justify-end space-x-3 pt-6 border-t border-slate-100 dark:border-slate-800">
            <Button type="button" variant="outline" onClick={onClose} className="rounded-xl px-6 h-11 text-slate-600 hover:text-slate-900 hover:bg-slate-100 border-slate-200 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white transition-colors">Cancel</Button>
            <Button type="submit" disabled={isSubmitting} className="rounded-xl px-6 h-11 bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-600/20 hover:shadow-indigo-600/30 transition-all font-medium">
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Adding...
                </>
              ) : 'Add Supplier'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Searchable Supplier Dropdown Component
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
        setOpen(false);
        setSearch('');
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
          className={`w-full px-4 h-[42px] border rounded-xl text-left flex items-center justify-between transition-all duration-200 shadow-sm ${
            open ? 'bg-indigo-50/50 border-indigo-400 ring-4 ring-indigo-500/10 dark:bg-indigo-900/10 dark:border-indigo-500' : 'bg-slate-50/50 dark:bg-slate-900/50 border-slate-300 dark:border-slate-700 hover:border-indigo-400 hover:bg-white dark:hover:bg-slate-800'
          }`}
        >
          <span className={value ? 'text-slate-900 dark:text-white truncate font-medium text-sm' : 'text-slate-500 dark:text-slate-400 text-sm'}>
            {value ? `${value.name} (${value.phone || 'N/A'})` : 'Select Supplier...'}
          </span>
          <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${open ? 'rotate-180 text-indigo-500' : ''}`} />
        </button>
        {open && (
          <div className="absolute z-50 mt-2 w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="p-2 border-b border-slate-100 dark:border-slate-700 relative bg-slate-50/50 dark:bg-slate-900/50">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search Supplier Name or Phone..."
                className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all dark:text-white"
                autoFocus
              />
            </div>
            <ul className="max-h-60 overflow-y-auto p-1">
              {filtered.length === 0 ? (
                <li className="px-4 py-8 text-sm text-slate-500 flex flex-col items-center justify-center">
                  <Search className="w-6 h-6 text-slate-300 mb-2" />
                  No suppliers found
                </li>
              ) : (
                filtered.map(s => (
                  <li
                    key={s.id}
                    onMouseDown={() => { onChange(s); setOpen(false); setSearch(''); }}
                    className="px-4 py-2.5 mx-1 my-0.5 rounded-lg text-sm cursor-pointer hover:bg-indigo-50 hover:text-indigo-700 dark:hover:bg-indigo-500/10 dark:hover:text-indigo-300 transition-colors flex items-center justify-between group"
                  >
                    <span className="font-medium text-slate-700 group-hover:text-indigo-700 dark:text-slate-300 dark:group-hover:text-indigo-300">{s.name}</span>
                    <span className="text-xs text-slate-400 group-hover:text-indigo-500/70">{s.phone}</span>
                  </li>
                ))
              )}
            </ul>
          </div>
        )}
      </div>
      <Button type="button" onClick={onAddNew} className="bg-indigo-600 hover:bg-indigo-700 text-white shrink-0 px-4 rounded-xl shadow-sm shadow-indigo-600/20 transition-all hover:shadow-md h-[42px]">
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
                      {isLow && <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400 font-bold border border-rose-200 dark:border-rose-800">Low Stock</span>}
                    </div>
                    <span className="text-xs font-mono text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md">{rm.code}</span>
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

export default function CreatePOPage() {
  const navigate = useNavigate();
  
  const [formData, setFormData] = useState({
    selectedRm: null,
    selectedSupplier: null,
    name: '',
    quantity: '',
    amount: '',
    uomId: '',
    expectedDelivery: null,
  });
  
  const [errorMsg, setErrorMsg] = useState('');
  const [showAddSupplier, setShowAddSupplier] = useState(false);

  const { data: rmIdData, refetch: rotateId, isFetching: isRotating } = useQuery({
    queryKey: ['generateRmId'],
    queryFn: async () => {
      const response = await api.get('/rm/id/generate');
      return response.data;
    },
    refetchOnWindowFocus: false,
  });

  const { data: poRefData, refetch: rotatePoRef, isFetching: isRotatingPo } = useQuery({
    queryKey: ['generatePoRef'],
    queryFn: async () => {
      const response = await api.get('/po/reference/generate');
      return response.data;
    },
    refetchOnWindowFocus: false,
  });

  // Fetch Suppliers
  const { data: suppliers = [], refetch: refetchSuppliers } = useQuery({
    queryKey: ['suppliers'],
    queryFn: async () => {
      const response = await api.get('/parties/suppliers');
      return response.data;
    }
  });

  // Fetch Raw Materials from Item Setup
  const { data: rawMaterials = [], isLoading: isLoadingRMs } = useQuery({
    queryKey: ['raw-materials-setup'],
    queryFn: async () => {
      const response = await api.get('/item-setup/raw-material');
      return response.data;
    }
  });

  // Fetch RM Stock to determine low-stock items
  const { data: rmStock = [] } = useQuery({
    queryKey: ['rm-stock'],
    queryFn: async () => {
      const res = await api.get('/rm-stock');
      return res.data;
    }
  });

  // Build set of raw material IDs that are at or below alert level
  const lowStockIds = new Set(
    rmStock.filter(s => s.alertLevel != null && Number(s.availableQuantity) <= Number(s.alertLevel)).map(s => s.id)
  );

  // Count low stock for banner
  const lowStockCount = lowStockIds.size;

  // Fetch all UOMs as fallback
  const { data: allUoms = [] } = useQuery({
    queryKey: ['uoms'],
    queryFn: async () => {
      const response = await api.get('/uom');
      return response.data;
    }
  });

  const { data: rmUoms = [] } = useQuery({
    queryKey: ['uoms', formData.selectedRm?.id],
    queryFn: async () => {
      if (!formData.selectedRm?.id) return [];
      const response = await api.get(`/uom?rawMaterialId=${formData.selectedRm.id}`);
      return response.data;
    },
    enabled: !!formData.selectedRm?.id,
    keepPreviousData: true,
  });

  const getDefaultUomForRawMaterial = (rm) => {
    if (!rm) return null;
    if (rmUoms?.length > 0) return rmUoms[0];
    if (rm.uoms?.length > 0) return rm.uoms[0];

    const normalized = (rm.unitId || rm.consumptionUnit || '').trim().toLowerCase();
    if (!normalized) return null;

    const exactMatch = allUoms.find(u => 
      u.abbreviation.toLowerCase() === normalized ||
      u.name.toLowerCase() === normalized
    );
    if (exactMatch) return exactMatch;

    const containsMatch = allUoms.find(u =>
      u.abbreviation.toLowerCase().includes(normalized) ||
      u.name.toLowerCase().includes(normalized) ||
      normalized.includes(u.abbreviation.toLowerCase()) ||
      normalized.includes(u.name.toLowerCase())
    );
    return containsMatch || null;
  };

  useEffect(() => {
    if (!formData.selectedRm) return;

    const defaultUom = getDefaultUomForRawMaterial(formData.selectedRm);
    setFormData(prev => ({
      ...prev,
      name: formData.selectedRm.name,
      uomId: defaultUom ? defaultUom.id : prev.uomId,
    }));
  }, [formData.selectedRm, rmUoms, allUoms]);

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const response = await api.post('/rm/po', data);
      return response.data;
    },
    onSuccess: (data) => {
      alert(`PO Created successfully — RM #${data.rmId}`);
      navigate('/purchase-orders');
    },
    onError: (err) => {
      setErrorMsg(err.response?.data?.error || 'Failed to create Purchase Order');
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!formData.selectedRm && !rmIdData?.candidateId) {
      setErrorMsg('RM ID is still generating...');
      return;
    }
    if (!formData.selectedRm && !formData.name.trim()) {
      setErrorMsg('Raw Material Name is required');
      return;
    }
    if (!formData.expectedDelivery) {
      setErrorMsg('Expected Delivery Date is required');
      return;
    }

    const fallbackUomText = formData.selectedRm ? (formData.selectedRm.unitId || formData.selectedRm.consumptionUnit || '') : '';
    if (!formData.uomId && !fallbackUomText) {
      setErrorMsg('Unit of Measurement is required');
      return;
    }

    createMutation.mutate({
      rmId: formData.selectedRm ? formData.selectedRm.code : rmIdData.candidateId,
      name: formData.selectedRm ? formData.selectedRm.name : formData.name,
      quantity: Number(formData.quantity),
      amount: Number(formData.amount),
      uomId: formData.uomId || fallbackUomText,
      supplierId: formData.selectedSupplier ? formData.selectedSupplier.id : undefined,
      expectedDelivery: formData.expectedDelivery.toISOString(),
    });
  };

  const handleRotateId = (e) => {
    e.preventDefault();
    rotateId();
  };


  const selectedUom = getDefaultUomForRawMaterial(formData.selectedRm);
  const selectedUomLabel = selectedUom
    ? `${selectedUom.name} (${selectedUom.abbreviation})`
    : formData.selectedRm?.unitId || formData.selectedRm?.consumptionUnit || '';

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-6 lg:space-y-8 min-h-screen">
      {/* Low stock alert banner */}
      {lowStockCount > 0 && (
        <div className="flex items-start md:items-center gap-4 p-5 bg-gradient-to-r from-rose-50 to-orange-50 dark:from-rose-950/30 dark:to-orange-950/30 border border-rose-200/80 dark:border-rose-800/50 rounded-2xl shadow-sm transform transition-all duration-300 animate-in fade-in slide-in-from-top-4">
          <div className="mt-0.5 md:mt-0 flex items-center justify-center p-2 bg-rose-100 dark:bg-rose-900/50 rounded-full text-rose-600 dark:text-rose-400 shadow-inner">
            <span className="relative flex h-5 w-5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
              <AlertTriangle className="relative inline-flex h-5 w-5" />
            </span>
          </div>
          <p className="text-sm font-medium text-rose-800 dark:text-rose-300 flex-1">
            <strong className="text-rose-950 dark:text-rose-200 text-base">{lowStockCount}</strong> raw material{lowStockCount > 1 ? 's are' : ' is'} at or below reorder level — highlighted in the dropdown below.
          </p>
        </div>
      )}
      
      {showAddSupplier && (
        <AddSupplierInline 
          onClose={() => setShowAddSupplier(false)} 
          onAdded={(newSup) => {
            setShowAddSupplier(false);
            refetchSuppliers().then(() => {
              setFormData(prev => ({ ...prev, selectedSupplier: newSup }));
            });
          }} 
        />
      )}
      
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-5">
          <Button variant="ghost" size="icon" onClick={() => navigate('/purchase-orders')} className="text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-full transition-all bg-white dark:bg-slate-900 shadow-sm border border-slate-200/80 dark:border-slate-800 w-11 h-11 shrink-0">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
              Create Purchase Order
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Add a new raw material purchase order to the system.</p>
          </div>
        </div>
      </div>

      {/* Main Form Container */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl shadow-xl shadow-slate-200/20 dark:shadow-none overflow-hidden transition-all duration-300 relative group">
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 opacity-90"></div>
        <form onSubmit={handleSubmit}>
          
          {/* General Details Section */}
          <div className="p-6 md:p-8 border-b border-slate-100 dark:border-slate-800/80">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider mb-6 flex items-center gap-2">
              <FileText className="w-4 h-4 text-indigo-500" />
              General Details
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-end">
              
              {/* Expected Delivery */}
              <div className="space-y-2 flex flex-col">
                <Label className="text-slate-700 dark:text-slate-300 font-medium">Date (Expected Delivery) <span className="text-rose-500">*</span></Label>
                <Popover>
                  <PopoverTrigger
                    className={twMerge(
                      "flex h-[42px] w-full items-center justify-start rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50 px-4 py-2 text-left text-sm font-medium transition-all hover:bg-white hover:border-indigo-400 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-500/10 focus-visible:border-indigo-500 dark:hover:bg-slate-800 shadow-sm",
                      !formData.expectedDelivery ? "text-slate-500 dark:text-slate-400" : "text-slate-900 dark:text-white"
                    )}
                  >
                    <CalendarIcon className="mr-3 h-4 w-4 text-indigo-500" />
                    {formData.expectedDelivery ? format(formData.expectedDelivery, "PPP") : <span>Pick a date</span>}
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 rounded-2xl shadow-2xl border-slate-200 dark:border-slate-700" align="start">
                    <Calendar
                      mode="single"
                      selected={formData.expectedDelivery}
                      onSelect={(date) => setFormData({...formData, expectedDelivery: date})}
                      initialFocus
                      className="p-3"
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* Purchase Status */}
              <div className="space-y-2">
                <Label className="text-slate-700 dark:text-slate-300 font-medium">Purchase Status <span className="text-rose-500">*</span></Label>
                <div className="relative">
                  <select className="w-full h-[42px] px-4 py-2 text-sm border rounded-xl bg-slate-50/50 dark:bg-slate-900/50 border-slate-300 dark:border-slate-700 focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 hover:border-indigo-400 transition-all text-slate-700 dark:text-slate-200 shadow-sm appearance-none font-medium cursor-pointer">
                    <option>Pending</option>
                    <option>Received</option>
                    <option>Ordered</option>
                  </select>
                  <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>
              </div>

              {/* Attach Document */}
              <div className="space-y-2">
                <Label className="text-slate-700 dark:text-slate-300 font-medium">Attach Document</Label>
                <Input type="file" className="text-sm h-[42px] px-0 py-0 cursor-pointer rounded-xl border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50 file:mr-4 file:py-2.5 file:px-4 file:h-[42px] file:rounded-l-xl file:border-0 file:text-xs file:font-bold file:tracking-wide file:bg-slate-200/70 file:text-slate-700 dark:file:bg-slate-800 dark:file:text-slate-300 hover:file:bg-slate-300 dark:hover:file:bg-slate-700 shadow-sm transition-all hover:border-indigo-400" />
              </div>

              {/* Supplier Select */}
              <div className="space-y-2 lg:col-span-1">
                <Label className="text-slate-700 dark:text-slate-300 font-medium">Supplier <span className="text-rose-500">*</span></Label>
                <SupplierSelect 
                  suppliers={suppliers} 
                  value={formData.selectedSupplier} 
                  onChange={(s) => setFormData({...formData, selectedSupplier: s})} 
                  onAddNew={() => setShowAddSupplier(true)}
                />
              </div>
            </div>
          </div>

          {/* Items Section */}
          <div className="p-6 md:p-8 bg-slate-50/50 dark:bg-slate-800/10 border-b border-slate-100 dark:border-slate-800/80">
            
            <div className="mb-6 max-w-3xl">
              <Label className="text-slate-800 dark:text-slate-200 mb-3 flex items-center gap-2 font-bold text-sm uppercase tracking-wider">
                <Package className="w-4 h-4 text-indigo-500" />
                Order Items <span className="text-rose-500">*</span>
              </Label>
              <div className="relative">
                {isLoadingRMs ? (
                  <div className="w-full px-4 py-3 border rounded-xl text-slate-400 border-slate-300 dark:border-slate-700 flex items-center bg-white dark:bg-slate-900 shadow-sm h-[46px]">
                    <Loader2 className="w-4 h-4 mr-3 animate-spin text-indigo-500" /> Loading raw materials...
                  </div>
                ) : (
                  <RawMaterialSelect 
                    rawMaterials={rawMaterials}
                    value={formData.selectedRm}
                    onChange={(rm) => setFormData({...formData, selectedRm: rm, uomId: ''})} 
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
                      <th className="px-5 py-4 font-bold tracking-wide uppercase text-xs">Product Details</th>
                      <th className="px-5 py-4 font-bold tracking-wide uppercase text-xs text-right w-40">Quantity</th>
                      <th className="px-5 py-4 font-bold tracking-wide uppercase text-xs w-32">UOM</th>
                      <th className="px-5 py-4 font-bold tracking-wide uppercase text-xs text-right w-44">Subtotal (₹)</th>
                      <th className="px-5 py-4 font-bold tracking-wide uppercase text-xs text-center w-20">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {formData.selectedRm ? (
                      <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors group">
                        <td className="px-5 py-4 text-slate-400 font-medium">1</td>
                        <td className="px-5 py-4">
                          <div className="font-semibold text-slate-900 dark:text-slate-100 text-base">{formData.name}</div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs font-mono text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">{formData.selectedRm.code}</span>
                            {lowStockIds.has(formData.selectedRm.id) && (
                              <Badge variant="outline" className="text-[10px] bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-900/20 dark:text-rose-400 dark:border-rose-800/50 px-1.5 py-0">Low Stock</Badge>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-4 text-right">
                          <Input 
                            type="number" 
                            step="0.01" 
                            min="0.01"
                            value={formData.quantity} 
                            onChange={(e) => setFormData({...formData, quantity: e.target.value})} 
                            className="w-full ml-auto text-right h-10 rounded-lg border-slate-300 focus:border-indigo-500 focus:ring-indigo-500/20 bg-slate-50/50 dark:bg-slate-900/50 font-medium" 
                            required
                            placeholder="0.00"
                          />
                        </td>
                        <td className="px-5 py-4">
                          <div className="inline-flex items-center justify-center px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium text-xs border border-slate-200 dark:border-slate-700">
                            {formData.selectedRm?.unitId || <span className="text-amber-500 font-normal flex items-center gap-1"><Info className="w-3 h-3"/> Not set</span>}
                          </div>
                        </td>
                        <td className="px-5 py-4 text-right">
                          <Input 
                            type="number" 
                            step="0.01" 
                            min="0.01"
                            value={formData.amount} 
                            onChange={(e) => setFormData({...formData, amount: e.target.value})} 
                            className="w-full ml-auto text-right h-10 rounded-lg border-slate-300 focus:border-indigo-500 focus:ring-indigo-500/20 bg-slate-50/50 dark:bg-slate-900/50 font-bold text-slate-900 dark:text-white" 
                            required
                            placeholder="0.00"
                          />
                        </td>
                        <td className="px-5 py-4 text-center">
                          <button 
                            type="button" 
                            onClick={() => setFormData({...formData, selectedRm: null, quantity: '', amount: ''})} 
                            className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-lg transition-all mx-auto block"
                            title="Remove item"
                          >
                            <X className="w-5 h-5 mx-auto" />
                          </button>
                        </td>
                      </tr>
                    ) : (
                      <tr>
                        <td colSpan={6} className="px-5 py-12 text-center">
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
            
            {/* Fallback Reference Badge Info */}
            <div className="mt-5 flex justify-end items-center text-xs text-slate-500 dark:text-slate-400">
              <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm">
                <Tag className="w-3.5 h-3.5 text-indigo-500" />
                System Reference No: 
                <span className="font-mono font-semibold text-slate-700 dark:text-slate-300 ml-1">
                  {isRotatingPo ? <Loader2 className="w-3 h-3 animate-spin inline" /> : poRefData?.candidateId}
                </span>
              </div>
            </div>
          </div>

          {/* Pricing & Summary Section */}
          <div className="p-6 md:p-8">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider mb-6 flex items-center gap-2">
              <Calculator className="w-4 h-4 text-indigo-500" />
              Additional Charges
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              <div className="space-y-2">
                <Label className="text-slate-700 dark:text-slate-300 font-medium">Order Tax</Label>
                <div className="flex relative shadow-sm">
                  <Input type="number" defaultValue="0" className="rounded-r-none h-[42px] text-sm focus:z-10 focus:ring-indigo-500/20 focus:border-indigo-500 bg-slate-50/50 dark:bg-slate-900/50" />
                  <span className="flex items-center justify-center px-4 bg-slate-100 dark:bg-slate-800 border border-l-0 border-slate-300 dark:border-slate-700 rounded-r-xl text-slate-500 font-semibold text-sm">
                    %
                  </span>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-slate-700 dark:text-slate-300 font-medium">Discount</Label>
                <div className="relative shadow-sm">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-medium">₹</span>
                  <Input type="number" defaultValue="0" className="h-[42px] text-sm pl-8 rounded-xl focus:ring-indigo-500/20 focus:border-indigo-500 bg-slate-50/50 dark:bg-slate-900/50" />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-slate-700 dark:text-slate-300 font-medium">Shipping</Label>
                <div className="relative shadow-sm">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-medium">₹</span>
                  <Input type="number" defaultValue="0" className="h-[42px] text-sm pl-8 rounded-xl focus:ring-indigo-500/20 focus:border-indigo-500 bg-slate-50/50 dark:bg-slate-900/50" />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-slate-700 dark:text-slate-300 font-medium">Payment Status <span className="text-rose-500">*</span></Label>
                <div className="relative">
                  <select className="w-full h-[42px] px-4 py-2 text-sm border rounded-xl bg-slate-50/50 dark:bg-slate-900/50 border-slate-300 dark:border-slate-700 focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 hover:border-indigo-400 transition-all text-slate-700 dark:text-slate-200 shadow-sm appearance-none font-medium cursor-pointer">
                    <option>Pending</option>
                    <option>Due</option>
                    <option>Partial</option>
                    <option>Paid</option>
                  </select>
                  <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>
              </div>
            </div>

            <div className="space-y-2 mb-10">
              <Label className="text-slate-700 dark:text-slate-300 font-medium">Note / Instructions</Label>
              <textarea 
                className="w-full border rounded-2xl p-4 h-28 bg-slate-50/50 dark:bg-slate-900/50 border-slate-300 dark:border-slate-700 focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 hover:border-indigo-400 transition-all text-sm resize-none shadow-sm" 
                placeholder="Add any specific instructions for the supplier..."
              ></textarea>
            </div>

            {errorMsg && (
              <div className="mb-8 p-4 bg-rose-50 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400 rounded-xl text-sm font-medium border border-rose-200 dark:border-rose-800 flex items-center gap-3 shadow-sm">
                <AlertTriangle className="w-5 h-5 shrink-0" />
                {errorMsg}
              </div>
            )}

            {/* Grand Total Summary Box */}
            <div className="bg-gradient-to-br from-slate-50 to-indigo-50/50 dark:from-slate-800/60 dark:to-indigo-900/20 p-6 md:p-8 rounded-3xl flex flex-col lg:flex-row justify-between items-center border border-slate-200/80 dark:border-slate-700/80 gap-8 shadow-inner relative overflow-hidden">
              <div className="absolute top-0 right-0 p-16 bg-indigo-500/5 dark:bg-indigo-500/10 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>
              
              <div className="flex flex-wrap gap-x-8 gap-y-4 text-sm w-full lg:w-auto relative z-10">
                <div className="flex flex-col gap-1">
                  <span className="text-slate-500 dark:text-slate-400 font-medium">Total Items</span>
                  <span className="font-bold text-slate-900 dark:text-slate-100 text-lg">{formData.selectedRm ? '1' : '0'}</span>
                </div>
                <div className="w-px h-10 bg-slate-200 dark:bg-slate-700 hidden sm:block"></div>
                <div className="flex flex-col gap-1">
                  <span className="text-slate-500 dark:text-slate-400 font-medium">Subtotal</span>
                  <span className="font-bold text-slate-900 dark:text-slate-100 text-lg">₹{Number(formData.amount || 0).toLocaleString('en-IN', {minimumFractionDigits: 2})}</span>
                </div>
                <div className="w-px h-10 bg-slate-200 dark:bg-slate-700 hidden sm:block"></div>
                <div className="flex flex-col gap-1">
                  <span className="text-slate-500 dark:text-slate-400 font-medium">Order Tax</span>
                  <span className="font-semibold text-slate-700 dark:text-slate-300">₹0.00</span>
                </div>
                <div className="w-px h-10 bg-slate-200 dark:bg-slate-700 hidden sm:block"></div>
                <div className="flex flex-col gap-1">
                  <span className="text-slate-500 dark:text-slate-400 font-medium">Discount</span>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">-₹0.00</span>
                </div>
                <div className="w-px h-10 bg-slate-200 dark:bg-slate-700 hidden sm:block"></div>
                <div className="flex flex-col gap-1">
                  <span className="text-slate-500 dark:text-slate-400 font-medium">Shipping</span>
                  <span className="font-semibold text-slate-700 dark:text-slate-300">+₹0.00</span>
                </div>
              </div>
              
              <div className="flex flex-col sm:flex-row items-center gap-6 w-full lg:w-auto relative z-10 border-t sm:border-t-0 border-slate-200 dark:border-slate-700 pt-6 sm:pt-0 mt-2 sm:mt-0">
                <div className="text-center sm:text-right">
                  <div className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                    Grand Total
                  </div>
                  <div className="text-3xl font-black text-indigo-600 dark:text-indigo-400 tracking-tight drop-shadow-sm">
                    ₹{Number(formData.amount || 0).toLocaleString('en-IN', {minimumFractionDigits: 2})}
                  </div>
                </div>
                <Button type="submit" disabled={createMutation.isPending} className="bg-indigo-600 hover:bg-indigo-700 text-white min-w-40 h-14 rounded-2xl text-base font-bold shadow-lg shadow-indigo-600/25 hover:shadow-xl hover:shadow-indigo-600/30 transition-all hover:-translate-y-0.5 active:translate-y-0 w-full sm:w-auto">
                  {createMutation.isPending ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <CheckCircle2 className="w-5 h-5 mr-2" />}
                  {createMutation.isPending ? 'Submitting...' : 'Confirm Order'}
                </Button>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
