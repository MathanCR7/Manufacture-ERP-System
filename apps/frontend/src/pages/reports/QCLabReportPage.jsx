import React, { useState, useEffect } from 'react';
import { api } from '@/lib/axios';
import { 
  FlaskConical, Download, FileSpreadsheet, FileText, Search, RefreshCw, 
  CheckCircle2, XCircle, Clock, BarChart2, PieChart as PieIcon, Layers
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
  const [chartMode, setChartMode] = useState('stacked'); // 'stacked' | 'pareto' | 'grouped'
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

  // Stacked Bar Data: Product-wise Inspection Outcomes (Passed vs Failed vs Pending)
  const productMap = {};
  tests.forEach(t => {
    const prodName = t.batch?.product?.name || 'Standard Item';
    if (!productMap[prodName]) {
      productMap[prodName] = { 
        name: prodName.length > 14 ? `${prodName.substring(0, 14)}...` : prodName, 
        fullName: prodName,
        passed: 0, 
        failed: 0, 
        pending: 0, 
        total: 0 
      };
    }
    const st = (t.status || '').toUpperCase();
    if (st.includes('PASS')) productMap[prodName].passed += 1;
    else if (st.includes('FAIL')) productMap[prodName].failed += 1;
    else productMap[prodName].pending += 1;
    productMap[prodName].total += 1;
  });

  const productQualityData = Object.values(productMap)
    .sort((a, b) => b.total - a.total)
    .slice(0, 6);

  // Quality Parameter Compliance Breakdown Data (Safety, Texture, Taste, Appearance, Weight Portion)
  const paramStats = {
    'Safety / Microbial': { passed: 0, total: 0 },
    'Texture & Body': { passed: 0, total: 0 },
    'Taste & Flavor': { passed: 0, total: 0 },
    'Appearance / Color': { passed: 0, total: 0 },
    'Weight & Portion': { passed: 0, total: 0 }
  };

  tests.forEach(t => {
    const qp = t.qcParams || {};
    paramStats['Safety / Microbial'].total += 1;
    if (!qp.safety || !String(qp.safety).toLowerCase().includes('fail')) {
      paramStats['Safety / Microbial'].passed += 1;
    }

    paramStats['Texture & Body'].total += 1;
    if (!qp.texture || !String(qp.texture).toLowerCase().includes('fail')) {
      paramStats['Texture & Body'].passed += 1;
    }

    paramStats['Taste & Flavor'].total += 1;
    if (!qp.taste || !String(qp.taste).toLowerCase().includes('fail')) {
      paramStats['Taste & Flavor'].passed += 1;
    }

    paramStats['Appearance / Color'].total += 1;
    if (!qp.appearance || !String(qp.appearance).toLowerCase().includes('fail')) {
      paramStats['Appearance / Color'].passed += 1;
    }

    paramStats['Weight & Portion'].total += 1;
    if (!qp.weightPortion || !String(qp.weightPortion).toLowerCase().includes('fail')) {
      paramStats['Weight & Portion'].passed += 1;
    }
  });

  const complianceParamData = Object.entries(paramStats).map(([param, stat]) => ({
    param,
    complianceRate: stat.total > 0 ? Math.round((stat.passed / stat.total) * 100) : 100,
    passedCount: stat.passed,
    totalCount: stat.total
  }));

  // Defect Causes Pareto Data
  const failureReasons = aggs.failureReasons || {};
  const defectParetoData = Object.keys(failureReasons).map(reason => ({
    reason: reason.length > 14 ? `${reason.substring(0, 14)}...` : reason,
    fullReason: reason,
    count: failureReasons[reason]
  })).sort((a, b) => b.count - a.count).slice(0, 6);

  // QC Outcomes Donut Data
  const qcOutcomePieData = [
    { name: 'Passed', value: aggs.passedCount || 0, color: '#10b981' },
    { name: 'Failed', value: aggs.failedCount || 0, color: '#ef4444' },
    { name: 'Pending', value: aggs.pendingCount || 0, color: '#f59e0b' }
  ].filter(d => d.value > 0);

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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 pb-2.5 border-b border-slate-200/80 dark:border-slate-800">
        <div>
          <h1 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <FlaskConical className="w-5 h-5 text-indigo-500 shrink-0" />
            Quality Control &amp; Lab Inspection Report
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Evaluate production batch lab test compliance, pass/fail ratios by product, and defect Pareto analysis.
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
          {/* Primary Chart Card with Interactive Mode Switcher */}
          <Card className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl shadow-xs p-3 sm:p-3.5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2.5">
              <div>
                <h3 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                  <BarChart2 className="w-4 h-4 text-indigo-500" />
                  {chartMode === 'stacked' ? 'Product Quality Inspection Comparison (Stacked Bar)' :
                   chartMode === 'grouped' ? 'Product Pass vs Fail Grouped Comparison' :
                   defectParetoData.length > 0 ? 'Primary Defect Causes (Pareto Analysis)' : 'Quality Parameter Compliance (% Compliant)'}
                </h3>
                <p className="text-[10.5px] text-slate-500 dark:text-slate-400">
                  {chartMode === 'stacked' ? 'Pass, Fail, and Pending test distribution compared across top products' :
                   chartMode === 'grouped' ? 'Side-by-side comparison of passed and failed batches per product' :
                   defectParetoData.length > 0 ? 'Most frequent non-conformance failure reasons in descending frequency' : 'Audited test parameters (Safety, Texture, Taste, Appearance, Weight) compliance pass rate'}
                </p>
              </div>

              {/* Chart Mode Switcher Pills */}
              <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/80 p-0.5 rounded-lg shrink-0 self-start sm:self-auto border border-slate-200 dark:border-slate-700">
                <button
                  onClick={() => setChartMode('stacked')}
                  className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-all ${
                    chartMode === 'stacked'
                      ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-xs'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Stacked Bar
                </button>
                <button
                  onClick={() => setChartMode('grouped')}
                  className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-all ${
                    chartMode === 'grouped'
                      ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-xs'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Grouped Bar
                </button>
                <button
                  onClick={() => setChartMode('pareto')}
                  className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-all ${
                    chartMode === 'pareto'
                      ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-xs'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {defectParetoData.length > 0 ? 'Defect Pareto' : 'Compliance Rates'}
                </button>
              </div>
            </div>

            {chartMode === 'pareto' && defectParetoData.length === 0 && (
              <div className="mb-2 flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-[11px] text-emerald-800 dark:text-emerald-300 font-medium">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  <span><strong>Zero Defects Reported:</strong> 100% full compliance across all audited quality test parameters.</span>
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-100 dark:bg-emerald-900/50 px-2 py-0.5 rounded text-emerald-700 dark:text-emerald-300">
                  Full Compliance
                </span>
              </div>
            )}

            <div className="h-52 sm:h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                {chartMode === 'stacked' ? (
                  /* Stacked Bar: Pass vs Fail vs Pending by Product */
                  productQualityData.length > 0 ? (
                    <BarChart data={productQualityData} margin={{ top: 5, right: 10, left: -10, bottom: 15 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.12} />
                      <XAxis dataKey="name" tick={{ fontSize: 9 }} angle={-20} textAnchor="end" stroke="#64748b" />
                      <YAxis tick={{ fontSize: 9 }} stroke="#64748b" />
                      <RechartsTooltip 
                        formatter={(val, name) => [`${val} Tests`, name]}
                        contentStyle={{ backgroundColor: '#0f172a', borderRadius: '8px', border: '1px solid #334155', color: '#fff', fontSize: '11px', padding: '6px 10px' }}
                      />
                      <Legend verticalAlign="top" height={24} iconSize={8} wrapperStyle={{ fontSize: '10.5px' }} />
                      <Bar dataKey="passed" name="Passed" stackId="qc" fill="#10b981" radius={[0, 0, 0, 0]} />
                      <Bar dataKey="failed" name="Failed" stackId="qc" fill="#ef4444" radius={[0, 0, 0, 0]} />
                      <Bar dataKey="pending" name="Pending" stackId="qc" fill="#f59e0b" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  ) : (
                    <div className="h-full flex items-center justify-center text-slate-400 text-xs">
                      No inspection test logs available.
                    </div>
                  )
                ) : chartMode === 'grouped' ? (
                  /* Grouped Bar: Passed vs Failed per Product side-by-side */
                  productQualityData.length > 0 ? (
                    <BarChart data={productQualityData} margin={{ top: 5, right: 10, left: -10, bottom: 15 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.12} />
                      <XAxis dataKey="name" tick={{ fontSize: 9 }} angle={-20} textAnchor="end" stroke="#64748b" />
                      <YAxis tick={{ fontSize: 9 }} stroke="#64748b" />
                      <RechartsTooltip 
                        formatter={(val, name) => [`${val} Tests`, name]}
                        contentStyle={{ backgroundColor: '#0f172a', borderRadius: '8px', border: '1px solid #334155', color: '#fff', fontSize: '11px', padding: '6px 10px' }}
                      />
                      <Legend verticalAlign="top" height={24} iconSize={8} wrapperStyle={{ fontSize: '10.5px' }} />
                      <Bar dataKey="passed" name="Passed Tests" fill="#10b981" radius={[3, 3, 0, 0]} />
                      <Bar dataKey="failed" name="Failed Tests" fill="#ef4444" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  ) : (
                    <div className="h-full flex items-center justify-center text-slate-400 text-xs">
                      No inspection test logs available.
                    </div>
                  )
                ) : (
                  /* Pareto Defect Causes Bar Chart OR Parameter Compliance Chart if 0 defects */
                  defectParetoData.length > 0 ? (
                    <BarChart data={defectParetoData} margin={{ top: 5, right: 10, left: -10, bottom: 15 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.15} />
                      <XAxis dataKey="reason" tick={{ fontSize: 9 }} angle={-20} textAnchor="end" stroke="#64748b" />
                      <YAxis tick={{ fontSize: 10 }} stroke="#64748b" />
                      <RechartsTooltip 
                        formatter={(val) => [`${val} Incidents`, 'Frequency']}
                        contentStyle={{ backgroundColor: '#0f172a', borderRadius: '8px', border: '1px solid #334155', color: '#fff', fontSize: '11px', padding: '6px 10px' }}
                      />
                      <Bar dataKey="count" name="Defect Incidents" fill="#ef4444" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  ) : complianceParamData.length > 0 ? (
                    <BarChart data={complianceParamData} margin={{ top: 5, right: 10, left: -10, bottom: 15 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.12} />
                      <XAxis dataKey="param" tick={{ fontSize: 9 }} angle={-15} textAnchor="end" stroke="#64748b" />
                      <YAxis tick={{ fontSize: 10 }} stroke="#64748b" domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                      <RechartsTooltip 
                        formatter={(val, _, item) => [
                          `${val}% Passed (${item.payload.passedCount}/${item.payload.totalCount} batches)`,
                          'Compliance Rate'
                        ]}
                        contentStyle={{ backgroundColor: '#0f172a', borderRadius: '8px', border: '1px solid #334155', color: '#fff', fontSize: '11px', padding: '6px 10px' }}
                      />
                      <Bar dataKey="complianceRate" name="Compliance %" fill="#10b981" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  ) : (
                    <div className="h-full flex items-center justify-center text-slate-400 text-xs">
                      No inspection test logs available.
                    </div>
                  )
                )}
              </ResponsiveContainer>
            </div>
          </Card>

          {/* QC Inspection Outcomes Donut Chart */}
          <Card className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl shadow-xs p-3 sm:p-3.5">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h3 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                  <PieIcon className="w-4 h-4 text-emerald-500" />
                  QC Inspection Outcomes
                </h3>
                <p className="text-[10.5px] text-slate-500 dark:text-slate-400">Overall pass / fail / pending share</p>
              </div>
            </div>
            <div className="h-52 sm:h-56 w-full flex items-center justify-center">
              {qcOutcomePieData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={qcOutcomePieData}
                      cx="50%"
                      cy="46%"
                      innerRadius={46}
                      outerRadius={68}
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
