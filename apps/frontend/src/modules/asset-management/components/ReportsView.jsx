import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/axios';
import { format } from 'date-fns';
import {
  BarChart3, TrendingDown, HardDrive, FileText, Download,
  Package, DollarSign, AlertTriangle, CheckCircle2, Wrench,
  Archive, Clock, Building2, Tag, Search, ChevronDown
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';

const CATEGORIES = [
  'IT Equipment', 'Machinery & Plant', 'Furniture & Fixtures',
  'Vehicles', 'Infrastructure', 'Office Equipment', 'Intangible Assets'
];

const STATUS_STYLES = {
  Active: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/50',
  'Under Maintenance': 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400 border-amber-200 dark:border-amber-900/50',
  'In Transit': 'bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400 border-blue-200 dark:border-blue-900/50',
  Disposed: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700',
  Scrapped: 'bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400 border-rose-200 dark:border-rose-900/50',
  Idle: 'bg-violet-50 text-violet-700 dark:bg-violet-950/30 dark:text-violet-400 border-violet-200 dark:border-violet-900/50',
};

function StatCard({ label, value, sub, icon: Icon, bg, clr }) {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/60 rounded-2xl p-4 flex items-center gap-3 shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5">
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${bg} ${clr}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</p>
        <p className="text-xl font-bold text-slate-900 dark:text-white truncate">{value}</p>
        {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function SectionTitle({ icon: Icon, children }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <div className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-950/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
        <Icon className="w-4 h-4" />
      </div>
      <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide">{children}</h3>
    </div>
  );
}

export default function ReportsView() {
  const [activeReport, setActiveReport] = useState('depreciation');
  const [depSearch, setDepSearch] = useState('');
  const [depSort, setDepSort] = useState('recent');
  const [procSearch, setProcSearch] = useState('');
  const [procSort, setProcSort] = useState('recent');

  const { data: assets = [], isLoading } = useQuery({
    queryKey: ['asset-register'],
    queryFn: () => api.get('/asset-management/assets').then(r => r.data),
  });

  const { data: requests = [] } = useQuery({
    queryKey: ['asset-purchase-requests'],
    queryFn: () => api.get('/asset-management/requests').then(r => r.data),
  });

  const { data: invoices = [] } = useQuery({
    queryKey: ['asset-ap-invoices'],
    queryFn: () => api.get('/asset-management/ap-invoices').then(r => r.data),
  });

  // Compute depreciation for each asset
  const assetsWithDep = assets.map(a => {
    const pv = Number(a.purchaseValue || 0);
    const rate = Number(a.depreciationRate || 0);
    const age = a.purchaseDate
      ? (new Date() - new Date(a.purchaseDate)) / (1000 * 60 * 60 * 24 * 365.25)
      : 0;
    const bookValue = Math.max(0, pv * Math.pow(1 - rate / 100, age));
    const accDep = pv - bookValue;
    const annualDep = (pv - Number(a.salvageValue || 0)) / Number(a.usefulLifeYears || 1);
    return { ...a, pv, bookValue, accDep, annualDep, age };
  });

  const filteredAssets = assetsWithDep.filter(a =>
    a.assetName?.toLowerCase().includes(depSearch.toLowerCase()) ||
    a.assetCode?.toLowerCase().includes(depSearch.toLowerCase()) ||
    a.category?.toLowerCase().includes(depSearch.toLowerCase()) ||
    a.department?.toLowerCase().includes(depSearch.toLowerCase())
  );

  const sortedAssets = [...filteredAssets].sort((a, b) => {
    if (depSort === 'recent') {
      return new Date(b.purchaseDate || b.createdAt) - new Date(a.purchaseDate || a.createdAt);
    }
    if (depSort === 'oldest') {
      return new Date(a.purchaseDate || a.createdAt) - new Date(b.purchaseDate || b.createdAt);
    }
    if (depSort === 'priceLowHigh') {
      return Number(a.pv || 0) - Number(b.pv || 0);
    }
    if (depSort === 'priceHighLow') {
      return Number(b.pv || 0) - Number(a.pv || 0);
    }
    if (depSort === 'alphabetical') {
      return (a.assetName || '').localeCompare(b.assetName || '');
    }
    return 0;
  });

  const filteredInvoices = invoices.filter(inv =>
    inv.apInvoiceNo?.toLowerCase().includes(procSearch.toLowerCase()) ||
    inv.vendorName?.toLowerCase().includes(procSearch.toLowerCase())
  );

  const sortedInvoices = [...filteredInvoices].sort((a, b) => {
    if (procSort === 'recent') {
      return new Date(b.invoiceDate || b.createdAt) - new Date(a.invoiceDate || a.createdAt);
    }
    if (procSort === 'oldest') {
      return new Date(a.invoiceDate || a.createdAt) - new Date(b.invoiceDate || b.createdAt);
    }
    if (procSort === 'priceLowHigh') {
      return Number(a.grandTotal || 0) - Number(b.grandTotal || 0);
    }
    if (procSort === 'priceHighLow') {
      return Number(b.grandTotal || 0) - Number(a.grandTotal || 0);
    }
    if (procSort === 'alphabetical') {
      return (a.vendorName || '').localeCompare(b.vendorName || '');
    }
    return 0;
  });

  // Aggregates
  const totalPV = assetsWithDep.reduce((s, a) => s + a.pv, 0);
  const totalBV = assetsWithDep.reduce((s, a) => s + a.bookValue, 0);
  const totalAccDep = assetsWithDep.reduce((s, a) => s + a.accDep, 0);
  const totalAnnualDep = assetsWithDep.reduce((s, a) => s + a.annualDep, 0);

  // Category breakdown
  const byCategory = CATEGORIES.map(cat => {
    const catAssets = assetsWithDep.filter(a => a.category === cat);
    return {
      cat,
      count: catAssets.length,
      pv: catAssets.reduce((s, a) => s + a.pv, 0),
      bv: catAssets.reduce((s, a) => s + a.bookValue, 0),
    };
  }).filter(c => c.count > 0);

  // Status breakdown
  const statusGroups = ['Active', 'Under Maintenance', 'Idle', 'In Transit', 'Disposed', 'Scrapped'].map(status => ({
    status,
    count: assetsWithDep.filter(a => a.status === status).length,
  })).filter(g => g.count > 0);

  // Department breakdown
  const deptMap = {};
  assetsWithDep.forEach(a => {
    if (!deptMap[a.department]) deptMap[a.department] = { count: 0, pv: 0, bv: 0 };
    deptMap[a.department].count++;
    deptMap[a.department].pv += a.pv;
    deptMap[a.department].bv += a.bookValue;
  });
  const byDept = Object.entries(deptMap).sort((a, b) => b[1].pv - a[1].pv);

  // Warranty expiry alerts
  const now = new Date();
  const in90Days = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
  const warrantyAlerts = assetsWithDep.filter(a =>
    a.warrantyExpiry && new Date(a.warrantyExpiry) <= in90Days && new Date(a.warrantyExpiry) > now
  );
  const warrantyExpired = assetsWithDep.filter(a =>
    a.warrantyExpiry && new Date(a.warrantyExpiry) < now
  );

  // Procurement spend from invoices
  const totalSpend = invoices.reduce((s, i) => s + Number(i.grandTotal || 0), 0);
  const paidInvoices = invoices.filter(i => i.status === 'Paid');
  const pendingInvoices = invoices.filter(i => ['Draft', 'Approved', 'Posted'].includes(i.status));
  const pendingAmount = pendingInvoices.reduce((s, i) => s + Number(i.grandTotal || 0), 0);

  const reportTabs = [
    { id: 'depreciation', label: 'Depreciation', icon: TrendingDown },
    { id: 'category', label: 'By Category', icon: Tag },
    { id: 'department', label: 'By Department', icon: Building2 },
    { id: 'procurement', label: 'Procurement', icon: DollarSign },
    { id: 'alerts', label: 'Alerts', icon: AlertTriangle },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Asset Reports</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Depreciation schedules, procurement spend, and lifecycle analytics
          </p>
        </div>
        <Button
          variant="outline"
          className="gap-2 rounded-xl h-10 px-5 text-sm"
          onClick={() => window.print()}
        >
          <Download className="w-4 h-4" />
          Export Report
        </Button>
      </div>

      {/* KPI Summary */}
      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/60 rounded-2xl p-4">
              <Skeleton className="h-4 w-20 mb-2 rounded" />
              <Skeleton className="h-7 w-28 rounded" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Total Assets" value={assets.length} sub={`${statusGroups.find(s => s.status === 'Active')?.count || 0} active`} icon={HardDrive} bg="bg-indigo-50 dark:bg-indigo-950/30" clr="text-indigo-600 dark:text-indigo-400" />
          <StatCard label="Purchase Value" value={`₹${(totalPV / 100000).toFixed(1)}L`} sub="Gross block" icon={Package} bg="bg-emerald-50 dark:bg-emerald-950/30" clr="text-emerald-600 dark:text-emerald-400" />
          <StatCard label="Net Book Value" value={`₹${(totalBV / 100000).toFixed(1)}L`} sub={`${((totalBV / (totalPV || 1)) * 100).toFixed(0)}% of cost`} icon={BarChart3} bg="bg-blue-50 dark:bg-blue-950/30" clr="text-blue-600 dark:text-blue-400" />
          <StatCard label="Acc. Depreciation" value={`₹${(totalAccDep / 100000).toFixed(1)}L`} sub={`₹${(totalAnnualDep / 100000).toFixed(1)}L / yr`} icon={TrendingDown} bg="bg-rose-50 dark:bg-rose-950/30" clr="text-rose-600 dark:text-rose-400" />
        </div>
      )}

      {/* Report Sub-Tabs */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/80 rounded-2xl p-1.5 shadow-sm overflow-x-auto scrollbar-none flex gap-1.5">
        {reportTabs.map(tab => {
          const Icon = tab.icon;
          const isActive = activeReport === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveReport(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all shrink-0 ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/10'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/50'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Depreciation Schedule Report */}
      {activeReport === 'depreciation' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/60 rounded-2xl p-5 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
              <SectionTitle icon={TrendingDown}>Asset-wise Depreciation Schedule</SectionTitle>
              <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
                <div className="relative flex-1 sm:w-64">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={depSearch}
                    onChange={e => setDepSearch(e.target.value)}
                    placeholder="Search assets..."
                    className="w-full h-9 pl-9 pr-3 text-sm border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 text-slate-700 dark:text-slate-350"
                  />
                </div>
                <div className="relative sm:w-48">
                  <select
                    value={depSort}
                    onChange={e => setDepSort(e.target.value)}
                    className="w-full h-9 pl-3 pr-8 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-700 dark:text-slate-350"
                  >
                    <option value="recent">Recent first</option>
                    <option value="oldest">Oldest first</option>
                    <option value="priceLowHigh">Value: Low to High</option>
                    <option value="priceHighLow">Value: High to Low</option>
                    <option value="alphabetical">Alphabetical</option>
                  </select>
                  <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-2.5 pointer-events-none" />
                </div>
              </div>
            </div>
            {isLoading ? (
              <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full rounded-xl" />)}</div>
            ) : sortedAssets.length === 0 ? (
              <div className="flex flex-col items-center py-12 gap-3 text-slate-400">
                <HardDrive className="w-10 h-10" />
                <p className="text-sm">No assets found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50/80 dark:bg-slate-800/50">
                    <tr>
                      {['Asset Code', 'Asset Name', 'Category', 'Purchase Value', 'Method', 'Annual Dep.', 'Acc. Dep.', 'Book Value', 'Age (Yrs)', 'Status'].map(h => (
                        <th key={h} className="px-3 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                    {sortedAssets.map(asset => (
                      <tr key={asset.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors">
                        <td className="px-3 py-3 font-mono font-bold text-indigo-600 dark:text-indigo-400 text-xs whitespace-nowrap">{asset.assetCode}</td>
                        <td className="px-3 py-3 max-w-[160px]">
                          <div className="font-semibold text-slate-800 dark:text-slate-200 truncate">{asset.assetName}</div>
                          <div className="text-xs text-slate-400">{asset.department}</div>
                        </td>
                        <td className="px-3 py-3 text-xs text-slate-500 whitespace-nowrap">{asset.category}</td>
                        <td className="px-3 py-3 text-slate-700 dark:text-slate-300 font-medium whitespace-nowrap">₹{asset.pv.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                        <td className="px-3 py-3 text-xs text-slate-500 max-w-[100px] truncate">{asset.depreciationMethod?.split('(')[0].trim()}</td>
                        <td className="px-3 py-3 font-semibold text-amber-600 dark:text-amber-400 whitespace-nowrap">₹{asset.annualDep.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                        <td className="px-3 py-3 font-semibold text-rose-500 whitespace-nowrap">₹{asset.accDep.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                        <td className="px-3 py-3 font-bold text-indigo-600 dark:text-indigo-400 whitespace-nowrap">₹{asset.bookValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                        <td className="px-3 py-3 text-slate-500 whitespace-nowrap">{asset.age.toFixed(1)}</td>
                        <td className="px-3 py-3">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-bold border whitespace-nowrap ${STATUS_STYLES[asset.status] || STATUS_STYLES.Active}`}>
                            {asset.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-indigo-50/60 dark:bg-indigo-950/20 border-t-2 border-indigo-100 dark:border-indigo-900/50">
                    <tr>
                      <td colSpan={3} className="px-3 py-3 text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Total</td>
                      <td className="px-3 py-3 font-bold text-slate-900 dark:text-white whitespace-nowrap">₹{totalPV.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                      <td />
                      <td className="px-3 py-3 font-bold text-amber-600 whitespace-nowrap">₹{totalAnnualDep.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                      <td className="px-3 py-3 font-bold text-rose-500 whitespace-nowrap">₹{totalAccDep.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                      <td className="px-3 py-3 font-black text-indigo-600 dark:text-indigo-400 whitespace-nowrap">₹{totalBV.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                      <td colSpan={2} />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Category Breakdown Report */}
      {activeReport === 'category' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/60 rounded-2xl p-5 shadow-sm">
          <SectionTitle icon={Tag}>Asset Value by Category</SectionTitle>
          {isLoading ? (
            <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}</div>
          ) : byCategory.length === 0 ? (
            <div className="flex flex-col items-center py-12 gap-3 text-slate-400">
              <Tag className="w-10 h-10" />
              <p className="text-sm">No categorized assets yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {byCategory.sort((a, b) => b.pv - a.pv).map(({ cat, count, pv, bv }) => {
                const depPct = pv > 0 ? ((pv - bv) / pv) * 100 : 0;
                return (
                  <div key={cat} className="border border-slate-200/60 dark:border-slate-800/60 rounded-2xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="font-semibold text-slate-800 dark:text-slate-200 text-sm">{cat}</p>
                        <p className="text-xs text-slate-400">{count} asset{count !== 1 ? 's' : ''}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-slate-900 dark:text-white">₹{(pv / 100000).toFixed(2)}L</p>
                        <p className="text-xs text-indigo-600 dark:text-indigo-400">BV: ₹{(bv / 100000).toFixed(2)}L</p>
                      </div>
                    </div>
                    <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full transition-all duration-700"
                        style={{ width: `${100 - depPct}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                      <span>{(100 - depPct).toFixed(1)}% remaining value</span>
                      <span>{depPct.toFixed(1)}% depreciated</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Department Breakdown */}
      {activeReport === 'department' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/60 rounded-2xl p-5 shadow-sm">
          <SectionTitle icon={Building2}>Asset Distribution by Department</SectionTitle>
          {isLoading ? (
            <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-xl" />)}</div>
          ) : byDept.length === 0 ? (
            <div className="flex flex-col items-center py-12 gap-3 text-slate-400">
              <Building2 className="w-10 h-10" />
              <p className="text-sm">No department data available</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50/80 dark:bg-slate-800/50">
                  <tr>
                    {['Department', 'Total Assets', 'Purchase Value', 'Net Book Value', 'Depreciated %', 'Share of Portfolio'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {byDept.map(([dept, data]) => {
                    const depPct = data.pv > 0 ? ((data.pv - data.bv) / data.pv) * 100 : 0;
                    const portfolioShare = totalPV > 0 ? (data.pv / totalPV) * 100 : 0;
                    return (
                      <tr key={dept} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors">
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/30 flex items-center justify-center">
                              <Building2 className="w-4 h-4 text-indigo-500" />
                            </div>
                            <span className="font-semibold text-slate-800 dark:text-slate-200">{dept}</span>
                          </div>
                        </td>
                        <td className="px-4 py-4 font-bold text-slate-900 dark:text-white">{data.count}</td>
                        <td className="px-4 py-4 text-slate-700 dark:text-slate-300 font-medium whitespace-nowrap">₹{data.pv.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                        <td className="px-4 py-4 font-bold text-indigo-600 dark:text-indigo-400 whitespace-nowrap">₹{data.bv.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden w-16">
                              <div className="h-full bg-rose-400 rounded-full" style={{ width: `${depPct}%` }} />
                            </div>
                            <span className="text-xs font-semibold text-rose-500">{depPct.toFixed(1)}%</span>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden w-16">
                              <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${portfolioShare}%` }} />
                            </div>
                            <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">{portfolioShare.toFixed(1)}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Procurement Report */}
      {activeReport === 'procurement' && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <StatCard label="Total Procurement Spend" value={`₹${(totalSpend / 100000).toFixed(1)}L`} sub={`${invoices.length} invoices total`} icon={DollarSign} bg="bg-emerald-50 dark:bg-emerald-950/30" clr="text-emerald-600 dark:text-emerald-400" />
            <StatCard label="Paid Invoices" value={paidInvoices.length} sub={`₹${(paidInvoices.reduce((s, i) => s + Number(i.grandTotal || 0), 0) / 100000).toFixed(1)}L settled`} icon={CheckCircle2} bg="bg-blue-50 dark:bg-blue-950/30" clr="text-blue-600 dark:text-blue-400" />
            <StatCard label="Pending Payable" value={`₹${(pendingAmount / 100000).toFixed(1)}L`} sub={`${pendingInvoices.length} invoices pending`} icon={Clock} bg="bg-amber-50 dark:bg-amber-950/30" clr="text-amber-600 dark:text-amber-400" />
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/60 rounded-2xl p-5 shadow-sm">
            <SectionTitle icon={FileText}>Purchase Request Summary</SectionTitle>
            {requests.length === 0 ? (
              <div className="flex flex-col items-center py-10 gap-3 text-slate-400">
                <FileText className="w-10 h-10" />
                <p className="text-sm">No purchase requests found</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {['Draft', 'Pending Approval', 'Approved', 'Rejected'].map(status => {
                  const count = requests.filter(r => r.status === status).length;
                  const colors = {
                    'Draft': 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400',
                    'Pending Approval': 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400',
                    'Approved': 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400',
                    'Rejected': 'bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-400',
                  };
                  return (
                    <div key={status} className={`rounded-2xl p-4 text-center ${colors[status]}`}>
                      <p className="text-2xl font-black">{count}</p>
                      <p className="text-xs font-semibold mt-1">{status}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/60 rounded-2xl p-5 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
              <SectionTitle icon={DollarSign}>Recent AP Invoices</SectionTitle>
              <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
                <div className="relative flex-1 sm:w-64">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={procSearch}
                    onChange={e => setProcSearch(e.target.value)}
                    placeholder="Search invoices..."
                    className="w-full h-9 pl-9 pr-3 text-sm border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 text-slate-700 dark:text-slate-350"
                  />
                </div>
                <div className="relative sm:w-48">
                  <select
                    value={procSort}
                    onChange={e => setProcSort(e.target.value)}
                    className="w-full h-9 pl-3 pr-8 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-700 dark:text-slate-350"
                  >
                    <option value="recent">Recent first</option>
                    <option value="oldest">Oldest first</option>
                    <option value="priceLowHigh">Price: Low to High</option>
                    <option value="priceHighLow">Price: High to Low</option>
                    <option value="alphabetical">Alphabetical</option>
                  </select>
                  <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-2.5 pointer-events-none" />
                </div>
              </div>
            </div>
            {sortedInvoices.length === 0 ? (
              <div className="flex flex-col items-center py-10 gap-3 text-slate-400">
                <FileText className="w-10 h-10" />
                <p className="text-sm">No AP invoices found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50/80 dark:bg-slate-800/50">
                    <tr>
                      {['Invoice No.', 'Vendor', 'Invoice Date', 'Grand Total', 'GST', 'Status'].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                    {sortedInvoices.slice(0, 15).map(inv => (
                      <tr key={inv.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors">
                        <td className="px-4 py-3 font-mono font-bold text-indigo-600 dark:text-indigo-400 text-xs whitespace-nowrap">{inv.apInvoiceNo}</td>
                        <td className="px-4 py-3 font-semibold text-slate-800 dark:text-slate-200 max-w-[160px] truncate">{inv.vendorName}</td>
                        <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                          {inv.invoiceDate ? format(new Date(inv.invoiceDate), 'dd MMM yyyy') : '—'}
                        </td>
                        <td className="px-4 py-3 font-bold text-slate-900 dark:text-white whitespace-nowrap">₹{Number(inv.grandTotal || 0).toLocaleString('en-IN')}</td>
                        <td className="px-4 py-3 text-slate-500 whitespace-nowrap">₹{Number(inv.gstAmount || 0).toLocaleString('en-IN')}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-bold border whitespace-nowrap ${
                            inv.status === 'Paid' ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900/50'
                            : inv.status === 'Posted' ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-900/50'
                            : inv.status === 'Approved' ? 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/30 dark:text-indigo-400 dark:border-indigo-900/50'
                            : 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
                          }`}>
                            {inv.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Alerts Report */}
      {activeReport === 'alerts' && (
        <div className="space-y-5">
          {/* Warranty Expiring Soon */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/60 rounded-2xl p-5 shadow-sm">
            <SectionTitle icon={AlertTriangle}>Warranty Expiring Within 90 Days</SectionTitle>
            {warrantyAlerts.length === 0 ? (
              <div className="flex items-center gap-3 p-4 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40 rounded-2xl text-emerald-700 dark:text-emerald-400 text-sm">
                <CheckCircle2 className="w-5 h-5 shrink-0" />
                <span>No warranties expiring in the next 90 days.</span>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-amber-50/80 dark:bg-amber-950/20">
                    <tr>
                      {['Asset Code', 'Asset Name', 'Category', 'Warranty Expiry', 'Days Left', 'Department'].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-amber-100 dark:divide-amber-900/20">
                    {warrantyAlerts.map(a => {
                      const expiry = new Date(a.warrantyExpiry);
                      const daysLeft = Math.ceil((expiry - now) / (1000 * 60 * 60 * 24));
                      return (
                        <tr key={a.id} className="hover:bg-amber-50/40 dark:hover:bg-amber-950/10 transition-colors">
                          <td className="px-4 py-3 font-mono font-bold text-indigo-600 dark:text-indigo-400 text-xs">{a.assetCode}</td>
                          <td className="px-4 py-3 font-semibold text-slate-800 dark:text-slate-200">{a.assetName}</td>
                          <td className="px-4 py-3 text-xs text-slate-500">{a.category}</td>
                          <td className="px-4 py-3 text-slate-600 dark:text-slate-400 whitespace-nowrap">{format(expiry, 'dd MMM yyyy')}</td>
                          <td className="px-4 py-3">
                            <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${daysLeft <= 30 ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400'}`}>
                              {daysLeft}d
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-500">{a.department}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Warranty Expired */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/60 rounded-2xl p-5 shadow-sm">
            <SectionTitle icon={Archive}>Expired Warranties</SectionTitle>
            {warrantyExpired.length === 0 ? (
              <div className="flex items-center gap-3 p-4 bg-slate-50 dark:bg-slate-800/30 border border-slate-200 dark:border-slate-700/50 rounded-2xl text-slate-500 text-sm">
                <CheckCircle2 className="w-5 h-5 shrink-0" />
                <span>No expired warranties on record.</span>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-rose-50/80 dark:bg-rose-950/20">
                    <tr>
                      {['Asset Code', 'Asset Name', 'Category', 'Warranty Expired', 'Days Ago', 'Department'].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-rose-100 dark:divide-rose-900/20">
                    {warrantyExpired.map(a => {
                      const expiry = new Date(a.warrantyExpiry);
                      const daysAgo = Math.ceil((now - expiry) / (1000 * 60 * 60 * 24));
                      return (
                        <tr key={a.id} className="hover:bg-rose-50/40 dark:hover:bg-rose-950/10 transition-colors">
                          <td className="px-4 py-3 font-mono font-bold text-indigo-600 dark:text-indigo-400 text-xs">{a.assetCode}</td>
                          <td className="px-4 py-3 font-semibold text-slate-800 dark:text-slate-200">{a.assetName}</td>
                          <td className="px-4 py-3 text-xs text-slate-500">{a.category}</td>
                          <td className="px-4 py-3 text-slate-600 dark:text-slate-400 whitespace-nowrap">{format(expiry, 'dd MMM yyyy')}</td>
                          <td className="px-4 py-3">
                            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400">
                              {daysAgo}d ago
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-500">{a.department}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Under Maintenance */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/60 rounded-2xl p-5 shadow-sm">
            <SectionTitle icon={Wrench}>Assets Under Maintenance</SectionTitle>
            {assetsWithDep.filter(a => a.status === 'Under Maintenance').length === 0 ? (
              <div className="flex items-center gap-3 p-4 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40 rounded-2xl text-emerald-700 dark:text-emerald-400 text-sm">
                <CheckCircle2 className="w-5 h-5 shrink-0" />
                <span>No assets currently under maintenance.</span>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {assetsWithDep.filter(a => a.status === 'Under Maintenance').map(a => (
                  <div key={a.id} className="flex items-center gap-3 p-3 border border-amber-200 dark:border-amber-900/50 bg-amber-50/40 dark:bg-amber-950/10 rounded-2xl">
                    <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-950/30 flex items-center justify-center shrink-0">
                      <Wrench className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-800 dark:text-slate-200 text-sm truncate">{a.assetName}</p>
                      <p className="text-xs text-slate-400 font-mono">{a.assetCode} · {a.department}</p>
                    </div>
                    <div className="ml-auto text-right shrink-0">
                      <p className="text-xs font-bold text-indigo-600 dark:text-indigo-400">₹{a.bookValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
                      <p className="text-[10px] text-slate-400">book value</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
