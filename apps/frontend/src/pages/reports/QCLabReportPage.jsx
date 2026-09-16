import React, { useState, useEffect } from 'react';
import { api } from '@/lib/axios';
import { 
  FlaskConical, Download, FileSpreadsheet, FileText, Search, RefreshCw, 
  CheckCircle2, XCircle, Clock, BarChart2, PieChart as PieIcon
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

export default function QCLabReportPage() {
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
      const res = await api.get('/reports/qc-lab', { params });
      setReportData(res.data || { data: [], aggregates: {}, filterInfo: {}, pagination: {} });
    } catch (err) {
      console.error('Failed to load QC lab report', err);
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
  const tests = reportData.data || [];

  const filteredTests = tests.filter(t => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    const batchRef = (t.batch?.referenceNo || '').toLowerCase();
    const prodName = (t.batch?.product?.name || '').toLowerCase();
    return batchRef.includes(term) || prodName.includes(term);
  });

  // Prepare chart datasets
  const qcOutcomePieData = [
    { name: 'Passed', value: aggs.passedCount || 0, color: '#10b981' },
    { name: 'Failed', value: aggs.failedCount || 0, color: '#ef4444' },
    { name: 'Pending', value: aggs.pendingCount || 0, color: '#f59e0b' }
  ].filter(d => d.value > 0);

  const failureReasons = aggs.failureReasons || {};
  const defectParetoData = Object.keys(failureReasons).map(reason => ({
    reason: reason.length > 13 ? `${reason.substring(0, 13)}...` : reason,
    count: failureReasons[reason]
  })).sort((a, b) => b.count - a.count).slice(0, 6);

  const columns = [
    { header: 'Test ID', accessor: (r) => r.id?.substring(0, 8) || 'N/A' },
    { header: 'Batch Reference', accessor: (r) => r.batch?.referenceNo || '-' },
    { header: 'Product', accessor: (r) => `${r.batch?.product?.name || ''} (${r.batch?.product?.code || ''})` },
    { header: 'Inspection Date', accessor: (r) => r.createdAt ? new Date(r.createdAt).toLocaleDateString('en-IN') : '-' },
    { header: 'Result Status', accessor: (r) => r.status || 'PENDING' },
    { header: 'Defect Reason / Remarks', accessor: (r) => r.defectReason || r.remarks || 'None / Cleared' }
  ];

  const handleExportCSV = () => {
    exportToCSV('QC_Lab_Inspection_Report', columns, filteredTests);
  };

  const handleExportExcel = () => {
    exportToExcel('QC_Lab_Inspection_Report', 'QC Inspection', columns, filteredTests);
  };

  const handleExportPDF = () => {
    exportToPDF({
      title: 'Quality Control & Lab Inspection Report',
      subtitle: `Period: ${reportData.filterInfo?.label || 'Custom'} (${reportData.filterInfo?.startDate?.split('T')[0]} to ${reportData.filterInfo?.endDate?.split('T')[0]})`,
      columns,
      data: filteredTests,
      companyName,
      summaryCards: [
        { label: 'Pass Rate %', value: `${aggs.passRate || 100}%` },
        { label: 'Fail Rate %', value: `${aggs.failRate || 0}%` },
        { label: 'Total Tested', value: aggs.totalTests || 0 },
        { label: 'Pending Tests', value: aggs.pendingCount || 0 }
      ]
    });
  };

  return (
    <div className="w-full max-w-full px-3 sm:px-5 py-3 space-y-3 mx-auto text-xs">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 pb-2.5 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <FlaskConical className="w-5 h-5 text-indigo-500 shrink-0" />
            Quality Control &amp; Lab Inspection Report
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Evaluate production batch lab test compliance, overall pass/fail ratios, and defect Pareto analysis.
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
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Quality Pass Rate</p>
              <h3 className="text-base sm:text-xl font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
                {aggs.passRate || 100}%
              </h3>
            </div>
            <div className="p-2 bg-emerald-500/10 text-emerald-500 rounded-lg">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl shadow-xs">
          <CardContent className="p-3 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Quality Fail Rate</p>
              <h3 className={`text-base sm:text-xl font-black mt-0.5 ${
                Number(aggs.failRate || 0) > 5 ? 'text-rose-500' : 'text-slate-700 dark:text-slate-300'
              }`}>
                {aggs.failRate || 0}%
              </h3>
            </div>
            <div className="p-2 bg-rose-500/10 text-rose-500 rounded-lg">
              <XCircle className="w-4 h-4" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl shadow-xs">
          <CardContent className="p-3 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Tests Executed</p>
              <h3 className="text-base sm:text-xl font-black text-indigo-600 dark:text-indigo-400 mt-0.5">
                {aggs.totalTests || 0}
              </h3>
            </div>
            <div className="p-2 bg-indigo-500/10 text-indigo-500 rounded-lg">
              <FlaskConical className="w-4 h-4" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl shadow-xs">
          <CardContent className="p-3 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Pending Review</p>
              <h3 className="text-base sm:text-xl font-black text-amber-500 mt-0.5">
                {aggs.pendingCount || 0}
              </h3>
            </div>
            <div className="p-2 bg-amber-500/10 text-amber-500 rounded-lg">
              <Clock className="w-4 h-4" />
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
            <option value="All">All Results</option>
            <option value="PASSED">Passed</option>
            <option value="FAILED">Failed</option>
            <option value="PENDING">Pending</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative w-full sm:w-60">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search test #, batch, or product..."
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
          {/* Defect Reasons Pareto Bar Chart */}
          <Card className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl shadow-xs p-3 sm:p-3.5">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h3 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                  <BarChart2 className="w-4 h-4 text-rose-500" />
                  Primary Defect Causes (Pareto Analysis)
                </h3>
                <p className="text-[10.5px] text-slate-500 dark:text-slate-400">Most frequent non-conformance failure reasons</p>
              </div>
            </div>
            <div className="h-48 sm:h-52 w-full">
              {defectParetoData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={defectParetoData} margin={{ top: 5, right: 10, left: -10, bottom: 15 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.15} />
                    <XAxis dataKey="reason" tick={{ fontSize: 9 }} angle={-20} textAnchor="end" stroke="#64748b" />
                    <YAxis tick={{ fontSize: 10 }} stroke="#64748b" />
                    <RechartsTooltip 
                      formatter={(val) => [`${val} Incidents`, 'Frequency']}
                      contentStyle={{ backgroundColor: '#0f172a', borderRadius: '8px', border: '1px solid #334155', color: '#fff', fontSize: '11px', padding: '6px 10px' }}
                    />
                    <Bar dataKey="count" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-slate-400 text-xs">
                  No defect causes reported. Full compliance!
                </div>
              )}
            </div>
          </Card>

          {/* Test Outcomes Donut Chart */}
          <Card className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl shadow-xs p-3 sm:p-3.5">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h3 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                  <PieIcon className="w-4 h-4 text-emerald-500" />
                  QC Inspection Outcomes
                </h3>
                <p className="text-[10.5px] text-slate-500 dark:text-slate-400">Passed vs failed vs pending tests</p>
              </div>
            </div>
            <div className="h-48 sm:h-52 w-full flex items-center justify-center">
              {qcOutcomePieData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={qcOutcomePieData}
                      cx="50%"
                      cy="48%"
                      innerRadius={48}
                      outerRadius={70}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {qcOutcomePieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <RechartsTooltip 
                      formatter={(val, name) => [`${val} Tests`, name]}
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
                <div className="text-slate-400 text-xs">No QC outcome data available.</div>
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
                  <th className="py-2.5 px-3">Test ID</th>
                  <th className="py-2.5 px-3">Batch Reference</th>
                  <th className="py-2.5 px-3">Product</th>
                  <th className="py-2.5 px-3">Inspection Date</th>
                  <th className="py-2.5 px-3 text-center">Result Status</th>
                  <th className="py-2.5 px-3">Defect Reason / Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td colSpan={6} className="py-3 px-3 bg-slate-50/50 dark:bg-slate-800/20">
                        <div className="h-3.5 bg-slate-200 dark:bg-slate-700 rounded w-full"></div>
                      </td>
                    </tr>
                  ))
                ) : filteredTests.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400 dark:text-slate-500">
                      <FlaskConical className="w-8 h-8 mx-auto mb-1.5 opacity-30" />
                      No quality inspection logs found matching the filter criteria.
                    </td>
                  </tr>
                ) : (
                  filteredTests.map((test) => (
                    <tr key={test.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="py-2 px-3 font-mono font-semibold text-slate-900 dark:text-white">
                        {test.id?.substring(0, 8)}...
                      </td>
                      <td className="py-2 px-3 font-mono font-semibold text-indigo-600 dark:text-indigo-400">
                        {test.batch?.referenceNo || '-'}
                      </td>
                      <td className="py-2 px-3 font-medium text-slate-900 dark:text-white">
                        {test.batch?.product?.name || '-'}
                      </td>
                      <td className="py-2 px-3 text-slate-500 dark:text-slate-400">
                        {test.createdAt ? new Date(test.createdAt).toLocaleDateString('en-IN') : '-'}
                      </td>
                      <td className="py-2 px-3 text-center">
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-semibold ${
                          (test.status || '').toUpperCase() === 'PASSED' || (test.status || '').toUpperCase() === 'QC_PASSED'
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                            : (test.status || '').toUpperCase() === 'FAILED' || (test.status || '').toUpperCase() === 'QC_FAILED'
                            ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                            : 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                        }`}>
                          {test.status || 'PENDING'}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-slate-600 dark:text-slate-300">
                        {test.defectReason || test.remarks || 'Standard parameters passed'}
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
              totalRecords={reportData.pagination?.totalRecords || filteredTests.length}
              pageSize={reportData.pagination?.pageSize || 20}
              onPageChange={handlePageChange}
            />
          </div>
        </div>
      )}
    </div>
  );
}
