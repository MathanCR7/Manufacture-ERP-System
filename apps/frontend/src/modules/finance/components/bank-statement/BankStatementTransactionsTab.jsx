import { useState, useEffect, useCallback } from 'react';
import {
  Search, Download, History, Pencil, Trash2, ArrowUpDown, ChevronLeft, ChevronRight,
  AlertTriangle, CheckCircle2, XCircle, Loader2, X, UploadCloud, Clock, FileCheck2
} from 'lucide-react';
import { api } from '@/lib/axios';
import { formatINRBank, formatBankDisplayDate, downloadAuthenticatedExcel } from './bankStatementHelpers';

const DATE_PRESETS = [
  { id: 'all', label: 'All' },
  { id: 'today', label: 'Today' },
  { id: 'this_week', label: 'This week' },
  { id: 'last_week', label: 'Last week' },
  { id: 'this_month', label: 'This month' },
  { id: 'last_month', label: 'Last month' },
  { id: 'this_year', label: 'This year' },
  { id: 'this_fy', label: 'This FY' },
  { id: 'last_fy', label: 'Last FY' },
  { id: 'custom', label: 'Custom' }
];

export default function BankStatementTransactionsTab({
  accounts = [],
  permissions = {},
  refreshTrigger = 0,
  onDataMutated,
  onGoToUpload,
  onGoToGst,
  externalAccountId,
  onExternalAccountChange
}) {
  const [preset, setPreset] = useState('all');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [internalAccountId, setInternalAccountId] = useState('ALL');
  const accountId = externalAccountId !== undefined ? externalAccountId : internalAccountId;
  const setAccountId = onExternalAccountChange || setInternalAccountId;
  const [dcFilter, setDcFilter] = useState('ALL');
  const [txnType, setTxnType] = useState('ALL');
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const [sortBy, setSortBy] = useState('txn_date');
  const [sortDir, setSortDir] = useState('DESC');
  const [page, setPage] = useState(1);
  const [limit] = useState(25);

  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState({ count: 0, totalDebit: 0, totalCredit: 0, net: 0 });
  const [availableTypes, setAvailableTypes] = useState([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, totalPages: 1 });
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [exporting, setExporting] = useState(false);

  // Edit Popup State
  const [editingRow, setEditingRow] = useState(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState('');

  // Delete Confirm State
  const [deletingRow, setDeletingRow] = useState(null);
  const [deleteSaving, setDeleteSaving] = useState(false);

  // Change Log Modal State
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loadingAudit, setLoadingAudit] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(searchInput);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const fetchTransactions = useCallback(async () => {
    if (preset === 'custom' && customFrom && customTo && customFrom > customTo) {
      setErrorMsg('From date cannot be after To date.');
      return;
    }
    try {
      setLoading(true);
      setErrorMsg('');
      const params = new URLSearchParams({
        preset,
        accountId,
        dcFilter,
        txnType,
        search: debouncedSearch,
        page: String(page),
        limit: String(limit),
        sortBy,
        sortDir
      });
      if (preset === 'custom') {
        if (customFrom) params.set('from', customFrom);
        if (customTo) params.set('to', customTo);
      }

      const res = await api.get(`/finance/bank-statement/transactions?${params.toString()}`);
      if (res.data?.success) {
        setRows(res.data.data.rows || []);
        setSummary(res.data.data.summary || { count: 0, totalDebit: 0, totalCredit: 0, net: 0 });
        setAvailableTypes(res.data.data.filterMeta?.availableTypes || []);
        setMeta(res.data.data.meta || { total: 0, page: 1, totalPages: 1 });
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.error || 'Failed to load bank transactions.');
    } finally {
      setLoading(false);
    }
  }, [preset, customFrom, customTo, accountId, dcFilter, txnType, debouncedSearch, page, limit, sortBy, sortDir]);

  useEffect(() => {
    const t = setTimeout(() => {
      fetchTransactions();
    }, 0);
    return () => clearTimeout(t);
  }, [fetchTransactions, refreshTrigger]);

  const handleSort = (col) => {
    if (sortBy === col) {
      setSortDir((prev) => (prev === 'DESC' ? 'ASC' : 'DESC'));
    } else {
      setSortBy(col);
      setSortDir('DESC');
    }
    setPage(1);
  };

  const handleExportExcel = async () => {
    try {
      setExporting(true);
      const params = new URLSearchParams({
        preset,
        accountId,
        dcFilter,
        txnType,
        search: debouncedSearch
      });
      if (preset === 'custom') {
        if (customFrom) params.set('from', customFrom);
        if (customTo) params.set('to', customTo);
      }
      await downloadAuthenticatedExcel(
        `/finance/bank-statement/export/transactions?${params.toString()}`,
        `bank-transactions_${new Date().toISOString().slice(0, 10)}.xlsx`
      );
    } catch (err) {
      setErrorMsg(err.response?.data?.error || 'Failed to export Excel.');
    } finally {
      setExporting(false);
    }
  };

  const openChangeLog = async () => {
    setShowAuditModal(true);
    try {
      setLoadingAudit(true);
      const res = await api.get('/finance/bank-statement/audit-logs');
      if (res.data?.success) setAuditLogs(res.data.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingAudit(false);
    }
  };

  const openEditPopup = (row) => {
    setEditError('');
    setEditingRow({
      id: row.id,
      version: row.version,
      bankAccountId: row.bank_account_id,
      txnDate: row.txn_date,
      valueDate: row.value_date || '',
      description: row.description || '',
      refNo: row.ref_no || '',
      branchCode: row.branch_code || '',
      type: row.txn_type || '',
      debit: row.debit > 0 ? String(row.debit) : '',
      credit: row.credit > 0 ? String(row.credit) : '',
      balance: row.balance !== null && row.balance !== undefined ? String(row.balance) : '',
      remarks: row.remarks || '',
      gstReviewed: row.gst_reviewed
    });
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editingRow || editSaving) return;
    try {
      setEditSaving(true);
      setEditError('');
      const res = await api.put(`/finance/bank-statement/transactions/${editingRow.id}`, {
        version: editingRow.version,
        bankAccountId: editingRow.bankAccountId,
        txnDate: editingRow.txnDate,
        valueDate: editingRow.valueDate,
        description: editingRow.description,
        refNo: editingRow.refNo,
        branchCode: editingRow.branchCode,
        type: editingRow.type,
        debit: editingRow.debit || 0,
        credit: editingRow.credit || 0,
        balance: editingRow.balance,
        remarks: editingRow.remarks
      });
      if (res.data?.success) {
        const msg = res.data.data.dateOrAmountChanged
          ? 'Transaction updated. Date/Amount changed so GST reviewed mark was reset for verification.'
          : 'Transaction updated successfully.';
        setEditingRow(null);
        setSuccessMsg(msg);
        await fetchTransactions();
        onDataMutated?.();
      }
    } catch (err) {
      setEditError(err.response?.data?.error || 'Failed to update transaction.');
    } finally {
      setEditSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingRow || deleteSaving) return;
    try {
      setDeleteSaving(true);
      const res = await api.delete(`/finance/bank-statement/transactions/${deletingRow.id}`);
      if (res.data?.success) {
        setDeletingRow(null);
        setSuccessMsg('Transaction soft-deleted and excluded from totals and GST.');
        await fetchTransactions();
        onDataMutated?.();
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.error || 'Failed to delete transaction.');
      setDeletingRow(null);
    } finally {
      setDeleteSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      {errorMsg && (
        <div role="alert" className="px-3 py-2 rounded-xl bg-[#FDECEC] border border-[#B4232F]/30 text-[#B4232F] flex items-center justify-between gap-2 text-xs font-semibold">
          <span className="flex items-center gap-1.5"><XCircle className="w-4 h-4 shrink-0" /> {errorMsg}</span>
          <button onClick={() => setErrorMsg('')} className="underline font-bold">Dismiss</button>
        </div>
      )}

      {successMsg && (
        <div role="status" className="px-3 py-2 rounded-xl bg-[#E6F5EF] border border-[#087A55]/30 text-[#087A55] flex items-center justify-between gap-2 text-xs font-semibold">
          <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 shrink-0" /> {successMsg}</span>
          <button onClick={() => setSuccessMsg('')} className="underline font-bold">Dismiss</button>
        </div>
      )}

      {/* Compact 4 KPI Summary Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        <div className="bg-white rounded-[14px] border border-[#E3E8F0] border-t-2 border-t-[#3646C9] px-3.5 py-2.5 flex items-center justify-between">
          <div>
            <div className="text-[10.5px] font-bold uppercase text-slate-500">Transactions</div>
            <div className="text-lg sm:text-xl font-black text-[#14213D] tabular-nums leading-tight">{summary.count}</div>
          </div>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#F4F6FA] text-slate-600">Filtered</span>
        </div>
        <div className="bg-white rounded-[14px] border border-[#E3E8F0] border-t-2 border-t-[#087A55] px-3.5 py-2.5">
          <div className="text-[10.5px] font-bold uppercase text-[#087A55]">Total Credit (Inflow)</div>
          <div className="text-lg sm:text-xl font-black text-[#087A55] tabular-nums leading-tight">{formatINRBank(summary.totalCredit)}</div>
        </div>
        <div className="bg-white rounded-[14px] border border-[#E3E8F0] border-t-2 border-t-[#B4232F] px-3.5 py-2.5">
          <div className="text-[10.5px] font-bold uppercase text-[#B4232F]">Total Debit (Outflow)</div>
          <div className="text-lg sm:text-xl font-black text-[#B4232F] tabular-nums leading-tight">{formatINRBank(summary.totalDebit)}</div>
        </div>
        <div className="bg-white rounded-[14px] border border-[#E3E8F0] border-t-2 border-t-[#111A36] px-3.5 py-2.5">
          <div className="text-[10.5px] font-bold uppercase text-slate-500">Net Cashflow</div>
          <div className={`text-lg sm:text-xl font-black tabular-nums leading-tight ${summary.net >= 0 ? 'text-[#087A55]' : 'text-[#B4232F]'}`}>
            {formatINRBank(summary.net)}
          </div>
        </div>
      </div>

      {/* Dense Combined Filter & Action Toolbar */}
      <div className="bg-white rounded-[14px] border border-[#E3E8F0] p-3 space-y-2.5 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-2">
          {/* Date Presets */}
          <div className="flex flex-wrap gap-1">
            {DATE_PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => { setPreset(p.id); setPage(1); }}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${
                  preset === p.id
                    ? 'bg-[#3646C9] text-white shadow-2xs'
                    : 'bg-[#F4F6FA] text-[#14213D] hover:bg-slate-200/80 border border-[#E3E8F0]'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Right Action Buttons */}
          <div className="flex flex-wrap items-center gap-1.5">
            {permissions.upload && onGoToUpload && (
              <button
                type="button"
                onClick={onGoToUpload}
                className="h-8 px-3 rounded-lg bg-[#3646C9] hover:bg-[#2b39ab] text-white text-[11px] font-bold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <UploadCloud className="w-3.5 h-3.5" />
                <span>Upload</span>
              </button>
            )}
            <button
              type="button"
              disabled={exporting || summary.count === 0}
              onClick={handleExportExcel}
              className="h-8 px-3 rounded-lg border border-[#E3E8F0] bg-white hover:bg-[#F4F6FA] disabled:opacity-50 text-[11px] font-bold text-[#14213D] inline-flex items-center gap-1.5 cursor-pointer"
            >
              {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5 text-[#087A55]" />}
              <span>Export Excel</span>
            </button>
            <button
              type="button"
              onClick={openChangeLog}
              className="h-8 px-3 rounded-lg border border-[#E3E8F0] bg-white hover:bg-[#F4F6FA] text-[11px] font-bold text-[#14213D] inline-flex items-center gap-1.5 cursor-pointer"
            >
              <History className="w-3.5 h-3.5 text-[#3646C9]" />
              <span>Change log</span>
            </button>
          </div>
        </div>

        {/* Single-Row Dropdowns & Search */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2">
          {preset === 'custom' && (
            <>
              <input
                type="date"
                aria-label="From date"
                value={customFrom}
                onChange={(e) => { setCustomFrom(e.target.value); setPage(1); }}
                className="h-8 px-2.5 rounded-lg border border-[#E3E8F0] text-xs font-mono text-[#14213D]"
              />
              <input
                type="date"
                aria-label="To date"
                value={customTo}
                onChange={(e) => { setCustomTo(e.target.value); setPage(1); }}
                className="h-8 px-2.5 rounded-lg border border-[#E3E8F0] text-xs font-mono text-[#14213D]"
              />
            </>
          )}

          <select
            value={accountId}
            aria-label="Account filter"
            onChange={(e) => { setAccountId(e.target.value); setPage(1); }}
            className="h-8 px-2.5 rounded-lg border border-[#E3E8F0] bg-white text-xs font-semibold text-[#14213D]"
          >
            <option value="ALL">All Bank Accounts</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>{a.account_name}</option>
            ))}
          </select>

          <select
            value={dcFilter}
            aria-label="Debit or Credit filter"
            onChange={(e) => { setDcFilter(e.target.value); setPage(1); }}
            className="h-8 px-2.5 rounded-lg border border-[#E3E8F0] bg-white text-xs font-semibold text-[#14213D]"
          >
            <option value="ALL">Debit &amp; Credit</option>
            <option value="DEBIT">Debit Only</option>
            <option value="CREDIT">Credit Only</option>
          </select>

          <select
            value={txnType}
            aria-label="Type filter"
            onChange={(e) => { setTxnType(e.target.value); setPage(1); }}
            className="h-8 px-2.5 rounded-lg border border-[#E3E8F0] bg-white text-xs font-semibold text-[#14213D]"
          >
            <option value="ALL">All Types</option>
            {availableTypes.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>

          <div className={preset === 'custom' ? '' : 'lg:col-span-3'}>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search description, remarks, UTR, reference, party or amount..."
                className="w-full h-8 pl-8 pr-2.5 rounded-lg border border-[#E3E8F0] text-xs text-[#14213D] focus:outline-none focus:ring-2 focus:ring-[#3646C9]/30"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Primary Transactions Table */}
      <div className="bg-white rounded-[14px] border border-[#CBD5E1] overflow-hidden shadow-xs">
        <div className="overflow-x-auto max-h-[65vh]">
          <table className="w-full text-left border-collapse min-w-[1160px] [&_th]:border-r [&_th]:border-[#CBD5E1] [&_th:last-child]:border-r-0 [&_td]:border-r [&_td]:border-[#E2E8F0] [&_td:last-child]:border-r-0">
            <thead className="sticky top-0 z-10 bg-[#EEF2F8] border-b-2 border-[#CBD5E1] text-[10.5px] font-bold uppercase text-[#14213D]">
              <tr>
                <th className="py-2 px-2.5 w-16 text-center">Act</th>
                <th className="py-2 px-2.5 cursor-pointer select-none" onClick={() => handleSort('txn_date')}>
                  <span className="inline-flex items-center gap-1">Txn Date <ArrowUpDown className="w-3 h-3" /></span>
                </th>
                <th className="py-2 px-2.5">Account</th>
                <th className="py-2 px-2.5 min-w-[230px]">Description</th>
                <th className="py-2 px-2.5 min-w-[140px]">Remarks</th>
                <th className="py-2 px-2.5 cursor-pointer select-none" onClick={() => handleSort('party_name')}>
                  <span className="inline-flex items-center gap-1">Party <ArrowUpDown className="w-3 h-3" /></span>
                </th>
                <th className="py-2 px-2.5">UTR / Ref</th>
                <th className="py-2 px-2.5">GST Status</th>
                <th className="py-2 px-2.5 text-right cursor-pointer select-none" onClick={() => handleSort('debit')}>
                  <span className="inline-flex items-center justify-end gap-1">Debit <ArrowUpDown className="w-3 h-3" /></span>
                </th>
                <th className="py-2 px-2.5 text-right cursor-pointer select-none" onClick={() => handleSort('credit')}>
                  <span className="inline-flex items-center justify-end gap-1">Credit <ArrowUpDown className="w-3 h-3" /></span>
                </th>
                <th className="py-2 px-2.5 text-right cursor-pointer select-none" onClick={() => handleSort('balance')}>
                  <span className="inline-flex items-center justify-end gap-1">Balance <ArrowUpDown className="w-3 h-3" /></span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E3E8F0] text-xs text-[#14213D]">
              {loading ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-slate-400 font-medium">
                    <Loader2 className="w-5 h-5 animate-spin mx-auto mb-1.5 text-[#3646C9]" />
                    Loading transactions...
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center space-y-2">
                    <div className="text-slate-600 font-bold">No transactions for this filter</div>
                    {permissions.upload && onGoToUpload && summary.count === 0 && (
                      <button
                        type="button"
                        onClick={onGoToUpload}
                        className="px-3.5 py-1.5 rounded-lg bg-[#3646C9] text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <UploadCloud className="w-3.5 h-3.5" />
                        <span>Upload First Bank Statement</span>
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                rows.map((r, idx) => (
                  <tr
                    key={r.id}
                    className={`align-top transition-colors hover:bg-[#E8EEFA]/75 ${
                      idx % 2 === 0 ? 'bg-white' : 'bg-[#F3F6FB]'
                    }`}
                  >
                    <td className="py-1.5 px-2 text-center whitespace-nowrap">
                      <div className="inline-flex items-center gap-0.5">
                        {permissions.edit && (
                          <button
                            type="button"
                            onClick={() => openEditPopup(r)}
                            title="Edit transaction"
                            className="p-1 rounded-md text-[#3646C9] hover:bg-indigo-50 cursor-pointer"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {permissions.delete && (
                          <button
                            type="button"
                            onClick={() => setDeletingRow(r)}
                            title="Delete transaction"
                            className="p-1 rounded-md text-[#B4232F] hover:bg-[#FDECEC] cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="py-2 px-2.5 whitespace-nowrap font-mono font-semibold text-[11.5px]">
                      {formatBankDisplayDate(r.txn_date)}
                      <div className="text-[10px] text-slate-400">{r.txn_month} • {r.fin_year}</div>
                    </td>
                    <td className="py-2 px-2.5 whitespace-nowrap font-semibold text-slate-700 text-[11.5px]">
                      {r.account_name}
                      {r.txn_type && (
                        <div className="text-[10px] text-slate-400 font-medium">{r.txn_type}</div>
                      )}
                    </td>
                    <td className="py-2 px-2.5 max-w-[260px] break-words text-[11.5px] leading-snug">{r.description}</td>
                    <td className="py-2 px-2.5 max-w-[160px] break-words text-slate-600 text-[11.5px]">{r.remarks || '—'}</td>
                    <td className="py-2 px-2.5 font-semibold text-[#14213D] text-[11.5px]">
                      {r.party_name || '—'}
                      {r.mode && <div className="text-[10px] text-[#3646C9] font-bold">{r.mode}</div>}
                    </td>
                    <td className="py-2 px-2.5 font-mono text-[11px] text-slate-600 break-all max-w-[130px]">
                      {r.utr || r.ref_no || '—'}
                    </td>
                    <td className="py-2 px-2.5 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={onGoToGst}
                        className="cursor-pointer text-left"
                        title="Open GST & Filing tab"
                      >
                        {r.gst_reviewed && !r.gst_needs_recheck ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#E6F5EF] text-[#087A55] border border-[#087A55]/20 text-[10px] font-bold">
                            <FileCheck2 className="w-2.5 h-2.5" /> {r.gst_treatment}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#FEF4E6] text-[#8A5300] border border-[#8A5300]/20 text-[10px] font-bold">
                            <Clock className="w-2.5 h-2.5" /> {r.gst_needs_recheck ? 'Re-check GST' : 'Needs Review'}
                          </span>
                        )}
                      </button>
                    </td>
                    <td className="py-2 px-2.5 text-right font-mono tabular-nums font-bold text-[#B4232F] whitespace-nowrap">
                      {r.debit > 0 ? formatINRBank(r.debit) : '—'}
                    </td>
                    <td className="py-2 px-2.5 text-right font-mono tabular-nums font-bold text-[#087A55] whitespace-nowrap">
                      {r.credit > 0 ? formatINRBank(r.credit) : '—'}
                    </td>
                    <td className="py-2 px-2.5 text-right font-mono tabular-nums font-bold text-[#14213D] whitespace-nowrap">
                      {r.balance !== null && r.balance !== undefined ? formatINRBank(r.balance) : '—'}
                      {r.balance_gap_flag && (
                        <div className="text-[10px] text-[#8A5300] font-semibold">⚠ Gap</div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            <tfoot className="sticky bottom-0 z-10 bg-[#EEF2F8] border-t-2 border-[#CBD5E1] text-xs font-black text-[#14213D]">
              <tr>
                <td colSpan={8} className="py-2 px-2.5 uppercase tracking-wide">
                  TOTAL ({summary.count} FILTERED TRANSACTIONS)
                </td>
                <td className="py-2 px-2.5 text-right font-mono tabular-nums text-[#B4232F]">
                  {formatINRBank(summary.totalDebit)}
                </td>
                <td className="py-2 px-2.5 text-right font-mono tabular-nums text-[#087A55]">
                  {formatINRBank(summary.totalCredit)}
                </td>
                <td className="py-2 px-2.5 text-right font-mono tabular-nums text-slate-500">
                  Net {formatINRBank(summary.net)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Compact Pagination Footer */}
        <div className="px-3 py-2 border-t border-[#E3E8F0] flex items-center justify-between bg-white text-xs">
          <span className="text-slate-500 font-medium">
            Showing page <strong className="text-[#14213D]">{meta.page}</strong> of <strong className="text-[#14213D]">{meta.totalPages}</strong> ({meta.total} entries)
          </span>
          {meta.totalPages > 1 && (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-2.5 py-1 rounded-lg border border-[#E3E8F0] font-bold text-[#14213D] disabled:opacity-40 inline-flex items-center gap-1 cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" /> Prev
              </button>
              <button
                type="button"
                disabled={page >= meta.totalPages}
                onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))}
                className="px-2.5 py-1 rounded-lg border border-[#E3E8F0] font-bold text-[#14213D] disabled:opacity-40 inline-flex items-center gap-1 cursor-pointer"
              >
                Next <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Edit Transaction Popup */}
      {editingRow && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-2xs flex items-center justify-center p-4" onClick={() => !editSaving && setEditingRow(null)}>
          <form
            onSubmit={handleSaveEdit}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-[14px] border border-[#E3E8F0] w-full max-w-2xl p-4 sm:p-5 space-y-3.5 shadow-xl max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-[#E3E8F0] pb-2.5">
              <h3 className="text-sm font-black text-[#14213D]">Edit transaction</h3>
              <button type="button" onClick={() => setEditingRow(null)} className="p-1 rounded-lg hover:bg-[#F4F6FA]">
                <X className="w-4 h-4" />
              </button>
            </div>

            {editingRow.gstReviewed && (
              <div className="p-2.5 rounded-xl bg-[#FEF4E6] border border-[#8A5300]/30 text-[#8A5300] text-xs font-semibold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>Changing Txn Date, Debit or Credit removes the GST "reviewed" mark and flags linked invoice allocations for re-check.</span>
              </div>
            )}

            {editError && (
              <div className="p-2.5 rounded-xl bg-[#FDECEC] border border-[#B4232F]/30 text-[#B4232F] text-xs font-semibold">
                {editError}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
              <div>
                <label className="block font-bold text-slate-600 mb-1">Account</label>
                <select
                  value={editingRow.bankAccountId}
                  onChange={(e) => setEditingRow({ ...editingRow, bankAccountId: e.target.value })}
                  className="w-full h-9 px-2.5 rounded-xl border border-[#E3E8F0]"
                >
                  {accounts.map((a) => <option key={a.id} value={a.id}>{a.account_name}</option>)}
                </select>
              </div>
              <div>
                <label className="block font-bold text-slate-600 mb-1">Txn Date</label>
                <input
                  type="date"
                  required
                  value={editingRow.txnDate}
                  onChange={(e) => setEditingRow({ ...editingRow, txnDate: e.target.value })}
                  className="w-full h-9 px-2.5 rounded-xl border border-[#E3E8F0] font-mono"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-600 mb-1">Value Date</label>
                <input
                  type="date"
                  value={editingRow.valueDate}
                  onChange={(e) => setEditingRow({ ...editingRow, valueDate: e.target.value })}
                  className="w-full h-9 px-2.5 rounded-xl border border-[#E3E8F0] font-mono"
                />
              </div>
            </div>

            <div className="text-xs">
              <label className="block font-bold text-slate-600 mb-1">Description</label>
              <textarea
                required
                rows={2}
                value={editingRow.description}
                onChange={(e) => setEditingRow({ ...editingRow, description: e.target.value })}
                className="w-full p-2.5 rounded-xl border border-[#E3E8F0]"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
              <div>
                <label className="block font-bold text-slate-600 mb-1">Ref No. / Cheque No.</label>
                <input
                  type="text"
                  value={editingRow.refNo}
                  onChange={(e) => setEditingRow({ ...editingRow, refNo: e.target.value })}
                  className="w-full h-9 px-2.5 rounded-xl border border-[#E3E8F0] font-mono"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-600 mb-1">Branch Code</label>
                <input
                  type="text"
                  value={editingRow.branchCode}
                  onChange={(e) => setEditingRow({ ...editingRow, branchCode: e.target.value })}
                  className="w-full h-9 px-2.5 rounded-xl border border-[#E3E8F0] font-mono"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-600 mb-1">Type</label>
                <input
                  type="text"
                  value={editingRow.type}
                  onChange={(e) => setEditingRow({ ...editingRow, type: e.target.value })}
                  className="w-full h-9 px-2.5 rounded-xl border border-[#E3E8F0]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
              <div>
                <label className="block font-bold text-[#B4232F] mb-1">Debit</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={editingRow.debit}
                  onChange={(e) => setEditingRow({ ...editingRow, debit: e.target.value })}
                  className="w-full h-9 px-2.5 rounded-xl border border-[#E3E8F0] text-right font-mono tabular-nums"
                />
              </div>
              <div>
                <label className="block font-bold text-[#087A55] mb-1">Credit</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={editingRow.credit}
                  onChange={(e) => setEditingRow({ ...editingRow, credit: e.target.value })}
                  className="w-full h-9 px-2.5 rounded-xl border border-[#E3E8F0] text-right font-mono tabular-nums"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-600 mb-1">Balance</label>
                <input
                  type="number"
                  step="0.01"
                  value={editingRow.balance}
                  onChange={(e) => setEditingRow({ ...editingRow, balance: e.target.value })}
                  className="w-full h-9 px-2.5 rounded-xl border border-[#E3E8F0] text-right font-mono tabular-nums"
                />
              </div>
            </div>

            <div className="text-xs">
              <label className="block font-bold text-slate-600 mb-1">Remarks</label>
              <input
                type="text"
                value={editingRow.remarks}
                onChange={(e) => setEditingRow({ ...editingRow, remarks: e.target.value })}
                className="w-full h-9 px-2.5 rounded-xl border border-[#E3E8F0]"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[#E3E8F0]">
              <button
                type="button"
                disabled={editSaving}
                onClick={() => setEditingRow(null)}
                className="px-4 py-1.5 rounded-xl border border-[#E3E8F0] text-xs font-bold text-[#14213D]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={editSaving}
                className="px-4 py-1.5 rounded-xl bg-[#3646C9] hover:bg-[#2b39ab] text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
              >
                {editSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Save changes</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Soft Delete Confirmation */}
      {deletingRow && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-2xs flex items-center justify-center p-4" onClick={() => !deleteSaving && setDeletingRow(null)}>
          <div className="bg-white rounded-[14px] border border-[#E3E8F0] w-full max-w-md p-4 space-y-3 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-black text-[#14213D]">Delete this transaction?</h3>
            <p className="text-xs text-slate-600">
              <span className="font-bold text-[#14213D]">{formatBankDisplayDate(deletingRow.txn_date)}</span> — {deletingRow.description}
            </p>
            <p className="text-xs text-[#8A5300] font-semibold">
              This performs a soft delete, excludes the entry from totals and GST working papers, and records an entry in the audit log.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                disabled={deleteSaving}
                onClick={() => setDeletingRow(null)}
                className="px-3.5 py-1.5 rounded-xl border border-[#E3E8F0] text-xs font-bold text-[#14213D]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleteSaving}
                onClick={handleConfirmDelete}
                className="px-3.5 py-1.5 rounded-xl bg-[#B4232F] hover:bg-red-800 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
              >
                {deleteSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Confirm Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Change Log Modal */}
      {showAuditModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-2xs flex items-center justify-center p-4" onClick={() => setShowAuditModal(false)}>
          <div className="bg-white rounded-[14px] border border-[#E3E8F0] w-full max-w-4xl p-4 space-y-3 shadow-xl max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-[#E3E8F0] pb-2.5">
              <h3 className="text-sm font-black text-[#14213D] flex items-center gap-2">
                <History className="w-4 h-4 text-[#3646C9]" /> Bank Statement Audit &amp; Change Log
              </h3>
              <button type="button" onClick={() => setShowAuditModal(false)} className="p-1 rounded-lg hover:bg-[#F4F6FA]">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="overflow-y-auto flex-1 space-y-2 pr-1">
              {loadingAudit ? (
                <div className="py-10 text-center text-xs text-slate-400">Loading change history...</div>
              ) : auditLogs.length === 0 ? (
                <div className="py-10 text-center text-xs text-slate-400">No audit changes recorded yet.</div>
              ) : (
                auditLogs.map((log) => (
                  <div key={log.id} className="p-2.5 rounded-xl border border-[#E3E8F0] bg-[#F4F6FA]/50 text-xs space-y-1.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="px-2 py-0.5 rounded-full bg-white border border-[#E3E8F0] font-bold text-[#3646C9] text-[10px]">
                        {log.action}
                      </span>
                      <span className="text-[11px] text-slate-500 font-medium">
                        By <strong className="text-[#14213D]">{log.changed_by_name || log.changed_by}</strong> • {new Date(log.changed_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px] font-mono">
                      {log.before_data && (
                        <div className="p-2 rounded-lg bg-white border border-[#E3E8F0] overflow-x-auto">
                          <div className="text-[10px] font-sans font-bold text-[#B4232F] mb-0.5">Before</div>
                          <pre className="whitespace-pre-wrap break-all">{JSON.stringify(log.before_data, null, 1)}</pre>
                        </div>
                      )}
                      {log.after_data && (
                        <div className="p-2 rounded-lg bg-white border border-[#E3E8F0] overflow-x-auto">
                          <div className="text-[10px] font-sans font-bold text-[#087A55] mb-0.5">After</div>
                          <pre className="whitespace-pre-wrap break-all">{JSON.stringify(log.after_data, null, 1)}</pre>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
