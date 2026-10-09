import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { api } from '@/lib/axios';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { format } from 'date-fns';
import {
  CalendarIcon, RefreshCw, ArrowLeft, Loader2, Search, X, ChevronDown,
  AlertTriangle, ShieldAlert, CheckCircle, Tag, Calendar, Scale, Info,
  Package, Clock, AlertCircle
} from 'lucide-react';
import { twMerge } from 'tailwind-merge';
import Swal from 'sweetalert2';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import DatePicker from '@/components/ui/DatePicker';
import { Badge } from '@/components/ui/badge';
import useAuthStore from '@/app/store/authStore';

// Safe date formatter
function formatSafeDate(dateVal, pattern = 'dd-MM-yyyy') {
  if (!dateVal || dateVal === '—' || dateVal === '-' || dateVal === 'N/A' || dateVal === 'null' || dateVal === 'undefined') {
    return '—';
  }
  if (typeof dateVal === 'string' && /^\d{2}-\d{2}-\d{4}$/.test(dateVal.trim())) {
    return dateVal.trim();
  }
  try {
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) {
      return typeof dateVal === 'string' && dateVal.length > 0 && dateVal !== '—' ? dateVal : '—';
    }
    return format(d, pattern);
  } catch {
    return typeof dateVal === 'string' && dateVal.length > 0 && dateVal !== '—' ? dateVal : '—';
  }
}

/**
 * Enhanced RawMaterialSelect:
 * - Fetches upcoming & expired RM stock via FEFO engine (/rm-stock/fefo)
 * - Fetches full Raw Materials catalog (/item-setup/raw-material)
 * - Displays FEFO priority tags: EXPIRED, EXPIRING SOON, and SAFE with batch number, available stock, expiry date, and valuation
 * - Allows quick adding with auto-populated batch traceability
 */
