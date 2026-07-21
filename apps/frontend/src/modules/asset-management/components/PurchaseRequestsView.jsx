import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/axios';
import useAuthStore from '@/app/store/authStore';
import HsnSelect from '@/components/forms/HsnSelect';
import SearchSelect from '@/components/ui/SearchSelect';
import { format } from 'date-fns';
import DatePicker from '@/components/ui/DatePicker';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Plus, Search, FileText, CheckCircle2, Clock, XCircle,
  AlertTriangle, ChevronDown, X, Eye, ArrowLeft, Loader2,
  Building2, Tag, Calculator, Calendar, User, Briefcase,
  TrendingUp, Package, Trash2, Edit
} from 'lucide-react';
import Swal from 'sweetalert2';
import Pagination from '@/components/ui/Pagination';

const DEPARTMENTS = ['IT', 'Manufacturing', 'Admin', 'Logistics', 'Finance', 'HR', 'Sales'];
const CATEGORIES = [
  'IT Equipment', 'Machinery & Plant', 'Furniture & Fixtures',
  'Vehicles', 'Infrastructure', 'Office Equipment', 'Intangible Assets'
];
const PRIORITIES = ['Low', 'Normal', 'Urgent', 'Critical'];

const UOM_OPTIONS = [
  // Weight
  'gm', 'kg', 'mg', 'lb', 'oz', 'ton', 'metric ton', 'quintal',
  // Volume
  'liter', 'ml', 'cl', 'dl', 'gallon', 'quart', 'pint', 'fluid oz', 'cubic meter', 'cubic ft', 'cubic cm', 'cubic inch',
  // Length
  'meter', 'cm', 'mm', 'km', 'inch', 'feet', 'yard', 'mile',
  // Area
  'square meter', 'square ft', 'square cm', 'square inch', 'square yard', 'acre', 'hectare',
  // Count / Packaging
  'pcs', 'pair', 'dozen', 'gross', 'set', 'kit', 'bundle', 'box', 'carton', 'case', 'pack', 'bag', 'sack', 'pallet', 'tray', 'tube', 'bottle', 'can', 'drum', 'barrel', 'cylinder',
  // Roll / Sheet
  'roll', 'sheet', 'ream',
  // Time-based
  'hour', 'day',
  // Energy
  'kWh', 'MJ',
  // Other
  'unit', 'lot', 'assortment'
];

const STATUS_STYLES = {
  Draft: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700',
  Submitted: 'bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400 border-blue-200 dark:border-blue-900/50',
  'Under Review': 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400 border-amber-200 dark:border-amber-900/50',
  Approved: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/50',
  Rejected: 'bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400 border-rose-200 dark:border-rose-900/50',
};

const PRIORITY_STYLES = {
  Low: 'bg-slate-100 text-slate-500',
  Normal: 'bg-blue-50 text-blue-600',
  Urgent: 'bg-amber-50 text-amber-600',
  Critical: 'bg-rose-50 text-rose-600',
};

function StatCard({ icon: Icon, label, value, bg, iconColor, borderColor }) {
  return (
    <div className={`bg-white dark:bg-slate-900 border ${borderColor} rounded-2xl p-4 flex items-center gap-4 shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5`}>
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${bg} ${iconColor}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</p>
        <p className="text-xl font-bold text-slate-900 dark:text-white mt-0.5">{value}</p>
      </div>
    </div>
  );
}

