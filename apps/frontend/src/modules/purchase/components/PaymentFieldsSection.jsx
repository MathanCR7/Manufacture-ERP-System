import React, { useState, useRef, useEffect } from 'react';
import { 
  Banknote, Landmark, Smartphone, QrCode, FileText, 
  CreditCard, Link2, Wallet, UploadCloud, Image as ImageIcon, 
  X, Eye, Trash2, AlertCircle, CheckCircle2, IndianRupee, ZoomIn,
  Camera, Sparkles, RefreshCw, FlipHorizontal, ArrowLeft
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

export const PAYMENT_MODES = [
  { id: 'CASH', label: 'Cash', icon: Banknote, color: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800', placeholder: 'Voucher / Cash Receipt No.' },
  { id: 'BANK_TRANSFER', label: 'Bank Transfer (NEFT/RTGS)', icon: Landmark, color: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 border-blue-200 dark:border-blue-800', placeholder: 'Bank UTR / Transaction No.' },
  { id: 'UPI', label: 'UPI Payment', icon: Smartphone, color: 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 border-indigo-200 dark:border-indigo-800', placeholder: 'UPI Reference ID (12 digits) / UTR' },
  { id: 'QR_CODE', label: 'QR Code Scanner', icon: QrCode, color: 'text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/60 border-purple-200 dark:border-purple-800', placeholder: 'Scan Transaction ID / App Ref' },
  { id: 'CHEQUE', label: 'Cheque / DD', icon: FileText, color: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 border-amber-200 dark:border-amber-800', placeholder: 'Cheque No., Date & Bank Name' },
  { id: 'NET_BANKING', label: 'Net Banking', icon: Landmark, color: 'text-cyan-600 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-950/60 border-cyan-200 dark:border-cyan-800', placeholder: 'Online Banking Transaction Ref' },
  { id: 'CARD', label: 'Debit / Credit Card', icon: CreditCard, color: 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/60 border-rose-200 dark:border-rose-800', placeholder: 'Card Last 4 Digits / POS Auth Code' },
  { id: 'PAYMENT_LINK', label: 'Payment Link', icon: Link2, color: 'text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/60 border-sky-200 dark:border-sky-800', placeholder: 'Payment Gateway Link / Order ID' },
  { id: 'OTHER', label: 'Other Mode', icon: Wallet, color: 'text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700', placeholder: 'Payment Reference / Memo' },
];

/**
 * Resolves any relative URL (/uploads/payments/...) to the full backend URL,
 * while leaving Data URLs or external URLs untouched.
 */
export function resolvePaymentImageUrl(url) {
  if (!url) return '';
  if (url.startsWith('data:') || url.startsWith('blob:') || url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
  const backendBase = apiBase.replace(/\/api\/?$/, '');
  const cleanPath = url.startsWith('/') ? url : `/${url}`;
  return `${backendBase}${cleanPath}`;
}

/**
 * Fast client-side image compression using HTML5 Canvas.
 * Compresses 5MB-15MB phone photos down to ~120KB-200KB in WebP/JPEG,
 * maintaining high sharpness (max 1600px width/height).
 */
export async function compressImage(fileOrDataUrl, maxWidth = 1600, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const processImageSource = (src, originalBytes) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxWidth || height > maxWidth) {
          if (width > height) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxWidth) / height);
            height = maxWidth;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        let compressedDataUrl = canvas.toDataURL('image/webp', quality);
        if (!compressedDataUrl.startsWith('data:image/webp')) {
          compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
        }

        const compressedBytes = Math.round((compressedDataUrl.length * 3) / 4);
        const origBytes = originalBytes || Math.round((src.length * 3) / 4);
        const savedPercent = origBytes > compressedBytes 
          ? Math.round(((origBytes - compressedBytes) / origBytes) * 100) 
          : 0;

        resolve({
          dataUrl: compressedDataUrl,
          originalBytes: origBytes,
          compressedBytes,
          originalKB: (origBytes / 1024).toFixed(1),
          compressedKB: (compressedBytes / 1024).toFixed(1),
          savedPercent,
        });
      };
      img.onerror = () => reject(new Error('Failed to load image for compression'));
      img.src = src;
    };

    if (typeof fileOrDataUrl === 'string') {
      processImageSource(fileOrDataUrl, Math.round((fileOrDataUrl.length * 3) / 4));
    } else if (fileOrDataUrl instanceof Blob || fileOrDataUrl instanceof File) {
      const reader = new FileReader();
      reader.onload = (e) => processImageSource(e.target.result, fileOrDataUrl.size);
      reader.onerror = () => reject(new Error('Failed to read image file'));
      reader.readAsDataURL(fileOrDataUrl);
    } else {
      reject(new Error('Invalid image source'));
    }
  });
}

/**
 * Interactive Live Camera Viewfinder Modal
 */
export function LiveCameraModal({ onCapture, onClose }) {
  const videoRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [cameraError, setCameraError] = useState('');
  const [capturedPhoto, setCapturedPhoto] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    let activeStream = null;

    const startCamera = async () => {
      try {
        setCameraError('');
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1920 },
            height: { ideal: 1080 }
          }
        });
        activeStream = mediaStream;
        setStream(mediaStream);
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
      } catch (err) {
        console.error('Camera access error:', err);
        setCameraError(
          err.name === 'NotAllowedError'
            ? 'Camera permission denied. Please allow camera permissions in browser settings or use the file upload.'
            : 'No active camera found or camera is being used by another application.'
        );
      }
    };

    startCamera();

    return () => {
      if (activeStream) {
        activeStream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const handleSnap = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    setCapturedPhoto(dataUrl);
  };

  const handleConfirm = async () => {
    if (!capturedPhoto) return;
    setIsProcessing(true);
    try {
      const compressed = await compressImage(capturedPhoto);
      onCapture(compressed);
      onClose();
    } catch (err) {
      console.error(err);
      onCapture({ dataUrl: capturedPhoto, compressedKB: '—', savedPercent: 0 });
      onClose();
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-[110] bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div 
        className="bg-slate-900 border border-slate-800 text-white rounded-2xl shadow-2xl max-w-xl w-full overflow-hidden flex flex-col animate-in zoom-in-95 duration-150"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between bg-slate-950">
          <div className="flex items-center gap-2">
            <Camera className="w-4 h-4 text-emerald-400" />
            <h4 className="text-sm font-bold text-white">Live Camera — Capture Payment Receipt</h4>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-7 w-7 rounded-lg text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Viewfinder / Preview */}
        <div className="relative bg-black flex items-center justify-center min-h-[300px] max-h-[60vh] overflow-hidden">
          {cameraError ? (
            <div className="p-6 text-center space-y-3">
              <AlertCircle className="w-10 h-10 text-rose-500 mx-auto" />
              <p className="text-xs text-rose-300 font-semibold max-w-sm">{cameraError}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={onClose}
                className="text-xs text-slate-300 border-slate-700 hover:bg-slate-800"
              >
                Close & Use Gallery Upload
              </Button>
            </div>
          ) : capturedPhoto ? (
            <div className="relative w-full h-full flex items-center justify-center bg-black">
              <img 
                src={capturedPhoto} 
                alt="Captured receipt" 
                className="max-h-[55vh] w-auto max-w-full object-contain"
              />
              <div className="absolute top-3 left-3 bg-black/70 backdrop-blur-xs px-2.5 py-1 rounded-full text-[11px] font-bold text-emerald-400 border border-emerald-500/40">
                Photo Captured — Review & Confirm
              </div>
            </div>
          ) : (
            <div className="relative w-full h-full flex items-center justify-center">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full max-h-[55vh] object-cover"
              />
              {/* Receipt Alignment Framing Guide */}
              <div className="absolute inset-4 sm:inset-8 border-2 border-dashed border-emerald-400/70 rounded-xl pointer-events-none flex flex-col justify-between p-2">
                <span className="text-[10px] font-mono uppercase bg-black/60 text-emerald-300 px-2 py-0.5 rounded self-start font-bold">
                  Align receipt or transfer voucher within frame
                </span>
                <span className="text-[10px] font-mono bg-black/60 text-slate-300 px-2 py-0.5 rounded self-end">
                  Hold steady
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Action Controls */}
        <div className="p-3.5 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            className="text-xs border-slate-800 text-slate-400 hover:text-white"
          >
            Cancel
          </Button>

          {capturedPhoto ? (
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleRetake}
                className="text-xs border-slate-700 text-slate-200 hover:bg-slate-800 gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Retake
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleConfirm}
                disabled={isProcessing}
                className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-1.5 px-4 shadow-sm"
              >
                {isProcessing ? 'Compressing...' : <><CheckCircle2 className="w-3.5 h-3.5" /> Use This Photo</>}
              </Button>
            </div>
          ) : (
            <Button
              type="button"
              onClick={handleSnap}
              disabled={!!cameraError}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-9 px-5 rounded-xl shadow-md gap-2"
            >
              <Camera className="w-4 h-4" /> Snap Receipt
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Fullscreen Image Zoom Preview Modal
 */
export function ImagePreviewModal({ src, title = 'Payment Proof', onClose }) {
  React.useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!src) return null;
  const resolvedSrc = resolvePaymentImageUrl(src);

  return (
    <div 
      className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div 
        className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 max-w-3xl max-h-[92vh] w-full overflow-hidden flex flex-col animate-in zoom-in-95 duration-150"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-950/70">
          <div className="flex items-center gap-2">
            <ImageIcon className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">{title}</h4>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-7 w-7 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
        <div className="p-4 flex-1 overflow-auto flex items-center justify-center bg-slate-950/5 dark:bg-black/40">
          <img 
            src={resolvedSrc} 
            alt={title} 
            className="max-h-[72vh] w-auto max-w-full rounded-xl object-contain shadow-md border border-slate-200/50 dark:border-slate-800"
          />
        </div>
        <div className="px-4 py-2.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 flex items-center justify-between text-xs text-slate-500">
          <span>Click outside or Esc to close</span>
          <a
            href={resolvedSrc}
            download="payment-proof"
            target="_blank"
            rel="noopener noreferrer"
            className="text-indigo-600 dark:text-indigo-400 hover:underline font-semibold"
          >
            Open Original File
          </a>
        </div>
      </div>
    </div>
  );
}

export default function PaymentFieldsSection({
  paymentStatus = 'UNPAID',
  setPaymentStatus,
  paidAmount = 0,
  setPaidAmount,
  paymentMode = 'BANK_TRANSFER',
  setPaymentMode,
  paymentRef = '',
  setPaymentRef,
  paymentImage = null,
  setPaymentImage,
  paymentNotes = '',
  setPaymentNotes,
  totalAmount = 0,
  isCompact = false,
}) {
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  const [isDragging, setIsDragging] = useState(false);
  const [showFullImage, setShowFullImage] = useState(false);
  const [showLiveCameraModal, setShowLiveCameraModal] = useState(false);
  const [imageError, setImageError] = useState('');
  const [compressionInfo, setCompressionInfo] = useState(null);
  const [isCompressing, setIsCompressing] = useState(false);

  const numTotal = Number(totalAmount) || 0;
  const numPaid = Number(paidAmount) || 0;
  const numDue = Math.max(0, numTotal - numPaid);

  const activeModeConfig = PAYMENT_MODES.find(m => m.id === paymentMode) || PAYMENT_MODES[1];
  const isTemplateOpen = paymentStatus !== 'UNPAID';

  const handleAmountChange = (e) => {
    const rawVal = e.target.value;
    setPaidAmount(rawVal);

    if (rawVal === '') return;
    const val = parseFloat(rawVal);
    if (isNaN(val)) return;

    if (val >= numTotal && numTotal > 0) {
      if (paymentStatus !== 'PAID') setPaymentStatus('PAID');
    } else if (val > 0) {
      if (paymentStatus !== 'PARTIALLY_PAID') setPaymentStatus('PARTIALLY_PAID');
    }
  };

  const handleSetPreset = (percent) => {
    const calculated = Math.round(((numTotal * percent) / 100) * 100) / 100;
    setPaidAmount(calculated.toString());
    if (percent === 0) {
      setPaymentStatus('UNPAID');
    } else if (percent === 100) {
      setPaymentStatus('PAID');
    } else {
      setPaymentStatus('PARTIALLY_PAID');
    }
  };

  const handleStatusChange = (status) => {
    setPaymentStatus(status);
    if (status === 'UNPAID') {
      setPaidAmount('0');
    } else if (status === 'PAID') {
      setPaidAmount(numTotal.toString());
    } else if (status === 'PARTIALLY_PAID') {
      if (numPaid <= 0 || numPaid >= numTotal) {
        setPaidAmount((Math.round((numTotal / 2) * 100) / 100).toString());
      }
    }
  };

  const processImageFile = async (file) => {
    setImageError('');
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setImageError('Please select a valid image file (PNG, JPG, JPEG, WEBP).');
      return;
    }

    setIsCompressing(true);
    try {
      const result = await compressImage(file, 1600, 0.82);
      setPaymentImage(result.dataUrl);
      setCompressionInfo({
        originalKB: result.originalKB,
        compressedKB: result.compressedKB,
        savedPercent: result.savedPercent,
      });
    } catch (err) {
      console.error('Compression failed, falling back to raw image:', err);
      const reader = new FileReader();
      reader.onload = (e) => setPaymentImage(e.target.result);
      reader.readAsDataURL(file);
    } finally {
      setIsCompressing(false);
    }
  };

  const handleLiveCameraCapture = (capturedResult) => {
    if (!capturedResult) return;
    if (typeof capturedResult === 'string') {
      setPaymentImage(capturedResult);
    } else {
      setPaymentImage(capturedResult.dataUrl);
      setCompressionInfo({
        originalKB: capturedResult.originalKB || '—',
        compressedKB: capturedResult.compressedKB || '—',
        savedPercent: capturedResult.savedPercent || 0,
      });
    }
  };

  const handleRemoveImage = () => {
    setPaymentImage(null);
    setCompressionInfo(null);
    setImageError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
  };

  return (
    <div className="space-y-4">
      {/* ───────────────────────────────────────────────────────────────────
          1. Live Financial Settlement Cards
          ─────────────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-2 sm:gap-2.5">
        <div className="p-2 sm:p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 text-center">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 block">Total Payable</span>
          <span className="text-xs sm:text-sm md:text-base font-extrabold font-mono text-slate-900 dark:text-slate-100 mt-0.5 block truncate">
            ₹{numTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
        <div className="p-2 sm:p-2.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/70 dark:border-emerald-900/50 text-center">
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 block">Amount Paid</span>
          <span className="text-xs sm:text-sm md:text-base font-extrabold font-mono text-emerald-700 dark:text-emerald-300 mt-0.5 block truncate">
            ₹{numPaid.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
        <div className="p-2 sm:p-2.5 rounded-xl bg-rose-50/70 dark:bg-rose-950/30 border border-rose-200/70 dark:border-rose-900/50 text-center">
          <span className="text-[10px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400 block">Balance Due</span>
          <span className="text-xs sm:text-sm md:text-base font-extrabold font-mono text-rose-700 dark:text-rose-300 mt-0.5 block truncate">
            ₹{numDue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────────────────
          2. Payment Status Mode Selector
          ─────────────────────────────────────────────────────────────────── */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
            Payment Status
          </Label>
          <span className="text-[10px] font-semibold text-slate-400">
            {paymentStatus === 'PAID' ? 'Fully settled' : paymentStatus === 'PARTIALLY_PAID' ? 'Partially paid advance' : 'No payment made yet'}
          </span>
        </div>
        <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
          <button
            type="button"
            onClick={() => handleStatusChange('UNPAID')}
            className={`py-1.5 px-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              paymentStatus === 'UNPAID'
                ? 'bg-amber-500 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${paymentStatus === 'UNPAID' ? 'bg-white' : 'bg-amber-500'}`} />
            <span>Unpaid</span>
          </button>
          <button
            type="button"
            onClick={() => handleStatusChange('PARTIALLY_PAID')}
            className={`py-1.5 px-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              paymentStatus === 'PARTIALLY_PAID'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${paymentStatus === 'PARTIALLY_PAID' ? 'bg-white' : 'bg-indigo-500'}`} />
            <span>Partial</span>
          </button>
          <button
            type="button"
            onClick={() => handleStatusChange('PAID')}
            className={`py-1.5 px-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              paymentStatus === 'PAID'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${paymentStatus === 'PAID' ? 'bg-white' : 'bg-emerald-500'}`} />
            <span>Full Paid</span>
          </button>
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────────────────
          Conditional Payment Details Template (Only if NOT Unpaid)
          ─────────────────────────────────────────────────────────────────── */}
      {!isTemplateOpen ? (
        <div className="p-4 rounded-xl border border-dashed border-amber-200 dark:border-amber-800/60 bg-amber-50/40 dark:bg-amber-950/20 text-center space-y-2 animate-in fade-in duration-200">
          <AlertCircle className="w-5 h-5 text-amber-500 mx-auto" />
          <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">
            Payment status is currently set to <strong>UNPAID</strong>.
          </p>
          <p className="text-[11px] text-amber-700/80 dark:text-amber-400/80 max-w-md mx-auto">
            Payment mode, transaction reference ID, and receipt image upload will open when you choose Partial or Full Paid.
          </p>
          <div className="pt-1 flex items-center justify-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleStatusChange('PARTIALLY_PAID')}
              className="text-xs h-7 rounded-lg border-indigo-200 text-indigo-600 hover:bg-indigo-50 font-bold"
            >
              Record Partial Payment
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => handleStatusChange('PAID')}
              className="text-xs h-7 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
            >
              Record Full Payment
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3.5 pt-1 animate-in fade-in duration-200">
          {/* 3. Paid Amount Input with Presets */}
          <div className="space-y-1.5 bg-slate-50 dark:bg-slate-800/40 p-3 rounded-xl border border-slate-200/80 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <IndianRupee className="w-3.5 h-3.5 text-indigo-500" />
                <span>Amount Paid / Settled (₹)</span>
              </Label>
              <span className="text-[11px] font-mono text-slate-400">
                {paymentStatus === 'PAID' ? 'Settled in full' : 'Enter amount received'}
              </span>
            </div>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">₹</span>
              <Input
                type="number"
                step="0.01"
                min="0"
                max={numTotal > 0 ? numTotal : undefined}
                value={paidAmount}
                onChange={handleAmountChange}
                placeholder="0.00"
                className="pl-8 h-9 text-xs font-mono font-bold rounded-xl border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
              />
            </div>
            <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mr-1">Quick:</span>
              <button
                type="button"
                onClick={() => handleSetPreset(25)}
                className="text-[10.5px] font-bold px-2 py-0.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-indigo-50 hover:text-indigo-600 cursor-pointer transition-colors"
              >
                25%
              </button>
              <button
                type="button"
                onClick={() => handleSetPreset(50)}
                className="text-[10.5px] font-bold px-2 py-0.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-indigo-50 hover:text-indigo-600 cursor-pointer transition-colors"
              >
                50% Half
              </button>
              <button
                type="button"
                onClick={() => handleSetPreset(75)}
                className="text-[10.5px] font-bold px-2 py-0.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-indigo-50 hover:text-indigo-600 cursor-pointer transition-colors"
              >
                75%
              </button>
              <button
                type="button"
                onClick={() => handleSetPreset(100)}
                className="text-[10.5px] font-bold px-2 py-0.5 rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50/60 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 cursor-pointer transition-colors"
              >
                100% Full Paid
              </button>
            </div>
          </div>

          {/* 4. Payment Mode / Type of Payment */}
          <div className="space-y-1.5 pt-1">
            <Label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
              <span>Type of Payment (Payment Mode)</span>
              <span className="text-[10px] font-normal text-slate-400">Select payment channel</span>
            </Label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              {PAYMENT_MODES.map((mode) => {
                const Icon = mode.icon;
                const isSelected = paymentMode === mode.id;
                return (
                  <button
                    key={mode.id}
                    type="button"
                    onClick={() => setPaymentMode(mode.id)}
                    className={`flex items-center gap-2 p-2 rounded-xl text-left border text-xs font-semibold transition-all cursor-pointer ${
                      isSelected
                        ? `${mode.color} ring-2 ring-indigo-500/30 shadow-xs font-bold`
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                    }`}
                  >
                    <div className={`p-1 rounded-lg ${isSelected ? 'bg-white dark:bg-slate-900' : 'bg-slate-100 dark:bg-slate-800'}`}>
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <span className="truncate">{mode.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 5. Reference / Transaction ID */}
          <div className="space-y-1">
            <Label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
              <span>Reference / Transaction ID</span>
              <span className="text-[10px] font-medium text-slate-400">Optional</span>
            </Label>
            <Input
              type="text"
              value={paymentRef || ''}
              onChange={(e) => setPaymentRef(e.target.value)}
              placeholder={activeModeConfig.placeholder}
              className="h-9 text-xs rounded-xl border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono"
            />
          </div>

          {/* 6. Reference Image with Live Camera + Gallery + Canvas Compression */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <ImageIcon className="w-3.5 h-3.5 text-indigo-500" />
                <span>Reference Image / Receipt Proof</span>
              </Label>
              <div className="flex items-center gap-1.5">
                {compressionInfo && (
                  <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800 flex items-center gap-1">
                    <Sparkles className="w-3 h-3" />
                    {compressionInfo.compressedKB} KB ({compressionInfo.savedPercent}% saved)
                  </span>
                )}
                <span className="text-[10px] font-semibold text-slate-400 px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800">
                  Camera / Gallery
                </span>
              </div>
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

            {paymentImage ? (
              <div className="p-3 rounded-2xl border border-indigo-200 dark:border-indigo-800 bg-gradient-to-r from-indigo-50/50 via-white to-slate-50/50 dark:from-indigo-950/30 dark:via-slate-900 dark:to-slate-900/40 flex flex-col sm:flex-row items-center justify-between gap-3 animate-in fade-in duration-150">
                <div className="flex items-center gap-3 w-full sm:w-auto min-w-0">
                  <div 
                    className="w-14 h-14 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden bg-white dark:bg-slate-900 shrink-0 cursor-pointer relative group shadow-xs"
                    onClick={() => setShowFullImage(true)}
                    title="Click to view image fullscreen"
                  >
                    <img 
                      src={resolvePaymentImageUrl(paymentImage)} 
                      alt="Proof preview" 
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform" 
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                      <ZoomIn className="w-4 h-4 text-white" />
                    </div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">Payment Proof Attached</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      {paymentImage.startsWith('/uploads/') ? 'Stored on server disk' : 'Optimized & ready to save'}
                    </p>
                    {compressionInfo && (
                      <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium mt-0.5">
                        Compressed from {compressionInfo.originalKB} KB to {compressionInfo.compressedKB} KB
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 w-full sm:w-auto justify-end shrink-0">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowFullImage(true)}
                    className="h-8 px-2.5 text-xs rounded-xl text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5 mr-1 text-indigo-500" />
                    View
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowLiveCameraModal(true)}
                    className="h-8 px-2.5 text-xs rounded-xl text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 cursor-pointer"
                    title="Retake with Camera"
                  >
                    <Camera className="w-3.5 h-3.5 mr-1 text-emerald-500" />
                    Retake
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={handleRemoveImage}
                    className="h-8 w-8 rounded-xl text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/60 cursor-pointer"
                    title="Remove Image"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {/* 2-Option Action Bar: Live Camera or Gallery */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (/Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)) {
                        cameraInputRef.current?.click();
                      } else {
                        setShowLiveCameraModal(true);
                      }
                    }}
                    className="flex items-center justify-center gap-2 p-3 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100/70 hover:border-emerald-300 transition-all cursor-pointer font-bold text-xs shadow-2xs group"
                  >
                    <div className="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                      <Camera className="w-4 h-4" />
                    </div>
                    <span>Take Live Camera Photo</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center justify-center gap-2 p-3 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50/50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100/70 hover:border-indigo-300 transition-all cursor-pointer font-bold text-xs shadow-2xs group"
                  >
                    <div className="w-7 h-7 rounded-lg bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                      <UploadCloud className="w-4 h-4" />
                    </div>
                    <span>Upload from Gallery / Files</span>
                  </button>
                </div>

                {/* Drag and Drop Zone */}
                <div
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragging(false);
                    const file = e.dataTransfer.files?.[0];
                    if (file) processImageFile(file);
                  }}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-3 text-center cursor-pointer transition-all ${
                    isDragging
                      ? 'border-indigo-500 bg-indigo-50/70 dark:bg-indigo-950/50 scale-[0.99]'
                      : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 hover:bg-indigo-50/20 hover:border-indigo-300'
                  }`}
                >
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Or drag and drop screenshot here · Auto-compressed before upload
                  </p>
                </div>
              </div>
            )}

            {isCompressing && (
              <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 text-xs font-semibold flex items-center gap-2">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Optimizing and compressing receipt image...</span>
              </div>
            )}

            {imageError && (
              <div className="p-2 rounded-lg bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-[11px] font-semibold flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{imageError}</span>
              </div>
            )}
          </div>

          {/* 7. Payment Notes / Remarks Text */}
          <div className="space-y-1">
            <Label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
              <span>Payment Notes & Remarks</span>
              <span className="text-[10px] font-medium text-slate-400">Optional</span>
            </Label>
            <textarea
              value={paymentNotes || ''}
              onChange={(e) => setPaymentNotes(e.target.value)}
              rows={isCompact ? 2 : 2}
              placeholder="E.g. Advance paid from HDFC account, balance upon delivery, vendor notified via WhatsApp..."
              className="w-full border rounded-xl p-2.5 text-xs bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 hover:border-indigo-400 focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-500 resize-none font-medium text-slate-800 dark:text-slate-200"
            />
          </div>
        </div>
      )}

      {/* Full Preview Modal */}
      {showFullImage && (
        <ImagePreviewModal
          src={paymentImage}
          title={`Payment Proof — ${activeModeConfig.label}`}
          onClose={() => setShowFullImage(false)}
        />
      )}

      {/* Live Camera Viewfinder Modal */}
      {showLiveCameraModal && (
        <LiveCameraModal
          onCapture={handleLiveCameraCapture}
          onClose={() => setShowLiveCameraModal(false)}
        />
      )}
    </div>
  );
}
