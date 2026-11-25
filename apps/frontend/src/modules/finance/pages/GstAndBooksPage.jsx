import React, { useState, useEffect } from 'react';
import { api } from '@/lib/axios';
import { formatINR, formatDate } from '@/utils/financeFormatters';
import { 
  Building2, BookOpen, Download, RefreshCw, 
  CheckCircle2, AlertCircle, ArrowUpRight, ArrowDownLeft, Wallet
} from 'lucide-react';

export default function GstAndBooksPage() {
  const [activeTab, setActiveTab] = useState('GST'); // 'GST' or 'CASHBOOK'
  
  // GST State
  const [gstRows, setGstRows] = useState([]);
  const [loadingGst, setLoadingGst] = useState(false);

  // Cashbook State
  const [cashbookRows, setCashbookRows] = useState([]);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [selectedAccount, setSelectedAccount] = useState('');
  const [loadingCashbook, setLoadingCashbook] = useState(false);

  useEffect(() => {
    // Load GST Register
    setLoadingGst(true);
    api.get('/finance/gst')
      .then(res => {
        if (res.data?.success) setGstRows(res.data.data || []);
      })
      .catch(console.error)
      .finally(() => setLoadingGst(false));

    // Load Bank Accounts
    api.get('/finance/bank-accounts')
      .then(res => {
        if (res.data?.success) {
          const list = res.data.data || [];
          setBankAccounts(list);
        }
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (activeTab !== 'CASHBOOK') return;
    setLoadingCashbook(true);

    const query = selectedAccount ? `?account_id=${selectedAccount}` : '';
    api.get(`/finance/cashbook${query}`)
      .then(res => {
        if (res.data?.success) setCashbookRows(res.data.data || []);
      })
      .catch(console.error)
      .finally(() => setLoadingCashbook(false));
  }, [activeTab, selectedAccount]);

  return (
    <div className="p-4 sm:p-6 space-y-4 max-w-7xl mx-auto text-xs">
      {/* Page Title & Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <Building2 className="w-6 h-6 text-primary" />
            GST Register & Cash / Bank Books
          </h1>
          <p className="text-slate-500 mt-0.5">
            Statutory tax input vs output credit reconciliation and multi-account financial registers
          </p>
        </div>

        <div className="flex rounded-lg border border-slate-300 dark:border-slate-700 p-0.5 bg-slate-100 dark:bg-slate-800">
          <button
            onClick={() => setActiveTab('GST')}
            className={`px-3 py-1.5 rounded-md font-bold transition-all ${
              activeTab === 'GST' ? 'bg-white dark:bg-slate-900 shadow-2xs text-primary' : 'text-slate-600'
            }`}
          >
            🏛️ GST Input vs Output Return
          </button>
          <button
            onClick={() => setActiveTab('CASHBOOK')}
            className={`px-3 py-1.5 rounded-md font-bold transition-all ${
              activeTab === 'CASHBOOK' ? 'bg-white dark:bg-slate-900 shadow-2xs text-primary' : 'text-slate-600'
            }`}
          >
            🏦 Cash & Bank Books
          </button>
        </div>
      </div>

      {activeTab === 'GST' ? (
        /* ================= GST VIEW ================= */
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
            <h3 className="font-bold text-sm text-slate-900 dark:text-white mb-1">
              Monthly GST Summary (GSTR-3B Auto-Reconciliation)
            </h3>
            <p className="text-slate-500 mb-3">
              Input Tax Credit (ITC) from Raw Materials, Capital Assets, and Expenses offset against Output GST on Sales Orders
            </p>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 dark:bg-slate-950/70 border-b border-slate-200 dark:border-slate-800 text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                  <tr>
                    <th className="py-2.5 px-3">Month</th>
                    <th className="py-2.5 px-2 text-right">ITC (CGST)</th>
                    <th className="py-2.5 px-2 text-right">ITC (SGST)</th>
                    <th className="py-2.5 px-2 text-right">ITC (IGST)</th>
                    <th className="py-2.5 px-3 text-right font-bold text-emerald-600">Total Input ITC</th>
                    <th className="py-2.5 px-2 text-right">Output CGST</th>
                    <th className="py-2.5 px-2 text-right">Output SGST</th>
                    <th className="py-2.5 px-2 text-right">Output IGST</th>
                    <th className="py-2.5 px-3 text-right font-bold text-slate-700 dark:text-slate-300">Total Output</th>
                    <th className="py-2.5 px-3 text-right font-extrabold text-rose-600">Net Payable</th>
                    <th className="py-2.5 px-3 text-right font-extrabold text-indigo-600">ITC Carried Fwd</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                  {loadingGst ? (
                    <tr>
                      <td colSpan={11} className="py-12 text-center text-slate-400 font-sans">
                        Reconciling GST tax registers...
                      </td>
                    </tr>
                  ) : gstRows.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="py-12 text-center text-slate-400 font-sans">
                        No tax records found.
                      </td>
                    </tr>
                  ) : (
                    gstRows.map((r, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="py-2.5 px-3 font-sans font-bold text-slate-900 dark:text-white">
                          {r.month_key}
                        </td>
                        <td className="py-2.5 px-2 text-right text-slate-600 dark:text-slate-400">{formatINR(r.itc_cgst)}</td>
                        <td className="py-2.5 px-2 text-right text-slate-600 dark:text-slate-400">{formatINR(r.itc_sgst)}</td>
                        <td className="py-2.5 px-2 text-right text-slate-600 dark:text-slate-400">{formatINR(r.itc_igst)}</td>
                        <td className="py-2.5 px-3 text-right font-bold text-emerald-600 bg-emerald-50/30 dark:bg-emerald-950/20">
                          {formatINR(r.total_itc)}
                        </td>
                        <td className="py-2.5 px-2 text-right text-slate-600 dark:text-slate-400">{formatINR(r.output_cgst)}</td>
                        <td className="py-2.5 px-2 text-right text-slate-600 dark:text-slate-400">{formatINR(r.output_sgst)}</td>
                        <td className="py-2.5 px-2 text-right text-slate-600 dark:text-slate-400">{formatINR(r.output_igst)}</td>
                        <td className="py-2.5 px-3 text-right font-bold text-slate-700 dark:text-slate-300">
                          {formatINR(r.total_output)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-black text-rose-600">
                          {formatINR(r.net_gst_payable)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-black text-indigo-600 bg-indigo-50/30 dark:bg-indigo-950/20">
                          {formatINR(r.carry_forward_itc)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        /* ================= CASHBOOK VIEW ================= */
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-700 dark:text-slate-300">Account:</span>
              <select
                value={selectedAccount}
                onChange={(e) => setSelectedAccount(e.target.value)}
                className="h-8 px-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-bold"
              >
                <option value="">All Cash & Bank Accounts</option>
                {bankAccounts.map(b => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.type}) - Balance: {formatINR(b.current_balance)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 dark:bg-slate-950/70 border-b border-slate-200 dark:border-slate-800 text-[11px] uppercase font-bold text-slate-500">
                  <tr>
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Payment No</th>
                    <th className="py-2.5 px-3">Account</th>
                    <th className="py-2.5 px-2">Mode</th>
                    <th className="py-2.5 px-3">Party / Beneficiary</th>
                    <th className="py-2.5 px-3">Notes / Ref</th>
                    <th className="py-2.5 px-3 text-right">Deposit (In)</th>
                    <th className="py-2.5 px-3 text-right">Withdrawal (Out)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                  {loadingCashbook ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400 font-sans">
                        Loading cash & bank register transactions...
                      </td>
                    </tr>
                  ) : cashbookRows.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400 font-sans">
                        No transactions found for this account.
                      </td>
                    </tr>
                  ) : (
                    cashbookRows.map((r, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="py-2 px-3 font-sans text-slate-500">{formatDate(r.pay_date)}</td>
                        <td className="py-2 px-3 font-bold text-slate-900 dark:text-white">{r.payment_no}</td>
                        <td className="py-2 px-3 font-sans font-medium text-slate-700 dark:text-slate-300">
                          {r.account_name} ({r.account_type})
                        </td>
                        <td className="py-2 px-2 font-sans font-bold text-[10px] uppercase text-slate-600">
                          {r.mode}
                        </td>
                        <td className="py-2 px-3 font-sans font-medium text-slate-800 dark:text-slate-200">
                          {r.party_name}
                        </td>
                        <td className="py-2 px-3 font-sans text-slate-500 text-[11px]">{r.notes || r.reference_no || '-'}</td>
                        <td className="py-2 px-3 text-right font-bold text-emerald-600">
                          {Number(r.deposit_amount) > 0 ? formatINR(r.deposit_amount) : '-'}
                        </td>
                        <td className="py-2 px-3 text-right font-bold text-rose-600">
                          {Number(r.withdrawal_amount) > 0 ? formatINR(r.withdrawal_amount) : '-'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
