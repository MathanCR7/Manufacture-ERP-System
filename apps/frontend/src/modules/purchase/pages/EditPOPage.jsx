import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/axios';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import {
  CalendarIcon,
  ArrowLeft,
  Loader2,
  Search,
  X,
  ChevronDown,
  Plus,
  Minus,
  SaveIcon,
  AlertTriangle,
  CheckCircle2,
  Lock,
  Package,
  Tag,
  Calculator,
  Info,
  Truck,
  Calendar,
  Clock,
  ShieldCheck,
  Building2,
  FileText,
  FlaskConical,
  Scale,
  Trash2,
  GripVertical,
  AlertCircle,
} from 'lucide-react';
import { twMerge } from 'tailwind-merge';
import Swal from 'sweetalert2';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import DatePicker from '@/components/ui/DatePicker';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';

/* ─────────────────────── Inline Add Supplier ─────────────────────── */
import QuickAddSupplierModal from '@/components/forms/QuickAddSupplierModal';
const AddSupplierInline = QuickAddSupplierModal;
import BatchDateInput from '../components/BatchDateInput';

/* ─────────────────────── Searchable Raw Material Dropdown ─────────────────────── */
import RawMaterialSelect from '../components/SearchableItemSelect';

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
          className={`w-full px-2.5 sm:px-3 h-9 border rounded-xl text-left flex items-center justify-between transition-all duration-150 shadow-2xs text-xs ${
            open 
              ? 'bg-indigo-50/70 border-indigo-500 ring-2 ring-indigo-500/15 dark:bg-indigo-950/40 dark:border-indigo-500' 
              : 'bg-slate-50/70 dark:bg-slate-900/90 border-slate-300 dark:border-slate-700 hover:border-indigo-400 dark:hover:border-indigo-500 hover:bg-white'
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
              <li
                onMouseDown={() => { onChange(null); setOpen(false); setSearch(''); }}
                className="px-3 py-1.5 rounded-lg cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 italic text-[11px]"
              >
                — Clear Supplier —
              </li>
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
                    {s.phone && (
                      <span className="text-[10px] text-slate-400 font-mono shrink-0">{s.phone}</span>
                    )}
                  </li>
                ))
              )}
            </ul>
          </div>
        )}
      </div>
      <Button
        type="button"
        size="icon"
        onClick={onAddNew}
        className="h-9 w-9 bg-indigo-600 hover:bg-indigo-700 text-white shrink-0 rounded-xl shadow-xs"
        title="Quick add new supplier"
      >
        <Plus className="w-4 h-4" />
      </Button>
    </div>
  );
}

/* ─────────────────────── Main EditPOPage ─────────────────────── */
export default function EditPOPage({ id: propId, onBack }) {
  const { id: paramId } = useParams();
  const id = propId || paramId;
  const navigate = useNavigate();
  const location = useLocation();
  const handleBack = () => {
    if (onBack) onBack();
    else navigate(location.state?.from || '/purchase-orders');
  };
  const queryClient = useQueryClient();

  const [form, setForm] = useState(null);          // null until PO loaded
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [showAddSupplier, setShowAddSupplier] = useState(false);
  const rawMaterialSelectRef = useRef(null);

  const triggerAddRmDropdown = () => {
    if (rawMaterialSelectRef.current) {
      rawMaterialSelectRef.current.openDropdown();
    }
  };

  /* ── Fetch existing PO ── */
  const { data: po, isLoading: isLoadingPO, error: poError } = useQuery({
    queryKey: ['po-edit', id],
    queryFn: async () => {
      const res = await api.get(`/rm/po/${id}`);
      return res.data;
    },
  });

  /* ── Raw materials list ── */
  const { data: rawMaterials = [], isLoading: isLoadingRMs } = useQuery({
    queryKey: ['raw-materials-setup'],
    queryFn: async () => (await api.get('/item-setup/raw-material')).data,
  });

  /* ── Non-inventory items list ── */
  const { data: nonInventoryItems = [], isLoading: isLoadingNonInv } = useQuery({
    queryKey: ['non-inventory-items-setup'],
    queryFn: async () => {
      const response = await api.get('/item-setup/non-inventory-item');
      return response.data || [];
    },
  });

  const { data: rmStock = [] } = useQuery({
    queryKey: ['rm-stock'],
    queryFn: async () => (await api.get('/rm-stock')).data,
  });

  const lowStockIds = useMemo(() => {
    return new Set(
      rmStock.filter(s => s.alertLevel != null && Number(s.availableQuantity) <= Number(s.alertLevel)).map(s => s.id)
    );
  }, [rmStock]);

  /* ── UOM list ── */
  const { data: allUoms = [] } = useQuery({
    queryKey: ['uoms'],
    queryFn: async () => (await api.get('/uom')).data,
  });

  /* ── Unified Purchasable Items Catalog ── */
  const purchasableItems = useMemo(() => {
    const stockMap = new Map();
    (rmStock || []).forEach(s => {
      stockMap.set(s.id, Number(s.availableQuantity || 0));
    });

    const rmList = (rawMaterials || []).map(rm => ({
      ...rm,
      itemType: 'RAW_MATERIAL',
      itemTypeLabel: 'Raw Material',
      categoryName: rm.category?.name || (typeof rm.category === 'string' ? rm.category : '') || 'General',
      displayUom: rm.unitId || rm.consumptionUnit || 'units',
      isLowStock: lowStockIds.has(rm.id),
      currentStock: stockMap.has(rm.id) ? stockMap.get(rm.id) : (Number(rm.currentStock) || 0),
    }));

    const nonInvList = (nonInventoryItems || []).map(ni => ({
      ...ni,
      itemType: 'NON_INVENTORY',
      itemTypeLabel: 'Non-Inventory',
      categoryName: ni.category || 'Non-Inventory',
      displayUom: ni.unitId || 'pcs',
      isLowStock: false,
      currentStock: null,
    }));

    return [...rmList, ...nonInvList];
  }, [rawMaterials, nonInventoryItems, lowStockIds, rmStock]);

  const getInitBatch = (name) => {
    const clean = (name || 'RM').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
    return `BATCH-${clean || 'RM'}-001`;
  };

  /* ── Initialise form once PO is loaded ── */
  useEffect(() => {
    if (!po) return;
    let initialItems = po.items;
    if (!initialItems || !Array.isArray(initialItems) || initialItems.length === 0) {
      const q = Number(po.quantity || 0);
      const sub = Number(po.subtotal && Number(po.subtotal) > 0 ? po.subtotal : (po.amount || 0));
      const initialBatchMfg = po.mfgDate ? (typeof po.mfgDate === 'string' && po.mfgDate.includes('T') ? po.mfgDate.split('T')[0] : po.mfgDate) : '';
      const initialBatchExp = po.expDate ? (typeof po.expDate === 'string' && po.expDate.includes('T') ? po.expDate.split('T')[0] : (po.expiryDate ? (typeof po.expiryDate === 'string' && po.expiryDate.includes('T') ? po.expiryDate.split('T')[0] : po.expiryDate) : '')) : '';
      const initialBatchQty = po.batchQuantity ? parseFloat(po.batchQuantity) : q;
      const baseBatch = (po.baseBatchNumber || po.batchNumber || getInitBatch(po.name)).replace(/-[A-Z]$/, '');
      initialItems = [{
        id: po.rmId || 'item-1',
        rmId: po.rmId || '',
        name: po.name || '',
        quantity: q,
        unitPrice: unitP,
        subtotal: Math.round(sub * 100) / 100,
        weight: po.weight || '',
        mfgBatchNo: po.mfgBatchNo || '',
        mfgDate: initialBatchMfg,
        expDate: initialBatchExp,
        batchQuantity: initialBatchQty,
        baseBatchNumber: baseBatch,
        batchNumber: baseBatch,
        batches: [
          {
            id: 'batch-' + (po.rmId || '1') + '-1',
            batchNumber: baseBatch,
            quantity: initialBatchQty,
            batchQuantity: initialBatchQty,
            weight: po.weight || '',
            mfgBatchNo: po.mfgBatchNo || '',
            mfgDate: initialBatchMfg,
            expDate: initialBatchExp,
          }
        ],
        uomLabel: po.uom ? po.uom.abbreviation : 'units',
        uomId: po.uomId || '',
        gstApplicable: false,
        gstPercentage: 0,
        labTestRequired: true,
      }];
    } else {
      initialItems = initialItems.map((it, idx) => {
        const q = Number(it.quantity || 0);
        const p = Number(it.unitPrice || 0);
        const sub = it.subtotal !== undefined && it.subtotal !== null ? it.subtotal : (Math.round(q * p * 100) / 100);
        const itemWeight = it.weight || (idx === 0 ? po.weight || '' : '');
        const itemMfgBatch = it.mfgBatchNo || (idx === 0 ? po.mfgBatchNo || '' : '');
        const itemMfgDate = it.mfgDate ? (typeof it.mfgDate === 'string' && it.mfgDate.includes('T') ? it.mfgDate.split('T')[0] : it.mfgDate) : (idx === 0 && po.mfgDate ? (typeof po.mfgDate === 'string' && po.mfgDate.includes('T') ? po.mfgDate.split('T')[0] : po.mfgDate) : '');
        const itemExpDate = it.expDate ? (typeof it.expDate === 'string' && it.expDate.includes('T') ? it.expDate.split('T')[0] : it.expDate) : (idx === 0 && (po.expDate || po.expiryDate) ? (typeof (po.expDate || po.expiryDate) === 'string' && (po.expDate || po.expiryDate).includes('T') ? (po.expDate || po.expiryDate).split('T')[0] : (po.expDate || po.expiryDate)) : '');
        const baseBatch = (it.baseBatchNumber || it.batchNumber || getInitBatch(it.name)).replace(/-[A-Z]$/, '');

        const itemBatches = Array.isArray(it.batches) && it.batches.length > 0
          ? it.batches.map((b, bIdx, arr) => ({
              id: b.id || 'batch-' + (it.id || idx) + '-' + bIdx,
              batchNumber: b.batchNumber || (arr.length > 1 ? `${baseBatch}-${String.fromCharCode(65 + bIdx)}` : baseBatch),
              quantity: parseFloat(b.quantity ?? b.batchQuantity) || 0,
              batchQuantity: parseFloat(b.batchQuantity ?? b.quantity) || 0,
              weight: b.weight || '',
              mfgBatchNo: b.mfgBatchNo || '',
              mfgDate: b.mfgDate ? (typeof b.mfgDate === 'string' && b.mfgDate.includes('T') ? b.mfgDate.split('T')[0] : b.mfgDate) : '',
              expDate: b.expDate ? (typeof b.expDate === 'string' && b.expDate.includes('T') ? b.expDate.split('T')[0] : b.expDate) : '',
            }))
          : [
              {
                id: 'batch-' + (it.id || idx) + '-1',
                batchNumber: it.batchNumber || baseBatch,
                quantity: parseFloat(it.batchQuantity ?? (idx === 0 ? po.batchQuantity : null) ?? q) || 1,
                batchQuantity: parseFloat(it.batchQuantity ?? (idx === 0 ? po.batchQuantity : null) ?? q) || 1,
                weight: itemWeight,
                mfgBatchNo: itemMfgBatch,
                mfgDate: itemMfgDate,
                expDate: itemExpDate,
              }
            ];

        return {
          ...it,
          baseBatchNumber: baseBatch,
          batchNumber: itemBatches[0]?.batchNumber || baseBatch,
          weight: itemWeight,
          mfgBatchNo: itemMfgBatch,
          mfgDate: itemMfgDate,
          expDate: itemExpDate,
          batches: itemBatches,
          batchQuantity: itemBatches[0]?.quantity ?? q,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          subtotal: sub,
        };
      });
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
      notes: po.notes || '',
      items: initialItems,

      // Supplier Invoice & Logistics / E-Way Bill Details
      supplierInvoiceNo: po.supplierInvoiceNo || '',
      supplierInvoiceDate: po.supplierInvoiceDate ? new Date(po.supplierInvoiceDate) : null,
      transportMode: po.transportMode || 'ROAD',
      transporterName: po.transporterName || '',
      vehicleNumber: po.vehicleNumber || '',
      ewayBillNo: po.ewayBillNo || '',
      ewayBillDate: po.ewayBillDate ? new Date(po.ewayBillDate) : null,
      tillDate: po.tillDate ? new Date(po.tillDate) : null,
      paymentStatus: po.paymentStatus || 'Pending',
    });
  }, [po]);

  /* ── Suppliers list ── */
  const { data: suppliers = [], refetch: refetchSuppliers } = useQuery({
    queryKey: ['suppliers'],
    queryFn: async () => (await api.get('/parties/suppliers')).data,
  });

  const getDefaultUomForItem = (item) => {
    if (!item) return null;
    if (item.uoms?.length > 0) return item.uoms[0];
    const normalized = (item.unitId || item.consumptionUnit || item.displayUom || '').trim().toLowerCase();
    if (normalized && Array.isArray(allUoms) && allUoms.length > 0) {
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
      if (containsMatch) return containsMatch;
    }
    return null;
  };

  const createItemFromCatalog = (item) => {
    const defaultUom = getDefaultUomForItem(item);
    const uomLabel = (defaultUom ? defaultUom.abbreviation : (item.displayUom || item.unitId || item.consumptionUnit || 'units')).toUpperCase();
    const uomId = defaultUom ? defaultUom.id : '';
    const categoryName = item.categoryName || item.category?.name || (typeof item.category === 'string' ? item.category : '') || (item.itemType === 'NON_INVENTORY' ? 'Non-Inventory' : 'General');
    const unitPrice = Number(item.ratePerUnit || 0);
    const quantity = 1;
    const initialBatchId = 'batch-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4);
    const baseBatch = getInitBatch(item.name);

    return {
      id: item.id,
      rmId: item.code,
      name: item.name,
      itemType: item.itemType || 'RAW_MATERIAL',
      category: categoryName,
      baseBatchNumber: baseBatch,
      batchNumber: baseBatch,
      weight: '',
      mfgBatchNo: '',
      mfgDate: '',
      expDate: '',
      batches: [
        {
          id: initialBatchId,
          batchNumber: baseBatch,
          quantity: quantity,
          batchQuantity: quantity,
          weight: '',
          mfgBatchNo: '',
          mfgDate: '',
          expDate: '',
        }
      ],
      batchQuantity: quantity,
      quantity: quantity,
      unitPrice: unitPrice,
      subtotal: Math.round(quantity * unitPrice * 100) / 100,
      uomLabel: uomLabel,
      uomId: uomId,
      gstApplicable: true,
      gstPercentage: 18,
      labTestRequired: false,
    };
  };

  const fetchBatchNumberForItem = async (item) => {
    if (!item?.id) return;
    try {
      const codeOrId = item.rmId || item.code || item.id;
      const res = await api.get(`/grn/next-batch/${encodeURIComponent(codeOrId)}?rmName=${encodeURIComponent(item.name)}`);
      const generated = res.data?.batchNumber || res.data?.nextBatchNumber;
      if (generated) {
        setForm(prev => ({
          ...prev,
          items: (prev.items || []).map(it => {
            if (it.id !== item.id) return it;
            const updatedBatches = (it.batches || []).map((b, bi, arr) => ({
              ...b,
              batchNumber: arr.length > 1 ? `${generated}-${String.fromCharCode(65 + bi)}` : generated
            }));
            return {
              ...it,
              baseBatchNumber: generated,
              batchNumber: updatedBatches[0]?.batchNumber || generated,
              batches: updatedBatches,
            };
          })
        }));
      }
    } catch (e) {
      // Fallback batch number already in place
    }
  };

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
    const newItem = createItemFromCatalog(rm);
    setForm(prev => ({
      ...prev,
      items: [...prev.items, newItem]
    }));
    fetchBatchNumberForItem(newItem);
  };

  const handleAddMultipleItems = (newItems) => {
    if (!newItems || newItems.length === 0) return;
    const toAdd = [];
    let duplicateCount = 0;

    newItems.forEach(item => {
      const exists = form.items.some(it => it.id === item.id);
      if (exists) {
        duplicateCount++;
      } else {
        toAdd.push(createItemFromCatalog(item));
      }
    });

    if (toAdd.length > 0) {
      setForm(prev => ({
        ...prev,
        items: [...prev.items, ...toAdd]
      }));
      toAdd.forEach(it => fetchBatchNumberForItem(it));
    }

    if (duplicateCount > 0 && toAdd.length === 0) {
      Swal.fire({
        icon: 'info',
        title: 'Items Already in List',
        text: 'All selected items are already added to your order table.',
        confirmButtonColor: '#4f46e5',
      });
    }
  };

  const updateItemField = (id, field, value) => {
    setForm(prev => ({
      ...prev,
      items: prev.items.map(it => it.id === id ? { ...it, [field]: value } : it)
    }));
  };

  const updateItemQuantity = (id, newQty) => {
    setForm(prev => ({
      ...prev,
      items: prev.items.map(it => {
        if (it.id !== id) return it;
        const q = parseFloat(newQty) || 0;
        const p = parseFloat(it.unitPrice) || 0;
        let updatedBatches = it.batches;
        if (!Array.isArray(it.batches) || it.batches.length <= 1) {
          updatedBatches = [{
            ...(it.batches?.[0] || { id: 'batch-' + Date.now() }),
            quantity: q,
            batchQuantity: q,
          }];
        }
        return {
          ...it,
          quantity: newQty,
          batchQuantity: q,
          batches: updatedBatches,
          subtotal: Math.round(q * p * 100) / 100,
        };
      })
    }));
  };

  const updateItemUnitPrice = (id, newPrice) => {
    setForm(prev => ({
      ...prev,
      items: (prev.items || []).map(it => {
        if (it.id !== id) return it;
        const p = parseFloat(newPrice) || 0;
        const q = parseFloat(it.quantity) || 0;
        return {
          ...it,
          unitPrice: newPrice,
          subtotal: Math.round(q * p * 100) / 100,
        };
      })
    }));
  };

  // Two-way calculation: entering subtotal calculates unit price = subtotal / quantity
  const updateItemSubtotal = (id, newSubtotal) => {
    setForm(prev => ({
      ...prev,
      items: (prev.items || []).map(it => {
        if (it.id !== id) return it;
        const sub = parseFloat(newSubtotal) || 0;
        const q = parseFloat(it.quantity) || 0;
        const calcUnitPrice = q > 0 ? Math.round((sub / q) * 10000) / 10000 : 0;
        return {
          ...it,
          subtotal: newSubtotal,
          unitPrice: calcUnitPrice,
        };
      })
    }));
  };

  const stepQuantity = (id, delta) => {
    setForm(prev => ({
      ...prev,
      items: prev.items.map(it => {
        if (it.id !== id) return it;
        const current = parseFloat(it.quantity) || 0;
        const updated = Math.max(1, Math.round((current + delta) * 1000) / 1000);
        const p = parseFloat(it.unitPrice) || 0;
        let updatedBatches = it.batches;
        if (!Array.isArray(it.batches) || it.batches.length <= 1) {
          const first = it.batches?.[0] || {};
          updatedBatches = [{
            ...first,
            id: first.id || 'batch-' + Date.now(),
            batchNumber: first.batchNumber || it.batchNumber || getInitBatch(it.name),
            quantity: updated,
            batchQuantity: updated,
          }];
        }
        return { 
          ...it, 
          quantity: updated,
          batchQuantity: updated,
          batches: updatedBatches,
          subtotal: Math.round(updated * p * 100) / 100,
        };
      })
    }));
  };

  // Multi-Batch Management Functions
  const updateBatchField = (itemId, batchId, field, value) => {
    setForm(prev => ({
      ...prev,
      items: (prev.items || []).map(it => {
        if (it.id !== itemId) return it;
        const currentBatches = Array.isArray(it.batches) && it.batches.length > 0
          ? it.batches
          : [{ 
              id: 'b-' + it.id + '-1', 
              batchNumber: it.batchNumber || getInitBatch(it.name),
              quantity: it.quantity || 1, 
              batchQuantity: it.quantity || 1, 
              weight: it.weight || '', 
              mfgBatchNo: it.mfgBatchNo || '', 
              mfgDate: it.mfgDate || '', 
              expDate: it.expDate || '' 
            }];

        const updatedBatches = currentBatches.map(b => {
          if (b.id !== batchId) return b;
          const updatedB = { ...b, [field]: value };
          if (field === 'quantity') {
            updatedB.batchQuantity = value;
          } else if (field === 'batchQuantity') {
            updatedB.quantity = value;
          }
          return updatedB;
        });

        const firstBatch = updatedBatches[0] || {};
        return {
          ...it,
          batches: updatedBatches,
          batchQuantity: firstBatch.batchQuantity || firstBatch.quantity || it.quantity,
          weight: firstBatch.weight || '',
          mfgBatchNo: firstBatch.mfgBatchNo || '',
          mfgDate: firstBatch.mfgDate || '',
          expDate: firstBatch.expDate || ''
        };
      })
    }));
  };

  const addBatchToItem = (itemId) => {
    setForm(prev => ({
      ...prev,
      items: (prev.items || []).map(it => {
        if (it.id !== itemId) return it;
        const currentBatches = Array.isArray(it.batches) && it.batches.length > 0
          ? it.batches
          : [{ 
              id: 'b-' + it.id + '-1', 
              batchNumber: it.batchNumber || getInitBatch(it.name),
              quantity: it.quantity || 1, 
              batchQuantity: it.quantity || 1, 
              weight: it.weight || '', 
              mfgBatchNo: it.mfgBatchNo || '', 
              mfgDate: it.mfgDate || '', 
              expDate: it.expDate || '' 
            }];

        const currentAlloc = currentBatches.reduce((s, b) => s + (parseFloat(b.quantity ?? b.batchQuantity) || 0), 0);
        const itemQty = parseFloat(it.quantity) || 0;
        const remaining = Math.max(0, Math.round((itemQty - currentAlloc) * 1000) / 1000);

        const baseBatch = (it.baseBatchNumber || it.batchNumber || currentBatches[0]?.batchNumber || getInitBatch(it.name)).replace(/-[A-Z]$/, '');

        const newBatch = {
          id: 'b-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
          batchNumber: '',
          quantity: remaining,
          batchQuantity: remaining,
          weight: '',
          mfgBatchNo: '',
          mfgDate: currentBatches[0]?.mfgDate || it.mfgDate || '',
          expDate: currentBatches[0]?.expDate || it.expDate || '',
        };

        const combined = [...currentBatches, newBatch].map((b, bIdx, arr) => ({
          ...b,
          batchNumber: arr.length > 1 ? `${baseBatch}-${String.fromCharCode(65 + bIdx)}` : baseBatch
        }));

        const firstBatch = combined[0] || {};
        return {
          ...it,
          baseBatchNumber: baseBatch,
          batchNumber: firstBatch.batchNumber || baseBatch,
          batches: combined,
          batchQuantity: firstBatch.batchQuantity || firstBatch.quantity || it.quantity,
          weight: firstBatch.weight || '',
          mfgBatchNo: firstBatch.mfgBatchNo || '',
          mfgDate: firstBatch.mfgDate || '',
          expDate: firstBatch.expDate || ''
        };
      })
    }));
  };

  const removeBatchFromItem = (itemId, batchId) => {
    setForm(prev => ({
      ...prev,
      items: (prev.items || []).map(it => {
        if (it.id !== itemId) return it;
        if (!Array.isArray(it.batches) || it.batches.length <= 1) return it;
        const filtered = it.batches.filter(b => b.id !== batchId);
        const baseBatch = (it.baseBatchNumber || it.batchNumber || filtered[0]?.batchNumber || getInitBatch(it.name)).replace(/-[A-Z]$/, '');

        const reindexed = filtered.map((b, bIdx, arr) => ({
          ...b,
          batchNumber: arr.length > 1 ? `${baseBatch}-${String.fromCharCode(65 + bIdx)}` : baseBatch
        }));

        const firstBatch = reindexed[0] || {};
        return {
          ...it,
          baseBatchNumber: baseBatch,
          batchNumber: firstBatch.batchNumber || baseBatch,
          batches: reindexed,
          weight: firstBatch.weight || '',
          mfgBatchNo: firstBatch.mfgBatchNo || '',
          mfgDate: firstBatch.mfgDate || '',
          expDate: firstBatch.expDate || ''
        };
      })
    }));
  };

  const [draggedIndex, setDraggedIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);

  const handleDragStart = (e, index) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDrop = (e, targetIndex) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === targetIndex) return;
    setForm(prev => {
      const updated = [...(prev.items || [])];
      const temp = updated[draggedIndex];
      updated[draggedIndex] = updated[targetIndex];
      updated[targetIndex] = temp;
      return {
        ...prev,
        items: updated
      };
    });
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const addedItemIds = useMemo(() => new Set((form?.items || []).map(it => it.id)), [form?.items]);

  // Dynamic calculations
  const subtotal = form?.items?.reduce((sum, item) => sum + (parseFloat(item.subtotal) || (Number(item.quantity || 0) * Number(item.unitPrice || 0))), 0) || 0;
  const shipping = Number(form?.shipping || 0);
  const discount = Number(form?.discount || 0);
  const otherCharges = Number(form?.otherCharges || 0);

  // Check supplier state code (prefix 33)
  const isInterState = form?.selectedSupplier?.gstin
    ? !form.selectedSupplier.gstin.trim().startsWith('33')
    : false;

  const totalItemTax = form?.items?.reduce((sum, item) => {
    if (!item.gstApplicable) return sum;
    const itemSubtotal = parseFloat(item.subtotal) || (Number(item.quantity || 0) * Number(item.unitPrice || 0));
    return sum + (itemSubtotal * (Number(item.gstPercentage || 0) / 100));
  }, 0) || 0;

  const cgstAmount = isInterState ? 0 : totalItemTax / 2;
  const sgstAmount = isInterState ? 0 : totalItemTax / 2;
  const igstAmount = isInterState ? totalItemTax : 0;

  // Determine dynamic CGST & SGST percentage labels (e.g. 18% GST -> 9% CGST & 9% SGST; 5% -> 2.5%)
  const taxableItems = (form?.items || []).filter(it => it.gstApplicable && (Number(it.gstPercentage) > 0));
  const uniqueGstRates = Array.from(new Set(taxableItems.map(it => Number(it.gstPercentage))));
  const effectiveGstRate = uniqueGstRates.length === 1 ? uniqueGstRates[0] : null;
  const cgstRateText = effectiveGstRate !== null ? `${(effectiveGstRate / 2)}%` : null;
  const sgstRateText = effectiveGstRate !== null ? `${(effectiveGstRate / 2)}%` : null;
  const cgstLabel = cgstRateText ? `CGST (${cgstRateText})` : 'CGST (Intrastate)';
  const sgstLabel = sgstRateText ? `SGST (${sgstRateText})` : 'SGST (Intrastate)';

  const unroundedTotal = Math.max(0, subtotal + totalItemTax + shipping + otherCharges - discount);
  const grandTotal = Math.round(unroundedTotal);
  const roundOff = Number((grandTotal - unroundedTotal).toFixed(2));

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
    if (e && e.preventDefault) e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!form.expectedDelivery) {
      setErrorMsg('Expected Delivery Date is required.');
      return;
    }
    if (!form.items || form.items.length === 0) {
      setErrorMsg('Please add at least one raw material or item.');
      return;
    }

    // Validate that batch quantities do not exceed ordered item quantity
    for (const it of form.items) {
      if (Array.isArray(it.batches) && it.batches.length > 0) {
        const batchTotal = it.batches.reduce((sum, b) => sum + (parseFloat(b.quantity) || 0), 0);
        const itemQty = parseFloat(it.quantity) || 0;
        if (batchTotal > itemQty + 0.0001) {
          Swal.fire({
            icon: 'error',
            title: 'Batch Quantity Exceeded',
            html: `Total batch quantity (<b>${batchTotal} ${it.uomLabel}</b>) for item <b>${it.name}</b> exceeds the ordered quantity (<b>${itemQty} ${it.uomLabel}</b>).<br/><br/>Please reduce batch quantities so their sum does not exceed the item quantity.`,
            confirmButtonColor: '#4f46e5'
          });
          return;
        }
      }
    }

    const firstItem = form.items[0];
    const totalQuantity = form.items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);

    updateMutation.mutate({
      rmId: firstItem.rmId || form.rmId,
      name: firstItem.name,
      quantity: totalQuantity,
      amount: Number(grandTotal),
      uomId: firstItem.uomId || undefined,
      expectedDelivery: form.expectedDelivery.toISOString(),
      supplierId: form.selectedSupplier?.id || null,
      notes: form.notes || null,
      
      subtotal: subtotal,
      orderTax: 0,
      discount: discount,
      shipping: shipping,
      otherCharges: otherCharges,
      cgst: cgstAmount,
      sgst: sgstAmount,
      igst: igstAmount,
      grandTotal: grandTotal,
      items: (form.items || []).map(it => ({
        ...it,
        batchQuantity: it.batches?.[0]?.quantity !== undefined ? parseFloat(it.batches[0].quantity) : (parseFloat(it.quantity) || null),
        batches: Array.isArray(it.batches) ? it.batches.map(b => ({
          ...b,
          quantity: parseFloat(b.quantity ?? b.batchQuantity) || 0,
          batchQuantity: parseFloat(b.batchQuantity ?? b.quantity) || 0,
        })) : null,
      })),

      // Directly sync top-level batch columns on RawMaterialPO model
      batchQuantity: firstItem?.batches?.[0]?.quantity !== undefined ? parseFloat(firstItem.batches[0].quantity) : (parseFloat(firstItem?.quantity) || null),
      weight: firstItem.weight || null,
      mfgBatchNo: firstItem.mfgBatchNo || null,
      mfgDate: firstItem.mfgDate ? new Date(firstItem.mfgDate).toISOString() : null,
      expDate: firstItem.expDate ? new Date(firstItem.expDate).toISOString() : null,

      // Supplier Invoice & Logistics / E-Way Bill Details
      supplierInvoiceNo: form.supplierInvoiceNo?.trim() || null,
      supplierInvoiceDate: form.supplierInvoiceDate ? form.supplierInvoiceDate.toISOString() : null,
      transportMode: form.transportMode || 'ROAD',
      transporterName: form.transporterName?.trim() || null,
      vehicleNumber: form.vehicleNumber?.trim()?.toUpperCase() || null,
      ewayBillNo: form.ewayBillNo?.trim() || null,
      ewayBillDate: form.ewayBillDate ? form.ewayBillDate.toISOString() : null,
      tillDate: form.tillDate ? form.tillDate.toISOString() : null,
    });
  };

  /* ── Loading / Error states ── */
  if (isLoadingPO || !form) {
    return (
      <div className="w-full max-w-[1720px] mx-auto px-2 sm:px-4 lg:px-6 py-2.5 space-y-3">
        <Skeleton className="h-14 w-full rounded-2xl" />
        <Skeleton className="h-44 w-full rounded-2xl" />
        <Skeleton className="h-44 w-full rounded-2xl" />
        <Skeleton className="h-80 w-full rounded-2xl" />
      </div>
    );
  }

  if (poError || !po) {
    return (
      <div className="w-full max-w-[1720px] mx-auto px-4 py-16 text-center">
        <div className="max-w-md mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
          <AlertTriangle className="w-12 h-12 text-rose-500 mx-auto mb-3" />
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200">PO Not Found</h2>
          <p className="text-xs text-slate-500 mt-1">The requested purchase order could not be loaded or was removed.</p>
          <Button onClick={handleBack} variant="outline" className="mt-4 rounded-xl text-xs">
            Back to Purchase Orders
          </Button>
        </div>
      </div>
    );
  }

  if (po.status !== 'PENDING') {
    return (
      <div className="w-full max-w-[1720px] mx-auto px-4 py-16 text-center">
        <div className="max-w-md mx-auto bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-800 rounded-2xl p-6 shadow-sm">
          <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-3" />
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200">Cannot Edit This PO</h2>
          <p className="text-xs text-slate-500 mt-1">
            Only <strong>PENDING</strong> purchase orders can be edited. This PO status is <strong>{po.status}</strong>.
          </p>
          <Button onClick={handleBack} variant="outline" className="mt-4 rounded-xl text-xs">
            Back to Purchase Orders
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[1720px] mx-auto px-2 sm:px-4 lg:px-6 py-2.5 space-y-3">
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
                Edit Purchase Order
              </h1>
              <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200/70 dark:border-indigo-800/60 shrink-0">
                {form.referenceNo || 'PO DRAFT'}
              </span>
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200/80 dark:border-amber-800/80 shrink-0">
                <Lock className="w-2.5 h-2.5" />
                {form.status}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 truncate hidden sm:block">
              Update procurement items, supplier, dates, batch details & logistics · Audit-logged
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 w-full sm:w-auto shrink-0">
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
            disabled={updateMutation.isPending}
            className="flex-1 sm:flex-none bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-8 px-4 rounded-xl text-xs shadow-sm shadow-indigo-600/20 gap-1.5 transition-all"
          >
            {updateMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <SaveIcon className="w-3.5 h-3.5" />}
            {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>

      {/* Audit Banner */}
      <div className="flex items-center gap-2 px-3 py-2 bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/60 rounded-xl text-amber-800 dark:text-amber-300 text-xs">
        <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-600" />
        <span>All modifications are audit-logged with old values, new values, editor name, and timestamp.</span>
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

      {/* Success alert if any */}
      {successMsg && (
        <div className="p-3 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 rounded-xl text-xs font-medium border border-emerald-200 dark:border-emerald-800/60 flex items-center justify-between shadow-xs animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>{successMsg}</span>
          </div>
          <button type="button" onClick={() => setSuccessMsg('')} className="p-0.5 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 rounded">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────────────
          1. ORDER INFORMATION CARD
          ─────────────────────────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-3 sm:p-3.5 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-1 mb-2.5 pb-1.5 border-b border-slate-100 dark:border-slate-800">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5 text-indigo-500" />
            1. Order Information
          </span>
          {form.selectedSupplier?.gstin && (
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
            <Label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
              Expected Delivery <span className="text-rose-500">*</span>
            </Label>
            <DatePicker
              value={form.expectedDelivery}
              onChange={(date) => setForm({ ...form, expectedDelivery: date })}
              modalTitle="Expected Delivery Date"
              placeholder="Select Date..."
              triggerClassName="h-9 text-xs rounded-xl bg-slate-50/70 dark:bg-slate-900/90 border-slate-300 dark:border-slate-700 hover:border-indigo-400 text-slate-800 dark:text-slate-200"
            />
          </div>

          {/* Status Display (Read-Only) */}
          <div className="space-y-1">
            <Label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
              <Lock className="w-2.5 h-2.5 text-slate-400" />
              Order Status
            </Label>
            <div className="h-9 px-3 flex items-center justify-between rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-not-allowed">
              <span>{form.status}</span>
              <span className="text-[10px] text-slate-400 font-normal">Workflow locked</span>
            </div>
          </div>

          {/* Supplier Select */}
          <div className="space-y-1">
            <Label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
              Supplier
            </Label>
            <SupplierSelect 
              suppliers={suppliers} 
              value={form.selectedSupplier} 
              onChange={(s) => setForm({ ...form, selectedSupplier: s })} 
              onAddNew={() => setShowAddSupplier(true)}
            />
          </div>
        </div>

        {/* Supplier Details Horizontal Bar */}
        {form.selectedSupplier && (
          <div className="mt-2.5 pt-2 border-t border-dashed border-slate-150 dark:border-slate-800 flex flex-wrap items-center gap-x-3 sm:gap-x-4 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400">
            <div className="flex items-center gap-1">
              <span className="font-semibold text-slate-700 dark:text-slate-300">Phone:</span>
              <span>{form.selectedSupplier.phone || 'N/A'}</span>
            </div>
            <span className="text-slate-300 dark:text-slate-700 hidden sm:inline">•</span>
            <div className="flex items-center gap-1">
              <span className="font-semibold text-slate-700 dark:text-slate-300">GSTIN:</span>
              <span className="font-mono font-medium text-indigo-600 dark:text-indigo-400">{form.selectedSupplier.gstin || 'N/A'}</span>
            </div>
            <span className="text-slate-300 dark:text-slate-700 hidden sm:inline">•</span>
            <div className="flex items-center gap-1">
              <span className="font-semibold text-slate-700 dark:text-slate-300">PAN:</span>
              <span className="font-mono">{form.selectedSupplier.pan || 'N/A'}</span>
            </div>
            {form.selectedSupplier.address && (
              <>
                <span className="text-slate-300 dark:text-slate-700 hidden sm:inline">•</span>
                <div className="flex items-center gap-1 truncate max-w-full sm:max-w-xs">
                  <span className="font-semibold text-slate-700 dark:text-slate-300">Address:</span>
                  <span className="truncate">{form.selectedSupplier.address}</span>
                </div>
              </>
            )}
          </div>
        )}

        {/* Read-Only PO Meta Badges */}
        <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-slate-400">
          <div>RM Reference ID: <span className="font-mono font-semibold text-slate-600 dark:text-slate-300">{form.rmId}</span></div>
          <div>Created By: <span className="font-semibold text-slate-600 dark:text-slate-300">{form.createdBy || 'System'}</span></div>
          <div>Created At: <span className="font-semibold text-slate-600 dark:text-slate-300">{form.createdAt ? format(new Date(form.createdAt), 'dd MMM yyyy, HH:mm') : '—'}</span></div>
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────────────────
          2. SUPPLIER INVOICE & TRANSPORT / E-WAY BILL DETAILS CARD
          ─────────────────────────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-3 sm:p-3.5 shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-1.5 pb-1.5 border-b border-slate-100 dark:border-slate-800">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
            <Truck className="w-3.5 h-3.5 text-indigo-500" />
            2. Supplier Invoice & Transport / E-Way Bill Details
          </span>
          <div className="flex items-center gap-2">
            {grandTotal >= 50000 && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                <ShieldCheck className="w-3 h-3 text-amber-500" />
                GST E-Way Bill Recommended (&ge; ₹50,000)
              </span>
            )}
            <span className="text-[10px] text-slate-400 dark:text-slate-500 hidden sm:inline">
              Optional / Can be updated anytime
            </span>
          </div>
        </div>

        {/* Row 1: Supplier Invoice Information & Transport Mode */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3 items-start">
          {/* Supplier Invoice No */}
          <div className="space-y-1">
            <Label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-1">
              <FileText className="w-3 h-3 text-slate-400" />
              Supplier Invoice No
            </Label>
            <Input
              type="text"
              value={form.supplierInvoiceNo || ''}
              onChange={(e) => setForm({ ...form, supplierInvoiceNo: e.target.value })}
              placeholder="e.g. INV-2026-0042"
              className="h-9 text-xs rounded-xl bg-slate-50/70 dark:bg-slate-900/90 border-slate-300 dark:border-slate-700 hover:border-indigo-400 focus:border-indigo-600 font-medium"
            />
          </div>

          {/* Supplier Invoice Date */}
          <div className="space-y-1">
            <Label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-1">
              <Calendar className="w-3 h-3 text-slate-400" />
              Supplier Invoice Date
            </Label>
            <DatePicker
              value={form.supplierInvoiceDate}
              onChange={(date) => setForm({ ...form, supplierInvoiceDate: date })}
              modalTitle="Supplier Invoice Date"
              placeholder="Select Date..."
              triggerClassName="h-9 text-xs rounded-xl bg-slate-50/70 dark:bg-slate-900/90 border-slate-300 dark:border-slate-700 hover:border-indigo-400 focus:border-indigo-600 text-slate-800 dark:text-slate-200"
            />
          </div>

          {/* Transport Mode */}
          <div className="space-y-1">
            <Label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-1">
              <Truck className="w-3 h-3 text-slate-400" />
              Transport Mode
            </Label>
            <div className="relative">
              <select
                value={form.transportMode || 'ROAD'}
                onChange={(e) => setForm({ ...form, transportMode: e.target.value })}
                className="w-full h-9 px-3 py-1.5 text-xs border rounded-xl bg-slate-50/70 dark:bg-slate-900/90 border-slate-300 dark:border-slate-700 hover:border-indigo-400 focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20 text-slate-800 dark:text-slate-200 font-medium cursor-pointer appearance-none shadow-2xs"
              >
                <option value="ROAD">🚛 Road Transport</option>
                <option value="RAIL">🚆 Rail Express</option>
                <option value="AIR">✈️ Air Freight</option>
                <option value="SHIP">🚢 Ship / Maritime</option>
                <option value="OTHER">📦 Other / Courier</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
            </div>
          </div>

          {/* Vehicle Number */}
          <div className="space-y-1">
            <Label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-1">
              <Truck className="w-3 h-3 text-slate-400" />
              Vehicle Number
            </Label>
            <Input
              type="text"
              value={form.vehicleNumber || ''}
              onChange={(e) => setForm({ ...form, vehicleNumber: e.target.value.toUpperCase() })}
              placeholder="e.g. TN-01-AB-1234"
              className="h-9 text-xs rounded-xl bg-slate-50/70 dark:bg-slate-900/90 border-slate-300 dark:border-slate-700 hover:border-indigo-400 focus:border-indigo-600 font-mono uppercase font-semibold"
            />
          </div>
        </div>

        {/* Row 2: Transporter Name & E-Way Bill Details */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3 items-start pt-1">
          {/* Transporter / Carrier Name */}
          <div className="space-y-1">
            <Label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-1">
              <Building2 className="w-3 h-3 text-slate-400" />
              Transporter / Carrier
            </Label>
            <Input
              type="text"
              value={form.transporterName || ''}
              onChange={(e) => setForm({ ...form, transporterName: e.target.value })}
              placeholder="e.g. VRL / SafeXpress / Blue Dart"
              className="h-9 text-xs rounded-xl bg-slate-50/70 dark:bg-slate-900/90 border-slate-300 dark:border-slate-700 hover:border-indigo-400 focus:border-indigo-600 font-medium"
            />
          </div>

          {/* E-Way Bill Number */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <Label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-indigo-500" />
                E-Way Bill Number
              </Label>
              {form.ewayBillNo && (
                <span className="text-[10px] font-mono text-slate-400 font-medium">
                  {form.ewayBillNo.length}/12
                </span>
              )}
            </div>
            <Input
              type="text"
              maxLength={16}
              value={form.ewayBillNo || ''}
              onChange={(e) => setForm({ ...form, ewayBillNo: e.target.value.replace(/\s+/g, '') })}
              placeholder="12-digit E-Way Bill No"
              className="h-9 text-xs rounded-xl bg-slate-50/70 dark:bg-slate-900/90 border-slate-300 dark:border-slate-700 hover:border-indigo-400 focus:border-indigo-600 font-mono font-semibold text-indigo-600 dark:text-indigo-400 tracking-wider"
            />
          </div>

          {/* E-Way Bill Date */}
          <div className="space-y-1">
            <Label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-1">
              <Calendar className="w-3 h-3 text-slate-400" />
              E-Way Date
            </Label>
            <DatePicker
              value={form.ewayBillDate}
              onChange={(date) => setForm({ ...form, ewayBillDate: date })}
              modalTitle="E-Way Bill Date"
              placeholder="Select Date..."
              triggerClassName="h-9 text-xs rounded-xl bg-slate-50/70 dark:bg-slate-900/90 border-slate-300 dark:border-slate-700 hover:border-indigo-400 focus:border-indigo-600 text-slate-800 dark:text-slate-200"
            />
          </div>

          {/* Valid Till Date */}
          <div className="space-y-1">
            <Label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-1">
              <Clock className="w-3 h-3 text-slate-400" />
              Valid Till Date
            </Label>
            <DatePicker
              value={form.tillDate}
              onChange={(date) => setForm({ ...form, tillDate: date })}
              modalTitle="Valid Till Date"
              placeholder="Select Date..."
              triggerClassName="h-9 text-xs rounded-xl bg-slate-50/70 dark:bg-slate-900/90 border-slate-300 dark:border-slate-700 hover:border-indigo-400 focus:border-indigo-600 text-slate-800 dark:text-slate-200"
            />
          </div>
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────────────────
          3. FULL SCREEN: BROWSE RAW MATERIALS & NON-INVENTORY ITEMS TABLE
          ─────────────────────────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-3 sm:p-4 shadow-xs space-y-3 w-full">
        
        {/* Section Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Package className="w-4 h-4 text-indigo-500" />
              3. Browse Raw Materials & Non-Inventory Items with Category & UOM
            </span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
              Added Items ({form.items.length})
            </span>
          </div>
          <span className="text-[10px] text-slate-400 dark:text-slate-500">
            Drag handles (#) to swap & reorder items • Enter Subtotal to auto-calculate unit price
          </span>
        </div>

        {/* Full Width Material Selector */}
        <div className="relative w-full">
          {isLoadingRMs || isLoadingNonInv ? (
            <div className="w-full px-3 py-2 border rounded-xl text-slate-400 border-slate-200 dark:border-slate-800 flex items-center bg-white dark:bg-slate-900 shadow-xs h-10 text-xs">
              <Loader2 className="w-4 h-4 mr-2 animate-spin text-indigo-500" /> Loading materials catalog...
            </div>
          ) : (
            <RawMaterialSelect 
              ref={rawMaterialSelectRef}
              rawMaterials={purchasableItems}
              value={null}
              onChange={handleAddRmItem} 
              onAddMultiple={handleAddMultipleItems}
              addedItemIds={addedItemIds}
              lowStockIds={lowStockIds}
            />
          )}
        </div>

        {/* Full Width Items Table */}
        <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs w-full">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse min-w-[750px]">
              <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="px-2 py-2.5 w-12 text-center">#</th>
                  <th className="px-3 py-2.5 min-w-[200px]">Item / Category / UOM</th>
                  <th className="px-2 py-2.5 text-center w-36">Quantity</th>
                  <th className="px-2 py-2.5 text-right w-28">Unit Price (₹)</th>
                  <th className="px-2 py-2.5 text-center w-24">Tax Status</th>
                  <th className="px-2 py-2.5 text-center w-20">GST %</th>
                  <th className="px-2 py-2.5 text-center w-28">Lab Test Status</th>
                  <th className="px-3 py-2.5 text-right w-32">Subtotal (₹)</th>
                  <th className="px-2 py-2.5 text-center w-12">Action</th>
                </tr>
              </thead>

              {form.items && form.items.length > 0 ? (
                form.items.map((item, index) => {
                  const itemSubtotal = parseFloat(item.subtotal) !== undefined && !isNaN(parseFloat(item.subtotal))
                    ? parseFloat(item.subtotal)
                    : Number(item.quantity || 0) * Number(item.unitPrice || 0);
                  const isNonInv = item.itemType === 'NON_INVENTORY';
                  const isDragged = draggedIndex === index;
                  const isOver = dragOverIndex === index && draggedIndex !== index;

                  return (
                    <tbody
                      key={item.id || index}
                      onDragOver={(e) => handleDragOver(e, index)}
                      onDragLeave={() => { if (dragOverIndex === index) setDragOverIndex(null); }}
                      onDrop={(e) => handleDrop(e, index)}
                      className={twMerge(
                        "transition-all duration-150 border-b border-slate-200/80 dark:border-slate-800",
                        isDragged && "opacity-40 bg-indigo-50/40 dark:bg-indigo-950/40",
                        isOver && "ring-2 ring-indigo-500 ring-inset bg-indigo-50/60 dark:bg-indigo-950/60"
                      )}
                    >
                      <tr className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                        {/* S.No with Drag Handle */}
                        <td className="px-2 py-2 text-center align-middle">
                          <div
                            draggable
                            onDragStart={(e) => handleDragStart(e, index)}
                            onDragEnd={handleDragEnd}
                            className="inline-flex items-center justify-center gap-1 cursor-grab active:cursor-grabbing text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 p-1 rounded hover:bg-indigo-50 dark:hover:bg-indigo-950/50 transition-colors select-none"
                            title="Drag to swap / reorder"
                          >
                            <GripVertical className="w-3.5 h-3.5 shrink-0 text-slate-400 hover:text-indigo-600" />
                            <span className="font-bold text-xs text-slate-700 dark:text-slate-300 font-mono w-4 text-center">{index + 1}</span>
                          </div>
                        </td>

                        {/* Item Details */}
                        <td className="px-3 py-2 align-middle">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="font-bold text-slate-900 dark:text-slate-100 text-xs truncate max-w-[240px]" title={item.name}>
                              {item.name}
                            </span>
                            {isNonInv ? (
                              <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.2 rounded font-bold bg-purple-100 text-purple-700 dark:bg-purple-950/80 dark:text-purple-300 border border-purple-200 dark:border-purple-800 shrink-0">
                                Non-Inv
                              </span>
                            ) : (
                              <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.2 rounded font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 shrink-0">
                                RM
                              </span>
                            )}
                            {lowStockIds.has(item.id) && (
                              <span className="text-[9px] uppercase tracking-wider px-1 py-0.2 rounded font-bold bg-rose-100 text-rose-700 border border-rose-200 shrink-0">
                                Low
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 whitespace-nowrap overflow-hidden">
                            <span className="font-mono text-slate-600 dark:text-slate-300 font-medium bg-slate-100 dark:bg-slate-800 px-1 py-0.2 rounded border border-slate-200 dark:border-slate-700">
                              {item.rmId}
                            </span>
                            {item.category && (
                              <span className="truncate max-w-[140px] text-slate-500 dark:text-slate-400" title={item.category}>
                                • {item.category}
                              </span>
                            )}
                            <span className="font-bold text-emerald-600 dark:text-emerald-400">
                              • {item.uomLabel}
                            </span>
                          </div>
                        </td>

                        {/* Quantity Stepper */}
                        <td className="px-2 py-2 text-center align-middle">
                          <div className="flex items-center justify-center gap-1.5">
                            <div className="inline-flex items-center border border-slate-300 dark:border-slate-700 rounded-lg bg-slate-50/70 dark:bg-slate-900/70 p-0.5 shadow-2xs hover:border-indigo-400 transition-colors">
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
                                onChange={(e) => updateItemQuantity(item.id, e.target.value)} 
                                className="w-16 h-5 p-0 text-center font-bold text-xs bg-transparent border-0 focus-visible:ring-0 focus-visible:ring-offset-0 select-all text-slate-900 dark:text-white" 
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
                        <td className="px-2 py-2 text-right align-middle">
                          <div className="relative inline-flex items-center ml-auto">
                            <span className="absolute left-2 text-[10px] font-bold text-indigo-500 select-none">₹</span>
                            <Input 
                              type="number" 
                              step="0.0001" 
                              min="0"
                              value={item.unitPrice} 
                              onChange={(e) => updateItemUnitPrice(item.id, e.target.value)} 
                              className="w-20 pl-4 pr-1.5 text-right h-7 rounded-lg border-slate-300 dark:border-slate-700 hover:border-indigo-400 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-500 bg-slate-50/50 dark:bg-slate-900/50 font-semibold text-xs text-slate-900 dark:text-white" 
                              required
                            />
                          </div>
                        </td>

                        {/* GST Status Toggle */}
                        <td className="px-2 py-2 text-center align-middle">
                          <button
                            type="button"
                            onClick={() => {
                              setForm(prev => ({
                                ...prev,
                                items: prev.items.map(it => it.id === item.id ? { ...it, gstApplicable: !it.gstApplicable } : it)
                              }));
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
                        <td className="px-2 py-2 text-center align-middle">
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
                            className="h-7 px-1.5 text-xs border rounded-lg bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 hover:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-700 dark:text-slate-200 font-bold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed w-16 mx-auto block"
                          >
                            <option value={0}>0%</option>
                            <option value={5}>5%</option>
                            <option value={12}>12%</option>
                            <option value={18}>18%</option>
                            <option value={28}>28%</option>
                          </select>
                        </td>

                        {/* Lab Test Status */}
                        <td className="px-2 py-2 text-center align-middle">
                          <button
                            type="button"
                            onClick={() => {
                              setForm(prev => ({
                                ...prev,
                                items: prev.items.map(it => it.id === item.id ? { ...it, labTestRequired: !it.labTestRequired } : it)
                              }));
                            }}
                            className={twMerge(
                              "h-7 px-2 text-[10px] font-bold rounded-lg transition-all border shadow-2xs inline-flex items-center gap-1 cursor-pointer",
                              item.labTestRequired
                                ? "bg-indigo-50 text-indigo-700 border-indigo-300 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800 hover:bg-indigo-100"
                                : "bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800 hover:bg-emerald-100"
                            )}
                            title={item.labTestRequired ? "Click to exempt from lab test" : "Click to require lab test"}
                          >
                            {item.labTestRequired ? (
                              <>
                                <FlaskConical className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                                <span>Lab Required</span>
                              </>
                            ) : (
                              <>
                                <ShieldCheck className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                                <span>Lab Exempt</span>
                              </>
                            )}
                          </button>
                        </td>

                        {/* Subtotal (Editable, 2-way with unit price) */}
                        <td className="px-3 py-2 text-right align-middle">
                          <div className="flex flex-col items-end">
                            <div className="relative inline-flex items-center">
                              <span className="absolute left-2 text-[10px] font-bold text-indigo-600 dark:text-indigo-400 select-none">₹</span>
                              <Input 
                                type="number" 
                                step="0.01" 
                                min="0"
                                value={item.subtotal !== undefined ? item.subtotal : (Math.round(itemSubtotal * 100) / 100)} 
                                onChange={(e) => updateItemSubtotal(item.id, e.target.value)} 
                                className="w-24 pl-4 pr-1.5 text-right h-7 rounded-lg border-indigo-300 dark:border-indigo-700 hover:border-indigo-500 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/40 font-bold text-xs text-indigo-950 dark:text-indigo-200" 
                                title="Enter subtotal to auto-calculate unit price (subtotal ÷ quantity)"
                                required
                              />
                            </div>
                            <span className="text-[9px] text-slate-400 font-mono mt-0.5" title="subtotal ÷ qty">
                              = ₹{Number(item.unitPrice || 0).toFixed(2)}/{item.uomLabel}
                            </span>
                          </div>
                        </td>

                        {/* Action */}
                        <td className="px-2 py-2 text-center align-middle">
                          <button 
                            type="button" 
                            onClick={() => setForm(prev => ({
                              ...prev,
                              items: prev.items.filter(it => it.id !== item.id)
                            }))} 
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/60 rounded-md transition-colors"
                            title="Remove item"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>

                      {/* Row 2: Multi-Batch Strip with Allocation Badge and Split Controls */}
                      <tr className="bg-slate-50/70 dark:bg-slate-800/40 border-t border-slate-100 dark:border-slate-800/80">
                        <td colSpan={9} className="px-3 py-2">
                          {(() => {
                            const currentBatches = Array.isArray(item.batches) && item.batches.length > 0
                              ? item.batches
                              : [{ id: 'b-' + item.id + '-1', quantity: item.quantity, weight: item.weight || '', mfgBatchNo: item.mfgBatchNo || '', mfgDate: item.mfgDate || '', expDate: item.expDate || '' }];
                            
                            const batchAllocated = currentBatches.reduce((sum, b) => sum + (parseFloat(b.quantity) || 0), 0);
                            const itemQty = parseFloat(item.quantity) || 0;
                            const isAllocatedExceeded = batchAllocated > itemQty + 0.0001;
                            const isFullyAllocated = Math.abs(batchAllocated - itemQty) <= 0.0001;
                            const remainingQty = Math.max(0, Math.round((itemQty - batchAllocated) * 1000) / 1000);

                            return (
                              <div className="space-y-2">
                                {/* Batches Header Strip */}
                                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-bold text-[11px] uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1">
                                      <Tag className="w-3 h-3 text-indigo-500" />
                                      Batches ({currentBatches.length} {currentBatches.length === 1 ? 'Batch' : 'Batches'})
                                    </span>

                                    {/* Status Badge */}
                                    {isAllocatedExceeded ? (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700 dark:bg-rose-950/80 dark:text-rose-300 border border-rose-300 dark:border-rose-800 animate-pulse">
                                        <AlertCircle className="w-3 h-3 text-rose-600" />
                                        Exceeds Ordered Qty by {(batchAllocated - itemQty).toFixed(2)} {item.uomLabel}! (Total: {batchAllocated} / Max: {itemQty})
                                      </span>
                                    ) : isFullyAllocated ? (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                        All {itemQty} {item.uomLabel} Allocated
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                                        Allocated: {batchAllocated} / {itemQty} {item.uomLabel} ({remainingQty} {item.uomLabel} remaining)
                                      </span>
                                    )}
                                  </div>

                                  {/* Add / Split Batch Button */}
                                  <button
                                    type="button"
                                    onClick={() => addBatchToItem(item.id)}
                                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold text-indigo-600 hover:text-indigo-700 bg-white hover:bg-indigo-50 dark:bg-slate-900 dark:hover:bg-slate-800 border border-indigo-200 dark:border-indigo-800 shadow-2xs transition-colors cursor-pointer"
                                    title="Split this item into another batch (e.g. 3 from batch A, 3 from batch B)"
                                  >
                                    <Plus className="w-3 h-3 text-indigo-600" />
                                    + Split / Add Another Batch
                                  </button>
                                </div>

                                {/* Batches Rows */}
                                <div className="space-y-1.5">
                                  {currentBatches.map((batch, bIdx) => (
                                    <div
                                      key={batch.id || bIdx}
                                      className="flex flex-wrap items-center gap-2 px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-2xs text-xs"
                                    >
                                      {/* Batch Index Badge */}
                                      <span className="font-bold text-[10px] text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200/80 dark:border-indigo-800/80 px-2 py-0.5 rounded-md shrink-0">
                                        #{bIdx + 1}
                                      </span>

                                      {/* Our Internal Running Batch No (Auto-Generated & LOCKED) */}
                                      <div className="flex items-center gap-1 w-[165px] shrink-0">
                                        <Lock className="w-3 h-3 text-slate-400 shrink-0" />
                                        <span className="font-semibold text-slate-600 dark:text-slate-400 text-[10px] shrink-0" title="Our Internal Sequential Batch (Auto & Locked)">Our Batch:</span>
                                        <Input
                                          type="text"
                                          value={batch.batchNumber || ''}
                                          readOnly
                                          className="h-6.5 text-[11px] font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-700 cursor-not-allowed px-1.5 py-0 select-all flex-1"
                                          title="Company running batch sequence (Locked for internal traceability)"
                                        />
                                      </div>

                                      {/* Batch Quantity */}
                                      <div className="flex items-center gap-1 w-[120px] shrink-0">
                                        <span className="font-semibold text-slate-600 dark:text-slate-400 text-[10px] shrink-0">Batch Qty:</span>
                                        <div className="relative flex items-center flex-1">
                                          <Input
                                            type="number"
                                            min="0"
                                            step="any"
                                            value={batch.quantity}
                                            onChange={(e) => updateBatchField(item.id, batch.id, 'quantity', e.target.value)}
                                            className={`h-6.5 text-[11px] font-bold rounded pr-7 pl-1.5 w-full ${
                                              isAllocatedExceeded 
                                                ? 'border-rose-400 bg-rose-50 text-rose-700' 
                                                : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900'
                                            }`}
                                          />
                                          <span className="absolute right-1 text-[9px] font-semibold text-slate-400 select-none">
                                            {item.uomLabel}
                                          </span>
                                        </div>
                                      </div>

                                      {/* Weight */}
                                      <div className="flex items-center gap-1 w-[125px] shrink-0">
                                        <Scale className="w-3 h-3 text-indigo-500 shrink-0" />
                                        <span className="font-semibold text-slate-600 dark:text-slate-400 text-[10px] shrink-0">Weight:</span>
                                        <Input
                                          type="text"
                                          value={batch.weight || ''}
                                          onChange={(e) => updateBatchField(item.id, batch.id, 'weight', e.target.value)}
                                          placeholder="e.g. 25 kg / 50"
                                          className="h-6.5 text-[11px] rounded border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-medium px-1.5 py-0 flex-1"
                                        />
                                      </div>

                                      {/* MFG Batch No */}
                                      <div className="flex items-center gap-1 w-[135px] shrink-0">
                                        <Tag className="w-3 h-3 text-indigo-500 shrink-0" />
                                        <span className="font-semibold text-slate-600 dark:text-slate-400 text-[10px] shrink-0">MFG Batch:</span>
                                        <Input
                                          type="text"
                                          value={batch.mfgBatchNo || ''}
                                          onChange={(e) => updateBatchField(item.id, batch.id, 'mfgBatchNo', e.target.value)}
                                          placeholder="e.g. BATCH-01"
                                          className="h-6.5 text-[11px] rounded border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono uppercase font-medium px-1.5 py-0 flex-1"
                                        />
                                      </div>

                                      {/* MFG Date */}
                                      <div className="flex items-center gap-1 w-[150px] shrink-0">
                                        <Calendar className="w-3 h-3 text-indigo-500 shrink-0" />
                                        <span className="font-semibold text-slate-600 dark:text-slate-400 text-[10px] shrink-0">MFG Date:</span>
                                        <div className="flex-1 min-w-0">
                                          <BatchDateInput
                                            value={batch.mfgDate || ''}
                                            onChange={(val) => updateBatchField(item.id, batch.id, 'mfgDate', val)}
                                            placeholder="dd-mm-yyyy"
                                            title="MFG Date"
                                            className="h-6.5"
                                          />
                                        </div>
                                      </div>

                                      {/* Exp Date */}
                                      <div className="flex items-center gap-1 w-[150px] shrink-0">
                                        <Clock className="w-3 h-3 text-indigo-500 shrink-0" />
                                        <span className="font-semibold text-slate-600 dark:text-slate-400 text-[10px] shrink-0">Exp Date:</span>
                                        <div className="flex-1 min-w-0">
                                          <BatchDateInput
                                            value={batch.expDate || ''}
                                            onChange={(val) => updateBatchField(item.id, batch.id, 'expDate', val)}
                                            placeholder="dd-mm-yyyy"
                                            title="Exp Date"
                                            className="h-6.5"
                                          />
                                        </div>
                                      </div>

                                      {/* Remove Batch Split Button (if > 1 batch) */}
                                      {currentBatches.length > 1 && (
                                        <button
                                          type="button"
                                          onClick={() => removeBatchFromItem(item.id, batch.id)}
                                          className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/60 rounded-md transition-colors shrink-0 cursor-pointer ml-auto"
                                          title="Remove this batch split"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          })()}
                        </td>
                      </tr>
                    </tbody>
                  );
                })
              ) : (
                <tbody>
                  <tr>
                    <td colSpan={9} className="px-3 py-8 text-center">
                      <div className="flex flex-col items-center justify-center text-slate-400 dark:text-slate-500">
                        <Package className="w-8 h-8 text-slate-300 dark:text-slate-600 mb-1.5" />
                        <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">No Raw Materials Added</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Use the selector above or click "Add Item" to add a raw material.
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
                </tbody>
              )}
            </table>
          </div>

          {/* Docked Table Footer */}
          {form.items.length > 0 && (
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
                Items Subtotal ({form.items.length} items): <strong className="text-slate-800 dark:text-slate-200 ml-1">₹{subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────────────────
          4. CHARGES & FINANCIAL SUMMARY (DISPLAYING BELOW ITEMS TABLE)
          ─────────────────────────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-3 sm:p-4 shadow-xs space-y-3 w-full">
        <div className="flex items-center justify-between pb-1.5 border-b border-slate-100 dark:border-slate-800">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
            <Calculator className="w-3.5 h-3.5 text-indigo-500" />
            4. Charges & Financial Summary
          </span>
          <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
            INR (₹)
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 sm:gap-4 items-start">
          {/* Left Column (7 cols): Additional Charges Inputs & Notes */}
          <div className="lg:col-span-7 space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {/* Discount */}
              <div className="space-y-1">
                <Label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">Discount (₹)</Label>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-indigo-600 dark:text-indigo-400 select-none">₹</span>
                  <Input 
                    type="number" 
                    min="0"
                    value={form.discount} 
                    onChange={(e) => setForm({ ...form, discount: e.target.value })}
                    className="h-9 text-xs pl-6 rounded-xl bg-slate-50/70 dark:bg-slate-900/90 border-slate-300 dark:border-slate-700 hover:border-indigo-400 focus:border-indigo-600 font-semibold" 
                  />
                </div>
              </div>

              {/* Shipping */}
              <div className="space-y-1">
                <Label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">Shipping (₹)</Label>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-indigo-600 dark:text-indigo-400 select-none">₹</span>
                  <Input 
                    type="number" 
                    min="0"
                    value={form.shipping} 
                    onChange={(e) => setForm({ ...form, shipping: e.target.value })}
                    className="h-9 text-xs pl-6 rounded-xl bg-slate-50/70 dark:bg-slate-900/90 border-slate-300 dark:border-slate-700 hover:border-indigo-400 focus:border-indigo-600 font-semibold" 
                  />
                </div>
              </div>

              {/* Other Charges */}
              <div className="space-y-1">
                <Label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">Other Charges (₹)</Label>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-indigo-600 dark:text-indigo-400 select-none">₹</span>
                  <Input 
                    type="number" 
                    min="0"
                    value={form.otherCharges} 
                    onChange={(e) => setForm({ ...form, otherCharges: e.target.value })}
                    className="h-9 text-xs pl-6 rounded-xl bg-slate-50/70 dark:bg-slate-900/90 border-slate-300 dark:border-slate-700 hover:border-indigo-400 focus:border-indigo-600 font-semibold" 
                  />
                </div>
              </div>

              {/* Payment Status */}
              <div className="space-y-1">
                <Label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">Payment Status</Label>
                <div className="relative">
                  <select 
                    value={form.paymentStatus || 'Pending'}
                    onChange={(e) => setForm({ ...form, paymentStatus: e.target.value })}
                    className="w-full h-9 px-2.5 py-1 text-xs border rounded-xl bg-slate-50/70 dark:bg-slate-900/90 border-slate-300 dark:border-slate-700 hover:border-indigo-400 focus:outline-none focus:border-indigo-600 text-slate-700 dark:text-slate-200 font-medium cursor-pointer appearance-none shadow-2xs"
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

            {/* Note / Instructions */}
            <div className="space-y-1">
              <Label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-1">
                <FileText className="w-3 h-3 text-slate-400" />
                Supplier Instructions & Remarks
              </Label>
              <textarea 
                value={form.notes || ''}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={2}
                className="w-full border rounded-xl p-2.5 text-xs bg-slate-50/70 dark:bg-slate-900/90 border-slate-300 dark:border-slate-700 hover:border-indigo-400 focus:outline-none focus:border-indigo-600 focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-indigo-500/20 resize-none shadow-2xs text-slate-800 dark:text-slate-200 font-medium" 
                placeholder="Supplier instructions, delivery location remarks..."
              />
            </div>
          </div>

          {/* Right Column (5 cols): Live Financial Summary Box */}
          <div className="lg:col-span-5 p-3.5 bg-gradient-to-br from-slate-50 via-indigo-50/30 to-slate-50 dark:from-slate-950/80 dark:via-indigo-950/30 dark:to-slate-950/80 rounded-xl border border-indigo-100 dark:border-indigo-900/50 space-y-2 text-xs shadow-xs">
            <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
              <span>Items Subtotal ({form.items.length} items)</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                ₹{subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>

            {/* Tax Breakdown */}
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
                  <span>{cgstLabel}</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    ₹{cgstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
                  <span>{sgstLabel}</span>
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

            {roundOff !== 0 && (
              <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
                <span>Round Off</span>
                <span className={`font-semibold font-mono ${roundOff > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-600 dark:text-slate-400'}`}>
                  {roundOff > 0 ? '+' : ''}₹{roundOff.toFixed(2)}
                </span>
              </div>
            )}

            {/* Grand Total Box */}
            <div className="pt-2.5 border-t border-indigo-200/80 dark:border-indigo-800/80 flex justify-between items-baseline gap-2">
              <div>
                <div className="text-[10px] uppercase tracking-wider font-bold text-indigo-700 dark:text-indigo-300">Grand Total</div>
                <div className="text-[10px] text-slate-400">Includes all taxes & delivery</div>
              </div>
              <div className="text-xl sm:text-2xl font-black text-indigo-600 dark:text-indigo-400 tracking-tight text-right">
                ₹{grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────────────────
          Bottom Action Strip for Fast One-Click Saving
          ─────────────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl px-4 py-3 shadow-xs">
        <div className="text-xs text-slate-500 dark:text-slate-400">
          Total Payable (including taxes): <strong className="text-base text-indigo-600 dark:text-indigo-400 ml-1 font-extrabold">₹{grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            type="button" 
            variant="outline" 
            size="sm" 
            onClick={handleBack}
            className="h-9 px-4 text-xs font-semibold text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-700 rounded-xl"
          >
            Cancel
          </Button>
          <Button 
            type="button" 
            onClick={handleSubmit} 
            disabled={updateMutation.isPending} 
            className="bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white h-9 px-5 rounded-xl text-xs font-bold shadow-md shadow-indigo-600/25 transition-all gap-1.5"
          >
            {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <SaveIcon className="w-4 h-4" />}
            {updateMutation.isPending ? 'Saving Changes...' : 'Save PO Changes'}
          </Button>
        </div>
      </div>

    </div>
  );
}
