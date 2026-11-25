import React, { useState, useEffect } from 'react';
import { api } from '@/lib/axios';
import { formatINR, formatDate, renderPaymentStatusChip, renderFulfilmentChip } from '@/utils/financeFormatters';
import { 
  FileText, Search, Filter, RefreshCw, Download, 
  CreditCard, ChevronRight, Layers, ArrowUpDown, CheckSquare, 
  AlertTriangle, ShoppingCart, HardDrive, DollarSign, Package
} from 'lucide-react';
import DocumentDetailDrawer from '../components/DocumentDetailDrawer';
import RecordPaymentModal from '../components/RecordPaymentModal';

export default function FinanceDocumentsPage() {
  const [activeTab, setActiveTab] = useState('ALL');
  const [directionFilter, setDirectionFilter] = useState('ALL'); // ALL, PAYABLE, RECEIVABLE
  const [statusFilter, setStatusFilter] = useState('ALL'); // ALL, UNPAID, ADVANCE_PAID, PARTIALLY_PAID, PAID, OVERDUE
  const [partyFilter, setPartyFilter] = useState('');
  const [parties, setParties] = useState([]);
  
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [sortBy, setSortBy] = useState('doc_date');
  const [sortDir, setSortDir] = useState('DESC');

  const [documents, setDocuments] = useState([]);
  const [summary, setSummary] = useState(null);
  const [meta, setMeta] = useState({ total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(false);

  // Modals & Drawers
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentModalDoc, setPaymentModalDoc] = useState(null);

  // Load parties for dropdown filter
  useEffect(() => {
    api.get('/finance/parties')
      .then(res => {
        if (res.data?.success) setParties(res.data.data || []);
      })
      .catch(console.error);
  }, []);

  const fetchDocuments = () => {
    setLoading(true);
    const params = new URLSearchParams({
      type: activeTab,
      status: statusFilter,
      direction: directionFilter !== 'ALL' ? directionFilter : '',
      party_id: partyFilter,
      search: search.trim(),
      page,
      limit,
      sortBy,
      sortDir
    });

    api.get(`/finance/documents?${params.toString()}`)
      .then(res => {
        if (res.data?.success) {
          setDocuments(res.data.data || []);
          setSummary(res.data.summary);
          setMeta(res.data.meta);
        }
      })
      .catch(err => {
        console.error('Error fetching finance documents:', err);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchDocuments();
  }, [activeTab, directionFilter, statusFilter, partyFilter, page, limit, sortBy, sortDir]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    fetchDocuments();
  };

  const handleRowClick = (doc) => {
    setSelectedDoc(doc);
    setIsDetailOpen(true);
  };

  const handleOpenPayment = (doc) => {
    setPaymentModalDoc(doc);
    setIsPaymentModalOpen(true);
  };

  const handleExportCSV = () => {
    if (!documents || documents.length === 0) return;
    const headers = ['Doc No', 'Type', 'Date', 'Due Date', 'Party', 'Direction', 'Subtotal', 'Tax', 'Grand Total', 'Paid', 'Balance', 'Status'];
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
      d.payment_status
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Finance_Documents_${activeTab}_${new Date().toISOString().split('T')[0]}.csv`);
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

  return (
    <div className="p-4 sm:p-6 space-y-4 max-w-7xl mx-auto">
      {/* Page Title & Top Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <FileText className="w-6 h-6 text-primary" />
            Financial Documents & Ledger
          </h1>
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
            Record Payment
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
              onClick={() => {
                setActiveTab(tab.id);
                setPage(1);
              }}
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
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-8 pl-8 pr-2.5 rounded-md border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-xs"
          />
        </form>

        <div className="flex flex-wrap items-center gap-2">
          {/* Status Chip Filter */}
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="h-8 px-2.5 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold"
          >
            <option value="ALL">All Statuses</option>
            <option value="UNPAID">🔴 Unpaid</option>
            <option value="ADVANCE_PAID">🔵 Advance Paid</option>
            <option value="PARTIALLY_PAID">🟡 Partially Paid</option>
            <option value="PAID">🟢 Paid</option>
            <option value="OVERDUE">⚠️ Overdue Only</option>
            <option value="OVERPAID">🟣 Overpaid</option>
          </select>

          {/* Party Dropdown */}
          <select
            value={partyFilter}
            onChange={(e) => {
              setPartyFilter(e.target.value);
              setPage(1);
            }}
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
              onClick={() => setDirectionFilter('ALL')}
              className={`px-2 py-0.5 rounded font-bold transition-all ${
                directionFilter === 'ALL' ? 'bg-white dark:bg-slate-900 shadow-2xs text-slate-900 dark:text-white' : 'text-slate-500'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setDirectionFilter('PAYABLE')}
              className={`px-2 py-0.5 rounded font-bold transition-all ${
                directionFilter === 'PAYABLE' ? 'bg-white dark:bg-slate-900 shadow-2xs text-rose-600' : 'text-slate-500'
              }`}
            >
              Payable
            </button>
            <button
              onClick={() => setDirectionFilter('RECEIVABLE')}
              className={`px-2 py-0.5 rounded font-bold transition-all ${
                directionFilter === 'RECEIVABLE' ? 'bg-white dark:bg-slate-900 shadow-2xs text-emerald-600' : 'text-slate-500'
              }`}
            >
              Receivable
            </button>
          </div>

          <button
            onClick={fetchDocuments}
            title="Refresh"
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
            <thead className="bg-slate-50 dark:bg-slate-950/70 border-b border-slate-200 dark:border-slate-800 text-[11px] uppercase font-bold text-slate-500 tracking-wider">
              <tr>
                <th className="py-2.5 px-3">Doc No</th>
                <th className="py-2.5 px-2">Date</th>
                <th className="py-2.5 px-3">Party / Counterparty</th>
                <th className="py-2.5 px-2 text-right">Subtotal</th>
                <th className="py-2.5 px-2 text-right">GST</th>
                <th className="py-2.5 px-2 text-right">Grand Total</th>
                <th className="py-2.5 px-2 text-right">Paid</th>
                <th className="py-2.5 px-2 text-right">Balance</th>
                <th className="py-2.5 px-2 text-center">Progress</th>
                <th className="py-2.5 px-2">Fulfilment</th>
                <th className="py-2.5 px-3">Payment Status</th>
                <th className="py-2.5 px-2 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {loading && documents.length === 0 ? (
                <tr>
                  <td colSpan={12} className="py-12 text-center text-slate-400">
                    Loading financial ledger documents...
                  </td>
                </tr>
              ) : documents.length === 0 ? (
                <tr>
                  <td colSpan={12} className="py-12 text-center text-slate-400">
                    No documents matching the active criteria found.
                  </td>
                </tr>
              ) : (
                documents.map((doc) => {
                  const grandTotal = Number(doc.grand_total) || 0;
                  const paidAmount = Number(doc.paid_amount) || 0;
                  const progress = Math.min(100, Math.round((paidAmount / Math.max(1, grandTotal)) * 100));

                  return (
                    <tr 
                      key={`${doc.doc_type}-${doc.doc_id}`}
                      className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors group cursor-pointer"
                      onClick={() => handleRowClick(doc)}
                    >
                      <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                        <span className="text-primary hover:underline">{doc.doc_no}</span>
                      </td>
                      <td className="py-2.5 px-2 text-slate-500 whitespace-nowrap">
                        {formatDate(doc.doc_date)}
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
                      <td className="py-2.5 px-2 text-center" onClick={(e) => e.stopPropagation()}>
                        {Number(doc.balance) > 1 ? (
                          <button
                            onClick={() => handleOpenPayment(doc)}
                            className="px-2 py-1 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-[11px] border border-emerald-200 transition-colors shadow-2xs"
                          >
                            Pay
                          </button>
                        ) : (
                          <button
                            onClick={() => handleRowClick(doc)}
                            className="p-1 rounded text-slate-400 hover:text-slate-600"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="px-4 py-3 bg-slate-50 dark:bg-slate-950/60 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
          <span className="text-slate-500">
            Showing {documents.length} of {meta.total} records
          </span>
          <div className="flex items-center gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage(p => Math.max(1, p - 1))}
              className="px-2.5 py-1 rounded border border-slate-300 dark:border-slate-700 disabled:opacity-40"
            >
              Previous
            </button>
            <span className="font-bold text-slate-700 dark:text-slate-300">
              Page {page} of {meta.totalPages || 1}
            </span>
            <button
              disabled={page >= meta.totalPages}
              onClick={() => setPage(p => p + 1)}
              className="px-2.5 py-1 rounded border border-slate-300 dark:border-slate-700 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Document Detail Drawer */}
      <DocumentDetailDrawer
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        doc={selectedDoc}
        onRecordPayment={handleOpenPayment}
        onRefresh={fetchDocuments}
      />

      {/* Record Payment Modal */}
      <RecordPaymentModal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        onSuccess={fetchDocuments}
        initialDoc={paymentModalDoc}
      />
    </div>
  );
}
