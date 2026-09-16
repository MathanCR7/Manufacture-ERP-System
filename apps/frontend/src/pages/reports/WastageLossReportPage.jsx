import React, { useState, useEffect } from 'react';
import { api } from '@/lib/axios';
import { 
  Trash2, Download, FileSpreadsheet, FileText, Search, RefreshCw, 
  AlertTriangle, DollarSign, Layers, Flame, BarChart2, PieChart as PieIcon
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

const LOSS_PALETTE = ['#ef4444', '#f97316', '#f59e0b', '#ec4899', '#8b5cf6', '#6366f1'];

export default function WastageLossReportPage() {
  const companyName = useCompanyStore(s => s.company?.companyName) || 'Manufacturing ERP';

  const [dateFilter, setDateFilter] = useState({ datePreset: 'this_month', startDate: '', endDate: '' });
  const [viewMode, setViewMode] = useState('both');
  const [chartMode, setChartMode] = useState('ranked'); // 'ranked' | 'comparison' | 'loss_bar'
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
      const res = await api.get('/reports/wastage-loss', { params });
      setReportData(res.data || { data: [], aggregates: {}, filterInfo: {}, pagination: {} });
    } catch (err) {
      console.error('Failed to load wastage loss report', err);
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
  const topLossRMs = aggs.topLossRMs || [];

  const filteredItems = items.filter(item => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    const rmName = (item.rawMaterial?.name || '').toLowerCase();
    const batchRef = (item.loss?.batch?.referenceNo || '').toLowerCase();
    return rmName.includes(term) || batchRef.includes(term);
  });

  // Aggregated per-material stats for Grouped Comparison: Produced Qty vs Loss Qty
  const rmStats = {};
  items.forEach(item => {
    const rmName = item.rawMaterial?.name || 'Raw Material';
    if (!rmStats[rmName]) {
      rmStats[rmName] = {
        name: rmName.length > 14 ? `${rmName.substring(0, 14)}...` : rmName,
        fullName: rmName,
        productionQty: 0,
        lossQty: 0,
        lossAmount: 0
      };
    }
    rmStats[rmName].productionQty += Number(item.productionQty || 0);
    rmStats[rmName].lossQty += Number(item.lossQty || 0);
    rmStats[rmName].lossAmount += Number(item.lossAmount || 0);
  });

  const groupedMaterialLossData = Object.values(rmStats)
    .sort((a, b) => b.lossAmount - a.lossAmount)
    .slice(0, 6);

  // Ranked Horizontal Bar Data (handles long material names cleanly)
  const rankedLossData = topLossRMs.length > 0
    ? topLossRMs.slice(0, 6).map((rm, idx) => ({
        name: rm.name.length > 16 ? `${rm.name.substring(0, 16)}...` : rm.name,
        fullName: rm.name,
        lossValue: Number(rm.lossValue || 0),
        fill: LOSS_PALETTE[idx % LOSS_PALETTE.length]
      }))
    : groupedMaterialLossData.map((rm, idx) => ({
        name: rm.name,
        fullName: rm.fullName,
        lossValue: rm.lossAmount,
        fill: LOSS_PALETTE[idx % LOSS_PALETTE.length]
      }));

  // Loss Share Donut Data
  const lossPieData = (topLossRMs.length > 0 ? topLossRMs : groupedMaterialLossData).map((rm, idx) => ({
    name: rm.name || rm.fullName,
    value: Number(rm.lossValue || rm.lossAmount || 0),
    color: LOSS_PALETTE[idx % LOSS_PALETTE.length]
  })).filter(d => d.value > 0);

  const columns = [
    { header: 'Date', accessor: (r) => r.loss?.date ? new Date(r.loss.date).toLocaleDateString('en-IN') : '-' },
    { header: 'Batch Reference', accessor: (r) => r.loss?.batch?.referenceNo || 'N/A' },
    { header: 'Raw Material', accessor: (r) => `${r.rawMaterial?.name || ''} (${r.rawMaterial?.code || ''})` },
    { header: 'Batch Qty', accessor: (r) => Number(r.productionQty || 0).toFixed(2) },
    { header: 'Loss Qty', accessor: (r) => Number(r.lossQty || 0).toFixed(2) },
    { header: 'Loss Amount (₹)', accessor: (r) => `₹${Number(r.lossAmount || 0).toLocaleString('en-IN')}` },
    { header: 'Responsible Person', accessor: (r) => r.loss?.responsiblePerson?.name || 'Operator' }
  ];

  const handleExportCSV = () => {
    exportToCSV('Wastage_Loss_Report', columns, filteredItems);
  };

  const handleExportExcel = () => {
    exportToExcel('Wastage_Loss_Report', 'Wastage Loss', columns, filteredItems);
  };

  const handleExportPDF = () => {
    exportToPDF({
      title: 'Production Wastage & Material Loss Report',
      subtitle: `Period: ${reportData.filterInfo?.label || 'Custom'} (${reportData.filterInfo?.startDate?.split('T')[0]} to ${reportData.filterInfo?.endDate?.split('T')[0]})`,
      columns,
      data: filteredItems,
      companyName,
      summaryCards: [
        { label: 'Total Loss Amount', value: `₹${Number(aggs.totalLossAmount || 0).toLocaleString('en-IN')}` },
        { label: 'Total Loss Qty', value: aggs.totalLossQty || '0.00' },
        { label: 'Loss Incidents', value: aggs.totalLossIncidents || 0 }
      ]
    });
  };

  return (
    <div className="w-full max-w-full px-3 sm:px-5 py-3 space-y-3 mx-auto text-xs">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 pb-2.5 border-b border-slate-200/80 dark:border-slate-800">
        <div>
          <h1 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <Trash2 className="w-5 h-5 text-rose-500 shrink-0" />
            Wastage &amp; Material Loss Report
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Audit scrap production, lost raw materials, monetary impact, and responsible operators across batches.
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
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Monetary Loss</p>
              <h3 className="text-base sm:text-xl font-black text-rose-600 dark:text-rose-400 mt-0.5">
                ₹{Number(aggs.totalLossAmount || 0).toLocaleString('en-IN')}
              </h3>
            </div>
            <div className="p-2 bg-rose-500/10 text-rose-500 rounded-lg">
              <DollarSign className="w-4 h-4" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl shadow-xs">
          <CardContent className="p-3 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Scrapped Qty</p>
              <h3 className="text-base sm:text-xl font-black text-slate-900 dark:text-white mt-0.5">
                {Number(aggs.totalLossQty || 0).toLocaleString()}
              </h3>
            </div>
            <div className="p-2 bg-amber-500/10 text-amber-500 rounded-lg">
              <Layers className="w-4 h-4" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl shadow-xs">
          <CardContent className="p-3 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Recorded Incidents</p>
              <h3 className="text-base sm:text-xl font-black text-slate-900 dark:text-white mt-0.5">
                {aggs.totalLossIncidents || 0}
              </h3>
            </div>
            <div className="p-2 bg-indigo-500/10 text-indigo-500 rounded-lg">
              <Flame className="w-4 h-4" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl shadow-xs">
          <CardContent className="p-3 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Top Loss Material</p>
              <h3 className="text-xs sm:text-sm font-black text-rose-600 dark:text-rose-400 mt-0.5 truncate max-w-[130px]">
                {topLossRMs[0]?.name || 'None'}
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
              placeholder="Search RM or batch ref..."
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
                  <BarChart2 className="w-4 h-4 text-rose-500" />
                  {chartMode === 'ranked' ? 'Highest Scrap / Loss Materials (Ranked Horizontal Bar)' :
                   chartMode === 'comparison' ? 'Production Qty vs Scrap Loss Qty (Grouped Bar)' :
                   'Monetary Loss Impact by Raw Material (₹)'}
                </h3>
                <p className="text-[10.5px] text-slate-500 dark:text-slate-400">
                  {chartMode === 'ranked' ? 'Ranked financial damage breakdown with full material descriptions' :
                   chartMode === 'comparison' ? 'Side-by-side comparison of planned batch volume vs scrapped material' :
                   'Vertical bar chart of raw material scrap costs in rupees'}
                </p>
              </div>

              {/* Chart Mode Switcher Pills */}
              <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/80 p-0.5 rounded-lg shrink-0 self-start sm:self-auto border border-slate-200 dark:border-slate-700">
                <button
                  onClick={() => setChartMode('ranked')}
                  className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-all ${
                    chartMode === 'ranked'
                      ? 'bg-white dark:bg-slate-700 text-rose-600 dark:text-rose-400 shadow-xs'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Ranked (Horizontal)
                </button>
                <button
                  onClick={() => setChartMode('comparison')}
                  className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-all ${
                    chartMode === 'comparison'
                      ? 'bg-white dark:bg-slate-700 text-rose-600 dark:text-rose-400 shadow-xs'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Grouped Qty
                </button>
                <button
                  onClick={() => setChartMode('loss_bar')}
                  className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-all ${
                    chartMode === 'loss_bar'
                      ? 'bg-white dark:bg-slate-700 text-rose-600 dark:text-rose-400 shadow-xs'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Cost Bar
                </button>
              </div>
            </div>

            <div className="h-52 sm:h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                {chartMode === 'ranked' ? (
                  /* Ranked Horizontal Bar Chart for Top Scrap Materials */
                  rankedLossData.length > 0 ? (
                    <BarChart layout="vertical" data={rankedLossData} margin={{ top: 5, right: 15, left: 10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#334155" opacity={0.12} />
                      <XAxis 
                        type="number" 
                        tick={{ fontSize: 9 }} 
                        stroke="#64748b" 
                        tickFormatter={(v) => `₹${v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}`} 
                      />
                      <YAxis 
                        dataKey="name" 
                        type="category" 
                        tick={{ fontSize: 9 }} 
                        stroke="#64748b" 
                        width={90} 
                      />
                      <RechartsTooltip 
                        formatter={(val, _, item) => [`₹${Number(val).toLocaleString('en-IN')}`, item.payload.fullName || 'Loss Value']}
                        contentStyle={{ backgroundColor: '#0f172a', borderRadius: '8px', border: '1px solid #334155', color: '#fff', fontSize: '11px', padding: '6px 10px' }}
                      />
                      <Bar dataKey="lossValue" name="Loss Amount (₹)" radius={[0, 4, 4, 0]}>
                        {rankedLossData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  ) : (
                    <div className="h-full flex items-center justify-center text-slate-400 text-xs">
                      Zero material loss recorded for this period.
                    </div>
                  )
                ) : chartMode === 'comparison' ? (
                  /* Grouped Bar Chart: Production Qty vs Loss Qty */
                  groupedMaterialLossData.length > 0 ? (
                    <BarChart data={groupedMaterialLossData} margin={{ top: 5, right: 10, left: -10, bottom: 15 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.12} />
                      <XAxis dataKey="name" tick={{ fontSize: 9 }} angle={-20} textAnchor="end" stroke="#64748b" />
                      <YAxis tick={{ fontSize: 9 }} stroke="#64748b" />
                      <RechartsTooltip 
                        formatter={(val, name) => [Number(val).toLocaleString(), name]}
                        contentStyle={{ backgroundColor: '#0f172a', borderRadius: '8px', border: '1px solid #334155', color: '#fff', fontSize: '11px', padding: '6px 10px' }}
                      />
                      <Legend verticalAlign="top" height={24} iconSize={8} wrapperStyle={{ fontSize: '10.5px' }} />
                      <Bar dataKey="productionQty" name="Batch Qty" fill="#94a3b8" radius={[3, 3, 0, 0]} />
                      <Bar dataKey="lossQty" name="Scrap / Lost Qty" fill="#ef4444" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  ) : (
                    <div className="h-full flex items-center justify-center text-slate-400 text-xs">
                      Zero material loss recorded for this period.
                    </div>
                  )
                ) : (
                  /* Standard Cost Bar Chart */
                  rankedLossData.length > 0 ? (
                    <BarChart data={rankedLossData} margin={{ top: 5, right: 10, left: 10, bottom: 15 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.15} />
                      <XAxis dataKey="name" tick={{ fontSize: 9 }} angle={-20} textAnchor="end" stroke="#64748b" />
                      <YAxis tick={{ fontSize: 10 }} stroke="#64748b" tickFormatter={(v) => `₹${v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}`} />
                      <RechartsTooltip 
                        formatter={(val) => [`₹${Number(val).toLocaleString('en-IN')}`, 'Monetary Loss']}
                        contentStyle={{ backgroundColor: '#0f172a', borderRadius: '8px', border: '1px solid #334155', color: '#fff', fontSize: '11px', padding: '6px 10px' }}
                      />
                      <Bar dataKey="lossValue" fill="#ef4444" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  ) : (
                    <div className="h-full flex items-center justify-center text-slate-400 text-xs">
                      Zero material loss recorded for this period.
                    </div>
                  )
                )}
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Loss Share Donut Chart */}
          <Card className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl shadow-xs p-3 sm:p-3.5">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h3 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                  <PieIcon className="w-4 h-4 text-amber-500" />
                  Loss Share by Material
                </h3>
                <p className="text-[10.5px] text-slate-500 dark:text-slate-400">Proportional loss contribution</p>
              </div>
            </div>
            <div className="h-52 sm:h-56 w-full flex items-center justify-center">
              {lossPieData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={lossPieData}
                      cx="50%"
                      cy="46%"
                      innerRadius={46}
                      outerRadius={68}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {lossPieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <RechartsTooltip 
                      formatter={(val) => [`₹${Number(val).toLocaleString('en-IN')}`, 'Loss Amount']}
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
                <div className="text-slate-400 text-xs">No loss breakdown available.</div>
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
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Batch Reference</th>
                  <th className="py-2.5 px-3">Raw Material</th>
                  <th className="py-2.5 px-3 text-right">Production Qty</th>
                  <th className="py-2.5 px-3 text-right">Loss Qty</th>
                  <th className="py-2.5 px-3 text-right">Loss Amount (₹)</th>
                  <th className="py-2.5 px-3 text-right">Logged By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td colSpan={7} className="py-3 px-3 bg-slate-50/50 dark:bg-slate-800/20">
                        <div className="h-3.5 bg-slate-200 dark:bg-slate-700 rounded w-full"></div>
                      </td>
                    </tr>
                  ))
                ) : filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400 dark:text-slate-500">
                      <Trash2 className="w-8 h-8 mx-auto mb-1.5 opacity-30" />
                      No wastage records found for the selected period.
                    </td>
                  </tr>
                ) : (
                  filteredItems.map((row) => (
                    <tr key={row.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="py-2 px-3 text-slate-500 dark:text-slate-400">
                        {row.loss?.date ? new Date(row.loss.date).toLocaleDateString('en-IN') : '-'}
                      </td>
                      <td className="py-2 px-3 font-mono font-semibold text-slate-900 dark:text-white">
                        {row.loss?.batch?.referenceNo || 'N/A'}
                      </td>
                      <td className="py-2 px-3">
                        <span className="font-semibold text-slate-900 dark:text-white block">
                          {row.rawMaterial?.name}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {row.rawMaterial?.code}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-right text-slate-600 dark:text-slate-300">
                        {Number(row.productionQty || 0).toLocaleString()}
                      </td>
                      <td className="py-2 px-3 text-right font-semibold text-rose-600 dark:text-rose-400">
                        {Number(row.lossQty || 0).toLocaleString()}
                      </td>
                      <td className="py-2 px-3 text-right font-bold text-slate-900 dark:text-white">
                        ₹{Number(row.lossAmount || 0).toLocaleString('en-IN')}
                      </td>
                      <td className="py-2 px-3 text-right text-slate-500 dark:text-slate-400">
                        {row.loss?.responsiblePerson?.name || 'Shopfloor Staff'}
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
