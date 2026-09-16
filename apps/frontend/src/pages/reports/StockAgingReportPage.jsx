import React, { useState, useEffect } from 'react';
import { api } from '@/lib/axios';
import { 
  Clock, Download, FileSpreadsheet, FileText, Search, RefreshCw, 
  AlertTriangle, ShieldAlert, CheckCircle2, DollarSign, Archive, Layers, BarChart2, PieChart as PieIcon
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

const BUCKET_COLORS = {
  '0-30': '#10b981',
  '31-60': '#3b82f6',
  '61-90': '#f59e0b',
  '90+': '#ef4444'
};

export default function StockAgingReportPage() {
  const companyName = useCompanyStore(s => s.company?.companyName) || 'Manufacturing ERP';

  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedBucket, setSelectedBucket] = useState('All');
  const [viewMode, setViewMode] = useState('both');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [reportData, setReportData] = useState({ data: [], buckets: {}, pagination: {} });
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
        // Silent fallback
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
        categoryId: selectedCategory !== 'All' ? selectedCategory : undefined
      };
      const res = await api.get('/reports/stock-aging', { params });
      setReportData(res.data || { data: [], buckets: {}, pagination: {} });
    } catch (err) {
      console.error('Failed to load stock aging report', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport(1);
    setCurrentPage(1);
  }, [selectedCategory]);

  const handlePageChange = (p) => {
    setCurrentPage(p);
    fetchReport(p);
  };

  const buckets = reportData.buckets || {
    '0-30': { count: 0, totalValuation: 0 },
    '31-60': { count: 0, totalValuation: 0 },
    '61-90': { count: 0, totalValuation: 0 },
    '90+': { count: 0, totalValuation: 0 }
  };

  let items = reportData.data || [];
  if (selectedBucket !== 'All') {
    items = items.filter(r => r.agingBucket === selectedBucket);
  }
  if (searchTerm.trim()) {
    const q = searchTerm.toLowerCase();
    items = items.filter(r => 
      (r.name && r.name.toLowerCase().includes(q)) || 
      (r.code && r.code.toLowerCase().includes(q)) ||
      (r.category && r.category.toLowerCase().includes(q))
    );
  }

  // Prepare chart datasets
  const agingBucketBarData = [
    { name: '0-30d (Fresh)', valuation: buckets['0-30']?.totalValuation || 0, fill: BUCKET_COLORS['0-30'] },
    { name: '31-60d (Normal)', valuation: buckets['31-60']?.totalValuation || 0, fill: BUCKET_COLORS['31-60'] },
    { name: '61-90d (Slow)', valuation: buckets['61-90']?.totalValuation || 0, fill: BUCKET_COLORS['61-90'] },
    { name: '90+d (Critical)', valuation: buckets['90+']?.totalValuation || 0, fill: BUCKET_COLORS['90+'] }
  ];

  const agingCountPieData = [
    { name: '0-30 Days', value: buckets['0-30']?.count || 0, color: BUCKET_COLORS['0-30'] },
    { name: '31-60 Days', value: buckets['31-60']?.count || 0, color: BUCKET_COLORS['31-60'] },
    { name: '61-90 Days', value: buckets['61-90']?.count || 0, color: BUCKET_COLORS['61-90'] },
    { name: '90+ Days', value: buckets['90+']?.count || 0, color: BUCKET_COLORS['90+'] }
  ].filter(d => d.value > 0);

  const columns = [
    { header: 'Product Code', accessor: (r) => r.code || 'N/A' },
    { header: 'Product Name', accessor: (r) => r.name || '' },
    { header: 'Category', accessor: (r) => r.category || 'General' },
    { header: 'Current Stock', accessor: (r) => Number(r.currentStock || 0).toLocaleString() },
    { header: 'Unit Cost', accessor: (r) => `₹${Number(r.totalCost || 0).toFixed(2)}` },
    { header: 'Stock Valuation', accessor: (r) => `₹${Number(r.stockValuation || 0).toLocaleString('en-IN')}` },
    { header: 'Age (Days)', accessor: (r) => `${r.ageDays} days` },
    { header: 'Aging Bucket', accessor: (r) => r.agingBucket },
    { header: 'Last Production', accessor: (r) => r.lastProductionDate ? new Date(r.lastProductionDate).toLocaleDateString() : 'N/A' }
  ];

  const handleExportCSV = () => {
    exportToCSV('Stock_Aging_Analysis_Report', columns, items);
  };

  const handleExportExcel = () => {
    exportToExcel('Stock_Aging_Analysis_Report', 'Stock Aging', columns, items);
  };

  const handleExportPDF = () => {
    exportToPDF({
      title: 'Inventory Stock Aging & Shelf-Life Report',
      subtitle: `Filter: ${selectedCategory !== 'All' ? selectedCategory : 'All Categories'} | Bucket: ${selectedBucket}`,
      columns,
      data: items,
      companyName,
      summaryCards: [
        { label: '0-30 Days (Active)', value: `₹${Number(buckets['0-30']?.totalValuation || 0).toLocaleString('en-IN')} (${buckets['0-30']?.count || 0} items)` },
        { label: '31-60 Days', value: `₹${Number(buckets['31-60']?.totalValuation || 0).toLocaleString('en-IN')} (${buckets['31-60']?.count || 0} items)` },
        { label: '61-90 Days (Slow)', value: `₹${Number(buckets['61-90']?.totalValuation || 0).toLocaleString('en-IN')} (${buckets['61-90']?.count || 0} items)` },
        { label: '90+ Days (Critical)', value: `₹${Number(buckets['90+']?.totalValuation || 0).toLocaleString('en-IN')} (${buckets['90+']?.count || 0} items)` }
      ]
    });
  };

  const getBucketBadge = (bucket) => {
    switch (bucket) {
      case '0-30':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800';
      case '31-60':
        return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800';
      case '61-90':
        return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800';
      case '90+':
        return 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800 font-bold';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300';
    }
  };

  const totalAtRisk = (buckets['61-90']?.totalValuation || 0) + (buckets['90+']?.totalValuation || 0);

  return (
    <div className="w-full max-w-full px-3 sm:px-5 py-3 space-y-3 mx-auto text-xs">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 pb-2.5 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <Clock className="w-5 h-5 text-indigo-500 shrink-0" />
            Stock Aging &amp; Inventory Shelf-Life Report
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Analyze finished inventory age buckets (0–30, 31–60, 61–90, 90+ days), prevent obsolescence, and unlock stagnant capital.
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

      {/* Aging Bucket KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-3">
        {/* 0-30 Days */}
        <Card 
          onClick={() => setSelectedBucket(selectedBucket === '0-30' ? 'All' : '0-30')}
          className={`cursor-pointer transition-all duration-200 bg-white dark:bg-slate-900 border rounded-xl shadow-xs hover:border-emerald-500 ${
            selectedBucket === '0-30' ? 'border-emerald-500 ring-2 ring-emerald-500/20' : 'border-slate-200/80 dark:border-slate-800'
          }`}
        >
          <CardContent className="p-3 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">0 - 30d (Fresh)</p>
              </div>
              <h3 className="text-base sm:text-xl font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
                ₹{Number(buckets['0-30']?.totalValuation || 0).toLocaleString('en-IN')}
              </h3>
              <p className="text-[10px] text-slate-500 mt-0.5">{buckets['0-30']?.count || 0} batches</p>
            </div>
            <div className="p-2 bg-emerald-500/10 text-emerald-500 rounded-lg">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </CardContent>
        </Card>

        {/* 31-60 Days */}
        <Card 
          onClick={() => setSelectedBucket(selectedBucket === '31-60' ? 'All' : '31-60')}
          className={`cursor-pointer transition-all duration-200 bg-white dark:bg-slate-900 border rounded-xl shadow-xs hover:border-blue-500 ${
            selectedBucket === '31-60' ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-slate-200/80 dark:border-slate-800'
          }`}
        >
          <CardContent className="p-3 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">31 - 60d (Normal)</p>
              </div>
              <h3 className="text-base sm:text-xl font-black text-blue-600 dark:text-blue-400 mt-0.5">
                ₹{Number(buckets['31-60']?.totalValuation || 0).toLocaleString('en-IN')}
              </h3>
              <p className="text-[10px] text-slate-500 mt-0.5">{buckets['31-60']?.count || 0} batches</p>
            </div>
            <div className="p-2 bg-blue-500/10 text-blue-500 rounded-lg">
              <Layers className="w-4 h-4" />
            </div>
          </CardContent>
        </Card>

        {/* 61-90 Days */}
        <Card 
          onClick={() => setSelectedBucket(selectedBucket === '61-90' ? 'All' : '61-90')}
          className={`cursor-pointer transition-all duration-200 bg-white dark:bg-slate-900 border rounded-xl shadow-xs hover:border-amber-500 ${
            selectedBucket === '61-90' ? 'border-amber-500 ring-2 ring-amber-500/20' : 'border-slate-200/80 dark:border-slate-800'
          }`}
        >
          <CardContent className="p-3 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">61 - 90d (Slow)</p>
              </div>
              <h3 className="text-base sm:text-xl font-black text-amber-600 dark:text-amber-400 mt-0.5">
                ₹{Number(buckets['61-90']?.totalValuation || 0).toLocaleString('en-IN')}
              </h3>
              <p className="text-[10px] text-slate-500 mt-0.5">{buckets['61-90']?.count || 0} batches</p>
            </div>
            <div className="p-2 bg-amber-500/10 text-amber-500 rounded-lg">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </CardContent>
        </Card>

        {/* 90+ Days */}
        <Card 
          onClick={() => setSelectedBucket(selectedBucket === '90+' ? 'All' : '90+')}
          className={`cursor-pointer transition-all duration-200 bg-white dark:bg-slate-900 border rounded-xl shadow-xs hover:border-rose-500 ${
            selectedBucket === '90+' ? 'border-rose-500 ring-2 ring-rose-500/20' : 'border-slate-200/80 dark:border-slate-800'
          }`}
        >
          <CardContent className="p-3 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">90+d (Critical)</p>
              </div>
              <h3 className="text-base sm:text-xl font-black text-rose-600 dark:text-rose-400 mt-0.5">
                ₹{Number(buckets['90+']?.totalValuation || 0).toLocaleString('en-IN')}
              </h3>
              <p className="text-[10px] text-slate-500 mt-0.5">{buckets['90+']?.count || 0} batches</p>
            </div>
            <div className="p-2 bg-rose-500/10 text-rose-500 rounded-lg">
              <ShieldAlert className="w-4 h-4" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Warning banner if high value in 61+ days */}
      {totalAtRisk > 0 && (
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 rounded-xl p-2.5 flex items-center justify-between text-amber-800 dark:text-amber-300 text-xs">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <span>
              <strong>Capital Attention Required:</strong> ₹{totalAtRisk.toLocaleString('en-IN')} of inventory is older than 60 days.
            </span>
          </div>
          {selectedBucket !== 'All' && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedBucket('All')}
              className="text-xs font-semibold h-7 text-amber-900 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900/50 px-2"
            >
              Clear Filter
            </Button>
          )}
        </div>
      )}

      {/* Filters Bar */}
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

          <div className="flex items-center bg-slate-100 dark:bg-slate-800/80 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700">
            {['All', '0-30', '31-60', '61-90', '90+'].map((b) => (
              <button
                key={b}
                onClick={() => setSelectedBucket(b)}
                className={`px-2 py-1 rounded-md text-xs font-medium transition-all ${
                  selectedBucket === b
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {b === 'All' ? 'All' : `${b}d`}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative w-full sm:w-60">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search product code or name..."
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
          {/* Capital Valuation by Aging Bucket Bar Chart */}
          <Card className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl shadow-xs p-3 sm:p-3.5">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h3 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                  <BarChart2 className="w-4 h-4 text-indigo-500" />
                  Working Capital Tied in Aged Inventory (₹)
                </h3>
                <p className="text-[10.5px] text-slate-500 dark:text-slate-400">Total financial valuation across age buckets</p>
              </div>
            </div>
            <div className="h-48 sm:h-52 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={agingBucketBarData} margin={{ top: 5, right: 10, left: 10, bottom: 15 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.15} />
                  <XAxis dataKey="name" tick={{ fontSize: 9 }} angle={-15} textAnchor="end" stroke="#64748b" />
                  <YAxis tick={{ fontSize: 10 }} stroke="#64748b" tickFormatter={(v) => `₹${v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}`} />
                  <RechartsTooltip 
                    formatter={(val) => [`₹${Number(val).toLocaleString('en-IN')}`, 'Capital Valuation']}
                    contentStyle={{ backgroundColor: '#0f172a', borderRadius: '8px', border: '1px solid #334155', color: '#fff', fontSize: '11px', padding: '6px 10px' }}
                  />
                  <Bar dataKey="valuation" radius={[4, 4, 0, 0]}>
                    {agingBucketBarData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Unit Count by Bucket Donut Chart */}
          <Card className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl shadow-xs p-3 sm:p-3.5">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h3 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                  <PieIcon className="w-4 h-4 text-amber-500" />
                  Batch Count by Age Bucket
                </h3>
                <p className="text-[10.5px] text-slate-500 dark:text-slate-400">Number of batches in each tier</p>
              </div>
            </div>
            <div className="h-48 sm:h-52 w-full flex items-center justify-center">
              {agingCountPieData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={agingCountPieData}
                      cx="50%"
                      cy="48%"
                      innerRadius={48}
                      outerRadius={70}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {agingCountPieData.map((entry, index) => (
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
                <div className="text-slate-400 text-xs">No aging data available.</div>
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
                  <th className="py-2.5 px-3">Product</th>
                  <th className="py-2.5 px-3">Category</th>
                  <th className="py-2.5 px-3 text-right">Stock Qty</th>
                  <th className="py-2.5 px-3 text-right">Unit Cost</th>
                  <th className="py-2.5 px-3 text-right">Valuation</th>
                  <th className="py-2.5 px-3 text-center">Days in Stock</th>
                  <th className="py-2.5 px-3 text-center">Aging Bucket</th>
                  <th className="py-2.5 px-3 text-right">Last Movement</th>
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
                      <Archive className="w-8 h-8 mx-auto mb-1.5 opacity-30" />
                      No aged inventory found matching the selected filters.
                    </td>
                  </tr>
                ) : (
                  items.map((row) => (
                    <tr key={row.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="py-2 px-3">
                        <span className="font-semibold text-slate-900 dark:text-white block">{row.name}</span>
                        <span className="text-[10px] text-slate-400 font-mono">{row.code}</span>
                      </td>
                      <td className="py-2 px-3 text-slate-600 dark:text-slate-300">{row.category}</td>
                      <td className="py-2 px-3 text-right font-semibold text-slate-800 dark:text-slate-200">
                        {Number(row.currentStock).toLocaleString()}
                      </td>
                      <td className="py-2 px-3 text-right text-slate-600 dark:text-slate-300">
                        ₹{Number(row.totalCost).toFixed(2)}
                      </td>
                      <td className="py-2 px-3 text-right font-bold text-slate-900 dark:text-white">
                        ₹{Number(row.stockValuation).toLocaleString('en-IN')}
                      </td>
                      <td className="py-2 px-3 text-center">
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-[10.5px] font-bold ${
                          row.ageDays > 90 ? 'text-rose-600 dark:text-rose-400' :
                          row.ageDays > 60 ? 'text-amber-600 dark:text-amber-400' :
                          'text-slate-700 dark:text-slate-300'
                        }`}>
                          {row.ageDays} d
                        </span>
                      </td>
                      <td className="py-2 px-3 text-center">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] border ${getBucketBadge(row.agingBucket)}`}>
                          {row.agingBucket} Days
                        </span>
                      </td>
                      <td className="py-2 px-3 text-right text-slate-500 dark:text-slate-400 text-[10.5px]">
                        {row.lastProductionDate ? new Date(row.lastProductionDate).toLocaleDateString() : 'N/A'}
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
