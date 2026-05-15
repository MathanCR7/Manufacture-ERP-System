import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/axios';
import { Link, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { Plus, Trash2, Edit, Search, FileDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function RMWasteListPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: wastes = [], isLoading } = useQuery({
    queryKey: ['rm-wastes'],
    queryFn: async () => {
      const response = await api.get('/rm-waste');
      return response.data;
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      await api.delete(`/rm-waste/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rm-wastes'] });
    }
  });

  const handleDelete = (id) => {
    if (window.confirm('Are you sure you want to delete this waste record?')) {
      deleteMutation.mutate(id);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Raw Material Waste</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Manage and track raw material wastage</p>
        </div>
        <div className="flex items-center space-x-2">
          <Button onClick={() => navigate('/waste/raw-material/add')} className="bg-indigo-600 hover:bg-indigo-700 text-white">
            <Plus className="w-4 h-4 mr-2" /> Add RM Waste
          </Button>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden flex flex-col">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/20">
          <Button variant="outline" className="text-indigo-600 border-indigo-200 hover:bg-indigo-50 dark:text-indigo-400 dark:border-indigo-800 dark:hover:bg-indigo-900/50">
            <FileDown className="w-4 h-4 mr-2" /> Export
          </Button>
          <div className="relative max-w-xs w-full">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
            <Input placeholder="Search Here" className="pl-9 bg-white dark:bg-slate-900" />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-4 py-3 whitespace-nowrap">SN</th>
                <th className="px-4 py-3 whitespace-nowrap">Reference No</th>
                <th className="px-4 py-3 whitespace-nowrap">Date</th>
                <th className="px-4 py-3 whitespace-nowrap">Total Loss</th>
                <th className="px-4 py-3 whitespace-nowrap">Raw Material Count</th>
                <th className="px-4 py-3 whitespace-nowrap">Note</th>
                <th className="px-4 py-3 whitespace-nowrap">Responsible Person</th>
                <th className="px-4 py-3 whitespace-nowrap">Added By</th>
                <th className="px-4 py-3 text-right whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {isLoading ? (
                <tr><td colSpan="9" className="px-4 py-8 text-center text-slate-500">Loading...</td></tr>
              ) : wastes.length === 0 ? (
                <tr><td colSpan="9" className="px-4 py-8 text-center text-slate-500 bg-slate-50 dark:bg-slate-900/50 font-medium">No data available in table</td></tr>
              ) : (
                wastes.map((waste, index) => (
                  <tr key={waste.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-4 py-3">{index + 1}</td>
                    <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">{waste.referenceNo}</td>
                    <td className="px-4 py-3">{format(new Date(waste.date), 'yyyy-MM-dd')}</td>
                    <td className="px-4 py-3">₹{Number(waste.totalLoss || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    <td className="px-4 py-3">{waste.items?.length || 0} items</td>
                    <td className="px-4 py-3 max-w-[200px] truncate">{waste.note || '-'}</td>
                    <td className="px-4 py-3">{waste.responsibleUser?.name || '-'}</td>
                    <td className="px-4 py-3">{waste.creatorUser?.name || '-'}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        {/* Currently Edit is a placeholder */}
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-indigo-600">
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-600" onClick={() => handleDelete(waste.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-sm text-slate-500 dark:text-slate-400">
          <div>Showing {wastes.length > 0 ? 1 : 0} to {wastes.length} of {wastes.length} entries</div>
          <div className="flex space-x-1">
            <Button variant="outline" size="sm" disabled>Previous</Button>
            <Button variant="outline" size="sm" disabled>Next</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
