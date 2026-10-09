import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Layers, Plus, Search, Edit, Trash2, FileSpreadsheet, Copy, Check,
  AlertCircle, X, ChevronDown, ChevronUp, Sliders, ShieldCheck, Download,
  Sparkles, RefreshCw, ArrowUpDown, Tag, Info, ArrowRight, CornerDownRight
} from 'lucide-react';
import Swal from 'sweetalert2';
import { api } from '@/lib/axios';

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const STANDARD_SECTIONS = [
  'PHYSICAL CHARACTERISTICS',
  'CHEMICAL & QUALITY SPECS',
  'STORAGE & SHELF LIFE',
  'PACKAGING & LOGISTICS',
  'ALLERGEN & REGULATORY',
  'CUSTOM SPECIFICATIONS'
];

const SYSTEM_PRESETS = [
  {
    id: 'PRESET_DAIRY_ICE_CREAM',
    name: 'DAIRY & ICE CREAM MASTER TEMPLATE',
    specsCount: 7,
    desc: 'Fat %, Total Solids / SNF %, Temp (-18°C), Shelf Life (180d), Packaging Type, Allergen, Overrun %'
  },
  {
    id: 'PRESET_BEVERAGE_LIQUID',
    name: 'BEVERAGES & SYRUPS MASTER TEMPLATE',
    specsCount: 5,
    desc: 'Brix %, pH Level, Temp (4°C), Shelf Life (90d), Bottle Packaging Type'
  },
  {
    id: 'PRESET_GENERAL_RETAIL',
    name: 'GENERAL FINISHED GOODS & E-COMMERCE MASTER',
    specsCount: 4,
    desc: 'Net Weight, Outer Carton Units, Storage Condition, Barcode Standard'
  }
];

