import React, { useState, useEffect, useMemo } from 'react';
import { api } from '@/lib/axios';
import {
  X,
  Search,
  Check,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  Layers,
  Calendar,
  Building2,
  Tag,
  ShieldCheck,
  RefreshCw,
  Plus,
  Minus
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function RMLotAllocationModal({
  isOpen,
  onClose,
  item,
  initialAllocations = [],
  onApplyAllocations,
  readOnly = false
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [availableBatches, setAvailableBatches] = useState([]);
  const [allocations, setAllocations] = useState({}); // { [batchId]: number }

  const rawMaterialId = item?.rawMaterialId || item?.productId || item?.id;
  const rawMaterialName = item?.itemDescription || item?.name || 'Raw Material';
  const rawMaterialCode = item?.systemCode || item?.code || 'RM';
  const requiredQty = Number(item?.quantity || 1);
  const uom = item?.unitOfSale || item?.uom || item?.unitId || 'kg';

  // Load existing allocations and fetch available batches from API
  useEffect(() => {
    if (!isOpen || !rawMaterialId) return;

    // Initialize allocations map from initialAllocations prop
    const allocMap = {};
    if (Array.isArray(initialAllocations)) {
      initialAllocations.forEach(a => {
        const id = a.batchId || a.id;
        const qty = Number(a.allocatedQty !== undefined ? a.allocatedQty : (a.quantity || 0));
        if (id && qty > 0) {
          allocMap[id] = qty;
        }
      });
    }
    setAllocations(allocMap);
    setSearchTerm('');

    // Fetch batches
    setLoading(true);
    api.get(`/orders/raw-materials/${rawMaterialId}/available-batches`)
      .then(res => {
        const list = Array.isArray(res.data) ? res.data : [];
        setAvailableBatches(list);
      })
      .catch(err => {
        console.error('Failed to fetch available RM batches:', err);
        // Fallback to production endpoint if needed
        api.get(`/production/rm-batches/${rawMaterialId}`)
          .then(res2 => {
            const list2 = Array.isArray(res2.data) ? res2.data : [];
            setAvailableBatches(list2.map(b => ({
              id: b.id,
              batchId: b.id,
              batchNo: b.internalBatchNo || b.batchNo || b.batchNumber,
              remainingQty: Number(b.availableQty || b.netQty || 0),
              supplierName: b.supplierName || 'Standard Supplier',
              grnNumber: b.grnNumber || b.grnRef || 'N/A',
              mfgDate: b.mfgDate,
              expiryDate: b.expiryDate,
              uom: uom
            })));
          })
          .catch(() => setAvailableBatches([]));
      })
      .finally(() => setLoading(false));
  }, [isOpen, rawMaterialId, initialAllocations, uom]);

  // Compute total allocated quantity
  const totalAllocated = useMemo(() => {
    return Object.values(allocations).reduce((sum, q) => sum + (Number(q) || 0), 0);
  }, [allocations]);

  const balanceNeeded = Math.max(0, requiredQty - totalAllocated);
  const isFulfilled = totalAllocated >= requiredQty;

  // Filter batches by search term
  const filteredBatches = useMemo(() => {
    if (!searchTerm.trim()) return availableBatches;
    const q = searchTerm.toLowerCase().trim();
    return availableBatches.filter(b =>
      (b.batchNo && b.batchNo.toLowerCase().includes(q)) ||
      (b.grnNumber && b.grnNumber.toLowerCase().includes(q)) ||
      (b.supplierName && b.supplierName.toLowerCase().includes(q)) ||
      (b.storageLocation && b.storageLocation.toLowerCase().includes(q))
    );
  }, [availableBatches, searchTerm]);

  // Auto-allocate FEFO (Earliest expiry first)
  const handleAutoFEFO = () => {
    let remaining = requiredQty;
    const newAlloc = {};

    for (const b of availableBatches) {
      if (remaining <= 0) break;
      const avail = Number(b.remainingQty || b.netQty || 0);
      if (avail <= 0) continue;

      const take = Math.min(remaining, avail);
      newAlloc[b.id] = take;
      remaining = Math.max(0, remaining - take);
    }

    setAllocations(newAlloc);
  };

  // Clear all allocations
  const handleClear = () => {
    setAllocations({});
  };

  // Update specific batch allocation quantity
  const handleQtyChange = (batchId, val, maxAvail) => {
    const num = Math.max(0, Math.min(maxAvail, Number(val) || 0));
    setAllocations(prev => {
      const updated = { ...prev };
      if (num > 0) {
        updated[batchId] = num;
      } else {
        delete updated[batchId];
      }
      return updated;
    });
  };

  // Quick Max allocation for a specific batch
  const handleMaxBatch = (batchId, maxAvail) => {
    const current = Number(allocations[batchId] || 0);
    const needed = Math.max(0, requiredQty - (totalAllocated - current));
    const allocVal = Math.min(maxAvail, needed > 0 ? needed : maxAvail);
    handleQtyChange(batchId, allocVal, maxAvail);
  };

  // Confirm and apply allocations
  const handleConfirm = () => {
    const result = [];
    Object.entries(allocations).forEach(([bId, qty]) => {
      const numQty = Number(qty);
      if (numQty > 0) {
        const batchObj = availableBatches.find(b => b.id === bId);
        result.push({
          batchId: bId,
          id: bId,
          batchNo: batchObj?.batchNo || batchObj?.referenceNo || 'BATCH',
          allocatedQty: numQty,
          quantity: numQty,
          supplierName: batchObj?.supplierName || '',
          grnNumber: batchObj?.grnNumber || '',
          expiryDate: batchObj?.expiryDate || null,
          uom: uom
        });
      }
    });

    if (onApplyAllocations) {
      onApplyAllocations(result, totalAllocated);
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 animate-in fade-in duration-150">
      <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
        
        {/* Modal Header */}
        <div className="px-4 py-3 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2">
            <span className="p-1 rounded bg-amber-500/20 text-amber-400">
              <Tag className="w-4 h-4" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-amber-400 text-xs">{rawMaterialCode}</span>
                <span className="font-bold text-sm text-white">{rawMaterialName}</span>
              </div>
              <p className="text-[10.5px] text-slate-400">
                Allocate inventory batch lots (FEFO) for raw material resale & dispatch
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status & Allocation Metrics Bar */}
        <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-850 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-4 font-mono">
            <div>
              <span className="text-slate-500 dark:text-slate-400 text-[11px] block">Required Qty:</span>
              <span className="font-black text-slate-900 dark:text-white text-sm">{requiredQty} {uom}</span>
            </div>
            <div className="border-l border-slate-300 dark:border-slate-700 pl-4">
              <span className="text-slate-500 dark:text-slate-400 text-[11px] block">Allocated:</span>
              <span className="font-black text-indigo-600 dark:text-indigo-400 text-sm">{totalAllocated.toFixed(2)} {uom}</span>
            </div>
            <div className="border-l border-slate-300 dark:border-slate-700 pl-4">
              <span className="text-slate-500 dark:text-slate-400 text-[11px] block">Balance Needed:</span>
              <span className={`font-black text-sm ${isFulfilled ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                {balanceNeeded.toFixed(2)} {uom}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!readOnly && (
              <>
                <button
                  type="button"
                  onClick={handleAutoFEFO}
                  className="px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded shadow-xs flex items-center gap-1 cursor-pointer transition-colors"
                  title="Automatically allocate starting from earliest expiry batch"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Auto FEFO</span>
                </button>
                <button
                  type="button"
                  onClick={handleClear}
                  className="px-2 py-1 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-xs rounded font-medium cursor-pointer"
                  title="Clear allocated quantities"
                >
                  <RotateCcw className="w-3 h-3" />
                </button>
              </>
            )}
            {isFulfilled ? (
              <span className="px-2 py-1 bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 rounded font-bold text-[11px] border border-emerald-300 dark:border-emerald-800 flex items-center gap-1">
                <Check className="w-3 h-3" />
                <span>100% Allocated</span>
              </span>
            ) : (
              <span className="px-2 py-1 bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 rounded font-bold text-[11px] border border-amber-300 dark:border-amber-800 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                <span>Pending {(balanceNeeded).toFixed(1)} {uom}</span>
              </span>
            )}
          </div>
        </div>

        {/* Search Bar */}
        <div className="p-3 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <Input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search batch number, GRN reference, or supplier..."
              className="pl-9 h-8 text-xs font-medium rounded-lg"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 text-xs font-bold"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Batches List Body */}
        <div className="p-3 space-y-2.5 overflow-y-auto flex-1">
          {loading ? (
            <div className="py-12 text-center text-xs font-bold text-slate-400 space-y-2">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto text-amber-500" />
              <p>Loading inventory batches & FEFO expiry dates...</p>
            </div>
          ) : filteredBatches.length === 0 ? (
            <div className="py-10 text-center text-xs border border-dashed border-slate-200 dark:border-slate-800 rounded-xl space-y-2 text-slate-400 bg-slate-50/50 dark:bg-slate-950/20">
              <AlertTriangle className="w-6 h-6 text-amber-500 mx-auto" />
              <p className="font-bold text-slate-700 dark:text-slate-300">
                {availableBatches.length === 0 ? 'No active inventory batches found for this material.' : 'No batches match your search filter.'}
              </p>
              <p className="text-[11px] text-slate-400">
                Material will be fulfilled from general warehouse stock if saved without specific lot allocation.
              </p>
            </div>
          ) : (
            filteredBatches.map((batch, idx) => {
              const avail = Number(batch.remainingQty || batch.netQty || 0);
              const currentAlloc = Number(allocations[batch.id] || 0);
              const isExpired = batch.isExpired || (batch.expiryDate && new Date(batch.expiryDate) < new Date());
              const expDateStr = batch.expiryDate ? new Date(batch.expiryDate).toLocaleDateString('en-IN') : 'N/A';
              const mfgDateStr = batch.mfgDate ? new Date(batch.mfgDate).toLocaleDateString('en-IN') : null;

              return (
                <div
                  key={batch.id}
                  className={`p-3 rounded-lg border transition-all ${
                    currentAlloc > 0
                      ? 'border-indigo-400 dark:border-indigo-600 bg-indigo-50/40 dark:bg-indigo-950/30 ring-1 ring-indigo-400/30'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-black text-xs px-2 py-0.5 rounded bg-indigo-100 dark:bg-indigo-950 text-indigo-800 dark:text-indigo-200 border border-indigo-200 dark:border-indigo-800 flex items-center gap-1">
                        <Tag className="w-3 h-3 text-indigo-600" />
                        {batch.batchNo}
                      </span>
                      {idx === 0 && !isExpired && (
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300">
                          🥇 FEFO Earliest
                        </span>
                      )}
                      {isExpired && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border border-rose-300">
                          ⛔ Expired
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 text-[11px] font-mono">
                      <span className="text-slate-500">GRN: <strong className="text-slate-800 dark:text-slate-200">{batch.grnNumber || 'N/A'}</strong></span>
                      <span className="text-slate-300 dark:text-slate-700">•</span>
                      <span className="text-slate-500">Supplier: <strong className="text-slate-800 dark:text-slate-200 truncate max-w-[120px] inline-block align-bottom">{batch.supplierName || 'Standard'}</strong></span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3 text-xs pt-1 border-t border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-3 text-[11px] font-mono text-slate-500">
                      <span>Available: <strong className="text-emerald-700 dark:text-emerald-400 font-bold">{avail} {uom}</strong></span>
                      <span>•</span>
                      <span>Exp: <strong className={isExpired ? 'text-rose-600 font-bold' : 'text-slate-700 dark:text-slate-300'}>{expDateStr}</strong></span>
                      {batch.daysRemaining !== null && batch.daysRemaining !== undefined && !isExpired && (
                        <span className="text-[10px] text-slate-400">({batch.daysRemaining} days left)</span>
                      )}
                    </div>

                    {/* Allocation Input & Steppers */}
                    <div className="flex items-center gap-1.5">
                      {!readOnly && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleQtyChange(batch.id, Math.max(0, currentAlloc - 1), avail)}
                            disabled={currentAlloc <= 0}
                            className="w-6 h-6 flex items-center justify-center rounded bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 disabled:opacity-40 cursor-pointer text-xs"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <Input
                            type="number"
                            min="0"
                            max={avail}
                            step="0.01"
                            value={currentAlloc > 0 ? currentAlloc : ''}
                            onChange={(e) => handleQtyChange(batch.id, e.target.value, avail)}
                            placeholder="0"
                            className="w-20 h-7 text-xs font-mono font-bold text-center rounded"
                          />
                          <button
                            type="button"
                            onClick={() => handleQtyChange(batch.id, Math.min(avail, currentAlloc + 1), avail)}
                            disabled={currentAlloc >= avail}
                            className="w-6 h-6 flex items-center justify-center rounded bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 disabled:opacity-40 cursor-pointer text-xs"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMaxBatch(batch.id, avail)}
                            className="px-2 h-7 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 text-[10px] font-bold rounded cursor-pointer transition-colors"
                          >
                            Max
                          </button>
                        </>
                      )}
                      {readOnly && (
                        <span className="font-mono font-bold text-xs text-indigo-600 dark:text-indigo-400">
                          {currentAlloc} {uom}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3 bg-slate-100 dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 flex justify-between items-center text-xs">
          <div className="text-[11px] text-slate-600 dark:text-slate-300 font-medium">
            Total Allocated: <strong className="text-indigo-600 dark:text-indigo-400 font-mono font-black">{totalAllocated.toFixed(2)} {uom}</strong>
            {totalAllocated !== requiredQty && (
              <span className="text-slate-400 ml-1">({totalAllocated > requiredQty ? 'Exceeds required' : 'Partial'})</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              className="h-8 text-xs"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleConfirm}
              className="h-8 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center gap-1 shadow-xs cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Apply Allocation</span>
            </Button>
          </div>
        </div>

      </div>
    </div>
  );
}
