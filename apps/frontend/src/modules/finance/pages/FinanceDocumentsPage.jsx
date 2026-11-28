import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import { api } from '@/lib/axios';
import { formatINR, formatDate, renderPaymentStatusChip, renderFulfilmentChip } from '@/utils/financeFormatters';
import { exportToExcel, exportToPDF, exportToCSV } from '@/utils/reportExportUtils';
import SearchSelect from '@/components/ui/SearchSelect';
import { 
  FileText, Search, Filter, RefreshCw, Download, 
  CreditCard, ChevronRight, Layers, ArrowUpDown, ArrowUp, ArrowDown, CheckSquare, 
  AlertTriangle, ShoppingCart, HardDrive, DollarSign, Package,
  ExternalLink, ChevronLeft, ChevronsLeft, ChevronsRight, Eye,
  Printer, FileSpreadsheet, CheckCircle2, Clock, X, SlidersHorizontal,
  Building2, Calendar, ShieldCheck, ArrowRight
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
  const [isExporting, setIsExporting] = useState(false);

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
    setPartyFilter(newParty || '');
    setPage(1);
    updateQueryParams({ party_id: newParty || '', page: 1 });
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setActiveSearch(searchInput);
    setPage(1);
    updateQueryParams({ search: searchInput.trim(), page: 1 });
  };

  const handleClearSearch = () => {
    setSearchInput('');
    setActiveSearch('');
    setPage(1);
    updateQueryParams({ search: '', page: 1 });
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

  const renderSortIndicator = (col) => {
    if (sortBy !== col) return <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-60 group-hover:opacity-100" />;
    return sortDir === 'ASC' 
      ? <ArrowUp className="w-3 h-3 text-primary font-bold" />
      : <ArrowDown className="w-3 h-3 text-primary font-bold" />;
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
        return `/finance/expenses?id=${docId}&search=${encodeURIComponent(doc.doc_no || '')}`;
      case 'SALES_ORDER':
        return `/sales/orders?id=${docId}&search=${encodeURIComponent(doc.doc_no || '')}`;
      case 'SALES_INVOICE':
        return `/sales/billing?invoiceId=${docId}`;
      default:
        return '#';
    }
  };

  /**
   * VIEW ACTION: Redirect to the respective page (Asset, PO, Sales, Expense)
   */
  const handleViewRedirect = (doc, e) => {
    if (e) e.stopPropagation();
    if (!doc) return;
    const url = getOriginalDocumentUrl(doc);
    navigate(url, { state: { fromFinance: true, docId: doc.doc_id, docNo: doc.doc_no } });
  };

  /**
   * PAY ACTION: Redirect directly to the original page with ID and auto-trigger payment settlement
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
        setPaymentModalDoc(doc);
        setIsPaymentModalOpen(true);
        break;
    }
  };

  const handleRowClick = (doc) => {
    setSelectedDoc(doc);
    setIsDetailOpen(true);
  };

  // Prepare normalized export data
  const getNormalizedExportRows = useCallback(() => {
    if (!documents || documents.length === 0) return [];
    return documents.map(d => ({
      'Doc No': d.doc_no || '',
      'Document Type': d.doc_type || '',
      'Date': formatDate(d.doc_date),
      'Due Date': d.due_date ? formatDate(d.due_date) : 'N/A',
      'Party / Vendor': d.party_name || '',
      'Direction': d.direction || '',
      'Subtotal (₹)': Number(d.subtotal || 0),
      'CGST (₹)': Number(d.tax_cgst || 0),
      'SGST (₹)': Number(d.tax_sgst || 0),
      'IGST (₹)': Number(d.tax_igst || 0),
      'Total GST (₹)': Number(d.tax_cgst || 0) + Number(d.tax_sgst || 0) + Number(d.tax_igst || 0),
      'Grand Total (₹)': Number(d.grand_total || 0),
      'Paid Amount (₹)': Number(d.paid_amount || 0),
      'Balance Outstanding (₹)': Number(d.balance || 0),
      'Payment Status': (d.payment_status || 'UNPAID').replace(/_/g, ' '),
      'Fulfilment Status': d.fulfilment_status || 'PENDING',
      'Is Overdue': d.is_overdue ? `YES (${d.overdue_days || 0} days)` : 'NO'
    }));
  }, [documents]);

  /**
   * EXCEL EXPORT (.xlsx)
   */
  const handleExportExcel = () => {
    const rows = getNormalizedExportRows();
    if (!rows.length) {
      alert('No documents available to export.');
      return;
    }

    const columns = Object.keys(rows[0]).map(key => ({
      header: key,
      key: key
    }));

    const statusSuffix = statusFilter !== 'ALL' ? `_${statusFilter}` : '';
    const filename = `Finance_Documents_${activeTab}${statusSuffix}`;
    exportToExcel(filename, 'Finance Ledger', columns, rows);
  };

  /**
   * PDF EXPORT (.pdf)
   */
  const handleDownloadPDF = () => {
    if (!documents || documents.length === 0) {
      alert('No documents available to export.');
      return;
    }

    const columns = [
      { header: 'Doc No', key: 'doc_no' },
      { header: 'Date', key: 'doc_date', accessor: (d) => formatDate(d.doc_date) },
      { header: 'Due Date', key: 'due_date', accessor: (d) => d.due_date ? formatDate(d.due_date) : '—' },
      { header: 'Party / Counterparty', key: 'party_name' },
      { header: 'Grand Total', key: 'grand_total', accessor: (d) => formatINR(d.grand_total) },
      { header: 'Paid', key: 'paid_amount', accessor: (d) => formatINR(d.paid_amount) },
      { header: 'Balance', key: 'balance', accessor: (d) => formatINR(d.balance) },
      { header: 'Payment Status', key: 'payment_status', accessor: (d) => `${d.payment_status || 'UNPAID'}${d.is_overdue ? ' (OVERDUE)' : ''}` }
    ];

    const summaryCards = summary ? [
      { label: 'Total Billed', value: formatINR(summary.totalBilled) },
      { label: 'GST Tax', value: formatINR(summary.totalTax) },
      { label: 'Settled / Paid', value: formatINR(summary.totalPaid) },
      { label: 'Balance Outstanding', value: formatINR(summary.totalBalance) }
    ] : [];

    const statusLabel = statusFilter !== 'ALL' ? `Status: ${statusFilter}` : 'All Statuses';
    const typeLabel = activeTab !== 'ALL' ? `Type: ${activeTab}` : 'All Document Types';
    const subtitle = `Filter: ${typeLabel} | ${statusLabel} | Direction: ${directionFilter} | Records: ${documents.length}`;

    exportToPDF({
      title: 'Financial Documents & Ledger Report',
      subtitle,
      columns,
      data: documents,
      summaryCards,
      companyName: 'Manufacturing ERP — Finance'
    });
  };

  /**
   * PRINT REPORT (Print Dialog with Dedicated Print Layout)
   */
  const handlePrint = () => {
    window.print();
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

  // Normalize parties options for SearchSelect component
  const partySelectOptions = useMemo(() => {
    return [
      { value: '', label: 'All Parties / Counterparties', subLabel: 'Show all vendors & customers' },
      ...parties.map(p => ({
        value: p.id,
        label: p.name,
        subLabel: `${p.type || 'PARTY'}${p.gstin ? ` • ${p.gstin}` : ''}`
      }))
    ];
  }, [parties]);

  return (
    <div className="w-full px-2.5 sm:px-3.5 py-2.5 space-y-3 font-sans">
      {/* ── PRINT-ONLY STYLES ── */}
      <style>{`
        @media print {
          nav, aside, header, .no-print, button, input, select, .action-cell {
            display: none !important;
          }
          body {
            background: white !important;
            color: black !important;
            font-size: 10pt !important;
          }
          .print-header {
            display: block !important;
            margin-bottom: 16px !important;
          }
          table {
            width: 100% !important;
            border-collapse: collapse !important;
          }
          th, td {
            border: 1px solid #cbd5e1 !important;
            padding: 4px 6px !important;
            font-size: 8pt !important;
          }
          thead {
            background-color: #f1f5f9 !important;
            -webkit-print-color-adjust: exact;
          }
          .kpi-container {
            display: grid !important;
            grid-template-columns: repeat(4, 1fr) !important;
            gap: 8px !important;
            margin-bottom: 12px !important;
          }
        }
        @media screen {
          .print-header {
            display: none;
          }
        }
      `}</style>

      {/* Print-Only Header Banner */}
      <div className="print-header border-b pb-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">Manufacturing ERP — Financial Ledger Report</h1>
            <p className="text-xs text-gray-500">
              Active Filter: {activeTab} | Status: {statusFilter} | Direction: {directionFilter}
            </p>
          </div>
          <div className="text-right text-xs text-gray-500">
            <p>Printed: {new Date().toLocaleString('en-IN')}</p>
            <p>Total Records: {meta.total}</p>
          </div>
        </div>
      </div>

      {/* ── TOP HEADER & ACTION BUTTONS ── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 no-print">
        <div>
          <div className="flex flex-wrap items-center gap-2">
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
            {statusFilter === 'UNPAID' && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-black uppercase tracking-wider bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                🔴 Unpaid Filter Active
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Unified multi-ledger tracking of Payables, Receivables, Taxes, and Payment Allocations
          </p>
        </div>

        {/* Action Controls: Print, Excel, PDF, General Payment */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Print Report */}
          <button
            type="button"
            onClick={handlePrint}
            title="Print printable summary with active filters"
            className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 font-bold text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-1.5 shadow-2xs active:scale-95 cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5 text-slate-600 dark:text-slate-300" />
            <span>Print Report</span>
          </button>

          {/* Download PDF */}
          <button
            type="button"
            onClick={handleDownloadPDF}
            title="Download formatted PDF report"
            className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 font-bold text-xs text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors flex items-center gap-1.5 shadow-2xs active:scale-95 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
            <span>Download PDF</span>
          </button>

          {/* Export Excel */}
          <button
            type="button"
            onClick={handleExportExcel}
            title="Export full financial ledger to Microsoft Excel (.xlsx)"
            className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 font-bold text-xs text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-colors flex items-center gap-1.5 shadow-2xs active:scale-95 cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>Export Excel</span>
          </button>

          {/* General Payment Entry */}
          <button
            type="button"
            onClick={() => {
              setPaymentModalDoc(null);
              setIsPaymentModalOpen(true);
            }}
            className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-all shadow-sm flex items-center gap-1.5 active:scale-95 cursor-pointer"
          >
            <CreditCard className="w-4 h-4" />
            <span>General Payment</span>
          </button>
        </div>
      </div>

      {/* ── KPI / AGGREGATE SUMMARY BANNER ── */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs kpi-container">
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
            <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Advance Held</div>
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

      {/* ── TABS ── */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 overflow-x-auto gap-2 text-xs font-semibold no-print">
        {tabs.map(tab => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`flex items-center gap-1.5 py-2.5 px-3 border-b-2 font-bold whitespace-nowrap transition-colors cursor-pointer ${
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

      {/* ── ADVANCED RESPONSIVE FILTER TOOLBAR ── */}
      <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-3 no-print">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5 items-center">
          
          {/* 1. Global Search with Clear Button (Span 4 cols) */}
          <div className="md:col-span-4 relative">
            <form onSubmit={handleSearchSubmit} className="relative w-full">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Search Doc No, Vendor, Customer..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="w-full h-9 pl-9 pr-8 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-xs font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
              />
              {searchInput && (
                <button
                  type="button"
                  onClick={handleClearSearch}
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 rounded cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </form>
          </div>

          {/* 2. Searchable Combobox for Parties / Counterparties (Span 4 cols) */}
          <div className="md:col-span-4 min-w-0">
            <SearchSelect
              options={partySelectOptions}
              value={partyFilter}
              onChange={handlePartyChange}
              placeholder="All Parties / Counterparties"
              searchPlaceholder="Filter vendors & customers..."
              size="sm"
              className="w-full text-xs"
              triggerClassName="h-9 rounded-lg border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium"
            />
          </div>

          {/* 3. Status Filter Dropdown (Span 2 cols) */}
          <div className="md:col-span-2 min-w-0">
            <select
              value={statusFilter}
              onChange={(e) => handleStatusChange(e.target.value)}
              className={`w-full h-9 px-2.5 rounded-lg border text-xs font-bold transition-all outline-none cursor-pointer ${
                statusFilter === 'OVERDUE'
                  ? 'border-rose-400 bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800 shadow-2xs'
                  : statusFilter === 'UNPAID'
                  ? 'border-amber-400 bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800 shadow-2xs'
                  : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200'
              }`}
            >
              <option value="ALL">All Statuses</option>
              <option value="OVERDUE">⚠️ Overdue Only</option>
              <option value="UNPAID">🔴 Unpaid</option>
              <option value="PARTIALLY_PAID">🟡 Partially Paid</option>
              <option value="PAID">🟢 Fully Paid</option>
              <option value="ADVANCE_PAID">🔵 Advance Paid</option>
              <option value="OVERPAID">🟣 Overpaid</option>
            </select>
          </div>

          {/* 4. Direction Pills & Refresh (Span 2 cols) */}
          <div className="md:col-span-2 flex items-center justify-between sm:justify-end gap-1.5">
            <div className="flex rounded-lg border border-slate-300 dark:border-slate-700 p-0.5 bg-slate-100 dark:bg-slate-800 text-[11px] font-bold">
              <button
                type="button"
                onClick={() => handleDirectionChange('ALL')}
                className={`px-2 py-1 rounded-md transition-all cursor-pointer ${
                  directionFilter === 'ALL' ? 'bg-white dark:bg-slate-900 shadow-2xs text-slate-900 dark:text-white' : 'text-slate-500'
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => handleDirectionChange('PAYABLE')}
                className={`px-2 py-1 rounded-md transition-all cursor-pointer ${
                  directionFilter === 'PAYABLE' ? 'bg-white dark:bg-slate-900 shadow-2xs text-rose-600' : 'text-slate-500'
                }`}
              >
                Pay
              </button>
              <button
                type="button"
                onClick={() => handleDirectionChange('RECEIVABLE')}
                className={`px-2 py-1 rounded-md transition-all cursor-pointer ${
                  directionFilter === 'RECEIVABLE' ? 'bg-white dark:bg-slate-900 shadow-2xs text-emerald-600' : 'text-slate-500'
                }`}
              >
                Recv
              </button>
            </div>

            <button
              type="button"
              onClick={fetchDocuments}
              title="Refresh Ledger Data"
              className="h-9 w-9 flex items-center justify-center rounded-lg border border-slate-300 dark:border-slate-700 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

        </div>
      </div>

      {/* ── DATA TABLE (STRICT MIN-WIDTHS, NO INTERCEPTION) ── */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-2xs text-xs">
        <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-700">
          <table className="w-full text-left border-collapse table-auto">
            <thead className="bg-slate-50 dark:bg-slate-950/70 border-b border-slate-200 dark:border-slate-800 text-[11px] uppercase font-bold text-slate-500 tracking-wider select-none">
              <tr>
                <th className="py-3 px-3 min-w-[130px] cursor-pointer hover:text-slate-800 group" onClick={() => handleSortToggle('doc_no')}>
                  <div className="flex items-center gap-1">
                    <span>Doc No</span>
                    {renderSortIndicator('doc_no')}
                  </div>
                </th>
                <th className="py-3 px-2 min-w-[110px] cursor-pointer hover:text-slate-800 group" onClick={() => handleSortToggle('doc_date')}>
                  <div className="flex items-center gap-1">
                    <span>Date</span>
                    {renderSortIndicator('doc_date')}
                  </div>
                </th>
                <th className="py-3 px-3 min-w-[200px] max-w-[260px] cursor-pointer hover:text-slate-800 group" onClick={() => handleSortToggle('party_name')}>
                  <div className="flex items-center gap-1">
                    <span>Party / Counterparty</span>
                    {renderSortIndicator('party_name')}
                  </div>
                </th>
                <th className="py-3 px-2 text-right min-w-[95px]">Subtotal</th>
                <th className="py-3 px-2 text-right min-w-[90px]">GST</th>
                <th className="py-3 px-2 text-right min-w-[115px] cursor-pointer hover:text-slate-800 group" onClick={() => handleSortToggle('grand_total')}>
                  <div className="flex items-center justify-end gap-1">
                    <span>Grand Total</span>
                    {renderSortIndicator('grand_total')}
                  </div>
                </th>
                <th className="py-3 px-2 text-right min-w-[105px] cursor-pointer hover:text-slate-800 group" onClick={() => handleSortToggle('paid_amount')}>
                  <div className="flex items-center justify-end gap-1">
                    <span>Paid</span>
                    {renderSortIndicator('paid_amount')}
                  </div>
                </th>
                <th className="py-3 px-2 text-right min-w-[110px] cursor-pointer hover:text-slate-800 group" onClick={() => handleSortToggle('balance')}>
                  <div className="flex items-center justify-end gap-1">
                    <span>Balance</span>
                    {renderSortIndicator('balance')}
                  </div>
                </th>
                <th className="py-3 px-2 text-center min-w-[75px]">Settled</th>
                <th className="py-3 px-2 min-w-[100px]">Fulfilment</th>
                <th className="py-3 px-3 min-w-[130px]">Payment Status</th>
                <th className="py-3 px-3 text-center min-w-[175px] action-cell">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {loading && documents.length === 0 ? (
                <tr>
                  <td colSpan={12} className="py-16 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 mx-auto animate-spin mb-2 text-primary" />
                    <span>Loading financial documents & live payment allocations...</span>
                  </td>
                </tr>
              ) : documents.length === 0 ? (
                <tr>
                  <td colSpan={12} className="py-16 text-center text-slate-400">
                    <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-slate-400" />
                    <p className="font-bold text-slate-600 dark:text-slate-300 text-sm">No financial documents match the active filter</p>
                    <p className="text-xs text-slate-400 mt-1">Try resetting the party dropdown or selecting "All Statuses".</p>
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
                      {/* 1. Doc No with link icon */}
                      <td className="py-3 px-3 font-bold text-slate-900 dark:text-white whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span className="text-primary hover:underline">{doc.doc_no}</span>
                          <button
                            type="button"
                            onClick={(e) => handleViewRedirect(doc, e)}
                            title={`Open original ${doc.doc_type}`}
                            className="text-slate-400 hover:text-primary transition-colors p-0.5 rounded opacity-50 group-hover:opacity-100 no-print cursor-pointer"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                          {doc.doc_type.replace(/_/g, ' ')}
                        </div>
                      </td>

                      {/* 2. Date & Due Date */}
                      <td className="py-3 px-2 text-slate-500 whitespace-nowrap">
                        <div className="font-medium text-slate-700 dark:text-slate-300">{formatDate(doc.doc_date)}</div>
                        {doc.due_date && (
                          <div className={`text-[10px] ${doc.is_overdue ? 'text-rose-600 font-extrabold' : 'text-slate-400 font-medium'}`}>
                            Due: {formatDate(doc.due_date)}
                          </div>
                        )}
                      </td>

                      {/* 3. Party / Counterparty */}
                      <td className="py-3 px-3 font-medium text-slate-800 dark:text-slate-200 max-w-[240px] truncate" title={doc.party_name}>
                        <div className="truncate font-semibold">{doc.party_name}</div>
                        <div className="text-[10px] text-slate-400">{doc.direction === 'PAYABLE' ? 'Supplier / Payee' : 'Customer / Payer'}</div>
                      </td>

                      {/* 4. Subtotal */}
                      <td className="py-3 px-2 text-right text-slate-600 dark:text-slate-400 font-mono whitespace-nowrap">
                        {formatINR(doc.subtotal)}
                      </td>

                      {/* 5. GST */}
                      <td className="py-3 px-2 text-right text-slate-600 dark:text-slate-400 font-mono whitespace-nowrap">
                        {formatINR(Number(doc.tax_cgst || 0) + Number(doc.tax_sgst || 0) + Number(doc.tax_igst || 0))}
                      </td>

                      {/* 6. Grand Total */}
                      <td className="py-3 px-2 text-right font-black text-slate-900 dark:text-white font-mono whitespace-nowrap">
                        {formatINR(doc.grand_total)}
                      </td>

                      {/* 7. Paid */}
                      <td className="py-3 px-2 text-right font-bold text-emerald-600 font-mono whitespace-nowrap">
                        {formatINR(doc.paid_amount)}
                      </td>

                      {/* 8. Balance */}
                      <td className="py-3 px-2 text-right font-black font-mono text-rose-600 whitespace-nowrap">
                        {formatINR(doc.balance)}
                      </td>

                      {/* 9. Progress Settled */}
                      <td className="py-3 px-2 text-center whitespace-nowrap">
                        <div className="w-12 mx-auto bg-slate-200 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${progress === 100 ? 'bg-emerald-500' : progress > 0 ? 'bg-amber-500' : 'bg-transparent'}`}
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono font-bold">{progress}%</span>
                      </td>

                      {/* 10. Fulfilment */}
                      <td className="py-3 px-2 whitespace-nowrap">
                        {renderFulfilmentChip(doc.fulfilment_status)}
                      </td>

                      {/* 11. Payment Status */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        {renderPaymentStatusChip(doc.payment_status, doc.is_overdue, doc.overdue_days)}
                      </td>

                      {/* 12. Actions (View + Pay + Drawer) */}
                      <td className="py-3 px-3 text-center whitespace-nowrap action-cell" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1.5">
                          {/* PAY BUTTON */}
                          {isSettleable ? (
                            <button
                              type="button"
                              onClick={(e) => handlePayRedirect(doc, e)}
                              title="Redirect to original page to record synchronized payment"
                              className="px-2.5 py-1 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-[11px] shadow-sm transition-all flex items-center gap-1 active:scale-95 cursor-pointer"
                            >
                              <CreditCard className="w-3 h-3" />
                              <span>Pay</span>
                            </button>
                          ) : (
                            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                              Paid
                            </span>
                          )}

                          {/* VIEW BUTTON (Redirects to original PO, Asset, Sales, or Expense page) */}
                          <button
                            type="button"
                            onClick={(e) => handleViewRedirect(doc, e)}
                            title={`View original ${doc.doc_type} document`}
                            className="px-2.5 py-1 rounded-md bg-sky-50 hover:bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:hover:bg-sky-900/50 dark:text-sky-300 font-bold text-[11px] border border-sky-200 dark:border-sky-800 transition-all flex items-center gap-1 active:scale-95 cursor-pointer"
                          >
                            <ExternalLink className="w-3 h-3" />
                            <span>View</span>
                          </button>

                          {/* QUICK DRAWER BUTTON */}
                          <button
                            type="button"
                            onClick={() => handleRowClick(doc)}
                            title="Inspect on-page line items and timeline drawer"
                            className="p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
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

        {/* ── RICH INTERACTIVE PAGINATION FOOTER ── */}
        <div className="px-4 py-3 bg-slate-50 dark:bg-slate-950/60 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs no-print">
          
          {/* Records range and Limit dropdown */}
          <div className="flex flex-wrap items-center gap-3 text-slate-500">
            <span>
              Showing <strong className="text-slate-800 dark:text-slate-200">{recordStart}</strong> to{' '}
              <strong className="text-slate-800 dark:text-slate-200">{recordEnd}</strong> of{' '}
              <strong className="text-slate-800 dark:text-slate-200">{meta.total}</strong> documents
            </span>

            <div className="flex items-center gap-1.5 pl-2 border-l border-slate-300 dark:border-slate-700">
              <span className="text-[11px]">Rows:</span>
              <select
                value={limit}
                onChange={(e) => handleLimitChange(Number(e.target.value))}
                className="h-7 px-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold cursor-pointer outline-none"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          </div>

          {/* Pagination Controls */}
          <div className="flex items-center gap-1">
            {/* First Page */}
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => handlePageChange(1)}
              title="First Page"
              className="p-1.5 rounded-md border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
            >
              <ChevronsLeft className="w-3.5 h-3.5 text-slate-600 dark:text-slate-300" />
            </button>

            {/* Previous Page */}
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => handlePageChange(page - 1)}
              title="Previous Page"
              className="px-2.5 py-1 rounded-md border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none transition-colors flex items-center gap-1 font-semibold text-slate-700 dark:text-slate-300 cursor-pointer"
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
                    type="button"
                    onClick={() => handlePageChange(item)}
                    className={`min-w-[30px] h-7 px-2 rounded-md font-bold transition-all text-xs cursor-pointer ${
                      isCurrent
                        ? 'bg-primary text-white shadow-2xs font-black'
                        : 'border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {item}
                  </button>
                );
              })}
            </div>

            {/* Current Page Indicator on small screens */}
            <span className="sm:hidden px-2 font-bold text-slate-700 dark:text-slate-300">
              {page} / {meta.totalPages || 1}
            </span>

            {/* Next Page */}
            <button
              type="button"
              disabled={page >= (meta.totalPages || 1)}
              onClick={() => handlePageChange(page + 1)}
              title="Next Page"
              className="px-2.5 py-1 rounded-md border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none transition-colors flex items-center gap-1 font-semibold text-slate-700 dark:text-slate-300 cursor-pointer"
            >
              <span>Next</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>

            {/* Last Page */}
            <button
              type="button"
              disabled={page >= (meta.totalPages || 1)}
              onClick={() => handlePageChange(meta.totalPages || 1)}
              title="Last Page"
              className="p-1.5 rounded-md border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
            >
              <ChevronsRight className="w-3.5 h-3.5 text-slate-600 dark:text-slate-300" />
            </button>
          </div>

        </div>
      </div>

      {/* ── DOCUMENT DETAIL DRAWER ── */}
      <DocumentDetailDrawer
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        doc={selectedDoc}
        onRecordPayment={(d) => handlePayRedirect(d)}
        onRefresh={fetchDocuments}
      />

      {/* ── GENERAL RECORD PAYMENT MODAL ── */}
      <RecordPaymentModal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        onSuccess={fetchDocuments}
        initialDoc={paymentModalDoc}
      />
    </div>
  );
}
