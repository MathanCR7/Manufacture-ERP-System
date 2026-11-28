import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { api } from '@/lib/axios';
import { useNavigate } from 'react-router-dom';
import { formatINR, formatDate, renderPaymentStatusChip } from '@/utils/financeFormatters';
import { exportToExcel, exportToPDF } from '@/utils/reportExportUtils';
import { 
  BarChart, Bar, AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer 
} from 'recharts';
import { 
  DollarSign, TrendingUp, TrendingDown, CreditCard, 
  Wallet, RefreshCw, AlertTriangle, ShieldCheck, ArrowUpRight, 
  Clock, CheckCircle2, ChevronRight, FileText, Layers, Building2, User,
  Calendar, Download, Printer, PieChart as PieChartIcon, Activity, Landmark, 
  Receipt, ArrowDownLeft, SlidersHorizontal, Filter, Eye, Percent, Sparkles,
  ExternalLink, CheckCircle, ArrowRight, Banknote, ShieldAlert, BarChart3
} from 'lucide-react';
import RecordPaymentModal from '../components/RecordPaymentModal';

const DONUT_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', 
  '#ec4899', '#06b6d4', '#f97316', '#6366f1', '#14b8a6'
];

export default function FinanceDashboardPage() {
  const navigate = useNavigate();

  // Filters & State
  const [direction, setDirection] = useState('ALL'); // 'ALL', 'PAYABLE', 'RECEIVABLE'
  const [dateRangePreset, setDateRangePreset] = useState('ALL'); // 'ALL', 'TODAY', 'THIS_MONTH', 'THIS_QUARTER', 'THIS_FY', 'CUSTOM'
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [chartView, setChartView] = useState('CASH_FLOW'); // 'CASH_FLOW' vs 'BILLING_SETTLEMENT'
  
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState(new Date());
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentPrefill, setPaymentPrefill] = useState(null);

  // Compute date range based on preset
  const { calculatedFrom, calculatedTo } = useMemo(() => {
    const now = new Date();
    let from = '';
    let to = '';

    if (dateRangePreset === 'TODAY') {
      const todayStr = now.toISOString().split('T')[0];
      from = todayStr;
      to = todayStr;
    } else if (dateRangePreset === 'THIS_MONTH') {
      from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      to = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
    } else if (dateRangePreset === 'THIS_QUARTER') {
      const quarterIndex = Math.floor(now.getMonth() / 3);
      from = new Date(now.getFullYear(), quarterIndex * 3, 1).toISOString().split('T')[0];
      to = new Date(now.getFullYear(), (quarterIndex + 1) * 3, 0).toISOString().split('T')[0];
    } else if (dateRangePreset === 'THIS_FY') {
      const fyStartYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
      from = `${fyStartYear}-04-01`;
      to = `${fyStartYear + 1}-03-31`;
    } else if (dateRangePreset === 'CUSTOM') {
      from = customFrom;
      to = customTo;
    }

    return { calculatedFrom: from, calculatedTo: to };
  }, [dateRangePreset, customFrom, customTo]);

  // Fetch Dashboard Data
  const fetchDashboard = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({
      direction,
      ...(calculatedFrom ? { from: calculatedFrom } : {}),
      ...(calculatedTo ? { to: calculatedTo } : {})
    });

    api.get(`/finance/dashboard?${params.toString()}`)
      .then(res => {
        if (res.data?.success) {
          setData(res.data.data);
          setLastRefreshed(new Date());
        }
      })
      .catch(err => {
        console.error('Error fetching finance dashboard:', err);
      })
      .finally(() => setLoading(false));
  }, [direction, calculatedFrom, calculatedTo]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  // Data extraction
  const kpi = data?.kpi || {};
  const splitDirection = data?.splitDirection || [];
  const docTypeSummary = data?.docTypeSummary || [];
  const bankBalances = data?.bankBalances || [];
  const recentPayments = data?.recentPayments || [];
  const upcomingDues = data?.upcomingDues || [];
  const cashFlowTrend = data?.cashFlowTrend || [];
  const monthlyTrend = data?.monthlyTrend || [];
  const agingBuckets = data?.agingBuckets || [];
  const expenseShares = data?.expenseShares || [];
  const topSuppliers = data?.topSuppliers || [];
  const topCustomers = data?.topCustomers || [];
  const attentionItems = data?.attentionItems || [];

  // Payables vs Receivables Split
  const payableSplit = useMemo(() => {
    return splitDirection.find(d => d.direction === 'PAYABLE') || {
      total_billed: 0,
      total_paid: 0,
      total_outstanding: 0,
      overdue_amount: 0,
      overdue_count: 0
    };
  }, [splitDirection]);

  const receivableSplit = useMemo(() => {
    return splitDirection.find(d => d.direction === 'RECEIVABLE') || {
      total_billed: 0,
      total_paid: 0,
      total_outstanding: 0,
      overdue_amount: 0,
      overdue_count: 0
    };
  }, [splitDirection]);

  // Financial Health Ratios
  const ratios = useMemo(() => {
    const billed = Number(kpi.totalBilled || 0);
    const paid = Number(kpi.totalPaid || 0);
    const outstanding = Number(kpi.totalOutstanding || 0);
    const overdue = Number(kpi.overdueAmount || 0);
    const liquidCash = Number(kpi.totalLiquidCash || 0);
    const totalPayables = Number(payableSplit.total_outstanding || 0);
    const totalReceivables = Number(receivableSplit.total_outstanding || 0);

    const settlementRate = billed > 0 ? (paid / billed) * 100 : 0;
    const overdueRatio = outstanding > 0 ? (overdue / outstanding) * 100 : 0;
    const cashCoverageRatio = totalPayables > 0 ? (liquidCash / totalPayables) * 100 : 100;
    const netWorkingCapital = (liquidCash + totalReceivables) - totalPayables;

    return {
      settlementRate: settlementRate.toFixed(1),
      overdueRatio: overdueRatio.toFixed(1),
      cashCoverageRatio: cashCoverageRatio.toFixed(1),
      netWorkingCapital
    };
  }, [kpi, payableSplit, receivableSplit]);

  // Navigation handlers for Action Center items
  const handleItemAction = (item) => {
    if (item.doc_type === 'PURCHASE_ORDER') {
      navigate(`/purchases/orders/${item.doc_id}?action=payment`, { state: { openPayment: true } });
    } else if (item.doc_type === 'ASSET_PO') {
      navigate(`/maintenance/assets/purchase-orders/${item.doc_id}`);
    } else if (item.doc_type === 'SALES_ORDER') {
      navigate(`/sales/orders/${item.doc_id}`);
    } else if (item.doc_type === 'EXPENSE') {
      navigate(`/finance/expenses?highlight=${item.doc_id}`);
    } else {
      navigate('/finance/documents');
    }
  };

  // Export Executive Summary to Excel
  const handleExportExcel = () => {
    const summaryRows = [
      { Metric: 'Total Billed Commitments', Value: formatINR(kpi.totalBilled), Details: 'All POs, Assets & Sales' },
      { Metric: 'Total Paid / Settled', Value: formatINR(kpi.totalPaid), Details: `${ratios.settlementRate}% Realized` },
      { Metric: 'Total Outstanding Exposure', Value: formatINR(kpi.totalOutstanding), Details: 'Due for settlement' },
      { Metric: 'Overdue Risk Exposure', Value: formatINR(kpi.overdueAmount), Details: `${kpi.overdueCount} Overdue Documents` },
      { Metric: 'Liquid Cash & Bank Balances', Value: formatINR(kpi.totalLiquidCash), Details: 'Current bank & cash balances' },
      { Metric: 'Net Working Capital', Value: formatINR(ratios.netWorkingCapital), Details: 'Cash + Receivables - Payables' },
      { Metric: 'GST Carry-Forward ITC', Value: formatINR(kpi.carryForwardItc || kpi.itcBalance), Details: 'Input Tax Credit Available' }
    ];

    const columns = [
      { header: 'Financial Metric', accessor: 'Metric' },
      { header: 'Amount (INR)', accessor: 'Value' },
      { header: 'Analytical Details', accessor: 'Details' }
    ];

    exportToExcel('Executive_Finance_Dashboard', 'Finance Summary', columns, summaryRows);
  };

  // Export Executive Summary to PDF
  const handleExportPDF = () => {
    const summaryRows = [
      { Metric: 'Total Billed Volume', Value: formatINR(kpi.totalBilled), Details: 'Cumulative billed commitments' },
      { Metric: 'Total Paid / Settled', Value: formatINR(kpi.totalPaid), Details: `Settlement Efficiency: ${ratios.settlementRate}%` },
      { Metric: 'Total Outstanding', Value: formatINR(kpi.totalOutstanding), Details: 'Pending payables & receivables' },
      { Metric: 'Overdue Exposure', Value: formatINR(kpi.overdueAmount), Details: `${kpi.overdueCount} bills past credit terms` },
      { Metric: 'Liquid Cash & Reserves', Value: formatINR(kpi.totalLiquidCash), Details: 'Bank accounts & factory cash' },
      { Metric: 'Net Working Capital', Value: formatINR(ratios.netWorkingCapital), Details: 'Liquid Net Assets' }
    ];

    const columns = [
      { header: 'Metric', accessor: 'Metric' },
      { header: 'Amount', accessor: 'Value' },
      { header: 'Notes', accessor: 'Details' }
    ];

    exportToPDF('Executive_Finance_Summary', columns, summaryRows);
  };

  return (
    <div className="w-full px-2.5 sm:px-3.5 py-2.5 space-y-4 min-h-screen text-slate-800 dark:text-slate-100">
      
      {/* 1. TOP HEADER & INTERACTIVE COMMAND BAR */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 flex items-center gap-1">
              <Sparkles className="w-2.5 h-2.5" /> 360° Financial Intelligence
            </span>
            <span className="text-[11px] text-slate-400">
              Synced: {lastRefreshed.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2 mt-1">
            <DollarSign className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
            Financial Command & General Ledger
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Consolidated operational cash flow, working capital, vendor payables & customer receivables
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 print:hidden">
          {/* Quick Record Payment */}
          <button
            onClick={() => {
              setPaymentPrefill(null);
              setIsPaymentModalOpen(true);
            }}
            className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-all shadow-sm hover:shadow flex items-center gap-1.5 cursor-pointer"
          >
            <CreditCard className="w-3.5 h-3.5" />
            Record Payment
          </button>

          {/* Export Excel */}
          <button
            onClick={handleExportExcel}
            title="Download Excel Summary"
            className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold text-xs transition-all flex items-center gap-1 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-emerald-600" />
            Excel
          </button>

          {/* Export PDF */}
          <button
            onClick={handleExportPDF}
            title="Download PDF Report"
            className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold text-xs transition-all flex items-center gap-1 cursor-pointer"
          >
            <FileText className="w-3.5 h-3.5 text-rose-600" />
            PDF
          </button>

          {/* Print */}
          <button
            onClick={() => window.print()}
            title="Print Financial Snapshot"
            className="p-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition-all cursor-pointer"
          >
            <Printer className="w-4 h-4 text-slate-600 dark:text-slate-300" />
          </button>

          {/* Refresh */}
          <button
            onClick={fetchDashboard}
            disabled={loading}
            title="Refresh Financial Data"
            className="p-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition-all cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 text-slate-600 dark:text-slate-300 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* 2. FILTER & TIME RANGE RIBBON */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 print:hidden">
        {/* Book Scope Toggle */}
        <div className="flex items-center gap-1 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs w-fit">
          <button
            onClick={() => setDirection('ALL')}
            className={`px-3 py-1 rounded-md font-bold transition-all ${
              direction === 'ALL'
                ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-2xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            360° All Books
          </button>
          <button
            onClick={() => setDirection('PAYABLE')}
            className={`px-3 py-1 rounded-md font-bold transition-all ${
              direction === 'PAYABLE'
                ? 'bg-rose-600 text-white shadow-2xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-rose-600'
            }`}
          >
            Payables (Vendors)
          </button>
          <button
            onClick={() => setDirection('RECEIVABLE')}
            className={`px-3 py-1 rounded-md font-bold transition-all ${
              direction === 'RECEIVABLE'
                ? 'bg-emerald-600 text-white shadow-2xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-emerald-600'
            }`}
          >
            Receivables (Customers)
          </button>
        </div>

        {/* Date Presets and Custom Pickers */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-slate-400 font-semibold flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5" /> Period:
          </span>

          {['ALL', 'TODAY', 'THIS_MONTH', 'THIS_QUARTER', 'THIS_FY'].map((preset) => {
            const labels = {
              ALL: 'All Time',
              TODAY: 'Today',
              THIS_MONTH: 'This Month',
              THIS_QUARTER: 'Quarter',
              THIS_FY: 'FY 2026-27'
            };
            const isActive = dateRangePreset === preset;
            return (
              <button
                key={preset}
                onClick={() => setDateRangePreset(preset)}
                className={`px-2.5 py-1 rounded-md font-semibold transition-all border ${
                  isActive
                    ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-slate-900 dark:border-white shadow-2xs'
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-400'
                }`}
              >
                {labels[preset]}
              </button>
            );
          })}

          {/* Custom Date Range Picker */}
          <div className="flex items-center gap-1.5 pl-2 border-l border-slate-200 dark:border-slate-700">
            <input
              type="date"
              value={customFrom}
              onChange={(e) => {
                setCustomFrom(e.target.value);
                setDateRangePreset('CUSTOM');
              }}
              className="h-7 px-2 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-[11px] font-mono text-slate-800 dark:text-slate-200"
              placeholder="From"
            />
            <span className="text-slate-400 text-xs">to</span>
            <input
              type="date"
              value={customTo}
              onChange={(e) => {
                setCustomTo(e.target.value);
                setDateRangePreset('CUSTOM');
              }}
              className="h-7 px-2 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-[11px] font-mono text-slate-800 dark:text-slate-200"
              placeholder="To"
            />
            {dateRangePreset === 'CUSTOM' && (
              <button
                onClick={() => {
                  setCustomFrom('');
                  setCustomTo('');
                  setDateRangePreset('ALL');
                }}
                className="text-[10px] text-slate-400 hover:text-rose-500 underline"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 3. EXECUTIVE 8-KPI COMMAND RIBBON */}
      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
        {/* KPI 1: Total Billed */}
        <div 
          onClick={() => navigate('/finance/documents')}
          className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs cursor-pointer hover:border-primary hover:shadow-xs transition-all group"
        >
          <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Total Billed</div>
          <div className="text-base sm:text-lg font-black text-slate-900 dark:text-white mt-1 font-mono truncate">
            {formatINR(kpi.totalBilled)}
          </div>
          <div className="text-[10px] text-slate-500 mt-1 flex items-center justify-between">
            <span className="flex items-center gap-1"><Layers className="w-3 h-3 text-primary" /> All Docs</span>
            <ArrowUpRight className="w-3 h-3 text-slate-400 group-hover:text-primary transition-colors" />
          </div>
        </div>

        {/* KPI 2: Total Settled / Paid */}
        <div 
          onClick={() => navigate('/finance/documents?status=PAID')}
          className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs cursor-pointer hover:border-emerald-500 hover:shadow-xs transition-all group"
        >
          <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Total Settled</div>
          <div className="text-base sm:text-lg font-black text-emerald-600 dark:text-emerald-400 mt-1 font-mono truncate">
            {formatINR(kpi.totalPaid)}
          </div>
          <div className="text-[10px] text-emerald-600 dark:text-emerald-400/90 mt-1 flex items-center justify-between font-semibold">
            <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> {ratios.settlementRate}% Realized</span>
            <ArrowUpRight className="w-3 h-3 text-slate-400 group-hover:text-emerald-500 transition-colors" />
          </div>
        </div>

        {/* KPI 3: Advances Held */}
        <div 
          onClick={() => navigate('/finance/documents?status=ADVANCE_PAID')}
          className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs cursor-pointer hover:border-blue-500 hover:shadow-xs transition-all group"
        >
          <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Advances Held</div>
          <div className="text-base sm:text-lg font-black text-blue-600 dark:text-blue-400 mt-1 font-mono truncate">
            {formatINR(kpi.totalAdvance)}
          </div>
          <div className="text-[10px] text-blue-600 dark:text-blue-400/90 mt-1 flex items-center justify-between font-semibold">
            <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> Pre-Payments</span>
            <ArrowUpRight className="w-3 h-3 text-slate-400 group-hover:text-blue-500 transition-colors" />
          </div>
        </div>

        {/* KPI 4: Outstanding Balance */}
        <div 
          onClick={() => navigate('/finance/documents?status=UNPAID')}
          className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs cursor-pointer hover:border-amber-500 hover:shadow-xs transition-all group"
        >
          <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Total Outstanding</div>
          <div className="text-base sm:text-lg font-black text-amber-600 dark:text-amber-400 mt-1 font-mono truncate">
            {formatINR(kpi.totalOutstanding)}
          </div>
          <div className="text-[10px] text-amber-600 dark:text-amber-400/90 mt-1 flex items-center justify-between font-semibold">
            <span className="flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Pending</span>
            <ArrowUpRight className="w-3 h-3 text-slate-400 group-hover:text-amber-500 transition-colors" />
          </div>
        </div>

        {/* KPI 5: Overdue Exposure */}
        <div 
          onClick={() => navigate('/finance/documents?status=OVERDUE')}
          className="p-3 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/50 dark:bg-rose-950/20 shadow-2xs cursor-pointer hover:border-rose-500 hover:shadow-xs transition-all group"
        >
          <div className="text-[10px] uppercase font-bold text-rose-600 dark:text-rose-400 tracking-wider flex items-center justify-between">
            <span>Overdue ({kpi.overdueCount})</span>
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" />
          </div>
          <div className="text-base sm:text-lg font-black text-rose-700 dark:text-rose-300 mt-1 font-mono truncate">
            {formatINR(kpi.overdueAmount)}
          </div>
          <div className="text-[10px] text-rose-600 dark:text-rose-400 mt-1 flex items-center justify-between font-bold">
            <span>{ratios.overdueRatio}% of Debt</span>
            <ArrowUpRight className="w-3 h-3 text-rose-400 group-hover:text-rose-600 transition-colors" />
          </div>
        </div>

        {/* KPI 6: Liquid Treasury / Bank Reserves */}
        <div 
          onClick={() => {
            const el = document.getElementById('treasury-section');
            if (el) el.scrollIntoView({ behavior: 'smooth' });
          }}
          className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs cursor-pointer hover:border-emerald-500 hover:shadow-xs transition-all group"
        >
          <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Liquid Treasury</div>
          <div className="text-base sm:text-lg font-black text-emerald-700 dark:text-emerald-300 mt-1 font-mono truncate">
            {formatINR(kpi.totalLiquidCash)}
          </div>
          <div className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-1 flex items-center justify-between font-semibold">
            <span className="flex items-center gap-1"><Landmark className="w-3 h-3" /> Cash & Bank</span>
            <ArrowUpRight className="w-3 h-3 text-slate-400 group-hover:text-emerald-500 transition-colors" />
          </div>
        </div>

        {/* KPI 7: Net Working Capital */}
        <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs">
          <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Working Capital</div>
          <div className={`text-base sm:text-lg font-black mt-1 font-mono truncate ${
            ratios.netWorkingCapital >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
          }`}>
            {formatINR(ratios.netWorkingCapital)}
          </div>
          <div className="text-[10px] mt-1 flex items-center justify-between font-semibold">
            <span className={ratios.netWorkingCapital >= 0 ? 'text-emerald-600' : 'text-rose-600'}>
              {ratios.netWorkingCapital >= 0 ? 'Surplus' : 'Deficit'}
            </span>
            <span className="text-slate-400 font-mono text-[9px]">Coverage {ratios.cashCoverageRatio}%</span>
          </div>
        </div>

        {/* KPI 8: GST ITC Balance */}
        <div 
          onClick={() => navigate('/finance/gst')}
          className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs cursor-pointer hover:border-indigo-500 hover:shadow-xs transition-all group"
        >
          <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Net GST ITC</div>
          <div className="text-base sm:text-lg font-black text-indigo-600 dark:text-indigo-400 mt-1 font-mono truncate">
            {formatINR(kpi.carryForwardItc || kpi.itcBalance)}
          </div>
          <div className="text-[10px] text-indigo-600 dark:text-indigo-400 mt-1 flex items-center justify-between font-semibold">
            <span className="flex items-center gap-1"><ShieldCheck className="w-3 h-3" /> Tax Credit</span>
            <ArrowUpRight className="w-3 h-3 text-slate-400 group-hover:text-indigo-500 transition-colors" />
          </div>
        </div>
      </div>

      {/* 4. OPERATIONAL STREAMS & PORTFOLIO BREAKDOWN */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {docTypeSummary.map((stream) => {
          const typeConfig = {
            ASSET_PO: {
              label: 'Capital Assets & Machinery',
              icon: Building2,
              color: 'border-l-indigo-500 text-indigo-600 dark:text-indigo-400',
              route: '/finance/documents?type=ASSET_PO'
            },
            PURCHASE_ORDER: {
              label: 'Raw Material Procurement',
              icon: Receipt,
              color: 'border-l-blue-500 text-blue-600 dark:text-blue-400',
              route: '/finance/documents?type=PURCHASE_ORDER'
            },
            SALES_ORDER: {
              label: 'Customer Sales Orders',
              icon: DollarSign,
              color: 'border-l-emerald-500 text-emerald-600 dark:text-emerald-400',
              route: '/finance/documents?type=SALES_ORDER'
            },
            EXPENSE: {
              label: 'Operating Expenses (OPEX)',
              icon: Wallet,
              color: 'border-l-purple-500 text-purple-600 dark:text-purple-400',
              route: '/finance/expenses'
            }
          }[stream.doc_type] || {
            label: stream.doc_type,
            icon: FileText,
            color: 'border-l-slate-400 text-slate-600',
            route: '/finance/documents'
          };

          const IconComponent = typeConfig.icon;
          const paidPct = Number(stream.total) > 0 ? (Number(stream.paid) / Number(stream.total)) * 100 : 0;

          return (
            <div
              key={stream.doc_type}
              onClick={() => navigate(typeConfig.route)}
              className={`p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs border-l-4 cursor-pointer hover:border-slate-400 transition-all ${typeConfig.color}`}
            >
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold flex items-center gap-1.5 text-slate-900 dark:text-white">
                  <IconComponent className="w-3.5 h-3.5" />
                  {typeConfig.label}
                </span>
                <span className="text-[11px] px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 font-bold text-slate-500">
                  {stream.count} Docs
                </span>
              </div>

              <div className="mt-2 flex items-baseline justify-between">
                <div>
                  <div className="text-[10px] text-slate-400">Total Billed</div>
                  <div className="font-mono font-black text-sm text-slate-900 dark:text-white">
                    {formatINR(stream.total)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-slate-400">Balance Due</div>
                  <div className={`font-mono font-black text-sm ${Number(stream.balance) > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600'}`}>
                    {formatINR(stream.balance)}
                  </div>
                </div>
              </div>

              {/* Progress bar */}
              <div className="mt-2.5">
                <div className="flex justify-between text-[10px] text-slate-400 font-semibold mb-1">
                  <span>Paid: {formatINR(stream.paid)}</span>
                  <span>{paidPct.toFixed(0)}%</span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <div 
                    className="h-full bg-emerald-500 rounded-full transition-all duration-500" 
                    style={{ width: `${Math.min(100, paidPct)}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 5. MAIN ANALYTICS ROW: CASH FLOW TREND & DEBT AGING */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Chart 1: Cash Flow & Billing Trajectory (2 Cols) */}
        <div className="lg:col-span-2 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800 mb-3">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-1.5">
                <BarChart3 className="w-4 h-4 text-emerald-600" />
                Monthly Cash Settlement & Commitments Trajectory
              </h3>
              <p className="text-[11px] text-slate-400">
                {chartView === 'CASH_FLOW' ? 'Cash Inflow vs Cash Outflow timeline' : 'Billed Commitments vs Settled & Outstanding'}
              </p>
            </div>

            {/* Chart Mode Toggle */}
            <div className="flex items-center gap-1 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-[11px]">
              <button
                onClick={() => setChartView('CASH_FLOW')}
                className={`px-2.5 py-1 rounded-md font-bold transition-all ${
                  chartView === 'CASH_FLOW'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                Cash In / Out
              </button>
              <button
                onClick={() => setChartView('BILLING_SETTLEMENT')}
                className={`px-2.5 py-1 rounded-md font-bold transition-all ${
                  chartView === 'BILLING_SETTLEMENT'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                Billed vs Settled
              </button>
            </div>
          </div>

          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              {chartView === 'CASH_FLOW' ? (
                <AreaChart data={cashFlowTrend} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                  <defs>
                    <linearGradient id="inflowGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="outflowGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.15} />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
                  <Tooltip 
                    formatter={(val) => formatINR(val)}
                    contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                  <Area type="monotone" dataKey="cash_inflow" name="Cash Inflow (Receipts)" stroke="#10b981" fillOpacity={1} fill="url(#inflowGrad)" strokeWidth={2} />
                  <Area type="monotone" dataKey="cash_outflow" name="Cash Outflow (Payments)" stroke="#f43f5e" fillOpacity={1} fill="url(#outflowGrad)" strokeWidth={2} />
                </AreaChart>
              ) : (
                <BarChart data={monthlyTrend} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.15} />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
                  <Tooltip 
                    formatter={(val) => formatINR(val)}
                    contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                  <Bar dataKey="billed" name="Total Billed" fill="#6366f1" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="paid" name="Settled" fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="outstanding" name="Outstanding Balance" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: Debt Aging & Credit Risk Buckets (1 Col) */}
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-amber-500" />
                  Debt Aging Analysis
                </h3>
                <p className="text-[11px] text-slate-400">Outstanding liabilities by payment duration</p>
              </div>
              <button
                onClick={() => navigate('/finance/aging')}
                className="text-xs font-bold text-primary hover:underline flex items-center gap-0.5"
              >
                Matrix <ArrowUpRight className="w-3 h-3" />
              </button>
            </div>

            <div className="space-y-3.5 pt-4">
              {agingBuckets.map(b => {
                const totalOutstandingAmt = Math.max(1, Number(kpi.totalOutstanding || 0));
                const bucketPct = (Number(b.amount) / totalOutstandingAmt) * 100;

                const bucketColor = {
                  'Current': 'bg-emerald-500',
                  '0-30': 'bg-amber-500',
                  '31-60': 'bg-orange-500',
                  '61-90': 'bg-rose-500',
                  '90+': 'bg-red-700'
                }[b.age_bucket] || 'bg-slate-500';

                return (
                  <div 
                    key={b.age_bucket} 
                    onClick={() => navigate('/finance/aging')}
                    className="cursor-pointer group"
                  >
                    <div className="flex justify-between items-center text-xs mb-1">
                      <span className="font-semibold text-slate-700 dark:text-slate-300 group-hover:text-primary transition-colors flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${bucketColor}`} />
                        {b.age_bucket === 'Current' ? 'Within Credit Terms' : `${b.age_bucket} Days Overdue`}
                        <span className="text-[10px] text-slate-400">({b.count})</span>
                      </span>
                      <div className="text-right">
                        <span className="font-extrabold text-slate-900 dark:text-white font-mono">
                          {formatINR(b.amount)}
                        </span>
                        <span className="text-[10px] text-slate-400 ml-1.5 font-mono">
                          {bucketPct.toFixed(0)}%
                        </span>
                      </div>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${bucketColor}`}
                        style={{ width: `${Math.min(100, bucketPct)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 mt-3">
            <div className="flex justify-between items-center text-xs text-slate-500 mb-2">
              <span>Past Credit Terms:</span>
              <span className="font-bold text-rose-600 font-mono">
                {formatINR(kpi.overdueAmount)} ({ratios.overdueRatio}%)
              </span>
            </div>
            <button
              onClick={() => navigate('/finance/aging')}
              className="w-full py-2 rounded-lg border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center justify-center gap-1"
            >
              Open Full Aging & Ledger Matrix <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* 6. SECOND ROW: EXPENSE BREAKDOWN & TREASURY CASH BALANCES */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4" id="treasury-section">
        {/* Treasury: Cash & Bank Accounts (2 Cols) */}
        <div className="lg:col-span-2 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-1.5">
                <Landmark className="w-4 h-4 text-emerald-600" />
                Treasury & Liquid Cash Balances
              </h3>
              <p className="text-[11px] text-slate-400">Available bank accounts, factory petty cash & digital wallets</p>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-slate-400 block uppercase font-bold">Total Liquid Reserves</span>
              <span className="font-black font-mono text-emerald-600 text-sm sm:text-base">
                {formatINR(kpi.totalLiquidCash)}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-1">
            {bankBalances.map((acc) => {
              const typeIcon = {
                BANK: Landmark,
                CASH: Banknote,
                UPI: CreditCard,
                WALLET: Wallet
              }[acc.type] || Landmark;
              const AccIcon = typeIcon;

              return (
                <div 
                  key={acc.id}
                  className="p-3 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="p-1 rounded bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 shadow-2xs">
                      <AccIcon className="w-4 h-4 text-emerald-600" />
                    </span>
                    <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300">
                      {acc.type}
                    </span>
                  </div>
                  <div>
                    <div className="font-bold text-xs text-slate-900 dark:text-white truncate" title={acc.name}>
                      {acc.name}
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono truncate">
                      {acc.account_number || acc.ifsc_code || 'Direct Ledger'}
                    </div>
                  </div>
                  <div className="pt-1 border-t border-slate-200 dark:border-slate-700/60 flex items-baseline justify-between">
                    <span className="text-[10px] text-slate-400">Balance:</span>
                    <span className="font-black font-mono text-slate-900 dark:text-white text-xs">
                      {formatINR(acc.current_balance)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between text-xs pt-2">
            <span className="text-slate-400 text-[11px]">
              Ready for immediate allocation to vendor purchase orders and statutory expenses
            </span>
            <button
              onClick={() => navigate('/finance/gst')}
              className="font-bold text-primary hover:underline flex items-center gap-1"
            >
              View Cash & Bank Book <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Expense Category Donut / Share (1 Col) */}
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-1.5">
                  <PieChartIcon className="w-4 h-4 text-purple-600" />
                  Expense Category Distribution
                </h3>
                <p className="text-[11px] text-slate-400">OPEX spend by department / head</p>
              </div>
              <button
                onClick={() => navigate('/finance/expenses')}
                className="text-xs font-bold text-primary hover:underline flex items-center gap-0.5"
              >
                OPEX <ArrowUpRight className="w-3 h-3" />
              </button>
            </div>

            {expenseShares.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400">
                No categorized operating expenses recorded yet
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row items-center justify-center gap-2 pt-2">
                <div className="w-36 h-36 relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={expenseShares}
                        dataKey="total_amount"
                        nameKey="category"
                        cx="50%"
                        cy="50%"
                        innerRadius={36}
                        outerRadius={58}
                        paddingAngle={3}
                      >
                        {expenseShares.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={DONUT_COLORS[index % DONUT_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v) => formatINR(v)} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div className="flex-1 space-y-1.5 w-full text-xs">
                  {expenseShares.slice(0, 4).map((entry, index) => (
                    <div key={index} className="flex justify-between items-center">
                      <span className="flex items-center gap-1.5 truncate max-w-[120px] text-slate-700 dark:text-slate-300">
                        <span 
                          className="w-2 h-2 rounded-full shrink-0" 
                          style={{ backgroundColor: DONUT_COLORS[index % DONUT_COLORS.length] }} 
                        />
                        <span className="truncate" title={entry.category}>{entry.category}</span>
                      </span>
                      <span className="font-bold font-mono text-slate-900 dark:text-white">
                        {formatINR(entry.total_amount)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <button
            onClick={() => navigate('/finance/expenses')}
            className="w-full mt-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center justify-center gap-1"
          >
            Manage All Expenses <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 7. THIRD ROW: TOP CREDITORS & DEBTORS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top Suppliers (Creditors) */}
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-rose-600" />
                Top Payables Exposure (Creditors)
              </h3>
              <p className="text-[11px] text-slate-400">Largest supplier liabilities awaiting settlement</p>
            </div>
            <button
              onClick={() => navigate('/finance/aging?type=SUPPLIER')}
              className="text-xs font-bold text-primary hover:underline flex items-center gap-0.5"
            >
              All Creditors <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-2">
            {topSuppliers.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">
                ✓ No supplier payables outstanding!
              </div>
            ) : (
              topSuppliers.map((s, idx) => {
                const totalPayables = Math.max(1, Number(payableSplit.total_outstanding || 1));
                const sharePct = (Number(s.outstanding) / totalPayables) * 100;

                return (
                  <div
                    key={idx}
                    onClick={() => navigate(`/finance/documents?party_id=${encodeURIComponent(s.party_name)}`)}
                    className="p-2.5 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center justify-between cursor-pointer text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-5 h-5 rounded-full bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-400 flex items-center justify-center font-bold text-[10px] shrink-0">
                        {idx + 1}
                      </span>
                      <div className="min-w-0">
                        <div className="font-bold text-slate-900 dark:text-white truncate" title={s.party_name}>
                          {s.party_name}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {sharePct.toFixed(1)}% of total supplier exposure
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="font-black font-mono text-rose-600 dark:text-rose-400">
                        {formatINR(s.outstanding)}
                      </div>
                      <span className="text-[10px] text-slate-400 flex items-center justify-end gap-0.5 hover:text-primary">
                        View Docs <ArrowUpRight className="w-2.5 h-2.5" />
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Top Customers (Debtors) */}
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-1.5">
                <User className="w-4 h-4 text-emerald-600" />
                Top Receivables Exposure (Debtors)
              </h3>
              <p className="text-[11px] text-slate-400">Customer balances due for collections</p>
            </div>
            <button
              onClick={() => navigate('/finance/aging?type=CUSTOMER')}
              className="text-xs font-bold text-primary hover:underline flex items-center gap-0.5"
            >
              All Debtors <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-2">
            {topCustomers.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">
                ✓ No customer receivables outstanding!
              </div>
            ) : (
              topCustomers.map((c, idx) => {
                const totalReceivables = Math.max(1, Number(receivableSplit.total_outstanding || 1));
                const sharePct = (Number(c.receivable) / totalReceivables) * 100;

                return (
                  <div
                    key={idx}
                    onClick={() => navigate(`/finance/documents?party_id=${encodeURIComponent(c.party_name)}`)}
                    className="p-2.5 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center justify-between cursor-pointer text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 flex items-center justify-center font-bold text-[10px] shrink-0">
                        {idx + 1}
                      </span>
                      <div className="min-w-0">
                        <div className="font-bold text-slate-900 dark:text-white truncate" title={c.party_name}>
                          {c.party_name}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {sharePct.toFixed(1)}% of customer book
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="font-black font-mono text-emerald-600 dark:text-emerald-400">
                        {formatINR(c.receivable)}
                      </div>
                      <span className="text-[10px] text-slate-400 flex items-center justify-end gap-0.5 hover:text-primary">
                        View Docs <ArrowUpRight className="w-2.5 h-2.5" />
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* 8. FOURTH ROW: ACTION CENTER & RECENT TRANSACTIONS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Critical Attention Queue */}
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                Urgent Action Items & Attention Queue
              </h3>
              <p className="text-[11px] text-slate-400">Overdue bills, completed orders awaiting payment release</p>
            </div>
            <button
              onClick={() => navigate('/finance/documents?status=OVERDUE')}
              className="text-xs font-bold text-rose-600 hover:underline flex items-center gap-0.5"
            >
              Overdue List ({kpi.overdueCount}) <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
            {attentionItems.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                ✓ No urgent overdue or blocking items requiring attention!
              </div>
            ) : (
              attentionItems.map((item, idx) => (
                <div 
                  key={idx}
                  className="p-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-extrabold text-slate-900 dark:text-white font-mono">
                        {item.doc_no}
                      </span>
                      <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                        {item.doc_type}
                      </span>
                      <span className="text-slate-500 truncate max-w-[180px]" title={item.party_name}>
                        • {item.party_name}
                      </span>
                    </div>
                    <div className="text-[11px] text-rose-600 dark:text-rose-400 font-semibold mt-1 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3 shrink-0" />
                      {item.alert_reason}
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                    <div className="text-left sm:text-right">
                      <div className="font-black font-mono text-slate-900 dark:text-white">
                        {formatINR(item.balance)}
                      </div>
                      <span className="text-[10px] text-slate-400 block">Due: {formatDate(item.due_date)}</span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleItemAction(item)}
                        className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] transition-all flex items-center gap-1 cursor-pointer"
                        title="Settle Payment in Original Order"
                      >
                        <CreditCard className="w-3 h-3" /> Pay Now
                      </button>
                      <button
                        onClick={() => navigate('/finance/documents')}
                        className="p-1 rounded border border-slate-200 dark:border-slate-700 hover:bg-white text-slate-500 hover:text-slate-900 cursor-pointer"
                        title="View Document Details"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Realized Payments Feed */}
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-1.5">
                <Activity className="w-4 h-4 text-emerald-600" />
                Recent Realized Transactions
              </h3>
              <p className="text-[11px] text-slate-400">Live feed of payments & settlements recorded in ERP</p>
            </div>
            <button
              onClick={() => navigate('/finance/gst')}
              className="text-xs font-bold text-primary hover:underline flex items-center gap-0.5"
            >
              Full Ledger <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
            {recentPayments.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                No recent payment transactions recorded
              </div>
            ) : (
              recentPayments.map((pay) => (
                <div
                  key={pay.id}
                  className="p-2.5 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 flex items-center justify-between text-xs"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 dark:text-white font-mono">
                        {pay.payment_no}
                      </span>
                      <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                        pay.direction === 'IN' ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'
                      }`}>
                        {pay.mode}
                      </span>
                      <span className="text-slate-500 truncate max-w-[140px]" title={pay.party_name}>
                        {pay.party_name}
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5 font-mono">
                      {formatDate(pay.pay_date)} • {pay.account_name} {pay.reference_no ? `• Ref: ${pay.reference_no}` : ''}
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className={`font-black font-mono ${
                      pay.direction === 'IN' ? 'text-emerald-600' : 'text-slate-900 dark:text-white'
                    }`}>
                      {pay.direction === 'IN' ? '+' : '-'}{formatINR(pay.amount)}
                    </div>
                    <span className="text-[10px] text-slate-400 font-semibold">
                      {pay.direction === 'IN' ? 'Received' : 'Paid Out'}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* 9. RECORD PAYMENT MODAL */}
      <RecordPaymentModal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        onSuccess={fetchDashboard}
        prefill={paymentPrefill}
      />
    </div>
  );
}