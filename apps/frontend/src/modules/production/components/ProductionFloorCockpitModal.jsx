import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Factory, X, Check, Play, Pause, Save, RefreshCw, AlertTriangle,
  Layers, Sliders, Box, ShieldCheck, Sparkles, Scale, Info, ArrowRight,
  Flame, Droplets, Snowflake, CheckCircle2, AlertCircle, RotateCcw,
  Plus, Trash2, ChevronRight, HardHat, FileSpreadsheet, Eye,
  DollarSign, TrendingDown, Package, HelpCircle, ArrowDownRight, Layers2,
  Maximize2, Minimize2, Printer, Tag, Boxes, CheckSquare
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
  const [isFullscreen, setIsFullscreen] = useState(false);

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
      if (serverRmLines.length > 0) {
        setRmRows(serverRmLines.map(line => ({
          rawMaterialId: line.raw_material_id || line.rmId,
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
          takenQty: Number(line.taken_qty || 0),
          evaporates: Boolean(line.evaporates),
          merged: Boolean(line.merged),
          unitRate: Number(line.rate_per_unit || 0),
          lotBatchNo: line.lot_batch_no || null,
          availableBatches: line.available_batches || []
        })));
      } else if (Array.isArray(b.rmUsages) && b.rmUsages.length > 0) {
        setRmRows(b.rmUsages.map(u => {
          const name = u.rawMaterial?.name || u.name || 'Raw Material';
          const lowerName = name.toLowerCase();
          const defaultEvap = lowerName.includes('milk') || lowerName.includes('smp') || 
                              lowerName.includes('stabilizer') || lowerName.includes('essence') ||
                              lowerName.includes('flavor');
          return {
            rawMaterialId: u.rmId || u.rawMaterial?.id,
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
            takenQty: Number(u.inputQty || u.requiredQty || 0),
            evaporates: defaultEvap,
            merged: true,
            unitRate: Number(u.unitCost || 0),
            lotBatchNo: null,
            availableBatches: []
          };
        }));
      } else if (Array.isArray(b.rawMaterials) && b.rawMaterials.length > 0) {
        setRmRows(b.rawMaterials.map(rm => {
          const name = rm.rawMaterialName || rm.rmName || rm.name || 'Raw Material';
          const lowerName = name.toLowerCase();
          const defaultEvap = lowerName.includes('milk') || lowerName.includes('smp') || 
                              lowerName.includes('stabilizer') || lowerName.includes('essence') ||
                              lowerName.includes('flavor');
          return {
            rawMaterialId: rm.rmId || rm.rawMaterialId || rm.id,
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
            takenQty: Number(rm.takenQty || rm.requiredQty || 0),
            evaporates: defaultEvap,
            merged: true,
            unitRate: Number(rm.unitRate || rm.rate || 0),
            lotBatchNo: rm.lotBatchNo || (rm.allocatedBatches?.[0]?.batchNo) || null,
            availableBatches: rm.allocatedBatches || []
          };
        }));
      }

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

  // ── LIVE SECTION B CALCULATIONS (Using Shared Calculation Engine) ──
  const liveEvaporationResult = useMemo(() => {
    return calculateEvaporation({
      lines: rmRows,
      evaporationPct,
      mergeStage,
      evaporationApplied
    });
  }, [rmRows, evaporationPct, mergeStage, evaporationApplied]);

  // Available mix for finished products
  const availableMixMl = isSlideMerged ? liveEvaporationResult.mixAfterEvapMl : 0;

  // ── LIVE SECTION C CALCULATIONS (Chained Multi-Product Allocations) ──
  const liveAllocationsResult = useMemo(() => {
    return calculateAllocations({
      availableMixMl,
      allocations
    });
  }, [availableMixMl, allocations]);

  // ── LIFECYCLE ACTIONS: PAUSE / RESUME / COMPLETE ──
  const handlePause = async () => {
    try {
      setActionLoading(true);
      await api.post(`/production/standard/${batchId}/pause`);
      Swal.fire({ title: 'Paused', text: 'Floor run paused successfully.', icon: 'info', timer: 1500 });
      fetchAllData();
      if (onBatchUpdated) onBatchUpdated();
    } catch (err) {
      Swal.fire({ title: 'Error', text: 'Failed to pause production run.', icon: 'error' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleResume = async () => {
    try {
      setActionLoading(true);
      await api.post(`/production/standard/${batchId}/resume`);
      Swal.fire({ title: 'Resumed', text: 'Floor run resumed.', icon: 'success', timer: 1500 });
      fetchAllData();
      if (onBatchUpdated) onBatchUpdated();
    } catch (err) {
      Swal.fire({ title: 'Error', text: 'Failed to resume production run.', icon: 'error' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleCompleteBatchSubmit = async () => {
    try {
      setCompleting(true);
      await api.post(`/production/standard/${batchId}/complete`, {
        actualOutput: Number(actualYieldPieces),
        notes: completionNotes
      });

      setShowYieldModal(false);
      Swal.fire({
        title: 'Batch Completed!',
        text: `Production batch completed with ${formatIndian(actualYieldPieces)} pieces actual yield!`,
        icon: 'success'
      });

      fetchAllData();
      if (onBatchUpdated) onBatchUpdated();
    } catch (err) {
      const msg = err.response?.data?.error || 'Failed to complete batch.';
      Swal.fire({ title: 'Error', text: msg, icon: 'error' });
    } finally {
      setCompleting(false);
    }
  };

  // ── SECTION A: Handlers for Raw Material Line Changes ──
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
  const handleAddSelectedRMsFromModal = (selectedItems) => {
    const newLines = selectedItems.map(rm => ({
      rawMaterialId: rm.id,
      rawMaterialName: rm.printName || rm.name,
      rawMaterialCode: rm.code,
      uom: rm.consumptionUnit || rm.unitId || 'kg',
      hasAlternateUom: Boolean(rm.hasAlternateUom),
      alternateUom: rm.alternateUom,
      conversionFactor: Number(rm.conversionFactor || 1),
      density: Number(rm.density_g_per_ml || 1.0),
      availableQty: Number(rm.currentStock || 0),
      requiredQty: 10,
      takenQty: 10,
      evaporates: Boolean(rm.evaporates_by_default),
      merged: true,
      unitRate: Number(rm.ratePerUnit || 0),
      lotBatchNo: rm.availableBatches?.[0]?.batchNo || null,
      availableBatches: rm.availableBatches || []
    }));

    setRmRows(prev => [...prev, ...newLines]);
    Swal.fire({
      title: 'Added!',
      text: `Added ${selectedItems.length} raw material(s) into this batch.`,
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
        text: 'Raw materials, density, merge volume and evaporation parameters persisted successfully.',
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

  // ── SECTION C: Handlers for Finished Product Allocations ──
  const handleUpdateAllocation = (index, field, value) => {
    setAllocations(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const handleFillAllRemaining = (index) => {
    const alloc = liveAllocationsResult.allocations[index];
    if (!alloc) return;
    const mixBefore = alloc.mixLeftBeforeThisProduct;
    const cap = alloc.capacityMl;
    const cav = alloc.cavities;
    const maxTrays = computeMaxTrays(mixBefore, cap, cav);

    handleUpdateAllocation(index, 'trays', maxTrays);
  };

  const handleOpenMouldPicker = (index) => {
    setTargetAllocIndex(index);
    setMouldPickerOpen(true);
  };

  const handleSelectMouldFromPicker = (selectedMould) => {
    if (targetAllocIndex === null) return;
    const cap = Number(selectedMould.capacity_ml || 50);
    const cav = selectedMould.cavity_count !== null ? Number(selectedMould.cavity_count) : null;

    setAllocations(prev => {
      const copy = [...prev];
      copy[targetAllocIndex] = {
        ...copy[targetAllocIndex],
        mouldId: selectedMould.id,
        mouldCode: selectedMould.mould_code,
        mouldName: selectedMould.mould_name,
        capacityMl: cap,
        cavities: cav !== null ? cav : (copy[targetAllocIndex].cavities || 1)
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

  if (!isOpen) return null;

  const isPaused = batch?.status === 'Paused';
  const isCompleted = batch?.status === 'Completed';

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-2 sm:p-4 overflow-y-auto font-['Plus_Jakarta_Sans',sans-serif] ${isFullscreen ? 'p-0' : ''}`}>
      <div className={`relative w-full ${isFullscreen ? 'h-full max-h-screen rounded-none' : 'max-w-7xl max-h-[96vh] rounded-2xl'} bg-white dark:bg-slate-900 shadow-2xl flex flex-col overflow-hidden border border-slate-200 dark:border-slate-800 transition-all duration-200`}>
        
        {/* ── TOP ACTION BAR (MIRRORING SCREENSHOT 2) ── */}
        <div className="sticky top-0 z-30 flex items-center justify-between px-4 sm:px-6 py-3 bg-slate-900 text-white border-b border-slate-800 select-none shadow-md">
          
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
                {batch?.templateName || 'Standard Formulation'} • {batch?.shift || 'Morning Shift'}
              </div>
            </div>
          </div>

          {/* Center / Action Buttons matching Screenshot 2 */}
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
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 px-6 py-2.5 bg-slate-100 dark:bg-slate-850 border-b border-slate-200 dark:border-slate-800 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-slate-500 font-bold">Planned Output:</span>
            <strong className="font-mono text-slate-900 dark:text-white">{batch?.quantity || 2000} pcs</strong>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-500 font-bold">Pre-Evaporation Mix:</span>
            <strong className="font-mono text-indigo-600 dark:text-indigo-400">
              {formatIndian(liveEvaporationResult.totalBeforeEvapMl)} ml
            </strong>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-500 font-bold">After Evaporation:</span>
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

        {/* ── BODY (Scrollable Sections) ── */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          
          {loading ? (
            <div className="flex flex-col items-center justify-center py-24 text-slate-400">
              <RefreshCw className="w-8 h-8 animate-spin mb-3 text-indigo-600" />
              <p className="text-sm font-semibold">Loading batch formulation and live mould master data...</p>
            </div>
          ) : (
            <>
              {/* ── SECTION A: RAW MATERIALS TABLE WITH LIVE DB UOM, ALT UOM & BATCH ALLOCATION ── */}
              <Card className="border border-slate-200 dark:border-slate-800 shadow-xs bg-white dark:bg-slate-900 rounded-xl overflow-hidden">
                <div className="px-5 py-3.5 bg-slate-50/70 dark:bg-slate-800/40 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-indigo-600 text-white text-xs font-bold flex items-center justify-center">
                      A
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
                      <span>Save Process Data</span>
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
                        <th className="py-2.5 px-3 min-w-[140px]" title="Allocated Batch No from warehouse">Batch / Lot</th>
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

                        return (
                          <tr 
                            key={line.rawMaterialId || idx}
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

                            {/* Batch / Lot Allocation Badge */}
                            <td className="py-2.5 px-3">
                              {line.lotBatchNo ? (
                                <div className="bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 rounded px-1.5 py-0.5 text-[10px] font-mono text-blue-800 dark:text-blue-300 inline-flex items-center gap-1">
                                  <Boxes className="w-3 h-3 text-blue-500" />
                                  <span className="font-bold">#{line.lotBatchNo}</span>
                                </div>
                              ) : line.availableBatches?.length > 0 ? (
                                <div className="bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded px-1.5 py-0.5 text-[10px] font-mono text-slate-700 dark:text-slate-300 inline-flex items-center gap-1">
                                  <span>#{line.availableBatches[0].batchNo}</span>
                                  <span className="text-[9px] text-slate-400">({line.availableBatches[0].remainingQty})</span>
                                </div>
                              ) : (
                                <span className="text-[10px] text-slate-400 italic">Standard Stock</span>
                              )}
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

              {/* ── SECTION B: MERGE AND EVAPORATION COCKPIT ── */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                
                {/* Left (2 cols): Controls & Mix Evaporation Results */}
                <Card className="lg:col-span-2 border border-slate-200 dark:border-slate-800 shadow-xs bg-white dark:bg-slate-900 rounded-xl overflow-hidden">
                  <div className="px-5 py-3.5 bg-slate-50/70 dark:bg-slate-800/40 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-lg bg-amber-500 text-slate-950 text-xs font-bold flex items-center justify-center">
                        B
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
                      <div key={line.rawMaterialId || idx} className="py-2.5 first:pt-1 last:pb-1 text-xs">
                        <div className="flex items-center justify-between font-bold text-slate-800 dark:text-slate-200">
                          <span className="truncate max-w-[140px]">{line.rawMaterialName}</span>
                          <span className="font-mono text-emerald-600 dark:text-emerald-400">
                            {formatIndian(line.takenMlAfterEvap)} ml
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

              {/* ── SECTION C: FINISHED PRODUCTS / MOULD ALLOCATIONS (REPEATABLE & SEQUENTIAL) ── */}
              <Card className="border border-slate-200 dark:border-slate-800 shadow-xs bg-white dark:bg-slate-900 rounded-xl overflow-hidden">
                <div className="px-5 py-3.5 bg-slate-50/70 dark:bg-slate-800/40 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-purple-600 text-white text-xs font-bold flex items-center justify-center">
                      C
                    </span>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      Finished Products &amp; Mould Cavity Sequential Allocation
                    </h3>
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
                      disabled={savingAllocations || !isSlideMerged}
                      onClick={handleSaveAllocations}
                      className="h-8 px-3 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer shadow-xs flex items-center gap-1"
                    >
                      {savingAllocations ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                      <span>Save All Allocations</span>
                    </Button>
                  </div>
                </div>

                <div className="p-5 space-y-4">
                  {allocations.map((alloc, idx) => {
                    const result = liveAllocationsResult.allocations[idx] || {};
                    const isExceeded = (result.mixLeftAfterThisProduct < 0);

                    return (
                      <div 
                        key={alloc.seq || idx}
                        className={`p-4 rounded-xl border transition-all ${
                          isExceeded 
                            ? 'bg-rose-50/60 dark:bg-rose-950/20 border-rose-300 dark:border-rose-800' 
                            : 'bg-slate-50/70 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        {/* Header Row: Product Name & Remove Button */}
                        <div className="flex items-center justify-between pb-3 border-b border-slate-200/80 dark:border-slate-700/80 mb-3">
                          <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold flex items-center justify-center">
                              {alloc.seq}
                            </span>
                            <span className="font-bold text-sm text-slate-900 dark:text-white">
                              {alloc.productName}
                            </span>
                            <span className="text-[10.5px] font-mono text-slate-400">
                              {alloc.productCode || 'FP'}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleRemoveProductAllocation(idx)}
                              className="text-slate-400 hover:text-rose-600 transition-colors p-1"
                              title="Remove Product Allocation"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {/* Allocation Controls Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-3 text-xs">
                          
                          {/* 1. Mould / Specification */}
                          <div className="md:col-span-2">
                            <label className="block text-[10.5px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                              Mould Master Specification
                            </label>
                            <div className="flex items-center gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => handleOpenMouldPicker(idx)}
                                className="flex-1 h-8 text-xs font-bold justify-between border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 truncate"
                              >
                                <span className="truncate">{alloc.mouldName || alloc.mouldCode || 'Select Mould...'}</span>
                                <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0 ml-1" />
                              </Button>
                            </div>
                            <div className="text-[10px] text-slate-500 mt-1 flex items-center gap-2">
                              <span>Cap: <strong>{alloc.capacityMl} ml</strong></span>
                              <span>•</span>
                              <span>Cavities: <strong>{alloc.cavities}</strong></span>
                              <span>•</span>
                              <span>Tray Nominal: <strong>{alloc.capacityMl * alloc.cavities} ml</strong></span>
                            </div>
                          </div>

                          {/* 2. Trays Count & Fill Max Button */}
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <label className="text-[10.5px] font-bold text-slate-500 uppercase tracking-wider">
                                Trays (Sets)
                              </label>
                              <button
                                type="button"
                                onClick={() => handleFillAllRemaining(idx)}
                                className="text-[10px] font-extrabold text-indigo-600 dark:text-indigo-400 hover:underline"
                                title="Calculate max whole trays fitting remaining mix"
                              >
                                Fill Max
                              </button>
                            </div>
                            <Input
                              type="number"
                              min="0"
                              value={alloc.trays}
                              onChange={(e) => handleUpdateAllocation(idx, 'trays', parseInt(e.target.value, 10) || 0)}
                              className="h-8 font-mono font-bold text-xs"
                            />
                          </div>

                          {/* 3. Wastage % or ml */}
                          <div>
                            <label className="block text-[10.5px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                              Wastage (% / ml)
                            </label>
                            <div className="flex items-center gap-1">
                              <Input
                                type="number"
                                min="0"
                                step="0.5"
                                value={alloc.wasteValue}
                                onChange={(e) => handleUpdateAllocation(idx, 'wasteValue', parseFloat(e.target.value) || 0)}
                                className="h-8 font-mono text-xs flex-1"
                              />
                              <select
                                value={alloc.wasteMode}
                                onChange={(e) => handleUpdateAllocation(idx, 'wasteMode', e.target.value)}
                                className="h-8 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-[10.5px] px-1"
                              >
                                <option value="PERCENT">%</option>
                                <option value="FIXED_ML">ml</option>
                              </select>
                            </div>
                          </div>

                          {/* 4. Good Pieces Output */}
                          <div className="bg-emerald-50 dark:bg-emerald-950/40 p-2 rounded-lg border border-emerald-200 dark:border-emerald-800 text-center flex flex-col justify-center">
                            <div className="text-[10px] font-bold uppercase text-emerald-700 dark:text-emerald-300">
                              End Product Yield
                            </div>
                            <div className="text-base font-mono font-black text-emerald-900 dark:text-emerald-100">
                              {formatIndian(result.goodPieces || 0)} pcs
                            </div>
                            <div className="text-[9.5px] font-mono text-emerald-700 dark:text-emerald-300">
                              Waste: {formatIndian(result.wasteMl || 0)} ml
                            </div>
                          </div>

                          {/* 5. Mix Remaining After This Product */}
                          <div className={`p-2 rounded-lg border text-center flex flex-col justify-center ${
                            isExceeded
                              ? 'bg-rose-100 text-rose-900 border-rose-300 dark:bg-rose-950/80 dark:text-rose-200'
                              : 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-200 border-indigo-200 dark:border-indigo-800'
                          }`}>
                            <div className="text-[10px] font-bold uppercase">
                              Mix Remaining
                            </div>
                            <div className="text-base font-mono font-black">
                              {formatIndian(result.mixLeftAfterThisProduct || 0)} ml
                            </div>
                            <div className="text-[9.5px] font-mono">
                              Used: {formatIndian(result.mixUsedMl || 0)} ml
                            </div>
                          </div>

                        </div>
                      </div>
                    );
                  })}

                  {allocations.length === 0 && (
                    <div className="p-8 text-center text-slate-400 space-y-2">
                      <p className="font-semibold text-xs">No finished product allocations added yet.</p>
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

              {/* ── SECTION D: ROLE-PROTECTED BATCH COSTING (ADMIN & SUPERVISOR ONLY) ── */}
              {canViewCost && costingData && (
                <Card className="border border-slate-200 dark:border-slate-800 shadow-xs bg-slate-900 text-white rounded-xl overflow-hidden">
                  <div className="px-5 py-3.5 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-emerald-400" />
                      <h3 className="text-sm font-bold text-white">
                        Financial Costing &amp; PO Rate Breakdown (Supervisor / Admin Only)
                      </h3>
                    </div>
                    <span className="text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-700 px-2.5 py-0.5 rounded-full">
                      AUDIT LEVEL 1
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
                              {costingData.productCostAttribution.map(a => (
                                <tr key={a.seq} className="hover:bg-slate-800/40">
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

            </>
          )}

        </div>

        {/* ── FOOTER ACTIONS ── */}
        <div className="sticky bottom-0 z-30 flex items-center justify-between px-6 py-3.5 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 text-xs select-none">
          <div className="text-slate-500">
            Batch ID: <span className="font-mono">{batchId}</span> • Real-time formula chaining active
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              className="text-xs font-bold"
            >
              Exit Cockpit
            </Button>

            {!isCompleted && (
              <Button
                type="button"
                size="sm"
                onClick={() => setShowYieldModal(true)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs px-4 cursor-pointer shadow-xs"
              >
                Complete &amp; Record Actual Yield
              </Button>
            )}
          </div>
        </div>

      </div>

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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in duration-150">
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
