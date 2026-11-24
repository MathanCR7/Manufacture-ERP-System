import React, { useState, useEffect, useMemo } from 'react';
import useAuthStore from '@/app/store/authStore';
import {
  X,
  Boxes,
  Layers,
  Search,
  Sparkles,
  Tag,
  AlertCircle,
  AlertTriangle,
  RefreshCw,
  Check,
  Calendar,
  Scale,
  Zap,
  ArrowRightLeft
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/axios';
import Swal from 'sweetalert2';

// Helper: Format date to DD-MM-YYYY
function formatDateDMY(d) {
  if (!d) return 'N/A';
  try {
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return String(d);
    const day = String(dt.getDate()).padStart(2, '0');
    const month = String(dt.getMonth() + 1).padStart(2, '0');
    const year = dt.getFullYear();
    return `${day}-${month}-${year}`;
  } catch (_) {
    return String(d);
  }
}

// Helper: Clean UUID-like UOM strings
function cleanUomString(raw, fallback = 'units') {
  if (!raw) return fallback;
  const str = String(raw).trim();
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str)) {
    return fallback;
  }
  return str;
}

/**
 * ProductionLotAllocationModal
 * 
 * Unified FEFO/FIFO Stock Lot Allocation Modal for:
 * 1. Standard Production Form (/production/standard/add via BatchAllocationGrid)
 * 2. Floor Cockpit (/production/standard/cockpit via ProductionFloorCockpitModal)
 * 3. Order-Based & Stock-Update Production pages
 * 
 * Features:
 * - Live inventory lot fetching (GET /production/rm-batches/:rmId)
 * - True FEFO (First Expired, First Out) & FIFO sorting
 * - Seamless Base UOM & Alternate UOM switching (e.g. liter <-> ml, kg <-> gm)
 * - Automatic FIFO lot allocation for required qty (e.g. 400 ml from 160,000 ml lot)
 * - Full 10-field Manual Override form with continuing internal batch numbering
 * - Live PO rate fetching & blended costing calculations
 */
