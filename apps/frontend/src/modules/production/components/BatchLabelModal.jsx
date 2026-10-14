import React, { useState, useEffect } from 'react';
import { X, Printer, QrCode, AlertOctagon, ShieldAlert } from 'lucide-react';
import QRCodeLib from 'qrcode';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/axios';

export default function BatchLabelModal({
  isOpen = false,
  onClose,
  batchId,
  batch,
  batchStatus
}) {
  const [labelData, setLabelData] = useState(null);
  const [companyProfile, setCompanyProfile] = useState(null);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [loading, setLoading] = useState(true);

  // Check if batch is cancelled from props or fetched data
  const isCancelled =
    batchStatus === 'Cancelled' ||
    batch?.status === 'Cancelled' ||
    labelData?.status === 'Cancelled' ||
    Boolean(labelData?.isCancelled);

  useEffect(() => {
    if (isOpen && batchId) {
      setLoading(true);
      Promise.all([
        api.get(`/production/batches-redesign/${batchId}/label`),
        api.get('/setup/tax').catch(() => ({ data: null }))
      ])
        .then(([labelRes, taxRes]) => {
          setLabelData(labelRes.data);
          if (taxRes && taxRes.data) {
            setCompanyProfile(taxRes.data);
          }
        })
        .catch(err => {
          console.error('Failed to load batch label:', err);
        })
        .finally(() => setLoading(false));
    }
  }, [isOpen, batchId]);

  // Live PostgreSQL Business Profile resolution directly from /setup/tax
  const liveManufacturer = companyProfile?.companyName || labelData?.manufacturer || 'Leonex';
  const liveAddress = companyProfile?.companyAddress || labelData?.address || 'Factory / Registered Office Address';
  const liveLicNo = companyProfile?.companyPan || labelData?.fssaiLicence || 'AAWCS2781F';
  const liveGstin = companyProfile?.companyGstin || labelData?.gstin || '33AAWCS2781F1ZZ';
  const livePan = companyProfile?.companyPan || labelData?.pan || 'AAWCS2781F';
  const liveMobile = companyProfile?.companyMobile || labelData?.mobile || '+91 99404 54154';

  // Live GS1 Scannable QR Payload
  const dynamicQrPayload = labelData ? JSON.stringify({
    batch: labelData?.batchNo,
    product: labelData?.productName,
    code: labelData?.productCode,
    gtin: labelData?.gtin,
    mfd: labelData?.mfd,
    exp: labelData?.expiryDate,
    mrp: Number(labelData?.mrp || 0),
    netWt: labelData?.netWeight,
    mfgBy: liveManufacturer,
    address: liveAddress,
    gstin: liveGstin,
    pan: livePan,
    mobile: liveMobile,
    fssaiLic: liveLicNo,
    status: isCancelled ? 'CANCELLED' : 'ACTIVE'
  }) : '';

  // Generate robust DataURL via 'qrcode' library - fixes Minified React Error #130
  useEffect(() => {
    if (dynamicQrPayload) {
      QRCodeLib.toDataURL(dynamicQrPayload, {
        width: 160,
        margin: 1,
        errorCorrectionLevel: 'M',
        color: {
          dark: '#0f172a',
          light: '#ffffff'
        }
      })
        .then(url => setQrDataUrl(url))
        .catch(err => {
          console.warn('QR Code generation error:', err);
          setQrDataUrl('');
        });
    } else {
      setQrDataUrl('');
    }
  }, [dynamicQrPayload]);

  if (!isOpen) return null;

  const handlePrint = () => {
    if (isCancelled) return;
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
      <div 
        className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl rounded-3xl flex flex-col overflow-hidden max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950">
          <div className="flex items-center gap-2">
            <div className={`p-2 rounded-xl ${isCancelled ? 'bg-rose-100 dark:bg-rose-950 text-rose-600' : 'bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400'}`}>
              {isCancelled ? <ShieldAlert className="w-5 h-5" /> : <QrCode className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-sm text-slate-900 dark:text-white">
                  GS1 Batch Barcode & Product Label
                </h3>
                {isCancelled && (
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 bg-rose-100 dark:bg-rose-900/60 text-rose-700 dark:text-rose-300 rounded-full border border-rose-200 dark:border-rose-800">
                    Cancelled
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-500 font-mono">
                {labelData?.batchNo || 'Generating...'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Printable Label Container */}
        <div className="p-6 overflow-y-auto flex-1 flex flex-col items-center">
          {/* Cancelled Alert Banner */}
          {isCancelled && (
            <div className="w-full mb-4 p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-2xl flex items-start gap-3 text-rose-800 dark:text-rose-300">
              <AlertOctagon className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-black text-xs uppercase tracking-wide">Production Run Cancelled</p>
                <p className="text-[11px] text-rose-700 dark:text-rose-400 mt-0.5 leading-snug">
                  Printing GS1 barcode and product compliance labels is blocked because this batch was cancelled. Cancelled runs produced no finished goods and cannot be labeled.
                </p>
              </div>
            </div>
          )}

          {loading ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              Generating barcode data...
            </div>
          ) : labelData ? (
            <div 
              id="printable-batch-label" 
              className={`relative w-full bg-white text-slate-900 border-2 rounded-2xl p-5 shadow-md font-sans text-xs space-y-3 print:border-none print:shadow-none print:p-0 ${
                isCancelled ? 'border-rose-300 bg-rose-50/20' : 'border-slate-900'
              }`}
            >
              {/* Watermark for Cancelled Batches */}
              {isCancelled && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none z-10 overflow-hidden">
                  <span className="text-4xl md:text-5xl font-black text-rose-500/20 uppercase tracking-widest rotate-[-25deg] border-4 border-dashed border-rose-400/30 px-6 py-2 rounded-2xl">
                    CANCELLED / VOID
                  </span>
                </div>
              )}

              {/* Product Header */}
              <div className="border-b-2 border-slate-900 pb-2.5 flex justify-between items-start">
                <div>
                  <h2 className="text-base font-black tracking-tight uppercase leading-snug">
                    {labelData.productName}
                  </h2>
                  <span className="font-mono text-[11px] font-bold text-slate-600 block">
                    Product Code: {labelData.productCode} • GTIN: {labelData.gtin}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[9px] uppercase font-bold text-slate-500 block">Net Wt / Output</span>
                  <span className="font-black text-sm">{labelData.netWeight}</span>
                </div>
              </div>

              {/* Barcode Visual & Batch Details */}
              <div className="grid grid-cols-12 gap-3 items-center py-2 border-b-2 border-slate-900">
                <div className="col-span-8 space-y-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-bold text-slate-600 uppercase text-[10px]">Batch Number:</span>
                    <span className="font-mono font-black text-xs px-2 py-0.5 bg-slate-100 rounded">
                      {labelData.batchNo}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-bold text-slate-600 uppercase text-[10px]">Mfg Date (MFD):</span>
                    <span className="font-mono font-bold">
                      {labelData.mfd}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-bold text-slate-600 uppercase text-[10px]">Best Before / Expiry:</span>
                    <span className="font-mono font-black text-rose-700">
                      {labelData.expiryDate}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-bold text-slate-600 uppercase text-[10px]">MRP (Incl. taxes):</span>
                    <span className="font-black text-xs">
                      ₹{Number(labelData.mrp || 0).toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* QR Code Dynamic Scannable Representation */}
                <div className="col-span-4 flex flex-col items-center justify-center border-l-2 border-slate-900 pl-3">
                  <div className="p-1.5 bg-white rounded-lg border border-slate-300 shadow-2xs flex items-center justify-center w-20 h-20">
                    {qrDataUrl ? (
                      <img
                        src={qrDataUrl}
                        alt="GS1 QR Code"
                        className="w-18 h-18 object-contain"
                      />
                    ) : (
                      <div className="w-18 h-18 flex items-center justify-center text-[9px] text-slate-400">
                        Generating...
                      </div>
                    )}
                  </div>
                  <span className="text-[8px] font-mono font-bold mt-1 text-center text-slate-500">
                    SCAN FOR TRACE
                  </span>
                </div>
              </div>

              {/* Barcode Lines Simulation */}
              <div className="flex flex-col items-center justify-center py-1">
                <div className="font-mono text-center tracking-widest text-[11px] font-black h-8 flex items-center justify-center gap-0.5 w-full bg-slate-100 rounded p-1">
                  ||||| | |||| ||| |||||| | ||||| |||| | |||||| | |||| |||||
                </div>
                <span className="font-mono text-[9px] text-slate-600 font-bold tracking-wider mt-0.5">
                  (01){labelData.gtin}(10){labelData.batchNo}
                </span>
              </div>

              {/* Regulatory Live Company Profile Footer */}
              <div className="text-[9.5px] text-slate-800 space-y-0.5 pt-1 leading-tight border-t border-slate-200">
                <p><strong>Storage:</strong> {labelData.storageConditions || 'Store in cool and dry place away from direct sunlight'}</p>
                <p><strong>FSSAI / Lic No:</strong> {liveLicNo}</p>
                <p><strong>Mfg by:</strong> {liveManufacturer}, {liveAddress}</p>
                <p className="text-[9px] text-slate-600">
                  <strong>GSTIN:</strong> {liveGstin} • <strong>PAN:</strong> {livePan} • <strong>Mobile:</strong> {liveMobile}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-xs text-rose-500">Failed to render label</p>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={onClose}
            className="rounded-xl text-xs h-9 cursor-pointer"
          >
            Close
          </Button>
          <Button
            onClick={handlePrint}
            disabled={!labelData || isCancelled}
            title={isCancelled ? 'Printing is disabled for cancelled production runs' : 'Print GS1 Batch Label'}
            className={`rounded-xl font-bold text-xs h-9 flex items-center gap-1.5 shadow-sm transition-all ${
              isCancelled
                ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed opacity-60'
                : 'bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer'
            }`}
          >
            <Printer className="w-4 h-4" />
            {isCancelled ? 'Printing Disabled (Cancelled)' : 'Print Label (GS1 Format)'}
          </Button>
        </div>
      </div>
    </div>
  );
}
