import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/axios';
import useAuthStore from '@/app/store/authStore';
import { useNavigate, useLocation } from 'react-router-dom';
import { format } from 'date-fns';
import { Download, Search, Edit, Trash2, ArrowLeft, Save, Loader2, AlertTriangle, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Pagination } from '@/components/ui/Pagination';

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

  const selectedRm = rawMaterials.find(rm => rm.id === form.rawMaterialId);

  const handleSubmit = (e) => {
    e.preventDefault();
    setError(null);
    if (!form.rawMaterialId) return setError('Please select a Raw Material');
    if (!form.type) return setError('Please select an Adjustment Type');
    if (!form.quantity || Number(form.quantity) <= 0) return setError('Please enter a valid quantity');

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
    <div className="w-full max-w-2xl px-4 sm:px-6 lg:px-8 py-5 space-y-4 mx-auto transition-all duration-300 text-xs">
      {/* Header */}
      <div className="flex items-center gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
        <button onClick={onBack} className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-all border border-slate-220 dark:border-slate-800 cursor-pointer">
          <ArrowLeft className="w-4 h-4 text-slate-500" />
        </button>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            {isEdit ? 'Edit Stock Adjustment' : 'Stock Adjustment'}
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5 font-medium">
            {isEdit ? 'Update stock adjustment details.' : 'Add or subtract stock directly from inventory.'}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-205 dark:border-slate-805 p-6 space-y-5 shadow-xs">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label className="text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Raw Material *</Label>
            <select
              value={form.rawMaterialId}
              onChange={e => setForm(p => ({ ...p, rawMaterialId: e.target.value }))}
              className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 h-10 font-semibold"
            >
              <option value="">Select a raw material...</option>
              {rawMaterials.map(rm => (
                <option key={rm.id} value={rm.id}>{rm.name} ({rm.code})</option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <Label className="text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Adjustment Type *</Label>
            <select
              value={form.type}
              onChange={e => setForm(p => ({ ...p, type: e.target.value }))}
              className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 h-10 font-semibold"
            >
              <option value="">Select type...</option>
              <option value="ADDITION">Addition (+)</option>
              <option value="SUBTRACTION">Subtraction (-)</option>
            </select>
          </div>
        </div>

        {/* Selected Item Stock Badge Info */}
        {selectedRm && (
          <div className="bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-xl p-3 flex justify-between items-center animate__animated animate__fadeIn">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Current Available Inventory:</span>
            <span className="text-xs font-black text-indigo-650 dark:text-indigo-400">
              {Number(selectedRm.availableQuantity).toFixed(2)} {selectedRm.unit}
            </span>
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label className="text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Adjustment Quantity *</Label>
            <div className="relative">
              <Input
                type="number"
                min="0.01"
                step="any"
                value={form.quantity}
                onChange={e => setForm(p => ({ ...p, quantity: e.target.value }))}
                placeholder="0.00"
                className="text-xs h-10 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:ring-1 focus:ring-indigo-500 pr-12 font-semibold"
              />
              {selectedRm && (
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-2xs font-extrabold text-slate-400 uppercase tracking-wider">
                  {selectedRm.unit}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-1">
          <Label className="text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Notes / Remarks</Label>
          <textarea
            value={form.notes}
            onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
            rows={2.5}
            placeholder="Describe why this adjustment is made (e.g. Audit, damage)..."
            className="w-full border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none font-semibold"
          />
        </div>

        {error && (
          <div className="bg-rose-50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50 rounded-xl px-4 py-3 text-xs flex items-center gap-2 font-semibold animate__animated animate__shakeX">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500" /> {error}
          </div>
        )}

        <div className="flex items-center gap-3 pt-4 border-t border-slate-100 dark:border-slate-800 justify-end">
          <Button 
            type="button" 
            onClick={onBack} 
            className="h-10 text-xs rounded-xl bg-rose-600 hover:bg-rose-700 dark:bg-rose-700 dark:hover:bg-rose-800 text-white font-bold w-36 shadow-md transition-all cursor-pointer border-none"
          >
            Cancel
          </Button>
          <Button 
            type="submit" 
            disabled={mutation.isPending} 
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-10 text-xs rounded-xl w-36 shadow-md transition-all cursor-pointer border-none"
          >
            {mutation.isPending ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin inline" /> : <Save className="w-3.5 h-3.5 mr-1.5 inline" />}
            Confirm Submit
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

  const user = useAuthStore(s => s.user);
  const canEdit = ['MAIN_MASTER', 'MATERIALS_RECEIVER'].includes(user?.role);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  const [view, setView] = useState(() => {
    return (canEdit && (location.pathname.endsWith('/add') || location.state?.editData)) ? 'add' : 'list';
  });
  const [editData, setEditData] = useState(() => {
    return (canEdit && location.state?.editData) || null;
  });

  useEffect(() => {
    const isAdd = canEdit && (location.pathname.endsWith('/add') || location.state?.editData);
    setView(isAdd ? 'add' : 'list');
    setEditData(canEdit ? (location.state?.editData || null) : null);
  }, [location.pathname, location.state, canEdit]);

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

  // Reset pagination when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const filteredAdjustments = adjustments.filter(adj => 
    adj.rawMaterialName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    adj.rawMaterialCode?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    adj.type?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Pagination calculations
  const totalPages = Math.ceil(filteredAdjustments.length / ITEMS_PER_PAGE);
  const paginatedAdjustments = filteredAdjustments.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
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
    <div className="w-full max-w-full px-4 sm:px-6 lg:px-8 py-5 space-y-4 mx-auto transition-all duration-300">
      {!canEdit && (
        <div className="flex items-center gap-3 p-4 bg-amber-50 dark:bg-amber-955/20 border border-amber-200 dark:border-amber-900/50 rounded-2xl text-amber-800 dark:text-amber-300 text-sm font-medium animate-in fade-in slide-in-from-top-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
          <span>You have <strong>Read-Only access</strong> to Stock Adjustments. Modifying raw material quantities is restricted.</span>
        </div>
      )}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Stock Adjustment</h1>
          <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5 font-medium">Directly adjust inventory stocks for raw materials</p>
        </div>
        {canEdit && (
          <Button 
            onClick={() => {
              setView('add');
              setEditData(null);
              navigate('/rm/stock-adjustment/add');
            }} 
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 py-2 rounded-xl flex items-center shadow-sm text-xs h-9 cursor-pointer border-none"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Add Stock Adjustment
          </Button>
        )}
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
        {/* Toolbar */}
        <div className="p-3.5 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row justify-between items-center gap-3 bg-slate-50/50 dark:bg-slate-900/50 text-xs">
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
            }} variant="outline" className="text-indigo-600 border-indigo-200 hover:bg-indigo-50 dark:border-indigo-800 dark:hover:bg-indigo-900/30 text-xs font-bold rounded-xl h-9">
              <Download className="w-3.5 h-3.5 mr-1.5" /> Export adjustments
            </Button>
          </div>
          
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by RM name, code, type..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-slate-200 dark:border-slate-800 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 h-9 font-semibold"
            />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto text-xs">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/65 border-b border-slate-200 dark:border-slate-800 text-slate-550 font-bold uppercase tracking-widest">
                <th className="py-2.5 px-4 w-16 text-center">SN</th>
                <th className="py-2.5 px-4">Raw Material (Code)</th>
                <th className="py-2.5 px-4">Type</th>
                <th className="py-2.5 px-4 text-right">Quantity</th>
                {canEdit && <th className="py-2.5 px-4 text-center w-28">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {isLoading ? (
                <tr>
                  <td colSpan="5" className="py-12 text-center text-slate-400">Loading adjustments...</td>
                </tr>
              ) : paginatedAdjustments.length === 0 ? (
                <tr>
                  <td colSpan="5" className="py-12 text-center text-slate-400">No stock adjustments found.</td>
                </tr>
              ) : (
                paginatedAdjustments.map((adj, index) => {
                  const calculatedIndex = (currentPage - 1) * ITEMS_PER_PAGE + index + 1;
                  return (
                    <tr key={adj.id} className="hover:bg-slate-50/40 dark:hover:bg-slate-800/20 transition-colors border-b border-slate-100 dark:border-slate-800 last:border-none">
                      <td className="py-2.5 px-4 text-slate-500 font-semibold text-center">
                        {calculatedIndex}
                      </td>
                      <td className="py-2.5 px-4">
                        <p className="font-bold text-slate-905 dark:text-white">
                          {adj.rawMaterialName} <span className="font-mono text-[10px] text-slate-400 font-semibold">({adj.rawMaterialCode})</span>
                        </p>
                      </td>
                      <td className="py-2.5 px-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-bold border ${
                          adj.type === 'ADDITION' 
                            ? 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20' 
                            : 'bg-rose-500/10 text-rose-600 dark:text-rose-450 border-rose-500/20'
                        }`}>
                          {adj.type === 'ADDITION' ? 'Addition' : 'Subtraction'}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-right font-black text-slate-900 dark:text-white">
                        {adj.quantity.toLocaleString()} <span className="text-[10px] font-normal text-slate-450 uppercase">{adj.unit}</span>
                      </td>
                      {canEdit && (
                        <td className="py-2.5 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button 
                              onClick={() => navigate('/rm/stock-adjustment/add', { state: { editData: {
                                id: adj.id,
                                rawMaterial: { id: adj.rawMaterialId, code: adj.rawMaterialCode, name: adj.rawMaterialName },
                                type: adj.type,
                                quantity: adj.quantity,
                                notes: adj.notes
                              }}})}
                              className="text-indigo-600 hover:text-indigo-750 transition-colors p-1.5 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20 rounded-lg" 
                              title="Edit"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => handleDelete(adj.id)}
                              className="text-rose-600 hover:text-rose-750 transition-colors p-1.5 hover:bg-rose-50/50 dark:hover:bg-rose-950/20 rounded-lg" 
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer info & Pagination Controls */}
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/20 dark:bg-slate-900/20 flex flex-col sm:flex-row justify-between items-center gap-3">
            <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium order-2 sm:order-1">
              Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, filteredAdjustments.length)} of {filteredAdjustments.length} adjustments
            </div>

            <div className="order-1 sm:order-2">
              <Pagination 
                currentPage={currentPage} 
                totalPages={totalPages} 
                onPageChange={setCurrentPage} 
              />
            </div>

            <div className="text-xs text-slate-400 font-medium order-3">
              Matched entries: {filteredAdjustments.length} entries
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default StockAdjustmentListPage;
