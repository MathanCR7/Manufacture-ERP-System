import React, { useState, useEffect } from 'react';
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
  Plus, Search, HardDrive, Eye, ArrowLeft, Loader2, AlertTriangle,
  ChevronDown, X, Tag, MapPin, User, Calendar, Package,
  TrendingDown, Wrench, CheckCircle2, AlertOctagon, Archive,
  Cpu, QrCode, BarChart2, Shield, Hash, Building2
} from 'lucide-react';
import Swal from 'sweetalert2';
import Pagination from '@/components/ui/Pagination';

const DEPARTMENTS = ['IT', 'Manufacturing', 'Admin', 'Logistics', 'Finance', 'HR', 'Sales'];
const CATEGORIES = [
  'IT Equipment', 'Machinery & Plant', 'Furniture & Fixtures',
  'Vehicles', 'Infrastructure', 'Office Equipment', 'Intangible Assets'
];
const DEPRECIATION_METHODS = [
  'Straight Line Method (SLM)',
  'Written Down Value (WDV)',
  'Units of Production',
];
const CONDITIONS = ['Excellent', 'Good', 'Fair', 'Poor', 'Under Repair', 'Decommissioned'];

const STATUS_STYLES = {
  Active: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/50',
  'Under Maintenance': 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400 border-amber-200 dark:border-amber-900/50',
  'In Transit': 'bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400 border-blue-200 dark:border-blue-900/50',
  Disposed: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700',
  Scrapped: 'bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400 border-rose-200 dark:border-rose-900/50',
  Idle: 'bg-violet-50 text-violet-700 dark:bg-violet-950/30 dark:text-violet-400 border-violet-200 dark:border-violet-900/50',
};

const CONDITION_COLORS = {
  Excellent: 'text-emerald-600',
  Good: 'text-blue-600',
  Fair: 'text-amber-500',
  Poor: 'text-orange-600',
  'Under Repair': 'text-rose-500',
  Decommissioned: 'text-slate-400',
};

