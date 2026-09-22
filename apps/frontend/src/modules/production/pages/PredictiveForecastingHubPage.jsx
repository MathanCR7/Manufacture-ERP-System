import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '@/lib/axios';
import {
  Sparkles, Calendar as CalendarIcon, TrendingUp, Package, Users, DollarSign,
  Truck, Factory, Sliders, RotateCcw, AlertTriangle, CheckCircle2, Clock,
  ArrowUpRight, ArrowDownRight, RefreshCw, Download, ChevronRight, Filter,
  Layers, ShieldAlert, BarChart3, ChevronLeft, CalendarDays, Search,
  Info, Zap, AlertCircle, Copy, Terminal, Code2, X, Check, FileJson, ExternalLink
} from 'lucide-react';
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, Cell
} from 'recharts';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Pagination } from '@/components/ui/Pagination';
import useCompanyStore from '@/app/store/companyStore';
import OperationsCalendar from '../components/OperationsCalendar';

const COLOR_SERIES = ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#06b6d4', '#8b5cf6'];

export default function PredictiveForecastingHubPage() {
  const companyName = useCompanyStore(s => s.company?.companyName) || 'Manufacturing ERP';

  // State Management
  const [horizonPreset, setHorizonPreset] = useState('30'); // '7', '14', '30', '60', '90', 'custom'
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const { section } = useParams();
  const navigate = useNavigate();

  const routeTabMap = useMemo(() => ({
    calendar: 'calendar',
    stock: 'inventory',
    inventory: 'inventory',
    workforce: 'workforce',
    cashflow: 'cashflow',
    vendor: 'vendor',
    production: 'production',
    'what-if': 'whatif',
    whatif: 'whatif',
    returns: 'returns'
  }), []);

  const tabRouteMap = useMemo(() => ({
    calendar: '/forecasting/calendar',
    inventory: '/forecasting/stock',
    workforce: '/forecasting/workforce',
    cashflow: '/forecasting/cashflow',
    vendor: '/forecasting/vendor',
    production: '/forecasting/production',
    whatif: '/forecasting/what-if',
    returns: '/forecasting/returns'
  }), []);

  const activeTab = (section && routeTabMap[section]) || 'calendar';

  const handleTabChange = (newTabId) => {
    navigate(tabRouteMap[newTabId] || '/forecasting/calendar');
  };

  const [loading, setLoading] = useState(true);
  const [forecastData, setForecastData] = useState(null);

  // Calendar State
  const [selectedCalendarDate, setSelectedCalendarDate] = useState(null);
  const [calendarMonthOffset, setCalendarMonthOffset] = useState(0); // 0 = current month, 1 = next month

  // Filter States
  const [inventorySearch, setInventorySearch] = useState('');
  const [inventoryStatusFilter, setInventoryStatusFilter] = useState('ALL');

  // Table Pagination States
  const [inventoryPage, setInventoryPage] = useState(1);
  const [inventoryPageSize, setInventoryPageSize] = useState(10);

  const [workforcePage, setWorkforcePage] = useState(1);
  const [workforcePageSize, setWorkforcePageSize] = useState(10);

  const [cashflowPage, setCashflowPage] = useState(1);
  const [cashflowPageSize, setCashflowPageSize] = useState(10);

  const [vendorPage, setVendorPage] = useState(1);
  const [vendorPageSize, setVendorPageSize] = useState(10);

  const [productionPage, setProductionPage] = useState(1);
  const [productionPageSize, setProductionPageSize] = useState(10);

  // Predictive Operations AI Engine State
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [aiRunning, setAiRunning] = useState(false);
  const [aiResult, setAiResult] = useState(null);
  const [aiModalTab, setAiModalTab] = useState('highlights'); // 'highlights' | 'json' | 'prompt'
  const [copiedJson, setCopiedJson] = useState(false);
  const [systemPromptText, setSystemPromptText] = useState('');
  const [copiedPrompt, setCopiedPrompt] = useState(false);

  // What-If Interactive Simulator State
  const [whatIfPrice, setWhatIfPrice] = useState(0); // -20% to +20%
  const [whatIfDemand, setWhatIfDemand] = useState(0); // 0% to +100%
  const [whatIfInflation, setWhatIfInflation] = useState(0); // 0% to +50%
  const [simulatingWhatIf, setSimulatingWhatIf] = useState(false);
  const [customSimulationResult, setCustomSimulationResult] = useState(null);

  // Reset inventory page on filter change
  useEffect(() => {
    setInventoryPage(1);
  }, [inventorySearch, inventoryStatusFilter]);

  // Run AI Predict
  const handleRunAiPredict = async () => {
    setAiRunning(true);
    try {
      const res = await api.post('/forecasting/ai-predict', {
        horizonDays: parseInt(horizonPreset, 10) || 30
      });
      if (res.data?.result) {
        setAiResult(res.data.result);
      }
    } catch (err) {
      console.error('Failed to run AI prediction:', err);
    } finally {
      setAiRunning(false);
    }
  };

  const handleFetchPrompt = async () => {
    try {
      const res = await api.get('/forecasting/prompt');
      if (res.data?.prompt) {
        setSystemPromptText(res.data.prompt);
      }
    } catch (err) {
      console.error('Failed to fetch prompt:', err);
    }
  };

  // Fetch forecast data
  const fetchForecast = async () => {
    setLoading(true);
    try {
      const params = {};
      if (activeTab === 'calendar') {
        params.horizonDays = 90; // Ensure multi-month milestone coverage for calendar
      } else if (horizonPreset === 'custom' && customStart && customEnd) {
        params.startDate = customStart;
        params.endDate = customEnd;
      } else {
        params.horizonDays = horizonPreset;
      }
      const res = await api.get('/forecasting/comprehensive', { params });
      setForecastData(res.data);
      if (res.data?.calendarMilestones?.length > 0 && !selectedCalendarDate) {
        setSelectedCalendarDate(res.data.calendarMilestones[0].date);
      }
    } catch (err) {
      console.error('Failed to load comprehensive forecast:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchForecast();
    const interval = setInterval(fetchForecast, 60000); // 100% Live Data auto-refresh
    return () => clearInterval(interval);
  }, [horizonPreset, activeTab]);

  // Run dynamic simulation when sliders change
  const runSimulation = async () => {
    setSimulatingWhatIf(true);
    try {
      const res = await api.post('/forecasting/what-if', {
        priceChangePercent: whatIfPrice,
        demandLiftPercent: whatIfDemand,
        rmInflationPercent: whatIfInflation
      });
      setCustomSimulationResult(res.data?.simulation);
    } catch (err) {
      console.error('Simulation error:', err);
    } finally {
      setSimulatingWhatIf(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      runSimulation();
    }, 250);
    return () => clearTimeout(timer);
  }, [whatIfPrice, whatIfDemand, whatIfInflation]);

  // Filtered inventory list
  const filteredInventory = useMemo(() => {
    if (!forecastData?.inventoryStockForecast) return [];
    return forecastData.inventoryStockForecast.filter(item => {
      const matchesSearch = item.skuName?.toLowerCase().includes(inventorySearch.toLowerCase()) ||
        item.skuCode?.toLowerCase().includes(inventorySearch.toLowerCase());
      const matchesStatus = inventoryStatusFilter === 'ALL' || item.stockStatus === inventoryStatusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [forecastData, inventorySearch, inventoryStatusFilter]);

  // Paginated Slices for all tables
  const paginatedInventory = useMemo(() => {
    const start = (inventoryPage - 1) * inventoryPageSize;
    return filteredInventory.slice(start, start + inventoryPageSize);
  }, [filteredInventory, inventoryPage, inventoryPageSize]);

  const allStageBottlenecks = useMemo(() => {
    return forecastData?.workforceCapacityForecast?.stageBottlenecks || [];
  }, [forecastData]);

  const paginatedStageBottlenecks = useMemo(() => {
    const start = (workforcePage - 1) * workforcePageSize;
    return allStageBottlenecks.slice(start, start + workforcePageSize);
  }, [allStageBottlenecks, workforcePage, workforcePageSize]);

  const allOverdueAccounts = useMemo(() => {
    return forecastData?.cashFlowForecast?.topOverdueOrAtRiskAccounts || [];
  }, [forecastData]);

  const paginatedOverdueAccounts = useMemo(() => {
    const start = (cashflowPage - 1) * cashflowPageSize;
    return allOverdueAccounts.slice(start, start + cashflowPageSize);
  }, [allOverdueAccounts, cashflowPage, cashflowPageSize]);

  const allVendorForecast = useMemo(() => {
    return forecastData?.vendorLeadTimeForecast || [];
  }, [forecastData]);

  const paginatedVendorForecast = useMemo(() => {
    const start = (vendorPage - 1) * vendorPageSize;
    return allVendorForecast.slice(start, start + vendorPageSize);
  }, [allVendorForecast, vendorPage, vendorPageSize]);

  const allComponentSufficiency = useMemo(() => {
    return forecastData?.manufacturingProductionForecast?.componentSufficiency || [];
  }, [forecastData]);

  const paginatedComponentSufficiency = useMemo(() => {
    const start = (productionPage - 1) * productionPageSize;
    return allComponentSufficiency.slice(start, start + productionPageSize);
  }, [allComponentSufficiency, productionPage, productionPageSize]);

  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-slate-950 p-4 md:p-6 lg:p-8 space-y-6 text-slate-800 dark:text-slate-100">
      
      {/* TOP ACTION BAR: HORIZON SELECTOR & AI ENGINE ACTION BUTTON */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button
            onClick={() => {
              setAiModalOpen(true);
              if (!aiResult) handleRunAiPredict();
              if (!systemPromptText) handleFetchPrompt();
            }}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs flex items-center gap-1.5 shadow-sm shadow-indigo-500/20 h-8 px-3 rounded-lg transition-all"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Live Predictive AI Engine & JSON
          </Button>
          <span className="text-[11px] text-slate-400 font-mono hidden sm:inline">
            7-Domain Quantitative Inference Active
          </span>
        </div>

        {activeTab !== 'calendar' && (
          <div className="flex flex-wrap items-center justify-end gap-2.5">
            <div className="inline-flex rounded-lg bg-slate-200/80 dark:bg-slate-800 p-1 border border-slate-300 dark:border-slate-700/60">
              {[
                { label: '7 Days', val: '7' },
                { label: '14 Days', val: '14' },
                { label: '30 Days', val: '30' },
                { label: '60 Days', val: '60' },
                { label: '90 Days', val: '90' },
                { label: 'Custom', val: 'custom' }
              ].map(p => (
                <button
                  key={p.val}
                  onClick={() => setHorizonPreset(p.val)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                    horizonPreset === p.val
                      ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Custom Date Inputs if 'custom' is active */}
            {horizonPreset === 'custom' && (
              <div className="flex items-center gap-2 bg-white dark:bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-xs">
                <input
                  type="date"
                  value={customStart}
                  onChange={e => setCustomStart(e.target.value)}
                  className="bg-transparent text-slate-700 dark:text-slate-300 outline-none"
                />
                <span className="text-slate-400">to</span>
                <input
                  type="date"
                  value={customEnd}
                  onChange={e => setCustomEnd(e.target.value)}
                  className="bg-transparent text-slate-700 dark:text-slate-300 outline-none"
                />
                <Button size="sm" variant="ghost" onClick={fetchForecast} className="h-6 px-2 text-xs">Apply</Button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* DOMAIN-SPECIFIC KPI DATA CARDS (NO CARDS FOR FUTURE CALENDAR) */}
      {activeTab !== 'calendar' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          
          {/* 1. STOCK & REORDER POINTS (INVENTORY) CARDS */}
          {activeTab === 'inventory' && (
            <>
              <Card className="border-slate-200/80 dark:border-slate-800 shadow-sm bg-gradient-to-br from-white to-slate-50/50 dark:from-slate-900 dark:to-slate-950">
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
                    <span>Catalog Monitored</span>
                    <Package className="w-4 h-4 text-indigo-500" />
                  </div>
                  <div className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                    {(forecastData?.inventoryStockForecast || []).length} SKUs
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Active finished products in ERP
                  </div>
                </CardContent>
              </Card>

              <Card className="border-slate-200/80 dark:border-slate-800 shadow-sm bg-gradient-to-br from-white to-slate-50/50 dark:from-slate-900 dark:to-slate-950">
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
                    <span>Imminent Stockouts</span>
                    <AlertTriangle className="w-4 h-4 text-rose-500" />
                  </div>
                  <div className="text-xl font-bold tracking-tight text-rose-600 dark:text-rose-400">
                    {(forecastData?.inventoryStockForecast || []).filter(i => i.stockStatus === 'Stockout Imminent').length} SKUs
                  </div>
                  <div className="text-[11px] text-rose-600 dark:text-rose-400 font-medium flex items-center gap-1">
                    <ShieldAlert className="w-3 h-3" /> Depleting ≤ lead time
                  </div>
                </CardContent>
              </Card>

              <Card className="border-slate-200/80 dark:border-slate-800 shadow-sm bg-gradient-to-br from-white to-slate-50/50 dark:from-slate-900 dark:to-slate-950">
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
                    <span>Below Reorder Point</span>
                    <Layers className="w-4 h-4 text-amber-500" />
                  </div>
                  <div className="text-xl font-bold tracking-tight text-amber-600 dark:text-amber-400">
                    {(forecastData?.inventoryStockForecast || []).filter(i => i.stockStatus === 'Low Stock').length} SKUs
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Reorder trigger point reached
                  </div>
                </CardContent>
              </Card>

              <Card className="border-slate-200/80 dark:border-slate-800 shadow-sm bg-gradient-to-br from-white to-slate-50/50 dark:from-slate-900 dark:to-slate-950">
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
                    <span>Avg Inventory Cover</span>
                    <Clock className="w-4 h-4 text-blue-500" />
                  </div>
                  <div className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                    {(() => {
                      const list = (forecastData?.inventoryStockForecast || []).filter(i => i.dailyVelocity > 0);
                      return list.length > 0 ? (list.reduce((s, i) => s + i.daysOfInventoryRemaining, 0) / list.length).toFixed(1) : '0';
                    })()} Days
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Average remaining stock runway
                  </div>
                </CardContent>
              </Card>

              <Card className="border-slate-200/80 dark:border-slate-800 shadow-sm bg-gradient-to-br from-white to-slate-50/50 dark:from-slate-900 dark:to-slate-950">
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
                    <span>Reorder Units Needed</span>
                    <TrendingUp className="w-4 h-4 text-emerald-500" />
                  </div>
                  <div className="text-xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
                    {(forecastData?.inventoryStockForecast || []).reduce((s, i) => s + Number(i.recommendedReorderQuantity || 0), 0).toLocaleString()} Units
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Calculated safety replenishment
                  </div>
                </CardContent>
              </Card>
            </>
          )}

          {/* 2. WORKFORCE & CAPACITY CARDS */}
          {activeTab === 'workforce' && (
            <>
              <Card className="border-slate-200/80 dark:border-slate-800 shadow-sm bg-gradient-to-br from-white to-slate-50/50 dark:from-slate-900 dark:to-slate-950">
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
                    <span>Projected Workload</span>
                    <Clock className="w-4 h-4 text-indigo-500" />
                  </div>
                  <div className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                    {forecastData?.workforceCapacityForecast?.projectedWorkloadHours || 0}h
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Labor hours for pending orders
                  </div>
                </CardContent>
              </Card>

              <Card className="border-slate-200/80 dark:border-slate-800 shadow-sm bg-gradient-to-br from-white to-slate-50/50 dark:from-slate-900 dark:to-slate-950">
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
                    <span>Available Capacity</span>
                    <Users className="w-4 h-4 text-emerald-500" />
                  </div>
                  <div className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                    {forecastData?.workforceCapacityForecast?.availableStaffHours || 0}h
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Roster capacity over {horizonPreset}d
                  </div>
                </CardContent>
              </Card>

              <Card className="border-slate-200/80 dark:border-slate-800 shadow-sm bg-gradient-to-br from-white to-slate-50/50 dark:from-slate-900 dark:to-slate-950">
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
                    <span>Capacity Utilization</span>
                    <Zap className="w-4 h-4 text-amber-500" />
                  </div>
                  <div className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                    {forecastData?.workforceCapacityForecast?.capacityUtilizationPercent || 0}%
                  </div>
                  <div className="w-full bg-slate-200 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all ${
                        (forecastData?.workforceCapacityForecast?.capacityUtilizationPercent || 0) > 100
                          ? 'bg-rose-500'
                          : (forecastData?.workforceCapacityForecast?.capacityUtilizationPercent || 0) > 85
                          ? 'bg-amber-500'
                          : 'bg-indigo-500'
                      }`}
                      style={{ width: `${Math.min(100, forecastData?.workforceCapacityForecast?.capacityUtilizationPercent || 0)}%` }}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card className="border-slate-200/80 dark:border-slate-800 shadow-sm bg-gradient-to-br from-white to-slate-50/50 dark:from-slate-900 dark:to-slate-950">
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
                    <span>Coverage Status</span>
                    <CheckCircle2 className="w-4 h-4 text-teal-500" />
                  </div>
                  <div className="text-sm font-bold tracking-tight text-slate-900 dark:text-white truncate">
                    {forecastData?.workforceCapacityForecast?.staffShortfallOrSurplus?.text || 'Coverage Sufficient'}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {(forecastData?.workforceCapacityForecast?.capacityUtilizationPercent || 0) > 100 ? 'Overtime / Addl staff needed' : 'Shift coverage balanced'}
                  </div>
                </CardContent>
              </Card>

              <Card className="border-slate-200/80 dark:border-slate-800 shadow-sm bg-gradient-to-br from-white to-slate-50/50 dark:from-slate-900 dark:to-slate-950">
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
                    <span>Stage Bottlenecks</span>
                    <AlertCircle className="w-4 h-4 text-rose-500" />
                  </div>
                  <div className="text-xl font-bold tracking-tight text-rose-600 dark:text-rose-400">
                    {(forecastData?.workforceCapacityForecast?.stageBottlenecks || []).length} Stages
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Stages exceeding 85% capacity
                  </div>
                </CardContent>
              </Card>
            </>
          )}

          {/* 3. CASH FLOW & PAYABLES CARDS */}
          {activeTab === 'cashflow' && (
            <>
              <Card className="border-slate-200/80 dark:border-slate-800 shadow-sm bg-gradient-to-br from-white to-slate-50/50 dark:from-slate-900 dark:to-slate-950">
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
                    <span>Projected Receivables</span>
                    <ArrowUpRight className="w-4 h-4 text-emerald-500" />
                  </div>
                  <div className="text-xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
                    ₹{Number(forecastData?.cashFlowForecast?.projectedInflowsReceivables || 0).toLocaleString('en-IN')}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Customer collections realization
                  </div>
                </CardContent>
              </Card>

              <Card className="border-slate-200/80 dark:border-slate-800 shadow-sm bg-gradient-to-br from-white to-slate-50/50 dark:from-slate-900 dark:to-slate-950">
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
                    <span>Scheduled Payables</span>
                    <ArrowDownRight className="w-4 h-4 text-rose-500" />
                  </div>
                  <div className="text-xl font-bold tracking-tight text-rose-600 dark:text-rose-400">
                    ₹{Number(forecastData?.cashFlowForecast?.projectedOutflowsPayables || 0).toLocaleString('en-IN')}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Supplier PO disbursements due
                  </div>
                </CardContent>
              </Card>

              <Card className="border-slate-200/80 dark:border-slate-800 shadow-sm bg-gradient-to-br from-white to-slate-50/50 dark:from-slate-900 dark:to-slate-950">
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
                    <span>Projected OpEx</span>
                    <DollarSign className="w-4 h-4 text-amber-500" />
                  </div>
                  <div className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                    ₹{Number(forecastData?.cashFlowForecast?.projectedOperatingExpenses || 0).toLocaleString('en-IN')}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Operating expenses ({horizonPreset}d)
                  </div>
                </CardContent>
              </Card>

              <Card className="border-slate-200/80 dark:border-slate-800 shadow-sm bg-gradient-to-br from-white to-slate-50/50 dark:from-slate-900 dark:to-slate-950">
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
                    <span>Net Cash Trajectory</span>
                    <TrendingUp className="w-4 h-4 text-indigo-500" />
                  </div>
                  <div className={`text-xl font-bold tracking-tight ${
                    (forecastData?.cashFlowForecast?.netLiquidityImpact || 0) >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                  }`}>
                    ₹{Number(forecastData?.cashFlowForecast?.netLiquidityImpact || 0).toLocaleString('en-IN')}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {forecastData?.cashFlowForecast?.cashDeficitRisk ? '⚠️ Liquidity Deficit Risk' : '✨ Solvent Liquidity'}
                  </div>
                </CardContent>
              </Card>

              <Card className="border-slate-200/80 dark:border-slate-800 shadow-sm bg-gradient-to-br from-white to-slate-50/50 dark:from-slate-900 dark:to-slate-950">
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
                    <span>At-Risk Accounts</span>
                    <ShieldAlert className="w-4 h-4 text-rose-500" />
                  </div>
                  <div className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                    {(forecastData?.cashFlowForecast?.topOverdueOrAtRiskAccounts || []).length} Accounts
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Customers overdue &gt; 30 days
                  </div>
                </CardContent>
              </Card>
            </>
          )}

          {/* 4. VENDOR & LEAD-TIME CARDS */}
          {activeTab === 'vendor' && (
            <>
              <Card className="border-slate-200/80 dark:border-slate-800 shadow-sm bg-gradient-to-br from-white to-slate-50/50 dark:from-slate-900 dark:to-slate-950">
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
                    <span>Suppliers Monitored</span>
                    <Truck className="w-4 h-4 text-indigo-500" />
                  </div>
                  <div className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                    {(forecastData?.vendorLeadTimeForecast || []).length} Vendors
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Active raw material suppliers
                  </div>
                </CardContent>
              </Card>

              <Card className="border-slate-200/80 dark:border-slate-800 shadow-sm bg-gradient-to-br from-white to-slate-50/50 dark:from-slate-900 dark:to-slate-950">
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
                    <span>On-Time Delivery (OTD)</span>
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  </div>
                  <div className="text-xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
                    {(() => {
                      const list = forecastData?.vendorLeadTimeForecast || [];
                      return list.length > 0 ? (list.reduce((s, v) => s + v.onTimeDeliveryRatePercent, 0) / list.length).toFixed(1) : '0.0';
                    })()}%
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Historical promptness rate
                  </div>
                </CardContent>
              </Card>

              <Card className="border-slate-200/80 dark:border-slate-800 shadow-sm bg-gradient-to-br from-white to-slate-50/50 dark:from-slate-900 dark:to-slate-950">
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
                    <span>Quality Acceptance</span>
                    <CheckCircle2 className="w-4 h-4 text-blue-500" />
                  </div>
                  <div className="text-xl font-bold tracking-tight text-blue-600 dark:text-blue-400">
                    {(() => {
                      const list = forecastData?.vendorLeadTimeForecast || [];
                      return list.length > 0 ? (list.reduce((s, v) => s + v.qualityAcceptanceRatePercent, 0) / list.length).toFixed(1) : '0.0';
                    })()}%
                  </div>
                  <div className="text-[11px] text-slate-500">
                    GRN &amp; lab QA pass rate
                  </div>
                </CardContent>
              </Card>

              <Card className="border-slate-200/80 dark:border-slate-800 shadow-sm bg-gradient-to-br from-white to-slate-50/50 dark:from-slate-900 dark:to-slate-950">
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
                    <span>Lead Time Variance</span>
                    <Clock className="w-4 h-4 text-amber-500" />
                  </div>
                  <div className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                    {(() => {
                      const list = forecastData?.vendorLeadTimeForecast || [];
                      const avg = list.length > 0 ? (list.reduce((s, v) => s + v.leadTimeVarianceDays, 0) / list.length).toFixed(1) : '0.0';
                      return Number(avg) > 0 ? `+${avg}d` : `${avg}d`;
                    })()}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Delivery bias vs promised date
                  </div>
                </CardContent>
              </Card>

              <Card className="border-slate-200/80 dark:border-slate-800 shadow-sm bg-gradient-to-br from-white to-slate-50/50 dark:from-slate-900 dark:to-slate-950">
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
                    <span>High-Risk Suppliers</span>
                    <AlertTriangle className="w-4 h-4 text-rose-500" />
                  </div>
                  <div className="text-xl font-bold tracking-tight text-rose-600 dark:text-rose-400">
                    {(forecastData?.vendorLeadTimeForecast || []).filter(v => v.vendorRiskScore > 0.3).length} Vendors
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Suppliers with VRI index &gt; 0.30
                  </div>
                </CardContent>
              </Card>
            </>
          )}

          {/* 5. PRODUCTION & WIP YIELD CARDS */}
          {activeTab === 'production' && (
            <>
              <Card className="border-slate-200/80 dark:border-slate-800 shadow-sm bg-gradient-to-br from-white to-slate-50/50 dark:from-slate-900 dark:to-slate-950">
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
                    <span>Active WIP Batches</span>
                    <Factory className="w-4 h-4 text-indigo-500" />
                  </div>
                  <div className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                    {forecastData?.manufacturingProductionForecast?.summary?.totalActiveBatches || 0} Batches
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Batches currently in floor production
                  </div>
                </CardContent>
              </Card>

              <Card className="border-slate-200/80 dark:border-slate-800 shadow-sm bg-gradient-to-br from-white to-slate-50/50 dark:from-slate-900 dark:to-slate-950">
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
                    <span>Historical Yield</span>
                    <TrendingUp className="w-4 h-4 text-teal-500" />
                  </div>
                  <div className="text-xl font-bold tracking-tight text-teal-600 dark:text-teal-400">
                    {forecastData?.manufacturingProductionForecast?.summary?.averageYieldPercent || 0}%
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Output efficiency vs planned BOM
                  </div>
                </CardContent>
              </Card>

              <Card className="border-slate-200/80 dark:border-slate-800 shadow-sm bg-gradient-to-br from-white to-slate-50/50 dark:from-slate-900 dark:to-slate-950">
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
                    <span>Avg Cycle Time</span>
                    <Clock className="w-4 h-4 text-blue-500" />
                  </div>
                  <div className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                    {forecastData?.manufacturingProductionForecast?.summary?.averageCycleTimeHours || 0}h
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Floor duration per batch run
                  </div>
                </CardContent>
              </Card>

              <Card className="border-slate-200/80 dark:border-slate-800 shadow-sm bg-gradient-to-br from-white to-slate-50/50 dark:from-slate-900 dark:to-slate-950">
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
                    <span>Component Shortages</span>
                    <AlertTriangle className="w-4 h-4 text-rose-500" />
                  </div>
                  <div className="text-xl font-bold tracking-tight text-rose-600 dark:text-rose-400">
                    {(forecastData?.manufacturingProductionForecast?.componentSufficiency || []).filter(c => c.deficit > 0).length} Materials
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Raw materials with deficit
                  </div>
                </CardContent>
              </Card>

              <Card className="border-slate-200/80 dark:border-slate-800 shadow-sm bg-gradient-to-br from-white to-slate-50/50 dark:from-slate-900 dark:to-slate-950">
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
                    <span>Shortage Procurement Cost</span>
                    <DollarSign className="w-4 h-4 text-amber-500" />
                  </div>
                  <div className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                    ₹{Number((forecastData?.manufacturingProductionForecast?.componentSufficiency || []).reduce((s, c) => s + Number(c.estimatedPurchaseCost || 0), 0)).toLocaleString('en-IN')}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Estimated purchase outlay needed
                  </div>
                </CardContent>
              </Card>
            </>
          )}

          {/* 6. WHAT-IF SCENARIOS CARDS */}
          {activeTab === 'whatif' && (
            <>
              <Card className="border-slate-200/80 dark:border-slate-800 shadow-sm bg-gradient-to-br from-white to-slate-50/50 dark:from-slate-900 dark:to-slate-950">
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
                    <span>Baseline Revenue</span>
                    <DollarSign className="w-4 h-4 text-slate-500" />
                  </div>
                  <div className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                    ₹{Number(forecastData?.whatIfScenarioForecasts?.baselines?.revenue || 0).toLocaleString('en-IN')}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Current actual order volume
                  </div>
                </CardContent>
              </Card>

              <Card className="border-slate-200/80 dark:border-slate-800 shadow-sm bg-gradient-to-br from-white to-slate-50/50 dark:from-slate-900 dark:to-slate-950">
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
                    <span>Simulated Revenue</span>
                    <Sliders className="w-4 h-4 text-indigo-500" />
                  </div>
                  <div className="text-xl font-bold tracking-tight text-indigo-600 dark:text-indigo-400">
                    ₹{Number(customSimulationResult?.simulatedRevenue || forecastData?.whatIfScenarioForecasts?.baselines?.revenue || 0).toLocaleString('en-IN')}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Live adjusted volume &amp; pricing
                  </div>
                </CardContent>
              </Card>

              <Card className="border-slate-200/80 dark:border-slate-800 shadow-sm bg-gradient-to-br from-white to-slate-50/50 dark:from-slate-900 dark:to-slate-950">
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
                    <span>Baseline Gross Margin</span>
                    <BarChart3 className="w-4 h-4 text-slate-500" />
                  </div>
                  <div className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                    {forecastData?.whatIfScenarioForecasts?.baselines?.grossMarginPercent || 0}%
                  </div>
                  <div className="text-[11px] text-slate-500">
                    ₹{Number(forecastData?.whatIfScenarioForecasts?.baselines?.grossProfit || 0).toLocaleString('en-IN')} gross profit
                  </div>
                </CardContent>
              </Card>

              <Card className="border-slate-200/80 dark:border-slate-800 shadow-sm bg-gradient-to-br from-white to-slate-50/50 dark:from-slate-900 dark:to-slate-950">
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
                    <span>Simulated Gross Margin</span>
                    <TrendingUp className="w-4 h-4 text-emerald-500" />
                  </div>
                  <div className="text-xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
                    {customSimulationResult?.grossMarginPercent !== undefined ? customSimulationResult.grossMarginPercent : (forecastData?.whatIfScenarioForecasts?.baselines?.grossMarginPercent || 0)}%
                  </div>
                  <div className="text-[11px] text-slate-500">
                    ₹{Number(customSimulationResult?.grossProfit || forecastData?.whatIfScenarioForecasts?.baselines?.grossProfit || 0).toLocaleString('en-IN')} simulated profit
                  </div>
                </CardContent>
              </Card>

              <Card className="border-slate-200/80 dark:border-slate-800 shadow-sm bg-gradient-to-br from-white to-slate-50/50 dark:from-slate-900 dark:to-slate-950">
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
                    <span>Net Volume Factor</span>
                    <Zap className="w-4 h-4 text-amber-500" />
                  </div>
                  <div className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                    {customSimulationResult?.netVolumeMultiplier || 1.0}x
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Elasticity &amp; demand lift impact
                  </div>
                </CardContent>
              </Card>
            </>
          )}

          {/* 7. RETURNS & REVERSE LOGISTICS CARDS */}
          {activeTab === 'returns' && (
            <>
              <Card className="border-slate-200/80 dark:border-slate-800 shadow-sm bg-gradient-to-br from-white to-slate-50/50 dark:from-slate-900 dark:to-slate-950">
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
                    <span>Sales Return Rate</span>
                    <RotateCcw className="w-4 h-4 text-indigo-500" />
                  </div>
                  <div className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                    {forecastData?.returnsReverseLogisticsForecast?.projectedSalesReturnRatePercent || 0}%
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Customer return frequency
                  </div>
                </CardContent>
              </Card>

              <Card className="border-slate-200/80 dark:border-slate-800 shadow-sm bg-gradient-to-br from-white to-slate-50/50 dark:from-slate-900 dark:to-slate-950">
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
                    <span>Projected Return Units</span>
                    <Package className="w-4 h-4 text-amber-500" />
                  </div>
                  <div className="text-xl font-bold tracking-tight text-amber-600 dark:text-amber-400">
                    {forecastData?.returnsReverseLogisticsForecast?.projectedSalesReturnUnits || 0} Units
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Expected reverse logistics volume
                  </div>
                </CardContent>
              </Card>

              <Card className="border-slate-200/80 dark:border-slate-800 shadow-sm bg-gradient-to-br from-white to-slate-50/50 dark:from-slate-900 dark:to-slate-950">
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
                    <span>Refund Liability</span>
                    <DollarSign className="w-4 h-4 text-rose-500" />
                  </div>
                  <div className="text-xl font-bold tracking-tight text-rose-600 dark:text-rose-400">
                    ₹{Number(forecastData?.returnsReverseLogisticsForecast?.estimatedRefundLiabilityAmount || 0).toLocaleString('en-IN')}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Credit note payout exposure
                  </div>
                </CardContent>
              </Card>

              <Card className="border-slate-200/80 dark:border-slate-800 shadow-sm bg-gradient-to-br from-white to-slate-50/50 dark:from-slate-900 dark:to-slate-950">
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
                    <span>Resaleable Recovery</span>
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  </div>
                  <div className="text-xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
                    {forecastData?.returnsReverseLogisticsForecast?.salvageConditionBreakdown?.resaleablePercent || 0}%
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Salvaged back to active inventory
                  </div>
                </CardContent>
              </Card>

              <Card className="border-slate-200/80 dark:border-slate-800 shadow-sm bg-gradient-to-br from-white to-slate-50/50 dark:from-slate-900 dark:to-slate-950">
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
                    <span>Damaged &amp; Scrap</span>
                    <AlertTriangle className="w-4 h-4 text-slate-500" />
                  </div>
                  <div className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                    {(
                      Number(forecastData?.returnsReverseLogisticsForecast?.salvageConditionBreakdown?.damagedDiscountedPercent || 0) +
                      Number(forecastData?.returnsReverseLogisticsForecast?.salvageConditionBreakdown?.destroyedScrapPercent || 0)
                    ).toFixed(1)}%
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Discounted or destroyed salvage
                  </div>
                </CardContent>
              </Card>
            </>
          )}

        </div>
      )}

      {/* TAB CONTENT AREAS */}
      {loading ? (
        <Card className="p-12 text-center border-dashed border-2 border-slate-200 dark:border-slate-800">
          <RefreshCw className="w-8 h-8 animate-spin text-indigo-500 mx-auto mb-3" />
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">Running Quantitative Predictive Engine...</p>
          <p className="text-xs text-slate-500">Calculating safety stock, capacity, lead times, cash flow curves, and what-if baselines...</p>
        </Card>
      ) : (
        <>
          {/* TAB 0: FUTURE CALENDAR & MILESTONES TIMELINE */}
          {activeTab === 'calendar' && (
            <OperationsCalendar operationalMilestones={forecastData?.calendarMilestones || []} />
          )}

          {/* TAB 1: INVENTORY & STOCK FORECASTING */}
          {activeTab === 'inventory' && (
            <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                  <h2 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
                    <Package className="w-5 h-5 text-indigo-500" />
                    Finished Good Stock & Reorder Points (ROP)
                  </h2>
                </div>

                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search SKU or name..."
                      value={inventorySearch}
                      onChange={e => setInventorySearch(e.target.value)}
                      className="pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>

                  <select
                    value={inventoryStatusFilter}
                    onChange={e => setInventoryStatusFilter(e.target.value)}
                    className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 dark:text-slate-300 outline-none"
                  >
                    <option value="ALL">All Statuses</option>
                    <option value="Stockout Imminent">Stockout Imminent</option>
                    <option value="Low Stock">Low Stock</option>
                    <option value="Balanced">Balanced</option>
                    <option value="Overstocked">Overstocked</option>
                  </select>
                </div>
              </div>

              <CardContent className="p-0 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-900/60 text-slate-500 border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="py-3 px-4 font-semibold">SKU / Product</th>
                      <th className="py-3 px-4 font-semibold">Category</th>
                      <th className="py-3 px-4 font-semibold text-right">Current Stock</th>
                      <th className="py-3 px-4 font-semibold text-right">Daily Velocity</th>
                      <th className="py-3 px-4 font-semibold text-right">Safety Stock (SS)</th>
                      <th className="py-3 px-4 font-semibold text-right">Reorder Point (ROP)</th>
                      <th className="py-3 px-4 font-semibold text-right">Days Left</th>
                      <th className="py-3 px-4 font-semibold">Health Status</th>
                      <th className="py-3 px-4 font-semibold text-right">Recommended Reorder</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                    {paginatedInventory.map(item => (
                      <tr key={item.productId} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/40">
                        <td className="py-3 px-4 font-medium text-slate-900 dark:text-white">
                          <div>{item.skuName}</div>
                          <span className="text-[10px] text-slate-400 font-mono">{item.skuCode}</span>
                        </td>
                        <td className="py-3 px-4 text-slate-500">{item.categoryName}</td>
                        <td className="py-3 px-4 text-right font-bold text-slate-800 dark:text-slate-200">
                          {item.currentStock} {item.unit}
                        </td>
                        <td className="py-3 px-4 text-right text-slate-600 dark:text-slate-300 font-mono">
                          {item.dailyVelocity} / day
                        </td>
                        <td className="py-3 px-4 text-right text-slate-600 dark:text-slate-300">
                          {item.safetyStockRecommended} {item.unit}
                        </td>
                        <td className="py-3 px-4 text-right text-indigo-600 dark:text-indigo-400 font-semibold">
                          {item.reorderPointCalculated} {item.unit}
                        </td>
                        <td className="py-3 px-4 text-right font-medium">
                          {item.daysOfInventoryRemaining >= 999 ? '∞' : `${item.daysOfInventoryRemaining}d`}
                        </td>
                        <td className="py-3 px-4">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold ${
                            item.stockStatus === 'Stockout Imminent'
                              ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                              : item.stockStatus === 'Low Stock'
                              ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                              : item.stockStatus === 'Overstocked'
                              ? 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300'
                              : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                          }`}>
                            {item.stockStatus}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-slate-900 dark:text-white">
                          {item.recommendedReorderQuantity > 0 ? `${item.recommendedReorderQuantity} ${item.unit}` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
              <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30">
                <Pagination
                  currentPage={inventoryPage}
                  totalPages={Math.max(1, Math.ceil(filteredInventory.length / inventoryPageSize))}
                  totalRecords={filteredInventory.length}
                  pageSize={inventoryPageSize}
                  onPageChange={setInventoryPage}
                  onPageSizeChange={(newSize) => {
                    setInventoryPageSize(newSize);
                    setInventoryPage(1);
                  }}
                />
              </div>
            </Card>
          )}

          {/* TAB 2: WORKFORCE & CAPACITY FORECASTING */}
          {activeTab === 'workforce' && (
            <div className="space-y-6">
              {/* Top Overview Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {forecastData?.workforceCapacityForecast?.recommendedShiftCoverage?.map((cov, idx) => (
                  <Card key={idx} className="border-slate-200 dark:border-slate-800 shadow-sm p-4 space-y-2">
                    <div className="flex items-center justify-between text-xs text-slate-500 font-semibold uppercase">
                      <span>{cov.role.replace('_', ' ')}</span>
                      <Users className="w-4 h-4 text-indigo-500" />
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-bold text-slate-900 dark:text-white">{cov.requiredHeadcount}</span>
                      <span className="text-xs text-slate-400">staff needed (Current: {cov.currentHeadcount})</span>
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {cov.requiredHeadcount > cov.currentHeadcount ? (
                        <span className="text-rose-600 font-medium">Shortfall: +{cov.requiredHeadcount - cov.currentHeadcount} headcount required</span>
                      ) : (
                        <span className="text-emerald-600 font-medium">Coverage is sufficient</span>
                      )}
                    </div>
                  </Card>
                ))}
              </div>

              {/* Stage Bottleneck Analysis */}
              <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="p-4 border-b border-slate-200 dark:border-slate-800">
                  <h3 className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2">
                    <Zap className="w-4 h-4 text-amber-500" />
                    Stage Bottleneck & Machine Workload Queue
                  </h3>
                </div>
                <CardContent className="p-0 overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-900/60 text-slate-500 border-b border-slate-200 dark:border-slate-800">
                      <tr>
                        <th className="py-3 px-4 font-semibold">Production Stage</th>
                        <th className="py-3 px-4 font-semibold text-right">Standard Time per Unit</th>
                        <th className="py-3 px-4 font-semibold text-right">Total Workload Queue</th>
                        <th className="py-3 px-4 font-semibold text-right">Orders Queued</th>
                        <th className="py-3 px-4 font-semibold">Bottleneck Risk</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                      {paginatedStageBottlenecks.map((st, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/40">
                          <td className="py-3 px-4 font-bold text-slate-800 dark:text-slate-200">{st.stageName}</td>
                          <td className="py-3 px-4 text-right text-slate-600 dark:text-slate-300">{st.standardHours} hrs</td>
                          <td className="py-3 px-4 text-right font-bold text-slate-900 dark:text-white">{st.projectedHours} hrs</td>
                          <td className="py-3 px-4 text-right text-slate-500">{st.orderCount} batches</td>
                          <td className="py-3 px-4">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                              st.riskLevel === 'HIGH'
                                ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                                : st.riskLevel === 'MEDIUM'
                                ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                                : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                            }`}>
                              {st.riskLevel} CONGESTION
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
                <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30">
                  <Pagination
                    currentPage={workforcePage}
                    totalPages={Math.max(1, Math.ceil(allStageBottlenecks.length / workforcePageSize))}
                    totalRecords={allStageBottlenecks.length}
                    pageSize={workforcePageSize}
                    onPageChange={setWorkforcePage}
                    onPageSizeChange={(newSize) => {
                      setWorkforcePageSize(newSize);
                      setWorkforcePage(1);
                    }}
                  />
                </div>
              </Card>
            </div>
          )}

          {/* TAB 3: CASH FLOW & PAYABLES FORECASTING */}
          {activeTab === 'cashflow' && (
            <div className="space-y-6">
              {/* Chart Card: Weekly Inflows vs Outflows */}
              <Card className="border-slate-200 dark:border-slate-800 shadow-sm p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-emerald-500" />
                      Weekly Net Liquidity & Cash Flow Trajectory
                    </h3>
                  </div>
                </div>

                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={forecastData?.cashFlowForecast?.weeklyBreakdown || []}>
                      <defs>
                        <linearGradient id="inflowGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                        </linearGradient>
                        <linearGradient id="payablesGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#ef4444" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="#ef4444" stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                      <XAxis dataKey="week" stroke="#888888" fontSize={11} />
                      <YAxis stroke="#888888" fontSize={11} />
                      <RechartsTooltip formatter={(val) => `₹${Number(val).toLocaleString('en-IN')}`} />
                      <Legend />
                      <Area type="monotone" dataKey="expectedInflows" name="Expected Collections (₹)" stroke="#10b981" fillOpacity={1} fill="url(#inflowGrad)" />
                      <Area type="monotone" dataKey="expectedPayables" name="Supplier Payables (₹)" stroke="#ef4444" fillOpacity={1} fill="url(#payablesGrad)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              {/* Overdue Accounts Table */}
              <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="p-4 border-b border-slate-200 dark:border-slate-800">
                  <h3 className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-500" />
                    At-Risk & Overdue Accounts (Liquidity Discount Applied)
                  </h3>
                </div>
                <CardContent className="p-0 overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-900/60 text-slate-500 border-b border-slate-200 dark:border-slate-800">
                      <tr>
                        <th className="py-3 px-4 font-semibold">Account / Party</th>
                        <th className="py-3 px-4 font-semibold">Reference</th>
                        <th className="py-3 px-4 font-semibold text-right">Balance Due</th>
                        <th className="py-3 px-4 font-semibold text-right">Days Past Due</th>
                        <th className="py-3 px-4 font-semibold">Risk Rating</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                      {allOverdueAccounts.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-6 text-center text-slate-400">
                            No overdue or high-risk collection accounts identified.
                          </td>
                        </tr>
                      ) : (
                        paginatedOverdueAccounts.map((acc, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/40">
                            <td className="py-3 px-4 font-bold text-slate-800 dark:text-slate-200">{acc.partyName}</td>
                            <td className="py-3 px-4 font-mono text-slate-500">{acc.referenceNo}</td>
                            <td className="py-3 px-4 text-right font-bold text-rose-600">₹{Number(acc.balance).toLocaleString('en-IN')}</td>
                            <td className="py-3 px-4 text-right text-slate-600 dark:text-slate-300">{acc.dueDays} days</td>
                            <td className="py-3 px-4">
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300">
                                {acc.riskStatus}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </CardContent>
                {allOverdueAccounts.length > 0 && (
                  <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30">
                    <Pagination
                      currentPage={cashflowPage}
                      totalPages={Math.max(1, Math.ceil(allOverdueAccounts.length / cashflowPageSize))}
                      totalRecords={allOverdueAccounts.length}
                      pageSize={cashflowPageSize}
                      onPageChange={setCashflowPage}
                      onPageSizeChange={(newSize) => {
                        setCashflowPageSize(newSize);
                        setCashflowPage(1);
                      }}
                    />
                  </div>
                )}
              </Card>
            </div>
          )}

          {/* TAB 4: VENDOR LEAD-TIME FORECASTING */}
          {activeTab === 'vendor' && (
            <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="p-4 border-b border-slate-200 dark:border-slate-800">
                <h3 className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2">
                  <Truck className="w-4 h-4 text-blue-500" />
                  Supplier Reliability & Lead Time Bias Scorecard
                </h3>
              </div>

              <CardContent className="p-0 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-900/60 text-slate-500 border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="py-3 px-4 font-semibold">Supplier Name</th>
                      <th className="py-3 px-4 font-semibold text-right">POs Tracked</th>
                      <th className="py-3 px-4 font-semibold text-right">Promised Lead Time</th>
                      <th className="py-3 px-4 font-semibold text-right">Actual Lead Time</th>
                      <th className="py-3 px-4 font-semibold text-right">Lead Time Variance</th>
                      <th className="py-3 px-4 font-semibold text-right">On-Time Delivery (OTD)</th>
                      <th className="py-3 px-4 font-semibold text-right">Quality Pass (QAR)</th>
                      <th className="py-3 px-4 font-semibold text-right">Recommended Buffer</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                    {paginatedVendorForecast.map((v, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/40">
                        <td className="py-3 px-4 font-bold text-slate-800 dark:text-slate-200">{v.supplierName}</td>
                        <td className="py-3 px-4 text-right text-slate-500">{v.totalPOsTracked}</td>
                        <td className="py-3 px-4 text-right text-slate-600 dark:text-slate-300">{v.promisedAvgLeadTimeDays} days</td>
                        <td className="py-3 px-4 text-right font-bold text-slate-900 dark:text-white">{v.historicalAvgLeadTimeDays} days</td>
                        <td className="py-3 px-4 text-right">
                          <span className={`font-semibold ${v.leadTimeVarianceDays > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                            {v.leadTimeVarianceDays > 0 ? `+${v.leadTimeVarianceDays}d delay` : `${v.leadTimeVarianceDays}d early`}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-slate-900 dark:text-white">
                          {v.onTimeDeliveryRatePercent}%
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-teal-600 dark:text-teal-400">
                          {v.qualityAcceptanceRatePercent}%
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-indigo-600 dark:text-indigo-400">
                          +{v.recommendedLeadTimeBufferDays} days buffer
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
              <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30">
                <Pagination
                  currentPage={vendorPage}
                  totalPages={Math.max(1, Math.ceil(allVendorForecast.length / vendorPageSize))}
                  totalRecords={allVendorForecast.length}
                  pageSize={vendorPageSize}
                  onPageChange={setVendorPage}
                  onPageSizeChange={(newSize) => {
                    setVendorPageSize(newSize);
                    setVendorPage(1);
                  }}
                />
              </div>
            </Card>
          )}

          {/* TAB 5: MANUFACTURING & BOM COMPONENT SUFFICIENCY */}
          {activeTab === 'production' && (
            <div className="space-y-6">
              {/* Component Sufficiency Table */}
              <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="p-4 border-b border-slate-200 dark:border-slate-800">
                  <h3 className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2">
                    <Factory className="w-4 h-4 text-teal-500" />
                    Bill of Materials (BOM) Raw Material Shortage & Sufficiency Matrix
                  </h3>
                </div>
                <CardContent className="p-0 overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-900/60 text-slate-500 border-b border-slate-200 dark:border-slate-800">
                      <tr>
                        <th className="py-3 px-4 font-semibold">Raw Material</th>
                        <th className="py-3 px-4 font-semibold text-right">Stock On Hand</th>
                        <th className="py-3 px-4 font-semibold text-right">Required for Orders</th>
                        <th className="py-3 px-4 font-semibold text-right">Shortage / Deficit</th>
                        <th className="py-3 px-4 font-semibold">Sufficiency Status</th>
                        <th className="py-3 px-4 font-semibold text-right">Estimated PO Value</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                      {paginatedComponentSufficiency.map(rm => (
                        <tr key={rm.rawMaterialId} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/40">
                          <td className="py-3 px-4 font-medium text-slate-900 dark:text-white">
                            <div>{rm.rawMaterialName}</div>
                            <span className="text-[10px] text-slate-400 font-mono">{rm.code}</span>
                          </td>
                          <td className="py-3 px-4 text-right font-bold text-slate-800 dark:text-slate-200">
                            {rm.currentStock} {rm.unit}
                          </td>
                          <td className="py-3 px-4 text-right text-slate-600 dark:text-slate-300">
                            {rm.requiredForBatch} {rm.unit}
                          </td>
                          <td className="py-3 px-4 text-right font-bold text-rose-600">
                            {rm.deficit > 0 ? `${rm.deficit} ${rm.unit}` : '0'}
                          </td>
                          <td className="py-3 px-4">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                              rm.sufficiency === 'Shortage'
                                ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                                : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                            }`}>
                              {rm.sufficiency}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right font-semibold text-slate-900 dark:text-white">
                            {rm.estimatedPurchaseCost > 0 ? `₹${rm.estimatedPurchaseCost.toLocaleString('en-IN')}` : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
                <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30">
                  <Pagination
                    currentPage={productionPage}
                    totalPages={Math.max(1, Math.ceil(allComponentSufficiency.length / productionPageSize))}
                    totalRecords={allComponentSufficiency.length}
                    pageSize={productionPageSize}
                    onPageChange={setProductionPage}
                    onPageSizeChange={(newSize) => {
                      setProductionPageSize(newSize);
                      setProductionPage(1);
                    }}
                  />
                </div>
              </Card>
            </div>
          )}

          {/* TAB 6: WHAT-IF SENSITIVITY SANDBOX */}
          {activeTab === 'whatif' && (
            <div className="space-y-6">
              {/* Interactive Simulator Sliders */}
              <Card className="border-slate-200 dark:border-slate-800 shadow-sm p-6 bg-gradient-to-br from-indigo-50/40 to-slate-50/40 dark:from-slate-900/90 dark:to-slate-950 space-y-6">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Sliders className="w-5 h-5 text-indigo-600" />
                    Interactive "What-If" Sensitivity Simulator
                  </h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Slider 1: Price Variation */}
                  <div className="space-y-2 p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="text-slate-700 dark:text-slate-300">Selling Price Adjustment</span>
                      <span className="text-indigo-600 font-bold">{whatIfPrice > 0 ? `+${whatIfPrice}%` : `${whatIfPrice}%`}</span>
                    </div>
                    <input
                      type="range"
                      min="-20"
                      max="20"
                      step="1"
                      value={whatIfPrice}
                      onChange={e => setWhatIfPrice(Number(e.target.value))}
                      className="w-full accent-indigo-600 cursor-pointer"
                    />
                    <p className="text-[11px] text-slate-400">Models demand response via -1.2 price elasticity.</p>
                  </div>

                  {/* Slider 2: Demand Lift */}
                  <div className="space-y-2 p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="text-slate-700 dark:text-slate-300">Campaign / Demand Surge</span>
                      <span className="text-emerald-600 font-bold">+{whatIfDemand}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="5"
                      value={whatIfDemand}
                      onChange={e => setWhatIfDemand(Number(e.target.value))}
                      className="w-full accent-emerald-600 cursor-pointer"
                    />
                    <p className="text-[11px] text-slate-400">Marketing campaign & seasonal volume expansion.</p>
                  </div>

                  {/* Slider 3: RM Inflation */}
                  <div className="space-y-2 p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="text-slate-700 dark:text-slate-300">Raw Material Inflation</span>
                      <span className="text-rose-600 font-bold">+{whatIfInflation}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="50"
                      step="5"
                      value={whatIfInflation}
                      onChange={e => setWhatIfInflation(Number(e.target.value))}
                      className="w-full accent-rose-600 cursor-pointer"
                    />
                    <p className="text-[11px] text-slate-400">Input material supply cost shock impact on COGS.</p>
                  </div>
                </div>

                {/* Simulation Output Cards */}
                {customSimulationResult && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t border-slate-200 dark:border-slate-800">
                    <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1">
                      <span className="text-xs text-slate-400 font-medium">Simulated Gross Revenue</span>
                      <div className="text-lg font-bold text-slate-900 dark:text-white">
                        ₹{Number(customSimulationResult.simulatedRevenue).toLocaleString('en-IN')}
                      </div>
                    </div>

                    <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1">
                      <span className="text-xs text-slate-400 font-medium">Simulated Production Cost</span>
                      <div className="text-lg font-bold text-slate-900 dark:text-white">
                        ₹{Number(customSimulationResult.simulatedCost).toLocaleString('en-IN')}
                      </div>
                    </div>

                    <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1">
                      <span className="text-xs text-slate-400 font-medium">Simulated Gross Profit</span>
                      <div className={`text-lg font-bold ${customSimulationResult.grossProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        ₹{Number(customSimulationResult.grossProfit).toLocaleString('en-IN')}
                      </div>
                    </div>

                    <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1">
                      <span className="text-xs text-slate-400 font-medium">Simulated Gross Margin</span>
                      <div className="text-lg font-bold text-indigo-600 dark:text-indigo-400">
                        {customSimulationResult.grossMarginPercent}%
                      </div>
                    </div>
                  </div>
                )}
              </Card>

              {/* Pre-packaged Scenario Models */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {forecastData?.whatIfScenarioForecasts?.scenarios?.map((sc, idx) => (
                  <Card key={idx} className="border-slate-200 dark:border-slate-800 shadow-sm p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">{sc.scenarioName}</span>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800">
                        {sc.parametersChanged.variationPercent}
                      </span>
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-500">Projected Revenue:</span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">₹{sc.projectedRevenue.toLocaleString('en-IN')}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-500">Gross Margin Shift:</span>
                        <span className={`font-semibold ${sc.projectedGrossMarginImpactPercent >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {sc.projectedGrossMarginImpactPercent >= 0 ? `+${sc.projectedGrossMarginImpactPercent}%` : `${sc.projectedGrossMarginImpactPercent}%`}
                        </span>
                      </div>
                    </div>
                    <p className="text-[11px] text-slate-500 pt-2 border-t border-slate-100 dark:border-slate-800 leading-relaxed">
                      💡 {sc.recommendation}
                    </p>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* TAB 7: RETURNS & REVERSE LOGISTICS FORECASTING */}
          {activeTab === 'returns' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="border-slate-200 dark:border-slate-800 shadow-sm p-6 space-y-4">
                <h3 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
                  <RotateCcw className="w-5 h-5 text-indigo-500" />
                  Customer Finished Goods Returns Projection
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                    <span className="text-xs text-slate-400">Projected Sales Return Rate</span>
                    <div className="text-xl font-bold text-slate-900 dark:text-white mt-1">
                      {forecastData?.returnsReverseLogisticsForecast?.projectedSalesReturnRatePercent}%
                    </div>
                  </div>
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                    <span className="text-xs text-slate-400">Estimated Refund Liability</span>
                    <div className="text-xl font-bold text-rose-600 mt-1">
                      ₹{forecastData?.returnsReverseLogisticsForecast?.estimatedRefundLiabilityAmount?.toLocaleString('en-IN')}
                    </div>
                  </div>
                </div>

                <div className="space-y-2 pt-2">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Salvage Condition Breakdown:</span>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between text-slate-600 dark:text-slate-400">
                      <span>Resaleable Units (Repackaged):</span>
                      <span className="font-bold text-emerald-600">{forecastData?.returnsReverseLogisticsForecast?.salvageConditionBreakdown?.resaleablePercent}%</span>
                    </div>
                    <div className="flex justify-between text-slate-600 dark:text-slate-400">
                      <span>Damaged / Discount Channel:</span>
                      <span className="font-bold text-amber-600">{forecastData?.returnsReverseLogisticsForecast?.salvageConditionBreakdown?.damagedDiscountedPercent}%</span>
                    </div>
                    <div className="flex justify-between text-slate-600 dark:text-slate-400">
                      <span>Destroyed Scrap:</span>
                      <span className="font-bold text-rose-600">{forecastData?.returnsReverseLogisticsForecast?.salvageConditionBreakdown?.destroyedScrapPercent}%</span>
                    </div>
                  </div>
                </div>
              </Card>

              <Card className="border-slate-200 dark:border-slate-800 shadow-sm p-6 space-y-4">
                <h3 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5 text-amber-500" />
                  Vendor Quality Rejections & Primary Drivers
                </h3>
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                  <span className="text-xs text-slate-400">Vendor Purchase Rejection Rate</span>
                  <div className="text-xl font-bold text-amber-600 mt-1">
                    {forecastData?.returnsReverseLogisticsForecast?.projectedPurchaseReturnRatePercent}%
                  </div>
                </div>

                <div className="space-y-2">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Primary Root-Cause Drivers:</span>
                  <ul className="space-y-2 text-xs text-slate-600 dark:text-slate-400">
                    {forecastData?.returnsReverseLogisticsForecast?.primaryRejectionDrivers?.map((driver, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-indigo-500 font-bold">•</span>
                        <span>{driver}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </Card>
            </div>
          )}
        </>
      )}

      {/* PREDICTIVE AI ENGINE & JSON SCHEMA INSPECTOR MODAL */}
      {aiModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-5xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-indigo-600 text-white shadow-md shadow-indigo-500/20">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    Chief Quantitative Operations Analyst & Predictive AI Engine
                    {aiResult?.source && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                        {aiResult.source === 'AI_LLM_INFERENCE' ? '✨ LLM Inference' : '⚡ Deterministic Engine'}
                      </span>
                    )}
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Live ERP PostgreSQL Data Ingestion • Strict 7-Domain Schema Adherence
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleRunAiPredict}
                  disabled={aiRunning}
                  className="h-8 text-xs font-semibold"
                >
                  <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${aiRunning ? 'animate-spin' : ''}`} />
                  {aiRunning ? 'Computing...' : 'Re-Run Live'}
                </Button>
                <button
                  onClick={() => setAiModalOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Subheader & Tab Switcher */}
            <div className="flex flex-wrap items-center justify-between px-5 py-2.5 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setAiModalTab('highlights')}
                  className={`px-3 py-1.5 font-semibold rounded-lg transition-all ${
                    aiModalTab === 'highlights'
                      ? 'bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  📊 7-Domain Highlights
                </button>
                <button
                  onClick={() => setAiModalTab('json')}
                  className={`px-3 py-1.5 font-semibold rounded-lg transition-all flex items-center gap-1.5 ${
                    aiModalTab === 'json'
                      ? 'bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <FileJson className="w-3.5 h-3.5" />
                  Required Output JSON Schema
                </button>
                <button
                  onClick={() => {
                    setAiModalTab('prompt');
                    if (!systemPromptText) handleFetchPrompt();
                  }}
                  className={`px-3 py-1.5 font-semibold rounded-lg transition-all flex items-center gap-1.5 ${
                    aiModalTab === 'prompt'
                      ? 'bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Code2 className="w-3.5 h-3.5" />
                  System Prompt & Mathematical Foundations
                </button>
              </div>

              {aiResult?.data?.forecastHorizon && (
                <div className="text-[11px] text-slate-400 font-mono hidden md:flex items-center gap-2">
                  <span>Horizon: {aiResult.data.forecastHorizon.horizonDays}d</span>
                  <span>•</span>
                  <span>Model: {aiResult.model || 'deterministic-mrp-formulas'}</span>
                </div>
              )}
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {aiRunning && (
                <div className="py-12 flex flex-col items-center justify-center space-y-3">
                  <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin" />
                  <div className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                    Ingesting Live PostgreSQL Database Tables...
                  </div>
                  <div className="text-xs text-slate-400">
                    Running Little's Law, Safety Stock Z-Scores, Demand Velocity & Cash Aging Realization
                  </div>
                </div>
              )}

              {!aiRunning && aiModalTab === 'highlights' && aiResult?.data && (
                <div className="space-y-4">
                  {/* Actionable Warnings Card */}
                  <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 space-y-2">
                    <div className="flex items-center gap-2 font-bold text-amber-800 dark:text-amber-200 text-xs uppercase tracking-wider">
                      <AlertTriangle className="w-4 h-4 text-amber-600" />
                      Executive Actionable Operational Warnings
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                      <div className="p-2.5 bg-white/80 dark:bg-slate-900/80 rounded-lg">
                        <div className="text-slate-500 font-medium">Imminent Stockouts</div>
                        <div className="text-lg font-bold text-rose-600">
                          {aiResult.data.inventoryStockForecast?.filter(i => i.stockStatus === 'Stockout Imminent').length || 0} SKUs
                        </div>
                      </div>
                      <div className="p-2.5 bg-white/80 dark:bg-slate-900/80 rounded-lg">
                        <div className="text-slate-500 font-medium">Liquidity Deficit Risk</div>
                        <div className={`text-lg font-bold ${aiResult.data.cashFlowForecast?.cashDeficitRisk ? 'text-rose-600' : 'text-emerald-600'}`}>
                          {aiResult.data.cashFlowForecast?.cashDeficitRisk ? 'DEFICIT RISK' : 'HEALTHY SURPLUS'}
                        </div>
                      </div>
                      <div className="p-2.5 bg-white/80 dark:bg-slate-900/80 rounded-lg">
                        <div className="text-slate-500 font-medium">Capacity Utilization</div>
                        <div className="text-lg font-bold text-indigo-600">
                          {aiResult.data.workforceCapacityForecast?.capacityUtilizationPercent}%
                        </div>
                      </div>
                      <div className="p-2.5 bg-white/80 dark:bg-slate-900/80 rounded-lg">
                        <div className="text-slate-500 font-medium">Sales Return Rate</div>
                        <div className="text-lg font-bold text-slate-800 dark:text-slate-200">
                          {aiResult.data.returnsReverseLogisticsForecast?.projectedSalesReturnRatePercent}%
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 7 Domains Overview Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Domain 1 */}
                    <Card className="p-4 space-y-2 border-slate-200 dark:border-slate-800">
                      <div className="flex items-center justify-between text-xs font-bold text-slate-900 dark:text-white">
                        <span className="flex items-center gap-1.5"><Package className="w-4 h-4 text-indigo-500" /> 1. Inventory & Stock Forecasting</span>
                        <span className="text-[11px] text-slate-400 font-normal">{aiResult.data.inventoryStockForecast?.length} SKUs</span>
                      </div>
                      <p className="text-xs text-slate-500">
                        Top recommended reorder: {aiResult.data.inventoryStockForecast?.[0]?.skuName || 'N/A'} (Reorder: {aiResult.data.inventoryStockForecast?.[0]?.recommendedReorderQuantity || 0} units, ROP: {aiResult.data.inventoryStockForecast?.[0]?.reorderPointCalculated})
                      </p>
                    </Card>

                    {/* Domain 2 */}
                    <Card className="p-4 space-y-2 border-slate-200 dark:border-slate-800">
                      <div className="flex items-center justify-between text-xs font-bold text-slate-900 dark:text-white">
                        <span className="flex items-center gap-1.5"><Users className="w-4 h-4 text-emerald-500" /> 2. Workforce & Capacity</span>
                        <span className="text-[11px] text-emerald-600 font-medium">{aiResult.data.workforceCapacityForecast?.capacityUtilizationPercent}% Utilized</span>
                      </div>
                      <p className="text-xs text-slate-500">
                        Workload: {aiResult.data.workforceCapacityForecast?.projectedWorkloadHours}h vs Available: {aiResult.data.workforceCapacityForecast?.availableStaffHours}h. Staff shortfall/surplus: {aiResult.data.workforceCapacityForecast?.staffShortfallOrSurplus}h.
                      </p>
                    </Card>

                    {/* Domain 3 */}
                    <Card className="p-4 space-y-2 border-slate-200 dark:border-slate-800">
                      <div className="flex items-center justify-between text-xs font-bold text-slate-900 dark:text-white">
                        <span className="flex items-center gap-1.5"><DollarSign className="w-4 h-4 text-amber-500" /> 3. Cash Flow / Payables & Receivables</span>
                        <span className={`text-[11px] font-bold ${aiResult.data.cashFlowForecast?.netLiquidityImpact >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                          ₹{Number(aiResult.data.cashFlowForecast?.netLiquidityImpact || 0).toLocaleString('en-IN')}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500">
                        Receivables Inflows: ₹{Number(aiResult.data.cashFlowForecast?.projectedInflowsReceivables || 0).toLocaleString('en-IN')} • Payables: ₹{Number(aiResult.data.cashFlowForecast?.projectedOutflowsPayables || 0).toLocaleString('en-IN')} • OpEx: ₹{Number(aiResult.data.cashFlowForecast?.projectedOperatingExpenses || 0).toLocaleString('en-IN')}.
                      </p>
                    </Card>

                    {/* Domain 4 */}
                    <Card className="p-4 space-y-2 border-slate-200 dark:border-slate-800">
                      <div className="flex items-center justify-between text-xs font-bold text-slate-900 dark:text-white">
                        <span className="flex items-center gap-1.5"><Truck className="w-4 h-4 text-blue-500" /> 4. Vendor & Lead-Time Bias</span>
                        <span className="text-[11px] text-blue-600 font-medium">{aiResult.data.vendorLeadTimeForecast?.length} Suppliers</span>
                      </div>
                      <p className="text-xs text-slate-500">
                        Average OTD rate: {(aiResult.data.vendorLeadTimeForecast?.reduce((s, v) => s + v.onTimeDeliveryRatePercent, 0) / Math.max(1, aiResult.data.vendorLeadTimeForecast?.length || 1)).toFixed(1)}% • Quality pass: {(aiResult.data.vendorLeadTimeForecast?.reduce((s, v) => s + v.qualityAcceptanceRatePercent, 0) / Math.max(1, aiResult.data.vendorLeadTimeForecast?.length || 1)).toFixed(1)}%.
                      </p>
                    </Card>

                    {/* Domain 5 */}
                    <Card className="p-4 space-y-2 border-slate-200 dark:border-slate-800">
                      <div className="flex items-center justify-between text-xs font-bold text-slate-900 dark:text-white">
                        <span className="flex items-center gap-1.5"><Factory className="w-4 h-4 text-teal-500" /> 5. Manufacturing & WIP Yield</span>
                        <span className="text-[11px] text-teal-600 font-medium">Yield: {aiResult.data.manufacturingProductionForecast?.[0]?.projectedYieldPercent || 98.2}%</span>
                      </div>
                      <p className="text-xs text-slate-500">
                        Monitored batches: {aiResult.data.manufacturingProductionForecast?.length || 0} products. High risk components exploded from BOM.
                      </p>
                    </Card>

                    {/* Domain 6 */}
                    <Card className="p-4 space-y-2 border-slate-200 dark:border-slate-800">
                      <div className="flex items-center justify-between text-xs font-bold text-slate-900 dark:text-white">
                        <span className="flex items-center gap-1.5"><Sliders className="w-4 h-4 text-purple-500" /> 6. Scenario / What-If Sensitivity</span>
                        <span className="text-[11px] text-purple-600 font-medium">{aiResult.data.whatIfScenarioForecasts?.length} Scenarios</span>
                      </div>
                      <p className="text-xs text-slate-500">
                        {aiResult.data.whatIfScenarioForecasts?.[0]?.scenarioName}: Margin impact {aiResult.data.whatIfScenarioForecasts?.[0]?.projectedGrossMarginImpactPercent}% ({aiResult.data.whatIfScenarioForecasts?.[0]?.recommendation})
                      </p>
                    </Card>
                  </div>
                </div>
              )}

              {/* Tab: Raw Strict Output JSON */}
              {!aiRunning && aiModalTab === 'json' && aiResult?.data && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">
                      Strict Schema Compliant Output Payload (Section 5):
                    </span>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          navigator.clipboard.writeText(JSON.stringify(aiResult.data, null, 2));
                          setCopiedJson(true);
                          setTimeout(() => setCopiedJson(false), 2000);
                        }}
                        className="h-7 text-xs font-semibold"
                      >
                        {copiedJson ? <Check className="w-3.5 h-3.5 text-emerald-600 mr-1" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
                        {copiedJson ? 'Copied JSON!' : 'Copy JSON'}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          const blob = new Blob([JSON.stringify(aiResult.data, null, 2)], { type: 'application/json' });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = `erp_forecast_${new Date().toISOString().split('T')[0]}.json`;
                          a.click();
                        }}
                        className="h-7 text-xs font-semibold"
                      >
                        <Download className="w-3.5 h-3.5 mr-1" />
                        Download
                      </Button>
                    </div>
                  </div>

                  <pre className="p-4 rounded-xl bg-slate-950 text-slate-100 text-[11px] font-mono overflow-x-auto max-h-[55vh] border border-slate-800 leading-relaxed select-all">
                    {JSON.stringify(aiResult.data, null, 2)}
                  </pre>
                </div>
              )}

              {/* Tab: Master System Prompt */}
              {!aiRunning && aiModalTab === 'prompt' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">
                      Chief Quantitative Operations Analyst Master Prompt & Formulas:
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        navigator.clipboard.writeText(systemPromptText);
                        setCopiedPrompt(true);
                        setTimeout(() => setCopiedPrompt(false), 2000);
                      }}
                      className="h-7 text-xs font-semibold"
                    >
                      {copiedPrompt ? <Check className="w-3.5 h-3.5 text-emerald-600 mr-1" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
                      {copiedPrompt ? 'Copied Prompt!' : 'Copy Prompt'}
                    </Button>
                  </div>

                  <pre className="p-4 rounded-xl bg-slate-900 text-slate-200 text-[11px] font-mono overflow-x-auto max-h-[55vh] border border-slate-800 whitespace-pre-wrap leading-relaxed">
                    {systemPromptText || 'Loading Master System Prompt...'}
                  </pre>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between text-xs">
              <span className="text-slate-400">
                Predictive AI Engine • Real-time Mathematical MRP Calibration
              </span>
              <Button size="sm" onClick={() => setAiModalOpen(false)} className="h-8 text-xs font-semibold">
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
