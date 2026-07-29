import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/axios';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { 
  Plus, Search, RefreshCw, X, ChevronDown, ChevronRight, Calendar, Clock, 
  Send, FileText, CheckCircle2, AlertTriangle, Building2, Package, Tag, 
  ArrowUpDown, ExternalLink, ArrowRight, ShieldCheck, Mail, Info, Filter, Trash2, RotateCcw
} from 'lucide-react';
import Swal from 'sweetalert2';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import DatePicker from '@/components/ui/DatePicker';
import { Badge } from '@/components/ui/badge';
import QuickAddSupplierModal from '@/components/forms/QuickAddSupplierModal';

// Multi-Select Supplier Dropdown Component with email sub-text
function MultiSupplierSelect({ suppliers, selectedIds, onChange, onAddNew }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef(null);

  const filtered = suppliers.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) || 
    (s.email && s.email.toLowerCase().includes(search.toLowerCase())) ||
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

  const toggleSupplier = (supId) => {
    if (selectedIds.includes(supId)) {
      onChange(selectedIds.filter(id => id !== supId));
    } else {
      onChange([...selectedIds, supId]);
    }
  };

  const selectedSuppliers = suppliers.filter(s => selectedIds.includes(s.id));

  return (
    <div className="flex gap-2 w-full">
      <div ref={containerRef} className="relative flex-1">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className={`w-full px-4 min-h-[46px] py-2 border rounded-2xl text-left flex items-center justify-between transition-all duration-200 shadow-sm ${
            open 
              ? 'bg-indigo-50/50 border-indigo-400 ring-4 ring-indigo-500/10 dark:bg-indigo-900/10 dark:border-indigo-500' 
              : 'bg-slate-50/50 dark:bg-slate-900/50 border-slate-300 dark:border-slate-700 hover:border-indigo-400 hover:bg-white dark:hover:bg-slate-800'
          }`}
        >
          <div className="flex flex-wrap gap-1.5 items-center max-w-[90%]">
            {selectedSuppliers.length === 0 ? (
              <span className="text-slate-400 text-xs">Select one or more suppliers...</span>
            ) : (
              selectedSuppliers.map(s => (
                <span key={s.id} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 font-bold text-xs">
                  {s.name}
                  <X className="w-3 h-3 cursor-pointer hover:text-rose-500" onClick={(e) => { e.stopPropagation(); toggleSupplier(s.id); }} />
                </span>
              ))
            )}
          </div>
          <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${open ? 'rotate-180 text-indigo-500' : ''}`} />
        </button>

        {open && (
          <div className="absolute z-50 mt-2 w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="p-2.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search Supplier Name or Email..."
                  className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 focus:outline-none focus:border-indigo-500 text-slate-800 dark:text-white"
                  autoFocus
                />
              </div>
            </div>
            <ul className="max-h-60 overflow-y-auto p-1.5 divide-y divide-slate-100 dark:divide-slate-800/50">
              {filtered.length === 0 ? (
                <li className="px-4 py-6 text-xs text-slate-400 text-center">No suppliers found</li>
              ) : (
                filtered.map(s => {
                  const isChecked = selectedIds.includes(s.id);
                  return (
                    <li
                      key={s.id}
                      onClick={() => toggleSupplier(s.id)}
                      className={`px-3.5 py-2.5 rounded-xl text-xs cursor-pointer flex items-center justify-between transition-colors ${
                        isChecked 
                          ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 font-bold' 
                          : 'hover:bg-slate-50 dark:hover:bg-slate-850 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}} // handled by row click
                          className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 dark:border-slate-700"
                        />
                        <div>
                          <div className="font-bold text-slate-800 dark:text-slate-200">{s.name}</div>
                          <div className="text-[11px] text-slate-400 font-mono">{s.email || 'No Email Registered'}</div>
                        </div>
                      </div>
                      {s.phone && <span className="text-[11px] text-slate-400 font-mono">{s.phone}</span>}
                    </li>
                  );
                })
              )}
            </ul>
          </div>
        )}
      </div>
      <Button type="button" onClick={onAddNew} className="bg-indigo-600 hover:bg-indigo-700 text-white shrink-0 px-4 rounded-2xl shadow-sm h-[46px]">
        <Plus className="w-5 h-5" />
      </Button>
    </div>
  );
}

