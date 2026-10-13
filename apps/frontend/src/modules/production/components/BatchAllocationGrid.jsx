import React, { useState, useMemo } from 'react';
import { api } from '@/lib/axios';
import { 
  Tag, Boxes, RefreshCw, Plus, Minus, Trash2, Check, AlertTriangle, 
  HelpCircle, Calendar, ShieldCheck, Database, X, ArrowRight, Layers, ArrowLeftRight,
  Search, Edit3, Filter, Copy, Scale, Sparkles, Calculator, Sliders, CheckCircle2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import useAuthStore from '@/app/store/authStore';
import Swal from 'sweetalert2';
const UOM_PRESETS = [
  // Volume
  { label: '1 Liter = 1000 ml', category: 'Volume', base: 'liter', alt: 'ml', baseQty: 1, altQty: 1000 },
  { label: '1000 ml = 1 Liter', category: 'Volume', base: 'ml', alt: 'liter', baseQty: 1000, altQty: 1 },
  { label: '1 Gallon = 3.785 L', category: 'Volume', base: 'gallon', alt: 'liter', baseQty: 1, altQty: 3.785 },
  // Weight
  { label: '1 kg = 1000 gm', category: 'Weight', base: 'kg', alt: 'gm', baseQty: 1, altQty: 1000 },
  { label: '1000 gm = 1 kg', category: 'Weight', base: 'gm', alt: 'kg', baseQty: 1000, altQty: 1 },
  { label: '1 gm = 1000 mg', category: 'Weight', base: 'gm', alt: 'mg', baseQty: 1, altQty: 1000 },
  { label: '1 Ton = 1000 kg', category: 'Weight', base: 'ton', alt: 'kg', baseQty: 1, altQty: 1000 },
  { label: '1 Quintal = 100 kg', category: 'Weight', base: 'quintal', alt: 'kg', baseQty: 1, altQty: 100 },
  { label: '1 lb = 453.6 gm', category: 'Weight', base: 'lb', alt: 'gm', baseQty: 1, altQty: 453.6 },
  // Length
  { label: '1 Meter = 100 cm', category: 'Length', base: 'meter', alt: 'cm', baseQty: 1, altQty: 100 },
  { label: '1 Meter = 1000 mm', category: 'Length', base: 'meter', alt: 'mm', baseQty: 1, altQty: 1000 },
  { label: '1 Feet = 12 Inch', category: 'Length', base: 'feet', alt: 'inch', baseQty: 1, altQty: 12 },
  // Count
  { label: '1 Dozen = 12 pcs', category: 'Count', base: 'dozen', alt: 'pcs', baseQty: 1, altQty: 12 },
  // Packing
  { label: '1 Box = 20 pcs', category: 'Packing', base: 'box', alt: 'pcs', baseQty: 1, altQty: 20 },
  { label: '1 Carton = 10 Box', category: 'Packing', base: 'carton', alt: 'box', baseQty: 1, altQty: 10 },
  // Custom
  { label: '1 Bag = 25 kg', category: 'Custom', base: 'bag', alt: 'kg', baseQty: 1, altQty: 25 },
  { label: '1 Roll = 100 Meter', category: 'Custom', base: 'roll', alt: 'meter', baseQty: 1, altQty: 100 },
  { label: '1 Drum = 200 Liter', category: 'Custom', base: 'drum', alt: 'liter', baseQty: 1, altQty: 200 }
];

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

export default function BatchAllocationGrid({
  rawMaterials = [],
  onUpdateRawMaterials,
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
    if (role === 'MAIN_MASTER' || role === 'ADMIN' || role === 'SUPERVISOR') return false;
    return role === 'PRODUCTION_STAFF' || role === 'OPERATOR' || role.includes('PRODUCTION') || email.includes('production');
  }, [currentUser]);
  const canViewCosting = !isProductionRole;

  // ── LOT ALLOCATION MODAL STATE ──
  const [activeItemIndex, setActiveItemIndex] = useState(null);
  const [lotModalOpen, setLotModalOpen] = useState(false);
  const [loadingLots, setLoadingLots] = useState(false);
  const [availableLots, setAvailableLots] = useState([]);
  const [lotAllocations, setLotAllocations] = useState({}); // { [lotId]: allocatedQty }
  const [selectedGrnFilter, setSelectedGrnFilter] = useState('ALL');
  const [lotSearchTerm, setLotSearchTerm] = useState('');
  const [manualSupplierBatches, setManualSupplierBatches] = useState({}); // { [lotId]: string }

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

  // ── CONVERSION RATE & SANDBOX MODAL STATE ──
  const [conversionModalOpen, setConversionModalOpen] = useState(false);
  const [activeConversionIndex, setActiveConversionIndex] = useState(null);
  const [modalBaseUom, setModalBaseUom] = useState('liter');
  const [modalAltUom, setModalAltUom] = useState('ml');
  const [modalBaseQty, setModalBaseQty] = useState(1);
  const [modalAltQty, setModalAltQty] = useState(1000);
  const [modalBaseRate, setModalBaseRate] = useState(0);
  const [modalSelectedMode, setModalSelectedMode] = useState('BASE'); // 'BASE' or 'ALT'
  const [sandboxBaseInput, setSandboxBaseInput] = useState(5);
  const [sandboxAltInput, setSandboxAltInput] = useState(500);

  // ── OPEN CONVERSION MODAL ──
  const openConversionModal = (index) => {
    const row = rawMaterials[index];
    if (!row) return;

    setActiveConversionIndex(index);
    const bUom = row.baseUom || row.selectedUom || 'liter';
    const aUom = row.alternateUom || 'ml';
    const bQty = Number(row.baseUomQty || 1);
    const aQty = Number(row.alternateUomQty || row.conversionFactor || 1000);
    const bRate = Number(row.baseRate !== undefined ? row.baseRate : (row.unitRate || 0));
    const mode = row.activeEntryMode || 'BASE';

    setModalBaseUom(bUom);
    setModalAltUom(aUom);
    setModalBaseQty(bQty);
    setModalAltQty(aQty);
    setModalBaseRate(bRate);
    setModalSelectedMode(mode);
    setSandboxBaseInput(5);
    setSandboxAltInput(500);
    setConversionModalOpen(true);
  };

  // Modal Computed Values
  const modalConversionFactor = useMemo(() => {
    const b = Number(modalBaseQty || 1);
    const a = Number(modalAltQty || 1);
    return b > 0 ? (a / b) : 1;
  }, [modalBaseQty, modalAltQty]);

  const modalAltCatalogRate = useMemo(() => {
    const r = Number(modalBaseRate || 0);
    return modalConversionFactor > 0 ? Number((r / modalConversionFactor).toFixed(4)) : r;
  }, [modalBaseRate, modalConversionFactor]);

  // Real-Time Conversion Sandbox Test calculations
  const sandboxCalculatedAlt = useMemo(() => {
    const b = Number(sandboxBaseInput || 0);
    return Number((b * modalConversionFactor).toFixed(4));
  }, [sandboxBaseInput, modalConversionFactor]);

  const sandboxCalculatedBase = useMemo(() => {
    const a = Number(sandboxAltInput || 0);
    return modalConversionFactor > 0 ? Number((a / modalConversionFactor).toFixed(4)) : a;
  }, [sandboxAltInput, modalConversionFactor]);

  // Apply preset inside modal
  const handleApplyPresetInModal = (preset) => {
    setModalBaseUom(preset.base);
    setModalAltUom(preset.alt);
    setModalBaseQty(preset.baseQty);
    setModalAltQty(preset.altQty);
  };

  // Confirm and Save Conversion Modal
  const handleConfirmConversionModal = () => {
    if (activeConversionIndex === null) return;
    const updated = [...rawMaterials];
    const row = { ...updated[activeConversionIndex] };

    const bRatio = Number(modalBaseQty || 1);
    const aRatio = Number(modalAltQty || 1);
    const factor = bRatio > 0 ? (aRatio / bRatio) : 1;
    const baseRate = Number(modalBaseRate || 0);
    const altRate = factor > 0 ? Number((baseRate / factor).toFixed(4)) : baseRate;

    row.hasAlternateUom = true;
    row.baseUom = modalBaseUom;
    row.alternateUom = modalAltUom;
    row.baseUomQty = bRatio;
    row.alternateUomQty = aRatio;
    row.conversionFactor = factor;
    row.baseRate = baseRate;
    row.altRate = altRate;

    // Maintain canonical base quantity
    const currentBase = Number(row.baseRequiredQty !== undefined ? row.baseRequiredQty : (row.requiredQty || 0));
    const currentAlt = Number((currentBase * factor).toFixed(3));
    row.baseRequiredQty = currentBase;
    row.altRequiredQty = currentAlt;

    if (modalSelectedMode === 'ALT') {
      row.activeEntryMode = 'ALT';
      row.selectedUom = modalAltUom;
      row.requiredQty = currentAlt;
      row.unitRate = altRate;
      row.totalCost = Number((currentAlt * altRate).toFixed(2));
    } else {
      row.activeEntryMode = 'BASE';
      row.selectedUom = modalBaseUom;
      row.requiredQty = currentBase;
      row.unitRate = baseRate;
      row.totalCost = Number((currentBase * baseRate).toFixed(2));
    }

    updated[activeConversionIndex] = row;
    onUpdateRawMaterials(updated);
    setConversionModalOpen(false);
  };

  // ── ROW UOM DROPDOWN CHANGE ──
  const handleUomModeChange = (index, targetMode) => {
    const updated = [...rawMaterials];
    const row = { ...updated[index] };
    if (!row.hasAlternateUom || !row.alternateUom) return;

    const baseRatio = Number(row.baseUomQty || 1);
    const altRatio = Number(row.alternateUomQty || row.conversionFactor || 1);
    const factor = baseRatio > 0 ? (altRatio / baseRatio) : 1;
    const baseRate = Number(row.baseRate !== undefined ? row.baseRate : (row.unitRate || 0));
    const altRate = factor > 0 ? Number((baseRate / factor).toFixed(4)) : baseRate;

    // Canonical base quantity
    const baseQty = Number(row.baseRequiredQty !== undefined ? row.baseRequiredQty : (row.requiredQty || 0));
    const altQty = Number((baseQty * factor).toFixed(3));

    if (targetMode === 'ALT') {
      row.activeEntryMode = 'ALT';
      row.selectedUom = row.alternateUom;
      row.requiredQty = altQty;
      row.baseRequiredQty = baseQty;
      row.altRequiredQty = altQty;
      row.unitRate = altRate;
      row.baseRate = baseRate;
      row.altRate = altRate;
      row.totalCost = Number((altQty * altRate).toFixed(2));
    } else {
      row.activeEntryMode = 'BASE';
      row.selectedUom = row.baseUom || 'Kg';
      row.requiredQty = baseQty;
      row.baseRequiredQty = baseQty;
      row.altRequiredQty = altQty;
      row.unitRate = baseRate;
      row.baseRate = baseRate;
      row.altRate = altRate;
      row.totalCost = Number((baseQty * baseRate).toFixed(2));
    }

    updated[index] = row;
    onUpdateRawMaterials(updated);
  };

  // ── ROW QUANTITY CHANGE ──
  const handleQtyChange = (index, value, mode = 'BASE') => {
    const updated = [...rawMaterials];
    const row = { ...updated[index] };
    const num = Number(value || 0);

    const baseRatio = Number(row.baseUomQty || 1);
    const altRatio = Number(row.alternateUomQty || row.conversionFactor || 1);
    const factor = baseRatio > 0 ? (altRatio / baseRatio) : 1;
    const baseRate = Number(row.baseRate !== undefined ? row.baseRate : (row.unitRate || 0));
    const altRate = factor > 0 ? Number((baseRate / factor).toFixed(4)) : baseRate;

    if (mode === 'ALT') {
      const calculatedBase = factor > 0 ? Number((num / factor).toFixed(4)) : num;
      row.activeEntryMode = 'ALT';
      row.selectedUom = row.alternateUom;
      row.requiredQty = num;
      row.altRequiredQty = num;
      row.baseRequiredQty = calculatedBase;
      row.unitRate = altRate;
      row.baseRate = baseRate;
      row.altRate = altRate;
      row.totalCost = Number((num * altRate).toFixed(2));
    } else {
      const calculatedAlt = Number((num * factor).toFixed(3));
      row.activeEntryMode = 'BASE';
      row.selectedUom = row.baseUom || 'Kg';
      row.requiredQty = num;
      row.baseRequiredQty = num;
      row.altRequiredQty = calculatedAlt;
      row.unitRate = baseRate;
      row.baseRate = baseRate;
      row.altRate = altRate;
      row.totalCost = Number((num * baseRate).toFixed(2));
    }

    updated[index] = row;
    onUpdateRawMaterials(updated);
  };

  // ── ROW RATE CHANGE ──
  const handleRateChange = (index, value, mode = 'BASE') => {
    const updated = [...rawMaterials];
    const row = { ...updated[index] };
    const r = Number(value || 0);

    const baseRatio = Number(row.baseUomQty || 1);
    const altRatio = Number(row.alternateUomQty || row.conversionFactor || 1);
    const factor = baseRatio > 0 ? (altRatio / baseRatio) : 1;

    if (mode === 'ALT') {
      const calculatedBaseRate = Number((r * factor).toFixed(4));
      row.altRate = r;
      row.baseRate = calculatedBaseRate;
      row.unitRate = r;
      row.rateSource = 'MANUAL_OVERRIDE';
      row.totalCost = Number((Number(row.altRequiredQty || row.requiredQty || 0) * r).toFixed(2));
    } else {
      const calculatedAltRate = factor > 0 ? Number((r / factor).toFixed(4)) : r;
      row.baseRate = r;
      row.altRate = calculatedAltRate;
      row.unitRate = r;
      row.rateSource = 'MANUAL_OVERRIDE';
      row.totalCost = Number((Number(row.baseRequiredQty || row.requiredQty || 0) * r).toFixed(2));
    }

    updated[index] = row;
    onUpdateRawMaterials(updated);
  };

  // ── DELETE ROW ──
  const handleDeleteRow = (index) => {
    if (rawMaterials.length <= 1) {
      Swal.fire({ title: 'Notice', text: 'Batch requires at least one raw material line.', icon: 'info' });
      return;
    }
    const updated = rawMaterials.filter((_, i) => i !== index);
    onUpdateRawMaterials(updated);
  };
  // ── LOT ALLOCATION MODAL LOGIC ──
  const openLotModal = async (index) => {
    const item = rawMaterials[index];
    if (!item) return;

    setActiveItemIndex(index);
    setLotModalOpen(true);
    setLoadingLots(true);
    setSelectedGrnFilter('ALL');
    setLotSearchTerm('');

    const rawClean = (item.rmName || item.rmCode || 'MILKFAT4')
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, 16);
    const reqQty = Number(item.baseRequiredQty !== undefined ? item.baseRequiredQty : (item.requiredQty || 0));

    // Preset sensible defaults matching Image 1
    setOverrideForm({
      internalBatchNo: `BATCH-${rawClean}-001`,
      grnNumber: 'GRN-OPENING',
      poNumber: 'PO-OPENING',
      batchQty: 1,
      weight: '25 kg / 50',
      availableQty: Math.max(reqQty || 100, 4840),
      supplierBatchNo: 'BATCH-01',
      mfgDate: '01-10-2026',
      expiryDate: '01-10-2027',
      supplierName: 'SUP-LOT-DIRECT'
    });
    setShowManualOverrideForm(false);

    const currentAllocMap = {};
    const currentSupplierMap = {};
    if (Array.isArray(item.allocatedBatches)) {
      item.allocatedBatches.forEach(b => {
        currentAllocMap[b.batchId] = Number(b.allocatedQty || 0);
        if (b.supplierBatchNo || b.mfgBatchNo) {
          currentSupplierMap[b.batchId] = b.supplierBatchNo || b.mfgBatchNo;
        }
      });
    }
    setLotAllocations(currentAllocMap);
    setManualSupplierBatches(currentSupplierMap);

    try {
      const res = await api.get(`/production/rm-batches/${item.rmId}`);
      setAvailableLots(res.data || []);
    } catch (err) {
      console.error('Failed to fetch RM batches:', err);
      setAvailableLots([]);
    } finally {
      setLoadingLots(false);
    }
  };

  // Add / Apply Manual Override Lot
  const handleAddManualOverrideLot = () => {
    const lotId = `manual-${Date.now()}`;
    const newLot = {
      id: lotId,
      internalBatchNo: overrideForm.internalBatchNo?.trim() || `BATCH-OVERRIDE-${Date.now().toString().slice(-4)}`,
      grnNumber: overrideForm.grnNumber?.trim() || 'GRN-OPENING',
      grnRef: overrideForm.grnNumber?.trim() || 'GRN-OPENING',
      poNumber: overrideForm.poNumber?.trim() || 'Manual Override',
      poReferenceNo: overrideForm.poNumber?.trim() || 'Manual Override',
      batchQty: Number(overrideForm.batchQty || 1),
      weight: overrideForm.weight || '25 kg / 50',
      availableQty: Number(overrideForm.availableQty || 4840),
      netQty: Number(overrideForm.availableQty || 4840),
      supplierBatchNo: overrideForm.supplierBatchNo || 'BATCH-01',
      mfgBatchNo: overrideForm.supplierBatchNo || 'BATCH-01',
      mfgDate: overrideForm.mfgDate || '01-10-2026',
      expiryDate: overrideForm.expiryDate || '01-10-2027',
      supplierName: overrideForm.supplierName || 'SUP-LOT-DIRECT',
      isManualOverride: true,
      source: 'MANUAL_OVERRIDE'
    };

    setAvailableLots(prev => [newLot, ...prev.filter(l => l.internalBatchNo !== newLot.internalBatchNo)]);
    setManualSupplierBatches(prev => ({
      ...prev,
      [lotId]: newLot.supplierBatchNo
    }));

    const item = rawMaterials[activeItemIndex];
    const req = Number(item?.baseRequiredQty !== undefined ? item?.baseRequiredQty : (item?.requiredQty || 0));
    const currentAllocSum = Object.values(lotAllocations).reduce((s, v) => s + Number(v || 0), 0);
    const needed = Math.max(0, req - currentAllocSum);
    const toAlloc = Math.min(newLot.availableQty, needed);
    if (toAlloc > 0) {
      setLotAllocations(prev => ({
        ...prev,
        [lotId]: toAlloc
      }));
    }

    setShowManualOverrideForm(false);
    Swal.fire({
      title: 'Manual Override Lot Added',
      text: `Lot ${newLot.internalBatchNo} added (${newLot.availableQty} ${item?.baseUom || item?.selectedUom || 'units'}). PO set to ${newLot.poNumber}.`,
      icon: 'success',
      timer: 1500
    });
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

  const handleFillRemaining = (lotId, maxAvail) => {
    const currentOtherTotal = Object.entries(lotAllocations).reduce((sum, [id, val]) => {
      return id === lotId ? sum : sum + Number(val || 0);
    }, 0);
    const required = Number(rawMaterials[activeItemIndex]?.baseRequiredQty || rawMaterials[activeItemIndex]?.requiredQty || 0);
    const remainingNeeded = Math.max(0, required - currentOtherTotal);
    const toAlloc = Math.min(maxAvail, Number(remainingNeeded.toFixed(4)));
    handleSetLotQty(lotId, toAlloc, maxAvail);
  };

  const uniqueGrnList = useMemo(() => {
    const map = new Map();
    availableLots.forEach(lot => {
      const grn = lot.grnNumber || lot.grnRef || 'Direct Stock';
      if (!map.has(grn)) {
        map.set(grn, { grnNumber: grn, count: 0, totalQty: 0 });
      }
      const item = map.get(grn);
      item.count += 1;
      item.totalQty += Number(lot.availableQty || lot.netQty || 0);
    });
    return Array.from(map.values());
  }, [availableLots]);

  const displayedLots = useMemo(() => {
    return availableLots.filter(lot => {
      if (selectedGrnFilter !== 'ALL') {
        const grn = lot.grnNumber || lot.grnRef || '';
        if (grn !== selectedGrnFilter) return false;
      }
      if (lotSearchTerm.trim()) {
        const q = lotSearchTerm.trim().toLowerCase();
        const ourBatch = (lot.internalBatchNo || '').toLowerCase();
        const suppBatch = (manualSupplierBatches[lot.id] || lot.supplierBatchNo || lot.mfgBatchNo || '').toLowerCase();
        const grn = (lot.grnNumber || lot.grnRef || '').toLowerCase();
        const po = (lot.poNumber || lot.poReferenceNo || '').toLowerCase();
        const weight = (lot.weight || '').toLowerCase();
        if (
          !ourBatch.includes(q) &&
          !suppBatch.includes(q) &&
          !grn.includes(q) &&
          !po.includes(q) &&
          !weight.includes(q)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [availableLots, selectedGrnFilter, lotSearchTerm, manualSupplierBatches]);

  const totalAllocatedInModal = useMemo(() => {
    return Object.values(lotAllocations).reduce((sum, v) => sum + Number(v || 0), 0);
  }, [lotAllocations]);

  const handleSaveAllocations = async () => {
    if (activeItemIndex === null) return;
    const item = rawMaterials[activeItemIndex];

    const allocatedBatches = [];
    let totalAllocated = 0;
    let weightedAmountSum = 0;

    for (const lot of availableLots) {
      const qty = Number(lotAllocations[lot.id] || 0);
      if (qty > 0) {
        totalAllocated += qty;

        let unitRate = Number(item.baseRate || item.unitRate || 0);
        let poOrigQty = Number(lot.netQty || lot.availableQty || qty);
        let poTotAmt = Number(lot.totalAmount || (poOrigQty * unitRate));

        try {
          const rateRes = await api.get(`/purchase/live-rate?batchId=${lot.id}&allocatedQty=${qty}`);
          if (rateRes.data && rateRes.data.rate > 0) {
            unitRate = Number(rateRes.data.rate);
            poOrigQty = Number(rateRes.data.poOriginalQty || poOrigQty);
            poTotAmt = Number(rateRes.data.poTotalAmount || poTotAmt);
          }
        } catch (e) {
          // Fallback
        }

        const propFactor = poOrigQty > 0 ? (qty / poOrigQty) : 1;
        const allocatedAmount = Number((poTotAmt * propFactor).toFixed(2));
        weightedAmountSum += allocatedAmount;

        const effectiveSupplierBatch = manualSupplierBatches[lot.id] || lot.supplierBatchNo || lot.mfgBatchNo || 'BATCH-01';

        allocatedBatches.push({
          batchId: lot.id,
          lotNumber: lot.internalBatchNo,
          supplierBatchNo: effectiveSupplierBatch,
          mfgBatchNo: effectiveSupplierBatch,
          batchQty: lot.batchQty ?? 1,
          weight: lot.weight || '25 kg / 50',
          mfgDate: lot.mfgDate || null,
          expiryDate: lot.expiryDate || null,
          grnNumber: lot.grnNumber || lot.grnRef || null,
          poNumber: lot.poNumber || lot.poReferenceNo || null,
          allocatedQty: qty,
          poOriginalQty: poOrigQty,
          poTotalAmount: poTotAmt,
          allocatedAmount,
          unitRate,
          uom: item.baseUom || item.selectedUom
        });
      }
    }

    const updated = [...rawMaterials];
    const row = { ...updated[activeItemIndex] };
    row.allocatedBatches = allocatedBatches;

    if (totalAllocated > 0 && weightedAmountSum > 0) {
      const blendedBaseRate = Number((weightedAmountSum / totalAllocated).toFixed(4));
      const factor = Number(row.conversionFactor || 1);
      row.baseRate = blendedBaseRate;
      row.altRate = factor > 0 ? Number((blendedBaseRate / factor).toFixed(4)) : blendedBaseRate;
      row.unitRate = row.activeEntryMode === 'ALT' ? row.altRate : row.baseRate;
      row.totalCost = Number(weightedAmountSum.toFixed(2));
    } else {
      const currentRate = row.activeEntryMode === 'ALT' ? (row.altRate || row.unitRate) : (row.baseRate || row.unitRate);
      const currentQty = row.activeEntryMode === 'ALT' ? (row.altRequiredQty || row.requiredQty) : (row.baseRequiredQty || row.requiredQty);
      row.totalCost = Number((Number(currentQty || 0) * Number(currentRate || 0)).toFixed(2));
    }

    updated[activeItemIndex] = row;
    onUpdateRawMaterials(updated);
    setLotModalOpen(false);
  };

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

        <div className="flex items-center gap-2">
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

      {/* Formulation Table */}
      <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
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
              const baseUomClean = (!row.baseUom || /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(row.baseUom)) ? (row.selectedUom && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(row.selectedUom) ? row.selectedUom : 'units') : row.baseUom;
              const altUomClean = (!row.alternateUom || /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(row.alternateUom)) ? null : row.alternateUom;
              const hasAlt = Boolean(row.hasAlternateUom && altUomClean);
              const isAltMode = (row.activeEntryMode || 'BASE') === 'ALT';
              const allocatedList = Array.isArray(row.allocatedBatches) ? row.allocatedBatches : [];

              // Calculated values
              const factor = Number(row.conversionFactor || 1);
              const baseQty = Number(row.baseRequiredQty !== undefined ? row.baseRequiredQty : (row.requiredQty || 0));
              const altQty = Number(row.altRequiredQty !== undefined ? row.altRequiredQty : (baseQty * factor));
              const baseRate = Number(row.baseRate !== undefined ? row.baseRate : (row.unitRate || 0));
              const altRate = Number(row.altRate !== undefined ? row.altRate : (factor > 0 ? (baseRate / factor) : baseRate));

              const displayQty = isAltMode ? altQty : baseQty;
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

                  {/* Material Name & Code */}
                  <td className="py-2.5 px-3">
                    <div className="font-bold text-slate-900 dark:text-white">
                      {row.rmName}
                    </div>
                    <div className="text-[10px] font-mono text-slate-400 flex items-center gap-1.5 flex-wrap">
                      <span>{row.rmCode || 'RM'}</span>
                      {hasAlt && (
                        <button
                          type="button"
                          onClick={() => openConversionModal(index)}
                          className="text-[9px] px-1.5 py-0.5 rounded bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 font-semibold border border-indigo-200 dark:border-indigo-800 cursor-pointer flex items-center gap-1 transition-all"
                          title="Click to view Alternate UOM Conversion Presets & Sandbox"
                        >
                          <Scale className="w-2.5 h-2.5 text-indigo-500" />
                          <span>1 {baseUomClean} = {Number(row.alternateUomQty || row.conversionFactor || 1)} {altUomClean}</span>
                        </button>
                      )}
                    </div>
                  </td>

                  {/* Quantity Input with Live Dual Preview */}
                  <td className="py-2.5 px-3 text-center">
                    <div className="flex flex-col items-center">
                      <Input
                        type="number"
                        step="any"
                        min="0"
                        disabled={disabled}
                        value={displayQty}
                        onChange={(e) => handleQtyChange(index, e.target.value, isAltMode ? 'ALT' : 'BASE')}
                        className={`h-8 text-center font-mono font-bold text-xs rounded-lg transition-all ${
                          isAltMode
                            ? 'border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-400 bg-indigo-50/20'
                            : 'text-slate-900 dark:text-white'
                        }`}
                      />
                      {hasAlt && (
                        <span className="text-[9px] font-mono text-slate-400 block pt-0.5">
                          {isAltMode ? (
                            <span>≈ {baseQty} {baseUomClean} (Base)</span>
                          ) : (
                            <span className="text-indigo-600 dark:text-indigo-400">≈ {altQty} {altUomClean} (Alt)</span>
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

                  {/* UOM Dropdown (Only if Alternate UOM enabled) */}
                  <td className="py-2.5 px-3 text-center">
                    {hasAlt ? (
                      <div className="flex flex-col items-center gap-1">
                        {/* Dropdown with Base and Alternate UOM */}
                        <select
                          disabled={disabled}
                          value={row.activeEntryMode || 'BASE'}
                          onChange={(e) => handleUomModeChange(index, e.target.value)}
                          className="text-[11px] font-bold font-mono bg-indigo-50/80 dark:bg-indigo-950/70 border border-indigo-200 dark:border-indigo-800 rounded-lg px-2 py-1 text-indigo-700 dark:text-indigo-300 focus:outline-none focus:ring-1.5 focus:ring-indigo-500 cursor-pointer shadow-3xs hover:bg-indigo-100/70 transition-all"
                          title="Select Active Unit of Measure for this raw material"
                        >
                          <option value="BASE">
                            {baseUomClean} (Base)
                          </option>
                          <option value="ALT">
                            {altUomClean} (Alt)
                          </option>
                        </select>

                        {/* Interactive Scale badge opening modal */}
                        <button
                          type="button"
                          disabled={disabled}
                          onClick={() => openConversionModal(index)}
                          className="inline-flex items-center gap-1 text-[9px] font-mono font-bold text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-300 bg-slate-100 hover:bg-indigo-50 dark:bg-slate-800 dark:hover:bg-indigo-950/80 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700 hover:border-indigo-300 transition-all cursor-pointer"
                          title="Click to view Alternate UOM & Conversion Rate Equation / Sandbox"
                        >
                          <Scale className="w-2.5 h-2.5 text-indigo-500" />
                          <span>Ratio & Rate</span>
                        </button>
                      </div>
                    ) : (
                      <span className="font-mono font-bold text-slate-700 dark:text-slate-300 text-xs px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
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
                              className="inline-flex items-center gap-1.5 font-mono text-[10px] font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/80 px-2.5 py-1 rounded-lg border border-indigo-200 dark:border-indigo-800 shadow-2xs"
                              title={`Our Batch: ${b.lotNumber} | MFG: ${b.supplierBatchNo || 'N/A'} | GRN: ${b.grnNumber || 'N/A'} | Exp: ${formatDateDMY(b.expiryDate)}`}
                            >
                              <Tag className="w-2.5 h-2.5 text-indigo-500" />
                              <span>{b.lotNumber}</span>
                              <span className="text-[9px] text-indigo-900 dark:text-indigo-200 font-black">
                                ({b.allocatedQty} {row.baseUom || row.selectedUom})
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
                          value={displayRate}
                          onChange={(e) => handleRateChange(index, e.target.value, isAltMode ? 'ALT' : 'BASE')}
                          className="h-8 text-right font-mono font-bold text-xs rounded-lg w-24 text-indigo-700 dark:text-indigo-400"
                        />
                        <span className="text-[9px] font-mono text-slate-400 block pt-0.5">
                          / {row.selectedUom}
                        </span>
                      </div>
                    </td>
                  )}

                  {/* Total (Hidden for production role) */}
                  {canViewCosting && (
                    <td className="py-2.5 px-3 text-right font-mono font-black text-slate-900 dark:text-white">
                      ₹{Number(row.totalCost || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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

      {/* ══════════════════════════════════════════════════════════════════════════════
          MODAL 1: ALTERNATE UNIT OF MEASURE (UOM) & CONVERSION RATE
      ══════════════════════════════════════════════════════════════════════════════ */}
      {conversionModalOpen && activeConversionIndex !== null && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-3xl w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[92vh]">
            
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0 bg-slate-50/70 dark:bg-slate-850/70">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400">
                  <Scale className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                    Alternate Unit of Measure (UOM) & Conversion Rate
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Material: <strong className="text-slate-700 dark:text-slate-300">{rawMaterials[activeConversionIndex]?.rmName}</strong> ({rawMaterials[activeConversionIndex]?.rmCode || 'RM'}) • Item Setup
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  Alternate UOM Active
                </span>
                <button 
                  onClick={() => setConversionModalOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-5 sm:p-6 space-y-5 overflow-y-auto flex-1">

              {/* 1. Quick Conversion Presets */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-slate-700 dark:text-slate-200 flex items-center gap-1.5 uppercase tracking-wider">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    Quick Conversion Presets
                  </span>
                  <span className="text-[10px] text-slate-400 font-bold">Click to apply common ratio</span>
                </div>
                
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-48 overflow-y-auto p-1 bg-slate-50/50 dark:bg-slate-950/40 rounded-xl border border-slate-100 dark:border-slate-800">
                  {UOM_PRESETS.map((preset, pIdx) => {
                    const isSelected = 
                      modalBaseUom.toLowerCase() === preset.base.toLowerCase() &&
                      modalAltUom.toLowerCase() === preset.alt.toLowerCase() &&
                      Number(modalBaseQty) === preset.baseQty &&
                      Number(modalAltQty) === preset.altQty;

                    return (
                      <button
                        key={pIdx}
                        type="button"
                        onClick={() => handleApplyPresetInModal(preset)}
                        className={`text-[10px] px-2.5 py-1.5 rounded-lg font-bold text-left transition-all border cursor-pointer flex items-center justify-between gap-1 shadow-3xs ${
                          isSelected
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                            : 'bg-white hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 border-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-800'
                        }`}
                      >
                        <div className="truncate">
                          <span className={`mr-1 text-[9px] uppercase ${isSelected ? 'text-indigo-200' : 'text-slate-400'}`}>
                            [{preset.category}]
                          </span>
                          <span>{preset.label}</span>
                        </div>
                        {isSelected && <Check className="w-3 h-3 text-white shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 2. Equivalence Conversion Equation Card */}
              <div className="p-4 bg-gradient-to-r from-indigo-50/80 via-purple-50/50 to-slate-50 dark:from-indigo-950/40 dark:via-purple-950/30 dark:to-slate-950/40 rounded-2xl border border-indigo-100 dark:border-indigo-900/50 space-y-3">
                <div className="flex items-center justify-between text-xs font-black text-indigo-950 dark:text-indigo-200 uppercase tracking-wider">
                  <span>Equivalence Conversion Equation</span>
                  <span className="text-[10px] font-mono text-indigo-600 dark:text-indigo-400 bg-white dark:bg-slate-900 px-2 py-0.5 rounded-md border border-indigo-200 dark:border-indigo-800">
                    Ratio: {modalBaseQty} {modalBaseUom} = {modalAltQty} {modalAltUom}
                  </span>
                </div>

                {/* Equation Visual Controls */}
                <div className="flex flex-wrap items-center gap-3">
                  {/* Primary Base Unit Qty */}
                  <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 shadow-3xs">
                    <span className="text-[10px] text-slate-400 font-black tracking-wider">QTY</span>
                    <input
                      type="number"
                      step="any"
                      min="0.0001"
                      value={modalBaseQty}
                      onChange={(e) => setModalBaseQty(Number(e.target.value || 1))}
                      className="w-16 text-center font-mono font-black text-xs bg-transparent focus:outline-none text-slate-900 dark:text-white"
                      placeholder="1"
                    />
                    <input
                      type="text"
                      value={modalBaseUom}
                      onChange={(e) => setModalBaseUom(e.target.value)}
                      className="w-16 text-center font-bold text-[11px] uppercase px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200 border-none focus:outline-none"
                    />
                  </div>

                  <div className="flex items-center justify-center w-7 h-7 rounded-full bg-indigo-600 text-white font-black text-xs shadow-2xs">
                    =
                  </div>

                  {/* Alternate Unit Qty & Unit Input */}
                  <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 shadow-3xs flex-1 min-w-[220px]">
                    <span className="text-[10px] text-slate-400 font-black tracking-wider">EQUALS</span>
                    <input
                      type="number"
                      step="any"
                      min="0.0001"
                      value={modalAltQty}
                      onChange={(e) => setModalAltQty(Number(e.target.value || 1))}
                      className="w-20 text-center font-mono font-black text-xs bg-transparent focus:outline-none text-slate-900 dark:text-white"
                      placeholder="1000"
                    />
                    <input
                      type="text"
                      value={modalAltUom}
                      onChange={(e) => setModalAltUom(e.target.value)}
                      className="flex-1 text-center font-bold text-[11px] uppercase px-1.5 py-0.5 rounded bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200 border-none focus:outline-none"
                      placeholder="ml"
                    />
                  </div>
                </div>

                {/* 3 Metric Cards: Multiplier, Divider, Catalog Rate */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1 text-xs">
                  <div className="p-2.5 rounded-xl bg-white/90 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 flex items-center justify-between shadow-3xs">
                    <span className="text-slate-500 text-[11px] font-bold">Multiplier (Bigger → Smaller):</span>
                    <span className="font-mono font-black text-indigo-600 dark:text-indigo-400 text-xs">
                      × {modalConversionFactor.toLocaleString(undefined, { maximumFractionDigits: 6 })}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-white/90 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 flex items-center justify-between shadow-3xs">
                    <span className="text-slate-500 text-[11px] font-bold">Divider (Smaller → Bigger):</span>
                    <span className="font-mono font-black text-purple-600 dark:text-purple-400 text-xs">
                      ÷ {modalConversionFactor.toLocaleString(undefined, { maximumFractionDigits: 6 })}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-white/90 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 flex items-center justify-between shadow-3xs">
                    <span className="text-slate-500 text-[11px] font-bold">Catalog Rate / {modalAltUom}:</span>
                    <span className="font-mono font-black text-emerald-600 dark:text-emerald-400 text-xs">
                      ₹{modalAltCatalogRate.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                    </span>
                  </div>
                </div>

              </div>

              {/* 3. Real-Time Conversion Preview (Sandbox Test) */}
              <div className="p-4 bg-slate-50 dark:bg-slate-950/60 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2.5">
                <div className="flex items-center gap-2 text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                  <Calculator className="w-4 h-4 text-indigo-500" />
                  <span>Real-Time Conversion Preview (Sandbox Test)</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  {/* Test 1: Base to Alt */}
                  <div className="flex items-center justify-between p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-3xs">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-slate-400 font-bold">Convert</span>
                      <input
                        type="number"
                        step="any"
                        value={sandboxBaseInput}
                        onChange={(e) => setSandboxBaseInput(Number(e.target.value || 0))}
                        className="w-16 h-7 px-1 text-center font-mono font-black border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-950 text-xs"
                      />
                      <span className="font-bold text-[11px] uppercase text-slate-600 dark:text-slate-300">{modalBaseUom}</span>
                    </div>
                    <div className="flex items-center gap-1 text-indigo-600 dark:text-indigo-400 font-mono font-black text-xs">
                      <span>➔</span>
                      <span>{sandboxCalculatedAlt.toLocaleString(undefined, { maximumFractionDigits: 4 })}</span>
                      <span className="uppercase text-[10px] font-bold">{modalAltUom}</span>
                    </div>
                  </div>

                  {/* Test 2: Alt to Base */}
                  <div className="flex items-center justify-between p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-3xs">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-slate-400 font-bold">Convert</span>
                      <input
                        type="number"
                        step="any"
                        value={sandboxAltInput}
                        onChange={(e) => setSandboxAltInput(Number(e.target.value || 0))}
                        className="w-16 h-7 px-1 text-center font-mono font-black border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-950 text-xs"
                      />
                      <span className="font-bold text-[11px] uppercase text-slate-600 dark:text-slate-300">{modalAltUom}</span>
                    </div>
                    <div className="flex items-center gap-1 text-purple-600 dark:text-purple-400 font-mono font-black text-xs">
                      <span>➔</span>
                      <span>{sandboxCalculatedBase.toLocaleString(undefined, { maximumFractionDigits: 4 })}</span>
                      <span className="uppercase text-[10px] font-bold">{modalBaseUom}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 4. Active Formulation UOM Selection */}
              <div className="space-y-2">
                <span className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider block">
                  Select Active Formulation Unit:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  
                  {/* Option 1: Base UOM */}
                  <button
                    type="button"
                    onClick={() => setModalSelectedMode('BASE')}
                    className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                      modalSelectedMode === 'BASE'
                        ? 'border-indigo-500 bg-indigo-50/60 dark:bg-indigo-950/40 ring-2 ring-indigo-500/20 shadow-xs'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300'
                    }`}
                  >
                    <div>
                      <div className="font-black text-xs text-slate-900 dark:text-white flex items-center gap-1.5">
                        <span className="uppercase">{modalBaseUom}</span>
                        <span className="text-[10px] text-slate-400 font-bold">(Base Unit)</span>
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                        Rate: ₹{Number(modalBaseRate).toFixed(2)} / {modalBaseUom}
                      </div>
                    </div>
                    <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                      modalSelectedMode === 'BASE' ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-300'
                    }`}>
                      {modalSelectedMode === 'BASE' && <Check className="w-3 h-3" />}
                    </div>
                  </button>

                  {/* Option 2: Alternate UOM */}
                  <button
                    type="button"
                    onClick={() => setModalSelectedMode('ALT')}
                    className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                      modalSelectedMode === 'ALT'
                        ? 'border-indigo-500 bg-indigo-50/60 dark:bg-indigo-950/40 ring-2 ring-indigo-500/20 shadow-xs'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300'
                    }`}
                  >
                    <div>
                      <div className="font-black text-xs text-slate-900 dark:text-white flex items-center gap-1.5">
                        <span className="uppercase">{modalAltUom}</span>
                        <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold">(Alternate Unit)</span>
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                        Rate: ₹{modalAltCatalogRate.toFixed(4)} / {modalAltUom}
                      </div>
                    </div>
                    <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                      modalSelectedMode === 'ALT' ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-300'
                    }`}>
                      {modalSelectedMode === 'ALT' && <Check className="w-3 h-3" />}
                    </div>
                  </button>

                </div>
              </div>

            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-850/80 flex items-center justify-between shrink-0">
              <span className="text-xs font-mono font-bold text-slate-600 dark:text-slate-300">
                Active Formulation Mode: <strong className="text-indigo-600 dark:text-indigo-400 font-black">{modalSelectedMode === 'ALT' ? modalAltUom.toUpperCase() : modalBaseUom.toUpperCase()}</strong>
              </span>

              <div className="flex items-center gap-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setConversionModalOpen(false)}
                  className="rounded-xl cursor-pointer"
                >
                  Cancel
                </Button>
                <Button 
                  type="button" 
                  size="sm" 
                  onClick={handleConfirmConversionModal}
                  className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold cursor-pointer shadow-xs"
                >
                  Apply & Select {modalSelectedMode === 'ALT' ? modalAltUom.toUpperCase() : modalBaseUom.toUpperCase()}
                </Button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════════════
          MODAL 2: BATCH ALLOCATION LOT MODAL (FEFO / GRN)
      ══════════════════════════════════════════════════════════════════════════════ */}
      {lotModalOpen && activeItemIndex !== null && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-3xl w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[92vh]">
            
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0 bg-slate-50/50 dark:bg-slate-850/50">
              <div>
                <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <Boxes className="w-4 h-4 text-indigo-500" />
                  Allocate Stock Lots: {rawMaterials[activeItemIndex]?.rmName}
                </h3>
                <p className="text-[11px] text-slate-400">
                  Select available GRN batches (FEFO Expiry Order). Filter by specific GRN or search by batch number.
                </p>
              </div>
              <button 
                onClick={() => setLotModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* GRN Selector, Search Bar & Status Progress */}
            <div className="p-4 sm:p-6 border-b border-slate-100 dark:border-slate-800 space-y-3.5 shrink-0 bg-slate-50/30 dark:bg-slate-900">
              
              {/* Row 1: Source GRN Dropdown, Batch Search Input & Manual Override Toggle */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                {/* GRN Dropdown */}
                <div className="sm:col-span-5">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1 flex items-center gap-1.5">
                    <Layers className="w-3 h-3 text-indigo-500" />
                    Filter by GRN:
                  </label>
                  <select
                    value={selectedGrnFilter}
                    onChange={(e) => setSelectedGrnFilter(e.target.value)}
                    className="w-full text-xs font-bold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer shadow-2xs"
                  >
                    <option value="ALL">All GRNs ({availableLots.length} total lots available)</option>
                    {uniqueGrnList.map(g => (
                      <option key={g.grnNumber} value={g.grnNumber}>
                        {g.grnNumber} ({g.count} lot{g.count === 1 ? '' : 's'} • {g.totalQty} {rawMaterials[activeItemIndex]?.baseUom || rawMaterials[activeItemIndex]?.selectedUom})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Search Bar */}
                <div className="sm:col-span-4">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1 flex items-center gap-1.5">
                    <Search className="w-3 h-3 text-indigo-500" />
                    Search Batches:
                  </label>
                  <div className="relative">
                    <Input
                      type="text"
                      value={lotSearchTerm}
                      onChange={(e) => setLotSearchTerm(e.target.value)}
                      placeholder="Search batch, supplier batch, PO..."
                      className="h-9 text-xs rounded-xl bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 pl-3 pr-8 shadow-2xs font-medium"
                    />
                    {lotSearchTerm && (
                      <button
                        onClick={() => setLotSearchTerm('')}
                        className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 text-xs cursor-pointer"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>

                {/* Manual Override Form Toggle Button */}
                <div className="sm:col-span-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowManualOverrideForm(!showManualOverrideForm)}
                    className={`w-full h-9 rounded-xl font-bold text-xs border cursor-pointer transition-all flex items-center justify-center gap-1.5 shadow-2xs ${
                      showManualOverrideForm
                        ? 'bg-amber-500 text-white border-amber-600 hover:bg-amber-600'
                        : 'border-indigo-300 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100'
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>{showManualOverrideForm ? 'Close Override Form' : '+ Manual Override'}</span>
                  </Button>
                </div>
              </div>

              {/* Collapsible Manual Override Input Form */}
              {showManualOverrideForm && (
                <div className="p-4 rounded-2xl border-2 border-indigo-300 dark:border-indigo-700 bg-white dark:bg-slate-900 shadow-md space-y-3 animate-in fade-in duration-150">
                  <div className="flex items-center justify-between border-b border-indigo-100 dark:border-slate-800 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="p-1 rounded-lg bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300">
                        <Tag className="w-3.5 h-3.5" />
                      </span>
                      <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
                        Manual Lot Override & Opening Stock Entry
                      </h4>
                    </div>
                    <span className="text-[10px] text-slate-400 font-medium">
                      All fields optional • Pre-filled with smart defaults
                    </span>
                  </div>

                  {/* 10 Fields Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 text-xs">
                    <div>
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-0.5">
                        Our Batch:
                      </label>
                      <Input
                        type="text"
                        value={overrideForm.internalBatchNo}
                        onChange={(e) => setOverrideForm(prev => ({ ...prev, internalBatchNo: e.target.value }))}
                        placeholder="BATCH-MILKFAT4-001"
                        className="h-8 text-xs font-mono font-bold rounded-lg"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-0.5">
                        GRN:
                      </label>
                      <Input
                        type="text"
                        value={overrideForm.grnNumber}
                        onChange={(e) => setOverrideForm(prev => ({ ...prev, grnNumber: e.target.value }))}
                        placeholder="GRN-OPENING"
                        className="h-8 text-xs font-mono font-bold rounded-lg"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-0.5">
                        PO:
                      </label>
                      <Input
                        type="text"
                        value={overrideForm.poNumber}
                        onChange={(e) => setOverrideForm(prev => ({ ...prev, poNumber: e.target.value }))}
                        placeholder="Manual Override"
                        className="h-8 text-xs font-mono font-bold rounded-lg"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-0.5">
                        Batch Qty:
                      </label>
                      <Input
                        type="number"
                        min="1"
                        value={overrideForm.batchQty}
                        onChange={(e) => setOverrideForm(prev => ({ ...prev, batchQty: e.target.value }))}
                        placeholder="1"
                        className="h-8 text-xs font-mono font-bold rounded-lg text-center"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-0.5">
                        Weight:
                      </label>
                      <Input
                        type="text"
                        value={overrideForm.weight}
                        onChange={(e) => setOverrideForm(prev => ({ ...prev, weight: e.target.value }))}
                        placeholder="25 kg / 50"
                        className="h-8 text-xs font-mono font-bold rounded-lg"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-0.5">
                        Available Qty:
                      </label>
                      <Input
                        type="number"
                        min="0"
                        step="any"
                        value={overrideForm.availableQty}
                        onChange={(e) => setOverrideForm(prev => ({ ...prev, availableQty: e.target.value }))}
                        placeholder="4840"
                        className="h-8 text-xs font-mono font-black text-indigo-600 rounded-lg"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-0.5">
                        MFG Batch:
                      </label>
                      <Input
                        type="text"
                        value={overrideForm.supplierBatchNo}
                        onChange={(e) => setOverrideForm(prev => ({ ...prev, supplierBatchNo: e.target.value }))}
                        placeholder="BATCH-01"
                        className="h-8 text-xs font-mono font-bold rounded-lg"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-0.5">
                        MFG Date:
                      </label>
                      <Input
                        type="text"
                        value={overrideForm.mfgDate}
                        onChange={(e) => setOverrideForm(prev => ({ ...prev, mfgDate: e.target.value }))}
                        placeholder="01-10-2026"
                        className="h-8 text-xs font-mono font-bold rounded-lg"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-0.5">
                        Exp Date:
                      </label>
                      <Input
                        type="text"
                        value={overrideForm.expiryDate}
                        onChange={(e) => setOverrideForm(prev => ({ ...prev, expiryDate: e.target.value }))}
                        placeholder="01-10-2027"
                        className="h-8 text-xs font-mono font-bold rounded-lg"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-0.5">
                        Supplier:
                      </label>
                      <Input
                        type="text"
                        value={overrideForm.supplierName}
                        onChange={(e) => setOverrideForm(prev => ({ ...prev, supplierName: e.target.value }))}
                        placeholder="SUP-LOT-DIRECT"
                        className="h-8 text-xs font-mono font-medium rounded-lg"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      When applied, this lot appears at the top for immediate allocation and will update on the RM Stock page.
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleAddManualOverrideLot}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs rounded-xl shadow-xs cursor-pointer h-8"
                    >
                      <Check className="w-3.5 h-3.5 mr-1" />
                      Apply Manual Override Lot
                    </Button>
                  </div>
                </div>
              )}

              {/* Row 2: Required vs Allocated Status Pill */}
              <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 shadow-2xs text-xs font-mono">
                <div className="flex items-center gap-4 flex-wrap">
                  <span>
                    Required: <strong className="text-slate-900 dark:text-white font-black">{rawMaterials[activeItemIndex]?.baseRequiredQty || rawMaterials[activeItemIndex]?.requiredQty} {rawMaterials[activeItemIndex]?.baseUom || rawMaterials[activeItemIndex]?.selectedUom}</strong>
                  </span>
                  <span>•</span>
                  <span>
                    Allocated: <strong className="text-indigo-600 dark:text-indigo-400 font-black">{totalAllocatedInModal} {rawMaterials[activeItemIndex]?.baseUom || rawMaterials[activeItemIndex]?.selectedUom}</strong>
                  </span>
                  <span>•</span>
                  <span>
                    Balance: <strong className={totalAllocatedInModal >= Number(rawMaterials[activeItemIndex]?.baseRequiredQty || rawMaterials[activeItemIndex]?.requiredQty || 0) ? 'text-emerald-600' : 'text-amber-600'}>
                      {Math.max(0, Number(rawMaterials[activeItemIndex]?.baseRequiredQty || rawMaterials[activeItemIndex]?.requiredQty || 0) - totalAllocatedInModal).toFixed(2)} {rawMaterials[activeItemIndex]?.baseUom || rawMaterials[activeItemIndex]?.selectedUom}
                    </strong>
                  </span>
                </div>

                <div>
                  {totalAllocatedInModal >= Number(rawMaterials[activeItemIndex]?.baseRequiredQty || rawMaterials[activeItemIndex]?.requiredQty || 0) ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-emerald-700 bg-emerald-50 dark:bg-emerald-950/80 dark:text-emerald-300 px-2 py-0.5 rounded-lg border border-emerald-200 dark:border-emerald-800">
                      <Check className="w-3 h-3 text-emerald-600" />
                      Fulfilled
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-amber-700 bg-amber-50 dark:bg-amber-950/80 dark:text-amber-300 px-2 py-0.5 rounded-lg border border-amber-200 dark:border-amber-800">
                      Pending Allocation
                    </span>
                  )}
                </div>
              </div>

            </div>

            {/* Lots List Body */}
            <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">
              {loadingLots ? (
                <div className="p-12 text-center text-xs font-bold text-slate-400 space-y-2">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto text-indigo-500" />
                  <p>Loading active inventory batches & FEFO expiry dates...</p>
                </div>
              ) : displayedLots.length === 0 ? (
                <div className="p-8 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 text-center space-y-2 bg-slate-50/50 dark:bg-slate-850">
                  <AlertTriangle className="w-7 h-7 text-amber-500 mx-auto" />
                  <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    No matching lots found for the current filter.
                  </p>
                  <p className="text-[11px] text-slate-400">
                    {selectedGrnFilter !== 'ALL' ? 'Try changing the GRN filter to "All GRNs" or clearing search.' : 'Material will be fulfilled from general warehouse stock.'}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="text-[11px] font-black text-slate-500 uppercase tracking-wider flex items-center justify-between">
                    <span>Available Lots (Sorted by FEFO Expiry):</span>
                    <span>Showing {displayedLots.length} of {availableLots.length} lot{availableLots.length === 1 ? '' : 's'}</span>
                  </div>

                  <div className="space-y-3">
                    {displayedLots.map((lot, lIdx) => {
                      const avail = Number(lot.availableQty || lot.netQty || 0);
                      const currentAlloc = lotAllocations[lot.id] || '';
                      const isExpired = lot.expiryDate && new Date(lot.expiryDate) < new Date();
                      const currentSupplierBatch = manualSupplierBatches[lot.id] ?? (lot.supplierBatchNo || lot.mfgBatchNo || '');
                      const uomLabel = rawMaterials[activeItemIndex]?.baseUom || rawMaterials[activeItemIndex]?.selectedUom || 'units';

                      return (
                        <div 
                          key={lot.id}
                          className={`p-4 rounded-2xl border transition-all space-y-3 shadow-2xs ${
                            Number(currentAlloc) > 0
                              ? 'border-indigo-400 dark:border-indigo-600 bg-indigo-50/30 dark:bg-indigo-950/20 ring-1 ring-indigo-400/40'
                              : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300'
                          }`}
                        >
                          {/* Top Row: Our Batch Badge & GRN / PO Reference Badges */}
                          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-2.5">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                                Our Batch:
                              </span>
                              <span className="inline-flex items-center gap-1.5 font-mono font-black text-xs text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/80 px-2.5 py-1 rounded-lg border border-indigo-200 dark:border-indigo-800">
                                <Tag className="w-3 h-3 text-indigo-500" />
                                {lot.internalBatchNo}
                              </span>
                              {lIdx === 0 && !isExpired && (
                                <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                                  🥇 FEFO Earliest
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 flex-wrap font-mono">
                              {lot.isManualOverride && (
                                <span className="px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 text-[10px] font-black border border-amber-300 dark:border-amber-800">
                                  🛠 Manual Override
                                </span>
                              )}
                              <span className="px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold border border-emerald-200 dark:border-emerald-800">
                                GRN: {lot.grnNumber || lot.grnRef || 'GRN-OPENING'}
                              </span>
                              <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[10px] font-bold border border-slate-200 dark:border-slate-700">
                                PO: {lot.poNumber || lot.poReferenceNo || 'Manual Override'}
                              </span>
                            </div>
                          </div>

                          {/* Grid of All Batch Details: Batch Qty, Weight, MFG Batch, MFG Date, EXP Date */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs bg-slate-50/70 dark:bg-slate-850 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                            
                            {/* 1. Batch Qty */}
                            <div>
                              <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider">Batch Qty:</span>
                              <span className="font-mono font-bold text-slate-800 dark:text-slate-200 text-xs">
                                {lot.batchQty ?? 1}
                              </span>
                            </div>

                            {/* 2. Weight */}
                            <div>
                              <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider">Weight:</span>
                              <span className="font-mono font-bold text-slate-800 dark:text-slate-200 text-xs">
                                {lot.weight || 'e.g. 25 kg / 50'}
                              </span>
                            </div>

                            {/* 3. Available Qty */}
                            <div>
                              <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider">Available Qty:</span>
                              <span className="font-mono font-black text-indigo-600 dark:text-indigo-400 text-xs">
                                {avail} {uomLabel}
                              </span>
                            </div>

                            {/* 4. MFG Batch (Supplier) with Inline Edit */}
                            <div>
                              <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider">MFG Batch:</span>
                              <input
                                type="text"
                                value={currentSupplierBatch}
                                onChange={(e) => setManualSupplierBatches(prev => ({
                                  ...prev,
                                  [lot.id]: e.target.value
                                }))}
                                placeholder="e.g. BATCH-01"
                                className="font-mono font-bold text-slate-800 dark:text-slate-200 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded px-1.5 py-0.5 w-full max-w-[120px] focus:outline-indigo-500"
                                title="Manual supplier batch number (editable)"
                              />
                            </div>

                            {/* 5. MFG Date */}
                            <div>
                              <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider">MFG Date:</span>
                              <span className="font-mono font-semibold text-slate-700 dark:text-slate-300 text-xs flex items-center gap-1">
                                <Calendar className="w-3 h-3 text-slate-400" />
                                {formatDateDMY(lot.mfgDate)}
                              </span>
                            </div>

                            {/* 6. Exp Date */}
                            <div>
                              <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider">Exp Date:</span>
                              <span className={`font-mono font-bold text-xs flex items-center gap-1 ${
                                isExpired ? 'text-rose-600 dark:text-rose-400' : 'text-slate-700 dark:text-slate-300'
                              }`}>
                                <Calendar className="w-3 h-3 text-slate-400" />
                                {formatDateDMY(lot.expiryDate)}
                              </span>
                            </div>

                            {/* 7. Supplier Name */}
                            {lot.supplierName && (
                              <div className="col-span-2">
                                <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider">Supplier:</span>
                                <span className="text-slate-700 dark:text-slate-300 truncate block text-xs font-medium">
                                  {lot.supplierName}
                                </span>
                              </div>
                            )}

                          </div>

                          {/* Allocation Controls: Quick Buttons + Allocate Qty Input */}
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => handleFillRemaining(lot.id, avail)}
                                className="h-7 text-[10px] px-2.5 rounded-lg font-bold border-indigo-200 dark:border-indigo-800 hover:bg-indigo-50 text-indigo-600 dark:text-indigo-400 cursor-pointer"
                              >
                                Allocate Remaining
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => handleSetLotQty(lot.id, avail, avail)}
                                className="h-7 text-[10px] px-2 rounded-lg text-slate-500 hover:text-indigo-600 cursor-pointer"
                              >
                                Max ({avail})
                              </Button>
                              {Number(currentAlloc) > 0 && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleSetLotQty(lot.id, 0, avail)}
                                  className="h-7 text-[10px] px-2 rounded-lg text-rose-500 hover:bg-rose-50 cursor-pointer"
                                >
                                  Clear
                                </Button>
                              )}
                            </div>

                            <div className="flex items-center gap-2 self-end sm:self-auto">
                              <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">
                                Allocate Qty:
                              </label>
                              <div className="w-28">
                                <Input
                                  type="number"
                                  min="0"
                                  max={avail}
                                  step="any"
                                  value={currentAlloc}
                                  onChange={(e) => handleSetLotQty(lot.id, e.target.value, avail)}
                                  placeholder={`0 / ${avail}`}
                                  className="h-8 text-center font-mono font-black text-xs rounded-xl border-indigo-300 dark:border-indigo-700 focus:ring-2 focus:ring-indigo-500"
                                />
                              </div>
                              <span className="text-xs font-mono font-bold text-slate-400">
                                {uomLabel}
                              </span>
                            </div>
                          </div>

                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-850/80 flex items-center justify-between shrink-0">
              <span className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300">
                Total Allocated: <strong className="text-indigo-600 dark:text-indigo-400 font-black">{totalAllocatedInModal}</strong> {rawMaterials[activeItemIndex]?.baseUom || rawMaterials[activeItemIndex]?.selectedUom}
              </span>

              <div className="flex items-center gap-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setLotModalOpen(false)}
                  className="rounded-xl cursor-pointer"
                >
                  Cancel
                </Button>
                <Button 
                  type="button" 
                  size="sm" 
                  onClick={handleSaveAllocations}
                  className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold cursor-pointer shadow-xs"
                >
                  Confirm Lot Allocations
                </Button>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
