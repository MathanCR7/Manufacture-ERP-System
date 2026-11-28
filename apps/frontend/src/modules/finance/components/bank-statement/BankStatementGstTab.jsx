import { useState, useEffect, useCallback, useRef } from 'react';
import {
  AlertTriangle, CheckCircle2, Clock, Download, Upload, Search, Plus, Trash2,
  X, Loader2, FileCheck2, Link2, Building2, FileText
} from 'lucide-react';
import { api } from '@/lib/axios';
import useCompanyStore from '@/app/store/companyStore';
import {
  GST_TREATMENTS,
  formatINRBank,
  validateGstinClient,
  downloadAuthenticatedExcel
} from './bankStatementHelpers';
import { exportGstFilingPdf } from '../../utils/gstFilingPdfGenerator';

export default function BankStatementGstTab({
  accounts = [],
  permissions = {},
  refreshTrigger = 0,
  onDataMutated
}) {
  const { company, fetchCompany } = useCompanyStore();
  const [gstSubTab, setGstSubTab] = useState('WORKING_PAPER'); // 'WORKING_PAPER' | 'GSTR3B_BOOKS'
  const [finYear, setFinYear] = useState('ALL');
  const [accountId, setAccountId] = useState('ALL');
  const [pendingOnly, setPendingOnly] = useState(false);

  const [kpis, setKpis] = useState({
    entries: 0,
    needsReview: 0,
    docsPending: 0,
    itcDocsComplete: 0,
    itcDocsPending: 0,
    salesReceipts: 0
  });
  const [monthlySummary, setMonthlySummary] = useState([]);
  const [entries, setEntries] = useState([]);
  const [allEntries, setAllEntries] = useState([]);
  const [itcRegister, setItcRegister] = useState([]);
  const [availableFinYears, setAvailableFinYears] = useState([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportingTxns, setExportingTxns] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [importing2B, setImporting2B] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // ERP GSTR-3B Register
  const [gstr3bRows, setGstr3bRows] = useState([]);
  const [loadingGstr3b, setLoadingGstr3b] = useState(false);

  const gstr2bInputRef = useRef(null);

  // Review Popup State
  const [reviewingEntry, setReviewingEntry] = useState(null);
  const [savingReview, setSavingReview] = useState(false);
  const [reviewError, setReviewError] = useState('');
  const [erpInvoiceQuery, setErpInvoiceQuery] = useState('');
  const [erpInvoices, setErpInvoices] = useState([]);
  const [loadingInvoices, setLoadingInvoices] = useState(false);

  const canReview = Boolean(permissions.gstReview);

  const fetchGstData = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMsg('');
      const params = new URLSearchParams({
        finYear,
        accountId,
        pendingOnly: String(pendingOnly)
      });
      const res = await api.get(`/finance/bank-statement/gst-review?${params.toString()}`);
      if (res.data?.success) {
        const d = res.data.data;
        setKpis(d.kpis || {});
        setMonthlySummary(d.monthlySummary || []);
        setEntries(d.entries || []);
        setAllEntries(d.allEntries || d.entries || []);
        setItcRegister(d.itcRegister || []);
        setAvailableFinYears(d.availableFinYears || []);
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.error || 'Failed to load GST working paper.');
    } finally {
      setLoading(false);
    }
  }, [finYear, accountId, pendingOnly]);

  const fetchGstr3bBooks = useCallback(async () => {
    try {
      setLoadingGstr3b(true);
      const res = await api.get('/finance/gst');
      if (res.data?.success) setGstr3bRows(res.data.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingGstr3b(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      fetchGstData();
      fetchGstr3bBooks();
      if (!company?.companyName) fetchCompany?.();
    }, 0);
    return () => clearTimeout(t);
  }, [fetchGstData, fetchGstr3bBooks, fetchCompany, company?.companyName, refreshTrigger]);

  const handleExportGstExcel = async () => {
    try {
      setExporting(true);
      const params = new URLSearchParams({ finYear, accountId });
      await downloadAuthenticatedExcel(
        `/finance/bank-statement/export/gst?${params.toString()}`,
        `gst-working-paper_${finYear}_${new Date().toISOString().slice(0, 10)}.xlsx`
      );
    } catch (err) {
      setErrorMsg(err.response?.data?.error || 'Failed to export GST Excel.');
    } finally {
      setExporting(false);
    }
  };

  const handleExportTxnsExcel = async () => {
    try {
      setExportingTxns(true);
      const params = new URLSearchParams({ accountId });
      if (finYear && finYear !== 'ALL' && /^\d{2}-\d{2}$/.test(finYear)) {
        const startYr = 2000 + parseInt(finYear.slice(0, 2), 10);
        params.set('preset', 'custom');
        params.set('from', `${startYr}-04-01`);
        params.set('to', `${startYr + 1}-03-31`);
      } else {
        params.set('preset', 'all');
      }
      await downloadAuthenticatedExcel(
        `/finance/bank-statement/export/transactions?${params.toString()}`,
        `bank-transactions_FY-${finYear}_${new Date().toISOString().slice(0, 10)}.xlsx`
      );
    } catch (err) {
      setErrorMsg(err.response?.data?.error || 'Failed to export Bank Transactions Excel.');
    } finally {
      setExportingTxns(false);
    }
  };

  const handleExportGstPdf = async () => {
    try {
      setExportingPdf(true);
      const acctObj = accounts.find((a) => String(a.id) === String(accountId));
      const accountLabel = acctObj ? `${acctObj.account_name} (${acctObj.account_number || acctObj.account_type})` : 'All Bank Accounts';

      exportGstFilingPdf({
        company,
        finYear,
        accountLabel,
        kpis,
        monthlySummary,
        itcRegister,
        allEntries,
        gstr3bRows
      });
    } catch (err) {
      setErrorMsg(err.message || 'Failed to generate GST Filing PDF Report.');
    } finally {
      setExportingPdf(false);
    }
  };

  const handleGstr2bUpload = async (file) => {
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    try {
      setImporting2B(true);
      const res = await api.post('/finance/bank-statement/gstr2b/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (res.data?.success) {
        setSuccessMsg(`Imported ${res.data.importedCount} GSTR-2B record(s) for cross-matching.`);
        fetchGstData();
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.error || 'Failed to import GSTR-2B file.');
    } finally {
      setImporting2B(false);
      if (gstr2bInputRef.current) gstr2bInputRef.current.value = '';
    }
  };

  const fetchMatchingErpInvoices = async (q = '') => {
    try {
      setLoadingInvoices(true);
      const res = await api.get(`/finance/bank-statement/erp-invoices?search=${encodeURIComponent(q)}`);
      if (res.data?.success) setErpInvoices(res.data.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingInvoices(false);
    }
  };

  const openReviewModal = (entry) => {
    setReviewError('');
    setErpInvoiceQuery('');
    setReviewingEntry({
      txnId: entry.id,
      txnDateDisplay: entry.txn_date_display,
      description: entry.description,
      remarks: entry.remarks,
      debit: entry.debit,
      credit: entry.credit,
      suggestedTreatment: entry.suggested_treatment,
      suggestionReason: entry.suggestion_reason,
      treatment: entry.treatment === 'Unreviewed' && entry.suggested_treatment !== 'Unreviewed'
        ? entry.suggested_treatment
        : entry.treatment,
      invoiceNo: entry.invoice_no || '',
      invoiceDate: entry.invoice_date || '',
      gstin: entry.gstin || '',
      hsnSac: entry.hsn_sac || '',
      taxableAmount: entry.taxable_amount || '',
      cgstAmount: entry.cgst_amount || '',
      sgstAmount: entry.sgst_amount || '',
      igstAmount: entry.igst_amount || '',
      foundInGstr2b: entry.found_in_gstr2b || 'Not Checked',
      imsStatus: entry.ims_status || 'Pending',
      notes: entry.notes || '',
      allocations: Array.isArray(entry.allocations) ? entry.allocations.map((a) => ({
        invoiceSource: a.invoice_source,
        invoiceId: a.invoice_id,
        invoiceNo: a.invoice_no,
        invoiceDate: a.invoice_date,
        partyName: a.party_name,
        partyGstin: a.party_gstin,
        invoiceTaxable: a.invoice_taxable,
        invoiceCgst: a.invoice_cgst,
        invoiceSgst: a.invoice_sgst,
        invoiceIgst: a.invoice_igst,
        invoiceTotal: a.invoice_total,
        allocatedAmount: a.allocated_amount
      })) : []
    });
    fetchMatchingErpInvoices('');
  };

  const linkErpInvoiceToReview = (inv) => {
    if (!reviewingEntry) return;
    const bankAmount = reviewingEntry.debit > 0 ? reviewingEntry.debit : reviewingEntry.credit;
    const alreadyLinked = reviewingEntry.allocations.some(
      (a) => a.invoiceSource === inv.invoice_source && a.invoiceNo === inv.invoice_no
    );
    if (alreadyLinked) return;

    const newAlloc = {
      invoiceSource: inv.invoice_source,
      invoiceId: inv.invoice_id,
      invoiceNo: inv.invoice_no,
      invoiceDate: inv.invoice_date,
      partyName: inv.party_name,
      partyGstin: inv.party_gstin,
      invoiceTaxable: inv.taxable_amount,
      invoiceCgst: inv.cgst_amount,
      invoiceSgst: inv.sgst_amount,
      invoiceIgst: inv.igst_amount,
      invoiceTotal: inv.invoice_total,
      allocatedAmount: Math.min(bankAmount, inv.invoice_total || bankAmount)
    };

    const nextAllocs = [...reviewingEntry.allocations, newAlloc];
    const first = nextAllocs[0];
    setReviewingEntry({
      ...reviewingEntry,
      invoiceNo: reviewingEntry.invoiceNo || first.invoiceNo,
      invoiceDate: reviewingEntry.invoiceDate || first.invoiceDate,
      gstin: reviewingEntry.gstin || first.partyGstin || '',
      taxableAmount: reviewingEntry.taxableAmount || String(first.invoiceTaxable || ''),
      cgstAmount: reviewingEntry.cgstAmount || String(first.invoiceCgst || ''),
      sgstAmount: reviewingEntry.sgstAmount || String(first.invoiceSgst || ''),
      igstAmount: reviewingEntry.igstAmount || String(first.invoiceIgst || ''),
      foundInGstr2b: inv.in_gstr2b ? 'Yes' : reviewingEntry.foundInGstr2b,
      allocations: nextAllocs
    });
  };

  const removeAllocation = (idx) => {
    if (!reviewingEntry) return;
    setReviewingEntry({
      ...reviewingEntry,
      allocations: reviewingEntry.allocations.filter((_, i) => i !== idx)
    });
  };

  const updateAllocationAmount = (idx, val) => {
    if (!reviewingEntry) return;
    setReviewingEntry({
      ...reviewingEntry,
      allocations: reviewingEntry.allocations.map((a, i) => (i === idx ? { ...a, allocatedAmount: val } : a))
    });
  };

  const gstinCheck = reviewingEntry ? validateGstinClient(reviewingEntry.gstin) : { valid: true };
  const paymentAmount = reviewingEntry ? (reviewingEntry.debit > 0 ? reviewingEntry.debit : reviewingEntry.credit) : 0;
  const linkedInvoiceTotal = reviewingEntry
    ? reviewingEntry.allocations.reduce((s, a) => s + Number(a.invoiceTotal || 0), 0)
    : 0;
  const invoiceExceedsPaymentWarning =
    reviewingEntry && linkedInvoiceTotal > 0 && linkedInvoiceTotal > paymentAmount + 0.01;

  const handleSaveReview = async (e) => {
    e.preventDefault();
    if (!reviewingEntry || savingReview) return;
    if (!gstinCheck.valid) {
      setReviewError(gstinCheck.error);
      return;
    }

    const cgst = Number(reviewingEntry.cgstAmount || 0);
    const sgst = Number(reviewingEntry.sgstAmount || 0);
    const igst = Number(reviewingEntry.igstAmount || 0);
    if (igst > 0 && (cgst > 0 || sgst > 0)) {
      setReviewError('Use either IGST OR CGST + SGST, not both.');
      return;
    }
    if (Math.abs(cgst - sgst) > 0.001) {
      setReviewError('CGST must equal SGST.');
      return;
    }

    try {
      setSavingReview(true);
      setReviewError('');
      const res = await api.put(`/finance/bank-statement/gst-review/${reviewingEntry.txnId}`, {
        treatment: reviewingEntry.treatment,
        invoiceNo: reviewingEntry.invoiceNo,
        invoiceDate: reviewingEntry.invoiceDate,
        gstin: reviewingEntry.gstin,
        hsnSac: reviewingEntry.hsnSac,
        taxableAmount: reviewingEntry.taxableAmount || 0,
        cgstAmount: reviewingEntry.cgstAmount || 0,
        sgstAmount: reviewingEntry.sgstAmount || 0,
        igstAmount: reviewingEntry.igstAmount || 0,
        foundInGstr2b: reviewingEntry.foundInGstr2b,
        imsStatus: reviewingEntry.imsStatus,
        notes: reviewingEntry.notes,
        allocations: reviewingEntry.allocations
      });
      if (res.data?.success) {
        setReviewingEntry(null);
        setSuccessMsg('GST review saved to working paper.');
        await fetchGstData();
        onDataMutated?.();
      }
    } catch (err) {
      setReviewError(err.response?.data?.error || 'Failed to save GST review.');
    } finally {
      setSavingReview(false);
    }
  };

  return (
    <div className="space-y-3">
      {/* Compact Sub-View Switcher & Accountant Disclaimer */}
      <div className="bg-white rounded-[14px] border border-[#E3E8F0] p-2.5 flex flex-wrap items-center justify-between gap-2 shadow-2xs">
        <div className="flex items-center gap-1 bg-[#F4F6FA] p-1 rounded-xl border border-[#E3E8F0]">
          <button
            type="button"
            onClick={() => setGstSubTab('WORKING_PAPER')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              gstSubTab === 'WORKING_PAPER' ? 'bg-[#3646C9] text-white shadow-2xs' : 'text-[#14213D] hover:bg-white'
            }`}
          >
            📋 Bank GST Working Paper
          </button>
          <button
            type="button"
            onClick={() => setGstSubTab('GSTR3B_BOOKS')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1.5 ${
              gstSubTab === 'GSTR3B_BOOKS' ? 'bg-[#3646C9] text-white shadow-2xs' : 'text-[#14213D] hover:bg-white'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>GSTR-3B Input vs Output Return</span>
          </button>
        </div>

        <div className="px-2.5 py-1 rounded-lg bg-[#FEF4E6] border border-[#8A5300]/25 text-[#8A5300] text-[11px] font-bold flex items-center gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          <span>Working paper only — verify invoices &amp; GSTR-2B with your accountant before filing.</span>
        </div>
      </div>

      {/* Filters & ALL Exports Bar (PDF + 6-Sheet GST Excel + Transactions Excel + GSTR-2B Import) */}
      <div className="bg-white rounded-[14px] border border-[#E3E8F0] p-2.5 flex flex-wrap items-center justify-between gap-2 shadow-2xs">
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={finYear}
            onChange={(e) => setFinYear(e.target.value)}
            aria-label="Filter by Financial Year"
            className="h-8 px-2.5 rounded-lg border border-[#E3E8F0] bg-white text-xs font-bold text-[#14213D]"
          >
            <option value="ALL">All Financial Years</option>
            {availableFinYears.map((fy) => (
              <option key={fy} value={fy}>FY {fy}</option>
            ))}
          </select>

          <select
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            aria-label="Filter by Account"
            className="h-8 px-2.5 rounded-lg border border-[#E3E8F0] bg-white text-xs font-bold text-[#14213D]"
          >
            <option value="ALL">All Bank Accounts</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>{a.account_name}</option>
            ))}
          </select>

          {gstSubTab === 'WORKING_PAPER' && (
            <label className="inline-flex items-center gap-1.5 text-xs font-bold text-[#14213D] cursor-pointer px-2.5 py-1 rounded-lg border border-[#E3E8F0] bg-[#F4F6FA]">
              <input
                type="checkbox"
                checked={pendingOnly}
                onChange={(e) => setPendingOnly(e.target.checked)}
                className="rounded border-slate-300 text-[#3646C9]"
              />
              <span>Pending only</span>
            </label>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {canReview && (
            <>
              <input
                ref={gstr2bInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={(e) => handleGstr2bUpload(e.target.files?.[0])}
                className="hidden"
              />
              <button
                type="button"
                disabled={importing2B}
                onClick={() => gstr2bInputRef.current?.click()}
                className="h-8 px-3 rounded-lg border border-[#E3E8F0] hover:bg-[#F4F6FA] text-xs font-bold text-[#14213D] inline-flex items-center gap-1.5 cursor-pointer"
              >
                {importing2B ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5 text-[#3646C9]" />}
                <span>Import GSTR-2B</span>
              </button>
            </>
          )}

          <button
            type="button"
            disabled={exportingTxns || kpis.entries === 0}
            onClick={handleExportTxnsExcel}
            className="h-8 px-3 rounded-lg border border-[#E3E8F0] hover:bg-[#F4F6FA] disabled:opacity-50 text-xs font-bold text-[#14213D] inline-flex items-center gap-1.5 cursor-pointer"
          >
            {exportingTxns ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5 text-slate-600" />}
            <span>Txns Excel</span>
          </button>

          <button
            type="button"
            disabled={exporting || kpis.entries === 0}
            onClick={handleExportGstExcel}
            className="h-8 px-3 rounded-lg border border-[#087A55]/30 bg-[#E6F5EF] hover:bg-emerald-100 disabled:opacity-50 text-[#087A55] text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
          >
            {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            <span>GST Working Paper Excel (6 Sheets)</span>
          </button>

          <button
            type="button"
            disabled={exportingPdf || (kpis.entries === 0 && gstr3bRows.length === 0)}
            onClick={handleExportGstPdf}
            className="h-8 px-3.5 rounded-lg bg-[#3646C9] hover:bg-[#2b39ab] disabled:opacity-50 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            {exportingPdf ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
            <span>Export GST Filing PDF</span>
          </button>
        </div>
      </div>

      {errorMsg && (
        <div role="alert" className="px-3 py-2 rounded-xl bg-[#FDECEC] border border-[#B4232F]/30 text-[#B4232F] flex items-center justify-between gap-2 text-xs font-semibold">
          <span>{errorMsg}</span>
          <button onClick={() => setErrorMsg('')} className="underline font-bold">Dismiss</button>
        </div>
      )}

      {successMsg && (
        <div role="status" className="px-3 py-2 rounded-xl bg-[#E6F5EF] border border-[#087A55]/30 text-[#087A55] flex items-center justify-between gap-2 text-xs font-semibold">
          <span>{successMsg}</span>
          <button onClick={() => setSuccessMsg('')} className="underline font-bold">Dismiss</button>
        </div>
      )}

      {gstSubTab === 'GSTR3B_BOOKS' ? (
        <div className="bg-white rounded-[14px] border border-[#E3E8F0] overflow-hidden shadow-2xs">
          <div className="px-3.5 py-2.5 border-b border-[#E3E8F0] bg-[#F4F6FA] flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-xs font-black text-[#14213D] uppercase tracking-wide">
                Monthly GST Summary (ERP Books GSTR-3B Reconciliation)
              </h3>
              <p className="text-[11px] text-slate-500">
                Input Tax Credit (Raw Materials, Assets, Expenses) offset against Output GST on Sales Orders
              </p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[960px] [&_th]:border-r [&_th]:border-[#CBD5E1] [&_th:last-child]:border-r-0 [&_td]:border-r [&_td]:border-[#E2E8F0] [&_td:last-child]:border-r-0">
              <thead className="bg-[#EEF2F8] border-b-2 border-[#CBD5E1] text-[10.5px] uppercase font-bold text-[#14213D]">
                <tr>
                  <th className="py-2 px-3">Month</th>
                  <th className="py-2 px-2 text-right">ITC CGST</th>
                  <th className="py-2 px-2 text-right">ITC SGST</th>
                  <th className="py-2 px-2 text-right">ITC IGST</th>
                  <th className="py-2 px-3 text-right text-[#087A55]">Total Input ITC</th>
                  <th className="py-2 px-2 text-right">Output CGST</th>
                  <th className="py-2 px-2 text-right">Output SGST</th>
                  <th className="py-2 px-2 text-right">Output IGST</th>
                  <th className="py-2 px-3 text-right">Total Output</th>
                  <th className="py-2 px-3 text-right text-[#B4232F]">Net Payable</th>
                  <th className="py-2 px-3 text-right text-[#3646C9]">ITC Carried Fwd</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E3E8F0] text-xs font-mono tabular-nums">
                {loadingGstr3b ? (
                  <tr><td colSpan={11} className="py-10 text-center font-sans text-slate-400">Loading ERP GSTR-3B tax registers...</td></tr>
                ) : gstr3bRows.length === 0 ? (
                  <tr><td colSpan={11} className="py-10 text-center font-sans text-slate-400">No ERP tax records found.</td></tr>
                ) : (
                  gstr3bRows.map((r, idx) => (
                    <tr
                      key={idx}
                      className={`transition-colors hover:bg-[#E8EEFA]/75 ${
                        idx % 2 === 0 ? 'bg-white' : 'bg-[#F3F6FB]'
                      }`}
                    >
                      <td className="py-2 px-3 font-sans font-bold text-[#14213D]">{r.month_key}</td>
                      <td className="py-2 px-2 text-right text-slate-600">{formatINRBank(r.itc_cgst)}</td>
                      <td className="py-2 px-2 text-right text-slate-600">{formatINRBank(r.itc_sgst)}</td>
                      <td className="py-2 px-2 text-right text-slate-600">{formatINRBank(r.itc_igst)}</td>
                      <td className="py-2 px-3 text-right font-bold text-[#087A55] bg-[#E6F5EF]/40">{formatINRBank(r.total_itc)}</td>
                      <td className="py-2 px-2 text-right text-slate-600">{formatINRBank(r.output_cgst)}</td>
                      <td className="py-2 px-2 text-right text-slate-600">{formatINRBank(r.output_sgst)}</td>
                      <td className="py-2 px-2 text-right text-slate-600">{formatINRBank(r.output_igst)}</td>
                      <td className="py-2 px-3 text-right font-bold text-[#14213D]">{formatINRBank(r.total_output)}</td>
                      <td className="py-2 px-3 text-right font-black text-[#B4232F]">{formatINRBank(r.net_gst_payable)}</td>
                      <td className="py-2 px-3 text-right font-black text-[#3646C9] bg-indigo-50/40">{formatINRBank(r.carry_forward_itc)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <>
          {/* Compact 6 KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
            <div className="bg-white rounded-[14px] border border-[#E3E8F0] px-3 py-2">
              <div className="text-[10px] font-bold uppercase text-slate-500">Entries</div>
              <div className="text-lg font-black text-[#14213D] tabular-nums">{kpis.entries}</div>
            </div>
            <div className="bg-white rounded-[14px] border border-[#E3E8F0] px-3 py-2">
              <div className="text-[10px] font-bold uppercase text-[#8A5300]">Needs Review</div>
              <div className="text-lg font-black text-[#8A5300] tabular-nums">{kpis.needsReview}</div>
            </div>
            <div className="bg-white rounded-[14px] border border-[#E3E8F0] px-3 py-2">
              <div className="text-[10px] font-bold uppercase text-[#B4232F]">Docs Pending</div>
              <div className="text-lg font-black text-[#B4232F] tabular-nums">{kpis.docsPending}</div>
            </div>
            <div className="bg-white rounded-[14px] border border-[#E3E8F0] px-3 py-2">
              <div className="text-[10px] font-bold uppercase text-[#087A55]">ITC Docs Complete</div>
              <div className="text-base font-black text-[#087A55] tabular-nums">{formatINRBank(kpis.itcDocsComplete)}</div>
            </div>
            <div className="bg-white rounded-[14px] border border-[#E3E8F0] px-3 py-2">
              <div className="text-[10px] font-bold uppercase text-[#8A5300]">ITC Docs Pending</div>
              <div className="text-base font-black text-[#8A5300] tabular-nums">{formatINRBank(kpis.itcDocsPending)}</div>
            </div>
            <div className="bg-white rounded-[14px] border border-[#E3E8F0] px-3 py-2">
              <div className="text-[10px] font-bold uppercase text-[#3646C9]">Sales Receipts</div>
              <div className="text-base font-black text-[#3646C9] tabular-nums">{formatINRBank(kpis.salesReceipts)}</div>
            </div>
          </div>

          {/* Month Summary Table */}
          <div className="bg-white rounded-[14px] border border-[#CBD5E1] overflow-hidden shadow-xs">
            <div className="px-3.5 py-2 border-b border-[#CBD5E1] bg-[#EEF2F8] text-[11px] font-black text-[#14213D] uppercase tracking-wide">
              Month Summary
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[780px] [&_th]:border-r [&_th]:border-[#CBD5E1] [&_th:last-child]:border-r-0 [&_td]:border-r [&_td]:border-[#E2E8F0] [&_td:last-child]:border-r-0">
                <thead className="bg-[#EEF2F8] border-b-2 border-[#CBD5E1] text-[10.5px] font-bold uppercase text-[#14213D]">
                  <tr>
                    <th className="py-2 px-2.5">Month</th>
                    <th className="py-2 px-2.5 text-right">Entries</th>
                    <th className="py-2 px-2.5 text-right">Credit</th>
                    <th className="py-2 px-2.5 text-right">Debit</th>
                    <th className="py-2 px-2.5 text-right">Sales Receipts</th>
                    <th className="py-2 px-2.5 text-right">ITC Complete</th>
                    <th className="py-2 px-2.5 text-right">ITC Pending</th>
                    <th className="py-2 px-2.5 text-right">Pending</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E3E8F0] text-xs text-[#14213D]">
                  {monthlySummary.length === 0 ? (
                    <tr><td colSpan={8} className="py-6 text-center text-slate-400">No monthly data for selected filter.</td></tr>
                  ) : (
                    monthlySummary.map((m, idx) => (
                      <tr
                        key={`${m.month}-${m.finYear}`}
                        className={`transition-colors hover:bg-[#E8EEFA]/75 ${
                          idx % 2 === 0 ? 'bg-white' : 'bg-[#F3F6FB]'
                        }`}
                      >
                        <td className="py-1.5 px-2.5 font-bold">{m.month} ({m.finYear})</td>
                        <td className="py-1.5 px-2.5 text-right font-mono tabular-nums">{m.entries}</td>
                        <td className="py-1.5 px-2.5 text-right font-mono tabular-nums text-[#087A55] font-semibold">{formatINRBank(m.credit)}</td>
                        <td className="py-1.5 px-2.5 text-right font-mono tabular-nums text-[#B4232F] font-semibold">{formatINRBank(m.debit)}</td>
                        <td className="py-1.5 px-2.5 text-right font-mono tabular-nums text-[#3646C9] font-semibold">{formatINRBank(m.salesReceipts)}</td>
                        <td className="py-1.5 px-2.5 text-right font-mono tabular-nums text-[#087A55] font-semibold">{formatINRBank(m.itcComplete)}</td>
                        <td className="py-1.5 px-2.5 text-right font-mono tabular-nums text-[#8A5300] font-semibold">{formatINRBank(m.itcPending)}</td>
                        <td className="py-1.5 px-2.5 text-right font-mono tabular-nums font-bold">{m.needsReviewCount}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Entry Review Table */}
          <div className="bg-white rounded-[14px] border border-[#CBD5E1] overflow-hidden shadow-xs">
            <div className="px-3.5 py-2 border-b border-[#CBD5E1] bg-[#EEF2F8] text-[11px] font-black text-[#14213D] uppercase tracking-wide">
              Entry Review ({entries.length})
            </div>
            <div className="overflow-x-auto max-h-[55vh]">
              <table className="w-full text-left border-collapse min-w-[1050px] [&_th]:border-r [&_th]:border-[#CBD5E1] [&_th:last-child]:border-r-0 [&_td]:border-r [&_td]:border-[#E2E8F0] [&_td:last-child]:border-r-0">
                <thead className="sticky top-0 z-10 bg-[#EEF2F8] border-b-2 border-[#CBD5E1] text-[10.5px] font-bold uppercase text-[#14213D]">
                  <tr>
                    <th className="py-2 px-2.5 w-20">Action</th>
                    <th className="py-2 px-2.5">Status</th>
                    <th className="py-2 px-2.5">Date</th>
                    <th className="py-2 px-2.5 min-w-[200px]">Remarks / Description</th>
                    <th className="py-2 px-2.5 text-right">Debit</th>
                    <th className="py-2 px-2.5 text-right">Credit</th>
                    <th className="py-2 px-2.5">Treatment</th>
                    <th className="py-2 px-2.5">Invoice</th>
                    <th className="py-2 px-2.5 text-right">GST</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E3E8F0] text-xs text-[#14213D]">
                  {loading ? (
                    <tr><td colSpan={9} className="py-8 text-center text-slate-400">Loading GST entries...</td></tr>
                  ) : entries.length === 0 ? (
                    <tr><td colSpan={9} className="py-8 text-center text-slate-400">No entries match this filter.</td></tr>
                  ) : (
                    entries.map((e, idx) => (
                      <tr
                        key={e.id}
                        className={`align-top transition-colors hover:bg-[#E8EEFA]/75 ${
                          idx % 2 === 0 ? 'bg-white' : 'bg-[#F3F6FB]'
                        }`}
                      >
                        <td className="py-1.5 px-2.5">
                          <button
                            type="button"
                            onClick={() => openReviewModal(e)}
                            className="px-2.5 py-1 rounded-lg bg-[#3646C9] hover:bg-[#2b39ab] text-white text-[11px] font-bold cursor-pointer whitespace-nowrap"
                          >
                            {canReview ? 'Review' : 'View'}
                          </button>
                        </td>
                        <td className="py-1.5 px-2.5 whitespace-nowrap">
                          {e.needs_review ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-[#FEF4E6] text-[#8A5300] border border-[#8A5300]/25">
                              <Clock className="w-3 h-3" /> {e.needs_recheck ? 'Re-check' : 'Needs review'}
                            </span>
                          ) : e.docs_complete ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-[#E6F5EF] text-[#087A55] border border-[#087A55]/25">
                              <CheckCircle2 className="w-3 h-3" /> Docs complete
                            </span>
                          ) : e.docs_pending ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-[#FDECEC] text-[#B4232F] border border-[#B4232F]/25">
                              <AlertTriangle className="w-3 h-3" /> Docs pending
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-[#E6F5EF] text-[#087A55] border border-[#087A55]/25">
                              <FileCheck2 className="w-3 h-3" /> Reviewed
                            </span>
                          )}
                        </td>
                        <td className="py-1.5 px-2.5 font-mono whitespace-nowrap text-[11.5px]">{e.txn_date_display}</td>
                        <td className="py-1.5 px-2.5 max-w-[260px]">
                          <div className="font-semibold text-[#14213D] break-words text-[11.5px]">{e.remarks || e.party_name || '—'}</div>
                          <div className="text-[10.5px] text-slate-500 truncate" title={e.description}>{e.description}</div>
                        </td>
                        <td className="py-1.5 px-2.5 text-right font-mono tabular-nums font-bold text-[#B4232F] whitespace-nowrap">
                          {e.debit > 0 ? formatINRBank(e.debit) : '—'}
                        </td>
                        <td className="py-1.5 px-2.5 text-right font-mono tabular-nums font-bold text-[#087A55] whitespace-nowrap">
                          {e.credit > 0 ? formatINRBank(e.credit) : '—'}
                        </td>
                        <td className="py-1.5 px-2.5 text-[11.5px]">
                          <div className="font-bold text-[#14213D]">{e.treatment}</div>
                          {e.suggested_treatment && e.suggested_treatment !== 'Unreviewed' && e.treatment === 'Unreviewed' && (
                            <div className="text-[10px] font-semibold text-[#8A5300]">
                              Suggested: {e.suggested_treatment}
                            </div>
                          )}
                        </td>
                        <td className="py-1.5 px-2.5 font-mono text-[11px]">
                          {e.invoice_no || (e.allocations?.length > 0 ? `${e.allocations.length} linked` : '—')}
                          {e.gstin && <div className="text-[10px] text-slate-500">{e.gstin}</div>}
                        </td>
                        <td className="py-1.5 px-2.5 text-right font-mono tabular-nums font-bold whitespace-nowrap">
                          {e.total_tax > 0 ? formatINRBank(e.total_tax) : '—'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Review Popup Modal */}
      {reviewingEntry && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-2xs flex items-center justify-center p-4" onClick={() => !savingReview && setReviewingEntry(null)}>
          <form
            onSubmit={handleSaveReview}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-[14px] border border-[#E3E8F0] w-full max-w-3xl p-4 sm:p-5 space-y-3.5 shadow-xl max-h-[92vh] overflow-y-auto"
          >
            <div className="flex items-start justify-between border-b border-[#E3E8F0] pb-2.5 gap-2">
              <div>
                <h3 className="text-sm font-black text-[#14213D]">GST Entry Review (Working Paper)</h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {reviewingEntry.txnDateDisplay} • {reviewingEntry.debit > 0 ? `Debit ${formatINRBank(reviewingEntry.debit)}` : `Credit ${formatINRBank(reviewingEntry.credit)}`} • {reviewingEntry.description}
                </p>
              </div>
              <button type="button" onClick={() => setReviewingEntry(null)} className="p-1 rounded-lg hover:bg-[#F4F6FA]">
                <X className="w-4 h-4" />
              </button>
            </div>

            {reviewingEntry.suggestedTreatment && reviewingEntry.suggestedTreatment !== 'Unreviewed' && (
              <div className="p-2 rounded-xl bg-indigo-50 border border-indigo-200 text-xs text-[#3646C9] font-semibold">
                Suggestion: <strong>{reviewingEntry.suggestedTreatment}</strong> — {reviewingEntry.suggestionReason}
              </div>
            )}

            {invoiceExceedsPaymentWarning && (
              <div className="p-2 rounded-xl bg-[#FEF4E6] border border-[#8A5300]/30 text-[#8A5300] text-xs font-bold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>Warning: Linked invoice total ({formatINRBank(linkedInvoiceTotal)}) is higher than this payment ({formatINRBank(paymentAmount)}).</span>
              </div>
            )}

            {reviewError && (
              <div className="p-2 rounded-xl bg-[#FDECEC] border border-[#B4232F]/30 text-[#B4232F] text-xs font-semibold">
                {reviewError}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
              <div>
                <label className="block font-bold text-slate-600 mb-1">Treatment</label>
                <select
                  disabled={!canReview}
                  value={reviewingEntry.treatment}
                  onChange={(e) => setReviewingEntry({ ...reviewingEntry, treatment: e.target.value })}
                  className="w-full h-9 px-2.5 rounded-xl border border-[#E3E8F0] font-semibold"
                >
                  {GST_TREATMENTS.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block font-bold text-slate-600 mb-1">Invoice No</label>
                <input
                  disabled={!canReview}
                  type="text"
                  value={reviewingEntry.invoiceNo}
                  onChange={(e) => setReviewingEntry({ ...reviewingEntry, invoiceNo: e.target.value })}
                  className="w-full h-9 px-2.5 rounded-xl border border-[#E3E8F0] font-mono"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-600 mb-1">Invoice Date</label>
                <input
                  disabled={!canReview}
                  type="date"
                  value={reviewingEntry.invoiceDate}
                  onChange={(e) => setReviewingEntry({ ...reviewingEntry, invoiceDate: e.target.value })}
                  className="w-full h-9 px-2.5 rounded-xl border border-[#E3E8F0] font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
              <div>
                <label className="block font-bold text-slate-600 mb-1">GSTIN (15-char checked)</label>
                <input
                  disabled={!canReview}
                  type="text"
                  maxLength={15}
                  value={reviewingEntry.gstin}
                  onChange={(e) => setReviewingEntry({ ...reviewingEntry, gstin: e.target.value.toUpperCase() })}
                  placeholder="33AABCU9603R1ZM"
                  className={`w-full h-9 px-2.5 rounded-xl border font-mono ${!gstinCheck.valid ? 'border-[#B4232F] bg-[#FDECEC]/30' : 'border-[#E3E8F0]'}`}
                />
                {!gstinCheck.valid && <div className="text-[10px] text-[#B4232F] font-semibold mt-0.5">{gstinCheck.error}</div>}
              </div>
              <div>
                <label className="block font-bold text-slate-600 mb-1">HSN / SAC</label>
                <input
                  disabled={!canReview}
                  type="text"
                  value={reviewingEntry.hsnSac}
                  onChange={(e) => setReviewingEntry({ ...reviewingEntry, hsnSac: e.target.value })}
                  className="w-full h-9 px-2.5 rounded-xl border border-[#E3E8F0] font-mono"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-600 mb-1">Taxable Amount (₹)</label>
                <input
                  disabled={!canReview}
                  type="number"
                  step="0.01"
                  min="0"
                  value={reviewingEntry.taxableAmount}
                  onChange={(e) => setReviewingEntry({ ...reviewingEntry, taxableAmount: e.target.value })}
                  className="w-full h-9 px-2.5 rounded-xl border border-[#E3E8F0] text-right font-mono tabular-nums"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
              <div>
                <label className="block font-bold text-slate-600 mb-1">CGST (₹)</label>
                <input
                  disabled={!canReview}
                  type="number"
                  step="0.01"
                  min="0"
                  value={reviewingEntry.cgstAmount}
                  onChange={(e) => setReviewingEntry({ ...reviewingEntry, cgstAmount: e.target.value, sgstAmount: e.target.value, igstAmount: '0' })}
                  className="w-full h-9 px-2.5 rounded-xl border border-[#E3E8F0] text-right font-mono tabular-nums"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-600 mb-1">SGST (₹ — equals CGST)</label>
                <input
                  disabled={!canReview}
                  type="number"
                  step="0.01"
                  min="0"
                  value={reviewingEntry.sgstAmount}
                  onChange={(e) => setReviewingEntry({ ...reviewingEntry, sgstAmount: e.target.value, igstAmount: '0' })}
                  className="w-full h-9 px-2.5 rounded-xl border border-[#E3E8F0] text-right font-mono tabular-nums"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-600 mb-1">IGST (₹ — or CGST+SGST)</label>
                <input
                  disabled={!canReview}
                  type="number"
                  step="0.01"
                  min="0"
                  value={reviewingEntry.igstAmount}
                  onChange={(e) => setReviewingEntry({ ...reviewingEntry, igstAmount: e.target.value, cgstAmount: '0', sgstAmount: '0' })}
                  className="w-full h-9 px-2.5 rounded-xl border border-[#E3E8F0] text-right font-mono tabular-nums"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
              <div>
                <label className="block font-bold text-slate-600 mb-1">Found in GSTR-2B</label>
                <select
                  disabled={!canReview}
                  value={reviewingEntry.foundInGstr2b}
                  onChange={(e) => setReviewingEntry({ ...reviewingEntry, foundInGstr2b: e.target.value })}
                  className="w-full h-9 px-2.5 rounded-xl border border-[#E3E8F0]"
                >
                  <option value="Not Checked">Not Checked</option>
                  <option value="Yes">Yes</option>
                  <option value="No">No</option>
                </select>
              </div>
              <div>
                <label className="block font-bold text-slate-600 mb-1">IMS Status</label>
                <select
                  disabled={!canReview}
                  value={reviewingEntry.imsStatus}
                  onChange={(e) => setReviewingEntry({ ...reviewingEntry, imsStatus: e.target.value })}
                  className="w-full h-9 px-2.5 rounded-xl border border-[#E3E8F0]"
                >
                  <option value="Pending">Pending</option>
                  <option value="Accepted">Accepted</option>
                  <option value="Rejected">Rejected</option>
                  <option value="Not Applicable">Not Applicable</option>
                </select>
              </div>
              <div>
                <label className="block font-bold text-slate-600 mb-1">Notes</label>
                <input
                  disabled={!canReview}
                  type="text"
                  value={reviewingEntry.notes}
                  onChange={(e) => setReviewingEntry({ ...reviewingEntry, notes: e.target.value })}
                  className="w-full h-9 px-2.5 rounded-xl border border-[#E3E8F0]"
                />
              </div>
            </div>

            <div className="rounded-xl border border-[#E3E8F0] bg-[#F4F6FA] p-2.5 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-black text-[#14213D] flex items-center gap-1.5">
                  <Link2 className="w-3.5 h-3.5 text-[#3646C9]" /> Linked ERP Invoices &amp; GSTR-2B (Tax counted once per invoice)
                </span>
              </div>

              {reviewingEntry.allocations.length > 0 && (
                <div className="space-y-1.5">
                  {reviewingEntry.allocations.map((al, i) => (
                    <div key={i} className="bg-white p-2 rounded-lg border border-[#E3E8F0] flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div>
                        <span className="font-bold text-[#3646C9]">{al.invoiceSource}</span> • <span className="font-mono font-bold">{al.invoiceNo}</span>
                        {al.partyName && <span className="text-slate-600 ml-1.5">({al.partyName})</span>}
                        <div className="text-[10px] text-slate-500">
                          Inv Total: {formatINRBank(al.invoiceTotal)} • Tax: {formatINRBank((al.invoiceCgst || 0) + (al.invoiceSgst || 0) + (al.invoiceIgst || 0))}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-slate-500">Allocated ₹</span>
                        <input
                          disabled={!canReview}
                          type="number"
                          step="0.01"
                          value={al.allocatedAmount}
                          onChange={(e) => updateAllocationAmount(i, e.target.value)}
                          className="w-24 h-7 px-2 rounded border border-[#E3E8F0] text-right font-mono tabular-nums text-xs"
                        />
                        {canReview && (
                          <button type="button" onClick={() => removeAllocation(i)} className="text-[#B4232F] p-1">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {canReview && (
                <div className="space-y-1.5">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={erpInvoiceQuery}
                      onChange={(e) => {
                        setErpInvoiceQuery(e.target.value);
                        fetchMatchingErpInvoices(e.target.value);
                      }}
                      placeholder="Search ERP Sales, Purchase, Expense, Asset AP, Credit/Debit Notes or GSTR-2B..."
                      className="w-full h-8 pl-8 pr-2.5 rounded-lg border border-[#E3E8F0] bg-white text-xs"
                    />
                  </div>
                  <div className="max-h-32 overflow-y-auto space-y-1">
                    {loadingInvoices ? (
                      <div className="text-[11px] text-slate-400 py-2">Searching ERP invoices...</div>
                    ) : (
                      erpInvoices.slice(0, 20).map((inv, idx) => (
                        <div key={`${inv.invoice_source}-${inv.invoice_id}-${idx}`} className="bg-white px-2.5 py-1.5 rounded-lg border border-[#E3E8F0] flex items-center justify-between gap-2 text-[11px]">
                          <div className="min-w-0 truncate">
                            <span className="font-bold text-[#14213D]">{inv.invoice_no}</span> • <span className="text-slate-600">{inv.party_name}</span>
                            <span className="ml-1.5 text-[10px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-600">{inv.nature}</span>
                            {inv.in_gstr2b && <span className="ml-1 text-[10px] font-bold text-[#087A55]">GSTR-2B ✓</span>}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="font-mono font-bold tabular-nums">{formatINRBank(inv.invoice_total)}</span>
                            <button
                              type="button"
                              onClick={() => linkErpInvoiceToReview(inv)}
                              className="px-2 py-0.5 rounded bg-[#3646C9] text-white font-bold inline-flex items-center gap-1 cursor-pointer"
                            >
                              <Plus className="w-3 h-3" /> Link
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[#E3E8F0]">
              <button
                type="button"
                disabled={savingReview}
                onClick={() => setReviewingEntry(null)}
                className="px-4 py-1.5 rounded-xl border border-[#E3E8F0] text-xs font-bold text-[#14213D]"
              >
                Cancel
              </button>
              {canReview && (
                <button
                  type="submit"
                  disabled={savingReview}
                  className="px-4 py-1.5 rounded-xl bg-[#3646C9] hover:bg-[#2b39ab] text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  {savingReview && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Save review</span>
                </button>
              )}
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
