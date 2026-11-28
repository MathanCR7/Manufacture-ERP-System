import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Landmark, UploadCloud, X, Loader2, ShieldCheck, Plus, Settings2, ChevronUp
} from 'lucide-react';
import { api } from '@/lib/axios';
import BankStatementUploadTab from '../components/bank-statement/BankStatementUploadTab';
import BankStatementTransactionsTab from '../components/bank-statement/BankStatementTransactionsTab';
import { formatINRBank } from '../components/bank-statement/bankStatementHelpers';

export default function BankStatementPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialQueryAccount = searchParams.get('accountId') || '';

  const [accounts, setAccounts] = useState([]);
  const [selectedAccountId, setSelectedAccountId] = useState(initialQueryAccount);
  const [filterAccountId, setFilterAccountId] = useState(initialQueryAccount || 'ALL');
  const [showUploadPanel, setShowUploadPanel] = useState(false);

  const [permissions, setPermissions] = useState({
    view: true,
    upload: false,
    edit: false,
    delete: false,
    gstReview: false
  });
  const [previewState, setPreviewState] = useState(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [loadingInit, setLoadingInit] = useState(true);

  // Add Bank Account Modal (Full Details matching Bank Master + Bank Master redirect)
  const [showAddAccountModal, setShowAddAccountModal] = useState(false);
  const [newAcct, setNewAcct] = useState({
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
  });
  const [creatingAccount, setCreatingAccount] = useState(false);
  const [accountError, setAccountError] = useState('');

  const loadAccountsAndPermissions = useCallback(async () => {
    try {
      setLoadingInit(true);
      const [permRes, acctRes] = await Promise.all([
        api.get('/finance/bank-statement/permissions'),
        api.get('/finance/bank-statement/accounts')
      ]);

      if (permRes.data?.success) {
        setPermissions(permRes.data.data.permissions || {});
      }
      if (acctRes.data?.success) {
        const list = acctRes.data.data || [];
        setAccounts(list);
        if (list.length > 0 && !selectedAccountId) {
          const preferred = list.find((a) => a.is_default) || list.find((a) => a.account_type === 'BANK') || list[0];
          setSelectedAccountId(String(preferred.id));
        }
      }
    } catch (err) {
      console.error('Failed to initialize Bank Statement module:', err);
    } finally {
      setLoadingInit(false);
    }
  }, [selectedAccountId]);

  useEffect(() => {
    const t = setTimeout(() => {
      loadAccountsAndPermissions();
    }, 0);
    return () => clearTimeout(t);
  }, [loadAccountsAndPermissions]);

  // Warn before closing browser tab if preview has unsaved rows
  useEffect(() => {
    const hasUnsaved = Boolean(previewState?.rows?.length);
    const handler = (e) => {
      if (!hasUnsaved) return;
      e.preventDefault();
      e.returnValue = 'You have unsaved bank statement preview rows. Are you sure you want to leave?';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [previewState]);

  const handleDataMutated = () => {
    setRefreshTrigger((n) => n + 1);
    loadAccountsAndPermissions();
  };

  const handleCreateAccount = async (e) => {
    e.preventDefault();
    if (!newAcct.accountName.trim()) {
      setAccountError('Account name is required.');
      return;
    }
    try {
      setCreatingAccount(true);
      setAccountError('');
      const res = await api.post('/finance/bank-statement/accounts', newAcct);
      if (res.data?.success) {
        const createdId = String(res.data.data.id);
        setShowAddAccountModal(false);
        setNewAcct({
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
        });
        await loadAccountsAndPermissions();
        setSelectedAccountId(createdId);
      }
    } catch (err) {
      setAccountError(err.response?.data?.error || 'Could not create bank account.');
    } finally {
      setCreatingAccount(false);
    }
  };

  const isUploadExpanded = showUploadPanel || Boolean(previewState?.rows?.length);

  return (
    <div className="min-h-screen w-full bg-[#F4F6FA] dark:bg-slate-950 text-[#14213D] dark:text-slate-100 transition-colors p-2 sm:p-2.5">
      <div className="w-full space-y-2.5">
        {/* Top Bar (#111A36) — Single-page Bank Statement (Transactions Primary + Top Upload Button) */}
        <header className="bg-[#111A36] dark:bg-slate-900 dark:border dark:border-slate-800 text-white rounded-[14px] px-3.5 py-2.5 sm:px-4 sm:py-3 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center shrink-0 dark:bg-slate-950 dark:text-slate-100">
              <Landmark className="w-4.5 h-4.5 text-emerald-300" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-sm sm:text-base font-black tracking-tight truncate">
                  Bank Statement &amp; Transactions
                </h1>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/10 text-[10px] font-bold text-slate-200 border border-white/15">
                  <ShieldCheck className="w-3 h-3 text-emerald-300" />
                  <span>{permissions.upload ? 'Full Access' : 'View Only'}</span>
                </span>
              </div>
              <p className="text-[11px] text-slate-300/90 truncate hidden sm:block">
                Upload Excel/CSV statements, reconcile running balances, edit &amp; export ledger transactions
              </p>
            </div>
          </div>

          {/* Right Top Action Bar — Upload Statement Only */}
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 shrink-0">
            {permissions.upload && (
              <button
                type="button"
                onClick={() => setShowUploadPanel((v) => !v)}
                className={`h-8.5 px-3.5 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shadow-xs transition-all ${
                  isUploadExpanded
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    : 'bg-[#3646C9] hover:bg-[#2b39ab] text-white'
                }`}
              >
                {isUploadExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <UploadCloud className="w-3.5 h-3.5" />}
                <span>{isUploadExpanded ? 'Hide Upload' : '+ Upload Statement'}</span>
                {previewState?.rows?.length > 0 && (
                  <span className="ml-0.5 px-1.5 py-0.2 rounded-full bg-amber-400 text-[#111A36] text-[10px] font-black">
                    {previewState.rows.length}
                  </span>
                )}
              </button>
            )}
          </div>
        </header>

        {/* Compact Accounts Balances Strip or Empty CTA */}
        {!loadingInit && accounts.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-[14px] border border-[#E3E8F0] dark:border-slate-800 px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shadow-2xs">
            <div className="flex items-center gap-2.5 text-xs">
              <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-[#3646C9] dark:text-indigo-400 flex items-center justify-center shrink-0">
                <Landmark className="w-4 h-4" />
              </div>
              <div>
                <div className="font-bold text-[#14213D] dark:text-slate-100">No bank or cash accounts added yet</div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">Add your company bank / cash account manually to start uploading statements.</div>
              </div>
            </div>
            {permissions.upload && (
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => navigate('/finance/bank-master')}
                  className="h-8 px-3 rounded-lg border border-[#E3E8F0] dark:border-slate-800 hover:bg-[#F4F6FA] dark:hover:bg-slate-800 text-xs font-bold text-[#14213D] dark:text-slate-100 cursor-pointer"
                >
                  Open Bank Master
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddAccountModal(true)}
                  className="h-8 px-3.5 rounded-lg bg-[#3646C9] hover:bg-[#2b39ab] text-white text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Bank Account
                </button>
              </div>
            )}
          </div>
        ) : accounts.length > 0 && (
          <div className="flex items-center gap-2.5 overflow-x-auto pb-0.5 no-scrollbar">
            {accounts.map((a) => {
              const isSelected = String(filterAccountId) === String(a.id);
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => {
                    setSelectedAccountId(String(a.id));
                    setFilterAccountId((prev) => (String(prev) === String(a.id) ? 'ALL' : String(a.id)));
                  }}
                  className={`shrink-0 text-left rounded-xl border px-3 py-2 flex flex-wrap sm:flex-nowrap items-center gap-3 text-xs shadow-2xs transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-indigo-50/70 dark:bg-indigo-950/50 border-[#3646C9] ring-1 ring-[#3646C9]/30'
                      : 'bg-white dark:bg-slate-900 border-[#E3E8F0] dark:border-slate-800 hover:border-[#3646C9]/50'
                  }`}
                >
                  <div className="min-w-0 pr-1">
                    <div className="flex items-center gap-1.5">
                      <span className="font-black text-[#14213D] dark:text-slate-100 text-xs leading-tight">{a.account_name}</span>
                      <span className="text-[9.5px] px-1.5 py-0.2 rounded-full bg-[#F4F6FA] dark:bg-slate-800 border border-[#E3E8F0] dark:border-slate-800 text-slate-600 dark:text-slate-300 font-bold">
                        {a.txn_count || 0} txns
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">{a.account_number || a.account_type}</div>
                  </div>

                  <div className="flex items-center gap-2 border-l border-[#E3E8F0] dark:border-slate-800 pl-2.5">
                    <div className="px-2 py-1 rounded-lg bg-orange-50 dark:bg-orange-500/15 border border-orange-200 dark:border-orange-500/30 text-right dark:bg-slate-950 dark:text-slate-100">
                      <div className="text-[9px] font-bold uppercase tracking-wide text-[#EA580C] dark:text-orange-400">Total Bal</div>
                      <div className="text-[11px] font-black text-[#EA580C] dark:text-orange-400 tabular-nums font-mono">
                        {formatINRBank(a.latest_balance)}
                      </div>
                    </div>
                    <div className="px-2 py-1 rounded-lg bg-[#E6F5EF]/80 dark:bg-emerald-500/15 border border-[#087A55]/25 dark:border-emerald-500/30 text-right dark:bg-slate-950 dark:text-slate-100">
                      <div className="text-[9px] font-bold uppercase tracking-wide text-[#087A55] dark:text-emerald-400">Inward</div>
                      <div className="text-[11px] font-black text-[#087A55] dark:text-emerald-400 tabular-nums font-mono">
                        {formatINRBank(a.total_credit || 0)}
                      </div>
                    </div>
                    <div className="px-2 py-1 rounded-lg bg-[#FDECEC]/80 dark:bg-rose-500/15 border border-[#B4232F]/25 dark:border-rose-500/30 text-right dark:bg-slate-950 dark:text-slate-100">
                      <div className="text-[9px] font-bold uppercase tracking-wide text-[#B4232F] dark:text-rose-400">Outward</div>
                      <div className="text-[11px] font-black text-[#B4232F] dark:text-rose-400 tabular-nums font-mono">
                        {formatINRBank(a.total_debit || 0)}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {loadingInit && accounts.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-[14px] border border-[#E3E8F0] dark:border-slate-800 p-12 text-center">
            <Loader2 className="w-6 h-6 animate-spin mx-auto text-[#3646C9] dark:text-indigo-400" />
            <p className="mt-2 text-xs font-semibold text-slate-500 dark:text-slate-400">Loading Bank Statement...</p>
          </div>
        ) : (
          <main className="space-y-3">
            {/* Inline Upload & Editable Preview Panel (when toggled or preview active) */}
            {isUploadExpanded && (
              <section aria-label="Upload Bank Statement">
                <BankStatementUploadTab
                  accounts={accounts}
                  selectedAccountId={selectedAccountId}
                  onSelectAccount={setSelectedAccountId}
                  onOpenAddAccount={() => setShowAddAccountModal(true)}
                  permissions={permissions}
                  previewState={previewState}
                  setPreviewState={setPreviewState}
                  onSaveSuccess={() => {
                    handleDataMutated();
                    setShowUploadPanel(false);
                  }}
                />
              </section>
            )}

            {/* Primary Live Transactions Section */}
            <section aria-label="Saved Bank Transactions">
              <BankStatementTransactionsTab
                accounts={accounts}
                permissions={permissions}
                refreshTrigger={refreshTrigger}
                onDataMutated={handleDataMutated}
                onGoToUpload={() => setShowUploadPanel(true)}
                onGoToGst={() => navigate('/finance/gst')}
                externalAccountId={filterAccountId}
                onExternalAccountChange={setFilterAccountId}
              />
            </section>
          </main>
        )}
      </div>

      {/* Quick Add Bank Account Modal (Full Details matching Bank Master) */}
      {showAddAccountModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-2xs flex items-center justify-center p-4" onClick={() => !creatingAccount && setShowAddAccountModal(false)}>
          <form
            onSubmit={handleCreateAccount}
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-slate-900 rounded-[14px] border border-[#E3E8F0] dark:border-slate-800 w-full max-w-lg p-4 sm:p-5 space-y-3.5 shadow-xl max-h-[92vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-[#E3E8F0] dark:border-slate-800 pb-2.5 gap-2">
              <div>
                <h3 className="text-sm font-black text-[#14213D] dark:text-slate-100">Add Bank / Cash Account</h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">Quick create with full Bank Master details</p>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddAccountModal(false);
                    navigate('/finance/bank-master?add=1');
                  }}
                  className="h-7.5 px-2.5 rounded-lg border border-[#E3E8F0] dark:border-slate-800 hover:bg-[#F4F6FA] dark:hover:bg-slate-800 text-[11px] font-bold text-[#3646C9] dark:text-indigo-400 inline-flex items-center gap-1 cursor-pointer"
                >
                  <Settings2 className="w-3 h-3" /> Open Bank Master →
                </button>
                <button type="button" onClick={() => setShowAddAccountModal(false)} className="p-1 rounded-lg hover:bg-[#F4F6FA] dark:hover:bg-slate-800">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {accountError && (
              <div className="p-2.5 rounded-xl bg-[#FDECEC] dark:bg-rose-500/15 border border-[#B4232F]/30 dark:border-rose-500/30 text-[#B4232F] dark:text-rose-400 text-xs font-semibold">
                {accountError}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="sm:col-span-2">
                <label className="block font-bold text-slate-600 dark:text-slate-300 mb-1">Account Display Name *</label>
                <input
                  required
                  type="text"
                  value={newAcct.accountName}
                  onChange={(e) => setNewAcct({ ...newAcct, accountName: e.target.value })}
                  placeholder="e.g. ICICI Current Account 0913"
                  className="w-full h-9 px-2.5 rounded-xl border border-[#E3E8F0] dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-600 dark:text-slate-300 mb-1">Type</label>
                <select
                  value={newAcct.accountType}
                  onChange={(e) => setNewAcct({ ...newAcct, accountType: e.target.value })}
                  className="w-full h-9 px-2.5 rounded-xl border border-[#E3E8F0] dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
                >
                  <option value="BANK">Bank Account</option>
                  <option value="CASH">Cash Register</option>
                  <option value="UPI">UPI Merchant</option>
                  <option value="OD">OD / CC Account</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-600 dark:text-slate-300 mb-1">Account Number / UPI ID</label>
                <input
                  type="text"
                  value={newAcct.accountNumber}
                  onChange={(e) => setNewAcct({ ...newAcct, accountNumber: e.target.value })}
                  placeholder="50200012345678 or upi@bank"
                  className="w-full h-9 px-2.5 rounded-xl border border-[#E3E8F0] dark:border-slate-800 font-mono dark:bg-slate-950 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-600 dark:text-slate-300 mb-1">Bank / Institution Name</label>
                <input
                  type="text"
                  value={newAcct.bankName}
                  onChange={(e) => setNewAcct({ ...newAcct, bankName: e.target.value })}
                  placeholder="ICICI Bank"
                  className="w-full h-9 px-2.5 rounded-xl border border-[#E3E8F0] dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-600 dark:text-slate-300 mb-1">IFSC Code</label>
                <input
                  type="text"
                  value={newAcct.ifscCode}
                  onChange={(e) => setNewAcct({ ...newAcct, ifscCode: e.target.value.toUpperCase() })}
                  placeholder="ICIC0000913"
                  className="w-full h-9 px-2.5 rounded-xl border border-[#E3E8F0] dark:border-slate-800 font-mono uppercase dark:bg-slate-950 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-600 dark:text-slate-300 mb-1">Branch Name</label>
                <input
                  type="text"
                  value={newAcct.branchName}
                  onChange={(e) => setNewAcct({ ...newAcct, branchName: e.target.value })}
                  placeholder="Main Branch"
                  className="w-full h-9 px-2.5 rounded-xl border border-[#E3E8F0] dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-600 dark:text-slate-300 mb-1">Opening Balance (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  value={newAcct.openingBalance}
                  onChange={(e) => setNewAcct({ ...newAcct, openingBalance: e.target.value })}
                  className="w-full h-9 px-2.5 rounded-xl border border-[#E3E8F0] dark:border-slate-800 text-right font-mono tabular-nums dark:bg-slate-950 dark:text-slate-100"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block font-bold text-slate-600 dark:text-slate-300 mb-1">Notes / Purpose</label>
                <input
                  type="text"
                  value={newAcct.notes}
                  onChange={(e) => setNewAcct({ ...newAcct, notes: e.target.value })}
                  placeholder="Optional remark or account purpose"
                  className="w-full h-9 px-2.5 rounded-xl border border-[#E3E8F0] dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
                />
              </div>

              <div className="sm:col-span-2 flex flex-wrap items-center gap-4 pt-0.5">
                <label className="inline-flex items-center gap-1.5 font-bold text-[#14213D] dark:text-slate-100 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(newAcct.isDefault)}
                    onChange={(e) => setNewAcct({ ...newAcct, isDefault: e.target.checked })}
                    className="rounded border-slate-300 text-[#3646C9] dark:text-indigo-400"
                  />
                  <span>Set as Default Account</span>
                </label>

                <label className="inline-flex items-center gap-1.5 font-bold text-[#14213D] dark:text-slate-100 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(newAcct.isActive)}
                    onChange={(e) => setNewAcct({ ...newAcct, isActive: e.target.checked })}
                    className="rounded border-slate-300 text-[#087A55] dark:text-emerald-400"
                  />
                  <span>Active</span>
                </label>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#E3E8F0] dark:border-slate-800">
              <button
                type="button"
                disabled={creatingAccount}
                onClick={() => {
                  setShowAddAccountModal(false);
                  navigate('/finance/bank-master?add=1');
                }}
                className="text-[11px] font-bold text-[#3646C9] dark:text-indigo-400 hover:underline cursor-pointer"
              >
                Go to Bank Master page →
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={creatingAccount}
                  onClick={() => setShowAddAccountModal(false)}
                  className="px-3.5 py-1.5 rounded-xl border border-[#E3E8F0] dark:border-slate-800 text-xs font-bold text-[#14213D] dark:text-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingAccount}
                  className="px-4 py-1.5 rounded-xl bg-[#3646C9] hover:bg-[#2b39ab] text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  {creatingAccount && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Create Account</span>
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
