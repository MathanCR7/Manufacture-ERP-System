import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Swal from 'sweetalert2';
import { 
  Cylinder, 
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
  Scale,
  Percent,
  TrendingDown
} from 'lucide-react';
import { api } from '@/lib/axios';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Pagination } from '@/components/ui/Pagination';
import SearchSelect from '@/components/ui/SearchSelect';

const UNIT_TYPES = [
  'Liter',
  'Gallon',
  'Tub',
  'Can',
  'Bucket',
  'Drum',
  'Tank',
  'Carton',
  'Other'
];

const PACKAGING_ROLE_OPTIONS = [
  'Container Body / Tub',
  'Gallon Box',
  'Can Body',
  'Lid / Cap',
  'Handle',
  'Safety Seal',
  'Outer Carton Box',
  'Packaging Material'
];

export default function BulkStorageUnitMasterListPage() {
  const queryClient = useQueryClient();

  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUnitType, setSelectedUnitType] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL'); // ALL, ACTIVE, INACTIVE
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState(null);
  const [formData, setFormData] = useState({
    unitCode: '',
    unitName: '',
    unitType: 'Gallon',
    capacityMl: 2000,
    nominalVolumeLtr: 2.0,
    tareWeightKg: 0.08,
    material: 'Food Grade Polypropylene',
    standardWastePercent: 0.5,
    description: '',
    status: 'ACTIVE',
    linkedRawMaterials: []
  });

  // Queries
  const { data: bulkUnits = [], isLoading, refetch } = useQuery({
    queryKey: ['bulk-storage-units', selectedUnitType, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('all', '1');
      if (selectedUnitType !== 'ALL') params.append('unitType', selectedUnitType);
      if (statusFilter !== 'ALL') params.append('status', statusFilter);
      const res = await api.get(`/item-setup/bulk-storage-unit?${params.toString()}`);
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

  // Filtered units
  const filteredUnits = useMemo(() => {
    return bulkUnits.filter(u => {
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const code = (u.unitCode || '').toLowerCase();
        const name = (u.unitName || '').toLowerCase();
        const type = (u.unitType || '').toLowerCase();
        const mat = (u.material || '').toLowerCase();
        const desc = (u.description || '').toLowerCase();
        if (!code.includes(q) && !name.includes(q) && !type.includes(q) && !mat.includes(q) && !desc.includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [bulkUnits, searchTerm]);

  // Pagination
  const totalPages = Math.ceil(filteredUnits.length / itemsPerPage) || 1;
  const paginatedUnits = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredUnits.slice(start, start + itemsPerPage);
  }, [filteredUnits, currentPage, itemsPerPage]);

  // Metrics
  const metrics = useMemo(() => {
    const total = bulkUnits.length;
    const active = bulkUnits.filter(u => u.status === 'ACTIVE').length;
    const avgWaste = total > 0 ? (bulkUnits.reduce((acc, u) => acc + (Number(u.standardWastePercent) || 0), 0) / total).toFixed(2) : '0.50';
    const totalCapL = bulkUnits.reduce((acc, u) => acc + (Number(u.nominalVolumeLtr) || (Number(u.capacityMl) / 1000) || 0), 0).toFixed(1);
    return { total, active, avgWaste, totalCapL };
  }, [bulkUnits]);

  // Open Create Modal
  const handleOpenCreateModal = async () => {
    try {
      const res = await api.get('/item-setup/bulk-storage-unit/next-code');
      const nextCode = res.data?.nextCode || `BLK-0001`;
      setEditingUnit(null);
      setFormData({
        unitCode: nextCode,
        unitName: '',
        unitType: 'Gallon',
        capacityMl: 2000,
        nominalVolumeLtr: 2.0,
        tareWeightKg: 0.08,
        material: 'Food Grade Polypropylene',
        standardWastePercent: 0.5,
        description: '',
        status: 'ACTIVE',
        linkedRawMaterials: []
      });
      setModalOpen(true);
    } catch (err) {
      console.error('Failed to get next bulk unit code:', err);
      setEditingUnit(null);
      setFormData({
        unitCode: '',
        unitName: '',
        unitType: 'Gallon',
        capacityMl: 2000,
        nominalVolumeLtr: 2.0,
        tareWeightKg: 0.08,
        material: 'Food Grade Polypropylene',
        standardWastePercent: 0.5,
        description: '',
        status: 'ACTIVE',
        linkedRawMaterials: []
      });
      setModalOpen(true);
    }
  };

  // Open Edit Modal
  const handleOpenEditModal = (unit) => {
    setEditingUnit(unit);
    const parsedRms = Array.isArray(unit.linkedRawMaterials) 
      ? unit.linkedRawMaterials 
      : (typeof unit.linkedRawMaterials === 'string' ? JSON.parse(unit.linkedRawMaterials || '[]') : []);

    const cap = Number(unit.capacityMl || 1000);
    const vol = unit.nominalVolumeLtr ? Number(unit.nominalVolumeLtr) : Number((cap / 1000).toFixed(3));

    setFormData({
      unitCode: unit.unitCode || '',
      unitName: unit.unitName || '',
      unitType: unit.unitType || 'Gallon',
      capacityMl: cap,
      nominalVolumeLtr: vol,
      tareWeightKg: Number(unit.tareWeightKg || 0.05),
      material: unit.material || 'Food Grade Polypropylene',
      standardWastePercent: Number(unit.standardWastePercent ?? 0.5),
      description: unit.description || '',
      status: unit.status || 'ACTIVE',
      linkedRawMaterials: parsedRms
    });
    setModalOpen(true);
  };

  // Toggle Status Mutation
  const toggleStatusMutation = useMutation({
    mutationFn: async ({ id, newStatus }) => {
      const res = await api.patch(`/item-setup/bulk-storage-unit/${id}/status`, { status: newStatus });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['bulk-storage-units']);
      Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'success',
        title: 'Bulk unit status updated',
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
      const res = await api.delete(`/item-setup/bulk-storage-unit/${id}`);
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries(['bulk-storage-units']);
      Swal.fire('Deleted!', data.message || 'Bulk storage unit successfully deleted.', 'success');
    },
    onError: (err) => {
      Swal.fire('Error', err.response?.data?.message || 'Failed to delete storage unit.', 'error');
    }
  });

  const handleDeleteUnit = (unit) => {
    Swal.fire({
      title: 'Are you sure?',
      html: `Do you want to delete bulk storage unit <strong>${unit.unitCode}</strong> (${unit.unitName})?<br/><span class="text-xs text-rose-500">If referenced in past batches, it will be deactivated instead.</span>`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#e11d48',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Yes, delete it!'
    }).then((result) => {
      if (result.isConfirmed) {
        deleteMutation.mutate(unit.id);
      }
    });
  };

  // Save Bulk Unit (Create / Update)
  const saveMutation = useMutation({
    mutationFn: async (payload) => {
      if (editingUnit) {
        const res = await api.put(`/item-setup/bulk-storage-unit/${editingUnit.id}`, payload);
        return res.data;
      } else {
        const res = await api.post('/item-setup/bulk-storage-unit', payload);
        return res.data;
      }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries(['bulk-storage-units']);
      setModalOpen(false);
      Swal.fire({
        icon: 'success',
        title: editingUnit ? 'Unit Updated!' : 'Unit Created!',
        text: `Bulk Storage Unit ${data.unitCode} successfully saved with linked packaging materials.`,
        timer: 2000,
        showConfirmButton: false
      });
    },
    onError: (err) => {
      Swal.fire('Validation Error', err.response?.data?.message || 'Failed to save storage unit', 'error');
    }
  });

  const handleSave = (e) => {
    e.preventDefault();
    if (!formData.unitCode.trim()) {
      return Swal.fire('Required', 'Please enter a valid Unit Code', 'warning');
    }
    if (!formData.unitName.trim()) {
      return Swal.fire('Required', 'Please enter a valid Unit Name', 'warning');
    }
    if (Number(formData.capacityMl) <= 0) {
      return Swal.fire('Required', 'Capacity must be greater than 0 ml', 'warning');
    }

    saveMutation.mutate(formData);
  };

  // Capacity change handler (auto updates nominal Ltr)
  const handleCapacityChange = (mlVal) => {
    const ml = parseFloat(mlVal) || 0;
    setFormData(prev => ({
      ...prev,
      capacityMl: ml,
      nominalVolumeLtr: ml > 0 ? Number((ml / 1000).toFixed(3)) : 0
    }));
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
          role: 'Container Body / Tub',
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
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shadow-xs">
            <span className="text-xl">🛢️</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                Bulk Storage Unit Master
              </h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                Item Setup
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Standardize bulk storage sizes, tub containers, cans, standard filling waste %, and linked packaging raw materials.
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
            className="h-9 px-4 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs hover:shadow-emerald-500/25 active:scale-95 transition-all cursor-pointer flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Add Storage Unit</span>
          </Button>
        </div>
      </div>

      {/* ── METRIC STATS CARDS ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-3xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <span className="text-base">🛢️</span>
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Total Units</span>
            <span className="text-lg font-black text-slate-900 dark:text-white font-mono">{metrics.total}</span>
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-3xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Active Status</span>
            <span className="text-lg font-black text-indigo-600 dark:text-indigo-400 font-mono">{metrics.active}</span>
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-3xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <Percent className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Avg Std Waste %</span>
            <span className="text-lg font-black text-amber-600 dark:text-amber-400 font-mono">{metrics.avgWaste}%</span>
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-3xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Total Volume</span>
            <span className="text-lg font-black text-purple-600 dark:text-purple-400 font-mono">{metrics.totalCapL} L</span>
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
              placeholder="Search by code (BLK-1000ML, BLK271126-0001), name, container type, material..."
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

          {/* Status Filter */}
          <div className="flex items-center gap-2 flex-wrap">
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

        {/* Unit Type Pills */}
        <div className="px-3.5 py-2 bg-slate-50/50 dark:bg-slate-950/30 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {['ALL', ...UNIT_TYPES].map(type => {
            const active = selectedUnitType === type;
            return (
              <button
                key={type}
                onClick={() => {
                  setSelectedUnitType(type);
                  setCurrentPage(1);
                }}
                className={`px-3 py-1 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                  active
                    ? 'bg-emerald-600 text-white shadow-2xs'
                    : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-emerald-300'
                }`}
              >
                {type === 'ALL' ? 'All Unit Types' : type}
              </button>
            );
          })}
        </div>
      </Card>

      {/* ── UNITS TABLE LIST ── */}
      <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-3xs rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/50 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="py-2.5 px-3">Unit Code &amp; Title</th>
                <th className="py-2.5 px-3">Unit Type</th>
                <th className="py-2.5 px-3 text-center">Nominal Capacity</th>
                <th className="py-2.5 px-3 text-center">Tare Wt &amp; Std Waste %</th>
                <th className="py-2.5 px-3">Linked Packaging Materials</th>
                <th className="py-2.5 px-3 text-center">Status</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-500" />
                    <span>Loading bulk storage units...</span>
                  </td>
                </tr>
              ) : paginatedUnits.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <AlertCircle className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                    <p className="font-bold text-slate-700 dark:text-slate-300">No Bulk Storage Units Found</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Try resetting search filters or click "+ Add Storage Unit".</p>
                  </td>
                </tr>
              ) : (
                paginatedUnits.map(u => {
                  const cap = Number(u.capacityMl || 0);
                  const vol = u.nominalVolumeLtr ? Number(u.nominalVolumeLtr) : Number((cap / 1000).toFixed(2));
                  const tare = Number(u.tareWeightKg || 0);
                  const wastePct = Number(u.standardWastePercent ?? 0.5);
                  const isActive = u.status === 'ACTIVE';
                  const rms = Array.isArray(u.linkedRawMaterials) 
                    ? u.linkedRawMaterials 
                    : (typeof u.linkedRawMaterials === 'string' ? JSON.parse(u.linkedRawMaterials || '[]') : []);

                  return (
                    <tr 
                      key={u.id}
                      className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      {/* Unit Code & Name */}
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200/80 dark:border-emerald-800 flex items-center justify-center font-bold text-[10px] shrink-0 font-mono">
                            🛢️
                          </div>
                          <div>
                            <span className="font-mono font-black text-emerald-600 dark:text-emerald-400 tracking-tight text-xs block">
                              {u.unitCode}
                            </span>
                            <span className="font-bold text-slate-900 dark:text-white block mt-0.5 text-xs">
                              {u.unitName}
                            </span>
                            <span className="text-[10px] text-slate-400 block font-mono">
                              {u.material || 'Food Grade PP'}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Unit Type */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded-md text-[10.5px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                          {u.unitType}
                        </span>
                        {u.description && (
                          <span className="block text-[10px] text-slate-400 mt-1 truncate max-w-[180px]" title={u.description}>
                            {u.description}
                          </span>
                        )}
                      </td>

                      {/* Nominal Capacity */}
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <div className="inline-block p-1.5 px-2.5 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/40 text-center">
                          <span className="font-mono font-black text-xs text-emerald-700 dark:text-emerald-300 block">
                            {cap.toLocaleString()} ml
                          </span>
                          <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 font-bold block mt-0.5">
                            = {vol} Litres
                          </span>
                        </div>
                      </td>

                      {/* Tare Wt & Waste % */}
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <span className="font-mono text-slate-700 dark:text-slate-300 font-bold text-xs block">
                          Tare: {tare > 0 ? `${tare} kg` : '0 kg'}
                        </span>
                        <span className="inline-block mt-0.5 px-1.5 py-0.2 rounded text-[9.5px] font-mono font-bold bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-200 dark:border-amber-900/40">
                          Std Waste: {wastePct}%
                        </span>
                      </td>

                      {/* Linked Packaging Materials */}
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
                                <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 shrink-0">
                                  {rm.qtyPerUnit || 1} {rm.uom || 'pcs'}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-slate-400 text-[11px] italic">No packaging linked</span>
                        )}
                      </td>

                      {/* Status Toggle */}
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => toggleStatusMutation.mutate({ id: u.id, newStatus: isActive ? 'INACTIVE' : 'ACTIVE' })}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10.5px] font-bold cursor-pointer transition-all active:scale-95 ${
                            isActive
                              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700'
                              : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 border border-slate-300 dark:border-slate-700'
                          }`}
                          title={`Click to mark ${isActive ? 'INACTIVE' : 'ACTIVE'}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                          <span>{u.status}</span>
                        </button>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenEditModal(u)}
                            className="h-7 w-7 p-0 rounded-lg text-slate-600 dark:text-slate-300 hover:text-emerald-600 hover:border-emerald-300 cursor-pointer"
                            title="Edit bulk storage unit and packaging materials"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </Button>

                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeleteUnit(u)}
                            className="h-7 w-7 p-0 rounded-lg text-rose-500 hover:text-rose-700 hover:border-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                            title="Delete storage unit"
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
            Showing <strong className="text-slate-800 dark:text-slate-200">{(currentPage - 1) * itemsPerPage + 1}</strong> to <strong className="text-slate-800 dark:text-slate-200">{Math.min(currentPage * itemsPerPage, filteredUnits.length)}</strong> of <strong className="text-slate-800 dark:text-slate-200">{filteredUnits.length}</strong> storage units
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
                <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
                  🛢️
                </div>
                <div>
                  <h3 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white">
                    {editingUnit ? `Edit Bulk Storage Unit: ${editingUnit.unitCode}` : 'Create Bulk Storage Unit Master'}
                  </h3>
                  <span className="text-[11px] text-slate-400 font-mono">
                    Running Code: {formData.unitCode || 'Auto-generated'}
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
                {/* Unit Code */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Unit Code *
                  </label>
                  <Input
                    type="text"
                    value={formData.unitCode}
                    onChange={(e) => setFormData(prev => ({ ...prev, unitCode: e.target.value }))}
                    placeholder="e.g. BLK271126-0001 or BLK-2000ML"
                    required
                    className="h-8.5 text-xs font-mono font-bold bg-white dark:bg-slate-950"
                  />
                </div>

                {/* Unit Name */}
                <div className="sm:col-span-2">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Unit Title / Name *
                  </label>
                  <Input
                    type="text"
                    value={formData.unitName}
                    onChange={(e) => setFormData(prev => ({ ...prev, unitName: e.target.value }))}
                    placeholder="e.g. Gallon (2,000 ml)"
                    required
                    className="h-8.5 text-xs font-bold bg-white dark:bg-slate-950"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Unit Type */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Container Type
                  </label>
                  <SearchSelect
                    size="sm"
                    value={formData.unitType}
                    onChange={(val) => setFormData(prev => ({ ...prev, unitType: val }))}
                    options={UNIT_TYPES.map(type => ({ value: type, label: type }))}
                    placeholder="Select Container Type"
                    searchPlaceholder="Search container type..."
                  />
                </div>

                {/* Capacity (ml) */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Capacity (ml) *
                  </label>
                  <Input
                    type="number"
                    min="1"
                    step="1"
                    value={formData.capacityMl}
                    onChange={(e) => handleCapacityChange(e.target.value)}
                    required
                    className="h-8.5 text-xs font-mono font-bold bg-white dark:bg-slate-950 text-right"
                  />
                </div>

                {/* Nominal Volume (Ltr) */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Nominal Volume (Litres)
                  </label>
                  <Input
                    type="number"
                    step="0.001"
                    min="0.001"
                    value={formData.nominalVolumeLtr}
                    onChange={(e) => setFormData(prev => ({ ...prev, nominalVolumeLtr: parseFloat(e.target.value) || 0 }))}
                    className="h-8.5 text-xs font-mono font-bold bg-white dark:bg-slate-950 text-right"
                  />
                </div>
              </div>

              {/* Physical Specs & Wastage */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Tare Weight (kg)
                  </label>
                  <Input
                    type="number"
                    step="0.005"
                    min="0"
                    value={formData.tareWeightKg}
                    onChange={(e) => setFormData(prev => ({ ...prev, tareWeightKg: parseFloat(e.target.value) || 0 }))}
                    placeholder="e.g. 0.080"
                    className="h-8.5 text-xs font-mono bg-white dark:bg-slate-950 text-right"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Standard Waste % *
                  </label>
                  <Input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    value={formData.standardWastePercent}
                    onChange={(e) => setFormData(prev => ({ ...prev, standardWastePercent: parseFloat(e.target.value) || 0 }))}
                    placeholder="0.5"
                    className="h-8.5 text-xs font-mono font-bold bg-white dark:bg-slate-950 text-right"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Material
                  </label>
                  <Input
                    type="text"
                    value={formData.material}
                    onChange={(e) => setFormData(prev => ({ ...prev, material: e.target.value }))}
                    placeholder="e.g. Food Grade HDPE / PP"
                    className="h-8.5 text-xs bg-white dark:bg-slate-950"
                  />
                </div>
              </div>

              {/* ── LINKED PACKAGING RAW MATERIALS BUILDER ── */}
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
                    <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                      Linked Packaging Materials (Containers, Cans, Tubs, Lids &amp; Boxes)
                    </h4>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAddLinkedRm}
                    className="h-7 px-2.5 text-[10.5px] font-bold border-emerald-300 text-emerald-700 dark:border-emerald-800 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950 cursor-pointer"
                  >
                    <Plus className="w-3 h-3 mr-1" />
                    <span>Link Packaging RM</span>
                  </Button>
                </div>

                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  When this bulk unit is selected in Step 3 of Standard Production, these containers and packaging materials will automatically sync into the batch consumption ledger.
                </p>

                {formData.linkedRawMaterials.length === 0 ? (
                  <div className="py-4 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-xl text-slate-400 text-xs">
                    No packaging materials linked yet. Click "+ Link Packaging RM" to link a Gallon Box, PET Can, or Tub Lid.
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
                            placeholder="Select Packaging Material..."
                            searchPlaceholder="Search material by code, name or category..."
                          />
                        </div>

                        {/* Role */}
                        <div className="sm:col-span-3">
                          <label className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">Packaging Role</label>
                          <SearchSelect
                            size="sm"
                            showSearch={false}
                            value={rm.role}
                            onChange={(val) => handleUpdateLinkedRm(idx, 'role', val)}
                            options={PACKAGING_ROLE_OPTIONS.map(r => ({ value: r, label: r }))}
                            placeholder="Select Role"
                          />
                        </div>

                        {/* Quantity */}
                        <div className="sm:col-span-2">
                          <label className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">Qty / Bulk Unit</label>
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
                          <span className="font-mono font-bold text-emerald-600 block text-center pt-1 text-xs">
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

              {/* Status & Description */}
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
                    Description &amp; Specifications
                  </label>
                  <Input
                    type="text"
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="e.g. Standard 4 Litre Gallon Box Container with inner bag"
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
                  className="h-8.5 px-5 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                >
                  {saveMutation.isPending ? 'Saving...' : (editingUnit ? 'Update Unit' : 'Create Unit')}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
