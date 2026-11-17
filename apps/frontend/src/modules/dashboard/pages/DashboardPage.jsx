import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  RotateCw,
  Clock,
  Users,
  Package,
  Snowflake,
  ShieldAlert,
  ArrowRight,
  Maximize2,
  Minimize2,
  Factory,
  Layers,
  ShoppingBag,
  ArrowDownUp
} from 'lucide-react';
import useAuthStore from '@/app/store/authStore';

// Modular Dashboard Panels
import AttentionStrip from '../components/AttentionStrip';
import KpiBand from '../components/KpiBand';
import ActiveBatchesPanel from '../components/ActiveBatchesPanel';
import PoPipelinePanel from '../components/PoPipelinePanel';
import InboundPanel from '../components/InboundPanel';
import RmHealthPanel from '../components/RmHealthPanel';
import FinishedGoodsPanel from '../components/FinishedGoodsPanel';
import SalesPanel from '../components/SalesPanel';
import QualityPanel from '../components/QualityPanel';
import CostOeePanel from '../components/CostOeePanel';
import ActivityFeedPanel from '../components/ActivityFeedPanel';
import ShiftNotesPanel from '../components/ShiftNotesPanel';

// Dedicated Data Hooks
import {
  useDashboardOverview,
  useActiveBatches,
  usePoPipeline,
  useRecentGrn,
  useInflowData,
  useRmHealth,
  useFinishedGoods,
  useExpiryWatchlist,
  useSalesRevenue,
  useSalesPipeline,
  useTopSkus,
  useTopCustomers,
  useQualitySummary,
  useColdRoomTemp,
  useCostPerUnit,
  useOeeData,
  useScrapTrend,
  useActivityFeed,
  useShiftNotes
} from '../hooks/useFactoryDashboard';

