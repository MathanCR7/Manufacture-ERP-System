import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '@/lib/axios';
import { 
  FileText, Plus, Search, Filter, RefreshCw, Copy, Edit3, Trash2, 
  CheckCircle2, XCircle, ArrowRight, Layers, Sparkles, Database, ChevronRight 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import useAuthStore from '@/app/store/authStore';
import Swal from 'sweetalert2';

export default function ProductionTemplateListPage() {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState([]);
  const [bases, setBases] = useState([]);
  const [loading, setLoading] = useState(true);

  // Role visibility
  const currentUser = useAuthStore(s => s.user);
  const isProductionRole = useMemo(() => {
    if (!currentUser) return false;
    const role = (currentUser.role || '').toUpperCase();
    const email = (currentUser.email || '').toLowerCase();
    if (role === 'MAIN_MASTER' || role === 'ADMIN' || role === 'SUPERVISOR') return false;
    return role === 'PRODUCTION_STAFF' || role === 'OPERATOR' || role.includes('PRODUCTION') || email.includes('production');
  }, [currentUser]);
  const canViewCosting = !isProductionRole;
  
  // Filters
  const [search, setSearch] = useState('');
  const [selectedBaseId, setSelectedBaseId] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      const [tplRes, baseRes] = await Promise.all([
        api.get('/production/templates'),
        api.get('/production/bases')
      ]);
      setTemplates(tplRes.data || []);
      setBases(baseRes.data || []);
    } catch (err) {
      console.error('Failed to load production templates', err);
      Swal.fire({ title: 'Error', text: 'Failed to load templates.', icon: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  const filteredTemplates = useMemo(() => {
    return templates.filter(t => {
      const matchSearch = 
        t.name?.toLowerCase().includes(search.toLowerCase()) ||
        t.code?.toLowerCase().includes(search.toLowerCase()) ||
        t.baseName?.toLowerCase().includes(search.toLowerCase());
      const matchBase = selectedBaseId === 'ALL' || t.baseId === selectedBaseId;
      const matchStatus = statusFilter === 'ALL' || t.status === statusFilter;
      return matchSearch && matchBase && matchStatus;
    });
  }, [templates, search, selectedBaseId, statusFilter]);

  const handleDuplicate = async (template) => {
    try {
      const res = await api.post(`/production/templates/${template.id}/duplicate`);
      Swal.fire({
        title: 'Template Duplicated!',
        text: `Created cloned template: ${res.data.name} (${res.data.code})`,
        icon: 'success',
        timer: 2000
      });
      fetchTemplates();
    } catch (err) {
      Swal.fire({ title: 'Error', text: 'Failed to duplicate template.', icon: 'error' });
    }
  };

  const handleDelete = async (template) => {
    const confirm = await Swal.fire({
      title: 'Delete Template?',
      text: `Are you sure you want to delete "${template.name}" (${template.code})?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, Delete',
      confirmButtonColor: '#ef4444'
    });

    if (confirm.isConfirmed) {
      try {
        await api.delete(`/production/templates/${template.id}`);
        Swal.fire({ title: 'Deleted', text: 'Template removed.', icon: 'success', timer: 1500 });
        fetchTemplates();
      } catch (err) {
        Swal.fire({ title: 'Error', text: 'Failed to delete template.', icon: 'error' });
      }
    }
  };

  const formatCurrency = (val) => {
    return Number(val || 0).toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      
      {/* ── HEADER ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                Production Templates
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                Formula costing templates categorized by Base Name with auto-calculated wastage & overhead
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={fetchTemplates} 
            disabled={loading}
            className="rounded-xl border-slate-200 dark:border-slate-800 h-9"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>

          <Button 
            onClick={() => navigate('/production/templates/add')}
            className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-9 shadow-sm"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            + Add New Template
          </Button>
        </div>
      </div>

      {/* ── STATS SUMMARY ── */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Templates</p>
          <h3 className="text-2xl font-black text-slate-900 dark:text-white mt-1">{templates.length}</h3>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Ice Cream Base</p>
          <h3 className="text-2xl font-black text-indigo-600 dark:text-indigo-400 mt-1">
            {templates.filter(t => t.baseName?.toUpperCase().includes('ICE CREAM')).length}
          </h3>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Kulfi Base</p>
          <h3 className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">
            {templates.filter(t => t.baseName?.toUpperCase().includes('KULFI')).length}
          </h3>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Active Status</p>
          <h3 className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
            {templates.filter(t => t.status === 'ACTIVE').length}
          </h3>
        </div>
      </div>

      {/* ── FILTER CONTROLS ── */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input 
            placeholder="Search template name, code, base..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 rounded-xl border-slate-200 dark:border-slate-800"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
          <Filter className="w-4 h-4 text-slate-400 shrink-0" />
          
          {/* Base Dropdown */}
          <select
            value={selectedBaseId}
            onChange={(e) => setSelectedBaseId(e.target.value)}
            className="h-9 px-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="ALL">All Bases</option>
            {bases.map(b => (
              <option key={b.id} value={b.id}>{b.name} ({b.code})</option>
            ))}
          </select>

          {/* Status Dropdown */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-9 px-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="ALL">All Status</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </select>
        </div>
      </div>

      {/* ── TEMPLATES DATA TABLE ── */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs sm:text-sm">
            <thead>
              <tr className="bg-slate-50/75 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                <th className="py-3.5 px-4">Code</th>
                <th className="py-3.5 px-4">Template Name</th>
                <th className="py-3.5 px-4">Base Master</th>
                <th className="py-3.5 px-4 text-center">Output Target</th>
                <th className="py-3.5 px-4 text-center">Lines</th>
                {canViewCosting ? (
                  <>
                    <th className="py-3.5 px-4 text-right">Sub Total (₹)</th>
                    <th className="py-3.5 px-4 text-right">Grand Total (₹)</th>
                    <th className="py-3.5 px-4 text-right">Cost/Unit</th>
                  </>
                ) : null}
                <th className="py-3.5 px-4 text-center">Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={canViewCosting ? 10 : 7} className="py-12 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-500" />
                    Loading production templates...
                  </td>
                </tr>
              ) : filteredTemplates.length === 0 ? (
                <tr>
                  <td colSpan={canViewCosting ? 10 : 7} className="py-12 text-center text-slate-400">
                    No production templates found matching criteria.
                  </td>
                </tr>
              ) : (
                filteredTemplates.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-black text-indigo-600 dark:text-indigo-400">
                      {t.code}
                    </td>
                    <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white">
                      {t.name}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center gap-1 font-bold text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 dark:bg-indigo-950/70 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                        <Database className="w-2.5 h-2.5" />
                        {t.baseName}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center font-mono font-bold text-slate-700 dark:text-slate-300">
                      {t.outputQty} {t.outputUom}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                        {t.lineCount} Lines
                      </span>
                    </td>
                    {canViewCosting ? (
                      <>
                        <td className="py-3.5 px-4 text-right font-mono text-slate-700 dark:text-slate-300">
                          ₹{formatCurrency(t.subTotal)}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono font-bold text-indigo-700 dark:text-indigo-400">
                          ₹{formatCurrency(t.grandTotal)}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                          ₹{Number(t.costPerUnit).toFixed(2)}
                        </td>
                      </>
                    ) : null}
                    <td className="py-3.5 px-4 text-center">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        t.status === 'ACTIVE'
                          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                          : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                      }`}>
                        {t.status === 'ACTIVE' ? <CheckCircle2 className="w-3 h-3 text-emerald-500" /> : <XCircle className="w-3 h-3 text-slate-400" />}
                        {t.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigate(`/production/templates/${t.id}/edit`)}
                          className="h-8 w-8 p-0 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                          title="Edit Template"
                        >
                          <Edit3 className="w-3.5 h-3.5 text-slate-600 dark:text-slate-300" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDuplicate(t)}
                          className="h-8 w-8 p-0 rounded-lg hover:bg-indigo-50 text-indigo-600"
                          title="Duplicate Template"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(t)}
                          className="h-8 w-8 p-0 rounded-lg hover:bg-rose-50 text-rose-500 hover:text-rose-600"
                          title="Delete Template"
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

    </div>
  );
}
