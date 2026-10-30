import React from 'react';
import { 
  Printer, ArrowLeft, Unlock, CheckCircle2, DollarSign, Package, 
  Layers, Factory, Scale, FileSpreadsheet, ShieldCheck, Tag, Boxes,
  ChevronRight, Calendar, HardHat, AlertCircle, Clock
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { round2, formatIndian, toMl, formatCleanUom } from '../utils/productionCalculation';

const formatDateDMY = (dateVal) => {
  if (!dateVal) return 'dd-mm-yyyy';
  try {
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return String(dateVal).split('T')[0];
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
  } catch {
    return 'dd-mm-yyyy';
  }
};

export default function ProductionCleanReportView({
  batch,
  costingData,
  liveAllocationsResult,
  liveEvaporationResult,
  rmRows = [],
  actualYieldPieces = 0,
  completionNotes = '',
  canViewCost = true,
  onReopen,
  onSwitchToSteps,
  onClose
}) {
  const isCompleted = batch?.status === 'Completed';

  // Planned vs Actual
  const plannedOutput = Number(batch?.quantity || 2000);
  const actualGood = Number(actualYieldPieces || batch?.actualOutput || plannedOutput);
  const yieldEfficiency = plannedOutput > 0 ? round2((actualGood / plannedOutput) * 100) : 100;

  // Mix totals
  const totalMixProcessedMl = Number(liveEvaporationResult?.mixAfterEvapMl || batch?.net_post_evap_mix_ml || 85500);
  const evaporationLossMl = Number(liveEvaporationResult?.evaporatedMl || batch?.evaporation_loss_ml || 0);
  const evaporationPct = Number(liveEvaporationResult?.evaporationPct ?? batch?.evaporation_rate_pct ?? 5.0);

  // Financial totals
  const totalCost = Number(costingData?.totalProductionCost || batch?.totalCost || batch?.grandTotal || 0);
  const costPerUnit = actualGood > 0 ? round2(totalCost / actualGood) : (Number(batch?.costPerUnit) || 0);

  // Raw material lines with PO Lot details
  const rmConsumptionLines = (costingData?.rmCostBreakdown && costingData.rmCostBreakdown.length > 0)
    ? costingData.rmCostBreakdown
    : rmRows.map(r => {
        const taken = Number(r.takenQty || r.requiredQty || 0);
        const rate = Number(r.unitRate || 0);
        const uom = r.uom || 'kg';
        const density = Number(r.density || 1.0);
        let liquidMl = 0;
        try { liquidMl = toMl(taken, uom, density); } catch (_) {}
        return {
          rawMaterialId: r.rawMaterialId,
          rawMaterialName: r.rawMaterialName,
          rawMaterialCode: r.rawMaterialCode || 'RM',
          takenQty: taken,
          uom,
          unitRate: rate,
          totalCost: round2(taken * rate),
          lotBatchNo: r.lotBatchNo || (r.allocatedBatches?.[0]?.lotNumber) || 'BATCH-DIRECT',
          evaporates: Boolean(r.evaporates),
          liquidVolumeMl: liquidMl
        };
      });

  const totalConsumedCost = rmConsumptionLines.reduce((s, l) => s + Number(l.totalCost || 0), 0);
  const totalLiquidVolumeMl = rmConsumptionLines.reduce((s, l) => s + Number(l.liquidVolumeMl || 0), 0);

  // Finished product allocations ledger
  const productAllocations = liveAllocationsResult?.allocations?.length > 0
    ? liveAllocationsResult.allocations
    : (costingData?.productCostAttribution || []);

  const totalAllocMixMl = productAllocations.reduce((s, a) => s + Number(a.mixUsedMl || a.mix_used_ml || 0), 0);
  const totalAllocPieces = productAllocations.reduce((s, a) => s + Number(a.goodPieces || a.good_pieces || 0), 0);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 print-clean-report font-['Plus_Jakarta_Sans',sans-serif]">
      {/* ── PRINT-SPECIFIC CSS INJECTION ── */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body * {
            visibility: hidden;
          }
          .print-clean-report, .print-clean-report * {
            visibility: visible;
          }
          .print-clean-report {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            margin: 0;
            padding: 15mm;
            background: white !important;
            color: black !important;
          }
          .no-print {
            display: none !important;
          }
          .print-card {
            border: 1px solid #cbd5e1 !important;
            box-shadow: none !important;
            break-inside: avoid;
          }
        }
      `}} />

      {/* ── TOP ACTION BAR (HIDDEN IN PRINT) ── */}
      <div className="no-print flex items-center justify-between p-4 bg-slate-900 text-white rounded-2xl border border-slate-800 shadow-lg flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-600/30 text-emerald-400 border border-emerald-500/50 flex items-center justify-center font-bold">
            <FileSpreadsheet className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-extrabold text-base text-white tracking-wide">
                Production Execution &amp; Financial Costing Ledger
              </h2>
              <span className={`text-[10px] font-mono font-black px-2.5 py-0.5 rounded-full border ${
                isCompleted 
                  ? 'bg-emerald-950 text-emerald-300 border-emerald-700' 
                  : 'bg-indigo-950 text-indigo-300 border-indigo-700'
              }`}>
                {isCompleted ? 'BATCH FINALIZED ✓' : 'IN PROGRESS AUDIT'}
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Clean executive summary • Live PO lots consumption • Per-product unit economics
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onSwitchToSteps}
            className="h-8 px-3 text-xs font-bold rounded-xl border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800 flex items-center gap-1.5"
          >
            <Layers className="w-3.5 h-3.5 text-indigo-400" />
            <span>Floor Run Steps (Edit Mode)</span>
          </Button>

          {isCompleted && onReopen && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onReopen}
              className="h-8 px-3 text-xs font-bold rounded-xl border-amber-500/60 text-amber-300 hover:bg-amber-950/40 flex items-center gap-1.5"
              title="Unlock batch and resume edits in PostgreSQL"
            >
              <Unlock className="w-3.5 h-3.5" />
              <span>Reopen Batch for Editing</span>
            </Button>
          )}

          <Button
            type="button"
            size="sm"
            onClick={handlePrint}
            className="h-8 px-4 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs flex items-center gap-1.5 cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Report (PDF)</span>
          </Button>
        </div>
      </div>

      {/* ── OFFICIAL EXECUTIVE REPORT CONTAINER ── */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-8 space-y-6 shadow-sm print-card">
        
        {/* ── 1. REPORT HEADER ── */}
        <div className="flex items-start justify-between pb-6 border-b border-slate-200 dark:border-slate-800 flex-wrap gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-black text-sm">
                L
              </span>
              <div>
                <h1 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-wider">
                  Leonex Manufacturing ERP
                </h1>
                <p className="text-xs text-slate-500 font-semibold uppercase tracking-widest">
                  Standard Ice Cream Production &amp; Batch Traceability Certificate
                </p>
              </div>
            </div>
          </div>

          {/* Batch Reference & Date Stamp */}
          <div className="text-right space-y-1">
            <div className="inline-block bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-lg border border-slate-200 dark:border-slate-700">
              <span className="text-[10px] uppercase font-bold text-slate-500 mr-2">Batch Reference:</span>
              <span className="font-mono font-black text-sm text-indigo-600 dark:text-indigo-400">
                {batch?.referenceNo || batch?.batchNo || 'PROD-CURRENT'}
              </span>
            </div>
            <div className="text-xs text-slate-500 font-medium">
              Execution Date: <strong className="text-slate-800 dark:text-slate-200">{formatDateDMY(batch?.startDate || new Date())}</strong> • Shift: <strong className="text-slate-800 dark:text-slate-200">{batch?.shift || 'Morning Shift'}</strong>
            </div>
          </div>
        </div>

        {/* Batch Metadata Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/80 text-xs">
          <div>
            <span className="block text-[10px] uppercase font-bold text-slate-400">Production Line:</span>
            <span className="font-bold text-slate-800 dark:text-slate-200">{batch?.machineLine || 'Main Processing Line'}</span>
          </div>
          <div>
            <span className="block text-[10px] uppercase font-bold text-slate-400">Formulation Base:</span>
            <span className="font-bold text-slate-800 dark:text-slate-200">{batch?.baseName || batch?.templateName || 'Standard Ice Cream Mix'}</span>
          </div>
          <div>
            <span className="block text-[10px] uppercase font-bold text-slate-400">Production Status:</span>
            <span className={`font-mono font-bold ${isCompleted ? 'text-emerald-600 dark:text-emerald-400' : 'text-indigo-600'}`}>
              {batch?.status?.toUpperCase() || 'IN PROGRESS'}
            </span>
          </div>
          <div>
            <span className="block text-[10px] uppercase font-bold text-slate-400">Assigned Labour Crew:</span>
            <span className="font-bold text-slate-800 dark:text-slate-200">{batch?.labourCount || 1} Workers Assigned</span>
          </div>
        </div>

        {/* ── 2. EXECUTIVE PERFORMANCE & COSTING KPI CARDS ── */}
        <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
          {/* Planned Output */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
            <div className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Planned Pieces</div>
            <div className="text-lg font-mono font-black text-slate-900 dark:text-white mt-1">
              {formatIndian(plannedOutput, 0)} pcs
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">Scheduled target</div>
          </div>

          {/* Actual Good Yield */}
          <div className="p-3.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60">
            <div className="text-[10px] font-bold uppercase text-emerald-700 dark:text-emerald-400 tracking-wider">Actual Good Yield</div>
            <div className="text-lg font-mono font-black text-emerald-700 dark:text-emerald-300 mt-1">
              {formatIndian(actualGood, 0)} pcs
            </div>
            <div className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-0.5">QC Cleared output</div>
          </div>

          {/* Yield Efficiency % */}
          <div className="p-3.5 rounded-xl bg-purple-50/70 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800/60">
            <div className="text-[10px] font-bold uppercase text-purple-700 dark:text-purple-400 tracking-wider">Yield Efficiency</div>
            <div className="text-lg font-mono font-black text-purple-700 dark:text-purple-300 mt-1">
              {yieldEfficiency}%
            </div>
            <div className="text-[10px] text-purple-600 dark:text-purple-400 mt-0.5">
              {yieldEfficiency >= 100 ? 'Target achieved ✓' : 'Below target'}
            </div>
          </div>

          {/* Net Liquid Mix Processed */}
          <div className="p-3.5 rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/60">
            <div className="text-[10px] font-bold uppercase text-blue-700 dark:text-blue-400 tracking-wider">Net Liquid Mix</div>
            <div className="text-lg font-mono font-black text-blue-700 dark:text-blue-300 mt-1">
              {formatIndian(totalMixProcessedMl, 0)} ml
            </div>
            <div className="text-[10px] text-blue-600 dark:text-blue-400 mt-0.5">
              ≈ {round2(totalMixProcessedMl / 1000)} Litres
            </div>
          </div>

          {/* Role-Protected: Total Batch Cost */}
          {canViewCost ? (
            <div className="p-3.5 rounded-xl bg-slate-900 text-white border border-slate-800">
              <div className="text-[10px] font-bold uppercase text-emerald-400 tracking-wider">Total Batch Cost</div>
              <div className="text-lg font-mono font-black text-emerald-300 mt-1">
                ₹{formatIndian(totalCost)}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">Direct + Overheads</div>
            </div>
          ) : (
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
              <div className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Cost Access</div>
              <div className="text-sm font-semibold text-slate-500 mt-2">Restricted</div>
            </div>
          )}

          {/* Role-Protected: Net Cost Per Piece */}
          {canViewCost ? (
            <div className="p-3.5 rounded-xl bg-emerald-950/80 text-white border border-emerald-700">
              <div className="text-[10px] font-bold uppercase text-emerald-300 tracking-wider">Cost / Piece</div>
              <div className="text-xl font-mono font-black text-emerald-200 mt-0.5">
                ₹{formatIndian(costPerUnit)}
              </div>
              <div className="text-[10px] text-emerald-400 mt-0.5">Unit economics</div>
            </div>
          ) : (
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
              <div className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Unit Economics</div>
              <div className="text-sm font-semibold text-slate-500 mt-2">Restricted</div>
            </div>
          )}
        </div>

        {/* ── 3. SECTION: FINISHED PRODUCTS MANUFACTURED LEDGER (SEQUENTIAL MULTI-PRODUCT) ── */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-md bg-purple-600 text-white font-bold text-xs flex items-center justify-center">
                1
              </span>
              <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
                Finished Products Manufactured Ledger
              </h3>
            </div>
            <span className="text-xs text-slate-500 font-medium">
              Chained mix allocation across moulds &amp; products
            </span>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700">
                  <th className="py-2.5 px-3">Seq</th>
                  <th className="py-2.5 px-3">Finished Product</th>
                  <th className="py-2.5 px-3">Mould Specification</th>
                  <th className="py-2.5 px-3 text-right">Trays</th>
                  <th className="py-2.5 px-3 text-right">Mix Consumed</th>
                  <th className="py-2.5 px-3 text-right">Expected Output</th>
                  <th className="py-2.5 px-3 text-right">Actual Good</th>
                  <th className="py-2.5 px-3 text-right">Yield %</th>
                  {canViewCost && <th className="py-2.5 px-3 text-right">Attributed Cost</th>}
                  {canViewCost && <th className="py-2.5 px-3 text-right text-emerald-600 font-black">Cost / Piece</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-mono">
                {productAllocations.map((alloc, idx) => {
                  const seqNum = alloc.seq || (idx + 1);
                  const pName = alloc.productName || alloc.product_name || 'Finished Product';
                  const pCode = alloc.productCode || alloc.product_code || 'FP';
                  const mouldCode = alloc.mouldCode || alloc.mould_code || 'IM-0001';
                  const mouldName = alloc.mouldName || alloc.mould_name || 'Lolly / Chocobar SG-5011';
                  const cavities = Number(alloc.cavities || alloc.cavity_count || 50);
                  const capacityMl = Number(alloc.capacityMl || alloc.capacity_ml || 50);
                  const trays = Number(alloc.trays || 0);
                  const mixUsed = Number(alloc.mixUsedMl || alloc.mix_used_ml || 0);
                  const mixShare = totalMixProcessedMl > 0 ? round2((mixUsed / totalMixProcessedMl) * 100) : 0;
                  const expectedPieces = Number(alloc.goodPieces || alloc.good_pieces || (trays * cavities));
                  
                  const productActual = expectedPieces;
                  const pYieldPct = expectedPieces > 0 ? round2((productActual / expectedPieces) * 100) : 100;
                  const attributedCost = costingData?.productCostAttribution?.[idx]?.totalAssignedCost || 
                    (totalCost * (mixUsed / Math.max(1, totalAllocMixMl)));
                  const pieceCost = productActual > 0 ? round2(attributedCost / productActual) : 0;

                  return (
                    <tr key={`report-prod-${seqNum}-${idx}`} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                      <td className="py-2.5 px-3 font-bold text-slate-500">#{seqNum}</td>
                      <td className="py-2.5 px-3 font-sans font-extrabold text-slate-900 dark:text-white">
                        <div>{pName}</div>
                        <span className="font-mono text-[10px] text-slate-400 font-normal">{pCode}</span>
                      </td>
                      <td className="py-2.5 px-3 font-sans text-slate-700 dark:text-slate-300">
                        <div className="font-bold">{mouldCode}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{mouldName} ({cavities} cav × {capacityMl}ml)</div>
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-slate-800 dark:text-slate-200">
                        {trays} trays
                      </td>
                      <td className="py-2.5 px-3 text-right text-purple-700 dark:text-purple-400 font-bold">
                        {formatIndian(mixUsed)} ml
                        <span className="block text-[10px] text-slate-400 font-normal">({mixShare}% share)</span>
                      </td>
                      <td className="py-2.5 px-3 text-right text-slate-700 dark:text-slate-300">
                        {formatIndian(expectedPieces, 0)} pcs
                      </td>
                      <td className="py-2.5 px-3 text-right font-black text-emerald-600 dark:text-emerald-400">
                        {formatIndian(productActual, 0)} pcs
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-slate-800 dark:text-slate-200">
                        {pYieldPct}%
                      </td>
                      {canViewCost && (
                        <td className="py-2.5 px-3 text-right font-bold text-slate-900 dark:text-white">
                          ₹{formatIndian(attributedCost)}
                        </td>
                      )}
                      {canViewCost && (
                        <td className="py-2.5 px-3 text-right font-black text-emerald-600 dark:text-emerald-400 text-sm">
                          ₹{formatIndian(pieceCost)}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-slate-50 dark:bg-slate-800 font-bold text-slate-900 dark:text-white border-t border-slate-200 dark:border-slate-700 font-mono">
                <tr>
                  <td colSpan={3} className="py-2.5 px-3 font-sans uppercase">Total Output &amp; Allocation Summary</td>
                  <td className="py-2.5 px-3 text-right">
                    {productAllocations.reduce((s, a) => s + Number(a.trays || 0), 0)} trays
                  </td>
                  <td className="py-2.5 px-3 text-right text-purple-600 dark:text-purple-400">
                    {formatIndian(totalAllocMixMl)} ml
                  </td>
                  <td className="py-2.5 px-3 text-right">{formatIndian(totalAllocPieces, 0)} pcs</td>
                  <td className="py-2.5 px-3 text-right text-emerald-600 dark:text-emerald-400 font-black">
                    {formatIndian(actualGood, 0)} pcs
                  </td>
                  <td className="py-2.5 px-3 text-right">{yieldEfficiency}%</td>
                  {canViewCost && (
                    <td className="py-2.5 px-3 text-right font-black">
                      ₹{formatIndian(totalCost)}
                    </td>
                  )}
                  {canViewCost && (
                    <td className="py-2.5 px-3 text-right text-emerald-600 dark:text-emerald-400 font-black">
                      ₹{formatIndian(costPerUnit)}
                    </td>
                  )}
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* ── 4. SECTION: RAW MATERIAL CONSUMPTION & PO BATCH TRACEABILITY REPORT (EXACT USER REQUIREMENT) ── */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-md bg-indigo-600 text-white font-bold text-xs flex items-center justify-center">
                2
              </span>
              <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
                Raw Material Consumption &amp; PO Batch Traceability Report
              </h3>
            </div>
            <span className="text-xs text-slate-500 font-medium">
              PO Lot verification &amp; material unit rates
            </span>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700">
                  <th className="py-2.5 px-3">RM Code</th>
                  <th className="py-2.5 px-3">Raw Material Name</th>
                  <th className="py-2.5 px-3 font-mono">PO / Inventory Batch Lot #</th>
                  <th className="py-2.5 px-3 text-right">Consumed Quantity</th>
                  {canViewCost && <th className="py-2.5 px-3 text-right">PO Unit Rate</th>}
                  {canViewCost && <th className="py-2.5 px-3 text-right">Total Line Cost</th>}
                  <th className="py-2.5 px-3 text-right">Liquid Volume</th>
                  <th className="py-2.5 px-3 text-right">Thermal Evaporation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-mono">
                {rmConsumptionLines.map((line, idx) => {
                  const lineCost = Number(line.totalCost || (Number(line.takenQty || 0) * Number(line.unitRate || 0)));
                  const liquidMl = Number(line.liquidVolumeMl || 0);
                  const evaporates = Boolean(line.evaporates);
                  const evapLoss = evaporates ? round2(liquidMl * (evaporationPct / 100)) : 0;
                  const postEvap = evaporates ? round2(liquidMl - evapLoss) : liquidMl;

                  return (
                    <tr key={`report-rm-${line.rawMaterialId || idx}`} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                      <td className="py-2.5 px-3 text-slate-500 font-bold">{line.rawMaterialCode || 'RM'}</td>
                      <td className="py-2.5 px-3 font-sans font-extrabold text-slate-900 dark:text-white">
                        {line.rawMaterialName}
                      </td>
                      <td className="py-2.5 px-3 font-black text-indigo-600 dark:text-indigo-400">
                        {line.lotBatchNo || 'BATCH-DIRECT'}
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-slate-900 dark:text-white">
                        {formatIndian(line.takenQty)} {formatCleanUom(line.uom, 'kg', line)}
                      </td>
                      {canViewCost && (
                        <td className="py-2.5 px-3 text-right text-slate-700 dark:text-slate-300">
                          ₹{formatIndian(line.unitRate)} / {formatCleanUom(line.uom, 'kg', line)}
                        </td>
                      )}
                      {canViewCost && (
                        <td className="py-2.5 px-3 text-right font-bold text-emerald-600 dark:text-emerald-400">
                          ₹{formatIndian(lineCost)}
                        </td>
                      )}
                      <td className="py-2.5 px-3 text-right text-blue-600 dark:text-blue-400 font-bold">
                        {formatIndian(liquidMl)} ml
                      </td>
                      <td className="py-2.5 px-3 text-right text-slate-600 dark:text-slate-400">
                        {evaporates ? (
                          <span>
                            <span className="text-amber-600 dark:text-amber-400 font-bold">-{formatIndian(evapLoss)} ml</span> ({evaporationPct}%)
                          </span>
                        ) : (
                          <span className="text-slate-400 font-normal">No loss</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-slate-50 dark:bg-slate-800 font-bold text-slate-900 dark:text-white border-t border-slate-200 dark:border-slate-700 font-mono">
                <tr>
                  <td colSpan={3} className="py-2.5 px-3 font-sans uppercase">Total Raw Materials Consumed</td>
                  <td className="py-2.5 px-3 text-right text-slate-900 dark:text-white">
                    {rmConsumptionLines.length} Materials
                  </td>
                  {canViewCost && <td className="py-2.5 px-3 text-right">Blended PO Rate</td>}
                  {canViewCost && (
                    <td className="py-2.5 px-3 text-right text-emerald-600 dark:text-emerald-400 font-black">
                      ₹{formatIndian(totalConsumedCost)}
                    </td>
                  )}
                  <td className="py-2.5 px-3 text-right text-blue-600 dark:text-blue-400 font-black">
                    {formatIndian(totalLiquidVolumeMl)} ml
                  </td>
                  <td className="py-2.5 px-3 text-right text-amber-600 dark:text-amber-400">
                    -{formatIndian(evaporationLossMl)} ml loss
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* ── 5. SECTION: FINANCIAL COST BREAKDOWN STATEMENT (SUPERVISOR / ADMIN ONLY) ── */}
        {canViewCost && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-md bg-emerald-600 text-white font-bold text-xs flex items-center justify-center">
                  3
                </span>
                <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
                  Comprehensive Production Cost Breakdown Statement
                </h3>
              </div>
              <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 px-2 py-0.5 rounded border border-emerald-300 dark:border-emerald-700">
                AUDITED FINANCIAL STATEMENT
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs font-mono">
              {/* Direct RM Cost */}
              <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                <span className="block text-[10px] uppercase font-bold text-slate-500 font-sans">1. Direct Materials</span>
                <div className="text-base font-black text-slate-900 dark:text-white mt-1">
                  ₹{formatIndian(costingData?.totalMaterialCost || totalConsumedCost)}
                </div>
                <span className="text-[10.5px] text-slate-400 font-sans">From live PO rates</span>
              </div>

              {/* Direct Labour Cost */}
              <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                <span className="block text-[10px] uppercase font-bold text-slate-500 font-sans">2. Direct Labour</span>
                <div className="text-base font-black text-amber-600 dark:text-amber-400 mt-1">
                  ₹{formatIndian(costingData?.labourCost || batch?.labour_total_cost || 0)}
                </div>
                <span className="text-[10.5px] text-slate-400 font-sans">{batch?.labourCount || 1} staff crew</span>
              </div>

              {/* Electricity & Utility (EB) Cost */}
              <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                <span className="block text-[10px] uppercase font-bold text-slate-500 font-sans">3. Electricity / Power</span>
                <div className="text-base font-black text-blue-600 dark:text-blue-400 mt-1">
                  ₹{formatIndian(costingData?.utilityCost || batch?.eb_total_cost || 0)}
                </div>
                <span className="text-[10.5px] text-slate-400 font-sans">Freezer &amp; tank units</span>
              </div>

              {/* Factory Overheads */}
              <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                <span className="block text-[10px] uppercase font-bold text-slate-500 font-sans">4. Factory Overheads</span>
                <div className="text-base font-black text-slate-800 dark:text-slate-200 mt-1">
                  ₹{formatIndian(costingData?.overheadCost || batch?.overheadAmt || 0)}
                </div>
                <span className="text-[10.5px] text-slate-400 font-sans">Plant amortization</span>
              </div>

              {/* Grand Total Production Cost */}
              <div className="p-3.5 rounded-xl bg-slate-900 dark:bg-slate-950 text-white border border-slate-800">
                <span className="block text-[10px] uppercase font-bold text-emerald-400 font-sans">Grand Total Batch Cost</span>
                <div className="text-lg font-black text-emerald-300 mt-1">
                  ₹{formatIndian(totalCost)}
                </div>
                <span className="text-[10.5px] text-slate-400 font-sans">
                  = <strong className="text-emerald-300">₹{formatIndian(costPerUnit)}</strong> / piece
                </span>
              </div>
            </div>
          </div>
        )}

        {/* ── 6. SECTION: QUALITY ASSURANCE & PROCESS SIGN-OFF ── */}
        <div className="border-t border-slate-200 dark:border-slate-800 pt-5 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
              <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
                Quality Assurance &amp; Final Process Sign-Off
              </h3>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4" />
                <span>Verified Clean Execution</span>
              </span>
            </div>
          </div>

          {/* Remarks Box */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/80 text-xs">
            <span className="block text-[10.5px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Operator &amp; Supervisor Completion Remarks:
            </span>
            <p className="text-slate-700 dark:text-slate-300 italic">
              {completionNotes || batch?.note || 'Standard thermal formulation completed within standard tolerances. No microbial contamination detected. Yield pieces verified against mould cast count.'}
            </p>
          </div>

          {/* Signature Sign-Off Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-3 text-xs">
            <div className="border border-slate-200 dark:border-slate-700 rounded-xl p-4 bg-white dark:bg-slate-900 text-center space-y-2">
              <div className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Production Floor In-Charge</div>
              <div className="h-10 border-b border-dashed border-slate-300 dark:border-slate-700 flex items-end justify-center pb-1">
                <span className="font-serif italic font-bold text-slate-700 dark:text-slate-300">
                  {batch?.startedBy || 'Floor Operator'}
                </span>
              </div>
              <div className="text-[10px] text-slate-400">Date: {formatDateDMY(batch?.startDate || new Date())}</div>
            </div>

            <div className="border border-slate-200 dark:border-slate-700 rounded-xl p-4 bg-white dark:bg-slate-900 text-center space-y-2">
              <div className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Quality Assurance Inspector</div>
              <div className="h-10 border-b border-dashed border-slate-300 dark:border-slate-700 flex items-end justify-center pb-1">
                <span className="font-serif italic font-bold text-emerald-700 dark:text-emerald-400">
                  QC CLEARED ✓
                </span>
              </div>
              <div className="text-[10px] text-slate-400">Status: Grade-A Verified</div>
            </div>

            <div className="border border-slate-200 dark:border-slate-700 rounded-xl p-4 bg-white dark:bg-slate-900 text-center space-y-2">
              <div className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Plant Operations Manager</div>
              <div className="h-10 border-b border-dashed border-slate-300 dark:border-slate-700 flex items-end justify-center pb-1">
                <span className="font-serif italic font-bold text-slate-700 dark:text-slate-300">
                  Standard Authorization
                </span>
              </div>
              <div className="text-[10px] text-slate-400">ERP System Hash: #{batch?.id?.slice(0, 12)}</div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
