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
import { Pagination } from '@/components/ui/Pagination';

const CATEGORY_COLORS = {
  REAGENT:    'bg-purple-500/10 text-purple-650 dark:text-purple-400 border border-purple-550/20',
  CHEMICAL:   'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20',
  CONSUMABLE: 'bg-teal-500/10 text-teal-650 dark:text-teal-400 border border-teal-550/20',
  EQUIPMENT:  'bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border border-indigo-500/20',
  GLASSWARE:  'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20',
  SAFETY:     'bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20',
};

const STATUS_CONFIG = {
  SUFFICIENT: { label: 'Sufficient',  color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20', icon: CheckCircle },
  LOW_STOCK:  { label: 'Low Stock',   color: 'bg-amber-500/10 text-amber-600 dark:text-amber-405 border border-amber-500/20', icon: AlertTriangle },
  CRITICAL:   { label: 'Critical',    color: 'bg-rose-500/10 text-rose-600 dark:text-rose-455 border border-rose-500/20',         icon: XCircle },
  EXPIRED:    { label: 'Expired',     color: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/20',    icon: Clock },
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
      <Label className="text-[10px] uppercase font-bold text-slate-400 mb-1 block">
        {label}{required && ' *'}
      </Label>
      <Input
        type={type}
        value={form[key]}
        onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
        placeholder={placeholder}
        className="text-xs h-9 rounded-xl"
      />
    </div>
  );

  return (
    <div className="w-full max-w-full px-4 sm:px-6 lg:px-8 py-5 space-y-4 mx-auto transition-all duration-300">
      {/* Header */}
      <div className="flex items-center gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
        <button onClick={onBack} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors border border-slate-200 dark:border-slate-800">
          <ArrowLeft className="w-4 h-4 text-slate-550" />
        </button>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <FlaskConical className="w-5.5 h-5.5 text-purple-550 shrink-0" />
            Add Lab Item
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">Add a reagent, chemical, consumable, or glassware to inventory.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 max-w-4xl">
        {/* Basic Info */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4">
          <h2 className="text-xs font-bold text-slate-850 dark:text-slate-200 uppercase tracking-widest border-b border-slate-100 dark:border-slate-800 pb-2 flex items-center gap-1.5">🔬 Item details</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {field('name', 'Item Name', 'text', true, 'e.g., Gerber Acid, Buffer Solution')}
            <div>
              <Label className="text-[10px] uppercase font-bold text-slate-400 mb-1 block">Category *</Label>
              <select
                value={form.itemCategory}
                onChange={e => setForm(p => ({ ...p, itemCategory: e.target.value }))}
                className="w-full border border-slate-205 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/20 h-9 font-semibold"
              >
                <option value="">Select category...</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{c.charAt(0) + c.slice(1).toLowerCase()}</option>)}
              </select>
            </div>
            <div>
              <Label className="text-[10px] uppercase font-bold text-slate-400 mb-1 block">Quantity Received *</Label>
              <Input
                type="number"
                min="0"
                step="0.001"
                value={form.quantityReceived}
                onChange={e => setForm(p => ({ ...p, quantityReceived: e.target.value }))}
                placeholder="0.00"
                className="text-xs h-9 rounded-xl"
              />
            </div>
            <div>
              <Label className="text-[10px] uppercase font-bold text-slate-400 mb-1 block">Unit of Measure *</Label>
              <select
                value={form.uom}
                onChange={e => setForm(p => ({ ...p, uom: e.target.value }))}
                className="w-full border border-slate-205 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/20 h-9 font-semibold"
              >
                <option value="">Select UOM...</option>
                {UOMS.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div>
              <Label className="text-[10px] uppercase font-bold text-slate-400 mb-1 block">Minimum Alert Level</Label>
              <Input
                type="number"
                min="0"
                step="0.001"
                value={form.minimumStockLevel}
                onChange={e => setForm(p => ({ ...p, minimumStockLevel: e.target.value }))}
                placeholder="0"
                className="text-xs h-9 rounded-xl"
              />
            </div>
            <div>
              <Label className="text-[10px] uppercase font-bold text-slate-400 mb-1 block">Storage Condition</Label>
              <select
                value={form.storageCondition}
                onChange={e => setForm(p => ({ ...p, storageCondition: e.target.value }))}
                className="w-full border border-slate-205 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs bg-white dark:bg-slate-955 text-slate-905 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/20 h-9 font-semibold"
              >
                <option value="">Select condition...</option>
                {STORAGE_CONDITIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Purchase Info */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4">
          <h2 className="text-xs font-bold text-slate-850 dark:text-slate-200 uppercase tracking-widest border-b border-slate-100 dark:border-slate-800 pb-2 flex items-center gap-1.5">💼 Supplier info</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {field('supplierName', 'Supplier Name', 'text', false, 'Supplier vendor name')}
            {field('invoiceNumber', 'Invoice Number', 'text', false, 'Invoice number')}
            <DatePicker
              label="Purchase Date"
              value={form.purchaseDate ? new Date(form.purchaseDate) : null}
              onChange={date => setForm(p => ({ ...p, purchaseDate: date ? date.toISOString() : '' }))}
              modalTitle="Purchase Date"
              placeholder="Select Date"
              className="space-y-1"
              labelClassName="text-[10px] uppercase font-bold text-slate-400 block"
              triggerClassName="h-9 text-xs rounded-xl"
            />
            <DatePicker
              label="Expiry Date"
              value={form.expiryDate ? new Date(form.expiryDate) : null}
              onChange={date => setForm(p => ({ ...p, expiryDate: date ? date.toISOString() : '' }))}
              modalTitle="Expiry Date"
              placeholder="Select Date"
              className="space-y-1"
              labelClassName="text-[10px] uppercase font-bold text-slate-400 block"
              triggerClassName="h-9 text-xs rounded-xl"
            />
            {field('batchLotNumber', 'Batch/Lot Number', 'text', false, 'Lot#')}
          </div>
        </div>

        {error && (
          <div className="bg-rose-500/10 border border-rose-500/20 text-rose-650 dark:text-rose-455 rounded-xl p-3 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onBack} className="rounded-xl h-9 text-xs px-4">Cancel</Button>
          <Button type="submit" disabled={mutation.isPending} className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl h-9 text-xs px-4 active:scale-[0.98] transition-all font-semibold">
            {mutation.isPending ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Plus className="w-3.5 h-3.5 mr-1.5" />}
            Save to Inventory
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

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

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

  // Reset pagination on filter change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, filterCategory, filterStatus]);

  const alerts = items.filter(i => i.computedStatus === 'LOW_STOCK' || i.computedStatus === 'CRITICAL' || i.computedStatus === 'EXPIRED');

  const filtered = items.filter(i => {
    if (search) {
      const term = search.toLowerCase();
      if (!i.name?.toLowerCase().includes(term)) return false;
    }
    return true;
  });

  // Pagination Calculations
  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginatedItems = filtered.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  if (view !== 'list') {
    return <LabInventoryAddForm onBack={() => {
      setView('list');
      navigate('/lab-inventory/list');
    }} />;
  }

  return (
    <div className="w-full max-w-full px-4 sm:px-6 lg:px-8 py-5 space-y-4 mx-auto transition-all duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-205 dark:border-slate-800">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <FlaskConical className="w-5.5 h-5.5 text-purple-600 dark:text-purple-400 shrink-0" />
            Lab Inventory
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Reagents, chemicals, consumables, glassware & equipment</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto justify-end">
          <Button onClick={() => navigate('/lab-inventory/use')} variant="outline" size="sm" className="text-xs rounded-xl h-8">
            <Clock className="w-3.5 h-3.5 mr-1.5" /> Log Usage
          </Button>
          <Button onClick={() => {
            setView('add');
            navigate('/lab-inventory/add');
          }} className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs rounded-xl h-8 font-semibold active:scale-[0.98] transition-all">
            <Plus className="w-3.5 h-3.5 mr-1.5" /> Add Item
          </Button>
        </div>
      </div>

      {/* Alerts Banner */}
      {alerts.length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4.5 h-4.5 text-amber-500 shrink-0 animate-pulse" />
            <p className="font-bold text-amber-800 dark:text-amber-400 text-xs">{alerts.length} item(s) need attention</p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {alerts.map(a => {
              const cfg = STATUS_CONFIG[a.computedStatus];
              return (
                <span key={a.id} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold border ${cfg.color}`}>
                  <cfg.icon className="w-3 h-3 shrink-0" />
                  {a.name} ({cfg.label})
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Filters Toolbar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-sm flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search lab items..."
            className="w-full pl-9 pr-4 py-2 text-xs border border-slate-205 dark:border-slate-805 rounded-xl bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/25 h-9"
          />
        </div>
        
        <select
          value={filterCategory}
          onChange={e => setFilterCategory(e.target.value)}
          className="border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-305 focus:outline-none focus:ring-2 focus:ring-purple-500/20 font-bold h-9 pr-8"
        >
          <option value="">All Categories</option>
          {Object.keys(CATEGORY_COLORS).map(c => <option key={c} value={c}>{c.charAt(0) + c.slice(1).toLowerCase()}</option>)}
        </select>

        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-305 focus:outline-none focus:ring-2 focus:ring-purple-500/20 font-bold h-9 pr-8"
        >
          <option value="">All Statuses</option>
          {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>

      {/* Table Section */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        {isLoading ? (
          <div className="flex items-center justify-center h-48 text-slate-400 text-xs">Loading lab inventory...</div>
        ) : paginatedItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-52 text-slate-450">
            <FlaskConical className="w-9 h-9 mb-2 opacity-30 shrink-0" />
            <p className="font-semibold text-slate-800 dark:text-slate-200 text-sm">No lab inventory items found</p>
            <p className="text-xs mt-0.5 text-slate-400">Add reagents and glassware to track usage logs.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-750 bg-slate-50/60 dark:bg-slate-850/60 text-slate-500 font-bold uppercase tracking-widest">
                  {['Item Name', 'Category', 'Current Stock', 'Min. Stock', 'UOM', 'Storage Storage', 'Expiry Date', 'Status', 'Lot #'].map(h => (
                    <th key={h} className="px-4 py-2.5 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {paginatedItems.map(item => {
                  const cfg = STATUS_CONFIG[item.computedStatus || item.status] || STATUS_CONFIG.SUFFICIENT;
                  const catColor = CATEGORY_COLORS[item.itemCategory] || '';
                  const isExpiring = item.expiryDate && new Date(item.expiryDate) <= new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
                  const rowBg = item.computedStatus === 'EXPIRED' ? 'bg-slate-100/30 dark:bg-slate-800/10' :
                                item.computedStatus === 'CRITICAL' ? 'bg-rose-500/5' :
                                item.computedStatus === 'LOW_STOCK' ? 'bg-amber-500/5' : '';

                  return (
                    <tr key={item.id} className={`hover:bg-slate-50/40 dark:hover:bg-slate-800/20 transition-colors border-b border-slate-100 dark:border-slate-800 last:border-none ${rowBg}`}>
                      <td className="px-4 py-2.5 font-bold text-slate-900 dark:text-white">
                        <span>{item.name}</span>
                        {isExpiring && item.computedStatus !== 'EXPIRED' && (
                          <span className="ml-2 px-1.5 py-0.2 bg-amber-500/15 text-amber-600 dark:text-amber-400 font-bold text-[9px] rounded-lg">Expiring Soon</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border ${catColor}`}>
                          {item.itemCategory}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <span className={`font-bold text-sm ${
                          Number(item.currentStock) <= 0 ? 'text-rose-600 dark:text-rose-455 font-black' :
                          Number(item.currentStock) <= Number(item.minimumStockLevel) ? 'text-amber-600 dark:text-amber-450 font-black' :
                          'text-slate-900 dark:text-white'
                        }`}>
                          {Number(item.currentStock).toFixed(2)}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-slate-650 dark:text-slate-300 whitespace-nowrap font-semibold">{Number(item.minimumStockLevel).toFixed(2)}</td>
                      <td className="px-4 py-2.5 text-slate-500 dark:text-slate-450 whitespace-nowrap font-medium">{item.uom}</td>
                      <td className="px-4 py-2.5 text-slate-500 dark:text-slate-450 whitespace-nowrap font-semibold">{item.storageCondition?.replace('_', ' ') || '—'}</td>
                      <td className={`px-4 py-2.5 whitespace-nowrap font-semibold ${isExpiring ? 'text-amber-605 dark:text-amber-450' : 'text-slate-500 dark:text-slate-450'}`}>
                        {item.expiryDate ? format(new Date(item.expiryDate), 'dd MMM yyyy') : '—'}
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[10px] font-bold border ${cfg.color}`}>
                          <cfg.icon className="w-3 h-3 shrink-0" />{cfg.label}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-slate-400 whitespace-nowrap font-mono">{item.batchLotNumber || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer info & Pagination Controls */}
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/20 dark:bg-slate-900/20 flex flex-col sm:flex-row justify-between items-center gap-3">
            <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium order-2 sm:order-1">
              Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, filtered.length)} of {filtered.length} inventory items
            </div>

            <div className="order-1 sm:order-2">
              <Pagination 
                currentPage={currentPage} 
                totalPages={totalPages} 
                onPageChange={setCurrentPage} 
              />
            </div>

            <div className="text-xs text-slate-400 font-medium order-3">
              Matched matches: {filtered.length} entries
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LabInventoryListPage;
