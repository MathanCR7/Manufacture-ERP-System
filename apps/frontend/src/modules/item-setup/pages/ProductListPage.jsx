import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Swal from 'sweetalert2';
import {
  Edit, Trash2, Plus, Search, Tag, Package, DollarSign, Settings,
  ArrowLeft, Save, Loader2, AlertCircle, Info, Check, Percent, Clock, 
  X, Layers, Image as ImageIcon, Sparkles, ChevronRight, Eye, RefreshCw,
  PlusCircle, Sliders, ShieldAlert, TrendingUp, Grid, List as ListIcon,
  ChevronLeft, Award, HelpCircle, FileText
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

function TableCheckbox({ checked, onChange, indeterminate }) {
  const checkboxRef = useRef(null);

  useEffect(() => {
    if (checkboxRef.current) {
      checkboxRef.current.indeterminate = indeterminate;
    }
  }, [indeterminate]);

  return (
    <input
      type="checkbox"
      ref={checkboxRef}
      checked={checked}
      onChange={onChange}
      className="w-4 h-4 text-indigo-605 bg-slate-105 dark:bg-slate-800 border-slate-350 dark:border-slate-700 rounded focus:ring-indigo-500 dark:focus:ring-indigo-600 transition-all cursor-pointer"
    />
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
          setSalePrice(Number(prod.salePrice || 0));
          
          setExpectedOutput(Number(prod.expectedOutput || 1));
          setSopSteps(prod.sopSteps || [{ stepNumber: 1, instruction: '', tempTime: '', safetyNote: '' }]);
          setImageUrl(prod.imageUrl || '');
          setIsSopLocked(!!prod.isSopLocked);
          setSopHistory(prod.sopHistory || []);

          if (prod.bom) {
            setBom(prod.bom.map(item => {
              const matchedRM = (mastersData.rawMaterials || []).find(m => m.id === item.rmId);
              const getLocalUomLabel = (uid) => {
                if (!uid) return 'units';
                const match = (mastersData.units || []).find(u => 
                  u.id === uid || 
                  u.abbreviation.toLowerCase() === uid.toLowerCase() || 
                  u.name.toLowerCase() === uid.toLowerCase()
                );
                return match ? match.abbreviation : uid;
              };
              const uomLabel = matchedRM ? getLocalUomLabel(matchedRM.unitId) : 'units';
              const isKg = /kg|kilogram/i.test(uomLabel);
              const isL = /l|liter|litre/i.test(uomLabel);
              const subUomLabel = isKg ? 'g' : (isL ? 'ml' : null);
              return {
                rmId: item.rmId,
                name: item.rawMaterial?.name || '',
                code: item.rawMaterial?.code || '',
                unitPrice: Number(item.unitPrice || 0),
                consumption: Number(item.consumptionPerUnit || 0),
                totalCost: Number(item.totalCost || 0),
                currentStock: matchedRM ? Number(matchedRM.currentStock || 0) : 0,
                uomLabel,
                subUomLabel,
                selectedUnit: 'base'
              };
            }));
          }

          if (prod.nonInventoryCosts) {
            setNonInventoryCosts(prod.nonInventoryCosts.map(item => ({
              itemId: item.itemId,
              name: item.item?.name || '',
              cost: Number(item.cost || 0)
            })));
          }

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

    const uomLabel = getUomLabel(rm.unitId);
    const isKg = /kg|kilogram/i.test(uomLabel);
    const isL = /l|liter|litre/i.test(uomLabel);
    const subUomLabel = isKg ? 'g' : (isL ? 'ml' : null);

    setBom([...bom, {
      rmId: rm.id,
      name: rm.name,
      code: rm.code,
      unitPrice: Number(rm.ratePerUnit || 0),
      consumption: 1,
      totalCost: Number(rm.ratePerUnit || 0),
      currentStock: Number(rm.currentStock || 0),
      uomLabel,
      subUomLabel,
      selectedUnit: 'base'
    }]);
    setSelectedRmId('');
  };

  const handleRmQtyChange = (index, value) => {
    const updated = [...bom];
    const val = Number(value) || 0;
    updated[index].consumption = val;

    if (updated[index].selectedUnit === 'sub') {
      updated[index].totalCost = (val / 1000) * updated[index].unitPrice;
    } else {
      updated[index].totalCost = val * updated[index].unitPrice;
    }
    setBom(updated);
  };

  const handleRmUnitToggle = (index, newUnitType) => {
    const updated = [...bom];
    const oldUnitType = updated[index].selectedUnit || 'base';
    if (oldUnitType === newUnitType) return;

    updated[index].selectedUnit = newUnitType;
    let newQty = updated[index].consumption;

    if (newUnitType === 'sub') {
      newQty = newQty * 1000;
    } else {
      newQty = newQty / 1000;
    }

    updated[index].consumption = Number(newQty.toFixed(4));
    if (newUnitType === 'sub') {
      updated[index].totalCost = (updated[index].consumption / 1000) * updated[index].unitPrice;
    } else {
      updated[index].totalCost = updated[index].consumption * updated[index].unitPrice;
    }

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
      bom: bom.map(b => {
        const actualConsumption = b.selectedUnit === 'sub' ? Number(b.consumption) / 1000 : Number(b.consumption);
        return {
          rmId: b.rmId,
          consumption: actualConsumption,
          unitPrice: Number(b.unitPrice),
          totalCost: Number(b.totalCost)
        };
      }),
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
    <div className="space-y-6 max-w-6xl mx-auto p-4 animate__animated animate__fadeIn">
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
          className="bg-indigo-600 dark:bg-indigo-500 hover:bg-indigo-700 dark:hover:bg-indigo-600 text-white font-bold rounded-xl text-xs py-2.5 px-5 shadow-md hover:shadow-lg transition-all"
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
                                    step={item.selectedUnit === 'sub' ? '1' : '0.0001'}
                                    className="h-8 w-24 text-right font-bold bg-white dark:bg-slate-900 border border-slate-205 dark:border-slate-750 text-slate-855 dark:text-white rounded-xl focus:ring-indigo-505"
                                    value={item.consumption}
                                    onChange={(e) => handleRmQtyChange(idx, e.target.value)}
                                  />
                                  {item.subUomLabel ? (
                                    <select
                                      value={item.selectedUnit || 'base'}
                                      onChange={(e) => handleRmUnitToggle(idx, e.target.value)}
                                      className="h-8 bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-800 rounded-xl px-1 text-2xs font-bold text-slate-650 dark:text-slate-300 focus:outline-none"
                                    >
                                      <option value="base">{item.uomLabel}</option>
                                      <option value="sub">{item.subUomLabel}</option>
                                    </select>
                                  ) : (
                                    <span className="text-2xs font-bold text-slate-455 w-8 text-left">{item.uomLabel}</span>
                                  )}
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
          <div className="bg-slate-50 dark:bg-slate-905 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl space-y-4 sticky top-6 shadow-md transition-all">
            <div>
              <h4 className="font-extrabold text-sm text-slate-855 dark:text-white flex items-center">
                <Sparkles className="w-4 h-4 mr-1.5 text-indigo-505 dark:text-indigo-400 animate-pulse" /> Cost Summary Matrix
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
              className="w-full bg-indigo-600 hover:bg-indigo-750 dark:bg-indigo-500 dark:hover:bg-indigo-600 text-white font-bold py-2.5 rounded-xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer"
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
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [view, setView] = useState('list'); // 'list' | 'add' | 'edit'
  const [displayMode, setDisplayMode] = useState('grid'); // 'grid' | 'table' (WOW UX factor)
  const [editId, setEditId] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const itemsPerPage = 8; // 8 items look cleaner in grids

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
        html: '<p class="text-xs text-slate-500 dark:text-slate-400 mt-1">Selected product configurations removed.</p>',
        icon: 'success',
        confirmButtonColor: '#10b981',
        background: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)',
        color: isDark ? '#f8fafc' : '#0f172a',
      });
    }
  });

  const handleDelete = (id) => {
    const isDark = document.documentElement.classList.contains('dark');
    Swal.fire({
      title: '<span class="font-bold text-sm text-slate-800 dark:text-slate-100">Delete Product Configuration?</span>',
      text: 'Are you sure you want to delete this finished product specification? This will archive all recipe settings.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Yes, delete it!',
      background: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)',
      color: isDark ? '#f8fafc' : '#0f172a',
    }).then((result) => {
      if (result.isConfirmed) {
        deleteMutation.mutate(id);
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
      title: '<span class="font-bold text-sm text-slate-800 dark:text-slate-100">Bulk Delete Products?</span>',
      text: `Are you sure you want to bulk delete the ${selectedIds.length} selected finished product formulations?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      confirmButtonText: 'Yes, delete selected!',
      background: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)',
      color: isDark ? '#f8fafc' : '#0f172a',
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

  if (isLoading) return <div className="p-8"><Skeleton className="h-[400px] w-full bg-slate-200 dark:bg-slate-850" /></div>;

  if (view !== 'list') {
    return <ProductForm editId={editId} onBack={() => setView('list')} />;
  }

  return (
    <div className="space-y-6 animate__animated animate__fadeIn">
      {/* Premium Glassmorphic Header */}
      <div className="relative bg-gradient-to-r from-slate-50 to-slate-100/50 dark:from-slate-900 dark:to-slate-950/40 border border-slate-200 dark:border-slate-800 p-6 rounded-3xl shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="absolute inset-0 bg-grid-slate-200/50 dark:bg-grid-slate-800/10 [mask-image:linear-gradient(0deg,white,rgba(255,255,255,0.6))] rounded-3xl" />
        <div className="relative flex items-center space-x-4">
          <div className="p-3 bg-indigo-600 dark:bg-indigo-500 text-white rounded-2xl shadow-lg shadow-indigo-600/10 dark:shadow-indigo-500/10 animate-pulse">
            <Package className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
              Finished Product Master Setup
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xl">
              Configure finished product specifications, raw material BOM ratios, processing workflows, and selling prices.
            </p>
          </div>
        </div>
        <div className="relative flex items-center gap-3 w-full md:w-auto justify-end">
          {/* List/Grid Layout Selector */}
          <div className="flex bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-1 rounded-xl shadow-inner">
            <button
              onClick={() => setDisplayMode('grid')}
              className={`p-1.5 rounded-lg transition-all cursor-pointer ${displayMode === 'grid' ? 'bg-indigo-50 dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs' : 'text-slate-400 hover:text-slate-600'}`}
              title="Gallery Grid View"
            >
              <Grid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setDisplayMode('table')}
              className={`p-1.5 rounded-lg transition-all cursor-pointer ${displayMode === 'table' ? 'bg-indigo-50 dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs' : 'text-slate-400 hover:text-slate-600'}`}
              title="Standard Table List"
            >
              <ListIcon className="w-4 h-4" />
            </button>
          </div>

          <Button 
            onClick={() => { setEditId(null); setView('add'); }}
            className="bg-indigo-600 hover:bg-indigo-750 dark:bg-indigo-500 dark:hover:bg-indigo-600 text-white font-bold text-xs rounded-xl shadow-md hover:shadow-lg hover:-translate-y-[1px] transition-all px-5 h-10 flex items-center cursor-pointer"
          >
            <Plus className="w-4 h-4 mr-1.5" /> Add New Spec
          </Button>
        </div>
      </div>

      {/* Bulk actions banner */}
      {selectedIds.length > 0 && (
        <div className="bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/60 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm animate__animated animate__fadeIn">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-indigo-600 text-white font-bold text-xs shadow-md">
              {selectedIds.length}
            </div>
            <div>
              <p className="text-xs font-bold text-slate-800 dark:text-white">Formulations Selected</p>
              <p className="text-[10px] text-slate-450 dark:text-slate-400">Perform bulk operations on selected entries.</p>
            </div>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              onClick={() => setSelectedIds([])}
              className="px-3 py-1.5 text-[11px] font-bold text-slate-550 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-all cursor-pointer"
            >
              Clear
            </button>
            <button
              onClick={handleBulkDelete}
              className="flex items-center px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-[11px] font-bold transition-all shadow-sm cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Delete Selected ({selectedIds.length})
            </button>
          </div>
        </div>
      )}

      {/* Search Header toolbar */}
      <div className="p-4 bg-slate-50/45 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 shadow-xs">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <input 
            type="text" 
            placeholder="Search specifications by name/code..." 
            value={searchTerm} 
            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }} 
            className="w-full pl-9 pr-4 py-2 border border-slate-200 dark:border-slate-805 rounded-xl text-xs bg-white dark:bg-slate-950 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500" 
          />
        </div>
        <div className="text-2xs text-slate-400 uppercase font-extrabold tracking-wider">
          Total: {filtered.length} Specs Registered
        </div>
      </div>

      {/* RENDER GRID MODE */}
      {displayMode === 'grid' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6 animate__animated animate__fadeIn">
          {paginated.length === 0 ? (
            <div className="col-span-full py-16 text-center text-slate-400 dark:text-slate-500 font-medium bg-slate-50 dark:bg-slate-900/20 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-3xl">
              <Package className="w-10 h-10 mx-auto text-slate-350 dark:text-slate-650 mb-3 animate-bounce" />
              No finished product specifications found.<br />Click Add New Spec above to create your first recipe formula.
            </div>
          ) : (
            paginated.map((item) => (
              <Card 
                key={item.id} 
                className="group overflow-hidden border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs hover:shadow-lg hover:-translate-y-1 transition-all duration-300 rounded-2xl flex flex-col h-full"
              >
                {/* Image top placeholder */}
                <div className="bg-gradient-to-br from-indigo-50/50 to-purple-50/50 dark:from-slate-950/40 dark:to-slate-950/20 aspect-video relative flex items-center justify-center border-b border-slate-100 dark:border-slate-800/80 overflow-hidden shrink-0">
                  {item.imageUrl ? (
                    <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                  ) : (
                    <div className="flex flex-col items-center justify-center text-slate-350 dark:text-slate-650">
                      <ImageIcon className="w-8 h-8 mb-1" />
                      <span className="text-[9px] uppercase tracking-wider font-bold">No Image Setup</span>
                    </div>
                  )}
                  {/* Select Checkbox bubble overlay */}
                  <div className="absolute top-2.5 left-2.5 z-10">
                    <TableCheckbox
                      checked={selectedIds.includes(item.id)}
                      onChange={() => handleSelectRow(item.id)}
                    />
                  </div>
                  {/* Code Badge overlay */}
                  <div className="absolute top-2.5 right-2.5 px-2 py-0.5 bg-slate-900/80 backdrop-blur-md rounded-md text-[10px] font-bold font-mono text-white tracking-wider">
                    {item.code}
                  </div>
                </div>

                <CardContent className="p-4 flex-1 flex flex-col justify-between">
                  <div className="space-y-1.5">
                    {/* Category Tag */}
                    <span className="inline-flex items-center px-2 py-0.5 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-400 border border-indigo-100/50 dark:border-indigo-900/40 text-[9px] font-bold rounded-lg uppercase tracking-wide">
                      <Tag className="w-2.5 h-2.5 mr-1" /> {item.category?.name || 'Uncategorized'}
                    </span>
                    <h4 className="font-extrabold text-slate-850 dark:text-slate-100 text-sm line-clamp-1 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                      {item.name}
                    </h4>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                      UOM: {item.unit?.abbreviation || item.unit?.name || 'N/A'}
                    </p>
                  </div>

                  <div className="space-y-2 border-t border-slate-100 dark:border-slate-800/80 pt-3 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400 font-medium">BOM Ingredients:</span>
                      <span className="font-bold text-slate-700 dark:text-slate-350">{item.bom?.length || 0} items</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400 font-medium">Ingredient Cost:</span>
                      <span className="font-mono font-bold text-slate-700 dark:text-slate-350">₹{parseFloat(item.totalRawMaterialCost || 0).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400 font-medium">Overhead Cost:</span>
                      <span className="font-mono font-bold text-slate-700 dark:text-slate-350">₹{parseFloat(item.totalNonInventoryCost || 0).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center border-t border-slate-100 dark:border-slate-800/60 pt-1">
                      <span className="text-slate-400 font-medium">Total Cost:</span>
                      <span className="font-mono font-bold text-slate-700 dark:text-slate-350">₹{parseFloat(item.totalCost || 0).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center border-t border-dashed border-slate-100 dark:border-slate-800/80 pt-2">
                      <span className="font-extrabold text-indigo-650 dark:text-indigo-400 uppercase text-[10px]">Selling Price:</span>
                      <span className="font-mono font-extrabold text-slate-900 dark:text-white text-sm">₹{parseFloat(item.salePrice || 0).toFixed(2)}</span>
                    </div>
                  </div>

                  {/* Quick Action buttons */}
                  <div className="flex items-center gap-2 pt-1 shrink-0">
                    <Button
                      size="sm"
                      onClick={() => { setEditId(item.id); setView('edit'); }}
                      className="flex-1 bg-slate-50 dark:bg-slate-800/60 hover:bg-indigo-50 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 hover:text-indigo-600 hover:border-indigo-200/50 rounded-xl text-xs py-1.5 font-bold transition-all border border-slate-200 dark:border-slate-750 cursor-pointer"
                    >
                      <Edit className="w-3.5 h-3.5 mr-1" /> Edit Specs
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDelete(item.id)}
                      className="p-2 text-rose-500 hover:text-rose-650 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-xl transition-all cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}

      {/* RENDER TABLE VIEW MODE */}
      {displayMode === 'table' && (
        <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-md overflow-hidden rounded-2xl animate__animated animate__fadeIn">
          <CardContent className="p-0">
            <div className="overflow-x-auto text-xs">
              <Table>
                <TableHeader className="bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 uppercase font-semibold">
                  <TableRow className="dark:border-slate-800">
                    <TableHead className="w-[50px] text-center">
                      <TableCheckbox
                        checked={isAllVisibleSelected}
                        indeterminate={isSomeVisibleSelected}
                        onChange={() => handleSelectAll(paginated)}
                      />
                    </TableHead>
                    <TableHead className="w-24">Code</TableHead>
                    <TableHead>Specification Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">BOM RM Cost</TableHead>
                    <TableHead className="text-right">Overheads</TableHead>
                    <TableHead className="text-right">Total Unit Cost</TableHead>
                    <TableHead className="text-right text-indigo-600 dark:text-indigo-400">Selling Price</TableHead>
                    <TableHead className="text-center w-24">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {paginated.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-12 text-slate-450 italic">
                        No finished product specifications found. Click Add New Spec to assign recipes.
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginated.map((item) => (
                      <TableRow key={item.id} className="dark:border-slate-800 hover:bg-slate-50/50 dark:hover:bg-slate-950/10 transition-colors">
                        <TableCell className="text-center">
                          <TableCheckbox
                            checked={selectedIds.includes(item.id)}
                            onChange={() => handleSelectRow(item.id)}
                          />
                        </TableCell>
                        <TableCell className="font-mono text-slate-500 font-bold">{item.code}</TableCell>
                        <TableCell className="font-bold text-slate-850 dark:text-slate-100">{item.name}</TableCell>
                        <TableCell>
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-lg text-[10px] font-bold bg-slate-100 dark:bg-slate-900 text-slate-650 dark:text-slate-355 border border-slate-200/40 dark:border-slate-800">
                            <Tag className="w-2.5 h-2.5 mr-1 text-slate-400" /> {item.category?.name || 'N/A'}
                          </span>
                        </TableCell>
                        <td className="p-3 text-right font-mono dark:text-slate-355">₹{parseFloat(item.totalRawMaterialCost || 0).toFixed(2)}</td>
                        <td className="p-3 text-right font-mono dark:text-slate-355">₹{parseFloat(item.totalNonInventoryCost || 0).toFixed(2)}</td>
                        <td className="p-3 text-right font-mono font-bold dark:text-white">₹{parseFloat(item.totalCost || 0).toFixed(2)}</td>
                        <td className="p-3 text-right font-mono font-extrabold text-indigo-650 dark:text-indigo-400">₹{parseFloat(item.salePrice || 0).toFixed(2)}</td>
                        <TableCell className="text-center font-bold">
                          <div className="flex items-center justify-center space-x-1">
                            <button 
                              onClick={() => { setEditId(item.id); setView('edit'); }}
                              className="p-1.5 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 rounded transition-colors cursor-pointer"
                              title="Edit Specification Details"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => handleDelete(item.id)} 
                              className="p-1.5 text-rose-555 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded transition-colors cursor-pointer"
                              title="Delete Specification"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pagination Footer */}
      <div className="p-4 bg-slate-50/20 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl flex flex-col sm:flex-row justify-between items-center gap-4 text-xs text-slate-455">
        <div>
          Showing {filtered.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filtered.length)} of {filtered.length} entries
        </div>
        <div className="flex space-x-1">
          <button 
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))} 
            disabled={currentPage === 1} 
            className="px-3 py-1 border dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 disabled:opacity-50 font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer text-slate-700 dark:text-slate-350"
          >
            Previous
          </button>
          {Array.from({ length: totalPages }).map((_, i) => (
            <button 
              key={i} 
              onClick={() => setCurrentPage(i + 1)} 
              className={`px-3 py-1 border rounded-lg transition-colors font-bold cursor-pointer ${currentPage === i + 1 ? 'bg-indigo-600 dark:bg-indigo-500 text-white border-indigo-600' : 'bg-white dark:bg-slate-900 dark:border-slate-700 text-slate-700 dark:text-slate-350 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
            >
              {i + 1}
            </button>
          ))}
          <button 
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} 
            disabled={currentPage === totalPages || totalPages === 0} 
            className="px-3 py-1 border dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 disabled:opacity-50 font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer text-slate-700 dark:text-slate-350"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
