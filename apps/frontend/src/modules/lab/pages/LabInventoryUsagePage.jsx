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
    <div className="w-full max-w-full px-4 sm:px-6 lg:px-8 py-5 space-y-4 mx-auto transition-all duration-300">
      {/* Header */}
      <div className="flex items-center gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
        <button onClick={() => navigate('/lab-inventory/list')} className="p-1.5 rounded-lg hover:bg-slate-105 dark:hover:bg-slate-800 transition-colors border border-slate-200 dark:border-slate-800">
          <ArrowLeft className="w-4 h-4 text-slate-500" />
        </button>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <FlaskConical className="w-5.5 h-5.5 text-teal-500 shrink-0" />
            Log Lab Usage
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Record chemical/reagent consumption during lab testing.</p>
        </div>
      </div>

      {success && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 flex gap-3 text-xs">
          <CheckCircle className="w-4.5 h-4.5 text-emerald-500 shrink-0" />
          <p className="text-emerald-700 dark:text-emerald-400 font-bold">{success}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4 max-w-3xl">
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4">
          <h2 className="text-xs font-bold text-slate-850 dark:text-slate-200 uppercase tracking-widest border-b border-slate-100 dark:border-slate-800 pb-2 flex items-center gap-1.5">📝 Log Usage</h2>

          <div>
            <Label className="text-[10px] uppercase font-bold text-slate-400 mb-1 block">Lab Test / Reference *</Label>
            <select
              value={form.labTestId}
              onChange={e => setForm(p => ({ ...p, labTestId: e.target.value }))}
              className="w-full border border-slate-205 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 h-9 font-semibold"
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
            <Label className="text-[10px] uppercase font-bold text-slate-400 mb-1 block">Lab Item Used *</Label>
            <select
              value={form.labItemId}
              onChange={e => setForm(p => ({ ...p, labItemId: e.target.value }))}
              className="w-full border border-slate-205 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 h-9 font-semibold"
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
            <div className="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-850 rounded-xl flex gap-4 text-xs font-semibold">
              <div>
                <p className="text-[9px] text-slate-400 uppercase">Current Stock</p>
                <p className={`font-bold mt-0.5 ${Number(selectedItem.currentStock) <= Number(selectedItem.minimumStockLevel) ? 'text-amber-600 dark:text-amber-400' : 'text-slate-900 dark:text-white'}`}>
                  {Number(selectedItem.currentStock).toFixed(2)} {selectedItem.uom}
                </p>
              </div>
              <div>
                <p className="text-[9px] text-slate-400 uppercase">Min. Alert Level</p>
                <p className="text-slate-700 dark:text-slate-350 mt-0.5">{Number(selectedItem.minimumStockLevel).toFixed(2)} {selectedItem.uom}</p>
              </div>
              <div>
                <p className="text-[9px] text-slate-400 uppercase">Category</p>
                <p className="text-slate-750 dark:text-slate-300 mt-0.5">{selectedItem.itemCategory}</p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-[10px] uppercase font-bold text-slate-400 mb-1 block">Quantity Consumed *</Label>
              <Input
                type="number"
                min="0.001"
                step="0.001"
                value={form.quantityUsed}
                onChange={e => setForm(p => ({ ...p, quantityUsed: e.target.value }))}
                placeholder="0.00"
                className="text-xs h-9 rounded-xl"
              />
              {selectedItem && form.quantityUsed && Number(form.quantityUsed) > Number(selectedItem.currentStock) && (
                <p className="text-[10px] text-rose-600 dark:text-rose-400 mt-1 font-bold">Exceeds available stock!</p>
              )}
            </div>
            <div>
              <Label className="text-[10px] uppercase font-bold text-slate-400 mb-1 block">Date Used</Label>
              <Input
                type="date"
                value={form.dateUsed}
                onChange={e => setForm(p => ({ ...p, dateUsed: e.target.value }))}
                className="text-xs h-9 rounded-xl"
              />
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-rose-500/10 border border-rose-500/20 text-rose-750 dark:text-rose-455 rounded-xl p-3 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={() => navigate('/lab-inventory/list')} className="rounded-xl h-9 text-xs px-4">Cancel</Button>
          <Button type="submit" disabled={mutation.isPending} className="bg-teal-600 hover:bg-teal-700 text-white rounded-xl h-9 text-xs px-4 active:scale-[0.98] transition-all font-semibold">
            {mutation.isPending ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <FlaskConical className="w-3.5 h-3.5 mr-1.5" />}
            Log Consumption
          </Button>
        </div>
      </form>
    </div>
  );
};

export default LabInventoryUsagePage;
