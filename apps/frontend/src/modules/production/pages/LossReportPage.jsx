import React, { useState, useEffect } from 'react';
import { api } from '@/lib/axios';
import { FileText, RefreshCw, Search, Percent, Download, ChevronDown, Plus, TrendingDown, DollarSign, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';

export default function LossReportPage() {
  const [losses, setLosses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showExportMenu, setShowExportMenu] = useState(false);
  const navigate = useNavigate();

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
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header Panel */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center">
            <Percent className="w-6 h-6 mr-2 text-indigo-600" />
            Production Loss Report
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Analyze production line raw material wastage and product spoilage.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-3 w-full sm:w-auto self-stretch sm:self-auto justify-end">
          {/* Record Spoilage & Loss Button */}
          <Button 
            onClick={() => navigate('/production/loss')}
            className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold flex items-center gap-1.5 shadow-md shadow-indigo-600/10"
          >
            <Plus className="w-4 h-4" />
            Record Loss
          </Button>

          {/* Refresh Button */}
          <Button variant="outline" size="sm" onClick={fetchLosses} disabled={loading} className="rounded-xl border-slate-200 dark:border-slate-700">
            <RefreshCw className={`w-4 h-4 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>

          {/* Export Dropdown */}
          <div className="relative">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setShowExportMenu(!showExportMenu)} 
              className="rounded-xl flex items-center gap-1 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
            >
              <Download className="w-4 h-4 mr-1" />
              Export
              <ChevronDown className="w-3.5 h-3.5 opacity-60 ml-0.5" />
            </Button>
            {showExportMenu && (
              <div className="absolute right-0 mt-1.5 w-44 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg z-50 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
                <button 
                  onClick={handleExportCSV}
                  className="w-full text-left px-4 py-2.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  Export as CSV (.csv)
                </button>
                <button 
                  onClick={() => { alert('Excel Export generation requested.'); setShowExportMenu(false); }}
                  className="w-full text-left px-4 py-2.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors border-t dark:border-slate-800"
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
              placeholder="Search Here..." 
              className="pl-9 bg-white dark:bg-slate-900 rounded-xl border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Total Cost Value Lost */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Total Loss Value</span>
            <span className="text-2xl font-bold font-mono text-slate-900 dark:text-white block">
              ₹{totalValueLost.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div className="p-3.5 bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 rounded-2xl">
            <DollarSign className="w-6 h-6" />
          </div>
        </div>

        {/* Total Loss Reports Filed */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Reports Filed</span>
            <span className="text-2xl font-bold text-slate-900 dark:text-white block">
              {totalReportsCount}
            </span>
          </div>
          <div className="p-3.5 bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400 rounded-2xl">
            <FileText className="w-6 h-6" />
          </div>
        </div>

        {/* Avg Loss per Batch */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Avg Loss Per Batch</span>
            <span className="text-2xl font-bold font-mono text-slate-900 dark:text-white block">
              ₹{avgLossValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div className="p-3.5 bg-indigo-50 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400 rounded-2xl">
            <TrendingDown className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Report Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 dark:bg-slate-900/60 text-slate-500 dark:text-slate-400 font-semibold border-b border-slate-100 dark:border-slate-800">
              <tr>
                <th className="px-6 py-4 w-16 text-center">SN</th>
                <th className="px-6 py-4">Production</th>
                <th className="px-6 py-4">Product</th>
                <th className="px-6 py-4 text-right">Total Loss</th>
                <th className="px-6 py-4">Loss Product & Materials</th>
                <th className="px-6 py-4 text-center">Loss Percent</th>
                <th className="px-6 py-4 text-center w-28">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto text-indigo-500 mb-2" />
                    Loading loss reports...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-500 dark:text-slate-400">
                    No production loss records matching criteria.
                  </td>
                </tr>
              ) : (
                filtered.map((item, idx) => (
                  <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="px-6 py-4 text-center font-semibold text-slate-400">
                      {idx + 1}
                    </td>
                    <td className="px-6 py-4 font-mono font-bold text-slate-900 dark:text-white">
                      {item.referenceNo}
                    </td>
                    <td className="px-6 py-4 font-semibold text-indigo-600 dark:text-indigo-400">
                      {item.productName}
                    </td>
                    <td className="px-6 py-4 text-right font-bold text-slate-900 dark:text-white font-mono">
                      ₹{item.totalLoss.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-6 py-4 text-slate-600 dark:text-slate-350">
                      {item.summary}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-rose-50 text-rose-600 dark:bg-rose-950/20 dark:text-rose-400">
                        {item.lossPercent}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => navigate(`/production/loss?edit=${item.id}`)}
                          className="h-8 w-8 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 dark:text-slate-400 dark:hover:text-indigo-400 dark:hover:bg-indigo-950/40"
                          title="Edit Report"
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(item.id)}
                          className="h-8 w-8 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:text-slate-400 dark:hover:text-rose-400 dark:hover:bg-rose-950/40"
                          title="Delete Report"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
