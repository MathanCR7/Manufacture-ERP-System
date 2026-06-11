import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/axios';
import { useNavigate, useLocation } from 'react-router-dom';
import { format } from 'date-fns';
import { Download, Search, Edit, Trash2, ArrowLeft, Save, Loader2, AlertTriangle, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

function StockAdjustmentForm({ editData, onBack }) {
  const isEdit = !!editData;
  const queryClient = useQueryClient();

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
      onBack();
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
        <button onClick={onBack} className="p-2 rounded-lg hover:bg-slate-105 dark:hover:bg-slate-800 transition-colors">
          <ArrowLeft className="w-5 h-5 text-slate-505" />
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

      <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-202 dark:border-slate-700 p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <Label className="text-sm font-medium text-slate-705 dark:text-slate-300 mb-1.5 block">Raw Material * (Only Stock available are listed)</Label>
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
            <Label className="text-sm font-medium text-slate-705 dark:text-slate-300 mb-1.5 block">Type *</Label>
            <select
              value={form.type}
              onChange={e => setForm(p => ({ ...p, type: e.target.value }))}
              className="w-full border border-slate-202 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Select</option>
              <option value="ADDITION">Addition</option>
              <option value="SUBTRACTION">Subtraction</option>
            </select>
          </div>

          <div>
            <Label className="text-sm font-medium text-slate-705 dark:text-slate-300 mb-1.5 block">Quantity *</Label>
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
          <Label className="text-sm font-medium text-slate-705 dark:text-slate-300 mb-1.5 block">Notes</Label>
          <textarea
            value={form.notes}
            onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
            rows={3}
            placeholder="Add notes for this stock adjustment (optional)"
            className="w-full border border-slate-202 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
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
          <Button type="button" variant="outline" onClick={onBack}>
            Back
          </Button>
        </div>
      </form>
    </div>
  );
}

const StockAdjustmentListPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');

  const [view, setView] = useState(() => {
    return (location.pathname.endsWith('/add') || location.state?.editData) ? 'add' : 'list';
  });
  const [editData, setEditData] = useState(() => {
    return location.state?.editData || null;
  });

  useEffect(() => {
    const isAdd = location.pathname.endsWith('/add') || location.state?.editData;
    setView(isAdd ? 'add' : 'list');
    setEditData(location.state?.editData || null);
  }, [location.pathname, location.state]);

  const { data: adjustments = [], isLoading } = useQuery({
    queryKey: ['rm-stock-adjustment'],
    queryFn: () => api.get('/rm-stock-adjustment').then(res => res.data)
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/rm-stock-adjustment/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rm-stock-adjustment'] });
      queryClient.invalidateQueries({ queryKey: ['rm-stock'] });
    }
  });

  const handleDelete = (id) => {
    if (window.confirm('Are you sure you want to delete this adjustment? It will revert the stock changes.')) {
      deleteMutation.mutate(id);
    }
  };

  const filteredAdjustments = adjustments.filter(adj => 
    adj.rawMaterialName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    adj.rawMaterialCode?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    adj.type?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (view !== 'list') {
    return (
      <StockAdjustmentForm 
        editData={editData} 
        onBack={() => {
          setView('list');
          setEditData(null);
          navigate('/rm/stock-adjustment/list');
        }} 
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Stock Adjustment</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Directly adjust inventory stocks for raw materials</p>
        </div>
        <Button 
          onClick={() => {
            setView('add');
            setEditData(null);
            navigate('/rm/stock-adjustment/add');
          }} 
          className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-4 py-2.5 rounded-xl flex items-center shadow-sm"
        >
          <Plus className="w-4 h-4 mr-1.5" />
          Add Stock Adjustment
        </Button>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
        {/* Toolbar */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row justify-between items-center gap-4 bg-slate-50 dark:bg-slate-800/50">
          <div className="flex gap-2 w-full sm:w-auto">
            <Button onClick={() => {
              if (filteredAdjustments.length === 0) return;
              const headers = ['SN', 'Raw Material', 'Type', 'Quantity', 'Unit', 'Notes', 'Date'];
              const rows = filteredAdjustments.map((a, i) => [
                i + 1,
                `${a.rawMaterialName}(${a.rawMaterialCode})`,
                a.type,
                a.quantity,
                a.unit,
                a.notes || '',
                format(new Date(a.createdAt), 'yyyy-MM-dd')
              ]);
              const csv = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
              const link = document.createElement('a');
              link.setAttribute('href', encodeURI(csv));
              link.setAttribute('download', `stock_adjustments_${new Date().toISOString().split('T')[0]}.csv`);
              document.body.appendChild(link); link.click(); document.body.removeChild(link);
            }} variant="outline" className="text-indigo-600 border-indigo-200 hover:bg-indigo-50 dark:border-indigo-800 dark:hover:bg-indigo-900/30">
              <Download className="w-4 h-4 mr-2" /> Export
            </Button>
          </div>
          
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-405" />
            <input
              type="text"
              placeholder="Search Here"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-slate-200 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
            />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 text-sm">
                <th className="py-3 px-6 font-semibold w-16 text-center">SN</th>
                <th className="py-3 px-6 font-semibold">Raw Material(Code)</th>
                <th className="py-3 px-6 font-semibold">Type</th>
                <th className="py-3 px-6 font-semibold">Quantity</th>
                <th className="py-3 px-6 font-semibold w-24 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {isLoading ? (
                <tr>
                  <td colSpan="5" className="py-8 text-center text-slate-500">Loading adjustments...</td>
                </tr>
              ) : filteredAdjustments.length === 0 ? (
                <tr>
                  <td colSpan="5" className="py-8 text-center text-slate-500">No stock adjustments found.</td>
                </tr>
              ) : (
                filteredAdjustments.map((adj, index) => (
                  <tr key={adj.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="py-3 px-6 text-sm text-slate-600 dark:text-slate-400 text-center">
                      {index + 1}
                    </td>
                    <td className="py-3 px-6">
                      <p className="text-sm font-medium text-slate-900 dark:text-white">
                        {adj.rawMaterialName}({adj.rawMaterialCode})
                      </p>
                    </td>
                    <td className="py-3 px-6">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        adj.type === 'ADDITION' 
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' 
                          : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                      }`}>
                        {adj.type === 'ADDITION' ? 'Addition' : 'Subtraction'}
                      </span>
                    </td>
                    <td className="py-3 px-6 text-sm text-slate-600 dark:text-slate-300">
                      {adj.quantity} {adj.unit}
                    </td>
                    <td className="py-3 px-6 text-center space-x-2">
                      <button 
                        onClick={() => navigate('/rm/stock-adjustment/add', { state: { editData: {
                          id: adj.id,
                          rawMaterial: { id: adj.rawMaterialId, code: adj.rawMaterialCode, name: adj.rawMaterialName },
                          type: adj.type,
                          quantity: adj.quantity,
                          notes: adj.notes
                        }}})}
                        className="text-emerald-555 hover:text-emerald-700 transition-colors p-1" 
                        title="Edit"
                      >
                        <Edit className="w-5 h-5" />
                      </button>
                      <button 
                        onClick={() => handleDelete(adj.id)}
                        className="text-red-500 hover:text-red-700 transition-colors p-1" 
                        title="Delete"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer info */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row justify-between items-center gap-4 text-sm text-slate-500 dark:text-slate-400">
          <div>Showing 1 to {filteredAdjustments.length} of {filteredAdjustments.length} entries</div>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" disabled className="bg-slate-100 text-slate-404 border-none">Previous</Button>
            <Button variant="solid" size="sm" className="bg-indigo-500 hover:bg-indigo-600 text-white border-none">1</Button>
            <Button variant="outline" size="sm" disabled className="bg-slate-100 text-slate-404 border-none">Next</Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StockAdjustmentListPage;
