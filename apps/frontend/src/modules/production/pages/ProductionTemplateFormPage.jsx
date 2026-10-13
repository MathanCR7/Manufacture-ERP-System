import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '@/lib/axios';
import { 
  FileText, ArrowLeft, Plus, Trash2, ArrowUp, ArrowDown, Database, 
  Sparkles, Save, Check, RefreshCw, AlertCircle, Info, Calculator, Tag,
  Layers, Zap
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import CostingSummaryFooter from '../components/CostingSummaryFooter';
import ProductionSearchSelect from '../components/ProductionSearchSelect';
import UomSearchSelect from '@/components/ui/UomSearchSelect';
import useAuthStore from '@/app/store/authStore';
import Swal from 'sweetalert2';

const formatCurrency = (val) => {
  return Number(val || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
};

// 11 Standard Overhead Lines from Image 2
const STANDARD_EXCEL_OVERHEADS = [
  { rawMaterialName: 'Gas', quantity: 15, uom: 'Kg', rate: 170.11, total: 2551.58, isOverhead: true },
  { rawMaterialName: 'EB', quantity: 50, uom: 'Unit', rate: 15.00, total: 750.00, isOverhead: true },
  { rawMaterialName: 'Rent', quantity: 1, uom: 'Day', rate: 1166.67, total: 1166.67, isOverhead: true },
  { rawMaterialName: 'Resource', quantity: 700, uom: 'Nos', rate: 4.00, total: 2800.00, isOverhead: true },
  { rawMaterialName: 'RO Water Clean', quantity: 6, uom: 'Nos', rate: 20.00, total: 120.00, isOverhead: true },
  { rawMaterialName: 'Stick Cost', quantity: 2000, uom: 'Nos', rate: 0.25, total: 500.00, isOverhead: true },
  { rawMaterialName: 'Item Packing Cost', quantity: 2000, uom: 'Nos', rate: 0.30, total: 600.00, isOverhead: true },
  { rawMaterialName: 'Over Packing Cover', quantity: 2000, uom: 'Nos', rate: 0.20, total: 400.00, isOverhead: true },
  { rawMaterialName: 'Lable and Printing Cost', quantity: 2000, uom: 'Nos', rate: 0.10, total: 200.00, isOverhead: true },
  { rawMaterialName: 'Machine and Mould Cost', quantity: 1, uom: 'Nos', rate: 0, total: 0, isOverhead: true },
  { rawMaterialName: 'Storage / Holding Cost', quantity: 1, uom: 'Nos', rate: 0, total: 0, isOverhead: true }
];

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

  // Handle adding new empty raw material line
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

  // Handle adding overhead line (manual entry)
  const handleAddOverheadRow = () => {
    setLines(prev => {
      const nextSeq = prev.length + 1;
      return [
        ...prev,
        {
          id: `ovh-${Date.now()}`,
          seqNo: nextSeq,
          itemType: 'OVERHEAD',
          rawMaterialId: '',
          rawMaterialName: 'New Overhead Cost',
          quantity: 1,
          uom: 'Nos',
          rate: 0,
          rateSource: 'MANUAL_ENTRY',
          rateOverrideReason: 'Operational Overhead',
          total: 0,
          isOverhead: true
        }
      ];
    });
  };

  // Apply all 11 standard overheads from Image 2
  const handleApplyStandardExcelOverheads = () => {
    setLines(prev => {
      const existingNames = new Set(prev.map(l => (l.rawMaterialName || '').toLowerCase().trim()));
      const newItems = STANDARD_EXCEL_OVERHEADS.filter(o => !existingNames.has(o.rawMaterialName.toLowerCase().trim()));
      if (newItems.length === 0) {
        Swal.fire({ title: 'Notice', text: 'All standard overhead lines are already added to this template.', icon: 'info' });
        return prev;
      }
      let seq = prev.length + 1;
      const mapped = newItems.map(item => ({
        id: `ovh-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        seqNo: seq++,
        itemType: 'OVERHEAD',
        rawMaterialId: '',
        rawMaterialName: item.rawMaterialName,
        quantity: item.quantity,
        uom: item.uom,
        rate: item.rate,
        rateSource: 'EXCEL_STANDARD',
        rateOverrideReason: 'Excel Costing Preset',
        total: item.total,
        isOverhead: true
      }));
      return [...prev, ...mapped];
    });

    Swal.fire({
      title: 'Standard Overheads Added',
      text: 'Gas, EB, Rent, Resource, RO Water, Stick & Packing expenses successfully added.',
      icon: 'success',
      timer: 1500
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
      if (!l.rawMaterialName && !l.rawMaterialId) {
        Swal.fire({ title: 'Validation', text: `Please select or enter an item name for Row #${i + 1}.`, icon: 'warning' });
        return;
      }
      if (Number(l.quantity) <= 0) {
        Swal.fire({ title: 'Validation', text: `Quantity for "${l.rawMaterialName || `Row #${i + 1}`}" must be greater than 0.`, icon: 'warning' });
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
        itemType: l.itemType || (l.isOverhead ? 'OVERHEAD' : 'RAW_MATERIAL'),
        rawMaterialId: l.rawMaterialId || `ovh-${idx + 1}-${Date.now()}`,
        rawMaterialName: l.rawMaterialName || 'Operational Expense',
        quantity: Number(l.quantity),
        uom: l.uom || 'Nos',
        rate: Number(l.rate || 0),
        rateSource: l.rateSource || 'MANUAL_ENTRY',
        rateOverrideReason: l.rateOverrideReason || null,
        total: Number(l.total || (Number(l.quantity) * Number(l.rate || 0))),
        isOverhead: Boolean(l.isOverhead)
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
              Target Output UOM
            </Label>
            <UomSearchSelect
              value={formData.outputUom}
              onChange={(val) => setFormData(prev => ({ ...prev, outputUom: val }))}
              extraOptions={uoms}
              placeholder="Select Target UOM..."
              searchPlaceholder="Search UOM (Nos, Box, Liter, Pack)..."
              triggerClassName="h-10 rounded-xl font-bold bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
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

      {/* ── DYNAMIC RAW MATERIAL & OVERHEAD GRID ── */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl p-5 shadow-xs space-y-4">
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                Raw Material Formulation & Costing Lines
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-mono">
                  {lines.length} {lines.length === 1 ? 'item' : 'items'}
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Units fetched from Item Setup (/setup/raw-material) with manual operational overheads (Gas, EB, Rent, Packing...)
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleApplyStandardExcelOverheads}
              className="rounded-xl border-amber-300 dark:border-amber-800 bg-amber-50/60 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 font-bold text-xs h-9 hover:bg-amber-100 dark:hover:bg-amber-900/50 cursor-pointer shadow-2xs"
              title="Add 11 Standard Expenses from Image 2: Gas, EB, Rent, Resource, RO Water, Stick, Packing, Labels, Mould..."
            >
              <Zap className="w-3.5 h-3.5 mr-1.5 text-amber-600" />
              ⚡ Add Standard Overheads from Excel
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddOverheadRow}
              className="rounded-xl border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 font-bold text-xs h-9 hover:bg-slate-50 dark:hover:bg-slate-850 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 mr-1 text-purple-600" />
              + Add Overhead / Packing Line
            </Button>

            <Button
              type="button"
              size="sm"
              onClick={handleAddRow}
              className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs h-9 shadow-2xs cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              + Add Raw Material
            </Button>
          </div>
        </div>

        {/* Lines Table */}
        <div className="border border-slate-200/80 dark:border-slate-800 rounded-2xl overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/90 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  <th className="py-3 px-3 text-center w-16">#</th>
                  <th className="py-3 px-3 w-32">Type</th>
                  <th className="py-3 px-3 min-w-[280px]">Item / Cost Description</th>
                  <th className="py-3 px-3 text-right w-28">Quantity</th>
                  <th className="py-3 px-3 w-40 min-w-[140px]">UOM</th>
                  {canViewCosting ? (
                    <>
                      <th className="py-3 px-3 text-right w-32">Rate (₹)</th>
                      <th className="py-3 px-3 text-right w-32">Total (₹)</th>
                    </>
                  ) : null}
                  <th className="py-3 px-3 text-center w-16">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {lines.map((row, idx) => (
                  <tr 
                    key={row.id || idx} 
                    className="hover:bg-slate-50/60 dark:hover:bg-slate-850/40 transition-colors"
                  >
                    {/* Seq & Reorder */}
                    <td className="py-2.5 px-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <span className="font-mono font-bold text-slate-400 text-xs w-4">
                          {row.seqNo || (idx + 1)}
                        </span>
                        <div className="flex flex-col">
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={() => handleMoveRow(idx, -1)}
                            className="p-0.5 text-slate-400 hover:text-indigo-600 disabled:opacity-20 cursor-pointer"
                            title="Move Up"
                          >
                            <ArrowUp className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            disabled={idx === lines.length - 1}
                            onClick={() => handleMoveRow(idx, 1)}
                            className="p-0.5 text-slate-400 hover:text-indigo-600 disabled:opacity-20 cursor-pointer"
                            title="Move Down"
                          >
                            <ArrowDown className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </td>

                    {/* Type Badge */}
                    <td className="py-2.5 px-3">
                      {row.isOverhead || row.itemType === 'OVERHEAD' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200 dark:border-purple-850">
                          <Zap className="w-2.5 h-2.5 text-purple-600" />
                          Overhead
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-850">
                          🌾 Ingredient
                        </span>
                      )}
                    </td>

                    {/* Item Name / ProductionSearchSelect */}
                    <td className="py-2.5 px-3">
                      {row.isOverhead && !row.rawMaterialId ? (
                        <div className="space-y-1">
                          <Input
                            value={row.rawMaterialName}
                            onChange={(e) => handleFieldChange(idx, 'rawMaterialName', e.target.value)}
                            placeholder="e.g. Gas, EB, Rent, Stick Cost, Packing..."
                            className="h-9 rounded-xl font-bold text-xs bg-purple-50/30 dark:bg-purple-950/20 border-purple-200 dark:border-purple-800"
                          />
                          <span className="text-[10px] text-slate-400 block font-mono">
                            Manual operational expense / service line
                          </span>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <ProductionSearchSelect
                            value={row.rawMaterialId}
                            onChange={(val) => handleMaterialChange(idx, val)}
                            options={materialOptions}
                            placeholder="Search raw material or catalog item..."
                          />
                          {row.rateOverrideReason && (
                            <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium block">
                              Source: {row.rateOverrideReason}
                            </span>
                          )}
                        </div>
                      )}
                    </td>

                    {/* Quantity */}
                    <td className="py-2.5 px-3 text-right">
                      <Input
                        type="number"
                        step="any"
                        min="0"
                        value={row.quantity}
                        onChange={(e) => handleFieldChange(idx, 'quantity', e.target.value)}
                        className="h-9 w-24 ml-auto rounded-xl font-mono font-bold text-right text-xs"
                      />
                    </td>

                    {/* UOM */}
                    <td className="py-2.5 px-3 min-w-[140px]">
                      <UomSearchSelect
                        value={row.uom}
                        onChange={(val) => handleFieldChange(idx, 'uom', val)}
                        extraOptions={uoms}
                        placeholder="Select UOM..."
                        searchPlaceholder="Search UOM..."
                        size="sm"
                        triggerClassName="h-9 rounded-xl font-mono font-bold text-xs bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700"
                      />
                    </td>

                    {/* Rate & Total (Hidden for Production Role) */}
                    {canViewCosting ? (
                      <>
                        <td className="py-2.5 px-3 text-right">
                          <Input
                            type="number"
                            step="any"
                            min="0"
                            value={row.rate}
                            onChange={(e) => handleFieldChange(idx, 'rate', e.target.value)}
                            className="h-9 w-28 ml-auto rounded-xl font-mono font-bold text-right text-xs"
                          />
                          <span className="text-[9px] text-slate-400 block font-mono mt-0.5">
                            {row.rateSource || 'MANUAL'}
                          </span>
                        </td>

                        <td className="py-2.5 px-3 text-right font-mono font-black text-slate-900 dark:text-white text-xs">
                          ₹{formatCurrency(row.total)}
                        </td>
                      </>
                    ) : null}

                    {/* Action */}
                    <td className="py-2.5 px-3 text-center">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteRow(idx)}
                        disabled={lines.length <= 1}
                        className="h-8 w-8 p-0 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 cursor-pointer disabled:opacity-20"
                        title="Delete line"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
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
