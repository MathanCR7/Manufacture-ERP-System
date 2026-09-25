import React, { useState, useRef, useEffect } from 'react';
import { 
  CreditCard, Banknote, Landmark, Smartphone, QrCode, FileText, 
  Wallet, UploadCloud, Image as ImageIcon, X, Eye, Trash2, Edit, 
  AlertCircle, CheckCircle2, IndianRupee, ZoomIn, Camera, Sparkles, 
  RefreshCw, Plus, Calendar, Clock, ExternalLink, RotateCcw,
  Check, ArrowRight, ChevronRight, Layers, FileCheck
} from 'lucide-react';
import { format } from 'date-fns';
import Swal from 'sweetalert2';
import { api } from '@/lib/axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  PAYMENT_MODES, 
  resolvePaymentImageUrl, 
  compressImage, 
  LiveCameraModal, 
  ImagePreviewModal 
} from './PaymentFieldsSection';

/**
 * Converts a Date or ISO string to the value required by <input type="datetime-local"> (YYYY-MM-DDTHH:mm)
 */
export function toDateTimeLocalString(dateInput) {
  if (!dateInput) return '';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  const year = d.getFullYear();
  const month = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

/**
 * Returns formatted date and time string: "25-09-2026, 04:30 PM"
 */
export function formatPaymentDateTime(dateInput) {
  if (!dateInput) return '—';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '—';
  try {
    return format(d, 'dd-MM-yyyy, hh:mm a');
  } catch {
    return String(dateInput);
  }
}

/**
 * Normalizes an installment array or synthesizes from legacy fields if needed
 */
export function getInitialInstallments(po) {
  if (!po) return [];
  if (Array.isArray(po.paymentHistory) && po.paymentHistory.length > 0) {
    return po.paymentHistory.map((item, idx) => ({
      ...item,
      id: item.id || `inst_${idx + 1}_${Date.now()}`,
      amount: Number(item.amount || 0),
    }));
  }
  const total = Number(po.grandTotal && Number(po.grandTotal) > 0 ? po.grandTotal : po.amount || 0);
  const paidVal = Number(po.paidAmount !== undefined && po.paidAmount !== null ? po.paidAmount : (po.paymentStatus === 'PAID' ? total : 0));
  
  if (paidVal > 0) {
    return [{
      id: `legacy-${po.id || '1'}`,
      amount: paidVal,
      paymentDate: po.paymentDate || po.createdAt || new Date().toISOString(),
      paymentMode: po.paymentMode || 'BANK_TRANSFER',
      paymentRef: po.paymentRef || '',
      paymentImage: po.paymentImage || null,
      paymentNotes: po.paymentNotes || 'Initial payment settlement',
      createdAt: po.paymentDate || po.createdAt || new Date().toISOString()
    }];
  }
  return [];
}

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * UpdatePaymentSettlementModal
 * Comprehensive modal allowing adding multiple installments, selecting exact date & time,
 * editing selected installments, uploading receipt images with camera/compression,
 * live calculations of Amount Paid and Balance Due, and syncing to backend.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export function UpdatePaymentSettlementModal({ po: modalData, initialEditIndex = null, onClose, onUpdated }) {
  const po = modalData?.po || modalData;
  const totalPayable = Number(po?.grandTotal && Number(po?.grandTotal) > 0 ? po?.grandTotal : po?.amount || 0);

  const [installments, setInstallments] = useState(() => getInitialInstallments(po));
  const [editingId, setEditingId] = useState(null);

  // Form State for Active Installment (Add or Edit)
  const [instAmount, setInstAmount] = useState('');
  const [instDateTime, setInstDateTime] = useState(() => toDateTimeLocalString(new Date()));
  const [instMode, setInstMode] = useState('BANK_TRANSFER');
  const [instRef, setInstRef] = useState('');
  const [instImage, setInstImage] = useState(null);
  const [instNotes, setInstNotes] = useState('');
  const [compressionInfo, setCompressionInfo] = useState(null);
  const [isCompressing, setIsCompressing] = useState(false);
  const [showLiveCamera, setShowLiveCamera] = useState(false);
  const [zoomImageSrc, setZoomImageSrc] = useState(null);

  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  // Calculate live financial metrics
  const totalPaid = installments.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  const balanceDue = Math.max(0, Math.round((totalPayable - totalPaid) * 100) / 100);
  
  let settlementStatus = 'UNPAID';
  if (totalPaid >= totalPayable && totalPayable > 0) {
    settlementStatus = 'PAID';
  } else if (totalPaid > 0) {
    settlementStatus = 'PARTIALLY_PAID';
  }

  // Pre-fill form when editing an installment
  const handleSelectForEdit = (item) => {
    setEditingId(item.id);
    setInstAmount(String(item.amount || ''));
    setInstDateTime(toDateTimeLocalString(item.paymentDate || new Date()));
    setInstMode(item.paymentMode || 'BANK_TRANSFER');
    setInstRef(item.paymentRef || '');
    setInstImage(item.paymentImage || null);
    setInstNotes(item.paymentNotes || '');
    setCompressionInfo(null);
    setFormError('');
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    resetFormFields();
  };

  const resetFormFields = () => {
    setEditingId(null);
    setInstAmount('');
    setInstDateTime(toDateTimeLocalString(new Date()));
    setInstMode('BANK_TRANSFER');
    setInstRef('');
    setInstImage(null);
    setInstNotes('');
    setCompressionInfo(null);
    setFormError('');
  };

  // If initialEditIndex provided on open, trigger edit
  useEffect(() => {
    if (initialEditIndex !== null && installments[initialEditIndex]) {
      handleSelectForEdit(installments[initialEditIndex]);
    }
  }, [initialEditIndex]);

  // Image Processing
  const processImageFile = async (file) => {
    if (!file) return;
    setIsCompressing(true);
    setFormError('');
    try {
      const result = await compressImage(file);
      setInstImage(result.dataUrl);
      setCompressionInfo({
        originalKB: result.originalKB,
        compressedKB: result.compressedKB,
        savedPercent: result.savedPercent,
      });
    } catch (err) {
      console.error('Image compression error:', err);
      const reader = new FileReader();
      reader.onload = (e) => setInstImage(e.target.result);
      reader.readAsDataURL(file);
    } finally {
      setIsCompressing(false);
    }
  };

  // Save or Update Installment in local state
  const handleSaveInstallment = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    setFormError('');

    const amt = parseFloat(instAmount);
    if (isNaN(amt) || amt <= 0) {
      setFormError('Please enter a valid installment amount greater than ₹0.');
      return;
    }

    if (!instDateTime) {
      setFormError('Please select payment date and time.');
      return;
    }

    if (editingId) {
      // Update existing installment
      setInstallments(prev => prev.map(item => {
        if (item.id === editingId) {
          return {
            ...item,
            amount: amt,
            paymentDate: new Date(instDateTime).toISOString(),
            paymentMode: instMode,
            paymentRef: instRef.trim() || null,
            paymentImage: instImage,
            paymentNotes: instNotes.trim() || null,
            updatedAt: new Date().toISOString()
          };
        }
        return item;
      }));
      resetFormFields();
    } else {
      // Add new installment
      const newEntry = {
        id: `inst_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        amount: amt,
        paymentDate: new Date(instDateTime).toISOString(),
        paymentMode: instMode,
        paymentRef: instRef.trim() || null,
        paymentImage: instImage,
        paymentNotes: instNotes.trim() || null,
        createdAt: new Date().toISOString()
      };
      setInstallments(prev => [...prev, newEntry]);
      resetFormFields();
    }
  };

  // Delete an installment
  const handleDeleteInstallment = (idToDelete) => {
    Swal.fire({
      title: 'Remove Installment?',
      text: 'Are you sure you want to remove this payment entry? Remaining balance due will be recalculated.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#e11d48',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Yes, remove'
    }).then((result) => {
      if (result.isConfirmed) {
        if (editingId === idToDelete) {
          handleCancelEdit();
        }
        setInstallments(prev => prev.filter(item => item.id !== idToDelete));
      }
    });
  };

  // Reset to Unpaid
  const handleResetToUnpaid = () => {
    Swal.fire({
      title: 'Mark Order as Unpaid?',
      text: 'This will clear all payment installment entries and reset total paid to ₹0.00.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d97706',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Yes, reset to Unpaid'
    }).then((result) => {
      if (result.isConfirmed) {
        setInstallments([]);
        resetFormFields();
      }
    });
  };

  // Quick fill remaining balance
  const handleQuickFillBalance = () => {
    if (balanceDue > 0) {
      setInstAmount(balanceDue.toFixed(2));
    }
  };

  // Submit all changes to backend
  const handleFinalSubmit = async () => {
    setIsSubmitting(true);
    setFormError('');

    try {
      const response = await api.patch(`/rm/po/${po.id}/payment`, {
        paymentStatus: settlementStatus,
        paidAmount: totalPaid,
        paymentHistory: installments,
      });

      Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'success',
        title: `Settlement Updated for ${po.referenceNo || po.rmId}`,
        html: `<span class="text-xs">Status: <b>${settlementStatus}</b> · Total Paid: <b>₹${totalPaid.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</b> (${installments.length} installment${installments.length === 1 ? '' : 's'})</span>`,
        showConfirmButton: false,
        timer: 3500,
        timerProgressBar: true
      });

      if (onUpdated) onUpdated(response.data);
      if (onClose) onClose();
    } catch (err) {
      console.error('Failed to update payment settlement:', err);
      setFormError(err.response?.data?.error || 'Failed to update payment settlement. Please check the network.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Keyboard shortcut Esc
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !showLiveCamera && !zoomImageSrc) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, showLiveCamera, zoomImageSrc]);

  const activeModeConfig = PAYMENT_MODES.find(m => m.id === instMode) || PAYMENT_MODES[1];

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div 
        className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200/80 dark:border-slate-800 w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/80 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 border border-indigo-100 dark:border-indigo-900/50 shadow-2xs">
              <CreditCard className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-bold text-slate-900 dark:text-white truncate">
                  Update Payment Settlement
                </h3>
                <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-md bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-900">
                  {po.referenceNo || po.rmId}
                </span>
                <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full border ${
                  settlementStatus === 'PAID'
                    ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'
                    : settlementStatus === 'PARTIALLY_PAID'
                    ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800'
                    : 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800'
                }`}>
                  {settlementStatus === 'PAID' ? 'Fully Paid' : settlementStatus === 'PARTIALLY_PAID' ? 'Partially Paid' : 'Unpaid'}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                Supplier: <span className="font-semibold text-slate-700 dark:text-slate-300">{po.supplierName || po.supplier?.name || 'N/A'}</span>
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 h-8 w-8"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Scrollable Content Body */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-5">
          {/* 3 Metric Cards */}
          <div className="grid grid-cols-3 gap-2.5">
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 text-center shadow-2xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 block">Total Payable</span>
              <span className="text-sm sm:text-base font-extrabold font-mono text-slate-900 dark:text-slate-100 mt-0.5 block truncate">
                ₹{totalPayable.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            <div className="p-3 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/70 dark:border-emerald-900/50 text-center shadow-2xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 block">Amount Paid</span>
              <span className="text-sm sm:text-base font-extrabold font-mono text-emerald-700 dark:text-emerald-300 mt-0.5 block truncate">
                ₹{totalPaid.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            <div className="p-3 rounded-xl bg-rose-50/70 dark:bg-rose-950/30 border border-rose-200/70 dark:border-rose-900/50 text-center shadow-2xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400 block">Balance Due</span>
              <span className="text-sm sm:text-base font-extrabold font-mono text-rose-700 dark:text-rose-300 mt-0.5 block truncate">
                ₹{balanceDue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          {/* SECTION A: Add / Edit Installment Form */}
          <div className={`rounded-2xl border p-4 transition-all shadow-xs ${
            editingId 
              ? 'bg-amber-50/30 dark:bg-amber-950/20 border-amber-300 dark:border-amber-800' 
              : 'bg-slate-50/60 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800'
          }`}>
            <div className="flex items-center justify-between pb-3 border-b border-slate-200/70 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${editingId ? 'bg-amber-500 animate-pulse' : 'bg-indigo-600'}`} />
                <h4 className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white uppercase tracking-wider">
                  {editingId ? 'Editing Selected Installment' : 'Record Payment Installment'}
                </h4>
              </div>
              {editingId && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleCancelEdit}
                  className="h-7 text-xs rounded-lg border-amber-300 dark:border-amber-800 text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-950 cursor-pointer font-bold"
                >
                  Cancel Edit
                </Button>
              )}
            </div>

            <div className="space-y-3.5 pt-3">
              {/* Row 1: Amount & DateTime Picker */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Installment Amount */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <IndianRupee className="w-3.5 h-3.5 text-indigo-500" />
                      <span>Installment Amount (₹) *</span>
                    </Label>
                    {!editingId && balanceDue > 0 && (
                      <button
                        type="button"
                        onClick={handleQuickFillBalance}
                        className="text-[10.5px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                      >
                        Fill Balance (₹{balanceDue.toFixed(2)})
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">₹</span>
                    <Input
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={instAmount}
                      onChange={(e) => setInstAmount(e.target.value)}
                      placeholder="0.00"
                      className="pl-7 h-9 text-xs font-mono font-bold rounded-xl border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                    />
                  </div>
                </div>

                {/* Date & Time Picker */}
                <div className="space-y-1">
                  <Label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-indigo-500" />
                    <span>Payment Date & Exact Time *</span>
                  </Label>
                  <Input
                    type="datetime-local"
                    value={instDateTime}
                    onChange={(e) => setInstDateTime(e.target.value)}
                    className="h-9 text-xs font-mono rounded-xl border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                  />
                </div>
              </div>

              {/* Row 2: Payment Mode */}
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                  <span>Payment Mode / Channel</span>
                  <span className="text-[10px] text-slate-400">Choose mode</span>
                </Label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  {PAYMENT_MODES.slice(0, 8).map((mode) => {
                    const Icon = mode.icon;
                    const isSelected = instMode === mode.id;
                    return (
                      <button
                        key={mode.id}
                        type="button"
                        onClick={() => setInstMode(mode.id)}
                        className={`flex items-center gap-2 p-2 rounded-xl text-left border text-xs font-semibold transition-all cursor-pointer ${
                          isSelected
                            ? `${mode.color} ring-2 ring-indigo-500/30 shadow-xs font-bold`
                            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                        }`}
                      >
                        <div className={`p-1 rounded-lg ${isSelected ? 'bg-white dark:bg-slate-900' : 'bg-slate-100 dark:bg-slate-800'}`}>
                          <Icon className="w-3.5 h-3.5" />
                        </div>
                        <span className="truncate text-[11px]">{mode.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Row 3: Reference & Notes */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                    <span>Reference / UTR / Transaction No.</span>
                    <span className="text-[10px] text-slate-400 font-normal">Optional</span>
                  </Label>
                  <Input
                    type="text"
                    value={instRef}
                    onChange={(e) => setInstRef(e.target.value)}
                    placeholder={activeModeConfig.placeholder}
                    className="h-9 text-xs rounded-xl border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                    <span>Installment Notes & Remarks</span>
                    <span className="text-[10px] text-slate-400 font-normal">Optional</span>
                  </Label>
                  <Input
                    type="text"
                    value={instNotes}
                    onChange={(e) => setInstNotes(e.target.value)}
                    placeholder="E.g. Day 1 advance paid from HDFC, Day 2 remaining..."
                    className="h-9 text-xs rounded-xl border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                  />
                </div>
              </div>

              {/* Row 4: Image Upload / Camera for this installment */}
              <div className="space-y-1.5 pt-0.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <ImageIcon className="w-3.5 h-3.5 text-indigo-500" />
                    <span>Receipt Photo / Voucher for this Installment</span>
                  </Label>
                  {compressionInfo && (
                    <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800 flex items-center gap-1">
                      <Sparkles className="w-3 h-3" />
                      {compressionInfo.compressedKB} KB ({compressionInfo.savedPercent}% saved)
                    </span>
                  )}
                </div>

                {/* Hidden File Pickers */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) processImageFile(file);
                  }}
                />
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) processImageFile(file);
                  }}
                />

                {instImage ? (
                  <div className="p-2.5 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-slate-900 flex items-center justify-between gap-3 shadow-2xs">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div 
                        className="w-12 h-12 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden bg-slate-100 dark:bg-slate-800 shrink-0 cursor-pointer relative group"
                        onClick={() => setZoomImageSrc(instImage)}
                        title="Click to zoom image"
                      >
                        <img 
                          src={resolvePaymentImageUrl(instImage)} 
                          alt="Receipt thumbnail" 
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform" 
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                          <ZoomIn className="w-3.5 h-3.5 text-white" />
                        </div>
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                          Receipt Image Attached
                        </p>
                        <p className="text-[10px] text-slate-400">
                          Ready to save with this installment
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setZoomImageSrc(instImage)}
                        className="h-7 px-2 text-xs rounded-lg text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 cursor-pointer"
                      >
                        <Eye className="w-3 h-3 mr-1 text-indigo-500" />
                        Zoom
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setInstImage(null);
                          setCompressionInfo(null);
                          if (fileInputRef.current) fileInputRef.current.value = '';
                          if (cameraInputRef.current) cameraInputRef.current.value = '';
                        }}
                        className="h-7 w-7 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/60 cursor-pointer"
                        title="Remove Image"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (/Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)) {
                          cameraInputRef.current?.click();
                        } else {
                          setShowLiveCamera(true);
                        }
                      }}
                      className="flex items-center justify-center gap-1.5 p-2 rounded-xl border border-emerald-200 dark:border-emerald-800/80 bg-emerald-50/40 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100/60 transition-all font-bold text-xs cursor-pointer shadow-2xs"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      <span>Take Camera Photo</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="flex items-center justify-center gap-1.5 p-2 rounded-xl border border-indigo-200 dark:border-indigo-800/80 bg-indigo-50/40 dark:bg-indigo-950/20 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100/60 transition-all font-bold text-xs cursor-pointer shadow-2xs"
                    >
                      <UploadCloud className="w-3.5 h-3.5" />
                      <span>Upload Receipt</span>
                    </button>
                  </div>
                )}

                {isCompressing && (
                  <div className="p-1.5 text-xs text-indigo-600 flex items-center gap-1.5">
                    <RefreshCw className="w-3 h-3 animate-spin" />
                    <span>Compressing photo...</span>
                  </div>
                )}
              </div>

              {/* Add / Update Installment Button */}
              <div className="pt-1 flex items-center justify-end">
                <Button
                  type="button"
                  onClick={handleSaveInstallment}
                  className={`text-xs h-8 px-4 rounded-xl font-bold shadow-xs cursor-pointer text-white ${
                    editingId 
                      ? 'bg-amber-600 hover:bg-amber-700' 
                      : 'bg-indigo-600 hover:bg-indigo-700'
                  }`}
                >
                  {editingId ? (
                    <>
                      <Check className="w-3.5 h-3.5 mr-1" />
                      Update Installment Amount & Details
                    </>
                  ) : (
                    <>
                      <Plus className="w-3.5 h-3.5 mr-1" />
                      Add This Installment Payment
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>

          {/* SECTION B: Payment History & Installments Log */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-indigo-500" />
                <span>Payment Installments Log ({installments.length})</span>
              </h4>
              <span className="text-[11px] font-semibold text-slate-400">
                Click Edit to modify any payment or its receipt photo
              </span>
            </div>

            {installments.length === 0 ? (
              <div className="p-6 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 text-center space-y-2 bg-slate-50/50 dark:bg-slate-900/30">
                <AlertCircle className="w-8 h-8 text-amber-500 mx-auto opacity-70" />
                <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  No payment installments recorded yet
                </p>
                <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                  Add day 1 advance payment above, or pay full balance in one transaction.
                </p>
                {balanceDue > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleQuickFillBalance}
                    className="text-xs h-7 rounded-lg border-indigo-200 text-indigo-600 font-bold"
                  >
                    Quick Pay Full Balance (₹{balanceDue.toFixed(2)})
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {installments.map((inst, index) => {
                  const modeObj = PAYMENT_MODES.find(m => m.id === inst.paymentMode) || { label: inst.paymentMode || 'Payment', icon: CreditCard };
                  const ModeIcon = modeObj.icon || CreditCard;
                  const isBeingEdited = editingId === inst.id;

                  return (
                    <div 
                      key={inst.id || index}
                      className={`p-3 rounded-2xl border transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
                        isBeingEdited 
                          ? 'border-amber-400 bg-amber-50/40 dark:bg-amber-950/30 ring-2 ring-amber-400/30' 
                          : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 shadow-2xs hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0 w-full sm:w-auto flex-1">
                        {/* Installment Badge */}
                        <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex flex-col items-center justify-center shrink-0 border border-slate-200 dark:border-slate-700">
                          <span className="text-[9px] font-bold uppercase text-slate-400">Inst.</span>
                          <span className="text-xs font-black font-mono">#{index + 1}</span>
                        </div>

                        {/* Amount & Date */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-black font-mono text-emerald-700 dark:text-emerald-300">
                              ₹{Number(inst.amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                              <ModeIcon className="w-3 h-3 text-indigo-500" />
                              {modeObj.label}
                            </span>
                            {inst.paymentRef && (
                              <span className="font-mono text-[10px] text-slate-500 bg-slate-50 dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700 truncate max-w-[130px]">
                                Ref: {inst.paymentRef}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                            <span className="flex items-center gap-1 font-mono text-[10.5px]">
                              <Calendar className="w-3 h-3 text-slate-400" />
                              {formatPaymentDateTime(inst.paymentDate)}
                            </span>
                            {inst.paymentNotes && (
                              <span className="italic truncate max-w-[200px]" title={inst.paymentNotes}>
                                • "{inst.paymentNotes}"
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Receipt Thumbnail if attached */}
                        {inst.paymentImage && (
                          <div 
                            className="w-11 h-11 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden bg-slate-100 dark:bg-slate-800 shrink-0 cursor-pointer relative group shadow-2xs"
                            onClick={() => setZoomImageSrc(inst.paymentImage)}
                            title="Click to zoom receipt"
                          >
                            <img 
                              src={resolvePaymentImageUrl(inst.paymentImage)} 
                              alt={`Receipt #${index + 1}`} 
                              className="w-full h-full object-cover group-hover:scale-110 transition-transform" 
                            />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                              <ZoomIn className="w-3 h-3 text-white" />
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Actions: Edit & Delete */}
                      <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleSelectForEdit(inst)}
                          className="h-7 px-2.5 text-xs rounded-lg text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-indigo-50 hover:text-indigo-600 font-bold gap-1 cursor-pointer"
                        >
                          <Edit className="w-3 h-3 text-indigo-500" />
                          Edit
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteInstallment(inst.id)}
                          className="h-7 w-7 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/60 cursor-pointer"
                          title="Delete Installment"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {formError && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3.5 sm:px-5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/80 flex items-center justify-between gap-2 shrink-0">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleResetToUnpaid}
            disabled={isSubmitting || installments.length === 0}
            className="text-xs text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 h-8 rounded-xl font-bold cursor-pointer"
          >
            <RotateCcw className="w-3 h-3 mr-1" />
            Reset to Unpaid
          </Button>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-xl text-xs h-8 cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleFinalSubmit}
              disabled={isSubmitting}
              className={`rounded-xl text-xs h-8 font-bold px-4 shadow-sm cursor-pointer text-white ${
                settlementStatus === 'PAID'
                  ? 'bg-emerald-600 hover:bg-emerald-700'
                  : settlementStatus === 'PARTIALLY_PAID'
                  ? 'bg-indigo-600 hover:bg-indigo-700'
                  : 'bg-amber-600 hover:bg-amber-700'
              }`}
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1.5" />
                  Saving Settlement...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                  Save & Settle (₹{totalPaid.toFixed(2)})
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Live Camera Modal */}
      {showLiveCamera && (
        <LiveCameraModal
          onCapture={(result) => {
            if (typeof result === 'string') {
              setInstImage(result);
            } else if (result?.dataUrl) {
              setInstImage(result.dataUrl);
              setCompressionInfo({
                originalKB: result.originalKB,
                compressedKB: result.compressedKB,
                savedPercent: result.savedPercent,
              });
            }
            setShowLiveCamera(false);
          }}
          onClose={() => setShowLiveCamera(false)}
        />
      )}

      {/* Zoom Image Modal */}
      {zoomImageSrc && (
        <ImagePreviewModal
          src={zoomImageSrc}
          title={`Payment Receipt — ${po.referenceNo || po.rmId}`}
          onClose={() => setZoomImageSrc(null)}
        />
      )}
    </div>
  );
}

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * PaymentSettlementDetailsModal
 * Clean, read-only summary modal displaying all payment settlement details,
 * metrics, and full installment payment history with receipt zoom.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export function PaymentSettlementDetailsModal({ po, onClose, onEditPayment }) {
  const [zoomImage, setZoomImage] = useState(null);

  if (!po) return null;

  const totalPayable = Number(po.grandTotal && Number(po.grandTotal) > 0 ? po.grandTotal : po.amount || 0);
  const paidVal = Number(po.paidAmount !== undefined && po.paidAmount !== null ? po.paidAmount : (po.paymentStatus === 'PAID' ? totalPayable : 0));
  const dueVal = Math.max(0, totalPayable - paidVal);
  const currentStatus = po.paymentStatus || (paidVal >= totalPayable && totalPayable > 0 ? 'PAID' : paidVal > 0 ? 'PARTIALLY_PAID' : 'UNPAID');

  const installments = getInitialInstallments(po);

  const statusConfig = {
    PAID: {
      label: 'Fully Paid',
      badge: 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800',
      dot: 'bg-emerald-500',
    },
    PARTIALLY_PAID: {
      label: 'Partial Advance Settled',
      badge: 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800',
      dot: 'bg-indigo-500',
    },
    UNPAID: {
      label: 'Unpaid / Payment Due',
      badge: 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800',
      dot: 'bg-amber-500',
    },
  }[currentStatus] || {
    label: currentStatus,
    badge: 'bg-slate-100 text-slate-700 border-slate-200',
    dot: 'bg-slate-400',
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden transform transition-all cursor-default flex flex-col max-h-[90vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-50 to-indigo-50/40 dark:from-slate-900 dark:to-slate-800/80 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600/10 dark:bg-indigo-400/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-200/50 dark:border-indigo-800/50 shrink-0">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white">
                  Payment Settlement Details
                </h3>
                <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300">
                  {po.referenceNo || po.rmId}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate max-w-[250px]">
                Supplier: <span className="font-semibold text-slate-700 dark:text-slate-300">{po.supplierName || po.supplier?.name || '—'}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1">
          {/* Status Chip */}
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Settlement Status</span>
            <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-extrabold ${statusConfig.badge}`}>
              <span className={`w-2 h-2 rounded-full ${statusConfig.dot}`} />
              <span>{statusConfig.label}</span>
            </div>
          </div>

          {/* 3 Metric Cards */}
          <div className="grid grid-cols-3 gap-2">
            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800 text-center">
              <span className="text-[10px] font-bold text-slate-400 block uppercase">Total Payable</span>
              <span className="text-xs sm:text-sm font-extrabold font-mono text-slate-900 dark:text-slate-100 mt-0.5 block truncate">
                ₹{totalPayable.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            <div className="p-2.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200/70 dark:border-emerald-800/60 text-center">
              <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 block uppercase">Amount Paid</span>
              <span className="text-xs sm:text-sm font-extrabold font-mono text-emerald-700 dark:text-emerald-300 mt-0.5 block truncate">
                ₹{paidVal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            <div className="p-2.5 rounded-xl bg-rose-50/70 dark:bg-rose-950/40 border border-rose-200/70 dark:border-rose-800/60 text-center">
              <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400 block uppercase">Balance Due</span>
              <span className="text-xs sm:text-sm font-extrabold font-mono text-rose-700 dark:text-rose-300 mt-0.5 block truncate">
                ₹{dueVal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          {/* Installment History Log */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Installment History ({installments.length})
              </span>
              <span className="text-[10px] text-slate-400">Click photo to zoom</span>
            </div>

            {installments.length === 0 ? (
              <div className="p-4 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-center text-xs text-slate-400">
                No payment history recorded yet.
              </div>
            ) : (
              <div className="space-y-2">
                {installments.map((inst, idx) => {
                  const modeObj = PAYMENT_MODES.find(m => m.id === inst.paymentMode) || { label: inst.paymentMode || 'Payment', icon: CreditCard };
                  const ModeIcon = modeObj.icon || CreditCard;

                  return (
                    <div 
                      key={inst.id || idx}
                      className="p-3 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 space-y-2 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-[10px] px-1.5 py-0.5 rounded bg-slate-200/70 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                            #{idx + 1}
                          </span>
                          <span className="font-extrabold font-mono text-sm text-emerald-700 dark:text-emerald-300">
                            ₹{Number(inst.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                        <span className="inline-flex items-center gap-1 font-semibold text-[11px] text-slate-700 dark:text-slate-300">
                          <ModeIcon className="w-3 h-3 text-indigo-500" />
                          {modeObj.label}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-[11px] pt-1 border-t border-slate-200/60 dark:border-slate-800">
                        <div>
                          <span className="text-slate-400 block text-[10px]">Payment Date & Time</span>
                          <span className="font-mono text-slate-700 dark:text-slate-300">
                            {formatPaymentDateTime(inst.paymentDate)}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[10px]">Reference / UTR</span>
                          <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">
                            {inst.paymentRef || 'Not provided'}
                          </span>
                        </div>
                      </div>

                      {inst.paymentNotes && (
                        <p className="text-[11px] text-slate-600 dark:text-slate-400 italic bg-white dark:bg-slate-900 p-1.5 rounded border border-slate-200/60 dark:border-slate-800">
                          "{inst.paymentNotes}"
                        </p>
                      )}

                      {/* Photo Thumbnail */}
                      {inst.paymentImage && (
                        <div 
                          className="flex items-center gap-2.5 p-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 cursor-pointer group"
                          onClick={() => setZoomImage(inst.paymentImage)}
                        >
                          <div className="w-10 h-10 rounded-md overflow-hidden bg-slate-100 dark:bg-slate-800 shrink-0 relative">
                            <img 
                              src={resolvePaymentImageUrl(inst.paymentImage)} 
                              alt="Receipt proof" 
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform" 
                            />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                              <ZoomIn className="w-3 h-3 text-white" />
                            </div>
                          </div>
                          <div className="min-w-0 flex-1">
                            <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200 block truncate">
                              Receipt Photo Attached
                            </span>
                            <span className="text-[10px] text-indigo-600 dark:text-indigo-400 flex items-center gap-1 font-semibold">
                              <Eye className="w-3 h-3" /> Click image or button to zoom
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-3.5 sm:p-4 bg-slate-50 dark:bg-slate-950/80 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            className="text-xs h-8 rounded-xl"
          >
            Close
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => {
              onClose();
              if (onEditPayment) onEditPayment();
            }}
            className="text-xs h-8 rounded-xl font-bold bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer shadow-xs gap-1.5"
          >
            <Edit className="w-3.5 h-3.5" />
            Update Payment Settlement
          </Button>
        </div>
      </div>

      {zoomImage && (
        <ImagePreviewModal
          src={zoomImage}
          title={`Payment Receipt — ${po.referenceNo || po.rmId}`}
          onClose={() => setZoomImage(null)}
        />
      )}
    </div>
  );
}

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * PaymentSettlementCardView
 * Embedded card section designed specifically for PODetailPage (/purchase-orders/:id).
 * Displays live settlement metrics, full installment timeline, zoom previews,
 * and quick-edit triggers.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export function PaymentSettlementCardView({ po, onOpenUpdateModal, onEditInstallment }) {
  const [zoomImageSrc, setZoomImageSrc] = useState(null);

  if (!po) return null;

  const totalPayable = Number(po.grandTotal && Number(po.grandTotal) > 0 ? po.grandTotal : po.amount || 0);
  const paidVal = Number(po.paidAmount !== undefined && po.paidAmount !== null ? po.paidAmount : (po.paymentStatus === 'PAID' ? totalPayable : 0));
  const dueVal = Math.max(0, totalPayable - paidVal);

  const isFullyPaid = (po.paymentStatus === 'PAID') || (paidVal >= totalPayable && totalPayable > 0);
  const isPartial = po.paymentStatus === 'PARTIALLY_PAID' || (paidVal > 0 && dueVal > 0);

  const installments = getInitialInstallments(po);

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 sm:p-6 shadow-sm space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-100 dark:border-indigo-900/50 shadow-2xs">
            <CreditCard className="w-4.5 h-4.5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              Payment & Settlement Details
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Multiple installment tracking, date-time logs, payment modes & receipt proof
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center px-2.5 py-1 text-xs font-black rounded-lg border uppercase tracking-wider ${
            isFullyPaid
              ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
              : isPartial
              ? 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800'
              : 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
          }`}>
            {isFullyPaid ? '🟢 FULLY PAID' : isPartial ? '🔵 PARTIALLY PAID' : '🔴 UNPAID'}
          </span>

          <Button
            variant="outline"
            size="sm"
            onClick={onOpenUpdateModal}
            className="text-xs h-8 rounded-xl border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 font-bold gap-1 cursor-pointer"
          >
            <Edit className="w-3.5 h-3.5" />
            Update Payment / Add Installment
          </Button>
        </div>
      </div>

      {/* 3 Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 text-center">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 block">Total Payable</span>
          <span className="text-lg font-extrabold font-mono text-slate-900 dark:text-slate-100 mt-0.5 block truncate">
            ₹{totalPayable.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </span>
        </div>
        <div className="p-3.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/70 dark:border-emerald-900/50 text-center">
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 block">Amount Paid</span>
          <span className="text-lg font-extrabold font-mono text-emerald-700 dark:text-emerald-300 mt-0.5 block truncate">
            ₹{paidVal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </span>
        </div>
        <div className="p-3.5 rounded-xl bg-rose-50/70 dark:bg-rose-950/30 border border-rose-200/70 dark:border-rose-900/50 text-center">
          <span className="text-[10px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400 block">Balance Due</span>
          <span className="text-lg font-extrabold font-mono text-rose-700 dark:text-rose-300 mt-0.5 block truncate">
            ₹{dueVal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </span>
        </div>
      </div>

      {/* Installments History Log */}
      <div className="space-y-3 pt-1">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-indigo-500" />
            Payment Installment History ({installments.length})
          </h4>
          <span className="text-[11px] text-slate-400 font-medium">
            {installments.length} payment recorded
          </span>
        </div>

        {installments.length === 0 ? (
          <div className="p-5 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 text-center space-y-1.5">
            <CreditCard className="w-6 h-6 text-slate-300 dark:text-slate-600 mx-auto" />
            <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">
              No payments recorded yet for this Purchase Order
            </p>
            <p className="text-[11px] text-slate-400">
              Click 'Update Payment' to record day 1 advance or full payment.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {installments.map((inst, index) => {
              const modeObj = PAYMENT_MODES.find(m => m.id === inst.paymentMode) || { label: inst.paymentMode || 'Payment', icon: CreditCard };
              const ModeIcon = modeObj.icon || CreditCard;

              return (
                <div 
                  key={inst.id || index}
                  className="p-3.5 rounded-xl border border-slate-200/90 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                >
                  <div className="flex items-center gap-3.5 min-w-0 flex-1">
                    {/* Badge */}
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex flex-col items-center justify-center shrink-0 border border-indigo-100 dark:border-indigo-900/50">
                      <span className="text-[9px] font-bold uppercase text-indigo-400">Day</span>
                      <span className="text-xs font-black font-mono">#{index + 1}</span>
                    </div>

                    {/* Details */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-base font-extrabold font-mono text-emerald-700 dark:text-emerald-300">
                          ₹{Number(inst.amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                          <ModeIcon className="w-3 h-3 text-indigo-500" />
                          {modeObj.label}
                        </span>
                        {inst.paymentRef && (
                          <span className="font-mono text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 rounded border border-indigo-200/60 dark:border-indigo-800">
                            Ref: {inst.paymentRef}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3 mt-1 text-xs text-slate-500 dark:text-slate-400 flex-wrap">
                        <span className="flex items-center gap-1 font-mono text-[11px]">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          {formatPaymentDateTime(inst.paymentDate)}
                        </span>
                        {inst.paymentNotes && (
                          <span className="italic text-slate-600 dark:text-slate-300">
                            • "{inst.paymentNotes}"
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Receipt thumbnail */}
                    {inst.paymentImage && (
                      <div 
                        className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden bg-white dark:bg-slate-800 shrink-0 cursor-pointer relative group shadow-xs"
                        onClick={() => setZoomImageSrc(inst.paymentImage)}
                        title="Click image to zoom"
                      >
                        <img 
                          src={resolvePaymentImageUrl(inst.paymentImage)} 
                          alt={`Receipt ${index + 1}`} 
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform" 
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                          <ZoomIn className="w-4 h-4 text-white" />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                    {inst.paymentImage && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setZoomImageSrc(inst.paymentImage)}
                        className="h-8 px-2.5 text-xs rounded-xl border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5 mr-1 text-indigo-500" />
                        View Proof
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => onEditInstallment ? onEditInstallment(index) : onOpenUpdateModal()}
                      className="h-8 px-2.5 text-xs rounded-xl border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 font-bold gap-1 cursor-pointer"
                    >
                      <Edit className="w-3.5 h-3.5" />
                      Edit
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Image Preview Modal */}
      {zoomImageSrc && (
        <ImagePreviewModal
          src={zoomImageSrc}
          title={`Payment Receipt — ${po.referenceNo || po.rmId}`}
          onClose={() => setZoomImageSrc(null)}
        />
      )}
    </div>
  );
}
