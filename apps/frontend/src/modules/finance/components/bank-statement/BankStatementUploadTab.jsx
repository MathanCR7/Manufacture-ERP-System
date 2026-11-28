import { useState, useRef, useMemo } from 'react';
import {
  UploadCloud, FileSpreadsheet, ClipboardPaste, Plus, Trash2, CopyCheck,
  AlertTriangle, CheckCircle2, XCircle, HelpCircle, Send, RotateCcw,
  ChevronDown, ChevronRight, Loader2, ShieldAlert, Building2, ArrowLeft
} from 'lucide-react';
import { api } from '@/lib/axios';
import { formatINRBank, formatBankDisplayDate, deriveMonthAndFY } from './bankStatementHelpers';

const PREVIEW_FILTERS = [
  { id: 'ALL', label: 'All rows' },
  { id: 'New', label: 'New' },
  { id: 'Possible', label: 'Possible duplicate' },
  { id: 'Duplicate', label: 'Duplicate' },
  { id: 'Error', label: 'Error' },
  { id: 'BalanceGap', label: 'Balance gap' }
];

export default function BankStatementUploadTab({
  accounts = [],
  selectedAccountId,
  onSelectAccount,
  onOpenAddAccount,
  permissions = {},
  previewState,
  setPreviewState,
  onSaveSuccess,
  onViewTransactions
}) {
  const fileInputRef = useRef(null);
  const [dragActive, setDragActive] = useState(false);
  const [showPasteBox, setShowPasteBox] = useState(false);
  const [pastedText, setPastedText] = useState('');
  const [uploading, setUploading] = useState(false);
  const [rechecking, setRechecking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorBanner, setErrorBanner] = useState('');
  const [successBanner, setSuccessBanner] = useState('');
  const [rowFilter, setRowFilter] = useState('ALL');
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [showConfirmSaveModal, setShowConfirmSaveModal] = useState(false);
  const [showConfirmBulkDelete, setShowConfirmBulkDelete] = useState(false);

  const canUpload = Boolean(permissions.upload);
  const rows = useMemo(() => previewState?.rows || [], [previewState?.rows]);
  const summary = previewState?.summary || null;

  const triggerPreviewFile = async (file) => {
    setErrorBanner('');
    setSuccessBanner('');
    if (!selectedAccountId) {
      setErrorBanner('Please select a Bank Account before uploading.');
      return;
    }
    if (!file) return;

    const ext = file.name.toLowerCase().split('.').pop();
    if (!['xlsx', 'xls', 'csv'].includes(ext)) {
      setErrorBanner('Invalid file type. Please choose a .xlsx, .xls, or .csv file.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setErrorBanner('File exceeds 10 MB maximum size limit.');
      return;
    }

    const formData = new FormData();
    formData.append('bankAccountId', selectedAccountId);
    formData.append('file', file);

    try {
      setUploading(true);
      const res = await api.post('/finance/bank-statement/preview', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (res.data?.success) {
        setPreviewState(res.data.data);
        setSelectedIds(new Set());
        setRowFilter('ALL');
      }
    } catch (err) {
      setErrorBanner(err.response?.data?.error || err.message || 'Failed to parse bank statement file.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const triggerPreviewPaste = async () => {
    setErrorBanner('');
    setSuccessBanner('');
    if (!selectedAccountId) {
      setErrorBanner('Please select a Bank Account before parsing pasted rows.');
      return;
    }
    if (!pastedText.trim()) {
      setErrorBanner('Please paste copied rows from Excel first.');
      return;
    }
    try {
      setUploading(true);
      const res = await api.post('/finance/bank-statement/preview', {
        bankAccountId: selectedAccountId,
        pastedText
      });
      if (res.data?.success) {
        setPreviewState(res.data.data);
        setSelectedIds(new Set());
        setRowFilter('ALL');
        setShowPasteBox(false);
      }
    } catch (err) {
      setErrorBanner(err.response?.data?.error || err.message || 'Failed to parse pasted rows.');
    } finally {
      setUploading(false);
    }
  };

  const runServerRecheck = async (nextRows) => {
    if (!selectedAccountId) return;
    try {
      setRechecking(true);
      const res = await api.post('/finance/bank-statement/recheck', {
        bankAccountId: selectedAccountId,
        rows: nextRows
      });
      if (res.data?.success) {
        setPreviewState((prev) => ({
          ...(prev || { fileName: 'manual-entry', fileType: 'manual' }),
          account: res.data.data.account,
          rows: res.data.data.rows,
          summary: res.data.data.summary
        }));
      }
    } catch (err) {
      setErrorBanner(err.response?.data?.error || 'Re-validation failed.');
    } finally {
      setRechecking(false);
    }
  };

  const handleCellChange = (clientId, field, value, immediateRecheck = false) => {
    const nextRows = rows.map((r) => {
      if (r.clientId !== clientId) return r;
      const updated = { ...r, [field]: value };
      if (field === 'txnDate') {
        const d = deriveMonthAndFY(value);
        updated.month = d.month;
        updated.year = d.finYear;
      }
      if (field === 'debit') updated.debitRaw = value;
      if (field === 'credit') updated.creditRaw = value;
      if (field === 'balance') updated.balanceRaw = value;
      return updated;
    });

    setPreviewState((prev) => ({ ...prev, rows: nextRows }));
    if (immediateRecheck) {
      runServerRecheck(nextRows);
    }
  };

  const handleAddBlankRow = () => {
    const todayIso = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    const d = deriveMonthAndFY(todayIso);
    const blankRow = {
      clientId: `manual-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      txnDate: todayIso,
      valueDate: todayIso,
      description: '',
      refNo: '',
      branchCode: '',
      debit: '',
      debitRaw: '',
      credit: '',
      creditRaw: '',
      balance: '',
      balanceRaw: '',
      remarks: '',
      month: d.month,
      year: d.finYear,
      type: '',
      keepPossible: false
    };
    const nextRows = [...rows, blankRow];
    runServerRecheck(nextRows);
  };

  const handleDeleteRow = (clientId) => {
    const nextRows = rows.filter((r) => r.clientId !== clientId);
    const nextSel = new Set(selectedIds);
    nextSel.delete(clientId);
    setSelectedIds(nextSel);
    if (nextRows.length === 0) {
      setPreviewState(null);
    } else {
      runServerRecheck(nextRows);
    }
  };

  const handleBulkDeleteConfirmed = () => {
    const nextRows = rows.filter((r) => !selectedIds.has(r.clientId));
    setSelectedIds(new Set());
    setShowConfirmBulkDelete(false);
    if (nextRows.length === 0) {
      setPreviewState(null);
    } else {
      runServerRecheck(nextRows);
    }
  };

  const handleRemoveDuplicates = () => {
    const nextRows = rows.filter((r) => r.status !== 'Duplicate');
    if (nextRows.length === 0) {
      setPreviewState(null);
    } else {
      runServerRecheck(nextRows);
    }
  };

  const handleDiscardPreview = () => {
    setPreviewState(null);
    setSelectedIds(new Set());
    setErrorBanner('');
    setSuccessBanner('');
  };

  const handleConfirmSave = async () => {
    if (!previewState || saving) return;
    try {
      setSaving(true);
      setErrorBanner('');
      const res = await api.post('/finance/bank-statement/commit', {
        bankAccountId: selectedAccountId,
        fileName: previewState.fileName || 'bank-statement',
        fileType: previewState.fileType || 'xlsx',
        rows: previewState.rows
      });
      if (res.data?.success) {
        const { savedCount, duplicateCount, unsavedRows } = res.data.data;
        setShowConfirmSaveModal(false);
        setSuccessBanner(
          `Saved ${savedCount} transaction(s) to database.${duplicateCount > 0 ? ` (${duplicateCount} duplicate row(s) blocked).` : ''}`
        );

        if (unsavedRows && unsavedRows.length > 0) {
          runServerRecheck(unsavedRows);
        } else {
          setPreviewState(null);
        }
        onSaveSuccess?.();
      }
    } catch (err) {
      setShowConfirmSaveModal(false);
      setErrorBanner(err.response?.data?.error || 'Failed to save transactions. No changes were written.');
    } finally {
      setSaving(false);
    }
  };

  const filteredRows = useMemo(() => {
    if (rowFilter === 'ALL') return rows;
    if (rowFilter === 'BalanceGap') return rows.filter((r) => r.balanceGap);
    return rows.filter((r) => r.status === rowFilter);
  }, [rows, rowFilter]);

  const toggleSelectAll = (checked) => {
    if (!checked) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredRows.map((r) => r.clientId)));
    }
  };

  const toggleSelectOne = (id) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const renderStatusBadge = (row) => {
    if (row.status === 'New') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-[#E6F5EF] text-[#087A55] border border-[#087A55]/25 whitespace-nowrap">
          <CheckCircle2 className="w-3 h-3 shrink-0" />
          <span>New</span>
          {row.balanceGap && (
            <AlertTriangle
              className="w-3 h-3 text-[#8A5300] ml-0.5"
              title={`Balance gap: expected ${formatINRBank(row.expectedBalance)}, diff ${formatINRBank(row.balanceGapDiff)}`}
            />
          )}
        </span>
      );
    }
    if (row.status === 'Duplicate') {
      return (
        <span
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-[#FDECEC] text-[#B4232F] border border-[#B4232F]/25 whitespace-nowrap"
          title={row.statusReason}
        >
          <XCircle className="w-3 h-3 shrink-0" />
          <span>Duplicate</span>
        </span>
      );
    }
    if (row.status === 'Possible') {
      return (
        <div className="flex flex-col gap-1">
          <span
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-[#FEF4E6] text-[#8A5300] border border-[#8A5300]/25 whitespace-nowrap"
            title={row.statusReason}
          >
            <HelpCircle className="w-3 h-3 shrink-0" />
            <span>Possible</span>
          </span>
          <label className="inline-flex items-center gap-1 text-[10px] font-bold text-[#14213D] cursor-pointer select-none">
            <input
              type="checkbox"
              checked={Boolean(row.keepPossible)}
              onChange={(e) => handleCellChange(row.clientId, 'keepPossible', e.target.checked, true)}
              className="rounded border-slate-300 text-[#3646C9] focus:ring-[#3646C9]"
            />
            <span>Keep</span>
          </label>
        </div>
      );
    }
    return (
      <span
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-[#FDECEC] text-[#B4232F] border border-[#B4232F]/25 whitespace-nowrap"
        title={row.statusReason}
      >
        <AlertTriangle className="w-3 h-3 shrink-0" />
        <span>Error</span>
      </span>
    );
  };

  return (
    <div className="space-y-3">
      {errorBanner && (
        <div role="alert" className="px-3 py-2 rounded-xl bg-[#FDECEC] border border-[#B4232F]/30 text-[#B4232F] flex items-center justify-between gap-2 text-xs font-semibold">
          <span className="flex items-center gap-1.5"><XCircle className="w-4 h-4 shrink-0" /> {errorBanner}</span>
          <button onClick={() => setErrorBanner('')} className="underline font-bold">Dismiss</button>
        </div>
      )}

      {successBanner && (
        <div role="status" className="px-3 py-2 rounded-xl bg-[#E6F5EF] border border-[#087A55]/30 text-[#087A55] flex flex-wrap items-center justify-between gap-2 text-xs font-semibold">
          <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 shrink-0" /> {successBanner}</span>
          <div className="flex items-center gap-3">
            {onViewTransactions && (
              <button onClick={onViewTransactions} className="px-2.5 py-1 rounded-lg bg-[#087A55] text-white font-bold inline-flex items-center gap-1 cursor-pointer">
                <ArrowLeft className="w-3 h-3" /> View Transactions
              </button>
            )}
            <button onClick={() => setSuccessBanner('')} className="underline font-bold">Dismiss</button>
          </div>
        </div>
      )}

      {!canUpload && (
        <div className="px-3 py-2 rounded-xl bg-[#FEF4E6] border border-[#8A5300]/30 text-[#8A5300] flex items-center gap-2 text-xs font-semibold">
          <ShieldAlert className="w-4 h-4 shrink-0" />
          <span>Read-only access: your role can view transactions and GST working papers, but cannot upload statements.</span>
        </div>
      )}

      {/* Compact Upload & Paste Card */}
      <div className="bg-white rounded-[14px] border border-[#E3E8F0] p-3.5 space-y-3 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-2 flex-1 max-w-lg">
            <div className="relative flex-1">
              <Building2 className="w-4 h-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <select
                id="bs-account-select"
                aria-label="Bank account"
                value={selectedAccountId}
                onChange={(e) => {
                  onSelectAccount(e.target.value);
                  if (previewState?.rows?.length > 0) {
                    runServerRecheck(previewState.rows);
                  }
                }}
                className="w-full h-9 pl-8 pr-2.5 rounded-xl border border-[#E3E8F0] bg-white text-[#14213D] text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#3646C9]/30"
              >
                <option value="">Select bank account *</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.account_name} {a.account_number ? `(${a.account_number})` : ''} — Bal: {formatINRBank(a.latest_balance)}
                  </option>
                ))}
              </select>
            </div>
            {canUpload && (
              <button
                type="button"
                onClick={onOpenAddAccount}
                className="h-9 px-3 rounded-xl border border-[#E3E8F0] hover:bg-[#F4F6FA] text-[#14213D] text-xs font-bold inline-flex items-center gap-1 shrink-0 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 text-[#3646C9]" />
                <span>Add Account</span>
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => setShowPasteBox((v) => !v)}
            className="text-xs font-bold text-[#3646C9] hover:underline inline-flex items-center gap-1 cursor-pointer"
          >
            {showPasteBox ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            <ClipboardPaste className="w-3.5 h-3.5" />
            <span>Or paste rows copied from Excel</span>
          </button>
        </div>

        {/* Compact Horizontal Dropzone */}
        <div
          onDragOver={(e) => { e.preventDefault(); if (canUpload) setDragActive(true); }}
          onDragLeave={() => setDragActive(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragActive(false);
            if (!canUpload) return;
            const file = e.dataTransfer?.files?.[0];
            if (file) triggerPreviewFile(file);
          }}
          className={`rounded-xl border-2 border-dashed px-4 py-4 flex flex-col sm:flex-row items-center justify-between gap-3 transition-colors ${
            dragActive
              ? 'border-[#3646C9] bg-indigo-50/40'
              : 'border-[#CBD5E1] bg-[#F4F6FA]/60 hover:border-[#3646C9]/60'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            disabled={!canUpload || uploading}
            onChange={(e) => triggerPreviewFile(e.target.files?.[0])}
            className="hidden"
          />
          <div className="flex items-center gap-3 text-left">
            <div className="w-10 h-10 rounded-xl bg-white border border-[#E3E8F0] flex items-center justify-center shrink-0 text-[#3646C9] shadow-2xs">
              {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <UploadCloud className="w-5 h-5" />}
            </div>
            <div>
              <p className="text-xs sm:text-sm font-bold text-[#14213D]">
                Drag and drop bank statement file here
                {previewState?.fileName && <span className="ml-2 text-[#3646C9] font-semibold">({previewState.fileName})</span>}
              </p>
              <p className="text-[11px] text-slate-500">
                Supports <strong className="text-[#14213D]">.xlsx</strong>, <strong className="text-[#14213D]">.xls</strong>, <strong className="text-[#14213D]">.csv</strong> (max 10 MB) • Auto-detects header row &amp; duplicates
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={!canUpload || uploading}
            onClick={() => fileInputRef.current?.click()}
            className="w-full sm:w-auto px-4 py-2 rounded-xl bg-[#3646C9] hover:bg-[#2b39ab] disabled:opacity-50 text-white text-xs font-bold inline-flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer shrink-0"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>{uploading ? 'Reading...' : 'Choose File'}</span>
          </button>
        </div>

        {/* Collapsible Paste from Excel */}
        {showPasteBox && (
          <div className="pt-2 border-t border-[#E3E8F0] space-y-2">
            <textarea
              value={pastedText}
              onChange={(e) => setPastedText(e.target.value)}
              rows={4}
              disabled={!canUpload}
              placeholder="Paste copied rows from Excel (Txn Date | Value Date | Description | Ref No. | Branch | Debit | Credit | Balance | Remarks | Month | Year | Type)"
              className="w-full p-2.5 rounded-xl border border-[#E3E8F0] bg-[#F4F6FA] text-xs font-mono text-[#14213D] focus:outline-none focus:ring-2 focus:ring-[#3646C9]/30"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => { setPastedText(''); setShowPasteBox(false); }}
                className="px-3 py-1 rounded-lg border border-[#E3E8F0] text-xs font-bold text-[#14213D]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!canUpload || uploading}
                onClick={triggerPreviewPaste}
                className="px-3.5 py-1 rounded-lg bg-[#3646C9] hover:bg-[#2b39ab] disabled:opacity-50 text-white text-xs font-bold cursor-pointer"
              >
                {uploading ? 'Parsing...' : 'Parse Pasted Rows'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Preview KPI Strip + Editable Table */}
      {summary && (
        <div className="space-y-2.5">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
            <div className="bg-white rounded-[14px] border border-[#E3E8F0] px-3 py-2">
              <div className="text-[10px] font-bold uppercase text-slate-500">Rows</div>
              <div className="text-lg font-black text-[#14213D] tabular-nums">{summary.totalRows}</div>
            </div>
            <div className="bg-white rounded-[14px] border border-[#E3E8F0] px-3 py-2">
              <div className="text-[10px] font-bold uppercase text-[#087A55]">Ready to Save</div>
              <div className="text-lg font-black text-[#087A55] tabular-nums">{summary.willSaveCount}</div>
            </div>
            <div className="bg-white rounded-[14px] border border-[#E3E8F0] px-3 py-2">
              <div className="text-[10px] font-bold uppercase text-[#B4232F]">Duplicates</div>
              <div className="text-lg font-black text-[#B4232F] tabular-nums">{summary.duplicateCount}</div>
            </div>
            <div className="bg-white rounded-[14px] border border-[#E3E8F0] px-3 py-2">
              <div className="text-[10px] font-bold uppercase text-[#8A5300]">Possible / Error</div>
              <div className="text-lg font-black text-[#14213D] tabular-nums">
                <span className="text-[#8A5300]">{summary.possibleCount}</span>
                <span className="text-slate-400 mx-1">/</span>
                <span className="text-[#B4232F]">{summary.errorCount}</span>
              </div>
            </div>
            <div className="bg-white rounded-[14px] border border-[#E3E8F0] px-3 py-2">
              <div className="text-[10px] font-bold uppercase text-[#8A5300]">Balance Gaps</div>
              <div className="text-lg font-black text-[#8A5300] tabular-nums">{summary.balanceGapCount}</div>
            </div>
            <div className="bg-white rounded-[14px] border border-[#E3E8F0] px-3 py-2">
              <div className="text-[10px] font-bold uppercase text-slate-500">Save Dr / Cr</div>
              <div className="text-[11px] font-black tabular-nums leading-tight mt-0.5">
                <div className="text-[#B4232F]">Dr: {formatINRBank(summary.totalDebit)}</div>
                <div className="text-[#087A55]">Cr: {formatINRBank(summary.totalCredit)}</div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-[14px] border border-[#E3E8F0] p-2.5 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <select
                value={rowFilter}
                onChange={(e) => setRowFilter(e.target.value)}
                aria-label="Filter preview rows"
                className="h-8 px-2.5 rounded-lg border border-[#E3E8F0] bg-[#F4F6FA] text-xs font-bold text-[#14213D]"
              >
                {PREVIEW_FILTERS.map((f) => (
                  <option key={f.id} value={f.id}>{f.label}</option>
                ))}
              </select>

              <button
                type="button"
                onClick={handleAddBlankRow}
                disabled={!canUpload || rechecking}
                className="h-8 px-2.5 rounded-lg border border-[#E3E8F0] hover:bg-[#F4F6FA] text-xs font-bold text-[#14213D] inline-flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 text-[#3646C9]" />
                <span>Add row</span>
              </button>

              {selectedIds.size > 0 && (
                <button
                  type="button"
                  onClick={() => setShowConfirmBulkDelete(true)}
                  className="h-8 px-2.5 rounded-lg bg-[#FDECEC] border border-[#B4232F]/30 text-[#B4232F] text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete ({selectedIds.size})</span>
                </button>
              )}

              {summary.duplicateCount > 0 && (
                <button
                  type="button"
                  onClick={handleRemoveDuplicates}
                  className="h-8 px-2.5 rounded-lg border border-[#E3E8F0] hover:bg-[#F4F6FA] text-xs font-bold text-[#14213D] inline-flex items-center gap-1 cursor-pointer"
                >
                  <CopyCheck className="w-3.5 h-3.5 text-[#B4232F]" />
                  <span>Remove duplicates</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => runServerRecheck(rows)}
                disabled={rechecking}
                className="h-8 px-2.5 rounded-lg border border-[#E3E8F0] hover:bg-[#F4F6FA] text-xs font-bold text-[#14213D] inline-flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className={`w-3.5 h-3.5 ${rechecking ? 'animate-spin' : ''}`} />
                <span>Re-check</span>
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={handleDiscardPreview}
                disabled={saving}
                className="h-8 px-3 rounded-lg border border-[#E3E8F0] hover:bg-[#F4F6FA] text-xs font-bold text-[#14213D] cursor-pointer"
              >
                Discard
              </button>
              <button
                type="button"
                disabled={!canUpload || saving || summary.willSaveCount === 0}
                onClick={() => setShowConfirmSaveModal(true)}
                className="h-8 px-3.5 rounded-lg bg-[#3646C9] hover:bg-[#2b39ab] disabled:opacity-50 text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-2xs cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{saving ? 'Saving...' : `Update & push ${summary.willSaveCount} to table`}</span>
              </button>
            </div>
          </div>

          <div className="bg-white rounded-[14px] border border-[#CBD5E1] overflow-hidden shadow-xs">
            <div className="overflow-x-auto max-h-[58vh]">
              <table className="w-full text-left border-collapse min-w-[1380px] [&_th]:border-r [&_th]:border-[#CBD5E1] [&_th:last-child]:border-r-0 [&_td]:border-r [&_td]:border-[#E2E8F0] [&_td:last-child]:border-r-0">
                <thead className="sticky top-0 z-10 bg-[#EEF2F8] border-b-2 border-[#CBD5E1] text-[10.5px] font-bold uppercase text-[#14213D]">
                  <tr>
                    <th className="p-2 w-8 text-center">
                      <input
                        type="checkbox"
                        checked={filteredRows.length > 0 && selectedIds.size === filteredRows.length}
                        onChange={(e) => toggleSelectAll(e.target.checked)}
                        aria-label="Select all filtered preview rows"
                      />
                    </th>
                    <th className="p-2 min-w-[120px]">Status</th>
                    <th className="p-2 min-w-[115px]">Txn Date</th>
                    <th className="p-2 min-w-[115px]">Value Date</th>
                    <th className="p-2 min-w-[250px]">Description</th>
                    <th className="p-2 min-w-[140px]">Ref No./Cheque</th>
                    <th className="p-2 min-w-[85px]">Branch</th>
                    <th className="p-2 min-w-[110px] text-right">Debit</th>
                    <th className="p-2 min-w-[110px] text-right">Credit</th>
                    <th className="p-2 min-w-[120px] text-right">Balance</th>
                    <th className="p-2 min-w-[150px]">Remarks</th>
                    <th className="p-2 min-w-[90px]">Month</th>
                    <th className="p-2 min-w-[75px]">Year</th>
                    <th className="p-2 min-w-[95px]">Type</th>
                    <th className="p-2 w-9 text-center">Del</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E3E8F0] text-xs text-[#14213D]">
                  {filteredRows.length === 0 ? (
                    <tr>
                      <td colSpan={15} className="py-10 text-center text-slate-400 font-medium">
                        No preview rows match this filter.
                      </td>
                    </tr>
                  ) : (
                    filteredRows.map((row, idx) => (
                      <tr
                        key={row.clientId}
                        className={`align-top transition-colors ${
                          row.status === 'Error' || row.status === 'Duplicate'
                            ? 'bg-rose-50/60 hover:bg-rose-50'
                            : row.balanceGap || row.status === 'Possible'
                              ? 'bg-amber-50/60 hover:bg-amber-50'
                              : idx % 2 === 0
                                ? 'bg-white hover:bg-[#E8EEFA]/70'
                                : 'bg-[#F3F6FB] hover:bg-[#E8EEFA]/70'
                        }`}
                      >
                        <td className="p-1.5 text-center">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(row.clientId)}
                            onChange={() => toggleSelectOne(row.clientId)}
                            aria-label={`Select row ${row.txnDateDisplay}`}
                          />
                        </td>
                        <td className="p-1.5 space-y-1">
                          {renderStatusBadge(row)}
                          {row.errors && row.errors.length > 0 && (
                            <div className="text-[10px] font-semibold text-[#B4232F] leading-tight">
                              {row.errors.join(' • ')}
                            </div>
                          )}
                          {row.balanceGap && (
                            <div className="text-[10px] font-semibold text-[#8A5300] leading-tight">
                              Gap: Exp {formatINRBank(row.expectedBalance)} (Diff {formatINRBank(row.balanceGapDiff)})
                            </div>
                          )}
                        </td>
                        <td className="p-1.5">
                          <input
                            type="text"
                            value={row.txnDate || ''}
                            onChange={(e) => handleCellChange(row.clientId, 'txnDate', e.target.value)}
                            onBlur={() => runServerRecheck(rows)}
                            className="w-full px-1.5 py-1 rounded border border-[#E3E8F0] bg-white text-xs font-mono"
                          />
                          <div className="text-[10px] text-slate-400 px-0.5">{formatBankDisplayDate(row.txnDate)}</div>
                        </td>
                        <td className="p-1.5">
                          <input
                            type="text"
                            value={row.valueDate || ''}
                            onChange={(e) => handleCellChange(row.clientId, 'valueDate', e.target.value)}
                            onBlur={() => runServerRecheck(rows)}
                            className="w-full px-1.5 py-1 rounded border border-[#E3E8F0] bg-white text-xs font-mono"
                          />
                        </td>
                        <td className="p-1.5">
                          <textarea
                            rows={2}
                            value={row.description || ''}
                            onChange={(e) => handleCellChange(row.clientId, 'description', e.target.value)}
                            onBlur={() => runServerRecheck(rows)}
                            className="w-full px-1.5 py-1 rounded border border-[#E3E8F0] bg-white text-xs resize-y"
                          />
                          {row.partyName && (
                            <div className="text-[10px] font-semibold text-[#3646C9]">Party: {row.partyName}</div>
                          )}
                        </td>
                        <td className="p-1.5">
                          <input
                            type="text"
                            value={row.refNo || ''}
                            onChange={(e) => handleCellChange(row.clientId, 'refNo', e.target.value)}
                            onBlur={() => runServerRecheck(rows)}
                            className="w-full px-1.5 py-1 rounded border border-[#E3E8F0] bg-white text-xs font-mono"
                          />
                        </td>
                        <td className="p-1.5">
                          <input
                            type="text"
                            value={row.branchCode || ''}
                            onChange={(e) => handleCellChange(row.clientId, 'branchCode', e.target.value)}
                            onBlur={() => runServerRecheck(rows)}
                            className="w-full px-1.5 py-1 rounded border border-[#E3E8F0] bg-white text-xs font-mono"
                          />
                        </td>
                        <td className="p-1.5">
                          <input
                            type="text"
                            value={row.debitRaw ?? (row.debit || '')}
                            onChange={(e) => handleCellChange(row.clientId, 'debit', e.target.value)}
                            onBlur={() => runServerRecheck(rows)}
                            className="w-full px-1.5 py-1 rounded border border-[#E3E8F0] bg-white text-xs text-right font-mono tabular-nums text-[#B4232F] font-semibold"
                          />
                        </td>
                        <td className="p-1.5">
                          <input
                            type="text"
                            value={row.creditRaw ?? (row.credit || '')}
                            onChange={(e) => handleCellChange(row.clientId, 'credit', e.target.value)}
                            onBlur={() => runServerRecheck(rows)}
                            className="w-full px-1.5 py-1 rounded border border-[#E3E8F0] bg-white text-xs text-right font-mono tabular-nums text-[#087A55] font-semibold"
                          />
                        </td>
                        <td className="p-1.5">
                          <input
                            type="text"
                            value={row.balanceRaw ?? (row.balance !== null && row.balance !== undefined ? row.balance : '')}
                            onChange={(e) => handleCellChange(row.clientId, 'balance', e.target.value)}
                            onBlur={() => runServerRecheck(rows)}
                            className={`w-full px-1.5 py-1 rounded border bg-white text-xs text-right font-mono tabular-nums font-semibold ${
                              row.balanceGap ? 'border-[#8A5300] text-[#8A5300]' : 'border-[#E3E8F0]'
                            }`}
                          />
                        </td>
                        <td className="p-1.5">
                          <input
                            type="text"
                            value={row.remarks || ''}
                            onChange={(e) => handleCellChange(row.clientId, 'remarks', e.target.value)}
                            onBlur={() => runServerRecheck(rows)}
                            className="w-full px-1.5 py-1 rounded border border-[#E3E8F0] bg-white text-xs"
                          />
                        </td>
                        <td className="p-1.5">
                          <input
                            type="text"
                            value={row.month || ''}
                            onChange={(e) => handleCellChange(row.clientId, 'month', e.target.value)}
                            className="w-full px-1.5 py-1 rounded border border-[#E3E8F0] bg-white text-xs"
                          />
                        </td>
                        <td className="p-1.5">
                          <input
                            type="text"
                            value={row.year || ''}
                            onChange={(e) => handleCellChange(row.clientId, 'year', e.target.value)}
                            className="w-full px-1.5 py-1 rounded border border-[#E3E8F0] bg-white text-xs font-mono"
                          />
                        </td>
                        <td className="p-1.5">
                          <input
                            type="text"
                            value={row.type || ''}
                            onChange={(e) => handleCellChange(row.clientId, 'type', e.target.value)}
                            className="w-full px-1.5 py-1 rounded border border-[#E3E8F0] bg-white text-xs"
                          />
                        </td>
                        <td className="p-1.5 text-center">
                          <button
                            type="button"
                            onClick={() => handleDeleteRow(row.clientId)}
                            title="Delete preview row"
                            className="p-1 rounded text-[#B4232F] hover:bg-[#FDECEC] cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
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

      {/* Confirm Save Popup */}
      {showConfirmSaveModal && summary && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-2xs flex items-center justify-center p-4" onClick={() => !saving && setShowConfirmSaveModal(false)}>
          <div className="bg-white rounded-[14px] border border-[#E3E8F0] w-full max-w-md p-4 space-y-3.5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-black text-[#14213D]">
              Save {summary.willSaveCount} transaction{summary.willSaveCount === 1 ? '' : 's'}?
            </h3>
            <div className="rounded-xl bg-[#F4F6FA] border border-[#E3E8F0] p-3 space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-600 font-semibold">Total debit</span>
                <span className="font-black text-[#B4232F] tabular-nums">{formatINRBank(summary.totalDebit)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600 font-semibold">Total credit</span>
                <span className="font-black text-[#087A55] tabular-nums">{formatINRBank(summary.totalCredit)}</span>
              </div>
              <div className="flex justify-between border-t border-[#E3E8F0] pt-1.5">
                <span className="text-slate-600 font-semibold">Not saved</span>
                <span className="font-bold text-[#14213D] tabular-nums">{summary.notSavedCount} rows</span>
              </div>
            </div>
            {summary.balanceGapCount > 0 && (
              <div className="p-2 rounded-xl bg-[#FEF4E6] border border-[#8A5300]/30 text-[#8A5300] text-xs font-semibold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{summary.balanceGapCount} balance gap warning(s) detected. Saving is still permitted.</span>
              </div>
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                disabled={saving}
                onClick={() => setShowConfirmSaveModal(false)}
                className="px-3.5 py-1.5 rounded-xl border border-[#E3E8F0] text-xs font-bold text-[#14213D]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={handleConfirmSave}
                className="px-4 py-1.5 rounded-xl bg-[#3646C9] hover:bg-[#2b39ab] disabled:opacity-50 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
              >
                {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>{saving ? 'Saving...' : 'Confirm Save'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Bulk Delete Popup */}
      {showConfirmBulkDelete && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-2xs flex items-center justify-center p-4" onClick={() => setShowConfirmBulkDelete(false)}>
          <div className="bg-white rounded-[14px] border border-[#E3E8F0] w-full max-w-sm p-4 space-y-3 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-black text-[#14213D]">Delete {selectedIds.size} selected preview row(s)?</h3>
            <p className="text-xs text-slate-600">This removes the selected rows from your upload preview only.</p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowConfirmBulkDelete(false)}
                className="px-3.5 py-1.5 rounded-xl border border-[#E3E8F0] text-xs font-bold text-[#14213D]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleBulkDeleteConfirmed}
                className="px-3.5 py-1.5 rounded-xl bg-[#B4232F] hover:bg-red-800 text-white text-xs font-bold cursor-pointer"
              >
                Delete Selected
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
