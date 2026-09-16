import React, { useState, useEffect } from 'react';
import { api } from '@/lib/axios';
import { 
  Wheat, Download, FileSpreadsheet, FileText, Search, RefreshCw, 
  TrendingUp, AlertTriangle, Layers, DollarSign, Scale, BarChart2, PieChart as PieIcon
} from 'lucide-react';
import { 
  ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, 
  CartesianGrid, Tooltip as RechartsTooltip, Legend 
} from 'recharts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Pagination } from '@/components/ui/Pagination';
import DateRangeFilter from '@/components/reports/DateRangeFilter';
import ReportViewSwitcher from '@/components/reports/ReportViewSwitcher';
import { exportToCSV, exportToExcel, exportToPDF } from '@/utils/reportExportUtils';
import useCompanyStore from '@/app/store/companyStore';

export default function RMConsumptionReportPage() {
  const companyName = useCompanyStore(s => s.company?.companyName) || 'Manufacturing ERP';

  const [dateFilter, setDateFilter] = useState({ datePreset: 'this_month', startDate: '', endDate: '' });
  const [viewMode, setViewMode] = useState('both');
  const [chartMode, setChartMode] = useState('comparison'); // 'comparison', 'cost'
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [reportData, setReportData] = useState({ data: [], aggregates: {}, filterInfo: {}, pagination: {} });
  const [currentPage, setCurrentPage] = useState(1);

  const fetchReport = async (page = currentPage) => {
    setLoading(true);
    try {
      const params = {
        page,
        pageSize: 20,
        datePreset: dateFilter.datePreset,
        startDate: dateFilter.startDate,
        endDate: dateFilter.endDate
      };
      const res = await api.get('/reports/rm-consumption', { params });
      setReportData(res.data || { data: [], aggregates: {}, filterInfo: {}, pagination: {} });
    } catch (err) {
      console.error('Failed to load RM consumption report', err);
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
  const items = reportData.data || [];

  const filteredItems = items.filter(item => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    const rmName = (item.rawMaterial?.name || '').toLowerCase();
    const rmCode = (item.rawMaterial?.code || '').toLowerCase();
    const batchRef = (item.batch?.referenceNo || '').toLowerCase();
    return rmName.includes(term) || rmCode.includes(term) || batchRef.includes(term);
  });

  const materialUsageMap = {};
  filteredItems.forEach(item => {
    const name = item.rawMaterial?.name || 'Raw Material';
    if (!materialUsageMap[name]) {
      materialUsageMap[name] = { 
        name: name.length > 12 ? `${name.substring(0, 12)}...` : name, 
        fullName: name,
        required: 0, 
        actual: 0, 
        cost: 0 
      };
    }
    materialUsageMap[name].required += Number(item.requiredQty || 0);
    materialUsageMap[name].actual += Number(item.actualUsedQty || 0);
    materialUsageMap[name].cost += Number(item.totalCost || 0);
  });

  const topMaterialsChartData = Object.values(materialUsageMap)
    .sort((a, b) => b.actual - a.actual)
    .slice(0, 7);

  const scrapRatioData = [
    { name: 'Consumed Effectively', value: Math.max(0, 100 - Number(aggs.scrapLossPercentage || 0)), color: '#10b981' },
    { name: 'Scrap & Loss', value: Number(aggs.scrapLossPercentage || 0), color: '#ef4444' }
  ];

  const columns = [
    { header: 'Batch Ref', accessor: (r) => r.batch?.referenceNo || 'N/A' },
    { header: 'Batch Lot', accessor: (r) => r.batch?.batchNo || '-' },
    { header: 'Raw Material', accessor: (r) => `${r.rawMaterial?.name || ''} (${r.rawMaterial?.code || ''})` },
    { header: 'Category', accessor: (r) => r.rawMaterial?.category?.name || 'General' },
    { header: 'Req Qty', accessor: (r) => Number(r.requiredQty || 0).toFixed(2) },
    { header: 'Used Qty', accessor: (r) => `${Number(r.actualUsedQty || 0).toFixed(2)} ${r.rawMaterial?.consumptionUnit || ''}` },
    { header: 'Variance', accessor: (r) => (Number(r.actualUsedQty || 0) - Number(r.requiredQty || 0)).toFixed(2) },
    { header: 'Unit Cost', accessor: (r) => `₹${Number(r.unitCost || 0).toFixed(2)}` },
    { header: 'Total Cost', accessor: (r) => `₹${Number(r.totalCost || 0).toLocaleString('en-IN')}` },
    { header: 'Status', accessor: (r) => r.status || 'Sufficient' }
  ];

  const handleExportCSV = () => {
    exportToCSV('RM_Consumption_Report', columns, filteredItems);
  };

  const handleExportExcel = () => {
    exportToExcel('RM_Consumption_Report', 'RM Consumption', columns, filteredItems);
  };

  const handleExportPDF = () => {
    exportToPDF({
      title: 'Raw Material Consumption & Variance Report',
      subtitle: `Period: ${reportData.filterInfo?.label || 'Custom'} (${reportData.filterInfo?.startDate?.split('T')[0]} to ${reportData.filterInfo?.endDate?.split('T')[0]})`,
      columns,
      data: filteredItems,
      companyName,
      summaryCards: [
        { label: 'Total RM Cost', value: `₹${Number(aggs.totalRMCost || 0).toLocaleString('en-IN')}` },
        { label: 'Quantity Consumed', value: aggs.totalQuantityConsumed || '0' },
        { label: 'Variance Rate', value: `${aggs.variancePercentage || '0.00'}%` },
        { label: 'Scrap/Loss Rate', value: `${aggs.scrapLossPercentage || '0.00'}%` }
      ]
    });
  };

  return (
    <div className="w-full max-w-full px-3 sm:px-5 py-3 space-y-3 mx-auto text-xs">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 pb-2.5 border-b border-slate-200/80 dark:border-slate-800">
        <div>
          <h1 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <Wheat className="w-5 h-5 text-emerald-500 shrink-0" />
            Raw Material Consumption Report
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Compare planned BOM requirements vs. actual material usage, batch variances, and scrap ratios.
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
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total RM Cost</p>
              <h3 className="text-base sm:text-xl font-black text-slate-900 dark:text-white mt-0.5">
                ₹{Number(aggs.totalRMCost || 0).toLocaleString('en-IN')}
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
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Material Consumed</p>
              <h3 className="text-base sm:text-xl font-black text-slate-900 dark:text-white mt-0.5">
                {Number(aggs.totalQuantityConsumed || 0).toLocaleString()}
              </h3>
            </div>
            <div className="p-2 bg-blue-500/10 text-blue-500 rounded-lg">
              <Layers className="w-4 h-4" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl shadow-xs">
          <CardContent className="p-3 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Variance Rate</p>
              <h3 className={`text-base sm:text-xl font-black mt-0.5 ${
                Number(aggs.variancePercentage || 0) > 0 ? 'text-amber-500' : 'text-emerald-500'
              }`}>
                {aggs.variancePercentage || '0.00'}%
              </h3>
            </div>
            <div className="p-2 bg-amber-500/10 text-amber-500 rounded-lg">
              <Scale className="w-4 h-4" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl shadow-xs">
          <CardContent className="p-3 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Scrap / Loss Rate</p>
              <h3 className={`text-base sm:text-xl font-black mt-0.5 ${
                Number(aggs.scrapLossPercentage || 0) > 3 ? 'text-rose-500' : 'text-slate-700 dark:text-slate-300'
              }`}>
                {aggs.scrapLossPercentage || '0.00'}%
              </h3>
            </div>
            <div className="p-2 bg-rose-500/10 text-rose-500 rounded-lg">
              <AlertTriangle className="w-4 h-4" />
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
              placeholder="Search RM code, name or batch..."
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

      {/* CHART VIEW */}
      {(viewMode === 'chart' || viewMode === 'both') && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          {/* Comparison Chart: Grouped Bar (Required vs Actual) */}
          <Card className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl shadow-xs p-3 sm:p-3.5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
              <div>
                <h3 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                  <BarChart2 className="w-4 h-4 text-emerald-500" />
                  {chartMode === 'comparison' ? 'Grouped Comparison: Required (BOM) vs Actual Consumed Qty' : 'Raw Material Spend Breakdown (₹)'}
                </h3>
                <p className="text-[10.5px] text-slate-500 dark:text-slate-400">
                  {chartMode === 'comparison' ? 'Side-by-side consumption analysis to detect over-consumption & waste' : 'Total procurement cost per material'}
                </p>
              </div>

              {/* Chart Mode Switcher */}
              <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700 self-start sm:self-auto">
                <button
                  onClick={() => setChartMode('comparison')}
                  className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-all ${
                    chartMode === 'comparison'
                      ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-xs'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Req vs Actual
                </button>
                <button
                  onClick={() => setChartMode('cost')}
                  className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-all ${
                    chartMode === 'cost'
                      ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-xs'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Cost Spend
                </button>
              </div>
            </div>

            <div className="h-52 sm:h-56 w-full">
              {topMaterialsChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  {chartMode === 'comparison' ? (
                    /* Grouped Bar Chart: Required vs Actual Consumed */
                    <BarChart data={topMaterialsChartData} margin={{ top: 5, right: 10, left: -5, bottom: 15 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.12} />
                      <XAxis dataKey="name" tick={{ fontSize: 9 }} angle={-20} textAnchor="end" stroke="#64748b" />
                      <YAxis tick={{ fontSize: 9 }} stroke="#64748b" />
                      <RechartsTooltip 
                        formatter={(val, name) => [Number(val).toLocaleString(), name]}
                        contentStyle={{ backgroundColor: '#0f172a', borderRadius: '8px', border: '1px solid #334155', color: '#fff', fontSize: '11px', padding: '6px 10px' }}
                      />
                      <Legend verticalAlign="top" height={24} iconSize={8} wrapperStyle={{ fontSize: '11px' }} />
                      <Bar dataKey="required" name="Required (BOM) Qty" fill="#94a3b8" radius={[3, 3, 0, 0]} />
                      <Bar dataKey="actual" name="Actual Used Qty" fill="#10b981" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  ) : (
                    /* Cost Spend Bar Chart */
                    <BarChart data={topMaterialsChartData} margin={{ top: 5, right: 10, left: 10, bottom: 15 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.12} />
                      <XAxis dataKey="name" tick={{ fontSize: 9 }} angle={-20} textAnchor="end" stroke="#64748b" />
                      <YAxis tick={{ fontSize: 9 }} stroke="#64748b" tickFormatter={(v) => `₹${v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}`} />
                      <RechartsTooltip 
                        formatter={(val) => [`₹${Number(val).toLocaleString('en-IN')}`, 'Total RM Cost']}
                        contentStyle={{ backgroundColor: '#0f172a', borderRadius: '8px', border: '1px solid #334155', color: '#fff', fontSize: '11px', padding: '6px 10px' }}
                      />
                      <Bar dataKey="cost" name="Total Spend (₹)" fill="#6366f1" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  )}
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-slate-400 text-xs">
                  No consumption records for this period.
                </div>
              )}
            </div>
          </Card>

          {/* Secondary Part-to-Whole Chart: Scrap & Loss Ratio */}
          <Card className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl shadow-xs p-3 sm:p-3.5">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h3 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                  <PieIcon className="w-4 h-4 text-rose-500" />
                  Scrap &amp; Loss Efficiency Ratio
                </h3>
                <p className="text-[10.5px] text-slate-500 dark:text-slate-400">Effective vs wasted material</p>
              </div>
            </div>
            <div className="h-52 sm:h-56 w-full flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={scrapRatioData}
                    cx="50%"
                    cy="46%"
                    innerRadius={46}
                    outerRadius={68}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {scrapRatioData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <RechartsTooltip 
                    formatter={(val) => [`${Number(val).toFixed(1)}%`, 'Share']}
                    contentStyle={{ backgroundColor: '#0f172a', borderRadius: '8px', border: '1px solid #334155', color: '#fff', fontSize: '11px', padding: '6px 10px' }}
                  />
                  <Legend 
                    verticalAlign="bottom" 
                    height={32} 
                    iconSize={8}
                    formatter={(val) => <span className="text-[10.5px] text-slate-600 dark:text-slate-300">{val}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
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
                  <th className="py-2.5 px-3">Batch Ref</th>
                  <th className="py-2.5 px-3">Batch Lot</th>
                  <th className="py-2.5 px-3">Raw Material</th>
                  <th className="py-2.5 px-3">Category</th>
                  <th className="py-2.5 px-3 text-right">Req Qty</th>
                  <th className="py-2.5 px-3 text-right">Used Qty</th>
                  <th className="py-2.5 px-3 text-center">Variance</th>
                  <th className="py-2.5 px-3 text-right">Unit Cost</th>
                  <th className="py-2.5 px-3 text-right">Total Cost</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td colSpan={10} className="py-3 px-3 bg-slate-50/50 dark:bg-slate-800/20">
                        <div className="h-3.5 bg-slate-200 dark:bg-slate-700 rounded w-full"></div>
                      </td>
                    </tr>
                  ))
                ) : filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-8 text-center text-slate-400 dark:text-slate-500">
                      <Wheat className="w-8 h-8 mx-auto mb-1.5 opacity-30" />
                      No consumption records found matching the filter criteria.
                    </td>
                  </tr>
                ) : (
                  filteredItems.map((item) => {
                    const variance = Number(item.actualUsedQty || 0) - Number(item.requiredQty || 0);
                    return (
                      <tr key={item.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="py-2 px-3 font-mono font-semibold text-slate-900 dark:text-white">
                          {item.batch?.referenceNo || 'N/A'}
                        </td>
                        <td className="py-2 px-3 text-slate-500 dark:text-slate-400 font-mono text-[10.5px]">
                          {item.batch?.batchNo || '-'}
                        </td>
                        <td className="py-2 px-3">
                          <span className="font-semibold text-slate-900 dark:text-white block">{item.rawMaterial?.name}</span>
                          <span className="text-[10px] text-slate-400 font-mono">{item.rawMaterial?.code}</span>
                        </td>
                        <td className="py-2 px-3 text-slate-500 dark:text-slate-400">
                          {item.rawMaterial?.category?.name || 'General'}
                        </td>
                        <td className="py-2 px-3 text-right text-slate-600 dark:text-slate-300">
                          {Number(item.requiredQty || 0).toFixed(2)}
                        </td>
                        <td className="py-2 px-3 text-right font-semibold text-slate-900 dark:text-white">
                          {Number(item.actualUsedQty || 0).toFixed(2)} {item.rawMaterial?.consumptionUnit || ''}
                        </td>
                        <td className="py-2 px-3 text-center">
                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-semibold ${
                            variance > 0
                              ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                              : variance < 0
                              ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                              : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                          }`}>
                            {variance > 0 ? `+${variance.toFixed(2)}` : variance.toFixed(2)}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-right text-slate-600 dark:text-slate-300">
                          ₹{Number(item.unitCost || 0).toFixed(2)}
                        </td>
                        <td className="py-2 px-3 text-right font-bold text-slate-900 dark:text-white">
                          ₹{Number(item.totalCost || 0).toLocaleString('en-IN')}
                        </td>
                        <td className="py-2 px-3 text-center">
                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-semibold ${
                            (item.status || '').toLowerCase() === 'sufficient'
                              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                              : 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                          }`}>
                            {item.status || 'Sufficient'}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* High-density Pagination Footer */}
          <div className="px-3 py-2 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40">
            <Pagination
              currentPage={reportData.pagination?.page || currentPage}
              totalPages={reportData.pagination?.totalPages || 1}
              totalRecords={reportData.pagination?.totalRecords || filteredItems.length}
              pageSize={reportData.pagination?.pageSize || 20}
              onPageChange={handlePageChange}
            />
          </div>
        </div>
      )}
    </div>
  );
}
