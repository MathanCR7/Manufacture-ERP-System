import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { 
  Factory, X, Check, Play, Pause, Save, RefreshCw, AlertTriangle,
  Layers, Sliders, Box, ShieldCheck, Sparkles, Scale, Info, ArrowRight, ArrowLeft,
  Flame, Droplets, Snowflake, CheckCircle2, AlertCircle, RotateCcw,
  Plus, Trash2, ChevronRight, HardHat, FileSpreadsheet, Eye,
  DollarSign, TrendingDown, Package, HelpCircle, ArrowDownRight, Layers2,
  Maximize2, Minimize2, Printer, Tag, Boxes, CheckSquare, Calendar, ChevronLeft,
  Unlock, Lock, FileText, CheckCheck, TrendingUp, Sun, Moon, Zap, Users, Search,
  Edit3, History
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { api } from '@/lib/axios';
import Swal from 'sweetalert2';
import useAuthStore from '@/app/store/authStore';
import {
  toMl,
  round2,
  formatIndian,
  calculateEvaporation,
  calculateAllocations,
  computeMaxTrays,
  formatCleanUom,
  isPackagingMaterial
} from '../utils/productionCalculation';
import {
  formatDateToDDMMYY,
  buildProductBatchNo,
  formatProductSerialPreview
} from '../utils/batchNumberUtil';
import ProductionMouldPickerModal from './ProductionMouldPickerModal';
import ProductionItemSearchModal from './ProductionItemSearchModal';
import ProductionCleanReportView from './ProductionCleanReportView';
import StandardFactoryStagesPalette from './StandardFactoryStagesPalette';
import { getProductionDraft } from '../services/productionDraftStore';

const formatDateDMY = (dateVal) => {
  if (!dateVal) return 'dd-mm-yyyy';
  try {
    if (typeof dateVal === 'string') {
      const iso = dateVal.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (iso) return `${iso[3]}-${iso[2]}-${iso[1]}`;
    }
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

// Mould Specifications Packaging Mapping (Wooden Sticks & Suggested Poly Packing Covers)
// Formulated per factory mould master specifications:
// 1. SG-2006 Egypt Small (18 ml, 42 cav): STICK 65 MM (RM-00119) + packing cover=130 mm (provisional) (RM-00130)
// 2. SG-3006 Flat Stick (40 ml, 50 cav): STICK 144 MM (RM-00121) + packing cover=130 mm (provisional) (RM-00131)
// 3. SG-8112 Kulfi Small (50 ml, 42 cav): STICK 144 MM (RM-00121) + packing cover=130 mm (provisional) (RM-00130)
// 4. SG-8115 Kulfi Large (70 ml, 42 cav): Round Stick (RM-STICK-01) + packing cover=170 mm (provisional) (RM-00132)

const MOULD_PACKAGING_DEFINITIONS = {
  SG_2006: {
    code: 'SG-2006',
    name: 'Egypt Small (SG 2006)',
    capacityMl: 18,
    cavities: 42,
    stick: {
      id: "c001991a-ce1b-4437-ad36-d4e76af4d8ff",
      code: "RM-00119",
      name: "WOODEN STICK (SMALL) - STICK 65 MM",
      printName: "STICK 65 MM (Small)",
      uom: "pcs",
      rate: 0.25,
      stock: 25000
    },
    cover: {
      id: "c15be4ee-e68f-43ce-9b46-d7810fb7ccbd",
      code: "RM-00130",
      name: "STICK (S) POLY COVER - 130 MM (provisional)",
      printName: "Packing Cover 130 MM (Provisional)",
      uom: "pcs",
      rate: 0.15,
      stock: 50000
    }
  },
  SG_3006: {
    code: 'SG-3006',
    name: 'Flat Stick (SG 3006)',
    capacityMl: 40,
    cavities: 50,
    stick: {
      id: "c31d978e-5ef0-496b-8e3b-eb377d7b5967",
      code: "RM-00121",
      name: "WOODEN STICK (LARGE) - STICK 144 MM",
      printName: "STICK 144 MM (Flat Stick)",
      uom: "pcs",
      rate: 0.35,
      stock: 20000
    },
    cover: {
      id: "d8759184-001d-4679-a549-f666ca7d4e65",
      code: "RM-00131",
      name: "STICK (M) POLY COVER - 130 MM (provisional)",
      printName: "Packing Cover 130 MM (Provisional)",
      uom: "pcs",
      rate: 0.15,
      stock: 50000
    }
  },
  SG_8112: {
    code: 'SG-8112',
    name: 'Kulfi Small (SG 8112)',
    capacityMl: 50,
    cavities: 42,
    stick: {
      id: "c31d978e-5ef0-496b-8e3b-eb377d7b5967",
      code: "RM-00121",
      name: "WOODEN STICK (LARGE) - STICK 144 MM",
      printName: "STICK 144 MM (Flat Stick)",
      uom: "pcs",
      rate: 0.35,
      stock: 20000
    },
    cover: {
      id: "c15be4ee-e68f-43ce-9b46-d7810fb7ccbd",
      code: "RM-00130",
      name: "STICK (S) POLY COVER - 130 MM (provisional)",
      printName: "Packing Cover 130 MM (Provisional)",
      uom: "pcs",
      rate: 0.15,
      stock: 50000
    }
  },
  SG_8115: {
    code: 'SG-8115',
    name: 'Kulfi Large (SG 8115)',
    capacityMl: 70,
    cavities: 42,
    stick: {
      id: "da5ded39-424f-4c89-9e50-5feef9e1aa85",
      code: "RM-STICK-01",
      name: "Wooden Kulfi Stick (Round Stick)",
      printName: "Round Stick (Kulfi Stick)",
      uom: "pcs",
      rate: 0.25,
      stock: 50000
    },
    cover: {
      id: "68123b8a-688d-4db3-ab75-65b8f5616a5b",
      code: "RM-00132",
      name: "STICK (L) POLY COVER - 170 MM (provisional)",
      printName: "Packing Cover 170 MM (Provisional)",
      uom: "pcs",
      rate: 0.20,
      stock: 50000
    }
  }
};

const STICK_DEFINITIONS = {
  EGYPT_65MM: MOULD_PACKAGING_DEFINITIONS.SG_2006.stick,
  FLAT_144MM: MOULD_PACKAGING_DEFINITIONS.SG_3006.stick,
  ROUND_KULFI: MOULD_PACKAGING_DEFINITIONS.SG_8115.stick
};

function getPackagingForMould(mouldCode, mouldName, modelNumber) {
  const code = (mouldCode || '').toUpperCase();
  const name = (mouldName || '').toUpperCase();
  const model = (modelNumber || '').toUpperCase();

  if (code.includes('2006') || name.includes('EGYPT') || model.includes('2006') || name.includes('65')) {
    return MOULD_PACKAGING_DEFINITIONS.SG_2006;
  }
  if (code.includes('3006') || (name.includes('FLAT') && !name.includes('8112')) || model.includes('3006')) {
    return MOULD_PACKAGING_DEFINITIONS.SG_3006;
  }
  if (code.includes('8115') || (name.includes('KULFI') && (name.includes('LARGE') || name.includes('70')))) {
    return MOULD_PACKAGING_DEFINITIONS.SG_8115;
  }
  if (code.includes('8112') || name.includes('8112') || (name.includes('KULFI') && name.includes('SMALL'))) {
    return MOULD_PACKAGING_DEFINITIONS.SG_8112;
  }
  if (name.includes('KULFI') || name.includes('ROUND')) {
    return MOULD_PACKAGING_DEFINITIONS.SG_8112;
  }
  return MOULD_PACKAGING_DEFINITIONS.SG_8112;
}

function getStickForMould(mouldCode, mouldName, modelNumber) {
  return getPackagingForMould(mouldCode, mouldName, modelNumber)?.stick || null;
}

function getCoverForMould(mouldCode, mouldName, modelNumber) {
  return getPackagingForMould(mouldCode, mouldName, modelNumber)?.cover || null;
}

function createPackagingItem(def, pieces, existing = null, master = null) {
  const qty = pieces > 0 ? pieces : (Number(existing?.takenQty ?? existing?.qty) || 1);
  const rate = Number(master?.ratePerUnit || existing?.unitRate || def.rate || 0.25);
  const totalCost = Number((rate * qty).toFixed(2));
  const isUuidStr = (s) => typeof s === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s.trim());

  const existingRealBatches = Array.isArray(existing?.allocatedBatches)
    ? existing.allocatedBatches.filter(b => b && (isUuidStr(b.batchId) || b.isManualOverride === true))
    : [];

  let allocatedBatches = [];
  if (existingRealBatches.length > 0) {
    allocatedBatches = existingRealBatches.map(b => ({
      ...b,
      allocatedQty: qty,
      unitRate: Number(b.unitRate || rate),
      allocatedAmount: Number((Number(b.unitRate || rate) * qty).toFixed(2))
    }));
  } else if (Array.isArray(master?.availableBatches) && master.availableBatches.length > 0) {
    let rem = qty;
    for (const lot of master.availableBatches) {
      if (rem <= 0) break;
      const avail = Number(lot.remainingQty ?? lot.availableQty ?? 0);
      if (avail <= 0) continue;
      const take = Math.min(avail, rem);
      allocatedBatches.push({
        batchId: lot.id,
        lotNumber: lot.batchNo,
        internalBatchNo: lot.batchNo,
        allocatedQty: Number(take.toFixed(6)),
        availableQty: avail,
        remainingQty: Math.max(0, Number((avail - take).toFixed(6))),
        expiryDate: lot.expiryDate || null,
        unitRate: rate,
        allocatedAmount: Number((take * rate).toFixed(2)),
        uom: 'pcs'
      });
      rem = Number((rem - take).toFixed(6));
    }
  }

  return {
    rmId: master?.id || def.id,
    rawMaterialId: master?.id || def.id,
    rmName: master?.printName || master?.name || def.name,
    rawMaterialName: master?.printName || master?.name || def.name,
    rmCode: master?.code || def.code,
    rawMaterialCode: master?.code || def.code,
    uom: 'pcs',
    primaryUom: 'pcs',
    hasAlternateUom: false,
    alternateUom: null,
    conversionFactor: 1,
    density: 1.0,
    takenQty: qty,
    qty: qty,
    requiredQty: qty,
    addToMix: false,
    unitRate: rate,
    totalCost: totalCost,
    currentStock: Number(master?.currentStock ?? def.stock ?? 50000),
    allocatedBatches
  };
}

const getPrmMixMl = (p, master = null) => {
  if (!p) return 0;
  const isAdd = p.addToMix !== undefined ? Boolean(p.addToMix) : !isPackagingMaterial(p);
  if (!isAdd) return 0;
  const q = Number(p.takenQty ?? p.qty ?? 0);
  if (isNaN(q) || q <= 0) return 0;

  const u = String(p.uom || master?.uom || 'ml').trim().toLowerCase();
  const d = Number(p.density || master?.density_g_per_ml || 1.0) || 1.0;

  // 1. Direct standard metric volume conversions
  if (['ml', 'milliliter', 'millilitre', 'milliliters', 'millilitres'].includes(u)) {
    return q;
  }
  if (['l', 'ltr', 'liter', 'litre', 'liters', 'litres'].includes(u)) {
    return q * 1000;
  }
  if (['gallon', 'gallons', 'gal'].includes(u)) {
    return q * 2000;
  }
  if (['kg', 'kgs', 'kilo', 'kilogram', 'kilograms'].includes(u)) {
    return (q * 1000) / d;
  }
  if (['g', 'gm', 'gms', 'gram', 'grams'].includes(u)) {
    return q / d;
  }

  // 2. Discrete / packaging units do not add liquid mix
  if (['pcs', 'pc', 'piece', 'pieces', 'nos', 'no', 'box', 'boxes', 'carton', 'cartons'].includes(u)) {
    return 0;
  }

  // 3. Alternate UOM Equation from master if custom ratio
  const m = master || p;
  const baseQty = Number(m.baseUomQty || 1000);
  const altQty = Number(m.alternateUomQty || 1);
  const altUom = String(m.alternateUom || '').trim().toLowerCase();
  const primUom = String(m.primaryUom || m.uom || m.unitId || 'ml').trim().toLowerCase();

  if (altUom && u === altUom) {
    if (primUom === 'ml' && altQty > 0) {
      return q * (baseQty / altQty);
    }
  }

  try {
    return toMl(q, p.uom || 'ml', d);
  } catch (_) {
    return q;
  }
};

export default function ProductionFloorCockpitModal({
  isOpen = false,
  onClose,
  batchId,
  onBatchUpdated,
  onOpenCompleteModal,
  onOpenCleanSheet,
  initialViewMode = 'STEPS',
  readOnly = false,
  isViewOnly = false
}) {
  const currentUser = useAuthStore(s => s.user);
  const userRole = currentUser?.role?.toUpperCase();
  const canViewCost = ['MAIN_MASTER', 'ADMIN', 'SUPERVISOR'].includes(userRole);

  // ── THEME SUPPORT (LIGHT & DARK THEMES) ──
  const [isDark, setIsDark] = useState(() => {
    return document.documentElement.classList.contains('dark') || localStorage.getItem('darkMode') === 'true';
  });

  useEffect(() => {
    const handleThemeChange = (e) => {
      if (e.detail?.isDark !== undefined) {
        setIsDark(e.detail.isDark);
      }
    };
    const handleStorageChange = (e) => {
      if (e.key === 'darkMode') {
        setIsDark(e.newValue === 'true');
      }
    };
    window.addEventListener('app-theme-toggle', handleThemeChange);
    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('app-theme-toggle', handleThemeChange);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  const toggleThemeMode = () => {
    const nextDark = !isDark;
    setIsDark(nextDark);
    if (nextDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('darkMode', 'true');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('darkMode', 'false');
    }
    window.dispatchEvent(new CustomEvent('app-theme-toggle', { detail: { isDark: nextDark } }));
    window.dispatchEvent(new StorageEvent('storage', { key: 'darkMode', newValue: nextDark ? 'true' : 'false' }));
  };

  const [batch, setBatch] = useState(null);
  const isPaused = batch?.status === 'Paused';
  const isCompleted = batch?.status === 'Completed' || batch?.status === 'qc_passed';
  const isViewMode = Boolean(readOnly || isViewOnly || initialViewMode === 'VIEW' || isCompleted);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [savingProcess, setSavingProcess] = useState(false);
  const [savingAllocations, setSavingAllocations] = useState(false);
  
  // High-impact Fullscreen default for industrial floor terminal view
  const [isFullscreen, setIsFullscreen] = useState(true);

  // View mode: 'STEPS' (interactive 5-step wizard) vs 'REPORT' (clean executive costing & yield ledger)
  const [viewMode, setViewMode] = useState(initialViewMode === 'VIEW' ? 'STEPS' : (initialViewMode || 'STEPS'));

  useEffect(() => {
    if (isOpen && initialViewMode) {
      setViewMode(initialViewMode === 'VIEW' ? 'STEPS' : initialViewMode);
    }
  }, [isOpen, initialViewMode]);

  // ── 5-STEP PROCESS GUIDANCE STATE ──
  // 1: RM Formulation & Warehouse Lot Allocation
  // 2: Volume Merge & Evaporation Mass Loss
  // 3: Finished Products & Sequential Chaining + Product Ingredients
  // 4: Factory Stages Palette & Timeline Sequence
  // 5: Quality, Costing, Wastage & Yield Completion
  const [activeStep, setActiveStep] = useState(1);

  // Section A: Raw Materials
  const [rmRows, setRmRows] = useState([]);
  const [availableProducts, setAvailableProducts] = useState([]);

  // Section B: Merge and Evaporation
  const [mergeStage, setMergeStage] = useState('After heating');
  const [isSlideMerged, setIsSlideMerged] = useState(false);
  const [evaporationPct, setEvaporationPct] = useState(5.0);
  const [evaporationApplied, setEvaporationApplied] = useState(false);

  // Section C: Finished Products Allocations
  const [allocations, setAllocations] = useState([]);
  const [mouldCatalog, setMouldCatalog] = useState([]);
  const [mouldCategories, setMouldCategories] = useState([]);

  // Item Search Modal (Sales / SAP Order Style)
  const [itemSearchOpen, setItemSearchOpen] = useState(false);
  const [itemSearchMode, setItemSearchMode] = useState('RM_MULTI'); // 'RM_MULTI' | 'PRODUCT_SINGLE'

  // Mould Picker Modal
  const [mouldPickerOpen, setMouldPickerOpen] = useState(false);
  const [targetAllocIndex, setTargetAllocIndex] = useState(null);

  // Costing data (from server)
  const [costingData, setCostingData] = useState(null);

  // Operational Costing & Multi-Product Factory Timeline States
  const [labourCost, setLabourCost] = useState(0);
  const [electricityCost, setElectricityCost] = useState(0);
  const [overheadCost, setOverheadCost] = useState(1069.12);
  const [companyDetails, setCompanyDetails] = useState(null);
  const [electricityReason, setElectricityReason] = useState('Freezer compressors, vat agitators & pasteurization thermal load');
  const [labourReason, setLabourReason] = useState('Production crew for thermal formulation, mould pouring, stick placement & flow-wrap packing');
  const [overheadReason, setOverheadReason] = useState('Plant machinery amortization, CIP sanitization chemicals & cold storage facility charges');
  const [crewWorkers, setCrewWorkers] = useState(1);
  const [crewHours, setCrewHours] = useState(6);
  const [crewRatePerHour, setCrewRatePerHour] = useState(150);
  const [ebStartReading, setEbStartReading] = useState('');
  const [ebEndReading, setEbEndReading] = useState('');
  const [ebRatePerUnit, setEbRatePerUnit] = useState(8.5);
  const [productLabourMap, setProductLabourMap] = useState({}); // { [productId]: number }
  const [selectedProductStageTab, setSelectedProductStageTab] = useState('ALL');
  const [productStagesMap, setProductStagesMap] = useState({}); // { [productId]: stages[] }

  // Step 3 Finished Products Navigation & Master-Detail Sidebar State
  const [selectedStep3Index, setSelectedStep3Index] = useState(0);
  const [step3SearchFilter, setStep3SearchFilter] = useState('');
  const [step3LayoutMode, setStep3LayoutMode] = useState('SIDEBAR'); // 'SIDEBAR' | 'STACKED'

  // Multi-Product Yield Recording Modal State
  const [showYieldModal, setShowYieldModal] = useState(false);
  const [productYields, setProductYields] = useState({}); // { [productId]: { actualOutput, rejectOutput, notes } }
  const [actualYieldPieces, setActualYieldPieces] = useState(2000);
  const [completionNotes, setCompletionNotes] = useState('');
  const [completing, setCompleting] = useState(false);

  // Factory Stages Timeline Sequence
  const DEFAULT_FACTORY_STAGES = [
    { id: 'ageing', name: 'Ageing', category: 'Thermal & Mixing', icon: 'clock', defaultTemp: '4°C', durationHours: 0, durationMinutes: 30, desc: 'Mix aging in refrigerated vats at 4°C' },
    { id: 'vat', name: 'VAT', category: 'Thermal & Mixing', icon: 'database', defaultTemp: '10°C', durationHours: 0, durationMinutes: 45, desc: 'Holding and agitation in process tanks' },
    { id: 'cf', name: 'CF – Cont. Freezer', category: 'Freezing & Molding', icon: 'snowflake', defaultTemp: '-5°C', durationHours: 1, durationMinutes: 0, desc: 'Continuous scraped surface freezing' },
    { id: 'bf', name: 'BF – Bath Freezer', category: 'Freezing & Molding', icon: 'snowflake', defaultTemp: '-20°C', durationHours: 0, durationMinutes: 45, desc: 'Brine tank sub-zero mold immersion' }
  ];
  const [timelineStages, setTimelineStages] = useState(DEFAULT_FACTORY_STAGES);
  const [savingStages, setSavingStages] = useState(false);

  // Lab Testing Requirement State (Defaults to false - direct to stock, can be toggled if QC needed)
  const [labTestRequired, setLabTestRequired] = useState(false);

  // Sub-Run / Multi End Product Sub-Batches Tracking (Run A, Run B, etc.)
  const [completedSubBatches, setCompletedSubBatches] = useState([]);
  const SUB_BATCH_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
  const currentSubRunLetter = SUB_BATCH_LETTERS[completedSubBatches.length] || `Run-${completedSubBatches.length + 1}`;

  // Multi-Day Execution & Day-Wise Costing / Additive DDMMYY Batch & Serial State
  const [daysHistory, setDaysHistory] = useState([]);
  const [activeDayNo, setActiveDayNo] = useState(1);
  const [liveActiveDayNo, setLiveActiveDayNo] = useState(1);
  const [selectedDayNo, setSelectedDayNo] = useState(null);
  const selectedDayNoRef = useRef(null);
  const [dayProductionDate, setDayProductionDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [dayBatchCode, setDayBatchCode] = useState(() => formatDateToDDMMYY(new Date()));
  const [dayBatchCodeCustomized, setDayBatchCodeCustomized] = useState(false);
  const [baseRmDeducted, setBaseRmDeducted] = useState(false);
  const [isFinalized, setIsFinalized] = useState(false);
  const [serialPreviewMap, setSerialPreviewMap] = useState({});
  const [resolvedCompanyPrefix, setResolvedCompanyPrefix] = useState('LEONEX');
  const [savingCompletedDay, setSavingCompletedDay] = useState(false);
  const [nextDayLoading, setNextDayLoading] = useState(false);
  const [inspectingDay, setInspectingDay] = useState(null);
  const [productionUsersList, setProductionUsersList] = useState([]);
  const [dayAssignedUsers, setDayAssignedUsers] = useState([]);
  const [showDayUserPopover, setShowDayUserPopover] = useState(false);
  const [userFilterShowAllRoles, setUserFilterShowAllRoles] = useState(false);
  const [savingDayMeta, setSavingDayMeta] = useState(false);

  const currentDayRec = useMemo(() => {
    return (Array.isArray(daysHistory) ? daysHistory : []).find(d => Number(d.dayNo) === Number(activeDayNo)) || null;
  }, [daysHistory, activeDayNo]);
  const isEditingCompletedDay = Boolean(currentDayRec && currentDayRec.status !== 'IN_PROGRESS');
  const step1And2Locked = Boolean(isViewMode || Number(activeDayNo) !== 1);

  // Live Raw Material Masters (Synced from /api/production/standard/raw-materials-catalog or item setup)
  const [rawMaterialMasters, setRawMaterialMasters] = useState([]);

  const findMaster = useCallback((item) => {
    if (!item || !rawMaterialMasters.length) return null;
    const targetId = item.rmId || item.rawMaterialId || item.id;
    const targetCode = (item.rmCode || item.rawMaterialCode || item.code || '').trim().toLowerCase();
    const targetName = (item.rmName || item.rawMaterialName || item.name || '').trim().toLowerCase();
    return rawMaterialMasters.find(m => 
      (targetId && (m.id === targetId || m.rawMaterialId === targetId)) ||
      (targetCode && m.code && m.code.toLowerCase() === targetCode) ||
      (targetName && (m.name.toLowerCase() === targetName || (m.printName && m.printName.toLowerCase() === targetName)))
    ) || null;
  }, [rawMaterialMasters]);

  // ── COCKPIT LOT ALLOCATION MODAL STATE (Standard /production/standard/add BatchAllocationGrid design) ──
  const [lotModalOpen, setLotModalOpen] = useState(false);
  const [activeLotRowIndex, setActiveLotRowIndex] = useState(null);
  const [activeLotTarget, setActiveLotTarget] = useState(null); // { type: 'STEP_1', rowIndex } | { type: 'PRODUCT_RM', allocIndex, prmIndex }
  const [loadingLots, setLoadingLots] = useState(false);
  const [availableLots, setAvailableLots] = useState([]);
  const [lotAllocations, setLotAllocations] = useState({}); // { [lotId]: allocatedQty }
  const [manualSupplierBatches, setManualSupplierBatches] = useState({}); // { [lotId]: string }
  const [selectedGrnFilter, setSelectedGrnFilter] = useState('ALL');
  const [lotSearchTerm, setLotSearchTerm] = useState('');
  const [showManualOverrideForm, setShowManualOverrideForm] = useState(false);
  const [overrideForm, setOverrideForm] = useState({
    internalBatchNo: '',
    grnNumber: 'GRN-MANUAL-OVERRIDE',
    poNumber: 'PO-MANUAL-OVERRIDE',
    batchQty: 1,
    weight: '25 kg / 50',
    availableQty: 4840,
    supplierBatchNo: 'BATCH-01',
    mfgDate: '',
    expiryDate: '',
    supplierName: 'SUP-LOT-DIRECT',
    latestPoNumber: null,
    latestBatchNumber: null,
    unitRate: 54
  });

  // Derived state for the active raw material lot modal
  const uniqueGrnList = useMemo(() => {
    const map = {};
    availableLots.forEach(l => {
      const g = l.grnNumber || l.grnRef || 'GRN-OPENING';
      if (!map[g]) map[g] = { grnNumber: g, count: 0, totalQty: 0 };
      map[g].count += 1;
      map[g].totalQty += Number(l.availableQty || l.netQty || 0);
    });
    return Object.values(map);
  }, [availableLots]);

  const displayedLots = useMemo(() => {
    let list = [...availableLots];
    if (selectedGrnFilter !== 'ALL') {
      list = list.filter(l => (l.grnNumber || l.grnRef || 'GRN-OPENING') === selectedGrnFilter);
    }
    if (lotSearchTerm.trim()) {
      const q = lotSearchTerm.toLowerCase();
      list = list.filter(l =>
        (l.internalBatchNo || l.batchNumber || '').toLowerCase().includes(q) ||
        (l.poNumber || l.poReferenceNo || '').toLowerCase().includes(q) ||
        (l.grnNumber || l.grnRef || '').toLowerCase().includes(q) ||
        (l.supplierBatchNo || l.mfgBatchNo || '').toLowerCase().includes(q) ||
        (l.supplierName || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [availableLots, selectedGrnFilter, lotSearchTerm]);

  const totalAllocatedInModal = useMemo(() => {
    if (!Array.isArray(availableLots) || availableLots.length === 0) {
      return Object.values(lotAllocations).reduce((sum, v) => sum + Number(v || 0), 0);
    }
    return Number(
      availableLots.reduce((sum, lot, idx) => {
        const lid = lot.id || lot.internalBatchNo || `lot-${idx}`;
        const val = lotAllocations[lid] ?? lotAllocations[lot.id] ?? lotAllocations[lot.internalBatchNo] ?? 0;
        return sum + Number(val || 0);
      }, 0).toFixed(6)
    );
  }, [lotAllocations, availableLots]);

  // ── Fetch Master Data & Batch Details from /api/production/standard/:id ──
  const fetchAllData = useCallback(async (forceReportMode = false, overrideDayNo = undefined) => {
    if (!batchId) return;
    try {
      setLoading(true);
      const targetDayNo = overrideDayNo !== undefined ? overrideDayNo : selectedDayNoRef.current;
      const [detailRes, mouldsRes, productsRes, rmCatalogRes, usersRes] = await Promise.all([
        api.get(`/production/standard/${batchId}`, {
          params: targetDayNo ? { dayNo: targetDayNo } : undefined
        }).catch(() => api.get(`/production/batches-redesign/${batchId}`)),
        api.get('/production/standard/moulds?all=1').catch(() => api.get('/production/moulds')),
        api.get('/production/standard/products-catalog').catch(() => api.get('/products?limit=100')),
        api.get('/production/standard/raw-materials-catalog').catch(() => ({ data: { data: [] } })),
        api.get('/users').catch(() => ({ data: [] }))
      ]);

      const rawUsers = Array.isArray(usersRes?.data?.data) ? usersRes.data.data : (Array.isArray(usersRes?.data) ? usersRes.data : []);
      const normalizedUsersList = rawUsers
        .filter(u => u && u.isActive !== false)
        .map(u => ({
          id: u.id,
          name: u.name || u.email || 'User',
          empId: u.empId || '',
          role: u.role || 'PRODUCTION_STAFF'
        }))
        .sort((a, b) => {
          const aIsProd = a.role === 'PRODUCTION_STAFF' ? 0 : 1;
          const bIsProd = b.role === 'PRODUCTION_STAFF' ? 0 : 1;
          if (aIsProd !== bIsProd) return aIsProd - bIsProd;
          return a.name.localeCompare(b.name);
        });
      setProductionUsersList(normalizedUsersList);

      const liveRmCatalog = Array.isArray(rmCatalogRes.data?.data) ? rmCatalogRes.data.data : (Array.isArray(rmCatalogRes.data) ? rmCatalogRes.data : []);
      setRawMaterialMasters(liveRmCatalog);
      const findLiveMaster = (item) => {
        if (!item || !liveRmCatalog.length) return null;
        const targetId = item.rmId || item.rawMaterialId || item.id;
        const targetCode = (item.rmCode || item.rawMaterialCode || item.code || '').trim().toLowerCase();
        const targetName = (item.rmName || item.rawMaterialName || item.name || '').trim().toLowerCase();
        return liveRmCatalog.find(m =>
          (targetId && (m.id === targetId || m.rawMaterialId === targetId)) ||
          (targetCode && m.code && m.code.toLowerCase() === targetCode) ||
          (targetName && ((m.name && m.name.toLowerCase() === targetName) || (m.printName && m.printName.toLowerCase() === targetName)))
        ) || null;
      };

      const b = detailRes.data.batch || detailRes.data;
      setBatch(b);
      const fetchedDays = Array.isArray(detailRes.data.days) ? detailRes.data.days : [];
      const srvActiveDayNo = Math.max(1, Number(b.activeDayNo ?? b.active_day_no ?? 1));
      const srvViewingDayNo = targetDayNo ? Number(targetDayNo) : Math.max(1, Number(b.viewingDayNo ?? srvActiveDayNo));
      setLiveActiveDayNo(srvActiveDayNo);
      const activeDayRecPre = fetchedDays.find(d => Number(d.dayNo) === srvViewingDayNo) || null;
      if (fetchedDays.length > 0 && activeDayRecPre) {
        setActualYieldPieces(Number(activeDayRecPre.totalOutputQty || 0));
      } else {
        setActualYieldPieces(Number(b.actualOutput || b.quantity || 2000));
      }
      const batchFinished = b.status === 'Completed' || b.status === 'qc_passed' || String(b.status || '').toLowerCase().includes('finish') || String(b.status || '').toLowerCase().includes('complet');
      if (forceReportMode || initialViewMode === 'REPORT' || batchFinished) {
        setViewMode('REPORT');
      } else {
        setViewMode('STEPS');
      }

      // Moulds
      const moulds = mouldsRes.data.moulds || mouldsRes.data.data || [];
      setMouldCatalog(moulds);
      const cats = mouldsRes.data.categories || Array.from(new Set(moulds.map(m => m.mould_category || 'Other')));
      setMouldCategories(cats);

      // Products
      const prods = Array.isArray(productsRes.data?.data) ? productsRes.data.data : (Array.isArray(productsRes.data) ? productsRes.data : []);
      setAvailableProducts(prods);

      // Raw Material Lines from standard endpoint or fallback
      const serverRmLines = detailRes.data.rmLines || [];
      const draft = getProductionDraft();
      const draftRms = Array.isArray(draft?.rawMaterials) ? draft.rawMaterials : [];

      let initialRows = [];
      if (serverRmLines.length > 0) {
        initialRows = serverRmLines.map(line => {
          const rmId = line.raw_material_id || line.rmId;
          const matchDraft = draftRms.find(d => 
            (d.rawMaterialId && d.rawMaterialId === rmId) || 
            (d.rmId && d.rmId === rmId) ||
            (d.rawMaterialCode && d.rawMaterialCode === (line.raw_material_code || line.rmCode)) ||
            (d.rawMaterialName && d.rawMaterialName === (line.raw_material_name || line.rmName))
          );

          let allocatedBatches = Array.isArray(line.allocatedBatches) && line.allocatedBatches.length > 0
            ? line.allocatedBatches
            : (Array.isArray(matchDraft?.allocatedBatches) && matchDraft.allocatedBatches.length > 0
                ? matchDraft.allocatedBatches
                : []);

          let lotBatchNo = line.lot_batch_no;
          if (!lotBatchNo && allocatedBatches.length > 0) {
            lotBatchNo = allocatedBatches.map(b => b.lotNumber || b.internalBatchNo).filter(Boolean).join(', ');
          }

          const allocSum = allocatedBatches.reduce((acc, b) => acc + Number(b.allocatedQty || 0), 0);
          const rawStock = Number(line.warehouse_stock ?? line.current_stock ?? line.currentStock ?? 0);
          const availableQty = allocSum > 0 ? allocSum : 0;
          const reqQty = allocSum > 0 ? allocSum : Number(line.required_qty || 0);

          let takenQty = Number(line.taken_qty || 0);
          if (allocSum > 0) {
            takenQty = allocSum;
          } else if (takenQty <= 0) {
            takenQty = reqQty;
          }

          let unitRate = Number(line.rate_per_unit || 0);
          if (allocatedBatches.length > 0) {
            const totAmt = allocatedBatches.reduce((acc, b) => acc + (Number(b.allocatedQty || 0) * Number(b.unitRate || 0)), 0);
            const totQty = allocatedBatches.reduce((acc, b) => acc + Number(b.allocatedQty || 0), 0);
            if (totQty > 0) unitRate = Number((totAmt / totQty).toFixed(4));
          }

          let resolvedUom = (line.uom && !/^[0-9a-fA-F-]{32,36}$/.test(line.uom)) 
            ? line.uom 
            : (line.unitId || line.unit_id || 'kg');
          if (line.has_alternate_uom || line.hasAlternateUom) {
            const alt = (line.alternate_uom || line.alternateUom || '').toLowerCase();
            const curr = String(resolvedUom || '').toLowerCase();
            if (alt && curr === alt && Number(line.conversion_factor || line.conversionFactor || 1) >= 1000) {
              resolvedUom = 'kg';
            }
          }

          return {
            rawMaterialId: rmId,
            rawMaterialName: line.raw_material_name || line.rmName || 'Raw Material',
            rawMaterialCode: line.raw_material_code || line.rmCode || 'RM',
            uom: formatCleanUom(resolvedUom, 'kg', line),
            hasAlternateUom: Boolean(line.has_alternate_uom),
            alternateUom: line.alternate_uom,
            conversionFactor: Number(line.conversion_factor || 1),
            consumptionUnit: line.consumption_unit,
            density: Number(line.density || 1.0),
            availableQty,
            warehouseStock: rawStock,
            requiredQty: reqQty,
            takenQty,
            evaporates: Boolean(line.evaporates),
            merged: line.merged !== undefined && line.merged !== null ? Boolean(line.merged) : true,
            unitRate,
            lotBatchNo: lotBatchNo || null,
            expiryDate: line.lot_expiry_date || line.lotExpiryDate || allocatedBatches.find(ab => ab.expiryDate)?.expiryDate || null,
            availableBatches: line.available_batches || [],
            allocatedBatches
          };
        });
      } else if (Array.isArray(b.rmUsages) && b.rmUsages.length > 0) {
        initialRows = b.rmUsages.map(u => {
          const rmId = u.rmId || u.rawMaterial?.id;
          const name = u.rawMaterial?.name || u.name || 'Raw Material';
          const lowerName = name.toLowerCase();
          const defaultEvap = lowerName.includes('milk') || lowerName.includes('smp') || 
                              lowerName.includes('stabilizer') || lowerName.includes('essence') ||
                              lowerName.includes('flavor');

          const matchDraft = draftRms.find(d => 
            (d.rawMaterialId && d.rawMaterialId === rmId) || 
            (d.rmId && d.rmId === rmId) ||
            (d.rawMaterialCode && d.rawMaterialCode === (u.rawMaterial?.code || 'RM')) ||
            (d.rawMaterialName && d.rawMaterialName === name)
          );

          let allocatedBatches = Array.isArray(u.allocatedBatches) && u.allocatedBatches.length > 0
            ? u.allocatedBatches
            : (Array.isArray(matchDraft?.allocatedBatches) && matchDraft.allocatedBatches.length > 0
                ? matchDraft.allocatedBatches
                : (Array.isArray(u.allocations) ? u.allocations.map(a => ({
                    batchId: a.inventory_batch_id || a.lot_number,
                    lotNumber: a.lot_number,
                    internalBatchNo: a.lot_number,
                    poNumber: a.po_number || 'PO-MANUAL-OVERRIDE',
                    grnNumber: a.grn_number || 'GRN-MANUAL-OVERRIDE',
                    supplierBatchNo: a.supplier_batch_no || 'SUP-LOT-01',
                    availableQty: Number(a.available_qty || a.allocated_qty || 0),
                    allocatedQty: Number(a.allocated_qty || 0),
                    unitRate: Number(a.unit_rate || u.unitCost || 0),
                    allocatedAmount: Number(a.allocated_amount || 0),
                    expiryDate: a.expiry_date,
                    uom: a.uom
                  })) : []));

          let lotBatchNo = allocatedBatches.length > 0
            ? allocatedBatches.map(b => b.lotNumber || b.internalBatchNo).filter(Boolean).join(', ')
            : (u.lotBatchNo || null);

          const allocSum = allocatedBatches.reduce((acc, b) => acc + Number(b.allocatedQty || 0), 0);
          const rawStock = Number(u.rawMaterial?.currentStock ?? u.availableQtyAtTime ?? 0);
          const availableQty = allocSum > 0 ? allocSum : 0;
          const reqQty = allocSum > 0 ? allocSum : Number(u.requiredQty || 0);

          let takenQty = Number(u.inputQty || u.requiredQty || 0);
          if (allocSum > 0) {
            takenQty = allocSum;
          } else if (takenQty <= 0) {
            takenQty = reqQty;
          }

          let unitRate = Number(u.unitCost || 0);
          if (allocatedBatches.length > 0) {
            const totAmt = allocatedBatches.reduce((acc, b) => acc + (Number(b.allocatedQty || 0) * Number(b.unitRate || 0)), 0);
            const totQty = allocatedBatches.reduce((acc, b) => acc + Number(b.allocatedQty || 0), 0);
            if (totQty > 0) unitRate = Number((totAmt / totQty).toFixed(4));
          }

          let resolvedUom = u.rawMaterial?.unitId || u.selectedUom || u.unit;
          if (u.rawMaterial?.hasAlternateUom) {
            const alt = (u.rawMaterial?.alternateUom || '').toLowerCase();
            const curr = String(resolvedUom || '').toLowerCase();
            if (alt && curr === alt && Number(u.rawMaterial?.conversionFactor || 1) >= 1000) {
              resolvedUom = 'kg';
            }
          }

          return {
            rawMaterialId: rmId,
            rawMaterialName: name,
            rawMaterialCode: u.rawMaterial?.code || 'RM',
            uom: formatCleanUom(resolvedUom || u.rawMaterial?.consumptionUnit, 'kg', u.rawMaterial),
            hasAlternateUom: Boolean(u.rawMaterial?.hasAlternateUom),
            alternateUom: u.rawMaterial?.alternateUom,
            conversionFactor: Number(u.rawMaterial?.conversionFactor || 1),
            consumptionUnit: u.rawMaterial?.consumptionUnit,
            density: 1.0,
            availableQty,
            warehouseStock: rawStock,
            requiredQty: reqQty,
            takenQty,
            evaporates: u.evaporates !== undefined ? Boolean(u.evaporates) : defaultEvap,
            merged: u.merged !== undefined ? Boolean(u.merged) : true,
            unitRate,
            lotBatchNo,
            expiryDate: u.lot_expiry_date || u.lotExpiryDate || allocatedBatches.find(ab => ab.expiryDate)?.expiryDate || null,
            availableBatches: u.availableBatches || [],
            allocatedBatches
          };
        });
      } else if (Array.isArray(b.rawMaterials) && b.rawMaterials.length > 0) {
        initialRows = b.rawMaterials.map(rm => {
          const rmId = rm.rmId || rm.rawMaterialId || rm.id;
          const name = rm.rawMaterialName || rm.rmName || rm.name || 'Raw Material';
          const lowerName = name.toLowerCase();
          const defaultEvap = lowerName.includes('milk') || lowerName.includes('smp') || 
                              lowerName.includes('stabilizer') || lowerName.includes('essence') ||
                              lowerName.includes('flavor');

          const matchDraft = draftRms.find(d => 
            (d.rawMaterialId && d.rawMaterialId === rmId) || 
            (d.rmId && d.rmId === rmId) ||
            (d.rawMaterialCode && d.rawMaterialCode === (rm.rmCode || rm.rawMaterialCode || 'RM')) ||
            (d.rawMaterialName && d.rawMaterialName === name)
          );

          let allocatedBatches = Array.isArray(rm.allocatedBatches) && rm.allocatedBatches.length > 0
            ? rm.allocatedBatches
            : (Array.isArray(matchDraft?.allocatedBatches) && matchDraft.allocatedBatches.length > 0
                ? matchDraft.allocatedBatches
                : []);

          let lotBatchNo = rm.lotBatchNo || (rm.allocatedBatches?.[0]?.batchNo) || null;
          if (!lotBatchNo && allocatedBatches.length > 0) {
            lotBatchNo = allocatedBatches.map(b => b.lotNumber || b.internalBatchNo).filter(Boolean).join(', ');
          }

          const allocSum = allocatedBatches.reduce((acc, b) => acc + Number(b.allocatedQty || 0), 0);
          const rawStock = Number(rm.currentStock ?? rm.availableQty ?? 0);
          const availableQty = allocSum > 0 ? allocSum : 0;
          const reqQty = allocSum > 0 ? allocSum : Number(rm.requiredQty || 0);

          let takenQty = Number(rm.takenQty || rm.requiredQty || 0);
          if (allocSum > 0) {
            takenQty = allocSum;
          } else if (takenQty <= 0) {
            takenQty = reqQty;
          }

          let resolvedUom = rm.unitId || rm.baseUom || rm.selectedUom || rm.uom;
          if (rm.hasAlternateUom) {
            const alt = (rm.alternateUom || '').toLowerCase();
            const curr = String(resolvedUom || '').toLowerCase();
            if (alt && curr === alt && Number(rm.conversionFactor || 1) >= 1000) {
              resolvedUom = 'kg';
            }
          }

          return {
            rawMaterialId: rmId,
            rawMaterialName: name,
            rawMaterialCode: rm.rmCode || rm.rawMaterialCode || 'RM',
            uom: formatCleanUom(resolvedUom, 'kg', rm),
            hasAlternateUom: Boolean(rm.hasAlternateUom),
            alternateUom: rm.alternateUom,
            conversionFactor: Number(rm.conversionFactor || 1),
            consumptionUnit: rm.consumptionUnit,
            density: 1.0,
            availableQty,
            warehouseStock: rawStock,
            requiredQty: reqQty,
            takenQty,
            evaporates: defaultEvap,
            merged: true,
            unitRate: Number(rm.unitRate || rm.rate || 0),
            lotBatchNo,
            expiryDate: rm.expiryDate || allocatedBatches.find(ab => ab.expiryDate)?.expiryDate || null,
            availableBatches: rm.allocatedBatches || [],
            allocatedBatches
          };
        });
      }

      // If initialRows is still empty, seamless fallback from standard template lines
      if (initialRows.length === 0 && (b.template_id || b.templateId)) {
        try {
          const tId = b.template_id || b.templateId;
          const tRes = await api.get(`/production/standard/templates/${tId}`).catch(() => api.get(`/production/templates/${tId}`));
          const tLines = tRes.data?.lines || tRes.data?.template?.lines || tRes.data?.data?.lines || [];
          if (Array.isArray(tLines) && tLines.length > 0) {
            initialRows = tLines.map(tl => {
              const master = liveRmCatalog.find(rc => rc.id === tl.raw_material_id || rc.code === tl.raw_material_code) || {};
              const name = tl.raw_material_name || master.name || 'Raw Material';
              const lowerName = name.toLowerCase();
              const defaultEvap = lowerName.includes('milk') || lowerName.includes('smp') || 
                                  lowerName.includes('stabilizer') || lowerName.includes('essence') ||
                                  lowerName.includes('flavor');
              const reqQty = Number(tl.quantity || 0);
              const uomStr = tl.uom || master.uom || 'kg';
              return {
                rawMaterialId: tl.raw_material_id || master.id,
                rawMaterialName: name,
                rawMaterialCode: tl.raw_material_code || master.code || 'RM',
                uom: formatCleanUom(uomStr, 'kg', master),
                hasAlternateUom: Boolean(master.hasAlternateUom),
                alternateUom: master.alternateUom,
                conversionFactor: Number(master.conversionFactor || 1),
                consumptionUnit: master.consumptionUnit,
                density: 1.0,
                availableQty: reqQty,
                warehouseStock: Number(master.currentStock || reqQty),
                requiredQty: reqQty,
                takenQty: reqQty,
                evaporates: defaultEvap,
                merged: true,
                unitRate: Number(tl.rate || master.ratePerUnit || 0),
                lotBatchNo: null,
                availableBatches: [],
                allocatedBatches: []
              };
            });
          }
        } catch (_) {}
      }

      setRmRows(initialRows);

      // Merge state
      const merge = detailRes.data.mergeData || b.evaporationData || {};
      if (merge.merge_stage || merge.mergeStage) {
        let loadedStage = merge.merge_stage || merge.mergeStage;
        if (loadedStage === 'Before heating') loadedStage = 'After heating';
        else if (loadedStage === 'Before freezing') loadedStage = 'After freezing';
        else if (loadedStage === 'Other Stage') loadedStage = 'Other Method';
        setMergeStage(loadedStage || 'After heating');
      }
      if (merge.evaporation_pct !== undefined || merge.evaporationRatePct !== undefined) {
        setEvaporationPct(Number(merge.evaporation_pct ?? merge.evaporationRatePct ?? 5.0));
      }
      if (merge.evaporation_applied !== undefined || merge.isEvaporated) {
        setEvaporationApplied(Boolean(merge.evaporation_applied ?? merge.isEvaporated));
      }
      if (merge.is_slide_merged !== undefined) {
        setIsSlideMerged(Boolean(merge.is_slide_merged));
      } else if (merge.merged_total_ml > 0 || b.merged_pre_evap_ml > 0 || merge.mergedPreEvapMl > 0) {
        setIsSlideMerged(true);
      }

      // Multi-Day context FIRST so Steps 3, 4, and 5 isolate Day 2+ cleanly from Day 1
      const completedDaysFromSrv = fetchedDays.filter(d => d.status !== 'IN_PROGRESS');
      const activeDayRec = activeDayRecPre;
      const isMultiDaySession = fetchedDays.length > 0;
      const isFreshMultiDay = Boolean(
        activeDayRec &&
        activeDayRec.status === 'IN_PROGRESS' &&
        (srvViewingDayNo > 1 || completedDaysFromSrv.length > 0)
      );

      setDaysHistory(fetchedDays);
      setActiveDayNo(srvViewingDayNo);
      setBaseRmDeducted(Boolean(b.baseRmDeducted ?? b.base_rm_deducted));
      setIsFinalized(Boolean(b.isFinalized ?? b.is_finalized) || b.status === 'Completed' || b.status === 'qc_passed');
      const effDayDate = activeDayRec?.productionDate
        ? String(activeDayRec.productionDate).split('T')[0]
        : (b.status === 'In Progress' || b.status === 'Paused' ? new Date().toISOString().split('T')[0] : (b.startDate ? String(b.startDate).split('T')[0] : new Date().toISOString().split('T')[0]));
      setDayProductionDate(effDayDate);
      const resolvedShortCode = activeDayRec?.dayBatchCode || b.shortBatchCode || b.short_batch_code || formatDateToDDMMYY(effDayDate);
      setDayBatchCode(resolvedShortCode);
      setDayBatchCodeCustomized(resolvedShortCode !== formatDateToDDMMYY(effDayDate));
      setDayAssignedUsers(Array.isArray(activeDayRec?.assignedUsers) ? activeDayRec.assignedUsers : []);
      if (detailRes.data.companyDetails?.companyPrefix) {
        setResolvedCompanyPrefix(detailRes.data.companyDetails.companyPrefix);
      }

      // Allocations (strictly scoped to requested Day; fallback to activeDayRec.outputs when viewing a completed Day so existing products ALWAYS display)
      const rawServerAllocs = Array.isArray(detailRes.data.allocations) ? detailRes.data.allocations : [];
      const srvReturnedDayNo = Number(b.viewingDayNo ?? b.activeDayNo ?? b.active_day_no ?? 1);
      const dayOutputsFallback = (activeDayRec && activeDayRec.status !== 'IN_PROGRESS' && Array.isArray(activeDayRec.outputs) && activeDayRec.outputs.length > 0)
        ? activeDayRec.outputs.map(o => ({
            seq: o.seq,
            day_no: activeDayRec.dayNo,
            product_id: o.productId,
            product_name: o.productName,
            product_code: o.productCode || 'FP',
            product_unit: o.uom || 'pcs',
            use_mould: Boolean(o.useMould),
            bulkUom: o.bulkUom || o.uom || 'Liter',
            mould_id: o.mouldId || null,
            mould_code: o.mouldCode || '',
            mould_name: o.mouldName || '',
            capacity_ml: Number(o.capacityMl || 0),
            cavities: Number(o.cavities || 1),
            trays: Number(o.trays || 0),
            waste_mode: o.wasteMode || 'PERCENT',
            waste_value: Number(o.wasteValue || 0),
            allocatedBaseMl: Number(o.allocatedBaseMl || 0),
            mix_used_ml: Number(o.allocatedBaseMl || 0),
            waste_ml: Number(o.wasteMl || 0),
            good_pieces: Number(o.theoreticalQty || 0),
            actualYield: Number(o.actualYield || 0),
            rejectOutput: Number(o.rejectOutput || 0),
            productBatchNo: o.productBatchNo || '',
            productSerialNo: o.productSerialNo || '',
            productRms: Array.isArray(o.productRms) ? o.productRms : []
          }))
        : [];
      const serverAllocs = (rawServerAllocs.length > 0 && srvReturnedDayNo === srvViewingDayNo)
        ? rawServerAllocs
        : (dayOutputsFallback.length > 0 ? dayOutputsFallback : rawServerAllocs);
      let savedMAllocs = [];
      if (!isFreshMultiDay || serverAllocs.length > 0) {
        try {
          if (typeof b.mould_allocations === 'string') savedMAllocs = JSON.parse(b.mould_allocations || '[]');
          else if (Array.isArray(b.mould_allocations)) savedMAllocs = b.mould_allocations;
          else if (Array.isArray(b.mouldAllocations)) savedMAllocs = b.mouldAllocations;
        } catch (_) {}
      }

      if (serverAllocs.length > 0) {
        setAllocations(serverAllocs.map((a, idx) => {
          const matched = savedMAllocs.find(s => s.seq === a.seq || s.productId === (a.product_id || a.productId)) || savedMAllocs[idx] || {};
          const matchedProd = prods.find(p => p.id === (a.product_id || a.productId));
          const prodUom = a.product_unit || a.productUom || matched.productUom || formatCleanUom(matchedProd?.consumptionUnit || matchedProd?.uom, 'pcs', matchedProd);
          const rawPrms = Array.isArray(a.productRms) ? a.productRms : (Array.isArray(matched.productRms) ? matched.productRms : []);
          let productRms = rawPrms.map(prm => {
            const m = liveRmCatalog.find(rc => 
              (prm.rawMaterialId && (rc.id === prm.rawMaterialId || rc.code === prm.rawMaterialId)) ||
              (prm.rmId && (rc.id === prm.rmId || rc.code === prm.rmId)) ||
              (prm.rmCode && rc.code && rc.code.toLowerCase() === prm.rmCode.toLowerCase()) ||
              (prm.rawMaterialCode && rc.code && rc.code.toLowerCase() === prm.rawMaterialCode.toLowerCase()) ||
              (prm.rmName && rc.name && rc.name.toLowerCase() === prm.rmName.toLowerCase()) ||
              (prm.rawMaterialName && rc.name && rc.name.toLowerCase() === prm.rawMaterialName.toLowerCase())
            );

            const hasAlt = Boolean(m ? (m.hasAlternateUom && m.alternateUom) : (prm.hasAlternateUom && prm.alternateUom));
            const altUom = m?.alternateUom || prm.alternateUom || null;
            const primUom = m?.uom || m?.unitId || prm.primaryUom || (isPackagingMaterial(prm) ? 'pcs' : 'ml');
            const factor = Number(m?.conversionFactor || prm.conversionFactor || 1);
            const baseQty = Number(m?.baseUomQty || 1000);
            const altQty = Number(m?.alternateUomQty || 1);
            const unitRate = Number(prm.unitRate || m?.ratePerUnit || (prm.rmCode === 'RM-00047' ? 4.01 : 0));

            return {
              ...prm,
              category: m?.category || prm.category || 'Flavour / Essence',
              description: m?.description || prm.description || '',
              hasAlternateUom: hasAlt,
              alternateUom: altUom,
              primaryUom: primUom,
              uom: prm.uom || (hasAlt ? altUom : primUom),
              conversionFactor: factor,
              baseUomQty: baseQty,
              alternateUomQty: altQty,
              taxPercent: Number(prm.taxPercent || prm.tax_percent || 18),
              addToMix: prm.addToMix !== undefined ? Boolean(prm.addToMix) : !isPackagingMaterial(prm),
              unitRate
            };
          });

          const cap = Number(a.capacity_ml || a.capacityMl || 0);
          const cav = a.cavities !== undefined ? Number(a.cavities) : (a.cavity_count ? Number(a.cavity_count) : 0);
          const trays = Number(a.trays || 0);
          const mouldHasCode = Boolean(a.mould_code || a.mouldCode);
          if (a.use_mould !== false && mouldHasCode) {
            const pkg = getPackagingForMould(a.mould_code || a.mouldCode, a.mould_name || a.mouldName);
            const stickDef = pkg?.stick;
            const coverDef = pkg?.cover;
            
            // Calculate pieces yield strictly respecting allocated base mix volume
            const baseMl = Number(a.allocatedBaseMl ?? matched.allocatedBaseMl ?? a.mix_used_ml ?? 0);
            const mixLimit = (cap > 0 && baseMl > 0) ? Math.floor(baseMl / cap) : 0;
            const trayLimit = (trays > 0 && cav > 0) ? (trays * cav) : 0;
            let pieces;
            if (mixLimit > 0 && trayLimit > 0) pieces = Math.min(mixLimit, trayLimit);
            else if (mixLimit > 0) pieces = mixLimit;
            else if (trayLimit > 0) pieces = trayLimit;
            else pieces = Number(a.goodPieces || a.good_pieces || cav || 1);

            if (stickDef) {
              const stickMaster = findLiveMaster({ rmId: stickDef.id, rmCode: stickDef.code, rmName: stickDef.name });
              const stickIdx = productRms.findIndex(p => p.rmCode === stickDef.code || (isPackagingMaterial(p) && p.rmName && p.rmName.toLowerCase().includes('stick')));
              if (stickIdx >= 0) {
                if (!productRms[stickIdx].takenQty || Number(productRms[stickIdx].takenQty) <= 0 || Number(productRms[stickIdx].takenQty) !== pieces) {
                  productRms[stickIdx] = createPackagingItem(stickDef, pieces, productRms[stickIdx], stickMaster);
                }
              } else {
                productRms.push(createPackagingItem(stickDef, pieces, null, stickMaster));
              }
            }
            if (coverDef) {
              const coverMaster = findLiveMaster({ rmId: coverDef.id, rmCode: coverDef.code, rmName: coverDef.name });
              const coverIdx = productRms.findIndex(p => 
                p.rmCode === coverDef.code || 
                (isPackagingMaterial(p) && p.rmName && (p.rmName.toLowerCase().includes('cover') || p.rmName.toLowerCase().includes('packing') || p.rmName.toLowerCase().includes('poly')))
              );
              if (coverIdx >= 0) {
                if (!productRms[coverIdx].takenQty || Number(productRms[coverIdx].takenQty) <= 0 || Number(productRms[coverIdx].takenQty) !== pieces) {
                  productRms[coverIdx] = createPackagingItem(coverDef, pieces, productRms[coverIdx], coverMaster);
                }
              } else {
                productRms.push(createPackagingItem(coverDef, pieces, null, coverMaster));
              }
            }
          }
          const srvYields = Array.isArray(detailRes.data.productYields) ? detailRes.data.productYields : [];
          const yieldMatch = srvYields.find(y => y.productId === (a.product_id || a.productId) || Number(y.seq) === Number(a.seq));
          const resolvedActualYield = a.actualYield ?? a.actual_yield ?? yieldMatch?.actualGoodOutput ?? yieldMatch?.actualOutput ?? matched.actualYield;
          const resolvedRejectOutput = Number(a.rejectOutput ?? a.reject_output ?? yieldMatch?.rejectOutput ?? matched.rejectOutput ?? 0);
          return {
            seq: a.seq || (idx + 1),
            productId: a.product_id || a.productId,
            productName: a.product_name || a.productName || matchedProd?.name || 'Finished Product',
            productCode: a.product_code || a.productCode || matchedProd?.code || 'FP',
            productUom: prodUom,
            useMould: a.use_mould !== undefined ? Boolean(a.use_mould) : (matched.useMould !== undefined ? Boolean(matched.useMould) : true),
            bulkUom: a.bulkUom || matched.bulkUom || (prodUom === 'pcs' ? 'Liter' : prodUom),
            allocatedBaseMl: Number(a.allocatedBaseMl ?? a.allocated_base_ml ?? matched.allocatedBaseMl ?? a.mix_used_ml ?? 0),
            mouldId: a.mould_id || a.mouldId || null,
            mouldCode: a.mould_code || a.mouldCode || '',
            mouldName: a.mould_name || a.mouldName || '',
            capacityMl: Number(a.capacity_ml || a.capacityMl || 0),
            cavities: a.cavities !== undefined ? Number(a.cavities) : (a.cavity_count ? Number(a.cavity_count) : 0),
            trays: Number(a.trays || 0),
            wasteMode: a.waste_mode || a.wasteMode || 'PERCENT',
            wasteValue: Number(a.waste_value ?? a.wasteValue ?? 0),
            actualYield: resolvedActualYield !== undefined && resolvedActualYield !== null ? resolvedActualYield : undefined,
            rejectOutput: resolvedRejectOutput,
            productBatchNo: a.productBatchNo || a.product_batch_no || matched.productBatchNo || '',
            productBatchNoCustomized: Boolean(a.productBatchNo || a.product_batch_no || matched.productBatchNo),
            productSerialNo: a.productSerialNo || a.product_serial_no || matched.productSerialNo || '',
            productRms
          };
        }));
      } else if (srvViewingDayNo > 1 || completedDaysFromSrv.length > 0) {
        // Day 2+ starts with an empty product queue — operator adds products cleanly without Day 1 bleed
        setAllocations([]);
        setSelectedStep3Index(0);
      } else {
        // Initialize from batch planned products (Day 1 initial open only)
        let batchProds = Array.isArray(b.products) && b.products.length > 0 ? b.products : (b.selectedProducts || []);
        if (batchProds.length === 0 && b.product) {
          batchProds = [b.product];
        }
        if (batchProds.length > 0) {
          setAllocations(batchProds.map((p, idx) => {
            const prodUom = formatCleanUom(p.consumptionUnit || p.unit || p.uom, 'pcs', p);
            return {
              seq: idx + 1,
              productId: p.productId || p.id,
              productName: p.name || p.productName || 'Finished Product',
              productCode: p.code || p.productCode || 'FP',
              productUom: prodUom,
              useMould: true,
              bulkUom: prodUom === 'pcs' ? 'Liter' : prodUom,
              allocatedBaseMl: 0,
              mouldId: null,
              mouldCode: '',
              mouldName: '',
              capacityMl: 0,
              cavities: 0,
              trays: 0,
              wasteMode: 'PERCENT',
              wasteValue: 0,
              productBatchNo: '',
              productBatchNoCustomized: false,
              productSerialNo: '',
              productRms: []
            };
          }));
        } else {
          setAllocations([]);
        }
      }

      // Costing & Overhead Charges (scoped strictly to active Day when multi-day)
      if (detailRes.data.costingSummary) {
        setCostingData(detailRes.data.costingSummary);
      }
      const rawLabour = activeDayRec
        ? Number(activeDayRec.labourTotalCost || 0)
        : Number(b.labour_total_cost ?? detailRes.data.costingSummary?.labourCost ?? 0);
      setLabourCost(rawLabour);
      const rawEb = activeDayRec
        ? Number(activeDayRec.ebTotalCost || 0)
        : Number(b.eb_total_cost ?? detailRes.data.costingSummary?.utilityCost ?? 0);
      setElectricityCost(rawEb);

      if (activeDayRec) {
        setEbStartReading(activeDayRec.ebStartReading ? String(activeDayRec.ebStartReading) : '');
        setEbEndReading(
          activeDayRec.ebEndReading
            ? String(activeDayRec.ebEndReading)
            : (activeDayRec.ebUnitsKwh ? String(activeDayRec.ebUnitsKwh) : '')
        );
        setEbRatePerUnit(Number(activeDayRec.ebRatePerUnit || 8.5));
        setOverheadCost(Number(activeDayRec.overheadAmt || 0));
      } else {
        setEbStartReading('');
        setEbEndReading(b.eb_units_kwh ? String(b.eb_units_kwh) : '');
        setEbRatePerUnit(Number(b.eb_rate_per_unit || 8.5));
        if (b.overhead_amt || b.overheadAmt) {
          setOverheadCost(Number(b.overhead_amt || b.overheadAmt));
        } else if (detailRes.data.costingSummary?.overheadCost) {
          setOverheadCost(Number(detailRes.data.costingSummary.overheadCost));
        } else {
          setOverheadCost(1069.12);
        }
      }

      if (activeDayRec && Array.isArray(activeDayRec.outputs) && activeDayRec.outputs.length > 0) {
        const nextLabMap = {};
        activeDayRec.outputs.forEach(o => {
          if (o.productId) nextLabMap[o.productId] = Number(o.allocatedLabourCost || 0);
        });
        setProductLabourMap(nextLabMap);
      } else {
        setProductLabourMap({});
      }

      if (detailRes.data.companyDetails) {
        setCompanyDetails(detailRes.data.companyDetails);
      } else if (b.companyDetails) {
        setCompanyDetails(b.companyDetails);
      }

      // Factory Timeline Stages & Product Stages Map (never bleed Day 1 into Day 2+)
      setSelectedProductStageTab('ALL');
      if (isMultiDaySession && activeDayRec) {
        const dayStages = Array.isArray(activeDayRec.timelineStages) ? activeDayRec.timelineStages : [];
        const dayProdStages = (activeDayRec.productStagesMap && typeof activeDayRec.productStagesMap === 'object')
          ? activeDayRec.productStagesMap
          : {};
        setProductStagesMap(dayProdStages);
        setTimelineStages(dayStages.length > 0 ? dayStages : DEFAULT_FACTORY_STAGES);
      } else {
        const stagesFromBatch = detailRes.data.timelineStages || b.timeline_stages || b.timelineStages;
        const productStagesFromBatch = detailRes.data.productStagesMap || b.productStagesMap;
        if (productStagesFromBatch && typeof productStagesFromBatch === 'object' && Object.keys(productStagesFromBatch).length > 0) {
          setProductStagesMap(productStagesFromBatch);
        } else if (stagesFromBatch && typeof stagesFromBatch === 'object' && !Array.isArray(stagesFromBatch) && stagesFromBatch.productStagesMap) {
          setProductStagesMap(stagesFromBatch.productStagesMap);
        } else {
          setProductStagesMap({});
        }

        if (Array.isArray(stagesFromBatch) && stagesFromBatch.length > 0) {
          setTimelineStages(stagesFromBatch);
        } else if (stagesFromBatch && typeof stagesFromBatch === 'object' && Array.isArray(stagesFromBatch.stages) && stagesFromBatch.stages.length > 0) {
          setTimelineStages(stagesFromBatch.stages);
        } else {
          setTimelineStages(DEFAULT_FACTORY_STAGES);
        }
      }

      // QC Lab Test Requirement (false = direct to stock, true = quarantine hold)
      if (b.qc_required !== undefined) {
        setLabTestRequired(Boolean(b.qc_required));
      } else if (b.labTestRequired !== undefined) {
        setLabTestRequired(Boolean(b.labTestRequired));
      } else {
        setLabTestRequired(false);
      }

      // Saved Product Yields & Notes (strictly scoped to viewing Day on multi-day runs)
      if (isMultiDaySession && activeDayRec) {
        const srvYieldsList = (Array.isArray(detailRes.data.productYields) && srvReturnedDayNo === srvViewingDayNo)
          ? detailRes.data.productYields
          : [];
        const dayYields = srvYieldsList.length > 0
          ? srvYieldsList
          : (Array.isArray(activeDayRec.outputs)
              ? activeDayRec.outputs.map(o => ({
                  seq: o.seq,
                  productId: o.productId,
                  productName: o.productName,
                  productCode: o.productCode,
                  uom: o.uom,
                  allocatedBaseMl: Number(o.allocatedBaseMl || 0),
                  calculatedYield: Number(o.theoreticalQty || o.actualYield || 0),
                  actualGoodOutput: Number(o.actualYield || 0),
                  actualOutput: Number(o.actualYield || 0),
                  rejectOutput: Number(o.rejectOutput || 0),
                  productBatchNo: o.productBatchNo,
                  productSerialNo: o.productSerialNo
                }))
              : []);
        setProductYields(dayYields);
        setActualYieldPieces(Number(activeDayRec.totalOutputQty || 0));
        setCompletionNotes(activeDayRec.notes || '');
      } else {
        const savedYields = detailRes.data.productYields || b.product_yields || b.productYields;
        let parsedYields = [];
        try {
          if (typeof savedYields === 'string') parsedYields = JSON.parse(savedYields || '[]');
          else if (Array.isArray(savedYields)) parsedYields = savedYields;
        } catch (_) {}
        setProductYields(parsedYields.length > 0 ? parsedYields : []);
        if (b.actual_output || b.actualOutput || b.good_quantity || b.goodQuantity) {
          setActualYieldPieces(Number(b.actual_output || b.actualOutput || b.good_quantity || b.goodQuantity));
        }
        setCompletionNotes(b.note || '');
      }
    } catch (err) {
      console.error('Failed to load standard production details:', err);
      Swal.fire({ title: 'Error', text: 'Failed to load production batch floor execution data.', icon: 'error' });
    } finally {
      setLoading(false);
    }
  }, [batchId]);

  useEffect(() => {
    if (isOpen) {
      selectedDayNoRef.current = null;
      setSelectedDayNo(null);
      fetchAllData(false, null);
    }
  }, [isOpen, batchId, fetchAllData]);

  // ── CLIENT-SIDE SHARED MATH CALCULATION ──
  const liveEvaporationResult = useMemo(() => {
    return calculateEvaporation({
      lines: rmRows,
      evaporationPct,
      mergeStage,
      evaporationApplied
    });
  }, [rmRows, evaporationPct, mergeStage, evaporationApplied]);

  // When in read-only / view mode, filter to only the raw materials that were actually used
  const displayedRmRows = useMemo(() => {
    if (!isViewMode) return rmRows;
    const usedOnly = rmRows.filter(r => {
      const taken = Number(r.takenQty || 0);
      const hasLots = Array.isArray(r.allocatedBatches) && r.allocatedBatches.length > 0;
      return taken > 0 || hasLots;
    });
    return usedOnly.length > 0 ? usedOnly : rmRows;
  }, [isViewMode, rmRows]);

  // Net evaporated tank mix & multi-day carry-forward accounting
  const netBatchPostEvapMl = useMemo(() => {
    if (liveEvaporationResult.mixAfterEvapMl > 0) {
      return liveEvaporationResult.mixAfterEvapMl;
    }
    if (liveEvaporationResult.totalBeforeEvapMl > 0) {
      return liveEvaporationResult.totalBeforeEvapMl;
    }
    return 0;
  }, [liveEvaporationResult.mixAfterEvapMl, liveEvaporationResult.totalBeforeEvapMl]);

  const hasOpenInProgressDay = useMemo(() => {
    return (Array.isArray(daysHistory) ? daysHistory : []).some(d => d.status === 'IN_PROGRESS');
  }, [daysHistory]);

  const completedDaysList = useMemo(() => {
    return (Array.isArray(daysHistory) ? daysHistory : []).filter(d => d.status !== 'IN_PROGRESS');
  }, [daysHistory]);

  const previousDaysAllocatedMl = useMemo(() => {
    const completedBeforeActive = completedDaysList
      .filter(d => Number(d.dayNo) < Number(activeDayNo))
      .reduce((s, d) => s + Number(d.allocatedMixMl || 0), 0);
    if (completedDaysList.length > 0) return round2(completedBeforeActive);
    return round2(Number(batch?.previousDaysAllocatedMl || 0));
  }, [completedDaysList, activeDayNo, batch?.previousDaysAllocatedMl]);

  const totalCompletedDaysAllocatedMl = useMemo(() => {
    return round2(completedDaysList.reduce((s, d) => s + Number(d.allocatedMixMl || 0), 0));
  }, [completedDaysList]);

  const remainingTankMixAfterCompletedMl = useMemo(() => {
    return Math.max(0, round2(netBatchPostEvapMl - totalCompletedDaysAllocatedMl));
  }, [netBatchPostEvapMl, totalCompletedDaysAllocatedMl]);

  const awaitingNextDayStart = useMemo(() => {
    return Boolean(
      !isCompleted &&
      !isEditingCompletedDay &&
      completedDaysList.length > 0 &&
      !hasOpenInProgressDay &&
      remainingTankMixAfterCompletedMl > 1
    );
  }, [isCompleted, isEditingCompletedDay, completedDaysList.length, hasOpenInProgressDay, remainingTankMixAfterCompletedMl]);

  const addDaysToIso = useCallback((isoDate, offsetDays = 1) => {
    const base = isoDate && /^\d{4}-\d{2}-\d{2}/.test(isoDate) ? isoDate.slice(0, 10) : new Date().toISOString().split('T')[0];
    const dt = new Date(`${base}T12:00:00Z`);
    if (isNaN(dt.getTime())) return new Date().toISOString().split('T')[0];
    dt.setUTCDate(dt.getUTCDate() + Number(offsetDays || 0));
    return dt.toISOString().split('T')[0];
  }, []);

  const currentDayRecId = currentDayRec?.id || null;

  const syncDayMetaToServer = useCallback(async ({ nextDate, nextCode, nextUsers } = {}) => {
    if (!batchId || !currentDayRecId || isViewMode || isCompleted) return;
    try {
      setSavingDayMeta(true);
      const payload = {};
      if (nextDate !== undefined) payload.productionDate = nextDate;
      if (nextCode !== undefined) payload.dayBatchCode = nextCode;
      if (nextUsers !== undefined) payload.assignedUsers = nextUsers;
      const res = await api.put(`/production/standard/${batchId}/days/${currentDayRecId}/meta`, payload);
      const updatedDay = res.data?.data?.day;
      if (updatedDay) {
        setDaysHistory(prev => prev.map(d => (d.id === updatedDay.id ? { ...d, ...updatedDay } : d)));
      }
    } catch (err) {
      console.error('Failed to sync day metadata:', err);
    } finally {
      setSavingDayMeta(false);
    }
  }, [batchId, currentDayRecId, isViewMode, isCompleted]);

  const handleDayDateChange = useCallback((nextDate) => {
    if (!nextDate) return;
    const prevAutoCode = formatDateToDDMMYY(dayProductionDate);
    const shouldAutoSyncCode = !dayBatchCodeCustomized || !dayBatchCode || dayBatchCode === prevAutoCode;
    const resolvedNextCode = shouldAutoSyncCode ? formatDateToDDMMYY(nextDate) : dayBatchCode;
    setDayProductionDate(nextDate);
    if (shouldAutoSyncCode) {
      setDayBatchCode(resolvedNextCode);
      setDayBatchCodeCustomized(false);
    }
    setAllocations(prev => prev.map(a => a.productBatchNoCustomized ? a : { ...a, productBatchNo: '' }));
    if (currentDayRecId && !isEditingCompletedDay) {
      syncDayMetaToServer({ nextDate, nextCode: resolvedNextCode });
    }
  }, [dayProductionDate, dayBatchCode, dayBatchCodeCustomized, currentDayRecId, isEditingCompletedDay, syncDayMetaToServer]);

  const handleToggleDayUser = useCallback((userObj) => {
    if (!userObj) return;
    setDayAssignedUsers(prev => {
      const exists = prev.some(u => (u.id && userObj.id && u.id === userObj.id) || u.name === userObj.name);
      const next = exists
        ? prev.filter(u => !((u.id && userObj.id && u.id === userObj.id) || u.name === userObj.name))
        : [...prev, { id: userObj.id, name: userObj.name, empId: userObj.empId || '', role: userObj.role || 'PRODUCTION_STAFF' }];
      if (currentDayRecId && !isEditingCompletedDay) {
        syncDayMetaToServer({ nextUsers: next });
      }
      return next;
    });
  }, [currentDayRecId, isEditingCompletedDay, syncDayMetaToServer]);

  // Available mix opening balance for the currently active Day (Carry-Forward Tank Mix)
  const availableMixMl = useMemo(() => {
    return Math.max(0, round2(netBatchPostEvapMl - previousDaysAllocatedMl));
  }, [netBatchPostEvapMl, previousDaysAllocatedMl]);

  // Live serial preview fetch (per-product 8-digit sequence from Tax Settings company name)
  const allocProductIdsKey = useMemo(() => {
    return [...new Set((allocations || []).map(a => a.productId).filter(Boolean))].sort().join(',');
  }, [allocations]);

  useEffect(() => {
    if (!isOpen || !allocProductIdsKey) return;
    let active = true;
    api.get('/production/standard/serial-preview', {
      params: {
        productIds: allocProductIdsKey,
        dayBatchCode: dayBatchCode || formatDateToDDMMYY(dayProductionDate),
        date: dayProductionDate
      }
    })
      .then(res => {
        if (!active || !res.data) return;
        if (res.data.companyPrefix) setResolvedCompanyPrefix(res.data.companyPrefix);
        if (res.data.products) setSerialPreviewMap(res.data.products);
      })
      .catch(() => {});
    return () => { active = false; };
  }, [isOpen, allocProductIdsKey, dayBatchCode, dayProductionDate]);

  // Live sequential product mould allocation math (already scoped to active Day opening balance)
  const liveAllocationsResult = useMemo(() => {
    return calculateAllocations({
      availableMixMl,
      totalMixMl: availableMixMl,
      previousDaysAllocatedMl: 0,
      allocations
    });
  }, [availableMixMl, allocations]);

  // Active Finished End Products in Floor Cockpit
  const activeAllocs = useMemo(() => {
    if (liveAllocationsResult.allocations && liveAllocationsResult.allocations.length > 0) {
      return liveAllocationsResult.allocations;
    }
    const filtered = (allocations || []).filter(a => a.productId || a.productName);
    if (filtered.length > 0) return filtered;
    if (batch?.product) {
      return [{
        seq: 1,
        productId: batch.product.id || batch.productId,
        productName: batch.product.name,
        productCode: batch.product.code || batch.product.sku || 'FP',
        productUom: formatCleanUom(batch.product.consumptionUnit || batch.product.unit || 'pcs', 'pcs', batch.product),
        goodPieces: Number(batch.quantity || 2000),
        allocatedBaseMl: Number(availableMixMl || 0)
      }];
    }
    return [];
  }, [liveAllocationsResult.allocations, allocations, batch?.product, batch?.productId, batch?.quantity, availableMixMl]);

  // Synchronize product labour map when total labourCost or activeAllocs change
  useEffect(() => {
    if (!activeAllocs || activeAllocs.length === 0) return;
    setProductLabourMap(prev => {
      const keys = Object.keys(prev);
      const totalAllocated = Object.values(prev).reduce((s, v) => s + (Number(v) || 0), 0);
      if (keys.length > 0 && totalAllocated > 0 && Math.abs(totalAllocated - labourCost) < 0.01) {
        return prev;
      }
      const totalPieces = activeAllocs.reduce((s, a) => s + Number(a.goodPieces || a.goodUnits || a.plannedQty || 1), 0);
      const nextMap = {};
      let remaining = labourCost;
      activeAllocs.forEach((a, idx) => {
        const pId = a.productId || `p_${a.seq || idx}`;
        const pcs = Number(a.goodPieces || a.goodUnits || a.plannedQty || 1);
        if (idx === activeAllocs.length - 1) {
          nextMap[pId] = Math.max(0, Math.round(remaining * 100) / 100);
        } else {
          const share = totalPieces > 0 ? (pcs / totalPieces) : (1 / activeAllocs.length);
          const pVal = Math.round((labourCost * share) * 100) / 100;
          nextMap[pId] = pVal;
          remaining -= pVal;
        }
      });
      return nextMap;
    });
  }, [labourCost, activeAllocs]);

  // Automatically sync packaging quantities (sticks, covers, pouches) to match live pieces yield (e.g. 14 pcs)
  useEffect(() => {
    if (!Array.isArray(allocations) || allocations.length === 0) return;
    let needsUpdate = false;
    const nextAllocs = allocations.map((alloc, idx) => {
      const isM = alloc.useMould !== false;
      const liveAlloc = liveAllocationsResult?.allocations?.[idx];
      const calculatedPieces = Number(liveAlloc?.goodPieces || alloc.goodPieces || 0);
      const targetPieces = (alloc.actualYield !== undefined && alloc.actualYield !== null && alloc.actualYield !== '' && Number(alloc.actualYield) > 0)
        ? Number(alloc.actualYield)
        : calculatedPieces;
      if (!isM || targetPieces <= 0 || !Array.isArray(alloc.productRms)) return alloc;

      let prmChanged = false;
      const updatedPrms = alloc.productRms.map(prm => {
        if (!isPackagingMaterial(prm) || prm.addToMix === true) return prm;
        const prmUom = String(prm.uom || prm.primaryUom || '').toLowerCase();
        if (!['pcs', 'pc', 'piece', 'pieces', 'nos', 'no', 'unit', 'units'].includes(prmUom)) return prm;
        const currentQty = Number(prm.takenQty ?? prm.qty ?? 0);
        if (currentQty !== targetPieces) {
          prmChanged = true;
          needsUpdate = true;
          const rate = Number(prm.unitRate || 0);
          const totalCost = Number((rate * targetPieces).toFixed(2));
          return {
            ...prm,
            takenQty: targetPieces,
            qty: targetPieces,
            requiredQty: targetPieces,
            totalCost,
            allocatedBatches: Array.isArray(prm.allocatedBatches) ? prm.allocatedBatches.map(b => ({
              ...b,
              allocatedQty: targetPieces,
              allocatedAmount: Number((Number(b.unitRate || rate) * targetPieces).toFixed(2))
            })) : []
          };
        }
        return prm;
      });

      if (prmChanged) {
        return {
          ...alloc,
          goodPieces: targetPieces,
          productRms: updatedPrms
        };
      }
      return alloc;
    });

    if (needsUpdate) {
      setAllocations(nextAllocs);
    }
  }, [liveAllocationsResult, allocations]);

  const handleProductLabourChange = (productId, val) => {
    const num = Math.max(0, Number(val) || 0);
    setProductLabourMap(prev => {
      const next = { ...prev, [productId]: num };
      const newTotal = Object.values(next).reduce((s, v) => s + (Number(v) || 0), 0);
      setLabourCost(Math.round(newTotal * 100) / 100);
      return next;
    });
  };

  const handleTotalLabourChange = (val) => {
    const num = Math.max(0, Number(val) || 0);
    setLabourCost(num);
    if (activeAllocs && activeAllocs.length > 0) {
      const totalPieces = activeAllocs.reduce((s, a) => s + Number(a.goodPieces || a.goodUnits || a.plannedQty || 1), 0);
      const nextMap = {};
      let remaining = num;
      activeAllocs.forEach((a, idx) => {
        const pId = a.productId || `p_${a.seq || idx}`;
        const pcs = Number(a.goodPieces || a.goodUnits || a.plannedQty || 1);
        if (idx === activeAllocs.length - 1) {
          nextMap[pId] = Math.max(0, Math.round(remaining * 100) / 100);
        } else {
          const share = totalPieces > 0 ? (pcs / totalPieces) : (1 / activeAllocs.length);
          const pVal = Math.round((num * share) * 100) / 100;
          nextMap[pId] = pVal;
          remaining -= pVal;
        }
      });
      setProductLabourMap(nextMap);
    }
  };

  const handleEbCalc = (start, end, rate) => {
    const s = Number(start) || 0;
    const e = Number(end) || 0;
    const r = Number(rate) || 8.5;
    const units = Math.max(0, Number((e - s).toFixed(2)));
    const cost = Math.round((units * r) * 100) / 100;
    setElectricityCost(cost);
  };

  // Total Base Mix Cost from Step 1 raw materials (takenQty * unitRate)
  const totalBaseMixCost = useMemo(() => {
    return rmRows.reduce((sum, r) => sum + (Number(r.takenQty || 0) * Number(r.unitRate || 0)), 0);
  }, [rmRows]);

  const baseCostPerMl = useMemo(() => {
    const postMl = netBatchPostEvapMl > 0 ? netBatchPostEvapMl : (liveEvaporationResult.totalBeforeEvapMl || 1);
    return postMl > 0 ? (totalBaseMixCost / postMl) : 0;
  }, [totalBaseMixCost, netBatchPostEvapMl, liveEvaporationResult.totalBeforeEvapMl]);

  const totalAllocatedBaseMl = useMemo(() => {
    return allocations.reduce((sum, a) => sum + Number(a.allocatedBaseMl || a.mixUsedMl || 0), 0);
  }, [allocations]);

  const unallocatedRemainingMl = useMemo(() => {
    return round2(availableMixMl - totalAllocatedBaseMl);
  }, [availableMixMl, totalAllocatedBaseMl]);

  const hasRemainingForNextDay = useMemo(() => {
    return unallocatedRemainingMl > 1;
  }, [unallocatedRemainingMl]);

  const totalProcessWasteMl = useMemo(() => {
    return liveAllocationsResult.allocations.reduce((sum, a) => sum + Number(a.wasteMl || 0), 0);
  }, [liveAllocationsResult.allocations]);

  const totalWastageMl = useMemo(() => {
    // Carry-forward balance left for Day 2/3 is NOT treated as wastage unless entire production is finalized
    if (!isFinalized && hasRemainingForNextDay) {
      return totalProcessWasteMl;
    }
    return Math.max(0, unallocatedRemainingMl) + totalProcessWasteMl;
  }, [unallocatedRemainingMl, totalProcessWasteMl, isFinalized, hasRemainingForNextDay]);

  const totalWastageCost = useMemo(() => {
    return totalWastageMl * baseCostPerMl;
  }, [totalWastageMl, baseCostPerMl]);

  // ── LOT ALLOCATION MODAL HANDLERS (Step 1 Base Mix & Step 3 Product-Specific RMs) ──
  const initLotModalForRow = async (row) => {
    if (!row) return;
    setLotModalOpen(true);
    setLoadingLots(true);
    setSelectedGrnFilter('ALL');
    setLotSearchTerm('');
    setShowManualOverrideForm(false);

    const master = findMaster(row);
    const rawClean = (master?.printName || master?.name || row.rawMaterialName || row.rmName || row.rawMaterialCode || 'RM')
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, 16);
    const reqQty = Number(row.takenQty ?? row.requiredQty ?? row.qty ?? 10);

    const today = new Date();
    const dd = String(today.getDate()).padStart(2, '0');
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const yyyy = today.getFullYear();
    const mfgStr = `${dd}-${mm}-${yyyy}`;
    const expStr = `${dd}-${mm}-${yyyy + 1}`;

    const currentAllocMap = {};
    const currentSupplierMap = {};
    if (Array.isArray(row.allocatedBatches)) {
      row.allocatedBatches.forEach(b => {
        const idKey = b.batchId || b.id || b.lotNumber || b.internalBatchNo;
        if (idKey) currentAllocMap[idKey] = Number(b.allocatedQty || 0);
        if (b.supplierBatchNo || b.mfgBatchNo) {
          currentSupplierMap[idKey] = b.supplierBatchNo || b.mfgBatchNo;
        }
      });
    }
    setLotAllocations(currentAllocMap);
    setManualSupplierBatches(currentSupplierMap);

    const defaultRate = Number(row.unitRate || master?.ratePerUnit || 54);
    setOverrideForm({
      internalBatchNo: `BATCH-${rawClean}-001`,
      grnNumber: 'GRN-MANUAL-OVERRIDE',
      poNumber: 'PO-MANUAL-OVERRIDE',
      batchQty: 1,
      weight: '25 kg / 50',
      availableQty: Math.max(reqQty || 100, 4840),
      supplierBatchNo: 'BATCH-01',
      mfgDate: mfgStr,
      expiryDate: expStr,
      supplierName: 'SUP-LOT-DIRECT',
      latestPoNumber: null,
      latestBatchNumber: null,
      unitRate: defaultRate
    });

    const rmId = row.rawMaterialId || row.rmId || master?.id;
    try {
      const [batchesRes, metaRes] = await Promise.all([
        rmId ? api.get(`/production/rm-batches/${rmId}`).catch(() => ({ data: [] })) : Promise.resolve({ data: [] }),
        rmId ? api.get(`/production/rm-batch-meta/${rmId}?rmName=${encodeURIComponent(row.rawMaterialName || row.rmName || master?.name || '')}`).catch(() => null) : Promise.resolve(null)
      ]);

      const lots = Array.isArray(batchesRes.data) ? [...batchesRes.data] : [];
      if (Array.isArray(row.allocatedBatches)) {
        row.allocatedBatches.forEach(ab => {
          const abId = ab.batchId || ab.lotNumber || ab.internalBatchNo;
          const exists = lots.some(l => 
            String(l.id) === String(abId) || 
            (l.internalBatchNo && l.internalBatchNo === (ab.lotNumber || ab.internalBatchNo))
          );
          if (!exists) {
            // ONLY keep in available lots if it was explicitly flagged as a manual override
            // Regular warehouse batches that do not exist in live warehouse stock must NOT be fabricated with fake available quantities!
            if (ab.isManualOverride === true) {
              lots.unshift({
                id: abId,
                internalBatchNo: ab.lotNumber || ab.internalBatchNo,
                batchNumber: ab.lotNumber || ab.internalBatchNo,
                supplierBatchNo: ab.supplierBatchNo || 'SUP-LOT-01',
                grnNumber: ab.grnNumber || 'GRN-MANUAL-OVERRIDE',
                grnRef: ab.grnNumber || 'GRN-MANUAL-OVERRIDE',
                poNumber: ab.poNumber || 'PO-MANUAL-OVERRIDE',
                availableQty: Number(ab.availableQty || ab.allocatedQty || 0),
                netQty: Number(ab.availableQty || ab.allocatedQty || 0),
                expiryDate: ab.expiryDate || expStr,
                unitCost: Number(ab.unitRate || row.unitRate || master?.ratePerUnit || 54),
                unitRate: Number(ab.unitRate || row.unitRate || master?.ratePerUnit || 54),
                rate: Number(ab.unitRate || row.unitRate || master?.ratePerUnit || 54),
                isManualOverride: true
              });
            }
          }
        });
      }
      setAvailableLots(lots);

      // Reconcile pre-saved allocations strictly against visible lots so stale/phantom keys never inflate allocated sum or zero out "Allocate Remaining"
      const reconciledAllocMap = {};
      const reconciledSupplierMap = {};
      Object.entries(currentAllocMap).forEach(([rawKey, rawQty]) => {
        const qtyVal = Number(rawQty || 0);
        if (qtyVal <= 0) return;
        const matchedLot = lots.find(l =>
          String(l.id) === String(rawKey) ||
          (l.internalBatchNo && String(l.internalBatchNo) === String(rawKey)) ||
          (l.batchNumber && String(l.batchNumber) === String(rawKey))
        );
        if (matchedLot) {
          const canonicalId = matchedLot.id || matchedLot.internalBatchNo;
          const avail = Number(matchedLot.availableQty ?? matchedLot.netQty ?? qtyVal);
          reconciledAllocMap[canonicalId] = Number(Math.min(avail, (reconciledAllocMap[canonicalId] || 0) + qtyVal).toFixed(6));
          if (currentSupplierMap[rawKey]) {
            reconciledSupplierMap[canonicalId] = currentSupplierMap[rawKey];
          }
        }
      });

      // Resolve latest PO & continuing batch number
      const meta = metaRes?.data || null;
      let resolvedPo = meta?.latestPoNumber;
      if (!resolvedPo || resolvedPo === 'PO-OPENING' || resolvedPo === 'PO-MANUAL-OVERRIDE') {
        const poLot = lots.find(l => l.poNumber && !l.poNumber.startsWith('PO-OPEN') && !l.poNumber.includes('Override'));
        if (poLot) resolvedPo = poLot.poNumber;
      }
      if (!resolvedPo) resolvedPo = 'PO-MANUAL-OVERRIDE';

      let resolvedBatch = meta?.nextBatchNumber;
      if (!resolvedBatch) {
        let maxSeq = 0;
        lots.forEach(l => {
          const m = (l.internalBatchNo || l.batchNumber || '').match(new RegExp(`^BATCH-${rawClean}-(\\d+)`, 'i'));
          if (m && m[1]) {
            const p = parseInt(m[1], 10);
            if (p > maxSeq) maxSeq = p;
          }
        });
        resolvedBatch = `BATCH-${rawClean}-${String(maxSeq + 1).padStart(3, '0')}`;
      }

      setOverrideForm({
        internalBatchNo: resolvedBatch,
        grnNumber: 'GRN-MANUAL-OVERRIDE',
        poNumber: resolvedPo,
        batchQty: 1,
        weight: '25 kg / 50',
        availableQty: Math.max(reqQty || 100, 4840),
        supplierBatchNo: 'BATCH-01',
        mfgDate: mfgStr,
        expiryDate: expStr,
        supplierName: meta?.latestSupplierName || lots[0]?.supplierName || 'SUP-LOT-DIRECT',
        latestPoNumber: resolvedPo,
        latestBatchNumber: meta?.latestBatchNumber || null,
        unitRate: meta?.latestRate || defaultRate
      });

      // Auto-allocate warehouse batch lots precisely matching required quantity if unallocated or mismatched after reconciliation
      const currentAllocSum = Object.values(reconciledAllocMap).reduce((s, v) => s + Number(v || 0), 0);
      if (lots.length > 0 && reqQty > 0 && (currentAllocSum === 0 || Math.abs(currentAllocSum - reqQty) > 0.0001)) {
        let rem = reqQty;
        const autoAlloc = {};
        const sortedLots = [...lots].sort((a, b) => {
          const dateA = new Date(a.expiryDate || '2099-12-31').getTime();
          const dateB = new Date(b.expiryDate || '2099-12-31').getTime();
          return dateA - dateB;
        });
        for (const lot of sortedLots) {
          if (rem <= 0) break;
          const lid = lot.id || lot.internalBatchNo;
          const avail = Number(lot.availableQty ?? lot.netQty ?? 0);
          if (avail > 0) {
            const take = Math.min(avail, rem);
            autoAlloc[lid] = Number(take.toFixed(6));
            rem = Number((rem - take).toFixed(6));
          }
        }
        setLotAllocations(autoAlloc);
      } else {
        setLotAllocations(reconciledAllocMap);
      }
      if (Object.keys(reconciledSupplierMap).length > 0) {
        setManualSupplierBatches(reconciledSupplierMap);
      }
    } catch (err) {
      console.warn('Could not fetch warehouse lots for row:', err);
      setAvailableLots([]);
    } finally {
      setLoadingLots(false);
    }
  };

  const getActiveLotTargetRow = () => {
    if (!activeLotTarget) return activeLotRowIndex !== null ? rmRows[activeLotRowIndex] : null;
    if (activeLotTarget.type === 'PRODUCT_RM') {
      return allocations[activeLotTarget.allocIndex]?.productRms?.[activeLotTarget.prmIndex] || null;
    }
    return rmRows[activeLotTarget.rowIndex ?? activeLotRowIndex] || null;
  };

  const openLotModal = async (rowIndex) => {
    setActiveLotTarget({ type: 'STEP_1', rowIndex });
    setActiveLotRowIndex(rowIndex);
    await initLotModalForRow(rmRows[rowIndex]);
  };

  const openProductRmLotModal = async (allocIndex, prmIndex) => {
    setActiveLotTarget({ type: 'PRODUCT_RM', allocIndex, prmIndex });
    setActiveLotRowIndex(allocIndex);
    const prm = allocations[allocIndex]?.productRms?.[prmIndex];
    if (prm) {
      await initLotModalForRow(prm);
    }
  };

  const handleSetLotQty = (lotId, value, maxAvail) => {
    let num = Number(value);
    if (isNaN(num) || num < 0) num = 0;
    if (num > maxAvail) num = maxAvail;

    setLotAllocations(prev => {
      const next = { ...prev };
      const foundLot = availableLots.find(l => String(l.id) === String(lotId) || String(l.internalBatchNo) === String(lotId));
      if (foundLot) {
        if (foundLot.id) delete next[foundLot.id];
        if (foundLot.internalBatchNo) delete next[foundLot.internalBatchNo];
      }
      next[lotId] = num;
      return next;
    });
  };

  const handleFillRemainingLot = (lotId, maxAvail) => {
    const row = getActiveLotTargetRow();
    if (!row) return;
    const targetQty = Number(row.takenQty ?? row.requiredQty ?? row.qty ?? 0);
    const foundLot = availableLots.find(l => String(l.id) === String(lotId) || String(l.internalBatchNo) === String(lotId));

    // Only sum allocations belonging to actually visible lots (excluding target lot)
    const cleanAllocMap = {};
    let currentOtherTotal = 0;
    availableLots.forEach((lot, idx) => {
      const lid = lot.id || lot.internalBatchNo || `lot-${idx}`;
      const val = Number(lotAllocations[lid] ?? lotAllocations[lot.id] ?? lotAllocations[lot.internalBatchNo] ?? 0);
      const isTarget =
        String(lid) === String(lotId) ||
        (foundLot && (String(lot.id) === String(foundLot.id) || (lot.internalBatchNo && String(lot.internalBatchNo) === String(foundLot.internalBatchNo))));
      if (isTarget) return;
      if (val > 0) {
        cleanAllocMap[lid] = val;
        currentOtherTotal += val;
      }
    });

    const remainingNeeded = Math.max(0, targetQty - currentOtherTotal);
    const toAlloc = Math.min(maxAvail, Number(remainingNeeded.toFixed(6)));
    cleanAllocMap[lotId] = toAlloc;
    setLotAllocations(cleanAllocMap);
  };

  const handleAutoAllocateFEFO = () => {
    const row = getActiveLotTargetRow();
    if (!row) return;
    const targetQty = Number(row.takenQty ?? row.requiredQty ?? row.qty ?? 0);
    if (targetQty <= 0) {
      Swal.fire({ title: 'Quantity Required', text: 'Please set required or taken quantity for this material first.', icon: 'info' });
      return;
    }

    let remainingNeeded = targetQty;
    const newAlloc = {};

    // Sort lots by expiryDate ascending (FEFO)
    const sortedLots = [...availableLots].sort((a, b) => {
      const dateA = new Date(a.expiryDate || '2099-12-31').getTime();
      const dateB = new Date(b.expiryDate || '2099-12-31').getTime();
      return dateA - dateB;
    });

    for (const lot of sortedLots) {
      if (remainingNeeded <= 0) break;
      const avail = Number(lot.availableQty || lot.netQty || 0);
      if (avail > 0) {
        const take = Math.min(avail, remainingNeeded);
        newAlloc[lot.id] = Number(take.toFixed(6));
        remainingNeeded = Number((remainingNeeded - take).toFixed(6));
      }
    }

    setLotAllocations(newAlloc);
    Swal.fire({
      title: 'FEFO Auto-Allocation Applied',
      text: `Reserved lots in earliest expiry order. Remaining required: ${remainingNeeded} ${formatCleanUom(row?.uom, 'units', row)}`,
      icon: 'success',
      timer: 1500
    });
  };

  // Add / Apply Manual Override Lot (Exact standard from /production/standard/add BatchAllocationGrid)
  const handleAddManualOverrideLot = () => {
    const row = getActiveLotTargetRow();
    if (!row) return;
    const master = findMaster(row);

    const lotId = `manual-${Date.now()}`;
    const newLot = {
      id: lotId,
      internalBatchNo: overrideForm.internalBatchNo?.trim() || `BATCH-OVERRIDE-${Date.now().toString().slice(-4)}`,
      grnNumber: overrideForm.grnNumber?.trim() || 'GRN-MANUAL-OVERRIDE',
      grnRef: overrideForm.grnNumber?.trim() || 'GRN-MANUAL-OVERRIDE',
      poNumber: overrideForm.poNumber?.trim() || 'PO-MANUAL-OVERRIDE',
      poReferenceNo: overrideForm.poNumber?.trim() || 'PO-MANUAL-OVERRIDE',
      batchQty: Number(overrideForm.batchQty || 1),
      weight: overrideForm.weight || '25 kg / 50',
      availableQty: Number(overrideForm.availableQty || 4840),
      netQty: Number(overrideForm.availableQty || 4840),
      supplierBatchNo: overrideForm.supplierBatchNo || 'BATCH-01',
      mfgBatchNo: overrideForm.supplierBatchNo || 'BATCH-01',
      mfgDate: overrideForm.mfgDate || '01-10-2026',
      expiryDate: overrideForm.expiryDate || '01-10-2027',
      supplierName: overrideForm.supplierName || 'SUP-LOT-DIRECT',
      unitCost: Number(overrideForm.unitRate || row?.unitRate || master?.ratePerUnit || 54),
      unitRate: Number(overrideForm.unitRate || row?.unitRate || master?.ratePerUnit || 54),
      isManualOverride: true,
      source: 'MANUAL_OVERRIDE'
    };

    setAvailableLots(prev => [newLot, ...prev.filter(l => l.internalBatchNo !== newLot.internalBatchNo)]);
    setManualSupplierBatches(prev => ({
      ...prev,
      [lotId]: newLot.supplierBatchNo
    }));

    // Optionally sync with backend
    api.post('/production/rm-batch-manual', {
      rawMaterialId: row.rawMaterialId || row.rmId || master?.id,
      batchNumber: newLot.internalBatchNo,
      supplierBatchNo: newLot.supplierBatchNo,
      poNumber: newLot.poNumber,
      grnNumber: newLot.grnNumber,
      availableQty: newLot.availableQty,
      unitRate: newLot.unitRate,
      expiryDate: newLot.expiryDate,
      mfgDate: newLot.mfgDate
    }).catch(err => console.warn('Manual batch sync notice:', err));

    const req = Number(row?.takenQty ?? row?.requiredQty ?? row?.qty ?? 0);
    const currentAllocSum = Object.values(lotAllocations).reduce((s, v) => s + Number(v || 0), 0);
    const needed = Math.max(0, req - currentAllocSum);
    const toAlloc = Math.min(newLot.availableQty, needed);
    if (toAlloc > 0) {
      setLotAllocations(prev => ({
        ...prev,
        [lotId]: toAlloc
      }));
    }

    // Auto-advance sequence for next manual batch
    const currBatch = newLot.internalBatchNo;
    const match = currBatch.match(/^(.*?)(\d+)$/);
    if (match) {
      const pfx = match[1];
      const seq = parseInt(match[2], 10);
      const nextBatchStr = `${pfx}${String(seq + 1).padStart(match[2].length, '0')}`;
      setOverrideForm(prev => ({
        ...prev,
        internalBatchNo: nextBatchStr,
        latestBatchNumber: currBatch
      }));
    }

    setShowManualOverrideForm(false);
    Swal.fire({
      title: 'Manual Override Lot Added',
      html: `
        <div style="text-align: left; font-size: 13px; line-height: 1.6;">
          <p><strong>✓ Our Batch (Continuing):</strong> <span style="font-family: monospace; font-weight: bold; color: #4f46e5;">${newLot.internalBatchNo}</span></p>
          <p><strong>✓ GRN:</strong> <span style="font-family: monospace; font-weight: bold; color: #d97706;">${newLot.grnNumber} (Manual Override)</span></p>
          <p><strong>✓ PO Number:</strong> <span style="font-family: monospace; font-weight: bold;">${newLot.poNumber}</span></p>
          <p><strong>✓ Available Stock:</strong> ${newLot.availableQty} ${row?.uom || 'units'}</p>
        </div>
      `,
      icon: 'success',
      timer: 2000
    });
  };

  const handleSaveLotAllocations = async () => {
    if (activeLotRowIndex === null && !activeLotTarget) return;
    const isProductRm = activeLotTarget?.type === 'PRODUCT_RM';
    const row = isProductRm 
      ? allocations[activeLotTarget.allocIndex]?.productRms?.[activeLotTarget.prmIndex]
      : rmRows[activeLotTarget?.rowIndex ?? activeLotRowIndex];
    if (!row) return;

    const allocatedBatches = [];
    let totalAllocQty = 0;
    let weightedAmountSum = 0;

    for (let lIdx = 0; lIdx < availableLots.length; lIdx++) {
      const lot = availableLots[lIdx];
      const lid = lot.id || lot.internalBatchNo || `lot-${lIdx}`;
      const qty = Number(lotAllocations[lid] ?? lotAllocations[lot.id] ?? lotAllocations[lot.internalBatchNo] ?? 0);
      if (qty <= 0) continue;

      totalAllocQty += qty;

      let unitRate = Number(lot.unitCost || lot.rate || lot.unitRate || row?.unitRate || 0);
      try {
        const rateRes = await api.get(`/purchase/live-rate?batchId=${lot.id}&allocatedQty=${qty}`).catch(() => null);
        if (rateRes?.data?.rate > 0) {
          unitRate = Number(rateRes.data.rate);
        }
      } catch (_) {}

      const lotAmount = Number((qty * unitRate).toFixed(4));
      weightedAmountSum += lotAmount;

      allocatedBatches.push({
        batchId: lot.id,
        lotNumber: lot.internalBatchNo || lot.batchNumber || `#LOT-${String(lot.id).slice(-4)}`,
        internalBatchNo: lot.internalBatchNo || lot.batchNumber || `#LOT-${String(lot.id).slice(-4)}`,
        supplierBatchNo: manualSupplierBatches[lid] || lot.supplierBatchNo || 'BATCH-01',
        expiryDate: lot.expiryDate || null,
        mfgDate: lot.mfgDate || null,
        grnNumber: lot.grnNumber || lot.grnRef || null,
        poNumber: lot.poNumber || lot.poReferenceNo || null,
        allocatedQty: Number(qty.toFixed(6)),
        availableQty: Number(lot.availableQty || lot.netQty || 0),
        remainingQty: Number(Math.max(0, Number(lot.availableQty || lot.netQty || 0) - qty).toFixed(6)),
        unitRate,
        allocatedAmount: Number(lotAmount.toFixed(2)),
        uom: row?.uom || 'units',
        isManualOverride: Boolean(lot.isManualOverride || lot.source === 'MANUAL_OVERRIDE' || (lot.id && String(lot.id).startsWith('manual-')))
      });
    }

    if (isProductRm) {
      const { allocIndex, prmIndex } = activeLotTarget;
      let nextAllocs = [];
      setAllocations(prev => {
        const copy = [...prev];
        const targetAlloc = { ...copy[allocIndex] };
        const prms = [...(targetAlloc.productRms || [])];
        const targetPrm = { ...prms[prmIndex] };
        targetPrm.allocatedBatches = allocatedBatches;
        if (allocatedBatches.length > 0) {
          targetPrm.lotBatchNo = allocatedBatches.map(b => b.lotNumber).join(', ');
          targetPrm.takenQty = totalAllocQty;
          targetPrm.qty = totalAllocQty;
          if (weightedAmountSum > 0 && totalAllocQty > 0) {
            targetPrm.unitRate = Number((weightedAmountSum / totalAllocQty).toFixed(4));
            targetPrm.totalCost = Number(weightedAmountSum.toFixed(2));
          }
        }
        prms[prmIndex] = targetPrm;
        targetAlloc.productRms = prms;
        copy[allocIndex] = targetAlloc;
        nextAllocs = copy;
        return copy;
      });
      setLotModalOpen(false);

      if (nextAllocs.length > 0) {
        api.put(`/production/standard/${batchId}/allocations`, {
          allocations: nextAllocs.filter(a => a.productId).map(a => ({
            seq: a.seq,
            productId: a.productId,
            productName: a.productName,
            productCode: a.productCode,
            productUom: a.productUom,
            useMould: (a.useMould !== false) && (Boolean(a.mouldId) || Number(a.capacityMl || 0) > 0),
            bulkUom: a.bulkUom || a.productUom || 'L',
            allocatedBaseMl: Number(a.allocatedBaseMl || a.mixUsedMl || 0),
            mouldId: a.mouldId || null,
            mouldCode: a.mouldCode || '',
            mouldName: a.mouldName || '',
            capacityMl: Number(a.capacityMl || 0) > 0 ? Number(a.capacityMl) : (a.useMould !== false ? 50 : 0),
            cavities: Number(a.cavities || 42),
            trays: Number(a.trays || 0),
            wasteMode: a.wasteMode || 'PERCENT',
            wasteValue: Number(a.wasteValue ?? 0),
            mixUsedMl: Number(a.allocatedBaseMl || a.mixUsedMl || 0),
            wasteMl: Number(a.wasteMl || 0),
            goodPieces: Number(a.goodPieces || 0),
            productRms: Array.isArray(a.productRms) ? a.productRms : []
          }))
        }).catch(err => console.warn('Auto-save product RM lot allocation notice:', err));
      }

      Swal.fire({
        title: 'Batches Allocated & Database Persisted!',
        text: `Allocated ${totalAllocQty} ${row?.uom || 'units'} across ${allocatedBatches.length} lot(s). Live PO rate: ₹${(weightedAmountSum / (totalAllocQty || 1)).toFixed(2)}/unit.`,
        icon: 'success',
        timer: 1600
      });
      return;
    }

    const targetRowIdx = activeLotTarget?.rowIndex ?? activeLotRowIndex;
    const updatedRows = [...rmRows];
    const targetRow = { ...updatedRows[targetRowIdx] };

    targetRow.allocatedBatches = allocatedBatches;
    if (allocatedBatches.length > 0) {
      targetRow.lotBatchNo = allocatedBatches.map(b => b.lotNumber).join(', ');
      targetRow.takenQty = totalAllocQty;
      targetRow.availableQty = totalAllocQty;
      targetRow.requiredQty = totalAllocQty;
      if (weightedAmountSum > 0 && totalAllocQty > 0) {
        targetRow.unitRate = Number((weightedAmountSum / totalAllocQty).toFixed(4));
        targetRow.totalCost = Number(weightedAmountSum.toFixed(2));
      }
    }

    updatedRows[targetRowIdx] = targetRow;
    setRmRows(updatedRows);
    setLotModalOpen(false);

    // Persist allocation changes to backend database immediately
    api.put(`/production/standard/${batchId}/process`, {
      mergeStage,
      evaporationPct,
      evaporationApplied,
      lines: updatedRows
    }).catch(e => console.warn('Auto-save process after allocation failed:', e));

    Swal.fire({
      title: 'Batches Allocated & Database Persisted!',
      text: `Allocated ${totalAllocQty} ${formatCleanUom(targetRow?.uom, 'kg', targetRow)} across ${allocatedBatches.length} lot(s). Live PO rate blended: ₹${targetRow.unitRate}/unit.`,
      icon: 'success',
      timer: 1800
    });
  };

  // ── ROW EDITING ACTIONS ──
  const handleUpdateRmRow = (index, field, value) => {
    setRmRows(prev => {
      const copy = [...prev];
      const current = copy[index] || {};
      if (field === 'requiredQty') {
        const prevReq = Number(current.requiredQty || 0);
        const prevTaken = Number(current.takenQty || 0);
        if (prevTaken <= 0 || prevTaken === prevReq) {
          copy[index] = { ...current, requiredQty: value, takenQty: value };
          return copy;
        }
      }
      copy[index] = { ...current, [field]: value };
      return copy;
    });
  };

  const handleRemoveRmRow = (index) => {
    setRmRows(prev => prev.filter((_, idx) => idx !== index));
  };

  // Callback when user multi-selects raw materials from ProductionItemSearchModal
  const handleAddSelectedRMsFromModal = (selectedMaterials) => {
    if (targetAllocIndex !== null) {
      // Adding product-specific flavours / essences / packaging to this allocation
      const newPrms = selectedMaterials.map(rm => {
        const isPackaging = isPackagingMaterial(rm);
        const cleanUom = formatCleanUom(rm.consumptionUnit || rm.uom || rm.unitId, isPackaging ? 'pcs' : 'ml', rm);
        const hasAlt = Boolean(rm.hasAlternateUom && rm.alternateUom);
        const altUom = rm.alternateUom || null;
        const convFactor = Number(rm.conversionFactor || 1);
        const initialUom = hasAlt && altUom ? altUom : cleanUom;
        const initialQty = 1;
        const unitRate = Number(rm.ratePerUnit || (rm.code === 'RM-00047' ? 4.01 : 0));
        const taxPercent = Number(rm.taxPercent || rm.tax_percent || 18);
        const topBatch = rm.availableBatches?.[0];

        return {
          rmId: rm.id,
          rawMaterialId: rm.id,
          rmName: rm.printName || rm.name,
          rawMaterialName: rm.printName || rm.name,
          rmCode: rm.code || 'RM',
          rawMaterialCode: rm.code || 'RM',
          uom: initialUom,
          primaryUom: cleanUom,
          hasAlternateUom: hasAlt,
          alternateUom: altUom,
          conversionFactor: convFactor,
          taxPercent: taxPercent,
          density: Number(rm.density_g_per_ml || rm.density || 1.0),
          takenQty: initialQty,
          qty: initialQty,
          addToMix: !isPackaging,
          unitRate: unitRate,
          totalCost: Number((unitRate * initialQty).toFixed(2)),
          currentStock: Number(rm.currentStock || 0),
          allocatedBatches: topBatch ? [
            {
              batchId: topBatch.id,
              lotNumber: topBatch.batchNo,
              internalBatchNo: topBatch.batchNo,
              allocatedQty: initialQty,
              availableQty: Number(topBatch.remainingQty || topBatch.availableQty || initialQty),
              remainingQty: topBatch.remainingQty,
              expiryDate: topBatch.expiryDate,
              unitRate: unitRate,
              allocatedAmount: Number((initialQty * unitRate).toFixed(2)),
              uom: initialUom
            }
          ] : []
        };
      });

      let updatedAllocs = [];
      setAllocations(prev => {
        const copy = [...prev];
        const target = { ...copy[targetAllocIndex] };
        target.productRms = [...(target.productRms || []), ...newPrms];
        copy[targetAllocIndex] = target;
        updatedAllocs = copy;
        return copy;
      });

      // Auto-save step 3 allocations immediately
      if (updatedAllocs.length > 0) {
        api.put(`/production/standard/${batchId}/allocations`, {
          allocations: updatedAllocs.filter(a => a.productId).map(a => ({
            seq: a.seq,
            productId: a.productId,
            productName: a.productName,
            productCode: a.productCode,
            productUom: a.productUom,
            useMould: (a.useMould !== false) && (Boolean(a.mouldId) || Number(a.capacityMl || 0) > 0),
            bulkUom: a.bulkUom || a.productUom || 'L',
            allocatedBaseMl: Number(a.allocatedBaseMl || a.mixUsedMl || 0),
            mouldId: a.mouldId || null,
            mouldCode: a.mouldCode || '',
            mouldName: a.mouldName || '',
            capacityMl: Number(a.capacityMl || 0) > 0 ? Number(a.capacityMl) : (a.useMould !== false ? 50 : 0),
            cavities: Number(a.cavities || 42),
            trays: Number(a.trays || 0),
            wasteMode: a.wasteMode || 'PERCENT',
            wasteValue: Number(a.wasteValue ?? 0),
            mixUsedMl: Number(a.allocatedBaseMl || a.mixUsedMl || 0),
            wasteMl: Number(a.wasteMl || 0),
            goodPieces: Number(a.goodPieces || 0),
            productRms: Array.isArray(a.productRms) ? a.productRms : []
          }))
        }).catch(err => console.warn('Auto-save added RMs allocations notice:', err));
      }

      setItemSearchOpen(false);
      setTargetAllocIndex(null);

      Swal.fire({
        title: 'Product Ingredients Added!',
        text: `Added ${newPrms.length} item(s). Liquid ingredients marked 'Add to Mix' automatically add to the product mix volume; packaging items remain at 0 ml mix.`,
        icon: 'success',
        timer: 1600
      });
      return;
    }

    const newRows = selectedMaterials.map(rm => ({
      rawMaterialId: rm.id,
      rawMaterialName: rm.printName || rm.name,
      rawMaterialCode: rm.code || 'RM',
      uom: formatCleanUom(rm.consumptionUnit || rm.uom || rm.unitId, 'kg', rm),
      hasAlternateUom: Boolean(rm.hasAlternateUom),
      alternateUom: rm.alternateUom,
      conversionFactor: Number(rm.conversionFactor || 1),
      consumptionUnit: rm.consumptionUnit,
      density: Number(rm.density_g_per_ml || 1.0),
      availableQty: rm.availableBatches?.length > 0 ? 10 : 0,
      warehouseStock: Number(rm.currentStock || 0),
      requiredQty: 10,
      takenQty: 10,
      evaporates: rm.evaporates_by_default !== undefined ? Boolean(rm.evaporates_by_default) : (
        (rm.name || '').toLowerCase().includes('milk') ||
        (rm.name || '').toLowerCase().includes('smp') ||
        (rm.name || '').toLowerCase().includes('stabilizer') ||
        (rm.name || '').toLowerCase().includes('essence')
      ),
      merged: true,
      unitRate: Number(rm.ratePerUnit || 0),
      lotBatchNo: rm.availableBatches?.[0]?.batchNo || null,
      availableBatches: rm.availableBatches || [],
      allocatedBatches: rm.availableBatches?.length > 0 ? [
        {
          batchId: rm.availableBatches[0].id,
          lotNumber: rm.availableBatches[0].batchNo,
          internalBatchNo: rm.availableBatches[0].batchNo,
          allocatedQty: 10,
          remainingQty: rm.availableBatches[0].remainingQty,
          expiryDate: rm.availableBatches[0].expiryDate,
          unitRate: Number(rm.ratePerUnit || 0),
          allocatedAmount: 10 * Number(rm.ratePerUnit || 0)
        }
      ] : []
    }));

    setRmRows(prev => [...prev, ...newRows]);
    setItemSearchOpen(false);
    Swal.fire({
      title: 'Materials Added',
      text: `Added ${newRows.length} raw material(s) with live DB UOMs and batch allocations.`,
      icon: 'success',
      timer: 1500
    });
  };

  // ── Helpers for Synchronizing Pieces Yield and Packaging Quantities ──
  const computeAllocPiecesYield = (alloc, overrideField = null, overrideValue = null) => {
    const cap = Number(overrideField === 'capacityMl' ? (overrideValue || 50) : (alloc.capacityMl || 50));
    const cav = Number(overrideField === 'cavities' ? (overrideValue || 42) : (alloc.cavities || 42));
    const trays = Number(overrideField === 'trays' ? (overrideValue || 0) : (alloc.trays || 0));
    const baseMl = Number(overrideField === 'allocatedBaseMl' ? overrideValue : (alloc.allocatedBaseMl || alloc.mixUsedMl || 0));
    const wm = overrideField === 'wasteMode' ? overrideValue : (alloc.wasteMode || 'PERCENT');
    const wv = Number(overrideField === 'wasteValue' ? overrideValue : (alloc.wasteValue ?? 0));

    // Product-specific mix addition (flavours, essences, colors)
    let addedRmVolumeMl = 0;
    const prms = Array.isArray(alloc.productRms) ? alloc.productRms : [];
    for (const prm of prms) {
      const shouldAdd = prm.addToMix !== undefined 
        ? Boolean(prm.addToMix) 
        : (prm.isLiquidMix !== undefined ? Boolean(prm.isLiquidMix) : !isPackagingMaterial(prm));
      if (!shouldAdd) continue;
      const prmQty = Number(prm.takenQty ?? prm.qty ?? prm.quantity ?? 0);
      const prmUom = prm.uom || prm.selectedUom || 'ml';
      const prmDensity = Number(prm.density || 1.0);
      try {
        addedRmVolumeMl += toMl(prmQty, prmUom, prmDensity);
      } catch (_) {
        addedRmVolumeMl += prmQty;
      }
    }

    const totalMix = baseMl + addedRmVolumeMl;
    let wasteMl = 0;
    if (wm === 'PERCENT' || wm === '%') {
      wasteMl = (totalMix * wv) / 100;
    } else {
      wasteMl = trays > 0 ? (wv * trays) : wv;
    }
    const usableMixMl = Math.max(0, totalMix - wasteMl);

    const mixLimit = (cap > 0 && usableMixMl > 0) ? Math.floor(usableMixMl / cap) : 0;
    const trayLimit = (trays > 0 && cav > 0) ? (trays * cav) : 0;

    if (mixLimit > 0 && trayLimit > 0) {
      return Math.min(mixLimit, trayLimit);
    }
    if (mixLimit > 0) return mixLimit;
    if (trayLimit > 0) return trayLimit;
    if (Number(alloc.goodPieces) > 0) return Number(alloc.goodPieces);
    return cav > 0 ? cav : 1;
  };

  const syncPackagingQuantities = (productRms, pieces) => {
    if (!Array.isArray(productRms) || pieces <= 0) return productRms;
    return productRms.map(prm => {
      if (!isPackagingMaterial(prm) || prm.addToMix === true) return prm;
      const prmUom = String(prm.uom || prm.primaryUom || '').toLowerCase();
      if (!['pcs', 'pc', 'piece', 'pieces', 'nos', 'no', 'unit', 'units'].includes(prmUom)) return prm;
      const rate = Number(prm.unitRate || 0);
      const totalCost = Number((rate * pieces).toFixed(2));
      return {
        ...prm,
        takenQty: pieces,
        qty: pieces,
        requiredQty: pieces,
        totalCost,
        allocatedBatches: Array.isArray(prm.allocatedBatches) ? prm.allocatedBatches.map(b => ({
          ...b,
          allocatedQty: pieces,
          allocatedAmount: Number((Number(b.unitRate || rate) * pieces).toFixed(2))
        })) : []
      };
    });
  };

  const handleUpdateProductBaseMl = (index, value) => {
    setAllocations(prev => {
      const copy = [...prev];
      const target = { ...copy[index], allocatedBaseMl: value, mixUsedMl: value };
      const pieces = computeAllocPiecesYield(target);
      const effectivePieces = (target.actualYield !== undefined && target.actualYield !== null && target.actualYield !== '' && Number(target.actualYield) > 0)
        ? Number(target.actualYield)
        : pieces;
      if (effectivePieces > 0 && target.mouldCode && Array.isArray(target.productRms)) {
        target.goodPieces = effectivePieces;
        target.productRms = syncPackagingQuantities(target.productRms, effectivePieces);
      }
      copy[index] = target;
      return copy;
    });
  };

  const handleAllocateRemainingMix = (index) => {
    const effectiveTotal = availableMixMl > 0 ? availableMixMl : (liveEvaporationResult.mixAfterEvapMl || liveEvaporationResult.totalBeforeEvapMl || 0);
    const otherUsed = allocations.reduce((sum, a, i) => i === index ? sum : sum + Number(a.allocatedBaseMl || a.mixUsedMl || 0), 0);
    const rem = Math.max(0, effectiveTotal - otherUsed);
    setAllocations(prev => {
      const copy = [...prev];
      const target = { ...copy[index], allocatedBaseMl: rem, mixUsedMl: rem };
      const pieces = computeAllocPiecesYield(target);
      const effectivePieces = (target.actualYield !== undefined && target.actualYield !== null && target.actualYield !== '' && Number(target.actualYield) > 0)
        ? Number(target.actualYield)
        : pieces;
      if (effectivePieces > 0 && target.mouldCode && Array.isArray(target.productRms)) {
        target.goodPieces = effectivePieces;
        target.productRms = syncPackagingQuantities(target.productRms, effectivePieces);
      }
      copy[index] = target;
      return copy;
    });
  };

  const handleRemoveProductRm = (allocIndex, prmIndex) => {
    setAllocations(prev => {
      const copy = [...prev];
      const target = { ...copy[allocIndex] };
      target.productRms = (target.productRms || []).filter((_, i) => i !== prmIndex);
      copy[allocIndex] = target;
      return copy;
    });
  };

  const handleUpdateProductRm = (allocIndex, prmIndex, field, value) => {
    setAllocations(prev => {
      const copy = [...prev];
      const target = { ...copy[allocIndex] };
      const prms = [...(target.productRms || [])];
      const current = { ...prms[prmIndex] };

      if (field === 'uom') {
        const prevUom = String(current.uom || '').toLowerCase();
        const nextUom = String(value || '').toLowerCase();
        current.uom = value;
        const currentQty = Number(current.takenQty ?? current.qty ?? 0);
        if (currentQty > 0) {
          if ((prevUom === 'liter' || prevUom === 'ltr') && nextUom === 'ml') {
            current.takenQty = Number((currentQty * 1000).toFixed(4));
            current.qty = current.takenQty;
          } else if (prevUom === 'ml' && (nextUom === 'liter' || nextUom === 'ltr')) {
            current.takenQty = Number((currentQty / 1000).toFixed(6));
            current.qty = current.takenQty;
          }
        }
      } else if (field === 'takenQty' || field === 'unitRate' || field === 'qty') {
        const qty = Number(field === 'unitRate' ? (current.takenQty ?? current.qty ?? 0) : value);
        const rate = Number(field === 'unitRate' ? value : current.unitRate || 0);
        current.takenQty = qty;
        current.qty = qty;
        current.totalCost = Number((qty * rate).toFixed(2));
      } else {
        current[field] = value;
      }

      prms[prmIndex] = current;
      target.productRms = prms;

      if (field === 'addToMix' || field === 'takenQty' || field === 'uom') {
        const pieces = computeAllocPiecesYield(target);
        if (pieces > 0 && target.mouldCode && Array.isArray(target.productRms)) {
          target.goodPieces = pieces;
          target.productRms = syncPackagingQuantities(target.productRms, pieces);
        }
      }

      copy[allocIndex] = target;
      return copy;
    });
  };

  // ── SECTION B: Evaporation Actions ──
  const handleApplyEvaporation = () => {
    if (!isSlideMerged) {
      Swal.fire({
        title: 'Merge Required First',
        text: 'Please toggle "Slide to Merge" switch before applying evaporation.',
        icon: 'warning'
      });
      return;
    }
    setEvaporationApplied(true);
    Swal.fire({
      title: 'Evaporation Applied!',
      text: `Applied ${evaporationPct}% evaporation. Evaporated: ${formatIndian(liveEvaporationResult.evaporatedMl)} ml. Mix After: ${formatIndian(liveEvaporationResult.mixAfterEvapMl)} ml.`,
      icon: 'success',
      timer: 2000
    });
  };

  const handleUndoEvaporation = () => {
    setEvaporationApplied(false);
  };

  // Direct Mix After Evaporation Handler (2-way sync with Evaporation %)
  const handleDirectMixAfterEvapChange = (valStr) => {
    const postEvapMl = parseFloat(valStr);
    if (isNaN(postEvapMl) || postEvapMl < 0) return;
    const totalPre = Number(liveEvaporationResult.totalBeforeEvapMl || 0);
    const evapBase = Number(liveEvaporationResult.evaporationBaseMl || 0);

    if (totalPre > 0 && evapBase > 0) {
      const evaporatedLoss = Math.max(0, totalPre - postEvapMl);
      const calcPct = Math.max(0, Math.min(100, Number(((evaporatedLoss / evapBase) * 100).toFixed(2))));
      setEvaporationPct(calcPct);
      if (postEvapMl < totalPre) {
        setEvaporationApplied(true);
      }
    }
  };

  // Factory Stages Persistence to PUT /api/production/standard/:id/stages
  const handleSaveFactoryStages = async () => {
    if (isEditingCompletedDay && currentDayRec?.id) {
      await handleSaveCompletedDayChanges();
      return;
    }
    try {
      setSavingStages(true);
      const ebKwh = ebEndReading && ebStartReading ? Math.max(0, Number((Number(ebEndReading) - Number(ebStartReading)).toFixed(2))) : (Number(ebEndReading) || 0);
      await api.put(`/production/standard/${batchId}/stages`, { 
        dayNo: activeDayNo,
        timelineStages,
        productStagesMap,
        labourTotalCost: labourCost,
        ebTotalCost: electricityCost,
        ebStartReading: ebStartReading ? Number(ebStartReading) : null,
        ebEndReading: ebEndReading ? Number(ebEndReading) : null,
        ebUnitsKwh: ebKwh,
        ebRatePerUnit,
        overheadCost
      });
      Swal.fire({
        title: `Day ${activeDayNo} Stages & Operational Costs Saved!`,
        text: `Persisted factory stages, labour cost (₹${labourCost.toLocaleString('en-IN')}) and power cost (₹${electricityCost.toLocaleString('en-IN')}) to database.`,
        icon: 'success',
        timer: 1800
      });
      if (onBatchUpdated) onBatchUpdated();
    } catch (err) {
      console.error('Failed to save stages:', err);
      Swal.fire({ title: 'Error', text: 'Failed to persist factory stages sequence.', icon: 'error' });
    } finally {
      setSavingStages(false);
    }
  };

  // Central Step-by-Step Auto-Save across all stages
  const autoSaveStep = async (stepToSave) => {
    if (isCompleted || isViewMode) return;
    try {
      if ((stepToSave === 1 || stepToSave === 2) && Number(activeDayNo) === 1) {
        setSavingProcess(true);
        await api.put(`/production/standard/${batchId}/process`, {
          dayNo: 1,
          mergeStage,
          evaporationPct,
          evaporationApplied,
          lines: rmRows,
          isSlideMerged: stepToSave === 2 ? true : isSlideMerged
        });
      } else if (stepToSave === 3) {
        if (awaitingNextDayStart) return;
        if (isEditingCompletedDay && currentDayRec?.id) {
          if (liveAllocationsResult.isValid) {
            await handleSaveCompletedDayChanges({ silent: true, includeBaseProcess: false });
          }
          return;
        }
        setSavingAllocations(true);
        const validAllocations = allocations.filter(a => a.productId);
        await api.put(`/production/standard/${batchId}/allocations`, {
          dayNo: activeDayNo,
          dayBatchCode,
          productionDate: dayProductionDate,
          allocations: validAllocations.map(a => ({
            seq: a.seq,
            productId: a.productId,
            productName: a.productName,
            productCode: a.productCode,
            productUom: a.productUom,
            useMould: (a.useMould !== false) && (Boolean(a.mouldId) || Number(a.capacityMl || 0) > 0),
            bulkUom: a.bulkUom || a.productUom || 'L',
            allocatedBaseMl: Number(a.allocatedBaseMl || a.mixUsedMl || 0),
            mouldId: a.mouldId || null,
            mouldCode: a.mouldCode || '',
            mouldName: a.mouldName || '',
            capacityMl: Number(a.capacityMl || 0) > 0 ? Number(a.capacityMl) : (a.useMould !== false ? 50 : 0),
            cavities: Number(a.cavities || 42),
            trays: Number(a.trays || 0),
            wasteMode: a.wasteMode || 'PERCENT',
            wasteValue: Number(a.wasteValue ?? 0),
            mixUsedMl: Number(a.allocatedBaseMl || a.mixUsedMl || 0),
            wasteMl: Number(liveAllocationsResult.allocations.find(la => la.productId === a.productId)?.wasteMl ?? a.wasteMl ?? 0),
            goodPieces: Number(a.actualYield !== undefined && a.actualYield !== null && a.actualYield !== '' && Number(a.actualYield) >= 0
              ? a.actualYield
              : (liveAllocationsResult.allocations.find(la => la.productId === a.productId)?.goodPieces ?? a.goodPieces ?? 0)),
            actualYield: (a.actualYield !== undefined && a.actualYield !== null && a.actualYield !== '') ? Number(a.actualYield) : null,
            productBatchNo: a.productBatchNo || buildProductBatchNo(dayBatchCode, a.productName, dayProductionDate),
            productRms: Array.isArray(a.productRms) ? a.productRms : []
          }))
        });
      } else if (stepToSave === 4) {
        if (awaitingNextDayStart) return;
        if (isEditingCompletedDay && currentDayRec?.id) {
          if (liveAllocationsResult.isValid) {
            await handleSaveCompletedDayChanges({ silent: true, includeBaseProcess: false });
          }
          return;
        }
        setSavingStages(true);
        const ebKwh = ebEndReading && ebStartReading ? Math.max(0, Number((Number(ebEndReading) - Number(ebStartReading)).toFixed(2))) : (Number(ebEndReading) || 0);
        await api.put(`/production/standard/${batchId}/stages`, {
          dayNo: activeDayNo,
          dayBatchCode,
          productionDate: dayProductionDate,
          timelineStages,
          productStagesMap,
          labourTotalCost: labourCost,
          ebTotalCost: electricityCost,
          ebStartReading: ebStartReading ? Number(ebStartReading) : null,
          ebEndReading: ebEndReading ? Number(ebEndReading) : null,
          ebUnitsKwh: ebKwh,
          ebRatePerUnit,
          overheadCost
        });
      }
      if (onBatchUpdated) onBatchUpdated();
    } catch (saveErr) {
      console.warn(`Auto-save step ${stepToSave} notice:`, saveErr?.message);
    } finally {
      setSavingProcess(false);
      setSavingAllocations(false);
      setSavingStages(false);
    }
  };

  const handleExitCockpit = async () => {
    if (!isCompleted && !isViewMode) {
      try {
        await autoSaveStep(activeStep);
      } catch (_) {}
    }
    if (onBatchUpdated) onBatchUpdated();
    onClose();
  };

  // Step Gating & Continuous Navigation Handler with Automatic Step Data Persistence
  const handleStepClick = async (targetStep) => {
    if (targetStep === activeStep) return;

    // Gating check for Step 2: Step 1 must have raw materials with valid taken quantities AND mandatory lot allocations
    if (targetStep > activeStep && targetStep >= 2 && activeStep === 1) {
      if (rmRows.length === 0) {
        Swal.fire({
          title: 'Step 1 Incomplete',
          text: 'Please add base raw materials before proceeding to Step 2.',
          icon: 'warning'
        });
        return;
      }

      const unallocated = rmRows.filter(r => {
        const taken = Number(r.takenQty ?? r.requiredQty ?? 0);
        const allocSum = (r.allocatedBatches || []).reduce((s, b) => s + Number(b.allocatedQty || 0), 0);
        return taken <= 0 || allocSum < (taken - 0.0001);
      });

      if (unallocated.length > 0) {
        Swal.fire({
          title: 'Batch / Lot Allocation Mandatory',
          html: `<div class="text-left text-sm space-y-2">
            <p>Warehouse batch/lot allocation is <strong>mandatory</strong> before proceeding.</p>
            <p class="text-rose-600 font-semibold">The following base raw materials are missing or incompletely allocated:</p>
            <ul class="list-disc pl-5 font-mono text-xs text-slate-700 dark:text-slate-300">
              ${unallocated.map(u => `<li><strong>${u.rawMaterialName}</strong> (Required: ${u.takenQty || u.requiredQty} ${formatCleanUom(u.uom, 'kg', u)}, Allocated: ${(u.allocatedBatches || []).reduce((s, b) => s + Number(b.allocatedQty || 0), 0)} ${formatCleanUom(u.uom, 'kg', u)})</li>`).join('')}
            </ul>
            <p class="text-xs text-slate-500">Please click the <strong>Allocate Lots</strong> button for each item to select warehouse lots.</p>
          </div>`,
          icon: 'warning'
        });
        return;
      }
    }

    // Gating check for Step 3: Mix must be merged with positive volume before Step 3
    if (targetStep > activeStep && targetStep >= 3 && activeStep === 2) {
      if (!isSlideMerged || availableMixMl <= 0) {
        Swal.fire({
          title: 'Step 2 Merge Required',
          text: 'Please complete Step 2 by toggling "Slide to Merge" to establish the liquid volume before proceeding to mould allocation.',
          icon: 'warning'
        });
        return;
      }
    }

    // Gating check for Step 4: Product mould allocation configured AND all ingredients/packaging lots allocated
    if (targetStep > activeStep && targetStep >= 4 && activeStep === 3) {
      if (allocations.length === 0) {
        Swal.fire({
          title: 'Step 3 Allocations Incomplete',
          text: 'Please configure at least one finished product before proceeding to Factory Stages.',
          icon: 'warning'
        });
        return;
      }

      const unallocatedPrms = [];
      allocations.forEach((alloc, aIdx) => {
        const prodName = alloc.productName || `Product #${alloc.seq || aIdx + 1}`;
        (alloc.productRms || []).forEach(prm => {
          const qty = Number(prm.takenQty ?? prm.qty ?? 0);
          const allocSum = (prm.allocatedBatches || []).reduce((s, b) => s + Number(b.allocatedQty || 0), 0);
          if (qty > 0 && allocSum < (qty - 0.0001)) {
            unallocatedPrms.push({
              product: prodName,
              material: prm.rawMaterialName || prm.rmName || prm.name,
              req: qty,
              alloc: allocSum,
              uom: prm.uom || 'units'
            });
          }
        });
      });

      if (unallocatedPrms.length > 0) {
        Swal.fire({
          title: 'Batch / Lot Allocation Mandatory',
          html: `<div class="text-left text-sm space-y-2">
            <p>Warehouse batch/lot allocation is <strong>mandatory</strong> for all product ingredients and packaging before proceeding.</p>
            <p class="text-rose-600 font-semibold">The following items are missing batch allocations:</p>
            <ul class="list-disc pl-5 font-mono text-xs text-slate-700 dark:text-slate-300">
              ${unallocatedPrms.map(u => `<li><strong>${u.product}</strong> → ${u.material} (Required: ${u.req} ${u.uom}, Allocated: ${u.alloc} ${u.uom})</li>`).join('')}
            </ul>
            <p class="text-xs text-slate-500">Please click <strong>Allocate Lot</strong> for each ingredient/stick in Step 3.</p>
          </div>`,
          icon: 'warning'
        });
        return;
      }
    }

    // Always auto-save active step data before moving to target step (backward or forward)
    if (!isCompleted && !isViewMode) {
      await autoSaveStep(activeStep);
    }

    setActiveStep(targetStep);
  };

  // Sub-Run Completion & Adding Next Product from Remaining Mix
  const handleRecordSubRunAndAddAnother = () => {
    const mouldPieces = liveAllocationsResult.allocations.reduce((s, a) => s + (a.goodPieces || 0), 0);
    const pieces = Number(actualYieldPieces) > 0 ? Number(actualYieldPieces) : mouldPieces;
    if (pieces <= 0) {
      Swal.fire({ title: 'Invalid Yield', text: 'Please enter actual good output pieces count.', icon: 'warning' });
      return;
    }

    const batchRef = batch?.referenceNo || batch?.batchNo || 'PROD0001';
    const subCode = currentSubRunLetter;
    const currentProduct = allocations[0]?.productName || 'Ice Cream Product';
    const mouldCode = allocations[0]?.mouldCode || 'Standard Mould';
    const mixUsed = liveAllocationsResult.totalMixUsedMl;

    const newSubRecord = {
      subCode,
      subBatchNumber: `${batchRef} - ${subCode}`,
      productName: currentProduct,
      pieces,
      mould: mouldCode,
      mixUsedMl: mixUsed,
      completedAt: new Date().toLocaleTimeString()
    };

    setCompletedSubBatches(prev => [...prev, newSubRecord]);

    Swal.fire({
      title: `Production ${batchRef} ${subCode} Completed!`,
      html: `
        <div style="text-align: left; font-size: 13px; line-height: 1.6;">
          <p><strong>Sub-Run:</strong> <span style="font-family: monospace; font-weight: bold; color: #10b981;">${batchRef} - Sub-Run ${subCode}</span></p>
          <p><strong>Product:</strong> ${currentProduct}</p>
          <p><strong>Yield Recorded:</strong> <span style="font-family: monospace; font-weight: bold;">${pieces} pcs</span></p>
          <p><strong>Mix Consumed:</strong> ${formatIndian(mixUsed)} ml</p>
          <p><strong>Remaining Mix:</strong> <span style="font-family: monospace; font-weight: bold; color: #6366f1;">${formatIndian(liveAllocationsResult.remainingMixMl)} ml</span></p>
        </div>
      `,
      icon: 'success'
    });

    if (liveAllocationsResult.remainingMixMl <= 50) {
      Swal.fire({
        title: 'Insufficient Mix Remaining',
        text: `Remaining mix is ${formatIndian(liveAllocationsResult.remainingMixMl)} ml. Raw material volume has been fully converted into products. Ready to finalize entire production.`,
        icon: 'info'
      });
    } else {
      setAllocations(prev => prev.map(a => ({ ...a, trays: 0 })));
      setActiveStep(3);
    }
  };

  // Save Section A & B via PUT /api/production/standard/:id/process (Day 1 Only)
  const handleSaveProcess = async () => {
    if (Number(activeDayNo) !== 1) {
      Swal.fire({
        title: 'Base Tank Locked on Day 2+',
        text: 'Step 1 (Base Raw Materials) & Step 2 (Evaporation) can only be modified on Day 1. Switch to Day 1 using the header Day 1 chip to edit.',
        icon: 'warning'
      });
      return;
    }
    try {
      setSavingProcess(true);
      await api.put(`/production/standard/${batchId}/process`, {
        dayNo: 1,
        mergeStage,
        evaporationPct,
        evaporationApplied,
        isSlideMerged,
        lines: rmRows
      });

      Swal.fire({
        title: 'Day 1 Base Tank Process Saved!',
        text: 'Raw materials, batch allocations, merge volume and evaporation parameters persisted successfully.',
        icon: 'success',
        timer: 1800
      });

      await fetchAllData(false, activeDayNo);
      if (onBatchUpdated) onBatchUpdated();
    } catch (err) {
      console.error('Failed to save process:', err);
      const msg = err.response?.data?.message || err.response?.data?.error || 'Failed to save floor execution.';
      Swal.fire({ title: 'Save Failed', text: msg, icon: 'error' });
    } finally {
      setSavingProcess(false);
    }
  };

  // ── SECTION C: Product Allocation Handlers ──
  const handleUpdateAllocation = (index, field, value) => {
    setAllocations(prev => {
      const copy = [...prev];
      if (!copy[index]) return prev;
      if (field === 'productBatchNo') {
        copy[index] = { ...copy[index], productBatchNo: value, productBatchNoCustomized: Boolean(String(value || '').trim()) };
        return copy;
      }
      const target = { ...copy[index], [field]: value };

      if (field === 'useMould') {
        const useM = Boolean(value);
        if (!useM) {
          // In Bulk mode, remove packaging materials (sticks & covers)
          target.productRms = (target.productRms || []).filter(p => !isPackagingMaterial(p));
        } else if (target.mouldCode) {
          // If switched back to Mould and a mould was previously selected, ensure stick & cover are present
          const pkg = getPackagingForMould(target.mouldCode, target.mouldName);
          const pcs = computeAllocPiecesYield(target);
          const prms = [...(target.productRms || [])];
          if (pkg?.stick && !prms.some(p => p.rmCode === pkg.stick.code || (p.rmName && p.rmName.toLowerCase().includes('stick')))) {
            prms.push(createPackagingItem(pkg.stick, pcs));
          }
          if (pkg?.cover && !prms.some(p => p.rmCode === pkg.cover.code || (p.rmName && (p.rmName.toLowerCase().includes('cover') || p.rmName.toLowerCase().includes('packing') || p.rmName.toLowerCase().includes('poly'))))) {
            prms.push(createPackagingItem(pkg.cover, pcs));
          }
          target.productRms = prms;
        }
      }
      
      // Calculate live pieces yield strictly bounded by liquid mix volume
      const calculatedPieces = computeAllocPiecesYield(target, field, value);

      // Determine effective pieces for packaging and stock yield:
      // If actualYield was explicitly updated or is present > 0, use it. Otherwise, use calculated pieces.
      let effectivePieces = calculatedPieces;
      if (field === 'actualYield') {
        effectivePieces = (value !== '' && value !== null && !isNaN(Number(value)) && Number(value) >= 0) ? Number(value) : calculatedPieces;
        target.actualYield = value;
      } else if (target.actualYield !== undefined && target.actualYield !== null && target.actualYield !== '' && Number(target.actualYield) > 0) {
        effectivePieces = Number(target.actualYield);
      } else {
        target.actualYield = calculatedPieces;
        effectivePieces = calculatedPieces;
      }

      // Sync existing packaging items quantities with the effective pieces yield (ONLY if mouldCode is selected)
      if (effectivePieces > 0 && target.mouldCode && Array.isArray(target.productRms)) {
        target.goodPieces = effectivePieces;
        target.productRms = syncPackagingQuantities(target.productRms, effectivePieces);
      }
      copy[index] = target;
      return copy;
    });
  };

  const handleFillMaxTrays = (index) => {
    const alloc = allocations[index];
    if (!alloc) return;
    const prevAllocations = allocations.slice(0, index);
    const prevUsed = prevAllocations.reduce((acc, a) => {
      const cap = Number(a.capacityMl || 50);
      const cav = Number(a.cavities || 42);
      const trays = Number(a.trays || 0);
      const wm = a.wasteMode || 'PERCENT';
      const wv = Number(a.wasteValue ?? 0);
      const rawMl = trays * cav * cap;
      const wasteMl = (wm === 'PERCENT' || wm === '%') ? rawMl * (wv / 100) : (wv * trays);
      return acc + (rawMl + wasteMl);
    }, 0);

    const effectiveTotal = availableMixMl > 0 ? availableMixMl : (liveEvaporationResult.mixAfterEvapMl || liveEvaporationResult.totalBeforeEvapMl || 0);
    const remainingForThis = Math.max(0, effectiveTotal - prevUsed);
    
    const cap = Number(alloc.capacityMl || 50);
    const cav = Number(alloc.cavities || 42);
    const wm = alloc.wasteMode || 'PERCENT';
    const wv = Number(alloc.wasteValue ?? 0);

    const explicitBase = Number(alloc.allocatedBaseMl || 0);
    const mixForProduct = explicitBase > 0 ? explicitBase : remainingForThis;

    const maxT = computeMaxTrays({
      availableMixMl: mixForProduct,
      capacityMl: cap,
      cavities: cav,
      wasteMode: wm,
      wasteValue: wv
    });

    const finalTrays = maxT > 0 ? maxT : (mixForProduct >= cap ? 1 : 0);
    handleUpdateAllocation(index, 'trays', finalTrays);
  };

  const handleOpenMouldPicker = (index) => {
    setTargetAllocIndex(index);
    setMouldPickerOpen(true);
  };

  const handleSelectMouldFromPicker = (selectedMould) => {
    if (targetAllocIndex === null) return;
    const cap = Number(selectedMould.mould_capacity_ml || selectedMould.capacity_ml || 50);
    const cav = selectedMould.cavities_per_tray ? Number(selectedMould.cavities_per_tray) : (selectedMould.cavity_count ? Number(selectedMould.cavity_count) : 42);
    
    setAllocations(prev => {
      const copy = [...prev];
      const currentAlloc = copy[targetAllocIndex] || {};
      const prevAllocations = copy.slice(0, targetAllocIndex);
      const prevUsed = prevAllocations.reduce((acc, a) => {
        const c = Number(a.capacityMl || 50);
        const cv = Number(a.cavities || 42);
        const t = Number(a.trays || 0);
        const wm = a.wasteMode || 'PERCENT';
        const wv = Number(a.wasteValue ?? 0);
        const rawMl = t * cv * c;
        const wMl = (wm === 'PERCENT' || wm === '%') ? rawMl * (wv / 100) : (wv * t);
        return acc + (rawMl + wMl);
      }, 0);
      const effectiveTotal = availableMixMl > 0 ? availableMixMl : (liveEvaporationResult.mixAfterEvapMl || liveEvaporationResult.totalBeforeEvapMl || 0);
      const remainingForThis = Math.max(0, effectiveTotal - prevUsed);
      const autoMaxTrays = computeMaxTrays({
        availableMixMl: remainingForThis,
        capacityMl: cap,
        cavities: cav,
        wasteMode: currentAlloc.wasteMode || 'PERCENT',
        wasteValue: Number(currentAlloc.wasteValue ?? 0)
      });

      const finalTrays = autoMaxTrays > 0 ? autoMaxTrays : (Number(currentAlloc.trays) || (remainingForThis >= cap ? 1 : 0));
      
      const allocWithMould = {
        ...currentAlloc,
        capacityMl: cap,
        cavities: cav,
        trays: finalTrays
      };
      const packagingPieces = computeAllocPiecesYield(allocWithMould);

      const pkg = getPackagingForMould(selectedMould.mould_code, selectedMould.mould_name, selectedMould.model_number);
      const stickDef = pkg?.stick;
      const coverDef = pkg?.cover;

      // Preserve all user-added non-packaging materials (flavours, essences, colors)
      const nonPkgPrms = (currentAlloc.productRms || []).filter(p => !isPackagingMaterial(p));
      const updatedPrms = [...nonPkgPrms];

      // Automatically add Wooden Stick and Packing Cover ONLY on mould spec selection (matched to real FEFO warehouse stock)
      if (stickDef) {
        const stickMaster = findMaster({ rmId: stickDef.id, rmCode: stickDef.code, rmName: stickDef.name });
        updatedPrms.push(createPackagingItem(stickDef, packagingPieces, null, stickMaster));
      }
      if (coverDef) {
        const coverMaster = findMaster({ rmId: coverDef.id, rmCode: coverDef.code, rmName: coverDef.name });
        updatedPrms.push(createPackagingItem(coverDef, packagingPieces, null, coverMaster));
      }

      copy[targetAllocIndex] = {
        ...currentAlloc,
        mouldId: selectedMould.id,
        mouldCode: selectedMould.mould_code,
        mouldName: selectedMould.mould_name,
        capacityMl: cap,
        cavities: cav,
        trays: finalTrays,
        goodPieces: packagingPieces,
        productRms: updatedPrms
      };
      return copy;
    });
    setMouldPickerOpen(false);
    setTargetAllocIndex(null);
  };

  // Callback when user selects a single product from ProductionItemSearchModal
  const handleSelectProductForAlloc = (product) => {
    const nextSeq = allocations.length + 1;
    const prodName = product.name || product.productName;
    setAllocations(prev => {
      const next = [
        ...prev,
        {
          seq: nextSeq,
          productId: product.id,
          productName: prodName,
          productCode: product.code || product.systemCode,
          useMould: true,
          bulkUom: 'Liter',
          allocatedBaseMl: 0,
          mouldId: null,
          mouldCode: '',
          mouldName: '',
          capacityMl: 0,
          cavities: 0,
          trays: 0,
          goodPieces: 0,
          wasteMode: 'PERCENT',
          wasteValue: 0,
          productBatchNo: '',
          productBatchNoCustomized: false,
          productSerialNo: serialPreviewMap[product.id]?.serialNo || '',
          productRms: [] // Empty until user selects Mould Spec!
        }
      ];
      setSelectedStep3Index(next.length - 1);
      return next;
    });
  };

  const handleRemoveProductAllocation = (index) => {
    setAllocations(prev => {
      const next = prev.filter((_, idx) => idx !== index);
      setSelectedStep3Index(cur => Math.max(0, Math.min(cur >= index ? cur - 1 : cur, next.length - 1)));
      return next;
    });
  };

  // Save Section C via PUT /api/production/standard/:id/allocations (or completed Day update)
  const handleSaveAllocations = async () => {
    if (isEditingCompletedDay && currentDayRec?.id) {
      await handleSaveCompletedDayChanges();
      return;
    }
    if (awaitingNextDayStart) {
      const nextNo = completedDaysList.length + 1;
      const ask = await Swal.fire({
        title: `Day ${activeDayNo} Already Submitted`,
        text: `Remaining tank mix (${formatIndian(remainingTankMixAfterCompletedMl)} ml) must be allocated under Day ${nextNo}. Start Day ${nextNo} now?`,
        icon: 'info',
        showCancelButton: true,
        confirmButtonText: `Start Day ${nextNo}`,
        confirmButtonColor: '#4f46e5'
      });
      if (ask.isConfirmed) {
        await handleStartNextDay();
      }
      return;
    }

    if (!isSlideMerged || availableMixMl <= 0) {
      Swal.fire({
        title: 'Mix Required',
        text: 'You must merge raw materials before saving product allocations.',
        icon: 'warning'
      });
      return;
    }

    if (!liveAllocationsResult.isValid) {
      const errMsgs = liveAllocationsResult.errors.map(e => e.message).join('\n');
      Swal.fire({
        title: 'Cannot Save Allocations',
        text: errMsgs,
        icon: 'error'
      });
      return;
    }

    try {
      setSavingAllocations(true);
      const validAllocations = allocations.filter(a => a.productId);
      await api.put(`/production/standard/${batchId}/allocations`, {
        dayNo: activeDayNo,
        dayBatchCode,
        productionDate: dayProductionDate,
        assignedUsers: dayAssignedUsers,
        allocations: validAllocations.map(a => ({
          seq: a.seq,
          productId: a.productId,
          productName: a.productName,
          productCode: a.productCode,
          productUom: (a.useMould !== false) ? 'pcs' : (a.bulkUom || a.productUom || 'Liter'),
          useMould: (a.useMould !== false) && (Boolean(a.mouldId) || Number(a.capacityMl || 0) > 0),
          bulkUom: a.bulkUom || a.productUom || 'Liter',
          allocatedBaseMl: Number(a.allocatedBaseMl || a.mixUsedMl || 0),
          mouldId: a.mouldId || null,
          mouldCode: a.mouldCode || '',
          mouldName: a.mouldName || '',
          capacityMl: Number(a.capacityMl || 0) > 0 ? Number(a.capacityMl) : (a.useMould !== false ? 50 : 0),
          cavities: Number(a.cavities || 42),
          trays: Number(a.trays || 0),
          wasteMode: a.wasteMode || 'PERCENT',
          wasteValue: Number(a.wasteValue ?? 0),
          mixUsedMl: Number(a.allocatedBaseMl || a.mixUsedMl || 0),
          wasteMl: Number(liveAllocationsResult.allocations.find(la => la.productId === a.productId)?.wasteMl ?? a.wasteMl ?? 0),
          goodPieces: Number(a.actualYield !== undefined && a.actualYield !== null && a.actualYield !== '' && Number(a.actualYield) >= 0
            ? a.actualYield
            : (liveAllocationsResult.allocations.find(la => la.productId === a.productId)?.goodPieces ?? a.goodPieces ?? 0)),
          actualYield: (a.actualYield !== undefined && a.actualYield !== null && a.actualYield !== '') ? Number(a.actualYield) : null,
          productBatchNo: a.productBatchNo || buildProductBatchNo(dayBatchCode, a.productName, dayProductionDate),
          productRms: Array.isArray(a.productRms) ? a.productRms : []
        }))
      });

      Swal.fire({
        title: 'Allocations Saved!',
        text: 'Finished product allocations and specific raw materials saved atomically.',
        icon: 'success',
        timer: 1800
      });

      // Refresh batch details to pick up newly calculated costing
      fetchAllData();
      if (onBatchUpdated) onBatchUpdated();
    } catch (err) {
      console.error('Failed to save allocations:', err);
      const msg = err.response?.data?.message || err.response?.data?.error || 'Failed to save product allocations.';
      Swal.fire({ title: 'Allocation Save Failed', text: msg, icon: 'error' });
    } finally {
      setSavingAllocations(false);
    }
  };

  // ── LIFECYCLE CONTROLS: PAUSE, RESUME, CANCEL ──
  const handlePause = async () => {
    const { value: reason } = await Swal.fire({
      title: 'Pause Floor Run',
      input: 'textarea',
      inputLabel: 'Reason for pausing (e.g. Tank maintenance, Power cut, Shift handover):',
      inputPlaceholder: 'Enter pause reason...',
      showCancelButton: true,
      confirmButtonText: 'Confirm Pause',
      confirmButtonColor: '#d97706',
      inputValidator: (value) => {
        if (!value || value.trim().length < 3) {
          return 'Please provide a reason for pausing the floor run.';
        }
      }
    });

    if (!reason) return;

    try {
      setActionLoading(true);
      await api.post(`/production/standard/${batchId}/pause`, { reason });
      Swal.fire({ title: 'Floor Run Paused', text: 'Batch status set to Paused.', icon: 'success', timer: 1500 });
      fetchAllData();
      if (onBatchUpdated) onBatchUpdated();
    } catch (err) {
      console.error('Failed to pause floor run:', err);
      Swal.fire({ title: 'Error', text: err.response?.data?.error || 'Failed to pause floor run.', icon: 'error' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleResume = async () => {
    try {
      setActionLoading(true);
      const res = await api.post(`/production/standard/${batchId}/resume`, {
        productionDate: dayProductionDate,
        dayBatchCode
      });
      const startedNext = Boolean(res.data?.startedNextDay);
      const startedDayNo = res.data?.data?.dayNo || (completedDaysList.length + 1);
      Swal.fire({
        title: startedNext ? `Day ${startedDayNo} Started!` : 'Floor Run Resumed',
        text: res.data?.message || 'Batch is now active In Progress.',
        icon: 'success',
        timer: 1800
      });
      await fetchAllData();
      if (startedNext) {
        setActiveStep(3);
      }
      if (onBatchUpdated) onBatchUpdated();
    } catch (err) {
      console.error('Failed to resume floor run:', err);
      Swal.fire({ title: 'Error', text: err.response?.data?.error || 'Failed to resume floor run.', icon: 'error' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelRun = async () => {
    const { value: reason } = await Swal.fire({
      title: 'Cancel Floor Run',
      input: 'textarea',
      inputLabel: 'Cancellation reason (e.g., Mix spoilage, Machine breakdown):',
      inputPlaceholder: 'State why this batch floor run is being cancelled...',
      showCancelButton: true,
      confirmButtonText: 'Yes, Cancel Run',
      confirmButtonColor: '#e11d48',
      inputValidator: (value) => {
        if (!value || value.trim().length < 4) {
          return 'Please specify a valid cancellation reason.';
        }
      }
    });

    if (!reason) return;

    try {
      setActionLoading(true);
      await api.patch(`/production/batches-redesign/${batchId}/status`, {
        status: 'Cancelled',
        cancelledReason: reason
      });
      Swal.fire({ title: 'Floor Run Cancelled', text: 'Batch has been marked as Cancelled.', icon: 'info', timer: 1800 });
      onClose();
      if (onBatchUpdated) onBatchUpdated();
    } catch (err) {
      console.error('Failed to cancel run:', err);
      Swal.fire({ title: 'Error', text: err.response?.data?.error || 'Failed to cancel floor run.', icon: 'error' });
    } finally {
      setActionLoading(false);
    }
  };

  // ── REOPEN BATCH FOR CONTINUOUS EDITING ──
  const handleReopenProduction = async () => {
    const confirm = await Swal.fire({
      title: 'Reopen Batch for Editing?',
      text: 'This will unlock raw materials, evaporation, and mould allocations so you can modify and re-save parameters in the database.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Yes, Reopen for Editing',
      confirmButtonColor: '#4f46e5'
    });
    if (!confirm.isConfirmed) return;

    try {
      setActionLoading(true);
      await api.post(`/production/standard/${batchId}/reopen`);
      Swal.fire({
        title: 'Batch Reopened',
        text: 'Batch is now In Progress and unlocked for continuous editing.',
        icon: 'success',
        timer: 1800
      });
      setViewMode('STEPS');
      setActiveStep(1);
      fetchAllData();
      if (onBatchUpdated) onBatchUpdated();
    } catch (err) {
      console.error('Failed to reopen batch:', err);
      Swal.fire({
        title: 'Error',
        text: err.response?.data?.error || 'Failed to reopen production batch.',
        icon: 'error'
      });
    } finally {
      setActionLoading(false);
    }
  };

  // ── YIELD RECORDING & COMPLETION ──
  const buildDefaultYields = useCallback(() => {
    const rawAllocs = liveAllocationsResult.allocations || [];
    const allocs = rawAllocs.length > 0 ? rawAllocs : (Array.isArray(allocations) ? allocations : []);
    const existingYields = Array.isArray(productYields) ? productYields : [];

    if (allocs.length === 0 && batch?.product) {
      const prodUom = formatCleanUom(batch.product.consumptionUnit || batch.product.unit || 'pcs', 'pcs', batch.product);
      const match = existingYields.find(y => y.productId === (batch.product.id || batch.productId));
      return [
        {
          seq: 1,
          productId: batch.product.id || batch.productId,
          productName: batch.product.name || 'Finished Product',
          productCode: batch.product.code || 'FP',
          uom: prodUom,
          planned: match?.planned ?? (batch.quantity || 2000),
          calculatedYield: Number(match?.calculatedYield ?? actualYieldPieces ?? 2000),
          actualGoodOutput: Number(match?.actualGoodOutput ?? actualYieldPieces ?? 2000),
          rejectOutput: Number(match?.rejectOutput ?? 0)
        }
      ];
    }

    return allocs.map((a, i) => {
      const prod = (Array.isArray(availableProducts) ? availableProducts : []).find(p => p.id === (a.productId || a.product_id)) || {};
      const isM = a.useMould !== false;
      const uom = isM ? 'pcs' : formatCleanUom(a.bulkUom || a.productUom || a.uom || prod.consumptionUnit || prod.unit || 'L', 'L', prod);
      const calcYield = Number(a.goodPieces ?? a.good_pieces ?? a.goodUnits ?? 0);
      const plannedYield = Number(a.plannedQty ?? a.planned_qty ?? calcYield ?? (batch?.quantity ? Math.round(batch.quantity / (allocs.length || 1)) : 2000));
      const match = existingYields.find(y => y.seq === (a.seq || (i + 1))) || existingYields[i] || existingYields.find(y => y.productId === (a.productId || a.product_id));

      // Main actual yield: takes user-entered actualYield from Step 3 if entered
      const effectiveActual = (a.actualYield !== undefined && a.actualYield !== null && a.actualYield !== '' && Number(a.actualYield) >= 0)
        ? Number(a.actualYield)
        : (match?.actualGoodOutput !== undefined ? Number(match.actualGoodOutput) : (calcYield > 0 ? calcYield : (plannedYield > 0 ? plannedYield : Number(batch?.quantity || 2000))));

      return {
        seq: a.seq || (i + 1),
        productId: a.productId || a.product_id,
        productName: a.productName || a.product_name || prod.name || `Finished Product #${i + 1}`,
        productCode: a.productCode || a.product_code || prod.code || 'FP',
        uom,
        planned: match?.planned ?? (plannedYield > 0 ? plannedYield : 2000),
        calculatedYield: match?.calculatedYield ?? (calcYield > 0 ? calcYield : 2000),
        actualGoodOutput: effectiveActual,
        actualOutput: effectiveActual,
        rejectOutput: match?.rejectOutput !== undefined ? Number(match.rejectOutput) : 0
      };
    });
  }, [liveAllocationsResult.allocations, allocations, productYields, batch, actualYieldPieces, availableProducts]);

  const [submitFinalizeFlag, setSubmitFinalizeFlag] = useState(false);

  const handleOpenYieldModal = (finalizeNow = null) => {
    const defaultYields = buildDefaultYields().map(p => ({
      ...p,
      productBatchNo:
        allocations.find(a => a.productId === p.productId)?.productBatchNo ||
        buildProductBatchNo(dayBatchCode, p.productName, dayProductionDate)
    }));
    setProductYields(defaultYields);
    setSubmitFinalizeFlag(finalizeNow !== null ? Boolean(finalizeNow) : !hasRemainingForNextDay);
    setShowYieldModal(true);
  };

  const handleUpdateProductYield = (index, field, value) => {
    setProductYields(prev => {
      const copy = Array.isArray(prev) ? [...prev] : [];
      if (!copy[index]) return copy;
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  // Start next day (Day 2, Day 3...) when carry-forward mix remains in tank
  const handleStartNextDay = async () => {
    const nextDayNum = completedDaysList.length + 1;
    const todayIso = new Date().toISOString().split('T')[0];
    const lastCompletedDay = completedDaysList[completedDaysList.length - 1];
    const lastCompletedIso = lastCompletedDay?.productionDate
      ? String(lastCompletedDay.productionDate).split('T')[0]
      : (dayProductionDate || todayIso);
    const tomorrowIso = addDaysToIso(lastCompletedIso, 1);
    // Always default Day N+1 to +1 calendar day after the previous Day's date
    const defaultDate = tomorrowIso;
    const defaultCode = formatDateToDDMMYY(defaultDate);

    // Ensure active users list is loaded even if Start Next Day is triggered early
    let availableUsers = Array.isArray(productionUsersList) ? productionUsersList : [];
    if (availableUsers.length === 0) {
      try {
        const uRes = await api.get('/users');
        const rawU = Array.isArray(uRes?.data?.data) ? uRes.data.data : (Array.isArray(uRes?.data) ? uRes.data : []);
        availableUsers = rawU
          .filter(u => u && u.isActive !== false)
          .map(u => ({
            id: u.id,
            name: u.name || u.email || 'User',
            empId: u.empId || '',
            role: u.role || 'PRODUCTION_STAFF'
          }))
          .sort((a, b) => (a.role === 'PRODUCTION_STAFF' ? 0 : 1) - (b.role === 'PRODUCTION_STAFF' ? 0 : 1) || a.name.localeCompare(b.name));
        setProductionUsersList(availableUsers);
      } catch (fetchUsersErr) {
        console.warn('Unable to load active users for day allocation:', fetchUsersErr);
      }
    }

    const escHtml = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const preselectedIds = new Set(
      (Array.isArray(lastCompletedDay?.assignedUsers) && lastCompletedDay.assignedUsers.length > 0
        ? lastCompletedDay.assignedUsers
        : dayAssignedUsers
      ).map(u => String(u.id || u.name))
    );
    const hasProdStaff = availableUsers.some(u => u.role === 'PRODUCTION_STAFF');

    const userCheckboxesHtml = availableUsers.length > 0
      ? availableUsers.map((u, idx) => {
          const isProdStaff = u.role === 'PRODUCTION_STAFF';
          const isPreChecked = preselectedIds.has(String(u.id || u.name));
          const hiddenStyle = (!isProdStaff && hasProdStaff && !isPreChecked) ? 'display:none;' : 'display:flex;';
          const roleBadgeBg = isProdStaff ? '#dcfce7' : '#e0e7ff';
          const roleBadgeText = isProdStaff ? '#166534' : '#3730a3';
          return `
            <label data-user-role="${escHtml(u.role)}" data-prechecked="${isPreChecked ? '1' : '0'}" style="${hiddenStyle}align-items:center;justify-content:space-between;gap:6px;padding:5px 8px;border:1px solid #e2e8f0;border-radius:6px;background:#ffffff;cursor:pointer;font-size:11.5px;">
              <span style="display:flex;align-items:center;gap:6px;min-width:0;">
                <input type="checkbox" class="swal-day-user-chk" value="${idx}" ${isPreChecked ? 'checked' : ''} style="accent-color:#4f46e5;width:14px;height:14px;cursor:pointer;" />
                <span style="font-weight:700;color:#0f172a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escHtml(u.name)}</span>
                ${u.empId ? `<span style="font-family:monospace;font-size:10px;color:#64748b;">(${escHtml(u.empId)})</span>` : ''}
              </span>
              <span style="font-family:monospace;font-size:9.5px;font-weight:700;padding:1px 5px;border-radius:4px;background:${roleBadgeBg};color:${roleBadgeText};flex-shrink:0;">${escHtml(u.role)}</span>
            </label>
          `;
        }).join('')
      : `<div style="font-size:11px;color:#64748b;padding:6px;">No active production users found.</div>`;

    const promptRes = await Swal.fire({
      title: `Start Day ${nextDayNum} Production`,
      width: 520,
      html: `
        <div style="text-align:left;font-size:12.5px;line-height:1.5;display:flex;flex-direction:column;gap:10px;">
          <div style="padding:8px 10px;border-radius:8px;background:#eef2ff;border:1px solid #c7d2fe;color:#312e81;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px;">
            <span>Carry-Forward Mix: <strong style="font-family:monospace;">${formatIndian(remainingTankMixAfterCompletedMl, 2)} ml</strong></span>
            <span style="font-size:11px;color:#4338ca;">Prev Day ${completedDaysList.length}: <strong>${escHtml(lastCompletedIso)}</strong></span>
          </div>
          <div>
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;gap:6px;flex-wrap:wrap;">
              <label for="swal-next-day-date" style="font-weight:700;font-size:11px;text-transform:uppercase;color:#475569;">Day ${nextDayNum} Date (+1 Day Auto • Editable)</label>
              <div style="display:flex;gap:4px;">
                <button type="button" id="swal-btn-next-cal-day" style="font-size:10.5px;font-weight:700;color:#4f46e5;background:#e0e7ff;border:1px solid #a5b4fc;border-radius:4px;padding:1px 6px;cursor:pointer;">
                  +1 Day (${tomorrowIso})
                </button>
                <button type="button" id="swal-btn-today-date" style="font-size:10.5px;font-weight:700;color:#475569;background:#f1f5f9;border:1px solid #cbd5e1;border-radius:4px;padding:1px 6px;cursor:pointer;">
                  Today (${todayIso})
                </button>
              </div>
            </div>
            <input id="swal-next-day-date" type="date" value="${defaultDate}" class="swal2-input" style="margin:0;width:100%;height:36px;font-size:13px;font-family:monospace;" />
          </div>
          <div>
            <label for="swal-next-day-code" style="display:block;font-weight:700;font-size:11px;text-transform:uppercase;color:#475569;margin-bottom:4px;">Day ${nextDayNum} Batch Code (DDMMYY or Custom)</label>
            <input id="swal-next-day-code" type="text" value="${defaultCode}" class="swal2-input" style="margin:0;width:100%;height:36px;font-size:13px;font-family:monospace;text-transform:uppercase;font-weight:700;" />
          </div>
          <div style="border:1px solid #cbd5e1;border-radius:8px;padding:8px 10px;background:#f8fafc;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;gap:6px;flex-wrap:wrap;">
              <span style="font-weight:700;font-size:11px;text-transform:uppercase;color:#334155;">Allocate Production Staff (Day ${nextDayNum})</span>
              ${hasProdStaff ? `
                <label style="display:inline-flex;align-items:center;gap:4px;font-size:10.5px;font-weight:600;color:#4f46e5;cursor:pointer;">
                  <input type="checkbox" id="swal-show-all-roles" style="accent-color:#4f46e5;cursor:pointer;" />
                  Show All Roles
                </label>
              ` : ''}
            </div>
            <div id="swal-day-users-list" style="max-height:135px;overflow-y:auto;display:flex;flex-direction:column;gap:4px;">
              ${userCheckboxesHtml}
            </div>
          </div>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: `Start Day ${nextDayNum}`,
      confirmButtonColor: '#4f46e5',
      didOpen: () => {
        const dateEl = document.getElementById('swal-next-day-date');
        const codeEl = document.getElementById('swal-next-day-code');
        const nextBtn = document.getElementById('swal-btn-next-cal-day');
        const todayBtn = document.getElementById('swal-btn-today-date');
        const showAllChk = document.getElementById('swal-show-all-roles');
        const usersContainer = document.getElementById('swal-day-users-list');
        let codeEditedManually = false;
        const ddmmyyFromIso = (iso) => {
          const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
          return m ? `${m[3]}${m[2]}${m[1].slice(-2)}` : defaultCode;
        };
        if (codeEl) {
          codeEl.addEventListener('input', () => {
            codeEl.value = codeEl.value.toUpperCase().replace(/[^A-Z0-9_-]/g, '');
            codeEditedManually = true;
          });
        }
        if (dateEl) {
          dateEl.addEventListener('change', () => {
            if (!codeEditedManually && codeEl && dateEl.value) {
              codeEl.value = ddmmyyFromIso(dateEl.value);
            }
          });
        }
        if (nextBtn && dateEl) {
          nextBtn.addEventListener('click', () => {
            dateEl.value = tomorrowIso;
            if (!codeEditedManually && codeEl) {
              codeEl.value = ddmmyyFromIso(tomorrowIso);
            }
          });
        }
        if (todayBtn && dateEl) {
          todayBtn.addEventListener('click', () => {
            dateEl.value = todayIso;
            if (!codeEditedManually && codeEl) {
              codeEl.value = ddmmyyFromIso(todayIso);
            }
          });
        }
        if (showAllChk && usersContainer) {
          showAllChk.addEventListener('change', () => {
            const showAll = showAllChk.checked;
            usersContainer.querySelectorAll('label[data-user-role]').forEach(lbl => {
              const role = lbl.getAttribute('data-user-role');
              const pre = lbl.getAttribute('data-prechecked') === '1';
              lbl.style.display = (showAll || role === 'PRODUCTION_STAFF' || pre) ? 'flex' : 'none';
            });
          });
        }
      },
      preConfirm: () => {
        const dateVal = document.getElementById('swal-next-day-date')?.value || tomorrowIso;
        const rawCode = document.getElementById('swal-next-day-code')?.value || '';
        const cleanCode = rawCode.toUpperCase().replace(/[^A-Z0-9_-]/g, '');
        const checkedBoxes = Array.from(document.querySelectorAll('.swal-day-user-chk:checked'));
        const chosenUsers = checkedBoxes
          .map(cb => availableUsers[Number(cb.value)])
          .filter(Boolean);
        return {
          productionDate: dateVal,
          dayBatchCode: cleanCode || formatDateToDDMMYY(dateVal),
          assignedUsers: chosenUsers
        };
      }
    });

    if (!promptRes.isConfirmed || !promptRes.value) return;

    try {
      setNextDayLoading(true);
      const { productionDate: chosenDate, dayBatchCode: chosenCode, assignedUsers: chosenUsers = [] } = promptRes.value;
      const res = await api.post(`/production/standard/${batchId}/days/start-next`, {
        productionDate: chosenDate,
        dayBatchCode: chosenCode,
        assignedUsers: chosenUsers
      });
      const started = res.data?.data || {};
      // Immediately clear previous day's working states so Day N workspace starts cleanly with carry-forward mix & chosen staff
      setAllocations([]);
      setSelectedStep3Index(0);
      setProductStagesMap({});
      setTimelineStages(DEFAULT_FACTORY_STAGES);
      setSelectedProductStageTab('ALL');
      setProductYields([]);
      setProductLabourMap({});
      setLabourCost(0);
      setElectricityCost(0);
      setEbStartReading('');
      setEbEndReading('');
      setOverheadCost(0);
      setActualYieldPieces(0);
      setCompletionNotes('');
      setDayAssignedUsers(Array.isArray(started.assignedUsers) ? started.assignedUsers : chosenUsers);
      const teamSummary = chosenUsers.length > 0 ? chosenUsers.map(u => escHtml(u.name)).join(', ') : 'None assigned yet';
      Swal.fire({
        title: `Day ${started.dayNo || nextDayNum} Started!`,
        html: `
          <div style="text-align:left;font-size:13px;line-height:1.6;">
            <p><strong>Carry-Forward Mix Ready:</strong> <span style="font-family:monospace;font-weight:bold;color:#4f46e5;">${formatIndian(started.openingMixMl || remainingTankMixAfterCompletedMl)} ml</span></p>
            <p><strong>Day Date:</strong> <span style="font-family:monospace;font-weight:bold;">${formatDateDMY(chosenDate)}</span></p>
            <p><strong>Day Batch No (DDMMYY):</strong> <span style="font-family:monospace;font-weight:bold;">${started.dayBatchCode || chosenCode}</span></p>
            <p><strong>Allocated Staff:</strong> <span style="font-weight:bold;color:#059669;">${teamSummary}</span></p>
            <p>Allocate base mix, flavours, moulds, and Day ${started.dayNo || nextDayNum}&apos;s operational costs (EB &amp; Labour).</p>
          </div>
        `,
        icon: 'success',
        timer: 2400
      });
      selectedDayNoRef.current = null;
      setSelectedDayNo(null);
      await fetchAllData(false, null);
      setActiveStep(3);
      if (onBatchUpdated) onBatchUpdated();
    } catch (err) {
      console.error('Failed to start next day:', err);
      Swal.fire({
        title: 'Cannot Start Next Day',
        text: err.response?.data?.error || 'Failed to open next production day.',
        icon: 'error'
      });
    } finally {
      setNextDayLoading(false);
    }
  };

  // Switch the main 5-Step Cockpit directly into any Day (Day 1 edits Steps 1-5; Day 2+ edits Steps 3-5)
  const handleSwitchDay = async (targetDayNo, preferredStep = null) => {
    const num = Number(targetDayNo);
    if (!Number.isFinite(num) || num < 1) return;
    selectedDayNoRef.current = num;
    setSelectedDayNo(num);
    setSelectedStep3Index(0);
    setInspectingDay(null);
    setViewMode('STEPS');
    await fetchAllData(false, num);
    if (preferredStep) {
      setActiveStep(preferredStep);
    } else if (num === 1 && activeStep > 2) {
      setActiveStep(1);
    } else if (num > 1 && activeStep < 3) {
      setActiveStep(3);
    }
  };

  const handleReturnToActiveDay = async () => {
    selectedDayNoRef.current = null;
    setSelectedDayNo(null);
    await fetchAllData(false, null);
    setActiveStep(liveActiveDayNo > 1 ? 3 : activeStep);
  };

  // Save full edits for an already-completed Day (Day 1: optional Step 1 & 2 + Steps 3-5; Day 2+: Steps 3-5 only)
  const handleSaveCompletedDayChanges = async ({ silent = false, includeBaseProcess = true } = {}) => {
    if (!currentDayRec?.id || isViewMode) return;
    if (!liveAllocationsResult.isValid) {
      if (!silent) {
        Swal.fire({
          title: 'Cannot Save Day Changes',
          text: liveAllocationsResult.errors.map(e => e.message).join('\n'),
          icon: 'error'
        });
      }
      return;
    }

    try {
      setSavingCompletedDay(true);

      // On Day 1 only, persist Step 1 Base Raw Materials & Step 2 Evaporation with net stock delta
      if (includeBaseProcess && Number(activeDayNo) === 1) {
        await api.put(`/production/standard/${batchId}/process`, {
          dayNo: 1,
          mergeStage,
          evaporationPct,
          evaporationApplied,
          isSlideMerged,
          lines: rmRows
        });
      }

      const validAllocations = allocations.filter(a => a.productId);
      const allocPayload = validAllocations.map((a, idx) => {
        const computedRow = liveAllocationsResult.allocations[idx] || liveAllocationsResult.allocations.find(la => la.productId === a.productId) || {};
        const fallbackGood = Number(computedRow.goodPieces ?? a.goodPieces ?? 0);
        const effGood = (a.actualYield !== undefined && a.actualYield !== null && a.actualYield !== '')
          ? Number(a.actualYield)
          : fallbackGood;
        return {
          seq: a.seq || idx + 1,
          productId: a.productId,
          productName: a.productName,
          productCode: a.productCode,
          productUom: (a.useMould !== false) ? 'pcs' : (a.bulkUom || a.productUom || 'Liter'),
          useMould: (a.useMould !== false) && (Boolean(a.mouldId) || Number(a.capacityMl || 0) > 0),
          bulkUom: a.bulkUom || a.productUom || 'Liter',
          allocatedBaseMl: Number(a.allocatedBaseMl || a.mixUsedMl || 0),
          mouldId: a.mouldId || null,
          mouldCode: a.mouldCode || '',
          mouldName: a.mouldName || '',
          capacityMl: Number(a.capacityMl || 0) > 0 ? Number(a.capacityMl) : (a.useMould !== false ? 50 : 0),
          cavities: Number(a.cavities || 42),
          trays: Number(a.trays || 0),
          wasteMode: a.wasteMode || 'PERCENT',
          wasteValue: Number(a.wasteValue ?? 0),
          mixUsedMl: Number(a.allocatedBaseMl || a.mixUsedMl || 0),
          wasteMl: Number(computedRow.wasteMl ?? a.wasteMl ?? 0),
          goodPieces: fallbackGood,
          actualYield: effGood,
          rejectOutput: Number(a.rejectOutput || 0),
          productBatchNo: a.productBatchNo || buildProductBatchNo(dayBatchCode, a.productName, dayProductionDate),
          productRms: Array.isArray(a.productRms) ? a.productRms : []
        };
      });

      const productYieldsPayload = allocPayload.map((a, idx) => ({
        seq: a.seq || idx + 1,
        productId: a.productId,
        productName: a.productName,
        actualGoodOutput: Number(a.actualYield || 0),
        actualOutput: Number(a.actualYield || 0),
        rejectOutput: Number(a.rejectOutput || 0),
        productBatchNo: a.productBatchNo
      }));

      const ebKwh = ebEndReading && ebStartReading
        ? Math.max(0, Number((Number(ebEndReading) - Number(ebStartReading)).toFixed(2)))
        : (Number(ebEndReading) || 0);

      await api.put(`/production/standard/${batchId}/days/${currentDayRec.id}/update`, {
        productionDate: dayProductionDate || undefined,
        dayBatchCode: dayBatchCode || undefined,
        assignedUsers: dayAssignedUsers,
        allocations: allocPayload,
        timelineStages,
        productStagesMap,
        ebStartReading: ebStartReading !== '' ? Number(ebStartReading) : undefined,
        ebEndReading: ebEndReading !== '' ? Number(ebEndReading) : undefined,
        ebUnitsKwh: ebKwh,
        ebRatePerUnit: Number(ebRatePerUnit || 8.5),
        ebTotalCost: Number(electricityCost || 0),
        labourTotalCost: Number(labourCost || 0),
        overheadAmt: Number(overheadCost || 0),
        productYields: productYieldsPayload,
        notes: completionNotes
      });

      if (!silent) {
        Swal.fire({
          title: `Day ${activeDayNo} Changes Saved!`,
          text: Number(activeDayNo) === 1
            ? 'Day 1 base raw materials, evaporation, products, moulds, timeline, costs, and yields updated with stock & mix cascade.'
            : `Day ${activeDayNo} products, moulds, timeline, operational costs, and actual yields updated without affecting Day 1.`,
          icon: 'success',
          timer: 1800
        });
      }

      await fetchAllData(false, activeDayNo);
      if (onBatchUpdated) onBatchUpdated();
    } catch (err) {
      console.error('Failed to update completed day:', err);
      if (!silent) {
        Swal.fire({
          title: 'Update Failed',
          text: err.response?.data?.error || err.response?.data?.message || `Failed to save Day ${activeDayNo} updates.`,
          icon: 'error'
        });
      }
    } finally {
      setSavingCompletedDay(false);
    }
  };

  // Multi-Day Complete Day / Push to Sales / Finish Entire Production handler
  const handleCompleteDaySubmit = async (customYieldsList = null, { finalize = submitFinalizeFlag } = {}) => {
    if (awaitingNextDayStart) {
      setShowYieldModal(false);
      await handleStartNextDay();
      return;
    }

    let yieldsList = Array.isArray(customYieldsList) && customYieldsList.length > 0
      ? customYieldsList
      : (Array.isArray(productYields) && productYields.length > 0 ? productYields : buildDefaultYields());

    let totalActual = yieldsList.length > 0
      ? yieldsList.reduce((s, p) => s + Number(p.actualGoodOutput || 0), 0)
      : Number(actualYieldPieces || 0);

    if (totalActual <= 0) {
      totalActual = Number(actualYieldPieces || batch?.quantity || 0);
    }

    try {
      setCompleting(true);
      const ebKwh = ebEndReading && ebStartReading ? Math.max(0, Number((Number(ebEndReading) - Number(ebStartReading)).toFixed(2))) : (Number(ebEndReading) || 0);
      const validAllocs = allocations.filter(a => a.productId);
      const res = await api.post(`/production/standard/${batchId}/complete-day`, {
        dayNo: activeDayNo,
        dayBatchCode: dayBatchCode || formatDateToDDMMYY(dayProductionDate),
        productionDate: dayProductionDate,
        assignedUsers: dayAssignedUsers,
        timelineStages,
        productStagesMap,
        ebStartReading: ebStartReading !== '' ? Number(ebStartReading) : null,
        ebEndReading: ebEndReading !== '' ? Number(ebEndReading) : null,
        ebUnitsKwh: ebKwh,
        ebRatePerUnit: Number(ebRatePerUnit || 8.5),
        ebTotalCost: Number(electricityCost || 0),
        labourTotalCost: Number(labourCost || 0),
        overheadAmt: Number(overheadCost || 0),
        allocations: validAllocs.map(a => ({
          seq: a.seq,
          productId: a.productId,
          productName: a.productName,
          productCode: a.productCode,
          productUom: (a.useMould !== false) ? 'pcs' : (a.bulkUom || a.productUom || 'Liter'),
          useMould: (a.useMould !== false) && (Boolean(a.mouldId) || Number(a.capacityMl || 0) > 0),
          bulkUom: a.bulkUom || a.productUom || 'Liter',
          allocatedBaseMl: Number(a.allocatedBaseMl || a.mixUsedMl || 0),
          mouldId: a.mouldId || null,
          mouldCode: a.mouldCode || '',
          mouldName: a.mouldName || '',
          capacityMl: Number(a.capacityMl || 0) > 0 ? Number(a.capacityMl) : (a.useMould !== false ? 50 : 0),
          cavities: Number(a.cavities || 42),
          trays: Number(a.trays || 0),
          wasteMode: a.wasteMode || 'PERCENT',
          wasteValue: Number(a.wasteValue ?? 0),
          productBatchNo: a.productBatchNo || buildProductBatchNo(dayBatchCode, a.productName, dayProductionDate),
          productRms: Array.isArray(a.productRms) ? a.productRms : []
        })),
        productYields: yieldsList.map(p => ({
          seq: p.seq,
          productId: p.productId,
          productName: p.productName,
          productCode: p.productCode,
          uom: p.uom,
          planned: Number(p.planned || 0),
          calculatedYield: Number(p.calculatedYield || 0),
          actualGoodOutput: Number(p.actualGoodOutput || 0),
          rejectOutput: Number(p.rejectOutput || 0),
          labourCost: Number(productLabourMap[p.productId] || 0),
          productBatchNo:
            p.productBatchNo ||
            allocations.find(a => a.productId === p.productId)?.productBatchNo ||
            buildProductBatchNo(dayBatchCode, p.productName, dayProductionDate)
        })),
        labTestRequired,
        finalizeProduction: Boolean(finalize),
        scrapRemainingMixAsWaste: Boolean(finalize && hasRemainingForNextDay),
        notes: completionNotes
      });

      const d = res.data?.data || {};
      const outRows = Array.isArray(d.outputs) ? d.outputs : [];
      const remMl = Number(d.remainingMixMl || 0);
      const isFin = Boolean(d.finalized);

      const outputsHtml = outRows.map(o => `
        <li style="margin-bottom:4px;">
          <strong>${o.productName}</strong>: <span style="font-family:monospace;font-weight:bold;color:#059669;">${o.actualYield} ${o.uom}</span><br/>
          <span style="font-size:11px;font-family:monospace;color:#4f46e5;">Batch: ${o.productBatchNo}</span> •
          <span style="font-size:11px;font-family:monospace;color:#0f766e;">Serial: ${o.productSerialNo}</span>
        </li>
      `).join('');

      setShowYieldModal(false);

      if (!isFin && remMl > 1) {
        const nextPrompt = await Swal.fire({
          title: `Day ${d.dayNo || activeDayNo} Completed!`,
          html: `
            <div style="text-align:left;font-size:12.5px;line-height:1.55;">
              <p><strong>Day Batch No:</strong> <span style="font-family:monospace;font-weight:bold;color:#4f46e5;">${d.dayBatchCode || dayBatchCode}</span></p>
              <p><strong>Inventory Status:</strong> <span style="font-weight:bold;color:${d.pushedToSales ? '#059669' : '#d97706'};">${d.pushedToSales ? 'Pushed to Sellable Sales Stock ✓' : 'Held in QC Quarantine Queue'}</span></p>
              <p><strong>Carry-Forward Mix Remaining:</strong> <span style="font-family:monospace;font-weight:bold;color:#7c3aed;">${formatIndian(remMl, 2)} ml</span></p>
              ${outputsHtml ? `<ul style="margin-top:8px;padding-left:16px;list-style:disc;">${outputsHtml}</ul>` : ''}
            </div>
          `,
          icon: 'success',
          showCancelButton: true,
          confirmButtonText: `Start Day ${(d.dayNo || activeDayNo) + 1} Now`,
          cancelButtonText: 'Pause & Stay in Cockpit',
          confirmButtonColor: '#4f46e5'
        });

        await fetchAllData();
        if (onBatchUpdated) onBatchUpdated();

        if (nextPrompt.isConfirmed) {
          await handleStartNextDay();
        }
        return;
      }

      await Swal.fire({
        title: 'Entire Production Finished!',
        html: `
          <div style="text-align:left;font-size:12.5px;line-height:1.55;">
            <p><strong>Day ${d.dayNo || activeDayNo} Batch No:</strong> <span style="font-family:monospace;font-weight:bold;color:#4f46e5;">${d.dayBatchCode || dayBatchCode}</span></p>
            <p><strong>Total Day Output:</strong> <span style="font-family:monospace;font-weight:bold;color:#059669;">${totalActual} units</span></p>
            <p><strong>Inventory Status:</strong> <span style="font-weight:bold;color:${d.pushedToSales ? '#059669' : '#d97706'};">${d.pushedToSales ? 'Directly Added to Sellable Sales Stock ✓' : 'Sent to QC Quarantine'}</span></p>
            ${outputsHtml ? `<ul style="margin-top:8px;padding-left:16px;list-style:disc;">${outputsHtml}</ul>` : ''}
          </div>
        `,
        icon: 'success',
        confirmButtonText: 'OK'
      });

      await fetchAllData();
      if (onBatchUpdated) onBatchUpdated();
      if (onClose) onClose();
    } catch (err) {
      console.error('Failed to complete production day:', err);
      Swal.fire({
        title: 'Error',
        text: err.response?.data?.error || 'Failed to complete day production run.',
        icon: 'error'
      });
    } finally {
      setCompleting(false);
    }
  };

  const handleCompleteBatchSubmit = async (customYieldsList = null) => {
    await handleCompleteDaySubmit(customYieldsList, { finalize: submitFinalizeFlag });
  };

  const handleFinalizeEntireProductionClick = async () => {
    const finalizeNow = !hasRemainingForNextDay;
    const defaultYields = buildDefaultYields().map(p => ({
      ...p,
      productBatchNo:
        allocations.find(a => a.productId === p.productId)?.productBatchNo ||
        buildProductBatchNo(dayBatchCode, p.productName, dayProductionDate)
    }));
    setProductYields(defaultYields);
    setSubmitFinalizeFlag(finalizeNow);
    await handleCompleteDaySubmit(defaultYields, { finalize: finalizeNow });
  };

  // ── SAP FIORI HORIZON MESSAGE POPOVER VALIDATION ISSUES ──
  const [showMessagesPopover, setShowMessagesPopover] = useState(false);
  const messagesPopoverRef = useRef(null);

  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (messagesPopoverRef.current && !messagesPopoverRef.current.contains(e.target)) {
        setShowMessagesPopover(false);
      }
    };
    if (showMessagesPopover) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [showMessagesPopover]);

  const validationMessages = useMemo(() => {
    const list = [];
    
    // Step 1 RM Checks
    rmRows.forEach((r, idx) => {
      const displayAvailable = Array.isArray(r.allocatedBatches) && r.allocatedBatches.length > 0
        ? r.allocatedBatches.reduce((acc, b) => acc + Number(b.allocatedQty || 0), 0)
        : Number(r.availableQty || 0);
      const displayTaken = Number(r.takenQty || 0);
      if (displayTaken > displayAvailable && displayAvailable > 0) {
        list.push({
          id: `rm-exceed-${idx}`,
          type: 'error',
          step: 1,
          stepName: 'Step 1: Base Raw Materials',
          title: `Taken exceeds batch available for ${r.rawMaterialName || 'Material'}`,
          desc: `Taken: ${displayTaken} > Available: ${displayAvailable} ${formatCleanUom(r.uom, 'kg', r)}`
        });
      }
      if (displayTaken <= 0) {
        list.push({
          id: `rm-zero-${idx}`,
          type: 'warning',
          step: 1,
          stepName: 'Step 1: Base Raw Materials',
          title: `Zero quantity taken for ${r.rawMaterialName || 'Material'}`,
          desc: 'Specify taken quantity to consume inventory stock'
        });
      }
      if (!Array.isArray(r.allocatedBatches) || r.allocatedBatches.length === 0) {
        list.push({
          id: `rm-no-lot-${idx}`,
          type: 'warning',
          step: 1,
          stepName: 'Step 1: Base Raw Materials',
          title: `No warehouse batch lot assigned for ${r.rawMaterialName || 'Material'}`,
          desc: 'Click "+ Allocate Lots" to trace warehouse stock'
        });
      }
    });

    // Step 2 Merge Checks
    if (!isSlideMerged) {
      list.push({
        id: 'merge-not-merged',
        type: 'warning',
        step: 2,
        stepName: 'Step 2: Merge & Evap',
        title: 'Raw materials not yet merged',
        desc: 'Slide to merge liquid raw materials into unified mix'
      });
    }
    if (liveEvaporationResult.mixAfterEvapMl <= 0) {
      list.push({
        id: 'merge-zero-mix',
        type: 'error',
        step: 2,
        stepName: 'Step 2: Merge & Evap',
        title: 'Net post-evaporation mix volume is 0 ml',
        desc: 'Review raw materials formulation taken quantities'
      });
    }

    // Step 3 Allocations Checks
    if (allocations.length === 0) {
      list.push({
        id: 'alloc-empty',
        type: 'error',
        step: 3,
        stepName: 'Step 3: Products & Moulds',
        title: 'No finished products added',
        desc: 'Add at least one finished product to allocate mix'
      });
    }
    if (liveAllocationsResult.remainingMixMl < 0) {
      list.push({
        id: 'alloc-deficit',
        type: 'error',
        step: 3,
        stepName: 'Step 3: Products & Moulds',
        title: `Mix deficit: ${formatIndian(Math.abs(liveAllocationsResult.remainingMixMl))} ml over-allocated`,
        desc: 'Reduce product base mix allocations to match available volume'
      });
    } else if (liveAllocationsResult.remainingMixMl > 50) {
      list.push({
        id: 'alloc-remaining',
        type: 'warning',
        step: 3,
        stepName: 'Step 3: Products & Moulds',
        title: `${formatIndian(liveAllocationsResult.remainingMixMl)} ml mix unallocated`,
        desc: 'Unallocated mix will be accounted as floor wastage in Step 5'
      });
    }

    // Step 4 Timeline Checks
    if (timelineStages.length === 0) {
      list.push({
        id: 'timeline-empty',
        type: 'warning',
        step: 4,
        stepName: 'Step 4: Factory Timeline',
        title: 'No factory timeline stages defined',
        desc: 'Configure process stages for batch audit history'
      });
    }

    // Step 5 Completion Status
    if (!isCompleted) {
      list.push({
        id: 'status-incomplete',
        type: 'info',
        step: 5,
        stepName: 'Step 5: Quality & Yield',
        title: 'Production order active on shop floor',
        desc: 'Record actual yield pieces to complete batch'
      });
    }

    return list;
  }, [rmRows, isSlideMerged, liveEvaporationResult.mixAfterEvapMl, allocations.length, liveAllocationsResult.remainingMixMl, timelineStages.length, isCompleted]);

  const errorCount = useMemo(() => validationMessages.filter(m => m.type === 'error').length, [validationMessages]);
  const warningCount = useMemo(() => validationMessages.filter(m => m.type === 'warning').length, [validationMessages]);
  const stepHasError = useCallback((stepId) => validationMessages.some(m => m.step === stepId && m.type === 'error'), [validationMessages]);

  if (!isOpen) return null;

  // Derived readiness flags for stepper indicators
  const step1Ready = rmRows.length > 0 && rmRows.every(r => r.takenQty > 0);
  const step2Ready = isSlideMerged && liveEvaporationResult.mixAfterEvapMl > 0;
  const step3Ready = allocations.length > 0 && liveAllocationsResult.isValid;
  const step4Ready = isCompleted;

  return (
    <div className={`fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-0 sm:p-2 overflow-hidden font-['Plus_Jakarta_Sans',sans-serif]`}>
      <div className={`relative w-full ${isFullscreen ? 'h-full max-h-screen rounded-none' : 'h-full sm:h-[97vh] max-h-screen sm:max-h-[97vh] max-w-[99vw] 2xl:max-w-[1720px] rounded-none sm:rounded-2xl'} bg-slate-50 dark:bg-slate-950 shadow-2xl flex flex-col overflow-hidden border border-slate-300 dark:border-slate-800 transition-all duration-200`}>
        
        {/* ── 1. SHELL BAR (44px, SAP Dark Navy #1d2d3e) ── */}
        <div className="h-11 px-3 sm:px-4 bg-[#1d2d3e] text-white flex items-center justify-between select-none shrink-0 border-b border-slate-700/80 z-30">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-md bg-[#0070f2] text-white flex items-center justify-center font-bold shadow-xs shrink-0">
              <Factory className="w-4 h-4" />
            </div>
            <span className="font-bold text-xs tracking-wide text-white truncate">
              Floor Run Cockpit
            </span>
            <span className="font-mono text-[9px] font-extrabold uppercase tracking-wider px-1.5 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-700/80 shrink-0">
              PP-SFC
            </span>
            <span className="text-[10px] font-mono font-bold text-slate-300 bg-slate-800/90 px-2 py-0.5 rounded border border-slate-700 shrink-0 hidden sm:inline">
              {batch?.referenceNo || batch?.batchNo || `#${batchId?.slice(0, 8)}`}
            </span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* View Mode Toggle Switcher */}
            <div className="flex items-center bg-slate-800/90 p-0.5 rounded-lg border border-slate-700 text-xs">
              <button
                type="button"
                onClick={() => setViewMode('STEPS')}
                className={`px-2 py-1 rounded-md text-[11px] font-bold transition-all flex items-center gap-1 cursor-pointer ${
                  viewMode === 'STEPS' ? 'bg-[#0070f2] text-white shadow-xs' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Layers className="w-3 h-3" />
                <span className="hidden sm:inline">Floor Execution</span>
                <span className="sm:hidden">Steps</span>
              </button>
              {(isCompleted || completedDaysList.length > 0) && (
                <button
                  type="button"
                  onClick={() => setViewMode('REPORT')}
                  className={`px-2 py-1 rounded-md text-[11px] font-bold transition-all flex items-center gap-1 cursor-pointer ${
                    viewMode === 'REPORT' ? 'bg-[#30914c] text-white shadow-xs' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <FileSpreadsheet className="w-3 h-3" />
                  <span className="hidden sm:inline">Clean Ledger</span>
                  <span className="sm:hidden">Report</span>
                </button>
              )}
            </div>

            {/* Theme Toggle Button (Light / Dark) */}
            <Button
              variant="outline"
              size="sm"
              onClick={toggleThemeMode}
              className="h-7 w-7 p-0 border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800"
              title={isDark ? "Switch to Light Theme" : "Switch to Dark Theme"}
            >
              {isDark ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5 text-slate-400" />}
            </Button>

            {/* Fullscreen Toggle */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsFullscreen(prev => !prev)}
              className="h-7 w-7 p-0 border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800"
              title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen Cockpit'}
            >
              {isFullscreen ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
            </Button>

            {/* Close Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleExitCockpit}
              className="h-7 w-7 p-0 border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800"
              title="Close Cockpit"
            >
              <X className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        {/* ── 2. OBJECT PAGE HEADER (S/4HANA FIORI HORIZON OBJECT HEADER - ULTRA COMPACT) ── */}
        <div className="px-3 py-1 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2 shrink-0 transition-colors flex-wrap">
          <div className="flex items-center gap-1.5 flex-wrap min-w-0">
            <h1 className="text-xs sm:text-[13px] font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-1 shrink-0">
              <span>Production Order</span>
              <span className="font-mono text-[#0070f2] dark:text-blue-400 font-bold">
                {batch?.referenceNo || batch?.batchNo || `#${batchId?.slice(0, 8)}`}
              </span>
            </h1>

            {/* Multi-Day Active Day Pill */}
            <span className="text-[9.5px] font-mono font-black px-1.5 py-0.2 rounded border bg-indigo-50 text-indigo-700 border-indigo-300 dark:bg-indigo-950 dark:text-indigo-300 dark:border-indigo-700 shrink-0">
              DAY {activeDayNo}
            </span>

            {/* Editable Day Date (Manual override for testing/backdating without waiting 1 calendar day) */}
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/80 px-1.5 py-0.2 rounded border border-slate-200 dark:border-slate-700 shrink-0">
              <span className="text-[8.5px] font-bold uppercase text-slate-500 dark:text-slate-400">Day Date:</span>
              {isViewMode || isCompleted || awaitingNextDayStart ? (
                <span className="font-mono text-[10px] font-bold text-slate-700 dark:text-slate-200">
                  {formatDateDMY(dayProductionDate)}
                </span>
              ) : (
                <input
                  type="date"
                  value={dayProductionDate || ''}
                  onChange={(e) => handleDayDateChange(e.target.value)}
                  title="Editable Day Production Date (change manually anytime before completing the day)"
                  className="bg-white dark:bg-slate-900 border border-indigo-300 dark:border-indigo-700 rounded px-1 py-0 text-[10px] font-mono font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              )}
            </div>

            {/* Editable Day Batch No (DDMMYY - additive beside reference_no) */}
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/80 px-1.5 py-0.2 rounded border border-slate-200 dark:border-slate-700 shrink-0">
              <span className="text-[8.5px] font-bold uppercase text-slate-500 dark:text-slate-400">Day Batch:</span>
              {isViewMode || isCompleted || awaitingNextDayStart ? (
                <span className="font-mono text-[10px] font-black text-indigo-700 dark:text-indigo-300">
                  {dayBatchCode}
                </span>
              ) : (
                <input
                  type="text"
                  value={dayBatchCode}
                  onChange={(e) => {
                    const clean = e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, '');
                    setDayBatchCode(clean);
                    setDayBatchCodeCustomized(true);
                    setAllocations(prev => prev.map(a => a.productBatchNoCustomized ? a : { ...a, productBatchNo: '' }));
                  }}
                  onBlur={() => {
                    if (currentDayRec?.id && !isEditingCompletedDay && dayBatchCode) {
                      syncDayMetaToServer({ nextCode: dayBatchCode });
                    }
                  }}
                  title="Editable Day Batch Code (DDMMYY auto-fetched from Day Date, manually editable)"
                  className="w-16 bg-white dark:bg-slate-900 border border-indigo-300 dark:border-indigo-700 rounded px-1 py-0 text-[10px] font-mono font-black text-indigo-700 dark:text-indigo-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              )}
            </div>

            {/* Day-Wise Production User Allocation Dropdown (PRODUCTION_STAFF default + optional all roles) */}
            <div className="relative shrink-0">
              <button
                type="button"
                disabled={isViewMode || (isCompleted && !isEditingCompletedDay)}
                onClick={() => setShowDayUserPopover(prev => !prev)}
                title="Allocate Production Users (PRODUCTION_STAFF) for this Day"
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[9.5px] font-bold transition-colors ${
                  dayAssignedUsers.length > 0
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-700'
                    : 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
                } ${isViewMode || (isCompleted && !isEditingCompletedDay) ? 'opacity-75 cursor-default' : 'cursor-pointer hover:border-indigo-400'}`}
              >
                <Users className="w-3 h-3 text-indigo-600 dark:text-indigo-400 shrink-0" />
                <span>
                  {dayAssignedUsers.length > 0
                    ? `Day ${activeDayNo} Staff (${dayAssignedUsers.length}): ${dayAssignedUsers.slice(0, 2).map(u => u.name).join(', ')}${dayAssignedUsers.length > 2 ? ` +${dayAssignedUsers.length - 2}` : ''}`
                    : `Assign Day ${activeDayNo} Staff`}
                </span>
                {savingDayMeta && <RefreshCw className="w-2.5 h-2.5 animate-spin text-indigo-500" />}
              </button>

              {showDayUserPopover && (
                <div className="absolute left-0 top-full mt-1 z-50 w-72 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl p-2.5">
                  <div className="flex items-center justify-between gap-2 pb-1.5 mb-2 border-b border-slate-200 dark:border-slate-800">
                    <div>
                      <div className="text-[11px] font-black text-slate-900 dark:text-white">
                        Day {activeDayNo} Production Users
                      </div>
                      <div className="text-[9.5px] text-slate-500">
                        Role: PRODUCTION_STAFF {userFilterShowAllRoles ? '+ All Active' : '(Filtered)'}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowDayUserPopover(false)}
                      className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <label className="flex items-center gap-1.5 text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 mb-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={userFilterShowAllRoles}
                      onChange={(e) => setUserFilterShowAllRoles(e.target.checked)}
                      className="accent-indigo-600 cursor-pointer"
                    />
                    <span>Show All Active Roles (Supervisors / Masters)</span>
                  </label>

                  <div className="max-h-48 overflow-y-auto space-y-1 pr-0.5">
                    {(() => {
                      const hasProdRole = productionUsersList.some(u => u.role === 'PRODUCTION_STAFF');
                      const filteredList = (userFilterShowAllRoles || !hasProdRole)
                        ? productionUsersList
                        : productionUsersList.filter(u =>
                            u.role === 'PRODUCTION_STAFF' ||
                            dayAssignedUsers.some(au => (au.id && u.id && au.id === u.id) || au.name === u.name)
                          );
                      if (filteredList.length === 0) {
                        return (
                          <div className="text-[11px] text-slate-400 py-3 text-center">
                            No active production users available.
                          </div>
                        );
                      }
                      return filteredList.map(u => {
                        const checked = dayAssignedUsers.some(au => (au.id && u.id && au.id === u.id) || au.name === u.name);
                        return (
                          <label
                            key={u.id || u.name}
                            className={`flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg border text-[11px] cursor-pointer transition-colors ${
                              checked
                                ? 'bg-indigo-50/80 border-indigo-300 dark:bg-indigo-950/50 dark:border-indigo-700'
                                : 'bg-slate-50/60 border-slate-200 dark:bg-slate-800/40 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800'
                            }`}
                          >
                            <span className="flex items-center gap-1.5 min-w-0">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => handleToggleDayUser(u)}
                                className="accent-indigo-600 cursor-pointer shrink-0"
                              />
                              <span className="font-bold text-slate-800 dark:text-slate-100 truncate">{u.name}</span>
                              {u.empId && <span className="font-mono text-[9.5px] text-slate-400 shrink-0">({u.empId})</span>}
                            </span>
                            <span className={`font-mono text-[8.5px] font-bold px-1.5 py-0.5 rounded shrink-0 ${
                              u.role === 'PRODUCTION_STAFF'
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                : 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300'
                            }`}>
                              {u.role}
                            </span>
                          </label>
                        );
                      });
                    })()}
                  </div>
                </div>
              )}
            </div>

            {/* Completed Days Chips (Click to Load & Edit Day 1..N directly inside Cockpit Steps) */}
            {completedDaysList.length > 0 && (
              <div className="flex items-center gap-1 flex-wrap shrink-0">
                {completedDaysList.map(d => {
                  const isCurrentlyLoaded = Number(activeDayNo) === Number(d.dayNo);
                  return (
                    <button
                      key={`hdr-day-${d.id}`}
                      type="button"
                      onClick={() => handleSwitchDay(d.dayNo)}
                      title={`Day ${d.dayNo} (${d.dayBatchCode}) • Yield: ${d.totalOutputQty}${canViewCost ? ` • EB: ₹${d.ebTotalCost} • Labour: ₹${d.labourTotalCost}` : ''} — Click to load & edit Day ${d.dayNo} inside Cockpit`}
                      className={`inline-flex items-center gap-1 text-[9.5px] font-mono font-bold px-2 py-0.5 rounded border cursor-pointer transition-colors ${
                        isCurrentlyLoaded
                          ? 'bg-indigo-600 text-white border-indigo-700 ring-2 ring-indigo-400/50 shadow-xs'
                          : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:hover:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-700'
                      }`}
                    >
                      <CheckCircle2 className={`w-2.5 h-2.5 shrink-0 ${isCurrentlyLoaded ? 'text-white' : 'text-emerald-600'}`} />
                      <span>{isCurrentlyLoaded ? `Editing Day ${d.dayNo}` : `Edit Day ${d.dayNo}`}</span>
                      <span className={isCurrentlyLoaded ? 'text-indigo-100' : 'text-slate-500 dark:text-slate-400'}>({d.dayBatchCode})</span>
                      {!isCurrentlyLoaded && <Edit3 className="w-2.5 h-2.5 text-indigo-600 dark:text-indigo-400 shrink-0" />}
                    </button>
                  );
                })}
                {(selectedDayNo !== null && Number(selectedDayNo) !== Number(liveActiveDayNo)) && (
                  <button
                    type="button"
                    onClick={handleReturnToActiveDay}
                    className="inline-flex items-center gap-1 text-[9.5px] font-mono font-black px-2 py-0.5 rounded border bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-700 cursor-pointer"
                    title={`Return to active Day ${liveActiveDayNo}`}
                  >
                    <ChevronLeft className="w-2.5 h-2.5" />
                    <span>Back to Day {liveActiveDayNo}</span>
                  </button>
                )}
              </div>
            )}

            {/* Status Chip */}
            <span className={`text-[9px] font-mono font-bold px-1.5 py-0.2 rounded-full border flex items-center gap-1 shrink-0 ${
              isCompleted
                ? 'bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-700'
                : isPaused
                ? 'bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-700'
                : 'bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/90 dark:text-emerald-400 dark:border-emerald-700'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${isCompleted ? 'bg-[#30914c]' : isPaused ? 'bg-[#e9730c]' : 'bg-[#30914c] animate-pulse'}`} />
              {isCompleted ? 'COMPLETED' : isPaused ? 'PAUSED' : 'IN EXECUTION'}
            </span>

            {/* QC / Stock Routing Status Chip */}
            <span className={`text-[9px] font-mono font-bold px-1.5 py-0.2 rounded border shrink-0 ${
              labTestRequired 
                ? 'bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-700' 
                : 'bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-400 dark:border-emerald-700'
            }`}>
              {labTestRequired ? 'QC QUARANTINE HOLD' : 'DIRECT TO STOCK'}
            </span>

            <span className="text-slate-300 dark:text-slate-700 hidden lg:inline">•</span>

            {/* Compact Metadata Inline */}
            <div className="text-[9.5px] text-slate-500 dark:text-slate-400 font-medium truncate hidden md:flex items-center gap-1.5">
              <span>Formulation: <strong className="text-slate-700 dark:text-slate-300">{batch?.templateName || batch?.baseName || 'Standard Formulation'}</strong></span>
              <span>•</span>
              <span>Shift: <strong className="text-slate-700 dark:text-slate-300">{batch?.shift || 'Morning'}</strong></span>
              <span>•</span>
              <span>Date: <strong className="font-mono text-slate-700 dark:text-slate-300">{formatDateDMY(dayProductionDate || batch?.startDate)}</strong></span>
              <span>•</span>
              <span>Operator: <strong className="text-slate-700 dark:text-slate-300">{currentUser?.name || 'Supervisor'}</strong></span>
            </div>
          </div>

          {/* Header Action Buttons */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Start Next Day Quick Action when Day 1 completed & carry-forward mix remains */}
            {awaitingNextDayStart && !isViewMode && (
              <Button
                type="button"
                size="sm"
                disabled={nextDayLoading}
                onClick={handleStartNextDay}
                className="h-5.5 px-2.5 text-[10px] font-extrabold rounded bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1 shadow-xs cursor-pointer animate-pulse"
                title={`Start Day ${completedDaysList.length + 1} using remaining ${formatIndian(remainingTankMixAfterCompletedMl, 2)} ml carry-forward tank mix`}
              >
                {nextDayLoading ? <RefreshCw className="w-2.5 h-2.5 animate-spin" /> : <Play className="w-2.5 h-2.5 fill-current" />}
                <span>Start Day {completedDaysList.length + 1} ({formatIndian(remainingTankMixAfterCompletedMl)} ml left)</span>
              </Button>
            )}
            {isViewMode && (
              <span className="text-[9.5px] font-mono font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border border-blue-300 dark:border-blue-700">
                READ-ONLY VIEW
              </span>
            )}

            {/* Reopen Batch */}
            {isCompleted && !isViewMode && (
              <Button
                variant="outline"
                size="sm"
                disabled={actionLoading}
                onClick={handleReopenProduction}
                className="h-5.5 px-2 text-[10px] font-bold rounded border-amber-400 text-amber-800 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/40 flex items-center gap-1 cursor-pointer shadow-3xs"
              >
                <Unlock className="w-2.5 h-2.5" />
                <span>Reopen</span>
              </Button>
            )}

            {/* Pause / Resume */}
            {!isCompleted && !isViewMode && (
              isPaused ? (
                <Button
                  size="sm"
                  disabled={actionLoading}
                  onClick={handleResume}
                  className="h-5.5 px-2 text-[10px] font-bold rounded bg-[#0070f2] hover:bg-blue-600 text-white flex items-center gap-1 shadow-3xs cursor-pointer"
                >
                  <Play className="w-2.5 h-2.5 fill-current" />
                  <span>Resume</span>
                </Button>
              ) : (
                <Button
                  size="sm"
                  disabled={actionLoading}
                  onClick={handlePause}
                  className="h-5.5 px-2 text-[10px] font-bold rounded bg-[#e9730c] hover:bg-amber-600 text-white flex items-center gap-1 shadow-3xs cursor-pointer"
                >
                  <Pause className="w-2.5 h-2.5 fill-current" />
                  <span>Pause Order</span>
                </Button>
              )
            )}

            {/* Cancel Run */}
            {!isCompleted && !isViewMode && (
              <Button
                variant="outline"
                size="sm"
                disabled={actionLoading}
                onClick={handleCancelRun}
                className="h-5.5 px-2 text-[10px] font-bold rounded text-[#d20a0a] border-red-300 dark:border-red-900 hover:bg-red-50 dark:hover:bg-red-950/40 cursor-pointer shadow-3xs"
              >
                Cancel Order
              </Button>
            )}

            {/* GST Label */}
            {isCompleted && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const primaryProduct = batch?.product || allocations[0];
                  const sellingPrice = Number(primaryProduct?.salePrice || primaryProduct?.ratePerUnit || batch?.salePrice || 0);
                  const mfdDisplay = batch?.completeDate ? new Date(batch.completeDate).toISOString().split('T')[0] : (batch?.startDate ? new Date(batch.startDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]);
                  Swal.fire({
                    title: 'GST Compliance & GS1 Barcode Ready',
                    html: `
                      <div style="text-align: left; font-size: 13px; line-height: 1.6;">
                        <p><strong>Batch No:</strong> <span style="font-family: monospace; font-weight: bold; color: #0070f2;">${batch?.referenceNo || batch?.batchNo || batchId}</span></p>
                        <p><strong>Product:</strong> ${primaryProduct?.name || primaryProduct?.productName || 'Ice Cream Goods'}</p>
                        <p><strong>MFD (Production Date):</strong> <span style="font-family: monospace; font-weight: bold;">${mfdDisplay}</span></p>
                        <p><strong>MRP / Selling Price:</strong> <span style="font-family: monospace; font-weight: bold; color: #30914c;">₹${sellingPrice > 0 ? sellingPrice.toFixed(2) : '150.00'}</span></p>
                        <p><strong>GS1 (01) GTIN:</strong> 08901234567890</p>
                        <p><strong>GS1 (10) Batch:</strong> ${batch?.referenceNo || batch?.batchNo || 'LOT-2026'}</p>
                      </div>
                    `,
                    icon: 'success'
                  });
                }}
                className="h-5.5 px-2 text-[10px] font-bold rounded border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 hover:bg-blue-100 flex items-center gap-1 cursor-pointer shadow-3xs"
              >
                <Printer className="w-2.5 h-2.5 text-[#0070f2]" />
                <span>GST Label</span>
              </Button>
            )}
          </div>
        </div>

        {/* ── 3. HEADER FACETS (KPI STRIP, ULTRA COMPACT 2-LINE CELLS DIVIDED BY HAIRLINES) ── */}
        {viewMode === 'STEPS' && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 divide-y sm:divide-y-0 sm:divide-x divide-slate-200 dark:divide-slate-800 bg-[#f5f6f7] dark:bg-slate-900/90 border-b border-slate-200 dark:border-slate-800 px-2 sm:px-3 py-0.5 select-none shrink-0 transition-colors">
            {/* Facet 1: Target Planned */}
            <div className="py-0.5 px-2 flex flex-col justify-center">
              <span className="text-[8.5px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block leading-none">Target Planned</span>
              <div className="text-[11.5px] font-mono font-black text-slate-900 dark:text-white tabular-nums leading-tight mt-0.5">
                {formatIndian(batch?.quantity || 2000)} pcs
              </div>
            </div>

            {/* Facet 2: Pre-Evap Volume */}
            <div className="py-0.5 px-2 flex flex-col justify-center">
              <span className="text-[8.5px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block leading-none">Pre-Evap Volume</span>
              <div className="text-[11.5px] font-mono font-black text-[#0070f2] dark:text-blue-400 tabular-nums leading-tight mt-0.5 flex items-baseline gap-1">
                <span>{formatIndian(liveEvaporationResult.totalBeforeEvapMl)} ml</span>
                <span className="text-[8.5px] font-mono text-slate-400 font-normal">({round2(liveEvaporationResult.totalBeforeEvapMl / 1000)} L)</span>
              </div>
            </div>

            {/* Facet 3: Evaporated Loss */}
            <div className="py-0.5 px-2 flex flex-col justify-center">
              <span className="text-[8.5px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block leading-none">Evaporated Loss</span>
              <div className="text-[11.5px] font-mono font-black text-[#e9730c] dark:text-amber-400 tabular-nums leading-tight mt-0.5 flex items-baseline gap-1">
                <span>-{formatIndian(liveEvaporationResult.evaporatedMl)} ml</span>
                <span className="text-[8.5px] font-mono text-amber-600/70 dark:text-amber-400/70 font-normal">({evaporationPct}%)</span>
              </div>
            </div>

            {/* Facet 4: Post-Evap Net Mix */}
            <div className="py-0.5 px-2 flex flex-col justify-center">
              <span className="text-[8.5px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block leading-none">Post-Evap Net Mix</span>
              <div className="text-[11.5px] font-mono font-black text-[#30914c] dark:text-emerald-400 tabular-nums leading-tight mt-0.5">
                {formatIndian(liveEvaporationResult.mixAfterEvapMl)} ml
              </div>
            </div>

            {/* Facet 5: Base Mix Allocated */}
            <div className="py-0.5 px-2 flex flex-col justify-center">
              <span className="text-[8.5px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block leading-none">Base Mix Allocated</span>
              <div className="text-[11.5px] font-mono font-black text-[#8b47d7] dark:text-purple-400 tabular-nums leading-tight mt-0.5 flex items-baseline gap-1">
                <span>{formatIndian(liveAllocationsResult.totalMixUsedMl)} ml</span>
                <span className="text-[8.5px] font-mono text-purple-600/70 dark:text-purple-300/70 font-normal">
                  ({availableMixMl > 0 ? `${Math.round((liveAllocationsResult.totalMixUsedMl / availableMixMl) * 100)}%` : '0%'})
                </span>
              </div>
            </div>

            {/* Facet 6: Unallocated Balance */}
            <div className="py-0.5 px-2 flex flex-col justify-center">
              <span className="text-[8.5px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block leading-none">Unallocated Balance</span>
              <div className="text-[11.5px] font-mono font-black tabular-nums leading-tight mt-0.5 flex items-center gap-1.5">
                <span className={liveAllocationsResult.remainingMixMl < 0 ? 'text-[#d20a0a]' : (liveAllocationsResult.remainingMixMl === 0 ? 'text-[#30914c]' : 'text-[#e9730c]')}>
                  {formatIndian(liveAllocationsResult.remainingMixMl)} ml
                </span>
                <span className={`text-[8px] font-mono font-bold px-1 py-0.2 rounded border ${
                  liveAllocationsResult.remainingMixMl < 0 
                    ? 'bg-rose-50 text-rose-700 border-rose-300 dark:bg-rose-950 dark:text-rose-300' 
                    : (liveAllocationsResult.remainingMixMl === 0 
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300' 
                        : 'bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950 dark:text-amber-300')
                }`}>
                  {liveAllocationsResult.remainingMixMl < 0 ? 'Deficit' : (liveAllocationsResult.remainingMixMl === 0 ? 'Allocated ✓' : 'To Allocate')}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* ── 4. ICON TAB BAR / PROCESS STEPPER (5 ULTRA-COMPACT STEPS WITH CONNECTOR LINES) ── */}
        {viewMode === 'STEPS' && (
          <div className="px-3 py-0.5 bg-white dark:bg-[#0d1b2a] border-b border-slate-200 dark:border-slate-800 overflow-x-auto select-none shrink-0 transition-colors">
            <div className="flex items-center gap-1 min-w-max">
              {[
                { id: 1, title: 'Base Raw Materials', desc: 'Warehouse Allocation', icon: Boxes, isDone: step1Ready, badge: `${rmRows.length} RMs` },
                { id: 2, title: 'Merge & Evaporation', desc: 'Thermal Volume Loss', icon: Flame, isDone: step2Ready, badge: `${formatIndian(liveEvaporationResult.mixAfterEvapMl)} ml` },
                { id: 3, title: 'Products & Moulds', desc: 'Sequential Chaining', icon: Box, isDone: step3Ready, badge: `${allocations.length} Products` },
                { id: 4, title: 'Factory Timeline', desc: 'Stage Sequences', icon: Layers, isDone: timelineStages.length > 0, badge: `${timelineStages.length} Stages` },
                { id: 5, title: 'Quality & Yield', desc: 'Yield & Finalization', icon: ShieldCheck, isDone: isCompleted, badge: `${actualYieldPieces} pcs` }
              ].map((s, idx) => {
                const isActive = activeStep === s.id;
                const hasErr = stepHasError(s.id);
                return (
                  <React.Fragment key={s.id}>
                    {idx > 0 && (
                      <div className={`h-0.5 w-2 sm:w-3 shrink-0 transition-colors ${
                        s.isDone ? 'bg-[#30914c]' : 'bg-slate-300 dark:bg-slate-700'
                      }`} />
                    )}
                    <button
                      type="button"
                      onClick={() => handleStepClick(s.id)}
                      className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-[10.5px] font-bold transition-all cursor-pointer shrink-0 border relative text-left ${
                        isActive 
                          ? 'border-[#0070f2] bg-blue-50/80 dark:bg-blue-950/60 text-[#0070f2] dark:text-blue-300 shadow-3xs ring-1 ring-[#0070f2]/30' 
                          : hasErr
                          ? 'border-[#d20a0a] bg-rose-50 text-[#d20a0a] dark:bg-rose-950/60 dark:text-rose-300'
                          : s.isDone 
                          ? 'border-emerald-300 bg-emerald-50/70 text-emerald-800 dark:border-emerald-800 dark:bg-slate-800/80 dark:text-emerald-300' 
                          : 'border-slate-200 bg-[#f5f6f7] text-slate-600 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-400 hover:bg-slate-100'
                      }`}
                    >
                      {/* Step Circle Indicator */}
                      <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center font-mono text-[8.5px] font-black shrink-0 ${
                        isActive 
                          ? 'bg-[#0070f2] text-white' 
                          : hasErr
                          ? 'bg-[#d20a0a] text-white'
                          : s.isDone 
                          ? 'bg-[#30914c] text-white' 
                          : 'bg-slate-300 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                      }`}>
                        {hasErr ? '!' : (s.isDone && !isActive ? '✓' : `0${s.id}`)}
                      </span>

                      <div className="min-w-0">
                        <div className="font-extrabold text-[10px] leading-tight flex items-center gap-1">
                          <span>{s.title}</span>
                          <span className={`text-[8px] font-mono px-1 py-0 rounded shrink-0 ${
                            isActive ? 'bg-[#0070f2] text-white' : s.isDone ? 'bg-emerald-200 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
                          }`}>
                            {s.badge}
                          </span>
                        </div>
                      </div>

                      {/* SAP Horizon Active Underline */}
                      {isActive && (
                        <span className="absolute bottom-[-1px] left-1 right-1 h-[2px] bg-[#0070f2] rounded-full" />
                      )}
                    </button>
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        )}

        {/* ── 5. MESSAGE STRIP (BLUE SAP INSTRUCTION STRIP - ULTRA SLIM) ── */}
        {viewMode === 'STEPS' && (
          <div className="px-3 py-0.5 bg-blue-50/90 dark:bg-blue-950/40 border-b border-blue-200/80 dark:border-blue-900/60 flex items-center gap-1.5 text-blue-900 dark:text-blue-200 select-none shrink-0 transition-colors">
            <Info className="w-3 h-3 text-[#0070f2] shrink-0" />
            <span className="font-semibold text-[10px] truncate leading-tight">
              {activeStep === 1 && 'Step 1: Allocate warehouse batch lots, reserve inventory stock, and confirm taken quantities for base raw materials.'}
              {activeStep === 2 && 'Step 2: Slide to merge raw materials into a single liquid volume (ml), specify process stage, and apply evaporation % mass loss.'}
              {activeStep === 3 && 'Step 3: Assign multiple finished products to the evaporated mix, allocate base mix volume, add product-specific essences/flavours with lots, and configure moulds or bulk storage.'}
              {activeStep === 4 && 'Step 4: Factory stages palette & Timeline sequence. Click stage chip to add/remove • Click any stage to configure temperature & duration • Drag & drop to reorder.'}
              {activeStep === 5 && 'Step 5: Review multi-product allocation economics, calculate wastage costs, record actual completed pieces per product, and finalize floor run.'}
            </span>
          </div>
        )}

        {/* ── BODY (Scrollable Step Sections or Clean Executive Report) ── */}
        <div className="flex-1 min-h-0 overflow-y-auto p-2 sm:p-3 space-y-2.5">
          
          {loading ? (
            <div className="flex flex-col items-center justify-center py-24 text-slate-400">
              <RefreshCw className="w-8 h-8 animate-spin mb-3 text-indigo-600" />
              <p className="text-sm font-semibold">Loading batch formulation and warehouse inventory lots...</p>
            </div>
          ) : viewMode === 'REPORT' ? (
            <ProductionCleanReportView
              batch={batch}
              costingData={{
                ...costingData,
                labourCost: costingData?.labourCost ?? labourCost ?? 0,
                utilityCost: costingData?.utilityCost ?? electricityCost ?? 0,
                overheadCost: costingData?.overheadCost ?? overheadCost ?? 0,
                totalProductionCost: costingData?.totalProductionCost ?? (
                  (costingData?.totalMaterialCost ?? totalBaseMixCost) +
                  (costingData?.totalWastageCost ?? totalWastageCost) +
                  (labourCost || 0) +
                  (electricityCost || 0) +
                  (overheadCost || 0)
                )
              }}
              allocations={activeAllocs}
              productStagesMap={productStagesMap}
              liveAllocationsResult={liveAllocationsResult}
              liveEvaporationResult={liveEvaporationResult}
              rmRows={displayedRmRows}
              actualYieldPieces={actualYieldPieces}
              completionNotes={completionNotes}
              timelineStages={timelineStages}
              labTestRequired={labTestRequired}
              canViewCost={canViewCost}
              companyDetails={companyDetails}
              daysHistory={daysHistory}
              onEditDayCosts={(dayObj) => handleSwitchDay(dayObj?.dayNo || 1, 4)}
              onRefreshBatch={fetchAllData}
              onReopen={!isViewMode ? handleReopenProduction : null}
              onSwitchToSteps={() => setViewMode('STEPS')}
              onClose={onClose}
            />
          ) : (
            <>
              {/* ── EDITING COMPLETED DAY BANNER (IN-COCKPIT FULL EDITING FOR DAY 1 vs DAY 2+) ── */}
              {isEditingCompletedDay && (
                <div className="p-2 px-3 rounded-xl border border-indigo-300 dark:border-indigo-700 bg-gradient-to-r from-indigo-50 via-blue-50 to-emerald-50 dark:from-indigo-950/60 dark:via-blue-950/40 dark:to-emerald-950/40 flex items-center justify-between flex-wrap gap-2 shadow-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <Edit3 className="w-4 h-4 text-indigo-600 shrink-0" />
                    <div className="min-w-0">
                      <div className="text-xs font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5 flex-wrap">
                        <span>Editing Completed Day {activeDayNo} ({dayBatchCode})</span>
                        <span className={`text-[9.5px] font-mono px-1.5 py-0.2 rounded border ${
                          Number(activeDayNo) === 1
                            ? 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300'
                            : 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-300'
                        }`}>
                          {Number(activeDayNo) === 1
                            ? 'Full Edit: Base RM & Evap (Steps 1-2) + Products/Moulds/Timeline/Yield (Steps 3-5)'
                            : 'Base RM & Evap Locked • Edit Products, Moulds, Timeline, Costs & Yield (Steps 3-5)'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {!isViewMode && (
                      <Button
                        type="button"
                        size="sm"
                        disabled={savingCompletedDay}
                        onClick={() => handleSaveCompletedDayChanges()}
                        className="h-6.5 px-2.5 text-[10.5px] font-extrabold rounded bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer flex items-center gap-1"
                      >
                        {savingCompletedDay ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                        <span>Save Day {activeDayNo} Changes</span>
                      </Button>
                    )}
                    {Number(activeDayNo) !== Number(liveActiveDayNo) && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleReturnToActiveDay}
                        className="h-6.5 px-2 text-[10.5px] font-bold rounded border-slate-300 dark:border-slate-700 cursor-pointer flex items-center gap-1"
                      >
                        <ChevronLeft className="w-3 h-3" />
                        <span>Back to Day {liveActiveDayNo}</span>
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {/* ── MULTI-DAY CARRY-FORWARD BANNER (WHEN DAY N COMPLETED & WAITING FOR DAY N+1) ── */}
              {awaitingNextDayStart && (
                <div className="p-2.5 px-3 rounded-xl border border-indigo-300 dark:border-indigo-700 bg-gradient-to-r from-indigo-50 via-purple-50 to-emerald-50 dark:from-indigo-950/60 dark:via-purple-950/40 dark:to-emerald-950/40 flex items-center justify-between flex-wrap gap-2 shadow-xs">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0">
                      <History className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5 flex-wrap">
                        <span>Day {completedDaysList.length} Completed &amp; Stock Updated ✓</span>
                        <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-purple-100 dark:bg-purple-900/60 text-purple-800 dark:text-purple-200 border border-purple-300 dark:border-purple-700">
                          Remaining Tank Mix: {formatIndian(remainingTankMixAfterCompletedMl, 2)} ml ({round2(remainingTankMixAfterCompletedMl / 1000)} L)
                        </span>
                      </div>
                      <p className="text-[10.5px] text-slate-600 dark:text-slate-300">
                        You can edit completed Day Operational Costs (EB/Labour) anytime, or click <strong>Start Day {completedDaysList.length + 1}</strong> to allocate the remaining tank mix.
                      </p>
                    </div>
                  </div>
                  {!isViewMode && (
                    <Button
                      type="button"
                      size="sm"
                      disabled={nextDayLoading}
                      onClick={handleStartNextDay}
                      className="h-7 px-3 text-xs font-extrabold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer shadow-xs flex items-center gap-1.5 shrink-0"
                    >
                      {nextDayLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                      <span>Start Day {completedDaysList.length + 1} Production</span>
                    </Button>
                  )}
                </div>
              )}

              {/* ══════════════════════════════════════════════════════════════════════════
                  STEP 1: BASE RAW MATERIALS FORMULATION & WAREHOUSE LOT ALLOCATION
              ══════════════════════════════════════════════════════════════════════════ */}
              <div className={`${activeStep === 1 ? 'block' : 'hidden'} space-y-2`}>
                {step1And2Locked ? (
                  <div className="p-2 px-3 rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50/80 dark:bg-amber-950/30 flex items-center justify-between gap-2 text-[11px] text-amber-900 dark:text-amber-200 font-semibold flex-wrap">
                    <div className="flex items-center gap-2">
                      <Lock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      <span>
                        {Number(activeDayNo) > 1
                          ? `Base Raw Materials Locked on Day ${activeDayNo} — Step 1 Base Raw Materials & Step 2 Evaporation can only be edited on Day 1. Use Steps 3–5 for Day ${activeDayNo} products, moulds, timeline & yield.`
                          : 'Read-Only View — Base raw material lines cannot be modified in view mode.'}
                      </span>
                    </div>
                    {!isViewMode && Number(activeDayNo) > 1 && completedDaysList.some(d => Number(d.dayNo) === 1) && (
                      <button
                        type="button"
                        onClick={() => handleSwitchDay(1, 1)}
                        className="px-2 py-0.5 rounded bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-bold cursor-pointer shrink-0"
                      >
                        Switch to Edit Day 1
                      </button>
                    )}
                  </div>
                ) : null}
                <Card className="border border-slate-200 dark:border-slate-800 shadow-xs bg-white dark:bg-slate-900 rounded-lg overflow-hidden">
                  <div className="px-3.5 py-1.5 bg-slate-50/70 dark:bg-slate-800/40 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded bg-indigo-600 text-white text-[11px] font-bold flex items-center justify-center">
                        1
                      </span>
                      <h3 className="text-xs sm:text-[13px] font-extrabold text-slate-900 dark:text-white">
                        Base Raw Materials Formulation &amp; Batch Consumption
                      </h3>
                      <span className="text-[10px] text-slate-500 font-normal">
                        ({isViewMode ? displayedRmRows.length : rmRows.length} materials {isViewMode ? 'used' : 'queued'})
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {!step1And2Locked && (
                        <>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setItemSearchMode('RM_MULTI');
                              setItemSearchOpen(true);
                            }}
                            className="h-6 px-2 text-[10.5px] font-bold rounded border-amber-400 text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/40 cursor-pointer shadow-3xs flex items-center gap-1"
                          >
                            <Plus className="w-3 h-3 text-amber-600" />
                            <span>+ Add Base Raw Materials</span>
                          </Button>
                          {(baseRmDeducted || isEditingCompletedDay) && (
                            <Button
                              type="button"
                              size="sm"
                              disabled={savingProcess}
                              onClick={handleSaveProcess}
                              className="h-6 px-2.5 text-[10.5px] font-bold rounded bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer shadow-3xs flex items-center gap-1"
                            >
                              {savingProcess ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                              <span>Save Day 1 Base RMs</span>
                            </Button>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  <div className="overflow-x-auto max-h-[calc(100vh-270px)] overflow-y-auto">
                    <table className="w-full text-left text-xs border-collapse font-sans">
                      <thead className="sticky top-0 z-10 bg-slate-100/95 dark:bg-slate-800/95 backdrop-blur-xs shadow-xs">
                        <tr className="text-slate-600 dark:text-slate-300 font-bold uppercase tracking-wider text-[9px] border-b border-slate-200 dark:border-slate-700">
                          <th className="py-1.5 px-2 text-center w-10" title="Flag material for evaporation mass loss">Evap</th>
                          <th className="py-1.5 px-2 text-center w-10" title="Include material in combined mix">Merge</th>
                          <th className="py-1.5 px-2 min-w-[150px]">Raw Material</th>
                          <th className="py-1.5 px-2 min-w-[180px]" title="Allocated Batch No from warehouse stock">Batch / Lot Allocation</th>
                          <th className="py-1.5 px-2 text-center w-20">Live UOM</th>
                          <th className="py-1.5 px-2 text-right w-20" title="Allocated batch quantity available in production">Avail in Batch</th>
                          <th className="py-1.5 px-2 text-right w-20">Required</th>
                          <th className="py-1.5 px-2 text-right w-24 bg-amber-500/10">Taken (Used)</th>
                          <th className="py-1.5 px-2 text-right w-24" title="Remaining quantity from allocated batch in this production (Available - Taken)">Rem in Prod</th>
                          <th className="py-1.5 px-2 text-right w-28" title="Remaining stock in warehouse after this batch allocation (Warehouse Stock - Taken)">Rem Warehouse Stock</th>
                          {canViewCost && <th className="py-1.5 px-2 text-right w-20" title="Live PO Unit Rate from allocated lot">Rate (₹)</th>}
                          {canViewCost && <th className="py-1.5 px-2 text-right w-24" title="Line cost based on taken quantity and live PO rate">Amount (₹)</th>}
                          {!step1And2Locked && <th className="py-1.5 px-2 text-center w-8">✕</th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {liveEvaporationResult.lines
                          .filter(line => !isViewMode || (Number(line.takenQty || 0) > 0 || (Array.isArray(line.allocatedBatches) && line.allocatedBatches.length > 0)))
                          .map((line, idx) => {
                          const hasAllocations = Array.isArray(line.allocatedBatches) && line.allocatedBatches.length > 0;
                          const allocatedSum = hasAllocations 
                            ? line.allocatedBatches.reduce((acc, b) => acc + Number(b.allocatedQty || 0), 0)
                            : Number(line.availableQty || 0);
                          const displayAvailable = allocatedSum;
                          const displayTaken = Number(line.takenQty || 0);
                          const remInProduction = Number((displayAvailable - displayTaken).toFixed(3));
                          const warehouseTotalStock = Number(line.warehouseStock ?? line.currentStock ?? line.availableQty ?? 0);
                          const remWarehouseStock = Number((warehouseTotalStock - displayTaken).toFixed(3));
                          const hasTakenMoreThanAvail = displayTaken > displayAvailable && displayAvailable > 0;
                          const hasNegative = displayTaken < 0 || displayAvailable < 0;

                          return (
                            <tr 
                              key={`line-rm-${line.rawMaterialId || 'rm'}-${idx}`}
                              className={`hover:bg-slate-50/60 dark:hover:bg-slate-800/50 transition-colors text-[11px] ${
                                hasTakenMoreThanAvail || hasNegative ? 'bg-rose-50/40 dark:bg-rose-950/20' : ''
                              }`}
                            >
                              {/* For Evaporation Checkbox */}
                              <td className="py-1 px-2 text-center">
                                <input
                                  type="checkbox"
                                  checked={line.evaporates}
                                  disabled={step1And2Locked}
                                  onChange={(e) => handleUpdateRmRow(idx, 'evaporates', e.target.checked)}
                                  className="w-3.5 h-3.5 rounded text-amber-600 focus:ring-amber-500 cursor-pointer accent-amber-600 disabled:opacity-60"
                                  title="Check if this liquid contributes to thermal evaporation"
                                />
                              </td>

                              {/* Merge Checkbox */}
                              <td className="py-1 px-2 text-center">
                                <input
                                  type="checkbox"
                                  checked={line.merged}
                                  disabled={step1And2Locked}
                                  onChange={(e) => handleUpdateRmRow(idx, 'merged', e.target.checked)}
                                  className="w-3.5 h-3.5 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer accent-indigo-600 disabled:opacity-60"
                                  title="Check to include in merged base liquid volume"
                                />
                              </td>

                              {/* Material Name & Code */}
                              <td className="py-1 px-2">
                                <div className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1">
                                  <span>{line.rawMaterialName}</span>
                                  {line.evaporates && (
                                    <Flame className="w-3 h-3 text-amber-500 shrink-0" title="Evaporating material" />
                                  )}
                                </div>
                                <div className="font-mono text-[9px] text-slate-400">
                                  {line.rawMaterialCode || 'RM'}
                                </div>
                              </td>

                              {/* Interactive Batch / Lot Allocation Column */}
                              <td className="py-1 px-2">
                                <div className="flex flex-col gap-0.5 items-start">
                                  {step1And2Locked ? (
                                    hasAllocations ? (
                                      <div className="px-1.5 py-0.5 rounded border border-blue-300 dark:border-blue-800 bg-blue-50/80 dark:bg-blue-950/60 text-blue-900 dark:text-blue-300 font-mono text-[9.5px] flex items-center gap-1 shadow-3xs">
                                        <Boxes className="w-3 h-3 text-blue-600 shrink-0" />
                                        <span className="font-bold">
                                          {line.allocatedBatches.length === 1 
                                            ? `#${line.allocatedBatches[0].lotNumber || line.allocatedBatches[0].internalBatchNo}` 
                                            : `${line.allocatedBatches.length} Lots Allocated`}
                                        </span>
                                      </div>
                                    ) : (
                                      <span className="text-[10px] text-slate-400 font-mono italic">Direct Batch</span>
                                    )
                                  ) : hasAllocations ? (
                                    <button
                                      type="button"
                                      onClick={() => openLotModal(idx)}
                                      className="px-1.5 py-0.5 rounded border border-blue-300 dark:border-blue-800 bg-blue-50/80 dark:bg-blue-950/60 hover:bg-blue-100 hover:border-blue-400 text-blue-900 dark:text-blue-300 font-mono text-[9.5px] text-left transition-all cursor-pointer shadow-3xs flex items-center gap-1 group"
                                      title="Click to view & edit allocated lots"
                                    >
                                      <Boxes className="w-3 h-3 text-blue-600 shrink-0" />
                                      <span className="font-bold">
                                        {line.allocatedBatches.length === 1 
                                          ? `#${line.allocatedBatches[0].lotNumber || line.allocatedBatches[0].internalBatchNo}` 
                                          : `${line.allocatedBatches.length} Lots Allocated`}
                                      </span>
                                      <span className="text-[8.5px] text-blue-600 dark:text-blue-400 underline ml-0.5 group-hover:text-blue-800">
                                        Edit
                                      </span>
                                    </button>
                                  ) : (
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      onClick={() => openLotModal(idx)}
                                      className="h-6 px-2 rounded border-amber-300 dark:border-amber-800 bg-amber-50/70 dark:bg-amber-950/40 hover:bg-amber-100 text-amber-800 dark:text-amber-300 font-bold text-[9.5px] cursor-pointer shadow-3xs flex items-center gap-1"
                                      title="Allocate batch lots from warehouse stock"
                                    >
                                      <Plus className="w-2.5 h-2.5 text-amber-600" />
                                      <span>Allocate Lots</span>
                                    </Button>
                                  )}

                                  {/* Batch details summary tag */}
                                  {hasAllocations && (
                                    <div className="text-[9px] font-mono text-slate-500 flex items-center gap-1 flex-wrap">
                                      <span>Allocated: <strong className="text-emerald-600">{displayAvailable} {formatCleanUom(line.uom, 'kg', line)}</strong></span>
                                      {line.allocatedBatches[0]?.poNumber && (
                                        <span className="text-slate-400 truncate max-w-[100px]" title={line.allocatedBatches[0].poNumber}>
                                          • {line.allocatedBatches[0].poNumber}
                                        </span>
                                      )}
                                      {line.allocatedBatches[0]?.grnNumber && (
                                        <span className="text-slate-400 truncate max-w-[100px]" title={line.allocatedBatches[0].grnNumber}>
                                          • {line.allocatedBatches[0].grnNumber}
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </td>

                              {/* Live UOM & Alternate UOM */}
                              <td className="py-1 px-2 text-center">
                                <span className="font-mono font-bold bg-slate-100 dark:bg-slate-800 px-1.5 py-0.2 rounded text-[10px] text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700">
                                  {formatCleanUom(line.uom, 'kg', line)}
                                </span>
                                {line.hasAlternateUom && line.alternateUom && (
                                  <div className="text-[8.5px] font-semibold text-indigo-600 dark:text-indigo-400 mt-0.5 bg-indigo-50 dark:bg-indigo-950/50 px-1 py-0.2 rounded border border-indigo-200/50 dark:border-indigo-800/50">
                                    1 {formatCleanUom(line.uom, 'kg', line)} = {line.conversionFactor || 1} {line.alternateUom}
                                  </div>
                                )}
                              </td>

                              {/* Available in Batch (Allocated Qty) */}
                              <td className="py-1 px-2 text-right">
                                <div className="font-mono font-black text-[11px] text-slate-800 dark:text-slate-100">
                                  {formatIndian(displayAvailable)}
                                </div>
                                <span className="text-[8.5px] text-slate-400 block font-mono">
                                  {formatCleanUom(line.uom, 'kg', line)}
                                </span>
                              </td>

                              {/* Required Qty (Editable / Read-only when Step 1 locked) */}
                              <td className="py-1 px-2 text-right">
                                {step1And2Locked ? (
                                  <span className="font-mono font-bold text-[11px] text-slate-800 dark:text-slate-100">
                                    {line.requiredQty}
                                  </span>
                                ) : (
                                  <Input
                                    type="number"
                                    step="any"
                                    value={line.requiredQty}
                                    onChange={(e) => handleUpdateRmRow(idx, 'requiredQty', parseFloat(e.target.value) || 0)}
                                    className="h-6 w-18 text-right font-mono text-[11px] px-1 ml-auto border-slate-200 dark:border-slate-700"
                                  />
                                )}
                              </td>

                              {/* Taken (Used) (Editable / Read-only when Step 1 locked) */}
                              <td className="py-1 px-2 text-right bg-amber-50/40 dark:bg-amber-950/10">
                                {step1And2Locked ? (
                                  <span className="font-mono font-black text-[11px] text-amber-700 dark:text-amber-300">
                                    {line.takenQty}
                                  </span>
                                ) : (
                                  <Input
                                    type="number"
                                    step="any"
                                    value={line.takenQty}
                                    onChange={(e) => handleUpdateRmRow(idx, 'takenQty', parseFloat(e.target.value) || 0)}
                                    className="h-6 w-20 text-right font-mono font-bold text-[11px] px-1 ml-auto border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-900"
                                  />
                                )}
                                {hasTakenMoreThanAvail && (
                                  <div className="text-[8.5px] font-bold text-rose-600 flex items-center justify-end gap-0.5 mt-0.5">
                                    <AlertCircle className="w-2.5 h-2.5" />
                                    <span>Exceeds Avail</span>
                                  </div>
                                )}
                              </td>

                              {/* Remaining in Current Production (Available in Batch - Taken) */}
                              <td className="py-1 px-2 text-right font-mono font-bold text-[11px]">
                                <span className={remInProduction < 0 ? 'text-rose-600 font-black' : 'text-amber-600 dark:text-amber-400'}>
                                  {formatIndian(remInProduction)} {formatCleanUom(line.uom, 'kg', line)}
                                </span>
                              </td>

                              {/* Remaining Stock in Warehouse after reducing batch taken */}
                              <td className="py-1 px-2 text-right font-mono font-bold text-[11px]">
                                <span className={remWarehouseStock < 0 ? 'text-rose-600 font-black' : 'text-emerald-600 dark:text-emerald-400'}>
                                  {formatIndian(remWarehouseStock)} {formatCleanUom(line.uom, 'kg', line)}
                                </span>
                              </td>

                              {/* Live PO Rate & Cost */}
                              {canViewCost && (
                                <td className="py-1 px-2 text-right font-mono text-[10.5px]">
                                  <div className="font-bold text-slate-800 dark:text-slate-200">
                                    ₹{Number(line.allocatedBatches?.[0]?.unitRate || line.unitRate || 0).toFixed(2)}
                                  </div>
                                  {line.allocatedBatches?.[0]?.poNumber && (
                                    <div className="text-[7.5px] text-slate-400 font-normal truncate max-w-[80px] ml-auto">
                                      PO: {line.allocatedBatches[0].poNumber}
                                    </div>
                                  )}
                                </td>
                              )}
                              {canViewCost && (
                                <td className="py-1 px-2 text-right font-mono text-[10.5px]">
                                  <div className="font-bold text-emerald-600 dark:text-emerald-400">
                                    ₹{formatIndian(Number((displayTaken * Number(line.allocatedBatches?.[0]?.unitRate || line.unitRate || 0)).toFixed(2)), 2)}
                                  </div>
                                </td>
                              )}

                              {/* Remove Row */}
                              {!step1And2Locked && (
                                <td className="py-1 px-2 text-center">
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveRmRow(idx)}
                                    className="text-slate-400 hover:text-rose-600 transition-colors p-0.5 cursor-pointer"
                                    title="Remove line"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </td>
                              )}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </div>

              {/* ══════════════════════════════════════════════════════════════════════════
                  STEP 2: VOLUME MERGE AND EVAPORATION COCKPIT
              ══════════════════════════════════════════════════════════════════════════ */}
              <div className={`${activeStep === 2 ? 'block' : 'hidden'} space-y-2`}>
                {step1And2Locked && (
                  <div className="p-2 px-3 rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50/80 dark:bg-amber-950/30 flex items-center justify-between gap-2 text-[11px] text-amber-900 dark:text-amber-200 font-semibold flex-wrap">
                    <div className="flex items-center gap-2">
                      <Lock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      <span>
                        {Number(activeDayNo) > 1
                          ? `Evaporation Tank Locked on Day ${activeDayNo} — Post-evaporation total (${formatIndian(netBatchPostEvapMl, 2)} ml) can only be modified on Day 1.`
                          : 'Read-Only View — Merge & evaporation parameters cannot be modified in view mode.'}
                      </span>
                    </div>
                    {!isViewMode && Number(activeDayNo) > 1 && completedDaysList.some(d => Number(d.dayNo) === 1) && (
                      <button
                        type="button"
                        onClick={() => handleSwitchDay(1, 2)}
                        className="px-2 py-0.5 rounded bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-bold cursor-pointer shrink-0"
                      >
                        Switch to Edit Day 1
                      </button>
                    )}
                  </div>
                )}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-2.5">
                  
                  {/* Left (2 cols): Controls & Mix Evaporation Results */}
                  <Card className="lg:col-span-2 border border-slate-200 dark:border-slate-800 shadow-xs bg-white dark:bg-slate-900 rounded-lg overflow-hidden">
                    <div className="px-3.5 py-1.5 bg-slate-50/70 dark:bg-slate-800/40 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded bg-amber-500 text-slate-950 text-[11px] font-bold flex items-center justify-center">
                          2
                        </span>
                        <h3 className="text-xs sm:text-[13px] font-extrabold text-slate-900 dark:text-white">
                          UOM Volume Conversion, Merge &amp; Evaporation Control
                        </h3>
                      </div>

                      <div className="flex items-center gap-2">
                        {!step1And2Locked && (baseRmDeducted || isEditingCompletedDay) && (
                          <Button
                            type="button"
                            size="sm"
                            disabled={savingProcess}
                            onClick={handleSaveProcess}
                            className="h-6 px-2.5 text-[10.5px] font-bold rounded bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer shadow-3xs flex items-center gap-1"
                          >
                            {savingProcess ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                            <span>Save Day 1 Evaporation</span>
                          </Button>
                        )}
                        <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                          Slide to Merge:
                        </span>
                        <label className={`relative inline-flex items-center ${step1And2Locked ? 'cursor-not-allowed opacity-80' : 'cursor-pointer'}`}>
                          <input
                            type="checkbox"
                            checked={isSlideMerged}
                            disabled={step1And2Locked}
                            onChange={(e) => setIsSlideMerged(e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-500"></div>
                        </label>
                      </div>
                    </div>

                    <div className="p-2.5 space-y-2">
                      
                      {/* Controls Row */}
                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60">
                        {/* Merge Stage */}
                        <div>
                          <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">
                            1. Merge Stage
                          </label>
                          <select
                            value={
                              ['After heating', 'After freezing', 'Other Method'].includes(mergeStage)
                                ? mergeStage
                                : (mergeStage === 'Before heating' ? 'After heating' : (mergeStage === 'Before freezing' ? 'After freezing' : 'After heating'))
                            }
                            disabled={step1And2Locked}
                            onChange={(e) => setMergeStage(e.target.value)}
                            className={`w-full h-7 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 text-xs font-semibold text-slate-800 dark:text-slate-100 outline-none focus:border-amber-500 ${step1And2Locked ? 'cursor-not-allowed bg-slate-100 dark:bg-slate-800' : 'cursor-pointer'}`}
                          >
                            <option value="After heating">After heating</option>
                            <option value="After freezing">After freezing</option>
                            <option value="Other Method">Other Method</option>
                          </select>
                        </div>

                        {/* Evaporation % */}
                        <div>
                          <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">
                            2. Evaporation (%)
                          </label>
                          <div className="flex items-center gap-1">
                            <Input
                              type="number"
                              min="0"
                              max="100"
                              step="0.5"
                              value={evaporationPct}
                              disabled={step1And2Locked}
                              onChange={(e) => setEvaporationPct(parseFloat(e.target.value) || 0)}
                              className={`h-7 font-mono font-bold text-xs ${step1And2Locked ? 'bg-slate-100 dark:bg-slate-800 cursor-not-allowed' : ''}`}
                            />
                            <span className="font-bold text-xs text-slate-500">%</span>
                          </div>
                        </div>

                        {/* Direct Mix After Evaporation (Auto-Calculates %) */}
                        <div>
                          <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">
                            3. Mix After Evap (ml)
                          </label>
                          <div className="flex items-center gap-1">
                            <Input
                              type="number"
                              min="0"
                              step="10"
                              value={liveEvaporationResult.mixAfterEvapMl || ''}
                              disabled={step1And2Locked}
                              onChange={(e) => handleDirectMixAfterEvapChange(e.target.value)}
                              placeholder="Direct ml"
                              className={`h-7 font-mono font-bold text-xs border-emerald-400 dark:border-emerald-700 ${step1And2Locked ? 'bg-slate-100 dark:bg-slate-800 cursor-not-allowed' : ''}`}
                            />
                            <span className="font-bold text-xs text-slate-500">ml</span>
                          </div>
                        </div>

                        {/* Apply & Undo Buttons / Read-Only Status */}
                        <div className="flex flex-col justify-end">
                          <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">
                            4. {step1And2Locked ? 'Status' : 'Action'}
                          </label>
                          {step1And2Locked ? (
                            <div className="h-7 px-2 rounded bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 flex items-center gap-1 text-[10.5px] font-bold text-emerald-800 dark:text-emerald-300">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                              <span className="truncate">{evaporationApplied ? 'Evaporation Recorded' : 'Direct Base Mix'}</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5">
                              <Button
                                type="button"
                                disabled={!isSlideMerged || evaporationApplied}
                                onClick={handleApplyEvaporation}
                                className="flex-1 h-7 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs rounded cursor-pointer disabled:opacity-40"
                              >
                                <Flame className="w-3 h-3 mr-1" />
                                <span>Apply Evap</span>
                              </Button>
                              {evaporationApplied && (
                                <Button
                                  type="button"
                                  variant="outline"
                                  onClick={handleUndoEvaporation}
                                  className="h-7 px-2 text-xs font-bold rounded border-slate-300 dark:border-slate-700 cursor-pointer"
                                  title="Undo Evaporation"
                                >
                                  <RotateCcw className="w-3 h-3" />
                                </Button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Evaporation Math Results Grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <div className="p-2.5 rounded-lg bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200/60 dark:border-indigo-800/60">
                          <div className="text-[9.5px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                            Total Before Evaporation
                          </div>
                          <div className="text-sm sm:text-base font-mono font-black text-indigo-950 dark:text-indigo-200 mt-0.5">
                            {formatIndian(liveEvaporationResult.totalBeforeEvapMl)} ml
                          </div>
                          <div className="text-[10px] font-mono text-indigo-700 dark:text-indigo-300">
                            ≈ {formatIndian(liveEvaporationResult.totalBeforeEvapL ?? round2(liveEvaporationResult.totalBeforeEvapMl / 1000))} Litres
                          </div>
                        </div>

                        <div className="p-2.5 rounded-lg bg-amber-50/70 dark:bg-amber-950/40 border border-amber-200/60 dark:border-amber-800/60">
                          <div className="text-[9.5px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                            Evaporated Mass Loss ({evaporationPct}%)
                          </div>
                          <div className="text-sm sm:text-base font-mono font-black text-amber-950 dark:text-amber-200 mt-0.5">
                            {evaporationApplied ? `-${formatIndian(liveEvaporationResult.evaporatedMl)}` : '0'} ml
                          </div>
                          <div className="text-[10px] font-mono text-amber-700 dark:text-amber-300">
                            Base: {formatIndian(liveEvaporationResult.evaporationBaseMl)} ml eligible
                          </div>
                        </div>

                        <div className="p-2.5 rounded-lg bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200/60 dark:border-emerald-800/60">
                          <div className="text-[9.5px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                            Mix After Evaporation
                          </div>
                          <div className="text-sm sm:text-base font-mono font-black text-emerald-950 dark:text-emerald-200 mt-0.5">
                            {formatIndian(liveEvaporationResult.mixAfterEvapMl)} ml
                          </div>
                          <div className="text-[10px] font-mono text-emerald-700 dark:text-emerald-300">
                            ≈ {formatIndian(liveEvaporationResult.mixAfterEvapL ?? round2(liveEvaporationResult.mixAfterEvapMl / 1000))} Litres available
                          </div>
                        </div>
                      </div>

                    </div>
                  </Card>

                  {/* Right (1 col): Side Panel "Material Status" */}
                  <Card className="border border-slate-200 dark:border-slate-800 shadow-xs bg-white dark:bg-slate-900 rounded-lg overflow-hidden flex flex-col">
                    <div className="px-3 py-1.5 bg-slate-50/70 dark:bg-slate-800/40 border-b border-slate-200 dark:border-slate-800">
                      <h4 className="text-[11px] font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                        Side Panel: Material Status
                      </h4>
                      <p className="text-[9.5px] text-slate-400">
                        Post-evaporation volume vs Remaining warehouse stock
                      </p>
                    </div>

                    <div className="flex-1 overflow-y-auto p-2 divide-y divide-slate-100 dark:divide-slate-800">
                      {(isViewMode 
                        ? liveEvaporationResult.lines.filter(l => Number(l.takenQty || 0) > 0 || (Array.isArray(l.allocatedBatches) && l.allocatedBatches.length > 0))
                        : liveEvaporationResult.lines
                      ).map((line, idx) => {
                        const rawMl = Number(line.takenMl ?? line.requiredMl ?? 0);
                        const isEvap = Boolean(line.evaporates);
                        let postMl = Number(line.takenMlAfterEvap ?? line.postEvapMl ?? 0);
                        if (postMl <= 0 && rawMl > 0) {
                          postMl = (isEvap && evaporationApplied) ? Math.max(0, rawMl * (1 - (evaporationPct / 100))) : rawMl;
                        }
                        const displayMl = postMl > 0 ? postMl : rawMl;
                        
                        const hasAlloc = Array.isArray(line.allocatedBatches) && line.allocatedBatches.length > 0;
                        const allocAmount = hasAlloc 
                          ? line.allocatedBatches.reduce((s, b) => s + Number(b.allocatedQty || 0), 0)
                          : Number(line.availableQty || 0);
                        const taken = Number(line.takenQty || 0) > 0 ? Number(line.takenQty) : Number(line.requiredQty || 0);
                        const remInProd = Number((allocAmount - taken).toFixed(3));
                        const warehouseTotalStock = Number(line.warehouseStock ?? line.currentStock ?? 0);
                        const remStock = Number((warehouseTotalStock - taken).toFixed(3));

                        return (
                          <div key={`merge-rm-${line.rawMaterialId || 'rm'}-${idx}`} className="py-1.5 first:pt-0.5 last:pb-0.5 text-xs space-y-1 border-b last:border-b-0 border-slate-100 dark:border-slate-800">
                            <div className="flex items-center justify-between font-bold text-slate-800 dark:text-slate-200 text-[11px]">
                              <span className="truncate max-w-[130px] font-semibold">{line.rawMaterialName}</span>
                              <div className="text-right">
                                <span className="font-mono text-emerald-600 dark:text-emerald-400 font-black text-xs">
                                  {formatIndian(displayMl)} ml
                                </span>
                                {isEvap && evaporationApplied && (
                                  <span className="block text-[8.5px] text-amber-600 dark:text-amber-400 font-semibold">
                                    (-{evaporationPct}% evap)
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-1 text-[10px] text-slate-500 bg-slate-50 dark:bg-slate-800/40 p-1 rounded">
                              <div>
                                <span className="text-[9px] text-slate-400 block">Warehouse Stock:</span>
                                <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                                  {formatIndian(warehouseTotalStock)} {formatCleanUom(line.uom, 'kg', line)}
                                </span>
                              </div>
                              <div className="text-right">
                                <span className="text-[9px] text-slate-400 block">Batch Taken:</span>
                                <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
                                  {formatIndian(taken)} {formatCleanUom(line.uom, 'kg', line)}
                                </span>
                              </div>
                            </div>

                            {/* Remaining in Current Production directly above Remaining in Warehouse Stock */}
                            <div className="flex items-center justify-between text-[10px] pt-0.5 border-t border-slate-100 dark:border-slate-800">
                              <span className="text-slate-500 font-medium">Rem in Current Production:</span>
                              <span className="font-mono font-black text-amber-600 dark:text-amber-400">
                                {formatIndian(remInProd)} {formatCleanUom(line.uom, 'kg', line)}
                              </span>
                            </div>

                            <div className="flex items-center justify-between text-[10px] pt-0.5">
                              <span className="text-slate-500 font-medium">Rem Warehouse Stock:</span>
                              <span className={`font-mono font-black ${remStock < 0 ? 'text-rose-600' : 'text-emerald-600 dark:text-emerald-400'}`}>
                                {formatIndian(remStock)} {formatCleanUom(line.uom, 'kg', line)}
                              </span>
                            </div>

                            {line.lotBatchNo && (
                              <div className="text-[9px] font-mono text-slate-400 truncate flex items-center justify-between">
                                <span>PO Lot:</span>
                                <span className="text-indigo-600 dark:text-indigo-400 font-bold truncate max-w-[120px]">{line.lotBatchNo}</span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </Card>
                </div>
              </div>

              {/* ══════════════════════════════════════════════════════════════════════════
                  STEP 3: FINISHED PRODUCTS & MOULD ALLOCATIONS (SEQUENTIAL CHAINING)
              ══════════════════════════════════════════════════════════════════════════ */}
              <div className={`${activeStep === 3 ? 'block' : 'hidden'} space-y-2`}>
                
                {/* SAP Horizon Header & KPI Facets Card (Ultra-Compact, Reduced Space) */}
                <Card className="border border-slate-200 dark:border-slate-800 shadow-xs bg-white dark:bg-slate-900 rounded-xl overflow-hidden">
                  
                  {/* Compact Header Bar */}
                  <div className="px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-5 h-5 rounded-md bg-[#8b47d7] text-white flex items-center justify-center font-bold text-xs shadow-xs shrink-0">
                        <Boxes className="w-3 h-3" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-xs sm:text-[13px] font-extrabold text-slate-900 dark:text-white uppercase tracking-tight">
                            Finished Products &amp; Mould Allocations • Day {activeDayNo}
                          </h3>
                          <span className="text-[9.5px] font-mono font-bold px-1.5 py-0.2 rounded-full bg-purple-50 text-purple-700 border border-purple-200 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800 shrink-0">
                            Sequential Chaining
                          </span>
                          {previousDaysAllocatedMl > 0 && (
                            <span className="text-[9.5px] font-mono font-bold px-1.5 py-0.2 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-950 dark:text-indigo-300 dark:border-indigo-700 shrink-0">
                              Carry-Forward Tank Mix
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-500 truncate">
                          {previousDaysAllocatedMl > 0 ? (
                            <>
                              Day {activeDayNo} available: <strong className="font-mono text-purple-600 dark:text-purple-400 font-bold">{formatIndian(availableMixMl)} ml</strong>
                              <span className="text-slate-400"> (Tank: {formatIndian(netBatchPostEvapMl)} ml − Prior Days Used: {formatIndian(previousDaysAllocatedMl)} ml)</span>
                            </>
                          ) : (
                            <>
                              Total mix available: <strong className="font-mono text-purple-600 dark:text-purple-400 font-bold">{formatIndian(availableMixMl)} ml</strong>
                              <span className="text-slate-400"> (≈ {formatIndian(round2(availableMixMl / 1000))} L after evaporation)</span>
                            </>
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {!isViewMode && (
                        <>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setItemSearchMode('PRODUCT_SINGLE');
                              setItemSearchOpen(true);
                            }}
                            className="h-6 px-2 text-[10.5px] font-bold rounded-md border-purple-300 text-purple-700 dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-950/40 cursor-pointer shadow-3xs flex items-center gap-1"
                          >
                            <Plus className="w-3 h-3" />
                            <span>+ Add Product</span>
                          </Button>

                          <Button
                            type="button"
                            size="sm"
                            disabled={savingAllocations || savingCompletedDay}
                            onClick={handleSaveAllocations}
                            className="h-6 px-2.5 text-[10.5px] font-bold rounded-md bg-[#0070f2] hover:bg-blue-600 text-white cursor-pointer shadow-3xs flex items-center gap-1"
                          >
                            {(savingAllocations || savingCompletedDay) ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                            <span>{isEditingCompletedDay ? `Save Day ${activeDayNo} Changes` : 'Save Allocations'}</span>
                          </Button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* SAP Horizon 4-Facet KPI Strip (Hairline Divided, Ultra-Compact) */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-slate-200 dark:divide-slate-800 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/60">
                    <div className="p-1.5 px-3 flex flex-col justify-center">
                      <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 leading-tight">Total Mix Available</span>
                      <div className="flex items-baseline gap-1.5 mt-0.5">
                        <strong className="text-xs sm:text-[13px] font-mono font-black text-purple-700 dark:text-purple-300 leading-tight">
                          {formatIndian(availableMixMl, 2)} ml
                        </strong>
                        <span className="text-[9.5px] text-slate-400 font-mono">≈ {(availableMixMl / 1000).toFixed(2)} L</span>
                      </div>
                    </div>

                    {canViewCost ? (
                      <div className="p-1.5 px-3 flex flex-col justify-center">
                        <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 leading-tight">Base Mix Cost (Spent)</span>
                        <div className="flex items-baseline gap-1.5 mt-0.5">
                          <strong className="text-xs sm:text-[13px] font-mono font-black text-slate-900 dark:text-white leading-tight">
                            ₹{formatIndian(round2(totalBaseMixCost))}
                          </strong>
                          <span className="text-[9.5px] text-emerald-600 dark:text-emerald-400 font-mono font-bold">₹{baseCostPerMl.toFixed(4)}/ml</span>
                        </div>
                      </div>
                    ) : (
                      <div className="p-1.5 px-3 flex flex-col justify-center">
                        <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 leading-tight">Chained Products</span>
                        <div className="flex items-baseline gap-1.5 mt-0.5">
                          <strong className="text-xs sm:text-[13px] font-mono font-black text-slate-900 dark:text-white leading-tight">
                            {allocations.length} Products
                          </strong>
                          <span className="text-[9.5px] text-slate-400 font-mono">Sequential Allocation</span>
                        </div>
                      </div>
                    )}

                    <div className="p-1.5 px-3 flex flex-col justify-center">
                      <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 leading-tight">Base Mix Allocated</span>
                      <div className="flex items-baseline gap-1.5 mt-0.5">
                        <strong className="text-xs sm:text-[13px] font-mono font-black text-[#0070f2] dark:text-blue-400 leading-tight">
                          {formatIndian(totalAllocatedBaseMl, 2)} ml
                        </strong>
                        <span className="text-[9.5px] text-slate-400 font-mono">
                          ({availableMixMl > 0 ? ((totalAllocatedBaseMl / availableMixMl) * 100).toFixed(1) : 0}%)
                        </span>
                      </div>
                    </div>

                    <div className="p-1.5 px-3 flex flex-col justify-center">
                      <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 leading-tight">Unallocated Balance</span>
                      <div className="flex items-baseline gap-1.5 mt-0.5">
                        <strong className={`text-xs sm:text-[13px] font-mono font-black leading-tight ${
                          unallocatedRemainingMl < 0 ? 'text-[#d20a0a]' : (unallocatedRemainingMl === 0 ? 'text-[#30914c]' : 'text-purple-600 dark:text-purple-400')
                        }`}>
                          {formatIndian(unallocatedRemainingMl, 2)} ml
                        </strong>
                        <span className={`text-[8.5px] font-mono font-bold px-1 py-0.2 rounded border ${
                          unallocatedRemainingMl < 0 
                            ? 'bg-rose-50 text-rose-700 border-rose-300 dark:bg-rose-950 dark:text-rose-300' 
                            : (unallocatedRemainingMl === 0 
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300' 
                                : 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950 dark:text-purple-300')
                        }`}>
                          {unallocatedRemainingMl < 0 ? 'Deficit' : (unallocatedRemainingMl === 0 ? 'Fully Allocated ✓' : 'To Allocate')}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Micro Progress Line (Sleek Hairline Bar) */}
                  <div className="w-full h-1 bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-300 ${
                        unallocatedRemainingMl < 0 ? 'bg-[#d20a0a]' : (unallocatedRemainingMl === 0 ? 'bg-[#30914c]' : 'bg-[#0070f2]')
                      }`}
                      style={{
                        width: `${availableMixMl > 0 ? Math.min(100, (totalAllocatedBaseMl / availableMixMl) * 100) : 0}%`
                      }}
                    />
                  </div>
                </Card>

                {/* ══════════════════════════════════════════════════════════════════════
                    STEP 3 FINISHED PRODUCTS MASTER-DETAIL WORKSPACE (SIDEBAR & RESPONSIVE)
                ══════════════════════════════════════════════════════════════════════ */}
                {(() => {
                  const activeStep3Index = Math.max(0, Math.min(selectedStep3Index, Math.max(0, allocations.length - 1)));
                  const filteredAllocations = allocations.map((a, i) => ({ ...a, originalIndex: i })).filter(a => {
                    if (!step3SearchFilter.trim()) return true;
                    const q = step3SearchFilter.toLowerCase();
                    return (a.productName && a.productName.toLowerCase().includes(q)) ||
                           (a.productCode && a.productCode.toLowerCase().includes(q)) ||
                           (a.mouldCode && a.mouldCode.toLowerCase().includes(q)) ||
                           String(a.originalIndex + 1).includes(q);
                  });

                  const renderProductCard = (alloc, idx, isSidebarMode = false) => {
                    if (!alloc) return null;
                    const liveAlloc = liveAllocationsResult?.allocations?.[idx] || {};
                    const productMatch = availableProducts.find(p => p.id === alloc.productId);
                    const isMould = alloc.useMould !== false;
                    const prodUom = isMould ? 'pcs' : (alloc.bulkUom || alloc.productUom || 'Liter');
                    const bulkUom = alloc.bulkUom || (prodUom === 'pcs' ? 'Liter' : prodUom);

                    // Product RMs volume calculation (only items marked addToMix contribute to mix volume)
                    const productRms = Array.isArray(alloc.productRms) ? alloc.productRms : [];
                    const addedRmVolumeMl = productRms.reduce((sum, prm) => {
                      return sum + getPrmMixMl(prm);
                    }, 0);

                    const prevAllocatedBaseMl = allocations.slice(0, idx).reduce((sum, a) => sum + Number(a.allocatedBaseMl || a.mixUsedMl || 0), 0);
                    const baseMl = Number(alloc.allocatedBaseMl || alloc.mixUsedMl || 0);
                    const cumulativeAllocatedBaseMl = prevAllocatedBaseMl + baseMl;
                    const availableBeforeThis = Math.max(0, availableMixMl - prevAllocatedBaseMl);
                    const remainingAfterThis = availableMixMl - cumulativeAllocatedBaseMl;
                    const productSharePct = availableMixMl > 0 ? ((baseMl / availableMixMl) * 100).toFixed(1) : '0.0';
                    const productTotalMixMl = baseMl + addedRmVolumeMl;

                    // Costing distribution based on consumption level
                    const assignedBaseCost = baseMl * baseCostPerMl;
                    const productRmCost = productRms.reduce((sum, prm) => {
                      const qty = Number(prm.takenQty ?? prm.qty ?? prm.requiredQty ?? 0);
                      const rate = Number(prm.unitRate || 0);
                      return sum + (Number(prm.totalCost) > 0 ? Number(prm.totalCost) : (qty * rate));
                    }, 0);
                    const totalProductCost = assignedBaseCost + productRmCost;

                    // Dynamic Waste & Usable Mix Calculation
                    const cap = Number(alloc.capacityMl || 50);
                    const cav = Number(alloc.cavities || 42);
                    const wasteVal = Number(alloc.wasteValue ?? 0);
                    const wasteMode = alloc.wasteMode || 'PERCENT';
                    let calculatedWasteMl = 0;
                    if (wasteMode === 'PERCENT' || wasteMode === '%') {
                      calculatedWasteMl = (productTotalMixMl * wasteVal) / 100;
                    } else {
                      calculatedWasteMl = Number(alloc.trays || 0) > 0 ? (wasteVal * Number(alloc.trays || 0)) : wasteVal;
                    }
                    const netUsableMixMl = Math.max(0, productTotalMixMl - calculatedWasteMl);

                    // Calculated Good Units (Live Pieces Yield)
                    let goodUnits = 0;
                    if (isMould) {
                      if (liveAlloc.theoreticalGoodPieces !== undefined && liveAlloc.theoreticalGoodPieces !== null) {
                        goodUnits = Number(liveAlloc.theoreticalGoodPieces);
                      } else if (liveAlloc.goodPieces !== undefined && liveAlloc.goodPieces !== null && Number(liveAlloc.goodPieces) > 0) {
                        goodUnits = Number(liveAlloc.goodPieces);
                      } else if (cap > 0 && netUsableMixMl > 0) {
                        goodUnits = Math.floor((netUsableMixMl + 1e-4) / cap);
                      } else if (Number(alloc.trays || 0) > 0) {
                        goodUnits = Number(alloc.trays) * cav;
                      } else {
                        goodUnits = Number(alloc.goodPieces || 0);
                      }
                    } else {
                      const uomLower = bulkUom.toLowerCase();
                      let unitMl = 1000;
                      if (uomLower.includes('gallon')) unitMl = 2000;
                      else if (uomLower.includes('tub')) unitMl = 5000;
                      else if (uomLower.includes('can')) unitMl = 20000;
                      if (liveAlloc.theoreticalGoodPieces !== undefined && liveAlloc.theoreticalGoodPieces !== null) {
                        goodUnits = Number(liveAlloc.theoreticalGoodPieces);
                      } else {
                        goodUnits = Number((netUsableMixMl / unitMl).toFixed(2));
                      }
                    }

                    const effectiveYield = alloc.actualYield !== undefined && alloc.actualYield !== null && alloc.actualYield !== '' && Number(alloc.actualYield) >= 0
                      ? Number(alloc.actualYield)
                      : goodUnits;

                    const costPerUnit = (effectiveYield > 0 && isFinite(totalProductCost) && totalProductCost < 1e14) ? Number((totalProductCost / effectiveYield).toFixed(2)) : 0;

                    return (
                      <Card 
                        key={`alloc-card-${alloc.productId || 'alloc'}-${idx}`}
                        className="border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 shadow-xs overflow-hidden"
                      >
                        {/* 1. Product Header */}
                        <div className="px-3 py-1.5 bg-slate-50 dark:bg-slate-950/80 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between flex-wrap gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="w-5 h-5 rounded-md bg-[#8b47d7] text-white font-mono font-black text-xs flex items-center justify-center shadow-3xs shrink-0">
                              {idx + 1}
                            </span>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-extrabold text-xs sm:text-[13px] text-slate-900 dark:text-white truncate">
                                  {alloc.productName}
                                </span>
                                <span className="font-mono text-[9px] text-slate-400 bg-slate-100 dark:bg-slate-800 px-1 py-0.2 rounded border border-slate-200 dark:border-slate-700 shrink-0">
                                  {alloc.productCode || 'FP'}
                                </span>
                                <span className="font-mono text-[9px] font-bold px-1.5 py-0.2 rounded bg-purple-50 text-purple-700 border border-purple-200 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800 shrink-0">
                                  {prodUom}
                                </span>
                              </div>
                              {/* Additive Product Batch No (DDMMYY-PRODUCT-DDMMYY) & 8-Digit Serial Number */}
                              <div className="flex items-center gap-2 flex-wrap mt-1">
                                <div className="inline-flex items-center gap-1 bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800 rounded px-1.5 py-0.2">
                                  <span className="text-[8.5px] font-bold uppercase text-slate-400">Batch:</span>
                                  {isViewMode ? (
                                    <span className="font-mono text-[9.5px] font-black text-indigo-700 dark:text-indigo-300">
                                      {alloc.productBatchNo || buildProductBatchNo(dayBatchCode, alloc.productName, dayProductionDate)}
                                    </span>
                                  ) : (
                                    <input
                                      type="text"
                                      value={alloc.productBatchNo || buildProductBatchNo(dayBatchCode, alloc.productName, dayProductionDate)}
                                      onChange={(e) => handleUpdateAllocation(idx, 'productBatchNo', e.target.value.toUpperCase())}
                                      title="Editable Product Batch No (<DDMMYY>-<PRODUCTNAME>-<DDMMYY>)"
                                      className="font-mono text-[9.5px] font-black text-indigo-700 dark:text-indigo-300 bg-transparent focus:outline-none w-44 sm:w-52"
                                    />
                                  )}
                                </div>
                                <span
                                  className="inline-flex items-center gap-1 font-mono text-[9.5px] font-bold px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800"
                                  title="8-digit sequential serial number derived from Tax Settings company name + product name"
                                >
                                  <span>Serial:</span>
                                  <strong>
                                    {alloc.productSerialNo ||
                                      serialPreviewMap[alloc.productId]?.serialNo ||
                                      formatProductSerialPreview({ companyName: resolvedCompanyPrefix, productName: alloc.productName, nextSeq: 1 })}
                                  </strong>
                                </span>
                              </div>
                              {isSidebarMode && allocations.length > 1 && (
                                <span className="text-[9.5px] text-slate-400 font-mono block mt-0.5">
                                  Product #{idx + 1} of {allocations.length} in sequential mix chain
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {/* Prev / Next buttons in Sidebar Mode */}
                            {isSidebarMode && allocations.length > 1 && (
                              <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded border border-slate-200 dark:border-slate-700 text-xs mr-1">
                                <button
                                  type="button"
                                  disabled={idx === 0}
                                  onClick={() => setSelectedStep3Index(prev => Math.max(0, prev - 1))}
                                  className="px-1.5 py-0.5 rounded text-[10px] font-bold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-0.5 cursor-pointer"
                                  title="Previous Product"
                                >
                                  <ChevronLeft className="w-3 h-3" />
                                  <span className="hidden sm:inline">Prev</span>
                                </button>
                                <span className="text-slate-300 dark:text-slate-600 text-[10px] px-1">•</span>
                                <button
                                  type="button"
                                  disabled={idx === allocations.length - 1}
                                  onClick={() => setSelectedStep3Index(prev => Math.min(allocations.length - 1, prev + 1))}
                                  className="px-1.5 py-0.5 rounded text-[10px] font-bold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-0.5 cursor-pointer"
                                  title="Next Product"
                                >
                                  <span className="hidden sm:inline">Next</span>
                                  <ChevronRight className="w-3 h-3" />
                                </button>
                              </div>
                            )}

                            {/* Mould vs Bulk Storage Selector */}
                            <div className="flex items-center bg-white dark:bg-slate-900 p-0.5 rounded border border-slate-300 dark:border-slate-700 text-[10px]">
                              <button
                                type="button"
                                disabled={isViewMode}
                                onClick={() => handleUpdateAllocation(idx, 'useMould', true)}
                                className={`px-1.5 py-0.2 rounded text-[10px] font-bold transition-all ${isViewMode ? 'cursor-default' : 'cursor-pointer'} ${
                                  isMould 
                                    ? 'bg-[#8b47d7] text-white shadow-3xs' 
                                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                                }`}
                              >
                                Mould (Pcs)
                              </button>
                              <button
                                type="button"
                                disabled={isViewMode}
                                onClick={() => handleUpdateAllocation(idx, 'useMould', false)}
                                className={`px-1.5 py-0.2 rounded text-[10px] font-bold transition-all ${isViewMode ? 'cursor-default' : 'cursor-pointer'} ${
                                  !isMould 
                                    ? 'bg-[#30914c] text-white shadow-3xs' 
                                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                                }`}
                              >
                                Bulk (L / Gal)
                              </button>
                            </div>

                            {!isViewMode && (
                              <button
                                type="button"
                                onClick={() => handleRemoveProductAllocation(idx)}
                                className="text-slate-400 hover:text-rose-600 p-1 rounded hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                                title="Remove line item"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="p-2.5 space-y-2">
                          {/* 2. Base Mix Allocation Row (Compact SAP Horizon Bar) */}
                          <div className="p-1.5 px-2.5 rounded-lg bg-slate-50/90 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 flex items-center justify-between flex-wrap gap-1.5 text-xs">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-[9.5px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1">
                                <Droplets className="w-3.5 h-3.5 text-[#0070f2]" />
                                <span>Base Mix Allocated:</span>
                              </span>
                              <div className="flex items-center gap-1">
                                {isViewMode ? (
                                  <span className="font-mono font-black text-xs text-indigo-700 dark:text-indigo-300 px-1.5 py-0.5 rounded bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800">
                                    {formatIndian(baseMl)}
                                  </span>
                                ) : (
                                  <Input
                                    type="number"
                                    min="0"
                                    step="100"
                                    value={baseMl || ''}
                                    onChange={(e) => handleUpdateProductBaseMl(idx, parseFloat(e.target.value) || 0)}
                                    placeholder="0"
                                    className="h-6 w-24 font-mono font-black text-xs text-right border-indigo-300 dark:border-indigo-700 bg-white dark:bg-slate-900"
                                  />
                                )}
                                <span className="font-mono font-bold text-[10px] text-slate-500">ml</span>
                              </div>
                              <span className="font-mono text-[10px] font-bold text-slate-700 dark:text-slate-300 px-1 py-0.2 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                                ≈ {(baseMl / 1000).toFixed(2)} L
                              </span>
                              <span className="font-mono text-[10px] font-bold text-[#8b47d7] px-1.5 py-0.2 rounded bg-purple-50 dark:bg-purple-950/50 border border-purple-200 dark:border-purple-800">
                                {productSharePct}% of batch
                              </span>
                              <span className="text-[10px] text-slate-400 font-mono hidden md:inline">
                                • Avail before: <strong className="text-slate-700 dark:text-slate-300">{formatIndian(availableBeforeThis)} ml</strong>
                              </span>
                            </div>

                            <div className="flex items-center gap-1.5 ml-auto">
                              <span className={`font-mono text-[10px] font-bold px-1.5 py-0.2 rounded border ${
                                remainingAfterThis < 0 
                                  ? 'bg-rose-50 text-rose-700 border-rose-300 dark:bg-rose-950 dark:text-rose-300' 
                                  : (remainingAfterThis === 0 
                                      ? 'bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300' 
                                      : 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300')
                              }`}>
                                Balance: {formatIndian(remainingAfterThis, 2)} ml
                              </span>

                              {!isViewMode && unallocatedRemainingMl > 0 && (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleAllocateRemainingMix(idx)}
                                  className="h-6 px-2 text-[9.5px] font-bold border-emerald-400 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 cursor-pointer shadow-3xs flex items-center gap-1"
                                  title="Allocate entire remaining available mix to this product"
                                >
                                  <Sparkles className="w-2.5 h-2.5 text-emerald-600" />
                                  <span>Allocate Balance ({formatIndian(unallocatedRemainingMl)} ml)</span>
                                </Button>
                              )}
                            </div>
                          </div>

                          {/* 3. Product-Specific Essences & Packaging Table */}
                          <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden bg-white dark:bg-slate-900">
                            <div className="px-2.5 py-1 bg-slate-50 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between flex-wrap gap-1">
                              <span className="text-[9.5px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 flex items-center gap-1">
                                <Flame className="w-3 h-3 text-amber-500" />
                                <span>Essences, Flavours &amp; Raw Materials:</span>
                              </span>

                              {!isViewMode && (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setItemSearchMode('RM_MULTI');
                                    setTargetAllocIndex(idx);
                                    setItemSearchOpen(true);
                                  }}
                                  className="h-5 px-2 text-[9.5px] font-bold rounded border-amber-300 text-amber-800 dark:text-amber-200 hover:bg-amber-50 dark:hover:bg-amber-950/40 cursor-pointer flex items-center gap-1 shadow-3xs"
                                >
                                  <Plus className="w-2.5 h-2.5 text-amber-600" />
                                  <span>+ Add Material</span>
                                </Button>
                              )}
                            </div>

                            {(() => {
                              const displayedPrms = isViewMode 
                                ? productRms.filter(prm => Number(prm.takenQty ?? prm.qty ?? 0) > 0 || (Array.isArray(prm.allocatedBatches) && prm.allocatedBatches.length > 0))
                                : productRms;
                              return displayedPrms.length > 0 ? (
                                <div className="overflow-x-auto">
                                  <table className="w-full text-left text-xs border-collapse font-sans">
                                    <thead>
                                      <tr className="bg-slate-50/70 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400 font-bold uppercase tracking-wider text-[9px] border-b border-slate-200 dark:border-slate-800">
                                        <th className="py-1 px-2 text-center w-16" title="Check to add liquid volume into product mix. Uncheck for packing/stick/poly cover items.">
                                          +Mix (ml)
                                        </th>
                                        <th className="py-1 px-2">Ingredient / Material</th>
                                        <th className="py-1 px-2 text-right w-20">Quantity</th>
                                        <th className="py-1 px-2 text-center w-12">UOM</th>
                                        <th className="py-1 px-2 text-right w-20">Added Mix</th>
                                        <th className="py-1 px-2 min-w-[130px]">PO Batch / Lot Allocation</th>
                                        {canViewCost && <th className="py-1 px-2 text-right w-16">Rate (₹)</th>}
                                        {canViewCost && <th className="py-1 px-2 text-right w-18">Amount (₹)</th>}
                                        {!isViewMode && <th className="py-1 px-1.5 text-center w-6">✕</th>}
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                      {displayedPrms.map((prm, prmIdx) => {
                                        const isAddToMix = prm.addToMix !== undefined ? Boolean(prm.addToMix) : !isPackagingMaterial(prm);
                                        const prmVolMl = getPrmMixMl(prm);
                                        const hasBatches = Array.isArray(prm.allocatedBatches) && prm.allocatedBatches.length > 0;
                                        const lineCost = Number((prm.totalCost ?? (Number(prm.takenQty ?? prm.qty ?? 0) * Number(prm.unitRate || 0))).toFixed(2));

                                        return (
                                          <tr key={`prm-${prm.rawMaterialId || prm.rmId || prmIdx}`} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 text-[10.5px]">
                                            <td className="py-0.5 px-2 text-center">
                                              <label className={`inline-flex items-center gap-0.5 select-none ${isViewMode ? 'cursor-default' : 'cursor-pointer'}`}>
                                                <input
                                                  type="checkbox"
                                                  checked={isAddToMix}
                                                  disabled={isViewMode}
                                                  onChange={(e) => handleUpdateProductRm(idx, prmIdx, 'addToMix', e.target.checked)}
                                                  className="w-3 h-3 rounded text-amber-600 focus:ring-amber-500 cursor-pointer accent-amber-600 disabled:opacity-80"
                                                />
                                                <span className={`text-[9px] font-bold ${isAddToMix ? 'text-amber-700 dark:text-amber-400' : 'text-slate-400'}`}>
                                                  {isAddToMix ? 'Yes' : 'No'}
                                                </span>
                                              </label>
                                            </td>
                                            <td className="py-0.5 px-2">
                                              <span className="font-bold text-slate-800 dark:text-slate-200 mr-1">
                                                {prm.rawMaterialName || prm.rmName || 'Essence'}
                                              </span>
                                              <span className="font-mono text-[8.5px] text-slate-400">
                                                {prm.rawMaterialCode || prm.rmCode || 'RM'}
                                              </span>
                                            </td>
                                            <td className="py-0.5 px-2 text-right">
                                              {isViewMode ? (
                                                <span className="font-mono font-bold text-[10.5px] text-slate-800 dark:text-slate-100">
                                                  {prm.takenQty ?? prm.qty ?? 0}
                                                </span>
                                              ) : (
                                                <Input
                                                  type="number"
                                                  step="any"
                                                  value={prm.takenQty ?? prm.qty ?? ''}
                                                  onChange={(e) => handleUpdateProductRm(idx, prmIdx, 'takenQty', parseFloat(e.target.value) || 0)}
                                                  className="h-5 w-16 text-right font-mono text-[10px] px-1 ml-auto border-slate-300 dark:border-slate-700"
                                                />
                                              )}
                                            </td>
                                            <td className="py-0.5 px-2 text-center">
                                              {(() => {
                                                const master = findMaster(prm);
                                                const hasAlt = Boolean(master ? (master.hasAlternateUom && master.alternateUom) : (prm.hasAlternateUom && prm.alternateUom));
                                                const baseUom = master?.uom || master?.unitId || prm.primaryUom || 'ml';
                                                const altUom = master?.alternateUom || prm.alternateUom || 'liter';

                                                if (hasAlt && !isViewMode) {
                                                  const optBase = baseUom.toLowerCase();
                                                  const optAlt = altUom.toLowerCase();
                                                  const options = [
                                                    { value: baseUom, label: baseUom.toUpperCase() },
                                                    ...(optAlt !== optBase ? [{ value: altUom, label: altUom.toUpperCase() }] : [])
                                                  ];

                                                  if (options.length === 1 && (optBase === 'ml' || optBase === 'liter' || optBase === 'ltr')) {
                                                    if (optBase === 'ml') {
                                                      options.push({ value: 'liter', label: 'LITER' });
                                                    } else {
                                                      options.unshift({ value: 'ml', label: 'ML' });
                                                    }
                                                  }

                                                  return (
                                                    <select
                                                      value={prm.uom || baseUom}
                                                      onChange={(e) => handleUpdateProductRm(idx, prmIdx, 'uom', e.target.value)}
                                                      className="h-5 text-[9.5px] font-bold font-mono bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 rounded px-1 cursor-pointer focus:ring-1 focus:ring-indigo-500 uppercase"
                                                      title={`Base UOM: ${baseUom} | Alternate UOM: ${altUom}`}
                                                    >
                                                      {options.map(opt => (
                                                        <option key={opt.value} value={opt.value}>
                                                          {opt.label}
                                                        </option>
                                                      ))}
                                                    </select>
                                                  );
                                                }

                                                return (
                                                  <span className="font-mono text-[9px] font-bold text-slate-600 dark:text-slate-400 uppercase">
                                                    {prm.uom || baseUom}
                                                  </span>
                                                );
                                              })()}
                                            </td>
                                            <td className="py-0.5 px-2 text-right font-mono font-bold text-[10px]">
                                              {isAddToMix ? (
                                                <span className="text-amber-600 dark:text-amber-400">
                                                  +{formatIndian(prmVolMl)} ml
                                                </span>
                                              ) : (
                                                <span className="text-slate-400 text-[9px]">Packing</span>
                                              )}
                                            </td>
                                              <td className="py-0.5 px-2">
                                                {(() => {
                                                  const prmReqQty = Number(prm.takenQty ?? prm.qty ?? prm.requiredQty ?? 0);
                                                  const allocatedSum = (prm.allocatedBatches || []).reduce((s, b) => s + Number(b.allocatedQty || 0), 0);
                                                  const needsLot = !hasBatches || (prmReqQty > 0 && allocatedSum < (prmReqQty - 0.0001));
                                                  if (hasBatches) {
                                                    return (
                                                      <button
                                                        type="button"
                                                        onClick={() => openProductRmLotModal(idx, prmIdx)}
                                                        className={`px-1 py-0.2 rounded border font-mono text-[9px] cursor-pointer flex items-center gap-0.5 ${
                                                          needsLot
                                                            ? 'border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/50 hover:bg-amber-100 text-amber-900 dark:text-amber-200'
                                                            : 'border-blue-300 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 text-blue-900 dark:text-blue-300'
                                                        }`}
                                                        title={needsLot ? `Allocated ${allocatedSum} / ${prmReqQty} — Click to allocate warehouse stock lots` : 'Click to view or adjust lot allocations'}
                                                      >
                                                        <Boxes className={`w-2 h-2 ${needsLot ? 'text-amber-600' : 'text-blue-600'}`} />
                                                        <span>
                                                          {prm.allocatedBatches.length === 1
                                                            ? `#${String(prm.allocatedBatches[0].lotNumber || prm.allocatedBatches[0].internalBatchNo).replace(/^#+/, '')}`
                                                            : `${prm.allocatedBatches.length} Lots`}
                                                        </span>
                                                        <span className="opacity-75">({allocatedSum}/{prmReqQty})</span>
                                                      </button>
                                                    );
                                                  }
                                                  if (isViewMode) {
                                                    return <span className="text-[9px] text-slate-400 italic">No lots</span>;
                                                  }
                                                  return (
                                                    <button
                                                      type="button"
                                                      onClick={() => openProductRmLotModal(idx, prmIdx)}
                                                      className="px-1 py-0.2 rounded border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 text-amber-900 dark:text-amber-300 font-bold text-[9px] cursor-pointer flex items-center gap-0.5"
                                                    >
                                                      <Plus className="w-2 h-2 text-amber-600" />
                                                      <span>Allocate Lot</span>
                                                    </button>
                                                  );
                                                })()}
                                              </td>
                                            {canViewCost && (
                                              <td className="py-0.5 px-2 text-right font-mono text-[10px]">
                                                <div className="font-semibold text-slate-800 dark:text-slate-200">
                                                  ₹{Number(prm.unitRate || 0).toFixed(2)}
                                                </div>
                                                {prm.allocatedBatches?.length > 0 && prm.allocatedBatches[0].poNumber && (
                                                  <div className="text-[7.5px] text-slate-400 font-normal truncate">
                                                    PO: {prm.allocatedBatches[0].poNumber}
                                                  </div>
                                                )}
                                              </td>
                                            )}
                                            {canViewCost && (
                                              <td className="py-0.5 px-2 text-right font-mono text-[10px]">
                                                <div className="font-bold text-emerald-600 dark:text-emerald-400">
                                                  ₹{formatIndian(lineCost, 2)}
                                                  <span className="text-[7.5px] font-normal text-slate-400 block leading-tight">excl tax</span>
                                                </div>
                                                <div className="text-[8px] font-semibold text-slate-500 dark:text-slate-400">
                                                  ₹{formatIndian(lineCost * (1 + (Number(prm.taxPercent || 18) / 100)), 2)}
                                                  <span className="text-[7px] text-slate-400 ml-0.5">({prm.taxPercent || 18}% tax)</span>
                                                </div>
                                              </td>
                                            )}
                                            {!isViewMode && (
                                              <td className="py-0.5 px-1.5 text-center">
                                                <button
                                                  type="button"
                                                  onClick={() => handleRemoveProductRm(idx, prmIdx)}
                                                  className="text-slate-400 hover:text-rose-600 p-0.5 cursor-pointer"
                                                  title="Remove"
                                                >
                                                  <Trash2 className="w-2.5 h-2.5" />
                                                </button>
                                              </td>
                                            )}
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              ) : (
                                <div className="px-2 py-1 text-center text-[10px] text-slate-400 italic">
                                  No specific flavour or essence added. Base mix processed directly.
                                </div>
                              );
                            })()}

                            <div className="px-2 py-0.5 bg-slate-50/60 dark:bg-slate-950/40 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-[10px] font-mono font-bold">
                              <span className="text-slate-500">Net Liquid Mix (Base + Essences):</span>
                              <span className="text-purple-700 dark:text-purple-300">
                                {formatIndian(baseMl)} ml + {formatIndian(addedRmVolumeMl)} ml = <strong className="text-xs font-black">{formatIndian(productTotalMixMl)} ml</strong> ({isFinite(productTotalMixMl) ? ((productTotalMixMl || 0) / 1000).toFixed(2) : '0.00'} L)
                              </span>
                            </div>
                          </div>

                          {/* 4. Output Specification & Yield (Compact 6-Col Grid with Editable Actual Yield) */}
                          {isMould ? (
                            <div className="p-1.5 rounded-md bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60">
                              <div className="grid grid-cols-2 sm:grid-cols-6 gap-1.5 text-xs items-center">
                                <div>
                                  <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block mb-0.5">Mould Spec</label>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    disabled={isViewMode}
                                    onClick={() => handleOpenMouldPicker(idx)}
                                    className={`h-6 w-full px-1.5 text-[10px] font-bold rounded border-slate-300 dark:border-slate-700 truncate text-left justify-start ${isViewMode ? 'cursor-default opacity-85' : ''}`}
                                    title="Click to pick mould specification"
                                  >
                                    <Box className="w-2.5 h-2.5 text-[#8b47d7] mr-1 shrink-0" />
                                    <span className="truncate">{alloc.mouldCode || 'Pick Spec'}</span>
                                  </Button>
                                </div>

                                <div>
                                  <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">Capacity (ml)</label>
                                  <Input
                                    type="number"
                                    min="1"
                                    value={alloc.capacityMl}
                                    disabled={isViewMode}
                                    onChange={(e) => handleUpdateAllocation(idx, 'capacityMl', parseFloat(e.target.value) || 0)}
                                    className={`h-6 font-mono font-bold text-xs ${isViewMode ? 'bg-slate-100 dark:bg-slate-800 cursor-not-allowed' : ''}`}
                                  />
                                </div>

                                <div>
                                  <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-0.5" title="Number of item cavities in 1 metal mould tray">
                                    Cavities / Tray
                                  </label>
                                  <Input
                                    type="number"
                                    min="1"
                                    value={alloc.cavities}
                                    disabled={isViewMode}
                                    onChange={(e) => handleUpdateAllocation(idx, 'cavities', parseInt(e.target.value, 10) || 1)}
                                    className={`h-6 font-mono font-bold text-xs ${isViewMode ? 'bg-slate-100 dark:bg-slate-800 cursor-not-allowed' : ''}`}
                                  />
                                </div>

                                <div>
                                  <div className="flex items-center justify-between mb-0.5">
                                    <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider" title="Quantity of mould trays loaded into the freezer">
                                      Quantity (Trays)
                                    </label>
                                    {!isViewMode && (
                                      <button
                                        type="button"
                                        onClick={() => handleFillMaxTrays(idx)}
                                        className="text-[8.5px] font-bold text-[#8b47d7] hover:underline cursor-pointer"
                                        title="Fill maximum trays from available mix"
                                      >
                                        Fill Max
                                      </button>
                                    )}
                                  </div>
                                  <Input
                                    type="number"
                                    min="0"
                                    value={alloc.trays}
                                    disabled={isViewMode}
                                    onChange={(e) => {
                                      const rawVal = e.target.value;
                                      const parsed = rawVal === '' ? 0 : parseInt(rawVal, 10);
                                      handleUpdateAllocation(idx, 'trays', isNaN(parsed) ? 0 : Math.max(0, parsed));
                                    }}
                                    className={`h-6 font-mono font-black text-xs ${
                                      (Number(alloc.trays || 0) * cav * cap) > (availableMixMl > 0 ? availableMixMl : productTotalMixMl)
                                        ? 'border-rose-500 bg-rose-50/50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300'
                                        : 'border-purple-300 dark:border-purple-800'
                                    } ${isViewMode ? 'bg-slate-100 dark:bg-slate-800 cursor-not-allowed' : ''}`}
                                  />
                                  <div className="text-[8px] font-mono text-purple-600 dark:text-purple-400 font-bold truncate mt-0.5 text-right">
                                    {Number(alloc.trays || 0) > 0
                                      ? `= ${formatIndian(Number(alloc.trays) * cav, 0)} pcs`
                                      : (goodUnits > 0 ? `(Mix: ${formatIndian(goodUnits, 0)} pcs)` : '= 0 pcs')}
                                  </div>
                                </div>

                                <div>
                                  <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">
                                    Waste ({alloc.wasteMode === 'PERCENT' ? '%' : 'ml'})
                                  </label>
                                  <div className="flex items-center gap-1">
                                    <select
                                      value={alloc.wasteMode}
                                      disabled={isViewMode}
                                      onChange={(e) => handleUpdateAllocation(idx, 'wasteMode', e.target.value)}
                                      className={`h-6 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-1 text-[9.5px] font-semibold outline-none ${isViewMode ? 'cursor-not-allowed bg-slate-100 dark:bg-slate-800' : ''}`}
                                    >
                                      <option value="PERCENT">%</option>
                                      <option value="FIXED_ML_PER_TRAY">ml</option>
                                    </select>
                                    <Input
                                      type="number"
                                      step="0.1"
                                      min="0"
                                      value={alloc.wasteValue}
                                      disabled={isViewMode}
                                      onChange={(e) => handleUpdateAllocation(idx, 'wasteValue', parseFloat(e.target.value) || 0)}
                                      className={`h-6 font-mono font-bold text-xs ${isViewMode ? 'bg-slate-100 dark:bg-slate-800 cursor-not-allowed' : ''}`}
                                    />
                                  </div>
                                  <div className="text-[8px] font-mono text-slate-400 mt-0.5 text-right">
                                    {calculatedWasteMl > 0 ? `${formatIndian(calculatedWasteMl, 0)} ml waste` : '0% waste'}
                                  </div>
                                </div>

                                {/* 6. EDITABLE ACTUAL YIELD (MAIN VALUE FOR STOCK & PACKAGING) */}
                                <div className="bg-purple-50/90 dark:bg-purple-950/70 p-1.5 px-2 rounded-md border-2 border-purple-400 dark:border-purple-700 flex flex-col justify-between shadow-xs">
                                  <div className="flex items-center justify-between gap-1 mb-0.5">
                                    <span className="text-[8.5px] font-extrabold uppercase tracking-wider text-purple-900 dark:text-purple-200 flex items-center gap-0.5">
                                      <Sparkles className="w-2.5 h-2.5 text-purple-600 animate-pulse" />
                                      <span>Actual Yield *</span>
                                    </span>
                                    <span className="text-[7.5px] font-mono font-bold text-purple-600 dark:text-purple-400" title="Calculated theoretical pieces from trays & mix">
                                      Calc: {formatIndian(goodUnits, 0)} pcs
                                    </span>
                                  </div>

                                  <div className="flex items-center gap-1">
                                    <Input
                                      type="number"
                                      step="1"
                                      min="0"
                                      disabled={isViewMode}
                                      value={alloc.actualYield !== undefined && alloc.actualYield !== null ? alloc.actualYield : goodUnits}
                                      onChange={(e) => {
                                        const raw = e.target.value;
                                        const val = raw === '' ? '' : parseInt(raw, 10);
                                        handleUpdateAllocation(idx, 'actualYield', isNaN(val) ? 0 : val);
                                      }}
                                      placeholder={String(goodUnits)}
                                      className={`h-6 font-mono font-black text-xs border-purple-400 bg-white dark:bg-slate-900 text-purple-950 dark:text-purple-100 ${
                                        isViewMode ? 'bg-slate-100 dark:bg-slate-800 cursor-not-allowed' : ''
                                      }`}
                                    />
                                    <span className="text-[10px] font-bold text-purple-800 dark:text-purple-300 font-mono">pcs</span>
                                  </div>

                                  <div className="text-[7.5px] font-bold text-purple-700 dark:text-purple-300 mt-0.5 flex items-center justify-between leading-tight">
                                    <span>Updates Stock &amp; Sticks</span>
                                    {Number(alloc.actualYield ?? goodUnits) !== goodUnits && (
                                      <button
                                        type="button"
                                        onClick={() => handleUpdateAllocation(idx, 'actualYield', goodUnits)}
                                        className="text-amber-700 dark:text-amber-300 font-extrabold underline cursor-pointer"
                                        title="Reset to calculated pieces"
                                      >
                                        Reset
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="p-1.5 rounded-md bg-emerald-50/50 dark:bg-emerald-950/25 border-2 border-emerald-300 dark:border-emerald-800/70">
                              <div className="grid grid-cols-1 sm:grid-cols-4 gap-1.5 text-xs items-center">
                                <div>
                                  <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">Bulk Storage Unit</label>
                                  <select
                                    value={bulkUom}
                                    disabled={isViewMode}
                                    onChange={(e) => handleUpdateAllocation(idx, 'bulkUom', e.target.value)}
                                    className={`w-full h-6 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-1 text-xs font-bold outline-none ${isViewMode ? 'cursor-not-allowed bg-slate-100 dark:bg-slate-800' : 'cursor-pointer'}`}
                                  >
                                    <option value="Liter">Liter (1,000 ml)</option>
                                    <option value="Gallon">Gallon (2,000 ml)</option>
                                    <option value="Tub (5L)">Tub (5 Litres)</option>
                                    <option value="Can (20L)">Can (20 Litres)</option>
                                  </select>
                                </div>

                                <div>
                                  <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">Available Mix</label>
                                  <div className="font-mono font-bold text-xs text-slate-800 dark:text-slate-200 h-6 flex items-center">
                                    {formatIndian(productTotalMixMl)} ml ({isFinite(productTotalMixMl) ? ((productTotalMixMl || 0) / 1000).toFixed(2) : '0.00'} L)
                                  </div>
                                </div>

                                <div className="bg-white/80 dark:bg-slate-900/60 p-1 px-2 rounded border border-emerald-200 dark:border-emerald-800 flex flex-col justify-center">
                                  <span className="text-[8.5px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Calculated Yield</span>
                                  <div className="text-xs font-mono font-black text-emerald-800 dark:text-emerald-300">
                                    {formatIndian(goodUnits, 2)} {bulkUom}
                                  </div>
                                  <span className="text-[7.5px] text-slate-400 font-mono">Suggested from mix</span>
                                </div>

                                {/* EDITABLE ACTUAL BULK YIELD */}
                                <div className="bg-emerald-100/70 dark:bg-emerald-950/80 p-1 px-2 rounded-md border-2 border-emerald-400 dark:border-emerald-700 flex flex-col justify-between shadow-xs">
                                  <div className="flex items-center justify-between gap-1 mb-0.5">
                                    <span className="text-[8.5px] font-extrabold uppercase tracking-wider text-emerald-900 dark:text-emerald-200 flex items-center gap-0.5">
                                      <Sparkles className="w-2.5 h-2.5 text-emerald-600 animate-pulse" />
                                      <span>Actual Yield *</span>
                                    </span>
                                    <span className="text-[7.5px] font-mono font-bold text-emerald-700 dark:text-emerald-400">
                                      Sellable Stock
                                    </span>
                                  </div>

                                  <div className="flex items-center gap-1">
                                    <Input
                                      type="number"
                                      step="any"
                                      min="0"
                                      disabled={isViewMode}
                                      value={alloc.actualYield !== undefined && alloc.actualYield !== null ? alloc.actualYield : goodUnits}
                                      onChange={(e) => {
                                        const raw = e.target.value;
                                        const val = raw === '' ? '' : parseFloat(raw);
                                        handleUpdateAllocation(idx, 'actualYield', isNaN(val) ? 0 : val);
                                      }}
                                      placeholder={String(goodUnits)}
                                      className={`h-6 font-mono font-black text-xs border-emerald-400 bg-white dark:bg-slate-900 text-emerald-950 dark:text-emerald-100 ${
                                        isViewMode ? 'bg-slate-100 dark:bg-slate-800 cursor-not-allowed' : ''
                                      }`}
                                    />
                                    <span className="text-[10px] font-bold text-emerald-800 dark:text-emerald-300 font-mono">{bulkUom}</span>
                                  </div>

                                  <div className="text-[7.5px] font-bold text-emerald-700 dark:text-emerald-300 mt-0.5 flex items-center justify-between leading-tight">
                                    <span>Direct to sellable stock</span>
                                    {Number(alloc.actualYield ?? goodUnits) !== goodUnits && (
                                      <button
                                        type="button"
                                        onClick={() => handleUpdateAllocation(idx, 'actualYield', goodUnits)}
                                        className="text-amber-700 dark:text-amber-300 font-extrabold underline cursor-pointer"
                                        title="Reset to calculated bulk yield"
                                      >
                                        Reset
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* 5. Role-Protected Consumption Costing Strip */}
                          {canViewCost && (
                            <div className="px-2 py-1 rounded bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-between flex-wrap gap-1 text-[10px] font-mono select-none">
                              <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 flex-wrap">
                                <DollarSign className="w-2.5 h-2.5 text-emerald-600" />
                                <span>Base: <strong className="text-slate-900 dark:text-white">₹{formatIndian(round2(assignedBaseCost))}</strong></span>
                                <span>•</span>
                                <span>Essences: <strong className="text-amber-600 dark:text-amber-400">₹{formatIndian(round2(productRmCost))}</strong></span>
                                <span>•</span>
                                <span>Total: <strong className="text-emerald-600 dark:text-emerald-400">₹{formatIndian(round2(totalProductCost))}</strong></span>
                              </div>

                              <div className="text-slate-900 dark:text-white font-black text-[10px]">
                                Unit Cost: <span className="text-emerald-600 dark:text-emerald-400 font-bold">₹{formatIndian(costPerUnit, 2)}</span> / {isMould ? prodUom : bulkUom}
                              </div>
                            </div>
                          )}
                        </div>
                      </Card>
                    );
                  };

                  if (allocations.length === 0) {
                    return (
                      <div className="p-8 text-center text-slate-400 border border-dashed border-slate-300 dark:border-slate-800 rounded-2xl space-y-3 bg-white dark:bg-slate-900 shadow-xs">
                        <div className="w-12 h-12 rounded-2xl bg-purple-50 dark:bg-purple-950/60 text-[#8b47d7] flex items-center justify-center mx-auto shadow-xs">
                          <Boxes className="w-6 h-6" />
                        </div>
                        <div className="space-y-1">
                          <h4 className="font-extrabold text-sm text-slate-800 dark:text-slate-200">
                            {previousDaysAllocatedMl > 0
                              ? `Day ${activeDayNo} Ready — ${formatIndian(availableMixMl, 2)} ml Unallocated Base Mix Available`
                              : 'No finished products added to mould allocations yet'}
                          </h4>
                          <p className="text-xs text-slate-500 max-w-md mx-auto">
                            {previousDaysAllocatedMl > 0
                              ? `Prior completed days used ${formatIndian(previousDaysAllocatedMl, 2)} ml out of ${formatIndian(netBatchPostEvapMl, 2)} ml total tank mix. Click below to add Day ${activeDayNo} finished products.`
                              : 'Add multiple finished products (up to 14+) to allocate portions of the evaporated mix (e.g. 74,000 ml to Almond Pista, 50,000 ml to Alphonso Mango).'}
                          </p>
                        </div>
                        {!isViewMode && (
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => {
                              setItemSearchMode('PRODUCT_SINGLE');
                              setItemSearchOpen(true);
                            }}
                            className="h-8 px-4 text-xs font-bold rounded-lg bg-[#8b47d7] hover:bg-purple-700 text-white shadow-xs inline-flex items-center gap-1.5 cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>+ Add Finished Product</span>
                          </Button>
                        )}
                      </div>
                    );
                  }

                  return (
                    <div className="space-y-2">
                      {/* Top Layout Switcher & Information Strip */}
                      <div className="flex items-center justify-between px-1 flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                            Batch Product Queue: <strong className="font-mono text-[#8b47d7]">{allocations.length} Products Configured</strong>
                          </span>
                          <span className="text-[10px] text-slate-400 hidden sm:inline">•</span>
                          <span className="text-[10px] text-slate-500 hidden sm:inline">
                            Navigate between products easily via the sidebar
                          </span>
                        </div>

                        {allocations.length > 1 && (
                          <div className="flex items-center bg-slate-100 dark:bg-slate-800/80 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700">
                            <button
                              type="button"
                              onClick={() => setStep3LayoutMode('SIDEBAR')}
                              className={`px-2.5 py-0.5 rounded-md text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer ${
                                step3LayoutMode === 'SIDEBAR' 
                                  ? 'bg-[#8b47d7] text-white shadow-3xs' 
                                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                              }`}
                            >
                              <Layers className="w-3 h-3" />
                              <span>Sidebar Master-Detail</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setStep3LayoutMode('STACKED')}
                              className={`px-2.5 py-0.5 rounded-md text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer ${
                                step3LayoutMode === 'STACKED' 
                                  ? 'bg-[#8b47d7] text-white shadow-3xs' 
                                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                              }`}
                            >
                              <FileSpreadsheet className="w-3 h-3" />
                              <span>View All Stacked</span>
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Mobile Horizontal Pill Scroller (< lg screens) */}
                      {step3LayoutMode === 'SIDEBAR' && allocations.length > 1 && (
                        <div className="lg:hidden flex items-center gap-1.5 overflow-x-auto pb-1 select-none">
                          {allocations.map((a, i) => {
                            const isSel = i === activeStep3Index;
                            return (
                              <button
                                key={`mob-step3-pill-${i}`}
                                type="button"
                                onClick={() => setSelectedStep3Index(i)}
                                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 border cursor-pointer ${
                                  isSel
                                    ? 'bg-[#8b47d7] text-white border-[#8b47d7] shadow-xs ring-1 ring-purple-300'
                                    : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:border-purple-300'
                                }`}
                              >
                                <span className="w-4 h-4 rounded-full bg-white/20 flex items-center justify-center font-mono text-[9px] font-black">
                                  {i + 1}
                                </span>
                                <span className="truncate max-w-[120px]">{a.productName || `Product #${i + 1}`}</span>
                              </button>
                            );
                          })}
                          {!isViewMode && (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setItemSearchMode('PRODUCT_SINGLE');
                                setItemSearchOpen(true);
                              }}
                              className="h-7 px-2 text-xs font-bold shrink-0 border-dashed border-purple-300 text-purple-700 dark:text-purple-300 cursor-pointer"
                            >
                              <Plus className="w-3 h-3" />
                              <span>Add</span>
                            </Button>
                          )}
                        </div>
                      )}

                      {/* Layout: Master-Detail Sidebar Mode */}
                      {step3LayoutMode === 'SIDEBAR' && (
                        <div className="flex flex-col lg:flex-row gap-2.5 items-stretch min-h-[540px]">
                          {/* ── Left Sidebar (List of 1..14+ Products) ── */}
                          <div className="hidden lg:flex w-72 xl:w-80 shrink-0 flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs overflow-hidden">
                            {/* Sidebar Header with Search */}
                            <div className="p-2.5 bg-slate-50 dark:bg-slate-950/80 border-b border-slate-200 dark:border-slate-800 space-y-1.5">
                              <div className="flex items-center justify-between gap-1.5">
                                <div className="flex items-center gap-1.5">
                                  <Boxes className="w-4 h-4 text-[#8b47d7]" />
                                  <span className="font-extrabold text-xs text-slate-900 dark:text-white uppercase tracking-tight">
                                    Product Queue
                                  </span>
                                  <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded-full bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300">
                                    {allocations.length}
                                  </span>
                                </div>

                                {!isViewMode && (
                                  <Button
                                    type="button"
                                    size="sm"
                                    onClick={() => {
                                      setItemSearchMode('PRODUCT_SINGLE');
                                      setItemSearchOpen(true);
                                    }}
                                    className="h-5.5 px-2 text-[10px] font-bold rounded-md bg-[#8b47d7] hover:bg-purple-700 text-white cursor-pointer shadow-3xs flex items-center gap-1"
                                    title="Add another product to sequential mix allocation"
                                  >
                                    <Plus className="w-2.5 h-2.5" />
                                    <span>Add</span>
                                  </Button>
                                )}
                              </div>

                              {allocations.length > 2 && (
                                <div className="relative">
                                  <Search className="w-3 h-3 text-slate-400 absolute left-2 top-2" />
                                  <input
                                    type="text"
                                    value={step3SearchFilter}
                                    onChange={(e) => setStep3SearchFilter(e.target.value)}
                                    placeholder={`Filter ${allocations.length} products...`}
                                    className="w-full h-7 pl-7 pr-6 text-[10.5px] rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-purple-500"
                                  />
                                  {step3SearchFilter && (
                                    <button
                                      type="button"
                                      onClick={() => setStep3SearchFilter('')}
                                      className="absolute right-2 top-2 text-slate-400 hover:text-slate-600"
                                    >
                                      <X className="w-3 h-3" />
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>

                            {/* Scrollable Product List */}
                            <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60 p-1.5 space-y-1 max-h-[580px]">
                              {filteredAllocations.map(item => {
                                const i = item.originalIndex;
                                const isSel = i === activeStep3Index;
                                const prms = Array.isArray(item.productRms) ? item.productRms : [];
                                const hasMissingLots = prms.some(prm => {
                                  const taken = Number(prm.takenQty ?? prm.qty ?? 0);
                                  if (taken <= 0) return false;
                                  return !Array.isArray(prm.allocatedBatches) || prm.allocatedBatches.length === 0;
                                });
                                const isM = item.useMould !== false;
                                const live = liveAllocationsResult?.allocations?.[i] || {};
                                const goodPcs = Number(live.goodPieces || item.goodPieces || 0);
                                const mixMl = Number(item.allocatedBaseMl || item.mixUsedMl || 0);

                                return (
                                  <div
                                    key={`step3-side-prod-${i}`}
                                    onClick={() => setSelectedStep3Index(i)}
                                    className={`p-2 rounded-lg border transition-all cursor-pointer select-none text-left relative ${
                                      isSel
                                        ? 'bg-purple-50/90 dark:bg-purple-950/60 border-purple-400 dark:border-purple-600 shadow-xs ring-1 ring-purple-400/50'
                                        : 'bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/60 border-slate-200 dark:border-slate-800'
                                    }`}
                                  >
                                    <div className="flex items-start justify-between gap-1 mb-1">
                                      <div className="flex items-center gap-1.5 min-w-0">
                                        <span className={`w-4 h-4 rounded text-[9.5px] font-mono font-black flex items-center justify-center shrink-0 ${
                                          isSel ? 'bg-[#8b47d7] text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                                        }`}>
                                          {i + 1}
                                        </span>
                                        <strong className="text-xs font-bold text-slate-900 dark:text-white truncate block">
                                          {item.productName || 'Finished Product'}
                                        </strong>
                                      </div>

                                      {!isViewMode && (
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleRemoveProductAllocation(i);
                                          }}
                                          className="text-slate-400 hover:text-rose-600 p-0.5 rounded hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                                          title="Remove product"
                                        >
                                          <Trash2 className="w-3 h-3" />
                                        </button>
                                      )}
                                    </div>

                                    <div className="flex items-center gap-1 flex-wrap text-[9px] font-mono text-slate-500 mb-1">
                                      <span className="bg-slate-100 dark:bg-slate-800 px-1 py-0.2 rounded border border-slate-200 dark:border-slate-700">
                                        {item.productCode || 'FP'}
                                      </span>
                                      <span>•</span>
                                      <span>{isM ? (item.mouldCode || 'No Mould') : `Bulk ${item.bulkUom || 'Liter'}`}</span>
                                      {hasMissingLots && (
                                        <span className="text-amber-700 dark:text-amber-300 bg-amber-100/80 dark:bg-amber-950/80 px-1 py-0.2 rounded border border-amber-300 dark:border-amber-700 font-bold ml-auto text-[8px]">
                                          ⚠ Lot Needed
                                        </span>
                                      )}
                                    </div>

                                    <div className="flex items-center justify-between text-[10px] font-mono font-bold pt-1 border-t border-slate-100 dark:border-slate-800/80">
                                      <span className="text-purple-700 dark:text-purple-300">
                                        {formatIndian(mixMl)} ml
                                      </span>
                                      <span className="text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.2 rounded border border-emerald-200 dark:border-emerald-800">
                                        {formatIndian(goodPcs)} pcs
                                      </span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>

                            {/* Sidebar Footer Mix Summary */}
                            <div className="p-2 bg-slate-50 dark:bg-slate-950/90 border-t border-slate-200 dark:border-slate-800 text-[10px] font-mono shrink-0">
                              <div className="flex items-center justify-between text-slate-500 mb-1">
                                <span>Batch Allocated:</span>
                                <span className="font-bold text-purple-700 dark:text-purple-300">
                                  {formatIndian(totalAllocatedBaseMl)} / {formatIndian(availableMixMl)} ml
                                </span>
                              </div>
                              <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                                <div 
                                  className={`h-full transition-all duration-300 ${
                                    unallocatedRemainingMl < 0 ? 'bg-rose-500' : (unallocatedRemainingMl === 0 ? 'bg-emerald-500' : 'bg-[#8b47d7]')
                                  }`}
                                  style={{
                                    width: `${availableMixMl > 0 ? Math.min(100, (totalAllocatedBaseMl / availableMixMl) * 100) : 0}%`
                                  }}
                                />
                              </div>
                            </div>
                          </div>

                          {/* ── Right Workspace (Active Product Configuration) ── */}
                          <div className="flex-1 min-w-0">
                            {renderProductCard(allocations[activeStep3Index], activeStep3Index, true)}
                          </div>
                        </div>
                      )}

                      {/* Layout: Stacked Cards Mode (when user toggles 'View All Stacked') */}
                      {step3LayoutMode === 'STACKED' && (
                        <div className="space-y-2">
                          {allocations.map((alloc, idx) => renderProductCard(alloc, idx, false))}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>

              {/* ══════════════════════════════════════════════════════════════════════════
                  STEP 4: FACTORY PROCESS TIMELINE SEQUENCE & STAGE PARAMETERS
              ══════════════════════════════════════════════════════════════════════════ */}
              <div className={`${activeStep === 4 ? 'block' : 'hidden'} space-y-4`}>
                <div className="border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 p-4 space-y-4 shadow-xs">
                  {/* Step Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-6 h-6 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold text-xs shadow-3xs">
                        <Layers className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                          <span>Factory Process Timeline Sequence &amp; Stage Parameters • Day {activeDayNo} ({dayBatchCode})</span>
                          {activeAllocs.length > 1 && (
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 font-bold">
                              {activeAllocs.length} End Products Added
                            </span>
                          )}
                        </h3>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          Configure thermal &amp; freezing stages, temperature &amp; duration controls per finished product quantity
                        </p>
                      </div>
                    </div>

                    {!isViewMode && (
                      <Button
                        type="button"
                        size="sm"
                        disabled={savingStages}
                        onClick={handleSaveFactoryStages}
                        className="h-7 px-3 text-xs font-bold rounded bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer shadow-3xs flex items-center gap-1.5"
                      >
                        {savingStages ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                        <span>Save Timeline &amp; Cost Parameters</span>
                      </Button>
                    )}
                  </div>

                  {/* Multi-Product Process Navigation (When 2 or more end products exist) */}
                  {activeAllocs.length > 1 && (
                    <div className="bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1">
                          <Package className="w-3.5 h-3.5 text-indigo-500" />
                          <span>End Products Process View ({activeAllocs.length} Finished Products):</span>
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          Displaying factory process for each end product quantity
                        </span>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          type="button"
                          onClick={() => setSelectedProductStageTab('ALL')}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                            selectedProductStageTab === 'ALL'
                              ? 'bg-indigo-600 text-white shadow-xs'
                              : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-750 hover:border-indigo-400'
                          }`}
                        >
                          <Boxes className="w-3.5 h-3.5" />
                          <span>All {activeAllocs.length} Products (Side-by-Side Processes)</span>
                        </button>

                        {activeAllocs.map((a, idx) => {
                          const pId = a.productId || `p_${a.seq || idx}`;
                          const isSel = selectedProductStageTab === pId;
                          const pUom = a.productUom || a.bulkUom || 'pcs';
                          const pQty = a.goodPieces || a.goodUnits || a.plannedQty || 0;
                          return (
                            <button
                              key={`prod-stage-tab-${pId}`}
                              type="button"
                              onClick={() => setSelectedProductStageTab(pId)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                                isSel
                                  ? 'bg-purple-600 text-white shadow-xs'
                                  : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-750 hover:border-purple-400'
                              }`}
                            >
                              <span className="w-4 h-4 rounded-full bg-black/20 text-white text-[9.5px] flex items-center justify-center font-bold">
                                #{a.seq || (idx + 1)}
                              </span>
                              <span>{a.productName}</span>
                              <span className="text-[10px] opacity-80 font-mono">
                                ({formatIndian(pQty)} {pUom})
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* 2 End Products / Multi-Product Display */}
                  {activeAllocs.length > 1 && selectedProductStageTab === 'ALL' ? (
                    <div className="space-y-4">
                      {activeAllocs.map((a, idx) => {
                        const pId = a.productId || `p_${a.seq || idx}`;
                        const pStages = productStagesMap[pId] || timelineStages;
                        const pUom = a.productUom || a.bulkUom || 'pcs';
                        const pQty = a.goodPieces || a.goodUnits || a.plannedQty || 0;
                        const pMix = Number(a.allocatedBaseMl || a.mixUsedMl || 0);

                        return (
                          <div key={`multi-proc-view-${pId}`} className="border-2 border-indigo-100 dark:border-indigo-950/80 rounded-xl p-3.5 bg-indigo-50/20 dark:bg-indigo-950/10 space-y-3">
                            <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-indigo-100 dark:border-indigo-900/50">
                              <div className="flex items-center gap-2">
                                <span className="w-6 h-6 rounded-lg bg-indigo-600 text-white font-mono font-bold text-xs flex items-center justify-center shadow-3xs">
                                  #{a.seq || (idx + 1)}
                                </span>
                                <div>
                                  <h4 className="font-extrabold text-xs sm:text-sm text-slate-900 dark:text-white flex items-center gap-2">
                                    <span>{a.productName}</span>
                                    <span className="font-mono text-[10px] text-slate-400 font-normal">({a.productCode || 'FP'})</span>
                                  </h4>
                                  <div className="flex items-center gap-3 text-[11px] font-mono text-slate-500 mt-0.5">
                                    <span>Target Product Quantity: <strong className="text-emerald-600 dark:text-emerald-400 font-bold">{formatIndian(pQty)} {pUom}</strong></span>
                                    {pMix > 0 && <span>Mix Volume: <strong className="text-purple-600 dark:text-purple-400 font-bold">{formatIndian(pMix)} ml</strong></span>}
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300">
                                  {pStages.length} Factory Process Stages
                                </span>
                              </div>
                            </div>

                            <StandardFactoryStagesPalette
                              stages={pStages}
                              onChangeStages={(newStages) => {
                                setProductStagesMap(prev => ({ ...prev, [pId]: newStages }));
                                if (activeAllocs.length <= 1) {
                                  setTimelineStages(newStages);
                                }
                              }}
                              isEditable={!isCompleted && !isViewMode}
                              stepNumber={4}
                            />
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div>
                      {/* Individual Selected Product View or Single Product View */}
                      {(() => {
                        const targetAlloc = (activeAllocs.find(a => (a.productId || `p_${a.seq}`) === selectedProductStageTab)) || activeAllocs[0];
                        const prodName = targetAlloc?.productName || batch?.product?.name || 'Finished Product';
                        const prodCode = targetAlloc?.productCode || batch?.product?.code || 'FP';
                        const prodQty = targetAlloc?.goodPieces || targetAlloc?.goodUnits || targetAlloc?.plannedQty || batch?.quantity || 2000;
                        const prodUom = targetAlloc?.productUom || targetAlloc?.bulkUom || 'pcs';
                        const targetId = targetAlloc?.productId || 'default';
                        const targetStages = productStagesMap[targetId] || timelineStages;

                        return (
                          <div className="space-y-3">
                            <div className="p-3 bg-indigo-50/60 dark:bg-indigo-950/30 rounded-xl border border-indigo-200 dark:border-indigo-800 flex items-center justify-between flex-wrap gap-2">
                              <div className="flex items-center gap-2.5">
                                <Package className="w-5 h-5 text-indigo-600 shrink-0" />
                                <div>
                                  <div className="font-extrabold text-xs sm:text-sm text-slate-900 dark:text-white flex items-center gap-2">
                                    <span>Factory Process for: <strong className="text-indigo-700 dark:text-indigo-300">{prodName}</strong></span>
                                    <span className="font-mono text-[10px] text-slate-400">({prodCode})</span>
                                  </div>
                                  <div className="text-[11px] font-mono text-slate-600 dark:text-slate-400">
                                    Target Product Quantity: <strong className="text-emerald-600 dark:text-emerald-400 font-bold">{formatIndian(prodQty)} {prodUom}</strong>
                                  </div>
                                </div>
                              </div>
                              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300">
                                {targetStages.length} Stages Configured
                              </span>
                            </div>

                            <StandardFactoryStagesPalette
                              stages={targetStages}
                              onChangeStages={(newStages) => {
                                setProductStagesMap(prev => ({ ...prev, [targetId]: newStages }));
                                if (activeAllocs.length <= 1) {
                                  setTimelineStages(newStages);
                                }
                              }}
                              isEditable={!isCompleted && !isViewMode}
                              stepNumber={4}
                            />
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  {/* ── OPERATIONAL COSTS: ELECTRICITY AMOUNT & LABOUR AMOUNT ── */}
                  <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-800 space-y-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <Zap className="w-4 h-4 text-amber-500" />
                        <h4 className="text-xs font-black uppercase text-slate-900 dark:text-white tracking-wider">
                          Operational Costs: Electricity Amount &amp; Labour Amount
                        </h4>
                      </div>
                      <span className="text-[10px] font-mono text-slate-400">
                        Enter operational charges to dynamically recalculate each product unit cost
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Card 1: Electricity / Power Amount */}
                      <div className="p-3.5 rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/40 dark:bg-amber-950/20 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                            <Zap className="w-3.5 h-3.5 text-amber-600" />
                            <span>1. Electricity / Power Amount (₹)</span>
                          </span>
                          <span className="font-mono font-black text-xs text-amber-700 dark:text-amber-300">
                            Total: ₹{electricityCost.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                              Electricity Amount (₹) *
                            </label>
                            <Input
                              type="number"
                              min="0"
                              step="any"
                              disabled={isCompleted || isViewMode}
                              value={electricityCost || ''}
                              onChange={(e) => setElectricityCost(Math.max(0, parseFloat(e.target.value) || 0))}
                              placeholder="e.g. 750"
                              className="h-8 font-mono font-bold text-xs bg-white dark:bg-slate-900 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300"
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
                              disabled={isCompleted || isViewMode}
                              value={ebRatePerUnit || ''}
                              onChange={(e) => {
                                const r = parseFloat(e.target.value) || 8.5;
                                setEbRatePerUnit(r);
                                if (ebEndReading && ebStartReading) {
                                  handleEbCalc(ebStartReading, ebEndReading, r);
                                }
                              }}
                              placeholder="8.50"
                              className="h-8 font-mono text-xs bg-white dark:bg-slate-900"
                            />
                          </div>
                        </div>

                        {/* Optional EB Meter Input */}
                        <div className="grid grid-cols-2 gap-2 pt-1 border-t border-amber-200/60 dark:border-amber-900/40">
                          <div>
                            <label className="text-[9px] text-slate-400 uppercase block">Start Reading (kWh)</label>
                            <Input
                              type="number"
                              min="0"
                              step="any"
                              disabled={isCompleted || isViewMode}
                              value={ebStartReading}
                              onChange={(e) => {
                                setEbStartReading(e.target.value);
                                if (ebEndReading) handleEbCalc(e.target.value, ebEndReading, ebRatePerUnit);
                              }}
                              placeholder="0"
                              className="h-7 text-[11px] font-mono bg-white dark:bg-slate-900"
                            />
                          </div>
                          <div>
                            <label className="text-[9px] text-slate-400 uppercase block">End Reading (kWh)</label>
                            <Input
                              type="number"
                              min="0"
                              step="any"
                              disabled={isCompleted || isViewMode}
                              value={ebEndReading}
                              onChange={(e) => {
                                setEbEndReading(e.target.value);
                                handleEbCalc(ebStartReading, e.target.value, ebRatePerUnit);
                              }}
                              placeholder="0"
                              className="h-7 text-[11px] font-mono bg-white dark:bg-slate-900"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Card 2: Labour Amount (with Multi-Product Allocation) */}
                      <div className="p-3.5 rounded-xl border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/40 dark:bg-indigo-950/20 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-indigo-900 dark:text-indigo-200 flex items-center gap-1.5">
                            <Users className="w-3.5 h-3.5 text-indigo-600" />
                            <span>2. Direct Labour Amount (₹)</span>
                          </span>
                          <span className="font-mono font-black text-xs text-indigo-700 dark:text-indigo-300">
                            Total: ₹{labourCost.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>

                        <div>
                          <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                            Total Labour Amount (₹) *
                          </label>
                          <Input
                            type="number"
                            min="0"
                            step="any"
                            disabled={isCompleted || isViewMode}
                            value={labourCost || ''}
                            onChange={(e) => handleTotalLabourChange(parseFloat(e.target.value) || 0)}
                            placeholder="e.g. 1500"
                            className="h-8 font-mono font-bold text-xs bg-white dark:bg-slate-900 border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300"
                          />
                        </div>

                        {/* Each Product's Labour Amount */}
                        {activeAllocs.length > 1 && (
                          <div className="space-y-1.5 pt-1 border-t border-indigo-200/60 dark:border-indigo-900/40">
                            <span className="text-[9.5px] font-bold text-slate-500 uppercase block">
                              Labour Amount per End Product (Live Update):
                            </span>

                            <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                              {activeAllocs.map((a, idx) => {
                                const pId = a.productId || `p_${a.seq || idx}`;
                                const pVal = productLabourMap[pId] ?? 0;
                                const pQty = Number(a.goodPieces || a.goodUnits || a.plannedQty || 1);
                                const pUom = a.productUom || a.bulkUom || 'pcs';
                                const unitRate = pQty > 0 ? (pVal / pQty) : 0;
                                const pct = labourCost > 0 ? Math.round((pVal / labourCost) * 100) : 0;

                                return (
                                  <div key={`p-labour-${pId}`} className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-indigo-100 dark:border-indigo-800 flex items-center justify-between gap-2 text-xs">
                                    <div className="min-w-0">
                                      <div className="font-bold text-slate-900 dark:text-white truncate flex items-center gap-1 text-[11px]">
                                        <span className="w-4 h-4 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 text-[9px] flex items-center justify-center font-bold">
                                          #{a.seq || (idx + 1)}
                                        </span>
                                        <span className="truncate">{a.productName}</span>
                                      </div>
                                      <div className="text-[10px] text-slate-400 font-mono">
                                        {formatIndian(pQty)} {pUom} • <strong className="text-indigo-600 dark:text-indigo-400">₹{unitRate.toFixed(2)} / {pUom}</strong> ({pct}%)
                                      </div>
                                    </div>

                                    <div className="flex items-center gap-1 shrink-0">
                                      <span className="text-[11px] font-bold font-mono text-slate-500">₹</span>
                                      <Input
                                        type="number"
                                        min="0"
                                        step="any"
                                        disabled={isCompleted || isViewMode}
                                        value={pVal || ''}
                                        onChange={(e) => handleProductLabourChange(pId, parseFloat(e.target.value) || 0)}
                                        className="h-7 w-20 text-right font-mono font-bold text-xs bg-slate-50 dark:bg-slate-800"
                                      />
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Completed Days Operational Costs Summary (Shown ONLY when not actively executing a later Day — click Day chip in header to View/Edit Day 1) */}
                    {completedDaysList.length > 0 && (!hasOpenInProgressDay || activeDayNo <= 1 || isCompleted || isViewMode) && (
                      <div className="mt-3 p-3 rounded-xl border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/30 dark:bg-indigo-950/20 space-y-2">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <span className="text-[11px] font-extrabold uppercase tracking-wider text-indigo-900 dark:text-indigo-200 flex items-center gap-1.5">
                            <History className="w-3.5 h-3.5 text-indigo-600" />
                            <span>Completed Days Operational Cost History ({completedDaysList.length} Day{completedDaysList.length > 1 ? 's' : ''})</span>
                          </span>
                          <span className="text-[10px] font-mono text-slate-500">
                            Click Edit EB &amp; Labour on any completed day to recalculate unit costs
                          </span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {completedDaysList.map(d => (
                            <div key={`st4-day-${d.id || d.dayNo}`} className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-2 text-xs">
                              <div className="min-w-0">
                                <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                                  <span className="px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-mono text-[10px]">Day {d.dayNo}</span>
                                  <span className="font-mono text-[11px] text-indigo-700 dark:text-indigo-300">{d.dayBatchCode}</span>
                                </div>
                                <div className="text-[10px] font-mono text-slate-500 mt-0.5 truncate">
                                  Yield: {d.totalOutputQty} • Mix: {formatIndian(d.allocatedMixMl, 0)} ml
                                  {canViewCost && ` • EB: ₹${formatIndian(d.ebTotalCost)} • Labour: ₹${formatIndian(d.labourTotalCost)}`}
                                </div>
                              </div>
                              {canViewCost && (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleSwitchDay(d.dayNo, 4)}
                                  className="h-7 px-2 text-[10.5px] font-bold border-indigo-300 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 shrink-0 cursor-pointer flex items-center gap-1"
                                >
                                  <Edit3 className="w-3 h-3" />
                                  <span>Edit Day {d.dayNo}</span>
                                </Button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* ══════════════════════════════════════════════════════════════════════════
                  STEP 5: QUALITY, FINANCIAL COSTING & YIELD COMPLETION
              ══════════════════════════════════════════════════════════════════════════ */}
              <div className={`${activeStep === 5 ? 'block' : 'hidden'} space-y-2`}>
                
                {/* 1. Products Chained From Batch Mix Review Summary */}
                <Card className="border border-purple-200 dark:border-purple-800/60 shadow-xs bg-white dark:bg-slate-900 rounded-lg overflow-hidden p-3 space-y-2">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800 flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded bg-purple-600 text-white text-[11px] font-bold flex items-center justify-center">
                        5
                      </span>
                      <div>
                        <h3 className="text-xs sm:text-[13px] font-extrabold text-slate-900 dark:text-white">
                          Multi-Product Output &amp; Yield Summary • Day {activeDayNo} ({dayBatchCode})
                        </h3>
                        <p className="text-[10px] text-slate-500">
                          All finished products chained from Day {activeDayNo} available mix ({formatIndian(availableMixMl)} ml)
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      {(isCompleted || isViewMode || completedDaysList.length > 0) && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setViewMode('REPORT')}
                          className="border-emerald-600 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 font-bold text-xs h-6 px-2.5 rounded flex items-center gap-1 cursor-pointer"
                        >
                          <FileSpreadsheet className="w-3 h-3 text-emerald-600" />
                          <span>View Clean Report</span>
                        </Button>
                      )}

                      {awaitingNextDayStart && !isViewMode && (
                        <Button
                          type="button"
                          size="sm"
                          disabled={nextDayLoading}
                          onClick={handleStartNextDay}
                          className="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-[11px] h-6 px-3 cursor-pointer shadow-3xs flex items-center gap-1 rounded"
                        >
                          <Play className="w-3 h-3 fill-current" />
                          <span>Start Day {completedDaysList.length + 1} ({formatIndian(remainingTankMixAfterCompletedMl)} ml left)</span>
                        </Button>
                      )}

                      {isEditingCompletedDay && !isViewMode && (
                        <Button
                          type="button"
                          size="sm"
                          disabled={savingCompletedDay}
                          onClick={() => handleSaveCompletedDayChanges()}
                          className="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-[11px] h-6 px-3 cursor-pointer shadow-3xs flex items-center gap-1 rounded"
                        >
                          {savingCompletedDay ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                          <span>Save Day {activeDayNo} Changes &amp; Recalculate</span>
                        </Button>
                      )}

                      {!isCompleted && !isViewMode && !awaitingNextDayStart && !isEditingCompletedDay && (
                        <>
                          {hasRemainingForNextDay && (
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => handleOpenYieldModal(false)}
                              className="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-[11px] h-6 px-3 cursor-pointer shadow-3xs flex items-center gap-1 rounded"
                            >
                              <CheckCircle2 className="w-3 h-3" />
                              <span>
                                Complete Day {activeDayNo} &amp; Pause ({labTestRequired ? 'Send to QC' : 'Push to Sales'})
                              </span>
                            </Button>
                          )}
                          <Button
                            type="button"
                            size="sm"
                            variant={hasRemainingForNextDay ? 'outline' : 'default'}
                            onClick={() => handleOpenYieldModal(true)}
                            className={hasRemainingForNextDay
                              ? 'border-emerald-600 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 font-bold text-[11px] h-6 px-2.5 cursor-pointer flex items-center gap-1 rounded'
                              : 'bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-[11px] h-6 px-3 cursor-pointer shadow-3xs flex items-center gap-1 rounded'}
                          >
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Finish Entire Production</span>
                          </Button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Summary Table */}
                  <div className="overflow-x-auto max-h-[300px] overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-md">
                    <table className="w-full text-left text-xs border-collapse font-sans">
                      <thead className="sticky top-0 z-10 bg-slate-100/95 dark:bg-slate-800/95 backdrop-blur-xs shadow-xs">
                        <tr className="text-slate-600 dark:text-slate-300 font-bold uppercase tracking-wider text-[9px] border-b border-slate-200 dark:border-slate-700">
                          <th className="py-1.5 px-2">Seq</th>
                          <th className="py-1.5 px-2">Product Name</th>
                          <th className="py-1.5 px-2">Batch &amp; 8-Digit Serial</th>
                          <th className="py-1.5 px-2 text-center">Live UOM</th>
                          <th className="py-1.5 px-2 text-right">Base Mix (ml)</th>
                          <th className="py-1.5 px-2 text-right">Added RM Mix (ml)</th>
                          <th className="py-1.5 px-2 text-right">Total Mix (ml)</th>
                          <th className="py-1.5 px-2 text-right">Good Output</th>
                          <th className="py-1.5 px-2 text-right">Reject Qty</th>
                          {canViewCost && <th className="py-1.5 px-2 text-right">Base Cost (₹)</th>}
                          {canViewCost && <th className="py-1.5 px-2 text-right">Added RM Cost (₹)</th>}
                          {canViewCost && <th className="py-1.5 px-2 text-right">EB + Labour (₹)</th>}
                          {canViewCost && <th className="py-1.5 px-2 text-right">Total Cost (₹)</th>}
                          {canViewCost && <th className="py-1.5 px-2 text-right text-emerald-600 font-bold">Cost/Unit (₹)</th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {liveAllocationsResult.allocations.map((a, aIdx) => {
                          const origAlloc = allocations[aIdx] || {};
                          const productMatch = availableProducts.find(p => p.id === a.productId);
                          const prodUom = a.productUom || a.uom || formatCleanUom(productMatch?.consumptionUnit || productMatch?.uom, 'pcs', productMatch);
                          const isM = a.useMould !== false;
                          const bUom = a.bulkUom || (prodUom === 'pcs' ? 'Liter' : prodUom);
                          const rowBatchNo = origAlloc.productBatchNo || buildProductBatchNo(dayBatchCode, a.productName, dayProductionDate);
                          const rowSerialNo = origAlloc.productSerialNo || serialPreviewMap[a.productId]?.serialNo || formatProductSerialPreview({ companyName: resolvedCompanyPrefix, productName: a.productName, nextSeq: 1 });

                          const prms = Array.isArray(a.productRms) ? a.productRms : [];
                          const addedMl = prms.reduce((s, r) => {
                            const isAddToMix = r.addToMix !== undefined ? Boolean(r.addToMix) : !isPackagingMaterial(r);
                            if (!isAddToMix) return s;
                            return s + toMl(r.takenQty ?? r.qty ?? 0, r.uom, r.density);
                          }, 0);
                          const bMl = Number(a.allocatedBaseMl || a.mixUsedMl || 0);
                          const totMl = bMl + addedMl;

                          const assignedBase = bMl * baseCostPerMl;
                          const assignedRm = prms.reduce((s, r) => s + (Number(r.totalCost) > 0 ? Number(r.totalCost) : (Number(r.takenQty ?? r.qty ?? 0) * Number(r.unitRate || 0))), 0);
                          const pLabour = Number((productLabourMap[a.productId] ?? (labourCost * (totMl > 0 ? (totMl / (availableMixMl || 1)) : (1 / (activeAllocs.length || 1))))) || 0);
                          const pElectricity = Number(electricityCost * (totMl > 0 ? (totMl / (availableMixMl || 1)) : (1 / (activeAllocs.length || 1))) || 0);
                          const totProdCost = assignedBase + assignedRm + pLabour + pElectricity;

                          let outQty;
                          if (isM) {
                            outQty = (origAlloc.actualYield !== undefined && origAlloc.actualYield !== null && origAlloc.actualYield !== '') ? Number(origAlloc.actualYield) : (a.goodPieces || 0);
                          } else if (origAlloc.actualYield !== undefined && origAlloc.actualYield !== null && origAlloc.actualYield !== '') {
                            outQty = Number(origAlloc.actualYield);
                          } else {
                            const uLower = bUom.toLowerCase();
                            let cap = 1000;
                            if (uLower.includes('gallon')) cap = 2000;
                            else if (uLower.includes('tub')) cap = 5000;
                            else if (uLower.includes('can')) cap = 20000;
                            outQty = Number((totMl / cap).toFixed(2));
                          }
                          const rejectQty = Number(origAlloc.rejectOutput || 0);
                          const unitC = outQty > 0 ? Number((totProdCost / outQty).toFixed(2)) : 0;

                          return (
                            <tr key={`step5-row-${a.seq || aIdx}`} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 text-[10.5px]">
                              <td className="py-1 px-2 font-mono text-slate-500">#{a.seq}</td>
                              <td className="py-1 px-2 font-bold text-slate-900 dark:text-white">
                                <div>{a.productName}</div>
                                <div className="font-mono text-[9px] text-slate-400">{a.productCode} • {isM ? `Mould: ${a.mouldCode || 'Standard'}` : `Bulk: ${bUom}`}</div>
                              </td>
                              <td className="py-1 px-2 font-mono">
                                <div className="text-[10px] font-black text-indigo-700 dark:text-indigo-300">{rowBatchNo}</div>
                                <div className="text-[9.5px] font-bold text-emerald-700 dark:text-emerald-400">{rowSerialNo}</div>
                              </td>
                              <td className="py-1 px-2 text-center">
                                <span className="font-mono font-bold bg-slate-100 dark:bg-slate-800 px-1.5 py-0.2 rounded text-[10px]">
                                  {isM ? prodUom : bUom}
                                </span>
                              </td>
                              <td className="py-1 px-2 text-right font-mono">{formatIndian(bMl)} ml</td>
                              <td className="py-1 px-2 text-right font-mono text-amber-600">+{formatIndian(addedMl)} ml</td>
                              <td className="py-1 px-2 text-right font-mono font-bold text-purple-700 dark:text-purple-300">{formatIndian(totMl)} ml</td>
                              <td className="py-1 px-2 text-right font-mono font-black text-emerald-600 dark:text-emerald-400">
                                {isEditingCompletedDay && !isViewMode ? (
                                  <div className="flex items-center justify-end gap-1">
                                    <Input
                                      type="number"
                                      min="0"
                                      step="any"
                                      value={origAlloc.actualYield !== undefined && origAlloc.actualYield !== null ? origAlloc.actualYield : outQty}
                                      onChange={(e) => {
                                        const v = e.target.value === '' ? '' : parseFloat(e.target.value);
                                        handleUpdateAllocation(aIdx, 'actualYield', Number.isNaN(v) ? 0 : v);
                                      }}
                                      className="h-6 w-20 text-right font-mono font-black text-[11px] px-1 border-emerald-400 bg-white dark:bg-slate-900"
                                    />
                                    <span className="text-[9.5px] text-slate-500">{isM ? prodUom : bUom}</span>
                                  </div>
                                ) : (
                                  <span>{outQty} {isM ? prodUom : bUom}</span>
                                )}
                              </td>
                              <td className="py-1 px-2 text-right font-mono text-rose-600 dark:text-rose-400">
                                {isEditingCompletedDay && !isViewMode ? (
                                  <Input
                                    type="number"
                                    min="0"
                                    step="any"
                                    value={origAlloc.rejectOutput ?? 0}
                                    onChange={(e) => handleUpdateAllocation(aIdx, 'rejectOutput', parseFloat(e.target.value) || 0)}
                                    className="h-6 w-16 text-right font-mono font-bold text-[11px] px-1 ml-auto border-rose-300 dark:border-rose-700 bg-white dark:bg-slate-900"
                                  />
                                ) : (
                                  <span>{rejectQty} {isM ? prodUom : bUom}</span>
                                )}
                              </td>
                              {canViewCost && <td className="py-1 px-2 text-right font-mono">₹{formatIndian(round2(assignedBase))}</td>}
                              {canViewCost && <td className="py-1 px-2 text-right font-mono">₹{formatIndian(round2(assignedRm))}</td>}
                              {canViewCost && <td className="py-1 px-2 text-right font-mono text-indigo-600">₹{formatIndian(round2(pLabour + pElectricity))}</td>}
                              {canViewCost && <td className="py-1 px-2 text-right font-mono font-bold">₹{formatIndian(round2(totProdCost))}</td>}
                              {canViewCost && <td className="py-1 px-2 text-right font-mono font-black text-emerald-600">₹{unitC}</td>}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {isEditingCompletedDay && !isViewMode && (
                    <div className="pt-1 flex items-center gap-2 flex-wrap">
                      <label className="text-[10px] font-bold uppercase text-slate-500 shrink-0">
                        Day {activeDayNo} Shift / Quality Notes:
                      </label>
                      <Input
                        type="text"
                        value={completionNotes || ''}
                        onChange={(e) => setCompletionNotes(e.target.value)}
                        placeholder={`Notes for Day ${activeDayNo}...`}
                        className="h-7 flex-1 min-w-[200px] text-xs bg-white dark:bg-slate-900"
                      />
                    </div>
                  )}
                </Card>

                {/* 2. Wastage & Carry-Forward Tank Accounting Card */}
                <Card className={`border shadow-xs rounded-lg overflow-hidden p-2.5 space-y-2 ${
                  !isFinalized && hasRemainingForNextDay
                    ? 'border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/40 dark:bg-indigo-950/20'
                    : 'border-rose-200 dark:border-rose-900/60 bg-rose-50/40 dark:bg-rose-950/20'
                }`}>
                  <div className="flex items-center justify-between">
                    <h4 className={`text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 ${
                      !isFinalized && hasRemainingForNextDay ? 'text-indigo-950 dark:text-indigo-200' : 'text-rose-950 dark:text-rose-200'
                    }`}>
                      <TrendingDown className={`w-3.5 h-3.5 ${!isFinalized && hasRemainingForNextDay ? 'text-indigo-600' : 'text-rose-600'}`} />
                      <span>
                        {!isFinalized && hasRemainingForNextDay
                          ? `Day ${activeDayNo} Process Loss & Carry-Forward Mix Balance`
                          : 'Production Wastage & Unallocated Mix Loss Accounting:'}
                      </span>
                    </h4>
                    <span className={`text-[9px] font-mono font-bold px-1.5 py-0.2 rounded border ${
                      !isFinalized && hasRemainingForNextDay
                        ? 'text-indigo-700 dark:text-indigo-300 bg-indigo-100 dark:bg-indigo-900/40 border-indigo-300 dark:border-indigo-800'
                        : 'text-rose-600 dark:text-rose-400 bg-rose-100 dark:bg-rose-900/40 border-rose-300 dark:border-rose-800'
                    }`}>
                      {!isFinalized && hasRemainingForNextDay ? `CARRY-FORWARD READY FOR DAY ${activeDayNo + 1}` : 'WASTAGE EXPENSE'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div className="bg-white dark:bg-slate-900 p-2 rounded border border-rose-200 dark:border-rose-900/40">
                      <span className="text-[9px] text-slate-500 block uppercase font-bold">Process Mould Wastage</span>
                      <strong className="text-sm font-mono font-black text-rose-700 dark:text-rose-300 block mt-0.5">
                        {formatIndian(totalProcessWasteMl)} ml
                      </strong>
                      <span className="text-[8.5px] text-slate-400 font-mono">Spill &amp; tray loss</span>
                    </div>

                    <div className={`bg-white dark:bg-slate-900 p-2 rounded border ${
                      !isFinalized && hasRemainingForNextDay ? 'border-indigo-300 dark:border-indigo-800' : 'border-rose-200 dark:border-rose-900/40'
                    }`}>
                      <span className="text-[9px] text-slate-500 block uppercase font-bold">Unallocated Remaining Mix</span>
                      <strong className={`text-sm font-mono font-black block mt-0.5 ${
                        !isFinalized && hasRemainingForNextDay ? 'text-indigo-700 dark:text-indigo-300' : 'text-rose-700 dark:text-rose-300'
                      }`}>
                        {formatIndian(Math.max(0, unallocatedRemainingMl))} ml
                      </strong>
                      <span className={`text-[8.5px] font-medium ${!isFinalized && hasRemainingForNextDay ? 'text-indigo-600' : 'text-rose-600'}`}>
                        {!isFinalized && hasRemainingForNextDay ? `Saved for Day ${activeDayNo + 1} (Not Lost)` : 'Auto-moved to Wastage'}
                      </span>
                    </div>

                    <div className="bg-white dark:bg-slate-900 p-2 rounded border border-rose-200 dark:border-rose-900/40">
                      <span className="text-[9px] text-slate-500 block uppercase font-bold">Total Wastage Volume</span>
                      <strong className="text-sm font-mono font-black text-rose-700 dark:text-rose-300 block mt-0.5">
                        {formatIndian(totalWastageMl)} ml
                      </strong>
                      <span className="text-[8.5px] text-slate-400 font-mono">≈ {(totalWastageMl / 1000).toFixed(2)} Litres</span>
                    </div>

                    {canViewCost && (
                      <div className="bg-rose-900/30 p-2 rounded border border-rose-400 dark:border-rose-800">
                        <span className="text-[9px] text-rose-700 dark:text-rose-300 block uppercase font-bold">Wastage Financial Loss</span>
                        <strong className="text-sm font-mono font-black text-rose-600 dark:text-rose-400 block mt-0.5">
                          ₹{formatIndian(round2(totalWastageCost))}
                        </strong>
                        <span className="text-[8.5px] text-slate-400 font-mono">At ₹{baseCostPerMl.toFixed(4)}/ml</span>
                      </div>
                    )}
                  </div>
                </Card>

                {/* 3. QA Lab Testing Requirement Status Card */}
                <div className={`p-2.5 px-3 rounded-lg border flex items-center justify-between flex-wrap gap-2 ${
                  labTestRequired 
                    ? 'bg-amber-50 dark:bg-amber-950/20 border-amber-300 dark:border-amber-800' 
                    : 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800'
                }`}>
                  <div className="flex items-center gap-2">
                    <div className={`w-6 h-6 rounded flex items-center justify-center font-bold text-white shrink-0 ${labTestRequired ? 'bg-amber-500' : 'bg-emerald-600'}`}>
                      <ShieldCheck className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <div className="text-[11px] font-extrabold uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-1.5">
                        <span>QA / Quality Control Testing:</span>
                        <span className={`px-1.5 py-0.2 rounded text-[9.5px] font-black ${
                          labTestRequired ? 'bg-amber-200 text-amber-900' : 'bg-emerald-200 text-emerald-900'
                        }`}>
                          {labTestRequired ? 'LAB TEST REQUIRED (QUARANTINE QUEUE)' : 'NO LAB TEST REQUIRED (DIRECT TO SELLABLE STOCK)'}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        {labTestRequired 
                          ? 'Finished goods will be routed to QC Quarantine queue for microbiological sampling and clearance.' 
                          : 'Microbiological clearance is waived: finished goods automatically added to Available Sellable Inventory upon completion.'}
                      </p>
                    </div>
                  </div>

                  {!isViewMode && !isCompleted && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setLabTestRequired(prev => !prev)}
                      className="text-[10.5px] font-bold h-6 px-2.5 cursor-pointer"
                    >
                      {labTestRequired ? 'Set: Not Required (Direct to Stock)' : 'Set: Lab Test Required'}
                    </Button>
                  )}
                </div>

                {/* 4. Role-Protected Batch Costing (Admin & Supervisor Only - Light & Dark Themes) */}
                {canViewCost && costingData && (
                  <Card className="border border-slate-200 dark:border-slate-800 shadow-xs bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-lg overflow-hidden">
                    <div className="px-3.5 py-1.5 bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <DollarSign className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                          Financial Costing &amp; Live PO Rate Breakdown (Supervisor / Admin Audit)
                        </h3>
                      </div>
                      <span className="text-[9px] font-bold bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-700 px-2 py-0.2 rounded-full border">
                        LIVE PO COST AUDIT
                      </span>
                    </div>

                    <div className="p-2.5 space-y-2">
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                        <div className="bg-slate-50 dark:bg-slate-800/80 p-2 rounded border border-slate-200 dark:border-slate-700 shadow-3xs">
                          <div className="text-[9.5px] font-bold uppercase text-slate-500 dark:text-slate-400">Total Material Cost</div>
                          <div className="text-sm font-mono font-black text-slate-900 dark:text-white mt-0.5">₹{formatIndian(costingData?.totalMaterialCost ?? totalBaseMixCost)}</div>
                        </div>

                        <div className="bg-slate-50 dark:bg-slate-800/80 p-2 rounded border border-slate-200 dark:border-slate-700 shadow-3xs">
                          <div className="text-[9.5px] font-bold uppercase text-slate-500 dark:text-slate-400">Wastage Loss Cost</div>
                          <div className="text-sm font-mono font-black text-rose-600 dark:text-rose-400 mt-0.5">₹{formatIndian(costingData?.totalWastageCost ?? totalWastageCost)}</div>
                        </div>

                        <div className="bg-slate-50 dark:bg-slate-800/80 p-2 rounded border border-slate-200 dark:border-slate-700 shadow-3xs">
                          <div className="text-[9.5px] font-bold uppercase text-slate-500 dark:text-slate-400">Labour Cost</div>
                          <div className="text-sm font-mono font-black text-amber-600 dark:text-amber-300 mt-0.5">₹{formatIndian(labourCost || costingData?.labourCost || 0)}</div>
                        </div>

                        <div className="bg-slate-50 dark:bg-slate-800/80 p-2 rounded border border-slate-200 dark:border-slate-700 shadow-3xs">
                          <div className="text-[9.5px] font-bold uppercase text-slate-500 dark:text-slate-400">Utility / EB Cost</div>
                          <div className="text-sm font-mono font-black text-blue-600 dark:text-blue-300 mt-0.5">₹{formatIndian(electricityCost || costingData?.utilityCost || 0)}</div>
                        </div>

                        <div className="bg-emerald-50 dark:bg-emerald-950/80 p-2 rounded border border-emerald-300 dark:border-emerald-700 shadow-3xs">
                          <div className="text-[9.5px] font-bold uppercase text-emerald-800 dark:text-emerald-400">Total Production Cost</div>
                          <div className="text-base font-mono font-black text-emerald-950 dark:text-emerald-300 mt-0.5">
                            ₹{formatIndian(
                              (costingData?.totalMaterialCost ?? totalBaseMixCost) +
                              (costingData?.totalWastageCost ?? totalWastageCost) +
                              (labourCost || costingData?.labourCost || 0) +
                              (electricityCost || costingData?.utilityCost || 0) +
                              Number(costingData?.overheadCost ?? batch?.overheadAmt ?? 0)
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </Card>
                )}
              </div>

            </>
          )}

        </div>

        {/* ── 7. FOOTER TOOLBAR: SAP HORIZON STATUS, MESSAGE POPOVER & STEP NAVIGATION ── */}
        <div className="sticky bottom-0 z-30 flex items-center justify-between px-3 sm:px-4 py-1.5 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 text-xs select-none gap-2 shrink-0 transition-colors">
          {/* Left: SAP Message Popover Trigger */}
          <div className="relative" ref={messagesPopoverRef}>
            <button
              type="button"
              onClick={() => setShowMessagesPopover(prev => !prev)}
              className={`h-7 px-2.5 rounded border text-[11px] font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-3xs ${
                errorCount > 0
                  ? 'bg-rose-50 text-[#d20a0a] border-red-300 dark:bg-rose-950/60 dark:border-red-800'
                  : warningCount > 0
                  ? 'bg-amber-50 text-[#e9730c] border-amber-300 dark:bg-amber-950/60 dark:border-amber-800'
                  : 'bg-emerald-50 text-[#30914c] border-emerald-300 dark:bg-emerald-950/60 dark:border-emerald-800'
              }`}
            >
              {errorCount > 0 ? (
                <AlertTriangle className="w-3.5 h-3.5 text-[#d20a0a]" />
              ) : warningCount > 0 ? (
                <AlertCircle className="w-3.5 h-3.5 text-[#e9730c]" />
              ) : (
                <CheckCircle2 className="w-3.5 h-3.5 text-[#30914c]" />
              )}
              <span>
                {errorCount > 0 ? `${errorCount} Issues` : warningCount > 0 ? `${warningCount} Warnings` : 'No Issues ✓'}
              </span>
            </button>

            {/* Popover Card */}
            {showMessagesPopover && (
              <div className="absolute bottom-10 left-0 w-80 sm:w-96 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-2xl p-2.5 z-50 animate-in fade-in zoom-in-95 space-y-1.5">
                <div className="flex items-center justify-between pb-1.5 border-b border-slate-200 dark:border-slate-800">
                  <span className="font-extrabold text-[11px] text-slate-900 dark:text-white uppercase tracking-wider">
                    Message Log ({validationMessages.length})
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowMessagesPopover(false)}
                    className="text-slate-400 hover:text-slate-600 p-0.5"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>

                <div className="max-h-56 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                  {validationMessages.map(msg => (
                    <div
                      key={msg.id}
                      onClick={() => {
                        setActiveStep(msg.step);
                        setShowMessagesPopover(false);
                      }}
                      className="py-1.5 px-1 hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer rounded transition-colors space-y-0.5"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1 font-bold text-[11px]">
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            msg.type === 'error' ? 'bg-[#d20a0a]' : msg.type === 'warning' ? 'bg-[#e9730c]' : 'bg-[#0070f2]'
                          }`} />
                          <span className={msg.type === 'error' ? 'text-[#d20a0a]' : msg.type === 'warning' ? 'text-[#e9730c]' : 'text-[#0070f2]'}>
                            {msg.stepName}
                          </span>
                        </div>
                        <span className="text-[9.5px] text-slate-400 font-mono">Jump →</span>
                      </div>
                      <div className="text-[10.5px] font-semibold text-slate-800 dark:text-slate-200">
                        {msg.title}
                      </div>
                      <div className="text-[9.5px] text-slate-500">
                        {msg.desc}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right: Step Navigation & Finalize Button */}
          <div className="flex items-center gap-1.5">
            {/* Exit Cockpit */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleExitCockpit}
              className="text-xs font-bold h-7 px-3 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              Exit Cockpit
            </Button>

            {/* View Mode Switching when in Report */}
            {viewMode === 'REPORT' ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setViewMode('STEPS')}
                className="h-7 px-2.5 text-xs font-bold rounded border-indigo-400 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 flex items-center gap-1 cursor-pointer"
              >
                <Layers className="w-3 h-3" />
                <span>Return to Floor Run Steps</span>
              </Button>
            ) : isCompleted ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setViewMode('REPORT')}
                className="h-7 px-2.5 text-xs font-bold rounded border-emerald-500 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 flex items-center gap-1 cursor-pointer"
              >
                <FileSpreadsheet className="w-3 h-3 text-emerald-600" />
                <span>View Clean Report</span>
              </Button>
            ) : null}

            {/* Previous Step */}
            {viewMode === 'STEPS' && activeStep > 1 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleStepClick(activeStep - 1)}
                className="h-7 px-2.5 text-xs font-bold border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-1 cursor-pointer"
              >
                <ChevronLeft className="w-3 h-3" />
                <span>Previous</span>
              </Button>
            )}

            {/* Next Step */}
            {viewMode === 'STEPS' && activeStep < 5 && (
              <Button
                type="button"
                size="sm"
                disabled={savingProcess || savingAllocations || savingStages}
                onClick={() => handleStepClick(activeStep + 1)}
                className="h-7 px-3 text-xs font-bold bg-[#0070f2] hover:bg-blue-600 text-white flex items-center gap-1 shadow-3xs disabled:opacity-60 cursor-pointer"
              >
                {(savingProcess || savingAllocations || savingStages) ? (
                  <RefreshCw className="w-3 h-3 animate-spin" />
                ) : null}
                <span>Next: Step {activeStep + 1}</span>
                <ChevronRight className="w-3 h-3" />
              </Button>
            )}

            {/* Step 5 Footer Actions: Save Completed Day Edits vs Complete Day N vs Finish Entire Production */}
            {!isCompleted && !isViewMode && activeStep === 5 && (
              isEditingCompletedDay ? (
                <div className="flex items-center gap-1.5">
                  {Number(activeDayNo) !== Number(liveActiveDayNo) && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleReturnToActiveDay}
                      className="h-7 px-2.5 text-xs font-bold border-slate-300 dark:border-slate-700 cursor-pointer flex items-center gap-1"
                    >
                      <ChevronLeft className="w-3 h-3" />
                      <span>Back to Day {liveActiveDayNo}</span>
                    </Button>
                  )}
                  <Button
                    type="button"
                    size="sm"
                    disabled={savingCompletedDay}
                    onClick={() => handleSaveCompletedDayChanges()}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs h-7 px-3.5 cursor-pointer shadow-xs flex items-center gap-1.5"
                  >
                    {savingCompletedDay ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    <span>Save Day {activeDayNo} Changes</span>
                  </Button>
                </div>
              ) : awaitingNextDayStart ? (
                <Button
                  type="button"
                  size="sm"
                  disabled={nextDayLoading}
                  onClick={handleStartNextDay}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs h-7 px-3.5 cursor-pointer shadow-xs flex items-center gap-1.5 animate-pulse ring-2 ring-indigo-400/50"
                >
                  {nextDayLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                  <span>Start Day {completedDaysList.length + 1} (Use {formatIndian(remainingTankMixAfterCompletedMl)} ml Left)</span>
                </Button>
              ) : hasRemainingForNextDay ? (
                <div className="flex items-center gap-1.5">
                  <Button
                    type="button"
                    size="sm"
                    disabled={completing}
                    onClick={handleFinalizeEntireProductionClick}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs h-7 px-3.5 cursor-pointer shadow-xs flex items-center gap-1.5 ring-2 ring-indigo-400/40"
                    title="Complete active day yield, release to inventory/QC, and pause remaining mix for next day"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Complete Day {activeDayNo} &amp; Pause ({labTestRequired ? 'Send to QC' : 'Push to Sales'})</span>
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={completing}
                    onClick={() => handleOpenYieldModal(true)}
                    className="border-emerald-600 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 font-extrabold text-xs h-7 px-3 cursor-pointer flex items-center gap-1"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Finish Entire Production</span>
                  </Button>
                </div>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  disabled={completing}
                  onClick={handleFinalizeEntireProductionClick}
                  className="bg-[#30914c] hover:bg-emerald-700 text-white font-extrabold text-xs h-7 px-3.5 cursor-pointer shadow-xs flex items-center gap-1.5 animate-pulse ring-2 ring-emerald-400/50"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Finish Entire Production</span>
                </Button>
              )
            )}
          </div>
        </div>

      </div>

      {/* ── COCKPIT LOT ALLOCATION MODAL (Standard /production/standard/add BatchAllocationGrid design) ── */}
      {lotModalOpen && (activeLotRowIndex !== null || activeLotTarget !== null) && (() => {
        const isProductRm = activeLotTarget?.type === 'PRODUCT_RM';
        const targetItem = isProductRm
          ? allocations[activeLotTarget.allocIndex]?.productRms?.[activeLotTarget.prmIndex]
          : rmRows[activeLotRowIndex];
        const master = findMaster(targetItem);
        const itemName = targetItem?.rawMaterialName || targetItem?.rmName || targetItem?.name || master?.printName || master?.name || 'Raw Material';
        const itemCode = targetItem?.rawMaterialCode || targetItem?.rmCode || targetItem?.code || master?.code || '';
        const itemUom = formatCleanUom(targetItem?.uom, 'units', targetItem);
        const itemReq = Number(targetItem?.takenQty ?? targetItem?.requiredQty ?? targetItem?.qty ?? 0);
        const activeCategory = master?.category || targetItem?.category || (isProductRm ? 'Flavour / Essence' : 'Raw Material');
        const activeDesc = master?.description || targetItem?.description || '';
        const activeBaseUom = master?.uom || targetItem?.primaryUom || 'ml';
        const activeHasAlt = Boolean(master ? (master.hasAlternateUom && master.alternateUom) : (targetItem?.hasAlternateUom && targetItem?.alternateUom));
        const activeAltUom = master?.alternateUom || targetItem?.alternateUom || null;
        const convFactor = Number(master?.conversionFactor || targetItem?.conversionFactor || 1000);

        return (
          <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-3xl w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[92vh]">
              
              {/* Modal Header */}
              <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-start justify-between shrink-0 bg-slate-50/50 dark:bg-slate-850/50">
                <div className="space-y-1.5 flex-1 pr-4">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                      <Boxes className="w-4 h-4 text-indigo-500" />
                      <span>Allocate Stock Lots: {itemName}</span>
                    </h3>
                    {activeCategory && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                        Category: {activeCategory}
                      </span>
                    )}
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                      UOM: {itemUom}{activeHasAlt && activeAltUom ? ` / ${activeAltUom}` : ''}
                    </span>
                    {itemCode && (
                      <span className="text-[10px] font-mono text-slate-400">
                        ({itemCode})
                      </span>
                    )}
                    {isProductRm && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                        Product Flavour Addition
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Select available GRN batches (FEFO Expiry Order). Filter by specific GRN or search by batch number.
                  </p>
                  {activeDesc && (
                    <div className="mt-2 bg-amber-50/90 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-800/60 rounded-xl px-3 py-1.5 text-xs flex items-start gap-2">
                      <AlertCircle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                      <div className="text-[11px] text-amber-900 dark:text-amber-200 leading-snug">
                        <strong className="text-amber-800 dark:text-amber-300 uppercase tracking-wide text-[10px] mr-1">
                          Description / Storage Notes:
                        </strong>
                        <span>{activeDesc}</span>
                      </div>
                    </div>
                  )}
                </div>
                <button 
                  onClick={() => setLotModalOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* GRN Selector, Search Bar & Status Progress */}
              <div className="p-4 sm:p-6 border-b border-slate-100 dark:border-slate-800 space-y-3.5 shrink-0 bg-slate-50/30 dark:bg-slate-900">
                
                {/* Row 1: Source GRN Dropdown, Batch Search Input & Manual Override Toggle */}
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                  {/* GRN Dropdown */}
                  <div className="sm:col-span-5">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1 flex items-center gap-1.5">
                      <Layers className="w-3 h-3 text-indigo-500" />
                      Filter by GRN:
                    </label>
                    <select
                      value={selectedGrnFilter}
                      onChange={(e) => setSelectedGrnFilter(e.target.value)}
                      className="w-full text-xs font-bold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer shadow-2xs"
                    >
                      <option value="ALL">All GRNs ({availableLots.length} total lots available)</option>
                      {uniqueGrnList.map(g => (
                        <option key={g.grnNumber} value={g.grnNumber}>
                          {g.grnNumber} ({g.count} lot{g.count === 1 ? '' : 's'} • {g.totalQty} {itemUom})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Search Bar */}
                  <div className="sm:col-span-4">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1 flex items-center gap-1.5">
                      <Search className="w-3 h-3 text-indigo-500" />
                      Search Batches:
                    </label>
                    <div className="relative">
                      <Input
                        type="text"
                        value={lotSearchTerm}
                        onChange={(e) => setLotSearchTerm(e.target.value)}
                        placeholder="Search batch, GRN, MFG batch, supplier..."
                        className="h-9 text-xs rounded-xl bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 pl-3 pr-8 shadow-2xs font-medium"
                      />
                      {lotSearchTerm && (
                        <button
                          onClick={() => setLotSearchTerm('')}
                          className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 text-xs cursor-pointer"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Manual Override Form Toggle Button */}
                  <div className="sm:col-span-3">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowManualOverrideForm(!showManualOverrideForm)}
                      className={`w-full h-9 rounded-xl font-bold text-xs border cursor-pointer transition-all flex items-center justify-center gap-1.5 shadow-2xs ${
                        showManualOverrideForm
                          ? 'bg-amber-500 text-white border-amber-600 hover:bg-amber-600'
                          : 'border-indigo-300 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100'
                      }`}
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>{showManualOverrideForm ? 'Close Override Form' : '+ Manual Override'}</span>
                    </Button>
                  </div>
                </div>

                {/* Collapsible Manual Override Input Form */}
                {showManualOverrideForm && (
                  <div className="p-4 rounded-2xl border-2 border-indigo-300 dark:border-indigo-700 bg-white dark:bg-slate-900 shadow-md space-y-3 animate-in fade-in duration-150">
                    <div className="flex items-center justify-between border-b border-indigo-100 dark:border-slate-800 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="p-1 rounded-lg bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300">
                          <Tag className="w-3.5 h-3.5" />
                        </span>
                        <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
                          Manual Lot Override & Opening Stock Entry
                        </h4>
                      </div>
                      <span className="text-[10px] text-slate-400 font-medium">
                        All fields optional • Pre-filled with smart defaults
                      </span>
                    </div>

                    {/* 10 Fields Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 text-xs">
                      <div>
                        <div className="flex items-center justify-between mb-0.5">
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">
                            Our Batch:
                          </label>
                          {overrideForm.latestBatchNumber && (
                            <span className="text-[8px] font-mono text-indigo-600 font-bold" title="Continues after latest batch number">
                              Cont.
                            </span>
                          )}
                        </div>
                        <Input
                          type="text"
                          value={overrideForm.internalBatchNo}
                          onChange={(e) => setOverrideForm(prev => ({ ...prev, internalBatchNo: e.target.value }))}
                          placeholder="e.g. BATCH-MILKFAT4-007"
                          className="h-8 text-xs font-mono font-bold rounded-lg border-indigo-300 dark:border-indigo-700 bg-indigo-50/20"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-wider block mb-0.5">
                          GRN (Manual Override):
                        </label>
                        <Input
                          type="text"
                          value={overrideForm.grnNumber}
                          onChange={(e) => setOverrideForm(prev => ({ ...prev, grnNumber: e.target.value }))}
                          placeholder="GRN-MANUAL-OVERRIDE"
                          className="h-8 text-xs font-mono font-bold rounded-lg border-amber-300 dark:border-amber-700 bg-amber-50/20 text-amber-800 dark:text-amber-200"
                        />
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-0.5">
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">
                            PO:
                          </label>
                          {overrideForm.latestPoNumber && overrideForm.latestPoNumber !== 'PO-MANUAL-OVERRIDE' && (
                            <span className="text-[8px] font-mono text-emerald-600 font-bold">
                              Latest PO
                            </span>
                          )}
                        </div>
                        <Input
                          type="text"
                          value={overrideForm.poNumber}
                          onChange={(e) => setOverrideForm(prev => ({ ...prev, poNumber: e.target.value }))}
                          placeholder="e.g. PO-000013"
                          className="h-8 text-xs font-mono font-bold rounded-lg border-slate-300 dark:border-slate-700"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-0.5">
                          Batch Qty:
                        </label>
                        <Input
                          type="number"
                          min="1"
                          value={overrideForm.batchQty}
                          onChange={(e) => setOverrideForm(prev => ({ ...prev, batchQty: e.target.value }))}
                          placeholder="1"
                          className="h-8 text-xs font-mono font-bold rounded-lg text-center"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-0.5">
                          Weight:
                        </label>
                        <Input
                          type="text"
                          value={overrideForm.weight}
                          onChange={(e) => setOverrideForm(prev => ({ ...prev, weight: e.target.value }))}
                          placeholder="25 kg / 50"
                          className="h-8 text-xs font-mono font-bold rounded-lg"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-0.5">
                          Available Qty:
                        </label>
                        <Input
                          type="number"
                          min="0"
                          step="any"
                          value={overrideForm.availableQty}
                          onChange={(e) => setOverrideForm(prev => ({ ...prev, availableQty: e.target.value }))}
                          placeholder="4840"
                          className="h-8 text-xs font-mono font-black text-indigo-600 rounded-lg"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-0.5">
                          MFG Batch:
                        </label>
                        <Input
                          type="text"
                          value={overrideForm.supplierBatchNo}
                          onChange={(e) => setOverrideForm(prev => ({ ...prev, supplierBatchNo: e.target.value }))}
                          placeholder="BATCH-01"
                          className="h-8 text-xs font-mono font-bold rounded-lg"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-0.5">
                          MFG Date:
                        </label>
                        <Input
                          type="text"
                          value={overrideForm.mfgDate}
                          onChange={(e) => setOverrideForm(prev => ({ ...prev, mfgDate: e.target.value }))}
                          placeholder="01-10-2026"
                          className="h-8 text-xs font-mono font-bold rounded-lg"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-0.5">
                          Exp Date:
                        </label>
                        <Input
                          type="text"
                          value={overrideForm.expiryDate}
                          onChange={(e) => setOverrideForm(prev => ({ ...prev, expiryDate: e.target.value }))}
                          placeholder="01-10-2027"
                          className="h-8 text-xs font-mono font-bold rounded-lg"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-0.5">
                          Supplier:
                        </label>
                        <Input
                          type="text"
                          value={overrideForm.supplierName}
                          onChange={(e) => setOverrideForm(prev => ({ ...prev, supplierName: e.target.value }))}
                          placeholder="SUP-LOT-DIRECT"
                          className="h-8 text-xs font-mono font-medium rounded-lg"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">
                        When applied, this lot appears at the top for immediate allocation and will update on the RM Stock page.
                      </span>
                      <Button
                        type="button"
                        size="sm"
                        onClick={handleAddManualOverrideLot}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs rounded-xl shadow-xs cursor-pointer h-8"
                      >
                        <Check className="w-3.5 h-3.5 mr-1" />
                        Apply Manual Override Lot
                      </Button>
                    </div>
                  </div>
                )}

                {/* Row 2: Required vs Allocated Status Pill */}
                <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 shadow-2xs text-xs font-mono">
                  <div className="flex items-center gap-4 flex-wrap">
                    <span>
                      Required: <strong className="text-slate-900 dark:text-white font-black">{itemReq} {itemUom}</strong>
                    </span>
                    <span>•</span>
                    <span>
                      Allocated: <strong className="text-indigo-600 dark:text-indigo-400 font-black">{totalAllocatedInModal} {itemUom}</strong>
                    </span>
                    <span>•</span>
                    <span>
                      Balance: <strong className={totalAllocatedInModal >= itemReq ? 'text-emerald-600' : 'text-amber-600'}>
                        {Math.max(0, itemReq - totalAllocatedInModal).toFixed(2)} {itemUom}
                      </strong>
                    </span>
                  </div>

                  <div>
                    {totalAllocatedInModal >= itemReq ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-emerald-700 bg-emerald-50 dark:bg-emerald-950/80 dark:text-emerald-300 px-2 py-0.5 rounded-lg border border-emerald-200 dark:border-emerald-800">
                        <Check className="w-3 h-3 text-emerald-600" />
                        Fulfilled
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-amber-700 bg-amber-50 dark:bg-amber-950/80 dark:text-amber-300 px-2 py-0.5 rounded-lg border border-amber-200 dark:border-amber-800">
                        Pending Allocation
                      </span>
                    )}
                  </div>
                </div>

              </div>

              {/* Lots List Body */}
              <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">
                {loadingLots ? (
                  <div className="p-12 text-center text-xs font-bold text-slate-400 space-y-2">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto text-indigo-500" />
                    <p>Loading active inventory batches & FEFO expiry dates...</p>
                  </div>
                ) : displayedLots.length === 0 ? (
                  <div className="p-8 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 text-center space-y-2 bg-slate-50/50 dark:bg-slate-850">
                    <AlertTriangle className="w-7 h-7 text-amber-500 mx-auto" />
                    <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      No matching lots found for the current filter.
                    </p>
                    <p className="text-[11px] text-slate-400">
                      {selectedGrnFilter !== 'ALL' ? 'Try changing the GRN filter to "All GRNs" or clearing search.' : 'Material will be fulfilled from general warehouse stock or use + Manual Override above.'}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="text-[11px] font-black text-slate-500 uppercase tracking-wider flex items-center justify-between">
                      <span>Available Lots (Sorted by FEFO Expiry):</span>
                      <span>Showing {displayedLots.length} of {availableLots.length} lot{availableLots.length === 1 ? '' : 's'}</span>
                    </div>

                    <div className="space-y-3">
                      {displayedLots.map((lot, lIdx) => {
                        const lotId = lot.id || lot.internalBatchNo || `lot-${lIdx}`;
                        const avail = Number(lot.availableQty || lot.netQty || 0);
                        const currentAlloc = lotAllocations[lotId] ?? lotAllocations[lot.id] ?? lotAllocations[lot.internalBatchNo] ?? '';
                        const isExpired = lot.expiryDate && new Date(lot.expiryDate) < new Date();
                        const currentSupplierBatch = manualSupplierBatches[lotId] ?? lot.supplierBatchNo ?? lot.mfgBatchNo ?? '';
                        const rate = Number(lot.unitCost || lot.rate || lot.unitRate || targetItem?.unitRate || master?.ratePerUnit || 54);

                        return (
                          <div 
                            key={lotId}
                            className={`p-4 rounded-2xl border transition-all space-y-3 shadow-2xs ${
                              Number(currentAlloc) > 0
                                ? 'border-indigo-400 dark:border-indigo-600 bg-indigo-50/30 dark:bg-indigo-950/20 ring-1 ring-indigo-400/40'
                                : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300'
                            }`}
                          >
                            {/* Top Row: Our Batch Badge & GRN / PO Reference Badges */}
                            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-2.5">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                                  Our Batch:
                                </span>
                                <span className="inline-flex items-center gap-1.5 font-mono font-black text-xs text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/80 px-2.5 py-1 rounded-lg border border-indigo-200 dark:border-indigo-800">
                                  <Tag className="w-3 h-3 text-indigo-500" />
                                  {lot.internalBatchNo || lot.batchNumber}
                                </span>
                                {lIdx === 0 && !isExpired && (
                                  <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                                    🥇 FEFO Earliest
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 flex-wrap font-mono">
                                {lot.isManualOverride && (
                                  <span className="px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 text-[10px] font-black border border-amber-300 dark:border-amber-800">
                                    🛠 Manual Override
                                  </span>
                                )}
                                <span className="px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold border border-emerald-200 dark:border-emerald-800">
                                  GRN: {lot.grnNumber || lot.grnRef || 'GRN-OPENING'}
                                </span>
                                <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[10px] font-bold border border-slate-200 dark:border-slate-700">
                                  PO: {lot.poNumber || lot.poReferenceNo || 'Manual Override'}
                                </span>
                              </div>
                            </div>

                            {/* Grid of All Batch Details */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs bg-slate-50/70 dark:bg-slate-850 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                              <div>
                                <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider">Batch Qty:</span>
                                <span className="font-mono font-bold text-slate-800 dark:text-slate-200 text-xs">
                                  {lot.batchQty ?? 1}
                                </span>
                              </div>

                              <div>
                                <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider">Weight:</span>
                                <span className="font-mono font-bold text-slate-800 dark:text-slate-200 text-xs">
                                  {lot.weight || '25 kg / 50'}
                                </span>
                              </div>

                              <div>
                                <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider">Available Qty:</span>
                                <span className="font-mono font-black text-indigo-600 dark:text-indigo-400 text-xs block">
                                  {avail} {itemUom}
                                </span>
                                {activeHasAlt && activeAltUom && (
                                  <span className="text-[9.5px] font-mono text-slate-400 block">
                                    ≈ {Number((avail * convFactor).toFixed(2)).toLocaleString()} {activeAltUom}
                                  </span>
                                )}
                              </div>

                              <div>
                                <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider">MFG Batch:</span>
                                <span 
                                  className="font-mono font-bold text-slate-800 dark:text-slate-200 text-xs bg-slate-100 dark:bg-slate-800/80 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700 inline-block max-w-[130px] truncate select-all"
                                  title={`Manufacturer Batch: ${currentSupplierBatch || 'N/A'}`}
                                >
                                  {currentSupplierBatch || 'N/A'}
                                </span>
                              </div>

                              <div>
                                <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider">MFG Date:</span>
                                <span className="font-mono font-semibold text-slate-700 dark:text-slate-300 text-xs flex items-center gap-1">
                                  <Calendar className="w-3 h-3 text-slate-400" />
                                  {formatDateDMY(lot.mfgDate)}
                                </span>
                              </div>

                              <div>
                                <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider">Exp Date:</span>
                                <span className={`font-mono font-bold text-xs flex items-center gap-1 ${
                                  isExpired ? 'text-rose-600 dark:text-rose-400' : 'text-slate-700 dark:text-slate-300'
                                }`}>
                                  <Calendar className="w-3 h-3 text-slate-400" />
                                  {formatDateDMY(lot.expiryDate)}
                                </span>
                              </div>

                              <div>
                                <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider">PO Rate:</span>
                                <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-xs block">
                                  ₹{rate.toFixed(2)} / {itemUom}
                                </span>
                              </div>

                              {lot.supplierName && (
                                <div>
                                  <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider">Supplier:</span>
                                  <span className="text-slate-700 dark:text-slate-300 truncate block text-xs font-medium">
                                    {lot.supplierName}
                                  </span>
                                </div>
                              )}
                            </div>

                            {/* Allocation Controls: Quick Buttons + Allocate Qty Input */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleFillRemainingLot(lotId, avail)}
                                  className="h-7 text-[10px] px-2.5 rounded-lg font-bold border-indigo-200 dark:border-indigo-800 hover:bg-indigo-50 text-indigo-600 dark:text-indigo-400 cursor-pointer"
                                >
                                  Allocate Remaining
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleSetLotQty(lotId, avail, avail)}
                                  className="h-7 text-[10px] px-2 rounded-lg text-slate-500 hover:text-indigo-600 cursor-pointer"
                                >
                                  Max ({avail})
                                </Button>
                                {Number(currentAlloc) > 0 && (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleSetLotQty(lotId, 0, avail)}
                                    className="h-7 text-[10px] px-2 rounded-lg text-rose-500 hover:bg-rose-50 cursor-pointer"
                                  >
                                    Clear
                                  </Button>
                                )}
                              </div>

                              <div className="flex flex-col items-end gap-1 self-end sm:self-auto">
                                <div className="flex items-center gap-2">
                                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">
                                    Allocate Qty:
                                  </label>
                                  <div className="w-28">
                                    <Input
                                      type="number"
                                      min="0"
                                      max={avail}
                                      step="any"
                                      value={currentAlloc}
                                      onChange={(e) => handleSetLotQty(lotId, e.target.value, avail)}
                                      placeholder={`0 / ${avail}`}
                                      className="h-8 text-center font-mono font-black text-xs rounded-xl border-indigo-300 dark:border-indigo-700 focus:ring-2 focus:ring-indigo-500"
                                    />
                                  </div>
                                  <span className="text-xs font-mono font-bold text-slate-400">
                                    {itemUom}
                                  </span>
                                </div>
                                {Number(currentAlloc) > 0 && (() => {
                                  const rem = Math.max(0, avail - Number(currentAlloc));
                                  return (
                                    <div className="text-[10px] font-mono font-bold text-emerald-600 dark:text-emerald-400">
                                      Remaining: {Number(rem.toFixed(3))} {itemUom}
                                      {activeHasAlt && activeAltUom && (
                                        <span className="text-slate-400 font-normal ml-1">
                                          (≈ {Number((rem * convFactor).toFixed(2)).toLocaleString()} {activeAltUom})
                                        </span>
                                      )}
                                    </div>
                                  );
                                })()}
                              </div>
                            </div>

                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-850/80 flex items-center justify-between shrink-0">
                <span className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300">
                  Total Allocated: <strong className="text-indigo-600 dark:text-indigo-400 font-black">{totalAllocatedInModal}</strong> {itemUom}
                </span>

                <div className="flex items-center gap-2">
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setLotModalOpen(false)}
                    className="rounded-xl cursor-pointer"
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="button" 
                    size="sm" 
                    onClick={handleSaveLotAllocations}
                    disabled={totalAllocatedInModal <= 0}
                    className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold cursor-pointer shadow-xs"
                  >
                    Confirm Lot Allocations
                  </Button>
                </div>
              </div>

            </div>
          </div>
        );
      })()}

      {/* ── PRODUCTION ITEM SEARCH MODAL (FUZZY, SPACE-IGNORE, LIVE DB UOM & BATCH ALLOCATIONS) ── */}
      {itemSearchOpen && (
        <ProductionItemSearchModal
          isOpen={itemSearchOpen}
          onClose={() => {
            setItemSearchOpen(false);
            setTargetAllocIndex(null);
          }}
          mode={itemSearchMode}
          onSelectProduct={handleSelectProductForAlloc}
          onSelectRawMaterials={handleAddSelectedRMsFromModal}
        />
      )}

      {/* ── MOULD PICKER MODAL (CATEGORY TABS & VERIFIED SPECIFICATIONS) ── */}
      {mouldPickerOpen && (
        <ProductionMouldPickerModal
          isOpen={mouldPickerOpen}
          onClose={() => {
            setMouldPickerOpen(false);
            setTargetAllocIndex(null);
          }}
          moulds={mouldCatalog}
          categories={mouldCategories}
          onSelectMould={handleSelectMouldFromPicker}
        />
      )}

      {/* ── COMPLETE DAY / PRODUCTION & RECORD ACTUAL YIELD MODAL ── */}
      {showYieldModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden p-6 text-xs space-y-4 max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800 shrink-0">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    {submitFinalizeFlag
                      ? `Record Actual Yield & Finish Entire Production (Day ${activeDayNo})`
                      : `Complete Day ${activeDayNo} Yield & Pause Remaining Mix`}
                  </h3>
                  <p className="text-[10.5px] font-mono text-indigo-600 dark:text-indigo-400">
                    Day Batch No: {dayBatchCode} • {labTestRequired ? 'QC Quarantine Queue' : 'Direct Push to Sales Inventory'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowYieldModal(false)}
                className="text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white text-base font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 pr-1">
              {hasRemainingForNextDay && (
                <div className="p-3 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50/50 dark:bg-indigo-950/30 space-y-2">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <span className="font-bold text-xs text-indigo-900 dark:text-indigo-200">
                      Carry-Forward Base Mix Remaining: <span className="font-mono">{formatIndian(unallocatedRemainingMl, 2)} ml</span>
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300">
                      Choose Execution Mode
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setSubmitFinalizeFlag(false)}
                      className={`p-2 rounded-lg border text-left transition-all cursor-pointer ${
                        !submitFinalizeFlag
                          ? 'border-indigo-600 bg-white dark:bg-slate-900 ring-1 ring-indigo-500'
                          : 'border-slate-200 dark:border-slate-700 opacity-75'
                      }`}
                    >
                      <div className="font-extrabold text-[11px] text-indigo-700 dark:text-indigo-300">
                        Complete Day {activeDayNo} &amp; Pause (Recommended)
                      </div>
                      <div className="text-[10px] text-slate-500">
                        Push Day {activeDayNo} yield to {labTestRequired ? 'QC' : 'Sales'} &amp; save {formatIndian(unallocatedRemainingMl)} ml for Day {activeDayNo + 1}.
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSubmitFinalizeFlag(true)}
                      className={`p-2 rounded-lg border text-left transition-all cursor-pointer ${
                        submitFinalizeFlag
                          ? 'border-emerald-600 bg-white dark:bg-slate-900 ring-1 ring-emerald-500'
                          : 'border-slate-200 dark:border-slate-700 opacity-75'
                      }`}
                    >
                      <div className="font-extrabold text-[11px] text-emerald-700 dark:text-emerald-300">
                        Finish Entire Production Now
                      </div>
                      <div className="text-[10px] text-slate-500">
                        Close entire batch &amp; mark remaining {formatIndian(unallocatedRemainingMl)} ml as final tail loss.
                      </div>
                    </button>
                  </div>
                </div>
              )}

              {/* Product Yields List */}
              <div className="space-y-3">
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  Final Actual Good Output &amp; Batch/Serial Trace per Product:
                </label>

                {(Array.isArray(productYields) && productYields.length > 0 ? productYields : [
                  {
                    seq: 1,
                    productName: batch?.product?.name || allocations[0]?.productName || 'Finished Goods',
                    productCode: batch?.product?.code || allocations[0]?.productCode || 'FP',
                    uom: formatCleanUom(batch?.product?.consumptionUnit || allocations[0]?.productUom || 'pcs'),
                    planned: batch?.quantity || 2000,
                    calculatedYield: Number(actualYieldPieces || 2000),
                    actualGoodOutput: Number(actualYieldPieces || 2000),
                    rejectOutput: 0,
                    productBatchNo: buildProductBatchNo(dayBatchCode, batch?.product?.name || allocations[0]?.productName, dayProductionDate)
                  }
                ]).map((p, pIdx) => {
                  const previewSerial =
                    serialPreviewMap[p.productId]?.serialNo ||
                    formatProductSerialPreview({ companyName: resolvedCompanyPrefix, productName: p.productName, nextSeq: 1 });
                  return (
                  <div key={`pyield-${p.seq || pIdx}-${p.productId || pIdx}`} className="p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
                    <div className="flex items-center justify-between flex-wrap gap-1">
                      <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
                        <span className="w-5 h-5 rounded-full bg-purple-700 text-white font-mono text-[10px] flex items-center justify-center font-bold">
                          #{p.seq || (pIdx + 1)}
                        </span>
                        <span>{p.productName}</span>
                        <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 border border-purple-300 dark:border-purple-800">
                          {p.uom}
                        </span>
                      </div>
                      <span className="font-mono text-[10.5px] text-slate-400">
                        Planned: <strong className="text-slate-700 dark:text-slate-200">{p.planned} {p.uom}</strong> • Calc: <strong className="text-purple-600 dark:text-purple-400">{p.calculatedYield} {p.uom}</strong>
                      </span>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap text-[10px] font-mono">
                      <span className="px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                        Batch: <strong>{p.productBatchNo || buildProductBatchNo(dayBatchCode, p.productName, dayProductionDate)}</strong>
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                        Serial: <strong>{previewSerial}</strong>
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-1">
                      <div>
                        <label className="block text-[10.5px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                          Final Actual Good Output ({p.uom}) *
                        </label>
                        <Input
                          type="number"
                          min="0"
                          step="any"
                          value={p.actualGoodOutput ?? ''}
                          onChange={(e) => handleUpdateProductYield(pIdx, 'actualGoodOutput', parseFloat(e.target.value) || 0)}
                          className="h-9 font-mono font-black text-sm text-emerald-600 dark:text-emerald-400 border-emerald-300 dark:border-emerald-700 bg-white dark:bg-slate-900"
                        />
                      </div>
                      <div>
                        <label className="block text-[10.5px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                          Reject / Floor Loss ({p.uom})
                        </label>
                        <Input
                          type="number"
                          min="0"
                          step="any"
                          value={p.rejectOutput ?? ''}
                          onChange={(e) => handleUpdateProductYield(pIdx, 'rejectOutput', parseFloat(e.target.value) || 0)}
                          className="h-9 font-mono text-sm border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                        />
                      </div>
                    </div>
                  </div>
                );})}
              </div>

              {/* Operator Notes */}
              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">
                  Operator Completion Notes / Remarks
                </label>
                <textarea
                  rows={3}
                  value={completionNotes}
                  onChange={(e) => setCompletionNotes(e.target.value)}
                  placeholder="Enter batch completion remarks, packaging line notes, or quality observations..."
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 p-2.5 text-xs font-medium text-slate-800 dark:text-slate-100 outline-none focus:border-emerald-500"
                />
              </div>

              {/* Confirmed Operational Costs: Labour & Electricity */}
              <div className="p-3 bg-indigo-50/50 dark:bg-indigo-950/30 rounded-xl border border-indigo-200 dark:border-indigo-800 space-y-2">
                <span className="font-bold text-[11px] text-slate-700 dark:text-slate-300 uppercase tracking-wider block">
                  Day {activeDayNo} Operational Costs for Costing:
                </span>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                      Direct Labour Amount (₹)
                    </label>
                    <Input
                      type="number"
                      min="0"
                      step="any"
                      value={labourCost || ''}
                      onChange={(e) => handleTotalLabourChange(parseFloat(e.target.value) || 0)}
                      className="h-8 font-mono font-bold text-xs bg-white dark:bg-slate-900 border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                      Electricity Amount (₹)
                    </label>
                    <Input
                      type="number"
                      min="0"
                      step="any"
                      value={electricityCost || ''}
                      onChange={(e) => setElectricityCost(Math.max(0, parseFloat(e.target.value) || 0))}
                      className="h-8 font-mono font-bold text-xs bg-white dark:bg-slate-900 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300"
                    />
                  </div>
                </div>
              </div>

              {/* QA Lab Testing Toggle */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700">
                <div>
                  <span className="font-bold text-xs text-slate-800 dark:text-slate-200 block">
                    Route to QA Laboratory Test Queue (Quarantine)
                  </span>
                  <span className="text-[10px] text-slate-400">
                    If enabled, finished goods will be quarantined pending lab micro clearance.
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={labTestRequired}
                  onChange={(e) => setLabTestRequired(e.target.checked)}
                  className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800 shrink-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowYieldModal(false)}
                className="text-xs font-bold"
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={completing}
                onClick={() => handleCompleteDaySubmit(null, { finalize: submitFinalizeFlag })}
                className={`${submitFinalizeFlag ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-indigo-600 hover:bg-indigo-700'} text-white font-bold text-xs px-4 cursor-pointer`}
              >
                {completing ? <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1" /> : <Check className="w-3.5 h-3.5 mr-1" />}
                <span>
                  {submitFinalizeFlag
                    ? 'Confirm & Finish Entire Production'
                    : `Complete Day ${activeDayNo} & Pause (${labTestRequired ? 'Send to QC' : 'Push to Sales'})`}
                </span>
              </Button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
