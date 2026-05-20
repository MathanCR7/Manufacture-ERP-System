import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/axios';
import { Link, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { Plus, Trash2, Edit, Search, FileDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import * as XLSX from 'xlsx';
import Swal from 'sweetalert2';

export default function RMWasteListPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');

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
    const isDark = document.documentElement.classList.contains('dark');
    Swal.fire({
      title: 'Are you sure?',
      text: "You won't be able to revert this! The raw material stock will be restored.",
      icon: 'warning',
      iconColor: '#f59e0b',
      showCancelButton: true,
      confirmButtonText: 'Yes, delete it!',
      cancelButtonText: 'No, cancel!',
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#64748b',
      background: isDark ? '#1e293b' : '#ffffff',
      color: isDark ? '#f8fafc' : '#0f172a',
      customClass: {
        popup: 'rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 select-none animate__animated animate__fadeInDown animate__faster',
        confirmButton: 'px-6 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-semibold transition-all mr-2',
        cancelButton: 'px-6 py-2.5 bg-slate-600 hover:bg-slate-700 text-white rounded-xl font-semibold transition-all'
      },
      buttonsStyling: false
    }).then((result) => {
      if (result.isConfirmed) {
        deleteMutation.mutate(id);
        
        Swal.fire({
          title: `<span class="font-extrabold text-sm text-slate-800 dark:text-slate-100">Deleted Successfully</span>`,
          html: `<p class="text-xs text-slate-500 dark:text-slate-400 mt-1">The raw material waste record has been deleted and stock updated.</p>`,
          icon: 'success',
          iconColor: '#10b981',
          toast: true,
          position: 'top-end',
          showConfirmButton: false,
          timer: 3500,
          timerProgressBar: true,
          background: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)',
          color: isDark ? '#f8fafc' : '#0f172a',
          showClass: { popup: 'animate__animated animate__slideInRight animate__faster' },
          hideClass: { popup: 'animate__animated animate__fadeOutRight animate__faster' },
          customClass: {
            popup: 'rounded-2xl border border-emerald-100 dark:border-emerald-950 shadow-xl backdrop-blur-md p-4',
            timerProgressBar: 'bg-emerald-500'
          }
        });
      }
    });
  };

  const filteredWastes = wastes.filter(waste => 
    waste.referenceNo?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    waste.note?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    waste.responsibleUser?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    waste.creatorUser?.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleExport = () => {
    if (filteredWastes.length === 0) {
      const isDark = document.documentElement.classList.contains('dark');
      Swal.fire({
        title: `<span class="font-extrabold text-sm text-slate-800 dark:text-slate-100">Export Empty</span>`,
        html: `<p class="text-xs text-slate-500 dark:text-slate-400 mt-1">No data available to export.</p>`,
        icon: 'warning',
        iconColor: '#f59e0b',
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3500,
        timerProgressBar: true,
        background: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)',
        color: isDark ? '#f8fafc' : '#0f172a',
        showClass: { popup: 'animate__animated animate__slideInRight animate__faster' },
        hideClass: { popup: 'animate__animated animate__fadeOutRight animate__faster' },
        customClass: {
          popup: 'rounded-2xl border border-amber-100 dark:border-amber-950 shadow-xl backdrop-blur-md p-4',
          timerProgressBar: 'bg-amber-500'
        }
      });
      return;
    }

    const exportData = filteredWastes.map((waste, index) => ({
      'SN': index + 1,
      'Reference No': waste.referenceNo,
      'Date': format(new Date(waste.date), 'yyyy-MM-dd'),
      'Total Loss (INR)': Number(waste.totalLoss || 0),
      'Raw Material Count': waste.items?.length || 0,
      'Quantity': waste.items?.map(item => `${item.quantity} ${item.uom?.abbreviation || ''}`).join(', ') || '-',
      'Note': waste.note || '-',
      'Responsible Person': waste.responsibleUser?.name || '-',
      'Added By': waste.creatorUser?.name || '-'
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "RM Waste");

    const fileName = `raw material waste ${format(new Date(), 'yyyy-MM-dd HH-mm-ss')}.xlsx`;
    XLSX.writeFile(workbook, fileName);
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
          <Button onClick={handleExport} variant="outline" className="text-indigo-600 border-indigo-200 hover:bg-indigo-50 dark:text-indigo-400 dark:border-indigo-800 dark:hover:bg-indigo-900/50">
            <FileDown className="w-4 h-4 mr-2" /> Export
          </Button>
          <div className="relative max-w-xs w-full">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
            <Input 
              placeholder="Search Here" 
              className="pl-9 bg-white dark:bg-slate-900" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
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
                <th className="px-4 py-3 whitespace-nowrap">Quantity</th>
                <th className="px-4 py-3 whitespace-nowrap">Note</th>
                <th className="px-4 py-3 whitespace-nowrap">Responsible Person</th>
                <th className="px-4 py-3 whitespace-nowrap">Added By</th>
                <th className="px-4 py-3 text-right whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {isLoading ? (
                <tr><td colSpan="10" className="px-4 py-8 text-center text-slate-500">Loading...</td></tr>
              ) : filteredWastes.length === 0 ? (
                <tr><td colSpan="10" className="px-4 py-8 text-center text-slate-500 bg-slate-50 dark:bg-slate-900/50 font-medium">No data available in table</td></tr>
              ) : (
                filteredWastes.map((waste, index) => (
                  <tr key={waste.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-4 py-3">{index + 1}</td>
                    <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">{waste.referenceNo}</td>
                    <td className="px-4 py-3">{format(new Date(waste.date), 'yyyy-MM-dd')}</td>
                    <td className="px-4 py-3">₹{Number(waste.totalLoss || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    <td className="px-4 py-3">{waste.items?.length || 0} items</td>
                    <td className="px-4 py-3">
                      {waste.items?.map((item, i) => (
                        <div key={i} className="whitespace-nowrap text-xs">
                          {item.quantity} {item.uom?.abbreviation || ''}
                        </div>
                      ))}
                    </td>
                    <td className="px-4 py-3 max-w-[200px] truncate">{waste.note || '-'}</td>
                    <td className="px-4 py-3">{waste.responsibleUser?.name || '-'}</td>
                    <td className="px-4 py-3">{waste.creatorUser?.name || '-'}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-indigo-600" onClick={() => navigate(`/waste/raw-material/edit/${waste.id}`)}>
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
          <div>Showing {filteredWastes.length > 0 ? 1 : 0} to {filteredWastes.length} of {filteredWastes.length} entries</div>
          <div className="flex space-x-1">
            <Button variant="outline" size="sm" disabled>Previous</Button>
            <Button variant="outline" size="sm" disabled>Next</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