function AssetDetailModal({ asset, onClose }) {
  const purchaseValue = Number(asset.purchaseValue || 0);
  const depRate = Number(asset.depreciationRate || 0);
  const ageYears = asset.purchaseDate
    ? (new Date() - new Date(asset.purchaseDate)) / (1000 * 60 * 60 * 24 * 365.25)
    : 0;
  const currentBookValue = purchaseValue * Math.pow(1 - depRate / 100, ageYears);
  const accumulatedDep = purchaseValue - currentBookValue;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-slate-900 w-full max-w-3xl rounded-3xl shadow-2xl border border-slate-200/60 dark:border-slate-800 max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 px-6 py-4 flex items-center justify-between z-10 rounded-t-3xl">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg">
              <HardDrive className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white font-mono">{asset.assetCode}</h2>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${STATUS_STYLES[asset.status] || STATUS_STYLES.Active}`}>{asset.status}</span>
              </div>
              <p className="text-sm text-slate-500 mt-0.5">{asset.assetName}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Core Details */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            {[
              { label: 'Asset Tag No.', value: asset.assetTagNo || '—', icon: Tag },
              { label: 'Serial No.', value: asset.serialNo || '—', icon: Hash },
              { label: 'Category', value: asset.category, icon: Package },
              { label: 'Department', value: asset.department, icon: Building2 },
              { label: 'Location', value: asset.location || '—', icon: MapPin },
              { label: 'Assigned To', value: asset.assignedTo || 'Unassigned', icon: User },
              { label: 'Purchase Date', value: asset.purchaseDate ? format(new Date(asset.purchaseDate), 'dd MMM yyyy') : '—', icon: Calendar },
              { label: 'Warranty Expiry', value: asset.warrantyExpiry ? format(new Date(asset.warrantyExpiry), 'dd MMM yyyy') : '—', icon: Shield },
              { label: 'Condition', value: <span className={`font-bold ${CONDITION_COLORS[asset.condition] || ''}`}>{asset.condition}</span>, icon: Wrench },
            ].map(({ label, value, icon: Icon }) => (
              <div key={label} className="space-y-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <Icon className="w-3 h-3" /> {label}
                </p>
                <p className="font-semibold text-slate-800 dark:text-slate-200">{value}</p>
              </div>
            ))}
          </div>

          {/* Financial Info */}
          <div className="bg-gradient-to-br from-indigo-50 to-violet-50 dark:from-indigo-950/30 dark:to-violet-950/30 rounded-2xl p-5 border border-indigo-100 dark:border-indigo-900/50">
            <p className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider mb-4">Financial Summary & Depreciation</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-xs text-slate-500">Purchase Value</p>
                <p className="font-bold text-slate-900 dark:text-white text-lg">₹{purchaseValue.toLocaleString('en-IN')}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Depreciation Method</p>
                <p className="font-semibold text-slate-700 dark:text-slate-300 text-xs">{asset.depreciationMethod}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Dep. Rate / Useful Life</p>
                <p className="font-bold text-slate-900 dark:text-white">{depRate}% / {asset.usefulLifeYears}Y</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Salvage Value</p>
                <p className="font-bold text-slate-900 dark:text-white">₹{Number(asset.salvageValue || 0).toLocaleString('en-IN')}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Acc. Depreciation</p>
                <p className="font-bold text-rose-500">₹{accumulatedDep.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Current Book Value</p>
                <p className="font-black text-indigo-600 dark:text-indigo-400 text-lg">₹{Math.max(0, currentBookValue).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Asset Age</p>
                <p className="font-bold text-slate-900 dark:text-white">{ageYears.toFixed(1)} years</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">GL / Cost Center</p>
                <p className="font-mono font-bold text-slate-700 dark:text-slate-300 text-xs">{asset.glAccount || '—'}</p>
              </div>
            </div>
          </div>

          {/* Depreciation Bar */}
          {purchaseValue > 0 && (
            <div>
              <div className="flex justify-between text-xs text-slate-500 mb-1.5">
                <span>Depreciation Progress</span>
                <span>{((accumulatedDep / purchaseValue) * 100).toFixed(1)}% depreciated</span>
              </div>
              <div className="h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-indigo-500 to-rose-500 rounded-full transition-all duration-700"
                  style={{ width: `${Math.min(100, (accumulatedDep / purchaseValue) * 100)}%` }}
                />
              </div>
            </div>
          )}

          {/* Vendor Info */}
          {(asset.vendorName || asset.vendorContact) && (
            <div className="border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Vendor Information</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                {asset.vendorName && <div><p className="text-xs text-slate-500">Vendor</p><p className="font-semibold">{asset.vendorName}</p></div>}
                {asset.vendorContact && <div><p className="text-xs text-slate-500">Contact</p><p className="font-semibold">{asset.vendorContact}</p></div>}
                {asset.vendorGstin && <div><p className="text-xs text-slate-500">GSTIN</p><p className="font-mono font-semibold text-xs">{asset.vendorGstin}</p></div>}
              </div>
            </div>
          )}

          {asset.notes && (
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Notes / Remarks</p>
              <p className="text-sm text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl">{asset.notes}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function APInvoiceSelect({ invoices = [], value, onChange }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = React.useRef(null);

  const sortedInvoices = [...invoices].sort((a, b) => {
    if (a.invoiceDate && b.invoiceDate) {
      return new Date(b.invoiceDate) - new Date(a.invoiceDate);
    }
    return b.apInvoiceNo.localeCompare(a.apInvoiceNo);
  });

  const filtered = sortedInvoices.filter(i =>
    i.apInvoiceNo?.toLowerCase().includes(search.toLowerCase()) ||
    i.vendorName?.toLowerCase().includes(search.toLowerCase())
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
        onClick={() => setOpen(!open)}
        className={`w-full px-4 h-10 border rounded-xl text-left flex items-center justify-between transition-all duration-200 shadow-sm ${
          open ? 'bg-indigo-50/50 border-indigo-400 ring-4 ring-indigo-500/10 dark:bg-indigo-900/10 dark:border-indigo-500' : 'bg-slate-50/50 dark:bg-slate-900/50 border-slate-300 dark:border-slate-700 hover:border-indigo-400 hover:bg-white dark:hover:bg-slate-800'
        }`}
      >
        <span className={value ? 'text-slate-900 dark:text-white truncate font-medium text-sm' : 'text-slate-500 dark:text-slate-400 text-sm'}>
          {value ? `${value.apInvoiceNo} — ${value.vendorName}` : 'Select Posted/Paid AP Invoice...'}
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
              placeholder="Search Invoice No or Vendor..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all dark:text-white"
              autoFocus
            />
          </div>
          <ul className="max-h-60 overflow-y-auto p-1">
            {filtered.length === 0 ? (
              <li className="px-4 py-8 text-sm text-slate-500 flex flex-col items-center justify-center">
                <Search className="w-6 h-6 text-slate-300 mb-2" />
                No invoices found
              </li>
            ) : (
              filtered.map(i => {
                const total = Number(i.grandTotal || 0);
                return (
                  <li
                    key={i.id}
                    onMouseDown={() => { onChange(i); setOpen(false); setSearch(''); }}
                    className="px-4 py-2.5 mx-1 my-0.5 rounded-lg text-sm cursor-pointer hover:bg-indigo-50 hover:text-indigo-700 dark:hover:bg-indigo-500/10 dark:hover:text-indigo-300 transition-colors flex flex-col justify-start group"
                  >
                    <div className="flex justify-between w-full">
                      <span className="font-semibold text-slate-700 dark:text-slate-300 group-hover:text-indigo-700 dark:group-hover:text-indigo-300">{i.apInvoiceNo}</span>
                      <span className="font-bold text-slate-900 dark:text-white group-hover:text-indigo-700 dark:group-hover:text-indigo-300">₹{total.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                    </div>
                    <span className="text-xs text-slate-400 mt-0.5">{i.vendorName} • {i.invoiceDate ? format(new Date(i.invoiceDate), 'dd MMM yyyy hh:mm a') : '—'}</span>
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

function CapitalizeAssetForm({ onBack, isReadOnly }) {
  const [form, setForm] = useState({
    apInvoiceId: '',
    grpoId: '',
    assetName: '',
    assetTagNo: '',
    serialNo: '',
    category: 'IT Equipment',
    department: 'IT',
    location: '',
    assignedTo: '',
    assignedEmpId: '',
    purchaseDate: null,
    purchaseValue: '',
    salvageValue: '',
    usefulLifeYears: 5,
    depreciationRate: 20,
    depreciationMethod: 'Straight Line Method (SLM)',
    glAccount: '1501001',
    condition: 'Excellent',
    warrantyExpiry: null,
    vendorName: '',
    vendorContact: '',
    vendorGstin: '',
    notes: '',
  });
  const [error, setError] = useState('');
  const qc = useQueryClient();

  const { data: invoices = [] } = useQuery({
    queryKey: ['asset-ap-invoices-posted'],
    queryFn: () => api.get('/asset-management/ap-invoices').then(r => r.data.filter(i => ['Posted', 'Paid'].includes(i.status))),
  });

  const mutation = useMutation({
    mutationFn: data => api.post('/asset-management/assets', data).then(r => r.data),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['asset-register'] });
      Swal.fire({
        icon: 'success',
        title: 'Asset Capitalized!',
        html: `<b>${res.assetCode}</b> has been added to the Asset Register.<br/><span style="color:#6366f1;font-size:0.85em">Asset Tag: ${res.assetTagNo || 'Pending'}</span>`,
        confirmButtonColor: '#4f46e5',
        customClass: { popup: 'rounded-3xl border border-slate-200' }
      }).then(() => onBack());
    },
    onError: err => setError(err.response?.data?.error || 'Failed to capitalize asset'),
  });

  const handleSubmit = e => {
    e.preventDefault();
    setError('');
    if (!form.assetName) { setError('Asset name is required'); return; }
    if (!form.purchaseDate) { setError('Purchase date is required'); return; }
    if (!form.purchaseValue || Number(form.purchaseValue) <= 0) { setError('Valid purchase value is required'); return; }
    mutation.mutate(form);
  };

  const update = (f, v) => setForm(p => ({ ...p, [f]: v }));

  const fillFromInvoice = invId => {
    const inv = invoices.find(i => i.id === invId);
    if (!inv) return;
    setForm(prev => ({
      ...prev,
      apInvoiceId: invId,
      vendorName: inv.vendorName,
      vendorGstin: inv.vendorGstin || '',
      purchaseDate: inv.invoiceDate ? new Date(inv.invoiceDate) : prev.purchaseDate,
      purchaseValue: inv.grandTotal?.toString() || prev.purchaseValue,
    }));
  };

  const annualDep = (Number(form.purchaseValue || 0) - Number(form.salvageValue || 0)) / Number(form.usefulLifeYears || 1);

  return (
    <div className="space-y-6 w-full">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onBack} className="rounded-full border border-slate-200 dark:border-slate-700">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Capitalize Asset</h2>
          <p className="text-sm text-slate-500">SAP B1 Asset Procurement — Step 6 of 8 (Fixed Asset Register Entry)</p>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-3 p-4 bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/50 rounded-2xl text-rose-700 dark:text-rose-400 text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Link to AP Invoice */}
        <div className="border border-indigo-200 dark:border-indigo-900/50 bg-indigo-50/40 dark:bg-indigo-950/20 rounded-2xl p-5">
          <h3 className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider mb-3 flex items-center gap-2">
            <HardDrive className="w-4 h-4" /> Link to AP Invoice
          </h3>
          <div className="relative max-w-md">
            <APInvoiceSelect
              invoices={invoices}
              value={invoices.find(i => i.id === form.apInvoiceId) || null}
              onChange={inv => fillFromInvoice(inv.id)}
            />
          </div>
        </div>

        {/* Asset Identity */}
        <div className="border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
            <Tag className="w-4 h-4 text-indigo-500" /> Asset Identity
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2 space-y-1.5">
              <Label>Asset Name / Description <span className="text-rose-500">*</span></Label>
              <Input required value={form.assetName} onChange={e => update('assetName', e.target.value)} placeholder="e.g. Dell Latitude 5540 Laptop" className="h-10 rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <Label>Asset Tag No.</Label>
              <Input value={form.assetTagNo} onChange={e => update('assetTagNo', e.target.value)} placeholder="AT-00001" className="h-10 rounded-xl font-mono" />
            </div>
            <div className="space-y-1.5">
              <Label>Serial Number</Label>
              <Input value={form.serialNo} onChange={e => update('serialNo', e.target.value)} placeholder="SN-XXXXXXXXXX" className="h-10 rounded-xl font-mono" />
            </div>
            <div className="space-y-1.5">
              <Label>Category <span className="text-rose-500">*</span></Label>
              <div className="relative">
                <select value={form.category} onChange={e => update('category', e.target.value)}
                  className="w-full h-10 px-3 pr-8 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-500/20">
                  {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                </select>
                <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-3 pointer-events-none" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Condition</Label>
              <div className="relative">
                <select value={form.condition} onChange={e => update('condition', e.target.value)}
                  className="w-full h-10 px-3 pr-8 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-500/20">
                  {CONDITIONS.map(c => <option key={c}>{c}</option>)}
                </select>
                <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-3 pointer-events-none" />
              </div>
            </div>
          </div>
        </div>

        {/* Location & Assignment */}
        <div className="border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
            <MapPin className="w-4 h-4 text-indigo-500" /> Location & Assignment
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label>Department <span className="text-rose-500">*</span></Label>
              <div className="relative">
                <select value={form.department} onChange={e => update('department', e.target.value)}
                  className="w-full h-10 px-3 pr-8 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-500/20">
                  {DEPARTMENTS.map(d => <option key={d}>{d}</option>)}
                </select>
                <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-3 pointer-events-none" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Physical Location</Label>
              <Input value={form.location} onChange={e => update('location', e.target.value)} placeholder="e.g. 2nd Floor, IT Room" className="h-10 rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <Label>Assigned To</Label>
              <Input value={form.assignedTo} onChange={e => update('assignedTo', e.target.value)} placeholder="Employee name" className="h-10 rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <Label>Employee ID</Label>
              <Input value={form.assignedEmpId} onChange={e => update('assignedEmpId', e.target.value)} placeholder="EMP-001" className="h-10 rounded-xl" />
            </div>
            <DatePicker label="Warranty Expiry" value={form.warrantyExpiry} onChange={d => update('warrantyExpiry', d)} placeholder="Warranty valid until" />
          </div>
        </div>

        {/* Financial / Depreciation */}
        <div className="border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
            <TrendingDown className="w-4 h-4 text-indigo-500" /> Financial Details & Depreciation
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <DatePicker label="Purchase Date *" value={form.purchaseDate} onChange={d => update('purchaseDate', d)} placeholder="Date of purchase" />
            <div className="space-y-1.5">
              <Label>Purchase Value (₹) <span className="text-rose-500">*</span></Label>
              <Input required type="number" min="1" value={form.purchaseValue} onChange={e => update('purchaseValue', e.target.value)} placeholder="0.00" className="h-10 rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <Label>Salvage / Residual Value (₹)</Label>
              <Input type="number" min="0" value={form.salvageValue} onChange={e => update('salvageValue', e.target.value)} placeholder="0.00" className="h-10 rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <Label>Useful Life (Years)</Label>
              <Input type="number" min="1" max="100" value={form.usefulLifeYears} onChange={e => update('usefulLifeYears', e.target.value)} className="h-10 rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <Label>Depreciation Rate (% p.a.)</Label>
              <Input type="number" min="0" max="100" value={form.depreciationRate} onChange={e => update('depreciationRate', e.target.value)} className="h-10 rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <Label>Depreciation Method</Label>
              <div className="relative">
                <select value={form.depreciationMethod} onChange={e => update('depreciationMethod', e.target.value)}
                  className="w-full h-10 px-3 pr-8 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-500/20">
                  {DEPRECIATION_METHODS.map(m => <option key={m}>{m}</option>)}
                </select>
                <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-3 pointer-events-none" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>GL Account (Fixed Asset)</Label>
              <Input value={form.glAccount} onChange={e => update('glAccount', e.target.value)} placeholder="1501001" className="h-10 rounded-xl font-mono" />
            </div>
            <div className="space-y-1.5">
              <Label>Annual Depreciation (Est.)</Label>
              <div className="h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 flex items-center text-sm font-bold text-rose-500">
                ₹{annualDep.toLocaleString('en-IN', { maximumFractionDigits: 0 })} / year
              </div>
            </div>
          </div>
        </div>

        {/* Vendor Details */}
        <div className="border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-indigo-500" /> Vendor Details
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label>Vendor Name</Label>
              <Input value={form.vendorName} onChange={e => update('vendorName', e.target.value)} className="h-10 rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <Label>Vendor Contact</Label>
              <Input value={form.vendorContact} onChange={e => update('vendorContact', e.target.value)} className="h-10 rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <Label>Vendor GSTIN</Label>
              <Input value={form.vendorGstin} onChange={e => update('vendorGstin', e.target.value)} placeholder="22AAAAA0000A1Z5" className="h-10 rounded-xl font-mono" />
            </div>
          </div>
        </div>

        {/* Notes */}
        <div className="border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
          <Label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">Additional Notes</Label>
          <textarea value={form.notes} onChange={e => update('notes', e.target.value)} rows={3}
            placeholder="Any additional notes about this asset, maintenance schedule, insurance details..."
            className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 resize-none" />
        </div>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={onBack} className="rounded-xl px-6 h-11">Cancel</Button>
          <Button type="submit" disabled={mutation.isPending || isReadOnly}
            className="rounded-xl px-6 h-11 bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-600/20 gap-2">
            {mutation.isPending
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Capitalizing...</>
              : <><HardDrive className="w-4 h-4" /> Capitalize Asset</>}
          </Button>
        </div>
      </form>
    </div>
  );
}

export default function AssetRegisterView() {
  const user = useAuthStore(s => s.user);
  const isReadOnly = user?.role === 'SUPERVISOR';
  const [view, setView] = useState('list');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [sortBy, setSortBy] = useState('recent');
  const [currentPage, setCurrentPage] = useState(1);
  const qc = useQueryClient();

  useEffect(() => {
    setCurrentPage(1);
  }, [search, categoryFilter, statusFilter, sortBy]);

  const { data: assets = [], isLoading } = useQuery({
    queryKey: ['asset-register'],
    queryFn: () => api.get('/asset-management/assets').then(r => r.data),
  });

  const decommissionMutation = useMutation({
    mutationFn: id => api.patch(`/asset-management/assets/${id}/decommission`).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['asset-register'] });
      setSelectedAsset(null);
    },
    onError: err => Swal.fire({ icon: 'error', title: 'Error', text: err.response?.data?.error || 'Failed', confirmButtonColor: '#4f46e5' })
  });



  const filtered = assets.filter(a => {
    const matchSearch =
      a.assetName?.toLowerCase().includes(search.toLowerCase()) ||
      a.assetCode?.toLowerCase().includes(search.toLowerCase()) ||
      a.assetTagNo?.toLowerCase().includes(search.toLowerCase()) ||
      a.department?.toLowerCase().includes(search.toLowerCase()) ||
      a.assignedTo?.toLowerCase().includes(search.toLowerCase());
    const matchCat = categoryFilter === 'ALL' || a.category === categoryFilter;
    const matchStatus = statusFilter === 'ALL' || a.status === statusFilter;
    return matchSearch && matchCat && matchStatus;
  });

  const sortedAndFiltered = [...filtered].sort((a, b) => {
    if (sortBy === 'recent') {
      return new Date(b.purchaseDate || b.createdAt) - new Date(a.purchaseDate || a.createdAt);
    }
    if (sortBy === 'oldest') {
      return new Date(a.purchaseDate || a.createdAt) - new Date(b.purchaseDate || b.createdAt);
    }
    if (sortBy === 'priceLowHigh') {
      return Number(a.purchaseValue || 0) - Number(b.purchaseValue || 0);
    }
    if (sortBy === 'priceHighLow') {
      return Number(b.purchaseValue || 0) - Number(a.purchaseValue || 0);
    }
    if (sortBy === 'alphabetical') {
      return (a.assetName || '').localeCompare(b.assetName || '');
    }
    return 0;
  });

  const ITEMS_PER_PAGE = 10;
  const totalPages = Math.ceil(sortedAndFiltered.length / ITEMS_PER_PAGE);
  const paginatedItems = sortedAndFiltered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  if (view === 'capitalize') return <CapitalizeAssetForm onBack={() => setView('list')} isReadOnly={isReadOnly} />;

  const totalBookValue = assets.reduce((s, a) => {
    const pv = Number(a.purchaseValue || 0);
    const rate = Number(a.depreciationRate || 0);
    const age = a.purchaseDate
      ? (new Date() - new Date(a.purchaseDate)) / (1000 * 60 * 60 * 24 * 365.25)
      : 0;
    return s + Math.max(0, pv * Math.pow(1 - rate / 100, age));
  }, 0);

  const totalPurchaseValue = assets.reduce((s, a) => s + Number(a.purchaseValue || 0), 0);
  const activeCount = assets.filter(a => a.status === 'Active').length;
  const underMaintenance = assets.filter(a => a.status === 'Under Maintenance').length;

  return (
    <div className="space-y-6">
      {selectedAsset && <AssetDetailModal asset={selectedAsset} onClose={() => setSelectedAsset(null)} />}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Asset Register</h2>
          <p className="text-sm text-slate-500 mt-0.5">Fixed Asset Register — capitalization, depreciation & lifecycle tracking</p>
        </div>
        {!isReadOnly && (
          <Button onClick={() => setView('capitalize')} className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-md shadow-indigo-600/10 h-10 px-5">
            <Plus className="w-4 h-4" /> Capitalize Asset
          </Button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Assets', value: assets.length, icon: HardDrive, bg: 'bg-indigo-50 dark:bg-indigo-950/30', clr: 'text-indigo-600 dark:text-indigo-400' },
          { label: 'Active', value: activeCount, icon: CheckCircle2, bg: 'bg-emerald-50 dark:bg-emerald-950/30', clr: 'text-emerald-600 dark:text-emerald-400' },
          { label: 'Under Maint.', value: underMaintenance, icon: Wrench, bg: 'bg-amber-50 dark:bg-amber-950/30', clr: 'text-amber-600 dark:text-amber-400' },
          { label: 'Book Value', value: `₹${(totalBookValue / 100000).toFixed(1)}L`, icon: TrendingDown, bg: 'bg-violet-50 dark:bg-violet-950/30', clr: 'text-violet-600 dark:text-violet-400' },
        ].map(({ label, value, icon: Icon, bg, clr }) => (
          <div key={label} className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/60 rounded-2xl p-4 flex items-center gap-3 shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${bg} ${clr}`}><Icon className="w-5 h-5" /></div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</p>
              <p className="text-xl font-bold text-slate-900 dark:text-white">{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Purchase vs Book Value Bar */}
      {totalPurchaseValue > 0 && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/60 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm font-bold text-slate-700 dark:text-slate-300">Asset Depreciation Overview</p>
              <p className="text-xs text-slate-400 mt-0.5">Purchase value vs. current book value across all assets</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-500">Total Depreciation</p>
              <p className="text-lg font-black text-rose-500">₹{((totalPurchaseValue - totalBookValue) / 100000).toFixed(1)}L</p>
            </div>
          </div>
          <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-emerald-400 to-indigo-500 rounded-full transition-all duration-700"
              style={{ width: `${Math.min(100, (totalBookValue / totalPurchaseValue) * 100)}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-slate-400 mt-1.5">
            <span>Book Value: ₹{(totalBookValue / 100000).toFixed(1)}L ({((totalBookValue / totalPurchaseValue) * 100).toFixed(1)}%)</span>
            <span>Purchase: ₹{(totalPurchaseValue / 100000).toFixed(1)}L</span>
          </div>
        </div>
      )}

      <div className="bg-slate-50/60 dark:bg-slate-800/20 border border-slate-200/60 dark:border-slate-800/60 rounded-2xl p-3 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by code, name, tag, department, assigned to..." className="pl-9 h-9 rounded-xl bg-white dark:bg-slate-900" />
        </div>
        <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}
          className="h-9 px-3 pr-8 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-sm appearance-none focus:outline-none text-slate-700 dark:text-slate-350">
          <option value="ALL">All Categories</option>
          {CATEGORIES.map(c => <option key={c}>{c}</option>)}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="h-9 px-3 pr-8 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-sm appearance-none focus:outline-none text-slate-700 dark:text-slate-350">
          <option value="ALL">All Status</option>
          {['Active', 'Under Maintenance', 'In Transit', 'Idle', 'Disposed', 'Scrapped'].map(s => <option key={s}>{s}</option>)}
        </select>
        <div className="relative w-full sm:w-48">
          <select value={sortBy} onChange={e => setSortBy(e.target.value)}
            className="w-full h-9 pl-3 pr-8 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-700 dark:text-slate-350">
            <option value="recent">Recent first</option>
            <option value="oldest">Oldest first</option>
            <option value="priceLowHigh">Value: Low to High</option>
            <option value="priceHighLow">Value: High to Low</option>
            <option value="alphabetical">Alphabetical</option>
          </select>
          <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-2.5 pointer-events-none" />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-2xl border border-slate-200/60 dark:border-slate-800/60">
        <table className="w-full text-sm">
          <thead className="bg-slate-50/80 dark:bg-slate-800/50">
            <tr>
              {['Asset Code', 'Asset Name', 'Tag No.', 'Category', 'Dept.', 'Assigned To', 'Purchase Value', 'Book Value', 'Condition', 'Status', 'Actions'].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
            {isLoading ? Array.from({ length: 4 }).map((_, i) => (
              <tr key={i}>{Array.from({ length: 11 }).map((_, j) => <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-full rounded" /></td>)}</tr>
            )) : sortedAndFiltered.length === 0 ? (
              <tr><td colSpan={11} className="px-4 py-16 text-center">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-16 h-16 bg-gradient-to-br from-indigo-50 to-violet-50 dark:from-indigo-950/30 dark:to-violet-950/30 rounded-2xl flex items-center justify-center">
                    <HardDrive className="w-8 h-8 text-indigo-400" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-700 dark:text-slate-300">No assets in register</p>
                    <p className="text-xs text-slate-400 mt-1">Capitalize assets from AP Invoices to populate the register</p>
                  </div>
                </div>
              </td></tr>
            ) : paginatedItems.map(asset => {
              const pv = Number(asset.purchaseValue || 0);
              const rate = Number(asset.depreciationRate || 0);
              const age = asset.purchaseDate
                ? (new Date() - new Date(asset.purchaseDate)) / (1000 * 60 * 60 * 24 * 365.25)
                : 0;
              const bookValue = Math.max(0, pv * Math.pow(1 - rate / 100, age));

              return (
                <tr key={asset.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors">
                  <td className="px-4 py-3">
                    <button onClick={() => setSelectedAsset(asset)} className="font-mono font-bold text-indigo-600 dark:text-indigo-400 text-xs hover:underline">{asset.assetCode}</button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-semibold text-slate-800 dark:text-slate-200 max-w-[160px] truncate">{asset.assetName}</div>
                    <div className="text-xs text-slate-400 font-mono">{asset.serialNo || '—'}</div>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">{asset.assetTagNo || '—'}</td>
                  <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-400">{asset.category}</td>
                  <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-400">{asset.department}</td>
                  <td className="px-4 py-3 text-xs text-slate-500">{asset.assignedTo || <span className="italic text-slate-400">Unassigned</span>}</td>
                  <td className="px-4 py-3 text-slate-700 dark:text-slate-300 font-medium">₹{pv.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                  <td className="px-4 py-3 font-bold text-indigo-600 dark:text-indigo-400">₹{bookValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-bold ${CONDITION_COLORS[asset.condition] || 'text-slate-500'}`}>{asset.condition}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${STATUS_STYLES[asset.status] || STATUS_STYLES.Active}`}>{asset.status}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" onClick={() => setSelectedAsset(asset)} className="h-8 w-8 rounded-lg text-slate-400 hover:text-indigo-600">
                        <Eye className="w-4 h-4" />
                      </Button>
                      {!isReadOnly && asset.status === 'Active' && (
                        <Button variant="ghost" size="icon" title="Decommission"
                          onClick={() => Swal.fire({
                            title: 'Decommission Asset?',
                            text: `${asset.assetCode} will be marked as Disposed.`,
                            icon: 'warning',
                            showCancelButton: true,
                            confirmButtonColor: '#ef4444',
                            confirmButtonText: 'Decommission'
                          }).then(r => r.isConfirmed && decommissionMutation.mutate(asset.id))}
                          className="h-8 w-8 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20">
                          <Archive className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
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
