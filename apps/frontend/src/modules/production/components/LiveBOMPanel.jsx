import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Layers, GripVertical, AlertTriangle, CheckCircle2, Plus, Trash2, 
  RotateCcw, Info, ArrowUp, ArrowDown, Search, X, Package, ShieldAlert,
  ChevronRight, Sparkles, Scale, Database, Calendar, Tag, ChevronDown, Check,
  Minus, ShoppingBag, CheckSquare, Boxes, Warehouse
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/axios';
import SearchableItemSelect from '@/modules/purchase/components/SearchableItemSelect';

// Centralized helper to resolve human-readable UOM text and NEVER display raw UUIDs
export const getCleanUomLabel = (val, allUoms = []) => {
  if (!val) return 'units';
  if (typeof val === 'object' && val !== null) {
    return (val.abbreviation || val.name || 'units').toUpperCase();
  }
  const str = String(val).trim();
  // Check if it's a UUID
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str)) {
    const match = (allUoms || []).find(u => u.id && String(u.id).toLowerCase() === str.toLowerCase());
    if (match) return (match.abbreviation || match.name || 'units').toUpperCase();
    return 'units';
  }
  // Check if it's an unrecognized long ID with hyphens
  if (str.includes('-') && str.length > 20) {
    const match = (allUoms || []).find(u => u.id && String(u.id).toLowerCase() === str.toLowerCase());
    if (match) return (match.abbreviation || match.name || 'units').toUpperCase();
    return 'units';
  }
  return str.toUpperCase();
};

