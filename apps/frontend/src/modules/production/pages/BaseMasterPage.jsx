import React, { useState, useEffect, useMemo } from 'react';
import { api } from '@/lib/axios';
import { 
  Database, Plus, Search, Edit2, Trash2, CheckCircle2, XCircle, 
  RefreshCw, ShieldAlert, Layers, Sparkles, Filter, ChevronRight, X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Swal from 'sweetalert2';

export default function BaseMasterPage() {
  const [bases, setBases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  
  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingBase, setEditingBase] = useState(null);
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    description: '',
    status: 'ACTIVE'
  });
  const [saving, setSaving] = useState(false);

  const fetchBases = async () => {
    try {
      setLoading(true);
      const res = await api.get('/production/bases');
      setBases(res.data || []);
    } catch (err) {
      console.error('Failed to load base masters', err);
      Swal.fire({ title: 'Error', text: 'Failed to load base master records.', icon: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBases();
  }, []);

  const filteredBases = useMemo(() => {
    return bases.filter(b => {
      const matchSearch = 
        b.name?.toLowerCase().includes(search.toLowerCase()) ||
        b.code?.toLowerCase().includes(search.toLowerCase()) ||
        b.description?.toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === 'ALL' || b.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [bases, search, statusFilter]);

  const openCreateModal = () => {
    setEditingBase(null);
    setFormData({
      code: '',
      name: '',
      description: '',
      status: 'ACTIVE'
    });
    setModalOpen(true);
  };

  const openEditModal = (base) => {
    setEditingBase(base);
    setFormData({
      code: base.code,
      name: base.name,
      description: base.description || '',
      status: base.status
    });
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.code.trim() || !formData.name.trim()) {
      Swal.fire({ title: 'Validation', text: 'Base Code and Base Name are required.', icon: 'warning' });
      return;
    }

    try {
      setSaving(true);
      if (editingBase) {
        await api.put(`/production/bases/${editingBase.id}`, formData);
        Swal.fire({ title: 'Success', text: 'Base updated successfully.', icon: 'success', timer: 1500 });
      } else {
        await api.post('/production/bases', formData);
        Swal.fire({ title: 'Success', text: 'New Base created successfully.', icon: 'success', timer: 1500 });
      }
      setModalOpen(false);
      fetchBases();
    } catch (err) {
      console.error('Save base error:', err);
      const msg = err.response?.data?.error || 'Failed to save base master.';
      Swal.fire({ title: 'Error', text: msg, icon: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (base) => {
    const nextStatus = base.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      await api.put(`/production/bases/${base.id}`, { status: nextStatus });
      fetchBases();
    } catch (err) {
      Swal.fire({ title: 'Error', text: 'Failed to update status.', icon: 'error' });
    }
  };

  const handleDelete = async (base) => {
    if (base.templateCount > 0) {
      Swal.fire({
        title: 'Action Blocked',
        text: `Cannot delete "${base.name}" because it is currently linked to ${base.templateCount} production template(s). You can deactivate it instead.`,
        icon: 'warning'
      });
      return;
    }

    const confirm = await Swal.fire({
      title: 'Are you sure?',
      text: `Do you want to permanently delete Base "${base.name}" (${base.code})?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, Delete',
      confirmButtonColor: '#ef4444'
    });

    if (confirm.isConfirmed) {
      try {
        await api.delete(`/production/bases/${base.id}`);
        Swal.fire({ title: 'Deleted', text: 'Base removed.', icon: 'success', timer: 1500 });
        fetchBases();
      } catch (err) {
        const msg = err.response?.data?.error || 'Failed to delete base.';
        Swal.fire({ title: 'Error', text: msg, icon: 'error' });
      }
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      
      {/* ── HEADER ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400">
              <Database className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                Base Master
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                Manage foundational manufacturing bases (ICE CREAM BASE, KULFI BASE, FD BASE, and custom bases)
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={fetchBases} 
            disabled={loading}
            className="rounded-xl border-slate-200 dark:border-slate-800 h-9"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>

          <Button 
            onClick={openCreateModal}
            className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-9 shadow-sm"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            + Add New Base
          </Button>
        </div>
      </div>

      {/* ── METRIC CARDS ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Bases</p>
            <h3 className="text-2xl font-black text-slate-900 dark:text-white mt-1">{bases.length}</h3>
          </div>
          <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
            <Layers className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Active Bases</p>
            <h3 className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
              {bases.filter(b => b.status === 'ACTIVE').length}
            </h3>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Associated Templates</p>
            <h3 className="text-2xl font-black text-indigo-600 dark:text-indigo-400 mt-1">
              {bases.reduce((acc, b) => acc + (b.templateCount || 0), 0)}
            </h3>
          </div>
          <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/50 flex items-center justify-center text-purple-600 dark:text-purple-400">
            <Sparkles className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* ── FILTERS ── */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input 
            placeholder="Search base name, code..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 rounded-xl border-slate-200 dark:border-slate-800"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="w-4 h-4 text-slate-400 shrink-0" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-9 px-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500 w-full sm:w-auto"
          >
            <option value="ALL">All Status</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </select>
        </div>
      </div>

      {/* ── DATA TABLE ── */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs sm:text-sm">
            <thead>
              <tr className="bg-slate-50/75 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                <th className="py-3.5 px-4">Base Code</th>
                <th className="py-3.5 px-4">Base Name</th>
                <th className="py-3.5 px-4">Description</th>
                <th className="py-3.5 px-4 text-center">Linked Templates</th>
                <th className="py-3.5 px-4 text-center">Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-500" />
                    Loading base masters...
                  </td>
                </tr>
              ) : filteredBases.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    No bases found matching your criteria.
                  </td>
                </tr>
              ) : (
                filteredBases.map((base) => (
                  <tr key={base.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-black text-indigo-600 dark:text-indigo-400">
                      {base.code}
                    </td>
                    <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white">
                      {base.name}
                    </td>
                    <td className="py-3.5 px-4 text-slate-500 dark:text-slate-400 max-w-xs truncate">
                      {base.description || '—'}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className="font-mono font-bold px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                        {base.templateCount || 0}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <button
                        type="button"
                        onClick={() => toggleStatus(base)}
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold cursor-pointer transition-all ${
                          base.status === 'ACTIVE'
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                            : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                        }`}
                        title="Click to toggle status"
                      >
                        {base.status === 'ACTIVE' ? (
                          <>
                            <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                            Active
                          </>
                        ) : (
                          <>
                            <XCircle className="w-3 h-3 text-slate-400" />
                            Inactive
                          </>
                        )}
                      </button>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditModal(base)}
                          className="h-8 w-8 p-0 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                          title="Edit Base"
                        >
                          <Edit2 className="w-3.5 h-3.5 text-slate-600 dark:text-slate-300" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(base)}
                          className="h-8 w-8 p-0 rounded-lg hover:bg-rose-50 text-rose-500 hover:text-rose-600"
                          title="Delete Base"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
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

      {/* ── CREATE / EDIT MODAL ── */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h2 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <Database className="w-4 h-4 text-indigo-500" />
                {editingBase ? 'Edit Base Master' : 'Add New Base Master'}
              </h2>
              <button 
                onClick={() => setModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-600 dark:text-slate-300">
                  Base Code <span className="text-rose-500">*</span>
                </Label>
                <Input 
                  placeholder="e.g. ICB, KLB, FDB"
                  value={formData.code}
                  onChange={(e) => setFormData(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
                  className="rounded-xl font-mono uppercase font-bold"
                  maxLength={15}
                  required
                />
                <p className="text-[10px] text-slate-400">Short identifier code (e.g. ICB for ICE CREAM BASE)</p>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-600 dark:text-slate-300">
                  Base Name <span className="text-rose-500">*</span>
                </Label>
                <Input 
                  placeholder="e.g. ICE CREAM BASE, KULFI BASE"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="rounded-xl font-bold"
                  required
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-600 dark:text-slate-300">
                  Description
                </Label>
                <textarea 
                  rows={3}
                  placeholder="Brief description of the manufacturing category / base formulation..."
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full text-xs p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-600 dark:text-slate-300">Status</Label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value }))}
                  className="w-full h-9 px-3 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300"
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="INACTIVE">INACTIVE</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setModalOpen(false)}
                  className="rounded-xl"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={saving}
                  className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
                >
                  {saving ? 'Saving...' : editingBase ? 'Update Base' : 'Create Base'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
