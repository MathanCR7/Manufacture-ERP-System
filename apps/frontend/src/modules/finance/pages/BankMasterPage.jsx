import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Landmark, Plus, Pencil, Trash2, ArrowUp, ArrowDown, ArrowRightLeft,
  Search, CheckCircle2, XCircle, Loader2, X, Star, ExternalLink, Wallet, Building2
} from 'lucide-react';
import { api } from '@/lib/axios';
import { formatINRBank } from '../components/bank-statement/bankStatementHelpers';

const ACCOUNT_TYPES = [
  { id: 'BANK', label: 'Bank Account' },
  { id: 'CASH', label: 'Cash Register' },
  { id: 'UPI', label: 'UPI Merchant' },
  { id: 'OD', label: 'OD / CC Account' }
];

const EMPTY_FORM = {
  accountName: '',
  bankName: '',
  accountNumber: '',
  ifscCode: '',
  branchName: '',
  accountType: 'BANK',
  openingBalance: '0',
  isDefault: false,
  isActive: true,
  notes: ''
};

export default function BankMasterPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [accounts, setAccounts] = useState([]);
  const [permissions, setPermissions] = useState({ view: true, upload: false, edit: false, delete: false });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ACTIVE');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Add / Edit Modal (auto-opens if redirected with ?add=1)
  const [formModal, setFormModal] = useState(() =>
    searchParams.get('add') === '1' ? { mode: 'create', data: { ...EMPTY_FORM } } : null
  );
  const [savingForm, setSavingForm] = useState(false);
  const [formError, setFormError] = useState('');

  // Move Transactions Modal
  const [moveModal, setMoveModal] = useState(null); // { sourceAccount, targetAccountId }
  const [movingTxns, setMovingTxns] = useState(false);
  const [moveError, setMoveError] = useState('');

  // Delete Modal
  const [deleteModal, setDeleteModal] = useState(null); // { account, moveToAccountId }
  const [deletingAcct, setDeletingAcct] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [permRes, acctRes] = await Promise.all([
        api.get('/finance/bank-statement/permissions'),
        api.get('/finance/bank-statement/accounts?includeInactive=true')
      ]);
      if (permRes.data?.success) setPermissions(permRes.data.data.permissions || {});
      if (acctRes.data?.success) setAccounts(acctRes.data.data || []);
    } catch (err) {
      setErrorMsg(err.response?.data?.error || 'Failed to load bank master records.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      loadData();
    }, 0);
    return () => clearTimeout(t);
  }, [loadData]);

  const filteredAccounts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return accounts.filter((a) => {
      if (statusFilter === 'ACTIVE' && !a.is_active) return false;
      if (statusFilter === 'INACTIVE' && a.is_active) return false;
      if (typeFilter !== 'ALL' && a.account_type !== typeFilter) return false;
      if (q) {
        const hay = `${a.account_name} ${a.bank_name || ''} ${a.account_number || ''} ${a.ifsc_code || ''} ${a.branch_name || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [accounts, search, typeFilter, statusFilter]);

  const stats = useMemo(() => {
    const active = accounts.filter((a) => a.is_active);
    const totalBalance = active.reduce((s, a) => s + Number(a.latest_balance || 0), 0);
    const bankCount = active.filter((a) => a.account_type === 'BANK' || a.account_type === 'OD').length;
    const cashUpiCount = active.filter((a) => a.account_type === 'CASH' || a.account_type === 'UPI').length;
    const totalTxns = active.reduce((s, a) => s + Number(a.txn_count || 0), 0);
    return {
      totalCount: accounts.length,
      activeCount: active.length,
      bankCount,
      cashUpiCount,
      totalBalance,
      totalTxns
    };
  }, [accounts]);

  const openCreateModal = () => {
    setFormError('');
    setFormModal({ mode: 'create', data: { ...EMPTY_FORM } });
  };

  const openEditModal = (acct) => {
    setFormError('');
    setFormModal({
      mode: 'edit',
      id: acct.id,
      data: {
        accountName: acct.account_name || '',
        bankName: acct.bank_name || '',
        accountNumber: acct.account_number || '',
        ifscCode: acct.ifsc_code || '',
        branchName: acct.branch_name || '',
        accountType: acct.account_type || 'BANK',
        openingBalance: String(acct.opening_balance ?? 0),
        isDefault: Boolean(acct.is_default),
        isActive: Boolean(acct.is_active),
        notes: acct.notes || ''
      }
    });
  };

  const handleSaveForm = async (e) => {
    e.preventDefault();
    if (!formModal || savingForm) return;
    if (!formModal.data.accountName.trim()) {
      setFormError('Account name is required.');
      return;
    }

    try {
      setSavingForm(true);
      setFormError('');
      if (formModal.mode === 'create') {
        const res = await api.post('/finance/bank-statement/accounts', formModal.data);
        if (res.data?.success) {
          setFormModal(null);
          setSuccessMsg(`Created bank account "${res.data.data.account_name}".`);
          await loadData();
        }
      } else {
        const res = await api.put(`/finance/bank-statement/accounts/${formModal.id}`, formModal.data);
        if (res.data?.success) {
          setFormModal(null);
          setSuccessMsg(`Updated bank account "${res.data.data.account_name}".`);
          await loadData();
        }
      }
    } catch (err) {
      setFormError(err.response?.data?.error || 'Failed to save bank account.');
    } finally {
      setSavingForm(false);
    }
  };

  const handleToggleQuickField = async (acct, field, val) => {
    try {
      setErrorMsg('');
      await api.put(`/finance/bank-statement/accounts/${acct.id}`, { [field]: val });
      setSuccessMsg(`Updated "${acct.account_name}".`);
      await loadData();
    } catch (err) {
      setErrorMsg(err.response?.data?.error || 'Update failed.');
    }
  };

  const handleMoveOrder = async (indexInFiltered, direction) => {
    const targetIdx = indexInFiltered + direction;
    if (targetIdx < 0 || targetIdx >= filteredAccounts.length) return;

    const fullOrder = accounts.map((a) => a.id);
    const idA = filteredAccounts[indexInFiltered].id;
    const idB = filteredAccounts[targetIdx].id;
    const posA = fullOrder.indexOf(idA);
    const posB = fullOrder.indexOf(idB);
    if (posA === -1 || posB === -1) return;

    const swapped = [...fullOrder];
    swapped[posA] = idB;
    swapped[posB] = idA;

    try {
      await api.post('/finance/bank-statement/accounts/reorder', { orderedIds: swapped });
      await loadData();
    } catch (err) {
      setErrorMsg(err.response?.data?.error || 'Failed to reorder accounts.');
    }
  };

  const openMoveTransactionsModal = (acct) => {
    setMoveError('');
    const candidates = accounts.filter((a) => a.id !== acct.id && a.is_active);
    setMoveModal({
      sourceAccount: acct,
      targetAccountId: candidates[0]?.id || ''
    });
  };

  const handleConfirmMoveTransactions = async (e) => {
    e.preventDefault();
    if (!moveModal || movingTxns) return;
    if (!moveModal.targetAccountId) {
      setMoveError('Please choose a destination account.');
      return;
    }
    try {
      setMovingTxns(true);
      setMoveError('');
      const res = await api.post(`/finance/bank-statement/accounts/${moveModal.sourceAccount.id}/move-transactions`, {
        targetAccountId: moveModal.targetAccountId
      });
      if (res.data?.success) {
        setMoveModal(null);
        setSuccessMsg(`Moved ${res.data.movedCount} transaction(s) successfully.`);
        await loadData();
      }
    } catch (err) {
      setMoveError(err.response?.data?.error || 'Failed to move transactions.');
    } finally {
      setMovingTxns(false);
    }
  };

  const openDeleteModal = (acct) => {
    setDeleteError('');
    const candidates = accounts.filter((a) => a.id !== acct.id && a.is_active);
    const defaultMode = acct.txn_count > 0
      ? (candidates.length > 0 ? 'MOVE' : 'PURGE')
      : 'EMPTY';
    setDeleteModal({
      account: acct,
      mode: defaultMode,
      moveToAccountId: acct.txn_count > 0 ? (candidates[0]?.id || '') : '',
      confirmPurgeTxns: false
    });
  };

  const handleConfirmDelete = async () => {
    if (!deleteModal || deletingAcct) return;
    try {
      setDeletingAcct(true);
      setDeleteError('');
      let payload;
      if (deleteModal.account.txn_count > 0) {
        if (deleteModal.mode === 'MOVE' && deleteModal.moveToAccountId) {
          payload = { data: { moveToAccountId: deleteModal.moveToAccountId } };
        } else if (deleteModal.mode === 'PURGE' && deleteModal.confirmPurgeTxns) {
          payload = { data: { deleteTransactions: true } };
        }
      }
      const res = await api.delete(`/finance/bank-statement/accounts/${deleteModal.account.id}`, payload);
      if (res.data?.success) {
        const moved = res.data.data?.movedCount || 0;
        const purged = res.data.data?.deletedTxnCount || 0;
        setDeleteModal(null);
        setSuccessMsg(
          `Deleted "${deleteModal.account.account_name}".${
            moved > 0 ? ` (${moved} transaction(s) safely moved first).` : purged > 0 ? ` (${purged} transaction(s) archived).` : ''
          }`
        );
        await loadData();
      }
    } catch (err) {
      setDeleteError(err.response?.data?.error || 'Failed to delete bank account.');
    } finally {
      setDeletingAcct(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#F4F6FA] dark:bg-slate-950 text-[#14213D] dark:text-slate-100 transition-colors p-2 sm:p-2.5">
      <div className="w-full space-y-2.5">
        {/* Top Bar (#111A36) */}
        <header className="bg-[#111A36] dark:bg-slate-900 dark:border dark:border-slate-800 text-white rounded-[14px] px-3.5 py-2.5 sm:px-4 sm:py-3 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center shrink-0 dark:bg-slate-950 dark:text-slate-100">
              <Landmark className="w-4.5 h-4.5 text-emerald-300" />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm sm:text-base font-black tracking-tight truncate">
                Bank Master &amp; Cash Accounts
              </h1>
              <p className="text-[11px] text-slate-300/90 truncate">
                Manage Bank, Cash, UPI &amp; OD registers — edit details, reorder priority, move transactions &amp; archive accounts
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => navigate('/finance/bank-statement')}
              className="h-8.5 px-3 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Bank Statement</span>
            </button>
            {permissions.upload && (
              <button
                type="button"
                onClick={openCreateModal}
                className="h-8.5 px-3.5 rounded-xl bg-[#3646C9] hover:bg-[#2b39ab] text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Bank / Account</span>
              </button>
            )}
          </div>
        </header>

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

        {/* 4 KPI Strip */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
          <div className="bg-white dark:bg-slate-900 rounded-[14px] border border-[#E3E8F0] dark:border-slate-800 border-t-2 border-t-[#3646C9] px-3.5 py-2.5">
            <div className="text-[10.5px] font-bold uppercase text-slate-500 dark:text-slate-400">Active Accounts</div>
            <div className="text-lg sm:text-xl font-black text-[#14213D] dark:text-slate-100 tabular-nums">
              {stats.activeCount} <span className="text-xs font-semibold text-slate-400 dark:text-slate-400">/ {stats.totalCount} total</span>
            </div>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-[14px] border border-[#E3E8F0] dark:border-slate-800 border-t-2 border-t-[#111A36] dark:border-t-slate-600 px-3.5 py-2.5">
            <div className="text-[10.5px] font-bold uppercase text-slate-500 dark:text-slate-400">Banks / Cash &amp; UPI</div>
            <div className="text-lg sm:text-xl font-black text-[#14213D] dark:text-slate-100 tabular-nums">
              {stats.bankCount} Bank • {stats.cashUpiCount} Cash/UPI
            </div>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-[14px] border border-[#E3E8F0] dark:border-slate-800 border-t-2 border-t-[#087A55] px-3.5 py-2.5">
            <div className="text-[10.5px] font-bold uppercase text-[#087A55] dark:text-emerald-400">Combined Balance</div>
            <div className="text-lg sm:text-xl font-black text-[#087A55] dark:text-emerald-400 tabular-nums">{formatINRBank(stats.totalBalance)}</div>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-[14px] border border-[#E3E8F0] dark:border-slate-800 border-t-2 border-t-[#8A5300] px-3.5 py-2.5">
            <div className="text-[10.5px] font-bold uppercase text-slate-500 dark:text-slate-400">Statement Entries</div>
            <div className="text-lg sm:text-xl font-black text-[#14213D] dark:text-slate-100 tabular-nums">{stats.totalTxns} txns</div>
          </div>
        </div>

        {/* Search & Filter Toolbar */}
        <div className="bg-white dark:bg-slate-900 rounded-[14px] border border-[#E3E8F0] dark:border-slate-800 p-2.5 flex flex-wrap items-center justify-between gap-2 shadow-2xs">
          <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[260px]">
            <div className="relative flex-1 max-w-sm">
              <Search className="w-3.5 h-3.5 text-slate-400 dark:text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search account name, number, bank or IFSC..."
                className="w-full h-8 pl-8 pr-2.5 rounded-lg border border-[#E3E8F0] dark:border-slate-800 text-xs text-[#14213D] dark:text-slate-100 dark:bg-slate-950 dark:text-slate-100"
              />
            </div>

            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              aria-label="Filter by account type"
              className="h-8 px-2.5 rounded-lg border border-[#E3E8F0] dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-semibold text-[#14213D] dark:text-slate-100 dark:bg-slate-950 dark:text-slate-100"
            >
              <option value="ALL">All Types</option>
              {ACCOUNT_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label="Filter by status"
              className="h-8 px-2.5 rounded-lg border border-[#E3E8F0] dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-semibold text-[#14213D] dark:text-slate-100 dark:bg-slate-950 dark:text-slate-100"
            >
              <option value="ACTIVE">Active Only</option>
              <option value="INACTIVE">Inactive Only</option>
              <option value="ALL">All Statuses</option>
            </select>
          </div>
        </div>

        {/* Bank Master Table */}
        <div className="bg-white dark:bg-slate-900 rounded-[14px] border border-[#CBD5E1] dark:border-slate-700 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[1040px] [&_th]:border-r [&_th]:border-[#CBD5E1] dark:border-slate-700 [&_th:last-child]:border-r-0 [&_td]:border-r [&_td]:border-[#E2E8F0] dark:border-slate-800 [&_td:last-child]:border-r-0">
              <thead className="bg-[#EEF2F8] dark:bg-slate-800/95 border-b-2 border-[#CBD5E1] dark:border-slate-700 text-[10.5px] font-bold uppercase text-[#14213D] dark:text-slate-100">
                <tr>
                  <th className="py-2 px-2.5 w-20 text-center">Order</th>
                  <th className="py-2 px-2.5">Account Name</th>
                  <th className="py-2 px-2.5">Type</th>
                  <th className="py-2 px-2.5">Account / UPI No</th>
                  <th className="py-2 px-2.5">Bank / IFSC / Branch</th>
                  <th className="py-2 px-2.5 text-right">Opening Bal</th>
                  <th className="py-2 px-2.5 text-right">Latest Bal</th>
                  <th className="py-2 px-2.5 text-center">Txns</th>
                  <th className="py-2 px-2.5 text-center">Status</th>
                  <th className="py-2 px-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E3E8F0] dark:divide-slate-800 text-xs text-[#14213D] dark:text-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={10} className="py-12 text-center text-slate-400 dark:text-slate-400">
                      <Loader2 className="w-5 h-5 animate-spin mx-auto mb-1.5 text-[#3646C9] dark:text-indigo-400" />
                      Loading Bank Master...
                    </td>
                  </tr>
                ) : filteredAccounts.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-12 text-center space-y-2.5">
                      <div className="text-slate-600 dark:text-slate-300 font-bold text-xs">
                        {accounts.length === 0
                          ? 'No bank, cash, or UPI accounts added yet.'
                          : 'No bank or cash accounts match this filter.'}
                      </div>
                      {accounts.length === 0 && permissions.upload && (
                        <div>
                          <button
                            type="button"
                            onClick={openCreateModal}
                            className="h-8.5 px-3.5 rounded-xl bg-[#3646C9] hover:bg-[#2b39ab] text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" /> Add Bank Account Manually
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ) : (
                  filteredAccounts.map((a, idx) => (
                    <tr
                      key={a.id}
                      className={`align-middle transition-colors hover:bg-[#E8EEFA]/75 dark:hover:bg-slate-800/90 ${
                        !a.is_active
                          ? 'opacity-65 bg-slate-100 dark:bg-slate-800'
                          : idx % 2 === 0
                            ? 'bg-white dark:bg-slate-900'
                            : 'bg-[#F3F6FB] dark:bg-slate-800/45'
                      }`}
                    >
                      <td className="py-2 px-2 text-center whitespace-nowrap">
                        <div className="inline-flex items-center gap-0.5">
                          <button
                            type="button"
                            disabled={!permissions.edit || idx === 0}
                            onClick={() => handleMoveOrder(idx, -1)}
                            title="Move Up"
                            className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-30 cursor-pointer"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={!permissions.edit || idx === filteredAccounts.length - 1}
                            onClick={() => handleMoveOrder(idx, 1)}
                            title="Move Down"
                            className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-30 cursor-pointer"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                      <td className="py-2 px-2.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-[#14213D] dark:text-slate-100">{a.account_name}</span>
                          {a.is_default && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-full bg-indigo-50 dark:bg-indigo-950/50 text-[#3646C9] dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 text-[10px] font-bold">
                              <Star className="w-2.5 h-2.5 fill-current" /> Default
                            </span>
                          )}
                        </div>
                        {a.notes && <div className="text-[10.5px] text-slate-400 dark:text-slate-400 truncate max-w-[220px]">{a.notes}</div>}
                      </td>
                      <td className="py-2 px-2.5 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-[#F4F6FA] dark:bg-slate-800 border border-[#E3E8F0] dark:border-slate-800 text-[10.5px] font-bold">
                          {a.account_type === 'CASH' || a.account_type === 'UPI' ? <Wallet className="w-3 h-3 text-[#087A55] dark:text-emerald-400" /> : <Building2 className="w-3 h-3 text-[#3646C9] dark:text-indigo-400" />}
                          {a.account_type}
                        </span>
                      </td>
                      <td className="py-2 px-2.5 font-mono font-semibold text-slate-700 dark:text-slate-200 whitespace-nowrap">
                        {a.account_number || '—'}
                      </td>
                      <td className="py-2 px-2.5 text-[11.5px]">
                        <div className="font-semibold text-[#14213D] dark:text-slate-100">{a.bank_name || '—'}</div>
                        {(a.ifsc_code || a.branch_name) && (
                          <div className="text-[10.5px] text-slate-500 dark:text-slate-400 font-mono">
                            {a.ifsc_code}{a.ifsc_code && a.branch_name ? ' • ' : ''}{a.branch_name}
                          </div>
                        )}
                      </td>
                      <td className="py-2 px-2.5 text-right font-mono tabular-nums text-slate-600 dark:text-slate-300 whitespace-nowrap">
                        {formatINRBank(a.opening_balance)}
                      </td>
                      <td className="py-2 px-2.5 text-right font-mono tabular-nums font-black text-[#087A55] dark:text-emerald-400 whitespace-nowrap">
                        {formatINRBank(a.latest_balance)}
                      </td>
                      <td className="py-2 px-2.5 text-center">
                        <button
                          type="button"
                          onClick={() => navigate(`/finance/bank-statement?accountId=${a.id}`)}
                          className="px-2 py-0.5 rounded-full bg-[#F4F6FA] dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 border border-[#E3E8F0] dark:border-slate-800 text-[11px] font-bold text-[#3646C9] dark:text-indigo-400 cursor-pointer"
                          title="Open transactions for this account"
                        >
                          {a.txn_count} txns
                        </button>
                      </td>
                      <td className="py-2 px-2.5 text-center whitespace-nowrap">
                        <button
                          type="button"
                          disabled={!permissions.edit}
                          onClick={() => handleToggleQuickField(a, 'isActive', !a.is_active)}
                          className={`px-2 py-0.5 rounded-full text-[10.5px] font-bold border cursor-pointer ${
                            a.is_active
                              ? 'bg-[#E6F5EF] dark:bg-emerald-500/15 text-[#087A55] dark:text-emerald-400 border-[#087A55]/25 dark:border-emerald-500/30'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-300'
                          }`}
                        >
                          {a.is_active ? 'Active' : 'Inactive'}
                        </button>
                      </td>
                      <td className="py-2 px-2.5 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          {permissions.edit && !a.is_default && a.is_active && (
                            <button
                              type="button"
                              onClick={() => handleToggleQuickField(a, 'isDefault', true)}
                              title="Set as default account"
                              className="p-1.5 rounded-lg border border-[#E3E8F0] dark:border-slate-800 hover:bg-[#F4F6FA] dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 cursor-pointer"
                            >
                              <Star className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {permissions.edit && (
                            <button
                              type="button"
                              onClick={() => openEditModal(a)}
                              title="Edit / Update account"
                              className="px-2 py-1 rounded-lg border border-[#E3E8F0] dark:border-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 text-[#3646C9] dark:text-indigo-400 text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer"
                            >
                              <Pencil className="w-3 h-3" /> Edit
                            </button>
                          )}
                          {permissions.edit && a.txn_count > 0 && (
                            <button
                              type="button"
                              onClick={() => openMoveTransactionsModal(a)}
                              title="Move transactions to another bank account"
                              className="px-2 py-1 rounded-lg border border-[#E3E8F0] dark:border-slate-800 hover:bg-amber-50 dark:hover:bg-amber-500/20 text-[#8A5300] dark:text-amber-300 text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer"
                            >
                              <ArrowRightLeft className="w-3 h-3" /> Move
                            </button>
                          )}
                          {permissions.delete && (
                            <button
                              type="button"
                              onClick={() => openDeleteModal(a)}
                              title="Delete account"
                              className="px-2 py-1 rounded-lg border border-[#E3E8F0] dark:border-slate-800 hover:bg-[#FDECEC] dark:hover:bg-rose-500/20 text-[#B4232F] dark:text-rose-400 text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer"
                            >
                              <Trash2 className="w-3 h-3" /> Delete
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Add / Edit Bank Account Modal */}
      {formModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-2xs flex items-center justify-center p-4" onClick={() => !savingForm && setFormModal(null)}>
          <form
            onSubmit={handleSaveForm}
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-slate-900 rounded-[14px] border border-[#E3E8F0] dark:border-slate-800 w-full max-w-lg p-4 sm:p-5 space-y-3.5 shadow-xl max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-[#E3E8F0] dark:border-slate-800 pb-2.5">
              <h3 className="text-sm font-black text-[#14213D] dark:text-slate-100">
                {formModal.mode === 'create' ? 'Add New Bank / Cash Account' : 'Edit Bank / Cash Account'}
              </h3>
              <button type="button" onClick={() => setFormModal(null)} className="p-1 rounded-lg hover:bg-[#F4F6FA] dark:hover:bg-slate-800">
                <X className="w-4 h-4" />
              </button>
            </div>

            {formError && (
              <div className="p-2.5 rounded-xl bg-[#FDECEC] dark:bg-rose-500/15 border border-[#B4232F]/30 dark:border-rose-500/30 text-[#B4232F] dark:text-rose-400 text-xs font-semibold">
                {formError}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="sm:col-span-2">
                <label className="block font-bold text-slate-600 dark:text-slate-300 mb-1">Account Display Name *</label>
                <input
                  required
                  type="text"
                  value={formModal.data.accountName}
                  onChange={(e) => setFormModal({ ...formModal, data: { ...formModal.data, accountName: e.target.value } })}
                  placeholder="e.g. HDFC Current Account"
                  className="w-full h-9 px-2.5 rounded-xl border border-[#E3E8F0] dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-600 dark:text-slate-300 mb-1">Account Type</label>
                <select
                  value={formModal.data.accountType}
                  onChange={(e) => setFormModal({ ...formModal, data: { ...formModal.data, accountType: e.target.value } })}
                  className="w-full h-9 px-2.5 rounded-xl border border-[#E3E8F0] dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
                >
                  {ACCOUNT_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-600 dark:text-slate-300 mb-1">Account Number / UPI ID</label>
                <input
                  type="text"
                  value={formModal.data.accountNumber}
                  onChange={(e) => setFormModal({ ...formModal, data: { ...formModal.data, accountNumber: e.target.value } })}
                  placeholder="50200012345678 or upi@bank"
                  className="w-full h-9 px-2.5 rounded-xl border border-[#E3E8F0] dark:border-slate-800 font-mono dark:bg-slate-950 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-600 dark:text-slate-300 mb-1">Bank / Institution Name</label>
                <input
                  type="text"
                  value={formModal.data.bankName}
                  onChange={(e) => setFormModal({ ...formModal, data: { ...formModal.data, bankName: e.target.value } })}
                  placeholder="HDFC Bank Ltd"
                  className="w-full h-9 px-2.5 rounded-xl border border-[#E3E8F0] dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-600 dark:text-slate-300 mb-1">IFSC Code</label>
                <input
                  type="text"
                  value={formModal.data.ifscCode}
                  onChange={(e) => setFormModal({ ...formModal, data: { ...formModal.data, ifscCode: e.target.value.toUpperCase() } })}
                  placeholder="HDFC0001234"
                  className="w-full h-9 px-2.5 rounded-xl border border-[#E3E8F0] dark:border-slate-800 font-mono uppercase dark:bg-slate-950 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-600 dark:text-slate-300 mb-1">Branch Name</label>
                <input
                  type="text"
                  value={formModal.data.branchName}
                  onChange={(e) => setFormModal({ ...formModal, data: { ...formModal.data, branchName: e.target.value } })}
                  placeholder="Main Branch"
                  className="w-full h-9 px-2.5 rounded-xl border border-[#E3E8F0] dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-600 dark:text-slate-300 mb-1">Opening Balance (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  value={formModal.data.openingBalance}
                  onChange={(e) => setFormModal({ ...formModal, data: { ...formModal.data, openingBalance: e.target.value } })}
                  className="w-full h-9 px-2.5 rounded-xl border border-[#E3E8F0] dark:border-slate-800 text-right font-mono tabular-nums dark:bg-slate-950 dark:text-slate-100"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block font-bold text-slate-600 dark:text-slate-300 mb-1">Notes</label>
                <input
                  type="text"
                  value={formModal.data.notes}
                  onChange={(e) => setFormModal({ ...formModal, data: { ...formModal.data, notes: e.target.value } })}
                  placeholder="Optional remark or purpose"
                  className="w-full h-9 px-2.5 rounded-xl border border-[#E3E8F0] dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
                />
              </div>

              <div className="sm:col-span-2 flex flex-wrap items-center gap-4 pt-1">
                <label className="inline-flex items-center gap-1.5 font-bold text-[#14213D] dark:text-slate-100 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formModal.data.isDefault}
                    onChange={(e) => setFormModal({ ...formModal, data: { ...formModal.data, isDefault: e.target.checked } })}
                    className="rounded border-slate-300 text-[#3646C9] dark:text-indigo-400"
                  />
                  <span>Set as Default Account</span>
                </label>

                <label className="inline-flex items-center gap-1.5 font-bold text-[#14213D] dark:text-slate-100 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formModal.data.isActive}
                    onChange={(e) => setFormModal({ ...formModal, data: { ...formModal.data, isActive: e.target.checked } })}
                    className="rounded border-slate-300 text-[#087A55] dark:text-emerald-400"
                  />
                  <span>Active</span>
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[#E3E8F0] dark:border-slate-800">
              <button
                type="button"
                disabled={savingForm}
                onClick={() => setFormModal(null)}
                className="px-4 py-1.5 rounded-xl border border-[#E3E8F0] dark:border-slate-800 text-xs font-bold text-[#14213D] dark:text-slate-100"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingForm}
                className="px-4 py-1.5 rounded-xl bg-[#3646C9] hover:bg-[#2b39ab] text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
              >
                {savingForm && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>{formModal.mode === 'create' ? 'Save Account' : 'Update Account'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Move Transactions Modal */}
      {moveModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-2xs flex items-center justify-center p-4" onClick={() => !movingTxns && setMoveModal(null)}>
          <form
            onSubmit={handleConfirmMoveTransactions}
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-slate-900 rounded-[14px] border border-[#E3E8F0] dark:border-slate-800 w-full max-w-md p-4 space-y-3.5 shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-[#E3E8F0] dark:border-slate-800 pb-2.5">
              <h3 className="text-sm font-black text-[#14213D] dark:text-slate-100 flex items-center gap-1.5">
                <ArrowRightLeft className="w-4 h-4 text-[#8A5300] dark:text-amber-300" /> Move Account Transactions
              </h3>
              <button type="button" onClick={() => setMoveModal(null)} className="p-1 rounded-lg hover:bg-[#F4F6FA] dark:hover:bg-slate-800">
                <X className="w-4 h-4" />
              </button>
            </div>

            {moveError && (
              <div className="p-2.5 rounded-xl bg-[#FDECEC] dark:bg-rose-500/15 border border-[#B4232F]/30 dark:border-rose-500/30 text-[#B4232F] dark:text-rose-400 text-xs font-semibold">
                {moveError}
              </div>
            )}

            <div className="text-xs space-y-2">
              <div className="p-2.5 rounded-xl bg-[#F4F6FA] dark:bg-slate-800 border border-[#E3E8F0] dark:border-slate-800">
                Moving <strong>{moveModal.sourceAccount.txn_count} transaction(s)</strong> from{' '}
                <strong className="text-[#14213D] dark:text-slate-100">{moveModal.sourceAccount.account_name}</strong>
              </div>
              <div>
                <label className="block font-bold text-slate-600 dark:text-slate-300 mb-1">Destination Bank / Cash Account *</label>
                <select
                  required
                  value={moveModal.targetAccountId}
                  onChange={(e) => setMoveModal({ ...moveModal, targetAccountId: e.target.value })}
                  className="w-full h-9 px-2.5 rounded-xl border border-[#E3E8F0] dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
                >
                  <option value="">Select destination account...</option>
                  {accounts
                    .filter((a) => a.id !== moveModal.sourceAccount.id && a.is_active)
                    .map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.account_name} ({a.account_number || a.account_type})
                      </option>
                    ))}
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[#E3E8F0] dark:border-slate-800">
              <button
                type="button"
                disabled={movingTxns}
                onClick={() => setMoveModal(null)}
                className="px-3.5 py-1.5 rounded-xl border border-[#E3E8F0] dark:border-slate-800 text-xs font-bold text-[#14213D] dark:text-slate-100"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={movingTxns}
                className="px-4 py-1.5 rounded-xl bg-[#3646C9] hover:bg-[#2b39ab] text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
              >
                {movingTxns && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Move All Transactions</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Delete Account Modal */}
      {deleteModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-2xs flex items-center justify-center p-4" onClick={() => !deletingAcct && setDeleteModal(null)}>
          <div className="bg-white dark:bg-slate-900 rounded-[14px] border border-[#E3E8F0] dark:border-slate-800 w-full max-w-md p-4 space-y-3.5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-black text-[#14213D] dark:text-slate-100">
              Delete &ldquo;{deleteModal.account.account_name}&rdquo;?
            </h3>

            {deleteError && (
              <div className="p-2.5 rounded-xl bg-[#FDECEC] dark:bg-rose-500/15 border border-[#B4232F]/30 dark:border-rose-500/30 text-[#B4232F] dark:text-rose-400 text-xs font-semibold">
                {deleteError}
              </div>
            )}

            {deleteModal.account.txn_count > 0 ? (
              <div className="space-y-2.5 text-xs">
                <div className="p-2.5 rounded-xl bg-[#FEF4E6] dark:bg-amber-500/15 border border-[#8A5300]/30 dark:border-amber-500/30 text-[#8A5300] dark:text-amber-300 font-semibold">
                  This account currently holds <strong>{deleteModal.account.txn_count} transaction(s)</strong>. Choose how to handle them:
                </div>

                {accounts.some((a) => a.id !== deleteModal.account.id && a.is_active) && (
                  <label className="flex items-center gap-2 font-bold text-[#14213D] dark:text-slate-100 cursor-pointer">
                    <input
                      type="radio"
                      name="deleteMode"
                      checked={deleteModal.mode === 'MOVE'}
                      onChange={() => setDeleteModal({ ...deleteModal, mode: 'MOVE' })}
                      className="text-[#3646C9] dark:text-indigo-400"
                    />
                    <span>Move transactions to another account first</span>
                  </label>
                )}

                {deleteModal.mode === 'MOVE' && (
                  <select
                    value={deleteModal.moveToAccountId}
                    onChange={(e) => setDeleteModal({ ...deleteModal, moveToAccountId: e.target.value })}
                    className="w-full h-9 px-2.5 rounded-xl border border-[#E3E8F0] dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
                  >
                    <option value="">Select destination account...</option>
                    {accounts
                      .filter((a) => a.id !== deleteModal.account.id && a.is_active)
                      .map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.account_name} ({a.account_number || a.account_type})
                        </option>
                      ))}
                  </select>
                )}

                <label className="flex items-center gap-2 font-bold text-[#B4232F] dark:text-rose-400 cursor-pointer">
                  <input
                    type="radio"
                    name="deleteMode"
                    checked={deleteModal.mode === 'PURGE'}
                    onChange={() => setDeleteModal({ ...deleteModal, mode: 'PURGE' })}
                    className="text-[#B4232F] dark:text-rose-400"
                  />
                  <span>Delete account &amp; archive its {deleteModal.account.txn_count} transaction(s)</span>
                </label>

                {deleteModal.mode === 'PURGE' && (
                  <label className="flex items-start gap-2 p-2.5 rounded-xl bg-[#FDECEC] dark:bg-rose-500/15 border border-[#B4232F]/25 dark:border-rose-500/30 text-[#B4232F] dark:text-rose-400 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(deleteModal.confirmPurgeTxns)}
                      onChange={(e) => setDeleteModal({ ...deleteModal, confirmPurgeTxns: e.target.checked })}
                      className="mt-0.5 rounded border-red-300 text-[#B4232F] dark:text-rose-400"
                    />
                    <span>I confirm archiving all {deleteModal.account.txn_count} transaction(s) in this account.</span>
                  </label>
                )}
              </div>
            ) : (
              <p className="text-xs text-slate-600 dark:text-slate-300">
                This account has 0 transactions and will be archived from active Bank Master &amp; statement selectors. An audit entry will be recorded.
              </p>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-[#E3E8F0] dark:border-slate-800">
              <button
                type="button"
                disabled={deletingAcct}
                onClick={() => setDeleteModal(null)}
                className="px-3.5 py-1.5 rounded-xl border border-[#E3E8F0] dark:border-slate-800 text-xs font-bold text-[#14213D] dark:text-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={
                  deletingAcct ||
                  (deleteModal.account.txn_count > 0 &&
                    ((deleteModal.mode === 'MOVE' && !deleteModal.moveToAccountId) ||
                      (deleteModal.mode === 'PURGE' && !deleteModal.confirmPurgeTxns)))
                }
                onClick={handleConfirmDelete}
                className="px-4 py-1.5 rounded-xl bg-[#B4232F] hover:bg-red-800 disabled:opacity-40 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
              >
                {deletingAcct && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>
                  {deleteModal.account.txn_count > 0
                    ? deleteModal.mode === 'MOVE'
                      ? 'Move Txns & Delete'
                      : 'Delete Account & Txns'
                    : 'Confirm Delete'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
