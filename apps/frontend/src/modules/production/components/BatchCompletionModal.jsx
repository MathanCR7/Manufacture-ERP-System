import React, { useState, useEffect } from 'react';
import { CheckCircle2, X, AlertTriangle, Scale, Package, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function BatchCompletionModal({
  isOpen,
  onClose,
  batch,
  onSubmit,
  submitting = false
}) {
  const [actualOutput, setActualOutput] = useState('');
  const [actualRmUsages, setActualRmUsages] = useState([]);
  const [completionNote, setCompletionNote] = useState('');

  useEffect(() => {
    if (batch) {
      setActualOutput(Number(batch.quantity || 0));
      const usages = (batch.rmUsages || []).map(u => {
        const uomLabel = u.rawMaterial?.unit?.abbreviation || 'units';
        const isKg = /kg|kilogram/i.test(uomLabel);
        const isL = /l|liter|litre/i.test(uomLabel);
        const subUomLabel = isKg ? 'g' : (isL ? 'ml' : null);

        return {
          rmId: u.rmId,
          name: u.rawMaterial?.name || 'Raw Material',
          code: u.rawMaterial?.code,
          requiredQty: Number(u.requiredQty || 0),
          unit: uomLabel,
          subUomLabel,
          selectedUnit: 'base',
          inputValue: Number(u.requiredQty || 0)
        };
      });
      setActualRmUsages(usages);
      setCompletionNote('');
    }
  }, [batch]);

  if (!isOpen || !batch) return null;

  const handleInputChange = (index, val) => {
    const updated = [...actualRmUsages];
    updated[index].inputValue = val;
    setActualRmUsages(updated);
  };

  const handleUnitToggle = (index, unitChoice) => {
    const updated = [...actualRmUsages];
    const current = updated[index];
    if (current.selectedUnit === unitChoice) return;

    // Convert value between base (kg/L) and sub (g/ml)
    let newInputValue = Number(current.inputValue || 0);
    if (unitChoice === 'sub' && current.selectedUnit === 'base') {
      newInputValue = newInputValue * 1000;
    } else if (unitChoice === 'base' && current.selectedUnit === 'sub') {
      newInputValue = newInputValue / 1000;
    }

    updated[index] = {
      ...current,
      selectedUnit: unitChoice,
      inputValue: newInputValue
    };
    setActualRmUsages(updated);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const payload = {
      actualOutput: Number(actualOutput),
      rmUsages: actualRmUsages.map(u => {
        const actualVal = u.selectedUnit === 'sub' ? Number(u.inputValue) / 1000 : Number(u.inputValue);
        return {
          rmId: u.rmId,
          actualUsedQty: actualVal
        };
      }),
      note: completionNote
    };
    onSubmit(batch.id, payload);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate__animated animate__fadeIn animate__faster">
      <div 
        className="w-full max-w-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden animate__animated animate__zoomIn animate__faster"
        role="dialog"
      >
        {/* Header */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 bg-gradient-to-r from-indigo-50/70 via-white to-slate-50 dark:from-slate-900 dark:via-indigo-950/20 dark:to-slate-900 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-600/20 shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                Record Batch Output & Material Consumption
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Batch #{batch.referenceNo} — {batch.product?.name}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[70vh] overflow-y-auto text-xs">
          {/* Actual Yield Input */}
          <div className="p-3 bg-slate-50 dark:bg-slate-850 rounded-2xl border border-slate-200/80 dark:border-slate-750 flex items-center justify-between gap-4">
            <div>
              <label className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 block">
                Actual Yield Output ({batch.product?.unit?.abbreviation || 'pcs'}) *
              </label>
              <span className="text-[10px] text-slate-400">
                Target scheduled was {batch.quantity} {batch.product?.unit?.abbreviation || 'pcs'}
              </span>
            </div>
            <div className="w-36">
              <Input
                type="number"
                min="0"
                step="any"
                required
                value={actualOutput}
                onChange={(e) => setActualOutput(e.target.value)}
                className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 h-10 rounded-xl font-mono font-bold text-sm text-right"
              />
            </div>
          </div>

          {/* Raw Material Usages List */}
          <div className="space-y-2">
            <span className="font-bold text-slate-700 dark:text-slate-300 uppercase text-[10px] tracking-wide block">
              Actual Ingredients Consumed
            </span>

            <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden divide-y divide-slate-100 dark:divide-slate-800">
              <div className="bg-slate-50 dark:bg-slate-950 p-2.5 grid grid-cols-12 font-bold text-[10px] text-slate-500 uppercase tracking-wider">
                <span className="col-span-5">Raw Material</span>
                <span className="col-span-3 text-right">Required (SOP)</span>
                <span className="col-span-4 text-right">Actual Used</span>
              </div>

              {actualRmUsages.map((rm, idx) => (
                <div key={idx} className="p-2.5 grid grid-cols-12 items-center gap-2 text-xs hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                  <div className="col-span-5 min-w-0 pr-1">
                    <span className="font-semibold text-slate-800 dark:text-slate-200 block truncate">
                      {rm.name}
                    </span>
                    {rm.code && (
                      <span className="font-mono text-[9px] text-slate-400">{rm.code}</span>
                    )}
                  </div>

                  <div className="col-span-3 text-right font-mono text-slate-600 dark:text-slate-400 text-[11px]">
                    {rm.requiredQty.toFixed(2)} {rm.unit}
                  </div>

                  <div className="col-span-4 flex items-center justify-end gap-1.5">
                    <input
                      type="number"
                      min="0"
                      step="any"
                      required
                      value={rm.inputValue}
                      onChange={(e) => handleInputChange(idx, e.target.value)}
                      className="w-20 px-2 py-1 font-mono font-bold text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-right text-slate-800 dark:text-white"
                    />

                    {rm.subUomLabel ? (
                      <div className="flex bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700 text-[9px] font-bold">
                        <button
                          type="button"
                          onClick={() => handleUnitToggle(idx, 'base')}
                          className={`px-1.5 py-0.5 rounded ${rm.selectedUnit === 'base' ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-2xs font-extrabold' : 'text-slate-500'}`}
                        >
                          {rm.unit}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleUnitToggle(idx, 'sub')}
                          className={`px-1.5 py-0.5 rounded ${rm.selectedUnit === 'sub' ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-2xs font-extrabold' : 'text-slate-500'}`}
                        >
                          {rm.subUomLabel}
                        </button>
                      </div>
                    ) : (
                      <span className="font-mono text-[10px] text-slate-500 font-bold min-w-8 text-left">
                        {rm.unit}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Completion Notes */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase block">
              Floor Completion Notes / Observations
            </label>
            <textarea
              value={completionNote}
              onChange={(e) => setCompletionNote(e.target.value)}
              placeholder="Record any production loss notes, temperature variances, or packaging comments..."
              rows="2"
              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1.5 focus:ring-indigo-500 resize-none leading-relaxed"
            />
          </div>

          {/* Footer Actions */}
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2.5">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={submitting}
              className="rounded-xl text-xs font-semibold h-10 px-4 cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitting || !actualOutput || Number(actualOutput) <= 0}
              className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold h-10 px-5 shadow-sm shadow-indigo-600/30 cursor-pointer flex items-center gap-1.5"
            >
              {submitting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Recording...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Submit to QC Queue
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
