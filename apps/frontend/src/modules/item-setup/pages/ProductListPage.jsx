import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Swal from 'sweetalert2';
import {
  Edit, Trash2, Plus, Search, Tag, Package, DollarSign, Settings,
  ArrowLeft, Save, Loader2, AlertCircle, Info, Check, Percent, Clock, 
  X, Layers, Image as ImageIcon, Sparkles, ChevronRight, Eye, RefreshCw,
  PlusCircle, Sliders, ShieldAlert, TrendingUp, Grid, List as ListIcon,
  ChevronLeft, Award, HelpCircle, FileText, AlertTriangle,
  ArrowUpDown, ArrowUp, ArrowDown, RotateCcw, ChevronDown
} from 'lucide-react';
import { api } from '@/lib/axios';
import useAuthStore from '@/app/store/authStore';

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import SearchSelect from '@/components/ui/SearchSelect';
import HsnSelect from '@/components/forms/HsnSelect';
import { Pagination } from '@/components/ui/Pagination';

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

function UomSelect({ value, onChange, error }) {
  return (
    <SearchSelect
      value={value}
      onChange={onChange}
      options={UOM_OPTIONS}
      placeholder="Select UOM..."
      searchPlaceholder="Search UOM..."
      error={!!error}
      triggerClassName="text-sm border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-205"
    />
  );
}

// Custom Checkbox Component
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
        className={`w-3.5 h-3.5 rounded border flex items-center justify-center transition-all duration-150 group-hover:scale-105 shadow-3xs relative ${
          checked
            ? 'bg-indigo-600 border-indigo-600 text-white'
            : indeterminate
            ? 'bg-indigo-500 border-indigo-500 text-white'
            : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 group-hover:border-indigo-500'
        }`}
      >
        {checked ? (
          <Check className="w-2.5 h-2.5 text-white" strokeWidth={3.5} />
        ) : indeterminate ? (
          <div className="w-2 h-0.5 bg-white rounded-full"></div>
        ) : null}
      </div>
    </label>
  );
}

