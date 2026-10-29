import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams, useLocation, useParams } from 'react-router-dom';
import { api } from '@/lib/axios';
import { 
  RotateCw, ArrowLeft, Save, Play, CheckCircle2, RefreshCw, Calendar, 
  Layers, Clock, AlertCircle, Sparkles, Database, Check, Package,
  Sliders, ChevronRight, Boxes, TrendingDown, Tag, RotateCcw, Plus
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
import ProductionItemSearchModal from '../components/ProductionItemSearchModal';
import { getProductionMasters, peekProductionMasters } from '../services/productionMasterCache';
import { getProductionDraft, saveProductionDraft, flushProductionDraft, clearProductionDraft } from '../services/productionDraftStore';
import Swal from 'sweetalert2';

const isUuid = (val) => typeof val === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);

export default function StockUpdateProductionFormPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const { id: paramId } = useParams();
  const editBatchId = paramId || searchParams.get('id') || searchParams.get('editId') || null;
  const isEditMode = Boolean(editBatchId);

  const [editingBatchNo, setEditingBatchNo] = useState('');
  const [editingBatchStatus, setEditingBatchStatus] = useState('');
  const [loadingBatch, setLoadingBatch] = useState(false);

  const paramProductId = searchParams.get('productId') || location.state?.productId || '';
  const paramQuantity = searchParams.get('quantity') || location.state?.quantity || '';
  const paramOrderId = searchParams.get('orderId') || location.state?.orderId || '';

  // ── Master Data from Live APIs ──
  const [bases, setBases] = useState([]);
  const [allTemplates, setAllTemplates] = useState([]);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [subcategories, setSubcategories] = useState([]);
  const [rawMaterialMasters, setRawMaterialMasters] = useState([]);
  const [uomMasters, setUomMasters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshingPrices, setRefreshingPrices] = useState(false);

  // ── Stock Update Specific Attributes ──
  const [adjustmentReason, setAdjustmentReason] = useState('Low Stock Replenishment');
  const [adjustmentReference, setAdjustmentReference] = useState('REPLENISH-' + Date.now().toString().slice(-6));
  const [productionDate, setProductionDate] = useState(new Date().toISOString().split('T')[0]);
  const [note, setNote] = useState('');

  // ── Workflow Selection State ──
  const [selectedBaseId, setSelectedBaseId] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState(null);

  // ── 14 Standard Factory Stages Palette (Section 5 & 6) ──
  const [timelineStages, setTimelineStages] = useState([
    { id: 'ageing', name: 'Ageing', category: 'Thermal & Mixing', durationMonths: 0, durationDays: 0, durationHours: 0, durationMinutes: 30, desc: 'Mix aging in refrigerated vats at 4°C' },
    { id: 'vat', name: 'VAT', category: 'Thermal & Mixing', durationMonths: 0, durationDays: 0, durationHours: 0, durationMinutes: 45, desc: 'Holding and agitation in process tanks' },
    { id: 'cf', name: 'CF – Cont. Freezer', category: 'Freezing & Molding', durationMonths: 0, durationDays: 0, durationHours: 0, durationMinutes: 60, desc: 'Continuous scraped surface freezing' },
    { id: 'bf', name: 'BF – Bath Freezer', category: 'Freezing & Molding', durationMonths: 0, durationDays: 0, durationHours: 0, durationMinutes: 45, desc: 'Brine tank sub-zero mold immersion' }
  ]);
  const [learnedFormulationNotice, setLearnedFormulationNotice] = useState(null);

  // ── Product Selection ──
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [selectedSubcategoryId, setSelectedSubcategoryId] = useState('');
  const [selectedProducts, setSelectedProducts] = useState([]);

  // ── Production Parameters ──
  const [shift, setShift] = useState('Morning');
  const [machineLine, setMachineLine] = useState('Replenishment Line A');
  const [expiryDays, setExpiryDays] = useState(365);

  // ── Labour Allocation ──
  const [labourCount, setLabourCount] = useState(1);
  const [assignedStaffIds, setAssignedStaffIds] = useState([]);
  const [labourStaffDetails, setLabourStaffDetails] = useState([]);

  // ── Wastage & Overhead ──
  const [wastagePct, setWastagePct] = useState(6.0);
  const [overheadPct, setOverheadPct] = useState(10.0);

  // ── Raw Materials (Section 4) ──
  const [rawMaterials, setRawMaterials] = useState([]);

  // ── Universal Item Search Modal State (Sales / SAP Order Style) ──
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [searchModalMode, setSearchModalMode] = useState('RM_MULTI');

  const handleAddSelectedRMs = (materials) => {
    const newLines = materials.map(rm => ({
      rmId: rm.id,
      rmCode: rm.code,
      rmName: rm.printName || rm.name,
      category: rm.category || 'Raw Material',
      description: '',
      baseTemplateQty: 10,
      baseRequiredQty: 10,
      altRequiredQty: 10,
      requiredQty: 10,
      baseUom: rm.consumptionUnit || rm.unitId || 'kg',
      selectedUom: rm.consumptionUnit || rm.unitId || 'kg',
      activeEntryMode: 'BASE',
      unitRate: Number(rm.ratePerUnit || 0),
      baseRate: Number(rm.ratePerUnit || 0),
      altRate: Number(rm.ratePerUnit || 0),
      rateSource: 'CATALOG',
      isOverhead: false,
      totalCost: Number(rm.ratePerUnit || 0) * 10,
      allocatedBatches: rm.availableBatches?.length > 0 ? [
        {
          batchId: rm.availableBatches[0].id,
          batchNo: rm.availableBatches[0].batchNo,
          allocatedQty: 10,
          remainingQty: rm.availableBatches[0].remainingQty,
          expiryDate: rm.availableBatches[0].expiryDate
        }
      ] : [],
      hasAlternateUom: Boolean(rm.hasAlternateUom),
      alternateUom: rm.alternateUom,
      baseUomQty: Number(rm.baseUomQty || 1),
      alternateUomQty: Number(rm.alternateUomQty || 1),
      conversionFactor: Number(rm.conversionFactor || 1)
    }));
    setRawMaterials(prev => [...prev, ...newLines]);
    Swal.fire({
      title: 'Raw Materials Added',
      text: `Added ${materials.length} raw material(s) with live DB UOMs and batches.`,
      icon: 'success',
      timer: 1500
    });
  };

  const handleSelectProductFromModal = (prod) => {
    if (selectedProducts.some(p => p.productId === prod.id)) {
      Swal.fire({ title: 'Already Added', text: 'This product is already selected for replenishment.', icon: 'info' });
      return;
    }
    const newProd = {
      productId: prod.id,
      name: prod.name,
      code: prod.code,
      plannedQty: 100,
      unit: prod.unit || 'pcs'
    };
    setSelectedProducts(prev => [...prev, newProd]);
  };

  // Total Planned Production Quantity across products
  const totalPlannedQty = useMemo(() => {
    if (selectedProducts.length === 0) return 2000;
    return selectedProducts.reduce((sum, p) => sum + Number(p.plannedQty || 0), 0);
  }, [selectedProducts]);

  // UOM Lookup Map
  const uomLookup = useMemo(() => {
    const map = new Map();
    uomMasters.forEach(u => {
      if (u.id) map.set(u.id, u.abbreviation || u.name);
    });
    return map;
  }, [uomMasters]);

  const resolveUomString = useCallback((val, fallback = 'Kg') => {
    if (!val) return fallback;
    if (uomLookup.has(val)) return uomLookup.get(val);
    if (isUuid(val)) return fallback;
    return val;
  }, [uomLookup]);

  // Helper to construct scaled formulation lines from template
  const buildLinesFromTemplate = useCallback((tpl, plannedQty, rmMasters = rawMaterialMasters, uoms = uomMasters) => {
    if (!tpl || !Array.isArray(tpl.lines)) return [];
    const templateOutput = Number(tpl.outputQty || 2000);
    const scalingFactor = (plannedQty || 2000) / (templateOutput || 2000);

    const uMap = new Map();
    (uoms || []).forEach(u => {
      if (u.id) uMap.set(u.id, u.abbreviation || u.name);
    });
    const resolveUom = (val, fb = 'Kg') => {
      if (!val) return fb;
      if (uMap.has(val)) return uMap.get(val);
      if (isUuid(val)) return fb;
      return val;
    };

    return (tpl.lines || []).map(l => {
      const scaledQty = Number((Number(l.quantity) * scalingFactor).toFixed(4));
      const rate = Number(l.rate || 0);

      const rm = (rmMasters || []).find(r =>
        r.id === l.rawMaterialId ||
        (r.code && r.code.toUpperCase() === (l.rawMaterialId || '').toUpperCase()) ||
        (r.name && r.name.trim().toLowerCase() === (l.rawMaterialName || '').trim().toLowerCase())
      ) || {};

      const hasAlt = Boolean(rm?.id ? (rm.hasAlternateUom && rm.alternateUom) : (l.hasAlternateUom && l.alternateUom));
      const rawBase = (rm?.id ? (rm.unitId || rm.consumptionUnit) : (l.baseUom || l.uom)) || 'liter';
      const baseUom = resolveUom(rawBase, l.uom || 'liter');
      const altUom = hasAlt ? resolveUom(rm?.alternateUom || l.alternateUom, null) : null;
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
        category: (rm.category && typeof rm.category === 'object') ? (rm.category.name || '') : (rm.category || l.category || ''),
        description: rm.description || l.description || '',
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
  }, []);

  // Resilient fallback recipe builder from raw materials master
  const generateFallbackRmLines = useCallback((tpl, plannedQty, rmMasters = rawMaterialMasters) => {
    if (!Array.isArray(rmMasters) || rmMasters.length === 0) return [];
    const sample = rmMasters.slice(0, 4);
    const scaling = (plannedQty || 2000) / 2000;
    return sample.map((rm, idx) => {
      const baseQty = Number(((idx + 1) * 25 * scaling).toFixed(4));
      const rate = Number(rm.ratePerUnit || 120);
      return {
        rmId: rm.id,
        rmCode: rm.code || `RM-00${idx + 1}`,
        rmName: rm.name,
        category: (rm.category && typeof rm.category === 'object') ? (rm.category.name || '') : (rm.category || ''),
        description: rm.description || '',
        baseTemplateQty: (idx + 1) * 25,
        baseRequiredQty: baseQty,
        altRequiredQty: baseQty,
        requiredQty: baseQty,
        baseUom: rm.consumptionUnit || 'Kg',
        selectedUom: rm.consumptionUnit || 'Kg',
        activeEntryMode: 'BASE',
        unitRate: rate,
        baseRate: rate,
        altRate: rate,
        rateSource: 'CATALOG',
        isOverhead: false,
        totalCost: Number((baseQty * rate).toFixed(2)),
        allocatedBatches: [],
        hasAlternateUom: Boolean(rm.hasAlternateUom),
        alternateUom: rm.alternateUom || null,
        baseUomQty: 1,
        alternateUomQty: 1,
        conversionFactor: 1
      };
    });
  }, [rawMaterialMasters]);

  // Handle template selection & line population
  const handleSelectTemplate = useCallback(async (template, customRmMasters = null, customUoms = null, customQty = null) => {
    if (!template) return;

    // Resolve template object
    let tplObj = null;
    if (typeof template === 'string') {
      tplObj = allTemplates.find(t => t.id === template || t.code === template) || { id: template, name: 'Production Template' };
    } else {
      tplObj = template;
    }

    // 1. INSTANT SYNCHRONOUS SELECTION: UI updates with zero lag
    setSelectedTemplate(tplObj);
    if (tplObj.baseId) {
      setSelectedBaseId(tplObj.baseId);
    }
    if (tplObj.wastagePct !== undefined) setWastagePct(Number(tplObj.wastagePct));
    if (tplObj.overheadPct !== undefined) setOverheadPct(Number(tplObj.overheadPct));

    const qtyToScale = customQty !== null ? customQty : totalPlannedQty;
    const rms = (customRmMasters && customRmMasters.length > 0) ? customRmMasters : rawMaterialMasters;
    const uoms = (customUoms && customUoms.length > 0) ? customUoms : uomMasters;

    // If template object already has lines in memory, populate immediately
    if (Array.isArray(tplObj.lines) && tplObj.lines.length > 0) {
      const loadedLines = buildLinesFromTemplate(tplObj, qtyToScale, rms, uoms);
      setRawMaterials(loadedLines);
    }

    // 2. Fetch full line details from backend if valid database ID
    if (tplObj.id && !String(tplObj.id).startsWith('default-tpl-')) {
      try {
        const res = await api.get(`/production/templates/${tplObj.id}`);
        const detailedTpl = res.data;
        if (detailedTpl) {
          setSelectedTemplate(detailedTpl);
          if (detailedTpl.wastagePct !== undefined) setWastagePct(Number(detailedTpl.wastagePct));
          if (detailedTpl.overheadPct !== undefined) setOverheadPct(Number(detailedTpl.overheadPct));
          const loadedLines = buildLinesFromTemplate(detailedTpl, qtyToScale, rms, uoms);
          if (loadedLines && loadedLines.length > 0) {
            setRawMaterials(loadedLines);
          }
        }
      } catch (err) {
        console.warn('Backend template lines fetch notice:', err.message);
        // Fallback: If network error or lines empty, generate resilient lines from RM masters
        setRawMaterials(prev => {
          if (prev && prev.length > 0) return prev;
          return generateFallbackRmLines(tplObj, qtyToScale, rms);
        });
      }
    } else {
      // For synthetic default templates, populate resilient lines from RM masters
      setRawMaterials(prev => {
        if (prev && prev.length > 0) return prev;
        return generateFallbackRmLines(tplObj, qtyToScale, rms);
      });
    }
  }, [allTemplates, totalPlannedQty, rawMaterialMasters, uomMasters, buildLinesFromTemplate, generateFallbackRmLines]);

  const isHydratedRef = useRef(false);
  const [hasRestoredDraft, setHasRestoredDraft] = useState(false);

  // ── Fetch Initial Masters from Cache & Hydrate Draft (Run ONCE on mount) ──
  useEffect(() => {
    let isMounted = true;
    const init = async () => {
      try {
        if (!peekProductionMasters()) {
          setLoading(true);
        }
        const masters = await getProductionMasters();
        if (!isMounted) return;

        setBases(masters.bases || []);
        setAllTemplates(masters.templates || []);
        setProducts(masters.products || []);
        setCategories(masters.categories || []);
        setSubcategories(masters.subcategories || []);
        setRawMaterialMasters(masters.rawMaterials || []);
        setUomMasters(masters.uoms || []);

        if (isEditMode) {
          // Hydrate from Database for Edit/Draft update
          try {
            setLoadingBatch(true);
            const res = await api.get(`/production/batches-redesign/${editBatchId}`);
            const b = res.data;
            if (b && isMounted) {
              setEditingBatchNo(b.batchNumber || '');
              setEditingBatchStatus(b.status || '');
              if (b.productionDate) setProductionDate(new Date(b.productionDate).toISOString().split('T')[0]);
              else if (b.startDate) setProductionDate(new Date(b.startDate).toISOString().split('T')[0]);
              if (b.shift) setShift(b.shift);
              if (b.machineLine) setMachineLine(b.machineLine);
              if (b.expiryDays) setExpiryDays(Number(b.expiryDays));
              if (b.adjustmentReason) setAdjustmentReason(b.adjustmentReason);
              if (b.adjustmentReference) setAdjustmentReference(b.adjustmentReference);
              if (b.note) setNote(b.note || '');
              if (b.baseId) setSelectedBaseId(b.baseId);
              if (b.templateId) {
                const matchTpl = (masters.templates || []).find(t => t.id === b.templateId) || { id: b.templateId, name: 'Production Template' };
                setSelectedTemplate(matchTpl);
              }
              if (b.wastagePct !== undefined) setWastagePct(Number(b.wastagePct));
              if (b.overheadPct !== undefined) setOverheadPct(Number(b.overheadPct));

              // Products
              const rawProducts = Array.isArray(b.products) && b.products.length > 0
                ? b.products
                : (Array.isArray(b.selectedProducts) && b.selectedProducts.length > 0 ? b.selectedProducts : []);
              
              let loadedProducts = [];
              if (rawProducts.length > 0) {
                loadedProducts = rawProducts.map(p => {
                  const masterProd = (masters.products || []).find(mp => mp.id === (p.productId || p.id)) || {};
                  return {
                    productId: p.productId || p.id || masterProd.id,
                    name: p.productName || p.name || masterProd.name || 'Finished Product',
                    code: p.productCode || p.code || masterProd.code || 'SKU',
                    series: p.series || masterProd.specifications?.series || masterProd.brand || 'BG',
                    group: p.group || masterProd.specifications?.group || masterProd.category?.name || 'Gallon',
                    factor: Number(p.factor || masterProd.specifications?.factor || 1.0),
                    baseName: p.baseName || masterProd.base?.name || 'ICE CREAM BASE',
                    plannedQty: Number(p.plannedQty || p.quantity || 100),
                    unit: p.unit || masterProd.unit?.abbreviation || masterProd.unit?.name || 'Nos'
                  };
                });
              } else if (b.product || b.productId) {
                const masterProd = (masters.products || []).find(mp => mp.id === b.productId) || b.product || {};
                loadedProducts = [{
                  productId: b.productId || masterProd.id,
                  name: masterProd.name || 'Finished Product',
                  code: masterProd.code || 'SKU',
                  series: masterProd.specifications?.series || masterProd.brand || 'BG',
                  group: masterProd.specifications?.group || masterProd.category?.name || 'Gallon',
                  factor: Number(masterProd.specifications?.factor || 1.0),
                  baseName: masterProd.base?.name || 'ICE CREAM BASE',
                  plannedQty: Number(b.quantity || 100),
                  unit: masterProd.unit?.abbreviation || masterProd.unit?.name || 'Nos'
                }];
              }
              setSelectedProducts(loadedProducts);

              // Raw Materials and Lot allocations
              if (Array.isArray(b.rmUsages) && b.rmUsages.length > 0) {
                const loadedRms = b.rmUsages.map(rm => {
                  const rmMaster = (masters.rawMaterials || []).find(m => m.id === rm.rmId || m.id === rm.rawMaterialId);
                  return {
                    rmId: rm.rmId || rm.rawMaterialId,
                    rawMaterialId: rm.rmId || rm.rawMaterialId,
                    rmCode: rm.rmCode || rm.rawMaterialCode || rmMaster?.code || '',
                    rawMaterialCode: rm.rmCode || rm.rawMaterialCode || rmMaster?.code || '',
                    rmName: rm.rmName || rm.rawMaterialName || rmMaster?.name || '',
                    rawMaterialName: rm.rmName || rm.rawMaterialName || rmMaster?.name || '',
                    requiredQty: Number(rm.requiredQty || rm.requiredQuantity || rm.allocatedQuantity || 0),
                    baseRequiredQty: Number(rm.baseRequiredQty || rm.requiredQty || 0),
                    altRequiredQty: Number(rm.altRequiredQty || rm.requiredQty || 0),
                    uom: rm.uom || rm.selectedUom || 'Kg',
                    selectedUom: rm.selectedUom || rm.uom || 'Kg',
                    baseUom: rm.baseUom || rm.uom || 'Kg',
                    activeEntryMode: rm.activeEntryMode || 'BASE',
                    unitRate: Number(rm.unitRate || rm.costPerUnit || 0),
                    totalCost: Number(rm.totalCost || 0),
                    rateSource: rm.rateSource || 'LATEST_PO',
                    hasAlternateUom: Boolean(rm.hasAlternateUom),
                    conversionFactor: Number(rm.conversionFactor || 1),
                    allocatedBatches: Array.isArray(rm.allocatedBatches) ? rm.allocatedBatches : []
                  };
                });
                setRawMaterials(loadedRms);
              }

              // Timeline Stages
              const stages = b.timelineStages || b.timeline_stages;
              if (Array.isArray(stages) && stages.length > 0) {
                setTimelineStages(stages);
              }

              // Labour
              if (b.labourCount !== undefined) setLabourCount(Number(b.labourCount));
              if (Array.isArray(b.assignedStaffIds)) setAssignedStaffIds(b.assignedStaffIds);
              if (Array.isArray(b.labourStaffDetails)) setLabourStaffDetails(b.labourStaffDetails);
            }
          } catch (fetchErr) {
            console.error('Failed to load stock replenishment batch for edit:', fetchErr);
            Swal.fire({
              title: 'Error Loading Batch',
              text: fetchErr.response?.data?.error || 'Could not fetch replenishment batch details for editing.',
              icon: 'error'
            });
          } finally {
            if (isMounted) setLoadingBatch(false);
          }
        } else if (paramOrderId || paramProductId) {
          // Pre-populate if redirected from requirements with orderId or productId
          let prefilledProducts = [];
          let targetTotalQty = Number(paramQuantity) || 2000;

          if (paramOrderId) {
            try {
              const res = await api.get(`/orders/${paramOrderId}`);
              const order = res.data;
              if (order) {
                setAdjustmentReason('Order Deficit Replenishment');
                setAdjustmentReference(`SO-${order.docNo || order.referenceNo || paramOrderId.slice(-6)}`);
                if (order.customer?.name) {
                  setNote(`Order fulfillment for ${order.customer.name} (SO: ${order.docNo || order.referenceNo})`);
                }

                if (Array.isArray(order.items) && order.items.length > 0) {
                  prefilledProducts = order.items.map(it => {
                    const prod = (masters.products || []).find(p => p.id === it.productId) || it.product || {};
                    const isTarget = paramProductId && (it.productId === paramProductId || prod.id === paramProductId);
                    const qty = isTarget && paramQuantity ? Number(paramQuantity) : Number(it.shortfallQty || it.quantity || 100);

                    return {
                      productId: it.productId || prod.id,
                      name: it.productName || prod.name || 'Ordered Product',
                      code: it.productCode || prod.code || 'SKU',
                      series: prod.specifications?.series || prod.brand || 'BG',
                      group: prod.specifications?.group || prod.category?.name || 'Gallon',
                      factor: Number(prod.specifications?.factor || 1.0),
                      baseName: prod.base?.name || 'ICE CREAM BASE',
                      plannedQty: qty,
                      unit: prod.unit?.abbreviation || prod.unit?.name || it.uomName || 'Nos'
                    };
                  });
                  targetTotalQty = prefilledProducts.reduce((s, p) => s + Number(p.plannedQty || 0), 0) || 2000;
                }
              }
            } catch (err) {
              console.warn('Failed to fetch order for stock update:', err.message);
            }
          }

          if (prefilledProducts.length === 0 && paramProductId) {
            const prod = (masters.products || []).find(p => p.id === paramProductId);
            if (prod) {
              setAdjustmentReason('Low Stock Replenishment');
              setAdjustmentReference(`REQ-${prod.code || Date.now().toString().slice(-6)}`);
              targetTotalQty = Number(paramQuantity) > 0 ? Number(paramQuantity) : 100;
              prefilledProducts = [{
                productId: prod.id,
                name: prod.name,
                code: prod.code,
                series: prod.specifications?.series || prod.brand || 'BG',
                group: prod.specifications?.group || prod.category?.name || 'Gallon',
                factor: Number(prod.specifications?.factor || 1.0),
                baseName: prod.base?.name || 'ICE CREAM BASE',
                plannedQty: targetTotalQty,
                unit: prod.unit?.abbreviation || prod.unit?.name || 'Nos'
              }];
            }
          }

          if (prefilledProducts.length > 0) {
            setSelectedProducts(prefilledProducts);

            // Auto-select base and template for first product
            const firstPId = paramProductId || prefilledProducts[0]?.productId;
            const firstProd = (masters.products || []).find(p => p.id === firstPId) || (masters.products || [])[0];
            const baseIdToUse = firstProd?.baseId || (masters.bases || [])[0]?.id;
            if (baseIdToUse) {
              setSelectedBaseId(baseIdToUse);
              const matchTpl = (masters.templates || []).find(t => t.baseId === baseIdToUse && (t.status === 'ACTIVE' || !t.status)) || masters.templates[0];
              if (matchTpl) {
                handleSelectTemplate(matchTpl, masters.rawMaterials, masters.uoms, targetTotalQty);
              }
            }
          }
        } else {
          // Hydrate from persistent draft if available
          const draft = getProductionDraft();
          if (draft && (draft.selectedProducts?.length > 0 || draft.selectedBaseId || draft.rawMaterials?.length > 0 || draft.adjustmentReason || draft.note || draft.machineLine)) {
            if (draft.productionDate) setProductionDate(draft.productionDate);
            if (draft.shift) setShift(draft.shift);
            if (draft.machineLine) setMachineLine(draft.machineLine);
            if (draft.expiryDays) setExpiryDays(Number(draft.expiryDays));
            if (draft.adjustmentReason) setAdjustmentReason(draft.adjustmentReason);
            if (draft.adjustmentReference) setAdjustmentReference(draft.adjustmentReference);
            if (draft.note) setNote(draft.note);
            if (draft.selectedBaseId) setSelectedBaseId(draft.selectedBaseId);
            if (draft.selectedTemplate) setSelectedTemplate(draft.selectedTemplate);
            if (draft.selectedCategoryId) setSelectedCategoryId(draft.selectedCategoryId);
            if (draft.selectedSubcategoryId) setSelectedSubcategoryId(draft.selectedSubcategoryId);
            if (Array.isArray(draft.selectedProducts) && draft.selectedProducts.length > 0) {
              setSelectedProducts(draft.selectedProducts);
            }
            if (Array.isArray(draft.rawMaterials) && draft.rawMaterials.length > 0) {
              setRawMaterials(draft.rawMaterials);
            } else if (draft.selectedTemplate) {
              handleSelectTemplate(draft.selectedTemplate, masters.rawMaterials, masters.uoms);
            }
            if (Array.isArray(draft.timelineStages) && draft.timelineStages.length > 0) {
              setTimelineStages(draft.timelineStages);
            }
            if (draft.labourCount !== undefined) setLabourCount(Number(draft.labourCount));
            if (Array.isArray(draft.assignedStaffIds)) setAssignedStaffIds(draft.assignedStaffIds);
            if (Array.isArray(draft.labourStaffDetails)) setLabourStaffDetails(draft.labourStaffDetails);
            if (draft.wastagePct !== undefined) setWastagePct(Number(draft.wastagePct));
            if (draft.overheadPct !== undefined) setOverheadPct(Number(draft.overheadPct));
            setHasRestoredDraft(true);
          } else {
            // Default initial selection if no draft exists
            const activeBases = (masters.bases || []).filter(b => b.status === 'ACTIVE' || !b.status);
            if (activeBases.length > 0) {
              const icb = activeBases.find(b => (b.code || '').toUpperCase() === 'ICB') || activeBases[0];
              setSelectedBaseId(icb.id);

              const matchTpl = (masters.templates || []).find(t => t.baseId === icb.id && (t.status === 'ACTIVE' || !t.status)) || masters.templates[0];
              if (matchTpl) {
                handleSelectTemplate(matchTpl, masters.rawMaterials, masters.uoms, 2000);
              }
            }
          }
        }
      } catch (err) {
        console.error('Initialization error:', err);
      } finally {
        if (isMounted) {
          setLoading(false);
          isHydratedRef.current = true;
        }
      }
    };

    init();
    return () => { isMounted = false; };
  }, [isEditMode, editBatchId]); // Run on mount or editBatchId change

  // Auto-save draft on user edits (debounced) - only when creating new batch
  useEffect(() => {
    if (!isHydratedRef.current || isEditMode) return;
    const currentDraft = {
      productionDate,
      shift,
      machineLine,
      expiryDays,
      note,
      adjustmentReason,
      adjustmentReference,
      selectedBaseId,
      selectedTemplate,
      selectedCategoryId,
      selectedSubcategoryId,
      selectedProducts,
      rawMaterials,
      timelineStages,
      labourCount,
      assignedStaffIds,
      labourStaffDetails,
      wastagePct,
      overheadPct
    };
    saveProductionDraft(currentDraft, 'STOCK_UPDATE');
  }, [
    isEditMode,
    productionDate, shift, machineLine, expiryDays, note,
    adjustmentReason, adjustmentReference,
    selectedBaseId, selectedTemplate, selectedCategoryId, selectedSubcategoryId,
    selectedProducts, rawMaterials, timelineStages, labourCount,
    assignedStaffIds, labourStaffDetails, wastagePct, overheadPct
  ]);

  // Synchronous flush before switching mode
  const handleSwitchMode = (targetPath, targetMode) => {
    if (!isEditMode) {
      flushProductionDraft({
        productionDate,
        shift,
        machineLine,
        expiryDays,
        note,
        adjustmentReason,
        adjustmentReference,
        selectedBaseId,
        selectedTemplate,
        selectedCategoryId,
        selectedSubcategoryId,
        selectedProducts,
        rawMaterials,
        timelineStages,
        labourCount,
        assignedStaffIds,
        labourStaffDetails,
        wastagePct,
        overheadPct
      }, targetMode);
    }
    navigate(targetPath);
  };

  const handleResetDraft = () => {
    if (isEditMode) {
      window.location.reload();
      return;
    }
    clearProductionDraft();
    setHasRestoredDraft(false);
    setSelectedProducts([]);
    setNote('');
    const activeBases = bases.filter(b => b.status === 'ACTIVE' || !b.status);
    if (activeBases.length > 0) {
      const icb = activeBases.find(b => (b.code || '').toUpperCase() === 'ICB') || activeBases[0];
      setSelectedBaseId(icb.id);
      const matchTpl = allTemplates.find(t => t.baseId === icb.id && (t.status === 'ACTIVE' || !t.status)) || allTemplates[0];
      if (matchTpl) {
        handleSelectTemplate(matchTpl, rawMaterialMasters, uomMasters, 2000);
      }
    }
  };

  // Compute live Lowest Stock Products
  const lowStockProducts = useMemo(() => {
    return [...products]
      .sort((a, b) => Number(a.currentStock || 0) - Number(b.currentStock || 0))
      .slice(0, 8);
  }, [products]);

  const selectedBaseName = useMemo(() => {
    return bases.find(b => b.id === selectedBaseId)?.name || 'Ice Cream Base';
  }, [bases, selectedBaseId]);

  // Templates filtered by selected base with fallback synthesis
  const templatesForSelectedBase = useMemo(() => {
    if (!selectedBaseId) return [];
    const directMatches = allTemplates.filter(t => t.baseId === selectedBaseId && (t.status === 'ACTIVE' || !t.status));
    if (directMatches.length > 0) return directMatches;

    const currentBase = bases.find(b => b.id === selectedBaseId);
    if (!currentBase) return [];

    return [{
      id: `default-tpl-${currentBase.id}`,
      code: `TPL-${(currentBase.code || 'BASE').toUpperCase()}-01`,
      name: `${currentBase.name} Standard Formulation`,
      description: currentBase.description || `Standard production formula for ${currentBase.name}`,
      baseId: currentBase.id,
      baseName: currentBase.name,
      baseCode: currentBase.code,
      outputQty: 2000,
      outputUom: 'Nos',
      grandTotal: 18500,
      status: 'ACTIVE',
      lines: []
    }];
  }, [allTemplates, selectedBaseId, bases]);

  // Handle 1-click select of lowest stock product & immediate formulation loading
  const handleSelectLowStockProduct = (prod) => {
    if (!prod) return;

    const series = prod.specifications?.series || prod.brand || 'BG';
    const group = prod.specifications?.group || prod.category?.name || 'Gallon';
    const factor = Number(prod.specifications?.factor || 1.0);
    const baseName = prod.base?.name || prod.specifications?.baseName || selectedBaseName || 'ICE CREAM BASE';
    const minThreshold = Number(prod.minStock || prod.reorderPoint || 100);
    const curr = Number(prod.currentStock || 0);
    const deficit = Math.max(100, minThreshold - curr);

    setSelectedProducts([
      {
        productId: prod.id,
        name: prod.name,
        code: prod.code,
        series,
        group,
        factor,
        baseName,
        plannedQty: deficit > 0 ? deficit : 500,
        unit: prod.unit?.abbreviation || prod.unit?.name || 'Nos'
      }
    ]);

    const pBaseId = prod.baseId || prod.specifications?.baseId;
    const targetBaseId = (pBaseId && bases.some(b => b.id === pBaseId)) ? pBaseId : selectedBaseId;
    if (pBaseId && bases.some(b => b.id === pBaseId)) {
      setSelectedBaseId(pBaseId);
    }

    const matchTpl = allTemplates.find(t => t.baseId === targetBaseId && (t.status === 'ACTIVE' || !t.status)) || allTemplates[0];
    if (matchTpl) {
      handleSelectTemplate(matchTpl, null, null, deficit > 0 ? deficit : 500);
    }
  };

  // When user switches base in Card 2
  const handleSelectBase = (baseId) => {
    setSelectedBaseId(baseId);
    const directMatches = allTemplates.filter(t => t.baseId === baseId && (t.status === 'ACTIVE' || !t.status));
    if (directMatches.length > 0) {
      handleSelectTemplate(directMatches[0]);
    } else {
      const currentBase = bases.find(b => b.id === baseId);
      const defaultTpl = {
        id: `default-tpl-${baseId}`,
        code: `TPL-${(currentBase?.code || 'BASE').toUpperCase()}-01`,
        name: `${currentBase?.name || 'Base'} Standard Formulation`,
        description: currentBase?.description || 'Standard production formula',
        baseId: baseId,
        baseName: currentBase?.name || 'Base',
        baseCode: currentBase?.code || '',
        outputQty: 2000,
        outputUom: 'Nos',
        grandTotal: 18500,
        status: 'ACTIVE',
        lines: []
      };
      handleSelectTemplate(defaultTpl);
    }
  };

  // Auto-scale raw materials whenever totalPlannedQty changes
  useEffect(() => {
    if (!selectedTemplate) return;
    const templateOutput = Number(selectedTemplate.outputQty || 2000);
    const scalingFactor = (totalPlannedQty || 2000) / templateOutput;

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
  }, [totalPlannedQty, selectedTemplate]);

  // Live Refresh Prices from PO
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
            // retain existing rate
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
    const wAmt = Number(((sub * wastagePct) / 100).toFixed(2));
    const oAmt = Number(((sub * overheadPct) / 100).toFixed(2));
    const grand = Number((sub + wAmt + oAmt).toFixed(2));
    const perUnit = totalPlannedQty > 0 ? Number((grand / totalPlannedQty).toFixed(2)) : 0;
    return {
      subTotal: sub,
      wastageAmt: wAmt,
      overheadAmt: oAmt,
      grandTotal: grand,
      costPerUnit: perUnit
    };
  }, [rawMaterials, wastagePct, overheadPct, totalPlannedQty]);

  // Stage durations total calculation
  const totalDurationMinutes = useMemo(() => {
    return timelineStages.reduce((acc, s) => {
      const m = Number(s.durationMonths || 0) * 30 * 24 * 60;
      const d = Number(s.durationDays || 0) * 24 * 60;
      const h = Number(s.durationHours || 0) * 60;
      const min = Number(s.durationMinutes || 0);
      return acc + m + d + h + min;
    }, 0);
  }, [timelineStages]);

  const totalDurationStr = useMemo(() => {
    if (totalDurationMinutes === 0) return '0 mins';
    const hrs = Math.floor(totalDurationMinutes / 60);
    const mins = totalDurationMinutes % 60;
    if (hrs > 0 && mins > 0) return `${hrs}h ${mins}m`;
    if (hrs > 0) return `${hrs}h`;
    return `${mins}m`;
  }, [totalDurationMinutes]);

  // Lot Allocation Status
  const requiredRmLines = useMemo(() => {
    return rawMaterials.filter(rm => !rm.isOverhead);
  }, [rawMaterials]);

  const allocatedRmLines = useMemo(() => {
    return requiredRmLines.filter(rm => {
      const totalAllocated = (rm.allocatedBatches || []).reduce((acc, b) => acc + Number(b.allocatedQty || 0), 0);
      const req = Number(rm.requiredQty || 0);
      return totalAllocated >= req && req > 0;
    });
  }, [requiredRmLines]);

  const areRawMaterialsAllocated = useMemo(() => {
    if (requiredRmLines.length === 0) return false;
    return allocatedRmLines.length === requiredRmLines.length;
  }, [requiredRmLines, allocatedRmLines]);

  // Product Selection handler
  const handleSelectProduct = (product) => {
    if (selectedProducts.some(p => p.productId === product.id)) {
      return;
    }

    const series = product.specifications?.series || product.series || 'REGULAR';
    const group = product.specifications?.group || product.group || 'GENERAL';
    const factor = Number(product.specifications?.factor || product.factor || 1);
    const baseName = product.specifications?.baseName || product.baseName || selectedBaseName;

    const newProd = {
      productId: product.id,
      name: product.name,
      code: product.code,
      series,
      group,
      factor,
      baseName,
      plannedQty: 500,
      unit: product.unit?.abbreviation || product.unit?.name || 'Nos'
    };

    setSelectedProducts(prev => [...prev, newProd]);

    if (product.baseId && bases.some(b => b.id === product.baseId)) {
      setSelectedBaseId(product.baseId);
    }

    const prodStages = product.workflow_stages || product.specifications?.workflow_stages || product.specifications?.timelineStages;
    if (Array.isArray(prodStages) && prodStages.length > 0) {
      setTimelineStages(prodStages);
    }

    // Ensure formulation is immediately loaded
    if (!selectedTemplate || rawMaterials.length === 0) {
      const matchTpl = allTemplates.find(t => (product.baseId && t.baseId === product.baseId) || t.baseId === selectedBaseId) || allTemplates[0];
      if (matchTpl) {
        handleSelectTemplate(matchTpl);
      }
    }
  };

  const handleUpdateProducts = (newProducts) => {
    setSelectedProducts(newProducts);
    if (newProducts.length > 0 && (!selectedTemplate || rawMaterials.length === 0)) {
      const matchTpl = templatesForSelectedBase[0] || allTemplates[0];
      if (matchTpl) {
        handleSelectTemplate(matchTpl);
      }
    }
  };

  // ── READINESS CHECKLIST CRITERIA ──
  const isPlanTargetSet = Boolean(productionDate && shift && adjustmentReason);
  const isBaseAndTemplateChosen = Boolean(selectedBaseId && selectedTemplate);
  const isProductAdded = selectedProducts.length > 0;
  const areStageDurationsSet = timelineStages.length > 0 && timelineStages.every(s => {
    const total = Number(s.durationMonths || 0) + Number(s.durationDays || 0) + Number(s.durationHours || 0) + Number(s.durationMinutes || 0);
    return total > 0;
  });
  const isStaffAssigned = labourCount > 0 && assignedStaffIds.length === labourCount;
  
  const isReadyToStart = isPlanTargetSet && isBaseAndTemplateChosen && isProductAdded && areRawMaterialsAllocated && areStageDurationsSet && isStaffAssigned;

  // Handle Save Batch
  const handleSave = async (status = 'Draft') => {
    if (!isPlanTargetSet) {
      Swal.fire({ title: 'Validation Error', text: 'Please set production schedule and adjustment reason in Card 1.', icon: 'warning' });
      return;
    }
    if (!selectedBaseId || !selectedTemplate) {
      Swal.fire({ title: 'Validation Error', text: 'Please select both Base Master and Production Template in Card 2.', icon: 'warning' });
      return;
    }
    if (selectedProducts.length === 0) {
      Swal.fire({ title: 'Validation Error', text: 'Please select at least one finished product to replenish in Card 3.', icon: 'warning' });
      return;
    }
    if (status === 'In Progress' && !areRawMaterialsAllocated) {
      Swal.fire({
        title: 'Lot Reservation Required',
        text: 'All raw material formulation items must have physical warehouse lots reserved before starting production.',
        icon: 'warning'
      });
      return;
    }

    const payload = {
      productionType: 'STOCK_UPDATE',
      batchNumber: `STK-${Date.now().toString().slice(-6)}`,
      productionDate,
      startDate: productionDate,
      shift,
      machineLine,
      expiryDays,
      adjustmentReason,
      adjustmentReference,
      note,
      status: status === 'In Progress' ? 'In Progress' : 'Draft',
      baseId: selectedBaseId,
      templateId: selectedTemplate?.id,
      products: selectedProducts.map(p => ({
        productId: p.productId,
        name: p.name,
        code: p.code,
        plannedQty: Number(p.plannedQty),
        unit: p.unit,
        series: p.series,
        group: p.group,
        factor: p.factor
      })),
      selectedProducts: selectedProducts.map(p => ({
        productId: p.productId,
        name: p.name,
        code: p.code,
        plannedQty: Number(p.plannedQty),
        unit: p.unit,
        series: p.series,
        group: p.group,
        factor: p.factor
      })),
      quantity: totalPlannedQty,
      totalPlannedQty,
      wastagePct,
      wastageAmt: costingTotals.wastageAmt,
      overheadPct,
      overheadAmt: costingTotals.overheadAmt,
      subTotal: costingTotals.subTotal,
      grandTotal: costingTotals.grandTotal,
      costPerUnit: costingTotals.costPerUnit,
      rawMaterials: rawMaterials.map(rm => ({
        rmId: rm.rmId,
        rawMaterialId: rm.rmId,
        rmCode: rm.rmCode,
        rawMaterialCode: rm.rmCode,
        rmName: rm.rmName,
        rawMaterialName: rm.rmName,
        requiredQty: Number(rm.requiredQty),
        baseRequiredQty: Number(rm.baseRequiredQty || rm.requiredQty),
        altRequiredQty: Number(rm.altRequiredQty || rm.requiredQty),
        uom: rm.selectedUom || rm.baseUom,
        selectedUom: rm.selectedUom || rm.baseUom,
        baseUom: rm.baseUom,
        activeEntryMode: rm.activeEntryMode,
        unitRate: Number(rm.unitRate),
        totalCost: Number(rm.totalCost),
        rateSource: rm.rateSource,
        hasAlternateUom: rm.hasAlternateUom,
        conversionFactor: Number(rm.conversionFactor || 1),
        allocatedBatches: rm.allocatedBatches || []
      })),
      timelineStages,
      totalDurationMinutes,
      labourCount,
      assignedStaffIds,
      labourStaffDetails
    };

    try {
      setSaving(true);
      if (isEditMode) {
        await api.put(`/production/batches-redesign/${editBatchId}`, payload);
        Swal.fire({
          title: status === 'In Progress' ? 'Production Started!' : 'Draft Batch Updated!',
          text: `Replenishment batch ${editingBatchNo ? `#${editingBatchNo}` : ''} updated successfully.`,
          icon: 'success',
          timer: 2000
        });
      } else {
        await api.post('/production/batches-redesign', payload);
        clearProductionDraft(); // Cleared upon starting production or saving batch!
        Swal.fire({
          title: status === 'In Progress' ? 'Production Started!' : 'Replenishment Batch Draft Saved!',
          text: `Stock replenishment batch successfully recorded.`,
          icon: 'success',
          timer: 2000
        });
      }
      navigate('/production/stock-update');
    } catch (err) {
      console.error('Failed to save replenishment batch:', err);
      const msg = err.response?.data?.error || 'Failed to save replenishment batch.';
      Swal.fire({ title: 'Error', text: msg, icon: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#F4F5F8] dark:bg-slate-950 font-['Plus_Jakarta_Sans',sans-serif] text-slate-800 dark:text-slate-100 pb-20">
      
      {/* ── 1) STICKY HEADER (72px, 100% full screen width) ── */}
      <header className="sticky top-0 z-40 h-[72px] w-full bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-[#E3E6EC] dark:border-slate-800 px-4 sm:px-6 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate('/production/stock-update')}
            className="w-10 h-10 p-0 rounded-[10px] border border-[#E3E6EC] dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 shrink-0 cursor-pointer"
            title="Back to Stock Replenishment List"
          >
            <ArrowLeft className="w-4 h-4 text-slate-600 dark:text-slate-300" />
          </Button>

          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                {isEditMode ? 'Edit Stock Replenishment Batch' : 'Low Stock Replenishment Batch'}
              </h1>
              {isEditMode ? (
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-amber-50 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-700">
                  EDITING DRAFT {editingBatchNo ? `• #${editingBatchNo}` : ''}
                </span>
              ) : (
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/80 text-[#0F7B5F] dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/60">
                  INVENTORY REPLENISHMENT COCKPIT
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {isEditMode ? 'Modify formulation, quantities, lots, stages and update batch' : 'Produce batches to restore warehouse stock levels above safety thresholds'}
            </p>
          </div>
        </div>

        {/* Right side action buttons */}
        <div className="flex items-center gap-2.5 shrink-0">
          <Button
            type="button"
            variant="ghost"
            onClick={() => navigate('/production/stock-update')}
            className="h-[44px] px-4 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 rounded-[10px] cursor-pointer"
          >
            Cancel
          </Button>

          <Button
            type="button"
            variant="outline"
            disabled={saving || loadingBatch}
            onClick={() => handleSave('Draft')}
            className="h-[44px] px-4 text-xs font-bold border-[#E3E6EC] dark:border-slate-800 rounded-[10px] text-slate-700 dark:text-slate-200 hover:bg-slate-50 cursor-pointer"
          >
            <Save className="w-4 h-4 mr-1.5" />
            <span>{isEditMode ? 'Update Draft' : 'Save Draft'}</span>
          </Button>

          <Button
            type="button"
            disabled={saving || loadingBatch || !isReadyToStart}
            onClick={() => handleSave('In Progress')}
            className={`h-[44px] px-5 text-xs font-bold rounded-[10px] shadow-xs flex items-center gap-1.5 transition-all ${
              isReadyToStart && !loadingBatch
                ? 'bg-[#4F46E5] hover:bg-[#4338CA] text-white cursor-pointer ring-2 ring-indigo-500/20'
                : 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed opacity-60'
            }`}
          >
            <Play className="w-4 h-4 fill-current" />
            <span>{isEditMode ? 'Update & Start Production' : 'Start Production'}</span>
          </Button>
        </div>
      </header>

      {/* Loading banner when fetching batch */}
      {loadingBatch && (
        <div className="w-full bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-800/50 px-4 py-2 flex items-center justify-center gap-2 text-xs font-semibold text-amber-800 dark:text-amber-300">
          <RefreshCw className="w-4 h-4 animate-spin text-amber-600" />
          <span>Fetching replenishment batch details from database for editing...</span>
        </div>
      )}

      {/* ── WORKFLOW STEP TRACKER (Numbered 1 to 6) ── */}
      <div className="w-full bg-white dark:bg-slate-900 border-b border-[#E3E6EC] dark:border-slate-800 px-4 sm:px-6 py-2.5">
        <div className="flex items-center gap-2 sm:gap-4 overflow-x-auto text-xs font-bold text-slate-600 dark:text-slate-300 no-scrollbar">
          
          {/* Step 1: Reason & Date */}
          <div className="flex items-center gap-2 shrink-0">
            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold ${
              isPlanTargetSet ? 'bg-[#0F7B5F] text-white' : 'bg-[#4F46E5] text-white'
            }`}>
              {isPlanTargetSet ? '✓' : '1'}
            </span>
            <span className={isPlanTargetSet ? 'text-[#0F7B5F]' : 'text-slate-900 dark:text-white'}>
              1. Reason &amp; Date
            </span>
          </div>

          <ChevronRight className="w-3.5 h-3.5 text-slate-300 shrink-0" />

          {/* Step 2: Base & Template */}
          <div className="flex items-center gap-2 shrink-0">
            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold ${
              isBaseAndTemplateChosen ? 'bg-[#0F7B5F] text-white' : isPlanTargetSet ? 'bg-[#4F46E5] text-white' : 'bg-slate-200 text-slate-500'
            }`}>
              {isBaseAndTemplateChosen ? '✓' : '2'}
            </span>
            <span className={isBaseAndTemplateChosen ? 'text-[#0F7B5F]' : isPlanTargetSet ? 'text-slate-900 dark:text-white' : 'text-slate-400'}>
              2. Base &amp; Template
            </span>
          </div>

          <ChevronRight className="w-3.5 h-3.5 text-slate-300 shrink-0" />

          {/* Step 3: Raw Material Formulation & Lots */}
          <div className="flex items-center gap-2 shrink-0">
            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold ${
              areRawMaterialsAllocated ? 'bg-[#0F7B5F] text-white' : isBaseAndTemplateChosen ? 'bg-[#4F46E5] text-white' : 'bg-slate-200 text-slate-500'
            }`}>
              {areRawMaterialsAllocated ? '✓' : '3'}
            </span>
            <span className={areRawMaterialsAllocated ? 'text-[#0F7B5F]' : isBaseAndTemplateChosen ? 'text-slate-900 dark:text-white' : 'text-slate-400'}>
              3. Formulation &amp; Lots
            </span>
          </div>

          <ChevronRight className="w-3.5 h-3.5 text-slate-300 shrink-0" />

          {/* Step 4: Factory Stages */}
          <div className="flex items-center gap-2 shrink-0">
            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold ${
              areStageDurationsSet ? 'bg-[#0F7B5F] text-white' : areRawMaterialsAllocated ? 'bg-[#4F46E5] text-white' : 'bg-slate-200 text-slate-500'
            }`}>
              {areStageDurationsSet ? '✓' : '4'}
            </span>
            <span className={areStageDurationsSet ? 'text-[#0F7B5F]' : areRawMaterialsAllocated ? 'text-slate-900 dark:text-white' : 'text-slate-400'}>
              4. Factory Stages
            </span>
          </div>

          <ChevronRight className="w-3.5 h-3.5 text-slate-300 shrink-0" />

          {/* Step 5: Finished Products */}
          <div className="flex items-center gap-2 shrink-0">
            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold ${
              isProductAdded ? 'bg-[#0F7B5F] text-white' : areStageDurationsSet ? 'bg-[#4F46E5] text-white' : 'bg-slate-200 text-slate-500'
            }`}>
              {isProductAdded ? '✓' : '5'}
            </span>
            <span className={isProductAdded ? 'text-[#0F7B5F]' : areStageDurationsSet ? 'text-slate-900 dark:text-white' : 'text-slate-400'}>
              5. Finished Products
            </span>
          </div>

          <ChevronRight className="w-3.5 h-3.5 text-slate-300 shrink-0" />

          {/* Step 6: Review & Staff */}
          <div className="flex items-center gap-2 shrink-0">
            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold ${
              isStaffAssigned ? 'bg-[#0F7B5F] text-white' : isProductAdded ? 'bg-[#4F46E5] text-white' : 'bg-slate-200 text-slate-500'
            }`}>
              {isStaffAssigned ? '✓' : '6'}
            </span>
            <span className={isStaffAssigned ? 'text-[#0F7B5F]' : isProductAdded ? 'text-slate-900 dark:text-white' : 'text-slate-400'}>
              6. Labour &amp; Staff
            </span>
          </div>
        </div>
      </div>

      {/* ── FULL SCREEN CONTENT WRAPPER ── */}
      <main className="w-full px-4 sm:px-6 py-6 space-y-6">

        {/* ── MODE QUICK TOGGLE TABS ── */}
        <div className="flex items-center justify-between pb-1 flex-wrap gap-2">
          <div className="flex items-center gap-1.5 p-1 bg-white dark:bg-slate-900 border border-[#E3E6EC] dark:border-slate-800 rounded-[10px] shadow-xs">
            <button
              type="button"
              onClick={() => handleSwitchMode('/production/standard/add', 'STANDARD')}
              className="px-3.5 py-1.5 rounded-[8px] text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white font-bold text-xs cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Standard Batch Run
            </button>
            <button
              type="button"
              onClick={() => handleSwitchMode('/production/order-based/add', 'ORDER_BASED')}
              className="px-3.5 py-1.5 rounded-[8px] text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white font-bold text-xs cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Order Based Batch
            </button>
            <button
              type="button"
              className="px-3.5 py-1.5 rounded-[8px] bg-[#4F46E5] text-white font-bold text-xs shadow-xs"
            >
              Low Stock Replenishment
            </button>
          </div>

          <div className="flex items-center gap-3">
            {hasRestoredDraft && (
              <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/50 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 shadow-2xs">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>Auto-saved Draft Loaded</span>
                <button
                  type="button"
                  onClick={handleResetDraft}
                  className="ml-1 text-[10px] underline hover:text-emerald-900 dark:hover:text-emerald-100 cursor-pointer font-bold"
                  title="Clear draft and restore initial defaults"
                >
                  Reset
                </button>
              </div>
            )}
            <div className="text-xs font-semibold text-slate-500">
              Workstation Mode: <strong className="text-[#0F7B5F]">WAREHOUSE REPLENISHMENT</strong>
            </div>
          </div>
        </div>

        {/* ── MAIN GRID: LEFT COLUMN (1fr) + RIGHT SIDEBAR (380px) ── */}
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-5 items-start">
          
          {/* ── LEFT COLUMN: STACKED NUMBERED CARDS ── */}
          <div className="space-y-5">
            
            {/* Card 1: Stock Replenishment Parameters */}
            <div className="bg-white dark:bg-slate-900 border border-[#E3E6EC] dark:border-slate-800 rounded-[12px] p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-[#E3E6EC] dark:border-slate-800">
                <div className="flex items-center gap-2.5">
                  <span className="w-7 h-7 rounded-full bg-[#4F46E5] text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
                    1
                  </span>
                  <div>
                    <h2 className="font-bold text-base text-slate-900 dark:text-white">
                      Replenishment criteria &amp; schedule
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Configure stock replenishment reason, safety threshold, and processing line
                    </p>
                  </div>
                </div>

                <span className="text-xs font-mono font-bold px-2.5 py-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                  {shift} Shift
                </span>
              </div>

              {/* 4-column responsive grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3.5">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Adjustment Reason <span className="text-rose-500">*</span>
                  </Label>
                  <select
                    value={adjustmentReason}
                    onChange={(e) => setAdjustmentReason(e.target.value)}
                    className="w-full h-[44px] px-3 bg-white dark:bg-slate-900 border border-[#E3E6EC] dark:border-slate-800 rounded-[10px] text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#4F46E5] cursor-pointer"
                  >
                    <option value="Low Stock Replenishment">Low Stock Replenishment</option>
                    <option value="Buffer Safety Build">Buffer Safety Build</option>
                    <option value="Seasonal Demand Surge">Seasonal Demand Surge</option>
                    <option value="Inventory Reconciliation">Inventory Reconciliation</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Production Date <span className="text-rose-500">*</span>
                  </Label>
                  <Input
                    type="date"
                    value={productionDate}
                    onChange={(e) => setProductionDate(e.target.value)}
                    className="h-[44px] rounded-[10px] text-xs font-bold border-[#E3E6EC]"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Floor Shift <span className="text-rose-500">*</span>
                  </Label>
                  <select
                    value={shift}
                    onChange={(e) => setShift(e.target.value)}
                    className="w-full h-[44px] px-3 bg-white dark:bg-slate-900 border border-[#E3E6EC] dark:border-slate-800 rounded-[10px] text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#4F46E5] cursor-pointer"
                  >
                    <option value="Morning">Morning (06:00 - 14:00)</option>
                    <option value="Evening">Evening (14:00 - 22:00)</option>
                    <option value="Night">Night (22:00 - 06:00)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Processing Line
                  </Label>
                  <Input
                    value={machineLine}
                    onChange={(e) => setMachineLine(e.target.value)}
                    placeholder="e.g. Line A"
                    className="h-[44px] rounded-[10px] text-xs font-bold border-[#E3E6EC]"
                  />
                </div>
              </div>

              {/* 1-Click Fast Picks from lowest stock products */}
              <div className="pt-2 border-t border-[#E3E6EC] dark:border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <TrendingDown className="w-3.5 h-3.5 text-rose-500" />
                    <span>Quick Replenish: Lowest Stock Products</span>
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSearchModalMode('PRODUCT_SINGLE');
                        setSearchModalOpen(true);
                      }}
                      className="h-6 px-2 text-[11px] font-bold rounded-md border-indigo-400 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 cursor-pointer shadow-3xs flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" />
                      <span>+ Search Catalog</span>
                    </Button>
                    <span className="text-[11px] text-slate-400">Click to populate</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
                  {lowStockProducts.map(prod => (
                    <button
                      key={prod.id}
                      type="button"
                      onClick={() => handleSelectLowStockProduct(prod)}
                      className="px-3 py-1.5 rounded-[8px] border border-[#E3E6EC] dark:border-slate-800 bg-slate-50 dark:bg-slate-800/80 hover:border-[#4F46E5] hover:bg-indigo-50/50 text-left shrink-0 transition-colors cursor-pointer group"
                    >
                      <span className="font-bold text-xs text-slate-900 dark:text-white block group-hover:text-[#4F46E5] transition-colors">
                        {prod.name}
                      </span>
                      <span className="text-[10px] text-slate-500 flex items-center gap-1">
                        Stock: <strong className="text-rose-600 font-mono">{Number(prod.currentStock || 0)}</strong> · Min: <strong className="font-mono">{Number(prod.minStock || 100)}</strong>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Card 2: Base master & template */}
            <div className="bg-white dark:bg-slate-900 border border-[#E3E6EC] dark:border-slate-800 rounded-[12px] p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-[#E3E6EC] dark:border-slate-800">
                <div className="flex items-center gap-2.5">
                  <span className="w-7 h-7 rounded-full bg-[#4F46E5] text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
                    2
                  </span>
                  <div>
                    <h2 className="font-bold text-base text-slate-900 dark:text-white">
                      Base master &amp; template
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Recipe base master formula &amp; production template
                    </p>
                  </div>
                </div>

                <span className="text-xs font-semibold text-slate-500">
                  {bases.length} bases available
                </span>
              </div>

              {/* 3 selectable option cards: [FDB] FD Base, [ICB] Ice Cream Base, [KLB] Kulfi Base */}
              <ProductionBasePicker
                bases={bases}
                selectedBaseId={selectedBaseId}
                onSelectBase={handleSelectBase}
              />

              {/* Template row (full width, selectable): tag TPL-0001, template name, Batch size 2000 Nos, Cost ₹20,839.6 */}
              <ProductionTemplatePicker
                templates={templatesForSelectedBase}
                selectedTemplateId={selectedTemplate?.id || (typeof selectedTemplate === 'string' ? selectedTemplate : '')}
                onSelectTemplate={handleSelectTemplate}
                selectedBaseName={selectedBaseName}
              />
            </div>

          </div>

          {/* ── RIGHT SIDEBAR ── */}
          <aside className="space-y-5 xl:sticky xl:top-[92px]">
            
            {/* Card "Batch summary" */}
            <div className="bg-white dark:bg-slate-900 border border-[#E3E6EC] dark:border-slate-800 rounded-[12px] p-5 shadow-xs space-y-4">
              <div className="pb-3 border-b border-[#E3E6EC] dark:border-slate-800">
                <h3 className="font-bold text-base text-slate-900 dark:text-white">
                  Batch summary
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Live calculation &amp; readiness verification
                </p>
              </div>

              {/* Rows for Base, Template, Est. cost, Stages, Total duration */}
              <div className="space-y-2.5 text-xs">
                <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-slate-500">Base Master</span>
                  <span className="font-bold text-slate-900 dark:text-white break-words text-right max-w-[200px]" title={selectedBaseName}>
                    {selectedBaseName || 'Not Selected'}
                  </span>
                </div>

                <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-slate-500">Template</span>
                  <span className="font-bold text-slate-900 dark:text-white break-words text-right max-w-[200px]" title={selectedTemplate?.name}>
                    {selectedTemplate ? selectedTemplate.name : 'Not Selected'}
                  </span>
                </div>

                <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-slate-500">Est. Cost</span>
                  <span className="font-mono font-black text-sm text-[#4F46E5]">
                    ₹{costingTotals.grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 1, maximumFractionDigits: 2 })}
                  </span>
                </div>

                <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-slate-500">Stages</span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {timelineStages.length} of 14
                  </span>
                </div>

                <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-slate-500">Total Duration</span>
                  <span className="font-mono font-bold text-[#0F7B5F]">
                    {totalDurationStr}
                  </span>
                </div>
              </div>

              {/* READINESS Checklist */}
              <div className="pt-2 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">
                    READINESS CHECKLIST
                  </span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    isReadyToStart 
                      ? 'bg-[#0F7B5F]/10 text-[#0F7B5F]' 
                      : 'bg-amber-50 text-[#B45309]'
                  }`}>
                    {isReadyToStart ? 'Ready' : 'Pending Tasks'}
                  </span>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex items-center gap-2.5">
                    <span className={`w-3 h-3 rounded-full shrink-0 ${isPlanTargetSet ? 'bg-[#0F7B5F]' : 'bg-[#CBD5E1]'}`} />
                    <span className={isPlanTargetSet ? 'text-slate-800 dark:text-slate-200 font-medium' : 'text-slate-400'}>
                      Replenishment criteria set
                    </span>
                  </div>

                  <div className="flex items-center gap-2.5">
                    <span className={`w-3 h-3 rounded-full shrink-0 ${isBaseAndTemplateChosen ? 'bg-[#0F7B5F]' : 'bg-[#CBD5E1]'}`} />
                    <span className={isBaseAndTemplateChosen ? 'text-slate-800 dark:text-slate-200 font-medium' : 'text-slate-400'}>
                      Base &amp; template chosen
                    </span>
                  </div>

                  <div className="flex items-center gap-2.5">
                    <span className={`w-3 h-3 rounded-full shrink-0 ${areRawMaterialsAllocated ? 'bg-[#0F7B5F]' : 'bg-[#CBD5E1]'}`} />
                    <span className={areRawMaterialsAllocated ? 'text-slate-800 dark:text-slate-200 font-medium' : 'text-slate-400'}>
                      Raw materials allocated ({allocatedRmLines.length} of {requiredRmLines.length})
                    </span>
                  </div>

                  <div className="flex items-center gap-2.5">
                    <span className={`w-3 h-3 rounded-full shrink-0 ${areStageDurationsSet ? 'bg-[#0F7B5F]' : 'bg-[#CBD5E1]'}`} />
                    <span className={areStageDurationsSet ? 'text-slate-800 dark:text-slate-200 font-medium' : 'text-slate-400'}>
                      Stage durations set (&gt; 0 mins)
                    </span>
                  </div>

                  <div className="flex items-center gap-2.5">
                    <span className={`w-3 h-3 rounded-full shrink-0 ${isProductAdded ? 'bg-[#0F7B5F]' : 'bg-[#CBD5E1]'}`} />
                    <span className={isProductAdded ? 'text-slate-800 dark:text-slate-200 font-medium' : 'text-slate-400'}>
                      At least one product added ({selectedProducts.length})
                    </span>
                  </div>

                  <div className="flex items-center gap-2.5">
                    <span className={`w-3 h-3 rounded-full shrink-0 ${isStaffAssigned ? 'bg-[#0F7B5F]' : 'bg-[#CBD5E1]'}`} />
                    <span className={isStaffAssigned ? 'text-slate-800 dark:text-slate-200 font-medium' : 'text-slate-400'}>
                      Staff assigned ({assignedStaffIds.length} of {labourCount})
                    </span>
                  </div>
                </div>
              </div>

              {/* End with a full-width Start button */}
              <Button
                type="button"
                disabled={saving || !isReadyToStart}
                onClick={() => handleSave('In Progress')}
                className={`w-full h-[44px] rounded-[10px] text-xs font-bold shadow-xs transition-all flex items-center justify-center gap-2 ${
                  isReadyToStart 
                    ? 'bg-[#4F46E5] hover:bg-[#4338CA] text-white cursor-pointer ring-2 ring-indigo-500/20' 
                    : 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed opacity-60'
                }`}
              >
                <Play className="w-4 h-4 fill-current" />
                <span>Start Replenishment Production</span>
              </Button>
            </div>

          </aside>

        </div>

        {/* ── STEP 3: FULL-WIDTH SECTION: RAW MATERIAL FORMULATION & LOT ALLOCATION ── */}
        <div className="w-full space-y-4">
          <div className="bg-white dark:bg-slate-900 border border-[#E3E6EC] dark:border-slate-800 rounded-[12px] p-5 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-[#E3E6EC] dark:border-slate-800 gap-2 mb-4">
              <div className="flex items-center gap-2.5">
                <span className="w-7 h-7 rounded-full bg-[#4F46E5] text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
                  3
                </span>
                <div>
                  <h3 className="font-bold text-base text-slate-900 dark:text-white">
                    Raw Material Formulation &amp; Lot Allocation
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Live recipe consumption, alternate UOM selection &amp; mandatory inventory lot reservation
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSearchModalMode('RM_MULTI');
                    setSearchModalOpen(true);
                  }}
                  className="h-8 px-3 text-xs font-bold rounded-lg border-amber-400 text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/40 cursor-pointer shadow-3xs flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Add Raw Materials (Multi-Select)</span>
                </Button>

                <span className={`text-xs font-mono font-bold px-3 py-1 rounded-full ${
                  areRawMaterialsAllocated 
                    ? 'bg-emerald-50 text-[#0F7B5F] border border-emerald-200'
                    : 'bg-amber-50 text-[#B45309] border border-amber-200'
                }`}>
                  {allocatedRmLines.length} of {requiredRmLines.length} Allocated
                </span>
              </div>
            </div>

            {/* Live Recipe Formulation Grid */}
            {selectedTemplate || rawMaterials.length > 0 || selectedProducts.length > 0 ? (
              <BatchAllocationGrid
                rawMaterials={rawMaterials}
                onUpdateRawMaterials={setRawMaterials}
                rawMaterialMasters={rawMaterialMasters}
                onRefreshPrices={handleRefreshPrices}
                refreshingPrices={refreshingPrices}
                plannedOutputQty={totalPlannedQty}
                outputUom={selectedProducts[0]?.unit || 'Nos'}
              />
            ) : (
              <div className="p-8 rounded-[12px] border border-dashed border-[#E3E6EC] text-center text-slate-400 space-y-2 bg-slate-50/50">
                <Boxes className="w-8 h-8 mx-auto text-slate-400" />
                <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                  Select a Production Template in Card 2 or add finished products in Card 5 to load formulation lines
                </p>
                <p className="text-xs text-slate-500">
                  Live recipe scaling, alternate UOM selection, and mandatory inventory lot reservation will appear here.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* ── STEP 4: FULL-WIDTH SECTION: FACTORY STAGES PALETTE & TIMELINE SEQUENCE ── */}
        <div className="w-full">
          <StandardFactoryStagesPalette
            stages={timelineStages}
            onChangeStages={setTimelineStages}
            isEditable={true}
            stepNumber={4}
          />
        </div>

        {/* ── STEP 5: FULL-WIDTH SECTION: FINISHED PRODUCTS ── */}
        <div className="w-full space-y-4">
          <div className="bg-white dark:bg-slate-900 border border-[#E3E6EC] dark:border-slate-800 rounded-[12px] p-5 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-[#E3E6EC] dark:border-slate-800 gap-2 mb-4">
              <div className="flex items-center gap-2.5">
                <span className="w-7 h-7 rounded-full bg-[#4F46E5] text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
                  5
                </span>
                <div>
                  <h2 className="font-bold text-base text-slate-900 dark:text-white">
                    Finished products
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Products to produce to replenish warehouse inventory
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSearchModalMode('PRODUCT_SINGLE');
                    setSearchModalOpen(true);
                  }}
                  className="h-8 px-3 text-xs font-bold rounded-lg border-indigo-400 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 cursor-pointer shadow-3xs flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Search & Select Products</span>
                </Button>

                <span className="text-xs font-semibold text-slate-500">
                  {selectedProducts.length} Products Added
                </span>
              </div>
            </div>

            <ProductionProductPicker
              categories={categories}
              subcategories={subcategories}
              products={products}
              selectedCategoryId={selectedCategoryId}
              selectedSubcategoryId={selectedSubcategoryId}
              onSelectCategory={setSelectedCategoryId}
              onSelectSubcategory={setSelectedSubcategoryId}
              selectedProducts={selectedProducts}
              onSelectProduct={handleSelectProduct}
              onUpdateProducts={handleUpdateProducts}
              totalPlannedQty={totalPlannedQty}
              baseFilterId={selectedBaseId}
              selectedBaseName={selectedBaseName}
              showHeader={false}
              stepNumber={5}
            />
          </div>
        </div>

        {/* ── STEP 6: FULL-WIDTH SECTION: LABOUR & FLOOR STAFF ALLOCATION ── */}
        <div className="w-full">
          <ProductionLabourPicker
            labourCount={labourCount}
            assignedStaffIds={assignedStaffIds}
            labourStaffDetails={labourStaffDetails}
            onChange={({ labourCount: lc, assignedStaffIds: asIds, labourStaffDetails: lsd }) => {
              setLabourCount(lc);
              setAssignedStaffIds(asIds);
              setLabourStaffDetails(lsd);
            }}
            stepNumber={6}
            fullWidth={true}
          />
        </div>

        {/* ── COSTING SUMMARY FOOTER ── */}
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

        {/* ── PRODUCTION ITEM SEARCH MODAL (FUZZY, SPACE-IGNORING, MULTI-SELECT) ── */}
        {searchModalOpen && (
          <ProductionItemSearchModal
            isOpen={searchModalOpen}
            onClose={() => setSearchModalOpen(false)}
            mode={searchModalMode}
            onSelectProduct={handleSelectProductFromModal}
            onSelectRawMaterials={handleAddSelectedRMs}
          />
        )}

      </main>

    </div>
  );
}
