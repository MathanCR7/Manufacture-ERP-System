import React, { useState, useEffect } from 'react';
import { Download, Plus, Trash2, RefreshCw, Search } from 'lucide-react';
import { api as axiosInstance } from '@/lib/axios';
import Swal from 'sweetalert2';
import { format } from 'date-fns';
import useAuthStore from '@/app/store/authStore';
import { Pagination } from '@/components/ui/Pagination';
import { Button } from '@/components/ui/button';

const BackupListPage = () => {
  const user = useAuthStore((state) => state.user);
  const [backups, setBackups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Pagination local state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const handleExportBackups = async () => {
    const isDark = document.documentElement.classList.contains('dark');
    try {
      setExporting(true);
      const response = await axiosInstance.get('/backups/export', {
        responseType: 'blob'
      });
      
      const contentDisposition = response.headers['content-disposition'];
      let filename = 'backups_export.zip';
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/);
        if (filenameMatch && filenameMatch[1]) {
          filename = filenameMatch[1];
        }
      }

      const blob = new Blob([response.data], { type: 'application/zip' });
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);

      Swal.fire({
        title: 'Export Success',
        text: 'All backup files have been exported and downloaded successfully.',
        icon: 'success',
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3000,
        background: isDark ? '#0f172a' : '#ffffff',
        color: isDark ? '#f8fafc' : '#0f172a',
      });
    } catch (error) {
      console.error('Export backups error:', error);
      Swal.fire({
        title: 'Export Failed',
        text: 'Failed to download backups export package.',
        icon: 'error',
        background: isDark ? '#0f172a' : '#ffffff',
        color: isDark ? '#f8fafc' : '#0f172a',
        customClass: {
          popup: 'rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xl'
        }
      });
    } finally {
      setExporting(false);
    }
  };

  const fetchBackups = async () => {
    try {
      setLoading(true);
      const res = await axiosInstance.get('/backups');
      if (res.data.success) {
        setBackups(res.data.data);
      }
    } catch (error) {
      const isDark = document.documentElement.classList.contains('dark');
      Swal.fire({
        title: 'Error',
        text: 'Failed to fetch backups',
        icon: 'error',
        background: isDark ? '#0f172a' : '#ffffff',
        color: isDark ? '#f8fafc' : '#0f172a',
        customClass: {
          popup: 'rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xl'
        }
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBackups();
  }, []);

  const handleCreateBackup = async () => {
    const isDark = document.documentElement.classList.contains('dark');
    try {
      setCreating(true);
      const res = await axiosInstance.post('/backups');
      if (res.data.success) {
        Swal.fire({ 
          title: 'Success', 
          text: res.data.message || 'Backup created successfully', 
          icon: 'success', 
          toast: true, 
          position: 'top-end', 
          showConfirmButton: false, 
          timer: 3000,
          background: isDark ? '#0f172a' : '#ffffff',
          color: isDark ? '#f8fafc' : '#0f172a',
        });
        setShowCreateModal(false);
        fetchBackups();
      }
    } catch (error) {
      Swal.fire({ 
        title: 'Error', 
        text: error.response?.data?.message || 'Failed to create backup', 
        icon: 'error', 
        toast: true, 
        position: 'top-end', 
        showConfirmButton: false, 
        timer: 3000,
        background: isDark ? '#0f172a' : '#ffffff',
        color: isDark ? '#f8fafc' : '#0f172a',
      });
      setShowCreateModal(false);
    } finally {
      setCreating(false);
    }
  };

  const handleRestoreBackup = async (filename) => {
    const isDark = document.documentElement.classList.contains('dark');
    Swal.fire({
      title: 'Restore Database?',
      text: `Are you sure you want to restore from ${filename}? Existing data will be updated.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, Restore',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#4f46e5', // indigo-600
      cancelButtonColor: '#64748b', // slate-500
      background: isDark ? '#0f172a' : '#ffffff',
      color: isDark ? '#f8fafc' : '#0f172a',
      customClass: {
        popup: 'rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xl'
      }
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          Swal.fire({ 
            title: 'Restoring Database...', 
            allowOutsideClick: false, 
            background: isDark ? '#0f172a' : '#ffffff',
            color: isDark ? '#f8fafc' : '#0f172a',
            didOpen: () => Swal.showLoading() 
          });
          const res = await axiosInstance.post(`/backups/${filename}/restore`);
          if (res.data.success) {
            Swal.fire({ 
              title: 'Restored!', 
              text: res.data.message || 'Database restored successfully', 
              icon: 'success', 
              toast: true, 
              position: 'top-end', 
              showConfirmButton: false, 
              timer: 3000,
              background: isDark ? '#0f172a' : '#ffffff',
              color: isDark ? '#f8fafc' : '#0f172a',
            });
          }
        } catch (error) {
          Swal.fire({ 
            title: 'Restore Failed', 
            text: error.response?.data?.message || 'Failed to restore database', 
            icon: 'error', 
            toast: true, 
            position: 'top-end', 
            showConfirmButton: false, 
            timer: 3000,
            background: isDark ? '#0f172a' : '#ffffff',
            color: isDark ? '#f8fafc' : '#0f172a',
          });
        }
      }
    });
  };

  const handleDeleteBackup = async (filename) => {
    const isDark = document.documentElement.classList.contains('dark');
    Swal.fire({
      title: 'Delete Backup?',
      text: 'Are you sure you want to delete this backup permanently?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, Delete',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#e11d48', // rose-600
      cancelButtonColor: '#64748b', // slate-500
      background: isDark ? '#0f172a' : '#ffffff',
      color: isDark ? '#f8fafc' : '#0f172a',
      customClass: {
        popup: 'rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xl'
      }
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          const res = await axiosInstance.delete(`/backups/${filename}`);
          if (res.data.success) {
            Swal.fire({ 
              title: 'Deleted!', 
              text: 'Backup deleted successfully', 
              icon: 'success', 
              toast: true, 
              position: 'top-end', 
              showConfirmButton: false, 
              timer: 3000,
              background: isDark ? '#0f172a' : '#ffffff',
              color: isDark ? '#f8fafc' : '#0f172a',
            });
            fetchBackups();
          }
        } catch (error) {
          Swal.fire({ 
            title: 'Error', 
            text: error.response?.data?.message || 'Failed to delete backup', 
            icon: 'error', 
            toast: true, 
            position: 'top-end', 
            showConfirmButton: false, 
            timer: 3000,
            background: isDark ? '#0f172a' : '#ffffff',
            color: isDark ? '#f8fafc' : '#0f172a',
          });
        }
      }
    });
  };

  const filteredBackups = backups.filter(b => 
    b.filename.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalPages = Math.ceil(filteredBackups.length / itemsPerPage);
  const paginated = filteredBackups.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div className="w-full max-w-full px-4 sm:px-6 lg:px-8 py-5 space-y-4 mx-auto transition-all duration-300 text-xs">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-slate-205 dark:border-slate-800">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Database Backups</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium font-sans">
            Manage system snapshots, generate automated restore points, and export raw database packages.
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md transition-colors h-9 cursor-pointer border-none"
        >
          <Plus className="h-4 w-4" />
          Create Backup
        </button>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-205 dark:border-slate-805 rounded-2xl shadow-xs overflow-hidden flex flex-col text-xs">
        <div className="flex flex-col gap-4 border-b border-slate-200 dark:border-slate-800 p-4 sm:flex-row sm:items-center sm:justify-between bg-slate-50/50 dark:bg-slate-900/20">
          <button 
            onClick={handleExportBackups}
            disabled={exporting}
            className="flex items-center gap-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/30 px-4 py-2 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 disabled:opacity-50 h-9 cursor-pointer border border-indigo-100/50 dark:border-indigo-900/30"
          >
            <Download className={`h-4 w-4 ${exporting ? 'animate-bounce' : ''}`} />
            {exporting ? 'Exporting...' : 'Export'}
          </button>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search backups..."
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              className="w-full sm:w-64 rounded-xl border border-slate-200 pl-10 pr-4 py-2 text-xs focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-800 dark:bg-slate-950 dark:text-white h-9 font-semibold"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600 dark:text-slate-300">
            <thead className="bg-slate-50 dark:bg-slate-950 text-slate-505 dark:text-slate-455 font-bold border-b border-slate-200 dark:border-slate-800 uppercase tracking-widest">
              <tr>
                <th className="px-6 py-3.5 font-bold">SN</th>
                <th className="px-6 py-3.5 font-bold">Filename</th>
                <th className="px-6 py-3.5 font-bold">File Size</th>
                <th className="px-6 py-3.5 font-bold">Date</th>
                <th className="px-6 py-3.5 font-bold">Time</th>
                <th className="px-6 py-3.5 font-bold">Created At</th>
                <th className="px-6 py-3.5 font-bold text-right w-24">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-850">
              {loading ? (
                <tr>
                  <td colSpan="7" className="px-6 py-12 text-center text-slate-400 bg-slate-50/10 font-semibold">Loading backups...</td>
                </tr>
              ) : paginated.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-6 py-12 text-center text-slate-400 bg-slate-50/10 font-semibold">No backups found</td>
                </tr>
              ) : (
                paginated.map((backup) => (
                  <tr key={backup.filename} className="hover:bg-slate-50/40 dark:hover:bg-slate-805/20 transition-colors border-b border-slate-105 dark:border-slate-800 last:border-none">
                    <td className="px-6 py-4 font-bold font-mono text-slate-500">{backup.sn}</td>
                    <td className="px-6 py-4 font-bold text-slate-850 dark:text-white font-mono text-3xs">{backup.filename}</td>
                    <td className="px-6 py-4 font-bold text-slate-700 dark:text-slate-350">{backup.size}</td>
                    <td className="px-6 py-4 font-semibold">{backup.date}</td>
                    <td className="px-6 py-4 font-mono font-semibold">{backup.time}</td>
                    <td className="px-6 py-4 font-mono text-3xs font-semibold text-slate-455">
                      {format(new Date(backup.createdAt), 'yyyy-MM-dd HH:mm:ss')}
                    </td>
                    <td className="px-6 py-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleRestoreBackup(backup.filename)}
                          className="rounded-lg p-1 text-amber-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors cursor-pointer"
                          title="Restore"
                        >
                          <RefreshCw className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteBackup(backup.filename)}
                          className="rounded-lg p-1 text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {/* Reusable Pagination footer */}
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/20 dark:bg-slate-900/20 flex flex-col sm:flex-row justify-between items-center gap-3">
            <div className="text-[11px] text-slate-555 dark:text-slate-400 font-medium order-2 sm:order-1">
              Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filteredBackups.length)} of {filteredBackups.length} entries
            </div>

            <div className="order-1 sm:order-2">
              <Pagination 
                currentPage={currentPage} 
                totalPages={totalPages} 
                onPageChange={setCurrentPage} 
              />
            </div>

            <div className="text-xs text-slate-404 font-medium order-3">
              Total entries: {filteredBackups.length} records
            </div>
          </div>
        )}
      </div>

      {/* Create Backup Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-900 text-center border border-slate-200 dark:border-slate-800 animate__animated animate__fadeInDown animate__faster select-none">
            <h2 className="text-lg font-bold text-slate-850 dark:text-white mb-2">Create Database Snapshot</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-6 font-medium">Are you sure you want to create a database backup right now?</p>
            
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => setShowCreateModal(false)}
                className="rounded-xl border border-slate-200 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-850 px-5 py-2 font-bold text-xs text-slate-600 dark:text-slate-400 cursor-pointer h-9"
                disabled={creating}
              >
                Cancel
              </button>
              <button
                onClick={handleCreateBackup}
                disabled={creating}
                className="rounded-xl bg-indigo-600 hover:bg-indigo-700 px-5 py-2 font-bold text-xs text-white disabled:opacity-50 cursor-pointer h-9"
              >
                {creating ? 'Creating...' : 'Yes, Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BackupListPage;
