import React, { useState, useEffect } from 'react';
import { api } from '@/lib/axios';
import { 
  Package, Download, FileSpreadsheet, FileText, Search, RefreshCw, 
  AlertTriangle, CheckCircle2, TrendingUp, Layers, DollarSign, XCircle, BarChart2, PieChart as PieIcon
} from 'lucide-react';
import { 
  ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, 
  CartesianGrid, Tooltip as RechartsTooltip, Legend 
} from 'recharts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Pagination } from '@/components/ui/Pagination';
import ReportViewSwitcher from '@/components/reports/ReportViewSwitcher';
import { exportToCSV, exportToExcel, exportToPDF } from '@/utils/reportExportUtils';
import useCompanyStore from '@/app/store/companyStore';

const HEALTH_COLORS = {
  'In Stock': '#10b981',
  'Low Stock': '#f59e0b',
  'Out of Stock': '#ef4444',
  'Overstocked': '#6366f1'
};

export default function ProductStockReportPage() {
  const companyName = useCompanyStore(s => s.company?.companyName) || 'Manufacturing ERP';

  const [stockStatus, setStockStatus] = useState('All');
  const [viewMode, setViewMode] = useState('both');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [reportData, setReportData] = useState({ data: [], aggregates: {}, pagination: {} });
  const [currentPage, setCurrentPage] = useState(1);

  const fetchReport = async (page = currentPage) => {
    setLoading(true);
    try {
      const params = {
        page,
        pageSize: 20,
        stockStatus: stockStatus !== 'All' ? stockStatus : undefined,
        search: searchTerm.trim() || undefined
      };
      const res = await api.get('/reports/product-stock', { params });
      setReportData(res.data || { data: [], aggregates: {}, pagination: {} });
    } catch (err) {
      console.error('Failed to load product stock report', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport(1);
    setCurrentPage(1);
  }, [stockStatus]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchReport(1);
    setCurrentPage(1);
  };

  const handlePageChange = (p) => {
    setCurrentPage(p);
    fetchReport(p);
  };

  const aggs = reportData.aggregates || {};
  const items = reportData.data || [];

  const healthDistributionData = [
    { name: 'In Stock', value: aggs.inStockCount || 0, color: HEALTH_COLORS['In Stock'] },
    { name: 'Low Stock', value: aggs.lowStockCount || 0, color: HEALTH_COLORS['Low Stock'] },
    { name: 'Out of Stock', value: aggs.outOfStockCount || 0, color: HEALTH_COLORS['Out of Stock'] }
  ].filter(d => d.value > 0);

  const topValuedProducts = [...items]
    .sort((a, b) => (b.stockValueAtCost || 0) - (a.stockValueAtCost || 0))
    .slice(0, 7)
    .map(p => ({
      name: p.name.length > 12 ? `${p.name.substring(0, 12)}...` : p.name,
      valuation: p.stockValueAtCost || 0,
      stock: p.currentStock || 0
    }));

  const columns = [
    { header: 'Product Code', accessor: (r) => r.code || 'N/A' },
    { header: 'Product Name', accessor: (r) => r.name || '' },
    { header: 'Category', accessor: (r) => r.category?.name || 'General' },
    { header: 'Stock On Hand', accessor: (r) => `${Number(r.currentStock || 0).toFixed(0)} ${r.unit?.symbol || ''}` },
    { header: 'Alert Level', accessor: (r) => Number(r.alertLevel || 0).toFixed(0) },
    { header: 'Unit Cost', accessor: (r) => `₹${Number(r.totalCost || 0).toFixed(2)}` },
    { header: 'Valuation @ Cost', accessor: (r) => `₹${Number(r.stockValueAtCost || 0).toLocaleString('en-IN')}` },
    { header: 'Selling Price', accessor: (r) => `₹${Number(r.salePrice || 0).toFixed(2)}` },
    { header: 'Valuation @ Sale', accessor: (r) => `₹${Number(r.stockValueAtSale || 0).toLocaleString('en-IN')}` },
    { header: 'Reorder Need', accessor: (r) => r.reorderQty > 0 ? `${r.reorderQty} units` : '-' },
    { header: 'Health Status', accessor: (r) => r.healthStatus || 'In Stock' }
  ];

  const handleExportCSV = () => {
    exportToCSV('Product_Stock_Valuation_Report', columns, items);
  };

  const handleExportExcel = () => {
    exportToExcel('Product_Stock_Valuation_Report', 'Stock Valuation', columns, items);
  };

  const handleExportPDF = () => {
    exportToPDF({
      title: 'Finished Goods Product Stock & Valuation Report',
      subtitle: `Filter: ${stockStatus} | Total Products: ${aggs.totalProducts || 0}`,
      columns,
      data: items,
      companyName,
      summaryCards: [
        { label: 'Inventory Cost Value', value: `₹${Number(aggs.totalInventoryCostValue || 0).toLocaleString('en-IN')}` },
        { label: 'Potential Sales Value', value: `₹${Number(aggs.totalPotentialSalesValue || 0).toLocaleString('en-IN')}` },
        { label: 'Low Stock Alerts', value: aggs.lowStockCount || 0 },
        { label: 'Out of Stock', value: aggs.outOfStockCount || 0 }
      ]
    });
  };

  return (
    <div className="w-full max-w-full px-3 sm:px-5 py-3 space-y-3 mx-auto text-xs">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 pb-2 border-b border-slate-200/80 dark:border-slate-800">
        <div>
          <h1 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <Package className="w-5 h-5 text-emerald-500 shrink-0" />
            Product Stock &amp; Valuation Report
          </h1>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Real-time finished goods inventory count, cost valuation, and reorder levels.
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
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Inventory Valuation @ Cost</p>
              <h3 className="text-base sm:text-lg font-black text-indigo-600 dark:text-indigo-400 mt-0.5">
                ₹{Number(aggs.totalInventoryCostValue || 0).toLocaleString('en-IN')}
              </h3>
            </div>
            <div className="p-2 bg-indigo-500/10 text-indigo-500 rounded-lg">
              <DollarSign className="w-4 h-4" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl shadow-2xs">
          <CardContent className="p-3 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Potential Sales Value</p>
              <h3 className="text-base sm:text-lg font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
                ₹{Number(aggs.totalPotentialSalesValue || 0).toLocaleString('en-IN')}
              </h3>
            </div>
            <div className="p-2 bg-emerald-500/10 text-emerald-500 rounded-lg">
              <TrendingUp className="w-4 h-4" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl shadow-2xs">
          <CardContent className="p-3 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Low Stock Alerts</p>
              <h3 className="text-base sm:text-lg font-black text-amber-500 mt-0.5">
                {aggs.lowStockCount || 0}
              </h3>
            </div>
            <div className="p-2 bg-amber-500/10 text-amber-500 rounded-lg">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl shadow-2xs">
          <CardContent className="p-3 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Out of Stock</p>
              <h3 className="text-base sm:text-lg font-black text-rose-500 mt-0.5">
                {aggs.outOfStockCount || 0}
              </h3>
            </div>
            <div className="p-2 bg-rose-500/10 text-rose-500 rounded-lg">
              <XCircle className="w-4 h-4" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 bg-white dark:bg-slate-900 p-2 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-2xs">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 sm:pb-0">
          {['All', 'In Stock', 'Low Stock', 'Out of Stock'].map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setStockStatus(status)}
              className={`h-7 px-2.5 rounded-lg text-[11px] font-semibold shrink-0 transition-all ${
                stockStatus === status
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              {status}
            </button>
          ))}
        </div>

        <form onSubmit={handleSearchSubmit} className="flex items-center gap-1.5">
          <div className="relative w-full sm:w-60">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search code or name..."
              className="h-8 pl-8 text-xs rounded-lg bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700"
            />
          </div>
          <Button
            type="submit"
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </form>
      </div>

      {/* CHART VIEW */}
      {(viewMode === 'chart' || viewMode === 'both') && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <Card className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl shadow-2xs p-3">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-bold text-xs text-slate-900 dark:text-white flex items-center gap-1.5">
                <BarChart2 className="w-3.5 h-3.5 text-indigo-500" />
                Top Products by Valuation @ Cost (₹)
              </h3>
            </div>
            <div className="h-48 sm:h-52 w-full">
              {topValuedProducts.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topValuedProducts} margin={{ top: 5, right: 10, left: 10, bottom: 15 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.12} />
                    <XAxis dataKey="name" tick={{ fontSize: 9 }} angle={-20} textAnchor="end" stroke="#64748b" />
                    <YAxis tick={{ fontSize: 9 }} stroke="#64748b" tickFormatter={(v) => `₹${v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}`} />
                    <RechartsTooltip 
                      formatter={(val) => [`₹${Number(val).toLocaleString('en-IN')}`, 'Valuation']}
                      contentStyle={{ backgroundColor: '#0f172a', borderRadius: '8px', border: '1px solid #334155', color: '#fff', fontSize: '11px', padding: '6px 10px' }}
                    />
                    <Bar dataKey="valuation" fill="#6366f1" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-slate-400 text-xs">
                  No stock valuation records available.
                </div>
              )}
            </div>
          </Card>

          <Card className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl shadow-2xs p-3">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-bold text-xs text-slate-900 dark:text-white flex items-center gap-1.5">
                <PieIcon className="w-3.5 h-3.5 text-emerald-500" />
                Stock Health Distribution
              </h3>
            </div>
            <div className="h-48 sm:h-52 w-full flex items-center justify-center">
              {healthDistributionData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={healthDistributionData}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={70}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {healthDistributionData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <RechartsTooltip 
                      formatter={(val, name) => [`${val} Products`, name]}
                      contentStyle={{ backgroundColor: '#0f172a', borderRadius: '8px', border: '1px solid #334155', color: '#fff', fontSize: '11px', padding: '6px 10px' }}
                    />
                    <Legend 
                      verticalAlign="bottom" 
                      height={28} 
                      formatter={(val) => <span className="text-[10px] text-slate-600 dark:text-slate-300">{val}</span>}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-slate-400 text-xs">No health distribution data available.</div>
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
                  <th className="py-2.5 px-3">Product Code</th>
                  <th className="py-2.5 px-3">Product Name</th>
                  <th className="py-2.5 px-3">Category</th>
                  <th className="py-2.5 px-3 text-right">Stock On Hand</th>
                  <th className="py-2.5 px-3 text-right">Alert Level</th>
                  <th className="py-2.5 px-3 text-right">Unit Cost</th>
                  <th className="py-2.5 px-3 text-right">Valuation @ Cost</th>
                  <th className="py-2.5 px-3 text-right">Selling Price</th>
                  <th className="py-2.5 px-3 text-right">Valuation @ Sale</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                  <th className="py-2.5 px-3 text-center">Reorder Need</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-[11.5px] font-medium">
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td colSpan={11} className="py-3 px-3 bg-slate-50/40 dark:bg-slate-800/20">
                        <div className="h-3.5 bg-slate-200 dark:bg-slate-700 rounded w-full"></div>
                      </td>
                    </tr>
                  ))
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="py-10 text-center text-slate-400 dark:text-slate-500">
                      <Package className="w-8 h-8 mx-auto mb-1.5 opacity-30" />
                      No products found matching the criteria.
                    </td>
                  </tr>
                ) : (
                  items.map((prod) => (
                    <tr key={prod.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="py-2 px-3 font-mono font-semibold text-slate-900 dark:text-white">
                        {prod.code || 'N/A'}
                      </td>
                      <td className="py-2 px-3 text-slate-900 dark:text-white font-medium">
                        {prod.name}
                      </td>
                      <td className="py-2 px-3 text-slate-500 dark:text-slate-400">
                        {prod.category?.name || 'General'}
                      </td>
                      <td className="py-2 px-3 text-right font-semibold text-slate-900 dark:text-white">
                        {Number(prod.currentStock || 0).toLocaleString()} {prod.unit?.symbol || ''}
                      </td>
                      <td className="py-2 px-3 text-right text-slate-500 dark:text-slate-400">
                        {Number(prod.alertLevel || 0).toLocaleString()}
                      </td>
                      <td className="py-2 px-3 text-right text-slate-600 dark:text-slate-300">
                        ₹{Number(prod.totalCost || 0).toFixed(2)}
                      </td>
                      <td className="py-2 px-3 text-right font-bold text-slate-900 dark:text-white">
                        ₹{Number(prod.stockValueAtCost || 0).toLocaleString('en-IN')}
                      </td>
                      <td className="py-2 px-3 text-right text-slate-600 dark:text-slate-300">
                        ₹{Number(prod.salePrice || 0).toFixed(2)}
                      </td>
                      <td className="py-2 px-3 text-right font-bold text-emerald-600 dark:text-emerald-400">
                        ₹{Number(prod.stockValueAtSale || 0).toLocaleString('en-IN')}
                      </td>
                      <td className="py-2 px-3 text-center">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          prod.healthStatus === 'In Stock'
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                            : prod.healthStatus === 'Low Stock'
                            ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                            : 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                        }`}>
                          {prod.healthStatus}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-center text-slate-600 dark:text-slate-300">
                        {prod.reorderQty > 0 ? (
                          <span className="font-bold text-amber-600 dark:text-amber-400">
                            {prod.reorderQty} units
                          </span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
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