function PRDetailModal({ pr, onClose }) {
  const approvalLevel = () => {
    const cost = Number(pr.estimatedTotalCost);
    if (cost <= 10000) return 'Auto-Approved (L0)';
    if (cost <= 100000) return 'Department Head (L1)';
    if (cost <= 500000) return 'General Manager (L2)';
    if (cost <= 2500000) return 'CFO (L3)';
    return 'Board / MD (L4)';
  };

  const items = Array.isArray(pr.items) ? pr.items : null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-slate-900 w-full max-w-3xl rounded-3xl shadow-2xl border border-slate-200/60 dark:border-slate-800 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 px-6 py-4 flex items-center justify-between z-10 rounded-t-3xl">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white font-mono">{pr.prNo}</h2>
            <p className="text-xs text-slate-500 mt-0.5">{format(new Date(pr.createdAt), 'dd MMM yyyy')}</p>
          </div>
          <div className="flex items-center gap-3">
            <span className={`px-3 py-1 rounded-full text-xs font-bold border ${STATUS_STYLES[pr.status] || STATUS_STYLES.Draft}`}>{pr.status}</span>
            <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            {[
              { label: 'Requester', value: pr.requesterName },
              { label: 'Employee ID', value: pr.requesterEmpId },
              { label: 'Department', value: pr.department },
              { label: 'Cost Center', value: pr.costCenter },
              { label: 'Priority', value: <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${PRIORITY_STYLES[pr.priority]}`}>{pr.priority}</span> },
              { label: 'Required By', value: format(new Date(pr.requiredByDate), 'dd MMM yyyy') },
            ].map(({ label, value }) => (
              <div key={label} className="space-y-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</p>
                <p className="font-semibold text-slate-800 dark:text-slate-200">{value}</p>
              </div>
            ))}
          </div>

          {items && items.length > 0 ? (
            <div className="space-y-2">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Requested Items</p>
              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 font-bold">
                    <tr>
                      <th className="px-3 py-2 text-left">#</th>
                      <th className="px-3 py-2 text-left">Asset Name</th>
                      <th className="px-3 py-2 text-left">Category</th>
                      <th className="px-3 py-2 text-left">HSN/SAC</th>
                      <th className="px-3 py-2 text-left">Specifications</th>
                      <th className="px-3 py-2 text-right">Qty</th>
                      <th className="px-3 py-2 text-right">Est. Unit Cost</th>
                      <th className="px-3 py-2 text-right">Est. Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-700 dark:text-slate-300">
                    {items.map((item, i) => (
                      <tr key={i} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30">
                        <td className="px-3 py-2 font-mono">{i + 1}</td>
                        <td className="px-3 py-2 font-semibold text-slate-800 dark:text-slate-200">{item.assetName}</td>
                        <td className="px-3 py-2">{item.category}</td>
                        <td className="px-3 py-2 font-mono">{item.hsnCode || '—'}</td>
                        <td className="px-3 py-2 max-w-xs truncate" title={item.specifications}>{item.specifications}</td>
                        <td className="px-3 py-2 text-right">{item.quantity} {item.uom || 'EA'}</td>
                        <td className="px-3 py-2 text-right">₹{Number(item.estimatedUnitCost).toLocaleString('en-IN')}</td>
                        <td className="px-3 py-2 text-right font-bold">₹{(item.quantity * Number(item.estimatedUnitCost)).toLocaleString('en-IN')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 text-sm border-t border-slate-100 dark:border-slate-800 pt-4">
              {[
                { label: 'Asset Name', value: pr.assetName },
                { label: 'Category', value: pr.category },
                { label: 'Specifications', value: pr.specifications },
                { label: 'HSN Code', value: pr.hsnCode || '—' },
                { label: 'Quantity', value: `${pr.quantity} ${pr.uom || 'EA'}` },
                { label: 'Est. Unit Cost', value: `₹${Number(pr.estimatedUnitCost).toLocaleString('en-IN')}` },
              ].map(({ label, value }) => (
                <div key={label} className="space-y-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</p>
                  <p className="font-semibold text-slate-800 dark:text-slate-200">{value}</p>
                </div>
              ))}
            </div>
          )}

          <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 space-y-3">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Financial Summary</p>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-xs text-slate-500">Total Estimated</p>
                <p className="font-bold text-indigo-600 dark:text-indigo-400 text-lg">₹{Number(pr.estimatedTotalCost).toLocaleString('en-IN')}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Required Approval Level</p>
                <p className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5">{approvalLevel()}</p>
              </div>
            </div>
          </div>

          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Business Justification</p>
            <p className="text-sm text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3 leading-relaxed">{pr.justification}</p>
          </div>

          {pr.preferredVendor && (
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Preferred Vendor</p>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{pr.preferredVendor}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

import QuickAddSupplierModal from '@/components/forms/QuickAddSupplierModal';
const AddSupplierInline = QuickAddSupplierModal;

// Searchable Supplier Dropdown Component
function SupplierSelect({ suppliers, value, onChange, onAddNew }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = React.useRef(null);

  const filtered = suppliers.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) || 
    (s.phone && s.phone.toLowerCase().includes(search.toLowerCase()))
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

function CreatePRForm({ onBack, isReadOnly, editPRId }) {
  const user = useAuthStore(s => s.user);
  const qc = useQueryClient();
  const [form, setForm] = useState({
    requesterName: user?.name || '',
    requesterEmpId: user?.empId || '',
    department: 'IT',
    costCenter: 'CC-IT-001',
    requiredByDate: null,
    priority: 'Normal',
    justification: '',
    preferredVendor: '',
    items: [{
      category: 'IT Equipment',
      assetName: '',
      hsnCode: '',
      hsnDescription: '',
      uom: 'EA',
      specifications: '',
      quantity: 1,
      estimatedUnitCost: ''
    }]
  });
  const [error, setError] = useState('');
  const [showAddSupplier, setShowAddSupplier] = useState(false);

  const { data: existingPR, isLoading: isLoadingPR } = useQuery({
    queryKey: ['asset-pr', editPRId],
    queryFn: () => api.get(`/asset-management/requests/${editPRId}`).then(r => r.data),
    enabled: !!editPRId,
  });

  useEffect(() => {
    if (existingPR) {
      setForm({
        requesterName: existingPR.requesterName || '',
        requesterEmpId: existingPR.requesterEmpId || '',
        department: existingPR.department || 'IT',
        costCenter: existingPR.costCenter || 'CC-IT-001',
        requiredByDate: existingPR.requiredByDate ? new Date(existingPR.requiredByDate) : null,
        priority: existingPR.priority || 'Normal',
        justification: existingPR.justification || '',
        preferredVendor: existingPR.preferredVendor || '',
        items: existingPR.items && existingPR.items.length > 0 ? existingPR.items.map(item => ({
          category: item.category || 'IT Equipment',
          assetName: item.assetName || '',
          hsnCode: item.hsnCode || '',
          hsnDescription: item.hsnDescription || '',
          uom: item.uom || 'EA',
          specifications: item.specifications || '',
          quantity: item.quantity || 1,
          estimatedUnitCost: item.estimatedUnitCost !== undefined ? String(item.estimatedUnitCost) : ''
        })) : [{
          category: 'IT Equipment',
          assetName: '',
          hsnCode: '',
          hsnDescription: '',
          uom: 'EA',
          specifications: '',
          quantity: 1,
          estimatedUnitCost: ''
        }]
      });
    }
  }, [existingPR]);

  const [activeRowIdx, setActiveRowIdx] = useState(null);
  const [assetSearch, setAssetSearch] = useState('');
  const [assetSuggestions, setAssetSuggestions] = useState([]);
  const [aiLoading, setAiLoading] = useState(null);
  const [aiSuggestion, setAiSuggestion] = useState(null);
  const selectedAssetsRef = React.useRef({});

  const { data: suppliers = [], refetch: refetchSuppliers } = useQuery({
    queryKey: ['suppliers'],
    queryFn: () => api.get('/parties/suppliers').then(r => r.data?.data || r.data || []),
  });

  const { data: rawMaterials = [] } = useQuery({
    queryKey: ['raw-materials-setup'],
    queryFn: () => api.get('/item-setup/raw-material').then(r => r.data || []),
  });

  const fetchedUoms = Array.from(new Set(rawMaterials.map(rm => rm.unitId).filter(Boolean)));
  const uomList = fetchedUoms.length > 0 ? fetchedUoms : ['EA', 'Set', 'Kg', 'Ltr', 'Mtr', 'Box'];

  const update = (field, val) => {
    setForm(p => ({ ...p, [field]: val }));
  };

  const updateItem = (idx, field, val) => {
    setForm(p => {
      const newItems = p.items.map((item, i) => i === idx ? { ...item, [field]: val } : item);
      return { ...p, items: newItems };
    });
  };

  const addItem = () => {
    setForm(p => ({
      ...p,
      items: [...p.items, {
        category: 'IT Equipment',
        assetName: '',
        hsnCode: '',
        hsnDescription: '',
        uom: 'EA',
        specifications: '',
        quantity: 1,
        estimatedUnitCost: ''
      }]
    }));
  };

  const removeItem = (idx) => {
    setForm(p => ({
      ...p,
      items: p.items.filter((_, i) => i !== idx)
    }));
    if (activeRowIdx === idx) setActiveRowIdx(null);
    if (aiSuggestion && aiSuggestion.rowIdx === idx) setAiSuggestion(null);
  };

  const handleAssetNameChange = (idx, val) => {
    updateItem(idx, 'assetName', val);
    setActiveRowIdx(idx);
    setAssetSearch(val);
    if (selectedAssetsRef.current) {
      selectedAssetsRef.current[idx] = false;
    }
  };

  useEffect(() => {
    if (user?.name) {
      update('requesterName', user.name);
    }
    if (user?.empId) {
      update('requesterEmpId', user.empId);
    }
  }, [user]);

  // Fetch autocomplete suggestions on typing
  useEffect(() => {
    if (activeRowIdx === null) return;
    const query = (assetSearch || '').trim();
    const delayDebounceFn = setTimeout(() => {
      api.get(`/asset-management/master/assets?search=${encodeURIComponent(query)}`)
        .then(res => {
          setAssetSuggestions(res.data || []);
        })
        .catch(err => console.error(err));
    }, 300); // 300ms debounce to reduce API requests

    return () => clearTimeout(delayDebounceFn);
  }, [assetSearch, activeRowIdx]);

  const handleSelectAsset = (asset, idx) => {
    setForm(prev => {
      const newItems = prev.items.map((item, i) => i === idx ? {
        ...item,
        assetName: asset.assetName,
        category: asset.category,
        hsnCode: asset.hsnCode,
        hsnDescription: asset.hsnDescription || '',
        specifications: asset.specifications || item.specifications,
        estimatedUnitCost: asset.lastUnitCost ? String(asset.lastUnitCost) : item.estimatedUnitCost
      } : item);
      return { ...prev, items: newItems };
    });
    if (selectedAssetsRef.current) {
      selectedAssetsRef.current[idx] = true;
    }
    setActiveRowIdx(null);
    setAssetSearch('');
    setAiSuggestion(null);
  };

  const handleAssetBlur = (idx) => {
    setTimeout(() => {
      setActiveRowIdx(null);
      if (selectedAssetsRef.current && selectedAssetsRef.current[idx]) {
        // Skip API check since it was selected from dropdown
        return;
      }
      const item = form.items[idx];
      const name = item?.assetName.trim();
      if (!name) return;

      api.get(`/asset-management/master/assets?search=${encodeURIComponent(name)}`)
        .then(res => {
          const matches = res.data || [];
          const exactMatch = matches.find(m => m.assetName.toLowerCase() === name.toLowerCase());
          if (!exactMatch) {
            setAiLoading(idx);
            api.get(`/asset-management/master/ai-hsn?name=${encodeURIComponent(name)}`)
              .then(aiRes => {
                if (aiRes.data && aiRes.data.source === 'ai') {
                  setAiSuggestion({
                    rowIdx: idx,
                    hsn: aiRes.data.hsn,
                    description: aiRes.data.description
                  });
                } else if (aiRes.data && aiRes.data.source === 'database') {
                  setForm(prev => {
                    const newItems = prev.items.map((it, i) => i === idx ? {
                      ...it,
                      hsnCode: aiRes.data.hsn,
                      hsnDescription: aiRes.data.description || '',
                      category: aiRes.data.category,
                      specifications: aiRes.data.specifications || it.specifications,
                      estimatedUnitCost: aiRes.data.lastUnitCost ? String(aiRes.data.lastUnitCost) : it.estimatedUnitCost
                    } : it);
                    return { ...prev, items: newItems };
                  });
                }
              })
              .catch(err => console.error(err))
              .finally(() => setAiLoading(null));
          } else {
            setForm(prev => {
              const newItems = prev.items.map((it, i) => i === idx ? {
                ...it,
                hsnCode: exactMatch.hsnCode,
                hsnDescription: exactMatch.hsnDescription || '',
                category: exactMatch.category
              } : it);
              return { ...prev, items: newItems };
            });
          }
        });
    }, 300);
  };

  const confirmAiHsn = () => {
    if (aiSuggestion) {
      const idx = aiSuggestion.rowIdx;
      updateItem(idx, 'hsnCode', aiSuggestion.hsn);
      updateItem(idx, 'hsnDescription', aiSuggestion.description);
      Swal.fire({
        icon: 'success',
        title: 'HSN Confirmed',
        text: `Applied HSN Code: ${aiSuggestion.hsn}`,
        timer: 1500,
        showConfirmButton: false,
        customClass: { popup: 'rounded-3xl border border-slate-200' }
      });
      setAiSuggestion(null);
    }
  };

  const totalCost = form.items.reduce((sum, item) => {
    return sum + (Number(item.quantity || 0) * Number(item.estimatedUnitCost || 0));
  }, 0);

  const getApprovalLevel = () => {
    if (totalCost <= 10000) return 'Auto-Approved (L0)';
    if (totalCost <= 100000) return 'Department Head (L1)';
    if (totalCost <= 500000) return 'General Manager (L2)';
    if (totalCost <= 2500000) return 'CFO (L3)';
    return 'Board / MD (L4)';
  };

  const mutation = useMutation({
    mutationFn: data => {
      if (editPRId) {
        return api.put(`/asset-management/requests/${editPRId}`, data).then(r => r.data);
      }
      return api.post('/asset-management/requests', data).then(r => r.data);
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['asset-prs'] });
      if (editPRId) {
        qc.invalidateQueries({ queryKey: ['asset-pr', editPRId] });
      }
      Swal.fire({
        icon: 'success',
        title: editPRId ? 'Purchase Request Updated!' : 'Purchase Request Created!',
        html: `<b>${res.prNo}</b> ${editPRId ? 'updated' : 'submitted'} successfully${res.warning ? `<br/><span style="color:#f59e0b;font-size:0.85em">${res.warning}</span>` : ''}`,
        confirmButtonColor: '#4f46e5',
        customClass: { popup: 'rounded-3xl border border-slate-200 dark:border-slate-800' }
      }).then(() => onBack());
    },
    onError: (err) => setError(err.response?.data?.error || `Failed to ${editPRId ? 'update' : 'create'} PR`),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    if (!form.requiredByDate) { setError('Required By Date is mandatory'); return; }
    if (!form.justification || form.justification.length < 20) { setError('Justification must be at least 20 characters'); return; }
    if (form.items.some(item => !item.assetName || !item.quantity || !item.estimatedUnitCost)) {
      setError('Please fill in Asset Name, Quantity, and Est. Unit Cost for all items.');
      return;
    }
    mutation.mutate(form);
  };

  if (editPRId && isLoadingPR) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Loader2 className="w-10 h-10 animate-spin text-indigo-600" />
        <p className="text-sm text-slate-500">Loading purchase request details...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full">
      {showAddSupplier && (
        <AddSupplierInline
          onClose={() => setShowAddSupplier(false)}
          onAdded={(newSup) => {
            setShowAddSupplier(false);
            refetchSuppliers().then(() => {
              update('preferredVendor', newSup.name);
            });
          }}
        />
      )}

      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onBack} className="rounded-full border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            {editPRId ? 'Edit Purchase Request' : 'New Purchase Request'}
          </h2>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-3 p-4 bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/50 rounded-2xl text-rose-700 dark:text-rose-400 text-sm">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Requester Details */}
        <div className="border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
            <User className="w-4 h-4 text-indigo-500" /> Requester Details
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label>Requester Name <span className="text-rose-500">*</span></Label>
              <Input required disabled readOnly value={form.requesterName} className="h-10 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-500 cursor-not-allowed border-slate-200" />
            </div>
            <div className="space-y-1.5">
              <Label>Employee ID <span className="text-rose-500">*</span></Label>
              <Input
                required
                disabled={!!user?.empId}
                readOnly={!!user?.empId}
                value={form.requesterEmpId}
                onChange={e => update('requesterEmpId', e.target.value)}
                placeholder="EMP-001"
                className={`h-10 rounded-xl ${user?.empId ? 'bg-slate-50 dark:bg-slate-800 text-slate-500 cursor-not-allowed border-slate-200' : ''}`}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Department <span className="text-rose-500">*</span></Label>
              <div className="relative">
                <select value={form.department} onChange={e => { update('department', e.target.value); update('costCenter', `CC-${e.target.value}-001`); }}
                  className="w-full h-10 px-3 pr-8 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-500/20">
                  {DEPARTMENTS.map(d => <option key={d}>{d}</option>)}
                </select>
                <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-3 pointer-events-none" />
              </div>
            </div>
          </div>
        </div>

        {/* Line Items */}
        <div className="border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <Package className="w-4 h-4 text-indigo-500" /> Requested items ({form.items.length})
            </h3>
            <Button type="button" variant="outline" size="sm" onClick={addItem} className="h-8 rounded-lg text-xs gap-1 border-indigo-200 dark:border-indigo-900 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/30">
              <Plus className="w-3.5 h-3.5" /> Add Item
            </Button>
          </div>

          <div className="space-y-4">
            {form.items.map((item, idx) => {
              const rowCost = Number(item.quantity || 0) * Number(item.estimatedUnitCost || 0);
              return (
                <div key={idx} className="bg-slate-50/60 dark:bg-slate-800/30 rounded-2xl p-4 border border-slate-200/60 dark:border-slate-800/60 relative space-y-4 animate-in fade-in zoom-in-95 duration-200">
                  {form.items.length > 1 && (
                    <button type="button" onClick={() => removeItem(idx)} className="absolute top-3 right-3 p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                  
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 text-xs font-bold flex items-center justify-center font-mono">
                      {idx + 1}
                    </span>
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Item Details</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5 relative">
                      <Label>Asset Name / Title <span className="text-rose-500">*</span></Label>
                      <Input
                        required
                        value={item.assetName}
                        onChange={e => handleAssetNameChange(idx, e.target.value)}
                        onFocus={() => {
                          setActiveRowIdx(idx);
                          setAssetSearch(item.assetName || '');
                        }}
                        onBlur={() => handleAssetBlur(idx)}
                        placeholder="Type or select asset name..."
                        className="h-10 rounded-xl"
                      />
                      {activeRowIdx === idx && assetSuggestions.length > 0 && (
                        <div className="absolute z-50 mt-1 w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl max-h-60 overflow-y-auto">
                          <ul className="p-1 text-sm text-slate-700 dark:text-slate-300">
                            {assetSuggestions.map((ast) => (
                              <li
                                key={ast.id}
                                onMouseDown={() => handleSelectAsset(ast, idx)}
                                className="px-3 py-2 hover:bg-indigo-50 dark:hover:bg-indigo-950/20 hover:text-indigo-600 rounded-lg cursor-pointer flex justify-between"
                              >
                                <span className="font-semibold">{ast.assetName}</span>
                                <span className="text-xs text-slate-400 font-mono">HSN: {ast.hsnCode}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {aiLoading === idx && (
                        <p className="text-xs text-indigo-500 flex items-center gap-1.5 mt-1">
                          <Loader2 className="w-3 h-3 animate-spin" /> Calling AI for HSN lookup...
                        </p>
                      )}
                      {aiSuggestion && aiSuggestion.rowIdx === idx && (
                        <div className="mt-2 p-3 bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-900 rounded-xl flex items-center justify-between gap-3 animate-in slide-in-from-top-2">
                          <div className="space-y-0.5">
                            <p className="text-xs font-bold text-indigo-800 dark:text-indigo-300">AI Suggested HSN: {aiSuggestion.hsn}</p>
                            <p className="text-[11px] text-indigo-600 dark:text-indigo-400">{aiSuggestion.description}</p>
                          </div>
                          <Button type="button" size="sm" onClick={confirmAiHsn} className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg px-3 text-xs h-7">
                            Confirm
                          </Button>
                        </div>
                      )}
                    </div>
                    
                    <div className="space-y-1.5">
                      <Label>Asset Category <span className="text-rose-500">*</span></Label>
                      <div className="relative">
                        <select value={item.category} onChange={e => updateItem(idx, 'category', e.target.value)}
                          className="w-full h-10 px-3 pr-8 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-500/20">
                          {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                        </select>
                        <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-3 pointer-events-none" />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label>HSN / SAC Code <span className="text-rose-500">*</span></Label>
                      <HsnSelect
                        value={item.hsnCode}
                        onChange={val => updateItem(idx, 'hsnCode', val)}
                        onSelect={hsnItem => {
                          updateItem(idx, 'hsnCode', hsnItem.hsn_code);
                          updateItem(idx, 'hsnDescription', hsnItem.description);
                        }}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label>HSN Description</Label>
                      <Input value={item.hsnDescription} onChange={e => updateItem(idx, 'hsnDescription', e.target.value)} placeholder="HSN code description" className="h-10 rounded-xl" />
                    </div>

                    <div className="space-y-1.5">
                      <Label>Unit of Measure <span className="text-rose-500">*</span></Label>
                      <SearchSelect
                        options={UOM_OPTIONS}
                        value={item.uom || 'EA'}
                        onChange={val => updateItem(idx, 'uom', val)}
                        placeholder="Select UOM..."
                        searchPlaceholder="Search UOM..."
                        required={true}
                        triggerClassName="h-10 text-sm border-slate-200 dark:border-slate-700 bg-white"
                      />
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div className="space-y-1.5">
                        <Label>Quantity <span className="text-rose-500">*</span></Label>
                        <Input required type="number" min="1" value={item.quantity} onChange={e => updateItem(idx, 'quantity', e.target.value)} className="h-10 rounded-xl" />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Est. Unit (₹) <span className="text-rose-500">*</span></Label>
                        <Input required type="number" min="0" value={item.estimatedUnitCost} onChange={e => updateItem(idx, 'estimatedUnitCost', e.target.value)} placeholder="0" className="h-10 rounded-xl" />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Total Cost</Label>
                        <div className="h-10 px-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100/50 dark:bg-slate-800 flex items-center text-xs font-bold text-slate-700 dark:text-slate-300 truncate">
                          ₹{rowCost.toLocaleString('en-IN')}
                        </div>
                      </div>
                    </div>

                    <div className="md:col-span-2 space-y-1.5">
                      <Label>Technical Specifications <span className="text-rose-500">*</span></Label>
                      <textarea required value={item.specifications} onChange={e => updateItem(idx, 'specifications', e.target.value)}
                        rows={2} placeholder="Detailed technical specifications required for procurement..."
                        className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 resize-none" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* PR Cost Summary & Approval check */}
        <div className="border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
            <Calculator className="w-4 h-4 text-indigo-500" /> PR Financial Summary
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Grand Estimated Total Cost</Label>
              <div className="h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-indigo-50/50 dark:bg-indigo-950/20 flex items-center text-base font-bold text-indigo-600 dark:text-indigo-400">
                ₹{totalCost.toLocaleString('en-IN')}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Required Approval Threshold</Label>
              <div className="h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 flex items-center text-xs font-semibold text-slate-600 dark:text-slate-400">
                {getApprovalLevel()}
              </div>
            </div>
          </div>
        </div>

        {/* Dates & Priority */}
        <div className="border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-indigo-500" /> Schedule & Priority
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <DatePicker
              label="Required By Date *"
              value={form.requiredByDate}
              onChange={date => update('requiredByDate', date)}
              disabled={d => d < new Date()}
              placeholder="Select Date"
            />
            <div className="space-y-1.5">
              <Label>Priority <span className="text-rose-500">*</span></Label>
              <div className="relative">
                <select value={form.priority} onChange={e => update('priority', e.target.value)}
                  className="w-full h-10 px-3 pr-8 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-500/20">
                  {PRIORITIES.map(p => <option key={p}>{p}</option>)}
                </select>
                <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-3 pointer-events-none" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Preferred Vendor (Optional)</Label>
              <SupplierSelect
                suppliers={suppliers}
                value={suppliers.find(s => s.name === form.preferredVendor) || null}
                onChange={s => update('preferredVendor', s.name)}
                onAddNew={() => setShowAddSupplier(true)}
              />
            </div>
          </div>
        </div>

        {/* Justification */}
        <div className="border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Briefcase className="w-4 h-4 text-indigo-500" /> Business Justification
            <span className="text-rose-500">*</span>
          </h3>
          <textarea required value={form.justification} onChange={e => update('justification', e.target.value)}
            rows={4} placeholder="Explain why this asset procurement is necessary (min. 20 characters)..."
            className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 resize-none" />
          <p className="text-xs text-slate-400 mt-1">{form.justification.length} characters (minimum 20)</p>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="outline" onClick={onBack} className="rounded-xl px-6 h-11">Cancel</Button>
          <Button type="submit" disabled={mutation.isPending || isReadOnly}
            className="rounded-xl px-6 h-11 bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-600/20 gap-2">
            {mutation.isPending ? <><Loader2 className="w-4 h-4 animate-spin" /> Submitting...</> : <><FileText className="w-4 h-4" /> Submit PR</>}
          </Button>
        </div>
      </form>
    </div>
  );
}

export default function PurchaseRequestsView() {
  const user = useAuthStore(s => s.user);
  const isReadOnly = user?.role === 'SUPERVISOR';
  const [view, setView] = useState('list');
  const [editPRId, setEditPRId] = useState(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [selectedPR, setSelectedPR] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const qc = useQueryClient();

  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter]);

  const { data: prs = [], isLoading } = useQuery({
    queryKey: ['asset-prs'],
    queryFn: () => api.get('/asset-management/requests').then(r => r.data),
  });

  const { data: pqs = [] } = useQuery({
    queryKey: ['asset-pqs'],
    queryFn: () => api.get('/asset-management/quotations').then(r => r.data),
  });

  const approveMutation = useMutation({
    mutationFn: id => api.patch(`/asset-management/requests/${id}/approve`).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['asset-prs'] }),
    onError: err => Swal.fire({ icon: 'error', title: 'Error', text: err.response?.data?.error || 'Failed to approve', confirmButtonColor: '#4f46e5' })
  });

  const deleteMutation = useMutation({
    mutationFn: id => api.delete(`/asset-management/requests/${id}`).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['asset-prs'] });
      Swal.fire({
        icon: 'success',
        title: 'Deleted!',
        text: 'Purchase Request has been deleted.',
        timer: 1500,
        showConfirmButton: false,
        customClass: { popup: 'rounded-3xl border border-slate-200' }
      });
    },
    onError: err => Swal.fire({
      icon: 'error',
      title: 'Error',
      text: err.response?.data?.error || 'Failed to delete request',
      confirmButtonColor: '#4f46e5'
    })
  });

  const handleDeletePR = (id) => {
    Swal.fire({
      title: 'Are you sure?',
      text: "This will permanently delete this purchase request.",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Yes, delete it!'
    }).then((result) => {
      if (result.isConfirmed) {
        deleteMutation.mutate(id);
      }
    });
  };

  const filtered = prs.filter(pr => {
    const matchSearch = pr.assetName?.toLowerCase().includes(search.toLowerCase()) ||
      pr.prNo?.toLowerCase().includes(search.toLowerCase()) ||
      pr.requesterName?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'ALL' || pr.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const ITEMS_PER_PAGE = 10;
  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginatedItems = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  if (view === 'create') {
    return (
      <CreatePRForm
        onBack={() => {
          setView('list');
          setEditPRId(null);
        }}
        isReadOnly={isReadOnly}
        editPRId={editPRId}
      />
    );
  }

  const totalValue = prs.reduce((s, p) => s + Number(p.estimatedTotalCost), 0);
  const approvedCount = prs.filter(p => p.status === 'Approved').length;
  const pendingCount = prs.filter(p => p.status === 'Submitted').length;

  return (
    <div className="space-y-6">
      {selectedPR && <PRDetailModal pr={selectedPR} onClose={() => setSelectedPR(null)} />}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Purchase Requests</h2>
          <p className="text-sm text-slate-500 mt-0.5">Initiate asset procurement via internal requests (PR)</p>
        </div>
        {!isReadOnly && (
          <Button onClick={() => setView('create')} className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-md shadow-indigo-600/10 h-10 px-5">
            <Plus className="w-4 h-4" /> New Request
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={FileText} label="Total PRs" value={prs.length} bg="bg-indigo-50 dark:bg-indigo-950/30" iconColor="text-indigo-600 dark:text-indigo-400" borderColor="border-slate-200/60 dark:border-slate-800/60" />
        <StatCard icon={Clock} label="Pending" value={pendingCount} bg="bg-amber-50 dark:bg-amber-950/30" iconColor="text-amber-600 dark:text-amber-400" borderColor="border-slate-200/60 dark:border-slate-800/60" />
        <StatCard icon={CheckCircle2} label="Approved" value={approvedCount} bg="bg-emerald-50 dark:bg-emerald-950/30" iconColor="text-emerald-600 dark:text-emerald-400" borderColor="border-slate-200/60 dark:border-slate-800/60" />
        <StatCard icon={TrendingUp} label="Est. Value" value={`₹${(totalValue / 100000).toFixed(1)}L`} bg="bg-violet-50 dark:bg-violet-950/30" iconColor="text-violet-600 dark:text-violet-400" borderColor="border-slate-200/60 dark:border-slate-800/60" />
      </div>

      <div className="bg-slate-50/60 dark:bg-slate-800/20 border border-slate-200/60 dark:border-slate-800/60 rounded-2xl p-3 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by PR no., asset name, requester..." className="pl-9 h-9 rounded-xl bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700" />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="h-9 px-3 pr-8 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 appearance-none">
          <option value="ALL">All Status</option>
          {['Draft', 'Submitted', 'Under Review', 'Approved', 'Rejected'].map(s => <option key={s}>{s}</option>)}
        </select>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200/60 dark:border-slate-800/60">
        <table className="w-full text-sm">
          <thead className="bg-slate-50/80 dark:bg-slate-800/50">
            <tr>
              {['PR No.', 'Asset Name', 'Department', 'Category', 'Priority', 'Est. Total', 'Required By', 'Status', 'Actions'].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
            {isLoading ? Array.from({ length: 4 }).map((_, i) => (
              <tr key={i}>{Array.from({ length: 9 }).map((_, j) => <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-full rounded" /></td>)}</tr>
            )) : filtered.length === 0 ? (
              <tr><td colSpan={9} className="px-4 py-16 text-center">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-14 h-14 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center">
                    <FileText className="w-7 h-7 text-slate-400" />
                  </div>
                  <div>
                    <p className="font-medium text-slate-700 dark:text-slate-300">No purchase requests found</p>
                    <p className="text-xs text-slate-400 mt-1">Create a new request to begin asset procurement</p>
                  </div>
                </div>
              </td></tr>
            ) : paginatedItems.map(pr => (
              <tr key={pr.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors">
                <td className="px-4 py-3">
                  <button onClick={() => setSelectedPR(pr)} className="font-mono font-bold text-indigo-600 dark:text-indigo-400 text-xs hover:underline">{pr.prNo}</button>
                </td>
                <td className="px-4 py-3">
                  <div className="font-semibold text-slate-800 dark:text-slate-200">{pr.assetName}</div>
                  <div className="text-xs text-slate-500">{pr.requesterName}</div>
                </td>
                <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{pr.department}</td>
                <td className="px-4 py-3 text-slate-700 dark:text-slate-300 text-xs">{pr.category}</td>
                <td className="px-4 py-3">
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${PRIORITY_STYLES[pr.priority] || ''}`}>{pr.priority}</span>
                </td>
                <td className="px-4 py-3 font-bold text-slate-900 dark:text-white">₹{Number(pr.estimatedTotalCost).toLocaleString('en-IN')}</td>
                <td className="px-4 py-3 text-xs text-slate-500">{format(new Date(pr.requiredByDate), 'dd MMM yyyy')}</td>
                <td className="px-4 py-3">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${STATUS_STYLES[pr.status] || STATUS_STYLES.Draft}`}>{pr.status}</span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" onClick={() => setSelectedPR(pr)} className="h-8 w-8 rounded-lg text-slate-400 hover:text-indigo-600" title="View Details">
                      <Eye className="w-4 h-4" />
                    </Button>
                    {!isReadOnly && (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setEditPRId(pr.id);
                            setView('create');
                          }}
                          disabled={pqs.some(pq => pq.prNo === pr.prNo)}
                          className="h-8 w-8 rounded-lg text-slate-400 hover:text-indigo-600 disabled:opacity-40 disabled:hover:text-slate-400"
                          title={pqs.some(pq => pq.prNo === pr.prNo) ? "Cannot edit: Quotation already raised" : "Edit Request"}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeletePR(pr.id)}
                          disabled={pqs.some(pq => pq.prNo === pr.prNo)}
                          className="h-8 w-8 rounded-lg text-slate-400 hover:text-rose-600 disabled:opacity-40 disabled:hover:text-slate-400"
                          title={pqs.some(pq => pq.prNo === pr.prNo) ? "Cannot delete: Quotation already raised" : "Delete Request"}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </>
                    )}
                    {!isReadOnly && pr.status === 'Submitted' && (
                      <Button variant="ghost" size="sm" onClick={() => approveMutation.mutate(pr.id)}
                        disabled={approveMutation.isPending}
                        className="h-8 px-3 text-xs text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 rounded-lg gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Approve
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div className="mt-4 border-t border-slate-100 dark:border-slate-800 pt-4">
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
          />
        </div>
      )}
    </div>
  );
}
