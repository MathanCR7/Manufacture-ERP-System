import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '@/lib/axios';
import { 
  Factory, ArrowLeft, Save, Play, CheckCircle2, RefreshCw, Calendar, 
  Layers, Clock, AlertCircle, Sparkles, Database 
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

export default function StandardProductionFormPage() {
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

  // Workflow State
  const [selectedBaseId, setSelectedBaseId] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState(null);

  // Product Selection (Step C)
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [selectedSubcategoryId, setSelectedSubcategoryId] = useState('');
  const [selectedProducts, setSelectedProducts] = useState([]);

  // Standard Batch Specific Header Fields
  const [productionDate, setProductionDate] = useState(new Date().toISOString().split('T')[0]);
  const [shift, setShift] = useState('Morning');
  const [machineLine, setMachineLine] = useState('Main Processing Line');
  const [expiryDays, setExpiryDays] = useState(365);
  const [note, setNote] = useState('');

  // Wastage & Overhead from Template (or customized)
  const [wastagePct, setWastagePct] = useState(6.0);
  const [overheadPct, setOverheadPct] = useState(10.0);

  // Raw Material Lines (Step D & E)
  const [rawMaterials, setRawMaterials] = useState([]);

  // Fetch initial masters
  useEffect(() => {
    const init = async () => {
      try {
        setLoading(true);
        const [bRes, tplRes, prodRes, catRes, subRes] = await Promise.all([
          api.get('/production/bases'),
          api.get('/production/templates'),
          api.get('/products'),
          api.get('/item-setup/product-category').catch(() => ({ data: [] })),
          api.get('/product-subcategories').catch(() => ({ data: [] }))
        ]);

        setBases(bRes.data || []);
        setAllTemplates(tplRes.data || []);
        setProducts(prodRes.data?.data || prodRes.data || []);
        setCategories(catRes.data || []);
        setSubcategories(subRes.data || []);

        // Pre-select first base if available
        const activeBases = (bRes.data || []).filter(b => b.status === 'ACTIVE');
        if (activeBases.length > 0) {
          setSelectedBaseId(activeBases[0].id);
        }
      } catch (err) {
        console.error('Failed to initialize masters:', err);
        Swal.fire({ title: 'Error', text: 'Failed to initialize production workstation.', icon: 'error' });
      } finally {
        setLoading(false);
      }
    };

    init();
  }, []);

  // Templates filtered by selected base
  const templatesForSelectedBase = useMemo(() => {
    if (!selectedBaseId) return [];
    return allTemplates.filter(t => t.baseId === selectedBaseId && t.status === 'ACTIVE');
  }, [allTemplates, selectedBaseId]);

  const selectedBaseName = useMemo(() => {
    return bases.find(b => b.id === selectedBaseId)?.name || '';
  }, [bases, selectedBaseId]);

  // Total Planned Production Quantity across products
  const totalPlannedQty = useMemo(() => {
    if (selectedProducts.length === 0) return 100;
    return selectedProducts.reduce((sum, p) => sum + Number(p.plannedQty || 0), 0);
  }, [selectedProducts]);

  // Handle template selection (Step B)
  const handleSelectTemplate = async (template) => {
    try {
      // Fetch full template with lines
      const res = await api.get(`/production/templates/${template.id}`);
      const tpl = res.data;
      setSelectedTemplate(tpl);
      setWastagePct(Number(tpl.wastagePct || 6.0));
      setOverheadPct(Number(tpl.overheadPct || 10.0));

      const templateOutput = Number(tpl.outputQty || 2000);
      const scalingFactor = totalPlannedQty / templateOutput;

      // Scale ingredients
      const loadedLines = (tpl.lines || []).map(l => {
        const scaledQty = Number((Number(l.quantity) * scalingFactor).toFixed(4));
        const rate = Number(l.rate || 0);
        return {
          rmId: l.rawMaterialId,
          rmName: l.rawMaterialName,
          baseTemplateQty: Number(l.quantity),
          requiredQty: scaledQty,
          selectedUom: l.uom,
          unitRate: rate,
          rateSource: l.rateSource || 'PO_LATEST',
          isOverhead: l.isOverhead,
          totalCost: Number((scaledQty * rate).toFixed(2)),
          allocatedBatches: []
        };
      });

      setRawMaterials(loadedLines);
    } catch (err) {
      console.error('Failed to load template details:', err);
    }
  };

  // Re-scale raw materials whenever totalPlannedQty changes
  useEffect(() => {
    if (!selectedTemplate) return;
    const templateOutput = Number(selectedTemplate.outputQty || 2000);
    const scalingFactor = totalPlannedQty / templateOutput;

    setRawMaterials(prev => {
      return prev.map(line => {
        const baseQ = line.baseTemplateQty !== undefined ? line.baseTemplateQty : line.requiredQty;
        const newQty = Number((baseQ * scalingFactor).toFixed(4));
        const rate = Number(line.unitRate || 0);
        return {
          ...line,
          requiredQty: newQty,
          totalCost: Number((newQty * rate).toFixed(2))
        };
      });
    });
  }, [totalPlannedQty]);

  // Live Refresh Prices from PO
  const handleRefreshPrices = async () => {
    try {
      setRefreshingPrices(true);
      const updated = await Promise.all(
        rawMaterials.map(async (rm) => {
          if (rm.isOverhead) return rm;
          try {
            const res = await api.get(`/purchase/live-rate?rawMaterialId=${rm.rmId}&targetUom=${rm.selectedUom}`);
            if (res.data && res.data.rate > 0) {
              const newRate = Number(res.data.rate);
              return {
                ...rm,
                unitRate: newRate,
                rateSource: res.data.source || 'PO_LATEST',
                totalCost: Number((Number(rm.requiredQty || 0) * newRate).toFixed(2))
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

  // Live Costing Totals
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

  // Handle Save / Submit
  const handleSave = async (status = 'Draft') => {
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
      Swal.fire({ title: 'Validation', text: 'At least one raw material line is required.', icon: 'warning' });
      return;
    }

    const payload = {
      productionType: 'STANDARD',
      baseId: selectedBaseId,
      templateId: selectedTemplate.id,
      productId: selectedProducts[0].productId,
      selectedProducts,
      quantity: totalPlannedQty,
      startDate: productionDate,
      shift,
      machineLine,
      expiryDays,
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
        title: status === 'In Progress' ? 'Production Started!' : 'Standard Batch Created!',
        text: `Standard Production batch successfully recorded.`,
        icon: 'success',
        timer: 2000
      });
      navigate('/production/standard');
    } catch (err) {
      console.error('Failed to create batch:', err);
      const msg = err.response?.data?.error || 'Failed to create standard production batch.';
      Swal.fire({ title: 'Error', text: msg, icon: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      
      {/* ── TOP HEADER ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/production/standard')}
            className="rounded-xl h-9 w-9 p-0 border-slate-200 dark:border-slate-800"
          >
            <ArrowLeft className="w-4 h-4 text-slate-600 dark:text-slate-300" />
          </Button>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              Create Standard Production Batch
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
              Template-driven daily production scheduling with live PO rates & batch allocation
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Button
            variant="outline"
            onClick={() => navigate('/production/standard')}
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
            onClick={() => handleSave('In Progress')}
            className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-9 shadow-sm"
          >
            <Play className="w-4 h-4 mr-1.5" />
            Approve & Start Production
          </Button>
        </div>
      </div>

      {/* ── STANDARD BATCH PARAMETERS (Date, Shift, Line) ── */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl p-5 shadow-xs grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="space-y-1">
          <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Production Date</Label>
          <Input
            type="date"
            value={productionDate}
            onChange={(e) => setProductionDate(e.target.value)}
            className="h-10 rounded-xl font-bold"
          />
        </div>

        <div className="space-y-1">
          <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Shift</Label>
          <select
            value={shift}
            onChange={(e) => setShift(e.target.value)}
            className="w-full h-10 px-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200"
          >
            <option value="Morning">Morning Shift (06:00 - 14:00)</option>
            <option value="Evening">Evening Shift (14:00 - 22:00)</option>
            <option value="Night">Night Shift (22:00 - 06:00)</option>
          </select>
        </div>

        <div className="space-y-1">
          <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Machine / Line</Label>
          <Input
            value={machineLine}
            onChange={(e) => setMachineLine(e.target.value)}
            placeholder="e.g. Line 1, Gallon Filling"
            className="h-10 rounded-xl font-bold"
          />
        </div>

        <div className="space-y-1">
          <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Expiry (Days)</Label>
          <Input
            type="number"
            value={expiryDays}
            onChange={(e) => setExpiryDays(Number(e.target.value))}
            className="h-10 rounded-xl font-bold font-mono"
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
