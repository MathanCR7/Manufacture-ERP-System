import React, { useState, useEffect } from 'react';
import { api } from '@/lib/axios';
import { formatINR, formatDate } from '@/utils/financeFormatters';
import { 
  X, Check, AlertCircle, ArrowRight, ShieldCheck, 
  CreditCard, Banknote, Building2, HelpCircle 
} from 'lucide-react';
import Swal from 'sweetalert2';

export default function RecordPaymentModal({ isOpen, onClose, onSuccess, initialPartyId, initialDoc }) {
  const [direction, setDirection] = useState('OUT'); // 'OUT' (Payable) or 'IN' (Receivable)
  const [parties, setParties] = useState([]);
  const [selectedPartyId, setSelectedPartyId] = useState(initialPartyId || '');
  const [bankAccounts, setBankAccounts] = useState([]);
  const [selectedBankId, setSelectedBankId] = useState('');
  
  const [payDate, setPayDate] = useState(new Date().toISOString().split('T')[0]);
  const [mode, setMode] = useState('BANK');
  const [referenceNo, setReferenceNo] = useState('');
  const [notes, setNotes] = useState('');
  const [totalAmount, setTotalAmount] = useState('');
  
  const [openBills, setOpenBills] = useState([]);
  const [allocations, setAllocations] = useState({}); // doc_id -> amount string
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    // Load bank accounts
    api.get('/finance/bank-accounts')
      .then(res => {
        if (res.data?.success) {
          setBankAccounts(res.data.data || []);
          if (res.data.data?.length > 0) {
            setSelectedBankId(String(res.data.data[0].id));
          }
        }
      })
      .catch(console.error);

    // Load parties
    api.get('/finance/parties')
      .then(res => {
        if (res.data?.success) {
          setParties(res.data.data || []);
        }
      })
      .catch(console.error);
  }, [isOpen]);

  useEffect(() => {
    if (initialDoc) {
      setDirection(initialDoc.direction === 'RECEIVABLE' ? 'IN' : 'OUT');
      setSelectedPartyId(initialDoc.party_id);
      setTotalAmount(String(initialDoc.balance));
    }
  }, [initialDoc]);

  // Load open bills when party or direction changes
  useEffect(() => {
    if (!selectedPartyId) {
      setOpenBills([]);
      return;
    }

    setLoading(true);
    const docDirection = direction === 'IN' ? 'RECEIVABLE' : 'PAYABLE';
    api.get(`/finance/documents?direction=${docDirection}&party_id=${selectedPartyId}&status=UNPAID&limit=100`)
      .then(res => {
        const docs = res.data?.data || [];
        setOpenBills(docs);

        // Pre-allocate if initialDoc provided
        if (initialDoc && docs.some(d => d.doc_id === initialDoc.doc_id)) {
          setAllocations({ [initialDoc.doc_id]: String(initialDoc.balance) });
        } else {
          setAllocations({});
        }
      })
      .catch(err => {
        console.error('Failed to load open bills:', err);
      })
      .finally(() => setLoading(false));
  }, [selectedPartyId, direction, initialDoc]);

  // FIFO Auto-allocate helper
  const handleAutoAllocate = () => {
    const payAmt = Number(totalAmount) || 0;
    if (payAmt <= 0) {
      Swal.fire('Input Required', 'Please enter a valid Payment Amount first.', 'info');
      return;
    }

    let remaining = payAmt;
    const newAlloc = {};

    // Sort bills oldest first (FIFO)
    const sorted = [...openBills].sort((a, b) => new Date(a.doc_date) - new Date(b.doc_date));
    for (const b of sorted) {
      if (remaining <= 0) break;
      const billBalance = Number(b.balance) || 0;
      const allocateForThis = Math.min(remaining, billBalance);
      if (allocateForThis > 0) {
        newAlloc[b.doc_id] = allocateForThis.toFixed(2);
        remaining -= allocateForThis;
      }
    }

    setAllocations(newAlloc);
  };

  const handleManualAllocChange = (docId, val) => {
    setAllocations(prev => ({
      ...prev,
      [docId]: val
    }));
  };

  // Calculate allocated sum and remainder
  const allocatedSum = Object.values(allocations).reduce((sum, val) => sum + (Number(val) || 0), 0);
  const enteredAmount = Number(totalAmount) || 0;
  const unallocatedRemainder = Math.max(0, enteredAmount - allocatedSum);
  const isOverAllocated = allocatedSum > enteredAmount + 0.01;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedPartyId) {
      Swal.fire('Error', 'Please select a Supplier or Customer.', 'warning');
      return;
    }
    if (enteredAmount <= 0) {
      Swal.fire('Error', 'Payment amount must be greater than zero.', 'warning');
      return;
    }
    if (isOverAllocated) {
      Swal.fire('Validation Error', `Total allocated (₹${allocatedSum.toFixed(2)}) cannot exceed Payment Amount (₹${enteredAmount.toFixed(2)}).`, 'error');
      return;
    }

    const payloadAllocations = [];
    for (const [docId, amtStr] of Object.entries(allocations)) {
      const amt = Number(amtStr);
      if (amt > 0) {
        const bill = openBills.find(b => b.doc_id === docId);
        payloadAllocations.push({
          doc_type: bill ? bill.doc_type : 'PURCHASE_ORDER',
          doc_id: docId,
          kind: 'AGAINST_BILL',
          amount: amt
        });
      }
    }

    try {
      setSubmitting(true);
      const res = await api.post('/finance/payments', {
        direction,
        party_id: selectedPartyId,
        bank_account_id: selectedBankId ? Number(selectedBankId) : null,
        pay_date: payDate,
        mode,
        reference_no: referenceNo,
        amount: enteredAmount,
        notes,
        allocations: payloadAllocations
      });

      if (res.data?.success) {
        Swal.fire({
          icon: 'success',
          title: 'Payment Recorded',
          text: res.data.message || 'Payment ledger updated successfully.',
          timer: 2000,
          showConfirmButton: false
        });
        if (onSuccess) onSuccess();
        onClose();
      }
    } catch (err) {
      Swal.fire('Error', err.response?.data?.error || err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Record Payment / Settlement
              </h2>
              <p className="text-xs text-slate-500">
                Single source of truth ledger with FIFO auto-allocation & advance classification
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
          {/* Direction Toggle & Party */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                Direction *
              </label>
              <div className="flex rounded-lg border border-slate-200 dark:border-slate-700 p-0.5 bg-slate-100 dark:bg-slate-800">
                <button
                  type="button"
                  onClick={() => setDirection('OUT')}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${
                    direction === 'OUT'
                      ? 'bg-white dark:bg-slate-900 text-rose-600 shadow-2xs'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  Payment Out (Vendor)
                </button>
                <button
                  type="button"
                  onClick={() => setDirection('IN')}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${
                    direction === 'IN'
                      ? 'bg-white dark:bg-slate-900 text-emerald-600 shadow-2xs'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  Receipt In (Customer)
                </button>
              </div>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                {direction === 'OUT' ? 'Supplier / Payee *' : 'Customer / Payer *'}
              </label>
              <select
                value={selectedPartyId}
                onChange={(e) => setSelectedPartyId(e.target.value)}
                className="w-full h-8 px-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium focus:ring-1 focus:ring-primary focus:outline-hidden"
                required
              >
                <option value="">-- Select Party --</option>
                {parties
                  .filter(p => direction === 'OUT' ? (p.type === 'SUPPLIER' || p.type === 'BOTH') : (p.type === 'CUSTOMER' || p.type === 'BOTH'))
                  .map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} {p.gstin ? `(${p.gstin})` : ''}
                    </option>
                  ))}
              </select>
            </div>
          </div>

          {/* Amount, Date, Bank Account, Mode */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 dark:bg-slate-950/40 p-3 rounded-lg border border-slate-200 dark:border-slate-800">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                Total Amount (₹) *
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                placeholder="0.00"
                value={totalAmount}
                onChange={(e) => setTotalAmount(e.target.value)}
                className="w-full h-8 px-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold text-slate-900 dark:text-white"
                required
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                Payment Date *
              </label>
              <input
                type="date"
                value={payDate}
                onChange={(e) => setPayDate(e.target.value)}
                className="w-full h-8 px-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                required
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                Bank / Cash Book *
              </label>
              <select
                value={selectedBankId}
                onChange={(e) => setSelectedBankId(e.target.value)}
                className="w-full h-8 px-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                required
              >
                {bankAccounts.map(b => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.type}) - Bal: {formatINR(b.current_balance)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                Payment Mode *
              </label>
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value)}
                className="w-full h-8 px-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold"
              >
                <option value="BANK">Bank Transfer (NEFT/RTGS)</option>
                <option value="UPI">UPI / QR Code</option>
                <option value="CASH">Cash Register</option>
                <option value="CHEQUE">Cheque</option>
              </select>
            </div>
          </div>

          {/* Reference & Notes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                Reference / UTR / Cheque No
              </label>
              <input
                type="text"
                placeholder="e.g. UTR123891024 or CHQ-0091"
                value={referenceNo}
                onChange={(e) => setReferenceNo(e.target.value)}
                className="w-full h-8 px-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                Notes / Audit Remark
              </label>
              <input
                type="text"
                placeholder="Optional notes for statement"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full h-8 px-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
              />
            </div>
          </div>

          {/* Bill Allocation Section */}
          <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 bg-slate-100 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800">
              <span className="font-bold text-slate-800 dark:text-slate-200">
                Open Invoices / Orders ({openBills.length})
              </span>
              <button
                type="button"
                onClick={handleAutoAllocate}
                className="px-2.5 py-1 text-[11px] font-bold bg-primary text-white rounded hover:bg-primary/90 transition-colors shadow-2xs"
              >
                ⚡ Auto-Allocate (FIFO)
              </button>
            </div>

            {loading ? (
              <div className="p-6 text-center text-slate-400">Loading open documents...</div>
            ) : openBills.length === 0 ? (
              <div className="p-6 text-center text-slate-400">
                No open unpaid bills found for this party. Any payment recorded will be classified as an <strong>Advance on Account</strong>.
              </div>
            ) : (
              <div className="max-h-52 overflow-y-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-50 dark:bg-slate-900 sticky top-0 text-[10px] uppercase font-bold text-slate-500 border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="py-1.5 px-3">Doc No</th>
                      <th className="py-1.5 px-2">Date</th>
                      <th className="py-1.5 px-2 text-right">Grand Total</th>
                      <th className="py-1.5 px-2 text-right">Balance Due</th>
                      <th className="py-1.5 px-3 text-right w-36">Allocate (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {openBills.map(b => (
                      <tr key={b.doc_id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                        <td className="py-2 px-3 font-semibold text-slate-900 dark:text-white">
                          {b.doc_no}
                          <span className="text-[10px] text-slate-400 ml-1">({b.doc_type})</span>
                        </td>
                        <td className="py-2 px-2 text-slate-500">{formatDate(b.doc_date)}</td>
                        <td className="py-2 px-2 text-right font-medium">{formatINR(b.grand_total)}</td>
                        <td className="py-2 px-2 text-right font-bold text-rose-600">{formatINR(b.balance)}</td>
                        <td className="py-2 px-3 text-right">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            max={b.balance}
                            placeholder="0.00"
                            value={allocations[b.doc_id] || ''}
                            onChange={(e) => handleManualAllocChange(b.doc_id, e.target.value)}
                            className="w-28 h-7 px-2 text-right rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-bold text-slate-900 dark:text-white"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Allocation Summary Bar */}
            <div className="p-3 bg-slate-50 dark:bg-slate-950/60 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
              <div className="flex gap-4">
                <span>Allocated: <strong>{formatINR(allocatedSum)}</strong></span>
                <span>Unallocated Advance: <strong className="text-blue-600">{formatINR(unallocatedRemainder)}</strong></span>
              </div>
              {isOverAllocated && (
                <span className="text-rose-600 font-bold flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" /> Allocated amount exceeds total!
                </span>
              )}
            </div>
          </div>

          {/* Footer Submit Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || isOverAllocated}
              className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition-all shadow-md disabled:opacity-50 flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              {submitting ? 'Recording...' : 'Post to Ledger'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
