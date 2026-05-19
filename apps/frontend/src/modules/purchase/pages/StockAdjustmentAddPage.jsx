import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/axios';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Save, Loader2, AlertTriangle, Plus, Minus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const StockAdjustmentAddPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();

  const editData = location.state?.editData;
  const isEdit = !!editData;

  const [form, setForm] = useState({
    rawMaterialId: editData?.rawMaterial?.id || '',
    type: editData?.type || '',
    quantity: editData?.quantity || '',
    notes: editData?.notes || ''
  });
  const [error, setError] = useState(null);

  const { data: rawMaterials = [], isLoading: rmLoading } = useQuery({
    queryKey: ['raw-materials-stock'],
    queryFn: () => api.get('/rm-stock').then(res => res.data)
  });

  const mutation = useMutation({
    mutationFn: (payload) => 
      isEdit 
        ? api.put(`/rm-stock-adjustment/${editData.id}`, payload).then(r => r.data)
        : api.post('/rm-stock-adjustment', payload).then(r => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rm-stock-adjustment'] });
      queryClient.invalidateQueries({ queryKey: ['rm-stock'] });
      navigate('/rm/stock-adjustment/list');
    },
    onError: (err) => setError(err?.response?.data?.error || 'Failed to submit adjustment')
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    setError(null);
    if (!form.rawMaterialId) return setError('Please select a Raw Material');
    if (!form.type) return setError('Please select an Adjustment Type');
    if (!form.quantity || Number(form.quantity) <= 0) return setError('Please enter a valid quantity');

    const selectedRm = rawMaterials.find(rm => rm.id === form.rawMaterialId);
    
    // Client-side validation: prevent subtracting more than current stock
    if (form.type === 'SUBTRACTION' && selectedRm) {
      let effectiveCurrentStock = Number(selectedRm.availableQuantity);
      
      // If editing and same RM and same type, add back previous quantity before checking
      if (isEdit && editData.rawMaterial.id === form.rawMaterialId) {
        if (editData.type === 'SUBTRACTION') {
           effectiveCurrentStock += Number(editData.quantity);
        } else {
           effectiveCurrentStock -= Number(editData.quantity);
        }
      }

      if (Number(form.quantity) > effectiveCurrentStock) {
        return setError(`Cannot subtract ${form.quantity}. Current stock is only ${effectiveCurrentStock}.`);
      }
    }

    mutation.mutate({
      rawMaterialId: form.rawMaterialId,
      type: form.type,
      quantity: Number(form.quantity),
      notes: form.notes
    });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/rm/stock-adjustment/list')} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
          <ArrowLeft className="w-5 h-5 text-slate-500" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            {isEdit ? 'Edit Stock Adjustment' : 'Stock Adjustment'}
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            {isEdit ? 'Update stock adjustment details.' : 'Add or subtract stock directly from inventory.'}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <Label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 block">Raw Material * (Only Stock available are listed)</Label>
            <select
              value={form.rawMaterialId}
              onChange={e => setForm(p => ({ ...p, rawMaterialId: e.target.value }))}
              className="w-full border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Select</option>
              {rawMaterials.map(rm => (
                <option key={rm.id} value={rm.id}>{rm.name} ({rm.code}) - {rm.availableQuantity} {rm.unit}</option>
              ))}
            </select>
          </div>

          <div>
            <Label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 block">Type *</Label>
            <select
              value={form.type}
              onChange={e => setForm(p => ({ ...p, type: e.target.value }))}
              className="w-full border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Select</option>
              <option value="ADDITION">Addition</option>
              <option value="SUBTRACTION">Subtraction</option>
            </select>
          </div>

          <div>
            <Label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 block">Quantity *</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={form.quantity}
              onChange={e => setForm(p => ({ ...p, quantity: e.target.value }))}
              placeholder="Quantity"
              className="text-sm"
            />
          </div>
        </div>

        <div>
          <Label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 block">Notes</Label>
          <textarea
            value={form.notes}
            onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
            rows={3}
            placeholder="Add notes for this stock adjustment (optional)"
            className="w-full border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
          />
        </div>

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-lg px-4 py-3 text-sm flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" /> {error}
          </div>
        )}

        <div className="flex items-center gap-3 pt-4 border-t border-slate-100 dark:border-slate-700">
          <Button type="submit" disabled={mutation.isPending} className="bg-indigo-600 hover:bg-indigo-700 text-white min-w-[120px]">
            {mutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Submit
          </Button>
          <Button type="button" variant="outline" onClick={() => navigate('/rm/stock-adjustment/list')}>
            Back
          </Button>
        </div>
      </form>
    </div>
  );
};

export default StockAdjustmentAddPage;
