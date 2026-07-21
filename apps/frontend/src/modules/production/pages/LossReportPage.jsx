import React, { useState, useEffect } from 'react';
import { api } from '@/lib/axios';
import useAuthStore from '@/app/store/authStore';
import { FileText, RefreshCw, Search, Percent, Download, ChevronDown, Plus, TrendingDown, DollarSign, Pencil, Trash2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import { Pagination } from '@/components/ui/Pagination';

export default function LossReportPage() {
  const user = useAuthStore(s => s.user);
  const canEdit = ['MAIN_MASTER', 'PRODUCTION_STAFF'].includes(user?.role);

  const [losses, setLosses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showExportMenu, setShowExportMenu] = useState(false);
  const navigate = useNavigate();

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  const fetchLosses = async () => {
    setLoading(true);
    try {
      const res = await api.get('/production/loss');
      setLosses(res.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLosses();
  }, []);

  // Reset page to 1 when search term changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const filtered = losses.filter(item => {
    const term = searchTerm.toLowerCase();
    const referenceNo = (item.referenceNo || '').toLowerCase();
    const productName = (item.productName || '').toLowerCase();
    const responsiblePerson = (item.responsiblePerson || '').toLowerCase();
    return referenceNo.includes(term) || productName.includes(term) || responsiblePerson.includes(term);
  });

  // Calculate stats
  const totalValueLost = losses.reduce((sum, item) => sum + Number(item.totalLoss || 0), 0);
  const totalReportsCount = losses.length;
  const avgLossValue = totalReportsCount > 0 ? totalValueLost / totalReportsCount : 0;

  // Pagination calculations
  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginatedLosses = filtered.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  // CSV Export Logic
  const handleExportCSV = () => {
    if (filtered.length === 0) return;
    const headers = ['SN', 'Production', 'Product', 'Total Loss', 'Loss Product & Materials', 'Loss Percent', 'Date', 'Responsible'];
    const rows = filtered.map((item, idx) => [
      idx + 1,
      item.referenceNo,
      item.productName,
      `₹${Number(item.totalLoss || 0).toFixed(2)}`,
      item.summary,
      item.lossPercent,
      new Date(item.date).toLocaleDateString('en-GB'),
      item.responsiblePerson
    ]);

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(','), ...rows.map(e => e.map(val => `"${val}"`).join(','))].join('\n');
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `production_loss_report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setShowExportMenu(false);
  };

  // Delete Action Handler
  const handleDelete = async (id) => {
    const result = await Swal.fire({
      title: 'Are you sure?',
      text: 'This will delete the loss report and revert all production batch quantities!',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#e11d48',
      cancelButtonColor: '#475569',
      confirmButtonText: 'Yes, delete it!'
    });

    if (result.isConfirmed) {
      try {
        await api.delete(`/production/loss/${id}`);
        Swal.fire({
          title: 'Deleted!',
          text: 'The production loss report has been deleted successfully.',
          icon: 'success',
          timer: 1500,
          showConfirmButton: false
        });
        fetchLosses();
      } catch (error) {
        Swal.fire('Error', error.response?.data?.error || 'Failed to delete report', 'error');
      }
    }
  };

  return (
    <div className="w-full max-w-full px-4 sm:px-6 lg:px-8 py-5 space-y-4 mx-auto transition-all duration-300">
      {!canEdit && (
        <div className="flex items-center gap-3 p-4 bg-amber-50 dark:bg-amber-955/20 border border-amber-200 dark:border-amber-900/50 rounded-2xl text-amber-800 dark:text-amber-300 text-sm font-medium animate-in fade-in slide-in-from-top-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
          <span>You have <strong>Read-Only access</strong> to Production Loss Reports. Creating or modifying logs is restricted.</span>
        </div>
      )}
      {/* Header Panel */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-slate-205 dark:border-slate-800">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center">
            <Percent className="w-5.5 h-5.5 mr-2 text-indigo-650 shrink-0" />
            Production Loss Report
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
            Analyze production line raw material wastage and product spoilage.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto justify-end">
          {/* Record Spoilage & Loss Button */}
          {canEdit && (
            <Button 
              onClick={() => navigate('/production/loss')}
              className="rounded-xl bg-indigo-600 hover:bg-indigo-750 text-white font-bold flex items-center justify-center gap-1.5 shadow-xs text-xs h-9 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Record Loss
            </Button>
          )}

          {/* Refresh Button */}
          <Button variant="outline" size="sm" onClick={fetchLosses} disabled={loading} className="rounded-xl border-slate-205 dark:border-slate-800 h-9 text-xs font-bold">
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>

          {/* Export Dropdown */}
          <div className="relative">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setShowExportMenu(!showExportMenu)} 
              className="rounded-xl flex items-center justify-center gap-1 border-slate-205 dark:border-slate-800 bg-white dark:bg-slate-900 h-9 text-xs font-bold w-full"
            >
              <Download className="w-3.5 h-3.5 mr-1" />
              Export
              <ChevronDown className="w-3.5 h-3.5 opacity-60 ml-0.5" />
            </Button>
            {showExportMenu && (
              <div className="absolute right-0 mt-1.5 w-44 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-lg z-50 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150 text-xs">
                <button 
                  onClick={handleExportCSV}
                  className="w-full text-left px-4 py-2.5 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  Export as CSV (.csv)
                </button>
                <button 
                  onClick={() => { alert('Excel Export generation requested.'); setShowExportMenu(false); }}
                  className="w-full text-left px-4 py-2.5 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors border-t dark:border-slate-800"
                >
                  Export as Excel (.xlsx)
                </button>
              </div>
            )}
          </div>

          {/* Search Field */}
          <div className="relative w-full sm:w-60">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input 
              placeholder="Search by reference, product, name..." 
              className="pl-9 bg-white dark:bg-slate-950 rounded-xl border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white h-9 text-xs"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
        {/* Total Cost Value Lost */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-850 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Loss Value</span>
            <span className="text-xl font-black font-mono text-slate-900 dark:text-white block mt-0.5">
              ₹{totalValueLost.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div className="p-3 bg-rose-50 dark:bg-rose-955/20 text-rose-600 dark:text-rose-455 rounded-2xl shrink-0">
            <DollarSign className="w-5.5 h-5.5" />
          </div>
        </div>

        {/* Total Loss Reports Filed */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-850 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Reports Filed</span>
            <span className="text-xl font-black text-slate-900 dark:text-white block mt-0.5">
              {totalReportsCount}
            </span>
          </div>
          <div className="p-3 bg-amber-50 dark:bg-amber-955/20 text-amber-600 dark:text-amber-400 rounded-2xl shrink-0">
            <FileText className="w-5.5 h-5.5" />
          </div>
        </div>

        {/* Avg Loss per Batch */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-850 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Avg Loss Per Batch</span>
            <span className="text-xl font-black font-mono text-slate-900 dark:text-white block mt-0.5">
              ₹{avgLossValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div className="p-3 bg-indigo-50 dark:bg-indigo-955/20 text-indigo-600 dark:text-indigo-400 rounded-2xl shrink-0">
            <TrendingDown className="w-5.5 h-5.5" />
          </div>
        </div>
      </div>

      {/* Report Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden animate__animated animate__fadeIn">
        <div className="overflow-x-auto text-xs">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-450 font-bold border-b border-slate-100 dark:border-slate-800 uppercase tracking-widest">
              <tr>
                <th className="px-4 py-2.5 w-14 text-center">SN</th>
                <th className="px-4 py-2.5">Production</th>
                <th className="px-4 py-2.5">Product</th>
                <th className="px-4 py-2.5 text-right">Total Loss</th>
                <th className="px-4 py-2.5">Loss Product & Materials</th>
                <th className="px-4 py-2.5 text-center">Loss Percent</th>
                {canEdit && <th className="px-4 py-2.5 text-center w-28">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto text-indigo-500 mb-2" />
                    Loading loss reports...
                  </td>
                </tr>
              ) : paginatedLosses.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-slate-400">
                    No production loss records matching criteria.
                  </td>
                </tr>
              ) : (
                paginatedLosses.map((item, idx) => {
                  const calculatedIndex = (currentPage - 1) * ITEMS_PER_PAGE + idx + 1;
                  return (
                    <tr key={item.id} className="hover:bg-slate-50/40 dark:hover:bg-slate-800/20 transition-colors border-b border-slate-100 dark:border-slate-800 last:border-none">
                      <td className="px-4 py-2.5 text-center font-semibold text-slate-400">
                        {calculatedIndex}
                      </td>
                      <td className="px-4 py-2.5 font-mono font-bold text-slate-900 dark:text-white">
                        {item.referenceNo}
                      </td>
                      <td className="px-4 py-2.5 font-semibold text-indigo-650 dark:text-indigo-400">
                        {item.productName}
                      </td>
                      <td className="px-4 py-2.5 text-right font-black text-slate-905 dark:text-white font-mono">
                        ₹{item.totalLoss.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-2.5 text-slate-600 dark:text-slate-350 font-medium">
                        {item.summary}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <span className="px-2 py-0.5 text-[10px] font-bold rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-455 border border-rose-550/20">
                          {item.lossPercent}
                        </span>
                      </td>
                      {canEdit && (
                        <td className="px-4 py-2.5 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => navigate(`/production/loss?edit=${item.id}`)}
                              className="h-8 w-8 rounded-lg text-slate-400 hover:text-indigo-650 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20"
                              title="Edit Report"
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDelete(item.id)}
                              className="h-8 w-8 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50/50 dark:hover:bg-rose-950/20"
                              title="Delete Report"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
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
              Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, filtered.length)} of {filtered.length} reports
            </div>

            <div className="order-1 sm:order-2">
              <Pagination 
                currentPage={currentPage} 
                totalPages={totalPages} 
                onPageChange={setCurrentPage} 
              />
            </div>

            <div className="text-xs text-slate-400 font-medium order-3">
              Matched entries: {filtered.length} records
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
