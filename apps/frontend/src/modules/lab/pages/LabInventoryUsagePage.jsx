import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/axios';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { FlaskConical, ArrowLeft, Loader2, AlertTriangle, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const LabInventoryUsagePage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [form, setForm] = useState({
    labTestId: '',
    labItemId: '',
    quantityUsed: '',
    dateUsed: format(new Date(), 'yyyy-MM-dd'),
  });

  // Fetch lab tests (approved GRNs with a lab test)
  const { data: labTests = [] } = useQuery({
    queryKey: ['grn-lab-tests'],
    queryFn: () => api.get('/grn/lab-results').then(r => r.data),
  });

  // Fetch lab inventory items
  const { data: labItems = [] } = useQuery({
    queryKey: ['lab-inventory'],
    queryFn: () => api.get('/lab-inventory').then(r => r.data),
  });

  const selectedItem = labItems.find(i => i.id === form.labItemId);

  const mutation = useMutation({
    mutationFn: (data) => api.post('/lab-inventory/use', data).then(r => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lab-inventory'] });
      setSuccess('Usage logged successfully! Stock has been deducted.');
      setForm(p => ({ ...p, labItemId: '', quantityUsed: '' }));
    },
    onError: (err) => setError(err?.response?.data?.error || 'Failed to log usage'),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (!form.labTestId) return setError('Select a lab test');
    if (!form.labItemId) return setError('Select a lab item');
    if (!form.quantityUsed || Number(form.quantityUsed) <= 0) return setError('Enter a valid quantity used');

    mutation.mutate({
      labTestId: form.labTestId,
      labItemId: form.labItemId,
      quantityUsed: Number(form.quantityUsed),
      dateUsed: form.dateUsed,
    });
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/lab-inventory/list')} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
          <ArrowLeft className="w-5 h-5 text-slate-500" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <FlaskConical className="w-6 h-6 text-teal-500" />
            Log Lab Inventory Usage
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Record chemical/reagent consumption during a lab test</p>
        </div>
      </div>

      {success && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-4 flex gap-3">
          <CheckCircle className="w-5 h-5 text-green-500 shrink-0" />
          <p className="text-green-700 dark:text-green-400">{success}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6 space-y-4">
          <h2 className="font-semibold text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-700 pb-3">Usage Details</h2>

          <div>
            <Label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 block">Lab Test *</Label>
            <select
              value={form.labTestId}
              onChange={e => setForm(p => ({ ...p, labTestId: e.target.value }))}
              className="w-full border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="">Select lab test...</option>
              {labTests.map(lt => (
                <option key={lt.id} value={lt.id}>
                  GRN: {lt.grn?.referenceNo || lt.grnId?.slice(-6)} — {lt.grn?.po?.name || 'Unknown'} — {lt.overallDecision}
                </option>
              ))}
            </select>
          </div>

          <div>
            <Label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 block">Lab Item Used *</Label>
            <select
              value={form.labItemId}
              onChange={e => setForm(p => ({ ...p, labItemId: e.target.value }))}
              className="w-full border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="">Select item...</option>
              {labItems.map(i => (
                <option key={i.id} value={i.id}>
                  {i.name} — Stock: {Number(i.currentStock).toFixed(2)} {i.uom}
                </option>
              ))}
            </select>
          </div>

          {selectedItem && (
            <div className="p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg flex gap-4 text-sm">
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">Current Stock</p>
                <p className={`font-semibold ${Number(selectedItem.currentStock) <= Number(selectedItem.minimumStockLevel) ? 'text-amber-600 dark:text-amber-400' : 'text-slate-900 dark:text-white'}`}>
                  {Number(selectedItem.currentStock).toFixed(2)} {selectedItem.uom}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">Min. Stock Level</p>
                <p className="text-slate-700 dark:text-slate-300">{Number(selectedItem.minimumStockLevel).toFixed(2)} {selectedItem.uom}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">Category</p>
                <p className="text-slate-700 dark:text-slate-300">{selectedItem.itemCategory}</p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 block">Quantity Used *</Label>
              <Input
                type="number"
                min="0.001"
                step="0.001"
                value={form.quantityUsed}
                onChange={e => setForm(p => ({ ...p, quantityUsed: e.target.value }))}
                placeholder="0.00"
                className="text-sm"
              />
              {selectedItem && form.quantityUsed && Number(form.quantityUsed) > Number(selectedItem.currentStock) && (
                <p className="text-xs text-red-600 dark:text-red-400 mt-1">Exceeds available stock!</p>
              )}
            </div>
            <div>
              <Label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 block">Date Used</Label>
              <Input
                type="date"
                value={form.dateUsed}
                onChange={e => setForm(p => ({ ...p, dateUsed: e.target.value }))}
                className="text-sm"
              />
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-lg px-4 py-3 text-sm flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" /> {error}
          </div>
        )}

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => navigate('/lab-inventory/list')}>Cancel</Button>
          <Button type="submit" disabled={mutation.isPending} className="bg-teal-600 hover:bg-teal-700 text-white">
            {mutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FlaskConical className="w-4 h-4 mr-2" />}
            Log Usage
          </Button>
        </div>
      </form>
    </div>
  );
};

export default LabInventoryUsagePage;
