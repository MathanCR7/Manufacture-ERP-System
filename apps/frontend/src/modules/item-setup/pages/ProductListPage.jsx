import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Swal from 'sweetalert2';
import {
  Edit, Trash2, Plus, Search, Tag, Package, DollarSign, Settings,
  ArrowLeft, Save, Loader2, AlertCircle, Info, Check, Percent, Clock, ChevronDown, X
} from 'lucide-react';
import { api } from '@/lib/axios';

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import SearchSelect from '@/components/ui/SearchSelect';
import HsnSelect from '@/components/forms/HsnSelect';

const UOM_OPTIONS = [
  // Weight
  'gm', 'kg', 'mg', 'lb', 'oz', 'ton', 'metric ton', 'quintal',
  // Volume
  'liter', 'ml', 'cl', 'dl', 'gallon', 'quart', 'pint', 'fluid oz', 'cubic meter', 'cubic ft', 'cubic cm', 'cubic inch',
  // Length
  'meter', 'cm', 'mm', 'km', 'inch', 'feet', 'yard', 'mile',
  // Area
  'square meter', 'square ft', 'square cm', 'square inch', 'square yard', 'acre', 'hectare',
  // Count / Packaging
  'pcs', 'pair', 'dozen', 'gross', 'set', 'kit', 'bundle', 'box', 'carton', 'case', 'pack', 'bag', 'sack', 'pallet', 'tray', 'tube', 'bottle', 'can', 'drum', 'barrel', 'cylinder',
  // Roll / Sheet
  'roll', 'sheet', 'ream',
  // Time-based
  'hour', 'day',
  // Energy
  'kWh', 'MJ',
  // Other
  'unit', 'lot', 'assortment'
];

// Searchable UOM Dropdown Component
function UomSelect({ value, onChange, error }) {
  return (
    <SearchSelect
      value={value}
      onChange={onChange}
      options={UOM_OPTIONS}
      placeholder="Select UOM..."
      searchPlaceholder="Search UOM..."
      error={!!error}
      triggerClassName="text-sm border-slate-200 dark:border-slate-700 bg-white"
    />
  );
}

