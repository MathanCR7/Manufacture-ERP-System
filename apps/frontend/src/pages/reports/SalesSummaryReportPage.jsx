import React, { useState, useEffect } from 'react';
import { api } from '@/lib/axios';
import { 
  DollarSign, Download, FileSpreadsheet, FileText, Search, RefreshCw, 
  TrendingUp, ShoppingCart, Users, CheckCircle2, Calendar, CreditCard, BarChart2
} from 'lucide-react';
import { 
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, XAxis, YAxis, 
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

export default function SalesSummaryReportPage() {
  const companyName = useCompanyStore(s => s.company?.companyName) || 'Manufacturing ERP';

  const [dateFilter, setDateFilter] = useState({ datePreset: 'this_month', startDate: '', endDate: '' });
  const [viewMode, setViewMode] = useState('both');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [reportData, setReportData] = useState({ data: [], aggregates: {}, trend: [], filterInfo: {}, pagination: {} });
  const [currentPage, setCurrentPage] = useState(1);

  const fetchReport = async (page = currentPage) => {
    setLoading(true);
    try {
      const params = {
        page,
        pageSize: 20,
        datePreset: dateFilter.datePreset || dateFilter.preset,
        startDate: dateFilter.startDate,
        endDate: dateFilter.endDate
      };
      const res = await api.get('/reports/sales-summary', { params });
      setReportData(res.data || { data: [], aggregates: {}, trend: [], filterInfo: {}, pagination: {} });
    } catch (err) {
      console.error('Failed to load sales summary report', err);
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
  const orders = reportData.data || [];
  const trendData = reportData.trend || [];

  const filteredOrders = orders.filter(o => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    const ordNum = (o.orderNumber || '').toLowerCase();
    const custName = (o.customer?.name || '').toLowerCase();
    return ordNum.includes(term) || custName.includes(term);
  });

  const columns = [
    { header: 'Order #', accessor: (r) => r.orderNumber || 'N/A' },
    { header: 'Customer', accessor: (r) => r.customer?.name || 'Walk-in Customer' },
    { header: 'Date', accessor: (r) => r.createdAt ? new Date(r.createdAt).toLocaleDateString('en-IN') : '-' },
    { header: 'Items', accessor: (r) => r.items?.length || 0 },
    { header: 'Total (₹)', accessor: (r) => `₹${Number(r.grandTotal || 0).toLocaleString('en-IN')}` },
    { header: 'Type', accessor: (r) => r.type || 'Invoice' },
    { header: 'Status', accessor: (r) => r.status || 'Confirmed' }
  ];

  const handleExportCSV = () => {
    exportToCSV('Sales_Summary_Report', columns, filteredOrders);
  };

  const handleExportExcel = () => {
    exportToExcel('Sales_Summary_Report', 'Sales Summary', columns, filteredOrders);
  };

  const handleExportPDF = () => {
    exportToPDF({
      title: 'Sales & Revenue Summary Report',
      subtitle: `Period: ${reportData.filterInfo?.label || 'Custom'} (${reportData.filterInfo?.startDate?.split('T')[0]} to ${reportData.filterInfo?.endDate?.split('T')[0]})`,
      columns,
      data: filteredOrders,
      companyName,
      summaryCards: [
        { label: 'Total Revenue', value: `₹${Number(aggs.totalRevenue || 0).toLocaleString('en-IN')}` },
        { label: 'Total Orders', value: aggs.totalOrders || 0 },
        { label: 'Units Sold', value: aggs.totalUnitsSold || '0' },
        { label: 'Avg Order Value', value: `₹${Number(aggs.avgOrderValue || 0).toLocaleString('en-IN')}` }
      ]
    });
  };

  return (
    <div className="w-full max-w-full px-3 sm:px-5 py-3 space-y-3 mx-auto text-xs">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 pb-2 border-b border-slate-200/80 dark:border-slate-800">
        <div>
          <h1 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-emerald-500 shrink-0" />
            Sales &amp; Revenue Summary Report
          </h1>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Revenue trends, orders volume, units dispatched, and average transaction metrics.
          </p>
        </div>
        <div className="flex items-center gap-1.5 self-start sm:self-auto flex-wrap">
          <ReportViewSwitcher viewMode={viewMode} onChange={setViewMode} />
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
            className="h-8 px-2.5 rounded-lg border-slate-200 dark:border-slate-800 text-[11px] font-semibold"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-500 mr-1" />
            CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportExcel}
            className="h-8 px-2.5 rounded-lg border-slate-200 dark:border-slate-800 text-[11px] font-semibold"
          >
            <Download className="w-3.5 h-3.5 text-blue-500 mr-1" />
            Excel
          </Button>
          <Button
            size="sm"
            onClick={handleExportPDF}
            className="h-8 px-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold shadow-xs"
          >
            <FileText className="w-3.5 h-3.5 mr-1" />
            PDF
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
        <Card className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl shadow-2xs">
          <CardContent className="p-3 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Sales Revenue</p>
              <h3 className="text-base sm:text-lg font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
                ₹{Number(aggs.totalRevenue || 0).toLocaleString('en-IN')}
              </h3>
            </div>
            <div className="p-2 bg-emerald-500/10 text-emerald-500 rounded-lg">
              <DollarSign className="w-4 h-4" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl shadow-2xs">
          <CardContent className="p-3 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Orders</p>
              <h3 className="text-base sm:text-lg font-black text-indigo-600 dark:text-indigo-400 mt-0.5">
                {aggs.totalOrders || 0}
              </h3>
            </div>
            <div className="p-2 bg-indigo-500/10 text-indigo-500 rounded-xl">
              <ShoppingCart className="w-4 h-4" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl shadow-2xs">
          <CardContent className="p-3 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Units Dispatched</p>
              <h3 className="text-base sm:text-lg font-black text-blue-600 dark:text-blue-400 mt-0.5">
                {Number(aggs.totalUnitsSold || 0).toLocaleString()}
              </h3>
            </div>
            <div className="p-2 bg-blue-500/10 text-blue-500 rounded-xl">
              <TrendingUp className="w-4 h-4" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl shadow-2xs">
          <CardContent className="p-3 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Avg Order Value</p>
              <h3 className="text-base sm:text-lg font-black text-amber-600 dark:text-amber-400 mt-0.5">
                ₹{Number(aggs.avgOrderValue || 0).toLocaleString('en-IN')}
              </h3>
            </div>
            <div className="p-2 bg-amber-500/10 text-amber-500 rounded-xl">
              <CreditCard className="w-4 h-4" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Date Filter & Search */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 bg-white dark:bg-slate-900 p-2 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-2xs">
        <DateRangeFilter
          value={dateFilter}
          onChange={setDateFilter}
        />

        <div className="flex items-center gap-1.5">
          <div className="relative w-full sm:w-60">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search order # or customer..."
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
          <Card className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl shadow-2xs p-3">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-bold text-xs text-slate-900 dark:text-white flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
                Daily Revenue Trend
              </h3>
            </div>
            <div className="h-48 sm:h-52 w-full">
              {trendData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trendData} margin={{ top: 5, right: 15, left: -10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="salesGradCompact" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.12} />
                    <XAxis dataKey="date" tick={{ fontSize: 9 }} stroke="#64748b" />
                    <YAxis tick={{ fontSize: 9 }} stroke="#64748b" tickFormatter={(v) => `₹${v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}`} />
                    <RechartsTooltip 
                      formatter={(val) => [`₹${Number(val).toLocaleString('en-IN')}`, 'Revenue']}
                      contentStyle={{ backgroundColor: '#0f172a', borderRadius: '8px', border: '1px solid #334155', color: '#fff', fontSize: '11px', padding: '6px 10px' }}
                    />
                    <Area type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#salesGradCompact)" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-slate-400 text-xs">
                  No trend data available for selected period.
                </div>
              )}
            </div>
          </Card>

          <Card className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl shadow-2xs p-3">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-bold text-xs text-slate-900 dark:text-white flex items-center gap-1.5">
                <BarChart2 className="w-3.5 h-3.5 text-indigo-500" />
                Recent Order Size (₹)
              </h3>
            </div>
            <div className="h-48 sm:h-52 w-full">
              {filteredOrders.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={filteredOrders.slice(0, 6)} margin={{ top: 5, right: 10, left: -15, bottom: 15 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.12} />
                    <XAxis dataKey="orderNumber" tick={{ fontSize: 8 }} angle={-20} textAnchor="end" stroke="#64748b" />
                    <YAxis tick={{ fontSize: 9 }} stroke="#64748b" tickFormatter={(v) => `₹${v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}`} />
                    <RechartsTooltip 
                      formatter={(val) => [`₹${Number(val).toLocaleString('en-IN')}`, 'Grand Total']}
                      contentStyle={{ backgroundColor: '#0f172a', borderRadius: '8px', border: '1px solid #334155', color: '#fff', fontSize: '11px', padding: '6px 10px' }}
                    />
                    <Bar dataKey="grandTotal" fill="#6366f1" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-slate-400 text-xs">
                  No orders recorded.
                </div>
              )}
            </div>
          </Card>
        </div>
      )}

      {/* TABLE VIEW */}
      {(viewMode === 'table' || viewMode === 'both') && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/75 dark:bg-slate-800/40 text-slate-500 dark:text-slate-400 font-semibold text-[11px]">
                  <th className="py-2.5 px-3">Order #</th>
                  <th className="py-2.5 px-3">Customer</th>
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3 text-center">Items</th>
                  <th className="py-2.5 px-3 text-right">Grand Total</th>
                  <th className="py-2.5 px-3 text-center">Type</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-[11.5px] font-medium">
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td colSpan={7} className="py-3 px-3 bg-slate-50/40 dark:bg-slate-800/20">
                        <div className="h-3.5 bg-slate-200 dark:bg-slate-700 rounded w-full"></div>
                      </td>
                    </tr>
                  ))
                ) : filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-slate-400 dark:text-slate-500">
                      <DollarSign className="w-8 h-8 mx-auto mb-1.5 opacity-30" />
                      No sales orders found for the selected period.
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map((ord) => (
                    <tr key={ord.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="py-2 px-3 font-mono font-semibold text-slate-900 dark:text-white">
                        {ord.orderNumber || 'N/A'}
                      </td>
                      <td className="py-2 px-3 text-slate-700 dark:text-slate-300">
                        {ord.customer?.name || 'Walk-in Customer'}
                      </td>
                      <td className="py-2 px-3 text-slate-500 dark:text-slate-400 text-[11px]">
                        {ord.createdAt ? new Date(ord.createdAt).toLocaleDateString('en-IN') : '-'}
                      </td>
                      <td className="py-2 px-3 text-center text-slate-600 dark:text-slate-300">
                        {ord.items?.length || 0}
                      </td>
                      <td className="py-2 px-3 text-right font-bold text-slate-900 dark:text-white">
                        ₹{Number(ord.grandTotal || 0).toLocaleString('en-IN')}
                      </td>
                      <td className="py-2 px-3 text-center text-slate-500 dark:text-slate-400">
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                          {ord.type || 'Invoice'}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-center">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          (ord.status || '').toLowerCase() === 'confirmed' || (ord.status || '').toLowerCase() === 'completed'
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                            : 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                        }`}>
                          {ord.status || 'Confirmed'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Compact Pagination Bar */}
          <div className="border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40">
            <Pagination
              currentPage={reportData.pagination?.page || 1}
              totalPages={reportData.pagination?.totalPages || 1}
              totalRecords={reportData.pagination?.totalRecords || filteredOrders.length}
              pageSize={reportData.pagination?.pageSize || 20}
              onPageChange={handlePageChange}
            />
          </div>
        </div>
      )}
    </div>
  );
}
