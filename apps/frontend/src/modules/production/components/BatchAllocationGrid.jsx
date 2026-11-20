import React, { useState, useEffect, useMemo } from 'react';
import { api } from '@/lib/axios';
import { 
  Tag, Boxes, RefreshCw, Plus, Minus, Trash2, Check, AlertTriangle, 
  HelpCircle, Calendar, ShieldCheck, Database, X, ArrowRight, Layers, ArrowLeftRight,
  Search, Edit3, Filter, Copy, Scale, Sparkles, Calculator, Sliders, CheckCircle2,
  AlertCircle, Zap
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import useAuthStore from '@/app/store/authStore';
import Swal from 'sweetalert2';
import ProductionLotAllocationModal from './ProductionLotAllocationModal';

// Helper: Format date as dd-mm-yyyy
const formatDateDMY = (dateVal) => {
  if (!dateVal) return 'dd-mm-yyyy';
  try {
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return 'dd-mm-yyyy';
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
  } catch {
    return 'dd-mm-yyyy';
  }
};

// Safe extractors for Raw Material Category and Description / Storage Notes
const getCategoryName = (item) => {
  if (!item) return '';
  if (typeof item.category === 'object' && item.category !== null) {
    return item.category.name || '';
  }
  return typeof item.category === 'string' ? item.category : (item.categoryName || '');
};

const getDescriptionText = (item) => {
  if (!item) return '';
  return item.description || item.storageNotes || item.notes || '';
};

export default function BatchAllocationGrid({
  rawMaterials = [],
  onUpdateRawMaterials,
  rawMaterialMasters = [],
  onRefreshPrices,
  refreshingPrices = false,
  plannedOutputQty = 100,
  outputUom = 'Nos',
  disabled = false
}) {
  // ── USER ROLE & COSTING VISIBILITY ──
  const currentUser = useAuthStore(s => s.user);
  const isProductionRole = useMemo(() => {
    if (!currentUser) return false;
    const role = (currentUser.role || '').toUpperCase();
    const email = (currentUser.email || '').toLowerCase();
    if (
      role === 'MAIN_MASTER' ||
      role === 'ADMIN' ||
      role === 'SUPERVISOR' ||
      role === 'PURCHASE_ACCOUNTANT' ||
      role === 'ACCOUNTANT' ||
      role.includes('ACCOUNTANT') ||
      role.includes('FINANCE') ||
      email.includes('accountant') ||
      email.includes('finance')
    ) {
      return false;
    }
    return role === 'PRODUCTION_STAFF' || role === 'OPERATOR' || role.includes('PRODUCTION') || email.includes('production');
  }, [currentUser]);
  const canViewCosting = !isProductionRole;

  // ── FETCH / SYNC RAW MATERIAL MASTERS DIRECTLY FROM /item-setup/raw-material ──
  const [itemSetupMasters, setItemSetupMasters] = useState(rawMaterialMasters || []);

  useEffect(() => {
    if (rawMaterialMasters && rawMaterialMasters.length > 0) {
      setItemSetupMasters(rawMaterialMasters);
    } else {
      api.get('/item-setup/raw-material')
        .then(res => {
          if (Array.isArray(res.data)) {
            setItemSetupMasters(res.data);
          }
        })
        .catch(err => console.error('Error fetching raw material masters in BatchAllocationGrid:', err));
    }
  }, [rawMaterialMasters]);

  const mastersMap = useMemo(() => {
    const byId = new Map();
    const byCode = new Map();
    const byName = new Map();
    (itemSetupMasters || []).forEach(m => {
      if (m.id) byId.set(String(m.id).toLowerCase(), m);
      if (m.code) byCode.set(String(m.code).trim().toUpperCase(), m);
      if (m.name) byName.set(String(m.name).trim().toLowerCase(), m);
    });
    return { byId, byCode, byName };
  }, [itemSetupMasters]);

  const findMaster = (row) => {
    if (!row) return null;
    if (row.rmId && mastersMap.byId.has(String(row.rmId).toLowerCase())) {
      return mastersMap.byId.get(String(row.rmId).toLowerCase());
    }
    if (row.id && mastersMap.byId.has(String(row.id).toLowerCase())) {
      return mastersMap.byId.get(String(row.id).toLowerCase());
    }
    if (row.rmCode && mastersMap.byCode.has(String(row.rmCode).trim().toUpperCase())) {
      return mastersMap.byCode.get(String(row.rmCode).trim().toUpperCase());
    }
    if (row.rmName && mastersMap.byName.has(String(row.rmName).trim().toLowerCase())) {
      return mastersMap.byName.get(String(row.rmName).trim().toLowerCase());
    }
    return null;
  };

  // ── LOT ALLOCATION MODAL STATE (MODAL 2) ──
  const [activeItemIndex, setActiveItemIndex] = useState(null);
  const [lotModalOpen, setLotModalOpen] = useState(false);
  const [autoAllocatingAll, setAutoAllocatingAll] = useState(false);

  // ── ADD RAW MATERIAL DIRECTLY MODAL STATE ──
  const [addRmModalOpen, setAddRmModalOpen] = useState(false);
  const [addRmSearchTerm, setAddRmSearchTerm] = useState('');
  const [selectedRmToAdd, setSelectedRmToAdd] = useState(null);
  const [addRmQty, setAddRmQty] = useState(1);
  const [addRmMode, setAddRmMode] = useState('BASE'); // 'BASE' | 'ALT'
  const [addRmRate, setAddRmRate] = useState('');

  const filteredMastersToAdd = useMemo(() => {
    if (!addRmSearchTerm.trim()) return itemSetupMasters || [];
    const q = addRmSearchTerm.toLowerCase();
    return (itemSetupMasters || []).filter(m => {
      const name = String(m.name || '').toLowerCase();
      const code = String(m.code || '').toLowerCase();
      const cat = getCategoryName(m).toLowerCase();
      const desc = getDescriptionText(m).toLowerCase();
      return name.includes(q) || code.includes(q) || cat.includes(q) || desc.includes(q);
    });
  }, [itemSetupMasters, addRmSearchTerm]);

  const handleSelectRmMaster = (master) => {
    setSelectedRmToAdd(master);
    setAddRmQty(1);
    setAddRmMode('BASE');
    setAddRmRate(master.ratePerUnit !== undefined && master.ratePerUnit !== null ? master.ratePerUnit : 0);
  };

  const handleConfirmAddRm = () => {
    if (!selectedRmToAdd) {
      Swal.fire({ title: 'Select Raw Material', text: 'Please select a raw material from the catalogue.', icon: 'warning' });
      return;
    }
    const numQty = parseFloat(addRmQty);
    if (isNaN(numQty) || numQty <= 0) {
      Swal.fire({ title: 'Invalid Quantity', text: 'Please enter a valid required quantity greater than 0.', icon: 'warning' });
      return;
    }

    const master = selectedRmToAdd;
    const hasAlt = Boolean(master.hasAlternateUom && master.alternateUom);
    const rawBase = master.unitId || master.consumptionUnit || 'liter';
    const baseUomClean = (!rawBase || /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawBase)) ? 'units' : rawBase;
    const altUomClean = hasAlt ? master.alternateUom : null;
    const factor = hasAlt ? Number(
      master.conversionFactor ||
      (master.alternateUomQty && master.baseUomQty ? (master.alternateUomQty / master.baseUomQty) : null) ||
      1
    ) : 1;

    const rateNum = Number(addRmRate !== '' ? addRmRate : (master.ratePerUnit || 0));

    let baseQty, altQty, baseRate, altRate, totalCost, unitRate, selectedUom;

    if (addRmMode === 'ALT' && hasAlt) {
      altQty = numQty;
      baseQty = factor > 0 ? Number((numQty / factor).toFixed(4)) : numQty;
      altRate = rateNum;
      baseRate = Number((rateNum * factor).toFixed(4));
      unitRate = altRate;
      selectedUom = altUomClean;
      totalCost = Number((altQty * altRate).toFixed(2));
    } else {
      baseQty = numQty;
      altQty = Number((numQty * factor).toFixed(3));
      baseRate = rateNum;
      altRate = factor > 0 ? Number((rateNum / factor).toFixed(4)) : rateNum;
      unitRate = baseRate;
      selectedUom = baseUomClean;
      totalCost = Number((baseQty * baseRate).toFixed(2));
    }

    const newRow = {
      rmId: master.id,
      rmCode: master.code || 'RM',
      rmName: master.name,
      category: getCategoryName(master),
      description: getDescriptionText(master),
      baseTemplateQty: baseQty,
      baseRequiredQty: baseQty,
      altRequiredQty: altQty,
      requiredQty: addRmMode === 'ALT' ? altQty : baseQty,
      baseUom: baseUomClean,
      selectedUom: selectedUom,
      activeEntryMode: addRmMode === 'ALT' ? 'ALT' : 'BASE',
      unitRate: unitRate,
      baseRate: baseRate,
      altRate: altRate,
      rateSource: 'PO_LATEST',
      isOverhead: false,
      totalCost: totalCost,
      allocatedBatches: [],
      hasAlternateUom: hasAlt,
      alternateUom: altUomClean,
      baseUomQty: master.baseUomQty || 1,
      alternateUomQty: master.alternateUomQty || 1,
      conversionFactor: factor,
      isDirectlyAdded: true
    };

    onUpdateRawMaterials([...rawMaterials, newRow]);
    setAddRmModalOpen(false);
    setSelectedRmToAdd(null);
    setAddRmSearchTerm('');

    Swal.fire({
      title: 'Raw Material Added!',
      text: `${master.name} added to formulation. You can now click "Allocate Lots" to assign batch stock.`,
      icon: 'success',
      timer: 1600,
      showConfirmButton: false
    });
  };

  // ── MANUAL OVERRIDE LOT FORM STATE ──
  const [showManualOverrideForm, setShowManualOverrideForm] = useState(false);
  const [overrideForm, setOverrideForm] = useState({
    internalBatchNo: 'BATCH-MILKFAT4-001',
    grnNumber: 'GRN-OPENING',
    poNumber: 'PO-OPENING',
    batchQty: 1,
    weight: '25 kg / 50',
    availableQty: 4840,
    supplierBatchNo: 'BATCH-01',
    mfgDate: '01-10-2026',
    expiryDate: '01-10-2027',
    supplierName: 'SUP-LOT-DIRECT'
  });

  // ── ROW UOM DROPDOWN CHANGE ──
  const handleUomModeChange = (index, targetMode) => {
    const updated = [...rawMaterials];
    const row = { ...updated[index] };
    const master = findMaster(row);
    const hasAlt = Boolean(master ? (master.hasAlternateUom && master.alternateUom) : (row.hasAlternateUom && row.alternateUom));
    if (!hasAlt) return;

    const rawBase = (master?.unitId || master?.consumptionUnit || row.baseUom || row.selectedUom || 'liter');
    const baseUom = (!rawBase || /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawBase)) ? 'units' : rawBase;
    const altUom = master?.alternateUom || row.alternateUom;
    const factor = Number(
      master?.conversionFactor || 
      (master && master.alternateUomQty && master.baseUomQty ? (master.alternateUomQty / master.baseUomQty) : null) ||
      row.conversionFactor || 
      (row.alternateUomQty && row.baseUomQty ? (row.alternateUomQty / row.baseUomQty) : 1) ||
      1
    );

    const baseRate = Number(row.baseRate !== undefined ? row.baseRate : (master?.ratePerUnit !== undefined ? master.ratePerUnit : (row.unitRate || 0)));
    const altRate = factor > 0 ? Number((baseRate / factor).toFixed(4)) : baseRate;

    // Canonical base quantity
    const baseQty = Number(row.baseRequiredQty !== undefined ? row.baseRequiredQty : (row.requiredQty || 0));
    const altQty = Number((baseQty * factor).toFixed(3));

    if (targetMode === 'ALT') {
      row.activeEntryMode = 'ALT';
      row.selectedUom = altUom;
      row.requiredQty = altQty;
      row.baseRequiredQty = baseQty;
      row.altRequiredQty = altQty;
      row.unitRate = altRate;
      row.baseRate = baseRate;
      row.altRate = altRate;
      row.conversionFactor = factor;
      row.baseUom = baseUom;
      row.alternateUom = altUom;
      row.hasAlternateUom = true;
      row.totalCost = Number((altQty * altRate).toFixed(2));
    } else {
      row.activeEntryMode = 'BASE';
      row.selectedUom = baseUom;
      row.requiredQty = baseQty;
      row.baseRequiredQty = baseQty;
      row.altRequiredQty = altQty;
      row.unitRate = baseRate;
      row.baseRate = baseRate;
      row.altRate = altRate;
      row.conversionFactor = factor;
      row.baseUom = baseUom;
      row.alternateUom = altUom;
      row.hasAlternateUom = true;
      row.totalCost = Number((baseQty * baseRate).toFixed(2));
    }

    updated[index] = row;
    onUpdateRawMaterials(updated);
  };

  // ── ROW QUANTITY CHANGE ──
  const handleQtyChange = (index, value, mode = 'BASE') => {
    const updated = [...rawMaterials];
    const row = { ...updated[index] };
    const master = findMaster(row);
    const cleanStr = typeof value === 'string' ? value.replace(/^0+(?=\d)/, '') : value;
    const num = Number(cleanStr || 0);

    const rawBase = (master?.unitId || master?.consumptionUnit || row.baseUom || row.selectedUom || 'liter');
    const baseUom = (!rawBase || /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawBase)) ? 'units' : rawBase;
    const altUom = master?.alternateUom || row.alternateUom;
    const factor = Number(
      master?.conversionFactor || 
      (master && master.alternateUomQty && master.baseUomQty ? (master.alternateUomQty / master.baseUomQty) : null) ||
      row.conversionFactor || 
      (row.alternateUomQty && row.baseUomQty ? (row.alternateUomQty / row.baseUomQty) : 1) ||
      1
    );

    const baseRate = Number(row.baseRate !== undefined ? row.baseRate : (master?.ratePerUnit !== undefined ? master.ratePerUnit : (row.unitRate || 0)));
    const altRate = factor > 0 ? Number((baseRate / factor).toFixed(4)) : baseRate;

    if (mode === 'ALT') {
      const calculatedBase = factor > 0 ? Number((num / factor).toFixed(4)) : num;
      row.activeEntryMode = 'ALT';
      row.selectedUom = altUom;
      row.requiredQty = num;
      row.altRequiredQty = num;
      row.baseRequiredQty = calculatedBase;
      row.unitRate = altRate;
      row.baseRate = baseRate;
      row.altRate = altRate;
      row.conversionFactor = factor;
      row.totalCost = Number((num * altRate).toFixed(2));
    } else {
      const calculatedAlt = Number((num * factor).toFixed(3));
      row.activeEntryMode = 'BASE';
      row.selectedUom = baseUom;
      row.requiredQty = num;
      row.baseRequiredQty = num;
      row.altRequiredQty = calculatedAlt;
      row.unitRate = baseRate;
      row.baseRate = baseRate;
      row.altRate = altRate;
      row.conversionFactor = factor;
      row.totalCost = Number((num * baseRate).toFixed(2));
    }

    updated[index] = row;
    onUpdateRawMaterials(updated);
  };

  // ── ROW RATE CHANGE ──
  const handleRateChange = (index, value, mode = 'BASE') => {
    const updated = [...rawMaterials];
    const row = { ...updated[index] };
    const master = findMaster(row);
    const cleanStr = typeof value === 'string' ? value.replace(/^0+(?=\d)/, '') : value;
    const r = Number(cleanStr || 0);

    const factor = Number(
      master?.conversionFactor || 
      (master && master.alternateUomQty && master.baseUomQty ? (master.alternateUomQty / master.baseUomQty) : null) ||
      row.conversionFactor || 
      (row.alternateUomQty && row.baseUomQty ? (row.alternateUomQty / row.baseUomQty) : 1) ||
      1
    );

    if (mode === 'ALT') {
      const calculatedBaseRate = Number((r * factor).toFixed(4));
      row.altRate = r;
      row.baseRate = calculatedBaseRate;
      row.unitRate = r;
      row.rateSource = 'MANUAL_OVERRIDE';
      const currentAltQty = Number(row.altRequiredQty !== undefined ? row.altRequiredQty : (row.requiredQty || 0));
      row.totalCost = Number((currentAltQty * r).toFixed(2));
    } else {
      const calculatedAltRate = factor > 0 ? Number((r / factor).toFixed(4)) : r;
      row.baseRate = r;
      row.altRate = calculatedAltRate;
      row.unitRate = r;
      row.rateSource = 'MANUAL_OVERRIDE';
      const currentBaseQty = Number(row.baseRequiredQty !== undefined ? row.baseRequiredQty : (row.requiredQty || 0));
      row.totalCost = Number((currentBaseQty * r).toFixed(2));
    }

    updated[index] = row;
    onUpdateRawMaterials(updated);
  };

  // ── DELETE ROW ──
  const handleDeleteRow = (index) => {
    const updated = rawMaterials.filter((_, i) => i !== index);
    onUpdateRawMaterials(updated);
  };
  // ── LOT ALLOCATION MODAL LOGIC ──
  const openLotModal = (index) => {
    setActiveItemIndex(index);
    setLotModalOpen(true);
  };

  const handleConfirmLotAllocations = ({
    allocatedBatches,
    totalAllocatedBase,
    totalAllocatedAlt,
    blendedBaseRate,
    blendedAltRate,
    totalCost,
    activeUomMode
  }) => {
    if (activeItemIndex === null) return;
    const updated = [...rawMaterials];
    const row = { ...updated[activeItemIndex] };
    row.allocatedBatches = allocatedBatches;

    if (allocatedBatches.length > 0 && totalAllocatedBase > 0) {
      row.baseRate = blendedBaseRate;
      row.altRate = blendedAltRate;
      row.unitRate = row.activeEntryMode === 'ALT' ? blendedAltRate : blendedBaseRate;
      row.totalCost = totalCost;
    } else {
      const currentRate = row.activeEntryMode === 'ALT' ? (row.altRate || row.unitRate) : (row.baseRate || row.unitRate);
      const currentQty = row.activeEntryMode === 'ALT' ? (row.altRequiredQty || row.requiredQty) : (row.baseRequiredQty || row.requiredQty);
      row.totalCost = Number((Number(currentQty || 0) * Number(currentRate || 0)).toFixed(2));
    }

    updated[activeItemIndex] = row;
    onUpdateRawMaterials(updated);
    setLotModalOpen(false);
  };

  // ── AUTO-ALLOCATE ALL RAW MATERIALS (FIFO) ──
  const handleAutoAllocateAllFifo = async () => {
    if (rawMaterials.length === 0) return;
    setAutoAllocatingAll(true);
    try {
      const updated = [...rawMaterials];
      let allocatedCount = 0;

      for (let i = 0; i < updated.length; i++) {
        const row = { ...updated[i] };
        const rId = row.rmId || row.id || row.rawMaterialId;
        if (!rId) continue;

        const master = findMaster(row);
        const factor = Number(master?.conversionFactor || row.conversionFactor || 1000);
        const isAlt = row.activeEntryMode === 'ALT';
        const targetReq = isAlt
          ? Number(row.altRequiredQty || row.requiredQty || 0)
          : Number(row.baseRequiredQty || row.requiredQty || 0);

        if (targetReq <= 0) continue;

        try {
          const res = await api.get(`/production/rm-batches/${rId}`);
          const rawLots = Array.isArray(res.data) ? res.data : [];
          const lots = rawLots.filter(l => Number(l.availableQty ?? l.netQty ?? 0) > 0.0001 && l.status !== 'DEPLETED');
          lots.sort((a, b) => {
            const tA = a.expiryDate ? new Date(a.expiryDate).getTime() : Infinity;
            const tB = b.expiryDate ? new Date(b.expiryDate).getTime() : Infinity;
            return tA - tB;
          });

          if (lots.length > 0) {
            let rem = targetReq;
            const assignedBatches = [];
            let weightedSum = 0;
            let totalBase = 0;

            for (const lot of lots) {
              if (rem <= 0.0001) break;
              const baseAvail = Number(lot.availableQty ?? lot.netQty ?? 0);
              const lotAvailInMode = isAlt ? (baseAvail * factor) : baseAvail;
              if (lotAvailInMode > 0) {
                const takeInMode = Math.min(lotAvailInMode, rem);
                const baseTake = isAlt ? (takeInMode / factor) : takeInMode;
                const altTake = isAlt ? takeInMode : (baseTake * factor);
                const rate = Number(lot.unitCost || lot.rate || lot.unitRate || row.baseRate || row.unitRate || 0);

                assignedBatches.push({
                  batchId: lot.id,
                  lotNumber: lot.internalBatchNo,
                  internalBatchNo: lot.internalBatchNo,
                  supplierBatchNo: lot.supplierBatchNo || 'BATCH-01',
                  mfgBatchNo: lot.mfgBatchNo || 'BATCH-01',
                  batchQty: lot.batchQty ?? 1,
                  weight: lot.weight || '25 kg / 50',
                  mfgDate: lot.mfgDate || null,
                  expiryDate: lot.expiryDate || null,
                  grnNumber: lot.grnNumber || lot.grnRef || null,
                  poNumber: lot.poNumber || lot.poReferenceNo || null,
                  allocatedQty: Number(baseTake.toFixed(4)),
                  allocatedAltQty: Number(altTake.toFixed(3)),
                  availableQty: baseAvail,
                  remainingQty: Number(Math.max(0, baseAvail - baseTake).toFixed(4)),
                  unitRate: rate,
                  uom: row.baseUom || 'units',
                  altUom: row.alternateUom || null,
                  isManualOverride: false,
                  source: 'PURCHASE_GRN'
                });

                weightedSum += (baseTake * rate);
                totalBase += baseTake;
                rem = Math.max(0, Number((rem - takeInMode).toFixed(4)));
              }
            }

            if (assignedBatches.length > 0) {
              row.allocatedBatches = assignedBatches;
              if (totalBase > 0) {
                const blendedBaseRate = Number((weightedSum / totalBase).toFixed(4));
                const blendedAltRate = factor > 0 ? Number((blendedBaseRate / factor).toFixed(4)) : blendedBaseRate;
                row.baseRate = blendedBaseRate;
                row.altRate = blendedAltRate;
                row.unitRate = isAlt ? blendedAltRate : blendedBaseRate;
                row.totalCost = Number(weightedSum.toFixed(2));
              }
              updated[i] = row;
              allocatedCount++;
            }
          }
        } catch (_) {}
      }

      onUpdateRawMaterials(updated);
      Swal.fire({
        title: 'FIFO Auto-Allocation Complete',
        text: `Allocated live FIFO inventory batches for ${allocatedCount} raw material(s).`,
        icon: 'success',
        timer: 1800
      });
    } catch (err) {
      console.error('Error auto-allocating all FIFO:', err);
    } finally {
      setAutoAllocatingAll(false);
    }
  };

  // Derived state for the selected raw material in add modal
  const selectedCatName = getCategoryName(selectedRmToAdd);
  const selectedDescText = getDescriptionText(selectedRmToAdd);
  const selectedBaseUomClean = selectedRmToAdd?.unitId || selectedRmToAdd?.consumptionUnit || 'liter';

  return (
    <div className="space-y-4">

      {/* Header bar with total raw materials cost and live refresh button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800">
        <div>
          <h4 className="text-xs font-black text-slate-800 dark:text-slate-100 flex items-center gap-1.5 uppercase tracking-wider">
            <Boxes className="w-4 h-4 text-indigo-500" />
            Raw Material Formulation & Batch Allocation
          </h4>
          <p className="text-[11px] text-slate-400">
            Formulation units fetched from Item Setup (/setup/raw-material). Select Base or Alternate UOM with live conversions & FEFO inventory lots.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled || autoAllocatingAll || rawMaterials.length === 0}
            onClick={handleAutoAllocateAllFifo}
            className="h-8 text-xs font-bold rounded-xl border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/80 hover:bg-emerald-100 text-emerald-700 dark:text-emerald-300 cursor-pointer flex items-center gap-1.5 shadow-2xs"
            title="Auto-allocate live warehouse batches using FIFO for all raw materials in this formulation"
          >
            <Zap className={`w-3.5 h-3.5 text-emerald-600 ${autoAllocatingAll ? 'animate-pulse' : ''}`} />
            <span>{autoAllocatingAll ? 'Allocating...' : 'Auto-Allocate FIFO'}</span>
          </Button>

          <Button
            type="button"
            onClick={() => {
              setAddRmModalOpen(true);
              setSelectedRmToAdd(null);
              setAddRmSearchTerm('');
            }}
            disabled={disabled}
            className="h-8 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer flex items-center gap-1.5 shadow-2xs"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Raw Material
          </Button>

          {onRefreshPrices && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled || refreshingPrices}
              onClick={onRefreshPrices}
              className="h-8 text-xs font-bold rounded-xl border-indigo-200 dark:border-indigo-800 hover:bg-indigo-50 text-indigo-600 dark:text-indigo-400 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${refreshingPrices ? 'animate-spin' : ''}`} />
              Sync Live PO Rates
            </Button>
          )}
        </div>
      </div>

      {/* Empty State when no raw materials in formulation yet */}
      {rawMaterials.length === 0 && (
        <div className="p-8 text-center bg-white dark:bg-slate-900 border border-dashed border-slate-300 dark:border-slate-800 rounded-3xl space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto shadow-2xs">
            <Boxes className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
              No Raw Materials in Formulation Yet
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
              You can add raw materials directly using the button below or select a production template above.
            </p>
          </div>
          <Button
            type="button"
            onClick={() => {
              setAddRmModalOpen(true);
              setSelectedRmToAdd(null);
              setAddRmSearchTerm('');
            }}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-9 px-4 rounded-xl shadow-xs cursor-pointer inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Raw Material
          </Button>
        </div>
      )}

      {/* Formulation Table - Preserved 100% Intact for Desktop (hidden lg:block) */}
      <div className="hidden lg:block overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
        <table className="w-full text-xs text-left">
          <thead className="bg-slate-100/80 dark:bg-slate-800/80 text-[10px] font-black uppercase tracking-wider text-slate-500 border-b border-slate-200 dark:border-slate-700">
            <tr>
              <th className="py-2.5 px-3 w-10 text-center">#</th>
              <th className="py-2.5 px-3 min-w-[200px]">Raw Material</th>
              <th className="py-2.5 px-3 w-40 text-center">
                <div>Required Qty</div>
                <div className="text-[8px] text-amber-600 dark:text-amber-400 font-mono font-bold lowercase tracking-normal">
                  (Single Pcs Consumption)
                </div>
              </th>
              <th className="py-2.5 px-3 w-36 text-center">UOM / Alternate</th>
              <th className="py-2.5 px-3 min-w-[220px]">Assigned Lots</th>
              {canViewCosting && <th className="py-2.5 px-3 w-28 text-right">Rate (₹)</th>}
              {canViewCosting && <th className="py-2.5 px-3 w-28 text-right">Total (₹)</th>}
              <th className="py-2.5 px-3 w-10 text-center"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
            {rawMaterials.map((row, index) => {
              const master = findMaster(row);

              // STRICT RULE:
              // "if alternate uom should enable then only display alternate uom in only if enable in this setup raw material page and also fetch uom from that page"
              const hasAlt = Boolean(
                master
                  ? (master.hasAlternateUom && master.alternateUom)
                  : (row.hasAlternateUom && row.alternateUom)
              );

              const rawBase = (master?.unitId || master?.consumptionUnit || row.baseUom || row.selectedUom || 'liter');
              const baseUomClean = (!rawBase || /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawBase))
                ? (row.selectedUom && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(row.selectedUom) ? row.selectedUom : 'units')
                : rawBase;

              const rawAlt = hasAlt ? (master?.alternateUom || row.alternateUom) : null;
              const altUomClean = (rawAlt && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawAlt))
                ? rawAlt
                : null;

              const factor = hasAlt ? Number(
                master?.conversionFactor ||
                (master && master.alternateUomQty && master.baseUomQty ? (master.alternateUomQty / master.baseUomQty) : null) ||
                row.conversionFactor ||
                (row.alternateUomQty && row.baseUomQty ? (row.alternateUomQty / row.baseUomQty) : 1) ||
                1
              ) : 1;

              const isAltMode = Boolean(hasAlt && (row.activeEntryMode === 'ALT'));
              const allocatedList = Array.isArray(row.allocatedBatches) ? row.allocatedBatches : [];

              // Canonical base quantity
              const baseQty = Number(row.baseRequiredQty !== undefined ? row.baseRequiredQty : (row.requiredQty || 0));
              const altQty = Number((baseQty * factor).toFixed(3));

              const baseRate = Number(row.baseRate !== undefined ? row.baseRate : (master?.ratePerUnit !== undefined ? master.ratePerUnit : (row.unitRate || 0)));
              const altRate = Number(row.altRate !== undefined ? row.altRate : (factor > 0 ? (baseRate / factor) : baseRate));

              const displayQty = isAltMode ? (row.altRequiredQty !== undefined ? Number(row.altRequiredQty) : altQty) : baseQty;
              const displayRate = isAltMode ? altRate : baseRate;

              return (
                <tr 
                  key={row.rmId || row.id || index}
                  className="hover:bg-slate-50/70 dark:hover:bg-slate-850 transition-colors"
                >
                  {/* Row Index */}
                  <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-400">
                    {index + 1}
                  </td>

                  {/* Material Name, Category, UOM & Description/Storage Notes */}
                  <td className="py-2.5 px-3">
                    {(() => {
                      const catName = getCategoryName(master) || getCategoryName(row);
                      const descText = getDescriptionText(master) || getDescriptionText(row);
                      return (
                        <>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <div className="font-bold text-slate-900 dark:text-white">
                              {row.rmName}
                            </div>
                            {catName && (
                              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/60">
                                {catName}
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] font-mono text-slate-400 flex items-center gap-1.5 flex-wrap mt-0.5">
                            <span>{row.rmCode || 'RM'}</span>
                            <span>•</span>
                            <span className="text-slate-600 dark:text-slate-300 font-semibold">UOM: {baseUomClean}</span>
                            {hasAlt && altUomClean && (
                              <span
                                className="text-[9px] px-1.5 py-0.5 rounded bg-indigo-50/90 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 font-semibold border border-indigo-200 dark:border-indigo-800 flex items-center gap-1 select-none"
                                title={`Alternate UOM from Item Setup: 1 ${baseUomClean} = ${Number(factor).toLocaleString()} ${altUomClean}`}
                              >
                                <Scale className="w-2.5 h-2.5 text-indigo-500 shrink-0" />
                                <span>1 {baseUomClean} = {Number(factor).toLocaleString()} {altUomClean}</span>
                              </span>
                            )}
                          </div>
                          {descText && (
                            <div 
                              className="mt-1 text-[10px] text-amber-800 dark:text-amber-300 bg-amber-50/80 dark:bg-amber-950/40 px-2 py-0.5 rounded-md border border-amber-200/60 dark:border-amber-900/40 flex items-center gap-1.5 max-w-md"
                              title={`Description / Storage Notes: ${descText}`}
                            >
                              <span className="font-bold shrink-0 text-amber-900 dark:text-amber-200">Storage Notes:</span>
                              <span className="truncate">{descText}</span>
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </td>

                  {/* Quantity Input with Live Dual Preview */}
                  <td className="py-2.5 px-3 text-center">
                    <div className="flex flex-col items-center">
                      <Input
                        type="number"
                        step="any"
                        min="0"
                        disabled={disabled}
                        value={displayQty === 0 || displayQty === '0' ? '' : displayQty}
                        placeholder="0"
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => handleQtyChange(index, e.target.value, isAltMode ? 'ALT' : 'BASE')}
                        onBlur={(e) => {
                          if (!e.target.value) handleQtyChange(index, 0, isAltMode ? 'ALT' : 'BASE');
                        }}
                        className={`h-8 text-center font-mono font-bold text-xs rounded-lg transition-all ${
                          isAltMode
                            ? 'border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-400 bg-indigo-50/20'
                            : 'text-slate-900 dark:text-white'
                        }`}
                      />
                      {hasAlt && altUomClean && (
                        <span className="text-[9px] font-mono text-slate-400 block pt-0.5">
                          {isAltMode ? (
                            <span>≈ {baseQty.toLocaleString()} {baseUomClean} (Base)</span>
                          ) : (
                            <span className="text-indigo-600 dark:text-indigo-400">≈ {altQty.toLocaleString()} {altUomClean} (Alt)</span>
                          )}
                        </span>
                      )}

                      <div className="mt-1 flex items-center justify-center gap-1">
                        <span 
                          className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200/60 dark:border-amber-800/60"
                          title="Calculated single-piece raw material consumption for this batch"
                        >
                          {(Number(plannedOutputQty) > 0 ? (baseQty / Number(plannedOutputQty)) : 0).toFixed(4)} {baseUomClean} / {outputUom || 'pc'}
                        </span>
                      </div>
                    </div>
                  </td>

                  {/* UOM Dropdown (Only if Alternate UOM enabled) - NO DIALOG BOX */}
                  <td className="py-2.5 px-3 text-center">
                    {hasAlt && altUomClean ? (
                      <div className="flex flex-col items-center gap-1">
                        {/* Dropdown with Base and Alternate UOM */}
                        <select
                          disabled={disabled}
                          value={isAltMode ? 'ALT' : 'BASE'}
                          onChange={(e) => handleUomModeChange(index, e.target.value)}
                          className="text-[11px] font-bold font-mono bg-indigo-50/80 dark:bg-indigo-950/70 border border-indigo-200 dark:border-indigo-800 rounded-lg px-2 py-1 text-indigo-700 dark:text-indigo-300 focus:outline-none focus:ring-1.5 focus:ring-indigo-500 cursor-pointer shadow-3xs hover:bg-indigo-100/70 transition-all"
                          title="Select Active Unit of Measure for this raw material line"
                        >
                          <option value="BASE">
                            {baseUomClean} (Base)
                          </option>
                          <option value="ALT">
                            {altUomClean} (Alt)
                          </option>
                        </select>

                        {/* Static non-clickable ratio equation badge */}
                        <span
                          className="inline-flex items-center gap-1 text-[9px] font-mono font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/80 px-1.5 py-0.5 rounded border border-slate-200/80 dark:border-slate-700/80 select-none"
                          title={`Conversion Ratio from Item Setup: 1 ${baseUomClean} = ${Number(factor).toLocaleString()} ${altUomClean}`}
                        >
                          <Scale className="w-2.5 h-2.5 text-indigo-500 shrink-0" />
                          <span>1 {baseUomClean} = {Number(factor).toLocaleString()} {altUomClean}</span>
                        </span>
                      </div>
                    ) : (
                      <span className="font-mono font-bold text-slate-700 dark:text-slate-300 text-xs px-2.5 py-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
                        {baseUomClean}
                      </span>
                    )}
                  </td>

                  {/* Batch Allocation Display */}
                  <td className="py-2.5 px-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      {allocatedList.length > 0 ? (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {allocatedList.map((b, bIdx) => (
                            <span 
                              key={b.batchId || bIdx}
                              className={`inline-flex items-center gap-1.5 font-mono text-[10px] font-bold px-2.5 py-1 rounded-lg border shadow-2xs ${
                                b.isManualOverride
                                  ? 'text-amber-800 dark:text-amber-300 bg-amber-50/80 dark:bg-amber-950/70 border-amber-300 dark:border-amber-700'
                                  : 'text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/80 border border-indigo-200 dark:border-indigo-800'
                              }`}
                              title={`Our Batch: ${b.lotNumber} | ${b.isManualOverride ? 'MANUAL OVERRIDE LOT | ' : ''}PO: ${b.poNumber || 'N/A'} | GRN: ${b.grnNumber || 'N/A'} | Exp: ${formatDateDMY(b.expiryDate)}`}
                            >
                              <Tag className="w-2.5 h-2.5 text-indigo-500" />
                              <span>{b.lotNumber}</span>
                              {b.isManualOverride && (
                                <span className="text-[8.5px] px-1 py-0.2 rounded font-black uppercase tracking-wider bg-amber-200 text-amber-900 dark:bg-amber-900 dark:text-amber-200 border border-amber-300">
                                  Override
                                </span>
                              )}
                              <span className="text-[9px] text-indigo-900 dark:text-indigo-200 font-black">
                                ({isAltMode && (b.allocatedAltQty || (b.allocatedQty && factor)) ? (
                                  `${b.allocatedAltQty || Number((b.allocatedQty * factor).toFixed(2)).toLocaleString()} ${altUomClean} / ${b.allocatedQty} ${baseUomClean}`
                                ) : (
                                  `${b.allocatedQty} ${baseUomClean}${hasAlt && altUomClean ? ` / ${Number((b.allocatedQty * factor).toFixed(2)).toLocaleString()} ${altUomClean}` : ''}`
                                )}
                                {b.availableQty ? ` • Rem: ${Number(Math.max(0, Number(b.availableQty) - Number(b.allocatedQty)).toFixed(3))} ${baseUomClean}` : ''})
                              </span>
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-[10px] text-slate-400 italic">
                          No lot allocated (General warehouse)
                        </span>
                      )}

                      {!disabled && !row.isOverhead && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => openLotModal(index)}
                          className="h-7 px-2.5 text-[10px] font-bold rounded-lg border-indigo-200 dark:border-indigo-800 text-indigo-600 hover:bg-indigo-50 cursor-pointer shrink-0 ml-auto"
                        >
                          <Boxes className="w-3 h-3 mr-1" />
                          Allocate Lots
                        </Button>
                      )}
                    </div>
                  </td>

                  {/* Rate (Hidden for production role) */}
                  {canViewCosting && (
                    <td className="py-2.5 px-3 text-right">
                      <div className="flex flex-col items-end">
                        <Input
                          type="number"
                          step="any"
                          min="0"
                          disabled={disabled}
                          value={displayRate === 0 ? '' : displayRate}
                          placeholder="0"
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => handleRateChange(index, e.target.value, isAltMode ? 'ALT' : 'BASE')}
                          className="h-8 text-right font-mono font-bold text-xs rounded-lg w-24 text-indigo-700 dark:text-indigo-400"
                        />
                        <span className="text-[9px] font-mono text-slate-400 block pt-0.5">
                          / {isAltMode ? altUomClean : baseUomClean}
                        </span>
                      </div>
                    </td>
                  )}

                  {/* Total (Hidden for production role) */}
                  {canViewCosting && (
                    <td className="py-2.5 px-3 text-right font-mono font-black text-slate-900 dark:text-white">
                      ₹{Number(row.totalCost || (isAltMode ? (displayQty * displayRate) : (baseQty * baseRate))).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  )}

                  {/* Delete Row */}
                  <td className="py-2.5 px-3 text-center">
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => handleDeleteRow(index)}
                      className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                      title="Remove Row"
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

      {/* ── MOBILE & TABLET RESPONSIVE CARDS (lg:hidden) ── */}
      <div className="lg:hidden space-y-3">
        {rawMaterials.map((row, index) => {
          const master = findMaster(row);
          const hasAlt = Boolean(
            master
              ? (master.hasAlternateUom && master.alternateUom)
              : (row.hasAlternateUom && row.alternateUom)
          );

          const rawBase = (master?.unitId || master?.consumptionUnit || row.baseUom || row.selectedUom || 'liter');
          const baseUomClean = (!rawBase || /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawBase))
            ? (row.selectedUom && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(row.selectedUom) ? row.selectedUom : 'units')
            : rawBase;

          const rawAlt = hasAlt ? (master?.alternateUom || row.alternateUom) : null;
          const altUomClean = (rawAlt && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawAlt))
            ? rawAlt
            : null;

          const factor = hasAlt ? Number(
            master?.conversionFactor ||
            (master && master.alternateUomQty && master.baseUomQty ? (master.alternateUomQty / master.baseUomQty) : null) ||
            row.conversionFactor ||
            (row.alternateUomQty && row.baseUomQty ? (row.alternateUomQty / row.baseUomQty) : 1) ||
            1
          ) : 1;

          const isAltMode = Boolean(hasAlt && (row.activeEntryMode === 'ALT'));
          const allocatedList = Array.isArray(row.allocatedBatches) ? row.allocatedBatches : [];

          const baseQty = Number(row.baseRequiredQty !== undefined ? row.baseRequiredQty : (row.requiredQty || 0));
          const altQty = Number((baseQty * factor).toFixed(3));

          const baseRate = Number(row.baseRate !== undefined ? row.baseRate : (master?.ratePerUnit !== undefined ? master.ratePerUnit : (row.unitRate || 0)));
          const altRate = Number(row.altRate !== undefined ? row.altRate : (factor > 0 ? (baseRate / factor) : baseRate));

          const displayQty = isAltMode ? (row.altRequiredQty !== undefined ? Number(row.altRequiredQty) : altQty) : baseQty;
          const displayRate = isAltMode ? altRate : baseRate;
          const lineTotal = Number(row.totalCost || (isAltMode ? (displayQty * displayRate) : (baseQty * baseRate)));

          return (
            <div 
              key={row.rmId || row.id || index}
              className="p-4 rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs space-y-3"
            >
              {/* Header: SN, Material Name, Category, Code, UOM, and Delete */}
              <div className="flex items-start justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-2.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="w-6 h-6 rounded-lg bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-mono font-black text-xs flex items-center justify-center">
                    #{index + 1}
                  </span>
                  <div>
                    {(() => {
                      const catName = getCategoryName(master) || getCategoryName(row);
                      const descText = getDescriptionText(master) || getDescriptionText(row);
                      return (
                        <>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <h5 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white">
                              {row.rmName}
                            </h5>
                            {catName && (
                              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                                {catName}
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] font-mono text-slate-400 flex items-center gap-2 mt-0.5">
                            <span>{row.rmCode || 'RM'}</span>
                            <span>•</span>
                            <span className="font-semibold text-slate-600 dark:text-slate-300">UOM: {baseUomClean}</span>
                            {hasAlt && altUomClean && (
                              <span className="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 font-semibold text-[9px] border border-indigo-200 dark:border-indigo-800">
                                1 {baseUomClean} = {factor} {altUomClean}
                              </span>
                            )}
                          </div>
                          {descText && (
                            <div className="mt-1 text-[10px] text-amber-800 dark:text-amber-300 bg-amber-50/70 dark:bg-amber-950/40 px-2 py-0.5 rounded border border-amber-200/50 dark:border-amber-900/40 flex items-center gap-1">
                              <span className="font-bold shrink-0 text-amber-900 dark:text-amber-200">Storage:</span>
                              <span className="truncate">{descText}</span>
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>
                </div>

                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => handleDeleteRow(index)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                  title="Remove Row"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {/* Quantity & UOM Selection */}
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1">
                    Required Qty:
                  </label>
                  <Input
                    type="number"
                    step="any"
                    min="0"
                    disabled={disabled}
                    value={displayQty === 0 ? '' : displayQty}
                    placeholder="0"
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => handleQtyChange(index, e.target.value, isAltMode ? 'ALT' : 'BASE')}
                    className="h-8 font-mono font-bold text-xs rounded-xl"
                  />
                  {hasAlt && altUomClean && (
                    <span className="text-[9px] font-mono text-slate-400 block pt-0.5">
                      {isAltMode ? `≈ ${baseQty} ${baseUomClean}` : `≈ ${altQty} ${altUomClean}`}
                    </span>
                  )}
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1">
                    Unit / UOM:
                  </label>
                  {hasAlt && altUomClean ? (
                    <select
                      disabled={disabled}
                      value={isAltMode ? 'ALT' : 'BASE'}
                      onChange={(e) => handleUomModeChange(index, e.target.value)}
                      className="w-full h-8 text-xs font-bold font-mono bg-indigo-50/80 dark:bg-indigo-950 border border-indigo-200 dark:border-indigo-800 rounded-xl px-2 text-indigo-700 dark:text-indigo-300"
                    >
                      <option value="BASE">{baseUomClean} (Base)</option>
                      <option value="ALT">{altUomClean} (Alt)</option>
                    </select>
                  ) : (
                    <div className="h-8 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center font-mono font-bold text-xs text-slate-700 dark:text-slate-300">
                      {baseUomClean}
                    </div>
                  )}
                </div>
              </div>

              {/* Consumption Ratio Badge */}
              <div className="flex items-center justify-between text-[10px] font-mono bg-slate-50 dark:bg-slate-850 p-2 rounded-xl">
                <span className="text-slate-400">Single Pcs Consumption:</span>
                <span className="font-bold text-amber-700 dark:text-amber-400">
                  {(Number(plannedOutputQty) > 0 ? (baseQty / Number(plannedOutputQty)) : 0).toFixed(4)} {baseUomClean} / {outputUom || 'pc'}
                </span>
              </div>

              {/* Costing (if allowed) */}
              {canViewCosting && (
                <div className="grid grid-cols-2 gap-2 text-xs bg-indigo-50/30 dark:bg-indigo-950/20 p-2.5 rounded-xl border border-indigo-100 dark:border-indigo-900 font-mono">
                  <div>
                    <span className="text-[9.5px] text-slate-400 block">Unit Rate:</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      ₹{displayRate.toFixed(2)} / {isAltMode ? altUomClean : baseUomClean}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[9.5px] text-slate-400 block">Total Cost:</span>
                    <span className="font-black text-indigo-600 dark:text-indigo-400">
                      ₹{lineTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              )}

              {/* Assigned Lots List & Allocate Button */}
              <div className="pt-1 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">
                    Allocated Lots ({allocatedList.length}):
                  </span>
                  {!disabled && !row.isOverhead && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => openLotModal(index)}
                      className="h-7 px-3 text-[10px] font-bold rounded-lg border-indigo-300 text-indigo-600 hover:bg-indigo-50 cursor-pointer"
                    >
                      <Boxes className="w-3 h-3 mr-1" />
                      Allocate Lots
                    </Button>
                  )}
                </div>

                {allocatedList.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {allocatedList.map((b, bIdx) => (
                      <span
                        key={b.batchId || bIdx}
                        className={`inline-flex items-center gap-1.5 font-mono text-[10px] font-bold px-2.5 py-1 rounded-lg border shadow-2xs ${
                          b.isManualOverride
                            ? 'text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/70 border-amber-300 dark:border-amber-700'
                            : 'text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950 border border-indigo-200 dark:border-indigo-800'
                        }`}
                      >
                        <Tag className="w-2.5 h-2.5 text-indigo-500" />
                        <span>{b.lotNumber}</span>
                        {b.isManualOverride && (
                          <span className="text-[8.5px] px-1 py-0.2 rounded font-black uppercase bg-amber-200 text-amber-900 dark:bg-amber-900 dark:text-amber-200 border border-amber-300">
                            Override
                          </span>
                        )}
                        <span className="text-[9px] font-black">
                          ({isAltMode && (b.allocatedAltQty || (b.allocatedQty && factor)) ? (
                            `${b.allocatedAltQty || Number((b.allocatedQty * factor).toFixed(2)).toLocaleString()} ${altUomClean} / ${b.allocatedQty} ${baseUomClean}`
                          ) : (
                            `${b.allocatedQty} ${baseUomClean}${hasAlt && altUomClean ? ` / ${Number((b.allocatedQty * factor).toFixed(2)).toLocaleString()} ${altUomClean}` : ''}`
                          )})
                        </span>
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-[10px] text-amber-600 dark:text-amber-400 italic">
                    No lots allocated yet. Click "Allocate Lots" to fulfill from inventory.
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>



      {/* ══════════════════════════════════════════════════════════════════════════════
          MODAL 2: BATCH ALLOCATION LOT MODAL (FEFO / GRN / DUAL UOM / AUTO FIFO)
      ══════════════════════════════════════════════════════════════════════════════ */}
      {lotModalOpen && activeItemIndex !== null && rawMaterials[activeItemIndex] && (
        <ProductionLotAllocationModal
          isOpen={lotModalOpen}
          onClose={() => setLotModalOpen(false)}
          row={rawMaterials[activeItemIndex]}
          master={findMaster(rawMaterials[activeItemIndex])}
          catalog={itemSetupMasters}
          onConfirm={handleConfirmLotAllocations}
          titlePrefix="Allocate Stock Lots"
        />
      )}

      {/* ── MODAL 3: DIRECT ADD RAW MATERIAL MODAL ── */}
      {addRmModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0 bg-slate-50/60 dark:bg-slate-850/60">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-500 text-white flex items-center justify-center shadow-xs">
                  <Boxes className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                      Add Raw Material to Formulation
                    </h3>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-900/60 dark:text-indigo-300">
                      Live Catalogue
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">
                    Select material from Item Setup, specify required quantity & UOM, and allocate inventory lots
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setAddRmModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl p-1.5 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto space-y-5 flex-1">
              
              {/* Search Box */}
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input
                  type="text"
                  value={addRmSearchTerm}
                  onChange={(e) => setAddRmSearchTerm(e.target.value)}
                  placeholder="Search catalogue by material name, code (e.g. RM-00001), or category..."
                  className="h-10 pl-10 rounded-2xl text-xs bg-slate-50 dark:bg-slate-850 border-slate-200 dark:border-slate-800 font-medium"
                />
              </div>

              {/* Grid of Raw Material Catalogue Items */}
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Select Raw Material ({filteredMastersToAdd.length} available):
                </Label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-56 overflow-y-auto pr-1">
                  {filteredMastersToAdd.map((m) => {
                    const isSelected = selectedRmToAdd?.id === m.id;
                    const alreadyInBatch = rawMaterials.some(r => r.rmId === m.id || (r.rmCode && r.rmCode === m.code));
                    const hasAlt = Boolean(m.hasAlternateUom && m.alternateUom);
                    const baseUom = m.unitId || m.consumptionUnit || 'liter';
                    const catName = getCategoryName(m);
                    const descText = getDescriptionText(m);

                    return (
                      <div
                        key={m.id}
                        onClick={() => handleSelectRmMaster(m)}
                        className={`p-3 rounded-2xl border transition-all cursor-pointer select-none flex items-start justify-between gap-2 ${
                          isSelected
                            ? 'bg-indigo-50/90 dark:bg-indigo-950/50 border-indigo-500 shadow-2xs ring-2 ring-indigo-500/20'
                            : 'bg-white dark:bg-slate-850/80 border-slate-200 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-700 hover:bg-slate-50/80'
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs font-black text-slate-900 dark:text-white truncate">
                              {m.name}
                            </span>
                            {catName && (
                              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/60">
                                {catName}
                              </span>
                            )}
                            {alreadyInBatch && (
                              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200">
                                In Batch
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] font-mono text-slate-400 flex items-center gap-1.5 mt-0.5 flex-wrap">
                            <span>{m.code || 'RM'}</span>
                            <span>•</span>
                            <span className="font-semibold text-slate-600 dark:text-slate-300">UOM: {baseUom}</span>
                            {canViewCosting && m.ratePerUnit > 0 && (
                              <>
                                <span>•</span>
                                <span className="text-emerald-600 dark:text-emerald-400 font-bold">₹{m.ratePerUnit}/{baseUom}</span>
                              </>
                            )}
                          </div>

                          {/* Alternate UOM badge if enabled in setup */}
                          {hasAlt && m.alternateUom && (
                            <div className="mt-1 text-[9px] font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/70 border border-indigo-200/60 dark:border-indigo-800/60 px-1.5 py-0.5 rounded-lg inline-flex items-center gap-1">
                              <ArrowLeftRight className="w-2.5 h-2.5" />
                              1 {baseUom} = {Number(m.conversionFactor || 1).toLocaleString()} {m.alternateUom}
                            </div>
                          )}

                          {/* Description / Storage Notes */}
                          {descText && (
                            <div className="mt-1.5 text-[10px] text-amber-900 dark:text-amber-300 bg-amber-50/70 dark:bg-amber-950/40 border border-amber-200/60 dark:border-amber-900/40 rounded-lg px-2 py-1 flex items-start gap-1">
                              <span className="font-bold shrink-0 text-amber-800 dark:text-amber-400">Storage Notes:</span>
                              <span className="line-clamp-2">{descText}</span>
                            </div>
                          )}
                        </div>

                        <div className="shrink-0 pt-0.5">
                          {isSelected ? (
                            <CheckCircle2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400 fill-indigo-100 dark:fill-indigo-950" />
                          ) : (
                            <span className="w-4 h-4 rounded-full border border-slate-300 dark:border-slate-700 block"></span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Selected Material Configuration Card */}
              {selectedRmToAdd && (
                <div className="bg-slate-50 dark:bg-slate-850 p-4 rounded-2xl border border-indigo-200 dark:border-indigo-900/60 space-y-4 animate-in fade-in">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 border-b border-slate-200/80 dark:border-slate-800 gap-2">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-[10px] uppercase font-mono font-bold text-slate-400 block">
                          Selected Formulation Material:
                        </span>
                        {selectedCatName && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                            Category: {selectedCatName}
                          </span>
                        )}
                        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-slate-200/70 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                          Base UOM: {selectedBaseUomClean}
                        </span>
                      </div>
                      <h4 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                        <span>{selectedRmToAdd.name}</span>
                        <span className="text-xs font-mono font-bold text-slate-400">({selectedRmToAdd.code || 'RM'})</span>
                      </h4>
                    </div>

                    {/* UOM mode toggle if Alternate UOM enabled */}
                    {selectedRmToAdd.hasAlternateUom && selectedRmToAdd.alternateUom && (
                      <div className="flex items-center gap-1 bg-white dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold shrink-0">
                        <button
                          type="button"
                          onClick={() => setAddRmMode('BASE')}
                          className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                            addRmMode === 'BASE'
                              ? 'bg-indigo-600 text-white shadow-2xs'
                              : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                          }`}
                        >
                          {selectedBaseUomClean} (Base)
                        </button>
                        <button
                          type="button"
                          onClick={() => setAddRmMode('ALT')}
                          className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                            addRmMode === 'ALT'
                              ? 'bg-indigo-600 text-white shadow-2xs'
                              : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                          }`}
                        >
                          {selectedRmToAdd.alternateUom} (Alt)
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Description / Storage Notes banner */}
                  {selectedDescText && (
                    <div className="bg-amber-50/90 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-800/60 rounded-xl p-2.5 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <strong className="text-amber-800 dark:text-amber-300 block text-[10px] uppercase tracking-wider font-bold">
                          Description / Storage Notes:
                        </strong>
                        <p className="text-[11px] leading-relaxed mt-0.5 text-slate-700 dark:text-slate-300">
                          {selectedDescText}
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {/* Required Qty */}
                    <div className="space-y-1">
                      <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        Required Quantity <span className="text-rose-500">*</span>
                      </Label>
                      <div className="relative">
                        <Input
                          type="number"
                          step="any"
                          min="0.0001"
                          value={addRmQty === 0 || addRmQty === '0' ? '' : addRmQty}
                          placeholder="0"
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => setAddRmQty(e.target.value.replace(/^0+(?=\d)/, ''))}
                          className="h-9 rounded-xl font-mono font-bold text-xs pr-14"
                        />
                        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 pointer-events-none">
                          {addRmMode === 'ALT' && selectedRmToAdd.alternateUom
                            ? selectedRmToAdd.alternateUom
                            : (selectedRmToAdd.unitId || selectedRmToAdd.consumptionUnit || 'liter')}
                        </span>
                      </div>
                    </div>

                    {/* Unit Rate */}
                    {canViewCosting && (
                      <div className="space-y-1">
                        <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                          Unit Rate (₹)
                        </Label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 pointer-events-none">
                            ₹
                          </span>
                          <Input
                            type="number"
                            step="any"
                            min="0"
                            value={addRmRate === 0 || addRmRate === '0' ? '' : addRmRate}
                            placeholder="0"
                            onFocus={(e) => e.target.select()}
                            onChange={(e) => setAddRmRate(e.target.value.replace(/^0+(?=\d)/, ''))}
                            className="h-9 pl-7 rounded-xl font-mono font-bold text-xs"
                          />
                        </div>
                      </div>
                    )}

                    {/* Calculated Total Cost */}
                    {canViewCosting && (
                      <div className="space-y-1 flex flex-col justify-end">
                        <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                          Calculated Cost
                        </Label>
                        <div className="h-9 px-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs font-bold">
                          <span className="text-slate-400">Total:</span>
                          <span className="text-slate-900 dark:text-white font-mono">
                            ₹{Number((Number(addRmQty || 0) * Number(addRmRate || 0)).toFixed(2)).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Single Piece Consumption Notice */}
                  {plannedOutputQty > 0 && (
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between bg-white dark:bg-slate-800 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700">
                      <span>Per-piece single consumption:</span>
                      <span className="font-mono font-bold text-amber-600 dark:text-amber-400">
                        {(Number(addRmQty || 0) / plannedOutputQty).toFixed(5)} {addRmMode === 'ALT' && selectedRmToAdd.alternateUom ? selectedRmToAdd.alternateUom : (selectedRmToAdd.unitId || selectedRmToAdd.consumptionUnit || 'liter')} / {outputUom}
                      </span>
                    </div>
                  )}

                </div>
              )}

            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-850/80 flex items-center justify-between shrink-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setAddRmModalOpen(false)}
                className="rounded-xl cursor-pointer"
              >
                Cancel
              </Button>

              <Button
                type="button"
                size="sm"
                disabled={!selectedRmToAdd}
                onClick={handleConfirmAddRm}
                className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold cursor-pointer shadow-xs flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                Add to Formulation
              </Button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
