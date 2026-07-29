import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/axios';
import { useNavigate, useLocation } from 'react-router-dom';
import { format } from 'date-fns';
import { CalendarIcon, RefreshCw, ArrowLeft, Loader2, Search, X, ChevronDown, Plus, AlertTriangle, FileText, CheckCircle2, Package, Tag, Calculator, Info } from 'lucide-react';
import { twMerge } from 'tailwind-merge';
import Swal from 'sweetalert2';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import DatePicker from '@/components/ui/DatePicker';
import { Badge } from '@/components/ui/badge';

import QuickAddSupplierModal from '@/components/forms/QuickAddSupplierModal';
const AddSupplierInline = QuickAddSupplierModal;

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

export default function CreatePOPage({ onBack }) {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const handleBack = () => {
    if (onBack) onBack();
    else navigate(location.state?.from || '/purchase-orders');
  };
  
  const [formData, setFormData] = useState({
    selectedRm: null,
    selectedSupplier: null,
    name: '',
    quantity: '',
    amount: '',
    uomId: '',
    expectedDelivery: null,
    discount: '0',
    shipping: '0',
    otherCharges: '0',
  });
  const [items, setItems] = useState([]);
  
  const [errorMsg, setErrorMsg] = useState('');
  const [showAddSupplier, setShowAddSupplier] = useState(false);
  const isFromQuotation = !!location.state?.prefillFromQuotation;

  // Prefill from RM Quotation if navigated via "Turn into Direct Order"
  useEffect(() => {
    if (location.state?.prefillFromQuotation) {
      const q = location.state.prefillFromQuotation;
      setFormData(prev => ({
        ...prev,
        selectedSupplier: q.supplier || prev.selectedSupplier,
        discount: String(q.discount || 0),
        shipping: String(q.shipping || 0),
        otherCharges: String(q.otherCharges || 0)
      }));

      if (q.items && Array.isArray(q.items)) {
        const prefilled = q.items.map(it => ({
          id: it.materialId || Math.random().toString(),
          rmId: it.materialCode || 'RM-ITEM',
          name: it.materialName || 'Raw Material',
          quantity: Number(it.quantity) || 1,
          unitPrice: Number(it.unitPrice) || 0,
          uomLabel: it.unit || 'Kg',
          uomId: '',
          gstApplicable: it.gstApplicable ?? true,
          gstPercentage: Number(it.gstRate) || 18
        }));
        setItems(prefilled);
      }
    }
  }, [location.state]);

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

  const handleAddRmItem = (rm) => {
    if (!rm) return;
    const exists = items.some(item => item.id === rm.id);
    if (exists) {
      Swal.fire({
        icon: 'info',
        title: 'Item already added',
        text: `${rm.name} is already in the items list. You can update its quantity directly.`,
        confirmButtonColor: '#4f46e5',
      });
      return;
    }
    
    const defaultUom = getDefaultUomForRawMaterial(rm);
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
    setItems(prev => [...prev, newItem]);
    setFormData(prev => ({ ...prev, selectedRm: null }));
  };

  // Tax and Grand Total calculations
  const subtotal = items.reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.unitPrice || 0), 0);
  const shipping = Number(formData.shipping || 0);
  const discount = Number(formData.discount || 0);
  const otherCharges = Number(formData.otherCharges || 0);

  // Check supplier state code (prefix 33)
  const isInterState = formData.selectedSupplier?.gstin
    ? !formData.selectedSupplier.gstin.trim().startsWith('33')
    : false;

  const totalItemTax = items.reduce((sum, item) => {
    if (!item.gstApplicable) return sum;
    const itemSubtotal = Number(item.quantity || 0) * Number(item.unitPrice || 0);
    return sum + (itemSubtotal * (Number(item.gstPercentage || 0) / 100));
  }, 0);

  const cgstAmount = isInterState ? 0 : totalItemTax / 2;
  const sgstAmount = isInterState ? 0 : totalItemTax / 2;
  const igstAmount = isInterState ? totalItemTax : 0;

  const grandTotal = subtotal + totalItemTax + shipping + otherCharges - discount;

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const response = await api.post('/rm/po', data);
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['pos'] });
      Swal.fire({
        icon: 'success',
        title: 'PO Created Successfully!',
        text: `PO Order ID: ${data.referenceNo || data.id}`,
        confirmButtonColor: '#4f46e5',
        customClass: {
          popup: 'rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900',
          title: 'text-slate-900 dark:text-white',
          htmlContainer: 'text-slate-600 dark:text-slate-300'
        }
      }).then(() => {
        navigate('/purchase-orders', { replace: true });
      });
    },
    onError: (err) => {
      setErrorMsg(err.response?.data?.error || 'Failed to create Purchase Order');
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (items.length === 0) {
      setErrorMsg('Please add at least one raw material item.');
      return;
    }
    if (!formData.expectedDelivery) {
      setErrorMsg('Expected Delivery Date is required');
      return;
    }
    if (!formData.selectedSupplier) {
      setErrorMsg('Supplier is required');
      return;
    }

    const firstItem = items[0];
    const totalQuantity = items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);

    createMutation.mutate({
      rmId: firstItem.rmId,
      name: firstItem.name,
      quantity: totalQuantity,
      amount: Number(grandTotal),
      uomId: firstItem.uomId || firstItem.uomLabel,
      supplierId: formData.selectedSupplier.id,
      expectedDelivery: formData.expectedDelivery.toISOString(),
      
      subtotal: subtotal,
      orderTax: 0,
      discount: discount,
      shipping: shipping,
      otherCharges: otherCharges,
      cgst: cgstAmount,
      sgst: sgstAmount,
      igst: igstAmount,
      grandTotal: grandTotal,
      items: items,
      quotationId: location.state?.prefillFromQuotation?.quotationId || null,
    });
  };

  const handleRotateId = (e) => {
    e.preventDefault();
    rotateId();
  };

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
          <Button variant="ghost" size="icon" onClick={handleBack} className="text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-full transition-all bg-white dark:bg-slate-900 shadow-sm border border-slate-200/80 dark:border-slate-800 w-11 h-11 shrink-0">
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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
              <DatePicker
                label="Date (Expected Delivery)"
                required
                value={formData.expectedDelivery}
                onChange={(date) => setFormData({ ...formData, expectedDelivery: date })}
                disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                modalTitle="Expected Delivery"
                placeholder="Select Date"
              />

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

              {/* Supplier Select */}
              <div className="space-y-2">
                <Label className="text-slate-700 dark:text-slate-300 font-medium">Supplier <span className="text-rose-500">*</span></Label>
                <SupplierSelect 
                  suppliers={suppliers} 
                  value={formData.selectedSupplier} 
                  onChange={(s) => setFormData({...formData, selectedSupplier: s})} 
                  onAddNew={() => setShowAddSupplier(true)}
                />
              </div>
            </div>

            {/* Supplier Details Horizontal Banner */}
            {formData.selectedSupplier && (
              <div className="mt-6 p-4 bg-gradient-to-r from-indigo-50/40 to-slate-50/40 dark:from-indigo-950/10 dark:to-slate-800/10 border border-indigo-100/80 dark:border-indigo-900/30 rounded-2xl flex flex-wrap gap-x-8 gap-y-3 text-xs text-slate-600 dark:text-slate-400 shadow-sm animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-slate-700 dark:text-slate-300">Phone:</span>
                  <span>{formData.selectedSupplier.phone || 'N/A'}</span>
                </div>
                <div className="w-px h-4 bg-slate-200 dark:bg-slate-700 hidden sm:block"></div>
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-slate-700 dark:text-slate-300">GSTIN:</span>
                  <span className="font-mono font-medium text-indigo-600 dark:text-indigo-400">{formData.selectedSupplier.gstin || 'N/A'}</span>
                </div>
                <div className="w-px h-4 bg-slate-200 dark:bg-slate-700 hidden sm:block"></div>
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-slate-700 dark:text-slate-300">PAN:</span>
                  <span className="font-mono">{formData.selectedSupplier.pan || 'N/A'}</span>
                </div>
                <div className="w-px h-4 bg-slate-200 dark:bg-slate-700 hidden sm:block"></div>
                <div className="flex items-center gap-1.5 flex-1 min-w-[200px]">
                  <span className="font-semibold text-slate-700 dark:text-slate-300">Address:</span>
                  <span className="truncate" title={formData.selectedSupplier.address}>{formData.selectedSupplier.address || 'N/A'}</span>
                </div>
              </div>
            )}
          </div>          {/* Items Section */}
          <div className="p-6 md:p-8 bg-slate-50/50 dark:bg-slate-800/10 border-b border-slate-100 dark:border-slate-800/80">
            
            {isFromQuotation ? (
              <div className="flex items-center justify-between p-4 bg-purple-500/10 border border-purple-500/20 rounded-2xl text-purple-700 dark:text-purple-300 mb-6">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-purple-500 shrink-0" />
                  <div>
                    <div className="font-bold text-sm">Converted from RM Quotation</div>
                    <div className="text-xs text-purple-600 dark:text-purple-400 mt-0.5">
                      Raw materials and pricing are locked and prefilled from quotation {location.state.prefillFromQuotation.referenceNo || ''}. Additional items cannot be added.
                    </div>
                  </div>
                </div>
              </div>
            ) : (
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
                      value={formData.selectedRm}
                      onChange={handleAddRmItem} 
                      lowStockIds={lowStockIds}
                    />
                  )}
                </div>
              </div>
            )}

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
                    {items.length > 0 ? (
                      items.map((item, index) => {
                        const itemSubtotal = Number(item.quantity || 0) * Number(item.unitPrice || 0);
                        return (
                          <tr key={item.id || index} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors group">
                            <td className="px-5 py-4 text-slate-400 font-medium">{index + 1}</td>
                            <td className="px-5 py-4">
                              <div className="font-semibold text-slate-900 dark:text-slate-100 text-sm">{item.name}</div>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-xs font-mono text-slate-505 bg-slate-105 dark:bg-slate-800 px-2 py-0.5 rounded">{item.rmId}</span>
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
                                    setItems(prev => prev.map(it => it.id === item.id ? { ...it, quantity: val } : it));
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
                                  setItems(prev => prev.map(it => it.id === item.id ? { ...it, unitPrice: val } : it));
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
                                  setItems(prev => prev.map(it => it.id === item.id ? { ...it, gstApplicable: !it.gstApplicable } : it));
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
                                  setItems(prev => prev.map(it => it.id === item.id ? { ...it, gstPercentage: val } : it));
                                }}
                                className="h-9 px-2 py-1 text-xs border rounded-lg bg-slate-50/50 dark:bg-slate-900/50 border-slate-300 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-700 dark:text-slate-202 font-bold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed w-20 mx-auto block"
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
                              {isFromQuotation ? (
                                <span className="text-[11px] font-bold text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/60 px-2 py-1 rounded-md border border-purple-200 dark:border-purple-800">
                                  Quoted
                                </span>
                              ) : (
                                <button 
                                  type="button" 
                                  onClick={() => setItems(prev => prev.filter(it => it.id !== item.id))} 
                                  className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-lg transition-all mx-auto block"
                                  title="Remove item"
                                >
                                  <X className="w-5 h-5 mx-auto" />
                                </button>
                              )}
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
                            <p className="text-base font-medium text-slate-650 dark:text-slate-400 mb-1">No products selected</p>
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
            <div className="mt-5 flex justify-end items-center text-xs text-slate-550 dark:text-slate-400">
              <div className="flex items-center gap-2 bg-slate-105 dark:bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm">
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
            
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-5 mb-8">
              <div className="space-y-1.5">
                <Label className="text-slate-600 dark:text-slate-300 font-semibold text-xs tracking-wide">Discount (₹)</Label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-medium">₹</span>
                  <Input 
                    type="number" 
                    min="0"
                    value={formData.discount} 
                    onChange={(e) => setFormData({ ...formData, discount: e.target.value })}
                    className="h-10 text-sm pl-8 rounded-xl focus:ring-indigo-500/20 focus:border-indigo-500 bg-slate-50/50 dark:bg-slate-900/50 transition-all border-slate-200 dark:border-slate-800" 
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
                    value={formData.shipping} 
                    onChange={(e) => setFormData({ ...formData, shipping: e.target.value })}
                    className="h-10 text-sm pl-8 rounded-xl focus:ring-indigo-500/20 focus:border-indigo-500 bg-slate-50/50 dark:bg-slate-900/50 transition-all border-slate-200 dark:border-slate-800" 
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
                    value={formData.otherCharges} 
                    onChange={(e) => setFormData({ ...formData, otherCharges: e.target.value })}
                    className="h-10 text-sm pl-8 rounded-xl focus:ring-indigo-500/20 focus:border-indigo-500 bg-slate-50/50 dark:bg-slate-900/50 transition-all border-slate-200 dark:border-slate-800" 
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-slate-600 dark:text-slate-300 font-semibold text-xs tracking-wide">Payment Status <span className="text-rose-500">*</span></Label>
                <div className="relative">
                  <select className="w-full h-10 px-3.5 py-2 text-sm border rounded-xl bg-slate-50/50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 hover:border-indigo-400 transition-all text-slate-700 dark:text-slate-200 shadow-sm appearance-none font-medium cursor-pointer">
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
              <Label className="text-slate-755 dark:text-slate-300 font-medium">Note / Instructions</Label>
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
            <div className="bg-gradient-to-r from-slate-50 via-indigo-50/20 to-slate-50 dark:from-slate-900 dark:via-indigo-950/20 dark:to-slate-900 p-5 md:p-6 rounded-2xl flex flex-col lg:flex-row justify-between items-center border border-slate-200 dark:border-slate-800 gap-6 shadow-md relative overflow-hidden transition-all duration-300 hover:border-indigo-500/40">
              <div className="absolute top-0 right-0 p-16 bg-indigo-500/5 dark:bg-indigo-500/10 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>
              
              {/* Financial Metrics Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-y-4 gap-x-6 text-sm w-full lg:w-auto relative z-10 select-none">
                <div className="flex flex-col gap-0.5 group/metric transition-transform duration-200 hover:translate-y-[-2px]">
                  <span className="text-slate-400 dark:text-slate-500 font-semibold text-[10px] uppercase tracking-wider">Total Items</span>
                  <span className="font-extrabold text-slate-800 dark:text-slate-200 text-base">{items.length}</span>
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
                <Button type="submit" disabled={createMutation.isPending} className="bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white min-w-36 h-12 rounded-xl text-sm font-extrabold shadow-md shadow-indigo-600/20 hover:shadow-lg hover:shadow-indigo-600/30 transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 w-full sm:w-auto">
                  {createMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
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
