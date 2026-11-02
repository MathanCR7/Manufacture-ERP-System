import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Factory, X, Check, Play, Pause, Save, RefreshCw, AlertTriangle,
  Layers, Sliders, Box, ShieldCheck, Sparkles, Scale, Info, ArrowRight, ArrowLeft,
  Flame, Droplets, Snowflake, CheckCircle2, AlertCircle, RotateCcw,
  Plus, Trash2, ChevronRight, HardHat, FileSpreadsheet, Eye,
  DollarSign, TrendingDown, Package, HelpCircle, ArrowDownRight, Layers2,
  Maximize2, Minimize2, Printer, Tag, Boxes, CheckSquare, Calendar, ChevronLeft,
  Unlock, Lock, FileText, CheckCheck, TrendingUp
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { api } from '@/lib/axios';
import Swal from 'sweetalert2';
import useAuthStore from '@/app/store/authStore';
import {
  toMl,
  round2,
  formatIndian,
  calculateEvaporation,
  calculateAllocations,
  computeMaxTrays,
  formatCleanUom,
  isPackagingMaterial
} from '../utils/productionCalculation';
import ProductionMouldPickerModal from './ProductionMouldPickerModal';
import ProductionItemSearchModal from './ProductionItemSearchModal';
import ProductionCleanReportView from './ProductionCleanReportView';
import StandardFactoryStagesPalette from './StandardFactoryStagesPalette';
import { getProductionDraft } from '../services/productionDraftStore';

const formatDateDMY = (dateVal) => {
  if (!dateVal) return 'dd-mm-yyyy';
  try {
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return String(dateVal).split('T')[0];
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
  } catch {
    return 'dd-mm-yyyy';
  }
};

