import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users, Printer, Search, Download, FileText, ChevronDown, X, Phone, Mail,
  MapPin, Building2, Landmark, ReceiptIndianRupee, ArrowUpRight, Loader2, Check
} from 'lucide-react';
import { api } from '@/lib/axios';
import useCompanyStore from '@/app/store/companyStore';
import { formatINR } from '@/utils/financeFormatters';
import { formatBankDisplayDate } from '../components/bank-statement/bankStatementHelpers';
import BankStatementPagination from '../components/bank-statement/BankStatementPagination';
import { exportPartyLedgerPdf, exportAgingPdf } from '../utils/partyLedgerPdfGenerator';

const DATE_PRESETS = [
  { id: 'all', label: 'All Dates' },
  { id: 'this_month', label: 'This Month' },
  { id: 'last_month', label: 'Last Month' },
  { id: 'this_fy', label: 'This FY' },
  { id: 'custom', label: 'Custom' }
];

function computePresetDates(presetId) {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const pad = (n) => String(n).padStart(2, '0');
  const toIso = (dt) => `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;

  if (presetId === 'this_month') {
    return { from: toIso(new Date(y, m, 1)), to: toIso(new Date(y, m + 1, 0)) };
  }
  if (presetId === 'last_month') {
    return { from: toIso(new Date(y, m - 1, 1)), to: toIso(new Date(y, m, 0)) };
  }
  if (presetId === 'this_fy') {
    const fyStartYr = m >= 3 ? y : y - 1;
    return { from: `${fyStartYr}-04-01`, to: `${fyStartYr + 1}-03-31` };
  }
  return { from: '', to: '' };
}

function txnTypeBadgeClass(type) {
  const t = String(type || '').toUpperCase();
  if (t.includes('SALES')) {
    return 'bg-[#E6F5EF] dark:bg-emerald-500/15 text-[#087A55] dark:text-emerald-400 border-[#087A55]/25 dark:border-emerald-500/30';
  }
  if (t.includes('PURCHASE') || t.includes('ASSET')) {
    return 'bg-indigo-50 dark:bg-indigo-500/15 text-[#3646C9] dark:text-indigo-400 border-[#3646C9]/25 dark:border-indigo-500/30';
  }
  if (t.includes('PAYMENT')) {
    return 'bg-sky-50 dark:bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-300 dark:border-sky-500/30';
  }
  if (t.includes('EXPENSE')) {
    return 'bg-[#FEF4E6] dark:bg-amber-500/15 text-[#8A5300] dark:text-amber-300 border-[#8A5300]/25 dark:border-amber-500/30';
  }
  return 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700';
}

function downloadCsv(filename, headers, rows) {
  const esc = (v) => {
    const s = v === null || v === undefined ? '' : String(v);
    const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
    return `"${safe.replace(/"/g, '""')}"`;
  };
  const csv = [headers.map(esc).join(','), ...rows.map((r) => r.map(esc).join(','))].join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function PartyLedgerAgingPage() {
  const navigate = useNavigate();
  const { company, fetchCompany } = useCompanyStore();
  const [viewMode, setViewMode] = useState('LEDGER'); // 'LEDGER' | 'AGING'

  // Parties & Searchable Combobox State
  const [parties, setParties] = useState([]);
  const [loadingParties, setLoadingParties] = useState(true);
  const [selectedPartyId, setSelectedPartyId] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [partySearch, setPartySearch] = useState('');
  const [partyTypeFilter, setPartyTypeFilter] = useState('ALL'); // 'ALL' | 'CUSTOMER' | 'SUPPLIER' | 'ACTIVE'
  const dropdownRef = useRef(null);
  const searchInputRef = useRef(null);

  // Ledger State
  const [ledgerData, setLedgerData] = useState(null);
  const [loadingLedger, setLoadingLedger] = useState(false);
  const [datePreset, setDatePreset] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [txnTypeFilter, setTxnTypeFilter] = useState('ALL');
  const [rowSearch, setRowSearch] = useState('');
  const [ledgerPage, setLedgerPage] = useState(1);
  const [ledgerPageSize, setLedgerPageSize] = useState(25);

  // Aging State
  const [agingDirection, setAgingDirection] = useState('PAYABLE');
  const [agingRows, setAgingRows] = useState([]);
  const [agingSummary, setAgingSummary] = useState({
    totalOutstanding: 0,
    currentDue: 0,
    bucket0_30: 0,
    bucket31_60: 0,
    bucket61_90: 0,
    bucket90Plus: 0
  });
  const [loadingAging, setLoadingAging] = useState(false);
  const [agingSearch, setAgingSearch] = useState('');
  const [agingRiskFilter, setAgingRiskFilter] = useState('ALL'); // 'ALL' | 'OVERDUE_30' | 'CRITICAL_90'
  const [agingPage, setAgingPage] = useState(1);
  const [agingPageSize, setAgingPageSize] = useState(25);

  const loadParties = useCallback(async () => {
    try {
      setLoadingParties(true);
      const res = await api.get('/finance/parties');
      if (res.data?.success) {
        const list = res.data.data || [];
        setParties(list);
        if (list.length > 0) {
          setSelectedPartyId((prev) => prev || list[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to load parties:', err);
    } finally {
      setLoadingParties(false);
    }
  }, []);

  const loadLedger = useCallback(async () => {
    if (viewMode !== 'LEDGER' || !selectedPartyId) return;
    try {
      setLoadingLedger(true);
      const params = new URLSearchParams();
      if (dateFrom) params.set('from', dateFrom);
      if (dateTo) params.set('to', dateTo);
      const qs = params.toString();
      const res = await api.get(`/finance/parties/${encodeURIComponent(selectedPartyId)}/ledger${qs ? `?${qs}` : ''}`);
      if (res.data?.success) {
        setLedgerData(res.data);
      }
    } catch (err) {
      console.error('Failed to load ledger:', err);
    } finally {
      setLoadingLedger(false);
    }
  }, [viewMode, selectedPartyId, dateFrom, dateTo]);

  const loadAging = useCallback(async () => {
    if (viewMode !== 'AGING') return;
    try {
      setLoadingAging(true);
      const res = await api.get(`/finance/aging?direction=${agingDirection}`);
      if (res.data?.success) {
        setAgingRows(res.data.data || []);
        setAgingSummary(res.data.summary || {
          totalOutstanding: 0,
          currentDue: 0,
          bucket0_30: 0,
          bucket31_60: 0,
          bucket61_90: 0,
          bucket90Plus: 0
        });
      }
    } catch (err) {
      console.error('Failed to load aging report:', err);
    } finally {
      setLoadingAging(false);
    }
  }, [viewMode, agingDirection]);

  useEffect(() => {
    const t = setTimeout(() => {
      loadParties();
      if (!company?.companyName) fetchCompany?.();
    }, 0);
    return () => clearTimeout(t);
  }, [loadParties, fetchCompany, company?.companyName]);

  useEffect(() => {
    const t = setTimeout(() => {
      loadLedger();
    }, 0);
    return () => clearTimeout(t);
  }, [loadLedger]);

  useEffect(() => {
    const t = setTimeout(() => {
      loadAging();
    }, 0);
    return () => clearTimeout(t);
  }, [loadAging]);

  // Close searchable party dropdown on click outside / Escape
  useEffect(() => {
    if (!dropdownOpen) return undefined;
    const handleOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    const handleKey = (e) => {
      if (e.key === 'Escape') setDropdownOpen(false);
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleKey);
    const focusTimer = setTimeout(() => searchInputRef.current?.focus(), 20);
    return () => {
      clearTimeout(focusTimer);
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleKey);
    };
  }, [dropdownOpen]);

  const selectedPartyObj = useMemo(
    () => parties.find((p) => p.id === selectedPartyId) || ledgerData?.party || null,
    [parties, selectedPartyId, ledgerData?.party]
  );

  // Filter parties by name, type, GSTIN, phone/customer number, email, address, party ID, bill refs, and bill names
  const filteredParties = useMemo(() => {
    const q = partySearch.trim().toLowerCase();
    return parties.filter((p) => {
      if (partyTypeFilter === 'CUSTOMER' && p.type !== 'CUSTOMER' && p.type !== 'BOTH') return false;
      if (partyTypeFilter === 'SUPPLIER' && p.type !== 'SUPPLIER' && p.type !== 'BOTH') return false;
      if (partyTypeFilter === 'ACTIVE' && (p.txns_count || 0) === 0 && Math.abs(p.closing_balance || 0) < 0.01) return false;
      if (!q) return true;
      const refsText = Array.isArray(p.bill_refs) ? p.bill_refs.join(' ') : '';
      const hay = `${p.name || ''} ${p.type || ''} ${p.phone || ''} ${p.gstin || ''} ${p.email || ''} ${p.address || ''} ${p.id || ''} ${refsText} ${p.bill_descriptions || ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [parties, partySearch, partyTypeFilter]);

  const partyCounts = useMemo(() => ({
    all: parties.length,
    customers: parties.filter((p) => p.type === 'CUSTOMER' || p.type === 'BOTH').length,
    suppliers: parties.filter((p) => p.type === 'SUPPLIER' || p.type === 'BOTH').length,
    active: parties.filter((p) => (p.txns_count || 0) > 0 || Math.abs(p.closing_balance || 0) >= 0.01).length
  }), [parties]);

  // Ledger available types & row filtering
  const availableTxnTypes = useMemo(() => {
    const rows = ledgerData?.ledger || [];
    return Array.from(new Set(rows.map((r) => r.txn_type).filter(Boolean))).sort();
  }, [ledgerData?.ledger]);

  const filteredLedgerRows = useMemo(() => {
    const rows = ledgerData?.ledger || [];
    const q = rowSearch.trim().toLowerCase();
    return rows.filter((r) => {
      if (txnTypeFilter !== 'ALL' && r.txn_type !== txnTypeFilter) return false;
      if (!q) return true;
      const hay = `${r.ref_no || ''} ${r.txn_type || ''} ${r.description || ''} ${r.debit || ''} ${r.credit || ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [ledgerData?.ledger, txnTypeFilter, rowSearch]);

  const ledgerTotalPages = Math.max(1, Math.ceil(filteredLedgerRows.length / ledgerPageSize));
  const safeLedgerPage = Math.min(ledgerPage, ledgerTotalPages);
  const paginatedLedgerRows = useMemo(() => {
    const start = (safeLedgerPage - 1) * ledgerPageSize;
    return filteredLedgerRows.slice(start, start + ledgerPageSize);
  }, [filteredLedgerRows, safeLedgerPage, ledgerPageSize]);

  // Aging filtering & pagination
  const filteredAgingRows = useMemo(() => {
    const q = agingSearch.trim().toLowerCase();
    return agingRows.filter((r) => {
      if (agingRiskFilter === 'OVERDUE_30') {
        if ((r.bucket_31_60 + r.bucket_61_90 + r.bucket_90_plus) <= 0.01) return false;
      } else if (agingRiskFilter === 'CRITICAL_90') {
        if (r.bucket_90_plus <= 0.01) return false;
      }
      if (!q) return true;
      const hay = `${r.party_name || ''} ${r.phone || ''} ${r.gstin || ''} ${r.email || ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [agingRows, agingSearch, agingRiskFilter]);

  const agingTotalPages = Math.max(1, Math.ceil(filteredAgingRows.length / agingPageSize));
  const safeAgingPage = Math.min(agingPage, agingTotalPages);
  const paginatedAgingRows = useMemo(() => {
    const start = (safeAgingPage - 1) * agingPageSize;
    return filteredAgingRows.slice(start, start + agingPageSize);
  }, [filteredAgingRows, safeAgingPage, agingPageSize]);

  const handlePresetClick = (presetId) => {
    setDatePreset(presetId);
    if (presetId !== 'custom') {
      const { from, to } = computePresetDates(presetId);
      setDateFrom(from);
      setDateTo(to);
      setLedgerPage(1);
    }
  };

  const handleSelectParty = (party) => {
    setSelectedPartyId(party.id);
    setDropdownOpen(false);
    setTxnTypeFilter('ALL');
    setRowSearch('');
    setLedgerPage(1);
  };

  const handleExportCsv = () => {
    const today = new Date().toISOString().slice(0, 10);
    if (viewMode === 'LEDGER' && selectedPartyObj) {
      downloadCsv(
        `party-ledger_${selectedPartyObj.name.replace(/[^A-Za-z0-9_-]+/g, '_')}_${today}.csv`,
        ['Date', 'Ref / Bill No', 'Type', 'Particulars', 'Debit (Dr)', 'Credit (Cr)', 'Running Balance'],
        filteredLedgerRows.map((r) => [
          formatBankDisplayDate(r.txn_date),
          r.ref_no || '',
          r.txn_type || '',
          r.description || '',
          r.debit || 0,
          r.credit || 0,
          `${Math.abs(r.running_balance || 0).toFixed(2)} ${(r.running_balance || 0) >= 0 ? 'Dr' : 'Cr'}`
        ])
      );
    } else if (viewMode === 'AGING') {
      downloadCsv(
        `aging-matrix_${agingDirection.toLowerCase()}_${today}.csv`,
        ['Party Name', 'Phone', 'GSTIN', 'Total Balance', 'Current (0d)', '1-30 Days', '31-60 Days', '61-90 Days', '90+ Days'],
        filteredAgingRows.map((r) => [
          r.party_name || '',
          r.phone || '',
          r.gstin || '',
          r.total_outstanding || 0,
          r.current_due || 0,
          r.bucket_0_30 || 0,
          r.bucket_31_60 || 0,
          r.bucket_61_90 || 0,
          r.bucket_90_plus || 0
        ])
      );
    }
  };

  const handleExportPdf = () => {
    if (viewMode === 'LEDGER' && ledgerData?.party) {
      exportPartyLedgerPdf({
        company,
        party: ledgerData.party,
        dateFrom,
        dateTo,
        openingBalance: ledgerData.openingBalance,
        totalDebit: ledgerData.totalDebit || 0,
        totalCredit: ledgerData.totalCredit || 0,
        closingBalance: ledgerData.closingBalance,
        rows: filteredLedgerRows
      });
    } else if (viewMode === 'AGING') {
      exportAgingPdf({
        company,
        direction: agingDirection,
        summary: agingSummary,
        rows: filteredAgingRows
      });
    }
  };

  const activeParty = ledgerData?.party || selectedPartyObj;
  const creditLimit = Number(activeParty?.credit_limit || 0);
  const absClosing = Math.abs(Number(ledgerData?.closingBalance || 0));
  const creditUtilPct = creditLimit > 0 ? Math.min(100, Math.round((absClosing / creditLimit) * 100)) : 0;

  return (
    <div className="min-h-screen w-full bg-[#F4F6FA] dark:bg-slate-950 text-[#14213D] dark:text-slate-100 transition-colors p-2 sm:p-2.5 text-xs">
      <div className="w-full space-y-2.5">
        {/* Executive Dark Top Header Bar */}
        <header className="bg-[#111A36] dark:bg-slate-900 dark:border dark:border-slate-800 text-white rounded-[14px] px-3.5 py-2.5 sm:px-4 sm:py-3 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-2.5 print:hidden">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center shrink-0">
              <Users className="w-4.5 h-4.5 text-emerald-300" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-sm sm:text-base font-black tracking-tight truncate">
                  Party Ledger &amp; Aging Analysis
                </h1>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-white/10 text-[10px] font-bold text-emerald-300 border border-white/15">
                  {parties.length} Parties Indexed
                </span>
              </div>
              <p className="text-[11px] text-slate-300/90 truncate hidden sm:block">
                Search customers &amp; suppliers by name, phone, GSTIN, or bill reference • Audit statements &amp; 30-60-90+ overdue matrix
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <div className="inline-flex rounded-xl border border-white/15 p-0.5 bg-white/10">
              <button
                type="button"
                onClick={() => setViewMode('LEDGER')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  viewMode === 'LEDGER'
                    ? 'bg-white text-[#111A36] shadow-xs'
                    : 'text-slate-200 hover:bg-white/10'
                }`}
              >
                Statement of Account
              </button>
              <button
                type="button"
                onClick={() => setViewMode('AGING')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  viewMode === 'AGING'
                    ? 'bg-white text-[#111A36] shadow-xs'
                    : 'text-slate-200 hover:bg-white/10'
                }`}
              >
                Aging Matrix (30-60-90+)
              </button>
            </div>

            <button
              type="button"
              onClick={handleExportCsv}
              className="h-8 px-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-emerald-300" />
              <span>Export CSV</span>
            </button>

            <button
              type="button"
              onClick={handleExportPdf}
              className="h-8 px-3 rounded-xl bg-[#3646C9] hover:bg-[#4657de] text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>PDF Statement</span>
            </button>

            <button
              type="button"
              onClick={() => window.print()}
              className="h-8 px-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print</span>
            </button>

            <button
              type="button"
              onClick={() => navigate('/finance/bank-statement')}
              className="h-8 px-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-white text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
            >
              <Landmark className="w-3.5 h-3.5" />
              <span className="hidden xl:inline">Bank</span>
            </button>

            <button
              type="button"
              onClick={() => navigate('/finance/gst')}
              className="h-8 px-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-white text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
            >
              <ReceiptIndianRupee className="w-3.5 h-3.5" />
              <span className="hidden xl:inline">GST</span>
            </button>
          </div>
        </header>

        {viewMode === 'LEDGER' ? (
          <div className="space-y-2.5">
            {/* Searchable Party Combobox + Quick Date & Row Filters */}
            <div className="bg-white dark:bg-slate-900 rounded-[14px] border border-[#CBD5E1] dark:border-slate-700 p-2.5 space-y-2.5 shadow-2xs print:hidden">
              <div className="flex flex-col xl:flex-row xl:items-center gap-2.5">
                {/* Smart Searchable Party Selector */}
                <div className="relative flex-1 min-w-[300px]" ref={dropdownRef}>
                  <button
                    type="button"
                    onClick={() => setDropdownOpen((o) => !o)}
                    aria-expanded={dropdownOpen}
                    className="w-full min-h-10 px-3 py-1.5 rounded-xl border border-[#CBD5E1] dark:border-slate-700 bg-[#F8FAFC] dark:bg-slate-950 hover:border-[#3646C9] dark:hover:border-indigo-500 text-left flex items-center justify-between gap-2 transition-colors cursor-pointer"
                  >
                    <div className="min-w-0 flex items-center gap-2 flex-wrap">
                      <Search className="w-4 h-4 text-[#3646C9] dark:text-indigo-400 shrink-0" />
                      {loadingParties ? (
                        <span className="text-slate-400 font-semibold">Loading parties &amp; bill refs...</span>
                      ) : selectedPartyObj ? (
                        <>
                          <span className="font-black text-[#14213D] dark:text-slate-100 truncate max-w-[260px] sm:max-w-[360px]">
                            {selectedPartyObj.name}
                          </span>
                          <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-black border ${
                            selectedPartyObj.type === 'CUSTOMER'
                              ? 'bg-[#E6F5EF] dark:bg-emerald-500/15 text-[#087A55] dark:text-emerald-400 border-[#087A55]/25 dark:border-emerald-500/30'
                              : 'bg-indigo-50 dark:bg-indigo-500/15 text-[#3646C9] dark:text-indigo-400 border-[#3646C9]/25 dark:border-indigo-500/30'
                          }`}>
                            {selectedPartyObj.type}
                          </span>
                          {selectedPartyObj.phone && (
                            <span className="text-[11px] font-mono text-slate-600 dark:text-slate-300">
                              {selectedPartyObj.phone}
                            </span>
                          )}
                          {selectedPartyObj.gstin && (
                            <span className="text-[10.5px] font-mono text-slate-500 dark:text-slate-400 hidden sm:inline">
                              • {selectedPartyObj.gstin}
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="text-slate-400 font-semibold">Select supplier or customer...</span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {selectedPartyObj && (
                        <span className={`text-[11px] font-mono font-black hidden md:inline ${
                          (selectedPartyObj.closing_balance || 0) > 0
                            ? 'text-[#B4232F] dark:text-rose-400'
                            : 'text-[#087A55] dark:text-emerald-400'
                        }`}>
                          {formatINR(Math.abs(selectedPartyObj.closing_balance || 0))}{' '}
                          {(selectedPartyObj.closing_balance || 0) >= 0 ? 'Dr' : 'Cr'}
                        </span>
                      )}
                      <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
                    </div>
                  </button>

                  {dropdownOpen && (
                    <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-40 rounded-2xl border border-[#CBD5E1] dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden">
                      {/* Search Bar Inside Dropdown */}
                      <div className="p-2.5 border-b border-[#E2E8F0] dark:border-slate-800 bg-[#F8FAFC] dark:bg-slate-950/80 space-y-2">
                        <div className="relative">
                          <Search className="w-4 h-4 text-[#3646C9] dark:text-indigo-400 absolute left-3 top-1/2 -translate-y-1/2" />
                          <input
                            ref={searchInputRef}
                            type="text"
                            value={partySearch}
                            onChange={(e) => setPartySearch(e.target.value)}
                            placeholder="Search by party name, customer/phone no, GSTIN, bill/PO no (PO-000017), bill name, or address..."
                            className="w-full h-9 pl-9 pr-8 rounded-xl border border-[#CBD5E1] dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-[#14213D] dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#3646C9]/30"
                          />
                          {partySearch && (
                            <button
                              type="button"
                              onClick={() => setPartySearch('')}
                              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-1.5">
                          <div className="flex flex-wrap items-center gap-1">
                            {[
                              { id: 'ALL', label: `All (${partyCounts.all})` },
                              { id: 'CUSTOMER', label: `Customers (${partyCounts.customers})` },
                              { id: 'SUPPLIER', label: `Suppliers (${partyCounts.suppliers})` },
                              { id: 'ACTIVE', label: `With Activity (${partyCounts.active})` }
                            ].map((tab) => (
                              <button
                                key={tab.id}
                                type="button"
                                onClick={() => setPartyTypeFilter(tab.id)}
                                className={`px-2.5 py-1 rounded-lg text-[10.5px] font-bold transition-colors cursor-pointer ${
                                  partyTypeFilter === tab.id
                                    ? 'bg-[#3646C9] text-white'
                                    : 'bg-white dark:bg-slate-900 border border-[#E2E8F0] dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-[#EEF2F8] dark:hover:bg-slate-800'
                                }`}
                              >
                                {tab.label}
                              </button>
                            ))}
                          </div>
                          <span className="text-[10.5px] font-semibold text-slate-500 dark:text-slate-400">
                            {filteredParties.length} match(es)
                          </span>
                        </div>
                      </div>

                      {/* Searchable Options List */}
                      <div className="max-h-80 overflow-y-auto divide-y divide-[#E2E8F0] dark:divide-slate-800">
                        {filteredParties.length === 0 ? (
                          <div className="py-8 text-center text-slate-400 dark:text-slate-400">
                            No parties or bill references match &ldquo;{partySearch}&rdquo;.
                          </div>
                        ) : (
                          filteredParties.slice(0, 120).map((p) => {
                            const isSelected = p.id === selectedPartyId;
                            const bills = Array.isArray(p.bill_refs) ? p.bill_refs : [];
                            return (
                              <button
                                key={p.id}
                                type="button"
                                onClick={() => handleSelectParty(p)}
                                className={`w-full px-3 py-2 text-left transition-colors flex items-start justify-between gap-3 cursor-pointer ${
                                  isSelected
                                    ? 'bg-indigo-50/90 dark:bg-indigo-950/60'
                                    : 'hover:bg-[#F3F6FB] dark:hover:bg-slate-800/80'
                                }`}
                              >
                                <div className="min-w-0 flex-1 space-y-1">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    {isSelected && <Check className="w-3.5 h-3.5 text-[#3646C9] dark:text-indigo-400 shrink-0" />}
                                    <span className="font-black text-[#14213D] dark:text-slate-100 text-xs">{p.name}</span>
                                    <span className={`px-1.5 py-0.2 rounded text-[9.5px] font-black border ${
                                      p.type === 'CUSTOMER'
                                        ? 'bg-[#E6F5EF] dark:bg-emerald-500/15 text-[#087A55] dark:text-emerald-400 border-[#087A55]/25 dark:border-emerald-500/30'
                                        : 'bg-indigo-50 dark:bg-indigo-500/15 text-[#3646C9] dark:text-indigo-400 border-[#3646C9]/25 dark:border-indigo-500/30'
                                    }`}>
                                      {p.type}
                                    </span>
                                    {p.txns_count > 0 && (
                                      <span className="px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-[9.5px] font-bold text-slate-600 dark:text-slate-300">
                                        {p.txns_count} txn(s)
                                      </span>
                                    )}
                                  </div>

                                  <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10.5px] text-slate-500 dark:text-slate-400">
                                    {p.phone && <span className="font-mono text-slate-700 dark:text-slate-200">📞 {p.phone}</span>}
                                    {p.gstin && <span className="font-mono">GSTIN: {p.gstin}</span>}
                                    {p.address && <span className="truncate max-w-[320px]">📍 {p.address}</span>}
                                    {!p.phone && !p.gstin && !p.address && <span className="font-mono text-[10px]">ID: {p.id}</span>}
                                  </div>

                                  {bills.length > 0 && (
                                    <div className="flex flex-wrap items-center gap-1 pt-0.5">
                                      <span className="text-[9.5px] font-bold uppercase text-slate-400">Bills / Refs:</span>
                                      {bills.slice(0, 5).map((b) => (
                                        <span
                                          key={b}
                                          className="px-1.5 py-0.2 rounded bg-white dark:bg-slate-800 border border-[#CBD5E1] dark:border-slate-700 font-mono text-[9.5px] font-bold text-[#14213D] dark:text-slate-200"
                                        >
                                          {b}
                                        </span>
                                      ))}
                                      {bills.length > 5 && (
                                        <span className="text-[9.5px] font-bold text-[#3646C9] dark:text-indigo-400">
                                          +{bills.length - 5} more
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </div>

                                <div className="text-right shrink-0">
                                  <div className={`font-mono font-black text-xs tabular-nums ${
                                    p.closing_balance > 0
                                      ? 'text-[#B4232F] dark:text-rose-400'
                                      : p.closing_balance < 0
                                        ? 'text-[#087A55] dark:text-emerald-400'
                                        : 'text-slate-500 dark:text-slate-400'
                                  }`}>
                                    {formatINR(Math.abs(p.closing_balance || 0))}
                                  </div>
                                  <div className="text-[9.5px] font-bold text-slate-400">
                                    {(p.closing_balance || 0) >= 0 ? 'Dr' : 'Cr'} Balance
                                  </div>
                                </div>
                              </button>
                            );
                          })
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Date Preset Pills + Custom Date Pickers */}
                <div className="flex flex-wrap items-center gap-1.5">
                  {DATE_PRESETS.map((pr) => (
                    <button
                      key={pr.id}
                      type="button"
                      onClick={() => handlePresetClick(pr.id)}
                      className={`h-8 px-2.5 rounded-lg text-[11px] font-bold border transition-colors cursor-pointer ${
                        datePreset === pr.id
                          ? 'bg-[#3646C9] border-[#3646C9] text-white'
                          : 'bg-[#F8FAFC] dark:bg-slate-800 border-[#E2E8F0] dark:border-slate-700 text-[#14213D] dark:text-slate-200 hover:bg-[#EEF2F8] dark:hover:bg-slate-700'
                      }`}
                    >
                      {pr.label}
                    </button>
                  ))}

                  <input
                    type="date"
                    value={dateFrom}
                    aria-label="From Date"
                    onChange={(e) => { setDatePreset('custom'); setDateFrom(e.target.value); setLedgerPage(1); }}
                    className="h-8 px-2 rounded-lg border border-[#CBD5E1] dark:border-slate-700 bg-white dark:bg-slate-950 font-mono text-[11px]"
                  />
                  <span className="text-slate-400 font-bold">–</span>
                  <input
                    type="date"
                    value={dateTo}
                    aria-label="To Date"
                    onChange={(e) => { setDatePreset('custom'); setDateTo(e.target.value); setLedgerPage(1); }}
                    className="h-8 px-2 rounded-lg border border-[#CBD5E1] dark:border-slate-700 bg-white dark:bg-slate-950 font-mono text-[11px]"
                  />
                </div>
              </div>

              {/* Secondary Filter Strip: Txn Type & Bill/Particular Search */}
              <div className="flex flex-wrap items-center gap-2 pt-1.5 border-t border-[#E2E8F0] dark:border-slate-800">
                <select
                  value={txnTypeFilter}
                  onChange={(e) => { setTxnTypeFilter(e.target.value); setLedgerPage(1); }}
                  aria-label="Filter by Transaction Type"
                  className="h-8 px-2.5 rounded-lg border border-[#CBD5E1] dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-bold text-[#14213D] dark:text-slate-100 cursor-pointer"
                >
                  <option value="ALL">All Document Types</option>
                  {availableTxnTypes.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>

                <div className="relative flex-1 min-w-[200px]">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={rowSearch}
                    onChange={(e) => { setRowSearch(e.target.value); setLedgerPage(1); }}
                    placeholder="Filter ledger lines by Bill / PO / SO number, particulars, or amount..."
                    className="h-8 w-full pl-8 pr-2.5 rounded-lg border border-[#CBD5E1] dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-medium text-[#14213D] dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#3646C9]/30"
                  />
                </div>

                {(txnTypeFilter !== 'ALL' || rowSearch || dateFrom || dateTo) && (
                  <button
                    type="button"
                    onClick={() => {
                      setTxnTypeFilter('ALL');
                      setRowSearch('');
                      handlePresetClick('all');
                    }}
                    className="h-8 px-2.5 rounded-lg border border-[#CBD5E1] dark:border-slate-700 hover:bg-[#EEF2F8] dark:hover:bg-slate-800 text-[11px] font-bold text-[#3646C9] dark:text-indigo-400 cursor-pointer"
                  >
                    Reset Filters
                  </button>
                )}
              </div>
            </div>

            {/* Selected Party Profile & 5 KPI Summary Cards */}
            {activeParty && (
              <div className="space-y-2.5">
                <div className="bg-white dark:bg-slate-900 rounded-[14px] border border-[#CBD5E1] dark:border-slate-700 px-3.5 py-2.5 shadow-2xs flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Building2 className="w-4 h-4 text-[#3646C9] dark:text-indigo-400 shrink-0" />
                      <h2 className="text-sm font-black text-[#14213D] dark:text-white">{activeParty.name}</h2>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-black border ${
                        activeParty.type === 'CUSTOMER'
                          ? 'bg-[#E6F5EF] dark:bg-emerald-500/15 text-[#087A55] dark:text-emerald-400 border-[#087A55]/25 dark:border-emerald-500/30'
                          : 'bg-indigo-50 dark:bg-indigo-500/15 text-[#3646C9] dark:text-indigo-400 border-[#3646C9]/25 dark:border-indigo-500/30'
                      }`}>
                        {activeParty.type}
                      </span>
                      <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                        GSTIN: <strong className="text-[#14213D] dark:text-slate-200">{activeParty.gstin || 'Unregistered'}</strong>
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-600 dark:text-slate-300">
                      <span className="inline-flex items-center gap-1">
                        <Phone className="w-3 h-3 text-slate-400" />
                        <span className="font-mono">{activeParty.phone || 'No phone'}</span>
                      </span>
                      {activeParty.email && (
                        <span className="inline-flex items-center gap-1">
                          <Mail className="w-3 h-3 text-slate-400" />
                          <span>{activeParty.email}</span>
                        </span>
                      )}
                      {activeParty.address && (
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                          <span className="truncate max-w-[420px]">{activeParty.address}</span>
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-4 shrink-0 border-t lg:border-t-0 lg:border-l border-[#E2E8F0] dark:border-slate-800 pt-2 lg:pt-0 lg:pl-4">
                    <div>
                      <div className="text-[10px] font-bold uppercase text-slate-400">Credit Terms</div>
                      <div className="font-bold text-[#14213D] dark:text-slate-100">
                        {activeParty.credit_days || 0} days • Limit {formatINR(creditLimit)}
                      </div>
                    </div>
                    {creditLimit > 0 && (
                      <div className="w-28">
                        <div className="flex justify-between text-[10px] font-bold mb-0.5">
                          <span className="text-slate-400">Limit Used</span>
                          <span className={creditUtilPct >= 90 ? 'text-[#B4232F] dark:text-rose-400' : 'text-[#3646C9] dark:text-indigo-400'}>
                            {creditUtilPct}%
                          </span>
                        </div>
                        <div className="h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${creditUtilPct >= 90 ? 'bg-[#B4232F]' : 'bg-[#3646C9]'}`}
                            style={{ width: `${creditUtilPct}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* 5 Summary KPI Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
                  <div className="bg-white dark:bg-slate-900 rounded-[14px] border border-[#CBD5E1] dark:border-slate-700 px-3 py-2 border-t-2 border-t-slate-400">
                    <div className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400">Opening Balance</div>
                    <div className="text-base font-black font-mono tabular-nums text-[#14213D] dark:text-slate-100 mt-0.5">
                      {formatINR(Math.abs(ledgerData?.openingBalance || 0))}{' '}
                      <span className="text-xs font-bold">{(ledgerData?.openingBalance || 0) >= 0 ? 'Dr' : 'Cr'}</span>
                    </div>
                  </div>
                  <div className="bg-white dark:bg-slate-900 rounded-[14px] border border-[#CBD5E1] dark:border-slate-700 px-3 py-2 border-t-2 border-t-[#B4232F]">
                    <div className="text-[10px] font-bold uppercase text-[#B4232F] dark:text-rose-400">Period Debit (Dr)</div>
                    <div className="text-base font-black font-mono tabular-nums text-[#B4232F] dark:text-rose-400 mt-0.5">
                      {formatINR(ledgerData?.totalDebit || 0)}
                    </div>
                  </div>
                  <div className="bg-white dark:bg-slate-900 rounded-[14px] border border-[#CBD5E1] dark:border-slate-700 px-3 py-2 border-t-2 border-t-[#087A55]">
                    <div className="text-[10px] font-bold uppercase text-[#087A55] dark:text-emerald-400">Period Credit (Cr)</div>
                    <div className="text-base font-black font-mono tabular-nums text-[#087A55] dark:text-emerald-400 mt-0.5">
                      {formatINR(ledgerData?.totalCredit || 0)}
                    </div>
                  </div>
                  <div className="bg-white dark:bg-slate-900 rounded-[14px] border border-[#CBD5E1] dark:border-slate-700 px-3 py-2 border-t-2 border-t-[#3646C9]">
                    <div className="text-[10px] font-bold uppercase text-[#3646C9] dark:text-indigo-400">Statement Lines</div>
                    <div className="text-base font-black font-mono tabular-nums text-[#3646C9] dark:text-indigo-400 mt-0.5">
                      {filteredLedgerRows.length}
                    </div>
                  </div>
                  <div className="bg-white dark:bg-slate-900 rounded-[14px] border border-[#CBD5E1] dark:border-slate-700 px-3 py-2 border-t-2 border-t-amber-500 col-span-2 sm:col-span-1">
                    <div className="text-[10px] font-bold uppercase text-[#EA580C] dark:text-amber-300">Net Closing Balance</div>
                    <div className={`text-base font-black font-mono tabular-nums mt-0.5 ${
                      (ledgerData?.closingBalance || 0) > 0
                        ? 'text-[#B4232F] dark:text-rose-400'
                        : 'text-[#087A55] dark:text-emerald-400'
                    }`}>
                      {formatINR(Math.abs(ledgerData?.closingBalance || 0))}{' '}
                      <span className="text-xs font-bold">{(ledgerData?.closingBalance || 0) >= 0 ? 'Dr' : 'Cr'}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Statement of Account Gridded Zebra Table */}
            <div className="bg-white dark:bg-slate-900 rounded-[14px] border border-[#CBD5E1] dark:border-slate-700 overflow-hidden shadow-xs">
              <div className="overflow-x-auto max-h-[62vh]">
                <table className="w-full text-left border-collapse [&_th]:border-r [&_th]:border-[#CBD5E1] dark:border-slate-700 [&_th:last-child]:border-r-0 [&_td]:border-r [&_td]:border-[#E2E8F0] dark:border-slate-800 [&_td:last-child]:border-r-0">
                  <thead className="sticky top-0 z-10 bg-[#EEF2F8] dark:bg-slate-800/95 border-b-2 border-[#CBD5E1] dark:border-slate-700 text-[10.5px] font-bold uppercase text-[#14213D] dark:text-slate-100">
                    <tr>
                      <th className="py-2 px-2.5 whitespace-nowrap">Date</th>
                      <th className="py-2 px-2.5 whitespace-nowrap">Ref / Bill No</th>
                      <th className="py-2 px-2.5 whitespace-nowrap">Doc Type</th>
                      <th className="py-2 px-2.5">Particulars / Description</th>
                      <th className="py-2 px-2.5 text-right whitespace-nowrap">Debit (Dr)</th>
                      <th className="py-2 px-2.5 text-right whitespace-nowrap">Credit (Cr)</th>
                      <th className="py-2 px-2.5 text-right whitespace-nowrap">Running Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E3E8F0] dark:divide-slate-800 text-xs text-[#14213D] dark:text-slate-100">
                    {loadingLedger ? (
                      <tr>
                        <td colSpan={7} className="py-12 text-center text-slate-400">
                          <Loader2 className="w-5 h-5 animate-spin mx-auto mb-1.5 text-[#3646C9] dark:text-indigo-400" />
                          Loading statement of account...
                        </td>
                      </tr>
                    ) : paginatedLedgerRows.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-12 text-center text-slate-400">
                          No transactions recorded for this party matching the selected filters.
                        </td>
                      </tr>
                    ) : (
                      paginatedLedgerRows.map((row, idx) => (
                        <tr
                          key={`${row.ref_no}-${row.txn_date}-${idx}`}
                          className={`transition-colors hover:bg-[#E8EEFA]/75 dark:hover:bg-slate-800/90 ${
                            idx % 2 === 0 ? 'bg-white dark:bg-slate-900' : 'bg-[#F3F6FB] dark:bg-slate-800/45'
                          }`}
                        >
                          <td className="py-2 px-2.5 font-mono whitespace-nowrap text-[11.5px] text-slate-600 dark:text-slate-300">
                            {formatBankDisplayDate(row.txn_date)}
                          </td>
                          <td className="py-2 px-2.5 font-mono font-bold whitespace-nowrap text-[#14213D] dark:text-slate-100">
                            {row.ref_no || '—'}
                          </td>
                          <td className="py-2 px-2.5 whitespace-nowrap">
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold border ${txnTypeBadgeClass(row.txn_type)}`}>
                              {row.txn_type}
                            </span>
                          </td>
                          <td className="py-2 px-2.5 text-slate-700 dark:text-slate-200 break-words">
                            {row.description || '—'}
                          </td>
                          <td className="py-2 px-2.5 text-right font-mono tabular-nums font-bold text-[#B4232F] dark:text-rose-400 whitespace-nowrap">
                            {row.debit > 0 ? formatINR(row.debit) : '—'}
                          </td>
                          <td className="py-2 px-2.5 text-right font-mono tabular-nums font-bold text-[#087A55] dark:text-emerald-400 whitespace-nowrap">
                            {row.credit > 0 ? formatINR(row.credit) : '—'}
                          </td>
                          <td className="py-2 px-2.5 text-right font-mono tabular-nums font-black whitespace-nowrap">
                            {formatINR(Math.abs(row.running_balance))}{' '}
                            <span className={`text-[10px] font-extrabold ${
                              row.running_balance >= 0 ? 'text-[#B4232F] dark:text-rose-400' : 'text-[#087A55] dark:text-emerald-400'
                            }`}>
                              {row.running_balance >= 0 ? 'Dr' : 'Cr'}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  <tfoot className="sticky bottom-0 z-10 bg-[#EEF2F8] dark:bg-slate-800/95 border-t-2 border-[#CBD5E1] dark:border-slate-700 text-xs font-black text-[#14213D] dark:text-slate-100">
                    <tr>
                      <td colSpan={4} className="py-2 px-2.5 uppercase tracking-wide">
                        PERIOD TOTAL ({filteredLedgerRows.length} ENTRIES)
                      </td>
                      <td className="py-2 px-2.5 text-right font-mono tabular-nums text-[#B4232F] dark:text-rose-400 whitespace-nowrap">
                        {formatINR(ledgerData?.totalDebit || 0)}
                      </td>
                      <td className="py-2 px-2.5 text-right font-mono tabular-nums text-[#087A55] dark:text-emerald-400 whitespace-nowrap">
                        {formatINR(ledgerData?.totalCredit || 0)}
                      </td>
                      <td className="py-2 px-2.5 text-right font-mono tabular-nums whitespace-nowrap">
                        {formatINR(Math.abs(ledgerData?.closingBalance || 0))}{' '}
                        {(ledgerData?.closingBalance || 0) >= 0 ? 'Dr' : 'Cr'}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              <BankStatementPagination
                page={safeLedgerPage}
                totalPages={ledgerTotalPages}
                totalItems={filteredLedgerRows.length}
                pageSize={ledgerPageSize}
                onPageChange={(next) => setLedgerPage(next)}
                onPageSizeChange={(nextSize) => { setLedgerPageSize(nextSize); setLedgerPage(1); }}
                itemLabel="entries"
              />
            </div>
          </div>
        ) : (
          /* ================= AGING MATRIX (30-60-90+) VIEW ================= */
          <div className="space-y-2.5">
            {/* Aging Controls Bar */}
            <div className="bg-white dark:bg-slate-900 rounded-[14px] border border-[#CBD5E1] dark:border-slate-700 p-2.5 flex flex-wrap items-center justify-between gap-2 shadow-2xs print:hidden">
              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex rounded-xl border border-[#CBD5E1] dark:border-slate-700 p-0.5 bg-[#F4F6FA] dark:bg-slate-800">
                  <button
                    type="button"
                    onClick={() => { setAgingDirection('PAYABLE'); setAgingPage(1); }}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                      agingDirection === 'PAYABLE'
                        ? 'bg-[#3646C9] text-white shadow-2xs'
                        : 'text-[#14213D] dark:text-slate-200 hover:bg-white/60 dark:hover:bg-slate-700'
                    }`}
                  >
                    Accounts Payable (Suppliers)
                  </button>
                  <button
                    type="button"
                    onClick={() => { setAgingDirection('RECEIVABLE'); setAgingPage(1); }}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                      agingDirection === 'RECEIVABLE'
                        ? 'bg-[#087A55] text-white shadow-2xs'
                        : 'text-[#14213D] dark:text-slate-200 hover:bg-white/60 dark:hover:bg-slate-700'
                    }`}
                  >
                    Accounts Receivable (Customers)
                  </button>
                </div>

                <select
                  value={agingRiskFilter}
                  onChange={(e) => { setAgingRiskFilter(e.target.value); setAgingPage(1); }}
                  aria-label="Filter by Overdue Bucket"
                  className="h-8 px-2.5 rounded-lg border border-[#CBD5E1] dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-bold text-[#14213D] dark:text-slate-100 cursor-pointer"
                >
                  <option value="ALL">All Outstanding Balances</option>
                  <option value="OVERDUE_30">Overdue 30+ Days</option>
                  <option value="CRITICAL_90">Critical 90+ Days</option>
                </select>
              </div>

              <div className="relative flex-1 min-w-[220px] max-w-md">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={agingSearch}
                  onChange={(e) => { setAgingSearch(e.target.value); setAgingPage(1); }}
                  placeholder="Search party name, phone, or GSTIN..."
                  className="h-8 w-full pl-8 pr-2.5 rounded-lg border border-[#CBD5E1] dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-medium text-[#14213D] dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#3646C9]/30"
                />
              </div>
            </div>

            {/* Aging 6 Summary KPI Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
              <div className="bg-white dark:bg-slate-900 rounded-[14px] border border-[#CBD5E1] dark:border-slate-700 px-3 py-2 border-t-2 border-t-[#3646C9]">
                <div className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400">Total Outstanding</div>
                <div className="text-base font-black font-mono tabular-nums text-[#14213D] dark:text-slate-100 mt-0.5">
                  {formatINR(agingSummary.totalOutstanding)}
                </div>
              </div>
              <div className="bg-white dark:bg-slate-900 rounded-[14px] border border-[#CBD5E1] dark:border-slate-700 px-3 py-2 border-t-2 border-t-[#087A55]">
                <div className="text-[10px] font-bold uppercase text-[#087A55] dark:text-emerald-400">Current (0d)</div>
                <div className="text-base font-black font-mono tabular-nums text-[#087A55] dark:text-emerald-400 mt-0.5">
                  {formatINR(agingSummary.currentDue)}
                </div>
              </div>
              <div className="bg-white dark:bg-slate-900 rounded-[14px] border border-[#CBD5E1] dark:border-slate-700 px-3 py-2 border-t-2 border-t-sky-500">
                <div className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400">1–30 Days</div>
                <div className="text-base font-black font-mono tabular-nums text-[#14213D] dark:text-slate-100 mt-0.5">
                  {formatINR(agingSummary.bucket0_30)}
                </div>
              </div>
              <div className="bg-white dark:bg-slate-900 rounded-[14px] border border-[#CBD5E1] dark:border-slate-700 px-3 py-2 border-t-2 border-t-amber-500">
                <div className="text-[10px] font-bold uppercase text-[#8A5300] dark:text-amber-300">31–60 Days</div>
                <div className="text-base font-black font-mono tabular-nums text-[#8A5300] dark:text-amber-300 mt-0.5">
                  {formatINR(agingSummary.bucket31_60)}
                </div>
              </div>
              <div className="bg-white dark:bg-slate-900 rounded-[14px] border border-[#CBD5E1] dark:border-slate-700 px-3 py-2 border-t-2 border-t-orange-600">
                <div className="text-[10px] font-bold uppercase text-[#EA580C] dark:text-orange-400">61–90 Days</div>
                <div className="text-base font-black font-mono tabular-nums text-[#EA580C] dark:text-orange-400 mt-0.5">
                  {formatINR(agingSummary.bucket61_90)}
                </div>
              </div>
              <div className="bg-white dark:bg-slate-900 rounded-[14px] border border-[#CBD5E1] dark:border-slate-700 px-3 py-2 border-t-2 border-t-[#B4232F]">
                <div className="text-[10px] font-bold uppercase text-[#B4232F] dark:text-rose-400">90+ Days Overdue</div>
                <div className="text-base font-black font-mono tabular-nums text-[#B4232F] dark:text-rose-400 mt-0.5">
                  {formatINR(agingSummary.bucket90Plus)}
                </div>
              </div>
            </div>

            {/* Aging Gridded Zebra Table */}
            <div className="bg-white dark:bg-slate-900 rounded-[14px] border border-[#CBD5E1] dark:border-slate-700 overflow-hidden shadow-xs">
              <div className="overflow-x-auto max-h-[64vh]">
                <table className="w-full text-left border-collapse [&_th]:border-r [&_th]:border-[#CBD5E1] dark:border-slate-700 [&_th:last-child]:border-r-0 [&_td]:border-r [&_td]:border-[#E2E8F0] dark:border-slate-800 [&_td:last-child]:border-r-0">
                  <thead className="sticky top-0 z-10 bg-[#EEF2F8] dark:bg-slate-800/95 border-b-2 border-[#CBD5E1] dark:border-slate-700 text-[10.5px] font-bold uppercase text-[#14213D] dark:text-slate-100">
                    <tr>
                      <th className="py-2 px-2.5">Party / Contact</th>
                      <th className="py-2 px-2.5 text-right whitespace-nowrap">Total Balance</th>
                      <th className="py-2 px-2.5 text-right whitespace-nowrap">Current (0d)</th>
                      <th className="py-2 px-2.5 text-right whitespace-nowrap">1–30 Days</th>
                      <th className="py-2 px-2.5 text-right whitespace-nowrap">31–60 Days</th>
                      <th className="py-2 px-2.5 text-right whitespace-nowrap">61–90 Days</th>
                      <th className="py-2 px-2.5 text-right text-[#B4232F] dark:text-rose-400 whitespace-nowrap">90+ Days</th>
                      <th className="py-2 px-2.5 text-center whitespace-nowrap print:hidden">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E3E8F0] dark:divide-slate-800 text-xs text-[#14213D] dark:text-slate-100">
                    {loadingAging ? (
                      <tr>
                        <td colSpan={8} className="py-12 text-center text-slate-400">
                          <Loader2 className="w-5 h-5 animate-spin mx-auto mb-1.5 text-[#3646C9] dark:text-indigo-400" />
                          Calculating aging brackets...
                        </td>
                      </tr>
                    ) : paginatedAgingRows.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-12 text-center text-slate-400">
                          No outstanding balances match this filter.
                        </td>
                      </tr>
                    ) : (
                      paginatedAgingRows.map((r, idx) => (
                        <tr
                          key={`${r.party_name}-${idx}`}
                          className={`transition-colors hover:bg-[#E8EEFA]/75 dark:hover:bg-slate-800/90 ${
                            idx % 2 === 0 ? 'bg-white dark:bg-slate-900' : 'bg-[#F3F6FB] dark:bg-slate-800/45'
                          }`}
                        >
                          <td className="py-2 px-2.5">
                            <div className="font-black text-[#14213D] dark:text-white">{r.party_name}</div>
                            {(r.phone || r.gstin) && (
                              <div className="text-[10.5px] font-mono text-slate-500 dark:text-slate-400">
                                {[r.phone, r.gstin].filter(Boolean).join(' • ')}
                              </div>
                            )}
                          </td>
                          <td className="py-2 px-2.5 text-right font-mono tabular-nums font-black whitespace-nowrap">
                            {formatINR(r.total_outstanding)}
                          </td>
                          <td className="py-2 px-2.5 text-right font-mono tabular-nums text-[#087A55] dark:text-emerald-400 font-semibold whitespace-nowrap">
                            {formatINR(r.current_due)}
                          </td>
                          <td className="py-2 px-2.5 text-right font-mono tabular-nums whitespace-nowrap">
                            {formatINR(r.bucket_0_30)}
                          </td>
                          <td className="py-2 px-2.5 text-right font-mono tabular-nums text-[#8A5300] dark:text-amber-300 font-semibold whitespace-nowrap">
                            {formatINR(r.bucket_31_60)}
                          </td>
                          <td className="py-2 px-2.5 text-right font-mono tabular-nums text-[#EA580C] dark:text-orange-400 font-semibold whitespace-nowrap">
                            {formatINR(r.bucket_61_90)}
                          </td>
                          <td className="py-2 px-2.5 text-right font-mono tabular-nums font-black text-[#B4232F] dark:text-rose-400 whitespace-nowrap">
                            {formatINR(r.bucket_90_plus)}
                          </td>
                          <td className="py-2 px-2.5 text-center whitespace-nowrap print:hidden">
                            {r.party_id ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedPartyId(r.party_id);
                                  setViewMode('LEDGER');
                                  setLedgerPage(1);
                                }}
                                className="px-2.5 py-1 rounded-lg bg-[#3646C9] hover:bg-[#2b39ab] text-white text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer"
                              >
                                <span>Ledger</span>
                                <ArrowUpRight className="w-3 h-3" />
                              </button>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  <tfoot className="sticky bottom-0 z-10 bg-[#EEF2F8] dark:bg-slate-800/95 border-t-2 border-[#CBD5E1] dark:border-slate-700 text-xs font-black text-[#14213D] dark:text-slate-100">
                    <tr>
                      <td className="py-2 px-2.5 uppercase tracking-wide">
                        TOTAL ({filteredAgingRows.length} PARTIES)
                      </td>
                      <td className="py-2 px-2.5 text-right font-mono tabular-nums whitespace-nowrap">
                        {formatINR(agingSummary.totalOutstanding)}
                      </td>
                      <td className="py-2 px-2.5 text-right font-mono tabular-nums text-[#087A55] dark:text-emerald-400 whitespace-nowrap">
                        {formatINR(agingSummary.currentDue)}
                      </td>
                      <td className="py-2 px-2.5 text-right font-mono tabular-nums whitespace-nowrap">
                        {formatINR(agingSummary.bucket0_30)}
                      </td>
                      <td className="py-2 px-2.5 text-right font-mono tabular-nums text-[#8A5300] dark:text-amber-300 whitespace-nowrap">
                        {formatINR(agingSummary.bucket31_60)}
                      </td>
                      <td className="py-2 px-2.5 text-right font-mono tabular-nums text-[#EA580C] dark:text-orange-400 whitespace-nowrap">
                        {formatINR(agingSummary.bucket61_90)}
                      </td>
                      <td className="py-2 px-2.5 text-right font-mono tabular-nums text-[#B4232F] dark:text-rose-400 whitespace-nowrap">
                        {formatINR(agingSummary.bucket90Plus)}
                      </td>
                      <td className="py-2 px-2.5 print:hidden" />
                    </tr>
                  </tfoot>
                </table>
              </div>

              <BankStatementPagination
                page={safeAgingPage}
                totalPages={agingTotalPages}
                totalItems={filteredAgingRows.length}
                pageSize={agingPageSize}
                onPageChange={(next) => setAgingPage(next)}
                onPageSizeChange={(nextSize) => { setAgingPageSize(nextSize); setAgingPage(1); }}
                itemLabel="parties"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
