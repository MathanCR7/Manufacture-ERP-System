import { useState, useRef, useEffect } from 'react';
import { 
  FileText, UploadCloud, Image as ImageIcon, X, Eye, Trash2, 
  Download, AlertCircle, CheckCircle2, RefreshCw, 
  ExternalLink, FileCheck, Check,
  ZoomIn, ZoomOut, RotateCw, Maximize2, Minimize2, Printer,
  Edit3, ChevronLeft, ChevronRight, FolderCheck, ArrowDownToLine
} from 'lucide-react';
import Swal from 'sweetalert2';
import { api } from '@/lib/axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  resolveInvoiceFileUrl,
  isPdfDocument,
  parseInvoiceFiles,
  downloadInvoiceFile
} from '../utils/supplierInvoiceUtils';

/**
 * Content Viewport for Document Viewer with Zoom, Rotation, and Safe Blob Isolation
 */
function DocumentViewerCanvas({ fileItem, poReference, zoom, rotation }) {
  const isPdf = isPdfDocument(fileItem?.name || fileItem?.url || fileItem?.dataUrl);
  const initialBlob = fileItem?.dataUrl || (fileItem?.url?.startsWith('blob:') ? fileItem.url : null);
  
  const [blobUrl, setBlobUrl] = useState(initialBlob);
  const [loading, setLoading] = useState(!initialBlob);
  const [errorStatus, setErrorStatus] = useState(null);

  useEffect(() => {
    let active = true;
    let createdUrl = null;

    const fileSource = fileItem?.dataUrl || fileItem?.url;
    if (!fileSource) {
      return;
    }

    if (fileSource.startsWith('data:') || fileSource.startsWith('blob:')) {
      return;
    }

    const resolved = resolveInvoiceFileUrl(fileSource);

    // Fetch as blob to verify content type and prevent Vite SPA index.html leakage
    fetch(resolved)
      .then(async (res) => {
        if (!active) return;
        if (!res.ok) {
          setErrorStatus('NOT_FOUND');
          setLoading(false);
          return;
        }

        const contentType = (res.headers.get('content-type') || '').toLowerCase();
        const blob = await res.blob();

        // Check if server served an HTML fallback page
        if (contentType.includes('text/html') || blob.type.includes('text/html')) {
          setErrorStatus('HTML_FALLBACK');
          setLoading(false);
          return;
        }

        createdUrl = URL.createObjectURL(blob);
        if (active) {
          setBlobUrl(createdUrl);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error('Document blob load error:', err);
        if (active) {
          setErrorStatus('LOAD_ERROR');
          setLoading(false);
        }
      });

    return () => {
      active = false;
      if (createdUrl) {
        URL.revokeObjectURL(createdUrl);
      }
    };
  }, [fileItem]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center text-center p-8 space-y-3">
        <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin" />
        <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
          Loading document viewer...
        </p>
        <p className="text-[10px] text-slate-400">
          Fetching document securely from PO folder
        </p>
      </div>
    );
  }

  if (errorStatus) {
    return (
      <div className="max-w-md w-full bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 text-center shadow-xl space-y-4">
        <div className="w-12 h-12 rounded-full bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto border border-rose-200 dark:border-rose-800">
          <AlertCircle className="w-6 h-6" />
        </div>
        <div>
          <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100">
            Document Not Found on Server
          </h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
            {errorStatus === 'HTML_FALLBACK' || errorStatus === 'NOT_FOUND'
              ? `The requested document "${fileItem.name}" has not yet been saved to disk in uploads/invoices/${poReference || 'PO'}/, or the file was deleted.`
              : 'An error occurred while loading this document from server storage.'}
          </p>
          <div className="mt-3 p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950 text-[10px] font-mono text-slate-500 truncate border border-slate-200/80 dark:border-slate-800">
            Path: {fileItem.url || 'Not saved yet'}
          </div>
        </div>
      </div>
    );
  }

  if (!blobUrl) return null;

  return (
    <div 
      className="w-full h-full flex items-center justify-center overflow-auto transition-transform duration-150"
      style={{ transformOrigin: 'center center' }}
    >
      {isPdf ? (
        <div 
          className="w-full h-full flex flex-col items-center justify-center"
          style={{
            transform: `scale(${zoom / 100}) rotate(${rotation}deg)`,
            transition: 'transform 0.15s ease-out'
          }}
        >
          <object
            data={`${blobUrl}#toolbar=1&navpanes=1&view=FitH`}
            type="application/pdf"
            className="w-full h-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white shadow-xl"
          >
            <iframe
              src={`${blobUrl}#toolbar=1&navpanes=1&view=FitH`}
              className="w-full h-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white shadow-xl"
              title={fileItem.name || 'PDF Document Viewer'}
            >
              <div className="p-8 text-center text-slate-500">
                <p className="mb-3 text-sm">PDF preview requires modern browser PDF engine.</p>
                <Button onClick={() => downloadInvoiceFile(fileItem, poReference)} size="sm" className="bg-indigo-600 text-white">
                  <Download className="w-4 h-4 mr-1.5" /> Download PDF File
                </Button>
              </div>
            </iframe>
          </object>
        </div>
      ) : (
        <div 
          className="flex items-center justify-center max-w-full max-h-full"
          style={{
            transform: `scale(${zoom / 100}) rotate(${rotation}deg)`,
            transition: 'transform 0.15s ease-out'
          }}
        >
          <img 
            src={blobUrl} 
            alt={fileItem.name || 'Invoice Image'} 
            className="max-h-[80vh] w-auto max-w-full rounded-xl object-contain shadow-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 pointer-events-auto"
          />
        </div>
      )}
    </div>
  );
}

