import React, { useState, useEffect } from 'react';
import { 
  AlertTriangle, X, RotateCcw, Trash2, CheckCircle2, 
  Layers, Scale, Tag, Calendar, AlertCircle, Sparkles
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/axios';
import Swal from 'sweetalert2';

const COMMON_CANCELLATION_REASONS = [
  'Equipment Breakdown / Machine Failure',
  'Formulation / Recipe Mismatch',
  'Batch Contamination / Foreign Material',
  'Temperature / Cooling Abnormality',
  'Power Outage / Utility Interruption',
  'Operator / Processing Error',
  'Quality Test (In-Process) Failed',
  'Customer Order Cancelled / Rescheduled',
  'Other / Custom Reason'
];

export default function ProductionCancelModal({
  isOpen,
  onClose,
  batch,
  onCancelled
}) {
  const [cancelMode, setCancelMode] = useState('WASTE'); // 'WASTE' (Production Failed) or 'NO_WASTE' (Cancel & Release)
  const [reasonCategory, setReasonCategory] = useState(COMMON_CANCELLATION_REASONS[0]);
  const [customReason, setCustomReason] = useState('');
  const [materials, setMaterials] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (batch && isOpen) {
      setReasonCategory(COMMON_CANCELLATION_REASONS[0]);
      setCustomReason('');
      setCancelMode('WASTE');

      // Extract raw materials from batch.rmUsages and batch allocations
      const items = [];
      const batchAllocations = Array.isArray(batch.allocations) ? batch.allocations : [];

      (batch.rmUsages || []).forEach((u, uIdx) => {
        const rm = u.rawMaterial || {};

        // 1. Resolve true Canonical Base UOM (from RM master / unit)
        let baseUom = u.baseUom || rm.unit?.abbreviation || rm.unitId || 'Kg';
        if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(baseUom)) {
          baseUom = rm.unit?.name || 'Kg';
        }
        if (baseUom.toLowerCase() === 'kilogram' || baseUom.toLowerCase() === 'kilograms') baseUom = 'kg';
        if (baseUom.toLowerCase() === 'liters' || baseUom.toLowerCase() === 'litres') baseUom = 'liter';

        // 2. Resolve Alternate UOM (must not match baseUom)
        const altUomCandidate = u.alternateUom || rm.alternateUom || (rm.consumptionUnit && rm.consumptionUnit.toLowerCase() !== baseUom.toLowerCase() ? rm.consumptionUnit : null);
        const hasAlt = Boolean(
          (u.hasAlternateUom || rm.hasAlternateUom) && 
          altUomCandidate && 
          altUomCandidate.toLowerCase() !== baseUom.toLowerCase()
        );
        const altUom = hasAlt ? altUomCandidate : null;

        // 3. Conversion factor
        const convFactor = hasAlt ? Number(
          u.conversionFactor ||
          u.conversionFactorUsed ||
          rm.conversionFactor ||
          (rm.alternateUomQty && rm.baseUomQty && Number(rm.baseUomQty) > 0
            ? Number(rm.alternateUomQty) / Number(rm.baseUomQty)
            : 1000)
        ) : 1;

        // 4. Rate per Canonical Base UOM
        const unitCost = Number(u.unitCost || rm.ratePerUnit || 0);

        // Find allocations linked to this usage
        const usageAllocs = (Array.isArray(u.allocations) && u.allocations.length > 0)
          ? u.allocations
          : batchAllocations.filter(a => a.usage_id === u.id || a.usageId === u.id);

        const processItem = (allocQty, lotNo, lotBatchId, lineRate, keySuffix) => {
          const rawQty = allocQty > 0 ? allocQty : Number(u.actualUsedQty || u.requiredQty || 0);
          
          // Determine if rawQty is recorded in Alternate UOM:
          const isRecordedInAlt = Boolean(
            hasAlt && altUom && (
              (u.selectedUom && u.selectedUom.toLowerCase() === altUom.toLowerCase()) ||
              (u.selectedUom && !u.selectedUom.toLowerCase().includes(baseUom.toLowerCase()))
            )
          );

          let canonicalPlanned = rawQty;
          let initialInputValue = rawQty;
          let selectedMode = 'base';

          if (isRecordedInAlt && convFactor > 0) {
            canonicalPlanned = Number((rawQty / convFactor).toFixed(6));
            initialInputValue = rawQty;
            selectedMode = 'alt';
          } else {
            canonicalPlanned = rawQty;
            initialInputValue = rawQty;
            selectedMode = 'base';
          }

          items.push({
            key: `${u.id || uIdx}-${keySuffix}`,
            usageId: u.id,
            rmId: u.rmId,
            name: rm.name || 'Raw Material',
            code: rm.code || 'RM',
            lotNumber: lotNo,
            batchId: lotBatchId,
            plannedDisplayQty: rawQty,
            plannedDisplayUom: isRecordedInAlt ? altUom : baseUom,
            canonicalPlannedQty: canonicalPlanned,
            unitCost: lineRate,
            baseUom,
            hasAlt,
            altUom,
            convFactor: convFactor > 0 ? convFactor : 1000,
            selectedUnitMode: selectedMode,
            inputValue: initialInputValue,
            effectiveWastedQty: canonicalPlanned
          });
        };

        if (usageAllocs.length > 0) {
          usageAllocs.forEach((a, aIdx) => {
            const allocQty = Number(a.allocated_qty || a.allocatedQty || 0);
            const lotNo = a.lot_number || a.lotNumber || 'Allocated Stock Lot';
            const lotBatchId = a.inventory_batch_id || a.inventoryBatchId || null;
            const lineRate = Number(a.unit_rate || a.unitRate || unitCost);
            processItem(allocQty, lotNo, lotBatchId, lineRate, `alloc-${a.id || aIdx}`);
          });
        } else {
          const plannedQty = Number(u.actualUsedQty || u.requiredQty || 0);
          const fallbackLot = u.internalBatchNo || 'Warehouse Stock Lot';
          processItem(plannedQty, fallbackLot, u.allocatedBatchId || null, unitCost, 'main');
        }
      });

      setMaterials(items);
    }
  }, [batch, isOpen]);

  if (!isOpen || !batch) return null;

  const handleQtyChange = (index, val) => {
    const updated = [...materials];
    const m = updated[index];
    const num = Math.max(0, parseFloat(val) || 0);
    m.inputValue = val;

    if (m.selectedUnitMode === 'alt') {
      m.effectiveWastedQty = m.convFactor > 0 ? Number((num / m.convFactor).toFixed(6)) : num;
    } else {
      m.effectiveWastedQty = num;
    }

    setMaterials(updated);
  };

  const handleUnitModeToggle = (index, mode) => {
    const updated = [...materials];
    const m = updated[index];
    if (m.selectedUnitMode === mode) return;

    if (mode === 'alt') {
      const altVal = Number((m.effectiveWastedQty * m.convFactor).toFixed(3));
      m.inputValue = altVal;
      m.selectedUnitMode = 'alt';
    } else {
      m.inputValue = Number(m.effectiveWastedQty.toFixed(4));
      m.selectedUnitMode = 'base';
    }

    setMaterials(updated);
  };

  const handleQuickFill = (index, percent) => {
    const updated = [...materials];
    const m = updated[index];
    const targetBase = Number((m.canonicalPlannedQty * (percent / 100)).toFixed(6));
    m.effectiveWastedQty = targetBase;

    if (m.selectedUnitMode === 'alt') {
      m.inputValue = Number((targetBase * m.convFactor).toFixed(3));
    } else {
      m.inputValue = targetBase;
    }

    setMaterials(updated);
  };

  const handleSetAllWasted = () => {
    const updated = materials.map(m => {
      const targetBase = m.canonicalPlannedQty;
      return {
        ...m,
        effectiveWastedQty: targetBase,
        inputValue: m.selectedUnitMode === 'alt' ? Number((targetBase * m.convFactor).toFixed(3)) : targetBase
      };
    });
    setMaterials(updated);
  };

  const handleSetAllZero = () => {
    const updated = materials.map(m => ({
      ...m,
      effectiveWastedQty: 0,
      inputValue: 0
    }));
    setMaterials(updated);
  };

  // Calculations
  const totalFinancialLoss = materials.reduce((acc, m) => {
    return acc + (Number(m.effectiveWastedQty || 0) * Number(m.unitCost || 0));
  }, 0);

  const totalWastedItemsCount = materials.filter(m => Number(m.effectiveWastedQty) > 0).length;

  const handleSubmit = async () => {
    const finalReason = reasonCategory === 'Other / Custom Reason'
      ? (customReason.trim() || 'Production Cancelled')
      : (customReason.trim() ? `${reasonCategory} - ${customReason.trim()}` : reasonCategory);

    const isWasting = cancelMode === 'WASTE';

    if (isWasting && totalWastedItemsCount === 0) {
      const confirmZero = await Swal.fire({
        title: 'Zero Wastage Entered',
        text: 'You selected "Production Failed with Wastage", but 0 quantity is entered for all materials. Proceed with no wastage deduction?',
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Yes, proceed with 0 waste',
        cancelButtonText: 'Return to edit quantities'
      });
      if (!confirmZero.isConfirmed) return;
    }

    const wastageItems = isWasting ? materials.map(m => {
      const wastedBaseQty = Number(m.effectiveWastedQty || 0);
      const isAlt = m.selectedUnitMode === 'alt';
      const lossAmount = Number((wastedBaseQty * Number(m.unitCost || 0)).toFixed(2));
      return {
        rmId: m.rmId,
        quantity: wastedBaseQty,
        inputQty: Number(m.inputValue || 0),
        selectedUom: isAlt ? m.altUom : m.baseUom,
        conversionFactorUsed: m.convFactor,
        uomId: m.baseUom,
        unitCost: m.unitCost,
        lossAmount: lossAmount,
        batchId: m.batchId,
        batchNumber: m.lotNumber,
        remarks: `Production Failed • Batch #${batch.referenceNo} (${batch.batchNo || batch.product?.name || ''}) - ${finalReason}`
      };
    }).filter(it => it.quantity > 0) : [];

    try {
      setSubmitting(true);
      await api.patch(`/production/batches-redesign/${batch.id}/status`, {
        status: 'Cancelled',
        reason: finalReason,
        failureReason: finalReason,
        isWasted: isWasting && wastageItems.length > 0,
        wastageItems
      });

      Swal.fire({
        title: isWasting && wastageItems.length > 0 ? 'Production Failed & Wastage Deducted' : 'Production Cancelled',
        html: `
          <div style="text-align: left; font-size: 13px; line-height: 1.6;">
            <p><strong>Batch:</strong> <span style="font-family: monospace; font-weight: bold;">${batch.referenceNo}</span> (${batch.product?.name})</p>
            <p><strong>Status:</strong> <span style="color: #e11d48; font-weight: bold;">Cancelled (Production Failed)</span></p>
            ${isWasting && wastageItems.length > 0 ? `
              <p><strong>RM Wastage Logged:</strong> ${wastageItems.length} materials deducted from inventory lots.</p>
              <p><strong>Total Financial Loss:</strong> <span style="color: #e11d48; font-weight: bold;">₹${totalFinancialLoss.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></p>
              <p style="color: #64748b; font-size: 11px;">✓ Allocated lots deducted • RM Stock History updated under RM Wastage tab.</p>
            ` : `
              <p><strong>Stock Status:</strong> Allocations released with 0 wastage.</p>
            `}
          </div>
        `,
        icon: isWasting && wastageItems.length > 0 ? 'warning' : 'info',
        confirmButtonColor: '#e11d48'
      });

      onCancelled?.();
      onClose();
    } catch (err) {
      console.error('Cancellation error:', err);
      Swal.fire({
        title: 'Cancellation Failed',
        text: err.response?.data?.error || 'Failed to cancel production batch',
        icon: 'error'
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/75 backdrop-blur-xs animate-in fade-in duration-150">
      <div 
        className="w-full max-w-4xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl rounded-3xl flex flex-col overflow-hidden max-h-[92vh] animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Header */}
        <div className="bg-rose-950/80 text-white px-5 py-4 flex items-center justify-between border-b border-rose-900/60">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-2xl bg-rose-500/20 text-rose-400 border border-rose-400/30">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-base text-white font-mono">
                  Cancel Production Batch: {batch?.referenceNo}
                </h3>
                {batch?.batchNo && batch.batchNo !== batch.referenceNo && (
                  <span className="text-[10px] font-mono text-rose-200 bg-rose-900/60 px-2 py-0.5 rounded-full border border-rose-700/40">
                    {batch.batchNo}
                  </span>
                )}
              </div>
              <p className="text-xs text-rose-200/80 mt-0.5">
                {batch?.product?.name || 'Finished Product'} • Current Status: <strong>{batch?.status}</strong>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-rose-300 hover:text-white rounded-xl p-1.5 transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 space-y-5 overflow-y-auto flex-1 text-xs">
          
          {/* Decision Cards: Mode Selection */}
          <div className="space-y-2">
            <label className="text-[11px] font-black uppercase tracking-wider text-slate-500 block">
              1. Choose Cancellation Workflow:
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              
              {/* Option A: Production Failed with RM Wastage */}
              <button
                type="button"
                onClick={() => setCancelMode('WASTE')}
                className={`p-4 rounded-2xl border-2 text-left transition-all cursor-pointer space-y-1.5 ${
                  cancelMode === 'WASTE'
                    ? 'border-rose-500 bg-rose-50/70 dark:bg-rose-950/40 shadow-sm'
                    : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-850'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-black text-xs text-rose-600 dark:text-rose-400">
                    <Trash2 className="w-4 h-4" />
                    <span>Production Failed / Scrapped with Wastage</span>
                  </div>
                  {cancelMode === 'WASTE' && (
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-600"></span>
                  )}
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                  Materials were already drawn, mixed, or damaged during failure. Deduct actual wasted quantities directly from allocated batch lots and log loss in RM History.
                </p>
              </button>

              {/* Option B: Clean Cancel Without Wastage */}
              <button
                type="button"
                onClick={() => setCancelMode('NO_WASTE')}
                className={`p-4 rounded-2xl border-2 text-left transition-all cursor-pointer space-y-1.5 ${
                  cancelMode === 'NO_WASTE'
                    ? 'border-indigo-500 bg-indigo-50/70 dark:bg-indigo-950/40 shadow-sm'
                    : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-850'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-black text-xs text-indigo-600 dark:text-indigo-400">
                    <RotateCcw className="w-4 h-4" />
                    <span>Cancel Before Wasting (Release Stock)</span>
                  </div>
                  {cancelMode === 'NO_WASTE' && (
                    <span className="w-2.5 h-2.5 rounded-full bg-indigo-600"></span>
                  )}
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                  Materials were not yet used or spoiled. Release allocated inventory lots back to warehouse stock with 0 wastage and 0 consumption.
                </p>
              </button>

            </div>
          </div>

          {/* Reason Selection */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 dark:bg-slate-850 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
            <div>
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block mb-1">
                Cancellation / Failure Reason:
              </label>
              <select
                value={reasonCategory}
                onChange={(e) => setReasonCategory(e.target.value)}
                className="w-full text-xs font-bold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500 cursor-pointer shadow-2xs"
              >
                {COMMON_CANCELLATION_REASONS.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block mb-1">
                Explanation & Incident Notes:
              </label>
              <Input
                type="text"
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                placeholder="e.g. Tank 2 valve leaked at 14:30, spoiled 160L milk..."
                className="h-9 text-xs rounded-xl bg-white dark:bg-slate-800"
              />
            </div>
          </div>

          {/* Raw Material Wastage Table (Only in WASTE Mode) */}
          {cancelMode === 'WASTE' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-1.5">
                    <Scale className="w-3.5 h-3.5 text-rose-600" />
                    Allocated Raw Materials & Wasted Quantities ({materials.length})
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    Enter the quantity wasted. Values will be deducted directly from the allocated inventory lot number.
                  </p>
                </div>

                <div className="flex items-center gap-1.5">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleSetAllWasted}
                    className="h-7 text-[10px] font-bold rounded-lg border-rose-300 text-rose-700 hover:bg-rose-50 cursor-pointer"
                  >
                    All Wasted (100%)
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleSetAllZero}
                    className="h-7 text-[10px] font-bold rounded-lg text-slate-500 hover:text-slate-800 cursor-pointer"
                  >
                    Reset (0)
                  </Button>
                </div>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50/80 dark:bg-slate-800/60 text-slate-500 font-bold border-b border-slate-200 dark:border-slate-800 uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="p-3">#</th>
                      <th className="p-3">Raw Material</th>
                      <th className="p-3">Allocated Lot</th>
                      <th className="p-3 text-right">Planned Qty</th>
                      <th className="p-3 text-center">Wasted Qty Entry</th>
                      <th className="p-3 text-right">Unit Rate (Base)</th>
                      <th className="p-3 text-right">Wastage Loss</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {materials.map((m, idx) => {
                      const lineLoss = Number((m.effectiveWastedQty * m.unitCost).toFixed(2));
                      return (
                        <tr key={m.key || idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                          <td className="p-3 text-slate-400 font-mono font-medium">{idx + 1}</td>
                          <td className="p-3">
                            <div className="font-bold text-slate-900 dark:text-white">{m.name}</div>
                            <span className="text-[10px] font-mono text-slate-400">{m.code}</span>
                          </td>
                          <td className="p-3">
                            <span className="inline-flex items-center gap-1 font-mono text-[11px] font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/70 px-2 py-0.5 rounded-md border border-indigo-200 dark:border-indigo-800">
                              <Tag className="w-2.5 h-2.5 text-indigo-500" />
                              {m.lotNumber}
                            </span>
                          </td>
                          <td className="p-3 text-right font-mono font-medium text-slate-600 dark:text-slate-300">
                            <div className="font-bold text-slate-800 dark:text-slate-200">
                              {m.plannedDisplayQty} {m.plannedDisplayUom}
                            </div>
                            {m.hasAlt && (
                              <div className="text-[10px] text-slate-400 font-mono">
                                {m.plannedDisplayUom.toLowerCase() === m.baseUom.toLowerCase() ? (
                                  <span>({Number((m.canonicalPlannedQty * m.convFactor).toFixed(2)).toLocaleString()} {m.altUom})</span>
                                ) : (
                                  <span>({m.canonicalPlannedQty.toFixed(4)} {m.baseUom})</span>
                                )}
                              </div>
                            )}
                          </td>
                          <td className="p-3">
                            <div className="flex items-center justify-center gap-2">
                              <Input
                                type="number"
                                min="0"
                                step="any"
                                value={m.inputValue}
                                onChange={(e) => handleQtyChange(idx, e.target.value)}
                                className="h-8 w-24 text-center font-mono font-black text-rose-600 rounded-xl"
                              />

                              {/* Base vs Alt UOM Selector */}
                              {m.hasAlt ? (
                                <select
                                  value={m.selectedUnitMode}
                                  onChange={(e) => handleUnitModeToggle(idx, e.target.value)}
                                  className="h-8 text-[11px] font-bold font-mono bg-slate-100 dark:bg-slate-800 rounded-xl px-1.5 border border-slate-200 dark:border-slate-700 cursor-pointer text-slate-700 dark:text-slate-300"
                                  title={`1 ${m.baseUom} = ${m.convFactor} ${m.altUom}`}
                                >
                                  <option value="base">{m.baseUom}</option>
                                  <option value="alt">{m.altUom}</option>
                                </select>
                              ) : (
                                <span className="text-[11px] font-mono font-bold text-slate-500 w-8 text-center uppercase">
                                  {m.baseUom}
                                </span>
                              )}

                              {/* Quick 100% button */}
                              <button
                                type="button"
                                onClick={() => handleQuickFill(idx, 100)}
                                className="text-[9px] font-bold px-1.5 py-1 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-600 dark:text-slate-300 cursor-pointer"
                                title="Set 100% Wasted"
                              >
                                Max
                              </button>
                            </div>
                            {m.hasAlt && (
                              <div className="text-[9.5px] font-mono text-slate-400 text-center pt-0.5">
                                {m.selectedUnitMode === 'alt' ? (
                                  <span>≈ {m.effectiveWastedQty.toFixed(4)} {m.baseUom}</span>
                                ) : (
                                  <span>≈ {Number((m.effectiveWastedQty * m.convFactor).toFixed(2)).toLocaleString()} {m.altUom}</span>
                                )}
                              </div>
                            )}
                          </td>
                          <td className="p-3 text-right font-mono text-slate-600 dark:text-slate-300">
                            <div>₹{m.unitCost.toFixed(2)}</div>
                            <span className="text-[9.5px] text-slate-400 font-sans">per {m.baseUom}</span>
                          </td>
                          <td className="p-3 text-right font-mono font-bold text-rose-600 dark:text-rose-400 whitespace-nowrap">
                            ₹{lineLoss.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-rose-50/70 dark:bg-rose-950/40 font-bold border-t-2 border-rose-200 dark:border-rose-900 text-xs">
                    <tr>
                      <td colSpan={4} className="p-3 text-right text-rose-800 dark:text-rose-300">
                        Total Wastage Financial Loss:
                      </td>
                      <td className="p-3 text-center text-rose-700 font-mono">
                        {totalWastedItemsCount} material{totalWastedItemsCount === 1 ? '' : 's'} wasted
                      </td>
                      <td></td>
                      <td className="p-3 text-right font-black font-mono text-rose-700 dark:text-rose-300 whitespace-nowrap text-sm">
                        ₹{totalFinancialLoss.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="bg-slate-50 dark:bg-slate-850 px-5 py-3.5 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between flex-wrap gap-2 text-xs">
          <div className="text-slate-500 font-medium">
            {cancelMode === 'WASTE' ? (
              <span className="text-rose-600 dark:text-rose-400 font-semibold flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" />
                This will record ₹{totalFinancialLoss.toFixed(2)} loss in RM History and deduct from warehouse stock.
              </span>
            ) : (
              <span className="text-slate-500">
                All batch allocations will be safely released with 0 loss recorded.
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={submitting}
              onClick={onClose}
              className="rounded-xl h-9 px-4 font-bold cursor-pointer"
            >
              Keep Batch (Close)
            </Button>
            <Button
              type="button"
              disabled={submitting}
              onClick={handleSubmit}
              className={`rounded-xl h-9 px-4 font-bold text-white shadow-xs cursor-pointer flex items-center gap-1.5 ${
                cancelMode === 'WASTE'
                  ? 'bg-rose-600 hover:bg-rose-700'
                  : 'bg-indigo-600 hover:bg-indigo-700'
              }`}
            >
              {submitting ? (
                <span>Processing...</span>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>
                    {cancelMode === 'WASTE' ? 'Confirm Production Failed & Record Wastage' : 'Confirm Cancellation & Release Stock'}
                  </span>
                </>
              )}
            </Button>
          </div>
        </div>

      </div>
    </div>
  );
}
