import { useState, useEffect, useMemo } from 'react';
import {
  Printer, Unlock, CheckCircle2,
  Layers, Factory, FileSpreadsheet, ShieldCheck, Boxes,
  Calendar, Flame, Zap, MapPin, Edit3, Download, CalendarDays, Clock, AlertTriangle, Users,
  Search, Filter
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

const cleanStaffNameOnly = (val) => {
  if (!val) return '';
  if (typeof val === 'object') {
    return cleanStaffNameOnly(val.name || val.fullName || val.userName || val.username || '');
  }
  return String(val)
    .replace(/\s*\([^)]*\)/g, '')
    .replace(/\s*\[[^\]]*\]/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
};

const formatAssignedStaff = (staffList, fallback) => {
  if (Array.isArray(staffList) && staffList.length > 0) {
    const names = staffList.map(u => cleanStaffNameOnly(u)).filter(Boolean);
    if (names.length > 0) return names.join(', ');
  }
  const raw = fallback || 'Floor Operator';
  const cleaned = String(raw).split(',').map(s => cleanStaffNameOnly(s)).filter(Boolean).join(', ');
  return cleaned || raw;
};

const PRODUCT_THEMES = [
  {
    name: 'indigo',
    border: 'border-indigo-400 dark:border-indigo-700',
    bg: 'bg-indigo-50/40 dark:bg-indigo-950/20',
    headerBg: 'bg-indigo-600 text-white',
    badge: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/60 dark:text-indigo-200 border-indigo-300',
    text: 'text-indigo-700 dark:text-indigo-300',
    subText: 'text-indigo-600 dark:text-indigo-400',
    tableHead: 'bg-indigo-100/70 dark:bg-indigo-950/60 text-indigo-900 dark:text-indigo-200',
    footBg: 'bg-indigo-50 dark:bg-indigo-950/40',
    costAccent: 'text-indigo-600 dark:text-indigo-400'
  },
  {
    name: 'emerald',
    border: 'border-emerald-400 dark:border-emerald-700',
    bg: 'bg-emerald-50/40 dark:bg-emerald-950/20',
    headerBg: 'bg-emerald-600 text-white',
    badge: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200 border-emerald-300',
    text: 'text-emerald-700 dark:text-emerald-300',
    subText: 'text-emerald-600 dark:text-emerald-400',
    tableHead: 'bg-emerald-100/70 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-200',
    footBg: 'bg-emerald-50 dark:bg-emerald-950/40',
    costAccent: 'text-emerald-600 dark:text-emerald-400'
  },
  {
    name: 'purple',
    border: 'border-purple-400 dark:border-purple-700',
    bg: 'bg-purple-50/40 dark:bg-purple-950/20',
    headerBg: 'bg-purple-600 text-white',
    badge: 'bg-purple-100 text-purple-800 dark:bg-purple-900/60 dark:text-purple-200 border-purple-300',
    text: 'text-purple-700 dark:text-purple-300',
    subText: 'text-purple-600 dark:text-purple-400',
    tableHead: 'bg-purple-100/70 dark:bg-purple-950/60 text-purple-900 dark:text-purple-200',
    footBg: 'bg-purple-50 dark:bg-purple-950/40',
    costAccent: 'text-purple-600 dark:text-purple-400'
  },
  {
    name: 'amber',
    border: 'border-amber-400 dark:border-amber-700',
    bg: 'bg-amber-50/40 dark:bg-amber-950/20',
    headerBg: 'bg-amber-600 text-white',
    badge: 'bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200 border-amber-300',
    text: 'text-amber-700 dark:text-amber-300',
    subText: 'text-amber-600 dark:text-amber-400',
    tableHead: 'bg-amber-100/70 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200',
    footBg: 'bg-amber-50 dark:bg-amber-950/40',
    costAccent: 'text-amber-600 dark:text-amber-400'
  },
  {
    name: 'rose',
    border: 'border-rose-400 dark:border-rose-700',
    bg: 'bg-rose-50/40 dark:bg-rose-950/20',
    headerBg: 'bg-rose-600 text-white',
    badge: 'bg-rose-100 text-rose-800 dark:bg-rose-900/60 dark:text-rose-200 border-rose-300',
    text: 'text-rose-700 dark:text-rose-300',
    subText: 'text-rose-600 dark:text-rose-400',
    tableHead: 'bg-rose-100/70 dark:bg-rose-950/60 text-rose-900 dark:text-rose-200',
    footBg: 'bg-rose-50 dark:bg-rose-950/40',
    costAccent: 'text-rose-600 dark:text-rose-400'
  },
  {
    name: 'cyan',
    border: 'border-cyan-400 dark:border-cyan-700',
    bg: 'bg-cyan-50/40 dark:bg-cyan-950/20',
    headerBg: 'bg-cyan-600 text-white',
    badge: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/60 dark:text-cyan-200 border-cyan-300',
    text: 'text-cyan-700 dark:text-cyan-300',
    subText: 'text-cyan-600 dark:text-cyan-400',
    tableHead: 'bg-cyan-100/70 dark:bg-cyan-950/60 text-cyan-900 dark:text-cyan-200',
    footBg: 'bg-cyan-50 dark:bg-cyan-950/40',
    costAccent: 'text-cyan-600 dark:text-cyan-400'
  }
];

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

  // Clean sheet inclusion rule: Only completed days are included.
  // If Day 1 is completed and Day 2 is IN_PROGRESS, Day 2 is not added to the clean sheet!
  const effectiveRawDays = useMemo(() => {
    const completedList = rawDays.filter(d =>
      d.status === 'COMPLETED' ||
      d.status === 'Completed' ||
      Boolean(d.pushedToSales) ||
      Boolean(d.is_completed) ||
      Boolean(d.isCompleted)
    );
    if (completedList.length > 0) {
      return completedList;
    }
    // If no days are marked completed yet, fallback to the first day (Day 1)
    return rawDays.length > 0 ? [rawDays[0]] : [];
  }, [rawDays]);

  // Day/Date Scope Filter ('ALL' shows entire batch clean sheet; numeric selects a specific production Day)
  const [selectedReportDayNo, setSelectedReportDayNo] = useState('ALL');
  const [standaloneEditDay, setStandaloneEditDay] = useState(null);
  const [savingStandaloneEdit, setSavingStandaloneEdit] = useState(false);
  const [entireRmSearch, setEntireRmSearch] = useState('');
  const [entireRmCategoryFilter, setEntireRmCategoryFilter] = useState('ALL');
  const [entireRmDayFilter, setEntireRmDayFilter] = useState('ALL');
  const [rmTableViewMode, setRmTableViewMode] = useState('UNIQUE');

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

        const lots = lotsRaw.map(ab => {
          let exp = ab.expiryDate || r.expiryDate || bk.expiryDate || null;
          if (!exp && (ab.mfgDate || r.mfgDate || bk.mfgDate)) {
            const m = new Date(ab.mfgDate || r.mfgDate || bk.mfgDate);
            if (!isNaN(m.getTime())) {
              exp = new Date(m.getTime() + 180 * 24 * 60 * 60 * 1000).toISOString();
            }
          }
          return {
            batchId: ab.batchId || ab.inventoryBatchId || ab.lotNumber,
            lotNumber: ab.lotNumber || ab.internalBatchNo || r.lotBatchNo || bk.lotBatchNo || 'BATCH-DIRECT',
            allocatedQty: Number(ab.allocatedQty || 0),
            uom: ab.uom || uom,
            unitRate: Number(ab.unitRate ?? rate),
            totalCost: round2(Number(ab.allocatedQty || 0) * Number(ab.unitRate ?? rate)),
            expiryDate: exp,
            poNumber: ab.poNumber || 'PO-DIRECT',
            grnNumber: ab.grnNumber || 'GRN-DIRECT'
          };
        });

        const lotBatchNo = lots.length > 0
          ? lots.map(l => l.lotNumber).filter(Boolean).join(', ')
          : (r.lotBatchNo || r.lot_batch_no || bk.lotBatchNo || 'BATCH-DIRECT');
        let expiryDate = r.expiryDate || lots.find(l => l.expiryDate)?.expiryDate || bk.expiryDate || r.lot_expiry_date || null;
        if (!expiryDate && (r.mfgDate || r.mfg_date || bk.mfgDate)) {
          const m = new Date(r.mfgDate || r.mfg_date || bk.mfgDate);
          if (!isNaN(m.getTime())) {
            expiryDate = new Date(m.getTime() + 180 * 24 * 60 * 60 * 1000).toISOString();
          }
        }

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
        .map(l => {
          let exp = l.expiryDate || l.allocatedBatches?.find(ab => ab.expiryDate)?.expiryDate || null;
          if (!exp && (l.mfgDate || l.mfg_date)) {
            const m = new Date(l.mfgDate || l.mfg_date);
            if (!isNaN(m.getTime())) {
              exp = new Date(m.getTime() + 180 * 24 * 60 * 60 * 1000).toISOString();
            }
          }
          return {
            ...l,
            lots: Array.isArray(l.allocatedBatches) ? l.allocatedBatches : [],
            expiryDate: exp
          };
        });
    }
    return [];
  }, [rmRows, costingData]);

  const totalBaseTakenQty = useMemo(
    () => round2(baseRmLines.reduce((s, l) => s + Number(l.takenQty || 0), 0)),
    [baseRmLines]
  );
  const baseUomEntries = useMemo(() => {
    const map = {};
    baseRmLines.forEach(l => {
      const u = formatCleanUom(l.uom, 'kg', l);
      map[u] = (map[u] || 0) + Number(l.takenQty || 0);
    });
    return Object.entries(map);
  }, [baseRmLines]);

  const totalBaseConsumedCost = useMemo(
    () => round2(baseRmLines.reduce((s, l) => s + Number(l.totalCost || 0), 0)),
    [baseRmLines]
  );
  const totalBaseLiquidVolumeMl = useMemo(
    () => round2(baseRmLines.reduce((s, l) => s + Number(l.liquidVolumeMl || 0), 0)),
    [baseRmLines]
  );

  const baseMixExpiryDate = useMemo(() => {
    const dates = [];
    baseRmLines.forEach(l => {
      if (l.expiryDate) {
        const d = new Date(l.expiryDate);
        if (!isNaN(d.getTime())) dates.push(d);
      }
      (l.lots || []).forEach(lot => {
        if (lot.expiryDate) {
          const d = new Date(lot.expiryDate);
          if (!isNaN(d.getTime())) dates.push(d);
        }
      });
    });
    if (dates.length === 0) return null;
    dates.sort((a, b) => a.getTime() - b.getTime());
    return dates[0].toISOString();
  }, [baseRmLines]);

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
    batch?.merged_pre_evap_ml ||
    batch?.mergedPreEvapMl ||
    liveEvaporationResult?.totalBeforeEvapMl ||
    (totalBaseLiquidVolumeMl > 0 ? totalBaseLiquidVolumeMl : 0) ||
    (netPostEvapMixMl > 0 && evaporationLossMl > 0 ? (netPostEvapMixMl + evaporationLossMl) : 0) ||
    (netPostEvapMixMl > 0 && evaporationPct > 0 && evaporationPct < 100 ? round2(netPostEvapMixMl / (1 - evaporationPct / 100)) : 0) ||
    netPostEvapMixMl ||
    0
  );

  // Pre-Evaporation Volume Pool (Option 1: Pure Pre-Mix Formula Costing)
  // Denominator MUST strictly be the Pre-Evaporation gross mix volume (e.g. 221,200 ml, not post-evap 199,080 ml)
  const preEvapMixVolumeMl = Number(
    batch?.merged_pre_evap_ml ||
    batch?.mergedPreEvapMl ||
    liveEvaporationResult?.totalBeforeEvapMl ||
    (totalBaseLiquidVolumeMl > 0 ? totalBaseLiquidVolumeMl : 0) ||
    (netPostEvapMixMl > 0 && evaporationLossMl > 0 ? (netPostEvapMixMl + evaporationLossMl) : 0) ||
    (netPostEvapMixMl > 0 && evaporationPct > 0 && evaporationPct < 100 ? round2(netPostEvapMixMl / (1 - evaporationPct / 100)) : 0) ||
    totalBeforeEvapMl ||
    netPostEvapMixMl ||
    0
  );

  // Base raw material costing (Option 1: Pre-Evaporation Pure Pre-Mix Formula Rate):
  // Formula Rate = Total Base RM Cost / Pre-Evaporation Mix Volume = ₹20,742.92 / 221,200 ml = ₹0.0938/ml
  const baseCostPerMl = (totalBaseConsumedCost > 0 && preEvapMixVolumeMl > 0)
    ? (totalBaseConsumedCost / preEvapMixVolumeMl)
    : 0;

  // ── NORMALIZE DAY-WISE EXECUTION ENTRIES (COMPLETED DAYS ONLY) ──
  const normalizedDays = useMemo(() => {
    if (effectiveRawDays.length > 0) {
      return effectiveRawDays.map(d => {
        const outs = Array.isArray(d.outputs) ? d.outputs : [];
        const dayAllocMl = Number(d.allocatedMixMl || outs.reduce((s, o) => s + Number(o.allocatedBaseMl || 0), 0));
        const dayExpected = outs.reduce((s, o) => s + Number(o.theoreticalQty || o.actualYield || 0), 0);
        const dayActual = Number(d.totalOutputQty || outs.reduce((s, o) => s + Number(o.actualYield || 0), 0));
        const dayRejected = Number(d.totalRejectedQty || outs.reduce((s, o) => s + Number(o.rejectOutput || 0), 0));
        const dStages = Array.isArray(d.timelineStages) && d.timelineStages.length > 0 ? d.timelineStages : timelineStages;

        const staffList = Array.isArray(d.assignedUsers) ? d.assignedUsers : [];
        const staffLabourSum = staffList.reduce((s, u) => {
          const amt = Number(u.amount !== undefined ? u.amount : (u.daySalary || 0));
          return s + amt;
        }, 0);
        const resolvedLabourCost = staffLabourSum > 0
          ? staffLabourSum
          : Number(d.labourTotalCost ?? d.labour_total_cost ?? d.labourCost ?? 0);

        const dayTotalMix = outs.reduce((s, o) => s + Number(o.allocatedBaseMl || 0), 0);
        let remLabour = resolvedLabourCost;

        const enrichedOuts = outs.map((o, oIdx) => {
          const exp = Number(o.theoreticalQty || o.actualYield || 0);
          const act = Number(o.actualYield || 0);
          const rej = Number(o.rejectOutput || 0);
          const yPct = exp > 0 ? round2((act / exp) * 100) : (act > 0 ? 100 : 0);

          const outMix = Number(o.allocatedBaseMl || 0);
          let allocLabour = 0;
          if (o.labourCostOverride !== undefined && Number(o.labourCostOverride) > 0) {
            allocLabour = Number(o.labourCostOverride);
          } else if (resolvedLabourCost > 0) {
            if (oIdx === outs.length - 1) {
              allocLabour = Math.max(0, round2(remLabour));
            } else {
              const share = dayTotalMix > 0 ? (outMix / dayTotalMix) : (1 / outs.length);
              allocLabour = round2(resolvedLabourCost * share);
              remLabour -= allocLabour;
            }
          } else {
            allocLabour = Number(o.allocatedLabourCost ?? o.labourAllocatedAmt ?? 0);
          }

          const outBaseCost = round2(outMix * baseCostPerMl);
          const prms = Array.isArray(o.productRms) ? o.productRms : [];
          const outAddedCost = round2(prms.reduce((s, r) => s + (Number(r.totalCost) > 0 ? Number(r.totalCost) : Number(r.takenQty || 0) * Number(r.unitRate || 0)), 0));
          const outEb = Number(o.allocatedEbCost ?? o.ebAllocatedAmt ?? 0);
          const outTotalCost = round2(outBaseCost + outAddedCost + allocLabour + outEb);
          const uCost = act > 0 ? round2(outTotalCost / act) : 0;

          return {
            ...o,
            theoreticalQty: exp,
            actualYield: act,
            rejectOutput: rej,
            yieldPct: yPct,
            unitCost: uCost,
            totalCost: outTotalCost,
            ebAllocatedAmt: outEb,
            allocatedLabourCost: allocLabour,
            labourAllocatedAmt: allocLabour,
            productRms: prms
          };
        });
        return {
          ...d,
          outputs: enrichedOuts,
          assignedUsers: staffList,
          labourTotalCost: resolvedLabourCost,
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
        uom: formatCleanUom(a.productUom || a.product_unit, 'pcs', a),
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
  }, [effectiveRawDays, allocations, liveAllocationsResult, costingData, actualYieldPieces, batch, isCompleted, labTestRequired, netPostEvapMixMl, timelineStages, productStagesMap, baseCostPerMl]);

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

  // Scoped base RM cost: strictly the allocated mixing cost of completed days (Option 1: Pre-Evaporation Rate)
  const scopedBaseRmCost = (totalAllocatedMixMl > 0 && preEvapMixVolumeMl > 0)
    ? round2(totalAllocatedMixMl * baseCostPerMl)
    : totalBaseConsumedCost;

  const grandTotalMaterialCost = round2(scopedBaseRmCost + totalAddedRmsCost);

  const totalCost = round2(
    scopedBaseRmCost + totalAddedRmsCost + directLabourCost + electricityCost + overheadCost
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

  // ── ENTIRE RAW MATERIALS CONSUMED IN THIS PRODUCTION (UNIFIED MASTER LIST) ──
  const entireProductionRmLines = useMemo(() => {
    const list = [];
    let seq = 1;

    // 1. Base Raw Materials (Used in Tank Preparation / Formulation)
    const baseDayNo = normalizedDays[0]?.dayNo || 1;
    const baseDayDate = normalizedDays[0]?.productionDate || batch?.startDate || batch?.start_date;
    const baseBatchCode = normalizedDays[0]?.dayBatchCode || batch?.shortBatchCode || batch?.short_batch_code || 'BASE-MIX';

    baseRmLines.forEach((line, bIdx) => {
      const uomClean = formatCleanUom(line.uom, 'kg', line);
      const lots = Array.isArray(line.lots) && line.lots.length > 0 ? line.lots : null;
      const rate = Number(line.unitRate || 0);

      if (lots && lots.length > 1) {
        lots.forEach((lot, lIdx) => {
          const qty = Number(lot.allocatedQty || 0);
          const lotRate = Number(lot.unitRate ?? rate);
          const cost = Number(lot.totalCost) > 0 ? Number(lot.totalCost) : round2(qty * lotRate);
          list.push({
            id: `entire-rm-base-${bIdx}-lot-${lIdx}`,
            seq: seq++,
            sourceType: 'BASE',
            sourceCategory: 'Base Tank Mix',
            categoryBadgeCls: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/60 dark:text-indigo-200 border-indigo-200',
            dayNo: baseDayNo,
            dayLabel: `Day ${baseDayNo}`,
            productionDate: baseDayDate,
            dayBatchCode: baseBatchCode,
            rawMaterialCode: line.rawMaterialCode || 'RM',
            rawMaterialName: lIdx === 0 ? line.rawMaterialName : `${line.rawMaterialName} (Lot ${lIdx + 1})`,
            rawMaterialId: line.rawMaterialId,
            usedFor: 'Base Formulation (Tank Mix)',
            usedForSub: 'Primary Formula Pool',
            productName: 'Base Tank Mix',
            productBatchNo: baseBatchCode,
            lotBatchNo: lot.lotNumber || 'BATCH-DIRECT',
            consumedQty: qty,
            uom: formatCleanUom(lot.uom || uomClean, 'kg', line),
            expiryDate: lot.expiryDate || line.expiryDate,
            unitRate: lotRate,
            totalCost: cost,
            isMix: true,
            purpose: 'Base Mix Preparation'
          });
        });
      } else {
        const singleLot = lots?.[0];
        const qty = Number(line.takenQty || 0);
        const cost = Number(line.totalCost) > 0 ? Number(line.totalCost) : round2(qty * rate);
        list.push({
          id: `entire-rm-base-${bIdx}`,
          seq: seq++,
          sourceType: 'BASE',
          sourceCategory: 'Base Tank Mix',
          categoryBadgeCls: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/60 dark:text-indigo-200 border-indigo-200',
          dayNo: baseDayNo,
          dayLabel: `Day ${baseDayNo}`,
          productionDate: baseDayDate,
          dayBatchCode: baseBatchCode,
          rawMaterialCode: line.rawMaterialCode || 'RM',
          rawMaterialName: line.rawMaterialName,
          rawMaterialId: line.rawMaterialId,
          usedFor: 'Base Formulation (Tank Mix)',
          usedForSub: 'Primary Formula Pool',
          productName: 'Base Tank Mix',
          productBatchNo: baseBatchCode,
          lotBatchNo: singleLot?.lotNumber || line.lotBatchNo || 'BATCH-DIRECT',
          consumedQty: qty,
          uom: uomClean,
          expiryDate: singleLot?.expiryDate || line.expiryDate,
          unitRate: rate,
          totalCost: cost,
          isMix: true,
          purpose: 'Base Mix Preparation'
        });
      }
    });

    // 2. Product-Specific Added Raw Materials across ALL Days & ALL Outputs
    normalizedDays.forEach(d => {
      (d.outputs || []).forEach((out, oIdx) => {
        const prms = Array.isArray(out.productRms) ? out.productRms : [];
        prms.forEach((prm, pIdx) => {
          const taken = Number(prm.takenQty ?? prm.qty ?? prm.quantity ?? 0);
          const rate = Number(prm.unitRate ?? prm.rate ?? 0);
          const cost = Number(prm.totalCost) > 0 ? Number(prm.totalCost) : round2(taken * rate);
          const lots = Array.isArray(prm.allocatedBatches) && prm.allocatedBatches.length > 0 ? prm.allocatedBatches : null;
          const isMix = prm.addToMix !== false;
          const uomClean = formatCleanUom(prm.uom, 'pcs', prm);

          if (lots && lots.length > 1) {
            lots.forEach((lot, lIdx) => {
              const lotQty = Number(lot.allocatedQty || 0);
              const lotRate = Number(lot.unitRate ?? rate);
              const lotCost = Number(lot.totalCost) > 0 ? Number(lot.totalCost) : round2(lotQty * lotRate);
              list.push({
                id: `entire-rm-day-${d.dayNo}-out-${oIdx}-prm-${pIdx}-lot-${lIdx}`,
                seq: seq++,
                sourceType: 'PRODUCT_RM',
                sourceCategory: isMix ? 'Product Additive' : 'Packaging & Assembly',
                categoryBadgeCls: isMix
                  ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/60 dark:text-purple-200 border-purple-200'
                  : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200 border-emerald-200',
                dayNo: d.dayNo,
                dayLabel: `Day ${d.dayNo}`,
                productionDate: d.productionDate,
                dayBatchCode: d.dayBatchCode || batch?.shortBatchCode || '—',
                rawMaterialCode: prm.rawMaterialCode || prm.rmCode || `RM-${pIdx + 1}`,
                rawMaterialName: lIdx === 0 ? (prm.rawMaterialName || prm.rmName || 'Added RM') : `${prm.rawMaterialName || prm.rmName} (Lot ${lIdx + 1})`,
                rawMaterialId: prm.rawMaterialId,
                usedFor: out.productName,
                usedForSub: `Batch: ${out.productBatchNo || d.dayBatchCode || '—'}`,
                productName: out.productName,
                productBatchNo: out.productBatchNo || d.dayBatchCode || '—',
                lotBatchNo: lot.lotNumber || 'BATCH-DIRECT',
                consumedQty: lotQty,
                uom: formatCleanUom(lot.uom || uomClean, 'pcs', prm),
                expiryDate: lot.expiryDate || prm.expiryDate,
                unitRate: lotRate,
                totalCost: lotCost,
                isMix,
                purpose: isMix ? 'Flavor / Additive' : 'Packaging / Assembly'
              });
            });
          } else {
            const singleLot = lots?.[0];
            list.push({
              id: `entire-rm-day-${d.dayNo}-out-${oIdx}-prm-${pIdx}`,
              seq: seq++,
              sourceType: 'PRODUCT_RM',
              sourceCategory: isMix ? 'Product Additive' : 'Packaging & Assembly',
              categoryBadgeCls: isMix
                ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/60 dark:text-purple-200 border-purple-200'
                : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200 border-emerald-200',
              dayNo: d.dayNo,
              dayLabel: `Day ${d.dayNo}`,
              productionDate: d.productionDate,
              dayBatchCode: d.dayBatchCode || batch?.shortBatchCode || '—',
              rawMaterialCode: prm.rawMaterialCode || prm.rmCode || `RM-${pIdx + 1}`,
              rawMaterialName: prm.rawMaterialName || prm.rmName || 'Added Ingredient',
              rawMaterialId: prm.rawMaterialId,
              usedFor: out.productName,
              usedForSub: `Batch: ${out.productBatchNo || d.dayBatchCode || '—'}`,
              productName: out.productName,
              productBatchNo: out.productBatchNo || d.dayBatchCode || '—',
              lotBatchNo: singleLot?.lotNumber || prm.lotBatchNo || 'BATCH-DIRECT',
              consumedQty: taken,
              uom: uomClean,
              expiryDate: singleLot?.expiryDate || prm.expiryDate,
              unitRate: rate,
              totalCost: cost,
              isMix,
              purpose: isMix ? 'Flavor / Additive' : 'Packaging / Assembly'
            });
          }
        });
      });
    });

    return list;
  }, [baseRmLines, normalizedDays, batch]);

  // Filtered view for Entire Raw Materials Table
  const filteredEntireRmLines = useMemo(() => {
    return entireProductionRmLines.filter(row => {
      if (entireRmCategoryFilter !== 'ALL' && row.sourceType !== entireRmCategoryFilter) {
        return false;
      }
      if (entireRmDayFilter !== 'ALL' && String(row.dayNo) !== String(entireRmDayFilter)) {
        return false;
      }
      if (entireRmSearch.trim()) {
        const q = entireRmSearch.toLowerCase().trim();
        const match =
          (row.rawMaterialName && row.rawMaterialName.toLowerCase().includes(q)) ||
          (row.rawMaterialCode && row.rawMaterialCode.toLowerCase().includes(q)) ||
          (row.lotBatchNo && row.lotBatchNo.toLowerCase().includes(q)) ||
          (row.dayBatchCode && row.dayBatchCode.toLowerCase().includes(q)) ||
          (row.usedFor && row.usedFor.toLowerCase().includes(q)) ||
          (row.dayLabel && row.dayLabel.toLowerCase().includes(q)) ||
          (row.purpose && row.purpose.toLowerCase().includes(q));
        if (!match) return false;
      }
      return true;
    });
  }, [entireProductionRmLines, entireRmCategoryFilter, entireRmDayFilter, entireRmSearch]);

  // ── 21 UNIQUE RAW MATERIALS CONSOLIDATED SUMMARY (SINGLE TABLE ROLLUP) ──
  const uniqueRawMaterialsSummary = useMemo(() => {
    const map = new Map();

    entireProductionRmLines.forEach(row => {
      const key = row.rawMaterialId
        ? `${row.rawMaterialId}__${row.uom || ''}`
        : `${row.rawMaterialCode || 'RM'}__${row.rawMaterialName}__${row.uom || ''}`;

      if (!map.has(key)) {
        map.set(key, {
          key,
          rawMaterialId: row.rawMaterialId,
          rawMaterialCode: row.rawMaterialCode || 'RM',
          rawMaterialName: row.rawMaterialName,
          uom: row.uom || 'pcs',
          sourceTypes: new Set(),
          sourceCategories: new Set(),
          dayNumbers: new Set(),
          dayLabels: new Set(),
          dayBatchCodes: new Set(),
          lotBatchNumbers: new Set(),
          usedForItems: new Set(),
          productNames: new Set(),
          purposes: new Set(),
          totalConsumedQty: 0,
          totalCost: 0,
          entriesCount: 0,
          expiryDates: [],
          unitRates: []
        });
      }

      const item = map.get(key);
      if (row.sourceType) item.sourceTypes.add(row.sourceType);
      if (row.sourceCategory) item.sourceCategories.add(row.sourceCategory);
      if (row.dayNo) item.dayNumbers.add(row.dayNo);
      if (row.dayLabel) item.dayLabels.add(row.dayLabel);
      if (row.dayBatchCode && row.dayBatchCode !== '—') item.dayBatchCodes.add(row.dayBatchCode);
      if (row.lotBatchNo && row.lotBatchNo !== '—') item.lotBatchNumbers.add(row.lotBatchNo);
      if (row.usedFor) item.usedForItems.add(row.usedFor);
      if (row.productName) item.productNames.add(row.productName);
      if (row.purpose) item.purposes.add(row.purpose);
      item.totalConsumedQty = round2(item.totalConsumedQty + Number(row.consumedQty || 0));
      item.totalCost = round2(item.totalCost + Number(row.totalCost || 0));
      item.entriesCount += 1;
      if (row.expiryDate) item.expiryDates.push(row.expiryDate);
      if (Number(row.unitRate || 0) > 0) item.unitRates.push(Number(row.unitRate));
    });

    return Array.from(map.values()).map((item, idx) => {
      let categoryLabel = 'Base Tank Mix';
      let categoryBadgeCls = 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/60 dark:text-indigo-200 border-indigo-200';
      if (item.sourceTypes.has('BASE') && item.sourceTypes.has('PRODUCT_RM')) {
        categoryLabel = 'Multi-Stage (Base & Products)';
        categoryBadgeCls = 'bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200 border-amber-200';
      } else if (item.sourceTypes.has('PRODUCT_RM')) {
        const isPackaging = Array.from(item.sourceCategories).some(c => c.toLowerCase().includes('packaging') || c.toLowerCase().includes('assembly'));
        categoryLabel = isPackaging ? 'Packaging & Assembly' : 'Product Additive / Flavor';
        categoryBadgeCls = isPackaging
          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200 border-emerald-200'
          : 'bg-purple-100 text-purple-800 dark:bg-purple-900/60 dark:text-purple-200 border-purple-200';
      }

      let earliestExpiry = null;
      if (item.expiryDates.length > 0) {
        const sorted = item.expiryDates
          .map(d => new Date(d))
          .filter(d => !isNaN(d.getTime()))
          .sort((a, b) => a.getTime() - b.getTime());
        if (sorted.length > 0) earliestExpiry = sorted[0].toISOString();
      }

      const avgRate = item.totalConsumedQty > 0
        ? round2(item.totalCost / item.totalConsumedQty)
        : (item.unitRates[0] || 0);

      const daysText = Array.from(item.dayNumbers)
        .sort((a, b) => a - b)
        .map(n => `Day ${n}`)
        .join(', ') || 'Day 1';

      const batchCodesText = Array.from(item.dayBatchCodes).join(', ') || '—';
      const lotsText = Array.from(item.lotBatchNumbers).join(', ') || 'BATCH-DIRECT';
      const usedForText = Array.from(item.usedForItems).join(', ') || 'Base Formulation';

      return {
        seq: idx + 1,
        ...item,
        categoryLabel,
        categoryBadgeCls,
        earliestExpiry,
        avgRate,
        daysText,
        batchCodesText,
        lotsText,
        usedForText
      };
    });
  }, [entireProductionRmLines]);

  // Filtered view for 21 Unique Raw Materials Table
  const filteredUniqueRmLines = useMemo(() => {
    return uniqueRawMaterialsSummary.filter(row => {
      if (entireRmCategoryFilter !== 'ALL') {
        if (entireRmCategoryFilter === 'BASE' && !row.sourceTypes.has('BASE')) return false;
        if (entireRmCategoryFilter === 'PRODUCT_RM' && !row.sourceTypes.has('PRODUCT_RM')) return false;
      }
      if (entireRmDayFilter !== 'ALL') {
        if (!row.dayNumbers.has(Number(entireRmDayFilter))) return false;
      }
      if (entireRmSearch.trim()) {
        const q = entireRmSearch.toLowerCase().trim();
        const match =
          (row.rawMaterialName && row.rawMaterialName.toLowerCase().includes(q)) ||
          (row.rawMaterialCode && row.rawMaterialCode.toLowerCase().includes(q)) ||
          (row.lotsText && row.lotsText.toLowerCase().includes(q)) ||
          (row.batchCodesText && row.batchCodesText.toLowerCase().includes(q)) ||
          (row.usedForText && row.usedForText.toLowerCase().includes(q)) ||
          (row.daysText && row.daysText.toLowerCase().includes(q));
        if (!match) return false;
      }
      return true;
    });
  }, [uniqueRawMaterialsSummary, entireRmCategoryFilter, entireRmDayFilter, entireRmSearch]);

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

  // Day short batch codes list (strictly calculated from completed days only)
  const allBatchCodes = Array.from(
    new Set(normalizedDays.map(d => d.dayBatchCode).filter(Boolean))
  ).join(', ') || batch?.shortBatchCode || '—';

  const triggerPdfDownload = (pdfMode = 'full', forceDayNo = null) => {
    const targetDay = forceDayNo !== null
      ? Number(forceDayNo)
      : (selectedReportDayNo === 'ALL' ? null : Number(selectedReportDayNo));
    exportCleanSheetPdf({
      mode: 'full',
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
        preEvapMixVolumeMl,
        totalBeforeEvapMl: preEvapMixVolumeMl,
        evaporationLossMl,
        evaporationPct,
        netPostEvapMixMl,
        mergeStageName,
        totalAllocatedMixMl,
        totalWasteMixMl,
        remainingMixBalanceMl: isCompleted ? 0 : remainingTankMixMl,
        totalBasePreparedCost: totalBaseConsumedCost,
        totalBaseConsumedCost: scopedBaseRmCost,
        baseCostPerMl,
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
      entireProductionRmLines,
      uniqueRawMaterialsSummary,
      dayEntries: normalizedDays,
      yieldRows: consolidatedYieldRows,
      timelineStages,
      productStagesMap,
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
              onClick={() => triggerPdfDownload('full')}
              className="h-8 px-4 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs flex items-center gap-1.5 cursor-pointer"
              title="Download Full Clean Sheet PDF"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download Full PDF</span>
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
                        {formatAssignedStaff(staffList, d.completedBy || d.startedBy || batch?.startedBy)}
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

        {/* ── 3. SECTION 1: BASE RAW MATERIAL CONSUMPTION & INVENTORY LOT TRACEABILITY ── */}
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-md bg-indigo-600 text-white font-bold text-xs flex items-center justify-center">
                1
              </span>
              <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
                Base Raw Material Consumption &amp; Inventory Lot Traceability
              </h3>
            </div>
            <span className="text-xs text-slate-500 font-mono">
              {baseRmLines.length} Base Materials Used • Tank Preparation &amp; Formulation Valuation
            </span>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700">
                  <th className="py-2.5 px-3">Code</th>
                  <th className="py-2.5 px-3">Raw Material Name</th>
                  <th className="py-2.5 px-3 font-mono">RM Batch / Lot No</th>
                  <th className="py-2.5 px-3 text-right">Consumed Qty</th>
                  <th className="py-2.5 px-3 text-center">Expiry Date</th>
                  {canViewCost && <th className="py-2.5 px-3 text-right">Unit Rate</th>}
                  {canViewCost && <th className="py-2.5 px-3 text-right">Total Cost</th>}
                  <th className="py-2.5 px-3 text-right">Liquid / Evap</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-mono">
                {baseRmLines.length === 0 ? (
                  <tr>
                    <td colSpan={canViewCost ? 8 : 6} className="py-4 px-3 text-center font-sans text-slate-400">
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
                        <td className="py-2.5 px-3 text-right text-blue-600 dark:text-blue-400 font-bold">
                          {formatIndian(liquidMl)} ml {evaporates ? '(Evap)' : ''}
                        </td>
                      </tr>
                    )];
                  })
                )}
              </tbody>
              <tfoot className="bg-slate-50 dark:bg-slate-800 font-bold text-slate-900 dark:text-white border-t border-slate-200 dark:border-slate-700 font-mono">
                <tr className="divide-x divide-slate-200 dark:divide-slate-700">
                  <td colSpan={3} className="py-2.5 px-3 font-sans uppercase">
                    TOTAL: {baseRmLines.length} Base Materials
                  </td>
                  <td className="py-2.5 px-3 text-right font-black text-slate-900 dark:text-white">
                    <div>{formatIndian(totalBaseTakenQty)} {baseUomEntries.length === 1 ? baseUomEntries[0][0] : ''}</div>
                  </td>
                  <td className="py-2.5 px-3 text-center text-slate-400">—</td>
                  {canViewCost && <td className="py-2.5 px-3 text-right">Total Base:</td>}
                  {canViewCost && <td className="py-2.5 px-3 text-right text-emerald-600 dark:text-emerald-400 font-black">₹{formatIndian(totalBaseConsumedCost)}</td>}
                  <td className="py-2.5 px-3 text-right text-blue-600 dark:text-blue-400 font-black">{formatIndian(totalBaseLiquidVolumeMl)} ml</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Audited Multi-Day Base Mix Allocation Callout */}
          <div className="p-3.5 rounded-xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-900/60 text-xs font-mono">
            <div className="flex items-center justify-between flex-wrap gap-2 mb-2 pb-2 border-b border-indigo-200/80 dark:border-indigo-900/40">
              <span className="font-sans font-bold text-indigo-900 dark:text-indigo-200 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                <Factory className="w-3.5 h-3.5 text-indigo-600" />
                Base Mix Allocation Audit &amp; Multi-Day Economics
              </span>
              <span className="text-[10px] text-indigo-700 dark:text-indigo-300 font-bold bg-white dark:bg-slate-900 px-2 py-0.5 rounded border border-indigo-200 dark:border-indigo-800">
                Formula Rate: ₹{baseCostPerMl.toFixed(4)} / ml
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-indigo-200/70 dark:border-indigo-900/40">
                <span className="block text-[9.5px] uppercase font-bold text-slate-500 font-sans">1. Base Mix Prepared (Tank)</span>
                <span className="text-sm font-black text-slate-900 dark:text-white">{formatIndian(netPostEvapMixMl, 0)} ml</span>
                <span className="block text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">₹{formatIndian(totalBaseConsumedCost)} total value</span>
              </div>
              <div className="bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-indigo-200/70 dark:border-indigo-900/40">
                <span className="block text-[9.5px] uppercase font-bold text-purple-600 dark:text-purple-400 font-sans">2. Allocated Mix Consumed ({durationDaysLabel})</span>
                <span className="text-sm font-black text-purple-700 dark:text-purple-300">{formatIndian(totalAllocatedMixMl, 0)} ml</span>
                <span className="block text-[10px] text-purple-600 dark:text-purple-400 font-bold">₹{formatIndian(scopedBaseRmCost)} ({round2(preEvapMixVolumeMl > 0 ? (totalAllocatedMixMl / preEvapMixVolumeMl) * 100 : 0)}% of pool)</span>
              </div>
              <div className="bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-indigo-200/70 dark:border-indigo-900/40">
                <span className="block text-[9.5px] uppercase font-bold text-amber-600 dark:text-amber-400 font-sans">3. Unallocated Tank Balance</span>
                <span className="text-sm font-black text-amber-700 dark:text-amber-300">{formatIndian(isCompleted ? 0 : remainingTankMixMl, 0)} ml</span>
                <span className="block text-[10px] text-slate-500 font-sans">{isCompleted ? 'Batch finalized' : `₹${formatIndian(round2(remainingTankMixMl * baseCostPerMl))} available for next day`}</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── 4. SECTION 2: ENTIRE PRODUCTION RAW MATERIAL CONSUMPTION & LOT TRACEABILITY (MASTER SINGLE TABLE) ── */}
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-md bg-emerald-600 text-white font-bold text-xs flex items-center justify-center">
                2
              </span>
              <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
                Entire Raw Material Consumption &amp; Lot Traceability — Master Production Ledger
              </h3>
            </div>

            {/* View Mode Switcher: 21 Unique Raw Materials vs All 46 Detailed Lot Entries vs Both */}
            <div className="inline-flex items-center p-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono text-xs shadow-2xs">
              <button
                type="button"
                onClick={() => setRmTableViewMode('UNIQUE')}
                className={`px-3 py-1 rounded-md font-bold transition-all flex items-center gap-1.5 ${
                  rmTableViewMode === 'UNIQUE'
                    ? 'bg-emerald-600 text-white shadow-2xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Boxes className="w-3.5 h-3.5" />
                <span>21 Unique Raw Materials ({uniqueRawMaterialsSummary.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setRmTableViewMode('DETAILED')}
                className={`px-3 py-1 rounded-md font-bold transition-all flex items-center gap-1.5 ${
                  rmTableViewMode === 'DETAILED'
                    ? 'bg-indigo-600 text-white shadow-2xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>All 46 Detailed Lot Entries ({entireProductionRmLines.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setRmTableViewMode('BOTH')}
                className={`px-3 py-1 rounded-md font-bold transition-all flex items-center gap-1.5 ${
                  rmTableViewMode === 'BOTH'
                    ? 'bg-slate-900 text-white dark:bg-slate-200 dark:text-slate-900 shadow-2xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Show Both Tables</span>
              </button>
            </div>
          </div>

          {/* Quick Filters Strip: Search, Category Tabs & Day Selector */}
          <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 flex-1 max-w-md">
              <div className="relative w-full">
                <input
                  type="text"
                  value={entireRmSearch}
                  onChange={(e) => setEntireRmSearch(e.target.value)}
                  placeholder="Filter by RM name, code, lot number, batch, product, or day..."
                  className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-hidden focus:ring-1 focus:ring-emerald-500 font-mono"
                />
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              </div>
              {entireRmSearch && (
                <button
                  type="button"
                  onClick={() => setEntireRmSearch('')}
                  className="px-2 py-1 text-[11px] font-bold text-slate-500 hover:text-slate-800 dark:hover:text-white bg-slate-200 dark:bg-slate-700 rounded-md shrink-0"
                >
                  Clear
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Category Filter */}
              <div className="inline-flex items-center p-0.5 rounded-lg bg-slate-200 dark:bg-slate-700 font-mono text-[11px]">
                {[
                  { id: 'ALL', label: `All (${uniqueRawMaterialsSummary.length} RMs / ${entireProductionRmLines.length} Lots)` },
                  { id: 'BASE', label: `Base Mix (${uniqueRawMaterialsSummary.filter(r => r.sourceTypes.has('BASE')).length})` },
                  { id: 'PRODUCT_RM', label: `Added RMs (${uniqueRawMaterialsSummary.filter(r => r.sourceTypes.has('PRODUCT_RM')).length})` }
                ].map(tab => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setEntireRmCategoryFilter(tab.id)}
                    className={`px-2.5 py-1 rounded-md font-bold transition-all ${
                      entireRmCategoryFilter === tab.id
                        ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-2xs'
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Day Scope Filter for this table */}
              {normalizedDays.length > 1 && (
                <div className="inline-flex items-center p-0.5 rounded-lg bg-slate-200 dark:bg-slate-700 font-mono text-[11px]">
                  <button
                    type="button"
                    onClick={() => setEntireRmDayFilter('ALL')}
                    className={`px-2 py-1 rounded-md font-bold transition-all ${
                      entireRmDayFilter === 'ALL'
                        ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-2xs'
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                    }`}
                  >
                    All Days
                  </button>
                  {normalizedDays.map(d => (
                    <button
                      key={`entire-day-btn-${d.dayNo}`}
                      type="button"
                      onClick={() => setEntireRmDayFilter(String(d.dayNo))}
                      className={`px-2 py-1 rounded-md font-bold transition-all ${
                        entireRmDayFilter === String(d.dayNo)
                          ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-2xs'
                          : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                      }`}
                    >
                      Day {d.dayNo}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ══════════════════════════════════════════════════════════════════════════════ */}
          {/* ── TABLE 1: 21 UNIQUE RAW MATERIALS CONSOLIDATED MASTER TABLE (TOTAL AMOUNT) ── */}
          {/* ══════════════════════════════════════════════════════════════════════════════ */}
          {(rmTableViewMode === 'UNIQUE' || rmTableViewMode === 'BOTH') && (
            <div className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <span className="font-sans font-bold text-slate-800 dark:text-slate-200 text-xs flex items-center gap-1.5 uppercase tracking-wide">
                  <Boxes className="w-4 h-4 text-emerald-600" />
                  <span>21 Unique Raw Materials Consolidated Summary ({filteredUniqueRmLines.length} Materials)</span>
                </span>
                <span className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                  Rollup across all days, outputs &amp; formulation stages
                </span>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-emerald-50/80 dark:bg-emerald-950/40 text-emerald-950 dark:text-emerald-200 font-bold border-b border-emerald-200 dark:border-emerald-800 text-[11px]">
                      <th className="py-2.5 px-3 w-10 text-center">#</th>
                      <th className="py-2.5 px-3">RM Code</th>
                      <th className="py-2.5 px-3 font-sans">Raw Material Description</th>
                      <th className="py-2.5 px-3 text-center font-sans">Material Type</th>
                      <th className="py-2.5 px-3">Used In (Days)</th>
                      <th className="py-2.5 px-3 font-sans">Target Products / Usage Stages</th>
                      <th className="py-2.5 px-3 font-mono">Traced Batch / Lot Numbers</th>
                      <th className="py-2.5 px-3 text-right">Total Consumed Qty</th>
                      <th className="py-2.5 px-3 text-center">Earliest Expiry</th>
                      <th className="py-2.5 px-3 text-center">Entries</th>
                      {canViewCost && <th className="py-2.5 px-3 text-right">Avg Unit Rate</th>}
                      {canViewCost && <th className="py-2.5 px-3 text-right font-black">Total Amount Used</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-mono text-[11.5px]">
                    {filteredUniqueRmLines.length === 0 ? (
                      <tr>
                        <td colSpan={canViewCost ? 12 : 10} className="py-6 px-3 text-center font-sans text-slate-400">
                          No unique raw materials match the selected filters.
                        </td>
                      </tr>
                    ) : (
                      filteredUniqueRmLines.map((row, rIdx) => {
                        const expInfo = getExpiryBadge(row.earliestExpiry);
                        return (
                          <tr
                            key={row.key || `unique-rm-${rIdx}`}
                            className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors"
                          >
                            <td className="py-2 px-3 text-center text-slate-400 font-bold">{rIdx + 1}</td>
                            <td className="py-2 px-3 text-slate-700 dark:text-slate-300 font-bold">
                              {row.rawMaterialCode}
                            </td>
                            <td className="py-2 px-3 font-sans font-extrabold text-slate-900 dark:text-white">
                              {row.rawMaterialName}
                            </td>
                            <td className="py-2 px-3 text-center font-sans">
                              <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border ${row.categoryBadgeCls}`}>
                                {row.categoryLabel}
                              </span>
                            </td>
                            <td className="py-2 px-3 font-sans font-bold text-slate-800 dark:text-slate-200">
                              <span className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700 text-[10.5px]">
                                {row.daysText}
                              </span>
                            </td>
                            <td className="py-2 px-3 font-sans">
                              <div className="font-semibold text-slate-800 dark:text-slate-200 text-[11px] max-w-xs truncate" title={row.usedForText}>
                                {row.usedForText}
                              </div>
                            </td>
                            <td className="py-2 px-3 font-black text-indigo-600 dark:text-indigo-400 text-[11px] max-w-xs truncate" title={row.lotsText}>
                              {row.lotsText}
                            </td>
                            <td className="py-2 px-3 text-right font-black text-slate-900 dark:text-white">
                              {formatIndian(row.totalConsumedQty, 2)} {row.uom}
                            </td>
                            <td className={`py-2 px-3 text-center ${expInfo.cls}`}>
                              {expInfo.label}
                            </td>
                            <td className="py-2 px-3 text-center font-sans">
                              <span className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-1.5 py-0.5 rounded text-[10px] font-bold">
                                {row.entriesCount}
                              </span>
                            </td>
                            {canViewCost && (
                              <td className="py-2 px-3 text-right text-slate-600 dark:text-slate-400">
                                ₹{formatIndian(row.avgRate, 2)} / {row.uom}
                              </td>
                            )}
                            {canViewCost && (
                              <td className="py-2 px-3 text-right font-black text-emerald-600 dark:text-emerald-400">
                                ₹{formatIndian(row.totalCost, 2)}
                              </td>
                            )}
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                  <tfoot className="bg-emerald-50/60 dark:bg-emerald-950/30 font-bold text-slate-900 dark:text-white border-t border-emerald-200 dark:border-emerald-800 font-mono text-[11px]">
                    <tr className="divide-x divide-slate-200 dark:divide-slate-700">
                      <td colSpan={7} className="py-2.5 px-3 font-sans uppercase">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <span className="text-xs font-black text-emerald-900 dark:text-emerald-200">
                            TOTAL: {filteredUniqueRmLines.length} Unique Raw Materials Consumed
                          </span>
                          <span className="text-[10.5px] text-slate-500 font-normal">
                            Base Materials: {filteredUniqueRmLines.filter(r => r.sourceTypes.has('BASE')).length} • Product Materials &amp; Packaging: {filteredUniqueRmLines.filter(r => r.sourceTypes.has('PRODUCT_RM')).length}
                          </span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-right font-black text-slate-900 dark:text-white">
                        {formatIndian(filteredUniqueRmLines.reduce((s, r) => s + Number(r.totalConsumedQty || 0), 0), 2)}
                      </td>
                      <td colSpan={2} className="py-2.5 px-3 text-center text-slate-500 font-sans text-[10.5px]">
                        {new Set(filteredUniqueRmLines.flatMap(r => Array.from(r.lotBatchNumbers))).size} Unique Lots Traced
                      </td>
                      {canViewCost && <td className="py-2.5 px-3 text-right font-sans uppercase text-[10px] text-slate-600 dark:text-slate-400">Grand Total Amount:</td>}
                      {canViewCost && (
                        <td className="py-2.5 px-3 text-right text-emerald-600 dark:text-emerald-400 font-black text-xs">
                          ₹{formatIndian(filteredUniqueRmLines.reduce((s, r) => s + Number(r.totalCost || 0), 0), 2)}
                        </td>
                      )}
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════════════════ */}
          {/* ── TABLE 2: ALL 46 DETAILED MATERIAL & LOT ALLOCATION ENTRIES TABLE ───────── */}
          {/* ══════════════════════════════════════════════════════════════════════════════ */}
          {(rmTableViewMode === 'DETAILED' || rmTableViewMode === 'BOTH') && (
            <div className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <span className="font-sans font-bold text-slate-800 dark:text-slate-200 text-xs flex items-center gap-1.5 uppercase tracking-wide">
                  <Layers className="w-4 h-4 text-indigo-600" />
                  <span>All 46 Detailed Lot Allocations &amp; Day-Wise Traceability Ledger ({filteredEntireRmLines.length} Entries)</span>
                </span>
                <span className="text-[11px] font-mono text-indigo-600 dark:text-indigo-400 font-bold">
                  Complete day-by-day, output-by-output batch line items
                </span>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100 dark:bg-slate-800/90 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700 text-[11px]">
                      <th className="py-2.5 px-3 w-10 text-center">#</th>
                      <th className="py-2.5 px-3">Day &amp; Date</th>
                      <th className="py-2.5 px-3 font-mono">Day / Batch No</th>
                      <th className="py-2.5 px-3">RM Code</th>
                      <th className="py-2.5 px-3 font-sans">Raw Material Name</th>
                      <th className="py-2.5 px-3 font-sans">Used For / Target Product</th>
                      <th className="py-2.5 px-3 font-mono">RM Lot / Batch No</th>
                      <th className="py-2.5 px-3 text-right">Consumed Qty</th>
                      <th className="py-2.5 px-3 text-center">Lot Expiry</th>
                      <th className="py-2.5 px-3 text-center font-sans">Material Type</th>
                      {canViewCost && <th className="py-2.5 px-3 text-right">Unit Rate</th>}
                      {canViewCost && <th className="py-2.5 px-3 text-right">Total Cost</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-mono text-[11.5px]">
                    {filteredEntireRmLines.length === 0 ? (
                      <tr>
                        <td colSpan={canViewCost ? 12 : 10} className="py-6 px-3 text-center font-sans text-slate-400">
                          No raw materials match the selected filters.
                        </td>
                      </tr>
                    ) : (
                      filteredEntireRmLines.map((row, rIdx) => {
                        const expInfo = getExpiryBadge(row.expiryDate);
                        return (
                          <tr
                            key={row.id || `entire-rm-${rIdx}`}
                            className={`hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors ${
                              row.sourceType === 'BASE' ? 'bg-indigo-50/20 dark:bg-indigo-950/10' : ''
                            }`}
                          >
                            <td className="py-2 px-3 text-center text-slate-400 font-bold">{rIdx + 1}</td>
                            <td className="py-2 px-3 font-sans">
                              <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1">
                                <Calendar className="w-3 h-3 text-indigo-500" />
                                <span>{row.dayLabel}</span>
                              </div>
                              <div className="text-[10px] text-slate-500 font-mono">
                                {formatDateDMY(row.productionDate)}
                              </div>
                            </td>
                            <td className="py-2 px-3 font-bold text-slate-800 dark:text-slate-200">
                              <span className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700 text-[10.5px]">
                                {row.dayBatchCode || '—'}
                              </span>
                            </td>
                            <td className="py-2 px-3 text-slate-600 dark:text-slate-400 font-bold">
                              {row.rawMaterialCode}
                            </td>
                            <td className="py-2 px-3 font-sans font-extrabold text-slate-900 dark:text-white">
                              {row.rawMaterialName}
                            </td>
                            <td className="py-2 px-3 font-sans">
                              <div className="font-bold text-slate-800 dark:text-slate-100 text-[11px]">
                                {row.usedFor}
                              </div>
                              {row.usedForSub && (
                                <div className="text-[9.5px] text-slate-500 font-mono">
                                  {row.usedForSub}
                                </div>
                              )}
                            </td>
                            <td className="py-2 px-3 font-black text-indigo-600 dark:text-indigo-400 text-[11px]">
                              {row.lotBatchNo}
                            </td>
                            <td className="py-2 px-3 text-right font-bold text-slate-900 dark:text-white">
                              {formatIndian(row.consumedQty, 2)} {row.uom}
                            </td>
                            <td className={`py-2 px-3 text-center ${expInfo.cls}`}>
                              {expInfo.label}
                            </td>
                            <td className="py-2 px-3 text-center font-sans">
                              <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border ${row.categoryBadgeCls}`}>
                                {row.sourceCategory}
                              </span>
                            </td>
                            {canViewCost && (
                              <td className="py-2 px-3 text-right text-slate-600 dark:text-slate-400">
                                ₹{formatIndian(row.unitRate, 2)} / {row.uom}
                              </td>
                            )}
                            {canViewCost && (
                              <td className="py-2 px-3 text-right font-black text-emerald-600 dark:text-emerald-400">
                                ₹{formatIndian(row.totalCost, 2)}
                              </td>
                            )}
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                  <tfoot className="bg-slate-50 dark:bg-slate-800/90 font-bold text-slate-900 dark:text-white border-t border-slate-200 dark:border-slate-700 font-mono text-[11px]">
                    <tr className="divide-x divide-slate-200 dark:divide-slate-700">
                      <td colSpan={7} className="py-2.5 px-3 font-sans uppercase">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <span className="text-xs">
                            TOTAL: {filteredEntireRmLines.length} Material Entries ({new Set(filteredEntireRmLines.map(r => r.rawMaterialName)).size} Unique Raw Materials)
                          </span>
                          <span className="text-[10px] text-slate-500 font-normal">
                            Base RMs: {filteredEntireRmLines.filter(r => r.sourceType === 'BASE').length} • Added RMs: {filteredEntireRmLines.filter(r => r.sourceType === 'PRODUCT_RM').length}
                          </span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-right font-black text-slate-900 dark:text-white">
                        {formatIndian(filteredEntireRmLines.reduce((s, r) => s + Number(r.consumedQty || 0), 0), 2)}
                      </td>
                      <td colSpan={2} className="py-2.5 px-3 text-center text-slate-400 font-sans text-[10.5px]">
                        {filteredEntireRmLines.length} Lots Traced
                      </td>
                      {canViewCost && <td className="py-2.5 px-3 text-right font-sans uppercase text-[10px] text-slate-500">Grand Total RM Cost:</td>}
                      {canViewCost && (
                        <td className="py-2.5 px-3 text-right text-emerald-600 dark:text-emerald-400 font-black text-xs">
                          ₹{formatIndian(filteredEntireRmLines.reduce((s, r) => s + Number(r.totalCost || 0), 0), 2)}
                        </td>
                      )}
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* ── 5. SECTION 3: DAY-WISE PRODUCTION BREAKDOWN & PER-PRODUCT RM TRACEABILITY ── */}
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-md bg-indigo-600 text-white font-bold text-xs flex items-center justify-center">
                3
              </span>
              <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
                Day-Wise Production Breakdown &amp; Per-Product RM Traceability
              </h3>
            </div>
            <span className="text-xs text-slate-500 font-mono">
              Showing {scopedDays.length} of {normalizedDays.length} Day{normalizedDays.length > 1 ? 's' : ''} Recorded • Product Batches, Moulds &amp; Direct RM Traceability
            </span>
          </div>

          <div className="space-y-5">
            {scopedDays.map(d => {
              const dayBaseCost = round2(Number(d.allocatedMixMl || 0) * baseCostPerMl);
              return (
                <div
                  key={`report-day-${d.id || d.dayNo}`}
                  className="bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-900/70 rounded-xl overflow-hidden shadow-2xs print-break-avoid"
                >
                  {/* Day Header Strip */}
                  <div className="px-4 py-3 bg-gradient-to-r from-indigo-50 via-slate-50 to-white dark:from-indigo-950/60 dark:via-slate-900 dark:to-slate-900 border-b border-indigo-200/80 dark:border-indigo-900/60 flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2.5 py-0.5 rounded-md bg-indigo-600 text-white font-mono text-xs font-black">
                        DAY {d.dayNo}
                      </span>
                      <span className="font-mono text-xs font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-indigo-500" />
                        PRODUCTION DATE: {formatDateDMY(d.productionDate)}
                      </span>
                      <span className="font-mono text-xs font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-100/70 dark:bg-indigo-950/70 px-2 py-0.5 rounded border border-indigo-200 dark:border-indigo-800">
                        DAY BATCH NO: {d.dayBatchCode || '—'}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        d.pushedToSales
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800'
                          : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800'
                      }`}>
                        {d.pushedToSales ? 'Pushed to Sales' : d.statusLabel}
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
                    </div>
                  </div>

                  {/* Day Staff & Flow Meta */}
                  <div className="px-4 py-2 bg-slate-50/70 dark:bg-slate-800/40 border-b border-slate-200 dark:border-slate-800 text-[11px] font-mono flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                      <strong className="text-slate-500 uppercase font-sans text-[10px]">ASSIGNED STAFF:</strong>
                      <span className="font-bold text-slate-900 dark:text-white">
                        {formatAssignedStaff(d.assignedUsers, d.completedBy || d.startedBy || batch?.startedBy)}
                      </span>
                    </div>
                    <div className="text-purple-700 dark:text-purple-300 font-bold">
                      Mix Flow: Open {formatIndian(d.openingMixMl, 0)} ml → Used {formatIndian(d.allocatedMixMl, 0)} ml → Rem {formatIndian(d.remainingMixMl, 0)} ml | Output: {formatIndian(d.totalOutputQty, 0)} (Rej: {formatIndian(d.totalRejectedQty, 0)})
                    </div>
                  </div>

                  {/* Day Body: Products Table */}
                  <div className="p-3.5 space-y-4">
                    {Array.isArray(d.outputs) && d.outputs.length > 0 ? (
                      <>
                        <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
                          <table className="w-full text-left text-[11.5px] font-mono border-collapse">
                            <thead>
                              <tr className="bg-slate-900 text-white text-[10px] uppercase border-b border-slate-800">
                                <th className="py-2 px-2.5">#</th>
                                <th className="py-2 px-2.5 font-sans">Product / Batch &amp; Serial No</th>
                                <th className="py-2 px-2.5 font-sans">Mould / Spec</th>
                                <th className="py-2 px-2.5 text-right">Mix Used &amp; Base Cost</th>
                                <th className="py-2 px-2.5 text-right">Planned</th>
                                <th className="py-2 px-2.5 text-right text-emerald-400">Actual Good</th>
                                <th className="py-2 px-2.5 text-right text-rose-400">Reject</th>
                                <th className="py-2 px-2.5 text-right">Yield %</th>
                                {canViewCost && <th className="py-2 px-2.5 text-right text-emerald-400 font-black">Cost / Unit</th>}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                              {d.outputs.map((out, oIdx) => {
                                const outBaseCost = round2(Number(out.allocatedBaseMl || 0) * baseCostPerMl);
                                return (
                                  <tr key={`rep-day-out-${d.dayNo}-${out.id || oIdx}`} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/30">
                                    <td className="py-2.5 px-2.5 font-bold text-slate-500">#{out.seq || oIdx + 1}</td>
                                    <td className="py-2.5 px-2.5 font-sans">
                                      <div className="font-extrabold text-slate-900 dark:text-white text-xs">{out.productName}</div>
                                      <div className="font-mono text-[10px] text-indigo-700 dark:text-indigo-300 font-bold mt-0.5">
                                        B: {out.productBatchNo || '—'} | S: {out.productSerialNo || '—'}
                                      </div>
                                    </td>
                                    <td className="py-2.5 px-2.5 font-sans text-[11px] text-slate-600 dark:text-slate-300">
                                      {out.useMould !== false && out.mouldCode
                                        ? `${out.mouldCode} (${out.trays || 0}T × ${out.cavities || 1}C)`
                                        : `Bulk (${out.bulkUom || out.uom})`}
                                    </td>
                                    <td className="py-2.5 px-2.5 text-right font-bold text-purple-700 dark:text-purple-400">
                                      <div>{formatIndian(out.allocatedBaseMl, 0)} ml</div>
                                      {canViewCost && (
                                        <div className="text-[10px] text-slate-500 font-normal">
                                          (₹{formatIndian(outBaseCost)})
                                        </div>
                                      )}
                                    </td>
                                    <td className="py-2.5 px-2.5 text-right text-slate-600 dark:text-slate-400">
                                      {formatIndian(out.theoreticalQty, 0)} {out.uom}
                                    </td>
                                    <td className="py-2.5 px-2.5 text-right font-black text-emerald-700 dark:text-emerald-400">
                                      {formatIndian(out.actualYield, 0)} {out.uom}
                                    </td>
                                    <td className="py-2.5 px-2.5 text-right font-bold text-rose-600 dark:text-rose-400">
                                      {formatIndian(out.rejectOutput, 0)}
                                    </td>
                                    <td className="py-2.5 px-2.5 text-right font-bold text-slate-800 dark:text-slate-200">
                                      {out.yieldPct}%
                                    </td>
                                    {canViewCost && (
                                      <td className="py-2.5 px-2.5 text-right font-bold text-slate-900 dark:text-white">
                                        <div className="text-emerald-600 dark:text-emerald-400 font-black">
                                          ₹{formatIndian(out.unitCost)}
                                        </div>
                                        <div className="text-[10px] text-slate-400 font-normal">
                                          (Tot ₹{formatIndian(out.totalCost)})
                                        </div>
                                      </td>
                                    )}
                                  </tr>
                                );
                              })}
                            </tbody>
                            <tfoot className="bg-slate-50 dark:bg-slate-800/80 font-bold border-t border-slate-200 dark:border-slate-700">
                              <tr>
                                <td colSpan={3} className="py-2 px-2.5 font-sans uppercase text-[10px] text-slate-700 dark:text-slate-200">
                                  TOTAL Day {d.dayNo} Output Total
                                </td>
                                <td className="py-2 px-2.5 text-right text-purple-700 dark:text-purple-400">
                                  <div>{formatIndian(d.allocatedMixMl, 0)} ml</div>
                                  {canViewCost && (
                                    <div className="text-[10px] text-slate-500 font-normal">
                                      (₹{formatIndian(dayBaseCost)})
                                    </div>
                                  )}
                                </td>
                                <td className="py-2 px-2.5 text-right">{formatIndian(d.totalExpectedQty, 0)}</td>
                                <td className="py-2 px-2.5 text-right text-emerald-700 dark:text-emerald-400 font-black">{formatIndian(d.totalOutputQty, 0)}</td>
                                <td className="py-2 px-2.5 text-right text-rose-600">{formatIndian(d.totalRejectedQty, 0)}</td>
                                <td className="py-2 px-2.5 text-right">
                                  {d.totalExpectedQty > 0 ? `${round2((d.totalOutputQty / d.totalExpectedQty) * 100)}%` : '—'}
                                </td>
                                {canViewCost && (
                                  <td className="py-2 px-2.5 text-right font-black text-slate-900 dark:text-white">
                                    ₹{formatIndian(d.outputs.reduce((s, o) => s + Number(o.totalCost || 0), 0))}
                                  </td>
                                )}
                              </tr>
                            </tfoot>
                          </table>
                        </div>

                        {/* Dedicated Single Table Per Finished Product with Distinct Theme Colors */}
                        <div className="space-y-3 pt-1">
                          <div className="text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                            <Boxes className="w-3.5 h-3.5 text-indigo-600" />
                            <span>Product-Wise Raw Material Consumption &amp; Formulation Ledger — Day {d.dayNo} ({formatDateDMY(d.productionDate)})</span>
                          </div>

                          <div className="space-y-3">
                            {d.outputs.map((out, oIdx) => {
                              const theme = PRODUCT_THEMES[oIdx % PRODUCT_THEMES.length];
                              const outBaseCost = round2(Number(out.allocatedBaseMl || 0) * baseCostPerMl);
                              const prms = Array.isArray(out.productRms) ? out.productRms : [];
                              const addedCost = round2(
                                prms.reduce((s, prm) => {
                                  const taken = Number(prm.takenQty ?? prm.qty ?? prm.quantity ?? 0);
                                  const rate = Number(prm.unitRate ?? prm.rate ?? 0);
                                  const cost = Number(prm.totalCost) > 0 ? Number(prm.totalCost) : taken * rate;
                                  return s + cost;
                                }, 0)
                              );
                              const totalMatCost = round2(outBaseCost + addedCost);
                              const matUnitCost = out.actualYield > 0 ? round2(totalMatCost / out.actualYield) : 0;

                              return (
                                <div
                                  key={`prod-rm-box-${d.dayNo}-${out.seq || oIdx}`}
                                  className={`rounded-xl border ${theme.border} bg-white dark:bg-slate-900 overflow-hidden shadow-2xs`}
                                >
                                  {/* Distinct Color Header Strip */}
                                  <div className={`px-3 py-2 ${theme.headerBg} flex items-center justify-between flex-wrap gap-2 text-xs font-mono`}>
                                    <div className="flex items-center gap-2">
                                      <span className="w-5 h-5 rounded-md bg-white/20 text-white font-bold text-[11px] flex items-center justify-center">
                                        #{out.seq || oIdx + 1}
                                      </span>
                                      <span className="font-sans font-black text-sm tracking-wide text-white">
                                        {out.productName}
                                      </span>
                                      <span className="text-[10.5px] opacity-90 font-mono">
                                        ({out.productCode || 'FP'})
                                      </span>
                                      <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded text-white font-bold">
                                        {out.useMould !== false && out.mouldCode ? out.mouldCode : `Bulk (${out.bulkUom || out.uom})`}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-2.5 text-xs">
                                      <span>Good: <strong>{formatIndian(out.actualYield, 0)} {out.uom}</strong></span>
                                      <span>•</span>
                                      <span>Batch: <strong>{out.productBatchNo || '—'}</strong></span>
                                    </div>
                                  </div>

                                  {/* Unified Per-Product Material Table (Base Mix Row 1 + Added RMs) */}
                                  <div className="overflow-x-auto">
                                    <table className="w-full text-left text-[11px] font-mono border-collapse">
                                      <thead>
                                        <tr className={`${theme.tableHead} text-[9.5px] uppercase font-bold border-b border-slate-200 dark:border-slate-800`}>
                                          <th className="py-1.5 px-3">Item / Code</th>
                                          <th className="py-1.5 px-3 font-sans">Raw Material Description</th>
                                          <th className="py-1.5 px-3">Lot / Batch No</th>
                                          <th className="py-1.5 px-3 text-right">Consumed Qty</th>
                                          <th className="py-1.5 px-3 text-center">Lot Expiry</th>
                                          <th className="py-1.5 px-3 font-sans">Purpose / Mix</th>
                                          {canViewCost && <th className="py-1.5 px-3 text-right">Unit Rate</th>}
                                          {canViewCost && <th className="py-1.5 px-3 text-right">Total Cost</th>}
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                                        {/* Line 1: Allocated Base Mix Formulation */}
                                        <tr className="bg-indigo-50/40 dark:bg-indigo-950/20 font-semibold">
                                          <td className="py-2 px-3 font-bold text-indigo-700 dark:text-indigo-300">[BASE-MIX]</td>
                                          <td className="py-2 px-3 font-sans font-extrabold text-slate-900 dark:text-white">
                                            Base Mix Formulation (Allocated Share)
                                          </td>
                                          <td className="py-2 px-3 font-bold text-indigo-600 dark:text-indigo-400">
                                            {d.dayBatchCode || batch?.shortBatchCode || 'BASE-MIX'}
                                          </td>
                                          <td className="py-2 px-3 text-right font-black text-purple-700 dark:text-purple-300">
                                            {formatIndian(out.allocatedBaseMl, 0)} ml
                                          </td>
                                          <td className="py-2 px-3 text-center text-slate-600 dark:text-slate-300">
                                            {baseMixExpiryDate ? formatDateDMY(baseMixExpiryDate) : '—'}
                                          </td>
                                          <td className="py-2 px-3 font-sans text-[10px] text-indigo-600 dark:text-indigo-400 font-bold">
                                            Primary Base Form
                                          </td>
                                          {canViewCost && (
                                            <td className="py-2 px-3 text-right text-slate-600 dark:text-slate-400">
                                              ₹{baseCostPerMl.toFixed(4)} / ml
                                            </td>
                                          )}
                                          {canViewCost && (
                                            <td className="py-2 px-3 text-right font-black text-emerald-600 dark:text-emerald-400">
                                              ₹{formatIndian(outBaseCost)}
                                            </td>
                                          )}
                                        </tr>

                                        {/* Subsequent Lines: Product-Specific Added RMs & Packaging */}
                                        {prms.map((prm, pIdx) => {
                                          const taken = Number(prm.takenQty ?? prm.qty ?? prm.quantity ?? 0);
                                          const rate = Number(prm.unitRate ?? prm.rate ?? 0);
                                          const rowCost = Number(prm.totalCost) > 0 ? Number(prm.totalCost) : round2(taken * rate);
                                          const expInfo = getExpiryBadge(prm.expiryDate);
                                          const isMix = prm.addToMix !== false;
                                          return (
                                            <tr key={`prm-row-${d.dayNo}-${out.seq}-${pIdx}`} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                                              <td className="py-1.5 px-3 text-slate-500 font-bold">
                                                {prm.rawMaterialCode || prm.rmCode || `RM-${pIdx + 1}`}
                                              </td>
                                              <td className="py-1.5 px-3 font-sans font-bold text-slate-900 dark:text-white">
                                                {prm.rawMaterialName || prm.rmName || 'Added Ingredient'}
                                              </td>
                                              <td className="py-1.5 px-3 font-bold text-indigo-600 dark:text-indigo-400">
                                                {prm.lotBatchNo || (Array.isArray(prm.allocatedBatches) && prm.allocatedBatches[0]?.lotNumber) || 'BATCH-DIRECT'}
                                              </td>
                                              <td className="py-1.5 px-3 text-right font-bold text-slate-900 dark:text-white">
                                                {formatIndian(taken, 2)} {formatCleanUom(prm.uom, 'pcs', prm)}
                                              </td>
                                              <td className={`py-1.5 px-3 text-center ${expInfo.cls}`}>
                                                {expInfo.label}
                                              </td>
                                              <td className="py-1.5 px-3 font-sans text-[10px] text-slate-500">
                                                {isMix ? `Mix (+${formatIndian(toMl(taken, prm.uom, Number(prm.density || 1)), 0)} ml)` : 'Packaging / Stick'}
                                              </td>
                                              {canViewCost && (
                                                <td className="py-1.5 px-3 text-right text-slate-700 dark:text-slate-300">
                                                  ₹{formatIndian(rate)}
                                                </td>
                                              )}
                                              {canViewCost && (
                                                <td className="py-1.5 px-3 text-right font-bold text-emerald-600 dark:text-emerald-400">
                                                  ₹{formatIndian(rowCost)}
                                                </td>
                                              )}
                                            </tr>
                                          );
                                        })}
                                      </tbody>
                                      {canViewCost && (
                                        <tfoot className={`${theme.footBg} font-bold border-t border-slate-200 dark:border-slate-800`}>
                                          <tr>
                                            <td colSpan={3} className="py-2 px-3 font-sans uppercase text-[10px] text-slate-700 dark:text-slate-300">
                                              Total Direct Materials Consumed — {out.productName}
                                            </td>
                                            <td colSpan={3} className="py-2 px-3 text-[10.5px] font-sans text-slate-600 dark:text-slate-400">
                                              Base Mix: <strong>₹{formatIndian(outBaseCost)}</strong> + Added RMs: <strong>₹{formatIndian(addedCost)}</strong>
                                            </td>
                                            <td className="py-2 px-3 text-right text-[10px] font-sans text-slate-500">
                                              ₹{formatIndian(matUnitCost)} / {out.uom}
                                            </td>
                                            <td className="py-2 px-3 text-right font-black text-emerald-600 dark:text-emerald-400 text-xs">
                                              ₹{formatIndian(totalMatCost)}
                                            </td>
                                          </tr>
                                        </tfoot>
                                      )}
                                    </table>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
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
              );
            })}
          </div>
        </div>

        {/* ── 6. SECTION 4: CONSOLIDATED YIELD REPORT & VARIANCE ACCOUNTING ── */}
        <div className="space-y-3 print-break-avoid">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-md bg-purple-600 text-white font-bold text-xs flex items-center justify-center">
                4
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

        {/* ── 7. SECTION 5: COMPREHENSIVE FINANCIAL COST STATEMENT ── */}
        {canViewCost && (
          <div className="space-y-4 print-break-avoid">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-md bg-slate-900 text-white font-bold text-xs flex items-center justify-center">
                  5
                </span>
                <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
                  Comprehensive Financial Cost Statement
                </h3>
              </div>
              <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 px-2.5 py-0.5 rounded border border-emerald-300 dark:border-emerald-700">
                AUDITED BATCH ECONOMICS
              </span>
            </div>

            {/* 4A. Overall Batch Audited Economics Table */}
            <div className="overflow-x-auto rounded-xl border border-slate-300 dark:border-slate-700">
              <table className="w-full text-left text-xs font-mono border-collapse">
                <thead>
                  <tr className="bg-slate-900 text-white text-[10.5px] uppercase font-bold">
                    <th className="py-2.5 px-3 font-sans">Cost Component</th>
                    <th className="py-2.5 px-3 font-sans">Basis / Remarks</th>
                    <th className="py-2.5 px-3 text-right">Amount (INR)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800 bg-white dark:bg-slate-900">
                  <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                    <td className="py-2.5 px-3 font-sans font-bold text-slate-900 dark:text-white">
                      1. Base Raw Materials Consumed (Allocated Mix)
                    </td>
                    <td className="py-2.5 px-3 font-sans text-slate-600 dark:text-slate-400">
                      Allocated share: {formatIndian(totalAllocatedMixMl, 0)} ml @ base mix rate (₹{baseCostPerMl.toFixed(4)}/ml)
                    </td>
                    <td className="py-2.5 px-3 text-right font-black text-slate-900 dark:text-white">
                      ₹{formatIndian(scopedBaseRmCost)}
                    </td>
                  </tr>
                  <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                    <td className="py-2.5 px-3 font-sans font-bold text-slate-900 dark:text-white">
                      2. Product-Specific Added RMs &amp; Packaging
                    </td>
                    <td className="py-2.5 px-3 font-sans text-slate-600 dark:text-slate-400">
                      Flavours, essences, sticks &amp; poly covers
                    </td>
                    <td className="py-2.5 px-3 text-right font-black text-purple-700 dark:text-purple-300">
                      ₹{formatIndian(totalAddedRmsCost)}
                    </td>
                  </tr>
                  <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                    <td className="py-2.5 px-3 font-sans font-bold text-slate-900 dark:text-white">
                      3. Direct Production Labour
                    </td>
                    <td className="py-2.5 px-3 font-sans text-slate-600 dark:text-slate-400">
                      Total crew cost across {scopedDays.length} day(s)
                    </td>
                    <td className="py-2.5 px-3 text-right font-black text-amber-600 dark:text-amber-400">
                      ₹{formatIndian(directLabourCost)}
                    </td>
                  </tr>
                  <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                    <td className="py-2.5 px-3 font-sans font-bold text-slate-900 dark:text-white">
                      4. Electricity &amp; Freezer Utilities (EB)
                    </td>
                    <td className="py-2.5 px-3 font-sans text-slate-600 dark:text-slate-400">
                      Metered chiller / tank / tunnel consumption
                    </td>
                    <td className="py-2.5 px-3 text-right font-black text-blue-600 dark:text-blue-400">
                      ₹{formatIndian(electricityCost)}
                    </td>
                  </tr>
                  <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                    <td className="py-2.5 px-3 font-sans font-bold text-slate-900 dark:text-white">
                      5. Factory Overheads
                    </td>
                    <td className="py-2.5 px-3 font-sans text-slate-600 dark:text-slate-400">
                      Allocated plant overhead charges
                    </td>
                    <td className="py-2.5 px-3 text-right font-black text-slate-800 dark:text-slate-200">
                      ₹{formatIndian(overheadCost)}
                    </td>
                  </tr>
                </tbody>
                <tfoot className="bg-slate-900 text-white font-bold border-t-2 border-slate-900">
                  <tr>
                    <td className="py-3 px-3 font-sans uppercase font-black tracking-wider text-emerald-400 text-xs">
                      GRAND TOTAL PRODUCTION COST
                    </td>
                    <td className="py-3 px-3 font-sans text-emerald-300 text-xs">
                      Unit Cost = <strong className="text-white">₹{formatIndian(costPerUnit)}</strong> / {productUom} (Good Output: {formatIndian(actualGood, 0)} {productUom})
                    </td>
                    <td className="py-3 px-3 text-right font-black text-emerald-300 text-sm">
                      ₹{formatIndian(totalCost)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* 4B. Comprehensive Financial Cost Statement For Each Finished Product */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5 font-sans">
                  <Boxes className="w-3.5 h-3.5 text-indigo-600" />
                  Comprehensive Financial Cost Statement For Each Finished Product
                </h4>
                <span className="text-[10px] text-slate-500 font-mono">
                  Direct Cost Attribution &amp; Per-SKU Unit Valuation
                </span>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {scopedDays.flatMap(d => d.outputs || []).map((out, oIdx) => {
                  const theme = PRODUCT_THEMES[oIdx % PRODUCT_THEMES.length];
                  const outBaseCost = round2(Number(out.allocatedBaseMl || 0) * baseCostPerMl);
                  const prms = Array.isArray(out.productRms) ? out.productRms : [];
                  const addedCost = round2(
                    prms.reduce((s, prm) => {
                      const taken = Number(prm.takenQty ?? prm.qty ?? prm.quantity ?? 0);
                      const rate = Number(prm.unitRate ?? prm.rate ?? 0);
                      const cost = Number(prm.totalCost) > 0 ? Number(prm.totalCost) : taken * rate;
                      return s + cost;
                    }, 0)
                  );
                  const outLabour = Number(out.allocatedLabourCost ?? out.labourAllocatedAmt ?? 0);
                  const outEb = Number(out.allocatedEbCost ?? out.ebAllocatedAmt ?? 0);
                  const outOh = round2(Number(out.totalCost || 0) - (outBaseCost + addedCost + outLabour + outEb));
                  const safeOh = outOh > 0 ? outOh : 0;
                  const finalTotalCost = Number(out.totalCost || 0) > 0 ? Number(out.totalCost) : round2(outBaseCost + addedCost + outLabour + outEb + safeOh);
                  const finalUnitCost = Number(out.unitCost || 0) > 0 ? Number(out.unitCost) : (out.actualYield > 0 ? round2(finalTotalCost / out.actualYield) : 0);

                  return (
                    <div
                      key={`prod-cost-stmt-${out.productId || oIdx}`}
                      className={`rounded-xl border ${theme.border} bg-white dark:bg-slate-900 overflow-hidden shadow-2xs`}
                    >
                      {/* Product Card Header */}
                      <div className={`px-3 py-2.5 ${theme.headerBg} flex items-center justify-between flex-wrap gap-2 text-xs font-mono`}>
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-md bg-white/20 text-white font-bold text-[11px] flex items-center justify-center">
                            #{out.seq || oIdx + 1}
                          </span>
                          <div>
                            <span className="font-sans font-black text-sm tracking-wide text-white block">
                              {out.productName}
                            </span>
                            <span className="text-[10px] opacity-80 font-mono">
                              Batch: {out.productBatchNo || '—'} • Serial: {out.productSerialNo || '—'}
                            </span>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] font-sans uppercase opacity-90 block">Good Output</span>
                          <span className="text-sm font-black text-white">{formatIndian(out.actualYield, 0)} {out.uom}</span>
                        </div>
                      </div>

                      {/* Product Cost Table */}
                      <table className="w-full text-left text-[11px] font-mono border-collapse">
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                            <td className="py-1.5 px-3 font-sans text-slate-700 dark:text-slate-300">
                              1. Base Mix Formulation (Allocated)
                            </td>
                            <td className="py-1.5 px-3 text-slate-500 text-[10px]">
                              {formatIndian(out.allocatedBaseMl, 0)} ml @ ₹{baseCostPerMl.toFixed(4)}/ml
                            </td>
                            <td className="py-1.5 px-3 text-right font-bold text-slate-900 dark:text-white">
                              ₹{formatIndian(outBaseCost)}
                            </td>
                          </tr>
                          <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                            <td className="py-1.5 px-3 font-sans text-slate-700 dark:text-slate-300">
                              2. Added RMs &amp; Packaging
                            </td>
                            <td className="py-1.5 px-3 text-slate-500 text-[10px]">
                              {prms.length} specific addition(s)
                            </td>
                            <td className="py-1.5 px-3 text-right font-bold text-purple-700 dark:text-purple-300">
                              ₹{formatIndian(addedCost)}
                            </td>
                          </tr>
                          <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                            <td className="py-1.5 px-3 font-sans text-slate-700 dark:text-slate-300">
                              3. Direct Production Labour
                            </td>
                            <td className="py-1.5 px-3 text-slate-500 text-[10px]">
                              Assigned floor labour share
                            </td>
                            <td className="py-1.5 px-3 text-right font-bold text-amber-600 dark:text-amber-400">
                              ₹{formatIndian(outLabour)}
                            </td>
                          </tr>
                          <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                            <td className="py-1.5 px-3 font-sans text-slate-700 dark:text-slate-300">
                              4. Electricity &amp; Utilities (EB)
                            </td>
                            <td className="py-1.5 px-3 text-slate-500 text-[10px]">
                              Metered / allocated power
                            </td>
                            <td className="py-1.5 px-3 text-right font-bold text-blue-600 dark:text-blue-400">
                              ₹{formatIndian(outEb)}
                            </td>
                          </tr>
                          <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                            <td className="py-1.5 px-3 font-sans text-slate-700 dark:text-slate-300">
                              5. Factory Overheads
                            </td>
                            <td className="py-1.5 px-3 text-slate-500 text-[10px]">
                              Allocated plant charges
                            </td>
                            <td className="py-1.5 px-3 text-right font-bold text-slate-800 dark:text-slate-200">
                              ₹{formatIndian(safeOh)}
                            </td>
                          </tr>
                        </tbody>
                        <tfoot className={`${theme.footBg} font-bold border-t border-slate-200 dark:border-slate-800`}>
                          <tr>
                            <td colSpan={2} className="py-2 px-3 font-sans uppercase text-[10px] text-slate-800 dark:text-slate-100">
                              Total Cost — {out.productName}
                              <span className="block font-normal text-[10px] text-emerald-600 dark:text-emerald-400">
                                Unit Cost = <strong>₹{formatIndian(finalUnitCost)}</strong> / {out.uom}
                              </span>
                            </td>
                            <td className="py-2 px-3 text-right font-black text-emerald-600 dark:text-emerald-400 text-xs">
                              ₹{formatIndian(finalTotalCost)}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 4C. Direct Production Labour Day-Wise Crew Bifurcation Audit */}
            <div className="space-y-3 pt-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5 font-sans">
                  <Users className="w-3.5 h-3.5 text-amber-600" />
                  Direct Production Labour Day-Wise Crew Bifurcation Audit
                </h4>
                <span className="text-[10px] text-slate-500 font-mono">
                  Day-Wise Assigned Staff • Monthly CTC / 30 Day Salary Breakdown
                </span>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-300 dark:border-slate-700">
                <table className="w-full text-left text-xs font-mono border-collapse">
                  <thead>
                    <tr className="bg-slate-900 text-white text-[10.5px] uppercase font-bold">
                      <th className="py-2.5 px-3 font-sans">Day &amp; Production Date</th>
                      <th className="py-2.5 px-3 font-sans">Day Batch No</th>
                      <th className="py-2.5 px-3 font-sans">Assigned Staff &amp; ID</th>
                      <th className="py-2.5 px-3 font-sans">Role / Designation</th>
                      <th className="py-2.5 px-3 font-sans">Salary Basis (User Master / 30)</th>
                      <th className="py-2.5 px-3 text-right">Day Charge (INR)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800 bg-white dark:bg-slate-900">
                    {scopedDays.flatMap(d => {
                      const dayLabel = `Day ${d.dayNo || 1} • ${formatDateDMY(d.productionDate || batch?.startDate)}`;
                      const batchCode = d.dayBatchCode || d.day_batch_code || batch?.batchCode || batch?.shortCode || '—';
                      const staffList = Array.isArray(d.assignedUsers) && d.assignedUsers.length > 0 ? d.assignedUsers : [];

                      if (staffList.length > 0) {
                        return staffList.map((u, uIdx) => {
                          const staffName = cleanStaffNameOnly(u);
                          const empId = u?.empId || u?.userCode || u?.employeeId ? ` (${u?.empId || u?.userCode || u?.employeeId})` : '';
                          const role = u?.role || 'PRODUCTION_STAFF';
                          const yearlyCtc = Number(u?.yearlyCtc || 0);
                          const grossPay = Number(u?.grossPay || 0);
                          const monthlySalary = Number(u?.monthlySalary || (yearlyCtc > 0 ? Math.round((yearlyCtc / 12) * 100) / 100 : (grossPay > 0 ? grossPay : 0)));
                          const daySalary = Number(u?.daySalary || (monthlySalary > 0 ? Math.round(monthlySalary / 30) : 0));
                          const lineAmt = Number(u?.amount !== undefined ? u.amount : (daySalary > 0 ? daySalary : 0));

                          return (
                            <tr
                              key={`clean-labour-row-${d.dayNo || 1}-${u.id || uIdx}`}
                              className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30"
                            >
                              <td className="py-2.5 px-3 font-sans font-bold text-slate-900 dark:text-white">
                                {dayLabel}
                              </td>
                              <td className="py-2.5 px-3 font-bold text-indigo-700 dark:text-indigo-300">
                                {batchCode}
                              </td>
                              <td className="py-2.5 px-3 font-sans font-semibold text-slate-800 dark:text-slate-200">
                                {staffName}{empId}
                              </td>
                              <td className="py-2.5 px-3">
                                <span className="font-mono text-[9px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold border border-slate-200 dark:border-slate-700">
                                  {role}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400 text-[11px]">
                                {yearlyCtc > 0 ? (
                                  <>CTC ₹{formatIndian(yearlyCtc)}/yr (Mo: ₹{formatIndian(monthlySalary)}) • /12 /30 = ₹{formatIndian(daySalary)}/day</>
                                ) : grossPay > 0 ? (
                                  <>Gross ₹{formatIndian(grossPay)}/mo • /30 = ₹{formatIndian(daySalary)}/day</>
                                ) : monthlySalary > 0 ? (
                                  <>Mo: ₹{formatIndian(monthlySalary)} • /30 = ₹{formatIndian(daySalary)}/day</>
                                ) : lineAmt > 0 ? (
                                  <>Day Rate: ₹{formatIndian(lineAmt)}</>
                                ) : (
                                  <span className="text-slate-400 italic">Standard Shift Wage</span>
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-right font-black text-amber-600 dark:text-amber-400">
                                ₹{formatIndian(lineAmt)}
                              </td>
                            </tr>
                          );
                        });
                      } else {
                        const fallbackName = formatAssignedStaff(d.assignedUsers, d.completedBy || d.startedBy || batch?.startedBy);
                        const dayLabourAmt = Number(d.labourTotalCost ?? d.labourCost ?? 0);
                        return (
                          <tr
                            key={`clean-labour-fallback-${d.dayNo || 1}`}
                            className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30"
                          >
                            <td className="py-2.5 px-3 font-sans font-bold text-slate-900 dark:text-white">
                              {dayLabel}
                            </td>
                            <td className="py-2.5 px-3 font-bold text-indigo-700 dark:text-indigo-300">
                              {batchCode}
                            </td>
                            <td className="py-2.5 px-3 font-sans font-semibold text-slate-800 dark:text-slate-200">
                              {fallbackName}
                            </td>
                            <td className="py-2.5 px-3">
                              <span className="font-mono text-[9px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold border border-slate-200 dark:border-slate-700">
                                Floor Operator
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-slate-500 italic text-[11px]">
                              Shift Crew Allocation
                            </td>
                            <td className="py-2.5 px-3 text-right font-black text-amber-600 dark:text-amber-400">
                              ₹{formatIndian(dayLabourAmt)}
                            </td>
                          </tr>
                        );
                      }
                    })}
                  </tbody>
                  <tfoot className="bg-slate-900 text-white font-bold border-t-2 border-slate-900">
                    <tr>
                      <td colSpan={2} className="py-2.5 px-3 font-sans uppercase font-black tracking-wider text-amber-400 text-xs">
                        TOTAL DIRECT LABOUR
                      </td>
                      <td colSpan={3} className="py-2.5 px-3 font-sans text-slate-300 text-xs">
                        {scopedDays.reduce((acc, d) => acc + (Array.isArray(d.assignedUsers) && d.assignedUsers.length > 0 ? d.assignedUsers.length : 1), 0)} Assigned Crew Shift(s) across {scopedDays.length} Day(s)
                      </td>
                      <td className="py-2.5 px-3 text-right font-black text-amber-400 text-sm">
                        ₹{formatIndian(directLabourCost)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── 8. SECTION 6: QUALITY ASSURANCE & FINAL PROCESS SIGN-OFF ── */}
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