function ProductForm({ editId, onBack }) {
  const isEditMode = !!editId;
  const queryClient = useQueryClient();

  // Active form Step: 'basic' | 'recipe' | 'bom' | 'operations'
  const [activeTab, setActiveTab] = useState('basic');

  // Masters
  const [masters, setMasters] = useState({
    categories: [],
    units: [],
    stages: [],
    nonInventoryItems: [],
    rawMaterials: [],
    users: []
  });

  const getUomLabel = (unitId) => {
    if (!unitId) return 'units';
    const match = (masters.units || []).find(u => 
      u.id === unitId || 
      u.abbreviation.toLowerCase() === unitId.toLowerCase() || 
      u.name.toLowerCase() === unitId.toLowerCase()
    );
    return match ? match.abbreviation : unitId;
  };

  // State
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // Form Fields
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [debouncedName, setDebouncedName] = useState('');
  const [nameMatches, setNameMatches] = useState([]);

  const [categoryId, setCategoryId] = useState('');
  const [unitId, setUnitId] = useState('');
  const [stockMethod, setStockMethod] = useState('FIFO');
  const [openingStock, setOpeningStock] = useState(0);
  const [alertLevel, setAlertLevel] = useState(0);
  const [hsnCode, setHsnCode] = useState('');
  const [salePrice, setSalePrice] = useState(0);

  // SOP / Image fields
  const [expectedOutput, setExpectedOutput] = useState(100);
  const [sopSteps, setSopSteps] = useState([{ stepNumber: 1, instruction: '', tempTime: '', safetyNote: '' }]);
  const [imageUrl, setImageUrl] = useState('');
  const [isSopLocked, setIsSopLocked] = useState(false);
  const [sopHistory, setSopHistory] = useState([]);

  // BoM (Raw Material Consumption)
  const [bom, setBom] = useState([]);
  const [selectedRmId, setSelectedRmId] = useState('');

  // Non Inventory Cost
  const [nonInventoryCosts, setNonInventoryCosts] = useState([]);
  const [selectedNonInventoryId, setSelectedNonInventoryId] = useState('');

  // Totals & Taxes
  const [profitMargin, setProfitMargin] = useState(0);
  const [cgst, setCgst] = useState(0);
  const [sgst, setSgst] = useState(0);
  const [igst, setIgst] = useState(0);

  // Production Stages
  const [stages, setStages] = useState([]);
  const [selectedStageId, setSelectedStageId] = useState('');

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

  const handleHsnSelect = (item) => {
    setHsnCode(item.hsn_code);
    if (item.gst_rate) {
      const halfRate = Number(item.gst_rate) / 2;
      setCgst(halfRate);
      setSgst(halfRate);
      setIgst(Number(item.gst_rate));
    }
  };

  // Fetch masters and product details
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const mastersRes = await api.get('/products/masters');
        const mastersData = mastersRes.data || {};
        setMasters(mastersData);

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
          setSalePrice(Number(prod.salePrice || 0));
          
          setExpectedOutput(Number(prod.expectedOutput || 1));
          setSopSteps(prod.sopSteps || [{ stepNumber: 1, instruction: '', tempTime: '', safetyNote: '' }]);
          setImageUrl(prod.imageUrl || '');
          setIsSopLocked(!!prod.isSopLocked);
          setSopHistory(prod.sopHistory || []);

          if (prod.bom && Array.isArray(prod.bom)) {
            setBom(prod.bom.map(item => {
              const matchedRM = (mastersData.rawMaterials || []).find(m => m.id === item.rmId) || item.rawMaterial;
              const getLocalUomLabel = (uid) => {
                if (!uid) return 'units';
                const match = (mastersData.units || []).find(u => 
                  u.id === uid || 
                  (u.abbreviation && u.abbreviation.toLowerCase() === uid.toLowerCase()) || 
                  (u.name && u.name.toLowerCase() === uid.toLowerCase())
                );
                return match ? match.abbreviation : uid;
              };
              const rmObj = matchedRM || item.rawMaterial;
              const uomLabel = rmObj ? getLocalUomLabel(rmObj.consumptionUnit || rmObj.unitId) : 'units';
              const rawConsumption = Number(item.consumptionPerUnit || 0);

              return {
                rmId: item.rmId,
                name: item.rawMaterial?.name || matchedRM?.name || 'Raw Material',
                code: item.rawMaterial?.code || matchedRM?.code || '',
                unitPrice: Number(item.unitPrice || matchedRM?.ratePerUnit || 0),
                consumption: rawConsumption,
                totalCost: Number(item.totalCost || (rawConsumption * Number(item.unitPrice || 0)) || 0),
                currentStock: matchedRM ? Number(matchedRM.currentStock || 0) : 0,
                uomLabel
              };
            }));
          }

          if (prod.nonInventoryCosts && Array.isArray(prod.nonInventoryCosts)) {
            setNonInventoryCosts(prod.nonInventoryCosts.map(item => ({
              itemId: item.itemId,
              name: item.item?.name || (mastersData.nonInventoryItems || []).find(n => n.id === item.itemId)?.name || '',
              cost: Number(item.cost || 0)
            })));
          }

          if (prod.stages && Array.isArray(prod.stages)) {
            setStages(prod.stages.map(item => ({
              stageId: item.stageId,
              name: item.stage?.name || (mastersData.stages || []).find(s => s.id === item.stageId)?.name || '',
              months: item.months || 0,
              days: item.days || 0,
              hours: item.hours || 0,
              minutes: item.minutes || 0,
              sortOrder: item.sortOrder || 0
            })));
          }
        } else {
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

          const saved = localStorage.getItem('leonex_erp_tax_settings');
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
        setError('Failed to load product setup form parameters.');
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
        title: `<span class="font-extrabold text-sm text-slate-800 dark:text-slate-100">Already Assigned</span>`,
        text: 'This ingredient raw material is already assigned to BOM.',
        icon: 'warning',
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3500,
        background: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)',
        color: isDark ? '#f8fafc' : '#0f172a',
      });
      return;
    }
    const rm = masters.rawMaterials.find(m => m.id === selectedRmId);
    if (!rm) return;

    const uomLabel = getUomLabel(rm.consumptionUnit || rm.unitId);

    setBom([...bom, {
      rmId: rm.id,
      name: rm.name,
      code: rm.code,
      unitPrice: Number(rm.ratePerUnit || 0),
      consumption: 1,
      totalCost: Number(rm.ratePerUnit || 0),
      currentStock: Number(rm.currentStock || 0),
      uomLabel
    }]);
    setSelectedRmId('');
  };

  const handleRmQtyChange = (index, value) => {
    const updated = [...bom];
    const val = Number(value) || 0;
    updated[index].consumption = val;
    updated[index].totalCost = val * updated[index].unitPrice;
    setBom(updated);
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
        title: `<span class="font-bold text-sm">Already Added</span>`,
        text: 'This utility cost factor is already added.',
        icon: 'warning',
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3000
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
        title: `<span class="font-bold text-sm">Already Added</span>`,
        text: 'This stage is already added.',
        icon: 'warning',
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3000
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    const isDark = document.documentElement.classList.contains('dark');

    if (!name) {
      Swal.fire({ title: 'Validation Error', text: 'Product name is required', icon: 'error' });
      return;
    }
    if (!categoryId) {
      Swal.fire({ title: 'Validation Error', text: 'Category is required', icon: 'error' });
      return;
    }
    if (!unitId) {
      Swal.fire({ title: 'Validation Error', text: 'Unit is required', icon: 'error' });
      return;
    }

    setSaving(true);
    const payload = {
      name,
      categoryId,
      unitId,
      stockMethod,
      openingStock: Number(openingStock),
      alertLevel: Number(alertLevel),
      hsnCode,
      profitMargin: Number(profitMargin),
      salePrice: Number(salePrice),
      cgst: Number(cgst),
      sgst: Number(sgst),
      igst: Number(igst),
      bom: bom.map(b => ({
        rmId: b.rmId,
        consumption: Number(b.consumption || 0),
        unitPrice: Number(b.unitPrice || 0),
        totalCost: Number(b.totalCost || (Number(b.consumption || 0) * Number(b.unitPrice || 0)))
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
      })),
      expectedOutput: 1, // yield details asked at production batch level
      sopSteps,
      imageUrl,
      isSopLocked: isEditMode ? true : isSopLocked
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
        title: `<span class="font-extrabold text-sm text-slate-800 dark:text-slate-100">${isEditMode ? 'Product Updated' : 'Product Created'}</span>`,
        text: `Product details saved successfully under code ${savedData?.code || code}.`,
        icon: 'success',
        confirmButtonColor: '#4f46e5',
        background: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)',
        color: isDark ? '#f8fafc' : '#0f172a',
      });
      onBack();
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Failed to save product recipe details.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48 bg-slate-200 dark:bg-slate-800" />
        <Skeleton className="h-[400px] w-full bg-slate-200 dark:bg-slate-800" />
      </div>
    );
  }

  return (
    <div className="w-full max-w-full px-4 sm:px-6 lg:px-8 py-5 space-y-4 mx-auto transition-all duration-300 animate__animated animate__fadeIn">
      {/* Header bar */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-4 border-b border-slate-200 dark:border-slate-850">
        <div className="flex items-center space-x-3">
          <Button 
            variant="ghost" 
            onClick={onBack} 
            className="p-2 shrink-0 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors rounded-xl border border-slate-200 dark:border-slate-700"
          >
            <ArrowLeft className="w-5 h-5 text-slate-600 dark:text-slate-350" />
          </Button>
          <div>
            <h1 className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-white flex items-center">
              <Sparkles className="w-5 h-5 mr-2 text-indigo-605 dark:text-indigo-400" />
              {isEditMode ? `Edit Finished Product Spec: ${code}` : 'New Finished Product Formulation'}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">Configure ingredient recipe ratios and processing steps.</p>
          </div>
        </div>

        {/* Global Save Button in header */}
        <Button
          onClick={handleSubmit}
          disabled={saving}
          className="bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-700 text-white font-bold rounded-xl text-xs py-2.5 px-5 shadow-md hover:shadow-lg transition-all"
        >
          {saving ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Saving...</> : <><Save className="w-3.5 h-3.5 mr-1.5" /> Save Specs</>}
        </Button>
      </div>

      {/* Progress Wizard Tracker */}
      <div className="hidden sm:flex justify-between items-center bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-xs">
        {[
          { id: 'basic', step: 'Step 1', name: 'Product Spec' },
          { id: 'recipe', step: 'Step 2', name: 'SOP Guide' },
          { id: 'bom', step: 'Step 3', name: 'Ingredients BOM' },
          { id: 'operations', step: 'Step 4', name: 'Workflow Stages' }
        ].map((node, index) => (
          <React.Fragment key={node.id}>
            <button
              type="button"
              onClick={() => setActiveTab(node.id)}
              className="flex items-center gap-3 text-left focus:outline-none group"
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs transition-all ${
                activeTab === node.id 
                  ? 'bg-indigo-600 dark:bg-indigo-500 text-white shadow-md' 
                  : 'bg-white dark:bg-slate-800 border dark:border-slate-700 text-slate-500 group-hover:text-indigo-650'
              }`}>
                {index + 1}
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block font-bold uppercase">{node.step}</span>
                <span className={`text-xs font-bold ${activeTab === node.id ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-650 dark:text-slate-350'}`}>{node.name}</span>
              </div>
            </button>
            {index < 3 && <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-700" />}
          </React.Fragment>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        {/* Main Content Form Area */}
        <div className="lg:col-span-3 space-y-6">
          {/* Mobile responsive active selector */}
          <div className="flex sm:hidden overflow-x-auto gap-2 p-1 bg-slate-105 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
            {[
              { id: 'basic', label: '1. Specs' },
              { id: 'recipe', label: '2. SOP' },
              { id: 'bom', label: '3. BOM' },
              { id: 'operations', label: '4. Stages' }
            ].map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg shrink-0 transition-all ${
                  activeTab === tab.id
                    ? 'bg-indigo-600 dark:bg-indigo-500 text-white shadow-md'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* TAB 1: Basic Identity & Presentation */}
          {activeTab === 'basic' && (
            <Card className="bg-white dark:bg-slate-900 border border-slate-205 dark:border-slate-800 shadow-md">
              <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800/80">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-550 dark:text-slate-400 flex items-center">
                  <Package className="w-4 h-4 mr-1.5 text-indigo-500" /> General Specifications
                </h3>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-2xs font-bold text-slate-500 dark:text-slate-400 uppercase block">Product Name *</label>
                    <Input
                      required
                      placeholder="e.g. Vanilla Cup Container"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-850 dark:text-slate-100 rounded-xl focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-2xs font-bold text-slate-500 dark:text-slate-400 uppercase block">System Code *</label>
                    <Input readOnly value={code} className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 cursor-not-allowed font-mono font-bold text-slate-500 dark:text-slate-400 rounded-xl" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-2xs font-bold text-slate-500 dark:text-slate-400 uppercase block">Category *</label>
                    <select
                      required
                      value={categoryId}
                      onChange={(e) => setCategoryId(e.target.value)}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-xl focus:ring-indigo-500 focus:border-indigo-500 h-10 px-3 py-2 text-xs focus:outline-none"
                    >
                      <option value="">Select Category...</option>
                      {masters.categories.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-2xs font-bold text-slate-500 dark:text-slate-400 uppercase block">Unit of Sale *</label>
                    <UomSelect value={unitId} onChange={setUnitId} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-2xs font-bold text-slate-500 dark:text-slate-400 uppercase block">Stock Queue Method</label>
                    <select
                      value={stockMethod}
                      onChange={(e) => setStockMethod(e.target.value)}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-xl focus:ring-indigo-500 focus:border-indigo-500 h-10 px-3 py-2 text-xs focus:outline-none"
                    >
                      <option value="FIFO">FIFO (First In First Out)</option>
                      <option value="LIFO">LIFO (Last In First Out)</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-2xs font-bold text-slate-500 dark:text-slate-400 uppercase block">HSN Code</label>
                    <HsnSelect value={hsnCode} onChange={setHsnCode} onSelect={handleHsnSelect} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-2xs font-bold text-slate-500 dark:text-slate-400 uppercase block">Buffer Opening Stock</label>
                    <Input type="number" min="0" value={openingStock} onChange={(e) => setOpeningStock(Number(e.target.value) || 0)} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-850 dark:text-slate-100 rounded-xl focus:ring-indigo-500 focus:border-indigo-500" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-2xs font-bold text-slate-500 dark:text-slate-400 uppercase block">Min Level Threshold</label>
                    <Input type="number" min="0" value={alertLevel} onChange={(e) => setAlertLevel(Number(e.target.value) || 0)} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-850 dark:text-slate-100 rounded-xl focus:ring-indigo-500 focus:border-indigo-500" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-2xs font-bold text-slate-500 dark:text-slate-400 uppercase block text-indigo-600 dark:text-indigo-400">Sale Price (INR) *</label>
                    <Input type="number" min="0" step="0.01" value={salePrice} onChange={(e) => setSalePrice(Number(e.target.value) || 0)} className="bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800 text-slate-850 dark:text-slate-100 rounded-xl focus:ring-indigo-500 focus:border-indigo-500 font-bold" />
                  </div>
                </div>

                {/* Presentation Image */}
                <div className="border-t border-slate-100 dark:border-slate-800 pt-4">
                  <label className="text-2xs font-bold text-slate-550 dark:text-slate-400 uppercase block mb-2">Presentation Photo</label>
                  <div className="border-2 border-dashed border-slate-250 dark:border-slate-800 rounded-2xl p-4 text-center bg-slate-50/50 dark:bg-slate-950/20 flex flex-col items-center justify-center min-h-[140px] relative group overflow-hidden transition-all">
                    {imageUrl ? (
                      <>
                        <img src={imageUrl} alt="Product spec preview" className="max-h-[120px] object-contain rounded-xl shadow-xs" />
                        <button
                          type="button"
                          onClick={() => setImageUrl('')}
                          className="absolute top-2 right-2 p-1.5 bg-rose-500 hover:bg-rose-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </>
                    ) : (
                      <>
                        <ImageIcon className="w-8 h-8 text-slate-350 dark:text-slate-650 mb-2" />
                        <p className="text-2xs text-slate-550 dark:text-slate-450 mb-2">Upload presentation photo of the finished product</p>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const reader = new FileReader();
                              reader.onloadend = () => setImageUrl(reader.result);
                              reader.readAsDataURL(file);
                            }
                          }}
                          className="text-xs file:mr-4 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:bg-indigo-50 dark:file:bg-slate-800 file:text-indigo-700 dark:file:text-slate-200 hover:file:bg-indigo-105 dark:hover:file:bg-slate-700 text-slate-405 dark:text-slate-500 cursor-pointer"
                        />
                      </>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* TAB 2: Recipe SOP & Output */}
          {activeTab === 'recipe' && (
            <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-md">
              <CardHeader className="pb-3 border-b border-slate-105 dark:border-slate-805 flex flex-row items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center">
                  <Clock className="w-4 h-4 mr-1.5 text-indigo-500" /> Standard Operating Procedure (SOP)
                </h3>
                {isSopLocked ? (
                  <span className="px-2.5 py-0.5 bg-amber-50 dark:bg-amber-955/20 text-amber-700 dark:text-amber-400 text-2xs font-bold rounded-full border border-amber-205 dark:border-amber-900/50 flex items-center gap-1">
                    <Info className="w-3 h-3" /> Locked
                    <button
                      type="button"
                      onClick={() => setIsSopLocked(false)}
                      className="ml-1 text-3xs font-extrabold text-indigo-650 dark:text-indigo-400 hover:underline"
                    >
                      Unlock
                    </button>
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 bg-emerald-50 dark:bg-emerald-955/20 text-emerald-700 dark:text-emerald-450 text-2xs font-bold rounded-full border border-emerald-200 dark:border-emerald-900/50">
                    Editable
                  </span>
                )}
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <label className="text-2xs font-bold text-slate-500 dark:text-slate-400 uppercase block">Workflow Steps (Numbered recipe guide)</label>
                    {!isSopLocked && (
                      <Button
                        type="button"
                        onClick={() => setSopSteps([...sopSteps, { stepNumber: sopSteps.length + 1, instruction: '', tempTime: '', safetyNote: '' }])}
                        className="bg-indigo-600 hover:bg-indigo-750 dark:bg-indigo-500 dark:hover:bg-indigo-600 text-white font-bold rounded-xl text-xs py-1.5 px-4 transition-all"
                      >
                        <Plus className="w-3.5 h-3.5 mr-1" /> Add Step
                      </Button>
                    )}
                  </div>

                  <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
                    {sopSteps.map((step, idx) => (
                      <div key={idx} className="p-4 bg-slate-50/50 dark:bg-slate-950 border border-slate-105 dark:border-slate-850 rounded-2xl space-y-2.5 relative group">
                        <div className="flex items-center justify-between text-2xs font-extrabold text-indigo-600 dark:text-indigo-400">
                          <span>Step #{idx + 1}</span>
                          {!isSopLocked && (
                            <button
                              type="button"
                              onClick={() => setSopSteps(sopSteps.filter((_, s) => s !== idx))}
                              className="text-rose-500 opacity-0 group-hover:opacity-100 hover:scale-110 transition-all"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                        <Input
                          placeholder="Action instruction step details..."
                          disabled={isSopLocked}
                          value={step.instruction}
                          onChange={(e) => {
                            const updated = [...sopSteps];
                            updated[idx].instruction = e.target.value;
                            setSopSteps(updated);
                          }}
                          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-850 dark:text-slate-100 rounded-xl"
                        />
                        <div className="grid grid-cols-2 gap-3 text-2xs">
                          <Input
                            placeholder="Temp / Time (e.g. Cook at 90°C for 15 mins)"
                            disabled={isSopLocked}
                            value={step.tempTime || ''}
                            onChange={(e) => {
                              const updated = [...sopSteps];
                              updated[idx].tempTime = e.target.value;
                              setSopSteps(updated);
                            }}
                            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-850 dark:text-slate-100 rounded-xl"
                          />
                          <Input
                            placeholder="Safety hazard notes / Protective gear info"
                            disabled={isSopLocked}
                            value={step.safetyNote || ''}
                            onChange={(e) => {
                              const updated = [...sopSteps];
                              updated[idx].safetyNote = e.target.value;
                              setSopSteps(updated);
                            }}
                            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-850 dark:text-slate-100 rounded-xl"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Recipe History archives */}
                {sopHistory.length > 0 && (
                  <div className="border-t border-slate-205 dark:border-slate-800 pt-4 space-y-2 text-xs">
                    <label className="font-bold text-slate-405 uppercase block">Archived SOP Versions</label>
                    <div className="grid grid-cols-2 gap-3">
                      {sopHistory.map((hist, hidx) => (
                        <div key={hidx} className="p-3 bg-slate-50 dark:bg-slate-950 border dark:border-slate-850 rounded-xl text-slate-500">
                          <div className="flex justify-between font-semibold">
                            <span>Rev #{sopHistory.length - hidx}</span>
                            <span>{new Date(hist.date).toLocaleDateString('en-GB')}</span>
                          </div>
                          <p className="mt-1 text-[11px]">Editor: {hist.editorName}</p>
                          <p className="text-[11px]">Yield: {hist.expectedOutput} pcs</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
          {/* TAB 3: Bill of Materials */}
          {activeTab === 'bom' && (
            <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-805 shadow-md overflow-hidden">
              <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center">
                  <Layers className="w-4 h-4 mr-1.5 text-indigo-500" /> Ingredients Consumption (BoM)
                </h3>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <select
                    value={selectedRmId}
                    onChange={(e) => setSelectedRmId(e.target.value)}
                    className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 h-9"
                  >
                    <option value="">Choose Raw Material...</option>
                    {masters.rawMaterials.map(rm => {
                      const uomLabel = (masters.units || []).find(u => u.id === rm.unitId)?.abbreviation || 'units';
                      return (
                        <option key={rm.id} value={rm.id}>
                          {rm.name} ({rm.code}) — Avail: {Number(rm.currentStock || 0).toFixed(2)} {uomLabel}
                        </option>
                      );
                    })}
                  </select>
                  <Button 
                    type="button" 
                    onClick={handleAddRm} 
                    className="bg-indigo-600 hover:bg-indigo-750 dark:bg-indigo-500 dark:hover:bg-indigo-600 text-white font-bold rounded-xl text-xs py-1.5 px-4 transition-all"
                  >
                    Add Ingredient
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto text-xs">
                  <table className="w-full text-left">
                    <thead className="bg-slate-55 dark:bg-slate-950 text-slate-500 dark:text-slate-400 uppercase font-semibold">
                      <tr>
                        <th className="p-4 w-12 text-center">SN</th>
                        <th className="p-4">Raw Material</th>
                        <th className="p-4 text-right">Unit Price (Base UOM)</th>
                        <th className="p-4 text-right w-44 font-bold">Qty Per Piece *</th>
                        <th className="p-4 text-right">Contribution Ratio</th>
                        <th className="p-4 text-right">Line Total</th>
                        <th className="p-4 text-center w-16">Remove</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {bom.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="p-6 text-center text-slate-400 dark:text-slate-500 italic">No ingredients assigned to BOM. Choose raw material above to assign.</td>
                        </tr>
                      ) : (
                        bom.map((item, idx) => {
                          const pct = totalRmCost > 0 ? (item.totalCost / totalRmCost) * 100 : 0;
                          return (
                            <tr key={item.rmId} className="hover:bg-slate-50/50 dark:hover:bg-slate-950/10 transition-colors">
                              <td className="p-4 text-center text-slate-400">{idx + 1}</td>
                              <td className="p-4 font-semibold text-slate-850 dark:text-white">
                                <div>{item.name} <span className="font-mono text-3xs text-slate-400">({item.code})</span></div>
                                <div className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold mt-0.5">
                                  Available: {Number(item.currentStock || 0).toFixed(2)} {item.uomLabel}
                                </div>
                              </td>
                              <td className="p-4 text-right font-mono text-slate-700 dark:text-slate-350">₹{item.unitPrice.toFixed(2)} / {item.uomLabel}</td>
                              <td className="p-4">
                                <div className="flex items-center gap-1.5 justify-end">
                                  <Input
                                    type="number"
                                    step="0.0001"
                                    min="0"
                                    className="h-8 w-24 text-right font-bold bg-white dark:bg-slate-900 border border-slate-205 dark:border-slate-750 text-slate-855 dark:text-white rounded-xl focus:ring-indigo-505"
                                    value={item.consumption}
                                    onChange={(e) => handleRmQtyChange(idx, e.target.value)}
                                  />
                                  <span className="text-2xs font-bold text-slate-500 dark:text-slate-400 min-w-[32px] text-left">{item.uomLabel}</span>
                                </div>
                              </td>
                              <td className="p-4 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <div className="w-16 bg-slate-200 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                                    <div className="bg-indigo-500 h-1.5 rounded-full" style={{ width: `${pct}%` }}></div>
                                  </div>
                                  <span className="font-mono text-[10px] text-slate-450">{pct.toFixed(0)}%</span>
                                </div>
                              </td>
                              <td className="p-4 text-right font-bold font-mono text-slate-850 dark:text-white">₹{item.totalCost.toFixed(2)}</td>
                              <td className="p-4 text-center">
                                <button 
                                  type="button" 
                                  onClick={() => handleRemoveRm(idx)} 
                                  className="text-rose-500 hover:text-rose-650 p-1.5 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg transition-colors"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="p-4 border-t border-slate-100 dark:border-slate-805 bg-slate-50/30 dark:bg-slate-950/20 flex justify-end items-center gap-2 text-xs">
                  <span className="font-semibold text-slate-405 dark:text-slate-400 uppercase">Total Material Cost:</span>
                  <span className="font-mono font-bold text-sm text-slate-900 dark:text-white">₹{totalRmCost.toFixed(2)}</span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* TAB 4: Operations & Costs */}
          {activeTab === 'operations' && (
            <div className="space-y-6 animate__animated animate__fadeIn">
              {/* Manufacturing Stages durations - Timeline Flow layout */}
              <Card className="bg-white dark:bg-slate-900 border border-slate-202 dark:border-slate-800 shadow-md overflow-hidden">
                <CardHeader className="pb-4 border-b border-slate-100 dark:border-slate-800/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-slate-50/20 dark:bg-slate-950/20">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-500">
                      <Clock className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-xs font-extrabold uppercase tracking-wide text-slate-700 dark:text-slate-350">Processing Timeline</h3>
                      <p className="text-[10px] text-slate-400 mt-0.5">Map the chronologically sorted sequence of work stages.</p>
                    </div>
                  </div>
                  <div className="flex gap-2 w-full sm:w-auto">
                    <select
                      value={selectedStageId}
                      onChange={(e) => setSelectedStageId(e.target.value)}
                      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none h-9 focus:ring-1 focus:ring-indigo-500"
                    >
                      <option value="">Select Stage...</option>
                      {masters.stages.map(st => (
                        <option key={st.id} value={st.id}>{st.name}</option>
                      ))}
                    </select>
                    <Button 
                      type="button" 
                      onClick={handleAddStage}
                      className="bg-indigo-600 hover:bg-indigo-750 dark:bg-indigo-500 dark:hover:bg-indigo-600 text-white font-bold rounded-xl text-xs py-1.5 px-4 transition-all"
                    >
                      Add Stage
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="p-6">
                  {stages.length === 0 ? (
                    <p className="text-slate-400 dark:text-slate-500 italic text-center py-6">No stages added. Assign stages to model the production duration.</p>
                  ) : (
                    <div className="space-y-6 relative before:absolute before:left-6 before:top-2 before:bottom-2 before:w-[2px] before:bg-slate-200 dark:before:bg-slate-800">
                      {stages.map((st, idx) => (
                        <div key={st.stageId} className="flex gap-4 relative items-start animate__animated animate__fadeIn">
                          {/* Circle badge marker */}
                          <div className="z-10 flex items-center justify-center w-12 h-12 rounded-full border bg-indigo-50 border-indigo-250 dark:bg-slate-950 dark:border-slate-800 text-indigo-700 dark:text-indigo-400 font-extrabold text-xs shrink-0 shadow-sm">
                            {idx + 1}
                          </div>
                          
                          <div className="flex-1 p-4 bg-slate-50/50 dark:bg-slate-905/30 border border-slate-100 dark:border-slate-800 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div>
                              <h4 className="font-bold text-slate-850 dark:text-slate-100 text-xs uppercase tracking-wide">{st.name}</h4>
                              <p className="text-[10px] text-slate-405 mt-0.5">Specify estimated time needed for standard yield output.</p>
                            </div>

                            <div className="flex gap-2 items-center justify-start text-[10px] text-slate-500 font-bold font-mono">
                              <div className="flex items-center gap-1">
                                <Input type="number" className="w-12 h-8 p-1 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-850 dark:text-white rounded-lg focus:ring-indigo-500" min="0" value={st.months} onChange={(e) => handleStageTimeChange(idx, 'months', e.target.value)} />
                                <span>Mo</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <Input type="number" className="w-12 h-8 p-1 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-850 dark:text-white rounded-lg focus:ring-indigo-500" min="0" value={st.days} onChange={(e) => handleStageTimeChange(idx, 'days', e.target.value)} />
                                <span>Day</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <Input type="number" className="w-12 h-8 p-1 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-850 dark:text-white rounded-lg focus:ring-indigo-500" min="0" value={st.hours} onChange={(e) => handleStageTimeChange(idx, 'hours', e.target.value)} />
                                <span>Hr</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <Input type="number" className="w-12 h-8 p-1 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-850 dark:text-white rounded-lg focus:ring-indigo-500" min="0" value={st.minutes} onChange={(e) => handleStageTimeChange(idx, 'minutes', e.target.value)} />
                                <span>Min</span>
                              </div>

                              <button 
                                type="button" 
                                onClick={() => handleRemoveStage(idx)} 
                                className="text-rose-500 hover:text-rose-600 ml-2 p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-all"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              
            </div>
          )}
        </div>

        {/* Real-time Pricing Summary Sidebar */}
        <div className="space-y-6">
          <div className="bg-indigo-50/20 dark:bg-indigo-950/10 border border-indigo-100 dark:border-indigo-900/40 p-5 rounded-2xl space-y-4 sticky top-6 shadow-md transition-all">
            <div>
              <h4 className="font-extrabold text-sm text-slate-855 dark:text-white flex items-center">
                <Sparkles className="w-4 h-4 mr-1.5 text-indigo-600 dark:text-indigo-405 animate-pulse" /> Cost Summary Matrix
              </h4>
              <p className="text-[10px] text-slate-455 dark:text-slate-400 mt-0.5">Live estimates per unit/piece.</p>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
                <span className="text-slate-450 dark:text-slate-400">Ingredient Cost (BOM):</span>
                <span className="font-mono font-bold dark:text-white">₹{totalRmCost.toFixed(2)}</span>
              </div>
              <div className="flex justify-between pb-2 border-b border-slate-200 dark:border-slate-800 font-extrabold text-slate-900 dark:text-white">
                <span>Total Unit Cost:</span>
                <span className="font-mono">₹{totalRmCost.toFixed(2)}</span>
              </div>
              <div className="flex justify-between pt-1 font-extrabold text-indigo-650 dark:text-indigo-400 text-sm">
                <span>Selling Price:</span>
                <span className="font-mono">₹{Number(salePrice || 0).toFixed(2)}</span>
              </div>
            </div>

            <Button
              type="button"
              onClick={handleSubmit}
              disabled={saving}
              className="w-full bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-700 text-white font-bold py-2.5 rounded-xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Save className="w-4 h-4" /> Save Formulation Specs
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ProductListPage() {
  const user = useAuthStore(s => s.user);
  const canEdit = user?.role === 'MAIN_MASTER';

  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [view, setView] = useState('list'); // 'list' | 'add' | 'edit'
  const [displayMode, setDisplayMode] = useState('grid'); // Default: 12 items in card grid as requested
  const [editId, setEditId] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  // Default sort is code ascending (PRD-00001 first) as requested
  const [sortBy, setSortBy] = useState('code_asc');
  const itemsPerPage = 12;

  const { data: products = [], isLoading } = useQuery({
    queryKey: ['products'],
    queryFn: async () => (await api.get('/products')).data
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => await api.delete(`/products/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      setSelectedIds(prev => prev.filter(x => x !== editId));
    }
  });

  const handleDelete = (item) => {
    const isDark = document.documentElement.classList.contains('dark');
    Swal.fire({
      title: 'Delete Product Configuration?',
      html: `
        <div class="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Are you sure you want to delete <strong class="text-slate-900 dark:text-slate-100">"${item.name}" (${item.code})</strong>?
          <p class="text-rose-600 dark:text-rose-400 font-medium mt-1.5 text-[11px]">This will archive all recipe specifications.</p>
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
    }).then((result) => {
      if (result.isConfirmed) {
        deleteMutation.mutate(item.id, {
          onSuccess: () => {
            Swal.fire({
              title: `<span class="font-bold text-sm text-slate-800 dark:text-slate-100">Product Removed</span>`,
              html: `<p class="text-xs text-slate-500 dark:text-slate-400 mt-1">Finished product configuration deleted.</p>`,
              icon: 'success',
              iconColor: '#10b981',
              toast: true,
              position: 'top-end',
              showConfirmButton: false,
              timer: 2500,
              timerProgressBar: true,
              background: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)',
              color: isDark ? '#f8fafc' : '#0f172a',
              customClass: {
                popup: 'rounded-xl border border-emerald-100 dark:border-emerald-950 shadow-lg p-3.5',
                timerProgressBar: 'bg-emerald-500'
              }
            });
          }
        });
      }
    });
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    const isDark = document.documentElement.classList.contains('dark');
    const result = await Swal.fire({
      title: 'Bulk Delete Products?',
      html: `<p class="text-xs text-slate-500 dark:text-slate-400 mt-1">You are about to delete <strong>${selectedIds.length}</strong> product formulations. This operation cannot be undone!</p>`,
      icon: 'warning',
      iconColor: '#f59e0b',
      showCancelButton: true,
      confirmButtonText: `Delete ${selectedIds.length} products`,
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
    });

    if (result.isConfirmed) {
      try {
        await Promise.all(selectedIds.map(id => api.delete(`/products/${id}`)));
        setSelectedIds([]);
        queryClient.invalidateQueries({ queryKey: ['products'] });

        Swal.fire({
          title: `<span class="font-bold text-sm text-slate-800 dark:text-slate-100">Bulk Deletion Successful</span>`,
          html: `<p class="text-xs text-slate-500 dark:text-slate-400 mt-1">Selected product configurations removed.</p>`,
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
        console.error(err);
      }
    }
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

  // Filter and Sort
  const sortedAndFiltered = useMemo(() => {
    let result = (products || []).filter(item => {
      const term = searchTerm.toLowerCase().trim();
      if (!term) return true;
      return (
        (item.name || '').toLowerCase().includes(term) ||
        (item.code || '').toLowerCase().includes(term) ||
        (item.category?.name || '').toLowerCase().includes(term) ||
        (item.hsnCode || '').toLowerCase().includes(term) ||
        (item.unit?.abbreviation || item.unit?.name || item.unitId || '').toLowerCase().includes(term)
      );
    });

    result.sort((a, b) => {
      if (sortBy === 'code_asc') {
        return (a.code || '').localeCompare(b.code || '', undefined, { numeric: true, sensitivity: 'base' });
      }
      if (sortBy === 'code_desc') {
        return (b.code || '').localeCompare(a.code || '', undefined, { numeric: true, sensitivity: 'base' });
      }
      if (sortBy === 'name_asc') {
        return (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' });
      }
      if (sortBy === 'name_desc') {
        return (b.name || '').localeCompare(a.name || '', undefined, { sensitivity: 'base' });
      }
      if (sortBy === 'price_desc') {
        return (parseFloat(b.salePrice) || 0) - (parseFloat(a.salePrice) || 0);
      }
      if (sortBy === 'price_asc') {
        return (parseFloat(a.salePrice) || 0) - (parseFloat(b.salePrice) || 0);
      }
      if (sortBy === 'cost_desc') {
        return (parseFloat(b.totalCost) || 0) - (parseFloat(a.totalCost) || 0);
      }
      if (sortBy === 'cost_asc') {
        return (parseFloat(a.totalCost) || 0) - (parseFloat(b.totalCost) || 0);
      }
      if (sortBy === 'latest') {
        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return timeB - timeA;
      }
      if (sortBy === 'oldest') {
        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return timeA - timeB;
      }
      return 0;
    });

    return result;
  }, [products, searchTerm, sortBy]);

  const totalPages = Math.ceil(sortedAndFiltered.length / itemsPerPage) || 1;
  const paginated = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return sortedAndFiltered.slice(startIndex, startIndex + itemsPerPage);
  }, [sortedAndFiltered, currentPage, itemsPerPage]);

  const visibleIds = paginated.map(item => item.id);
  const isAllVisibleSelected = visibleIds.length > 0 && visibleIds.every(id => selectedIds.includes(id));
  const isSomeVisibleSelected = visibleIds.some(id => selectedIds.includes(id)) && !isAllVisibleSelected;

  // Header quick sort toggles
  const handleToggleSortCode = () => {
    setSortBy(prev => (prev === 'code_asc' ? 'code_desc' : 'code_asc'));
    setCurrentPage(1);
  };

  const handleToggleSortName = () => {
    setSortBy(prev => (prev === 'name_asc' ? 'name_desc' : 'name_asc'));
    setCurrentPage(1);
  };

  const handleToggleSortCost = () => {
    setSortBy(prev => (prev === 'cost_desc' ? 'cost_asc' : 'cost_desc'));
    setCurrentPage(1);
  };

  const handleToggleSortPrice = () => {
    setSortBy(prev => (prev === 'price_desc' ? 'price_asc' : 'price_desc'));
    setCurrentPage(1);
  };

  if (view !== 'list') {
    return <ProductForm editId={canEdit ? editId : null} onBack={() => { setView('list'); setEditId(null); }} />;
  }

  return (
    <div className="w-full px-3 sm:px-4 py-2.5 space-y-2.5 mx-auto transition-all duration-200">
      {!canEdit && (
        <div className="flex items-center gap-2 p-2.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/80 rounded-xl text-amber-800 dark:text-amber-300 text-xs font-medium">
          <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
          <span>You have <strong>Read-Only access</strong> to Products. Modifying product specifications is restricted.</span>
        </div>
      )}

      {/* Sleek Compact Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-100 dark:border-indigo-800 shadow-3xs shrink-0">
            <Package className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-bold tracking-tight text-slate-900 dark:text-white">
                Finished Products
              </h1>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 border border-indigo-200/70 dark:border-indigo-800">
                {products.length} {products.length === 1 ? 'Product' : 'Products'}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
              Configure finished product specifications, BOM formulas, and selling prices.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* View Mode Toggle (Table / Grid) */}
          <div className="flex bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700">
            <button
              onClick={() => setDisplayMode('table')}
              className={`p-1 rounded-md transition-all cursor-pointer ${
                displayMode === 'table'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-3xs'
                  : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
              }`}
              title="Standard Table List"
            >
              <ListIcon className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setDisplayMode('grid')}
              className={`p-1 rounded-md transition-all cursor-pointer ${
                displayMode === 'grid'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-3xs'
                  : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
              }`}
              title="Cards Grid View"
            >
              <Grid className="w-3.5 h-3.5" />
            </button>
          </div>

          {canEdit && (
            <Button 
              onClick={() => { setEditId(null); setView('add'); }}
              size="sm"
              className="h-8 px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-3xs transition-all cursor-pointer inline-flex items-center gap-1.5 shrink-0 self-start sm:self-auto"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Product
            </Button>
          )}
        </div>
      </div>

      {/* Selection Notification Banner */}
      {canEdit && selectedIds.length > 0 && (
        <div className="bg-indigo-50/90 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 rounded-xl px-3 py-1.5 flex items-center justify-between gap-3 shadow-3xs animate__animated animate__fadeIn">
          <div className="flex items-center gap-2 text-xs">
            <span className="w-5 h-5 rounded-md bg-indigo-600 text-white font-bold text-[10px] flex items-center justify-center shadow-3xs">
              {selectedIds.length}
            </span>
            <span className="font-semibold text-slate-800 dark:text-slate-200 text-xs">
              {selectedIds.length} {selectedIds.length === 1 ? 'product' : 'products'} selected
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setSelectedIds([])}
              className="px-2.5 py-1 text-[11px] font-medium text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800 rounded-lg transition-colors border border-transparent hover:border-slate-200 dark:hover:border-slate-700 cursor-pointer"
            >
              Clear
            </button>
            <button
              onClick={handleBulkDelete}
              className="flex items-center gap-1 px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-[11px] font-semibold transition-colors shadow-3xs cursor-pointer"
            >
              <Trash2 className="w-3 h-3" />
              Delete Selected
            </button>
          </div>
        </div>
      )}

      {/* Main Table Card */}
      <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xs overflow-hidden flex flex-col text-xs">
        <CardContent className="p-0">
          {/* Integrated Pro Toolbar */}
          <div className="px-3 py-2 border-b border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
            {/* Search Input with quick clear */}
            <div className="relative w-full sm:w-64 md:w-72">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search code, name, category, HSN..."
                value={searchTerm}
                onChange={(e) => { 
                  setSearchTerm(e.target.value); 
                  setCurrentPage(1); 
                }}
                className="w-full pl-8 pr-7 py-1.5 border border-slate-200 dark:border-slate-700/80 rounded-lg text-xs bg-white dark:bg-slate-950 dark:text-white focus:outline-none focus:ring-1.5 focus:ring-indigo-500/30 focus:border-indigo-500 h-8 shadow-3xs transition-all placeholder:text-slate-400"
              />
              {searchTerm && (
                <button
                  onClick={() => { setSearchTerm(''); setCurrentPage(1); }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 rounded-full transition-colors cursor-pointer"
                  title="Clear search"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Sorting & Filter Controls */}
            <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
              {searchTerm && (
                <div className="text-[11px] text-indigo-600 dark:text-indigo-400 font-medium hidden md:inline-flex items-center gap-1">
                  <span>Found {sortedAndFiltered.length} matches</span>
                </div>
              )}

              {/* Sort Dropdown */}
              <div className="relative flex items-center w-full sm:w-auto">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 flex items-center pointer-events-none text-indigo-600 dark:text-indigo-400">
                  <ArrowUpDown className="w-3.5 h-3.5" />
                </span>
                <select
                  value={sortBy}
                  onChange={(e) => {
                    setSortBy(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="h-8 w-full sm:w-56 pl-8 pr-7 text-xs font-semibold border border-slate-200 dark:border-slate-700/80 rounded-lg bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1.5 focus:ring-indigo-500/30 focus:border-indigo-500 appearance-none cursor-pointer transition-all shadow-3xs hover:border-slate-300 dark:hover:border-slate-600"
                  aria-label="Sort options"
                >
                  <option value="code_asc">Sort: Code (PRD-00001 First)</option>
                  <option value="code_desc">Sort: Code (Descending)</option>
                  <option value="name_asc">Sort: Name (A → Z)</option>
                  <option value="name_desc">Sort: Name (Z → A)</option>
                  <option value="price_desc">Sort: Selling Price (High to Low)</option>
                  <option value="price_asc">Sort: Selling Price (Low to High)</option>
                  <option value="cost_desc">Sort: Total Cost (High to Low)</option>
                  <option value="cost_asc">Sort: Total Cost (Low to High)</option>
                  <option value="latest">Sort: Latest Added (Newest)</option>
                  <option value="oldest">Sort: Oldest First</option>
                </select>
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center pointer-events-none text-slate-400">
                  <ChevronDown className="w-3 h-3" />
                </span>
              </div>

              {/* Quick Reset */}
              {(searchTerm || sortBy !== 'code_asc') && (
                <button
                  onClick={() => {
                    setSearchTerm('');
                    setSortBy('code_asc');
                    setCurrentPage(1);
                  }}
                  className="h-8 px-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition-colors flex items-center gap-1 text-[11px] font-medium shrink-0 cursor-pointer"
                  title="Reset filters and sort"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span className="hidden lg:inline">Reset</span>
                </button>
              )}
            </div>
          </div>

          {/* STANDARD TABLE VIEW MODE (Default) */}
          {displayMode === 'table' && (
            <div className="overflow-x-auto">
              <Table className="text-xs">
                <TableHeader className="bg-slate-50/80 dark:bg-slate-950/80 text-slate-600 dark:text-slate-400 font-bold border-b border-slate-200 dark:border-slate-800 uppercase tracking-wider text-[10px]">
                  <TableRow className="border-b border-slate-200 dark:border-slate-800">
                    {canEdit && (
                      <TableHead className="w-9 px-2 text-center py-2">
                        <TableCheckbox
                          checked={isAllVisibleSelected}
                          indeterminate={isSomeVisibleSelected}
                          onChange={() => handleSelectAll(paginated)}
                        />
                      </TableHead>
                    )}
                    {/* 1. Code */}
                    <TableHead className="py-2 px-3 w-28">
                      <button
                        onClick={handleToggleSortCode}
                        className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer select-none"
                        title="Sort by Code"
                      >
                        <span>Code</span>
                        {sortBy === 'code_asc' ? (
                          <ArrowUp className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                        ) : sortBy === 'code_desc' ? (
                          <ArrowDown className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                        ) : (
                          <ArrowUpDown className="w-3 h-3 text-slate-400 hover:text-slate-600" />
                        )}
                      </button>
                    </TableHead>
                    {/* 2. Category (Immediately after Code) */}
                    <TableHead className="py-2 px-3 w-32">Category</TableHead>
                    {/* 3. Name */}
                    <TableHead className="py-2 px-3">
                      <button
                        onClick={handleToggleSortName}
                        className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer select-none"
                        title="Sort by Name"
                      >
                        <span>Specification Name</span>
                        {sortBy === 'name_asc' ? (
                          <ArrowUp className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                        ) : sortBy === 'name_desc' ? (
                          <ArrowDown className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                        ) : (
                          <ArrowUpDown className="w-3 h-3 text-slate-400 hover:text-slate-600" />
                        )}
                      </button>
                    </TableHead>
                    {/* 4. UOM */}
                    <TableHead className="py-2 px-3 w-20">UOM</TableHead>
                    {/* 5. HSN */}
                    <TableHead className="py-2 px-3 w-24">HSN</TableHead>
                    {/* 6. BOM items */}
                    <TableHead className="py-2 px-3 w-20 text-center">BOM</TableHead>
                    {/* 7. Total Cost */}
                    <TableHead className="py-2 px-3 text-right w-28">
                      <button
                        onClick={handleToggleSortCost}
                        className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer select-none ml-auto"
                        title="Sort by Cost"
                      >
                        <span>Total Cost</span>
                        {sortBy === 'cost_asc' ? (
                          <ArrowUp className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                        ) : sortBy === 'cost_desc' ? (
                          <ArrowDown className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                        ) : (
                          <ArrowUpDown className="w-3 h-3 text-slate-400 hover:text-slate-600" />
                        )}
                      </button>
                    </TableHead>
                    {/* 8. Selling Price */}
                    <TableHead className="py-2 px-3 text-right w-28">
                      <button
                        onClick={handleToggleSortPrice}
                        className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer select-none ml-auto"
                        title="Sort by Selling Price"
                      >
                        <span>Selling Price</span>
                        {sortBy === 'price_asc' ? (
                          <ArrowUp className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                        ) : sortBy === 'price_desc' ? (
                          <ArrowDown className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                        ) : (
                          <ArrowUpDown className="w-3 h-3 text-slate-400 hover:text-slate-600" />
                        )}
                      </button>
                    </TableHead>
                    {/* 9. Stock */}
                    <TableHead className="py-2 px-3 text-right w-20">Stock</TableHead>
                    {/* 10. Actions */}
                    {canEdit && <TableHead className="py-2 px-3 text-right w-20">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    Array.from({ length: 5 }).map((_, idx) => (
                      <TableRow key={idx} className="border-b border-slate-100 dark:border-slate-800/60">
                        {canEdit && <TableCell className="py-2 px-2 text-center"><Skeleton className="h-3.5 w-3.5 mx-auto rounded" /></TableCell>}
                        <TableCell className="py-2 px-3"><Skeleton className="h-4 w-20 rounded" /></TableCell>
                        <TableCell className="py-2 px-3"><Skeleton className="h-4 w-24 rounded" /></TableCell>
                        <TableCell className="py-2 px-3"><Skeleton className="h-4 w-44 rounded" /></TableCell>
                        <TableCell className="py-2 px-3"><Skeleton className="h-4 w-12 rounded" /></TableCell>
                        <TableCell className="py-2 px-3"><Skeleton className="h-4 w-16 rounded" /></TableCell>
                        <TableCell className="py-2 px-3 text-center"><Skeleton className="h-4 w-14 mx-auto rounded" /></TableCell>
                        <TableCell className="py-2 px-3 text-right"><Skeleton className="h-4 w-20 ml-auto rounded" /></TableCell>
                        <TableCell className="py-2 px-3 text-right"><Skeleton className="h-4 w-20 ml-auto rounded" /></TableCell>
                        <TableCell className="py-2 px-3 text-right"><Skeleton className="h-4 w-12 ml-auto rounded" /></TableCell>
                        {canEdit && <TableCell className="py-2 px-3 text-right"><Skeleton className="h-6 w-14 ml-auto rounded" /></TableCell>}
                      </TableRow>
                    ))
                  ) : paginated.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={canEdit ? 11 : 9} className="text-center py-10 text-slate-400">
                        <div className="flex flex-col items-center justify-center gap-1.5">
                          <Package className="w-7 h-7 text-slate-300 dark:text-slate-600 stroke-1" />
                          <p className="font-semibold text-xs text-slate-600 dark:text-slate-300">
                            {searchTerm ? `No products matching "${searchTerm}"` : 'No finished product specifications found.'}
                          </p>
                          <p className="text-[11px] text-slate-400">
                            {searchTerm ? 'Try clearing your search term.' : 'Click "Add Product" above to create your first recipe formula.'}
                          </p>
                          {searchTerm && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => { setSearchTerm(''); setCurrentPage(1); }}
                              className="mt-1.5 h-7 text-xs"
                            >
                              Clear Search
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginated.map((item) => {
                      const isSelected = selectedIds.includes(item.id);
                      return (
                        <TableRow 
                          key={item.id} 
                          className={`transition-colors border-b border-slate-100 dark:border-slate-800/70 last:border-none ${
                            isSelected 
                              ? 'bg-indigo-50/50 dark:bg-indigo-950/30' 
                              : 'hover:bg-slate-50/70 dark:hover:bg-slate-800/30'
                          }`}
                        >
                          {canEdit && (
                            <TableCell className="py-2 px-2 text-center">
                              <TableCheckbox
                                checked={isSelected}
                                onChange={() => handleSelectRow(item.id)}
                              />
                            </TableCell>
                          )}
                          {/* 1. Code */}
                          <TableCell className="py-2 px-3 font-mono text-[11px] font-bold text-indigo-600 dark:text-indigo-400 whitespace-nowrap">
                            {item.code}
                          </TableCell>
                          {/* 2. Category (After Code) */}
                          <TableCell className="py-2 px-3 whitespace-nowrap">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700">
                              {item.category?.name || 'Uncategorised'}
                            </span>
                          </TableCell>
                          {/* 3. Name (After Category) */}
                          <TableCell className="py-2 px-3">
                            <span className="font-bold text-slate-900 dark:text-slate-100 tracking-tight text-xs">
                              {item.name?.toUpperCase()}
                            </span>
                          </TableCell>
                          {/* 4. UOM */}
                          <TableCell className="py-2 px-3 text-slate-600 dark:text-slate-400 font-semibold uppercase text-[11px]">
                            {item.unit?.abbreviation || item.unit?.name || item.unitId || '—'}
                          </TableCell>
                          {/* 5. HSN */}
                          <TableCell className="py-2 px-3 font-mono text-[11px] text-slate-500 dark:text-slate-400">
                            {item.hsnCode || '—'}
                          </TableCell>
                          {/* 6. BOM items count */}
                          <TableCell className="py-2 px-3 text-center whitespace-nowrap">
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-indigo-50/70 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-900">
                              {item.bom?.length || 0} items
                            </span>
                          </TableCell>
                          {/* 7. Total Cost */}
                          <TableCell className="py-2 px-3 text-right font-mono font-semibold text-slate-700 dark:text-slate-300">
                            ₹{parseFloat(item.totalCost || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </TableCell>
                          {/* 8. Selling Price */}
                          <TableCell className="py-2 px-3 text-right font-mono font-bold text-indigo-600 dark:text-indigo-400">
                            ₹{parseFloat(item.salePrice || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </TableCell>
                          {/* 9. Stock */}
                          <TableCell className="py-2 px-3 text-right font-mono text-slate-600 dark:text-slate-400 font-medium">
                            {item.currentStock ?? item.openingStock ?? 0}
                          </TableCell>
                          {/* 10. Actions */}
                          {canEdit && (
                            <TableCell className="py-2 px-3 text-right whitespace-nowrap">
                              <div className="flex items-center justify-end space-x-0.5">
                                <button 
                                  onClick={() => { setEditId(item.id); setView('edit'); }}
                                  className="p-1 rounded-md text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 transition-colors cursor-pointer"
                                  title="Edit Product"
                                >
                                  <Edit className="w-3.5 h-3.5" />
                                </button>
                                <button 
                                  onClick={() => handleDelete(item)} 
                                  className="p-1 rounded-md text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors cursor-pointer"
                                  title="Delete Product"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </TableCell>
                          )}
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          )}

          {/* GALLERY GRID VIEW MODE (Default) */}
          {displayMode === 'grid' && (
            <div className="p-3 sm:p-3.5">
              {isLoading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6 gap-3 sm:gap-3.5">
                  {Array.from({ length: 12 }).map((_, idx) => (
                    <div
                      key={idx}
                      className="border border-slate-200/80 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-900 flex flex-col justify-between"
                    >
                      <Skeleton className="h-36 sm:h-38 w-full rounded-none" />
                      <div className="p-3 space-y-2.5 flex-1 flex flex-col justify-between">
                        <div className="space-y-1.5">
                          <Skeleton className="h-4 w-3/4 rounded" />
                          <div className="flex justify-between">
                            <Skeleton className="h-3 w-16 rounded" />
                            <Skeleton className="h-3 w-16 rounded" />
                          </div>
                        </div>
                        <div className="p-2 border border-slate-100 dark:border-slate-800 rounded-lg space-y-1.5">
                          <Skeleton className="h-3 w-full rounded" />
                          <Skeleton className="h-3 w-4/5 rounded" />
                          <Skeleton className="h-4 w-1/2 rounded" />
                        </div>
                        <Skeleton className="h-7 w-full rounded-lg" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : paginated.length === 0 ? (
                <div className="py-16 text-center text-slate-400">
                  <Package className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600 mb-2 stroke-1" />
                  <p className="font-semibold text-xs text-slate-600 dark:text-slate-300">
                    {searchTerm ? `No products matching "${searchTerm}"` : 'No finished product specifications found.'}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {searchTerm ? 'Try clearing your search term.' : 'Click "Add Product" above to create your first recipe formula.'}
                  </p>
                  {searchTerm && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => { setSearchTerm(''); setCurrentPage(1); }}
                      className="mt-2 h-7 text-xs"
                    >
                      Clear Search
                    </Button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6 gap-3 sm:gap-3.5">
                  {paginated.map((item) => {
                    const isSelected = selectedIds.includes(item.id);
                    const uom = item.unit?.abbreviation || item.unit?.name || item.unitId || 'pcs';
                    const stock = item.currentStock ?? item.openingStock ?? 0;
                    const alert = item.alertLevel ?? 0;
                    const isLowStock = alert > 0 && stock <= alert && stock > 0;
                    const isOutOfStock = stock <= 0;
                    const totalCost = parseFloat(item.totalCost || 0);
                    const salePrice = parseFloat(item.salePrice || 0);

                    return (
                      <div
                        key={item.id}
                        className={`group border rounded-xl bg-white dark:bg-slate-950 overflow-hidden flex flex-col justify-between transition-all duration-200 shadow-3xs hover:shadow-md hover:border-indigo-200 dark:hover:border-indigo-900/60 relative ${
                          isSelected
                            ? 'border-indigo-600 dark:border-indigo-500 ring-1 ring-indigo-600 dark:ring-indigo-500 bg-indigo-50/15 dark:bg-indigo-950/20'
                            : 'border-slate-200 dark:border-slate-800'
                        }`}
                      >
                        {/* Top Media / Thumbnail Section */}
                        <div className="h-36 sm:h-38 w-full relative bg-slate-100 dark:bg-slate-900/90 border-b border-slate-100 dark:border-slate-800/80 overflow-hidden shrink-0 flex items-center justify-center">
                          {item.imageUrl ? (
                            <img 
                              src={item.imageUrl} 
                              alt={item.name} 
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                            />
                          ) : (
                            <div className="flex flex-col items-center justify-center text-slate-300 dark:text-slate-600 select-none">
                              <Package className="w-8 h-8 stroke-1 mb-1 text-slate-400 dark:text-slate-500 group-hover:scale-110 transition-transform duration-300" />
                              <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Finished Good</span>
                            </div>
                          )}

                          {/* Checkbox overlay top-left */}
                          {canEdit && (
                            <div className="absolute top-2 left-2 z-10 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xs p-1 rounded-md border border-slate-200/60 dark:border-slate-700/60 shadow-3xs">
                              <TableCheckbox
                                checked={isSelected}
                                onChange={() => handleSelectRow(item.id)}
                              />
                            </div>
                          )}

                          {/* Product Code Badge top-right */}
                          <div className="absolute top-2 right-2 px-2 py-0.5 bg-slate-900/85 dark:bg-slate-950/90 backdrop-blur-xs rounded-md text-[10px] font-bold font-mono text-white tracking-wider shadow-3xs border border-white/10">
                            {item.code}
                          </div>

                          {/* Bottom category tag overlay */}
                          <div className="absolute bottom-2 left-2 max-w-[85%] truncate">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xs rounded text-[9px] font-bold text-slate-700 dark:text-slate-200 border border-slate-200/60 dark:border-slate-700/60 shadow-3xs truncate">
                              <Tag className="w-2.5 h-2.5 text-indigo-500 shrink-0" />
                              <span className="truncate">{item.category?.name || 'Uncategorised'}</span>
                            </span>
                          </div>

                          {/* Stock status indicator bottom-right */}
                          <div className="absolute bottom-2 right-2">
                            {isOutOfStock ? (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-500/90 backdrop-blur-xs text-white shadow-3xs">
                                Out of stock
                              </span>
                            ) : isLowStock ? (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500/90 backdrop-blur-xs text-white shadow-3xs">
                                Low: {stock}
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-600/90 backdrop-blur-xs text-white shadow-3xs">
                                {stock} {uom}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Card Content Details */}
                        <div className="p-3 flex-1 flex flex-col justify-between space-y-2.5 text-xs">
                          {/* Title & Specs */}
                          <div>
                            <h3 
                              className="font-bold text-slate-900 dark:text-slate-100 text-xs tracking-tight line-clamp-1 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors uppercase"
                              title={item.name}
                            >
                              {item.name?.toUpperCase()}
                            </h3>
                            <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1 font-semibold">
                              <span>UOM: <strong className="text-slate-600 dark:text-slate-300 uppercase">{uom}</strong></span>
                              <span>HSN: <strong className="text-slate-600 dark:text-slate-300 font-mono">{item.hsnCode || '—'}</strong></span>
                            </div>
                          </div>

                          {/* Matrix Box */}
                          <div className="bg-slate-50/70 dark:bg-slate-900/60 rounded-lg p-2 border border-slate-100 dark:border-slate-800/80 space-y-1 text-[11px]">
                            <div className="flex justify-between items-center text-slate-500 dark:text-slate-400">
                              <span className="flex items-center gap-1 text-[10px]">
                                <Layers className="w-3 h-3 text-slate-400" /> BOM Ratio:
                              </span>
                              <span className="font-semibold text-slate-700 dark:text-slate-300 text-[10px]">
                                {item.bom?.length || 0} items
                              </span>
                            </div>
                            <div className="flex justify-between items-center text-slate-500 dark:text-slate-400">
                              <span className="text-[10px]">Total Cost:</span>
                              <span className="font-mono font-medium text-slate-700 dark:text-slate-300 text-[11px]">
                                ₹{totalCost.toFixed(2)}
                              </span>
                            </div>
                            <div className="flex justify-between items-center pt-1 border-t border-dashed border-slate-200 dark:border-slate-700/80">
                              <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-tight">
                                Selling Price:
                              </span>
                              <span className="font-mono font-extrabold text-slate-900 dark:text-white text-xs">
                                ₹{salePrice.toFixed(2)}
                              </span>
                            </div>
                          </div>

                          {/* Card Actions */}
                          {canEdit && (
                            <div className="flex items-center gap-1.5 pt-1">
                              <Button
                                size="sm"
                                onClick={() => { setEditId(item.id); setView('edit'); }}
                                className="flex-1 h-7 text-[11px] bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-600 hover:text-white dark:hover:bg-indigo-600 text-indigo-600 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-800/80 font-semibold rounded-lg transition-all shadow-3xs cursor-pointer inline-flex items-center justify-center gap-1"
                              >
                                <Edit className="w-3 h-3" />
                                <span>Edit Specs</span>
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleDelete(item)}
                                className="h-7 w-7 p-0 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer shrink-0"
                                title="Delete Product"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Integrated Compact Pagination */}
          <div className="px-3 py-2 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 flex flex-col sm:flex-row items-center justify-between gap-2">
            <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
              Showing <span className="font-semibold text-slate-800 dark:text-slate-200">{paginated.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0}</span> to <span className="font-semibold text-slate-800 dark:text-slate-200">{Math.min(currentPage * itemsPerPage, sortedAndFiltered.length)}</span> of <span className="font-semibold text-slate-800 dark:text-slate-200">{sortedAndFiltered.length}</span> products
            </div>

            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
