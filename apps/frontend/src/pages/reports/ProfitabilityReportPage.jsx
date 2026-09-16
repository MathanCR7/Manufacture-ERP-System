import React, { useState, useEffect } from 'react';
import { api } from '@/lib/axios';
import { 
  DollarSign, Download, FileSpreadsheet, FileText, Search, RefreshCw, 
  TrendingUp, Percent, ArrowUpRight, Layers, BarChart2, GitCommit
} from 'lucide-react';
import { 
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip as RechartsTooltip, Legend, Cell 
} from 'recharts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Pagination } from '@/components/ui/Pagination';
import DateRangeFilter from '@/components/reports/DateRangeFilter';
import ReportViewSwitcher from '@/components/reports/ReportViewSwitcher';
import { exportToCSV, exportToExcel, exportToPDF } from '@/utils/reportExportUtils';
import useCompanyStore from '@/app/store/companyStore';

export default function ProfitabilityReportPage() {
  const companyName = useCompanyStore(s => s.company?.companyName) || 'Manufacturing ERP';

  const [dateFilter, setDateFilter] = useState({
    preset: 'this_month',
    startDate: '',
    endDate: ''
  });
  const [viewMode, setViewMode] = useState('both');
  const [chartMode, setChartMode] = useState('waterfall'); // 'waterfall', 'grouped', 'margin'
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [reportData, setReportData] = useState({ data: [], aggregates: {}, pagination: {}, filterInfo: {} });
  const [currentPage, setCurrentPage] = useState(1);

  const fetchReport = async (page = currentPage) => {
    setLoading(true);
    try {
      const params = {
        page,
        pageSize: 20,
        datePreset: dateFilter.preset,
        startDate: dateFilter.startDate || undefined,
        endDate: dateFilter.endDate || undefined
      };
      const res = await api.get('/reports/profitability', { params });
      setReportData(res.data || { data: [], aggregates: {}, pagination: {}, filterInfo: {} });
    } catch (err) {
      console.error('Failed to load profitability report', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport(1);
    setCurrentPage(1);
  }, [dateFilter]);

  const handlePageChange = (p) => {
    setCurrentPage(p);
    fetchReport(p);
  };

  const aggs = reportData.aggregates || {};
  let items = reportData.data || [];

  if (searchTerm.trim()) {
    const q = searchTerm.toLowerCase();
    items = items.filter(r => 
      (r.name && r.name.toLowerCase().includes(q)) ||
      (r.code && r.code.toLowerCase().includes(q)) ||
      (r.categoryName && r.categoryName.toLowerCase().includes(q))
    );
  }

  // 1. Waterfall Chart Dataset: Revenue -> Less: COGS -> = Gross Profit
  const totalRev = Number(aggs.totalRevenue || 0);
  const totalCogs = Number(aggs.totalCOGS || 0);
  const totalProfit = Number(aggs.totalGrossProfit || 0);

  const waterfallData = [
    {
      step: '1. Revenue',
      base: 0,
      amount: totalRev,
      fill: '#10b981',
      type: 'Revenue Inflow',
      displayVal: `+₹${totalRev.toLocaleString('en-IN')}`
    },
    {
      step: '2. Less: COGS',
      base: Math.max(0, totalProfit),
      amount: totalCogs,
      fill: '#ef4444',
      type: 'Direct Cost Outflow',
      displayVal: `-₹${totalCogs.toLocaleString('en-IN')}`
    },
    {
      step: '3. Gross Profit',
      base: 0,
      amount: Math.max(0, totalProfit),
      fill: '#6366f1',
      type: 'Net Realized Margin',
      displayVal: `₹${totalProfit.toLocaleString('en-IN')}`
    }
  ];

  // 2. Grouped Comparison Dataset (Top products: Revenue vs COGS vs Profit)
  const profitabilityBarData = items.slice(0, 6).map(p => ({
    name: p.name.length > 9 ? `${p.name.substring(0, 9)}...` : p.name,
    fullName: p.name,
    revenue: Number(p.totalRevenue || 0),
    cogs: Number(p.totalCOGS || 0),
    profit: Number(p.grossProfit || 0)
  }));

  // 3. Margin % Comparison Dataset
  const marginBarData = items.slice(0, 7).map(p => ({
    name: p.name.length > 11 ? `${p.name.substring(0, 11)}...` : p.name,
    margin: Number(p.grossMarginPercent || 0)
  }));

  const columns = [
    { header: 'Product Code', accessor: (r) => r.code || 'N/A' },
    { header: 'Product Name', accessor: (r) => r.name || '' },
    { header: 'Category', accessor: (r) => r.categoryName || 'General' },
    { header: 'Units Sold', accessor: (r) => Number(r.unitsSold || 0).toLocaleString() },
    { header: 'Selling Price', accessor: (r) => `₹${Number(r.salePrice || 0).toFixed(2)}` },
    { header: 'Unit Cost', accessor: (r) => `₹${Number(r.unitCost || 0).toFixed(2)}` },
    { header: 'Gross Revenue', accessor: (r) => `₹${Number(r.totalRevenue || 0).toLocaleString('en-IN')}` },
    { header: 'Total COGS', accessor: (r) => `₹${Number(r.totalCOGS || 0).toLocaleString('en-IN')}` },
    { header: 'Gross Profit', accessor: (r) => `₹${Number(r.grossProfit || 0).toLocaleString('en-IN')}` },
    { header: 'Gross Margin %', accessor: (r) => `${Number(r.grossMarginPercent || 0).toFixed(1)}%` }
  ];

  const handleExportCSV = () => {
    exportToCSV('Product_Profitability_Analysis_Report', columns, items);
  };

  const handleExportExcel = () => {
    exportToExcel('Product_Profitability_Analysis_Report', 'Profitability', columns, items);
  };

  const handleExportPDF = () => {
    exportToPDF({
      title: 'Product Line Profitability & Margin Analysis Report',
      subtitle: `Period: ${reportData.filterInfo?.label || 'Custom'} | Total Revenue: ₹${Number(aggs.totalRevenue || 0).toLocaleString('en-IN')}`,
      columns,
      data: items,
      companyName,
      summaryCards: [
        { label: 'Total Revenue', value: `₹${Number(aggs.totalRevenue || 0).toLocaleString('en-IN')}` },
        { label: 'Total COGS', value: `₹${Number(aggs.totalCOGS || 0).toLocaleString('en-IN')}` },
        { label: 'Gross Profit', value: `₹${Number(aggs.totalGrossProfit || 0).toLocaleString('en-IN')}` },
        { label: 'Gross Margin %', value: `${Number(aggs.overallGrossMargin || 0).toFixed(1)}%` }
      ]
    });
  };

  const getMarginBadge = (margin) => {
    const val = Number(margin || 0);
    if (val >= 30) {
      return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800';
    } else if (val >= 15) {
      return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800';
    } else if (val > 0) {
      return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800';
    } else {
      return 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800 font-bold';
    }
  };

  return (
    <div className="w-full max-w-full px-3 sm:px-5 py-3 space-y-3 mx-auto text-xs">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 pb-2.5 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-emerald-500 shrink-0" />
              Profitability &amp; Gross Margin Analysis
            </h1>
            <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
              Admin &amp; Accountant
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Evaluate product revenue vs. Cost of Goods Sold (COGS), gross margins, top revenue drivers, and profitability breakdown.
          </p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          <ReportViewSwitcher viewMode={viewMode} onChange={setViewMode} />
          <Button
            variant="outline"
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 h-8 rounded-lg border-slate-200 dark:border-slate-800 text-xs font-semibold px-2.5"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-500" />
            <span>CSV</span>
          </Button>
          <Button
            variant="outline"
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 h-8 rounded-lg border-slate-200 dark:border-slate-800 text-xs font-semibold px-2.5"
          >
            <Download className="w-3.5 h-3.5 text-blue-500" />
            <span>Excel</span>
          </Button>
          <Button
            onClick={handleExportPDF}
            className="flex items-center gap-1.5 h-8 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs px-2.5"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Print PDF</span>
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-3">
        <Card className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl shadow-xs">
          <CardContent className="p-3 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Gross Sales Revenue</p>
              <h3 className="text-base sm:text-xl font-black text-indigo-600 dark:text-indigo-400 mt-0.5">
                ₹{Number(aggs.totalRevenue || 0).toLocaleString('en-IN')}
              </h3>
              <p className="text-[10px] text-slate-500 mt-0.5">{aggs.totalProducts || 0} active products</p>
            </div>
            <div className="p-2 bg-indigo-500/10 text-indigo-500 rounded-lg">
              <TrendingUp className="w-4 h-4" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl shadow-xs">
          <CardContent className="p-3 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total COGS</p>
              <h3 className="text-base sm:text-xl font-black text-slate-700 dark:text-slate-300 mt-0.5">
                ₹{Number(aggs.totalCOGS || 0).toLocaleString('en-IN')}
              </h3>
              <p className="text-[10px] text-slate-500 mt-0.5">Direct production cost</p>
            </div>
            <div className="p-2 bg-slate-500/10 text-slate-500 rounded-lg">
              <Layers className="w-4 h-4" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl shadow-xs">
          <CardContent className="p-3 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Gross Profit</p>
              <h3 className="text-base sm:text-xl font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
                ₹{Number(aggs.totalGrossProfit || 0).toLocaleString('en-IN')}
              </h3>
              <p className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-0.5 flex items-center gap-0.5">
                <ArrowUpRight className="w-3 h-3" />
                Revenue − Cost
              </p>
            </div>
            <div className="p-2 bg-emerald-500/10 text-emerald-500 rounded-lg">
              <DollarSign className="w-4 h-4" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl shadow-xs">
          <CardContent className="p-3 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Overall Margin %</p>
              <h3 className="text-base sm:text-xl font-black text-purple-600 dark:text-purple-400 mt-0.5">
                {Number(aggs.overallGrossMargin || 0).toFixed(1)}%
              </h3>
              <p className="text-[10px] text-slate-500 mt-0.5 truncate max-w-[130px]">Top: {aggs.topProduct || 'N/A'}</p>
            </div>
            <div className="p-2 bg-purple-500/10 text-purple-500 rounded-lg">
              <Percent className="w-4 h-4" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Date Filter & Search */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 bg-white dark:bg-slate-900 p-2 sm:p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
        <DateRangeFilter
          value={dateFilter}
          onChange={setDateFilter}
        />

        <div className="flex items-center gap-2">
          <div className="relative w-full sm:w-60">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search product code or name..."
              className="h-8 pl-8 text-xs rounded-lg bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700"
            />
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => fetchReport(currentPage)}
            disabled={loading}
            className="h-8 w-8 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* CHART VIEW (Waterfall Profit Flow + Comparison Bar) */}
      {(viewMode === 'chart' || viewMode === 'both') && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          {/* Main Chart: Waterfall Breakdown OR Product Grouped Comparison */}
          <Card className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl shadow-xs p-3 sm:p-3.5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
              <div>
                <h3 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                  <BarChart2 className="w-4 h-4 text-emerald-500" />
                  {chartMode === 'waterfall' ? 'Profitability Waterfall: Revenue → COGS → Gross Margin' : 'Revenue vs COGS vs Gross Profit by Product'}
                </h3>
                <p className="text-[10.5px] text-slate-500 dark:text-slate-400">
                  {chartMode === 'waterfall' ? 'Flow analysis: Starting revenue less direct manufacturing costs to net gross profit' : 'Product-level profitability side-by-side'}
                </p>
              </div>

              {/* Chart Mode Switcher */}
              <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700 self-start sm:self-auto">
                <button
                  onClick={() => setChartMode('waterfall')}
                  className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-all ${
                    chartMode === 'waterfall'
                      ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-xs'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Waterfall Flow
                </button>
                <button
                  onClick={() => setChartMode('grouped')}
                  className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-all ${
                    chartMode === 'grouped'
                      ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-xs'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Product Bar
                </button>
              </div>
            </div>

            <div className="h-52 sm:h-56 w-full">
              {items.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  {chartMode === 'waterfall' ? (
                    /* Waterfall Chart using stacked invisible base + floating step bars */
                    <BarChart data={waterfallData} margin={{ top: 10, right: 15, left: 10, bottom: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.15} />
                      <XAxis dataKey="step" tick={{ fontSize: 10, fontWeight: 600 }} stroke="#64748b" />
                      <YAxis tick={{ fontSize: 9 }} stroke="#64748b" tickFormatter={(v) => `₹${v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}`} />
                      <RechartsTooltip 
                        formatter={(_, __, props) => [props.payload.displayVal, props.payload.type]}
                        contentStyle={{ backgroundColor: '#0f172a', borderRadius: '8px', border: '1px solid #334155', color: '#fff', fontSize: '11px', padding: '6px 10px' }}
                      />
                      {/* Invisible transparent base that lifts the deduction bar */}
                      <Bar dataKey="base" stackId="waterfall" fill="transparent" />
                      {/* Colored step amount bar */}
                      <Bar dataKey="amount" stackId="waterfall" radius={[4, 4, 0, 0]}>
                        {waterfallData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  ) : (
                    /* Grouped Comparison Bar Chart */
                    <BarChart data={profitabilityBarData} margin={{ top: 5, right: 10, left: 10, bottom: 15 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.15} />
                      <XAxis dataKey="name" tick={{ fontSize: 9 }} angle={-20} textAnchor="end" stroke="#64748b" />
                      <YAxis tick={{ fontSize: 9 }} stroke="#64748b" tickFormatter={(v) => `₹${v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}`} />
                      <RechartsTooltip 
                        formatter={(val) => [`₹${Number(val).toLocaleString('en-IN')}`]}
                        contentStyle={{ backgroundColor: '#0f172a', borderRadius: '8px', border: '1px solid #334155', color: '#fff', fontSize: '11px', padding: '6px 10px' }}
                      />
                      <Legend verticalAlign="top" height={24} iconSize={8} wrapperStyle={{ fontSize: '11px' }} />
                      <Bar dataKey="revenue" name="Revenue" fill="#6366f1" radius={[3, 3, 0, 0]} />
                      <Bar dataKey="cogs" name="COGS" fill="#94a3b8" radius={[3, 3, 0, 0]} />
                      <Bar dataKey="profit" name="Gross Profit" fill="#10b981" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  )}
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-slate-400 text-xs">
                  No profitability data recorded.
                </div>
              )}
            </div>
          </Card>

          {/* Secondary Ranking Bar: Product Gross Margin % */}
          <Card className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl shadow-xs p-3 sm:p-3.5">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h3 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Percent className="w-4 h-4 text-purple-500" />
                  Product Margin % Ranking
                </h3>
                <p className="text-[10.5px] text-slate-500 dark:text-slate-400">Margin contribution per product line</p>
              </div>
            </div>
            <div className="h-52 sm:h-56 w-full">
              {marginBarData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={marginBarData} margin={{ top: 5, right: 10, left: -10, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.15} />
                    <XAxis dataKey="name" tick={{ fontSize: 9 }} angle={-20} textAnchor="end" stroke="#64748b" />
                    <YAxis tick={{ fontSize: 9 }} stroke="#64748b" tickFormatter={(v) => `${v}%`} />
                    <RechartsTooltip 
                      formatter={(val) => [`${Number(val).toFixed(1)}%`, 'Gross Margin']}
                      contentStyle={{ backgroundColor: '#0f172a', borderRadius: '8px', border: '1px solid #334155', color: '#fff', fontSize: '11px', padding: '6px 10px' }}
                    />
                    <Bar dataKey="margin" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-slate-400 text-xs">
                  No margin data available.
                </div>
              )}
            </div>
          </Card>
        </div>
      )}

      {/* TABLE VIEW */}
      {(viewMode === 'table' || viewMode === 'both') && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[11.5px] border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/75 dark:bg-slate-800/40 text-slate-500 dark:text-slate-400 font-semibold uppercase text-[10px] tracking-wider">
                  <th className="py-2.5 px-3">Product</th>
                  <th className="py-2.5 px-3">Category</th>
                  <th className="py-2.5 px-3 text-right">Units Sold</th>
                  <th className="py-2.5 px-3 text-right">Sale Price</th>
                  <th className="py-2.5 px-3 text-right">Unit Cost</th>
                  <th className="py-2.5 px-3 text-right">Gross Revenue</th>
                  <th className="py-2.5 px-3 text-right">Total COGS</th>
                  <th className="py-2.5 px-3 text-right">Gross Profit</th>
                  <th className="py-2.5 px-3 text-center">Margin %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td colSpan={9} className="py-3 px-3 bg-slate-50/50 dark:bg-slate-800/20">
                        <div className="h-3.5 bg-slate-200 dark:bg-slate-700 rounded w-full"></div>
                      </td>
                    </tr>
                  ))
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-slate-400 dark:text-slate-500">
                      <DollarSign className="w-8 h-8 mx-auto mb-1.5 opacity-30" />
                      No product profitability records found for this period.
                    </td>
                  </tr>
                ) : (
                  items.map((row) => (
                    <tr key={row.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="py-2 px-3">
                        <span className="font-semibold text-slate-900 dark:text-white block">{row.name}</span>
                        <span className="text-[10px] text-slate-400 font-mono">{row.code}</span>
                      </td>
                      <td className="py-2 px-3 text-slate-600 dark:text-slate-300">{row.categoryName}</td>
                      <td className="py-2 px-3 text-right text-slate-800 dark:text-slate-200 font-semibold">
                        {Number(row.unitsSold).toLocaleString()}
                      </td>
                      <td className="py-2 px-3 text-right text-slate-600 dark:text-slate-300">
                        ₹{Number(row.salePrice).toFixed(2)}
                      </td>
                      <td className="py-2 px-3 text-right text-slate-600 dark:text-slate-300">
                        ₹{Number(row.unitCost).toFixed(2)}
                      </td>
                      <td className="py-2 px-3 text-right font-semibold text-slate-900 dark:text-white">
                        ₹{Number(row.totalRevenue).toLocaleString('en-IN')}
                      </td>
                      <td className="py-2 px-3 text-right text-slate-600 dark:text-slate-300">
                        ₹{Number(row.totalCOGS).toLocaleString('en-IN')}
                      </td>
                      <td className={`py-2 px-3 text-right font-bold ${
                        row.grossProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                      }`}>
                        ₹{Number(row.grossProfit).toLocaleString('en-IN')}
                      </td>
                      <td className="py-2 px-3 text-center">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] border ${getMarginBadge(row.grossMarginPercent)}`}>
                          {Number(row.grossMarginPercent).toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* High-density Pagination Footer */}
          <div className="px-3 py-2 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40">
            <Pagination
              currentPage={reportData.pagination?.page || currentPage}
              totalPages={reportData.pagination?.totalPages || 1}
              totalRecords={reportData.pagination?.totalRecords || items.length}
              pageSize={reportData.pagination?.pageSize || 20}
              onPageChange={handlePageChange}
            />
          </div>
        </div>
      )}
    </div>
  );
}
