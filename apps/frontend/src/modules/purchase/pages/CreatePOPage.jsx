import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/axios';
import { useNavigate, useLocation } from 'react-router-dom';
import { format } from 'date-fns';
import { 
  CalendarIcon, RefreshCw, ArrowLeft, Loader2, Search, X, ChevronDown, 
  Plus, Minus, AlertTriangle, FileText, CheckCircle2, Package, Tag, Calculator, 
  Info, Trash2, Scale, Building2, CreditCard, ShieldCheck, ArrowRight 
} from 'lucide-react';
import { twMerge } from 'tailwind-merge';
import Swal from 'sweetalert2';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import DatePicker from '@/components/ui/DatePicker';
import { Badge } from '@/components/ui/badge';

import QuickAddSupplierModal from '@/components/forms/QuickAddSupplierModal';
const AddSupplierInline = QuickAddSupplierModal;

/* ─────────────────────────────────────────────────────────────────────────────
   Searchable Supplier Select Component (Responsive for All Devices)
   ───────────────────────────────────────────────────────────────────────────── */
function SupplierSelect({ suppliers, value, onChange, onAddNew }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef(null);

  const filtered = suppliers.filter(s =>
    (s.name || '').toLowerCase().includes(search.toLowerCase()) || 
    (s.phone && s.phone.toLowerCase().includes(search.toLowerCase())) ||
    (s.gstin && s.gstin.toLowerCase().includes(search.toLowerCase()))
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
    <div className="flex gap-1.5 w-full">
      <div ref={containerRef} className="relative flex-1 min-w-0">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className={`w-full px-2.5 sm:px-3 h-9 border rounded-xl text-left flex items-center justify-between transition-all duration-150 shadow-xs text-xs ${
            open 
              ? 'bg-indigo-50/70 border-indigo-500 ring-2 ring-indigo-500/15 dark:bg-indigo-950/40 dark:border-indigo-500' 
              : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 hover:border-indigo-400 dark:hover:border-indigo-500'
          }`}
        >
          <span className={value ? 'text-slate-900 dark:text-white truncate font-medium' : 'text-slate-400 dark:text-slate-500 truncate'}>
            {value ? `${value.name}${value.phone ? ` (${value.phone})` : ''}` : 'Select Supplier...'}
          </span>
          <ChevronDown className={`w-3.5 h-3.5 text-slate-400 shrink-0 ml-1 transition-transform duration-200 ${open ? 'rotate-180 text-indigo-500' : ''}`} />
        </button>

        {open && (
          <div className="absolute z-50 mt-1.5 left-0 right-0 sm:right-auto sm:w-full min-w-[260px] max-w-[calc(100vw-2rem)] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl overflow-hidden animate-in fade-in-50 zoom-in-95 duration-150">
            <div className="p-2 border-b border-slate-100 dark:border-slate-800 relative bg-slate-50/70 dark:bg-slate-950/70">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search name, phone, or GSTIN..."
                className="w-full pl-8 pr-2 py-1.5 text-xs border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-slate-900 dark:text-white"
                autoFocus
              />
            </div>
            <ul className="max-h-48 sm:max-h-56 overflow-y-auto p-1 text-xs">
              {filtered.length === 0 ? (
                <li className="px-3 py-5 text-center text-slate-400">
                  <Building2 className="w-5 h-5 mx-auto mb-1 text-slate-300 dark:text-slate-600" />
                  No suppliers found
                </li>
              ) : (
                filtered.map(s => (
                  <li
                    key={s.id}
                    onMouseDown={() => { onChange(s); setOpen(false); setSearch(''); }}
                    className={`px-3 py-2 rounded-lg cursor-pointer flex items-center justify-between gap-2 transition-colors ${
                      value?.id === s.id
                        ? 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 font-semibold'
                        : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <div className="truncate pr-1 flex-1">
                      <div className="truncate font-medium">{s.name}</div>
                      {s.gstin && (
                        <div className="text-[10px] text-slate-400 dark:text-slate-500 font-mono truncate">GST: {s.gstin}</div>
                      )}
                    </div>
                    {s.phone && <span className="text-[10px] sm:text-[11px] text-slate-400 shrink-0">{s.phone}</span>}
                  </li>
                ))
              )}
            </ul>
          </div>
        )}
      </div>

      <Button 
        type="button" 
        onClick={onAddNew} 
        title="Quick Add New Supplier"
        className="bg-indigo-600 hover:bg-indigo-700 text-white shrink-0 px-2.5 h-9 rounded-xl shadow-xs transition-colors"
      >
        <Plus className="w-4 h-4" />
      </Button>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   Searchable Raw Material Select Component (Responsive with Badges)
   ───────────────────────────────────────────────────────────────────────────── */
const RawMaterialSelect = React.forwardRef(function RawMaterialSelect(
  { rawMaterials, value, onChange, error, lowStockIds = new Set() },
  ref
) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef(null);
  const searchRef = useRef(null);

  React.useImperativeHandle(ref, () => ({
    openDropdown: () => {
      setOpen(true);
      setTimeout(() => {
        containerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        searchRef.current?.focus();
      }, 50);
    },
    closeDropdown: () => setOpen(false),
    focusSearch: () => searchRef.current?.focus(),
  }));

  const filtered = rawMaterials.filter(rm => {
    const q = search.toLowerCase().trim();
    if (!q) return true;
    const nameMatch = (rm.name || '').toLowerCase().includes(q);
    const codeMatch = (rm.code || '').toLowerCase().includes(q);
    const catName = rm.category?.name || (typeof rm.category === 'string' ? rm.category : '') || '';
    const catMatch = catName.toLowerCase().includes(q);
    const uomVal = (rm.unitId || rm.consumptionUnit || '').toLowerCase();
    const uomMatch = uomVal.includes(q);
    const descMatch = (rm.description || '').toLowerCase().includes(q);
    return nameMatch || codeMatch || catMatch || uomMatch || descMatch;
  });

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

  const selectedCategoryName = value ? (value.category?.name || (typeof value.category === 'string' ? value.category : '')) : '';
  const selectedUomLabel = value ? (value.unitId || value.consumptionUnit || 'units').toUpperCase() : '';

  return (
    <div ref={containerRef} className="relative w-full">
      <button
        type="button"
        onClick={() => setOpen(prev => !prev)}
        className={`w-full px-2.5 sm:px-3.5 h-10 border rounded-xl text-left flex items-center justify-between transition-all duration-150 shadow-xs ${
          open 
            ? 'bg-indigo-50/70 border-indigo-500 ring-2 ring-indigo-500/15 dark:bg-indigo-950/40 dark:border-indigo-500' 
            : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 hover:border-indigo-400 dark:hover:border-indigo-500'
        } ${error ? 'border-rose-400 ring-2 ring-rose-500/20 bg-rose-50/30' : ''}`}
      >
        <div className="flex items-center gap-2 truncate min-w-0 flex-1">
          <div className="p-1 bg-indigo-50 dark:bg-indigo-950/60 rounded-md text-indigo-600 dark:text-indigo-400 shrink-0">
            <Package className="w-3.5 h-3.5" />
          </div>

          {value ? (
            <div className="flex items-center gap-1.5 sm:gap-2 truncate flex-wrap">
              <span className="font-semibold text-slate-900 dark:text-white text-xs truncate">
                {value.code} — {value.name}
              </span>
              {selectedCategoryName && (
                <span className="inline-flex items-center px-1.5 sm:px-2 py-0.5 rounded text-[10px] font-semibold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800/60 shrink-0">
                  <Tag className="w-2.5 h-2.5 mr-0.5 sm:mr-1 opacity-70" />
                  {selectedCategoryName}
                </span>
              )}
              {selectedUomLabel && (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold font-mono bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/60 shrink-0">
                  <Scale className="w-2.5 h-2.5 mr-0.5 sm:mr-1 opacity-70" />
                  {selectedUomLabel}
                </span>
              )}
            </div>
          ) : (
            <span className="text-slate-400 dark:text-slate-500 text-xs truncate font-medium">
              Click to select Raw Material (search by Name, Code, Category, or UOM)...
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0 ml-1.5">
          {value && (
            <span
              onMouseDown={handleClear}
              className="text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/50 cursor-pointer p-0.5 rounded transition-colors"
              title="Clear selection"
            >
              <X className="w-3.5 h-3.5" />
            </span>
          )}
          <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${open ? 'rotate-180 text-indigo-500' : ''}`} />
        </div>
      </button>

      {open && (
        <div className="absolute z-50 mt-1.5 left-0 right-0 w-full max-w-[calc(100vw-1.5rem)] sm:max-w-none bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl overflow-hidden animate-in fade-in-50 zoom-in-95 duration-150 ring-1 ring-black/5 dark:ring-white/5">
          <div className="p-2 border-b border-slate-100 dark:border-slate-800 relative bg-slate-50/70 dark:bg-slate-950/70">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              ref={searchRef}
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Type to search by RM Name, Code, Category, or UOM..."
              className="w-full pl-8 pr-7 py-1.5 text-xs border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-slate-900 dark:text-white"
            />
            {search && (
              <button
                type="button"
                onMouseDown={() => setSearch('')}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 rounded"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          <ul className="max-h-56 sm:max-h-64 overflow-y-auto p-1.5 space-y-1">
            {filtered.length === 0 ? (
              <li className="px-3 py-6 text-xs text-slate-400 flex flex-col items-center justify-center">
                <Search className="w-5 h-5 text-slate-300 dark:text-slate-600 mb-1" />
                <span className="font-medium">No raw materials matched "{search}"</span>
                <span className="text-[10px] text-slate-400 mt-0.5">Try searching by code, category name, or unit</span>
              </li>
            ) : (
              filtered.map(rm => {
                const isLow = lowStockIds.has(rm.id);
                const categoryName = rm.category?.name || (typeof rm.category === 'string' ? rm.category : '') || 'General';
                const uomLabel = (rm.unitId || rm.consumptionUnit || 'units').toUpperCase();

                return (
                  <li
                    key={rm.id}
                    onMouseDown={() => handleSelect(rm)}
                    className={`px-2.5 sm:px-3 py-2 text-xs cursor-pointer rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 sm:gap-3 transition-colors ${
                      value?.id === rm.id
                        ? 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 ring-1 ring-indigo-200 dark:ring-indigo-800'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100/90 dark:hover:bg-slate-800/80'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      {isLow ? (
                        <div className="relative flex h-2.5 w-2.5 shrink-0">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
                        </div>
                      ) : (
                        <div className="h-1.5 w-1.5 rounded-full bg-slate-300 dark:bg-slate-600 shrink-0"></div>
                      )}
                      
                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`font-semibold text-xs truncate ${isLow ? 'text-rose-700 dark:text-rose-400' : 'text-slate-900 dark:text-slate-100'}`}>
                            {rm.name}
                          </span>
                          {isLow && (
                            <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.2 rounded-full bg-rose-100 text-rose-700 dark:bg-rose-950/80 dark:text-rose-400 font-bold border border-rose-200 dark:border-rose-800 shrink-0">
                              Low Stock
                            </span>
                          )}
                        </div>
                        {rm.description && rm.description !== rm.name && (
                          <span className="text-[10px] text-slate-400 dark:text-slate-500 truncate">
                            {rm.description}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Metadata Badges: Category, UOM & Code */}
                    <div className="flex items-center gap-1.5 shrink-0 flex-wrap sm:flex-nowrap pl-4 sm:pl-0">
                      {/* Category Badge */}
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800/60">
                        <Tag className="w-2.5 h-2.5 mr-1 opacity-70" />
                        {categoryName}
                      </span>

                      {/* UOM Badge */}
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/60 font-mono">
                        <Scale className="w-2.5 h-2.5 mr-1 opacity-70" />
                        {uomLabel}
                      </span>

                      {/* RM Code */}
                      <span className="text-[10px] font-mono font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                        {rm.code}
                      </span>

                      {rm.ratePerUnit ? (
                        <span className="text-[10px] font-medium text-slate-600 dark:text-slate-300 ml-1">
                          ₹{Number(rm.ratePerUnit).toFixed(2)}
                        </span>
                      ) : null}
                    </div>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
    </div>
  );
});

/* ─────────────────────────────────────────────────────────────────────────────
   Main CreatePOPage Component
   Fully Responsive for All Screen Sizes: Mobile, Tablet, Laptop, and 4K Displays
   ───────────────────────────────────────────────────────────────────────────── */
export default function CreatePOPage({ onBack }) {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const rmSelectRef = useRef(null);

  const handleBack = () => {
    if (onBack) onBack();
    else navigate(location.state?.from || '/purchase-orders');
  };

  const [formData, setFormData] = useState({
    selectedRm: null,
    selectedSupplier: null,
    purchaseStatus: 'Pending',
    paymentStatus: 'Pending',
    expectedDelivery: null,
    discount: '0',
    shipping: '0',
    otherCharges: '0',
    notes: '',
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
        otherCharges: String(q.otherCharges || 0),
      }));

      if (q.items && Array.isArray(q.items)) {
        const prefilled = q.items.map(it => ({
          id: it.materialId || Math.random().toString(),
          rmId: it.materialCode || 'RM-ITEM',
          name: it.materialName || 'Raw Material',
          category: it.category || 'General',
          quantity: Number(it.quantity) || 1,
          unitPrice: Number(it.unitPrice) || 0,
          uomLabel: (it.unit || 'units').toUpperCase(),
          uomId: '',
          gstApplicable: it.gstApplicable ?? true,
          gstPercentage: Number(it.gstRate) || 18,
        }));
        setItems(prefilled);
      }
    }
  }, [location.state]);

  const { data: poRefData, isFetching: isRotatingPo } = useQuery({
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
    },
  });

  // Fetch Raw Materials from Item Setup
  const { data: rawMaterials = [], isLoading: isLoadingRMs } = useQuery({
    queryKey: ['raw-materials-setup'],
    queryFn: async () => {
      const response = await api.get('/item-setup/raw-material');
      return response.data;
    },
  });

  // Fetch RM Stock to identify low-stock items
  const { data: rmStock = [] } = useQuery({
    queryKey: ['rm-stock'],
    queryFn: async () => {
      const res = await api.get('/rm-stock');
      return res.data;
    },
  });

  // Build set of raw material IDs that are at or below alert level
  const lowStockIds = new Set(
    rmStock.filter(s => s.alertLevel != null && Number(s.availableQuantity) <= Number(s.alertLevel)).map(s => s.id)
  );
  const lowStockCount = lowStockIds.size;

  // Fetch all UOMs as fallback
  const { data: allUoms = [] } = useQuery({
    queryKey: ['uoms'],
    queryFn: async () => {
      const response = await api.get('/uom');
      return response.data;
    },
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
      (u.abbreviation || '').toLowerCase() === normalized ||
      (u.name || '').toLowerCase() === normalized
    );
    if (exactMatch) return exactMatch;

    const containsMatch = allUoms.find(u =>
      (u.abbreviation || '').toLowerCase().includes(normalized) ||
      (u.name || '').toLowerCase().includes(normalized) ||
      normalized.includes((u.abbreviation || '').toLowerCase()) ||
      normalized.includes((u.name || '').toLowerCase())
    );
    return containsMatch || null;
  };

  const handleAddRmItem = (rm) => {
    if (!rm) return;
    const exists = items.some(item => item.id === rm.id);
    if (exists) {
      Swal.fire({
        icon: 'info',
        title: 'Item Already in List',
        text: `${rm.name} is already added. You can update its quantity directly in the table.`,
        confirmButtonColor: '#4f46e5',
      });
      return;
    }
    
    const defaultUom = getDefaultUomForRawMaterial(rm);
    const uomLabel = (defaultUom ? defaultUom.abbreviation : (rm.unitId || rm.consumptionUnit || 'units')).toUpperCase();
    const uomId = defaultUom ? defaultUom.id : '';
    const categoryName = rm.category?.name || (typeof rm.category === 'string' ? rm.category : '') || 'General';

    const newItem = {
      id: rm.id,
      rmId: rm.code,
      name: rm.name,
      category: categoryName,
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

  // Stepper function for - and + button
  const stepQuantity = (id, delta) => {
    setItems(prev => prev.map(it => {
      if (it.id !== id) return it;
      const current = parseFloat(it.quantity) || 0;
      const updated = Math.max(1, Math.round((current + delta) * 1000) / 1000);
      return { ...it, quantity: updated };
    }));
  };

  // Helper to open Raw Material Dropdown from action buttons
  const triggerAddRmDropdown = () => {
    rmSelectRef.current?.openDropdown();
  };

  // Financial calculations
  const subtotal = items.reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.unitPrice || 0), 0);
  const shipping = Number(formData.shipping || 0);
  const discount = Number(formData.discount || 0);
  const otherCharges = Number(formData.otherCharges || 0);

  // Check supplier state code (prefix 33 = Tamil Nadu)
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
  const grandTotal = Math.max(0, subtotal + totalItemTax + shipping + otherCharges - discount);

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const response = await api.post('/rm/po', data);
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['pos'] });
      Swal.fire({
        icon: 'success',
        title: 'Purchase Order Created!',
        text: `Order Reference: ${data.referenceNo || data.id}`,
        confirmButtonColor: '#4f46e5',
      }).then(() => {
        navigate('/purchase-orders', { replace: true });
      });
    },
    onError: (err) => {
      setErrorMsg(err.response?.data?.error || 'Failed to create Purchase Order');
    },
  });

  const handleSubmit = (e) => {
    if (e) e.preventDefault();
    setErrorMsg('');

    if (items.length === 0) {
      setErrorMsg('Please add at least one raw material item.');
      triggerAddRmDropdown();
      return;
    }
    if (!formData.expectedDelivery) {
      setErrorMsg('Expected Delivery Date is required.');
      return;
    }
    if (!formData.selectedSupplier) {
      setErrorMsg('Please select a Supplier.');
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
      notes: formData.notes || null,
    });
  };

  return (
    <div className="w-full max-w-[1720px] mx-auto px-2 sm:px-4 lg:px-6 py-2.5 space-y-3">
      
      {/* ───────────────────────────────────────────────────────────────────
          Top Header Bar: Responsive for Mobile, Tablet & Desktop
          ─────────────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl px-3 sm:px-4 py-2.5 shadow-xs">
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={handleBack} 
            className="h-8 w-8 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 border border-slate-200 dark:border-slate-800 shrink-0"
            title="Go back"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>

          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-base sm:text-lg font-bold tracking-tight text-slate-900 dark:text-white truncate">
                Create Purchase Order
              </h1>
              <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200/70 dark:border-indigo-800/60 shrink-0">
                {isRotatingPo ? <Loader2 className="w-3 h-3 animate-spin inline" /> : (poRefData?.candidateId || 'NEW PO')}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 truncate hidden sm:block">
              Procure raw materials from certified suppliers with live tax & total computation
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 w-full sm:w-auto shrink-0">
          {lowStockCount > 0 && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 rounded-xl text-rose-700 dark:text-rose-300 text-xs font-semibold shrink-0">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
              </span>
              <span>{lowStockCount} Low Stock</span>
            </div>
          )}

          <Button 
            type="button" 
            variant="outline" 
            size="sm" 
            onClick={handleBack}
            className="flex-1 sm:flex-none h-8 px-3 text-xs font-semibold text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 rounded-xl"
          >
            Cancel
          </Button>

          <Button 
            type="button" 
            size="sm" 
            onClick={handleSubmit}
            disabled={createMutation.isPending}
            className="flex-1 sm:flex-none bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-8 px-4 rounded-xl text-xs shadow-sm shadow-indigo-600/20 gap-1.5 transition-all"
          >
            {createMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
            {createMutation.isPending ? 'Saving...' : 'Confirm Order'}
          </Button>
        </div>
      </div>

      {/* Error alert if any */}
      {errorMsg && (
        <div className="p-3 bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400 rounded-xl text-xs font-medium border border-rose-200 dark:border-rose-800/60 flex items-center justify-between shadow-xs animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500" />
            <span>{errorMsg}</span>
          </div>
          <button type="button" onClick={() => setErrorMsg('')} className="p-0.5 hover:bg-rose-100 dark:hover:bg-rose-900/50 rounded">
            <X className="w-3.5 h-3.5" />
          </button>
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

      {/* ───────────────────────────────────────────────────────────────────
          Dense 2-Column ERP Workspace: Left (Details & Items) | Right (Summary)
          Responsive grid: 1 column on Mobile/Tablet (< 1024px), 2 columns on Laptop/Desktop (>= 1024px)
          ─────────────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-start">
        
        {/* ═══ LEFT COLUMN (8 cols on XL, 7 cols on LG): General Details & Items Table ═══ */}
        <div className="lg:col-span-7 xl:col-span-8 space-y-3">
          
          {/* Card 1: General & Supplier Details */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-3 sm:p-3.5 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-1 mb-2.5 pb-1.5 border-b border-slate-100 dark:border-slate-800">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-indigo-500" />
                1. Order Information
              </span>
              {formData.selectedSupplier?.gstin && (
                <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  Tax: <strong className={isInterState ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}>
                    {isInterState ? 'IGST (Interstate)' : 'CGST+SGST (Intrastate)'}
                  </strong>
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3 items-start">
              {/* Expected Delivery Date */}
              <div className="space-y-1">
                <Label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                  Expected Delivery <span className="text-rose-500">*</span>
                </Label>
                <DatePicker
                  value={formData.expectedDelivery}
                  onChange={(date) => setFormData({ ...formData, expectedDelivery: date })}
                  disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                  modalTitle="Expected Delivery"
                  placeholder="Select Date..."
                  triggerClassName="h-9 text-xs rounded-xl border-slate-300 dark:border-slate-700"
                />
              </div>

              {/* Purchase Status */}
              <div className="space-y-1">
                <Label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                  Purchase Status <span className="text-rose-500">*</span>
                </Label>
                <div className="relative">
                  <select 
                    value={formData.purchaseStatus}
                    onChange={(e) => setFormData({ ...formData, purchaseStatus: e.target.value })}
                    className="w-full h-9 px-3 py-1.5 text-xs border rounded-xl bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-slate-800 dark:text-slate-200 font-medium cursor-pointer appearance-none shadow-xs"
                  >
                    <option value="Pending">Pending</option>
                    <option value="Ordered">Ordered</option>
                    <option value="Received">Received</option>
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                </div>
              </div>

              {/* Supplier Select */}
              <div className="space-y-1">
                <Label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                  Supplier <span className="text-rose-500">*</span>
                </Label>
                <SupplierSelect 
                  suppliers={suppliers} 
                  value={formData.selectedSupplier} 
                  onChange={(s) => setFormData({ ...formData, selectedSupplier: s })} 
                  onAddNew={() => setShowAddSupplier(true)}
                />
              </div>
            </div>

            {/* Supplier Details Horizontal Bar */}
            {formData.selectedSupplier && (
              <div className="mt-2.5 pt-2 border-t border-dashed border-slate-150 dark:border-slate-800 flex flex-wrap items-center gap-x-3 sm:gap-x-4 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400">
                <div className="flex items-center gap-1">
                  <span className="font-semibold text-slate-700 dark:text-slate-300">Phone:</span>
                  <span>{formData.selectedSupplier.phone || 'N/A'}</span>
                </div>
                <span className="text-slate-300 dark:text-slate-700 hidden sm:inline">•</span>
                <div className="flex items-center gap-1">
                  <span className="font-semibold text-slate-700 dark:text-slate-300">GSTIN:</span>
                  <span className="font-mono font-medium text-indigo-600 dark:text-indigo-400">{formData.selectedSupplier.gstin || 'N/A'}</span>
                </div>
                <span className="text-slate-300 dark:text-slate-700 hidden sm:inline">•</span>
                <div className="flex items-center gap-1">
                  <span className="font-semibold text-slate-700 dark:text-slate-300">PAN:</span>
                  <span className="font-mono">{formData.selectedSupplier.pan || 'N/A'}</span>
                </div>
                {formData.selectedSupplier.address && (
                  <>
                    <span className="text-slate-300 dark:text-slate-700 hidden sm:inline">•</span>
                    <div className="flex items-center gap-1 truncate max-w-full sm:max-w-xs">
                      <span className="font-semibold text-slate-700 dark:text-slate-300">Address:</span>
                      <span className="truncate">{formData.selectedSupplier.address}</span>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Card 2: Order Items & Raw Material Picker */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-3 sm:p-3.5 shadow-xs space-y-3">
            
            {/* Raw Material Select Bar */}
            {isFromQuotation ? (
              <div className="flex items-center gap-2 p-2.5 bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800/60 rounded-xl text-purple-700 dark:text-purple-300 text-xs">
                <CheckCircle2 className="w-4 h-4 text-purple-500 shrink-0" />
                <span>
                  <strong>Locked from RM Quotation:</strong> Items and pricing were prefilled from {location.state.prefillFromQuotation.referenceNo || 'quotation'}.
                </span>
              </div>
            ) : (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Package className="w-3.5 h-3.5 text-indigo-500" />
                    2. Select Raw Material to Add <span className="text-rose-500">*</span>
                  </Label>
                  <span className="text-[11px] text-slate-400 hidden sm:inline">
                    Shows Category & UOM for every RM
                  </span>
                </div>

                {isLoadingRMs ? (
                  <div className="w-full h-10 px-3 border rounded-xl text-slate-400 border-slate-300 dark:border-slate-700 flex items-center bg-white dark:bg-slate-900 text-xs">
                    <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin text-indigo-500" /> Loading raw materials catalog...
                  </div>
                ) : (
                  <RawMaterialSelect 
                    ref={rmSelectRef}
                    rawMaterials={rawMaterials}
                    value={formData.selectedRm}
                    onChange={handleAddRmItem} 
                    lowStockIds={lowStockIds}
                  />
                )}
              </div>
            )}

            {/* Order Items Table Header with direct "+ Add Item" Action */}
            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Added Materials ({items.length})
                </span>
                {items.length > 0 && (
                  <Badge variant="secondary" className="text-[10px] font-bold px-1.5 py-0 h-4 bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
                    {items.length} Item{items.length > 1 ? 's' : ''}
                  </Badge>
                )}
              </div>

              {!isFromQuotation && items.length > 0 && (
                <Button
                  type="button"
                  size="sm"
                  onClick={triggerAddRmDropdown}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold gap-1 shadow-xs h-7 px-2.5 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Item
                </Button>
              )}
            </div>

            {/* Items Table Container: Responsive, Scrollable after 3 items with sticky header */}
            <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs flex flex-col">
              
              {/* Inner scroll container: exactly ~3 items fit (~210px), then scrolls smoothly */}
              <div className="overflow-x-auto overflow-y-auto max-h-[210px] scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-700">
                <table className="w-full min-w-[620px] text-xs text-left border-collapse">
                  <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800 font-bold uppercase tracking-wider text-[10px] shadow-2xs">
                    <tr>
                      <th className="px-3 py-2 w-8 text-center bg-slate-50 dark:bg-slate-800">#</th>
                      <th className="px-3 py-2 bg-slate-50 dark:bg-slate-800">Material / Category / UOM</th>
                      <th className="px-3 py-2 text-center w-36 bg-slate-50 dark:bg-slate-800">Quantity</th>
                      <th className="px-3 py-2 text-right w-28 bg-slate-50 dark:bg-slate-800">Unit Price (₹)</th>
                      <th className="px-3 py-2 text-center w-24 bg-slate-50 dark:bg-slate-800">Tax Status</th>
                      <th className="px-3 py-2 text-center w-20 bg-slate-50 dark:bg-slate-800">GST %</th>
                      <th className="px-3 py-2 text-right w-28 bg-slate-50 dark:bg-slate-800">Subtotal (₹)</th>
                      <th className="px-3 py-2 text-center w-20 bg-slate-50 dark:bg-slate-800">
                        <span>Action</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                    {items.length > 0 ? (
                      items.map((item, index) => {
                        const itemSubtotal = Number(item.quantity || 0) * Number(item.unitPrice || 0);
                        return (
                          <tr key={item.id || index} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                            <td className="px-3 py-2 text-center text-slate-400 font-medium">{index + 1}</td>
                            
                            <td className="px-3 py-2">
                              <div className="font-semibold text-slate-900 dark:text-slate-100 text-xs">{item.name}</div>
                              <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                <span className="font-mono text-[10px] text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.2 rounded border border-slate-200 dark:border-slate-700">
                                  {item.rmId}
                                </span>
                                {item.category && (
                                  <span className="inline-flex items-center text-[10px] font-semibold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/50 px-1.5 py-0.2 rounded border border-indigo-200/70 dark:border-indigo-800/50">
                                    <Tag className="w-2 h-2 mr-0.5 opacity-70" />
                                    {item.category}
                                  </span>
                                )}
                                <span className="inline-flex items-center text-[10px] font-bold font-mono text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 px-1.5 py-0.2 rounded border border-emerald-200/70 dark:border-emerald-800/50">
                                  <Scale className="w-2 h-2 mr-0.5 opacity-70" />
                                  {item.uomLabel}
                                </span>
                                {lowStockIds.has(item.id) && (
                                  <Badge variant="outline" className="text-[9px] bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-950/60 dark:text-rose-400 dark:border-rose-800/60 px-1 py-0">
                                    Low
                                  </Badge>
                                )}
                              </div>
                            </td>

                            {/* Quantity with Stylish [-] Value [+] Stepper Controls */}
                            <td className="px-3 py-2 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                <div className="inline-flex items-center border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50/70 dark:bg-slate-900/70 p-0.5 shadow-2xs">
                                  <button
                                    type="button"
                                    onClick={() => stepQuantity(item.id, -1)}
                                    disabled={Number(item.quantity) <= 1}
                                    className="w-5 h-5 flex items-center justify-center rounded bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-indigo-950/60 dark:hover:text-indigo-400 border border-slate-200/80 dark:border-slate-700 transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs cursor-pointer select-none"
                                    title="Decrease quantity"
                                  >
                                    <Minus className="w-2.5 h-2.5" />
                                  </button>
                                  <Input 
                                    type="number" 
                                    step="any" 
                                    min="0.001"
                                    value={item.quantity} 
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setItems(prev => prev.map(it => it.id === item.id ? { ...it, quantity: val } : it));
                                    }} 
                                    className="w-12 text-center h-5 border-0 bg-transparent p-0 font-bold text-xs focus-visible:ring-0 focus:outline-none text-slate-900 dark:text-white" 
                                    required
                                  />
                                  <button
                                    type="button"
                                    onClick={() => stepQuantity(item.id, 1)}
                                    className="w-5 h-5 flex items-center justify-center rounded bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-indigo-950/60 dark:hover:text-indigo-400 border border-slate-200/80 dark:border-slate-700 transition-all active:scale-95 shadow-2xs cursor-pointer select-none"
                                    title="Increase quantity"
                                  >
                                    <Plus className="w-2.5 h-2.5" />
                                  </button>
                                </div>
                                <span className="text-slate-400 font-mono text-[10px] font-semibold shrink-0 w-7 text-left">
                                  {item.uomLabel}
                                </span>
                              </div>
                            </td>

                            {/* Unit Price */}
                            <td className="px-3 py-2 text-right">
                              <div className="relative inline-flex items-center ml-auto">
                                <span className="absolute left-2 text-[10px] font-bold text-slate-400">₹</span>
                                <Input 
                                  type="number" 
                                  step="0.01" 
                                  min="0"
                                  value={item.unitPrice} 
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setItems(prev => prev.map(it => it.id === item.id ? { ...it, unitPrice: val } : it));
                                  }} 
                                  className="w-20 pl-4 pr-1.5 text-right h-7 rounded-lg border-slate-200 dark:border-slate-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 bg-slate-50/50 dark:bg-slate-900/50 font-semibold text-xs" 
                                  required
                                />
                              </div>
                            </td>

                            {/* GST Status Toggle */}
                            <td className="px-3 py-2 text-center">
                              <button
                                type="button"
                                onClick={() => {
                                  setItems(prev => prev.map(it => it.id === item.id ? { ...it, gstApplicable: !it.gstApplicable } : it));
                                }}
                                className={twMerge(
                                  "h-7 px-2 text-[10px] font-bold rounded-lg transition-colors border shadow-2xs",
                                  item.gstApplicable 
                                    ? "bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800" 
                                    : "bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700"
                                )}
                              >
                                {item.gstApplicable ? 'GST (Yes)' : 'Zero Tax'}
                              </button>
                            </td>

                            {/* GST % */}
                            <td className="px-3 py-2 text-center">
                              <select
                                disabled={!item.gstApplicable}
                                value={item.gstPercentage}
                                onChange={(e) => {
                                  const val = Number(e.target.value);
                                  setItems(prev => prev.map(it => it.id === item.id ? { ...it, gstPercentage: val } : it));
                                }}
                                className="h-7 px-1.5 text-xs border rounded-lg bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-700 dark:text-slate-200 font-bold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed w-16 mx-auto block"
                              >
                                <option value={0}>0%</option>
                                <option value={5}>5%</option>
                                <option value={12}>12%</option>
                                <option value={18}>18%</option>
                                <option value={28}>28%</option>
                              </select>
                            </td>

                            {/* Subtotal */}
                            <td className="px-3 py-2 text-right font-bold text-slate-900 dark:text-white">
                              ₹{itemSubtotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>

                            {/* Action Button: Remove Item Only */}
                            <td className="px-3 py-2 text-center">
                              {isFromQuotation ? (
                                <span className="text-[10px] font-bold text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/60 px-1.5 py-0.5 rounded border border-purple-200 dark:border-purple-800">
                                  Quoted
                                </span>
                              ) : (
                                <button 
                                  type="button" 
                                  onClick={() => setItems(prev => prev.filter(it => it.id !== item.id))} 
                                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/60 rounded-md transition-colors"
                                  title="Remove item"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={8} className="px-3 py-8 text-center">
                          <div className="flex flex-col items-center justify-center text-slate-400 dark:text-slate-500">
                            <Package className="w-8 h-8 text-slate-300 dark:text-slate-600 mb-1.5" />
                            <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">No Raw Materials Added Yet</p>
                            <p className="text-[11px] text-slate-400 mt-0.5">
                              Use the selector above or click "Add Item" to add your first raw material.
                            </p>
                            <Button
                              type="button"
                              size="sm"
                              onClick={triggerAddRmDropdown}
                              className="mt-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold gap-1 h-7 px-3 shadow-xs"
                            >
                              <Plus className="w-3.5 h-3.5" /> Add First Item
                            </Button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Docked Table Footer: Always pinned outside the scroll container */}
              {!isFromQuotation && items.length > 0 && (
                <div className="bg-slate-50/90 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800 px-3 py-2 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={triggerAddRmDropdown}
                    className="h-7 px-2 text-xs font-bold text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-950/50 gap-1 rounded-lg w-fit"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Another Item
                  </Button>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    Items Subtotal ({items.length} items): <strong className="text-slate-800 dark:text-slate-200 ml-1">₹{subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                  </span>
                </div>
              )}

            </div>
          </div>
        </div>

        {/* ═══ RIGHT COLUMN (4 cols on XL, 5 cols on LG): Additional Charges & Grand Total Summary ═══ */}
        <div className="lg:col-span-5 xl:col-span-4 space-y-3 lg:sticky lg:top-3">
          
          {/* Card 3: Additional Charges & Taxes */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-3 sm:p-3.5 shadow-xs space-y-3">
            <div className="flex items-center justify-between pb-1.5 border-b border-slate-100 dark:border-slate-800">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Calculator className="w-3.5 h-3.5 text-indigo-500" />
                3. Charges & Summary
              </span>
              <span className="text-[11px] font-mono text-slate-400">
                INR (₹)
              </span>
            </div>

            {/* Additional Charges 2x2 Grid */}
            <div className="grid grid-cols-2 gap-2 sm:gap-2.5">
              <div className="space-y-1">
                <Label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">Discount (₹)</Label>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-medium">₹</span>
                  <Input 
                    type="number" 
                    min="0"
                    value={formData.discount} 
                    onChange={(e) => setFormData({ ...formData, discount: e.target.value })}
                    className="h-8 text-xs pl-6 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700" 
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">Shipping (₹)</Label>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-medium">₹</span>
                  <Input 
                    type="number" 
                    min="0"
                    value={formData.shipping} 
                    onChange={(e) => setFormData({ ...formData, shipping: e.target.value })}
                    className="h-8 text-xs pl-6 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700" 
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">Other Charges (₹)</Label>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-medium">₹</span>
                  <Input 
                    type="number" 
                    min="0"
                    value={formData.otherCharges} 
                    onChange={(e) => setFormData({ ...formData, otherCharges: e.target.value })}
                    className="h-8 text-xs pl-6 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700" 
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">Payment Status</Label>
                <div className="relative">
                  <select 
                    value={formData.paymentStatus}
                    onChange={(e) => setFormData({ ...formData, paymentStatus: e.target.value })}
                    className="w-full h-8 px-2.5 py-1 text-xs border rounded-lg bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-slate-700 dark:text-slate-200 font-medium cursor-pointer appearance-none"
                  >
                    <option value="Pending">Pending</option>
                    <option value="Due">Due</option>
                    <option value="Partial">Partial</option>
                    <option value="Paid">Paid</option>
                  </select>
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                </div>
              </div>
            </div>

            {/* Note / Special Instructions */}
            <div className="space-y-1">
              <Label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">Note / Instructions</Label>
              <textarea 
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={2}
                className="w-full border rounded-xl p-2 text-xs bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 resize-none shadow-xs" 
                placeholder="Supplier instructions, delivery location remarks..."
              />
            </div>

            {/* Real-Time Total Calculations Breakdown */}
            <div className="p-3 bg-slate-50 dark:bg-slate-950/60 rounded-xl border border-slate-200/80 dark:border-slate-800 space-y-2 text-xs">
              <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
                <span>Items Subtotal ({items.length} items)</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  ₹{subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>

              {/* Tax Details */}
              {isInterState ? (
                <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
                  <span>IGST (Interstate)</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    ₹{igstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              ) : (
                <>
                  <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
                    <span>CGST (Intrastate 50%)</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      ₹{cgstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
                    <span>SGST (Intrastate 50%)</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      ₹{sgstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </>
              )}

              {discount > 0 && (
                <div className="flex justify-between items-center text-emerald-600 dark:text-emerald-400">
                  <span>Discount</span>
                  <span className="font-semibold">
                    -₹{discount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              )}

              {(shipping > 0 || otherCharges > 0) && (
                <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
                  <span>Shipping & Other Charges</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    +₹{(shipping + otherCharges).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              )}

              {/* Grand Total Box */}
              <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex justify-between items-baseline gap-2">
                <div>
                  <div className="text-[10px] uppercase tracking-wider font-bold text-slate-500">Grand Total</div>
                  <div className="text-[10px] text-slate-400">Includes all taxes & delivery</div>
                </div>
                <div className="text-xl sm:text-2xl font-black text-indigo-600 dark:text-indigo-400 tracking-tight text-right">
                  ₹{grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
            </div>

            {/* Bottom CTA Button */}
            <Button 
              type="button" 
              onClick={handleSubmit} 
              disabled={createMutation.isPending} 
              className="w-full bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white h-10 sm:h-11 rounded-xl text-xs sm:text-sm font-bold shadow-md shadow-indigo-600/25 transition-all gap-1.5"
            >
              {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              {createMutation.isPending ? 'Submitting Order...' : 'Confirm & Create Order'}
            </Button>
          </div>
        </div>

      </div>
    </div>
  );
}
