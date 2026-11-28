import React, { useState, useEffect } from 'react';
import { api } from '@/lib/axios';
import { formatINR, formatDate } from '@/utils/financeFormatters';
import { 
  Users, Calendar, Download, Printer, Search, 
  ArrowUpRight, ArrowDownLeft, ShieldCheck, Clock, Layers
} from 'lucide-react';

export default function PartyLedgerAgingPage() {
  const [viewMode, setViewMode] = useState('LEDGER'); // 'LEDGER' or 'AGING'
  const [parties, setParties] = useState([]);
  const [selectedPartyId, setSelectedPartyId] = useState('');
  
  // Ledger state
  const [ledgerData, setLedgerData] = useState(null);
  const [loadingLedger, setLoadingLedger] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Aging state
  const [agingDirection, setAgingDirection] = useState('PAYABLE');
  const [agingRows, setAgingRows] = useState([]);
  const [loadingAging, setLoadingAging] = useState(false);

  useEffect(() => {
    api.get('/finance/parties')
      .then(res => {
        if (res.data?.success) {
          const list = res.data.data || [];
          setParties(list);
          if (list.length > 0 && !selectedPartyId) {
            setSelectedPartyId(list[0].id);
          }
        }
      })
      .catch(console.error);
  }, []);

  // Fetch ledger when party or dates change
  useEffect(() => {
    if (viewMode !== 'LEDGER' || !selectedPartyId) return;
    setLoadingLedger(true);

    let query = '';
    if (dateFrom) query += `&from=${dateFrom}`;
    if (dateTo) query += `&to=${dateTo}`;

    api.get(`/finance/parties/${selectedPartyId}/ledger?${query}`)
      .then(res => {
        if (res.data?.success) {
          setLedgerData(res.data);
        }
      })
      .catch(console.error)
      .finally(() => setLoadingLedger(false));
  }, [viewMode, selectedPartyId, dateFrom, dateTo]);

  // Fetch aging matrix
  useEffect(() => {
    if (viewMode !== 'AGING') return;
    setLoadingAging(true);

    api.get(`/finance/aging?direction=${agingDirection}`)
      .then(res => {
        if (res.data?.success) {
          setAgingRows(res.data.data || []);
        }
      })
      .catch(console.error)
      .finally(() => setLoadingAging(false));
  }, [viewMode, agingDirection]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="w-full px-2.5 sm:px-3.5 py-2.5 space-y-3 text-xs">
      {/* Header & Sub-Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <Users className="w-6 h-6 text-primary" />
            Party Ledger & Aging Analysis
          </h1>
          <p className="text-slate-500 mt-0.5">
            Audit-ready statement of accounts with running balance and overdue age bracket classification
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-slate-300 dark:border-slate-700 p-0.5 bg-slate-100 dark:bg-slate-800">
            <button
              onClick={() => setViewMode('LEDGER')}
              className={`px-3 py-1.5 rounded-md font-bold transition-all ${
                viewMode === 'LEDGER' ? 'bg-white dark:bg-slate-900 shadow-2xs text-primary' : 'text-slate-600'
              }`}
            >
              Statement of Account (Ledger)
            </button>
            <button
              onClick={() => setViewMode('AGING')}
              className={`px-3 py-1.5 rounded-md font-bold transition-all ${
                viewMode === 'AGING' ? 'bg-white dark:bg-slate-900 shadow-2xs text-primary' : 'text-slate-600'
              }`}
            >
              Aging Matrix (30-60-90+)
            </button>
          </div>

          <button
            onClick={handlePrint}
            className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-1.5"
          >
            <Printer className="w-3.5 h-3.5" /> Print Statement
          </button>
        </div>
      </div>

      {viewMode === 'LEDGER' ? (
        /* ================= LEDGER VIEW ================= */
        <div className="space-y-4">
          {/* Party Picker & Filters Bar */}
          <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 shadow-2xs">
            <div className="flex-1 min-w-[260px] max-w-md">
              <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Select Supplier / Customer</label>
              <select
                value={selectedPartyId}
                onChange={(e) => setSelectedPartyId(e.target.value)}
                className="w-full h-8 px-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-bold text-slate-900 dark:text-white"
              >
                {parties.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name} [{p.type}] {p.gstin ? `(${p.gstin})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">From Date</label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="h-8 px-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">To Date</label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="h-8 px-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                />
              </div>
            </div>
          </div>

          {/* Party Information & Balance Strip */}
          {ledgerData?.party && (
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <div className="text-[10px] uppercase font-bold text-slate-400">Party Name</div>
                <div className="text-sm font-black text-slate-900 dark:text-white mt-0.5">
                  {ledgerData.party.name}
                </div>
                <div className="text-[11px] text-slate-500">GSTIN: {ledgerData.party.gstin || 'Unregistered'}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase font-bold text-slate-400">Terms & Limit</div>
                <div className="text-sm font-bold text-slate-700 dark:text-slate-300 mt-0.5">
                  Credit Days: {ledgerData.party.credit_days || 30} days
                </div>
                <div className="text-[11px] text-slate-500">Limit: {formatINR(ledgerData.party.credit_limit)}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase font-bold text-slate-400">Opening Balance</div>
                <div className="text-sm font-extrabold text-slate-700 dark:text-slate-300 mt-0.5">
                  {formatINR(ledgerData.openingBalance)} ({ledgerData.party.opening_balance_type})
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase font-bold text-slate-400">Net Closing Balance</div>
                <div className={`text-base font-black mt-0.5 ${ledgerData.closingBalance > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                  {formatINR(Math.abs(ledgerData.closingBalance))} {ledgerData.closingBalance > 0 ? 'Dr' : 'Cr'}
                </div>
              </div>
            </div>
          )}

          {/* Statement Table */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 dark:bg-slate-950/70 border-b border-slate-200 dark:border-slate-800 text-[11px] uppercase font-bold text-slate-500">
                  <tr>
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Ref / Doc No</th>
                    <th className="py-2.5 px-2">Type</th>
                    <th className="py-2.5 px-3">Particulars / Description</th>
                    <th className="py-2.5 px-3 text-right">Debit (Dr)</th>
                    <th className="py-2.5 px-3 text-right">Credit (Cr)</th>
                    <th className="py-2.5 px-3 text-right">Running Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {loadingLedger ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400">
                        Loading statement of account...
                      </td>
                    </tr>
                  ) : !ledgerData?.ledger || ledgerData.ledger.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400">
                        No transactions recorded for this party in the selected date range.
                      </td>
                    </tr>
                  ) : (
                    ledgerData.ledger.map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 font-mono">
                        <td className="py-2 px-3 text-slate-500 font-sans">{formatDate(row.txn_date)}</td>
                        <td className="py-2 px-3 font-bold text-slate-900 dark:text-white">{row.ref_no}</td>
                        <td className="py-2 px-2 text-[10px] font-sans font-bold uppercase text-slate-500">
                          {row.txn_type}
                        </td>
                        <td className="py-2 px-3 text-slate-600 dark:text-slate-400 font-sans">{row.description}</td>
                        <td className="py-2 px-3 text-right font-medium text-slate-800 dark:text-slate-200">
                          {row.debit > 0 ? formatINR(row.debit) : '-'}
                        </td>
                        <td className="py-2 px-3 text-right font-medium text-slate-800 dark:text-slate-200">
                          {row.credit > 0 ? formatINR(row.credit) : '-'}
                        </td>
                        <td className="py-2 px-3 text-right font-black text-slate-900 dark:text-white">
                          {formatINR(row.running_balance)}
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
        /* ================= AGING VIEW ================= */
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
            <span className="font-bold text-slate-700 dark:text-slate-300">
              Aging Direction Analysis:
            </span>
            <div className="flex rounded-md border border-slate-300 dark:border-slate-700 p-0.5 bg-slate-100 dark:bg-slate-800">
              <button
                onClick={() => setAgingDirection('PAYABLE')}
                className={`px-3 py-1 rounded font-bold transition-all ${
                  agingDirection === 'PAYABLE' ? 'bg-white dark:bg-slate-900 shadow-2xs text-rose-600' : 'text-slate-600'
                }`}
              >
                Accounts Payable (Suppliers)
              </button>
              <button
                onClick={() => setAgingDirection('RECEIVABLE')}
                className={`px-3 py-1 rounded font-bold transition-all ${
                  agingDirection === 'RECEIVABLE' ? 'bg-white dark:bg-slate-900 shadow-2xs text-emerald-600' : 'text-slate-600'
                }`}
              >
                Accounts Receivable (Customers)
              </button>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 dark:bg-slate-950/70 border-b border-slate-200 dark:border-slate-800 text-[11px] uppercase font-bold text-slate-500">
                  <tr>
                    <th className="py-2.5 px-3">Party Name</th>
                    <th className="py-2.5 px-3 text-right font-extrabold">Total Balance</th>
                    <th className="py-2.5 px-3 text-right">Current (0d)</th>
                    <th className="py-2.5 px-3 text-right">1-30 Days</th>
                    <th className="py-2.5 px-3 text-right">31-60 Days</th>
                    <th className="py-2.5 px-3 text-right">61-90 Days</th>
                    <th className="py-2.5 px-3 text-right text-rose-600">90+ Days</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                  {loadingAging ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400 font-sans">
                        Calculating aging brackets...
                      </td>
                    </tr>
                  ) : agingRows.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400 font-sans">
                        No outstanding debt in this direction.
                      </td>
                    </tr>
                  ) : (
                    agingRows.map((r, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="py-2.5 px-3 font-sans font-bold text-slate-900 dark:text-white">
                          {r.party_name}
                        </td>
                        <td className="py-2.5 px-3 text-right font-black text-slate-900 dark:text-white">
                          {formatINR(r.total_outstanding)}
                        </td>
                        <td className="py-2.5 px-3 text-right text-emerald-600">
                          {formatINR(r.current_due)}
                        </td>
                        <td className="py-2.5 px-3 text-right text-slate-700 dark:text-slate-300">
                          {formatINR(r.bucket_0_30)}
                        </td>
                        <td className="py-2.5 px-3 text-right text-amber-600">
                          {formatINR(r.bucket_31_60)}
                        </td>
                        <td className="py-2.5 px-3 text-right text-rose-500">
                          {formatINR(r.bucket_61_90)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-rose-600">
                          {formatINR(r.bucket_90_plus)}
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
