import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '@/lib/axios';
import { 
  Clock, AlertTriangle, CheckCircle2, Package, Tag, Calculator, 
  Send, Lock, Info, Building2, Calendar, FileText, ChevronRight, ShieldCheck, RefreshCw, XCircle, LogOut, RotateCcw, Check
} from 'lucide-react';
import Swal from 'sweetalert2';

export default function SupplierQuotationPublicPage() {
  const { quotationId, token } = useParams();

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);
  const [data, setData] = useState(null);

  // Form State
  const [itemsData, setItemsData] = useState([]);
  const [discount, setDiscount] = useState(0);
  const [shipping, setShipping] = useState(0);
  const [otherCharges, setOtherCharges] = useState(0);
  const [supplierNote, setSupplierNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submittedSuccess, setSubmittedSuccess] = useState(false);
  const [requestingResubmission, setRequestingResubmission] = useState(false);

  // Time remaining state (ticks live)
  const [timeRemaining, setTimeRemaining] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
    isExpired: false,
    expiredDateStr: ''
  });

  const fetchPublicQuotation = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await api.get(`/rm-quotations/public/${quotationId}/${token}`);
      if (res.data.success) {
        const payload = res.data.data;
        setData(payload);

        // Pre-fill line items
        const rawItems = payload.quotation.items || [];
        const prevRespItems = payload.previousResponse?.items || [];
        
        const initializedItems = rawItems.map(qi => {
          const matchedPrev = prevRespItems.find(pri => pri.quotationItemId === qi.id);
          return {
            quotationItemId: qi.id,
            materialName: qi.materialName,
            materialCode: qi.materialCode,
            quantity: Number(qi.quantity),
            unit: qi.unit,
            gstApplicable: qi.gstApplicable,
            unitPrice: matchedPrev ? Number(matchedPrev.unitPrice) : '',
            gstRate: matchedPrev ? Number(matchedPrev.gstRate) : (qi.gstApplicable ? Number(qi.gstRate) || 18 : 0)
          };
        });

        setItemsData(initializedItems);

        if (payload.previousResponse) {
          setDiscount(Number(payload.previousResponse.discount) || 0);
          setShipping(Number(payload.previousResponse.shipping) || 0);
          setOtherCharges(Number(payload.previousResponse.otherCharges) || 0);
          setSupplierNote(payload.previousResponse.supplierNote || '');
        }
      }
    } catch (err) {
      console.error('[Fetch Public Quote Error]', err);
      setErrorMsg(err.response?.data?.message || 'Failed to load quotation request. Link may be invalid or expired.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPublicQuotation();
  }, [quotationId, token]);

  // Live countdown timer calculation
  useEffect(() => {
    if (!data?.quotation?.expiryAt) return;

    const calcTimer = () => {
      const expiry = new Date(data.quotation.expiryAt).getTime();
      const now = new Date().getTime();
      const diff = expiry - now;

      if (diff <= 0) {
        setTimeRemaining({
          days: 0,
          hours: 0,
          minutes: 0,
          seconds: 0,
          isExpired: true,
          expiredDateStr: new Date(data.quotation.expiryAt).toLocaleString('en-IN', {
            dateStyle: 'medium',
            timeStyle: 'short'
          })
        });
      } else {
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);

        setTimeRemaining({
          days,
          hours,
          minutes,
          seconds,
          isExpired: false,
          expiredDateStr: ''
        });
      }
    };

    calcTimer();
    const interval = setInterval(calcTimer, 3000);
    return () => clearInterval(interval);
  }, [data?.quotation?.expiryAt]);

  const getBannerStyle = () => {
    if (!data?.quotation) {
      return {
        bgColor: 'bg-slate-900 border-slate-800 text-slate-400',
        badgeColor: 'bg-slate-800 text-slate-400',
        icon: <Clock className="w-5 h-5 text-slate-500" />,
        text: 'Loading Quotation details...'
      };
    }

    if (timeRemaining.isExpired || data?.isExpired) {
      return {
        bgColor: 'bg-slate-900 border-slate-800 text-slate-400',
        badgeColor: 'bg-slate-800 text-slate-400 border border-slate-700',
        icon: <Clock className="w-5 h-5 text-slate-500" />,
        text: `Quotation Expired on ${timeRemaining.expiredDateStr || new Date(data.quotation.expiryAt).toLocaleString('en-IN')}`
      };
    }

    const expiry = new Date(data.quotation.expiryAt).getTime();
    const created = new Date(data.quotation.createdAt || data.quotation.quotationDate).getTime();
    const now = new Date().getTime();

    const totalDuration = Math.max(1, expiry - created);
    const timeRemainingMs = Math.max(0, expiry - now);

    const remainingRatio = timeRemainingMs / totalDuration;

    const days = Math.floor(timeRemainingMs / (1000 * 60 * 60 * 24));
    const hours = Math.floor((timeRemainingMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const mins = Math.floor((timeRemainingMs % (1000 * 60 * 60)) / (1000 * 60));
    const secs = Math.floor((timeRemainingMs % (1000 * 60)) / 1000);

    let formattedTimeText = '';
    if (days > 0) {
      formattedTimeText = `${days}d ${hours}h left`;
    } else if (hours > 0) {
      formattedTimeText = `${hours}h ${mins}m left`;
    } else {
      formattedTimeText = `${mins}m ${secs}s left`;
    }

    if (remainingRatio > 0.75) {
      return {
        bgColor: 'bg-emerald-950/90 border-emerald-800/80 text-emerald-200',
        badgeColor: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30',
        icon: <Clock className="w-5 h-5 text-emerald-400 animate-pulse" />,
        text: `Time Remaining: ${formattedTimeText}`
      };
    } else if (remainingRatio > 0.50) {
      return {
        bgColor: 'bg-amber-950/90 border-amber-800/80 text-amber-200',
        badgeColor: 'bg-amber-500/20 text-amber-300 border border-amber-500/30',
        icon: <Clock className="w-5 h-5 text-amber-400 animate-pulse" />,
        text: `Time Remaining: ${formattedTimeText}`
      };
    } else if (remainingRatio > 0.25) {
      return {
        bgColor: 'bg-rose-950/90 border-rose-800/80 text-rose-200',
        badgeColor: 'bg-rose-500/20 text-rose-300 border border-rose-500/30',
        icon: <AlertTriangle className="w-5 h-5 text-rose-400 animate-bounce" />,
        text: `Time Remaining: ${formattedTimeText}`
      };
    } else {
      return {
        bgColor: 'bg-rose-950/95 border-rose-600 text-rose-100 animate-pulse',
        badgeColor: 'bg-rose-600 text-white font-extrabold border border-rose-400 animate-bounce',
        icon: <AlertTriangle className="w-5 h-5 text-rose-300 animate-bounce" />,
        text: `URGENT! Time Remaining: ${formattedTimeText}`
      };
    }
  };

  const updateItemPrice = (index, field, val) => {
    const updated = [...itemsData];
    updated[index][field] = val;
    setItemsData(updated);
  };

  const calculateLineSubtotal = (item) => {
    const qty = Number(item.quantity) || 0;
    const price = Number(item.unitPrice) || 0;
    return qty * price;
  };

  const calculateLineTax = (item) => {
    if (!item.gstApplicable) return 0;
    const sub = calculateLineSubtotal(item);
    const rate = Number(item.gstRate) || 0;
    return (sub * rate) / 100;
  };

  const totalSubtotal = itemsData.reduce((acc, it) => acc + calculateLineSubtotal(it), 0);
  const totalTax = itemsData.reduce((acc, it) => acc + calculateLineTax(it), 0);
  const totalDiscount = Number(discount) || 0;
  const totalShipping = Number(shipping) || 0;
  const totalOther = Number(otherCharges) || 0;
  const grandTotal = Math.max(0, totalSubtotal + totalTax + totalShipping + totalOther - totalDiscount);

  const handleClosePage = () => {
    window.close();
    setTimeout(() => {
      alert("Quotation submitted successfully. You may safely close this browser tab.");
    }, 300);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (timeRemaining.isExpired || data?.isExpired) {
      Swal.fire('Submission Closed', 'This quotation deadline has expired. Submissions can no longer be accepted.', 'error');
      return;
    }

    const invalidItems = itemsData.filter(it => !it.unitPrice || Number(it.unitPrice) <= 0);
    if (invalidItems.length > 0) {
      Swal.fire('Incomplete Pricing', 'Please enter a valid Unit Price (> 0) for all raw material items.', 'warning');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        discount: totalDiscount,
        shipping: totalShipping,
        otherCharges: totalOther,
        supplierNote,
        items: itemsData.map(it => ({
          quotationItemId: it.quotationItemId,
          unitPrice: Number(it.unitPrice),
          gstRate: it.gstApplicable ? Number(it.gstRate) : 0
        }))
      };

      const res = await api.post(`/rm-quotations/public/${quotationId}/${token}/submit`, payload);

      if (res.data.success) {
        setSubmittedSuccess(true);

        Swal.fire({
          icon: 'success',
          title: 'Quotation Submitted!',
          text: `Your quotation for Request #${data?.quotation?.quotationNo} has been securely submitted.`,
          confirmButtonColor: '#4f46e5',
          confirmButtonText: 'Done'
        }).then(() => {
          fetchPublicQuotation();
        });
      }
    } catch (err) {
      console.error('[Submit Error]', err);
      Swal.fire('Submission Failed', err.response?.data?.message || 'Failed to submit quotation. Please try again.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRequestResubmission = async () => {
    setRequestingResubmission(true);
    try {
      const res = await api.post(`/rm-quotations/public/${quotationId}/${token}/request-resubmission`);
      if (res.data.success) {
        Swal.fire({
          icon: 'success',
          title: 'Resubmission Requested!',
          text: 'Your resubmission request has been sent to the buyer. You will receive an email notification once approved.',
          confirmButtonColor: '#4f46e5'
        });
        fetchPublicQuotation();
      }
    } catch (err) {
      console.error('[Request Resubmission Error]', err);
      Swal.fire('Request Failed', err.response?.data?.message || 'Failed to request resubmission.', 'error');
    } finally {
      setRequestingResubmission(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center space-y-4">
        <RefreshCw className="w-10 h-10 text-indigo-500 animate-spin" />
        <p className="text-sm font-medium text-slate-400">Loading quotation request details...</p>
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center space-y-4 shadow-2xl">
          <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-slate-100">Invalid or Expired Link</h2>
          <p className="text-sm text-slate-400 leading-relaxed">{errorMsg}</p>
        </div>
      </div>
    );
  }

  if (!data || !data.quotation) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center space-y-4 shadow-2xl">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-slate-100">Quotation Data Unavailable</h2>
          <p className="text-sm text-slate-400 leading-relaxed">Unable to load quotation details. The link may have expired or is invalid.</p>
        </div>
      </div>
    );
  }

  const { quotation, supplier, previousResponse, supplierRelationStatus } = data;
  const banner = getBannerStyle();
  const isReadOnly = timeRemaining.isExpired || data?.isExpired;
  const isAlreadySubmitted = Boolean(previousResponse) && supplierRelationStatus !== 'PENDING';

  // FULL SCREEN SUCCESS PAGE IMMEDIATELY AFTER SUBMITTING
  if (submittedSuccess) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
        <div className="max-w-lg w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 sm:p-10 text-center space-y-6 shadow-2xl animate-in zoom-in-95 duration-200">
          <div className="w-20 h-20 rounded-full bg-emerald-500/10 border-2 border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto animate-bounce">
            <CheckCircle2 className="w-10 h-10" />
          </div>
          <div>
            <h2 className="text-2xl font-extrabold text-white tracking-tight">Quotation Submitted!</h2>
            <p className="text-sm text-slate-400 mt-2">
              Thank you <span className="font-bold text-slate-200">{supplier.name}</span>. Your pricing response for Request <span className="text-indigo-400 font-mono font-bold">#{quotation.quotationNo}</span> has been securely received.
            </p>
          </div>

          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 text-xs space-y-2 text-left">
            <div className="flex justify-between text-slate-400">
              <span>Submitted Total:</span>
              <span className="font-extrabold text-emerald-400 font-mono text-sm">
                ₹ {grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Date & Time:</span>
              <span className="text-slate-300 font-mono">{new Date().toLocaleString('en-IN')}</span>
            </div>
          </div>

          <div className="pt-2 space-y-3">
            <button
              onClick={() => { setSubmittedSuccess(false); fetchPublicQuotation(); }}
              className="w-full py-3.5 px-6 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-extrabold text-sm rounded-2xl shadow-xl shadow-indigo-600/25 transition-all flex items-center justify-center gap-2"
            >
              <FileText className="w-4 h-4" />
              <span>View Submitted Details</span>
            </button>
            <button
              onClick={handleClosePage}
              className="w-full py-3 px-6 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-2xl transition-all flex items-center justify-center gap-2 border border-slate-700"
            >
              <LogOut className="w-4 h-4" />
              <span>Close Window</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans pb-20">
      
      {/* STICKY TOP BANNER */}
      <div className={`sticky top-0 z-50 px-4 py-3 border-b shadow-lg backdrop-blur-md transition-all duration-300 ${banner.bgColor}`}>
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-center sm:text-left">
          <div className="flex items-center gap-3">
            {banner.icon}
            <span className="font-extrabold text-sm tracking-tight">{banner.text}</span>
          </div>
          <div className={`px-3 py-1 rounded-full text-xs font-semibold ${banner.badgeColor}`}>
            {isAlreadySubmitted 
              ? (supplierRelationStatus === 'RESUBMISSION_REQUESTED' ? 'Resubmission Requested' : 'Submitted (Locked)') 
              : (isReadOnly ? 'Form Locked' : 'Submission Open')}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 pt-8">
        
        {/* Company Header & Title */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 mb-6 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-purple-500/10 via-pink-500/5 to-transparent rounded-full blur-3xl pointer-events-none" />
          
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
            <div>
              <div className="flex items-center gap-2.5 mb-2">
                <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  <Building2 className="w-5 h-5" />
                </div>
                <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
                  {isAlreadySubmitted ? 'Submitted Quotation Details' : 'Supplier Quotation Request'}
                </h1>
              </div>
              <p className="text-sm text-slate-400">
                {isAlreadySubmitted 
                  ? 'Your submitted pricing response is shown below.' 
                  : `Please provide your unit rates and charges for Request #${quotation.quotationNo}`}
              </p>
            </div>

            <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 text-xs space-y-1.5 min-w-[240px]">
              <div className="flex justify-between text-slate-400">
                <span>Supplier:</span>
                <span className="font-bold text-slate-200">{supplier.name}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Contact Email:</span>
                <span className="font-mono text-indigo-400">{supplier.email || 'N/A'}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Status:</span>
                {supplierRelationStatus === 'RESUBMISSION_REQUESTED' ? (
                  <span className="font-bold text-amber-400">Resubmission Pending</span>
                ) : isAlreadySubmitted ? (
                  <span className="font-bold text-emerald-400">Submitted</span>
                ) : (
                  <span className="font-bold text-indigo-400">Open</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ALREADY SUBMITTED VIEW MODE (READ ONLY WITH RESUBMISSION REQUEST BUTTON) */}
        {isAlreadySubmitted ? (
          <div className="space-y-6 animate-in fade-in duration-300">
            
            {/* STATUS BANNER */}
            <div className="bg-slate-900 border border-emerald-500/30 rounded-3xl p-6 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-white">Quotation Response Submitted</h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Submitted on {new Date(previousResponse.submittedAt || previousResponse.updatedAt).toLocaleString('en-IN')}
                  </p>
                </div>
              </div>

              {supplierRelationStatus === 'RESUBMISSION_REQUESTED' ? (
                <div className="px-5 py-2.5 bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-bold rounded-2xl flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-400 animate-spin" />
                  <span>Resubmission Requested (Pending Approval)</span>
                </div>
              ) : (
                <button
                  onClick={handleRequestResubmission}
                  disabled={requestingResubmission || isReadOnly}
                  className="px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white font-extrabold text-xs rounded-2xl shadow-lg shadow-orange-500/20 transition-all flex items-center gap-2 shrink-0 disabled:opacity-50"
                >
                  {requestingResubmission ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Sending Request...</span>
                    </>
                  ) : (
                    <>
                      <RotateCcw className="w-4 h-4" />
                      <span>Request Admin to Allow Resubmission</span>
                    </>
                  )}
                </button>
              )}
            </div>

            {/* SUBMITTED LINE ITEMS TABLE */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
              <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/80">
                <div className="flex items-center gap-2 text-indigo-400 font-bold text-sm">
                  <Package className="w-4 h-4" />
                  <span>Submitted Materials & Pricing Breakdown</span>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="hidden md:table w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-950/80 text-slate-400 uppercase font-semibold text-[11px] tracking-wider border-b border-slate-800">
                    <tr>
                      <th className="px-4 py-3.5 w-12 text-center">#</th>
                      <th className="px-4 py-3.5">Material Details</th>
                      <th className="px-4 py-3.5 text-right w-24">Qty</th>
                      <th className="px-4 py-3.5 w-20">Unit</th>
                      <th className="px-4 py-3.5 text-right w-32">Unit Price (₹)</th>
                      <th className="px-4 py-3.5 text-right w-28">GST Rate</th>
                      <th className="px-4 py-3.5 text-right w-36">Subtotal (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-medium">
                    {itemsData.map((item, idx) => {
                      const lineSub = calculateLineSubtotal(item);
                      return (
                        <tr key={item.quotationItemId} className="hover:bg-slate-850/50">
                          <td className="px-4 py-3.5 text-center font-mono text-slate-500">{idx + 1}</td>
                          <td className="px-4 py-3.5 font-bold text-slate-100">
                            {item.materialName}
                            {item.materialCode && <span className="block text-[11px] font-mono text-slate-500">{item.materialCode}</span>}
                          </td>
                          <td className="px-4 py-3.5 text-right font-mono text-indigo-400 font-bold">{item.quantity}</td>
                          <td className="px-4 py-3.5 text-slate-400">{item.unit}</td>
                          <td className="px-4 py-3.5 text-right font-mono text-slate-100 font-bold">₹ {Number(item.unitPrice || 0).toFixed(2)}</td>
                          <td className="px-4 py-3.5 text-right font-mono text-slate-400">{item.gstApplicable ? `${item.gstRate}%` : 'Exempt'}</td>
                          <td className="px-4 py-3.5 text-right font-mono font-extrabold text-slate-100">₹ {lineSub.toFixed(2)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {/* Mobile Card View for Read-Only Submitted Items */}
                <div className="block md:hidden divide-y divide-slate-800/40 p-4 space-y-4">
                  {itemsData.map((item, idx) => {
                    const lineSub = calculateLineSubtotal(item);
                    return (
                      <div key={item.quotationItemId} className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-4 space-y-2">
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="text-[10px] text-slate-500 font-mono font-bold block">ITEM #{idx + 1}</span>
                            <span className="font-extrabold text-slate-100 text-sm">{item.materialName}</span>
                            {item.materialCode && (
                              <span className="block text-[11px] font-mono text-slate-500">{item.materialCode}</span>
                            )}
                          </div>
                          <div className="text-right">
                            <span className="text-[10px] text-slate-500 block">QTY</span>
                            <span className="text-indigo-400 font-extrabold font-mono text-sm">{item.quantity} {item.unit}</span>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800/40 text-xs">
                          <div>
                            <span className="block text-[10px] text-slate-500">UNIT PRICE</span>
                            <span className="font-mono text-slate-200 font-bold">₹ {Number(item.unitPrice || 0).toFixed(2)}</span>
                          </div>
                          <div className="text-right">
                            <span className="block text-[10px] text-slate-500">TAX (GST)</span>
                            <span className="font-mono text-slate-200 font-bold">{item.gstApplicable ? `${item.gstRate}%` : 'Exempt'}</span>
                          </div>
                        </div>

                        <div className="flex justify-between items-center pt-2 border-t border-slate-800/40 text-xs">
                          <span className="text-slate-400 font-semibold">Subtotal</span>
                          <span className="font-extrabold text-slate-100 font-mono">₹ {lineSub.toFixed(2)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* SUMMARY TOTALS CARD */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-4 text-center">
                <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800">
                  <span className="block text-[10px] uppercase font-bold text-slate-500">Subtotal</span>
                  <span className="text-xs font-bold text-slate-200 font-mono">₹ {totalSubtotal.toFixed(2)}</span>
                </div>
                <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800">
                  <span className="block text-[10px] uppercase font-bold text-slate-500">Tax Total</span>
                  <span className="text-xs font-bold text-slate-200 font-mono">₹ {totalTax.toFixed(2)}</span>
                </div>
                <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800">
                  <span className="block text-[10px] uppercase font-bold text-slate-500">Discount</span>
                  <span className="text-xs font-bold text-rose-400 font-mono">- ₹ {totalDiscount.toFixed(2)}</span>
                </div>
                <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800">
                  <span className="block text-[10px] uppercase font-bold text-slate-500">Shipping</span>
                  <span className="text-xs font-bold text-slate-200 font-mono">₹ {totalShipping.toFixed(2)}</span>
                </div>
                <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800">
                  <span className="block text-[10px] uppercase font-bold text-slate-500">Other Charges</span>
                  <span className="text-xs font-bold text-slate-200 font-mono">₹ {totalOther.toFixed(2)}</span>
                </div>
                <div className="col-span-2 sm:col-span-1 bg-gradient-to-r from-emerald-500/10 to-teal-500/10 p-3 rounded-2xl border border-emerald-500/30">
                  <span className="block text-[10px] uppercase font-bold text-emerald-300">Submitted Grand Total</span>
                  <span className="text-sm font-extrabold text-white font-mono">₹ {grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
              </div>
            </div>

          </div>
        ) : (

          /* EDITABLE FORM MODE */
          <form onSubmit={handleSubmit} className="space-y-6">
            
            {/* RAW MATERIALS TABLE CARD */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
              <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/80">
                <div className="flex items-center gap-2 text-indigo-400 font-bold text-sm">
                  <Package className="w-4 h-4" />
                  <span>Line Item Specifications & Pricing</span>
                </div>
                <span className="text-xs text-slate-500 font-medium">{itemsData.length} items requested</span>
              </div>

              <div className="overflow-x-auto">
                <table className="hidden md:table w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-950/80 text-slate-400 uppercase font-semibold text-[11px] tracking-wider border-b border-slate-800">
                    <tr>
                      <th className="px-4 py-3.5 w-12 text-center">#</th>
                      <th className="px-4 py-3.5 min-w-[200px]">Material Details</th>
                      <th className="px-4 py-3.5 w-28 text-right">Quantity</th>
                      <th className="px-4 py-3.5 w-24">Unit</th>
                      <th className="px-4 py-3.5 min-w-[140px]">Unit Price (₹)*</th>
                      <th className="px-4 py-3.5 w-28 text-center">GST Tax</th>
                      <th className="px-4 py-3.5 min-w-[120px]">GST Rate (%)</th>
                      <th className="px-4 py-3.5 min-w-[140px] text-right">Subtotal (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-medium">
                    {itemsData.map((item, index) => {
                      const lineSub = calculateLineSubtotal(item);
                      return (
                        <tr key={item.quotationItemId} className="hover:bg-slate-850/50 transition-colors">
                          <td className="px-4 py-3.5 text-center font-mono text-slate-500">{index + 1}</td>
                          <td className="px-4 py-3.5">
                            <div className="font-bold text-slate-100">{item.materialName}</div>
                            {item.materialCode && (
                              <div className="text-[11px] font-mono text-slate-500">{item.materialCode}</div>
                            )}
                          </td>
                          <td className="px-4 py-3.5 text-right font-bold text-indigo-400 font-mono">
                            {item.quantity}
                          </td>
                          <td className="px-4 py-3.5 text-slate-400 font-semibold">{item.unit}</td>
                          <td className="px-4 py-3.5">
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-bold">₹</span>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                disabled={isReadOnly}
                                value={item.unitPrice}
                                onChange={e => updateItemPrice(index, 'unitPrice', e.target.value)}
                                placeholder="0.00"
                                className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 rounded-xl pl-7 pr-3 py-2 text-slate-100 font-mono font-bold text-xs transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                required
                              />
                            </div>
                          </td>
                          <td className="px-4 py-3.5 text-center">
                            {item.gstApplicable ? (
                              <span className="inline-block px-2.5 py-1 rounded-md text-[10px] font-extrabold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                                Applicable
                              </span>
                            ) : (
                              <span className="inline-block px-2.5 py-1 rounded-md text-[10px] font-extrabold bg-slate-800 text-slate-400 border border-slate-700">
                                Exempted
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3.5">
                            {item.gstApplicable ? (
                              <div className="relative">
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  max="100"
                                  disabled={isReadOnly}
                                  value={item.gstRate}
                                  onChange={e => updateItemPrice(index, 'gstRate', e.target.value)}
                                  placeholder="18"
                                  className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 rounded-xl px-3 py-2 text-slate-100 font-mono text-xs text-right transition-all disabled:opacity-50"
                                />
                                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 text-xs">%</span>
                              </div>
                            ) : (
                              <span className="text-slate-500 text-center block">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3.5 text-right font-mono font-extrabold text-slate-100 text-sm">
                            ₹ {lineSub.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {/* Mobile Card View for Editable Pricing Items */}
                <div className="block md:hidden divide-y divide-slate-800/40 p-4 space-y-4">
                  {itemsData.map((item, index) => {
                    const lineSub = calculateLineSubtotal(item);
                    return (
                      <div key={item.quotationItemId} className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-4 space-y-3">
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="text-[10px] text-slate-500 font-mono font-bold block">ITEM #{index + 1}</span>
                            <span className="font-extrabold text-slate-100 text-sm">{item.materialName}</span>
                            {item.materialCode && (
                              <span className="block text-[11px] font-mono text-slate-500">{item.materialCode}</span>
                            )}
                          </div>
                          <div className="text-right">
                            <span className="text-[10px] text-slate-500 block">QTY REQUESTED</span>
                            <span className="text-indigo-400 font-extrabold font-mono text-sm">{item.quantity} {item.unit}</span>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3 pt-2">
                          <div>
                            <label className="block text-[10px] font-semibold text-slate-400 mb-1">Unit Price (₹)*</label>
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-bold">₹</span>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                disabled={isReadOnly}
                                value={item.unitPrice}
                                onChange={e => updateItemPrice(index, 'unitPrice', e.target.value)}
                                placeholder="0.00"
                                className="w-full bg-slate-900 border border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 rounded-xl pl-7 pr-3 py-2 text-slate-100 font-mono font-bold text-xs transition-all disabled:opacity-50"
                                required
                              />
                            </div>
                          </div>

                          <div>
                            <label className="block text-[10px] font-semibold text-slate-400 mb-1">GST Rate (%)</label>
                            {item.gstApplicable ? (
                              <div className="relative">
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  max="100"
                                  disabled={isReadOnly}
                                  value={item.gstRate}
                                  onChange={e => updateItemPrice(index, 'gstRate', e.target.value)}
                                  placeholder="18"
                                  className="w-full bg-slate-900 border border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 rounded-xl px-3 py-2 text-slate-100 font-mono text-xs text-right transition-all disabled:opacity-50"
                                />
                                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 text-xs">%</span>
                              </div>
                            ) : (
                              <div className="bg-slate-900 border border-slate-800/50 text-slate-500 rounded-xl px-3 py-2 text-center text-xs font-semibold select-none h-[34px] flex items-center justify-center">
                                Exempted
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex justify-between items-center pt-2 border-t border-slate-800/40 text-xs">
                          <span className="text-slate-400 font-semibold">Line Subtotal</span>
                          <span className="font-extrabold text-slate-100 font-mono">
                            ₹ {lineSub.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* ADDITIONAL CHARGES & SUPPLIER NOTES */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
                <div className="flex items-center gap-2 text-indigo-400 font-bold text-sm mb-2">
                  <Tag className="w-4 h-4" />
                  <span>Additional Charges & Discounts</span>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1.5">Discount (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      disabled={isReadOnly}
                      value={discount}
                      onChange={e => setDiscount(e.target.value)}
                      placeholder="0.00"
                      className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-3 py-2 text-slate-100 font-mono text-xs disabled:opacity-50"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1.5">Shipping (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      disabled={isReadOnly}
                      value={shipping}
                      onChange={e => setShipping(e.target.value)}
                      placeholder="0.00"
                      className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-3 py-2 text-slate-100 font-mono text-xs disabled:opacity-50"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1.5">Other Charges (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      disabled={isReadOnly}
                      value={otherCharges}
                      onChange={e => setOtherCharges(e.target.value)}
                      placeholder="0.00"
                      className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-3 py-2 text-slate-100 font-mono text-xs disabled:opacity-50"
                    />
                  </div>
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-3">
                <div className="flex items-center gap-2 text-indigo-400 font-bold text-sm">
                  <FileText className="w-4 h-4" />
                  <span>Note to Buyer (Optional)</span>
                </div>
                <textarea
                  rows={3}
                  disabled={isReadOnly}
                  value={supplierNote}
                  onChange={e => setSupplierNote(e.target.value)}
                  placeholder="Mention lead times, payment terms, minimum order qty, or validity notes..."
                  className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl p-3 text-slate-100 text-xs placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-50"
                />
              </div>
            </div>

            {/* FOOTER SUMMARY & SUBMIT CARD */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
              
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-4 text-center bg-slate-950/80 border border-slate-800 rounded-2xl p-4">
                <div>
                  <span className="block text-[10px] uppercase font-bold text-slate-500">Total Items</span>
                  <span className="text-sm font-extrabold text-slate-200">{itemsData.length}</span>
                </div>
                <div>
                  <span className="block text-[10px] uppercase font-bold text-slate-500">Subtotal</span>
                  <span className="text-xs font-bold text-slate-300 font-mono">₹ {totalSubtotal.toFixed(2)}</span>
                </div>
                <div>
                  <span className="block text-[10px] uppercase font-bold text-slate-500">Taxes (GST)</span>
                  <span className="text-xs font-bold text-slate-300 font-mono">₹ {totalTax.toFixed(2)}</span>
                </div>
                <div>
                  <span className="block text-[10px] uppercase font-bold text-slate-500">Discount</span>
                  <span className="text-xs font-bold text-rose-400 font-mono">- ₹ {totalDiscount.toFixed(2)}</span>
                </div>
                <div>
                  <span className="block text-[10px] uppercase font-bold text-slate-500">Shipping</span>
                  <span className="text-xs font-bold text-slate-300 font-mono">₹ {totalShipping.toFixed(2)}</span>
                </div>
                <div>
                  <span className="block text-[10px] uppercase font-bold text-slate-500">Other Charges</span>
                  <span className="text-xs font-bold text-slate-300 font-mono">₹ {totalOther.toFixed(2)}</span>
                </div>
                <div className="col-span-2 sm:col-span-1 bg-gradient-to-r from-purple-500/10 to-pink-500/10 rounded-xl p-1 border border-purple-500/20">
                  <span className="block text-[10px] uppercase font-bold text-purple-300">Grand Total</span>
                  <span className="text-sm font-extrabold text-white font-mono">₹ {grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Encrypted secure submission directly to buyer.</span>
                </div>

                {isReadOnly ? (
                  <div className="w-full sm:w-auto px-6 py-3 bg-slate-800 text-slate-400 font-bold text-xs rounded-2xl flex items-center justify-center gap-2 border border-slate-700">
                    <Lock className="w-4 h-4" />
                    <span>Submission Closed (Expired)</span>
                  </div>
                ) : (
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full sm:w-auto px-8 py-3.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-extrabold text-sm rounded-2xl shadow-xl shadow-indigo-600/25 transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {submitting ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Submitting Pricing...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        <span>Submit Quotation</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </form>
        )}

      </div>
    </div>
  );
}