export default function ProductSubcategoryManager() {
  const queryClient = useQueryClient();

  const [selectedCategoryId, setSelectedCategoryId] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modals state
  const [isSubcategoryModalOpen, setIsSubcategoryModalOpen] = useState(false);
  const [editingSubcategory, setEditingSubcategory] = useState(null);
  
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [activeSubcategoryForTemplate, setActiveSubcategoryForTemplate] = useState(null);

  const [isDuplicateModalOpen, setIsDuplicateModalOpen] = useState(false);
  const [duplicateTargetSubcategory, setDuplicateTargetSubcategory] = useState(null);
  const [selectedSourceSubId, setSelectedSourceSubId] = useState('');
  const [isDuplicateDropdownOpen, setIsDuplicateDropdownOpen] = useState(false);
  const [isDuplicating, setIsDuplicating] = useState(false);

  // Subcategory form state
  const [subForm, setSubForm] = useState({
    categoryId: '',
    name: '',
    code: '',
    skuPrefix: '',
    hsnCodeDefault: '',
    description: '',
    status: 'ACTIVE'
  });

  // Fetch categories
  const { data: categories = [] } = useQuery({
    queryKey: ['product-categories'],
    queryFn: async () => {
      const res = await api.get('/item-setup/product-category');
      return res.data || [];
    }
  });

  // Fetch subcategories
  const { data: subcategories = [], isLoading } = useQuery({
    queryKey: ['product-subcategories'],
    queryFn: async () => {
      const res = await api.get('/product-subcategories');
      return res.data || [];
    }
  });

  // Filtered subcategories
  const filteredSubcategories = useMemo(() => {
    return subcategories.filter(sub => {
      const matchesCategory = selectedCategoryId === 'ALL' || sub.categoryId === selectedCategoryId;
      const q = searchTerm.toLowerCase().trim();
      const matchesSearch = !q ||
        sub.name.toLowerCase().includes(q) ||
        sub.code.toLowerCase().includes(q) ||
        (sub.skuPrefix && sub.skuPrefix.toLowerCase().includes(q)) ||
        (sub.category?.name && sub.category.name.toLowerCase().includes(q));
      return matchesCategory && matchesSearch;
    });
  }, [subcategories, selectedCategoryId, searchTerm]);

  // Open Add Subcategory Modal
  const openAddSubcategory = () => {
    setEditingSubcategory(null);
    setSubForm({
      categoryId: categories[0]?.id || '',
      name: '',
      code: '',
      skuPrefix: '',
      hsnCodeDefault: '',
      description: '',
      status: 'ACTIVE'
    });
    setIsSubcategoryModalOpen(true);
  };

  // Open Edit Subcategory Modal
  const openEditSubcategory = (sub) => {
    setEditingSubcategory(sub);
    setSubForm({
      categoryId: sub.categoryId,
      name: sub.name,
      code: sub.code,
      skuPrefix: sub.skuPrefix || '',
      hsnCodeDefault: sub.hsnCodeDefault || '',
      description: sub.description || '',
      status: sub.status || 'ACTIVE'
    });
    setIsSubcategoryModalOpen(true);
  };

  // Save Subcategory
  const handleSaveSubcategory = async (e) => {
    e.preventDefault();
    const isDark = document.documentElement.classList.contains('dark');
    if (!subForm.name.trim() || !subForm.categoryId) {
      Swal.fire({
        title: 'Required Fields',
        text: 'Please enter a subcategory name and select a main category.',
        icon: 'warning'
      });
      return;
    }

    try {
      const nameUpper = subForm.name.trim().toUpperCase();
      const code = subForm.code.trim() || nameUpper.slice(0, 3).toUpperCase();
      const payload = {
        ...subForm,
        name: nameUpper,
        code: code.toUpperCase(),
        skuPrefix: (subForm.skuPrefix.trim() || code).toUpperCase()
      };

      if (editingSubcategory) {
        await api.put(`/product-subcategories/${editingSubcategory.id}`, payload);
      } else {
        await api.post('/product-subcategories', payload);
      }

      queryClient.invalidateQueries({ queryKey: ['product-subcategories'] });
      setIsSubcategoryModalOpen(false);

      Swal.fire({
        title: `<span class="font-bold text-sm text-slate-800 dark:text-slate-100">Subcategory Saved</span>`,
        text: `Subcategory "${subForm.name}" has been ${editingSubcategory ? 'updated' : 'created'} successfully.`,
        icon: 'success',
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true
      });
    } catch (err) {
      Swal.fire({
        title: 'Error Saving Subcategory',
        text: err.response?.data?.message || err.message,
        icon: 'error'
      });
    }
  };

  // Delete Subcategory
  const handleDeleteSubcategory = (sub) => {
    const isDark = document.documentElement.classList.contains('dark');
    Swal.fire({
      title: 'Delete Subcategory?',
      html: `
        <div class="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Are you sure you want to delete <strong class="text-slate-900 dark:text-slate-100">"${sub.name}"</strong>?
          <p class="text-rose-600 dark:text-rose-400 font-medium mt-1.5 text-[11px]">This action cannot be undone and will be recorded in the audit log.</p>
        </div>
      `,
      icon: 'warning',
      iconColor: '#f59e0b',
      showCancelButton: true,
      confirmButtonText: 'Yes, delete',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#64748b',
      background: isDark ? '#1e293b' : '#ffffff',
      color: isDark ? '#f8fafc' : '#0f172a',
      customClass: {
        popup: 'rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl p-5 select-none',
        confirmButton: 'px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold transition-all mr-2',
        cancelButton: 'px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold transition-all'
      },
      buttonsStyling: false
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          await api.delete(`/product-subcategories/${sub.id}`);
          queryClient.invalidateQueries({ queryKey: ['product-subcategories'] });
          queryClient.invalidateQueries({ queryKey: ['product-categories'] });
          Swal.fire({
            title: `<span class="font-bold text-sm text-slate-800 dark:text-slate-100">Subcategory Deleted</span>`,
            html: `<p class="text-xs text-slate-500 dark:text-slate-400 mt-1">"${sub.name}" was removed and recorded in the audit log.</p>`,
            icon: 'success',
            iconColor: '#10b981',
            toast: true,
            position: 'top-end',
            showConfirmButton: false,
            timer: 3000,
            timerProgressBar: true,
            background: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)',
            color: isDark ? '#f8fafc' : '#0f172a',
            customClass: {
              popup: 'rounded-xl border border-emerald-100 dark:border-emerald-950 shadow-lg p-3.5',
              timerProgressBar: 'bg-emerald-500'
            }
          });
        } catch (err) {
          const data = err.response?.data;
          const prods = data?.products || [];

          if (prods.length > 0) {
            Swal.fire({
              title: '<span class="text-base font-bold text-rose-600 dark:text-rose-400">Cannot Delete Subcategory</span>',
              html: `
                <div class="text-left text-xs space-y-2.5 mt-2">
                  <div class="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 font-medium">
                    ${data.message || 'This subcategory is currently assigned to existing products.'}
                  </div>
                  <div class="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Linked Products (${prods.length}):</div>
                  <div class="max-h-40 overflow-y-auto space-y-1.5 border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 bg-slate-50 dark:bg-slate-900">
                    ${prods.map(p => `
                      <div class="flex items-center justify-between text-xs py-1 border-b border-slate-200/60 dark:border-slate-800/60 last:border-0">
                        <span class="font-bold text-slate-800 dark:text-slate-100">${p.name}</span>
                        <span class="font-mono text-[10px] font-bold text-indigo-600 dark:text-indigo-400">${p.code || 'N/A'}</span>
                      </div>
                    `).join('')}
                  </div>
                  <p class="text-[11px] text-slate-500 dark:text-slate-400">
                    You cannot delete a subcategory with linked products. Please reassign or delete these products first.
                  </p>
                </div>
              `,
              icon: 'error',
              confirmButtonText: 'Understood',
              confirmButtonColor: '#4f46e5',
              background: isDark ? '#1e293b' : '#ffffff',
              color: isDark ? '#f8fafc' : '#0f172a'
            });
          } else {
            Swal.fire({
              title: 'Cannot Delete Subcategory',
              text: data?.message || err.message || 'Failed to delete subcategory.',
              icon: 'error',
              confirmButtonColor: '#4f46e5',
              background: isDark ? '#1e293b' : '#ffffff',
              color: isDark ? '#f8fafc' : '#0f172a'
            });
          }
        }
      }
    });
  };

  // Download Excel Format
  const handleDownloadExcel = async (sub) => {
    try {
      const res = await api.get(`/product-spec-templates/${sub.id}/export-excel-format`, {
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Material_Master_${sub.code}_Template.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      Swal.fire({
        title: 'Download Failed',
        text: err.response?.data?.message || 'Could not download template',
        icon: 'error'
      });
    }
  };

  // Open Template Builder
  const openTemplateBuilder = (sub) => {
    setActiveSubcategoryForTemplate(sub);
    setIsTemplateModalOpen(true);
  };

  // Open Duplicate Modal
  const openDuplicateModal = (targetSub) => {
    setDuplicateTargetSubcategory(targetSub);
    const sourceCandidates = subcategories.filter(s => s.id !== targetSub.id && s.specTemplate);
    if (sourceCandidates.length > 0) {
      setSelectedSourceSubId(sourceCandidates[0].id);
    } else {
      setSelectedSourceSubId('PRESET_DAIRY_ICE_CREAM');
    }
    setIsDuplicateDropdownOpen(false);
    setIsDuplicateModalOpen(true);
  };

  // Confirm Duplicate
  const handleConfirmDuplicate = async () => {
    if (!selectedSourceSubId || !duplicateTargetSubcategory) {
      Swal.fire({
        title: 'Please Select a Source',
        text: 'Choose a source specification template to clone.',
        icon: 'warning'
      });
      return;
    }
    setIsDuplicating(true);
    try {
      await api.post('/product-spec-templates/duplicate', {
        sourceSubcategoryId: selectedSourceSubId,
        targetSubcategoryId: duplicateTargetSubcategory.id
      });

      queryClient.invalidateQueries({ queryKey: ['product-subcategories'] });
      setIsDuplicateModalOpen(false);

      Swal.fire({
        title: '<span class="font-bold text-sm text-slate-800 dark:text-slate-100">Template Duplicated!</span>',
        text: `Specifications cloned into "${duplicateTargetSubcategory.name?.toUpperCase()}" successfully.`,
        icon: 'success',
        toast: true,
        position: 'top-end',
        timer: 3000
      });
    } catch (err) {
      Swal.fire({
        title: 'Duplication Failed',
        text: err.response?.data?.message || err.message,
        icon: 'error'
      });
    } finally {
      setIsDuplicating(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Header & Actions Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-xl shadow-xs">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Layers className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            Product Subcategories & Material Master Templates
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Configure subcategories, manage mandatory/optional quality specifications, and download bulk upload formats.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={openAddSubcategory}
            className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-3 py-2 rounded-lg flex items-center gap-1.5 shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Subcategory
          </Button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-slate-50 dark:bg-slate-900/60 p-3 rounded-xl border border-slate-200/80 dark:border-slate-800">
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Category Filter:</span>
          <select
            value={selectedCategoryId}
            onChange={(e) => setSelectedCategoryId(e.target.value)}
            className="text-xs font-semibold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 uppercase"
          >
            <option value="ALL">ALL CATEGORIES ({categories.length})</option>
            {categories.map(c => (
              <option key={c.id} value={c.id}>{c.name?.toUpperCase()}</option>
            ))}
          </select>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search subcategory or code..."
            className="pl-8 text-xs py-1.5 h-8 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Subcategories Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50/70 dark:bg-slate-950/70 text-[11px] font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
              <TableHead>Subcategory Info</TableHead>
              <TableHead>Main Category</TableHead>
              <TableHead>Code & SKU Prefix</TableHead>
              <TableHead>Spec Template</TableHead>
              <TableHead>Products</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-xs text-slate-400">
                  Loading subcategories...
                </TableCell>
              </TableRow>
            ) : filteredSubcategories.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12 text-xs text-slate-400">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <Layers className="w-8 h-8 text-slate-300 dark:text-slate-600 stroke-[1.5]" />
                    <p className="font-semibold text-slate-700 dark:text-slate-300">No Subcategories Found</p>
                    <p className="text-[11px] text-slate-400 max-w-sm">
                      {searchTerm || selectedCategoryId !== 'ALL'
                        ? 'Try clearing your filters or search term.'
                        : 'Create your first subcategory and assign specification templates.'}
                    </p>
                    <Button onClick={openAddSubcategory} size="sm" variant="outline" className="mt-2 text-xs">
                      <Plus className="w-3 h-3 mr-1" /> Add Subcategory
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredSubcategories.map(sub => {
                const hasTemplate = !!sub.specTemplate;
                const fieldCount = sub.specTemplate?._count?.fields || 0;
                const productCount = sub._count?.products || 0;

                return (
                  <TableRow key={sub.id} className="text-xs hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                    <TableCell>
                      <div className="font-bold text-slate-900 dark:text-white uppercase tracking-tight">
                        {sub.name?.toUpperCase()}
                      </div>
                      {sub.description && (
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1">
                          {sub.description}
                        </div>
                      )}
                    </TableCell>

                    <TableCell>
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800/60 uppercase">
                        {sub.category?.name?.toUpperCase() || '—'}
                      </span>
                    </TableCell>

                    <TableCell>
                      <div className="flex items-center gap-1.5 font-mono">
                        <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                          {sub.code}
                        </span>
                        <ArrowRight className="w-2.5 h-2.5 text-slate-400" />
                        <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold">
                          {sub.skuPrefix || sub.code}
                        </span>
                      </div>
                    </TableCell>

                    <TableCell>
                      {hasTemplate ? (
                        <div className="flex items-center gap-1.5">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/60">
                            <Check className="w-2.5 h-2.5" />
                            {fieldCount} Field{fieldCount === 1 ? '' : 's'} (v{sub.specTemplate.version})
                          </span>
                        </div>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200/80 dark:border-amber-800/60">
                          No Template
                        </span>
                      )}
                    </TableCell>

                    <TableCell>
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        {productCount}
                      </span>
                    </TableCell>

                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => openTemplateBuilder(sub)}
                          className="h-7 px-2 text-[11px] font-semibold text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 dark:hover:bg-indigo-950/40"
                          title="Manage Specification Template"
                        >
                          <Sliders className="w-3 h-3 mr-1" />
                          Specs
                        </Button>

                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDownloadExcel(sub)}
                          className="h-7 px-2 text-[11px] text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                          title="Download Excel Upload Template"
                        >
                          <Download className="w-3 h-3" />
                        </Button>

                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => openDuplicateModal(sub)}
                          className="h-7 px-2 text-[11px] text-purple-600 hover:text-purple-700 hover:bg-purple-50 dark:hover:bg-purple-950/40"
                          title="Duplicate template from another subcategory"
                        >
                          <Copy className="w-3 h-3" />
                        </Button>

                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => openEditSubcategory(sub)}
                          className="h-7 w-7 p-0 text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                        >
                          <Edit className="w-3 h-3" />
                        </Button>

                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDeleteSubcategory(sub)}
                          className="h-7 w-7 p-0 text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/50"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          MODAL 1: Add / Edit Subcategory Modal
         ───────────────────────────────────────────────────────────── */}
      {isSubcategoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full shadow-2xl overflow-hidden p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Layers className="w-4 h-4 text-indigo-600" />
                {editingSubcategory ? 'Edit Subcategory' : 'Add New Subcategory'}
              </h3>
              <button
                onClick={() => setIsSubcategoryModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveSubcategory} className="space-y-3.5">
              <div>
                <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Main Category <span className="text-rose-500">*</span>
                </Label>
                <select
                  value={subForm.categoryId}
                  onChange={e => setSubForm({ ...subForm, categoryId: e.target.value })}
                  className="w-full mt-1 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  required
                >
                  <option value="" disabled>Select Category</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.name?.toUpperCase()}</option>
                  ))}
                </select>
              </div>

              <div>
                <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Subcategory Name <span className="text-rose-500">*</span>
                </Label>
                <Input
                  value={subForm.name}
                  style={{ textTransform: 'uppercase' }}
                  onChange={e => {
                    const name = e.target.value.toUpperCase();
                    const code = subForm.code || name.replace(/[^A-Za-z0-9]/g, '').slice(0, 3).toUpperCase();
                    setSubForm({ ...subForm, name, code, skuPrefix: subForm.skuPrefix || code });
                  }}
                  placeholder="E.G. REGULAR STICK KULFI"
                  className="mt-1 text-xs font-semibold"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Code <span className="text-rose-500">*</span>
                  </Label>
                  <Input
                    value={subForm.code}
                    onChange={e => setSubForm({ ...subForm, code: e.target.value.toUpperCase() })}
                    placeholder="e.g. REG-STK"
                    className="mt-1 text-xs font-mono"
                    required
                  />
                </div>

                <div>
                  <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    SKU Prefix
                  </Label>
                  <Input
                    value={subForm.skuPrefix}
                    onChange={e => setSubForm({ ...subForm, skuPrefix: e.target.value.toUpperCase() })}
                    placeholder="e.g. KUL-REG"
                    className="mt-1 text-xs font-mono"
                  />
                </div>
              </div>

              <div>
                <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Default HSN Code
                </Label>
                <Input
                  value={subForm.hsnCodeDefault}
                  onChange={e => setSubForm({ ...subForm, hsnCodeDefault: e.target.value })}
                  placeholder="e.g. 21050000"
                  className="mt-1 text-xs font-mono"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Description
                </Label>
                <textarea
                  value={subForm.description}
                  onChange={e => setSubForm({ ...subForm, description: e.target.value })}
                  placeholder="Optional notes or specification guidelines"
                  rows={2}
                  className="w-full mt-1 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsSubcategoryModalOpen(false)}
                  className="text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold"
                >
                  {editingSubcategory ? 'Update' : 'Create'} Subcategory
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          MODAL 2: Visual Specification Template Builder Modal
         ───────────────────────────────────────────────────────────── */}
      {isTemplateModalOpen && activeSubcategoryForTemplate && (
        <SpecTemplateBuilderModal
          subcategory={activeSubcategoryForTemplate}
          onClose={() => {
            setIsTemplateModalOpen(false);
            queryClient.invalidateQueries({ queryKey: ['product-subcategories'] });
          }}
        />
      )}

      {/* ─────────────────────────────────────────────────────────────
          MODAL 3: 1-Click Duplicate Template Modal
         ───────────────────────────────────────────────────────────── */}
      {isDuplicateModalOpen && duplicateTargetSubcategory && (() => {
        const sourceCandidates = subcategories.filter(s => s.id !== duplicateTargetSubcategory.id && s.specTemplate);
        const selectedPreset = SYSTEM_PRESETS.find(p => p.id === selectedSourceSubId);
        const selectedCandidate = sourceCandidates.find(s => s.id === selectedSourceSubId);

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full shadow-2xl overflow-visible p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center border border-purple-100 dark:border-purple-800">
                    <Copy className="w-3.5 h-3.5" />
                  </div>
                  <span className="uppercase tracking-wide">DUPLICATE SPECIFICATION TEMPLATE</span>
                </h3>
                <button
                  type="button"
                  onClick={() => {
                    setIsDuplicateDropdownOpen(false);
                    setIsDuplicateModalOpen(false);
                  }}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium uppercase tracking-tight">
                CLONE ALL MANDATORY &amp; OPTIONAL TECHNICAL SPECIFICATIONS, SECTIONS, RULES, AND DROPDOWN OPTIONS INTO:
              </p>

              {/* Target Subcategory Banner */}
              <div className="p-3.5 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800/70 flex items-center gap-3">
                <Sparkles className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0" />
                <div className="min-w-0 flex-1">
                  <span className="text-[10px] font-extrabold text-purple-700 dark:text-purple-300 uppercase tracking-wider block">TARGET SUBCATEGORY</span>
                  <span className="font-extrabold text-xs text-slate-900 dark:text-white uppercase truncate block mt-0.5">
                    {duplicateTargetSubcategory.name?.toUpperCase()} <span className="font-mono text-[11px] text-purple-600 dark:text-purple-400">({duplicateTargetSubcategory.code?.toUpperCase()})</span>
                  </span>
                </div>
                <span className="px-2.5 py-1 rounded text-[10px] font-extrabold bg-white dark:bg-slate-900 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 uppercase shrink-0 shadow-2xs">
                  {duplicateTargetSubcategory.category?.name?.toUpperCase()}
                </span>
              </div>

              {/* Source Dropdown Selector (Custom Interactive Dropdown) */}
              <div className="space-y-1.5 relative">
                <Label className="text-xs font-extrabold text-slate-700 dark:text-slate-300 uppercase block">
                  CHOOSE SOURCE SPECIFICATION TEMPLATE TO COPY <span className="text-rose-500">*</span>
                </Label>
                
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setIsDuplicateDropdownOpen(prev => !prev)}
                    className={`w-full flex items-center justify-between text-left text-xs font-bold bg-white dark:bg-slate-800 border-2 ${
                      isDuplicateDropdownOpen ? 'border-purple-600 ring-2 ring-purple-500/20' : 'border-slate-200 dark:border-slate-700'
                    } rounded-xl px-3.5 py-2.5 text-slate-900 dark:text-white shadow-xs transition-all cursor-pointer hover:border-purple-400`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-6 h-6 rounded-lg bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
                        <Layers className="w-3.5 h-3.5" />
                      </div>
                      {selectedPreset ? (
                        <div className="min-w-0">
                          <span className="font-extrabold text-slate-900 dark:text-white uppercase truncate block">
                            {selectedPreset.name}
                          </span>
                          <span className="text-[10px] text-purple-600 dark:text-purple-400 font-bold block uppercase">
                            ⭐ SYSTEM INDUSTRY MASTER • {selectedPreset.specsCount} SPECS
                          </span>
                        </div>
                      ) : selectedCandidate ? (
                        <div className="min-w-0">
                          <span className="font-extrabold text-slate-900 dark:text-white uppercase truncate block">
                            {selectedCandidate.name?.toUpperCase()}
                          </span>
                          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold block uppercase">
                            🏢 {selectedCandidate.category?.name?.toUpperCase()} • {selectedCandidate.specTemplate?._count?.fields || 0} SPECS
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-400 font-semibold uppercase">
                          -- SELECT SOURCE SPECIFICATION TEMPLATE --
                        </span>
                      )}
                    </div>
                    <ChevronDown className={`w-4 h-4 text-purple-500 shrink-0 transition-transform duration-200 ${isDuplicateDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {/* Floating Popover Menu */}
                  {isDuplicateDropdownOpen && (
                    <>
                      {/* Fixed backdrop click dismiss */}
                      <div 
                        className="fixed inset-0 z-40" 
                        onClick={() => setIsDuplicateDropdownOpen(false)} 
                      />
                      
                      <div className="absolute z-50 left-0 right-0 top-full mt-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl p-2 max-h-72 overflow-y-auto space-y-2 animate-in fade-in zoom-in-95 duration-100">
                        {/* Section 1: System Industry Presets */}
                        <div>
                          <div className="px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/40 rounded-md mb-1 flex items-center justify-between">
                            <span>🌟 SYSTEM INDUSTRY MASTER TEMPLATES</span>
                            <span className="text-[9px] font-semibold text-purple-500">RECOMMENDED</span>
                          </div>
                          <div className="space-y-1">
                            {SYSTEM_PRESETS.map(preset => {
                              const isSelected = selectedSourceSubId === preset.id;
                              return (
                                <button
                                  key={preset.id}
                                  type="button"
                                  onClick={() => {
                                    setSelectedSourceSubId(preset.id);
                                    setIsDuplicateDropdownOpen(false);
                                  }}
                                  className={`w-full text-left p-2.5 rounded-lg text-xs transition-colors flex items-start justify-between gap-2 cursor-pointer ${
                                    isSelected
                                      ? 'bg-purple-50 dark:bg-purple-950/60 border border-purple-200 dark:border-purple-800'
                                      : 'hover:bg-slate-100 dark:hover:bg-slate-800/80 border border-transparent'
                                  }`}
                                >
                                  <div className="min-w-0">
                                    <div className="font-extrabold text-slate-900 dark:text-white uppercase flex items-center gap-1.5">
                                      <span>{preset.name}</span>
                                      {isSelected && <Check className="w-3.5 h-3.5 text-purple-600 shrink-0" />}
                                    </div>
                                    <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1 uppercase">
                                      {preset.desc}
                                    </p>
                                  </div>
                                  <span className="shrink-0 px-2 py-0.5 rounded text-[10px] font-extrabold bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300 uppercase">
                                    {preset.specsCount} SPECS
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Section 2: Configured Subcategories */}
                        <div>
                          <div className="px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 rounded-md mb-1 flex items-center justify-between">
                            <span>🏢 CONFIGURED SUBCATEGORIES</span>
                            <span className="text-[9px] font-semibold text-emerald-500">{sourceCandidates.length} AVAILABLE</span>
                          </div>

                          {sourceCandidates.length === 0 ? (
                            <div className="p-3 text-center text-[11px] text-slate-400 italic uppercase">
                              No other subcategory has custom specs configured yet. Pick one of the Industry Masters above!
                            </div>
                          ) : (
                            <div className="space-y-1">
                              {sourceCandidates.map(sub => {
                                const isSelected = selectedSourceSubId === sub.id;
                                const fieldsCount = sub.specTemplate?._count?.fields || 0;
                                return (
                                  <button
                                    key={sub.id}
                                    type="button"
                                    onClick={() => {
                                      setSelectedSourceSubId(sub.id);
                                      setIsDuplicateDropdownOpen(false);
                                    }}
                                    className={`w-full text-left p-2.5 rounded-lg text-xs transition-colors flex items-center justify-between gap-2 cursor-pointer ${
                                      isSelected
                                        ? 'bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800'
                                        : 'hover:bg-slate-100 dark:hover:bg-slate-800/80 border border-transparent'
                                    }`}
                                  >
                                    <div className="min-w-0">
                                      <div className="font-extrabold text-slate-900 dark:text-white uppercase flex items-center gap-1.5">
                                        <span>{sub.name?.toUpperCase()}</span>
                                        {isSelected && <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
                                      </div>
                                      <span className="text-[10px] text-slate-400 font-bold uppercase">
                                        CATEGORY: {sub.category?.name?.toUpperCase()}
                                      </span>
                                    </div>
                                    <span className="shrink-0 px-2 py-0.5 rounded text-[10px] font-extrabold bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 uppercase">
                                      {fieldsCount} SPECS
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Source Template Preview Card */}
              {(selectedPreset || selectedCandidate) && (
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs space-y-1.5 animate-in fade-in duration-100">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">TEMPLATE OVERVIEW</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 uppercase">
                      {selectedPreset ? `${selectedPreset.specsCount} SPECIFICATION FIELDS` : `${selectedCandidate.specTemplate?._count?.fields || 0} SPECIFICATION FIELDS`}
                    </span>
                  </div>
                  <p className="font-extrabold text-slate-800 dark:text-slate-100 text-xs uppercase">
                    {selectedPreset ? selectedPreset.name : `${selectedCandidate.name?.toUpperCase()} SPECIFICATIONS`}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 uppercase font-medium">
                    {selectedPreset ? selectedPreset.desc : `CLONES ALL ACTIVE QUALITY, CHEMICAL, PACKAGING, AND STORAGE PARAMETERS CONFIGURED UNDER ${selectedCandidate.name?.toUpperCase()}.`}
                  </p>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setIsDuplicateDropdownOpen(false);
                    setIsDuplicateModalOpen(false);
                  }}
                  className="text-xs font-bold uppercase"
                >
                  CANCEL
                </Button>
                <Button
                  onClick={handleConfirmDuplicate}
                  disabled={!selectedSourceSubId || isDuplicating}
                  size="sm"
                  className="bg-purple-600 hover:bg-purple-700 text-white text-xs font-extrabold uppercase shadow-xs cursor-pointer inline-flex items-center gap-1.5"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>{isDuplicating ? 'DUPLICATING...' : 'DUPLICATE SPECS NOW'}</span>
                </Button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Subcomponent: Specification Template Visual Builder Modal
// ─────────────────────────────────────────────────────────────────────────────
function SpecTemplateBuilderModal({ subcategory, onClose }) {
  const queryClient = useQueryClient();

  const { data: templateData, isLoading, refetch } = useQuery({
    queryKey: ['product-spec-template', subcategory.id],
    queryFn: async () => {
      const res = await api.get(`/product-spec-templates/by-subcategory/${subcategory.id}`);
      return res.data;
    }
  });

  const [templateName, setTemplateName] = useState('');
  const [templateDesc, setTemplateDesc] = useState('');
  const [fields, setFields] = useState([]);
  
  // Field Editor Drawer/Card
  const [isFieldEditorOpen, setIsFieldEditorOpen] = useState(false);
  const [editingFieldIndex, setEditingFieldIndex] = useState(null);
  const [fieldForm, setFieldForm] = useState({
    fieldName: '',
    fieldKey: '',
    fieldType: 'TEXT',
    section: 'Physical Characteristics',
    unitOfMeasure: '',
    isMandatory: false,
    defaultValue: '',
    optionsString: '',
    minValue: '',
    maxValue: '',
    placeholder: '',
    helpText: ''
  });

  React.useEffect(() => {
    if (templateData) {
      setTemplateName(templateData.name || `${subcategory.name} Specifications`);
      setTemplateDesc(templateData.description || '');
      setFields(templateData.fields || []);
    }
  }, [templateData, subcategory]);

  const openAddField = () => {
    setEditingFieldIndex(null);
    setFieldForm({
      fieldName: '',
      fieldKey: '',
      fieldType: 'TEXT',
      section: STANDARD_SECTIONS[0],
      unitOfMeasure: '',
      isMandatory: false,
      defaultValue: '',
      optionsString: '',
      minValue: '',
      maxValue: '',
      placeholder: '',
      helpText: ''
    });
    setIsFieldEditorOpen(true);
  };

  const openEditField = (index) => {
    const f = fields[index];
    setEditingFieldIndex(index);
    setFieldForm({
      fieldName: f.fieldName,
      fieldKey: f.fieldKey,
      fieldType: f.fieldType || 'TEXT',
      section: f.section || STANDARD_SECTIONS[0],
      unitOfMeasure: f.unitOfMeasure || '',
      isMandatory: !!f.isMandatory,
      defaultValue: f.defaultValue || '',
      optionsString: Array.isArray(f.options) ? f.options.join(', ') : '',
      minValue: f.minValue !== null && f.minValue !== undefined ? String(f.minValue) : '',
      maxValue: f.maxValue !== null && f.maxValue !== undefined ? String(f.maxValue) : '',
      placeholder: f.placeholder || '',
      helpText: f.helpText || ''
    });
    setIsFieldEditorOpen(true);
  };

  const handleSaveFieldForm = (e) => {
    const fieldNameUpper = fieldForm.fieldName.trim().toUpperCase();
    const rawKey = fieldForm.fieldKey.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_') || fieldNameUpper.toLowerCase().replace(/[^a-z0-9]+/g, '_');
    const optionsArray = ['SELECT', 'MULTI_SELECT'].includes(fieldForm.fieldType)
      ? fieldForm.optionsString.split(',').map(s => s.trim().toUpperCase()).filter(Boolean)
      : null;

    const newField = {
      fieldName: fieldNameUpper,
      fieldKey: rawKey,
      fieldType: fieldForm.fieldType,
      section: (fieldForm.section.trim() || 'GENERAL SPECS').toUpperCase(),
      unitOfMeasure: fieldForm.unitOfMeasure.trim().toUpperCase() || null,
      isMandatory: fieldForm.isMandatory,
      defaultValue: fieldForm.defaultValue ? fieldForm.defaultValue.trim().toUpperCase() : null,
      options: optionsArray,
      minValue: fieldForm.minValue !== '' ? Number(fieldForm.minValue) : null,
      maxValue: fieldForm.maxValue !== '' ? Number(fieldForm.maxValue) : null,
      placeholder: fieldForm.placeholder ? fieldForm.placeholder.trim().toUpperCase() : null,
      helpText: fieldForm.helpText ? fieldForm.helpText.trim() : null,
      displayOrder: editingFieldIndex !== null ? fields[editingFieldIndex].displayOrder : fields.length + 1
    };

    if (editingFieldIndex !== null) {
      const updated = [...fields];
      updated[editingFieldIndex] = newField;
      setFields(updated);
    } else {
      setFields([...fields, newField]);
    }

    setIsFieldEditorOpen(false);
  };

  const handleDeleteField = (index) => {
    setFields(fields.filter((_, idx) => idx !== index));
  };

  const handleMoveField = (index, direction) => {
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= fields.length) return;
    const reordered = [...fields];
    const temp = reordered[index];
    reordered[index] = reordered[targetIdx];
    reordered[targetIdx] = temp;
    setFields(reordered);
  };

  const handleSaveFullTemplate = async () => {
    try {
      await api.post('/product-spec-templates', {
        subcategoryId: subcategory.id,
        name: (templateName.trim() || `${subcategory.name} SPECIFICATIONS`).toUpperCase(),
        description: templateDesc.trim() || null,
        fields: fields.map(f => ({
          ...f,
          fieldName: (f.fieldName || '').trim().toUpperCase(),
          section: (f.section || 'GENERAL SPECS').trim().toUpperCase(),
          unitOfMeasure: f.unitOfMeasure ? f.unitOfMeasure.trim().toUpperCase() : null
        }))
      });

      queryClient.invalidateQueries({ queryKey: ['product-spec-template', subcategory.id] });
      queryClient.invalidateQueries({ queryKey: ['product-subcategories'] });

      Swal.fire({
        title: 'Template Saved!',
        text: 'Specification template successfully updated in database.',
        icon: 'success',
        toast: true,
        position: 'top-end',
        timer: 3000
      });
      onClose();
    } catch (err) {
      Swal.fire({
        title: 'Error Saving Template',
        text: err.response?.data?.message || err.message,
        icon: 'error'
      });
    }
  };

  // Group fields by section
  const groupedFields = useMemo(() => {
    const groups = {};
    fields.forEach((f, idx) => {
      const sec = f.section || 'General Specs';
      if (!groups[sec]) groups[sec] = [];
      groups[sec].push({ ...f, _originalIndex: idx });
    });
    return groups;
  }, [fields]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-4xl w-full h-[90vh] shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:px-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0 bg-slate-50/70 dark:bg-slate-950/70">
          <div>
            <div className="flex items-center gap-2">
              <Sliders className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Specification Template Builder
              </h3>
              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 border border-indigo-200/80">
                {subcategory.name} ({subcategory.code})
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Define the mandatory & optional quality attributes that auto-load when adding products to this subcategory.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={openAddField}
              size="sm"
              className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" /> Add Field
            </Button>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body (Split view or field list) */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {/* Template Details Card */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 dark:bg-slate-800/40 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700">
            <div>
              <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Template Name
              </Label>
              <Input
                value={templateName}
                onChange={e => setTemplateName(e.target.value)}
                placeholder="e.g. Standard Food Quality Specifications"
                className="mt-1 text-xs bg-white dark:bg-slate-900"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Description / Regulatory Notes
              </Label>
              <Input
                value={templateDesc}
                onChange={e => setTemplateDesc(e.target.value)}
                placeholder="e.g. FSSAI & Cold Chain Compliance Standards"
                className="mt-1 text-xs bg-white dark:bg-slate-900"
              />
            </div>
          </div>

          {/* Field Editor Card (when active) */}
          {isFieldEditorOpen && (
            <div className="p-4 rounded-xl border-2 border-indigo-500/50 bg-indigo-50/30 dark:bg-indigo-950/20 space-y-3 animate-in fade-in-50 zoom-in-95 duration-150">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-indigo-900 dark:text-indigo-200 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                  {editingFieldIndex !== null ? 'Edit Specification Field' : 'New Specification Field'}
                </span>
                <button
                  type="button"
                  onClick={() => setIsFieldEditorOpen(false)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSaveFieldForm} className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs font-semibold">Field Name *</Label>
                    <Input
                      value={fieldForm.fieldName}
                      style={{ textTransform: 'uppercase' }}
                      onChange={e => setFieldForm({
                        ...fieldForm,
                        fieldName: e.target.value.toUpperCase(),
                        fieldKey: fieldForm.fieldKey || e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '_')
                      })}
                      placeholder="E.G. MILK FAT PERCENTAGE"
                      className="mt-1 text-xs font-semibold bg-white dark:bg-slate-900"
                      required
                    />
                  </div>

                  <div>
                    <Label className="text-xs font-semibold">Field Key (JSON Key)</Label>
                    <Input
                      value={fieldForm.fieldKey}
                      onChange={e => setFieldForm({ ...fieldForm, fieldKey: e.target.value })}
                      placeholder="e.g. milk_fat_pct"
                      className="mt-1 text-xs font-mono bg-white dark:bg-slate-900"
                    />
                  </div>

                  <div>
                    <Label className="text-xs font-semibold">Field Type *</Label>
                    <select
                      value={fieldForm.fieldType}
                      onChange={e => setFieldForm({ ...fieldForm, fieldType: e.target.value })}
                      className="w-full mt-1 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-2 focus:ring-1 focus:ring-indigo-500"
                    >
                      <option value="TEXT">Text String</option>
                      <option value="NUMBER">Numeric (Decimal/Integer)</option>
                      <option value="BOOLEAN">Boolean (Yes/No)</option>
                      <option value="SELECT">Single Select (Dropdown)</option>
                      <option value="MULTI_SELECT">Multi Select</option>
                      <option value="DATE">Date</option>
                      <option value="RANGE">Range (Min - Max)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs font-semibold">Section / Group</Label>
                    <input
                      list="section-options"
                      value={fieldForm.section}
                      style={{ textTransform: 'uppercase' }}
                      onChange={e => setFieldForm({ ...fieldForm, section: e.target.value.toUpperCase() })}
                      className="w-full mt-1 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-2 focus:ring-1 focus:ring-indigo-500 font-semibold"
                      placeholder="SELECT OR TYPE SECTION NAME"
                    />
                    <datalist id="section-options">
                      {STANDARD_SECTIONS.map(s => <option key={s} value={s} />)}
                    </datalist>
                  </div>

                  <div>
                    <Label className="text-xs font-semibold">Unit of Measure (UOM Tag)</Label>
                    <Input
                      value={fieldForm.unitOfMeasure}
                      style={{ textTransform: 'uppercase' }}
                      onChange={e => setFieldForm({ ...fieldForm, unitOfMeasure: e.target.value.toUpperCase() })}
                      placeholder="E.G. %, °C, MM, G, KCAL"
                      className="mt-1 text-xs bg-white dark:bg-slate-900 font-semibold"
                    />
                  </div>

                  <div>
                    <Label className="text-xs font-semibold">Default Value</Label>
                    <Input
                      value={fieldForm.defaultValue}
                      style={{ textTransform: 'uppercase' }}
                      onChange={e => setFieldForm({ ...fieldForm, defaultValue: e.target.value.toUpperCase() })}
                      placeholder="E.G. -18 OR STANDARD"
                      className="mt-1 text-xs bg-white dark:bg-slate-900 font-semibold"
                    />
                  </div>
                </div>

                {['SELECT', 'MULTI_SELECT'].includes(fieldForm.fieldType) && (
                  <div>
                    <Label className="text-xs font-semibold">Dropdown Options (Comma-Separated) *</Label>
                    <Input
                      value={fieldForm.optionsString}
                      style={{ textTransform: 'uppercase' }}
                      onChange={e => setFieldForm({ ...fieldForm, optionsString: e.target.value.toUpperCase() })}
                      placeholder="E.G. FOIL WRAPPER, PILLOW POUCH, BOX, CUP"
                      className="mt-1 text-xs bg-white dark:bg-slate-900 font-semibold"
                      required
                    />
                  </div>
                )}

                {fieldForm.fieldType === 'NUMBER' && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs font-semibold">Min Value Allowed</Label>
                      <Input
                        type="number"
                        step="any"
                        value={fieldForm.minValue}
                        onChange={e => setFieldForm({ ...fieldForm, minValue: e.target.value })}
                        placeholder="Optional min"
                        className="mt-1 text-xs bg-white dark:bg-slate-900"
                      />
                    </div>
                    <div>
                      <Label className="text-xs font-semibold">Max Value Allowed</Label>
                      <Input
                        type="number"
                        step="any"
                        value={fieldForm.maxValue}
                        onChange={e => setFieldForm({ ...fieldForm, maxValue: e.target.value })}
                        placeholder="Optional max"
                        className="mt-1 text-xs bg-white dark:bg-slate-900"
                      />
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between pt-2">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={fieldForm.isMandatory}
                      onChange={e => setFieldForm({ ...fieldForm, isMandatory: e.target.checked })}
                      className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500"
                    />
                    <span className="text-xs font-bold text-rose-600 dark:text-rose-400">
                      Mandatory Field (Required when adding products)
                    </span>
                  </label>

                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => setIsFieldEditorOpen(false)}
                      className="text-xs"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      size="sm"
                      className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold"
                    >
                      {editingFieldIndex !== null ? 'Update Field' : 'Add to Template'}
                    </Button>
                  </div>
                </div>
              </form>
            </div>
          )}

          {/* Fields Grouped by Section */}
          {fields.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl p-6">
              <Sliders className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-2 stroke-[1.5]" />
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                No Specification Fields Defined Yet
              </p>
              <p className="text-[11px] text-slate-400 max-w-sm mx-auto mt-1">
                Click "+ Add Field" above to define mandatory or optional quality specifications.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {Object.entries(groupedFields).map(([sectionName, sectionFields]) => (
                <div
                  key={sectionName}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs"
                >
                  <div className="bg-slate-50 dark:bg-slate-800/60 px-4 py-2 border-b border-slate-200 dark:border-slate-700/80 flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      <Tag className="w-3 h-3 text-indigo-500" />
                      {sectionName}
                    </span>
                    <span className="text-[10px] font-semibold text-slate-500">
                      {sectionFields.length} field{sectionFields.length === 1 ? '' : 's'}
                    </span>
                  </div>

                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {sectionFields.map((f, localIdx) => (
                      <div
                        key={f.fieldKey + localIdx}
                        className="p-3 px-4 flex items-center justify-between hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex flex-col gap-0.5">
                            <button
                              type="button"
                              onClick={() => handleMoveField(f._originalIndex, -1)}
                              disabled={f._originalIndex === 0}
                              className="text-slate-400 hover:text-slate-700 disabled:opacity-20"
                            >
                              <ChevronUp className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleMoveField(f._originalIndex, 1)}
                              disabled={f._originalIndex === fields.length - 1}
                              className="text-slate-400 hover:text-slate-700 disabled:opacity-20"
                            >
                              <ChevronDown className="w-3 h-3" />
                            </button>
                          </div>

                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-900 dark:text-white text-xs">
                                {f.fieldName}
                              </span>
                              {f.isMandatory ? (
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300 border border-rose-200">
                                  Mandatory *
                                </span>
                              ) : (
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-500">
                                  Optional
                                </span>
                              )}
                              <span className="px-1.5 py-0.5 rounded font-mono text-[9px] bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                                {f.fieldType}
                              </span>
                              {f.unitOfMeasure && (
                                <span className="text-[10px] text-slate-500 font-semibold font-mono">
                                  [{f.unitOfMeasure}]
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-400 mt-0.5 font-mono">
                              key: {f.fieldKey}
                              {f.defaultValue && ` | default: "${f.defaultValue}"`}
                              {f.options && ` | options: [${f.options.join(', ')}]`}
                              {f.minValue !== null && ` | min: ${f.minValue}`}
                              {f.maxValue !== null && ` | max: ${f.maxValue}`}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => openEditField(f._originalIndex)}
                            className="h-7 w-7 p-0 text-slate-500 hover:text-slate-800"
                          >
                            <Edit className="w-3 h-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDeleteField(f._originalIndex)}
                            className="h-7 w-7 p-0 text-rose-500 hover:text-rose-700"
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 sm:px-6 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0 bg-slate-50/70 dark:bg-slate-950/70">
          <span className="text-xs text-slate-500">
            Total {fields.length} Specification Field{fields.length === 1 ? '' : 's'} defined
          </span>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onClose} className="text-xs">
              Cancel
            </Button>
            <Button
              onClick={handleSaveFullTemplate}
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-4"
            >
              Save Template Changes
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
