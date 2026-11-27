import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Swal from 'sweetalert2';
import { 
  Box, 
  Plus, 
  Search, 
  Edit, 
  Trash2, 
  Check, 
  X, 
  Layers, 
  Sparkles, 
  ShieldCheck, 
  AlertCircle, 
  RefreshCw, 
  CheckCircle2, 
  XCircle,
  Package,
  Wrench,
  Factory,
  ArrowUpDown,
  Sliders,
  ExternalLink
} from 'lucide-react';
import { api } from '@/lib/axios';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Pagination } from '@/components/ui/Pagination';
import SearchSelect from '@/components/ui/SearchSelect';

const MOULD_CATEGORIES = [
  '2000 Series',
  '3000 Series',
  '8000 Series',
  'Kulfi Series',
  'Bar Series',
  'Popsicle Series',
  'Cone Series',
  'Custom'
];

const SPEC_STATUS_OPTIONS = [
  { value: 'VERIFIED', label: '⭐ Verified Spec' },
  { value: 'PROVISIONAL', label: '⚡ Provisional' },
  { value: 'DRAFT', label: '📝 Draft' }
];

const MATERIAL_OPTIONS = [
  'SS 304 Food Grade',
  'SS 316 Pharmaceutical Grade',
  'Aluminium Alloy',
  'Silicone Food Grade',
  'Copper Coated Brass'
];

const ROLE_OPTIONS = [
  'Wooden Stick',
  'Wrapper',
  'Inner Foil',
  'Carton Box',
  'Insert Tag',
  'Packaging Material'
];

