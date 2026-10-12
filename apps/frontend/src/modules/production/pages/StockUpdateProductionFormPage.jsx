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

  // Workflow State
  const [selectedBaseId, setSelectedBaseId] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState(null);

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

        const hasAlt = Boolean(rm.hasAlternateUom !== undefined ? rm.hasAlternateUom : l.hasAlternateUom);
        const rawBase = rm.unitId || rm.consumptionUnit || l.baseUom || l.uom || 'Kg';
        const baseUom = resolveUomString(rawBase, l.uom || 'Kg');
        const altUom = resolveUomString(rm.alternateUom || l.alternateUom, null);
        const bQty = Number(rm.baseUomQty || l.baseUomQty || 1);
        const aQty = Number(rm.alternateUomQty || l.alternateUomQty || 1);
        const factor = Number(rm.conversionFactor || l.conversionFactor || (aQty / (bQty || 1)));
        const altRate = factor > 0 ? Number((rate / factor).toFixed(4)) : rate;
        const altQty = Number((scaledQty * factor).toFixed(3));
        const isAlt = Boolean(hasAlt && l.uom && altUom && l.uom.toLowerCase() === altUom.toLowerCase());

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
      rawMaterials
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
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      
      {/* ── HEADER ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/production/stock-update')}
            className="rounded-xl h-9 w-9 p-0 border-slate-200 dark:border-slate-800"
          >
            <ArrowLeft className="w-4 h-4 text-slate-600 dark:text-slate-300" />
          </Button>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              Create Stock Update Production Entry
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
              Direct inventory addition & raw material consumption for opening balances or floor corrections
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Button
            variant="outline"
            onClick={() => navigate('/production/stock-update')}
            className="rounded-xl h-9 font-bold"
          >
            Cancel
          </Button>

          <Button
            disabled={saving}
            onClick={() => handleSave('Draft')}
            variant="outline"
            className="rounded-xl h-9 font-bold text-slate-700 dark:text-slate-200"
          >
            <Save className="w-4 h-4 mr-1.5" />
            Save as Draft
          </Button>

          <Button
            disabled={saving}
            onClick={() => handleSave('Completed')}
            className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-9 shadow-sm"
          >
            <CheckCircle2 className="w-4 h-4 mr-1.5" />
            Post & Update Stock Immediately
          </Button>
        </div>
      </div>

      {/* ── STOCK ADJUSTMENT REASON & REFERENCE ── */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl p-5 shadow-xs grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="space-y-1">
          <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
            Adjustment Reason <span className="text-rose-500">*</span>
          </Label>
          <select
            value={adjustmentReason}
            onChange={(e) => setAdjustmentReason(e.target.value)}
            className="w-full h-10 px-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="Opening Stock">Opening Stock Setup</option>
            <option value="Formulation Correction">Formulation Correction</option>
            <option value="Physical Inventory Variance">Physical Inventory Variance</option>
            <option value="Trial / Floor Entry">Trial / Floor Production Entry</option>
            <option value="Repacking Surplus">Repacking Surplus Transfer</option>
          </select>
        </div>

        <div className="space-y-1">
          <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">External Reference</Label>
          <Input
            value={adjustmentReference}
            onChange={(e) => setAdjustmentReference(e.target.value)}
            placeholder="e.g. AUDIT-2026-OCT, PHY-COUNT-01"
            className="h-10 rounded-xl font-bold font-mono"
          />
        </div>

        <div className="space-y-1">
          <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Posting Date</Label>
          <Input
            type="date"
            value={productionDate}
            onChange={(e) => setProductionDate(e.target.value)}
            className="h-10 rounded-xl font-bold"
          />
        </div>
      </div>

      {/* ── STEP A: BASE SELECTION ── */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl p-5 shadow-xs">
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

      {/* ── STEP B: TEMPLATE SELECTION ── */}
      {selectedBaseId && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl p-5 shadow-xs">
          <ProductionTemplatePicker
            templates={templatesForSelectedBase}
            selectedTemplateId={selectedTemplate?.id}
            onSelectTemplate={handleSelectTemplate}
            selectedBaseName={selectedBaseName}
          />
        </div>
      )}

      {/* ── STEP C: PRODUCT SELECTION ── */}
      {selectedTemplate && (
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
          selectedBaseId={selectedBaseId}
          selectedBaseName={selectedBaseName}
        />
      )}

      {/* ── STEP D & E: BATCH ALLOCATION GRID ── */}
      {selectedTemplate && rawMaterials.length > 0 && (
        <BatchAllocationGrid
          rawMaterials={rawMaterials}
          onUpdateRawMaterials={setRawMaterials}
          onRefreshPrices={handleRefreshPrices}
          refreshingPrices={refreshingPrices}
        />
      )}

      {/* ── COSTING SUMMARY FOOTER ── */}
      {selectedTemplate && rawMaterials.length > 0 && (
        <CostingSummaryFooter
          subTotal={costingTotals.subTotal}
          wastagePct={wastagePct}
          wastageAmt={costingTotals.wastageAmt}
          overheadPct={overheadPct}
          overheadAmt={costingTotals.overheadAmt}
          grandTotal={costingTotals.grandTotal}
          outputQty={totalPlannedQty}
          outputUom={selectedTemplate.outputUom || 'Nos'}
          costPerUnit={costingTotals.costPerUnit}
          isEditable={true}
          onWastagePctChange={setWastagePct}
          onOverheadPctChange={setOverheadPct}
        />
      )}

    </div>
  );
}