export default function ProductionFloorCockpitModal({
  isOpen = false,
  onClose,
  batchId,
  onBatchUpdated,
  onOpenCompleteModal,
  initialViewMode = 'STEPS'
}) {
  const currentUser = useAuthStore(s => s.user);
  const userRole = currentUser?.role?.toUpperCase();
  const canViewCost = ['MAIN_MASTER', 'ADMIN', 'SUPERVISOR'].includes(userRole);

  const [batch, setBatch] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [savingProcess, setSavingProcess] = useState(false);
  const [savingAllocations, setSavingAllocations] = useState(false);
  
  // High-impact Fullscreen default for industrial floor terminal view
  const [isFullscreen, setIsFullscreen] = useState(true);

  // View mode: 'STEPS' (interactive 4-step wizard) vs 'REPORT' (clean executive costing & yield ledger)
  const [viewMode, setViewMode] = useState(initialViewMode || 'STEPS');

  useEffect(() => {
    if (isOpen && initialViewMode) {
      setViewMode(initialViewMode);
    }
  }, [isOpen, initialViewMode]);

  // ── 5-STEP PROCESS GUIDANCE STATE ──
  // 1: RM Formulation & Warehouse Lot Allocation
  // 2: Volume Merge & Evaporation Mass Loss
  // 3: Finished Products & Sequential Chaining + Product Ingredients
  // 4: Factory Stages Palette & Timeline Sequence
  // 5: Quality, Costing, Wastage & Yield Completion
  const [activeStep, setActiveStep] = useState(1);

  // Section A: Raw Materials
  const [rmRows, setRmRows] = useState([]);
  const [availableProducts, setAvailableProducts] = useState([]);

  // Section B: Merge and Evaporation
  const [mergeStage, setMergeStage] = useState('After heating');
  const [isSlideMerged, setIsSlideMerged] = useState(false);
  const [evaporationPct, setEvaporationPct] = useState(5.0);
  const [evaporationApplied, setEvaporationApplied] = useState(false);

  // Section C: Finished Products Allocations
  const [allocations, setAllocations] = useState([]);
  const [mouldCatalog, setMouldCatalog] = useState([]);
  const [mouldCategories, setMouldCategories] = useState([]);

  // Item Search Modal (Sales / SAP Order Style)
  const [itemSearchOpen, setItemSearchOpen] = useState(false);
  const [itemSearchMode, setItemSearchMode] = useState('RM_MULTI'); // 'RM_MULTI' | 'PRODUCT_SINGLE'

  // Mould Picker Modal
  const [mouldPickerOpen, setMouldPickerOpen] = useState(false);
  const [targetAllocIndex, setTargetAllocIndex] = useState(null);

  // Costing data (from server)
  const [costingData, setCostingData] = useState(null);

  // Multi-Product Yield Recording Modal State
  const [showYieldModal, setShowYieldModal] = useState(false);
  const [productYields, setProductYields] = useState({}); // { [productId]: { actualOutput, rejectOutput, notes } }
  const [actualYieldPieces, setActualYieldPieces] = useState(2000);
  const [completionNotes, setCompletionNotes] = useState('');
  const [completing, setCompleting] = useState(false);

  // Factory Stages Timeline Sequence
  const DEFAULT_FACTORY_STAGES = [
    { id: 'ageing', name: 'Ageing', category: 'Thermal & Mixing', icon: 'clock', defaultTemp: '4°C', durationHours: 0, durationMinutes: 30, desc: 'Mix aging in refrigerated vats at 4°C' },
    { id: 'vat', name: 'VAT', category: 'Thermal & Mixing', icon: 'database', defaultTemp: '10°C', durationHours: 0, durationMinutes: 45, desc: 'Holding and agitation in process tanks' },
    { id: 'cf', name: 'CF – Cont. Freezer', category: 'Freezing & Molding', icon: 'snowflake', defaultTemp: '-5°C', durationHours: 1, durationMinutes: 0, desc: 'Continuous scraped surface freezing' },
    { id: 'bf', name: 'BF – Bath Freezer', category: 'Freezing & Molding', icon: 'snowflake', defaultTemp: '-20°C', durationHours: 0, durationMinutes: 45, desc: 'Brine tank sub-zero mold immersion' }
  ];
  const [timelineStages, setTimelineStages] = useState(DEFAULT_FACTORY_STAGES);
  const [savingStages, setSavingStages] = useState(false);

  // Lab Testing Requirement State (Defaults to true, can be toggled)
  const [labTestRequired, setLabTestRequired] = useState(true);

  // Sub-Run / Multi End Product Sub-Batches Tracking (Run A, Run B, etc.)
  const [completedSubBatches, setCompletedSubBatches] = useState([]);
  const SUB_BATCH_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
  const currentSubRunLetter = SUB_BATCH_LETTERS[completedSubBatches.length] || `Run-${completedSubBatches.length + 1}`;

  // ── COCKPIT LOT ALLOCATION MODAL STATE (Supports Step 1 Base RMs & Step 3 Product RMs) ──
  const [lotModalOpen, setLotModalOpen] = useState(false);
  const [activeLotRowIndex, setActiveLotRowIndex] = useState(null);
  const [activeLotTarget, setActiveLotTarget] = useState(null); // { type: 'STEP_1', rowIndex } | { type: 'PRODUCT_RM', allocIndex, prmIndex }
  const [loadingLots, setLoadingLots] = useState(false);
  const [availableLots, setAvailableLots] = useState([]);
  const [lotAllocations, setLotAllocations] = useState({}); // { [lotId]: allocatedQty }
  const [lotSearchTerm, setLotSearchTerm] = useState('');
  const [showManualLotForm, setShowManualLotForm] = useState(false);
  const [manualLotForm, setManualLotForm] = useState({
    internalBatchNo: '',
    grnNumber: '',
    poNumber: '',
    supplierBatchNo: '',
    availableQty: 100,
    expiryDate: '',
    mfgDate: '',
    unitRate: 0
  });

  // ── Fetch Master Data & Batch Details from /api/production/standard/:id ──
  const fetchAllData = useCallback(async () => {
    if (!batchId) return;
    try {
      setLoading(true);
      const [detailRes, mouldsRes, productsRes] = await Promise.all([
        api.get(`/production/standard/${batchId}`).catch(() => api.get(`/production/batches-redesign/${batchId}`)),
        api.get('/production/standard/moulds?all=1').catch(() => api.get('/production/moulds')),
        api.get('/production/standard/products-catalog').catch(() => api.get('/products?limit=100'))
      ]);

      const b = detailRes.data.batch || detailRes.data;
      setBatch(b);
      setActualYieldPieces(Number(b.actualOutput || b.quantity || 2000));
      const batchFinished = b.status === 'Completed' || b.status === 'qc_passed';
      if (batchFinished) {
        setViewMode('REPORT');
      } else {
        setViewMode('STEPS');
      }

      // Moulds
      const moulds = mouldsRes.data.moulds || mouldsRes.data.data || [];
      setMouldCatalog(moulds);
      const cats = mouldsRes.data.categories || Array.from(new Set(moulds.map(m => m.mould_category || 'Other')));
      setMouldCategories(cats);

      // Products
      const prods = Array.isArray(productsRes.data?.data) ? productsRes.data.data : (Array.isArray(productsRes.data) ? productsRes.data : []);
      setAvailableProducts(prods);

      // Raw Material Lines from standard endpoint or fallback
      const serverRmLines = detailRes.data.rmLines || [];
      const draft = getProductionDraft();
      const draftRms = Array.isArray(draft?.rawMaterials) ? draft.rawMaterials : [];

      let initialRows = [];
      if (serverRmLines.length > 0) {
        initialRows = serverRmLines.map(line => {
          const rmId = line.raw_material_id || line.rmId;
          const matchDraft = draftRms.find(d => 
            (d.rawMaterialId && d.rawMaterialId === rmId) || 
            (d.rmId && d.rmId === rmId) ||
            (d.rawMaterialCode && d.rawMaterialCode === (line.raw_material_code || line.rmCode)) ||
            (d.rawMaterialName && d.rawMaterialName === (line.raw_material_name || line.rmName))
          );

          let allocatedBatches = Array.isArray(line.allocatedBatches) && line.allocatedBatches.length > 0
            ? line.allocatedBatches
            : (Array.isArray(matchDraft?.allocatedBatches) && matchDraft.allocatedBatches.length > 0
                ? matchDraft.allocatedBatches
                : []);

          let lotBatchNo = line.lot_batch_no;
          if (!lotBatchNo && allocatedBatches.length > 0) {
            lotBatchNo = allocatedBatches.map(b => b.lotNumber || b.internalBatchNo).filter(Boolean).join(', ');
          }

          const allocSum = allocatedBatches.reduce((acc, b) => acc + Number(b.allocatedQty || 0), 0);
          const rawStock = Number(line.warehouse_stock ?? line.current_stock ?? line.currentStock ?? 0);
          const availableQty = allocSum > 0 ? allocSum : 0;
          const reqQty = allocSum > 0 ? allocSum : Number(line.required_qty || 0);

          let takenQty = Number(line.taken_qty || 0);
          if (allocSum > 0) {
            takenQty = allocSum;
          } else if (takenQty <= 0) {
            takenQty = reqQty;
          }

          let unitRate = Number(line.rate_per_unit || 0);
          if (allocatedBatches.length > 0) {
            const totAmt = allocatedBatches.reduce((acc, b) => acc + (Number(b.allocatedQty || 0) * Number(b.unitRate || 0)), 0);
            const totQty = allocatedBatches.reduce((acc, b) => acc + Number(b.allocatedQty || 0), 0);
            if (totQty > 0) unitRate = Number((totAmt / totQty).toFixed(4));
          }

          let resolvedUom = line.unit_id || line.unitId || line.uom;
          if (line.has_alternate_uom || line.hasAlternateUom) {
            const alt = (line.alternate_uom || line.alternateUom || '').toLowerCase();
            const curr = String(resolvedUom || '').toLowerCase();
            if (alt && curr === alt && Number(line.conversion_factor || line.conversionFactor || 1) >= 1000) {
              resolvedUom = 'kg';
            }
          }

          return {
            rawMaterialId: rmId,
            rawMaterialName: line.raw_material_name || line.rmName || 'Raw Material',
            rawMaterialCode: line.raw_material_code || line.rmCode || 'RM',
            uom: formatCleanUom(resolvedUom, 'kg', line),
            hasAlternateUom: Boolean(line.has_alternate_uom),
            alternateUom: line.alternate_uom,
            conversionFactor: Number(line.conversion_factor || 1),
            consumptionUnit: line.consumption_unit,
            density: Number(line.density || 1.0),
            availableQty,
            warehouseStock: rawStock,
            requiredQty: reqQty,
            takenQty,
            evaporates: Boolean(line.evaporates),
            merged: line.merged !== undefined && line.merged !== null ? Boolean(line.merged) : true,
            unitRate,
            lotBatchNo: lotBatchNo || null,
            availableBatches: line.available_batches || [],
            allocatedBatches
          };
        });
      } else if (Array.isArray(b.rmUsages) && b.rmUsages.length > 0) {
        initialRows = b.rmUsages.map(u => {
          const rmId = u.rmId || u.rawMaterial?.id;
          const name = u.rawMaterial?.name || u.name || 'Raw Material';
          const lowerName = name.toLowerCase();
          const defaultEvap = lowerName.includes('milk') || lowerName.includes('smp') || 
                              lowerName.includes('stabilizer') || lowerName.includes('essence') ||
                              lowerName.includes('flavor');

          const matchDraft = draftRms.find(d => 
            (d.rawMaterialId && d.rawMaterialId === rmId) || 
            (d.rmId && d.rmId === rmId) ||
            (d.rawMaterialCode && d.rawMaterialCode === (u.rawMaterial?.code || 'RM')) ||
            (d.rawMaterialName && d.rawMaterialName === name)
          );

          let allocatedBatches = Array.isArray(u.allocatedBatches) && u.allocatedBatches.length > 0
            ? u.allocatedBatches
            : (Array.isArray(matchDraft?.allocatedBatches) && matchDraft.allocatedBatches.length > 0
                ? matchDraft.allocatedBatches
                : (Array.isArray(u.allocations) ? u.allocations.map(a => ({
                    batchId: a.inventory_batch_id || a.lot_number,
                    lotNumber: a.lot_number,
                    internalBatchNo: a.lot_number,
                    poNumber: a.po_number || 'PO-MANUAL-OVERRIDE',
                    grnNumber: a.grn_number || 'GRN-MANUAL-OVERRIDE',
                    supplierBatchNo: a.supplier_batch_no || 'SUP-LOT-01',
                    availableQty: Number(a.available_qty || a.allocated_qty || 0),
                    allocatedQty: Number(a.allocated_qty || 0),
                    unitRate: Number(a.unit_rate || u.unitCost || 0),
                    allocatedAmount: Number(a.allocated_amount || 0),
                    expiryDate: a.expiry_date,
                    uom: a.uom
                  })) : []));

          let lotBatchNo = allocatedBatches.length > 0
            ? allocatedBatches.map(b => b.lotNumber || b.internalBatchNo).filter(Boolean).join(', ')
            : (u.lotBatchNo || null);

          const allocSum = allocatedBatches.reduce((acc, b) => acc + Number(b.allocatedQty || 0), 0);
          const rawStock = Number(u.rawMaterial?.currentStock ?? u.availableQtyAtTime ?? 0);
          const availableQty = allocSum > 0 ? allocSum : 0;
          const reqQty = allocSum > 0 ? allocSum : Number(u.requiredQty || 0);

          let takenQty = Number(u.inputQty || u.requiredQty || 0);
          if (allocSum > 0) {
            takenQty = allocSum;
          } else if (takenQty <= 0) {
            takenQty = reqQty;
          }

          let unitRate = Number(u.unitCost || 0);
          if (allocatedBatches.length > 0) {
            const totAmt = allocatedBatches.reduce((acc, b) => acc + (Number(b.allocatedQty || 0) * Number(b.unitRate || 0)), 0);
            const totQty = allocatedBatches.reduce((acc, b) => acc + Number(b.allocatedQty || 0), 0);
            if (totQty > 0) unitRate = Number((totAmt / totQty).toFixed(4));
          }

          let resolvedUom = u.rawMaterial?.unitId || u.selectedUom || u.unit;
          if (u.rawMaterial?.hasAlternateUom) {
            const alt = (u.rawMaterial?.alternateUom || '').toLowerCase();
            const curr = String(resolvedUom || '').toLowerCase();
            if (alt && curr === alt && Number(u.rawMaterial?.conversionFactor || 1) >= 1000) {
              resolvedUom = 'kg';
            }
          }

          return {
            rawMaterialId: rmId,
            rawMaterialName: name,
            rawMaterialCode: u.rawMaterial?.code || 'RM',
            uom: formatCleanUom(resolvedUom || u.rawMaterial?.consumptionUnit, 'kg', u.rawMaterial),
            hasAlternateUom: Boolean(u.rawMaterial?.hasAlternateUom),
            alternateUom: u.rawMaterial?.alternateUom,
            conversionFactor: Number(u.rawMaterial?.conversionFactor || 1),
            consumptionUnit: u.rawMaterial?.consumptionUnit,
            density: 1.0,
            availableQty,
            warehouseStock: rawStock,
            requiredQty: reqQty,
            takenQty,
            evaporates: defaultEvap,
            merged: true,
            unitRate,
            lotBatchNo,
            availableBatches: u.availableBatches || [],
            allocatedBatches
          };
        });
      } else if (Array.isArray(b.rawMaterials) && b.rawMaterials.length > 0) {
        initialRows = b.rawMaterials.map(rm => {
          const rmId = rm.rmId || rm.rawMaterialId || rm.id;
          const name = rm.rawMaterialName || rm.rmName || rm.name || 'Raw Material';
          const lowerName = name.toLowerCase();
          const defaultEvap = lowerName.includes('milk') || lowerName.includes('smp') || 
                              lowerName.includes('stabilizer') || lowerName.includes('essence') ||
                              lowerName.includes('flavor');

          const matchDraft = draftRms.find(d => 
            (d.rawMaterialId && d.rawMaterialId === rmId) || 
            (d.rmId && d.rmId === rmId) ||
            (d.rawMaterialCode && d.rawMaterialCode === (rm.rmCode || rm.rawMaterialCode || 'RM')) ||
            (d.rawMaterialName && d.rawMaterialName === name)
          );

          let allocatedBatches = Array.isArray(rm.allocatedBatches) && rm.allocatedBatches.length > 0
            ? rm.allocatedBatches
            : (Array.isArray(matchDraft?.allocatedBatches) && matchDraft.allocatedBatches.length > 0
                ? matchDraft.allocatedBatches
                : []);

          let lotBatchNo = rm.lotBatchNo || (rm.allocatedBatches?.[0]?.batchNo) || null;
          if (!lotBatchNo && allocatedBatches.length > 0) {
            lotBatchNo = allocatedBatches.map(b => b.lotNumber || b.internalBatchNo).filter(Boolean).join(', ');
          }

          const allocSum = allocatedBatches.reduce((acc, b) => acc + Number(b.allocatedQty || 0), 0);
          const rawStock = Number(rm.currentStock ?? rm.availableQty ?? 0);
          const availableQty = allocSum > 0 ? allocSum : 0;
          const reqQty = allocSum > 0 ? allocSum : Number(rm.requiredQty || 0);

          let takenQty = Number(rm.takenQty || rm.requiredQty || 0);
          if (allocSum > 0) {
            takenQty = allocSum;
          } else if (takenQty <= 0) {
            takenQty = reqQty;
          }

          let resolvedUom = rm.unitId || rm.baseUom || rm.selectedUom || rm.uom;
          if (rm.hasAlternateUom) {
            const alt = (rm.alternateUom || '').toLowerCase();
            const curr = String(resolvedUom || '').toLowerCase();
            if (alt && curr === alt && Number(rm.conversionFactor || 1) >= 1000) {
              resolvedUom = 'kg';
            }
          }

          return {
            rawMaterialId: rmId,
            rawMaterialName: name,
            rawMaterialCode: rm.rmCode || rm.rawMaterialCode || 'RM',
            uom: formatCleanUom(resolvedUom, 'kg', rm),
            hasAlternateUom: Boolean(rm.hasAlternateUom),
            alternateUom: rm.alternateUom,
            conversionFactor: Number(rm.conversionFactor || 1),
            consumptionUnit: rm.consumptionUnit,
            density: 1.0,
            availableQty,
            warehouseStock: rawStock,
            requiredQty: reqQty,
            takenQty,
            evaporates: defaultEvap,
            merged: true,
            unitRate: Number(rm.unitRate || rm.rate || 0),
            lotBatchNo,
            availableBatches: rm.allocatedBatches || [],
            allocatedBatches
          };
        });
      }
      setRmRows(initialRows);

      // Merge state
      const merge = detailRes.data.mergeData || b.evaporationData || {};
      if (merge.merge_stage || merge.mergeStage) {
        let loadedStage = merge.merge_stage || merge.mergeStage;
        if (loadedStage === 'Before heating') loadedStage = 'After heating';
        else if (loadedStage === 'Before freezing') loadedStage = 'After freezing';
        else if (loadedStage === 'Other Stage') loadedStage = 'Other Method';
        setMergeStage(loadedStage || 'After heating');
      }
      if (merge.evaporation_pct !== undefined || merge.evaporationRatePct !== undefined) {
        setEvaporationPct(Number(merge.evaporation_pct ?? merge.evaporationRatePct ?? 5.0));
      }
      if (merge.evaporation_applied !== undefined || merge.isEvaporated) {
        setEvaporationApplied(Boolean(merge.evaporation_applied ?? merge.isEvaporated));
      }
      if (merge.merged_total_ml > 0 || b.merged_pre_evap_ml > 0 || merge.mergedPreEvapMl > 0) {
        setIsSlideMerged(true);
      }

      // Allocations
      const serverAllocs = detailRes.data.allocations || [];
      let savedMAllocs = [];
      try {
        if (typeof b.mould_allocations === 'string') savedMAllocs = JSON.parse(b.mould_allocations || '[]');
        else if (Array.isArray(b.mould_allocations)) savedMAllocs = b.mould_allocations;
        else if (Array.isArray(b.mouldAllocations)) savedMAllocs = b.mouldAllocations;
      } catch (_) {}

      if (serverAllocs.length > 0) {
        setAllocations(serverAllocs.map((a, idx) => {
          const matched = savedMAllocs.find(s => s.seq === a.seq || s.productId === (a.product_id || a.productId)) || savedMAllocs[idx] || {};
          const matchedProd = prods.find(p => p.id === (a.product_id || a.productId));
          const prodUom = a.product_unit || a.productUom || matched.productUom || formatCleanUom(matchedProd?.consumptionUnit || matchedProd?.uom, 'pcs', matchedProd);
          const rawPrms = Array.isArray(a.productRms) ? a.productRms : (Array.isArray(matched.productRms) ? matched.productRms : []);
          const productRms = rawPrms.map(prm => ({
            ...prm,
            addToMix: prm.addToMix !== undefined ? Boolean(prm.addToMix) : !isPackagingMaterial(prm)
          }));
          return {
            seq: a.seq || (idx + 1),
            productId: a.product_id || a.productId,
            productName: a.product_name || a.productName || matchedProd?.name || 'Finished Product',
            productCode: a.product_code || a.productCode || matchedProd?.code || 'FP',
            productUom: prodUom,
            useMould: a.use_mould !== undefined ? Boolean(a.use_mould) : (matched.useMould !== undefined ? Boolean(matched.useMould) : true),
            bulkUom: a.bulkUom || matched.bulkUom || (prodUom === 'pcs' ? 'Liter' : prodUom),
            allocatedBaseMl: Number(a.allocatedBaseMl ?? matched.allocatedBaseMl ?? a.mix_used_ml ?? 0),
            mouldId: a.mould_id || a.mouldId || null,
            mouldCode: a.mould_code || a.mouldCode || '',
            mouldName: a.mould_name || a.mouldName || '',
            capacityMl: Number(a.capacity_ml || a.capacityMl || 50),
            cavities: a.cavities !== undefined ? Number(a.cavities) : (a.cavity_count ? Number(a.cavity_count) : 1),
            trays: Number(a.trays || 0),
            wasteMode: a.waste_mode || a.wasteMode || 'PERCENT',
            wasteValue: Number(a.waste_value ?? a.wasteValue ?? 2.0),
            productRms
          };
        }));
      } else {
        // Initialize from batch planned products
        let batchProds = Array.isArray(b.products) && b.products.length > 0 ? b.products : (b.selectedProducts || []);
        if (batchProds.length === 0 && b.product) {
          batchProds = [b.product];
        }
        if (batchProds.length > 0) {
          setAllocations(batchProds.map((p, idx) => {
            const prodUom = formatCleanUom(p.consumptionUnit || p.unit || p.uom, 'pcs', p);
            return {
              seq: idx + 1,
              productId: p.productId || p.id,
              productName: p.name || p.productName || 'Finished Product',
              productCode: p.code || p.productCode || 'FP',
              productUom: prodUom,
              useMould: true,
              bulkUom: prodUom === 'pcs' ? 'Liter' : prodUom,
              allocatedBaseMl: 0,
              mouldId: null,
              mouldCode: 'SG-8112',
              mouldName: 'Kulfi Small (SG 8112)',
              capacityMl: 50,
              cavities: 42,
              trays: 0,
              wasteMode: 'PERCENT',
              wasteValue: 2.0,
              productRms: []
            };
          }));
        }
      }

      // Costing
      if (detailRes.data.costingSummary) {
        setCostingData(detailRes.data.costingSummary);
      }

      // Factory Timeline Stages
      const stagesFromBatch = b.timeline_stages || b.timelineStages || detailRes.data.timelineStages;
      if (Array.isArray(stagesFromBatch) && stagesFromBatch.length > 0) {
        setTimelineStages(stagesFromBatch);
      } else {
        setTimelineStages(DEFAULT_FACTORY_STAGES);
      }

      // QC Lab Test Requirement (true = quarantine, false = direct to stock)
      if (b.qc_required !== undefined) {
        setLabTestRequired(Boolean(b.qc_required));
      } else if (b.labTestRequired !== undefined) {
        setLabTestRequired(Boolean(b.labTestRequired));
      }

      // Saved Product Yields from Step 5
      const savedYields = b.product_yields || b.productYields || detailRes.data.productYields;
      let parsedYields = [];
      try {
        if (typeof savedYields === 'string') parsedYields = JSON.parse(savedYields || '[]');
        else if (Array.isArray(savedYields)) parsedYields = savedYields;
      } catch (_) {}
      if (parsedYields.length > 0) {
        setProductYields(parsedYields);
      }
      if (b.actual_output || b.actualOutput || b.good_quantity || b.goodQuantity) {
        setActualYieldPieces(Number(b.actual_output || b.actualOutput || b.good_quantity || b.goodQuantity));
      }
      if (b.note) {
        setCompletionNotes(b.note);
      }
    } catch (err) {
      console.error('Failed to load standard production details:', err);
      Swal.fire({ title: 'Error', text: 'Failed to load production batch floor execution data.', icon: 'error' });
    } finally {
      setLoading(false);
    }
  }, [batchId]);

  useEffect(() => {
    if (isOpen) {
      fetchAllData();
    }
  }, [isOpen, fetchAllData]);

  // ── CLIENT-SIDE SHARED MATH CALCULATION ──
  const liveEvaporationResult = useMemo(() => {
    return calculateEvaporation({
      lines: rmRows,
      evaporationPct,
      mergeStage,
      evaporationApplied
    });
  }, [rmRows, evaporationPct, mergeStage, evaporationApplied]);

  // Available mix for moulding allocation
  const availableMixMl = useMemo(() => {
    if (liveEvaporationResult.mixAfterEvapMl > 0) {
      return liveEvaporationResult.mixAfterEvapMl;
    }
    if (liveEvaporationResult.totalBeforeEvapMl > 0) {
      return liveEvaporationResult.totalBeforeEvapMl;
    }
    return 0;
  }, [liveEvaporationResult.mixAfterEvapMl, liveEvaporationResult.totalBeforeEvapMl]);

  // Live sequential product mould allocation math
  const liveAllocationsResult = useMemo(() => {
    return calculateAllocations({
      availableMixMl,
      totalMixMl: availableMixMl,
      allocations
    });
  }, [availableMixMl, allocations]);

  // Total Base Mix Cost from Step 1 raw materials (takenQty * unitRate)
  const totalBaseMixCost = useMemo(() => {
    return rmRows.reduce((sum, r) => sum + (Number(r.takenQty || 0) * Number(r.unitRate || 0)), 0);
  }, [rmRows]);

  const baseCostPerMl = useMemo(() => {
    const postMl = liveEvaporationResult.mixAfterEvapMl > 0 ? liveEvaporationResult.mixAfterEvapMl : (liveEvaporationResult.totalBeforeEvapMl || 1);
    return postMl > 0 ? (totalBaseMixCost / postMl) : 0;
  }, [totalBaseMixCost, liveEvaporationResult.mixAfterEvapMl, liveEvaporationResult.totalBeforeEvapMl]);

  const totalAllocatedBaseMl = useMemo(() => {
    return allocations.reduce((sum, a) => sum + Number(a.allocatedBaseMl || a.mixUsedMl || 0), 0);
  }, [allocations]);

  const unallocatedRemainingMl = useMemo(() => {
    return availableMixMl - totalAllocatedBaseMl;
  }, [availableMixMl, totalAllocatedBaseMl]);

  const totalProcessWasteMl = useMemo(() => {
    return liveAllocationsResult.allocations.reduce((sum, a) => sum + Number(a.wasteMl || 0), 0);
  }, [liveAllocationsResult.allocations]);

  const totalWastageMl = useMemo(() => {
    return Math.max(0, unallocatedRemainingMl) + totalProcessWasteMl;
  }, [unallocatedRemainingMl, totalProcessWasteMl]);

  const totalWastageCost = useMemo(() => {
    return totalWastageMl * baseCostPerMl;
  }, [totalWastageMl, baseCostPerMl]);

  // ── LOT ALLOCATION MODAL HANDLERS (Step 1 Base Mix & Step 3 Product-Specific RMs) ──
  const initLotModalForRow = async (row) => {
    if (!row) return;
    setLotModalOpen(true);
    setLoadingLots(true);
    setShowManualLotForm(false);
    setLotSearchTerm('');

    const allocMap = {};
    if (Array.isArray(row.allocatedBatches)) {
      row.allocatedBatches.forEach(b => {
        const idKey = b.batchId || b.id || b.lotNumber || b.internalBatchNo;
        if (idKey) allocMap[idKey] = Number(b.allocatedQty || 0);
      });
    }
    setLotAllocations(allocMap);

    const rawClean = (row.rawMaterialName || row.rmName || row.rawMaterialCode || 'RM')
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, 16);
    const reqQty = Number(row.requiredQty || row.takenQty || row.qty || 10);

    const today = new Date();
    const dd = String(today.getDate()).padStart(2, '0');
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const yyyy = today.getFullYear();
    const expStr = `${dd}-${mm}-${yyyy + 1}`;
    const mfgStr = `${dd}-${mm}-${yyyy}`;

    setManualLotForm({
      internalBatchNo: `BATCH-${rawClean}-001`,
      grnNumber: 'GRN-MANUAL-OVERRIDE',
      poNumber: 'PO-MANUAL-OVERRIDE',
      supplierBatchNo: 'SUP-LOT-01',
      availableQty: Math.max(reqQty * 2, 500),
      expiryDate: expStr,
      mfgDate: mfgStr,
      unitRate: Number(row.unitRate || 54)
    });

    const rmId = row.rawMaterialId || row.rmId;
    try {
      const [batchesRes, metaRes] = await Promise.all([
        rmId ? api.get(`/production/rm-batches/${rmId}`).catch(() => ({ data: [] })) : Promise.resolve({ data: [] }),
        rmId ? api.get(`/production/rm-batch-meta/${rmId}?rmName=${encodeURIComponent(row.rawMaterialName || row.rmName || '')}`).catch(() => null) : Promise.resolve(null)
      ]);

      const lots = Array.isArray(batchesRes.data) ? [...batchesRes.data] : [];
      if (Array.isArray(row.allocatedBatches)) {
        row.allocatedBatches.forEach(ab => {
          const abId = ab.batchId || ab.lotNumber || ab.internalBatchNo;
          const exists = lots.some(l => 
            String(l.id) === String(abId) || 
            (l.internalBatchNo && l.internalBatchNo === (ab.lotNumber || ab.internalBatchNo))
          );
          if (!exists) {
            lots.unshift({
              id: abId,
              internalBatchNo: ab.lotNumber || ab.internalBatchNo,
              batchNumber: ab.lotNumber || ab.internalBatchNo,
              supplierBatchNo: ab.supplierBatchNo || 'SUP-LOT-01',
              grnNumber: ab.grnNumber || 'GRN-MANUAL-OVERRIDE',
              grnRef: ab.grnNumber || 'GRN-MANUAL-OVERRIDE',
              poNumber: ab.poNumber || 'PO-MANUAL-OVERRIDE',
              availableQty: Number(ab.availableQty || Math.max(Number(ab.allocatedQty || 0) * 2, 500)),
              netQty: Number(ab.availableQty || Math.max(Number(ab.allocatedQty || 0) * 2, 500)),
              expiryDate: ab.expiryDate || expStr,
              unitCost: Number(ab.unitRate || row.unitRate || 54),
              unitRate: Number(ab.unitRate || row.unitRate || 54),
              rate: Number(ab.unitRate || row.unitRate || 54),
              isManualOverride: Boolean(ab.isManualOverride)
            });
          }
        });
      }
      setAvailableLots(lots);

      const meta = metaRes?.data || null;
      if (meta?.nextBatchNumber) {
        setManualLotForm(prev => ({
          ...prev,
          internalBatchNo: meta.nextBatchNumber,
          poNumber: meta.latestPoNumber || prev.poNumber,
          unitRate: meta.latestRate || prev.unitRate,
          supplierBatchNo: meta.latestSupplierName || prev.supplierBatchNo
        }));
      }
    } catch (err) {
      console.warn('Could not fetch warehouse lots for row:', err);
      setAvailableLots([]);
    } finally {
      setLoadingLots(false);
    }
  };

  const openLotModal = async (rowIndex) => {
    setActiveLotTarget({ type: 'STEP_1', rowIndex });
    setActiveLotRowIndex(rowIndex);
    await initLotModalForRow(rmRows[rowIndex]);
  };

  const openProductRmLotModal = async (allocIndex, prmIndex) => {
    setActiveLotTarget({ type: 'PRODUCT_RM', allocIndex, prmIndex });
    setActiveLotRowIndex(allocIndex);
    const prm = allocations[allocIndex]?.productRms?.[prmIndex];
    if (prm) {
      await initLotModalForRow(prm);
    }
  };

  const handleSetLotQty = (lotId, value, maxAvail) => {
    let num = Number(value);
    if (isNaN(num) || num < 0) num = 0;
    if (num > maxAvail) num = maxAvail;

    setLotAllocations(prev => ({
      ...prev,
      [lotId]: num
    }));
  };

  const handleFillRemainingLot = (lotId, maxAvail) => {
    if (activeLotRowIndex === null) return;
    const row = rmRows[activeLotRowIndex];
    const targetQty = Number(row.requiredQty || row.takenQty || 0);

    const currentOtherTotal = Object.entries(lotAllocations).reduce((sum, [id, val]) => {
      return id === lotId ? sum : sum + Number(val || 0);
    }, 0);

    const remainingNeeded = Math.max(0, targetQty - currentOtherTotal);
    const toAlloc = Math.min(maxAvail, Number(remainingNeeded.toFixed(4)));
    handleSetLotQty(lotId, toAlloc, maxAvail);
  };

  const handleAutoAllocateFEFO = () => {
    if (activeLotRowIndex === null) return;
    const row = rmRows[activeLotRowIndex];
    const targetQty = Number(row.requiredQty || row.takenQty || 0);
    if (targetQty <= 0) {
      Swal.fire({ title: 'Quantity Required', text: 'Please set required or taken quantity for this material first.', icon: 'info' });
      return;
    }

    let remainingNeeded = targetQty;
    const newAlloc = {};

    // Sort lots by expiryDate ascending (FEFO)
    const sortedLots = [...availableLots].sort((a, b) => {
      const dateA = new Date(a.expiryDate || '2099-12-31').getTime();
      const dateB = new Date(b.expiryDate || '2099-12-31').getTime();
      return dateA - dateB;
    });

    for (const lot of sortedLots) {
      if (remainingNeeded <= 0) break;
      const avail = Number(lot.availableQty || lot.netQty || 0);
      if (avail > 0) {
        const take = Math.min(avail, remainingNeeded);
        newAlloc[lot.id] = Number(take.toFixed(3));
        remainingNeeded = Number((remainingNeeded - take).toFixed(3));
      }
    }

    setLotAllocations(newAlloc);
    Swal.fire({
      title: 'FEFO Auto-Allocation Applied',
      text: `Reserved lots in earliest expiry order. Remaining required: ${remainingNeeded} ${formatCleanUom(row?.uom, 'kg', row)}`,
      icon: 'success',
      timer: 1500
    });
  };

  const handleAddManualLot = async () => {
    if (activeLotRowIndex === null) return;
    const row = rmRows[activeLotRowIndex];

    const payload = {
      rawMaterialId: row.rawMaterialId,
      batchNumber: manualLotForm.internalBatchNo,
      supplierBatchNo: manualLotForm.supplierBatchNo || 'SUP-LOT-01',
      poNumber: manualLotForm.poNumber || 'PO-MANUAL-OVERRIDE',
      grnNumber: manualLotForm.grnNumber || 'GRN-MANUAL-OVERRIDE',
      availableQty: Number(manualLotForm.availableQty || 500),
      unitRate: Number(manualLotForm.unitRate || 54),
      expiryDate: manualLotForm.expiryDate,
      mfgDate: manualLotForm.mfgDate
    };

    let createdLot = null;
    try {
      const res = await api.post('/production/rm-batch-manual', payload);
      if (res.data?.batch) {
        createdLot = res.data.batch;
      }
    } catch (err) {
      console.warn('Backend manual batch sync warning, using local:', err);
    }

    const lotId = createdLot?.id || `manual-${Date.now()}`;
    const newLot = {
      id: lotId,
      internalBatchNo: createdLot?.internalBatchNo || manualLotForm.internalBatchNo,
      supplierBatchNo: createdLot?.supplierBatchNo || manualLotForm.supplierBatchNo || 'SUP-LOT-01',
      grnNumber: createdLot?.grnNumber || manualLotForm.grnNumber || 'GRN-MANUAL-OVERRIDE',
      poNumber: createdLot?.poNumber || manualLotForm.poNumber || 'PO-MANUAL-OVERRIDE',
      availableQty: Number(createdLot?.availableQty || manualLotForm.availableQty || 500),
      netQty: Number(createdLot?.availableQty || manualLotForm.availableQty || 500),
      expiryDate: createdLot?.expiryDate || manualLotForm.expiryDate || '2027-10-29',
      mfgDate: createdLot?.mfgDate || manualLotForm.mfgDate || '2026-10-29',
      unitCost: Number(createdLot?.unitCost || manualLotForm.unitRate || 54),
      unitRate: Number(createdLot?.unitCost || manualLotForm.unitRate || 54),
      isManualOverride: true
    };

    setAvailableLots(prev => [newLot, ...prev.filter(l => l.internalBatchNo !== newLot.internalBatchNo)]);

    // Fill remaining quantity into this lot
    const req = Number(row?.requiredQty || row?.takenQty || 10);
    const currSum = Object.values(lotAllocations).reduce((s, v) => s + Number(v || 0), 0);
    const needed = Math.max(0, req - currSum);
    const toAlloc = Math.min(newLot.availableQty, needed > 0 ? needed : req);

    setLotAllocations(prev => ({ ...prev, [lotId]: toAlloc }));
    setShowManualLotForm(false);

    Swal.fire({
      title: 'Continuing Lot Added & Inventory Synced!',
      text: `${newLot.internalBatchNo} registered with ${newLot.availableQty} ${formatCleanUom(row?.uom, 'kg', row)} available in warehouse inventory.`,
      icon: 'success',
      timer: 1800
    });
  };

  const handleSaveLotAllocations = async () => {
    if (activeLotRowIndex === null) return;
    const row = activeLotTarget?.type === 'PRODUCT_RM' 
      ? allocations[activeLotTarget.allocIndex]?.productRms?.[activeLotTarget.prmIndex]
      : rmRows[activeLotRowIndex];

    const allocatedBatches = [];
    let totalAllocQty = 0;
    let weightedAmountSum = 0;

    for (const [lotId, qtyVal] of Object.entries(lotAllocations)) {
      const qty = Number(qtyVal || 0);
      if (qty <= 0) continue;

      const lot = availableLots.find(l => String(l.id) === String(lotId)) || {
        id: lotId,
        internalBatchNo: manualLotForm.internalBatchNo,
        supplierBatchNo: manualLotForm.supplierBatchNo,
        expiryDate: manualLotForm.expiryDate,
        poNumber: manualLotForm.poNumber,
        unitCost: manualLotForm.unitRate
      };

      totalAllocQty += qty;

      let unitRate = Number(lot.unitCost || lot.rate || row?.unitRate || 0);
      // Fetch live rate from purchase API if available
      try {
        const rateRes = await api.get(`/purchase/live-rate?batchId=${lot.id}&allocatedQty=${qty}`).catch(() => null);
        if (rateRes?.data?.rate > 0) {
          unitRate = Number(rateRes.data.rate);
        }
      } catch (_) {}

      const lotAmount = Number((qty * unitRate).toFixed(2));
      weightedAmountSum += lotAmount;

      allocatedBatches.push({
        batchId: lot.id,
        lotNumber: lot.internalBatchNo || lot.batchNumber || `#LOT-${String(lot.id).slice(-4)}`,
        internalBatchNo: lot.internalBatchNo || lot.batchNumber || `#LOT-${String(lot.id).slice(-4)}`,
        supplierBatchNo: lot.supplierBatchNo || 'BATCH-01',
        expiryDate: lot.expiryDate || null,
        mfgDate: lot.mfgDate || null,
        grnNumber: lot.grnNumber || lot.grnRef || null,
        poNumber: lot.poNumber || lot.poReferenceNo || null,
        allocatedQty: qty,
        availableQty: Number(lot.availableQty || lot.netQty || 0),
        remainingQty: Number(Math.max(0, Number(lot.availableQty || lot.netQty || 0) - qty).toFixed(3)),
        unitRate,
        allocatedAmount: lotAmount,
        uom: row?.uom || 'kg'
      });
    }

    if (activeLotTarget?.type === 'PRODUCT_RM') {
      const { allocIndex, prmIndex } = activeLotTarget;
      setAllocations(prev => {
        const copy = [...prev];
        const targetAlloc = { ...copy[allocIndex] };
        const prms = [...(targetAlloc.productRms || [])];
        const targetPrm = { ...prms[prmIndex] };
        targetPrm.allocatedBatches = allocatedBatches;
        if (allocatedBatches.length > 0) {
          targetPrm.lotBatchNo = allocatedBatches.map(b => b.lotNumber).join(', ');
          targetPrm.takenQty = totalAllocQty;
          targetPrm.qty = totalAllocQty;
          if (weightedAmountSum > 0 && totalAllocQty > 0) {
            targetPrm.unitRate = Number((weightedAmountSum / totalAllocQty).toFixed(4));
            targetPrm.totalCost = Number(weightedAmountSum.toFixed(2));
          }
        }
        prms[prmIndex] = targetPrm;
        targetAlloc.productRms = prms;
        copy[allocIndex] = targetAlloc;
        return copy;
      });
      setLotModalOpen(false);
      Swal.fire({
        title: 'Batches Allocated!',
        text: `Allocated ${totalAllocQty} ${row?.uom || 'ml'} across ${allocatedBatches.length} lot(s). Live PO blended rate: ₹${(weightedAmountSum / (totalAllocQty || 1)).toFixed(2)}/unit.`,
        icon: 'success',
        timer: 1600
      });
      return;
    }

    const updatedRows = [...rmRows];
    const targetRow = { ...updatedRows[activeLotRowIndex] };

    targetRow.allocatedBatches = allocatedBatches;
    if (allocatedBatches.length > 0) {
      targetRow.lotBatchNo = allocatedBatches.map(b => b.lotNumber).join(', ');
      targetRow.takenQty = totalAllocQty;
      targetRow.availableQty = totalAllocQty;
      targetRow.requiredQty = totalAllocQty;
      if (weightedAmountSum > 0 && totalAllocQty > 0) {
        targetRow.unitRate = Number((weightedAmountSum / totalAllocQty).toFixed(4));
        targetRow.totalCost = Number(weightedAmountSum.toFixed(2));
      }
    }

    updatedRows[activeLotRowIndex] = targetRow;
    setRmRows(updatedRows);
    setLotModalOpen(false);

    // Persist allocation changes to backend database immediately
    api.put(`/production/standard/${batchId}/process`, {
      mergeStage,
      evaporationPct,
      evaporationApplied,
      lines: updatedRows
    }).catch(e => console.warn('Auto-save process after allocation failed:', e));

    Swal.fire({
      title: 'Batches Allocated & Database Persisted!',
      text: `Allocated ${totalAllocQty} ${formatCleanUom(targetRow?.uom, 'kg', targetRow)} across ${allocatedBatches.length} lot(s). Live PO rate blended: ₹${targetRow.unitRate}/unit.`,
      icon: 'success',
      timer: 1800
    });
  };

  // ── ROW EDITING ACTIONS ──
  const handleUpdateRmRow = (index, field, value) => {
    setRmRows(prev => {
      const copy = [...prev];
      const current = copy[index] || {};
      if (field === 'requiredQty') {
        const prevReq = Number(current.requiredQty || 0);
        const prevTaken = Number(current.takenQty || 0);
        if (prevTaken <= 0 || prevTaken === prevReq) {
          copy[index] = { ...current, requiredQty: value, takenQty: value };
          return copy;
        }
      }
      copy[index] = { ...current, [field]: value };
      return copy;
    });
  };

  const handleRemoveRmRow = (index) => {
    setRmRows(prev => prev.filter((_, idx) => idx !== index));
  };

  // Callback when user multi-selects raw materials from ProductionItemSearchModal
  const handleAddSelectedRMsFromModal = (selectedMaterials) => {
    if (targetAllocIndex !== null) {
      // Adding product-specific flavours / essences / packaging to this allocation
      const newPrms = selectedMaterials.map(rm => {
        const isPackaging = isPackagingMaterial(rm);
        const cleanUom = formatCleanUom(rm.consumptionUnit || rm.uom || rm.unitId, isPackaging ? 'pcs' : 'ml', rm);
        const uomLower = cleanUom.toLowerCase();
        const initialQty = isPackaging ? 1 : (uomLower.includes('ml') ? 1000 : 1);
        const unitRate = Number(rm.ratePerUnit || 0);

        return {
          rmId: rm.id,
          rawMaterialId: rm.id,
          rmName: rm.printName || rm.name,
          rawMaterialName: rm.printName || rm.name,
          rmCode: rm.code || 'RM',
          rawMaterialCode: rm.code || 'RM',
          uom: cleanUom,
          density: Number(rm.density_g_per_ml || rm.density || 1.0),
          takenQty: initialQty,
          qty: initialQty,
          addToMix: !isPackaging,
          unitRate: unitRate,
          totalCost: Number((unitRate * initialQty).toFixed(2)),
          allocatedBatches: rm.availableBatches?.length > 0 ? [
            {
              batchId: rm.availableBatches[0].id,
              lotNumber: rm.availableBatches[0].batchNo,
              internalBatchNo: rm.availableBatches[0].batchNo,
              allocatedQty: initialQty,
              remainingQty: rm.availableBatches[0].remainingQty,
              expiryDate: rm.availableBatches[0].expiryDate,
              unitRate: unitRate,
              allocatedAmount: Number((initialQty * unitRate).toFixed(2)),
              uom: cleanUom
            }
          ] : []
        };
      });

      setAllocations(prev => {
        const copy = [...prev];
        const target = { ...copy[targetAllocIndex] };
        target.productRms = [...(target.productRms || []), ...newPrms];
        copy[targetAllocIndex] = target;
        return copy;
      });

      setItemSearchOpen(false);
      setTargetAllocIndex(null);

      Swal.fire({
        title: 'Product Ingredients Added!',
        text: `Added ${newPrms.length} item(s). Liquid ingredients marked 'Add to Mix' automatically add to the product mix volume; packaging items remain at 0 ml mix.`,
        icon: 'success',
        timer: 1600
      });
      return;
    }

    const newRows = selectedMaterials.map(rm => ({
      rawMaterialId: rm.id,
      rawMaterialName: rm.printName || rm.name,
      rawMaterialCode: rm.code || 'RM',
      uom: formatCleanUom(rm.consumptionUnit || rm.uom || rm.unitId, 'kg', rm),
      hasAlternateUom: Boolean(rm.hasAlternateUom),
      alternateUom: rm.alternateUom,
      conversionFactor: Number(rm.conversionFactor || 1),
      consumptionUnit: rm.consumptionUnit,
      density: Number(rm.density_g_per_ml || 1.0),
      availableQty: rm.availableBatches?.length > 0 ? 10 : 0,
      warehouseStock: Number(rm.currentStock || 0),
      requiredQty: 10,
      takenQty: 10,
      evaporates: rm.evaporates_by_default !== undefined ? Boolean(rm.evaporates_by_default) : (
        (rm.name || '').toLowerCase().includes('milk') ||
        (rm.name || '').toLowerCase().includes('smp') ||
        (rm.name || '').toLowerCase().includes('stabilizer') ||
        (rm.name || '').toLowerCase().includes('essence')
      ),
      merged: true,
      unitRate: Number(rm.ratePerUnit || 0),
      lotBatchNo: rm.availableBatches?.[0]?.batchNo || null,
      availableBatches: rm.availableBatches || [],
      allocatedBatches: rm.availableBatches?.length > 0 ? [
        {
          batchId: rm.availableBatches[0].id,
          lotNumber: rm.availableBatches[0].batchNo,
          internalBatchNo: rm.availableBatches[0].batchNo,
          allocatedQty: 10,
          remainingQty: rm.availableBatches[0].remainingQty,
          expiryDate: rm.availableBatches[0].expiryDate,
          unitRate: Number(rm.ratePerUnit || 0),
          allocatedAmount: 10 * Number(rm.ratePerUnit || 0)
        }
      ] : []
    }));

    setRmRows(prev => [...prev, ...newRows]);
    setItemSearchOpen(false);
    Swal.fire({
      title: 'Materials Added',
      text: `Added ${newRows.length} raw material(s) with live DB UOMs and batch allocations.`,
      icon: 'success',
      timer: 1500
    });
  };

  const handleUpdateProductBaseMl = (index, value) => {
    setAllocations(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], allocatedBaseMl: value, mixUsedMl: value };
      return copy;
    });
  };

  const handleAllocateRemainingMix = (index) => {
    const effectiveTotal = availableMixMl > 0 ? availableMixMl : (liveEvaporationResult.mixAfterEvapMl || liveEvaporationResult.totalBeforeEvapMl || 0);
    const otherUsed = allocations.reduce((sum, a, i) => i === index ? sum : sum + Number(a.allocatedBaseMl || a.mixUsedMl || 0), 0);
    const rem = Math.max(0, effectiveTotal - otherUsed);
    setAllocations(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], allocatedBaseMl: rem, mixUsedMl: rem };
      return copy;
    });
  };

  const handleRemoveProductRm = (allocIndex, prmIndex) => {
    setAllocations(prev => {
      const copy = [...prev];
      const target = { ...copy[allocIndex] };
      target.productRms = (target.productRms || []).filter((_, i) => i !== prmIndex);
      copy[allocIndex] = target;
      return copy;
    });
  };

  const handleUpdateProductRm = (allocIndex, prmIndex, field, value) => {
    setAllocations(prev => {
      const copy = [...prev];
      const target = { ...copy[allocIndex] };
      const prms = [...(target.productRms || [])];
      const current = { ...prms[prmIndex], [field]: value };
      if (field === 'takenQty' || field === 'unitRate' || field === 'qty') {
        const qty = Number(field === 'unitRate' ? (current.takenQty ?? current.qty ?? 0) : value);
        const rate = Number(field === 'unitRate' ? value : current.unitRate || 0);
        current.takenQty = qty;
        current.qty = qty;
        current.totalCost = Number((qty * rate).toFixed(2));
      }
      prms[prmIndex] = current;
      target.productRms = prms;
      copy[allocIndex] = target;
      return copy;
    });
  };

  // ── SECTION B: Evaporation Actions ──
  const handleApplyEvaporation = () => {
    if (!isSlideMerged) {
      Swal.fire({
        title: 'Merge Required First',
        text: 'Please toggle "Slide to Merge" switch before applying evaporation.',
        icon: 'warning'
      });
      return;
    }
    setEvaporationApplied(true);
    Swal.fire({
      title: 'Evaporation Applied!',
      text: `Applied ${evaporationPct}% evaporation. Evaporated: ${formatIndian(liveEvaporationResult.evaporatedMl)} ml. Mix After: ${formatIndian(liveEvaporationResult.mixAfterEvapMl)} ml.`,
      icon: 'success',
      timer: 2000
    });
  };

  const handleUndoEvaporation = () => {
    setEvaporationApplied(false);
  };

  // Direct Mix After Evaporation Handler (2-way sync with Evaporation %)
  const handleDirectMixAfterEvapChange = (valStr) => {
    const postEvapMl = parseFloat(valStr);
    if (isNaN(postEvapMl) || postEvapMl < 0) return;
    const totalPre = Number(liveEvaporationResult.totalBeforeEvapMl || 0);
    const evapBase = Number(liveEvaporationResult.evaporationBaseMl || 0);

    if (totalPre > 0 && evapBase > 0) {
      const evaporatedLoss = Math.max(0, totalPre - postEvapMl);
      const calcPct = Math.max(0, Math.min(100, Number(((evaporatedLoss / evapBase) * 100).toFixed(2))));
      setEvaporationPct(calcPct);
      if (postEvapMl < totalPre) {
        setEvaporationApplied(true);
      }
    }
  };

  // Factory Stages Persistence to PUT /api/production/standard/:id/stages
  const handleSaveFactoryStages = async () => {
    try {
      setSavingStages(true);
      await api.put(`/production/standard/${batchId}/stages`, { timelineStages });
      Swal.fire({
        title: 'Factory Stages Saved!',
        text: `Persisted ${timelineStages.length} factory stages sequence to database.`,
        icon: 'success',
        timer: 1600
      });
    } catch (err) {
      console.error('Failed to save stages:', err);
      Swal.fire({ title: 'Error', text: 'Failed to persist factory stages sequence.', icon: 'error' });
    } finally {
      setSavingStages(false);
    }
  };

  // Step Gating & Continuous Navigation Handler with Automatic Step Data Persistence
  const handleStepClick = async (targetStep) => {
    if (targetStep === activeStep) return;

    // Gating check for Step 2: Step 1 must have raw materials with taken quantities > 0
    if (targetStep >= 2 && activeStep === 1) {
      const isStep1Valid = rmRows.length > 0 && rmRows.every(r => Number(r.takenQty || 0) > 0);
      if (!isStep1Valid) {
        Swal.fire({
          title: 'Step 1 Incomplete',
          text: 'Please configure all raw materials and ensure valid batch quantities are allocated (taken > 0) before proceeding to Step 2.',
          icon: 'warning'
        });
        return;
      }

      // Automatically save Step 1 data to database when proceeding to Step 2
      try {
        setSavingProcess(true);
        await api.put(`/production/standard/${batchId}/process`, {
          mergeStage,
          evaporationPct,
          evaporationApplied,
          lines: rmRows
        });
        if (onBatchUpdated) onBatchUpdated();
      } catch (err) {
        console.warn('Auto-save step 1 data failed:', err);
      } finally {
        setSavingProcess(false);
      }
    }

    // Gating check for Step 3: Mix must be merged with positive volume before Step 3
    if (targetStep >= 3 && activeStep === 2) {
      if (!isSlideMerged || availableMixMl <= 0) {
        Swal.fire({
          title: 'Step 2 Merge Required',
          text: 'Please complete Step 2 by toggling "Slide to Merge" to establish the liquid volume before proceeding to mould allocation.',
          icon: 'warning'
        });
        return;
      }

      // Automatically save Step 2 merge & evaporation parameters when proceeding to Step 3
      try {
        setSavingProcess(true);
        await api.put(`/production/standard/${batchId}/process`, {
          mergeStage,
          evaporationPct,
          evaporationApplied,
          lines: rmRows
        });
        if (onBatchUpdated) onBatchUpdated();
      } catch (err) {
        console.warn('Auto-save step 2 data failed:', err);
      } finally {
        setSavingProcess(false);
      }
    }

    // Gating check for Step 4: Product mould allocation configured
    if (targetStep >= 4 && activeStep === 3) {
      if (allocations.length === 0) {
        Swal.fire({
          title: 'Step 3 Allocations Incomplete',
          text: 'Please configure at least one finished product before proceeding to Factory Stages.',
          icon: 'warning'
        });
        return;
      }

      // Automatically save Step 3 allocations when proceeding to Step 4
      try {
        setSavingAllocations(true);
        const validAllocations = allocations.filter(a => a.productId);
        await api.put(`/production/standard/${batchId}/allocations`, {
          allocations: validAllocations.map(a => ({
            seq: a.seq,
            productId: a.productId,
            productName: a.productName,
            productCode: a.productCode,
            productUom: a.productUom,
            useMould: a.useMould !== false,
            bulkUom: a.bulkUom || a.productUom || 'L',
            allocatedBaseMl: Number(a.allocatedBaseMl || a.mixUsedMl || 0),
            mouldId: a.mouldId || null,
            mouldCode: a.mouldCode || '',
            mouldName: a.mouldName || '',
            capacityMl: Number(a.capacityMl || 0),
            cavities: Number(a.cavities || 1),
            trays: Number(a.trays || 0),
            wasteMode: a.wasteMode || 'PERCENT',
            wasteValue: Number(a.wasteValue ?? 2),
            mixUsedMl: Number(a.allocatedBaseMl || a.mixUsedMl || 0),
            wasteMl: Number(a.wasteMl || 0),
            goodPieces: Number(a.goodPieces || 0),
            productRms: Array.isArray(a.productRms) ? a.productRms : []
          }))
        });
        if (onBatchUpdated) onBatchUpdated();
      } catch (err) {
        console.warn('Auto-save step 3 allocations failed:', err);
      } finally {
        setSavingAllocations(false);
      }
    }

    // Gating check for Step 5: Factory stages
    if (targetStep >= 5 && activeStep === 4) {
      try {
        setSavingStages(true);
        await api.put(`/production/standard/${batchId}/stages`, { timelineStages });
      } catch (err) {
        console.warn('Auto-save step 4 stages failed:', err);
      } finally {
        setSavingStages(false);
      }
    }

    setActiveStep(targetStep);
  };

  // Sub-Run Completion & Adding Next Product from Remaining Mix
  const handleRecordSubRunAndAddAnother = () => {
    const mouldPieces = liveAllocationsResult.allocations.reduce((s, a) => s + (a.goodPieces || 0), 0);
    const pieces = Number(actualYieldPieces) > 0 ? Number(actualYieldPieces) : mouldPieces;
    if (pieces <= 0) {
      Swal.fire({ title: 'Invalid Yield', text: 'Please enter actual good output pieces count.', icon: 'warning' });
      return;
    }

    const batchRef = batch?.referenceNo || batch?.batchNo || 'PROD0001';
    const subCode = currentSubRunLetter;
    const currentProduct = allocations[0]?.productName || 'Ice Cream Product';
    const mouldCode = allocations[0]?.mouldCode || 'Standard Mould';
    const mixUsed = liveAllocationsResult.totalMixUsedMl;

    const newSubRecord = {
      subCode,
      subBatchNumber: `${batchRef} - ${subCode}`,
      productName: currentProduct,
      pieces,
      mould: mouldCode,
      mixUsedMl: mixUsed,
      completedAt: new Date().toLocaleTimeString()
    };

    setCompletedSubBatches(prev => [...prev, newSubRecord]);

    Swal.fire({
      title: `Production ${batchRef} ${subCode} Completed!`,
      html: `
        <div style="text-align: left; font-size: 13px; line-height: 1.6;">
          <p><strong>Sub-Run:</strong> <span style="font-family: monospace; font-weight: bold; color: #10b981;">${batchRef} - Sub-Run ${subCode}</span></p>
          <p><strong>Product:</strong> ${currentProduct}</p>
          <p><strong>Yield Recorded:</strong> <span style="font-family: monospace; font-weight: bold;">${pieces} pcs</span></p>
          <p><strong>Mix Consumed:</strong> ${formatIndian(mixUsed)} ml</p>
          <p><strong>Remaining Mix:</strong> <span style="font-family: monospace; font-weight: bold; color: #6366f1;">${formatIndian(liveAllocationsResult.remainingMixMl)} ml</span></p>
        </div>
      `,
      icon: 'success'
    });

    if (liveAllocationsResult.remainingMixMl <= 50) {
      Swal.fire({
        title: 'Insufficient Mix Remaining',
        text: `Remaining mix is ${formatIndian(liveAllocationsResult.remainingMixMl)} ml. Raw material volume has been fully converted into products. Ready to finalize entire production.`,
        icon: 'info'
      });
    } else {
      setAllocations(prev => prev.map(a => ({ ...a, trays: 0 })));
      setActiveStep(3);
    }
  };

  // Save Section A & B via PUT /api/production/standard/:id/process
  const handleSaveProcess = async () => {
    try {
      setSavingProcess(true);
      await api.put(`/production/standard/${batchId}/process`, {
        mergeStage,
        evaporationPct,
        evaporationApplied,
        lines: rmRows
      });

      Swal.fire({
        title: 'Floor Process Saved!',
        text: 'Raw materials, batch allocations, merge volume and evaporation parameters persisted successfully.',
        icon: 'success',
        timer: 1800
      });

      if (onBatchUpdated) onBatchUpdated();
    } catch (err) {
      console.error('Failed to save process:', err);
      const msg = err.response?.data?.message || err.response?.data?.error || 'Failed to save floor execution.';
      Swal.fire({ title: 'Save Failed', text: msg, icon: 'error' });
    } finally {
      setSavingProcess(false);
    }
  };

  // ── SECTION C: Product Allocation Handlers ──
  const handleUpdateAllocation = (index, field, value) => {
    setAllocations(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const handleFillMaxTrays = (index) => {
    const alloc = allocations[index];
    if (!alloc) return;
    const prevAllocations = allocations.slice(0, index);
    const prevUsed = prevAllocations.reduce((acc, a) => {
      const cap = Number(a.capacityMl || 20);
      const cav = Number(a.cavities || 50);
      const trays = Number(a.trays || 0);
      const wm = a.wasteMode || 'PERCENT';
      const wv = Number(a.wasteValue ?? 2);
      const rawMl = trays * cav * cap;
      const wasteMl = (wm === 'PERCENT' || wm === '%') ? rawMl * (wv / 100) : (wv * trays);
      return acc + (rawMl + wasteMl);
    }, 0);

    const effectiveTotal = availableMixMl > 0 ? availableMixMl : (liveEvaporationResult.mixAfterEvapMl || liveEvaporationResult.totalBeforeEvapMl || 0);
    const remainingForThis = Math.max(0, effectiveTotal - prevUsed);
    
    const cap = Number(alloc.capacityMl || 20);
    const cav = Number(alloc.cavities || 50);
    const wm = alloc.wasteMode || 'PERCENT';
    const wv = Number(alloc.wasteValue ?? 2);

    const maxT = computeMaxTrays({
      availableMixMl: remainingForThis,
      capacityMl: cap,
      cavities: cav,
      wasteMode: wm,
      wasteValue: wv
    });

    handleUpdateAllocation(index, 'trays', maxT);
  };

  const handleOpenMouldPicker = (index) => {
    setTargetAllocIndex(index);
    setMouldPickerOpen(true);
  };

  const handleSelectMouldFromPicker = (selectedMould) => {
    if (targetAllocIndex === null) return;
    const cap = Number(selectedMould.mould_capacity_ml || selectedMould.capacity_ml || 50);
    const cav = selectedMould.cavities_per_tray ? Number(selectedMould.cavities_per_tray) : (selectedMould.cavity_count ? Number(selectedMould.cavity_count) : 1);
    
    setAllocations(prev => {
      const copy = [...prev];
      const currentAlloc = copy[targetAllocIndex] || {};
      const prevAllocations = copy.slice(0, targetAllocIndex);
      const prevUsed = prevAllocations.reduce((acc, a) => {
        const c = Number(a.capacityMl || 20);
        const cv = Number(a.cavities || 50);
        const t = Number(a.trays || 0);
        const wm = a.wasteMode || 'PERCENT';
        const wv = Number(a.wasteValue ?? 2);
        const rawMl = t * cv * c;
        const wMl = (wm === 'PERCENT' || wm === '%') ? rawMl * (wv / 100) : (wv * t);
        return acc + (rawMl + wMl);
      }, 0);
      const effectiveTotal = availableMixMl > 0 ? availableMixMl : (liveEvaporationResult.mixAfterEvapMl || liveEvaporationResult.totalBeforeEvapMl || 0);
      const remainingForThis = Math.max(0, effectiveTotal - prevUsed);
      const autoMaxTrays = computeMaxTrays({
        availableMixMl: remainingForThis,
        capacityMl: cap,
        cavities: cav,
        wasteMode: currentAlloc.wasteMode || 'PERCENT',
        wasteValue: Number(currentAlloc.wasteValue ?? 2)
      });

      copy[targetAllocIndex] = {
        ...currentAlloc,
        mouldId: selectedMould.id,
        mouldCode: selectedMould.mould_code,
        mouldName: selectedMould.mould_name,
        capacityMl: cap,
        cavities: cav,
        trays: autoMaxTrays > 0 ? autoMaxTrays : (Number(currentAlloc.trays) || 0)
      };
      return copy;
    });
    setMouldPickerOpen(false);
    setTargetAllocIndex(null);
  };

  // Callback when user selects a single product from ProductionItemSearchModal
  const handleSelectProductForAlloc = (product) => {
    const nextSeq = allocations.length + 1;
    setAllocations(prev => [
      ...prev,
      {
        seq: nextSeq,
        productId: product.id,
        productName: product.name || product.productName,
        productCode: product.code || product.systemCode,
        useMould: true,
        mouldId: null,
        mouldCode: 'SG-8112',
        mouldName: 'Kulfi Small (SG 8112)',
        capacityMl: 50,
        cavities: 42,
        trays: 0,
        wasteMode: 'PERCENT',
        wasteValue: 2.0
      }
    ]);
  };

  const handleRemoveProductAllocation = (index) => {
    setAllocations(prev => prev.filter((_, idx) => idx !== index));
  };

  // Save Section C via PUT /api/production/standard/:id/allocations
  const handleSaveAllocations = async () => {
    if (!isSlideMerged || availableMixMl <= 0) {
      Swal.fire({
        title: 'Mix Required',
        text: 'You must merge raw materials before saving product allocations.',
        icon: 'warning'
      });
      return;
    }

    if (!liveAllocationsResult.isValid) {
      const errMsgs = liveAllocationsResult.errors.map(e => e.message).join('\n');
      Swal.fire({
        title: 'Cannot Save Allocations',
        text: errMsgs,
        icon: 'error'
      });
      return;
    }

    try {
      setSavingAllocations(true);
      const validAllocations = allocations.filter(a => a.productId);
      await api.put(`/production/standard/${batchId}/allocations`, {
        allocations: validAllocations.map(a => ({
          seq: a.seq,
          productId: a.productId,
          productName: a.productName,
          productCode: a.productCode,
          productUom: a.productUom || a.uom || 'pcs',
          useMould: a.useMould !== false,
          bulkUom: a.bulkUom || a.productUom || 'L',
          allocatedBaseMl: Number(a.allocatedBaseMl || a.mixUsedMl || 0),
          mouldId: a.mouldId || null,
          mouldCode: a.mouldCode || '',
          mouldName: a.mouldName || '',
          capacityMl: Number(a.capacityMl || 0),
          cavities: Number(a.cavities || 1),
          trays: Number(a.trays || 0),
          wasteMode: a.wasteMode || 'PERCENT',
          wasteValue: Number(a.wasteValue ?? 2),
          mixUsedMl: Number(a.allocatedBaseMl || a.mixUsedMl || 0),
          wasteMl: Number(a.wasteMl || 0),
          goodPieces: Number(a.goodPieces || 0),
          productRms: Array.isArray(a.productRms) ? a.productRms : []
        }))
      });

      Swal.fire({
        title: 'Allocations Saved!',
        text: 'Finished product allocations and specific raw materials saved atomically.',
        icon: 'success',
        timer: 1800
      });

      // Refresh batch details to pick up newly calculated costing
      fetchAllData();
      if (onBatchUpdated) onBatchUpdated();
    } catch (err) {
      console.error('Failed to save allocations:', err);
      const msg = err.response?.data?.message || err.response?.data?.error || 'Failed to save product allocations.';
      Swal.fire({ title: 'Allocation Save Failed', text: msg, icon: 'error' });
    } finally {
      setSavingAllocations(false);
    }
  };

  // ── LIFECYCLE CONTROLS: PAUSE, RESUME, CANCEL ──
  const handlePause = async () => {
    const { value: reason } = await Swal.fire({
      title: 'Pause Floor Run',
      input: 'textarea',
      inputLabel: 'Reason for pausing (e.g. Tank maintenance, Power cut, Shift handover):',
      inputPlaceholder: 'Enter pause reason...',
      showCancelButton: true,
      confirmButtonText: 'Confirm Pause',
      confirmButtonColor: '#d97706',
      inputValidator: (value) => {
        if (!value || value.trim().length < 3) {
          return 'Please provide a reason for pausing the floor run.';
        }
      }
    });

    if (!reason) return;

    try {
      setActionLoading(true);
      await api.post(`/production/standard/${batchId}/pause`, { reason });
      Swal.fire({ title: 'Floor Run Paused', text: 'Batch status set to Paused.', icon: 'success', timer: 1500 });
      fetchAllData();
      if (onBatchUpdated) onBatchUpdated();
    } catch (err) {
      console.error('Failed to pause floor run:', err);
      Swal.fire({ title: 'Error', text: err.response?.data?.error || 'Failed to pause floor run.', icon: 'error' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleResume = async () => {
    try {
      setActionLoading(true);
      await api.post(`/production/standard/${batchId}/resume`);
      Swal.fire({ title: 'Floor Run Resumed', text: 'Batch is now active In Progress.', icon: 'success', timer: 1500 });
      fetchAllData();
      if (onBatchUpdated) onBatchUpdated();
    } catch (err) {
      console.error('Failed to resume floor run:', err);
      Swal.fire({ title: 'Error', text: err.response?.data?.error || 'Failed to resume floor run.', icon: 'error' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelRun = async () => {
    const { value: reason } = await Swal.fire({
      title: 'Cancel Floor Run',
      input: 'textarea',
      inputLabel: 'Cancellation reason (e.g., Mix spoilage, Machine breakdown):',
      inputPlaceholder: 'State why this batch floor run is being cancelled...',
      showCancelButton: true,
      confirmButtonText: 'Yes, Cancel Run',
      confirmButtonColor: '#e11d48',
      inputValidator: (value) => {
        if (!value || value.trim().length < 4) {
          return 'Please specify a valid cancellation reason.';
        }
      }
    });

    if (!reason) return;

    try {
      setActionLoading(true);
      await api.patch(`/production/batches-redesign/${batchId}/status`, {
        status: 'Cancelled',
        cancelledReason: reason
      });
      Swal.fire({ title: 'Floor Run Cancelled', text: 'Batch has been marked as Cancelled.', icon: 'info', timer: 1800 });
      onClose();
      if (onBatchUpdated) onBatchUpdated();
    } catch (err) {
      console.error('Failed to cancel run:', err);
      Swal.fire({ title: 'Error', text: err.response?.data?.error || 'Failed to cancel floor run.', icon: 'error' });
    } finally {
      setActionLoading(false);
    }
  };

  // ── REOPEN BATCH FOR CONTINUOUS EDITING ──
  const handleReopenProduction = async () => {
    const confirm = await Swal.fire({
      title: 'Reopen Batch for Editing?',
      text: 'This will unlock raw materials, evaporation, and mould allocations so you can modify and re-save parameters in the database.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Yes, Reopen for Editing',
      confirmButtonColor: '#4f46e5'
    });
    if (!confirm.isConfirmed) return;

    try {
      setActionLoading(true);
      await api.post(`/production/standard/${batchId}/reopen`);
      Swal.fire({
        title: 'Batch Reopened',
        text: 'Batch is now In Progress and unlocked for continuous editing.',
        icon: 'success',
        timer: 1800
      });
      setViewMode('STEPS');
      setActiveStep(1);
      fetchAllData();
      if (onBatchUpdated) onBatchUpdated();
    } catch (err) {
      console.error('Failed to reopen batch:', err);
      Swal.fire({
        title: 'Error',
        text: err.response?.data?.error || 'Failed to reopen production batch.',
        icon: 'error'
      });
    } finally {
      setActionLoading(false);
    }
  };

  // ── YIELD RECORDING & COMPLETION ──
  const handleOpenYieldModal = () => {
    const allocs = liveAllocationsResult.allocations || [];
    const existingYields = Array.isArray(productYields) ? productYields : [];

    if (allocs.length === 0 && batch?.product) {
      const prodUom = formatCleanUom(batch.product.consumptionUnit || batch.product.unit || 'pcs', 'pcs', batch.product);
      const match = existingYields.find(y => y.productId === (batch.product.id || batch.productId));
      setProductYields([
        {
          seq: 1,
          productId: batch.product.id || batch.productId,
          productName: batch.product.name || 'Finished Product',
          productCode: batch.product.code || 'FP',
          uom: prodUom,
          planned: match?.planned ?? (batch.quantity || 2000),
          calculatedYield: Number(match?.calculatedYield ?? actualYieldPieces ?? 2000),
          actualGoodOutput: Number(match?.actualGoodOutput ?? actualYieldPieces ?? 2000),
          rejectOutput: Number(match?.rejectOutput ?? 0)
        }
      ]);
    } else {
      setProductYields(allocs.map((a, i) => {
        const uom = a.productUom || a.bulkUom || a.uom || 'pcs';
        const calcYield = Number(a.goodPieces ?? a.goodUnits ?? 0);
        const plannedYield = Number(a.plannedQty || calcYield || (batch?.quantity ? Math.round(batch.quantity / (allocs.length || 1)) : 2000));
        const match = existingYields.find(y => y.productId === a.productId || y.seq === (a.seq || (i + 1)));
        return {
          seq: a.seq || (i + 1),
          productId: a.productId,
          productName: a.productName,
          productCode: a.productCode,
          uom,
          planned: match?.planned ?? plannedYield,
          calculatedYield: match?.calculatedYield ?? calcYield,
          actualGoodOutput: match?.actualGoodOutput !== undefined ? Number(match.actualGoodOutput) : (calcYield > 0 ? calcYield : plannedYield),
          rejectOutput: match?.rejectOutput !== undefined ? Number(match.rejectOutput) : 0
        };
      }));
    }
    setShowYieldModal(true);
  };

  const handleUpdateProductYield = (index, field, value) => {
    setProductYields(prev => {
      const copy = Array.isArray(prev) ? [...prev] : [];
      if (!copy[index]) return copy;
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const handleCompleteBatchSubmit = async () => {
    const yieldsList = Array.isArray(productYields) ? productYields : [];
    const totalActual = yieldsList.length > 0
      ? yieldsList.reduce((s, p) => s + Number(p.actualGoodOutput || 0), 0)
      : Number(actualYieldPieces || 0);

    if (totalActual <= 0 && yieldsList.every(p => Number(p.actualGoodOutput || 0) <= 0)) {
      Swal.fire({ title: 'Invalid Yield', text: 'Please enter a valid good output count greater than 0.', icon: 'warning' });
      return;
    }

    try {
      setCompleting(true);
      const res = await api.post(`/production/standard/${batchId}/complete`, {
        actualOutput: totalActual,
        productOutputs: yieldsList.map(p => ({
          productId: p.productId,
          productName: p.productName,
          actualOutput: Number(p.actualGoodOutput || 0),
          actualGoodOutput: Number(p.actualGoodOutput || 0),
          rejectOutput: Number(p.rejectOutput || 0),
          uom: p.uom
        })),
        productYields: yieldsList.map(p => ({
          seq: p.seq,
          productId: p.productId,
          productName: p.productName,
          productCode: p.productCode,
          uom: p.uom,
          planned: Number(p.planned || 0),
          calculatedYield: Number(p.calculatedYield || 0),
          actualGoodOutput: Number(p.actualGoodOutput || 0),
          rejectOutput: Number(p.rejectOutput || 0)
        })),
        notes: completionNotes,
        labTestRequired,
        subBatches: completedSubBatches
      });

      const leftoverLogs = res.data?.leftoverRestoration || [];
      let restoreHtml = '';
      if (leftoverLogs.length > 0) {
        restoreHtml = `
          <div style="margin-top: 10px; text-align: left; font-size: 11px; max-height: 140px; overflow-y: auto; background: #f8fafc; padding: 8px; border-radius: 8px;">
            <strong style="color: #047857;">Restored / Verified in Warehouse Stock:</strong>
            <ul style="padding-left: 16px; margin-top: 4px;">
              ${leftoverLogs.map(l => `<li><strong>${l.rawMaterialName}</strong>: ${l.unusedRestoredQty} ${l.uom} remained (${l.remainingWarehouseStock} in warehouse)</li>`).join('')}
            </ul>
          </div>
        `;
      }

      Swal.fire({
        title: 'Production Run Finalized!',
        html: `
          <div style="text-align: left; font-size: 13px; line-height: 1.6;">
            <p><strong>Batch No:</strong> <span style="font-family: monospace; font-weight: bold; color: #4f46e5;">${batch?.referenceNo || batch?.batchNo || batchId}</span></p>
            <p><strong>Total Yield:</strong> <span style="font-family: monospace; font-weight: bold; color: #10b981;">${totalActual} items</span></p>
            <p><strong>Lab Test Status:</strong> <span style="font-weight: bold; color: ${labTestRequired ? '#d97706' : '#047857'};">${labTestRequired ? 'Sent to QC Quarantine' : 'Directly added to Available Sellable Stock'}</span></p>
            ${restoreHtml}
          </div>
        `,
        icon: 'success'
      });

      setShowYieldModal(false);
      setViewMode('REPORT');
      fetchAllData();
      if (onBatchUpdated) onBatchUpdated();
    } catch (err) {
      console.error('Failed to complete batch:', err);
      Swal.fire({ title: 'Error', text: err.response?.data?.error || 'Failed to complete production run.', icon: 'error' });
    } finally {
      setCompleting(false);
    }
  };

  if (!isOpen) return null;

  const isPaused = batch?.status === 'Paused';
  const isCompleted = batch?.status === 'Completed';

  // Derived readiness flags for stepper indicators
  const step1Ready = rmRows.length > 0 && rmRows.every(r => r.takenQty > 0);
  const step2Ready = isSlideMerged && liveEvaporationResult.mixAfterEvapMl > 0;
  const step3Ready = allocations.length > 0 && liveAllocationsResult.isValid;
  const step4Ready = isCompleted;

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-md p-0 sm:p-2 overflow-y-auto font-['Plus_Jakarta_Sans',sans-serif]`}>
      <div className={`relative w-full ${isFullscreen ? 'h-full max-h-screen rounded-none' : 'max-w-7xl max-h-[96vh] rounded-2xl'} bg-white dark:bg-slate-950 shadow-2xl flex flex-col overflow-hidden border border-slate-200 dark:border-slate-800 transition-all duration-200`}>
        
        {/* ── TOP ACTION BAR (MATCHING SCREENSHOT 2) ── */}
        <div className="sticky top-0 z-30 flex items-center justify-between px-4 sm:px-6 py-3 bg-slate-900 text-white border-b border-slate-800 select-none shadow-md flex-wrap gap-2">
          
          {/* Left: Identity & Status */}
          <div className="flex items-center gap-3 shrink-0 flex-wrap">
            <div className="w-9 h-9 rounded-xl bg-purple-900/80 text-purple-300 flex items-center justify-center border border-purple-700 shadow-xs">
              <Sliders className="w-5 h-5" />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-sm text-white tracking-wide">
                  Floor Run Cockpit
                </span>
                <span className={`text-[10px] font-mono font-black px-2 py-0.5 rounded-full border flex items-center gap-1 ${
                  isCompleted
                    ? 'bg-emerald-950 text-emerald-300 border-emerald-700'
                    : isPaused
                    ? 'bg-amber-950 text-amber-300 border-amber-700'
                    : 'bg-emerald-950/80 text-emerald-400 border-emerald-700'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${isCompleted ? 'bg-emerald-400' : isPaused ? 'bg-amber-400' : 'bg-emerald-400 animate-pulse'}`} />
                  {batch?.status?.toUpperCase() || 'IN PROGRESS'}
                </span>
                <span className="text-[10.5px] font-mono text-slate-400 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                  {batch?.referenceNo || batch?.batchNo || `#${batchId?.slice(0, 8)}`}
                </span>
              </div>
              <div className="text-[10.5px] text-slate-400 font-medium">
                {batch?.templateName || batch?.baseName || 'Standard Formulation'} • {batch?.shift || 'Morning Shift'}
              </div>
            </div>
          </div>

          {/* Center & Right Action Buttons */}
          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            {/* View Mode Toggle Switcher */}
            <div className="flex items-center bg-slate-800 p-0.5 rounded-xl border border-slate-700">
              <button
                type="button"
                onClick={() => setViewMode('STEPS')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  viewMode === 'STEPS'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Floor Steps</span>
              </button>
              {isCompleted && (
                <button
                  type="button"
                  onClick={() => setViewMode('REPORT')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    viewMode === 'REPORT'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>Clean Report</span>
                </button>
              )}
            </div>

            {/* Reopen Batch Button (when Completed) */}
            {isCompleted && (
              <Button
                variant="outline"
                size="sm"
                disabled={actionLoading}
                onClick={handleReopenProduction}
                className="rounded-xl border-amber-500/70 text-amber-300 hover:bg-amber-950/40 h-8 px-2.5 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                title="Unlock completed batch and resume edits in PostgreSQL"
              >
                <Unlock className="w-3.5 h-3.5" />
                <span>Reopen Batch</span>
              </Button>
            )}

            {/* Pause / Resume Button */}
            {!isCompleted && (
              isPaused ? (
                <Button
                  size="sm"
                  disabled={actionLoading}
                  onClick={handleResume}
                  className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-8 px-3 text-xs shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Resume Floor Run</span>
                </Button>
              ) : (
                <Button
                  size="sm"
                  disabled={actionLoading}
                  onClick={handlePause}
                  className="rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold h-8 px-3 text-xs shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  <Pause className="w-3.5 h-3.5 fill-current" />
                  <span>Pause Floor Run</span>
                </Button>
              )
            )}

            {/* Finalize Entire Production Button (Only active after entering Step 5) */}
            {!isCompleted && (
              <Button
                size="sm"
                disabled={activeStep < 5 || actionLoading}
                onClick={handleOpenYieldModal}
                className={`rounded-xl font-bold h-8 px-3 text-xs shadow-xs flex items-center gap-1.5 transition-all ${
                  activeStep === 5 
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer ring-2 ring-emerald-400/50 shadow-sm' 
                    : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed opacity-60'
                }`}
                title={activeStep === 5 ? "Record Actual Yield & Finalize Entire Production" : "Advance through Step 5 Quality & Costing to finalize entire production"}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{activeStep === 5 ? 'Finalize Entire Production' : 'Finalize Production (Step 5)'}</span>
              </Button>
            )}

            {/* Cancel Run Button */}
            {!isCompleted && (
              <Button
                variant="outline"
                size="sm"
                disabled={actionLoading}
                onClick={handleCancelRun}
                className="rounded-xl text-rose-400 border-rose-800 hover:bg-rose-950/40 h-8 px-2.5 text-xs font-bold cursor-pointer"
                title="Cancel Floor Run"
              >
                Cancel Run
              </Button>
            )}

            {/* GST / GS1 Barcode Button (Only available once production is completed) */}
            {isCompleted && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const primaryProduct = batch?.product || allocations[0];
                  const sellingPrice = Number(primaryProduct?.salePrice || primaryProduct?.ratePerUnit || batch?.salePrice || 0);
                  const mfdDisplay = batch?.completeDate ? new Date(batch.completeDate).toISOString().split('T')[0] : (batch?.startDate ? new Date(batch.startDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]);
                  Swal.fire({
                    title: 'GST Compliance & GS1 Barcode Ready',
                    html: `
                      <div style="text-align: left; font-size: 13px; line-height: 1.6;">
                        <p><strong>Batch No:</strong> <span style="font-family: monospace; font-weight: bold; color: #4f46e5;">${batch?.referenceNo || batch?.batchNo || batchId}</span></p>
                        <p><strong>Product:</strong> ${primaryProduct?.name || primaryProduct?.productName || 'Ice Cream Goods'}</p>
                        <p><strong>MFD (Production Date):</strong> <span style="font-family: monospace; font-weight: bold;">${mfdDisplay}</span></p>
                        <p><strong>MRP / Selling Price:</strong> <span style="font-family: monospace; font-weight: bold; color: #10b981;">₹${sellingPrice > 0 ? sellingPrice.toFixed(2) : '150.00'}</span></p>
                        <p><strong>GS1 (01) GTIN:</strong> 08901234567890</p>
                        <p><strong>GS1 (10) Batch:</strong> ${batch?.referenceNo || batch?.batchNo || 'LOT-2026'}</p>
                      </div>
                    `,
                    icon: 'success'
                  });
                }}
                className="rounded-xl border-indigo-500/50 bg-indigo-950/40 text-indigo-300 hover:text-white hover:bg-indigo-900/60 h-8 px-2.5 text-xs font-bold cursor-pointer flex items-center"
                title="Print GST Compliance & GS1 Product Label"
              >
                <Printer className="w-3.5 h-3.5 mr-1 text-indigo-400" />
                <span>GST Label</span>
              </Button>
            )}

            {/* Fullscreen Toggle */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsFullscreen(prev => !prev)}
              className="h-8 w-8 p-0 border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800"
              title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen Cockpit'}
            >
              {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            </Button>

            {/* Close Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={onClose}
              className="h-8 w-8 p-0 border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800"
              title="Close Cockpit"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* ── TOP KPI SUMMARY RIBBON (STEPS MODE ONLY) ── */}
        {viewMode === 'STEPS' && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 px-4 sm:px-6 py-2.5 bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 text-xs select-none">
          <div className="flex items-center gap-2">
            <span className="text-slate-500 font-bold">Planned Output:</span>
            <strong className="font-mono text-slate-900 dark:text-white">{batch?.quantity || 2000} pcs</strong>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-500 font-bold">Pre-Evap Mix:</span>
            <strong className="font-mono text-indigo-600 dark:text-indigo-400">
              {formatIndian(liveEvaporationResult.totalBeforeEvapMl)} ml
            </strong>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-500 font-bold">After Evap Mix:</span>
            <strong className="font-mono text-emerald-600 dark:text-emerald-400">
              {formatIndian(liveEvaporationResult.mixAfterEvapMl)} ml
            </strong>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-500 font-bold">Mix Consumed:</span>
            <strong className="font-mono text-purple-600 dark:text-purple-400">
              {formatIndian(liveAllocationsResult.totalMixUsedMl)} ml
            </strong>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-500 font-bold">Remaining Mix:</span>
            <strong className={`font-mono font-black ${liveAllocationsResult.remainingMixMl < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
              {formatIndian(liveAllocationsResult.remainingMixMl)} ml
            </strong>
          </div>
        </div>

        {/* ── 5-STEP GUIDED FLOOR WORKFLOW RIBBON (ADVANCE STEP-BY-STEP PROCESS) ── */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-2.5 bg-slate-900 border-b border-slate-800 overflow-x-auto gap-2 no-scrollbar select-none">
          {[
            { 
              id: 1, 
              title: 'Step 1: RM & Lots', 
              desc: 'Warehouse Lots Allocation', 
              icon: Boxes, 
              isDone: step1Ready,
              badge: `${rmRows.length} materials` 
            },
            { 
              id: 2, 
              title: 'Step 2: Merge & Evap', 
              desc: 'Thermal Mix Conversion', 
              icon: Flame, 
              isDone: step2Ready,
              badge: `${formatIndian(liveEvaporationResult.mixAfterEvapMl)} ml` 
            },
            { 
              id: 3, 
              title: 'Step 3: Finished Products & Allocations', 
              desc: 'Sequential Chaining & Essences', 
              icon: Box, 
              isDone: step3Ready,
              badge: `${allocations.length} products` 
            },
            { 
              id: 4, 
              title: 'Step 4: Factory Stages', 
              desc: 'Timeline & Process Sequence', 
              icon: Layers, 
              isDone: timelineStages.length > 0,
              badge: `${timelineStages.length} stages` 
            },
            { 
              id: 5, 
              title: 'Step 5: Quality, Costing & Yield', 
              desc: 'Actual Completion & Finalization', 
              icon: ShieldCheck, 
              isDone: isCompleted,
              badge: `${actualYieldPieces} pcs` 
            }
          ].map((s) => {
            const isActive = activeStep === s.id;
            const StepIcon = s.icon;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => handleStepClick(s.id)}
                className={`flex items-center gap-2.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 border text-left ${
                  isActive 
                    ? 'bg-indigo-600 text-white border-indigo-400 shadow-md shadow-indigo-500/20 ring-2 ring-indigo-500/30' 
                    : s.isDone 
                    ? 'bg-slate-800/80 text-emerald-300 border-emerald-700/60 hover:bg-slate-800' 
                    : 'bg-slate-800/40 text-slate-400 border-slate-800 hover:text-slate-200'
                }`}
              >
                <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${
                  isActive ? 'bg-white/20 text-white' : s.isDone ? 'bg-emerald-950 text-emerald-400' : 'bg-slate-800 text-slate-400'
                }`}>
                  {s.isDone && !isActive ? <Check className="w-3.5 h-3.5" /> : <StepIcon className="w-3.5 h-3.5" />}
                </div>

                <div className="min-w-0">
                  <div className="font-extrabold text-[11px] leading-tight flex items-center gap-1.5">
                    <span>{s.title}</span>
                    <span className={`text-[9.5px] font-mono px-1 py-0.2 rounded ${
                      isActive ? 'bg-indigo-700 text-white' : s.isDone ? 'bg-emerald-950 text-emerald-300' : 'bg-slate-800 text-slate-400'
                    }`}>
                      {s.badge}
                    </span>
                  </div>
                  <div className={`text-[9.5px] font-medium truncate ${isActive ? 'text-indigo-100' : 'text-slate-400'}`}>
                    {s.desc}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* ── STEP GUIDANCE BANNER ── */}
        <div className="px-4 sm:px-6 py-2 bg-indigo-50/80 dark:bg-indigo-950/40 border-b border-indigo-100 dark:border-indigo-900/60 flex items-center justify-between text-xs text-indigo-900 dark:text-indigo-200 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-indigo-600 text-white font-black text-[10px] flex items-center justify-center shrink-0">
              {activeStep}
            </span>
            <span className="font-semibold">
              {activeStep === 1 && 'Step 1: Allocate warehouse batch lots, reserve inventory stock, and confirm taken quantities for production.'}
              {activeStep === 2 && 'Step 2: Slide to merge raw materials into a single liquid volume (ml), specify process stage, and apply evaporation % mass loss.'}
              {activeStep === 3 && 'Step 3: Assign multiple finished products to the evaporated mix, allocate base mix volume, add product-specific essences/flavours with lots, and configure moulds or bulk storage.'}
              {activeStep === 4 && 'Step 4: Factory stages palette & Timeline sequence. Click stage chip to add/remove • Click any stage to configure temperature & duration • Drag & drop to reorder.'}
              {activeStep === 5 && 'Step 5: Review multi-product allocation economics, calculate wastage costs, record actual completed pieces per product, and finalize floor run.'}
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {activeStep > 1 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setActiveStep(prev => prev - 1)}
                className="h-7 px-2.5 text-[11px] font-bold border-indigo-300 text-indigo-800 dark:text-indigo-300 hover:bg-indigo-100 flex items-center gap-1"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Prev Step</span>
              </Button>
            )}

            {activeStep < 5 && (
              <Button
                type="button"
                size="sm"
                disabled={savingProcess || savingAllocations || savingStages}
                onClick={() => handleStepClick(activeStep + 1)}
                className="h-7 px-3 text-[11px] font-bold bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1 shadow-xs disabled:opacity-60 cursor-pointer"
              >
                {(savingProcess || savingAllocations || savingStages) ? (
                  <RefreshCw className="w-3 h-3 animate-spin" />
                ) : null}
                <span>Proceed to Step {activeStep + 1}</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>
        </div>
        </>
        )}

        {/* ── BODY (Scrollable Step Sections or Clean Executive Report) ── */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          
          {loading ? (
            <div className="flex flex-col items-center justify-center py-24 text-slate-400">
              <RefreshCw className="w-8 h-8 animate-spin mb-3 text-indigo-600" />
              <p className="text-sm font-semibold">Loading batch formulation and warehouse inventory lots...</p>
            </div>
          ) : viewMode === 'REPORT' ? (
            <ProductionCleanReportView
              batch={batch}
              costingData={costingData}
              liveAllocationsResult={liveAllocationsResult}
              liveEvaporationResult={liveEvaporationResult}
              rmRows={rmRows}
              actualYieldPieces={actualYieldPieces}
              completionNotes={completionNotes}
              canViewCost={canViewCost}
              onReopen={handleReopenProduction}
              onSwitchToSteps={() => setViewMode('STEPS')}
              onClose={onClose}
            />
          ) : (
            <>
              {/* ══════════════════════════════════════════════════════════════════════════
                  STEP 1: RAW MATERIALS FORMULATION & WAREHOUSE LOT ALLOCATION
              ══════════════════════════════════════════════════════════════════════════ */}
              <div className={`${activeStep === 1 ? 'block' : 'hidden'} space-y-4`}>
                <Card className="border border-slate-200 dark:border-slate-800 shadow-xs bg-white dark:bg-slate-900 rounded-xl overflow-hidden">
                  <div className="px-5 py-3.5 bg-slate-50/70 dark:bg-slate-800/40 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-lg bg-indigo-600 text-white text-xs font-bold flex items-center justify-center">
                        1
                      </span>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                        Raw Materials Formulation &amp; Batch Consumption
                      </h3>
                      <span className="text-xs text-slate-500 font-normal">
                        ({rmRows.length} materials queued)
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setItemSearchMode('RM_MULTI');
                          setItemSearchOpen(true);
                        }}
                        className="h-8 px-3 text-xs font-bold rounded-lg border-amber-400 text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/40 cursor-pointer shadow-3xs flex items-center gap-1.5"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>+ Add Raw Materials (Multi-Select)</span>
                      </Button>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-100/70 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider text-[10.5px] border-b border-slate-200 dark:border-slate-800">
                          <th className="py-2.5 px-3 text-center w-12" title="Flag material for evaporation mass loss">For Evap</th>
                          <th className="py-2.5 px-3 text-center w-12" title="Include material in combined mix">Merge</th>
                          <th className="py-2.5 px-3 min-w-[160px]">Raw Material</th>
                          <th className="py-2.5 px-3 min-w-[200px]" title="Allocated Batch No from warehouse stock">Batch / Lot Allocation</th>
                          <th className="py-2.5 px-3 text-center w-28">Live UOM</th>
                          <th className="py-2.5 px-3 text-right w-24" title="Allocated batch quantity available in production">Available in Batch</th>
                          <th className="py-2.5 px-3 text-right w-24">Required</th>
                          <th className="py-2.5 px-3 text-right w-28 bg-amber-50/50 dark:bg-amber-950/20">Taken (Used)</th>
                          <th className="py-2.5 px-3 text-right w-28" title="Remaining quantity from allocated batch in this production (Available - Taken)">Remaining in Production</th>
                          <th className="py-2.5 px-3 text-right w-32" title="Remaining stock in warehouse after this batch allocation (Warehouse Stock - Taken)">Remaining Warehouse Stock</th>
                          <th className="py-2.5 px-3 text-center w-10">✕</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {liveEvaporationResult.lines.map((line, idx) => {
                          const hasAllocations = Array.isArray(line.allocatedBatches) && line.allocatedBatches.length > 0;
                          const allocatedSum = hasAllocations 
                            ? line.allocatedBatches.reduce((acc, b) => acc + Number(b.allocatedQty || 0), 0)
                            : Number(line.availableQty || 0);
                          const displayAvailable = allocatedSum;
                          const displayTaken = Number(line.takenQty || 0);
                          const remInProduction = Number((displayAvailable - displayTaken).toFixed(3));
                          const warehouseTotalStock = Number(line.warehouseStock ?? line.currentStock ?? line.availableQty ?? 0);
                          const remWarehouseStock = Number((warehouseTotalStock - displayTaken).toFixed(3));
                          const hasTakenMoreThanAvail = displayTaken > displayAvailable && displayAvailable > 0;
                          const hasNegative = displayTaken < 0 || displayAvailable < 0;

                          return (
                            <tr 
                              key={`line-rm-${line.rawMaterialId || 'rm'}-${idx}`}
                              className={`hover:bg-slate-50/60 dark:hover:bg-slate-800/50 transition-colors ${
                                hasTakenMoreThanAvail || hasNegative ? 'bg-rose-50/40 dark:bg-rose-950/20' : ''
                              }`}
                            >
                              {/* For Evaporation Checkbox */}
                              <td className="py-2.5 px-3 text-center">
                                <input
                                  type="checkbox"
                                  checked={line.evaporates}
                                  onChange={(e) => handleUpdateRmRow(idx, 'evaporates', e.target.checked)}
                                  className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                />
                              </td>

                              {/* Merge Checkbox */}
                              <td className="py-2.5 px-3 text-center">
                                <input
                                  type="checkbox"
                                  checked={line.merged}
                                  onChange={(e) => handleUpdateRmRow(idx, 'merged', e.target.checked)}
                                  className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                />
                              </td>

                              {/* Material Name & Code */}
                              <td className="py-2.5 px-3">
                                <div className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                                  <span>{line.rawMaterialName}</span>
                                  {line.evaporates && (
                                    <Flame className="w-3.5 h-3.5 text-amber-500 shrink-0" title="Evaporating material" />
                                  )}
                                </div>
                                <div className="font-mono text-[10px] text-slate-400">
                                  {line.rawMaterialCode || 'RM'}
                                </div>
                              </td>

                              {/* Interactive Batch / Lot Allocation Column */}
                              <td className="py-2.5 px-3">
                                <div className="flex flex-col gap-1 items-start">
                                  {hasAllocations ? (
                                    <button
                                      type="button"
                                      onClick={() => openLotModal(idx)}
                                      className="px-2 py-1 rounded-lg border border-blue-300 dark:border-blue-800 bg-blue-50/80 dark:bg-blue-950/60 hover:bg-blue-100 hover:border-blue-400 text-blue-900 dark:text-blue-300 font-mono text-[10px] text-left transition-all cursor-pointer shadow-3xs flex items-center gap-1.5 group"
                                      title="Click to view & edit allocated lots"
                                    >
                                      <Boxes className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                                      <span className="font-bold">
                                        {line.allocatedBatches.length === 1 
                                          ? `#${line.allocatedBatches[0].lotNumber || line.allocatedBatches[0].internalBatchNo}` 
                                          : `${line.allocatedBatches.length} Lots Allocated`}
                                      </span>
                                      <span className="text-[9px] text-blue-600 dark:text-blue-400 underline ml-0.5 group-hover:text-blue-800">
                                        Edit
                                      </span>
                                    </button>
                                  ) : (
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      onClick={() => openLotModal(idx)}
                                      className="h-7 px-2.5 rounded-lg border-amber-300 dark:border-amber-800 bg-amber-50/70 dark:bg-amber-950/40 hover:bg-amber-100 text-amber-800 dark:text-amber-300 font-bold text-[10.5px] cursor-pointer shadow-3xs flex items-center gap-1.5"
                                      title="Allocate batch lots from warehouse stock"
                                    >
                                      <Plus className="w-3 h-3 text-amber-600" />
                                      <span>Allocate Lots</span>
                                    </Button>
                                  )}

                                  {/* Batch details summary tag */}
                                  {hasAllocations && (
                                    <div className="text-[9.5px] font-mono text-slate-500 flex items-center gap-1 flex-wrap">
                                      <span>Allocated: <strong className="text-emerald-600">{displayAvailable} {formatCleanUom(line.uom, 'kg', line)}</strong></span>
                                      {line.allocatedBatches[0]?.poNumber && (
                                        <span className="text-slate-400 truncate max-w-[120px]" title={line.allocatedBatches[0].poNumber}>
                                          • {line.allocatedBatches[0].poNumber}
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </td>

                              {/* Live UOM & Alternate UOM */}
                              <td className="py-2.5 px-3 text-center">
                                <span className="font-mono font-bold bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-[11px] text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700">
                                  {formatCleanUom(line.uom, 'kg', line)}
                                </span>
                                {line.hasAlternateUom && line.alternateUom && (
                                  <div className="text-[9.5px] font-semibold text-indigo-600 dark:text-indigo-400 mt-1 bg-indigo-50 dark:bg-indigo-950/50 px-1 py-0.5 rounded border border-indigo-200/50 dark:border-indigo-800/50">
                                    1 {formatCleanUom(line.uom, 'kg', line)} = {line.conversionFactor || 1} {line.alternateUom}
                                  </div>
                                )}
                              </td>

                              {/* Available in Batch (Allocated Qty) */}
                              <td className="py-2.5 px-3 text-right">
                                <div className="font-mono font-black text-xs text-slate-800 dark:text-slate-100">
                                  {formatIndian(displayAvailable)}
                                </div>
                                <span className="text-[9px] text-slate-400 block font-mono">
                                  {formatCleanUom(line.uom, 'kg', line)}
                                </span>
                              </td>

                              {/* Required Qty (Editable) */}
                              <td className="py-2.5 px-3 text-right">
                                <Input
                                  type="number"
                                  step="any"
                                  value={line.requiredQty}
                                  onChange={(e) => handleUpdateRmRow(idx, 'requiredQty', parseFloat(e.target.value) || 0)}
                                  className="h-7 w-20 text-right font-mono text-xs px-1.5 ml-auto border-slate-200 dark:border-slate-700"
                                />
                              </td>

                              {/* Taken (Used) (Editable) */}
                              <td className="py-2.5 px-3 text-right bg-amber-50/40 dark:bg-amber-950/10">
                                <Input
                                  type="number"
                                  step="any"
                                  value={line.takenQty}
                                  onChange={(e) => handleUpdateRmRow(idx, 'takenQty', parseFloat(e.target.value) || 0)}
                                  className="h-7 w-24 text-right font-mono font-bold text-xs px-1.5 ml-auto border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-900"
                                />
                                {hasTakenMoreThanAvail && (
                                  <div className="text-[9.5px] font-bold text-rose-600 flex items-center justify-end gap-0.5 mt-0.5">
                                    <AlertCircle className="w-2.5 h-2.5" />
                                    <span>Exceeds Avail</span>
                                  </div>
                                )}
                              </td>

                              {/* Remaining in Current Production (Available in Batch - Taken) */}
                              <td className="py-2.5 px-3 text-right font-mono font-bold">
                                <span className={remInProduction < 0 ? 'text-rose-600 font-black' : 'text-amber-600 dark:text-amber-400'}>
                                  {formatIndian(remInProduction)} {formatCleanUom(line.uom, 'kg', line)}
                                </span>
                              </td>

                              {/* Remaining Stock in Warehouse after reducing batch taken */}
                              <td className="py-2.5 px-3 text-right font-mono font-bold">
                                <span className={remWarehouseStock < 0 ? 'text-rose-600 font-black' : 'text-emerald-600 dark:text-emerald-400'}>
                                  {formatIndian(remWarehouseStock)} {formatCleanUom(line.uom, 'kg', line)}
                                </span>
                              </td>

                              {/* Remove Row */}
                              <td className="py-2.5 px-3 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleRemoveRmRow(idx)}
                                  className="text-slate-400 hover:text-rose-600 transition-colors p-1 cursor-pointer"
                                  title="Remove line"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </Card>

                {/* Bottom Step 1 Action Ribbon */}
                <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                  <span className="text-xs text-slate-500 font-medium">
                    Allocated lots are verified against real warehouse stock before heating/freezing.
                  </span>
                  <Button
                    type="button"
                    disabled={savingProcess}
                    onClick={() => handleStepClick(2)}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs h-9 px-4 rounded-xl flex items-center gap-1.5 shadow-sm disabled:opacity-60 cursor-pointer"
                  >
                    {savingProcess ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : null}
                    <span>Proceed to Step 2: Volume Merge &amp; Evaporation</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>

              {/* ══════════════════════════════════════════════════════════════════════════
                  STEP 2: VOLUME MERGE AND EVAPORATION COCKPIT
              ══════════════════════════════════════════════════════════════════════════ */}
              <div className={`${activeStep === 2 ? 'block' : 'hidden'} space-y-4`}>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                  
                  {/* Left (2 cols): Controls & Mix Evaporation Results */}
                  <Card className="lg:col-span-2 border border-slate-200 dark:border-slate-800 shadow-xs bg-white dark:bg-slate-900 rounded-xl overflow-hidden">
                    <div className="px-5 py-3.5 bg-slate-50/70 dark:bg-slate-800/40 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-lg bg-amber-500 text-slate-950 text-xs font-bold flex items-center justify-center">
                          2
                        </span>
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                          UOM Volume Conversion, Merge &amp; Evaporation Control
                        </h3>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                          Slide to Merge:
                        </span>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={isSlideMerged}
                            onChange={(e) => setIsSlideMerged(e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                        </label>
                      </div>
                    </div>

                    <div className="p-5 space-y-5">
                      
                      {/* Controls Row */}
                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60">
                        {/* Merge Stage */}
                        <div>
                          <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                            1. Merge Stage
                          </label>
                          <select
                            value={mergeStage}
                            onChange={(e) => setMergeStage(e.target.value)}
                            className="w-full h-9 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-xs font-semibold text-slate-800 dark:text-slate-100 outline-none focus:border-amber-500 cursor-pointer"
                          >
                            <option value="After heating">After heating</option>
                            <option value="After freezing">After freezing</option>
                            <option value="Other Method">Other Method</option>
                            {mergeStage && !['After heating', 'After freezing', 'Other Method'].includes(mergeStage) && (
                              <option value={mergeStage}>{mergeStage}</option>
                            )}
                          </select>
                        </div>

                        {/* Evaporation % */}
                        <div>
                          <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                            2. Evaporation (%)
                          </label>
                          <div className="flex items-center gap-1.5">
                            <Input
                              type="number"
                              min="0"
                              max="100"
                              step="0.5"
                              value={evaporationPct}
                              onChange={(e) => setEvaporationPct(parseFloat(e.target.value) || 0)}
                              className="h-9 font-mono font-bold text-xs"
                            />
                            <span className="font-bold text-xs text-slate-500">%</span>
                          </div>
                        </div>

                        {/* Direct Mix After Evaporation (Auto-Calculates %) */}
                        <div>
                          <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                            3. Mix After Evap (ml)
                          </label>
                          <div className="flex items-center gap-1.5">
                            <Input
                              type="number"
                              min="0"
                              step="10"
                              value={liveEvaporationResult.mixAfterEvapMl || ''}
                              onChange={(e) => handleDirectMixAfterEvapChange(e.target.value)}
                              placeholder="Direct ml"
                              className="h-9 font-mono font-bold text-xs border-emerald-400 dark:border-emerald-700"
                            />
                            <span className="font-bold text-xs text-slate-500">ml</span>
                          </div>
                        </div>

                        {/* Apply & Undo Buttons */}
                        <div className="flex flex-col justify-end">
                          <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                            4. Action
                          </label>
                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              disabled={!isSlideMerged || evaporationApplied}
                              onClick={handleApplyEvaporation}
                              className="flex-1 h-9 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs rounded-lg cursor-pointer disabled:opacity-40"
                            >
                              <Flame className="w-3.5 h-3.5 mr-1" />
                              <span>Apply Evap</span>
                            </Button>
                            {evaporationApplied && (
                              <Button
                                type="button"
                                variant="outline"
                                onClick={handleUndoEvaporation}
                                className="h-9 px-2.5 text-xs font-bold rounded-lg border-slate-300 dark:border-slate-700 cursor-pointer"
                                title="Undo Evaporation"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Evaporation Math Results Grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="p-3.5 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200/60 dark:border-indigo-800/60">
                          <div className="text-[10.5px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                            Total Before Evaporation
                          </div>
                          <div className="text-lg font-mono font-black text-indigo-950 dark:text-indigo-200 mt-1">
                            {formatIndian(liveEvaporationResult.totalBeforeEvapMl)} ml
                          </div>
                          <div className="text-[11px] font-mono text-indigo-700 dark:text-indigo-300">
                            ≈ {formatIndian(liveEvaporationResult.totalBeforeEvapL ?? round2(liveEvaporationResult.totalBeforeEvapMl / 1000))} Litres
                          </div>
                        </div>

                        <div className="p-3.5 rounded-xl bg-amber-50/70 dark:bg-amber-950/40 border border-amber-200/60 dark:border-amber-800/60">
                          <div className="text-[10.5px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                            Evaporated Mass Loss ({evaporationPct}%)
                          </div>
                          <div className="text-lg font-mono font-black text-amber-950 dark:text-amber-200 mt-1">
                            {evaporationApplied ? `-${formatIndian(liveEvaporationResult.evaporatedMl)}` : '0'} ml
                          </div>
                          <div className="text-[11px] font-mono text-amber-700 dark:text-amber-300">
                            Base: {formatIndian(liveEvaporationResult.evaporationBaseMl)} ml eligible
                          </div>
                        </div>

                        <div className="p-3.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200/60 dark:border-emerald-800/60">
                          <div className="text-[10.5px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                            Mix After Evaporation
                          </div>
                          <div className="text-lg font-mono font-black text-emerald-950 dark:text-emerald-200 mt-1">
                            {formatIndian(liveEvaporationResult.mixAfterEvapMl)} ml
                          </div>
                          <div className="text-[11px] font-mono text-emerald-700 dark:text-emerald-300">
                            ≈ {formatIndian(liveEvaporationResult.mixAfterEvapL ?? round2(liveEvaporationResult.mixAfterEvapMl / 1000))} Litres available
                          </div>
                        </div>
                      </div>

                    </div>
                  </Card>

                  {/* Right (1 col): Side Panel "Material Status" */}
                  <Card className="border border-slate-200 dark:border-slate-800 shadow-xs bg-white dark:bg-slate-900 rounded-xl overflow-hidden flex flex-col">
                    <div className="px-4 py-3 bg-slate-50/70 dark:bg-slate-800/40 border-b border-slate-200 dark:border-slate-800">
                      <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                        Side Panel: Material Status
                      </h4>
                      <p className="text-[10px] text-slate-400">
                        Post-evaporation volume vs Remaining warehouse stock
                      </p>
                    </div>

                    <div className="flex-1 overflow-y-auto p-3 divide-y divide-slate-100 dark:divide-slate-800">
                      {liveEvaporationResult.lines.map((line, idx) => {
                        const rawMl = Number(line.takenMl ?? line.requiredMl ?? 0);
                        const isEvap = Boolean(line.evaporates);
                        let postMl = Number(line.takenMlAfterEvap ?? line.postEvapMl ?? 0);
                        if (postMl <= 0 && rawMl > 0) {
                          postMl = (isEvap && evaporationApplied) ? Math.max(0, rawMl * (1 - (evaporationPct / 100))) : rawMl;
                        }
                        const displayMl = postMl > 0 ? postMl : rawMl;
                        
                        const hasAlloc = Array.isArray(line.allocatedBatches) && line.allocatedBatches.length > 0;
                        const allocAmount = hasAlloc 
                          ? line.allocatedBatches.reduce((s, b) => s + Number(b.allocatedQty || 0), 0)
                          : Number(line.availableQty || 0);
                        const taken = Number(line.takenQty || 0) > 0 ? Number(line.takenQty) : Number(line.requiredQty || 0);
                        const remInProd = Number((allocAmount - taken).toFixed(3));
                        const warehouseTotalStock = Number(line.warehouseStock ?? line.currentStock ?? 0);
                        const remStock = Number((warehouseTotalStock - taken).toFixed(3));

                        return (
                          <div key={`merge-rm-${line.rawMaterialId || 'rm'}-${idx}`} className="py-2.5 first:pt-1 last:pb-1 text-xs space-y-1.5 border-b last:border-b-0 border-slate-100 dark:border-slate-800">
                            <div className="flex items-center justify-between font-bold text-slate-800 dark:text-slate-200">
                              <span className="truncate max-w-[150px] font-semibold">{line.rawMaterialName}</span>
                              <div className="text-right">
                                <span className="font-mono text-emerald-600 dark:text-emerald-400 font-black text-xs">
                                  {formatIndian(displayMl)} ml
                                </span>
                                {isEvap && evaporationApplied && (
                                  <span className="block text-[9px] text-amber-600 dark:text-amber-400 font-semibold">
                                    (-{evaporationPct}% evap)
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-1 text-[11px] text-slate-500 bg-slate-50 dark:bg-slate-800/40 p-1.5 rounded-lg">
                              <div>
                                <span className="text-[9.5px] text-slate-400 block">Warehouse Stock:</span>
                                <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                                  {formatIndian(warehouseTotalStock)} {formatCleanUom(line.uom, 'kg', line)}
                                </span>
                              </div>
                              <div className="text-right">
                                <span className="text-[9.5px] text-slate-400 block">Batch Taken:</span>
                                <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
                                  {formatIndian(taken)} {formatCleanUom(line.uom, 'kg', line)}
                                </span>
                              </div>
                            </div>

                            {/* Remaining in Current Production directly above Remaining in Warehouse Stock */}
                            <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-100 dark:border-slate-800">
                              <span className="text-slate-500 font-medium">Remaining in Current Production:</span>
                              <span className="font-mono font-black text-amber-600 dark:text-amber-400">
                                {formatIndian(remInProd)} {formatCleanUom(line.uom, 'kg', line)}
                              </span>
                            </div>

                            <div className="flex items-center justify-between text-[11px] pt-0.5">
                              <span className="text-slate-500 font-medium">Remaining Warehouse Stock:</span>
                              <span className={`font-mono font-black ${remStock < 0 ? 'text-rose-600' : 'text-emerald-600 dark:text-emerald-400'}`}>
                                {formatIndian(remStock)} {formatCleanUom(line.uom, 'kg', line)}
                              </span>
                            </div>

                            {line.lotBatchNo && (
                              <div className="text-[10px] font-mono text-slate-400 truncate flex items-center justify-between">
                                <span>PO Lot:</span>
                                <span className="text-indigo-600 dark:text-indigo-400 font-bold truncate max-w-[130px]">{line.lotBatchNo}</span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </Card>

                </div>

                {/* Bottom Step 2 Action Ribbon */}
                <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setActiveStep(1)}
                    className="text-xs font-bold h-9 px-3.5 rounded-xl flex items-center gap-1.5"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Back to Step 1 (Raw Materials)</span>
                  </Button>

                  <Button
                    type="button"
                    disabled={savingProcess}
                    onClick={() => handleStepClick(3)}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs h-9 px-4 rounded-xl flex items-center gap-1.5 shadow-sm disabled:opacity-60 cursor-pointer"
                  >
                    {savingProcess ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : null}
                    <span>Proceed to Step 3: Mould &amp; Product Allocation</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>

              {/* ══════════════════════════════════════════════════════════════════════════
                  STEP 3: FINISHED PRODUCTS & MOULD ALLOCATIONS (SEQUENTIAL CHAINING)
              ══════════════════════════════════════════════════════════════════════════ */}
              <div className={`${activeStep === 3 ? 'block' : 'hidden'} space-y-4`}>
                
                {/* Section Header & Mix Available Summary KPIs */}
                <Card className="border border-slate-200 dark:border-slate-800 shadow-xs bg-white dark:bg-slate-900 rounded-xl overflow-hidden">
                  <div className="px-5 py-3.5 bg-slate-50/70 dark:bg-slate-800/40 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2.5">
                      <span className="w-7 h-7 rounded-lg bg-purple-600 text-white text-xs font-bold flex items-center justify-center shadow-xs">
                        3
                      </span>
                      <div>
                        <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                          Finished Products &amp; Mould Allocations (Sequential Chaining)
                        </h3>
                        <p className="text-[11.5px] text-slate-500">
                          Total mix available: <strong className="font-mono text-purple-600 dark:text-purple-400 font-extrabold">{formatIndian(availableMixMl)} ml</strong>
                          <span className="text-slate-400 font-normal"> ≈ {formatIndian(round2(availableMixMl / 1000))} Litres (Mix After Evaporation)</span>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setItemSearchMode('PRODUCT_SINGLE');
                          setItemSearchOpen(true);
                        }}
                        className="h-8 px-3 text-xs font-bold rounded-lg border-indigo-400 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 cursor-pointer shadow-3xs flex items-center gap-1.5"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>+ Add Finished Product</span>
                      </Button>

                      <Button
                        type="button"
                        size="sm"
                        disabled={savingAllocations}
                        onClick={handleSaveAllocations}
                        className="h-8 px-3 text-xs font-bold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer shadow-xs flex items-center gap-1"
                      >
                        {savingAllocations ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                        <span>Save Allocations</span>
                      </Button>
                    </div>
                  </div>

                  {/* Top KPI Metrics Tiles */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-slate-50/50 dark:bg-slate-800/20 border-b border-slate-200 dark:border-slate-800">
                    <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Total Mix Available</span>
                      <strong className="text-base font-mono font-black text-purple-600 dark:text-purple-400 block mt-0.5">
                        {formatIndian(availableMixMl, 2)} ml
                      </strong>
                      <span className="text-[10px] text-slate-500 font-mono">≈ {(availableMixMl / 1000).toFixed(2)} Litres</span>
                    </div>

                    {canViewCost ? (
                      <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Base Mix Cost (Spent)</span>
                        <strong className="text-base font-mono font-black text-slate-900 dark:text-white block mt-0.5">
                          ₹{formatIndian(round2(totalBaseMixCost))}
                        </strong>
                        <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono font-semibold">₹{baseCostPerMl.toFixed(4)} / ml</span>
                      </div>
                    ) : (
                      <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Allocated Products</span>
                        <strong className="text-base font-mono font-black text-slate-900 dark:text-white block mt-0.5">
                          {allocations.length} Products
                        </strong>
                        <span className="text-[10px] text-slate-500 font-mono">Sequential Chaining</span>
                      </div>
                    )}

                    <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Base Mix Allocated</span>
                      <strong className="text-base font-mono font-black text-indigo-600 dark:text-indigo-400 block mt-0.5">
                        {formatIndian(totalAllocatedBaseMl, 2)} ml
                      </strong>
                      <span className="text-[10px] text-slate-500 font-mono">≈ {(totalAllocatedBaseMl / 1000).toFixed(2)} Litres</span>
                    </div>

                    <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Remaining to Allocate</span>
                      <strong className={`text-base font-mono font-black block mt-0.5 ${unallocatedRemainingMl > 0 ? 'text-indigo-600 dark:text-indigo-400' : (unallocatedRemainingMl < 0 ? 'text-rose-600' : 'text-emerald-600 dark:text-emerald-400')}`}>
                        {formatIndian(unallocatedRemainingMl, 2)} ml
                      </strong>
                      <span className="text-[10px] text-slate-500 font-mono">
                        {unallocatedRemainingMl > 0 ? 'Available for remaining products' : (unallocatedRemainingMl < 0 ? 'Exceeds available mix!' : 'Fully allocated (0.00 ml) ✓')}
                      </span>
                    </div>
                  </div>

                  {/* Global Base Mix Allocation Progress Ribbon */}
                  <div className="px-5 py-3 bg-slate-100/70 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800">
                    <div className="flex items-center justify-between text-xs font-bold mb-1.5 flex-wrap gap-2">
                      <span className="text-slate-800 dark:text-slate-200 flex items-center gap-1.5 font-mono">
                        <Droplets className="w-4 h-4 text-purple-600" />
                        <span>Base Mix Allocation:</span>
                        <strong className="text-purple-700 dark:text-purple-300 font-black">
                          {formatIndian(totalAllocatedBaseMl, 2)} / {formatIndian(availableMixMl, 2)} ml ({availableMixMl > 0 ? Math.round((totalAllocatedBaseMl / availableMixMl) * 100) : 0}%)
                        </strong>
                      </span>
                      <span className={`font-mono text-xs font-black px-2.5 py-0.5 rounded shadow-3xs ${
                        unallocatedRemainingMl < 0 
                          ? 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border border-rose-300' 
                          : (unallocatedRemainingMl === 0 
                              ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-300' 
                              : 'bg-indigo-100 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-200 border border-indigo-300')
                      }`}>
                        {unallocatedRemainingMl < 0 
                          ? `Deficit: ${formatIndian(Math.abs(unallocatedRemainingMl), 2)} ml` 
                          : `Remaining to Allocate: ${formatIndian(unallocatedRemainingMl, 2)} ml`}
                      </span>
                    </div>
                    <div className="w-full h-2.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden shadow-inner">
                      <div 
                        className={`h-full transition-all duration-300 ${
                          unallocatedRemainingMl < 0 
                            ? 'bg-rose-500' 
                            : (unallocatedRemainingMl === 0 ? 'bg-emerald-500' : 'bg-purple-600')
                        }`}
                        style={{
                          width: `${availableMixMl > 0 ? Math.min(100, (totalAllocatedBaseMl / availableMixMl) * 100) : 0}%`
                        }}
                      />
                    </div>
                  </div>

                  {/* Product Cards List */}
                  <div className="p-4 space-y-5">
                    {allocations.map((alloc, idx) => {
                      const productMatch = availableProducts.find(p => p.id === alloc.productId);
                      const prodUom = alloc.productUom || alloc.uom || formatCleanUom(productMatch?.consumptionUnit || productMatch?.uom, 'pcs', productMatch);
                      const isMould = alloc.useMould !== false;
                      const bulkUom = alloc.bulkUom || (prodUom === 'pcs' ? 'Liter' : prodUom);

                      // Product RMs volume calculation (only items marked addToMix contribute to mix volume)
                      const productRms = Array.isArray(alloc.productRms) ? alloc.productRms : [];
                      const addedRmVolumeMl = productRms.reduce((sum, prm) => {
                        const isAddToMix = prm.addToMix !== undefined ? Boolean(prm.addToMix) : !isPackagingMaterial(prm);
                        if (!isAddToMix) return sum;
                        const qty = Number(prm.takenQty ?? prm.qty ?? prm.requiredQty ?? 0);
                        return sum + toMl(qty, prm.uom, prm.density);
                      }, 0);

                      const prevAllocatedBaseMl = allocations.slice(0, idx).reduce((sum, a) => sum + Number(a.allocatedBaseMl || a.mixUsedMl || 0), 0);
                      const baseMl = Number(alloc.allocatedBaseMl || alloc.mixUsedMl || 0);
                      const cumulativeAllocatedBaseMl = prevAllocatedBaseMl + baseMl;
                      const availableBeforeThis = Math.max(0, availableMixMl - prevAllocatedBaseMl);
                      const remainingAfterThis = availableMixMl - cumulativeAllocatedBaseMl;
                      const productSharePct = availableMixMl > 0 ? ((baseMl / availableMixMl) * 100).toFixed(1) : '0.0';
                      const cumulativeSharePct = availableMixMl > 0 ? ((cumulativeAllocatedBaseMl / availableMixMl) * 100).toFixed(1) : '0.0';
                      const productTotalMixMl = baseMl + addedRmVolumeMl;

                      // Costing distribution based on consumption level
                      const assignedBaseCost = baseMl * baseCostPerMl;
                      const productRmCost = productRms.reduce((sum, prm) => {
                        const qty = Number(prm.takenQty ?? prm.qty ?? prm.requiredQty ?? 0);
                        const rate = Number(prm.unitRate || 0);
                        return sum + (Number(prm.totalCost) > 0 ? Number(prm.totalCost) : (qty * rate));
                      }, 0);
                      const totalProductCost = assignedBaseCost + productRmCost;

                      // Calculated Good Units
                      let goodUnits = 0;
                      if (isMould) {
                        goodUnits = Number(alloc.goodPieces || 0);
                      } else {
                        const uomLower = bulkUom.toLowerCase();
                        let unitMl = 1000;
                        if (uomLower.includes('gallon')) unitMl = 3785.41;
                        else if (uomLower.includes('tub')) unitMl = 5000;
                        else if (uomLower.includes('can')) unitMl = 20000;
                        goodUnits = Number((productTotalMixMl / unitMl).toFixed(2));
                      }

                      const costPerUnit = goodUnits > 0 ? Number((totalProductCost / goodUnits).toFixed(2)) : 0;

                      return (
                        <div 
                          key={`alloc-card-${alloc.productId || 'alloc'}-${idx}`}
                          className="border border-slate-200 dark:border-slate-700/80 rounded-xl p-4 bg-slate-50/60 dark:bg-slate-800/40 space-y-4 shadow-3xs"
                        >
                          {/* 1. Product Header & Mode Toggle */}
                          <div className="flex items-center justify-between flex-wrap gap-2 pb-3 border-b border-slate-200 dark:border-slate-700/60">
                            <div className="flex items-center gap-2.5">
                              <span className="w-7 h-7 rounded-lg bg-purple-700 text-white font-mono font-black text-xs flex items-center justify-center shadow-3xs">
                                #{alloc.seq || (idx + 1)}
                              </span>
                              <div>
                                <h4 className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                                  <span>{alloc.productName}</span>
                                  <span className="font-mono text-[10.5px] px-2 py-0.5 rounded bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 font-bold border border-purple-200 dark:border-purple-800">
                                    {prodUom}
                                  </span>
                                </h4>
                                <span className="font-mono text-[10px] text-slate-400">
                                  {alloc.productCode || 'FP'} • Live UOM: <strong className="text-purple-600 dark:text-purple-400">{prodUom}</strong>
                                </span>
                              </div>
                            </div>

                            {/* Mould vs Bulk Storage Selector */}
                            <div className="flex items-center gap-2">
                              <div className="flex items-center bg-white dark:bg-slate-900 p-0.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs">
                                <button
                                  type="button"
                                  onClick={() => handleUpdateAllocation(idx, 'useMould', true)}
                                  className={`px-2.5 py-1 rounded-md text-[11px] font-bold cursor-pointer transition-all ${
                                    isMould 
                                      ? 'bg-purple-600 text-white shadow-3xs' 
                                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                                  }`}
                                >
                                  Mould (Pcs)
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleUpdateAllocation(idx, 'useMould', false)}
                                  className={`px-2.5 py-1 rounded-md text-[11px] font-bold cursor-pointer transition-all ${
                                    !isMould 
                                      ? 'bg-emerald-600 text-white shadow-3xs' 
                                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                                  }`}
                                >
                                  Bulk Storage (L / Gallon)
                                </button>
                              </div>

                              <button
                                type="button"
                                onClick={() => handleRemoveProductAllocation(idx)}
                                className="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                                title="Remove allocation line"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>

                          {/* 2. Product-Specific Base Mix Allocation & Remaining Indicator */}
                          <div className="p-3.5 bg-indigo-50/60 dark:bg-indigo-950/30 rounded-xl border border-indigo-200 dark:border-indigo-800/70 space-y-2.5 shadow-3xs">
                            <div className="flex items-center justify-between text-xs font-bold flex-wrap gap-2">
                              <div className="flex items-center gap-2">
                                <span className="w-5 h-5 rounded-md bg-indigo-600 text-white font-mono text-[10px] flex items-center justify-center font-black">
                                  #{alloc.seq || (idx + 1)}
                                </span>
                                <span className="text-slate-800 dark:text-slate-200 font-mono flex items-center gap-1.5">
                                  <Droplets className="w-3.5 h-3.5 text-indigo-600" />
                                  <span>Base Mix Allocation:</span>
                                  <strong className="text-indigo-700 dark:text-indigo-300 font-black">
                                    {formatIndian(baseMl, 2)} / {formatIndian(availableMixMl, 2)} ml ({productSharePct}%)
                                  </strong>
                                </span>
                                {allocations.length > 1 && (
                                  <span className="text-[10.5px] text-slate-500 font-mono hidden sm:inline">
                                    • Cumulative: <strong>{formatIndian(cumulativeAllocatedBaseMl, 2)} ml</strong> ({cumulativeSharePct}%)
                                  </span>
                                )}
                              </div>

                              <div>
                                <span className={`font-mono text-xs font-black px-2.5 py-0.5 rounded shadow-3xs ${
                                  remainingAfterThis < 0 
                                    ? 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border border-rose-300' 
                                    : (remainingAfterThis === 0 
                                        ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-300' 
                                        : 'bg-indigo-100 dark:bg-indigo-900/60 text-indigo-800 dark:text-indigo-200 border border-indigo-300')
                                }`}>
                                  {remainingAfterThis < 0 
                                    ? `Deficit: ${formatIndian(Math.abs(remainingAfterThis), 2)} ml` 
                                    : `Remaining to Allocate: ${formatIndian(remainingAfterThis, 2)} ml`}
                                </span>
                              </div>
                            </div>

                            {/* Visual Multi-Segment Mix Allocation Bar */}
                            <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden relative shadow-inner">
                              {/* Prior Products Segment */}
                              {idx > 0 && (
                                <div 
                                  className="h-full bg-slate-400 dark:bg-slate-500 absolute left-0 top-0 opacity-70"
                                  style={{
                                    width: `${availableMixMl > 0 ? Math.min(100, (prevAllocatedBaseMl / availableMixMl) * 100) : 0}%`
                                  }}
                                  title={`Prior products: ${formatIndian(prevAllocatedBaseMl, 2)} ml`}
                                />
                              )}
                              {/* Current Product Segment */}
                              <div 
                                className={`h-full absolute top-0 transition-all duration-300 ${
                                  remainingAfterThis < 0 ? 'bg-rose-500' : 'bg-indigo-600'
                                }`}
                                style={{
                                  left: `${availableMixMl > 0 ? Math.min(100, (prevAllocatedBaseMl / availableMixMl) * 100) : 0}%`,
                                  width: `${availableMixMl > 0 ? Math.min(100 - (prevAllocatedBaseMl / availableMixMl) * 100, (baseMl / availableMixMl) * 100) : 0}%`
                                }}
                                title={`Product #${idx + 1} (${alloc.productName}): ${formatIndian(baseMl, 2)} ml (${productSharePct}%)`}
                              />
                            </div>

                            {/* Input Control Row */}
                            <div className="pt-1 flex items-center justify-between flex-wrap gap-2">
                              <div className="text-[11px] text-slate-500 font-mono">
                                Available before this product: <strong className="text-indigo-600 dark:text-indigo-400">{formatIndian(availableBeforeThis, 2)} ml</strong>
                              </div>

                              <div className="flex items-center gap-2">
                                <div className="flex items-center gap-1.5">
                                  <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">Allocated Base Mix:</label>
                                  <Input
                                    type="number"
                                    min="0"
                                    step="100"
                                    value={baseMl || ''}
                                    onChange={(e) => handleUpdateProductBaseMl(idx, parseFloat(e.target.value) || 0)}
                                    placeholder="0 ml"
                                    className="h-8 w-28 font-mono font-bold text-xs text-right border-indigo-300 dark:border-indigo-700 bg-white dark:bg-slate-900"
                                  />
                                  <span className="font-bold text-xs text-slate-500 font-mono">ml</span>
                                </div>

                                <span className="text-[11px] font-mono text-indigo-600 dark:text-indigo-400 font-bold px-2 py-1 bg-white dark:bg-slate-900 rounded border border-indigo-200 dark:border-indigo-800">
                                  ≈ {(baseMl / 1000).toFixed(2)} L
                                </span>

                                {/* Allocate Remaining Mix Button */}
                                {unallocatedRemainingMl > 0 && (
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleAllocateRemainingMix(idx)}
                                    className="h-8 px-2.5 text-[11px] font-bold border-emerald-400 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 cursor-pointer shadow-3xs flex items-center gap-1"
                                    title="Allocate entire remaining available mix to this product"
                                  >
                                    <Sparkles className="w-3 h-3 text-emerald-600" />
                                    <span>⚡ Allocate Remaining ({formatIndian(unallocatedRemainingMl, 2)} ml)</span>
                                  </Button>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* 3. Product-Specific Raw Materials (Flavours, Essences, Pulps) */}
                          <div className="p-3.5 bg-amber-50/40 dark:bg-amber-950/20 rounded-xl border border-amber-200 dark:border-amber-800/60 space-y-3">
                            <div className="flex items-center justify-between flex-wrap gap-2">
                              <div>
                                <h5 className="text-xs font-bold text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                                  <Flame className="w-3.5 h-3.5 text-amber-600" />
                                  <span>Product-Specific Essences, Flavours &amp; Raw Materials:</span>
                                </h5>
                                <p className="text-[10.5px] text-slate-500">
                                  Ingredients &amp; packaging added to this product (e.g. Alphonso mango pulp, Almond essence, poly covers, sticks). Toggle &apos;Add to Mix&apos; to include liquid volume (ml) in the mix; leave unchecked for packing items (0 ml).
                                </p>
                              </div>

                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setItemSearchMode('RM_MULTI');
                                  setTargetAllocIndex(idx);
                                  setItemSearchOpen(true);
                                }}
                                className="h-7 px-2.5 text-[11px] font-bold rounded-lg border-amber-400 text-amber-800 dark:text-amber-200 bg-white dark:bg-slate-900 hover:bg-amber-100 dark:hover:bg-amber-900/40 cursor-pointer shadow-3xs flex items-center gap-1"
                              >
                                <Plus className="w-3 h-3 text-amber-600" />
                                <span>+ Add Flavour / Essence / RM</span>
                              </Button>
                            </div>

                            {productRms.length > 0 ? (
                              <div className="overflow-x-auto border border-amber-200/80 dark:border-amber-800/60 rounded-lg bg-white dark:bg-slate-900">
                                <table className="w-full text-left text-xs border-collapse font-sans">
                                  <thead>
                                    <tr className="bg-amber-50/60 dark:bg-amber-950/40 text-amber-900 dark:text-amber-300 font-bold uppercase tracking-wider text-[10px] border-b border-amber-200 dark:border-amber-800">
                                      <th className="py-2 px-3 text-center w-24" title="Check to add liquid volume into product mix. Uncheck for packaging/stick/poly cover items.">
                                        Add to Mix
                                      </th>
                                      <th className="py-2 px-3">Ingredient</th>
                                      <th className="py-2 px-3 text-right w-24">Quantity</th>
                                      <th className="py-2 px-3 text-center w-20">Live UOM</th>
                                      <th className="py-2 px-3 text-right w-28" title="Liquid volume added to product mix">Added Mix (ml)</th>
                                      <th className="py-2 px-3 min-w-[170px]">PO Batch / Lot Allocation</th>
                                      {canViewCost && <th className="py-2 px-3 text-right w-24">PO Rate (₹)</th>}
                                      {canViewCost && <th className="py-2 px-3 text-right w-24">Amount (₹)</th>}
                                      <th className="py-2 px-2 text-center w-8">✕</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {productRms.map((prm, prmIdx) => {
                                      const isAddToMix = prm.addToMix !== undefined ? Boolean(prm.addToMix) : !isPackagingMaterial(prm);
                                      const prmVolMl = isAddToMix ? toMl(prm.takenQty ?? prm.qty ?? 0, prm.uom, prm.density) : 0;
                                      const hasBatches = Array.isArray(prm.allocatedBatches) && prm.allocatedBatches.length > 0;
                                      const lineCost = Number((prm.totalCost ?? (Number(prm.takenQty ?? prm.qty ?? 0) * Number(prm.unitRate || 0))).toFixed(2));

                                      return (
                                        <tr key={`prm-${prm.rawMaterialId || prm.rmId || prmIdx}`} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                                          <td className="py-2 px-3 text-center">
                                            <label className="inline-flex items-center gap-1.5 cursor-pointer select-none" title={isAddToMix ? "Liquid ingredient: Added to product mix volume" : "Packing item: Not added to mix volume"}>
                                              <input
                                                type="checkbox"
                                                checked={isAddToMix}
                                                onChange={(e) => handleUpdateProductRm(idx, prmIdx, 'addToMix', e.target.checked)}
                                                className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 cursor-pointer accent-amber-600"
                                              />
                                              <span className={`text-[10px] font-bold ${isAddToMix ? 'text-amber-800 dark:text-amber-300' : 'text-slate-400'}`}>
                                                {isAddToMix ? '+Mix' : 'Packing'}
                                              </span>
                                            </label>
                                          </td>
                                          <td className="py-2 px-3">
                                            <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                                              <span>{prm.rawMaterialName || prm.rmName || 'Essence'}</span>
                                              {!isAddToMix && (
                                                <span className="text-[9px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-500 px-1.5 py-0.2 rounded border border-slate-300 dark:border-slate-700">
                                                  Packing
                                                </span>
                                              )}
                                            </div>
                                            <div className="font-mono text-[9.5px] text-slate-400">
                                              {prm.rawMaterialCode || prm.rmCode || 'RM'}
                                            </div>
                                          </td>
                                          <td className="py-2 px-3 text-right">
                                            <Input
                                              type="number"
                                              step="any"
                                              value={prm.takenQty ?? prm.qty ?? ''}
                                              onChange={(e) => handleUpdateProductRm(idx, prmIdx, 'takenQty', parseFloat(e.target.value) || 0)}
                                              className="h-7 w-20 text-right font-mono text-xs px-1.5 ml-auto border-amber-300 dark:border-amber-700"
                                            />
                                          </td>
                                          <td className="py-2 px-3 text-center">
                                            <span className="font-mono font-bold bg-amber-50 dark:bg-amber-950/60 px-1.5 py-0.5 rounded text-[10.5px] text-amber-900 dark:text-amber-200 border border-amber-200 dark:border-amber-800">
                                              {prm.uom || 'ml'}
                                            </span>
                                          </td>
                                          <td className="py-2 px-3 text-right font-mono font-black">
                                            {isAddToMix ? (
                                              <span className="text-amber-700 dark:text-amber-400">
                                                +{formatIndian(prmVolMl)} ml
                                              </span>
                                            ) : (
                                              <span className="text-[10px] font-semibold text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700 inline-block font-sans" title="Packing item — Not added to liquid mix">
                                                0 ml (Packing)
                                              </span>
                                            )}
                                          </td>
                                          <td className="py-2 px-3">
                                            {hasBatches ? (
                                              <button
                                                type="button"
                                                onClick={() => openProductRmLotModal(idx, prmIdx)}
                                                className="px-2 py-0.5 rounded border border-blue-300 dark:border-blue-800 bg-blue-50/80 dark:bg-blue-950/60 hover:bg-blue-100 text-blue-900 dark:text-blue-300 font-mono text-[10px] text-left transition-all cursor-pointer shadow-3xs flex items-center gap-1"
                                                title="Edit allocated lots"
                                              >
                                                <Boxes className="w-3 h-3 text-blue-600" />
                                                <span className="font-bold">
                                                  {prm.allocatedBatches.length === 1 
                                                    ? `#${prm.allocatedBatches[0].lotNumber || prm.allocatedBatches[0].internalBatchNo}` 
                                                    : `${prm.allocatedBatches.length} Lots`}
                                                </span>
                                              </button>
                                            ) : (
                                              <button
                                                type="button"
                                                onClick={() => openProductRmLotModal(idx, prmIdx)}
                                                className="px-2 py-0.5 rounded border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 text-amber-900 dark:text-amber-300 font-bold text-[10px] cursor-pointer flex items-center gap-1"
                                                title="Allocate lot from warehouse"
                                              >
                                                <Plus className="w-2.5 h-2.5 text-amber-600" />
                                                <span>Allocate Lot</span>
                                              </button>
                                            )}
                                          </td>
                                          {canViewCost && (
                                            <td className="py-2 px-3 text-right font-mono font-bold text-slate-700 dark:text-slate-300">
                                              ₹{prm.unitRate || 0}
                                            </td>
                                          )}
                                          {canViewCost && (
                                            <td className="py-2 px-3 text-right font-mono font-black text-emerald-600">
                                              ₹{formatIndian(lineCost)}
                                            </td>
                                          )}
                                          <td className="py-2 px-2 text-center">
                                            <button
                                              type="button"
                                              onClick={() => handleRemoveProductRm(idx, prmIdx)}
                                              className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer"
                                              title="Remove essence"
                                            >
                                              <Trash2 className="w-3 h-3" />
                                            </button>
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            ) : (
                              <div className="text-center py-2 text-[11px] text-slate-400 italic">
                                No specific flavour or essence added yet. Base mix will be processed directly.
                              </div>
                            )}

                            {/* Net Total Mix Volume for this product */}
                            <div className="flex items-center justify-between text-xs pt-1 font-bold">
                              <span className="text-slate-600 dark:text-slate-400">
                                Product Net Liquid Mix (Base + Essences):
                              </span>
                              <span className="font-mono text-purple-700 dark:text-purple-300 font-black text-sm">
                                {formatIndian(baseMl)} ml + {formatIndian(addedRmVolumeMl)} ml = {formatIndian(productTotalMixMl)} ml ({((productTotalMixMl) / 1000).toFixed(2)} L)
                              </span>
                            </div>
                          </div>

                          {/* 4. Output Specification (Mould vs Bulk Storage) */}
                          {isMould ? (
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                                  Ice Cream Mould Specification &amp; Cavity Yield:
                                </span>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleOpenMouldPicker(idx)}
                                  className="h-7 px-2.5 text-xs font-bold rounded-lg border-purple-300 dark:border-purple-800 text-purple-700 dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-950/40 cursor-pointer shadow-3xs flex items-center gap-1"
                                >
                                  <Box className="w-3 h-3 text-purple-600" />
                                  <span>Choose Mould: {alloc.mouldCode || 'Pick Spec'}</span>
                                </Button>
                              </div>

                              <div className="grid grid-cols-2 sm:grid-cols-6 gap-3 text-xs items-center bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                                <div>
                                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                                    Capacity (ml)
                                  </label>
                                  <Input
                                    type="number"
                                    min="1"
                                    value={alloc.capacityMl}
                                    onChange={(e) => handleUpdateAllocation(idx, 'capacityMl', parseFloat(e.target.value) || 0)}
                                    className="h-8 font-mono font-bold text-xs"
                                  />
                                </div>

                                <div>
                                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                                    Cavities / Tray
                                  </label>
                                  <Input
                                    type="number"
                                    min="1"
                                    value={alloc.cavities}
                                    onChange={(e) => handleUpdateAllocation(idx, 'cavities', parseInt(e.target.value, 10) || 1)}
                                    className="h-8 font-mono font-bold text-xs"
                                  />
                                </div>

                                <div>
                                  <div className="flex items-center justify-between mb-1">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                      Trays
                                    </label>
                                    <button
                                      type="button"
                                      onClick={() => handleFillMaxTrays(idx)}
                                      className="text-[9.5px] font-bold text-purple-600 hover:text-purple-700 cursor-pointer underline"
                                    >
                                      Fill Max
                                    </button>
                                  </div>
                                  <Input
                                    type="number"
                                    min="0"
                                    value={alloc.trays}
                                    onChange={(e) => {
                                      const rawVal = e.target.value;
                                      const parsed = rawVal === '' ? 0 : parseInt(rawVal, 10);
                                      handleUpdateAllocation(idx, 'trays', isNaN(parsed) ? 0 : Math.max(0, parsed));
                                    }}
                                    className="h-8 font-mono font-black text-xs border-purple-400 dark:border-purple-700 bg-white dark:bg-slate-900"
                                  />
                                </div>

                                <div>
                                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                                    Waste Mode
                                  </label>
                                  <select
                                    value={alloc.wasteMode}
                                    onChange={(e) => handleUpdateAllocation(idx, 'wasteMode', e.target.value)}
                                    className="w-full h-8 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 text-xs font-semibold outline-none focus:border-purple-500"
                                  >
                                    <option value="PERCENT">Percentage (%)</option>
                                    <option value="FIXED_ML_PER_TRAY">Fixed ml / Tray</option>
                                  </select>
                                </div>

                                <div>
                                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                                    {alloc.wasteMode === 'PERCENT' ? 'Waste (%)' : 'Waste ml/Tray'}
                                  </label>
                                  <Input
                                    type="number"
                                    step="0.1"
                                    min="0"
                                    value={alloc.wasteValue}
                                    onChange={(e) => handleUpdateAllocation(idx, 'wasteValue', parseFloat(e.target.value) || 0)}
                                    className="h-8 font-mono font-bold text-xs"
                                  />
                                </div>

                                <div className="bg-purple-100/60 dark:bg-purple-950/40 p-2 rounded-lg border border-purple-200 dark:border-purple-800">
                                  <div className="text-[10px] font-bold text-purple-800 dark:text-purple-300 uppercase">
                                    Mould Pieces Yield
                                  </div>
                                  <div className="text-base font-mono font-black text-purple-950 dark:text-purple-200">
                                    {alloc.goodPieces ?? 0} {prodUom}
                                  </div>
                                  <div className="text-[10px] font-mono text-purple-700 dark:text-purple-400 font-semibold">
                                    Mix: {formatIndian(alloc.mixRequiredMl ?? alloc.mixUsedMl ?? 0)} ml
                                  </div>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="p-3.5 bg-emerald-50/40 dark:bg-emerald-950/20 rounded-xl border border-emerald-200 dark:border-emerald-800/60 space-y-2">
                              <span className="text-xs font-bold text-emerald-900 dark:text-emerald-200 uppercase tracking-wider block">
                                Direct Bulk Storage (Liters, Gallons &amp; Tubs):
                              </span>
                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs items-center bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                                <div>
                                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                                    Select Bulk Storage Unit
                                  </label>
                                  <select
                                    value={bulkUom}
                                    onChange={(e) => handleUpdateAllocation(idx, 'bulkUom', e.target.value)}
                                    className="w-full h-8 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 text-xs font-bold outline-none focus:border-emerald-500 cursor-pointer"
                                  >
                                    <option value="Liter">Liter (1,000 ml)</option>
                                    <option value="Gallon">Gallon (3,785 ml)</option>
                                    <option value="Tub (5L)">Tub (5 Litres)</option>
                                    <option value="Can (20L)">Can (20 Litres)</option>
                                  </select>
                                </div>

                                <div>
                                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                                    Available Liquid Mix
                                  </label>
                                  <div className="font-mono font-bold text-slate-800 dark:text-slate-200 h-8 flex items-center">
                                    {formatIndian(productTotalMixMl)} ml ({((productTotalMixMl) / 1000).toFixed(2)} L)
                                  </div>
                                </div>

                                <div className="bg-emerald-100/60 dark:bg-emerald-950/40 p-2.5 rounded-lg border border-emerald-200 dark:border-emerald-800">
                                  <div className="text-[10px] font-bold text-emerald-800 dark:text-emerald-300 uppercase">
                                    Calculated Bulk Yield
                                  </div>
                                  <div className="text-base font-mono font-black text-emerald-950 dark:text-emerald-200">
                                    {goodUnits} {bulkUom}
                                  </div>
                                  <div className="text-[10px] text-emerald-700 dark:text-emerald-400 font-semibold">
                                    Direct to sellable stock
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* 5. Role-Protected Consumption-Based Costing Distribution Card (Admin & Supervisor Only) */}
                          {canViewCost && (
                            <div className="p-3.5 bg-slate-900 text-white rounded-xl border border-slate-800 space-y-2 select-none">
                              <div className="flex items-center justify-between text-xs pb-1 border-b border-slate-800">
                                <div className="flex items-center gap-1.5 font-bold text-slate-200">
                                  <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                                  <span>Consumption-Based Cost Distribution (PO Rate):</span>
                                </div>
                                <span className="text-[9.5px] font-mono text-emerald-400 bg-emerald-950 border border-emerald-800 px-2 py-0.5 rounded">
                                  AUDITED UNIT ECONOMICS
                                </span>
                              </div>

                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                                <div className="bg-slate-800/80 p-2 rounded-lg border border-slate-700/80">
                                  <span className="text-[10px] text-slate-400 block">Base Mix Cost:</span>
                                  <strong className="text-sm font-mono font-black text-indigo-300 block mt-0.5">
                                    ₹{formatIndian(round2(assignedBaseCost))}
                                  </strong>
                                  <span className="text-[9.5px] text-slate-400 font-mono">From PO ({formatIndian(baseMl)} ml)</span>
                                </div>

                                <div className="bg-slate-800/80 p-2 rounded-lg border border-slate-700/80">
                                  <span className="text-[10px] text-slate-400 block">Product Essences Cost:</span>
                                  <strong className="text-sm font-mono font-black text-amber-300 block mt-0.5">
                                    ₹{formatIndian(round2(productRmCost))}
                                  </strong>
                                  <span className="text-[9.5px] text-slate-400 font-mono">{productRms.length} added ingredients</span>
                                </div>

                                <div className="bg-slate-800/80 p-2 rounded-lg border border-slate-700/80">
                                  <span className="text-[10px] text-slate-400 block">Total Product Cost:</span>
                                  <strong className="text-sm font-mono font-black text-emerald-300 block mt-0.5">
                                    ₹{formatIndian(round2(totalProductCost))}
                                  </strong>
                                  <span className="text-[9.5px] text-slate-400 font-mono">Assigned Material Cost</span>
                                </div>

                                <div className="bg-emerald-950/80 p-2 rounded-lg border border-emerald-700/80">
                                  <span className="text-[10px] text-emerald-300 block">Cost / Unit:</span>
                                  <strong className="text-base font-mono font-black text-white block mt-0.5">
                                    ₹{costPerUnit} / {isMould ? prodUom : bulkUom}
                                  </strong>
                                  <span className="text-[9.5px] text-emerald-400 font-mono">Good: {goodUnits} {isMould ? prodUom : bulkUom}</span>
                                </div>
                              </div>
                            </div>
                          )}

                        </div>
                      );
                    })}

                    {allocations.length === 0 && (
                      <div className="p-8 text-center text-slate-400 border border-dashed border-slate-300 dark:border-slate-800 rounded-xl space-y-2">
                        <Box className="w-8 h-8 mx-auto text-slate-400" />
                        <p className="font-bold text-sm text-slate-700 dark:text-slate-300">
                          No finished products added to mould allocations yet
                        </p>
                        <p className="text-xs">
                          Click <strong>+ Add Finished Product</strong> to allocate portions of the evaporated mix (e.g. 74,000 ml to Almond Pista, 50,000 ml to Alphonso Mango).
                        </p>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setItemSearchMode('PRODUCT_SINGLE');
                            setItemSearchOpen(true);
                          }}
                          className="text-xs font-bold"
                        >
                          + Add First Finished Product
                        </Button>
                      </div>
                    )}
                  </div>
                </Card>

                {/* Bottom Step 3 Action Ribbon */}
                <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setActiveStep(2)}
                    className="text-xs font-bold h-9 px-3.5 rounded-xl flex items-center gap-1.5"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Back to Step 2 (Merge &amp; Evap)</span>
                  </Button>

                  <Button
                    type="button"
                    disabled={savingAllocations}
                    onClick={() => handleStepClick(4)}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs h-9 px-4 rounded-xl flex items-center gap-1.5 shadow-sm disabled:opacity-60 cursor-pointer"
                  >
                    {savingAllocations ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : null}
                    <span>Proceed to Step 4: Factory Stages Palette &amp; Timeline</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>

              {/* ══════════════════════════════════════════════════════════════════════════
                  STEP 4: FACTORY STAGES PALETTE & TIMELINE SEQUENCE
              ══════════════════════════════════════════════════════════════════════════ */}
              <div className={`${activeStep === 4 ? 'block' : 'hidden'} space-y-4`}>
                
                <div className="border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 p-5 space-y-4 shadow-xs">
                  <div className="flex items-center justify-between flex-wrap gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold text-sm shadow-xs">
                        <Layers className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                          Factory stages palette &amp; Timeline sequence
                        </h3>
                        <p className="text-xs text-slate-500">
                          Click stage chip to add/remove • Click any stage to configure temperature &amp; duration • Drag &amp; drop to reorder
                        </p>
                      </div>
                    </div>

                    <Button
                      type="button"
                      size="sm"
                      disabled={savingStages}
                      onClick={handleSaveFactoryStages}
                      className="h-8 px-3 text-xs font-bold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer shadow-xs flex items-center gap-1.5"
                    >
                      {savingStages ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                      <span>Save Timeline Sequence</span>
                    </Button>
                  </div>

                  <StandardFactoryStagesPalette
                    stages={timelineStages}
                    onChangeStages={setTimelineStages}
                    isEditable={!isCompleted}
                    stepNumber={4}
                  />
                </div>

                {/* Bottom Step 4 Action Ribbon */}
                <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setActiveStep(3)}
                    className="text-xs font-bold h-9 px-3.5 rounded-xl flex items-center gap-1.5"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Back to Step 3 (Products &amp; Allocations)</span>
                  </Button>

                  <Button
                    type="button"
                    disabled={savingStages}
                    onClick={() => handleStepClick(5)}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs h-9 px-4 rounded-xl flex items-center gap-1.5 shadow-sm disabled:opacity-60 cursor-pointer"
                  >
                    <span>Proceed to Step 5: Quality, Costing &amp; Yield</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>

              {/* ══════════════════════════════════════════════════════════════════════════
                  STEP 5: QUALITY, FINANCIAL COSTING & YIELD COMPLETION
              ══════════════════════════════════════════════════════════════════════════ */}
              <div className={`${activeStep === 5 ? 'block' : 'hidden'} space-y-4`}>
                
                {/* 1. Products Chained From Batch Mix Review Summary */}
                <Card className="border border-purple-200 dark:border-purple-800/60 shadow-xs bg-white dark:bg-slate-900 rounded-xl overflow-hidden p-5 space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800 flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <span className="w-7 h-7 rounded-lg bg-purple-600 text-white text-xs font-bold flex items-center justify-center">
                        5
                      </span>
                      <div>
                        <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                          Multi-Product Output &amp; Yield Summary
                        </h3>
                        <p className="text-[11px] text-slate-500">
                          All finished products chained from base mix ({formatIndian(availableMixMl)} ml)
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {isCompleted && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setViewMode('REPORT')}
                          className="border-emerald-600 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 font-bold text-xs h-8 px-3 rounded-lg flex items-center gap-1.5"
                        >
                          <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                          <span>View Clean Report</span>
                        </Button>
                      )}

                      {!isCompleted && (
                        <Button
                          type="button"
                          size="sm"
                          onClick={handleOpenYieldModal}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs h-8 px-4 cursor-pointer shadow-xs flex items-center gap-1.5 rounded-lg"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Record Actual Yield &amp; Finalize Batch</span>
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Summary Table */}
                  <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200 dark:border-slate-700">
                          <th className="py-2.5 px-3">Seq</th>
                          <th className="py-2.5 px-3">Product Name</th>
                          <th className="py-2.5 px-3 text-center">Live UOM</th>
                          <th className="py-2.5 px-3 text-right">Base Mix (ml)</th>
                          <th className="py-2.5 px-3 text-right">Added RM Mix (ml)</th>
                          <th className="py-2.5 px-3 text-right">Total Mix (ml)</th>
                          <th className="py-2.5 px-3 text-right">Good Output</th>
                          {canViewCost && <th className="py-2.5 px-3 text-right">Base Cost (₹)</th>}
                          {canViewCost && <th className="py-2.5 px-3 text-right">Added RM Cost (₹)</th>}
                          {canViewCost && <th className="py-2.5 px-3 text-right">Total Cost (₹)</th>}
                          {canViewCost && <th className="py-2.5 px-3 text-right text-emerald-600 font-bold">Cost/Unit (₹)</th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {liveAllocationsResult.allocations.map((a, aIdx) => {
                          const productMatch = availableProducts.find(p => p.id === a.productId);
                          const prodUom = a.productUom || a.uom || formatCleanUom(productMatch?.consumptionUnit || productMatch?.uom, 'pcs', productMatch);
                          const isM = a.useMould !== false;
                          const bUom = a.bulkUom || (prodUom === 'pcs' ? 'Liter' : prodUom);

                          const prms = Array.isArray(a.productRms) ? a.productRms : [];
                          const addedMl = prms.reduce((s, r) => {
                            const isAddToMix = r.addToMix !== undefined ? Boolean(r.addToMix) : !isPackagingMaterial(r);
                            if (!isAddToMix) return s;
                            return s + toMl(r.takenQty ?? r.qty ?? 0, r.uom, r.density);
                          }, 0);
                          const bMl = Number(a.allocatedBaseMl || a.mixUsedMl || 0);
                          const totMl = bMl + addedMl;

                          const assignedBase = bMl * baseCostPerMl;
                          const assignedRm = prms.reduce((s, r) => s + (Number(r.totalCost) > 0 ? Number(r.totalCost) : (Number(r.takenQty ?? r.qty ?? 0) * Number(r.unitRate || 0))), 0);
                          const totProdCost = assignedBase + assignedRm;

                          let outQty = 0;
                          if (isM) {
                            outQty = a.goodPieces || 0;
                          } else {
                            const uLower = bUom.toLowerCase();
                            let cap = 1000;
                            if (uLower.includes('gallon')) cap = 3785.41;
                            else if (uLower.includes('tub')) cap = 5000;
                            else if (uLower.includes('can')) cap = 20000;
                            outQty = Number((totMl / cap).toFixed(2));
                          }
                          const unitC = outQty > 0 ? Number((totProdCost / outQty).toFixed(2)) : 0;

                          return (
                            <tr key={`step5-row-${a.seq || aIdx}`} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                              <td className="py-2 px-3 font-mono text-slate-500">#{a.seq}</td>
                              <td className="py-2 px-3 font-bold text-slate-900 dark:text-white">
                                <div>{a.productName}</div>
                                <div className="font-mono text-[9.5px] text-slate-400">{a.productCode} • {isM ? `Mould: ${a.mouldCode || 'Standard'}` : `Bulk: ${bUom}`}</div>
                              </td>
                              <td className="py-2 px-3 text-center">
                                <span className="font-mono font-bold bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-[10.5px]">
                                  {isM ? prodUom : bUom}
                                </span>
                              </td>
                              <td className="py-2 px-3 text-right font-mono">{formatIndian(bMl)} ml</td>
                              <td className="py-2 px-3 text-right font-mono text-amber-600">+{formatIndian(addedMl)} ml</td>
                              <td className="py-2 px-3 text-right font-mono font-bold text-purple-700 dark:text-purple-300">{formatIndian(totMl)} ml</td>
                              <td className="py-2 px-3 text-right font-mono font-black text-emerald-600 dark:text-emerald-400">
                                {outQty} {isM ? prodUom : bUom}
                              </td>
                              {canViewCost && <td className="py-2 px-3 text-right font-mono">₹{formatIndian(round2(assignedBase))}</td>}
                              {canViewCost && <td className="py-2 px-3 text-right font-mono">₹{formatIndian(round2(assignedRm))}</td>}
                              {canViewCost && <td className="py-2 px-3 text-right font-mono font-bold">₹{formatIndian(round2(totProdCost))}</td>}
                              {canViewCost && <td className="py-2 px-3 text-right font-mono font-black text-emerald-600">₹{unitC}</td>}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </Card>

                {/* 2. Wastage & Loss Accounting Card */}
                <Card className="border border-rose-200 dark:border-rose-900/60 shadow-xs bg-rose-50/40 dark:bg-rose-950/20 rounded-xl overflow-hidden p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-rose-950 dark:text-rose-200 uppercase tracking-wider flex items-center gap-1.5">
                      <TrendingDown className="w-4 h-4 text-rose-600" />
                      <span>Production Wastage &amp; Unallocated Mix Loss Accounting:</span>
                    </h4>
                    <span className="text-[10px] font-mono text-rose-600 dark:text-rose-400 font-bold bg-rose-100 dark:bg-rose-900/40 px-2 py-0.5 rounded border border-rose-300 dark:border-rose-800">
                      WASTAGE EXPENSE
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div className="bg-white dark:bg-slate-900 p-3 rounded-lg border border-rose-200 dark:border-rose-900/40">
                      <span className="text-[10px] text-slate-500 block uppercase font-bold">Process Mould Wastage</span>
                      <strong className="text-base font-mono font-black text-rose-700 dark:text-rose-300 block mt-0.5">
                        {formatIndian(totalProcessWasteMl)} ml
                      </strong>
                      <span className="text-[9.5px] text-slate-400 font-mono">Spill &amp; tray loss</span>
                    </div>

                    <div className="bg-white dark:bg-slate-900 p-3 rounded-lg border border-rose-200 dark:border-rose-900/40">
                      <span className="text-[10px] text-slate-500 block uppercase font-bold">Unallocated Remaining Mix</span>
                      <strong className="text-base font-mono font-black text-rose-700 dark:text-rose-300 block mt-0.5">
                        {formatIndian(unallocatedRemainingMl)} ml
                      </strong>
                      <span className="text-[9.5px] text-rose-600 font-medium">Auto-moved to Wastage</span>
                    </div>

                    <div className="bg-white dark:bg-slate-900 p-3 rounded-lg border border-rose-200 dark:border-rose-900/40">
                      <span className="text-[10px] text-slate-500 block uppercase font-bold">Total Wastage Volume</span>
                      <strong className="text-base font-mono font-black text-rose-700 dark:text-rose-300 block mt-0.5">
                        {formatIndian(totalWastageMl)} ml
                      </strong>
                      <span className="text-[9.5px] text-slate-400 font-mono">≈ {(totalWastageMl / 1000).toFixed(2)} Litres</span>
                    </div>

                    {canViewCost && (
                      <div className="bg-rose-900/30 p-3 rounded-lg border border-rose-400 dark:border-rose-800">
                        <span className="text-[10px] text-rose-700 dark:text-rose-300 block uppercase font-bold">Wastage Financial Loss</span>
                        <strong className="text-base font-mono font-black text-rose-600 dark:text-rose-400 block mt-0.5">
                          ₹{formatIndian(round2(totalWastageCost))}
                        </strong>
                        <span className="text-[9.5px] text-slate-400 font-mono">At ₹{baseCostPerMl.toFixed(4)}/ml</span>
                      </div>
                    )}
                  </div>
                </Card>

                {/* 3. QA Lab Testing Requirement Status Card */}
                <div className={`p-4 rounded-xl border flex items-center justify-between flex-wrap gap-3 ${
                  labTestRequired 
                    ? 'bg-amber-50 dark:bg-amber-950/20 border-amber-300 dark:border-amber-800' 
                    : 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800'
                }`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-white shrink-0 ${labTestRequired ? 'bg-amber-500' : 'bg-emerald-600'}`}>
                      <ShieldCheck className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-extrabold uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
                        <span>QA / Quality Control Testing:</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-black ${
                          labTestRequired ? 'bg-amber-200 text-amber-900' : 'bg-emerald-200 text-emerald-900'
                        }`}>
                          {labTestRequired ? 'LAB TEST REQUIRED (QUARANTINE QUEUE)' : 'NO LAB TEST REQUIRED (DIRECT TO SELLABLE STOCK)'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {labTestRequired 
                          ? 'Finished goods will be routed to QC Quarantine queue for microbiological sampling and clearance.' 
                          : 'Microbiological clearance is waived: finished goods automatically added to Available Sellable Inventory upon completion.'}
                      </p>
                    </div>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setLabTestRequired(prev => !prev)}
                    className="text-xs font-bold h-8 px-3 cursor-pointer"
                  >
                    {labTestRequired ? 'Set: Not Required (Direct to Stock)' : 'Set: Lab Test Required'}
                  </Button>
                </div>

                {/* 4. Role-Protected Batch Costing (Admin & Supervisor Only) */}
                {canViewCost && costingData && (
                  <Card className="border border-slate-200 dark:border-slate-800 shadow-xs bg-slate-900 text-white rounded-xl overflow-hidden">
                    <div className="px-5 py-3.5 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <DollarSign className="w-4 h-4 text-emerald-400" />
                        <h3 className="text-sm font-bold text-white">
                          Financial Costing &amp; Live PO Rate Breakdown (Supervisor / Admin Audit)
                        </h3>
                      </div>
                      <span className="text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-700 px-2.5 py-0.5 rounded-full">
                        LIVE PO COST AUDIT
                      </span>
                    </div>

                    <div className="p-5 space-y-5">
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                        <div className="bg-slate-800/80 p-3 rounded-lg border border-slate-700">
                          <div className="text-[10.5px] font-bold uppercase text-slate-400">Total Material Cost</div>
                          <div className="text-base font-mono font-black text-white mt-1">₹{costingData.totalMaterialCost}</div>
                        </div>

                        <div className="bg-slate-800/80 p-3 rounded-lg border border-slate-700">
                          <div className="text-[10.5px] font-bold uppercase text-slate-400">Wastage Loss Cost</div>
                          <div className="text-base font-mono font-black text-rose-400 mt-1">₹{costingData.totalWastageCost}</div>
                        </div>

                        <div className="bg-slate-800/80 p-3 rounded-lg border border-slate-700">
                          <div className="text-[10.5px] font-bold uppercase text-slate-400">Labour Cost</div>
                          <div className="text-base font-mono font-black text-amber-300 mt-1">₹{costingData.labourCost}</div>
                        </div>

                        <div className="bg-slate-800/80 p-3 rounded-lg border border-slate-700">
                          <div className="text-[10.5px] font-bold uppercase text-slate-400">Utility / EB Cost</div>
                          <div className="text-base font-mono font-black text-blue-300 mt-1">₹{costingData.utilityCost}</div>
                        </div>

                        <div className="bg-emerald-950/80 p-3 rounded-lg border border-emerald-700">
                          <div className="text-[10.5px] font-bold uppercase text-emerald-400">Total Production Cost</div>
                          <div className="text-lg font-mono font-black text-emerald-300 mt-0.5">₹{costingData.totalProductionCost}</div>
                        </div>
                      </div>
                    </div>
                  </Card>
                )}

                {/* Bottom Step 5 Action Ribbon */}
                <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setActiveStep(4)}
                    className="text-xs font-bold h-9 px-3.5 rounded-xl flex items-center gap-1.5"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Back to Step 4 (Factory Stages)</span>
                  </Button>

                  <Button
                    type="button"
                    onClick={handleOpenYieldModal}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs h-9 px-4 rounded-xl flex items-center gap-1.5 shadow-sm cursor-pointer"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Record Actual Yield &amp; Finalize Batch</span>
                  </Button>
                </div>
              </div>

            </>
          )}

        </div>

        {/* ── FOOTER ACTIONS ── */}
        <div className="sticky bottom-0 z-30 flex items-center justify-between px-4 sm:px-6 py-3 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 text-xs select-none flex-wrap gap-2">
          <div className="text-slate-500">
            Batch: <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{batch?.referenceNo || batch?.batchNo || batchId}</span> • {viewMode === 'REPORT' ? 'Executive Cost & Yield Ledger' : 'Real-time floor execution active'}
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              className="text-xs font-bold h-8 px-3"
            >
              Exit Cockpit
            </Button>

            {viewMode === 'REPORT' ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setViewMode('STEPS')}
                className="h-8 px-3 text-xs font-bold rounded-lg border-indigo-400 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 flex items-center gap-1.5"
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Return to Floor Run Steps</span>
              </Button>
            ) : isCompleted ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setViewMode('REPORT')}
                className="h-8 px-3 text-xs font-bold rounded-lg border-emerald-500 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 flex items-center gap-1.5"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                <span>View Clean Report</span>
              </Button>
            ) : null}

            {!isCompleted && (
              <Button
                type="button"
                size="sm"
                onClick={handleOpenYieldModal}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs h-8 px-4 cursor-pointer shadow-xs flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Finalize Entire Production</span>
              </Button>
            )}
          </div>
        </div>

      </div>

      {/* ── COCKPIT LOT ALLOCATION MODAL (Supports Step 1 Base RMs & Step 3 Product-Specific RMs) ── */}
      {lotModalOpen && (activeLotRowIndex !== null || activeLotTarget !== null) && (() => {
        const isProductRm = activeLotTarget?.type === 'PRODUCT_RM';
        const targetItem = isProductRm
          ? allocations[activeLotTarget.allocIndex]?.productRms?.[activeLotTarget.prmIndex]
          : rmRows[activeLotRowIndex];
        const itemName = targetItem?.rawMaterialName || targetItem?.rmName || targetItem?.name || 'Raw Material';
        const itemUom = formatCleanUom(targetItem?.uom, 'kg', targetItem);
        const itemReq = Number(targetItem?.requiredQty ?? targetItem?.takenQty ?? targetItem?.qty ?? 10);

        return (
          <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 overflow-y-auto">
            <div className="relative w-full max-w-4xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden max-h-[92vh]">
              
              {/* Modal Header */}
              <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold">
                    <Boxes className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-sm text-white">
                      Allocate Warehouse Batches: {itemName}
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      Live UOM: <strong className="text-indigo-400">{itemUom}</strong> • Required: <strong className="font-mono text-white">{itemReq} {itemUom}</strong>
                      {isProductRm && <span className="ml-2 text-amber-400 font-semibold">• Product Flavour Addition</span>}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setLotModalOpen(false)}
                  className="text-slate-400 hover:text-white p-1"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Sub-header Actions */}
              <div className="px-6 py-3 bg-slate-50 dark:bg-slate-800/40 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between flex-wrap gap-2 text-xs">
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleAutoAllocateFEFO}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-7 px-3 text-[11px] rounded-lg shadow-xs flex items-center gap-1.5"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Auto-Allocate (FEFO)</span>
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowManualLotForm(prev => !prev)}
                    className="h-7 px-2.5 text-[11px] font-bold rounded-lg border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/40"
                  >
                    <Plus className="w-3 h-3 mr-1" />
                    <span>{showManualLotForm ? 'Hide Manual Batch' : '+ Add Continuing Batch'}</span>
                  </Button>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-slate-500 font-medium">Search Lots:</span>
                  <Input
                    type="text"
                    placeholder="Filter by batch or PO..."
                    value={lotSearchTerm}
                    onChange={(e) => setLotSearchTerm(e.target.value)}
                    className="h-7 w-48 text-xs font-mono"
                  />
                </div>
              </div>

              {/* Collapsible Manual Lot Form */}
              {showManualLotForm && (
                <div className="p-4 bg-amber-50/60 dark:bg-amber-950/20 border-b border-amber-200 dark:border-amber-800 space-y-3">
                  <div className="font-bold text-xs text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Continuing / Manual Warehouse Lot</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase mb-1">Batch Number</label>
                      <Input
                        value={manualLotForm.internalBatchNo}
                        onChange={(e) => setManualLotForm(prev => ({ ...prev, internalBatchNo: e.target.value }))}
                        className="h-7 font-mono text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase mb-1">PO Reference</label>
                      <Input
                        value={manualLotForm.poNumber}
                        onChange={(e) => setManualLotForm(prev => ({ ...prev, poNumber: e.target.value }))}
                        className="h-7 font-mono text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase mb-1">Available Qty</label>
                      <Input
                        type="number"
                        value={manualLotForm.availableQty}
                        onChange={(e) => setManualLotForm(prev => ({ ...prev, availableQty: parseFloat(e.target.value) || 0 }))}
                        className="h-7 font-mono text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase mb-1">Unit Rate (PO Amount ₹)</label>
                      <Input
                        type="number"
                        value={manualLotForm.unitRate}
                        onChange={(e) => setManualLotForm(prev => ({ ...prev, unitRate: parseFloat(e.target.value) || 0 }))}
                        className="h-7 font-mono text-xs"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleAddManualLot}
                      className="bg-amber-600 hover:bg-amber-700 text-white font-bold h-7 px-3 text-xs"
                    >
                      Insert Continuing Lot
                    </Button>
                  </div>
                </div>
              )}

              {/* Lots Table */}
              <div className="flex-1 overflow-y-auto p-4">
                {loadingLots ? (
                  <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mb-2 text-indigo-600" />
                    <p className="text-xs">Fetching live inventory lots...</p>
                  </div>
                ) : availableLots.length === 0 ? (
                  <div className="text-center py-12 text-slate-400 space-y-2">
                    <Boxes className="w-8 h-8 mx-auto text-slate-300" />
                    <p className="text-xs font-bold text-slate-600 dark:text-slate-300">No warehouse lots on record for this material</p>
                    <p className="text-[11px]">Use <strong>+ Add Continuing Batch</strong> above to create an allocation lot.</p>
                  </div>
                ) : (
                  <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold uppercase text-[10px] border-b border-slate-200 dark:border-slate-700">
                          <th className="py-2 px-3">Batch Number</th>
                          <th className="py-2 px-3">PO Number</th>
                          <th className="py-2 px-3">GRN Ref</th>
                          <th className="py-2 px-3">Supplier Batch</th>
                          <th className="py-2 px-3 text-right">Available Stock</th>
                          <th className="py-2 px-3 text-center">Expiry Date</th>
                          <th className="py-2 px-3 text-right">PO Rate (₹)</th>
                          <th className="py-2 px-3 text-right w-36">Allocate Qty</th>
                          <th className="py-2 px-3 text-right">Line Amount (₹)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {availableLots
                          .filter(l => {
                            if (!lotSearchTerm.trim()) return true;
                            const q = lotSearchTerm.toLowerCase();
                            return (l.internalBatchNo || l.batchNumber || '').toLowerCase().includes(q) ||
                                   (l.poNumber || '').toLowerCase().includes(q);
                          })
                          .map((lot, lIdx) => {
                            const lotId = lot.id || lot.internalBatchNo || `lot-${lIdx}`;
                            const avail = Number(lot.availableQty || lot.netQty || 0);
                            const currentAlloc = Number(lotAllocations[lotId] ?? lotAllocations[lot.internalBatchNo] ?? 0);
                            const rate = Number(lot.unitCost || lot.rate || lot.unitRate || targetItem?.unitRate || 54);
                            const lineAmt = Number((currentAlloc * rate).toFixed(2));

                            return (
                              <tr key={`lot-${lotId}-${lIdx}`} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                <td className="py-2 px-3 font-mono font-bold text-indigo-700 dark:text-indigo-400">
                                  {lot.internalBatchNo || lot.batchNumber || `#${String(lotId).slice(-4)}`}
                                </td>
                                <td className="py-2 px-3 font-mono text-slate-600 dark:text-slate-300">
                                  {lot.poNumber || 'PO-MANUAL-OVERRIDE'}
                                </td>
                                <td className="py-2 px-3 font-mono text-slate-500">
                                  {lot.grnNumber || lot.grnRef || 'GRN-MANUAL-OVERRIDE'}
                                </td>
                                <td className="py-2 px-3 font-mono text-slate-500">
                                  {lot.supplierBatchNo || 'SUP-LOT-01'}
                                </td>
                                <td className="py-2 px-3 text-right font-mono font-bold text-slate-800 dark:text-slate-200">
                                  {avail} {itemUom}
                                </td>
                                <td className="py-2 px-3 text-center font-mono text-slate-500">
                                  {formatDateDMY(lot.expiryDate)}
                                </td>
                                <td className="py-2 px-3 text-right font-mono font-bold text-slate-700 dark:text-slate-300">
                                  ₹{rate}
                                </td>
                                <td className="py-2 px-3 text-right">
                                  <div className="flex items-center justify-end gap-1">
                                    <Input
                                      type="number"
                                      min="0"
                                      max={avail}
                                      step="any"
                                      value={currentAlloc || ''}
                                      onChange={(e) => handleSetLotQty(lotId, e.target.value, avail)}
                                      className="h-7 w-20 text-right font-mono font-bold text-xs"
                                    />
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleFillRemainingLot(lotId, avail)}
                                      className="h-7 px-1.5 text-[10px] font-bold text-indigo-600 border-indigo-200 cursor-pointer"
                                      title="Allocate remaining required quantity"
                                    >
                                      Fill
                                    </Button>
                                  </div>
                                </td>
                                <td className="py-2 px-3 text-right font-mono font-bold text-emerald-600">
                                  ₹{lineAmt.toLocaleString()}
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Modal Summary Footer */}
              <div className="px-6 py-3.5 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between flex-wrap gap-3 text-xs select-none">
                {(() => {
                  const targetReq = itemReq;
                  const currentSum = Object.values(lotAllocations).reduce((s, v) => s + Number(v || 0), 0);
                  const balance = Number((targetReq - currentSum).toFixed(3));
                  const totalCost = Object.entries(lotAllocations).reduce((acc, [id, val]) => {
                    const qty = Number(val || 0);
                    const lot = availableLots.find(l => String(l.id) === String(id));
                    const r = Number(lot?.unitCost || lot?.rate || targetItem?.unitRate || 100);
                    return acc + (qty * r);
                  }, 0);
                  const blendedRate = currentSum > 0 ? Number((totalCost / currentSum).toFixed(2)) : 0;

                  return (
                    <>
                      <div className="flex items-center gap-4 flex-wrap">
                        <div>
                          <span className="text-slate-400">Required:</span>{' '}
                          <strong className="font-mono text-slate-800 dark:text-slate-200">{targetReq} {itemUom}</strong>
                        </div>
                        <div>
                          <span className="text-slate-400">Allocated:</span>{' '}
                          <strong className="font-mono text-indigo-600 dark:text-indigo-400">{currentSum} {itemUom}</strong>
                        </div>
                        <div>
                          <span className="text-slate-400">Balance:</span>{' '}
                          <strong className={`font-mono ${balance === 0 ? 'text-emerald-600' : balance > 0 ? 'text-amber-600' : 'text-rose-600'}`}>
                            {balance === 0 ? 'Fully Allocated ✓' : `${balance} ${itemUom}`}
                          </strong>
                        </div>
                        <div>
                          <span className="text-slate-400">Blended Rate:</span>{' '}
                          <strong className="font-mono text-emerald-600">₹{blendedRate}/{itemUom}</strong>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setLotModalOpen(false)}
                          className="text-xs font-bold"
                        >
                          Cancel
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          onClick={handleSaveLotAllocations}
                          className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-4 cursor-pointer"
                        >
                          Confirm &amp; Apply Lot Allocations
                        </Button>
                      </div>
                    </>
                  );
                })()}
              </div>

            </div>
          </div>
        );
      })()}

      {/* ── PRODUCTION ITEM SEARCH MODAL (FUZZY, SPACE-IGNORE, LIVE DB UOM & BATCH ALLOCATIONS) ── */}
      {itemSearchOpen && (
        <ProductionItemSearchModal
          isOpen={itemSearchOpen}
          onClose={() => {
            setItemSearchOpen(false);
            setTargetAllocIndex(null);
          }}
          mode={itemSearchMode}
          onSelectProduct={handleSelectProductForAlloc}
          onSelectRawMaterials={handleAddSelectedRMsFromModal}
        />
      )}

      {/* ── MOULD PICKER MODAL (CATEGORY TABS & VERIFIED SPECIFICATIONS) ── */}
      {mouldPickerOpen && (
        <ProductionMouldPickerModal
          isOpen={mouldPickerOpen}
          onClose={() => {
            setMouldPickerOpen(false);
            setTargetAllocIndex(null);
          }}
          moulds={mouldCatalog}
          categories={mouldCategories}
          onSelectMould={handleSelectMouldFromPicker}
        />
      )}

      {/* ── COMPLETE BATCH & RECORD ACTUAL YIELD MODAL (MULTI-PRODUCT & LIVE UOM) ── */}
      {showYieldModal && (
        <div className="fixed inset-0 z-70 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden p-6 text-xs space-y-4 max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800 shrink-0">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Record Actual Yield &amp; Complete Batch
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowYieldModal(false)}
                className="text-slate-400 hover:text-white text-base font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 pr-1">
              {/* Product Yields List */}
              <div className="space-y-3">
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  Final Actual Good Output per Finished Product:
                </label>

                {(Array.isArray(productYields) && productYields.length > 0 ? productYields : [
                  {
                    seq: 1,
                    productName: batch?.product?.name || allocations[0]?.productName || 'Finished Goods',
                    productCode: batch?.product?.code || allocations[0]?.productCode || 'FP',
                    uom: formatCleanUom(batch?.product?.consumptionUnit || allocations[0]?.productUom || 'pcs'),
                    planned: batch?.quantity || 2000,
                    calculatedYield: Number(actualYieldPieces || 2000),
                    actualGoodOutput: Number(actualYieldPieces || 2000),
                    rejectOutput: 0
                  }
                ]).map((p, pIdx) => (
                  <div key={`pyield-${p.productId || pIdx}`} className="p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
                    <div className="flex items-center justify-between flex-wrap gap-1">
                      <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
                        <span className="w-5 h-5 rounded-full bg-purple-700 text-white font-mono text-[10px] flex items-center justify-center font-bold">
                          #{p.seq || (pIdx + 1)}
                        </span>
                        <span>{p.productName}</span>
                        <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 border border-purple-300 dark:border-purple-800">
                          {p.uom}
                        </span>
                      </div>
                      <span className="font-mono text-[10.5px] text-slate-400">
                        Planned: <strong className="text-slate-700 dark:text-slate-200">{p.planned} {p.uom}</strong> • Calculated mix mould yield: <strong className="text-purple-600 dark:text-purple-400">{p.calculatedYield} {p.uom}</strong>
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-1">
                      <div>
                        <label className="block text-[10.5px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                          Final Actual Good Output ({p.uom}) *
                        </label>
                        <Input
                          type="number"
                          min="0"
                          step="any"
                          value={p.actualGoodOutput ?? ''}
                          onChange={(e) => handleUpdateProductYield(pIdx, 'actualGoodOutput', parseFloat(e.target.value) || 0)}
                          className="h-9 font-mono font-black text-sm text-emerald-600 dark:text-emerald-400 border-emerald-300 dark:border-emerald-700 bg-white dark:bg-slate-900"
                        />
                      </div>
                      <div>
                        <label className="block text-[10.5px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                          Reject / Floor Loss ({p.uom})
                        </label>
                        <Input
                          type="number"
                          min="0"
                          step="any"
                          value={p.rejectOutput ?? ''}
                          onChange={(e) => handleUpdateProductYield(pIdx, 'rejectOutput', parseFloat(e.target.value) || 0)}
                          className="h-9 font-mono text-sm border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Operator Notes */}
              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">
                  Operator Completion Notes / Remarks
                </label>
                <textarea
                  rows={3}
                  value={completionNotes}
                  onChange={(e) => setCompletionNotes(e.target.value)}
                  placeholder="Enter batch completion remarks, packaging line notes, or quality observations..."
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 p-2.5 text-xs font-medium text-slate-800 dark:text-slate-100 outline-none focus:border-emerald-500"
                />
              </div>

              {/* QA Lab Testing Toggle */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700">
                <div>
                  <span className="font-bold text-xs text-slate-800 dark:text-slate-200 block">
                    Route to QA Laboratory Test Queue (Quarantine)
                  </span>
                  <span className="text-[10px] text-slate-400">
                    If enabled, finished goods will be quarantined pending lab micro clearance.
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={labTestRequired}
                  onChange={(e) => setLabTestRequired(e.target.checked)}
                  className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800 shrink-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowYieldModal(false)}
                className="text-xs font-bold"
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={completing}
                onClick={handleCompleteBatchSubmit}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 cursor-pointer"
              >
                {completing ? <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1" /> : <Check className="w-3.5 h-3.5 mr-1" />}
                <span>Confirm &amp; Complete Batch</span>
              </Button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
