import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { api } from '@/lib/axios';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { CalendarIcon, RefreshCw, ArrowLeft, Loader2, Search, X, ChevronDown, Plus, AlertTriangle } from 'lucide-react';
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
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-lg p-6 w-full max-w-2xl shadow-xl border border-slate-200 dark:border-slate-800 max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold mb-6 text-slate-900 dark:text-white">Quick Add Supplier</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Name *</Label>
              <Input required value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Acme Corp" />
            </div>
            <div>
              <Label>Contact Person</Label>
              <Input value={contactPerson} onChange={e => setContactPerson(e.target.value)} placeholder="John Doe" />
            </div>
            <div>
              <Label>Phone *</Label>
              <Input required value={phone} onChange={e => setPhone(e.target.value)} placeholder="Phone number" />
            </div>
            <div>
              <Label>Email</Label>
              <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="email@example.com" />
            </div>
            <div>
              <Label>Opening Balance</Label>
              <Input type="number" step="0.01" value={openingBalance} onChange={e => setOpeningBalance(e.target.value)} />
            </div>
            <div>
              <Label>Credit Limit</Label>
              <Input type="number" step="0.01" value={creditLimit} onChange={e => setCreditLimit(e.target.value)} />
            </div>
            <div className="md:col-span-2">
              <Label>Address</Label>
              <Input value={address} onChange={e => setAddress(e.target.value)} placeholder="123 Main St..." />
            </div>
            <div className="md:col-span-2">
              <Label>Note</Label>
              <textarea 
                className="w-full border rounded-md p-2 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm" 
                rows={3} 
                value={note} 
                onChange={e => setNote(e.target.value)} 
                placeholder="Additional notes..." 
              />
            </div>
          </div>
          <div className="flex justify-end space-x-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting} className="bg-indigo-600 hover:bg-indigo-700">
              {isSubmitting ? 'Adding...' : 'Add Supplier'}
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
          className="w-full px-3 py-2 border rounded-md text-left flex items-center justify-between bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700"
        >
          <span className={value ? 'text-slate-900 dark:text-white truncate' : 'text-slate-400'}>
            {value ? `${value.name} (${value.phone || 'N/A'})` : 'Select Supplier...'}
          </span>
          <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
        {open && (
          <div className="absolute z-50 mt-1 w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md shadow-lg">
            <div className="p-2 border-b border-slate-100 dark:border-slate-700 relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search Supplier Name or Phone..."
                className="w-full pl-8 pr-3 py-1.5 text-sm border rounded bg-transparent"
              />
            </div>
            <ul className="max-h-52 overflow-y-auto py-1">
              {filtered.length === 0 ? (
                <li className="px-3 py-2 text-sm text-slate-400 text-center">No suppliers found</li>
              ) : (
                filtered.map(s => (
                  <li
                    key={s.id}
                    onMouseDown={() => { onChange(s); setOpen(false); setSearch(''); }}
                    className="px-3 py-2 text-sm cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    <span>{s.name}</span>
                    <span className="text-xs text-slate-400 block">{s.phone}</span>
                  </li>
                ))
              )}
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
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(prev => !prev)}
        className={`w-full px-3 py-2 border rounded-md text-left flex items-center justify-between bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 ${error ? 'border-red-400' : 'border-slate-300 dark:border-slate-700'}`}
      >
        <span className={value ? 'text-slate-900 dark:text-white truncate' : 'text-slate-400'}>
          {value ? `${value.code} - ${value.name}` : 'Select Raw Material...'}
        </span>
        <div className="flex items-center gap-1">
          {value && (
            <span
              onMouseDown={handleClear}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer p-0.5 rounded"
            >
              <X className="w-3 h-3" />
            </span>
          )}
          <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-150 ${open ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md shadow-lg">
          <div className="p-2 border-b border-slate-100 dark:border-slate-700">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                ref={searchRef}
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search RM Name or Code..."
                className="w-full pl-7 pr-7 py-1.5 text-sm border rounded border-slate-200 dark:border-slate-600 dark:bg-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              {search && (
                <button
                  type="button"
                  onMouseDown={() => setSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          <ul className="max-h-52 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-sm text-slate-400 text-center">No results found</li>
            ) : (
              filtered.map(rm => {
                const isLow = lowStockIds.has(rm.id);
                return (
                  <li
                    key={rm.id}
                    onMouseDown={() => handleSelect(rm)}
                    className={`px-3 py-2 text-sm cursor-pointer select-none flex justify-between items-center ${
                      value?.id === rm.id
                        ? 'bg-indigo-50 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 font-medium'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {isLow && (
                        <span className="relative flex h-2.5 w-2.5 shrink-0">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
                        </span>
                      )}
                      <span className={isLow ? 'text-red-600 dark:text-red-400 font-semibold' : ''}>{rm.name}</span>
                      {isLow && <span className="text-xs px-1.5 py-0.5 rounded bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-400 font-medium">LOW</span>}
                    </div>
                    <span className="text-xs text-slate-400">{rm.code}</span>
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
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Low stock alert banner */}
      {lowStockCount > 0 && (
        <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-xl">
          <span className="relative flex h-4 w-4 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-4 w-4 bg-red-500"></span>
          </span>
          <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400" />
          <p className="text-sm font-medium text-red-700 dark:text-red-400">
            <strong>{lowStockCount}</strong> raw material{lowStockCount > 1 ? 's are' : ' is'} at or below reorder level — highlighted in the dropdown below.
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
      <div className="flex items-center space-x-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/purchase-orders')} className="text-slate-500 rounded-full">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Create Purchase Order</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Add a new raw material purchase order to the system.</p>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
        <form onSubmit={handleSubmit}>
          
          <div className="p-6 border-b border-slate-100 dark:border-slate-800">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-end">

              <div className="space-y-2 flex flex-col">
                <Label className="text-slate-700 dark:text-slate-300">Date (Expected Delivery) <span className="text-red-500">*</span></Label>
                <Popover>
                  <PopoverTrigger
                    className={twMerge(
                      "flex h-10 w-full items-center justify-start rounded-md border border-slate-300 bg-white px-3 py-2 text-left text-sm font-normal text-slate-900 transition-all hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 shadow-sm",
                      !formData.expectedDelivery && "text-slate-500 dark:text-slate-400"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formData.expectedDelivery ? format(formData.expectedDelivery, "PPP") : <span>Pick a date</span>}
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={formData.expectedDelivery}
                      onSelect={(date) => setFormData({...formData, expectedDelivery: date})}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label className="text-slate-700 dark:text-slate-300">Purchase Status <span className="text-red-500">*</span></Label>
                <select className="w-full h-10 px-3 py-2 text-sm border rounded-md bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-700 dark:text-slate-200 shadow-sm">
                  <option>Pending</option>
                  <option>Received</option>
                  <option>Ordered</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label className="text-slate-700 dark:text-slate-300">Attach Document</Label>
                <Input type="file" className="text-sm h-10 cursor-pointer file:mr-4 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200 shadow-sm" />
              </div>

              <div className="space-y-2 lg:col-span-1">
                <Label className="text-slate-700 dark:text-slate-300">Supplier <span className="text-red-500">*</span></Label>
                <SupplierSelect 
                  suppliers={suppliers} 
                  value={formData.selectedSupplier} 
                  onChange={(s) => setFormData({...formData, selectedSupplier: s})} 
                  onAddNew={() => setShowAddSupplier(true)}
                />
              </div>
            </div>
          </div>

          <div className="p-6 bg-slate-50/50 dark:bg-slate-800/20 border-b border-slate-100 dark:border-slate-800">
            <div className="mb-6">
              <Label className="text-slate-700 dark:text-slate-300 mb-2 block font-semibold text-base">Please add products to order list <span className="text-red-500">*</span></Label>
              <div className="relative max-w-2xl">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 z-10" />
                <div className="pl-6">
                  {isLoadingRMs ? (
                    <div className="w-full px-3 py-2 border rounded-md text-slate-400 border-slate-300 dark:border-slate-700 flex items-center bg-white dark:bg-slate-900">
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Loading raw materials...
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
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md overflow-hidden shadow-sm">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                  <tr>
                    <th className="px-4 py-3 font-semibold">#</th>
                    <th className="px-4 py-3 font-semibold">Product Name (Code)</th>
                    <th className="px-4 py-3 font-semibold text-right">Quantity</th>
                    <th className="px-4 py-3 font-semibold">UOM</th>
                    <th className="px-4 py-3 font-semibold text-right">Subtotal (₹)</th>
                    <th className="px-4 py-3 font-semibold text-center">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {formData.selectedRm ? (
                    <tr className="border-t border-slate-200 dark:border-slate-700">
                      <td className="px-4 py-4 text-slate-500">1</td>
                      <td className="px-4 py-4">
                        <div className="font-medium text-slate-900 dark:text-slate-100">{formData.name}</div>
                        <div className="text-xs text-slate-500 mt-0.5">{formData.selectedRm.code}</div>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <Input 
                          type="number" 
                          step="0.01" 
                          min="0.01"
                          value={formData.quantity} 
                          onChange={(e) => setFormData({...formData, quantity: e.target.value})} 
                          className="w-24 ml-auto text-right h-8" 
                          required
                          placeholder="0.00"
                        />
                      </td>
                      <td className="px-4 py-4 text-slate-600 dark:text-slate-400 font-medium">
                        {formData.selectedRm?.unitId || <span className="text-amber-500 text-xs font-normal">Not set</span>}
                      </td>
                      <td className="px-4 py-4 text-right">
                        <Input 
                          type="number" 
                          step="0.01" 
                          min="0.01"
                          value={formData.amount} 
                          onChange={(e) => setFormData({...formData, amount: e.target.value})} 
                          className="w-32 ml-auto text-right h-8 font-medium" 
                          required
                          placeholder="0.00"
                        />
                      </td>
                      <td className="px-4 py-4 text-center">
                        <button 
                          type="button" 
                          onClick={() => setFormData({...formData, selectedRm: null, quantity: '', amount: ''})} 
                          className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-md transition-colors"
                        >
                          <X className="w-4 h-4 mx-auto" />
                        </button>
                      </td>
                    </tr>
                  ) : (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-slate-500 dark:text-slate-400 bg-slate-50/30 dark:bg-slate-800/10">
                        <div className="flex flex-col items-center justify-center">
                          <Search className="w-8 h-8 text-slate-300 dark:text-slate-600 mb-2" />
                          <p>No products selected</p>
                          <p className="text-xs mt-1">Please search and select a raw material above.</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            
            {/* Fallback Reference Badge Info */}
            <div className="mt-4 flex justify-between items-center text-xs text-slate-500">
              <div>System Reference No: <span className="font-mono bg-white dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700 ml-1">{isRotatingPo ? '...' : poRefData?.candidateId}</span></div>
            </div>
          </div>

          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              <div className="space-y-2">
                <Label className="text-slate-700 dark:text-slate-300">Order Tax</Label>
                <div className="flex">
                  <Input type="number" defaultValue="0" className="rounded-r-none h-9 text-sm" />
                  <span className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 border border-l-0 border-slate-300 dark:border-slate-700 rounded-r-md text-slate-500 text-sm">%</span>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-slate-700 dark:text-slate-300">Discount</Label>
                <Input type="number" defaultValue="0" className="h-9 text-sm" />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-700 dark:text-slate-300">Shipping</Label>
                <Input type="number" defaultValue="0" className="h-9 text-sm" />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-700 dark:text-slate-300">Payment Status <span className="text-red-500">*</span></Label>
                <select className="w-full px-3 py-2 text-sm border rounded-md bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-700 dark:text-slate-200">
                  <option>Pending</option>
                  <option>Due</option>
                  <option>Partial</option>
                  <option>Paid</option>
                </select>
              </div>
            </div>

            <div className="space-y-2 mb-8">
              <Label className="text-slate-700 dark:text-slate-300">Note</Label>
              <textarea 
                className="w-full border rounded-md p-3 h-24 bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm" 
                placeholder="Add any notes here..."
              ></textarea>
            </div>

            {errorMsg && (
              <div className="mb-6 p-3 bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400 rounded-md text-sm font-medium border border-red-200 dark:border-red-800">
                {errorMsg}
              </div>
            )}

            <div className="bg-slate-50 dark:bg-slate-800/40 p-5 rounded-lg flex flex-col lg:flex-row justify-between items-center border border-slate-200 dark:border-slate-700 gap-6">
              <div className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
                <div className="text-slate-500 dark:text-slate-400">Items: <span className="font-semibold text-slate-900 dark:text-slate-100">{formData.selectedRm ? '1' : '0'}</span></div>
                <div className="text-slate-500 dark:text-slate-400">Total: <span className="font-semibold text-slate-900 dark:text-slate-100">₹{Number(formData.amount || 0).toLocaleString('en-IN', {minimumFractionDigits: 2})}</span></div>
                <div className="text-slate-500 dark:text-slate-400">Order Tax: <span className="font-semibold text-slate-900 dark:text-slate-100">₹0.00</span></div>
                <div className="text-slate-500 dark:text-slate-400">Discount: <span className="font-semibold text-slate-900 dark:text-slate-100">₹0.00</span></div>
                <div className="text-slate-500 dark:text-slate-400">Shipping: <span className="font-semibold text-slate-900 dark:text-slate-100">₹0.00</span></div>
              </div>
              
              <div className="flex items-center gap-6">
                <div className="text-xl text-slate-500 dark:text-slate-400">
                  Grand Total: <span className="font-bold text-slate-900 dark:text-white">₹{Number(formData.amount || 0).toLocaleString('en-IN', {minimumFractionDigits: 2})}</span>
                </div>
                <Button type="submit" disabled={createMutation.isPending} className="bg-indigo-600 hover:bg-indigo-700 min-w-32 h-11 text-base">
                  {createMutation.isPending ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : null}
                  {createMutation.isPending ? 'Submitting...' : 'Submit'}
                </Button>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
