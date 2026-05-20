import React, { useState, useEffect } from 'react';
import { Download, Plus, Trash2, RefreshCw, Search } from 'lucide-react';
import { api as axiosInstance } from '@/lib/axios';
import Swal from 'sweetalert2';
import { format } from 'date-fns';
import useAuthStore from '@/app/store/authStore';

const BackupListPage = () => {
  const user = useAuthStore((state) => state.user);
  const [backups, setBackups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [exporting, setExporting] = useState(false);

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

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-800 dark:text-white">Database Backups</h1>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Create Backup
        </button>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <div className="flex flex-col gap-4 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-slate-700">
          <button 
            onClick={handleExportBackups}
            disabled={exporting}
            className="flex items-center gap-2 rounded-lg bg-indigo-50 px-4 py-2 text-sm font-medium text-indigo-600 hover:bg-indigo-100 dark:bg-indigo-500/10 dark:text-indigo-400 disabled:opacity-50"
          >
            <Download className={`h-4 w-4 ${exporting ? 'animate-bounce' : ''}`} />
            {exporting ? 'Exporting...' : 'Export'}
          </button>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search Here"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full sm:w-64 rounded-lg border border-slate-300 pl-10 pr-4 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-800/50 dark:text-slate-400">
              <tr>
                <th className="px-6 py-4 font-medium">SN</th>
                <th className="px-6 py-4 font-medium">Filename</th>
                <th className="px-6 py-4 font-medium">File Size</th>
                <th className="px-6 py-4 font-medium">Date</th>
                <th className="px-6 py-4 font-medium">Time</th>
                <th className="px-6 py-4 font-medium">Created At</th>
                <th className="px-6 py-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {loading ? (
                <tr>
                  <td colSpan="7" className="px-6 py-8 text-center text-slate-500">Loading backups...</td>
                </tr>
              ) : filteredBackups.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-6 py-8 text-center text-slate-500">No backups found</td>
                </tr>
              ) : (
                filteredBackups.map((backup) => (
                  <tr key={backup.filename} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="px-6 py-4">{backup.sn}</td>
                    <td className="px-6 py-4">{backup.filename}</td>
                    <td className="px-6 py-4">{backup.size}</td>
                    <td className="px-6 py-4">{backup.date}</td>
                    <td className="px-6 py-4">{backup.time}</td>
                    <td className="px-6 py-4">
                      {format(new Date(backup.createdAt), 'yyyy-MM-dd HH:mm:ss')}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleRestoreBackup(backup.filename)}
                          className="rounded p-1.5 text-amber-600 hover:bg-amber-50 dark:text-amber-500 dark:hover:bg-amber-500/10"
                          title="Restore"
                        >
                          <RefreshCw className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteBackup(backup.filename)}
                          className="rounded p-1.5 text-red-600 hover:bg-red-50 dark:text-red-500 dark:hover:bg-red-500/10"
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
        
        {/* Pagination placeholder matching the design */}
        <div className="flex items-center justify-between border-t border-slate-200 p-4 dark:border-slate-700">
          <span className="text-sm text-slate-500">
            Showing 1 to {filteredBackups.length} of {backups.length} entries
          </span>
          <div className="flex items-center gap-1">
            <button className="px-3 py-1 text-sm font-medium text-slate-500 hover:bg-slate-100 rounded dark:hover:bg-slate-800" disabled>Previous</button>
            <button className="px-3 py-1 text-sm font-medium bg-indigo-600 text-white rounded">1</button>
            <button className="px-3 py-1 text-sm font-medium text-slate-500 hover:bg-slate-100 rounded dark:hover:bg-slate-800">Next</button>
          </div>
        </div>
      </div>

      {/* Create Backup Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-800 text-center">
            <h2 className="text-2xl font-semibold text-slate-800 dark:text-white mb-2">Create Backup</h2>
            <p className="text-slate-500 dark:text-slate-400 mb-8">Are you sure you want to create a database backup?</p>
            
            <div className="flex items-center justify-center gap-4">
              <button
                onClick={() => setShowCreateModal(false)}
                className="rounded-lg border border-red-200 bg-white px-6 py-2 font-medium text-red-500 hover:bg-red-50 dark:border-red-500/30 dark:bg-slate-800 dark:hover:bg-red-500/10"
                disabled={creating}
              >
                Cancel
              </button>
              <button
                onClick={handleCreateBackup}
                disabled={creating}
                className="rounded-lg bg-indigo-500 px-6 py-2 font-medium text-white hover:bg-indigo-600 disabled:opacity-50"
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
