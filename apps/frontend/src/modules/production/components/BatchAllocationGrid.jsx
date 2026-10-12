import React, { useState } from 'react';
import { api } from '@/lib/axios';
import { 
  Tag, Boxes, RefreshCw, Plus, Minus, Trash2, Check, AlertTriangle, 
  HelpCircle, Calendar, ShieldCheck, Database, X, ArrowRight, Layers
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
          // Fallback
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

  // Handle manual required quantity change
  const handleQtyChange = (index, value) => {
    const updated = [...rawMaterials];
    const row = { ...updated[index] };
    const qty = Number(value || 0);
    row.requiredQty = qty;
    row.totalCost = Number((qty * Number(row.unitRate || 0)).toFixed(2));
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
    <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl p-5 shadow-xs space-y-4">
      
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Tag className="w-4 h-4 text-indigo-500" />
          <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-900 dark:text-white">
            Step D & E: Raw Material Allocation & Live PO Costing
          </h2>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || refreshingPrices}
          onClick={onRefreshPrices}
          className="rounded-xl border-slate-200 dark:border-slate-800 h-8 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${refreshingPrices ? 'animate-spin' : ''}`} />
          Refresh Live PO Rates
        </Button>
      </div>

      {/* Grid */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-slate-50/75 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              <th className="py-2.5 px-3 w-12 text-center">#</th>
              <th className="py-2.5 px-3 min-w-[200px]">Key Raw Material / Cost Head</th>
              <th className="py-2.5 px-3 w-28 text-center">Required Qty</th>
              <th className="py-2.5 px-3 w-20 text-center">UOM</th>
              <th className="py-2.5 px-3 min-w-[220px]">Stock Batch / Lot Allocation</th>
              <th className="py-2.5 px-3 w-32 text-right">PO Rate (₹)</th>
              <th className="py-2.5 px-3 w-32 text-right">Line Total (₹)</th>
              <th className="py-2.5 px-3 w-16 text-center">Del</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {rawMaterials.map((row, index) => {
              const allocatedList = Array.isArray(row.allocatedBatches) ? row.allocatedBatches : [];
              const totalAllocated = allocatedList.reduce((s, b) => s + Number(b.allocatedQty || 0), 0);
              const isFulfilled = totalAllocated >= Number(row.requiredQty || 0) && totalAllocated > 0;

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

                  {/* Required Quantity */}
                  <td className="py-2.5 px-3 text-center">
                    <Input
                      type="number"
                      step="any"
                      min="0"
                      disabled={disabled}
                      value={row.requiredQty}
                      onChange={(e) => handleQtyChange(index, e.target.value)}
                      className="h-8 text-center font-mono font-bold text-xs rounded-lg"
                    />
                  </td>

                  {/* UOM */}
                  <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-600 dark:text-slate-300">
                    {row.selectedUom}
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
                <div className="py-8 text-center text-slate-400">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-500" />
                  Loading available lots from warehouse...
                </div>
              ) : availableLots.length === 0 ? (
                <div className="p-6 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl text-xs text-slate-400">
                  No specific warehouse lots found for this item. General warehouse stock will be consumed.
                </div>
              ) : (
                <div className="space-y-3">
                  {availableLots.map((lot, lIdx) => {
                    const avail = Number(lot.netQty || lot.availableQty || 0);
                    const alloc = Number(lotAllocations[lot.id] || 0);
                    const isEarliest = lIdx === 0;

                    return (
                      <div 
                        key={lot.id}
                        className={`p-3.5 rounded-2xl border transition-all ${
                          alloc > 0 
                            ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/40 ring-1 ring-indigo-400' 
                            : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-black text-xs text-slate-900 dark:text-white">
                                {lot.internalBatchNo}
                              </span>
                              {isEarliest && (
                                <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                                  🥇 Earliest Expiry (FEFO)
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono">
                              <span>In Stock: <strong className="text-slate-800 dark:text-slate-200">{avail} {rawMaterials[activeItemIndex]?.selectedUom}</strong></span>
                              <span>•</span>
                              <span>Exp: {lot.expiryDate ? new Date(lot.expiryDate).toLocaleDateString('en-GB') : 'No Expiry'}</span>
                              {lot.supplierBatchNo && (
                                <>
                                  <span>•</span>
                                  <span>Sup Batch: {lot.supplierBatchNo}</span>
                                </>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <div className="inline-flex items-center border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 p-0.5 shadow-2xs">
                              <button
                                type="button"
                                onClick={() => handleSetLotQty(lot.id, Math.max(0, alloc - 1), avail)}
                                disabled={alloc <= 0}
                                className="w-6 h-6 flex items-center justify-center rounded-lg bg-slate-50 text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 disabled:opacity-30 cursor-pointer"
                              >
                                <Minus className="w-3 h-3" />
                              </button>
                              <input
                                type="number"
                                step="any"
                                min="0"
                                max={avail}
                                value={alloc || ''}
                                onChange={(e) => handleSetLotQty(lot.id, e.target.value, avail)}
                                placeholder="0"
                                className="w-14 h-6 p-0 text-center font-bold text-xs bg-transparent border-0 focus-visible:ring-0 font-mono text-indigo-700 dark:text-indigo-300"
                              />
                              <button
                                type="button"
                                onClick={() => handleSetLotQty(lot.id, Math.min(avail, alloc + 1), avail)}
                                disabled={alloc >= avail}
                                className="w-6 h-6 flex items-center justify-center rounded-lg bg-slate-50 text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 disabled:opacity-30 cursor-pointer"
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                            </div>

                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => handleSetLotQty(lot.id, avail, avail)}
                              className="h-7 px-2 text-[10px] font-bold rounded-lg border-indigo-200 text-indigo-600"
                            >
                              Max
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="px-6 py-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <span className="text-xs font-bold text-indigo-600">
                Required: {rawMaterials[activeItemIndex]?.requiredQty} {rawMaterials[activeItemIndex]?.selectedUom}
              </span>

              <div className="flex items-center gap-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setLotModalOpen(false)}
                  className="rounded-xl"
                >
                  Cancel
                </Button>
                <Button 
                  type="button"
                  onClick={handleSaveAllocations}
                  className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
                >
                  Confirm Allocations
                </Button>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