/**
 * Fullscreen Interactive Document Viewer Tool Modal
 */
export function InvoiceViewerToolModal({ 
  files = [], 
  initialIndex = 0, 
  title = 'Document Viewer', 
  poReference = '', 
  invoiceNo = '', 
  onClose,
  onRenameFile
}) {
  const safeFiles = Array.isArray(files) ? files : [files];
  const [currentIndex, setCurrentIndex] = useState(() => {
    return (initialIndex >= 0 && initialIndex < safeFiles.length) ? initialIndex : 0;
  });
  const [zoom, setZoom] = useState(100);
  const [rotation, setRotation] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editNameVal, setEditNameVal] = useState('');

  const currentFile = safeFiles[currentIndex] || safeFiles[0] || null;

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (isFullscreen) {
          setIsFullscreen(false);
        } else {
          onClose();
        }
      } else if (e.key === 'ArrowRight' && safeFiles.length > 1) {
        setCurrentIndex((prev) => (prev + 1) % safeFiles.length);
        setZoom(100);
        setRotation(0);
      } else if (e.key === 'ArrowLeft' && safeFiles.length > 1) {
        setCurrentIndex((prev) => (prev - 1 + safeFiles.length) % safeFiles.length);
        setZoom(100);
        setRotation(0);
      } else if (e.key === '+' || e.key === '=') {
        setZoom((z) => Math.min(z + 25, 300));
      } else if (e.key === '-') {
        setZoom((z) => Math.max(z - 25, 50));
      } else if (e.key === 'r' || e.key === 'R') {
        setRotation((r) => (r + 90) % 360);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, isFullscreen, safeFiles.length]);

  if (!currentFile) return null;

  const isPdf = isPdfDocument(currentFile.name || currentFile.url || currentFile.dataUrl);

  const handleDownloadCurrent = () => {
    downloadInvoiceFile(currentFile, poReference);
  };

  const handlePrintCurrent = () => {
    const fileSource = currentFile.dataUrl || resolveInvoiceFileUrl(currentFile.url);
    if (!fileSource) return;
    const printWindow = window.open(fileSource, '_blank');
    if (printWindow) {
      printWindow.focus();
      printWindow.onload = () => {
        try {
          printWindow.print();
        } catch (err) {
          console.warn('Print error', err);
        }
      };
    }
  };

  const handleStartRename = () => {
    setEditNameVal(currentFile.name || '');
    setIsEditingName(true);
  };

  const handleSaveRename = () => {
    const trimmed = editNameVal.trim();
    if (trimmed && onRenameFile) {
      onRenameFile(currentFile.id || currentIndex, trimmed);
    }
    setIsEditingName(false);
  };

  return (
    <div 
      className={`fixed inset-0 z-[150] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-150 ${isFullscreen ? '!p-0' : ''}`}
      onClick={onClose}
    >
      <div 
        className={`bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden transition-all duration-200 ${
          isFullscreen 
            ? 'w-screen h-screen rounded-none border-0' 
            : 'max-w-6xl w-full h-[92vh]'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* TOP APPLICATION BAR */}
        <div className="px-4 py-2.5 bg-slate-900 text-white border-b border-slate-800 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`p-1.5 rounded-lg shrink-0 ${isPdf ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' : 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'}`}>
              {isPdf ? <FileText className="w-5 h-5" /> : <ImageIcon className="w-5 h-5" />}
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                {isEditingName ? (
                  <div className="flex items-center gap-1.5">
                    <Input
                      type="text"
                      value={editNameVal}
                      onChange={(e) => setEditNameVal(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveRename();
                        if (e.key === 'Escape') setIsEditingName(false);
                      }}
                      className="h-6.5 text-xs text-white bg-slate-800 border-slate-700 w-56"
                      autoFocus
                    />
                    <Button 
                      size="icon" 
                      onClick={handleSaveRename}
                      className="h-6.5 w-6.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                      title="Save Name"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </Button>
                    <Button 
                      size="icon" 
                      variant="ghost"
                      onClick={() => setIsEditingName(false)}
                      className="h-6.5 w-6.5 text-slate-400 hover:text-white"
                      title="Cancel"
                    >
                      <X className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 truncate">
                    <h3 className="text-sm font-bold text-slate-100 truncate" title={currentFile.name}>
                      {currentFile.name || title}
                    </h3>
                    {onRenameFile && (
                      <button
                        type="button"
                        onClick={handleStartRename}
                        className="text-slate-400 hover:text-indigo-400 p-0.5 rounded transition-colors"
                        title="Rename file display name"
                      >
                        <Edit3 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                )}

                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider shrink-0 ${isPdf ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' : 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'}`}>
                  {isPdf ? 'PDF DOCUMENT' : 'IMAGE FILE'}
                </span>

                {safeFiles.length > 1 && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-slate-800 text-slate-300 shrink-0">
                    {currentIndex + 1} of {safeFiles.length}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                <span>{poReference ? `PO: ${poReference}` : ''}</span>
                {invoiceNo && <span>• Inv: {invoiceNo}</span>}
                {currentFile.size && <span>• {currentFile.size}</span>}
                <span className="text-emerald-400 font-mono text-[10px]">• Dedicated PO Folder</span>
              </div>
            </div>
          </div>

          {/* Multi-file previous/next navigation */}
          {safeFiles.length > 1 && (
            <div className="flex items-center gap-1 bg-slate-800/80 p-0.5 rounded-lg border border-slate-700">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setCurrentIndex((prev) => (prev - 1 + safeFiles.length) % safeFiles.length);
                  setZoom(100);
                  setRotation(0);
                }}
                className="h-7 px-2 text-xs text-slate-300 hover:text-white hover:bg-slate-700"
                title="Previous Document (Left Arrow)"
              >
                <ChevronLeft className="w-4 h-4 mr-0.5" /> Prev
              </Button>
              <span className="text-[11px] text-slate-400 px-1 font-mono">
                {currentIndex + 1}/{safeFiles.length}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setCurrentIndex((prev) => (prev + 1) % safeFiles.length);
                  setZoom(100);
                  setRotation(0);
                }}
                className="h-7 px-2 text-xs text-slate-300 hover:text-white hover:bg-slate-700"
                title="Next Document (Right Arrow)"
              >
                Next <ChevronRight className="w-4 h-4 ml-0.5" />
              </Button>
            </div>
          )}

          {/* Top Window Actions */}
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadCurrent}
              className="h-7.5 text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-semibold border-indigo-500 gap-1.5 shadow-xs"
              title="Download Document"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download</span>
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="h-7.5 w-7.5 text-slate-400 hover:text-white hover:bg-slate-800"
              title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-7.5 w-7.5 text-slate-400 hover:text-white hover:bg-rose-950/40 hover:text-rose-400"
              title="Close Viewer (Esc)"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* INTERACTIVE VIEWER TOOLBAR */}
        <div className="px-4 py-2 bg-slate-100 dark:bg-slate-950/80 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 text-xs shrink-0 select-none">
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setZoom((z) => Math.max(z - 25, 50))}
              disabled={zoom <= 50}
              className="h-7 w-7 p-0 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
              title="Zoom Out (-)"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </Button>

            <button
              type="button"
              onClick={() => setZoom(100)}
              className="h-7 px-2 font-mono text-[11px] font-bold rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
              title="Reset Zoom to 100%"
            >
              {zoom}%
            </button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setZoom((z) => Math.min(z + 25, 300))}
              disabled={zoom >= 300}
              className="h-7 w-7 p-0 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
              title="Zoom In (+)"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </Button>

            <div className="h-4 w-[1px] bg-slate-300 dark:bg-slate-700 mx-1"></div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setRotation((r) => (r + 90) % 360)}
              className="h-7 text-[11px] gap-1 px-2.5 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50"
              title="Rotate 90° Clockwise (R)"
            >
              <RotateCw className="w-3 h-3 text-indigo-500" />
              <span>Rotate {rotation > 0 ? `(${rotation}°)` : ''}</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => { setZoom(100); setRotation(0); }}
              disabled={zoom === 100 && rotation === 0}
              className="h-7 text-[11px] px-2 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-800"
              title="Reset Zoom and Rotation"
            >
              Reset
            </Button>
          </div>

          {/* Quick File Switcher Tabs */}
          {safeFiles.length > 1 && (
            <div className="hidden md:flex items-center gap-1 overflow-x-auto max-w-md py-0.5">
              {safeFiles.map((f, idx) => {
                const isSelected = idx === currentIndex;
                const itPdf = isPdfDocument(f.name || f.url || f.dataUrl);
                return (
                  <button
                    key={f.id || idx}
                    type="button"
                    onClick={() => {
                      setCurrentIndex(idx);
                      setZoom(100);
                      setRotation(0);
                    }}
                    className={`h-7 px-2.5 rounded-md text-[11px] font-semibold flex items-center gap-1.5 transition-all truncate max-w-[140px] ${
                      isSelected 
                        ? 'bg-indigo-600 text-white shadow-xs' 
                        : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50'
                    }`}
                    title={f.name}
                  >
                    {itPdf ? <FileText className="w-3 h-3 shrink-0" /> : <ImageIcon className="w-3 h-3 shrink-0" />}
                    <span className="truncate">{f.name || `File ${idx + 1}`}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Auxiliary Tool Actions */}
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrintCurrent}
              className="h-7 text-xs gap-1.5 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50"
              title="Print document"
            >
              <Printer className="w-3.5 h-3.5 text-slate-500" />
              <span className="hidden sm:inline">Print</span>
            </Button>

            {(currentFile.url || currentFile.dataUrl) && (
              <a
                href={currentFile.dataUrl || resolveInvoiceFileUrl(currentFile.url)}
                target="_blank"
                rel="noopener noreferrer"
                className="h-7 w-7 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 flex items-center justify-center transition-colors"
                title="Open raw document in new browser tab"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>
        </div>

        {/* DOCUMENT VIEWPORT */}
        <div className="flex-1 bg-slate-950/20 dark:bg-black/70 overflow-auto relative flex items-center justify-center p-3 sm:p-5 select-none">
          <DocumentViewerCanvas
            key={currentFile.id || `${currentFile.name}_${currentIndex}`}
            fileItem={currentFile}
            poReference={poReference}
            zoom={zoom}
            rotation={rotation}
          />
        </div>

        {/* BOTTOM TOOL STATUS BAR */}
        <div className="px-4 py-2 bg-slate-900 text-slate-400 border-t border-slate-800 flex items-center justify-between text-[11px] shrink-0">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5">
              <FolderCheck className="w-3.5 h-3.5 text-indigo-400" />
              <span>Storage: <strong>uploads/invoices/{poReference || 'PO'}/</strong></span>
            </span>
            <span className="hidden sm:inline text-slate-600">|</span>
            <span className="hidden sm:inline">
              Format: <strong>{isPdf ? 'PDF Vector' : 'Bitmap Image'}</strong>
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-500 hidden md:inline">
              Shortcuts: <strong>+ / -</strong> Zoom • <strong>R</strong> Rotate • <strong>Esc</strong> Close
            </span>
            <Button
              size="sm"
              onClick={handleDownloadCurrent}
              className="h-6.5 text-[11px] bg-indigo-600 hover:bg-indigo-700 text-white font-semibold gap-1 px-3 shadow-xs"
            >
              <ArrowDownToLine className="w-3 h-3" /> Save File
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Backward compatibility alias for single file previews
 */
export function InvoiceFilePreviewModal({ src, title, poReference, invoiceNo, onClose }) {
  const fileObj = typeof src === 'string' 
    ? { id: 'file_1', name: `Supplier_Invoice_${poReference || 'PO'}`, url: src }
    : src;
  return (
    <InvoiceViewerToolModal
      files={[fileObj]}
      initialIndex={0}
      title={title}
      poReference={poReference}
      invoiceNo={invoiceNo}
      onClose={onClose}
    />
  );
}

/**
 * Complete Multi-File Supplier Invoice Management Modal
 */
export function SupplierInvoiceModal({ po, isOpen = true, onClose, onUpdated }) {
  const fileInputRef = useRef(null);

  const [invoiceNo, setInvoiceNo] = useState(() => po?.supplierInvoiceNo || '');
  const [invoiceDate, setInvoiceDate] = useState(() => (po?.supplierInvoiceDate ? po.supplierInvoiceDate.split('T')[0] : ''));
  const [filesList, setFilesList] = useState(() => parseInvoiceFiles(po?.supplierInvoiceFile, po?.referenceNo || po?.id));
  const [removedFiles, setRemovedFiles] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [activeViewerIndex, setActiveViewerIndex] = useState(null);

  const isModalOpen = isOpen !== undefined ? Boolean(isOpen) : true;
  if (!isModalOpen || !po) return null;

  const poRefClean = po.referenceNo || po.id || 'PO';

  // Multi-file Selection from Disk
  const handleMultipleFilesChange = (e) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (!selectedFiles.length) return;

    setErrorMessage('');
    const newItems = [];
    const oversizedFiles = [];
    const invalidTypes = [];

    let processedCount = 0;

    selectedFiles.forEach((file) => {
      if (file.size > 15 * 1024 * 1024) {
        oversizedFiles.push(file.name);
        return;
      }

      const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
      const isImg = file.type.startsWith('image/');

      if (!isPdf && !isImg) {
        invalidTypes.push(file.name);
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        const cleanName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        newItems.push({
          id: `new_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          name: cleanName,
          size: (file.size / 1024).toFixed(1) + ' KB',
          type: file.type || (isPdf ? 'application/pdf' : 'image/jpeg'),
          dataUrl: event.target.result,
          url: null,
          isNew: true,
          uploadedAt: new Date().toISOString()
        });
        processedCount++;

        if (processedCount === selectedFiles.length - oversizedFiles.length - invalidTypes.length) {
          setFilesList((prev) => [...prev, ...newItems]);
          if (fileInputRef.current) fileInputRef.current.value = '';
        }
      };
      reader.onerror = () => {
        processedCount++;
      };
      reader.readAsDataURL(file);
    });

    if (oversizedFiles.length > 0) {
      setErrorMessage(`Oversized files skipped (>15MB): ${oversizedFiles.join(', ')}`);
    } else if (invalidTypes.length > 0) {
      setErrorMessage(`Unsupported format skipped: ${invalidTypes.join(', ')}. Please select PDF or images.`);
    }
  };

  // Inline Rename
  const handleRename = (fileId, newName) => {
    if (!newName || !newName.trim()) return;
    const sanitized = newName.trim().replace(/[^a-zA-Z0-9._-]/g, '_');
    setFilesList((prev) =>
      prev.map((f) => (f.id === fileId ? { ...f, name: sanitized, isRenamed: true } : f))
    );
  };

  // Remove individual file
  const handleRemoveFile = (fileItem) => {
    if (fileItem.url) {
      setRemovedFiles((prev) => [...prev, fileItem.url]);
    }
    setFilesList((prev) => prev.filter((f) => f.id !== fileItem.id));
  };

  // Download all files
  const handleDownloadAll = async () => {
    if (filesList.length === 0) return;
    for (const f of filesList) {
      await downloadInvoiceFile(f, poRefClean);
    }
  };

  // Save changes to backend
  const handleSave = async () => {
    setIsSubmitting(true);
    setErrorMessage('');
    try {
      const payload = {
        supplierInvoiceNo: invoiceNo.trim() || null,
        supplierInvoiceDate: invoiceDate || null,
        invoiceFiles: filesList,
        removedFiles: removedFiles
      };

      const res = await api.patch(`/rm/po/${po.id}/supplier-invoice`, payload);
      const updatedPo = res.data?.po || { 
        ...po, 
        ...payload, 
        supplierInvoiceFile: res.data?.po?.supplierInvoiceFile 
      };

      const isDark = document.documentElement.classList.contains('dark');
      Swal.fire({
        title: `<span class="font-bold text-sm text-slate-800 dark:text-slate-100">Supplier Invoices Saved!</span>`,
        html: `<p class="text-xs text-slate-500 dark:text-slate-400 mt-1">Saved ${filesList.length} invoice document(s) in dedicated PO folder <strong>uploads/invoices/${poRefClean}/</strong>.</p>`,
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
      console.error('Failed to update supplier invoice documents:', err);
      setErrorMessage(err.response?.data?.error || err.message || 'Failed to save supplier invoice.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div 
        className="fixed inset-0 z-[110] bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-150"
        onClick={onClose}
      >
        <div 
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col animate-in zoom-in-95 duration-150"
          onClick={(e) => e.stopPropagation()}
        >
          {/* MODAL HEADER */}
          <div className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/70 dark:bg-slate-950/50 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-800">
                <FileCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  Supplier Invoice Documents
                  <span className="px-2 py-0.5 rounded font-mono text-[10px] bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                    {poRefClean}
                  </span>
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Vendor: <strong>{po.supplierName || po.supplier?.name || 'Supplier'}</strong> • Folder: <span className="font-mono text-indigo-600 dark:text-indigo-400 font-semibold">uploads/invoices/{poRefClean}/</span>
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

          {/* FORM BODY */}
          <div className="p-5 space-y-4 max-h-[76vh] overflow-y-auto text-xs">
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
                  onChange={(e) => setInvoiceNo(e.target.value)}
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
                  onChange={(e) => setInvoiceDate(e.target.value)}
                  className="h-8.5 text-xs font-medium"
                />
              </div>
            </div>

            {/* Multi-File Upload Area */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <UploadCloud className="w-4 h-4 text-indigo-500" />
                  Attach Invoices, Challans & Images (Multi-File Support)
                </Label>

                {filesList.length > 1 && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={handleDownloadAll}
                    className="h-6 text-[10px] text-indigo-600 dark:text-indigo-400 gap-1 hover:bg-indigo-50 dark:hover:bg-indigo-950"
                  >
                    <Download className="w-3 h-3" /> Download All ({filesList.length})
                  </Button>
                )}
              </div>

              <input
                type="file"
                ref={fileInputRef}
                multiple
                accept=".pdf,application/pdf,image/png,image/jpeg,image/jpg,image/webp"
                onChange={handleMultipleFilesChange}
                className="hidden"
              />

              {/* Upload Drop Zone */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className="p-4 sm:p-5 border-2 border-dashed border-indigo-200 dark:border-indigo-900/60 hover:border-indigo-500 dark:hover:border-indigo-500 rounded-xl bg-indigo-50/20 dark:bg-indigo-950/20 text-center cursor-pointer transition-all hover:bg-indigo-50/40 group"
              >
                <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto mb-2 border border-indigo-200 dark:border-indigo-800 group-hover:scale-105 transition-transform">
                  <UploadCloud className="w-5 h-5" />
                </div>
                <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  Click to select multiple PDFs or photos, or drag & drop here
                </p>
                <p className="text-[10px] text-slate-400 mt-1">
                  Supports <strong>Multiple PDFs (.pdf)</strong>, <strong>PNG</strong>, <strong>JPG/JPEG</strong>, <strong>WebP</strong> (Max 15MB each)
                </p>
              </div>
            </div>

            {/* ATTACHED DOCUMENTS LIST */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                  Attached Documents ({filesList.length})
                </span>
                <span className="text-[10px] text-slate-400">
                  Click name or pencil to rename
                </span>
              </div>

              {filesList.length === 0 ? (
                <div className="p-4 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-center text-slate-400 text-xs">
                  No documents attached yet for this PO.
                </div>
              ) : (
                <div className="space-y-2">
                  {filesList.map((fileItem, idx) => {
                    const itPdf = isPdfDocument(fileItem.name || fileItem.url || fileItem.dataUrl);
                    return (
                      <InvoiceDocumentRow
                        key={fileItem.id || `${fileItem.name}_${idx}`}
                        fileItem={fileItem}
                        isPdf={itPdf}
                        onView={() => setActiveViewerIndex(idx)}
                        onDownload={() => downloadInvoiceFile(fileItem, poRefClean)}
                        onRename={(newName) => handleRename(fileItem.id, newName)}
                        onRemove={() => handleRemoveFile(fileItem)}
                      />
                    );
                  })}
                </div>
              )}
            </div>

            {/* Folder Storage Callout */}
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 text-[10px] text-slate-500 dark:text-slate-400 space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-slate-700 dark:text-slate-300">
                <FolderCheck className="w-3.5 h-3.5 text-indigo-500" />
                <span>Dedicated PO Storage Folder</span>
              </div>
              <p>
                All documents for this PO are saved directly into <strong className="font-mono text-indigo-600 dark:text-indigo-400">apps/backend/uploads/invoices/{poRefClean}/</strong>. Renaming or removing files updates both the database record and server disk.
              </p>
            </div>
          </div>

          {/* MODAL FOOTER */}
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
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Saving Files...
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

      {/* DEDICATED DOCUMENT VIEWER TOOL MODAL */}
      {activeViewerIndex !== null && filesList[activeViewerIndex] && (
        <InvoiceViewerToolModal
          files={filesList}
          initialIndex={activeViewerIndex}
          title="Supplier Invoice Document Viewer"
          poReference={poRefClean}
          invoiceNo={invoiceNo}
          onClose={() => setActiveViewerIndex(null)}
          onRenameFile={(fileIdOrIdx, newName) => {
            const targetId = typeof fileIdOrIdx === 'string' ? fileIdOrIdx : filesList[fileIdOrIdx]?.id;
            if (targetId) handleRename(targetId, newName);
          }}
        />
      )}
    </>
  );
}

/**
 * Single Document Row Card with Inline Rename, View, Download, and Delete
 */
function InvoiceDocumentRow({ fileItem, isPdf, onView, onDownload, onRename, onRemove }) {
  const [isEditing, setIsEditing] = useState(false);
  const [nameVal, setNameVal] = useState(() => fileItem?.name || '');

  const handleSaveName = () => {
    if (nameVal.trim()) {
      onRename(nameVal.trim());
    }
    setIsEditing(false);
  };

  return (
    <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 hover:bg-slate-50 dark:hover:bg-slate-950/60 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
      <div className="flex items-center gap-2.5 min-w-0 flex-1">
        <div className={`p-2 rounded-lg shrink-0 ${isPdf ? 'bg-rose-100 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400' : 'bg-indigo-100 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400'}`}>
          {isPdf ? <FileText className="w-4 h-4" /> : <ImageIcon className="w-4 h-4" />}
        </div>

        <div className="min-w-0 flex-1">
          {isEditing ? (
            <div className="flex items-center gap-1.5 py-0.5">
              <Input
                type="text"
                value={nameVal}
                onChange={(e) => setNameVal(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveName();
                  if (e.key === 'Escape') setIsEditing(false);
                }}
                className="h-6.5 text-xs bg-white dark:bg-slate-900"
                autoFocus
              />
              <Button 
                size="icon" 
                onClick={handleSaveName}
                className="h-6.5 w-6.5 bg-emerald-600 hover:bg-emerald-700 text-white shrink-0"
                title="Save Name"
              >
                <Check className="w-3.5 h-3.5" />
              </Button>
              <Button 
                size="icon" 
                variant="ghost"
                onClick={() => setIsEditing(false)}
                className="h-6.5 w-6.5 text-slate-400 shrink-0"
                title="Cancel"
              >
                <X className="w-3.5 h-3.5" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 truncate">
              <span className="font-bold text-slate-800 dark:text-slate-200 text-xs truncate" title={fileItem.name}>
                {fileItem.name || 'Document'}
              </span>
              <button
                type="button"
                onClick={() => {
                  setNameVal(fileItem.name || '');
                  setIsEditing(true);
                }}
                className="text-slate-400 hover:text-indigo-600 p-0.5 rounded transition-colors"
                title="Rename file display name"
              >
                <Edit3 className="w-3 h-3" />
              </button>
            </div>
          )}

          <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
            <span className={`px-1.5 py-0.2 rounded font-bold uppercase ${isPdf ? 'bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300' : 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300'}`}>
              {isPdf ? 'PDF' : 'IMAGE'}
            </span>
            <span>• {fileItem.size || 'Attached'}</span>
            {fileItem.isNew ? (
              <span className="text-amber-600 dark:text-amber-400 font-semibold">• Ready to Save</span>
            ) : (
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold">• Stored in PO Folder</span>
            )}
          </div>
        </div>
      </div>

      {/* Row Buttons */}
      <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={onView}
          className="h-7 text-xs gap-1.5 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-slate-800"
          title="Open Document Viewer Tool"
        >
          <Eye className="w-3 h-3" /> View Tool
        </Button>

        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={onDownload}
          className="h-7 text-xs gap-1.5 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
          title="Download to computer"
        >
          <Download className="w-3 h-3 text-slate-500" />
        </Button>

        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={onRemove}
          className="h-7 text-xs text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 p-1.5"
          title="Remove this document"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
}
