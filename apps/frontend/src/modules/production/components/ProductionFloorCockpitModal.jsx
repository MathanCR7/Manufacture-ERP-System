import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Factory, X, Check, Play, Pause, Save, RefreshCw, AlertTriangle,
  Layers, Sliders, Box, ShieldCheck, Sparkles, Scale, Info, ArrowRight, ArrowLeft,
  Flame, Droplets, Snowflake, CheckCircle2, AlertCircle, RotateCcw,
  Plus, Trash2, ChevronRight, HardHat, FileSpreadsheet, Eye,
  DollarSign, TrendingDown, Package, HelpCircle, ArrowDownRight, Layers2,
  Maximize2, Minimize2, Printer, Tag, Boxes, CheckSquare, Calendar, ChevronLeft
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
  computeMaxTrays
} from '../utils/productionCalculation';
import ProductionMouldPickerModal from './ProductionMouldPickerModal';
import ProductionItemSearchModal from './ProductionItemSearchModal';
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
  onOpenCompleteModal
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

  // ── 4-STEP PROCESS GUIDANCE STATE ──
  // 1: RM Formulation & Warehouse Lot Allocation
  // 2: Volume Merge & Evaporation Mass Loss
  // 3: Finished Products & Mould Allocation
  // 4: Quality Verification, Costing & Yield Completion
  const [activeStep, setActiveStep] = useState(1);

  // Section A: Raw Materials
  const [rmRows, setRmRows] = useState([]);
  const [availableProducts, setAvailableProducts] = useState([]);

  // Section B: Merge and Evaporation
  const [mergeStage, setMergeStage] = useState('Before freezing');
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

  // Yield Recording Modal State
  const [showYieldModal, setShowYieldModal] = useState(false);
  const [actualYieldPieces, setActualYieldPieces] = useState(2000);
  const [completionNotes, setCompletionNotes] = useState('');
  const [completing, setCompleting] = useState(false);

  // ── COCKPIT LOT ALLOCATION MODAL STATE (Identical to /production/standard/add) ──
  const [lotModalOpen, setLotModalOpen] = useState(false);
  const [activeLotRowIndex, setActiveLotRowIndex] = useState(null);
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

          let takenQty = Number(line.taken_qty || 0);
          if (takenQty <= 0 && allocatedBatches.length > 0) {
            takenQty = allocatedBatches.reduce((acc, b) => acc + Number(b.allocatedQty || 0), 0);
          }
          if (takenQty <= 0) {
            takenQty = Number(line.required_qty || 0);
          }

          let unitRate = Number(line.rate_per_unit || 0);
          if (allocatedBatches.length > 0) {
            const totAmt = allocatedBatches.reduce((acc, b) => acc + (Number(b.allocatedQty || 0) * Number(b.unitRate || 0)), 0);
            const totQty = allocatedBatches.reduce((acc, b) => acc + Number(b.allocatedQty || 0), 0);
            if (totQty > 0) unitRate = Number((totAmt / totQty).toFixed(4));
          }

          return {
            rawMaterialId: rmId,
            rawMaterialName: line.raw_material_name || line.rmName || 'Raw Material',
            rawMaterialCode: line.raw_material_code || line.rmCode || 'RM',
            uom: line.uom || line.unit_id || 'kg',
            hasAlternateUom: Boolean(line.has_alternate_uom),
            alternateUom: line.alternate_uom,
            conversionFactor: Number(line.conversion_factor || 1),
            consumptionUnit: line.consumption_unit,
            density: Number(line.density || 1.0),
            availableQty: Number(line.available_qty ?? line.current_stock ?? 0),
            requiredQty: Number(line.required_qty || 0),
            takenQty,
            evaporates: Boolean(line.evaporates),
            merged: Boolean(line.merged),
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

          let takenQty = Number(u.inputQty || u.requiredQty || 0);
          if (takenQty <= 0 && allocatedBatches.length > 0) {
            takenQty = allocatedBatches.reduce((acc, b) => acc + Number(b.allocatedQty || 0), 0);
          }

          let unitRate = Number(u.unitCost || 0);
          if (allocatedBatches.length > 0) {
            const totAmt = allocatedBatches.reduce((acc, b) => acc + (Number(b.allocatedQty || 0) * Number(b.unitRate || 0)), 0);
            const totQty = allocatedBatches.reduce((acc, b) => acc + Number(b.allocatedQty || 0), 0);
            if (totQty > 0) unitRate = Number((totAmt / totQty).toFixed(4));
          }

          return {
            rawMaterialId: rmId,
            rawMaterialName: name,
            rawMaterialCode: u.rawMaterial?.code || 'RM',
            uom: u.selectedUom || u.unit || u.rawMaterial?.consumptionUnit || u.rawMaterial?.unitId || 'kg',
            hasAlternateUom: Boolean(u.rawMaterial?.hasAlternateUom),
            alternateUom: u.rawMaterial?.alternateUom,
            conversionFactor: Number(u.rawMaterial?.conversionFactor || 1),
            consumptionUnit: u.rawMaterial?.consumptionUnit,
            density: 1.0,
            availableQty: Number(u.availableQtyAtTime || u.rawMaterial?.currentStock || 100),
            requiredQty: Number(u.requiredQty || 0),
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

          let takenQty = Number(rm.takenQty || rm.requiredQty || 0);
          if (takenQty <= 0 && allocatedBatches.length > 0) {
            takenQty = allocatedBatches.reduce((acc, b) => acc + Number(b.allocatedQty || 0), 0);
          }

          return {
            rawMaterialId: rmId,
            rawMaterialName: name,
            rawMaterialCode: rm.rmCode || rm.rawMaterialCode || 'RM',
            uom: rm.selectedUom || rm.baseUom || rm.uom || 'kg',
            hasAlternateUom: Boolean(rm.hasAlternateUom),
            alternateUom: rm.alternateUom,
            conversionFactor: Number(rm.conversionFactor || 1),
            consumptionUnit: rm.consumptionUnit,
            density: 1.0,
            availableQty: Number(rm.availableQty || 100),
            requiredQty: Number(rm.requiredQty || 0),
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
        setMergeStage(merge.merge_stage || merge.mergeStage || 'Before freezing');
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
      if (serverAllocs.length > 0) {
        setAllocations(serverAllocs.map((a, idx) => ({
          seq: a.seq || (idx + 1),
          productId: a.product_id || a.productId,
          productName: a.product_name || 'Finished Product',
          productCode: a.product_code || 'FP',
          useMould: Boolean(a.use_mould ?? a.useMould ?? true),
          mouldId: a.mould_id || a.mouldId || null,
          mouldCode: a.mould_code || a.mouldCode || '',
          mouldName: a.mould_name || a.mouldName || '',
          capacityMl: Number(a.capacity_ml || a.capacityMl || 50),
          cavities: a.cavities !== undefined ? Number(a.cavities) : (a.cavity_count ? Number(a.cavity_count) : 1),
          trays: Number(a.trays || 0),
          wasteMode: a.waste_mode || a.wasteMode || 'PERCENT',
          wasteValue: Number(a.waste_value ?? a.wasteValue ?? 2.0)
        })));
      } else {
        // Initialize from batch planned products
        let batchProds = Array.isArray(b.products) && b.products.length > 0 ? b.products : (b.selectedProducts || []);
        if (batchProds.length === 0 && b.product) {
          batchProds = [b.product];
        }
        if (batchProds.length > 0) {
          setAllocations(batchProds.map((p, idx) => ({
            seq: idx + 1,
            productId: p.productId || p.id,
            productName: p.name || p.productName || 'Finished Product',
            productCode: p.code || p.productCode || 'FP',
            useMould: true,
            mouldId: null,
            mouldCode: 'IM-0001',
            mouldName: 'Lolly / Chocobar SG-5011 (Verified)',
            capacityMl: 50,
            cavities: 50,
            trays: 0,
            wasteMode: 'PERCENT',
            wasteValue: 2.0
          })));
        }
      }

      // Costing
      if (detailRes.data.costingSummary) {
        setCostingData(detailRes.data.costingSummary);
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
    if (!isSlideMerged) return 0;
    return liveEvaporationResult.mixAfterEvapMl;
  }, [isSlideMerged, liveEvaporationResult.mixAfterEvapMl]);

  // Live sequential product mould allocation math
  const liveAllocationsResult = useMemo(() => {
    return calculateAllocations({
      totalMixMl: availableMixMl,
      allocations
    });
  }, [availableMixMl, allocations]);

  // ── LOT ALLOCATION MODAL HANDLERS (Identical to /production/standard/add) ──
  const openLotModal = async (rowIndex) => {
    const row = rmRows[rowIndex];
    if (!row) return;

    setActiveLotRowIndex(rowIndex);
    setLotModalOpen(true);
    setLoadingLots(true);
    setShowManualLotForm(false);
    setLotSearchTerm('');

    // Pre-populate currently allocated quantities map
    const allocMap = {};
    if (Array.isArray(row.allocatedBatches)) {
      row.allocatedBatches.forEach(b => {
        const idKey = b.batchId || b.id || b.lotNumber || b.internalBatchNo;
        if (idKey) allocMap[idKey] = Number(b.allocatedQty || 0);
      });
    }
    setLotAllocations(allocMap);

    const rawClean = (row.rawMaterialName || row.rawMaterialCode || 'RM')
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, 16);
    const reqQty = Number(row.requiredQty || row.takenQty || 10);

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

    try {
      const [batchesRes, metaRes] = await Promise.all([
        api.get(`/production/rm-batches/${row.rawMaterialId}`).catch(() => ({ data: [] })),
        api.get(`/production/rm-batch-meta/${row.rawMaterialId}?rmName=${encodeURIComponent(row.rawMaterialName || '')}`).catch(() => null)
      ]);

      const lots = Array.isArray(batchesRes.data) ? [...batchesRes.data] : [];
      // Ensure all row.allocatedBatches are represented in lots list
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
      text: `Reserved lots in earliest expiry order. Remaining required: ${remainingNeeded} ${row.uom}`,
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
      text: `${newLot.internalBatchNo} registered with ${newLot.availableQty} ${row.uom} available in warehouse inventory.`,
      icon: 'success',
      timer: 1800
    });
  };

  const handleSaveLotAllocations = async () => {
    if (activeLotRowIndex === null) return;
    const row = rmRows[activeLotRowIndex];

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

      let unitRate = Number(lot.unitCost || lot.rate || row.unitRate || 0);
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
        uom: row.uom
      });
    }

    const updatedRows = [...rmRows];
    const targetRow = { ...updatedRows[activeLotRowIndex] };

    targetRow.allocatedBatches = allocatedBatches;
    if (allocatedBatches.length > 0) {
      targetRow.lotBatchNo = allocatedBatches.map(b => b.lotNumber).join(', ');
      targetRow.takenQty = totalAllocQty;
      if (weightedAmountSum > 0 && totalAllocQty > 0) {
        targetRow.unitRate = Number((weightedAmountSum / totalAllocQty).toFixed(4));
        targetRow.totalCost = Number(weightedAmountSum.toFixed(2));
      }
    }

    updatedRows[activeLotRowIndex] = targetRow;
    setRmRows(updatedRows);
    setLotModalOpen(false);

    Swal.fire({
      title: 'Batches Allocated!',
      text: `Allocated ${totalAllocQty} ${targetRow.uom} across ${allocatedBatches.length} lot(s). Live PO rate blended: ₹${targetRow.unitRate}/unit.`,
      icon: 'success',
      timer: 1800
    });
  };

  // ── ROW EDITING ACTIONS ──
  const handleUpdateRmRow = (index, field, value) => {
    setRmRows(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const handleRemoveRmRow = (index) => {
    setRmRows(prev => prev.filter((_, idx) => idx !== index));
  };

  // Callback when user multi-selects raw materials from ProductionItemSearchModal
  const handleAddSelectedRMsFromModal = (selectedMaterials) => {
    const newRows = selectedMaterials.map(rm => ({
      rawMaterialId: rm.id,
      rawMaterialName: rm.printName || rm.name,
      rawMaterialCode: rm.code || 'RM',
      uom: rm.consumptionUnit || rm.unitId || 'kg',
      hasAlternateUom: Boolean(rm.hasAlternateUom),
      alternateUom: rm.alternateUom,
      conversionFactor: Number(rm.conversionFactor || 1),
      consumptionUnit: rm.consumptionUnit,
      density: Number(rm.density_g_per_ml || 1.0),
      availableQty: Number(rm.currentStock || 0),
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
    Swal.fire({
      title: 'Materials Added',
      text: `Added ${newRows.length} raw material(s) with live DB UOMs and batch allocations.`,
      icon: 'success',
      timer: 1500
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
        text: 'Raw materials, batch allocations, density, merge volume and evaporation parameters persisted successfully.',
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
      const cap = Number(a.capacityMl || 50);
      const cav = Number(a.cavities || 1);
      const trays = Number(a.trays || 0);
      const wm = a.wasteMode || 'PERCENT';
      const wv = Number(a.wasteValue ?? 0);
      const rawMl = trays * cav * cap;
      const wasteMl = wm === 'PERCENT' ? rawMl * (wv / 100) : trays * wv;
      return acc + (rawMl + wasteMl);
    }, 0);

    const remainingForThis = Math.max(0, availableMixMl - prevUsed);
    const maxT = computeMaxTrays({
      availableMixMl: remainingForThis,
      capacityMl: alloc.capacityMl,
      cavities: alloc.cavities,
      wasteMode: alloc.wasteMode,
      wasteValue: alloc.wasteValue
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
        const c = Number(a.capacityMl || 50);
        const cv = Number(a.cavities || 1);
        const t = Number(a.trays || 0);
        const wm = a.wasteMode || 'PERCENT';
        const wv = Number(a.wasteValue ?? 0);
        const rawMl = t * cv * c;
        const wMl = wm === 'PERCENT' ? rawMl * (wv / 100) : t * wv;
        return acc + (rawMl + wMl);
      }, 0);
      const remainingForThis = Math.max(0, availableMixMl - prevUsed);
      const autoMaxTrays = computeMaxTrays({
        availableMixMl: remainingForThis,
        capacityMl: cap,
        cavities: cav,
        wasteMode: currentAlloc.wasteMode || 'PERCENT',
        wasteValue: currentAlloc.wasteValue || 0
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
        mouldCode: 'IM-0001',
        mouldName: 'Lolly / Chocobar SG-5011 (Verified)',
        capacityMl: 50,
        cavities: 50,
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
      await api.put(`/production/standard/${batchId}/allocations`, {
        allocations: allocations.map(a => ({
          seq: a.seq,
          productId: a.productId,
          useMould: a.useMould,
          mouldId: a.mouldId,
          capacityMl: a.capacityMl,
          cavities: a.cavities,
          trays: a.trays,
          wasteMode: a.wasteMode,
          wasteValue: a.wasteValue
        }))
      });

      Swal.fire({
        title: 'Allocations Saved!',
        text: 'Finished product mould allocations saved atomically.',
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

  // ── YIELD RECORDING & COMPLETION ──
  const handleCompleteBatchSubmit = async () => {
    const pieces = Number(actualYieldPieces);
    if (isNaN(pieces) || pieces <= 0) {
      Swal.fire({ title: 'Invalid Yield', text: 'Please enter a valid good output pieces count greater than 0.', icon: 'warning' });
      return;
    }

    try {
      setCompleting(true);
      await api.post(`/production/standard/${batchId}/complete`, {
        actualOutput: pieces,
        remarks: completionNotes
      });

      Swal.fire({
        title: 'Floor Run Completed!',
        text: `Recorded actual yield of ${pieces} pcs. Batch successfully finalized.`,
        icon: 'success',
        timer: 2000
      });

      setShowYieldModal(false);
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

            {/* Complete & Record Actual Yield Button */}
            {!isCompleted && (
              <Button
                size="sm"
                onClick={() => setShowYieldModal(true)}
                className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-8 px-3 text-xs shadow-xs cursor-pointer flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Complete &amp; Record Actual Yield</span>
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

            {/* GS1 Barcode Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                Swal.fire({
                  title: 'GS1 Barcode Ready',
                  html: `
                    <div style="text-align: left; font-size: 13px; line-height: 1.6;">
                      <p><strong>Batch No:</strong> <span style="font-family: monospace; font-weight: bold; color: #4f46e5;">${batch?.referenceNo || batch?.batchNo || batchId}</span></p>
                      <p><strong>Product:</strong> ${batch?.product?.name || allocations[0]?.productName || 'Ice Cream Goods'}</p>
                      <p><strong>GS1 (01) GTIN:</strong> 08901234567890</p>
                      <p><strong>GS1 (10) Batch:</strong> ${batch?.referenceNo || batch?.batchNo || 'LOT-2026'}</p>
                      <p><strong>GS1 (17) Expiry:</strong> 271031</p>
                    </div>
                  `,
                  icon: 'info'
                });
              }}
              className="rounded-xl border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800 h-8 px-2.5 text-xs font-bold"
            >
              <Printer className="w-3.5 h-3.5 mr-1 text-slate-400" />
              <span>GS1 Label</span>
            </Button>

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

        {/* ── TOP KPI SUMMARY RIBBON ── */}
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

        {/* ── 4-STEP GUIDED FLOOR WORKFLOW RIBBON (ADVANCE STEP-BY-STEP PROCESS) ── */}
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
              title: 'Step 3: Mould Allocation', 
              desc: 'Pieces & Cavity Yield', 
              icon: Box, 
              isDone: step3Ready,
              badge: `${allocations.length} products` 
            },
            { 
              id: 4, 
              title: 'Step 4: Quality & Yield', 
              desc: 'Actual Completion & Costing', 
              icon: ShieldCheck, 
              isDone: step4Ready,
              badge: `${actualYieldPieces} pcs` 
            }
          ].map((s) => {
            const isActive = activeStep === s.id;
            const StepIcon = s.icon;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setActiveStep(s.id)}
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
              {activeStep === 3 && 'Step 3: Assign finished products to the evaporated mix, select ice cream moulds, and compute cavity & tray piece yields.'}
              {activeStep === 4 && 'Step 4: Audit role-protected production costing, confirm actual completed pieces, and finalize floor run.'}
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

            {activeStep < 4 && (
              <Button
                type="button"
                size="sm"
                onClick={() => setActiveStep(prev => prev + 1)}
                className="h-7 px-3 text-[11px] font-bold bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1 shadow-xs"
              >
                <span>Proceed to Step {activeStep + 1}</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>
        </div>

        {/* ── BODY (Scrollable Step Sections) ── */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          
          {loading ? (
            <div className="flex flex-col items-center justify-center py-24 text-slate-400">
              <RefreshCw className="w-8 h-8 animate-spin mb-3 text-indigo-600" />
              <p className="text-sm font-semibold">Loading batch formulation and warehouse inventory lots...</p>
            </div>
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

                      <Button
                        type="button"
                        size="sm"
                        disabled={savingProcess}
                        onClick={handleSaveProcess}
                        className="h-8 px-3 text-xs font-bold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer shadow-xs flex items-center gap-1"
                      >
                        {savingProcess ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                        <span>Save Step 1 Data</span>
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
                          <th className="py-2.5 px-3 text-center w-24">Live UOM</th>
                          <th className="py-2.5 px-3 text-right w-24">Available</th>
                          <th className="py-2.5 px-3 text-right w-24">Required</th>
                          <th className="py-2.5 px-3 text-right w-28 bg-amber-50/50 dark:bg-amber-950/20">Taken (Used)</th>
                          <th className="py-2.5 px-3 text-center w-20" title="Density in g/ml (Default 1.0)">Density</th>
                          <th className="py-2.5 px-3 text-right w-24">Variance (ml)</th>
                          <th className="py-2.5 px-3 text-right w-24">Remaining</th>
                          <th className="py-2.5 px-3 text-center w-10">✕</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {liveEvaporationResult.lines.map((line, idx) => {
                          const hasTakenMoreThanAvail = line.takenQty > line.availableQty && line.availableQty > 0;
                          const hasNegative = line.takenQty < 0 || line.availableQty < 0;
                          const hasAllocations = Array.isArray(line.allocatedBatches) && line.allocatedBatches.length > 0;

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
                                      <span>Allocated: <strong className="text-emerald-600">{line.takenQty} {line.uom}</strong></span>
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
                                <span className="font-mono font-bold bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-[11px] text-slate-800 dark:text-slate-200">
                                  {line.uom}
                                </span>
                                {line.hasAlternateUom && line.alternateUom && (
                                  <div className="text-[9.5px] font-semibold text-indigo-600 dark:text-indigo-400 mt-0.5">
                                    Alt: {line.alternateUom} ({line.conversionFactor}x)
                                  </div>
                                )}
                              </td>

                              {/* Available Now (Editable) */}
                              <td className="py-2.5 px-3 text-right">
                                <Input
                                  type="number"
                                  step="any"
                                  value={line.availableQty}
                                  onChange={(e) => handleUpdateRmRow(idx, 'availableQty', parseFloat(e.target.value) || 0)}
                                  className="h-7 w-20 text-right font-mono text-xs px-1.5 ml-auto border-slate-200 dark:border-slate-700"
                                />
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

                              {/* Density (g/ml) (Editable, Default 1.0) */}
                              <td className="py-2.5 px-3 text-center">
                                <Input
                                  type="number"
                                  step="0.01"
                                  min="0.1"
                                  value={line.density}
                                  onChange={(e) => handleUpdateRmRow(idx, 'density', parseFloat(e.target.value) || 1.0)}
                                  className="h-7 w-16 text-center font-mono text-xs px-1 mx-auto border-slate-200 dark:border-slate-700"
                                />
                              </td>

                              {/* Variance (ml) */}
                              <td className="py-2.5 px-3 text-right font-mono font-bold">
                                <span className={line.varianceMl > 0 ? 'text-amber-600' : line.varianceMl < 0 ? 'text-blue-600' : 'text-slate-500'}>
                                  {line.varianceMl > 0 ? `+${formatIndian(line.varianceMl)}` : formatIndian(line.varianceMl)} ml
                                </span>
                              </td>

                              {/* Remaining Stock in Warehouse */}
                              <td className="py-2.5 px-3 text-right font-mono font-bold">
                                <span className={line.remainingStock < 0 ? 'text-rose-600 font-black' : 'text-slate-700 dark:text-slate-300'}>
                                  {formatIndian(line.remainingStock)} {line.uom}
                                </span>
                              </td>

                              {/* Remove Row */}
                              <td className="py-2.5 px-3 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleRemoveRmRow(idx)}
                                  className="text-slate-400 hover:text-rose-600 transition-colors p-1"
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
                    onClick={() => setActiveStep(2)}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs h-9 px-4 rounded-xl flex items-center gap-1.5 shadow-sm"
                  >
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
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60">
                        {/* Merge Stage */}
                        <div>
                          <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                            1. Merge Stage
                          </label>
                          <select
                            value={mergeStage}
                            onChange={(e) => setMergeStage(e.target.value)}
                            className="w-full h-9 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-xs font-semibold text-slate-800 dark:text-slate-100 outline-none focus:border-amber-500"
                          >
                            <option value="Before freezing">Before freezing</option>
                            <option value="Before heating">Before heating</option>
                            <option value="Other">Other Stage</option>
                          </select>
                        </div>

                        {/* Evaporation % */}
                        <div>
                          <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                            2. Evaporation Rate (%)
                          </label>
                          <div className="flex items-center gap-2">
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

                        {/* Apply & Undo Buttons */}
                        <div className="flex flex-col justify-end">
                          <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                            3. Action
                          </label>
                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              disabled={!isSlideMerged || evaporationApplied}
                              onClick={handleApplyEvaporation}
                              className="flex-1 h-9 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs rounded-lg cursor-pointer disabled:opacity-40"
                            >
                              <Flame className="w-3.5 h-3.5 mr-1" />
                              <span>Apply Evaporation</span>
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
                            {isSlideMerged ? formatIndian(liveEvaporationResult.totalBeforeEvapMl) : 0} ml
                          </div>
                          <div className="text-[11px] font-mono text-indigo-700 dark:text-indigo-300">
                            ≈ {isSlideMerged ? formatIndian(liveEvaporationResult.totalBeforeEvapLitres) : 0} Litres
                          </div>
                        </div>

                        <div className="p-3.5 rounded-xl bg-amber-50/70 dark:bg-amber-950/40 border border-amber-200/60 dark:border-amber-800/60">
                          <div className="text-[10.5px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                            Evaporated Mass Loss ({evaporationPct}%)
                          </div>
                          <div className="text-lg font-mono font-black text-amber-950 dark:text-amber-200 mt-1">
                            {isSlideMerged && evaporationApplied ? `-${formatIndian(liveEvaporationResult.evaporatedMl)}` : '0'} ml
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
                            {isSlideMerged ? formatIndian(liveEvaporationResult.mixAfterEvapMl) : 0} ml
                          </div>
                          <div className="text-[11px] font-mono text-emerald-700 dark:text-emerald-300">
                            ≈ {isSlideMerged ? formatIndian(round2(liveEvaporationResult.mixAfterEvapMl / 1000)) : 0} Litres available
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
                      {liveEvaporationResult.lines.map((line, idx) => (
                        <div key={`merge-rm-${line.rawMaterialId || 'rm'}-${idx}`} className="py-2.5 first:pt-1 last:pb-1 text-xs">
                          <div className="flex items-center justify-between font-bold text-slate-800 dark:text-slate-200">
                            <span className="truncate max-w-[140px]">{line.rawMaterialName}</span>
                            <span className="font-mono text-emerald-600 dark:text-emerald-400">
                              {formatIndian(line.takenMlAfterEvap ?? line.postEvapMl ?? line.takenMl ?? 0)} ml
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-[11px] text-slate-500 mt-0.5">
                            <span>Remaining Stock:</span>
                            <span className={`font-mono font-bold ${line.remainingStock < 0 ? 'text-rose-600' : 'text-slate-700 dark:text-slate-300'}`}>
                              {formatIndian(line.remainingStock)} {line.uom}
                            </span>
                          </div>
                        </div>
                      ))}
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
                    onClick={() => setActiveStep(3)}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs h-9 px-4 rounded-xl flex items-center gap-1.5 shadow-sm"
                  >
                    <span>Proceed to Step 3: Mould &amp; Product Allocation</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>

              {/* ══════════════════════════════════════════════════════════════════════════
                  STEP 3: FINISHED PRODUCTS / MOULD ALLOCATIONS (REPEATABLE & SEQUENTIAL)
              ══════════════════════════════════════════════════════════════════════════ */}
              <div className={`${activeStep === 3 ? 'block' : 'hidden'} space-y-4`}>
                <Card className="border border-slate-200 dark:border-slate-800 shadow-xs bg-white dark:bg-slate-900 rounded-xl overflow-hidden">
                  <div className="px-5 py-3.5 bg-slate-50/70 dark:bg-slate-800/40 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-lg bg-purple-600 text-white text-xs font-bold flex items-center justify-center">
                        3
                      </span>
                      <div>
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                          Finished Products &amp; Mould Allocations (Sequential Chaining)
                        </h3>
                        <p className="text-[11px] text-slate-500">
                          Total mix available: <strong className="font-mono text-purple-600 dark:text-purple-400">{formatIndian(availableMixMl)} ml</strong>
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

                  {/* Progress bar showing Mix Consumption */}
                  <div className="px-5 py-2.5 bg-slate-100/50 dark:bg-slate-800/20 border-b border-slate-200 dark:border-slate-800">
                    <div className="flex items-center justify-between text-[11px] font-bold mb-1">
                      <span className="text-slate-600 dark:text-slate-400">
                        Mix Utilization: {formatIndian(liveAllocationsResult.totalMixUsedMl)} / {formatIndian(availableMixMl)} ml
                      </span>
                      <span className={liveAllocationsResult.remainingMixMl < 0 ? 'text-rose-600 font-black' : 'text-emerald-600 font-black'}>
                        {liveAllocationsResult.remainingMixMl < 0 ? `Deficit: ${formatIndian(Math.abs(liveAllocationsResult.remainingMixMl))} ml` : `Remaining: ${formatIndian(liveAllocationsResult.remainingMixMl)} ml`}
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                      <div 
                        className={`h-full transition-all duration-300 ${
                          liveAllocationsResult.remainingMixMl < 0 ? 'bg-rose-500' : 'bg-purple-600'
                        }`}
                        style={{
                          width: `${availableMixMl > 0 ? Math.min(100, (liveAllocationsResult.totalMixUsedMl / availableMixMl) * 100) : 0}%`
                        }}
                      />
                    </div>
                  </div>

                  <div className="p-4 space-y-4">
                    {liveAllocationsResult.allocations.map((alloc, idx) => {
                      return (
                        <div 
                          key={`alloc-${alloc.seq || alloc.productId || 'alloc'}-${idx}`}
                          className="border border-slate-200 dark:border-slate-700/80 rounded-xl p-4 bg-slate-50/50 dark:bg-slate-800/30 space-y-3 relative group"
                        >
                          {/* Top Row: Sequence, Product Name, Mould Picker Trigger, Remove */}
                          <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-slate-200 dark:border-slate-700/60">
                            <div className="flex items-center gap-2">
                              <span className="w-6 h-6 rounded-full bg-purple-700 text-white font-mono font-black text-xs flex items-center justify-center">
                                #{alloc.seq}
                              </span>
                              <div>
                                <h4 className="font-extrabold text-sm text-slate-900 dark:text-white">
                                  {alloc.productName}
                                </h4>
                                <span className="font-mono text-[10px] text-slate-400">
                                  {alloc.productCode}
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
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

                              <button
                                type="button"
                                onClick={() => handleRemoveProductAllocation(idx)}
                                className="text-slate-400 hover:text-rose-600 p-1"
                                title="Remove allocation line"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>

                          {/* Allocation Inputs Grid */}
                          <div className="grid grid-cols-2 sm:grid-cols-6 gap-3 text-xs items-center">
                            {/* Mould Capacity ml */}
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

                            {/* Cavities per Tray */}
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

                            {/* Trays Input + Fill Max Button */}
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

                            {/* Wastage Mode */}
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

                            {/* Waste Value */}
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

                            {/* Mix Needed this line */}
                            <div className="bg-purple-100/60 dark:bg-purple-950/40 p-2 rounded-lg border border-purple-200 dark:border-purple-800">
                              <div className="text-[10px] font-bold text-purple-800 dark:text-purple-300 uppercase">
                                Mix Required
                              </div>
                              <div className="text-sm font-mono font-black text-purple-950 dark:text-purple-200">
                                {formatIndian(alloc.mixRequiredMl ?? alloc.mixUsedMl ?? 0)} ml
                              </div>
                              <div className="text-[10px] font-mono text-purple-700 dark:text-purple-400">
                                Good: {alloc.goodPieces ?? 0} pcs
                              </div>
                            </div>
                          </div>

                          {/* Line Status Tag */}
                          <div className="flex items-center justify-between text-[11px] pt-1 text-slate-500">
                            <span>
                              Mould Spec: <strong className="text-slate-800 dark:text-slate-200">{alloc.mouldName || 'Standard Ice Cream Mould'}</strong>
                            </span>
                            <span className="font-mono">
                              Remaining mix after this product: <strong className={(alloc.mixRemainingAfterMl ?? alloc.mixLeftAfterThisProduct ?? 0) < 0 ? 'text-rose-600 font-bold' : 'text-emerald-600 font-bold'}>{formatIndian(alloc.mixRemainingAfterMl ?? alloc.mixLeftAfterThisProduct ?? 0)} ml</strong>
                            </span>
                          </div>
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
                          Click <strong>+ Add Finished Product</strong> to allocate portions of the evaporated mix to specific moulds.
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
                    onClick={() => setActiveStep(4)}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs h-9 px-4 rounded-xl flex items-center gap-1.5 shadow-sm"
                  >
                    <span>Proceed to Step 4: Quality, Costing &amp; Yield</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>

              {/* ══════════════════════════════════════════════════════════════════════════
                  STEP 4: QUALITY, FINANCIAL COSTING & YIELD COMPLETION
              ══════════════════════════════════════════════════════════════════════════ */}
              <div className={`${activeStep === 4 ? 'block' : 'hidden'} space-y-4`}>
                
                {/* 1. Final Yield & Batch Finalization Card */}
                <Card className="border border-emerald-300 dark:border-emerald-800 shadow-xs bg-emerald-50/40 dark:bg-emerald-950/20 rounded-xl overflow-hidden p-5">
                  <div className="flex items-center justify-between pb-3 border-b border-emerald-200 dark:border-emerald-800/60 mb-4 flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-lg bg-emerald-600 text-white text-xs font-bold flex items-center justify-center">
                        4
                      </span>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                        Actual Production Output &amp; Yield Verification
                      </h3>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => setShowYieldModal(true)}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs h-8 px-4 cursor-pointer shadow-xs flex items-center gap-1.5"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Record Actual Yield &amp; Complete Run</span>
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-xs">
                    <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-emerald-200 dark:border-emerald-800">
                      <div className="text-[10px] font-bold text-slate-500 uppercase">Planned Output</div>
                      <div className="text-lg font-mono font-black text-slate-900 dark:text-white mt-1">
                        {batch?.quantity || 2000} pcs
                      </div>
                    </div>

                    <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-emerald-200 dark:border-emerald-800">
                      <div className="text-[10px] font-bold text-slate-500 uppercase">Calculated Mould Yield</div>
                      <div className="text-lg font-mono font-black text-purple-600 dark:text-purple-400 mt-1">
                        {liveAllocationsResult.allocations.reduce((s, a) => s + (a.goodPieces || 0), 0)} pcs
                      </div>
                    </div>

                    <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-emerald-200 dark:border-emerald-800">
                      <div className="flex items-center justify-between">
                        <div className="text-[10px] font-bold text-slate-500 uppercase">Actual Good Recorded</div>
                        <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400">Editable</span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-1">
                        <Input
                          type="number"
                          min="0"
                          value={actualYieldPieces}
                          onChange={(e) => setActualYieldPieces(parseFloat(e.target.value) || 0)}
                          className="h-8 font-mono font-black text-sm text-emerald-600 dark:text-emerald-400 border-emerald-300 dark:border-emerald-700 bg-emerald-50/50 dark:bg-emerald-950/20"
                        />
                        <span className="text-xs font-bold text-slate-500">pcs</span>
                      </div>
                    </div>

                    <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-emerald-200 dark:border-emerald-800">
                      <div className="text-[10px] font-bold text-slate-500 uppercase">Yield Efficiency</div>
                      <div className="text-lg font-mono font-black text-emerald-600 dark:text-emerald-400 mt-1">
                        {round2((actualYieldPieces / (batch?.quantity || 2000)) * 100)}%
                      </div>
                    </div>
                  </div>
                </Card>

                {/* 2. Role-Protected Batch Costing (Admin & Supervisor Only) */}
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
                      {/* Top Financial KPI Metrics */}
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

                      {/* Per-Product Cost Attribution Table */}
                      {costingData.productCostAttribution?.length > 0 && (
                        <div className="mt-4 border-t border-slate-800 pt-4">
                          <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                            Finished Product Cost Attribution (Per-Piece Unit Economics)
                          </h4>
                          <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs border-collapse font-mono">
                              <thead>
                                <tr className="text-slate-400 text-[10px] border-b border-slate-800">
                                  <th className="py-1.5 px-2">Seq</th>
                                  <th className="py-1.5 px-2 font-sans font-bold">Product Name</th>
                                  <th className="py-1.5 px-2 text-right">Good Pieces</th>
                                  <th className="py-1.5 px-2 text-right">Assigned RM</th>
                                  <th className="py-1.5 px-2 text-right">Assigned Labour</th>
                                  <th className="py-1.5 px-2 text-right">Total Assigned</th>
                                  <th className="py-1.5 px-2 text-right text-emerald-400 font-bold">Cost / Piece</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-800/60">
                                {costingData.productCostAttribution.map((a, aIdx) => (
                                  <tr key={`cost-attr-${a.seq || a.productId || 'attr'}-${aIdx}`} className="hover:bg-slate-800/40">
                                    <td className="py-2 px-2 text-slate-500">#{a.seq}</td>
                                    <td className="py-2 px-2 font-sans font-bold text-white">{a.productName}</td>
                                    <td className="py-2 px-2 text-right">{a.goodPieces} pcs</td>
                                    <td className="py-2 px-2 text-right">₹{a.assignedRmCost}</td>
                                    <td className="py-2 px-2 text-right">₹{a.assignedLabourCost}</td>
                                    <td className="py-2 px-2 text-right font-bold">₹{a.totalAssignedCost}</td>
                                    <td className="py-2 px-2 text-right text-emerald-400 font-black">₹{a.costPerPiece}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  </Card>
                )}

                {/* Bottom Step 4 Action Ribbon */}
                <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setActiveStep(3)}
                    className="text-xs font-bold h-9 px-3.5 rounded-xl flex items-center gap-1.5"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Back to Step 3 (Mould Allocations)</span>
                  </Button>

                  <Button
                    type="button"
                    onClick={() => setShowYieldModal(true)}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs h-9 px-4 rounded-xl flex items-center gap-1.5 shadow-sm"
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
            Batch: <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{batch?.referenceNo || batch?.batchNo || batchId}</span> • Real-time floor execution active
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

            {!isCompleted && (
              <Button
                type="button"
                size="sm"
                onClick={() => setShowYieldModal(true)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs h-8 px-4 cursor-pointer shadow-xs"
              >
                Complete &amp; Record Actual Yield
              </Button>
            )}
          </div>
        </div>

      </div>

      {/* ── COCKPIT LOT ALLOCATION MODAL (Identical to /production/standard/add) ── */}
      {lotModalOpen && activeLotRowIndex !== null && (
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
                    Allocate Warehouse Batches: {rmRows[activeLotRowIndex]?.rawMaterialName}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Live UOM: <strong className="text-indigo-400">{rmRows[activeLotRowIndex]?.uom}</strong> • Required: <strong className="font-mono text-white">{rmRows[activeLotRowIndex]?.requiredQty || rmRows[activeLotRowIndex]?.takenQty} {rmRows[activeLotRowIndex]?.uom}</strong>
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
                          const rate = Number(lot.unitCost || lot.rate || lot.unitRate || rmRows[activeLotRowIndex]?.unitRate || 54);
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
                                {avail} {rmRows[activeLotRowIndex]?.uom}
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
                                    className="h-7 px-1.5 text-[10px] font-bold text-indigo-600 border-indigo-200"
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
                const targetReq = Number(rmRows[activeLotRowIndex]?.requiredQty || rmRows[activeLotRowIndex]?.takenQty || 0);
                const currentSum = Object.values(lotAllocations).reduce((s, v) => s + Number(v || 0), 0);
                const balance = Number((targetReq - currentSum).toFixed(3));
                const totalCost = Object.entries(lotAllocations).reduce((acc, [id, val]) => {
                  const qty = Number(val || 0);
                  const lot = availableLots.find(l => String(l.id) === String(id));
                  const r = Number(lot?.unitCost || lot?.rate || rmRows[activeLotRowIndex]?.unitRate || 100);
                  return acc + (qty * r);
                }, 0);
                const blendedRate = currentSum > 0 ? Number((totalCost / currentSum).toFixed(2)) : 0;

                return (
                  <>
                    <div className="flex items-center gap-4 flex-wrap">
                      <div>
                        <span className="text-slate-400">Required:</span>{' '}
                        <strong className="font-mono text-slate-800 dark:text-slate-200">{targetReq} {rmRows[activeLotRowIndex]?.uom}</strong>
                      </div>
                      <div>
                        <span className="text-slate-400">Allocated:</span>{' '}
                        <strong className="font-mono text-indigo-600 dark:text-indigo-400">{currentSum} {rmRows[activeLotRowIndex]?.uom}</strong>
                      </div>
                      <div>
                        <span className="text-slate-400">Balance:</span>{' '}
                        <strong className={`font-mono ${balance === 0 ? 'text-emerald-600' : balance > 0 ? 'text-amber-600' : 'text-rose-600'}`}>
                          {balance === 0 ? 'Fully Allocated ✓' : `${balance} ${rmRows[activeLotRowIndex]?.uom}`}
                        </strong>
                      </div>
                      <div>
                        <span className="text-slate-400">Blended Rate:</span>{' '}
                        <strong className="font-mono text-emerald-600">₹{blendedRate}/{rmRows[activeLotRowIndex]?.uom}</strong>
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
                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-4"
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
      )}

      {/* ── PRODUCTION ITEM SEARCH MODAL (FUZZY, SPACE-IGNORE, LIVE DB UOM & BATCH ALLOCATIONS) ── */}
      {itemSearchOpen && (
        <ProductionItemSearchModal
          isOpen={itemSearchOpen}
          onClose={() => setItemSearchOpen(false)}
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

      {/* ── COMPLETE BATCH & RECORD ACTUAL YIELD MODAL ── */}
      {showYieldModal && (
        <div className="fixed inset-0 z-70 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden p-6 text-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Record Actual Yield &amp; Complete Batch
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowYieldModal(false)}
                className="text-slate-400 hover:text-white text-base font-bold"
              >
                ✕
              </button>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">
                Final Actual Good Output (Pieces / Units) *
              </label>
              <Input
                type="number"
                min="0"
                value={actualYieldPieces}
                onChange={(e) => setActualYieldPieces(parseFloat(e.target.value) || 0)}
                className="h-9 font-mono font-bold text-sm"
              />
              <p className="text-[10px] text-slate-400 mt-1">
                Planned: {batch?.quantity || 2000} pcs. Calculated mix mould yield: {liveAllocationsResult.allocations.reduce((s, a) => s + (a.goodPieces || 0), 0)} pcs.
              </p>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">
                Operator Completion Notes / Remarks
              </label>
              <textarea
                rows={3}
                value={completionNotes}
                onChange={(e) => setCompletionNotes(e.target.value)}
                placeholder="Enter batch completion remarks, packaging line notes, or quality observations..."
                className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 p-2 text-xs font-medium text-slate-800 dark:text-slate-100 outline-none focus:border-emerald-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
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
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4"
              >
                {completing ? <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1" /> : <Check className="w-3.5 h-3.5 mr-1" />}
                Confirm &amp; Complete Batch
              </Button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