export default function ProductionLotAllocationModal({
  isOpen,
  onClose,
  row,
  master = null,
  catalog = [],
  onConfirm,
  titlePrefix = 'Allocate Stock Lots'
}) {
  if (!isOpen || !row) return null;

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

  // Resolve master definition if not explicitly provided
  const resolvedMaster = useMemo(() => {
    if (master) return master;
    if (!Array.isArray(catalog) || catalog.length === 0) return null;
    const rId = row.rawMaterialId || row.rmId || row.id;
    const rCode = row.rawMaterialCode || row.rmCode || row.code;
    return catalog.find(c => (rId && c.id === rId) || (rCode && c.code === rCode)) || null;
  }, [master, catalog, row]);

  // Resolve RM core fields
  const rmId = row.rawMaterialId || row.rmId || row.id || resolvedMaster?.id;
  const rmCode = row.rawMaterialCode || row.rmCode || row.code || resolvedMaster?.code || '';
  const rmName = row.rawMaterialName || row.rmName || row.name || resolvedMaster?.name || 'Raw Material';
  const categoryName = resolvedMaster?.category?.name || row.categoryName || row.category || 'Raw Material';
  const descriptionText = resolvedMaster?.storageNotes || resolvedMaster?.description || row.storageNotes || row.description || '';

  // Resolve Base UOM & Alternate UOM parameters
  const rawBase =
    resolvedMaster?.unitId ||
    row?.baseUom ||
    (row?.uom && row?.uom !== row?.alternateUom ? row?.uom : null) ||
    resolvedMaster?.consumptionUnit ||
    'liter';
  const baseUom = cleanUomString(rawBase, 'units');

  const hasAlt = Boolean(
    resolvedMaster
      ? (resolvedMaster.hasAlternateUom && resolvedMaster.alternateUom)
      : (row.hasAlternateUom && row.alternateUom)
  );
  const rawAlt = resolvedMaster?.alternateUom || row.alternateUom || resolvedMaster?.consumptionUnit;
  const altUom = hasAlt ? cleanUomString(rawAlt, 'ml') : null;

  const conversionFactor = useMemo(() => {
    let f = Number(
      resolvedMaster?.conversionFactor ||
      (resolvedMaster?.alternateUomQty && resolvedMaster?.baseUomQty ? (resolvedMaster.alternateUomQty / resolvedMaster.baseUomQty) : null) ||
      row.conversionFactor ||
      (row.alternateUomQty && row.baseUomQty ? (row.alternateUomQty / row.baseUomQty) : null) ||
      1000
    );
    const bStr = String(baseUom || '').toLowerCase();
    const aStr = String(altUom || '').toLowerCase();
    if ((bStr === 'kg' || bStr === 'kgs' || bStr === 'kilogram' || bStr === 'liter' || bStr === 'litre' || bStr === 'l') &&
        (aStr === 'gm' || aStr === 'g' || aStr === 'gram' || aStr === 'ml' || aStr === 'milliliter')) {
      if (f > 0 && f < 1) f = Math.round(1 / f);
      if (!f || f <= 1) f = 1000;
    }
    return f > 0 ? f : 1000;
  }, [resolvedMaster, row, baseUom, altUom]);

  // Initial UOM mode determination: accurately match current row UOM
  const initialMode = useMemo(() => {
    if (!hasAlt || !altUom) return 'BASE';
    const rowUom = String(row?.selectedUom || row?.uom || '').trim().toLowerCase();
    const baseUomLower = String(baseUom || '').trim().toLowerCase();
    const altUomLower = String(altUom || '').trim().toLowerCase();

    // 1. Direct match with current row UOM:
    if (rowUom && rowUom === baseUomLower) return 'BASE';
    if (rowUom && rowUom === altUomLower) return 'ALT';

    // 2. Unit family match:
    const isSmall = (u) => ['ml', 'milliliter', 'millilitre', 'mls', 'gm', 'g', 'gram', 'grams', 'gms', 'grm', 'grms'].includes(String(u || '').toLowerCase().trim());
    const isLarge = (u) => ['liter', 'ltr', 'l', 'litre', 'liters', 'litres', 'kg', 'kgs', 'kilogram', 'kilograms', 'kilo'].includes(String(u || '').toLowerCase().trim());

    if (isSmall(rowUom)) {
      if (isSmall(baseUomLower)) return 'BASE';
      if (isSmall(altUomLower)) return 'ALT';
    }
    if (isLarge(rowUom)) {
      if (isLarge(baseUomLower)) return 'BASE';
      if (isLarge(altUomLower)) return 'ALT';
    }

    // 3. Fallback to row.activeEntryMode
    if (row?.activeEntryMode === 'ALT') return 'ALT';
    if (row?.activeEntryMode === 'BASE') return 'BASE';
    return 'BASE';
  }, [hasAlt, altUom, baseUom, row]);

  // Active UOM Mode state: 'BASE' (e.g. liter or ml) or 'ALT' (e.g. ml or liter)
  const [uomMode, setUomMode] = useState(initialMode);

  // Sync mode if row changes
  useEffect(() => {
    setUomMode(initialMode);
  }, [initialMode]);

  // Current active UOM label & conversion multiplier relative to base inventory lots
  const activeUom = uomMode === 'ALT' && altUom ? altUom : baseUom;
  const uomFactor = uomMode === 'ALT' && hasAlt ? conversionFactor : 1;

  // Resolve target required quantity in active UOM
  const targetRequiredQty = useMemo(() => {
    const rawVal = Number(row?.requiredQty ?? row?.takenQty ?? row?.qty ?? 0);
    const rowUom = String(row?.selectedUom || row?.uom || '').trim().toLowerCase();
    const altUomLower = String(altUom || '').trim().toLowerCase();
    const baseUomLower = String(baseUom || '').trim().toLowerCase();

    const isRowInAlt = (hasAlt && Boolean(altUomLower) && rowUom === altUomLower) ||
      (row?.activeEntryMode === 'ALT' && rowUom !== baseUomLower);
    const isRowInBase = (Boolean(baseUomLower) && rowUom === baseUomLower) ||
      (row?.activeEntryMode === 'BASE' && rowUom !== altUomLower);

    // If row explicitly tracks baseRequiredQty and altRequiredQty
    if (uomMode === 'ALT' && hasAlt) {
      if (isRowInAlt && rawVal > 0) return rawVal;
      if (row.altRequiredQty !== undefined && Number(row.altRequiredQty) > 0) {
        return Number(row.altRequiredQty);
      }
      const bQty = Number(row.baseRequiredQty !== undefined ? row.baseRequiredQty : rawVal);
      return Number((bQty * conversionFactor).toFixed(4));
    }

    // Base mode
    if (isRowInBase && rawVal > 0) return rawVal;
    if (row.baseRequiredQty !== undefined && Number(row.baseRequiredQty) > 0) {
      return Number(row.baseRequiredQty);
    }
    if (isRowInAlt && conversionFactor > 0) {
      return Number((rawVal / conversionFactor).toFixed(6));
    }
    return rawVal;
  }, [row, uomMode, hasAlt, conversionFactor, altUom, baseUom]);

  // Lots state
  const [loadingLots, setLoadingLots] = useState(true);
  const [availableLots, setAvailableLots] = useState([]);
  const [lotAllocations, setLotAllocations] = useState({}); // { [lotId]: allocatedQtyInActiveUom }
  const [manualSupplierBatches, setManualSupplierBatches] = useState({});
  const [selectedGrnFilter, setSelectedGrnFilter] = useState('ALL');
  const [lotSearchTerm, setLotSearchTerm] = useState('');

  // Manual Override Form State
  const [showManualOverrideForm, setShowManualOverrideForm] = useState(false);
  const [overrideForm, setOverrideForm] = useState({
    internalBatchNo: '',
    grnNumber: 'GRN-MANUAL-OVERRIDE',
    poNumber: 'PO-MANUAL-OVERRIDE',
    batchQty: 1,
    weight: '25 kg / 50',
    availableQty: 100,
    supplierBatchNo: 'BATCH-01',
    mfgDate: '',
    expiryDate: '',
    supplierName: 'SUP-LOT-DIRECT',
    latestPoNumber: null,
    latestBatchNumber: null
  });

  // Load live lots from backend on modal open
  useEffect(() => {
    let isCancelled = false;

    async function fetchLiveLotsAndMeta() {
      if (!rmId) {
        setLoadingLots(false);
        return;
      }

      setLoadingLots(true);
      const cleanCode = (rmName || rmCode || 'RM')
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '')
        .slice(0, 16);

      const today = new Date();
      const dd = String(today.getDate()).padStart(2, '0');
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      const yyyy = today.getFullYear();
      const mfgStr = `${dd}-${mm}-${yyyy}`;
      const expStr = `${dd}-${mm}-${yyyy + 1}`;

      try {
        const [batchesRes, metaRes] = await Promise.all([
          api.get(`/production/rm-batches/${rmId}`),
          api.get(`/production/rm-batch-meta/${rmId}?rmName=${encodeURIComponent(rmName || '')}`).catch(() => null)
        ]);

        if (isCancelled) return;

        const rawLots = Array.isArray(batchesRes.data) ? batchesRes.data : [];
        // Strictly filter out any lots that have 0 remaining balance or are marked DEPLETED
        const lots = rawLots.filter(l => Number(l.availableQty ?? l.netQty ?? 0) > 0.0001 && l.status !== 'DEPLETED');
        
        // Fallback to catalog availableBatches if endpoint returned empty but catalog has active batches
        if (lots.length === 0 && Array.isArray(master?.availableBatches) && master.availableBatches.length > 0) {
          master.availableBatches.forEach(mb => {
            if (Number(mb.remainingQty || mb.availableQty || 0) > 0.0001) {
              lots.push({
                id: mb.id,
                internalBatchNo: mb.batchNo,
                supplierBatchNo: mb.batchNo,
                mfgBatchNo: mb.batchNo,
                availableQty: Number(mb.remainingQty || mb.availableQty),
                netQty: Number(mb.remainingQty || mb.availableQty),
                expiryDate: mb.expiryDate,
                unitRate: Number(mb.unitRate || row.unitRate || 0),
                source: 'PURCHASE_GRN'
              });
            }
          });
        }
        const meta = metaRes?.data || null;

        // Ensure lots are strictly sorted in FEFO / FIFO expiry order
        lots.sort((a, b) => {
          const tA = a.expiryDate ? new Date(a.expiryDate).getTime() : Infinity;
          const tB = b.expiryDate ? new Date(b.expiryDate).getTime() : Infinity;
          if (tA !== tB) return tA - tB;
          return (a.id || '').localeCompare(b.id || '');
        });

        setAvailableLots(lots);

        // Prepopulate existing allocations if any
        const existingMap = {};
        const supplierMap = {};
        let existingSumInActiveUom = 0;

        if (Array.isArray(row.allocatedBatches) && row.allocatedBatches.length > 0) {
          row.allocatedBatches.forEach(b => {
            const rawAlloc = Number(b.allocatedQty || 0);
            if (rawAlloc <= 0) return;

            // Resolve whether b.allocatedQty was stored in Base or Alt
            let qtyInActiveMode = rawAlloc;
            if (uomMode === 'ALT') {
              // If stored in base UOM (e.g. 0.4 liter), convert to Alt (400 ml)
              if (b.allocatedAltQty && Number(b.allocatedAltQty) > 0) {
                qtyInActiveMode = Number(b.allocatedAltQty);
              } else if (b.uom === baseUom || b.uom !== altUom) {
                qtyInActiveMode = Number((rawAlloc * conversionFactor).toFixed(4));
              }
            } else {
              // Base mode
              if (b.allocatedQty && Number(b.allocatedQty) > 0) {
                qtyInActiveMode = Number(b.allocatedQty);
              } else if (b.uom === altUom && conversionFactor > 0) {
                qtyInActiveMode = Number((rawAlloc / conversionFactor).toFixed(4));
              }
            }

            const k = b.batchId || b.id || b.internalBatchNo;
            existingMap[k] = qtyInActiveMode;
            existingSumInActiveUom += qtyInActiveMode;

            if (b.supplierBatchNo || b.mfgBatchNo) {
              supplierMap[k] = b.supplierBatchNo || b.mfgBatchNo;
            }
          });
        }

        // Reconcile against live lots
        const reconciledMap = {};
        Object.entries(existingMap).forEach(([rawKey, rawQty]) => {
          const matched = lots.find(l => String(l.id) === String(rawKey) || String(l.internalBatchNo) === String(rawKey));
          if (matched) {
            const maxLotAvailInMode = Number(matched.availableQty ?? matched.netQty ?? 0) * uomFactor;
            const capped = Math.min(maxLotAvailInMode, rawQty);
            if (capped > 0) {
              reconciledMap[matched.id] = Number(capped.toFixed(4));
            }
          }
        });

        const reconciledSum = Object.values(reconciledMap).reduce((s, v) => s + Number(v || 0), 0);

        // ══════════════════════════════════════════════════════════════════════
        // AUTOMATIC FIFO / FEFO LOT ALLOCATION
        // If unallocated or allocation is 0, auto-assign required quantity
        // ══════════════════════════════════════════════════════════════════════
        if (lots.length > 0 && targetRequiredQty > 0 && (reconciledSum <= 0.0001 || Math.abs(reconciledSum - targetRequiredQty) > 0.001)) {
          let remNeeded = targetRequiredQty;
          const autoAlloc = {};

          for (const lot of lots) {
            if (remNeeded <= 0.0001) break;
            const lotAvailInMode = Number(lot.availableQty ?? lot.netQty ?? 0) * uomFactor;
            if (lotAvailInMode > 0) {
              const take = Math.min(lotAvailInMode, remNeeded);
              const roundedTake = Number(take.toFixed(4));
              autoAlloc[lot.id] = roundedTake;
              remNeeded = Math.max(0, Number((remNeeded - take).toFixed(4)));
            }
          }

          setLotAllocations(autoAlloc);
        } else {
          setLotAllocations(reconciledMap);
        }

        setManualSupplierBatches(supplierMap);

        // Resolve continuing sequential batch number and latest PO for manual override form
        let resolvedPo = meta?.latestPoNumber;
        if (!resolvedPo || resolvedPo === 'PO-OPENING' || resolvedPo === 'PO-MANUAL-OVERRIDE') {
          const poLot = lots.find(l => l.poNumber && !l.poNumber.startsWith('PO-OPEN') && !l.poNumber.includes('Override'));
          if (poLot) resolvedPo = poLot.poNumber;
        }
        if (!resolvedPo) resolvedPo = 'PO-MANUAL-OVERRIDE';

        let resolvedBatch = meta?.nextBatchNumber;
        if (!resolvedBatch) {
          let maxSeq = 0;
          lots.forEach(l => {
            const m = (l.internalBatchNo || '').match(new RegExp(`^BATCH-${cleanCode}-(\\d+)`, 'i'));
            if (m && m[1]) {
              const p = parseInt(m[1], 10);
              if (p > maxSeq) maxSeq = p;
            }
          });
          resolvedBatch = `BATCH-${cleanCode}-${String(maxSeq + 1).padStart(3, '0')}`;
        }

        const defaultOverrideAvail = Math.max(targetRequiredQty || 100, 4840 * uomFactor);

        setOverrideForm({
          internalBatchNo: resolvedBatch,
          grnNumber: 'GRN-MANUAL-OVERRIDE',
          poNumber: resolvedPo,
          batchQty: 1,
          weight: '25 kg / 50',
          availableQty: defaultOverrideAvail,
          supplierBatchNo: 'BATCH-01',
          mfgDate: mfgStr,
          expiryDate: expStr,
          supplierName: meta?.latestSupplierName || lots[0]?.supplierName || 'SUP-LOT-DIRECT',
          latestPoNumber: resolvedPo,
          latestBatchNumber: meta?.latestBatchNumber || null
        });
      } catch (err) {
        console.error('Failed to fetch live RM batches in ProductionLotAllocationModal:', err);
        if (!isCancelled) setAvailableLots([]);
      } finally {
        if (!isCancelled) setLoadingLots(false);
      }
    }

    fetchLiveLotsAndMeta();

    return () => {
      isCancelled = true;
    };
  }, [rmId, rmName, rmCode, uomMode, uomFactor, targetRequiredQty, conversionFactor, baseUom, altUom]);

  // Handle Switch UOM Mode inside the modal (e.g. user toggles between liter and ml)
  const handleToggleUomMode = (newMode) => {
    if (newMode === uomMode) return;
    const isSwitchingToAlt = newMode === 'ALT';
    const factorMultiplier = isSwitchingToAlt ? conversionFactor : (1 / conversionFactor);

    // Convert currently entered allocations to the new UOM
    const convertedAllocations = {};
    Object.entries(lotAllocations).forEach(([lotId, qty]) => {
      const num = Number(qty || 0);
      if (num > 0) {
        convertedAllocations[lotId] = Number((num * factorMultiplier).toFixed(4));
      }
    });

    setUomMode(newMode);
    setLotAllocations(convertedAllocations);
  };

  // Set quantity for a specific lot
  const handleSetLotQty = (lotId, value, maxAvailInActiveUom) => {
    const cleanStr = typeof value === 'string' ? value.replace(/^0+(?=\d)/, '') : String(value ?? '');
    let num = Number(cleanStr);
    if (isNaN(num) || num < 0) num = 0;
    if (num > maxAvailInActiveUom) num = maxAvailInActiveUom;

    setLotAllocations(prev => ({
      ...prev,
      [lotId]: cleanStr === '' ? '' : Number(num.toFixed(4))
    }));
  };

  // Allocate remaining balance needed to this lot
  const handleFillRemaining = (lotId, maxAvailInActiveUom) => {
    let currentOtherTotal = 0;
    const cleanMap = {};

    availableLots.forEach(lot => {
      if (String(lot.id) === String(lotId)) return;
      const val = Number(lotAllocations[lot.id] || 0);
      if (val > 0) {
        cleanMap[lot.id] = val;
        currentOtherTotal += val;
      }
    });

    const remainingNeeded = Math.max(0, targetRequiredQty - currentOtherTotal);
    const toAlloc = Math.min(maxAvailInActiveUom, Number(remainingNeeded.toFixed(4)));
    cleanMap[lotId] = toAlloc;
    setLotAllocations(cleanMap);
  };

  // Re-run Auto Allocate FIFO / FEFO across all available lots
  const handleAutoAllocateFifo = () => {
    if (targetRequiredQty <= 0) {
      Swal.fire({
        title: 'Required Quantity Missing',
        text: 'Please set the required quantity for this raw material line first.',
        icon: 'warning',
        timer: 2000
      });
      return;
    }

    let remNeeded = targetRequiredQty;
    const newAlloc = {};

    // Lots are already sorted by FEFO
    for (const lot of availableLots) {
      if (remNeeded <= 0.0001) break;
      const lotAvail = Number(lot.availableQty ?? lot.netQty ?? 0) * uomFactor;
      if (lotAvail > 0) {
        const take = Math.min(lotAvail, remNeeded);
        const roundedTake = Number(take.toFixed(4));
        newAlloc[lot.id] = roundedTake;
        remNeeded = Math.max(0, Number((remNeeded - take).toFixed(4)));
      }
    }

    setLotAllocations(newAlloc);
    const allocatedSum = Object.values(newAlloc).reduce((s, v) => s + Number(v || 0), 0);

    Swal.fire({
      title: 'FIFO Auto-Allocation Applied',
      html: `
        <div style="text-align: left; font-size: 13px; line-height: 1.6;">
          <p><strong>✓ Target Required:</strong> ${targetRequiredQty} ${activeUom}</p>
          <p><strong>✓ Automatically Allocated:</strong> ${allocatedSum} ${activeUom}</p>
          <p><strong>✓ Remaining Balance:</strong> ${Math.max(0, Number((targetRequiredQty - allocatedSum).toFixed(2)))} ${activeUom}</p>
        </div>
      `,
      icon: 'success',
      timer: 1500
    });
  };

  // Add Manual Override Lot
  const handleAddManualOverrideLot = () => {
    const lotId = `manual-${Date.now()}`;
    const overrideAvailInActiveUom = Number(overrideForm.availableQty || 100);
    // Base available quantity stored in lot object
    const baseAvail = uomMode === 'ALT' && conversionFactor > 0
      ? (overrideAvailInActiveUom / conversionFactor)
      : overrideAvailInActiveUom;

    const newLot = {
      id: lotId,
      internalBatchNo: overrideForm.internalBatchNo?.trim() || `BATCH-OVERRIDE-${Date.now().toString().slice(-4)}`,
      grnNumber: overrideForm.grnNumber?.trim() || 'GRN-MANUAL-OVERRIDE',
      grnRef: overrideForm.grnNumber?.trim() || 'GRN-MANUAL-OVERRIDE',
      poNumber: overrideForm.poNumber?.trim() || 'PO-MANUAL-OVERRIDE',
      poReferenceNo: overrideForm.poNumber?.trim() || 'PO-MANUAL-OVERRIDE',
      batchQty: Number(overrideForm.batchQty || 1),
      weight: overrideForm.weight || '25 kg / 50',
      availableQty: baseAvail,
      netQty: baseAvail,
      supplierBatchNo: overrideForm.supplierBatchNo || 'BATCH-01',
      mfgBatchNo: overrideForm.supplierBatchNo || 'BATCH-01',
      mfgDate: overrideForm.mfgDate || new Date().toISOString(),
      expiryDate: overrideForm.expiryDate || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      supplierName: overrideForm.supplierName || 'SUP-LOT-DIRECT',
      isManualOverride: true,
      source: 'MANUAL_OVERRIDE'
    };

    setAvailableLots(prev => [newLot, ...prev.filter(l => l.internalBatchNo !== newLot.internalBatchNo)]);
    setManualSupplierBatches(prev => ({
      ...prev,
      [lotId]: newLot.supplierBatchNo
    }));

    // Auto-allocate into new manual lot if needed
    const currentAllocSum = Object.values(lotAllocations).reduce((s, v) => s + Number(v || 0), 0);
    const needed = Math.max(0, targetRequiredQty - currentAllocSum);
    const toAlloc = Math.min(overrideAvailInActiveUom, needed);
    if (toAlloc > 0) {
      setLotAllocations(prev => ({
        ...prev,
        [lotId]: Number(toAlloc.toFixed(4))
      }));
    }

    // Advance sequence for next manual batch
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
          <p><strong>✓ GRN:</strong> <span style="font-family: monospace; font-weight: bold; color: #d97706;">${newLot.grnNumber}</span></p>
          <p><strong>✓ PO Number:</strong> <span style="font-family: monospace; font-weight: bold;">${newLot.poNumber}</span></p>
          <p><strong>✓ Available Stock:</strong> ${overrideAvailInActiveUom} ${activeUom}</p>
        </div>
      `,
      icon: 'success',
      timer: 2000
    });
  };

  // Filtered lots by GRN & search query
  const displayedLots = useMemo(() => {
    return availableLots.filter(lot => {
      if (selectedGrnFilter !== 'ALL') {
        const grn = lot.grnNumber || lot.grnRef || '';
        if (grn !== selectedGrnFilter) return false;
      }
      if (lotSearchTerm.trim()) {
        const q = lotSearchTerm.trim().toLowerCase();
        const ourBatch = String(lot.internalBatchNo || '').toLowerCase();
        const suppBatch = String(lot.supplierBatchNo || lot.mfgBatchNo || '').toLowerCase();
        const grn = String(lot.grnNumber || lot.grnRef || '').toLowerCase();
        const po = String(lot.poNumber || lot.poReferenceNo || '').toLowerCase();
        const supplier = String(lot.supplierName || '').toLowerCase();
        const weight = String(lot.weight || '').toLowerCase();
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

  // Unique GRNs for dropdown filter
  const uniqueGrnList = useMemo(() => {
    const map = new Map();
    availableLots.forEach(lot => {
      const grn = lot.grnNumber || lot.grnRef || 'Direct Stock';
      if (!map.has(grn)) {
        map.set(grn, { grnNumber: grn, count: 0, totalQtyInMode: 0 });
      }
      const item = map.get(grn);
      item.count += 1;
      item.totalQtyInMode += Number(lot.availableQty || lot.netQty || 0) * uomFactor;
    });
    return Array.from(map.values());
  }, [availableLots, uomFactor]);

  // Total allocated in the modal in active UOM
  const totalAllocatedInModal = useMemo(() => {
    return Number(
      availableLots.reduce((sum, lot) => sum + Number(lotAllocations[lot.id] || 0), 0).toFixed(4)
    );
  }, [lotAllocations, availableLots]);

  // Confirm and save allocations
  const handleConfirmAllocations = async () => {
    const allocatedBatches = [];
    let totalAllocBase = 0;
    let totalAllocAlt = 0;
    let weightedAmountSum = 0;

    for (const lot of availableLots) {
      const qtyInMode = Number(lotAllocations[lot.id] || 0);
      if (qtyInMode <= 0) continue;

      // Base quantity is strictly stored in base UOM for backend decrement compatibility
      const baseAllocQty = uomMode === 'ALT' && conversionFactor > 0
        ? Number((qtyInMode / conversionFactor).toFixed(6))
        : Number(qtyInMode.toFixed(6));

      const altAllocQty = Number((baseAllocQty * conversionFactor).toFixed(4));

      totalAllocBase += baseAllocQty;
      totalAllocAlt += altAllocQty;

      // Fetch or resolve live PO rate
      let unitRate = Number(lot.unitCost || lot.rate || lot.unitRate || row.baseRate || row.unitRate || 0);
      let poOrigQty = Number(lot.netQty || lot.availableQty || baseAllocQty);
      let poTotAmt = Number(lot.totalAmount || (poOrigQty * unitRate));

      try {
        const rateRes = await api.get(`/purchase/live-rate?batchId=${lot.id}&allocatedQty=${baseAllocQty}`).catch(() => null);
        if (rateRes?.data?.rate > 0) {
          unitRate = Number(rateRes.data.rate);
          poOrigQty = Number(rateRes.data.poOriginalQty || poOrigQty);
          poTotAmt = Number(rateRes.data.poTotalAmount || poTotAmt);
        }
      } catch (_) {}

      const propFactor = poOrigQty > 0 ? (baseAllocQty / poOrigQty) : 1;
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
        allocatedQty: Number(baseAllocQty.toFixed(4)), // Primary Base UOM for stock deduction
        allocatedAltQty: Number(altAllocQty.toFixed(3)), // Alternate UOM quantity
        availableQty: Number(lot.availableQty || lot.netQty || 0),
        remainingQty: Number(Math.max(0, Number(lot.availableQty || lot.netQty || 0) - baseAllocQty).toFixed(4)),
        poOriginalQty: poOrigQty,
        poTotalAmount: poTotAmt,
        allocatedAmount,
        unitRate,
        uom: baseUom,
        altUom: altUom,
        isManualOverride: Boolean(lot.isManualOverride || lot.source === 'MANUAL_OVERRIDE' || (lot.id && String(lot.id).startsWith('manual-'))),
        source: lot.source || (lot.isManualOverride ? 'MANUAL_OVERRIDE' : 'PURCHASE_GRN')
      });
    }

    const blendedBaseRate = totalAllocBase > 0 ? Number((weightedAmountSum / totalAllocBase).toFixed(4)) : Number(row.baseRate || row.unitRate || 0);
    const blendedAltRate = conversionFactor > 0 ? Number((blendedBaseRate / conversionFactor).toFixed(4)) : blendedBaseRate;

    if (onConfirm) {
      onConfirm({
        allocatedBatches,
        totalAllocatedBase: Number(totalAllocBase.toFixed(4)),
        totalAllocatedAlt: Number(totalAllocAlt.toFixed(3)),
        blendedBaseRate,
        blendedAltRate,
        totalCost: Number(weightedAmountSum.toFixed(2)),
        activeUomMode: uomMode,
        row
      });
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-3xl w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[92vh]">

        {/* ── MODAL HEADER ── */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-start justify-between shrink-0 bg-slate-50/50 dark:bg-slate-850/50">
          <div className="space-y-1.5 flex-1 pr-4">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                <Boxes className="w-4 h-4 text-indigo-500" />
                <span>{titlePrefix}: {rmName}</span>
              </h3>

              {categoryName && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                  Category: {categoryName}
                </span>
              )}

              {/* Interactive UOM Switch Pill */}
              {hasAlt && altUom ? (
                <div className="flex items-center gap-1 bg-indigo-50/80 dark:bg-indigo-950/70 p-0.5 rounded-lg border border-indigo-200 dark:border-indigo-800">
                  <button
                    type="button"
                    onClick={() => handleToggleUomMode('BASE')}
                    className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-md transition-all cursor-pointer ${
                      uomMode === 'BASE'
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100'
                    }`}
                    title={`Switch modal to Base UOM (${baseUom})`}
                  >
                    {baseUom} (Base)
                  </button>
                  <ArrowRightLeft className="w-2.5 h-2.5 text-indigo-400" />
                  <button
                    type="button"
                    onClick={() => handleToggleUomMode('ALT')}
                    className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-md transition-all cursor-pointer ${
                      uomMode === 'ALT'
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100'
                    }`}
                    title={`Switch modal to Alternate UOM (${altUom})`}
                  >
                    {altUom} (Alt)
                  </button>
                </div>
              ) : (
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                  UOM: {baseUom}
                </span>
              )}

              {rmCode && (
                <span className="text-[10px] font-mono text-slate-400">
                  ({rmCode})
                </span>
              )}
            </div>

            <p className="text-[11px] text-slate-400">
              Select available GRN batches (FEFO Expiry Order). Filter by specific GRN or search by batch number.
              {hasAlt && altUom && (
                <span className="text-indigo-600 dark:text-indigo-400 ml-1 font-semibold">
                  • 1 {baseUom} = {conversionFactor.toLocaleString()} {altUom}
                </span>
              )}
            </p>

            {descriptionText && (
              <div className="mt-2 bg-amber-50/90 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-800/60 rounded-xl px-3 py-1.5 text-xs flex items-start gap-2">
                <AlertCircle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div className="text-[11px] text-amber-900 dark:text-amber-200 leading-snug">
                  <strong className="text-amber-800 dark:text-amber-300 uppercase tracking-wide text-[10px] mr-1">
                    Description / Storage Notes:
                  </strong>
                  <span>{descriptionText}</span>
                </div>
              </div>
            )}
          </div>

          <button 
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── CONTROLS, SEARCH, AUTO FIFO & PROGRESS ── */}
        <div className="p-4 sm:p-6 border-b border-slate-100 dark:border-slate-800 space-y-3.5 shrink-0 bg-slate-50/30 dark:bg-slate-900">
          
          {/* Row 1: Source GRN Dropdown, Search Input, Auto-FIFO button & Manual Override Toggle */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
            
            {/* GRN Dropdown */}
            <div className="sm:col-span-4">
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
                    {g.grnNumber} ({g.count} lot{g.count === 1 ? '' : 's'} • {Number(g.totalQtyInMode.toFixed(2)).toLocaleString()} {activeUom})
                  </option>
                ))}
              </select>
            </div>

            {/* Search Bar */}
            <div className="sm:col-span-3">
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
                    type="button"
                    onClick={() => setLotSearchTerm('')}
                    className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 text-xs cursor-pointer"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>

            {/* ⚡ Auto-Allocate FIFO Button */}
            <div className="sm:col-span-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAutoAllocateFifo}
                className="w-full h-9 rounded-xl font-black text-xs border border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 cursor-pointer transition-all flex items-center justify-center gap-1 shadow-2xs"
                title="Automatically allocate batches in FIFO/FEFO expiry order"
              >
                <Zap className="w-3.5 h-3.5 text-emerald-600" />
                <span>Auto FIFO</span>
              </Button>
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

          {/* Collapsible Manual Override Form */}
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
                  Entry unit: {activeUom} • Pre-filled with smart defaults
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
                    placeholder="e.g. BATCH-MILKRAW-007"
                    className="h-8 text-xs font-mono font-bold rounded-lg border-indigo-300 dark:border-indigo-700 bg-indigo-50/20"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-wider block mb-0.5">
                    GRN (Manual):
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
                    value={Number(overrideForm.batchQty) === 0 ? '' : overrideForm.batchQty}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => setOverrideForm(prev => ({ ...prev, batchQty: e.target.value.replace(/^0+(?=\d)/, '') }))}
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
                    Available Qty ({activeUom}):
                  </label>
                  <Input
                    type="number"
                    min="0"
                    step="any"
                    value={Number(overrideForm.availableQty) === 0 ? '' : overrideForm.availableQty}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => setOverrideForm(prev => ({ ...prev, availableQty: e.target.value.replace(/^0+(?=\d)/, '') }))}
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
                  When applied, this lot appears at the top for immediate allocation and will update stock correctly.
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
                Required:{' '}
                <strong className="text-slate-900 dark:text-white font-black">
                  {Number(targetRequiredQty.toFixed(2)).toLocaleString()} {activeUom}
                </strong>
                {hasAlt && altUom && (
                  <span className="text-[10px] text-slate-400 ml-1">
                    (≈ {uomMode === 'ALT'
                      ? `${Number((targetRequiredQty / conversionFactor).toFixed(4))} ${baseUom}`
                      : `${Number((targetRequiredQty * conversionFactor).toFixed(2)).toLocaleString()} ${altUom}`
                    })
                  </span>
                )}
              </span>
              <span>•</span>
              <span>
                Allocated:{' '}
                <strong className="text-indigo-600 dark:text-indigo-400 font-black">
                  {Number(totalAllocatedInModal.toFixed(2)).toLocaleString()} {activeUom}
                </strong>
              </span>
              <span>•</span>
              <span>
                Balance:{' '}
                <strong className={totalAllocatedInModal >= targetRequiredQty ? 'text-emerald-600' : 'text-amber-600'}>
                  {Math.max(0, targetRequiredQty - totalAllocatedInModal).toFixed(2)} {activeUom}
                </strong>
              </span>
            </div>

            <div>
              {totalAllocatedInModal >= targetRequiredQty && targetRequiredQty > 0 ? (
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

        {/* ── LOTS LIST BODY ── */}
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
                {selectedGrnFilter !== 'ALL' ? 'Try changing the GRN filter to "All GRNs" or clearing search.' : 'Material will be fulfilled from general warehouse stock or use + Manual Override above.'}
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
                  const baseAvail = Number(lot.availableQty || lot.netQty || 0);
                  // Available quantity in active display UOM (e.g. 160,000 ml or 160 liter)
                  const availInMode = Number((baseAvail * uomFactor).toFixed(4));
                  const currentAlloc = lotAllocations[lot.id] || '';
                  const isExpired = lot.expiryDate && new Date(lot.expiryDate) < new Date();
                  const currentSupplierBatch = manualSupplierBatches[lot.id] ?? (lot.supplierBatchNo || lot.mfgBatchNo || '');
                  const ratePerBase = Number(lot.unitCost || lot.rate || lot.unitRate || row.baseRate || row.unitRate || 54);
                  const rateInMode = uomMode === 'ALT' && conversionFactor > 0 ? (ratePerBase / conversionFactor) : ratePerBase;

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

                      {/* Grid of All Batch Details */}
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
                            {lot.weight || '25 kg / 50'}
                          </span>
                        </div>

                        {/* 3. Available Qty in Active UOM */}
                        <div>
                          <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider">Available Qty:</span>
                          <span className="font-mono font-black text-indigo-600 dark:text-indigo-400 text-xs block">
                            {Number(availInMode.toFixed(2)).toLocaleString()} {activeUom}
                          </span>
                          {hasAlt && altUom && (
                            <span className="text-[9.5px] font-mono text-slate-400 block">
                              ≈ {uomMode === 'ALT'
                                ? `${baseAvail.toLocaleString()} ${baseUom}`
                                : `${(baseAvail * conversionFactor).toLocaleString()} ${altUom}`
                              }
                            </span>
                          )}
                        </div>

                        {/* 4. MFG Batch */}
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

                        {/* 7. Live PO Rate (Role-Protected: Hidden for Production Staff) */}
                        {canViewCosting && (
                          <div>
                            <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider">PO Rate:</span>
                            <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-xs block">
                              ₹{Number(rateInMode.toFixed(4))} / {activeUom}
                            </span>
                          </div>
                        )}

                        {/* 8. Supplier Name */}
                        {lot.supplierName && (
                          <div>
                            <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider">Supplier:</span>
                            <span className="text-slate-700 dark:text-slate-300 truncate block text-xs font-medium">
                              {lot.supplierName}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Allocation Controls: Quick Buttons + Allocate Qty Input in Active UOM */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => handleFillRemaining(lot.id, availInMode)}
                            className="h-7 text-[10px] px-2.5 rounded-lg font-bold border-indigo-200 dark:border-indigo-800 hover:bg-indigo-50 text-indigo-600 dark:text-indigo-400 cursor-pointer"
                          >
                            Allocate Remaining
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleSetLotQty(lot.id, availInMode, availInMode)}
                            className="h-7 text-[10px] px-2 rounded-lg text-slate-500 hover:text-indigo-600 cursor-pointer"
                          >
                            Max ({Number(availInMode.toFixed(2)).toLocaleString()})
                          </Button>
                          {Number(currentAlloc) > 0 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleSetLotQty(lot.id, 0, availInMode)}
                              className="h-7 text-[10px] px-2 rounded-lg text-rose-500 hover:bg-rose-50 cursor-pointer"
                            >
                              Clear
                            </Button>
                          )}
                        </div>

                        <div className="flex flex-col items-end gap-1 self-end sm:self-auto">
                          <div className="flex items-center gap-2">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">
                              Allocate Qty:
                            </label>
                            <div className="w-32">
                              <Input
                                type="number"
                                min="0"
                                max={availInMode}
                                step="any"
                                value={Number(currentAlloc) === 0 ? '' : currentAlloc}
                                onFocus={(e) => e.target.select()}
                                onChange={(e) => handleSetLotQty(lot.id, e.target.value, availInMode)}
                                onBlur={(e) => {
                                  if (!e.target.value) handleSetLotQty(lot.id, 0, availInMode);
                                }}
                                placeholder={`0 / ${availInMode}`}
                                className="h-8 text-center font-mono font-black text-xs rounded-xl border-indigo-300 dark:border-indigo-700 focus:ring-2 focus:ring-indigo-500"
                              />
                            </div>
                            <span className="text-xs font-mono font-bold text-slate-500">
                              {activeUom}
                            </span>
                          </div>

                          {Number(currentAlloc) > 0 && (() => {
                            const remInMode = Math.max(0, availInMode - Number(currentAlloc));
                            return (
                              <div className="text-[10px] font-mono font-bold text-emerald-600 dark:text-emerald-400">
                                Remaining: {Number(remInMode.toFixed(2)).toLocaleString()} {activeUom}
                                {hasAlt && altUom && (
                                  <span className="text-slate-400 font-normal ml-1">
                                    (≈ {uomMode === 'ALT'
                                      ? `${Number((remInMode / conversionFactor).toFixed(4))} ${baseUom}`
                                      : `${Number((remInMode * conversionFactor).toFixed(2)).toLocaleString()} ${altUom}`
                                    })
                                  </span>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                      </div>

                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* ── MODAL FOOTER ── */}
        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-850/80 flex items-center justify-between shrink-0">
          <div className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300">
            <span>Total Allocated: </span>
            <strong className="text-indigo-600 dark:text-indigo-400 font-black">
              {Number(totalAllocatedInModal.toFixed(2)).toLocaleString()} {activeUom}
            </strong>
            {hasAlt && altUom && (
              <span className="text-[11px] text-slate-400 ml-1.5 font-normal">
                (≈ {uomMode === 'ALT'
                  ? `${Number((totalAllocatedInModal / conversionFactor).toFixed(4))} ${baseUom}`
                  : `${Number((totalAllocatedInModal * conversionFactor).toFixed(2)).toLocaleString()} ${altUom}`
                })
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button 
              type="button" 
              variant="outline" 
              size="sm" 
              onClick={onClose}
              className="rounded-xl cursor-pointer"
            >
              Cancel
            </Button>
            <Button 
              type="button" 
              size="sm" 
              onClick={handleConfirmAllocations}
              disabled={totalAllocatedInModal <= 0}
              className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold cursor-pointer shadow-xs disabled:opacity-50"
            >
              Confirm Lot Allocations
            </Button>
          </div>
        </div>

      </div>
    </div>
  );
}
