import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/axios';
import { useNavigate, useLocation } from 'react-router-dom';
import { format } from 'date-fns';
import { FlaskConical, Plus, Search, AlertTriangle, CheckCircle, Clock, XCircle, ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import DatePicker from '@/components/ui/DatePicker';

const CATEGORY_COLORS = {
  REAGENT:    'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  CHEMICAL:   'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  CONSUMABLE: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400',
  EQUIPMENT:  'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
  GLASSWARE:  'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
  SAFETY:     'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
};

const STATUS_CONFIG = {
  SUFFICIENT: { label: 'Sufficient',  color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400', icon: CheckCircle },
  LOW_STOCK:  { label: 'Low Stock',   color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', icon: AlertTriangle },
  CRITICAL:   { label: 'Critical',    color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',         icon: XCircle },
  EXPIRED:    { label: 'Expired',     color: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400',    icon: Clock },
};

const CATEGORIES = ['REAGENT', 'CHEMICAL', 'CONSUMABLE', 'EQUIPMENT', 'GLASSWARE', 'SAFETY'];
const STORAGE_CONDITIONS = [
  { value: 'ROOM_TEMP', label: 'Room Temperature' },
  { value: 'REFRIGERATED', label: 'Refrigerated (2–8°C)' },
  { value: 'FREEZER', label: 'Freezer (< -18°C)' },
  { value: 'FLAMMABLE', label: 'Flammable Cabinet' },
];
const UOMS = ['ml', 'L', 'g', 'kg', 'units', 'boxes', 'pcs', 'rolls'];

function LabInventoryAddForm({ onBack }) {
  const queryClient = useQueryClient();
  const [error, setError] = useState(null);

  const [form, setForm] = useState({
    name: '',
    itemCategory: '',
    quantityReceived: '',
    uom: '',
    supplierName: '',
    invoiceNumber: '',
    purchaseDate: '',
    expiryDate: '',
    storageCondition: '',
    minimumStockLevel: '0',
    batchLotNumber: '',
  });

  const mutation = useMutation({
    mutationFn: (data) => api.post('/lab-inventory', data).then(r => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lab-inventory'] });
      onBack();
    },
    onError: (err) => setError(err?.response?.data?.error || 'Failed to add item'),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    setError(null);
    if (!form.name) return setError('Item name is required');
    if (!form.itemCategory) return setError('Category is required');
    if (!form.quantityReceived || Number(form.quantityReceived) < 0) return setError('Enter valid quantity received');
    if (!form.uom) return setError('Unit of measure is required');

    mutation.mutate({
      name: form.name,
      itemCategory: form.itemCategory,
      quantityReceived: Number(form.quantityReceived),
      uom: form.uom,
      supplierName: form.supplierName || undefined,
      invoiceNumber: form.invoiceNumber || undefined,
      purchaseDate: form.purchaseDate || undefined,
      expiryDate: form.expiryDate || undefined,
      storageCondition: form.storageCondition || undefined,
      minimumStockLevel: Number(form.minimumStockLevel || 0),
      batchLotNumber: form.batchLotNumber || undefined,
    });
  };

  const field = (key, label, type = 'text', required = false, placeholder = '') => (
    <div>
      <Label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 block">
        {label}{required && ' *'}
      </Label>
      <Input
        type={type}
        value={form[key]}
        onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
        placeholder={placeholder}
        className="text-sm"
      />
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={onBack} className="p-2 rounded-lg hover:bg-slate-105 dark:hover:bg-slate-800 transition-colors">
          <ArrowLeft className="w-5 h-5 text-slate-505" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <FlaskConical className="w-6 h-6 text-purple-500" />
            Add Lab Inventory Item
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Add a reagent, chemical, consumable, or equipment to lab inventory</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Info */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6 space-y-4">
          <h2 className="font-semibold text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-700 pb-3">Item Details</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {field('name', 'Item Name', 'text', true, 'e.g., Gerber Acid, pH Buffer Solution 7.0')}
            <div>
              <Label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 block">Category *</Label>
              <select
                value={form.itemCategory}
                onChange={e => setForm(p => ({ ...p, itemCategory: e.target.value }))}
                className="w-full border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="">Select category...</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{c.charAt(0) + c.slice(1).toLowerCase()}</option>)}
              </select>
            </div>
            <div>
              <Label className="text-sm font-medium text-slate-700 dark:text-slate-303 mb-1.5 block">Quantity Received *</Label>
              <Input
                type="number"
                min="0"
                step="0.001"
                value={form.quantityReceived}
                onChange={e => setForm(p => ({ ...p, quantityReceived: e.target.value }))}
                placeholder="0.00"
                className="text-sm"
              />
            </div>
            <div>
              <Label className="text-sm font-medium text-slate-700 dark:text-slate-303 mb-1.5 block">Unit of Measure *</Label>
              <select
                value={form.uom}
                onChange={e => setForm(p => ({ ...p, uom: e.target.value }))}
                className="w-full border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="">Select UOM...</option>
                {UOMS.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div>
              <Label className="text-sm font-medium text-slate-700 dark:text-slate-303 mb-1.5 block">Minimum Stock Level</Label>
              <Input
                type="number"
                min="0"
                step="0.001"
                value={form.minimumStockLevel}
                onChange={e => setForm(p => ({ ...p, minimumStockLevel: e.target.value }))}
                placeholder="0"
                className="text-sm"
              />
              <p className="text-xs text-slate-400 mt-1">Alert will trigger when stock falls below this</p>
            </div>
            <div>
              <Label className="text-sm font-medium text-slate-700 dark:text-slate-303 mb-1.5 block">Storage Condition</Label>
              <select
                value={form.storageCondition}
                onChange={e => setForm(p => ({ ...p, storageCondition: e.target.value }))}
                className="w-full border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="">Select condition...</option>
                {STORAGE_CONDITIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Purchase Info */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6 space-y-4">
          <h2 className="font-semibold text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-700 pb-3">Purchase Information <span className="text-xs font-normal text-slate-400">(Optional)</span></h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {field('supplierName', 'Supplier Name', 'text', false, 'Chemical supplier name')}
            {field('invoiceNumber', 'Invoice Number', 'text', false, 'INV-XXXX')}
            <DatePicker
              label="Purchase Date"
              value={form.purchaseDate ? new Date(form.purchaseDate) : null}
              onChange={date => setForm(p => ({ ...p, purchaseDate: date ? date.toISOString() : '' }))}
              modalTitle="Purchase Date"
              placeholder="Select Date"
              triggerClassName="h-10 text-sm"
            />
            <DatePicker
              label="Expiry Date"
              value={form.expiryDate ? new Date(form.expiryDate) : null}
              onChange={date => setForm(p => ({ ...p, expiryDate: date ? date.toISOString() : '' }))}
              modalTitle="Expiry Date"
              placeholder="Select Date"
              triggerClassName="h-10 text-sm"
            />
            {field('batchLotNumber', 'Batch/Lot Number', 'text', false, 'Lot# from supplier')}
          </div>
        </div>

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-lg px-4 py-3 text-sm flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" /> {error}
          </div>
        )}

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={onBack}>Cancel</Button>
          <Button type="submit" disabled={mutation.isPending} className="bg-purple-600 hover:bg-purple-700 text-white">
            {mutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
            Add to Lab Inventory
          </Button>
        </div>
      </form>
    </div>
  );
}

const LabInventoryListPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
  const [view, setView] = useState(() => {
    return location.pathname.endsWith('/add') ? 'add' : 'list';
  });

  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  useEffect(() => {
    setView(location.pathname.endsWith('/add') ? 'add' : 'list');
  }, [location.pathname]);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['lab-inventory', filterCategory, filterStatus],
    queryFn: () => {
      const params = new URLSearchParams();
      if (filterCategory) params.set('itemCategory', filterCategory);
      if (filterStatus) params.set('status', filterStatus);
      return api.get(`/lab-inventory?${params.toString()}`).then(r => r.data);
    },
  });

  const alerts = items.filter(i => i.computedStatus === 'LOW_STOCK' || i.computedStatus === 'CRITICAL' || i.computedStatus === 'EXPIRED');

  const filtered = items.filter(i => {
    if (search) {
      const term = search.toLowerCase();
      if (!i.name?.toLowerCase().includes(term)) return false;
    }
    return true;
  });

  if (view !== 'list') {
    return <LabInventoryAddForm onBack={() => {
      setView('list');
      navigate('/lab-inventory/list');
    }} />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <FlaskConical className="w-6 h-6 text-purple-500" />
            Lab Inventory
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Reagents, chemicals, consumables & equipment</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => navigate('/lab-inventory/use')} variant="outline" className="text-sm">
            <Clock className="w-4 h-4 mr-2" /> Log Usage
          </Button>
          <Button onClick={() => {
            setView('add');
            navigate('/lab-inventory/add');
          }} className="bg-purple-600 hover:bg-purple-700 text-white">
            <Plus className="w-4 h-4 mr-2" /> Add Item
          </Button>
        </div>
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            <p className="font-semibold text-amber-700 dark:text-amber-400">{alerts.length} item{alerts.length !== 1 ? 's' : ''} need attention</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {alerts.map(a => {
              const cfg = STATUS_CONFIG[a.computedStatus];
              return (
                <span key={a.id} className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${cfg.color}`}>
                  <cfg.icon className="w-3 h-3" />
                  {a.name} — {cfg.label}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-405" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search lab items..."
            className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>
        <select
          value={filterCategory}
          onChange={e => setFilterCategory(e.target.value)}
          className="border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
        >
          <option value="">All Categories</option>
          {Object.keys(CATEGORY_COLORS).map(c => <option key={c} value={c}>{c.charAt(0) + c.slice(1).toLowerCase()}</option>)}
        </select>
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
        >
          <option value="">All Statuses</option>
          {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-48 text-slate-400">Loading lab inventory...</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-slate-400">
            <FlaskConical className="w-10 h-10 mb-3 opacity-30" />
            <p className="font-medium">No lab inventory items found</p>
            <p className="text-sm mt-1">Add reagents, chemicals, and equipment</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80">
                  {['Item Name', 'Category', 'Current Stock', 'Min. Stock', 'UOM', 'Storage', 'Expiry Date', 'Status', 'Lot #'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-505 dark:text-slate-400 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {filtered.map(item => {
                  const cfg = STATUS_CONFIG[item.computedStatus || item.status] || STATUS_CONFIG.SUFFICIENT;
                  const catColor = CATEGORY_COLORS[item.itemCategory] || '';
                  const isExpiring = item.expiryDate && new Date(item.expiryDate) <= new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
                  const rowBg = item.computedStatus === 'EXPIRED' ? 'bg-slate-50 dark:bg-slate-900/30' :
                                item.computedStatus === 'CRITICAL' ? 'bg-red-50/30 dark:bg-red-900/10' :
                                item.computedStatus === 'LOW_STOCK' ? 'bg-amber-50/30 dark:bg-amber-900/10' : '';

                  return (
                    <tr key={item.id} className={`hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors ${rowBg}`}>
                      <td className="px-4 py-3">
                        <span className="font-medium text-slate-900 dark:text-white">{item.name}</span>
                        {isExpiring && item.computedStatus !== 'EXPIRED' && (
                          <span className="ml-2 text-xs text-amber-600 dark:text-amber-400">Expiring Soon</span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${catColor}`}>
                          {item.itemCategory}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`font-bold text-base ${
                          Number(item.currentStock) <= 0 ? 'text-red-650 dark:text-red-400' :
                          Number(item.currentStock) <= Number(item.minimumStockLevel) ? 'text-amber-600 dark:text-amber-400' :
                          'text-slate-900 dark:text-white'
                        }`}>
                          {Number(item.currentStock).toFixed(2)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300 whitespace-nowrap">{Number(item.minimumStockLevel).toFixed(2)}</td>
                      <td className="px-4 py-3 text-xs text-slate-505 dark:text-slate-400 whitespace-nowrap">{item.uom}</td>
                      <td className="px-4 py-3 text-xs text-slate-505 dark:text-slate-400 whitespace-nowrap">{item.storageCondition?.replace('_', ' ') || '—'}</td>
                      <td className={`px-4 py-3 text-xs whitespace-nowrap ${isExpiring ? 'text-amber-605 dark:text-amber-400 font-medium' : 'text-slate-500 dark:text-slate-400'}`}>
                        {item.expiryDate ? format(new Date(item.expiryDate), 'dd MMM yyyy') : '—'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${cfg.color}`}>
                          <cfg.icon className="w-3 h-3" />{cfg.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-400 whitespace-nowrap font-mono">{item.batchLotNumber || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default LabInventoryListPage;