export default function MouldMasterListPage() {
  const queryClient = useQueryClient();

  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL'); // ALL, ACTIVE, INACTIVE
  const [specStatusFilter, setSpecStatusFilter] = useState('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingMould, setEditingMould] = useState(null);
  const [formData, setFormData] = useState({
    mouldCode: '',
    mouldName: '',
    mouldCategory: '2000 Series',
    modelNumber: '',
    capacityMl: 50,
    cavityCount: 42,
    dimensionText: '',
    material: 'SS 304 Food Grade',
    machineType: 'Brine Tank Line 1',
    supplierName: 'Satnam Group',
    specificationStatus: 'VERIFIED',
    status: 'ACTIVE',
    totalSetsInPlant: 10,
    notes: '',
    linkedRawMaterials: []
  });

  // Queries
  const { data: moulds = [], isLoading, refetch } = useQuery({
    queryKey: ['mould-masters', selectedCategory, statusFilter, specStatusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('all', '1');
      if (selectedCategory !== 'ALL') params.append('category', selectedCategory);
      if (statusFilter !== 'ALL') params.append('status', statusFilter);
      if (specStatusFilter !== 'ALL') params.append('specificationStatus', specStatusFilter);
      const res = await api.get(`/item-setup/mould-master?${params.toString()}`);
      return Array.isArray(res.data) ? res.data : [];
    }
  });

  // Raw Materials for linking dropdown
  const { data: rawMaterials = [] } = useQuery({
    queryKey: ['raw-materials-lookup'],
    queryFn: async () => {
      const res = await api.get('/item-setup/raw-material');
      return Array.isArray(res.data) ? res.data : (res.data?.data || []);
    }
  });

  // Filtered moulds
  const filteredMoulds = useMemo(() => {
    return moulds.filter(m => {
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const code = (m.mouldCode || '').toLowerCase();
        const name = (m.mouldName || '').toLowerCase();
        const model = (m.modelNumber || '').toLowerCase();
        const supplier = (m.supplierName || '').toLowerCase();
        const mat = (m.material || '').toLowerCase();
        if (!code.includes(q) && !name.includes(q) && !model.includes(q) && !supplier.includes(q) && !mat.includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [moulds, searchTerm]);

  // Pagination
  const totalPages = Math.ceil(filteredMoulds.length / itemsPerPage) || 1;
  const paginatedMoulds = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredMoulds.slice(start, start + itemsPerPage);
  }, [filteredMoulds, currentPage, itemsPerPage]);

  // Metrics
  const metrics = useMemo(() => {
    const total = moulds.length;
    const active = moulds.filter(m => m.status === 'ACTIVE').length;
    const verified = moulds.filter(m => m.specificationStatus === 'VERIFIED').length;
    const totalSets = moulds.reduce((acc, m) => acc + (Number(m.totalSetsInPlant) || 0), 0);
    return { total, active, verified, totalSets };
  }, [moulds]);

  // Open Create Modal
  const handleOpenCreateModal = async () => {
    try {
      const res = await api.get('/item-setup/mould-master/next-code');
      const nextCode = res.data?.nextCode || `MLD-0001`;
      setEditingMould(null);
      setFormData({
        mouldCode: nextCode,
        mouldName: '',
        mouldCategory: '2000 Series',
        modelNumber: '',
        capacityMl: 50,
        cavityCount: 42,
        dimensionText: '',
        material: 'SS 304 Food Grade',
        machineType: 'Brine Tank Line 1',
        supplierName: 'Satnam Group',
        specificationStatus: 'VERIFIED',
        status: 'ACTIVE',
        totalSetsInPlant: 10,
        notes: '',
        linkedRawMaterials: []
      });
      setModalOpen(true);
    } catch (err) {
      console.error('Failed to get next mould code:', err);
      setEditingMould(null);
      setFormData({
        mouldCode: '',
        mouldName: '',
        mouldCategory: '2000 Series',
        modelNumber: '',
        capacityMl: 50,
        cavityCount: 42,
        dimensionText: '',
        material: 'SS 304 Food Grade',
        machineType: 'Brine Tank Line 1',
        supplierName: 'Satnam Group',
        specificationStatus: 'VERIFIED',
        status: 'ACTIVE',
        totalSetsInPlant: 10,
        notes: '',
        linkedRawMaterials: []
      });
      setModalOpen(true);
    }
  };

  // Open Edit Modal
  const handleOpenEditModal = (mould) => {
    setEditingMould(mould);
    const parsedRms = Array.isArray(mould.linkedRawMaterials) 
      ? mould.linkedRawMaterials 
      : (typeof mould.linkedRawMaterials === 'string' ? JSON.parse(mould.linkedRawMaterials || '[]') : []);

    setFormData({
      mouldCode: mould.mouldCode || '',
      mouldName: mould.mouldName || '',
      mouldCategory: mould.mouldCategory || '2000 Series',
      modelNumber: mould.modelNumber || '',
      capacityMl: Number(mould.capacityMl || 50),
      cavityCount: Number(mould.cavityCount || 42),
      dimensionText: mould.dimensionText || '',
      material: mould.material || 'SS 304 Food Grade',
      machineType: mould.machineType || 'Brine Tank Line 1',
      supplierName: mould.supplierName || 'Satnam Group',
      specificationStatus: mould.specificationStatus || 'VERIFIED',
      status: mould.status || 'ACTIVE',
      totalSetsInPlant: Number(mould.totalSetsInPlant || 10),
      notes: mould.notes || '',
      linkedRawMaterials: parsedRms
    });
    setModalOpen(true);
  };

  // Toggle Status Mutation
  const toggleStatusMutation = useMutation({
    mutationFn: async ({ id, newStatus }) => {
      const res = await api.patch(`/item-setup/mould-master/${id}/status`, { status: newStatus });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['mould-masters']);
      Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'success',
        title: 'Mould status updated',
        showConfirmButton: false,
        timer: 1800
      });
    },
    onError: (err) => {
      Swal.fire('Error', err.response?.data?.message || 'Failed to update status', 'error');
    }
  });

  // Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const res = await api.delete(`/item-setup/mould-master/${id}`);
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries(['mould-masters']);
      Swal.fire('Deleted!', data.message || 'Mould successfully deleted.', 'success');
    },
    onError: (err) => {
      Swal.fire('Error', err.response?.data?.message || 'Failed to delete mould.', 'error');
    }
  });

  const handleDeleteMould = (mould) => {
    Swal.fire({
      title: 'Are you sure?',
      html: `Do you want to delete mould <strong>${mould.mouldCode}</strong> (${mould.mouldName})?<br/><span class="text-xs text-rose-500">If referenced in past batches, it will be deactivated instead.</span>`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#e11d48',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Yes, delete it!'
    }).then((result) => {
      if (result.isConfirmed) {
        deleteMutation.mutate(mould.id);
      }
    });
  };

  // Save Mould (Create / Update)
  const saveMutation = useMutation({
    mutationFn: async (payload) => {
      if (editingMould) {
        const res = await api.put(`/item-setup/mould-master/${editingMould.id}`, payload);
        return res.data;
      } else {
        const res = await api.post('/item-setup/mould-master', payload);
        return res.data;
      }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries(['mould-masters']);
      setModalOpen(false);
      Swal.fire({
        icon: 'success',
        title: editingMould ? 'Mould Updated!' : 'Mould Created!',
        text: `Mould ${data.mouldCode} successfully saved with linked raw materials.`,
        timer: 2000,
        showConfirmButton: false
      });
    },
    onError: (err) => {
      Swal.fire('Validation Error', err.response?.data?.message || 'Failed to save mould', 'error');
    }
  });

  const handleSave = (e) => {
    e.preventDefault();
    if (!formData.mouldCode.trim()) {
      return Swal.fire('Required', 'Please enter a valid Mould Code', 'warning');
    }
    if (!formData.mouldName.trim()) {
      return Swal.fire('Required', 'Please enter a valid Mould Name', 'warning');
    }
    if (Number(formData.capacityMl) <= 0) {
      return Swal.fire('Required', 'Cavity Capacity must be greater than 0 ml', 'warning');
    }
    if (Number(formData.cavityCount) <= 0) {
      return Swal.fire('Required', 'Cavities per Tray must be at least 1', 'warning');
    }

    saveMutation.mutate(formData);
  };

  // Linked RM Helper Methods
  const handleAddLinkedRm = () => {
    setFormData(prev => ({
      ...prev,
      linkedRawMaterials: [
        ...prev.linkedRawMaterials,
        {
          rawMaterialId: rawMaterials[0]?.id || '',
          code: rawMaterials[0]?.code || '',
          name: rawMaterials[0]?.name || '',
          role: 'Wooden Stick',
          qtyPerUnit: 1,
          uom: 'pcs'
        }
      ]
    }));
  };

  const handleUpdateLinkedRm = (index, field, value) => {
    setFormData(prev => {
      const copy = [...prev.linkedRawMaterials];
      const target = { ...copy[index] };
      if (field === 'rawMaterialId') {
        const selected = rawMaterials.find(rm => rm.id === value);
        target.rawMaterialId = value;
        target.code = selected?.code || '';
        target.name = selected?.name || '';
        target.uom = selected?.unitId || 'pcs';
      } else {
        target[field] = value;
      }
      copy[index] = target;
      return { ...prev, linkedRawMaterials: copy };
    });
  };

  const handleRemoveLinkedRm = (index) => {
    setFormData(prev => ({
      ...prev,
      linkedRawMaterials: prev.linkedRawMaterials.filter((_, i) => i !== index)
    }));
  };

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-7xl mx-auto font-['Plus_Jakarta_Sans',sans-serif]">
      {/* ── TOP HEADER ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shadow-xs">
            <Box className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                Ice Cream Mould Master
              </h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/80 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                Item Setup
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Configure precision mould trays, cavity capacities, factory machine lines, and linked packaging raw materials.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            className="h-9 px-3 rounded-xl text-xs font-bold border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            title="Refresh master data"
          >
            <RefreshCw className="w-3.5 h-3.5 mr-1 text-slate-500" />
            <span>Refresh</span>
          </Button>

          <Button
            size="sm"
            onClick={handleOpenCreateModal}
            className="h-9 px-4 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs hover:shadow-indigo-500/25 active:scale-95 transition-all cursor-pointer flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Add New Mould</span>
          </Button>
        </div>
      </div>

      {/* ── METRIC STATS CARDS ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-3xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
            <Box className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Total Moulds</span>
            <span className="text-lg font-black text-slate-900 dark:text-white font-mono">{metrics.total}</span>
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-3xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Active Status</span>
            <span className="text-lg font-black text-emerald-600 dark:text-emerald-400 font-mono">{metrics.active}</span>
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-3xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Verified Specs</span>
            <span className="text-lg font-black text-amber-600 dark:text-amber-400 font-mono">{metrics.verified}</span>
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-3xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Plant Tray Sets</span>
            <span className="text-lg font-black text-purple-600 dark:text-purple-400 font-mono">{metrics.totalSets}</span>
          </div>
        </div>
      </div>

      {/* ── FILTER & SEARCH TOOLBAR ── */}
      <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-3xs rounded-2xl overflow-hidden">
        <div className="p-3.5 border-b border-slate-100 dark:border-slate-800/80 flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search by mould code (MLD271126-0001, SG-2006), name, material, line..."
              className="pl-9 pr-8 h-9 text-xs rounded-xl bg-slate-50/70 dark:bg-slate-950 border-slate-200 dark:border-slate-800"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-full"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Status & Spec Filters */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="w-36">
              <SearchSelect
                size="sm"
                showSearch={false}
                value={specStatusFilter}
                onChange={(val) => {
                  setSpecStatusFilter(val || 'ALL');
                  setCurrentPage(1);
                }}
                options={[
                  { value: 'ALL', label: 'All Specs' },
                  ...SPEC_STATUS_OPTIONS
                ]}
                placeholder="All Specs"
              />
            </div>

            <div className="w-36">
              <SearchSelect
                size="sm"
                showSearch={false}
                value={statusFilter}
                onChange={(val) => {
                  setStatusFilter(val || 'ALL');
                  setCurrentPage(1);
                }}
                options={[
                  { value: 'ALL', label: 'All Statuses' },
                  { value: 'ACTIVE', label: 'Active Only' },
                  { value: 'INACTIVE', label: 'Inactive Only' }
                ]}
                placeholder="All Statuses"
              />
            </div>
          </div>
        </div>

        {/* Category Pills */}
        <div className="px-3.5 py-2 bg-slate-50/50 dark:bg-slate-950/30 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {['ALL', ...MOULD_CATEGORIES].map(cat => {
            const active = selectedCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => {
                  setSelectedCategory(cat);
                  setCurrentPage(1);
                }}
                className={`px-3 py-1 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                  active
                    ? 'bg-indigo-600 text-white shadow-2xs'
                    : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-indigo-300'
                }`}
              >
                {cat === 'ALL' ? 'All Categories' : cat}
              </button>
            );
          })}
        </div>
      </Card>

      {/* ── MOULDS TABLE LIST ── */}
      <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-3xs rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/50 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="py-2.5 px-3">Mould Code &amp; Name</th>
                <th className="py-2.5 px-3">Category &amp; Model</th>
                <th className="py-2.5 px-3 text-center">Cavity &amp; Nominal Set</th>
                <th className="py-2.5 px-3">Set &amp; Delivery Text</th>
                <th className="py-2.5 px-3">Linked Raw Materials</th>
                <th className="py-2.5 px-3 text-center">Status</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-500" />
                    <span>Loading mould masters...</span>
                  </td>
                </tr>
              ) : paginatedMoulds.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <AlertCircle className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                    <p className="font-bold text-slate-700 dark:text-slate-300">No Moulds Found</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Try resetting search filters or click "+ Add New Mould".</p>
                  </td>
                </tr>
              ) : (
                paginatedMoulds.map(m => {
                  const cap = Number(m.capacityMl || 0);
                  const cav = Number(m.cavityCount || 0);
                  const totalNominal = m.totalNominalCapacityMl ? Number(m.totalNominalCapacityMl) : (cap * cav);
                  const isActive = m.status === 'ACTIVE';
                  const rms = Array.isArray(m.linkedRawMaterials) 
                    ? m.linkedRawMaterials 
                    : (typeof m.linkedRawMaterials === 'string' ? JSON.parse(m.linkedRawMaterials || '[]') : []);

                  return (
                    <tr 
                      key={m.id}
                      className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      {/* Mould Code & Name */}
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200/80 dark:border-indigo-800 flex items-center justify-center font-bold text-[10px] shrink-0 font-mono">
                            🧊
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono font-black text-indigo-600 dark:text-indigo-400 tracking-tight text-xs">
                                {m.mouldCode}
                              </span>
                              {m.specificationStatus === 'VERIFIED' && (
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[8.5px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                                  ⭐ VERIFIED
                                </span>
                              )}
                            </div>
                            <span className="font-bold text-slate-900 dark:text-white block mt-0.5 text-xs">
                              {m.mouldName}
                            </span>
                            <span className="text-[10px] text-slate-400 block font-mono">
                              {m.material} • {m.machineType || 'Line 1'}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Category & Model */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded-md text-[10.5px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                          {m.mouldCategory}
                        </span>
                        {m.modelNumber && (
                          <span className="block text-[10px] font-mono text-slate-400 mt-1">
                            Model: {m.modelNumber}
                          </span>
                        )}
                      </td>

                      {/* Cavity & Nominal Set */}
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <div className="inline-block p-1.5 px-2 rounded-xl bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/40 text-center">
                          <span className="font-mono font-black text-xs text-indigo-700 dark:text-indigo-300 block">
                            {cap} ml × {cav} cavities
                          </span>
                          <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 font-bold block mt-0.5">
                            = {totalNominal.toLocaleString()} ml / tray
                          </span>
                        </div>
                      </td>

                      {/* Set & Delivery Text */}
                      <td className="py-3 px-3">
                        {m.dimensionText ? (
                          <span className="inline-block px-2 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 text-amber-900 dark:text-amber-200 font-mono text-[11px] font-bold">
                            {m.dimensionText}
                          </span>
                        ) : (
                          <span className="text-slate-400 font-mono text-[11px]">—</span>
                        )}
                        {m.supplierName && (
                          <span className="text-[10px] text-slate-400 block mt-0.5">
                            Supplier: {m.supplierName}
                          </span>
                        )}
                      </td>

                      {/* Linked Raw Materials */}
                      <td className="py-3 px-3">
                        {rms.length > 0 ? (
                          <div className="flex flex-col gap-1 max-w-[260px]">
                            {rms.map((rm, idx) => (
                              <div 
                                key={idx}
                                className="flex items-center justify-between gap-1.5 px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[10px]"
                              >
                                <span className="font-bold text-slate-700 dark:text-slate-300 truncate" title={rm.name}>
                                  {rm.role ? `[${rm.role}] ` : ''}{rm.name}
                                </span>
                                <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400 shrink-0">
                                  {rm.qtyPerUnit || 1} {rm.uom || 'pcs'}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-slate-400 text-[11px] italic">No linked materials</span>
                        )}
                      </td>

                      {/* Status Toggle */}
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => toggleStatusMutation.mutate({ id: m.id, newStatus: isActive ? 'INACTIVE' : 'ACTIVE' })}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10.5px] font-bold cursor-pointer transition-all active:scale-95 ${
                            isActive
                              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700'
                              : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 border border-slate-300 dark:border-slate-700'
                          }`}
                          title={`Click to mark ${isActive ? 'INACTIVE' : 'ACTIVE'}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                          <span>{m.status}</span>
                        </button>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenEditModal(m)}
                            className="h-7 w-7 p-0 rounded-lg text-slate-600 dark:text-slate-300 hover:text-indigo-600 hover:border-indigo-300 cursor-pointer"
                            title="Edit mould specifications and linked raw materials"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </Button>

                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeleteMould(m)}
                            className="h-7 w-7 p-0 rounded-lg text-rose-500 hover:text-rose-700 hover:border-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                            title="Delete mould"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
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

        {/* ── PAGINATION CONTROLS ── */}
        <div className="px-4 py-2 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row justify-between items-center gap-2 text-xs text-slate-500">
          <div>
            Showing <strong className="text-slate-800 dark:text-slate-200">{(currentPage - 1) * itemsPerPage + 1}</strong> to <strong className="text-slate-800 dark:text-slate-200">{Math.min(currentPage * itemsPerPage, filteredMoulds.length)}</strong> of <strong className="text-slate-800 dark:text-slate-200">{filteredMoulds.length}</strong> moulds
          </div>
          {totalPages > 1 && (
            <div className="scale-90 sm:scale-95">
              <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
            </div>
          )}
        </div>
      </Card>

      {/* ── CREATE / EDIT MODAL ── */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div 
            className="w-full max-w-3xl max-h-[92vh] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden"
            role="dialog"
            aria-modal="true"
          >
            {/* Modal Header */}
            <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/60 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
                  🧊
                </div>
                <div>
                  <h3 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white">
                    {editingMould ? `Edit Mould: ${editingMould.mouldCode}` : 'Create New Mould Specification'}
                  </h3>
                  <span className="text-[11px] text-slate-400 font-mono">
                    Running Code: {formData.mouldCode || 'Auto-generated'}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="w-8 h-8 rounded-lg border border-slate-200 dark:border-slate-800 flex items-center justify-center text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Mould Code */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Mould Code *
                  </label>
                  <Input
                    type="text"
                    value={formData.mouldCode}
                    onChange={(e) => setFormData(prev => ({ ...prev, mouldCode: e.target.value }))}
                    placeholder="e.g. MLD271126-0001 or SG-2006"
                    required
                    className="h-8.5 text-xs font-mono font-bold bg-white dark:bg-slate-950"
                  />
                </div>

                {/* Mould Name */}
                <div className="sm:col-span-2">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Mould Name / Title *
                  </label>
                  <Input
                    type="text"
                    value={formData.mouldName}
                    onChange={(e) => setFormData(prev => ({ ...prev, mouldName: e.target.value }))}
                    placeholder="e.g. Egypt Small (SG 2006)"
                    required
                    className="h-8.5 text-xs font-bold bg-white dark:bg-slate-950"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Category */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Category
                  </label>
                  <SearchSelect
                    size="sm"
                    value={formData.mouldCategory}
                    onChange={(val) => setFormData(prev => ({ ...prev, mouldCategory: val }))}
                    options={MOULD_CATEGORIES.map(cat => ({ value: cat, label: cat }))}
                    placeholder="Select Category"
                    searchPlaceholder="Search category..."
                  />
                </div>

                {/* Model Number */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Model Number
                  </label>
                  <Input
                    type="text"
                    value={formData.modelNumber}
                    onChange={(e) => setFormData(prev => ({ ...prev, modelNumber: e.target.value }))}
                    placeholder="e.g. SG-2006"
                    className="h-8 text-xs font-mono bg-white dark:bg-slate-950"
                  />
                </div>

                {/* Specification Status */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Specification Status
                  </label>
                  <SearchSelect
                    size="sm"
                    showSearch={false}
                    value={formData.specificationStatus}
                    onChange={(val) => setFormData(prev => ({ ...prev, specificationStatus: val }))}
                    options={SPEC_STATUS_OPTIONS}
                    placeholder="Select Spec Status"
                  />
                </div>
              </div>

              {/* Capacities & Calculations */}
              <div className="p-3.5 rounded-xl bg-indigo-50/40 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/50 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-indigo-950 dark:text-indigo-200 flex items-center gap-1.5 uppercase tracking-wider">
                    <Sliders className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Tray Cavity Capacity &amp; Set Math</span>
                  </h4>
                  <span className="font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400">
                    Nominal Tray Set: {(Number(formData.capacityMl || 0) * Number(formData.cavityCount || 0)).toLocaleString()} ml
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                      Cavity Capacity (ml) *
                    </label>
                    <Input
                      type="number"
                      step="0.5"
                      min="1"
                      value={formData.capacityMl}
                      onChange={(e) => setFormData(prev => ({ ...prev, capacityMl: parseFloat(e.target.value) || 0 }))}
                      required
                      className="h-8.5 text-xs font-mono font-bold bg-white dark:bg-slate-950 text-right"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                      Cavities per Tray *
                    </label>
                    <Input
                      type="number"
                      min="1"
                      value={formData.cavityCount}
                      onChange={(e) => setFormData(prev => ({ ...prev, cavityCount: parseInt(e.target.value, 10) || 1 }))}
                      required
                      className="h-8.5 text-xs font-mono font-bold bg-white dark:bg-slate-950 text-right"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                      Total Sets in Plant
                    </label>
                    <Input
                      type="number"
                      min="0"
                      value={formData.totalSetsInPlant}
                      onChange={(e) => setFormData(prev => ({ ...prev, totalSetsInPlant: parseInt(e.target.value, 10) || 0 }))}
                      className="h-8.5 text-xs font-mono font-bold bg-white dark:bg-slate-950 text-right"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Set &amp; Delivery Text (Optional Badge)
                  </label>
                  <Input
                    type="text"
                    value={formData.dimensionText}
                    onChange={(e) => setFormData(prev => ({ ...prev, dimensionText: e.target.value }))}
                    placeholder="e.g. 5N Mould / Delivery 210 NOS"
                    className="h-8.5 text-xs bg-white dark:bg-slate-950 font-mono"
                  />
                </div>
              </div>

              {/* Manufacturing & Hardware details */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Material
                  </label>
                  <SearchSelect
                    size="sm"
                    value={formData.material}
                    onChange={(val) => setFormData(prev => ({ ...prev, material: val }))}
                    options={MATERIAL_OPTIONS.map(mat => ({ value: mat, label: mat }))}
                    placeholder="Select Material"
                    searchPlaceholder="Search material..."
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Machine Line / Line Type
                  </label>
                  <Input
                    type="text"
                    value={formData.machineType}
                    onChange={(e) => setFormData(prev => ({ ...prev, machineType: e.target.value }))}
                    placeholder="e.g. SS 304 Brine Tank Line"
                    className="h-8.5 text-xs bg-white dark:bg-slate-950"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Supplier / Fabricator Name
                  </label>
                  <Input
                    type="text"
                    value={formData.supplierName}
                    onChange={(e) => setFormData(prev => ({ ...prev, supplierName: e.target.value }))}
                    placeholder="e.g. Satnam Group"
                    className="h-8.5 text-xs bg-white dark:bg-slate-950"
                  />
                </div>
              </div>

              {/* ── LINKED RAW MATERIALS BUILDER ── */}
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                      Linked Raw Materials (Wooden Sticks &amp; Wrappers)
                    </h4>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAddLinkedRm}
                    className="h-7 px-2.5 text-[10.5px] font-bold border-indigo-300 text-indigo-700 dark:border-indigo-800 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950 cursor-pointer"
                  >
                    <Plus className="w-3 h-3 mr-1" />
                    <span>Link Raw Material</span>
                  </Button>
                </div>

                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  When this mould is picked in Step 3 of Standard Production, these raw materials will automatically link and allocate from warehouse inventory.
                </p>

                {formData.linkedRawMaterials.length === 0 ? (
                  <div className="py-4 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-xl text-slate-400 text-xs">
                    No linked raw materials added yet. Click "+ Link Raw Material" to link a wooden stick or wrapper roll.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {formData.linkedRawMaterials.map((rm, idx) => (
                      <div 
                        key={idx}
                        className="grid grid-cols-1 sm:grid-cols-12 gap-2 p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 items-center text-xs"
                      >
                        {/* Select RM */}
                        <div className="sm:col-span-5">
                          <label className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">Raw Material</label>
                          <SearchSelect
                            size="sm"
                            value={rm.rawMaterialId}
                            onChange={(val) => handleUpdateLinkedRm(idx, 'rawMaterialId', val)}
                            options={rawMaterials.map(item => ({
                              value: item.id,
                              label: item.name,
                              code: item.code,
                              category: item.category?.name || 'Raw Material',
                              uom: item.unitId || 'pcs'
                            }))}
                            placeholder="Select Raw Material..."
                            searchPlaceholder="Search material by code, name or category..."
                          />
                        </div>

                        {/* Role */}
                        <div className="sm:col-span-3">
                          <label className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">Role / Purpose</label>
                          <SearchSelect
                            size="sm"
                            showSearch={false}
                            value={rm.role}
                            onChange={(val) => handleUpdateLinkedRm(idx, 'role', val)}
                            options={ROLE_OPTIONS.map(r => ({ value: r, label: r }))}
                            placeholder="Select Role"
                          />
                        </div>

                        {/* Quantity */}
                        <div className="sm:col-span-2">
                          <label className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">Qty / Output</label>
                          <Input
                            type="number"
                            step="0.01"
                            min="0.01"
                            value={rm.qtyPerUnit}
                            onChange={(e) => handleUpdateLinkedRm(idx, 'qtyPerUnit', parseFloat(e.target.value) || 1)}
                            className="h-7.5 text-xs font-mono font-bold text-right"
                          />
                        </div>

                        {/* UOM */}
                        <div className="sm:col-span-1">
                          <label className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">Unit</label>
                          <span className="font-mono font-bold text-indigo-600 block text-center pt-1 text-xs">
                            {rm.uom || 'pcs'}
                          </span>
                        </div>

                        {/* Remove Action */}
                        <div className="sm:col-span-1 text-right pt-2.5">
                          <button
                            type="button"
                            onClick={() => handleRemoveLinkedRm(idx)}
                            className="p-1 rounded text-rose-500 hover:text-rose-700 hover:bg-rose-50 transition-colors"
                            title="Remove linked material"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Status & Notes */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Status
                  </label>
                  <SearchSelect
                    size="sm"
                    showSearch={false}
                    value={formData.status}
                    onChange={(val) => setFormData(prev => ({ ...prev, status: val }))}
                    options={[
                      { value: 'ACTIVE', label: 'ACTIVE' },
                      { value: 'INACTIVE', label: 'INACTIVE' }
                    ]}
                    placeholder="Select Status"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Notes &amp; Internal Remarks
                  </label>
                  <Input
                    type="text"
                    value={formData.notes}
                    onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                    placeholder="e.g. Verified by Production QC Lead"
                    className="h-8.5 text-xs bg-white dark:bg-slate-950"
                  />
                </div>
              </div>

              {/* Modal Footer */}
              <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2 shrink-0">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setModalOpen(false)}
                  className="h-8.5 px-4 text-xs font-bold rounded-xl"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={saveMutation.isPending}
                  className="h-8.5 px-5 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs"
                >
                  {saveMutation.isPending ? 'Saving...' : (editingMould ? 'Update Mould' : 'Create Mould')}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
