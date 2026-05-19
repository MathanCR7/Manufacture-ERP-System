import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/axios';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { Download, Search, Edit, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

const StockAdjustmentListPage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');

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

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Stock Adjustment</h1>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
        {/* Toolbar */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row justify-between items-center gap-4 bg-slate-50 dark:bg-slate-800/50">
          <div className="flex gap-2 w-full sm:w-auto">
            <Button variant="outline" className="text-indigo-600 border-indigo-200 hover:bg-indigo-50 dark:border-indigo-800 dark:hover:bg-indigo-900/30">
              <Download className="w-4 h-4 mr-2" /> Export
            </Button>
          </div>
          
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
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
                        className="text-emerald-500 hover:text-emerald-700 transition-colors p-1" 
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

        {/* Footer info (dummy pagination for UI match) */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row justify-between items-center gap-4 text-sm text-slate-500 dark:text-slate-400">
          <div>Showing 1 to {filteredAdjustments.length} of {filteredAdjustments.length} entries</div>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" disabled className="bg-slate-100 text-slate-400 border-none">Previous</Button>
            <Button variant="solid" size="sm" className="bg-indigo-500 hover:bg-indigo-600 text-white border-none">1</Button>
            <Button variant="outline" size="sm" disabled className="bg-slate-100 text-slate-400 border-none">Next</Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StockAdjustmentListPage;
