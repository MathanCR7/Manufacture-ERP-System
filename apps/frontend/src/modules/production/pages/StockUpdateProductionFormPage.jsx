import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '@/lib/axios';
import { 
  RotateCw, ArrowLeft, Save, CheckCircle2, RefreshCw, Calendar, 
  Layers, Clock, AlertCircle, Sparkles, Database, Tag
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import ProductionBasePicker from '../components/ProductionBasePicker';
import ProductionTemplatePicker from '../components/ProductionTemplatePicker';
import ProductionProductPicker from '../components/ProductionProductPicker';
import BatchAllocationGrid from '../components/BatchAllocationGrid';
import CostingSummaryFooter from '../components/CostingSummaryFooter';
import StandardFactoryStagesPalette from '../components/StandardFactoryStagesPalette';
import ProductionLabourPicker from '../components/ProductionLabourPicker';
import Swal from 'sweetalert2';

export default function StockUpdateProductionFormPage() {
  const navigate = useNavigate();

  // Master Data
  const [bases, setBases] = useState([]);
  const [allTemplates, setAllTemplates] = useState([]);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [subcategories, setSubcategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshingPrices, setRefreshingPrices] = useState(false);

  // Stock Update Specific Attributes
  const [adjustmentReason, setAdjustmentReason] = useState('Opening Stock');
  const [adjustmentReference, setAdjustmentReference] = useState('');
  const [productionDate, setProductionDate] = useState(new Date().toISOString().split('T')[0]);
  const [note, setNote] = useState('');

  // Production Labour Allocation State
  const [labourCount, setLabourCount] = useState(0);
  const [assignedStaffIds, setAssignedStaffIds] = useState([]);
  const [labourStaffDetails, setLabourStaffDetails] = useState([]);

  // Workflow State
  const [selectedBaseId, setSelectedBaseId] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState(null);

  // Standard Factory Stages Palette
  const [timelineStages, setTimelineStages] = useState([
    { id: 'ageing', name: 'Ageing', category: 'Thermal & Mixing', durationMonths: 0, durationDays: 0, durationHours: 0, durationMinutes: 0, desc: 'Mix aging in refrigerated vats at 4°C' },
    { id: 'vat', name: 'VAT', category: 'Thermal & Mixing', durationMonths: 0, durationDays: 0, durationHours: 0, durationMinutes: 0, desc: 'Holding and agitation in process tanks' },
    { id: 'cf', name: 'CF - Cont. Freezer', category: 'Freezing & Molding', durationMonths: 0, durationDays: 0, durationHours: 0, durationMinutes: 0, desc: 'Continuous scraped surface freezing' },
    { id: 'bf', name: 'BF - Bath Freezer', category: 'Freezing & Molding', durationMonths: 0, durationDays: 0, durationHours: 0, durationMinutes: 0, desc: 'Brine tank sub-zero mold immersion' }
  ]);
  const [learnedFormulationNotice, setLearnedFormulationNotice] = useState(null);

  // Product Selection (Step C)
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [selectedSubcategoryId, setSelectedSubcategoryId] = useState('');
  const [selectedProducts, setSelectedProducts] = useState([]);

  // Wastage & Overhead
  const [wastagePct, setWastagePct] = useState(6.0);
  const [overheadPct, setOverheadPct] = useState(10.0);

  // Raw Material Lines
  const [rawMaterials, setRawMaterials] = useState([]);

  // Raw Material Masters from Item Setup
  const [rawMaterialMasters, setRawMaterialMasters] = useState([]);
  const [uomMasters, setUomMasters] = useState([]);

  useEffect(() => {
    const init = async () => {
      try {
        setLoading(true);
        const [bRes, tplRes, prodRes, catRes, subRes, rmRes, uomRes] = await Promise.all([
          api.get('/production/bases'),
          api.get('/production/templates'),
          api.get('/products'),
          api.get('/item-setup/product-category').catch(() => ({ data: [] })),
          api.get('/product-subcategories').catch(() => ({ data: [] })),
          api.get('/item-setup/raw-material').catch(() => ({ data: [] })),
          api.get('/uom').catch(() => ({ data: [] }))
        ]);

        setBases(bRes.data || []);
        setAllTemplates(tplRes.data || []);
        setProducts(prodRes.data?.data || prodRes.data || []);
        setCategories(catRes.data || []);
        setSubcategories(subRes.data || []);
        setRawMaterialMasters(rmRes.data || []);
        setUomMasters(uomRes.data || []);

        const activeBases = (bRes.data || []).filter(b => b.status === 'ACTIVE');
        if (activeBases.length > 0) {
          setSelectedBaseId(activeBases[0].id);
        }
      } catch (err) {
        console.error('Initialization error:', err);
      } finally {
        setLoading(false);
      }
    };

    init();
  }, []);

  // Map of UOM ID to Abbreviation / Name
  const uomLookup = useMemo(() => {
    const map = new Map();
    uomMasters.forEach(u => {
      if (u.id) map.set(u.id, u.abbreviation || u.name);
    });
    return map;
  }, [uomMasters]);

  const resolveUomString = (val, fallback = 'Kg') => {
    if (!val) return fallback;
    if (uomLookup.has(val)) return uomLookup.get(val);
    if (typeof val === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val)) return fallback;
    return val;
  };

  const templatesForSelectedBase = useMemo(() => {
    if (!selectedBaseId) return [];
    return allTemplates.filter(t => t.baseId === selectedBaseId && t.status === 'ACTIVE');
  }, [allTemplates, selectedBaseId]);

  const selectedBaseName = useMemo(() => {
    return bases.find(b => b.id === selectedBaseId)?.name || '';
  }, [bases, selectedBaseId]);

  const totalPlannedQty = useMemo(() => {
    if (selectedProducts.length === 0) return 100;
    return selectedProducts.reduce((sum, p) => sum + Number(p.plannedQty || 0), 0);
  }, [selectedProducts]);

  // Handle template selection
  const handleSelectTemplate = async (template) => {
    try {
      const res = await api.get(`/production/templates/${template.id}`);
      const tpl = res.data;
      setSelectedTemplate(tpl);
      setWastagePct(Number(tpl.wastagePct || 6.0));
      setOverheadPct(Number(tpl.overheadPct || 10.0));

      const templateOutput = Number(tpl.outputQty || 2000);
      const scalingFactor = totalPlannedQty / templateOutput;

      const loadedLines = (tpl.lines || []).map(l => {
        const scaledQty = Number((Number(l.quantity) * scalingFactor).toFixed(4));
        const rate = Number(l.rate || 0);

        const rm = rawMaterialMasters.find(r =>
          r.id === l.rawMaterialId ||
          (r.code && r.code.toUpperCase() === (l.rawMaterialId || '').toUpperCase()) ||
          (r.name && r.name.trim().toLowerCase() === (l.rawMaterialName || '').trim().toLowerCase())
        ) || {};

        // STRICT: Only enable alternate UOM if enabled in /setup/raw-material!
        const hasAlt = Boolean(rm?.id ? (rm.hasAlternateUom && rm.alternateUom) : (l.hasAlternateUom && l.alternateUom));
        const rawBase = (rm?.id ? (rm.unitId || rm.consumptionUnit) : (l.baseUom || l.uom)) || 'liter';
        const baseUom = resolveUomString(rawBase, l.uom || 'liter');
        const altUom = hasAlt ? resolveUomString(rm?.alternateUom || l.alternateUom, null) : null;
        const bQty = Number(rm?.baseUomQty || l.baseUomQty || 1);
        const aQty = Number(rm?.alternateUomQty || l.alternateUomQty || 1);
        const factor = hasAlt ? Number(rm?.conversionFactor || (aQty / (bQty || 1)) || 1) : 1;
        const altRate = (hasAlt && factor > 0) ? Number((rate / factor).toFixed(4)) : rate;
        const altQty = hasAlt ? Number((scaledQty * factor).toFixed(3)) : scaledQty;
        const isAlt = false;

        return {
          rmId: rm.id || l.rawMaterialId,
          rmCode: rm.code || l.rawMaterialCode || 'RM',
          rmName: l.rawMaterialName || rm.name,
          baseTemplateQty: Number(l.quantity),
          baseRequiredQty: scaledQty,
          altRequiredQty: altQty,
          requiredQty: isAlt ? altQty : scaledQty,
          baseUom: baseUom,
          selectedUom: isAlt ? altUom : baseUom,
          activeEntryMode: isAlt ? 'ALT' : 'BASE',
          unitRate: isAlt ? altRate : rate,
          baseRate: rate,
          altRate: altRate,
          rateSource: l.rateSource || 'PO_LATEST',
          isOverhead: l.isOverhead,
          totalCost: Number((scaledQty * rate).toFixed(2)),
          allocatedBatches: [],
          hasAlternateUom: hasAlt,
          alternateUom: altUom,
          baseUomQty: bQty,
          alternateUomQty: aQty,
          conversionFactor: factor
        };
      });

      setRawMaterials(loadedLines);
    } catch (err) {
      console.error('Failed to load template details:', err);
    }
  };

  // Re-scale ingredients
  useEffect(() => {
    if (!selectedTemplate) return;
    const templateOutput = Number(selectedTemplate.outputQty || 2000);
    const scalingFactor = totalPlannedQty / templateOutput;

    setRawMaterials(prev => {
      return prev.map(line => {
        const baseQ = line.baseTemplateQty !== undefined ? line.baseTemplateQty : (line.baseRequiredQty || line.requiredQty);
        const newBaseQty = Number((baseQ * scalingFactor).toFixed(4));
        const factor = Number(line.conversionFactor || 1);
        const newAltQty = Number((newBaseQty * factor).toFixed(3));
        const isAlt = line.activeEntryMode === 'ALT';
        const rate = isAlt ? Number(line.altRate || 0) : Number(line.baseRate || line.unitRate || 0);
        const currentQty = isAlt ? newAltQty : newBaseQty;

        return {
          ...line,
          baseRequiredQty: newBaseQty,
          altRequiredQty: newAltQty,
          requiredQty: currentQty,
          totalCost: Number((currentQty * rate).toFixed(2))
        };
      });
    });
  }, [totalPlannedQty]);

  // Live Refresh Prices
  const handleRefreshPrices = async () => {
    try {
      setRefreshingPrices(true);
      const updated = await Promise.all(
        rawMaterials.map(async (rm) => {
          if (rm.isOverhead) return rm;
          try {
            const res = await api.get(`/purchase/live-rate?rawMaterialId=${rm.rmId}&targetUom=${rm.baseUom || rm.selectedUom}`);
            if (res.data && res.data.rate > 0) {
              const newBaseRate = Number(res.data.rate);
              const factor = Number(rm.conversionFactor || 1);
              const newAltRate = factor > 0 ? Number((newBaseRate / factor).toFixed(4)) : newBaseRate;
              const isAlt = rm.activeEntryMode === 'ALT';
              const currentRate = isAlt ? newAltRate : newBaseRate;
              const currentQty = isAlt ? Number(rm.altRequiredQty || rm.requiredQty || 0) : Number(rm.baseRequiredQty || rm.requiredQty || 0);

              return {
                ...rm,
                baseRate: newBaseRate,
                altRate: newAltRate,
                unitRate: currentRate,
                rateSource: res.data.source || 'PO_LATEST',
                totalCost: Number((currentQty * currentRate).toFixed(2))
              };
            }
          } catch {
            // retain
          }
          return rm;
        })
      );
      setRawMaterials(updated);
      Swal.fire({ title: 'Refreshed', text: 'Live rates fetched from Purchase Orders.', icon: 'success', timer: 1500 });
    } finally {
      setRefreshingPrices(false);
    }
  };

  // Costing totals
  const costingTotals = useMemo(() => {
    let sub = 0;
    rawMaterials.forEach(rm => {
      sub += Number(rm.totalCost || 0);
    });
    sub = Number(sub.toFixed(2));
    const wAmt = Number(((sub * wastagePct) / 100).toFixed(2));
    const oAmt = Number(((sub * overheadPct) / 100).toFixed(2));
    const grand = Number((sub + wAmt + oAmt).toFixed(2));
    const cpu = totalPlannedQty > 0 ? Number((grand / totalPlannedQty).toFixed(4)) : 0;

    return {
      subTotal: sub,
      wastageAmt: wAmt,
      overheadAmt: oAmt,
      grandTotal: grand,
      costPerUnit: cpu
    };
  }, [rawMaterials, wastagePct, overheadPct, totalPlannedQty]);

  // Auto-Workflow & RM Consumption Per-Piece Learning
  const handleSelectProductWithTemplate = (product) => {
    if (!product) return;

    // 1. Auto-load workflow stages from product setup
    const prodStages = product.workflow_stages || product.specifications?.workflow_stages || product.specifications?.timelineStages;
    if (Array.isArray(prodStages) && prodStages.length > 0) {
      setTimelineStages(prodStages);
    }

    // 2. Check for latest learned actual formulation ratios
    const latestRatios = product.specifications?.latestActualFormulation;
    if (Array.isArray(latestRatios) && latestRatios.length > 0) {
      setLearnedFormulationNotice({
        productName: product.name,
        lastYield: product.specifications?.latestActualYield,
        lastRef: product.specifications?.lastBatchReference,
        ratios: latestRatios
      });

      setRawMaterials(prev => {
        return prev.map(line => {
          const matched = latestRatios.find(r => r.rmId === line.rmId);
          if (matched && Number(matched.singlePieceRatio) > 0) {
            const singleRatio = Number(matched.singlePieceRatio);
            const newRequired = Number((singleRatio * totalPlannedQty).toFixed(4));
            const rate = Number(line.unitRate || line.baseRate || 0);
            return {
              ...line,
              baseRequiredQty: newRequired,
              requiredQty: newRequired,
              learnedSingleRatio: singleRatio,
              totalCost: Number((newRequired * rate).toFixed(2))
            };
          }
          return line;
        });
      });
    }
  };

  // Save / Post handler
  const handleSave = async (status = 'Completed') => {
    if (!adjustmentReason) {
      Swal.fire({ title: 'Validation', text: 'Please select an adjustment reason.', icon: 'warning' });
      return;
    }
    if (!selectedBaseId) {
      Swal.fire({ title: 'Validation', text: 'Please select a Base Master (Step A).', icon: 'warning' });
      return;
    }
    if (!selectedTemplate) {
      Swal.fire({ title: 'Validation', text: 'Please pick a Production Template (Step B).', icon: 'warning' });
      return;
    }
    if (selectedProducts.length === 0) {
      Swal.fire({ title: 'Validation', text: 'Please select at least one finished product (Step C).', icon: 'warning' });
      return;
    }
    if (rawMaterials.length === 0) {
      Swal.fire({ title: 'Validation', text: 'At least one raw material line is required in formulation.', icon: 'warning' });
      return;
    }

    if (labourCount > 0 && assignedStaffIds.length !== labourCount) {
      Swal.fire({
        title: 'Labour Assignment Required',
        text: `You have entered a labour quantity of ${labourCount} workers, but selected ${assignedStaffIds.length}. Please check the boxes for exactly ${labourCount} production staff members.`,
        icon: 'warning',
        confirmButtonColor: '#4f46e5'
      });
      return;
    }

    const payload = {
      productionType: 'STOCK_UPDATE',
      adjustmentReason,
      adjustmentReference,
      baseId: selectedBaseId,
      templateId: selectedTemplate.id,
      productId: selectedProducts[0].productId,
      selectedProducts,
      quantity: totalPlannedQty,
      startDate: productionDate,
      note,
      status,
      subTotal: costingTotals.subTotal,
      wastageAmt: costingTotals.wastageAmt,
      overheadAmt: costingTotals.overheadAmt,
      grandTotal: costingTotals.grandTotal,
      costPerUnit: costingTotals.costPerUnit,
      timelineStages,
      rawMaterials,
      labourCount: Number(labourCount || assignedStaffIds.length || 0),
      assignedStaffIds,
      labourStaffIds: assignedStaffIds,
      labourStaffDetails
    };

    try {
      setSaving(true);
      await api.post('/production/batches-redesign', payload);
      Swal.fire({
        title: status === 'Completed' ? 'Stock Updated & Posted!' : 'Adjustment Saved as Draft',
        text: `Product stock and raw material lot consumption successfully updated.`,
        icon: 'success',
        timer: 2000
      });
      navigate('/production/stock-update');
    } catch (err) {
      console.error('Failed to post stock update batch:', err);
      const msg = err.response?.data?.error || 'Failed to post stock update production entry.';
      Swal.fire({ title: 'Error', text: msg, icon: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="w-full space-y-2.5">
      
      {/* ── TOP HEADER (FULL SCREEN WIDTH) ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2 border-b border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 rounded-2xl shadow-2xs">
        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/production/stock-update')}
            className="rounded-xl h-8 w-8 p-0 border-slate-200 dark:border-slate-800"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-slate-600 dark:text-slate-300" />
          </Button>
          <div>
            <h1 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
              <span>Direct Production Stock Update</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 font-bold border border-indigo-200/60 dark:border-indigo-800/60">
                SAP MODEL COCKPIT
              </span>
            </h1>
            <p className="text-[10.5px] text-slate-500 dark:text-slate-400">
              Immediate batch entry for opening balance, physical inventory variances, or floor trial records
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
          <Button
            variant="outline"
            onClick={() => navigate('/production/stock-update')}
            className="rounded-lg h-7.5 px-3 text-xs font-bold"
          >
            Cancel
          </Button>

          <Button
            disabled={saving}
            onClick={() => handleSave('Draft')}
            variant="outline"
            className="rounded-lg h-7.5 px-3 text-xs font-bold text-slate-700 dark:text-slate-200"
          >
            <Save className="w-3.5 h-3.5 mr-1" />
            Save Draft
          </Button>

          <Button
            disabled={saving}
            onClick={() => handleSave('Completed')}
            className="rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold h-7.5 px-3.5 shadow-2xs"
          >
            <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
            Post & Update Stock Immediately
          </Button>
        </div>
      </div>

      {/* ── UPPER DUAL COCKPIT (SIDE BY SIDE: ADJUSTMENT/RECIPE DEFINITION vs LABOUR & STAGES) ── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-2.5 items-start">
        
        {/* ── LEFT COLUMN: STOCK ADJUSTMENT PARAMETERS & RECIPE DEFINITION ── */}
        <div className="space-y-2.5">
          {/* 1. Stock Adjustment Parameters */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-3 shadow-2xs space-y-2">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-1.5">
              <label className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-indigo-500" />
                <span>Adjustment Reason & External Audit Reference</span>
                <span className="text-rose-500">*</span>
              </label>
              <span className="text-[10px] text-slate-400 font-semibold">Variance Ledger</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div className="space-y-0.5">
                <Label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                  Reason <span className="text-rose-500">*</span>
                </Label>
                <select
                  value={adjustmentReason}
                  onChange={(e) => setAdjustmentReason(e.target.value)}
                  className="w-full h-7.5 px-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="Opening Stock">Opening Stock Setup</option>
                  <option value="Formulation Correction">Formulation Correction</option>
                  <option value="Physical Inventory Variance">Physical Inventory Variance</option>
                  <option value="Trial / Floor Entry">Trial / Floor Production Entry</option>
                  <option value="Repacking Surplus">Repacking Surplus Transfer</option>
                </select>
              </div>

              <div className="space-y-0.5">
                <Label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">External Ref</Label>
                <Input
                  value={adjustmentReference}
                  onChange={(e) => setAdjustmentReference(e.target.value)}
                  placeholder="e.g. AUDIT-2026-OCT"
                  className="h-7.5 rounded-lg font-bold font-mono text-xs"
                />
              </div>

              <div className="space-y-0.5">
                <Label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">Posting Date</Label>
                <Input
                  type="date"
                  value={productionDate}
                  onChange={(e) => setProductionDate(e.target.value)}
                  className="h-7.5 rounded-lg font-bold text-xs"
                />
              </div>
            </div>
          </div>

          {/* 2. Step A (Base Master) & Step B (Production Template) paired */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-3 shadow-2xs">
              <ProductionBasePicker
                bases={bases}
                selectedBaseId={selectedBaseId}
                onSelectBase={(baseId) => {
                  setSelectedBaseId(baseId);
                  setSelectedTemplate(null);
                  setRawMaterials([]);
                }}
              />
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-3 shadow-2xs">
              {selectedBaseId ? (
                <ProductionTemplatePicker
                  templates={templatesForSelectedBase}
                  selectedTemplateId={selectedTemplate?.id}
                  onSelectTemplate={handleSelectTemplate}
                  selectedBaseName={selectedBaseName}
                />
              ) : (
                <div className="p-4 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 text-center space-y-1 my-auto">
                  <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
                    Select Base Master in Step A first.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* 3. Step C: Category, Subcategory & Finished Products */}
          {selectedTemplate && (
            <div className="space-y-2">
              <ProductionProductPicker
                categories={categories}
                subcategories={subcategories}
                products={products}
                selectedCategoryId={selectedCategoryId}
                onChangeCategory={setSelectedCategoryId}
                selectedSubcategoryId={selectedSubcategoryId}
                onChangeSubcategory={setSelectedSubcategoryId}
                selectedProducts={selectedProducts}
                onUpdateProducts={setSelectedProducts}
                onSelectProductWithTemplate={handleSelectProductWithTemplate}
                selectedBaseId={selectedBaseId}
                selectedBaseName={selectedBaseName}
              />

              {/* Learned Formulation Notice */}
              {learnedFormulationNotice && (
                <div className="bg-gradient-to-r from-amber-50 to-indigo-50 dark:from-slate-850 dark:to-indigo-950/40 border border-amber-300 dark:border-amber-700/60 rounded-xl p-2.5 flex items-center justify-between gap-2 animate-in fade-in shadow-2xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-6 h-6 rounded-md bg-amber-500 text-slate-950 flex items-center justify-center font-black shrink-0 shadow-2xs">
                      <Sparkles className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-xs font-black text-slate-900 dark:text-white truncate">
                        Formulation auto-learned for {learnedFormulationNotice.productName} (Batch #{learnedFormulationNotice.lastRef || 'PREV'})
                      </h4>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                        Quantities scaled to actual per-piece ratios from previous completed runs.
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setLearnedFormulationNotice(null)}
                    className="text-[11px] font-bold text-slate-400 hover:text-slate-600 rounded-lg h-6 px-1.5 shrink-0"
                  >
                    ✕
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── RIGHT COLUMN: FLOOR LABOUR & PROCESS STAGES ── */}
        <div className="space-y-2.5">
          {/* 1. Production Labour & Floor Staff Assignment */}
          <ProductionLabourPicker
            labourCount={labourCount}
            assignedStaffIds={assignedStaffIds}
            labourStaffDetails={labourStaffDetails}
            onChange={({ labourCount: lc, assignedStaffIds: asIds, labourStaffDetails: lsd }) => {
              setLabourCount(lc);
              setAssignedStaffIds(asIds);
              setLabourStaffDetails(lsd);
            }}
          />

          {/* 2. Standard Factory Stages Palette (14 Stage Chips & Reorder Sequence) */}
          {selectedTemplate && (
            <StandardFactoryStagesPalette
              stages={timelineStages}
              onChangeStages={setTimelineStages}
              isEditable={true}
            />
          )}
        </div>

      </div>

      {/* ── LOWER FULL-SCREEN COCKPIT: RAW MATERIAL FORMULATION & BATCH ALLOCATION (OCCUPIES FULL SCREEN) ── */}
      <div className="w-full">
        {(selectedTemplate || rawMaterials.length > 0) && (
          <BatchAllocationGrid
            rawMaterials={rawMaterials}
            onUpdateRawMaterials={setRawMaterials}
            rawMaterialMasters={rawMaterialMasters}
            onRefreshPrices={handleRefreshPrices}
            refreshingPrices={refreshingPrices}
            plannedOutputQty={totalPlannedQty}
            outputUom={selectedProducts[0]?.unit || 'Nos'}
          />
        )}
      </div>

      {/* ── COSTING SUMMARY FOOTER (FULL SCREEN WIDTH) ── */}
      {rawMaterials.length > 0 && (
        <div className="w-full">
          <CostingSummaryFooter
            subTotal={costingTotals.subTotal}
            wastagePct={wastagePct}
            wastageAmt={costingTotals.wastageAmt}
            overheadPct={overheadPct}
            overheadAmt={costingTotals.overheadAmt}
            grandTotal={costingTotals.grandTotal}
            outputQty={totalPlannedQty}
            outputUom={selectedTemplate?.outputUom || selectedProducts[0]?.unit || 'Nos'}
            costPerUnit={costingTotals.costPerUnit}
            isEditable={true}
            onWastagePctChange={setWastagePct}
            onOverheadPctChange={setOverheadPct}
          />
        </div>
      )}

    </div>
  );
}