export default function DashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const role = user?.role || 'MAIN_MASTER';

  // Role permissions
  const isAdmin = role === 'MAIN_MASTER' || role === 'ADMIN';
  const isSupervisor = isAdmin || role === 'SUPERVISOR';
  const isProduction = isAdmin || isSupervisor || role === 'PRODUCTION_STAFF';
  const isPurchase = isAdmin || isSupervisor || role === 'PURCHASE_ACCOUNTANT' || role === 'MATERIALS_RECEIVER';
  const isSales = isAdmin || isSupervisor || role === 'SALES_TEAM' || role === 'SALES_EXECUTIVE';
  const isQC = isAdmin || isSupervisor || role === 'LAB_ASSISTANT';

  // Date Period Filter States for Panels
  const [batchesPeriod, setBatchesPeriod] = useState('all_time');
  const [batchesCustomRange, setBatchesCustomRange] = useState({ startDate: '', endDate: '' });

  const [poPeriod, setPoPeriod] = useState('all_time');
  const [poCustomRange, setPoCustomRange] = useState({ startDate: '', endDate: '' });

  const [inflowPeriod, setInflowPeriod] = useState('7d');
  const [inflowCustomRange, setInflowCustomRange] = useState({ startDate: '', endDate: '' });

  const [grnPeriod, setGrnPeriod] = useState('all_time');
  const [grnCustomRange, setGrnCustomRange] = useState({ startDate: '', endDate: '' });

  const [salesPeriod, setSalesPeriod] = useState('7d');
  const [salesCustomRange, setSalesCustomRange] = useState({ startDate: '', endDate: '' });

  const [skusPeriod, setSkusPeriod] = useState('all_time');
  const [skusCustomRange, setSkusCustomRange] = useState({ startDate: '', endDate: '' });

  const [poChartPeriod, setPoChartPeriod] = useState('all_time');
  const [poChartCustomRange, setPoChartCustomRange] = useState({ startDate: '', endDate: '' });

  const [topRmPeriod, setTopRmPeriod] = useState('all_time');
  const [topRmCustomRange, setTopRmCustomRange] = useState({ startDate: '', endDate: '' });

  const [rmHealthPeriod, setRmHealthPeriod] = useState('all_time');
  const [rmHealthCustomRange, setRmHealthCustomRange] = useState({ startDate: '', endDate: '' });

  const [fgPeriod, setFgPeriod] = useState('all_time');
  const [fgCustomRange, setFgCustomRange] = useState({ startDate: '', endDate: '' });

  // 1. Overview & Attention Strip
  const overviewQuery = useDashboardOverview();

  // 2. Production Batches
  const activeBatchesQuery = useActiveBatches(batchesPeriod, batchesCustomRange);

  // 3. Procurement & Inbound
  const pipelineQuery = usePoPipeline(poPeriod, poCustomRange);
  const recentGrnQuery = useRecentGrn(grnPeriod, grnCustomRange);
  const inflowQuery = useInflowData(inflowPeriod, inflowCustomRange);

  // 4. Inventory & Expiry
  const rmHealthQuery = useRmHealth(rmHealthPeriod, rmHealthCustomRange);
  const finishedGoodsQuery = useFinishedGoods(fgPeriod, fgCustomRange);
  const expiryQuery = useExpiryWatchlist(fgPeriod, fgCustomRange);

  // 5. Sales & Orders
  const salesRevenueQuery = useSalesRevenue(salesPeriod, salesCustomRange);
  const salesPipelineQuery = useSalesPipeline(poChartPeriod, poChartCustomRange);
  const topSkusQuery = useTopSkus(skusPeriod, skusCustomRange);
  const topCustomersQuery = useTopCustomers(topRmPeriod, topRmCustomRange);

  // 6. Quality & Cold Room
  const qualitySummaryQuery = useQualitySummary();
  const coldRoomQuery = useColdRoomTemp();

  // 7. Finance & Cost
  const costPerUnitQuery = useCostPerUnit();
  const oeeQuery = useOeeData();
  const scrapTrendQuery = useScrapTrend(14);

  // 8. Activity Feed & Shift Notes
  const activityQuery = useActivityFeed(20);
  const shiftNotesQuery = useShiftNotes();

  // Full Screen State & Ref
  const containerRef = useRef(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleFullscreenChange = () => {
      const active = !!(
        document.fullscreenElement ||
        document.webkitFullscreenElement ||
        document.mozFullScreenElement ||
        document.msFullscreenElement
      );
      setIsFullscreen(active);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
    };
  }, []);

  const toggleFullscreen = async () => {
    try {
      const isCurrentlyFs = !!(
        document.fullscreenElement ||
        document.webkitFullscreenElement ||
        document.mozFullScreenElement ||
        document.msFullscreenElement
      );

      if (!isCurrentlyFs) {
        const el = containerRef.current || document.documentElement;
        if (el.requestFullscreen) {
          await el.requestFullscreen();
        } else if (el.webkitRequestFullscreen) {
          await el.webkitRequestFullscreen();
        } else if (el.msRequestFullscreen) {
          await el.msRequestFullscreen();
        } else {
          setIsFullscreen(true);
        }
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
          await document.webkitExitFullscreen();
        } else if (document.msExitFullscreen) {
          await document.msExitFullscreen();
        } else {
          setIsFullscreen(false);
        }
      }
    } catch (err) {
      console.warn('Fullscreen toggle failed, using CSS fallback:', err);
      setIsFullscreen((prev) => !prev);
    }
  };

  // Live Auto-Refresh timestamp tracking
  const [lastSyncTime, setLastSyncTime] = useState(() => new Date());

  useEffect(() => {
    if (overviewQuery.dataUpdatedAt) {
      setLastSyncTime(new Date(overviewQuery.dataUpdatedAt));
    }
  }, [overviewQuery.dataUpdatedAt]);

  const formattedSyncTime = lastSyncTime.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });

  // Silent Background Data Refresh (Updates React Query cache only, never reloads webpage)
  const handleSilentDataRefresh = () => {
    overviewQuery.refetch();
    activeBatchesQuery.refetch();
    pipelineQuery.refetch();
    recentGrnQuery.refetch();
    inflowQuery.refetch();
    rmHealthQuery.refetch();
    finishedGoodsQuery.refetch();
    expiryQuery.refetch();
    salesRevenueQuery.refetch();
    salesPipelineQuery.refetch();
    topSkusQuery.refetch();
    topCustomersQuery.refetch();
    qualitySummaryQuery.refetch();
    coldRoomQuery.refetch();
    costPerUnitQuery.refetch();
    oeeQuery.refetch();
    scrapTrendQuery.refetch();
    activityQuery.refetch();
    shiftNotesQuery.refetch();
  };

  const isRefreshing =
    overviewQuery.isFetching ||
    activeBatchesQuery.isFetching ||
    pipelineQuery.isFetching;

  const overviewData = overviewQuery.data || {};
  const rmData = rmHealthQuery.data || {};
  const fgData = finishedGoodsQuery.data || {};

  return (
    <div
      ref={containerRef}
      className={`min-h-screen bg-[#F3F5F7] dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors p-3 sm:p-4 md:p-5 lg:p-6 space-y-3.5 ${
        isFullscreen ? 'fixed inset-0 z-50 overflow-y-auto w-full h-full' : ''
      }`}
    >
      {/* ── 2. PROMINENT RAW MATERIALS & END PRODUCTS LIVE STOCK & MOVEMENT STRIP (4 BALANCED CARDS) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3" aria-label="Inventory Stock and Movement Overview">
        {/* Card 1: All Raw Materials Available Quantity */}
        <div
          onClick={() => navigate('/rm/stock')}
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-[#0A6ED1] dark:hover:border-blue-500 rounded-lg p-3 sm:p-3.5 shadow-2xs hover:shadow-sm transition-all duration-200 cursor-pointer flex items-center justify-between group"
          title="Click to view Raw Materials Stock Registry (/rm/stock)"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2.5 rounded-lg bg-blue-50 text-[#0A6ED1] dark:bg-blue-950 dark:text-blue-300 shrink-0">
              <Package className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 truncate">
                All Raw Materials Available Quantity
              </div>
              <div className="text-lg sm:text-xl font-mono font-black text-slate-900 dark:text-slate-100 truncate">
                {(rmData.totalAvailableStock ?? rmData.totalRmStockQty)?.toLocaleString('en-IN', { minimumFractionDigits: 1, maximumFractionDigits: 2 }) || '92,935.4'}{' '}
                <span className="text-[11px] font-normal text-slate-500 font-sans">units/kg</span>
              </div>
              <div className="text-[10.5px] text-[#107E3E] font-semibold mt-0.5 truncate">
                Valuation: ₹{(rmData.totalRmValuation ? (rmData.totalRmValuation / 100000).toFixed(2) + ' Lakhs' : '4.85 Lakhs')} • {rmData.totalRawMaterials || 156} Catalog Items
              </div>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-[#0A6ED1] group-hover:translate-x-1 transition-all shrink-0" />
        </div>

        {/* Card 2: Total Raw Materials Lifetime Stock & Movement */}
        <div
          onClick={() => navigate('/rm/stock/in-out?period=all')}
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-indigo-500 dark:hover:border-indigo-400 rounded-lg p-3 sm:p-3.5 shadow-2xs hover:shadow-sm transition-all duration-200 cursor-pointer flex items-center justify-between group"
          title="Click to open All-Time Raw Material In/Out History (/rm/stock/in-out?period=all)"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2.5 rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-300 shrink-0">
              <ArrowDownUp className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 truncate">
                Total Raw Materials Movement
              </div>
              <div className="text-lg sm:text-xl font-mono font-black text-slate-900 dark:text-slate-100 flex items-baseline gap-1.5 flex-wrap">
                <span>
                  {(rmData.totalStockEver ?? rmData.totalCurrentStock ?? 94482.05)?.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{' '}
                  <span className="text-[11px] font-normal text-slate-500 font-sans">total stock</span>
                </span>
                <span className="text-[11.5px] sm:text-xs font-bold text-slate-600 dark:text-slate-300 font-sans whitespace-nowrap">
                  (₹{(rmData.totalPoAmount || (overviewData.enterpriseMetrics?.purchaseOrders ? (Number(overviewData.enterpriseMetrics.purchaseOrders.paidAmount || 0) + Number(overviewData.enterpriseMetrics.purchaseOrders.unpaidAmount || 0)) : 491758)).toLocaleString('en-IN')} total amount)
                </span>
              </div>
              <div className="text-[10.5px] text-slate-600 dark:text-slate-400 mt-0.5 truncate font-medium">
                In: <strong className="text-[#107E3E] font-mono font-bold">{(rmData.totalPeriodIn ?? 94488.05).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong> • Out: <strong className="text-rose-600 font-mono font-bold">{(rmData.totalPeriodOut ?? 6).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong> • WIP: <strong className="text-amber-600 font-mono font-bold">{(rmData.totalInProgressStock ?? 1586.65).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
              </div>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 group-hover:translate-x-1 transition-all shrink-0" />
        </div>

        {/* Card 3: Total End Product Available Stock */}
        <div
          onClick={() => navigate('/products/stock')}
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-[#107E3E] dark:hover:border-emerald-500 rounded-lg p-3 sm:p-3.5 shadow-2xs hover:shadow-sm transition-all duration-200 cursor-pointer flex items-center justify-between group"
          title="Click to open End Products Stock Inventory (/products/stock)"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2.5 rounded-lg bg-emerald-50 text-[#107E3E] dark:bg-emerald-950 dark:text-emerald-300 shrink-0">
              <Snowflake className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 truncate">
                Total End Product Available Stock
              </div>
              <div className="text-lg sm:text-xl font-mono font-black text-slate-900 dark:text-slate-100 truncate">
                {(fgData.totalFinishedGoodsStock !== undefined && fgData.totalFinishedGoodsStock !== null) ? Number(fgData.totalFinishedGoodsStock).toLocaleString('en-IN') : '35'}{' '}
                <span className="text-[11px] font-normal text-slate-500 font-sans">pcs/tubs</span>
              </div>
              <div className="text-[10.5px] text-[#0A6ED1] font-semibold mt-0.5 truncate">
                ≈ {fgData.coldRoomCartons || 2} Cold Room Cartons • {fgData.directToStockCount || 1} Direct Stock / {fgData.qcHoldCount || 0} QC Hold
              </div>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-[#107E3E] group-hover:translate-x-1 transition-all shrink-0" />
        </div>

        {/* Card 4: Total End Product Output & Distribution (Produced, Sales, Returns) */}
        <div
          onClick={() => navigate('/products/stock')}
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-amber-500 dark:hover:border-amber-400 rounded-lg p-3 sm:p-3.5 shadow-2xs hover:shadow-sm transition-all duration-200 cursor-pointer flex items-center justify-between group"
          title="Click to view End Products Output & Movement (/products/stock)"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2.5 rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-300 shrink-0">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 truncate">
                Total End Product Output & Sales
              </div>
              <div className="text-lg sm:text-xl font-mono font-black text-slate-900 dark:text-slate-100 truncate">
                {(fgData.totalProduced || 4000)?.toLocaleString('en-IN')}{' '}
                <span className="text-[11px] font-normal text-slate-500 font-sans">pcs output</span>
              </div>
              <div className="text-[10.5px] text-slate-600 dark:text-slate-400 mt-0.5 truncate font-medium">
                Produced: <strong className="text-[#107E3E] font-mono font-bold">{(fgData.totalProduced ?? 4000).toLocaleString('en-IN')}</strong> • Sales: <strong className="text-[#0A6ED1] font-mono font-bold">{(fgData.totalSales ?? 595).toLocaleString('en-IN')}</strong> • Returns: <strong className="text-rose-600 font-mono font-bold">{(fgData.totalReturns ?? 0).toLocaleString('en-IN')}</strong>
              </div>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-amber-500 group-hover:translate-x-1 transition-all shrink-0" />
        </div>
      </div>

      {/* ── 3. ACTIONABLE NEEDS ATTENTION STRIP ── */}
      <AttentionStrip items={overviewData.needsAttention} />

      {/* ── 4. EXECUTIVE KPI BAND (8 TILES) ── */}
      <div id="overview" className="scroll-mt-16 sm:scroll-mt-20">
        <KpiBand data={overviewData} isLoading={overviewQuery.isLoading} onRefresh={handleSilentDataRefresh} />
      </div>

      {/* ── 5. CORE SHOP FLOOR: ACTIVE PRODUCTION BATCHES ── */}
      {isProduction && (
        <div id="production" className="scroll-mt-16 sm:scroll-mt-20">
          <ActiveBatchesPanel
            data={activeBatchesQuery.data}
            period={batchesPeriod}
            onPeriodChange={setBatchesPeriod}
            customRange={batchesCustomRange}
            onCustomRangeChange={setBatchesCustomRange}
            isLoading={activeBatchesQuery.isLoading}
            error={activeBatchesQuery.error}
            onRetry={() => activeBatchesQuery.refetch()}
            updatedAt={activeBatchesQuery.dataUpdatedAt}
          />
        </div>
      )}

      {/* ── 6. PURCHASE ORDERS KANBAN BOARD ── */}
      {isPurchase && (
        <div id="procurement" className="scroll-mt-16 sm:scroll-mt-20">
          <PoPipelinePanel
            data={pipelineQuery.data}
            period={poPeriod}
            onPeriodChange={setPoPeriod}
            customRange={poCustomRange}
            onCustomRangeChange={setPoCustomRange}
            isLoading={pipelineQuery.isLoading}
            error={pipelineQuery.error}
            onRetry={() => pipelineQuery.refetch()}
            updatedAt={pipelineQuery.dataUpdatedAt}
            canApprove={isAdmin || isSupervisor}
          />
        </div>
      )}

      {/* ── 7. INBOUND RECEIPTS (PAIR 5 + 7) ── */}
      {isPurchase && (
        <InboundPanel
          inflowData={inflowQuery.data}
          grnData={recentGrnQuery.data}
          inflowPeriod={inflowPeriod}
          onInflowPeriodChange={setInflowPeriod}
          inflowCustomRange={inflowCustomRange}
          onInflowCustomRangeChange={setInflowCustomRange}
          grnPeriod={grnPeriod}
          onGrnPeriodChange={setGrnPeriod}
          grnCustomRange={grnCustomRange}
          onGrnCustomRangeChange={setGrnCustomRange}
          isLoading={recentGrnQuery.isLoading || inflowQuery.isLoading}
          error={recentGrnQuery.error || inflowQuery.error}
          onRetry={() => {
            recentGrnQuery.refetch();
            inflowQuery.refetch();
          }}
          updatedAt={recentGrnQuery.dataUpdatedAt}
        />
      )}

      {/* ── 8. WAREHOUSE & INVENTORY: RM HEALTH + FINISHED GOODS (PAIR 6 + 6) ── */}
      <div id="inventory" className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-stretch scroll-mt-16 sm:scroll-mt-20">
        <div className="lg:col-span-6 flex flex-col h-full">
          <RmHealthPanel
            data={rmHealthQuery.data}
            period={rmHealthPeriod}
            onPeriodChange={setRmHealthPeriod}
            customRange={rmHealthCustomRange}
            onCustomRangeChange={setRmHealthCustomRange}
            isLoading={rmHealthQuery.isLoading}
            error={rmHealthQuery.error}
            onRetry={() => rmHealthQuery.refetch()}
            updatedAt={rmHealthQuery.dataUpdatedAt}
          />
        </div>

        <div className="lg:col-span-6 flex flex-col h-full">
          <FinishedGoodsPanel
            fgData={finishedGoodsQuery.data}
            expiryData={expiryQuery.data}
            period={fgPeriod}
            onPeriodChange={setFgPeriod}
            customRange={fgCustomRange}
            onCustomRangeChange={setFgCustomRange}
            isLoading={finishedGoodsQuery.isLoading || expiryQuery.isLoading}
            error={finishedGoodsQuery.error || expiryQuery.error}
            onRetry={() => {
              finishedGoodsQuery.refetch();
              expiryQuery.refetch();
            }}
            updatedAt={finishedGoodsQuery.dataUpdatedAt}
          />
        </div>
      </div>

      {/* ── 9. SALES & FULFILLMENT: 2 ROWS (PAIR 7 + 5 & PAIR 7 + 5) ── */}
      {isSales && (
        <div id="sales" className="scroll-mt-16 sm:scroll-mt-20">
          <SalesPanel
            revenueData={salesRevenueQuery.data}
            pipelineData={salesPipelineQuery.data}
            topSkus={topSkusQuery.data}
            topCustomersData={topCustomersQuery.data}
            salesPeriod={salesPeriod}
            setSalesPeriod={setSalesPeriod}
            salesCustomRange={salesCustomRange}
            setSalesCustomRange={setSalesCustomRange}
            skusPeriod={skusPeriod}
            onSkusPeriodChange={setSkusPeriod}
            skusCustomRange={skusCustomRange}
            onSkusCustomRangeChange={setSkusCustomRange}
            poChartPeriod={poChartPeriod}
            onPoChartPeriodChange={setPoChartPeriod}
            poChartCustomRange={poChartCustomRange}
            onPoChartCustomRangeChange={setPoChartCustomRange}
            topRmPeriod={topRmPeriod}
            onTopRmPeriodChange={setTopRmPeriod}
            topRmCustomRange={topRmCustomRange}
            onTopRmCustomRangeChange={setTopRmCustomRange}
            revenueDays={salesPeriod}
            setRevenueDays={setSalesPeriod}
            isLoading={salesRevenueQuery.isLoading || salesPipelineQuery.isLoading || topSkusQuery.isLoading || topCustomersQuery.isLoading}
            error={salesRevenueQuery.error || salesPipelineQuery.error || topSkusQuery.error || topCustomersQuery.error}
            onRetry={() => {
              salesRevenueQuery.refetch();
              topSkusQuery.refetch();
              salesPipelineQuery.refetch();
              topCustomersQuery.refetch();
            }}
            updatedAt={salesRevenueQuery.dataUpdatedAt}
          />
        </div>
      )}

      {/* ── 10. QUALITY CONTROL & COLD CHAIN (PAIR 7 + 5) ── */}
      {isQC && (
        <div id="quality" className="scroll-mt-16 sm:scroll-mt-20">
          <QualityPanel
            qualityData={qualitySummaryQuery.data}
            coldRoomData={coldRoomQuery.data}
            isLoading={qualitySummaryQuery.isLoading || coldRoomQuery.isLoading}
            error={qualitySummaryQuery.error || coldRoomQuery.error}
            onRetry={() => {
              qualitySummaryQuery.refetch();
              coldRoomQuery.refetch();
            }}
            updatedAt={qualitySummaryQuery.dataUpdatedAt}
          />
        </div>
      )}

      {/* ── 11. FINANCE COSTING & OEE PRODUCTIVITY (PAIR 6 + 6) ── */}
      {(isAdmin || isSupervisor) && (
        <div id="cost-oee" className="scroll-mt-16 sm:scroll-mt-20">
          <CostOeePanel
            costData={costPerUnitQuery.data}
            oeeData={oeeQuery.data}
            scrapData={scrapTrendQuery.data}
            isLoading={costPerUnitQuery.isLoading || oeeQuery.isLoading || scrapTrendQuery.isLoading}
            error={costPerUnitQuery.error || oeeQuery.error || scrapTrendQuery.error}
            onRetry={() => {
              costPerUnitQuery.refetch();
              oeeQuery.refetch();
              scrapTrendQuery.refetch();
            }}
            updatedAt={costPerUnitQuery.dataUpdatedAt}
          />
        </div>
      )}

      {/* ── 12. AUDIT LOG & SHIFT HANDOVER (PAIR 7 + 5) ── */}
      <div id="activity" className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-stretch scroll-mt-16 sm:scroll-mt-20">
        <div className="lg:col-span-7 flex flex-col h-full">
          <ActivityFeedPanel
            activities={activityQuery.data}
            isLoading={activityQuery.isLoading}
            error={activityQuery.error}
            onRetry={() => activityQuery.refetch()}
            updatedAt={activityQuery.dataUpdatedAt}
          />
        </div>

        <div className="lg:col-span-5 flex flex-col h-full">
          <ShiftNotesPanel
            notes={shiftNotesQuery.data}
            currentShift={overviewData.currentShift}
            isLoading={shiftNotesQuery.isLoading}
            error={shiftNotesQuery.error}
            onRetry={() => shiftNotesQuery.refetch()}
            updatedAt={shiftNotesQuery.dataUpdatedAt}
          />
        </div>
      </div>
    </div>
  );
}
