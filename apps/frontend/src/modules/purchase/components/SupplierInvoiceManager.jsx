import React, { useState, useRef, useEffect } from 'react';
import { 
  FileText, UploadCloud, Image as ImageIcon, X, Eye, Trash2, 
  Download, AlertCircle, CheckCircle2, RefreshCw, Calendar, 
  ExternalLink, FileCheck, Check, Sparkles, File, Paperclip
} from 'lucide-react';
import { format } from 'date-fns';
import Swal from 'sweetalert2';
import { api } from '@/lib/axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

/**
 * Resolves any relative URL (/uploads/payments/...) to the full backend URL
 */
export function resolveInvoiceFileUrl(url) {
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
 * Checks whether the URL or data URL is a PDF document
 */
export function isPdfDocument(url) {
  if (!url) return false;
  const clean = url.split('?')[0].toLowerCase();
  return clean.endsWith('.pdf') || url.startsWith('data:application/pdf');
}

/**
 * Fullscreen / High-Res Preview Modal for both PDFs and Images
 */
export function InvoiceFilePreviewModal({ src, title = 'Supplier Invoice', poReference = '', invoiceNo = '', onClose }) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!src) return null;
  const resolvedSrc = resolveInvoiceFileUrl(src);
  const isPdf = isPdfDocument(src);

  const handleDownload = () => {
    const a = document.createElement('a');
    a.href = resolvedSrc;
    const cleanRef = (poReference || 'PO').replace(/[^a-zA-Z0-9_-]/g, '_');
    const cleanInv = invoiceNo ? `_INV-${invoiceNo.replace(/[^a-zA-Z0-9_-]/g, '_')}` : '';
    a.download = `Supplier_Invoice_${cleanRef}${cleanInv}.${isPdf ? 'pdf' : 'jpg'}`;
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div 
      className="fixed inset-0 z-[120] bg-black/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div 
        className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 max-w-5xl max-h-[94vh] w-full overflow-hidden flex flex-col animate-in zoom-in-95 duration-150"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950">
          <div className="flex items-center gap-2.5">
            <div className={`p-1.5 rounded-lg ${isPdf ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400' : 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400'}`}>
              {isPdf ? <FileText className="w-4 h-4" /> : <ImageIcon className="w-4 h-4" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100">{title}</h4>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${isPdf ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300' : 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300'}`}>
                  {isPdf ? 'PDF Document' : 'Image File'}
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                {poReference ? `PO: ${poReference}` : ''} {invoiceNo ? `• Invoice: ${invoiceNo}` : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownload}
              className="h-8 text-xs gap-1.5 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
              title="Download file to computer"
            >
              <Download className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              <span className="hidden sm:inline">Download</span>
            </Button>
            <a
              href={resolvedSrc}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center h-8 w-8 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-800 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="Open file in new browser tab"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-8 w-8 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              title="Close (Esc)"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Content Preview */}
        <div className="flex-1 overflow-auto bg-slate-950/10 dark:bg-black/60 flex items-center justify-center p-2 sm:p-4 min-h-[420px] max-h-[78vh]">
          {isPdf ? (
            <div className="w-full h-full flex flex-col items-center justify-center min-h-[500px]">
              <iframe
                src={`${resolvedSrc}#toolbar=1`}
                className="w-full h-[72vh] rounded-xl border border-slate-200 dark:border-slate-800 bg-white shadow-md"
                title="Supplier Invoice PDF Preview"
              />
            </div>
          ) : (
            <img 
              src={resolvedSrc} 
              alt={title} 
              className="max-h-[74vh] w-auto max-w-full rounded-xl object-contain shadow-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
            />
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <span className="text-[11px] truncate max-w-md">
            Click outside or press <strong>Esc</strong> to close
          </span>
          <Button
            size="sm"
            onClick={handleDownload}
            className="h-7 text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-semibold gap-1 px-3 shadow-xs"
          >
            <Download className="w-3 h-3" /> Save File
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * Supplier Invoice Attachment & Edit Modal
 * Supports:
 * - Adding PDF / Image supplier invoice
 * - Editing Supplier Invoice No and Invoice Date
 * - Replacing existing file (automatically deletes old file on server to prevent disk waste)
 * - Removing existing file (deletes file on server disk)
 * - Previewing and Downloading
 */
export function SupplierInvoiceModal({ po, isOpen = true, onClose, onUpdated }) {
  const fileInputRef = useRef(null);

  const [invoiceNo, setInvoiceNo] = useState('');
  const [invoiceDate, setInvoiceDate] = useState('');
  const [selectedFile, setSelectedFile] = useState(null); // { name, size, type, dataUrl, isPdf }
  const [isReplacing, setIsReplacing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [previewSrc, setPreviewSrc] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');

  const isModalOpen = isOpen !== undefined ? Boolean(isOpen) : true;

  useEffect(() => {
    if (po && isModalOpen) {
      setInvoiceNo(po.supplierInvoiceNo || '');
      setInvoiceDate(po.supplierInvoiceDate ? po.supplierInvoiceDate.split('T')[0] : '');
      setSelectedFile(null);
      setIsReplacing(false);
      setErrorMessage('');
    }
  }, [po, isModalOpen]);

  if (!isModalOpen || !po) return null;

  const existingFileUrl = po.supplierInvoiceFile || null;
  const isExistingPdf = isPdfDocument(existingFileUrl);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMessage('');

    // Limit to 15MB
    if (file.size > 15 * 1024 * 1024) {
      setErrorMessage('File size exceeds the 15MB limit. Please choose a smaller document or photo.');
      return;
    }

    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    const isImage = file.type.startsWith('image/');

    if (!isPdf && !isImage) {
      setErrorMessage('Unsupported format. Please select a PDF (.pdf) or image (.png, .jpg, .webp).');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      setSelectedFile({
        name: file.name,
        size: (file.size / 1024).toFixed(1) + ' KB',
        type: file.type,
        dataUrl: event.target.result,
        isPdf
      });
    };
    reader.onerror = () => setErrorMessage('Failed to read file from disk.');
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    setIsSubmitting(true);
    setErrorMessage('');
    try {
      const payload = {
        supplierInvoiceNo: invoiceNo.trim() || null,
        supplierInvoiceDate: invoiceDate || null
      };

      if (selectedFile) {
        payload.invoiceFile = selectedFile.dataUrl;
        payload.supplierInvoiceFile = selectedFile.dataUrl;
      }

      const res = await api.patch(`/rm/po/${po.id}/supplier-invoice`, payload);
      const updatedPo = res.data?.po || { ...po, ...payload, supplierInvoiceFile: res.data?.po?.supplierInvoiceFile };

      const isDark = document.documentElement.classList.contains('dark');
      Swal.fire({
        title: `<span class="font-bold text-sm text-slate-800 dark:text-slate-100">Supplier Invoice Updated!</span>`,
        html: `<p class="text-xs text-slate-500 dark:text-slate-400 mt-1">${selectedFile ? (existingFileUrl ? 'New invoice file saved; old attachment deleted from server storage.' : 'Invoice attachment saved successfully.') : 'Invoice details updated.'}</p>`,
        icon: 'success',
        iconColor: '#10b981',
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true,
        background: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)',
        color: isDark ? '#f8fafc' : '#0f172a',
        customClass: {
          popup: 'rounded-xl border border-emerald-100 dark:border-emerald-950 shadow-lg p-3.5',
          timerProgressBar: 'bg-emerald-500'
        }
      });

      if (onUpdated) onUpdated(updatedPo);
      onClose();
    } catch (err) {
      console.error('Failed to update supplier invoice:', err);
      setErrorMessage(err.response?.data?.error || err.message || 'Failed to save supplier invoice.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemoveAttachment = async () => {
    const isDark = document.documentElement.classList.contains('dark');
    const result = await Swal.fire({
      title: 'Remove Invoice Attachment?',
      text: 'The attachment file will be permanently deleted from server storage to free disk space.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Yes, Delete from Server',
      cancelButtonText: 'Cancel',
      background: isDark ? '#0f172a' : '#ffffff',
      color: isDark ? '#f8fafc' : '#0f172a',
      customClass: {
        popup: 'rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl'
      }
    });

    if (!result.isConfirmed) return;

    setIsSubmitting(true);
    try {
      const res = await api.patch(`/rm/po/${po.id}/supplier-invoice`, {
        invoiceFile: null,
        supplierInvoiceFile: null
      });
      const updatedPo = res.data?.po || { ...po, supplierInvoiceFile: null };

      Swal.fire({
        title: 'Attachment Deleted',
        text: 'File has been removed from server disk.',
        icon: 'success',
        toast: true,
        position: 'top-end',
        timer: 2500,
        showConfirmButton: false
      });

      if (onUpdated) onUpdated(updatedPo);
      onClose();
    } catch (err) {
      console.error('Failed to delete attachment:', err);
      setErrorMessage('Failed to delete file from server.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div 
        className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-150"
        onClick={onClose}
      >
        <div 
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-w-xl w-full overflow-hidden flex flex-col animate-in zoom-in-95 duration-150"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/70 dark:bg-slate-950/50 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-800">
                <FileCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  Supplier Invoice Document
                  <span className="px-2 py-0.2 rounded font-mono text-[10px] bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                    {po.referenceNo || 'PO'}
                  </span>
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Vendor: <strong>{po.supplierName || po.supplier?.name || 'Supplier'}</strong>
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-8 w-8 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>

          {/* Form Content */}
          <div className="p-5 space-y-4 max-h-[78vh] overflow-y-auto text-xs">
            {errorMessage && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 flex items-start gap-2 animate-in fade-in">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                <span className="text-[11px] font-medium leading-relaxed">{errorMessage}</span>
              </div>
            )}

            {/* Invoice Meta Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                  Supplier Invoice Number
                </Label>
                <Input
                  type="text"
                  placeholder="e.g. INV-2026-0891"
                  value={invoiceNo}
                  onChange={e => setInvoiceNo(e.target.value)}
                  className="h-8.5 text-xs font-semibold uppercase"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                  Supplier Invoice Date
                </Label>
                <Input
                  type="date"
                  value={invoiceDate}
                  onChange={e => setInvoiceDate(e.target.value)}
                  className="h-8.5 text-xs font-medium"
                />
              </div>
            </div>

            {/* Existing Attachment View (if any and not replacing) */}
            {existingFileUrl && !isReplacing && !selectedFile && (
              <div className="p-3.5 rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/50 dark:bg-emerald-950/20 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span className="font-bold text-emerald-900 dark:text-emerald-300 text-xs flex items-center gap-1.5">
                      {isExistingPdf ? <FileText className="w-4 h-4 text-rose-500" /> : <ImageIcon className="w-4 h-4 text-indigo-500" />}
                      Current Invoice Attachment
                    </span>
                    <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-white dark:bg-slate-900 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300">
                      {isExistingPdf ? 'PDF' : 'IMAGE'}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400">Stored on server</span>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setPreviewSrc(existingFileUrl)}
                    className="h-7 text-xs gap-1.5 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50"
                  >
                    <Eye className="w-3 h-3" /> View / Preview
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const a = document.createElement('a');
                      a.href = resolveInvoiceFileUrl(existingFileUrl);
                      a.download = `Invoice_${po.referenceNo || 'PO'}.${isExistingPdf ? 'pdf' : 'jpg'}`;
                      a.target = '_blank';
                      document.body.appendChild(a);
                      a.click();
                      document.body.removeChild(a);
                    }}
                    className="h-7 text-xs gap-1.5 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100"
                  >
                    <Download className="w-3 h-3 text-slate-500" /> Download
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setIsReplacing(true)}
                    className="h-7 text-xs gap-1.5 bg-white dark:bg-slate-900 border-amber-200 text-amber-700 dark:border-amber-900 dark:text-amber-400 hover:bg-amber-50"
                  >
                    <RefreshCw className="w-3 h-3" /> Replace File
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handleRemoveAttachment}
                    disabled={isSubmitting}
                    className="h-7 text-xs gap-1.5 bg-white dark:bg-slate-900 border-rose-200 text-rose-600 dark:border-rose-900 dark:text-rose-400 hover:bg-rose-50 ml-auto"
                  >
                    <Trash2 className="w-3 h-3" /> Remove File
                  </Button>
                </div>
              </div>
            )}

            {/* Upload Zone (Shown if no file exists OR user clicked 'Replace') */}
            {(!existingFileUrl || isReplacing || selectedFile) && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <UploadCloud className="w-3.5 h-3.5 text-indigo-500" />
                    {existingFileUrl ? 'Select New File to Replace (Old file will be wiped from disk)' : 'Upload Supplier Invoice File'}
                  </Label>
                  {isReplacing && existingFileUrl && (
                    <button
                      type="button"
                      onClick={() => { setIsReplacing(false); setSelectedFile(null); }}
                      className="text-[10px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 underline"
                    >
                      Keep Current File
                    </button>
                  )}
                </div>

                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".pdf,application/pdf,image/png,image/jpeg,image/jpg,image/webp"
                  onChange={handleFileChange}
                  className="hidden"
                />

                {!selectedFile ? (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="p-5 border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-indigo-500 dark:hover:border-indigo-500 rounded-xl bg-slate-50/50 dark:bg-slate-950/40 text-center cursor-pointer transition-all hover:bg-indigo-50/30 group"
                  >
                    <div className="w-10 h-10 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto mb-2 border border-indigo-100 dark:border-indigo-800 group-hover:scale-105 transition-transform">
                      <UploadCloud className="w-5 h-5" />
                    </div>
                    <p className="text-xs font-bold text-slate-700 dark:text-slate-200">
                      Click to browse or drag & drop invoice document
                    </p>
                    <p className="text-[10px] text-slate-400 mt-1">
                      Supports <strong>PDF (.pdf)</strong>, <strong>PNG</strong>, <strong>JPG/JPEG</strong>, <strong>WebP</strong> (Max 15MB)
                    </p>
                  </div>
                ) : (
                  <div className="p-3 rounded-xl border border-indigo-200 dark:border-indigo-900 bg-indigo-50/50 dark:bg-indigo-950/30 flex items-center justify-between">
                    <div className="flex items-center gap-2.5 truncate">
                      <div className={`p-2 rounded-lg ${selectedFile.isPdf ? 'bg-rose-100 text-rose-600' : 'bg-indigo-100 text-indigo-600'}`}>
                        {selectedFile.isPdf ? <FileText className="w-4 h-4" /> : <ImageIcon className="w-4 h-4" />}
                      </div>
                      <div className="truncate">
                        <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                          {selectedFile.name}
                        </p>
                        <p className="text-[10px] text-slate-400">
                          {selectedFile.size} • {selectedFile.isPdf ? 'PDF' : 'IMAGE'} ready to upload
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => setPreviewSrc(selectedFile.dataUrl)}
                        className="h-7 text-xs text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100/50"
                        title="Preview"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => setSelectedFile(null)}
                        className="h-7 text-xs text-rose-500 hover:bg-rose-100/50"
                        title="Remove selection"
                      >
                        <X className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Storage Protection Notice */}
            <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              <span>
                <strong>Storage Optimized:</strong> Uploaded invoice files are saved directly to server storage. When updating or replacing an existing invoice, the older file is immediately pruned from disk.
              </span>
            </div>
          </div>

          {/* Footer Controls */}
          <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 flex items-center justify-between">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={isSubmitting}
              className="text-xs"
            >
              Cancel
            </Button>

            <Button
              type="button"
              size="sm"
              onClick={handleSave}
              disabled={isSubmitting}
              className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 gap-1.5 shadow-xs"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-3 h-3 animate-spin" /> Saving...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" /> Save Changes
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Fullscreen Preview Modal */}
      {previewSrc && (
        <InvoiceFilePreviewModal
          src={previewSrc}
          title="Supplier Invoice Preview"
          poReference={po.referenceNo}
          invoiceNo={invoiceNo}
          onClose={() => setPreviewSrc(null)}
        />
      )}
    </>
  );
}
