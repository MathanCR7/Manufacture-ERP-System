import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/axios';
import { useNavigate } from 'react-router-dom';
import { FlaskConical, ArrowLeft, Plus, Loader2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const CATEGORIES = ['REAGENT', 'CHEMICAL', 'CONSUMABLE', 'EQUIPMENT', 'GLASSWARE', 'SAFETY'];
const STORAGE_CONDITIONS = [
  { value: 'ROOM_TEMP', label: 'Room Temperature' },
  { value: 'REFRIGERATED', label: 'Refrigerated (2–8°C)' },
  { value: 'FREEZER', label: 'Freezer (< -18°C)' },
  { value: 'FLAMMABLE', label: 'Flammable Cabinet' },
];
const UOMS = ['ml', 'L', 'g', 'kg', 'units', 'boxes', 'pcs', 'rolls'];

const LabInventoryAddPage = () => {
  const navigate = useNavigate();
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
      navigate('/lab-inventory/list');
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
        <button onClick={() => navigate('/lab-inventory/list')} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
          <ArrowLeft className="w-5 h-5 text-slate-500" />
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
              <Label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 block">Quantity Received *</Label>
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
              <Label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 block">Unit of Measure *</Label>
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
              <Label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 block">Minimum Stock Level</Label>
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
              <Label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 block">Storage Condition</Label>
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
            {field('purchaseDate', 'Purchase Date', 'date')}
            {field('expiryDate', 'Expiry Date', 'date')}
            {field('batchLotNumber', 'Batch/Lot Number', 'text', false, 'Lot# from supplier')}
          </div>
        </div>

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-lg px-4 py-3 text-sm flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" /> {error}
          </div>
        )}

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => navigate('/lab-inventory/list')}>Cancel</Button>
          <Button type="submit" disabled={mutation.isPending} className="bg-purple-600 hover:bg-purple-700 text-white">
            {mutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
            Add to Lab Inventory
          </Button>
        </div>
      </form>
    </div>
  );
};

export default LabInventoryAddPage;
