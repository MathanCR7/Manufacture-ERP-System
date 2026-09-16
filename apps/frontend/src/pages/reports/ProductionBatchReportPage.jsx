import React, { useState, useEffect } from 'react';
import { api } from '@/lib/axios';
import { 
  Factory, Download, FileSpreadsheet, FileText, Search, RefreshCw, 
  TrendingUp, Layers, CheckCircle2, Clock, DollarSign, ArrowUpDown, Filter, BarChart2, PieChart as PieIcon
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

const STATUS_PALETTE = ['#10b981', '#6366f1', '#f59e0b', '#06b6d4', '#ec4899', '#8b5cf6'];

export default function ProductionBatchReportPage() {
  const companyName = useCompanyStore(s => s.company?.companyName) || 'Manufacturing ERP';

  const [dateFilter, setDateFilter] = useState({ datePreset: 'this_month', startDate: '', endDate: '' });
  const [statusFilter, setStatusFilter] = useState('All');
  const [viewMode, setViewMode] = useState('both');
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
        endDate: dateFilter.endDate,
        status: statusFilter !== 'All' ? statusFilter : undefined
      };
      const res = await api.get('/reports/production-batches', { params });
      setReportData(res.data || { data: [], aggregates: {}, filterInfo: {}, pagination: {} });
    } catch (err) {
      console.error('Failed to load production batch report', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport(1);
    setCurrentPage(1);
  }, [dateFilter, statusFilter]);

  const handlePageChange = (p) => {
    setCurrentPage(p);
    fetchReport(p);
  };

  const aggs = reportData.aggregates || {};
  const items = reportData.data || [];

  const filteredItems = items.filter(item => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    const refNo = (item.referenceNo || '').toLowerCase();
    const batchNo = (item.batchNo || '').toLowerCase();
    const prodName = (item.product?.name || '').toLowerCase();
    return refNo.includes(term) || batchNo.includes(term) || prodName.includes(term);
  });

  // Prepare chart datasets
  const batchOutputChartData = filteredItems.slice(0, 8).map(b => ({
    name: b.referenceNo || b.batchNo || 'Batch',
    planned: Number(b.quantity || 0),
    actual: b.actualOutput != null ? Number(b.actualOutput) : 0
  }));

  const statusCounts = aggs.statusCounts || {};
  const statusPieData = Object.keys(statusCounts).map((status, idx) => ({
    name: status,
    value: statusCounts[status],
    color: STATUS_PALETTE[idx % STATUS_PALETTE.length]
  }));

  const columns = [
    { header: 'Reference #', accessor: (r) => r.referenceNo || 'N/A' },
    { header: 'Batch Lot', accessor: (r) => r.batchNo || '-' },
    { header: 'Product', accessor: (r) => `${r.product?.name || ''} (${r.product?.code || ''})` },
    { header: 'Type', accessor: (r) => r.productionType || 'Standard' },
    { header: 'Target Qty', accessor: (r) => Number(r.quantity || 0).toFixed(2) },
    { header: 'Actual Output', accessor: (r) => r.actualOutput != null ? Number(r.actualOutput).toFixed(2) : '-' },
    { header: 'Yield %', accessor: (r) => r.yieldPercent != null ? `${r.yieldPercent}%` : '-' },
    { header: 'Total Cost', accessor: (r) => `₹${Number(r.totalCost || 0).toLocaleString('en-IN')}` },
    { header: 'Unit Cost', accessor: (r) => `₹${Number(r.costPerUnit || 0).toFixed(2)}` },
    { header: 'Cycle (Hrs)', accessor: (r) => r.cycleTimeHours != null ? `${r.cycleTimeHours}h` : '-' },
    { header: 'Status', accessor: (r) => r.status || 'Planned' }
  ];

  const handleExportCSV = () => {
    exportToCSV('Production_Batches_Report', columns, filteredItems);
  };

  const handleExportExcel = () => {
    exportToExcel('Production_Batches_Report', 'Production Batches', columns, filteredItems);
  };

  const handleExportPDF = () => {
    exportToPDF({
      title: 'Production Batches Report',
      subtitle: `Period: ${reportData.filterInfo?.label || 'Custom'} (${reportData.filterInfo?.startDate?.split('T')[0]} to ${reportData.filterInfo?.endDate?.split('T')[0]})`,
      columns,
      data: filteredItems,
      companyName,
      summaryCards: [
        { label: 'Total Batches', value: aggs.totalBatches || 0 },
        { label: 'Avg Yield %', value: `${aggs.avgYieldPercent || 100}%` },
        { label: 'Total Batch Cost', value: `₹${Number(aggs.totalBatchCost || 0).toLocaleString('en-IN')}` },
        { label: 'Actual Output', value: aggs.totalActualOutput || '0' }
      ]
    });
  };

  return (
    <div className="w-full max-w-full px-3 sm:px-5 py-3 space-y-3 mx-auto text-xs">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 pb-2.5 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <Factory className="w-5 h-5 text-indigo-500 shrink-0" />
            Production Batches Report
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Monitor shopfloor execution, planned vs. actual output yields, unit manufacturing costs, and cycle times.
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
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Batches</p>
              <h3 className="text-base sm:text-xl font-black text-slate-900 dark:text-white mt-0.5">
                {aggs.totalBatches || 0}
              </h3>
            </div>
            <div className="p-2 bg-indigo-500/10 text-indigo-500 rounded-lg">
              <Factory className="w-4 h-4" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl shadow-xs">
          <CardContent className="p-3 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Average Yield</p>
              <h3 className="text-base sm:text-xl font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
                {aggs.avgYieldPercent || 100}%
              </h3>
            </div>
            <div className="p-2 bg-emerald-500/10 text-emerald-500 rounded-lg">
              <TrendingUp className="w-4 h-4" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl shadow-xs">
          <CardContent className="p-3 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Manufacturing Cost</p>
              <h3 className="text-base sm:text-xl font-black text-indigo-600 dark:text-indigo-400 mt-0.5">
                ₹{Number(aggs.totalBatchCost || 0).toLocaleString('en-IN')}
              </h3>
            </div>
            <div className="p-2 bg-indigo-500/10 text-indigo-500 rounded-lg">
              <DollarSign className="w-4 h-4" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl shadow-xs">
          <CardContent className="p-3 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Actual Produced</p>
              <h3 className="text-base sm:text-xl font-black text-slate-900 dark:text-white mt-0.5">
                {Number(aggs.totalActualOutput || 0).toLocaleString()}
              </h3>
            </div>
            <div className="p-2 bg-blue-500/10 text-blue-500 rounded-lg">
              <Layers className="w-4 h-4" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 bg-white dark:bg-slate-900 p-2 sm:p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
        <div className="flex flex-wrap items-center gap-2">
          <DateRangeFilter
            value={dateFilter}
            onChange={setDateFilter}
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-8 px-2.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
          >
            <option value="All">All Statuses</option>
            <option value="Planned">Planned</option>
            <option value="In Progress">In Progress</option>
            <option value="Completed">Completed</option>
            <option value="qc_passed">QC Passed</option>
            <option value="qc_failed">QC Failed</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative w-full sm:w-60">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search reference # or batch..."
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

      {/* CHART VIEW (Shown when viewMode is 'chart' or 'both') */}
      {(viewMode === 'chart' || viewMode === 'both') && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          {/* Output Volume: Target vs Actual Bar Chart */}
          <Card className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl shadow-xs p-3 sm:p-3.5">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h3 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                  <BarChart2 className="w-4 h-4 text-indigo-500" />
                  Planned vs Actual Output by Batch
                </h3>
                <p className="text-[10.5px] text-slate-500 dark:text-slate-400">Yield and execution volume analysis</p>
              </div>
            </div>
            <div className="h-48 sm:h-52 w-full">
              {batchOutputChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={batchOutputChartData} margin={{ top: 5, right: 10, left: -10, bottom: 15 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.15} />
                    <XAxis dataKey="name" tick={{ fontSize: 9 }} angle={-20} textAnchor="end" stroke="#64748b" />
                    <YAxis tick={{ fontSize: 10 }} stroke="#64748b" />
                    <RechartsTooltip 
                      contentStyle={{ backgroundColor: '#0f172a', borderRadius: '8px', border: '1px solid #334155', color: '#fff', fontSize: '11px', padding: '6px 10px' }}
                    />
                    <Legend verticalAlign="top" height={26} iconSize={10} wrapperStyle={{ fontSize: '11px' }} />
                    <Bar dataKey="planned" name="Planned Output" fill="#94a3b8" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="actual" name="Actual Produced" fill="#6366f1" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-slate-400 text-xs">
                  No batch production data recorded.
                </div>
              )}
            </div>
          </Card>

          {/* Batch Status Donut Chart */}
          <Card className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl shadow-xs p-3 sm:p-3.5">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h3 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                  <PieIcon className="w-4 h-4 text-emerald-500" />
                  Batch Status Distribution
                </h3>
                <p className="text-[10.5px] text-slate-500 dark:text-slate-400">Pipeline health across batches</p>
              </div>
            </div>
            <div className="h-48 sm:h-52 w-full flex items-center justify-center">
              {statusPieData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusPieData}
                      cx="50%"
                      cy="48%"
                      innerRadius={48}
                      outerRadius={70}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {statusPieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <RechartsTooltip 
                      formatter={(val, name) => [`${val} Batches`, name]}
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
              ) : (
                <div className="text-slate-400 text-xs">No status data available.</div>
              )}
            </div>
          </Card>
        </div>
      )}

      {/* TABLE VIEW (Shown when viewMode is 'table' or 'both') */}
      {(viewMode === 'table' || viewMode === 'both') && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[11.5px] border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/75 dark:bg-slate-800/40 text-slate-500 dark:text-slate-400 font-semibold uppercase text-[10px] tracking-wider">
                  <th className="py-2.5 px-3">Reference #</th>
                  <th className="py-2.5 px-3">Batch Lot</th>
                  <th className="py-2.5 px-3">Product</th>
                  <th className="py-2.5 px-3 text-right">Planned Qty</th>
                  <th className="py-2.5 px-3 text-right">Actual Output</th>
                  <th className="py-2.5 px-3 text-center">Yield %</th>
                  <th className="py-2.5 px-3 text-right">Total Cost</th>
                  <th className="py-2.5 px-3 text-right">Unit Cost</th>
                  <th className="py-2.5 px-3 text-center">Cycle Time</th>
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
                      <Factory className="w-8 h-8 mx-auto mb-1.5 opacity-30" />
                      No production batches found matching the filters.
                    </td>
                  </tr>
                ) : (
                  filteredItems.map((b) => (
                    <tr key={b.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="py-2 px-3 font-mono font-semibold text-slate-900 dark:text-white">
                        {b.referenceNo || 'N/A'}
                      </td>
                      <td className="py-2 px-3 text-slate-500 dark:text-slate-400 font-mono text-[10.5px]">
                        {b.batchNo || '-'}
                      </td>
                      <td className="py-2 px-3">
                        <span className="font-semibold text-slate-900 dark:text-white block">
                          {b.product?.name}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {b.product?.code}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-right text-slate-600 dark:text-slate-300">
                        {Number(b.quantity || 0).toLocaleString()}
                      </td>
                      <td className="py-2 px-3 text-right font-semibold text-slate-900 dark:text-white">
                        {b.actualOutput != null ? Number(b.actualOutput).toLocaleString() : '-'}
                      </td>
                      <td className="py-2 px-3 text-center">
                        {b.yieldPercent != null ? (
                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-semibold ${
                            b.yieldPercent >= 98
                              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                              : b.yieldPercent >= 92
                              ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                              : 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                          }`}>
                            {b.yieldPercent}%
                          </span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-right font-bold text-slate-900 dark:text-white">
                        ₹{Number(b.totalCost || 0).toLocaleString('en-IN')}
                      </td>
                      <td className="py-2 px-3 text-right text-slate-600 dark:text-slate-300">
                        ₹{Number(b.costPerUnit || 0).toFixed(2)}
                      </td>
                      <td className="py-2 px-3 text-center text-slate-500 dark:text-slate-400">
                        {b.cycleTimeHours != null ? `${b.cycleTimeHours}h` : '-'}
                      </td>
                      <td className="py-2 px-3 text-center">
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-semibold ${
                          (b.status || '').toLowerCase() === 'completed' || (b.status || '').toLowerCase() === 'qc_passed'
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                            : (b.status || '').toLowerCase() === 'qc_failed'
                            ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                            : 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800'
                        }`}>
                          {b.status || 'Planned'}
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
