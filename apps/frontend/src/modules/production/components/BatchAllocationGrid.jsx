import React, { useState } from 'react';
import { api } from '@/lib/axios';
import { 
  Tag, Boxes, RefreshCw, Plus, Minus, Trash2, Check, AlertTriangle, 
  HelpCircle, Calendar, ShieldCheck, Database, X, ArrowRight, Layers, ArrowLeftRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Swal from 'sweetalert2';

export default function BatchAllocationGrid({
  rawMaterials = [],
  onUpdateRawMaterials,
  onRefreshPrices,
  refreshingPrices = false,
  disabled = false
}) {
  // Modal state for lot selection
  const [activeItemIndex, setActiveItemIndex] = useState(null);
  const [lotModalOpen, setLotModalOpen] = useState(false);
  const [loadingLots, setLoadingLots] = useState(false);
  const [availableLots, setAvailableLots] = useState([]);
  const [lotAllocations, setLotAllocations] = useState({}); // { [lotId]: allocatedQty }

  // Open Lot Allocation Modal for an item
  const openLotModal = async (index) => {
    const item = rawMaterials[index];
    if (!item) return;

    setActiveItemIndex(index);
    setLotModalOpen(true);
    setLoadingLots(true);

    // Initialize allocations from existing item.allocatedBatches
    const currentAllocMap = {};
    if (Array.isArray(item.allocatedBatches)) {
      item.allocatedBatches.forEach(b => {
        currentAllocMap[b.batchId] = Number(b.allocatedQty || 0);
      });
    }
    setLotAllocations(currentAllocMap);

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

  // Set lot allocation quantity in modal
  const handleSetLotQty = (lotId, value, maxAvail) => {
    let num = Number(value);
    if (isNaN(num) || num < 0) num = 0;
    if (num > maxAvail) num = maxAvail;

    setLotAllocations(prev => ({
      ...prev,
      [lotId]: num
    }));
  };

  // Save allocations from modal back to line item with proportional PO math
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

        // Fetch exact PO rate and proportional amount
        let unitRate = Number(item.unitRate || 0);
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
          // Fallback to lot rates
        }

        // Exact proportional division: (allocated / original) * total
        const propFactor = poOrigQty > 0 ? (qty / poOrigQty) : 1;
        const allocatedAmount = Number((poTotAmt * propFactor).toFixed(2));
        weightedAmountSum += allocatedAmount;

        allocatedBatches.push({
          batchId: lot.id,
          lotNumber: lot.internalBatchNo,
          supplierBatchNo: lot.supplierBatchNo || null,
          expiryDate: lot.expiryDate || null,
          allocatedQty: qty,
          poOriginalQty: poOrigQty,
          poTotalAmount: poTotAmt,
          allocatedAmount,
          unitRate,
          uom: item.selectedUom
        });
      }
    }

    const updated = [...rawMaterials];
    const row = { ...updated[activeItemIndex] };
    row.allocatedBatches = allocatedBatches;

    // If lots were allocated, calculate the effective blended rate
    if (totalAllocated > 0 && weightedAmountSum > 0) {
      row.unitRate = Number((weightedAmountSum / totalAllocated).toFixed(4));
      row.totalCost = Number(weightedAmountSum.toFixed(2));
    } else {
      row.totalCost = Number((Number(row.requiredQty || 0) * Number(row.unitRate || 0)).toFixed(2));
    }

    updated[activeItemIndex] = row;
    onUpdateRawMaterials(updated);
    setLotModalOpen(false);
  };

  // Helper: Convert between Base UOM and Alternate UOM
  // Formula: baseQty * (alternateUomQty / baseUomQty) = altQty
  const calculateAltQty = (baseQty, row) => {
    const factor = Number(row.conversionFactor || 1);
    const baseRatio = Number(row.baseUomQty || 1);
    const altRatio = Number(row.alternateUomQty || (factor > 0 ? factor : 1));
    if (baseRatio <= 0) return baseQty;
    return Number((Number(baseQty || 0) * (altRatio / baseRatio)).toFixed(3));
  };

  const calculateBaseQtyFromAlt = (altQty, row) => {
    const factor = Number(row.conversionFactor || 1);
    const baseRatio = Number(row.baseUomQty || 1);
    const altRatio = Number(row.alternateUomQty || (factor > 0 ? factor : 1));
    if (altRatio <= 0) return altQty;
    return Number((Number(altQty || 0) * (baseRatio / altRatio)).toFixed(4));
  };

  // Toggle active entry UOM between Base UOM and Alternate UOM
  const handleToggleUom = (index) => {
    const updated = [...rawMaterials];
    const row = { ...updated[index] };
    if (!row.hasAlternateUom || !row.alternateUom) return;

    const currentMode = row.activeEntryMode || 'BASE';
    row.activeEntryMode = currentMode === 'BASE' ? 'ALT' : 'BASE';
    updated[index] = row;
    onUpdateRawMaterials(updated);
  };

  // Handle quantity change (supports typing in either Base or Alternate UOM)
  const handleQtyChange = (index, value, mode = 'BASE') => {
    const updated = [...rawMaterials];
    const row = { ...updated[index] };
    const num = Number(value || 0);

    let baseQty = num;
    if (mode === 'ALT') {
      baseQty = calculateBaseQtyFromAlt(num, row);
    }

    row.requiredQty = baseQty;
    row.totalCost = Number((baseQty * Number(row.unitRate || 0)).toFixed(2));
    updated[index] = row;
    onUpdateRawMaterials(updated);
  };

  // Handle manual rate override
  const handleRateChange = (index, value) => {
    const updated = [...rawMaterials];
    const row = { ...updated[index] };
    const r = Number(value || 0);
    row.unitRate = r;
    row.rateSource = 'MANUAL_OVERRIDE';
    row.totalCost = Number((Number(row.requiredQty || 0) * r).toFixed(2));
    updated[index] = row;
    onUpdateRawMaterials(updated);
  };

  // Delete line
  const handleDeleteRow = (index) => {
    if (rawMaterials.length <= 1) {
      Swal.fire({ title: 'Notice', text: 'Batch requires at least one raw material line.', icon: 'info' });
      return;
    }
    const updated = rawMaterials.filter((_, i) => i !== index);
    onUpdateRawMaterials(updated);
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl p-4 sm:p-5 shadow-xs space-y-4">
      
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Tag className="w-4 h-4 text-indigo-500" />
          <div>
            <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-900 dark:text-white">
              Step D & E: Raw Material Allocation, Alternate UOM & Live PO Costing
            </h2>
            <p className="text-[11px] text-slate-400">
              Formulation scaled automatically with live FEFO lot allocations & alternate unit conversions.
            </p>
          </div>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || refreshingPrices}
          onClick={onRefreshPrices}
          className="rounded-xl border-slate-200 dark:border-slate-800 h-8 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${refreshingPrices ? 'animate-spin' : ''}`} />
          Refresh Live PO Rates
        </Button>
      </div>

      {/* Grid Table */}
      <div className="overflow-x-auto rounded-2xl border border-slate-100 dark:border-slate-800">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-slate-50/75 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              <th className="py-3 px-3 w-10 text-center">#</th>
              <th className="py-3 px-3 min-w-[200px]">Key Raw Material / Cost Head</th>
              <th className="py-3 px-3 w-44 text-center">Required Quantity</th>
              <th className="py-3 px-3 w-28 text-center">UOM & Alternate</th>
              <th className="py-3 px-3 min-w-[220px]">Stock Batch / Lot Allocation</th>
              <th className="py-3 px-3 w-28 text-right">PO Rate (₹)</th>
              <th className="py-3 px-3 w-32 text-right">Line Total (₹)</th>
              <th className="py-3 px-3 w-12 text-center">Del</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {rawMaterials.map((row, index) => {
              const allocatedList = Array.isArray(row.allocatedBatches) ? row.allocatedBatches : [];
              const totalAllocated = allocatedList.reduce((s, b) => s + Number(b.allocatedQty || 0), 0);
              const isFulfilled = totalAllocated >= Number(row.requiredQty || 0) && totalAllocated > 0;

              const hasAlt = Boolean(row.hasAlternateUom && row.alternateUom);
              const isAltMode = row.activeEntryMode === 'ALT';
              const altQtyValue = calculateAltQty(row.requiredQty, row);

              return (
                <tr key={row.rmId || index} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                  
                  {/* Sequence */}
                  <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-400">
                    {index + 1}
                  </td>

                  {/* Material Name */}
                  <td className="py-2.5 px-3">
                    <span className="font-extrabold text-slate-900 dark:text-white block">
                      {row.rmName}
                    </span>
                    <span className="text-[9px] font-mono text-slate-400 block">
                      {row.rateSource === 'PO_LATEST' ? 'Live PO Rate' : row.rateSource === 'MANUAL_OVERRIDE' ? 'Manual Override' : row.rateSource}
                    </span>
                  </td>

                  {/* Required Quantity (Supports editing in Base or Alternate UOM) */}
                  <td className="py-2.5 px-3 text-center">
                    <div className="space-y-1">
                      {isAltMode ? (
                        <div className="relative">
                          <Input
                            type="number"
                            step="any"
                            min="0"
                            disabled={disabled}
                            value={altQtyValue}
                            onChange={(e) => handleQtyChange(index, e.target.value, 'ALT')}
                            className="h-8 text-center font-mono font-bold text-xs rounded-lg border-indigo-300 dark:border-indigo-800 bg-indigo-50/30 dark:bg-indigo-950/20 text-indigo-700 dark:text-indigo-300"
                          />
                          <span className="text-[9px] font-mono text-slate-400 block pt-0.5">
                            ≈ {Number(row.requiredQty).toFixed(2)} {row.selectedUom} (Base)
                          </span>
                        </div>
                      ) : (
                        <div className="relative">
                          <Input
                            type="number"
                            step="any"
                            min="0"
                            disabled={disabled}
                            value={row.requiredQty}
                            onChange={(e) => handleQtyChange(index, e.target.value, 'BASE')}
                            className="h-8 text-center font-mono font-bold text-xs rounded-lg text-slate-900 dark:text-white"
                          />
                          {hasAlt && (
                            <span className="text-[9px] font-mono text-indigo-600 dark:text-indigo-400 block pt-0.5">
                              ≈ {altQtyValue} {row.alternateUom} (Alt)
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </td>

                  {/* UOM & Alternate UOM Switcher */}
                  <td className="py-2.5 px-3 text-center">
                    {hasAlt ? (
                      <div className="flex flex-col items-center gap-1">
                        <button
                          type="button"
                          disabled={disabled}
                          onClick={() => handleToggleUom(index)}
                          className={`px-2 py-0.5 rounded-lg border text-[10px] font-mono font-bold transition-all cursor-pointer flex items-center gap-1 ${
                            isAltMode
                              ? 'bg-indigo-100 dark:bg-indigo-950 border-indigo-300 text-indigo-700 dark:text-indigo-300'
                              : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                          }`}
                          title={`Click to switch entry between ${row.selectedUom} and ${row.alternateUom}`}
                        >
                          <ArrowLeftRight className="w-2.5 h-2.5 text-indigo-500" />
                          <span>{isAltMode ? row.alternateUom : row.selectedUom}</span>
                        </button>
                        
                        <span className="text-[9px] font-mono text-slate-400">
                          Alt: {row.alternateUom}
                        </span>
                      </div>
                    ) : (
                      <span className="font-mono font-bold text-slate-600 dark:text-slate-300">
                        {row.selectedUom}
                      </span>
                    )}
                  </td>

                  {/* Batch Allocation */}
                  <td className="py-2.5 px-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      {allocatedList.length > 0 ? (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {allocatedList.map((b, bIdx) => (
                            <span 
                              key={b.batchId || bIdx}
                              className="inline-flex items-center gap-1 font-mono text-[10px] font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/80 px-2 py-0.5 rounded-lg border border-indigo-200 dark:border-indigo-800"
                            >
                              <span>{b.lotNumber}</span>
                              <span className="text-[9px] text-indigo-900 dark:text-indigo-200">
                                ({b.allocatedQty} {row.selectedUom})
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
                          className="h-7 px-2 text-[10px] font-bold rounded-lg border-indigo-200 dark:border-indigo-800 text-indigo-600 hover:bg-indigo-50 cursor-pointer shrink-0 ml-auto"
                        >
                          <Boxes className="w-3 h-3 mr-1" />
                          Allocate Lots
                        </Button>
                      )}
                    </div>
                  </td>

                  {/* Rate */}
                  <td className="py-2.5 px-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Input
                        type="number"
                        step="any"
                        min="0"
                        disabled={disabled}
                        value={row.unitRate}
                        onChange={(e) => handleRateChange(index, e.target.value)}
                        className="h-8 text-right font-mono font-bold text-xs rounded-lg w-24 text-indigo-700 dark:text-indigo-400"
                      />
                    </div>
                  </td>

                  {/* Total */}
                  <td className="py-2.5 px-3 text-right font-mono font-black text-slate-900 dark:text-white">
                    ₹{Number(row.totalCost || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>

                  {/* Delete */}
                  <td className="py-2.5 px-3 text-center">
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => handleDeleteRow(index)}
                      className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
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

      {/* ── BATCH ALLOCATION LOT MODAL ── */}
      {lotModalOpen && activeItemIndex !== null && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-2xl w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <Boxes className="w-4 h-4 text-indigo-500" />
                  Allocate Stock Lots for: {rawMaterials[activeItemIndex]?.rmName}
                </h3>
                <p className="text-[11px] text-slate-400">
                  Select available warehouse lots (FEFO / FIFO). Proportional PO amounts and rates are computed live.
                </p>
              </div>
              <button 
                onClick={() => setLotModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
              {loadingLots ? (
                <div className="p-8 text-center text-xs font-bold text-slate-400">
                  <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-indigo-500" />
                  Checking active inventory batches in warehouse...
                </div>
              ) : availableLots.length === 0 ? (
                <div className="p-6 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 text-center space-y-2">
                  <AlertTriangle className="w-6 h-6 text-amber-500 mx-auto" />
                  <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    No active inventory lots found for this raw material.
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Material will be drawn from general warehouse stock using standard PO rate.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="text-[11px] font-bold text-slate-500 flex items-center justify-between">
                    <span>Available Lots (Sorted by FEFO Expiry):</span>
                    <span>Required: {rawMaterials[activeItemIndex]?.requiredQty} {rawMaterials[activeItemIndex]?.selectedUom}</span>
                  </div>

                  <div className="space-y-2">
                    {availableLots.map((lot) => {
                      const avail = Number(lot.availableQty || lot.netQty || 0);
                      const currentAlloc = lotAllocations[lot.id] || '';

                      return (
                        <div 
                          key={lot.id}
                          className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-850 flex items-center justify-between gap-3"
                        >
                          <div className="space-y-1 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-black text-xs text-indigo-600 dark:text-indigo-400">
                                {lot.internalBatchNo}
                              </span>
                              {lot.supplierBatchNo && (
                                <span className="font-mono text-[9px] text-slate-400">
                                  (Supp: {lot.supplierBatchNo})
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-3 text-[10px] text-slate-500 font-mono flex-wrap">
                              <span>Available: <strong>{avail} {rawMaterials[activeItemIndex]?.selectedUom}</strong></span>
                              <span>•</span>
                              <span>PO: <strong>{lot.poReferenceNo || 'PO-GRN'}</strong></span>
                              <span>•</span>
                              <span>Expiry: <strong>{lot.expiryDate ? new Date(lot.expiryDate).toLocaleDateString() : 'N/A'}</strong></span>
                            </div>
                          </div>

                          <div className="w-28">
                            <label className="text-[9px] font-bold text-slate-400 block">Allocate Qty</label>
                            <Input
                              type="number"
                              min="0"
                              max={avail}
                              step="any"
                              value={currentAlloc}
                              onChange={(e) => handleSetLotQty(lot.id, e.target.value, avail)}
                              placeholder={`0 / ${avail}`}
                              className="h-8 text-center font-mono font-bold text-xs rounded-xl"
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 flex items-center justify-between">
              <span className="text-xs font-mono font-bold text-slate-600 dark:text-slate-300">
                Total Allocated: {Object.values(lotAllocations).reduce((s, v) => s + Number(v || 0), 0)} {rawMaterials[activeItemIndex]?.selectedUom}
              </span>

              <div className="flex items-center gap-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setLotModalOpen(false)}
                  className="rounded-xl"
                >
                  Cancel
                </Button>
                <Button 
                  type="button" 
                  size="sm" 
                  onClick={handleSaveAllocations}
                  className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
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
