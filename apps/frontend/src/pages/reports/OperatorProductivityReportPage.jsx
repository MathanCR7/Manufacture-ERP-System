import React, { useState, useEffect } from 'react';
import { api } from '@/lib/axios';
import { 
  Users, Download, FileSpreadsheet, FileText, Search, RefreshCw, 
  Award, Zap, TrendingUp, Clock, BarChart2
} from 'lucide-react';
import { 
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip as RechartsTooltip, Legend 
} from 'recharts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Pagination } from '@/components/ui/Pagination';
import DateRangeFilter from '@/components/reports/DateRangeFilter';
import ReportViewSwitcher from '@/components/reports/ReportViewSwitcher';
import { exportToCSV, exportToExcel, exportToPDF } from '@/utils/reportExportUtils';
import useCompanyStore from '@/app/store/companyStore';

export default function OperatorProductivityReportPage() {
  const companyName = useCompanyStore(s => s.company?.companyName) || 'Manufacturing ERP';

  const [dateFilter, setDateFilter] = useState({
    preset: 'this_month',
    startDate: '',
    endDate: ''
  });
  const [viewMode, setViewMode] = useState('both');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [reportData, setReportData] = useState({ data: [], aggregates: {}, filterInfo: {} });
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  const fetchReport = async () => {
    setLoading(true);
    try {
      const params = {
        datePreset: dateFilter.preset,
        startDate: dateFilter.startDate || undefined,
        endDate: dateFilter.endDate || undefined
      };
      const res = await api.get('/reports/operator-productivity', { params });
      setReportData(res.data || { data: [], aggregates: {}, filterInfo: {} });
    } catch (err) {
      console.error('Failed to load operator productivity report', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
    setCurrentPage(1);
  }, [dateFilter]);

  const aggs = reportData.aggregates || {};
  let items = reportData.data || [];

  if (searchTerm.trim()) {
    const q = searchTerm.toLowerCase();
    items = items.filter(r => 
      (r.operatorName && r.operatorName.toLowerCase().includes(q)) ||
      (r.operatorEmail && r.operatorEmail.toLowerCase().includes(q)) ||
      (r.role && r.role.toLowerCase().includes(q))
    );
  }

  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const paginatedItems = items.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const topOperator = items.length > 0 ? items[0] : null;

  const avgFactoryYield = items.length > 0
    ? (items.reduce((sum, o) => sum + Number(o.avgYieldPercent || 0), 0) / items.length).toFixed(1)
    : 100;

  // Chart datasets
  const operatorVolumeChartData = items.slice(0, 8).map(op => ({
    name: op.operatorName.length > 11 ? `${op.operatorName.substring(0, 11)}...` : op.operatorName,
    output: Number(op.totalActualOutput || 0),
    batches: op.completedBatches || 0
  }));

  const operatorYieldChartData = items.slice(0, 8).map(op => ({
    name: op.operatorName.length > 11 ? `${op.operatorName.substring(0, 11)}...` : op.operatorName,
    yieldPct: Number(op.avgYieldPercent || 0)
  }));

  const columns = [
    { header: 'Rank', accessor: (_, idx) => `#${idx + 1}` },
    { header: 'Operator Name', accessor: (r) => r.operatorName || 'Unknown' },
    { header: 'Email / ID', accessor: (r) => r.operatorEmail || r.operatorId || '' },
    { header: 'System Role', accessor: (r) => r.role || 'Operator' },
    { header: 'Batches Handled', accessor: (r) => r.batchesHandled || 0 },
    { header: 'Completed Batches', accessor: (r) => r.completedBatches || 0 },
    { header: 'Planned Volume', accessor: (r) => Number(r.totalPlannedQty || 0).toLocaleString() },
    { header: 'Actual Output', accessor: (r) => Number(r.totalActualOutput || 0).toLocaleString() },
    { header: 'Avg Yield %', accessor: (r) => `${Number(r.avgYieldPercent || 0).toFixed(1)}%` },
    { header: 'Avg Cycle Time', accessor: (r) => `${Number(r.avgCycleTimeHours || 0).toFixed(1)} hrs` }
  ];

  const handleExportCSV = () => {
    exportToCSV('Operator_Productivity_Leaderboard', columns, items);
  };

  const handleExportExcel = () => {
    exportToExcel('Operator_Productivity_Leaderboard', 'Leaderboard', columns, items);
  };

  const handleExportPDF = () => {
    exportToPDF({
      title: 'Shopfloor Operator Productivity & Yield Report',
      subtitle: `Period: ${reportData.filterInfo?.label || 'Custom'} | Total Batches: ${aggs.totalBatches || 0}`,
      columns,
      data: items,
      companyName,
      summaryCards: [
        { label: 'Active Operators', value: aggs.totalOperators || 0 },
        { label: 'Batches Executed', value: aggs.totalBatches || 0 },
        { label: 'Top Producer', value: topOperator?.operatorName || 'N/A' },
        { label: 'Team Avg Yield', value: `${avgFactoryYield}%` }
      ]
    });
  };

  const getYieldBadge = (yieldPct) => {
    const val = Number(yieldPct || 0);
    if (val >= 98) {
      return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800';
    } else if (val >= 94) {
      return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800';
    } else {
      return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800 font-bold';
    }
  };

  return (
    <div className="w-full max-w-full px-3 sm:px-5 py-3 space-y-3 mx-auto text-xs">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 pb-2.5 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-indigo-500 shrink-0" />
              Operator Productivity &amp; Yield Leaderboard
            </h1>
            <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
              Admin &amp; Supervisor
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Evaluate shopfloor staff execution velocity, output volumes, production cycle times, and batch yield metrics.
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
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Active Operators</p>
              <h3 className="text-base sm:text-xl font-black text-indigo-600 dark:text-indigo-400 mt-0.5">
                {aggs.totalOperators || 0}
              </h3>
              <p className="text-[10px] text-slate-500 mt-0.5">Personnel recorded</p>
            </div>
            <div className="p-2 bg-indigo-500/10 text-indigo-500 rounded-lg">
              <Users className="w-4 h-4" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl shadow-xs">
          <CardContent className="p-3 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Batches Processed</p>
              <h3 className="text-base sm:text-xl font-black text-blue-600 dark:text-blue-400 mt-0.5">
                {aggs.totalBatches || 0}
              </h3>
              <p className="text-[10px] text-slate-500 mt-0.5">In selected period</p>
            </div>
            <div className="p-2 bg-blue-500/10 text-blue-500 rounded-lg">
              <Zap className="w-4 h-4" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl shadow-xs">
          <CardContent className="p-3 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Top Producer</p>
              <h3 className="text-xs sm:text-sm font-black text-amber-600 dark:text-amber-400 mt-0.5 truncate max-w-[130px]">
                {topOperator?.operatorName || 'None'}
              </h3>
              <p className="text-[10px] text-slate-500 mt-0.5">{topOperator?.totalActualOutput ? `${Number(topOperator.totalActualOutput).toLocaleString()} units` : '0 units'}</p>
            </div>
            <div className="p-2 bg-amber-500/10 text-amber-500 rounded-lg">
              <Award className="w-4 h-4" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl shadow-xs">
          <CardContent className="p-3 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Team Avg Yield</p>
              <h3 className="text-base sm:text-xl font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
                {avgFactoryYield}%
              </h3>
              <p className="text-[10px] text-slate-500 mt-0.5">Output efficiency</p>
            </div>
            <div className="p-2 bg-emerald-500/10 text-emerald-500 rounded-lg">
              <TrendingUp className="w-4 h-4" />
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
              placeholder="Search operator name or email..."
              className="h-8 pl-8 text-xs rounded-lg bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700"
            />
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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {/* Operator Output Volume Bar Chart */}
          <Card className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl shadow-xs p-3 sm:p-3.5">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h3 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                  <BarChart2 className="w-4 h-4 text-indigo-500" />
                  Operator Output Volume (Units)
                </h3>
                <p className="text-[10.5px] text-slate-500 dark:text-slate-400">Total units manufactured per staff member</p>
              </div>
            </div>
            <div className="h-48 sm:h-52 w-full">
              {operatorVolumeChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={operatorVolumeChartData} margin={{ top: 5, right: 10, left: 10, bottom: 15 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.15} />
                    <XAxis dataKey="name" tick={{ fontSize: 9 }} angle={-20} textAnchor="end" stroke="#64748b" />
                    <YAxis tick={{ fontSize: 10 }} stroke="#64748b" />
                    <RechartsTooltip 
                      formatter={(val) => [`${Number(val).toLocaleString()} Units`, 'Actual Output']}
                      contentStyle={{ backgroundColor: '#0f172a', borderRadius: '8px', border: '1px solid #334155', color: '#fff', fontSize: '11px', padding: '6px 10px' }}
                    />
                    <Bar dataKey="output" fill="#6366f1" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-slate-400 text-xs">
                  No operator output recorded for this period.
                </div>
              )}
            </div>
          </Card>

          {/* Operator Yield % Comparison Bar Chart */}
          <Card className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl shadow-xs p-3 sm:p-3.5">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h3 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                  <TrendingUp className="w-4 h-4 text-emerald-500" />
                  Batch Output Efficiency (Yield %)
                </h3>
                <p className="text-[10.5px] text-slate-500 dark:text-slate-400">Average execution yield percentage</p>
              </div>
            </div>
            <div className="h-48 sm:h-52 w-full">
              {operatorYieldChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={operatorYieldChartData} margin={{ top: 5, right: 10, left: 0, bottom: 15 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.15} />
                    <XAxis dataKey="name" tick={{ fontSize: 9 }} angle={-20} textAnchor="end" stroke="#64748b" />
                    <YAxis domain={[80, 100]} tick={{ fontSize: 10 }} stroke="#64748b" tickFormatter={(v) => `${v}%`} />
                    <RechartsTooltip 
                      formatter={(val) => [`${Number(val).toFixed(1)}%`, 'Average Yield']}
                      contentStyle={{ backgroundColor: '#0f172a', borderRadius: '8px', border: '1px solid #334155', color: '#fff', fontSize: '11px', padding: '6px 10px' }}
                    />
                    <Bar dataKey="yieldPct" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-slate-400 text-xs">
                  No operator yield data available.
                </div>
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
                  <th className="py-2.5 px-3 text-center w-10">#</th>
                  <th className="py-2.5 px-3">Operator / Staff</th>
                  <th className="py-2.5 px-3">Role</th>
                  <th className="py-2.5 px-3 text-center">Batches (Done / Total)</th>
                  <th className="py-2.5 px-3 text-right">Planned Qty</th>
                  <th className="py-2.5 px-3 text-right">Actual Output</th>
                  <th className="py-2.5 px-3 text-center">Yield %</th>
                  <th className="py-2.5 px-3 text-center">Avg Cycle Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td colSpan={8} className="py-3 px-3 bg-slate-50/50 dark:bg-slate-800/20">
                        <div className="h-3.5 bg-slate-200 dark:bg-slate-700 rounded w-full"></div>
                      </td>
                    </tr>
                  ))
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400 dark:text-slate-500">
                      <Users className="w-8 h-8 mx-auto mb-1.5 opacity-30" />
                      No operator production records found for the selected period.
                    </td>
                  </tr>
                ) : (
                  paginatedItems.map((row, idx) => {
                    const rank = (currentPage - 1) * pageSize + idx + 1;
                    return (
                      <tr key={row.operatorId || idx} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="py-2 px-3 text-center font-bold">
                          {rank === 1 ? (
                            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 text-xs">
                              🥇
                            </span>
                          ) : rank === 2 ? (
                            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs">
                              🥈
                            </span>
                          ) : rank === 3 ? (
                            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-500 text-xs">
                              🥉
                            </span>
                          ) : (
                            <span className="text-slate-400">{rank}</span>
                          )}
                        </td>
                        <td className="py-2 px-3">
                          <span className="font-semibold text-slate-900 dark:text-white block">{row.operatorName}</span>
                          <span className="text-[10px] text-slate-400">{row.operatorEmail || 'No email registered'}</span>
                        </td>
                        <td className="py-2 px-3 text-slate-600 dark:text-slate-300">
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                            {row.role}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-center">
                          <span className="font-semibold text-slate-900 dark:text-white">{row.completedBatches}</span>
                          <span className="text-slate-400 text-[10px]"> / {row.batchesHandled}</span>
                        </td>
                        <td className="py-2 px-3 text-right text-slate-600 dark:text-slate-300">
                          {Number(row.totalPlannedQty).toLocaleString()}
                        </td>
                        <td className="py-2 px-3 text-right font-bold text-slate-900 dark:text-white">
                          {Number(row.totalActualOutput).toLocaleString()}
                        </td>
                        <td className="py-2 px-3 text-center">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] border ${getYieldBadge(row.avgYieldPercent)}`}>
                            {Number(row.avgYieldPercent).toFixed(1)}%
                          </span>
                        </td>
                        <td className="py-2 px-3 text-center text-slate-600 dark:text-slate-300">
                          <div className="flex items-center justify-center gap-1">
                            <Clock className="w-3 h-3 text-slate-400" />
                            <span>{Number(row.avgCycleTimeHours).toFixed(1)} hrs</span>
                          </div>
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
              currentPage={currentPage}
              totalPages={totalPages}
              totalRecords={items.length}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
            />
          </div>
        </div>
      )}
    </div>
  );
}
