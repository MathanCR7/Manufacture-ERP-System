import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/axios';
import {
  Package,
  Search,
  AlertTriangle,
  Clock,
  Eye,
  FileSpreadsheet,
  IndianRupee,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  RotateCcw,
  X,
  ChevronDown,
  ChevronUp,
  Calendar,
  ArrowDownLeft,
  ArrowUpRight,
  Filter,
  ExternalLink,
  Layers,
  Factory,
  Truck,
  RotateCw,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  Boxes,
  Maximize2,
  Loader2,
  Sparkles,
  Download,
  FileText,
  AlertOctagon,
  ShieldAlert,
  SlidersHorizontal,
  TableProperties,
  BarChart3
} from 'lucide-react';
import * as XLSX from 'xlsx';
import {
  exportStockInOutMatrixToExcel,
  exportMasterSummaryToExcel,
  exportDateWiseLedgerToExcel,
  exportCompleteEnterpriseWorkbookToExcel
} from '../utils/exportRMINOUTMatrixExcel';
import Swal from 'sweetalert2';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Pagination } from '@/components/ui/Pagination';
import RMHistoryDrawer from '@/modules/purchase/components/RMHistoryDrawer';
import RMStockQueryModal from '@/modules/purchase/components/RMStockQueryModal';

// Reusable Searchable Dropdown Component for Category & Code Filters
function SearchableFilterDropdown({
  label,
  placeholder,
  value,
  onChange,
  options = [],
  className = '',
  icon: Icon = Search
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const dropdownRef = useRef(null);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredOptions = useMemo(() => {
    if (!search.trim()) return options;
    const term = search.toLowerCase();
    return options.filter(opt =>
      (opt.label || '').toLowerCase().includes(term) ||
      (opt.subLabel || '').toLowerCase().includes(term) ||
      (opt.value || '').toLowerCase().includes(term)
    );
  }, [options, search]);

  const selectedOption = options.find(opt => opt.value === value) || options[0];
  const isFiltered = value && value !== 'ALL';

  return (
    <div ref={dropdownRef} className={`relative ${className}`}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full text-xs px-2 py-1 rounded-md border transition-all flex items-center justify-between gap-1 text-left cursor-pointer ${
          isFiltered
            ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-300 dark:border-emerald-700 text-emerald-900 dark:text-emerald-200 font-semibold shadow-2xs'
            : 'bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:border-slate-400'
        }`}
      >
        <div className="flex items-center gap-1.5 truncate">
          <Icon className={`w-3.5 h-3.5 shrink-0 ${isFiltered ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`} />
          <span className="truncate">
            {selectedOption ? selectedOption.label : placeholder}
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {isFiltered && (
            <span
              onClick={(e) => {
                e.stopPropagation();
                onChange('ALL');
              }}
              className="p-0.5 rounded-full hover:bg-emerald-200 dark:hover:bg-emerald-800 text-emerald-700 dark:text-emerald-300 transition-colors"
              title="Reset selection"
            >
              <X className="w-3 h-3" />
            </span>
          )}
          <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isOpen ? 'rotate-180 text-emerald-600' : ''}`} />
        </div>
      </button>

      {/* Popover Dropdown Menu */}
      {isOpen && (
        <div className="absolute z-50 mt-1 w-full min-w-[220px] sm:min-w-[260px] max-w-[calc(100vw-32px)] sm:max-w-[340px] left-0 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl p-2 space-y-1.5 animate-in fade-in zoom-in-95 duration-100">
          {/* Internal Search Input */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              autoFocus
              placeholder={`Search ${placeholder.toLowerCase()}...`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full text-xs pl-8 pr-6 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-hidden focus:ring-1.5 focus:ring-emerald-500"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Options List */}
          <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60 pr-0.5">
            {filteredOptions.length === 0 ? (
              <div className="py-3 text-center text-[11px] text-slate-400">
                No matching options found
              </div>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = value === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      onChange(opt.value);
                      setIsOpen(false);
                      setSearch('');
                    }}
                    className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-semibold'
                        : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200'
                    }`}
                  >
                    <div className="truncate flex-1">
                      <div className="truncate font-medium">{opt.label}</div>
                      {opt.subLabel && (
                        <div className="text-[10px] text-slate-400 truncate mt-0.5">
                          {opt.subLabel}
                        </div>
                      )}
                    </div>
                    {opt.badge !== undefined && (
                      <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-mono shrink-0">
                        {opt.badge}
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── SEARCHABLE & SELECTABLE TIME PERIOD DROPDOWN COMPONENT ──
function TimePeriodDropdown({
  period,
  setPeriod,
  customStartDate,
  setCustomStartDate,
  customEndDate,
  setCustomEndDate,
  appliedCustomStart,
  appliedCustomEnd,
  handleApplyCustomRange,
  handleClearCustomRange,
  summary,
  periodDisplayText,
  isFetching,
  className = ''
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const periodOptions = [
    { id: 'all', label: 'All Time' },
    { id: 'today', label: 'Today' },
    { id: 'this_year', label: 'This Year' },
    { id: 'this_week', label: 'This Week' },
    { id: 'last_week', label: 'Last Week' },
    { id: 'this_month', label: 'This Month' },
    { id: 'last_month', label: 'Last Month' },
    { id: 'custom', label: 'Custom Date Range' }
  ];

  const activeOption = periodOptions.find(p => p.id === period) || periodOptions[0];

  return (
    <div ref={dropdownRef} className={`relative ${className}`}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full text-xs px-2 py-1 rounded-md border transition-all flex items-center justify-between gap-1 text-left cursor-pointer ${
          period !== 'all'
            ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-300 dark:border-emerald-700 text-emerald-900 dark:text-emerald-200 font-semibold shadow-2xs'
            : 'bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:border-slate-400'
        }`}
        title={`Time Period: ${activeOption.label}`}
      >
        <div className="flex items-center gap-1.5 truncate">
          <Calendar className={`w-3.5 h-3.5 shrink-0 ${period !== 'all' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`} />
          <span className="truncate">
            {period === 'custom' && (appliedCustomStart || appliedCustomEnd)
              ? `Custom: ${appliedCustomStart || '...'} → ${appliedCustomEnd || '...'}`
              : activeOption.label}
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {period !== 'all' && (
            <span
              onClick={(e) => {
                e.stopPropagation();
                setPeriod('all');
                handleClearCustomRange?.();
              }}
              className="p-0.5 rounded-full hover:bg-emerald-200 dark:hover:bg-emerald-800 text-emerald-700 dark:text-emerald-300 transition-colors"
              title="Reset to All Time"
            >
              <X className="w-3 h-3" />
            </span>
          )}
          <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isOpen ? 'rotate-180 text-emerald-600' : ''}`} />
        </div>
      </button>

      {/* Popover Dropdown Menu */}
      {isOpen && (
        <div className="absolute z-50 mt-1 w-full min-w-[280px] sm:min-w-[320px] max-w-[calc(100vw-32px)] left-0 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl p-2.5 space-y-2 animate-in fade-in zoom-in-95 duration-100">
          <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-200 border-b border-slate-100 dark:border-slate-800 pb-1.5">
            <span className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Select Time Period:</span>
            </span>
            {isFetching && (
              <span className="flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>Syncing...</span>
              </span>
            )}
          </div>

          {/* Quick Preset Buttons */}
          <div className="grid grid-cols-2 gap-1">
            {periodOptions.map(p => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setPeriod(p.id);
                  if (p.id !== 'custom') {
                    handleClearCustomRange?.();
                    setIsOpen(false);
                  }
                }}
                className={`text-xs px-2.5 py-1.5 rounded-lg text-left font-medium transition-all cursor-pointer flex items-center justify-between ${
                  period === p.id
                    ? 'bg-emerald-600 text-white font-semibold shadow-xs'
                    : 'bg-slate-50 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200'
                }`}
              >
                <span>{p.label}</span>
                {period === p.id && <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />}
              </button>
            ))}
          </div>

          {/* Custom Date Form (Shown when custom is selected) */}
          {period === 'custom' && (
            <form
              onSubmit={(e) => {
                handleApplyCustomRange(e);
                setIsOpen(false);
              }}
              className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1.5"
            >
              <div className="grid grid-cols-2 gap-1.5">
                <div>
                  <label className="text-[10px] font-medium text-slate-500 block mb-0.5">From Date:</label>
                  <input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    className="w-full text-xs px-2 py-1 rounded-md border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-hidden focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-medium text-slate-500 block mb-0.5">To Date:</label>
                  <input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    className="w-full text-xs px-2 py-1 rounded-md border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-hidden focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>
              <div className="flex items-center justify-end gap-1.5 pt-0.5">
                {(appliedCustomStart || appliedCustomEnd) && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      handleClearCustomRange?.();
                      setPeriod('all');
                      setIsOpen(false);
                    }}
                    className="text-xs h-7 px-2"
                  >
                    Clear
                  </Button>
                )}
                <Button
                  type="submit"
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-7 px-3"
                >
                  Apply Range
                </Button>
              </div>
            </form>
          )}

          {/* Timeframe & Calculation Indicator Info Footer */}
          <div className="pt-1.5 border-t border-slate-100 dark:border-slate-800 text-[10px] space-y-1 text-slate-500 dark:text-slate-400">
            <div className="flex items-center justify-between">
              <span>Timeframe:</span>
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                {summary?.periodDateRange || periodDisplayText?.rangeText}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Calculation:</span>
              <span className={`px-1.5 py-0.2 rounded-full font-medium text-[9.5px] ${
                (summary?.isHistorical ?? periodDisplayText?.isHistorical)
                  ? 'bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300'
                  : 'bg-blue-100 dark:bg-blue-950/50 text-blue-800 dark:text-blue-300'
              }`}>
                {(summary?.isHistorical ?? periodDisplayText?.isHistorical) ? 'Historical Day Closing Balance' : 'Live Real-Time Stock Balance'}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function RMINOUTStockPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // URL query params (defaults to 'all' - All Time)
  const initialPeriod = searchParams.get('period') || 'all';
  const initialSearch = searchParams.get('search') || '';
  const initialCategory = searchParams.get('category') || 'ALL';
  const initialCode = searchParams.get('code') || 'ALL';
  const initialStartDate = searchParams.get('startDate') || '';
  const initialEndDate = searchParams.get('endDate') || '';

  // Time Period State - default is 'all' (All Time)
  const [period, setPeriod] = useState(initialPeriod); // today | yesterday | this_week | last_week | this_month | last_month | all | custom
  const [customStartDate, setCustomStartDate] = useState(initialStartDate);
  const [customEndDate, setCustomEndDate] = useState(initialEndDate);
  const [appliedCustomStart, setAppliedCustomStart] = useState(initialStartDate);
  const [appliedCustomEnd, setAppliedCustomEnd] = useState(initialEndDate);

  // View Mode: 'ledger' (Date-Wise Ledger & Movement Matrix - Default) | 'material' (Grouped by Material Summary)
  const [viewMode, setViewMode] = useState('ledger');
  // Ledger Sub-Mode: 'matrix' (Date-Wise Movement Matrix Grid matching Excel) | 'stream' (Flat Transaction List)
  const [ledgerSubMode, setLedgerSubMode] = useState('matrix');
  const [isCompactDensity, setIsCompactDensity] = useState(true);
  // Tablet View Mode for Matrix: 'card' (default responsive cards) | 'table' (full touch-scrollable grid)
  const [tabletViewMode, setTabletViewMode] = useState('card');

  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState(initialSearch);
  const [categoryFilter, setCategoryFilter] = useState(initialCategory);
  const [codeFilter, setCodeFilter] = useState(initialCode);
  const [movementFilter, setMovementFilter] = useState('ALL'); // ALL | IN_PROGRESS | FREE_AVAILABLE | LAB_REJECTED | WITH_MOVEMENT | IN_ONLY | OUT_ONLY | NET_POSITIVE | NET_NEGATIVE | LOW_STOCK | OUT_OF_STOCK
  const [sortBy, setSortBy] = useState('code_asc');
  const [lastRefreshed, setLastRefreshed] = useState(new Date());

  // Export Modal State
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);

  // Pagination State - Default 10 items per page as requested
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Expanded Material Rows for inline ledger view
  const [expandedMaterialIds, setExpandedMaterialIds] = useState(new Set());
  const [expandedLoadingIds, setExpandedLoadingIds] = useState(new Set());
  const [materialHistoryCache, setMaterialHistoryCache] = useState({});

  // History Drawer & Stock Query Modal State
  const [selectedMaterialId, setSelectedMaterialId] = useState(null);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [historyInitialTab, setHistoryInitialTab] = useState('timeline');
  const [selectedStockQueryId, setSelectedStockQueryId] = useState(null);
  const [isStockQueryOpen, setIsStockQueryOpen] = useState(false);

  // Single Active Cell Hover Tooltip state (Guarantees only ONE popup can ever show at a time)
  const [activeCellTooltip, setActiveCellTooltip] = useState(null);
  const tooltipHideTimerRef = useRef(null);

  const handleCellMouseEnter = useCallback((e, mat, dateStr, cell) => {
    if (!cell || !cell.transactions || cell.transactions.length === 0) {
      setActiveCellTooltip(null);
      return;
    }
    if (tooltipHideTimerRef.current) {
      clearTimeout(tooltipHideTimerRef.current);
      tooltipHideTimerRef.current = null;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    setActiveCellTooltip({
      matId: mat.id,
      matName: mat.name,
      matCode: mat.code,
      uom: mat.uom,
      dateStr,
      cell,
      rect: {
        top: rect.top,
        bottom: rect.bottom,
        left: rect.left,
        right: rect.right,
        width: rect.width,
        height: rect.height
      }
    });
  }, []);

  const handleCellMouseLeave = useCallback(() => {
    if (tooltipHideTimerRef.current) {
      clearTimeout(tooltipHideTimerRef.current);
    }
    tooltipHideTimerRef.current = setTimeout(() => {
      setActiveCellTooltip(null);
    }, 320);
  }, []);

  const handleCellClick = useCallback((e, mat, dateStr, cell) => {
    if (!cell || !cell.transactions || cell.transactions.length === 0) {
      setActiveCellTooltip(null);
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    setActiveCellTooltip(prev => {
      if (prev && prev.matId === mat.id && prev.dateStr === dateStr) {
        return null;
      }
      return {
        matId: mat.id,
        matName: mat.name,
        matCode: mat.code,
        uom: mat.uom,
        dateStr,
        cell,
        rect: {
          top: rect.top,
          bottom: rect.bottom,
          left: rect.left,
          right: rect.right,
          width: rect.width,
          height: rect.height
        }
      };
    });
  }, []);

  // Active Valuation Hover Tooltip state & positioning
  const [activeValuationTooltip, setActiveValuationTooltip] = useState(null);
  const valuationTooltipHideTimerRef = useRef(null);

  const handleValuationMouseEnter = useCallback((e, mat) => {
    if (!mat) {
      setActiveValuationTooltip(null);
      return;
    }
    if (valuationTooltipHideTimerRef.current) {
      clearTimeout(valuationTooltipHideTimerRef.current);
      valuationTooltipHideTimerRef.current = null;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    setActiveValuationTooltip({
      matId: mat.id,
      matName: mat.name,
      matCode: mat.code,
      uom: mat.uom,
      currentStock: Number(mat.currentStock || 0),
      valueWithoutTax: Number(mat.valueWithoutTax || 0),
      taxValue: Number(mat.taxValue || 0),
      valueWithTax: Number(mat.valueWithTax || mat.valuation || 0),
      ratePerUnit: Number(mat.ratePerUnit || 0),
      baseRate: Number(mat.baseRate || 0),
      gstPercentage: Number(mat.gstPercentage || 0),
      contributingPOs: mat.contributingPOs || [],
      rect: {
        top: rect.top,
        bottom: rect.bottom,
        left: rect.left,
        right: rect.right,
        width: rect.width,
        height: rect.height
      }
    });
  }, []);

  const handleValuationMouseLeave = useCallback(() => {
    if (valuationTooltipHideTimerRef.current) {
      clearTimeout(valuationTooltipHideTimerRef.current);
    }
    valuationTooltipHideTimerRef.current = setTimeout(() => {
      setActiveValuationTooltip(null);
    }, 320);
  }, []);

  const handleValuationClick = useCallback((e, mat) => {
    if (!mat) {
      setActiveValuationTooltip(null);
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    setActiveValuationTooltip(prev => {
      if (prev && prev.matId === mat.id) {
        return null;
      }
      return {
        matId: mat.id,
        matName: mat.name,
        matCode: mat.code,
        uom: mat.uom,
        currentStock: Number(mat.currentStock || 0),
        valueWithoutTax: Number(mat.valueWithoutTax || 0),
        taxValue: Number(mat.taxValue || 0),
        valueWithTax: Number(mat.valueWithTax || mat.valuation || 0),
        ratePerUnit: Number(mat.ratePerUnit || 0),
        baseRate: Number(mat.baseRate || 0),
        gstPercentage: Number(mat.gstPercentage || 0),
        contributingPOs: mat.contributingPOs || [],
        rect: {
          top: rect.top,
          bottom: rect.bottom,
          left: rect.left,
          right: rect.right,
          width: rect.width,
          height: rect.height
        }
      };
    });
  }, []);

  // Close tooltips on outer scroll, resize, or outside click (ignoring scroll inside the popups!)
  useEffect(() => {
    const handleClose = (e) => {
      // If scroll happens inside any popup container, do not close!
      if (e?.target && e.target.closest && (e.target.closest('.stock-popup-container') || e.target.closest('.valuation-popup-container'))) {
        return;
      }
      setActiveCellTooltip(null);
      setActiveValuationTooltip(null);
    };
    window.addEventListener('scroll', handleClose, true);
    window.addEventListener('resize', handleClose);
    return () => {
      window.removeEventListener('scroll', handleClose, true);
      window.removeEventListener('resize', handleClose);
    };
  }, []);

  // Compute smart tooltip positioning with collision detection (above vs below, screen edge clamping)
  const tooltipPosition = useMemo(() => {
    if (!activeCellTooltip?.rect) return null;
    const { top: rTop, bottom: rBottom, left: rLeft, width: rWidth } = activeCellTooltip.rect;

    const tooltipWidth = 360;
    const estimatedHeight = 280;
    const padding = 12;

    const spaceAbove = rTop;
    const spaceBelow = window.innerHeight - rBottom;

    // Smart vertical collision detection: if space above is less than 240px and space below is greater, show BELOW cell!
    const placeBelow = spaceAbove < estimatedHeight && spaceBelow >= spaceAbove;

    const top = placeBelow ? rBottom + 8 : rTop - 8;
    const targetCenterX = rLeft + rWidth / 2;

    // Clamp horizontal center so tooltip card never overflows window left or right edge
    const minCenter = tooltipWidth / 2 + padding;
    const maxCenter = window.innerWidth - tooltipWidth / 2 - padding;
    const clampedCenter = Math.max(minCenter, Math.min(targetCenterX, maxCenter));
    const arrowOffset = targetCenterX - clampedCenter;

    return {
      top,
      left: clampedCenter,
      placeBelow,
      arrowOffset
    };
  }, [activeCellTooltip]);

  // Compute smart positioning for valuation breakdown tooltip
  const valuationTooltipPosition = useMemo(() => {
    if (!activeValuationTooltip?.rect) return null;
    const { top: rTop, bottom: rBottom, left: rLeft, width: rWidth } = activeValuationTooltip.rect;

    const tooltipWidth = 360;
    const estimatedHeight = 320;
    const padding = 12;

    const spaceAbove = rTop;
    const spaceBelow = window.innerHeight - rBottom;

    const placeBelow = spaceAbove < estimatedHeight && spaceBelow >= spaceAbove;
    const top = placeBelow ? rBottom + 8 : rTop - 8;
    const targetCenterX = rLeft + rWidth / 2;

    const minCenter = tooltipWidth / 2 + padding;
    const maxCenter = window.innerWidth - tooltipWidth / 2 - padding;
    const clampedCenter = Math.max(minCenter, Math.min(targetCenterX, maxCenter));
    const arrowOffset = targetCenterX - clampedCenter;

    return {
      top,
      left: clampedCenter,
      placeBelow,
      arrowOffset
    };
  }, [activeValuationTooltip]);

  // 1. Primary Query: Fetch Base RM Stock (Auto-refresh enabled on mount and focus)
  const {
    data: baseStock = [],
    isLoading: isBaseLoading,
    isFetching: isBaseFetching,
    refetch: refetchBase
  } = useQuery({
    queryKey: ['rm-stock'],
    queryFn: async () => {
      const response = await api.get('/rm-stock');
      setLastRefreshed(new Date());
      return response.data || [];
    },
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    staleTime: 0,
  });

  // 2. Secondary Query: Dedicated /rm-stock/in-out endpoint (Auto-refresh enabled on mount and focus)
  const {
    data: dedicatedData = null,
    isFetching: isDedicatedFetching,
    refetch: refetchDedicated
  } = useQuery({
    queryKey: ['rm-in-out-stock-api', period, appliedCustomStart, appliedCustomEnd],
    queryFn: async () => {
      try {
        const params = new URLSearchParams();
        params.append('period', period);
        if (period === 'custom') {
          if (appliedCustomStart) params.append('startDate', appliedCustomStart);
          if (appliedCustomEnd) params.append('endDate', appliedCustomEnd);
        }
        const response = await api.get(`/rm-stock/in-out?${params.toString()}`);
        return response.data;
      } catch (err) {
        return null;
      }
    },
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    staleTime: 0,
  });

  // Automatically refresh data when opening the page
  useEffect(() => {
    refetchBase();
    refetchDedicated();
  }, [refetchBase, refetchDedicated]);

  // Calculate Date Boundaries for current period
  const dateRange = useMemo(() => {
    const now = new Date();
    let start = null;
    let end = null;

    if (period === 'today') {
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    } else if (period === 'this_year') {
      start = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
      end = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
    } else if (period === 'yesterday') {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      start = new Date(y.getFullYear(), y.getMonth(), y.getDate(), 0, 0, 0, 0);
      end = new Date(y.getFullYear(), y.getMonth(), y.getDate(), 23, 59, 59, 999);
    } else if (period === 'this_week') {
      const dayOfWeek = (now.getDay() + 6) % 7;
      const monday = new Date(now);
      monday.setDate(monday.getDate() - dayOfWeek);
      monday.setHours(0, 0, 0, 0);
      start = monday;
      end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    } else if (period === 'last_week') {
      const dayOfWeek = (now.getDay() + 6) % 7;
      const lastMonday = new Date(now);
      lastMonday.setDate(lastMonday.getDate() - dayOfWeek - 7);
      lastMonday.setHours(0, 0, 0, 0);
      const lastSunday = new Date(lastMonday);
      lastSunday.setDate(lastSunday.getDate() + 6);
      lastSunday.setHours(23, 59, 59, 999);
      start = lastMonday;
      end = lastSunday;
    } else if (period === 'this_month') {
      start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    } else if (period === 'last_month') {
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
      end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
    } else if (period === 'custom' || appliedCustomStart || appliedCustomEnd) {
      if (appliedCustomStart) {
        const p = String(appliedCustomStart).split('-');
        start = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]), 0, 0, 0, 0);
      }
      if (appliedCustomEnd) {
        const p = String(appliedCustomEnd).split('-');
        end = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]), 23, 59, 59, 999);
      }
    }

    return { start, end };
  }, [period, appliedCustomStart, appliedCustomEnd]);

  const isDateInPeriod = useCallback((dateStr) => {
    if (!dateRange.start && !dateRange.end) return true;
    if (!dateStr) return false;
    const t = new Date(dateStr).getTime();
    if (dateRange.start && t < dateRange.start.getTime()) return false;
    if (dateRange.end && t > dateRange.end.getTime()) return false;
    return true;
  }, [dateRange]);

  const isDateAfterPeriod = useCallback((dateStr) => {
    if (!dateRange.end) return false;
    if (!dateStr) return false;
    return new Date(dateStr).getTime() > dateRange.end.getTime();
  }, [dateRange]);

  // Comprehensive human-readable period description and timestamp range
  const periodDisplayText = useMemo(() => {
    const formatDate = (d) => {
      if (!d) return '';
      return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    };
    const formatTime = (d) => {
      if (!d) return '';
      return new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
    };

    if (period === 'all') {
      return {
        label: 'All Time',
        shortBadge: 'All Time',
        rangeText: `Complete History • Lifetime stock as of ${formatDate(new Date())}`,
        isHistorical: false
      };
    }
    if (period === 'today') {
      return {
        label: 'Today',
        shortBadge: 'Today',
        rangeText: `${formatDate(new Date())} (00:00 - 23:59)`,
        isHistorical: false
      };
    }
    if (period === 'this_year') {
      return {
        label: 'This Year',
        shortBadge: 'This Year',
        rangeText: `${formatDate(dateRange.start)} to ${formatDate(dateRange.end)} (Jan 01 - Dec 31, ${new Date().getFullYear()})`,
        isHistorical: false
      };
    }
    if (period === 'yesterday') {
      const y = new Date();
      y.setDate(y.getDate() - 1);
      return {
        label: 'Yesterday',
        shortBadge: 'Yesterday',
        rangeText: `${formatDate(y)} (00:00 - 23:59)`,
        isHistorical: true
      };
    }
    if (period === 'this_week') {
      return {
        label: 'This Week',
        shortBadge: 'This Week',
        rangeText: `${formatDate(dateRange.start)} to ${formatDate(dateRange.end)} (Monday to Today)`,
        isHistorical: false
      };
    }
    if (period === 'last_week') {
      return {
        label: 'Last Week',
        shortBadge: 'Last Week',
        rangeText: `${formatDate(dateRange.start)} to ${formatDate(dateRange.end)} (Previous Week Mon–Sun)`,
        isHistorical: true
      };
    }
    if (period === 'this_month') {
      return {
        label: 'This Month',
        shortBadge: 'This Month',
        rangeText: `${formatDate(dateRange.start)} to ${formatDate(dateRange.end)}`,
        isHistorical: false
      };
    }
    if (period === 'last_month') {
      return {
        label: 'Last Month',
        shortBadge: 'Last Month',
        rangeText: `${formatDate(dateRange.start)} to ${formatDate(dateRange.end)} (Previous Month Closing)`,
        isHistorical: true
      };
    }
    if (period === 'custom') {
      return {
        label: 'Custom Range',
        shortBadge: 'Custom Range',
        rangeText: `${formatDate(dateRange.start) || 'Start'} to ${formatDate(dateRange.end) || 'End'}`,
        isHistorical: Boolean(dateRange.end && dateRange.end.getTime() < new Date().getTime())
      };
    }
    return {
      label: 'All Time',
      shortBadge: 'All Time',
      rangeText: `All Transactions`,
      isHistorical: false
    };
  }, [period, dateRange]);

  // Load History for expanded row (fallback mode)
  const fetchItemHistory = useCallback(async (matId) => {
    if (materialHistoryCache[matId]) return materialHistoryCache[matId];
    try {
      setExpandedLoadingIds(prev => new Set(prev).add(matId));
      const res = await api.get(`/rm-stock/${matId}/history`);
      const hData = res.data;

      const txList = [];

      // GRN receipts (IN)
      (hData.grnReceipts || []).forEach(g => {
        const isLabRejected = String(g.status || '').toUpperCase().includes('REJECT') || Number(g.rejectedQty || 0) > 0;
        const labStatus = isLabRejected ? 'LAB_REJECTED' : 'LAB_APPROVED';
        const rate = Number(g.unitPrice || g.rate || 0);
        const qty = Number(g.actualReceivedQty || 0);
        const amount = Math.round(qty * rate * 100) / 100;
        const poRef = g.poReferenceNo || 'PO';
        const batchNo = g.batch?.batchNumber || '—';

        txList.push({
          id: `grn-${g.id}`,
          date: g.receivedDate,
          flow: 'IN',
          type: 'GRN',
          typeLabel: isLabRejected ? 'GRN Inward (Lab Rejected)' : 'GRN Inward Receipt',
          quantity: qty,
          rate,
          amount,
          referenceNo: g.referenceNo || 'GRN',
          poReferenceNo: poRef,
          poId: g.poId,
          grnId: g.grnId || g.id,
          batchNumber: batchNo,
          partyName: g.supplierName || 'Vendor Receipt',
          user: g.receivedByName || 'Gate Officer',
          labStatus,
          isLabRejected,
          notes: g.discrepancyNotes || `Challan: ${g.challanNumber || 'N/A'}`,
          compositeComment: `PO: ${poRef} | Batch: ${batchNo} | Qty: ${qty} | Rate: ₹${rate.toFixed(2)} | Amount: ₹${amount.toFixed(2)} | Lab/QC: ${labStatus}`
        });
      });

      // Stock Adjustments
      (hData.stockAdjustments || []).forEach(a => {
        const isAdd = a.type === 'ADDITION';
        const qty = Number(a.quantity || 0);
        txList.push({
          id: `adj-${a.id}`,
          date: a.createdAt,
          flow: isAdd ? 'IN' : 'OUT',
          type: isAdd ? 'ADJUSTMENT_ADD' : 'ADJUSTMENT_SUB',
          typeLabel: isAdd ? 'Stock Adjustment (+)' : 'Stock Adjustment (-)',
          quantity: qty,
          rate: 0,
          amount: 0,
          referenceNo: `ADJ-${a.id.slice(-6).toUpperCase()}`,
          batchNumber: 'Manual Correction',
          partyName: `Adjustment: ${a.notes || a.type}`,
          user: a.userName || 'Supervisor',
          labStatus: 'RECONCILED',
          isLabRejected: false,
          notes: a.notes || 'Stock Reconciliation',
          compositeComment: `Ref: ADJ-${a.id.slice(-6).toUpperCase()} | Type: Adjustment (${isAdd ? '+' : '-'}) | Qty: ${qty} | User: ${a.userName || 'Staff'}`
        });
      });

      // Production Usages (OUT)
      (hData.productionUsages || []).forEach(u => {
        if (u.isCancelled) return;
        const bStatus = String(u.batchStatus || '').toLowerCase();
        if (bStatus === 'draft' || Boolean(u.isDraft)) return; // Do not display in OUT if production is draft
        const isInProgress = bStatus.includes('progress') || bStatus.includes('running') || bStatus.includes('paused');
        const qty = Number(u.actualUsedQty || u.requiredQty || 0);
        const batchRef = u.batchNumber || 'Prod Batch';
        const rmBatchTaken = u.batchNoTakenFrom || 'RM Lot';

        txList.push({
          id: `usage-${u.id}`,
          date: u.date,
          flow: 'OUT',
          type: 'PROD_USAGE',
          typeLabel: isInProgress ? 'Production Issue (In Progress WIP)' : 'Production Consumption',
          quantity: qty,
          rate: 0,
          amount: 0,
          referenceNo: batchRef,
          batchId: u.batchId,
          batchStatus: isInProgress ? 'IN_PROGRESS' : 'COMPLETED',
          isInProgress,
          rawBatchStatus: u.batchStatus,
          batchNumber: rmBatchTaken,
          partyName: `Product: ${u.productName}`,
          user: 'Production Team',
          labStatus: 'QC_PASSED',
          isLabRejected: false,
          notes: `Status: ${u.batchStatus || 'Completed'}`,
          compositeComment: `Batch: ${batchRef} | RM Lot: ${rmBatchTaken} | Product: ${u.productName} | Qty: ${qty} | Status: ${u.batchStatus || 'Completed'}`
        });
      });

      // Resale / Dispatches (OUT)
      (hData.resales || []).forEach(r => {
        const qty = Number(r.quantity || 0);
        txList.push({
          id: `resale-${r.id}`,
          date: r.orderDate,
          flow: 'OUT',
          type: 'RESALE',
          typeLabel: 'Direct Resale / Dispatch',
          quantity: qty,
          rate: 0,
          amount: 0,
          referenceNo: r.docNo || r.referenceNo || 'SO',
          orderId: r.orderId,
          batchNumber: r.batchNo || 'Direct Stock',
          partyName: `Customer: ${r.customerName}`,
          user: 'Sales Team',
          labStatus: 'DISPATCHED',
          isLabRejected: false,
          notes: `${r.docType}: ${r.status}`,
          compositeComment: `Order: ${r.docNo || 'SO'} | Customer: ${r.customerName} | Qty: ${qty}`
        });
      });

      // RM Wastage (OUT)
      (hData.wasteRecords || []).forEach(w => {
        const qty = Number(w.quantity || 0);
        txList.push({
          id: `waste-${w.id}`,
          date: w.date,
          flow: 'OUT',
          type: 'WASTE',
          typeLabel: 'RM Scrap / Wastage',
          quantity: qty,
          rate: 0,
          amount: 0,
          referenceNo: w.referenceNo || 'WASTE',
          batchNumber: w.batchNumber || '—',
          partyName: `Wastage: ${w.remarks || w.notes || 'Scrap'}`,
          user: w.responsiblePerson || 'Store Staff',
          labStatus: 'SCRAP_DISCARD',
          isLabRejected: false,
          notes: w.remarks || w.notes,
          compositeComment: `Scrap Ref: ${w.referenceNo || 'WASTE'} | Qty: ${qty} | Reason: ${w.remarks || 'Scrap'}`
        });
      });

      // Purchase Returns (OUT)
      (hData.purchaseReturns || []).forEach(ret => {
        const isLabRejected = String(ret.returnReason || '').toUpperCase().includes('LAB');
        const qty = Number(ret.returnQty || 0);
        txList.push({
          id: `ret-${ret.id}`,
          date: ret.returnDate,
          flow: 'OUT',
          type: 'RETURN',
          typeLabel: isLabRejected ? 'Purchase Return (Lab Rejected)' : 'Purchase Return to Vendor',
          quantity: qty,
          rate: 0,
          amount: 0,
          referenceNo: ret.referenceNo || 'RETURN',
          poReferenceNo: ret.poReferenceNo,
          poId: ret.poId,
          grnId: ret.grnId,
          batchNumber: 'Vendor Return',
          partyName: `Return: ${ret.supplierName}`,
          user: ret.createdByName || 'Staff',
          labStatus: isLabRejected ? 'LAB_REJECTED' : 'VENDOR_RETURN',
          isLabRejected,
          rejectedQty: isLabRejected ? qty : 0,
          rejectionReason: ret.returnReason,
          notes: ret.returnReason,
          compositeComment: `Return Ref: ${ret.referenceNo || 'RETURN'} | PO: ${ret.poReferenceNo || 'N/A'} | Qty: ${qty} | Reason: ${ret.returnReason}`
        });
      });

      txList.sort((a, b) => new Date(b.date) - new Date(a.date));

      const updatedCache = {
        ...materialHistoryCache,
        [matId]: { hData, txList }
      };
      setMaterialHistoryCache(updatedCache);
      return { hData, txList };
    } catch (e) {
      console.error('Failed to load item history for:', matId, e);
      return null;
    } finally {
      setExpandedLoadingIds(prev => {
        const next = new Set(prev);
        next.delete(matId);
        return next;
      });
    }
  }, [materialHistoryCache]);

  // Toggle row expansion and load history on demand
  const toggleExpandRow = async (matId) => {
    setExpandedMaterialIds(prev => {
      const next = new Set(prev);
      if (next.has(matId)) {
        next.delete(matId);
      } else {
        next.add(matId);
      }
      return next;
    });

    if (!materialHistoryCache[matId] && !dedicatedData?.materials?.find(m => m.id === matId)?.transactions?.length) {
      await fetchItemHistory(matId);
    }
  };

  // Merge Base Stock with Dedicated Data
  // Merge Base Stock with Dedicated Data
  const unifiedMaterials = useMemo(() => {
    if (dedicatedData && Array.isArray(dedicatedData.materials)) {
      return dedicatedData.materials;
    }

    const isPeriodFiltered = period && period !== 'all';

    const mapped = baseStock.map(item => {
      const liveStock = Number(item.availableQuantity ?? item.currentStock ?? item.stock ?? 0);
      const alert = Number(item.alertLevel || 0);
      const hasPo = Boolean(item.hasPo || item.poReferenceNo || (Number(item.rateWithTax || 0) > 0));
      const rateWithoutTax = hasPo ? Number(item.rateWithoutTax || item.baseRate || 0) : 0;
      const rateWithTax = hasPo ? Number(item.rateWithTax || item.ratePerUnit || 0) : 0;
      const gstPercentage = hasPo ? Number(item.gstPercentage || 0) : 0;

      const cached = materialHistoryCache[item.id];
      let periodIn = 0;
      let periodOut = 0;
      let postPeriodIn = 0;
      let postPeriodOut = 0;
      let inProgressStock = 0;
      let labRejectedQty = 0;
      let hasLabRejection = false;
      let lastIn = null;
      let lastOut = null;
      let txs = [];

      if (cached?.txList) {
        cached.txList.forEach(tx => {
          const inRange = isDateInPeriod(tx.date);
          const isAfter = isDateAfterPeriod(tx.date);
          if (tx.isLabRejected) {
            hasLabRejection = true;
            labRejectedQty += Number(tx.quantity || 0);
          }
          if (tx.flow === 'IN') {
            if (!lastIn || new Date(tx.date) > new Date(lastIn.date)) {
              lastIn = { date: tx.date, ref: tx.referenceNo, qty: tx.quantity, party: tx.partyName, poId: tx.poId, grnId: tx.grnId };
            }
            if (inRange) periodIn += tx.quantity;
            else if (isAfter) postPeriodIn += tx.quantity;
          } else {
            if (!lastOut || new Date(tx.date) > new Date(lastOut.date)) {
              lastOut = { date: tx.date, ref: tx.referenceNo, qty: tx.quantity, party: tx.partyName, batchId: tx.batchId, isInProgress: tx.isInProgress };
            }
            if (inRange) periodOut += tx.quantity;
            else if (isAfter) postPeriodOut += tx.quantity;

            if (tx.isInProgress) {
              inProgressStock += tx.quantity;
            }
          }

          if (inRange) {
            txs.push(tx);
          }
        });
      }

      const isHistorical = Boolean(dateRange.end && dateRange.end.getTime() < new Date().getTime());
      let curStock = liveStock;
      if (isPeriodFiltered) {
        curStock = Math.max(0, Math.round((periodIn - periodOut) * 1000) / 1000);
      } else if (isHistorical && cached?.txList) {
        curStock = Math.max(0, Math.round((liveStock - postPeriodIn + postPeriodOut) * 1000) / 1000);
      }

      const inProgress = isPeriodFiltered ? 0 : inProgressStock;
      const valueWithoutTax = hasPo ? Math.round((curStock * rateWithoutTax) * 100) / 100 : 0;
      const valueWithTax = hasPo ? Math.round((curStock * rateWithTax) * 100) / 100 : 0;
      const taxValue = Math.round((valueWithTax - valueWithoutTax) * 100) / 100;
      const val = valueWithTax;
      const availableStock = Math.max(0, curStock - inProgress);
      const status = curStock <= 0 ? 'OUT_OF_STOCK' : (curStock <= alert ? 'LOW_STOCK' : 'OPTIMAL');

      return {
        id: item.id,
        code: item.code || '—',
        name: item.name || '—',
        category: item.category || 'Uncategorised',
        categoryId: item.categoryId,
        uom: item.unit || 'Unit',
        currentStock: curStock,
        liveStock,
        isHistorical,
        inProgressStock: Math.round(inProgress * 100) / 100,
        availableStock: Math.round(availableStock * 100) / 100,
        labRejectedQty: Math.round(labRejectedQty * 100) / 100,
        hasLabRejection,
        labStatus: hasLabRejection ? 'LAB_REJECTED' : 'QC_PASSED',
        alertLevel: alert,
        ratePerUnit: Math.round(rateWithTax * 100) / 100,
        baseRate: Math.round(rateWithoutTax * 100) / 100,
        rateWithoutTax: Math.round(rateWithoutTax * 100) / 100,
        rateWithTax: Math.round(rateWithTax * 100) / 100,
        gstPercentage,
        valuation: Math.round(val * 100) / 100,
        valueWithoutTax,
        valueWithTax,
        taxValue,
        status,
        hasPo,
        poReferenceNo: item.poReferenceNo || null,
        latestPoId: item.latestPoId || null,
        periodInQty: Math.round(periodIn * 100) / 100,
        periodOutQty: Math.round(periodOut * 100) / 100,
        netMovement: Math.round((periodIn - periodOut) * 100) / 100,
        transactions: txs,
        lastIn: lastIn || (item.poDate ? { date: item.poDate, ref: item.poReferenceNo, qty: item.poLineQty, party: 'Purchase Order' } : null),
        lastOut
      };
    });

    if (isPeriodFiltered) {
      return mapped.filter(m => Number(m.periodInQty || 0) > 0 || Number(m.periodOutQty || 0) > 0);
    }
    return mapped;
  }, [baseStock, dedicatedData, materialHistoryCache, isDateInPeriod, isDateAfterPeriod, dateRange, period]);

  // Overall Global Transactions List
  const unifiedAllTransactions = useMemo(() => {
    if (dedicatedData && Array.isArray(dedicatedData.allTransactions)) {
      return dedicatedData.allTransactions;
    }

    const flat = [];
    Object.values(materialHistoryCache).forEach(entry => {
      (entry.txList || []).forEach(tx => {
        if (isDateInPeriod(tx.date)) {
          flat.push(tx);
        }
      });
    });
    flat.sort((a, b) => new Date(b.date) - new Date(a.date));
    return flat;
  }, [dedicatedData, materialHistoryCache, isDateInPeriod]);

  // Advanced Search Matcher:
  // 1. Direct raw substring match
  // 2. Normalized space & punctuation insensitivity (e.g. "milkraw" matches "MILK RAW" and "milk-raw")
  // 3. Multi-word search in any order (e.g. "raw milk" matches "MILK RAW")
  // 4. Minor typo / spelling tolerance (Levenshtein distance <= 1 for 4+ char words)
  const normalizeSearchStr = (str) => {
    if (!str) return '';
    return String(str).toLowerCase().replace(/[^a-z0-9]/g, '');
  };

  const levenshteinDistance = (a, b) => {
    if (a === b) return 0;
    if (!a.length) return b.length;
    if (!b.length) return a.length;
    const matrix = [];
    for (let i = 0; i <= b.length; i++) matrix[i] = [i];
    for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    return matrix[b.length][a.length];
  };

  const matchesAdvancedSearch = useCallback((targetStrings, searchRaw) => {
    if (!searchRaw || !searchRaw.trim()) return true;
    const rawTerm = searchRaw.toLowerCase().trim();
    const normalizedSearch = normalizeSearchStr(rawTerm);
    if (!normalizedSearch) return true;

    const rawJoined = (targetStrings || []).filter(Boolean).map(s => String(s).toLowerCase()).join(' ');
    const normalizedJoined = normalizeSearchStr(rawJoined);

    // 1. Direct raw substring match
    if (rawJoined.includes(rawTerm)) return true;

    // 2. Space & punctuation-insensitive normalized match (e.g. "milkraw" in "milk raw")
    if (normalizedJoined.includes(normalizedSearch)) return true;

    // 3. Multi-word search (all words must match)
    const searchTokens = rawTerm.split(/\s+/).filter(Boolean);
    if (searchTokens.length > 1) {
      const allTokensMatch = searchTokens.every(tok => {
        const normTok = normalizeSearchStr(tok);
        return rawJoined.includes(tok) || (normTok && normalizedJoined.includes(normTok));
      });
      if (allTokensMatch) return true;
    }

    // 4. Minor typo / spelling tolerance
    const targetWords = rawJoined.split(/[\s\-_/,\.]+/).filter(w => w.length >= 3);
    const wordsMatchWithFuzzy = searchTokens.every(sTok => {
      const sNorm = normalizeSearchStr(sTok);
      if (!sNorm) return true;
      if (normalizedJoined.includes(sNorm)) return true;

      const maxDist = sNorm.length >= 6 ? 2 : (sNorm.length >= 4 ? 1 : 0);
      if (maxDist === 0) return false;

      return targetWords.some(tWord => {
        const tNorm = normalizeSearchStr(tWord);
        if (Math.abs(tNorm.length - sNorm.length) > maxDist) return false;
        return levenshteinDistance(sNorm, tNorm) <= maxDist;
      });
    });

    return wordsMatchWithFuzzy;
  }, []);

  const getMaterialSearchableTargets = (item) => [
    item.code,
    item.name,
    item.category,
    item.poReferenceNo,
    item.lastIn?.ref,
    item.lastIn?.party,
    item.lastOut?.ref,
    item.lastOut?.party,
    item.uom,
    ...(item.transactions || []).flatMap(t => [
      t.referenceNo,
      t.poReferenceNo,
      t.batchNumber,
      t.partyName,
      t.user,
      t.notes,
      t.compositeComment
    ])
  ];

  // Category & Search Filtered Materials (used to dynamically recalculate summary when user selects filters)
  const categoryAndSearchFilteredMaterials = useMemo(() => {
    return unifiedMaterials.filter(item => {
      if (searchTerm.trim()) {
        const targets = getMaterialSearchableTargets(item);
        if (!matchesAdvancedSearch(targets, searchTerm)) return false;
      }
      if (categoryFilter !== 'ALL' && (item.category || 'Uncategorised') !== categoryFilter) {
        return false;
      }
      if (codeFilter !== 'ALL' && item.code !== codeFilter) {
        return false;
      }
      return true;
    });
  }, [unifiedMaterials, searchTerm, categoryFilter, codeFilter, matchesAdvancedSearch]);

  // Overall Summary Metrics (Responsive to Time Period, Categories, and Searches)
  const summary = useMemo(() => {
    const hasLocalFilter = (categoryFilter !== 'ALL') || (codeFilter !== 'ALL') || (searchTerm.trim() !== '') || (movementFilter !== 'ALL');

    if (!hasLocalFilter && dedicatedData?.summary) {
      const s = dedicatedData.summary;
      return {
        ...s,
        totalValuationWithTax: Number(s.totalValuationWithTax || s.totalValuation || 0),
        totalValuationWithoutTax: Number(s.totalValuationWithoutTax || 0),
        totalTaxAmount: Number(s.totalTaxAmount || 0),
        periodLabel: s.periodLabel || periodDisplayText.label,
        periodDateRange: s.periodDateRange || periodDisplayText.rangeText,
        isHistorical: s.isHistorical ?? periodDisplayText.isHistorical
      };
    }

    const sourceList = hasLocalFilter ? categoryAndSearchFilteredMaterials : unifiedMaterials;

    let totStock = 0;
    let totVal = 0;
    let totValWithTax = 0;
    let totValWithoutTax = 0;
    let totTax = 0;
    let totIn = 0;
    let totOut = 0;
    let totWip = 0;
    let totAvail = 0;
    let totRejected = 0;
    let rejectedCount = 0;
    let activeCount = 0;

    sourceList.forEach(m => {
      const cur = Number(m.currentStock || 0);
      const wip = Number(m.inProgressStock || 0);
      const avail = m.availableStock !== undefined ? Number(m.availableStock) : Math.max(0, cur - wip);

      totStock += cur;
      const vWithTax = Number(m.valueWithTax || m.valuation || 0);
      const vWithoutTax = Number(m.valueWithoutTax || 0);
      const tVal = Number(m.taxValue || (vWithTax - vWithoutTax));

      totVal += vWithTax;
      totValWithTax += vWithTax;
      totValWithoutTax += vWithoutTax;
      totTax += tVal;

      totIn += Number(m.periodInQty || 0);
      totOut += Number(m.periodOutQty || 0);
      totWip += wip;
      totAvail += avail;
      totRejected += Number(m.labRejectedQty || 0);
      if (m.hasLabRejection) rejectedCount++;

      if (Number(m.periodInQty || 0) > 0 || Number(m.periodOutQty || 0) > 0) {
        activeCount++;
      }
    });

    return {
      totalMaterials: sourceList.length,
      totalCurrentStock: Math.round(totStock * 100) / 100,
      totalInProgressStock: Math.round(totWip * 100) / 100,
      totalAvailableStock: Math.round(totAvail * 100) / 100,
      totalPeriodIn: Math.round(totIn * 100) / 100,
      totalPeriodOut: Math.round(totOut * 100) / 100,
      totalLabRejectedQty: Math.round(totRejected * 100) / 100,
      totalLabRejectedCount: rejectedCount,
      netMovement: Math.round((totIn - totOut) * 100) / 100,
      totalValuation: Math.round((totValWithTax || totVal) * 100) / 100,
      totalValuationWithTax: Math.round((totValWithTax || totVal) * 100) / 100,
      totalValuationWithoutTax: Math.round(totValWithoutTax * 100) / 100,
      totalTaxAmount: Math.round(totTax * 100) / 100,
      activeMovementCount: activeCount,
      periodLabel: dedicatedData?.summary?.periodLabel || periodDisplayText.label,
      periodDateRange: dedicatedData?.summary?.periodDateRange || periodDisplayText.rangeText,
      isHistorical: dedicatedData?.summary?.isHistorical ?? periodDisplayText.isHistorical
    };
  }, [dedicatedData, categoryFilter, codeFilter, searchTerm, categoryAndSearchFilteredMaterials, unifiedMaterials, periodDisplayText]);

  // Distinct Categories for Searchable Dropdown
  const categoryOptions = useMemo(() => {
    const counts = {};
    unifiedMaterials.forEach(item => {
      const cat = item.category || 'Uncategorised';
      counts[cat] = (counts[cat] || 0) + 1;
    });

    const list = Object.keys(counts)
      .sort((a, b) => a.localeCompare(b))
      .map(cat => ({
        value: cat,
        label: cat,
        subLabel: `${counts[cat]} materials`,
        badge: counts[cat]
      }));

    return [
      { value: 'ALL', label: `All Categories (${unifiedMaterials.length})`, badge: unifiedMaterials.length },
      ...list
    ];
  }, [unifiedMaterials]);

  // Distinct RM Codes for Searchable Dropdown
  const codeOptions = useMemo(() => {
    const list = unifiedMaterials.map(item => ({
      value: item.code,
      label: item.code,
      subLabel: `${item.name} (${item.category || 'Uncategorised'})`,
      badge: `${item.currentStock} ${item.uom}`
    }));

    return [
      { value: 'ALL', label: `All RM Codes (${unifiedMaterials.length})`, badge: unifiedMaterials.length },
      ...list
    ];
  }, [unifiedMaterials]);

  // Sync state with URL params
  useEffect(() => {
    const params = new URLSearchParams();
    if (period !== 'this_month') params.set('period', period);
    if (period === 'custom') {
      if (appliedCustomStart) params.set('startDate', appliedCustomStart);
      if (appliedCustomEnd) params.set('endDate', appliedCustomEnd);
    }
    if (searchTerm) params.set('search', searchTerm);
    if (categoryFilter !== 'ALL') params.set('category', categoryFilter);
    if (codeFilter !== 'ALL') params.set('code', codeFilter);
    setSearchParams(params, { replace: true });
  }, [period, appliedCustomStart, appliedCustomEnd, searchTerm, categoryFilter, codeFilter, setSearchParams]);

  // Reset pagination on filter or view changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, categoryFilter, codeFilter, movementFilter, sortBy, period, appliedCustomStart, appliedCustomEnd, viewMode]);

  // Handle Custom Date Range Apply
  const handleApplyCustomRange = (e) => {
    e?.preventDefault();
    if (!customStartDate && !customEndDate) {
      Swal.fire({
        icon: 'warning',
        title: 'Select Dates',
        text: 'Please select a start date and/or end date for the custom period.',
        timer: 3000,
        toast: true,
        position: 'top-end'
      });
      return;
    }
    setPeriod('custom');
    setAppliedCustomStart(customStartDate);
    setAppliedCustomEnd(customEndDate);
  };

  // Handle Custom Date Range Clear
  const handleClearCustomRange = () => {
    setCustomStartDate('');
    setCustomEndDate('');
    setAppliedCustomStart('');
    setAppliedCustomEnd('');
  };

  // Universal Column Sorting Handler (Toggles ASC / DESC or changes field)
  const handleColumnSort = (field) => {
    setSortBy(prev => {
      if (prev === `${field}_asc`) return `${field}_desc`;
      if (prev === `${field}_desc`) return `${field}_asc`;
      // Default initial direction: numbers descending, strings ascending
      const defaultDescFields = ['stock', 'wip', 'free', 'in', 'out', 'net', 'valuation', 'amount', 'rate', 'date'];
      return defaultDescFields.includes(field) ? `${field}_desc` : `${field}_asc`;
    });
  };

  // Helper to render sort arrows in table headers
  const renderSortIndicator = (field) => {
    if (sortBy === `${field}_desc`) {
      return <ArrowDown className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0" />;
    }
    if (sortBy === `${field}_asc`) {
      return <ArrowUp className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0" />;
    }
    return <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-60 group-hover:opacity-100 shrink-0 transition-opacity" />;
  };

  // Filtered & Sorted Materials
  const filteredMaterials = useMemo(() => {
    let result = unifiedMaterials.filter(item => {
      // 1. Advanced Text Search across multiple dimensions
      if (searchTerm.trim()) {
        const targets = getMaterialSearchableTargets(item);
        if (!matchesAdvancedSearch(targets, searchTerm)) return false;
      }

      // 2. Category Dropdown Filter
      if (categoryFilter !== 'ALL') {
        if ((item.category || 'Uncategorised') !== categoryFilter) return false;
      }

      // 3. RM Code Dropdown Filter
      if (codeFilter !== 'ALL') {
        if (item.code !== codeFilter) return false;
      }

      // 4. Movement & Status Filters (Interactive from KPI Cards & Charts)
      if (period !== 'all' && movementFilter === 'ALL') {
        const hasMovement = Number(item.periodInQty || 0) > 0 || Number(item.periodOutQty || 0) > 0;
        if (!hasMovement) return false;
      }

      if (movementFilter === 'IN_PROGRESS') {
        if (Number(item.inProgressStock || 0) <= 0) return false;
      } else if (movementFilter === 'FREE_AVAILABLE') {
        if (Number(item.availableStock !== undefined ? item.availableStock : Math.max(0, (item.currentStock || 0) - (item.inProgressStock || 0))) <= 0) return false;
      } else if (movementFilter === 'LAB_REJECTED') {
        if (!item.hasLabRejection && item.labStatus !== 'LAB_REJECTED') return false;
      } else if (movementFilter === 'WITH_MOVEMENT') {
        if (Number(item.periodInQty || 0) === 0 && Number(item.periodOutQty || 0) === 0) return false;
      } else if (movementFilter === 'IN_ONLY') {
        if (Number(item.periodInQty || 0) <= 0) return false;
      } else if (movementFilter === 'OUT_ONLY') {
        if (Number(item.periodOutQty || 0) <= 0) return false;
      } else if (movementFilter === 'NET_POSITIVE') {
        if (Number(item.netMovement || 0) <= 0) return false;
      } else if (movementFilter === 'NET_NEGATIVE') {
        if (Number(item.netMovement || 0) >= 0) return false;
      } else if (movementFilter === 'LOW_STOCK') {
        if (item.status !== 'LOW_STOCK') return false;
      } else if (movementFilter === 'OUT_OF_STOCK') {
        if (item.status !== 'OUT_OF_STOCK') return false;
      }

      return true;
    });

    // Dynamic Multi-Field Sorting
    result.sort((a, b) => {
      // Code
      if (sortBy === 'code_asc') return (a.code || '').localeCompare(b.code || '', undefined, { numeric: true, sensitivity: 'base' });
      if (sortBy === 'code_desc') return (b.code || '').localeCompare(a.code || '', undefined, { numeric: true, sensitivity: 'base' });

      // Name
      if (sortBy === 'name_asc') return (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' });
      if (sortBy === 'name_desc') return (b.name || '').localeCompare(a.name || '', undefined, { sensitivity: 'base' });

      // Category
      if (sortBy === 'category_asc') return (a.category || '').localeCompare(b.category || '', undefined, { sensitivity: 'base' });
      if (sortBy === 'category_desc') return (b.category || '').localeCompare(a.category || '', undefined, { sensitivity: 'base' });

      // UOM
      if (sortBy === 'uom_asc') return (a.uom || '').localeCompare(b.uom || '', undefined, { sensitivity: 'base' });
      if (sortBy === 'uom_desc') return (b.uom || '').localeCompare(a.uom || '', undefined, { sensitivity: 'base' });

      // In-Hand Stock
      if (sortBy === 'stock_desc') return Number(b.currentStock || 0) - Number(a.currentStock || 0);
      if (sortBy === 'stock_asc') return Number(a.currentStock || 0) - Number(b.currentStock || 0);

      // Floor WIP
      if (sortBy === 'wip_desc') return Number(b.inProgressStock || 0) - Number(a.inProgressStock || 0);
      if (sortBy === 'wip_asc') return Number(a.inProgressStock || 0) - Number(b.inProgressStock || 0);

      // Free Available
      if (sortBy === 'free_desc') return Number(b.availableStock || 0) - Number(a.availableStock || 0);
      if (sortBy === 'free_asc') return Number(a.availableStock || 0) - Number(b.availableStock || 0);

      // Period Inward
      if (sortBy === 'in_desc') return Number(b.periodInQty || 0) - Number(a.periodInQty || 0);
      if (sortBy === 'in_asc') return Number(a.periodInQty || 0) - Number(b.periodInQty || 0);

      // Period Outward
      if (sortBy === 'out_desc') return Number(b.periodOutQty || 0) - Number(a.periodOutQty || 0);
      if (sortBy === 'out_asc') return Number(a.periodOutQty || 0) - Number(b.periodOutQty || 0);

      // Net Movement
      if (sortBy === 'net_desc') return Number(b.netMovement || 0) - Number(a.netMovement || 0);
      if (sortBy === 'net_asc') return Number(a.netMovement || 0) - Number(b.netMovement || 0);

      // Valuation
      if (sortBy === 'valuation_desc') return Number(b.valuation || 0) - Number(a.valuation || 0);
      if (sortBy === 'valuation_asc') return Number(a.valuation || 0) - Number(b.valuation || 0);

      // Rate
      if (sortBy === 'rate_desc') return Number(b.ratePerUnit || 0) - Number(a.ratePerUnit || 0);
      if (sortBy === 'rate_asc') return Number(a.ratePerUnit || 0) - Number(b.ratePerUnit || 0);

      // QC Status (Rejections first)
      if (sortBy === 'qc_desc') return (b.hasLabRejection ? 1 : 0) - (a.hasLabRejection ? 1 : 0);
      if (sortBy === 'qc_asc') return (a.hasLabRejection ? 1 : 0) - (b.hasLabRejection ? 1 : 0);

      return 0;
    });

    return result;
  }, [unifiedMaterials, searchTerm, categoryFilter, codeFilter, movementFilter, sortBy, matchesAdvancedSearch]);

  // Filtered Date-Wise Ledger Transactions
  const filteredTransactions = useMemo(() => {
    let result = unifiedAllTransactions.filter(tx => {
      // 1. Advanced Keyword search
      if (searchTerm.trim()) {
        const targets = [
          tx.rawMaterialCode,
          tx.rawMaterialName,
          tx.category,
          tx.referenceNo,
          tx.poReferenceNo,
          tx.batchNumber,
          tx.partyName,
          tx.user,
          tx.notes,
          tx.compositeComment,
          tx.uom
        ];
        if (!matchesAdvancedSearch(targets, searchTerm)) return false;
      }

      // 2. Category Dropdown
      if (categoryFilter !== 'ALL') {
        if ((tx.category || 'Uncategorised') !== categoryFilter) return false;
      }

      // 3. RM Code Dropdown
      if (codeFilter !== 'ALL') {
        if (tx.rawMaterialCode !== codeFilter) return false;
      }

      // 4. Movement Filter
      if (movementFilter === 'IN_PROGRESS') {
        if (!tx.isInProgress && tx.batchStatus !== 'IN_PROGRESS') return false;
      } else if (movementFilter === 'LAB_REJECTED') {
        if (!tx.isLabRejected && tx.labStatus !== 'LAB_REJECTED') return false;
      } else if (movementFilter === 'IN_ONLY') {
        if (tx.flow !== 'IN') return false;
      } else if (movementFilter === 'OUT_ONLY') {
        if (tx.flow !== 'OUT') return false;
      }

      return true;
    });

    // Ledger Sorting
    result.sort((a, b) => {
      if (sortBy === 'date_desc') return new Date(b.date) - new Date(a.date);
      if (sortBy === 'date_asc') return new Date(a.date) - new Date(b.date);
      if (sortBy === 'code_asc') return (a.rawMaterialCode || '').localeCompare(b.rawMaterialCode || '', undefined, { numeric: true });
      if (sortBy === 'code_desc') return (b.rawMaterialCode || '').localeCompare(a.rawMaterialCode || '', undefined, { numeric: true });
      if (sortBy === 'name_asc') return (a.rawMaterialName || '').localeCompare(b.rawMaterialName || '');
      if (sortBy === 'name_desc') return (b.rawMaterialName || '').localeCompare(a.rawMaterialName || '');
      if (sortBy === 'category_asc') return (a.category || '').localeCompare(b.category || '');
      if (sortBy === 'category_desc') return (b.category || '').localeCompare(a.category || '');
      if (sortBy === 'uom_asc') return (a.uom || '').localeCompare(b.uom || '');
      if (sortBy === 'uom_desc') return (b.uom || '').localeCompare(a.uom || '');
      if (sortBy === 'ref_asc') return (a.referenceNo || '').localeCompare(b.referenceNo || '');
      if (sortBy === 'ref_desc') return (b.referenceNo || '').localeCompare(a.referenceNo || '');
      if (sortBy === 'batch_asc') return (a.batchNumber || '').localeCompare(b.batchNumber || '');
      if (sortBy === 'batch_desc') return (b.batchNumber || '').localeCompare(a.batchNumber || '');
      if (sortBy === 'in_desc') return (b.flow === 'IN' ? b.quantity : 0) - (a.flow === 'IN' ? a.quantity : 0);
      if (sortBy === 'in_asc') return (a.flow === 'IN' ? a.quantity : 0) - (b.flow === 'IN' ? b.quantity : 0);
      if (sortBy === 'out_desc') return (b.flow === 'OUT' ? b.quantity : 0) - (a.flow === 'OUT' ? a.quantity : 0);
      if (sortBy === 'out_asc') return (a.flow === 'OUT' ? a.quantity : 0) - (b.flow === 'OUT' ? b.quantity : 0);
      if (sortBy === 'rate_desc') return Number(b.rate || 0) - Number(a.rate || 0);
      if (sortBy === 'rate_asc') return Number(a.rate || 0) - Number(b.rate || 0);
      if (sortBy === 'amount_desc') return Number(b.amount || 0) - Number(a.amount || 0);
      if (sortBy === 'amount_asc') return Number(a.amount || 0) - Number(b.amount || 0);
      if (sortBy === 'qc_desc') return (b.isLabRejected ? 1 : 0) - (a.isLabRejected ? 1 : 0);
      if (sortBy === 'qc_asc') return (a.isLabRejected ? 1 : 0) - (b.isLabRejected ? 1 : 0);
      if (sortBy === 'party_asc') return (a.partyName || '').localeCompare(b.partyName || '');
      if (sortBy === 'party_desc') return (b.partyName || '').localeCompare(a.partyName || '');
      return 0;
    });

    return result;
  }, [unifiedAllTransactions, searchTerm, categoryFilter, codeFilter, movementFilter, sortBy, matchesAdvancedSearch]);

  // Pagination for Materials
  const totalMaterialPages = Math.ceil(filteredMaterials.length / itemsPerPage) || 1;
  const paginatedMaterials = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredMaterials.slice(start, start + itemsPerPage);
  }, [filteredMaterials, currentPage, itemsPerPage]);

  // Pagination for Transactions (Ledger View)
  const totalTransactionPages = Math.ceil(filteredTransactions.length / itemsPerPage) || 1;
  const paginatedTransactions = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredTransactions.slice(start, start + itemsPerPage);
  }, [filteredTransactions, currentPage, itemsPerPage]);

  // Safe UOM Formatter to prevent any UUID leakage
  const formatUOM = (uom) => {
    if (!uom) return 'Nos';
    const str = String(uom).trim();
    if (/^[0-9a-fA-F-]{32,36}$/.test(str)) {
      return 'Nos';
    }
    return str;
  };

  // Date formatting helpers
  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return '—';
      return d.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });
    } catch {
      return String(dateStr);
    }
  };

  // Helper to format date as DD-MM-YYYY (matching user's Excel column headers)
  const formatDDMMYYYY = (dateStr) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return '';
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `${day}-${month}-${year}`;
    } catch {
      return '';
    }
  };

  const parseDDMMYYYY = (str) => {
    if (!str) return 0;
    const parts = str.split('-');
    if (parts.length === 3) {
      return new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0])).getTime();
    }
    return 0;
  };

  // Dynamic Movement Matrix Data and Movement Dates:
  // Strictly derived from `filteredMaterials`.
  // Rule: Only dates with actual IN or OUT movements (> 0) for the currently filtered/searched materials are displayed.
  // When a user searches or changes any single RM code or filters materials, ONLY dates where that raw material
  // has available IN or OUT data are displayed. If there is no movement on that date, it is NOT displayed.
  const { matrixDates, matrixData } = useMemo(() => {
    if (!filteredMaterials || filteredMaterials.length === 0) {
      return { matrixDates: [], matrixData: {} };
    }

    // Quick lookup maps for filtered materials by ID and Code
    const filteredMatMap = new Map();
    const filteredCodeMap = new Map();
    filteredMaterials.forEach(m => {
      filteredMatMap.set(m.id, m);
      if (m.code) {
        filteredCodeMap.set(String(m.code).trim().toUpperCase(), m);
      }
    });

    // Collect all valid transactions with quantity > 0 for filtered materials
    const relevantTxs = [];
    const seenTxKeys = new Set();

    const processTx = (tx, fallbackMatId) => {
      if (!tx) return;
      const qty = Number(tx.quantity || 0);
      if (qty <= 0) return; // No zero-movement records

      let targetMat = null;
      if (tx.rawMaterialId && filteredMatMap.has(tx.rawMaterialId)) {
        targetMat = filteredMatMap.get(tx.rawMaterialId);
      } else if (tx.rawMaterialCode && filteredCodeMap.has(String(tx.rawMaterialCode).trim().toUpperCase())) {
        targetMat = filteredCodeMap.get(String(tx.rawMaterialCode).trim().toUpperCase());
      } else if (fallbackMatId && filteredMatMap.has(fallbackMatId)) {
        targetMat = filteredMatMap.get(fallbackMatId);
      }

      if (!targetMat) return; // Transaction does not belong to any currently filtered material

      const effectiveDate = (tx.flow === 'IN' && (tx.supplierInvoiceDate || tx.invoiceDate))
        ? (tx.supplierInvoiceDate || tx.invoiceDate)
        : tx.date;
      if (!effectiveDate) return;

      const dStr = formatDDMMYYYY(effectiveDate);
      if (!dStr) return;

      // Unique transaction identifier to avoid duplicates between allTransactions and material.transactions
      const txKey = `${tx.id || ''}_${targetMat.id}_${tx.flow || ''}_${dStr}_${qty}_${tx.referenceNo || ''}_${tx.batchNumber || ''}`;
      if (seenTxKeys.has(txKey)) return;
      seenTxKeys.add(txKey);

      relevantTxs.push({
        ...tx,
        resolvedMatId: targetMat.id,
        effectiveDateStr: dStr
      });
    };

    // First process unifiedAllTransactions
    (unifiedAllTransactions || []).forEach(tx => processTx(tx));

    // Also verify materials' own transactions list in case of historical cache differences
    filteredMaterials.forEach(m => {
      if (Array.isArray(m.transactions)) {
        m.transactions.forEach(tx => processTx(tx, m.id));
      }
    });

    // Aggregate into a temporary map: materialId -> dateStr -> { inQty, outQty, transactions }
    const tempMap = {};
    filteredMaterials.forEach(m => {
      tempMap[m.id] = {};
    });

    const activeDateMap = new Map();

    relevantTxs.forEach(tx => {
      const matId = tx.resolvedMatId;
      const dStr = tx.effectiveDateStr;

      if (!tempMap[matId]) {
        tempMap[matId] = {};
      }
      if (!tempMap[matId][dStr]) {
        tempMap[matId][dStr] = { inQty: 0, outQty: 0, transactions: [] };
      }

      const qty = Number(tx.quantity || 0);
      if (tx.flow === 'IN') {
        tempMap[matId][dStr].inQty += qty;
      } else {
        tempMap[matId][dStr].outQty += qty;
      }
      tempMap[matId][dStr].transactions.push(tx);

      // Register this date as active
      if (!activeDateMap.has(dStr)) {
        activeDateMap.set(dStr, parseDDMMYYYY(dStr));
      }
    });

    // Chronologically sort all dates that have verified movements (> 0) among filtered materials
    const sortedDates = Array.from(activeDateMap.keys()).sort(
      (a, b) => activeDateMap.get(a) - activeDateMap.get(b)
    );

    // Final filter: ensure every date in sortedDates has inQty > 0 || outQty > 0 for at least one filtered material
    const finalDates = sortedDates.filter(dStr => {
      return filteredMaterials.some(m => {
        const cell = tempMap[m.id]?.[dStr];
        return cell && (Number(cell.inQty || 0) > 0 || Number(cell.outQty || 0) > 0);
      });
    });

    // Initialize full grid so all filtered materials have defined entries for all finalDates
    const finalData = {};
    filteredMaterials.forEach(m => {
      finalData[m.id] = {};
      finalDates.forEach(dStr => {
        finalData[m.id][dStr] = tempMap[m.id]?.[dStr] || { inQty: 0, outQty: 0, transactions: [] };
      });
    });

    return {
      matrixDates: finalDates,
      matrixData: finalData
    };
  }, [filteredMaterials, unifiedAllTransactions]);

  const formatDateTime = (dateStr) => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return String(dateStr);
    }
  };

  // Open Full History Drawer
  const handleOpenHistory = (matId, tab = 'timeline') => {
    setSelectedMaterialId(matId);
    setHistoryInitialTab(tab);
    setIsHistoryOpen(true);
  };

  // Open Stock Query Modal
  const handleOpenStockQuery = (matId) => {
    setSelectedStockQueryId(matId);
    setIsStockQueryOpen(true);
  };

  // Redirection handler for PO
  const handleRedirectToPO = (poId, poRef) => {
    if (poId) {
      navigate(`/purchase-orders/${poId}`);
    } else if (poRef) {
      navigate(`/purchase-orders?search=${encodeURIComponent(poRef)}`);
    } else {
      navigate('/purchase-orders');
    }
  };

  // Redirection handler for GRN
  const handleRedirectToGRN = (grnId, grnRef) => {
    if (grnId) {
      navigate(`/grn/view/${grnId}`);
    } else if (grnRef) {
      navigate(`/grn/list?search=${encodeURIComponent(grnRef)}`);
    } else {
      navigate('/grn/list');
    }
  };

  // Redirection handler for Production Batch
  const handleRedirectToBatch = (batchId, batchNo) => {
    navigate('/production/standard');
  };

  // =========================================================================
  // EXPORT ENGINE (2 Dedicated Types + Master Multi-Sheet Workbook)
  // =========================================================================

  // Build Summary Rows
  const generateSummaryExportRows = useCallback(() => {
    return filteredMaterials.map(m => {
      const cur = Number(m.currentStock || 0);
      const wip = Number(m.inProgressStock || 0);
      const free = m.availableStock !== undefined ? Number(m.availableStock) : Math.max(0, cur - wip);
      const rate = Number(m.ratePerUnit || 0);
      const val = Number(m.valuation || 0);
      const poRef = m.poReferenceNo || 'N/A';
      const lastInBatch = m.lastIn?.ref || 'N/A';
      const qcStatus = m.hasLabRejection ? '❌ LAB REJECTED' : 'APPROVED / QC PASSED';

      const compositeComment = `PO: ${poRef} | Batch: ${lastInBatch} | In-Hand: ${cur} ${m.uom} | WIP: ${wip} | Free: ${free} | Rate: ₹${rate.toFixed(2)} | Valuation: ₹${val.toFixed(2)} | QC: ${qcStatus}`;

      return {
        'RM Code': m.code || '—',
        'Raw Material Name': m.name || '—',
        'Category': m.category || '—',
        'UOM': formatUOM(m.uom),
        'Total Current Stock (In Hand)': cur,
        'In-Progress Stock (Floor WIP)': wip,
        'Available Stock (Free for Orders)': free,
        [`Period Inward IN (${period})`]: m.periodInQty || 0,
        [`Period Outward OUT (${period})`]: m.periodOutQty || 0,
        'Net Movement': m.netMovement || 0,
        'Standard Rate (₹/Unit)': rate,
        'Total Valuation (₹)': val,
        'Stock Status': m.status || 'OPTIMAL',
        'Floor WIP Status': wip > 0 ? 'ACTIVE WIP RUNNING' : 'IDLE',
        'Latest PO Number': poRef,
        'Latest Inward Batch / Ref': lastInBatch,
        'Last Inward Date': m.lastIn ? formatDate(m.lastIn.date) : '—',
        'Last Outward Ref': m.lastOut?.ref || '—',
        'Last Outward Date': m.lastOut ? formatDate(m.lastOut.date) : '—',
        'Lab & Quality Decision': qcStatus,
        'Lab Rejected Quantity': m.labRejectedQty || 0,
        'Audit Comment & Inventory Notes': compositeComment
      };
    });
  }, [filteredMaterials, period]);

  // Build Ledger Rows (includes Supplier Invoice Date & Invoice Number)
  const generateLedgerExportRows = useCallback(() => {
    return filteredTransactions.map(tx => {
      const isIn = tx.flow === 'IN';
      const rate = Number(tx.rate || 0);
      const qty = Number(tx.quantity || 0);
      const amt = Number(tx.amount || (rate * qty) || 0);
      const qcStatus = tx.isLabRejected ? '❌ LAB REJECTED' : (tx.labStatus || 'PASSED');
      const invDate = tx.supplierInvoiceDate ? formatDate(tx.supplierInvoiceDate) : '—';
      const invNo = tx.supplierInvoiceNo || '—';

      const compositeComment = tx.compositeComment || `PO: ${tx.poReferenceNo || 'N/A'}${invDate !== '—' ? ` | Supplier Inv Date: ${invDate}` : ''}${invNo !== '—' ? ` | Inv No: ${invNo}` : ''} | Batch: ${tx.batchNumber || 'N/A'} | Qty: ${qty} ${tx.uom || ''} | Rate: ₹${rate.toFixed(2)} | Amount: ₹${amt.toFixed(2)} | QC: ${qcStatus}${tx.rejectionReason ? ` | Rejection: ${tx.rejectionReason}` : ''}`;

      return {
        'Date & Time': formatDateTime(tx.date),
        'Flow Direction': tx.flow === 'IN' ? 'INWARD (IN)' : 'OUTWARD (OUT)',
        'Batch Status': tx.isInProgress ? '🟡 IN PROGRESS (WIP)' : 'COMPLETED',
        'Transaction Type': tx.typeLabel || 'Movement',
        'RM Code': tx.rawMaterialCode || '—',
        'Raw Material Name': tx.rawMaterialName || '—',
        'Category': tx.category || '—',
        'UOM': tx.uom || 'Unit',
        'Document Reference': tx.referenceNo || '—',
        'PO Reference': tx.poReferenceNo || '—',
        'Supplier Invoice Date': invDate,
        'Supplier Invoice No': invNo,
        'Batch / Lot Number': tx.batchNumber || '—',
        'Inward Qty (IN)': isIn ? qty : 0,
        'Outward Qty (OUT)': !isIn ? qty : 0,
        'Floor WIP Allocated': tx.isInProgress ? qty : 0,
        'Unit Rate (₹)': rate,
        'Transaction Amount (₹)': amt,
        'Quality & Lab Decision': qcStatus,
        'Rejection / Discrepancy Note': tx.rejectionReason || tx.notes || '—',
        'Supplier / Destination Party': tx.partyName || '—',
        'Handled By / Operator': tx.user || '—',
        'Detailed Audit Comment': compositeComment
      };
    });
  }, [filteredTransactions]);

  // Build Date-Wise Movement Matrix Rows (Matching user's Excel format with Green IN & Red OUT data)
  const generateMatrixExportRows = useCallback(() => {
    return filteredMaterials.map(m => {
      const cur = Number(m.currentStock || 0);
      const wip = Number(m.inProgressStock || 0);
      const free = m.availableStock !== undefined ? Number(m.availableStock) : Math.max(0, cur - wip);
      const val = Number(m.valuation || 0);

      const row = {
        'RM Code': m.code || '—',
        'Raw Material Name': m.name || '—',
        'Category': m.category || '—',
        'UOM': formatUOM(m.uom),
        'TotalStock': cur,
        'Available Stock': free,
        [`Period Inward IN (${period})`]: Number(m.periodInQty || 0),
        [`Period Outward OUT (${period})`]: Number(m.periodOutQty || 0),
        'Total Valuation (₹)': val
      };

      // Populate dynamic chronological date columns
      matrixDates.forEach(dStr => {
        const cell = matrixData[m.id]?.[dStr];
        if (cell) {
          const hasIn = cell.inQty > 0;
          const hasOut = cell.outQty > 0;
          if (hasIn && hasOut) {
            row[dStr] = `+${cell.inQty} / -${cell.outQty}`;
          } else if (hasIn) {
            row[dStr] = cell.inQty;
          } else if (hasOut) {
            row[dStr] = cell.outQty;
          } else {
            row[dStr] = '';
          }
        } else {
          row[dStr] = '';
        }
      });

      return row;
    });
  }, [filteredMaterials, matrixDates, matrixData, period]);

  // Build Supplier Invoice Inward Audit Rows (Dedicated audit for Supplier Invoice Date e.g. 15 Oct 2026)
  const generateSupplierInvoiceAuditRows = useCallback(() => {
    return unifiedAllTransactions
      .filter(tx => tx.flow === 'IN')
      .map(tx => {
        const invDate = tx.supplierInvoiceDate ? formatDate(tx.supplierInvoiceDate) : (tx.date ? formatDate(tx.date) : '—');
        return {
          'Movement Date': formatDate(tx.date),
          'Supplier Invoice Date': invDate,
          'Supplier Invoice No': tx.supplierInvoiceNo || '—',
          'RM Code': tx.rawMaterialCode || '—',
          'Raw Material Name': tx.rawMaterialName || '—',
          'Category': tx.category || '—',
          'Inward Quantity (IN)': Number(tx.quantity || 0),
          'UOM': formatUOM(tx.uom),
          'Document Reference': tx.referenceNo || '—',
          'PO Reference': tx.poReferenceNo || tx.referenceNo || '—',
          'Batch / Lot Number': tx.batchNumber || '—',
          'Unit Rate (₹)': Number(tx.rate || 0),
          'Valuation Amount (₹)': Number(tx.amount || 0),
          'Quality Decision': tx.isLabRejected ? '❌ LAB REJECTED' : (tx.labStatus || 'PASSED'),
          'Supplier / Vendor': tx.partyName || '—',
          'Received By': tx.user || '—'
        };
      });
  }, [unifiedAllTransactions]);

  // Export Trigger: Type 1 (Date-Wise In-Out Matrix Report matching user's Excel format)
  const handleExportMatrixOnly = async () => {
    try {
      setIsExportModalOpen(false);
      const fileName = await exportStockInOutMatrixToExcel({
        materials: filteredMaterials,
        matrixDates,
        matrixData,
        period,
        allTransactions: unifiedAllTransactions
      });

      Swal.fire({
        icon: 'success',
        title: 'Stock In-Out Matrix Exported',
        text: `Exported ${filteredMaterials.length} raw materials across ${matrixDates.length} date columns with PO Supplier Invoice audit to ${fileName}`,
        timer: 3500,
        toast: true,
        position: 'top-end',
        showConfirmButton: false
      });
    } catch (err) {
      console.error('Export matrix failed:', err);
      Swal.fire({ icon: 'error', title: 'Export Failed', text: err.message });
    }
  };

  // Export Trigger: Type 2 (Master Summary Only)
  const handleExportSummaryOnly = async () => {
    try {
      setIsExportModalOpen(false);
      const fileName = await exportMasterSummaryToExcel({
        materials: filteredMaterials,
        period
      });

      Swal.fire({
        icon: 'success',
        title: 'Master Summary Exported',
        text: `Exported ${filteredMaterials.length} raw material records with Green IN & Red OUT indicators to ${fileName}`,
        timer: 3000,
        toast: true,
        position: 'top-end',
        showConfirmButton: false
      });
    } catch (err) {
      console.error('Export summary failed:', err);
      Swal.fire({ icon: 'error', title: 'Export Failed', text: err.message });
    }
  };

  // Export Trigger: Type 3 (Ledger Only)
  const handleExportLedgerOnly = async () => {
    try {
      setIsExportModalOpen(false);
      const fileName = await exportDateWiseLedgerToExcel({
        transactions: filteredTransactions,
        period
      });

      Swal.fire({
        icon: 'success',
        title: 'Date Ledger Exported',
        text: `Exported ${filteredTransactions.length} chronological audit transactions with Green IN & Red OUT indicators to ${fileName}`,
        timer: 3000,
        toast: true,
        position: 'top-end',
        showConfirmButton: false
      });
    } catch (err) {
      console.error('Export ledger failed:', err);
      Swal.fire({ icon: 'error', title: 'Export Failed', text: err.message });
    }
  };

  // Export Trigger: Type 4 (All-in-One Multi-Sheet Master Enterprise Workbook)
  const handleExportCompleteWorkbook = async () => {
    try {
      setIsExportModalOpen(false);
      const fileName = await exportCompleteEnterpriseWorkbookToExcel({
        materials: filteredMaterials,
        matrixDates,
        matrixData,
        period,
        allTransactions: unifiedAllTransactions
      });

      Swal.fire({
        icon: 'success',
        title: 'Master Enterprise Workbook Exported',
        text: `Exported multi-sheet workbook containing Date-Wise Matrix, Summary, Chronological Ledger, and Supplier Invoice audits to ${fileName}`,
        timer: 3500,
        toast: true,
        position: 'top-end',
        showConfirmButton: false
      });
    } catch (err) {
      console.error('Export workbook failed:', err);
      Swal.fire({ icon: 'error', title: 'Export Failed', text: err.message });
    }
  };

  const isAnyLoading = isBaseLoading;
  const isAnyFetching = isBaseFetching || isDedicatedFetching;

  // Total volume moved for visual distribution chart calculation
  const totalVolumeCalculated = useMemo(() => {
    return Math.max(1, (summary.totalPeriodIn || 0) + (summary.totalPeriodOut || 0) + (summary.totalInProgressStock || 0));
  }, [summary]);

  return (
    <div className="w-full min-h-screen bg-slate-50/70 dark:bg-slate-950 p-1 sm:p-1.5 space-y-1 transition-colors">
      {/* ── TOP HEADER & ACTIONS (High-Density Bar with Auto-Refresh & No Refresh Button) ── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2 sm:px-2.5 py-1.5 shadow-2xs">
        <div className="space-y-0.5">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="p-1 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60">
              <Boxes className="w-4 h-4" />
            </span>
            <h1 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight">
              RM-IN-OUT Stock
            </h1>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300 font-semibold uppercase tracking-wider">
              Stock In & Out Ledger
            </span>

            {/* Interactive Header WIP Badge - Clickable to Filter */}
            {summary.totalInProgressStock > 0 && (
              <button
                type="button"
                onClick={() => setMovementFilter(movementFilter === 'IN_PROGRESS' ? 'ALL' : 'IN_PROGRESS')}
                className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-bold border transition-all cursor-pointer ${
                  movementFilter === 'IN_PROGRESS'
                    ? 'bg-amber-500 text-white border-amber-600 shadow-xs ring-1.5 ring-amber-300'
                    : 'bg-amber-100 hover:bg-amber-200 dark:bg-amber-950/70 text-amber-900 dark:text-amber-300 border-amber-300 dark:border-amber-800'
                }`}
                title="Click to filter by Floor WIP Run"
              >
                <span className={`w-1.5 h-1.5 rounded-full ${movementFilter === 'IN_PROGRESS' ? 'bg-white' : 'bg-amber-500'} animate-pulse`} />
                <span>Floor WIP: {summary.totalInProgressStock}</span>
              </button>
            )}

            {/* Interactive Header Lab Rejected Badge - Clickable to Filter */}
            {summary.totalLabRejectedCount > 0 && (
              <button
                type="button"
                onClick={() => setMovementFilter(movementFilter === 'LAB_REJECTED' ? 'ALL' : 'LAB_REJECTED')}
                className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-bold border transition-all cursor-pointer ${
                  movementFilter === 'LAB_REJECTED'
                    ? 'bg-rose-600 text-white border-rose-700 shadow-xs ring-1.5 ring-rose-300'
                    : 'bg-rose-100 hover:bg-rose-200 dark:bg-rose-950/70 text-rose-900 dark:text-rose-300 border-rose-300 dark:border-rose-800'
                }`}
                title="Click to filter by Lab Rejections"
              >
                <AlertOctagon className="w-3 h-3 text-rose-600" />
                <span>Lab Rejected: {summary.totalLabRejectedCount} Items</span>
              </button>
            )}

            {/* Live Auto-Refresh Indicator Pulse */}
            {isAnyFetching && (
              <span className="inline-flex items-center gap-1 text-[9.5px] text-emerald-600 dark:text-emerald-400 font-medium animate-pulse ml-1">
                <Loader2 className="w-2.5 h-2.5 animate-spin" />
                <span>Auto-refreshing...</span>
              </span>
            )}
          </div>
          <p className="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 leading-tight">
            Raw material date-wise inward, outward, production consumption, adjustments & live stock audit
          </p>
        </div>

        {/* View Switcher, Density & Export Actions (Refresh button removed per request) */}
        <div className="flex flex-wrap items-center justify-between lg:justify-end gap-1.5 w-full lg:w-auto">
          {/* View Mode Switcher */}
          <div className="inline-flex max-w-full overflow-x-auto no-scrollbar p-0.5 bg-slate-100 dark:bg-slate-800 rounded-md border border-slate-200 dark:border-slate-700 text-xs font-medium shrink-0">
            <button
              type="button"
              onClick={() => { setViewMode('ledger'); setLedgerSubMode('matrix'); }}
              className={`px-2 sm:px-2.5 py-1 rounded text-xs flex items-center gap-1 transition-all cursor-pointer whitespace-nowrap ${
                viewMode === 'ledger' && ledgerSubMode === 'matrix'
                  ? 'bg-emerald-600 text-white shadow-2xs font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <TableProperties className="w-3 h-3 shrink-0" />
              <span>
                <span className="hidden sm:inline">Date-Wise <span className="hidden md:inline">Movement </span></span>Matrix
              </span>
              <span className={`text-[9.5px] px-1.5 py-0.2 rounded-full font-mono ${
                viewMode === 'ledger' && ledgerSubMode === 'matrix' ? 'bg-emerald-700 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
              }`}>
                <span className="hidden sm:inline">{matrixDates.length} Dates</span>
                <span className="sm:hidden">{matrixDates.length}</span>
              </span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('material')}
              className={`px-2 sm:px-2.5 py-1 rounded text-xs flex items-center gap-1 transition-all cursor-pointer whitespace-nowrap ${
                viewMode === 'material'
                  ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-2xs font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Package className="w-3 h-3 shrink-0" />
              <span>
                <span className="hidden sm:inline">Material </span>Summary
              </span>
            </button>
            <button
              type="button"
              onClick={() => { setViewMode('ledger'); setLedgerSubMode('stream'); }}
              className={`px-2 sm:px-2.5 py-1 rounded text-xs flex items-center gap-1 transition-all cursor-pointer whitespace-nowrap ${
                viewMode === 'ledger' && ledgerSubMode === 'stream'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Calendar className="w-3 h-3 shrink-0" />
              <span>
                <span className="hidden sm:inline">Transaction </span>Stream
              </span>
            </button>
          </div>

          <div className="flex items-center gap-1 sm:gap-1.5 ml-auto lg:ml-0">
            {/* Export Report Trigger */}
            <Button
              variant="default"
              size="sm"
              onClick={() => setIsExportModalOpen(true)}
              className="h-7 px-2.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-2xs flex items-center gap-1 cursor-pointer"
            >
              <Download className="w-3 h-3" />
              <span>Export Report</span>
              <ChevronDown className="w-2.5 h-2.5 ml-0.5 opacity-80" />
            </Button>
          </div>
        </div>
      </div>

      {/* ── KPI EXECUTIVE STAT CARDS (Ultra-Compact SAP Tool Style Strip) ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 xl:grid-cols-9 gap-1 sm:gap-1.5">
        {/* Card 1: TOTAL - TOTAL PO + TAX */}
        <div
          className="border border-emerald-300/90 dark:border-emerald-800/80 bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent dark:from-emerald-500/20 dark:via-slate-900 dark:to-slate-900 rounded-lg px-2 sm:px-2.5 py-1.5 transition-all select-none hover:border-emerald-400 shadow-2xs"
          title="Total stock valuation derived strictly from Purchase Orders including GST"
        >
          <div className="flex items-center justify-between text-emerald-800 dark:text-emerald-300 text-[10px]">
            <span className="font-bold truncate uppercase tracking-wider">Total - Total PO + Tax</span>
            <IndianRupee className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
          </div>
          <div className="text-[13px] sm:text-sm font-black text-emerald-700 dark:text-emerald-300 font-mono leading-tight tracking-tight my-0.5">
            ₹{Number(summary.totalValuationWithTax || summary.totalValuation || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
          </div>
          <div className="text-[9px] text-emerald-700/80 dark:text-emerald-400/80 truncate flex items-center justify-between gap-1 leading-none">
            <span className="truncate">PO Gross Valuation</span>
            <span className="text-[8px] sm:text-[8.5px] px-1 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/60 text-emerald-900 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-700 font-bold shrink-0 leading-none">
              PO Realtime
            </span>
          </div>
        </div>

        {/* Card 2: TAX - TAX AMOUNT */}
        <div
          className="border border-indigo-200/80 dark:border-indigo-900/40 bg-indigo-50/30 dark:bg-indigo-950/20 rounded-lg px-2 sm:px-2.5 py-1.5 transition-all select-none hover:border-indigo-300"
          title="Total PO-derived GST tax amount for current stock"
        >
          <div className="flex items-center justify-between text-indigo-700 dark:text-indigo-400 text-[10px]">
            <span className="font-semibold truncate uppercase tracking-wider">Tax - Tax Amount</span>
            <IndianRupee className="w-3 h-3 text-indigo-600 dark:text-indigo-400 shrink-0" />
          </div>
          <div className="text-[13px] sm:text-sm font-bold text-indigo-700 dark:text-indigo-300 font-mono leading-tight tracking-tight my-0.5">
            ₹{Number(summary.totalTaxAmount || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
          </div>
          <div className="text-[9px] text-indigo-600/80 dark:text-indigo-400/80 truncate flex items-center justify-between gap-1 leading-none">
            <span className="truncate">PO GST Amount</span>
            <span className="text-[8px] sm:text-[8.5px] px-1 py-0.5 rounded bg-indigo-100 dark:bg-indigo-900/50 text-indigo-800 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/50 font-medium shrink-0 leading-none">
              {periodDisplayText.shortBadge}
            </span>
          </div>
        </div>

        {/* Card 3: TOTAL - TOTAL PO (WITHOUT TAX) */}
        <div
          className="border border-cyan-200/80 dark:border-cyan-900/40 bg-cyan-50/30 dark:bg-cyan-950/20 rounded-lg px-2 sm:px-2.5 py-1.5 transition-all select-none hover:border-cyan-300"
          title="Total stock valuation derived strictly from Purchase Orders excluding GST tax"
        >
          <div className="flex items-center justify-between text-cyan-700 dark:text-cyan-400 text-[10px]">
            <span className="font-semibold truncate uppercase tracking-wider">Total - PO (Without Tax)</span>
            <IndianRupee className="w-3 h-3 text-cyan-600 dark:text-cyan-400 shrink-0" />
          </div>
          <div className="text-[13px] sm:text-sm font-bold text-cyan-800 dark:text-cyan-300 font-mono leading-tight tracking-tight my-0.5">
            ₹{Number(summary.totalValuationWithoutTax || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
          </div>
          <div className="text-[9px] text-cyan-600/80 dark:text-cyan-400/80 truncate flex items-center justify-between gap-1 leading-none">
            <span className="truncate">PO Net Subtotal</span>
            <span className="text-[8px] sm:text-[8.5px] px-1 py-0.5 rounded bg-cyan-100 dark:bg-cyan-900/50 text-cyan-800 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800/50 font-medium shrink-0 leading-none">
              Excl. GST
            </span>
          </div>
        </div>

        {/* Card 4: TOT STK (Click to show All / Reset) */}
        <div
          onClick={() => setMovementFilter('ALL')}
          className={`border rounded-lg px-2 sm:px-2.5 py-1.5 transition-all cursor-pointer select-none ${
            movementFilter === 'ALL'
              ? 'border-blue-500 ring-1.5 ring-blue-500/25 bg-blue-50/40 dark:bg-blue-950/30 shadow-2xs'
              : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-50/50'
          }`}
          title="Click to view all raw materials"
        >
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-[10px]">
            <span className="font-semibold text-slate-600 dark:text-slate-300 truncate uppercase tracking-wider">
              {period === 'all' ? 'TOT STK' :
               period === 'today' ? 'TOT STK (Today)' :
               period === 'this_year' ? 'TOT STK (This Year)' :
               period === 'this_week' ? 'TOT STK (This Week)' :
               period === 'last_week' ? 'TOT STK (Last Week)' :
               period === 'this_month' ? 'TOT STK (This Month)' :
               period === 'last_month' ? 'TOT STK (Last Month)' : 'TOT STK (Period)'}
            </span>
            <Package className="w-3 h-3 text-blue-500 shrink-0" />
          </div>
          <div className="text-[13px] sm:text-sm font-bold text-slate-900 dark:text-white font-mono leading-tight tracking-tight my-0.5">
            {Number(summary.totalCurrentStock || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
          </div>
          <div className="text-[9px] text-slate-500 flex items-center justify-between gap-1 leading-none truncate">
            <span className="truncate" title={`PO Valuation: ₹${Number(summary.totalValuationWithTax || summary.totalValuation || 0).toLocaleString('en-IN')}`}>
              Val: <strong className="font-semibold text-slate-700 dark:text-slate-300">₹{Number(summary.totalValuationWithTax || summary.totalValuation || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</strong>
            </span>
            <span className="text-[8px] sm:text-[8.5px] px-1 py-0.5 rounded bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/50 font-medium shrink-0 leading-none">
              {periodDisplayText.shortBadge}
            </span>
          </div>
        </div>

        {/* Card 5: In-Progress WIP (Click to filter WIP) */}
        <div
          onClick={() => setMovementFilter(movementFilter === 'IN_PROGRESS' ? 'ALL' : 'IN_PROGRESS')}
          className={`border rounded-lg px-2 sm:px-2.5 py-1.5 transition-all cursor-pointer select-none ${
            movementFilter === 'IN_PROGRESS'
              ? 'border-amber-500 ring-1.5 ring-amber-500/30 bg-amber-50 dark:bg-amber-950/40 shadow-2xs'
              : 'border-amber-200/80 dark:border-amber-900/40 bg-amber-50/40 dark:bg-amber-950/20 hover:border-amber-300'
          }`}
          title="Click to filter materials running on floor WIP"
        >
          <div className="flex items-center justify-between text-amber-800 dark:text-amber-400 text-[10px]">
            <span className="font-bold flex items-center gap-1 truncate uppercase tracking-wider">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
              In-Progress WIP
            </span>
            <Factory className="w-3 h-3 text-amber-600 dark:text-amber-400 shrink-0" />
          </div>
          <div className="text-[13px] sm:text-sm font-bold text-amber-700 dark:text-amber-300 font-mono leading-tight tracking-tight my-0.5">
            {Number(summary.totalInProgressStock || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
          </div>
          <div className="text-[9px] text-amber-700/80 dark:text-amber-400/80 truncate flex items-center justify-between gap-1 leading-none">
            <span className="truncate">Active floor batches</span>
            <span className="text-[8px] sm:text-[8.5px] px-1 py-0.5 rounded bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/50 font-medium shrink-0 leading-none">
              {movementFilter === 'IN_PROGRESS' ? 'Filtered' : periodDisplayText.shortBadge}
            </span>
          </div>
        </div>

        {/* Card 6: AVL STK (Free Available) */}
        <div
          onClick={() => setMovementFilter(movementFilter === 'FREE_AVAILABLE' ? 'ALL' : 'FREE_AVAILABLE')}
          className={`border rounded-lg px-2 sm:px-2.5 py-1.5 transition-all cursor-pointer select-none ${
            movementFilter === 'FREE_AVAILABLE'
              ? 'border-emerald-500 ring-1.5 ring-emerald-500/30 bg-emerald-50 dark:bg-emerald-950/40 shadow-2xs'
              : 'border-emerald-200/80 dark:border-emerald-900/40 bg-emerald-50/30 dark:bg-emerald-950/20 hover:border-emerald-300'
          }`}
          title="Click to filter materials with free available stock"
        >
          <div className="flex items-center justify-between text-emerald-700 dark:text-emerald-400 text-[10px]">
            <span className="font-semibold truncate uppercase tracking-wider">AVL STK</span>
            <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
          </div>
          <div className="text-[13px] sm:text-sm font-bold text-emerald-700 dark:text-emerald-300 font-mono leading-tight tracking-tight my-0.5">
            {Number(summary.totalAvailableStock !== undefined ? summary.totalAvailableStock : Math.max(0, (summary.totalCurrentStock || 0) - (summary.totalInProgressStock || 0))).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
          </div>
          <div className="text-[9px] text-emerald-600/80 dark:text-emerald-400/80 truncate flex items-center justify-between gap-1 leading-none">
            <span className="truncate">Ready for orders</span>
            <span className="text-[8px] sm:text-[8.5px] px-1 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50 font-medium shrink-0 leading-none">
              {movementFilter === 'FREE_AVAILABLE' ? 'Filtered' : periodDisplayText.shortBadge}
            </span>
          </div>
        </div>

        {/* Card 7: IN STK (Period Inward) */}
        <div
          onClick={() => setMovementFilter(movementFilter === 'IN_ONLY' ? 'ALL' : 'IN_ONLY')}
          className={`border rounded-lg px-2 sm:px-2.5 py-1.5 transition-all cursor-pointer select-none ${
            movementFilter === 'IN_ONLY'
              ? 'border-emerald-500 ring-1.5 ring-emerald-500/30 bg-emerald-50 dark:bg-emerald-950/40 shadow-2xs'
              : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-emerald-300'
          }`}
          title="Click to filter materials with Inward receipts in this period"
        >
          <div className="flex items-center justify-between text-emerald-700 dark:text-emerald-400 text-[10px]">
            <span className="font-semibold uppercase tracking-wider">IN STK</span>
            <ArrowDownLeft className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
          </div>
          <div className="text-[13px] sm:text-sm font-bold text-emerald-700 dark:text-emerald-300 font-mono leading-tight tracking-tight my-0.5">
            +{Number(summary.totalPeriodIn || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
          </div>
          <div className="text-[9px] text-slate-500 truncate flex items-center justify-between gap-1 leading-none">
            <span className="truncate">GRN receipts</span>
            {movementFilter === 'IN_ONLY' && <span className="font-bold text-[8px] sm:text-[8.5px] text-emerald-600 bg-emerald-100 dark:bg-emerald-900/50 px-1 py-0.5 rounded leading-none shrink-0">Filtered</span>}
          </div>
        </div>

        {/* Card 8: OUT STK (Period Outward) */}
        <div
          onClick={() => setMovementFilter(movementFilter === 'OUT_ONLY' ? 'ALL' : 'OUT_ONLY')}
          className={`border rounded-lg px-2 sm:px-2.5 py-1.5 transition-all cursor-pointer select-none ${
            movementFilter === 'OUT_ONLY'
              ? 'border-rose-500 ring-1.5 ring-rose-500/30 bg-rose-50 dark:bg-rose-950/40 shadow-2xs'
              : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-rose-300'
          }`}
          title="Click to filter materials consumed/dispatched outward"
        >
          <div className="flex items-center justify-between text-rose-700 dark:text-rose-400 text-[10px]">
            <span className="font-semibold uppercase tracking-wider">OUT STK</span>
            <ArrowUpRight className="w-3 h-3 text-rose-600 dark:text-rose-400 shrink-0" />
          </div>
          <div className="text-[13px] sm:text-sm font-bold text-rose-700 dark:text-rose-300 font-mono leading-tight tracking-tight my-0.5">
            -{Number(summary.totalPeriodOut || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
          </div>
          <div className="text-[9px] text-slate-500 truncate flex items-center justify-between gap-1 leading-none">
            <span className="truncate">Prod & sales waste</span>
            {movementFilter === 'OUT_ONLY' && <span className="font-bold text-[8px] sm:text-[8.5px] text-rose-600 bg-rose-100 dark:bg-rose-900/50 px-1 py-0.5 rounded leading-none shrink-0">Filtered</span>}
          </div>
        </div>

        {/* Card 9: NET MOVEMENT */}
        <div
          onClick={() => setMovementFilter(movementFilter === 'WITH_MOVEMENT' ? 'ALL' : 'WITH_MOVEMENT')}
          className={`border rounded-lg px-2 sm:px-2.5 py-1.5 transition-all cursor-pointer select-none ${
            movementFilter === 'WITH_MOVEMENT'
              ? 'border-purple-500 ring-1.5 ring-purple-500/30 bg-purple-50 dark:bg-purple-950/40 shadow-2xs'
              : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-purple-300'
          }`}
          title="Click to filter materials with active movement in period"
        >
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-[10px]">
            <span className="font-semibold text-slate-600 dark:text-slate-300 truncate uppercase tracking-wider">Net Movement</span>
            {Number(summary.netMovement || 0) >= 0 ? (
              <TrendingUp className="w-3 h-3 text-emerald-500 shrink-0" />
            ) : (
              <TrendingDown className="w-3 h-3 text-rose-500 shrink-0" />
            )}
          </div>
          <div className={`text-[13px] sm:text-sm font-bold font-mono leading-tight tracking-tight my-0.5 ${
            Number(summary.netMovement || 0) >= 0
              ? 'text-emerald-600 dark:text-emerald-400'
              : 'text-rose-600 dark:text-rose-400'
          }`}>
            {Number(summary.netMovement || 0) > 0 ? '+' : ''}
            {Number(summary.netMovement || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
          </div>
          <div className="text-[9px] text-slate-500 truncate flex items-center justify-between gap-1 leading-none">
            <span className="truncate">{summary.activeMovementCount || 0} / {summary.totalMaterials || 0} active</span>
            {movementFilter === 'WITH_MOVEMENT' && <span className="font-bold text-[8px] sm:text-[8.5px] text-purple-600 bg-purple-100 dark:bg-purple-900/50 px-1 py-0.5 rounded leading-none shrink-0">Filtered</span>}
          </div>
        </div>
      </div>

      {/* ── INTERACTIVE VISUAL STOCK FLOW BAR (Compact SAP Flow Indicator) ── */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2 sm:px-2.5 py-1 shadow-2xs space-y-0.5">
        <div className="flex items-center justify-between text-[9.5px] sm:text-[10px] font-semibold text-slate-700 dark:text-slate-300">
          <div className="flex items-center gap-1">
            <BarChart3 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
            <span>Interactive Movement Breakdown (Click to filter):</span>
          </div>
          {movementFilter !== 'ALL' && (
            <button
              onClick={() => setMovementFilter('ALL')}
              className="text-[9px] text-rose-600 dark:text-rose-400 hover:underline flex items-center gap-0.5 font-bold cursor-pointer"
            >
              <span>Reset filter ({movementFilter})</span>
              <X className="w-2.5 h-2.5" />
            </button>
          )}
        </div>

        <div className="w-full h-1.5 sm:h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden flex cursor-pointer shadow-inner">
          {/* Segment 1: Inward (Green) */}
          <div
            onClick={() => setMovementFilter('IN_ONLY')}
            style={{ width: `${Math.max(5, ((summary.totalPeriodIn || 0) / totalVolumeCalculated) * 100)}%` }}
            className={`h-full bg-emerald-500 hover:bg-emerald-600 transition-all ${movementFilter === 'IN_ONLY' ? 'ring-2 ring-white z-10' : ''}`}
            title={`Period Inward: +${summary.totalPeriodIn} (Click to filter)`}
          />
          {/* Segment 2: Outward (Red) */}
          <div
            onClick={() => setMovementFilter('OUT_ONLY')}
            style={{ width: `${Math.max(3, ((summary.totalPeriodOut || 0) / totalVolumeCalculated) * 100)}%` }}
            className={`h-full bg-rose-500 hover:bg-rose-600 transition-all ${movementFilter === 'OUT_ONLY' ? 'ring-2 ring-white z-10' : ''}`}
            title={`Period Outward: -${summary.totalPeriodOut} (Click to filter)`}
          />
          {/* Segment 3: Floor WIP (Amber) */}
          <div
            onClick={() => setMovementFilter('IN_PROGRESS')}
            style={{ width: `${Math.max(3, ((summary.totalInProgressStock || 0) / totalVolumeCalculated) * 100)}%` }}
            className={`h-full bg-amber-400 hover:bg-amber-500 transition-all ${movementFilter === 'IN_PROGRESS' ? 'ring-2 ring-white z-10' : ''}`}
            title={`Floor WIP: ${summary.totalInProgressStock} (Click to filter)`}
          />
        </div>

        <div className="flex items-center justify-between text-[9.5px] text-slate-500 flex-wrap gap-2 pt-0.5">
          <div className="flex items-center gap-2.5">
            <span onClick={() => setMovementFilter('IN_ONLY')} className="flex items-center gap-1 cursor-pointer hover:text-emerald-600">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span>Inward ({summary.totalPeriodIn})</span>
            </span>
            <span onClick={() => setMovementFilter('OUT_ONLY')} className="flex items-center gap-1 cursor-pointer hover:text-rose-600">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
              <span>Outward ({summary.totalPeriodOut})</span>
            </span>
            <span onClick={() => setMovementFilter('IN_PROGRESS')} className="flex items-center gap-1 cursor-pointer hover:text-amber-600">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              <span>Floor WIP ({summary.totalInProgressStock})</span>
            </span>
          </div>
          <div>
            Total Monitored Volume: <strong className="font-mono text-slate-700 dark:text-slate-300">{Number(totalVolumeCalculated).toLocaleString('en-IN', { maximumFractionDigits: 1 })}</strong>
          </div>
        </div>
      </div>

      {/* ── TOOLBAR: SEARCH, TIME PERIOD, SEARCHABLE CATEGORY, SEARCHABLE CODE, MOVEMENT & SORT ── */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2 sm:px-2.5 py-1.5 shadow-2xs space-y-1">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-1.5">
          {/* 1. Global Text Search Input */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search keyword, PO, batch..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full text-xs pl-8 pr-7 py-1 rounded-md bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-1 focus:ring-emerald-500 outline-hidden"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* 2. Integrated Time Period Dropdown */}
          <TimePeriodDropdown
            period={period}
            setPeriod={setPeriod}
            customStartDate={customStartDate}
            setCustomStartDate={setCustomStartDate}
            customEndDate={customEndDate}
            setCustomEndDate={setCustomEndDate}
            appliedCustomStart={appliedCustomStart}
            appliedCustomEnd={appliedCustomEnd}
            handleApplyCustomRange={handleApplyCustomRange}
            handleClearCustomRange={handleClearCustomRange}
            summary={summary}
            periodDisplayText={periodDisplayText}
            isFetching={isDedicatedFetching}
          />

          {/* 3. Searchable Category Dropdown with internal Search Bar */}
          <SearchableFilterDropdown
            label="Category"
            placeholder="All Categories"
            value={categoryFilter}
            onChange={(val) => setCategoryFilter(val)}
            options={categoryOptions}
            icon={Layers}
          />

          {/* 4. Searchable RM Code Dropdown with internal Search Bar */}
          <SearchableFilterDropdown
            label="RM Code"
            placeholder="All RM Codes"
            value={codeFilter}
            onChange={(val) => setCodeFilter(val)}
            options={codeOptions}
            icon={Package}
          />

          {/* 5. Movement / Stock Filter */}
          <div>
            <select
              value={movementFilter}
              onChange={(e) => setMovementFilter(e.target.value)}
              className="w-full text-xs px-2 py-1 rounded-md bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-1 focus:ring-emerald-500 outline-hidden cursor-pointer"
            >
              <option value="ALL">All Movement Status</option>
              <option value="IN_PROGRESS">🟡 In-Progress WIP (Floor Runs)</option>
              <option value="FREE_AVAILABLE">🟢 Free Available Stock (&gt; 0)</option>
              <option value="LAB_REJECTED">❌ Lab Rejected / QC Discrepancies</option>
              <option value="WITH_MOVEMENT">With Movement In Period</option>
              <option value="IN_ONLY">Inward Only (IN &gt; 0)</option>
              <option value="OUT_ONLY">Outward Only (OUT &gt; 0)</option>
              <option value="NET_POSITIVE">Net Positive (+ Movement)</option>
              <option value="NET_NEGATIVE">Net Drawdown (- Movement)</option>
              <option value="LOW_STOCK">Low Stock Warning</option>
              <option value="OUT_OF_STOCK">Out of Stock (Zero)</option>
            </select>
          </div>

          {/* 6. Sorting Selector Dropdown & Reset */}
          <div className="flex items-center gap-1">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="w-full text-xs px-2 py-1 rounded-md bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-1 focus:ring-emerald-500 outline-hidden cursor-pointer"
            >
              <option value="code_asc">Code (RM-00001 First)</option>
              <option value="code_desc">Code (Descending)</option>
              <option value="name_asc">Name (A → Z)</option>
              <option value="name_desc">Name (Z → A)</option>
              <option value="category_asc">Category (A → Z)</option>
              <option value="category_desc">Category (Z → A)</option>
              <option value="uom_asc">UOM (A → Z)</option>
              <option value="uom_desc">UOM (Z → A)</option>
              <option value="stock_desc">In-Hand Stock (High → Low)</option>
              <option value="stock_asc">In-Hand Stock (Low → High)</option>
              <option value="wip_desc">In-Progress WIP (High → Low)</option>
              <option value="free_desc">Free Stock (High → Low)</option>
              <option value="in_desc">Period IN (High → Low)</option>
              <option value="out_desc">Period OUT (High → Low)</option>
              <option value="net_desc">Net Movement (+ to -)</option>
              <option value="valuation_desc">Valuation (High → Low)</option>
              <option value="rate_desc">Standard Rate (High → Low)</option>
              <option value="qc_desc">QC Rejections First</option>
            </select>

            {(searchTerm || categoryFilter !== 'ALL' || codeFilter !== 'ALL' || movementFilter !== 'ALL' || period !== 'all' || sortBy !== 'code_asc') && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearchTerm('');
                  setCategoryFilter('ALL');
                  setCodeFilter('ALL');
                  setMovementFilter('ALL');
                  setSortBy('code_asc');
                  setPeriod('all');
                  handleClearCustomRange?.();
                }}
                className="h-7 px-2 text-xs border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400 cursor-pointer"
                title="Reset all filters to default"
              >
                <RotateCcw className="w-3 h-3" />
              </Button>
            )}
          </div>
        </div>

        {/* Status & Active Filter Pills Bar */}
        <div className="flex items-center justify-between flex-wrap gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 pt-0.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span>Showing:</span>
            <span className="font-semibold text-slate-900 dark:text-white">
              {viewMode === 'transaction' ? filteredTransactions.length : filteredMaterials.length} records
            </span>
            <span>• Active Timeframe:</span>
            <span className="font-semibold text-emerald-600 dark:text-emerald-400 capitalize">
              {summary?.periodLabel || periodDisplayText.label}
            </span>
            <span className="text-[10px] text-slate-400 dark:text-slate-500">
              ({summary?.periodDateRange || periodDisplayText.rangeText})
            </span>
            <span className={`px-2 py-0.2 rounded-full font-semibold text-[9.5px] border ${
              (period === 'all')
                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-300/70 dark:border-emerald-800/60'
                : (summary?.isHistorical ?? periodDisplayText.isHistorical)
                  ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-300/70 dark:border-amber-800/60'
                  : 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-300/70 dark:border-blue-800/60'
            }`}>
              Stock: {period === 'all' ? 'Live Real-Time Stock Balance' : 'Period Net Movement Balance'}
            </span>
            {categoryFilter !== 'ALL' && (
              <span className="px-2 py-0.2 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-300 font-bold text-[10px]">
                Cat: {categoryFilter}
              </span>
            )}
            {codeFilter !== 'ALL' && (
              <span className="px-2 py-0.2 rounded-full bg-purple-100 text-purple-800 dark:bg-purple-900/60 dark:text-purple-300 font-bold text-[10px]">
                Code: {codeFilter}
              </span>
            )}
            {movementFilter === 'IN_PROGRESS' && (
              <span className="px-2 py-0.2 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300 font-bold text-[10px]">
                🟡 In-Progress WIP Floor
              </span>
            )}
            {movementFilter === 'FREE_AVAILABLE' && (
              <span className="px-2 py-0.2 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300 font-bold text-[10px]">
                🟢 Free Available Stock
              </span>
            )}
            {movementFilter === 'LAB_REJECTED' && (
              <span className="px-2 py-0.2 rounded-full bg-rose-100 text-rose-800 dark:bg-rose-900/60 dark:text-rose-300 font-bold text-[10px]">
                ❌ Lab Rejections Only
              </span>
            )}
          </div>

          <div className="text-[10px] text-slate-400">
            Auto-Refreshed: {lastRefreshed.toLocaleTimeString()}
          </div>
        </div>
      </div>

      {/* ── MAIN CONTENT AREA ── */}
      {viewMode === 'material' ? (
        /* MODE 1: MATERIAL-WISE SUMMARY TABLE WITH COLUMN SORTING */
        <Card className="border-slate-200 dark:border-slate-800 shadow-2xs bg-white dark:bg-slate-900 overflow-hidden">
          {/* Desktop Table View with Sticky Top Header & Clickable Column Sorting */}
          <div className="hidden lg:block overflow-auto max-h-[70vh] relative border-b border-slate-200 dark:border-slate-800">
            <Table containerClassName="none" className="border-separate border-spacing-0 w-full">
              <TableHeader className="sticky top-0 z-30 bg-slate-100 dark:bg-slate-800 shadow-xs">
                <TableRow className="bg-slate-100 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-[11px]">
                  <TableHead className="sticky top-0 bg-slate-100 dark:bg-slate-800 w-8 text-center border-b border-slate-200 dark:border-slate-700"></TableHead>

                  {/* 1. Code Column Header */}
                  <TableHead className="sticky top-0 bg-slate-100 dark:bg-slate-800 min-w-[100px] border-b border-slate-200 dark:border-slate-700">
                    <button
                      type="button"
                      onClick={() => handleColumnSort('code')}
                      className="group flex items-center gap-1 font-semibold text-slate-700 dark:text-slate-200 hover:text-emerald-600 transition-colors cursor-pointer select-none"
                      title="Sort by RM Code"
                    >
                      <span>Code</span>
                      {renderSortIndicator('code')}
                    </button>
                  </TableHead>

                  {/* 2. Raw Material Name Header */}
                  <TableHead className="sticky top-0 bg-slate-100 dark:bg-slate-850 min-w-[190px] border-b border-slate-200 dark:border-slate-700">
                    <button
                      type="button"
                      onClick={() => handleColumnSort('name')}
                      className="group flex items-center gap-1 font-semibold text-slate-700 dark:text-slate-200 hover:text-emerald-600 transition-colors cursor-pointer select-none"
                      title="Sort by Raw Material Name"
                    >
                      <span>Raw Material Name</span>
                      {renderSortIndicator('name')}
                    </button>
                  </TableHead>

                  {/* 3. Category & UOM Header */}
                  <TableHead className="sticky top-0 bg-slate-100 dark:bg-slate-850 min-w-[120px] border-b border-slate-200 dark:border-slate-700">
                    <button
                      type="button"
                      onClick={() => handleColumnSort('category')}
                      className="group flex items-center gap-1 font-semibold text-slate-700 dark:text-slate-200 hover:text-emerald-600 transition-colors cursor-pointer select-none"
                      title="Sort by Category"
                    >
                      <span>Category & UOM</span>
                      {renderSortIndicator('category')}
                    </button>
                  </TableHead>

                  {/* 4. TOT STK & WIP Header */}
                  <TableHead className="sticky top-0 bg-slate-100 dark:bg-slate-800 text-right min-w-[140px] border-b border-slate-200 dark:border-slate-700">
                    <button
                      type="button"
                      onClick={() => handleColumnSort('stock')}
                      className="group inline-flex items-center gap-1 font-semibold text-slate-700 dark:text-slate-200 hover:text-emerald-600 transition-colors cursor-pointer select-none ml-auto"
                      title="Sort by TOT STK"
                    >
                      <span>TOT STK & WIP</span>
                      {renderSortIndicator('stock')}
                    </button>
                  </TableHead>

                  {/* 5. IN STK Header */}
                  <TableHead className="sticky top-0 bg-slate-100 dark:bg-slate-800 text-right min-w-[115px] border-b border-slate-200 dark:border-slate-700">
                    <button
                      type="button"
                      onClick={() => handleColumnSort('in')}
                      className="group inline-flex items-center gap-1 font-semibold text-emerald-700 dark:text-emerald-400 hover:text-emerald-800 transition-colors cursor-pointer select-none ml-auto"
                      title="Sort by IN STK"
                    >
                      <span>IN STK</span>
                      {renderSortIndicator('in')}
                    </button>
                  </TableHead>

                  {/* 6. OUT STK Header */}
                  <TableHead className="sticky top-0 bg-slate-100 dark:bg-slate-800 text-right min-w-[115px] border-b border-slate-200 dark:border-slate-700">
                    <button
                      type="button"
                      onClick={() => handleColumnSort('out')}
                      className="group inline-flex items-center gap-1 font-semibold text-rose-700 dark:text-rose-400 hover:text-rose-800 transition-colors cursor-pointer select-none ml-auto"
                      title="Sort by OUT STK"
                    >
                      <span>OUT STK</span>
                      {renderSortIndicator('out')}
                    </button>
                  </TableHead>

                  {/* 7. Net Flow Header */}
                  <TableHead className="sticky top-0 bg-slate-100 dark:bg-slate-800 text-right min-w-[105px] border-b border-slate-200 dark:border-slate-700">
                    <button
                      type="button"
                      onClick={() => handleColumnSort('net')}
                      className="group inline-flex items-center gap-1 font-semibold text-slate-700 dark:text-slate-200 hover:text-emerald-600 transition-colors cursor-pointer select-none ml-auto"
                      title="Sort by Net Movement"
                    >
                      <span>Net Flow</span>
                      {renderSortIndicator('net')}
                    </button>
                  </TableHead>

                  {/* 8. Valuation Header */}
                  <TableHead className="sticky top-0 bg-slate-100 dark:bg-slate-800 text-right min-w-[115px] border-b border-slate-200 dark:border-slate-700">
                    <button
                      type="button"
                      onClick={() => handleColumnSort('valuation')}
                      className="group inline-flex items-center gap-1 font-semibold text-slate-700 dark:text-slate-200 hover:text-emerald-600 transition-colors cursor-pointer select-none ml-auto"
                      title="Sort by Valuation"
                    >
                      <span>Valuation</span>
                      {renderSortIndicator('valuation')}
                    </button>
                  </TableHead>

                  {/* 9. QC Status Header */}
                  <TableHead className="sticky top-0 bg-slate-100 dark:bg-slate-800 text-center min-w-[100px] border-b border-slate-200 dark:border-slate-700">
                    <button
                      type="button"
                      onClick={() => handleColumnSort('qc')}
                      className="group inline-flex items-center gap-1 font-semibold text-slate-700 dark:text-slate-200 hover:text-emerald-600 transition-colors cursor-pointer select-none mx-auto"
                      title="Sort by QC Status / Rejections"
                    >
                      <span>QC Status</span>
                      {renderSortIndicator('qc')}
                    </button>
                  </TableHead>

                  {/* 10. Actions Header */}
                  <TableHead className="sticky top-0 bg-slate-100 dark:bg-slate-800 text-center min-w-[130px] font-semibold text-slate-700 dark:text-slate-200 border-b border-slate-200 dark:border-slate-700">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isAnyLoading ? (
                  Array.from({ length: 6 }).map((_, idx) => (
                    <TableRow key={idx}>
                      <TableCell colSpan={11} className="py-3">
                        <Skeleton className="h-5 w-full rounded-md" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : paginatedMaterials.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={11} className="py-10 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center space-y-1.5">
                        <Package className="w-8 h-8 text-slate-300 dark:text-slate-600" />
                        <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                          {period !== 'all' ? `No raw material movements recorded for ${summary?.periodLabel || periodDisplayText.label}.` : 'No raw materials match the current filters.'}
                        </p>
                        <p className="text-xs text-slate-500">
                          {period !== 'all' ? 'Select "All Time" to view total live stock balances, or choose another time period.' : 'Try adjusting your search keyword or category filter.'}
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedMaterials.map((mat) => {
                    const isExpanded = expandedMaterialIds.has(mat.id);
                    const isLoadingHistory = expandedLoadingIds.has(mat.id);
                    const isLow = mat.status === 'LOW_STOCK';
                    const isOut = mat.status === 'OUT_OF_STOCK';
                    const hasWip = Number(mat.inProgressStock || 0) > 0;
                    const hasReject = mat.hasLabRejection || mat.labStatus === 'LAB_REJECTED';
                    const pyClass = isCompactDensity ? 'py-1.5' : 'py-2.5';

                    return (
                      <React.Fragment key={mat.id}>
                        {/* Main Item Row */}
                        <TableRow
                          className={`text-xs transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/40 border-b border-slate-200/80 dark:border-slate-800 ${
                            isExpanded ? 'bg-slate-50/90 dark:bg-slate-800/50' : ''
                          } ${hasReject ? 'border-l-4 border-l-rose-500' : hasWip ? 'border-l-4 border-l-amber-500' : ''}`}
                        >
                          {/* 0. Expand Button */}
                          <TableCell className={`text-center ${pyClass} px-1`}>
                            <button
                              onClick={() => toggleExpandRow(mat.id)}
                              className="p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                              title={isExpanded ? 'Collapse movements' : 'Expand date-wise in/out breakdown'}
                            >
                              {isLoadingHistory ? (
                                <Loader2 className="w-3.5 h-3.5 text-emerald-600 animate-spin" />
                              ) : isExpanded ? (
                                <ChevronUp className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                              ) : (
                                <ChevronDown className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </TableCell>

                          {/* 1. Code */}
                          <TableCell className={`font-mono font-semibold ${pyClass}`}>
                            <button
                              onClick={() => handleOpenHistory(mat.id)}
                              className="text-emerald-700 dark:text-emerald-400 hover:underline hover:text-emerald-800 text-left font-bold cursor-pointer"
                              title="Click to view full lifecycle audit drawer"
                            >
                              {mat.code || '—'}
                            </button>
                            <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                              {hasWip && (
                                <span className="inline-flex items-center gap-0.5 text-[9px] px-1 py-0.2 rounded-full bg-amber-100 dark:bg-amber-950/70 text-amber-900 dark:text-amber-300 font-bold border border-amber-300">
                                  <span className="w-1 h-1 rounded-full bg-amber-500 animate-pulse" />
                                  WIP Run
                                </span>
                              )}
                              {hasReject && (
                                <span className="inline-flex items-center gap-0.5 text-[9px] px-1 py-0.2 rounded-full bg-rose-100 dark:bg-rose-950/70 text-rose-900 dark:text-rose-300 font-bold border border-rose-300">
                                  ❌ Reject
                                </span>
                              )}
                            </div>
                          </TableCell>

                          {/* 2. Raw Material Name */}
                          <TableCell className={pyClass}>
                            <div className="font-medium text-slate-900 dark:text-slate-100 truncate max-w-[200px]" title={mat.name}>
                              {mat.name || '—'}
                            </div>
                            {mat.poReferenceNo && (
                              <button
                                onClick={() => handleRedirectToPO(mat.latestPoId, mat.poReferenceNo)}
                                className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-0.5 mt-0.5 cursor-pointer"
                                title="Redirect to Purchase Order"
                              >
                                <span>PO: {mat.poReferenceNo}</span>
                                <ExternalLink className="w-2.5 h-2.5" />
                              </button>
                            )}
                          </TableCell>

                          {/* 3. Category & UOM */}
                          <TableCell className={pyClass}>
                            <div className="inline-block px-1.5 py-0.2 rounded-md text-[10px] font-medium bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 truncate max-w-[120px]">
                              {mat.category || 'Uncategorised'}
                            </div>
                            <div className="text-[10px] text-slate-400 mt-0.2 font-mono">
                              Unit: {mat.uom || 'Unit'}
                            </div>
                          </TableCell>

                          {/* 4. Current Stock & WIP */}
                          <TableCell className={`text-right ${pyClass} font-mono`}>
                            <div className="font-bold text-slate-900 dark:text-white text-xs">
                              {Number(mat.currentStock || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                              <span className="text-[10px] text-slate-400 font-normal ml-0.5">{mat.uom}</span>
                            </div>
                            {hasWip ? (
                              <div className="flex flex-col items-end gap-0.5 mt-0.5">
                                <span
                                  className="inline-flex items-center gap-0.5 text-[9px] px-1 py-0.2 rounded-sm bg-amber-100 dark:bg-amber-950/70 text-amber-900 dark:text-amber-300 font-bold border border-amber-300"
                                  title="Material committed to active batches on the floor"
                                >
                                  <span className="w-1 h-1 rounded-full bg-amber-500 animate-pulse" />
                                  WIP: {Number(mat.inProgressStock).toLocaleString('en-IN', { maximumFractionDigits: 1 })}
                                </span>
                                <span
                                  className="inline-flex items-center gap-0.5 text-[9px] px-1 py-0.2 rounded-sm bg-emerald-100 dark:bg-emerald-950/70 text-emerald-900 dark:text-emerald-300 font-bold border border-emerald-300"
                                  title="Free available stock remaining for new production orders"
                                >
                                  Free: {Number(mat.availableStock !== undefined ? mat.availableStock : Math.max(0, (mat.currentStock || 0) - (mat.inProgressStock || 0))).toLocaleString('en-IN', { maximumFractionDigits: 1 })}
                                </span>
                              </div>
                            ) : isOut ? (
                              <span className="text-[9px] px-1 py-0.2 rounded-sm bg-rose-100 text-rose-800 dark:bg-rose-900/60 dark:text-rose-300 font-semibold">
                                Out
                              </span>
                            ) : isLow ? (
                              <span className="text-[9px] px-1 py-0.2 rounded-sm bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300 font-semibold">
                                Low
                              </span>
                            ) : (
                              <span className="text-[9px] text-slate-400">
                                In Hand
                              </span>
                            )}
                          </TableCell>

                          {/* 5. Period IN */}
                          <TableCell className={`text-right ${pyClass} font-mono`}>
                            <div className="font-bold text-emerald-600 dark:text-emerald-400">
                              +{Number(mat.periodInQty || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                            </div>
                            {mat.lastIn ? (
                              <button
                                onClick={() => {
                                  if (mat.lastIn.poId) handleRedirectToPO(mat.lastIn.poId, mat.lastIn.ref);
                                  else if (mat.lastIn.grnId) handleRedirectToGRN(mat.lastIn.grnId, mat.lastIn.ref);
                                }}
                                className="text-[10px] text-emerald-600/80 dark:text-emerald-400/80 hover:underline block text-right truncate max-w-[120px] ml-auto cursor-pointer"
                                title={`Last In: ${mat.lastIn.party} on ${formatDate(mat.lastIn.date)}`}
                              >
                                {mat.lastIn.ref}
                              </button>
                            ) : (
                              <span className="text-[10px] text-slate-400">None</span>
                            )}
                          </TableCell>

                          {/* 6. Period OUT */}
                          <TableCell className={`text-right ${pyClass} font-mono`}>
                            <div className="font-bold text-rose-600 dark:text-rose-400">
                              -{Number(mat.periodOutQty || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                            </div>
                            {mat.lastOut ? (
                              <div
                                className="text-[10px] text-rose-600/80 dark:text-rose-400/80 text-right truncate max-w-[120px] ml-auto"
                                title={`Last Out: ${mat.lastOut.party} on ${formatDate(mat.lastOut.date)}`}
                              >
                                {mat.lastOut.ref}
                              </div>
                            ) : (
                              <span className="text-[10px] text-slate-400">None</span>
                            )}
                          </TableCell>

                          {/* 7. Net Movement */}
                          <TableCell className={`text-right ${pyClass} font-mono`}>
                            <span className={`inline-block px-1.5 py-0.2 rounded-sm font-semibold text-[11px] ${
                              Number(mat.netMovement || 0) > 0
                                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                                : Number(mat.netMovement || 0) < 0
                                ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                                : 'text-slate-400'
                            }`}>
                              {Number(mat.netMovement || 0) > 0 ? '+' : ''}
                              {Number(mat.netMovement || 0).toLocaleString('en-IN', { maximumFractionDigits: 1 })}
                            </span>
                          </TableCell>

                          {/* 8. Valuation (Hover to view live PO Breakdown) */}
                          <TableCell
                            className={`text-right ${pyClass} font-mono cursor-pointer hover:bg-emerald-50/70 dark:hover:bg-emerald-950/40 transition-colors select-none group/val`}
                            onMouseEnter={(e) => handleValuationMouseEnter(e, mat)}
                            onMouseOver={(e) => handleValuationMouseEnter(e, mat)}
                            onMouseLeave={handleValuationMouseLeave}
                            onClick={(e) => handleValuationClick(e, mat)}
                          >
                            <div
                              className="font-semibold text-slate-800 dark:text-slate-200 text-xs flex items-center justify-end gap-1"
                              onMouseEnter={(e) => handleValuationMouseEnter(e, mat)}
                              onMouseOver={(e) => handleValuationMouseEnter(e, mat)}
                            >
                              <span>₹{Number(mat.valuation || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                              <span className="text-[9px] text-slate-400 group-hover/val:text-emerald-600 transition-colors">ℹ️</span>
                            </div>
                            <div className="text-[10px] text-slate-400">
                              @ ₹{Number(mat.ratePerUnit || 0).toFixed(2)}
                            </div>
                          </TableCell>

                          {/* 9. QC Status */}
                          <TableCell className={`text-center ${pyClass}`}>
                            {hasReject ? (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-sm bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 font-bold text-[10px]">
                                ❌ Rejected
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-sm bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-semibold text-[10px]">
                                🟢 Passed
                              </span>
                            )}
                          </TableCell>

                          {/* 10. Actions */}
                          <TableCell className={`text-center ${pyClass}`}>
                            <div className="flex items-center justify-center gap-1">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleOpenHistory(mat.id)}
                                className="h-6 px-1.5 text-[10px] border-slate-300 dark:border-slate-700 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 cursor-pointer"
                                title="Open full history drawer"
                              >
                                <Eye className="w-2.5 h-2.5 mr-0.5" />
                                <span>Audit</span>
                              </Button>

                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleOpenStockQuery(mat.id)}
                                className="h-6 px-1.5 text-[10px] border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 cursor-pointer"
                                title="Instant stock query"
                              >
                                <span>Query</span>
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>

                        {/* Inline Expandable Date-Wise Sub-Table */}
                        {isExpanded && (
                          <TableRow className="bg-slate-50/50 dark:bg-slate-900/40 border-b border-slate-200 dark:border-slate-800">
                            <TableCell colSpan={11} className="p-2.5 sm:p-3">
                              <div className="space-y-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-2.5 sm:p-3 shadow-inner">
                                <div className="flex items-center justify-between flex-wrap gap-2">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <Clock className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                                    <span className="text-xs font-bold text-slate-900 dark:text-white">
                                      Date-Wise Movements: {mat.name} ({mat.code})
                                    </span>
                                    <span className="text-[10px] px-2 py-0.2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-mono">
                                      {mat.transactions?.length || 0} Movements
                                    </span>
                                    {hasWip && (
                                      <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.2 rounded-full bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300 font-bold border border-amber-300">
                                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                                        Floor WIP: {mat.inProgressStock} {mat.uom}
                                      </span>
                                    )}
                                  </div>

                                  <div className="flex items-center gap-1.5">
                                    {mat.poReferenceNo && (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => handleRedirectToPO(mat.latestPoId, mat.poReferenceNo)}
                                        className="h-6 text-[10px] border-blue-200 text-blue-600 cursor-pointer"
                                      >
                                        <ExternalLink className="w-2.5 h-2.5 mr-1" />
                                        PO ({mat.poReferenceNo})
                                      </Button>
                                    )}
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => handleOpenHistory(mat.id)}
                                      className="h-6 text-[10px] border-emerald-300 text-emerald-600 cursor-pointer"
                                    >
                                      Lifecycle Audit
                                    </Button>
                                  </div>
                                </div>

                                {isLoadingHistory ? (
                                  <div className="py-6 flex flex-col items-center justify-center space-y-1.5 text-slate-400 text-xs">
                                    <Loader2 className="w-5 h-5 animate-spin text-emerald-600" />
                                    <span>Loading chronological date movements...</span>
                                  </div>
                                ) : mat.transactions && mat.transactions.length > 0 ? (
                                  <div className="overflow-x-auto rounded-md border border-slate-200 dark:border-slate-800">
                                    <Table>
                                      <TableHeader>
                                        <TableRow className="bg-slate-100/60 dark:bg-slate-800/40 text-[10px]">
                                          <TableHead className="font-semibold text-slate-700 dark:text-slate-300 min-w-[110px]">
                                            Date & Time
                                          </TableHead>
                                          <TableHead className="font-semibold text-slate-700 dark:text-slate-300 min-w-[100px]">
                                            Flow & Status
                                          </TableHead>
                                          <TableHead className="font-semibold text-slate-700 dark:text-slate-300 min-w-[130px]">
                                            Transaction Type
                                          </TableHead>
                                          <TableHead className="font-semibold text-slate-700 dark:text-slate-300 min-w-[110px]">
                                            Document Ref
                                          </TableHead>
                                          <TableHead className="font-semibold text-slate-700 dark:text-slate-300 min-w-[90px]">
                                            Batch / Lot
                                          </TableHead>
                                          <TableHead className="font-semibold text-emerald-700 dark:text-emerald-400 text-right min-w-[80px]">
                                            In (Qty)
                                          </TableHead>
                                          <TableHead className="font-semibold text-rose-700 dark:text-rose-400 text-right min-w-[80px]">
                                            Out (Qty)
                                          </TableHead>
                                          <TableHead className="font-semibold text-slate-700 dark:text-slate-300 text-right min-w-[85px]">
                                            Rate (₹)
                                          </TableHead>
                                          <TableHead className="font-semibold text-slate-700 dark:text-slate-300 text-right min-w-[85px]">
                                            Amount (₹)
                                          </TableHead>
                                          <TableHead className="font-semibold text-slate-700 dark:text-slate-300 text-center min-w-[90px]">
                                            QC Decision
                                          </TableHead>
                                          <TableHead className="font-semibold text-slate-700 dark:text-slate-300 min-w-[140px]">
                                            Party / Destination
                                          </TableHead>
                                          <TableHead className="font-semibold text-slate-700 dark:text-slate-300 min-w-[85px]">
                                            Handled By
                                          </TableHead>
                                        </TableRow>
                                      </TableHeader>
                                      <TableBody>
                                        {mat.transactions.map((tx) => {
                                          const isIn = tx.flow === 'IN';
                                          const isInProgress = Boolean(
                                            tx.isInProgress ||
                                            tx.batchStatus === 'IN_PROGRESS' ||
                                            String(tx.typeLabel || '').includes('In Progress')
                                          );
                                          const isTxReject = Boolean(
                                            tx.isLabRejected ||
                                            String(tx.labStatus || '').includes('REJECT') ||
                                            Number(tx.rejectedQty || 0) > 0
                                          );

                                          return (
                                            <TableRow
                                              key={tx.id}
                                              className={`text-[11px] transition-colors border-b ${
                                                isTxReject
                                                  ? 'bg-rose-50/70 dark:bg-rose-950/30 border-l-4 border-l-rose-500'
                                                  : isInProgress
                                                  ? 'bg-amber-50/80 dark:bg-amber-950/30 border-l-4 border-l-amber-500'
                                                  : 'hover:bg-slate-50 dark:hover:bg-slate-800/50 border-slate-100 dark:border-slate-800/80'
                                              }`}
                                            >
                                              <TableCell className="font-mono py-1.5 text-slate-600 dark:text-slate-400">
                                                {formatDateTime(tx.date)}
                                              </TableCell>
                                              <TableCell className="py-1.5">
                                                {isTxReject ? (
                                                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-rose-100 text-rose-900 border border-rose-300">
                                                    ❌ REJECTED
                                                  </span>
                                                ) : isInProgress ? (
                                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                                                    <span className="w-1 h-1 rounded-full bg-amber-500 animate-pulse" />
                                                    🟡 WIP RUN
                                                  </span>
                                                ) : (
                                                  <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-full text-[9px] font-bold ${
                                                    isIn
                                                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                                      : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                                                  }`}>
                                                    {isIn ? '🟢 IN' : '🔴 OUT'}
                                                  </span>
                                                )}
                                              </TableCell>
                                              <TableCell className="font-medium py-1.5">
                                                <div className="truncate max-w-[140px]" title={tx.typeLabel}>
                                                  {tx.typeLabel}
                                                </div>
                                              </TableCell>
                                              <TableCell className="font-mono py-1.5">
                                                {tx.poId ? (
                                                  <button
                                                    onClick={() => handleRedirectToPO(tx.poId, tx.referenceNo)}
                                                    className="text-blue-600 hover:underline flex items-center gap-0.5 font-semibold cursor-pointer"
                                                  >
                                                    <span>{tx.referenceNo}</span>
                                                    <ExternalLink className="w-2 h-2" />
                                                  </button>
                                                ) : tx.grnId ? (
                                                  <button
                                                    onClick={() => handleRedirectToGRN(tx.grnId, tx.referenceNo)}
                                                    className="text-emerald-600 hover:underline flex items-center gap-0.5 font-semibold cursor-pointer"
                                                  >
                                                    <span>{tx.referenceNo}</span>
                                                    <ExternalLink className="w-2 h-2" />
                                                  </button>
                                                ) : tx.batchId || isInProgress ? (
                                                  <button
                                                    onClick={() => handleRedirectToBatch(tx.batchId, tx.referenceNo)}
                                                    className={`hover:underline flex items-center gap-0.5 font-semibold cursor-pointer ${
                                                      isInProgress ? 'text-amber-700 font-bold' : 'text-purple-600'
                                                    }`}
                                                  >
                                                    <span>{tx.referenceNo}</span>
                                                    <ExternalLink className="w-2 h-2" />
                                                  </button>
                                                ) : (
                                                  <span>{tx.referenceNo || '—'}</span>
                                                )}
                                              </TableCell>
                                              <TableCell className="font-mono text-slate-500 py-1.5">
                                                {tx.batchNumber || '—'}
                                              </TableCell>
                                              <TableCell className="text-right font-mono font-bold py-1.5 text-emerald-600 dark:text-emerald-400">
                                                {isIn ? `+${Number(tx.quantity).toLocaleString('en-IN', { maximumFractionDigits: 1 })}` : '—'}
                                              </TableCell>
                                              <TableCell className={`text-right font-mono font-bold py-1.5 ${
                                                isInProgress ? 'text-amber-700' : 'text-rose-600'
                                              }`}>
                                                {!isIn ? `-${Number(tx.quantity).toLocaleString('en-IN', { maximumFractionDigits: 1 })}` : '—'}
                                              </TableCell>
                                              <TableCell className="text-right font-mono py-1.5 text-slate-700 dark:text-slate-300">
                                                {tx.rate ? `₹${Number(tx.rate).toFixed(2)}` : '—'}
                                              </TableCell>
                                              <TableCell className="text-right font-mono font-semibold py-1.5 text-slate-900 dark:text-white">
                                                {tx.amount ? `₹${Number(tx.amount).toLocaleString('en-IN', { maximumFractionDigits: 0 })}` : '—'}
                                              </TableCell>
                                              <TableCell className="text-center py-1.5">
                                                {isTxReject ? (
                                                  <span className="text-rose-700 font-bold text-[10px]">❌ Rejected</span>
                                                ) : (
                                                  <span className="text-emerald-700 font-medium text-[10px]">Passed</span>
                                                )}
                                              </TableCell>
                                              <TableCell className="py-1.5 text-slate-700 dark:text-slate-300 truncate max-w-[150px]" title={tx.partyName}>
                                                {tx.partyName || '—'}
                                              </TableCell>
                                              <TableCell className="py-1.5 text-slate-500 text-[10px]">
                                                {tx.user || '—'}
                                              </TableCell>
                                            </TableRow>
                                          );
                                        })}
                                      </TableBody>
                                    </Table>
                                  </div>
                                ) : (
                                  <div className="py-4 text-center text-slate-400 text-xs">
                                    No transaction movements recorded for this material within the selected time period ({period}).
                                  </div>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {/* Mobile & Tablet Responsive Cards View */}
          <div className="lg:hidden divide-y divide-slate-200 dark:divide-slate-800">
            {isAnyLoading ? (
              Array.from({ length: 4 }).map((_, idx) => (
                <div key={idx} className="p-3.5 space-y-2.5">
                  <Skeleton className="h-4 w-2/3 rounded-sm" />
                  <Skeleton className="h-14 w-full rounded-md" />
                </div>
              ))
            ) : paginatedMaterials.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs">No raw materials match the current filters.</div>
            ) : (
              paginatedMaterials.map((mat) => {
                const isExpanded = expandedMaterialIds.has(mat.id);
                const isLoadingHistory = expandedLoadingIds.has(mat.id);
                const isLow = mat.status === 'LOW_STOCK';
                const isOut = mat.status === 'OUT_OF_STOCK';
                const hasWip = Number(mat.inProgressStock || 0) > 0;
                const hasReject = mat.hasLabRejection || mat.labStatus === 'LAB_REJECTED';
                const cur = Number(mat.currentStock || 0);
                const wip = Number(mat.inProgressStock || 0);
                const free = mat.availableStock !== undefined ? Number(mat.availableStock) : Math.max(0, cur - wip);
                const inQty = Number(mat.periodInQty || 0);
                const outQty = Number(mat.periodOutQty || 0);
                const net = Number(mat.netMovement || 0);
                const val = Number(mat.valuation || 0);

                return (
                  <div
                    key={mat.id}
                    className={`p-3 sm:p-4 space-y-2.5 bg-white dark:bg-slate-900 transition-colors ${
                      hasReject ? 'border-l-4 border-l-rose-500' : hasWip ? 'border-l-4 border-l-amber-500' : ''
                    }`}
                  >
                    {/* Card Header: Code, Badges, Name, Current Stock & Valuation */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <button
                            onClick={() => handleOpenHistory(mat.id)}
                            className="font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                            title="Click to view lifecycle audit"
                          >
                            {mat.code}
                          </button>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 font-medium">
                            {mat.category || 'Uncategorised'}
                          </span>
                          <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
                            {formatUOM(mat.uom)}
                          </span>
                          {hasWip && (
                            <span className="inline-flex items-center gap-0.5 text-[9px] px-1.5 py-0.2 rounded-full bg-amber-100 dark:bg-amber-950/70 text-amber-900 dark:text-amber-300 font-bold border border-amber-300">
                              <span className="w-1 h-1 rounded-full bg-amber-500 animate-pulse" />
                              WIP Run
                            </span>
                          )}
                          {hasReject ? (
                            <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-rose-100 dark:bg-rose-950/70 text-rose-900 dark:text-rose-300 font-bold border border-rose-300">
                              ❌ QC Reject
                            </span>
                          ) : (
                            <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200">
                              ✓ QC Pass
                            </span>
                          )}
                        </div>
                        <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate" title={mat.name}>
                          {mat.name}
                        </h3>
                        {mat.poReferenceNo && (
                          <button
                            onClick={() => handleRedirectToPO(mat.latestPoId, mat.poReferenceNo)}
                            className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1 cursor-pointer"
                          >
                            <span>PO: {mat.poReferenceNo}</span>
                            <ExternalLink className="w-2.5 h-2.5" />
                          </button>
                        )}
                      </div>

                      <div className="text-right font-mono shrink-0 pl-1">
                        <div className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                          {cur.toLocaleString('en-IN', { maximumFractionDigits: 1 })} <span className="text-[10px] font-normal text-slate-500">{formatUOM(mat.uom)}</span>
                        </div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400">
                          Val: <strong className="font-semibold text-slate-700 dark:text-slate-300">₹{val.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</strong>
                        </div>
                      </div>
                    </div>

                    {/* Quick 6-Metrics Grid: In-Hand, WIP Floor, Free Stock, Period IN, Period OUT, Net Flow */}
                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 text-center text-xs">
                      <div className="p-1 rounded-lg bg-white dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-700/50">
                        <span className="text-[9px] text-slate-500 block">In-Hand</span>
                        <span className="font-mono font-bold text-slate-900 dark:text-white">
                          {cur.toLocaleString('en-IN', { maximumFractionDigits: 1 })}
                        </span>
                      </div>
                      <div className="p-1 rounded-lg bg-amber-50/50 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-800/40">
                        <span className="text-[9px] text-amber-700 dark:text-amber-400 font-semibold block">WIP Floor</span>
                        <span className="font-mono font-bold text-amber-700 dark:text-amber-300">
                          {wip.toLocaleString('en-IN', { maximumFractionDigits: 1 })}
                        </span>
                      </div>
                      <div className="p-1 rounded-lg bg-emerald-50/50 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-800/40">
                        <span className="text-[9px] text-emerald-700 dark:text-emerald-400 font-semibold block">Free Stock</span>
                        <span className="font-mono font-bold text-emerald-700 dark:text-emerald-300">
                          {free.toLocaleString('en-IN', { maximumFractionDigits: 1 })}
                        </span>
                      </div>
                      <div className="p-1 rounded-lg bg-emerald-50/50 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-800/40">
                        <span className="text-[9px] text-emerald-700 dark:text-emerald-400 font-semibold block">Period IN</span>
                        <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                          {inQty > 0 ? `+${inQty.toLocaleString('en-IN', { maximumFractionDigits: 1 })}` : '0'}
                        </span>
                      </div>
                      <div className="p-1 rounded-lg bg-rose-50/50 dark:bg-rose-950/30 border border-rose-200/60 dark:border-rose-800/40">
                        <span className="text-[9px] text-rose-700 dark:text-rose-400 font-semibold block">Period OUT</span>
                        <span className="font-mono font-bold text-rose-600 dark:text-rose-400">
                          {outQty > 0 ? `-${outQty.toLocaleString('en-IN', { maximumFractionDigits: 1 })}` : '0'}
                        </span>
                      </div>
                      <div className="p-1 rounded-lg bg-white dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-700/50">
                        <span className="text-[9px] text-slate-500 block">Net Flow</span>
                        <span className={`font-mono font-bold ${
                          net > 0 ? 'text-emerald-600' : net < 0 ? 'text-rose-600' : 'text-slate-400'
                        }`}>
                          {net > 0 ? `+${net.toLocaleString('en-IN', { maximumFractionDigits: 1 })}` : net < 0 ? net.toLocaleString('en-IN', { maximumFractionDigits: 1 }) : '0'}
                        </span>
                      </div>
                    </div>

                    {/* Mobile Actions Bar */}
                    <div className="flex items-center justify-between gap-1 pt-1 border-t border-slate-100 dark:border-slate-800">
                      <button
                        type="button"
                        onClick={() => toggleExpandRow(mat.id)}
                        className="text-xs flex items-center gap-1.5 text-slate-700 dark:text-slate-300 font-semibold hover:text-emerald-600 transition-colors cursor-pointer py-1"
                      >
                        {isLoadingHistory ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600" />
                        ) : isExpanded ? (
                          <ChevronUp className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5" />
                        )}
                        <span>{isExpanded ? 'Hide Movements' : 'View Movements'} ({mat.transactions?.length || 0})</span>
                      </button>

                      <div className="flex items-center gap-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleOpenHistory(mat.id)}
                          className="h-7 px-2 text-xs flex items-center gap-1 cursor-pointer border-slate-300 dark:border-slate-700"
                        >
                          <Clock className="w-3 h-3 text-emerald-600" />
                          <span>Audit</span>
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleOpenStockQuery(mat.id)}
                          className="h-7 px-2 text-xs flex items-center gap-1 cursor-pointer border-slate-300 dark:border-slate-700 text-blue-600 dark:text-blue-400 hover:text-blue-700"
                        >
                          <Search className="w-3 h-3" />
                          <span>Query</span>
                        </Button>
                      </div>
                    </div>

                    {/* Inline Expanded Movements for Mobile / Tablet */}
                    {isExpanded && (
                      <div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-800 space-y-2 animate-in fade-in duration-150">
                        {mat.transactions && mat.transactions.length > 0 ? (
                          mat.transactions.map((tx) => {
                            const isIn = tx.flow === 'IN';
                            const isInProgress = Boolean(tx.isInProgress || tx.batchStatus === 'IN_PROGRESS');
                            const isTxReject = Boolean(tx.isLabRejected || String(tx.labStatus || '').includes('REJECT') || Number(tx.rejectedQty || 0) > 0);

                            return (
                              <div
                                key={tx.id}
                                className={`p-2 sm:p-2.5 rounded-xl text-xs space-y-1.5 border transition-all ${
                                  isTxReject
                                    ? 'bg-rose-50/80 dark:bg-rose-950/30 border-rose-300 dark:border-rose-800 border-l-4 border-l-rose-500'
                                    : isInProgress
                                    ? 'bg-amber-50/80 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800 border-l-4 border-l-amber-500'
                                    : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800'
                                }`}
                              >
                                <div className="flex items-center justify-between text-[11px] font-mono">
                                  <span className="text-slate-500">{formatDateTime(tx.date)}</span>
                                  {isTxReject ? (
                                    <span className="px-1.5 py-0.5 rounded-sm font-bold bg-rose-100 text-rose-900 border border-rose-300 text-[10px]">
                                      ❌ REJECTED
                                    </span>
                                  ) : isInProgress ? (
                                    <span className="px-1.5 py-0.5 rounded-sm font-bold bg-amber-100 text-amber-900 border border-amber-300 text-[10px]">
                                      🟡 -{Number(tx.quantity).toLocaleString()} WIP
                                    </span>
                                  ) : (
                                    <span className={`px-2 py-0.5 rounded-md font-bold text-[10px] ${
                                      isIn ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                                    }`}>
                                      {isIn ? `+${Number(tx.quantity).toLocaleString()} IN` : `-${Number(tx.quantity).toLocaleString()} OUT`}
                                    </span>
                                  )}
                                </div>

                                <div className="flex items-center justify-between text-xs">
                                  <span className="font-semibold text-slate-800 dark:text-slate-200">{tx.typeLabel}</span>
                                  <span className="font-mono text-slate-600 dark:text-slate-400">
                                    {tx.poId ? (
                                      <button onClick={() => handleRedirectToPO(tx.poId, tx.referenceNo)} className="text-blue-600 hover:underline flex items-center gap-0.5 font-semibold">
                                        <span>{tx.referenceNo}</span>
                                        <ExternalLink className="w-2.5 h-2.5" />
                                      </button>
                                    ) : tx.grnId ? (
                                      <button onClick={() => handleRedirectToGRN(tx.grnId, tx.referenceNo)} className="text-emerald-600 hover:underline flex items-center gap-0.5 font-semibold">
                                        <span>{tx.referenceNo}</span>
                                        <ExternalLink className="w-2.5 h-2.5" />
                                      </button>
                                    ) : (
                                      tx.referenceNo || '—'
                                    )}
                                  </span>
                                </div>

                                <div className="flex items-center justify-between text-[11px] text-slate-500 pt-0.5">
                                  <span className="truncate max-w-[200px]">{tx.partyName || tx.user}</span>
                                  {tx.rate ? (
                                    <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">
                                      ₹{Number(tx.rate).toFixed(2)} {tx.amount ? `(₹${Number(tx.amount).toLocaleString('en-IN')})` : ''}
                                    </span>
                                  ) : null}
                                </div>
                              </div>
                            );
                          })
                        ) : (
                          <div className="py-2 text-center text-xs text-slate-400">No movements recorded.</div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Pagination Controls with Page Size Dropdown (Just like rm/stock) */}
          <div className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-2 px-3 flex flex-col sm:flex-row items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span className="font-medium text-[11px]">Per page:</span>
              <select
                value={itemsPerPage}
                onChange={(e) => {
                  setItemsPerPage(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="h-7 px-2 text-xs font-semibold rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none cursor-pointer"
              >
                <option value={10}>10</option>
                <option value={15}>15</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>

            <div className="flex-1 w-full sm:w-auto">
              <Pagination
                currentPage={currentPage}
                totalPages={totalMaterialPages}
                totalRecords={filteredMaterials.length}
                pageSize={itemsPerPage}
                onPageChange={(page) => setCurrentPage(page)}
              />
            </div>
          </div>
        </Card>
      ) : (
        /* MODE 2: DATE-WISE LEDGER & MOVEMENT MATRIX (WITH MATRIX & STREAM SUB-MODES) */
        <div className="space-y-1">
          {/* Sub-Mode Segmented Switcher Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2 sm:px-2.5 py-1 shadow-2xs">
            <div className="flex items-center gap-1 flex-wrap">
              <div className="inline-flex max-w-full overflow-x-auto no-scrollbar p-0.5 bg-slate-100 dark:bg-slate-800 rounded-md border border-slate-200 dark:border-slate-700 text-xs font-medium shrink-0">
                <button
                  type="button"
                  onClick={() => setLedgerSubMode('matrix')}
                  className={`px-2 sm:px-2.5 py-1 rounded text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer whitespace-nowrap ${
                    ledgerSubMode === 'matrix'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <TableProperties className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    <span className="hidden sm:inline">Date-Wise <span className="hidden md:inline">Movement </span></span>Matrix
                  </span>
                  <span className={`text-[9.5px] px-1.5 py-0.2 rounded-full font-mono ${
                    ledgerSubMode === 'matrix' ? 'bg-emerald-700 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                  }`}>
                    <span className="hidden sm:inline">{matrixDates.length} Dates</span>
                    <span className="sm:hidden">{matrixDates.length}</span>
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setLedgerSubMode('stream')}
                  className={`px-2 sm:px-2.5 py-1 rounded text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer whitespace-nowrap ${
                    ledgerSubMode === 'stream'
                      ? 'bg-slate-900 dark:bg-slate-700 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Calendar className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    <span className="hidden sm:inline">Detailed </span>Transaction Stream
                  </span>
                  <span className={`text-[9.5px] px-1.5 py-0.2 rounded-full font-mono ${
                    ledgerSubMode === 'stream' ? 'bg-slate-800 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                  }`}>
                    {filteredTransactions.length}
                  </span>
                </button>
              </div>

              {/* Tablet View Mode Toggle for Matrix (Cards vs Table Grid) */}
              {ledgerSubMode === 'matrix' && (
                <div className="lg:hidden hidden sm:inline-flex p-0.5 bg-slate-100 dark:bg-slate-800 rounded-md border border-slate-200 dark:border-slate-700 text-xs font-medium shrink-0">
                  <button
                    type="button"
                    onClick={() => setTabletViewMode('card')}
                    className={`px-2 py-0.5 rounded text-xs font-semibold cursor-pointer transition-all ${
                      tabletViewMode === 'card'
                        ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-2xs font-bold'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    Card View
                  </button>
                  <button
                    type="button"
                    onClick={() => setTabletViewMode('table')}
                    className={`px-2 py-0.5 rounded text-xs font-semibold cursor-pointer transition-all ${
                      tabletViewMode === 'table'
                        ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-2xs font-bold'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    Full Grid
                  </button>
                </div>
              )}
            </div>

            <div className="flex items-center gap-1.5 text-xs flex-wrap justify-between sm:justify-end w-full sm:w-auto">
              <div className="flex items-center gap-1">
                <span className="text-[9.5px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300">
                  🟢 IN = Green
                </span>
                <span className="text-[9.5px] font-bold px-1.5 py-0.5 rounded-full bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border border-rose-300">
                  🔴 OUT = Red
                </span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportMatrixOnly}
                className="h-6 px-2 text-[11px] text-emerald-700 dark:text-emerald-300 border-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 flex items-center gap-1 cursor-pointer font-semibold shadow-2xs"
                title="Quick download of the Date-Wise Movement Matrix as Excel"
              >
                <Download className="w-3 h-3 text-emerald-600" />
                <span>Export Matrix (Excel)</span>
              </Button>
            </div>
          </div>

          {ledgerSubMode === 'matrix' ? (
            /* SUB-MODE A: DATE-WISE MOVEMENT MATRIX (EXACT EXCEL FORMAT) */
            <Card className="border-slate-200 dark:border-slate-800 shadow-2xs bg-white dark:bg-slate-900 overflow-hidden">
              {/* Desktop Table (and Tablet Table if tabletViewMode === 'table') with Sticky Header & Sticky Left Columns */}
              <div className={`${tabletViewMode === 'table' ? 'block' : 'hidden lg:block'} overflow-auto max-h-[70vh] relative border-b border-slate-200 dark:border-slate-800`}>
                <Table containerClassName="none" className="border-separate border-spacing-0 w-full">
                  <TableHeader className="sticky top-0 z-30 bg-slate-100/95 dark:bg-slate-850/95 backdrop-blur-xs shadow-2xs">
                    <TableRow className="border-b border-slate-200 dark:border-slate-700 text-[11px]">
                      {/* 1. Frozen RM Code (Pinned Top & Left) */}
                      <TableHead className="sticky top-0 left-0 z-50 bg-slate-100 dark:bg-slate-850 w-[95px] min-w-[95px] max-w-[95px] font-bold text-slate-800 dark:text-slate-200 border-r border-b border-slate-200 dark:border-slate-700 shadow-xs px-2 py-2">
                        <button
                          type="button"
                          onClick={() => handleColumnSort('code')}
                          className="group flex items-center gap-1 font-bold text-slate-800 dark:text-slate-200 hover:text-emerald-600 transition-colors cursor-pointer select-none"
                          title="Sort by RM Code (Click to toggle Asc/Desc)"
                        >
                          <span className="truncate">RM Code</span>
                          {renderSortIndicator('code')}
                        </button>
                      </TableHead>

                      {/* 2. Frozen Category Name (Pinned Top & Left) */}
                      <TableHead className="sticky top-0 left-[95px] z-50 bg-slate-100 dark:bg-slate-850 w-[130px] min-w-[130px] max-w-[130px] font-semibold text-slate-700 dark:text-slate-300 border-r border-b border-slate-200 dark:border-slate-700 shadow-xs px-2 py-2">
                        <button
                          type="button"
                          onClick={() => handleColumnSort('category')}
                          className="group flex items-center gap-1 font-semibold text-slate-700 dark:text-slate-200 hover:text-emerald-600 transition-colors cursor-pointer select-none"
                          title="Sort by Category Name (Click to toggle Asc/Desc)"
                        >
                          <span className="truncate">Category</span>
                          {renderSortIndicator('category')}
                        </button>
                      </TableHead>

                      {/* 3. Frozen Raw Material Name (Pinned Top & Left) */}
                      <TableHead className="sticky top-0 left-[225px] z-50 bg-slate-100 dark:bg-slate-850 w-[170px] min-w-[170px] max-w-[170px] font-bold text-slate-800 dark:text-slate-200 border-r border-b border-slate-200 dark:border-slate-700 shadow-xs px-2 py-2">
                        <button
                          type="button"
                          onClick={() => handleColumnSort('name')}
                          className="group flex items-center gap-1 font-bold text-slate-800 dark:text-slate-200 hover:text-emerald-600 transition-colors cursor-pointer select-none"
                          title="Sort by Raw Material Name (Click to toggle Asc/Desc)"
                        >
                          <span className="truncate">Raw Material Name</span>
                          {renderSortIndicator('name')}
                        </button>
                      </TableHead>

                      {/* 4. Frozen UOM (Pinned Top & Left) */}
                      <TableHead className="sticky top-0 left-[395px] z-50 bg-slate-100 dark:bg-slate-850 w-[65px] min-w-[65px] max-w-[65px] font-semibold text-slate-700 dark:text-slate-300 border-r-2 border-b border-slate-300 dark:border-slate-700 shadow-[4px_0_6px_-2px_rgba(0,0,0,0.1)] px-2 py-2">
                        <button
                          type="button"
                          onClick={() => handleColumnSort('uom')}
                          className="group flex items-center gap-1 font-semibold text-slate-700 dark:text-slate-200 hover:text-emerald-600 transition-colors cursor-pointer select-none"
                          title="Sort by UOM (Click to toggle Asc/Desc)"
                        >
                          <span>UOM</span>
                          {renderSortIndicator('uom')}
                        </button>
                      </TableHead>

                      {/* 5. TOT STK (Pinned Top) */}
                      <TableHead className="sticky top-0 z-30 bg-slate-100 dark:bg-slate-850 text-right min-w-[95px] font-bold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700 px-2 py-2 shadow-xs">
                        <button
                          type="button"
                          onClick={() => handleColumnSort('stock')}
                          className="group inline-flex items-center gap-1 font-bold text-slate-900 dark:text-white hover:text-emerald-600 transition-colors cursor-pointer select-none ml-auto"
                          title="Sort by TOT STK"
                        >
                          <span>TOT STK</span>
                          {renderSortIndicator('stock')}
                        </button>
                      </TableHead>

                      {/* 6. AVL STK (Pinned Top) */}
                      <TableHead className="sticky top-0 z-30 bg-slate-100 dark:bg-slate-850 text-right min-w-[110px] font-bold text-emerald-700 dark:text-emerald-400 border-b border-slate-200 dark:border-slate-700 px-2 py-2 shadow-xs">
                        <button
                          type="button"
                          onClick={() => handleColumnSort('free')}
                          className="group inline-flex items-center gap-1 font-bold text-emerald-700 dark:text-emerald-400 hover:text-emerald-600 transition-colors cursor-pointer select-none ml-auto"
                          title="Sort by AVL STK"
                        >
                          <span>AVL STK</span>
                          {renderSortIndicator('free')}
                        </button>
                      </TableHead>

                      {/* 7. IN STK (Pinned Top) */}
                      <TableHead className="sticky top-0 z-30 bg-slate-100 dark:bg-slate-850 text-right min-w-[125px] font-bold text-emerald-600 dark:text-emerald-400 border-b border-slate-200 dark:border-slate-700 px-2 py-2 shadow-xs">
                        <button
                          type="button"
                          onClick={() => handleColumnSort('in')}
                          className="group inline-flex items-center gap-1 font-bold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 transition-colors cursor-pointer select-none ml-auto"
                          title="Sort by IN STK"
                        >
                          <span>IN STK ({summary?.periodLabel || periodDisplayText.shortBadge})</span>
                          {renderSortIndicator('in')}
                        </button>
                      </TableHead>

                      {/* 8. OUT STK (Pinned Top) */}
                      <TableHead className="sticky top-0 z-30 bg-slate-100 dark:bg-slate-850 text-right min-w-[125px] font-bold text-rose-600 dark:text-rose-400 border-b border-slate-200 dark:border-slate-700 px-2 py-2 shadow-xs">
                        <button
                          type="button"
                          onClick={() => handleColumnSort('out')}
                          className="group inline-flex items-center gap-1 font-bold text-rose-600 dark:text-rose-400 hover:text-rose-700 transition-colors cursor-pointer select-none ml-auto"
                          title="Sort by OUT STK"
                        >
                          <span>OUT STK ({summary?.periodLabel || periodDisplayText.shortBadge})</span>
                          {renderSortIndicator('out')}
                        </button>
                      </TableHead>

                      {/* 9. Total Valuation (Pinned Top) */}
                      <TableHead className="sticky top-0 z-30 bg-slate-100 dark:bg-slate-850 text-right min-w-[115px] font-semibold text-slate-800 dark:text-slate-200 border-r border-b border-slate-200 dark:border-slate-700 px-2 py-2 shadow-xs">
                        <button
                          type="button"
                          onClick={() => handleColumnSort('valuation')}
                          className="group inline-flex items-center gap-1 font-semibold text-slate-800 dark:text-slate-200 hover:text-emerald-600 transition-colors cursor-pointer select-none ml-auto"
                          title="Sort by Total Valuation"
                        >
                          <span>Total Valuation (₹)</span>
                          {renderSortIndicator('valuation')}
                        </button>
                      </TableHead>

                      {/* Dynamic Chronological Supplier Invoice Date Headers (DD-MM-YYYY) (Pinned Top) */}
                      {matrixDates.length === 0 ? (
                        <TableHead className="sticky top-0 z-30 bg-slate-100 dark:bg-slate-850 min-w-[180px] text-center text-slate-400 border-b border-slate-200 dark:border-slate-700 shadow-xs">
                          No Movement Dates Found
                        </TableHead>
                      ) : (
                        matrixDates.map((dateStr) => (
                          <TableHead
                            key={dateStr}
                            className="sticky top-0 z-30 bg-slate-100 dark:bg-slate-850 min-w-[105px] max-w-[130px] text-center font-bold font-mono text-slate-800 dark:text-slate-200 border-r border-b border-slate-200/80 dark:border-slate-750 px-2 py-2 shadow-xs"
                            title={`Supplier Invoice Date: ${dateStr}`}
                          >
                            <div className="text-[11px] font-bold text-slate-800 dark:text-slate-200">{dateStr}</div>
                          </TableHead>
                        ))
                      )}
                    </TableRow>
                  </TableHeader>

                  <TableBody>
                    {isAnyLoading ? (
                      Array.from({ length: 6 }).map((_, idx) => (
                        <TableRow key={idx}>
                          <TableCell colSpan={9 + Math.max(1, matrixDates.length)} className="py-4">
                            <Skeleton className="h-6 w-full rounded-md" />
                          </TableCell>
                        </TableRow>
                      ))
                    ) : paginatedMaterials.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9 + Math.max(1, matrixDates.length)} className="py-12 text-center text-slate-400">
                          <div className="flex flex-col items-center justify-center space-y-2">
                            <Package className="w-8 h-8 text-slate-300 dark:text-slate-600" />
                            <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                              {period !== 'all' ? `No raw material movements recorded for ${summary?.periodLabel || periodDisplayText.label}.` : 'No raw materials match the current filters.'}
                            </p>
                            <p className="text-xs text-slate-500">
                              {period !== 'all' ? 'Select "All Time" to view total live stock balances, or choose another time period.' : 'Try adjusting your search keyword or category filter.'}
                            </p>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      paginatedMaterials.map((mat) => {
                        const cur = Number(mat.currentStock || 0);
                        const wip = Number(mat.inProgressStock || 0);
                        const free = mat.availableStock !== undefined ? Number(mat.availableStock) : Math.max(0, cur - wip);
                        const val = Number(mat.valuation || 0);

                        return (
                          <TableRow
                            key={mat.id}
                            className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 border-b border-slate-200/80 dark:border-slate-800 text-xs transition-colors group"
                          >
                            {/* 1. Frozen RM Code */}
                            <TableCell className="sticky left-0 z-20 bg-white dark:bg-slate-900 group-hover:bg-slate-50 dark:group-hover:bg-slate-800/80 border-r border-slate-200 dark:border-slate-700 font-mono font-bold py-2 px-2 shadow-xs w-[95px] min-w-[95px] max-w-[95px] truncate">
                              <button
                                onClick={() => handleOpenHistory(mat.id)}
                                className="text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer truncate"
                                title={`Click to view audit timeline for ${mat.code}`}
                              >
                                {mat.code}
                              </button>
                            </TableCell>

                            {/* 2. Frozen Category Name */}
                            <TableCell className="sticky left-[95px] z-20 bg-white dark:bg-slate-900 group-hover:bg-slate-50 dark:group-hover:bg-slate-800/80 border-r border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 py-2 px-2 shadow-xs w-[130px] min-w-[130px] max-w-[130px] truncate" title={mat.category}>
                              {mat.category || '—'}
                            </TableCell>

                            {/* 3. Frozen Raw Material Name */}
                            <TableCell className="sticky left-[225px] z-20 bg-white dark:bg-slate-900 group-hover:bg-slate-50 dark:group-hover:bg-slate-800/80 border-r border-slate-200 dark:border-slate-700 font-semibold text-slate-900 dark:text-white py-2 px-2 shadow-xs w-[170px] min-w-[170px] max-w-[170px] truncate" title={mat.name}>
                              {mat.name}
                            </TableCell>

                            {/* 4. Frozen UOM */}
                            <TableCell className="sticky left-[395px] z-20 bg-white dark:bg-slate-900 group-hover:bg-slate-50 dark:group-hover:bg-slate-800/80 border-r-2 border-slate-300 dark:border-slate-700 shadow-[4px_0_6px_-2px_rgba(0,0,0,0.1)] font-mono text-slate-500 py-2 px-2 w-[65px] min-w-[65px] max-w-[65px] truncate">
                              {formatUOM(mat.uom)}
                            </TableCell>

                            <TableCell className="text-right font-mono font-bold text-slate-900 dark:text-white py-2">
                              {cur.toLocaleString('en-IN', { maximumFractionDigits: 1 })}
                            </TableCell>

                            <TableCell className="text-right font-mono font-bold text-emerald-700 dark:text-emerald-400 py-2">
                              {free.toLocaleString('en-IN', { maximumFractionDigits: 1 })}
                            </TableCell>

                            <TableCell className="text-right font-mono font-bold text-emerald-600 dark:text-emerald-400 py-2">
                              {Number(mat.periodInQty || 0) > 0 ? (
                                <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                                  {Number(mat.periodInQty).toLocaleString('en-IN', { maximumFractionDigits: 1 })}
                                </span>
                              ) : '0'}
                            </TableCell>

                            <TableCell className="text-right font-mono font-bold text-rose-600 dark:text-rose-400 py-2">
                              {Number(mat.periodOutQty || 0) > 0 ? (
                                <span className="text-rose-600 dark:text-rose-400 font-bold">
                                  {Number(mat.periodOutQty).toLocaleString('en-IN', { maximumFractionDigits: 1 })}
                                </span>
                              ) : '0'}
                            </TableCell>

                            <TableCell
                              className="text-right font-mono font-semibold text-slate-800 dark:text-slate-200 border-r border-slate-200 dark:border-slate-700 py-2 cursor-pointer hover:bg-emerald-50/70 dark:hover:bg-emerald-950/40 transition-colors select-none group/val"
                              onMouseEnter={(e) => handleValuationMouseEnter(e, mat)}
                              onMouseOver={(e) => handleValuationMouseEnter(e, mat)}
                              onMouseLeave={handleValuationMouseLeave}
                              onClick={(e) => handleValuationClick(e, mat)}
                            >
                              <div
                                className="inline-flex items-center justify-end gap-1"
                                onMouseEnter={(e) => handleValuationMouseEnter(e, mat)}
                                onMouseOver={(e) => handleValuationMouseEnter(e, mat)}
                              >
                                <span>₹{val.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                                <span className="text-[9px] text-slate-400 group-hover/val:text-emerald-600 transition-colors">ℹ️</span>
                              </div>
                            </TableCell>

                            {/* Dynamic Date Columns matching Image 1 */}
                            {matrixDates.length === 0 ? (
                              <TableCell className="text-center text-slate-400 py-2">
                                —
                              </TableCell>
                            ) : (
                              matrixDates.map((dateStr) => {
                                const cell = matrixData[mat.id]?.[dateStr] || { inQty: 0, outQty: 0, transactions: [] };
                                const hasIn = cell.inQty > 0;
                                const hasOut = cell.outQty > 0;

                                // PO Supplier Invoice No check
                                const poTx = cell.transactions.find(t => t.supplierInvoiceNo || t.poReferenceNo);
                                const invNo = poTx?.supplierInvoiceNo;

                                return (
                                  <TableCell
                                    key={dateStr}
                                    className={`text-center font-mono py-1.5 px-1.5 border-r border-slate-100 dark:border-slate-800/80 align-middle select-none transition-colors duration-100 ${
                                      cell.transactions.length > 0 ? 'cursor-pointer hover:bg-slate-100/70 dark:hover:bg-slate-800/70' : ''
                                    }`}
                                    onMouseEnter={(e) => handleCellMouseEnter(e, mat, dateStr, cell)}
                                    onMouseLeave={handleCellMouseLeave}
                                    onClick={(e) => handleCellClick(e, mat, dateStr, cell)}
                                  >
                                    {hasIn && hasOut ? (
                                      <div className="flex flex-col items-center gap-0.5">
                                        <span className="w-full text-center px-1.5 py-0.5 rounded-sm font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 text-[11px] leading-tight border border-emerald-200 dark:border-emerald-800/60">
                                          +{cell.inQty.toLocaleString('en-IN', { maximumFractionDigits: 1 })}
                                        </span>
                                        <span className="w-full text-center px-1.5 py-0.5 rounded-sm font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/60 text-[11px] leading-tight border border-rose-200 dark:border-rose-800/60">
                                          -{cell.outQty.toLocaleString('en-IN', { maximumFractionDigits: 1 })}
                                        </span>
                                        {invNo && (
                                          <span className="text-[9px] text-emerald-700/80 dark:text-emerald-400/80 font-sans leading-none font-semibold truncate max-w-[85px]" title={`Invoice No: ${invNo}`}>
                                            #{invNo}
                                          </span>
                                        )}
                                      </div>
                                    ) : hasIn ? (
                                      <div className="inline-flex flex-col items-center">
                                        <span className="px-2 py-0.5 rounded-md font-bold text-emerald-600 dark:text-emerald-400 text-xs">
                                          +{cell.inQty.toLocaleString('en-IN', { maximumFractionDigits: 1 })}
                                        </span>
                                        {invNo && (
                                          <span className="text-[9px] text-emerald-700/80 dark:text-emerald-400/80 font-sans leading-none font-semibold truncate max-w-[85px]" title={`Invoice No: ${invNo}`}>
                                            #{invNo}
                                          </span>
                                        )}
                                      </div>
                                    ) : hasOut ? (
                                      <span className="px-2 py-0.5 rounded-md font-bold text-rose-600 dark:text-rose-400 text-xs">
                                        -{cell.outQty.toLocaleString('en-IN', { maximumFractionDigits: 1 })}
                                      </span>
                                    ) : (
                                      <span className="text-slate-300 dark:text-slate-700 select-none">—</span>
                                    )}
                                  </TableCell>
                                );
                              })
                            )}
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile & Tablet Responsive View for Matrix */}
              <div className={`${tabletViewMode === 'table' ? 'hidden' : 'lg:hidden'} divide-y divide-slate-200 dark:divide-slate-800`}>
                {isAnyLoading ? (
                  Array.from({ length: 4 }).map((_, idx) => (
                    <div key={idx} className="p-3.5 space-y-2.5">
                      <Skeleton className="h-4 w-1/3 rounded-sm" />
                      <Skeleton className="h-12 w-full rounded-md" />
                    </div>
                  ))
                ) : paginatedMaterials.length === 0 ? (
                  <div className="py-8 text-center text-slate-400 text-xs">No materials found.</div>
                ) : (
                  paginatedMaterials.map((mat) => {
                    const cur = Number(mat.currentStock || 0);
                    const wip = Number(mat.inProgressStock || 0);
                    const free = mat.availableStock !== undefined ? Number(mat.availableStock) : Math.max(0, cur - wip);
                    const inQty = Number(mat.periodInQty || 0);
                    const outQty = Number(mat.periodOutQty || 0);
                    const val = Number(mat.valuation || 0);

                    // Collect dates with movement for this material
                    const activeDates = matrixDates.filter(dStr => {
                      const c = matrixData[mat.id]?.[dStr];
                      return c && (c.inQty > 0 || c.outQty > 0);
                    });

                    return (
                      <div key={mat.id} className="p-3 sm:p-4 space-y-2.5 bg-white dark:bg-slate-900 transition-colors">
                        {/* Header Row */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="space-y-0.5 flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <button
                                onClick={() => handleOpenHistory(mat.id)}
                                className="font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                              >
                                {mat.code}
                              </button>
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 font-medium">
                                {mat.category || 'Uncategorised'}
                              </span>
                              <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
                                {formatUOM(mat.uom)}
                              </span>
                            </div>
                            <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate" title={mat.name}>
                              {mat.name}
                            </h3>
                          </div>
                          <div className="text-right font-mono shrink-0 pl-1">
                            <div className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                              {cur.toLocaleString('en-IN', { maximumFractionDigits: 1 })} <span className="text-[10px] font-normal text-slate-500">{formatUOM(mat.uom)}</span>
                            </div>
                            <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
                              Free: {free.toLocaleString('en-IN', { maximumFractionDigits: 1 })}
                            </div>
                          </div>
                        </div>

                        {/* Mini Summary Strip */}
                        <div className="flex flex-wrap items-center justify-between gap-1.5 p-1.5 px-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 text-xs">
                          <div className="flex items-center gap-3">
                            <span className="text-[11px] text-emerald-700 dark:text-emerald-400 font-semibold">
                              IN: +{inQty.toLocaleString('en-IN')}
                            </span>
                            <span className="text-[11px] text-rose-700 dark:text-rose-400 font-semibold">
                              OUT: -{outQty.toLocaleString('en-IN')}
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-500">
                            Valuation: <strong className="font-semibold text-slate-700 dark:text-slate-300">₹{val.toLocaleString('en-IN')}</strong>
                          </div>
                        </div>

                        {/* Date Movements Grid: 1 col on small phones, 2 on sm, 3 on tablet */}
                        <div className="space-y-1.5 pt-1 border-t border-slate-100 dark:border-slate-800">
                          <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                            <span>Date Movements ({activeDates.length}):</span>
                            <span className="text-slate-400 font-normal lowercase">tap date for full details</span>
                          </div>
                          {activeDates.length === 0 ? (
                            <div className="py-2 text-[11px] text-slate-400 italic">No movements recorded in this period.</div>
                          ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                              {activeDates.map(dStr => {
                                const c = matrixData[mat.id]?.[dStr] || { inQty: 0, outQty: 0, transactions: [] };
                                const poTx = c.transactions?.find(t => t.supplierInvoiceDate || t.supplierInvoiceNo || t.poReferenceNo);
                                const poNo = poTx?.poReferenceNo || poTx?.poNumber;
                                const grnNo = poTx?.grnNumber || (poTx?.type === 'GRN' ? poTx?.referenceNo : null);
                                const invDate = poTx?.supplierInvoiceDate ? formatDate(poTx.supplierInvoiceDate) : null;

                                return (
                                  <div
                                    key={dStr}
                                    className="p-2 sm:p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 font-mono space-y-1 cursor-pointer hover:border-emerald-500 hover:shadow-xs transition-all active:scale-[0.98]"
                                    onClick={(e) => handleCellClick(e, mat, dStr, c)}
                                  >
                                    <div className="flex items-center justify-between text-xs font-bold text-slate-800 dark:text-slate-200 border-b border-slate-200/60 dark:border-slate-700/60 pb-1">
                                      <span className="flex items-center gap-1">
                                        <Calendar className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                                        <span>{dStr}</span>
                                      </span>
                                      <span className="text-[10px] font-mono font-semibold px-1.5 py-0.2 rounded-full bg-slate-200/70 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                                        {c.transactions.length} tx
                                      </span>
                                    </div>

                                    <div className="flex items-center justify-between gap-1 text-xs pt-0.5">
                                      <span className="text-[10px] text-slate-500">Flow:</span>
                                      <div className="flex items-center gap-1.5">
                                        {c.inQty > 0 && (
                                          <span className="px-1.5 py-0.5 rounded font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100/80 dark:bg-emerald-950/70 border border-emerald-300 dark:border-emerald-800 text-xs">
                                            +{c.inQty.toLocaleString('en-IN', { maximumFractionDigits: 1 })}
                                          </span>
                                        )}
                                        {c.outQty > 0 && (
                                          <span className="px-1.5 py-0.5 rounded font-bold text-rose-700 dark:text-rose-300 bg-rose-100/80 dark:bg-rose-950/70 border border-rose-300 dark:border-rose-800 text-xs">
                                            -{c.outQty.toLocaleString('en-IN', { maximumFractionDigits: 1 })}
                                          </span>
                                        )}
                                      </div>
                                    </div>

                                    {invDate && (
                                      <div className="text-[10px] text-emerald-700 dark:text-emerald-400 font-semibold flex items-center justify-between pt-0.5">
                                        <span className="text-slate-400">Inv Date:</span>
                                        <span>{invDate}</span>
                                      </div>
                                    )}
                                    {poNo && poNo !== '—' && (
                                      <div className="text-[10px] text-slate-600 dark:text-slate-300 flex items-center justify-between truncate">
                                        <span className="text-slate-400">PO:</span>
                                        <span className="font-semibold text-emerald-600 dark:text-emerald-400 truncate">{poNo}</span>
                                      </div>
                                    )}
                                    {grnNo && grnNo !== '—' && (
                                      <div className="text-[10px] text-slate-600 dark:text-slate-300 flex items-center justify-between truncate">
                                        <span className="text-slate-400">GRN:</span>
                                        <span className="font-semibold text-indigo-600 dark:text-indigo-400 truncate">{grnNo}</span>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Pagination Controls with Page Size Dropdown for Matrix */}
              <div className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-2 px-3 flex flex-col sm:flex-row items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span className="font-medium text-[11px]">Per page:</span>
                  <select
                    value={itemsPerPage}
                    onChange={(e) => {
                      setItemsPerPage(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    className="h-7 px-2 text-xs font-semibold rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none cursor-pointer"
                  >
                    <option value={10}>10</option>
                    <option value={15}>15</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                </div>

                <div className="flex-1 w-full sm:w-auto">
                  <Pagination
                    currentPage={currentPage}
                    totalPages={totalMaterialPages}
                    totalRecords={filteredMaterials.length}
                    pageSize={itemsPerPage}
                    onPageChange={(page) => setCurrentPage(page)}
                  />
                </div>
              </div>
            </Card>
          ) : (
            /* SUB-MODE B: CHRONOLOGICAL DETAILED TRANSACTION STREAM */
            <Card className="border-slate-200 dark:border-slate-800 shadow-2xs bg-white dark:bg-slate-900 overflow-hidden">
              {/* Desktop Table View */}
              <div className="hidden lg:block overflow-auto max-h-[70vh] relative border-b border-slate-200 dark:border-slate-800">
                <Table containerClassName="none" className="border-separate border-spacing-0 w-full">
                  <TableHeader className="sticky top-0 z-30 bg-slate-100 dark:bg-slate-800 shadow-xs">
                    <TableRow className="bg-slate-100 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-[11px]">
                      {/* Date & Time Header */}
                      <TableHead className="sticky top-0 bg-slate-100 dark:bg-slate-800 min-w-[110px] border-b border-slate-200 dark:border-slate-700">
                        <button
                          type="button"
                          onClick={() => handleColumnSort('date')}
                          className="group flex items-center gap-1 font-semibold text-slate-700 dark:text-slate-200 hover:text-emerald-600 transition-colors cursor-pointer select-none"
                        >
                          <span>Date & Time</span>
                          {renderSortIndicator('date')}
                        </button>
                      </TableHead>

                      {/* Flow & Status Header */}
                      <TableHead className="sticky top-0 bg-slate-100 dark:bg-slate-800 text-center min-w-[100px] border-b border-slate-200 dark:border-slate-700">
                        <button
                          type="button"
                          onClick={() => handleColumnSort('flow')}
                          className="group inline-flex items-center gap-1 font-semibold text-slate-700 dark:text-slate-200 hover:text-emerald-600 transition-colors cursor-pointer select-none mx-auto"
                        >
                          <span>Flow & Status</span>
                          {renderSortIndicator('flow')}
                        </button>
                      </TableHead>

                      {/* Transaction Type Header */}
                      <TableHead className="sticky top-0 bg-slate-100 dark:bg-slate-800 min-w-[140px] border-b border-slate-200 dark:border-slate-700">
                        <button
                          type="button"
                          onClick={() => handleColumnSort('type')}
                          className="group flex items-center gap-1 font-semibold text-slate-700 dark:text-slate-200 hover:text-emerald-600 transition-colors cursor-pointer select-none"
                        >
                          <span>Transaction Type</span>
                          {renderSortIndicator('type')}
                        </button>
                      </TableHead>

                      {/* RM Code Header */}
                      <TableHead className="sticky top-0 bg-slate-100 dark:bg-slate-800 min-w-[90px] border-b border-slate-200 dark:border-slate-700">
                        <button
                          type="button"
                          onClick={() => handleColumnSort('code')}
                          className="group flex items-center gap-1 font-semibold text-slate-700 dark:text-slate-200 hover:text-emerald-600 transition-colors cursor-pointer select-none"
                        >
                          <span>RM Code</span>
                          {renderSortIndicator('code')}
                        </button>
                      </TableHead>

                      {/* Raw Material Name Header */}
                      <TableHead className="sticky top-0 bg-slate-100 dark:bg-slate-800 min-w-[170px] border-b border-slate-200 dark:border-slate-700">
                        <button
                          type="button"
                          onClick={() => handleColumnSort('name')}
                          className="group flex items-center gap-1 font-semibold text-slate-700 dark:text-slate-200 hover:text-emerald-600 transition-colors cursor-pointer select-none"
                        >
                          <span>Raw Material Name</span>
                          {renderSortIndicator('name')}
                        </button>
                      </TableHead>

                      {/* Document Ref Header */}
                      <TableHead className="sticky top-0 bg-slate-100 dark:bg-slate-800 min-w-[115px] border-b border-slate-200 dark:border-slate-700">
                        <button
                          type="button"
                          onClick={() => handleColumnSort('ref')}
                          className="group flex items-center gap-1 font-semibold text-slate-700 dark:text-slate-200 hover:text-emerald-600 transition-colors cursor-pointer select-none"
                        >
                          <span>Document Ref</span>
                          {renderSortIndicator('ref')}
                        </button>
                      </TableHead>

                      {/* Supplier Invoice Date Header */}
                      <TableHead className="sticky top-0 bg-slate-100 dark:bg-slate-800 min-w-[125px] font-semibold text-slate-700 dark:text-slate-200 border-b border-slate-200 dark:border-slate-700">
                        Supplier Inv Date
                      </TableHead>

                      {/* Batch / Lot Header */}
                      <TableHead className="sticky top-0 bg-slate-100 dark:bg-slate-800 min-w-[90px] border-b border-slate-200 dark:border-slate-700">
                        <button
                          type="button"
                          onClick={() => handleColumnSort('batch')}
                          className="group flex items-center gap-1 font-semibold text-slate-700 dark:text-slate-200 hover:text-emerald-600 transition-colors cursor-pointer select-none"
                        >
                          <span>Batch / Lot</span>
                          {renderSortIndicator('batch')}
                        </button>
                      </TableHead>

                      {/* Inward (IN) Header */}
                      <TableHead className="sticky top-0 bg-slate-100 dark:bg-slate-800 text-right min-w-[85px] border-b border-slate-200 dark:border-slate-700">
                        <button
                          type="button"
                          onClick={() => handleColumnSort('in')}
                          className="group inline-flex items-center gap-1 font-semibold text-emerald-700 dark:text-emerald-400 hover:text-emerald-800 transition-colors cursor-pointer select-none ml-auto"
                        >
                          <span>Inward (IN)</span>
                          {renderSortIndicator('in')}
                        </button>
                      </TableHead>

                      {/* Outward (OUT) Header */}
                      <TableHead className="sticky top-0 bg-slate-100 dark:bg-slate-800 text-right min-w-[85px] border-b border-slate-200 dark:border-slate-700">
                        <button
                          type="button"
                          onClick={() => handleColumnSort('out')}
                          className="group inline-flex items-center gap-1 font-semibold text-rose-700 dark:text-rose-400 hover:text-rose-800 transition-colors cursor-pointer select-none ml-auto"
                        >
                          <span>Outward (OUT)</span>
                          {renderSortIndicator('out')}
                        </button>
                      </TableHead>

                      {/* Rate Header */}
                      <TableHead className="sticky top-0 bg-slate-100 dark:bg-slate-800 text-right min-w-[85px] border-b border-slate-200 dark:border-slate-700">
                        <button
                          type="button"
                          onClick={() => handleColumnSort('rate')}
                          className="group inline-flex items-center gap-1 font-semibold text-slate-700 dark:text-slate-200 hover:text-emerald-600 transition-colors cursor-pointer select-none ml-auto"
                        >
                          <span>Rate (₹)</span>
                          {renderSortIndicator('rate')}
                        </button>
                      </TableHead>

                      {/* Amount Header */}
                      <TableHead className="sticky top-0 bg-slate-100 dark:bg-slate-800 text-right min-w-[85px] border-b border-slate-200 dark:border-slate-700">
                        <button
                          type="button"
                          onClick={() => handleColumnSort('amount')}
                          className="group inline-flex items-center gap-1 font-semibold text-slate-700 dark:text-slate-200 hover:text-emerald-600 transition-colors cursor-pointer select-none ml-auto"
                        >
                          <span>Amount (₹)</span>
                          {renderSortIndicator('amount')}
                        </button>
                      </TableHead>

                      {/* QC Status Header */}
                      <TableHead className="sticky top-0 bg-slate-100 dark:bg-slate-800 text-center min-w-[95px] border-b border-slate-200 dark:border-slate-700">
                        <button
                          type="button"
                          onClick={() => handleColumnSort('qc')}
                          className="group inline-flex items-center gap-1 font-semibold text-slate-700 dark:text-slate-200 hover:text-emerald-600 transition-colors cursor-pointer select-none mx-auto"
                        >
                          <span>QC Status</span>
                          {renderSortIndicator('qc')}
                        </button>
                      </TableHead>

                      {/* Party / Notes Header */}
                      <TableHead className="sticky top-0 bg-slate-100 dark:bg-slate-800 min-w-[150px] border-b border-slate-200 dark:border-slate-700">
                        <button
                          type="button"
                          onClick={() => handleColumnSort('party')}
                          className="group flex items-center gap-1 font-semibold text-slate-700 dark:text-slate-200 hover:text-emerald-600 transition-colors cursor-pointer select-none"
                        >
                          <span>Party / Notes</span>
                          {renderSortIndicator('party')}
                        </button>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isAnyLoading ? (
                      Array.from({ length: 6 }).map((_, idx) => (
                        <TableRow key={idx}>
                          <TableCell colSpan={14} className="py-3">
                            <Skeleton className="h-5 w-full rounded-md" />
                          </TableCell>
                        </TableRow>
                      ))
                    ) : paginatedTransactions.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={14} className="py-10 text-center text-slate-400">
                          <div className="flex flex-col items-center justify-center space-y-1.5">
                            <Calendar className="w-7 h-7 text-slate-300 dark:text-slate-600" />
                            <p className="text-xs font-medium">No transactions recorded for this period.</p>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      paginatedTransactions.map((tx) => {
                        const isIn = tx.flow === 'IN';
                        const isInProgress = Boolean(tx.isInProgress || tx.batchStatus === 'IN_PROGRESS');
                        const isTxReject = Boolean(tx.isLabRejected || String(tx.labStatus || '').includes('REJECT'));
                        const pyClass = isCompactDensity ? 'py-1.5' : 'py-2.5';
                        const invDate = tx.supplierInvoiceDate ? formatDate(tx.supplierInvoiceDate) : '—';

                        return (
                          <TableRow
                            key={tx.id}
                            className={`text-xs border-b transition-colors ${
                              isTxReject
                                ? 'bg-rose-50/70 dark:bg-rose-950/30 border-l-4 border-l-rose-500'
                                : isInProgress
                                ? 'bg-amber-50/70 dark:bg-amber-950/30 border-l-4 border-l-amber-500'
                                : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/40 border-slate-200/80 dark:border-slate-800'
                            }`}
                          >
                            <TableCell className={`font-mono text-slate-600 dark:text-slate-400 ${pyClass}`}>
                              {formatDateTime(tx.date)}
                            </TableCell>
                            <TableCell className={`text-center ${pyClass}`}>
                              {isTxReject ? (
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-rose-100 text-rose-900 border border-rose-300">
                                  ❌ REJECTED
                                </span>
                              ) : isInProgress ? (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                                  <span className="w-1 h-1 rounded-full bg-amber-500 animate-pulse" />
                                  🟡 IN PROGRESS
                                </span>
                              ) : (
                                <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-full text-[9px] font-bold ${
                                  isIn
                                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                    : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                                }`}>
                                  {isIn ? '🟢 IN' : '🔴 OUT'}
                                </span>
                              )}
                            </TableCell>
                            <TableCell className={`font-medium ${pyClass}`}>
                              <div className="truncate max-w-[140px]" title={tx.typeLabel}>
                                {tx.typeLabel}
                              </div>
                            </TableCell>
                            <TableCell className={`font-mono font-semibold ${pyClass}`}>
                              <button
                                onClick={() => handleOpenHistory(tx.rawMaterialId)}
                                className="text-emerald-700 dark:text-emerald-400 hover:underline font-bold cursor-pointer"
                              >
                                {tx.rawMaterialCode}
                              </button>
                            </TableCell>
                            <TableCell className={pyClass}>
                              <div className="font-medium text-slate-900 dark:text-slate-100 truncate max-w-[170px]" title={tx.rawMaterialName}>
                                {tx.rawMaterialName}
                              </div>
                              <div className="text-[10px] text-slate-400">
                                {tx.category} • {tx.uom}
                              </div>
                            </TableCell>
                            <TableCell className={`font-mono ${pyClass}`}>
                              {tx.poId ? (
                                <button
                                  onClick={() => handleRedirectToPO(tx.poId, tx.referenceNo)}
                                  className="text-blue-600 hover:underline flex items-center gap-0.5 font-semibold cursor-pointer"
                                >
                                  <span>{tx.referenceNo}</span>
                                  <ExternalLink className="w-2.5 h-2.5" />
                                </button>
                              ) : tx.grnId ? (
                                <button
                                  onClick={() => handleRedirectToGRN(tx.grnId, tx.referenceNo)}
                                  className="text-emerald-600 hover:underline flex items-center gap-0.5 font-semibold cursor-pointer"
                                >
                                  <span>{tx.referenceNo}</span>
                                  <ExternalLink className="w-2.5 h-2.5" />
                                </button>
                              ) : tx.batchId || isInProgress ? (
                                <button
                                  onClick={() => handleRedirectToBatch(tx.batchId, tx.referenceNo)}
                                  className={`hover:underline flex items-center gap-0.5 font-semibold cursor-pointer ${
                                    isInProgress ? 'text-amber-700 font-bold' : 'text-purple-600'
                                  }`}
                                >
                                  <span>{tx.referenceNo}</span>
                                  <ExternalLink className="w-2.5 h-2.5" />
                                </button>
                              ) : (
                                <span className="text-slate-700 dark:text-slate-300">{tx.referenceNo || '—'}</span>
                              )}
                            </TableCell>

                            {/* Supplier Invoice Date */}
                            <TableCell className={`font-mono text-xs ${pyClass} ${invDate !== '—' ? 'font-bold text-emerald-700 dark:text-emerald-400' : 'text-slate-400'}`}>
                              {invDate}
                            </TableCell>

                            <TableCell className={`font-mono text-slate-500 ${pyClass}`}>
                              {tx.batchNumber || '—'}
                            </TableCell>
                            <TableCell className={`text-right font-mono font-bold text-emerald-600 dark:text-emerald-400 ${pyClass}`}>
                              {isIn ? `+${Number(tx.quantity).toLocaleString('en-IN', { maximumFractionDigits: 1 })}` : '—'}
                            </TableCell>
                            <TableCell className={`text-right font-mono font-bold ${isInProgress ? 'text-amber-700' : 'text-rose-600'} ${pyClass}`}>
                              {!isIn ? `-${Number(tx.quantity).toLocaleString('en-IN', { maximumFractionDigits: 1 })}` : '—'}
                            </TableCell>
                            <TableCell className={`text-right font-mono text-slate-700 dark:text-slate-300 ${pyClass}`}>
                              {tx.rate ? `₹${Number(tx.rate).toFixed(2)}` : '—'}
                            </TableCell>
                            <TableCell className={`text-right font-mono font-semibold text-slate-900 dark:text-white ${pyClass}`}>
                              {tx.amount ? `₹${Number(tx.amount).toLocaleString('en-IN', { maximumFractionDigits: 0 })}` : '—'}
                            </TableCell>
                            <TableCell className={`text-center ${pyClass}`}>
                              {isTxReject ? (
                                <span className="text-rose-700 font-bold text-[10px]">❌ Rejected</span>
                              ) : (
                                <span className="text-emerald-700 font-medium text-[10px]">Passed</span>
                              )}
                            </TableCell>
                            <TableCell className={`${pyClass} text-slate-700 dark:text-slate-300 truncate max-w-[150px]`} title={tx.compositeComment || tx.partyName}>
                              {tx.partyName || tx.user || '—'}
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile & Tablet Ledger Cards View */}
              <div className="lg:hidden divide-y divide-slate-200 dark:divide-slate-800">
                {isAnyLoading ? (
                  Array.from({ length: 4 }).map((_, idx) => (
                    <div key={idx} className="p-3.5 space-y-2">
                      <Skeleton className="h-4 w-1/3 rounded-sm" />
                      <Skeleton className="h-12 w-full rounded-md" />
                    </div>
                  ))
                ) : paginatedTransactions.length === 0 ? (
                  <div className="py-8 text-center text-slate-400 text-xs">No movements recorded.</div>
                ) : (
                  paginatedTransactions.map((tx) => {
                    const isIn = tx.flow === 'IN';
                    const isInProgress = Boolean(tx.isInProgress || tx.batchStatus === 'IN_PROGRESS');
                    const isTxReject = Boolean(tx.isLabRejected || String(tx.labStatus || '').includes('REJECT') || Number(tx.rejectedQty || 0) > 0);
                    const invDate = tx.supplierInvoiceDate ? formatDate(tx.supplierInvoiceDate) : null;
                    const rate = Number(tx.rate || 0);
                    const qty = Number(tx.quantity || 0);
                    const amt = Number(tx.amount || (rate * qty) || 0);

                    return (
                      <div
                        key={tx.id}
                        className={`p-3 sm:p-4 space-y-2.5 bg-white dark:bg-slate-900 transition-colors ${
                          isTxReject
                            ? 'border-l-4 border-l-rose-500 bg-rose-50/40 dark:bg-rose-950/20'
                            : isInProgress
                            ? 'border-l-4 border-l-amber-500 bg-amber-50/40 dark:bg-amber-950/20'
                            : ''
                        }`}
                      >
                        {/* Top Header: Date/Time + Flow Badge */}
                        <div className="flex items-center justify-between text-xs font-mono">
                          <span className="text-slate-500 dark:text-slate-400">{formatDateTime(tx.date)}</span>
                          {isTxReject ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-900 dark:bg-rose-950 dark:text-rose-300 border border-rose-300">
                              ❌ REJECTED
                            </span>
                          ) : isInProgress ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300 border border-amber-300">
                              🟡 IN PROGRESS (WIP)
                            </span>
                          ) : (
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              isIn
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300'
                                : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border border-rose-300'
                            }`}>
                              {isIn ? '🟢 IN' : '🔴 OUT'}
                            </span>
                          )}
                        </div>

                        {/* Material & Type Row */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="space-y-0.5 flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <button
                                onClick={() => handleOpenHistory(tx.rawMaterialId)}
                                className="font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                              >
                                {tx.rawMaterialCode}
                              </button>
                              <span className="text-[10px] text-slate-500">
                                {tx.category} • {formatUOM(tx.uom)}
                              </span>
                            </div>
                            <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate" title={tx.rawMaterialName}>
                              {tx.rawMaterialName}
                            </h3>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-[10px] sm:text-[11px] block">
                              {tx.typeLabel}
                            </span>
                          </div>
                        </div>

                        {/* Financial & Quantity Metrics Grid (3 cols) */}
                        <div className="grid grid-cols-3 gap-1.5 p-2 rounded-xl bg-slate-50 dark:bg-slate-850 text-center font-mono text-xs">
                          <div className="p-1 rounded-lg bg-white dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-700/50">
                            <span className="text-[9px] text-slate-400 block font-sans">Quantity</span>
                            <span className={`font-bold ${isIn ? 'text-emerald-600 dark:text-emerald-400' : isInProgress ? 'text-amber-700 dark:text-amber-400' : 'text-rose-600 dark:text-rose-400'}`}>
                              {isIn ? `+${qty.toLocaleString('en-IN')}` : `-${qty.toLocaleString('en-IN')}`} {formatUOM(tx.uom)}
                            </span>
                          </div>
                          <div className="p-1 rounded-lg bg-white dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-700/50">
                            <span className="text-[9px] text-slate-400 block font-sans">Unit Rate</span>
                            <span className="font-semibold text-slate-700 dark:text-slate-300">
                              {rate > 0 ? `₹${rate.toFixed(2)}` : '—'}
                            </span>
                          </div>
                          <div className="p-1 rounded-lg bg-white dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-700/50">
                            <span className="text-[9px] text-slate-400 block font-sans">Amount</span>
                            <span className="font-bold text-slate-900 dark:text-white">
                              {amt > 0 ? `₹${amt.toLocaleString('en-IN', { maximumFractionDigits: 0 })}` : '—'}
                            </span>
                          </div>
                        </div>

                        {/* Document Ref, Invoice Date & QC Status */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 text-xs pt-1 border-t border-slate-100 dark:border-slate-800">
                          <div className="flex items-center gap-2 flex-wrap font-mono">
                            <span className="text-slate-500">Ref:</span>
                            {tx.poId ? (
                              <button
                                onClick={() => handleRedirectToPO(tx.poId, tx.referenceNo)}
                                className="text-blue-600 hover:underline inline-flex items-center gap-0.5 font-semibold"
                              >
                                <span>{tx.referenceNo}</span>
                                <ExternalLink className="w-2.5 h-2.5" />
                              </button>
                            ) : tx.grnId ? (
                              <button
                                onClick={() => handleRedirectToGRN(tx.grnId, tx.referenceNo)}
                                className="text-emerald-600 hover:underline inline-flex items-center gap-0.5 font-semibold"
                              >
                                <span>{tx.referenceNo}</span>
                                <ExternalLink className="w-2.5 h-2.5" />
                              </button>
                            ) : tx.batchId || isInProgress ? (
                              <button
                                onClick={() => handleRedirectToBatch(tx.batchId, tx.referenceNo)}
                                className={`hover:underline inline-flex items-center gap-0.5 font-semibold ${
                                  isInProgress ? 'text-amber-700 font-bold' : 'text-purple-600'
                                }`}
                              >
                                <span>{tx.referenceNo}</span>
                                <ExternalLink className="w-2.5 h-2.5" />
                              </button>
                            ) : (
                              <span className="text-slate-700 dark:text-slate-300 font-semibold">{tx.referenceNo || '—'}</span>
                            )}

                            {tx.batchNumber && tx.batchNumber !== '—' && (
                              <span className="text-[10px] text-slate-500">
                                (Batch: {tx.batchNumber})
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2 text-[11px] text-slate-500">
                            {invDate && (
                              <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                                Inv: {invDate}
                              </span>
                            )}
                            <span className="truncate max-w-[160px]" title={tx.partyName || tx.user}>
                              {tx.partyName || tx.user || '—'}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Pagination Controls with Page Size Dropdown for Stream */}
              <div className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-2 px-3 flex flex-col sm:flex-row items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span className="font-medium text-[11px]">Per page:</span>
                  <select
                    value={itemsPerPage}
                    onChange={(e) => {
                      setItemsPerPage(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    className="h-7 px-2 text-xs font-semibold rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none cursor-pointer"
                  >
                    <option value={10}>10</option>
                    <option value={15}>15</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                </div>

                <div className="flex-1 w-full sm:w-auto">
                  <Pagination
                    currentPage={currentPage}
                    totalPages={totalTransactionPages}
                    totalRecords={filteredTransactions.length}
                    pageSize={itemsPerPage}
                    onPageChange={(page) => setCurrentPage(page)}
                  />
                </div>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* ── EXPORT OPTIONS MODAL (2 Dedicated Types + Master Multi-Sheet Option) ── */}
      {isExportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden max-h-[90vh] flex flex-col p-4 sm:p-5">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 shrink-0">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Export Raw Material In-Out Reports
                </h2>
              </div>
              <button
                onClick={() => setIsExportModalOpen(false)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-400 shrink-0 pt-2 pb-1">
              Select your export format. Both options include batch numbers, PO numbers, rates, valuations, lab inspection results, and full audit comments.
            </p>

            <div className="space-y-3 overflow-y-auto pr-1 flex-1 py-1">
              {/* Option 1: Date-Wise Stock In-Out Matrix (Matches User's Excel Format) */}
              <div
                onClick={handleExportMatrixOnly}
                className="group p-3.5 rounded-xl border border-emerald-400 dark:border-emerald-700 hover:border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/40 hover:bg-emerald-100/50 transition-all cursor-pointer flex items-start gap-3 shadow-xs"
              >
                <div className="p-2 rounded-lg bg-emerald-600 text-white shrink-0 group-hover:scale-105 transition-transform shadow-xs">
                  <TableProperties className="w-4 h-4" />
                </div>
                <div className="space-y-0.5 flex-1">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-emerald-950 dark:text-emerald-200 group-hover:text-emerald-700">
                      1. Date-Wise Stock In-Out Matrix Report (Excel Layout)
                    </h3>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-600 text-white">
                      Matches Excel Grid
                    </span>
                  </div>
                  <p className="text-[11px] text-emerald-800/90 dark:text-emerald-400/90">
                    Full date-by-date matrix grid: RM Code, Material Name, Category, UOM, TotalStock, Available Stock, Period Inward IN, Period Outward OUT, Total Valuation (₹), followed by dynamic chronological date columns ({matrixDates.length} Dates) with Green IN & Red OUT, plus Sheet 2 PO Supplier Invoice Date audit (e.g. 15 Oct 2026).
                  </p>
                </div>
              </div>

              {/* Option 2: Master Summary */}
              <div
                onClick={handleExportSummaryOnly}
                className="group p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-emerald-500 dark:hover:border-emerald-500 bg-slate-50/60 dark:bg-slate-800/40 hover:bg-emerald-50/30 transition-all cursor-pointer flex items-start gap-3"
              >
                <div className="p-2 rounded-lg bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 shrink-0 group-hover:scale-105 transition-transform">
                  <Package className="w-4 h-4" />
                </div>
                <div className="space-y-0.5 flex-1">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-emerald-700">
                      2. Raw Material Master Summary Report
                    </h3>
                    <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">
                      {filteredMaterials.length} Items
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    All raw materials with Total Current Stock, In-Progress WIP, Free Available Stock, Period In/Out, Net Flow, Standard Rates, Valuations, Latest PO, Latest Batch, and Lab/QC Decision Comments.
                  </p>
                </div>
              </div>

              {/* Option 3: Date-Wise Ledger */}
              <div
                onClick={handleExportLedgerOnly}
                className="group p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-emerald-500 dark:hover:border-emerald-500 bg-slate-50/60 dark:bg-slate-800/40 hover:bg-emerald-50/30 transition-all cursor-pointer flex items-start gap-3"
              >
                <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-400 shrink-0 group-hover:scale-105 transition-transform">
                  <Calendar className="w-4 h-4" />
                </div>
                <div className="space-y-0.5 flex-1">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-emerald-700">
                      3. Chronological Date-Wise In-Out Ledger (with Supplier Invoice Date)
                    </h3>
                    <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">
                      {filteredTransactions.length} Transactions
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Complete chronological movement log with exact Date & Time, Flow (IN/OUT), PO Supplier Invoice Date (15 Oct 2026), Invoice No, Document Ref, PO Ref, Batch No, In Qty, Out Qty, Unit Rates, Amount, and QC decisions.
                  </p>
                </div>
              </div>

              {/* Option 4: All-in-One Master Workbook */}
              <div
                onClick={handleExportCompleteWorkbook}
                className="group p-3.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-850 hover:bg-slate-100/50 transition-all cursor-pointer flex items-start gap-3"
              >
                <div className="p-2 rounded-lg bg-purple-600 text-white shrink-0 group-hover:scale-105 transition-transform shadow-xs">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div className="space-y-0.5 flex-1">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                      4. Complete Multi-Sheet Enterprise Master Workbook (All-in-One)
                    </h3>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-600 text-white">
                      6 Sheets
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400">
                    Comprehensive multi-sheet workbook containing: Sheet 1 (Date-Wise Matrix), Sheet 2 (Summary), Sheet 3 (Chronological Ledger), Sheet 4 (PO Supplier Invoice Date Audit), Sheet 5 (Floor WIP), and Sheet 6 (QC Audits).
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800 shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsExportModalOpen(false)}
                className="text-xs h-8 cursor-pointer"
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── EMBEDDED RM HISTORY DRAWER ── */}
      {selectedMaterialId && (
        <RMHistoryDrawer
          materialId={selectedMaterialId}
          isOpen={isHistoryOpen}
          onClose={() => {
            setIsHistoryOpen(false);
            setSelectedMaterialId(null);
          }}
          initialTab={historyInitialTab}
        />
      )}

      {/* ── EMBEDDED RM STOCK QUERY MODAL ── */}
      {selectedStockQueryId && (
        <RMStockQueryModal
          materialId={selectedStockQueryId}
          isOpen={isStockQueryOpen}
          onClose={() => {
            setIsStockQueryOpen(false);
            setSelectedStockQueryId(null);
          }}
          onOpenHistory={(matId, tab) => {
            setIsStockQueryOpen(false);
            setSelectedMaterialId(matId);
            setHistoryInitialTab(tab || 'timeline');
            setIsHistoryOpen(true);
          }}
        />
      )}
      {/* ── PORTAL FLOATING POPUP: ATTRACTIVE, SMOOTH & SCROLLABLE STOCK DETAILS SCREEN ── */}
      {activeCellTooltip && tooltipPosition && typeof document !== 'undefined' && createPortal(
        <>
          {/* Backdrop for touch / mobile click-outside */}
          <div
            className="fixed inset-0 z-[99998] bg-transparent lg:hidden"
            onClick={() => setActiveCellTooltip(null)}
          />
          <div
            className="stock-popup-container fixed z-[99999] transition-all duration-200 ease-out animate-in fade-in-0 zoom-in-95 pointer-events-auto"
            style={{
              top: `${tooltipPosition.top}px`,
              left: `${tooltipPosition.left}px`,
              transform: tooltipPosition.placeBelow ? 'translate(-50%, 0)' : 'translate(-50%, -100%)'
            }}
            onMouseEnter={() => {
              if (tooltipHideTimerRef.current) {
                clearTimeout(tooltipHideTimerRef.current);
                tooltipHideTimerRef.current = null;
              }
            }}
            onMouseLeave={handleCellMouseLeave}
          >
            <div className="w-[290px] sm:w-[315px] max-w-[calc(100vw-16px)] rounded-xl bg-white/98 dark:bg-slate-900/98 text-slate-800 dark:text-slate-100 shadow-[0_12px_36px_rgba(0,0,0,0.22)] backdrop-blur-xl border border-slate-200/90 dark:border-slate-700/80 p-2.5 text-left font-sans select-none relative ring-1 ring-black/5 dark:ring-white/10">
              {/* Dynamic Arrow Pointer */}
              <div
                className={`w-3 h-3 bg-white dark:bg-slate-900 border-slate-200/90 dark:border-slate-700/80 rotate-45 absolute ${
                  tooltipPosition.placeBelow
                    ? '-top-1.5 border-t border-l'
                    : '-bottom-1.5 border-b border-r'
                }`}
                style={{
                  left: `calc(50% + ${Math.max(-130, Math.min(130, tooltipPosition.arrowOffset))}px - 6px)`
                }}
              />

              {/* Card Header: Material Info, Movement Date, & Quick Close */}
              <div className="flex items-start justify-between border-b border-slate-100 dark:border-slate-800 pb-1.5 mb-1.5 gap-1.5">
                <div className="flex items-center gap-1.5 min-w-0">
                  <div className="p-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/70 text-emerald-600 dark:text-emerald-400 shrink-0 border border-emerald-200/60 dark:border-emerald-800/50">
                    <Calendar className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1 flex-wrap">
                      <span className="font-bold text-[11px] text-slate-900 dark:text-white tracking-tight">
                        {activeCellTooltip.dateStr}
                      </span>
                      <span className="text-[8.5px] px-1 py-0.2 rounded font-sans font-medium bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/60">
                        Supplier Inv
                      </span>
                      <span className="text-[9px] px-1 py-0.2 rounded font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                        {activeCellTooltip.matCode}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-600 dark:text-slate-300 font-semibold truncate block mt-0.5" title={activeCellTooltip.matName}>
                      {activeCellTooltip.matName}
                    </span>
                  </div>
                </div>

                <div className="flex items-center shrink-0">
                  <button
                    type="button"
                    onClick={() => setActiveCellTooltip(null)}
                    className="p-0.5 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                    title="Close"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Totals Summary Banner for this Cell */}
              <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-800/60 rounded-md px-2 py-1 border border-slate-200/80 dark:border-slate-700/60 mb-1.5 text-[10px]">
                <div className="flex items-center gap-1.5">
                  {activeCellTooltip.cell.inQty > 0 && (
                    <span className="inline-flex items-center gap-0.5 font-bold font-mono text-emerald-700 dark:text-emerald-300 bg-emerald-100/80 dark:bg-emerald-950/80 px-1.5 py-0.2 rounded border border-emerald-300/80 dark:border-emerald-800/70 text-[10px]">
                      <ArrowDownLeft className="w-2.5 h-2.5 text-emerald-600" />
                      +{Number(activeCellTooltip.cell.inQty).toLocaleString('en-IN', { maximumFractionDigits: 1 })} IN
                    </span>
                  )}
                  {activeCellTooltip.cell.outQty > 0 && (
                    <span className="inline-flex items-center gap-0.5 font-bold font-mono text-rose-700 dark:text-rose-300 bg-rose-100/80 dark:bg-rose-950/80 px-1.5 py-0.2 rounded border border-rose-300/80 dark:border-rose-800/70 text-[10px]">
                      <ArrowUpRight className="w-2.5 h-2.5 text-rose-600" />
                      -{Number(activeCellTooltip.cell.outQty).toLocaleString('en-IN', { maximumFractionDigits: 1 })} OUT
                    </span>
                  )}
                </div>
                <span className="text-[9.5px] text-slate-500 font-mono">
                  {activeCellTooltip.cell.transactions.length} record{activeCellTooltip.cell.transactions.length > 1 ? 's' : ''}
                </span>
              </div>

              {/* Scrollable Transactions List with Compact Sizing */}
              <div className="stock-popup-scrollable space-y-1.5 max-h-[220px] overflow-y-auto pr-1 scroll-smooth overscroll-contain [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-slate-100 dark:[&::-webkit-scrollbar-track]:bg-slate-800 [&::-webkit-scrollbar-thumb]:bg-slate-300 dark:[&::-webkit-scrollbar-thumb]:bg-slate-600 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-emerald-500">
                {activeCellTooltip.cell.transactions.map((t, idx) => {
                  const poNo = t.poReferenceNo || t.poNumber || (t.type === 'PO_PROCUREMENT' ? t.referenceNo : null);
                  const grnNo = t.grnNumber || (t.type === 'GRN' ? t.referenceNo : null);
                  const invDate = t.supplierInvoiceDate ? formatDate(t.supplierInvoiceDate) : null;
                  const isIN = t.flow === 'IN';

                  return (
                    <div
                      key={idx}
                      className={`space-y-1 rounded-lg p-2 border transition-all shadow-2xs ${
                        isIN
                          ? 'border-l-3 border-l-emerald-500 bg-emerald-50/40 dark:bg-emerald-950/20 border-slate-200/80 dark:border-slate-750'
                          : 'border-l-3 border-l-rose-500 bg-rose-50/40 dark:bg-rose-950/20 border-slate-200/80 dark:border-slate-750'
                      }`}
                    >
                      {/* Flow Quantity & Type Badge */}
                      <div className="flex items-center justify-between gap-1">
                        <span className={`font-bold font-mono text-[11px] flex items-center gap-1 ${
                          isIN ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'
                        }`}>
                          {isIN ? `+${t.quantity}` : `-${t.quantity}`} {formatUOM(activeCellTooltip.uom)}
                        </span>
                        <span className={`text-[9px] px-1.5 py-0.2 rounded-full font-bold uppercase tracking-wider border ${
                          isIN
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                            : 'bg-rose-100 text-rose-800 dark:bg-rose-900/60 dark:text-rose-300 border-rose-300 dark:border-rose-800'
                        }`}>
                          {t.typeLabel || t.type}
                        </span>
                      </div>

                      {/* PO Number Highlight */}
                      {poNo && poNo !== '—' && (
                        <div className="text-[10px] flex items-center justify-between bg-white dark:bg-slate-900/90 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700/80">
                          <span className="text-slate-600 dark:text-slate-400 font-medium flex items-center gap-1">
                            <FileText className="w-2.5 h-2.5 text-emerald-600 dark:text-emerald-400" />
                            PO Number:
                          </span>
                          <span className="font-mono font-bold text-emerald-700 dark:text-emerald-300 truncate max-w-[150px]">{poNo}</span>
                        </div>
                      )}

                      {/* GRN Number Highlight */}
                      {grnNo && grnNo !== '—' && (
                        <div className="text-[10px] flex items-center justify-between bg-white dark:bg-slate-900/90 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700/80">
                          <span className="text-slate-600 dark:text-slate-400 font-medium flex items-center gap-1">
                            <Package className="w-2.5 h-2.5 text-indigo-600 dark:text-indigo-400" />
                            GRN Number:
                          </span>
                          <span className="font-mono font-bold text-indigo-700 dark:text-indigo-300 truncate max-w-[150px]">{grnNo}</span>
                        </div>
                      )}

                      {/* Invoice Number & Date */}
                      {(t.supplierInvoiceNo || invDate) && (
                        <div className="grid grid-cols-2 gap-1 text-[9.5px]">
                          {t.supplierInvoiceNo && (
                            <div className="bg-white dark:bg-slate-900/90 px-1.5 py-0.5 rounded border border-slate-200/80 dark:border-slate-700/60">
                              <span className="text-slate-400 dark:text-slate-500 block text-[8.5px] font-medium">Inv No</span>
                              <span className="font-mono font-semibold text-slate-800 dark:text-slate-200 truncate block">
                                {t.supplierInvoiceNo}
                              </span>
                            </div>
                          )}
                          {invDate && (
                            <div className="bg-amber-50/70 dark:bg-amber-950/40 px-1.5 py-0.5 rounded border border-amber-200/80 dark:border-amber-800/50">
                              <span className="text-amber-700 dark:text-amber-400 block text-[8.5px] font-medium">Inv Date</span>
                              <span className="font-semibold text-amber-800 dark:text-amber-300 truncate block">
                                {invDate}
                              </span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Batch / Lot */}
                      {t.batchNumber && t.batchNumber !== '—' && (
                        <div className="text-[9.5px] text-slate-600 dark:text-slate-300 flex items-center justify-between px-0.5">
                          <span className="text-slate-400">Batch / Lot:</span>
                          <span className="font-mono font-semibold text-slate-700 dark:text-slate-200 truncate max-w-[150px]">{t.batchNumber}</span>
                        </div>
                      )}

                      {/* Party / Supplier */}
                      {t.partyName && (
                        <div className="text-[9.5px] text-slate-500 dark:text-slate-400 truncate px-0.5 flex items-center gap-1" title={t.partyName}>
                          <Truck className="w-2.5 h-2.5 shrink-0 opacity-70" />
                          <span className="truncate">{t.partyName}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Scroll Indicator if more than 2 transactions */}
              {activeCellTooltip.cell.transactions.length > 2 && (
                <div className="text-[9px] text-center text-slate-400 dark:text-slate-500 pt-1 font-medium select-none flex items-center justify-center gap-1">
                  <span>↓ Scroll to view all records</span>
                </div>
              )}

              {/* Card Footer: View Lifecycle Audit Button */}
              <div className="pt-1.5 mt-1.5 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    const matId = activeCellTooltip.matId;
                    setActiveCellTooltip(null);
                    handleOpenHistory(matId);
                  }}
                  className="w-full py-1 px-2.5 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-semibold flex items-center justify-center gap-1 transition-all shadow-2xs cursor-pointer"
                >
                  <Eye className="w-3 h-3" />
                  <span>View Material Audit Timeline</span>
                </button>
              </div>
            </div>
          </div>
        </>,
        document.body
      )}

      {/* ── PORTAL FLOATING POPUP: REAL-TIME PO LOT VALUATION BREAKDOWN & HOVER TOOLTIP ── */}
      {activeValuationTooltip && valuationTooltipPosition && typeof document !== 'undefined' && createPortal(
        <>
          {/* Backdrop for touch / mobile click-outside */}
          <div
            className="fixed inset-0 z-[99998] bg-transparent lg:hidden"
            onClick={() => setActiveValuationTooltip(null)}
          />
          <div
            className="valuation-popup-container fixed z-[99999] transition-all duration-200 ease-out animate-in fade-in-0 zoom-in-95 pointer-events-auto"
            style={{
              top: `${valuationTooltipPosition.top}px`,
              left: `${valuationTooltipPosition.left}px`,
              transform: valuationTooltipPosition.placeBelow ? 'translate(-50%, 0)' : 'translate(-50%, -100%)'
            }}
            onMouseEnter={() => {
              if (valuationTooltipHideTimerRef.current) {
                clearTimeout(valuationTooltipHideTimerRef.current);
                valuationTooltipHideTimerRef.current = null;
              }
            }}
            onMouseLeave={handleValuationMouseLeave}
          >
            <div className="w-[330px] sm:w-[360px] max-w-[calc(100vw-16px)] rounded-xl bg-white/98 dark:bg-slate-900/98 text-slate-800 dark:text-slate-100 shadow-[0_14px_40px_rgba(0,0,0,0.25)] backdrop-blur-xl border border-slate-200/90 dark:border-slate-700/80 p-3 text-left font-sans select-none relative ring-1 ring-black/5 dark:ring-white/10">
              {/* Dynamic Arrow Pointer */}
              <div
                className={`w-3 h-3 bg-white dark:bg-slate-900 border-slate-200/90 dark:border-slate-700/80 rotate-45 absolute ${
                  valuationTooltipPosition.placeBelow
                    ? '-top-1.5 border-t border-l'
                    : '-bottom-1.5 border-b border-r'
                }`}
                style={{
                  left: `calc(50% + ${Math.max(-150, Math.min(150, valuationTooltipPosition.arrowOffset))}px - 6px)`
                }}
              />

              {/* Card Header: Material Info, Real-Time Stock & Quick Close */}
              <div className="flex items-start justify-between border-b border-slate-100 dark:border-slate-800 pb-2 mb-2 gap-1.5">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/70 text-emerald-600 dark:text-emerald-400 shrink-0 border border-emerald-200/60 dark:border-emerald-800/50">
                    <IndianRupee className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] px-1.5 py-0.5 rounded font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                        {activeValuationTooltip.matCode}
                      </span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded font-sans font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/60">
                        Live PO Lots
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-900 dark:text-white font-bold truncate block mt-0.5" title={activeValuationTooltip.matName}>
                      {activeValuationTooltip.matName}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <span className="font-mono text-[10px] font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                    {activeValuationTooltip.currentStock.toLocaleString('en-IN', { maximumFractionDigits: 1 })} {formatUOM(activeValuationTooltip.uom)}
                  </span>
                  <button
                    type="button"
                    onClick={() => setActiveValuationTooltip(null)}
                    className="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                    title="Close"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* 3-Column Valuation Breakdown Banner */}
              <div className="grid grid-cols-3 gap-1.5 bg-slate-50 dark:bg-slate-800/60 rounded-lg p-2 border border-slate-200/80 dark:border-slate-700/60 mb-2">
                <div className="space-y-0.5 text-left">
                  <div className="text-[9px] font-medium text-slate-500 uppercase tracking-tight">Total Excl. Tax</div>
                  <div className="font-mono font-bold text-xs text-slate-800 dark:text-slate-200">
                    ₹{Number(activeValuationTooltip.valueWithoutTax || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                  </div>
                </div>
                <div className="space-y-0.5 text-center border-x border-slate-200 dark:border-slate-700 px-1">
                  <div className="text-[9px] font-medium text-purple-600 dark:text-purple-400 uppercase tracking-tight">Tax (GST)</div>
                  <div className="font-mono font-bold text-xs text-purple-700 dark:text-purple-300">
                    ₹{Number(activeValuationTooltip.taxValue || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                  </div>
                </div>
                <div className="space-y-0.5 text-right">
                  <div className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-tight">Total + Tax</div>
                  <div className="font-mono font-black text-xs text-emerald-600 dark:text-emerald-400">
                    ₹{Number(activeValuationTooltip.valueWithTax || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                  </div>
                </div>
              </div>

              {/* Contributing PO Lots Breakdown */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[10px] text-slate-500 font-semibold px-0.5">
                  <span>Contributing PO Orders ({activeValuationTooltip.contributingPOs?.length || 0})</span>
                  <span>FIFO Allocation</span>
                </div>

                <div className="max-h-[160px] overflow-y-auto space-y-1.5 pr-0.5 custom-scrollbar">
                  {(!activeValuationTooltip.contributingPOs || activeValuationTooltip.contributingPOs.length === 0) ? (
                    <div className="text-center py-3 text-[11px] text-slate-400">
                      Standard valuation based on latest purchase order rate.
                    </div>
                  ) : (
                    activeValuationTooltip.contributingPOs.map((po, idx) => (
                      <div
                        key={idx}
                        className="p-1.5 rounded-md bg-white dark:bg-slate-800/90 border border-slate-150 dark:border-slate-700/70 text-[10.5px] space-y-1"
                      >
                        <div className="flex items-center justify-between font-mono">
                          <span className="font-bold text-emerald-600 dark:text-emerald-400">
                            {po.poRef}
                          </span>
                          <span className="text-slate-400 text-[9.5px]">
                            {po.poDate ? new Date(po.poDate).toLocaleDateString('en-GB') : ''}
                          </span>
                        </div>
                        {po.supplierName && (
                          <div className="text-[9.5px] text-slate-500 truncate" title={po.supplierName}>
                            {po.supplierName}
                          </div>
                        )}
                        <div className="flex items-center justify-between pt-0.5 border-t border-slate-100 dark:border-slate-700/50 font-mono text-[10px]">
                          <span className="text-slate-600 dark:text-slate-300">
                            {Number(po.allocatedQty).toLocaleString('en-IN')} {formatUOM(activeValuationTooltip.uom)} @ ₹{Number(po.unitPrice).toFixed(2)}
                          </span>
                          <span className="font-bold text-slate-900 dark:text-white">
                            ₹{Number(po.totalWithTax || (po.subtotal + (po.tax || 0))).toLocaleString('en-IN')}
                            {po.tax > 0 && <span className="text-[8.5px] font-normal text-purple-600 dark:text-purple-400 ml-1">(incl ₹{po.tax} tax)</span>}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Card Footer: View Lifecycle Audit Button */}
              <div className="pt-2 mt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    const matId = activeValuationTooltip.matId;
                    setActiveValuationTooltip(null);
                    handleOpenHistory(matId);
                  }}
                  className="w-full py-1 px-2.5 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-semibold flex items-center justify-center gap-1 transition-all shadow-2xs cursor-pointer"
                >
                  <Eye className="w-3 h-3" />
                  <span>View Material Audit Timeline</span>
                </button>
              </div>
            </div>
          </div>
        </>,
        document.body
      )}
    </div>
  );
}
