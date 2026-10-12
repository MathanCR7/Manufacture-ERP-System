import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '@/lib/axios';
import { 
  FileText, ArrowLeft, Plus, Trash2, ArrowUp, ArrowDown, Database, 
  Sparkles, Save, Check, RefreshCw, AlertCircle, Info, Calculator, Tag
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import CostingSummaryFooter from '../components/CostingSummaryFooter';
import ProductionSearchSelect from '../components/ProductionSearchSelect';
import Swal from 'sweetalert2';

export default function ProductionTemplateFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);

  // Masters
  const [bases, setBases] = useState([]);
  const [rawMaterials, setRawMaterials] = useState([]);
  const [nonInventoryItems, setNonInventoryItems] = useState([]);
  const [uoms, setUoms] = useState([]);
  const [categories, setCategories] = useState([]);
  const [subcategories, setSubcategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Template Form State
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    baseId: '',
    categoryId: '',
    subCategoryId: '',
    outputQty: 2000,
    outputUom: 'Nos',
    wastagePct: 6.0,
    overheadPct: 10.0,
    status: 'ACTIVE',
  });

  // Raw Material Lines
  const [lines, setLines] = useState([
    {
      id: 'row-1',
      seqNo: 1,
      itemType: 'RAW_MATERIAL',
      rawMaterialId: '',
      rawMaterialName: '',
      quantity: 1,
      uom: 'Kg',
      rate: 0,
      rateSource: 'LATEST_PO',
      rateOverrideReason: '',
      total: 0,
      isOverhead: false,
    }
  ]);

  // Combined item catalog (Raw Materials + Overheads / Non-Inventory)
  const allSelectableMaterials = useMemo(() => {
    const list = [];
    (rawMaterials || []).forEach(rm => {
      list.push({
        id: rm.id,
        code: rm.code || 'RM',
        name: rm.name,
        type: 'RAW_MATERIAL',
        category: rm.category?.name || 'Raw Material',
        defaultUom: rm.consumptionUnit || rm.unitId || 'Kg',
        defaultRate: Number(rm.ratePerUnit || 0),
        isOverhead: false,
        hasAlternateUom: Boolean(rm.hasAlternateUom),
        alternateUom: rm.alternateUom || null,
        baseUomQty: Number(rm.baseUomQty || 1),
        alternateUomQty: Number(rm.alternateUomQty || 1),
        conversionFactor: Number(rm.conversionFactor || 1)
      });
    });

    (nonInventoryItems || []).forEach(ni => {
      list.push({
        id: ni.id,
        code: ni.code || 'OVH',
        name: ni.name,
        type: 'OVERHEAD',
        category: ni.category || 'Overhead / Energy / Resource',
        defaultUom: ni.consumptionUnit || 'Nos',
        defaultRate: Number(ni.ratePerUnit || 0),
        isOverhead: true
      });
    });

    return list;
  }, [rawMaterials, nonInventoryItems]);

  // Options formatted for ProductionSearchSelect dropdowns
  const materialOptions = useMemo(() => {
    return allSelectableMaterials.map(m => ({
      value: m.id,
      label: m.name,
      subLabel: m.code,
      badge: m.type === 'RAW_MATERIAL' ? '🌾 Raw Material' : '⚡ Overhead',
      extra: `Category: ${m.category} • Default Rate: ₹${m.defaultRate} / ${m.defaultUom}`,
      type: m.type,
      raw: m
    }));
  }, [allSelectableMaterials]);

  const baseOptions = useMemo(() => {
    return bases.map(b => ({
      value: b.id,
      label: b.name,
      subLabel: b.code,
      badge: b.status === 'ACTIVE' ? 'Active' : 'Inactive'
    }));
  }, [bases]);

  // Load masters & template (if edit)
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const [bRes, rmRes, nonInvRes, uomRes, catRes, subRes] = await Promise.all([
          api.get('/production/bases'),
          api.get('/item-setup/raw-material').catch(() => ({ data: [] })),
          api.get('/item-setup/non-inventory-item').catch(() => ({ data: [] })),
          api.get('/uom').catch(() => ({ data: [] })),
          api.get('/item-setup/product-category').catch(() => ({ data: [] })),
          api.get('/product-subcategories').catch(() => ({ data: [] })),
        ]);

        setBases(bRes.data || []);
        setRawMaterials(rmRes.data || []);
        setNonInventoryItems(nonInvRes.data || []);
        setUoms(uomRes.data || []);
        setCategories(catRes.data || []);
        setSubcategories(subRes.data || []);

        if (isEdit) {
          const tplRes = await api.get(`/production/templates/${id}`);
          const t = tplRes.data;
          setFormData({
            code: t.code,
            name: t.name,
            baseId: t.baseId,
            categoryId: t.categoryId || '',
            subCategoryId: t.subCategoryId || '',
            outputQty: Number(t.outputQty || 2000),
            outputUom: t.outputUom || 'Nos',
            wastagePct: Number(t.wastagePct || 6.0),
            overheadPct: Number(t.overheadPct || 10.0),
            status: t.status || 'ACTIVE'
          });

          if (Array.isArray(t.lines) && t.lines.length > 0) {
            setLines(t.lines.map((l, idx) => ({
              id: l.id || `row-${idx + 1}`,
              seqNo: l.seqNo || (idx + 1),
              itemType: l.itemType || 'RAW_MATERIAL',
              rawMaterialId: l.rawMaterialId,
              rawMaterialName: l.rawMaterialName,
              quantity: Number(l.quantity),
              uom: l.uom,
              rate: Number(l.rate),
              rateSource: l.rateSource || 'LATEST_PO',
              rateOverrideReason: l.rateOverrideReason || '',
              total: Number(l.total || (l.quantity * l.rate)),
              isOverhead: Boolean(l.isOverhead)
            })));
          }
        } else {
          // If creating new and bases exist, pre-select first active base
          const activeBases = (bRes.data || []).filter(b => b.status === 'ACTIVE');
          if (activeBases.length > 0) {
            setFormData(prev => ({ ...prev, baseId: activeBases[0].id }));
          }
        }
      } catch (err) {
        console.error('Initialization error:', err);
        Swal.fire({ title: 'Error', text: 'Failed to initialize form data.', icon: 'error' });
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [id, isEdit]);

  // Live Calculations
  const costingTotals = useMemo(() => {
    let sub = 0;
    lines.forEach(l => {
      sub += Number(l.total || 0);
    });
    sub = Number(sub.toFixed(2));
    const wPct = Number(formData.wastagePct || 0);
    const oPct = Number(formData.overheadPct || 0);
    const wAmt = Number(((sub * wPct) / 100).toFixed(2));
    const oAmt = Number(((sub * oPct) / 100).toFixed(2));
    const grand = Number((sub + wAmt + oAmt).toFixed(2));
    const outQ = Number(formData.outputQty || 1);
    const cpu = outQ > 0 ? Number((grand / outQ).toFixed(4)) : 0;

    return {
      subTotal: sub,
      wastageAmt: wAmt,
      overheadAmt: oAmt,
      grandTotal: grand,
      costPerUnit: cpu
    };
  }, [lines, formData.wastagePct, formData.overheadPct, formData.outputQty]);

  // Handle adding new empty line
  const handleAddRow = () => {
    setLines(prev => {
      const nextSeq = prev.length + 1;
      return [
        ...prev,
        {
          id: `row-${Date.now()}`,
          seqNo: nextSeq,
          itemType: 'RAW_MATERIAL',
          rawMaterialId: '',
          rawMaterialName: '',
          quantity: 1,
          uom: 'Kg',
          rate: 0,
          rateSource: 'LATEST_PO',
          rateOverrideReason: '',
          total: 0,
          isOverhead: false
        }
      ];
    });
  };

  // Handle deleting line
  const handleDeleteRow = (index) => {
    if (lines.length <= 1) {
      Swal.fire({ title: 'Notice', text: 'Template must have at least one raw material line.', icon: 'info' });
      return;
    }
    setLines(prev => {
      const updated = prev.filter((_, i) => i !== index);
      // Renumber sequence numbers
      return updated.map((r, i) => ({ ...r, seqNo: i + 1 }));
    });
  };

  // Move line up or down
  const handleMoveRow = (index, direction) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= lines.length) return;

    setLines(prev => {
      const updated = [...prev];
      const temp = updated[index];
      updated[index] = updated[targetIndex];
      updated[targetIndex] = temp;
      // Renumber sequence numbers
      return updated.map((r, i) => ({ ...r, seqNo: i + 1 }));
    });
  };

  // Handle selecting material in a row
  const handleMaterialChange = async (index, materialId) => {
    const matched = allSelectableMaterials.find(m => m.id === materialId);
    if (!matched) return;

    // Check duplicate
    const isDup = lines.some((l, i) => i !== index && l.rawMaterialId === materialId);
    if (isDup) {
      Swal.fire({
        title: 'Duplicate Item',
        text: `"${matched.name}" is already included in this template. Each raw material can only appear once.`,
        icon: 'warning'
      });
      return;
    }

    let resolvedRate = matched.defaultRate || 0;
    let rateSource = matched.isOverhead ? 'OVERHEAD_CATALOG' : 'CATALOG_DEFAULT';

    // Fetch live rate from PO if it is a raw material
    if (matched.type === 'RAW_MATERIAL') {
      try {
        const rateRes = await api.get(`/purchase/live-rate?rawMaterialId=${matched.id}&targetUom=${matched.defaultUom}`);
        if (rateRes.data && rateRes.data.rate > 0) {
          resolvedRate = Number(rateRes.data.rate);
          rateSource = rateRes.data.source || 'LATEST_PO';
        }
      } catch (err) {
        // Fallback to catalog default
      }
    }

    setLines(prev => {
      const updated = [...prev];
      const row = { ...updated[index] };
      row.rawMaterialId = matched.id;
      row.rawMaterialName = matched.name;
      row.itemType = matched.type;
      row.uom = matched.defaultUom || 'Kg';
      row.rate = resolvedRate;
      row.rateSource = rateSource;
      row.isOverhead = matched.isOverhead;
      row.total = Number((Number(row.quantity || 0) * resolvedRate).toFixed(2));
      updated[index] = row;
      return updated;
    });
  };

  // Handle qty or rate changes
  const handleFieldChange = (index, field, value) => {
    setLines(prev => {
      const updated = [...prev];
      const row = { ...updated[index] };
      row[field] = value;
      const q = field === 'quantity' ? Number(value || 0) : Number(row.quantity || 0);
      const r = field === 'rate' ? Number(value || 0) : Number(row.rate || 0);
      row.total = Number((q * r).toFixed(2));
      if (field === 'rate') {
        row.rateSource = 'MANUAL_OVERRIDE';
      }
      updated[index] = row;
      return updated;
    });
  };

  // Submit Handler
  const handleSave = async (andAddNew = false) => {
    if (!formData.name.trim()) {
      Swal.fire({ title: 'Validation', text: 'Please enter a Template Name.', icon: 'warning' });
      return;
    }
    if (!formData.baseId) {
      Swal.fire({ title: 'Validation', text: 'Please select a Base Master.', icon: 'warning' });
      return;
    }

    // Validate lines
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      if (!l.rawMaterialId) {
        Swal.fire({ title: 'Validation', text: `Please select a raw material for Row #${i + 1}.`, icon: 'warning' });
        return;
      }
      if (Number(l.quantity) <= 0) {
        Swal.fire({ title: 'Validation', text: `Quantity for "${l.rawMaterialName}" must be greater than 0.`, icon: 'warning' });
        return;
      }
    }

    const payload = {
      name: formData.name.trim(),
      baseId: formData.baseId,
      categoryId: formData.categoryId || null,
      subCategoryId: formData.subCategoryId || null,
      outputQty: Number(formData.outputQty),
      outputUom: formData.outputUom,
      wastagePct: Number(formData.wastagePct),
      overheadPct: Number(formData.overheadPct),
      status: formData.status,
      lines: lines.map((l, idx) => ({
        seqNo: idx + 1,
        itemType: l.itemType,
        rawMaterialId: l.rawMaterialId,
        rawMaterialName: l.rawMaterialName,
        quantity: Number(l.quantity),
        uom: l.uom,
        rate: Number(l.rate),
        rateSource: l.rateSource,
        rateOverrideReason: l.rateOverrideReason || null,
        total: Number(l.total),
        isOverhead: l.isOverhead
      }))
    };

    try {
      setSaving(true);
      if (isEdit) {
        await api.put(`/production/templates/${id}`, payload);
        Swal.fire({ title: 'Template Updated', text: 'Production template successfully updated.', icon: 'success', timer: 1500 });
        navigate('/production/templates');
      } else {
        const res = await api.post('/production/templates', payload);
        Swal.fire({ title: 'Template Created', text: `Created template ${res.data.name} (${res.data.code})`, icon: 'success', timer: 1500 });
        if (andAddNew) {
          setFormData(prev => ({ ...prev, name: '' }));
          setLines([{
            id: 'row-1',
            seqNo: 1,
            itemType: 'RAW_MATERIAL',
            rawMaterialId: '',
            rawMaterialName: '',
            quantity: 1,
            uom: 'Kg',
            rate: 0,
            rateSource: 'LATEST_PO',
            rateOverrideReason: '',
            total: 0,
            isOverhead: false
          }]);
        } else {
          navigate('/production/templates');
        }
      }
    } catch (err) {
      console.error('Save template failed:', err);
      const msg = err.response?.data?.error || 'Failed to save production template.';
      Swal.fire({ title: 'Error', text: msg, icon: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      
      {/* ── TOP NAV & TITLE ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/production/templates')}
            className="rounded-xl h-9 w-9 p-0 border-slate-200 dark:border-slate-800"
          >
            <ArrowLeft className="w-4 h-4 text-slate-600 dark:text-slate-300" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                {isEdit ? 'Edit Production Template' : 'Create Production Template'}
              </h1>
              {formData.code && (
                <span className="font-mono text-xs font-black bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 px-2.5 py-0.5 rounded-full border border-indigo-200 dark:border-indigo-800">
                  {formData.code}
                </span>
              )}
            </div>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
              Set standard recipe ingredients, live PO rates, wastage %, and overhead % by Base Name
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Button
            variant="outline"
            onClick={() => navigate('/production/templates')}
            className="rounded-xl h-9"
          >
            Cancel
          </Button>

          {!isEdit && (
            <Button
              variant="outline"
              disabled={saving}
              onClick={() => handleSave(true)}
              className="rounded-xl h-9 font-bold text-indigo-600 hover:bg-indigo-50"
            >
              Save & Add New
            </Button>
          )}

          <Button
            disabled={saving}
            onClick={() => handleSave(false)}
            className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-9 shadow-sm"
          >
            <Save className="w-4 h-4 mr-1.5" />
            {saving ? 'Saving...' : 'Save Template'}
          </Button>
        </div>
      </div>

      {/* ── TEMPLATE HEADER SPECIFICATIONS ── */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl p-5 shadow-xs space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
          <Database className="w-4 h-4 text-indigo-500" />
          <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-900 dark:text-white">
            1. Template Specifications & Base Assignment
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          
          {/* Base Name (Required) with Search Bar */}
          <div className="space-y-1">
            <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Base Name <span className="text-rose-500">*</span>
            </Label>
            <ProductionSearchSelect
              options={baseOptions}
              value={formData.baseId}
              onChange={(val) => setFormData(prev => ({ ...prev, baseId: val }))}
              placeholder="Search & select base (e.g. ICE CREAM BASE)..."
              searchPlaceholder="Type base name or code (e.g. ICB, KLB)..."
            />
          </div>

          {/* Template Name (Required) */}
          <div className="space-y-1 lg:col-span-2">
            <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Template Name <span className="text-rose-500">*</span>
            </Label>
            <Input
              placeholder="e.g. Classic Cream Gallon - Vanilla"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              className="h-10 rounded-xl font-bold"
              required
            />
          </div>

          {/* Status */}
          <div className="space-y-1">
            <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Status</Label>
            <select
              value={formData.status}
              onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value }))}
              className="w-full h-10 px-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold"
            >
              <option value="ACTIVE">ACTIVE</option>
              <option value="INACTIVE">INACTIVE</option>
            </select>
          </div>

          {/* Output Qty */}
          <div className="space-y-1">
            <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Target Output Quantity
            </Label>
            <Input
              type="number"
              min="1"
              value={formData.outputQty}
              onChange={(e) => setFormData(prev => ({ ...prev, outputQty: Number(e.target.value) }))}
              className="h-10 rounded-xl font-mono font-bold"
            />
          </div>

          {/* Output UOM */}
          <div className="space-y-1">
            <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Output UOM
            </Label>
            <Input
              value={formData.outputUom}
              onChange={(e) => setFormData(prev => ({ ...prev, outputUom: e.target.value }))}
              className="h-10 rounded-xl font-bold"
              placeholder="Nos, Gallon, Pack..."
            />
          </div>

          {/* Wastage % */}
          <div className="space-y-1">
            <Label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
              <span>Wastage & Negation %</span>
              <span className="text-[10px] text-amber-600 font-bold">Default 6%</span>
            </Label>
            <Input
              type="number"
              step="0.1"
              min="0"
              max="100"
              value={formData.wastagePct}
              onChange={(e) => setFormData(prev => ({ ...prev, wastagePct: Number(e.target.value) }))}
              className="h-10 rounded-xl font-mono font-bold"
            />
          </div>

          {/* Overhead % */}
          <div className="space-y-1">
            <Label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
              <span>Overhead Cost %</span>
              <span className="text-[10px] text-purple-600 font-bold">Default 10%</span>
            </Label>
            <Input
              type="number"
              step="0.1"
              min="0"
              max="100"
              value={formData.overheadPct}
              onChange={(e) => setFormData(prev => ({ ...prev, overheadPct: Number(e.target.value) }))}
              className="h-10 rounded-xl font-mono font-bold"
            />
          </div>

        </div>
      </div>

      {/* ── DYNAMIC RAW MATERIAL GRID ── */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Tag className="w-4 h-4 text-indigo-500" />
            <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-900 dark:text-white">
              2. Formulation Ingredients & Cost Heads ({lines.length} lines)
            </h2>
          </div>

          <Button
            type="button"
            onClick={handleAddRow}
            size="sm"
            className="rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:hover:bg-indigo-900 dark:text-indigo-300 font-bold h-8 text-xs border border-indigo-200 dark:border-indigo-800"
          >
            <Plus className="w-3.5 h-3.5 mr-1" />
            + Add Line Item
          </Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/75 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                <th className="py-2.5 px-3 w-16 text-center">Seq No</th>
                <th className="py-2.5 px-3 min-w-[240px]">Key Raw Material / Cost Head</th>
                <th className="py-2.5 px-3 w-28 text-center">Quantity</th>
                <th className="py-2.5 px-3 w-24 text-center">UOM</th>
                <th className="py-2.5 px-3 w-32 text-right">Rate (₹)</th>
                <th className="py-2.5 px-3 w-32 text-right">Total (₹)</th>
                <th className="py-2.5 px-3 w-24 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {lines.map((row, index) => (
                <tr key={row.id || index} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                  
                  {/* Seq No & Reorder buttons */}
                  <td className="py-2 px-3 text-center">
                    <div className="flex items-center justify-center gap-1 font-mono font-bold text-slate-500">
                      <span>{row.seqNo}</span>
                      <div className="flex flex-col">
                        <button
                          type="button"
                          onClick={() => handleMoveRow(index, -1)}
                          disabled={index === 0}
                          className="text-slate-400 hover:text-indigo-600 disabled:opacity-20 cursor-pointer"
                          title="Move Up"
                        >
                          <ArrowUp className="w-2.5 h-2.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMoveRow(index, 1)}
                          disabled={index === lines.length - 1}
                          className="text-slate-400 hover:text-indigo-600 disabled:opacity-20 cursor-pointer"
                          title="Move Down"
                        >
                          <ArrowDown className="w-2.5 h-2.5" />
                        </button>
                      </div>
                    </div>
                  </td>

                  {/* Material Searchable Dropdown with Embedded Search Bar */}
                  <td className="py-2 px-3">
                    <ProductionSearchSelect
                      options={materialOptions}
                      value={row.rawMaterialId}
                      onChange={(materialId) => handleMaterialChange(index, materialId)}
                      placeholder="Search & select raw material / cost head..."
                      searchPlaceholder="Type material name or code (e.g. Milk, Sugar, Flavor)..."
                      className="min-w-[260px]"
                      renderOption={(opt) => (
                        <div className="flex-1 truncate">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-extrabold text-slate-900 dark:text-white">
                              {opt.label}
                            </span>
                            <span className="font-mono text-[9px] font-black px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                              {opt.subLabel}
                            </span>
                            <span className="font-mono text-[9px] font-bold px-1.5 py-0.2 rounded bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400">
                              {opt.badge}
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-400 font-mono truncate mt-0.5">
                            {opt.extra}
                          </p>
                        </div>
                      )}
                    />

                    {row.rateSource && (
                      <span className="text-[9px] font-mono text-slate-400 block mt-0.5">
                        Source: {row.rateSource}
                      </span>
                    )}
                  </td>

                  {/* Quantity */}
                  <td className="py-2 px-3 text-center">
                    <Input
                      type="number"
                      step="any"
                      min="0"
                      value={row.quantity}
                      onChange={(e) => handleFieldChange(index, 'quantity', e.target.value)}
                      className="h-8 text-center font-mono font-bold text-xs rounded-lg"
                    />
                  </td>

                  {/* UOM */}
                  <td className="py-2 px-3 text-center">
                    <Input
                      value={row.uom}
                      onChange={(e) => handleFieldChange(index, 'uom', e.target.value)}
                      className="h-8 text-center font-bold text-xs rounded-lg"
                      placeholder="UOM"
                    />
                  </td>

                  {/* Rate */}
                  <td className="py-2 px-3 text-right">
                    <Input
                      type="number"
                      step="any"
                      min="0"
                      value={row.rate}
                      onChange={(e) => handleFieldChange(index, 'rate', e.target.value)}
                      className="h-8 text-right font-mono font-bold text-xs rounded-lg text-indigo-700 dark:text-indigo-400"
                    />
                  </td>

                  {/* Line Total */}
                  <td className="py-2 px-3 text-right font-mono font-extrabold text-slate-900 dark:text-white">
                    ₹{Number(row.total || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>

                  {/* Delete button */}
                  <td className="py-2 px-3 text-center">
                    <button
                      type="button"
                      onClick={() => handleDeleteRow(index)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                      title="Remove Row"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>

                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── COSTING SUMMARY FOOTER ── */}
      <CostingSummaryFooter 
        subTotal={costingTotals.subTotal}
        wastagePct={formData.wastagePct}
        wastageAmt={costingTotals.wastageAmt}
        overheadPct={formData.overheadPct}
        overheadAmt={costingTotals.overheadAmt}
        grandTotal={costingTotals.grandTotal}
        outputQty={formData.outputQty}
        outputUom={formData.outputUom}
        costPerUnit={costingTotals.costPerUnit}
        isEditable={false}
      />

    </div>
  );
}
