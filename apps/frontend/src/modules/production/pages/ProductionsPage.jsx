import React, { useState, useEffect } from 'react';
import { api } from '@/lib/axios';
import { Factory, Search, RefreshCw, Plus, Calendar, AlertCircle, Play, CheckCircle, Pause, Trash2, Eye, ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useNavigate, useLocation } from 'react-router-dom';

export default function ProductionsPage() {
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const navigate = useNavigate();
  const location = useLocation();
  const fromNotifications = location.state?.from === '/notifications';

  const fetchBatches = async () => {
    setLoading(true);
    try {
      const params = {
        page,
        limit: 10,
        search: searchTerm,
        status: statusFilter
      };
      const res = await api.get('/production', { params });
      setBatches(res.data.batches || []);
      setTotalPages(res.data.pages || 1);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBatches();
  }, [page, statusFilter]);

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    fetchBatches();
  };

  const handleUpdateStatus = async (id, newStatus) => {
    try {
      await api.patch(`/production/${id}/status`, { status: newStatus });
      fetchBatches();
    } catch (e) {
      alert(e.response?.data?.error || 'Failed to update status');
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {fromNotifications && (
        <button 
          onClick={() => navigate('/notifications')} 
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-bold rounded-lg transition-colors w-fit"
        >
          <ChevronLeft className="w-3.5 h-3.5" /> Back to Notifications Center
        </button>
      )}
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center">
            <Factory className="w-6 h-6 mr-2 text-indigo-600" />
            Production Batches
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Monitor and manage active and planned manufacturing batches.
          </p>
        </div>
        
        <Button
          onClick={() => navigate('/production/add')}
          className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-4 py-2 rounded-xl flex items-center shadow-sm"
        >
          <Plus className="w-4 h-4 mr-1.5" />
          Add Production Batch
        </Button>
      </div>

      {/* Filters and Search */}
      <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm flex flex-col md:flex-row gap-4 justify-between items-center">
        <form onSubmit={handleSearch} className="flex items-center gap-2 w-full md:w-auto flex-1">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input 
              placeholder="Search by batch ref or product name..." 
              className="pl-9 bg-white dark:bg-slate-900 w-full"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Button type="submit" variant="outline">Search</Button>
        </form>

        <div className="flex items-center gap-3 w-full md:w-auto justify-end">
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All Statuses</option>
            <option value="Planned">Planned</option>
            <option value="In Progress">In Progress</option>
            <option value="Completed">Completed</option>
            <option value="On Hold">On Hold</option>
            <option value="Cancelled">Cancelled</option>
            <option value="qc_passed">QC Passed</option>
            <option value="qc_failed">QC Failed</option>
          </select>

          <Button
            variant="outline"
            size="sm"
            onClick={fetchBatches}
            className="flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Production Batches List */}
      <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 font-medium border-b border-slate-100 dark:border-slate-700">
              <tr>
                <th className="px-6 py-4">Batch Ref</th>
                <th className="px-6 py-4">Product Name</th>
                <th className="px-6 py-4 text-center">Type</th>
                <th className="px-6 py-4 text-right">Quantity</th>
                <th className="px-6 py-4 text-center">Start Date</th>
                <th className="px-6 py-4 text-center">Status</th>
                <th className="px-6 py-4 text-right">Batch Cost</th>
                <th className="px-6 py-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-slate-400">Loading production batches...</td>
                </tr>
              ) : batches.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-slate-400">No production batches found.</td>
                </tr>
              ) : (
                batches.map(batch => (
                  <tr key={batch.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-6 py-4 font-mono font-medium text-slate-900 dark:text-white">
                      {batch.referenceNo}
                    </td>
                    <td className="px-6 py-4 font-semibold text-slate-900 dark:text-white">
                      {batch.product?.name}
                    </td>
                    <td className="px-6 py-4 text-center text-slate-500">
                      {batch.productionType}
                    </td>
                    <td className="px-6 py-4 text-right font-bold text-slate-900 dark:text-white">
                      {batch.quantity} <span className="text-xs font-normal text-slate-400">{batch.product?.unit?.abbreviation}</span>
                    </td>
                    <td className="px-6 py-4 text-center text-slate-500">
                      {new Date(batch.startDate).toLocaleDateString('en-GB')}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${
                        batch.status === 'Planned'
                          ? 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400'
                          : batch.status === 'In Progress'
                          ? 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400'
                          : batch.status === 'Completed'
                          ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400'
                          : batch.status === 'qc_passed'
                          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400'
                          : batch.status === 'qc_failed'
                          ? 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400'
                          : 'bg-slate-50 text-slate-700 dark:bg-slate-500/10 dark:text-slate-400'
                      }`}>
                        {batch.status === 'qc_passed' ? 'Passed QC' : batch.status === 'qc_failed' ? 'Failed QC' : batch.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right font-semibold text-slate-900 dark:text-white">
                      ₹{Number(batch.totalCost).toLocaleString('en-IN')}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center space-x-2">
                        {batch.status === 'Planned' && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleUpdateStatus(batch.id, 'In Progress')}
                            className="text-emerald-600 hover:text-emerald-700"
                            title="Start Production"
                          >
                            <Play className="w-4 h-4" />
                          </Button>
                        )}
                        {batch.status === 'In Progress' && (
                          <>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleUpdateStatus(batch.id, 'Completed')}
                              className="text-indigo-600 hover:text-indigo-700"
                              title="Mark Completed"
                            >
                              <CheckCircle className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleUpdateStatus(batch.id, 'On Hold')}
                              className="text-amber-600 hover:text-amber-700"
                              title="Hold Production"
                            >
                              <Pause className="w-4 h-4" />
                            </Button>
                          </>
                        )}
                        {batch.status === 'On Hold' && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleUpdateStatus(batch.id, 'In Progress')}
                            className="text-emerald-600 hover:text-emerald-700"
                            title="Resume Production"
                          >
                            <Play className="w-4 h-4" />
                          </Button>
                        )}
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
