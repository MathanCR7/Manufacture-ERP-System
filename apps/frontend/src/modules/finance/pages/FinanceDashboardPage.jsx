import React, { useState, useEffect } from 'react';
import { api } from '@/lib/axios';
import { useNavigate } from 'react-router-dom';
import { formatINR, formatDate, renderPaymentStatusChip } from '@/utils/financeFormatters';
import { 
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer 
} from 'recharts';
import { 
  DollarSign, TrendingUp, TrendingDown, CreditCard, 
  Wallet, RefreshCw, AlertTriangle, ShieldCheck, ArrowUpRight, 
  Clock, CheckCircle2, ChevronRight, FileText, Layers, Building2, User
} from 'lucide-react';
import RecordPaymentModal from '../components/RecordPaymentModal';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#6366f1', '#14b8a6', '#f97316'];

export default function FinanceDashboardPage() {
  const navigate = useNavigate();
  const [direction, setDirection] = useState('ALL'); // 'ALL', 'PAYABLE', 'RECEIVABLE'
  const [dateRange, setDateRange] = useState('ALL'); // 'ALL', 'THIS_MONTH', 'THIS_QUARTER', 'THIS_FY'
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);

  const fetchDashboard = () => {
    setLoading(true);
    let from = '';
    let to = '';
    const now = new Date();

    if (dateRange === 'THIS_MONTH') {
      from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      to = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
    } else if (dateRange === 'THIS_FY') {
      const fyStartYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
      from = `${fyStartYear}-04-01`;
      to = `${fyStartYear + 1}-03-31`;
    }

    const params = new URLSearchParams({
      direction,
      from,
      to
    });

    api.get(`/finance/dashboard?${params.toString()}`)
      .then(res => {
        if (res.data?.success) {
          setData(res.data.data);
        }
      })
      .catch(err => {
        console.error('Error fetching finance dashboard:', err);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchDashboard();
  }, [direction, dateRange]);

  const kpi = data?.kpi || {};
  const monthlyTrend = data?.monthlyTrend || [];
  const agingBuckets = data?.agingBuckets || [];
  const expenseShares = data?.expenseShares || [];
  const topSuppliers = data?.topSuppliers || [];
  const topCustomers = data?.topCustomers || [];
  const attentionItems = data?.attentionItems || [];

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-7xl mx-auto">
      {/* Top Header & Toggles */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <DollarSign className="w-6 h-6 text-emerald-600" />
            Finance & Cash Flow Control
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time financial status, calculated payments ledger & working capital intelligence
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Payables / Receivables / Both Toggle */}
          <div className="flex rounded-lg border border-slate-300 dark:border-slate-700 p-0.5 bg-slate-100 dark:bg-slate-800 text-xs">
            <button
              onClick={() => setDirection('ALL')}
              className={`px-3 py-1 rounded-md font-bold transition-all ${
                direction === 'ALL' ? 'bg-white dark:bg-slate-900 shadow-2xs text-slate-900 dark:text-white' : 'text-slate-600'
              }`}
            >
              All Books
            </button>
            <button
              onClick={() => setDirection('PAYABLE')}
              className={`px-3 py-1 rounded-md font-bold transition-all ${
                direction === 'PAYABLE' ? 'bg-white dark:bg-slate-900 shadow-2xs text-rose-600' : 'text-slate-600'
              }`}
            >
              Payables
            </button>
            <button
              onClick={() => setDirection('RECEIVABLE')}
              className={`px-3 py-1 rounded-md font-bold transition-all ${
                direction === 'RECEIVABLE' ? 'bg-white dark:bg-slate-900 shadow-2xs text-emerald-600' : 'text-slate-600'
              }`}
            >
              Receivables
            </button>
          </div>

          {/* Date Range Picker */}
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="h-8 px-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold"
          >
            <option value="ALL">All Time</option>
            <option value="THIS_MONTH">This Month</option>
            <option value="THIS_FY">Financial Year (FY 2026-27)</option>
          </select>

          <button
            onClick={() => setIsPaymentModalOpen(true)}
            className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-all shadow-sm flex items-center gap-1.5"
          >
            <CreditCard className="w-3.5 h-3.5" />
            Record Payment
          </button>
        </div>
      </div>

      {/* 6 Executive KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        {/* Card 1: Total Billed */}
        <div 
          onClick={() => navigate('/finance/documents')}
          className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs cursor-pointer hover:border-primary transition-all"
        >
          <div className="text-[10px] uppercase font-bold text-slate-400">Total Billed</div>
          <div className="text-lg font-black text-slate-900 dark:text-white mt-1">
            {formatINR(kpi.totalBilled)}
          </div>
          <div className="text-[10px] text-slate-500 mt-1 flex items-center gap-1">
            <Layers className="w-3 h-3" /> View All Docs
          </div>
        </div>

        {/* Card 2: Settled / Paid */}
        <div 
          onClick={() => navigate('/finance/documents?status=PAID')}
          className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs cursor-pointer hover:border-emerald-500 transition-all"
        >
          <div className="text-[10px] uppercase font-bold text-slate-400">Total Settled</div>
          <div className="text-lg font-black text-emerald-600 mt-1">
            {formatINR(kpi.totalPaid)}
          </div>
          <div className="text-[10px] text-emerald-600/80 mt-1 flex items-center gap-1 font-semibold">
            <CheckCircle2 className="w-3 h-3" /> Fully Settled
          </div>
        </div>

        {/* Card 3: Advances */}
        <div 
          onClick={() => navigate('/finance/documents?status=ADVANCE_PAID')}
          className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs cursor-pointer hover:border-blue-500 transition-all"
        >
          <div className="text-[10px] uppercase font-bold text-slate-400">Advance Paid</div>
          <div className="text-lg font-black text-blue-600 mt-1">
            {formatINR(kpi.totalAdvance)}
          </div>
          <div className="text-[10px] text-blue-600/80 mt-1 flex items-center gap-1 font-semibold">
            <Clock className="w-3 h-3" /> Held in Advance
          </div>
        </div>

        {/* Card 4: Outstanding */}
        <div 
          onClick={() => navigate('/finance/documents?status=UNPAID')}
          className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs cursor-pointer hover:border-rose-500 transition-all"
        >
          <div className="text-[10px] uppercase font-bold text-slate-400">Total Outstanding</div>
          <div className="text-lg font-black text-rose-600 mt-1">
            {formatINR(kpi.totalOutstanding)}
          </div>
          <div className="text-[10px] text-rose-600/80 mt-1 flex items-center gap-1 font-semibold">
            <AlertTriangle className="w-3 h-3" /> Due for Payment
          </div>
        </div>

        {/* Card 5: Overdue */}
        <div 
          onClick={() => navigate('/finance/documents?status=OVERDUE')}
          className="p-3.5 rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50/50 dark:bg-red-950/20 shadow-2xs cursor-pointer hover:border-red-500 transition-all"
        >
          <div className="text-[10px] uppercase font-bold text-red-600 dark:text-red-400">
            Overdue ({kpi.overdueCount})
          </div>
          <div className="text-lg font-black text-red-700 dark:text-red-400 mt-1">
            {formatINR(kpi.overdueAmount)}
          </div>
          <div className="text-[10px] text-red-600 mt-1 flex items-center gap-1 font-bold">
            Past Credit Terms
          </div>
        </div>

        {/* Card 6: GST ITC Balance */}
        <div 
          onClick={() => navigate('/finance/gst')}
          className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs cursor-pointer hover:border-primary transition-all"
        >
          <div className="text-[10px] uppercase font-bold text-slate-400">Net GST ITC Balance</div>
          <div className="text-lg font-black text-indigo-600 mt-1">
            {formatINR(kpi.carryForwardItc || kpi.itcBalance)}
          </div>
          <div className="text-[10px] text-emerald-600 font-bold mt-1">
            Net Payable: ₹0.00
          </div>
        </div>
      </div>

      {/* Main Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Chart 1: Monthly Paid vs Outstanding Trend */}
        <div className="lg:col-span-2 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-2">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                Monthly Billing vs Paid & Outstanding
              </h3>
              <p className="text-[11px] text-slate-400">Historical cash settlement trajectory</p>
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyTrend} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.2} />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(val) => formatINR(val)} />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                <Bar dataKey="paid" name="Paid / Settled" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="outstanding" name="Outstanding Balance" fill="#f43f5e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: Aging Buckets */}
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs flex flex-col justify-between">
          <div className="pb-2 border-b border-slate-100 dark:border-slate-800">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
              Debt & Aging Analysis
            </h3>
            <p className="text-[11px] text-slate-400">Balance overdue by duration</p>
          </div>

          <div className="space-y-3 my-auto pt-3">
            {agingBuckets.map(b => (
              <div 
                key={b.age_bucket} 
                onClick={() => navigate('/finance/aging')}
                className="cursor-pointer group"
              >
                <div className="flex justify-between text-xs font-semibold mb-1">
                  <span className="text-slate-600 dark:text-slate-300 group-hover:text-primary transition-colors">
                    {b.age_bucket === 'Current' ? 'Within Credit Terms' : `${b.age_bucket} Days Overdue`}
                  </span>
                  <span className="font-extrabold text-slate-900 dark:text-white font-mono">
                    {formatINR(b.amount)}
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <div
                    className={`h-full ${
                      b.age_bucket === 'Current' ? 'bg-emerald-500' : b.age_bucket === '0-30' ? 'bg-amber-500' : 'bg-rose-500'
                    }`}
                    style={{ width: `${Math.min(100, (Number(b.amount) / Math.max(1, Number(kpi.totalOutstanding))) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={() => navigate('/finance/aging')}
            className="w-full mt-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center justify-center gap-1"
          >
            Open Full Aging Matrix <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Second Row: Top Counterparties & Needs Attention Queue */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top Suppliers & Customers */}
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs space-y-4">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
              Top Outstanding Payables & Receivables
            </h3>
            <p className="text-[11px] text-slate-400">Largest exposure by counterparty</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            {/* Top Suppliers */}
            <div className="border border-slate-100 dark:border-slate-800 rounded-lg p-2.5 space-y-2">
              <div className="font-bold text-rose-600 flex items-center gap-1 text-[11px]">
                <Building2 className="w-3.5 h-3.5" /> Top Payables (Suppliers)
              </div>
              <div className="space-y-1.5 divide-y divide-slate-100 dark:divide-slate-800">
                {topSuppliers.length === 0 ? (
                  <div className="text-slate-400 text-center py-2">No payables outstanding</div>
                ) : (
                  topSuppliers.map((s, idx) => (
                    <div key={idx} className="flex justify-between items-center pt-1.5">
                      <span className="truncate max-w-[140px] text-slate-700 dark:text-slate-300 font-medium" title={s.party_name}>
                        {s.party_name}
                      </span>
                      <span className="font-bold text-slate-900 dark:text-white font-mono">
                        {formatINR(s.outstanding)}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Top Customers */}
            <div className="border border-slate-100 dark:border-slate-800 rounded-lg p-2.5 space-y-2">
              <div className="font-bold text-emerald-600 flex items-center gap-1 text-[11px]">
                <User className="w-3.5 h-3.5" /> Top Receivables (Customers)
              </div>
              <div className="space-y-1.5 divide-y divide-slate-100 dark:divide-slate-800">
                {topCustomers.length === 0 ? (
                  <div className="text-slate-400 text-center py-2">No receivables outstanding</div>
                ) : (
                  topCustomers.map((c, idx) => (
                    <div key={idx} className="flex justify-between items-center pt-1.5">
                      <span className="truncate max-w-[140px] text-slate-700 dark:text-slate-300 font-medium" title={c.party_name}>
                        {c.party_name}
                      </span>
                      <span className="font-bold text-slate-900 dark:text-white font-mono">
                        {formatINR(c.receivable)}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Needs Attention Queue */}
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-500" /> Action Items & Attention Queue
              </h3>
              <p className="text-[11px] text-slate-400">Overdue bills, completed orders awaiting payment</p>
            </div>
            <button
              onClick={() => navigate('/finance/documents?status=OVERDUE')}
              className="text-xs font-bold text-primary hover:underline"
            >
              View All
            </button>
          </div>

          <div className="space-y-2 max-h-56 overflow-y-auto">
            {attentionItems.length === 0 ? (
              <div className="p-6 text-center text-slate-400 text-xs">
                ✓ No overdue or blocking financial action items!
              </div>
            ) : (
              attentionItems.map((item, idx) => (
                <div 
                  key={idx}
                  onClick={() => navigate('/finance/documents')}
                  className="p-2.5 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center justify-between cursor-pointer text-xs"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 dark:text-white">{item.doc_no}</span>
                      <span className="text-slate-500">• {item.party_name}</span>
                    </div>
                    <div className="text-[11px] text-rose-600 font-semibold mt-0.5">
                      {item.alert_reason}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-extrabold font-mono text-slate-900 dark:text-white">
                      {formatINR(item.balance)}
                    </div>
                    <span className="text-[10px] text-slate-400">{formatDate(item.due_date)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Record Payment Modal */}
      <RecordPaymentModal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        onSuccess={fetchDashboard}
      />
    </div>
  );
}
