import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '@/lib/axios';
import { 
  ShoppingBag, ArrowLeft, Save, Play, CheckCircle2, RefreshCw, Calendar, 
  Layers, Clock, AlertCircle, Sparkles, Database, User, Package
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
import Swal from 'sweetalert2';

export default function OrderBasedProductionFormPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedOrderId = searchParams.get('orderId');

  // Master Data
  const [bases, setBases] = useState([]);
  const [allTemplates, setAllTemplates] = useState([]);
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [subcategories, setSubcategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshingPrices, setRefreshingPrices] = useState(false);

  // Order selection state
  const [selectedOrderId, setSelectedOrderId] = useState(preselectedOrderId || '');
  const [selectedOrderDetails, setSelectedOrderDetails] = useState(null);

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

  // Header parameters
  const [productionDate, setProductionDate] = useState(new Date().toISOString().split('T')[0]);
  const [expiryDays, setExpiryDays] = useState(365);
  const [note, setNote] = useState('');

  // Wastage & Overhead
  const [wastagePct, setWastagePct] = useState(6.0);
  const [overheadPct, setOverheadPct] = useState(10.0);

  // Raw Material Lines
  const [rawMaterials, setRawMaterials] = useState([]);
  const [rawMaterialMasters, setRawMaterialMasters] = useState([]);
  const [uomMasters, setUomMasters] = useState([]);

  useEffect(() => {
    const init = async () => {
      try {
        setLoading(true);
        const [bRes, tplRes, ordRes, prodRes, catRes, subRes, rmRes, uomRes] = await Promise.all([
          api.get('/production/bases'),
          api.get('/production/templates'),
          api.get('/sales/list').catch(() => api.get('/orders')),
          api.get('/products'),
          api.get('/item-setup/product-category').catch(() => ({ data: [] })),
          api.get('/product-subcategories').catch(() => ({ data: [] })),
          api.get('/item-setup/raw-material').catch(() => ({ data: [] })),
          api.get('/uom').catch(() => ({ data: [] }))
        ]);

        setBases(bRes.data || []);
        setAllTemplates(tplRes.data || []);
        setOrders(ordRes.data?.orders || ordRes.data || []);
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

  // When selectedOrderId changes, fetch order items
  useEffect(() => {
    if (!selectedOrderId) {
      setSelectedOrderDetails(null);
      return;
    }
    const order = orders.find(o => o.id === selectedOrderId);
    if (order) {
      setSelectedOrderDetails(order);

      // Pre-fill target product if order has items
      if (Array.isArray(order.items) && order.items.length > 0) {
        const firstItem = order.items[0];
        const prod = products.find(p => p.id === firstItem.productId);
        if (prod) {
          setSelectedProducts([{
            productId: prod.id,
            name: prod.name,
            code: prod.code,
            series: prod.specifications?.series || 'BG',
            group: prod.specifications?.groupName || 'Gallon',
            factor: Number(prod.specifications?.factor || 1.0),
            plannedQty: Number(firstItem.quantity || 100),
            unit: prod.unit?.abbreviation || 'Nos'
          }]);
        }
      }
    }
  }, [selectedOrderId, orders, products]);

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
      console.error('Failed to load template lines:', err);
    }
  };

  // Re-scale on quantity change
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

  // Save handler
  const handleSave = async (status = 'Draft') => {
    if (!selectedOrderId) {
      Swal.fire({ title: 'Validation', text: 'Please link a Customer Sales Order.', icon: 'warning' });
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
      productionType: 'ORDER_BASED',
      orderId: selectedOrderId,
      baseId: selectedBaseId,
      templateId: selectedTemplate.id,
      productId: selectedProducts[0].productId,
      selectedProducts,
      quantity: totalPlannedQty,
      startDate: productionDate,
      expiryDays,
      note,
      status,
      subTotal: costingTotals.subTotal,
      wastageAmt: costingTotals.wastageAmt,
      overheadAmt: costingTotals.overheadAmt,
      grandTotal: costingTotals.grandTotal,
      costPerUnit: costingTotals.costPerUnit,
      timelineStages,
      rawMaterials
    };

    try {
      setSaving(true);
      await api.post('/production/batches-redesign', payload);
      Swal.fire({
        title: status === 'In Progress' ? 'Order Production Started!' : 'Order Batch Scheduled!',
        text: `Output batch reserved against Sales Order #${selectedOrderDetails?.referenceNo || selectedOrderId.slice(0, 8)}.`,
        icon: 'success',
        timer: 2000
      });
      navigate('/production/order-based');
    } catch (err) {
      console.error('Failed to create order batch:', err);
      const msg = err.response?.data?.error || 'Failed to create order-based production batch.';
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
            onClick={() => navigate('/production/order-based')}
            className="rounded-xl h-9 w-9 p-0 border-slate-200 dark:border-slate-800"
          >
            <ArrowLeft className="w-4 h-4 text-slate-600 dark:text-slate-300" />
          </Button>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              Create Order Based Production Batch
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
              Manufacture goods specifically reserved for customer orders with strict delivery alignment
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Button
            variant="outline"
            onClick={() => navigate('/production/order-based')}
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
            Start Order Production
          </Button>
        </div>
      </div>

      {/* ── SALES ORDER LINKING SELECTOR ── */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <label className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
            <ShoppingBag className="w-4 h-4 text-indigo-500" />
            <span>Select Customer Sales Order</span>
            <span className="text-rose-500">*</span>
          </label>
          <span className="text-[11px] text-slate-400">
            {orders.length} Active Customer Orders
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Choose Sales Order</Label>
            <select
              value={selectedOrderId}
              onChange={(e) => setSelectedOrderId(e.target.value)}
              className="w-full h-10 px-3 bg-indigo-50/40 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 rounded-xl text-xs font-bold text-indigo-700 dark:text-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Select Sales Order (Customer / Ref #)...</option>
              {orders.map(o => (
                <option key={o.id} value={o.id}>
                  {o.referenceNo || o.docNo || o.id.slice(0, 8)} — {o.customer?.name || 'Customer'} (Due: {o.deliveryDate ? new Date(o.deliveryDate).toLocaleDateString('en-GB') : 'N/A'})
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Production Date</Label>
            <Input
              type="date"
              value={productionDate}
              onChange={(e) => setProductionDate(e.target.value)}
              className="h-10 rounded-xl font-bold"
            />
          </div>
        </div>

        {selectedOrderDetails && (
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-bold block">Customer</span>
              <span className="font-extrabold text-slate-900 dark:text-white block mt-0.5">
                {selectedOrderDetails.customer?.name || 'Customer'}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-bold block">Promised Delivery</span>
              <span className="font-mono font-bold text-amber-600 block mt-0.5">
                {selectedOrderDetails.deliveryDate ? new Date(selectedOrderDetails.deliveryDate).toLocaleDateString('en-GB') : 'Flexible'}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-bold block">Order Value</span>
              <span className="font-mono font-bold text-slate-900 dark:text-white block mt-0.5">
                ₹{Number(selectedOrderDetails.grandTotal || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-bold block">Fulfillment Status</span>
              <span className="font-bold text-indigo-600 block mt-0.5">
                {selectedOrderDetails.status || 'Confirmed'}
              </span>
            </div>
          </div>
        )}
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
        <>
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

          {/* Learned Formulation Auto-Learning Notice */}
          {learnedFormulationNotice && (
            <div className="bg-gradient-to-r from-amber-50 to-indigo-50 dark:from-slate-850 dark:to-indigo-950/40 border border-amber-300 dark:border-amber-700/60 rounded-3xl p-4 flex items-center justify-between gap-3 animate-in fade-in">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-2xl bg-amber-500 text-slate-950 flex items-center justify-center font-black shrink-0 shadow-xs">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-2">
                    <span>Auto-Suggested Latest Actual Formulation for {learnedFormulationNotice.productName}</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200">
                      Learned from Batch #{learnedFormulationNotice.lastRef || 'PREV'}
                    </span>
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Ingredient quantities have been automatically updated based on the actual single-piece consumption learned from previous completed production runs.
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setLearnedFormulationNotice(null)}
                className="text-xs font-bold text-slate-400 hover:text-slate-600 rounded-xl"
              >
                Dismiss
              </Button>
            </div>
          )}

          {/* ── STANDARD FACTORY STAGES PALETTE (Image 1: 14 Stages & Sequence) ── */}
          <StandardFactoryStagesPalette
            stages={timelineStages}
            onChangeStages={setTimelineStages}
            isEditable={true}
          />
        </>
      )}

      {/* ── STEP D & E: BATCH ALLOCATION GRID ── */}
      {selectedTemplate && rawMaterials.length > 0 && (
        <BatchAllocationGrid
          rawMaterials={rawMaterials}
          onUpdateRawMaterials={setRawMaterials}
          onRefreshPrices={handleRefreshPrices}
          refreshingPrices={refreshingPrices}
          plannedOutputQty={totalPlannedQty}
          outputUom={selectedProducts[0]?.unit || 'Nos'}
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