// Searchable Raw Material Dropdown Component
function RawMaterialSelect({ rawMaterials, value, onChange }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef(null);

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

  return (
    <div ref={containerRef} className="relative w-full">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`w-full px-4 h-[44px] border rounded-2xl text-left flex items-center justify-between transition-all duration-200 shadow-sm ${
          open 
            ? 'bg-indigo-50/50 border-indigo-400 ring-4 ring-indigo-500/10 dark:bg-indigo-900/10 dark:border-indigo-500' 
            : 'bg-slate-50/50 dark:bg-slate-900/50 border-slate-300 dark:border-slate-700 hover:border-indigo-400 hover:bg-white dark:hover:bg-slate-800'
        }`}
      >
        <span className={value ? 'text-slate-900 dark:text-white truncate font-medium text-xs' : 'text-slate-400 text-xs'}>
          {value ? `${value.name} (${value.code || 'N/A'})` : 'Select Raw Material to Add...'}
        </span>
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${open ? 'rotate-180 text-indigo-500' : ''}`} />
      </button>

      {open && (
        <div className="absolute z-50 mt-2 w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in duration-200">
          <div className="p-2 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50">
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search Material Name or Code..."
              className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 focus:outline-none focus:border-indigo-500 text-slate-800 dark:text-white"
              autoFocus
            />
          </div>
          <ul className="max-h-60 overflow-y-auto p-1 divide-y divide-slate-100 dark:divide-slate-800/40">
            {filtered.length === 0 ? (
              <li className="px-4 py-6 text-xs text-slate-400 text-center">No materials found</li>
            ) : (
              filtered.map(rm => (
                <li
                  key={rm.id}
                  onClick={() => { onChange(rm); setOpen(false); setSearch(''); }}
                  className="px-3.5 py-2 rounded-xl text-xs cursor-pointer hover:bg-indigo-50 hover:text-indigo-700 dark:hover:bg-indigo-950/40 dark:hover:text-indigo-300 transition-colors flex items-center justify-between"
                >
                  <span className="font-bold text-slate-800 dark:text-slate-200">{rm.name}</span>
                  <span className="font-mono text-slate-400 text-[11px]">{rm.code}</span>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

// Live Countdown Chip Component for Quotation Row (Dynamic 4-Quartile Logic)
function TimeRemainingChip({ expiryAt, createdAt, status }) {
  const [timeStr, setTimeStr] = useState('');
  const [chipColor, setChipColor] = useState('');

  useEffect(() => {
    const updateTime = () => {
      if (status === 'EXPIRED') {
        setTimeStr('Expired');
        setChipColor('bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400');
        return;
      }

      const expiry = new Date(expiryAt).getTime();
      const created = createdAt ? new Date(createdAt).getTime() : expiry - (48 * 60 * 60 * 1000);
      const now = new Date().getTime();

      const diff = expiry - now;
      if (diff <= 0) {
        setTimeStr('Expired');
        setChipColor('bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400');
        return;
      }

      const totalDuration = Math.max(1, expiry - created);
      const remainingRatio = diff / totalDuration;

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

      let formatted = '';
      if (days > 0) formatted = `${days}d ${hours}h left`;
      else if (hours > 0) formatted = `${hours}h ${minutes}m left`;
      else formatted = `${minutes}m left`;

      setTimeStr(formatted);

      if (remainingRatio > 0.75) {
        // Q1: Green
        setChipColor('bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800');
      } else if (remainingRatio > 0.50) {
        // Q2: Orange
        setChipColor('bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400 border border-amber-200 dark:border-amber-800');
      } else if (remainingRatio > 0.25) {
        // Q3: Red
        setChipColor('bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400 border border-rose-200 dark:border-rose-800');
      } else {
        // Q4: Red with alert pulse / bounce animation
        setChipColor('bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border border-rose-400 dark:border-rose-600 animate-pulse font-extrabold');
      }
    };

    updateTime();
    const timer = setInterval(updateTime, 5000);
    return () => clearInterval(timer);
  }, [expiryAt, createdAt, status]);

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold font-mono ${chipColor}`}>
      <Clock className="w-3.5 h-3.5" />
      {timeStr}
    </span>
  );
}

