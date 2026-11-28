import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ReceiptIndianRupee, Landmark, Settings2, Loader2, ShieldCheck
} from 'lucide-react';
import { api } from '@/lib/axios';
import BankStatementGstTab from '../components/bank-statement/BankStatementGstTab';

export default function GstFilingPage() {
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState([]);
  const [permissions, setPermissions] = useState({
    view: true,
    upload: false,
    edit: false,
    delete: false,
    gstReview: false
  });
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [loadingInit, setLoadingInit] = useState(true);

  const loadInit = useCallback(async () => {
    try {
      setLoadingInit(true);
      const [permRes, acctRes] = await Promise.all([
        api.get('/finance/bank-statement/permissions'),
        api.get('/finance/bank-statement/accounts')
      ]);
      if (permRes.data?.success) setPermissions(permRes.data.data.permissions || {});
      if (acctRes.data?.success) setAccounts(acctRes.data.data || []);
    } catch (err) {
      console.error('Failed to initialize GST & Filing page:', err);
    } finally {
      setLoadingInit(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      loadInit();
    }, 0);
    return () => clearTimeout(t);
  }, [loadInit]);

  return (
    <div className="min-h-screen bg-[#F4F6FA] text-[#14213D] p-2.5 sm:p-4">
      <div className="max-w-[1520px] mx-auto space-y-3">
        {/* Top Bar (#111A36) */}
        <header className="bg-[#111A36] text-white rounded-[14px] px-3.5 py-2.5 sm:px-4 sm:py-3 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center shrink-0">
              <ReceiptIndianRupee className="w-4.5 h-4.5 text-emerald-300" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-sm sm:text-base font-black tracking-tight truncate">
                  GST &amp; Filing Working Paper
                </h1>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/10 text-[10px] font-bold text-slate-200 border border-white/15">
                  <ShieldCheck className="w-3 h-3 text-emerald-300" />
                  <span>{permissions.gstReview ? 'GST Reviewer' : 'View Only'}</span>
                </span>
              </div>
              <p className="text-[11px] text-slate-300/90 truncate">
                Bank GST review, GSTR-2B matching, ERP GSTR-3B reconciliation, 6-sheet Excel &amp; Filing PDF Reports
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => navigate('/finance/bank-statement')}
              className="h-8.5 px-3 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Landmark className="w-3.5 h-3.5" />
              <span>Bank Statement</span>
            </button>
            <button
              type="button"
              onClick={() => navigate('/finance/bank-master')}
              className="h-8.5 px-3 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Settings2 className="w-3.5 h-3.5" />
              <span>Bank Master</span>
            </button>
          </div>
        </header>

        {loadingInit && accounts.length === 0 ? (
          <div className="bg-white rounded-[14px] border border-[#E3E8F0] p-12 text-center">
            <Loader2 className="w-6 h-6 animate-spin mx-auto text-[#3646C9]" />
            <p className="mt-2 text-xs font-semibold text-slate-500">Loading GST &amp; Filing workspace...</p>
          </div>
        ) : (
          <main>
            <BankStatementGstTab
              accounts={accounts}
              permissions={permissions}
              refreshTrigger={refreshTrigger}
              onDataMutated={() => {
                setRefreshTrigger((n) => n + 1);
                loadInit();
              }}
            />
          </main>
        )}
      </div>
    </div>
  );
}
