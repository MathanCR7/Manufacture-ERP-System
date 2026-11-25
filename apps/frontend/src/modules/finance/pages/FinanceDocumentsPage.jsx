import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import { api } from '@/lib/axios';
import { formatINR, formatDate, renderPaymentStatusChip, renderFulfilmentChip } from '@/utils/financeFormatters';
import { 
  FileText, Search, Filter, RefreshCw, Download, 
  CreditCard, ChevronRight, Layers, ArrowUpDown, CheckSquare, 
  AlertTriangle, ShoppingCart, HardDrive, DollarSign, Package,
  ExternalLink, ChevronLeft, ChevronsLeft, ChevronsRight, Eye
} from 'lucide-react';
import DocumentDetailDrawer from '../components/DocumentDetailDrawer';
import RecordPaymentModal from '../components/RecordPaymentModal';

export default function FinanceDocumentsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();

  // Read initial values from URL query parameters
  const initialStatus = searchParams.get('status') || 'ALL';
  const initialType = searchParams.get('type') || 'ALL';
  const initialDirection = searchParams.get('direction') || 'ALL';
  const initialParty = searchParams.get('party_id') || '';
  const initialSearch = searchParams.get('search') || '';
  const initialPage = parseInt(searchParams.get('page') || '1', 10);
  const initialLimit = parseInt(searchParams.get('limit') || '25', 10);
  const initialSortBy = searchParams.get('sortBy') || 'doc_date';
  const initialSortDir = searchParams.get('sortDir') || 'DESC';

  const [activeTab, setActiveTab] = useState(initialType);
  const [directionFilter, setDirectionFilter] = useState(initialDirection); // ALL, PAYABLE, RECEIVABLE
  const [statusFilter, setStatusFilter] = useState(initialStatus); // ALL, UNPAID, ADVANCE_PAID, PARTIALLY_PAID, PAID, OVERDUE, OVERPAID
  const [partyFilter, setPartyFilter] = useState(initialParty);
  const [parties, setParties] = useState([]);
  
  const [searchInput, setSearchInput] = useState(initialSearch);
  const [activeSearch, setActiveSearch] = useState(initialSearch);
  const [page, setPage] = useState(initialPage > 0 ? initialPage : 1);
  const [limit, setLimit] = useState(initialLimit > 0 ? initialLimit : 25);
  const [sortBy, setSortBy] = useState(initialSortBy);
  const [sortDir, setSortDir] = useState(initialSortDir);

  const [documents, setDocuments] = useState([]);
  const [summary, setSummary] = useState(null);
  const [meta, setMeta] = useState({ total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(false);

  // Modals & Drawers
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentModalDoc, setPaymentModalDoc] = useState(null);

  // Sync state if URL query params change externally (e.g. user clicks a link with ?status=OVERDUE)
  useEffect(() => {
    const urlStatus = searchParams.get('status');
    if (urlStatus && urlStatus !== statusFilter) {
      setStatusFilter(urlStatus);
    }
    const urlType = searchParams.get('type');
    if (urlType && urlType !== activeTab) {
      setActiveTab(urlType);
    }
    const urlDir = searchParams.get('direction');
    if (urlDir && urlDir !== directionFilter) {
      setDirectionFilter(urlDir);
    }
    const urlParty = searchParams.get('party_id');
    if (urlParty !== null && urlParty !== partyFilter) {
      setPartyFilter(urlParty);
    }
    const urlSearch = searchParams.get('search');
    if (urlSearch !== null && urlSearch !== activeSearch) {
      setActiveSearch(urlSearch);
      setSearchInput(urlSearch);
    }
    const urlPage = parseInt(searchParams.get('page') || '0', 10);
    if (urlPage > 0 && urlPage !== page) {
      setPage(urlPage);
    }
    const urlLimit = parseInt(searchParams.get('limit') || '0', 10);
    if (urlLimit > 0 && urlLimit !== limit) {
      setLimit(urlLimit);
    }
  }, [searchParams]);

  // Update URL search parameters when filters or pagination change
  const updateQueryParams = useCallback((updates) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      Object.entries(updates).forEach(([key, val]) => {
        if (val === undefined || val === null || val === '' || val === 'ALL') {
          next.delete(key);
        } else {
          next.set(key, String(val));
        }
      });
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  // Load parties for dropdown filter
  useEffect(() => {
    api.get('/finance/parties')
      .then(res => {
        if (res.data?.success) setParties(res.data.data || []);
      })
      .catch(console.error);
  }, []);

  // Fetch financial documents from API
  const fetchDocuments = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({
      type: activeTab,
      status: statusFilter,
      direction: directionFilter !== 'ALL' ? directionFilter : '',
      party_id: partyFilter,
      search: activeSearch.trim(),
      page: String(page),
      limit: String(limit),
      sortBy,
      sortDir
    });

    api.get(`/finance/documents?${params.toString()}`)
      .then(res => {
        if (res.data?.success) {
          setDocuments(res.data.data || []);
          setSummary(res.data.summary);
          setMeta(res.data.meta || { total: 0, totalPages: 1 });
        }
      })
      .catch(err => {
        console.error('Error fetching finance documents:', err);
      })
      .finally(() => setLoading(false));
  }, [activeTab, directionFilter, statusFilter, partyFilter, activeSearch, page, limit, sortBy, sortDir]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  // Filter change handlers
  const handleTabChange = (newTab) => {
    setActiveTab(newTab);
    setPage(1);
    updateQueryParams({ type: newTab, page: 1 });
  };

  const handleStatusChange = (newStatus) => {
    setStatusFilter(newStatus);
    setPage(1);
    updateQueryParams({ status: newStatus, page: 1 });
  };

  const handleDirectionChange = (newDir) => {
    setDirectionFilter(newDir);
    setPage(1);
    updateQueryParams({ direction: newDir, page: 1 });
  };

  const handlePartyChange = (newParty) => {
    setPartyFilter(newParty);
    setPage(1);
    updateQueryParams({ party_id: newParty, page: 1 });
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setActiveSearch(searchInput);
    setPage(1);
    updateQueryParams({ search: searchInput.trim(), page: 1 });
  };

  const handlePageChange = (newPage) => {
    if (newPage < 1 || newPage > (meta.totalPages || 1)) return;
    setPage(newPage);
    updateQueryParams({ page: newPage });
  };

  const handleLimitChange = (newLimit) => {
    setLimit(newLimit);
    setPage(1);
    updateQueryParams({ limit: newLimit, page: 1 });
  };

  const handleSortToggle = (col) => {
    let newDir = 'DESC';
    if (sortBy === col) {
      newDir = sortDir === 'DESC' ? 'ASC' : 'DESC';
    }
    setSortBy(col);
    setSortDir(newDir);
    updateQueryParams({ sortBy: col, sortDir: newDir });
  };

  // Helper to get target URL for original document
  const getOriginalDocumentUrl = (doc) => {
    if (!doc) return '#';
    const docId = doc.doc_id;
    switch (doc.doc_type) {
      case 'PURCHASE_ORDER':
        return `/purchase-orders/${docId}`;
      case 'ASSET_PO':
        return `/asset-management/orders?id=${docId}`;
      case 'EXPENSE':
        return `/finance/expenses?search=${encodeURIComponent(doc.doc_no || '')}`;
      case 'SALES_ORDER':
        return `/sales/orders?search=${encodeURIComponent(doc.doc_no || '')}`;
      case 'SALES_INVOICE':
        return `/sales/billing?invoiceId=${docId}`;
      default:
        return '#';
    }
  };

  /**
   * KEY ACTION: Redirect directly to the original page with ID and auto-trigger payment settlement
   */
  const handlePayRedirect = (doc, e) => {
    if (e) e.stopPropagation();
    if (!doc) return;

    const docId = doc.doc_id;
    const docNo = doc.doc_no;
    const docType = doc.doc_type;

    switch (docType) {
      case 'PURCHASE_ORDER':
        // Redirect directly to the PO detail page with action=payment & openPayment state
        navigate(`/purchase-orders/${docId}?action=payment`, {
          state: {
            openPayment: true,
            fromFinance: true,
            docId,
            docNo,
            balance: doc.balance,
            grandTotal: doc.grand_total,
            partyName: doc.party_name
          }
        });
        break;

      case 'ASSET_PO':
        navigate(`/asset-management/orders?id=${docId}&action=payment`, {
          state: { openPayment: true, docId, docNo, fromFinance: true }
        });
        break;

      case 'EXPENSE':
        navigate(`/finance/expenses?id=${docId}&action=payment&search=${encodeURIComponent(docNo || '')}`, {
          state: { openPayment: true, docId, docNo, fromFinance: true }
        });
        break;

      case 'SALES_ORDER':
        navigate(`/sales/orders?id=${docId}&search=${encodeURIComponent(docNo || '')}&action=payment`, {
          state: { openPayment: true, docId, docNo, fromFinance: true }
        });
        break;

      case 'SALES_INVOICE':
        navigate(`/sales/billing?invoiceId=${docId}&action=payment`, {
          state: { openPayment: true, docId, docNo, fromFinance: true }
        });
        break;

      default:
        // Fallback to in-app payment modal
        setPaymentModalDoc(doc);
        setIsPaymentModalOpen(true);
        break;
    }
  };

  const handleRowClick = (doc) => {
    setSelectedDoc(doc);
    setIsDetailOpen(true);
  };

  const handleExportCSV = () => {
    if (!documents || documents.length === 0) return;
    const headers = ['Doc No', 'Type', 'Date', 'Due Date', 'Party', 'Direction', 'Subtotal', 'Tax', 'Grand Total', 'Paid', 'Balance', 'Status', 'Overdue'];
    const rows = documents.map(d => [
      d.doc_no,
      d.doc_type,
      d.doc_date,
      d.due_date,
      `"${(d.party_name || '').replace(/"/g, '""')}"`,
      d.direction,
      d.subtotal,
      Number(d.tax_cgst || 0) + Number(d.tax_sgst || 0) + Number(d.tax_igst || 0),
      d.grand_total,
      d.paid_amount,
      d.balance,
      d.payment_status,
      d.is_overdue ? 'YES' : 'NO'
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Finance_Documents_${activeTab}_${statusFilter}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const tabs = [
    { id: 'ALL', label: 'All Documents', icon: Layers },
    { id: 'PURCHASE_ORDER', label: 'Raw Material POs', icon: ShoppingCart },
    { id: 'ASSET_PO', label: 'Capital Asset POs', icon: HardDrive },
    { id: 'EXPENSE', label: 'Operating Expenses', icon: DollarSign },
    { id: 'SALES_ORDER', label: 'Sales Orders', icon: Package }
  ];

  // Smart numbered pagination items generator
  const paginationRange = useMemo(() => {
    const totalPages = meta.totalPages || 1;
    const current = page;
    const delta = 2;
    const range = [];
    const rangeWithDots = [];
    let l;

    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || (i >= current - delta && i <= current + delta)) {
        range.push(i);
      }
    }

    for (let i of range) {
      if (l) {
        if (i - l === 2) {
          rangeWithDots.push(l + 1);
        } else if (i - l !== 1) {
          rangeWithDots.push('...');
        }
      }
      rangeWithDots.push(i);
      l = i;
    }

    return rangeWithDots;
  }, [meta.totalPages, page]);

  const recordStart = meta.total === 0 ? 0 : (page - 1) * limit + 1;
  const recordEnd = Math.min(page * limit, meta.total);

  return (
    <div className="p-4 sm:p-6 space-y-4 max-w-7xl mx-auto">
      {/* Page Title & Top Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
              <FileText className="w-6 h-6 text-primary" />
              Financial Documents & Ledger
            </h1>
            {statusFilter === 'OVERDUE' && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-black uppercase tracking-wider bg-rose-100 text-rose-700 dark:bg-rose-950/70 dark:text-rose-300 border border-rose-300 dark:border-rose-800 animate-pulse flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                Overdue Filter Active
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Real-time unified tracking of Payables, Receivables, Taxes, and Payment Allocations
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setPaymentModalDoc(null);
              setIsPaymentModalOpen(true);
            }}
            className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-all shadow-sm flex items-center gap-1.5"
          >
            <CreditCard className="w-4 h-4" />
            General Payment Entry
          </button>
          <button
            onClick={handleExportCSV}
            className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 font-semibold text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>
        </div>
      </div>

      {/* KPI / Aggregate Summary Banner */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs">
          <div>
            <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Total Billed</div>
            <div className="text-base font-black text-slate-900 dark:text-white mt-0.5">
              {formatINR(summary.totalBilled)}
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Tax (CGST+SGST+IGST)</div>
            <div className="text-base font-extrabold text-slate-700 dark:text-slate-300 mt-0.5">
              {formatINR(summary.totalTax)}
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Settled / Paid</div>
            <div className="text-base font-black text-emerald-600 mt-0.5">
              {formatINR(summary.totalPaid)}
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Advance Paid</div>
            <div className="text-base font-black text-blue-600 mt-0.5">
              {formatINR(summary.totalAdvance)}
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Balance Outstanding</div>
            <div className="text-base font-black text-rose-600 mt-0.5">
              {formatINR(summary.totalBalance)}
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 overflow-x-auto gap-2 text-xs font-semibold">
        {tabs.map(tab => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`flex items-center gap-1.5 py-2.5 px-3 border-b-2 font-bold whitespace-nowrap transition-colors ${
                active
                  ? 'border-primary text-primary dark:text-primary-400'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 text-xs">
        <form onSubmit={handleSearchSubmit} className="flex-1 min-w-[200px] max-w-sm relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search by Doc No, Vendor or Customer..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="w-full h-8 pl-8 pr-2.5 rounded-md border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-xs"
          />
        </form>

        <div className="flex flex-wrap items-center gap-2">
          {/* Status Chip Filter */}
          <select
            value={statusFilter}
            onChange={(e) => handleStatusChange(e.target.value)}
            className={`h-8 px-2.5 rounded-md border text-xs font-bold transition-colors ${
              statusFilter === 'OVERDUE'
                ? 'border-rose-400 bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800'
                : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900'
            }`}
          >
            <option value="ALL">All Statuses</option>
            <option value="OVERDUE">⚠️ Overdue Only</option>
            <option value="UNPAID">🔴 Unpaid</option>
            <option value="ADVANCE_PAID">🔵 Advance Paid</option>
            <option value="PARTIALLY_PAID">🟡 Partially Paid</option>
            <option value="PAID">🟢 Paid</option>
            <option value="OVERPAID">🟣 Overpaid</option>
          </select>

          {/* Party Dropdown */}
          <select
            value={partyFilter}
            onChange={(e) => handlePartyChange(e.target.value)}
            className="h-8 px-2.5 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs max-w-[180px]"
          >
            <option value="">All Parties</option>
            {parties.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>

          {/* Direction Filter */}
          <div className="flex rounded-md border border-slate-300 dark:border-slate-700 p-0.5 bg-slate-100 dark:bg-slate-800 text-[11px]">
            <button
              onClick={() => handleDirectionChange('ALL')}
              className={`px-2 py-0.5 rounded font-bold transition-all ${
                directionFilter === 'ALL' ? 'bg-white dark:bg-slate-900 shadow-2xs text-slate-900 dark:text-white' : 'text-slate-500'
              }`}
            >
              All
            </button>
            <button
              onClick={() => handleDirectionChange('PAYABLE')}
              className={`px-2 py-0.5 rounded font-bold transition-all ${
                directionFilter === 'PAYABLE' ? 'bg-white dark:bg-slate-900 shadow-2xs text-rose-600' : 'text-slate-500'
              }`}
            >
              Payable
            </button>
            <button
              onClick={() => handleDirectionChange('RECEIVABLE')}
              className={`px-2 py-0.5 rounded font-bold transition-all ${
                directionFilter === 'RECEIVABLE' ? 'bg-white dark:bg-slate-900 shadow-2xs text-emerald-600' : 'text-slate-500'
              }`}
            >
              Receivable
            </button>
          </div>

          {/* Page Size Limit Selector */}
          <select
            value={limit}
            onChange={(e) => handleLimitChange(Number(e.target.value))}
            className="h-8 px-2 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold"
            title="Rows per page"
          >
            <option value={10}>10 / page</option>
            <option value={25}>25 / page</option>
            <option value={50}>50 / page</option>
            <option value={100}>100 / page</option>
          </select>

          <button
            onClick={fetchDocuments}
            title="Refresh Ledger"
            className="p-1.5 rounded-md border border-slate-300 dark:border-slate-700 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-2xs text-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 dark:bg-slate-950/70 border-b border-slate-200 dark:border-slate-800 text-[11px] uppercase font-bold text-slate-500 tracking-wider select-none">
              <tr>
                <th className="py-2.5 px-3 cursor-pointer hover:text-slate-800" onClick={() => handleSortToggle('doc_no')}>
                  <div className="flex items-center gap-1">
                    <span>Doc No</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th className="py-2.5 px-2 cursor-pointer hover:text-slate-800" onClick={() => handleSortToggle('doc_date')}>
                  <div className="flex items-center gap-1">
                    <span>Date</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th className="py-2.5 px-3 cursor-pointer hover:text-slate-800" onClick={() => handleSortToggle('party_name')}>
                  <div className="flex items-center gap-1">
                    <span>Party / Counterparty</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th className="py-2.5 px-2 text-right">Subtotal</th>
                <th className="py-2.5 px-2 text-right">GST</th>
                <th className="py-2.5 px-2 text-right cursor-pointer hover:text-slate-800" onClick={() => handleSortToggle('grand_total')}>
                  <div className="flex items-center justify-end gap-1">
                    <span>Grand Total</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th className="py-2.5 px-2 text-right cursor-pointer hover:text-slate-800" onClick={() => handleSortToggle('paid_amount')}>
                  <div className="flex items-center justify-end gap-1">
                    <span>Paid</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th className="py-2.5 px-2 text-right cursor-pointer hover:text-slate-800" onClick={() => handleSortToggle('balance')}>
                  <div className="flex items-center justify-end gap-1">
                    <span>Balance</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th className="py-2.5 px-2 text-center">Progress</th>
                <th className="py-2.5 px-2">Fulfilment</th>
                <th className="py-2.5 px-3">Payment Status</th>
                <th className="py-2.5 px-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {loading && documents.length === 0 ? (
                <tr>
                  <td colSpan={12} className="py-12 text-center text-slate-400">
                    <RefreshCw className="w-5 h-5 mx-auto animate-spin mb-2 text-primary" />
                    Loading financial ledger documents...
                  </td>
                </tr>
              ) : documents.length === 0 ? (
                <tr>
                  <td colSpan={12} className="py-12 text-center text-slate-400">
                    <AlertTriangle className="w-6 h-6 mx-auto mb-1 text-slate-400" />
                    No documents matching the active criteria found.
                  </td>
                </tr>
              ) : (
                documents.map((doc) => {
                  const grandTotal = Number(doc.grand_total) || 0;
                  const paidAmount = Number(doc.paid_amount) || 0;
                  const balance = Number(doc.balance) || 0;
                  const progress = Math.min(100, Math.round((paidAmount / Math.max(1, grandTotal)) * 100));
                  const isSettleable = balance > 1;

                  return (
                    <tr 
                      key={`${doc.doc_type}-${doc.doc_id}`}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors group cursor-pointer"
                      onClick={() => handleRowClick(doc)}
                    >
                      <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-white">
                        <div className="flex items-center gap-1.5">
                          <span className="text-primary hover:underline">{doc.doc_no}</span>
                          <a
                            href={getOriginalDocumentUrl(doc)}
                            onClick={(e) => e.stopPropagation()}
                            title={`Open original ${doc.doc_type} page`}
                            className="text-slate-400 hover:text-primary transition-colors p-0.5 rounded opacity-60 group-hover:opacity-100"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        </div>
                      </td>
                      <td className="py-2.5 px-2 text-slate-500 whitespace-nowrap">
                        <div>{formatDate(doc.doc_date)}</div>
                        {doc.due_date && (
                          <div className={`text-[10px] ${doc.is_overdue ? 'text-rose-600 font-bold' : 'text-slate-400'}`}>
                            Due: {formatDate(doc.due_date)}
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 px-3 font-medium text-slate-800 dark:text-slate-200 max-w-[200px] truncate" title={doc.party_name}>
                        {doc.party_name}
                      </td>
                      <td className="py-2.5 px-2 text-right text-slate-600 dark:text-slate-400 font-mono">
                        {formatINR(doc.subtotal)}
                      </td>
                      <td className="py-2.5 px-2 text-right text-slate-600 dark:text-slate-400 font-mono">
                        {formatINR(Number(doc.tax_cgst || 0) + Number(doc.tax_sgst || 0) + Number(doc.tax_igst || 0))}
                      </td>
                      <td className="py-2.5 px-2 text-right font-extrabold text-slate-900 dark:text-white font-mono">
                        {formatINR(doc.grand_total)}
                      </td>
                      <td className="py-2.5 px-2 text-right font-bold text-emerald-600 font-mono">
                        {formatINR(doc.paid_amount)}
                      </td>
                      <td className="py-2.5 px-2 text-right font-extrabold font-mono text-rose-600">
                        {formatINR(doc.balance)}
                      </td>
                      <td className="py-2.5 px-2 text-center">
                        <div className="w-14 mx-auto bg-slate-200 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${progress === 100 ? 'bg-emerald-500' : progress > 0 ? 'bg-amber-500' : 'bg-transparent'}`}
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono">{progress}%</span>
                      </td>
                      <td className="py-2.5 px-2 whitespace-nowrap">
                        {renderFulfilmentChip(doc.fulfilment_status)}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        {renderPaymentStatusChip(doc.payment_status, doc.is_overdue, doc.overdue_days)}
                      </td>
                      <td className="py-2.5 px-3 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1.5">
                          {isSettleable ? (
                            <button
                              type="button"
                              onClick={(e) => handlePayRedirect(doc, e)}
                              title="Go to original page and settle payment with live synchronization"
                              className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-[11px] shadow-sm transition-all flex items-center gap-1 active:scale-95"
                            >
                              <CreditCard className="w-3 h-3" />
                              Pay
                            </button>
                          ) : (
                            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                              Settled
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => handleRowClick(doc)}
                            title="Inspect document ledger & timeline drawer"
                            className="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Rich Interactive Pagination Footer */}
        <div className="px-4 py-3 bg-slate-50 dark:bg-slate-950/60 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-slate-500">
            <span>
              Showing <strong className="text-slate-800 dark:text-slate-200">{recordStart}</strong> to{' '}
              <strong className="text-slate-800 dark:text-slate-200">{recordEnd}</strong> of{' '}
              <strong className="text-slate-800 dark:text-slate-200">{meta.total}</strong> documents
            </span>
          </div>

          <div className="flex items-center gap-1">
            {/* First Page */}
            <button
              disabled={page <= 1}
              onClick={() => handlePageChange(1)}
              title="First Page"
              className="p-1.5 rounded border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none transition-colors"
            >
              <ChevronsLeft className="w-3.5 h-3.5 text-slate-600 dark:text-slate-300" />
            </button>

            {/* Previous Page */}
            <button
              disabled={page <= 1}
              onClick={() => handlePageChange(page - 1)}
              title="Previous Page"
              className="px-2 py-1 rounded border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none transition-colors flex items-center gap-1 font-semibold text-slate-700 dark:text-slate-300"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Prev</span>
            </button>

            {/* Smart Numbered Pages */}
            <div className="hidden sm:flex items-center gap-1 mx-1">
              {paginationRange.map((item, idx) => {
                if (item === '...') {
                  return (
                    <span key={`dots-${idx}`} className="px-1 text-slate-400 select-none">
                      ...
                    </span>
                  );
                }
                const isCurrent = item === page;
                return (
                  <button
                    key={`page-${item}`}
                    onClick={() => handlePageChange(item)}
                    className={`min-w-[28px] h-7 px-2 rounded font-bold transition-all text-xs ${
                      isCurrent
                        ? 'bg-primary text-white shadow-2xs font-extrabold'
                        : 'border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {item}
                  </button>
                );
              })}
            </div>

            {/* Current Page Indicator on mobile */}
            <span className="sm:hidden px-2 font-bold text-slate-700 dark:text-slate-300">
              {page} / {meta.totalPages || 1}
            </span>

            {/* Next Page */}
            <button
              disabled={page >= (meta.totalPages || 1)}
              onClick={() => handlePageChange(page + 1)}
              title="Next Page"
              className="px-2 py-1 rounded border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none transition-colors flex items-center gap-1 font-semibold text-slate-700 dark:text-slate-300"
            >
              <span>Next</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>

            {/* Last Page */}
            <button
              disabled={page >= (meta.totalPages || 1)}
              onClick={() => handlePageChange(meta.totalPages || 1)}
              title="Last Page"
              className="p-1.5 rounded border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none transition-colors"
            >
              <ChevronsRight className="w-3.5 h-3.5 text-slate-600 dark:text-slate-300" />
            </button>
          </div>
        </div>
      </div>

      {/* Document Detail Drawer */}
      <DocumentDetailDrawer
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        doc={selectedDoc}
        onRecordPayment={(d) => handlePayRedirect(d)}
        onRefresh={fetchDocuments}
      />

      {/* General Record Payment Modal */}
      <RecordPaymentModal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        onSuccess={fetchDocuments}
        initialDoc={paymentModalDoc}
      />
    </div>
  );
}