export default function RMQuotationPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // Slide-over panel state
  const [showCreatePanel, setShowCreatePanel] = useState(false);
  const [showAddSupplierModal, setShowAddSupplierModal] = useState(false);

  // Filters State
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchFilter, setSearchFilter] = useState('');
  const [expandedRowId, setExpandedRowId] = useState(null);
  const [sortAsc, setSortAsc] = useState(true);

  // Create Form State
  const [quotationDate, setQuotationDate] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [expiryDate, setExpiryDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 5);
    return format(d, 'yyyy-MM-dd');
  });
  const [expiryTime, setExpiryTime] = useState('18:00');
  const [selectedSupplierIds, setSelectedSupplierIds] = useState([]);
  const [instructionNote, setInstructionNote] = useState('');
  const [quotationItems, setQuotationItems] = useState([]);

  // Fetch Raw Materials from /rm-stock (working API)
  const { data: rawMaterials = [] } = useQuery({
    queryKey: ['rawMaterials'],
    queryFn: async () => {
      try {
        const res = await api.get('/rm-stock');
        return res.data || [];
      } catch (err) {
        const res = await api.get('/item-setup/raw-material');
        return res.data || [];
      }
    }
  });

  // Fetch Suppliers
  const { data: suppliers = [] } = useQuery({
    queryKey: ['suppliers'],
    queryFn: () => api.get('/parties/suppliers').then(r => r.data)
  });

  // Fetch RM Quotations List
  const { data: quotationsData = [], isLoading, refetch } = useQuery({
    queryKey: ['rmQuotations', statusFilter, searchFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter !== 'ALL') params.append('status', statusFilter);
      if (searchFilter) params.append('search', searchFilter);
      const res = await api.get(`/rm-quotations?${params.toString()}`);
      return res.data.data || [];
    }
  });

  // Create Quotation Mutation
  const createMutation = useMutation({
    mutationFn: (payload) => api.post('/rm-quotations', payload).then(r => r.data),
    onSuccess: (data) => {
      queryClient.invalidateQueries(['rmQuotations']);
      setShowCreatePanel(false);
      resetCreateForm();
      Swal.fire({
        icon: 'success',
        title: 'Quotation Request Sent!',
        text: 'The quotation request has been saved and unique links have been emailed to selected suppliers.',
        confirmButtonColor: '#4f46e5'
      });
    },
    onError: (err) => {
      console.error('[Create Quotation Error]', err);
      Swal.fire('Error', err.response?.data?.message || 'Failed to send quotation request', 'error');
    }
  });

  const resetCreateForm = () => {
    setQuotationDate(format(new Date(), 'yyyy-MM-dd'));
    const d = new Date();
    d.setDate(d.getDate() + 5);
    setExpiryDate(format(d, 'yyyy-MM-dd'));
    setExpiryTime('18:00');
    setSelectedSupplierIds([]);
    setInstructionNote('');
    setQuotationItems([]);
  };

  const handleAddMaterialItem = (rm) => {
    if (!rm) return;
    if (quotationItems.some(it => it.materialId === rm.id)) {
      Swal.fire('Already Added', 'This raw material is already in the request table.', 'info');
      return;
    }

    setQuotationItems([
      ...quotationItems,
      {
        materialId: rm.id,
        materialName: rm.name,
        materialCode: rm.code,
        quantity: 1,
        unit: rm.consumptionUnit || rm.unit || 'Kg',
        gstApplicable: true
      }
    ]);
  };

  const updateItemQty = (index, val) => {
    const updated = [...quotationItems];
    updated[index].quantity = val;
    setQuotationItems(updated);
  };

  const toggleItemGst = (index) => {
    const updated = [...quotationItems];
    updated[index].gstApplicable = !updated[index].gstApplicable;
    setQuotationItems(updated);
  };

  const removeItem = (index) => {
    setQuotationItems(quotationItems.filter((_, i) => i !== index));
  };

  const handleSendQuotationRequest = (e) => {
    e.preventDefault();

    if (selectedSupplierIds.length === 0) {
      Swal.fire('Missing Suppliers', 'Please select at least one supplier for this quotation request.', 'warning');
      return;
    }

    if (quotationItems.length === 0) {
      Swal.fire('Missing Items', 'Please add at least one raw material item to the request table.', 'warning');
      return;
    }

    const expiryAtISO = `${expiryDate}T${expiryTime}:00`;

    const payload = {
      quotationDate,
      expiryAt: expiryAtISO,
      note: instructionNote,
      supplierIds: selectedSupplierIds,
      items: quotationItems.map(it => ({
        materialId: it.materialId,
        materialName: it.materialName,
        materialCode: it.materialCode,
        quantity: Number(it.quantity) || 1,
        unit: it.unit,
        gstApplicable: it.gstApplicable
      }))
    };

    createMutation.mutate(payload);
  };

  // Convert Supplier Response to Direct Order Prefill
  const handleTurnIntoDirectOrder = (quotation, supplierRow, response) => {
    if (!response) return;

    // Match response items with quotation items
    const prefilledItems = response.items.map(ri => {
      const qItem = quotation.items.find(qi => qi.id === ri.quotationItemId);
      return {
        materialId: qItem?.materialId,
        materialName: qItem?.materialName || 'Raw Material',
        materialCode: qItem?.materialCode || '',
        quantity: Number(qItem?.quantity) || 1,
        unit: qItem?.unit || 'Kg',
        unitPrice: Number(ri.unitPrice) || 0,
        gstApplicable: qItem?.gstApplicable ?? true,
        gstRate: Number(ri.gstRate) || 18,
        lineTotal: Number(ri.lineSubtotal) || 0
      };
    });

    const prefillState = {
      quotationId: quotation.id,
      supplier: supplierRow.supplier,
      supplierId: supplierRow.supplierId,
      items: prefilledItems,
      discount: Number(response.discount) || 0,
      shipping: Number(response.shipping) || 0,
      otherCharges: Number(response.otherCharges) || 0,
      supplierNote: response.supplierNote || '',
      purchaseStatus: 'PENDING',
      referenceNo: `DO-FROM-${quotation.quotationNo}`
    };

    navigate('/purchase-orders/create', { state: { prefillFromQuotation: prefillState } });
  };

  const handleResendSupplierLink = async (quotationId, supplierId) => {
    try {
      const res = await api.post(`/rm-quotations/${quotationId}/resend-supplier-link`, { supplierId });
      if (res.data.success) {
        Swal.fire({
          icon: 'success',
          title: 'Resubmission Approved & Sent!',
          text: res.data.message || 'Resubmission access link has been emailed to the supplier.',
          confirmButtonColor: '#4f46e5'
        });
        refetch();
      }
    } catch (err) {
      console.error('[Resend Error]', err);
      const isRateLimited = err.response?.status === 429;
      Swal.fire({
        icon: isRateLimited ? 'warning' : 'error',
        title: isRateLimited ? 'Rate Limit Cooldown Active' : 'Error',
        text: err.response?.data?.message || 'Failed to resend access link.',
        confirmButtonColor: isRateLimited ? '#f59e0b' : '#ef4444'
      });
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'DRAFT':
        return <Badge variant="outline" className="bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">Draft</Badge>;
      case 'SENT':
        return <Badge variant="outline" className="bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400 border-blue-200">Sent</Badge>;
      case 'PARTIALLY_RESPONDED':
        return <Badge variant="outline" className="bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400 border-amber-200">Partially Responded</Badge>;
      case 'ALL_RESPONDED':
        return <Badge variant="outline" className="bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border-emerald-200">All Responded</Badge>;
      case 'EXPIRED':
        return <Badge variant="outline" className="bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">Expired</Badge>;
      case 'CONVERTED':
        return <Badge variant="outline" className="bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-400 border-purple-200">Converted</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-[1600px] mx-auto min-h-screen">
      
      {/* HEADER BAR WITH TOP-RIGHT "+ NEW QUOTATION" BUTTON */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
              <FileText className="w-5 h-5" />
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">RM Quotations</h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Request raw material pricing from multiple suppliers via secure links & compare submitted quotes.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            onClick={() => refetch()}
            variant="outline"
            size="icon"
            className="rounded-xl border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300"
            title="Refresh List"
          >
            <RefreshCw className="w-4 h-4" />
          </Button>

          {/* "+ New Quotation" Button matching "+" button style next to Supplier on Direct Order */}
          <Button
            onClick={() => setShowCreatePanel(true)}
            className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-extrabold text-xs rounded-2xl px-5 h-11 shadow-lg shadow-indigo-600/20 transition-all hover:scale-105 flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>New Quotation</span>
          </Button>
        </div>
      </div>

      {/* FILTER BAR */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          
          {/* Search filter */}
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchFilter}
              onChange={e => setSearchFilter(e.target.value)}
              placeholder="Search Quotation ID, Material..."
              className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-950 focus:outline-none focus:border-indigo-500 text-slate-800 dark:text-white"
            />
          </div>

          {/* Status Filter Tabs */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-950 p-1 rounded-xl border border-slate-200 dark:border-slate-800 text-xs overflow-x-auto">
            {['ALL', 'SENT', 'PARTIALLY_RESPONDED', 'ALL_RESPONDED', 'EXPIRED', 'CONVERTED'].map(st => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all whitespace-nowrap ${
                  statusFilter === st 
                    ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm' 
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                {st === 'ALL' ? 'All Status' : st.replace(/_/g, ' ')}
              </button>
            ))}
          </div>
        </div>

        <div className="text-xs text-slate-400 font-medium">
          Showing <span className="font-bold text-slate-700 dark:text-slate-200">{quotationsData.length}</span> quotation requests
        </div>
      </div>

      {/* QUOTATION LIST TABLE (EXPANDABLE QUOTATION-WISE) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
        {isLoading ? (
          <div className="p-12 text-center text-slate-400 space-y-3">
            <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin mx-auto" />
            <p className="text-xs">Loading RM Quotations...</p>
          </div>
        ) : quotationsData.length === 0 ? (
          <div className="p-16 text-center text-slate-400 space-y-4">
            <FileText className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto" />
            <div>
              <h3 className="text-base font-bold text-slate-700 dark:text-slate-300">No RM Quotations Found</h3>
              <p className="text-xs text-slate-500 mt-1">Create a quotation request to send to suppliers and receive pricing.</p>
            </div>
            <Button
              onClick={() => setShowCreatePanel(true)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl px-4 py-2"
            >
              <Plus className="w-4 h-4 mr-1.5" /> Create First Quotation
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
              <thead className="bg-slate-50 dark:bg-slate-950/80 text-slate-400 uppercase font-semibold text-[11px] tracking-wider border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-4 py-3.5 w-10"></th>
                  <th className="px-4 py-3.5 min-w-[140px]">Quotation ID</th>
                  <th className="px-4 py-3.5 min-w-[110px]">Created On</th>
                  <th className="px-4 py-3.5 min-w-[110px]">Expires On</th>
                  <th className="px-4 py-3.5 min-w-[130px]">Time Remaining</th>
                  <th className="px-4 py-3.5 text-center">Suppliers Sent</th>
                  <th className="px-4 py-3.5 text-center">Responses In</th>
                  <th className="px-4 py-3.5 text-right min-w-[130px]">Lowest Total (₹)</th>
                  <th className="px-4 py-3.5 text-center min-w-[120px]">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-medium">
                {quotationsData.map(q => {
                  const isExpanded = expandedRowId === q.id;

                  // Sort supplier responses cheapest first by default
                  const sortedSuppliers = [...q.suppliers].sort((a, b) => {
                    const totalA = a.responses[0] ? Number(a.responses[0].grandTotal) : Infinity;
                    const totalB = b.responses[0] ? Number(b.responses[0].grandTotal) : Infinity;
                    return sortAsc ? totalA - totalB : totalB - totalA;
                  });

                  return (
                    <React.Fragment key={q.id}>
                      {/* TOP LEVEL QUOTATION ROW */}
                      <tr 
                        onClick={() => setExpandedRowId(isExpanded ? null : q.id)}
                        className={`cursor-pointer transition-colors ${
                          isExpanded 
                            ? 'bg-indigo-50/50 dark:bg-indigo-950/20' 
                            : 'hover:bg-slate-50/80 dark:hover:bg-slate-850/50'
                        }`}
                      >
                        <td className="px-4 py-4 text-slate-400">
                          <ChevronRight className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? 'rotate-90 text-indigo-500' : ''}`} />
                        </td>
                        <td className="px-4 py-4">
                          <span className="font-extrabold text-indigo-600 dark:text-indigo-400 font-mono text-sm">{q.quotationNo}</span>
                          <div className="text-[11px] text-slate-400 mt-0.5">{q.items?.length || 0} material items requested</div>
                        </td>
                        <td className="px-4 py-4 font-mono text-slate-600 dark:text-slate-400">
                          {format(new Date(q.createdAt), 'dd MMM yyyy')}
                        </td>
                        <td className="px-4 py-4 font-mono text-slate-600 dark:text-slate-400">
                          {format(new Date(q.expiryAt), 'dd MMM, HH:mm')}
                        </td>
                        <td className="px-4 py-4">
                          <TimeRemainingChip expiryAt={q.expiryAt} createdAt={q.createdAt} status={q.status} />
                        </td>
                        <td className="px-4 py-4 text-center font-bold text-slate-700 dark:text-slate-300">
                          {q.totalSent}
                        </td>
                        <td className="px-4 py-4 text-center">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold font-mono ${
                            q.responsesIn > 0 ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400' : 'bg-slate-100 text-slate-500'
                          }`}>
                            {q.responsesIn} / {q.totalSent}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-right font-mono font-extrabold text-sm text-slate-900 dark:text-white">
                          {q.lowestTotal !== null ? (
                            <span className="text-emerald-600 dark:text-emerald-400">
                              ₹ {q.lowestTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          ) : (
                            <span className="text-slate-400 text-xs font-normal">Pending</span>
                          )}
                        </td>
                        <td className="px-4 py-4 text-center">
                          {getStatusBadge(q.status)}
                        </td>
                      </tr>

                      {/* EXPANDED PER-SUPPLIER BREAKDOWN ROW */}
                      {isExpanded && (
                        <tr>
                          <td colSpan={9} className="px-6 py-4 bg-slate-50/80 dark:bg-slate-950/60 border-y border-slate-200 dark:border-slate-800">
                            <div className="space-y-3">
                              
                              <div className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-wider">
                                <div className="flex items-center gap-2">
                                  <Building2 className="w-4 h-4 text-indigo-500" />
                                  <span>Supplier Responses Breakdown for {q.quotationNo}</span>
                                </div>

                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); setSortAsc(!sortAsc); }}
                                  className="inline-flex items-center gap-1 text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                                >
                                  <ArrowUpDown className="w-3 h-3" />
                                  <span>Sort by Total ({sortAsc ? 'Cheapest First' : 'Highest First'})</span>
                                </button>
                              </div>

                              <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-white dark:bg-slate-900 shadow-inner">
                                <table className="w-full text-left text-xs">
                                  <thead className="bg-slate-100 dark:bg-slate-950 text-slate-400 text-[10px] uppercase font-semibold border-b border-slate-200 dark:border-slate-800">
                                    <tr>
                                      <th className="px-4 py-2.5">Supplier</th>
                                      <th className="px-4 py-2.5">Email</th>
                                      <th className="px-4 py-2.5">Responded On</th>
                                      <th className="px-4 py-2.5 text-right">Subtotal (₹)</th>
                                      <th className="px-4 py-2.5 text-right">Discount</th>
                                      <th className="px-4 py-2.5 text-right">Shipping</th>
                                      <th className="px-4 py-2.5 text-right">Other</th>
                                      <th className="px-4 py-2.5 text-right">GST Tax</th>
                                      <th className="px-4 py-2.5 text-right font-bold">Grand Total (₹)</th>
                                      <th className="px-4 py-2.5 text-center">Action</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                                    {sortedSuppliers.map((supRow, idx) => {
                                      const resp = supRow.responses[0]; // latest response
                                      const isCheapest = idx === 0 && resp;

                                      return (
                                        <tr key={supRow.id} className={isCheapest ? 'bg-emerald-50/30 dark:bg-emerald-950/20' : 'hover:bg-slate-50 dark:hover:bg-slate-850'}>
                                          <td className="px-4 py-3 font-bold text-slate-800 dark:text-slate-200">
                                            <div className="flex items-center gap-2">
                                              <span>{supRow.supplier?.name}</span>
                                              {supRow.status === 'RESUBMISSION_REQUESTED' && (
                                                <span className="px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px] font-extrabold border border-amber-500/20 animate-pulse">
                                                  Resubmission Requested
                                                </span>
                                              )}
                                              {isCheapest && (
                                                <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-extrabold border border-emerald-500/20">
                                                  Lowest Quote
                                                </span>
                                              )}
                                            </div>
                                          </td>
                                          <td className="px-4 py-3 font-mono text-slate-400 text-[11px]">
                                            {supRow.supplierEmail || supRow.supplier?.email || 'N/A'}
                                          </td>
                                          <td className="px-4 py-3 font-mono text-slate-500">
                                            {supRow.respondedAt ? format(new Date(supRow.respondedAt), 'dd MMM, HH:mm') : <span className="text-slate-400 italic">No response yet</span>}
                                          </td>
                                          <td className="px-4 py-3 text-right font-mono text-slate-600 dark:text-slate-300">
                                            {resp ? `₹ ${Number(resp.subtotal).toFixed(2)}` : '—'}
                                          </td>
                                          <td className="px-4 py-3 text-right font-mono text-rose-500">
                                            {resp && Number(resp.discount) > 0 ? `- ₹ ${Number(resp.discount).toFixed(2)}` : '—'}
                                          </td>
                                          <td className="px-4 py-3 text-right font-mono text-slate-600 dark:text-slate-300">
                                            {resp && Number(resp.shipping) > 0 ? `₹ ${Number(resp.shipping).toFixed(2)}` : '—'}
                                          </td>
                                          <td className="px-4 py-3 text-right font-mono text-slate-600 dark:text-slate-300">
                                            {resp && Number(resp.otherCharges) > 0 ? `₹ ${Number(resp.otherCharges).toFixed(2)}` : '—'}
                                          </td>
                                          <td className="px-4 py-3 text-right font-mono text-slate-600 dark:text-slate-300">
                                            {resp ? `₹ ${Number(resp.taxTotal).toFixed(2)}` : '—'}
                                          </td>
                                          <td className="px-4 py-3 text-right font-mono font-extrabold text-sm text-slate-900 dark:text-white">
                                            {resp ? (
                                              <span className={isCheapest ? 'text-emerald-600 dark:text-emerald-400' : ''}>
                                                ₹ {Number(resp.grandTotal).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                              </span>
                                            ) : (
                                              <span className="text-slate-400 text-xs font-normal">Pending</span>
                                            )}
                                          </td>
                                          <td className="px-4 py-3 text-center">
                                            <div className="flex items-center justify-center gap-2">
                                              {supRow.status === 'RESUBMISSION_REQUESTED' ? (
                                                <Button
                                                  type="button"
                                                  disabled={q.status === 'CONVERTED'}
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (q.status === 'CONVERTED') return;
                                                    handleResendSupplierLink(q.id, supRow.supplierId);
                                                  }}
                                                  className="bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-extrabold text-[11px] rounded-xl px-3 py-1.5 h-8 shadow-sm transition-all hover:scale-105 flex items-center gap-1.5 shrink-0"
                                                  title={q.status === 'CONVERTED' ? 'Quotation already converted to PO' : 'Supplier requested to update pricing. Click to approve & resend email link.'}
                                                >
                                                  <RotateCcw className="w-3.5 h-3.5" />
                                                  <span>Approve Resubmission</span>
                                                </Button>
                                              ) : (
                                                <button
                                                  type="button"
                                                  disabled={q.status === 'CONVERTED'}
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (q.status === 'CONVERTED') return;
                                                    handleResendSupplierLink(q.id, supRow.supplierId);
                                                  }}
                                                  className="p-1.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                                  title={q.status === 'CONVERTED' ? 'Quotation already converted to PO' : 'Re-send access link to supplier'}
                                                >
                                                  <Send className="w-3.5 h-3.5" />
                                                </button>
                                              )}

                                              <Button
                                                type="button"
                                                disabled={!resp || q.status === 'CONVERTED'}
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  if (q.status === 'CONVERTED') return;
                                                  handleTurnIntoDirectOrder(q, supRow, resp);
                                                }}
                                                className={
                                                  q.status === 'CONVERTED'
                                                    ? "bg-purple-500/10 text-purple-600 dark:text-purple-400 font-extrabold text-[11px] rounded-xl px-3 py-1.5 h-8 border border-purple-500/20 flex items-center gap-1.5 shrink-0 cursor-not-allowed opacity-80"
                                                    : "bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white font-extrabold text-[11px] rounded-xl px-3 py-1.5 h-8 shadow-sm transition-all hover:scale-105 flex items-center gap-1.5 shrink-0"
                                                }
                                              >
                                                <span>{q.status === 'CONVERTED' ? 'Converted to Order' : 'Turn into Direct Order'}</span>
                                                {q.status !== 'CONVERTED' && <ArrowRight className="w-3.5 h-3.5" />}
                                              </Button>
                                            </div>
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* CREATE RM QUOTATION SLIDE-OVER PANEL / MODAL */}
      {showCreatePanel && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex justify-end animate-in fade-in duration-200">
          <div className="w-full max-w-3xl bg-white dark:bg-slate-900 h-full overflow-y-auto border-l border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col justify-between">
            
            {/* PANEL HEADER WITH PURPLE-PINK GRADIENT */}
            <div>
              <div className="bg-gradient-to-r from-purple-700 via-indigo-700 to-violet-700 p-6 text-white relative">
                <button
                  type="button"
                  onClick={() => setShowCreatePanel(false)}
                  className="absolute top-5 right-5 p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-2xl bg-white/10 border border-white/20">
                    <FileText className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-extrabold tracking-tight">Create RM Quotation Request</h2>
                    <p className="text-xs text-purple-200 mt-0.5">Send pricing requests to multiple suppliers via secure link</p>
                  </div>
                </div>
              </div>

              {/* PANEL BODY FORM */}
              <form id="createQuoteForm" onSubmit={handleSendQuotationRequest} className="p-6 space-y-6">
                
                {/* 1. GENERAL DETAILS SECTION */}
                <div className="bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 space-y-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 flex items-center gap-2">
                    <Building2 className="w-4 h-4" />
                    <span>General Details</span>
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs text-slate-500 dark:text-slate-400">Quotation Date</Label>
                      <Input
                        type="date"
                        value={quotationDate}
                        onChange={e => setQuotationDate(e.target.value)}
                        className="mt-1 font-mono text-xs rounded-2xl bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700"
                        required
                      />
                    </div>

                    <div>
                      <Label className="text-xs text-indigo-600 dark:text-indigo-400 font-bold">Expiry Date & Time* (Deadline)</Label>
                      <div className="grid grid-cols-2 gap-2 mt-1">
                        <Input
                          type="date"
                          value={expiryDate}
                          onChange={e => setExpiryDate(e.target.value)}
                          className="font-mono text-xs rounded-2xl bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700"
                          required
                        />
                        <Input
                          type="time"
                          value={expiryTime}
                          onChange={e => setExpiryTime(e.target.value)}
                          className="font-mono text-xs rounded-2xl bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700"
                          required
                        />
                      </div>
                    </div>
                  </div>

                  {/* Multi-Select Suppliers */}
                  <div>
                    <Label className="text-xs text-indigo-600 dark:text-indigo-400 font-bold">Select Suppliers* (Multi-Select)</Label>
                    <div className="mt-1">
                      <MultiSupplierSelect
                        suppliers={suppliers}
                        selectedIds={selectedSupplierIds}
                        onChange={setSelectedSupplierIds}
                        onAddNew={() => setShowAddSupplierModal(true)}
                      />
                    </div>
                  </div>
                </div>

                {/* 2. SELECT RAW MATERIAL TO ADD SECTION */}
                <div className="bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 space-y-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 flex items-center gap-2">
                    <Package className="w-4 h-4" />
                    <span>Select Raw Material to Add</span>
                  </h3>

                  <div className="w-full">
                    <RawMaterialSelect
                      rawMaterials={rawMaterials}
                      value={null}
                      onChange={handleAddMaterialItem}
                    />
                  </div>

                  {/* Requested Items Table */}
                  <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-white dark:bg-slate-900 shadow-inner">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100 dark:bg-slate-950 text-slate-400 uppercase font-semibold text-[10px]">
                        <tr>
                          <th className="px-3 py-2.5 w-10 text-center">#</th>
                          <th className="px-3 py-2.5">Material Details</th>
                          <th className="px-3 py-2.5 w-28 text-center">Quantity</th>
                          <th className="px-3 py-2.5 w-20">Unit</th>
                          <th className="px-3 py-2.5 text-center w-28">GST Applicable</th>
                          <th className="px-3 py-2.5 text-center w-12">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                        {quotationItems.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="px-4 py-8 text-center text-slate-400 italic">
                              No raw materials added yet. Select a material above to add to request.
                            </td>
                          </tr>
                        ) : (
                          quotationItems.map((item, index) => (
                            <tr key={index} className="hover:bg-slate-50 dark:hover:bg-slate-850">
                              <td className="px-3 py-2.5 text-center font-mono text-slate-400">{index + 1}</td>
                              <td className="px-3 py-2.5">
                                <div className="font-bold text-slate-800 dark:text-slate-200">{item.materialName}</div>
                                {item.materialCode && <div className="text-[10px] font-mono text-slate-400">{item.materialCode}</div>}
                              </td>
                              <td className="px-3 py-2.5">
                                <Input
                                  type="number"
                                  min="0.01"
                                  step="0.01"
                                  value={item.quantity}
                                  onChange={e => updateItemQty(index, e.target.value)}
                                  className="h-8 font-mono text-xs text-center rounded-xl bg-slate-50 dark:bg-slate-950 border-slate-300 dark:border-slate-700"
                                />
                              </td>
                              <td className="px-3 py-2.5 font-bold text-slate-600 dark:text-slate-300">{item.unit}</td>
                              <td className="px-3 py-2.5 text-center">
                                <button
                                  type="button"
                                  onClick={() => toggleItemGst(index)}
                                  className={`px-2.5 py-1 rounded-xl text-[10px] font-extrabold border transition-all ${
                                    item.gstApplicable 
                                      ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border-indigo-200' 
                                      : 'bg-slate-100 text-slate-500 border-slate-200'
                                  }`}
                                >
                                  {item.gstApplicable ? 'Yes' : 'No'}
                                </button>
                              </td>
                              <td className="px-3 py-2.5 text-center">
                                <button
                                  type="button"
                                  onClick={() => removeItem(index)}
                                  className="text-rose-400 hover:text-rose-600 p-1"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* 3. ADDITIONAL NOTE / INSTRUCTIONS */}
                <div className="bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 space-y-2">
                  <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Instructions visible to supplier (Optional)
                  </Label>
                  <textarea
                    rows={3}
                    value={instructionNote}
                    onChange={e => setInstructionNote(e.target.value)}
                    placeholder="Enter special instructions or requirements visible to selected suppliers..."
                    className="w-full p-3 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-2xl text-slate-800 dark:text-slate-200 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </form>
            </div>

            {/* PANEL FOOTER ACTION */}
            <div className="p-6 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/80 flex items-center justify-between">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowCreatePanel(false)}
                className="rounded-2xl text-xs border-slate-300 dark:border-slate-700"
              >
                Cancel
              </Button>

              <Button
                type="submit"
                form="createQuoteForm"
                disabled={createMutation.isPending}
                className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-extrabold text-xs rounded-2xl px-6 h-11 shadow-lg shadow-indigo-600/25 transition-all flex items-center gap-2"
              >
                {createMutation.isPending ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Sending Requests...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Send Quotation Request</span>
                  </>
                )}
              </Button>
            </div>

          </div>
        </div>
      )}

      {/* QUICK ADD SUPPLIER MODAL */}
      {showAddSupplierModal && (
        <QuickAddSupplierModal
          onClose={() => setShowAddSupplierModal(false)}
          onSupplierAdded={(newSup) => {
            queryClient.invalidateQueries(['suppliers']);
            if (newSup?.id) {
              setSelectedSupplierIds([...selectedSupplierIds, newSup.id]);
            }
            setShowAddSupplierModal(false);
          }}
        />
      )}

    </div>
  );
}