// Custom Checkbox Component for beautiful table checkboxes
function TableCheckbox({ checked, onChange, indeterminate }) {
  return (
    <label className="inline-flex items-center justify-center cursor-pointer group select-none">
      <input
        type="checkbox"
        className="sr-only"
        checked={checked}
        onChange={onChange}
      />
      <div
        className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all duration-150 group-hover:scale-105 shadow-sm relative ${
          checked
            ? 'bg-indigo-600 border-indigo-600'
            : indeterminate
            ? 'bg-indigo-500 border-indigo-500'
            : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 group-hover:border-indigo-500'
        }`}
      >
        {checked ? (
          <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />
        ) : indeterminate ? (
          <div className="w-2.5 h-0.5 bg-white rounded-full"></div>
        ) : null}
      </div>
    </label>
  );
}

function ProductForm({ editId, onBack }) {
  const isEditMode = !!editId;
  const queryClient = useQueryClient();

  // Masters
  const [masters, setMasters] = useState({
    categories: [],
    units: [],
    stages: [],
    nonInventoryItems: [],
    rawMaterials: [],
    users: []
  });

  // State
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // Form Fields
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [debouncedName, setDebouncedName] = useState('');
  const [nameMatches, setNameMatches] = useState([]);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedName(name);
    }, 300);
    return () => clearTimeout(handler);
  }, [name]);

  useEffect(() => {
    if (debouncedName.trim().length >= 1) {
      api.get('/products')
        .then(res => {
          const list = res.data || [];
          const matches = list.filter(p => 
            p.name.toLowerCase().includes(debouncedName.toLowerCase()) && 
            p.id !== editId
          );
          setNameMatches(matches);
        })
        .catch(err => console.error(err));
    } else {
      setNameMatches([]);
    }
  }, [debouncedName, editId]);

  const [categoryId, setCategoryId] = useState('');
  const [unitId, setUnitId] = useState('');
  const [stockMethod, setStockMethod] = useState('FIFO');
  const [openingStock, setOpeningStock] = useState(0);
  const [alertLevel, setAlertLevel] = useState(0);
  const [hsnCode, setHsnCode] = useState('');

  // BoM (Raw Material Consumption)
  const [bom, setBom] = useState([]);
  const [selectedRmId, setSelectedRmId] = useState('');

  // Non Inventory Cost
  const [nonInventoryCosts, setNonInventoryCosts] = useState([]);
  const [selectedNonInventoryId, setSelectedNonInventoryId] = useState('');

  // Totals & Taxes
  const [profitMargin, setProfitMargin] = useState(10);
  const [cgst, setCgst] = useState(9);
  const [sgst, setSgst] = useState(9);
  const [igst, setIgst] = useState(9);

  const handleHsnSelect = (item) => {
    setHsnCode(item.hsn_code);
    if (item.gst_rate) {
      const halfRate = Number(item.gst_rate) / 2;
      setCgst(halfRate);
      setSgst(halfRate);
      setIgst(Number(item.gst_rate));
    }
  };

  // Production Stages
  const [stages, setStages] = useState([]);
  const [selectedStageId, setSelectedStageId] = useState('');

  // Fetch masters and product details
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        // Fetch masters
        const mastersRes = await api.get('/products/masters');
        setMasters(mastersRes.data || {});

        if (isEditMode) {
          const prodRes = await api.get(`/products/${editId}`);
          const prod = prodRes.data;
          
          setName(prod.name || '');
          setCode(prod.code || '');
          setCategoryId(prod.categoryId || '');
          setUnitId(prod.unit?.abbreviation || prod.unit?.name || prod.unitId || '');
          setStockMethod(prod.stockMethod || 'FIFO');
          setOpeningStock(Number(prod.openingStock || 0));
          setAlertLevel(Number(prod.alertLevel || 0));
          setHsnCode(prod.hsnCode || '');
          setProfitMargin(Number(prod.profitMargin || 0));
          setCgst(Number(prod.cgst || 0));
          setSgst(Number(prod.sgst || 0));
          setIgst(Number(prod.igst || 0));

          // Set BoM
          if (prod.bom) {
            setBom(prod.bom.map(item => ({
              rmId: item.rmId,
              name: item.rawMaterial?.name || '',
              code: item.rawMaterial?.code || '',
              unitPrice: Number(item.unitPrice || 0),
              consumption: Number(item.consumptionPerUnit || 0),
              totalCost: Number(item.totalCost || 0)
            })));
          }

          // Set Non Inventory Costs
          if (prod.nonInventoryCosts) {
            setNonInventoryCosts(prod.nonInventoryCosts.map(item => ({
              itemId: item.itemId,
              name: item.item?.name || '',
              cost: Number(item.cost || 0)
            })));
          }

          // Set Stages
          if (prod.stages) {
            setStages(prod.stages.map(item => ({
              stageId: item.stageId,
              name: item.stage?.name || '',
              months: item.months || 0,
              days: item.days || 0,
              hours: item.hours || 0,
              minutes: item.minutes || 0,
              sortOrder: item.sortOrder || 0
            })));
          }
        } else {
          // Auto generate next code
          const listRes = await api.get('/products?includeDeleted=true');
          const products = listRes.data || [];
          let maxNum = 0;
          products.forEach(p => {
            const m = p.code && p.code.match(/^FP-(\d+)$/);
            if (m) {
              const n = parseInt(m[1], 10);
              if (n > maxNum) maxNum = n;
            }
          });
          setCode(`FP-${String(maxNum + 1).padStart(6, '0')}`);

          // Load tax configurations to pre-populate CGST, SGST, IGST
          const saved = localStorage.getItem('kulfi_erp_tax_settings');
          if (saved) {
            try {
              const parsed = JSON.parse(saved);
              if (parsed.taxes && Array.isArray(parsed.taxes)) {
                const cgstTax = parsed.taxes.find(t => t.name.toUpperCase() === 'CGST');
                const sgstTax = parsed.taxes.find(t => t.name.toUpperCase() === 'SGST');
                const igstTax = parsed.taxes.find(t => t.name.toUpperCase() === 'IGST');
                if (cgstTax) setCgst(Number(cgstTax.rate));
                if (sgstTax) setSgst(Number(sgstTax.rate));
                if (igstTax) setIgst(Number(igstTax.rate));
              }
            } catch (e) {
              console.error('Error pre-populating tax in product', e);
            }
          }
        }
      } catch (err) {
        console.error(err);
        setError('Failed to load metadata. Please refresh.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [editId, isEditMode]);

  // BoM Handlers
  const handleAddRm = () => {
    if (!selectedRmId) return;
    if (bom.some(item => item.rmId === selectedRmId)) {
      const isDark = document.documentElement.classList.contains('dark');
      Swal.fire({
        title: `<span class="font-extrabold text-sm text-slate-800 dark:text-slate-100">Already Added</span>`,
        html: `<p class="text-xs text-slate-500 dark:text-slate-400 mt-1">This raw material is already added to BoM.</p>`,
        icon: 'warning',
        iconColor: '#f59e0b',
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3500,
        timerProgressBar: true,
        background: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)',
        color: isDark ? '#f8fafc' : '#0f172a',
        showClass: { popup: 'animate__animated animate__slideInRight animate__faster' },
        hideClass: { popup: 'animate__animated animate__fadeOutRight animate__faster' },
        customClass: {
          popup: 'rounded-2xl border border-amber-100 dark:border-amber-955 shadow-xl backdrop-blur-md p-4',
          timerProgressBar: 'bg-amber-500'
        }
      });
      return;
    }
    const rm = masters.rawMaterials.find(m => m.id === selectedRmId);
    if (!rm) return;

    setBom([...bom, {
      rmId: rm.id,
      name: rm.name,
      code: rm.code,
      unitPrice: Number(rm.ratePerUnit || 0),
      consumption: 1,
      totalCost: Number(rm.ratePerUnit || 0)
    }]);
    setSelectedRmId('');
  };

  const handleRmChange = (index, field, value) => {
    const updated = [...bom];
    const val = Number(value) || 0;
    updated[index][field] = val;
    if (field === 'consumption' || field === 'unitPrice') {
      updated[index].totalCost = updated[index].consumption * updated[index].unitPrice;
    }
    setBom(updated);
  };

  const handleRemoveRm = (index) => {
    setBom(bom.filter((_, i) => i !== index));
  };

  // Non Inventory Cost Handlers
  const handleAddNonInventory = () => {
    if (!selectedNonInventoryId) return;
    if (nonInventoryCosts.some(item => item.itemId === selectedNonInventoryId)) {
      const isDark = document.documentElement.classList.contains('dark');
      Swal.fire({
        title: `<span class="font-extrabold text-sm text-slate-800 dark:text-slate-100">Already Added</span>`,
        html: `<p class="text-xs text-slate-500 dark:text-slate-400 mt-1">This item is already added.</p>`,
        icon: 'warning',
        iconColor: '#f59e0b',
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3500,
        timerProgressBar: true,
        background: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)',
        color: isDark ? '#f8fafc' : '#0f172a',
        showClass: { popup: 'animate__animated animate__slideInRight animate__faster' },
        hideClass: { popup: 'animate__animated animate__fadeOutRight animate__faster' },
        customClass: {
          popup: 'rounded-2xl border border-amber-100 dark:border-amber-955 shadow-xl backdrop-blur-md p-4',
          timerProgressBar: 'bg-amber-500'
        }
      });
      return;
    }
    const item = masters.nonInventoryItems.find(n => n.id === selectedNonInventoryId);
    if (!item) return;

    setNonInventoryCosts([...nonInventoryCosts, {
      itemId: item.id,
      name: item.name,
      cost: Number(item.ratePerUnit || 0)
    }]);
    setSelectedNonInventoryId('');
  };

  const handleNonInventoryChange = (index, value) => {
    const updated = [...nonInventoryCosts];
    updated[index].cost = Number(value) || 0;
    setNonInventoryCosts(updated);
  };

  const handleRemoveNonInventory = (index) => {
    setNonInventoryCosts(nonInventoryCosts.filter((_, i) => i !== index));
  };

  // Production Stage Handlers
  const handleAddStage = () => {
    if (!selectedStageId) return;
    if (stages.some(item => item.stageId === selectedStageId)) {
      const isDark = document.documentElement.classList.contains('dark');
      Swal.fire({
        title: `<span class="font-extrabold text-sm text-slate-800 dark:text-slate-100">Already Added</span>`,
        html: `<p class="text-xs text-slate-500 dark:text-slate-400 mt-1">This production stage is already added.</p>`,
        icon: 'warning',
        iconColor: '#f59e0b',
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3500,
        timerProgressBar: true,
        background: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)',
        color: isDark ? '#f8fafc' : '#0f172a',
        showClass: { popup: 'animate__animated animate__slideInRight animate__faster' },
        hideClass: { popup: 'animate__animated animate__fadeOutRight animate__faster' },
        customClass: {
          popup: 'rounded-2xl border border-amber-100 dark:border-amber-955 shadow-xl backdrop-blur-md p-4',
          timerProgressBar: 'bg-amber-500'
        }
      });
      return;
    }
    const stage = masters.stages.find(s => s.id === selectedStageId);
    if (!stage) return;

    setStages([...stages, {
      stageId: stage.id,
      name: stage.name,
      months: 0,
      days: 0,
      hours: 0,
      minutes: 0,
      sortOrder: stages.length
    }]);
    setSelectedStageId('');
  };

  const handleStageTimeChange = (index, field, value) => {
    const updated = [...stages];
    updated[index][field] = Math.max(0, parseInt(value, 10) || 0);
    setStages(updated);
  };

  const handleRemoveStage = (index) => {
    setStages(stages.filter((_, i) => i !== index));
  };

  // Calculations
  const totalRmCost = bom.reduce((sum, item) => sum + Number(item.totalCost), 0);
  const totalNonInventoryCost = nonInventoryCosts.reduce((sum, item) => sum + Number(item.cost), 0);
  const totalCost = totalRmCost + totalNonInventoryCost;
  const salePrice = totalCost * (1 + Number(profitMargin) / 100);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const isDark = document.documentElement.classList.contains('dark');
    
    // Warn if duplicate exists
    const duplicate = nameMatches.find(p => p.name.toLowerCase() === name.toLowerCase());
    if (duplicate) {
      const result = await Swal.fire({
        title: '<span class="font-extrabold text-sm text-slate-800 dark:text-slate-100">Duplicate Name Detected</span>',
        html: `<p class="text-xs text-slate-500 dark:text-slate-400 mt-1">A Finished Product named <strong>"${name}"</strong> already exists (${duplicate.code}). Do you want to proceed and save it anyway? (UOM or category may be different)</p>`,
        icon: 'warning',
        iconColor: '#f59e0b',
        showCancelButton: true,
        confirmButtonColor: '#3085d6',
        cancelButtonColor: '#d33',
        confirmButtonText: 'Yes, save anyway',
        cancelButtonText: 'Cancel',
        background: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)',
        color: isDark ? '#f8fafc' : '#0f172a',
        customClass: {
          popup: 'rounded-2xl border border-amber-100 dark:border-amber-955 shadow-xl backdrop-blur-md p-6'
        }
      });
      if (!result.isConfirmed) {
        return;
      }
    }

    if (!name) {
      Swal.fire({
        title: `<span class="font-extrabold text-sm text-slate-800 dark:text-slate-100">Validation Error</span>`,
        html: `<p class="text-xs text-slate-500 dark:text-slate-400 mt-1">Product name is required</p>`,
        icon: 'error',
        iconColor: '#ef4444',
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3500,
        timerProgressBar: true,
        background: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)',
        color: isDark ? '#f8fafc' : '#0f172a',
        showClass: { popup: 'animate__animated animate__slideInRight animate__faster' },
        hideClass: { popup: 'animate__animated animate__fadeOutRight animate__faster' },
        customClass: {
          popup: 'rounded-2xl border border-red-100 dark:border-red-955 shadow-xl backdrop-blur-md p-4',
          timerProgressBar: 'bg-red-500'
        }
      });
      return;
    }
    if (!categoryId) {
      Swal.fire({
        title: `<span class="font-extrabold text-sm text-slate-800 dark:text-slate-100">Validation Error</span>`,
        html: `<p class="text-xs text-slate-500 dark:text-slate-400 mt-1">Category is required</p>`,
        icon: 'error',
        iconColor: '#ef4444',
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3500,
        timerProgressBar: true,
        background: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)',
        color: isDark ? '#f8fafc' : '#0f172a',
        showClass: { popup: 'animate__animated animate__slideInRight animate__faster' },
        hideClass: { popup: 'animate__animated animate__fadeOutRight animate__faster' },
        customClass: {
          popup: 'rounded-2xl border border-red-100 dark:border-red-955 shadow-xl backdrop-blur-md p-4',
          timerProgressBar: 'bg-red-500'
        }
      });
      return;
    }
    if (!unitId) {
      Swal.fire({
        title: `<span class="font-extrabold text-sm text-slate-800 dark:text-slate-100">Validation Error</span>`,
        html: `<p class="text-xs text-slate-500 dark:text-slate-400 mt-1">Unit of Measure is required</p>`,
        icon: 'error',
        iconColor: '#ef4444',
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3500,
        timerProgressBar: true,
        background: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)',
        color: isDark ? '#f8fafc' : '#0f172a',
        showClass: { popup: 'animate__animated animate__slideInRight animate__faster' },
        hideClass: { popup: 'animate__animated animate__fadeOutRight animate__faster' },
        customClass: {
          popup: 'rounded-2xl border border-red-100 dark:border-red-955 shadow-xl backdrop-blur-md p-4',
          timerProgressBar: 'bg-red-500'
        }
      });
      return;
    }

    setSaving(true);
    setError(null);

    const payload = {
      name,
      categoryId,
      unitId,
      stockMethod,
      openingStock: Number(openingStock),
      alertLevel: Number(alertLevel),
      hsnCode,
      profitMargin: Number(profitMargin),
      cgst: Number(cgst),
      sgst: Number(sgst),
      igst: Number(igst),
      bom: bom.map(b => ({
        rmId: b.rmId,
        consumption: Number(b.consumption),
        unitPrice: Number(b.unitPrice),
        totalCost: Number(b.totalCost)
      })),
      nonInventoryCosts: nonInventoryCosts.map(n => ({
        itemId: n.itemId,
        cost: Number(n.cost)
      })),
      stages: stages.map((s, idx) => ({
        stageId: s.stageId,
        months: Number(s.months),
        days: Number(s.days),
        hours: Number(s.hours),
        minutes: Number(s.minutes),
        sortOrder: idx
      }))
    };

    try {
      let savedData;
      if (isEditMode) {
        savedData = (await api.put(`/products/${editId}`, payload)).data;
      } else {
        savedData = (await api.post('/products', payload)).data;
      }
      queryClient.invalidateQueries({ queryKey: ['products'] });
      Swal.fire({
        title: `<span class="font-extrabold text-sm text-slate-800 dark:text-slate-100">${isEditMode ? 'Product Updated!' : 'Product Created!'}</span>`,
        html: `<p class="text-xs text-slate-500 dark:text-slate-400 mt-1">${isEditMode ? `Product "${savedData?.name || name}" has been updated.` : `Product "${savedData?.name || name}" has been added with code ${savedData?.code || code}.`}</p>`,
        icon: 'success',
        iconColor: '#10b981',
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3500,
        timerProgressBar: true,
        background: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)',
        color: isDark ? '#f8fafc' : '#0f172a',
        showClass: { popup: 'animate__animated animate__slideInRight animate__faster' },
        hideClass: { popup: 'animate__animated animate__fadeOutRight animate__faster' },
        customClass: {
          popup: 'rounded-2xl border border-emerald-100 dark:border-emerald-950 shadow-xl backdrop-blur-md p-4',
          timerProgressBar: 'bg-emerald-500'
        }
      });
      onBack();
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Failed to save product. Please verify fields.');
      Swal.fire({
        title: `<span class="font-extrabold text-sm text-slate-800 dark:text-slate-100">Save Failed</span>`,
        html: `<p class="text-xs text-slate-500 dark:text-slate-400 mt-1">${err.response?.data?.error || 'Failed to save product. Please verify fields.'}</p>`,
        icon: 'error',
        iconColor: '#ef4444',
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3500,
        timerProgressBar: true,
        background: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)',
        color: isDark ? '#f8fafc' : '#0f172a',
        showClass: { popup: 'animate__animated animate__slideInRight animate__faster' },
        hideClass: { popup: 'animate__animated animate__fadeOutRight animate__faster' },
        customClass: {
          popup: 'rounded-2xl border border-red-100 dark:border-red-950 shadow-xl backdrop-blur-md p-4',
          timerProgressBar: 'bg-red-500'
        }
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 flex flex-col items-center justify-center space-y-4">
        <Loader2 className="w-10 h-10 animate-spin text-indigo-500" />
        <p className="text-sm text-slate-500 dark:text-slate-400">Loading product information...</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 text-slate-500" />
        </button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            {isEditMode ? 'Edit Product' : 'Add Product'}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Configure raw materials, stages, and tax profiles for production.
          </p>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-rose-50 dark:bg-rose-955/20 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-400">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-sm">Error</p>
            <p className="text-xs opacity-90">{error}</p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Core details */}
        <Card className="relative z-30 !overflow-visible dark:bg-slate-800 dark:border-slate-700 shadow-sm">
          <CardHeader className="pb-3 border-b dark:border-slate-700">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-450 flex items-center">
              <Package className="w-4 h-4 mr-1.5 text-indigo-500" /> Basic Details
            </h2>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
              <div className="space-y-1 relative">
                <label className="text-xs font-semibold text-slate-500 uppercase">Name *</label>
                <Input
                  required
                  placeholder="Name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="off"
                />
                {debouncedName.trim().length >= 1 && nameMatches.length > 0 && (
                  <div className="absolute z-[100] left-0 mt-1 w-[320px] md:w-[400px] max-w-[95vw] bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl overflow-hidden divide-y divide-slate-100 dark:divide-slate-800 animate__animated animate__fadeIn">
                    <div className="max-h-56 overflow-y-auto">
                      {nameMatches.map(p => (
                        <div 
                          key={p.id} 
                          onClick={() => {
                            setName(p.name);
                            setNameMatches([]);
                          }}
                          className="px-4 py-3 flex items-center justify-between hover:bg-indigo-50/70 dark:hover:bg-indigo-950/40 cursor-pointer transition-all duration-200 border-l-2 border-transparent hover:border-indigo-500"
                        >
                          <div className="flex flex-col gap-0.5">
                            <span className="font-semibold text-slate-800 dark:text-slate-250 text-sm">
                              {p.name}
                            </span>
                            <span className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">
                              Category: <span className="text-slate-600 dark:text-slate-450">{p.category?.name || 'N/A'}</span>
                            </span>
                          </div>
                          <div className="flex flex-col items-end gap-1 shrink-0 ml-4">
                            <span className="font-mono text-[10px] font-bold px-2 py-0.5 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-md border border-indigo-100 dark:border-indigo-900">
                              {p.code}
                            </span>
                            <span className="text-[10px] text-slate-400 dark:text-slate-500 uppercase font-semibold">
                              UOM: {p.unit?.abbreviation || p.unit?.name || 'N/A'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500 uppercase">Code *</label>
                <Input
                  required
                  readOnly
                  placeholder="Code"
                  className="bg-slate-50 dark:bg-slate-900 font-mono text-slate-505 cursor-not-allowed"
                  value={code}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500 uppercase">Category *</label>
                <select
                  required
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-205 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 h-10"
                >
                  <option value="">Select Category</option>
                  {masters.categories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500 uppercase">Unit *</label>
                <UomSelect
                  value={unitId}
                  onChange={(val) => setUnitId(val)}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-505 uppercase">Stock Method *</label>
                <select
                  required
                  value={stockMethod}
                  onChange={(e) => setStockMethod(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-205 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 h-10"
                >
                  <option value="FIFO">FIFO (First In First Out)</option>
                  <option value="LIFO">LIFO (Last In First Out)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-505 uppercase">Opening Stock</label>
                <Input
                  type="number"
                  placeholder="0"
                  min="0"
                  value={openingStock}
                  onChange={(e) => setOpeningStock(Number(e.target.value) || 0)}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-505 uppercase">Alert Level</label>
                <Input
                  type="number"
                  placeholder="0"
                  min="0"
                  value={alertLevel}
                  onChange={(e) => setAlertLevel(Number(e.target.value) || 0)}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-505 uppercase">HSN Code</label>
                <HsnSelect
                  value={hsnCode}
                  onChange={setHsnCode}
                  onSelect={handleHsnSelect}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* BoM Raw Material Consumption */}
        <Card className="relative z-20 dark:bg-slate-800 dark:border-slate-700">
          <CardHeader className="pb-3 border-b dark:border-slate-700">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-450 flex items-center">
                <Settings className="w-4 h-4 mr-1.5 text-indigo-500" /> Raw Material Consumption and Cost (BoM)
              </h2>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <select
                  value={selectedRmId}
                  onChange={(e) => setSelectedRmId(e.target.value)}
                  className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-sm text-slate-700 dark:text-slate-200 focus:outline-none"
                >
                  <option value="">Raw Material *</option>
                  {masters.rawMaterials.map(rm => (
                    <option key={rm.id} value={rm.id}>{rm.name} ({rm.code})</option>
                  ))}
                </select>
                <Button type="button" size="sm" onClick={handleAddRm} className="bg-indigo-500 hover:bg-indigo-600">
                  <Plus className="w-4 h-4" /> Add
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 dark:bg-slate-900/40 text-slate-500 text-xs uppercase font-semibold">
                  <tr>
                    <th className="px-6 py-3 w-16 text-center">SN</th>
                    <th className="px-6 py-3">Raw Material(Code)</th>
                    <th className="px-6 py-3 text-right">Unit Price</th>
                    <th className="px-6 py-3 text-right w-40">Consumption *</th>
                    <th className="px-6 py-3 text-right">Total Cost</th>
                    <th className="px-6 py-3 text-center w-24">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {bom.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-8 text-center text-slate-450 dark:text-slate-400">
                        No raw materials selected. Pick one above to add to BoM.
                      </td>
                    </tr>
                  ) : (
                    bom.map((item, idx) => (
                      <tr key={item.rmId} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/10">
                        <td className="px-6 py-3 text-center font-medium text-slate-400">{idx + 1}</td>
                        <td className="px-6 py-3 font-semibold text-slate-800 dark:text-white">
                          {item.name} <span className="text-xs text-slate-450">({item.code})</span>
                        </td>
                        <td className="px-6 py-3 text-right font-mono text-slate-650 dark:text-slate-350">
                          ₹{item.unitPrice.toFixed(2)}
                          <Info className="inline w-3.5 h-3.5 ml-1 text-slate-400 cursor-help" title="Standard material procurement price" />
                        </td>
                        <td className="px-6 py-3 text-right">
                          <Input
                            type="number"
                            step="0.0001"
                            min="0.0001"
                            className="text-right"
                            value={item.consumption}
                            onChange={(e) => handleRmChange(idx, 'consumption', e.target.value)}
                          />
                        </td>
                        <td className="px-6 py-3 text-right font-bold text-slate-900 dark:text-white font-mono">
                          ₹{item.totalCost.toFixed(2)}
                        </td>
                        <td className="px-6 py-3 text-center">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10"
                            onClick={() => handleRemoveRm(idx)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="p-4 border-t dark:border-slate-700 bg-slate-50/30 dark:bg-slate-900/10 flex justify-end">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-slate-500 dark:text-slate-450 uppercase">Total Raw Material Cost *</span>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-semibold">INR</span>
                  <Input
                    readOnly
                    className="pl-12 font-bold font-mono text-right w-44 bg-slate-50 dark:bg-slate-900 cursor-not-allowed"
                    value={totalRmCost.toFixed(2)}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Non Inventory Cost */}
        <Card className="dark:bg-slate-800 dark:border-slate-700">
          <CardHeader className="pb-3 border-b dark:border-slate-700">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-450 flex items-center">
                <DollarSign className="w-4 h-4 mr-1.5 text-indigo-500" /> Non Inventory Cost
              </h2>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <select
                  value={selectedNonInventoryId}
                  onChange={(e) => setSelectedNonInventoryId(e.target.value)}
                  className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-sm text-slate-700 dark:text-slate-200 focus:outline-none"
                >
                  <option value="">Non Inventory Item</option>
                  {masters.nonInventoryItems.map(item => (
                    <option key={item.id} value={item.id}>{item.name}</option>
                  ))}
                </select>
                <Button type="button" size="sm" onClick={handleAddNonInventory} className="bg-indigo-500 hover:bg-indigo-600">
                  <Plus className="w-4 h-4" /> Add
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 dark:bg-slate-900/40 text-slate-500 text-xs uppercase font-semibold">
                  <tr>
                    <th className="px-6 py-3 w-16 text-center">SN</th>
                    <th className="px-6 py-3">Non Inventory Item</th>
                    <th className="px-6 py-3 text-right w-44">Non Inventory Cost *</th>
                    <th className="px-6 py-3 text-center w-24">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {nonInventoryCosts.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-8 text-center text-slate-450 dark:text-slate-400">
                        No non-inventory cost components. Click Add above to register utility/labour costs.
                      </td>
                    </tr>
                  ) : (
                    nonInventoryCosts.map((item, idx) => (
                      <tr key={item.itemId} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/10">
                        <td className="px-6 py-3 text-center font-medium text-slate-400">{idx + 1}</td>
                        <td className="px-6 py-3 font-semibold text-slate-800 dark:text-white">{item.name}</td>
                        <td className="px-6 py-3 text-right">
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            className="text-right font-mono"
                            value={item.cost}
                            onChange={(e) => handleNonInventoryChange(idx, e.target.value)}
                          />
                        </td>
                        <td className="px-6 py-3 text-center">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10"
                            onClick={() => handleRemoveNonInventory(idx)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="p-4 border-t dark:border-slate-700 bg-slate-50/30 dark:bg-slate-900/10 flex justify-end">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-slate-500 dark:text-slate-450 uppercase">Total Non Inventory Cost *</span>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-semibold">INR</span>
                  <Input
                    readOnly
                    className="pl-12 font-bold font-mono text-right w-44 bg-slate-50 dark:bg-slate-900 cursor-not-allowed"
                    value={totalNonInventoryCost.toFixed(2)}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Cost Matrix, Taxes and Selling Price */}
        <Card className="dark:bg-slate-800 dark:border-slate-700">
          <CardHeader className="pb-3 border-b dark:border-slate-700">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-450 flex items-center">
              <Percent className="w-4 h-4 mr-1.5 text-indigo-500" /> Cost Summaries and Taxes
            </h2>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-505 uppercase">Total Cost *</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-medium">₹</span>
                  <Input
                    readOnly
                    className="pl-7 font-bold font-mono bg-slate-50 dark:bg-slate-900 cursor-not-allowed text-indigo-600 dark:text-indigo-400"
                    value={totalCost.toFixed(2)}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-505 uppercase">Profit Margin (%)</label>
                <Input
                  type="number"
                  step="0.01"
                  value={profitMargin}
                  onChange={(e) => setProfitMargin(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-505 uppercase">CGST (%)</label>
                <Input
                  type="number"
                  step="0.01"
                  value={cgst}
                  onChange={(e) => setCgst(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-505 uppercase">SGST (%)</label>
                <Input
                  type="number"
                  step="0.01"
                  value={sgst}
                  onChange={(e) => setSgst(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-505 uppercase">IGST (%)</label>
                <Input
                  type="number"
                  step="0.01"
                  value={igst}
                  onChange={(e) => setIgst(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-505 uppercase">Sale Price *</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-medium">₹</span>
                  <Input
                    readOnly
                    className="pl-7 font-bold font-mono bg-indigo-50/50 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400 cursor-not-allowed"
                    value={salePrice.toFixed(2)}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Production Stage */}
        <Card className="dark:bg-slate-800 dark:border-slate-700">
          <CardHeader className="pb-3 border-b dark:border-slate-700">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-450 flex items-center">
                <Clock className="w-4 h-4 mr-1.5 text-indigo-500" /> Production Stage
              </h2>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <select
                  value={selectedStageId}
                  onChange={(e) => setSelectedStageId(e.target.value)}
                  className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-sm text-slate-700 dark:text-slate-200 focus:outline-none"
                >
                  <option value="">Production Stage</option>
                  {masters.stages.map(stage => (
                    <option key={stage.id} value={stage.id}>{stage.name}</option>
                  ))}
                </select>
                <Button type="button" size="sm" onClick={handleAddStage} className="bg-indigo-500 hover:bg-indigo-600">
                  <Plus className="w-4 h-4" /> Add Stage
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 dark:bg-slate-900/40 text-slate-500 text-xs uppercase font-semibold">
                  <tr>
                    <th className="px-6 py-3 w-16 text-center">SN</th>
                    <th className="px-6 py-3">Stage</th>
                    <th className="px-6 py-3 text-center w-96">Required Time</th>
                    <th className="px-6 py-3 text-center w-24">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {stages.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-8 text-center text-slate-450 dark:text-slate-400">
                        No processing stages defined. Add processing stages from the selector above.
                      </td>
                    </tr>
                  ) : (
                    stages.map((stage, idx) => (
                      <tr key={stage.stageId} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/10">
                        <td className="px-6 py-3 text-center font-medium text-slate-400">{idx + 1}</td>
                        <td className="px-6 py-3 font-semibold text-slate-800 dark:text-white">{stage.name}</td>
                        <td className="px-6 py-3">
                          <div className="flex gap-2 items-center justify-center">
                            <div className="flex items-center gap-1">
                              <Input
                                type="number"
                                className="w-16 text-center font-mono"
                                min="0"
                                value={stage.months}
                                onChange={(e) => handleStageTimeChange(idx, 'months', e.target.value)}
                              />
                              <span className="text-2xs uppercase text-slate-400">M</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Input
                                type="number"
                                className="w-16 text-center font-mono"
                                min="0"
                                value={stage.days}
                                onChange={(e) => handleStageTimeChange(idx, 'days', e.target.value)}
                              />
                              <span className="text-2xs uppercase text-slate-400">D</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Input
                                type="number"
                                className="w-16 text-center font-mono"
                                min="0"
                                value={stage.hours}
                                onChange={(e) => handleStageTimeChange(idx, 'hours', e.target.value)}
                              />
                              <span className="text-2xs uppercase text-slate-400">H</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Input
                                type="number"
                                className="w-16 text-center font-mono"
                                min="0"
                                value={stage.minutes}
                                onChange={(e) => handleStageTimeChange(idx, 'minutes', e.target.value)}
                              />
                              <span className="text-2xs uppercase text-slate-400">Min</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-3 text-center">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10"
                            onClick={() => handleRemoveStage(idx)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Action buttons */}
        <div className="flex items-center gap-3">
          <Button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md transition-colors"
          >
            {saving ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</>
            ) : (
              <><Save className="w-4 h-4 mr-2" /> Submit</>
            )}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={onBack}
            className="px-6 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold rounded-xl"
          >
            Back
          </Button>
        </div>
      </form>
    </div>
  );
}

export default function ProductListPage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [view, setView] = useState('list'); // 'list' | 'add' | 'edit'
  const [editId, setEditId] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const itemsPerPage = 10;

  const { data: products, isLoading } = useQuery({
    queryKey: ['products'],
    queryFn: async () => (await api.get('/products')).data
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => await api.delete(`/products/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['products'] })
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids) => {
      await Promise.all(ids.map(id => api.delete(`/products/${id}`)));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      setSelectedIds([]);
      const isDark = document.documentElement.classList.contains('dark');
      Swal.fire({
        title: '<span class="font-extrabold text-sm text-slate-800 dark:text-slate-100">Deleted!</span>',
        html: '<p class="text-xs text-slate-500 dark:text-slate-400 mt-1">Selected finished products have been deleted successfully.</p>',
        icon: 'success',
        iconColor: '#10b981',
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3500,
        timerProgressBar: true,
        background: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)',
        color: isDark ? '#f8fafc' : '#0f172a',
        showClass: { popup: 'animate__animated animate__slideInRight animate__faster' },
        hideClass: { popup: 'animate__animated animate__fadeOutRight animate__faster' },
        customClass: {
          popup: 'rounded-2xl border border-emerald-100 dark:border-emerald-950 shadow-xl backdrop-blur-md p-4',
          timerProgressBar: 'bg-emerald-500'
        }
      });
    },
    onError: (err) => {
      const isDark = document.documentElement.classList.contains('dark');
      Swal.fire({
        title: '<span class="font-extrabold text-sm text-slate-800 dark:text-slate-100">Operation Failed</span>',
        html: `<p class="text-xs text-slate-500 dark:text-slate-400 mt-1">${err.response?.data?.error || 'Failed to delete selected products.'}</p>`,
        icon: 'error',
        iconColor: '#ef4444',
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3500,
        background: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)',
        color: isDark ? '#f8fafc' : '#0f172a',
        customClass: {
          popup: 'rounded-2xl border border-red-100 dark:border-red-950 shadow-xl backdrop-blur-md p-4',
          timerProgressBar: 'bg-red-500'
        }
      });
    }
  });

  const handleDelete = (id) => {
    const isDark = document.documentElement.classList.contains('dark');
    Swal.fire({
      title: '<span class="font-extrabold text-sm text-slate-800 dark:text-slate-100">Delete Product?</span>',
      html: '<p class="text-xs text-slate-500 dark:text-slate-400 mt-1">Are you sure you want to delete this finished product? This action cannot be undone.</p>',
      icon: 'warning',
      iconColor: '#f59e0b',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Yes, delete it!',
      cancelButtonText: 'Cancel',
      background: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)',
      color: isDark ? '#f8fafc' : '#0f172a',
      customClass: {
        popup: 'rounded-2xl border border-amber-100 dark:border-amber-950 shadow-xl backdrop-blur-md p-6'
      }
    }).then((result) => {
      if (result.isConfirmed) {
        deleteMutation.mutate(id, {
          onSuccess: () => {
            Swal.fire({
              title: '<span class="font-extrabold text-sm text-slate-800 dark:text-slate-100">Deleted!</span>',
              html: '<p class="text-xs text-slate-500 dark:text-slate-400 mt-1">The finished product has been deleted.</p>',
              icon: 'success',
              iconColor: '#10b981',
              toast: true,
              position: 'top-end',
              showConfirmButton: false,
              timer: 3500,
              background: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)',
              color: isDark ? '#f8fafc' : '#0f172a',
              customClass: {
                popup: 'rounded-2xl border border-emerald-100 dark:border-emerald-950 shadow-xl backdrop-blur-md p-4'
              }
            });
          }
        });
      }
    });
  };

  const handleSelectRow = (id) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleSelectAll = (visibleItems) => {
    const visibleIds = visibleItems.map(item => item.id);
    const allSelected = visibleIds.every(id => selectedIds.includes(id));
    if (allSelected) {
      setSelectedIds(prev => prev.filter(id => !visibleIds.includes(id)));
    } else {
      setSelectedIds(prev => Array.from(new Set([...prev, ...visibleIds])));
    }
  };

  const handleBulkDelete = () => {
    const isDark = document.documentElement.classList.contains('dark');
    Swal.fire({
      title: '<span class="font-extrabold text-sm text-slate-800 dark:text-slate-100">Bulk Delete Products?</span>',
      html: `<p class="text-xs text-slate-500 dark:text-slate-400 mt-1">Are you sure you want to delete the ${selectedIds.length} selected finished products? This action cannot be undone.</p>`,
      icon: 'warning',
      iconColor: '#f59e0b',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Yes, delete selected!',
      cancelButtonText: 'Cancel',
      background: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)',
      color: isDark ? '#f8fafc' : '#0f172a',
      customClass: {
        popup: 'rounded-2xl border border-amber-100 dark:border-amber-950 shadow-xl backdrop-blur-md p-6'
      }
    }).then((result) => {
      if (result.isConfirmed) {
        bulkDeleteMutation.mutate(selectedIds);
      }
    });
  };

  const filtered = products?.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.code.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];
  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const isAllVisibleSelected = paginated.length > 0 && paginated.every(item => selectedIds.includes(item.id));
  const isSomeVisibleSelected = paginated.some(item => selectedIds.includes(item.id)) && !isAllVisibleSelected;

  if (isLoading) return <div className="p-8"><Skeleton className="h-[400px] w-full" /></div>;

  if (view !== 'list') {
    return <ProductForm editId={editId} onBack={() => setView('list')} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Package className="w-6 h-6 text-indigo-500" /> Finished Products
          </h1>
          <p className="text-sm text-slate-505 dark:text-slate-400 mt-1">
            Manage finished products, bills of materials (BOM), production stages, and pricing.
          </p>
        </div>
        <button 
          onClick={() => { setEditId(null); setView('add'); }}
          className="flex items-center px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold transition-all shadow-sm shadow-indigo-500/10"
        >
          <Plus className="w-4 h-4 mr-2" /> Add Product
        </button>
      </div>

      {/* Premium selection banner */}
      {selectedIds.length > 0 && (
        <div className="bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-150 dark:border-indigo-900 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm animate__animated animate__fadeIn">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-indigo-600 text-white font-bold text-sm shadow-md shadow-indigo-500/20">
              {selectedIds.length}
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900 dark:text-white">Products Selected</p>
              <p className="text-xs text-slate-505 dark:text-slate-400">Perform bulk actions on the selected products.</p>
            </div>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              onClick={() => setSelectedIds([])}
              className="px-4 py-2 text-xs font-semibold text-slate-605 dark:text-slate-350 hover:bg-slate-105 dark:hover:bg-slate-800 rounded-xl transition-all border border-slate-200 dark:border-slate-700"
            >
              Clear Selection
            </button>
            <button
              onClick={handleBulkDelete}
              className="flex items-center px-4 py-2 bg-red-600 hover:bg-red-750 text-white rounded-xl text-xs font-bold transition-all shadow-sm"
            >
              <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Delete Selected ({selectedIds.length})
            </button>
          </div>
        </div>
      )}

      <Card className="dark:bg-[#111827] dark:border-slate-800 shadow-sm">
        <CardContent className="p-0">
          <div className="p-4 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 border-b dark:border-slate-700">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input 
                type="text" 
                placeholder="Search products by code or name..." 
                value={searchTerm} 
                onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }} 
                className="w-full pl-9 pr-4 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-sm dark:bg-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" 
              />
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50 dark:bg-slate-800/50">
                <TableRow className="dark:border-slate-700">
                  <TableHead className="w-[50px] text-center">
                    <TableCheckbox
                      checked={isAllVisibleSelected}
                      indeterminate={isSomeVisibleSelected}
                      onChange={() => handleSelectAll(paginated)}
                    />
                  </TableHead>
                  <TableHead className="w-[120px]">Code</TableHead>
                  <TableHead>Product Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead>HSN Code</TableHead>
                  <TableHead className="text-right">BOM RM Cost</TableHead>
                  <TableHead className="text-right">Total Cost</TableHead>
                  <TableHead className="text-right text-indigo-600 dark:text-indigo-400">Sale Price</TableHead>
                  <TableHead className="text-center w-[120px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-12 text-slate-400 dark:text-slate-500">
                      No finished products found. Get started by clicking "Add Product"!
                    </TableCell>
                  </TableRow>
                ) : (
                  paginated.map((item) => (
                    <TableRow key={item.id} className="dark:border-slate-700 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                      <TableCell className="text-center">
                        <TableCheckbox
                          checked={selectedIds.includes(item.id)}
                          onChange={() => handleSelectRow(item.id)}
                        />
                      </TableCell>
                      <TableCell className="font-mono text-xs font-semibold text-slate-500 dark:text-slate-400">{item.code}</TableCell>
                      <TableCell className="font-medium text-slate-900 dark:text-slate-100">{item.name}</TableCell>
                      <TableCell>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border dark:border-slate-700">
                          <Tag className="w-3 h-3 mr-1 text-slate-400" /> {item.category?.name || 'N/A'}
                        </span>
                      </TableCell>
                      <TableCell className="text-slate-600 dark:text-slate-400 font-medium">{item.unit?.abbreviation || item.unit?.name || item.unitId || 'N/A'}</TableCell>
                      <TableCell className="font-mono text-xs text-slate-600 dark:text-slate-400">{item.hsnCode || '—'}</TableCell>
                      <TableCell className="text-right font-mono text-xs text-slate-500">₹{parseFloat(item.totalRawMaterialCost || 0).toFixed(2)}</TableCell>
                      <TableCell className="text-right font-mono text-xs text-slate-650 dark:text-slate-350">₹{parseFloat(item.totalCost || 0).toFixed(2)}</TableCell>
                      <TableCell className="text-right font-mono text-sm font-semibold text-indigo-600 dark:text-indigo-400">₹{parseFloat(item.salePrice || 0).toFixed(2)}</TableCell>
                      <TableCell className="text-center space-x-2">
                        <button 
                          onClick={() => { setEditId(item.id); setView('edit'); }}
                          className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 transition-colors"
                          title="Edit Product"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleDelete(item.id)} 
                          className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                          title="Delete Product"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className="p-4 border-t dark:border-slate-700 flex flex-col sm:flex-row justify-between items-center gap-4 text-sm text-slate-500">
            <div>
              Showing {filtered.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filtered.length)} of {filtered.length} entries
            </div>
            <div className="flex space-x-1">
              <button 
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))} 
                disabled={currentPage === 1} 
                className="px-3 py-1 border rounded-lg bg-slate-55 dark:bg-slate-800 dark:border-slate-700 disabled:opacity-50"
              >
                Previous
              </button>
              {Array.from({ length: totalPages }).map((_, i) => (
                <button 
                  key={i} 
                  onClick={() => setCurrentPage(i + 1)} 
                  className={`px-3 py-1 border rounded-lg transition-colors ${currentPage === i + 1 ? 'bg-indigo-500 text-white border-indigo-500 font-semibold' : 'bg-slate-50 dark:bg-slate-800 dark:border-slate-700 text-slate-700 dark:text-slate-300'}`}
                >
                  {i + 1}
                </button>
              ))}
              <button 
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} 
                disabled={currentPage === totalPages || totalPages === 0} 
                className="px-3 py-1 border rounded-lg bg-slate-55 dark:bg-slate-800 dark:border-slate-700 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