export default function LiveBOMPanel({
  bomItems = [],
  setBomItems,
  loading = false,
  product = null,
  batchQty = 1,
  allSelectableItems = [],
  allUoms = [],
  onUndoRemove = null,
  removedItem = null,
  onClearUndo = null,
  wastagePercent = 6,
  setWastagePercent,
  overheadPercent = 10,
  setOverheadPercent,
  recipeSource = '',
  recipeTitle = ''
}) {
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);

  // Lot Selection Modal State
  const [lotModalOpen, setLotModalOpen] = useState(false);
  const [activeItemForLot, setActiveItemForLot] = useState(null);
  const [activeItemIndex, setActiveItemIndex] = useState(null);
  const [loadingLots, setLoadingLots] = useState(false);
  const [availableLots, setAvailableLots] = useState([]);
  const [lotAllocations, setLotAllocations] = useState({}); // { [lotId]: number }
  const [customLots, setCustomLots] = useState([]); // array of custom lots added in modal
  const [lotModalTab, setLotModalTab] = useState('list'); // 'list' | 'custom'
  const [lotSearchTerm, setLotSearchTerm] = useState('');
  const [customLotData, setCustomLotData] = useState({
    internalBatchNo: '',
    supplierBatchNo: '',
    mfgDate: '',
    expiryDate: '',
    allocatedQty: ''
  });

  const rmSelectRef = useRef(null);

  // Added item IDs for SearchableItemSelect
  const addedItemIds = useMemo(() => {
    return new Set(bomItems.map(it => it.rmId || it.rawMaterialId || it.id));
  }, [bomItems]);

  // Low stock item IDs for SearchableItemSelect
  const lowStockIds = useMemo(() => {
    return new Set(
      allSelectableItems
        .filter(it => it.isLowStock)
        .map(it => it.id)
    );
  }, [allSelectableItems]);

  // Helper to auto-allocate required quantity across FEFO batches (earliest expiry first)
  const autoAllocateBatchesAcrossLots = (lots = [], requiredQty = 1, defaultUom = 'units') => {
    const reqQty = Number(requiredQty || 1);
    if (!lots || lots.length === 0) return { allocatedBatches: [], lotAllocations: {} };

    let remaining = reqQty;
    const allocatedBatches = [];
    const allocationsMap = {};

    for (const lot of lots) {
      if (remaining <= 0) break;
      const avail = Number(lot.netQty || lot.availableQty || 0);
      if (avail <= 0) continue;
      const take = Number(Math.min(avail, remaining).toFixed(4));
      allocatedBatches.push({
        batchId: lot.id,
        internalBatchNo: lot.internalBatchNo,
        supplierBatchNo: lot.supplierBatchNo,
        mfgDate: lot.mfgDate,
        expiryDate: lot.expiryDate,
        allocatedQty: take,
        availableQty: avail,
        uom: defaultUom
      });
      allocationsMap[lot.id] = take;
      remaining = Number((remaining - take).toFixed(4));
    }

    if (allocatedBatches.length === 0 && lots.length > 0) {
      const first = lots[0];
      allocatedBatches.push({
        batchId: first.id,
        internalBatchNo: first.internalBatchNo,
        supplierBatchNo: first.supplierBatchNo,
        mfgDate: first.mfgDate,
        expiryDate: first.expiryDate,
        allocatedQty: reqQty,
        availableQty: Number(first.netQty || 0),
        uom: defaultUom
      });
      allocationsMap[first.id] = reqQty;
    }

    const first = allocatedBatches[0];
    const combinedSummary = allocatedBatches.length > 1
      ? allocatedBatches.map(b => `${b.internalBatchNo} (${b.allocatedQty} ${defaultUom})`).join(' + ')
      : first?.internalBatchNo || null;

    return {
      allocatedBatches,
      lotAllocations: allocationsMap,
      allocatedBatchId: first?.batchId || null,
      internalBatchNo: combinedSummary,
      supplierBatchNo: first?.supplierBatchNo || null,
      mfgDate: first?.mfgDate || null,
      expiryDate: first?.expiryDate || null,
      lotNetQty: allocatedBatches.reduce((s, b) => s + b.allocatedQty, 0)
    };
  };

  // Helper to fetch and pre-allocate lots for a raw material
  const fetchAndAutoAllocateLots = async (rmId, requiredQty, defaultUom) => {
    try {
      const res = await api.get(`/production/rm-batches/${rmId}`);
      const lots = res.data || [];
      if (lots.length > 0) {
        return autoAllocateBatchesAcrossLots(lots, requiredQty, defaultUom);
      }
    } catch {
      // ignore
    }
    return {
      allocatedBatches: [],
      lotAllocations: {},
      allocatedBatchId: null,
      internalBatchNo: null,
      supplierBatchNo: null,
      mfgDate: null,
      expiryDate: null,
      lotNetQty: null
    };
  };

  // Open modal and load active batches
  const openLotModal = async (item, index) => {
    setActiveItemForLot(item);
    setActiveItemIndex(index);
    setLotModalOpen(true);
    setLoadingLots(true);
    setLotModalTab('list');
    setLotSearchTerm('');

    const defaultCode = (item.rawMaterialCode || item.code || 'RM').replace(/[^a-zA-Z0-9]/g, '').slice(0, 10).toUpperCase();
    const reqQty = Number(item.requiredQty || 1);
    const cleanUom = getCleanUomLabel(item.selectedUom || item.uom || item.unit, allUoms);

    // Initial allocations map from existing item.allocatedBatches
    const existingAllocations = {};
    const existingCustoms = [];
    if (Array.isArray(item.allocatedBatches) && item.allocatedBatches.length > 0) {
      item.allocatedBatches.forEach(b => {
        if (b.batchId) {
          existingAllocations[b.batchId] = Number(b.allocatedQty || 0);
          if (b.batchId.startsWith('custom-') || b.isCustom) {
            existingCustoms.push({
              id: b.batchId,
              batchId: b.batchId,
              internalBatchNo: b.internalBatchNo,
              supplierBatchNo: b.supplierBatchNo || 'N/A',
              mfgDate: b.mfgDate,
              expiryDate: b.expiryDate,
              netQty: b.allocatedQty,
              availableQty: b.availableQty || b.allocatedQty,
              storageLocation: 'Custom Batch Override',
              grnRef: 'MANUAL',
              isCustom: true
            });
          }
        }
      });
    } else if (item.allocatedBatchId) {
      existingAllocations[item.allocatedBatchId] = reqQty;
    }

    setLotAllocations(existingAllocations);
    setCustomLots(existingCustoms);

    const todayStr = new Date().toISOString().split('T')[0];
    const nextYearStr = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    setCustomLotData({
      internalBatchNo: `LOT-${defaultCode}-${Date.now().toString().slice(-4)}`,
      supplierBatchNo: item.supplierBatchNo && item.supplierBatchNo !== 'N/A' ? item.supplierBatchNo : '',
      mfgDate: item.mfgDate ? new Date(item.mfgDate).toISOString().split('T')[0] : todayStr,
      expiryDate: item.expiryDate ? new Date(item.expiryDate).toISOString().split('T')[0] : nextYearStr,
      allocatedQty: reqQty
    });

    try {
      const identifier = item.rmId || item.rawMaterialId || item.rawMaterialCode || item.code || item.id;
      const res = await api.get(`/production/rm-batches/${identifier}`);
      const fetched = res.data || [];
      setAvailableLots(fetched);

      // If no allocations existed before, automatically allocate FEFO now!
      if (Object.keys(existingAllocations).length === 0 && fetched.length > 0) {
        const auto = autoAllocateBatchesAcrossLots(fetched, reqQty, cleanUom);
        setLotAllocations(auto.lotAllocations);
      }
    } catch (err) {
      console.error('Failed to load RM batches:', err);
      setAvailableLots([]);
    } finally {
      setLoadingLots(false);
    }
  };

  const allModalLots = useMemo(() => {
    return [...availableLots, ...customLots];
  }, [availableLots, customLots]);

  const filteredLots = useMemo(() => {
    const list = [...availableLots, ...customLots];
    if (!lotSearchTerm.trim()) return list;
    const term = lotSearchTerm.toLowerCase();
    return list.filter(l => 
      l.internalBatchNo?.toLowerCase().includes(term) ||
      l.supplierBatchNo?.toLowerCase().includes(term) ||
      l.grnRef?.toLowerCase().includes(term) ||
      l.storageLocation?.toLowerCase().includes(term) ||
      (l.mfgDate && new Date(l.mfgDate).toLocaleDateString('en-GB').toLowerCase().includes(term)) ||
      (l.expiryDate && new Date(l.expiryDate).toLocaleDateString('en-GB').toLowerCase().includes(term))
    );
  }, [availableLots, customLots, lotSearchTerm]);

  const reqQtyForModal = Number(activeItemForLot?.requiredQty || 1);
  const cleanUomForModal = getCleanUomLabel(activeItemForLot?.selectedUom || activeItemForLot?.uom || activeItemForLot?.unit, allUoms);

  const totalAllocatedInModal = useMemo(() => {
    return Number(Object.values(lotAllocations).reduce((sum, q) => sum + (Number(q) || 0), 0).toFixed(4));
  }, [lotAllocations]);

  const remainingToAllocate = Math.max(0, Number((reqQtyForModal - totalAllocatedInModal).toFixed(4)));
  const isFullyAllocated = totalAllocatedInModal >= reqQtyForModal;

  const handleAutoAllocateFefo = () => {
    const auto = autoAllocateBatchesAcrossLots(availableLots, reqQtyForModal, cleanUomForModal);
    setLotAllocations(auto.lotAllocations);
  };

  const handleClearAllAllocations = () => {
    setLotAllocations({});
  };

  const handleSetLotQty = (lotId, qty, maxAvailable) => {
    const maxVal = maxAvailable !== undefined ? Number(maxAvailable) : 999999;
    const num = Math.max(0, Math.min(maxVal, Number(qty || 0)));
    setLotAllocations(prev => {
      const updated = { ...prev };
      if (num > 0) {
        updated[lotId] = num;
      } else {
        delete updated[lotId];
      }
      return updated;
    });
  };

  const handleAllocateMaxForLot = (lot) => {
    const avail = Number(lot.netQty || lot.availableQty || 0);
    const currentlyAllocatedToThis = Number(lotAllocations[lot.id] || 0);
    const otherAllocated = totalAllocatedInModal - currentlyAllocatedToThis;
    const needed = Math.max(0, reqQtyForModal - otherAllocated);
    const take = Number(Math.min(avail, needed > 0 ? needed : avail).toFixed(4));
    handleSetLotQty(lot.id, take, avail);
  };

  const handleApplyCustomLot = () => {
    if (!customLotData.internalBatchNo) return;
    const customId = `custom-${Date.now()}`;
    const qtyToAllocate = Number(customLotData.allocatedQty || remainingToAllocate || reqQtyForModal || 1);
    const newCustom = {
      id: customId,
      batchId: customId,
      internalBatchNo: customLotData.internalBatchNo,
      supplierBatchNo: customLotData.supplierBatchNo || 'N/A',
      mfgDate: customLotData.mfgDate ? new Date(customLotData.mfgDate).toISOString() : new Date().toISOString(),
      expiryDate: customLotData.expiryDate ? new Date(customLotData.expiryDate).toISOString() : new Date(Date.now() + 365*24*60*60*1000).toISOString(),
      netQty: qtyToAllocate,
      availableQty: qtyToAllocate,
      storageLocation: 'Custom Batch Override',
      grnRef: 'MANUAL-OVERRIDE',
      source: 'CUSTOM_OVERRIDE',
      isCustom: true
    };

    setCustomLots(prev => [...prev, newCustom]);
    setLotAllocations(prev => ({
      ...prev,
      [customId]: qtyToAllocate
    }));

    setLotModalTab('list');
  };

  const handleSaveAllocations = () => {
    if (activeItemIndex === null) return;
    const allocatedBatches = [];

    allModalLots.forEach(lot => {
      const qty = Number(lotAllocations[lot.id] || 0);
      if (qty > 0) {
        allocatedBatches.push({
          batchId: lot.id,
          internalBatchNo: lot.internalBatchNo,
          supplierBatchNo: lot.supplierBatchNo,
          mfgDate: lot.mfgDate,
          expiryDate: lot.expiryDate,
          allocatedQty: qty,
          availableQty: Number(lot.netQty || lot.availableQty || 0),
          uom: cleanUomForModal
        });
      }
    });

    const first = allocatedBatches[0];
    const combinedSummary = allocatedBatches.length > 1
      ? allocatedBatches.map(b => `${b.internalBatchNo} (${b.allocatedQty} ${cleanUomForModal})`).join(' + ')
      : first?.internalBatchNo || null;

    const totalAlloc = Number(allocatedBatches.reduce((s, b) => s + b.allocatedQty, 0).toFixed(4));

    const updated = [...bomItems];
    updated[activeItemIndex] = {
      ...updated[activeItemIndex],
      allocatedBatches,
      allocatedBatchId: first?.batchId || null,
      internalBatchNo: combinedSummary,
      supplierBatchNo: first?.supplierBatchNo || null,
      mfgDate: first?.mfgDate || null,
      expiryDate: first?.expiryDate || null,
      lotNetQty: totalAlloc
    };

    setBomItems(updated);
    setLotModalOpen(false);
    setActiveItemForLot(null);
    setActiveItemIndex(null);
  };

  // Insert a single raw material / non-inventory item from the catalog
  const handleAddCatalogItem = async (catalogItem) => {
    if (!catalogItem) return;
    const itemId = catalogItem.id;
    if (addedItemIds.has(itemId)) return;

    const baseUomLabel = getCleanUomLabel(
      catalogItem.displayUom || catalogItem.unitId || catalogItem.consumptionUnit || 'units',
      allUoms
    );

    const hasAlt = Boolean(catalogItem.hasAlternateUom && catalogItem.alternateUom);
    const altUomLabel = hasAlt ? getCleanUomLabel(catalogItem.alternateUom, allUoms) : null;
    const convFactor = Number(catalogItem.conversionFactor || 1);

    const availStock = Number(catalogItem.currentStock ?? catalogItem.availableStock ?? 0);
    const unitPrice = Number(catalogItem.ratePerUnit || catalogItem.unitPrice || 0);
    const defaultQty = 1;

    // Auto-fetch & allocate earliest expiring FEFO batch lots
    const lotData = await fetchAndAutoAllocateLots(itemId, defaultQty, baseUomLabel);

    const newItem = {
      id: `item-${itemId}-${Date.now()}`,
      rawMaterialId: itemId,
      rmId: itemId,
      name: catalogItem.name,
      rawMaterialName: catalogItem.name,
      code: catalogItem.code || 'RM',
      rawMaterialCode: catalogItem.code || 'RM',
      categoryType: catalogItem.categoryName || catalogItem.category?.name || 'Key Raw Material',
      itemType: catalogItem.itemType || 'RAW_MATERIAL',
      requiredQty: defaultQty,
      inputQty: defaultQty,
      baseUom: baseUomLabel,
      selectedUom: baseUomLabel,
      uom: baseUomLabel,
      unit: baseUomLabel,
      hasAlternateUom: hasAlt,
      alternateUom: altUomLabel,
      conversionFactor: convFactor,
      baseUomQty: Number(catalogItem.baseUomQty || 1),
      alternateUomQty: Number(catalogItem.alternateUomQty || 1),
      unitCost: unitPrice,
      totalCost: defaultQty * unitPrice,
      availableStock: availStock,
      status: availStock >= defaultQty ? 'Sufficient' : 'Insufficient',
      allocatedBatches: lotData.allocatedBatches || [],
      allocatedBatchId: lotData.allocatedBatchId || null,
      internalBatchNo: lotData.internalBatchNo || null,
      supplierBatchNo: lotData.supplierBatchNo || null,
      mfgDate: lotData.mfgDate || null,
      expiryDate: lotData.expiryDate || null,
      lotNetQty: lotData.lotNetQty || null
    };

    setBomItems(prev => [...prev, newItem]);
  };

  // Insert multiple raw materials from multi-select
  const handleAddMultipleCatalogItems = async (itemsList) => {
    if (!itemsList || itemsList.length === 0) return;
    const newItems = await Promise.all(
      itemsList.map(async (catalogItem) => {
        const itemId = catalogItem.id;
        const baseUomLabel = getCleanUomLabel(
          catalogItem.displayUom || catalogItem.unitId || catalogItem.consumptionUnit || 'units',
          allUoms
        );
        const hasAlt = Boolean(catalogItem.hasAlternateUom && catalogItem.alternateUom);
        const altUomLabel = hasAlt ? getCleanUomLabel(catalogItem.alternateUom, allUoms) : null;
        const convFactor = Number(catalogItem.conversionFactor || 1);
        const availStock = Number(catalogItem.currentStock ?? catalogItem.availableStock ?? 0);
        const unitPrice = Number(catalogItem.ratePerUnit || catalogItem.unitPrice || 0);
        const defaultQty = 1;

        const lotData = await fetchAndAutoAllocateLots(itemId, defaultQty, baseUomLabel);

        return {
          id: `item-${itemId}-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          rawMaterialId: itemId,
          rmId: itemId,
          name: catalogItem.name,
          rawMaterialName: catalogItem.name,
          code: catalogItem.code || 'RM',
          rawMaterialCode: catalogItem.code || 'RM',
          categoryType: catalogItem.categoryName || catalogItem.category?.name || 'Key Raw Material',
          itemType: catalogItem.itemType || 'RAW_MATERIAL',
          requiredQty: defaultQty,
          inputQty: defaultQty,
          baseUom: baseUomLabel,
          selectedUom: baseUomLabel,
          uom: baseUomLabel,
          unit: baseUomLabel,
          hasAlternateUom: hasAlt,
          alternateUom: altUomLabel,
          conversionFactor: convFactor,
          baseUomQty: Number(catalogItem.baseUomQty || 1),
          alternateUomQty: Number(catalogItem.alternateUomQty || 1),
          unitCost: unitPrice,
          totalCost: defaultQty * unitPrice,
          availableStock: availStock,
          status: availStock >= defaultQty ? 'Sufficient' : 'Insufficient',
          allocatedBatches: lotData.allocatedBatches || [],
          allocatedBatchId: lotData.allocatedBatchId || null,
          internalBatchNo: lotData.internalBatchNo || null,
          supplierBatchNo: lotData.supplierBatchNo || null,
          mfgDate: lotData.mfgDate || null,
          expiryDate: lotData.expiryDate || null,
          lotNetQty: lotData.lotNetQty || null
        };
      })
    );

    setBomItems(prev => [...prev, ...newItems]);
  };

  // Compute live aggregates and Excel recipe costing
  const { 
    directMaterialCost, 
    wastageCost, 
    overheadCost, 
    grandTotalCost, 
    unitCost, 
    insufficientItems, 
    sufficientCount 
  } = useMemo(() => {
    let direct = 0;
    const insufficient = [];
    let suffCount = 0;

    bomItems.forEach(item => {
      const itemCost = Number(item.requiredQty || 0) * Number(item.unitCost || 0);
      direct += itemCost;
      const isSufficient = Number(item.availableStock || 0) >= Number(item.requiredQty || 0);
      if (!isSufficient) {
        insufficient.push({
          name: item.rawMaterialName || item.name,
          shortfall: Number(item.requiredQty || 0) - Number(item.availableStock || 0),
          uom: getCleanUomLabel(item.selectedUom || item.uom || item.unit, allUoms)
        });
      } else {
        suffCount++;
      }
    });

    const wastage = (direct * Number(wastagePercent || 0)) / 100;
    const overhead = (direct * Number(overheadPercent || 0)) / 100;
    const grand = direct + wastage + overhead;
    const perUnit = batchQty > 0 ? grand / batchQty : 0;

    return {
      directMaterialCost: direct,
      wastageCost: wastage,
      overheadCost: overhead,
      grandTotalCost: grand,
      unitCost: perUnit,
      insufficientItems: insufficient,
      sufficientCount: suffCount
    };
  }, [bomItems, wastagePercent, overheadPercent, batchQty, allUoms]);

  // Handle Drag & Drop Reordering
  const handleDragStart = (e, index) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDrop = (e, dropIndex) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === dropIndex) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }
    const updated = [...bomItems];
    const [moved] = updated.splice(draggedIndex, 1);
    updated.splice(dropIndex, 0, moved);
    setBomItems(updated);
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  // Quantity Change Handler
  const handleQtyChange = (index, newQty) => {
    const qty = Math.max(0, Number(newQty) || 0);
    const updated = [...bomItems];
    const item = updated[index];
    const unitPrice = Number(item.unitCost || 0);
    const avail = Number(item.availableStock || 0);
    
    updated[index] = {
      ...item,
      requiredQty: qty,
      totalCost: qty * unitPrice,
      status: avail >= qty ? 'Sufficient' : 'Insufficient'
    };
    setBomItems(updated);
  };

  // Stepper increment / decrement
  const stepQuantity = (index, delta) => {
    const item = bomItems[index];
    const current = Number(item.requiredQty || 0);
    const nextVal = Math.max(0.1, Number((current + delta).toFixed(2)));
    handleQtyChange(index, nextVal);
  };

  // UOM Change Handler with live alternate UOM conversion factor
  const handleUomChange = (index, targetUom) => {
    const updated = [...bomItems];
    const item = updated[index];
    const factor = Number(item.conversionFactor || 1);
    let convertedQty = item.requiredQty;

    const baseUom = item.baseUom || item.uom;
    const isSwitchingToAlt = targetUom === item.alternateUom && item.selectedUom !== item.alternateUom;
    const isSwitchingToBase = targetUom === baseUom && item.selectedUom === item.alternateUom;

    if (isSwitchingToAlt && factor > 0) {
      convertedQty = Number((item.requiredQty / factor).toFixed(4));
    } else if (isSwitchingToBase && factor > 0) {
      convertedQty = Number((item.requiredQty * factor).toFixed(4));
    }

    updated[index] = {
      ...item,
      selectedUom: targetUom,
      requiredQty: convertedQty,
      totalCost: convertedQty * Number(item.unitCost || 0)
    };
    setBomItems(updated);
  };

  // Move item position
  const moveItem = (from, to) => {
    if (to < 0 || to >= bomItems.length) return;
    const updated = [...bomItems];
    const [moved] = updated.splice(from, 1);
    updated.splice(to, 0, moved);
    setBomItems(updated);
  };

  // Remove Item Handler
  const handleRemoveItem = (index) => {
    const itemToRemove = bomItems[index];
    const updated = bomItems.filter((_, i) => i !== index);
    setBomItems(updated);
    if (onUndoRemove) {
      onUndoRemove({ index, item: itemToRemove });
    }
  };

  return (
    <div className="space-y-4">

      {/* ─────────────────────── RECIPE TEMPLATE & AUTO-RECOMMENDATION BANNER ─────────────────────── */}
      <div className="p-3 bg-gradient-to-r from-indigo-50 via-slate-50 to-indigo-50 dark:from-indigo-950/40 dark:via-slate-900 dark:to-indigo-950/40 border border-indigo-200 dark:border-indigo-800/80 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-xs">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold shrink-0 shadow-xs">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black text-indigo-900 dark:text-indigo-200 uppercase tracking-wide">
                {recipeSource === 'LEARNED' 
                  ? 'Auto-Recommended Formulation (Learned from previous batch)'
                  : recipeSource === 'SUBCATEGORY_BASE' 
                  ? `Subcategory Base Formulation (${recipeTitle})`
                  : 'Dynamic Batch Formulation'}
              </span>
              <span className="text-[10px] font-bold px-2 py-0.2 rounded-full bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300">
                Default Template
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              Production manager can inspect, add materials, select Alternate UOMs, and allocate FEFO warehouse lots. Any updates will be remembered for future runs.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
          <span className="text-[11px] font-mono font-bold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 px-2.5 py-1 rounded-xl border border-slate-200 dark:border-slate-700">
            Yield: {batchQty} {product?.unit?.abbreviation || 'pcs'}
          </span>
        </div>
      </div>

      {/* ─────────────────────── BROWSE RAW MATERIALS & NON-INVENTORY SELECTOR ─────────────────────── */}
      <div className="space-y-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-extrabold uppercase tracking-wider text-slate-850 dark:text-slate-100 flex items-center gap-1.5">
              <Package className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              Browse Raw Materials & Non-Inventory Items with Category & UOM
            </span>
            <span className="text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
              Added Items ({bomItems.length})
            </span>
          </div>
          <span className="text-[10px] text-slate-400">
            Type keyword or click item to insert instantly • Alternate UOM active only if enabled in /setup/raw-material
          </span>
        </div>

        {/* Full Width Searchable Item Select (Same engine as /purchase-orders/create) */}
        <div className="relative w-full">
          <SearchableItemSelect
            ref={rmSelectRef}
            rawMaterials={allSelectableItems}
            value={null}
            onChange={handleAddCatalogItem}
            onAddMultiple={handleAddMultipleCatalogItems}
            addedItemIds={addedItemIds}
            lowStockIds={lowStockIds}
            placeholder="Search raw material name (e.g. strawberry, milk, sugar), code, category, or UOM..."
          />
        </div>
      </div>

      {/* ─────────────────────── MULTI-TIER EXCEL RECIPE COSTING RIBBON ─────────────────────── */}
      <div className="bg-slate-50 dark:bg-slate-800/60 p-3 sm:p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
        <div className="p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/70 dark:border-slate-800">
          <span className="text-[9px] text-slate-400 font-bold uppercase block">Direct RM Cost</span>
          <span className="font-mono font-extrabold text-slate-850 dark:text-white text-xs sm:text-sm">
            ₹{directMaterialCost.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>

        <div className="p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/70 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-[9px] text-slate-400 font-bold uppercase block">Wastage %</span>
            <input
              type="number"
              min="0"
              max="50"
              value={wastagePercent}
              onChange={(e) => setWastagePercent && setWastagePercent(Number(e.target.value) || 0)}
              className="w-11 text-right font-mono font-bold text-xs bg-slate-100 dark:bg-slate-800 rounded px-1 py-0.5"
            />
          </div>
          <span className="font-mono font-bold text-slate-600 dark:text-slate-300 text-xs mt-0.5 block">
            +₹{wastageCost.toFixed(2)}
          </span>
        </div>

        <div className="p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/70 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-[9px] text-slate-400 font-bold uppercase block">Overhead %</span>
            <input
              type="number"
              min="0"
              max="50"
              value={overheadPercent}
              onChange={(e) => setOverheadPercent && setOverheadPercent(Number(e.target.value) || 0)}
              className="w-11 text-right font-mono font-bold text-xs bg-slate-100 dark:bg-slate-800 rounded px-1 py-0.5"
            />
          </div>
          <span className="font-mono font-bold text-slate-600 dark:text-slate-300 text-xs mt-0.5 block">
            +₹{overheadCost.toFixed(2)}
          </span>
        </div>

        <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/40 rounded-xl border border-indigo-200 dark:border-indigo-800">
          <span className="text-[9px] text-indigo-600 dark:text-indigo-400 font-bold uppercase block">Total Batch Cost</span>
          <span className="font-mono font-black text-indigo-700 dark:text-indigo-300 text-xs sm:text-sm">
            ₹{grandTotalCost.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>

        <div className="p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/70 dark:border-slate-800">
          <span className="text-[9px] text-slate-400 font-bold uppercase block">Unit Cost</span>
          <span className="font-mono font-bold text-slate-700 dark:text-slate-300 text-xs sm:text-sm">
            ₹{unitCost.toFixed(2)} / {getCleanUomLabel(product?.unit?.abbreviation || 'pcs', allUoms)}
          </span>
        </div>

        <div className="p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/70 dark:border-slate-800">
          <span className="text-[9px] text-slate-400 font-bold uppercase block">Stock Feasibility</span>
          {insufficientItems.length === 0 ? (
            <span className="inline-flex items-center gap-1 text-emerald-600 text-xs font-bold mt-0.5">
              <CheckCircle2 className="w-3.5 h-3.5" /> 100% Ready
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-rose-600 text-xs font-bold mt-0.5">
              <AlertTriangle className="w-3.5 h-3.5" /> {insufficientItems.length} Shortage
            </span>
          )}
        </div>
      </div>

      {/* Undo Item Removed Banner */}
      {removedItem && (
        <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl flex items-center justify-between text-xs animate__animated animate__fadeIn">
          <span className="text-amber-800 dark:text-amber-300 font-medium">
            Removed <strong>{removedItem.item.rawMaterialName || removedItem.item.name}</strong> from formulation.
          </span>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onUndoRemove}
              className="h-7 text-xs font-bold bg-white text-amber-900 border-amber-300 hover:bg-amber-100"
            >
              <RotateCcw className="w-3 h-3 mr-1" /> Undo
            </Button>
            <button
              type="button"
              onClick={onClearUndo}
              className="text-slate-400 hover:text-slate-600 p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ─────────────────────── FORMULATION INGREDIENTS LIST ─────────────────────── */}
      {loading ? (
        <div className="p-12 text-center space-y-3">
          <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs text-slate-500 font-semibold">Scaling formula & checking warehouse inventory...</p>
        </div>
      ) : bomItems.length > 0 ? (
        <div className="space-y-2.5">
          {bomItems.map((item, index) => {
            const reqQty = Number(item.requiredQty || 0);
            const availStock = Number(item.availableStock || 0);
            const isSufficient = availStock >= reqQty;
            const remainingBalance = availStock - reqQty;
            const shortfall = Math.max(0, reqQty - availStock);
            const isDragOver = dragOverIndex === index;

            // Resolved clean human UOM labels
            const baseUomClean = getCleanUomLabel(item.baseUom || item.uom || item.unit, allUoms);
            const selectedUomClean = getCleanUomLabel(item.selectedUom || baseUomClean, allUoms);
            const hasAlt = Boolean(item.hasAlternateUom && item.alternateUom);
            const altUomClean = hasAlt ? getCleanUomLabel(item.alternateUom, allUoms) : null;

            return (
              <div
                key={item.id || index}
                draggable
                onDragStart={(e) => handleDragStart(e, index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDrop={(e) => handleDrop(e, index)}
                className={`p-3.5 sm:p-4 rounded-2xl border transition-all duration-150 ${
                  isDragOver
                    ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/40 ring-2 ring-indigo-500'
                    : isSufficient
                    ? 'bg-white dark:bg-slate-900 border-slate-200/90 dark:border-slate-800 hover:border-slate-300'
                    : 'bg-rose-50/20 dark:bg-rose-950/10 border-rose-200 dark:border-rose-900/50'
                }`}
              >
                <div className="flex flex-col gap-3">

                  {/* Row 1: Header (Grip, Name, Code, Category, Status Pill, Reorder & Delete) */}
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <div className="flex items-center justify-center gap-1 cursor-grab active:cursor-grabbing text-slate-400 hover:text-indigo-600 p-1">
                        <GripVertical className="w-3.5 h-3.5" />
                        <span className="font-mono text-[10px] font-bold">{index + 1}</span>
                      </div>

                      <span className="font-extrabold text-xs sm:text-sm text-slate-900 dark:text-white">
                        {item.rawMaterialName || item.name}
                      </span>

                      <span className="text-[10px] font-mono text-slate-500 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                        {item.rawMaterialCode || item.code || 'RM'}
                      </span>

                      <span className="text-[9px] uppercase tracking-wider px-2 py-0.5 rounded-full font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/80 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                        {item.categoryType || 'General'}
                      </span>

                      {item.itemType === 'NON_INVENTORY' && (
                        <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded font-bold bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300">
                          Non-Inv
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {isSufficient ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                          <CheckCircle2 className="w-3 h-3 text-emerald-500" /> Sufficient
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800 animate-pulse">
                          <AlertTriangle className="w-3 h-3 text-rose-500" /> Shortfall ({shortfall.toFixed(2)} {selectedUomClean})
                        </span>
                      )}

                      <div className="flex items-center gap-0.5 ml-2">
                        <button
                          type="button"
                          onClick={() => moveItem(index, index - 1)}
                          disabled={index === 0}
                          className="p-1 rounded text-slate-400 hover:text-slate-700 disabled:opacity-30 cursor-pointer"
                          title="Move up"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveItem(index, index + 1)}
                          disabled={index === bomItems.length - 1}
                          className="p-1 rounded text-slate-400 hover:text-slate-700 disabled:opacity-30 cursor-pointer"
                          title="Move down"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(index)}
                          className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer transition-colors"
                          title="Remove item"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Row 2: Metrics Grid (Required Qty + UOM, Warehouse Stock, Projected Remaining Balance, Line Cost) */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-slate-50/70 dark:bg-slate-950/40 rounded-xl border border-slate-100 dark:border-slate-800">
                    
                    {/* 1. Required Quantity & UOM Selector */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <label className="text-slate-500 dark:text-slate-400 uppercase font-bold text-[9px] block">
                          Required Quantity
                        </label>
                        {hasAlt && (
                          <span className="text-[9px] text-indigo-600 dark:text-indigo-400 font-semibold">
                            1 {altUomClean} = {item.conversionFactor || 1} {baseUomClean}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5">
                        <div className="inline-flex items-center border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 p-0.5 shadow-2xs hover:border-indigo-400 transition-colors flex-1">
                          <button
                            type="button"
                            onClick={() => stepQuantity(index, -1)}
                            disabled={Number(item.requiredQty) <= 0.1}
                            className="w-6 h-6 flex items-center justify-center rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-indigo-50 hover:text-indigo-600 disabled:opacity-30 cursor-pointer select-none"
                            title="Decrease quantity"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <Input
                            type="number"
                            step="any"
                            min="0.001"
                            value={item.requiredQty}
                            onChange={(e) => handleQtyChange(index, e.target.value)}
                            className="w-full h-6 p-0 text-center font-bold text-xs bg-transparent border-0 focus-visible:ring-0 font-mono text-slate-900 dark:text-white"
                          />
                          <button
                            type="button"
                            onClick={() => stepQuantity(index, 1)}
                            className="w-6 h-6 flex items-center justify-center rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-indigo-50 hover:text-indigo-600 cursor-pointer select-none"
                            title="Increase quantity"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>

                        {/* UOM Selector: Only shows dropdown if hasAlternateUom is enabled in /setup/raw-material */}
                        {hasAlt ? (
                          <select
                            value={selectedUomClean}
                            onChange={(e) => handleUomChange(index, e.target.value)}
                            className="h-8 px-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-indigo-700 dark:text-indigo-300 cursor-pointer focus:outline-none focus:ring-1 focus:ring-indigo-500 shadow-2xs"
                          >
                            <option value={baseUomClean}>{baseUomClean} (Base)</option>
                            <option value={altUomClean}>{altUomClean} (Alt ×{item.conversionFactor || 1})</option>
                          </select>
                        ) : (
                          <span className="px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-bold font-mono text-xs text-slate-700 dark:text-slate-300 shadow-2xs">
                            {baseUomClean}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* 2. Warehouse Stock & Rate */}
                    <div className="space-y-1">
                      <label className="text-slate-500 dark:text-slate-400 uppercase font-bold text-[9px] block">
                        Warehouse Stock
                      </label>
                      <div className="flex items-center gap-1 mt-0.5">
                        <span className={`font-mono text-xs sm:text-sm font-extrabold ${isSufficient ? 'text-slate-850 dark:text-white' : 'text-rose-600 dark:text-rose-400'}`}>
                          {availStock.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {selectedUomClean}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400 block font-mono">
                        Rate: ₹{Number(item.unitCost || 0).toFixed(2)} / {selectedUomClean}
                      </span>
                    </div>

                    {/* 3. Projected Remaining Balance & Line Cost */}
                    <div className="space-y-1">
                      <label className="text-slate-500 dark:text-slate-400 uppercase font-bold text-[9px] block">
                        {isSufficient ? 'Remaining Balance' : 'Stock Shortfall'}
                      </label>
                      <div className="flex items-center gap-1 mt-0.5">
                        {isSufficient ? (
                          <span className="font-mono text-xs sm:text-sm font-extrabold text-emerald-600 dark:text-emerald-400">
                            +{remainingBalance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {selectedUomClean}
                          </span>
                        ) : (
                          <span className="font-mono text-xs sm:text-sm font-extrabold text-rose-600 dark:text-rose-400">
                            −{shortfall.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {selectedUomClean}
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] font-mono font-bold text-slate-700 dark:text-slate-300 block">
                        Line Cost: ₹{(reqQty * Number(item.unitCost || 0)).toFixed(2)}
                      </span>
                    </div>

                  </div>

                  {/* Row 3: FEFO Batch Lot Information & Multi-Lot Switcher */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
                    <div className="flex items-center gap-2 flex-wrap flex-1">
                      <Tag className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                      <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">FEFO Allocated Lots:</span>

                      {Array.isArray(item.allocatedBatches) && item.allocatedBatches.length > 0 ? (
                        <>
                          {item.allocatedBatches.map((b, bIdx) => (
                            <div
                              key={b.batchId || bIdx}
                              className="inline-flex items-center gap-1.5 font-mono text-[11px] font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded-lg border border-indigo-200 dark:border-indigo-800"
                            >
                              <span>{b.internalBatchNo}</span>
                              <span className="text-indigo-900 dark:text-indigo-200 bg-white/80 dark:bg-slate-900/80 px-1 rounded text-[10px]">
                                {Number(b.allocatedQty).toFixed(2)} {selectedUomClean}
                              </span>
                              {b.expiryDate && (
                                <span className="text-[9px] text-amber-700 dark:text-amber-400 font-normal">
                                  Exp: {new Date(b.expiryDate).toLocaleDateString('en-GB')}
                                </span>
                              )}
                            </div>
                          ))}

                          {/* Allocation Fulfillment Status Badge */}
                          {(() => {
                            const totAlloc = Number(item.allocatedBatches.reduce((s, b) => s + Number(b.allocatedQty || 0), 0).toFixed(4));
                            const req = Number(item.requiredQty || 0);
                            const isFulfilled = totAlloc >= req;
                            return (
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                                isFulfilled
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                  : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                              }`}>
                                <Check className="w-3 h-3" />
                                {totAlloc.toFixed(2)} / {req.toFixed(2)} {selectedUomClean} Allocated
                              </span>
                            );
                          })()}
                        </>
                      ) : item.internalBatchNo ? (
                        <div className="inline-flex items-center gap-1.5 font-mono text-[11px] font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded-lg border border-indigo-200 dark:border-indigo-800">
                          <span>{item.internalBatchNo}</span>
                          {item.expiryDate && (
                            <span className="text-[10px] text-amber-700 dark:text-amber-400">
                              Exp: {new Date(item.expiryDate).toLocaleDateString('en-GB')}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-[11px] text-amber-600 dark:text-amber-400 font-semibold italic">
                          No active lot allocated (General warehouse inventory)
                        </span>
                      )}
                    </div>

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => openLotModal(item, index)}
                      className="h-7 px-3 text-xs font-bold rounded-lg border-indigo-200 dark:border-indigo-800 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950 cursor-pointer self-start sm:self-auto shrink-0 flex items-center gap-1"
                    >
                      <Boxes className="w-3.5 h-3.5" />
                      Allocate Batches ({item.allocatedBatches?.length || (item.internalBatchNo ? 1 : 0)})
                    </Button>
                  </div>

                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="py-12 px-4 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-3xl text-center space-y-3 bg-slate-50/50 dark:bg-slate-900/30">
          <Package className="w-12 h-12 mx-auto text-indigo-400 dark:text-indigo-500 opacity-80" />
          <div className="space-y-1">
            <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
              No ingredients loaded for this product formulation yet.
            </p>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Use the search bar above to browse and add raw materials or non-inventory items. Added materials will automatically allocate the earliest expiring FEFO batch lot.
            </p>
          </div>
          <Button
            type="button"
            onClick={() => rmSelectRef.current?.openDropdown()}
            className="text-xs font-bold rounded-xl mt-1 text-white bg-indigo-600 hover:bg-indigo-700 shadow-md cursor-pointer transition-all inline-flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5 mr-1" /> Browse Materials Catalog
          </Button>
        </div>
      )}

      {/* ─────────────────────── MULTI-LOT SELECTION FEFO MODAL ─────────────────────── */}
      {lotModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 max-w-2xl w-full p-6 shadow-2xl space-y-4 animate__animated animate__zoomIn">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/70 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                  <Boxes className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white tracking-tight">
                    Allocate Warehouse Batch Lots (FEFO)
                  </h3>
                  <p className="text-xs text-slate-400">
                    {activeItemForLot?.rawMaterialName || activeItemForLot?.name} • <span className="font-mono">{activeItemForLot?.rawMaterialCode || activeItemForLot?.code}</span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setLotModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Live Allocation KPI Bar */}
            <div className="grid grid-cols-3 gap-2 p-2.5 bg-slate-50 dark:bg-slate-850 rounded-2xl border border-slate-200/80 dark:border-slate-800 text-center">
              <div className="space-y-0.5">
                <span className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">Required</span>
                <p className="text-xs sm:text-sm font-mono font-black text-slate-900 dark:text-white">
                  {reqQtyForModal.toFixed(2)} {cleanUomForModal}
                </p>
              </div>

              <div className="space-y-0.5 border-x border-slate-200 dark:border-slate-800">
                <span className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">Total Allocated</span>
                <p className={`text-xs sm:text-sm font-mono font-black ${
                  isFullyAllocated ? 'text-emerald-600 dark:text-emerald-400' : totalAllocatedInModal > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400'
                }`}>
                  {totalAllocatedInModal.toFixed(2)} {cleanUomForModal}
                </p>
              </div>

              <div className="space-y-0.5">
                <span className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">Remaining</span>
                <p className={`text-xs sm:text-sm font-mono font-black ${
                  remainingToAllocate === 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                }`}>
                  {remainingToAllocate === 0 ? '0.00 (Fulfilled)' : `−${remainingToAllocate.toFixed(2)} ${cleanUomForModal}`}
                </p>
              </div>
            </div>

            {/* Quick Actions & Search Bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                <Input
                  type="text"
                  placeholder="Search batch number (e.g. BATCH-001-A), supplier lot, GRN..."
                  value={lotSearchTerm}
                  onChange={(e) => setLotSearchTerm(e.target.value)}
                  className="pl-9 pr-8 text-xs h-9 rounded-xl font-mono bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                />
                {lotSearchTerm && (
                  <button
                    type="button"
                    onClick={() => setLotSearchTerm('')}
                    className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <Button
                  type="button"
                  size="sm"
                  onClick={handleAutoAllocateFefo}
                  className="h-9 px-3 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs cursor-pointer inline-flex items-center gap-1"
                  title="Automatically allocate batches by earliest expiry date"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Auto-Allocate FEFO
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleClearAllAllocations}
                  className="h-9 px-2.5 text-xs font-bold rounded-xl border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-800 dark:hover:text-white"
                  title="Clear all allocated batch quantities"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>

            {/* Tab Switcher */}
            <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
              <button
                type="button"
                onClick={() => setLotModalTab('list')}
                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all ${
                  lotModalTab === 'list'
                    ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                Warehouse Batches ({availableLots.length})
              </button>
              <button
                type="button"
                onClick={() => setLotModalTab('custom')}
                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all ${
                  lotModalTab === 'custom'
                    ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                Manual Batch / Override Dates {customLots.length > 0 && `(${customLots.length})`}
              </button>
            </div>

            {/* Tab Content */}
            {lotModalTab === 'list' ? (
              loadingLots ? (
                <div className="p-8 text-center space-y-2">
                  <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
                  <p className="text-xs text-slate-400">Loading active warehouse inventory batches...</p>
                </div>
              ) : filteredLots.length > 0 ? (
                <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
                  {filteredLots.map((lot, lIdx) => {
                    const isExpired = lot.expiryDate && new Date(lot.expiryDate) < new Date();
                    const allocatedQty = Number(lotAllocations[lot.id] || 0);
                    const isAllocated = allocatedQty > 0;
                    const availQty = Number(lot.netQty || lot.availableQty || 0);
                    const isEarliestFefo = lIdx === 0 && !isExpired && !lot.isCustom;

                    return (
                      <div
                        key={lot.id}
                        className={`p-3 rounded-2xl border transition-all ${
                          isAllocated
                            ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/30 ring-1 ring-indigo-400/40 shadow-xs'
                            : isExpired
                            ? 'border-rose-200 bg-rose-50/20 dark:bg-rose-950/10 opacity-70'
                            : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900'
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          
                          {/* Batch Identity & Details */}
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono font-black text-xs text-slate-900 dark:text-white">
                                {lot.internalBatchNo}
                              </span>

                              {isEarliestFefo && (
                                <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 flex items-center gap-1">
                                  🥇 Earliest Expiry (FEFO Recommended)
                                </span>
                              )}

                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                                {lot.source === 'PURCHASE_GRN' ? 'GRN / Purchase' : lot.source === 'CUSTOM_OVERRIDE' ? 'Custom Override' : 'Warehouse Stock'}
                              </span>

                              {isExpired ? (
                                <span className="text-[9px] font-bold text-rose-600 bg-rose-100 dark:bg-rose-950 px-1.5 py-0.5 rounded">
                                  EXPIRED
                                </span>
                              ) : (
                                <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded">
                                  AVAILABLE
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-2 text-[10px] text-slate-500 dark:text-slate-400 flex-wrap">
                              <span className="font-mono">
                                Supplier Batch: <strong className="text-slate-700 dark:text-slate-200">{lot.supplierBatchNo || 'N/A'}</strong>
                              </span>
                              <span>•</span>
                              <span>Mfg: {lot.mfgDate ? new Date(lot.mfgDate).toLocaleDateString('en-GB') : 'N/A'}</span>
                              <span>•</span>
                              <span className={isExpired ? 'text-rose-600 font-bold' : 'text-amber-700 dark:text-amber-400 font-bold'}>
                                Exp: {lot.expiryDate ? new Date(lot.expiryDate).toLocaleDateString('en-GB') : 'No Expiry'}
                              </span>
                              {lot.grnRef && (
                                <>
                                  <span>•</span>
                                  <span>GRN: {lot.grnRef}</span>
                                </>
                              )}
                              {lot.storageLocation && (
                                <>
                                  <span>•</span>
                                  <span>Loc: {lot.storageLocation}</span>
                                </>
                              )}
                            </div>
                          </div>

                          {/* Allocation Controls */}
                          <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                            
                            {/* Stock Indicator */}
                            <div className="text-right mr-1">
                              <span className="text-[10px] text-slate-400 block uppercase font-bold">In Stock</span>
                              <span className="font-mono font-extrabold text-xs text-slate-800 dark:text-slate-200">
                                {availQty.toFixed(2)} {cleanUomForModal}
                              </span>
                            </div>

                            {/* Allocation Input & Stepper */}
                            <div className="inline-flex items-center border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 p-0.5 shadow-2xs">
                              <button
                                type="button"
                                onClick={() => handleSetLotQty(lot.id, Math.max(0, allocatedQty - 1), availQty)}
                                disabled={allocatedQty <= 0}
                                className="w-6 h-6 flex items-center justify-center rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-indigo-50 hover:text-indigo-600 disabled:opacity-30 cursor-pointer select-none"
                              >
                                <Minus className="w-3 h-3" />
                              </button>
                              <input
                                type="number"
                                step="any"
                                min="0"
                                max={availQty}
                                value={allocatedQty || ''}
                                onChange={(e) => handleSetLotQty(lot.id, e.target.value, availQty)}
                                placeholder="0"
                                className="w-14 h-6 p-0 text-center font-bold text-xs bg-transparent border-0 focus-visible:ring-0 font-mono text-indigo-700 dark:text-indigo-300"
                              />
                              <button
                                type="button"
                                onClick={() => handleSetLotQty(lot.id, Math.min(availQty, allocatedQty + 1), availQty)}
                                disabled={allocatedQty >= availQty}
                                className="w-6 h-6 flex items-center justify-center rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-indigo-50 hover:text-indigo-600 disabled:opacity-30 cursor-pointer select-none"
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                            </div>

                            {/* Max Available Fill Button */}
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => handleAllocateMaxForLot(lot)}
                              disabled={availQty <= 0}
                              className="h-7 px-2 text-[10px] font-bold rounded-lg border-indigo-200 dark:border-indigo-800 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950 cursor-pointer"
                            >
                              Max
                            </Button>
                          </div>

                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-8 text-center space-y-2 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
                  <Tag className="w-8 h-8 text-slate-300 mx-auto" />
                  <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                    {lotSearchTerm ? 'No batches match your search criteria.' : 'No active warehouse batch lots found for this raw material.'}
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Switch to the "Manual Batch / Override Dates" tab above to specify company-provided batch details.
                  </p>
                </div>
              )
            ) : (
              /* Custom Lot Form */
              <div className="space-y-3 p-4 bg-slate-50 dark:bg-slate-850 rounded-2xl border border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-2 pb-1 border-b border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-800 dark:text-slate-200">
                  <Warehouse className="w-4 h-4 text-indigo-500" />
                  Enter Company / Supplier Batch Specifications
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase block">
                      Our Internal Batch Number *
                    </label>
                    <Input
                      type="text"
                      value={customLotData.internalBatchNo}
                      onChange={(e) => setCustomLotData(prev => ({ ...prev, internalBatchNo: e.target.value }))}
                      placeholder="e.g. BATCH-NEWSPAPE-008"
                      className="text-xs font-mono font-bold bg-white dark:bg-slate-900"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase block">
                      Company / Supplier Provided Batch Number
                    </label>
                    <Input
                      type="text"
                      value={customLotData.supplierBatchNo}
                      onChange={(e) => setCustomLotData(prev => ({ ...prev, supplierBatchNo: e.target.value }))}
                      placeholder="e.g. SUP-BATCH-8921"
                      className="text-xs font-mono bg-white dark:bg-slate-900"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase block">
                      Company Manufacture Date
                    </label>
                    <input
                      type="date"
                      value={customLotData.mfgDate}
                      onChange={(e) => setCustomLotData(prev => ({ ...prev, mfgDate: e.target.value }))}
                      className="w-full h-9 px-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-white font-mono"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase block">
                      Company Expiry Date *
                    </label>
                    <input
                      type="date"
                      value={customLotData.expiryDate}
                      onChange={(e) => setCustomLotData(prev => ({ ...prev, expiryDate: e.target.value }))}
                      className="w-full h-9 px-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-white font-mono font-bold text-amber-700 dark:text-amber-400"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase block">
                      Allocated Qty ({cleanUomForModal})
                    </label>
                    <Input
                      type="number"
                      step="any"
                      min="0.001"
                      value={customLotData.allocatedQty}
                      onChange={(e) => setCustomLotData(prev => ({ ...prev, allocatedQty: e.target.value }))}
                      placeholder={remainingToAllocate > 0 ? String(remainingToAllocate) : String(reqQtyForModal)}
                      className="text-xs font-mono font-bold bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-300"
                    />
                  </div>
                </div>

                <Button
                  type="button"
                  onClick={handleApplyCustomLot}
                  disabled={!customLotData.internalBatchNo}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs h-9 rounded-xl mt-2 cursor-pointer shadow-sm disabled:opacity-50"
                >
                  <Plus className="w-3.5 h-3.5 mr-1.5" /> Add Custom Batch to Allocation
                </Button>
              </div>
            )}

            {/* Modal Footer */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                {isFullyAllocated ? (
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" /> Required quantity fully satisfied ({totalAllocatedInModal.toFixed(2)} / {reqQtyForModal.toFixed(2)} {cleanUomForModal})
                  </span>
                ) : (
                  <span className="text-xs font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4" /> {remainingToAllocate.toFixed(2)} {cleanUomForModal} remaining to allocate ({totalAllocatedInModal.toFixed(2)} / {reqQtyForModal.toFixed(2)})
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 self-end sm:self-auto">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setLotModalOpen(false)}
                  className="text-xs rounded-xl"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleSaveAllocations}
                  className="text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5 mr-1" /> Save & Apply Allocations
                </Button>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
