import React, { useState, useEffect } from 'react';
import { api } from '@/lib/axios';
import { 
  Trophy, Award, Snail, Download, FileSpreadsheet, FileText, 
  RefreshCw, TrendingUp, Layers, DollarSign, Package, BarChart2, PieChart as PieIcon
} from 'lucide-react';
import { 
  ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, 
  CartesianGrid, Tooltip as RechartsTooltip, Legend 
} from 'recharts';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Pagination } from '@/components/ui/Pagination';
import DateRangeFilter from '@/components/reports/DateRangeFilter';
import ReportViewSwitcher from '@/components/reports/ReportViewSwitcher';
import { exportToCSV, exportToExcel, exportToPDF } from '@/utils/reportExportUtils';
import useCompanyStore from '@/app/store/companyStore';

const COLOR_SERIES = ['#f59e0b', '#6366f1', '#10b981', '#06b6d4', '#ec4899', '#8b5cf6'];

export default function ProductPerformanceReportPage() {
  const companyName = useCompanyStore(s => s.company?.companyName) || 'Manufacturing ERP';

  const [dateFilter, setDateFilter] = useState({ datePreset: 'this_month', startDate: '', endDate: '' });
  const [viewMode, setViewMode] = useState('both');
  const [sortBy, setSortBy] = useState('quantity'); // 'quantity' or 'revenue'
  const [limit, setLimit] = useState(50);
  const [activeTab, setActiveTab] = useState('both'); // 'both', 'top', 'least'
  const [loading, setLoading] = useState(true);
  const [reportData, setReportData] = useState({ topSelling: [], leastSelling: [], aggregates: {}, filterInfo: {} });

  // Client-side pagination state for each section
  const [topPage, setTopPage] = useState(1);
  const [leastPage, setLeastPage] = useState(1);
  const pageSize = 10;

  const fetchReport = async () => {
    setLoading(true);
    try {
      const params = {
        datePreset: dateFilter.datePreset,
        startDate: dateFilter.startDate,
        endDate: dateFilter.endDate,
        sortBy,
        limit
      };
      const res = await api.get('/reports/product-performance', { params });
      setReportData(res.data || { topSelling: [], leastSelling: [], aggregates: {}, filterInfo: {} });
    } catch (err) {
      console.error('Failed to load product performance report', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
    setTopPage(1);
    setLeastPage(1);
  }, [dateFilter, sortBy, limit]);

  const aggs = reportData.aggregates || {};
  const topList = reportData.topSelling || [];
  const leastList = reportData.leastSelling || [];

  // Paginated slices
  const paginatedTop = topList.slice((topPage - 1) * pageSize, topPage * pageSize);
  const paginatedLeast = leastList.slice((leastPage - 1) * pageSize, leastPage * pageSize);

  // Prepare chart data
  const topProductsChartData = topList.slice(0, 6).map(p => ({
    name: p.name.length > 11 ? `${p.name.substring(0, 11)}...` : p.name,
    revenue: Number(p.revenue || 0),
    units: Number(p.unitsSold || 0)
  }));

  const salesSharePieData = topList.slice(0, 5).map((p, idx) => ({
    name: p.name,
    value: Number(p.revenue || 0),
    color: COLOR_SERIES[idx % COLOR_SERIES.length]
  }));

  const columns = [
    { header: 'Rank', accessor: (r) => `#${r.rank}` },
    { header: 'Code', accessor: (r) => r.code || '' },
    { header: 'Product Name', accessor: (r) => r.name || '' },
    { header: 'Category', accessor: (r) => r.categoryName || 'General' },
    { header: 'Units Sold', accessor: (r) => `${r.unitsSold} ${r.unitSymbol}` },
    { header: 'Revenue (₹)', accessor: (r) => `₹${Number(r.revenue || 0).toLocaleString('en-IN')}` },
    { header: 'Share of Sales', accessor: (r) => `${r.shareOfSales}%` },
    { header: 'Stock On Hand', accessor: (r) => `${r.currentStock} ${r.unitSymbol}` }
  ];

  const handleExportCSV = () => {
    const combined = [
      ...topList.map(item => ({ ...item, performanceType: 'Top Selling' })),
      ...leastList.map(item => ({ ...item, performanceType: 'Slow Moving' }))
    ];
    exportToCSV('Product_Performance_Report', [
      { header: 'Category Type', accessor: (r) => r.performanceType },
      ...columns
    ], combined);
  };

  const handleExportExcel = () => {
    const combined = [
      ...topList.map(item => ({ ...item, performanceType: 'Top Selling' })),
      ...leastList.map(item => ({ ...item, performanceType: 'Slow Moving' }))
    ];
    exportToExcel('Product_Performance_Report', 'Performance', [
      { header: 'Category Type', accessor: (r) => r.performanceType },
      ...columns
    ], combined);
  };

  const handleExportPDF = () => {
    exportToPDF({
      title: 'Top & Least Selling Product Performance Report',
      subtitle: `Period: ${reportData.filterInfo?.label || 'Custom'} | Ranked by: ${sortBy === 'revenue' ? 'Revenue' : 'Units Sold'}`,
      columns,
      data: topList,
      companyName,
      summaryCards: [
        { label: 'Overall Revenue', value: `₹${Number(aggs.overallTotalRevenue || 0).toLocaleString('en-IN')}` },
        { label: 'Overall Units Sold', value: aggs.overallTotalUnits || '0' },
        { label: 'Top Bestseller', value: topList[0]?.name || 'N/A' },
        { label: 'Catalog Size', value: aggs.totalProducts || 0 }
      ]
    });
  };

  return (
    <div className="w-full max-w-full px-3 sm:px-5 py-3 space-y-3 mx-auto text-xs">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 pb-2.5 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-500 shrink-0" />
            Top &amp; Least Selling Products Report
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Identify your revenue drivers, high-velocity bestsellers, slow movers, and overstock risks.
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
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Overall Sales Revenue</p>
              <h3 className="text-base sm:text-xl font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
                ₹{Number(aggs.overallTotalRevenue || 0).toLocaleString('en-IN')}
              </h3>
            </div>
            <div className="p-2 bg-emerald-500/10 text-emerald-500 rounded-lg">
              <DollarSign className="w-4 h-4" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl shadow-xs">
          <CardContent className="p-3 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Units Dispatched</p>
              <h3 className="text-base sm:text-xl font-black text-indigo-600 dark:text-indigo-400 mt-0.5">
                {Number(aggs.overallTotalUnits || 0).toLocaleString()}
              </h3>
            </div>
            <div className="p-2 bg-indigo-500/10 text-indigo-500 rounded-lg">
              <Package className="w-4 h-4" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl shadow-xs">
          <CardContent className="p-3 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Top Velocity</p>
              <h3 className="text-xs sm:text-sm font-black text-amber-600 dark:text-amber-400 mt-0.5 truncate max-w-[130px]">
                {topList[0]?.name || 'N/A'}
              </h3>
            </div>
            <div className="p-2 bg-amber-500/10 text-amber-500 rounded-lg">
              <Trophy className="w-4 h-4" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl shadow-xs">
          <CardContent className="p-3 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Catalog Size</p>
              <h3 className="text-base sm:text-xl font-black text-slate-700 dark:text-slate-300 mt-0.5">
                {aggs.totalProducts || 0}
              </h3>
            </div>
            <div className="p-2 bg-slate-500/10 text-slate-500 rounded-lg">
              <Layers className="w-4 h-4" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter and Metric Toggles */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 bg-white dark:bg-slate-900 p-2 sm:p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
        <div className="flex flex-wrap items-center gap-2">
          <DateRangeFilter
            value={dateFilter}
            onChange={setDateFilter}
          />
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700">
            <button
              onClick={() => setSortBy('quantity')}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${
                sortBy === 'quantity'
                  ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-xs'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              By Qty
            </button>
            <button
              onClick={() => setSortBy('revenue')}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${
                sortBy === 'revenue'
                  ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-xs'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              By Revenue (₹)
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700">
            {['both', 'top', 'least'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold capitalize transition-all ${
                  activeTab === tab
                    ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-xs'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {tab === 'both' ? 'All' : tab === 'top' ? 'Top' : 'Slow Moving'}
              </button>
            ))}
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={fetchReport}
            disabled={loading}
            className="h-8 w-8 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* CHART VIEW (Shown when viewMode is 'chart' or 'both') */}
      {(viewMode === 'chart' || viewMode === 'both') && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          {/* Top Sellers Bar Chart */}
          <Card className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl shadow-xs p-3 sm:p-3.5">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h3 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                  <BarChart2 className="w-4 h-4 text-amber-500" />
                  Top Selling Products: {sortBy === 'revenue' ? 'Revenue (₹)' : 'Units Sold'}
                </h3>
                <p className="text-[10.5px] text-slate-500 dark:text-slate-400">High-volume product revenue contributors</p>
              </div>
            </div>
            <div className="h-48 sm:h-52 w-full">
              {topProductsChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topProductsChartData} margin={{ top: 5, right: 10, left: 5, bottom: 15 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.15} />
                    <XAxis dataKey="name" tick={{ fontSize: 9 }} angle={-20} textAnchor="end" stroke="#64748b" />
                    <YAxis tick={{ fontSize: 10 }} stroke="#64748b" tickFormatter={(v) => sortBy === 'revenue' && v >= 1000 ? `₹${(v/1000).toFixed(0)}k` : v} />
                    <RechartsTooltip 
                      formatter={(val) => [sortBy === 'revenue' ? `₹${Number(val).toLocaleString('en-IN')}` : Number(val).toLocaleString(), sortBy === 'revenue' ? 'Revenue' : 'Units Sold']}
                      contentStyle={{ backgroundColor: '#0f172a', borderRadius: '8px', border: '1px solid #334155', color: '#fff', fontSize: '11px', padding: '6px 10px' }}
                    />
                    <Bar dataKey={sortBy === 'revenue' ? 'revenue' : 'units'} fill="#f59e0b" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-slate-400 text-xs">
                  No sales data found for this period.
                </div>
              )}
            </div>
          </Card>

          {/* Sales Share Donut Chart */}
          <Card className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl shadow-xs p-3 sm:p-3.5">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h3 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                  <PieIcon className="w-4 h-4 text-indigo-500" />
                  Revenue Contribution Share
                </h3>
                <p className="text-[10.5px] text-slate-500 dark:text-slate-400">Share among top bestsellers</p>
              </div>
            </div>
            <div className="h-48 sm:h-52 w-full flex items-center justify-center">
              {salesSharePieData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={salesSharePieData}
                      cx="50%"
                      cy="48%"
                      innerRadius={48}
                      outerRadius={70}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {salesSharePieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <RechartsTooltip 
                      formatter={(val) => [`₹${Number(val).toLocaleString('en-IN')}`, 'Revenue']}
                      contentStyle={{ backgroundColor: '#0f172a', borderRadius: '8px', border: '1px solid #334155', color: '#fff', fontSize: '11px', padding: '6px 10px' }}
                    />
                    <Legend 
                      verticalAlign="bottom" 
                      height={32} 
                      iconSize={8}
                      formatter={(val) => <span className="text-[10.5px] text-slate-600 dark:text-slate-300">{val.length > 10 ? `${val.substring(0, 10)}...` : val}</span>}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-slate-400 text-xs">No revenue data available.</div>
              )}
            </div>
          </Card>
        </div>
      )}

      {/* TABLE VIEW (Shown when viewMode is 'table' or 'both') */}
      {(viewMode === 'table' || viewMode === 'both') && (
        <div className="space-y-3">
          {/* Top Selling Products Table */}
          {(activeTab === 'both' || activeTab === 'top') && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl shadow-xs overflow-hidden">
              <div className="px-3 py-2 bg-slate-50/75 dark:bg-slate-800/40 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between">
                <h3 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Award className="w-4 h-4 text-amber-500" />
                  Top Performing Products
                </h3>
                <span className="text-[10px] text-slate-400">Total: {topList.length} products</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[11.5px] border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold uppercase text-[10px] tracking-wider bg-slate-50/50 dark:bg-slate-800/20">
                      <th className="py-2.5 px-3 text-center w-12">Rank</th>
                      <th className="py-2.5 px-3">Code</th>
                      <th className="py-2.5 px-3">Product Name</th>
                      <th className="py-2.5 px-3">Category</th>
                      <th className="py-2.5 px-3 text-right">Units Sold</th>
                      <th className="py-2.5 px-3 text-right">Total Revenue</th>
                      <th className="py-2.5 px-3 text-center">% of Sales</th>
                      <th className="py-2.5 px-3 text-right">Current Stock</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                    {paginatedTop.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="py-2 px-3 text-center font-bold">
                          <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[10.5px] ${
                            item.rank === 1 ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400' :
                            item.rank === 2 ? 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300' :
                            item.rank === 3 ? 'bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-500' :
                            'text-slate-400'
                          }`}>
                            #{item.rank}
                          </span>
                        </td>
                        <td className="py-2 px-3 font-mono text-slate-500 dark:text-slate-400 text-[10.5px]">{item.code}</td>
                        <td className="py-2 px-3 font-semibold text-slate-900 dark:text-white">{item.name}</td>
                        <td className="py-2 px-3 text-slate-500 dark:text-slate-400">{item.categoryName}</td>
                        <td className="py-2 px-3 text-right font-semibold text-slate-900 dark:text-white">
                          {Number(item.unitsSold).toLocaleString()} {item.unitSymbol}
                        </td>
                        <td className="py-2 px-3 text-right font-bold text-emerald-600 dark:text-emerald-400">
                          ₹{Number(item.revenue).toLocaleString('en-IN')}
                        </td>
                        <td className="py-2 px-3 text-center font-semibold text-indigo-600 dark:text-indigo-400">
                          {item.shareOfSales}%
                        </td>
                        <td className="py-2 px-3 text-right text-slate-600 dark:text-slate-300">
                          {Number(item.currentStock).toLocaleString()} {item.unitSymbol}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {/* Pagination footer for Top Products */}
              <div className="px-3 py-2 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40">
                <Pagination
                  currentPage={topPage}
                  totalPages={Math.max(1, Math.ceil(topList.length / pageSize))}
                  totalRecords={topList.length}
                  pageSize={pageSize}
                  onPageChange={setTopPage}
                />
              </div>
            </div>
          )}

          {/* Least Selling Products Table */}
          {(activeTab === 'both' || activeTab === 'least') && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl shadow-xs overflow-hidden">
              <div className="px-3 py-2 bg-slate-50/75 dark:bg-slate-800/40 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between">
                <h3 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Snail className="w-4 h-4 text-rose-500" />
                  Slow Moving &amp; Low-Velocity Products
                </h3>
                <span className="text-[10px] text-slate-400">Total: {leastList.length} products</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[11.5px] border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold uppercase text-[10px] tracking-wider bg-slate-50/50 dark:bg-slate-800/20">
                      <th className="py-2.5 px-3 text-center w-12">Rank</th>
                      <th className="py-2.5 px-3">Code</th>
                      <th className="py-2.5 px-3">Product Name</th>
                      <th className="py-2.5 px-3">Category</th>
                      <th className="py-2.5 px-3 text-right">Units Sold</th>
                      <th className="py-2.5 px-3 text-right">Total Revenue</th>
                      <th className="py-2.5 px-3 text-center">% of Sales</th>
                      <th className="py-2.5 px-3 text-right">Current Stock</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                    {paginatedLeast.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="py-2 px-3 text-center font-semibold text-slate-400">#{item.rank}</td>
                        <td className="py-2 px-3 font-mono text-slate-500 dark:text-slate-400 text-[10.5px]">{item.code}</td>
                        <td className="py-2 px-3 font-semibold text-slate-900 dark:text-white">{item.name}</td>
                        <td className="py-2 px-3 text-slate-500 dark:text-slate-400">{item.categoryName}</td>
                        <td className="py-2 px-3 text-right font-semibold text-slate-900 dark:text-white">
                          {Number(item.unitsSold).toLocaleString()} {item.unitSymbol}
                        </td>
                        <td className="py-2 px-3 text-right font-semibold text-slate-900 dark:text-white">
                          ₹{Number(item.revenue).toLocaleString('en-IN')}
                        </td>
                        <td className="py-2 px-3 text-center font-semibold text-slate-500">
                          {item.shareOfSales}%
                        </td>
                        <td className="py-2 px-3 text-right text-slate-600 dark:text-slate-300">
                          {Number(item.currentStock).toLocaleString()} {item.unitSymbol}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {/* Pagination footer for Least Products */}
              <div className="px-3 py-2 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40">
                <Pagination
                  currentPage={leastPage}
                  totalPages={Math.max(1, Math.ceil(leastList.length / pageSize))}
                  totalRecords={leastList.length}
                  pageSize={pageSize}
                  onPageChange={setLeastPage}
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
