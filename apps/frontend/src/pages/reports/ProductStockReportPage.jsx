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

  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [healthFilter, setHealthFilter] = useState('All');
  const [viewMode, setViewMode] = useState('both');
  const [chartMode, setChartMode] = useState('category'); // 'category', 'stockVsAlert'
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [reportData, setReportData] = useState({ data: [], aggregates: {}, pagination: {} });
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    const fetchCats = async () => {
      try {
        const res = await api.get('/categories');
        if (res.data?.data) {
          setCategories(res.data.data);
        } else if (Array.isArray(res.data)) {
          setCategories(res.data);
        }
      } catch (err) {
        // Fallback gracefully
      }
    };
    fetchCats();
  }, []);

  const fetchReport = async (page = currentPage) => {
    setLoading(true);
    try {
      const params = {
        page,
        pageSize: 20,
        categoryId: selectedCategory !== 'All' ? selectedCategory : undefined,
        healthStatus: healthFilter !== 'All' ? healthFilter : undefined,
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
  }, [selectedCategory, healthFilter]);

  const handlePageChange = (p) => {
    setCurrentPage(p);
    fetchReport(p);
  };

  const aggs = reportData.aggregates || {};
  const items = reportData.data || [];

  // 1. Stock Valuation by Category (Cost vs Sale)
  const categoryValMap = {};
  items.forEach(p => {
    const cat = p.category?.name || 'General';
    if (!categoryValMap[cat]) {
      categoryValMap[cat] = {
        name: cat.length > 12 ? `${cat.substring(0, 12)}...` : cat,
        fullName: cat,
        costValuation: 0,
        saleValuation: 0
      };
    }
    categoryValMap[cat].costValuation += Number(p.stockValueAtCost || 0);
    categoryValMap[cat].saleValuation += Number(p.stockValueAtSale || 0);
  });
  const categoryChartData = Object.values(categoryValMap).slice(0, 6);

  // 2. Stock Level vs Alert Level Comparison
  const stockVsAlertData = items.slice(0, 7).map(p => ({
    name: p.name.length > 11 ? `${p.name.substring(0, 11)}...` : p.name,
    fullName: p.name,
    currentStock: Number(p.currentStock || 0),
    alertLevel: Number(p.alertLevel || 0)
  }));

  // 3. Health Distribution Donut
  const healthDistributionData = [
    { name: 'In Stock', value: aggs.inStockCount || 0, color: HEALTH_COLORS['In Stock'] },
    { name: 'Low Stock', value: aggs.lowStockCount || 0, color: HEALTH_COLORS['Low Stock'] },
    { name: 'Out of Stock', value: aggs.outOfStockCount || 0, color: HEALTH_COLORS['Out of Stock'] }
  ].filter(d => d.value > 0);

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
      title: 'Finished Product Stock & Inventory Valuation Report',
      subtitle: `Category: ${selectedCategory !== 'All' ? selectedCategory : 'All'} | Status: ${healthFilter}`,
      columns,
      data: items,
      companyName,
      summaryCards: [
        { label: 'Total Valuation @ Cost', value: `₹${Number(aggs.totalValuationAtCost || 0).toLocaleString('en-IN')}` },
        { label: 'Total Valuation @ Sale', value: `₹${Number(aggs.totalValuationAtSale || 0).toLocaleString('en-IN')}` },
        { label: 'Potential Margin', value: `₹${Number(aggs.potentialMargin || 0).toLocaleString('en-IN')}` },
        { label: 'Low/Out of Stock', value: (aggs.lowStockCount || 0) + (aggs.outOfStockCount || 0) }
      ]
    });
  };

  return (
    <div className="w-full max-w-full px-3 sm:px-5 py-3 space-y-3 mx-auto text-xs">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 pb-2.5 border-b border-slate-200/80 dark:border-slate-800">
        <div>
          <h1 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <Package className="w-5 h-5 text-indigo-500 shrink-0" />
            Product Stock &amp; Inventory Valuation Report
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Audit inventory health, capital valuation at cost vs. sale, and reorder levels.
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
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Value @ Cost</p>
              <h3 className="text-base sm:text-xl font-black text-slate-900 dark:text-white mt-0.5">
                ₹{Number(aggs.totalValuationAtCost || 0).toLocaleString('en-IN')}
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
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Value @ Sale</p>
              <h3 className="text-base sm:text-xl font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
                ₹{Number(aggs.totalValuationAtSale || 0).toLocaleString('en-IN')}
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
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Potential Margin</p>
              <h3 className="text-base sm:text-xl font-black text-indigo-600 dark:text-indigo-400 mt-0.5">
                ₹{Number(aggs.potentialMargin || 0).toLocaleString('en-IN')}
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
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Attention Required</p>
              <h3 className="text-base sm:text-xl font-black text-amber-600 dark:text-amber-400 mt-0.5">
                {(aggs.lowStockCount || 0) + (aggs.outOfStockCount || 0)} items
              </h3>
            </div>
            <div className="p-2 bg-amber-500/10 text-amber-500 rounded-lg">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 bg-white dark:bg-slate-900 p-2 sm:p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="h-8 px-2.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
          >
            <option value="All">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          <select
            value={healthFilter}
            onChange={(e) => setHealthFilter(e.target.value)}
            className="h-8 px-2.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
          >
            <option value="All">All Health Statuses</option>
            <option value="In Stock">In Stock</option>
            <option value="Low Stock">Low Stock</option>
            <option value="Out of Stock">Out of Stock</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative w-full sm:w-60">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchReport(1)}
              placeholder="Search product or code..."
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
          {/* Main Chart: Category Valuation (Cost vs Sale) OR Stock vs Alert Level */}
          <Card className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl shadow-xs p-3 sm:p-3.5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
              <div>
                <h3 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                  <BarChart2 className="w-4 h-4 text-indigo-500" />
                  {chartMode === 'category' ? 'Stock Valuation by Category (Cost vs Sale ₹)' : 'Current Stock vs Reorder Alert Level'}
                </h3>
                <p className="text-[10.5px] text-slate-500 dark:text-slate-400">
                  {chartMode === 'category' ? 'Compare inventory investment vs gross realization potential' : 'Monitor products nearing minimum stock threshold'}
                </p>
              </div>

              {/* Chart Mode Switcher */}
              <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700 self-start sm:self-auto">
                <button
                  onClick={() => setChartMode('category')}
                  className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-all ${
                    chartMode === 'category'
                      ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-xs'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Category Valuation
                </button>
                <button
                  onClick={() => setChartMode('stockVsAlert')}
                  className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-all ${
                    chartMode === 'stockVsAlert'
                      ? 'bg-white dark:bg-slate-700 text-amber-600 dark:text-amber-400 shadow-xs'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Stock vs Alert
                </button>
              </div>
            </div>

            <div className="h-52 sm:h-56 w-full">
              {items.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  {chartMode === 'category' ? (
                    /* Grouped Bar: Valuation @ Cost vs Valuation @ Sale */
                    <BarChart data={categoryChartData} margin={{ top: 5, right: 10, left: 10, bottom: 15 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.12} />
                      <XAxis dataKey="name" tick={{ fontSize: 9 }} angle={-15} textAnchor="end" stroke="#64748b" />
                      <YAxis tick={{ fontSize: 9 }} stroke="#64748b" tickFormatter={(v) => `₹${v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}`} />
                      <RechartsTooltip 
                        formatter={(val, name) => [`₹${Number(val).toLocaleString('en-IN')}`, name]}
                        contentStyle={{ backgroundColor: '#0f172a', borderRadius: '8px', border: '1px solid #334155', color: '#fff', fontSize: '11px', padding: '6px 10px' }}
                      />
                      <Legend verticalAlign="top" height={24} iconSize={8} wrapperStyle={{ fontSize: '11px' }} />
                      <Bar dataKey="costValuation" name="Valuation @ Cost" fill="#6366f1" radius={[3, 3, 0, 0]} />
                      <Bar dataKey="saleValuation" name="Valuation @ Sale" fill="#10b981" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  ) : (
                    /* Grouped Bar: Current Stock vs Alert Level */
                    <BarChart data={stockVsAlertData} margin={{ top: 5, right: 10, left: -5, bottom: 15 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.12} />
                      <XAxis dataKey="name" tick={{ fontSize: 9 }} angle={-20} textAnchor="end" stroke="#64748b" />
                      <YAxis tick={{ fontSize: 9 }} stroke="#64748b" />
                      <RechartsTooltip 
                        formatter={(val, name) => [Number(val).toLocaleString(), name]}
                        contentStyle={{ backgroundColor: '#0f172a', borderRadius: '8px', border: '1px solid #334155', color: '#fff', fontSize: '11px', padding: '6px 10px' }}
                      />
                      <Legend verticalAlign="top" height={24} iconSize={8} wrapperStyle={{ fontSize: '11px' }} />
                      <Bar dataKey="currentStock" name="Current Stock" fill="#3b82f6" radius={[3, 3, 0, 0]} />
                      <Bar dataKey="alertLevel" name="Alert Level" fill="#f59e0b" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  )}
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-slate-400 text-xs">
                  No stock data available.
                </div>
              )}
            </div>
          </Card>

          {/* Secondary Part-to-Whole Donut: Stock Health Distribution */}
          <Card className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl shadow-xs p-3 sm:p-3.5">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h3 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                  <PieIcon className="w-4 h-4 text-emerald-500" />
                  Inventory Health Distribution
                </h3>
                <p className="text-[10.5px] text-slate-500 dark:text-slate-400">In Stock vs Low Stock vs Depleted</p>
              </div>
            </div>
            <div className="h-52 sm:h-56 w-full flex items-center justify-center">
              {healthDistributionData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={healthDistributionData}
                      cx="50%"
                      cy="46%"
                      innerRadius={46}
                      outerRadius={68}
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
                      height={32} 
                      iconSize={8}
                      formatter={(val) => <span className="text-[10.5px] text-slate-600 dark:text-slate-300">{val}</span>}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-slate-400 text-xs">No health status records.</div>
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
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-8 text-center text-slate-400 dark:text-slate-500">
                      <Package className="w-8 h-8 mx-auto mb-1.5 opacity-30" />
                      No product inventory found matching the filters.
                    </td>
                  </tr>
                ) : (
                  items.map((prod) => (
                    <tr key={prod.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="py-2 px-3 font-mono font-semibold text-slate-900 dark:text-white">
                        {prod.code || 'N/A'}
                      </td>
                      <td className="py-2 px-3 font-medium text-slate-900 dark:text-white">
                        {prod.name}
                      </td>
                      <td className="py-2 px-3 text-slate-500 dark:text-slate-400">
                        {prod.category?.name || 'General'}
                      </td>
                      <td className="py-2 px-3 text-right font-bold text-slate-900 dark:text-white">
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
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-semibold ${
                          prod.healthStatus === 'In Stock'
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                            : prod.healthStatus === 'Low Stock'
                            ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                            : 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                        }`}>
                          {prod.healthStatus || 'In Stock'}
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
