import React, { useState, useEffect } from 'react';
import { X, Printer, QrCode, Tag, Check, Building, Calendar, ShieldCheck, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/axios';

export default function BatchLabelModal({
  isOpen = false,
  onClose,
  batchId
}) {
  const [labelData, setLabelData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen && batchId) {
      setLoading(true);
      api.get(`/production/batches-redesign/${batchId}/label`)
        .then(res => setLabelData(res.data))
        .catch(err => console.error('Failed to load batch label:', err))
        .finally(() => setLoading(false));
    }
  }, [isOpen, batchId]);

  if (!isOpen) return null;

  const handlePrint = () => {
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
            <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-sm text-slate-900 dark:text-white">
                GS1 Batch Barcode & Product Label
              </h3>
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
          {loading ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              Generating barcode data...
            </div>
          ) : labelData ? (
            <div 
              id="printable-batch-label" 
              className="w-full bg-white text-slate-900 border-2 border-slate-900 rounded-2xl p-5 shadow-md font-sans text-xs space-y-3 print:border-none print:shadow-none print:p-0"
            >
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

                {/* QR Code Graphic Representation */}
                <div className="col-span-4 flex flex-col items-center justify-center border-l-2 border-slate-900 pl-3">
                  <div className="w-20 h-20 bg-slate-950 p-1.5 rounded-lg flex items-center justify-center text-white">
                    <QrCode className="w-16 h-16" />
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

              {/* Regulatory Footer */}
              <div className="text-[9px] text-slate-600 space-y-0.5 pt-1 leading-tight border-t border-slate-200">
                <p><strong>Storage:</strong> {labelData.storageConditions}</p>
                <p><strong>FSSAI / Lic No:</strong> {labelData.fssaiLicence}</p>
                <p><strong>Mfg by:</strong> {labelData.manufacturer}, {labelData.address}</p>
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
            className="rounded-xl text-xs h-9"
          >
            Close
          </Button>
          <Button
            onClick={handlePrint}
            disabled={!labelData}
            className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs h-9 flex items-center gap-1.5 shadow-sm cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            Print Label (GS1 Format)
          </Button>
        </div>
      </div>
    </div>
  );
}