function RawMaterialSelect({ 
  rawMaterials = [], 
  fefoBatches = [], 
  isLoadingRMs = false, 
  isLoadingFefo = false,
  onSelectFefoBatch, 
  onSelectRm, 
  error 
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('FEFO'); // 'FEFO' | 'ALL'
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'EXPIRED' | 'EXPIRING_SOON'
  const containerRef = useRef(null);
  const searchRef = useRef(null);

  // Close when clicking outside
  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
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

  // Filter FEFO batches
  const filteredFefoBatches = useMemo(() => {
    let list = fefoBatches;
    if (statusFilter !== 'ALL') {
      list = list.filter(b => b.healthStatus === statusFilter);
    }
    if (!search.trim()) return list;
    const q = search.trim().toLowerCase();
    return list.filter(b =>
      (b.rawMaterialName && b.rawMaterialName.toLowerCase().includes(q)) ||
      (b.rawMaterialCode && b.rawMaterialCode.toLowerCase().includes(q)) ||
      (b.batchNumber && b.batchNumber.toLowerCase().includes(q)) ||
      (b.mfgBatchNo && b.mfgBatchNo.toLowerCase().includes(q)) ||
      (b.category && b.category.toLowerCase().includes(q))
    );
  }, [fefoBatches, search, statusFilter]);

  // Filter Catalog Raw Materials
  const filteredRMs = useMemo(() => {
    if (!search.trim()) return rawMaterials;
    const q = search.trim().toLowerCase();
    return rawMaterials.filter(rm =>
      (rm.name && rm.name.toLowerCase().includes(q)) ||
      (rm.code && rm.code.toLowerCase().includes(q)) ||
      (rm.category?.name && rm.category.name.toLowerCase().includes(q))
    );
  }, [rawMaterials, search]);

  const expiredCount = useMemo(() => fefoBatches.filter(b => b.healthStatus === 'EXPIRED').length, [fefoBatches]);
  const expiringSoonCount = useMemo(() => fefoBatches.filter(b => b.healthStatus === 'EXPIRING_SOON').length, [fefoBatches]);

  const handlePickFefo = (batch) => {
    onSelectFefoBatch(batch);
    setOpen(false);
    setSearch('');
  };

  const handlePickRm = (rm) => {
    onSelectRm(rm);
    setOpen(false);
    setSearch('');
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <button
        type="button"
        onClick={() => setOpen(prev => !prev)}
        className={twMerge(
          "w-full px-3 py-2 border rounded-xl text-left flex items-center justify-between bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-xs font-semibold h-9 shadow-2xs transition-all",
          error ? "border-red-400 ring-1 ring-red-400" : "border-slate-200 dark:border-slate-800 hover:border-indigo-400",
          open && "ring-2 ring-indigo-500/20 border-indigo-600"
        )}
      >
        <div className="flex items-center gap-2 truncate">
          <span className="text-slate-600 dark:text-slate-300 truncate">
            Select Raw Material or Expired/Upcoming FEFO Batch...
          </span>
          {expiredCount > 0 && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-extrabold bg-rose-100 text-rose-700 dark:bg-rose-950/80 dark:text-rose-300 border border-rose-300 shrink-0">
              {expiredCount} Expired
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0 ml-2">
          <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/70 px-2 py-0.5 rounded-md border border-indigo-200/80 dark:border-indigo-800">
            ⚡ FEFO
          </span>
          <ChevronDown className={twMerge("w-3.5 h-3.5 text-slate-400 transition-transform duration-200", open && "rotate-180")} />
        </div>
      </button>

      {open && (
        <div className="absolute z-50 mt-1.5 w-full min-w-[340px] sm:min-w-[580px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          {/* Header Search & Tabs */}
          <div className="p-3 bg-slate-50/70 dark:bg-slate-950/70 border-b border-slate-200/80 dark:border-slate-800 space-y-2.5">
            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                ref={searchRef}
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search by RM Name, Code, Batch No, or Category..."
                className="w-full pl-9 pr-8 py-2 text-xs border rounded-xl border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium placeholder:text-slate-400"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Navigation Tabs */}
            <div className="flex items-center justify-between gap-2 flex-wrap pt-0.5">
              <div className="flex items-center gap-1.5 p-1 bg-slate-200/60 dark:bg-slate-800/80 rounded-xl text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setActiveTab('FEFO')}
                  className={twMerge(
                    "px-3 py-1 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer",
                    activeTab === 'FEFO'
                      ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs font-bold"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                  )}
                >
                  <span>⚡ FEFO Stock</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-indigo-100 dark:bg-indigo-950 font-bold">
                    {search ? filteredFefoBatches.length : fefoBatches.length}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('ALL')}
                  className={twMerge(
                    "px-3 py-1 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer",
                    activeTab === 'ALL'
                      ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs font-bold"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                  )}
                >
                  <span>📦 All Raw Materials</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-200 dark:bg-slate-800 font-bold">
                    {search ? filteredRMs.length : rawMaterials.length}
                  </span>
                </button>
              </div>

              {/* Status Sub-Filters when FEFO Tab is Active */}
              {activeTab === 'FEFO' && (
                <div className="flex items-center gap-1 text-[10px] font-semibold">
                  <button
                    type="button"
                    onClick={() => setStatusFilter('ALL')}
                    className={twMerge(
                      "px-2 py-0.5 rounded-md border transition-colors cursor-pointer",
                      statusFilter === 'ALL'
                        ? "bg-indigo-600 text-white border-indigo-600 font-bold"
                        : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:border-slate-300"
                    )}
                  >
                    All ({fefoBatches.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatusFilter('EXPIRED')}
                    className={twMerge(
                      "px-2 py-0.5 rounded-md border transition-colors cursor-pointer flex items-center gap-1",
                      statusFilter === 'EXPIRED'
                        ? "bg-rose-600 text-white border-rose-600 font-bold"
                        : "bg-white dark:bg-slate-900 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-900/60 hover:bg-rose-50"
                    )}
                  >
                    <span>🔴 Expired</span>
                    <span>({expiredCount})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatusFilter('EXPIRING_SOON')}
                    className={twMerge(
                      "px-2 py-0.5 rounded-md border transition-colors cursor-pointer flex items-center gap-1",
                      statusFilter === 'EXPIRING_SOON'
                        ? "bg-amber-600 text-white border-amber-600 font-bold"
                        : "bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-900/60 hover:bg-amber-50"
                    )}
                  >
                    <span>🟡 Expiring</span>
                    <span>({expiringSoonCount})</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* List Content */}
          <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/80 p-1">
            {isLoadingFefo || isLoadingRMs ? (
              <div className="py-8 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
                <span>Loading inventory & FEFO expiry stock...</span>
              </div>
            ) : activeTab === 'FEFO' ? (
              filteredFefoBatches.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400 space-y-2">
                  <p className="font-semibold text-slate-500">No matching FEFO batches found</p>
                  {filteredRMs.length > 0 ? (
                    <button
                      type="button"
                      onClick={() => setActiveTab('ALL')}
                      className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-1 cursor-pointer"
                    >
                      Found {filteredRMs.length} matching item(s) in All Raw Materials &rarr;
                    </button>
                  ) : (
                    <p className="text-[11px]">Clear search filters or add stock.</p>
                  )}
                </div>
              ) : (
                filteredFefoBatches.map((b) => {
                  const isExpired = b.healthStatus === 'EXPIRED';
                  const isExpiringSoon = b.healthStatus === 'EXPIRING_SOON';
                  return (
                    <div
                      key={b.id}
                      onClick={() => handlePickFefo(b)}
                      className="p-3 hover:bg-indigo-50/50 dark:hover:bg-slate-800/70 rounded-xl cursor-pointer transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs group"
                    >
                      {/* Left: Material Info & Badges */}
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-slate-900 dark:text-slate-100 text-xs">
                            {b.rawMaterialName}
                          </span>
                          <span className="font-mono text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-1.5 py-0.5 rounded font-bold">
                            {b.rawMaterialCode}
                          </span>
                          
                          {/* Expiry Pill */}
                          {isExpired ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300 border border-rose-300">
                              ⚠️ EXPIRED {b.daysRemaining !== null ? `(${Math.abs(b.daysRemaining)}d ago)` : ''}
                            </span>
                          ) : isExpiringSoon ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300">
                              ⏳ EXPIRES SOON ({b.daysRemaining}d left)
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200">
                              ✅ SAFE
                            </span>
                          )}
                        </div>

                        {/* Batch Details Strip */}
                        <div className="flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400 flex-wrap font-medium">
                          <span>
                            Batch: <b className="font-mono text-indigo-600 dark:text-indigo-400">{b.batchNumber}</b>
                          </span>
                          {b.mfgBatchNo && b.mfgBatchNo !== '—' && (
                            <span>MFG Batch: <b>{b.mfgBatchNo}</b></span>
                          )}
                          <span>
                            Stock: <b className="text-slate-800 dark:text-slate-200">{b.netQty} {b.uom}</b>
                          </span>
                          <span>
                            Exp: <b className={isExpired ? 'text-rose-600' : 'text-slate-700 dark:text-slate-300'}>{formatSafeDate(b.expiryDate)}</b>
                          </span>
                        </div>
                      </div>

                      {/* Right: Valuation & Select Action */}
                      <div className="text-right shrink-0 flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-1">
                        <div>
                          <div className="font-mono font-bold text-xs text-rose-600 dark:text-rose-400">
                            Est. Loss: ₹{Number(b.batchValue || (b.netQty * (b.ratePerUnit || 0))).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            ₹{Number(b.ratePerUnit || 0).toFixed(2)} / {b.uom}
                          </div>
                        </div>
                        <span className="text-[10px] font-bold text-indigo-600 group-hover:underline flex items-center gap-0.5">
                          + Add to Docket →
                        </span>
                      </div>
                    </div>
                  );
                })
              )
            ) : (
              filteredRMs.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400 space-y-2">
                  <p className="font-semibold text-slate-500">No raw materials found in catalog</p>
                  {filteredFefoBatches.length > 0 ? (
                    <button
                      type="button"
                      onClick={() => setActiveTab('FEFO')}
                      className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-1 cursor-pointer"
                    >
                      Found {filteredFefoBatches.length} batch(es) in FEFO Stock &rarr;
                    </button>
                  ) : (
                    <p className="text-[11px]">Clear search query to see all items.</p>
                  )}
                </div>
              ) : (
                filteredRMs.map((rm) => (
                  <div
                    key={rm.id}
                    onClick={() => handlePickRm(rm)}
                    className="p-3 hover:bg-slate-50 dark:hover:bg-slate-800/60 rounded-xl cursor-pointer transition-colors flex items-center justify-between text-xs"
                  >
                    <div className="min-w-0 pr-2 space-y-0.5">
                      <div className="font-bold text-slate-800 dark:text-slate-200">{rm.name}</div>
                      <div className="text-[10px] text-slate-400 flex items-center gap-2">
                        <span className="font-mono bg-slate-100 dark:bg-slate-800 px-1 py-0.2 rounded font-bold text-slate-600 dark:text-slate-300">{rm.code}</span>
                        <span>Category: {rm.category?.name || 'General'}</span>
                        {rm.currentStock !== undefined && (
                          <span>Current Stock: <b>{rm.currentStock} {rm.uom?.abbreviation || rm.uom?.name || 'Units'}</b></span>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 block font-mono">
                        ₹{Number(rm.costPrice || rm.standardPrice || 0).toFixed(2)}
                      </span>
                      <span className="text-[9px] text-slate-400 uppercase font-medium">per {rm.uom?.abbreviation || rm.uom?.name || 'Unit'}</span>
                    </div>
                  </div>
                ))
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Row Batch Selector component to load & pick active FEFO batches for an RM
function RowBatchSelector({ rawMaterialId, rawMaterialCode, currentBatchId, fefoBatches = [], onSelectBatch }) {
  const batches = useMemo(() => {
    return fefoBatches.filter(b => b.rawMaterialId === rawMaterialId || b.rawMaterialCode === rawMaterialCode);
  }, [fefoBatches, rawMaterialId, rawMaterialCode]);

  if (!batches || batches.length === 0) {
    return <span className="text-[10px] text-slate-400 italic">General Stock / No Batch</span>;
  }

  return (
    <select
      value={currentBatchId || ''}
      onChange={(e) => {
        const batch = batches.find(b => b.id === e.target.value);
        onSelectBatch(batch || null);
      }}
      className="w-full text-[11px] font-semibold py-1 px-2 border rounded-lg bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 truncate"
    >
      <option value="">-- General Stock / Pick Batch --</option>
      {batches.map(b => {
        const isExp = b.healthStatus === 'EXPIRED';
        const isSoon = b.healthStatus === 'EXPIRING_SOON';
        const statusTag = isExp ? '[EXPIRED]' : (isSoon ? '[EXPIRING SOON]' : '');
        return (
          <option key={b.id} value={b.id}>
            {b.batchNumber} (Avail: {b.netQty} {b.uom}) {statusTag} {b.expiryDate ? `• Exp: ${formatSafeDate(b.expiryDate)}` : ''}
          </option>
        );
      })}
    </select>
  );
}

export default function CreateRMWastePage() {
  const { id } = useParams();
  const isEditMode = !!id;
  const navigate = useNavigate();
  const location = useLocation();
  const prefillBatch = location.state?.prefillBatch;
  
  const [formData, setFormData] = useState({
    date: new Date(),
    note: '',
    responsibleId: '',
    referenceNo: '',
  });

  const [wasteItems, setWasteItems] = useState([]);
  const [selectedRmForAdd, setSelectedRmForAdd] = useState(null);
  
  const [errorMsg, setErrorMsg] = useState('');
  const [isDataLoaded, setIsDataLoaded] = useState(!isEditMode);

  const { data: refData, refetch: rotateRef, isFetching: isRotating, isLoading: isLoadingRef } = useQuery({
    queryKey: ['rm-waste-next-ref'],
    queryFn: async () => {
      try {
        const response = await api.get('/rm-waste/reference/generate');
        return response.data;
      } catch (err) {
        const fallback = await api.get('/rm-waste/candidate-id');
        return fallback.data;
      }
    },
    enabled: !isEditMode,
  });

  const { data: users = [] } = useQuery({
    queryKey: ['system-users'],
    queryFn: async () => {
      const response = await api.get('/users');
      return response.data;
    }
  });

  const currentUser = useAuthStore((s) => s.user);

  // Auto prefill responsible person with current user in create mode
  useEffect(() => {
    if (!isEditMode && currentUser?.id && !formData.responsibleId) {
      setFormData(prev => ({ ...prev, responsibleId: currentUser.id }));
    }
  }, [currentUser, isEditMode, formData.responsibleId]);

  // 1. Fetch raw materials from correct endpoint
  const { data: rawMaterials = [], isLoading: isLoadingRMs } = useQuery({
    queryKey: ['item-setup-raw-materials'],
    queryFn: async () => {
      const response = await api.get('/item-setup/raw-material');
      return Array.isArray(response.data) ? response.data : (response.data?.data || []);
    }
  });

  // 2. Fetch FEFO upcoming and expired stock
  const { data: fefoData, isLoading: isLoadingFefo } = useQuery({
    queryKey: ['rm-fefo-stock-waste'],
    queryFn: async () => {
      const response = await api.get('/rm-stock/fefo');
      return response.data;
    }
  });

  const fefoBatches = fefoData?.batches || [];

  // Prefill in edit mode
  useEffect(() => {
    if (isEditMode) {
      api.get(`/rm-waste/${id}`)
        .then(res => {
          const waste = res.data;
          setFormData({
            date: new Date(waste.date),
            note: waste.note || '',
            responsibleId: waste.responsibleId || '',
            referenceNo: waste.referenceNo || '',
          });
          
          if (waste.items) {
            setWasteItems(waste.items.map(item => ({
              id: item.id,
              rm: item.rawMaterial,
              quantity: item.quantity,
              uomId: item.uomId,
              lossAmount: item.lossAmount,
              batchId: item.batchId || '',
              batchNumber: item.batchNumber || item.batch?.batchNumber || '',
              mfgBatchNo: item.mfgBatchNo || '',
              weight: item.weight || '',
              mfgDate: item.mfgDate ? item.mfgDate.split('T')[0] : '',
              expiryDate: item.expiryDate ? item.expiryDate.split('T')[0] : '',
              remarks: item.remarks || '',
            })));
          }
          setIsDataLoaded(true);
        })
        .catch(err => {
          console.error(err);
          setErrorMsg('Failed to load raw material waste entry.');
          setIsDataLoaded(true);
        });
    }
  }, [id, isEditMode]);

  // Set reference number when fetched
  useEffect(() => {
    if (!isEditMode && refData?.referenceNo) {
      setFormData(prev => ({ ...prev, referenceNo: refData.referenceNo }));
    }
  }, [refData, isEditMode]);

  // Handle prefill from FEFO page navigation
  useEffect(() => {
    if (!isEditMode && prefillBatch && wasteItems.length === 0) {
      const formattedMfgDate = prefillBatch.mfgDate ? String(prefillBatch.mfgDate).split('T')[0] : '';
      const formattedExpDate = prefillBatch.expiryDate ? String(prefillBatch.expiryDate).split('T')[0] : '';
      
      const noteText = `FEFO Write-off: Expired batch ${prefillBatch.batchNumber || 'N/A'}${prefillBatch.poNumber ? ` (PO: ${prefillBatch.poNumber})` : ''}${prefillBatch.grnNumber ? ` (GRN: ${prefillBatch.grnNumber})` : ''}`;
      
      setFormData(prev => ({
        ...prev,
        note: prev.note || noteText,
      }));

      const syntheticRm = {
        id: prefillBatch.rawMaterialId,
        name: prefillBatch.rawMaterialName,
        code: prefillBatch.rawMaterialCode,
        unitId: prefillBatch.unit,
        currentStock: prefillBatch.availableQty || prefillBatch.quantity || 0,
        unitPrice: prefillBatch.unitPrice || 0,
      };

      setWasteItems([{
        id: crypto.randomUUID(),
        rm: syntheticRm,
        batchId: prefillBatch.batchId || null,
        batchNumber: prefillBatch.batchNumber || '',
        mfgBatchNo: prefillBatch.mfgBatchNo || '',
        weight: prefillBatch.weight || '',
        mfgDate: formattedMfgDate,
        expiryDate: formattedExpDate,
        quantity: prefillBatch.quantity || '',
        uomId: prefillBatch.unit || 'KG',
        lossAmount: prefillBatch.lossAmount || '',
        remarks: `Expired batch ${prefillBatch.batchNumber} moved to waste`,
        isFromFefo: true,
      }]);
    }
  }, [prefillBatch, isEditMode]);

  const createMutation = useMutation({
    mutationFn: async (payload) => {
      const response = await api.post('/rm-waste', payload);
      return response.data;
    },
    onSuccess: () => {
      const isDark = document.documentElement.classList.contains('dark');
      Swal.fire({
        title: `<span class="font-extrabold text-sm text-slate-800 dark:text-slate-100">Waste Logged</span>`,
        html: `<p class="text-xs text-slate-500 dark:text-slate-400 mt-1">Raw material waste docket created successfully and batch stock updated.</p>`,
        icon: 'success',
        iconColor: '#10b981',
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true,
        background: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)',
        color: isDark ? '#f8fafc' : '#0f172a',
        showClass: { popup: 'animate__animated animate__slideInRight animate__faster' },
        hideClass: { popup: 'animate__animated animate__fadeOutRight animate__faster' },
        customClass: {
          popup: 'rounded-2xl border border-emerald-100 dark:border-emerald-950 shadow-xl backdrop-blur-md p-4',
          timerProgressBar: 'bg-emerald-500'
        }
      });
      navigate('/rm/waste');
    },
    onError: (err) => {
      const isDark = document.documentElement.classList.contains('dark');
      Swal.fire({
        title: `<span class="font-extrabold text-sm text-slate-800 dark:text-slate-100">Operation Failed</span>`,
        html: `<p class="text-xs text-slate-500 dark:text-slate-400 mt-1">${err.response?.data?.error || 'Failed to submit wastage.'}</p>`,
        icon: 'error',
        iconColor: '#ef4444',
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3500,
        timerProgressBar: true,
        background: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)',
        color: isDark ? '#f8fafc' : '#0f172a',
        showClass: { popup: 'animate__animated animate__slideInRight animate__faster' },
        hideClass: { popup: 'animate__animated animate__fadeOutRight animate__faster' },
        customClass: {
          popup: 'rounded-2xl border border-red-100 dark:border-red-950 shadow-xl backdrop-blur-md p-4',
          timerProgressBar: 'bg-red-500'
        }
      });
    }
  });

  const updateMutation = useMutation({
    mutationFn: async (payload) => {
      const response = await api.put(`/rm-waste/${id}`, payload);
      return response.data;
    },
    onSuccess: () => {
      const isDark = document.documentElement.classList.contains('dark');
      Swal.fire({
        title: `<span class="font-extrabold text-sm text-slate-800 dark:text-slate-100">Waste Updated</span>`,
        html: `<p class="text-xs text-slate-500 dark:text-slate-400 mt-1">Raw material waste docket updated successfully.</p>`,
        icon: 'success',
        iconColor: '#10b981',
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true,
        background: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)',
        color: isDark ? '#f8fafc' : '#0f172a',
        showClass: { popup: 'animate__animated animate__slideInRight animate__faster' },
        hideClass: { popup: 'animate__animated animate__fadeOutRight animate__faster' },
        customClass: {
          popup: 'rounded-2xl border border-emerald-100 dark:border-emerald-950 shadow-xl backdrop-blur-md p-4',
          timerProgressBar: 'bg-emerald-500'
        }
      });
      navigate('/rm/waste');
    },
    onError: (err) => {
      const isDark = document.documentElement.classList.contains('dark');
      Swal.fire({
        title: `<span class="font-extrabold text-sm text-slate-800 dark:text-slate-100">Operation Failed</span>`,
        html: `<p class="text-xs text-slate-500 dark:text-slate-400 mt-1">${err.response?.data?.error || 'Failed to update wastage.'}</p>`,
        icon: 'error',
        iconColor: '#ef4444',
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3500,
        timerProgressBar: true,
        background: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)',
        color: isDark ? '#f8fafc' : '#0f172a',
        showClass: { popup: 'animate__animated animate__slideInRight animate__faster' },
        hideClass: { popup: 'animate__animated animate__fadeOutRight animate__faster' },
        customClass: {
          popup: 'rounded-2xl border border-red-100 dark:border-red-950 shadow-xl backdrop-blur-md p-4',
          timerProgressBar: 'bg-red-500'
        }
      });
    }
  });

  // Handle selecting a FEFO batch directly from dropdown
  const handleSelectFefoBatch = (batch) => {
    if (!batch) return;

    const alreadyAdded = wasteItems.some(i => i.batchId === batch.id || (i.batchNumber && i.batchNumber === batch.batchNumber));
    if (alreadyAdded) {
      Swal.fire('Already Added', `Batch "${batch.batchNumber}" is already in this waste docket.`, 'info');
      return;
    }

    const matchedRm = rawMaterials.find(r => r.id === batch.rawMaterialId || r.code === batch.rawMaterialCode) || {
      id: batch.rawMaterialId,
      name: batch.rawMaterialName,
      code: batch.rawMaterialCode,
      category: { name: batch.category },
      uom: { name: batch.uom, abbreviation: batch.uom },
      costPrice: batch.ratePerUnit,
    };

    const uomId = matchedRm.uomId || matchedRm.uom?.id || matchedRm.unitId || batch.uom || 'KG';
    const unitCost = Number(batch.ratePerUnit || matchedRm.costPrice || matchedRm.standardPrice || 0);
    const qty = Number(batch.netQty || 1);
    const loss = (qty * unitCost).toFixed(2);

    const formattedMfg = batch.mfgDate ? (typeof batch.mfgDate === 'string' ? batch.mfgDate.split('T')[0] : format(new Date(batch.mfgDate), 'yyyy-MM-dd')) : '';
    const formattedExp = batch.expiryDate ? (typeof batch.expiryDate === 'string' ? batch.expiryDate.split('T')[0] : format(new Date(batch.expiryDate), 'yyyy-MM-dd')) : '';

    const newItem = {
      id: crypto.randomUUID(),
      rm: matchedRm,
      quantity: qty,
      uomId,
      costPrice: unitCost,
      lossAmount: loss,
      batchId: batch.id,
      batchNumber: batch.batchNumber,
      mfgBatchNo: batch.mfgBatchNo || '',
      weight: batch.weight || '',
      mfgDate: formattedMfg,
      expiryDate: formattedExp,
      availableStock: batch.netQty,
      remarks: batch.healthStatus === 'EXPIRED'
        ? `Expired batch ${batch.batchNumber} moved to waste (FEFO)`
        : `FEFO batch ${batch.batchNumber} write-off`,
      isFromFefo: true,
    };

    setWasteItems(prev => [...prev, newItem]);

    if (!formData.note) {
      setFormData(prev => ({
        ...prev,
        note: `FEFO Write-off: Expired batch ${batch.batchNumber} (${batch.rawMaterialName})`
      }));
    }
  };

  // Handle adding catalog raw material
  const handleAddRm = (rm) => {
    if (!rm) return;
    if (wasteItems.some(item => item.rm.id === rm.id && !item.batchId)) {
      const isDark = document.documentElement.classList.contains('dark');
      Swal.fire({
        title: `<span class="font-extrabold text-sm text-slate-800 dark:text-slate-100">Already Added</span>`,
        html: `<p class="text-xs text-slate-500 dark:text-slate-400 mt-1">This raw material is already in the list. You can assign batches or adjust quantity directly.</p>`,
        icon: 'warning',
        iconColor: '#f59e0b',
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3500,
        timerProgressBar: true,
        background: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)',
        color: isDark ? '#f8fafc' : '#0f172a',
        showClass: { popup: 'animate__animated animate__slideInRight animate__faster' },
        hideClass: { popup: 'animate__animated animate__fadeOutRight animate__faster' },
        customClass: {
          popup: 'rounded-2xl border border-amber-100 dark:border-amber-950 shadow-xl backdrop-blur-md p-4',
          timerProgressBar: 'bg-amber-500'
        }
      });
      setSelectedRmForAdd(null);
      return;
    }

    // Auto-check if there's a top FEFO batch for this RM
    const rmFefo = fefoBatches.filter(b => b.rawMaterialId === rm.id || b.rawMaterialCode === rm.code);
    const topBatch = rmFefo[0];
    
    setWasteItems([...wasteItems, {
      id: crypto.randomUUID(),
      rm: rm,
      quantity: topBatch ? topBatch.netQty : '',
      uomId: rm.uomId || rm.uom?.id || rm.unitId || rm.unit || 'KG',
      lossAmount: topBatch ? (Number(topBatch.netQty) * Number(topBatch.ratePerUnit || 0)).toFixed(2) : '',
      batchId: topBatch ? topBatch.id : null,
      batchNumber: topBatch ? topBatch.batchNumber : '',
      mfgBatchNo: topBatch?.mfgBatchNo || '',
      weight: topBatch?.weight || '',
      mfgDate: topBatch?.mfgDate ? (typeof topBatch.mfgDate === 'string' ? topBatch.mfgDate.split('T')[0] : format(new Date(topBatch.mfgDate), 'yyyy-MM-dd')) : '',
      expiryDate: topBatch?.expiryDate ? (typeof topBatch.expiryDate === 'string' ? topBatch.expiryDate.split('T')[0] : format(new Date(topBatch.expiryDate), 'yyyy-MM-dd')) : '',
      remarks: topBatch ? `FEFO batch ${topBatch.batchNumber} write-off` : '',
      isFromFefo: !!topBatch,
    }]);
    setSelectedRmForAdd(null);
  };

  const handleSelectBatchForItem = (itemId, batch) => {
    setWasteItems(prev => prev.map(item => {
      if (item.id !== itemId) return item;
      if (!batch) {
        return {
          ...item,
          batchId: null,
          batchNumber: '',
          mfgBatchNo: '',
          weight: '',
          mfgDate: '',
          expiryDate: '',
        };
      }
      const qty = batch.netQty || batch.availableQty || item.quantity;
      const rate = Number(batch.ratePerUnit || batch.unitPrice || item.rm.standardCost || item.rm.costPrice || 0);
      const calculatedLoss = rate && qty ? (Number(qty) * rate).toFixed(2) : item.lossAmount;

      return {
        ...item,
        batchId: batch.id,
        batchNumber: batch.batchNumber,
        mfgBatchNo: batch.mfgBatchNo || '',
        weight: batch.weight || '',
        mfgDate: batch.mfgDate ? (typeof batch.mfgDate === 'string' ? batch.mfgDate.split('T')[0] : format(new Date(batch.mfgDate), 'yyyy-MM-dd')) : '',
        expiryDate: batch.expiryDate ? (typeof batch.expiryDate === 'string' ? batch.expiryDate.split('T')[0] : format(new Date(batch.expiryDate), 'yyyy-MM-dd')) : '',
        quantity: qty,
        lossAmount: calculatedLoss,
        remarks: item.remarks || (batch.healthStatus === 'EXPIRED' ? `Expired batch ${batch.batchNumber} moved to waste (FEFO)` : `Batch ${batch.batchNumber} write-off`),
        isFromFefo: true,
      };
    }));
  };

  const handleRemoveRm = (itemId) => {
    setWasteItems(wasteItems.filter(item => item.id !== itemId));
  };

  const handleItemChange = (itemId, field, value) => {
    setWasteItems(wasteItems.map(item => {
      if (item.id !== itemId) return item;
      const updated = { ...item, [field]: value };
      
      // Auto-recalc lossAmount if quantity changed and we have a unit rate
      if (field === 'quantity') {
        const rate = Number(item.rm.costPrice || item.rm.unitPrice || item.rm.standardCost || item.rm.standardPrice || 0);
        if (rate > 0 && Number(value) > 0) {
          updated.lossAmount = (Number(value) * rate).toFixed(2);
        }
      }
      return updated;
    }));
  };

  const totalLoss = wasteItems.reduce((acc, item) => acc + (Number(item.lossAmount) || 0), 0);
  const totalQty = wasteItems.reduce((acc, item) => acc + (Number(item.quantity) || 0), 0);

  const handleSubmit = (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (wasteItems.length === 0) {
      setErrorMsg('At least one Raw Material item is required');
      return;
    }
    if (!formData.date) {
      setErrorMsg('Date is required');
      return;
    }
    if (!formData.responsibleId) {
      setErrorMsg('Responsible Person is required');
      return;
    }

    // Validate items
    for (const item of wasteItems) {
      if (!item.quantity || Number(item.quantity) <= 0) {
        setErrorMsg('Quantity must be greater than 0 for all items');
        return;
      }
      if (!item.uomId) {
        setErrorMsg('UOM is required for all items');
        return;
      }
    }

    const payload = {
      date: formData.date.toISOString(),
      note: formData.note,
      responsibleId: formData.responsibleId,
      totalLoss,
      items: wasteItems.map(item => ({
        rawMaterialId: item.rm.id,
        quantity: Number(item.quantity),
        uomId: item.uomId,
        lossAmount: Number(item.lossAmount || 0),
        batchId: item.batchId || null,
        batchNumber: item.batchNumber ? String(item.batchNumber).trim() : null,
        mfgBatchNo: item.mfgBatchNo ? String(item.mfgBatchNo).trim() : null,
        mfgDate: item.mfgDate || null,
        expiryDate: item.expiryDate || null,
        weight: item.weight ? String(item.weight).trim() : null,
        remarks: item.remarks ? String(item.remarks).trim() : null,
      }))
    };

    if (isEditMode) {
      updateMutation.mutate(payload);
    } else {
      createMutation.mutate(payload);
    }
  };

  if (!isDataLoaded) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => navigate('/rm/waste')}
            className="rounded-xl h-9 w-9 p-0 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <ArrowLeft className="w-4 h-4 text-slate-600 dark:text-slate-400" />
          </Button>
          <div>
            <h1 className="text-xl font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
              {isEditMode ? 'Edit RM Waste Docket' : 'Add RM Waste'}
              {prefillBatch && (
                <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border-amber-300 text-[10px] font-bold">
                  FEFO Expired Batch Transfer
                </Badge>
              )}
            </h1>
            <p className="text-xs text-slate-500 font-medium">Log raw material wastage and write-off expired stock with full batch traceability.</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate('/rm/waste')}
            className="rounded-xl h-9 text-xs font-bold border-slate-300 dark:border-slate-700"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={createMutation.isPending || updateMutation.isPending}
            className="rounded-xl h-9 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm flex items-center gap-1.5"
          >
            {(createMutation.isPending || updateMutation.isPending) ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
            {isEditMode ? 'Update Docket' : 'Save Waste Docket'}
          </Button>
        </div>
      </div>

      {errorMsg && (
        <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 rounded-xl text-xs font-semibold flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Main Form Content */}
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs divide-y divide-slate-100 dark:divide-slate-800">
          {/* Metadata Grid */}
          <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label className="text-slate-700 dark:text-slate-300 text-xs font-bold">Reference Number</Label>
              {isLoadingRef && !isEditMode ? (
                <div className="h-9 w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 flex items-center text-xs text-slate-400 font-mono">
                  <Loader2 className="w-3 h-3 mr-2 animate-spin text-indigo-500" />
                  Generating...
                </div>
              ) : (
                <div className="flex gap-2">
                  <Input
                    type="text"
                    value={formData.referenceNo}
                    onChange={(e) => setFormData({ ...formData, referenceNo: e.target.value })}
                    placeholder="e.g. RMW-2026-0001"
                    className="h-9 rounded-xl text-xs font-mono font-bold uppercase tracking-wider bg-slate-50/50 dark:bg-slate-950 border-slate-200 dark:border-slate-800"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => rotateRef()}
                    disabled={isRotating}
                    title="Generate next available sequential reference"
                    className="h-9 w-9 p-0 shrink-0 rounded-xl border-slate-200 dark:border-slate-800"
                  >
                    <RefreshCw className={twMerge("w-4 h-4 text-slate-500", isRotating && "animate-spin")} />
                  </Button>
                </div>
              )}
            </div>

            <DatePicker
              label="Date"
              required
              value={formData.date}
              onChange={(date) => setFormData({ ...formData, date })}
              modalTitle="Waste Log Date"
              placeholder="Select Date"
              triggerClassName="h-9 rounded-xl text-xs font-semibold"
            />

            <div className="space-y-1.5">
              <Label className="text-red-500 font-extrabold uppercase text-[10px]">Responsible Person *</Label>
              <Select 
                items={users.map((u) => ({ value: u.id, label: `${u.name} (${u.role})` }))}
                value={formData.responsibleId} 
                onValueChange={(val) => setFormData(prev => ({ ...prev, responsibleId: val }))} 
                required
              >
                <SelectTrigger className="h-9 w-full rounded-xl text-xs font-semibold border-slate-200 dark:bg-slate-950">
                  <SelectValue placeholder="Select Responsible Person">
                    {(() => {
                      const selectedUser = users.find((u) => u.id === formData.responsibleId);
                      return selectedUser ? `${selectedUser.name} (${selectedUser.role})` : undefined;
                    })()}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="rounded-xl z-50">
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id} className="text-xs font-semibold cursor-pointer">
                      {u.name} ({u.role})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Details Section */}
          <div className="p-5 space-y-4">
            <div className="space-y-1.5 max-w-xl text-xs">
              <div className="flex items-center justify-between">
                <Label className="text-slate-700 dark:text-slate-300 font-bold flex items-center gap-1.5">
                  <Package className="w-3.5 h-3.5 text-indigo-500" />
                  Raw Material (Select to add to docket)
                </Label>
                {fefoBatches.length > 0 && (
                  <span className="text-[10px] font-semibold text-slate-500">
                    ⚡ {fefoBatches.length} FEFO Batches Available
                  </span>
                )}
              </div>
              <RawMaterialSelect 
                rawMaterials={rawMaterials}
                fefoBatches={fefoBatches}
                isLoadingRMs={isLoadingRMs}
                isLoadingFefo={isLoadingFefo}
                onSelectFefoBatch={handleSelectFefoBatch}
                onSelectRm={handleAddRm} 
              />
            </div>

            <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-x-auto shadow-2xs">
              <table className="w-full text-xs text-left min-w-[1050px]">
                <thead className="bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 font-bold border-b border-slate-200 dark:border-slate-800 uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="px-3 py-3 w-10 text-center">SN</th>
                    <th className="px-3 py-3 w-56">Raw Material</th>
                    <th className="px-3 py-3 w-64">Batch & Traceability Info</th>
                    <th className="px-3 py-3 w-36">Stock Info</th>
                    <th className="px-3 py-3 w-36">Quantity *</th>
                    <th className="px-3 py-3 w-36">Loss Amount *</th>
                    <th className="px-3 py-3 w-48">Remarks</th>
                    <th className="px-3 py-3 w-12 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {wasteItems.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-slate-400 bg-white dark:bg-slate-900 font-semibold">
                        No raw materials added yet. Select a raw material or FEFO batch from the dropdown above.
                      </td>
                    </tr>
                  ) : (
                    wasteItems.map((item, idx) => {
                      const isExpired = item.expiryDate && new Date(item.expiryDate) < new Date();
                      return (
                        <tr key={item.id} className="bg-white dark:bg-slate-900 hover:bg-slate-50/40 transition-colors">
                          <td className="px-3 py-3 text-center font-bold text-slate-400">{idx + 1}</td>
                          
                          {/* Raw Material Info */}
                          <td className="px-3 py-3">
                            <div className="font-bold text-slate-800 dark:text-slate-100">
                              {item.rm.name}
                            </div>
                            <div className="text-[10px] font-mono text-indigo-600 dark:text-indigo-400 font-bold">
                              {item.rm.code}
                            </div>
                            {item.isFromFefo && (
                              <span className="inline-block mt-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                                FEFO Selected
                              </span>
                            )}
                          </td>

                          {/* Batch & Traceability Info */}
                          <td className="px-3 py-3 space-y-2">
                            {/* Batch Selection / Display */}
                            <div>
                              <RowBatchSelector
                                rawMaterialId={item.rm.id}
                                rawMaterialCode={item.rm.code}
                                currentBatchId={item.batchId}
                                fefoBatches={fefoBatches}
                                onSelectBatch={(b) => handleSelectBatchForItem(item.id, b)}
                              />
                            </div>

                            {/* Batch Badges & Details */}
                            {item.batchNumber ? (
                              <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800 space-y-1">
                                <div className="flex items-center justify-between gap-1">
                                  <span className="text-[10px] font-bold text-slate-500 uppercase">Batch:</span>
                                  <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400 text-xs">
                                    {item.batchNumber}
                                  </span>
                                </div>
                                
                                {item.weight && (
                                  <div className="flex items-center justify-between text-[10px] text-slate-600 dark:text-slate-400">
                                    <span className="flex items-center gap-0.5"><Scale className="w-2.5 h-2.5" /> Weight:</span>
                                    <span className="font-semibold">{item.weight}</span>
                                  </div>
                                )}
                                
                                {item.mfgBatchNo && (
                                  <div className="flex items-center justify-between text-[10px] text-slate-600 dark:text-slate-400">
                                    <span>MFG Batch:</span>
                                    <span className="font-semibold truncate max-w-[120px]">{item.mfgBatchNo}</span>
                                  </div>
                                )}
                                
                                {item.expiryDate && (
                                  <div className="flex items-center justify-between text-[10px]">
                                    <span className="text-slate-500">Exp Date:</span>
                                    <span className={`font-bold ${isExpired ? 'text-rose-600 dark:text-rose-400' : 'text-slate-700 dark:text-slate-300'}`}>
                                      {item.expiryDate} {isExpired ? '(EXPIRED)' : ''}
                                    </span>
                                  </div>
                                )}
                              </div>
                            ) : null}
                          </td>

                          {/* Stock Info */}
                          <td className="px-3 py-3">
                            <div className="text-[11px] text-slate-600 dark:text-slate-400 space-y-0.5">
                              {item.availableStock !== undefined ? (
                                <div>Stock: <b className="text-slate-800 dark:text-slate-200 font-bold">{item.availableStock}</b></div>
                              ) : item.rm.currentStock !== undefined ? (
                                <div>Stock: <b className="text-slate-800 dark:text-slate-200 font-bold">{item.rm.currentStock}</b></div>
                              ) : null}
                              <div className="text-[10px] text-slate-400">
                                UOM: {item.rm.uom?.abbreviation || item.rm.uom?.name || item.uomId || 'KG'}
                              </div>
                            </div>
                          </td>

                          {/* Quantity */}
                          <td className="px-3 py-3">
                            <div className="flex items-center gap-1.5">
                              <Input
                                type="number"
                                min="0.001"
                                step="any"
                                value={item.quantity}
                                onChange={(e) => handleItemChange(item.id, 'quantity', e.target.value)}
                                placeholder="Qty"
                                className="h-8 text-xs font-bold text-center w-24 rounded-lg bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700"
                                required
                              />
                              <span className="text-[10px] font-bold text-slate-500 uppercase">
                                {item.rm.uom?.abbreviation || item.rm.uom?.name || item.uomId || 'KG'}
                              </span>
                            </div>
                          </td>

                          {/* Loss Amount */}
                          <td className="px-3 py-3">
                            <div className="flex items-center gap-1">
                              <Input
                                type="number"
                                min="0"
                                step="any"
                                value={item.lossAmount}
                                onChange={(e) => handleItemChange(item.id, 'lossAmount', e.target.value)}
                                placeholder="0.00"
                                className="h-8 text-xs font-bold font-mono text-right w-24 rounded-lg bg-rose-50/50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-900"
                                required
                              />
                              <span className="text-[10px] text-slate-400 font-mono">INR</span>
                            </div>
                          </td>

                          {/* Remarks */}
                          <td className="px-3 py-3">
                            <Input
                              type="text"
                              value={item.remarks}
                              onChange={(e) => handleItemChange(item.id, 'remarks', e.target.value)}
                              placeholder="e.g. Expired lot write-off"
                              className="h-8 text-xs rounded-lg bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
                            />
                          </td>

                          {/* Actions */}
                          <td className="px-3 py-3 text-center">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveRm(item.id)}
                              className="h-7 w-7 p-0 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg"
                              title="Remove line item"
                            >
                              <X className="w-3.5 h-3.5" />
                            </Button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Docket Summary Footer */}
            {wasteItems.length > 0 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 bg-slate-50/70 dark:bg-slate-950/60 rounded-xl border border-slate-200/80 dark:border-slate-800 text-xs">
                <div className="flex items-center gap-6">
                  <div>
                    <span className="text-slate-400 block font-medium">Total Items:</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200 text-sm">{wasteItems.length} Material(s)</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-medium">Total Quantity:</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200 text-sm">{totalQty.toFixed(2)}</span>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-slate-400 block font-medium">Total Loss Valuation:</span>
                  <span className="text-lg font-black text-red-600 dark:text-red-400 font-mono">
                    ₹{totalLoss.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            )}

            {/* Docket Notes */}
            <div className="space-y-1.5">
              <Label className="text-slate-700 dark:text-slate-300 text-xs font-bold">General Remarks / Scrap Disposition Note</Label>
              <textarea
                value={formData.note}
                onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                rows={3}
                placeholder="Explain context for waste, write-off approvals, or disposal actions..."
                className="w-full p-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium"
              />
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate('/rm/waste')}
            className="rounded-xl h-10 text-xs font-bold px-5"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={createMutation.isPending || updateMutation.isPending}
            className="rounded-xl h-10 text-xs font-bold px-6 bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm flex items-center gap-2"
          >
            {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="w-4 h-4 animate-spin" />}
            {isEditMode ? 'Update Docket' : 'Save Waste Docket'}
          </Button>
        </div>
      </form>
    </div>
  );
}
