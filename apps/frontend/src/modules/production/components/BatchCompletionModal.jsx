import React, { useState, useEffect } from 'react';
import { 
  CheckCircle2, X, AlertTriangle, Scale, Package, ShieldCheck, 
  FlaskConical, Zap, Users, AlertCircle, Sparkles, HelpCircle 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Swal from 'sweetalert2';

export default function BatchCompletionModal({
  isOpen,
  onClose,
  batch,
  onSubmit,
  submitting = false
}) {
  const [activeTab, setActiveTab] = useState('yield'); // 'yield', 'materials', 'utilities'
  const [actualOutput, setActualOutput] = useState('');
  const [rejectedQty, setRejectedQty] = useState(0);
  const [scrapQty, setScrapQty] = useState(0);
  const [scrapReason, setScrapReason] = useState('');
  const [actualRmUsages, setActualRmUsages] = useState([]);
  const [completionNote, setCompletionNote] = useState('');

  // EB & Utility states
  const [ebStartReading, setEbStartReading] = useState(0);
  const [ebEndReading, setEbEndReading] = useState(0);
  const [ebRatePerUnit, setEbRatePerUnit] = useState(8.50);

  useEffect(() => {
    if (batch) {
      const plannedQty = Number(batch.quantity || 0);
      setActualOutput(plannedQty);
      setRejectedQty(0);
      setScrapQty(0);
      setScrapReason('');
      setEbStartReading(0);
      setEbEndReading(0);
      setEbRatePerUnit(8.50);
      setActiveTab('yield');

      const usages = (batch.rmUsages || []).map(u => {
        let baseUom = u.rawMaterial?.unit?.abbreviation || u.rawMaterial?.unitId || 'liter';
        if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(baseUom)) {
          baseUom = 'units';
        }

        const altUomCandidate = u.rawMaterial?.alternateUom || (u.rawMaterial?.consumptionUnit && u.rawMaterial.consumptionUnit.toLowerCase() !== baseUom.toLowerCase() ? u.rawMaterial.consumptionUnit : null);
        const hasAlt = Boolean(u.rawMaterial?.hasAlternateUom && altUomCandidate && altUomCandidate.toLowerCase() !== baseUom.toLowerCase());
        const altUom = hasAlt ? altUomCandidate : null;
        const convFactor = hasAlt ? Number(
          u.conversionFactorUsed ||
          u.rawMaterial?.conversionFactor ||
          (u.rawMaterial?.alternateUomQty && u.rawMaterial?.baseUomQty ? (u.rawMaterial.alternateUomQty / u.rawMaterial.baseUomQty) : 1000) ||
          1000
        ) : 1;

        const baseReqQty = Number(u.requiredQty || 0);

        // Determine initial selected unit:
        // If batch was pre-selected in alternate UOM (or u.selectedUom equals altUom), start in alt UOM ('sub')
        const isAltSelected = Boolean(hasAlt && (u.selectedUom && u.selectedUom.toLowerCase() === altUom.toLowerCase()));
        const selectedUnit = isAltSelected ? 'sub' : 'base';

        // Calculate initial input value:
        // If starting in 'sub' (alt UOM), show baseReqQty * convFactor, otherwise baseReqQty
        let initialVal = baseReqQty;
        if (u.actualUsedQty !== null && u.actualUsedQty !== undefined) {
          const act = Number(u.actualUsedQty);
          // If stored act is canonical base, convert to selectedUnit
          initialVal = selectedUnit === 'sub' ? Number((act * convFactor).toFixed(3)) : act;
        } else if (selectedUnit === 'sub') {
          initialVal = Number((baseReqQty * convFactor).toFixed(3));
        }

        return {
          rmId: u.rmId,
          name: u.rawMaterial?.name || 'Raw Material',
          code: u.rawMaterial?.code,
          baseRequiredQty: baseReqQty,
          requiredQty: baseReqQty,
          unit: baseUom,
          hasAlt,
          altUom,
          convFactor,
          selectedUnit,
          inputValue: initialVal,
          standardTolerancePct: 2.0
        };
      });
      setActualRmUsages(usages);
      setCompletionNote('');
    }
  }, [batch]);

  if (!isOpen || !batch) return null;

  const plannedQty = Number(batch.quantity || 1);
  const yieldPct = plannedQty > 0 && actualOutput !== '' 
    ? Number(((Number(actualOutput) / plannedQty) * 100).toFixed(1)) 
    : 100;
  
  const ebUnits = Math.max(0, Number((Number(ebEndReading) - Number(ebStartReading)).toFixed(2)));
  const ebCost = Number((ebUnits * Number(ebRatePerUnit)).toFixed(2));

  const handleInputChange = (index, val) => {
    const updated = [...actualRmUsages];
    updated[index].inputValue = val;
    setActualRmUsages(updated);
  };

  const handleUnitToggle = (index, unitChoice) => {
    const updated = [...actualRmUsages];
    const current = updated[index];
    if (current.selectedUnit === unitChoice) return;

    const factor = current.convFactor > 0 ? current.convFactor : 1000;
    let val = parseFloat(current.inputValue);
    if (isNaN(val)) val = 0;

    let newInputValue = val;
    if (unitChoice === 'sub' && current.selectedUnit === 'base') {
      // Switching from Base (e.g. Liter / Kg) -> Alternate (e.g. ml / gm)
      newInputValue = Number((val * factor).toFixed(3));
    } else if (unitChoice === 'base' && current.selectedUnit === 'sub') {
      // Switching from Alternate (e.g. ml / gm) -> Base (e.g. Liter / Kg)
      newInputValue = factor > 0 ? Number((val / factor).toFixed(4)) : val;
    }

    updated[index] = {
      ...current,
      selectedUnit: unitChoice,
      inputValue: newInputValue
    };
    setActualRmUsages(updated);
  };

  // Build completion payload
  const buildPayload = (labTestRequired) => {
    return {
      actualOutput: Number(actualOutput),
      labTestRequired: Boolean(labTestRequired),
      rejectedQty: Number(rejectedQty || 0),
      scrapQty: Number(scrapQty || 0),
      scrapReason: scrapReason || null,
      ebStartReading: Number(ebStartReading || 0),
      ebEndReading: Number(ebEndReading || 0),
      ebUnitsKwh: ebUnits,
      ebRatePerUnit: Number(ebRatePerUnit || 8.50),
      rmUsages: actualRmUsages.map(u => {
        const factor = u.convFactor > 0 ? u.convFactor : 1000;
        const inputNum = parseFloat(u.inputValue) || 0;
        const isSub = u.selectedUnit === 'sub';
        // Canonical base quantity for inventory stock deduction
        const canonicalBaseQty = isSub ? (factor > 0 ? inputNum / factor : inputNum) : inputNum;
        const selectedUom = isSub ? (u.altUom || u.unit) : u.unit;
        return {
          rmId: u.rmId,
          actualUsedQty: Number(canonicalBaseQty.toFixed(4)),
          inputQty: inputNum,
          selectedUom: selectedUom,
          conversionFactorUsed: factor,
          isAlternateUom: isSub
        };
      }),
      note: completionNote
    };
  };

  // RED BUTTON: Lab Test Not Required / Exempt (DEFAULT)
  const handleLabTestExempt = async () => {
    if (!actualOutput || Number(actualOutput) <= 0) {
      Swal.fire({
        title: 'Invalid Yield',
        text: 'Please enter a valid actual yield output greater than zero.',
        icon: 'error'
      });
      return;
    }

    const isDark = document.documentElement.classList.contains('dark');
    const unitLabel = batch.product?.unit?.abbreviation || 'pcs';

    const result = await Swal.fire({
      title: 'Confirm Lab Test Exempt?',
      html: `
        <div style="text-align: left; font-size: 13px; line-height: 1.5;">
          <p style="margin-bottom: 8px;"><strong>Batch:</strong> <span style="font-family: monospace; font-weight: bold; color: #6366f1;">${batch.batchNo || batch.referenceNo}</span></p>
          <p style="margin-bottom: 8px;"><strong>Product:</strong> ${batch.product?.name}</p>
          <p style="margin-bottom: 12px;"><strong>Actual Output:</strong> <span style="color: #10b981; font-weight: bold; font-size: 14px;">${actualOutput} ${unitLabel}</span> (Yield: ${yieldPct}%)</p>
          
          <div style="background: rgba(239, 68, 68, 0.08); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 8px; padding: 10px; margin-bottom: 8px;">
            <p style="color: #ef4444; font-weight: 700; margin: 0 0 4px 0;">⚡ DIRECT STOCK UPDATE NOTICE</p>
            <p style="color: ${isDark ? '#f87171' : '#b91c1c'}; margin: 0; font-size: 12px;">
              Lab test is marked <strong>EXEMPT</strong>. The finished goods stock of <strong>${actualOutput} ${unitLabel}</strong> will be <strong>directly credited to Available Inventory</strong> right now. Raw materials will be deducted in this transaction.
            </p>
          </div>
        </div>
      `,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Confirm & Update Stock Immediately',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#ef4444',
      background: isDark ? 'rgba(15, 23, 42, 0.98)' : '#ffffff',
      color: isDark ? '#f8fafc' : '#0f172a'
    });

    if (result.isConfirmed) {
      onSubmit(batch.id, buildPayload(false));
    }
  };

  // GREEN BUTTON: Lab Test Required
  const handleLabTestRequired = async () => {
    if (!actualOutput || Number(actualOutput) <= 0) {
      Swal.fire({
        title: 'Invalid Yield',
        text: 'Please enter a valid actual yield output greater than zero.',
        icon: 'error'
      });
      return;
    }

    const isDark = document.documentElement.classList.contains('dark');
    const unitLabel = batch.product?.unit?.abbreviation || 'pcs';

    const result = await Swal.fire({
      title: 'Send to QC Testing Queue?',
      html: `
        <div style="text-align: left; font-size: 13px; line-height: 1.5;">
          <p style="margin-bottom: 8px;"><strong>Batch:</strong> <span style="font-family: monospace; font-weight: bold; color: #6366f1;">${batch.batchNo || batch.referenceNo}</span></p>
          <p style="margin-bottom: 8px;"><strong>Product:</strong> ${batch.product?.name}</p>
          <p style="margin-bottom: 12px;"><strong>Actual Output:</strong> <span style="color: #10b981; font-weight: bold; font-size: 14px;">${actualOutput} ${unitLabel}</span></p>
          
          <div style="background: rgba(16, 185, 129, 0.08); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 8px; padding: 10px; margin-bottom: 8px;">
            <p style="color: #10b981; font-weight: 700; margin: 0 0 4px 0;">🔬 LAB INSPECTION HOLD NOTICE</p>
            <p style="color: ${isDark ? '#34d399' : '#047857'}; margin: 0; font-size: 12px;">
              This batch status will be updated to <strong>'Lab Test In Progress'</strong> and queued in <strong>/production/qc-queue</strong>.<br/><br/>
              Finished goods stock will remain in <strong>Quarantine (0 Available Stock)</strong> until the Lab Assistant records test parameters, verifies expiry date, and approves the batch.
            </p>
          </div>
        </div>
      `,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, Send to QC Queue',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#10b981',
      background: isDark ? 'rgba(15, 23, 42, 0.98)' : '#ffffff',
      color: isDark ? '#f8fafc' : '#0f172a'
    });

    if (result.isConfirmed) {
      onSubmit(batch.id, buildPayload(true));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate__animated animate__fadeIn animate__faster">
      <div 
        className="w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate__animated animate__zoomIn animate__faster"
        role="dialog"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 bg-gradient-to-r from-slate-50 via-indigo-50/40 to-slate-50 dark:from-slate-900 dark:via-indigo-950/20 dark:to-slate-900 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-600/20 shrink-0 font-black">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
                  Complete Production Batch
                </h2>
                <span className="font-mono text-[10px] font-bold bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded-full border border-indigo-200 dark:border-indigo-800">
                  {batch.batchNo || batch.referenceNo}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {batch.product?.name} ({batch.product?.code || 'FP'})
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 px-5 pt-2 shrink-0 gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('yield')}
            className={`pb-2.5 px-3 text-xs font-bold border-b-2 flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'yield'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <Scale className="w-3.5 h-3.5" />
            1. Yield & Output
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('materials')}
            className={`pb-2.5 px-3 text-xs font-bold border-b-2 flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'materials'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <Package className="w-3.5 h-3.5" />
            2. Material Consumption ({actualRmUsages.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('utilities')}
            className={`pb-2.5 px-3 text-xs font-bold border-b-2 flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'utilities'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            3. Utilities & EB Power
          </button>
        </div>

        {/* Form Body Scrollable */}
        <div className="p-5 space-y-4 overflow-y-auto text-xs flex-1">
          {/* TAB 1: YIELD & OUTPUT */}
          {activeTab === 'yield' && (
            <div className="space-y-4 animate__animated animate__fadeIn animate__faster">
              {/* Actual Yield Input Box */}
              <div className="p-4 bg-gradient-to-br from-indigo-50/60 via-white to-slate-50 dark:from-slate-850 dark:via-slate-850 dark:to-slate-900 rounded-2xl border border-indigo-100 dark:border-slate-750 space-y-3">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <label className="text-[11px] uppercase font-black text-indigo-700 dark:text-indigo-400 block tracking-wide">
                      Actual Good Yield Produced ({batch.product?.unit?.abbreviation || 'pcs'}) *
                    </label>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      Planned Target: <strong>{batch.quantity} {batch.product?.unit?.abbreviation || 'pcs'}</strong>
                    </span>
                  </div>
                  <div className="w-40">
                    <Input
                      type="number"
                      min="0"
                      step="any"
                      required
                      value={actualOutput}
                      onChange={(e) => setActualOutput(e.target.value)}
                      className="bg-white dark:bg-slate-900 border-indigo-200 dark:border-indigo-900 h-11 rounded-xl font-mono font-black text-base text-right text-indigo-700 dark:text-indigo-300 shadow-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px]">
                  <div className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                    <span className="text-slate-400 block text-[10px]">Yield Ratio</span>
                    <span className={`font-mono font-black text-sm ${yieldPct >= 95 ? 'text-emerald-600' : 'text-amber-600'}`}>
                      {yieldPct}%
                    </span>
                  </div>
                  <div className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                    <span className="text-slate-400 block text-[10px]">Planned Qty</span>
                    <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                      {plannedQty} {batch.product?.unit?.abbreviation || 'pcs'}
                    </span>
                  </div>
                  <div className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 col-span-2 sm:col-span-1">
                    <span className="text-slate-400 block text-[10px]">Output UOM</span>
                    <span className="font-bold text-slate-700 dark:text-slate-300">
                      {batch.product?.unit?.name || 'Pieces'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Scrap & Rejected Details */}
              <div className="p-3.5 bg-slate-50 dark:bg-slate-850 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-3">
                <span className="font-bold text-slate-700 dark:text-slate-300 uppercase text-[10px] tracking-wide block">
                  Scrap & Defect Quantity Tracking (Optional)
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                      Scrap / Wastage Qty
                    </label>
                    <Input
                      type="number"
                      min="0"
                      step="any"
                      value={scrapQty}
                      onChange={(e) => setScrapQty(e.target.value)}
                      className="bg-white dark:bg-slate-900 h-9 rounded-xl text-right font-mono"
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                      Defective / Rejected Qty
                    </label>
                    <Input
                      type="number"
                      min="0"
                      step="any"
                      value={rejectedQty}
                      onChange={(e) => setRejectedQty(e.target.value)}
                      className="bg-white dark:bg-slate-900 h-9 rounded-xl text-right font-mono"
                      placeholder="0.00"
                    />
                  </div>
                </div>
                {Number(scrapQty) > 0 && (
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                      Scrap Reason Code
                    </label>
                    <input
                      type="text"
                      value={scrapReason}
                      onChange={(e) => setScrapReason(e.target.value)}
                      placeholder="e.g. Line purge, start-up trimming, burnt batch"
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none"
                    />
                  </div>
                )}
              </div>

              {/* Floor Observations */}
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                  Floor Supervisor Notes & Remarks
                </label>
                <textarea
                  value={completionNote}
                  onChange={(e) => setCompletionNote(e.target.value)}
                  placeholder="Record any temperature, line speed, or changeover observations..."
                  rows="2"
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none resize-none leading-relaxed"
                />
              </div>
            </div>
          )}

          {/* TAB 2: RAW MATERIAL CONSUMPTION */}
          {activeTab === 'materials' && (
            <div className="space-y-3 animate__animated animate__fadeIn animate__faster">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-700 dark:text-slate-300 uppercase text-[10px] tracking-wide block">
                  Actual Ingredients Consumed vs BOM Standard
                </span>
                <span className="text-[10px] text-slate-400">
                  Alternate UOMs loaded from Setup
                </span>
              </div>

              <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden divide-y divide-slate-100 dark:divide-slate-800">
                <div className="bg-slate-50 dark:bg-slate-950 p-2.5 grid grid-cols-12 font-bold text-[10px] text-slate-500 uppercase tracking-wider">
                  <span className="col-span-5">Raw Material</span>
                  <span className="col-span-3 text-right">Standard BOM</span>
                  <span className="col-span-4 text-right">Actual Consumed</span>
                </div>

                {actualRmUsages.map((rm, idx) => (
                  <div key={idx} className="p-2.5 grid grid-cols-12 items-center gap-2 hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                    <div className="col-span-5 min-w-0 pr-1">
                      <span className="font-bold text-slate-800 dark:text-slate-200 block truncate">
                        {rm.name}
                      </span>
                      {rm.code && (
                        <span className="font-mono text-[9px] text-slate-400">{rm.code}</span>
                      )}
                    </div>

                    <div className="col-span-3 text-right font-mono text-slate-600 dark:text-slate-400 text-[11px]">
                      {rm.hasAlt && rm.altUom ? (
                        <div>
                          <div className="font-bold text-slate-700 dark:text-slate-300">
                            {rm.selectedUnit === 'sub'
                              ? `${Number((rm.baseRequiredQty * rm.convFactor).toFixed(2)).toLocaleString()} ${rm.altUom}`
                              : `${rm.baseRequiredQty.toFixed(2)} ${rm.unit}`}
                          </div>
                          <div className="text-[9.5px] text-slate-400">
                            {rm.selectedUnit === 'sub'
                              ? `(${rm.baseRequiredQty.toFixed(2)} ${rm.unit})`
                              : `(${Number((rm.baseRequiredQty * rm.convFactor).toFixed(2)).toLocaleString()} ${rm.altUom})`}
                          </div>
                        </div>
                      ) : (
                        <span>{rm.baseRequiredQty.toFixed(2)} {rm.unit}</span>
                      )}
                    </div>

                    <div className="col-span-4 flex flex-col items-end gap-1">
                      <div className="flex items-center justify-end gap-1.5">
                        <input
                          type="number"
                          min="0"
                          step="any"
                          required
                          value={rm.inputValue}
                          onChange={(e) => handleInputChange(idx, e.target.value)}
                          className="w-24 px-2 py-1 font-mono font-bold text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-right text-slate-800 dark:text-white"
                        />

                        {rm.hasAlt && rm.altUom ? (
                          <div className="flex bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700 text-[9px] font-bold">
                            <button
                              type="button"
                              onClick={() => handleUnitToggle(idx, 'base')}
                              title={`Switch to Base UOM (${rm.unit})`}
                              className={`px-1.5 py-0.5 rounded cursor-pointer transition-colors ${rm.selectedUnit === 'base' ? 'bg-indigo-600 text-white shadow-2xs font-extrabold' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                            >
                              {rm.unit}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleUnitToggle(idx, 'sub')}
                              title={`Switch to Alternate UOM (${rm.altUom})`}
                              className={`px-1.5 py-0.5 rounded cursor-pointer transition-colors ${rm.selectedUnit === 'sub' ? 'bg-indigo-600 text-white shadow-2xs font-extrabold' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                            >
                              {rm.altUom}
                            </button>
                          </div>
                        ) : (
                          <span className="font-mono text-[10px] text-slate-500 font-bold min-w-8 text-left">
                            {rm.unit}
                          </span>
                        )}
                      </div>

                      <span className="font-mono text-[9px] font-bold text-indigo-600 dark:text-indigo-400">
                        {Number(actualOutput) > 0 ? (
                          rm.selectedUnit === 'sub' ? (
                            <span>
                              ≈ {(Number(rm.inputValue || 0) / Number(actualOutput)).toFixed(4)} {rm.altUom}/pc{' '}
                              <span className="text-slate-400 font-normal">
                                (= {(Number(rm.inputValue || 0) / Number(actualOutput) / (rm.convFactor || 1000)).toFixed(4)} {rm.unit}/pc)
                              </span>
                            </span>
                          ) : (
                            <span>
                              ≈ {(Number(rm.inputValue || 0) / Number(actualOutput)).toFixed(4)} {rm.unit}/pc{' '}
                              {rm.hasAlt && rm.altUom && (
                                <span className="text-slate-400 font-normal">
                                  (= {(Number(rm.inputValue || 0) / Number(actualOutput) * (rm.convFactor || 1000)).toFixed(2)} {rm.altUom}/pc)
                                </span>
                              )}
                            </span>
                          )
                        ) : (
                          `0 ${rm.selectedUnit === 'sub' ? (rm.altUom || rm.unit) : rm.unit}/pc`
                        )}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: UTILITIES & EB POWER */}
          {activeTab === 'utilities' && (
            <div className="space-y-4 animate__animated animate__fadeIn animate__faster">
              <div className="p-4 bg-amber-50/60 dark:bg-amber-950/30 rounded-2xl border border-amber-200 dark:border-amber-800 space-y-3">
                <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 font-bold text-xs">
                  <Zap className="w-4 h-4 text-amber-600" />
                  Electricity (EB) Meter Consumption Reading
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                      EB Start Reading (kWh)
                    </label>
                    <Input
                      type="number"
                      min="0"
                      step="any"
                      value={ebStartReading}
                      onChange={(e) => setEbStartReading(e.target.value)}
                      className="bg-white dark:bg-slate-900 h-9 rounded-xl font-mono text-right"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                      EB End Reading (kWh)
                    </label>
                    <Input
                      type="number"
                      min="0"
                      step="any"
                      value={ebEndReading}
                      onChange={(e) => setEbEndReading(e.target.value)}
                      className="bg-white dark:bg-slate-900 h-9 rounded-xl font-mono text-right"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                      Rate per Unit (₹/kWh)
                    </label>
                    <Input
                      type="number"
                      min="0"
                      step="any"
                      value={ebRatePerUnit}
                      onChange={(e) => setEbRatePerUnit(e.target.value)}
                      className="bg-white dark:bg-slate-900 h-9 rounded-xl font-mono text-right"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-amber-100 dark:border-amber-900/50">
                  <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400">
                    Calculated Power Consumed:
                  </span>
                  <div className="text-right">
                    <span className="font-mono font-bold text-amber-700 dark:text-amber-400 block text-xs">
                      {ebUnits} kWh
                    </span>
                    <span className="font-mono text-[10px] text-slate-400">
                      Total Cost: ₹{ebCost.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Decision Workflow Guidance Notice */}
          <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-750 flex items-start gap-2.5">
            <HelpCircle className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
            <div className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
              <span className="font-bold text-slate-800 dark:text-white block mb-0.5">
                Lab Decision Protocol:
              </span>
              <span>
                Select <strong className="text-emerald-600 dark:text-emerald-400">Lab Test Required</strong> if batch samples must undergo microbial, sensory, or COA verification before release. 
                Select <strong className="text-rose-600 dark:text-rose-400">Lab Test Not Required (Exempt)</strong> to immediately credit the output to sellable stock.
              </span>
            </div>
          </div>
        </div>

        {/* Footer Actions with Distinct Green & Red Buttons */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={submitting}
            className="rounded-xl text-xs font-semibold h-10 px-4 w-full sm:w-auto cursor-pointer"
          >
            Cancel
          </Button>

          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
            {/* GREEN BUTTON: Lab Test Required */}
            <Button
              type="button"
              onClick={handleLabTestRequired}
              disabled={submitting || !actualOutput || Number(actualOutput) <= 0}
              className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black h-10 px-4 shadow-sm shadow-emerald-600/30 cursor-pointer flex items-center justify-center gap-1.5 flex-1 sm:flex-initial"
              title="Send batch to Production QC Queue for Lab Assistant inspection"
            >
              <FlaskConical className="w-4 h-4" />
              Lab Test Required
            </Button>

            {/* RED BUTTON: Lab Test Not Required / Exempt (DEFAULT) */}
            <Button
              type="button"
              onClick={handleLabTestExempt}
              disabled={submitting || !actualOutput || Number(actualOutput) <= 0}
              className="bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black h-10 px-4 shadow-sm shadow-rose-600/30 cursor-pointer flex items-center justify-center gap-1.5 flex-1 sm:flex-initial ring-2 ring-rose-500/20"
              title="Exempt from lab test. Directly updates finished goods stock into Available Inventory (Default)"
            >
              <CheckCircle2 className="w-4 h-4" />
              Lab Test Not Required (Exempt)
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
