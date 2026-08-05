import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '@/lib/axios';
import { 
  Clock, AlertTriangle, CheckCircle2, Package, Tag, Calculator, 
  Send, Lock, Info, Building2, Calendar, FileText, ChevronRight, 
  ShieldCheck, RefreshCw, XCircle, LogOut, RotateCcw, Check, Landmark, Edit
} from 'lucide-react';
import Swal from 'sweetalert2';

const PAYMENT_MODES = [
  'Bank Transfer (NEFT)', 
  'Bank Transfer (RTGS)', 
  'Cheque', 
  'DD', 
  'Online Portal', 
  'Letter of Credit', 
  'Cash/Direct'
];

export default function AssetQuotationPublicPage() {
  const { pqId, token } = useParams();

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);
  const [data, setData] = useState(null);

  // Form State
  const [itemsData, setItemsData] = useState([]);
  const [discount, setDiscount] = useState(0);
  const [shipping, setShipping] = useState(0);
  const [loadingCharges, setLoadingCharges] = useState(0);
  const [unloadingCharges, setUnloadingCharges] = useState(0);
  const [packingCharges, setPackingCharges] = useState(0);
  const [insurance, setInsurance] = useState(0);
  const [otherCharges, setOtherCharges] = useState(0);
  const [tds, setTds] = useState(0);
  const [supplierQuoteRef, setSupplierQuoteRef] = useState('');
  
  // Terms & Conditions
  const [paymentTerms, setPaymentTerms] = useState('Net 30');
  const [paymentMode, setPaymentMode] = useState('Bank Transfer (NEFT)');
  const [deliveryTerms, setDeliveryTerms] = useState('Door Delivery');
  const [leadTime, setLeadTime] = useState(7);
  const [warrantyPeriod, setWarrantyPeriod] = useState(12);
  const [amcAvailable, setAmcAvailable] = useState(false);
  const [amcCost, setAmcCost] = useState(0);
  const [supplierNote, setSupplierNote] = useState('');
  
  // Bank details
  const [bankName, setBankName] = useState('');
  const [bankAccountHolder, setBankAccountHolder] = useState('');
  const [bankAccountNo, setBankAccountNo] = useState('');
  const [bankIfsc, setBankIfsc] = useState('');
  const [bankBranch, setBankBranch] = useState('');
  const [bankUpi, setBankUpi] = useState('');

  // GST State
  const [applyGst, setApplyGst] = useState(true);
  const [isInterState, setIsInterState] = useState(false);
  const [chargeGstStates, setChargeGstStates] = useState({
    freight: { applied: false, rate: 18 },
    loadingCharges: { applied: false, rate: 18 },
    unloadingCharges: { applied: false, rate: 18 },
    packingCharges: { applied: false, rate: 18 },
    insurance: { applied: false, rate: 18 },
    otherCharges: { applied: false, rate: 18 },
  });
  const [activeChargeGstEdit, setActiveChargeGstEdit] = useState(null);

  const [submitting, setSubmitting] = useState(false);
  const [submittedSuccess, setSubmittedSuccess] = useState(false);

  // Countdown timer state
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
      const res = await api.get(`/asset-management/public/quotations/${pqId}/${token}`);
      if (res.data.success) {
        const payload = res.data.data;
        setData(payload);

        // Auto-determine supply type based on companyGstin vs vendorGstin state codes
        const companyGstin = payload.companyGstin || '33AABCL0702C1ZG';
        const vendorGstin = payload.quotation.vendorGstin || '';
        const companyState = companyGstin.trim().substring(0, 2);
        const vendorState = vendorGstin.trim().substring(0, 2);
        
        if (companyState && vendorState && companyState === vendorState) {
          setIsInterState(false); // Intra-state (CGST + SGST)
        } else {
          setIsInterState(true);  // Inter-state (IGST)
        }

        // Pre-fill line items
        const rawItems = payload.quotation.items || [];
        const initializedItems = rawItems.map(qi => ({
          id: qi.id,
          description: qi.description || qi.assetName,
          category: qi.category,
          hsnSac: qi.hsnSac || qi.hsnCode || '8471',
          quantity: Number(qi.quantity),
          unit: qi.unit || 'Nos',
          gstApplicable: qi.gstApplicable !== false,
          unitPrice: qi.unitPrice && Number(qi.unitPrice) > 0 ? Number(qi.unitPrice) : '',
          gstRate: qi.gstRate !== undefined ? Number(qi.gstRate) : 18,
          specMatch: qi.specMatch || 'Yes',
          remarks: qi.remarks || ''
        }));

        setItemsData(initializedItems);

        // Fill terms if already filled in a draft/previous submission
        if (payload.quotation.status === 'Received' || payload.quotation.status === 'Resubmission Requested') {
          setDiscount(Number(payload.quotation.discount) || 0);
          setShipping(Number(payload.quotation.shippingCharges) || 0);
          setLoadingCharges(Number(payload.quotation.loadingCharges) || 0);
          setUnloadingCharges(Number(payload.quotation.unloadingCharges) || 0);
          setPackingCharges(Number(payload.quotation.packingCharges) || 0);
          setInsurance(Number(payload.quotation.insurance) || 0);
          setOtherCharges(Number(payload.quotation.otherCharges) || 0);
          setTds(Number(payload.quotation.tds) || 0);
          setSupplierQuoteRef(payload.quotation.supplierQuoteRef || '');
          setPaymentTerms(payload.quotation.paymentTerms || 'Net 30');
          setPaymentMode(payload.quotation.paymentMode || 'Bank Transfer (NEFT)');
          setDeliveryTerms(payload.quotation.deliveryTerms || 'Door Delivery');
          setLeadTime(Number(payload.quotation.leadTime) || 7);
          setWarrantyPeriod(Number(payload.quotation.warrantyPeriod) || 12);
          setAmcAvailable(Boolean(payload.quotation.amcAvailable));
          setAmcCost(Number(payload.quotation.amcCost) || 0);
          setSupplierNote(payload.quotation.termsBlock || '');
          setBankName(payload.quotation.bankName || '');
          setBankAccountHolder(payload.quotation.bankAccountHolder || '');
          setBankAccountNo(payload.quotation.bankAccountNo || '');
          setBankIfsc(payload.quotation.bankIfsc || '');
          setBankBranch(payload.quotation.bankBranch || '');
          setBankUpi(payload.quotation.bankUpi || '');
          setApplyGst(payload.quotation.applyGst !== false);

          if (payload.quotation.chargeGstStates) {
            try {
              const parsed = typeof payload.quotation.chargeGstStates === 'string'
                ? JSON.parse(payload.quotation.chargeGstStates)
                : payload.quotation.chargeGstStates;
              
              const parseLegacy = (val) => {
                if (!val) return { applied: false, rate: 18 };
                if (val === true || val === 'true') return { applied: true, rate: 18 };
                if (typeof val === 'object') return { applied: !!val.applied, rate: val.rate !== undefined ? Number(val.rate) : 18 };
                return { applied: false, rate: 18 };
              };

              setChargeGstStates({
                freight: parseLegacy(parsed.freight || parsed.shippingCharges),
                loadingCharges: parseLegacy(parsed.loadingCharges),
                unloadingCharges: parseLegacy(parsed.unloadingCharges),
                packingCharges: parseLegacy(parsed.packingCharges),
                insurance: parseLegacy(parsed.insurance),
                otherCharges: parseLegacy(parsed.otherCharges),
              });
            } catch (e) {
              console.error(e);
            }
          }
        }
      }
    } catch (err) {
      console.error('[Fetch Public Asset Quote Error]', err);
      setErrorMsg(err.response?.data?.message || err.response?.data?.error || 'Failed to load quotation request. Link may be invalid or expired.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPublicQuotation();
  }, [pqId, token]);

  // Live countdown timer calculation
  useEffect(() => {
    if (!data?.quotation?.validityDate) return;

    const calcTimer = () => {
      const expiry = new Date(data.quotation.validityDate).getTime();
      const now = new Date().getTime();
      const diff = expiry - now;

      if (diff <= 0) {
        setTimeRemaining({
          days: 0,
          hours: 0,
          minutes: 0,
          seconds: 0,
          isExpired: true,
          expiredDateStr: new Date(data.quotation.validityDate).toLocaleString('en-IN', {
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
    const interval = setInterval(calcTimer, 1000);
    return () => clearInterval(interval);
  }, [data?.quotation?.validityDate]);

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
        text: `Quotation Expired on ${timeRemaining.expiredDateStr || new Date(data.quotation.validityDate).toLocaleString('en-IN')}`
      };
    }

    const expiry = new Date(data.quotation.validityDate).getTime();
    const created = new Date(data.quotation.createdAt).getTime();
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

  const updateItem = (index, field, val) => {
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
    if (!applyGst || !item.gstApplicable) return 0;
    const sub = calculateLineSubtotal(item);
    const rate = Number(item.gstRate) || 0;
    return (sub * rate) / 100;
  };

  const calculateChargeTax = (val, key) => {
    const numVal = Number(val || 0);
    if (numVal <= 0 || !applyGst) return 0;
    const state = chargeGstStates[key] || { applied: false, rate: 18 };
    const gstChecked = !!state.applied;
    if (!gstChecked) return 0;
    const rate = isInterState ? 18 : Number(state.rate || 18);
    return numVal * (rate / 100);
  };

  const totalSubtotal = itemsData.reduce((acc, it) => acc + calculateLineSubtotal(it), 0);
  const totalTax = itemsData.reduce((acc, it) => acc + calculateLineTax(it), 0) +
    calculateChargeTax(shipping, 'shippingCharges') +
    calculateChargeTax(loadingCharges, 'loadingCharges') +
    calculateChargeTax(unloadingCharges, 'unloadingCharges') +
    calculateChargeTax(packingCharges, 'packingCharges') +
    calculateChargeTax(insurance, 'insurance') +
    calculateChargeTax(otherCharges, 'otherCharges');
  const totalDiscount = Number(discount) || 0;
  const totalShipping = Number(shipping) || 0;
  const totalLoading = Number(loadingCharges) || 0;
  const totalUnloading = Number(unloadingCharges) || 0;
  const totalPacking = Number(packingCharges) || 0;
  const totalInsurance = Number(insurance) || 0;
  const totalOther = Number(otherCharges) || 0;
  const totalTds = Number(tds) || 0;

  const grandTotal = Math.max(0, totalSubtotal + totalTax + totalShipping + totalLoading + totalUnloading + totalPacking + totalInsurance + totalOther - totalDiscount - totalTds);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (timeRemaining.isExpired || data?.isExpired) {
      Swal.fire('Submission Closed', 'This quotation deadline has expired. Submissions can no longer be accepted.', 'error');
      return;
    }

    const invalidItems = itemsData.filter(it => !it.unitPrice || Number(it.unitPrice) <= 0);
    if (invalidItems.length > 0) {
      Swal.fire('Incomplete Pricing', 'Please enter a valid Unit Price (> 0) for all asset items.', 'warning');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        discount: totalDiscount,
        shippingCharges: totalShipping,
        loadingCharges: totalLoading,
        unloadingCharges: totalUnloading,
        packingCharges: totalPacking,
        insurance: totalInsurance,
        otherCharges: totalOther,
        tds: totalTds,
        supplierQuoteRef,
        paymentTerms,
        paymentMode,
        deliveryTerms,
        leadTime: Number(leadTime),
        warrantyPeriod: Number(warrantyPeriod),
        amcAvailable,
        amcCost: Number(amcCost),
        termsAndConditions: supplierNote,
        bankName,
        bankAccountHolder,
        bankAccountNo,
        bankIfsc,
        bankBranch,
        bankUpi,
        applyGst,
        chargeGstStates,
        stateCode: isInterState ? '99' : '33', // Fake code to identify supply type
        items: itemsData.map(it => ({
          id: it.id,
          unitPrice: Number(it.unitPrice),
          gstRate: it.gstApplicable ? Number(it.gstRate) : 0,
          specMatch: it.specMatch,
          remarks: it.remarks
        }))
      };

      const res = await api.post(`/asset-management/public/quotations/${pqId}/${token}/submit`, payload);

      if (res.data.success) {
        setSubmittedSuccess(true);
        Swal.fire({
          icon: 'success',
          title: 'Quotation Submitted!',
          text: `Your quotation for Asset Request #${data?.quotation?.pqNo} has been successfully recorded.`,
          confirmButtonColor: '#4f46e5'
        }).then(() => {
          fetchPublicQuotation();
        });
      }
    } catch (err) {
      console.error('[Submit Asset PQ Error]', err);
      Swal.fire('Submission Failed', err.response?.data?.message || err.response?.data?.error || 'Failed to submit quotation.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRequestResubmission = async () => {
    Swal.fire({
      title: 'Request Pricing Update?',
      text: 'This will notify the buyer that you want to revise your quotation. Do you want to proceed?',
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#f59e0b',
      confirmButtonText: 'Yes, request'
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          const res = await api.post(`/asset-management/public/quotations/${pqId}/${token}/request-resubmission`);
          if (res.data.success) {
            Swal.fire('Requested', 'Your revision request was sent. Link will unlock once approved by the buyer.', 'success');
            fetchPublicQuotation();
          }
        } catch (e) {
          Swal.fire('Error', e.response?.data?.message || 'Failed to request revision', 'error');
        }
      }
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-400 space-y-4">
        <RefreshCw className="w-12 h-12 text-indigo-500 animate-spin" />
        <p className="text-sm font-medium tracking-wide">Fetching quotation details securely...</p>
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl space-y-6">
          <div className="p-4 bg-rose-500/10 text-rose-500 border border-rose-500/20 rounded-2xl inline-block">
            <XCircle className="w-12 h-12" />
          </div>
          <h2 className="text-xl font-bold text-slate-200">Access Denied</h2>
          <p className="text-sm text-slate-400 leading-relaxed">{errorMsg}</p>
        </div>
      </div>
    );
  }

  const { quotation } = data;
  const supplier = quotation ? {
    name: quotation.vendorName,
    email: quotation.email,
    phone: quotation.phone,
    address: quotation.address,
    gstin: quotation.vendorGstin,
    pan: quotation.vendorPan
  } : {};
  const isReadOnly = timeRemaining.isExpired || quotation.status === 'PO Issued' || quotation.status === 'Received' || quotation.status === 'Resubmission Requested';
  const banner = getBannerStyle();

  const renderChargeField = (label, value, onChange, key) => {
    const numVal = Number(value || 0);
    const state = chargeGstStates[key] || { applied: false, rate: 18 };
    const gstChecked = !!state.applied;
    const gstRate = isInterState ? 18 : Number(state.rate || 18);
    const gstAmt = gstChecked && numVal > 0 ? numVal * (gstRate / 100) : 0;
    const gstCheckboxDisabled = numVal <= 0;

    return (
      <div className="space-y-1.5 bg-slate-950/20 border border-slate-850/80 p-3 rounded-2xl">
        <div className="flex items-center justify-between">
          <label className="text-[11px] text-slate-500 font-bold block">{label}</label>
          {applyGst && numVal > 0 && (
            <div className="flex items-center gap-1 bg-slate-950/80 px-2 py-0.5 border border-slate-850 rounded-lg">
              <label className="flex items-center gap-1 cursor-pointer select-none text-[9px] text-indigo-400 font-black tracking-wide uppercase">
                <input
                  type="checkbox"
                  checked={gstChecked}
                  disabled={isReadOnly}
                  onChange={e => setChargeGstStates(prev => ({
                    ...prev,
                    [key]: { ...prev[key], applied: e.target.checked }
                  }))}
                  className="w-3 h-3 rounded accent-indigo-600 border-slate-700 bg-slate-900 focus:ring-0 cursor-pointer"
                />
                <span>{isInterState ? `IGST 18%` : `GST ${gstRate}%`}</span>
              </label>
              {gstChecked && !isInterState && !isReadOnly && (
                <button
                  type="button"
                  onClick={() => setActiveChargeGstEdit(key)}
                  className="p-0.5 hover:bg-slate-800 rounded text-slate-400 hover:text-indigo-400 transition-colors"
                  title="Configure GST Rate"
                >
                  <Edit className="w-3 h-3" />
                </button>
              )}
            </div>
          )}
        </div>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-bold text-xs">₹</span>
          <input
            type="number"
            min="0"
            disabled={isReadOnly}
            value={value}
            onChange={e => {
              onChange(e.target.value);
              if ((!e.target.value || Number(e.target.value) <= 0) && gstChecked) {
                setChargeGstStates(prev => ({
                  ...prev,
                  [key]: { ...prev[key], applied: false }
                }));
              }
            }}
            placeholder="0"
            className="w-full pl-6 pr-3 py-2 bg-slate-950 border border-slate-850 rounded-xl focus:outline-none focus:border-indigo-500 font-mono text-sm text-slate-200"
          />
        </div>
        {applyGst && gstChecked && numVal > 0 && (
          <p className="text-[9px] text-indigo-400/90 font-bold font-mono text-right mt-1">
            + GST: ₹ {gstAmt.toFixed(2)}
          </p>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-300 font-sans selection:bg-indigo-500/30 pb-20">
      
      {/* HEADER BANNER FOR TIMERS */}
      <div className={`border-b ${banner.bgColor} transition-all duration-300 sticky top-0 z-50`}>
        <div className="max-w-7xl mx-auto px-4 py-3.5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs sm:text-sm font-semibold">
          <div className="flex items-center gap-2">
            {banner.icon}
            <span>{banner.text}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-slate-400 uppercase tracking-widest">RFQ No</span>
            <span className="bg-slate-900 border border-slate-800 px-3 py-1 rounded-lg text-indigo-400 font-mono font-bold tracking-wider">
              {quotation.pqNo}
            </span>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 mt-8 space-y-8">
        
        {/* TOP INTRO INFO CARDS */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Buyer Details */}
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-3xl p-6 backdrop-blur-md flex items-start gap-4">
            <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-2xl border border-indigo-500/20 shrink-0">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[10px] text-slate-500 uppercase font-black tracking-wider block">Buyer Organization</span>
              <h3 className="text-base font-bold text-slate-200 mt-0.5">Leonex Pvt Limited</h3>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">Registered Factory Address, India</p>
            </div>
          </div>

          {/* Supplier Details */}
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-3xl p-6 backdrop-blur-md flex items-start gap-4">
            <div className="p-3 bg-violet-500/10 text-violet-400 rounded-2xl border border-violet-500/20 shrink-0">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[10px] text-slate-500 uppercase font-black tracking-wider block">Vendor Recipient</span>
              <h3 className="text-base font-bold text-slate-200 mt-0.5">{supplier.name}</h3>
              <p className="text-xs text-slate-400 mt-0.5 font-mono">{supplier.email || 'No email registered'}</p>
            </div>
          </div>

          {/* Dates & Status */}
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-3xl p-6 backdrop-blur-md flex items-start gap-4">
            <div className="p-3 bg-amber-500/10 text-amber-400 rounded-2xl border border-amber-500/20 shrink-0">
              <FileText className="w-6 h-6" />
            </div>
            <div className="w-full">
              <span className="text-[10px] text-slate-500 uppercase font-black tracking-wider block">Workflow Status</span>
              <div className="flex items-center justify-between mt-0.5">
                <span className="text-base font-bold text-slate-200">
                  {quotation.status === 'Sent' ? 'Awaiting Quote' : quotation.status}
                </span>
                {quotation.status === 'Received' && (
                  <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-md text-[10px] font-black uppercase">
                    Submitted
                  </span>
                )}
              </div>
              <p className="text-[10px] text-slate-400 mt-1 leading-normal font-medium">
                Issued: {new Date(quotation.createdAt).toLocaleDateString('en-IN')}
              </p>
            </div>
          </div>

        </div>

        {/* CONDITIONAL SUBMISSION NOTICES */}
        {submittedSuccess && (
          <div className="bg-emerald-950/40 border border-emerald-500/20 rounded-3xl p-6 text-center space-y-3 max-w-2xl mx-auto animate-in fade-in zoom-in-95">
            <div className="p-3 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full inline-block">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-slate-100">Thank You! Your quote has been submitted.</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              We have securely recorded your pricing submission. The buyer has been notified. You can update your submission anytime before the deadline or request a revision below.
            </p>
          </div>
        )}

        {quotation.status === 'Received' && !submittedSuccess && (
          <div className="bg-blue-950/20 border border-blue-500/20 rounded-3xl p-6 text-center max-w-2xl mx-auto space-y-4">
            <div className="p-3 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-full inline-block">
              <Check className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-100">Quotation Already Received</h3>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Your quotation was successfully saved on {new Date(quotation.updatedAt).toLocaleString('en-IN')}. Submissions are currently locked. If you need to make changes, please click below to request resubmission approval.
              </p>
            </div>
            <button
              type="button"
              onClick={handleRequestResubmission}
              className="bg-amber-600 hover:bg-amber-500 text-white font-extrabold text-xs px-5 py-2.5 rounded-xl shadow-lg shadow-amber-600/10 active:scale-95 transition-all flex items-center gap-2 mx-auto"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Request Quote Revision</span>
            </button>
          </div>
        )}

        {quotation.status === 'Resubmission Requested' && (
          <div className="bg-amber-950/20 border border-amber-500/20 rounded-3xl p-6 text-center max-w-2xl mx-auto space-y-2">
            <div className="p-3 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-full inline-block animate-pulse">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-slate-100">Revision Pending Approval</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              You requested to revise this quote. The buyer has been notified. Your link will unlock once they approve the revision request. Please check back soon.
            </p>
          </div>
        )}

        {/* QUOTATION ENTRY FORM */}
        {quotation && (
          <form onSubmit={handleSubmit} className="space-y-8 animate-in fade-in slide-in-from-bottom-6 duration-300">
            
            {/* PRICING TABLE CARD */}
            <div className="bg-slate-900/40 border border-slate-800/80 rounded-3xl p-6 backdrop-blur-md">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 border-b border-slate-850 pb-4">
                <div>
                  <h2 className="text-base sm:text-lg font-extrabold text-slate-100 flex items-center gap-2">
                    <Package className="w-5 h-5 text-indigo-400" />
                    Requested Assets & Specifications
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">Please provide your unit pricing and select the GST rate for each line item.</p>
                </div>
                
                {/* Supply Type & GST controls */}
                <div className="flex flex-wrap items-center gap-4 bg-slate-950/80 border border-slate-850 rounded-xl p-2 text-xs">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input 
                      type="checkbox" 
                      checked={applyGst} 
                      onChange={e => setApplyGst(e.target.checked)}
                      className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-700 bg-slate-900"
                    />
                    <span className="font-bold text-slate-400">Apply GST</span>
                  </label>
                  
                  {applyGst && (
                    <div className="flex items-center gap-2 border-l border-slate-850 pl-3">
                      <span className="text-slate-500 font-medium">Supply Type:</span>
                      <button
                        type="button"
                        onClick={() => setIsInterState(false)}
                        className={`px-2 py-1 rounded font-extrabold ${!isInterState ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-900'}`}
                      >
                        Intra-state
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsInterState(true)}
                        className={`px-2 py-1 rounded font-extrabold ${isInterState ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-900'}`}
                      >
                        Inter-state
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Items Grid/Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                      <th className="py-3 px-2 text-center w-12">#</th>
                      <th className="py-3 px-4 min-w-[200px]">Asset Name & Spec</th>
                      <th className="py-3 px-4 text-center w-24">Quantity</th>
                      <th className="py-3 px-4 text-center w-24">UOM</th>
                      <th className="py-3 px-4 w-40">Unit Price (₹)</th>
                      {applyGst && <th className="py-3 px-4 w-28">GST Rate</th>}
                      <th className="py-3 px-4 w-28 text-center">Spec Match?</th>
                      <th className="py-3 px-4 min-w-[150px]">Supplier Remarks</th>
                      <th className="py-3 px-4 text-right w-36">Total (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-850">
                    {itemsData.map((item, idx) => {
                      const lineSub = calculateLineSubtotal(item);
                      const lineTax = calculateLineTax(item);
                      const lineTotal = lineSub + lineTax;

                      return (
                        <tr key={item.id} className="hover:bg-slate-900/35 transition-colors">
                          <td className="py-4 px-2 text-center font-mono text-slate-500 font-bold">{idx + 1}</td>
                          <td className="py-4 px-4 space-y-1">
                            <span className="font-extrabold text-slate-200 block text-sm">{item.description}</span>
                            <span className="text-[10px] text-slate-500 font-medium block">Category: {item.category}</span>
                            <span className="text-[10px] text-slate-400 font-mono block">HSN Code: {item.hsnSac}</span>
                          </td>
                          <td className="py-4 px-4 text-center font-mono text-slate-300 font-extrabold">{item.quantity}</td>
                          <td className="py-4 px-4 text-center font-semibold text-slate-400">{item.unit}</td>
                          <td className="py-4 px-4">
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-bold">₹</span>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                required
                                disabled={isReadOnly}
                                value={item.unitPrice}
                                onChange={e => updateItem(idx, 'unitPrice', e.target.value)}
                                placeholder="0.00"
                                className="w-full pl-7 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:border-indigo-500 font-mono text-sm text-slate-200 disabled:opacity-75"
                              />
                            </div>
                          </td>
                          {applyGst && (
                            <td className="py-4 px-4">
                              <select
                                value={item.gstRate}
                                disabled={!item.gstApplicable || isReadOnly}
                                onChange={e => updateItem(idx, 'gstRate', Number(e.target.value))}
                                className="w-full px-2 py-2 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:border-indigo-500 font-mono text-xs text-slate-350 disabled:opacity-50"
                              >
                                <option value="0">0%</option>
                                <option value="5">{isInterState ? '5% IGST' : '5% (2.5% CGST + 2.5% SGST)'}</option>
                                <option value="12">{isInterState ? '12% IGST' : '12% (6% CGST + 6% SGST)'}</option>
                                <option value="18">{isInterState ? '18% IGST' : '18% (9% CGST + 9% SGST)'}</option>
                                <option value="28">{isInterState ? '28% IGST' : '28% (14% CGST + 14% SGST)'}</option>
                              </select>
                            </td>
                          )}
                          <td className="py-4 px-4 text-center">
                            <select
                              value={item.specMatch}
                              disabled={isReadOnly}
                              onChange={e => updateItem(idx, 'specMatch', e.target.value)}
                              className="px-2 py-1.5 bg-slate-950 border border-slate-800 rounded-lg focus:outline-none focus:border-indigo-500 text-xs font-semibold disabled:opacity-75"
                            >
                              <option value="Yes">Yes</option>
                              <option value="No / Deviated">No / Deviated</option>
                            </select>
                          </td>
                          <td className="py-4 px-4">
                            <input
                              type="text"
                              value={item.remarks}
                              disabled={isReadOnly}
                              onChange={e => updateItem(idx, 'remarks', e.target.value)}
                              placeholder="e.g. 1 year extra warranty"
                              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:border-indigo-500 text-xs text-slate-300 disabled:opacity-75"
                            />
                          </td>
                          <td className="py-4 px-4 text-right font-mono font-black text-slate-100 text-sm">
                            ₹ {lineTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              
              {/* CHARGES & TERMS */}
              <div className="lg:col-span-2 space-y-6">
                
                {/* Additional Charges Block */}
                <div className="bg-slate-900/40 border border-slate-800/80 rounded-3xl p-6 backdrop-blur-md space-y-4">
                  <h3 className="text-sm font-extrabold uppercase tracking-widest text-slate-400 mb-2 flex items-center gap-2">
                    <Calculator className="w-4 h-4 text-indigo-400" />
                    Additional Charges & Deductions (INR)
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="space-y-1.5 bg-slate-950/20 border border-slate-850/80 p-3 rounded-2xl">
                      <label className="text-[11px] text-slate-500 font-bold block">Discount Amount</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-bold text-xs">₹</span>
                        <input
                          type="number"
                          min="0"
                          disabled={isReadOnly}
                          value={discount}
                          onChange={e => setDiscount(e.target.value)}
                          placeholder="0"
                          className="w-full pl-6 pr-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:border-indigo-500 font-mono text-sm text-slate-200"
                        />
                      </div>
                    </div>

                    {renderChargeField('Freight / Transport Charges', shipping, setShipping, 'shippingCharges')}
                    {renderChargeField('Packing Charges', packingCharges, setPackingCharges, 'packingCharges')}
                    {renderChargeField('Loading Charges', loadingCharges, setLoadingCharges, 'loadingCharges')}
                    {renderChargeField('Unloading Charges', unloadingCharges, setUnloadingCharges, 'unloadingCharges')}
                    {renderChargeField('Insurance Charges', insurance, setInsurance, 'insurance')}
                    {renderChargeField('Other Extra Charges', otherCharges, setOtherCharges, 'otherCharges')}

                    <div className="space-y-1.5 bg-slate-950/20 border border-slate-850/80 p-3 rounded-2xl">
                      <label className="text-[11px] text-slate-500 font-bold block">TDS Deduction (if applicable)</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-bold text-xs">₹</span>
                        <input
                          type="number"
                          min="0"
                          disabled={isReadOnly}
                          value={tds}
                          onChange={e => setTds(e.target.value)}
                          placeholder="0"
                          className="w-full pl-6 pr-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:border-indigo-500 font-mono text-sm text-slate-200"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5 bg-slate-950/20 border border-slate-850/80 p-3 rounded-2xl">
                      <label className="text-[11px] text-slate-500 font-bold block">Your Quote Ref No / Date</label>
                      <input
                        type="text"
                        disabled={isReadOnly}
                        value={supplierQuoteRef}
                        onChange={e => setSupplierQuoteRef(e.target.value)}
                        placeholder="e.g. QT-9908"
                        className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:border-indigo-500 font-sans text-sm text-slate-200"
                      />
                    </div>
                  </div>
                </div>

                {/* Delivery & Warranty Terms */}
                <div className="bg-slate-900/40 border border-slate-800/80 rounded-3xl p-6 backdrop-blur-md space-y-4">
                  <h3 className="text-sm font-extrabold uppercase tracking-widest text-slate-400 mb-2 flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-indigo-400" />
                    Delivery, Warranty & Payment Terms
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs text-slate-500 font-bold block mb-1">Payment Terms</label>
                      <input
                        type="text"
                        disabled={isReadOnly}
                        value={paymentTerms}
                        onChange={e => setPaymentTerms(e.target.value)}
                        placeholder="e.g. 50% Advance, 50% on delivery"
                        className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:border-indigo-500 font-sans text-sm text-slate-200 disabled:opacity-75"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-500 font-bold block mb-1">Payment Mode Preferred</label>
                      <select
                        value={paymentMode}
                        disabled={isReadOnly}
                        onChange={e => setPaymentMode(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:border-indigo-500 font-sans text-sm text-slate-200 disabled:opacity-75"
                      >
                        {PAYMENT_MODES.map(mode => (
                          <option key={mode} value={mode}>{mode}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-slate-500 font-bold block mb-1">Delivery Terms</label>
                      <input
                        type="text"
                        disabled={isReadOnly}
                        value={deliveryTerms}
                        onChange={e => setDeliveryTerms(e.target.value)}
                        placeholder="e.g. Free Delivery to site"
                        className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:border-indigo-500 font-sans text-sm text-slate-200 disabled:opacity-75"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs text-slate-500 font-bold block mb-1">Lead Time (Days)</label>
                        <input
                          type="number"
                          min="1"
                          disabled={isReadOnly}
                          value={leadTime}
                          onChange={e => setLeadTime(e.target.value)}
                          className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:border-indigo-500 font-mono text-sm text-slate-200 disabled:opacity-75"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-slate-500 font-bold block mb-1">Warranty (Months)</label>
                        <input
                          type="number"
                          min="0"
                          disabled={isReadOnly}
                          value={warrantyPeriod}
                          onChange={e => setWarrantyPeriod(e.target.value)}
                          className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:border-indigo-500 font-mono text-sm text-slate-200 disabled:opacity-75"
                        />
                      </div>
                    </div>
                    
                    {/* AMC Details */}
                    <div className="flex items-center gap-2 py-3">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          disabled={isReadOnly}
                          checked={amcAvailable}
                          onChange={e => setAmcAvailable(e.target.checked)}
                          className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-700 bg-slate-900 disabled:opacity-50"
                        />
                        <span className="text-xs font-bold text-slate-400">Annual Maintenance Contract (AMC) Available</span>
                      </label>
                    </div>
 
                    {amcAvailable && (
                      <div className="animate-in fade-in slide-in-from-top-2">
                        <label className="text-xs text-slate-500 font-bold block mb-1">Annual AMC Cost (₹)</label>
                        <input
                          type="number"
                          min="0"
                          disabled={isReadOnly}
                          value={amcCost}
                          onChange={e => setAmcCost(e.target.value)}
                          placeholder="Cost per year"
                          className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:border-indigo-500 font-mono text-sm text-slate-200 disabled:opacity-75"
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Bank Account Details */}
                <div className="bg-slate-900/40 border border-slate-800/80 rounded-3xl p-6 backdrop-blur-md space-y-4">
                  <h3 className="text-sm font-extrabold uppercase tracking-widest text-slate-400 mb-2 flex items-center gap-2">
                    <Landmark className="w-4 h-4 text-indigo-400" />
                    Bank Account Details for Payments
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs text-slate-500 font-bold block mb-1">Bank Name</label>
                      <input
                        type="text"
                        disabled={isReadOnly}
                        value={bankName}
                        onChange={e => setBankName(e.target.value)}
                        placeholder="e.g. HDFC Bank"
                        className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:border-indigo-500 font-sans text-sm text-slate-200 disabled:opacity-75"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-500 font-bold block mb-1">Account Holder Name</label>
                      <input
                        type="text"
                        disabled={isReadOnly}
                        value={bankAccountHolder}
                        onChange={e => setBankAccountHolder(e.target.value)}
                        placeholder="e.g. Leonex Pvt Ltd"
                        className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:border-indigo-500 font-sans text-sm text-slate-200 disabled:opacity-75"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-500 font-bold block mb-1">Account Number</label>
                      <input
                        type="text"
                        disabled={isReadOnly}
                        value={bankAccountNo}
                        onChange={e => setBankAccountNo(e.target.value)}
                        placeholder="e.g. 50100234567890"
                        className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:border-indigo-500 font-mono text-sm text-slate-200 disabled:opacity-75"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs text-slate-500 font-bold block mb-1">IFSC Code</label>
                        <input
                          type="text"
                          disabled={isReadOnly}
                          value={bankIfsc}
                          onChange={e => setBankIfsc(e.target.value)}
                          placeholder="HDFC0001234"
                          className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:border-indigo-500 font-mono text-sm uppercase text-slate-200 disabled:opacity-75"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-slate-500 font-bold block mb-1">Branch Name</label>
                        <input
                          type="text"
                          disabled={isReadOnly}
                          value={bankBranch}
                          onChange={e => setBankBranch(e.target.value)}
                          placeholder="Andheri East"
                          className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:border-indigo-500 font-sans text-sm text-slate-200 disabled:opacity-75"
                        />
                      </div>
                    </div>
                    <div className="sm:col-span-2">
                      <label className="text-xs text-slate-500 font-bold block mb-1">UPI ID (Optional)</label>
                      <input
                        type="text"
                        disabled={isReadOnly}
                        value={bankUpi}
                        onChange={e => setBankUpi(e.target.value)}
                        placeholder="e.g. leonex@okaxis"
                        className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:border-indigo-500 font-mono text-sm text-slate-200 disabled:opacity-75"
                      />
                    </div>
                  </div>
                </div>

                {/* Remarks Block */}
                <div className="bg-slate-900/40 border border-slate-800/80 rounded-3xl p-6 backdrop-blur-md space-y-4">
                  <label className="text-xs text-slate-500 font-bold block mb-1 uppercase tracking-wider">Remarks / Notes to Buyer</label>
                  <textarea
                    value={supplierNote}
                    disabled={isReadOnly}
                    onChange={e => setSupplierNote(e.target.value)}
                    placeholder="Enter any additional remarks, terms variations, details on warranty coverage..."
                    rows={4}
                    className="w-full p-4 bg-slate-950 border border-slate-800 rounded-2xl focus:outline-none focus:border-indigo-500 text-sm text-slate-350 disabled:opacity-75"
                  />
                </div>

              </div>

              {/* PRICE CALCULATOR DISPLAY CARD */}
              <div className="space-y-6">
                <div className="bg-slate-900/60 border border-slate-800/80 rounded-3xl p-6 backdrop-blur-md sticky top-[80px] space-y-6 shadow-2xl">
                  <h3 className="text-sm font-extrabold uppercase tracking-widest text-slate-400 border-b border-slate-850 pb-3">
                    Quote Price Summary
                  </h3>
                  
                  <div className="space-y-3.5 text-xs font-semibold text-slate-400">
                    <div className="flex justify-between">
                      <span>Subtotal (Base Value):</span>
                      <span className="font-mono text-slate-200">₹ {totalSubtotal.toFixed(2)}</span>
                    </div>
                    {applyGst && (
                      isInterState ? (
                        <div className="flex justify-between">
                          <span>GST Tax Amount (IGST):</span>
                          <span className="font-mono text-slate-200">₹ {totalTax.toFixed(2)}</span>
                        </div>
                      ) : (
                        <>
                          <div className="flex justify-between">
                            <span>CGST Amount ({(totalTax / 2).toFixed(2)}):</span>
                            <span className="font-mono text-slate-200">₹ {(totalTax / 2).toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>SGST Amount ({(totalTax / 2).toFixed(2)}):</span>
                            <span className="font-mono text-slate-200">₹ {(totalTax / 2).toFixed(2)}</span>
                          </div>
                        </>
                      )
                    )}
                    {totalDiscount > 0 && (
                      <div className="flex justify-between text-rose-400">
                        <span>Discount Deducted:</span>
                        <span className="font-mono">- ₹ {totalDiscount.toFixed(2)}</span>
                      </div>
                    )}
                    {totalShipping > 0 && (
                      <div className="flex justify-between">
                        <span>Freight charges:</span>
                        <span className="font-mono text-slate-350">₹ {totalShipping.toFixed(2)}</span>
                      </div>
                    )}
                    {totalPacking > 0 && (
                      <div className="flex justify-between">
                        <span>Packing charges:</span>
                        <span className="font-mono text-slate-350">₹ {totalPacking.toFixed(2)}</span>
                      </div>
                    )}
                    {totalLoading > 0 && (
                      <div className="flex justify-between">
                        <span>Loading charges:</span>
                        <span className="font-mono text-slate-350">₹ {totalLoading.toFixed(2)}</span>
                      </div>
                    )}
                    {totalUnloading > 0 && (
                      <div className="flex justify-between">
                        <span>Unloading charges:</span>
                        <span className="font-mono text-slate-350">₹ {totalUnloading.toFixed(2)}</span>
                      </div>
                    )}
                    {totalInsurance > 0 && (
                      <div className="flex justify-between">
                        <span>Insurance charges:</span>
                        <span className="font-mono text-slate-350">₹ {totalInsurance.toFixed(2)}</span>
                      </div>
                    )}
                    {totalOther > 0 && (
                      <div className="flex justify-between">
                        <span>Other charges:</span>
                        <span className="font-mono text-slate-350">₹ {totalOther.toFixed(2)}</span>
                      </div>
                    )}
                    {totalTds > 0 && (
                      <div className="flex justify-between text-amber-500">
                        <span>TDS Deduction:</span>
                        <span className="font-mono">- ₹ {totalTds.toFixed(2)}</span>
                      </div>
                    )}
                    
                    <div className="border-t border-slate-800 pt-4 flex justify-between items-center text-slate-100 font-extrabold text-sm uppercase">
                      <span>Grand Total:</span>
                      <span className="font-mono text-2xl text-indigo-400 font-black">
                        ₹ {grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={submitting || isReadOnly}
                    className="w-full py-4 px-6 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-extrabold text-sm rounded-2xl shadow-xl shadow-indigo-600/10 active:scale-[0.98] transition-all flex items-center justify-center gap-2 group disabled:opacity-50"
                  >
                    {submitting ? (
                      <RefreshCw className="w-5 h-5 animate-spin" />
                    ) : isReadOnly ? (
                      <>
                        <Lock className="w-4 h-4" />
                        <span>Quotation Received & Locked</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-5 h-5 group-hover:translate-x-0.5 transition-transform" />
                        <span>Submit Secure Quote</span>
                      </>
                    )}
                  </button>
                  
                  <div className="flex items-center gap-2 justify-center text-[10px] text-slate-500 font-semibold bg-slate-950/60 p-2.5 rounded-xl border border-slate-850">
                    <Lock className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                    <span>Secure end-to-end 256-bit encrypted submission.</span>
                  </div>
                </div>
              </div>

            </div>

          </form>
        )}

      </div>

      {activeChargeGstEdit && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-xs shadow-2xl space-y-4">
            <h4 className="font-bold text-sm text-slate-200">
              Configure GST Rate for {activeChargeGstEdit === 'shippingCharges' ? 'Freight' : activeChargeGstEdit === 'loadingCharges' ? 'Loading & Unloading' : activeChargeGstEdit === 'packingCharges' ? 'Packing' : activeChargeGstEdit === 'insurance' ? 'Insurance' : 'Other Charges'}
            </h4>
            <div className="space-y-1.5">
              <label className="text-xs text-slate-400 font-semibold block">GST Rate (%)</label>
              <select
                value={chargeGstStates[activeChargeGstEdit]?.rate || 18}
                onChange={e => {
                  const val = Number(e.target.value);
                  setChargeGstStates(prev => ({
                    ...prev,
                    [activeChargeGstEdit]: { ...prev[activeChargeGstEdit], rate: val }
                  }));
                }}
                className="w-full h-10 px-3 border border-slate-800 rounded-xl bg-slate-950 text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              >
                {[0, 5, 12, 18, 28].map(r => <option key={r} value={r}>{r}%</option>)}
              </select>
            </div>
            <button type="button" onClick={() => setActiveChargeGstEdit(null)} className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs shadow-lg shadow-indigo-650/15">Done</button>
          </div>
        </div>
      )}
    </div>
  );
}
