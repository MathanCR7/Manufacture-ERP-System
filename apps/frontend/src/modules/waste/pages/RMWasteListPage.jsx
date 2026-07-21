import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/axios';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { format } from 'date-fns';
import { Plus, Trash2, Edit, Search, FileDown, Trash } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import * as XLSX from 'xlsx';
import Swal from 'sweetalert2';
import CreateRMWastePage from './CreateRMWastePage';
import { Pagination } from '@/components/ui/Pagination';

export default function RMWasteListPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const [view, setView] = useState({ type: 'list', prefill: null });

  useEffect(() => {
    if (location.pathname === '/waste/raw-material/add' || location.pathname.startsWith('/waste/raw-material/edit/') || location.state) {
      setView({ type: 'create', prefill: location.state });
    } else {
      setView({ type: 'list', prefill: null });
    }
  }, [location]);

  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

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

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

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

  if (view.type === 'create') {
    return <CreateRMWastePage />;
  }

  // Pagination calculations
  const totalPages = Math.ceil(filteredWastes.length / ITEMS_PER_PAGE);
  const paginatedWastes = filteredWastes.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  return (
    <div className="w-full max-w-full px-4 sm:px-6 lg:px-8 py-5 space-y-4 mx-auto transition-all duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-slate-205 dark:border-slate-800">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center">
            <Trash className="w-5.5 h-5.5 mr-2 text-indigo-650 shrink-0" />
            Raw Material Waste
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium">Manage and track raw material wastage</p>
        </div>
        <div className="flex items-center space-x-2">
          <Button onClick={() => navigate('/waste/raw-material/add')} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs h-9 rounded-xl shadow-md cursor-pointer px-4">
            <Plus className="w-4 h-4 mr-1.5" /> Add RM Waste
          </Button>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-205 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden flex flex-col text-xs">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/20 gap-3">
          <Button onClick={handleExport} variant="outline" className="text-indigo-605 border-indigo-200 hover:bg-indigo-50 dark:text-indigo-400 dark:border-indigo-800 dark:hover:bg-indigo-900/50 text-xs font-bold rounded-xl h-9 cursor-pointer">
            <FileDown className="w-4 h-4 mr-1.5" /> Export
          </Button>
          <div className="relative max-w-xs w-full">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input 
              placeholder="Search Here" 
              className="pl-9 bg-white dark:bg-slate-950 border-slate-200 text-xs h-9" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 dark:bg-slate-950 text-slate-505 dark:text-slate-455 font-bold border-b border-slate-200 dark:border-slate-800 uppercase tracking-widest">
              <tr>
                <th className="px-4 py-3 whitespace-nowrap w-12">SN</th>
                <th className="px-4 py-3 whitespace-nowrap">Reference No</th>
                <th className="px-4 py-3 whitespace-nowrap">Date</th>
                <th className="px-4 py-3 whitespace-nowrap text-right">Total Loss</th>
                <th className="px-4 py-3 whitespace-nowrap">Raw Material Count</th>
                <th className="px-4 py-3 whitespace-nowrap">Quantity</th>
                <th className="px-4 py-3 whitespace-nowrap">Note</th>
                <th className="px-4 py-3 whitespace-nowrap">Responsible Person</th>
                <th className="px-4 py-3 whitespace-nowrap">Added By</th>
                <th className="px-4 py-3 text-right whitespace-nowrap w-24">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {isLoading ? (
                <tr><td colSpan="10" className="px-4 py-12 text-center text-slate-400">Loading wastes records...</td></tr>
              ) : paginatedWastes.length === 0 ? (
                <tr><td colSpan="10" className="px-4 py-12 text-center text-slate-400 bg-slate-50/10">No data available in table</td></tr>
              ) : (
                paginatedWastes.map((waste, index) => {
                  const computedIdx = (currentPage - 1) * ITEMS_PER_PAGE + index + 1;
                  return (
                    <tr key={waste.id} className="hover:bg-slate-50/40 dark:hover:bg-slate-805/20 transition-colors border-b border-slate-100 dark:border-slate-800 last:border-none">
                      <td className="px-4 py-3 font-semibold text-slate-400">{computedIdx}</td>
                      <td className="px-4 py-3 font-mono font-bold text-slate-900 dark:text-white">{waste.referenceNo}</td>
                      <td className="px-4 py-3 text-slate-500 font-semibold">{format(new Date(waste.date), 'yyyy-MM-dd')}</td>
                      <td className="px-4 py-3 text-right font-black text-rose-600 dark:text-rose-455 font-mono">₹{Number(waste.totalLoss || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                      <td className="px-4 py-3 text-slate-500 font-semibold">{waste.items?.length || 0} items</td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-350">
                        {waste.items?.map((item, i) => (
                          <div key={i} className="whitespace-nowrap text-[10px] font-bold">
                            {item.quantity} {item.uom?.abbreviation || ''}
                          </div>
                        ))}
                      </td>
                      <td className="px-4 py-3 max-w-[200px] truncate text-slate-500 font-medium">{waste.note || '-'}</td>
                      <td className="px-4 py-3 text-slate-500 font-bold">{waste.responsibleUser?.name || '-'}</td>
                      <td className="px-4 py-3 text-[10px] font-bold bg-slate-105 dark:bg-slate-800 text-slate-650 dark:text-slate-300 rounded px-2 py-0.5 w-fit">{waste.creatorUser?.name || '-'}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end space-x-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 rounded-lg" onClick={() => navigate(`/waste/raw-material/edit/${waste.id}`)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg" onClick={() => handleDelete(waste.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
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
            <div className="text-[11px] text-slate-555 dark:text-slate-400 font-medium order-2 sm:order-1">
              Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, filteredWastes.length)} of {filteredWastes.length} entries
            </div>

            <div className="order-1 sm:order-2">
              <Pagination 
                currentPage={currentPage} 
                totalPages={totalPages} 
                onPageChange={setCurrentPage} 
              />
            </div>

            <div className="text-xs text-slate-404 font-medium order-3">
              Total entries: {filteredWastes.length} records
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
