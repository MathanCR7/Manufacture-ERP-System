import React, { useState, useEffect, useMemo } from 'react';
import { api } from '@/lib/axios';
import { 
  Tag, Boxes, RefreshCw, Plus, Minus, Trash2, Check, AlertTriangle, 
  HelpCircle, Calendar, ShieldCheck, Database, X, ArrowRight, Layers, ArrowLeftRight,
  Search, Edit3, Filter, Copy, Scale, Sparkles, Calculator, Sliders, CheckCircle2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import useAuthStore from '@/app/store/authStore';
import Swal from 'sweetalert2';

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
    if (role === 'MAIN_MASTER' || role === 'ADMIN' || role === 'SUPERVISOR') return false;
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
  const [loadingLots, setLoadingLots] = useState(false);
  const [availableLots, setAvailableLots] = useState([]);
  const [lotAllocations, setLotAllocations] = useState({}); // { [lotId]: allocatedQty }
  const [selectedGrnFilter, setSelectedGrnFilter] = useState('ALL');
  const [lotSearchTerm, setLotSearchTerm] = useState('');
  const [manualSupplierBatches, setManualSupplierBatches] = useState({}); // { [lotId]: string }

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
    return (itemSetupMasters || []).filter(m =>
      (m.name && m.name.toLowerCase().includes(q)) ||
      (m.code && m.code.toLowerCase().includes(q)) ||
      (m.category && m.category.toLowerCase().includes(q))
    );
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
    const num = Number(value || 0);

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
    const r = Number(value || 0);

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

    const today = new Date();
    const dd = String(today.getDate()).padStart(2, '0');
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const yyyy = today.getFullYear();
    const mfgStr = `${dd}-${mm}-${yyyy}`;
    const expStr = `${dd}-${mm}-${yyyy + 1}`;

    // Sensible defaults while live metadata fetches
    setOverrideForm({
      internalBatchNo: `BATCH-${rawClean}-001`,
      grnNumber: 'GRN-MANUAL-OVERRIDE',
      poNumber: 'PO-MANUAL-OVERRIDE',
      batchQty: 1,
      weight: '25 kg / 50',
      availableQty: Math.max(reqQty || 100, 4840),
      supplierBatchNo: 'BATCH-01',
      mfgDate: mfgStr,
      expiryDate: expStr,
      supplierName: 'SUP-LOT-DIRECT',
      latestPoNumber: null,
      latestBatchNumber: null
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
      const [batchesRes, metaRes] = await Promise.all([
        api.get(`/production/rm-batches/${item.rmId}`),
        api.get(`/production/rm-batch-meta/${item.rmId}?rmName=${encodeURIComponent(item.rmName || '')}`).catch(() => null)
      ]);
      const lots = batchesRes.data || [];
      const meta = metaRes?.data || null;

      setAvailableLots(lots);

      // 1. Resolve latest PO number for this responsive raw material
      let resolvedPo = meta?.latestPoNumber;
      if (!resolvedPo || resolvedPo === 'PO-OPENING' || resolvedPo === 'PO-MANUAL-OVERRIDE') {
        const poLot = lots.find(l => l.poNumber && !l.poNumber.startsWith('PO-OPEN') && !l.poNumber.includes('Override'));
        if (poLot) resolvedPo = poLot.poNumber;
      }
      if (!resolvedPo) resolvedPo = 'PO-MANUAL-OVERRIDE';

      // 2. Resolve continuing sequential batch number for this responsive raw material
      let resolvedBatch = meta?.nextBatchNumber;
      if (!resolvedBatch) {
        let maxSeq = 0;
        lots.forEach(l => {
          const m = (l.internalBatchNo || '').match(new RegExp(`^BATCH-${rawClean}-(\\d+)`, 'i'));
          if (m && m[1]) {
            const p = parseInt(m[1], 10);
            if (p > maxSeq) maxSeq = p;
          }
        });
        resolvedBatch = `BATCH-${rawClean}-${String(maxSeq + 1).padStart(3, '0')}`;
      }

      setOverrideForm({
        internalBatchNo: resolvedBatch,
        grnNumber: 'GRN-MANUAL-OVERRIDE',
        poNumber: resolvedPo,
        batchQty: 1,
        weight: '25 kg / 50',
        availableQty: Math.max(reqQty || 100, 4840),
        supplierBatchNo: 'BATCH-01',
        mfgDate: mfgStr,
        expiryDate: expStr,
        supplierName: meta?.latestSupplierName || lots[0]?.supplierName || 'SUP-LOT-DIRECT',
        latestPoNumber: resolvedPo,
        latestBatchNumber: meta?.latestBatchNumber || null
      });
    } catch (err) {
      console.error('Failed to fetch RM batches or meta in BatchAllocationGrid:', err);
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
      grnNumber: overrideForm.grnNumber?.trim() || 'GRN-MANUAL-OVERRIDE',
      grnRef: overrideForm.grnNumber?.trim() || 'GRN-MANUAL-OVERRIDE',
      poNumber: overrideForm.poNumber?.trim() || 'PO-MANUAL-OVERRIDE',
      poReferenceNo: overrideForm.poNumber?.trim() || 'PO-MANUAL-OVERRIDE',
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

    // Auto-advance sequence so next manual lot continues cleanly
    const currBatch = newLot.internalBatchNo;
    const match = currBatch.match(/^(.*?)(\d+)$/);
    if (match) {
      const pfx = match[1];
      const seq = parseInt(match[2], 10);
      const nextBatchStr = `${pfx}${String(seq + 1).padStart(match[2].length, '0')}`;
      setOverrideForm(prev => ({
        ...prev,
        internalBatchNo: nextBatchStr,
        latestBatchNumber: currBatch
      }));
    }

    setShowManualOverrideForm(false);
    Swal.fire({
      title: 'Manual Override Lot Added',
      html: `
        <div style="text-align: left; font-size: 13px; line-height: 1.6;">
          <p><strong>✓ Our Batch (Continuing):</strong> <span style="font-family: monospace; font-weight: bold; color: #4f46e5;">${newLot.internalBatchNo}</span></p>
          <p><strong>✓ GRN:</strong> <span style="font-family: monospace; font-weight: bold; color: #d97706;">${newLot.grnNumber} (Manual Override)</span></p>
          <p><strong>✓ PO Number:</strong> <span style="font-family: monospace; font-weight: bold;">${newLot.poNumber}</span></p>
          <p><strong>✓ Available Stock:</strong> ${newLot.availableQty} ${item?.baseUom || item?.selectedUom || 'units'}</p>
        </div>
      `,
      icon: 'success',
      timer: 2000
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
        const suppBatch = (lot.supplierBatchNo || lot.mfgBatchNo || '').toLowerCase();
        const grn = (lot.grnNumber || lot.grnRef || '').toLowerCase();
        const po = (lot.poNumber || lot.poReferenceNo || '').toLowerCase();
        const supplier = (lot.supplierName || '').toLowerCase();
        const weight = (lot.weight || '').toLowerCase();
        if (
          !ourBatch.includes(q) &&
          !suppBatch.includes(q) &&
          !grn.includes(q) &&
          !po.includes(q) &&
          !supplier.includes(q) &&
          !weight.includes(q)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [availableLots, selectedGrnFilter, lotSearchTerm]);

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
          internalBatchNo: lot.internalBatchNo,
          supplierBatchNo: effectiveSupplierBatch,
          mfgBatchNo: effectiveSupplierBatch,
          batchQty: lot.batchQty ?? 1,
          weight: lot.weight || '25 kg / 50',
          mfgDate: lot.mfgDate || null,
          expiryDate: lot.expiryDate || null,
          grnNumber: lot.grnNumber || lot.grnRef || (lot.isManualOverride ? 'GRN-MANUAL-OVERRIDE' : null),
          poNumber: lot.poNumber || lot.poReferenceNo || (lot.isManualOverride ? 'PO-MANUAL-OVERRIDE' : null),
          allocatedQty: qty,
          poOriginalQty: poOrigQty,
          poTotalAmount: poTotAmt,
          allocatedAmount,
          unitRate,
          uom: item.baseUom || item.selectedUom,
          isManualOverride: Boolean(lot.isManualOverride || lot.source === 'MANUAL_OVERRIDE' || (lot.id && String(lot.id).startsWith('manual-'))),
          source: lot.source || (lot.isManualOverride ? 'MANUAL_OVERRIDE' : 'PURCHASE_GRN')
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

                  {/* Material Name & Code */}
                  <td className="py-2.5 px-3">
                    <div className="font-bold text-slate-900 dark:text-white">
                      {row.rmName}
                    </div>
                    <div className="text-[10px] font-mono text-slate-400 flex items-center gap-1.5 flex-wrap">
                      <span>{row.rmCode || 'RM'}</span>
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
              {/* Header: SN, Material Name, Code, and Delete */}
              <div className="flex items-start justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-2.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="w-6 h-6 rounded-lg bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-mono font-black text-xs flex items-center justify-center">
                    #{index + 1}
                  </span>
                  <div>
                    <h5 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white">
                      {row.rmName}
                    </h5>
                    <div className="text-[10px] font-mono text-slate-400 flex items-center gap-2">
                      <span>{row.rmCode || 'RM'}</span>
                      {hasAlt && altUomClean && (
                        <span className="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 font-semibold text-[9px] border border-indigo-200 dark:border-indigo-800">
                          1 {baseUomClean} = {factor} {altUomClean}
                        </span>
                      )}
                    </div>
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
                    value={displayQty}
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
                          ({b.allocatedQty} {row.baseUom || row.selectedUom})
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
                      placeholder="Search batch, GRN, MFG batch, supplier..."
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
                      <div className="flex items-center justify-between mb-0.5">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">
                          Our Batch:
                        </label>
                        {overrideForm.latestBatchNumber && (
                          <span className="text-[8px] font-mono text-indigo-600 font-bold" title="Continues after latest batch number">
                            Cont.
                          </span>
                        )}
                      </div>
                      <Input
                        type="text"
                        value={overrideForm.internalBatchNo}
                        onChange={(e) => setOverrideForm(prev => ({ ...prev, internalBatchNo: e.target.value }))}
                        placeholder="e.g. BATCH-MILKFAT4-007"
                        className="h-8 text-xs font-mono font-bold rounded-lg border-indigo-300 dark:border-indigo-700 bg-indigo-50/20"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-wider block mb-0.5">
                        GRN (Manual Override):
                      </label>
                      <Input
                        type="text"
                        value={overrideForm.grnNumber}
                        onChange={(e) => setOverrideForm(prev => ({ ...prev, grnNumber: e.target.value }))}
                        placeholder="GRN-MANUAL-OVERRIDE"
                        className="h-8 text-xs font-mono font-bold rounded-lg border-amber-300 dark:border-amber-700 bg-amber-50/20 text-amber-800 dark:text-amber-200"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-0.5">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">
                          PO:
                        </label>
                        {overrideForm.latestPoNumber && overrideForm.latestPoNumber !== 'PO-MANUAL-OVERRIDE' && (
                          <span className="text-[8px] font-mono text-emerald-600 font-bold">
                            Latest PO
                          </span>
                        )}
                      </div>
                      <Input
                        type="text"
                        value={overrideForm.poNumber}
                        onChange={(e) => setOverrideForm(prev => ({ ...prev, poNumber: e.target.value }))}
                        placeholder="e.g. PO-000013"
                        className="h-8 text-xs font-mono font-bold rounded-lg border-slate-300 dark:border-slate-700"
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

                            {/* 4. MFG Batch (Supplier) - Strictly Read-Only */}
                            <div>
                              <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider">MFG Batch:</span>
                              <span 
                                className="font-mono font-bold text-slate-800 dark:text-slate-200 text-xs bg-slate-100 dark:bg-slate-800/80 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700 inline-block max-w-[130px] truncate select-all"
                                title={`Manufacturer Batch: ${lot.mfgBatchNo || lot.supplierBatchNo || 'N/A'}`}
                              >
                                {lot.mfgBatchNo || lot.supplierBatchNo || 'N/A'}
                              </span>
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
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-black text-slate-900 dark:text-white truncate">
                              {m.name}
                            </span>
                            {alreadyInBatch && (
                              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200">
                                In Batch
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] font-mono text-slate-400 flex items-center gap-1.5 mt-0.5">
                            <span>{m.code || 'RM'}</span>
                            <span>•</span>
                            <span className="font-semibold text-slate-600 dark:text-slate-300">Base: {baseUom}</span>
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
                  <div className="flex items-center justify-between pb-2 border-b border-slate-200/80 dark:border-slate-800">
                    <div>
                      <span className="text-[10px] uppercase font-mono font-bold text-slate-400 block">
                        Selected Formulation Material:
                      </span>
                      <h4 className="text-sm font-black text-slate-900 dark:text-white">
                        {selectedRmToAdd.name} ({selectedRmToAdd.code || 'RM'})
                      </h4>
                    </div>

                    {/* UOM mode toggle if Alternate UOM enabled */}
                    {selectedRmToAdd.hasAlternateUom && selectedRmToAdd.alternateUom && (
                      <div className="flex items-center gap-1 bg-white dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold">
                        <button
                          type="button"
                          onClick={() => setAddRmMode('BASE')}
                          className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                            addRmMode === 'BASE'
                              ? 'bg-indigo-600 text-white shadow-2xs'
                              : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                          }`}
                        >
                          {selectedRmToAdd.unitId || selectedRmToAdd.consumptionUnit || 'Base'} (Base)
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
                          value={addRmQty}
                          onChange={(e) => setAddRmQty(e.target.value)}
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
                            value={addRmRate}
                            onChange={(e) => setAddRmRate(e.target.value)}
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
