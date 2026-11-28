import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Search, Download, History, Pencil, Trash2, ArrowUpDown,
  AlertTriangle, CheckCircle2, XCircle, Loader2, X, UploadCloud, Clock, FileCheck2,
  RotateCcw, FileSpreadsheet, Layers
} from 'lucide-react';
import { api } from '@/lib/axios';
import { formatINRBank, formatBankDisplayDate, downloadAuthenticatedExcel } from './bankStatementHelpers';
import BankStatementPagination from './BankStatementPagination';

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
  const [limit, setLimit] = useState(25);

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

  // Delete & Bulk Select State
  const [deletingRow, setDeletingRow] = useState(null);
  const [deleteSaving, setDeleteSaving] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  // Full-Screen Audit Log & Uploaded Excel Batches Modal State
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [auditTab, setAuditTab] = useState('LOGS'); // 'LOGS' | 'BATCHES'
  const [auditLogs, setAuditLogs] = useState([]);
  const [batches, setBatches] = useState([]);
  const [loadingAudit, setLoadingAudit] = useState(false);
  const [auditActionFilter, setAuditActionFilter] = useState('ALL');
  const [auditSearch, setAuditSearch] = useState('');
  const [auditError, setAuditError] = useState('');
  const [auditSuccess, setAuditSuccess] = useState('');
  const [busyAuditId, setBusyAuditId] = useState(null);
  const [expandedRawLogId, setExpandedRawLogId] = useState(null);

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

  const loadAuditAndBatches = async () => {
    try {
      setLoadingAudit(true);
      setAuditError('');
      const [logsRes, batchesRes] = await Promise.all([
        api.get('/finance/bank-statement/audit-logs?limit=200'),
        api.get('/finance/bank-statement/batches')
      ]);
      if (logsRes.data?.success) setAuditLogs(logsRes.data.data || []);
      if (batchesRes.data?.success) setBatches(batchesRes.data.data || []);
    } catch (err) {
      setAuditError(err.response?.data?.error || 'Failed to load change history & batches.');
    } finally {
      setLoadingAudit(false);
    }
  };

  const openChangeLog = async (initialTab = 'LOGS') => {
    setAuditTab(initialTab);
    setAuditSuccess('');
    setAuditError('');
    setShowAuditModal(true);
    await loadAuditAndBatches();
  };

  const handleRestoreTxn = async (txnId) => {
    if (!txnId || busyAuditId) return;
    try {
      setBusyAuditId(txnId);
      setAuditError('');
      const res = await api.post(`/finance/bank-statement/transactions/${txnId}/restore`);
      if (res.data?.success) {
        setAuditSuccess('Deleted transaction restored cleanly back to the active table.');
        setSuccessMsg('Transaction restored cleanly.');
        await Promise.all([loadAuditAndBatches(), fetchTransactions()]);
        onDataMutated?.();
      }
    } catch (err) {
      setAuditError(err.response?.data?.error || 'Failed to restore transaction.');
    } finally {
      setBusyAuditId(null);
    }
  };

  const handleUndoBatch = async (batchId, fileName) => {
    if (!batchId || busyAuditId) return;
    try {
      setBusyAuditId(batchId);
      setAuditError('');
      const res = await api.delete(`/finance/bank-statement/batches/${batchId}`);
      if (res.data?.success) {
        const cnt = res.data.data?.removedCount || 0;
        setAuditSuccess(`Removed ${cnt} transaction(s) from "${fileName}".`);
        setSuccessMsg(`Removed ${cnt} transaction(s) uploaded from "${fileName}".`);
        await Promise.all([loadAuditAndBatches(), fetchTransactions()]);
        onDataMutated?.();
      }
    } catch (err) {
      setAuditError(err.response?.data?.error || 'Failed to remove Excel batch.');
    } finally {
      setBusyAuditId(null);
    }
  };

  const handleRestoreBatch = async (batchId, fileName) => {
    if (!batchId || busyAuditId) return;
    try {
      setBusyAuditId(batchId);
      setAuditError('');
      const res = await api.post(`/finance/bank-statement/batches/${batchId}/restore`);
      if (res.data?.success) {
        const cnt = res.data.data?.restoredCount || 0;
        setAuditSuccess(`Restored ${cnt} transaction(s) from "${fileName}".`);
        setSuccessMsg(`Restored ${cnt} transaction(s) from "${fileName}".`);
        await Promise.all([loadAuditAndBatches(), fetchTransactions()]);
        onDataMutated?.();
      }
    } catch (err) {
      setAuditError(err.response?.data?.error || 'Failed to restore Excel batch.');
    } finally {
      setBusyAuditId(null);
    }
  };

  const toggleSelectAll = (checked) => {
    if (!checked) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(rows.map((r) => r.id)));
    }
  };

  const toggleSelectOne = (id) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const handleConfirmBulkDelete = async () => {
    if (selectedIds.size === 0 || bulkDeleting) return;
    try {
      setBulkDeleting(true);
      const res = await api.post('/finance/bank-statement/transactions/bulk-delete', {
        txnIds: Array.from(selectedIds)
      });
      if (res.data?.success) {
        setShowBulkDeleteModal(false);
        setSelectedIds(new Set());
        setSuccessMsg(`Soft-deleted ${res.data.deletedCount} selected transaction(s). You can restore them anytime from Change Log.`);
        await fetchTransactions();
        onDataMutated?.();
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.error || 'Failed to delete selected transactions.');
      setShowBulkDeleteModal(false);
    } finally {
      setBulkDeleting(false);
    }
  };

  const filteredAuditLogs = useMemo(() => {
    const q = auditSearch.trim().toLowerCase();
    return auditLogs.filter((log) => {
      if (auditActionFilter !== 'ALL' && log.action !== auditActionFilter) return false;
      if (q) {
        const hay = `${log.action} ${log.changed_by_name || ''} ${JSON.stringify(log.before_data || '')} ${JSON.stringify(log.after_data || '')}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [auditLogs, auditActionFilter, auditSearch]);

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
        <div role="alert" className="px-3 py-2 rounded-xl bg-[#FDECEC] dark:bg-rose-500/15 border border-[#B4232F]/30 dark:border-rose-500/30 text-[#B4232F] dark:text-rose-400 flex items-center justify-between gap-2 text-xs font-semibold">
          <span className="flex items-center gap-1.5"><XCircle className="w-4 h-4 shrink-0" /> {errorMsg}</span>
          <button onClick={() => setErrorMsg('')} className="underline font-bold">Dismiss</button>
        </div>
      )}

      {successMsg && (
        <div role="status" className="px-3 py-2 rounded-xl bg-[#E6F5EF] dark:bg-emerald-500/15 border border-[#087A55]/30 dark:border-emerald-500/30 text-[#087A55] dark:text-emerald-400 flex items-center justify-between gap-2 text-xs font-semibold">
          <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 shrink-0" /> {successMsg}</span>
          <button onClick={() => setSuccessMsg('')} className="underline font-bold">Dismiss</button>
        </div>
      )}

      {/* Compact 4 KPI Summary Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        <div className="bg-white dark:bg-slate-900 rounded-[14px] border border-[#E3E8F0] dark:border-slate-800 border-t-2 border-t-[#3646C9] px-3.5 py-2.5 flex items-center justify-between">
          <div>
            <div className="text-[10.5px] font-bold uppercase text-slate-500 dark:text-slate-400">Transactions</div>
            <div className="text-lg sm:text-xl font-black text-[#14213D] dark:text-slate-100 tabular-nums leading-tight">{summary.count}</div>
          </div>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#F4F6FA] dark:bg-slate-800 text-slate-600 dark:text-slate-300">Filtered</span>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-[14px] border border-[#E3E8F0] dark:border-slate-800 border-t-2 border-t-[#087A55] px-3.5 py-2.5">
          <div className="text-[10.5px] font-bold uppercase text-[#087A55] dark:text-emerald-400">Total Inward (Credit)</div>
          <div className="text-lg sm:text-xl font-black text-[#087A55] dark:text-emerald-400 tabular-nums leading-tight">{formatINRBank(summary.totalCredit)}</div>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-[14px] border border-[#E3E8F0] dark:border-slate-800 border-t-2 border-t-[#B4232F] px-3.5 py-2.5">
          <div className="text-[10.5px] font-bold uppercase text-[#B4232F] dark:text-rose-400">Total Outward (Debit)</div>
          <div className="text-lg sm:text-xl font-black text-[#B4232F] dark:text-rose-400 tabular-nums leading-tight">{formatINRBank(summary.totalDebit)}</div>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-[14px] border border-[#E3E8F0] dark:border-slate-800 border-t-2 border-t-[#EA580C] dark:border-t-orange-500 px-3.5 py-2.5">
          <div className="text-[10.5px] font-bold uppercase text-[#EA580C] dark:text-orange-400">Net Cashflow</div>
          <div className="text-lg sm:text-xl font-black text-[#EA580C] dark:text-orange-400 tabular-nums leading-tight">
            {formatINRBank(summary.net)}
          </div>
        </div>
      </div>

      {/* Dense Combined Filter & Action Toolbar */}
      <div className="bg-white dark:bg-slate-900 rounded-[14px] border border-[#E3E8F0] dark:border-slate-800 p-3 space-y-2.5 shadow-2xs">
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
                    : 'bg-[#F4F6FA] dark:bg-slate-950 text-[#14213D] dark:text-slate-100 transition-colors hover:bg-slate-200 dark:hover:bg-slate-700/80 dark:hover:bg-slate-700 border border-[#E3E8F0] dark:border-slate-800'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Right Action Buttons */}
          <div className="flex flex-wrap items-center gap-1.5">
            {permissions.delete && selectedIds.size > 0 && (
              <button
                type="button"
                onClick={() => setShowBulkDeleteModal(true)}
                className="h-8 px-3 rounded-lg bg-[#FDECEC] dark:bg-rose-500/15 border border-[#B4232F]/35 dark:border-rose-500/30 hover:bg-red-100 dark:hover:bg-rose-500/25 text-[#B4232F] dark:text-rose-400 text-[11px] font-bold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Selected ({selectedIds.size})</span>
              </button>
            )}
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
              className="h-8 px-3 rounded-lg border border-[#E3E8F0] dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-[#F4F6FA] dark:hover:bg-slate-800 disabled:opacity-50 text-[11px] font-bold text-[#14213D] dark:text-slate-100 inline-flex items-center gap-1.5 cursor-pointer"
            >
              {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5 text-[#087A55] dark:text-emerald-400" />}
              <span>Export Excel</span>
            </button>
            <button
              type="button"
              onClick={() => openChangeLog('BATCHES')}
              className="h-8 px-3 rounded-lg border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/15 hover:bg-amber-100 dark:hover:bg-amber-500/25 text-[11px] font-bold text-[#8A5300] dark:text-amber-300 inline-flex items-center gap-1.5 cursor-pointer"
              title="View uploaded Excel batches and remove/undo an entire upload"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Upload Batches</span>
            </button>
            <button
              type="button"
              onClick={() => openChangeLog('LOGS')}
              className="h-8 px-3 rounded-lg border border-[#E3E8F0] dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-[#F4F6FA] dark:hover:bg-slate-800 text-[11px] font-bold text-[#14213D] dark:text-slate-100 inline-flex items-center gap-1.5 cursor-pointer"
            >
              <History className="w-3.5 h-3.5 text-[#3646C9] dark:text-indigo-400" />
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
                className="h-8 px-2.5 rounded-lg border border-[#E3E8F0] dark:border-slate-800 text-xs font-mono text-[#14213D] dark:text-slate-100 dark:bg-slate-950 dark:text-slate-100"
              />
              <input
                type="date"
                aria-label="To date"
                value={customTo}
                onChange={(e) => { setCustomTo(e.target.value); setPage(1); }}
                className="h-8 px-2.5 rounded-lg border border-[#E3E8F0] dark:border-slate-800 text-xs font-mono text-[#14213D] dark:text-slate-100 dark:bg-slate-950 dark:text-slate-100"
              />
            </>
          )}

          <select
            value={accountId}
            aria-label="Account filter"
            onChange={(e) => { setAccountId(e.target.value); setPage(1); }}
            className="h-8 px-2.5 rounded-lg border border-[#E3E8F0] dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-semibold text-[#14213D] dark:text-slate-100 dark:bg-slate-950 dark:text-slate-100"
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
            className="h-8 px-2.5 rounded-lg border border-[#E3E8F0] dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-semibold text-[#14213D] dark:text-slate-100 dark:bg-slate-950 dark:text-slate-100"
          >
            <option value="ALL">Debit &amp; Credit</option>
            <option value="DEBIT">Debit Only</option>
            <option value="CREDIT">Credit Only</option>
          </select>

          <select
            value={txnType}
            aria-label="Type filter"
            onChange={(e) => { setTxnType(e.target.value); setPage(1); }}
            className="h-8 px-2.5 rounded-lg border border-[#E3E8F0] dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-semibold text-[#14213D] dark:text-slate-100 dark:bg-slate-950 dark:text-slate-100"
          >
            <option value="ALL">All Types</option>
            {availableTypes.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>

          <div className={preset === 'custom' ? '' : 'lg:col-span-3'}>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 dark:text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search description, remarks, UTR, reference, party or amount..."
                className="w-full h-8 pl-8 pr-2.5 rounded-lg border border-[#E3E8F0] dark:border-slate-800 text-xs text-[#14213D] dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#3646C9]/30 dark:bg-slate-950 dark:text-slate-100"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Primary Transactions Table */}
      <div className="bg-white dark:bg-slate-900 rounded-[14px] border border-[#CBD5E1] dark:border-slate-700 overflow-hidden shadow-xs">
        <div className="overflow-x-auto max-h-[68vh]">
          <table className="w-full text-left border-collapse [&_th]:border-r [&_th]:border-[#CBD5E1] dark:border-slate-700 [&_th:last-child]:border-r-0 [&_td]:border-r [&_td]:border-[#E2E8F0] dark:border-slate-800 [&_td:last-child]:border-r-0">
            <thead className="sticky top-0 z-10 bg-[#EEF2F8] dark:bg-slate-800/95 border-b-2 border-[#CBD5E1] dark:border-slate-700 text-[10.5px] font-bold uppercase text-[#14213D] dark:text-slate-100">
              <tr>
                <th className="py-2 px-1.5 w-8 text-center">
                  <input
                    type="checkbox"
                    checked={rows.length > 0 && rows.every((r) => selectedIds.has(r.id))}
                    onChange={(e) => toggleSelectAll(e.target.checked)}
                    aria-label="Select all transactions on this page"
                    className="rounded border-slate-300 text-[#3646C9] dark:text-indigo-400"
                  />
                </th>
                <th className="py-2 px-1.5 w-14 text-center whitespace-nowrap">Act</th>
                <th className="py-2 px-2 cursor-pointer select-none whitespace-nowrap" onClick={() => handleSort('txn_date')}>
                  <span className="inline-flex items-center gap-1">Txn Date <ArrowUpDown className="w-3 h-3" /></span>
                </th>
                <th className="py-2 px-2 whitespace-nowrap">Account</th>
                <th className="py-2 px-2 min-w-[165px] max-w-[230px]">Description</th>
                <th className="py-2 px-2 w-[115px] max-w-[130px]">Remarks</th>
                <th className="py-2 px-2 cursor-pointer select-none whitespace-nowrap" onClick={() => handleSort('party_name')}>
                  <span className="inline-flex items-center gap-1">Party <ArrowUpDown className="w-3 h-3" /></span>
                </th>
                <th className="py-2 px-2 whitespace-nowrap">UTR / Ref</th>
                <th className="py-2 px-2 whitespace-nowrap">GST Status</th>
                <th className="py-2 px-2 text-right cursor-pointer select-none whitespace-nowrap" onClick={() => handleSort('debit')}>
                  <span className="inline-flex items-center justify-end gap-1">Debit <ArrowUpDown className="w-3 h-3" /></span>
                </th>
                <th className="py-2 px-2 text-right cursor-pointer select-none whitespace-nowrap" onClick={() => handleSort('credit')}>
                  <span className="inline-flex items-center justify-end gap-1">Credit <ArrowUpDown className="w-3 h-3" /></span>
                </th>
                <th className="py-2 px-2 text-right cursor-pointer select-none whitespace-nowrap" onClick={() => handleSort('balance')}>
                  <span className="inline-flex items-center justify-end gap-1">Balance <ArrowUpDown className="w-3 h-3" /></span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E3E8F0] dark:divide-slate-800 text-xs text-[#14213D] dark:text-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={12} className="py-12 text-center text-slate-400 dark:text-slate-400 font-medium">
                    <Loader2 className="w-5 h-5 animate-spin mx-auto mb-1.5 text-[#3646C9] dark:text-indigo-400" />
                    Loading transactions...
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={12} className="py-12 text-center space-y-2">
                    <div className="text-slate-600 dark:text-slate-300 font-bold">No transactions for this filter</div>
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
                    className={`align-top transition-colors hover:bg-[#E8EEFA]/75 dark:hover:bg-slate-800/90 ${
                      selectedIds.has(r.id)
                        ? 'bg-indigo-50/70 dark:bg-indigo-950/50'
                        : idx % 2 === 0
                          ? 'bg-white dark:bg-slate-900'
                          : 'bg-[#F3F6FB] dark:bg-slate-800/45'
                    }`}
                  >
                    <td className="py-1.5 px-1.5 text-center">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(r.id)}
                        onChange={() => toggleSelectOne(r.id)}
                        aria-label={`Select transaction ${r.txn_date}`}
                        className="rounded border-slate-300 text-[#3646C9] dark:text-indigo-400"
                      />
                    </td>
                    <td className="py-1.5 px-1.5 text-center whitespace-nowrap">
                      <div className="inline-flex items-center gap-0.5">
                        {permissions.edit && (
                          <button
                            type="button"
                            onClick={() => openEditPopup(r)}
                            title="Edit transaction"
                            className="p-1 rounded-md text-[#3646C9] dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 cursor-pointer"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {permissions.delete && (
                          <button
                            type="button"
                            onClick={() => setDeletingRow(r)}
                            title="Delete transaction"
                            className="p-1 rounded-md text-[#B4232F] dark:text-rose-400 hover:bg-[#FDECEC] dark:hover:bg-rose-500/20 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="py-1.5 px-2 whitespace-nowrap font-mono font-semibold text-[11px]">
                      {formatBankDisplayDate(r.txn_date)}
                      <div className="text-[9.5px] text-slate-400 dark:text-slate-400">{r.txn_month} • {r.fin_year}</div>
                    </td>
                    <td className="py-1.5 px-2 whitespace-nowrap font-semibold text-slate-700 dark:text-slate-200 text-[11px]">
                      {r.account_name}
                      {r.txn_type && (
                        <div className="text-[9.5px] text-slate-400 dark:text-slate-400 font-medium">{r.txn_type}</div>
                      )}
                    </td>
                    <td className="py-1.5 px-2 max-w-[230px] break-words text-[11px] leading-snug">{r.description}</td>
                    <td className="py-1.5 px-2 w-[115px] max-w-[130px] break-words text-slate-600 dark:text-slate-300 text-[11px] leading-snug" title={r.remarks || ''}>
                      {r.remarks || '—'}
                    </td>
                    <td className="py-1.5 px-2 max-w-[150px] font-semibold text-[#14213D] dark:text-slate-100 text-[11px] leading-snug">
                      <div className="break-words">{r.party_name || '—'}</div>
                      {r.mode && <div className="text-[9.5px] text-[#3646C9] dark:text-indigo-400 font-bold">{r.mode}</div>}
                    </td>
                    <td className="py-1.5 px-2 font-mono text-[10.5px] text-slate-600 dark:text-slate-300 whitespace-nowrap">
                      {r.utr || r.ref_no || '—'}
                    </td>
                    <td className="py-1.5 px-2 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={onGoToGst}
                        className="cursor-pointer text-left"
                        title="Open GST & Filing tab"
                      >
                        {r.gst_reviewed && !r.gst_needs_recheck ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#E6F5EF] dark:bg-emerald-500/15 text-[#087A55] dark:text-emerald-400 border border-[#087A55]/20 dark:border-emerald-500/30 text-[10px] font-bold">
                            <FileCheck2 className="w-2.5 h-2.5" /> {r.gst_treatment}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#FEF4E6] dark:bg-amber-500/15 text-[#8A5300] dark:text-amber-300 border border-[#8A5300]/20 dark:border-amber-500/30 text-[10px] font-bold">
                            <Clock className="w-2.5 h-2.5" /> {r.gst_needs_recheck ? 'Re-check GST' : 'Needs Review'}
                          </span>
                        )}
                      </button>
                    </td>
                    <td className="py-1.5 px-2 text-right font-mono tabular-nums font-bold text-[#B4232F] dark:text-rose-400 whitespace-nowrap text-[11.5px]">
                      {r.debit > 0 ? formatINRBank(r.debit) : '—'}
                    </td>
                    <td className="py-1.5 px-2 text-right font-mono tabular-nums font-bold text-[#087A55] dark:text-emerald-400 whitespace-nowrap text-[11.5px]">
                      {r.credit > 0 ? formatINRBank(r.credit) : '—'}
                    </td>
                    <td className="py-1.5 px-2 text-right font-mono tabular-nums font-bold text-[#14213D] dark:text-slate-100 whitespace-nowrap text-[11.5px]">
                      {r.balance !== null && r.balance !== undefined ? formatINRBank(r.balance) : '—'}
                      {r.balance_gap_flag && (
                        <div className="text-[9.5px] text-[#8A5300] dark:text-amber-300 font-semibold">⚠ Gap</div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            <tfoot className="sticky bottom-0 z-10 bg-[#EEF2F8] dark:bg-slate-800/95 border-t-2 border-[#CBD5E1] dark:border-slate-700 text-xs font-black text-[#14213D] dark:text-slate-100">
              <tr>
                <td colSpan={9} className="py-2 px-2 uppercase tracking-wide">
                  TOTAL ({summary.count} FILTERED TRANSACTIONS)
                </td>
                <td className="py-2 px-2 text-right font-mono tabular-nums text-[#B4232F] dark:text-rose-400 whitespace-nowrap">
                  {formatINRBank(summary.totalDebit)}
                </td>
                <td className="py-2 px-2 text-right font-mono tabular-nums text-[#087A55] dark:text-emerald-400 whitespace-nowrap">
                  {formatINRBank(summary.totalCredit)}
                </td>
                <td className="py-2 px-2 text-right font-mono tabular-nums text-slate-500 dark:text-slate-400 whitespace-nowrap">
                  Net {formatINRBank(summary.net)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        <BankStatementPagination
          page={meta.page}
          totalPages={meta.totalPages}
          totalItems={meta.total}
          pageSize={limit}
          onPageChange={(nextPage) => setPage(nextPage)}
          onPageSizeChange={(nextLimit) => {
            setLimit(nextLimit);
            setPage(1);
          }}
          itemLabel="entries"
        />
      </div>

      {/* Edit Transaction Popup */}
      {editingRow && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-2xs flex items-center justify-center p-4" onClick={() => !editSaving && setEditingRow(null)}>
          <form
            onSubmit={handleSaveEdit}
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-slate-900 rounded-[14px] border border-[#E3E8F0] dark:border-slate-800 w-full max-w-2xl p-4 sm:p-5 space-y-3.5 shadow-xl max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-[#E3E8F0] dark:border-slate-800 pb-2.5">
              <h3 className="text-sm font-black text-[#14213D] dark:text-slate-100">Edit transaction</h3>
              <button type="button" onClick={() => setEditingRow(null)} className="p-1 rounded-lg hover:bg-[#F4F6FA] dark:hover:bg-slate-800">
                <X className="w-4 h-4" />
              </button>
            </div>

            {editingRow.gstReviewed && (
              <div className="p-2.5 rounded-xl bg-[#FEF4E6] dark:bg-amber-500/15 border border-[#8A5300]/30 dark:border-amber-500/30 text-[#8A5300] dark:text-amber-300 text-xs font-semibold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>Changing Txn Date, Debit or Credit removes the GST "reviewed" mark and flags linked invoice allocations for re-check.</span>
              </div>
            )}

            {editError && (
              <div className="p-2.5 rounded-xl bg-[#FDECEC] dark:bg-rose-500/15 border border-[#B4232F]/30 dark:border-rose-500/30 text-[#B4232F] dark:text-rose-400 text-xs font-semibold">
                {editError}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
              <div>
                <label className="block font-bold text-slate-600 dark:text-slate-300 mb-1">Account</label>
                <select
                  value={editingRow.bankAccountId}
                  onChange={(e) => setEditingRow({ ...editingRow, bankAccountId: e.target.value })}
                  className="w-full h-9 px-2.5 rounded-xl border border-[#E3E8F0] dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
                >
                  {accounts.map((a) => <option key={a.id} value={a.id}>{a.account_name}</option>)}
                </select>
              </div>
              <div>
                <label className="block font-bold text-slate-600 dark:text-slate-300 mb-1">Txn Date</label>
                <input
                  type="date"
                  required
                  value={editingRow.txnDate}
                  onChange={(e) => setEditingRow({ ...editingRow, txnDate: e.target.value })}
                  className="w-full h-9 px-2.5 rounded-xl border border-[#E3E8F0] dark:border-slate-800 font-mono dark:bg-slate-950 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-600 dark:text-slate-300 mb-1">Value Date</label>
                <input
                  type="date"
                  value={editingRow.valueDate}
                  onChange={(e) => setEditingRow({ ...editingRow, valueDate: e.target.value })}
                  className="w-full h-9 px-2.5 rounded-xl border border-[#E3E8F0] dark:border-slate-800 font-mono dark:bg-slate-950 dark:text-slate-100"
                />
              </div>
            </div>

            <div className="text-xs">
              <label className="block font-bold text-slate-600 dark:text-slate-300 mb-1">Description</label>
              <textarea
                required
                rows={2}
                value={editingRow.description}
                onChange={(e) => setEditingRow({ ...editingRow, description: e.target.value })}
                className="w-full p-2.5 rounded-xl border border-[#E3E8F0] dark:border-slate-800"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
              <div>
                <label className="block font-bold text-slate-600 dark:text-slate-300 mb-1">Ref No. / Cheque No.</label>
                <input
                  type="text"
                  value={editingRow.refNo}
                  onChange={(e) => setEditingRow({ ...editingRow, refNo: e.target.value })}
                  className="w-full h-9 px-2.5 rounded-xl border border-[#E3E8F0] dark:border-slate-800 font-mono dark:bg-slate-950 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-600 dark:text-slate-300 mb-1">Branch Code</label>
                <input
                  type="text"
                  value={editingRow.branchCode}
                  onChange={(e) => setEditingRow({ ...editingRow, branchCode: e.target.value })}
                  className="w-full h-9 px-2.5 rounded-xl border border-[#E3E8F0] dark:border-slate-800 font-mono dark:bg-slate-950 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-600 dark:text-slate-300 mb-1">Type</label>
                <input
                  type="text"
                  value={editingRow.type}
                  onChange={(e) => setEditingRow({ ...editingRow, type: e.target.value })}
                  className="w-full h-9 px-2.5 rounded-xl border border-[#E3E8F0] dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
              <div>
                <label className="block font-bold text-[#B4232F] dark:text-rose-400 mb-1">Debit</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={editingRow.debit}
                  onChange={(e) => setEditingRow({ ...editingRow, debit: e.target.value })}
                  className="w-full h-9 px-2.5 rounded-xl border border-[#E3E8F0] dark:border-slate-800 text-right font-mono tabular-nums dark:bg-slate-950 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block font-bold text-[#087A55] dark:text-emerald-400 mb-1">Credit</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={editingRow.credit}
                  onChange={(e) => setEditingRow({ ...editingRow, credit: e.target.value })}
                  className="w-full h-9 px-2.5 rounded-xl border border-[#E3E8F0] dark:border-slate-800 text-right font-mono tabular-nums dark:bg-slate-950 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-600 dark:text-slate-300 mb-1">Balance</label>
                <input
                  type="number"
                  step="0.01"
                  value={editingRow.balance}
                  onChange={(e) => setEditingRow({ ...editingRow, balance: e.target.value })}
                  className="w-full h-9 px-2.5 rounded-xl border border-[#E3E8F0] dark:border-slate-800 text-right font-mono tabular-nums dark:bg-slate-950 dark:text-slate-100"
                />
              </div>
            </div>

            <div className="text-xs">
              <label className="block font-bold text-slate-600 dark:text-slate-300 mb-1">Remarks</label>
              <input
                type="text"
                value={editingRow.remarks}
                onChange={(e) => setEditingRow({ ...editingRow, remarks: e.target.value })}
                className="w-full h-9 px-2.5 rounded-xl border border-[#E3E8F0] dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[#E3E8F0] dark:border-slate-800">
              <button
                type="button"
                disabled={editSaving}
                onClick={() => setEditingRow(null)}
                className="px-4 py-1.5 rounded-xl border border-[#E3E8F0] dark:border-slate-800 text-xs font-bold text-[#14213D] dark:text-slate-100"
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
          <div className="bg-white dark:bg-slate-900 rounded-[14px] border border-[#E3E8F0] dark:border-slate-800 w-full max-w-md p-4 space-y-3 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-black text-[#14213D] dark:text-slate-100">Delete this transaction?</h3>
            <p className="text-xs text-slate-600 dark:text-slate-300">
              <span className="font-bold text-[#14213D] dark:text-slate-100">{formatBankDisplayDate(deletingRow.txn_date)}</span> — {deletingRow.description}
            </p>
            <p className="text-xs text-[#8A5300] dark:text-amber-300 font-semibold">
              This performs a soft delete, excludes the entry from totals and GST working papers, and records an entry in the audit log.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                disabled={deleteSaving}
                onClick={() => setDeletingRow(null)}
                className="px-3.5 py-1.5 rounded-xl border border-[#E3E8F0] dark:border-slate-800 text-xs font-bold text-[#14213D] dark:text-slate-100"
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

      {/* Bulk Delete Selected Transactions Confirmation */}
      {showBulkDeleteModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-2xs flex items-center justify-center p-4" onClick={() => !bulkDeleting && setShowBulkDeleteModal(false)}>
          <div className="bg-white dark:bg-slate-900 rounded-[14px] border border-[#E3E8F0] dark:border-slate-800 w-full max-w-md p-4 space-y-3 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-black text-[#14213D] dark:text-slate-100">Delete {selectedIds.size} Selected Transaction(s)?</h3>
            <p className="text-xs text-[#8A5300] dark:text-amber-300 font-semibold">
              These entries will be soft-deleted, excluded from account totals &amp; GST working papers, and can be restored anytime from the Audit &amp; Change Log.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                disabled={bulkDeleting}
                onClick={() => setShowBulkDeleteModal(false)}
                className="px-3.5 py-1.5 rounded-xl border border-[#E3E8F0] dark:border-slate-800 text-xs font-bold text-[#14213D] dark:text-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={bulkDeleting}
                onClick={handleConfirmBulkDelete}
                className="px-3.5 py-1.5 rounded-xl bg-[#B4232F] hover:bg-red-800 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
              >
                {bulkDeleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Delete {selectedIds.size} Row(s)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Full-Screen Attractive Audit & Change Log + Upload Batch Manager Modal */}
      {showAuditModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/65 backdrop-blur-2xs flex items-center justify-center p-2 sm:p-4" onClick={() => setShowAuditModal(false)}>
          <div
            className="bg-[#F4F6FA] dark:bg-slate-800 rounded-[16px] border border-[#CBD5E1] dark:border-slate-700 w-[98vw] max-w-[1620px] h-[93vh] overflow-hidden shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Dark Top Bar (#111A36) */}
            <div className="bg-[#111A36] dark:bg-slate-900 dark:border dark:border-slate-800 text-white px-4 py-3 flex flex-wrap items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center dark:bg-slate-950 dark:text-slate-100">
                  <History className="w-4.5 h-4.5 text-emerald-300" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-black tracking-tight">
                    Bank Statement Audit &amp; Upload Recovery Center
                  </h3>
                  <p className="text-[11px] text-slate-300">
                    Restore accidentally deleted transactions OR remove all rows uploaded from a wrong Excel / paste batch in 1 click
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 bg-white/10 p-1 rounded-xl border border-white/15">
                  <button
                    type="button"
                    onClick={() => setAuditTab('LOGS')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer transition-all ${
                      auditTab === 'LOGS' ? 'bg-[#3646C9] text-white shadow-2xs' : 'text-slate-200 hover:bg-white/10'
                    }`}
                  >
                    <History className="w-3.5 h-3.5" />
                    <span>Change Log ({auditLogs.length})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setAuditTab('BATCHES')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer transition-all ${
                      auditTab === 'BATCHES' ? 'bg-[#3646C9] text-white shadow-2xs' : 'text-slate-200 hover:bg-white/10'
                    }`}
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                    <span>Uploaded Excel Batches ({batches.length})</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setShowAuditModal(false)}
                  className="h-8.5 px-3 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
                >
                  <X className="w-4 h-4" /> Close
                </button>
              </div>
            </div>

            {/* Alerts & Toolbar inside modal */}
            <div className="px-4 py-2.5 bg-white dark:bg-slate-900 border-b border-[#E3E8F0] dark:border-slate-800 space-y-2 shrink-0">
              {auditError && (
                <div className="px-3 py-1.5 rounded-lg bg-[#FDECEC] dark:bg-rose-500/15 border border-[#B4232F]/30 dark:border-rose-500/30 text-[#B4232F] dark:text-rose-400 text-xs font-semibold flex justify-between">
                  <span>{auditError}</span>
                  <button onClick={() => setAuditError('')} className="underline font-bold">Dismiss</button>
                </div>
              )}
              {auditSuccess && (
                <div className="px-3 py-1.5 rounded-lg bg-[#E6F5EF] dark:bg-emerald-500/15 border border-[#087A55]/30 dark:border-emerald-500/30 text-[#087A55] dark:text-emerald-400 text-xs font-semibold flex justify-between">
                  <span>{auditSuccess}</span>
                  <button onClick={() => setAuditSuccess('')} className="underline font-bold">Dismiss</button>
                </div>
              )}

              {auditTab === 'LOGS' && (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={auditActionFilter}
                      onChange={(e) => setAuditActionFilter(e.target.value)}
                      className="h-8 px-2.5 rounded-lg border border-[#E3E8F0] dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-bold text-[#14213D] dark:text-slate-100 dark:bg-slate-950 dark:text-slate-100"
                    >
                      <option value="ALL">All Actions ({auditLogs.length})</option>
                      <option value="BATCH_IMPORT">BATCH_IMPORT (Excel Uploads)</option>
                      <option value="BATCH_UNDO">BATCH_UNDO (Removed Uploads)</option>
                      <option value="BATCH_RESTORE">BATCH_RESTORE (Restored Uploads)</option>
                      <option value="TXN_DELETE">TXN_DELETE (Deleted Rows)</option>
                      <option value="TXN_BULK_DELETE">TXN_BULK_DELETE</option>
                      <option value="TXN_RESTORE">TXN_RESTORE (Restored Rows)</option>
                      <option value="TXN_EDIT">TXN_EDIT (Edits)</option>
                      <option value="ACCOUNT_CREATE">ACCOUNT_CREATE</option>
                      <option value="ACCOUNT_UPDATE">ACCOUNT_UPDATE</option>
                      <option value="ACCOUNT_DELETE">ACCOUNT_DELETE</option>
                    </select>

                    <div className="relative min-w-[260px]">
                      <Search className="w-3.5 h-3.5 text-slate-400 dark:text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={auditSearch}
                        onChange={(e) => setAuditSearch(e.target.value)}
                        placeholder="Search file name, narration, account, user, amount..."
                        className="w-full h-8 pl-8 pr-2.5 rounded-lg border border-[#E3E8F0] dark:border-slate-800 text-xs text-[#14213D] dark:text-slate-100 dark:bg-slate-950 dark:text-slate-100"
                      />
                    </div>
                  </div>
                  <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                    Showing <strong className="text-[#14213D] dark:text-slate-100">{filteredAuditLogs.length}</strong> log entries (IST timezone)
                  </div>
                </div>
              )}

              {auditTab === 'BATCHES' && (
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="font-semibold text-[#14213D] dark:text-slate-100">
                    Every Excel / CSV / Paste upload creates an isolated batch. Click <strong className="text-[#B4232F] dark:text-rose-400">Remove All Rows</strong> on any batch to clear all entries imported from that file.
                  </div>
                </div>
              )}
            </div>

            {/* Table Area */}
            <div className="flex-1 overflow-auto p-3 sm:p-4">
              <div className="bg-white dark:bg-slate-900 rounded-[14px] border border-[#CBD5E1] dark:border-slate-700 overflow-hidden shadow-xs">
                <div className="overflow-x-auto">
                  {loadingAudit ? (
                    <div className="py-16 text-center text-xs text-slate-500 dark:text-slate-400">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-[#3646C9] dark:text-indigo-400" />
                      Loading audit records &amp; upload batches...
                    </div>
                  ) : auditTab === 'BATCHES' ? (
                    <table className="w-full text-left border-collapse min-w-[980px] [&_th]:border-r [&_th]:border-[#CBD5E1] dark:border-slate-700 [&_th:last-child]:border-r-0 [&_td]:border-r [&_td]:border-[#E2E8F0] dark:border-slate-800 [&_td:last-child]:border-r-0">
                      <thead className="sticky top-0 z-10 bg-[#EEF2F8] dark:bg-slate-800/95 border-b-2 border-[#CBD5E1] dark:border-slate-700 text-[10.5px] font-bold uppercase text-[#14213D] dark:text-slate-100">
                        <tr>
                          <th className="py-2.5 px-3">Uploaded At (IST)</th>
                          <th className="py-2.5 px-3">File / Source Name</th>
                          <th className="py-2.5 px-3">Bank Account</th>
                          <th className="py-2.5 px-3">Uploaded By</th>
                          <th className="py-2.5 px-3 text-right">Active Rows</th>
                          <th className="py-2.5 px-3 text-right">Removed Rows</th>
                          <th className="py-2.5 px-3 text-right">Total Debit (Outward)</th>
                          <th className="py-2.5 px-3 text-right">Total Credit (Inward)</th>
                          <th className="py-2.5 px-3 text-center">Status</th>
                          <th className="py-2.5 px-3 text-right">Remove / Restore Upload</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E3E8F0] dark:divide-slate-800 text-xs text-[#14213D] dark:text-slate-100">
                        {batches.length === 0 ? (
                          <tr><td colSpan={10} className="py-12 text-center text-slate-400 dark:text-slate-400">No Excel / paste upload batches recorded yet.</td></tr>
                        ) : (
                          batches.map((b, idx) => (
                            <tr
                              key={b.id}
                              className={`align-middle transition-colors hover:bg-[#E8EEFA]/75 dark:hover:bg-slate-800/90 ${
                                idx % 2 === 0 ? 'bg-white dark:bg-slate-900' : 'bg-[#F3F6FB] dark:bg-slate-800/45'
                              }`}
                            >
                              <td className="py-2 px-3 font-mono text-[11px] whitespace-nowrap text-slate-600 dark:text-slate-300">
                                {new Date(b.uploaded_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
                              </td>
                              <td className="py-2 px-3 font-bold text-[#14213D] dark:text-slate-100">
                                <div className="flex items-center gap-1.5">
                                  <FileSpreadsheet className="w-3.5 h-3.5 text-[#3646C9] dark:text-indigo-400 shrink-0" />
                                  <span>{b.file_name}</span>
                                  <span className="text-[10px] uppercase px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-mono">
                                    {b.file_type}
                                  </span>
                                </div>
                              </td>
                              <td className="py-2 px-3 font-semibold">
                                <div>{b.account_name}</div>
                                {b.account_number && <div className="text-[10px] font-mono text-slate-400 dark:text-slate-400">{b.account_number}</div>}
                              </td>
                              <td className="py-2 px-3 font-semibold text-slate-700 dark:text-slate-200">{b.uploaded_by_name || b.uploaded_by}</td>
                              <td className="py-2 px-3 text-right font-mono font-black text-[#087A55] dark:text-emerald-400 tabular-nums">{b.active_rows}</td>
                              <td className="py-2 px-3 text-right font-mono font-bold text-slate-500 dark:text-slate-400 tabular-nums">{b.deleted_rows}</td>
                              <td className="py-2 px-3 text-right font-mono font-bold text-[#B4232F] dark:text-rose-400 tabular-nums whitespace-nowrap">
                                {formatINRBank(b.total_debit)}
                              </td>
                              <td className="py-2 px-3 text-right font-mono font-bold text-[#087A55] dark:text-emerald-400 tabular-nums whitespace-nowrap">
                                {formatINRBank(b.total_credit)}
                              </td>
                              <td className="py-2 px-3 text-center whitespace-nowrap">
                                {b.active_rows > 0 ? (
                                  <span className="px-2 py-0.5 rounded-full bg-[#E6F5EF] dark:bg-emerald-500/15 text-[#087A55] dark:text-emerald-400 border border-[#087A55]/25 dark:border-emerald-500/30 text-[10.5px] font-bold">
                                    Active ({b.active_rows})
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded-full bg-[#FDECEC] dark:bg-rose-500/15 text-[#B4232F] dark:text-rose-400 border border-[#B4232F]/25 dark:border-rose-500/30 text-[10.5px] font-bold">
                                    Removed
                                  </span>
                                )}
                              </td>
                              <td className="py-2 px-3 text-right whitespace-nowrap">
                                {permissions.delete && b.active_rows > 0 && (
                                  <button
                                    type="button"
                                    disabled={busyAuditId === b.id}
                                    onClick={() => handleUndoBatch(b.id, b.file_name)}
                                    className="px-2.5 py-1 rounded-lg bg-[#B4232F] hover:bg-red-800 disabled:opacity-50 text-white text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer"
                                  >
                                    {busyAuditId === b.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                                    <span>Remove All ({b.active_rows})</span>
                                  </button>
                                )}
                                {permissions.delete && b.active_rows === 0 && b.deleted_rows > 0 && (
                                  <button
                                    type="button"
                                    disabled={busyAuditId === b.id}
                                    onClick={() => handleRestoreBatch(b.id, b.file_name)}
                                    className="px-2.5 py-1 rounded-lg bg-[#3646C9] hover:bg-[#2b39ab] disabled:opacity-50 text-white text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer"
                                  >
                                    {busyAuditId === b.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />}
                                    <span>Restore ({b.deleted_rows})</span>
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  ) : (
                    <table className="w-full text-left border-collapse min-w-[1120px] [&_th]:border-r [&_th]:border-[#CBD5E1] dark:border-slate-700 [&_th:last-child]:border-r-0 [&_td]:border-r [&_td]:border-[#E2E8F0] dark:border-slate-800 [&_td:last-child]:border-r-0">
                      <thead className="sticky top-0 z-10 bg-[#EEF2F8] dark:bg-slate-800/95 border-b-2 border-[#CBD5E1] dark:border-slate-700 text-[10.5px] font-bold uppercase text-[#14213D] dark:text-slate-100">
                        <tr>
                          <th className="py-2.5 px-3 w-40">Date &amp; Time (IST)</th>
                          <th className="py-2.5 px-3 w-36">Action</th>
                          <th className="py-2.5 px-3 w-36">Performed By</th>
                          <th className="py-2.5 px-3 w-52">Target / Account / File</th>
                          <th className="py-2.5 px-3 min-w-[340px]">Structured Details (Before → After)</th>
                          <th className="py-2.5 px-3 w-40 text-right">Recovery / Undo</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E3E8F0] dark:divide-slate-800 text-xs text-[#14213D] dark:text-slate-100">
                        {filteredAuditLogs.length === 0 ? (
                          <tr><td colSpan={6} className="py-12 text-center text-slate-400 dark:text-slate-400">No audit records match this filter.</td></tr>
                        ) : (
                          filteredAuditLogs.map((log, idx) => {
                            const data = log.after_data || log.before_data || {};
                            const isDeleteAction = log.action === 'TXN_DELETE' || log.action === 'BATCH_UNDO' || log.action === 'TXN_BULK_DELETE' || log.action === 'ACCOUNT_DELETE';
                            const isCreateOrRestore = log.action === 'BATCH_IMPORT' || log.action === 'TXN_RESTORE' || log.action === 'BATCH_RESTORE' || log.action === 'ACCOUNT_CREATE';
                            const actionBadgeCls = isDeleteAction
                              ? 'bg-[#FDECEC] dark:bg-rose-500/15 text-[#B4232F] dark:text-rose-400 border-[#B4232F]/25 dark:border-rose-500/30'
                              : isCreateOrRestore
                                ? 'bg-[#E6F5EF] dark:bg-emerald-500/15 text-[#087A55] dark:text-emerald-400 border-[#087A55]/25 dark:border-emerald-500/30'
                                : 'bg-indigo-50 dark:bg-indigo-950/50 text-[#3646C9] dark:text-indigo-400 border-indigo-200 dark:border-indigo-800';

                            const targetLabel = data.fileName
                              ? `${data.fileName}${data.accountName ? ` (${data.accountName})` : ''}`
                              : data.account_name
                                ? `${data.account_name} (${data.account_number || data.account_type || 'Bank'})`
                                : data.txn_date
                                  ? `Txn Date: ${formatBankDisplayDate(data.txn_date)}`
                                  : log.entity_type;

                            const renderKV = (obj, sideLabel, badgeColor) => {
                              if (!obj || typeof obj !== 'object') return null;
                              const moneyKeys = new Set(['debit', 'credit', 'balance', 'totalDebit', 'totalCredit', 'opening_balance', 'taxable_amount', 'total_tax']);
                              const entries = Object.entries(obj).filter(([k, v]) => k !== 'id' && v !== null && v !== undefined && v !== '' && typeof v !== 'object');
                              if (entries.length === 0) return null;
                              return (
                                <div className="flex flex-wrap items-center gap-1.5 py-0.5">
                                  <span className={`text-[10px] font-black uppercase px-1.5 py-0.2 rounded ${badgeColor}`}>
                                    {sideLabel}
                                  </span>
                                  {entries.map(([k, v]) => {
                                    const label = k.replace(/_/g, ' ').replace(/\b\w/g, (ch) => ch.toUpperCase());
                                    const displayVal = moneyKeys.has(k) ? formatINRBank(v) : (k === 'txn_date' ? formatBankDisplayDate(v) : String(v));
                                    const valTone = k === 'debit' || k === 'totalDebit'
                                      ? 'text-[#B4232F] dark:text-rose-400 font-bold'
                                      : k === 'credit' || k === 'totalCredit'
                                        ? 'text-[#087A55] dark:text-emerald-400 font-bold'
                                        : 'text-[#14213D] dark:text-slate-100 font-semibold';
                                    return (
                                      <span key={k} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white dark:bg-slate-900 border border-[#E2E8F0] dark:border-slate-800 text-[11px]">
                                        <span className="text-slate-400 dark:text-slate-400 font-medium">{label}:</span>
                                        <span className={`${valTone} break-all`}>{displayVal}</span>
                                      </span>
                                    );
                                  })}
                                </div>
                              );
                            };

                            return (
                              <tr
                                key={log.id}
                                className={`align-top transition-colors hover:bg-[#E8EEFA]/75 dark:hover:bg-slate-800/90 ${
                                  idx % 2 === 0 ? 'bg-white dark:bg-slate-900' : 'bg-[#F3F6FB] dark:bg-slate-800/45'
                                }`}
                              >
                                <td className="py-2 px-3 font-mono text-[11px] whitespace-nowrap text-slate-600 dark:text-slate-300">
                                  {new Date(log.changed_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
                                </td>
                                <td className="py-2 px-3 whitespace-nowrap">
                                  <span className={`inline-block px-2 py-0.5 rounded-full border text-[10px] font-black ${actionBadgeCls}`}>
                                    {log.action}
                                  </span>
                                </td>
                                <td className="py-2 px-3 font-bold text-[#14213D] dark:text-slate-100 whitespace-nowrap">
                                  {log.changed_by_name || log.changed_by}
                                </td>
                                <td className="py-2 px-3 font-semibold text-[11.5px] text-[#14213D] dark:text-slate-100 break-words">
                                  {targetLabel}
                                </td>
                                <td className="py-2 px-3 space-y-1">
                                  {renderKV(log.before_data, 'Before', 'bg-[#FDECEC] dark:bg-rose-500/15 text-[#B4232F] dark:text-rose-400')}
                                  {renderKV(log.after_data, 'After', 'bg-[#E6F5EF] dark:bg-emerald-500/15 text-[#087A55] dark:text-emerald-400')}
                                  <button
                                    type="button"
                                    onClick={() => setExpandedRawLogId((prev) => (prev === log.id ? null : log.id))}
                                    className="text-[10px] font-bold text-[#3646C9] dark:text-indigo-400 hover:underline cursor-pointer"
                                  >
                                    {expandedRawLogId === log.id ? 'Hide Raw JSON' : 'View Raw JSON'}
                                  </button>
                                  {expandedRawLogId === log.id && (
                                    <pre className="mt-1 p-2 rounded-lg bg-slate-900 text-slate-100 text-[10px] font-mono overflow-x-auto whitespace-pre-wrap">
                                      {JSON.stringify({ before: log.before_data, after: log.after_data }, null, 2)}
                                    </pre>
                                  )}
                                </td>
                                <td className="py-2 px-3 text-right whitespace-nowrap">
                                  {permissions.delete && log.action === 'TXN_DELETE' && log.txn_id && log.txn_is_deleted && (
                                    <button
                                      type="button"
                                      disabled={busyAuditId === log.txn_id}
                                      onClick={() => handleRestoreTxn(log.txn_id)}
                                      className="px-2.5 py-1 rounded-lg bg-[#087A55] hover:bg-emerald-800 disabled:opacity-50 text-white text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer"
                                    >
                                      {busyAuditId === log.txn_id ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />}
                                      <span>Restore Row</span>
                                    </button>
                                  )}
                                  {log.action === 'TXN_DELETE' && !log.txn_is_deleted && (
                                    <span className="text-[10.5px] font-bold text-[#087A55] dark:text-emerald-400">✓ Already Restored</span>
                                  )}
                                  {permissions.delete && log.action === 'BATCH_IMPORT' && log.batch_id && log.batch_active_rows > 0 && (
                                    <button
                                      type="button"
                                      disabled={busyAuditId === log.batch_id}
                                      onClick={() => handleUndoBatch(log.batch_id, data.fileName || 'Excel Batch')}
                                      className="px-2.5 py-1 rounded-lg bg-[#B4232F] hover:bg-red-800 disabled:opacity-50 text-white text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer"
                                    >
                                      {busyAuditId === log.batch_id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                                      <span>Remove Excel ({log.batch_active_rows})</span>
                                    </button>
                                  )}
                                  {permissions.delete && log.action === 'BATCH_UNDO' && log.batch_id && log.batch_deleted_rows > 0 && log.batch_active_rows === 0 && (
                                    <button
                                      type="button"
                                      disabled={busyAuditId === log.batch_id}
                                      onClick={() => handleRestoreBatch(log.batch_id, data.fileName || 'Excel Batch')}
                                      className="px-2.5 py-1 rounded-lg bg-[#3646C9] hover:bg-[#2b39ab] disabled:opacity-50 text-white text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer"
                                    >
                                      {busyAuditId === log.batch_id ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />}
                                      <span>Restore Batch</span>
                                    </button>
                                  )}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
