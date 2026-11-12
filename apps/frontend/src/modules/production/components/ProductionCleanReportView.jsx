import { useState, useEffect, useMemo } from 'react';
import {
  Printer, Unlock, CheckCircle2,
  Layers, Factory, FileSpreadsheet, ShieldCheck, Boxes,
  Calendar, Flame, Zap, MapPin, Edit3, Download, CalendarDays, Clock, AlertTriangle, Users
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/axios';
import Swal from 'sweetalert2';
import { round2, formatIndian, toMl, formatCleanUom } from '../utils/productionCalculation';
import { exportCleanSheetPdf } from '../utils/cleanSheetPdfGenerator';

const formatDateDMY = (dateVal, fallback = '—') => {
  if (!dateVal) return fallback;
  try {
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) {
      const s = String(dateVal).split('T')[0];
      const parts = s.split('-');
      if (parts.length === 3 && parts[0].length === 4) {
        return `${parts[2]}-${parts[1]}-${parts[0]}`;
      }
      return s || fallback;
    }
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
  } catch {
    return fallback;
  }
};

const getExpiryBadge = (expiryVal) => {
  if (!expiryVal) return { label: '—', cls: 'text-slate-400' };
  const formatted = formatDateDMY(expiryVal, '—');
  const dt = new Date(expiryVal);
  if (isNaN(dt.getTime())) return { label: formatted, cls: 'text-slate-600 dark:text-slate-300' };
  const diffDays = Math.ceil((dt.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return { label: `${formatted} (Exp)`, cls: 'text-rose-600 dark:text-rose-400 font-bold' };
  if (diffDays <= 30) return { label: `${formatted} (${diffDays}d)`, cls: 'text-amber-600 dark:text-amber-400 font-bold' };
  return { label: formatted, cls: 'text-emerald-700 dark:text-emerald-400 font-semibold' };
};

const formatStageDuration = (stages = []) => {
  if (!Array.isArray(stages) || stages.length === 0) return '0h 0m';
  const totalMin = stages.reduce((s, st) => s + (Number(st.durationHours || 0) * 60) + Number(st.durationMinutes || 0), 0);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${h}h ${m}m`;
};

export default function ProductionCleanReportView({
  batch,
  costingData,
  allocations = [],
  productStagesMap = {},
  liveAllocationsResult,
  liveEvaporationResult,
  rmRows = [],
  actualYieldPieces = 0,
  completionNotes = '',
  timelineStages = [],
  labTestRequired = false,
  canViewCost = true,
  companyDetails = null,
  daysHistory = null,
  onEditDayCosts = null,
  onRefreshBatch = null,
  onReopen,
  onSwitchToSteps
}) {
  const isCompleted = batch?.status === 'Completed' || batch?.status === 'qc_passed' || batch?.status === 'COMPLETED' || Boolean(batch?.isFinalized || batch?.is_finalized);
  const productUom = batch?.product?.unit?.abbreviation || batch?.product?.uom || 'pcs';

  // Multi-day ledger (from props or batch details)
  const rawDays = useMemo(() => (
    (Array.isArray(daysHistory) && daysHistory.length > 0)
      ? daysHistory
      : (Array.isArray(batch?.days) ? batch.days : [])
  ), [daysHistory, batch]);

  // Day/Date Scope Filter ('ALL' shows entire batch clean sheet; numeric selects a specific production Day)
  const [selectedReportDayNo, setSelectedReportDayNo] = useState('ALL');
  const [standaloneEditDay, setStandaloneEditDay] = useState(null);
  const [savingStandaloneEdit, setSavingStandaloneEdit] = useState(false);

  // Live company settings
  const [fetchedCompany, setFetchedCompany] = useState(null);
  const liveCompany = companyDetails || batch?.companyDetails || fetchedCompany;
  useEffect(() => {
    if (!companyDetails && !batch?.companyDetails && !fetchedCompany) {
      api.get('/setup/tax')
        .then(res => {
          if (res.data?.data) setFetchedCompany(res.data.data);
          else if (res.data) setFetchedCompany(res.data);
        })
        .catch(() => {});
    }
  }, [companyDetails, batch?.companyDetails, fetchedCompany]);

  const handleOpenReportDayCostEdit = (dayObj) => {
    if (onEditDayCosts && dayObj.id) {
      onEditDayCosts(dayObj);
      return;
    }
    setStandaloneEditDay({
      dayId: dayObj.id,
      dayNo: dayObj.dayNo,
      dayLabel: dayObj.dayLabel || `Day ${dayObj.dayNo}`,
      dayBatchCode: dayObj.dayBatchCode,
      ebStartReading: dayObj.ebStartReading !== null && dayObj.ebStartReading !== undefined ? String(dayObj.ebStartReading) : '',
      ebEndReading: dayObj.ebEndReading !== null && dayObj.ebEndReading !== undefined ? String(dayObj.ebEndReading) : '',
      ebUnitsKwh: Number(dayObj.ebUnitsKwh || 0),
      ebRatePerUnit: Number(dayObj.ebRatePerUnit || 8.5),
      ebTotalCost: Number(dayObj.ebTotalCost || 0),
      labourTotalCost: Number(dayObj.labourTotalCost || 0),
      overheadAmt: Number(dayObj.overheadAmt || 0),
      outputs: (Array.isArray(dayObj.outputs) ? dayObj.outputs : []).map(o => ({
        ...o,
        labourAllocatedAmt: Number(o.allocatedLabourCost ?? o.labourAllocatedAmt ?? 0)
      }))
    });
  };

  const handleSaveStandaloneDayCostEdit = async () => {
    if (!standaloneEditDay?.dayId || !batch?.id) return;
    try {
      setSavingStandaloneEdit(true);
      const outputLabourOverrides = {};
      (standaloneEditDay.outputs || []).forEach(o => {
        if (o.productId) outputLabourOverrides[o.productId] = Number(o.labourAllocatedAmt || 0);
      });
      await api.put(`/production/standard/${batch.id}/days/${standaloneEditDay.dayId}/costs`, {
        ebStartReading: standaloneEditDay.ebStartReading !== '' ? Number(standaloneEditDay.ebStartReading) : null,
        ebEndReading: standaloneEditDay.ebEndReading !== '' ? Number(standaloneEditDay.ebEndReading) : null,
        ebUnitsKwh: Number(standaloneEditDay.ebUnitsKwh || 0),
        ebRatePerUnit: Number(standaloneEditDay.ebRatePerUnit || 8.5),
        ebTotalCost: Number(standaloneEditDay.ebTotalCost || 0),
        labourTotalCost: Number(standaloneEditDay.labourTotalCost || 0),
        overheadAmt: Number(standaloneEditDay.overheadAmt || 0),
        outputLabourOverrides
      });
      Swal.fire({
        title: `Day ${standaloneEditDay.dayNo} Costs Updated!`,
        text: 'Operational costs and unit costs recalculated cleanly.',
        icon: 'success',
        timer: 1600
      });
      setStandaloneEditDay(null);
      if (onRefreshBatch) await onRefreshBatch();
    } catch (err) {
      Swal.fire({ title: 'Error', text: err.response?.data?.error || 'Failed to update day operational costs.', icon: 'error' });
    } finally {
      setSavingStandaloneEdit(false);
    }
  };

  // ── NORMALIZE BASE RAW MATERIAL LINES (WITH LOT BATCH NO, QTY & EXPIRY DATE) ──
  const baseRmLines = useMemo(() => {
    const breakdownMap = new Map();
    if (Array.isArray(costingData?.rmCostBreakdown)) {
      costingData.rmCostBreakdown.forEach(item => {
        if (item.rawMaterialId) breakdownMap.set(item.rawMaterialId, item);
      });
    }

    const fromRows = (Array.isArray(rmRows) ? rmRows : [])
      .map(r => {
        const rmId = r.rawMaterialId || r.id;
        const bk = breakdownMap.get(rmId) || {};
        const taken = Number(r.takenQty ?? r.taken_qty ?? r.requiredQty ?? r.required_qty ?? bk.takenQty ?? 0);
        const rate = Number(r.unitRate ?? r.rate_per_unit ?? bk.unitRate ?? 0);
        const uom = r.uom || bk.uom || 'kg';
        const density = Number(r.density || 1.0);
        let liquidMl;
        try { liquidMl = toMl(taken, uom, density); } catch { liquidMl = Number(bk.liquidVolumeMl || 0); }

        const lotsRaw = (Array.isArray(r.allocatedBatches) && r.allocatedBatches.length > 0)
          ? r.allocatedBatches
          : (Array.isArray(bk.allocatedBatches) ? bk.allocatedBatches : []);

        const lots = lotsRaw.map(ab => ({
          batchId: ab.batchId || ab.inventoryBatchId || ab.lotNumber,
          lotNumber: ab.lotNumber || ab.internalBatchNo || r.lotBatchNo || bk.lotBatchNo || 'BATCH-DIRECT',
          allocatedQty: Number(ab.allocatedQty || 0),
          uom: ab.uom || uom,
          unitRate: Number(ab.unitRate ?? rate),
          totalCost: round2(Number(ab.allocatedQty || 0) * Number(ab.unitRate ?? rate)),
          expiryDate: ab.expiryDate || r.expiryDate || bk.expiryDate || null,
          poNumber: ab.poNumber || 'PO-DIRECT',
          grnNumber: ab.grnNumber || 'GRN-DIRECT'
        }));

        const lotBatchNo = lots.length > 0
          ? lots.map(l => l.lotNumber).filter(Boolean).join(', ')
          : (r.lotBatchNo || r.lot_batch_no || bk.lotBatchNo || 'BATCH-DIRECT');
        const expiryDate = r.expiryDate || lots.find(l => l.expiryDate)?.expiryDate || bk.expiryDate || null;

        return {
          rawMaterialId: rmId,
          rawMaterialName: r.rawMaterialName || r.name || bk.rawMaterialName || 'Raw Material',
          rawMaterialCode: r.rawMaterialCode || r.code || bk.rawMaterialCode || 'RM',
          takenQty: taken,
          uom,
          unitRate: rate,
          totalCost: round2(taken * rate),
          lotBatchNo,
          expiryDate,
          lots,
          evaporates: Boolean(r.evaporates ?? bk.evaporates),
          liquidVolumeMl: liquidMl,
          hasAlternateUom: r.hasAlternateUom,
          alternateUom: r.alternateUom,
          conversionFactor: r.conversionFactor,
          consumptionUnit: r.consumptionUnit
        };
      })
      .filter(l => Number(l.takenQty || 0) > 0);

    if (fromRows.length > 0) return fromRows;

    if (Array.isArray(costingData?.rmCostBreakdown) && costingData.rmCostBreakdown.length > 0) {
      return costingData.rmCostBreakdown
        .filter(l => Number(l.takenQty || 0) > 0)
        .map(l => ({
          ...l,
          lots: Array.isArray(l.allocatedBatches) ? l.allocatedBatches : [],
          expiryDate: l.expiryDate || l.allocatedBatches?.find(ab => ab.expiryDate)?.expiryDate || null
        }));
    }
    return [];
  }, [rmRows, costingData]);

  const totalBaseConsumedCost = useMemo(
    () => round2(baseRmLines.reduce((s, l) => s + Number(l.totalCost || 0), 0)),
    [baseRmLines]
  );
  const totalBaseLiquidVolumeMl = useMemo(
    () => round2(baseRmLines.reduce((s, l) => s + Number(l.liquidVolumeMl || 0), 0)),
    [baseRmLines]
  );

  // Mix / Evaporation Math (real numbers, zero fake hardcoded fallbacks)
  const netPostEvapMixMl = Number(
    liveEvaporationResult?.mixAfterEvapMl ??
    batch?.net_post_evap_mix_ml ??
    batch?.mix_after_evap_ml ??
    batch?.merged_pre_evap_ml ??
    0
  );
  const evaporationLossMl = Number(
    liveEvaporationResult?.evaporatedMl ??
    batch?.evaporation_loss_ml ??
    batch?.evaporated_ml ??
    0
  );
  const evaporationPct = Number(
    liveEvaporationResult?.evaporationPct ??
    batch?.evaporation_rate_pct ??
    batch?.evaporation_pct ??
    0
  );
  const mergeStageName = liveEvaporationResult?.mergeStage || batch?.merge_stage || batch?.evaporationData?.mergeStage || 'After heating';
  const totalBeforeEvapMl = Number(
    liveEvaporationResult?.totalBeforeEvapMl ||
    (netPostEvapMixMl + evaporationLossMl) ||
    totalBaseLiquidVolumeMl ||
    0
  );

  // ── NORMALIZE DAY-WISE EXECUTION ENTRIES ──
  const normalizedDays = useMemo(() => {
    if (rawDays.length > 0) {
      return rawDays.map(d => {
        const outs = Array.isArray(d.outputs) ? d.outputs : [];
        const dayAllocMl = Number(d.allocatedMixMl || outs.reduce((s, o) => s + Number(o.allocatedBaseMl || 0), 0));
        const dayExpected = outs.reduce((s, o) => s + Number(o.theoreticalQty || o.actualYield || 0), 0);
        const dayActual = Number(d.totalOutputQty || outs.reduce((s, o) => s + Number(o.actualYield || 0), 0));
        const dayRejected = Number(d.totalRejectedQty || outs.reduce((s, o) => s + Number(o.rejectOutput || 0), 0));
        const dStages = Array.isArray(d.timelineStages) && d.timelineStages.length > 0 ? d.timelineStages : timelineStages;
        const enrichedOuts = outs.map(o => {
          const exp = Number(o.theoreticalQty || o.actualYield || 0);
          const act = Number(o.actualYield || 0);
          const rej = Number(o.rejectOutput || 0);
          const yPct = exp > 0 ? round2((act / exp) * 100) : (act > 0 ? 100 : 0);
          const uCost = Number(o.unitCost || (act > 0 ? round2(Number(o.totalCost || 0) / act) : 0));
          return {
            ...o,
            theoreticalQty: exp,
            actualYield: act,
            rejectOutput: rej,
            yieldPct: yPct,
            unitCost: uCost,
            ebAllocatedAmt: Number(o.allocatedEbCost ?? o.ebAllocatedAmt ?? 0),
            labourAllocatedAmt: Number(o.allocatedLabourCost ?? o.labourAllocatedAmt ?? 0),
            productRms: Array.isArray(o.productRms) ? o.productRms : []
          };
        });
        return {
          ...d,
          outputs: enrichedOuts,
          assignedUsers: Array.isArray(d.assignedUsers) ? d.assignedUsers : [],
          allocatedMixMl: dayAllocMl,
          totalExpectedQty: dayExpected,
          totalOutputQty: dayActual,
          totalRejectedQty: dayRejected,
          timelineStages: dStages,
          durationText: formatStageDuration(dStages),
          statusLabel: d.pushedToSales
            ? 'Pushed to Sales'
            : (d.qcStatus === 'PENDING' ? 'QC Hold' : (d.status || 'COMPLETED'))
        };
      });
    }

    // Legacy single-day batch synthesis when production_batch_days is absent
    const fallbackAllocs = (Array.isArray(allocations) && allocations.length > 0)
      ? allocations
      : (liveAllocationsResult?.allocations || []);
    const synthesizedOutputs = fallbackAllocs.map((a, idx) => {
      const act = Number(a.actualYield ?? a.goodPieces ?? a.good_pieces ?? 0);
      const exp = Number(a.goodPieces ?? a.good_pieces ?? act);
      const rej = Number(a.rejectOutput || 0);
      const mix = Number(a.allocatedBaseMl ?? a.mixUsedMl ?? a.mix_used_ml ?? 0);
      const attr = costingData?.productCostAttribution?.[idx] || {};
      const tot = Number(attr.totalAssignedCost || 0);
      return {
        id: `legacy-out-${idx}`,
        seq: a.seq || idx + 1,
        productId: a.productId || a.product_id,
        productName: a.productName || a.product_name || 'Finished Product',
        productCode: a.productCode || a.product_code || 'FP',
        uom: a.productUom || a.product_unit || 'pcs',
        useMould: a.useMould !== undefined ? Boolean(a.useMould) : Boolean(a.mouldCode || a.mould_code),
        mouldCode: a.mouldCode || a.mould_code || '',
        mouldName: a.mouldName || a.mould_name || '',
        cavities: Number(a.cavities || 1),
        capacityMl: Number(a.capacityMl || a.capacity_ml || 0),
        trays: Number(a.trays || 0),
        bulkUom: a.bulkUom || 'L',
        allocatedBaseMl: mix,
        wasteMl: Number(a.wasteMl || a.waste_ml || 0),
        theoreticalQty: exp,
        actualYield: act,
        rejectOutput: rej,
        yieldPct: exp > 0 ? round2((act / exp) * 100) : (act > 0 ? 100 : 0),
        productBatchNo: a.productBatchNo || batch?.shortBatchCode || '',
        productSerialNo: a.productSerialNo || '',
        productRms: Array.isArray(a.productRms) ? a.productRms : [],
        allocatedEbCost: Number(attr.assignedUtilityCost || 0),
        allocatedLabourCost: Number(attr.assignedLabourCost || 0),
        ebAllocatedAmt: Number(attr.assignedUtilityCost || 0),
        labourAllocatedAmt: Number(attr.assignedLabourCost || 0),
        totalCost: tot,
        unitCost: Number(attr.costPerPiece || (act > 0 ? round2(tot / act) : 0))
      };
    });
    const sumMix = synthesizedOutputs.reduce((s, o) => s + o.allocatedBaseMl, 0);
    const sumAct = Number(actualYieldPieces || synthesizedOutputs.reduce((s, o) => s + o.actualYield, 0) || batch?.actualOutput || 0);
    const sumExp = synthesizedOutputs.reduce((s, o) => s + o.theoreticalQty, 0);
    const sumRej = synthesizedOutputs.reduce((s, o) => s + o.rejectOutput, 0);

    const resolvedLegacyStages = (timelineStages && timelineStages.length > 0)
      ? timelineStages
      : Object.values(productStagesMap || {}).flat().filter(Boolean);

    return [{
      id: null,
      dayNo: 1,
      dayLabel: 'Day 1',
      productionDate: batch?.startDate || batch?.start_date || new Date().toISOString(),
      dayBatchCode: batch?.shortBatchCode || batch?.short_batch_code || '—',
      status: isCompleted ? 'COMPLETED' : 'IN_PROGRESS',
      statusLabel: isCompleted ? (labTestRequired ? 'QC Hold' : 'Completed') : 'In Progress',
      openingMixMl: netPostEvapMixMl,
      allocatedMixMl: sumMix,
      wasteMl: synthesizedOutputs.reduce((s, o) => s + o.wasteMl, 0),
      remainingMixMl: Math.max(0, round2(netPostEvapMixMl - sumMix)),
      totalExpectedQty: sumExp,
      totalOutputQty: sumAct,
      totalRejectedQty: sumRej,
      ebTotalCost: Number(costingData?.utilityCost ?? batch?.eb_total_cost ?? batch?.ebTotalCost ?? 0),
      labourTotalCost: Number(costingData?.labourCost ?? batch?.labour_total_cost ?? batch?.labourTotalCost ?? 0),
      overheadAmt: Number(costingData?.overheadCost ?? batch?.overhead_amt ?? batch?.overheadAmt ?? 0),
      assignedUsers: Array.isArray(batch?.assignedUsers) ? batch.assignedUsers : [],
      timelineStages: resolvedLegacyStages,
      durationText: formatStageDuration(resolvedLegacyStages),
      outputs: synthesizedOutputs
    }];
  }, [rawDays, allocations, liveAllocationsResult, costingData, actualYieldPieces, batch, isCompleted, labTestRequired, netPostEvapMixMl, timelineStages, productStagesMap]);

  const scopedDays = useMemo(() => (
    selectedReportDayNo === 'ALL'
      ? normalizedDays
      : normalizedDays.filter(d => Number(d.dayNo) === Number(selectedReportDayNo))
  ), [normalizedDays, selectedReportDayNo]);

  // ── AGGREGATE METRICS FOR CURRENT SCOPE (ALL DAYS OR SINGLE DAY) ──
  const completedScopeDays = scopedDays.filter(d => d.status !== 'IN_PROGRESS');
  const activeScopeForTotals = completedScopeDays.length > 0 ? completedScopeDays : scopedDays;

  const totalAllocatedMixMl = round2(activeScopeForTotals.reduce((s, d) => s + Number(d.allocatedMixMl || 0), 0));
  const totalWasteMixMl = round2(activeScopeForTotals.reduce((s, d) => s + Number(d.wasteMl || 0), 0));
  const totalAllDaysAllocatedMl = round2(
    normalizedDays.filter(d => d.status !== 'IN_PROGRESS').reduce((s, d) => s + Number(d.allocatedMixMl || 0), 0) ||
    normalizedDays.reduce((s, d) => s + Number(d.allocatedMixMl || 0), 0)
  );
  const remainingTankMixMl = Math.max(0, round2(netPostEvapMixMl - totalAllDaysAllocatedMl));

  const plannedOutput = Number(batch?.quantity || 0);
  const totalExpectedOutput = activeScopeForTotals.reduce((s, d) => s + Number(d.totalExpectedQty || 0), 0) || plannedOutput;
  const actualGood = activeScopeForTotals.reduce((s, d) => s + Number(d.totalOutputQty || 0), 0);
  const totalRejected = activeScopeForTotals.reduce((s, d) => s + Number(d.totalRejectedQty || 0), 0);
  const yieldEfficiency = (selectedReportDayNo === 'ALL' ? plannedOutput : totalExpectedOutput) > 0
    ? round2((actualGood / (selectedReportDayNo === 'ALL' ? plannedOutput : totalExpectedOutput)) * 100)
    : (actualGood > 0 ? 100 : 0);

  // Financials across scoped days
  const directLabourCost = round2(activeScopeForTotals.reduce((s, d) => s + Number(d.labourTotalCost || 0), 0)) || Number(costingData?.labourCost || 0);
  const electricityCost = round2(activeScopeForTotals.reduce((s, d) => s + Number(d.ebTotalCost || 0), 0)) || Number(costingData?.utilityCost || 0);
  const overheadCost = round2(activeScopeForTotals.reduce((s, d) => s + Number(d.overheadAmt || 0), 0)) || Number(costingData?.overheadCost || 0);

  // Product-specific Added RMs cost across scoped days
  const productSpecificRmGroups = useMemo(() => {
    const groups = [];
    scopedDays.forEach(d => {
      (d.outputs || []).forEach((out, oIdx) => {
        const prms = Array.isArray(out.productRms) ? out.productRms : [];
        if (prms.length === 0) return;
        const items = prms.map((prm, pIdx) => {
          const taken = Number(prm.takenQty ?? prm.qty ?? prm.quantity ?? 0);
          const rate = Number(prm.unitRate ?? prm.rate ?? 0);
          const uom = prm.uom || 'pcs';
          const isMix = prm.addToMix !== false;
          const density = Number(prm.density || 1.0);
          let volMl;
          try { volMl = isMix ? toMl(taken, uom, density) : 0; } catch { volMl = 0; }
          const lots = Array.isArray(prm.allocatedBatches) ? prm.allocatedBatches : [];
          const lotBatchNo = lots.length > 0
            ? lots.map(l => l.lotNumber || l.internalBatchNo).filter(Boolean).join(', ')
            : (prm.lotBatchNo || 'BATCH-DIRECT');
          const expiryDate = prm.expiryDate || lots.find(l => l.expiryDate)?.expiryDate || null;
          return {
            seq: pIdx + 1,
            rmCode: prm.rawMaterialCode || prm.rmCode || `RM-ADD-${pIdx + 1}`,
            rmName: prm.rawMaterialName || prm.rmName || 'Added Ingredient',
            lotBatchNo,
            expiryDate,
            lots,
            takenQty: taken,
            uom,
            unitRate: rate,
            totalCost: Number(prm.totalCost) > 0 ? round2(Number(prm.totalCost)) : round2(taken * rate),
            liquidVolumeMl: volMl,
            isMix,
            purpose: isMix ? 'Liquid Flavour / Addition' : 'Packaging / Assembly'
          };
        });
        groups.push({
          key: `day-${d.dayNo}-out-${out.seq || oIdx}`,
          dayNo: d.dayNo,
          productionDate: d.productionDate,
          dayBatchCode: d.dayBatchCode,
          productName: out.productName,
          productCode: out.productCode || 'FP',
          mouldCode: out.useMould !== false ? (out.mouldCode || 'Standard') : `Bulk (${out.bulkUom || out.uom})`,
          goodPieces: out.actualYield,
          uom: out.uom || 'pcs',
          items,
          totalCost: round2(items.reduce((s, it) => s + it.totalCost, 0))
        });
      });
    });
    return groups;
  }, [scopedDays]);

  const totalAddedRmsCost = round2(productSpecificRmGroups.reduce((s, g) => s + g.totalCost, 0));
  const grandTotalMaterialCost = round2(totalBaseConsumedCost + totalAddedRmsCost);

  // Scoped base RM cost share (100% if viewing All Days; mix-ratio share if filtered to 1 Day)
  const scopedBaseRmCost = selectedReportDayNo === 'ALL'
    ? totalBaseConsumedCost
    : round2(totalBaseConsumedCost * (netPostEvapMixMl > 0 ? Math.min(1, totalAllocatedMixMl / netPostEvapMixMl) : 1));

  const totalCost = round2(
    selectedReportDayNo === 'ALL' && Number(costingData?.totalProductionCost || 0) > 0
      ? Number(costingData.totalProductionCost)
      : (scopedBaseRmCost + totalAddedRmsCost + directLabourCost + electricityCost + overheadCost)
  );
  const costPerUnit = actualGood > 0 ? round2(totalCost / actualGood) : 0;

  // Consolidated Product Yield Summary across scoped days
  const consolidatedYieldRows = useMemo(() => {
    const map = new Map();
    scopedDays.forEach(d => {
      (d.outputs || []).forEach(out => {
        const key = `${out.productId || out.productName}__${out.uom || 'pcs'}`;
        if (!map.has(key)) {
          map.set(key, {
            productId: out.productId,
            productName: out.productName,
            productCode: out.productCode || 'FP',
            uom: out.uom || 'pcs',
            dayNums: new Set(),
            mixUsedMl: 0,
            expectedQty: 0,
            actualGood: 0,
            rejectOutput: 0,
            totalCost: 0
          });
        }
        const entry = map.get(key);
        entry.dayNums.add(`D${d.dayNo}`);
        entry.mixUsedMl = round2(entry.mixUsedMl + Number(out.allocatedBaseMl || 0));
        entry.expectedQty = round2(entry.expectedQty + Number(out.theoreticalQty || 0));
        entry.actualGood = round2(entry.actualGood + Number(out.actualYield || 0));
        entry.rejectOutput = round2(entry.rejectOutput + Number(out.rejectOutput || 0));
        entry.totalCost = round2(entry.totalCost + Number(out.totalCost || 0));
      });
    });
    return Array.from(map.values()).map(r => ({
      ...r,
      daysLabel: Array.from(r.dayNums).join(', '),
      variance: round2(r.actualGood - r.expectedQty),
      yieldPct: r.expectedQty > 0 ? round2((r.actualGood / r.expectedQty) * 100) : (r.actualGood > 0 ? 100 : 0),
      unitCost: r.actualGood > 0 ? round2(r.totalCost / r.actualGood) : 0
    }));
  }, [scopedDays]);

  // Duration calculation (number of production days, date span & total factory stage hours)
  const dayCount = Math.max(1, normalizedDays.length);
  const firstDate = normalizedDays[0]?.productionDate || batch?.startDate || batch?.start_date;
  const lastDate = normalizedDays[normalizedDays.length - 1]?.productionDate || batch?.completedAt || batch?.endDate || firstDate;
  const dateRangeText = firstDate && lastDate && formatDateDMY(firstDate) !== formatDateDMY(lastDate)
    ? `${formatDateDMY(firstDate)} → ${formatDateDMY(lastDate)}`
    : formatDateDMY(firstDate);
  const durationDaysLabel = `${dayCount} Day${dayCount > 1 ? 's' : ''}`;
  const totalProcessDurationText = formatStageDuration(
    normalizedDays.flatMap(d => (Array.isArray(d.timelineStages) ? d.timelineStages : []))
  );

  // Day short batch codes list
  const allBatchCodes = Array.from(
    new Set([batch?.shortBatchCode, ...normalizedDays.map(d => d.dayBatchCode)].filter(Boolean))
  ).join(', ') || '—';

  const triggerPdfDownload = (pdfMode = 'full', forceDayNo = null) => {
    const targetDay = forceDayNo !== null
      ? Number(forceDayNo)
      : (selectedReportDayNo === 'ALL' ? null : Number(selectedReportDayNo));
    exportCleanSheetPdf({
      mode: pdfMode,
      targetDayNo: targetDay,
      companyDetails: liveCompany,
      batch,
      summary: {
        statusText: isCompleted ? (labTestRequired ? 'QC LAB HOLD' : 'COMPLETED') : (batch?.status || 'IN PROGRESS'),
        durationDaysLabel,
        totalProcessDurationText,
        dateRangeText,
        plannedOutput,
        totalExpectedOutput,
        actualGood,
        totalRejected,
        yieldEfficiency,
        productUom,
        totalBeforeEvapMl,
        evaporationLossMl,
        evaporationPct,
        netPostEvapMixMl,
        mergeStageName,
        totalAllocatedMixMl,
        totalWasteMixMl,
        remainingMixBalanceMl: isCompleted ? 0 : remainingTankMixMl,
        totalBaseConsumedCost,
        totalBaseLiquidVolumeMl,
        totalAddedRmsCost,
        totalMaterialCost: grandTotalMaterialCost,
        directLabourCost,
        electricityCost,
        overheadCost,
        totalCost,
        costPerUnit
      },
      baseRmLines,
      dayEntries: normalizedDays,
      yieldRows: consolidatedYieldRows,
      timelineStages,
      canViewCost,
      completionNotes,
      labTestRequired
    });
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-5 print-clean-report font-['Plus_Jakarta_Sans',sans-serif]">
      {/* ── MODAL-SAFE A4 PRINT STYLES ── */}
      <style dangerouslySetInnerHTML={{ __html: `
        @page {
          size: A4 portrait;
          margin: 10mm;
        }
        @media print {
          html, body {
            height: auto !important;
            overflow: visible !important;
            background: white !important;
          }
          body * {
            visibility: hidden !important;
          }
          .fixed.inset-0, .overflow-y-auto, .overflow-hidden {
            position: static !important;
            overflow: visible !important;
            height: auto !important;
            max-height: none !important;
            width: 100% !important;
          }
          .print-clean-report, .print-clean-report * {
            visibility: visible !important;
            color-adjust: exact !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .print-clean-report {
            position: relative !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
            color: #0f172a !important;
          }
          .no-print {
            display: none !important;
          }
          .print-card {
            border: 1px solid #cbd5e1 !important;
            box-shadow: none !important;
            background: white !important;
          }
          .print-break-avoid {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }
        }
      `}} />

      {/* ── TOP ACTION BAR (HIDDEN IN PRINT) ── */}
      <div className="no-print flex flex-col gap-3 p-4 bg-slate-900 text-white rounded-2xl border border-slate-800 shadow-lg">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600/30 text-emerald-400 border border-emerald-500/50 flex items-center justify-center font-bold">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="font-extrabold text-base text-white tracking-wide">
                  Clean Sheet — Production, Consumption &amp; Yield Report
                </h2>
                <span className={`text-[10px] font-mono font-black px-2.5 py-0.5 rounded-full border ${
                  isCompleted
                    ? 'bg-emerald-950 text-emerald-300 border-emerald-700'
                    : 'bg-indigo-950 text-indigo-300 border-indigo-700'
                }`}>
                  {isCompleted ? 'BATCH FINALIZED ✓' : `${dayCount} DAY${dayCount > 1 ? 'S' : ''} RECORDED`}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Day-wise manufacturing ledger • RM lot batch &amp; expiry traceability • Consolidated yield &amp; cost audit
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onSwitchToSteps}
              className="h-8 px-3 text-xs font-bold rounded-xl border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800 flex items-center gap-1.5 cursor-pointer"
            >
              <Layers className="w-3.5 h-3.5 text-indigo-400" />
              <span>Floor Run Steps</span>
            </Button>

            {isCompleted && onReopen && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onReopen}
                className="h-8 px-3 text-xs font-bold rounded-xl border-amber-500/60 text-amber-300 hover:bg-amber-950/40 flex items-center gap-1.5 cursor-pointer"
                title="Unlock batch and resume edits in PostgreSQL"
              >
                <Unlock className="w-3.5 h-3.5" />
                <span>Reopen Batch</span>
              </Button>
            )}

            <Button
              type="button"
              size="sm"
              onClick={() => triggerPdfDownload('datewise')}
              className="h-8 px-3.5 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs flex items-center gap-1.5 cursor-pointer"
              title="Download structured Date-Wise PDF with Production No, Duration, Product RM Lots & Expiry Dates"
            >
              <CalendarDays className="w-3.5 h-3.5" />
              <span>{selectedReportDayNo === 'ALL' ? 'Date-Wise PDF' : `Day ${selectedReportDayNo} PDF`}</span>
            </Button>

            <Button
              type="button"
              size="sm"
              onClick={() => triggerPdfDownload('full')}
              className="h-8 px-3.5 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs flex items-center gap-1.5 cursor-pointer"
              title="Download Full Clean Sheet PDF"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download Full PDF</span>
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handlePrint}
              className="h-8 px-3 text-xs font-bold rounded-xl border-slate-700 text-slate-200 hover:text-white hover:bg-slate-800 flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print</span>
            </Button>
          </div>
        </div>

        {/* Date / Day Filter Bar */}
        {normalizedDays.length > 0 && (
          <div className="flex items-center gap-1.5 pt-2 border-t border-slate-800 flex-wrap text-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mr-1 flex items-center gap-1">
              <Calendar className="w-3 h-3 text-indigo-400" />
              Report Scope:
            </span>
            <button
              type="button"
              onClick={() => setSelectedReportDayNo('ALL')}
              className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all cursor-pointer border ${
                selectedReportDayNo === 'ALL'
                  ? 'bg-indigo-600 text-white border-indigo-500 shadow-xs'
                  : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:bg-slate-800'
              }`}
            >
              All Days ({dayCount} Day{dayCount > 1 ? 's' : ''} Combined)
            </button>
            {normalizedDays.map(d => (
              <button
                key={`filter-day-${d.dayNo}`}
                type="button"
                onClick={() => setSelectedReportDayNo(d.dayNo)}
                className={`px-2.5 py-1 rounded-lg font-mono font-bold text-[11px] transition-all cursor-pointer border ${
                  Number(selectedReportDayNo) === Number(d.dayNo)
                    ? 'bg-emerald-600 text-white border-emerald-500 shadow-xs'
                    : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:bg-slate-800'
                }`}
              >
                Day {d.dayNo} • {formatDateDMY(d.productionDate)} ({d.dayBatchCode})
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── OFFICIAL EXECUTIVE CLEAN SHEET CONTAINER ── */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-8 space-y-6 shadow-sm print-card">

        {/* ── 1. REPORT HEADER WITH LIVE COMPANY, PRODUCTION NO, BATCH NO & DURATION ── */}
        <div className="flex items-start justify-between pb-5 border-b-2 border-indigo-600/20 flex-wrap gap-4 print-break-avoid">
          <div className="space-y-1.5 max-w-xl">
            <div className="flex items-center gap-2.5">
              <span className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-slate-900 text-white flex items-center justify-center font-black text-base shadow-sm">
                {(liveCompany?.companyName || 'L').slice(0, 1).toUpperCase()}
              </span>
              <div>
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white uppercase tracking-wider leading-tight">
                  {liveCompany?.companyName || 'Leonex Manufacturing ERP'}
                </h1>
                <p className="text-xs text-indigo-600 dark:text-indigo-400 font-bold uppercase tracking-widest">
                  Standard Production Clean Sheet • Consumption, Lot Traceability &amp; Yield Report
                </p>
              </div>
            </div>

            <div className="text-xs text-slate-600 dark:text-slate-400 space-y-0.5 pt-1">
              <div className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="font-medium text-slate-700 dark:text-slate-300">
                  {liveCompany?.companyAddress || 'Factory / Registered Office Address'}
                </span>
              </div>
              <div className="flex items-center gap-3 font-mono text-[11px] flex-wrap text-slate-500">
                <span>GSTIN: <strong className="text-slate-800 dark:text-slate-200">{liveCompany?.companyGstin || liveCompany?.taxRegNo || '—'}</strong></span>
                <span>•</span>
                <span>PAN: <strong className="text-slate-800 dark:text-slate-200">{liveCompany?.companyPan || '—'}</strong></span>
                <span>•</span>
                <span>Mobile: <strong className="text-slate-800 dark:text-slate-200">{liveCompany?.companyMobile || '—'}</strong></span>
                {liveCompany?.email && (
                  <>
                    <span>•</span>
                    <span>Email: <strong className="text-slate-800 dark:text-slate-200">{liveCompany.email}</strong></span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Production No, Batch No & Duration Stamp */}
          <div className="text-right space-y-1.5">
            <div className="inline-flex flex-col items-end bg-slate-900 text-white px-4 py-2 rounded-xl border border-slate-700 shadow-xs">
              <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">Production No / Order Ref</span>
              <span className="font-mono font-black text-base text-emerald-300">
                {batch?.referenceNo || batch?.reference_no || batch?.batchNo || 'PROD-CURRENT'}
              </span>
              <span className="text-[10.5px] font-mono text-indigo-300">
                Batch Codes: <strong className="text-white">{allBatchCodes}</strong>
              </span>
            </div>
            <div className="text-xs text-slate-600 dark:text-slate-300 font-medium flex items-center justify-end gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-bold border border-indigo-200 dark:border-indigo-800">
                <Clock className="w-3 h-3" />
                Duration: {durationDaysLabel} ({totalProcessDurationText})
              </span>
              <span>Date Span: <strong className="font-mono text-slate-800 dark:text-slate-100">{dateRangeText}</strong></span>
            </div>
          </div>
        </div>

        {/* Batch Metadata Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-6 gap-3 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/80 text-xs print-break-avoid">
          <div>
            <span className="block text-[9.5px] uppercase font-bold text-slate-400">Production No</span>
            <span className="font-mono font-black text-slate-900 dark:text-white">{batch?.referenceNo || batch?.batchNo || '—'}</span>
          </div>
          <div>
            <span className="block text-[9.5px] uppercase font-bold text-slate-400">Day Batch Codes</span>
            <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">{allBatchCodes}</span>
          </div>
          <div>
            <span className="block text-[9.5px] uppercase font-bold text-slate-400">Duration (Days)</span>
            <span className="font-bold text-slate-800 dark:text-slate-200">{durationDaysLabel} • {dateRangeText}</span>
          </div>
          <div>
            <span className="block text-[9.5px] uppercase font-bold text-slate-400">Formulation Base</span>
            <span className="font-bold text-slate-800 dark:text-slate-200">{batch?.baseName || batch?.base_name || batch?.templateName || 'Standard Base'}</span>
          </div>
          <div>
            <span className="block text-[9.5px] uppercase font-bold text-slate-400">Line &amp; Shift</span>
            <span className="font-bold text-slate-800 dark:text-slate-200">{batch?.machineLine || batch?.machine_line || 'Main Line'} ({batch?.shift || 'Morning'})</span>
          </div>
          <div>
            <span className="block text-[9.5px] uppercase font-bold text-slate-400">Status / Crew</span>
            <span className={`font-mono font-bold ${isCompleted ? 'text-emerald-600 dark:text-emerald-400' : 'text-indigo-600 dark:text-indigo-400'}`}>
              {isCompleted ? 'COMPLETED' : (batch?.status?.toUpperCase() || 'ACTIVE')} • {batch?.labourCount || batch?.labour_count || 1} Crew
            </span>
          </div>
        </div>

        {/* Date-Wise Production Schedule & Day Team Allocation Roster */}
        {normalizedDays.length > 0 && (
          <div className="p-3 rounded-xl bg-indigo-50/40 dark:bg-indigo-950/20 border border-indigo-200/80 dark:border-indigo-900/50 print-break-avoid">
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-indigo-800 dark:text-indigo-300">
                <CalendarDays className="w-3.5 h-3.5" />
                <span>Date-Wise Production Schedule &amp; Allocated Staff</span>
              </div>
              <span className="text-[10.5px] font-mono font-semibold text-slate-500">
                {normalizedDays.length} Day{normalizedDays.length > 1 ? 's' : ''} Recorded
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {normalizedDays.map(d => {
                const staffList = Array.isArray(d.assignedUsers) ? d.assignedUsers : [];
                return (
                  <div
                    key={`schedule-pill-${d.id || d.dayNo}`}
                    className="flex flex-col gap-1 px-2.5 py-2 rounded-lg bg-white dark:bg-slate-900 border border-indigo-200/70 dark:border-slate-800 text-[11px]"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono font-black text-indigo-700 dark:text-indigo-300">
                        Day {d.dayNo} • {formatDateDMY(d.productionDate)}
                      </span>
                      <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                        Batch: {d.dayBatchCode || '—'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2 text-[10.5px]">
                      <span className="text-slate-600 dark:text-slate-300 truncate flex items-center gap-1">
                        <Users className="w-3 h-3 text-emerald-600 shrink-0" />
                        {staffList.length > 0
                          ? staffList.map(u => `${u.name}${u.empId ? ` (${u.empId})` : ''}`).join(', ')
                          : (d.completedBy || d.startedBy || batch?.startedBy || 'Floor Operator')}
                      </span>
                      <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 shrink-0">
                        {formatIndian(d.totalOutputQty, 0)} {productUom}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── 2. EXECUTIVE PERFORMANCE, OUTPUT & COSTING KPI CARDS ── */}
        <div className="grid grid-cols-2 sm:grid-cols-6 gap-3 print-break-avoid">
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
            <div className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Target Planned</div>
            <div className="text-lg font-mono font-black text-slate-900 dark:text-white mt-1">
              {formatIndian(selectedReportDayNo === 'ALL' ? plannedOutput : totalExpectedOutput, 0)} {productUom}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">
              {selectedReportDayNo === 'ALL' ? 'Order scheduled target' : `Day ${selectedReportDayNo} theoretical`}
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60">
            <div className="text-[10px] font-bold uppercase text-emerald-700 dark:text-emerald-400 tracking-wider">Actual Good Yield</div>
            <div className="text-lg font-mono font-black text-emerald-700 dark:text-emerald-300 mt-1">
              {formatIndian(actualGood, 0)} {productUom}
            </div>
            <div className="text-[10px] text-rose-600 dark:text-rose-400 mt-0.5 font-mono">
              Rejected: {formatIndian(totalRejected, 0)} {productUom}
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-purple-50/80 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800/60">
            <div className="text-[10px] font-bold uppercase text-purple-700 dark:text-purple-400 tracking-wider">Yield Efficiency</div>
            <div className="text-lg font-mono font-black text-purple-700 dark:text-purple-300 mt-1">
              {yieldEfficiency}%
            </div>
            <div className="text-[10px] text-purple-600 dark:text-purple-400 mt-0.5">
              {yieldEfficiency >= 100 ? 'Target achieved ✓' : `${scopedDays.length} day(s) output`}
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-blue-50/80 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/60">
            <div className="text-[10px] font-bold uppercase text-blue-700 dark:text-blue-400 tracking-wider">Post-Evap Net Mix</div>
            <div className="text-lg font-mono font-black text-blue-700 dark:text-blue-300 mt-1">
              {formatIndian(netPostEvapMixMl, 0)} ml
            </div>
            <div className="text-[10px] text-blue-600 dark:text-blue-400 mt-0.5 font-mono">
              Used: {formatIndian(totalAllocatedMixMl, 0)} ml
            </div>
          </div>

          {canViewCost ? (
            <div className="p-3.5 rounded-xl bg-slate-900 text-white border border-slate-800">
              <div className="text-[10px] font-bold uppercase text-emerald-400 tracking-wider">Total Prod. Cost</div>
              <div className="text-lg font-mono font-black text-emerald-300 mt-1">
                ₹{formatIndian(totalCost)}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">RMs + EB + Labour + OH</div>
            </div>
          ) : (
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
              <div className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Cost Access</div>
              <div className="text-sm font-semibold text-slate-500 mt-2">Restricted</div>
            </div>
          )}

          {canViewCost ? (
            <div className="p-3.5 rounded-xl bg-emerald-950/90 text-white border border-emerald-700">
              <div className="text-[10px] font-bold uppercase text-emerald-300 tracking-wider">Net Cost / Unit</div>
              <div className="text-xl font-mono font-black text-emerald-200 mt-0.5">
                ₹{formatIndian(costPerUnit)}
              </div>
              <div className="text-[10px] text-emerald-400 mt-0.5">All-in unit economics</div>
            </div>
          ) : (
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
              <div className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Unit Economics</div>
              <div className="text-sm font-semibold text-slate-500 mt-2">Restricted</div>
            </div>
          )}
        </div>

        {/* ── 2B. THERMAL EVAPORATION & MULTI-DAY MIX POOL BALANCE ── */}
        <div className="p-4 rounded-xl bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-300/80 dark:border-amber-700/60 space-y-2 print-break-avoid">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Flame className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <h3 className="text-xs font-black uppercase text-amber-900 dark:text-amber-200 tracking-wider">
                Thermal Evaporation &amp; Multi-Day Tank Balance
              </h3>
            </div>
            <span className="text-[10px] font-bold bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 px-2.5 py-0.5 rounded border border-amber-300 dark:border-amber-700">
              Merge Stage: {mergeStageName}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs font-mono pt-1">
            <div className="bg-white/80 dark:bg-slate-900/80 p-2.5 rounded-lg border border-amber-200 dark:border-amber-900/40">
              <span className="block text-[9.5px] uppercase font-bold text-slate-500 font-sans">Pre-Evap Mix</span>
              <span className="text-sm font-black text-slate-800 dark:text-slate-100">{formatIndian(totalBeforeEvapMl)} ml</span>
              <span className="block text-[9px] text-slate-400 font-sans">≈ {round2(totalBeforeEvapMl / 1000)} L</span>
            </div>

            <div className="bg-white/80 dark:bg-slate-900/80 p-2.5 rounded-lg border border-amber-200 dark:border-amber-900/40">
              <span className="block text-[9.5px] uppercase font-bold text-amber-600 dark:text-amber-400 font-sans">Evap Thermal Loss</span>
              <span className="text-sm font-black text-amber-600 dark:text-amber-400">-{formatIndian(evaporationLossMl)} ml</span>
              <span className="block text-[9px] text-amber-600 font-sans">{evaporationPct}% shrinkage</span>
            </div>

            <div className="bg-white/80 dark:bg-slate-900/80 p-2.5 rounded-lg border border-emerald-200 dark:border-emerald-900/40">
              <span className="block text-[9.5px] uppercase font-bold text-emerald-600 dark:text-emerald-400 font-sans">Net Post-Evap Mix</span>
              <span className="text-sm font-black text-emerald-700 dark:text-emerald-300">{formatIndian(netPostEvapMixMl)} ml</span>
              <span className="block text-[9px] text-emerald-600 font-sans">≈ {round2(netPostEvapMixMl / 1000)} L</span>
            </div>

            <div className="bg-white/80 dark:bg-slate-900/80 p-2.5 rounded-lg border border-purple-200 dark:border-purple-900/40">
              <span className="block text-[9.5px] uppercase font-bold text-purple-600 dark:text-purple-400 font-sans">Allocated ({scopedDays.length} Day{scopedDays.length > 1 ? 's' : ''})</span>
              <span className="text-sm font-black text-purple-700 dark:text-purple-300">{formatIndian(totalAllocatedMixMl)} ml</span>
              <span className="block text-[9px] text-purple-600 font-sans">
                {netPostEvapMixMl > 0 ? `${round2((totalAllocatedMixMl / netPostEvapMixMl) * 100)}% of batch pool` : '—'}
              </span>
            </div>

            <div className="bg-white/80 dark:bg-slate-900/80 p-2.5 rounded-lg border border-indigo-200 dark:border-indigo-900/40">
              <span className="block text-[9.5px] uppercase font-bold text-indigo-600 dark:text-indigo-400 font-sans">Unallocated Tank Bal.</span>
              <span className="text-sm font-black text-indigo-700 dark:text-indigo-300">{formatIndian(isCompleted ? 0 : remainingTankMixMl)} ml</span>
              <span className="block text-[9px] text-slate-400 font-sans">
                {isCompleted ? 'Batch finalized' : (remainingTankMixMl > 0 ? 'Available for next day' : '100% allocated')}
              </span>
            </div>
          </div>
        </div>

        {/* ── 3. SECTION 1: DAY-WISE / DATE-WISE PRODUCTION & PER-PRODUCT RM TRACEABILITY ── */}
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-md bg-indigo-600 text-white font-bold text-xs flex items-center justify-center">
                1
              </span>
              <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
                Day-Wise / Date-Wise Production &amp; Per-Product Raw Material Ledger
              </h3>
            </div>
            <span className="text-xs text-slate-500 font-mono">
              Showing {scopedDays.length} of {normalizedDays.length} Day{normalizedDays.length > 1 ? 's' : ''} • Product Batches, 8-Digit Serials &amp; Lot Expiry Dates
            </span>
          </div>

          <div className="space-y-4">
            {scopedDays.map(d => (
              <div
                key={`report-day-${d.id || d.dayNo}`}
                className="bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-900/70 rounded-xl overflow-hidden shadow-2xs print-break-avoid"
              >
                {/* Day Header Strip */}
                <div className="px-4 py-3 bg-gradient-to-r from-indigo-50 via-slate-50 to-white dark:from-indigo-950/60 dark:via-slate-900 dark:to-slate-900 border-b border-indigo-200/80 dark:border-indigo-900/60 flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2.5 py-0.5 rounded-md bg-indigo-600 text-white font-mono text-xs font-black">
                      Day {d.dayNo}
                    </span>
                    <span className="font-mono text-xs font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-indigo-500" />
                      {formatDateDMY(d.productionDate)}
                    </span>
                    <span className="font-mono text-xs font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-100/70 dark:bg-indigo-950/70 px-2 py-0.5 rounded border border-indigo-200 dark:border-indigo-800">
                      Day Batch: {d.dayBatchCode || '—'}
                    </span>
                    <span className="text-xs font-mono text-purple-700 dark:text-purple-300 font-bold">
                      Mix: {formatIndian(d.openingMixMl, 0)} → Used {formatIndian(d.allocatedMixMl, 0)} ml → Rem {formatIndian(d.remainingMixMl, 0)} ml
                    </span>
                    <span className="text-[11px] font-mono text-slate-500">
                      ({d.durationText})
                    </span>
                    <span className="inline-flex items-center gap-1 text-[10.5px] font-semibold px-2 py-0.5 rounded bg-emerald-50/90 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                      <Users className="w-3 h-3 shrink-0" />
                      <span>
                        Staff:{' '}
                        {Array.isArray(d.assignedUsers) && d.assignedUsers.length > 0
                          ? d.assignedUsers.map(u => `${u.name}${u.empId ? ` (${u.empId})` : ''}`).join(', ')
                          : (d.completedBy || d.startedBy || batch?.startedBy || 'Floor Operator')}
                      </span>
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                      d.pushedToSales
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800'
                        : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800'
                    }`}>
                      {d.statusLabel}
                    </span>
                  </div>

                  <div className="flex items-center gap-2.5 text-xs font-mono flex-wrap">
                    {canViewCost && (
                      <>
                        <span>EB: <strong className="text-blue-600 dark:text-blue-400">₹{formatIndian(d.ebTotalCost)}</strong></span>
                        <span>Labour: <strong className="text-amber-600 dark:text-amber-400">₹{formatIndian(d.labourTotalCost)}</strong></span>
                        <span>OH: <strong className="text-slate-700 dark:text-slate-300">₹{formatIndian(d.overheadAmt)}</strong></span>
                      </>
                    )}
                    {canViewCost && d.status !== 'IN_PROGRESS' && d.id && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => handleOpenReportDayCostEdit(d)}
                        className="h-7 px-2.5 text-[11px] font-bold rounded-lg border-indigo-300 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 cursor-pointer no-print flex items-center gap-1"
                      >
                        <Edit3 className="w-3 h-3" />
                        <span>Edit EB / Labour</span>
                      </Button>
                    )}
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => triggerPdfDownload('datewise', d.dayNo)}
                      className="h-7 px-2.5 text-[11px] font-bold rounded-lg border-emerald-300 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 cursor-pointer no-print flex items-center gap-1"
                      title={`Download Day ${d.dayNo} (${formatDateDMY(d.productionDate)}) PDF`}
                    >
                      <Download className="w-3 h-3" />
                      <span>Day {d.dayNo} PDF</span>
                    </Button>
                  </div>
                </div>

                {/* Day Body: Products Table + Per-Product RM Traceability */}
                <div className="p-3.5 space-y-3">
                  {Array.isArray(d.outputs) && d.outputs.length > 0 ? (
                    <>
                      <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
                        <table className="w-full text-left text-[11.5px] font-mono border-collapse">
                          <thead>
                            <tr className="bg-slate-100 dark:bg-slate-800/90 text-[10px] uppercase text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">
                              <th className="py-2 px-2.5">Seq</th>
                              <th className="py-2 px-2.5 font-sans">Product Finished Item</th>
                              <th className="py-2 px-2.5">Product Batch &amp; Serial</th>
                              <th className="py-2 px-2.5 font-sans">Mould / Bulk</th>
                              <th className="py-2 px-2.5 text-right">Mix Used</th>
                              <th className="py-2 px-2.5 text-right">Planned</th>
                              <th className="py-2 px-2.5 text-right text-emerald-700 dark:text-emerald-400">Actual Good</th>
                              <th className="py-2 px-2.5 text-right text-rose-600">Reject</th>
                              <th className="py-2 px-2.5 text-right">Yield %</th>
                              {canViewCost && <th className="py-2 px-2.5 text-right">Total Cost</th>}
                              {canViewCost && <th className="py-2 px-2.5 text-right text-emerald-600 font-black">Unit Cost</th>}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {d.outputs.map((out, oIdx) => (
                              <tr key={`rep-day-out-${d.dayNo}-${out.id || oIdx}`} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/30">
                                <td className="py-2 px-2.5 font-bold text-slate-500">#{out.seq || oIdx + 1}</td>
                                <td className="py-2 px-2.5 font-sans">
                                  <div className="font-extrabold text-slate-900 dark:text-white">{out.productName}</div>
                                  <div className="font-mono text-[10px] text-slate-400">{out.productCode || 'FP'}</div>
                                </td>
                                <td className="py-2 px-2.5">
                                  <div className="text-indigo-700 dark:text-indigo-300 font-bold text-[10.5px]">{out.productBatchNo || '—'}</div>
                                  <div className="text-emerald-700 dark:text-emerald-300 font-bold text-[10px]">{out.productSerialNo || '—'}</div>
                                </td>
                                <td className="py-2 px-2.5 font-sans text-[11px] text-slate-600 dark:text-slate-300">
                                  {out.useMould !== false && out.mouldCode
                                    ? `${out.mouldCode} (${out.trays || 0}T × ${out.cavities || 1}C)`
                                    : `Bulk (${out.bulkUom || out.uom})`}
                                </td>
                                <td className="py-2 px-2.5 text-right font-bold text-purple-700 dark:text-purple-400">
                                  {formatIndian(out.allocatedBaseMl, 0)} ml
                                </td>
                                <td className="py-2 px-2.5 text-right text-slate-600 dark:text-slate-400">
                                  {formatIndian(out.theoreticalQty, 0)} {out.uom}
                                </td>
                                <td className="py-2 px-2.5 text-right font-black text-emerald-700 dark:text-emerald-400">
                                  {formatIndian(out.actualYield, 0)} {out.uom}
                                </td>
                                <td className="py-2 px-2.5 text-right font-bold text-rose-600 dark:text-rose-400">
                                  {formatIndian(out.rejectOutput, 0)}
                                </td>
                                <td className="py-2 px-2.5 text-right font-bold text-slate-800 dark:text-slate-200">
                                  {out.yieldPct}%
                                </td>
                                {canViewCost && (
                                  <td className="py-2 px-2.5 text-right font-bold text-slate-900 dark:text-white">
                                    ₹{formatIndian(out.totalCost)}
                                  </td>
                                )}
                                {canViewCost && (
                                  <td className="py-2 px-2.5 text-right font-black text-emerald-600 dark:text-emerald-400">
                                    ₹{formatIndian(out.unitCost)}
                                  </td>
                                )}
                              </tr>
                            ))}
                          </tbody>
                          <tfoot className="bg-slate-50 dark:bg-slate-800/80 font-bold border-t border-slate-200 dark:border-slate-700">
                            <tr>
                              <td colSpan={4} className="py-1.5 px-2.5 font-sans uppercase text-[10px] text-slate-600 dark:text-slate-300">
                                Day {d.dayNo} Production Subtotal
                              </td>
                              <td className="py-1.5 px-2.5 text-right text-purple-700 dark:text-purple-400">{formatIndian(d.allocatedMixMl, 0)} ml</td>
                              <td className="py-1.5 px-2.5 text-right">{formatIndian(d.totalExpectedQty, 0)}</td>
                              <td className="py-1.5 px-2.5 text-right text-emerald-700 dark:text-emerald-400 font-black">{formatIndian(d.totalOutputQty, 0)}</td>
                              <td className="py-1.5 px-2.5 text-right text-rose-600">{formatIndian(d.totalRejectedQty, 0)}</td>
                              <td className="py-1.5 px-2.5 text-right">
                                {d.totalExpectedQty > 0 ? `${round2((d.totalOutputQty / d.totalExpectedQty) * 100)}%` : '—'}
                              </td>
                              {canViewCost && (
                                <td className="py-1.5 px-2.5 text-right text-slate-900 dark:text-white">
                                  ₹{formatIndian(d.outputs.reduce((s, o) => s + Number(o.totalCost || 0), 0))}
                                </td>
                              )}
                              {canViewCost && <td className="py-1.5 px-2.5 text-right text-slate-400">—</td>}
                            </tr>
                          </tfoot>
                        </table>
                      </div>

                      {/* Day Product-Wise Added RM Lots & Expiry Table */}
                      {d.outputs.some(o => Array.isArray(o.productRms) && o.productRms.length > 0) && (
                        <div className="rounded-lg border border-purple-200/80 dark:border-purple-900/50 bg-purple-50/30 dark:bg-purple-950/10 p-2.5 space-y-1.5">
                          <div className="text-[10.5px] font-extrabold uppercase tracking-wider text-purple-800 dark:text-purple-300 flex items-center gap-1.5">
                            <Boxes className="w-3.5 h-3.5" />
                            <span>Day {d.dayNo} ({formatDateDMY(d.productionDate)}) — Raw Materials Consumed Per Product (Batch # • Qty • Expiry Date)</span>
                          </div>
                          <div className="overflow-x-auto rounded border border-purple-100 dark:border-purple-900/40 bg-white dark:bg-slate-900">
                            <table className="w-full text-left text-[11px] font-mono border-collapse">
                              <thead>
                                <tr className="bg-slate-50 dark:bg-slate-800 text-[9.5px] uppercase text-slate-500 border-b border-slate-200 dark:border-slate-700">
                                  <th className="py-1.5 px-2.5 font-sans">Finished Product</th>
                                  <th className="py-1.5 px-2.5 font-sans">RM Code &amp; Material</th>
                                  <th className="py-1.5 px-2.5">RM Batch / Lot #</th>
                                  <th className="py-1.5 px-2.5 text-right">Consumed Qty</th>
                                  <th className="py-1.5 px-2.5 text-center">Lot Expiry Date</th>
                                  <th className="py-1.5 px-2.5 font-sans">Purpose / Mix</th>
                                  {canViewCost && <th className="py-1.5 px-2.5 text-right">Cost</th>}
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {d.outputs.flatMap(out =>
                                  (out.productRms || []).flatMap((prm, pIdx) => {
                                    const lots = Array.isArray(prm.allocatedBatches) && prm.allocatedBatches.length > 0 ? prm.allocatedBatches : null;
                                    const pUom = prm.uom || 'pcs';
                                    const rate = Number(prm.unitRate ?? prm.rate ?? 0);
                                    const isMix = prm.addToMix !== false;
                                    if (lots && lots.length > 0) {
                                      return lots.map((lot, lIdx) => {
                                        const qtyVal = Number(lot.allocatedQty ?? prm.takenQty ?? prm.qty ?? 0);
                                        const rowCost = round2(qtyVal * Number(lot.unitRate ?? rate));
                                        const expInfo = getExpiryBadge(lot.expiryDate || prm.expiryDate);
                                        return (
                                          <tr key={`d-prm-${d.dayNo}-${out.seq}-${pIdx}-${lIdx}`} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                                            <td className="py-1.5 px-2.5 font-sans font-bold text-slate-900 dark:text-white">
                                              {out.productName}
                                            </td>
                                            <td className="py-1.5 px-2.5 font-sans text-slate-700 dark:text-slate-300">
                                              <span className="font-mono text-[10px] text-slate-400 mr-1">{prm.rawMaterialCode || prm.rmCode || 'RM'}</span>
                                              <span className="font-bold">{prm.rawMaterialName || prm.rmName}</span>
                                            </td>
                                            <td className="py-1.5 px-2.5 font-bold text-indigo-600 dark:text-indigo-400">
                                              {lot.lotNumber || lot.internalBatchNo || prm.lotBatchNo || 'BATCH-DIRECT'}
                                            </td>
                                            <td className="py-1.5 px-2.5 text-right font-bold text-slate-900 dark:text-white">
                                              {formatIndian(qtyVal, 2)} {formatCleanUom(lot.uom || pUom, 'pcs', prm)}
                                            </td>
                                            <td className={`py-1.5 px-2.5 text-center ${expInfo.cls}`}>
                                              {expInfo.label}
                                            </td>
                                            <td className="py-1.5 px-2.5 font-sans text-[10px] text-slate-500">
                                              {isMix ? `Mix (+${formatIndian(toMl(qtyVal, pUom, Number(prm.density || 1)), 0)} ml)` : 'Packaging'}
                                            </td>
                                            {canViewCost && (
                                              <td className="py-1.5 px-2.5 text-right font-bold text-emerald-600 dark:text-emerald-400">
                                                ₹{formatIndian(rowCost)}
                                              </td>
                                            )}
                                          </tr>
                                        );
                                      });
                                    }
                                    const qtyVal = Number(prm.takenQty ?? prm.qty ?? 0);
                                    const rowCost = Number(prm.totalCost) > 0 ? Number(prm.totalCost) : round2(qtyVal * rate);
                                    const expInfo = getExpiryBadge(prm.expiryDate);
                                    return [(
                                      <tr key={`d-prm-${d.dayNo}-${out.seq}-${pIdx}-single`} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                                        <td className="py-1.5 px-2.5 font-sans font-bold text-slate-900 dark:text-white">{out.productName}</td>
                                        <td className="py-1.5 px-2.5 font-sans text-slate-700 dark:text-slate-300">
                                          <span className="font-mono text-[10px] text-slate-400 mr-1">{prm.rawMaterialCode || prm.rmCode || 'RM'}</span>
                                          <span className="font-bold">{prm.rawMaterialName || prm.rmName}</span>
                                        </td>
                                        <td className="py-1.5 px-2.5 font-bold text-indigo-600 dark:text-indigo-400">{prm.lotBatchNo || 'BATCH-DIRECT'}</td>
                                        <td className="py-1.5 px-2.5 text-right font-bold text-slate-900 dark:text-white">{formatIndian(qtyVal, 2)} {pUom}</td>
                                        <td className={`py-1.5 px-2.5 text-center ${expInfo.cls}`}>{expInfo.label}</td>
                                        <td className="py-1.5 px-2.5 font-sans text-[10px] text-slate-500">
                                          {isMix ? `Mix (+${formatIndian(toMl(qtyVal, pUom, Number(prm.density || 1)), 0)} ml)` : 'Packaging'}
                                        </td>
                                        {canViewCost && (
                                          <td className="py-1.5 px-2.5 text-right font-bold text-emerald-600 dark:text-emerald-400">₹{formatIndian(rowCost)}</td>
                                        )}
                                      </tr>
                                    )];
                                  })
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="p-3 rounded-lg bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 text-xs text-amber-800 dark:text-amber-300 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>Day {d.dayNo} is currently In Progress with {formatIndian(d.openingMixMl, 0)} ml opening mix available and no submitted product outputs yet.</span>
                    </div>
                  )}

                  {/* Day Process Stages Compact Strip */}
                  {Array.isArray(d.timelineStages) && d.timelineStages.length > 0 && (
                    <div className="flex items-center gap-1.5 flex-wrap pt-1 text-[10.5px]">
                      <span className="font-bold uppercase text-slate-400 text-[9.5px] mr-1">Day {d.dayNo} Process Stages ({d.durationText}):</span>
                      {d.timelineStages.map((stg, si) => (
                        <span
                          key={`d-stg-${d.dayNo}-${stg.id || si}`}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono text-slate-700 dark:text-slate-300"
                        >
                          <strong className="text-indigo-600 dark:text-indigo-400">{si + 1}.</strong>
                          <span className="font-sans font-bold">{stg.name}</span>
                          <span className="text-blue-600 dark:text-blue-400">{stg.targetTemp || stg.defaultTemp || '—'}</span>
                          <span className="text-slate-400">({stg.durationHours || 0}h {stg.durationMinutes || 0}m)</span>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── 4. SECTION 2: CONSOLIDATED RAW MATERIAL CONSUMPTION & LOT EXPIRY REPORT ── */}
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-md bg-emerald-600 text-white font-bold text-xs flex items-center justify-center">
                2
              </span>
              <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
                Raw Material Consumption Report (Batch Lot # • Quantity • Expiry Date)
              </h3>
            </div>
            <span className="text-xs text-slate-500 font-medium">
              Full warehouse batch traceability &amp; valuation
            </span>
          </div>

          {/* 2A. Base Raw Materials */}
          <div className="space-y-1.5 print-break-avoid">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
              <Factory className="w-3.5 h-3.5 text-indigo-500" />
              <span>2A. Base Formulation Raw Materials Consumed (Day 1 Tank Preparation)</span>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700">
                    <th className="py-2.5 px-3">RM Code</th>
                    <th className="py-2.5 px-3">Raw Material Name</th>
                    <th className="py-2.5 px-3 font-mono">Batch / Lot No</th>
                    <th className="py-2.5 px-3 text-right">Consumed Qty</th>
                    <th className="py-2.5 px-3 text-center">Lot Expiry Date</th>
                    {canViewCost && <th className="py-2.5 px-3 text-right">Unit Rate</th>}
                    {canViewCost && <th className="py-2.5 px-3 text-right">Total Cost</th>}
                    <th className="py-2.5 px-3 text-right">Liquid Vol</th>
                    <th className="py-2.5 px-3 text-right">Evaporation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-mono">
                  {baseRmLines.length === 0 ? (
                    <tr>
                      <td colSpan={canViewCost ? 9 : 7} className="py-4 px-3 text-center font-sans text-slate-400">
                        No base raw materials recorded yet.
                      </td>
                    </tr>
                  ) : (
                    baseRmLines.flatMap((line, idx) => {
                      const uomClean = formatCleanUom(line.uom, 'kg', line);
                      const lots = Array.isArray(line.lots) && line.lots.length > 0 ? line.lots : null;
                      const liquidMl = Number(line.liquidVolumeMl || 0);
                      const evaporates = Boolean(line.evaporates);
                      const evapLoss = evaporates ? round2(liquidMl * (evaporationPct / 100)) : 0;

                      if (lots && lots.length > 1) {
                        return lots.map((lot, lIdx) => {
                          const expInfo = getExpiryBadge(lot.expiryDate || line.expiryDate);
                          return (
                            <tr key={`base-rm-${idx}-lot-${lIdx}`} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                              <td className="py-2 px-3 text-slate-500 font-bold">{lIdx === 0 ? (line.rawMaterialCode || 'RM') : '↳ Lot'}</td>
                              <td className="py-2 px-3 font-sans font-extrabold text-slate-900 dark:text-white">
                                {lIdx === 0 ? line.rawMaterialName : `${line.rawMaterialName} (Lot ${lIdx + 1})`}
                              </td>
                              <td className="py-2 px-3 font-black text-indigo-600 dark:text-indigo-400">{lot.lotNumber}</td>
                              <td className="py-2 px-3 text-right font-bold text-slate-900 dark:text-white">
                                {formatIndian(lot.allocatedQty)} {formatCleanUom(lot.uom || uomClean, 'kg', line)}
                              </td>
                              <td className={`py-2 px-3 text-center ${expInfo.cls}`}>{expInfo.label}</td>
                              {canViewCost && <td className="py-2 px-3 text-right">₹{formatIndian(lot.unitRate ?? line.unitRate)} / {uomClean}</td>}
                              {canViewCost && <td className="py-2 px-3 text-right font-bold text-emerald-600 dark:text-emerald-400">₹{formatIndian(lot.totalCost)}</td>}
                              <td className="py-2 px-3 text-right text-blue-600 dark:text-blue-400">{lIdx === 0 ? `${formatIndian(liquidMl)} ml` : '—'}</td>
                              <td className="py-2 px-3 text-right">{lIdx === 0 && evaporates ? <span className="text-amber-600 font-bold">-{formatIndian(evapLoss)} ml</span> : '—'}</td>
                            </tr>
                          );
                        });
                      }

                      const singleLot = lots?.[0];
                      const expInfo = getExpiryBadge(singleLot?.expiryDate || line.expiryDate);
                      return [(
                        <tr key={`base-rm-${line.rawMaterialCode || idx}-${idx}`} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                          <td className="py-2.5 px-3 text-slate-500 font-bold">{line.rawMaterialCode || 'RM'}</td>
                          <td className="py-2.5 px-3 font-sans font-extrabold text-slate-900 dark:text-white">{line.rawMaterialName}</td>
                          <td className="py-2.5 px-3 font-black text-indigo-600 dark:text-indigo-400">{singleLot?.lotNumber || line.lotBatchNo || 'BATCH-DIRECT'}</td>
                          <td className="py-2.5 px-3 text-right font-bold text-slate-900 dark:text-white">{formatIndian(line.takenQty)} {uomClean}</td>
                          <td className={`py-2.5 px-3 text-center ${expInfo.cls}`}>{expInfo.label}</td>
                          {canViewCost && <td className="py-2.5 px-3 text-right text-slate-700 dark:text-slate-300">₹{formatIndian(line.unitRate)} / {uomClean}</td>}
                          {canViewCost && <td className="py-2.5 px-3 text-right font-bold text-emerald-600 dark:text-emerald-400">₹{formatIndian(line.totalCost)}</td>}
                          <td className="py-2.5 px-3 text-right text-blue-600 dark:text-blue-400 font-bold">{formatIndian(liquidMl)} ml</td>
                          <td className="py-2.5 px-3 text-right text-slate-600 dark:text-slate-400">
                            {evaporates ? <span className="text-amber-600 dark:text-amber-400 font-bold">-{formatIndian(evapLoss)} ml ({evaporationPct}%)</span> : <span className="text-slate-400 font-normal">No loss</span>}
                          </td>
                        </tr>
                      )];
                    })
                  )}
                </tbody>
                <tfoot className="bg-slate-50 dark:bg-slate-800 font-bold text-slate-900 dark:text-white border-t border-slate-200 dark:border-slate-700 font-mono">
                  <tr>
                    <td colSpan={3} className="py-2.5 px-3 font-sans uppercase">Total Base Raw Materials Consumed</td>
                    <td className="py-2.5 px-3 text-right">{baseRmLines.length} Materials</td>
                    <td className="py-2.5 px-3 text-center text-slate-400">—</td>
                    {canViewCost && <td className="py-2.5 px-3 text-right">Blended Rate</td>}
                    {canViewCost && <td className="py-2.5 px-3 text-right text-emerald-600 dark:text-emerald-400 font-black">₹{formatIndian(totalBaseConsumedCost)}</td>}
                    <td className="py-2.5 px-3 text-right text-blue-600 dark:text-blue-400 font-black">{formatIndian(totalBaseLiquidVolumeMl)} ml</td>
                    <td className="py-2.5 px-3 text-right text-amber-600 dark:text-amber-400">-{formatIndian(evaporationLossMl)} ml</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* 2B. Product-Specific Added RMs, Flavours & Packaging Summary */}
          {productSpecificRmGroups.length > 0 && (
            <div className="space-y-2.5 pt-1 print-break-avoid">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Boxes className="w-3.5 h-3.5 text-purple-600" />
                  <span>2B. Consolidated Product-Specific Added Ingredients &amp; Packaging Traceability</span>
                </div>
                <span className="text-[10px] text-slate-400 font-normal">
                  {productSpecificRmGroups.length} product run(s) with direct RM additions
                </span>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                <table className="w-full text-left text-xs border-collapse font-mono">
                  <thead>
                    <tr className="bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700">
                      <th className="py-2 px-3 font-sans">Day / Date</th>
                      <th className="py-2 px-3 font-sans">Finished Product</th>
                      <th className="py-2 px-3 font-sans">RM Code &amp; Description</th>
                      <th className="py-2 px-3">Batch / Lot No</th>
                      <th className="py-2 px-3 text-right">Consumed Qty</th>
                      <th className="py-2 px-3 text-center">Expiry Date</th>
                      <th className="py-2 px-3 font-sans">Type</th>
                      {canViewCost && <th className="py-2 px-3 text-right">Rate</th>}
                      {canViewCost && <th className="py-2 px-3 text-right">Total Cost</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {productSpecificRmGroups.flatMap(grp =>
                      grp.items.flatMap((it, itIdx) => {
                        const lotList = Array.isArray(it.lots) && it.lots.length > 0 ? it.lots : null;
                        if (lotList && lotList.length > 0) {
                          return lotList.map((lot, lIdx) => {
                            const qtyVal = Number(lot.allocatedQty ?? it.takenQty ?? 0);
                            const rCost = round2(qtyVal * Number(lot.unitRate ?? it.unitRate ?? 0));
                            const expInfo = getExpiryBadge(lot.expiryDate || it.expiryDate);
                            return (
                              <tr key={`${grp.key}-${itIdx}-${lIdx}`} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                                <td className="py-2 px-3 text-[11px] text-indigo-700 dark:text-indigo-300 font-bold">
                                  D{grp.dayNo} • {formatDateDMY(grp.productionDate)}
                                </td>
                                <td className="py-2 px-3 font-sans font-extrabold text-slate-900 dark:text-white">
                                  {grp.productName}
                                </td>
                                <td className="py-2 px-3 font-sans">
                                  <span className="font-mono text-[10px] text-slate-400 mr-1">{it.rmCode}</span>
                                  <span className="font-bold text-slate-800 dark:text-slate-200">{it.rmName}</span>
                                </td>
                                <td className="py-2 px-3 font-bold text-indigo-600 dark:text-indigo-400">
                                  {lot.lotNumber || lot.internalBatchNo || it.lotBatchNo}
                                </td>
                                <td className="py-2 px-3 text-right font-bold text-slate-900 dark:text-white">
                                  {formatIndian(qtyVal, 2)} {formatCleanUom(lot.uom || it.uom, 'pcs', it)}
                                </td>
                                <td className={`py-2 px-3 text-center ${expInfo.cls}`}>{expInfo.label}</td>
                                <td className="py-2 px-3 font-sans text-[10.5px] text-slate-500">
                                  {it.isMix ? `Mix (+${formatIndian(toMl(qtyVal, it.uom, 1), 0)} ml)` : 'Packaging'}
                                </td>
                                {canViewCost && <td className="py-2 px-3 text-right">₹{Number(lot.unitRate ?? it.unitRate).toFixed(2)}</td>}
                                {canViewCost && <td className="py-2 px-3 text-right font-bold text-emerald-600 dark:text-emerald-400">₹{formatIndian(rCost)}</td>}
                              </tr>
                            );
                          });
                        }
                        const expInfo = getExpiryBadge(it.expiryDate);
                        return [(
                          <tr key={`${grp.key}-${itIdx}-single`} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                            <td className="py-2 px-3 text-[11px] text-indigo-700 dark:text-indigo-300 font-bold">
                              D{grp.dayNo} • {formatDateDMY(grp.productionDate)}
                            </td>
                            <td className="py-2 px-3 font-sans font-extrabold text-slate-900 dark:text-white">{grp.productName}</td>
                            <td className="py-2 px-3 font-sans">
                              <span className="font-mono text-[10px] text-slate-400 mr-1">{it.rmCode}</span>
                              <span className="font-bold text-slate-800 dark:text-slate-200">{it.rmName}</span>
                            </td>
                            <td className="py-2 px-3 font-bold text-indigo-600 dark:text-indigo-400">{it.lotBatchNo}</td>
                            <td className="py-2 px-3 text-right font-bold text-slate-900 dark:text-white">{formatIndian(it.takenQty, 2)} {it.uom}</td>
                            <td className={`py-2 px-3 text-center ${expInfo.cls}`}>{expInfo.label}</td>
                            <td className="py-2 px-3 font-sans text-[10.5px] text-slate-500">{it.purpose}</td>
                            {canViewCost && <td className="py-2 px-3 text-right">₹{it.unitRate.toFixed(2)}</td>}
                            {canViewCost && <td className="py-2 px-3 text-right font-bold text-emerald-600 dark:text-emerald-400">₹{formatIndian(it.totalCost)}</td>}
                          </tr>
                        )];
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {canViewCost && (
            <div className="p-3 rounded-xl bg-slate-900 text-white flex items-center justify-between flex-wrap gap-2 text-xs font-mono print-break-avoid">
              <span className="font-sans font-bold uppercase text-[11px] text-slate-300">
                Total Direct Materials Consumed (Base Mix + Product Specific Additions):
              </span>
              <div className="flex items-center gap-4 flex-wrap">
                <span>Base RMs: <strong className="text-white">₹{formatIndian(totalBaseConsumedCost)}</strong></span>
                <span>+</span>
                <span>Added RMs: <strong className="text-amber-400">₹{formatIndian(totalAddedRmsCost)}</strong></span>
                <span>=</span>
                <span className="text-base font-black text-emerald-400">₹{formatIndian(grandTotalMaterialCost)}</span>
              </div>
            </div>
          )}
        </div>

        {/* ── 5. SECTION 3: CONSOLIDATED YIELD REPORT & VARIANCE ACCOUNTING ── */}
        <div className="space-y-3 print-break-avoid">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-md bg-purple-600 text-white font-bold text-xs flex items-center justify-center">
                3
              </span>
              <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
                Output Yield Report, Wastage &amp; Variance Accounting
              </h3>
            </div>
            <span className="text-xs font-mono font-bold text-slate-500">
              Overall Yield Efficiency: <strong className={yieldEfficiency >= 100 ? 'text-emerald-600' : 'text-amber-600'}>{yieldEfficiency}%</strong>
            </span>
          </div>

          {consolidatedYieldRows.length > 0 && (
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
              <table className="w-full text-left text-xs font-mono border-collapse">
                <thead>
                  <tr className="bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700">
                    <th className="py-2.5 px-3 font-sans">Finished Product</th>
                    <th className="py-2.5 px-3 text-center">Run Days</th>
                    <th className="py-2.5 px-3 text-right">Mix Consumed</th>
                    <th className="py-2.5 px-3 text-right">Planned / Expected</th>
                    <th className="py-2.5 px-3 text-right text-emerald-700 dark:text-emerald-400">Actual Good Yield</th>
                    <th className="py-2.5 px-3 text-right text-rose-600">Rejected</th>
                    <th className="py-2.5 px-3 text-right">Variance</th>
                    <th className="py-2.5 px-3 text-right">Yield %</th>
                    {canViewCost && <th className="py-2.5 px-3 text-right">Total Cost</th>}
                    {canViewCost && <th className="py-2.5 px-3 text-right text-emerald-600">Avg Cost / Unit</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {consolidatedYieldRows.map((yr, idx) => (
                    <tr key={`yield-row-${yr.productName}-${idx}`} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                      <td className="py-2 px-3 font-sans font-extrabold text-slate-900 dark:text-white">
                        {yr.productName} <span className="font-mono text-[10px] text-slate-400 font-normal">({yr.productCode})</span>
                      </td>
                      <td className="py-2 px-3 text-center font-bold text-indigo-600 dark:text-indigo-400">{yr.daysLabel}</td>
                      <td className="py-2 px-3 text-right text-purple-700 dark:text-purple-400 font-bold">{formatIndian(yr.mixUsedMl, 0)} ml</td>
                      <td className="py-2 px-3 text-right">{formatIndian(yr.expectedQty, 0)} {yr.uom}</td>
                      <td className="py-2 px-3 text-right font-black text-emerald-600 dark:text-emerald-400">{formatIndian(yr.actualGood, 0)} {yr.uom}</td>
                      <td className="py-2 px-3 text-right font-bold text-rose-600">{formatIndian(yr.rejectOutput, 0)}</td>
                      <td className={`py-2 px-3 text-right font-bold ${yr.variance >= 0 ? 'text-emerald-600' : 'text-amber-600'}`}>
                        {yr.variance >= 0 ? `+${formatIndian(yr.variance, 0)}` : formatIndian(yr.variance, 0)}
                      </td>
                      <td className="py-2 px-3 text-right font-black">{yr.yieldPct}%</td>
                      {canViewCost && <td className="py-2 px-3 text-right font-bold">₹{formatIndian(yr.totalCost)}</td>}
                      {canViewCost && <td className="py-2 px-3 text-right font-black text-emerald-600 dark:text-emerald-400">₹{formatIndian(yr.unitCost)}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
              <div className="bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700">
                <span className="block text-[9.5px] uppercase font-bold text-slate-500 font-sans">1. Thermal + Mould Loss</span>
                <span className="text-sm font-black text-amber-600 dark:text-amber-400">-{formatIndian(evaporationLossMl + totalWasteMixMl, 0)} ml</span>
                <span className="block text-[9px] text-slate-400 font-sans">Evap ({evaporationPct}%) + Trim waste</span>
              </div>
              <div className="bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700">
                <span className="block text-[9.5px] uppercase font-bold text-slate-500 font-sans">2. Total Good Output</span>
                <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">{formatIndian(actualGood, 0)} {productUom}</span>
                <span className="block text-[9px] text-rose-600 font-sans">Rejected: {formatIndian(totalRejected, 0)} {productUom}</span>
              </div>
              <div className="bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700">
                <span className="block text-[9.5px] uppercase font-bold text-slate-500 font-sans">3. QC Disposition</span>
                <span className={`text-xs font-black ${labTestRequired ? 'text-amber-600' : 'text-emerald-600'}`}>
                  {labTestRequired ? 'QUARANTINE (LAB)' : 'DIRECT TO STOCK'}
                </span>
                <span className="block text-[9px] text-slate-400 font-sans">{labTestRequired ? 'Pending QC release' : 'Inventory cleared'}</span>
              </div>
              <div className="bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700">
                <span className="block text-[9.5px] uppercase font-bold text-slate-500 font-sans">4. Cost Efficiency</span>
                <span className="text-sm font-black text-slate-900 dark:text-white">
                  {canViewCost ? `₹${formatIndian(costPerUnit)} / ${productUom}` : 'Restricted'}
                </span>
                <span className="block text-[9px] text-slate-400 font-sans">
                  {canViewCost ? `Total: ₹${formatIndian(totalCost)}` : 'Admin/Supervisor only'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ── 6. SECTION 4: COMPREHENSIVE FINANCIAL COST BREAKDOWN STATEMENT ── */}
        {canViewCost && (
          <div className="space-y-3 print-break-avoid">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-md bg-slate-900 text-white font-bold text-xs flex items-center justify-center">
                  4
                </span>
                <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
                  Comprehensive Production Cost Statement
                </h3>
              </div>
              <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 px-2 py-0.5 rounded border border-emerald-300 dark:border-emerald-700">
                AUDITED FINANCIAL LEDGER
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-6 gap-3 text-xs font-mono">
              <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                <span className="block text-[9.5px] uppercase font-bold text-slate-500 font-sans">1. Base RMs</span>
                <div className="text-base font-black text-slate-900 dark:text-white mt-1">₹{formatIndian(scopedBaseRmCost)}</div>
                <span className="text-[10px] text-slate-400 font-sans">{baseRmLines.length} tank RMs</span>
              </div>
              <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                <span className="block text-[9.5px] uppercase font-bold text-slate-500 font-sans">2. Added RMs</span>
                <div className="text-base font-black text-purple-700 dark:text-purple-400 mt-1">₹{formatIndian(totalAddedRmsCost)}</div>
                <span className="text-[10px] text-slate-400 font-sans">Flavours &amp; packing</span>
              </div>
              <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                <span className="block text-[9.5px] uppercase font-bold text-slate-500 font-sans">3. Direct Labour</span>
                <div className="text-base font-black text-amber-600 dark:text-amber-400 mt-1">₹{formatIndian(directLabourCost)}</div>
                <span className="text-[10px] text-slate-400 font-sans">{batch?.labourCount || batch?.labour_count || 1} staff crew</span>
              </div>
              <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                <span className="block text-[9.5px] uppercase font-bold text-slate-500 font-sans">4. Electricity (EB)</span>
                <div className="text-base font-black text-blue-600 dark:text-blue-400 mt-1">₹{formatIndian(electricityCost)}</div>
                <span className="text-[10px] text-slate-400 font-sans">Utilities consumed</span>
              </div>
              <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                <span className="block text-[9.5px] uppercase font-bold text-slate-500 font-sans">5. Overheads</span>
                <div className="text-base font-black text-slate-800 dark:text-slate-200 mt-1">₹{formatIndian(overheadCost)}</div>
                <span className="text-[10px] text-slate-400 font-sans">Plant overhead</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-900 dark:bg-slate-950 text-white border border-slate-800">
                <span className="block text-[9.5px] uppercase font-bold text-emerald-400 font-sans">Grand Total Cost</span>
                <div className="text-base font-black text-emerald-300 mt-1">₹{formatIndian(totalCost)}</div>
                <span className="text-[10px] text-slate-400 font-sans">
                  = <strong className="text-emerald-300">₹{formatIndian(costPerUnit)}</strong> / {productUom}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* ── 7. SECTION 5: QUALITY ASSURANCE & FINAL PROCESS SIGN-OFF ── */}
        <div className="border-t border-slate-200 dark:border-slate-800 pt-5 space-y-4 print-break-avoid">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
              <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
                Quality Assurance &amp; Final Process Sign-Off
              </h3>
            </div>
            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
              <CheckCircle2 className="w-4 h-4" />
              <span>Verified Clean Execution Ledger</span>
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/80 text-xs">
            <span className="block text-[10.5px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Operator &amp; Supervisor Completion Remarks:
            </span>
            <p className="text-slate-700 dark:text-slate-300 italic font-mono">
              {completionNotes || `Production ${batch?.referenceNo || ''} (${durationDaysLabel}) verified across ${scopedDays.length} day(s).`}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 text-xs">
            <div className="border border-slate-200 dark:border-slate-700 rounded-xl p-4 bg-white dark:bg-slate-900 text-center space-y-2">
              <div className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Production Floor In-Charge</div>
              <div className="h-10 border-b border-dashed border-slate-300 dark:border-slate-700 flex items-end justify-center pb-1">
                <span className="font-serif italic font-bold text-slate-700 dark:text-slate-300">
                  {batch?.startedBy || batch?.started_by || 'Floor Operator'}
                </span>
              </div>
              <div className="text-[10px] text-slate-400">Start Date: {formatDateDMY(firstDate)}</div>
            </div>

            <div className="border border-slate-200 dark:border-slate-700 rounded-xl p-4 bg-white dark:bg-slate-900 text-center space-y-2">
              <div className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Quality Assurance Inspector</div>
              <div className="h-10 border-b border-dashed border-slate-300 dark:border-slate-700 flex items-end justify-center pb-1">
                <span className="font-serif italic font-bold text-emerald-700 dark:text-emerald-400">
                  {labTestRequired ? 'QC LAB HOLD' : 'QC CLEARED ✓'}
                </span>
              </div>
              <div className="text-[10px] text-slate-400">Status: {labTestRequired ? 'Quarantine Lab Check' : 'Grade-A Verified'}</div>
            </div>

            <div className="border border-slate-200 dark:border-slate-700 rounded-xl p-4 bg-white dark:bg-slate-900 text-center space-y-2">
              <div className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Plant Operations Manager</div>
              <div className="h-10 border-b border-dashed border-slate-300 dark:border-slate-700 flex items-end justify-center pb-1">
                <span className="font-serif italic font-bold text-slate-700 dark:text-slate-300">
                  Standard Authorization
                </span>
              </div>
              <div className="text-[10px] text-slate-400 font-mono">
                ERP Hash: #{String(batch?.id || '').slice(0, 16)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── STANDALONE EDIT COMPLETED DAY OPERATIONAL COSTS MODAL ── */}
      {standaloneEditDay && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs no-print">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-5 space-y-4 text-xs">
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-200 dark:border-slate-800">
              <div>
                <h4 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Zap className="w-4 h-4 text-amber-500" />
                  <span>Edit Operational Costs — {standaloneEditDay.dayLabel} ({standaloneEditDay.dayBatchCode})</span>
                </h4>
                <p className="text-[11px] text-slate-500">Dynamically recalculates unit costs &amp; stock valuation for this day&apos;s outputs</p>
              </div>
              <button type="button" onClick={() => setStandaloneEditDay(null)} className="text-slate-400 hover:text-slate-700 font-bold text-sm cursor-pointer">✕</button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Electricity Amount (₹)</label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={standaloneEditDay.ebTotalCost}
                  onChange={(e) => setStandaloneEditDay(p => ({ ...p, ebTotalCost: parseFloat(e.target.value) || 0 }))}
                  className="w-full h-9 rounded-lg border border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-950 px-2.5 font-mono font-bold text-sm text-amber-700 dark:text-amber-300"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Direct Labour Amount (₹)</label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={standaloneEditDay.labourTotalCost}
                  onChange={(e) => {
                    const nextLab = parseFloat(e.target.value) || 0;
                    setStandaloneEditDay(p => {
                      const outs = p.outputs || [];
                      const totQty = outs.reduce((s, o) => s + Number(o.actualYield || 0), 0);
                      let rem = nextLab;
                      const updOuts = outs.map((o, idx) => {
                        const share = totQty > 0 ? Number(o.actualYield || 0) / totQty : (1 / Math.max(1, outs.length));
                        const val = idx === outs.length - 1 ? Math.max(0, round2(rem)) : round2(nextLab * share);
                        rem -= val;
                        return { ...o, labourAllocatedAmt: val };
                      });
                      return { ...p, labourTotalCost: nextLab, outputs: updOuts };
                    });
                  }}
                  className="w-full h-9 rounded-lg border border-indigo-300 dark:border-indigo-700 bg-white dark:bg-slate-950 px-2.5 font-mono font-bold text-sm text-indigo-700 dark:text-indigo-300"
                />
              </div>
            </div>

            {Array.isArray(standaloneEditDay.outputs) && standaloneEditDay.outputs.length > 0 && (
              <div className="space-y-1.5 border-t border-slate-100 dark:border-slate-800 pt-2.5">
                <span className="text-[10px] font-bold uppercase text-slate-500 block">Per-Product Direct Labour Allocation:</span>
                {standaloneEditDay.outputs.map((o, oi) => (
                  <div key={`ed-out-${o.id || oi}`} className="flex items-center justify-between gap-2 p-2 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                    <div>
                      <div className="font-bold text-slate-900 dark:text-white">{o.productName}</div>
                      <div className="text-[10px] font-mono text-slate-500">{o.actualYield} {o.uom} • {o.productSerialNo}</div>
                    </div>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={o.labourAllocatedAmt}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        setStandaloneEditDay(p => {
                          const updOuts = p.outputs.map((item, idx) => idx === oi ? { ...item, labourAllocatedAmt: val } : item);
                          const sumLab = round2(updOuts.reduce((s, item) => s + Number(item.labourAllocatedAmt || 0), 0));
                          return { ...p, labourTotalCost: sumLab, outputs: updOuts };
                        });
                      }}
                      className="w-24 h-8 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 text-right font-mono font-bold"
                    />
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <Button type="button" variant="outline" size="sm" onClick={() => setStandaloneEditDay(null)} className="text-xs font-bold">Cancel</Button>
              <Button type="button" size="sm" disabled={savingStandaloneEdit} onClick={handleSaveStandaloneDayCostEdit} className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold cursor-pointer">
                {savingStandaloneEdit ? 'Saving...' : 'Save & Recalculate Costs'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
